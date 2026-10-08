import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth-context";
import { useCart } from "../lib/cart-context";
import { formatPrice } from "../lib/format";

type Zone = {
  id: string;
  name: string;
  fee: number;
  eta: string;
};

const paymentOptions = [
  {
    value: "mtn_mobile_money",
    label: "MTN Mobile Money",
    helper: "You will be able to pay through MTN when the provider is connected.",
  },
  {
    value: "airtel_money",
    label: "Airtel Money",
    helper: "You will be able to pay through Airtel when the provider is connected.",
  },
  {
    value: "cash_on_delivery",
    label: "Cash on delivery",
    helper: "Pay when your FashionHub order arrives.",
  },
];

type Placed = {
  orderId: string;
  total: number;
  paymentMethod: string;
  paymentId?: string;
  sellers: { name: string; whatsapp: string }[];
};

function waLink(number: string, orderNo: string) {
  let digits = number.replace(/\D/g, "");

  if (digits.startsWith("0")) {
    digits = "256" + digits.slice(1);
  }

  const text = encodeURIComponent(
    `Hello, I just placed FashionHub order ${orderNo}.`,
  );

  return `https://wa.me/${digits}?text=${text}`;
}

function paymentLabel(method: string) {
  return (
    paymentOptions.find((option) => option.value === method)?.label ??
    method
  );
}

export default function CheckoutPage() {
  const { user } = useAuth();
  const { items, subtotal, refresh } = useCart();

  const [zones, setZones] = useState<Zone[]>([]);
  const [zoneId, setZoneId] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [area, setArea] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [promo, setPromo] = useState("");
  const [promoMsg, setPromoMsg] = useState("");
  const [discount, setDiscount] = useState(0);
  const [payment, setPayment] = useState("cash_on_delivery");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [placed, setPlaced] = useState<Placed | null>(null);

  useEffect(() => {
    let active = true;

    async function loadZones() {
      const { data, error: zoneError } = await supabase
        .from("delivery_zones")
        .select("id,name,fee,eta")
        .eq("is_active", true)
        .order("sort_order");

      if (!active) return;

      if (zoneError) {
        setError(zoneError.message);
        return;
      }

      const list = (data ?? []) as Zone[];

      setZones(list);
      setZoneId((current) => current || list[0]?.id || "");
    }

    void loadZones();

    return () => {
      active = false;
    };
  }, []);

  const zone = zones.find((z) => z.id === zoneId) ?? null;
  const fee = zone?.fee ?? 0;
  const total = Math.max(0, subtotal - discount + fee);

  async function applyPromo() {
    setPromoMsg("");
    setDiscount(0);

    if (!promo.trim()) return;

    const { data, error: promoError } = await supabase.rpc("check_promo", {
      p_code: promo.trim(),
    });

    if (promoError) {
      setPromoMsg(promoError.message);
      return;
    }

    const result = data as {
      discount: number;
      shop_name: string;
    };

    setDiscount(Number(result.discount) || 0);

    setPromoMsg(
      `Code applied: ${formatPrice(Number(result.discount) || 0)} off ${result.shop_name} items.`,
    );
  }

  async function createPendingPayment(
    orderId: string,
    orderTotal: number,
  ): Promise<string | undefined> {
    if (payment === "cash_on_delivery") {
      return undefined;
    }

    const method =
      payment === "mtn_mobile_money"
        ? "mobile_money"
        : payment === "airtel_money"
          ? "mobile_money"
          : payment;

    const provider =
      payment === "mtn_mobile_money"
        ? "mtn"
        : payment === "airtel_money"
          ? "airtel"
          : "internal";

    const { data, error: paymentError } = await supabase.rpc(
      "create_pending_payment",
      {
        p_order_id: orderId,
        p_method: method,
        p_amount: orderTotal,
        p_phone_number: phone.trim(),
      },
    );

    if (paymentError) {
      throw new Error(
        `Order was created, but the payment record could not be created: ${paymentError.message}`,
      );
    }

    void provider;

    return typeof data === "string"
      ? data
      : data && typeof data === "object" && "id" in data
        ? String((data as { id: string }).id)
        : undefined;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();

    if (submitting) return;

    setError("");

    if (!zone) {
      setError("Please choose a delivery zone.");
      return;
    }

    if (!name.trim() || !phone.trim() || !area.trim() || !address.trim()) {
      setError("Please complete all required delivery details.");
      return;
    }

    if (items.length === 0) {
      setError("Your cart is empty.");
      return;
    }

    const sellerMap = new Map<string, string>();

    for (const item of items) {
      const shop = item.shoe?.shops;

      if (shop?.name && shop.whatsapp) {
        sellerMap.set(shop.name, shop.whatsapp);
      }
    }

    setSubmitting(true);

    try {
      const { data, error: rpcError } = await supabase.rpc("place_order", {
        p_name: name.trim(),
        p_phone: phone.trim(),
        p_zone_id: zone.id,
        p_area: area.trim(),
        p_address: address.trim(),
        p_notes: notes.trim(),
        p_payment_method: payment,
        p_promo_code: promo.trim() || null,
      });

      if (rpcError) {
        throw new Error(rpcError.message);
      }

      const result = data as {
        order_id: string;
        total: number;
      };

      const orderTotal = Number(result.total);

      let paymentId: string | undefined;

      try {
        paymentId = await createPendingPayment(
          result.order_id,
          orderTotal,
        );
      } catch (paymentError) {
        throw paymentError;
      }

      setPlaced({
        orderId: result.order_id,
        total: orderTotal,
        paymentMethod: payment,
        paymentId,
        sellers: Array.from(
          sellerMap,
          ([sellerName, whatsapp]) => ({
            name: sellerName,
            whatsapp,
          }),
        ),
      });

      await refresh();
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Something went wrong while placing your order.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (!user) {
    return (
      <main className="page-shell">
        <section className="box checkout-auth-card">
          <div className="eyebrow">FashionHub checkout</div>
          <h1>Sign in to check out</h1>
          <p className="muted">
            Your cart is saved securely to your FashionHub account.
          </p>

          <div className="checkout-auth-actions">
            <Link to="/login" className="btn gold">
              Sign in
            </Link>

            <Link to="/cart" className="btn ghost">
              Back to cart
            </Link>
          </div>
        </section>
      </main>
    );
  }

  if (placed) {
    const orderNo = placed.orderId.slice(0, 8).toUpperCase();
    const mobilePayment = placed.paymentMethod !== "cash_on_delivery";

    return (
      <main className="page-shell">
        <section className="box checkout-success">
          <div className="checkout-success-icon">✓</div>

          <div className="eyebrow">Order placed</div>

          <h1>Thank you!</h1>

          <p className="checkout-order-number">
            Order <strong>#{orderNo}</strong>
          </p>

          <div className="checkout-success-total">
            {formatPrice(placed.total)}
          </div>

          <div className="checkout-status-card">
            <strong>{paymentLabel(placed.paymentMethod)}</strong>

            <p className="muted small">
              {mobilePayment
                ? "Your order is saved and your payment is currently pending. The real mobile-money provider connection will be added later."
                : "Your order is saved. Pay in cash when your order arrives."}
            </p>
          </div>

          {placed.paymentId && (
            <p className="muted small">
              Payment reference created successfully.
            </p>
          )}

          <p className="muted small">
            Buyer protection: if something is wrong, report it within 7 days
            of delivery under Disputes.
          </p>

          <div className="checkout-seller-actions">
            {placed.sellers.map((seller) => (
              <a
                key={seller.name}
                className="btn ghost"
                href={waLink(seller.whatsapp, orderNo)}
                target="_blank"
                rel="noreferrer"
              >
                Message {seller.name} on WhatsApp
              </a>
            ))}
          </div>

          <div className="checkout-success-actions">
            <Link to="/orders" className="btn ghost">
              View my orders
            </Link>

            <Link to="/" className="btn gold">
              Keep shopping
            </Link>
          </div>
        </section>
      </main>
    );
  }

  if (items.length === 0) {
    return (
      <main className="page-shell">
        <section className="box checkout-empty">
          <div className="eyebrow">FashionHub checkout</div>
          <h1>Your cart is empty</h1>
          <p className="muted">
            Add something you love before continuing to checkout.
          </p>

          <Link to="/" className="btn gold">
            Browse fashion
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="page-shell checkout-page">
      <section className="buyer-welcome checkout-header">
        <div>
          <div className="eyebrow">FashionHub checkout</div>
          <h1>Delivery and payment</h1>
          <p className="muted">
            Complete your details and choose how you want to pay.
          </p>
        </div>

        <Link to="/cart" className="btn ghost">
          Back to cart
        </Link>
      </section>

      <form
        className="checkout-layout"
        onSubmit={(e) => void handleSubmit(e)}
      >
        <section className="checkout-main">
          <div className="box checkout-section">
            <div className="checkout-section-heading">
              <span className="checkout-step">1</span>

              <div>
                <div className="eyebrow">Delivery</div>
                <h2>Where should we deliver?</h2>
              </div>
            </div>

            <div className="checkout-grid">
              <label>
                <span>Full name</span>
                <input
                  className="input"
                  placeholder="Your full name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoComplete="name"
                  required
                />
              </label>

              <label>
                <span>Phone number</span>
                <input
                  className="input"
                  placeholder="07XXXXXXXX"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  autoComplete="tel"
                  inputMode="tel"
                  required
                />
              </label>
            </div>

            <label>
              <span>Delivery zone</span>

              <select
                className="input"
                value={zoneId}
                onChange={(e) => setZoneId(e.target.value)}
                required
              >
                {zones.length === 0 && (
                  <option value="">Loading delivery zones...</option>
                )}

                {zones.map((z) => (
                  <option key={z.id} value={z.id}>
                    {z.name} — {formatPrice(z.fee)}
                  </option>
                ))}
              </select>
            </label>

            {zone && (
              <div className="checkout-delivery-note">
                <strong>Estimated delivery:</strong> {zone.eta}
              </div>
            )}

            <div className="checkout-grid">
              <label>
                <span>Area</span>
                <input
                  className="input"
                  placeholder="e.g. Wandegeya"
                  value={area}
                  onChange={(e) => setArea(e.target.value)}
                  required
                />
              </label>

              <label>
                <span>Address or landmark</span>
                <input
                  className="input"
                  placeholder="Street, building or landmark"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  required
                />
              </label>
            </div>

            <label>
              <span>Notes for the seller</span>
              <textarea
                className="input checkout-textarea"
                placeholder="Optional delivery instructions"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
              />
            </label>
          </div>

          <div className="box checkout-section">
            <div className="checkout-section-heading">
              <span className="checkout-step">2</span>

              <div>
                <div className="eyebrow">Savings</div>
                <h2>Promo code</h2>
              </div>
            </div>

            <div className="checkout-promo">
              <input
                className="input"
                placeholder="Enter promo code"
                value={promo}
                onChange={(e) => {
                  setPromo(e.target.value);
                  setDiscount(0);
                  setPromoMsg("");
                }}
              />

              <button
                type="button"
                className="btn ghost"
                onClick={() => void applyPromo()}
              >
                Apply
              </button>
            </div>

            {promoMsg && (
              <div className="checkout-promo-message">
                {promoMsg}
              </div>
            )}
          </div>

          <div className="box checkout-section">
            <div className="checkout-section-heading">
              <span className="checkout-step">3</span>

              <div>
                <div className="eyebrow">Payment</div>
                <h2>Choose how to pay</h2>
              </div>
            </div>

            <div className="payment-options">
              {paymentOptions.map((option) => (
                <label
                  key={option.value}
                  className={`payment-option ${
                    payment === option.value ? "selected" : ""
                  }`}
                >
                  <input
                    type="radio"
                    name="payment"
                    value={option.value}
                    checked={payment === option.value}
                    onChange={() => setPayment(option.value)}
                  />

                  <span className="payment-option-content">
                    <strong>{option.label}</strong>
                    <small>{option.helper}</small>
                  </span>

                  <span className="payment-option-check">✓</span>
                </label>
              ))}
            </div>

            {payment !== "cash_on_delivery" && (
              <div className="payment-pending-note">
                <strong>Payment setup</strong>
                <p>
                  FashionHub will create a secure pending payment record for
                  this order. No money is charged yet because the MTN and
                  Airtel provider connections have not been activated.
                </p>
              </div>
            )}
          </div>
        </section>

        <aside className="box checkout-summary">
          <div className="eyebrow">Order summary</div>
          <h2>Your order</h2>

          <div className="checkout-summary-items">
            {items.map((item) => (
              <div className="checkout-summary-item" key={item.id}>
                <div>
                  <strong>{item.shoe?.title ?? "Fashion item"}</strong>

                  <span className="muted small">
                    Qty {item.quantity}
                    {item.size ? ` · Size ${item.size}` : ""}
                    {item.color ? ` · ${item.color}` : ""}
                  </span>
                </div>

                <strong>
                  {formatPrice(item.unit_price * item.quantity)}
                </strong>
              </div>
            ))}
          </div>

          <div className="cart-summary-row">
            <span>Subtotal</span>
            <strong>{formatPrice(subtotal)}</strong>
          </div>

          <div className="cart-summary-row">
            <span>Delivery</span>
            <strong>
              {zone ? formatPrice(fee) : "Choose a zone"}
            </strong>
          </div>

          {discount > 0 && (
            <div className="cart-summary-row checkout-discount">
              <span>Promo discount</span>
              <strong>-{formatPrice(discount)}</strong>
            </div>
          )}

          <div className="cart-total">
            <span>Total</span>
            <strong>{formatPrice(total)}</strong>
          </div>

          {error && (
            <div className="checkout-error">
              {error}
            </div>
          )}

          <button
            className="btn gold full-width checkout-submit"
            type="submit"
            disabled={submitting || !zone}
          >
            {submitting ? "Creating your order..." : "Place order"}
          </button>

          <div className="checkout-trust">
            <span>✓</span>
            <div>
              <strong>Secure checkout</strong>
              <p>
                Your order and payment status are handled through protected
                Supabase functions.
              </p>
            </div>
          </div>

          <p className="muted small checkout-final-note">
            Final prices and stock are checked again when your order is placed.
          </p>
        </aside>
      </form>
    </main>
  );
}
