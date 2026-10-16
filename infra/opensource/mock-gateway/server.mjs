/**
 * RATION mock gateway: FOR LOCAL TESTING ONLY.
 *
 * Imitates the slice of Razorpay and MSG91 that the platform uses so the full
 * order and payment flow runs with no third-party accounts:
 *
 *   POST /v1/orders                      create order   (Razorpay shape)
 *   POST /v1/payments/:id/refund         refund         (Razorpay shape)
 *   GET  /checkout?order_id=&redirect=   hosted "checkout" page with Pay / Fail buttons
 *   POST /checkout/complete              signs the result like Razorpay and fires the webhook
 *   POST /api/v5/otp                     MSG91 OTP endpoint: logs the OTP
 *   POST /hooks/send-sms                 Supabase send-SMS hook target: logs the OTP
 *   GET  /otps                           last OTPs (for tests)
 *   GET  /payments  /orders  /health     inspection
 *
 * Signatures use the same HMAC scheme as Razorpay, with RAZORPAY_KEY_SECRET and
 * RAZORPAY_WEBHOOK_SECRET, so the real verify-payment and razorpay-webhook edge
 * functions validate them unchanged.
 */
import { createHmac, randomBytes } from "node:crypto";
import { createServer } from "node:http";

if (process.env.NODE_ENV === "production") {
  console.error("mock-gateway refuses to run with NODE_ENV=production");
  process.exit(1);
}

const PORT = Number(process.env.PORT ?? 4010);
const KEY_SECRET = process.env.RAZORPAY_KEY_SECRET ?? "mock_key_secret";
const WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET ?? "mock_webhook_secret";
const WEBHOOK_URL = process.env.WEBHOOK_URL ?? ""; // e.g. http://host.docker.internal:54321/functions/v1/razorpay-webhook

const orders = new Map();
const payments = new Map();
const otps = [];
const id = (prefix) => `${prefix}_${randomBytes(7).toString("hex")}`;
const hmac = (secret, msg) => createHmac("sha256", secret).update(msg).digest("hex");

const readBody = (req) =>
  new Promise((resolve) => {
    let data = "";
    req.on("data", (c) => (data += c));
    req.on("end", () => resolve(data));
  });

const send = (res, status, body, headers = {}) => {
  const isJson = typeof body !== "string";
  res.writeHead(status, { "Content-Type": isJson ? "application/json" : "text/html; charset=utf-8", "Access-Control-Allow-Origin": "*", ...headers });
  res.end(isJson ? JSON.stringify(body) : body);
};

const fireWebhook = async (event, payload) => {
  if (!WEBHOOK_URL) return;
  const body = JSON.stringify({ entity: "event", event, payload, created_at: Math.floor(Date.now() / 1000) });
  try {
    const res = await fetch(WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Razorpay-Signature": hmac(WEBHOOK_SECRET, body), "X-Razorpay-Event-Id": id("evt") },
      body,
    });
    console.log(`webhook ${event} -> ${res.status}`);
  } catch (e) {
    console.log(`webhook ${event} failed: ${e.message}`);
  }
};

const page = (order, redirect) => `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Mock checkout</title>
<style>
  :root{--g:#20543B;--d:#123C2D;--gold:#D9A441;--ivory:#FFFCF6;--ink:#202820;--muted:#667267}
  body{margin:0;font-family:system-ui,sans-serif;background:var(--ivory);color:var(--ink)}
  main{max-width:420px;margin:0 auto;padding:24px}
  .card{background:#fff;border:1px solid #E6E2D8;border-radius:16px;padding:20px}
  h1{font-size:20px;margin:0 0 4px}.m{color:var(--muted);font-size:14px}
  .amt{font-size:32px;font-weight:700;margin:16px 0}
  button{width:100%;border:0;border-radius:12px;padding:14px;font-size:16px;font-weight:600;margin-top:10px;cursor:pointer}
  .pay{background:var(--gold);color:var(--ink)}.fail{background:#fff;color:#B42318;border:1.5px solid #B42318}.cancel{background:#fff;color:var(--muted)}
  .tag{display:inline-block;background:#FBE9E7;color:#B42318;border-radius:999px;padding:2px 10px;font-size:12px;font-weight:600}
</style></head><body><main>
<div class="card"><span class="tag">MOCK GATEWAY · TEST ONLY</span>
<h1 style="margin-top:10px">RATION</h1><div class="m">${order.receipt}</div>
<div class="amt">₹${(order.amount / 100).toFixed(2)}</div>
<form method="post" action="/checkout/complete">
<input type="hidden" name="order_id" value="${order.id}"><input type="hidden" name="redirect" value="${redirect}">
<button class="pay" name="outcome" value="success">Pay with mock UPI</button>
<button class="fail" name="outcome" value="failed">Simulate failure</button>
<button class="cancel" name="outcome" value="cancelled">Cancel</button>
</form></div></main></body></html>`;

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const { pathname } = url;
  if (req.method === "OPTIONS") return send(res, 204, "");

  if (pathname === "/health") return send(res, 200, { ok: true, orders: orders.size, payments: payments.size });
  if (pathname === "/orders" && req.method === "GET") return send(res, 200, [...orders.values()]);
  if (pathname === "/payments" && req.method === "GET") return send(res, 200, [...payments.values()]);
  if (pathname === "/otps" && req.method === "GET") return send(res, 200, otps.slice(-20));

  // ---- Razorpay: orders --------------------------------------------------
  if (pathname === "/v1/orders" && req.method === "POST") {
    const body = JSON.parse((await readBody(req)) || "{}");
    const order = { id: id("order"), entity: "order", amount: body.amount, amount_paid: 0, currency: body.currency ?? "INR", receipt: body.receipt, notes: body.notes ?? {}, status: "created", created_at: Math.floor(Date.now() / 1000) };
    orders.set(order.id, order);
    console.log(`order ${order.id} ${order.receipt} ₹${order.amount / 100}`);
    return send(res, 200, order);
  }

  // ---- Razorpay: refunds -------------------------------------------------
  const refund = pathname.match(/^\/v1\/payments\/([^/]+)\/refund$/);
  if (refund && req.method === "POST") {
    const payment = payments.get(refund[1]);
    if (!payment) return send(res, 400, { error: { code: "BAD_REQUEST_ERROR", description: "payment not found" } });
    const body = JSON.parse((await readBody(req)) || "{}");
    const r = { id: id("rfnd"), entity: "refund", amount: body.amount ?? payment.amount, payment_id: payment.id, status: "processed", created_at: Math.floor(Date.now() / 1000) };
    payment.status = "refunded";
    console.log(`refund ${r.id} for ${payment.id} ₹${r.amount / 100}`);
    setTimeout(() => fireWebhook("refund.processed", { refund: { entity: r }, payment: { entity: payment } }), 300);
    return send(res, 200, r);
  }

  // ---- Hosted checkout ---------------------------------------------------
  if (pathname === "/checkout" && req.method === "GET") {
    const order = orders.get(url.searchParams.get("order_id") ?? "");
    if (!order) return send(res, 404, "<p>Unknown order</p>");
    return send(res, 200, page(order, url.searchParams.get("redirect") ?? ""));
  }
  if (pathname === "/checkout/complete" && req.method === "POST") {
    const form = new URLSearchParams(await readBody(req));
    const order = orders.get(form.get("order_id") ?? "");
    const redirect = form.get("redirect") ?? "";
    const outcome = form.get("outcome");
    if (!order) return send(res, 404, "<p>Unknown order</p>");
    const target = new URL(redirect || "about:blank");
    if (outcome === "success") {
      const payment = { id: id("pay"), entity: "payment", order_id: order.id, amount: order.amount, currency: order.currency, method: "upi", status: "captured", notes: order.notes, created_at: Math.floor(Date.now() / 1000) };
      payments.set(payment.id, payment);
      order.status = "paid";
      order.amount_paid = order.amount;
      target.searchParams.set("razorpay_order_id", order.id);
      target.searchParams.set("razorpay_payment_id", payment.id);
      target.searchParams.set("razorpay_signature", hmac(KEY_SECRET, `${order.id}|${payment.id}`));
      console.log(`payment ${payment.id} captured for ${order.id}`);
      setTimeout(() => fireWebhook("payment.captured", { payment: { entity: payment } }), 500);
    } else if (outcome === "failed") {
      const payment = { id: id("pay"), entity: "payment", order_id: order.id, amount: order.amount, currency: order.currency, method: "upi", status: "failed", error_description: "Mock failure", notes: order.notes };
      target.searchParams.set("error", "PAYMENT_FAILED");
      setTimeout(() => fireWebhook("payment.failed", { payment: { entity: payment } }), 500);
    } else {
      target.searchParams.set("error", "PAYMENT_CANCELLED");
    }
    res.writeHead(302, { Location: target.toString() });
    return res.end();
  }

  // ---- OTP sinks ---------------------------------------------------------
  if ((pathname === "/api/v5/otp" || pathname === "/hooks/send-sms") && req.method === "POST") {
    const body = JSON.parse((await readBody(req)) || "{}");
    const entry = pathname === "/api/v5/otp"
      ? { phone: body.mobile, otp: body.otp, via: "msg91-mock", at: new Date().toISOString() }
      : { phone: body.user?.phone, otp: body.sms?.otp, via: "supabase-hook", at: new Date().toISOString() };
    otps.push(entry);
    console.log(`OTP for ${entry.phone}: ${entry.otp}`);
    return send(res, 200, pathname === "/api/v5/otp" ? { type: "success", message: id("req") } : {});
  }

  send(res, 404, { error: "not found" });
});

server.listen(PORT, () => console.log(`mock-gateway listening on :${PORT} (webhook -> ${WEBHOOK_URL || "disabled"})`));
