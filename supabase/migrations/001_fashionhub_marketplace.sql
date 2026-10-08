-- ============================================================
-- FashionHub Marketplace Extension
-- Extends the existing FashionHub/ShoeHub database
-- Reuses existing wishlist, follows, photos, reports and
-- subscription tables.
-- ============================================================

BEGIN;

-- ============================================================
-- 1. EXTRA PRODUCT INFORMATION
-- ============================================================

ALTER TABLE public.shoes
  ADD COLUMN IF NOT EXISTS gender text,
  ADD COLUMN IF NOT EXISTS subcategory text,
  ADD COLUMN IF NOT EXISTS seller_location text,
  ADD COLUMN IF NOT EXISTS fit_type text,
  ADD COLUMN IF NOT EXISTS fit_note text,
  ADD COLUMN IF NOT EXISTS sizes text[],
  ADD COLUMN IF NOT EXISTS colors text[],
  ADD COLUMN IF NOT EXISTS stock_quantity integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS sale_price integer,
  ADD COLUMN IF NOT EXISTS is_featured boolean NOT NULL DEFAULT false;

-- Prevent invalid stock values.
ALTER TABLE public.shoes
  DROP CONSTRAINT IF EXISTS shoes_stock_quantity_check;

ALTER TABLE public.shoes
  ADD CONSTRAINT shoes_stock_quantity_check
  CHECK (stock_quantity >= 0);

-- ============================================================
-- 2. PRODUCT VARIANTS
-- Size/color-specific inventory.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.product_variants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shoe_id uuid NOT NULL REFERENCES public.shoes(id) ON DELETE CASCADE,
  size text,
  color text,
  stock_quantity integer NOT NULL DEFAULT 0,
  price integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT product_variants_stock_check
    CHECK (stock_quantity >= 0),

  CONSTRAINT product_variants_price_check
    CHECK (price IS NULL OR price >= 0)
);

CREATE INDEX IF NOT EXISTS product_variants_shoe_id_idx
  ON public.product_variants(shoe_id);

-- ============================================================
-- 3. BACK-IN-STOCK ALERTS
-- ============================================================

CREATE TABLE IF NOT EXISTS public.stock_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  shoe_id uuid NOT NULL REFERENCES public.shoes(id) ON DELETE CASCADE,
  size text,
  color text,
  is_notified boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, shoe_id, size, color)
);

CREATE INDEX IF NOT EXISTS stock_alerts_user_id_idx
  ON public.stock_alerts(user_id);

CREATE INDEX IF NOT EXISTS stock_alerts_shoe_id_idx
  ON public.stock_alerts(shoe_id);

-- ============================================================
-- 4. PRODUCT REVIEWS
-- ============================================================

CREATE TABLE IF NOT EXISTS public.product_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shoe_id uuid NOT NULL REFERENCES public.shoes(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rating integer NOT NULL CHECK (rating BETWEEN 1 AND 5),
  review_text text,
  photo_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(shoe_id, user_id)
);

CREATE INDEX IF NOT EXISTS product_reviews_shoe_id_idx
  ON public.product_reviews(shoe_id);

-- ============================================================
-- 5. SELLER STOREFRONT CUSTOMIZATION
-- shops already contains slug/logo/description/verification.
-- This table stores premium visual customization.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.shop_customization (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL UNIQUE REFERENCES public.shops(id) ON DELETE CASCADE,
  theme text NOT NULL DEFAULT 'cinematic',
  primary_color text,
  secondary_color text,
  banner_url text,
  banner_url_2 text,
  pinned_product_ids uuid[] NOT NULL DEFAULT '{}',
  show_fashionhub_branding boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- 6. PRODUCT DISCOUNTS
-- ============================================================

CREATE TABLE IF NOT EXISTS public.product_discounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shoe_id uuid NOT NULL REFERENCES public.shoes(id) ON DELETE CASCADE,
  discount_percent numeric NOT NULL CHECK (
    discount_percent > 0 AND discount_percent <= 100
  ),
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT product_discounts_dates_check
    CHECK (ends_at > starts_at)
);

CREATE INDEX IF NOT EXISTS product_discounts_shoe_id_idx
  ON public.product_discounts(shoe_id);

-- ============================================================
-- 7. RLS
-- ============================================================

ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_customization ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_discounts ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- PRODUCT VARIANTS
-- ============================================================

DROP POLICY IF EXISTS "Public can view product variants"
  ON public.product_variants;

CREATE POLICY "Public can view product variants"
  ON public.product_variants
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Shop owners manage product variants"
  ON public.product_variants;

CREATE POLICY "Shop owners manage product variants"
  ON public.product_variants
  FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM public.shoes s
      JOIN public.shops sh ON sh.id = s.shop_id
      WHERE s.id = product_variants.shoe_id
        AND sh.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.shoes s
      JOIN public.shops sh ON sh.id = s.shop_id
      WHERE s.id = product_variants.shoe_id
        AND sh.owner_id = auth.uid()
    )
  );

-- ============================================================
-- STOCK ALERTS
-- ============================================================

DROP POLICY IF EXISTS "Users manage own stock alerts"
  ON public.stock_alerts;

CREATE POLICY "Users manage own stock alerts"
  ON public.stock_alerts
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- REVIEWS
-- ============================================================

DROP POLICY IF EXISTS "Public can read reviews"
  ON public.product_reviews;

CREATE POLICY "Public can read reviews"
  ON public.product_reviews
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Users can create own reviews"
  ON public.product_reviews;

CREATE POLICY "Users can create own reviews"
  ON public.product_reviews
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own reviews"
  ON public.product_reviews;

CREATE POLICY "Users can update own reviews"
  ON public.product_reviews
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own reviews"
  ON public.product_reviews;

CREATE POLICY "Users can delete own reviews"
  ON public.product_reviews
  FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================
-- SHOP CUSTOMIZATION
-- ============================================================

DROP POLICY IF EXISTS "Public can view shop customization"
  ON public.shop_customization;

CREATE POLICY "Public can view shop customization"
  ON public.shop_customization
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Shop owners manage customization"
  ON public.shop_customization;

CREATE POLICY "Shop owners manage customization"
  ON public.shop_customization
  FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM public.shops sh
      WHERE sh.id = shop_customization.shop_id
        AND sh.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.shops sh
      WHERE sh.id = shop_customization.shop_id
        AND sh.owner_id = auth.uid()
    )
  );

-- ============================================================
-- DISCOUNTS
-- ============================================================

DROP POLICY IF EXISTS "Public can view active discounts"
  ON public.product_discounts;

CREATE POLICY "Public can view active discounts"
  ON public.product_discounts
  FOR SELECT
  USING (
    is_active = true
    AND now() BETWEEN starts_at AND ends_at
  );

DROP POLICY IF EXISTS "Shop owners manage discounts"
  ON public.product_discounts;

CREATE POLICY "Shop owners manage discounts"
  ON public.product_discounts
  FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM public.shoes s
      JOIN public.shops sh ON sh.id = s.shop_id
      WHERE s.id = product_discounts.shoe_id
        AND sh.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.shoes s
      JOIN public.shops sh ON sh.id = s.shop_id
      WHERE s.id = product_discounts.shoe_id
        AND sh.owner_id = auth.uid()
    )
  );

COMMIT;