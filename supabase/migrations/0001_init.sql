-- RATION core schema: identity, addresses, serviceability, catalog, cart, orders, payments.
-- Money is stored as integer paise. Every table has RLS enabled; policies are at the bottom.

create extension if not exists "postgis" with schema extensions;
create extension if not exists "pg_trgm" with schema extensions;

-- array_to_string is only STABLE, so a generated column cannot call it directly.
create or replace function public.immutable_array_to_text(arr text[])
returns text language sql immutable parallel safe as $$
  select coalesce(array_to_string(arr, ' '), '');
$$;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type public.order_status as enum (
  'pending_payment', 'placed', 'accepted', 'packing', 'ready',
  'picked_up', 'out_for_delivery', 'delivered', 'cancelled', 'refunded'
);

create type public.payment_method as enum ('upi', 'card', 'netbanking', 'wallet', 'cod', 'ration_wallet');

create type public.payment_status as enum (
  'created', 'authorized', 'captured', 'failed', 'refunded', 'partially_refunded'
);

create type public.address_label as enum ('home', 'work', 'other');

create type public.user_role as enum ('customer', 'rider', 'store_staff', 'admin');

-- ---------------------------------------------------------------------------
-- Identity
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  phone text unique,
  full_name text,
  email text,
  avatar_url text,
  role public.user_role not null default 'customer',
  referral_code text unique,
  referred_by uuid references public.profiles (id),
  wallet_balance bigint not null default 0 check (wallet_balance >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, phone, referral_code)
  values (
    new.id,
    new.phone,
    upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Dark stores and serviceability
-- ---------------------------------------------------------------------------
create table public.stores (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text not null unique,
  address text not null,
  location extensions.geography(point, 4326) not null,
  service_area extensions.geography(polygon, 4326),
  service_radius_m integer not null default 3000,
  is_open boolean not null default true,
  opens_at time not null default '06:00',
  closes_at time not null default '23:59',
  min_order_amount bigint not null default 9900,
  delivery_fee bigint not null default 2500,
  free_delivery_above bigint not null default 19900,
  promised_minutes integer not null default 15,
  created_at timestamptz not null default now()
);

create index stores_location_idx on public.stores using gist (location);

create table public.addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  label public.address_label not null default 'home',
  recipient_name text,
  recipient_phone text,
  line1 text not null,
  line2 text,
  landmark text,
  city text not null,
  state text not null,
  pincode text not null check (pincode ~ '^[1-9][0-9]{5}$'),
  location extensions.geography(point, 4326) not null,
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);

create index addresses_user_idx on public.addresses (user_id);

-- Nearest open store that serves a point, or null.
create or replace function public.find_serving_store(lat double precision, lng double precision)
returns public.stores
language sql
stable
as $$
  select s.*
  from public.stores s
  where s.is_open
    and (
      (s.service_area is not null and extensions.st_covers(s.service_area, extensions.st_point(lng, lat)::extensions.geography))
      or (s.service_area is null and extensions.st_dwithin(s.location, extensions.st_point(lng, lat)::extensions.geography, s.service_radius_m))
    )
  order by extensions.st_distance(s.location, extensions.st_point(lng, lat)::extensions.geography)
  limit 1;
$$;

-- ---------------------------------------------------------------------------
-- Catalog
-- ---------------------------------------------------------------------------
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid references public.categories (id) on delete cascade,
  name text not null,
  slug text not null unique,
  image_url text,
  sort_order integer not null default 0,
  is_active boolean not null default true
);

create table public.brands (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique,
  logo_url text
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.categories (id),
  brand_id uuid references public.brands (id),
  name text not null,
  slug text not null unique,
  description text,
  unit_label text not null,                  -- e.g. "500 g", "1 L", "6 pcs"
  mrp bigint not null check (mrp > 0),
  price bigint not null check (price > 0 and price <= mrp),
  tax_rate numeric(5,2) not null default 0,  -- GST % (price is tax inclusive)
  images text[] not null default '{}',
  tags text[] not null default '{}',
  is_veg boolean,
  is_active boolean not null default true,
  search_text tsvector generated always as (
    to_tsvector('simple', coalesce(name, '') || ' ' || coalesce(description, '') || ' ' || public.immutable_array_to_text(tags))
  ) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index products_category_idx on public.products (category_id);
create index products_search_idx on public.products using gin (search_text);
create index products_name_trgm_idx on public.products using gin (name extensions.gin_trgm_ops);

create table public.inventory (
  store_id uuid not null references public.stores (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  quantity integer not null default 0 check (quantity >= 0),
  reserved integer not null default 0 check (reserved >= 0),
  price_override bigint,
  updated_at timestamptz not null default now(),
  primary key (store_id, product_id)
);

create table public.banners (
  id uuid primary key default gen_random_uuid(),
  title text,
  image_url text not null,
  target_type text,                          -- 'category' | 'product' | 'url'
  target_id text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  starts_at timestamptz,
  ends_at timestamptz
);

-- ---------------------------------------------------------------------------
-- Coupons
-- ---------------------------------------------------------------------------
create table public.coupons (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  title text not null,
  description text,
  discount_type text not null check (discount_type in ('flat', 'percent', 'free_delivery')),
  discount_value bigint not null default 0,
  max_discount bigint,
  min_order_amount bigint not null default 0,
  per_user_limit integer not null default 1,
  total_limit integer,
  used_count integer not null default 0,
  first_order_only boolean not null default false,
  is_active boolean not null default true,
  starts_at timestamptz,
  ends_at timestamptz
);

-- ---------------------------------------------------------------------------
-- Cart
-- ---------------------------------------------------------------------------
create table public.carts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles (id) on delete cascade,
  store_id uuid references public.stores (id),
  coupon_id uuid references public.coupons (id),
  updated_at timestamptz not null default now()
);

create table public.cart_items (
  cart_id uuid not null references public.carts (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  quantity integer not null check (quantity > 0 and quantity <= 50),
  primary key (cart_id, product_id)
);

-- ---------------------------------------------------------------------------
-- Orders and payments
-- ---------------------------------------------------------------------------
create sequence public.order_number_seq start 100001;

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique default ('RT' || nextval('public.order_number_seq')::text),
  user_id uuid not null references public.profiles (id),
  store_id uuid not null references public.stores (id),
  address_snapshot jsonb not null,
  status public.order_status not null default 'pending_payment',
  payment_method public.payment_method not null,
  subtotal bigint not null,
  discount bigint not null default 0,
  delivery_fee bigint not null default 0,
  handling_fee bigint not null default 0,
  tip bigint not null default 0,
  total bigint not null,
  coupon_code text,
  promised_at timestamptz,
  delivered_at timestamptz,
  cancelled_at timestamptz,
  cancel_reason text,
  rider_id uuid references public.profiles (id),
  customer_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index orders_user_idx on public.orders (user_id, created_at desc);
create index orders_store_status_idx on public.orders (store_id, status);
create index orders_rider_idx on public.orders (rider_id) where rider_id is not null;

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  product_id uuid not null references public.products (id),
  name text not null,
  unit_label text not null,
  image_url text,
  quantity integer not null check (quantity > 0),
  unit_price bigint not null,
  mrp bigint not null,
  line_total bigint not null
);

create index order_items_order_idx on public.order_items (order_id);

create table public.order_events (
  id bigint generated always as identity primary key,
  order_id uuid not null references public.orders (id) on delete cascade,
  status public.order_status not null,
  note text,
  actor_id uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

create index order_events_order_idx on public.order_events (order_id, created_at);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  provider text not null default 'razorpay',
  provider_order_id text,
  provider_payment_id text unique,
  method public.payment_method not null,
  amount bigint not null,
  status public.payment_status not null default 'created',
  raw jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index payments_order_idx on public.payments (order_id);
create index payments_provider_order_idx on public.payments (provider_order_id);

create table public.refunds (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references public.payments (id),
  provider_refund_id text unique,
  amount bigint not null,
  reason text,
  status text not null default 'pending',
  created_at timestamptz not null default now()
);

create table public.wallet_transactions (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id),
  amount bigint not null,                    -- positive credit, negative debit
  kind text not null,                        -- 'refund' | 'referral' | 'cashback' | 'order_debit' | 'adjustment'
  order_id uuid references public.orders (id),
  note text,
  created_at timestamptz not null default now()
);

create index wallet_tx_user_idx on public.wallet_transactions (user_id, created_at desc);

create table public.rider_locations (
  rider_id uuid primary key references public.profiles (id) on delete cascade,
  location extensions.geography(point, 4326) not null,
  heading real,
  updated_at timestamptz not null default now()
);

create table public.product_reviews (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  order_id uuid references public.orders (id),
  rating smallint not null check (rating between 1 and 5),
  body text,
  created_at timestamptz not null default now(),
  unique (product_id, user_id, order_id)
);

create table public.push_tokens (
  user_id uuid not null references public.profiles (id) on delete cascade,
  token text not null,
  platform text not null check (platform in ('ios', 'android', 'web')),
  updated_at timestamptz not null default now(),
  primary key (user_id, token)
);

-- ---------------------------------------------------------------------------
-- updated_at maintenance
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array['profiles', 'products', 'inventory', 'carts', 'orders', 'payments']
  loop
    execute format('create trigger %I_set_updated_at before update on public.%I for each row execute function public.set_updated_at()', t, t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------
create or replace function public.current_role()
returns public.user_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.is_staff()
returns boolean language sql stable as $$
  select public.current_role() in ('store_staff', 'admin');
$$;

alter table public.profiles enable row level security;
alter table public.stores enable row level security;
alter table public.addresses enable row level security;
alter table public.categories enable row level security;
alter table public.brands enable row level security;
alter table public.products enable row level security;
alter table public.inventory enable row level security;
alter table public.banners enable row level security;
alter table public.coupons enable row level security;
alter table public.carts enable row level security;
alter table public.cart_items enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.order_events enable row level security;
alter table public.payments enable row level security;
alter table public.refunds enable row level security;
alter table public.wallet_transactions enable row level security;
alter table public.rider_locations enable row level security;
alter table public.product_reviews enable row level security;
alter table public.push_tokens enable row level security;

-- profiles: own row read/update; staff read all
create policy "profiles self read" on public.profiles for select using (id = auth.uid() or public.is_staff());
create policy "profiles self update" on public.profiles for update using (id = auth.uid()) with check (id = auth.uid() and role = (select role from public.profiles p where p.id = auth.uid()));

-- public catalog: anyone (including anon) can read active rows; staff manage
create policy "stores public read" on public.stores for select using (true);
create policy "categories public read" on public.categories for select using (is_active or public.is_staff());
create policy "brands public read" on public.brands for select using (true);
create policy "products public read" on public.products for select using (is_active or public.is_staff());
create policy "inventory public read" on public.inventory for select using (true);
create policy "banners public read" on public.banners for select using (is_active or public.is_staff());
create policy "coupons public read" on public.coupons for select using (is_active or public.is_staff());

create policy "stores staff write" on public.stores for all using (public.is_staff()) with check (public.is_staff());
create policy "categories staff write" on public.categories for all using (public.is_staff()) with check (public.is_staff());
create policy "brands staff write" on public.brands for all using (public.is_staff()) with check (public.is_staff());
create policy "products staff write" on public.products for all using (public.is_staff()) with check (public.is_staff());
create policy "inventory staff write" on public.inventory for all using (public.is_staff()) with check (public.is_staff());
create policy "banners staff write" on public.banners for all using (public.is_staff()) with check (public.is_staff());
create policy "coupons staff write" on public.coupons for all using (public.is_staff()) with check (public.is_staff());

-- addresses, carts, push tokens: owner only
create policy "addresses owner" on public.addresses for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "carts owner" on public.carts for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "cart_items owner" on public.cart_items for all
  using (exists (select 1 from public.carts c where c.id = cart_id and c.user_id = auth.uid()))
  with check (exists (select 1 from public.carts c where c.id = cart_id and c.user_id = auth.uid()));
create policy "push_tokens owner" on public.push_tokens for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- orders: customers read own; riders read assigned; staff read all. Writes go through edge functions (service role).
create policy "orders read" on public.orders for select
  using (user_id = auth.uid() or rider_id = auth.uid() or public.is_staff());
create policy "orders staff update" on public.orders for update using (public.is_staff()) with check (public.is_staff());
create policy "order_items read" on public.order_items for select
  using (exists (select 1 from public.orders o where o.id = order_id and (o.user_id = auth.uid() or o.rider_id = auth.uid() or public.is_staff())));
create policy "order_events read" on public.order_events for select
  using (exists (select 1 from public.orders o where o.id = order_id and (o.user_id = auth.uid() or o.rider_id = auth.uid() or public.is_staff())));
create policy "payments read" on public.payments for select
  using (exists (select 1 from public.orders o where o.id = order_id and (o.user_id = auth.uid() or public.is_staff())));
create policy "refunds read" on public.refunds for select
  using (exists (select 1 from public.payments p join public.orders o on o.id = p.order_id where p.id = payment_id and (o.user_id = auth.uid() or public.is_staff())));
create policy "wallet read" on public.wallet_transactions for select using (user_id = auth.uid() or public.is_staff());

-- rider locations: riders upsert their own; customers with an active order from that rider can read
create policy "rider_locations self write" on public.rider_locations for all using (rider_id = auth.uid()) with check (rider_id = auth.uid());
create policy "rider_locations customer read" on public.rider_locations for select
  using (
    public.is_staff() or rider_id = auth.uid() or exists (
      select 1 from public.orders o
      where o.rider_id = rider_locations.rider_id
        and o.user_id = auth.uid()
        and o.status in ('picked_up', 'out_for_delivery')
    )
  );

-- reviews: public read, owner write
create policy "reviews public read" on public.product_reviews for select using (true);
create policy "reviews owner write" on public.product_reviews for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Realtime: customers subscribe to their order rows and rider position
alter publication supabase_realtime add table public.orders, public.order_events, public.rider_locations;
