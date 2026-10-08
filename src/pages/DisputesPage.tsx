import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth-context";
import { formatPrice } from "../lib/format";

type Msg = { id: string; sender_role: string; message: string; created_at: string };
type ItemInfo = { product_title: string; quantity: number; line_total: number };
type Dispute = {
  id: string;
  order_item_id: string;
  buyer_id: string;
  seller_id: string;
  reason: string;
  details: string;
  status: string;
  resolution: string | null;
  created_at: string;
  order_items: ItemInfo | ItemInfo[] | null;
  dispute_messages: Msg[];
};
type Eligible = { id: string; product_title: string; quantity: number; line_total: number };

const REASONS: Record<string, string> = {
  not_as_described: "Item not as described",
  wrong_item: "Wrong item received",
  damaged: "Item arrived damaged",
  not_received: "Item not received",
  other: "Other problem",
};

const OPEN = ["open", "seller_responded", "escalated"];

const STATUS_LABEL: Record<string, string> = {
  open: "Open",
  seller_responded: "Seller responded",
  escalated: "With FashionHub",
  resolved: "Resolved",
  rejected: "Rejected",
  closed: "Withdrawn",
};

function itemOf(value: Dispute["order_items"]): ItemInfo | null {
  return Array.isArray(value) ? value[0] ?? null : value;
}

export default function DisputesPage() {
  const { user } = useAuth();
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [eligible, setEligible] = useState<Eligible[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [tick, setTick] = useState(0);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [itemId, setItemId] = useState("");
  const [reason, setReason] = useState("not_as_described");
  const [details, setDetails] = useState("");

  useEffect(() => {
    let active = true;

    async function load() {
      if (!user) {
        setLoading(false);
        return;
      }

      const [disputeResult, itemResult] = await Promise.all([
        supabase
          .from("disputes")
          .select(
            "id,order_item_id,buyer_id,seller_id,reason,details,status,resolution,created_at,order_items(product_title,quantity,line_total),dispute_messages(id,sender_role,message,created_at)",
          )
          .order("created_at", { ascending: false }),
        supabase
          .from("order_items")
          .select("id,product_title,quantity,line_total,orders!inner(status,buyer_id)")
          .eq("orders.buyer_id", user.id)
          .in("orders.status", ["delivered", "out_for_delivery"]),
      ]);

      if (!active) return;

      if (disputeResult.error) setError(disputeResult.error.message);
      else setDisputes((disputeResult.data ?? []) as unknown as Dispute[]);

      if (!itemResult.error) setEligible((itemResult.data ?? []) as unknown as Eligible[]);
      setLoading(false);
    }

    void load();

    return () => {
      active = false;
    };
  }, [user, tick]);

  async function run(key: string, fn: () => PromiseLike<{ error: { message: string } | null }>) {
    setBusy(key);
    setError("");
    const { error: rpcError } = await fn();
    if (rpcError) setError(rpcError.message);
    setBusy("");
    setTick((t) => t + 1);
  }

  async function openDispute() {
    if (!itemId) {
      setError("Choose the item you have a problem with.");
      return;
    }
    await run("new", () =>
      supabase.rpc("open_dispute", {
        p_order_item_id: itemId,
        p_reason: reason,
        p_details: details,
      }),
    );
    setDetails("");
    setItemId("");
  }

  function reply(id: string) {
    const text = (drafts[id] ?? "").trim();
    if (!text) return;
    void run(id, () => supabase.rpc("dispute_reply", { p_dispute_id: id, p_message: text }));
    setDrafts((d) => ({ ...d, [id]: "" }));
  }

  function setStatus(id: string, status: string, ask?: string) {
    let resolution: string | null = null;
    if (ask) {
      resolution = window.prompt(ask);
      if (!resolution) return;
    } else if (!window.confirm("Are you sure?")) {
      return;
    }
    void run(id, () =>
      supabase.rpc("dispute_set_status", {
        p_dispute_id: id,
        p_status: status,
        p_resolution: resolution,
      }),
    );
  }

  if (!user) {
    return (
      <main className="page-shell">
        <div className="box">
          <h1>Sign in to see your disputes</h1>
          <Link to="/login" className="btn gold">Sign in</Link>
        </div>
      </main>
    );
  }

  const openItemIds = new Set(
    disputes.filter((d) => OPEN.includes(d.status)).map((d) => d.order_item_id),
  );
  const choices = eligible.filter((e) => !openItemIds.has(e.id));

  return (
    <main className="page-shell">
      <section className="buyer-welcome">
        <div>
          <div className="eyebrow">FashionHub buyer protection</div>
          <h1>Disputes</h1>
          <p className="muted">
            If your order is not as described, arrives damaged, is the wrong item or never
            arrives, tell us here. You can report a problem for 7 days after delivery. The
            seller replies first, and you can ask FashionHub to step in at any time.
          </p>
        </div>
        <Link to="/orders" className="btn ghost">My orders</Link>
      </section>

      {error && <div className="box"><p className="error">{error}</p></div>}

      <section className="box">
        <h2>Report a problem</h2>
        {choices.length === 0 ? (
          <p className="muted">
            Items from delivered orders appear here. You have nothing to report right now.
          </p>
        ) : (
          <>
            <select className="input" value={itemId} onChange={(e) => setItemId(e.target.value)}>
              <option value="">Choose the item</option>
              {choices.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.product_title} x {c.quantity} ({formatPrice(c.line_total)})
                </option>
              ))}
            </select>
            <select className="input" value={reason} onChange={(e) => setReason(e.target.value)}>
              {Object.entries(REASONS).map(([value, text]) => (
                <option key={value} value={value}>{text}</option>
              ))}
            </select>
            <textarea
              className="input"
              rows={4}
              placeholder="Describe what went wrong"
              value={details}
              onChange={(e) => setDetails(e.target.value)}
            />
            <button className="btn gold" disabled={busy === "new"} onClick={() => void openDispute()}>
              {busy === "new" ? "Sending..." : "Send report"}
            </button>
          </>
        )}
      </section>

      {loading && <div className="box"><p className="muted">Loading disputes...</p></div>}
      {!loading && disputes.length === 0 && (
        <div className="box"><p className="muted">No disputes yet. That is a good thing.</p></div>
      )}

      {disputes.map((d) => {
        const role = d.buyer_id === user.id ? "buyer" : d.seller_id === user.id ? "seller" : "admin";
        const item = itemOf(d.order_items);
        const isOpen = OPEN.includes(d.status);
        const messages = [...(d.dispute_messages ?? [])].sort((a, b) =>
          a.created_at.localeCompare(b.created_at),
        );

        return (
          <article className="box" key={d.id}>
            <div className="cart-summary-row">
              <strong>{item?.product_title ?? "Item"}</strong>
              <strong>{STATUS_LABEL[d.status] ?? d.status}</strong>
            </div>
            <p className="muted small">
              {REASONS[d.reason] ?? d.reason} - opened {new Date(d.created_at).toLocaleDateString("en-UG")}
              {role === "seller" ? " - you are the seller" : role === "admin" ? " - admin view" : ""}
            </p>

            {messages.map((m) => (
              <p key={m.id}>
                <strong>{m.sender_role === "admin" ? "FashionHub" : m.sender_role === "seller" ? "Seller" : "Buyer"}:</strong>{" "}
                {m.message}
              </p>
            ))}

            {isOpen && (
              <>
                <textarea
                  className="input"
                  rows={2}
                  placeholder="Write a message"
                  value={drafts[d.id] ?? ""}
                  onChange={(e) => setDrafts((x) => ({ ...x, [d.id]: e.target.value }))}
                />
                <div className="cart-controls">
                  <button className="btn small gold" disabled={busy === d.id} onClick={() => reply(d.id)}>
                    Send message
                  </button>

                  {role === "buyer" && d.status !== "escalated" && (
                    <button className="btn small ghost" disabled={busy === d.id}
                      onClick={() => setStatus(d.id, "escalated")}>
                      Ask FashionHub to step in
                    </button>
                  )}
                  {role === "buyer" && (
                    <button className="btn small ghost" disabled={busy === d.id}
                      onClick={() => setStatus(d.id, "closed")}>
                      Withdraw
                    </button>
                  )}
                  {role === "seller" && d.status !== "escalated" && (
                    <button className="btn small ghost" disabled={busy === d.id}
                      onClick={() => setStatus(d.id, "resolved", "How did you resolve this? (refund, replacement, etc.)")}>
                      Mark resolved
                    </button>
                  )}
                  {role === "admin" && (
                    <>
                      <button className="btn small ghost" disabled={busy === d.id}
                        onClick={() => setStatus(d.id, "resolved", "Decision in the buyer's favour. Add a note:")}>
                        Resolve for buyer
                      </button>
                      <button className="btn small ghost" disabled={busy === d.id}
                        onClick={() => setStatus(d.id, "rejected", "Decision in the seller's favour. Add a note:")}>
                        Reject dispute
                      </button>
                    </>
                  )}
                </div>
              </>
            )}
          </article>
        );
      })}
    </main>
  );
}