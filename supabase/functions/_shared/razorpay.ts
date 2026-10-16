/**
 * Minimal Razorpay REST client for Edge Functions (Deno/Web APIs only).
 * Docs: https://razorpay.com/docs/api/
 */
const BASE = "https://api.razorpay.com/v1";

export interface RazorpayConfig {
  keyId: string;
  keySecret: string;
  webhookSecret: string;
}

export const razorpayConfigFromEnv = (env: { get(k: string): string | undefined }): RazorpayConfig => {
  const keyId = env.get("RAZORPAY_KEY_ID");
  const keySecret = env.get("RAZORPAY_KEY_SECRET");
  const webhookSecret = env.get("RAZORPAY_WEBHOOK_SECRET") ?? "";
  if (!keyId || !keySecret) throw new Error("RAZORPAY_NOT_CONFIGURED:Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET");
  return { keyId, keySecret, webhookSecret };
};

const authHeader = (c: RazorpayConfig) => `Basic ${btoa(`${c.keyId}:${c.keySecret}`)}`;

export interface RazorpayOrder {
  id: string;
  amount: number;
  currency: string;
  receipt: string;
  status: string;
}

export const createRazorpayOrder = async (
  c: RazorpayConfig,
  params: { amountPaise: number; receipt: string; notes?: Record<string, string> },
): Promise<RazorpayOrder> => {
  const res = await fetch(`${BASE}/orders`, {
    method: "POST",
    headers: { Authorization: authHeader(c), "Content-Type": "application/json" },
    body: JSON.stringify({ amount: params.amountPaise, currency: "INR", receipt: params.receipt, notes: params.notes ?? {} }),
  });
  if (!res.ok) throw new Error(`RAZORPAY_ORDER_FAILED:${await res.text()}`);
  return (await res.json()) as RazorpayOrder;
};

export const createRazorpayRefund = async (
  c: RazorpayConfig,
  paymentId: string,
  amountPaise: number,
  notes?: Record<string, string>,
): Promise<{ id: string; status: string }> => {
  const res = await fetch(`${BASE}/payments/${paymentId}/refund`, {
    method: "POST",
    headers: { Authorization: authHeader(c), "Content-Type": "application/json" },
    body: JSON.stringify({ amount: amountPaise, speed: "optimum", notes: notes ?? {} }),
  });
  if (!res.ok) throw new Error(`RAZORPAY_REFUND_FAILED:${await res.text()}`);
  return (await res.json()) as { id: string; status: string };
};

const hmacSha256Hex = async (secret: string, message: string): Promise<string> => {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
};

const timingSafeEqual = (a: string, b: string): boolean => {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
};

/** Checkout success handler: signature = HMAC_SHA256(order_id + "|" + payment_id, key_secret). */
export const verifyPaymentSignature = async (c: RazorpayConfig, orderId: string, paymentId: string, signature: string): Promise<boolean> =>
  timingSafeEqual(await hmacSha256Hex(c.keySecret, `${orderId}|${paymentId}`), signature);

/** Webhook: X-Razorpay-Signature = HMAC_SHA256(raw body, webhook_secret). */
export const verifyWebhookSignature = async (c: RazorpayConfig, rawBody: string, signature: string): Promise<boolean> =>
  !!c.webhookSecret && timingSafeEqual(await hmacSha256Hex(c.webhookSecret, rawBody), signature);

/** Maps Razorpay's payment.method to our payment_method enum. */
export const mapRazorpayMethod = (method: string | undefined): "upi" | "card" | "netbanking" | "wallet" | null => {
  switch (method) {
    case "upi":
      return "upi";
    case "card":
    case "emi":
      return "card";
    case "netbanking":
      return "netbanking";
    case "wallet":
    case "paylater":
      return "wallet";
    default:
      return null;
  }
};
