import { useState } from "react";
import type { FormEvent } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth-context";
import type { Shop } from "../lib/types";
import { errorMessage } from "../lib/format";

type Props = {
  shop: Shop | null;
  onSaved: () => void;
  onCancel?: () => void;
};

export default function ShopForm({ shop, onSaved, onCancel }: Props) {
  const { user } = useAuth();

  const [name, setName] = useState(shop?.name ?? "");
  const [whatsapp, setWhatsapp] = useState(shop?.whatsapp ?? "");
  const [area, setArea] = useState(shop?.area ?? "");
  const [paymentRef, setPaymentRef] = useState(shop?.payment_ref ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!user) {
      setError("Please log in first.");
      return;
    }

    setBusy(true);
    setError("");

    try {
      const digits = whatsapp.replace(/\D/g, "");

      if (digits.length < 9) {
        throw new Error(
          "Enter a valid WhatsApp number, for example 0771234567.",
        );
      }

      if (!name.trim()) {
        throw new Error("Enter your shop name.");
      }

      if (shop) {
        const { error: err } = await supabase
          .from("shops")
          .update({
            name: name.trim(),
            whatsapp: whatsapp.trim(),
            area: area.trim() || null,
            payment_ref: paymentRef.trim() || null,
          })
          .eq("id", shop.id);

        if (err) {
          throw err;
        }
      } else {
        const { error: err } = await supabase.rpc("create_free_shop", {
          p_name: name.trim(),
          p_whatsapp: whatsapp.trim(),
          p_area: area.trim() || null,
        });

        if (err) {
          throw err;
        }
      }

      onSaved();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="form card-form">
      <label className="field">
        Shop name
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Kampala Kicks"
          required
        />
      </label>

      <label className="field">
        WhatsApp number
        <input
          value={whatsapp}
          onChange={(e) => setWhatsapp(e.target.value)}
          placeholder="0771234567"
          required
        />
      </label>

      <label className="field">
        Area
        <input
          value={area}
          onChange={(e) => setArea(e.target.value)}
          placeholder="Kampala, Nakasero"
        />
      </label>

      {shop && (
        <label className="field">
          Mobile Money transaction ID
          <input
            value={paymentRef}
            onChange={(e) => setPaymentRef(e.target.value)}
            placeholder="MP2609A81"
          />
        </label>
      )}

      {!shop && (
        <p className="muted">
          Your first 2 months are free. No payment is required to create your
          shop.
        </p>
      )}

      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}

      <button type="submit" className="btn gold" disabled={busy}>
        {busy ? "Saving..." : shop ? "Save changes" : "Create shop"}
      </button>

      {onCancel && (
        <button
          type="button"
          className="btn ghost"
          onClick={onCancel}
          disabled={busy}
        >
          Cancel
        </button>
      )}
    </form>
  );
}
