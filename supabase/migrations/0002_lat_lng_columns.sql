-- PostgREST returns geography as hex WKB, which is awkward for clients. Expose plain
-- lat/lng columns on addresses, stores and rider_locations and keep the geography
-- column in sync with a trigger so spatial queries keep working.

create or replace function public.sync_location_from_lat_lng()
returns trigger language plpgsql as $$
begin
  if new.lat is null or new.lng is null then
    raise exception 'lat and lng are required';
  end if;
  new.location := extensions.st_point(new.lng, new.lat)::extensions.geography;
  return new;
end;
$$;

alter table public.addresses
  add column lat double precision,
  add column lng double precision;
update public.addresses set lat = extensions.st_y(location::extensions.geometry), lng = extensions.st_x(location::extensions.geometry);
alter table public.addresses alter column lat set not null, alter column lng set not null;
create trigger addresses_sync_location before insert or update of lat, lng on public.addresses
  for each row execute function public.sync_location_from_lat_lng();

alter table public.stores
  add column lat double precision,
  add column lng double precision;
update public.stores set lat = extensions.st_y(location::extensions.geometry), lng = extensions.st_x(location::extensions.geometry);
alter table public.stores alter column lat set not null, alter column lng set not null;
create trigger stores_sync_location before insert or update of lat, lng on public.stores
  for each row execute function public.sync_location_from_lat_lng();

alter table public.rider_locations
  add column lat double precision,
  add column lng double precision;
update public.rider_locations set lat = extensions.st_y(location::extensions.geometry), lng = extensions.st_x(location::extensions.geometry);
alter table public.rider_locations alter column lat set not null, alter column lng set not null;
create trigger rider_locations_sync_location before insert or update of lat, lng on public.rider_locations
  for each row execute function public.sync_location_from_lat_lng();

-- Inserting through PostgREST will send lat/lng only, so location must be fillable by the trigger.
alter table public.addresses alter column location drop not null;
alter table public.stores alter column location drop not null;
alter table public.rider_locations alter column location drop not null;

-- Serviceability result that is safe to return to clients: no geography columns.
create or replace function public.serving_store(lat double precision, lng double precision)
returns table (
  id uuid, name text, code text, is_open boolean, promised_minutes integer,
  min_order_amount bigint, delivery_fee bigint, free_delivery_above bigint,
  opens_at time, closes_at time, distance_m double precision
)
language sql stable
as $$
  select s.id, s.name, s.code, s.is_open, s.promised_minutes,
         s.min_order_amount, s.delivery_fee, s.free_delivery_above,
         s.opens_at, s.closes_at,
         extensions.st_distance(s.location, extensions.st_point(lng, lat)::extensions.geography) as distance_m
  from public.find_serving_store(lat, lng) s
  where s.id is not null;
$$;

-- The new lat/lng columns shadow the function parameters of the same name inside SQL
-- functions (columns win over parameters), so qualify every parameter reference.
create or replace function public.find_serving_store(lat double precision, lng double precision)
returns public.stores
language sql
stable
as $$
  select s.*
  from public.stores s
  where s.is_open
    and (
      (s.service_area is not null and extensions.st_covers(s.service_area, extensions.st_point(find_serving_store.lng, find_serving_store.lat)::extensions.geography))
      or (s.service_area is null and extensions.st_dwithin(s.location, extensions.st_point(find_serving_store.lng, find_serving_store.lat)::extensions.geography, s.service_radius_m))
    )
  order by extensions.st_distance(s.location, extensions.st_point(find_serving_store.lng, find_serving_store.lat)::extensions.geography)
  limit 1;
$$;

create or replace function public.serving_store(lat double precision, lng double precision)
returns table (
  id uuid, name text, code text, is_open boolean, promised_minutes integer,
  min_order_amount bigint, delivery_fee bigint, free_delivery_above bigint,
  opens_at time, closes_at time, distance_m double precision
)
language sql stable
as $$
  select s.id, s.name, s.code, s.is_open, s.promised_minutes,
         s.min_order_amount, s.delivery_fee, s.free_delivery_above,
         s.opens_at, s.closes_at,
         extensions.st_distance(s.location, extensions.st_point(serving_store.lng, serving_store.lat)::extensions.geography) as distance_m
  from public.find_serving_store(serving_store.lat, serving_store.lng) s
  where s.id is not null;
$$;
