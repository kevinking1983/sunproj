/**
 * Rider simulator for the open-source test stack. FOR LOCAL TESTING ONLY.
 *
 * Moves a rider from the store to an order's delivery address, writing
 * rider_locations every few seconds with the service role, so the live map in the
 * app and website can be exercised before the rider app exists.
 *
 *   SUPABASE_URL=http://127.0.0.1:54321 SUPABASE_SERVICE_ROLE_KEY=... \
 *   node infra/opensource/simulate-rider.mjs <order_number|order_id> [--speed 25] [--interval 3]
 *
 * If the order has no rider, the first profile with role 'rider' is assigned (one is
 * created from the test number 9999900003 if none exists). The order is advanced to
 * picked_up and out_for_delivery, then delivered on arrival.
 */
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL ?? "http://127.0.0.1:54321";
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!key) {
  console.error("Set SUPABASE_SERVICE_ROLE_KEY (printed by `npm run db:start`).");
  process.exit(1);
}
const args = process.argv.slice(2);
const target = args.find((a) => !a.startsWith("--"));
const opt = (name, def) => { const i = args.indexOf(`--${name}`); return i === -1 ? def : Number(args[i + 1]); };
const speedKmh = opt("speed", 25);
const intervalS = opt("interval", 3);
if (!target) { console.error("Usage: simulate-rider.mjs <order_number|order_id>"); process.exit(1); }

const db = createClient(url, key, { auth: { persistSession: false } });
const fail = (m, e) => { console.error(m, e?.message ?? e ?? ""); process.exit(1); };

const { data: order, error: oe } = await db.from("orders").select("id, order_number, status, rider_id, store_id, address_snapshot").or(`order_number.eq.${target},id.eq.${/^[0-9a-f-]{36}$/.test(target) ? target : "00000000-0000-0000-0000-000000000000"}`).maybeSingle();
if (oe || !order) fail("Order not found", oe);
const { data: store } = await db.from("stores").select("lat, lng, name").eq("id", order.store_id).single();

let riderId = order.rider_id;
if (!riderId) {
  let { data: rider } = await db.from("profiles").select("id").eq("role", "rider").limit(1).maybeSingle();
  if (!rider) {
    const { data: created, error: ce } = await db.auth.admin.createUser({ phone: "+919999900003", phone_confirm: true });
    if (ce) fail("Could not create rider user", ce);
    await db.from("profiles").update({ role: "rider", full_name: "Sim Rider" }).eq("id", created.user.id);
    rider = { id: created.user.id };
  }
  riderId = rider.id;
  const { error: ae } = await db.from("orders").update({ rider_id: riderId }).eq("id", order.id);
  if (ae) fail("Could not assign rider", ae);
  console.log(`assigned rider ${riderId}`);
}

const advance = async (status) => {
  const { error } = await db.rpc("advance_order", { p_order_id: order.id, p_status: status, p_actor: riderId, p_note: "simulator" });
  if (error) console.warn(`advance ${status}: ${error.message}`); else console.log(`order ${order.order_number} -> ${status}`);
};
const put = async (lat, lng, heading) => {
  const { error } = await db.from("rider_locations").upsert({ rider_id: riderId, lat, lng, heading, updated_at: new Date().toISOString() });
  if (error) fail("rider_locations write failed", error);
};

const from = { lat: store.lat, lng: store.lng };
const to = { lat: order.address_snapshot.lat, lng: order.address_snapshot.lng };
const R = 6371000, rad = (d) => (d * Math.PI) / 180;
const dist = 2 * R * Math.asin(Math.sqrt(Math.sin(rad(to.lat - from.lat) / 2) ** 2 + Math.cos(rad(from.lat)) * Math.cos(rad(to.lat)) * Math.sin(rad(to.lng - from.lng) / 2) ** 2));
const steps = Math.max(2, Math.ceil(dist / ((speedKmh * 1000) / 3600) / intervalS));
const heading = (Math.atan2(to.lng - from.lng, to.lat - from.lat) * 180) / Math.PI;
console.log(`${store.name} -> ${order.address_snapshot.line1}: ${(dist / 1000).toFixed(2)} km in ${steps} steps`);

if (["placed", "accepted", "packing", "ready"].includes(order.status)) {
  for (const s of ["accepted", "packing", "ready", "picked_up"].slice(["placed", "accepted", "packing", "ready"].indexOf(order.status))) await advance(s);
  await advance("out_for_delivery");
}
for (let i = 0; i <= steps; i++) {
  const t = i / steps;
  const jitter = () => (Math.random() - 0.5) * 0.0004;
  await put(from.lat + (to.lat - from.lat) * t + (i < steps ? jitter() : 0), from.lng + (to.lng - from.lng) * t + (i < steps ? jitter() : 0), heading);
  process.stdout.write(`\rposition ${i}/${steps}`);
  if (i < steps) await new Promise((r) => setTimeout(r, intervalS * 1000));
}
console.log("\narrived");
await advance("delivered");
