import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

type SellerShop = {
  id: string;
  owner_id: string;
  name: string;
  whatsapp: string;
  area: string | null;
  status: "pending" | "active" | "suspended";
  paid_until: string | null;
  slug: string | null;
  verification_status: "unverified" | "verified";
  created_at: string;
};

export default function AdminSellers() {
  const [shops, setShops] = useState<SellerShop[]>([]);
  const [listingCounts, setListingCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [showSuspended, setShowSuspended] = useState(false);
  const [error, setError] = useState("");

  async function loadSellers() {
    setLoading(true);
    setError("");

    const { data, error: shopError } = await supabase
      .from("shops")
      .select(
        "id, owner_id, name, whatsapp, area, status, paid_until, slug, verification_status, created_at",
      )
      .order("created_at", { ascending: false })
      .limit(200);

    if (shopError) {
      setError(shopError.message);
      setLoading(false);
      return;
    }

    const sellerShops = (data as SellerShop[]) ?? [];
    setShops(sellerShops);

    if (sellerShops.length > 0) {
      const shopIds = sellerShops.map((shop) => shop.id);

      const { data: listings, error: listingError } = await supabase
        .from("shoes")
        .select("id, shop_id")
        .in("shop_id", shopIds);

      if (listingError) {
        setError(listingError.message);
      } else {
        const counts: Record<string, number> = {};

        for (const listing of listings ?? []) {
          counts[listing.shop_id] =
            (counts[listing.shop_id] ?? 0) + 1;
        }

        setListingCounts(counts);
      }
    }

    setLoading(false);
  }

  useEffect(() => {
    void loadSellers();
  }, []);

  async function setShopStatus(
    shopId: string,
    status: SellerShop["status"],
  ) {
    setBusyId(shopId);
    setError("");

    const { error: rpcError } = await supabase.rpc(
      "admin_set_shop_status",
      {
        p_shop_id: shopId,
        p_status: status,
      },
    );

    if (rpcError) {
      setError(rpcError.message);
      setBusyId(null);
      return;
    }

    await loadSellers();
    setBusyId(null);
  }

  const query = search.trim().toLowerCase();

  const filtered = shops.filter((shop) => {
    if (!showSuspended && shop.status === "suspended") {
      return false;
    }

    if (!query) return true;

    return [
      shop.name,
      shop.area,
      shop.whatsapp,
      shop.owner_id,
      shop.slug,
      shop.status,
      shop.verification_status,
    ]
      .filter(Boolean)
      .some((value) =>
        String(value).toLowerCase().includes(query),
      );
  });

  return (
    <section className="admin-panel">
      <div className="section-head">
        <div>
          <h2>Seller management</h2>
          <p className="muted small">
            Manage FashionHub shops, verification and access.
          </p>
        </div>

        <button
          type="button"
          className="btn small ghost"
          onClick={() => void loadSellers()}
          disabled={loading}
        >
          Refresh
        </button>
      </div>

      {error && (
        <div className="box admin-error">
          <p className="error">{error}</p>
        </div>
      )}

      <div className="admin-toolbar">
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search sellers, shops, areas or status"
          aria-label="Search sellers"
        />

        <label className="admin-check">
          <input
            type="checkbox"
            checked={showSuspended}
            onChange={(event) =>
              setShowSuspended(event.target.checked)
            }
          />
          Show suspended
        </label>
      </div>

      {loading ? (
        <p className="muted">Loading sellers...</p>
      ) : filtered.length === 0 ? (
        <div className="admin-empty">
          <strong>No sellers found.</strong>
          <p className="muted">
            Try another search or enable suspended shops.
          </p>
        </div>
      ) : (
        <div className="admin-seller-list">
          {filtered.map((shop) => {
            const busy = busyId === shop.id;
            const listings = listingCounts[shop.id] ?? 0;

            return (
              <article className="admin-seller-card" key={shop.id}>
                <div className="admin-user-avatar">
                  {shop.name.slice(0, 1).toUpperCase() || "F"}
                </div>

                <div className="admin-user-info">
                  <div className="admin-listing-title">
                    <h3>{shop.name}</h3>

                    <span
                      className={
                        shop.status === "active"
                          ? "badge ok"
                          : shop.status === "suspended"
                            ? "badge danger"
                            : "badge"
                      }
                    >
                      {shop.status}
                    </span>
                  </div>

                  <p className="muted small">
                    {shop.area || "Area not provided"}
                    {" · "}
                    {listings} listing{listings === 1 ? "" : "s"}
                  </p>

                  <p className="muted small">
                    WhatsApp: {shop.whatsapp || "Not provided"}
                  </p>

                  <p className="muted small">
                    Verification:{" "}
                    {shop.verification_status === "verified"
                      ? "Verified"
                      : "Unverified"}
                  </p>

                  <p className="muted small">
                    Subscription until:{" "}
                    {shop.paid_until
                      ? new Date(
                          shop.paid_until,
                        ).toLocaleDateString()
                      : "Not active"}
                  </p>

                  <p className="muted small">
                    Owner ID: {shop.owner_id}
                  </p>
                </div>

                <div className="admin-actions">
                  {shop.status === "suspended" ? (
                    <button
                      type="button"
                      className="btn small gold"
                      disabled={busy}
                      onClick={() =>
                        void setShopStatus(shop.id, "active")
                      }
                    >
                      {busy ? "Working..." : "Reactivate"}
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="btn small ghost"
                      disabled={busy}
                      onClick={() =>
                        void setShopStatus(shop.id, "suspended")
                      }
                    >
                      {busy ? "Working..." : "Suspend"}
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
