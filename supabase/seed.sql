-- Development seed: one dark store and a small catalog. Not run in production.
insert into public.stores (name, code, address, lat, lng, service_radius_m)
values ('RATION Central', 'RC01', 'Dark Store 1', 12.9716, 77.5946, 4000);

insert into public.categories (name, slug, sort_order) values
  ('Fruits & Vegetables', 'fruits-vegetables', 1),
  ('Dairy, Bread & Eggs', 'dairy-bread-eggs', 2),
  ('Atta, Rice & Dal', 'atta-rice-dal', 3),
  ('Snacks & Munchies', 'snacks', 4),
  ('Cold Drinks & Juices', 'beverages', 5),
  ('Cleaning Essentials', 'cleaning', 6);

insert into public.products (category_id, name, slug, unit_label, mrp, price, images, is_veg)
select c.id, p.name, p.slug, p.unit, p.mrp, p.price, '{}', true
from (values
  ('fruits-vegetables', 'Banana Robusta', 'banana-robusta', '6 pcs', 4900, 3900),
  ('fruits-vegetables', 'Tomato Hybrid', 'tomato-hybrid', '500 g', 3500, 2400),
  ('fruits-vegetables', 'Onion', 'onion', '1 kg', 4500, 3600),
  ('dairy-bread-eggs', 'Toned Milk', 'toned-milk', '500 ml', 2800, 2700),
  ('dairy-bread-eggs', 'Brown Bread', 'brown-bread', '400 g', 5000, 4500),
  ('atta-rice-dal', 'Whole Wheat Atta', 'whole-wheat-atta', '5 kg', 29500, 25900),
  ('atta-rice-dal', 'Toor Dal', 'toor-dal', '1 kg', 19000, 16500),
  ('snacks', 'Salted Potato Chips', 'salted-potato-chips', '52 g', 2000, 2000),
  ('beverages', 'Orange Juice', 'orange-juice', '1 L', 13000, 11900),
  ('cleaning', 'Dishwash Liquid', 'dishwash-liquid', '750 ml', 19900, 17500)
) as p(cat, name, slug, unit, mrp, price)
join public.categories c on c.slug = p.cat;

insert into public.inventory (store_id, product_id, quantity)
select s.id, p.id, 50 from public.stores s cross join public.products p;

insert into public.coupons (code, title, description, discount_type, discount_value, max_discount, min_order_amount, first_order_only)
values ('WELCOME50', 'Flat ₹50 off', 'On your first order above ₹199', 'flat', 5000, 5000, 19900, true);
