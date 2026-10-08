import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth-context";
import { formatPrice } from "../lib/format";

type Item = {
  id: string;
  product_title: string;
  size: string | null;
  color: string | null;
  quantity: number;
  line_total: number;
};

type Order = {
  id: string;
  status: string;
  total: number;
  payment_method: string;
  payment_status: string;
  created_at: string;
  order_items: Item[];
};

const STEPS = ["pending", "confirmed", "packed", "out_for_delivery", "delivered"];

const methodLabel: Record<string, string> = {
  mtn_mobile_money: "MTN Mobile Money",
  airtel_money: "Airtel Money",
  cash_on_delivery: "Cash on delivery",
};

function label(value: string) {
  const text = value.replace(/_/g, " "); return text.charAt(0).toUpperCase() + text.slice(1);
}

function Progress({ status }: { status: string }) {
  if (status === "cancelled") return <p className="error">Cancelled</p>;
  const at = STEPS.indexOf(status);
  return (
    <p className="muted small">
      {STEPS.map((step, i) => (
        <span
          key={step}
          style={{ fontWeight: i === at ? 700 : 400, opacity: i <= at ? 1 : 0.45 }}
        >
          {i > 0 ? " → " : ""}
          {label(step)}
        </span>
      ))}
    </p>
  );
}

export default function OrdersPage() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let active = true;

    async function load() {
      if (!user) {
        setLoading(false);
        return;
      }

      const { data, error: loadError } = await supabase
        .from("orders")
        .select(
          "id,status,total,payment_method,payment_status,created_at,order_items(id,product_title,size,color,quantity,line_total)",
        )
        .eq("buyer_id", user.id)
        .order("created_at", { ascending: false });

      if (!active) return;

      if (loadError) setError(loadError.message);
      else setOrders((data ?? []) as unknown as Order[]);
      setLoading(false);
    }

    void load();

    return () => {
      active = false;
    };
  }, [user, tick]);

  async function cancel(orderId: string) {
    if (!window.confirm("Cancel this order?")) return;
    setError("");
    const { error: rpcError } = await supabase.rpc("buyer_cancel_order", {
      p_order_id: orderId,
    });
    if (rpcError) setError(rpcError.message);
    setTick((t) => t + 1);
  }

  if (!user) {
    return (
      <main className="page-shell">
        <div className="box">
          <h1>Sign in to see your orders</h1>
          <Link to="/login" className="btn gold">Sign in</Link>
        </div>
      </main>
    );
  }

  return (
    <main className="page-shell">
      <section className="buyer-welcome">
        <div>
          <div className="eyebrow">FashionHub orders</div>
          <h1>My orders</h1>
        </div>
        <Link to="/" className="btn ghost">Continue shopping</Link>
      </section>

      {error && <div className="box"><p className="error">{error}</p></div>}
      {loading && <div className="box"><p className="muted">Loading your orders...</p></div>}

      {!loading && orders.length === 0 && (
        <section className="empty-market">
          <h2>No orders yet</h2>
          <p className="muted">When you place an order it will show up here.</p>
          <Link to="/" className="btn gold">Browse fashion</Link>
        </section>
      )}

      {orders.map((order) => (
        <article className="box" key={order.id}>
          <div className="cart-summary-row">
            <strong>Order {order.id.slice(0, 8).toUpperCase()}</strong>
            <strong>{formatPrice(order.total)}</strong>
          </div>
          <p className="muted small">
            {new Date(order.created_at).toLocaleDateString("en-UG")} ·{" "}
            {methodLabel[order.payment_method] ?? order.payment_method} ·{" "}
            {order.payment_status === "paid" ? "Paid" : "Payment pending"}
          </p>
          <Progress status={order.status} />
          {order.order_items.map((item) => (
            <div className="cart-summary-row" key={item.id}>
              <span>
                {item.product_title} × {item.quantity}
                {item.size ? ` · Size ${item.size}` : ""}
                {item.color ? ` · ${item.color}` : ""}
              </span>
              <span>{formatPrice(item.line_total)}</span>
            </div>
          ))}
          {order.status === "pending" && (
            <button className="btn small ghost" onClick={() => void cancel(order.id)}>
              Cancel order
            </button>
          )}
        </article>
      ))}
    </main>
  );
}