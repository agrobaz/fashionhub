import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import AdminReports from "../components/AdminReports";
import AdminSubscriptionPayments from "./AdminSubscriptionPayments";
import type { Shop } from "../lib/types";

type AdminShop = Shop & {
  shoe_count: number;
};

type Filter = "all" | "pending" | "active" | "suspended";

type AdminMetrics = {
  listings: number;
  orders: number;
  disputes: number;
  reports: number;
  reviews: number;
  subscriptionPayments: number;
};

export default function AdminPage() {
  const [shops, setShops] = useState<AdminShop[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");

  const [metrics, setMetrics] = useState<AdminMetrics>({
    listings: 0,
    orders: 0,
    disputes: 0,
    reports: 0,
    reviews: 0,
    subscriptionPayments: 0,
  });

  async function load() {
    setLoading(true);
    setError("");

    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;

    if (!userId) {
      setError("You must be logged in.");
      setLoading(false);
      return;
    }

    const { data: adminRow, error: adminError } = await supabase
      .from("admins")
      .select("user_id")
      .eq("user_id", userId)
      .maybeSingle();

    if (adminError || !adminRow) {
      setError("You do not have administrator access.");
      setLoading(false);
      return;
    }

    const [
      { count: listingCount },
      { count: orderCount },
      { count: disputeCount },
      { count: reportCount },
      { count: reviewCount },
      { count: paymentCount },
    ] = await Promise.all([
      supabase
        .from("shoes")
        .select("id", { count: "exact", head: true }),

      supabase
        .from("orders")
        .select("id", { count: "exact", head: true }),

      supabase
        .from("disputes")
        .select("id", { count: "exact", head: true }),

      supabase
        .from("reports")
        .select("id", { count: "exact", head: true }),

      supabase
        .from("product_reviews")
        .select("id", { count: "exact", head: true }),

      supabase
        .from("subscription_payments")
        .select("id", { count: "exact", head: true }),
    ]);

    setMetrics({
      listings: listingCount ?? 0,
      orders: orderCount ?? 0,
      disputes: disputeCount ?? 0,
      reports: reportCount ?? 0,
      reviews: reviewCount ?? 0,
      subscriptionPayments: paymentCount ?? 0,
    });

    const { data, error: shopError } = await supabase
      .from("shops")
      .select("*")
      .order("status", { ascending: true })
      .order("created_at", { ascending: false });

    if (shopError) {
      setError(shopError.message);
      setLoading(false);
      return;
    }

    const rows = (data ?? []) as Shop[];

    const enriched = await Promise.all(
      rows.map(async (shop) => {
        const { count } = await supabase
          .from("shoes")
          .select("id", { count: "exact", head: true })
          .eq("shop_id", shop.id);

        return {
          ...shop,
          shoe_count: count ?? 0,
        };
      }),
    );

    setShops(enriched);
    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, []);

  async function verifyShop(shopId: string) {
    setBusyId(shopId);
    setError("");

    const { error: rpcError } = await supabase.rpc(
      "admin_verify_shop",
      { p_shop_id: shopId },
    );

    if (rpcError) {
      setError(rpcError.message);
      setBusyId(null);
      return;
    }

    await load();
    setBusyId(null);
  }

  async function unverifyShop(shopId: string) {
    setBusyId(shopId);
    setError("");

    const { error: rpcError } = await supabase.rpc(
      "admin_unverify_shop",
      { p_shop_id: shopId },
    );

    if (rpcError) {
      setError(rpcError.message);
      setBusyId(null);
      return;
    }

    await load();
    setBusyId(null);
  }

  async function activateShop(shopId: string) {
    setBusyId(shopId);
    setError("");

    const { error: rpcError } = await supabase.rpc(
      "admin_activate_shop",
      {
        p_shop_id: shopId,
        p_months: 1,
      },
    );

    if (rpcError) {
      setError(rpcError.message);
      setBusyId(null);
      return;
    }

    await load();
    setBusyId(null);
  }

  async function suspendShop(shopId: string) {
    setBusyId(shopId);
    setError("");

    const { error: rpcError } = await supabase
      .from("shops")
      .update({ status: "suspended" })
      .eq("id", shopId);

    if (rpcError) {
      setError(rpcError.message);
      setBusyId(null);
      return;
    }

    await load();
    setBusyId(null);
  }

  const pending = shops.filter((shop) => shop.status === "pending");
  const active = shops.filter((shop) => shop.status === "active");
  const suspended = shops.filter((shop) => shop.status === "suspended");

  const filteredShops = useMemo(() => {
    const query = search.trim().toLowerCase();

    return shops.filter((shop) => {
      const matchesFilter =
        filter === "all" || shop.status === filter;

      const matchesSearch =
        !query ||
        shop.name.toLowerCase().includes(query) ||
        (shop.area ?? "").toLowerCase().includes(query) ||
        shop.whatsapp.toLowerCase().includes(query);

      return matchesFilter && matchesSearch;
    });
  }, [shops, filter, search]);

  if (loading) {
    return (
      <div className="admin-dashboard">
        <div className="box">
          <p className="muted">Loading admin dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-dashboard">
      <section className="admin-hero">
        <div>
          <div className="eyebrow">FashionHub control center</div>
          <h1>Admin dashboard</h1>
          <p className="muted">
            Manage seller shops, verification and marketplace access.
          </p>
        </div>

        <button
          className="btn small"
          disabled={loading}
          onClick={() => void load()}
        >
          Refresh
        </button>
      </section>

      {error && (
        <div className="box admin-error">
          <p className="error">{error}</p>
        </div>
      )}

      <section className="stats admin-stats">
        <div>
          <b>{shops.length}</b>
          <span>Total shops</span>
        </div>

        <div>
          <b>{pending.length}</b>
          <span>Pending</span>
        </div>

        <div>
          <b>{active.length}</b>
          <span>Active</span>
        </div>

        <div>
          <b>{suspended.length}</b>
          <span>Suspended</span>
        </div>
      </section>

      <section className="stats admin-stats admin-platform-stats">
        <div>
          <b>{metrics.listings}</b>
          <span>Total listings</span>
        </div>

        <div>
          <b>{metrics.orders}</b>
          <span>Orders</span>
        </div>

        <div>
          <b>{metrics.disputes}</b>
          <span>Disputes</span>
        </div>

        <div>
          <b>{metrics.reports}</b>
          <span>Reports</span>
        </div>

        <div>
          <b>{metrics.reviews}</b>
          <span>Reviews</span>
        </div>

        <div>
          <b>{metrics.subscriptionPayments}</b>
          <span>Subscription payments</span>
        </div>
      </section>

      <section className="admin-panel">
        <div className="section-head">
          <div>
            <h2>Reports</h2>
            <p className="muted small">
              Review marketplace reports and moderation requests.
            </p>
          </div>
        </div>

        <AdminReports />
      </section>

      <AdminSubscriptionPayments />

      <section className="admin-panel">
        <div className="section-head admin-shop-heading">
          <div>
            <h2>Seller shops</h2>
            <p className="muted small">
              Review seller status, listings and verification.
            </p>
          </div>

          <span className="muted small">
            {filteredShops.length} shown
          </span>
        </div>

        <div className="admin-toolbar">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search shops, areas or WhatsApp"
            aria-label="Search seller shops"
          />

          <select
            value={filter}
            onChange={(event) =>
              setFilter(event.target.value as Filter)
            }
            aria-label="Filter shops"
          >
            <option value="all">All shops</option>
            <option value="pending">Pending</option>
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
          </select>
        </div>

        {filteredShops.length === 0 ? (
          <div className="admin-empty">
            <strong>No shops found.</strong>
            <p className="muted">
              Try changing the search or status filter.
            </p>
          </div>
        ) : (
          <div className="admin-shop-list">
            {filteredShops.map((shop) => {
              const busy = busyId === shop.id;
              const verified =
                shop.verification_status === "verified";

              return (
                <article className="admin-shop-card" key={shop.id}>
                  <div className="admin-shop-main">
                    <div className="admin-shop-avatar">
                      {shop.logo_url ? (
                        <img
                          src={shop.logo_url}
                          alt=""
                          loading="lazy"
                        />
                      ) : (
                        <span>SH</span>
                      )}
                    </div>

                    <div className="admin-shop-info">
                      <div className="admin-shop-title">
                        <h3>{shop.name}</h3>

                        <span
                          className={
                            shop.status === "active"
                              ? "badge ok"
                              : shop.status === "suspended"
                                ? "badge danger"
                                : "badge warn"
                          }
                        >
                          {shop.status}
                        </span>
                      </div>

                      <p className="muted small">
                        {shop.area || "Area not provided"}
                      </p>

                      <p className="muted small">
                        WhatsApp: {shop.whatsapp}
                      </p>
                    </div>
                  </div>

                  <div className="admin-shop-meta">
                    <div>
                      <b>{shop.shoe_count}</b>
                      <span>Listings</span>
                    </div>

                    <div>
                      <b>
                        {shop.paid_until
                          ? new Date(
                              shop.paid_until,
                            ).toLocaleDateString()
                          : "-"}
                      </b>
                      <span>Paid until</span>
                    </div>

                    <div>
                      <b>{verified ? "Yes" : "No"}</b>
                      <span>Verified</span>
                    </div>
                  </div>

                  {shop.payment_ref && (
                    <div className="admin-payment">
                      <strong>Payment reference</strong>
                      <span>{shop.payment_ref}</span>
                    </div>
                  )}

                  <div className="admin-verification">
                    <strong>Verification</strong>

                    {verified ? (
                      <span className="badge ok">
                        Verified
                      </span>
                    ) : (
                      <span className="badge warn">
                        Unverified
                      </span>
                    )}
                  </div>

                  <div className="admin-actions">
                    {!verified ? (
                      <button
                        className="btn small"
                        disabled={busy}
                        onClick={() =>
                          void verifyShop(shop.id)
                        }
                      >
                        {busy ? "Working..." : "Verify shop"}
                      </button>
                    ) : (
                      <button
                        className="btn small ghost"
                        disabled={busy}
                        onClick={() =>
                          void unverifyShop(shop.id)
                        }
                      >
                        {busy ? "Working..." : "Unverify"}
                      </button>
                    )}

                    {shop.status !== "active" && (
                      <button
                        className="btn small gold"
                        disabled={busy}
                        onClick={() =>
                          void activateShop(shop.id)
                        }
                      >
                        {busy
                          ? "Activating..."
                          : "Activate 1 month"}
                      </button>
                    )}

                    {shop.status === "active" && (
                      <button
                        className="btn small ghost"
                        disabled={busy}
                        onClick={() =>
                          void suspendShop(shop.id)
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
    </div>
  );
}




