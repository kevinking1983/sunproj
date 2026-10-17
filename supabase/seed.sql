-- Development seed: stores and coupons. Not run in production.
insert into public.stores (name, code, address, lat, lng, service_radius_m)
values ('RATION Central', 'RC01', 'Dark Store 1', 12.9716, 77.5946, 4000);

-- Local testing only: a virtual store whose radius covers the whole of India, so testers
-- anywhere in the country get a serviceable address. Addresses near RATION Central still
-- pick that store because serviceability prefers the nearest one.
insert into public.stores (name, code, address, lat, lng, service_radius_m)
values ('RATION Test Store (anywhere in India)', 'TEST01', 'Virtual store for local testing', 21.1458, 79.0882, 2500000);

-- Categories, brands, products and stock come from seeds/catalog.sql (generated from
-- supabase/catalog by scripts/catalog/build-seed.mjs), which runs after this file.

insert into public.coupons (code, title, description, discount_type, discount_value, max_discount, min_order_amount, first_order_only)
values ('WELCOME50', 'Flat ₹50 off', 'On your first order above ₹199', 'flat', 5000, 5000, 19900, true);
