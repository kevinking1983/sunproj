-- Runs after migrations + seed in CI against a stub auth schema. Exercises the
-- order lifecycle end to end and asserts the numbers.
\set ON_ERROR_STOP on
insert into auth.users (phone) values ('919999900001');

do $$
declare
  v_user uuid := (select id from auth.users where phone = '919999900001');
  v_store uuid := (select id from public.stores limit 1);
  v_addr uuid;
  v_dal uuid := (select id from public.products where slug = 'toor-dal');
  v_milk uuid := (select id from public.products where slug = 'toned-milk');
  v_placed jsonb;
  v_order uuid;
  v_cancel jsonb;
begin
  insert into public.addresses (user_id, line1, city, state, pincode, lat, lng)
    values (v_user, '12 MG Road', 'Bengaluru', 'KA', '560001', 12.9750, 77.6000) returning id into v_addr;

  -- serviceability
  if (select count(*) from public.serving_store(12.975, 77.60)) <> 1 then raise exception 'expected one serving store'; end if;
  if (select count(*) from public.serving_store(13.5, 77.60)) <> 0 then raise exception 'expected no serving store far away'; end if;

  -- online order with first-order coupon: 16500 + 2*2700 = 21900, -5000, free delivery, +500 handling, +1000 tip = 18400
  v_placed := public.place_order(v_user, v_store, v_addr,
    jsonb_build_array(jsonb_build_object('product_id', v_dal, 'quantity', 1), jsonb_build_object('product_id', v_milk, 'quantity', 2)),
    'upi', 'WELCOME50', 1000, null);
  v_order := (v_placed->>'order_id')::uuid;
  if (v_placed->>'total')::bigint <> 18400 then raise exception 'unexpected total %', v_placed->>'total'; end if;
  if (select reserved from public.inventory where store_id = v_store and product_id = v_milk) <> 2 then raise exception 'milk not reserved'; end if;

  perform public.attach_provider_order(v_order, 'order_test');
  if public.confirm_payment(v_order, 'order_test', 'pay_test', 'upi', null) <> 'placed' then raise exception 'confirm failed'; end if;
  if public.confirm_payment(v_order, 'order_test', 'pay_test', 'upi', null) <> 'placed' then raise exception 'confirm not idempotent'; end if;

  v_cancel := public.cancel_order(v_order, v_user, 'test', true);
  if (v_cancel->>'refund_online')::bigint <> 18400 then raise exception 'refund amount wrong'; end if;
  if (select reserved from public.inventory where store_id = v_store and product_id = v_milk) <> 0 then raise exception 'stock not released'; end if;
  if (select used_count from public.coupons where code = 'WELCOME50') <> 0 then raise exception 'coupon use not reverted'; end if;

  -- COD small order: 2700 + 2500 delivery + 2000 small order + 500 handling = 7700
  v_placed := public.place_order(v_user, v_store, v_addr, jsonb_build_array(jsonb_build_object('product_id', v_milk, 'quantity', 1)), 'cod', null, 0, null);
  if (v_placed->>'total')::bigint <> 7700 then raise exception 'unexpected cod total %', v_placed->>'total'; end if;
  v_order := (v_placed->>'order_id')::uuid;
  perform public.advance_order(v_order, 'delivered', v_user, null);
  if (select quantity from public.inventory where store_id = v_store and product_id = v_milk) <> 49 then raise exception 'stock not decremented'; end if;
  if (select status from public.payments where order_id = v_order) <> 'captured' then raise exception 'cod not captured'; end if;

  -- over-ordering must fail
  begin
    perform public.place_order(v_user, v_store, v_addr, jsonb_build_array(jsonb_build_object('product_id', v_milk, 'quantity', 50)), 'cod', null, 0, null);
    raise exception 'expected OUT_OF_STOCK';
  exception when others then
    if sqlerrm not like 'OUT_OF_STOCK%' then raise; end if;
  end;

  if has_function_privilege('authenticated', 'public.place_order(uuid, uuid, uuid, jsonb, public.payment_method, text, bigint, text)', 'execute') then
    raise exception 'place_order must not be callable by authenticated';
  end if;
  raise notice 'smoke OK';
end $$;
