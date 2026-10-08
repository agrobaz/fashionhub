-- ============================================================
-- 003_secure_product_reviews.sql
-- FashionHub review moderation + security
-- ============================================================

-- Add moderation state.
ALTER TABLE public.product_reviews
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending';

-- Restrict moderation states.
ALTER TABLE public.product_reviews
  DROP CONSTRAINT IF EXISTS product_reviews_status_check;

ALTER TABLE public.product_reviews
  ADD CONSTRAINT product_reviews_status_check
  CHECK (status IN ('pending', 'approved', 'hidden'));

-- Existing reviews must be reviewed by an admin.
UPDATE public.product_reviews
SET status = 'pending'
WHERE status IS NULL;

-- Fast lookup for public approved reviews.
CREATE INDEX IF NOT EXISTS product_reviews_approved_shoe_idx
  ON public.product_reviews(shoe_id, created_at DESC)
  WHERE status = 'approved';

-- Make sure RLS is enabled.
ALTER TABLE public.product_reviews ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- REMOVE OLD POLICIES
-- ============================================================

DROP POLICY IF EXISTS "Public can read reviews"
  ON public.product_reviews;

DROP POLICY IF EXISTS "Public can read approved reviews"
  ON public.product_reviews;

DROP POLICY IF EXISTS "Users can create own reviews"
  ON public.product_reviews;

DROP POLICY IF EXISTS "Verified buyers can create reviews"
  ON public.product_reviews;

DROP POLICY IF EXISTS "Users can submit own pending reviews"
  ON public.product_reviews;

DROP POLICY IF EXISTS "Users can update own reviews"
  ON public.product_reviews;

DROP POLICY IF EXISTS "Users can edit own pending reviews"
  ON public.product_reviews;

DROP POLICY IF EXISTS "Users can delete own reviews"
  ON public.product_reviews;

DROP POLICY IF EXISTS "Admins can read all reviews"
  ON public.product_reviews;

DROP POLICY IF EXISTS "Admins can moderate reviews"
  ON public.product_reviews;

-- ============================================================
-- PUBLIC READ
-- Only approved reviews are publicly visible.
-- ============================================================

CREATE POLICY "Public can read approved reviews"
  ON public.product_reviews
  FOR SELECT
  USING (
    status = 'approved'
  );

-- ============================================================
-- ADMIN READ
-- Admins can see pending, approved and hidden reviews.
-- ============================================================

CREATE POLICY "Admins can read all reviews"
  ON public.product_reviews
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.admins
      WHERE public.admins.user_id = auth.uid()
    )
  );

-- ============================================================
-- VERIFIED BUYER INSERT
-- Preserve the original purchase-verification rule.
-- ============================================================

CREATE POLICY "Verified buyers can submit pending reviews"
  ON public.product_reviews
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND status = 'pending'
    AND public.can_review_shoe(shoe_id, auth.uid())
  );

-- ============================================================
-- BUYER UPDATE
-- Buyers may only edit their own pending reviews.
-- They cannot approve or hide their own review.
-- ============================================================

CREATE POLICY "Users can edit own pending reviews"
  ON public.product_reviews
  FOR UPDATE
  USING (
    auth.uid() = user_id
    AND status = 'pending'
  )
  WITH CHECK (
    auth.uid() = user_id
    AND status = 'pending'
  );

-- ============================================================
-- BUYER DELETE
-- ============================================================

CREATE POLICY "Users can delete own reviews"
  ON public.product_reviews
  FOR DELETE
  USING (
    auth.uid() = user_id
  );

-- ============================================================
-- ADMIN MODERATION
-- Admins can approve, hide or otherwise moderate reviews.
-- ============================================================

CREATE POLICY "Admins can moderate reviews"
  ON public.product_reviews
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM public.admins
      WHERE public.admins.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.admins
      WHERE public.admins.user_id = auth.uid()
    )
  );

-- ============================================================
-- PROTECT REVIEW IDENTITY
-- Neither buyers nor admins can move a review to another
-- user or another product.
-- ============================================================

CREATE OR REPLACE FUNCTION public.protect_product_review_identity()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.user_id <> OLD.user_id
     OR NEW.shoe_id <> OLD.shoe_id THEN
    RAISE EXCEPTION 'Review owner and product cannot be changed';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_product_review_identity
  ON public.product_reviews;

CREATE TRIGGER protect_product_review_identity
BEFORE UPDATE ON public.product_reviews
FOR EACH ROW
EXECUTE FUNCTION public.protect_product_review_identity();

-- ============================================================
-- PROTECT MODERATION STATE FROM NULL
-- ============================================================

ALTER TABLE public.product_reviews
  ALTER COLUMN status SET DEFAULT 'pending';

ALTER TABLE public.product_reviews
  ALTER COLUMN status SET NOT NULL;
