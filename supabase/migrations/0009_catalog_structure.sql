-- Catalog structure for the full assortment: department -> category -> subcategory tree
-- (categories.parent_id, already present), products shown on several shelves, products
-- that are listed but not yet orderable, and credits for openly licensed images.

alter table public.categories
  add column description text,
  -- Short emoji or icon key shown when a category has no image yet.
  add column icon text;

alter table public.products
  -- false = listed with a "Coming soon" label; orders are refused (e.g. meat until the
  -- licence and cold chain are confirmed).
  add column orderable boolean not null default true,
  -- Attribution for openly licensed images ("Photo: Jane Doe, CC BY-SA 4.0, Wikimedia Commons").
  add column image_credit text;

-- A product sits on one primary shelf (products.category_id) and may also appear on others,
-- for example eggs under both Dairy and Meat. Stock stays per product, so it is never
-- double counted.
create table public.product_categories (
  product_id uuid not null references public.products (id) on delete cascade,
  category_id uuid not null references public.categories (id) on delete cascade,
  sort_order integer not null default 0,
  primary key (product_id, category_id)
);
create index product_categories_category_idx on public.product_categories (category_id, sort_order);
alter table public.product_categories enable row level security;
create policy "product_categories public read" on public.product_categories for select using (true);
create policy "product_categories staff write" on public.product_categories for all using (public.is_staff()) with check (public.is_staff());

-- Keep the primary shelf in the join table whenever a product is created or moved.
create or replace function public.products_sync_primary_category()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' and old.category_id is distinct from new.category_id then
    delete from public.product_categories where product_id = new.id and category_id = old.category_id;
  end if;
  insert into public.product_categories (product_id, category_id) values (new.id, new.category_id)
    on conflict do nothing;
  return null;
end;
$$;
create trigger products_sync_primary_category after insert or update of category_id on public.products
  for each row execute function public.products_sync_primary_category();
insert into public.product_categories (product_id, category_id) select id, category_id from public.products on conflict do nothing;

-- Orders may only contain orderable products. place_order inserts order_items, so the
-- check lives here and covers every path that creates an order.
create or replace function public.order_items_check_orderable()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_name text;
begin
  select name into v_name from public.products where id = new.product_id and not orderable;
  if found then
    raise exception 'NOT_ORDERABLE:%', v_name using errcode = 'P0001';
  end if;
  return new;
end;
$$;
create trigger order_items_check_orderable before insert on public.order_items
  for each row execute function public.order_items_check_orderable();

-- Search also matches brand names ("amul", "tata") and returns the orderable flag.
drop function if exists public.search_products(uuid, text, integer);
create function public.search_products(p_store_id uuid, p_query text, p_limit integer default 40)
returns table (
  id uuid, slug text, name text, description text, unit_label text, mrp bigint, price bigint,
  images text[], is_veg boolean, category_id uuid, brand_name text, available integer, orderable boolean, rank real
)
language sql
stable
as $$
  with q as (
    select trim(p_query) as raw, websearch_to_tsquery('simple', trim(p_query)) as tsq
  )
  select p.id, p.slug, p.name, p.description, p.unit_label, p.mrp,
         coalesce(i.price_override, p.price) as price,
         p.images, p.is_veg, p.category_id, b.name as brand_name,
         greatest(0, i.quantity - i.reserved) as available,
         p.orderable,
         (ts_rank(p.search_text, q.tsq) + extensions.similarity(p.name, q.raw)
          + case when b.name ilike q.raw || '%' then 0.3 else 0 end)::real as rank
  from public.products p
  join public.inventory i on i.product_id = p.id and i.store_id = p_store_id
  left join public.brands b on b.id = p.brand_id
  cross join q
  where p.is_active
    and (p.search_text @@ q.tsq or p.name operator(extensions.%) q.raw or p.name ilike '%' || q.raw || '%'
         or b.name ilike '%' || q.raw || '%')
  order by rank desc, p.name
  limit p_limit;
$$;
grant execute on function public.search_products(uuid, text, integer) to anon, authenticated;
