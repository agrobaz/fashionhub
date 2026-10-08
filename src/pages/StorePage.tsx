import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
import type {
  Shoe,
  Shop,
  ShopCustomization,
} from "../lib/types";
import ShoeCard from "../components/ShoeCard";
import ReportButton from "../components/ReportButton";

export default function StorePage() {
  const { slug } = useParams();
  const navigate = useNavigate();

  const [shop, setShop] = useState<Shop | null>(null);
  const [customization, setCustomization] =
    useState<ShopCustomization | null>(null);
  const [shoes, setShoes] = useState<Shoe[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [type, setType] = useState("All");
  const [sort, setSort] = useState("newest");

  const [followed, setFollowed] = useState(false);
  const [followBusy, setFollowBusy] = useState(false);

  useEffect(() => {
    if (!slug) return;

    async function loadStore() {
      setLoading(true);

      const { data: shopData } = await supabase
        .from("shops")
        .select("*")
        .eq("slug", slug)
        .eq("status", "active")
        .maybeSingle();

      if (!shopData) {
        setShop(null);
        setCustomization(null);
        setShoes([]);
        setLoading(false);
        return;
      }

      const [
        { data: customizationData },
        { data: shoeData },
      ] = await Promise.all([
        supabase
          .from("shop_customizations")
          .select("*")
          .eq("shop_id", shopData.id)
          .maybeSingle(),

        supabase
          .from("shoes")
          .select("*, shops(name, whatsapp, area)")
          .eq("shop_id", shopData.id)
          .eq("is_available", true)
          .order("created_at", {
            ascending: false,
          }),
      ]);

      setShop(shopData as Shop);
      setCustomization(
        (customizationData as ShopCustomization) ?? null,
      );
      setShoes((shoeData as Shoe[]) ?? []);
      setLoading(false);
    }

    void loadStore();
  }, [slug]);

  useEffect(() => {
    if (!shop) {
      setFollowed(false);
      return;
    }

    async function loadFollowStatus() {
      const { data: userData } =
        await supabase.auth.getUser();

      if (!userData.user) {
        setFollowed(false);
        return;
      }

      const { data } = await supabase
        .from("followed_shops")
        .select("shop_id")
        .eq("shop_id", shop!.id)
        .eq("user_id", userData.user.id)
        .maybeSingle();

      setFollowed(Boolean(data));
    }

    void loadFollowStatus();
  }, [shop]);

  async function toggleFollow() {
    if (!shop) return;

    const { data: userData } =
      await supabase.auth.getUser();

    const user = userData.user;

    if (!user) {
      navigate("/login");
      return;
    }

    setFollowBusy(true);

    if (followed) {
      const { error } = await supabase
        .from("followed_shops")
        .delete()
        .eq("shop_id", shop!.id)
        .eq("user_id", user.id);

      if (!error) {
        setFollowed(false);
      }
    } else {
      const { error } = await supabase
        .from("followed_shops")
        .insert({
          shop_id: shop.id,
          user_id: user.id,
        });

      if (!error) {
        setFollowed(true);
      }
    }

    setFollowBusy(false);
  }

  const categories = useMemo(
    () => [
      "All",
      ...Array.from(
        new Set(
          shoes
            .map((shoe) => shoe.category)
            .filter(Boolean) as string[],
        ),
      ).sort(),
    ],
    [shoes],
  );

  const filteredShoes = useMemo(() => {
    const query = search.trim().toLowerCase();

    const result = shoes.filter((shoe) => {
      const matchesSearch =
        !query ||
        [
          shoe.title,
          shoe.brand,
          shoe.category,
          shoe.color,
          shoe.description,
        ]
          .filter(Boolean)
          .some((value) =>
            String(value)
              .toLowerCase()
              .includes(query),
          );

      const matchesCategory =
        category === "All" ||
        shoe.category === category;

      const matchesType =
        type === "All" ||
        shoe.listing_type === type;

      return (
        matchesSearch &&
        matchesCategory &&
        matchesType
      );
    });

    return [...result].sort((a, b) => {
      if (sort === "low") {
        return a.price - b.price;
      }

      if (sort === "high") {
        return b.price - a.price;
      }

      return (
        new Date(b.created_at).getTime() -
        new Date(a.created_at).getTime()
      );
    });
  }, [
    shoes,
    search,
    category,
    type,
    sort,
  ]);

  const featuredShoes = useMemo(() => {
    if (!customization?.pinned_product_ids?.length) {
      return [];
    }

    return customization.pinned_product_ids
      .map((id) =>
        shoes.find((shoe) => shoe.id === id),
      )
      .filter(Boolean) as Shoe[];
  }, [customization, shoes]);

  const newCount = shoes.filter(
    (shoe) => shoe.listing_type === "new",
  ).length;

  const secondHandCount = shoes.filter(
    (shoe) => shoe.listing_type === "second_hand",
  ).length;

  if (loading) {
    return (
      <div className="store-page store-loading">
        <div className="store-loading-line" />
        <p className="muted">
          Loading storefront...
        </p>
      </div>
    );
  }

  if (!shop) {
    return (
      <div className="empty-market store-not-found">
        <div
          className="empty-icon"
          aria-hidden="true"
        >
          FH
        </div>

        <p className="eyebrow">
          Store unavailable
        </p>

        <h2>Storefront not found</h2>

        <p className="muted">
          This store may be unavailable or no longer
          active.
        </p>

        <Link to="/" className="btn">
          Back to marketplace
        </Link>
      </div>
    );
  }

  const verified =
    shop.verification_status === "verified";

  const theme =
    customization?.theme ?? "cinematic";

  const primary =
    customization?.primary_color ||
    "#111111";

  const secondary =
    customization?.secondary_color ||
    "#f5f5f5";

  return (
    <div
      className={`store-page store-theme-${theme}`}
      style={
        {
          "--store-primary": primary,
          "--store-secondary": secondary,
        } as React.CSSProperties
      }
    >
      <Link to="/" className="store-back">
        <span aria-hidden="true">?</span>
        Marketplace
      </Link>

      {customization?.banner_url && (
        <section
          className="store-banner"
          style={{
            backgroundImage: `linear-gradient(90deg, rgba(0,0,0,.72), rgba(0,0,0,.2)), url("${customization.banner_url}")`,
          }}
        >
          <div className="store-banner-content">
            <span className="store-banner-label">
              {theme === "luxury"
                ? "CURATED COLLECTION"
                : "FASHIONHUB STORE"}
            </span>

            <h1>{shop.name}</h1>

            {shop.description && (
              <p>{shop.description}</p>
            )}
          </div>
        </section>
      )}

      <section className="store-hero">
        <div className="store-avatar">
          {shop.logo_url ? (
            <img
              src={shop.logo_url}
              alt={shop.name}
            />
          ) : (
            <span>FH</span>
          )}
        </div>

        <div className="store-heading">
          <div className="store-kicker">
            <span>
              {theme === "editorial"
                ? "Independent fashion store"
                : "FashionHub Store"}
            </span>

            {verified && (
              <span
                className="store-verified"
                title="Verified by FashionHub"
              >
                ? Verified
              </span>
            )}
          </div>

          <h1>{shop.name}</h1>

          {shop.area && (
            <p className="store-location">
              <span aria-hidden="true">
                •
              </span>
              {shop.area}
            </p>
          )}

          {shop.description &&
            !customization?.banner_url && (
              <p className="store-description">
                {shop.description}
              </p>
            )}

          <div className="store-actions">
            {shop.whatsapp && (
              <a
                className="btn wa"
                href={
                  "https://wa.me/" +
                  shop.whatsapp.replace(/\D/g, "")
                }
                target="_blank"
                rel="noopener noreferrer"
              >
                WhatsApp store
              </a>
            )}

            <button
              type="button"
              className={
                followed
                  ? "btn ghost store-follow following"
                  : "btn store-follow"
              }
              onClick={() => void toggleFollow()}
              disabled={followBusy}
            >
              {followBusy
                ? "Saving..."
                : followed
                  ? "Following"
                  : "Follow store"}
            </button>

            <ReportButton shopId={shop.id} />
          </div>
        </div>

        <div className="store-summary">
          <div>
            <strong>{shoes.length}</strong>
            <span>Listings</span>
          </div>

          <div>
            <strong>{newCount}</strong>
            <span>New</span>
          </div>

          <div>
            <strong>{secondHandCount}</strong>
            <span>Second-hand</span>
          </div>
        </div>
      </section>

      {featuredShoes.length > 0 && (
        <section className="store-featured">
          <div className="store-section-heading">
            <div>
              <p className="eyebrow">
                Curated by the seller
              </p>

              <h2>Featured collection</h2>
            </div>

            <span>
              {featuredShoes.length} featured
            </span>
          </div>

          <div className="market-grid">
            {featuredShoes.map((shoe) => (
              <ShoeCard
                key={shoe.id}
                shoe={shoe}
              />
            ))}
          </div>
        </section>
      )}

      <section className="store-toolbar">
        <div className="store-search">
          <span
            className="store-search-icon"
            aria-hidden="true"
          >
            /
          </span>

          <input
            value={search}
            onChange={(event) =>
              setSearch(event.target.value)
            }
            placeholder="Search this store..."
            aria-label="Search this store"
          />

          {search && (
            <button
              type="button"
              className="store-clear"
              onClick={() => setSearch("")}
              aria-label="Clear search"
            >
              ×
            </button>
          )}
        </div>

        <select
          value={category}
          onChange={(event) =>
            setCategory(event.target.value)
          }
          aria-label="Filter by category"
        >
          {categories.map((item) => (
            <option key={item} value={item}>
              {item === "All"
                ? "All categories"
                : item}
            </option>
          ))}
        </select>

        <select
          value={type}
          onChange={(event) =>
            setType(event.target.value)
          }
          aria-label="Filter by listing type"
        >
          <option value="All">
            All listings
          </option>

          <option value="new">
            New fashion
          </option>

          <option value="second_hand">
            Second-hand
          </option>
        </select>

        <select
          value={sort}
          onChange={(event) =>
            setSort(event.target.value)
          }
          aria-label="Sort listings"
        >
          <option value="newest">
            Newest first
          </option>

          <option value="low">
            Price: low to high
          </option>

          <option value="high">
            Price: high to low
          </option>
        </select>
      </section>

      <section className="store-results">
        <div className="store-results-head">
          <div>
            <p className="eyebrow">
              Store collection
            </p>

            <h2>
              {filteredShoes.length}{" "}
              {filteredShoes.length === 1
                ? "product"
                : "products"}
            </h2>
          </div>

          {(search ||
            category !== "All" ||
            type !== "All") && (
            <button
              type="button"
              className="btn small ghost"
              onClick={() => {
                setSearch("");
                setCategory("All");
                setType("All");
              }}
            >
              Clear filters
            </button>
          )}
        </div>

        {filteredShoes.length > 0 ? (
          <div className="market-grid">
            {filteredShoes.map((shoe) => (
              <ShoeCard
                key={shoe.id}
                shoe={shoe}
              />
            ))}
          </div>
        ) : (
          <div className="empty-market card store-empty">
            <div
              className="empty-icon"
              aria-hidden="true"
            >
              FH
            </div>

            <p className="eyebrow">
              Nothing matched
            </p>

            <h3>No products found</h3>

            <p className="muted">
              Try another search or remove one of
              the filters.
            </p>

            <button
              type="button"
              className="btn"
              onClick={() => {
                setSearch("");
                setCategory("All");
                setType("All");
              }}
            >
              Show all products
            </button>
          </div>
        )}
      </section>

      {customization?.show_fashionhub_branding && (
        <footer className="store-brand-footer">
          Powered by <strong>FashionHub</strong>
        </footer>
      )}
    </div>
  );
}

