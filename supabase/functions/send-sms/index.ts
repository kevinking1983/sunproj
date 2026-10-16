/**
 * Supabase Auth "Send SMS" hook backed by MSG91.
 * Configure in Dashboard > Authentication > Hooks > Send SMS with this function's URL and
 * the hook secret (SEND_SMS_HOOK_SECRET). Deploy with --no-verify-jwt.
 * Payload: { user: { phone }, sms: { otp } }
 */
import { Webhook } from "npm:standardwebhooks@1";

import { json } from "../_shared/http.ts";

interface SendSmsPayload {
  user: { phone: string };
  sms: { otp: string };
}

Deno.serve(async (req) => {
  const secret = Deno.env.get("SEND_SMS_HOOK_SECRET") ?? "";
  const authKey = Deno.env.get("MSG91_AUTH_KEY") ?? "";
  const templateId = Deno.env.get("MSG91_OTP_TEMPLATE_ID") ?? "";
  if (!secret || !authKey || !templateId) return json({ error: "SMS hook not configured" }, 500);

  const raw = await req.text();
  const headers = Object.fromEntries(req.headers);
  let payload: SendSmsPayload;
  try {
    const wh = new Webhook(secret.replace("v1,whsec_", ""));
    payload = wh.verify(raw, headers) as SendSmsPayload;
  } catch {
    return json({ error: "INVALID_SIGNATURE" }, 401);
  }

  // MSG91 OTP API with a DLT-approved template that contains the ##OTP## variable.
  const base = (Deno.env.get("MSG91_BASE_URL") ?? "https://control.msg91.com").replace(/\/$/, "");
  const res = await fetch(`${base}/api/v5/otp`, {
    method: "POST",
    headers: { authkey: authKey, "Content-Type": "application/json" },
    body: JSON.stringify({ template_id: templateId, mobile: payload.user.phone.replace(/^\+/, ""), otp: payload.sms.otp, otp_expiry: 10 }),
  });
  if (!res.ok) return json({ error: "SMS_SEND_FAILED", detail: await res.text() }, 500);
  return json({});
});
