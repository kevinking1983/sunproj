-- Order notifications without dashboard setup.
--
-- Every change to an order's status or rider posts the old and new row to the
-- notify-order edge function (customer status pushes, rider assignment alerts), using
-- pg_net from inside the database. The functions URL and the service role key live in
-- Supabase Vault, set once per environment with:
--
--   select public.set_notify_config('https://<project-ref>.supabase.co/functions/v1', '<service role key>');
--
-- `npm run oss:start` does this for the local stack after every reset. Until it is set,
-- the trigger does nothing, so plain Postgres (CI, the smoke test) is unaffected.
-- Do not also add a Database Webhook for orders in the dashboard, or pushes arrive twice.

do $$
begin
  create extension if not exists pg_net;
exception when others then
  raise notice 'pg_net not available (%); order notifications stay off in this database', sqlerrm;
end $$;

create or replace function public.set_notify_config(p_functions_url text, p_service_role_key text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if to_regclass('vault.secrets') is null then
    raise exception 'VAULT_NOT_AVAILABLE' using errcode = 'P0001';
  end if;
  select id into v_id from vault.secrets where name = 'ration_functions_url';
  if v_id is null then
    perform vault.create_secret(rtrim(p_functions_url, '/'), 'ration_functions_url', 'Base URL of the edge functions, used by order notifications');
  else
    perform vault.update_secret(v_id, rtrim(p_functions_url, '/'));
  end if;
  select id into v_id from vault.secrets where name = 'ration_service_role_key';
  if v_id is null then
    perform vault.create_secret(p_service_role_key, 'ration_service_role_key', 'Service role key the database uses to call notify-order');
  else
    perform vault.update_secret(v_id, p_service_role_key);
  end if;
end;
$$;

create or replace function public.orders_notify_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_url text;
  v_key text;
begin
  if new.status is not distinct from old.status and new.rider_id is not distinct from old.rider_id then
    return null;
  end if;
  if to_regclass('vault.decrypted_secrets') is null or to_regnamespace('net') is null then
    return null;
  end if;
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'ration_functions_url';
  select decrypted_secret into v_key from vault.decrypted_secrets where name = 'ration_service_role_key';
  if v_url is null or v_key is null then
    return null;
  end if;
  -- Asynchronous: pg_net sends after commit, so a slow push never holds up the order.
  perform net.http_post(
    url := v_url || '/notify-order',
    body := jsonb_build_object('type', 'UPDATE', 'table', 'orders', 'schema', 'public', 'record', to_jsonb(new), 'old_record', to_jsonb(old)),
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_key),
    timeout_milliseconds := 5000
  );
  return null;
end;
$$;

create trigger orders_notify after update on public.orders
  for each row execute function public.orders_notify_trigger();

revoke execute on function public.set_notify_config(text, text) from public, anon, authenticated;
revoke execute on function public.orders_notify_trigger() from public, anon, authenticated;
