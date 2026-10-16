-- Delivery partner (rider) features: availability, self-claim from the ready pool,
-- status progression on own orders, and an earnings summary.

alter table public.rider_locations add column is_online boolean not null default false;

-- Riders may read unassigned ready orders (the pool) in addition to their own.
create policy "orders rider pool read" on public.orders for select
  using (public.current_role() = 'rider' and rider_id is null and status = 'ready');
create policy "order_items rider pool read" on public.order_items for select
  using (exists (select 1 from public.orders o where o.id = order_id and public.current_role() = 'rider' and o.rider_id is null and o.status = 'ready'));

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
end;
$$;

-- A rider takes an unassigned ready order. First writer wins.
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
  select count(*) into v_active from public.orders where rider_id = auth.uid() and status in ('picked_up', 'out_for_delivery');
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

-- Rider-side transitions on own orders only: ready -> picked_up -> out_for_delivery -> delivered.
create or replace function public.rider_advance_order(p_order_id uuid, p_status public.order_status, p_note text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current public.order_status;
begin
  if public.current_role() <> 'rider' then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;
  select status into v_current from public.orders where id = p_order_id and rider_id = auth.uid() for update;
  if not found then
    raise exception 'ORDER_NOT_FOUND' using errcode = 'P0001';
  end if;
  if not ((v_current = 'ready' and p_status = 'picked_up')
       or (v_current = 'picked_up' and p_status = 'out_for_delivery')
       or (v_current = 'out_for_delivery' and p_status = 'delivered')) then
    raise exception 'INVALID_TRANSITION' using errcode = 'P0001';
  end if;
  perform public.advance_order(p_order_id, p_status, auth.uid(), p_note);
end;
$$;

-- Today's numbers for the rider home screen.
create or replace function public.rider_summary()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select case when public.current_role() = 'rider' then jsonb_build_object(
    'delivered_today', (select count(*) from public.orders where rider_id = auth.uid() and delivered_at >= date_trunc('day', now())),
    'tips_today', (select coalesce(sum(tip), 0) from public.orders where rider_id = auth.uid() and delivered_at >= date_trunc('day', now())),
    'cod_collected_today', (select coalesce(sum(total), 0) from public.orders where rider_id = auth.uid() and payment_method = 'cod' and delivered_at >= date_trunc('day', now())),
    'delivered_total', (select count(*) from public.orders where rider_id = auth.uid() and status = 'delivered'),
    'is_online', coalesce((select is_online from public.rider_locations where rider_id = auth.uid()), false)
  ) else null end;
$$;
