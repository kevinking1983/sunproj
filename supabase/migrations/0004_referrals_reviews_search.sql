-- Referral rewards, review eligibility and ranked search.

-- ---------------------------------------------------------------------------
-- Referral: ₹50 to both sides when the referred user's first order is delivered.
-- ---------------------------------------------------------------------------
create or replace function public.apply_referral_code(p_code text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_referrer uuid;
begin
  if auth.uid() is null then return false; end if;
  select id into v_referrer from public.profiles where upper(referral_code) = upper(trim(p_code));
  if v_referrer is null or v_referrer = auth.uid() then return false; end if;
  update public.profiles set referred_by = v_referrer where id = auth.uid() and referred_by is null;
  return found;
end;
$$;

create or replace function public.reward_referral_on_delivery()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_referrer uuid;
  v_reward bigint := 5000;
begin
  if new.status <> 'delivered' or old.status = 'delivered' then return new; end if;
  select referred_by into v_referrer from public.profiles where id = new.user_id;
  if v_referrer is null then return new; end if;
  -- only the first delivered order counts
  if exists (select 1 from public.orders where user_id = new.user_id and status = 'delivered' and id <> new.id) then return new; end if;
  if exists (select 1 from public.wallet_transactions where kind = 'referral' and order_id = new.id) then return new; end if;

  update public.profiles set wallet_balance = wallet_balance + v_reward where id in (new.user_id, v_referrer);
  insert into public.wallet_transactions (user_id, amount, kind, order_id, note) values
    (new.user_id, v_reward, 'referral', new.id, 'Welcome reward for using a referral code'),
    (v_referrer, v_reward, 'referral', new.id, 'Reward for referring a friend');
  return new;
end;
$$;

create trigger orders_reward_referral after update of status on public.orders
  for each row execute function public.reward_referral_on_delivery();

-- ---------------------------------------------------------------------------
-- Reviews: only on delivered orders that contain the product.
-- ---------------------------------------------------------------------------
create or replace function public.check_review_eligibility()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.order_id is null then
    raise exception 'REVIEW_REQUIRES_ORDER' using errcode = 'P0001';
  end if;
  if not exists (
    select 1 from public.orders o join public.order_items oi on oi.order_id = o.id
    where o.id = new.order_id and o.user_id = new.user_id and o.status = 'delivered' and oi.product_id = new.product_id
  ) then
    raise exception 'REVIEW_NOT_ELIGIBLE' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger product_reviews_check before insert on public.product_reviews
  for each row execute function public.check_review_eligibility();

alter table public.products add column rating_avg numeric(3,2), add column rating_count integer not null default 0;

create or replace function public.refresh_product_rating()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_product uuid := coalesce(new.product_id, old.product_id);
begin
  update public.products p
     set rating_avg = sub.avg, rating_count = sub.cnt
    from (select round(avg(rating)::numeric, 2) as avg, count(*) as cnt from public.product_reviews where product_id = v_product) sub
   where p.id = v_product;
  return null;
end;
$$;

create trigger product_reviews_refresh after insert or update or delete on public.product_reviews
  for each row execute function public.refresh_product_rating();

-- ---------------------------------------------------------------------------
-- Ranked search for a store: full-text match first, then trigram similarity.
-- ---------------------------------------------------------------------------
create or replace function public.search_products(p_store_id uuid, p_query text, p_limit integer default 40)
returns table (
  id uuid, slug text, name text, description text, unit_label text, mrp bigint, price bigint,
  images text[], is_veg boolean, category_id uuid, brand_name text, available integer, rank real
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
         (ts_rank(p.search_text, q.tsq) + extensions.similarity(p.name, q.raw))::real as rank
  from public.products p
  join public.inventory i on i.product_id = p.id and i.store_id = p_store_id
  left join public.brands b on b.id = p.brand_id
  cross join q
  where p.is_active
    and (p.search_text @@ q.tsq or p.name operator(extensions.%) q.raw or p.name ilike '%' || q.raw || '%')
  order by rank desc, p.name
  limit p_limit;
$$;
