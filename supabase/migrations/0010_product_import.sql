-- Bulk product import for the admin panel (CSV upload). Staff only.
--
-- p_rows: JSON array of
--   { row, slug, name, brand, subcategories: [slug, ...], unit_label, mrp, price, tax_rate,
--     description, image_url, image_credit, is_veg, tags: [..], orderable, is_active, stock }
-- Money in paise. The first subcategory is the primary shelf; the product is placed on exactly
-- the listed shelves. Unknown brands are created. With p_store_id, a non-null stock sets that
-- store's quantity. Each row runs in its own savepoint: a bad row is reported and skipped,
-- the rest still import.
create or replace function public.staff_import_products(p_rows jsonb, p_store_id uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  r jsonb;
  v_row integer;
  v_cat_ids uuid[];
  v_missing text;
  v_brand_id uuid;
  v_brand text;
  v_product_id uuid;
  v_inserted boolean;
  v_created integer := 0;
  v_updated integer := 0;
  v_brands integer := 0;
  v_errors jsonb := '[]'::jsonb;
  v_slug text;
  v_base text;
  i integer;
begin
  if not public.is_staff() then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;
  if jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) > 500 then
    raise exception 'BATCH_TOO_LARGE' using errcode = 'P0001';
  end if;

  for r in select * from jsonb_array_elements(p_rows) loop
    v_row := coalesce((r->>'row')::integer, 0);
    begin
      if coalesce(trim(r->>'name'), '') = '' or coalesce(trim(r->>'unit_label'), '') = '' or coalesce(trim(r->>'slug'), '') = '' then
        raise exception 'name, unit_label and slug are required';
      end if;
      if (r->>'price')::bigint <= 0 or (r->>'price')::bigint > (r->>'mrp')::bigint then
        raise exception 'price must be positive and not above MRP';
      end if;

      select array_agg(c.id order by s.ord), string_agg(case when c.id is null then s.slug end, ', ')
        into v_cat_ids, v_missing
      from jsonb_array_elements_text(coalesce(r->'subcategories', '[]'::jsonb)) with ordinality as s(slug, ord)
      left join public.categories c on c.slug = s.slug;
      if v_missing is not null then
        raise exception 'unknown subcategory: %', v_missing;
      end if;
      if v_cat_ids is null or array_length(v_cat_ids, 1) is null then
        raise exception 'at least one subcategory is required';
      end if;

      v_brand := nullif(trim(r->>'brand'), '');
      v_brand_id := null;
      if v_brand is not null then
        select id into v_brand_id from public.brands where lower(name) = lower(v_brand);
        if v_brand_id is null then
          v_base := trim(both '-' from regexp_replace(lower(v_brand), '[^a-z0-9]+', '-', 'g'));
          v_slug := coalesce(nullif(v_base, ''), 'brand');
          i := 2;
          while exists (select 1 from public.brands where slug = v_slug) loop
            v_slug := v_base || '-' || i;
            i := i + 1;
          end loop;
          insert into public.brands (name, slug) values (v_brand, v_slug) returning id into v_brand_id;
          v_brands := v_brands + 1;
        end if;
      end if;

      insert into public.products as p (category_id, brand_id, name, slug, description, unit_label, mrp, price, tax_rate, images, tags, is_veg, is_active, orderable, image_credit)
      values (
        v_cat_ids[1], v_brand_id, trim(r->>'name'), trim(r->>'slug'), nullif(trim(r->>'description'), ''), trim(r->>'unit_label'),
        (r->>'mrp')::bigint, (r->>'price')::bigint, coalesce((r->>'tax_rate')::numeric, 0),
        case when nullif(trim(r->>'image_url'), '') is null then '{}'::text[] else array[trim(r->>'image_url')] end,
        coalesce(array(select jsonb_array_elements_text(r->'tags')), '{}'::text[]),
        (r->>'is_veg')::boolean, coalesce((r->>'is_active')::boolean, true), coalesce((r->>'orderable')::boolean, true),
        nullif(trim(r->>'image_credit'), '')
      )
      on conflict (slug) do update set
        category_id = excluded.category_id, brand_id = excluded.brand_id, name = excluded.name, description = excluded.description,
        unit_label = excluded.unit_label, mrp = excluded.mrp, price = excluded.price, tax_rate = excluded.tax_rate,
        images = case when excluded.images = '{}'::text[] then p.images else excluded.images end,
        image_credit = case when excluded.images = '{}'::text[] then p.image_credit else excluded.image_credit end,
        tags = excluded.tags, is_veg = excluded.is_veg, is_active = excluded.is_active, orderable = excluded.orderable, updated_at = now()
      returning id, (xmax = 0) into v_product_id, v_inserted;

      delete from public.product_categories where product_id = v_product_id and not (category_id = any (v_cat_ids));
      insert into public.product_categories (product_id, category_id, sort_order)
      select v_product_id, c, coalesce((select max(sort_order) from public.product_categories where category_id = c), 0) + 1
      from unnest(v_cat_ids) as c
      on conflict do nothing;

      if p_store_id is not null and r ? 'stock' and jsonb_typeof(r->'stock') = 'number' then
        if (r->>'stock')::integer < 0 then raise exception 'stock cannot be negative'; end if;
        insert into public.inventory (store_id, product_id, quantity) values (p_store_id, v_product_id, (r->>'stock')::integer)
        on conflict (store_id, product_id) do update set quantity = excluded.quantity, updated_at = now();
      end if;

      if v_inserted then v_created := v_created + 1; else v_updated := v_updated + 1; end if;
    exception when others then
      v_errors := v_errors || jsonb_build_object('row', v_row, 'message', sqlerrm);
    end;
  end loop;

  return jsonb_build_object('created', v_created, 'updated', v_updated, 'brands_created', v_brands, 'errors', v_errors);
end;
$$;

revoke execute on function public.staff_import_products(jsonb, uuid) from public, anon;
grant execute on function public.staff_import_products(jsonb, uuid) to authenticated;
