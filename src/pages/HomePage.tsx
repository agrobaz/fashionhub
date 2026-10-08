import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth-context";
import type { Shoe } from "../lib/types";

const categories = ["All", "Women", "Men", "Thrift", "Kids"];

const fallbackItems = [
  {
    id: "kitenge-demo",
    title: "Kitenge dress",
    price: 85000,
    category: "Women",
    photo_url: null,
  },
  {
    id: "gomesi-demo",
    title: "Gomesi",
    price: 120000,
    category: "Women",
    photo_url: null,
  },
  {
    id: "linen-demo",
    title: "Linen shirt",
    price: 65000,
    category: "Men",
    photo_url: null,
  },
  {
    id: "denim-demo",
    title: "Denim jacket",
    price: 95000,
    category: "Thrift",
    photo_url: null,
  },
];

function formatUGX(value: number) {
  return `UGX ${value.toLocaleString("en-UG")}`;
}

function Icon({
  children,
  size = 22,
}: {
  children: React.ReactNode;
  size?: number;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

function PlaceholderIcon() {
  return (
    <svg
      width="42"
      height="42"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <circle cx="8.5" cy="9" r="1.5" />
      <path d="m21 15-4.5-4.5L9 18l-2.5-2.5L3 19" />
    </svg>
  );
}

export default function HomePage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [products, setProducts] = useState<Shoe[]>([]);
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [search, setSearch] = useState("");
  const [savedIds, setSavedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function loadProducts() {
      setLoading(true);

      const { data } = await supabase
        .from("shoes")
        .select(`
          *,
          shops(
            name,
            whatsapp,
            area,
            slug,
            logo_url,
            verification_status
          )
        `)
        .eq("is_available", true)
        .order("created_at", { ascending: false })
        .limit(12);

      if (active) {
        setProducts((data ?? []) as Shoe[]);
        setLoading(false);
      }
    }

    void loadProducts();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!user) {
      setSavedIds([]);
      return;
    }

    const userId = user.id;
  let active = true;

  async function loadSaved() {
      const { data } = await supabase
        .from("saved_shoes")
        .select("shoe_id")
        .eq("user_id", userId);

      if (active) {
        setSavedIds((data ?? []).map((item) => item.shoe_id));
      }
    }

    void loadSaved();

    return () => {
      active = false;
    };
  }, [user]);

  const visibleProducts = useMemo(() => {
    const source =
      products.length > 0
        ? products
        : (fallbackItems as unknown as Shoe[]);

    return source.filter((product) => {
      const categoryMatch =
        selectedCategory === "All" ||
        product.gender === selectedCategory ||
        product.category === selectedCategory;

      const searchMatch =
        !search.trim() ||
        product.title.toLowerCase().includes(search.toLowerCase()) ||
        product.category?.toLowerCase().includes(search.toLowerCase()) ||
        product.brand?.toLowerCase().includes(search.toLowerCase());

      return categoryMatch && searchMatch;
    });
  }, [products, selectedCategory, search]);

  async function toggleSaved(shoeId: string) {
    if (!user) {
      navigate("/login");
      return;
    }

    const saved = savedIds.includes(shoeId);

    if (saved) {
      await supabase
        .from("saved_shoes")
        .delete()
        .eq("user_id", user.id)
        .eq("shoe_id", shoeId);

      setSavedIds((current) => current.filter((id) => id !== shoeId));
    } else {
      await supabase.from("saved_shoes").insert({
        user_id: user.id,
        shoe_id: shoeId,
      });

      setSavedIds((current) => [...current, shoeId]);
    }
  }

  return (
    <main className="fh-home">
      <header className="fh-topbar">
        <button
          type="button"
          className="fh-icon-button"
          aria-label="Open menu"
        >
          <Icon>
            <path d="M4 7h16M4 12h16M4 17h16" />
          </Icon>
        </button>

        <Link to="/" className="fh-logo" aria-label="FashionHub home">
          Fashion<span>Hub</span>
        </Link>

        <Link to="/cart" className="fh-icon-button" aria-label="Cart">
          <Icon>
            <path d="M5 6h2l1.5 9h8.8L20 9H8" />
            <circle cx="10" cy="19" r="1" />
            <circle cx="17" cy="19" r="1" />
          </Icon>
        </Link>
      </header>

      <section className="fh-search-wrap">
        <div className="fh-search">
          <Icon size={19}>
            <circle cx="11" cy="11" r="6.5" />
            <path d="m16 16 4 4" />
          </Icon>

          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search the collection"
            aria-label="Search the collection"
          />
        </div>
      </section>

      <section className="fh-hero">
        <div className="fh-hero-inner">
          <span className="fh-eyebrow">New season</span>

          <h1>Dressed in the details</h1>

          <p>
            Discover beautiful fashion from independent sellers across Uganda.
          </p>

          <button
            type="button"
            className="fh-primary-button"
            onClick={() => {
              setSelectedCategory("All");
              document
                .getElementById("fh-arrivals")
                ?.scrollIntoView({ behavior: "smooth" });
            }}
          >
            Shop now
          </button>
        </div>
      </section>

      <nav className="fh-category-tabs" aria-label="Fashion categories">
        {categories.map((category) => (
          <button
            key={category}
            type="button"
            className={selectedCategory === category ? "selected" : ""}
            onClick={() => setSelectedCategory(category)}
          >
            {category}
          </button>
        ))}
      </nav>

      <section id="fh-arrivals" className="fh-arrivals">
        <div className="fh-section-heading">
          <div>
            <span className="fh-eyebrow">Fresh from our sellers</span>
            <h2>New arrivals</h2>
          </div>

          <span className="fh-result-count">
            {loading ? "Loading..." : `${visibleProducts.length} pieces`}
          </span>
        </div>

        <div className="fh-product-grid">
          {visibleProducts.map((product) => {
            const isRealProduct = products.some(
              (item) => item.id === product.id,
            );

            const price = product.sale_price ?? product.price;
            const saved = savedIds.includes(product.id);

            return (
              <article className="fh-product-card" key={product.id}>
                <Link
                  to={isRealProduct ? `/shoe/${product.id}` : "#"}
                  className="fh-product-photo"
                  onClick={(event) => {
                    if (!isRealProduct) event.preventDefault();
                  }}
                >
                  {product.photo_url ? (
                    <img
                      src={product.photo_url}
                      alt={product.title}
                      loading="lazy"
                    />
                  ) : (
                    <div className="fh-placeholder">
                      <PlaceholderIcon />
                    </div>
                  )}
                </Link>

                <button
                  type="button"
                  className={`fh-wishlist ${saved ? "saved" : ""}`}
                  aria-label={saved ? "Remove from wishlist" : "Add to wishlist"}
                  onClick={() => void toggleSaved(product.id)}
                >
                  <Icon size={20}>
                    {saved ? (
                      <path
                        d="M20.8 8.8c0 5-8.8 10.2-8.8 10.2S3.2 13.8 3.2 8.8A4.8 4.8 0 0 1 12 6.3a4.8 4.8 0 0 1 8.8 2.5Z"
                        fill="currentColor"
                      />
                    ) : (
                      <path d="M20.8 8.8c0 5-8.8 10.2-8.8 10.2S3.2 13.8 3.2 8.8A4.8 4.8 0 0 1 12 6.3a4.8 4.8 0 0 1 8.8 2.5Z" />
                    )}
                  </Icon>
                </button>

                <div className="fh-product-info">
                  <Link
                    to={isRealProduct ? `/shoe/${product.id}` : "#"}
                    className="fh-product-name"
                    onClick={(event) => {
                      if (!isRealProduct) event.preventDefault();
                    }}
                  >
                    {product.title}
                  </Link>

                  <span className="fh-product-seller">
                    {product.shops?.name ?? "FashionHub seller"}
                  </span>

                  <div className="fh-product-bottom">
                    <strong>{formatUGX(price)}</strong>
                    {product.size && <span>{product.size}</span>}
                  </div>
                </div>
              </article>
            );
          })}
        </div>

        {!loading && visibleProducts.length === 0 && (
          <div className="fh-empty">
            <span>No pieces found.</span>
            <button type="button" onClick={() => setSearch("")}>
              Clear search
            </button>
          </div>
        )}
      </section>

      <nav className="fh-bottom-nav" aria-label="Main navigation">
        <Link className="active" to="/">
          <Icon>
            <path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1Z" />
          </Icon>
          <span>Home</span>
        </Link>

        <button type="button" onClick={() => document.querySelector<HTMLInputElement>(".fh-search input")?.focus()}>
          <Icon>
            <circle cx="11" cy="11" r="6.5" />
            <path d="m16 16 4 4" />
          </Icon>
          <span>Search</span>
        </button>

        <button type="button" onClick={() => navigate(user ? "/buyer" : "/login")}>
          <Icon>
            <path d="M20.8 8.8c0 5-8.8 10.2-8.8 10.2S3.2 13.8 3.2 8.8A4.8 4.8 0 0 1 12 6.3a4.8 4.8 0 0 1 8.8 2.5Z" />
          </Icon>
          <span>Wishlist</span>
        </button>

        <button type="button" onClick={() => navigate(user ? "/profile" : "/login")}>
          <Icon>
            <circle cx="12" cy="8" r="3.2" />
            <path d="M5 20c.8-3.4 3.1-5.2 7-5.2s6.2 1.8 7 5.2" />
          </Icon>
          <span>Account</span>
        </button>
      </nav>
    </main>
  );
}



