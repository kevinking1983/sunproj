-- Staff-facing RPCs for the admin panel. Callable by authenticated users but every
-- function checks public.is_staff() (store_staff or admin) before acting.

create or replace function public.staff_advance_order(p_order_id uuid, p_status public.order_status, p_note text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_staff() then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;
  if p_status in ('cancelled', 'refunded', 'pending_payment') then
    raise exception 'INVALID_TRANSITION' using errcode = 'P0001';
  end if;
  perform public.advance_order(p_order_id, p_status, auth.uid(), p_note);
end;
$$;

create or replace function public.staff_cancel_order(p_order_id uuid, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_staff() then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;
  return public.cancel_order(p_order_id, auth.uid(), coalesce(p_reason, 'Cancelled by store'), false);
end;
$$;

create or replace function public.staff_assign_rider(p_order_id uuid, p_rider_id uuid default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_staff() then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;
  if p_rider_id is not null and not exists (select 1 from public.profiles where id = p_rider_id and role = 'rider') then
    raise exception 'NOT_A_RIDER' using errcode = 'P0001';
  end if;
  update public.orders set rider_id = p_rider_id where id = p_order_id;
  if not found then
    raise exception 'ORDER_NOT_FOUND' using errcode = 'P0001';
  end if;
  perform public.append_order_event(p_order_id, (select status from public.orders where id = p_order_id),
    case when p_rider_id is null then 'Rider unassigned' else 'Rider assigned' end, auth.uid());
end;
$$;

create or replace function public.staff_set_stock(p_store_id uuid, p_product_id uuid, p_quantity integer, p_price_override bigint default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_staff() then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;
  if p_quantity < 0 then
    raise exception 'INVALID_QUANTITY' using errcode = 'P0001';
  end if;
  insert into public.inventory (store_id, product_id, quantity, price_override)
  values (p_store_id, p_product_id, p_quantity, p_price_override)
  on conflict (store_id, product_id) do update
    set quantity = excluded.quantity, price_override = excluded.price_override, updated_at = now();
end;
$$;

-- Only admins may change roles, and nobody can demote the last admin.
create or replace function public.staff_set_role(p_user_id uuid, p_role public.user_role)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.current_role() <> 'admin' then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;
  if p_role <> 'admin' and (select role from public.profiles where id = p_user_id) = 'admin'
     and (select count(*) from public.profiles where role = 'admin') <= 1 then
    raise exception 'LAST_ADMIN' using errcode = 'P0001';
  end if;
  update public.profiles set role = p_role where id = p_user_id;
end;
$$;

-- Riders update their own live location; customers read it through the existing policy.
create or replace function public.rider_update_location(p_lat double precision, p_lng double precision, p_heading real default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.current_role() <> 'rider' then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;
  insert into public.rider_locations (rider_id, lat, lng, heading)
  values (auth.uid(), p_lat, p_lng, p_heading)
  on conflict (rider_id) do update set lat = excluded.lat, lng = excluded.lng, heading = excluded.heading, updated_at = now();
end;
$$;

-- Dashboard numbers for the admin home.
create or replace function public.staff_dashboard(p_store_id uuid default null)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select case when public.is_staff() then jsonb_build_object(
    'active_orders', (select count(*) from public.orders where status in ('placed','accepted','packing','ready','picked_up','out_for_delivery') and (p_store_id is null or store_id = p_store_id)),
    'orders_today', (select count(*) from public.orders where created_at >= date_trunc('day', now()) and status not in ('cancelled','pending_payment') and (p_store_id is null or store_id = p_store_id)),
    'revenue_today', (select coalesce(sum(total), 0) from public.orders where created_at >= date_trunc('day', now()) and status not in ('cancelled','pending_payment','refunded') and (p_store_id is null or store_id = p_store_id)),
    'delivered_today', (select count(*) from public.orders where delivered_at >= date_trunc('day', now()) and (p_store_id is null or store_id = p_store_id)),
    'low_stock', (select count(*) from public.inventory where quantity - reserved <= 5 and (p_store_id is null or store_id = p_store_id)),
    'customers', (select count(*) from public.profiles where role = 'customer')
  ) else null end;
$$;

-- Staff may read every address for support; admins may credit wallets manually.
create policy "addresses staff read" on public.addresses for select using (public.is_staff());
create policy "wallet staff insert" on public.wallet_transactions for insert with check (public.current_role() = 'admin');
