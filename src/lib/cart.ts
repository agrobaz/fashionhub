import { supabase } from "./supabase";
import type { Shoe } from "./types";

export type CartItem = {
  id: string;
  cart_id: string;
  shoe_id: string;
  variant_id: string | null;
  quantity: number;
  unit_price: number;
  size: string | null;
  color: string | null;
  created_at: string;
  updated_at: string;
  shoe?: Shoe | null;
};

export async function getOrCreateCart(userId: string) {
  const { data: existing, error: existingError } = await supabase
    .from("carts")
    .select("id, user_id, created_at, updated_at")
    .eq("user_id", userId)
    .maybeSingle();

  if (existingError) throw existingError;
  if (existing) return existing;

  const { data, error } = await supabase
    .from("carts")
    .insert({ user_id: userId })
    .select("id, user_id, created_at, updated_at")
    .single();

  if (error) throw error;

  return data;
}

export async function getCartItems(userId: string) {
  const cart = await getOrCreateCart(userId);

  const { data, error } = await supabase
    .from("cart_items")
    .select(`
      id,
      cart_id,
      shoe_id,
      variant_id,
      quantity,
      unit_price,
      size,
      color,
      created_at,
      updated_at,
      shoes(
        *,
        shops(name, whatsapp, area, slug, logo_url, verification_status)
      )
    `)
    .eq("cart_id", cart.id)
    .order("created_at", { ascending: false });

  if (error) throw error;

  return (data ?? []).map((row) => ({
    ...row,
    shoe: Array.isArray(row.shoes) ? row.shoes[0] ?? null : row.shoes ?? null,
  })) as CartItem[];
}

export async function addToCart(args: {
  userId: string;
  shoe: Shoe;
  quantity: number;
  size?: string | null;
  color?: string | null;
  variantId?: string | null;
}) {
  if (args.quantity < 1) {
    throw new Error("Quantity must be at least 1.");
  }

  const cart = await getOrCreateCart(args.userId);

  const selectedSize = args.size || null;
  const selectedColor = args.color || null;
  const variantId = args.variantId || null;

  let unitPrice = args.shoe.sale_price ?? args.shoe.price;

  if (variantId) {
    const { data: variant, error: variantError } = await supabase
      .from("product_variants")
      .select("id, stock_quantity, price")
      .eq("id", variantId)
      .eq("shoe_id", args.shoe.id)
      .maybeSingle();

    if (variantError) throw variantError;

    if (!variant) {
      throw new Error("That product option is no longer available.");
    }

    if (variant.stock_quantity < args.quantity) {
      throw new Error(`Only ${variant.stock_quantity} item(s) are available.`);
    }

    if (variant.price !== null) {
      unitPrice = variant.price;
    }
  } else if (args.shoe.stock_quantity < args.quantity) {
    throw new Error(`Only ${args.shoe.stock_quantity} item(s) are available.`);
  }

  let existingQuery = supabase
    .from("cart_items")
    .select("id, quantity")
    .eq("cart_id", cart.id)
    .eq("shoe_id", args.shoe.id);

  existingQuery = selectedSize === null
    ? existingQuery.is("size", null)
    : existingQuery.eq("size", selectedSize);

  existingQuery = selectedColor === null
    ? existingQuery.is("color", null)
    : existingQuery.eq("color", selectedColor);

  existingQuery = variantId === null
    ? existingQuery.is("variant_id", null)
    : existingQuery.eq("variant_id", variantId);

  const { data: existing, error: existingError } =
    await existingQuery.maybeSingle();

  if (existingError && existingError.code !== "PGRST116") {
    throw existingError;
  }

  if (existing) {
    const newQuantity = existing.quantity + args.quantity;

    const availableStock = variantId
      ? await getVariantStock(variantId, args.shoe.id)
      : args.shoe.stock_quantity;

    if (newQuantity > availableStock) {
      throw new Error(`Only ${availableStock} item(s) are available.`);
    }

    const { error } = await supabase
      .from("cart_items")
      .update({
        quantity: newQuantity,
        unit_price: unitPrice,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id)
      .eq("cart_id", cart.id);

    if (error) throw error;

    return;
  }

  const { error } = await supabase
    .from("cart_items")
    .insert({
      cart_id: cart.id,
      shoe_id: args.shoe.id,
      variant_id: variantId,
      quantity: args.quantity,
      unit_price: unitPrice,
      size: selectedSize,
      color: selectedColor,
    });

  if (error) throw error;
}

async function getVariantStock(variantId: string, shoeId: string) {
  const { data, error } = await supabase
    .from("product_variants")
    .select("stock_quantity")
    .eq("id", variantId)
    .eq("shoe_id", shoeId)
    .single();

  if (error) throw error;

  return data.stock_quantity;
}

export async function updateCartQuantity(
  itemId: string,
  quantity: number,
) {
  if (quantity < 1) {
    return removeCartItem(itemId);
  }

  const { error } = await supabase
    .from("cart_items")
    .update({
      quantity,
      updated_at: new Date().toISOString(),
    })
    .eq("id", itemId);

  if (error) throw error;
}

export async function removeCartItem(itemId: string) {
  const { error } = await supabase
    .from("cart_items")
    .delete()
    .eq("id", itemId);

  if (error) throw error;
}

export async function clearCart(userId: string) {
  const cart = await getOrCreateCart(userId);

  const { error } = await supabase
    .from("cart_items")
    .delete()
    .eq("cart_id", cart.id);

  if (error) throw error;
}
