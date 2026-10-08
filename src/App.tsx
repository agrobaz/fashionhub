import { Link, Navigate, Route, Routes } from "react-router-dom";
import type { ReactNode } from "react";
import { lazy, Suspense, useEffect, useState } from "react";
import { configMissing, supabase } from "./lib/supabase";
import { useAuth } from "./lib/auth-context";
const AuthPage = lazy(() => import("./pages/AuthPage"));
const HomePage = lazy(() => import("./pages/HomePage"));
const ShoePage = lazy(() => import("./pages/ShoePage"));
const StorePage = lazy(() => import("./pages/StorePage"));
const SellerPage = lazy(() => import("./pages/SellerPage"));
const BuyerPage = lazy(() => import("./pages/BuyerPage"));
const AdminPage = lazy(() => import("./pages/AdminPage"));
const ProfilePage = lazy(() => import("./pages/ProfilePage"));
const StoreSettingsPage = lazy(() => import("./pages/StoreSettingsPage"));
const SubscriptionPage = lazy(() => import("./pages/SubscriptionPage"));
const CartPage = lazy(() => import("./pages/CartPage"));
const CheckoutPage = lazy(() => import("./pages/CheckoutPage"));
const OrdersPage = lazy(() => import("./pages/OrdersPage"));
const SellerOrdersPage = lazy(() => import("./pages/SellerOrdersPage"));
const DisputesPage = lazy(() => import("./pages/DisputesPage"));
const SellerPromosPage = lazy(() => import("./pages/SellerPromosPage"));
const SellerInsightsPage = lazy(() => import("./pages/SellerInsightsPage"));

function Header() {
  const { user, signOut } = useAuth();
  const isSeller = user?.user_metadata?.account_type === "seller";
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function checkAdmin() {
      if (!user) {
        if (mounted) setIsAdmin(false);
        return;
      }

      const { data } = await supabase
        .from("admins")
        .select("user_id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (mounted) {
        setIsAdmin(Boolean(data));
      }
    }

    void checkAdmin();

    return () => {
      mounted = false;
    };
  }, [user]);

  return (
    <header className="header">
      <Link to="/" className="brand">
        <span className="fashionhub-brand">Fashion<b>Hub</b></span>
      </Link>

      <nav className="navs">
        {user && (
          <>
            <Link
              to={isSeller ? "/seller" : "/buyer"}
              className="btn small"
            >
              {isSeller ? "My shop" : "My account"}
            </Link>

            <Link to="/profile" className="btn small ghost">
              Profile
            </Link>

            {isSeller && (<Link to="/seller/insights" className="btn small ghost">Insights</Link>)}
            {isSeller && (<Link to="/seller/promos" className="btn small ghost">Promo codes</Link>)}
            <Link to="/disputes" className="btn small ghost">Disputes</Link>
            <Link to="/cart" className="btn small ghost">
              Cart
            </Link>

            <Link
              to={isSeller ? "/seller/orders" : "/orders"}
              className="btn small ghost"
            >
              {isSeller ? "Shop orders" : "My orders"}
            </Link>

            {isAdmin && (
              <Link to="/admin" className="btn small gold">
                Admin
              </Link>
            )}
          </>
        )}

        {user ? (
          <button className="btn small" onClick={() => void signOut()}>
            Logout
          </button>
        ) : (
          <Link to="/login" className="btn small">
            Login
          </Link>
        )}
      </nav>
    </header>
  );
}

function Protected({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) return <p className="muted pad">Loading...</p>;
  if (!user) return <Navigate to="/login" replace />;

  return <>{children}</>;
}

export default function App() {
  if (configMissing) {
    return (
      <div className="pad">
        <h2>Supabase settings missing</h2>
        <p className="muted">
          Open .env.local, paste your Supabase URL and anon key, then restart
          npm run dev.
        </p>
      </div>
    );
  }

  return (
    <>
      <Header />

      <main className="main">
        <Suspense fallback={<p className="muted pad">Loading...</p>}>
          <Routes>
          <Route path="/" element={<HomePage />} />

          <Route path="/shoe/:id" element={<ShoePage />} />

          <Route path="/store/:slug" element={<StorePage />} />

          <Route path="/login" element={<AuthPage />} />

          <Route
            path="/seller"
            element={
              <Protected>
                <SellerPage />
              </Protected>
            }
          />

          <Route
            path="/buyer"
            element={
              <Protected>
                <BuyerPage />
              </Protected>
            }
          />

          <Route
            path="/store-settings"
            element={
              <Protected>
                <StoreSettingsPage />
              </Protected>
            }
          />

          <Route
            path="/subscription"
            element={
              <Protected>
                <SubscriptionPage />
              </Protected>
            }
          />
          <Route
            path="/profile"
            element={
              <Protected>
                <ProfilePage />
              </Protected>
            }
          />

          <Route
            path="/admin"
            element={
              <Protected>
                <AdminPage />
              </Protected>
            }
          />

          <Route
            path="/cart"
            element={
              <Protected>
                <CartPage />
              </Protected>
            }
          />

          <Route
            path="/checkout"
            element={
              <Protected>
                <CheckoutPage />
              </Protected>
            }
          />

          <Route
            path="/orders"
            element={
              <Protected>
                <OrdersPage />
              </Protected>
            }
          />

          <Route
            path="/seller/orders"
            element={
              <Protected>
                <SellerOrdersPage />
              </Protected>
            }
          />

          <Route path="/seller/insights" element={<Protected><SellerInsightsPage /></Protected>} />
          <Route path="/seller/promos" element={<Protected><SellerPromosPage /></Protected>} />
          <Route path="/disputes" element={<Protected><DisputesPage /></Protected>} />

          <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </main>
    </>
  );
}














