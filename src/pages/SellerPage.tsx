import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth-context";
import type { Shoe, Shop } from "../lib/types";
import ShopForm from "../components/ShopForm";
import ProductForm from "../components/ProductForm";
import { conditionLabel, formatPrice } from "../lib/format";

export default function SellerPage() {
  const { user } = useAuth();

  const [shop, setShop] = useState<Shop | null>(null);
  const [shoes, setShoes] = useState<Shoe[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [analytics, setAnalytics] = useState({
    listings: 0,
    available_listings: 0,
    views: 0,
    saved: 0,
    whatsapp_clicks: 0,
    followers: 0,
  });
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) return;

    setError("");

    const { data: shopData, error: shopError } = await supabase
      .from("shops")
      .select("*")
      .eq("owner_id", user.id)
      .maybeSingle();

    if (shopError) {
      setError(shopError.message);
      setLoading(false);
      return;
    }

    const currentShop = (shopData as Shop | null) ?? null;
    setShop(currentShop);

    if (!currentShop) {
      setShoes([]);
      setAnalytics({
        listings: 0,
        available_listings: 0,
        views: 0,
        saved: 0,
        whatsapp_clicks: 0,
        followers: 0,
      });
      setLoading(false);
      return;
    }

    const { data: analyticsData, error: analyticsError } =
      await supabase.rpc("get_my_shop_analytics");

    if (analyticsError) {
      setActionError(analyticsError.message);
    } else if (analyticsData) {
      setAnalytics({
        listings: Number(analyticsData.listings ?? 0),
        available_listings: Number(
          analyticsData.available_listings ?? 0,
        ),
        views: Number(analyticsData.views ?? 0),
        saved: Number(analyticsData.saved ?? 0),
        whatsapp_clicks: Number(
          analyticsData.whatsapp_clicks ?? 0,
        ),
        followers: Number(analyticsData.followers ?? 0),
      });
    }

    const { data: shoeData, error: shoeError } = await supabase
      .from("shoes")
      .select("*")
      .eq("shop_id", currentShop.id)
      .order("created_at", { ascending: false });

    if (shoeError) {
      setError(shoeError.message);
      setLoading(false);
      return;
    }

    setShoes((shoeData ?? []) as Shoe[]);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  async function toggleAvailable(shoe: Shoe) {
    setActionError("");
    setSavingId(shoe.id);

    const { error: err } = await supabase
      .from("shoes")
      .update({ is_available: !shoe.is_available })
      .eq("id", shoe.id);

    setSavingId(null);

    if (err) {
      setActionError(err.message);
      return;
    }

    await load();
  }

  async function removeShoe(shoe: Shoe) {
    if (!window.confirm("Delete " + shoe.title + "?")) return;

    setActionError("");
    setSavingId(shoe.id);

    const { error: err } = await supabase
      .from("shoes")
      .delete()
      .eq("id", shoe.id);

    setSavingId(null);

    if (err) {
      setActionError(err.message);
      return;
    }

    await load();
  }

  const availableCount = useMemo(
    () => shoes.filter((shoe) => shoe.is_available).length,
    [shoes],
  );

  const soldCount = shoes.length - availableCount;

  if (loading) {
    return (
      <div className="seller-dashboard seller-loading">
        <div className="seller-loading-line" />
        <p className="muted">Loading your seller dashboard...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="box seller-error">
        <p className="eyebrow">Dashboard error</p>
        <h3>Could not load your shop</h3>
        <p className="error">{error}</p>

        <button
          type="button"
          className="btn"
          onClick={() => void load()}
        >
          Try again
        </button>
      </div>
    );
  }

  if (!shop || editing) {
    return (
      <div className="seller-dashboard">
        <div className="top seller-page-top">
          <div>
            <p className="eyebrow">FashionHub seller</p>
            <h2>
              {shop ? "Edit shop details" : "Set up your shop"}
            </h2>
            <p className="muted">
              {shop
                ? "Keep your store information accurate for buyers."
                : "Create your seller profile and start listing shoes."}
            </p>
          </div>
        </div>

        <ShopForm
          shop={shop}
          onSaved={() => {
            setEditing(false);
            void load();
          }}
          onCancel={shop ? () => setEditing(false) : undefined}
        />
      </div>
    );
  }

  const isSuspended = shop.status === "suspended";
  const live = !isSuspended;

  const badge = isSuspended
    ? "Suspended"
    : shop.status === "active"
      ? "Active"
      : "Free setup";

  return (
    <div className="seller-dashboard">
      <div className="seller-header">
        <div>
          <p className="eyebrow">Seller dashboard</p>

          <h1>{shop.name}</h1>

          <p className="seller-contact">
            {shop.whatsapp}
            {shop.area ? " | " + shop.area : ""}
          </p>
        </div>

        <div className="seller-header-actions">
          <span className={live ? "badge ok" : "badge warn"}>
            {badge}
          </span>

          {shop.slug && (
            <Link
              to={"/store/" + shop.slug}
              className="btn small ghost"
            >
              View storefront
            </Link>
          )}

          <button
            type="button"
            className="btn small"
            onClick={() => setEditing(true)}
          >
            Edit shop
          </button>
        </div>
      </div>

      {isSuspended && (
        <div className="box seller-suspended">
          <p className="eyebrow">Account status</p>
          <strong>Your shop is suspended.</strong>
          <p className="muted">
            Your listings are not available to buyers right now.
            Contact the FashionHub administrator if you believe this
            is a mistake.
          </p>
        </div>
      )}

      {live && (
        <>
          <div className="seller-free">
            <div>
              <p className="eyebrow">FashionHub free period</p>
              <h3>Your first 2 months are free</h3>
              <p className="muted">
                List and manage your shoes now. You do not need
                to enter payment information during the free
                setup period.
              </p>
            </div>

            <span className="free-pill">FREE</span>
          </div>

          <section className="seller-overview">
            <div className="seller-section-title">
              <div>
                <p className="eyebrow">Performance</p>
                <h2>Shop overview</h2>
              </div>

              <span className="muted small">
                Live analytics
              </span>
            </div>

            <div className="seller-stats">
              <div className="stat seller-stat">
                <strong>{analytics.views}</strong>
                <span>Listing views</span>
              </div>

              <div className="stat seller-stat">
                <strong>{analytics.whatsapp_clicks}</strong>
                <span>WhatsApp clicks</span>
              </div>

              <div className="stat seller-stat">
                <strong>{analytics.saved}</strong>
                <span>Saves</span>
              </div>

              <div className="stat seller-stat">
                <strong>{analytics.followers}</strong>
                <span>Followers</span>
              </div>

              <div className="stat seller-stat">
                <strong>{analytics.listings}</strong>
                <span>Total listings</span>
              </div>

              <div className="stat seller-stat">
                <strong>{analytics.available_listings}</strong>
                <span>Available now</span>
              </div>
            </div>

            <div className="seller-inventory-summary">
              <span>
                <strong>{availableCount}</strong> available
              </span>

              <span>
                <strong>{soldCount}</strong> marked sold
              </span>

              <span>
                <strong>{shoes.length}</strong> total shoes
              </span>
            </div>
          </section>

          <section className="seller-add-section">
            <div className="seller-section-title">
              <div>
                <p className="eyebrow">Inventory</p>
                <h2>Add a shoe</h2>
              </div>

              <span className="muted small">
                Up to 6 photos supported
              </span>
            </div>

            <ProductForm
              shopId={shop.id}
              onAdded={() => void load()}
            />
          </section>

          <section className="seller-list-section">
            <div className="seller-section-title seller-list-heading">
              <div>
                <p className="eyebrow">Manage inventory</p>
                <h2>My shoes</h2>
                <p className="muted small">
                  Manage availability or remove listings you no
                  longer sell.
                </p>
              </div>

              <span className="result-count">
                {shoes.length}{" "}
                {shoes.length === 1 ? "listing" : "listings"}
              </span>
            </div>

            {actionError && (
              <div className="box seller-action-error">
                <p className="error">{actionError}</p>
              </div>
            )}

            {shoes.length === 0 && (
              <div className="empty-market seller-empty">
                <div
                  className="empty-icon"
                  aria-hidden="true"
                >
                  SH
                </div>

                <p className="eyebrow">Your inventory is empty</p>

                <h3>No products listed yet</h3>

                <p className="muted">
                  Add your first shoe above and it will appear
                  in your marketplace.
                </p>
              </div>
            )}

            {shoes.length > 0 && (
              <div className="seller-list">
                {shoes.map((shoe) => {
                  const busy = savingId === shoe.id;

                  const condition =
                    shoe.listing_type === "new"
                      ? "Brand new"
                      : conditionLabel(shoe.condition) ||
                        "Second-hand";

                  return (
                    <div
                      className="row seller-row"
                      key={shoe.id}
                    >
                      {shoe.photo_url ? (
                        <img
                          className="rthumb seller-product-image"
                          src={shoe.photo_url}
                          alt=""
                          loading="lazy"
                        />
                      ) : (
                        <div className="rthumb">
                          <span>SH</span>
                        </div>
                      )}

                      <div className="grow seller-row-main">
                        <div className="seller-shoe-title">
                          {shoe.title}
                        </div>

                        <div className="seller-shoe-meta">
                          {formatPrice(shoe.price)}
                          {" | "}
                          {condition}

                          {shoe.size
                            ? " | Size " + shoe.size
                            : ""}
                        </div>

                        <div
                          className={
                            shoe.is_available
                              ? "stock-live"
                              : "stock-sold"
                          }
                        >
                          {shoe.is_available
                            ? "Available"
                            : "Marked sold"}
                        </div>
                      </div>

                      <div className="seller-row-actions">
                        <Link
                          to={"/shoe/" + shoe.id}
                          className="btn small ghost"
                        >
                          View
                        </Link>

                        <button
                          type="button"
                          className="btn small ghost"
                          disabled={busy}
                          onClick={() =>
                            void toggleAvailable(shoe)
                          }
                        >
                          {busy
                            ? "Saving..."
                            : shoe.is_available
                              ? "Mark sold"
                              : "Make available"}
                        </button>

                        <button
                          type="button"
                          className="btn small danger"
                          disabled={busy}
                          onClick={() =>
                            void removeShoe(shoe)
                          }
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}

