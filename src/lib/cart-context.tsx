import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import {
  addToCart,
  getCartItems,
  removeCartItem,
  updateCartQuantity,
  type CartItem,
} from "./cart";

type CartContextValue = {
  items: CartItem[];
  itemCount: number;
  subtotal: number;
  loading: boolean;
  error: string;
  refresh: () => Promise<void>;
  addItem: (args: {
    shoe: NonNullable<CartItem["shoe"]>;
    quantity: number;
    size?: string | null;
    color?: string | null;
    variantId?: string | null;
  }) => Promise<void>;
  updateQuantity: (itemId: string, quantity: number) => Promise<void>;
  removeItem: (itemId: string) => Promise<void>;
};

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [items, setItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data, error: sessionError }) => {
      if (!mounted) return;

      if (sessionError) {
        setError(sessionError.message);
        return;
      }

      setUser(data.session?.user ?? null);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;

      setUser(session?.user ?? null);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const refresh = useCallback(async () => {
    if (!user) {
      setItems([]);
      return;
    }

    setLoading(true);
    setError("");

    try {
      const cartItems = await getCartItems(user.id);

      setItems(cartItems);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to load your cart.",
      );
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const addItem = useCallback(
    async (args: {
      shoe: NonNullable<CartItem["shoe"]>;
      quantity: number;
      size?: string | null;
      color?: string | null;
      variantId?: string | null;
    }) => {
      if (!user) {
        throw new Error("Please sign in before adding items to your cart.");
      }

      setError("");

      await addToCart({
        userId: user.id,
        shoe: args.shoe,
        quantity: args.quantity,
        size: args.size,
        color: args.color,
        variantId: args.variantId,
      });

      await refresh();
    },
    [refresh, user],
  );

  const updateQuantity = useCallback(
    async (itemId: string, quantity: number) => {
      setError("");

      try {
        await updateCartQuantity(itemId, quantity);
        await refresh();
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Unable to update cart quantity.",
        );
        throw err;
      }
    },
    [refresh],
  );

  const removeItem = useCallback(
    async (itemId: string) => {
      setError("");

      try {
        await removeCartItem(itemId);
        await refresh();
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Unable to remove that item.",
        );
        throw err;
      }
    },
    [refresh],
  );

  const value = useMemo<CartContextValue>(
    () => ({
      items,
      itemCount: items.reduce((sum, item) => sum + item.quantity, 0),
      subtotal: items.reduce(
        (sum, item) => sum + item.unit_price * item.quantity,
        0,
      ),
      loading,
      error,
      refresh,
      addItem,
      updateQuantity,
      removeItem,
    }),
    [
      items,
      loading,
      error,
      refresh,
      addItem,
      updateQuantity,
      removeItem,
    ],
  );

  return (
    <CartContext.Provider value={value}>
      {children}
    </CartContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useCart() {
  const context = useContext(CartContext);

  if (!context) {
    throw new Error("useCart must be used inside CartProvider.");
  }

  return context;
}
