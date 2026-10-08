import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth-context";

type Shop = {
  id: string;
  name: string;
  status: "pending" | "active" | "suspended";
  paid_until: string | null;
};

type Payment = {
  id: string;
  amount: number;
  currency: string;
  payment_method: string;
  payment_number: string;
  transaction_ref: string;
  status: "pending" | "approved" | "rejected";
  months: number;
  created_at: string;
};

const PAYMENT_NUMBER = "0773927881";
const MONTHLY_PRICE = 10000;

function formatDate(value: string | null) {
  if (!value) return "Not active";
  return new Date(value + "T00:00:00").toLocaleDateString("en-UG", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-UG").format(value);
}

export default function SubscriptionPage() {
  const { user } = useAuth();

  const [shop, setShop] = useState<Shop | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [transactionRef, setTransactionRef] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function load() {
    if (!user) return;

    setLoading(true);
    setError("");

    const { data: shopData, error: shopError } = await supabase
      .from("shops")
      .select("id,name,status,paid_until")
      .eq("owner_id", user.id)
      .maybeSingle();

    if (shopError) {
      setError(shopError.message);
      setLoading(false);
      return;
    }

    setShop(shopData);

    if (shopData) {
      const { data: paymentData, error: paymentError } = await supabase
        .from("subscription_payments")
        .select(
          "id,amount,currency,payment_method,payment_number,transaction_ref,status,months,created_at",
        )
        .eq("shop_id", shopData.id)
        .order("created_at", { ascending: false });

      if (paymentError) {
        setError(paymentError.message);
      } else {
        setPayments(paymentData ?? []);
      }
    }

    setLoading(false);
  }

  useEffect(() => {
    void load();
    // load intentionally uses the current authenticated user.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  async function submitPayment() {
    if (!user || !shop) return;

    const ref = transactionRef.trim();

    if (!ref) {
      setError("Enter your MTN transaction reference.");
      return;
    }

    setSubmitting(true);
    setError("");
    setMessage("");

    const { error: insertError } = await supabase
      .from("subscription_payments")
      .insert({
        shop_id: shop.id,
        seller_id: user.id,
        amount: MONTHLY_PRICE,
        currency: "UGX",
        payment_method: "MTN Mobile Money",
        payment_number: PAYMENT_NUMBER,
        transaction_ref: ref,
        months: 1,
      });

    if (insertError) {
      setError(insertError.message);
      setSubmitting(false);
      return;
    }

    setTransactionRef("");
    setMessage(
      "Payment submitted. Your subscription will be activated after payment verification.",
    );
    setSubmitting(false);

    await load();
  }

  if (loading) {
    return <p className="muted pad">Loading subscription...</p>;
  }

  if (!shop) {
    return (
      <section className="empty-state">
        <h2>Create your shop first</h2>
        <p className="muted">
          You need a seller shop before you can manage a subscription.
        </p>
        <Link className="btn" to="/seller">
          Go to seller dashboard
        </Link>
      </section>
    );
  }

  return (
    <div className="subscription-page">
      <section className="subscription-hero">
        <div>
          <span className="eyebrow">Seller subscription</span>
          <h1>Keep {shop.name} live.</h1>
          <p>
            Your first two months are free. After that, keep your storefront
            active for UGX 10,000 per month.
          </p>
        </div>

        <div className="subscription-status">
          <span className="muted">Shop status</span>
          <strong>{shop.status}</strong>
          <small>
            Active until: <b>{formatDate(shop.paid_until)}</b>
          </small>
        </div>
      </section>

      <div className="subscription-grid">
        <section className="subscription-card">
          <span className="eyebrow">Monthly plan</span>
          <div className="subscription-price">
            <strong>UGX {formatMoney(MONTHLY_PRICE)}</strong>
            <span>/ month</span>
          </div>

          <ul className="subscription-features">
            <li>&#10003; Keep your shop active</li>
            <li>&#10003; Continue listing fashion items</li>
            <li>&#10003; Keep your storefront visible</li>
            <li>&#10003; Continue receiving buyer enquiries</li>
          </ul>

          <div className="free-trial-note">
            <strong>First 2 months free</strong>
            <span>Every new seller gets the free period automatically.</span>
          </div>
        </section>

        <section className="subscription-card payment-card">
          <span className="eyebrow">Pay with MTN Mobile Money</span>
          <h2>Send UGX 10,000</h2>

          <div className="payment-number">
            <span>Send payment to</span>
            <strong>{PAYMENT_NUMBER}</strong>
            <small>MTN Mobile Money</small>
          </div>

          <p className="muted">
            After sending the money, enter the transaction reference below.
          </p>

          <label>
            MTN transaction reference
            <input
              value={transactionRef}
              onChange={(event) => setTransactionRef(event.target.value)}
              placeholder="Enter transaction reference"
              maxLength={100}
            />
          </label>

          {error && <div className="form-error">{error}</div>}
          {message && <div className="form-success">{message}</div>}

          <button
            className="btn wide"
            onClick={() => void submitPayment()}
            disabled={submitting}
          >
            {submitting ? "Submitting..." : "Submit payment"}
          </button>

          <small className="muted">
            Your shop is activated after the payment is verified by FashionHub.
          </small>
        </section>
      </div>

      <section className="subscription-card payment-history">
        <div className="section-heading">
          <div>
            <span className="eyebrow">History</span>
            <h2>Your subscription payments</h2>
          </div>
          <Link className="btn small ghost" to="/seller">
            Seller dashboard
          </Link>
        </div>

        {payments.length === 0 ? (
          <p className="muted">No subscription payments yet.</p>
        ) : (
          <div className="payment-list">
            {payments.map((payment) => (
              <div className="payment-row" key={payment.id}>
                <div>
                  <strong>UGX {formatMoney(payment.amount)}</strong>
                  <span>
                    {new Date(payment.created_at).toLocaleDateString("en-UG")}
                  </span>
                </div>

                <div>
                  <span>Ref: {payment.transaction_ref}</span>
                  <span>{payment.months} month</span>
                </div>

                <span className={"payment-status " + payment.status}>
                  {payment.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}


