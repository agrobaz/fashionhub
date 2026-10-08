export type ListingType = "new" | "second_hand";
export type Condition = "like_new" | "good" | "fair";

export type Shop = {
  id: string;
  owner_id: string;
  name: string;
  whatsapp: string;
  area: string | null;
  status: "pending" | "active" | "suspended";
  payment_ref: string | null;
  paid_until: string | null;
  slug: string | null;
  logo_url: string | null;
  description: string | null;
  verification_status: "unverified" | "verified";
  verified_at: string | null;
  verified_by: string | null;
};

export type Shoe = {
  id: string;
  shop_id: string;
  title: string;
  brand: string | null;
  category: string | null;
  subcategory: string | null;
  gender: string | null;
  color: string | null;
  colors: string[] | null;
  description: string | null;
  price: number;
  sale_price: number | null;
  size: string | null;
  sizes: string[] | null;
  listing_type: ListingType;
  condition: Condition | null;
  seller_location: string | null;
  fit_type: string | null;
  fit_note: string | null;
  stock_quantity: number;
  is_featured: boolean;
  photo_url: string | null;
  is_available: boolean;
  created_at: string;
  shops?: {
    name: string;
    whatsapp: string;
    area: string | null;
    slug?: string | null;
    logo_url?: string | null;
    verification_status?: "unverified" | "verified";
  } | null;
};

export type ProductVariant = {
  id: string;
  shoe_id: string;
  size: string | null;
  color: string | null;
  stock_quantity: number;
  price: number | null;
  created_at: string;
  updated_at: string;
  status: "pending" | "approved" | "hidden";
};

export type ProductReview = {
  id: string;
  shoe_id: string;
  user_id: string;
  rating: number;
  review_text: string | null;
  photo_url: string | null;
  created_at: string;
  updated_at: string;
  status: "pending" | "approved" | "hidden";
};

export type ShopCustomization = {
  id: string;
  shop_id: string;
  theme: string;
  primary_color: string | null;
  secondary_color: string | null;
  banner_url: string | null;
  banner_url_2: string | null;
  pinned_product_ids: string[];
  show_fashionhub_branding: boolean;
  created_at: string;
  updated_at: string;
  status: "pending" | "approved" | "hidden";
};

