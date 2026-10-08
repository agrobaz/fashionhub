-- FashionHub real marketplace commerce
-- Cart -> Checkout -> Orders -> Payments -> Delivery

create table if not exists carts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id)
);

create table if not exists cart_items (
  id uuid primary key default gen_random_uuid(),
  cart_id uuid not null references carts(id) on delete cascade,
  shoe_id uuid not null references shoes(id) on delete cascade,
  variant_id uuid references product_variants(id) on delete set null,
  quantity integer not null default 1 check (quantity > 0),
  unit_price integer not null check (unit_price >= 0),
  size text,
  color text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists cart_items_unique_selection
on cart_items (
  cart_id,
  shoe_id,
  coalesce(variant_id, '00000000-0000-0000-0000-000000000000'::uuid),
  coalesce(size, ''),
  coalesce(color, '')
);

create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid not null references auth.users(id) on delete restrict,

  status text not null default 'pending'
    check (
      status in (
        'pending',
        'confirmed',
        'packed',
        'out_for_delivery',
        'delivered',
        'cancelled'
      )
    ),

  subtotal integer not null check (subtotal >= 0),
  delivery_fee integer not null default 0 check (delivery_fee >= 0),
  total integer not null check (total >= 0),

  currency text not null default 'UGX',

  delivery_name text not null,
  delivery_phone text not null,
  delivery_area text not null,
  delivery_address text not null,
  delivery_notes text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,

  shoe_id uuid not null references shoes(id) on delete restrict,
  shop_id uuid not null references shops(id) on delete restrict,
  variant_id uuid references product_variants(id) on delete set null,

  product_title text not null,
  product_photo_url text,

  size text,
  color text,
  quantity integer not null check (quantity > 0),

  unit_price integer not null check (unit_price >= 0),
  line_total integer not null check (line_total >= 0),

  created_at timestamptz not null default now()
);

create table if not exists payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,

  method text not null
    check (
      method in (
        'mtn_mobile_money',
        'airtel_money',
        'cash_on_delivery'
      )
    ),

  status text not null default 'pending'
    check (
      status in (
        'pending',
        'processing',
        'paid',
        'failed',
        'cancelled'
      )
    ),

  amount integer not null check (amount >= 0),
  currency text not null default 'UGX',

  phone text,
  provider_reference text,
  failure_reason text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique(order_id)
);

create table if not exists deliveries (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,

  status text not null default 'pending'
    check (
      status in (
        'pending',
        'confirmed',
        'packed',
        'out_for_delivery',
        'delivered',
        'cancelled'
      )
    ),

  courier_name text,
  courier_phone text,
  tracking_reference text,

  confirmed_at timestamptz,
  packed_at timestamptz,
  out_for_delivery_at timestamptz,
  delivered_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique(order_id)
);

create index if not exists carts_user_id_idx
on carts(user_id);

create index if not exists cart_items_cart_id_idx
on cart_items(cart_id);

create index if not exists cart_items_shoe_id_idx
on cart_items(shoe_id);

create index if not exists orders_buyer_id_idx
on orders(buyer_id);

create index if not exists orders_status_idx
on orders(status);

create index if not exists order_items_order_id_idx
on order_items(order_id);

create index if not exists order_items_shop_id_idx
on order_items(shop_id);

create index if not exists payments_order_id_idx
on payments(order_id);

create index if not exists payments_status_idx
on payments(status);

create index if not exists deliveries_order_id_idx
on deliveries(order_id);

-- Enable RLS
alter table carts enable row level security;
alter table cart_items enable row level security;
alter table orders enable row level security;
alter table order_items enable row level security;
alter table payments enable row level security;
alter table deliveries enable row level security;

-- Cart policies
create policy "users manage own carts"
on carts
for all
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "users manage own cart items"
on cart_items
for all
to authenticated
using (
  exists (
    select 1
    from carts
    where carts.id = cart_items.cart_id
      and carts.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from carts
    where carts.id = cart_items.cart_id
      and carts.user_id = auth.uid()
  )
);

-- Buyers can view their own orders
create policy "buyers view own orders"
on orders
for select
to authenticated
using (buyer_id = auth.uid());

-- Buyers can view their own order items
create policy "buyers view own order items"
on order_items
for select
to authenticated
using (
  exists (
    select 1
    from orders
    where orders.id = order_items.order_id
      and orders.buyer_id = auth.uid()
  )
);

-- Buyers can view their own payments
create policy "buyers view own payments"
on payments
for select
to authenticated
using (
  exists (
    select 1
    from orders
    where orders.id = payments.order_id
      and orders.buyer_id = auth.uid()
  )
);

-- Buyers can view their own deliveries
create policy "buyers view own deliveries"
on deliveries
for select
to authenticated
using (
  exists (
    select 1
    from orders
    where orders.id = deliveries.order_id
      and orders.buyer_id = auth.uid()
  )
);

-- Sellers can see order items belonging to their shops
create policy "sellers view shop order items"
on order_items
for select
to authenticated
using (
  exists (
    select 1
    from shops
    where shops.id = order_items.shop_id
      and shops.owner_id = auth.uid()
  )
);

-- Sellers can view orders containing their products
create policy "sellers view shop orders"
on orders
for select
to authenticated
using (
  exists (
    select 1
    from order_items
    join shops on shops.id = order_items.shop_id
    where order_items.order_id = orders.id
      and shops.owner_id = auth.uid()
  )
);

-- Sellers can view payments for their orders
create policy "sellers view shop payments"
on payments
for select
to authenticated
using (
  exists (
    select 1
    from order_items
    join shops on shops.id = order_items.shop_id
    join orders on orders.id = order_items.order_id
    where orders.id = payments.order_id
      and shops.owner_id = auth.uid()
  )
);

-- Sellers can view delivery records for their orders
create policy "sellers view shop deliveries"
on deliveries
for select
to authenticated
using (
  exists (
    select 1
    from order_items
    join shops on shops.id = order_items.shop_id
    join orders on orders.id = deliveries.order_id
    where orders.id = deliveries.order_id
      and shops.owner_id = auth.uid()
  )
);
