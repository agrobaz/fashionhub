import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth-context";
import { formatPrice } from "../lib/format";

type OrderInfo = { status: string; created_at: string };
type ItemRow = {
  shoe_id: string;
  product_title: string;
  quantity: number;
  line_total: number;
  orders: OrderInfo | OrderInfo[] | null;
};
type StockRow = {
  id: string;
  title: string;
  stock_quantity: number;
  is_available: boolean;
};
type Best = { title: string; units: number; revenue: number };
type Stats = {
  revenue: number;
  orders: number;
  units: number;
  pending: number;
  best: Best[];
};

const LOW_STOCK = 5;

function orderOf(value: ItemRow["orders"]): OrderInfo | null {
  return Array.isArray(value) ? value[0] ?? null : value;
}

export default function SellerInsightsPage() {
  const { user } = useAuth();
  const [days, setDays] = useState(30);
  const [stats, setStats] = useState<Stats | null>(null);
  const [lowStock, setLowStock] = useState<StockRow[]>([]);
  const [soldOut, setSoldOut] = useState<StockRow[]>([]);
  const [hasShop, setHasShop] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [traffic, setTraffic] = useState<{ views: number; chats: number } | null>(null);

  useEffect(() => {
    let active = true;

    async function load() {
      if (!user) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setError("");

      const { data: shops, error: shopError } = await supabase
        .from("shops")
        .select("id")
        .eq("owner_id", user.id);

      if (!active) return;

      if (shopError) {
        setError(shopError.message);
        setLoading(false);
        return;
      }

      const ids = (shops ?? []).map((s) => s.id as string);

      if (ids.length === 0) {
        setHasShop(false);
        setLoading(false);
        return;
      }

      setHasShop(true);

      const [itemResult, stockResult] = await Promise.all([
        supabase
          .from("order_items")
          .select("shoe_id,product_title,quantity,line_total,orders(status,created_at)")
          .in("shop_id", ids),
        supabase
          .from("shoes")
          .select("id,title,stock_quantity,is_available")
          .in("shop_id", ids)
          .order("stock_quantity", { ascending: true }),
      ]);

      if (!active) return;

      if (itemResult.error) {
        setError(itemResult.error.message);
        setLoading(false);
        return;
      }

      const sinceIso = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
      const [viewResult, chatResult] = await Promise.all([
        supabase
          .from("shoe_views")
          .select("id", { count: "exact", head: true })
          .in("shop_id", ids)
          .gte("created_at", sinceIso),
        supabase
          .from("chat_clicks")
          .select("id", { count: "exact", head: true })
          .in("shop_id", ids)
          .gte("created_at", sinceIso),
      ]);

      if (!active) return;

      setTraffic(
        viewResult.error || chatResult.error
          ? null
          : { views: viewResult.count ?? 0, chats: chatResult.count ?? 0 },
      );

      const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
      const rows = (itemResult.data ?? []) as unknown as ItemRow[];
      const orderIds = new Set<string>();
      const best = new Map<string, Best>();
      let revenue = 0;
      let units = 0;
      let pending = 0;
      let orderCount = 0;

      rows.forEach((row, index) => {
        const order = orderOf(row.orders);
        if (!order) return;
        if (new Date(order.created_at).getTime() < cutoff) return;
        if (order.status === "cancelled") return;

        orderCount += 1;
        void index;
        if (order.status === "pending") pending += 1;
        revenue += row.line_total;
        units += row.quantity;

        const entry = best.get(row.shoe_id) ?? { title: row.product_title, units: 0, revenue: 0 };
        entry.units += row.quantity;
        entry.revenue += row.line_total;
        best.set(row.shoe_id, entry);
        orderIds.add(row.shoe_id);
      });

      setStats({
        revenue,
        orders: orderCount,
        units,
        pending,
        best: Array.from(best.values()).sort((a, b) => b.units - a.units).slice(0, 5),
      });

      const stock = (stockResult.data ?? []) as StockRow[];
      setSoldOut(stock.filter((s) => s.stock_quantity <= 0));
      setLowStock(stock.filter((s) => s.stock_quantity > 0 && s.stock_quantity <= LOW_STOCK));
      setLoading(false);
    }

    void load();

    return () => {
      active = false;
    };
  }, [user, days]);

  if (!user) {
    return (
      <main className="page-shell">
        <div className="box">
          <h1>Sign in to see your insights</h1>
          <Link to="/login" className="btn gold">Sign in</Link>
        </div>
      </main>
    );
  }

  return (
    <main className="page-shell">
      <section className="buyer-welcome">
        <div>
          <div className="eyebrow">Seller</div>
          <h1>Shop insights</h1>
          <p className="muted">Sales and stock for your shop. Cancelled orders are not counted.</p>
        </div>
        <Link to="/seller" className="btn ghost">Back to dashboard</Link>
      </section>

      <div className="box">
        <label>
          Period{" "}
          <select className="input" value={days} onChange={(e) => setDays(Number(e.target.value))}>
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
          </select>
        </label>
      </div>

      {error && <div className="box"><p className="error">{error}</p></div>}
      {loading && <div className="box"><p className="muted">Loading insights...</p></div>}

      {!loading && !hasShop && (
        <div className="box">
          <p className="muted">Create your shop first to see insights.</p>
          <Link to="/seller" className="btn gold">Go to seller dashboard</Link>
        </div>
      )}

      {!loading && hasShop && stats && (
        <>
          <section className="box">
            <h2>Sales</h2>
            <div className="cart-summary-row"><span>Revenue</span><strong>{formatPrice(stats.revenue)}</strong></div>
            <div className="cart-summary-row"><span>Items ordered</span><strong>{stats.orders}</strong></div>
            <div className="cart-summary-row"><span>Units sold</span><strong>{stats.units}</strong></div>
            {traffic && (
              <>
                <div className="cart-summary-row"><span>Product views</span><strong>{traffic.views}</strong></div>
                <div className="cart-summary-row"><span>WhatsApp chat taps</span><strong>{traffic.chats}</strong></div>
                <div className="cart-summary-row"><span>Items ordered per 100 views</span><strong>{traffic.views > 0 ? ((stats.orders / traffic.views) * 100).toFixed(1) : "-"}</strong></div>
              </>
            )}
            <div className="cart-summary-row"><span>Waiting for you to confirm</span><strong>{stats.pending}</strong></div>
            {stats.pending > 0 && (
              <Link to="/seller/orders" className="btn small gold">Open shop orders</Link>
            )}
          </section>

          <section className="box">
            <h2>Best sellers</h2>
            {stats.best.length === 0 ? (
              <p className="muted">No sales in this period yet.</p>
            ) : (
              stats.best.map((b, i) => (
                <div className="cart-summary-row" key={b.title + i}>
                  <span>{i + 1}. {b.title}</span>
                  <span>{b.units} sold - {formatPrice(b.revenue)}</span>
                </div>
              ))
            )}
          </section>

          <section className="box">
            <h2>Stock warnings</h2>
            {soldOut.length === 0 && lowStock.length === 0 && (
              <p className="muted">All your products have enough stock.</p>
            )}
            {soldOut.map((s) => (
              <div className="cart-summary-row" key={s.id}>
                <span>{s.title}</span>
                <strong className="error">Sold out</strong>
              </div>
            ))}
            {lowStock.map((s) => (
              <div className="cart-summary-row" key={s.id}>
                <span>{s.title}</span>
                <strong>Only {s.stock_quantity} left</strong>
              </div>
            ))}
            <p className="muted small">
              Low stock means {LOW_STOCK} or fewer. Sizes and colors with their own stock are not
              included yet.
            </p>
          </section>
        </>
      )}
    </main>
  );
}