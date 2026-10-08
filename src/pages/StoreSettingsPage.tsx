import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth-context";
import type { Shoe, Shop, ShopCustomization } from "../lib/types";
import { errorMessage } from "../lib/format";

const themes = [
  {
    value: "cinematic",
    label: "Cinematic",
    description: "Dark, bold and premium.",
  },
  {
    value: "minimal",
    label: "Minimal",
    description: "Clean and simple.",
  },
  {
    value: "editorial",
    label: "Editorial",
    description: "Fashion-magazine inspired.",
  },
  {
    value: "luxury",
    label: "Luxury",
    description: "Elegant and premium.",
  },
];

export default function StoreSettingsPage() {
  const { user } = useAuth();

  const [shop, setShop] = useState<Shop | null>(null);
  const [products, setProducts] = useState<Shoe[]>([]);
  const [customization, setCustomization] =
    useState<ShopCustomization | null>(null);

  const [name, setName] = useState("");
  const [area, setArea] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [description, setDescription] = useState("");
  const [logoUrl, setLogoUrl] = useState("");

  const [theme, setTheme] = useState("cinematic");
  const [primaryColor, setPrimaryColor] = useState("#111111");
  const [secondaryColor, setSecondaryColor] = useState("#f4f4f0");
  const [bannerUrl, setBannerUrl] = useState("");
  const [bannerUrl2, setBannerUrl2] = useState("");
  const [pinnedProductIds, setPinnedProductIds] = useState<string[]>([]);
  const [showBranding, setShowBranding] = useState(true);

  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user) return;

    const userId = user.id;

    async function loadStore() {
      setLoading(true);
      setError("");

      try {
        const { data: shopData, error: shopError } =
          await supabase
            .from("shops")
            .select("*")
            .eq("owner_id", userId)
            .maybeSingle();

        if (shopError) throw shopError;

        if (!shopData) {
          setLoading(false);
          return;
        }

        const currentShop = shopData as Shop;
        setShop(currentShop);

        setName(currentShop.name);
        setArea(currentShop.area ?? "");
        setWhatsapp(currentShop.whatsapp);
        setDescription(currentShop.description ?? "");
        setLogoUrl(currentShop.logo_url ?? "");

        const [
          { data: customizationData, error: customizationError },
          { data: productData, error: productError },
        ] = await Promise.all([
          supabase
            .from("shop_customizations")
            .select("*")
            .eq("shop_id", currentShop.id)
            .maybeSingle(),

          supabase
            .from("shoes")
            .select("*")
            .eq("shop_id", currentShop.id)
            .eq("is_available", true)
            .order("created_at", { ascending: false }),
        ]);

        if (customizationError) throw customizationError;
        if (productError) throw productError;

        setProducts((productData as Shoe[]) ?? []);

        if (customizationData) {
          const currentCustomization =
            customizationData as ShopCustomization;

          setCustomization(currentCustomization);
          setTheme(currentCustomization.theme);
          setPrimaryColor(
            currentCustomization.primary_color ?? "#111111",
          );
          setSecondaryColor(
            currentCustomization.secondary_color ?? "#f4f4f0",
          );
          setBannerUrl(currentCustomization.banner_url ?? "");
          setBannerUrl2(
            currentCustomization.banner_url_2 ?? "",
          );
          setPinnedProductIds(
            currentCustomization.pinned_product_ids ?? [],
          );
          setShowBranding(
            currentCustomization.show_fashionhub_branding,
          );
        }
      } catch (err) {
        setError(errorMessage(err));
      } finally {
        setLoading(false);
      }
    }

    void loadStore();
  }, [user]);

  async function save() {
    if (!shop || !user) return;

    setSaving(true);
    setError("");
    setMessage("");

    try {
      if (!name.trim()) {
        throw new Error("Store name is required.");
      }

      if (!whatsapp.replace(/\D/g, "").length) {
        throw new Error("WhatsApp number is required.");
      }

      const { error: shopError } = await supabase
        .from("shops")
        .update({
          name: name.trim(),
          area: area.trim() || null,
          whatsapp: whatsapp.trim(),
          description: description.trim() || null,
          logo_url: logoUrl.trim() || null,
        })
        .eq("id", shop.id)
        .eq("owner_id", user.id);

      if (shopError) throw shopError;

      const payload = {
        shop_id: shop.id,
        theme,
        primary_color: primaryColor || null,
        secondary_color: secondaryColor || null,
        banner_url: bannerUrl.trim() || null,
        banner_url_2: bannerUrl2.trim() || null,
        pinned_product_ids: pinnedProductIds,
        show_fashionhub_branding: showBranding,
      };

      const { data, error: customizationError } =
        await supabase
          .from("shop_customizations")
          .upsert(payload, {
            onConflict: "shop_id",
          })
          .select()
          .single();

      if (customizationError) throw customizationError;

      setCustomization(data as ShopCustomization);

      setShop((current) =>
        current
          ? {
              ...current,
              name: name.trim(),
              area: area.trim() || null,
              whatsapp: whatsapp.trim(),
              description: description.trim() || null,
              logo_url: logoUrl.trim() || null,
            }
          : current,
      );

      setMessage("Store customization saved successfully.");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  function togglePinned(productId: string) {
    setPinnedProductIds((current) =>
      current.includes(productId)
        ? current.filter((id) => id !== productId)
        : [...current, productId].slice(-6),
    );
  }

  const pinnedProducts = useMemo(
    () =>
      pinnedProductIds
        .map((id) =>
          products.find((product) => product.id === id),
        )
        .filter(Boolean) as Shoe[],
    [pinnedProductIds, products],
  );

  if (loading) {
    return (
      <div className="pad">
        <p className="muted">Loading store settings...</p>
      </div>
    );
  }

  if (!shop) {
    return (
      <div className="empty-market">
        <h2>No store found</h2>
        <p className="muted">
          Create your free store first.
        </p>
        <Link to="/seller" className="btn">
          Back to seller dashboard
        </Link>
      </div>
    );
  }

  const storefrontUrl =
    window.location.origin +
    "/store/" +
    (shop.slug ?? "");

  return (
    <div className="settings-page">
      <Link to="/seller" className="back">
        Back to seller dashboard
      </Link>

      <section className="settings-header">
        <div>
          <div className="eyebrow">Store management</div>
          <h1>Customize your storefront</h1>
          <p className="muted">
            Build a storefront that looks like your own
            fashion brand.
          </p>
        </div>

        <Link
          to={"/store/" + shop.slug}
          className="btn ghost"
        >
          View live storefront
        </Link>
      </section>

      <section className="settings-card card">
        <div className="settings-section-title">
          <span className="eyebrow">01</span>
          <h2>Store identity</h2>
        </div>

        <label>
          Store name
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your store name"
          />
        </label>

        <label>
          WhatsApp
          <input
            value={whatsapp}
            onChange={(e) =>
              setWhatsapp(e.target.value)
            }
            placeholder="0771234567"
          />
        </label>

        <label>
          Location / area
          <input
            value={area}
            onChange={(e) => setArea(e.target.value)}
            placeholder="Kampala, Kisenyi"
          />
        </label>

        <label>
          Store logo URL
          <input
            value={logoUrl}
            onChange={(e) =>
              setLogoUrl(e.target.value)
            }
            placeholder="https://..."
          />
        </label>

        <label>
          Store description
          <textarea
            value={description}
            onChange={(e) =>
              setDescription(e.target.value)
            }
            rows={5}
            placeholder="Tell buyers about your store..."
          />
        </label>
      </section>

      <section className="settings-card card">
        <div className="settings-section-title">
          <span className="eyebrow">02</span>
          <h2>Store design</h2>
        </div>

        <div className="theme-grid">
          {themes.map((item) => (
            <button
              key={item.value}
              type="button"
              className={
                theme === item.value
                  ? "theme-option active"
                  : "theme-option"
              }
              onClick={() => setTheme(item.value)}
            >
              <strong>{item.label}</strong>
              <span>{item.description}</span>
            </button>
          ))}
        </div>

        <div className="color-grid">
          <label>
            Primary color
            <div className="color-input">
              <input
                type="color"
                value={primaryColor}
                onChange={(e) =>
                  setPrimaryColor(e.target.value)
                }
              />
              <input
                value={primaryColor}
                onChange={(e) =>
                  setPrimaryColor(e.target.value)
                }
              />
            </div>
          </label>

          <label>
            Secondary color
            <div className="color-input">
              <input
                type="color"
                value={secondaryColor}
                onChange={(e) =>
                  setSecondaryColor(e.target.value)
                }
              />
              <input
                value={secondaryColor}
                onChange={(e) =>
                  setSecondaryColor(e.target.value)
                }
              />
            </div>
          </label>
        </div>

        <label>
          Main banner URL
          <input
            value={bannerUrl}
            onChange={(e) =>
              setBannerUrl(e.target.value)
            }
            placeholder="https://..."
          />
        </label>

        <label>
          Secondary banner URL
          <input
            value={bannerUrl2}
            onChange={(e) =>
              setBannerUrl2(e.target.value)
            }
            placeholder="https://..."
          />
        </label>

        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={showBranding}
            onChange={(e) =>
              setShowBranding(e.target.checked)
            }
          />
          <span>
            Show FashionHub branding on my storefront
          </span>
        </label>
      </section>

      <section className="settings-card card">
        <div className="settings-section-title">
          <span className="eyebrow">03</span>
          <h2>Featured products</h2>
        </div>

        <p className="muted">
          Select up to 6 products to pin near the top
          of your storefront.
        </p>

        {products.length === 0 ? (
          <p className="muted">
            Add products from your seller dashboard first.
          </p>
        ) : (
          <div className="settings-product-grid">
            {products.map((product) => {
              const selected = pinnedProductIds.includes(
                product.id,
              );

              return (
                <button
                  key={product.id}
                  type="button"
                  className={
                    selected
                      ? "settings-product selected"
                      : "settings-product"
                  }
                  onClick={() =>
                    togglePinned(product.id)
                  }
                >
                  {product.photo_url ? (
                    <img
                      src={product.photo_url}
                      alt=""
                    />
                  ) : (
                    <div className="settings-product-placeholder">
                      FH
                    </div>
                  )}

                  <span>
                    <strong>{product.title}</strong>
                    <small>
                      UGX{" "}
                      {(
                        product.sale_price ??
                        product.price
                      ).toLocaleString()}
                    </small>
                  </span>

                  {selected && (
                    <b className="settings-selected">
                      Pinned
                    </b>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </section>

      <section className="settings-card card store-preview-card">
        <div className="settings-section-title">
          <span className="eyebrow">04</span>
          <h2>Live preview</h2>
        </div>

        <div
          className={"store-preview " + theme}
          style={{
            "--preview-primary": primaryColor,
            "--preview-secondary": secondaryColor,
          } as React.CSSProperties}
        >
          {bannerUrl && (
            <img
              className="store-preview-banner"
              src={bannerUrl}
              alt=""
            />
          )}

          <div className="store-preview-content">
            <div className="store-preview-avatar">
              {logoUrl ? (
                <img src={logoUrl} alt="" />
              ) : (
                <span>
                  {name.slice(0, 2).toUpperCase() ||
                    "FH"}
                </span>
              )}
            </div>

            <div>
              <span className="eyebrow">
                {showBranding
                  ? "FashionHub Store"
                  : "Official Store"}
              </span>

              <h3>{name || "Your store name"}</h3>

              {area && (
                <p className="muted">{area}</p>
              )}

              {description && (
                <p>{description}</p>
              )}
            </div>
          </div>

          {pinnedProducts.length > 0 && (
            <div className="store-preview-products">
              {pinnedProducts.slice(0, 3).map(
                (product) => (
                  <div key={product.id}>
                    {product.photo_url ? (
                      <img
                        src={product.photo_url}
                        alt=""
                      />
                    ) : (
                      <div className="settings-product-placeholder">
                        FH
                      </div>
                    )}
                    <strong>{product.title}</strong>
                  </div>
                ),
              )}
            </div>
          )}
        </div>
      </section>

      <div className="store-link-box">
        <strong>Your storefront</strong>
        <a
          href={storefrontUrl}
          target="_blank"
          rel="noreferrer"
        >
          {storefrontUrl}
        </a>
      </div>

      <div className="verification-info">
        <strong>Verification</strong>
        <p className="muted">
          {shop.verification_status === "verified"
            ? "Your store is verified by FashionHub."
            : "Your store is not verified yet. Only FashionHub admins can verify stores."}
        </p>
      </div>

      {error && (
        <p className="form-error">{error}</p>
      )}

      {message && (
        <p className="form-success">{message}</p>
      )}

      <button
        className="btn"
        onClick={() => void save()}
        disabled={saving}
      >
        {saving
          ? "Saving..."
          : customization
            ? "Save store customization"
            : "Create store customization"}
      </button>
    </div>
  );
}


