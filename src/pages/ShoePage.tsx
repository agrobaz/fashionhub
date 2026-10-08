import { useEffect, useMemo, useState } from "react";
import { useCart } from "../lib/cart-context";
import type { MouseEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth-context";
import type {
  ProductReview,
  ProductVariant,
  Shoe,
} from "../lib/types";
import {
  conditionLabel,
  formatPrice,
  whatsappLink,
} from "../lib/format";
import ReportButton from "../components/ReportButton";

type ShoePhoto = {
  id: string;
  shoe_id: string;
  photo_url: string;
  sort_order: number;
};

type ShopInfo = {
  id: string;
  name: string;
  whatsapp: string;
  area: string | null;
  slug: string | null;
  logo_url: string | null;
  verification_status: "unverified" | "verified";
};

type RelatedProduct = Shoe;

export default function ShoePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addItem } = useCart();
  const { user } = useAuth();
  const userId = user?.id;

  const [shoe, setShoe] = useState<Shoe | null>(null);
  const [photos, setPhotos] = useState<ShoePhoto[]>([]);
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [reviews, setReviews] = useState<ProductReview[]>([]);
  const [related, setRelated] = useState<RelatedProduct[]>([]);

  const [activePhoto, setActivePhoto] = useState(0);
  const [selectedSize, setSelectedSize] = useState("");
  const [selectedColor, setSelectedColor] = useState("");

  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);
  const [alertSet, setAlertSet] = useState(false);
  const [alertBusy, setAlertBusy] = useState(false);
  const [actionError, setActionError] = useState("");
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewText, setReviewText] = useState("");
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewError, setReviewError] = useState("");
  const [reviewSuccess, setReviewSuccess] = useState(false);
  const [canReview, setCanReview] = useState(false);

  useEffect(() => {
    if (!id) return;

    let mounted = true;

    async function loadProduct() {
      setLoading(true);
      setActionError("");

      const [
        shoeResult,
        photoResult,
        variantResult,
        reviewResult,
      ] = await Promise.all([
        supabase
          .from("shoes")
          .select(`
            *,
            shops(
              name,
              whatsapp,
              area,
              slug,
              logo_url,
              verification_status
            )
          `)
          .eq("id", id)
          .maybeSingle(),

        supabase
          .from("shoe_photos")
          .select("id, shoe_id, photo_url, sort_order")
          .eq("shoe_id", id)
          .order("sort_order", { ascending: true }),

        supabase
          .from("product_variants")
          .select("*")
          .eq("shoe_id", id)
          .order("created_at", { ascending: true }),

        supabase
          .from("product_reviews")
          .select("*")
          .eq("shoe_id", id).eq("status", "approved")
          .order("created_at", { ascending: false }),
      ]);

      if (!mounted) return;

      if (shoeResult.error) {
        setActionError(shoeResult.error.message);
      }

      const product = (shoeResult.data as Shoe | null) ?? null;

      setShoe(product);
      setPhotos((photoResult.data as ShoePhoto[]) ?? []);
      setVariants((variantResult.data as ProductVariant[]) ?? []);
      setReviews((reviewResult.data as ProductReview[]) ?? []);
      setActivePhoto(0);

      if (product?.sizes?.length) {
        setSelectedSize(product.sizes[0]);
      }

      if (product?.colors?.length) {
        setSelectedColor(product.colors[0]);
      }

      if (product?.id) {
        void supabase.rpc("record_shoe_view", {
          p_shoe_id: product.id,
        });

        const { data: relatedData } = await supabase
          .from("shoes")
          .select(`
            *,
            shops(
              name,
              whatsapp,
              area,
              slug,
              logo_url,
              verification_status
            )
          `)
          .eq("category", product.category)
          .eq("is_available", true)
          .neq("id", product.id)
          .order("created_at", { ascending: false })
          .limit(4);

        if (mounted) {
          setRelated((relatedData as RelatedProduct[]) ?? []);
        }
      }

      setLoading(false);
    }

    void loadProduct();

    return () => {
      mounted = false;
    };
  }, [id]);

  useEffect(() => {
    if (!id || !user) {
      setSaved(false);
      setAlertSet(false);
      return;
    }

    async function loadBuyerState() {
      const [{ data: savedData }, { data: alertData }] =
        await Promise.all([
          supabase
            .from("saved_shoes")
            .select("shoe_id")
            .eq("shoe_id", id)
            .eq("user_id", userId!)
            .maybeSingle(),

          supabase
            .from("stock_alerts")
            .select("id")
            .eq("shoe_id", id)
            .eq("user_id", userId!)
            .maybeSingle(),
        ]);

      setSaved(Boolean(savedData));
      setAlertSet(Boolean(alertData));
    }

    void loadBuyerState();
  }, [id, user, userId]);

  useEffect(() => {
    if (!id || !userId) {
      setCanReview(false);
      return;
    }

    async function checkReviewEligibility() {
      const { data, error } = await supabase.rpc(
        "can_review_shoe",
        {
          p_shoe_id: id,
          p_user_id: userId,
        },
      );

      if (error) {
        setCanReview(false);
        return;
      }

      setCanReview(Boolean(data));
    }

    void checkReviewEligibility();
  }, [id, userId]);

  const allPhotos = useMemo(() => {
    if (photos.length > 0) return photos;

    if (shoe?.photo_url) {
      return [
        {
          id: "main",
          shoe_id: shoe.id,
          photo_url: shoe.photo_url,
          sort_order: 0,
        },
      ];
    }

    return [];
  }, [photos, shoe]);

  const currentPhoto = allPhotos[activePhoto];

  const sizes = shoe?.sizes ?? (
    shoe?.size ? [shoe.size] : []
  );

  const colors = shoe?.colors ?? (
    shoe?.color ? [shoe.color] : []
  );

  async function submitReview() {
    if (!id || !userId) {
      setReviewError("Please sign in to leave a review.");
      return;
    }

    if (!canReview) {
      setReviewError(
        "Only buyers who have completed a purchase can review this product.",
      );
      return;
    }

    if (reviews.some((review) => review.user_id === userId)) {
      setReviewError("You have already reviewed this product.");
      return;
    }

    if (reviewRating < 1 || reviewRating > 5) {
      setReviewError("Please select a rating from 1 to 5 stars.");
      return;
    }

    const trimmedText = reviewText.trim();

    if (!trimmedText) {
      setReviewError("Please write a short review.");
      return;
    }

    if (trimmedText.length > 1000) {
      setReviewError("Your review must be 1000 characters or less.");
      return;
    }

    setReviewSubmitting(true);
    setReviewError("");
    setReviewSuccess(false);

    const { data, error } = await supabase
      .from("product_reviews")
      .insert({
        shoe_id: id,
        user_id: userId,
        rating: reviewRating,
        review_text: trimmedText,
        status: "pending",
      })
      .select("*")
      .single();

    setReviewSubmitting(false);

    if (error) {
      if (error.code === "23505") {
        setReviewError("You have already reviewed this product.");
      } else {
        setReviewError(error.message);
      }
      return;
    }

    if (data) {
      // New reviews are pending moderation and are intentionally
      // not added to the public approved-review list.
    }

    setReviewRating(0);
    setReviewText("");
    setReviewSuccess(true);
    setCanReview(false);
  }

  const averageRating =
    reviews.length > 0
      ? reviews.reduce(
          (sum, review) => sum + review.rating,
          0,
        ) / reviews.length
      : 0;

  const displayedPrice =
    shoe?.sale_price && shoe.sale_price > 0
      ? shoe.sale_price
      : shoe?.price ?? 0;

  const hasSale =
    Boolean(
      shoe?.sale_price &&
      shoe.sale_price > 0 &&
      shoe.sale_price < shoe.price,
    );

  const selectedVariant = variants.find(
    (variant) =>
      (variant.size === null ||
        !selectedSize ||
        variant.size === selectedSize) &&
      (variant.color === null ||
        !selectedColor ||
        variant.color === selectedColor),
  );

  const availableStock =
    selectedVariant?.stock_quantity ??
    shoe?.stock_quantity ??
    0;

  const isOutOfStock =
    !shoe?.is_available ||
    availableStock <= 0;

  async function toggleSave() {
    if (!user || !shoe) {
      navigate("/login");
      return;
    }

    setActionError("");

    if (saved) {
      const { error } = await supabase
        .from("saved_shoes")
        .delete()
        .eq("shoe_id", shoe.id)
        .eq("user_id", userId!);

      if (error) {
        setActionError(error.message);
        return;
      }

      setSaved(false);
      return;
    }

    const { error } = await supabase
      .from("saved_shoes")
      .insert({
        user_id: user.id,
        shoe_id: shoe.id,
      });

    if (error) {
      setActionError(error.message);
      return;
    }

    setSaved(true);
  }

  async function toggleStockAlert() {
    if (!user || !shoe) {
      navigate("/login");
      return;
    }

    setAlertBusy(true);
    setActionError("");

    try {
      if (alertSet) {
        const { error } = await supabase
          .from("stock_alerts")
          .delete()
          .eq("user_id", userId!)
          .eq("shoe_id", shoe.id);

        if (error) throw error;

        setAlertSet(false);
      } else {
        const { error } = await supabase
          .from("stock_alerts")
          .insert({
            user_id: user.id,
            shoe_id: shoe.id,
            size: selectedSize || null,
            color: selectedColor || null,
          });

        if (error) throw error;

        setAlertSet(true);
      }
    } catch (error) {
      setActionError(
        error instanceof Error
          ? error.message
          : "Could not update your stock alert.",
      );
    } finally {
      setAlertBusy(false);
    }
  }

  function handleChat(e: MouseEvent<HTMLAnchorElement>) {
    if (!user || !shoe) {
      e.preventDefault();
      navigate("/login");
      return;
    }

    void supabase.from("chat_clicks").insert({
      shoe_id: shoe.id,
      shop_id: shoe.shop_id,
      buyer_id: user.id,
    });
  }

  if (loading) {
    return (
      <div className="product-loading">
        <div className="product-loading-line" />
        <p className="muted">Loading product...</p>
      </div>
    );
  }

  if (!shoe) {
    return (
      <div className="empty-market">
        <div className="empty-icon" aria-hidden="true">
          FH
        </div>

        <p className="eyebrow">Product unavailable</p>

        <h3>This product is unavailable</h3>

        <p className="muted">
          The seller may have removed or sold this item.
        </p>

        <Link to="/" className="btn">
          Back to marketplace
        </Link>
      </div>
    );
  }

  const shop = shoe.shops as ShopInfo | null | undefined;
  const phone = shop?.whatsapp;

  const message =
    "Hi, I'm interested in your " +
    shoe.title +
    " (" +
    formatPrice(displayedPrice) +
    ") on FashionHub.";

  const listingLabel =
    shoe.listing_type === "new"
      ? "Brand new"
      : conditionLabel(shoe.condition) || "Second-hand";

  return (
    <div className="product-page">
      <Link to="/" className="back">
        &larr; Back
      </Link>

      <div className="product-detail-grid">
        <section className="product-gallery">
          <div className="product-main-image">
            {currentPhoto ? (
              <img
                src={currentPhoto.photo_url}
                alt={shoe.title}
              />
            ) : (
              <div className="noimg">
                <span className="noimg-mark">FH</span>
                <small>No photo</small>
              </div>
            )}

            {hasSale && (
              <span className="tag tn">
                Sale
              </span>
            )}
          </div>

          {allPhotos.length > 1 && (
            <div className="product-thumbnails">
              {allPhotos.map((photo, index) => (
                <button
                  type="button"
                  key={photo.id}
                  className={
                    index === activePhoto
                      ? "product-thumbnail active"
                      : "product-thumbnail"
                  }
                  onClick={() => setActivePhoto(index)}
                  aria-label={
                    "View product photo " +
                    (index + 1)
                  }
                >
                  <img
                    src={photo.photo_url}
                    alt=""
                  />
                </button>
              ))}
            </div>
          )}
        </section>

        <section className="product-info">
          <div className="product-topline">
            <span className="tag">
              {listingLabel}
            </span>

            {shoe.category && (
              <span className="muted small">
                {shoe.category}
              </span>
            )}
          </div>

          <h1>{shoe.title}</h1>

          {shoe.brand && (
            <p className="product-brand">
              {shoe.brand}
            </p>
          )}

          <div className="product-price-row">
            <strong className="product-price">
              {formatPrice(displayedPrice)}
            </strong>

            {hasSale && (
              <span className="product-old-price">
                {formatPrice(shoe.price)}
              </span>
            )}
          </div>

          {hasSale && (
            <p className="product-sale-note">
              Special price available now.
            </p>
          )}

          {averageRating > 0 && (
            <div className="product-rating">
              <span aria-hidden="true">
                ÃƒÆ’Ã‚Â¢Ãƒâ€¹Ã…â€œÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦
              </span>
              <strong>
                {averageRating.toFixed(1)}
              </strong>
              <span className="muted">
                ({reviews.length} review
                {reviews.length === 1 ? "" : "s"})
              </span>
            </div>
          )}

          <div className="product-meta-list">
            {shoe.gender && (
              <div>
                <span>For</span>
                <strong>{shoe.gender}</strong>
              </div>
            )}

            {shoe.subcategory && (
              <div>
                <span>Type</span>
                <strong>{shoe.subcategory}</strong>
              </div>
            )}

            {shoe.seller_location && (
              <div>
                <span>Location</span>
                <strong>
                  {shoe.seller_location}
                </strong>
              </div>
            )}

            <div>
              <span>Availability</span>
              <strong>
                {isOutOfStock
                  ? "Out of stock"
                  : availableStock + " available"}
              </strong>
            </div>
          </div>

          {sizes.length > 0 && (
            <div className="product-choice">
              <div className="product-choice-heading">
                <strong>Size</strong>
                <span className="muted">
                  Choose your size
                </span>
              </div>

              <div className="choice-buttons">
                {sizes.map((size) => (
                  <button
                    type="button"
                    key={size}
                    className={
                      selectedSize === size
                        ? "choice-button active"
                        : "choice-button"
                    }
                    onClick={() =>
                      setSelectedSize(size)
                    }
                  >
                    {size}
                  </button>
                ))}
              </div>
            </div>
          )}

          {colors.length > 0 && (
            <div className="product-choice">
              <div className="product-choice-heading">
                <strong>Color</strong>
                <span className="muted">
                  {selectedColor}
                </span>
              </div>

              <div className="choice-buttons">
                {colors.map((color) => (
                  <button
                    type="button"
                    key={color}
                    className={
                      selectedColor === color
                        ? "choice-button active"
                        : "choice-button"
                    }
                    onClick={() =>
                      setSelectedColor(color)
                    }
                  >
                    {color}
                  </button>
                ))}
              </div>
            </div>
          )}

          {(shoe.fit_type || shoe.fit_note) && (
            <div className="fit-guide">
              <div>
                <strong>Size & fit</strong>

                {shoe.fit_type && (
                  <span className="fit-badge">
                    {shoe.fit_type}
                  </span>
                )}
              </div>

              {shoe.fit_note && (
                <p className="muted">
                  {shoe.fit_note}
                </p>
              )}

              <p className="muted small">
                Check the seller's measurements and
                compare with something that fits you
                well before ordering.
              </p>
            </div>
          )}

          {shoe.description && (
            <div className="product-description">
              <h3>About this product</h3>
              <p>{shoe.description}</p>
            </div>
          )}

          {actionError && (
            <div className="product-form-error">
              {actionError}
            </div>
          )}

          <div className="product-actions">
            <button
              type="button"
              className="btn gold"
              onClick={() => {
                if (isOutOfStock) {
                  void toggleStockAlert();
                } else if (!user) {
                  navigate("/login");
                } else {
                  if (!shoe) return;
                  setActionError("");
                  void addItem({
                    shoe,
                    quantity: 1,
                    size: selectedSize || null,
                    color: selectedColor || null,
                    variantId: selectedVariant?.id ?? null,
                  })
                    .then(() => navigate("/cart"))
                    .catch((err: unknown) =>
                      setActionError(
                        err instanceof Error ? err.message : "Could not add this item to your cart.",
                      ),
                    );
                }
              }}
              disabled={alertBusy}
            >
              {isOutOfStock
                ? alertSet
                  ? "Stock alert set"
                  : "Alert me when available"
                : "Add to cart"}
            </button>

            <button
              type="button"
              className="btn"
              onClick={() => void toggleSave()}
            >
              {saved
                ? "\u2665 Saved"
                : "\u2661 Add to wishlist"}
            </button>
          </div>

          {isOutOfStock && (
            <p className="muted small">
              This item is currently out of stock.
              Set an alert and we'll keep the request
              associated with your account.
            </p>
          )}

          {phone && (
            <a
              href={whatsappLink(
                phone,
                message,
              )}
              target="_blank"
              rel="noreferrer"
              className="btn whatsapp product-whatsapp"
              onClick={handleChat}
            >
              WhatsApp seller
            </a>
          )}

          <div className="seller-card">
            <div className="seller-card-main">
              {shop?.logo_url ? (
                <img
                  src={shop.logo_url}
                  alt=""
                  className="seller-avatar"
                />
              ) : (
                <div className="seller-avatar seller-avatar-fallback">
                  {shop?.name
                    ?.slice(0, 1)
                    .toUpperCase() || "S"}
                </div>
              )}

              <div>
                <span className="muted small">
                  Sold by
                </span>

                <strong>
                  {shop?.name || "FashionHub seller"}
                </strong>

                {shop?.area && (
                  <span className="muted small">
                    {shop.area}
                  </span>
                )}
              </div>

              {shop?.verification_status ===
                "verified" && (
                <span className="verified-badge">
                  ÃƒÆ’Ã‚Â¢Ãƒâ€¦Ã¢â‚¬Å“ÃƒÂ¢Ã¢â€šÂ¬Ã…â€œ Verified
                </span>
              )}
            </div>

            {shop?.slug && (
              <Link
                to={"/store/" + shop.slug}
                className="btn small ghost"
              >
                Visit shop
              </Link>
            )}
          </div>

          <div className="product-trust">
            <span>Secure marketplace</span>
            <span>Real seller listings</span>
            <span>Buyer support</span>
          </div>

          <ReportButton
            shoeId={shoe.id}
            shopId={shoe.shop_id}
          />
        </section>
      </div>

      <section className="product-reviews-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Buyer feedback</p>
            <h2>Reviews</h2>
          </div>

          {reviews.length > 0 && (
            <div className="review-summary">
              <strong>{averageRating.toFixed(1)}</strong>
              <span aria-hidden="true">?????</span>
              <small>
                {reviews.length} review
                {reviews.length === 1 ? "" : "s"}
              </small>
            </div>
          )}
        </div>

        {user && canReview && !reviews.some(
          (review) => review.user_id === userId,
        ) && (
          <div className="review-form">
            <div>
              <p className="eyebrow">Verified purchase</p>
              <h3>Share your experience</h3>
              <p className="muted">
                You purchased this product. Tell other buyers what you
                thought about it.
              </p>
            </div>

            <div className="review-rating-picker">
              <span className="muted">Your rating</span>

              <div
                className="review-stars"
                role="radiogroup"
                aria-label="Choose a rating"
              >
                {[1, 2, 3, 4, 5].map((rating) => (
                  <button
                    key={rating}
                    type="button"
                    className={
                      rating <= reviewRating
                        ? "review-star active"
                        : "review-star"
                    }
                    onClick={() => setReviewRating(rating)}
                    aria-label={`${rating} star${
                      rating === 1 ? "" : "s"
                    }`}
                    aria-pressed={rating === reviewRating}
                  >
                    ?
                  </button>
                ))}
              </div>
            </div>

            <textarea
              className="review-input"
              value={reviewText}
              onChange={(event) => setReviewText(event.target.value)}
              placeholder="What did you like about this product?"
              maxLength={1000}
              rows={5}
            />

            <div className="review-form-footer">
              <small className="muted">
                {reviewText.length}/1000
              </small>

              <button
                type="button"
                className="primary-button"
                onClick={() => void submitReview()}
                disabled={reviewSubmitting}
              >
                {reviewSubmitting
                  ? "Submitting..."
                  : "Publish review"}
              </button>
            </div>

            {reviewError && (
              <p className="form-error" role="alert">
                {reviewError}
              </p>
            )}

            {reviewSuccess && (
              <p className="form-success" role="status">
                Thanks! Your verified review was submitted and is awaiting moderation.
              </p>
            )}
          </div>
        )}

        {!user && (
          <div className="empty-market compact">
            <p className="muted">
              Sign in and purchase this product to leave a verified review.
            </p>
          </div>
        )}

        {user &&
          !canReview &&
          !reviews.some((review) => review.user_id === userId) && (
            <div className="empty-market compact">
              <p className="muted">
                Verified buyers can leave a review after their order is
                completed.
              </p>
            </div>
          )}

        {reviews.length === 0 ? (
          <div className="empty-market compact">
            <p className="muted">
              No reviews yet. Be the first verified buyer to share your
              experience.
            </p>
          </div>
        ) : (
          <div className="review-list">
            {reviews.map((review) => (
              <article
                className="review-card"
                key={review.id}
              >
                <div className="review-card-top">
                  <span aria-label={`${review.rating} out of 5 stars`}>
                    {"?".repeat(review.rating)}
                    {"?".repeat(5 - review.rating)}
                  </span>

                  <small className="muted">
                    {new Date(
                      review.created_at,
                    ).toLocaleDateString()}
                  </small>
                </div>

                {review.review_text && (
                  <p>{review.review_text}</p>
                )}

                {review.photo_url && (
                  <img
                    src={review.photo_url}
                    alt="Customer review"
                    className="review-photo"
                  />
                )}
              </article>
            ))}
          </div>
        )}
      </section>
      {related.length > 0 && (
        <section className="related-products">
          <div className="section-heading">
            <div>
              <p className="eyebrow">
                More to explore
              </p>
              <h2>Related fashion</h2>
            </div>
          </div>

          <div className="market-grid">
            {related.map((item) => (
              <Link
                key={item.id}
                to={"/shoe/" + item.id}
                className="card marketplace-card"
              >
                <div className="thumb marketplace-thumb">
                  {item.photo_url ? (
                    <img
                      src={item.photo_url}
                      alt={item.title}
                      loading="lazy"
                    />
                  ) : (
                    <div className="noimg">
                      <span className="noimg-mark">
                        FH
                      </span>
                    </div>
                  )}
                </div>

                <div className="card-body">
                  <div className="ctitle">
                    {item.title}
                  </div>

                  {item.brand && (
                    <div className="card-brand">
                      {item.brand}
                    </div>
                  )}

                  <div className="price">
                    {formatPrice(
                      item.sale_price &&
                        item.sale_price < item.price
                        ? item.sale_price
                        : item.price,
                    )}
                  </div>

                  <div className="card-meta">
                    {item.subcategory && (
                      <span>
                        {item.subcategory}
                      </span>
                    )}

                    {item.seller_location && (
                      <span>
                        {item.seller_location}
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}






