/**
 * POST /razorpay-webhook  (configure in the Razorpay dashboard; events: payment.captured, payment.failed, refund.processed)
 * Verified with the webhook secret; idempotent on the X-Razorpay-Event-Id header.
 * Deploy with --no-verify-jwt since Razorpay cannot send a Supabase JWT.
 */
import { errorResponse, handleOptions, json } from "../_shared/http.ts";
import { mapRazorpayMethod, razorpayConfigFromEnv, verifyWebhookSignature } from "../_shared/razorpay.ts";
import { adminClient } from "../_shared/supabase.ts";

interface RazorpayPaymentEntity {
  id: string;
  order_id: string;
  method?: string;
  notes?: { order_id?: string };
}

interface RazorpayWebhook {
  event: string;
  payload: {
    payment?: { entity: RazorpayPaymentEntity };
    refund?: { entity: { id: string; payment_id: string } };
  };
}

Deno.serve(async (req) => {
  const options = handleOptions(req);
  if (options) return options;
  try {
    const raw = await req.text();
    const cfg = razorpayConfigFromEnv(Deno.env);
    const signature = req.headers.get("X-Razorpay-Signature") ?? "";
    if (!(await verifyWebhookSignature(cfg, raw, signature))) return json({ error: "INVALID_SIGNATURE" }, 400);

    const eventId = req.headers.get("X-Razorpay-Event-Id") ?? crypto.randomUUID();
    const db = adminClient();
    const { error: dupError } = await db.from("webhook_events").insert({ provider: "razorpay", event_id: eventId });
    if (dupError) return json({ ok: true, duplicate: true });

    const event = JSON.parse(raw) as RazorpayWebhook;
    const payment = event.payload.payment?.entity;

    if (event.event === "payment.captured" && payment) {
      const orderId =
        payment.notes?.order_id ??
        (await db.from("payments").select("order_id").eq("provider_order_id", payment.order_id).maybeSingle()).data?.order_id;
      if (orderId) {
        await db.rpc("confirm_payment", {
          p_order_id: orderId,
          p_provider_order_id: payment.order_id,
          p_provider_payment_id: payment.id,
          p_method: mapRazorpayMethod(payment.method),
          p_raw: payment,
        });
      }
    } else if (event.event === "payment.failed" && payment) {
      await db.from("payments").update({ status: "failed", raw: payment }).eq("provider_order_id", payment.order_id).neq("status", "captured");
    } else if (event.event === "refund.processed" && event.payload.refund) {
      await db.from("refunds").update({ status: "processed" }).eq("provider_refund_id", event.payload.refund.entity.id);
    }
    return json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
});
