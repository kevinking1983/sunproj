/**
 * Called by the database (trigger orders_notify, migration 0008, via pg_net) whenever an
 * order's status or rider changes, with Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>.
 * Sends the customer a push for the new status and alerts a newly assigned rider.
 * Enable once per project: select public.set_notify_config('<functions url>', '<service role key>');
 */
import { errorResponse, handleOptions, HttpError, json } from "../_shared/http.ts";
import { adminClient } from "../_shared/supabase.ts";

interface OrderRow {
  id: string;
  user_id: string;
  rider_id: string | null;
  order_number: string;
  status: string;
}

interface WebhookPayload {
  type: "UPDATE" | "INSERT" | "DELETE";
  table: string;
  record: OrderRow;
  old_record: OrderRow | null;
}

const MESSAGES: Record<string, { title: string; body: string }> = {
  placed: { title: "Order confirmed", body: "The store has your order #{n}. We will update you as it moves." },
  accepted: { title: "Being prepared", body: "Your order #{n} is being prepared at the store." },
  packing: { title: "Packing now", body: "Your items for #{n} are being packed." },
  picked_up: { title: "Rider picked up", body: "Your rider has picked up order #{n}." },
  out_for_delivery: { title: "On the way", body: "Order #{n} is out for delivery. Keep your phone handy." },
  delivered: { title: "Delivered", body: "Order #{n} has been delivered. Enjoy!" },
  cancelled: { title: "Order cancelled", body: "Order #{n} was cancelled. Any payment is being refunded." },
};

type Db = ReturnType<typeof adminClient>;

/** Delivers one notification to every device of a user (Expo push, or ntfy on the test stack). Returns devices reached. */
const sendTo = async (db: Db, userId: string, title: string, body: string, data: Record<string, string>): Promise<number> => {
  if (Deno.env.get("PUSH_PROVIDER") === "ntfy") {
    const base = (Deno.env.get("NTFY_URL") ?? "http://host.docker.internal:4020").replace(/\/$/, "");
    const res = await fetch(`${base}/ration-${userId}`, { method: "POST", headers: { Title: title, Tags: "shopping_bags", Priority: "high" }, body });
    return res.ok ? 1 : 0;
  }
  const { data: tokens } = await db.from("push_tokens").select("token").eq("user_id", userId);
  if (!tokens?.length) return 0;
  const res = await fetch("https://exp.host/--/api/v2/push/send", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(tokens.map((t) => ({ to: t.token, title, body, sound: "default", data }))),
  });
  const result = (await res.json()) as { data?: { status: string; details?: { error?: string } }[] };
  const dead = tokens.filter((_, i) => result.data?.[i]?.details?.error === "DeviceNotRegistered").map((t) => t.token);
  if (dead.length) await db.from("push_tokens").delete().in("token", dead);
  return tokens.length - dead.length;
};

Deno.serve(async (req) => {
  const options = handleOptions(req);
  if (options) return options;
  try {
    const auth = req.headers.get("Authorization") ?? "";
    if (auth !== `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`) throw new HttpError(401, "UNAUTHENTICATED");

    const payload = (await req.json()) as WebhookPayload;
    if (payload.type !== "UPDATE" || payload.table !== "orders") return json({ ok: true, skipped: true });
    const { record, old_record } = payload;
    if (!old_record) return json({ ok: true, skipped: true });
    const db = adminClient();

    // Rider alerts: a new assignment, or an order becoming ready for pickup.
    const riderAssigned = record.rider_id && record.rider_id !== old_record.rider_id;
    const becameReady = record.rider_id && record.status === "ready" && old_record.status !== "ready";
    if (riderAssigned || becameReady) {
      await sendTo(db, record.rider_id!, riderAssigned ? "New delivery assigned" : "Order ready for pickup", `Order #${record.order_number} is ${riderAssigned ? "yours" : "packed and waiting at the store"}.`, { order_id: record.id, role: "rider" });
    }

    if (old_record.status === record.status) return json({ ok: true, skipped: true });
    const message = MESSAGES[record.status];
    if (!message) return json({ ok: true, skipped: true });
    const body = message.body.replace("{n}", record.order_number);

    const sent = await sendTo(db, record.user_id, message.title, body, { order_id: record.id, status: record.status });
    return json({ ok: true, sent });
  } catch (e) {
    return errorResponse(e);
  }
});
