import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

type SubscriptionPayment = {
  id: string;
  shop_id: string;
  seller_id: string;
  amount: number;
  currency: string;
  payment_method: string;
  payment_number: string;
  transaction_ref: string;
  status: "pending" | "approved" | "rejected";
  months: number;
  created_at: string;
  shops?: {
    name: string;
  } | null;
};

export default function AdminSubscriptionPayments() {
  const [payments, setPayments] = useState<SubscriptionPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function loadPayments() {
    setLoading(true);
    setError("");

    const { data, error: loadError } = await supabase
      .from("subscription_payments")
      .select(
        "id,shop_id,seller_id,amount,currency,payment_method,payment_number,transaction_ref,status,months,created_at,shops(name)",
      )
      .order("created_at", { ascending: false });

    if (loadError) {
      setError(loadError.message);
    } else {
      setPayments((data as unknown as SubscriptionPayment[]) ?? []);
    }

    setLoading(false);
  }

  useEffect(() => {
    void loadPayments();
  }, []);

  async function approve(id: string) {
    setBusy(id);
    setError("");

    const { error: rpcError } = await supabase.rpc(
      "admin_approve_subscription",
      { p_payment_id: id },
    );

    if (rpcError) {
      setError(rpcError.message);
    } else {
      await loadPayments();
    }

    setBusy(null);
  }

  async function reject(id: string) {
    setBusy(id);
    setError("");

    const { error: rpcError } = await supabase.rpc(
      "admin_reject_subscription",
      { p_payment_id: id },
    );

    if (rpcError) {
      setError(rpcError.message);
    } else {
      await loadPayments();
    }

    setBusy(null);
  }

  if (loading) {
    return (
      <section className="admin-panel">
        <div className="admin-panel-heading">
          <div>
            <span className="eyebrow">Subscriptions</span>
            <h2>Payment submissions</h2>
          </div>
        </div>
        <p className="muted">Loading payments...</p>
      </section>
    );
  }

  const pending = payments.filter((payment) => payment.status === "pending");

  return (
    <section className="admin-panel subscription-admin-panel">
      <div className="admin-panel-heading">
        <div>
          <span className="eyebrow">Subscriptions</span>
          <h2>Payment submissions</h2>
          <p className="muted">
            {pending.length} payment{pending.length === 1 ? "" : "s"} waiting
            for review.
          </p>
        </div>

        <button
          className="btn small ghost"
          onClick={() => void loadPayments()}
        >
          Refresh
        </button>
      </div>

      {error && <div className="form-error">{error}</div>}

      {payments.length === 0 ? (
        <div className="admin-empty">
          <strong>No subscription payments yet.</strong>
          <span className="muted">
            Seller payment submissions will appear here.
          </span>
        </div>
      ) : (
        <div className="subscription-admin-list">
          {payments.map((payment) => (
            <article className="subscription-admin-row" key={payment.id}>
              <div className="subscription-admin-main">
                <div className="subscription-admin-title">
                  <strong>{payment.shops?.name ?? "Unknown shop"}</strong>
                  <span className={"payment-status " + payment.status}>
                    {payment.status}
                  </span>
                </div>

                <div className="subscription-admin-details">
                  <span>
                    <b>Amount:</b> UGX{" "}
                    {new Intl.NumberFormat("en-UG").format(payment.amount)}
                  </span>
                  <span>
                    <b>Network:</b> MTN Mobile Money
                  </span>
                  <span>
                    <b>Number:</b> {payment.payment_number}
                  </span>
                  <span>
                    <b>Reference:</b> {payment.transaction_ref}
                  </span>
                  <span>
                    <b>Duration:</b> {payment.months} month
                  </span>
                  <span>
                    <b>Submitted:</b>{" "}
                    {new Date(payment.created_at).toLocaleString("en-UG")}
                  </span>
                </div>
              </div>

              {payment.status === "pending" && (
                <div className="subscription-admin-actions">
                  <button
                    className="btn small"
                    disabled={busy === payment.id}
                    onClick={() => void approve(payment.id)}
                  >
                    {busy === payment.id ? "Working..." : "Approve"}
                  </button>

                  <button
                    className="btn small danger"
                    disabled={busy === payment.id}
                    onClick={() => void reject(payment.id)}
                  >
                    Reject
                  </button>
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

