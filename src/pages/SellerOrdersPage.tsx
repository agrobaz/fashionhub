import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth-context";
import { formatPrice } from "../lib/format";

type OrderInfo = {
  id: string;
  status: string;
  total: number;
  payment_method: string;
  payment_status: string;
  delivery_name: string;
  delivery_phone: string;
  delivery_area: string;
  delivery_address: string;
  delivery_notes: string | null;
  created_at: string;
};

type Row = {
  id: string;
  order_id: string;
  product_title: string;
  size: string | null;
  color: string | null;
  quantity: number;
  line_total: number;
  orders: OrderInfo | OrderInfo[] | null;
};

const NEXT: Record<string, [string, string]> = {
  pending: ["confirmed", "Confirm order"],
  confirmed: ["packed", "Mark packed"],
  packed: ["out_for_delivery", "Out for delivery"],
  out_for_delivery: ["delivered", "Mark delivered"],
};

const methodLabel: Record<string, string> = {
  mtn_mobile_money: "MTN Mobile Money",
  airtel_money: "Airtel Money",
  cash_on_delivery: "Cash on delivery",
};

function pickOrder(value: Row["orders"]): OrderInfo | null {
  return Array.isArray(value) ? value[0] ?? null : value;
}

export default function SellerOrdersPage() {
  const { user } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let active = true;

    async function load() {
      if (!user) {
        setLoading(false);
        return;
      }

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
        setRows([]);
        setLoading(false);
        return;
      }

      const { data, error: loadError } = await supabase
        .from("order_items")
        .select(
          "id,order_id,product_title,size,color,quantity,line_total,orders(id,status,total,payment_method,payment_status,delivery_name,delivery_phone,delivery_area,delivery_address,delivery_notes,created_at)",
        )
        .in("shop_id", ids)
        .order("created_at", { ascending: false });

      if (!active) return;

      if (loadError) setError(loadError.message);
      else setRows((data ?? []) as unknown as Row[]);
      setLoading(false);
    }

    void load();

    return () => {
      active = false;
    };
  }, [user, tick]);

  const orders = useMemo(() => {
    const map = new Map<string, { order: OrderInfo; items: Row[] }>();
    for (const row of rows) {
      const order = pickOrder(row.orders);
      if (!order) continue;
      const group = map.get(order.id);
      if (group) group.items.push(row);
      else map.set(order.id, { order, items: [row] });
    }
    return Array.from(map.values()).sort((a, b) =>
      b.order.created_at.localeCompare(a.order.created_at),
    );
  }, [rows]);

  async function act(
    orderId: string,
    args: { p_status?: string; p_payment_status?: string },
  ) {
    setBusy(orderId);
    setError("");
    const { error: rpcError } = await supabase.rpc("seller_update_order", {
      p_order_id: orderId,
      ...args,
    });
    if (rpcError) setError(rpcError.message);
    setBusy("");
    setTick((t) => t + 1);
  }

  if (!user) {
    return (
      <main className="page-shell">
        <div className="box">
          <h1>Sign in to see your shop orders</h1>
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
          <h1>Shop orders</h1>
        </div>
        <Link to="/seller" className="btn ghost">Back to dashboard</Link>
      </section>

      {error && <div className="box"><p className="error">{error}</p></div>}
      {loading && <div className="box"><p className="muted">Loading orders...</p></div>}
      {!loading && orders.length === 0 && (
        <div className="box"><p className="muted">No orders for your shop yet.</p></div>
      )}

      {orders.map(({ order, items }) => {
        const next = NEXT[order.status];
        const closed = order.status === "delivered" || order.status === "cancelled";
        const disabled = busy === order.id;

        return (
          <article className="box" key={order.id}>
            <div className="cart-summary-row">
              <strong>Order {order.id.slice(0, 8).toUpperCase()}</strong>
              <strong>{order.status.replace(/_/g, " ").toUpperCase()}</strong>
            </div>
            <p className="muted small">
              {new Date(order.created_at).toLocaleDateString("en-UG")} ·{" "}
              {methodLabel[order.payment_method] ?? order.payment_method} ·{" "}
              {order.payment_status === "paid" ? "Paid" : "Not paid yet"}
            </p>
            <p>
              <strong>{order.delivery_name}</strong> ·{" "}
              <a href={`tel:${order.delivery_phone}`}>{order.delivery_phone}</a>
              <br />
              {order.delivery_area}, {order.delivery_address}
              {order.delivery_notes ? <><br /><em>{order.delivery_notes}</em></> : null}
            </p>
            {items.map((item) => (
              <div className="cart-summary-row" key={item.id}>
                <span>
                  {item.product_title} × {item.quantity}
                  {item.size ? ` · Size ${item.size}` : ""}
                  {item.color ? ` · ${item.color}` : ""}
                </span>
                <span>{formatPrice(item.line_total)}</span>
              </div>
            ))}

            {!closed && (
              <div className="cart-controls">
                {next && (
                  <button className="btn small gold" disabled={disabled}
                    onClick={() => void act(order.id, { p_status: next[0] })}>
                    {next[1]}
                  </button>
                )}
                {order.payment_status !== "paid" && (
                  <button className="btn small ghost" disabled={disabled}
                    onClick={() => void act(order.id, { p_payment_status: "paid" })}>
                    Payment received
                  </button>
                )}
                {order.status !== "out_for_delivery" && (
                  <button className="btn small ghost" disabled={disabled}
                    onClick={() => {
                      if (window.confirm("Cancel this order?")) {
                        void act(order.id, { p_status: "cancelled" });
                      }
                    }}>
                    Cancel order
                  </button>
                )}
              </div>
            )}
          </article>
        );
      })}
    </main>
  );
}