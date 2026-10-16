/**
 * POST /cancel-order  Body: { order_id, reason? }
 * Customers may cancel until the store starts packing. Releases stock and refunds:
 * wallet refunds happen inside the RPC; online refunds are issued here through Razorpay.
 */
import { errorResponse, handleOptions, HttpError, json } from "../_shared/http.ts";
import { createRazorpayRefund, razorpayConfigFromEnv } from "../_shared/razorpay.ts";
import { adminClient, requireUser } from "../_shared/supabase.ts";

Deno.serve(async (req) => {
  const options = handleOptions(req);
  if (options) return options;
  try {
    if (req.method !== "POST") throw new HttpError(405, "METHOD_NOT_ALLOWED");
    const user = await requireUser(req);
    const { order_id, reason } = await req.json();
    if (!order_id) throw new HttpError(400, "BAD_REQUEST");

    const db = adminClient();
    const { data, error } = await db.rpc("cancel_order", {
      p_order_id: order_id,
      p_actor: user.id,
      p_reason: reason ?? "Cancelled by customer",
      p_by_customer: true,
    });
    if (error) throw new Error(error.message);
    const result = data as { refund_online: number; payment_id: string | null; payment_row_id: string | null };

    if (result.refund_online > 0 && result.payment_id && result.payment_row_id) {
      const cfg = razorpayConfigFromEnv(Deno.env);
      const refund = await createRazorpayRefund(cfg, result.payment_id, result.refund_online, { order_id });
      await db.from("refunds").insert({
        payment_id: result.payment_row_id,
        provider_refund_id: refund.id,
        amount: result.refund_online,
        reason: reason ?? "Cancelled by customer",
        status: refund.status,
      });
      await db.from("payments").update({ status: "refunded" }).eq("id", result.payment_row_id);
    }
    return json({ order_id, status: "cancelled", refund_online: result.refund_online });
  } catch (e) {
    return errorResponse(e);
  }
});
