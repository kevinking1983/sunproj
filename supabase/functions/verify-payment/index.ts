/**
 * POST /verify-payment
 * Body: { order_id, razorpay_order_id, razorpay_payment_id, razorpay_signature }
 * Called by the app right after Razorpay Checkout succeeds. The webhook is the
 * authoritative backstop if the app dies before this call.
 */
import { errorResponse, handleOptions, HttpError, json } from "../_shared/http.ts";
import { razorpayConfigFromEnv, verifyPaymentSignature } from "../_shared/razorpay.ts";
import { adminClient, requireUser } from "../_shared/supabase.ts";

Deno.serve(async (req) => {
  const options = handleOptions(req);
  if (options) return options;
  try {
    if (req.method !== "POST") throw new HttpError(405, "METHOD_NOT_ALLOWED");
    const user = await requireUser(req);
    const { order_id, razorpay_order_id, razorpay_payment_id, razorpay_signature } = await req.json();
    if (!order_id || !razorpay_order_id || !razorpay_payment_id || !razorpay_signature) throw new HttpError(400, "BAD_REQUEST");

    const db = adminClient();
    const { data: order } = await db.from("orders").select("id, user_id").eq("id", order_id).maybeSingle();
    if (!order || order.user_id !== user.id) throw new HttpError(404, "ORDER_NOT_FOUND");

    const { data: payment } = await db.from("payments").select("provider_order_id").eq("order_id", order_id).eq("provider", "razorpay").maybeSingle();
    if (!payment || payment.provider_order_id !== razorpay_order_id) throw new HttpError(400, "ORDER_MISMATCH");

    const cfg = razorpayConfigFromEnv(Deno.env);
    const ok = await verifyPaymentSignature(cfg, razorpay_order_id, razorpay_payment_id, razorpay_signature);
    if (!ok) throw new HttpError(400, "INVALID_SIGNATURE");

    const { data: status, error } = await db.rpc("confirm_payment", {
      p_order_id: order_id,
      p_provider_order_id: razorpay_order_id,
      p_provider_payment_id: razorpay_payment_id,
    });
    if (error) throw new Error(error.message);
    return json({ order_id, status });
  } catch (e) {
    return errorResponse(e);
  }
});
