/**
 * Database webhook target: Supabase Dashboard > Database > Webhooks on
 * public.orders (UPDATE) -> this function, with header
 * Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>.
 * Sends an Expo push notification to the customer when the order status changes.
 */
import { errorResponse, handleOptions, HttpError, json } from "../_shared/http.ts";
import { adminClient } from "../_shared/supabase.ts";

interface OrderRow {
  id: string;
  user_id: string;
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

Deno.serve(async (req) => {
  const options = handleOptions(req);
  if (options) return options;
  try {
    const auth = req.headers.get("Authorization") ?? "";
    if (auth !== `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`) throw new HttpError(401, "UNAUTHENTICATED");

    const payload = (await req.json()) as WebhookPayload;
    if (payload.type !== "UPDATE" || payload.table !== "orders") return json({ ok: true, skipped: true });
    const { record, old_record } = payload;
    if (!old_record || old_record.status === record.status) return json({ ok: true, skipped: true });
    const message = MESSAGES[record.status];
    if (!message) return json({ ok: true, skipped: true });

    const db = adminClient();
    const body = message.body.replace("{n}", record.order_number);

    // Open-source test stack: publish to a self-hosted ntfy topic instead of Expo push.
    if (Deno.env.get("PUSH_PROVIDER") === "ntfy") {
      const base = (Deno.env.get("NTFY_URL") ?? "http://host.docker.internal:4020").replace(/\/$/, "");
      const res = await fetch(`${base}/ration-${record.user_id}`, {
        method: "POST",
        headers: { Title: message.title, Tags: "shopping_bags", Priority: "high" },
        body,
      });
      return json({ ok: res.ok, provider: "ntfy" });
    }

    const { data: tokens } = await db.from("push_tokens").select("token").eq("user_id", record.user_id);
    if (!tokens?.length) return json({ ok: true, sent: 0 });

    const res = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(
        tokens.map((t) => ({ to: t.token, title: message.title, body, sound: "default", data: { order_id: record.id, status: record.status } })),
      ),
    });
    const result = await res.json();
    // Prune tokens Expo reports as no longer registered.
    const data = (result as { data?: { status: string; details?: { error?: string } }[] }).data ?? [];
    const dead = tokens.filter((_, i) => data[i]?.details?.error === "DeviceNotRegistered").map((t) => t.token);
    if (dead.length) await db.from("push_tokens").delete().in("token", dead);
    return json({ ok: true, sent: tokens.length - dead.length });
  } catch (e) {
    return errorResponse(e);
  }
});
