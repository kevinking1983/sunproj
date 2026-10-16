/**
 * POST /place-order
 * Body: { store_id, address_id, items: [{product_id, quantity}], payment_method, coupon_code?, tip?, note? }
 * Header: Idempotency-Key (the app sends a UUID per checkout attempt)
 *
 * 1. Authenticates the user.
 * 2. Runs the transactional place_order RPC (stock, pricing, coupon all server-side).
 * 3. For online methods, creates a Razorpay order and returns the checkout parameters.
 */
import { errorResponse, handleOptions, HttpError, json } from "../_shared/http.ts";
import { createRazorpayOrder, razorpayConfigFromEnv } from "../_shared/razorpay.ts";
import { adminClient, requireUser } from "../_shared/supabase.ts";

const ONLINE_METHODS = new Set(["upi", "card", "netbanking", "wallet"]);
const ALL_METHODS = new Set([...ONLINE_METHODS, "cod", "ration_wallet"]);

interface PlaceOrderBody {
  store_id: string;
  address_id: string;
  items: { product_id: string; quantity: number }[];
  payment_method: string;
  coupon_code?: string | null;
  tip?: number;
  note?: string | null;
}

Deno.serve(async (req) => {
  const options = handleOptions(req);
  if (options) return options;
  try {
    if (req.method !== "POST") throw new HttpError(405, "METHOD_NOT_ALLOWED");
    const user = await requireUser(req);
    const body = (await req.json()) as PlaceOrderBody;
    if (!body.store_id || !body.address_id || !Array.isArray(body.items) || !ALL_METHODS.has(body.payment_method)) {
      throw new HttpError(400, "BAD_REQUEST");
    }
    const idempotencyKey = req.headers.get("Idempotency-Key");
    const db = adminClient();

    if (idempotencyKey) {
      const { data: prior } = await db.from("idempotency_keys").select("response").eq("key", idempotencyKey).eq("user_id", user.id).maybeSingle();
      if (prior?.response) return json(prior.response);
    }

    const { data, error } = await db.rpc("place_order", {
      p_user_id: user.id,
      p_store_id: body.store_id,
      p_address_id: body.address_id,
      p_items: body.items,
      p_payment_method: body.payment_method,
      p_coupon_code: body.coupon_code ?? null,
      p_tip: body.tip ?? 0,
      p_customer_note: body.note ?? null,
    });
    if (error) throw new Error(error.message);
    const placed = data as { order_id: string; order_number: string; status: string; total: number };

    let checkout: Record<string, unknown> | null = null;
    if (ONLINE_METHODS.has(body.payment_method)) {
      const cfg = razorpayConfigFromEnv(Deno.env);
      const rzp = await createRazorpayOrder(cfg, {
        amountPaise: placed.total,
        receipt: placed.order_number,
        notes: { order_id: placed.order_id, user_id: user.id },
      });
      await db.rpc("attach_provider_order", { p_order_id: placed.order_id, p_provider_order_id: rzp.id });
      checkout = {
        key_id: cfg.keyId,
        razorpay_order_id: rzp.id,
        amount: rzp.amount,
        currency: rzp.currency,
        name: "RATION",
        description: `Order ${placed.order_number}`,
        prefill: { contact: user.phone ?? undefined },
        theme: { color: "#20543B" },
      };
    }

    const response = { ...placed, checkout };
    if (idempotencyKey) {
      await db.from("idempotency_keys").upsert({ key: idempotencyKey, user_id: user.id, response });
    }
    return json(response);
  } catch (e) {
    return errorResponse(e);
  }
});
