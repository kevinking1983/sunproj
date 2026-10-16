-- Transactional order placement, payment confirmation, cancellation and fulfilment.
-- All functions are SECURITY DEFINER and callable only by the service role (edge
-- functions); the app never writes orders directly. Pricing mirrors
-- packages/shared/src/pricing.ts.

-- ---------------------------------------------------------------------------
-- Coupon usage tracking
-- ---------------------------------------------------------------------------
create table public.coupon_redemptions (
  id bigint generated always as identity primary key,
  coupon_id uuid not null references public.coupons (id),
  user_id uuid not null references public.profiles (id),
  order_id uuid not null references public.orders (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (order_id)
);
create index coupon_redemptions_user_idx on public.coupon_redemptions (coupon_id, user_id);
alter table public.coupon_redemptions enable row level security;
create policy "redemptions self read" on public.coupon_redemptions for select using (user_id = auth.uid() or public.is_staff());

-- ---------------------------------------------------------------------------
-- Idempotency for edge functions
-- ---------------------------------------------------------------------------
create table public.idempotency_keys (
  key text primary key,
  user_id uuid references public.profiles (id) on delete cascade,
  response jsonb,
  created_at timestamptz not null default now()
);
alter table public.idempotency_keys enable row level security;

create table public.webhook_events (
  provider text not null,
  event_id text not null,
  received_at timestamptz not null default now(),
  primary key (provider, event_id)
);
alter table public.webhook_events enable row level security;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create or replace function public.append_order_event(p_order_id uuid, p_status public.order_status, p_note text default null, p_actor uuid default null)
returns void language sql security definer set search_path = public as $$
  insert into public.order_events (order_id, status, note, actor_id) values (p_order_id, p_status, p_note, p_actor);
$$;

-- ---------------------------------------------------------------------------
-- place_order
-- items: [{"product_id": uuid, "quantity": int}, ...]
-- Returns the order id and the bill so the caller can create the gateway order.
-- ---------------------------------------------------------------------------
create or replace function public.place_order(
  p_user_id uuid,
  p_store_id uuid,
  p_address_id uuid,
  p_items jsonb,
  p_payment_method public.payment_method,
  p_coupon_code text default null,
  p_tip bigint default 0,
  p_customer_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_store public.stores%rowtype;
  v_address public.addresses%rowtype;
  v_coupon public.coupons%rowtype;
  v_item record;
  v_product public.products%rowtype;
  v_inv public.inventory%rowtype;
  v_price bigint;
  v_subtotal bigint := 0;
  v_mrp_total bigint := 0;
  v_base_delivery bigint := 0;
  v_delivery bigint := 0;
  v_small_order bigint := 0;
  v_handling bigint := 500;
  v_discount bigint := 0;
  v_free_delivery boolean := false;
  v_tip bigint := greatest(0, least(coalesce(p_tip, 0), 10000));
  v_total bigint;
  v_order_id uuid;
  v_lines jsonb := '[]'::jsonb;
  v_redeemed integer;
begin
  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'EMPTY_CART' using errcode = 'P0001';
  end if;

  select * into v_store from public.stores where id = p_store_id for share;
  if not found or not v_store.is_open then
    raise exception 'STORE_CLOSED' using errcode = 'P0001';
  end if;

  select * into v_address from public.addresses where id = p_address_id and user_id = p_user_id;
  if not found then
    raise exception 'ADDRESS_NOT_FOUND' using errcode = 'P0001';
  end if;

  if public.find_serving_store(v_address.lat, v_address.lng) is distinct from v_store then
    -- the address must be served by the requested store
    if (select id from public.find_serving_store(v_address.lat, v_address.lng)) is distinct from p_store_id then
      raise exception 'ADDRESS_NOT_SERVICEABLE' using errcode = 'P0001';
    end if;
  end if;

  -- Price every line from the database, locking inventory rows in a stable order.
  for v_item in
    select (e->>'product_id')::uuid as product_id, (e->>'quantity')::int as quantity
    from jsonb_array_elements(p_items) e
    order by (e->>'product_id')
  loop
    if v_item.quantity is null or v_item.quantity < 1 or v_item.quantity > 50 then
      raise exception 'INVALID_QUANTITY' using errcode = 'P0001';
    end if;
    select * into v_product from public.products where id = v_item.product_id and is_active;
    if not found then
      raise exception 'PRODUCT_UNAVAILABLE:%', v_item.product_id using errcode = 'P0001';
    end if;
    select * into v_inv from public.inventory where store_id = p_store_id and product_id = v_item.product_id for update;
    if not found or (v_inv.quantity - v_inv.reserved) < v_item.quantity then
      raise exception 'OUT_OF_STOCK:%', v_product.name using errcode = 'P0001';
    end if;
    v_price := coalesce(v_inv.price_override, v_product.price);
    v_subtotal := v_subtotal + v_price * v_item.quantity;
    v_mrp_total := v_mrp_total + v_product.mrp * v_item.quantity;
    update public.inventory set reserved = reserved + v_item.quantity where store_id = p_store_id and product_id = v_item.product_id;
    v_lines := v_lines || jsonb_build_object(
      'product_id', v_product.id, 'name', v_product.name, 'unit_label', v_product.unit_label,
      'image_url', v_product.images[1], 'quantity', v_item.quantity, 'unit_price', v_price,
      'mrp', v_product.mrp, 'line_total', v_price * v_item.quantity
    );
  end loop;

  -- Fees
  v_base_delivery := case when v_subtotal >= v_store.free_delivery_above then 0 else v_store.delivery_fee end;
  v_small_order := case when v_subtotal < v_store.min_order_amount then 2000 else 0 end;

  -- Coupon
  if p_coupon_code is not null and length(trim(p_coupon_code)) > 0 then
    select * into v_coupon from public.coupons where upper(code) = upper(trim(p_coupon_code)) and is_active
      and (starts_at is null or starts_at <= now()) and (ends_at is null or ends_at >= now()) for update;
    if not found then
      raise exception 'COUPON_INVALID' using errcode = 'P0001';
    end if;
    if v_subtotal < v_coupon.min_order_amount then
      raise exception 'COUPON_MIN_ORDER:%', v_coupon.min_order_amount using errcode = 'P0001';
    end if;
    if v_coupon.total_limit is not null and v_coupon.used_count >= v_coupon.total_limit then
      raise exception 'COUPON_EXHAUSTED' using errcode = 'P0001';
    end if;
    select count(*) into v_redeemed from public.coupon_redemptions where coupon_id = v_coupon.id and user_id = p_user_id;
    if v_redeemed >= v_coupon.per_user_limit then
      raise exception 'COUPON_ALREADY_USED' using errcode = 'P0001';
    end if;
    if v_coupon.first_order_only and exists (select 1 from public.orders where user_id = p_user_id and status not in ('cancelled', 'pending_payment')) then
      raise exception 'COUPON_FIRST_ORDER_ONLY' using errcode = 'P0001';
    end if;
    if v_coupon.discount_type = 'free_delivery' then
      v_free_delivery := true;
      v_discount := v_base_delivery;
    elsif v_coupon.discount_type = 'flat' then
      v_discount := least(v_coupon.discount_value, v_subtotal);
    else
      v_discount := least(floor(v_subtotal * v_coupon.discount_value / 100.0)::bigint, coalesce(v_coupon.max_discount, v_subtotal), v_subtotal);
    end if;
  end if;

  v_delivery := case when v_free_delivery then 0 else v_base_delivery end;
  v_total := greatest(0, v_subtotal - (case when v_free_delivery then 0 else v_discount end)) + v_delivery + v_small_order + v_handling + v_tip;

  insert into public.orders (
    user_id, store_id, address_snapshot, status, payment_method, subtotal, discount, delivery_fee,
    handling_fee, tip, total, coupon_code, promised_at, customer_note
  ) values (
    p_user_id, p_store_id, to_jsonb(v_address) - 'location',
    (case when p_payment_method in ('cod', 'ration_wallet') then 'placed' else 'pending_payment' end)::public.order_status,
    p_payment_method, v_subtotal, v_discount, v_delivery, v_handling + v_small_order, v_tip, v_total,
    case when v_coupon.id is not null then v_coupon.code else null end,
    now() + make_interval(mins => v_store.promised_minutes), p_customer_note
  ) returning id into v_order_id;

  insert into public.order_items (order_id, product_id, name, unit_label, image_url, quantity, unit_price, mrp, line_total)
  select v_order_id, (l->>'product_id')::uuid, l->>'name', l->>'unit_label', l->>'image_url',
         (l->>'quantity')::int, (l->>'unit_price')::bigint, (l->>'mrp')::bigint, (l->>'line_total')::bigint
  from jsonb_array_elements(v_lines) l;

  if v_coupon.id is not null then
    insert into public.coupon_redemptions (coupon_id, user_id, order_id) values (v_coupon.id, p_user_id, v_order_id);
    update public.coupons set used_count = used_count + 1 where id = v_coupon.id;
  end if;

  if p_payment_method = 'ration_wallet' then
    update public.profiles set wallet_balance = wallet_balance - v_total where id = p_user_id and wallet_balance >= v_total;
    if not found then
      raise exception 'INSUFFICIENT_WALLET' using errcode = 'P0001';
    end if;
    insert into public.wallet_transactions (user_id, amount, kind, order_id, note) values (p_user_id, -v_total, 'order_debit', v_order_id, 'Order payment');
    insert into public.payments (order_id, provider, method, amount, status) values (v_order_id, 'wallet', 'ration_wallet', v_total, 'captured');
  elsif p_payment_method = 'cod' then
    insert into public.payments (order_id, provider, method, amount, status) values (v_order_id, 'cod', 'cod', v_total, 'created');
  else
    insert into public.payments (order_id, provider, method, amount, status) values (v_order_id, 'razorpay', p_payment_method, v_total, 'created');
  end if;

  perform public.append_order_event(v_order_id, (select status from public.orders where id = v_order_id), 'Order created', p_user_id);
  -- clear the server-side cart mirror if any
  delete from public.cart_items where cart_id = (select id from public.carts where user_id = p_user_id);

  return jsonb_build_object(
    'order_id', v_order_id,
    'order_number', (select order_number from public.orders where id = v_order_id),
    'status', (select status from public.orders where id = v_order_id),
    'total', v_total,
    'subtotal', v_subtotal,
    'discount', v_discount,
    'delivery_fee', v_delivery,
    'handling_fee', v_handling + v_small_order,
    'tip', v_tip
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Payment confirmation (called after signature verification or from the webhook).
-- Idempotent: a captured payment is left untouched.
-- ---------------------------------------------------------------------------
create or replace function public.confirm_payment(
  p_order_id uuid,
  p_provider_order_id text,
  p_provider_payment_id text,
  p_method public.payment_method default null,
  p_raw jsonb default null
)
returns public.order_status
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders%rowtype;
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'ORDER_NOT_FOUND' using errcode = 'P0001';
  end if;

  update public.payments
     set provider_order_id = coalesce(provider_order_id, p_provider_order_id),
         provider_payment_id = coalesce(provider_payment_id, p_provider_payment_id),
         method = coalesce(p_method, method),
         status = 'captured',
         raw = coalesce(p_raw, raw)
   where order_id = p_order_id and status <> 'captured';

  if v_order.status = 'pending_payment' then
    update public.orders set status = 'placed' where id = p_order_id;
    perform public.append_order_event(p_order_id, 'placed', 'Payment received');
    return 'placed';
  end if;
  return v_order.status;
end;
$$;

create or replace function public.attach_provider_order(p_order_id uuid, p_provider_order_id text)
returns void language sql security definer set search_path = public as $$
  update public.payments set provider_order_id = p_provider_order_id where order_id = p_order_id and provider = 'razorpay';
$$;

-- ---------------------------------------------------------------------------
-- Cancellation: releases stock, reverses coupon use and refunds wallet payments.
-- Online refunds are issued by the edge function after this returns the amount.
-- ---------------------------------------------------------------------------
create or replace function public.cancel_order(p_order_id uuid, p_actor uuid, p_reason text, p_by_customer boolean)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders%rowtype;
  v_payment public.payments%rowtype;
  v_refund_online bigint := 0;
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'ORDER_NOT_FOUND' using errcode = 'P0001';
  end if;
  if p_by_customer and v_order.user_id <> p_actor then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;
  if v_order.status in ('cancelled', 'refunded', 'delivered') then
    raise exception 'ORDER_NOT_CANCELLABLE' using errcode = 'P0001';
  end if;
  if p_by_customer and v_order.status not in ('pending_payment', 'placed', 'accepted') then
    raise exception 'ORDER_ALREADY_PACKED' using errcode = 'P0001';
  end if;

  update public.inventory i
     set reserved = greatest(0, i.reserved - oi.quantity)
    from public.order_items oi
   where oi.order_id = p_order_id and i.store_id = v_order.store_id and i.product_id = oi.product_id;

  update public.coupons c set used_count = greatest(0, c.used_count - 1)
   where c.id = (select coupon_id from public.coupon_redemptions where order_id = p_order_id);
  delete from public.coupon_redemptions where order_id = p_order_id;

  select * into v_payment from public.payments where order_id = p_order_id order by created_at desc limit 1;
  if v_payment.status = 'captured' then
    if v_payment.provider = 'wallet' then
      update public.profiles set wallet_balance = wallet_balance + v_payment.amount where id = v_order.user_id;
      insert into public.wallet_transactions (user_id, amount, kind, order_id, note) values (v_order.user_id, v_payment.amount, 'refund', p_order_id, 'Order cancelled');
      update public.payments set status = 'refunded' where id = v_payment.id;
    elsif v_payment.provider = 'razorpay' then
      v_refund_online := v_payment.amount;
    end if;
  end if;

  update public.orders set status = 'cancelled', cancelled_at = now(), cancel_reason = p_reason where id = p_order_id;
  perform public.append_order_event(p_order_id, 'cancelled', p_reason, p_actor);

  return jsonb_build_object('order_id', p_order_id, 'refund_online', v_refund_online, 'payment_id', v_payment.provider_payment_id, 'payment_row_id', v_payment.id);
end;
$$;

-- ---------------------------------------------------------------------------
-- Store-side status progression (staff / rider via admin tooling later).
-- ---------------------------------------------------------------------------
create or replace function public.advance_order(p_order_id uuid, p_status public.order_status, p_actor uuid, p_note text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders%rowtype;
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then raise exception 'ORDER_NOT_FOUND' using errcode = 'P0001'; end if;
  if p_status = 'delivered' then
    update public.inventory i
       set quantity = greatest(0, i.quantity - oi.quantity), reserved = greatest(0, i.reserved - oi.quantity)
      from public.order_items oi
     where oi.order_id = p_order_id and i.store_id = v_order.store_id and i.product_id = oi.product_id;
    update public.payments set status = 'captured' where order_id = p_order_id and provider = 'cod';
    update public.orders set status = p_status, delivered_at = now() where id = p_order_id;
  else
    update public.orders set status = p_status where id = p_order_id;
  end if;
  perform public.append_order_event(p_order_id, p_status, p_note, p_actor);
end;
$$;

-- Lock these down: only the service role (edge functions) may call them.
revoke execute on function public.place_order(uuid, uuid, uuid, jsonb, public.payment_method, text, bigint, text) from public, anon, authenticated;
revoke execute on function public.confirm_payment(uuid, text, text, public.payment_method, jsonb) from public, anon, authenticated;
revoke execute on function public.attach_provider_order(uuid, text) from public, anon, authenticated;
revoke execute on function public.cancel_order(uuid, uuid, text, boolean) from public, anon, authenticated;
revoke execute on function public.advance_order(uuid, public.order_status, uuid, text) from public, anon, authenticated;
revoke execute on function public.append_order_event(uuid, public.order_status, text, uuid) from public, anon, authenticated;
