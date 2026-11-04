-- TR3S & CO. — core schema
-- Target: Supabase (PostgreSQL 15+). Run with the Supabase SQL editor or `supabase db push`.
-- Money is stored as integer COP pesos (no decimals in COP retail).

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
do $$ begin
  create type gender as enum ('men', 'women', 'unisex');
  create type order_status as enum (
    'pending_payment',   -- Wompi checkout started, stock reserved
    'awaiting_transfer', -- bank transfer chosen, stock reserved
    'paid',              -- transitional, set by payment confirmation
    'awaiting_supplier', -- paid, contains on-order items not yet confirmed by supplier
    'preparing',
    'shipped',
    'delivered',
    'cancelled',
    'incident'
  );
  create type fulfillment_type as enum ('own', 'on_order');
  create type movement_type as enum ('entry', 'exit', 'adjustment', 'reservation', 'release', 'sale', 'return');
  create type payment_status as enum ('pending', 'approved', 'declined', 'voided', 'error');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- Users & roles (auth.users is managed by Supabase Auth)
-- ---------------------------------------------------------------------------
create table if not exists roles (
  id text primary key check (id in ('admin', 'sales', 'inventory')),
  description text not null
);
insert into roles (id, description) values
  ('admin', 'Acceso total: configuración, catálogo, precios, roles'),
  ('sales', 'Pedidos, pagos, envíos y clientes'),
  ('inventory', 'Inventario, proveedores y productos')
on conflict (id) do nothing;

create table if not exists user_roles (
  user_id uuid not null references auth.users(id) on delete cascade,
  role_id text not null references roles(id),
  created_at timestamptz not null default now(),
  primary key (user_id, role_id)
);

create table if not exists customers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references auth.users(id) on delete set null,
  email text not null,
  first_name text not null,
  last_name text not null,
  phone text not null,
  department text,
  city text,
  address text,
  notes text,               -- staff observations
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint customers_email_chk check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$')
);
create unique index if not exists customers_email_uq on customers (lower(email));

-- ---------------------------------------------------------------------------
-- Catalog
-- ---------------------------------------------------------------------------
create table if not exists brands (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]+$'),
  name text not null,
  description text,
  logo_url text,
  is_active boolean not null default true,
  is_demo boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]+$'),
  name text not null,
  position int not null default 0
);

create table if not exists suppliers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  legal_name text,
  tax_id text,              -- NIT
  contact_name text,
  phone text,
  email text,
  city text,
  conditions text,          -- payment terms, minimums, returns
  catalog_url text,
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]+$'),
  name text not null,
  reference text not null,
  brand_id uuid not null references brands(id),
  category_id uuid not null references categories(id),
  gender gender not null default 'unisex',
  shoe_type text not null default 'sneaker',
  description text not null default '',
  materials text,
  price integer not null check (price > 0),
  compare_at_price integer,
  is_new boolean not null default false,
  is_active boolean not null default false,
  is_demo boolean not null default false,
  model_url text,
  concept_colorway jsonb,
  featured_rank int,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- a "discount" is only valid if it is a real reduction
  constraint products_compare_at_chk check (compare_at_price is null or compare_at_price > price)
);
create index if not exists products_brand_idx on products (brand_id);
create index if not exists products_category_idx on products (category_id);
create index if not exists products_active_idx on products (is_active, featured_rank);

create table if not exists product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  url text not null,
  alt text not null default '',
  position int not null default 0
);
create index if not exists product_images_product_idx on product_images (product_id, position);

create table if not exists product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  sku text not null unique,
  size text not null,
  color text not null,
  color_hex text check (color_hex is null or color_hex ~ '^#[0-9A-Fa-f]{6}$'),
  price integer check (price is null or price > 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (product_id, size, color)
);
create index if not exists product_variants_product_idx on product_variants (product_id);

-- Own physical inventory. One row per variant and location.
create table if not exists inventory (
  id uuid primary key default gen_random_uuid(),
  variant_id uuid not null references product_variants(id) on delete cascade,
  location text not null default 'bodega-principal',
  quantity integer not null default 0 check (quantity >= 0),
  reserved integer not null default 0 check (reserved >= 0),
  unit_cost integer check (unit_cost is null or unit_cost >= 0),
  entered_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (variant_id, location),
  constraint inventory_reserved_chk check (reserved <= quantity)
);

-- Supplier-reported availability. Never summed with own inventory.
create table if not exists supplier_stock (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid not null references suppliers(id) on delete cascade,
  variant_id uuid not null references product_variants(id) on delete cascade,
  supplier_sku text,
  supplier_cost integer not null check (supplier_cost >= 0),
  quantity_reported integer not null default 0 check (quantity_reported >= 0),
  is_available boolean not null default false,
  lead_time_days integer not null default 5 check (lead_time_days between 0 and 90),
  confirmed_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (supplier_id, variant_id)
);
create index if not exists supplier_stock_variant_idx on supplier_stock (variant_id);

create table if not exists supplier_confirmations (
  id uuid primary key default gen_random_uuid(),
  supplier_stock_id uuid not null references supplier_stock(id) on delete cascade,
  order_item_id uuid,
  quantity_reported integer not null check (quantity_reported >= 0),
  is_available boolean not null,
  notes text,
  confirmed_by uuid references auth.users(id),
  confirmed_at timestamptz not null default now()
);

create table if not exists inventory_movements (
  id bigint generated always as identity primary key,
  variant_id uuid not null references product_variants(id),
  location text not null,
  type movement_type not null,
  quantity integer not null check (quantity <> 0),
  unit_cost integer,
  order_id uuid,
  note text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);
create index if not exists inventory_movements_variant_idx on inventory_movements (variant_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Settings & campaigns
-- ---------------------------------------------------------------------------
create table if not exists store_settings (
  id int primary key default 1 check (id = 1),
  whatsapp_number text check (whatsapp_number is null or whatsapp_number ~ '^[0-9]{10,15}$'),
  shipping_flat_rate integer not null default 15000 check (shipping_flat_rate >= 0),
  free_shipping_from integer check (free_shipping_from is null or free_shipping_from > 0),
  bank_transfer_instructions text,
  payment_wompi_enabled boolean not null default true,
  payment_transfer_enabled boolean not null default true,
  supplier_confirmation_max_age_days integer not null default 7 check (supplier_confirmation_max_age_days between 1 and 60),
  low_stock_threshold integer not null default 2,
  contact_email text,
  contact_phone text,
  address text,
  instagram_url text,
  tiktok_url text,
  updated_at timestamptz not null default now()
);
insert into store_settings (id) values (1) on conflict (id) do nothing;

create table if not exists homepage_campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  headline text[] not null default array['YOUR STYLE.', 'YOUR MOVE.'],
  subheadline text not null default 'FIND YOUR NEXT STEP.',
  monumental_words text[] not null default array['TR3S', 'STYLE', 'ATTITUDE', 'MOVE'],
  product_ids uuid[] not null default '{}',
  fallback_image_url text,
  model_url text,
  banner_image_url text,
  banner_link text,
  is_active boolean not null default false,
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists coupons (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code = upper(code)),
  kind text not null check (kind in ('percent', 'fixed')),
  value integer not null check (value > 0),
  min_subtotal integer not null default 0,
  max_uses integer,
  used_count integer not null default 0,
  starts_at timestamptz,
  ends_at timestamptz,
  is_active boolean not null default true,
  constraint coupons_percent_chk check (kind <> 'percent' or value <= 90)
);

create table if not exists promotions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  product_id uuid references products(id) on delete cascade,
  previous_price integer,
  promo_price integer,
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  is_active boolean not null default true,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Orders, payments, shipments
-- ---------------------------------------------------------------------------
create sequence if not exists order_number_seq start 1001;

create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  number text not null unique,
  customer_id uuid not null references customers(id),
  user_id uuid references auth.users(id),
  email text not null,
  phone text not null,
  first_name text not null,
  last_name text not null,
  department text not null,
  city text not null,
  address text not null,
  address_notes text,
  status order_status not null default 'pending_payment',
  payment_method text not null check (payment_method in ('wompi', 'transfer')),
  subtotal integer not null check (subtotal >= 0),
  shipping integer not null check (shipping >= 0),
  discount integer not null default 0 check (discount >= 0),
  total integer not null check (total >= 0),
  coupon_code text,
  -- where the order's stock currently stands: reserved -> sold | released
  stock_state text not null default 'reserved' check (stock_state in ('reserved', 'sold', 'released')),
  idempotency_key text not null unique,
  reservation_expires_at timestamptz,
  paid_at timestamptz,
  cancelled_at timestamptz,
  staff_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists orders_status_idx on orders (status, created_at desc);
create index if not exists orders_customer_idx on orders (customer_id);
create index if not exists orders_expiry_idx on orders (reservation_expires_at) where status in ('pending_payment', 'awaiting_transfer');

create table if not exists order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  variant_id uuid not null references product_variants(id),
  product_name text not null,
  brand_name text not null,
  sku text not null,
  size text not null,
  color text not null,
  unit_price integer not null check (unit_price > 0),
  quantity integer not null check (quantity between 1 and 10),
  fulfillment_type fulfillment_type not null,
  location text,                 -- own stock location reserved
  supplier_stock_id uuid references supplier_stock(id),
  unit_cost integer,
  lead_time_days integer,
  supplier_confirmed_at timestamptz
);
create index if not exists order_items_order_idx on order_items (order_id);
alter table supplier_confirmations
  drop constraint if exists supplier_confirmations_order_item_fk,
  add constraint supplier_confirmations_order_item_fk foreign key (order_item_id) references order_items(id) on delete set null;
alter table inventory_movements
  drop constraint if exists inventory_movements_order_fk,
  add constraint inventory_movements_order_fk foreign key (order_id) references orders(id) on delete set null;

create table if not exists payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id),
  provider text not null check (provider in ('wompi', 'transfer')),
  transaction_id text,
  status payment_status not null default 'pending',
  amount integer not null,
  raw jsonb,
  verified_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  unique (provider, transaction_id)
);
create index if not exists payments_order_idx on payments (order_id);

create table if not exists webhook_events (
  id bigint generated always as identity primary key,
  provider text not null,
  event_key text not null,
  payload jsonb not null,
  received_at timestamptz not null default now(),
  unique (provider, event_key)
);

create table if not exists shipments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references orders(id) on delete cascade,
  carrier text not null,
  tracking_number text not null,
  shipped_at timestamptz not null default now(),
  delivered_at timestamptz,
  notes text
);

create table if not exists order_events (
  id bigint generated always as identity primary key,
  order_id uuid not null references orders(id) on delete cascade,
  status order_status,
  note text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);
create index if not exists order_events_order_idx on order_events (order_id, created_at);

-- ---------------------------------------------------------------------------
-- Wishlists
-- ---------------------------------------------------------------------------
create table if not exists wishlists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
create table if not exists wishlist_items (
  wishlist_id uuid not null references wishlists(id) on delete cascade,
  product_id uuid not null references products(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (wishlist_id, product_id)
);

-- ---------------------------------------------------------------------------
-- Audit
-- ---------------------------------------------------------------------------
create table if not exists audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid,
  action text not null,
  entity text not null,
  entity_id text,
  data jsonb,
  created_at timestamptz not null default now()
);
create index if not exists audit_logs_entity_idx on audit_logs (entity, created_at desc);
