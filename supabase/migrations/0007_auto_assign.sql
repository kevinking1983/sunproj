-- Automatic rider assignment.
--
-- When an order starts packing (or becomes ready without a rider), the nearest idle online
-- rider near the store is assigned, so the rider walks in as the bag is sealed. A rider can
-- decline before pickup; the order then goes to the next rider and never back to them.
-- If nobody is free, the order stays in the pool and is assigned as soon as a rider comes
-- online or finishes a delivery. Riders can still claim from the pool and staff can still
-- assign by hand; both paths are unchanged.

alter table public.stores
  add column auto_assign_riders boolean not null default true,
  -- How far from the store a rider may be to get an order automatically.
  add column assign_radius_m integer not null default 5000 check (assign_radius_m > 0);

-- Riders who turned an order down; they are never offered it again.
create table public.order_rider_declines (
  order_id uuid not null references public.orders (id) on delete cascade,
  rider_id uuid not null references public.profiles (id) on delete cascade,
  reason text,
  created_at timestamptz not null default now(),
  primary key (order_id, rider_id)
);
alter table public.order_rider_declines enable row level security;
create policy "order_rider_declines staff read" on public.order_rider_declines for select using (public.is_staff());

-- Statuses in which an order occupies its rider.
create or replace function public.rider_busy_statuses()
returns public.order_status[] language sql immutable as $$
  select array['accepted', 'packing', 'ready', 'picked_up', 'out_for_delivery']::public.order_status[];
$$;

-- Assigns the best rider to one order, or does nothing. Returns the rider, or null.
-- Candidates: role rider, online, location reported in the last 10 minutes (the partner
-- app sends a heartbeat every minute while open), within the store's assignment radius
-- (or its service radius if that is larger), no unfinished order, never declined this
-- order. Nearest first; ties go to whoever has delivered least today.
create or replace function public.auto_assign_rider(p_order_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders%rowtype;
  v_store public.stores%rowtype;
  v_rider uuid;
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if not found or v_order.rider_id is not null or v_order.status not in ('packing', 'ready') then
    return null;
  end if;
  select * into v_store from public.stores where id = v_order.store_id;
  if not v_store.auto_assign_riders then
    return null;
  end if;

  select rl.rider_id into v_rider
  from public.rider_locations rl
  join public.profiles p on p.id = rl.rider_id and p.role = 'rider'
  where rl.is_online
    and rl.updated_at > now() - interval '10 minutes'
    and extensions.st_dwithin(rl.location, v_store.location, greatest(v_store.assign_radius_m, v_store.service_radius_m))
    and not exists (select 1 from public.orders o where o.rider_id = rl.rider_id and o.status = any (public.rider_busy_statuses()))
    and not exists (select 1 from public.order_rider_declines d where d.order_id = p_order_id and d.rider_id = rl.rider_id)
  order by extensions.st_distance(rl.location, v_store.location),
           (select count(*) from public.orders o where o.rider_id = rl.rider_id and o.delivered_at >= date_trunc('day', now()))
  limit 1
  -- Two orders assigned at the same moment must not pick the same rider.
  for update of rl skip locked;

  if v_rider is null then
    return null;
  end if;
  update public.orders set rider_id = v_rider where id = p_order_id;
  perform public.append_order_event(p_order_id, v_order.status, 'Rider assigned automatically', null);
  return v_rider;
end;
$$;

-- Offers every waiting order, oldest first, to the free riders. Called when a rider comes
-- online, finishes a delivery or declines. Returns how many orders got a rider.
create or replace function public.assign_waiting_orders()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_assigned integer := 0;
begin
  for v_id in
    select id from public.orders
    where rider_id is null and status in ('packing', 'ready')
    order by created_at
    limit 50
  loop
    if public.auto_assign_rider(v_id) is not null then
      v_assigned := v_assigned + 1;
    end if;
  end loop;
  return v_assigned;
end;
$$;

-- Packing started, or the order is ready and still has nobody: find a rider.
create or replace function public.orders_auto_assign_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.rider_id is null and new.status in ('packing', 'ready') and new.status is distinct from old.status then
    perform public.auto_assign_rider(new.id);
  end if;
  -- A finished delivery frees its rider for the next waiting order.
  if old.rider_id is not null and new.status in ('delivered', 'cancelled') and new.status is distinct from old.status then
    perform public.assign_waiting_orders();
  end if;
  return null;
end;
$$;

create trigger orders_auto_assign after update of status on public.orders
  for each row execute function public.orders_auto_assign_trigger();

-- A rider turns down an order assigned to them, before picking it up.
create or replace function public.rider_decline_order(p_order_id uuid, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status public.order_status;
begin
  if public.current_role() <> 'rider' then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;
  select status into v_status from public.orders where id = p_order_id and rider_id = auth.uid() for update;
  if not found then
    raise exception 'ORDER_NOT_FOUND' using errcode = 'P0001';
  end if;
  if v_status not in ('accepted', 'packing', 'ready') then
    raise exception 'ALREADY_PICKED_UP' using errcode = 'P0001';
  end if;
  insert into public.order_rider_declines (order_id, rider_id, reason) values (p_order_id, auth.uid(), nullif(trim(p_reason), ''))
    on conflict do nothing;
  update public.orders set rider_id = null where id = p_order_id;
  perform public.append_order_event(p_order_id, v_status, 'Rider declined', auth.uid());
  perform public.auto_assign_rider(p_order_id);
end;
$$;

-- Going online now also picks up any order that has been waiting for a rider.
create or replace function public.rider_set_online(p_online boolean, p_lat double precision default null, p_lng double precision default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.current_role() <> 'rider' then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;
  if p_lat is not null and p_lng is not null then
    insert into public.rider_locations (rider_id, lat, lng, is_online)
    values (auth.uid(), p_lat, p_lng, p_online)
    on conflict (rider_id) do update set lat = excluded.lat, lng = excluded.lng, is_online = excluded.is_online, updated_at = now();
  else
    update public.rider_locations set is_online = p_online, updated_at = now() where rider_id = auth.uid();
    if not found and p_online then
      raise exception 'LOCATION_REQUIRED' using errcode = 'P0001';
    end if;
  end if;
  if p_online then
    perform public.assign_waiting_orders();
  end if;
end;
$$;

-- Riders now see orders assigned to them while packing, so they can head to the store.
-- rider_claim_order counts those too, so a rider cannot stack a pool claim on top.
create or replace function public.rider_claim_order(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_active integer;
begin
  if public.current_role() <> 'rider' then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;
  select count(*) into v_active from public.orders where rider_id = auth.uid() and status = any (public.rider_busy_statuses());
  if v_active >= 3 then
    raise exception 'TOO_MANY_ACTIVE' using errcode = 'P0001';
  end if;
  update public.orders set rider_id = auth.uid() where id = p_order_id and rider_id is null and status = 'ready';
  if not found then
    raise exception 'ORDER_ALREADY_TAKEN' using errcode = 'P0001';
  end if;
  perform public.append_order_event(p_order_id, 'ready', 'Rider accepted', auth.uid());
end;
$$;

revoke execute on function public.auto_assign_rider(uuid) from public, anon, authenticated;
revoke execute on function public.assign_waiting_orders() from public, anon, authenticated;
revoke execute on function public.orders_auto_assign_trigger() from public, anon, authenticated;
grant execute on function public.rider_decline_order(uuid, text) to authenticated;
