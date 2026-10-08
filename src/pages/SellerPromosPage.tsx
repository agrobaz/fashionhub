import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth-context";
import { formatPrice } from "../lib/format";

type Promo = {
  id: string;
  code: string;
  percent_off: number;
  ends_at: string;
  max_uses: number | null;
  times_used: number;
  min_order: number | null;
  is_active: boolean;
};

export default function SellerPromosPage() {
  const { user } = useAuth();
  const [shopId, setShopId] = useState("");
  const [promos, setPromos] = useState<Promo[]>([]);
  const [loadedAt, setLoadedAt] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [tick, setTick] = useState(0);
  const [code, setCode] = useState("");
  const [percent, setPercent] = useState("10");
  const [days, setDays] = useState("7");
  const [maxUses, setMaxUses] = useState("");
  const [minOrder, setMinOrder] = useState("");

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
        .eq("owner_id", user.id)
        .limit(1);

      if (!active) return;

      if (shopError) {
        setError(shopError.message);
        setLoading(false);
        return;
      }

      const id = (shops ?? [])[0]?.id as string | undefined;

      if (!id) {
        setShopId("");
        setLoading(false);
        return;
      }

      setShopId(id);

      const { data, error: loadError } = await supabase
        .from("promo_codes")
        .select("id,code,percent_off,ends_at,max_uses,times_used,min_order,is_active")
        .eq("shop_id", id)
        .order("created_at", { ascending: false });

      if (!active) return;

      if (loadError) setError(loadError.message);
      else setPromos((data ?? []) as Promo[]);
      setLoadedAt(Date.now());
      setLoading(false);
    }

    void load();

    return () => {
      active = false;
    };
  }, [user, tick]);

  async function create() {
    setError("");
    const clean = code.trim().toUpperCase();
    const pct = Number(percent);
    const d = Number(days);

    if (!/^[A-Z0-9]{3,20}$/.test(clean)) {
      setError("Use 3 to 20 letters or numbers for the code, with no spaces.");
      return;
    }
    if (!(pct >= 1 && pct <= 90)) {
      setError("Discount must be between 1% and 90%.");
      return;
    }
    if (!(d >= 1 && d <= 365)) {
      setError("Choose between 1 and 365 days.");
      return;
    }

    setBusy(true);
    const { error: insertError } = await supabase.from("promo_codes").insert({
      shop_id: shopId,
      code: clean,
      percent_off: pct,
      ends_at: new Date(Date.now() + d * 24 * 60 * 60 * 1000).toISOString(),
      max_uses: maxUses ? Number(maxUses) : null,
      min_order: minOrder ? Number(minOrder) : null,
    });

    if (insertError) {
      setError(
        insertError.message.includes("promo_codes_code_unique")
          ? "That code is already taken. Try another."
          : insertError.message,
      );
    } else {
      setCode("");
      setMaxUses("");
      setMinOrder("");
    }

    setBusy(false);
    setTick((t) => t + 1);
  }

  async function toggle(p: Promo) {
    setError("");
    const { error: rpcError } = await supabase.rpc("set_promo_active", {
      p_id: p.id,
      p_active: !p.is_active,
    });
    if (rpcError) setError(rpcError.message);
    setTick((t) => t + 1);
  }

  async function remove(id: string) {
    if (!window.confirm("Delete this code?")) return;
    setError("");
    const { error: deleteError } = await supabase.from("promo_codes").delete().eq("id", id);
    if (deleteError) setError(deleteError.message);
    setTick((t) => t + 1);
  }

  if (!user) {
    return (
      <main className="page-shell">
        <div className="box">
          <h1>Sign in to manage promo codes</h1>
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
          <h1>Promo codes</h1>
          <p className="muted">
            Give buyers a percentage off your items. Each buyer can use a code once.
          </p>
        </div>
        <Link to="/seller" className="btn ghost">Back to dashboard</Link>
      </section>

      {error && <div className="box"><p className="error">{error}</p></div>}
      {loading && <div className="box"><p className="muted">Loading...</p></div>}

      {!loading && !shopId && (
        <div className="box">
          <p className="muted">Create your shop first.</p>
          <Link to="/seller" className="btn gold">Go to seller dashboard</Link>
        </div>
      )}

      {!loading && shopId && (
        <>
          <section className="box">
            <h2>New code</h2>
            <input className="input" placeholder="Code, e.g. WELCOME10" value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())} maxLength={20} />
            <input className="input" type="number" placeholder="Percent off (1 to 90)" value={percent}
              onChange={(e) => setPercent(e.target.value)} />
            <input className="input" type="number" placeholder="Valid for how many days" value={days}
              onChange={(e) => setDays(e.target.value)} />
            <input className="input" type="number" placeholder="Maximum uses (optional)" value={maxUses}
              onChange={(e) => setMaxUses(e.target.value)} />
            <input className="input" type="number" placeholder="Minimum spend in UGX (optional)" value={minOrder}
              onChange={(e) => setMinOrder(e.target.value)} />
            <button className="btn gold" disabled={busy} onClick={() => void create()}>
              {busy ? "Saving..." : "Create code"}
            </button>
          </section>

          <section className="box">
            <h2>Your codes</h2>
            {promos.length === 0 && <p className="muted">No codes yet.</p>}
            {promos.map((p) => {
              const expired = new Date(p.ends_at).getTime() < loadedAt;
              const label = expired ? "Expired" : p.is_active ? "Active" : "Paused";
              return (
                <div key={p.id} style={{ borderTop: "1px solid #3333", padding: "10px 0" }}>
                  <div className="cart-summary-row">
                    <strong>{p.code} - {p.percent_off}% off</strong>
                    <strong>{label}</strong>
                  </div>
                  <p className="muted small">
                    Used {p.times_used}{p.max_uses ? " of " + p.max_uses : ""} times
                    {p.min_order ? " - min spend " + formatPrice(p.min_order) : ""} - ends{" "}
                    {new Date(p.ends_at).toLocaleDateString("en-UG")}
                  </p>
                  <div className="cart-controls">
                    <button className="btn small ghost" onClick={() => void toggle(p)}>
                      {p.is_active ? "Pause" : "Resume"}
                    </button>
                    <button className="btn small ghost" onClick={() => void remove(p.id)}>Delete</button>
                  </div>
                </div>
              );
            })}
          </section>
        </>
      )}
    </main>
  );
}