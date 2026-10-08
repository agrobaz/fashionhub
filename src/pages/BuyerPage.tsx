import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth-context";
import type { Shoe } from "../lib/types";
import { formatPrice } from "../lib/format";

type ChatClick = {
  id: string;
  created_at: string;
  shoe: Shoe | null;
};

export default function BuyerPage() {
  const { user } = useAuth();

  const [saved, setSaved] = useState<Shoe[]>([]);
  const [clicks, setClicks] = useState<ChatClick[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [removingId, setRemovingId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;

    const userId = user.id;

    async function load() {
      setLoading(true);
      setError("");

      const { data: savedRows, error: savedError } = await supabase
        .from("saved_shoes")
        .select("shoe_id")
        .eq("user_id", userId);

      if (savedError) {
        setError(savedError.message);
        setLoading(false);
        return;
      }

      const savedIds = (savedRows ?? []).map((row) => row.shoe_id);

      if (savedIds.length > 0) {
        const { data: savedShoes, error: shoesError } = await supabase
          .from("shoes")
          .select("*, shops(name, whatsapp, area, slug, logo_url, verification_status)")
          .in("id", savedIds)
          .order("created_at", { ascending: false });

        if (shoesError) {
          setError(shoesError.message);
          setLoading(false);
          return;
        }

        setSaved((savedShoes ?? []) as Shoe[]);
      } else {
        setSaved([]);
      }

      const { data: clickRows, error: clickError } = await supabase
        .from("chat_clicks")
        .select(
          "id, created_at, shoe_id, shoes(*, shops(name, whatsapp, area, slug, logo_url, verification_status))",
        )
        .eq("buyer_id", userId)
        .order("created_at", { ascending: false })
        .limit(10);

      if (clickError) {
        setError(clickError.message);
        setLoading(false);
        return;
      }

      setClicks(
        (clickRows ?? []).map(
          (row: {
            id: string;
            created_at: string;
            shoes: Shoe[];
          }) => ({
            id: row.id,
            created_at: row.created_at,
            shoe: row.shoes?.[0] ?? null,
          }),
        ),
      );

      setLoading(false);
    }

    void load();
  }, [user]);

  async function removeSaved(shoeId: string) {
    if (!user) return;

    setError("");
    setRemovingId(shoeId);

    const { error: removeError } = await supabase
      .from("saved_shoes")
      .delete()
      .eq("user_id", user.id)
      .eq("shoe_id", shoeId);

    setRemovingId(null);

    if (removeError) {
      setError(removeError.message);
      return;
    }

    setSaved((current) =>
      current.filter((shoe) => shoe.id !== shoeId),
    );
  }

  const availableSaved = useMemo(
    () => saved.filter((shoe) => shoe.is_available).length,
    [saved],
  );

  const unavailableSaved = saved.length - availableSaved;

  const displayName =
    user?.user_metadata?.full_name ||
    user?.email?.split("@")[0] ||
    "Buyer";

  if (loading) {
    return (
      <div className="buyer-dashboard">
        <div className="box">
          <p className="muted">Loading your FashionHub account...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="buyer-dashboard">
      <section className="buyer-welcome">
        <div>
          <div className="eyebrow">FashionHub buyer</div>
          <h1>Welcome, {displayName}</h1>
          <p className="muted">
            Keep track of shoes you like and sellers you've contacted.
          </p>
        </div>

        <Link to="/" className="btn">
          Browse marketplace
        </Link>
      </section>

      {error && (
        <div className="box">
          <p className="error">{error}</p>
        </div>
      )}

      <section className="stats buyer-stats">
        <div>
          <b>{saved.length}</b>
          <span>Saved shoes</span>
        </div>

        <div>
          <b>{availableSaved}</b>
          <span>Still available</span>
        </div>

        <div>
          <b>{unavailableSaved}</b>
          <span>No longer available</span>
        </div>

        <div>
          <b>{clicks.length}</b>
          <span>Seller chats</span>
        </div>
      </section>

      <section className="buyer-quick-actions">
        <Link to="/" className="buyer-action">
          <span className="buyer-action-icon">S</span>
          <div>
            <strong>Find shoes</strong>
            <small>Browse the marketplace</small>
          </div>
        </Link>

        <Link to="/" className="buyer-action">
          <span className="buyer-action-icon">N</span>
          <div>
            <strong>New arrivals</strong>
            <small>See the latest listings</small>
          </div>
        </Link>

        <Link to="/" className="buyer-action">
          <span className="buyer-action-icon">U</span>
          <div>
            <strong>Second-hand deals</strong>
            <small>Find pre-owned shoes</small>
          </div>
        </Link>
      </section>

      <section>
        <div className="section-head buyer-section-heading">
          <div>
            <h2>Saved shoes</h2>
            <p className="muted small">
              Shoes you saved while browsing FashionHub.
            </p>
          </div>

          <span className="muted small">
            {saved.length} saved
          </span>
        </div>

        {saved.length === 0 ? (
          <div className="empty-market">
            <div className="empty-icon">S</div>
            <h3>Your saved list is empty</h3>
            <p className="muted">
              When you find a shoe you like, save it here so you can easily
              come back to it.
            </p>
            <Link to="/" className="btn">
              Start browsing
            </Link>
          </div>
        ) : (
          <div className="grid buyer-saved-grid">
            {saved.map((shoe) => {
              const removing = removingId === shoe.id;

              return (
                <article className="box buyer-shoe-card" key={shoe.id}>
                  <div className="buyer-shoe-image">
                    {shoe.photo_url ? (
                      <img
                        src={shoe.photo_url}
                        alt={shoe.title}
                        loading="lazy"
                      />
                    ) : (
                      <div className="rthumb">
                        <span>SH</span>
                      </div>
                    )}

                    <span
                      className={
                        shoe.is_available
                          ? "buyer-stock available"
                          : "buyer-stock unavailable"
                      }
                    >
                      {shoe.is_available ? "Available" : "Unavailable"}
                    </span>
                  </div>

                  <div className="buyer-shoe-content">
                    <h3>{shoe.title}</h3>

                    {shoe.brand && (
                      <div className="muted small">
                        {shoe.brand}
                      </div>
                    )}

                    <div className="price">
                      {formatPrice(shoe.price)}
                    </div>

                    <div className="muted small">
                      {shoe.listing_type === "new"
                        ? "Brand new"
                        : "Second-hand"}
                      {shoe.size ? " | Size " + shoe.size : ""}
                    </div>

                    {shoe.shops?.name && (
                      <div className="shop-name">
                        Store: {shoe.shops.name}
                        {shoe.shops.verification_status === "verified" && (
                          <span className="verified-mini">
                            Verified
                          </span>
                        )}
                      </div>
                    )}

                    {shoe.shops?.area && (
                      <div className="muted small">
                        {shoe.shops.area}
                      </div>
                    )}

                    <div className="buyer-card-actions">
                      <Link
                        to={`/shoe/${shoe.id}`}
                        className="btn small"
                      >
                        View listing
                      </Link>

                      <button
                        className="btn small ghost"
                        disabled={removing}
                        onClick={() => void removeSaved(shoe.id)}
                      >
                        {removing ? "Removing..." : "Remove"}
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section>
        <div className="section-head buyer-section-heading">
          <div>
            <h2>Recent seller chats</h2>
            <p className="muted small">
              Your latest WhatsApp interest from FashionHub.
            </p>
          </div>
        </div>

        {clicks.length === 0 ? (
          <div className="box">
            <strong>No seller chats yet.</strong>
            <p className="muted">
              When you contact a seller through WhatsApp, the interaction will
              appear here.
            </p>
            <Link to="/" className="btn ghost">
              Find a shoe
            </Link>
          </div>
        ) : (
          <div className="buyer-chat-list">
            {clicks.map((click) => (
              <div className="row buyer-chat-row" key={click.id}>
                {click.shoe?.photo_url ? (
                  <img src={click.shoe.photo_url} alt="" />
                ) : (
                  <div className="rthumb">
                    <span>SH</span>
                  </div>
                )}

                <div className="grow">
                  <strong>
                    {click.shoe?.title ?? "Shoe listing"}
                  </strong>

                  {click.shoe && (
                    <div className="muted small">
                      {formatPrice(click.shoe.price)}
                      {click.shoe.shops?.name
                        ? " | " + click.shoe.shops.name
                        : ""}
                    </div>
                  )}

                  <div className="muted small">
                    Contacted{" "}
                    {new Date(click.created_at).toLocaleString()}
                  </div>
                </div>

                {click.shoe ? (
                  <Link
                    to={`/shoe/${click.shoe.id}`}
                    className="btn small ghost"
                  >
                    View
                  </Link>
                ) : (
                  <span className="muted small">
                    Listing unavailable
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="buyer-bottom-cta">
        <div>
          <div className="eyebrow">Keep shopping</div>
          <h2>There are more shoes waiting for you.</h2>
          <p className="muted">
            Discover new arrivals, second-hand deals and sellers around
            FashionHub.
          </p>
        </div>

        <Link to="/" className="btn gold">
          Continue shopping
        </Link>
      </section>
    </div>
  );
}

