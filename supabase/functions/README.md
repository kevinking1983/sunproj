# Edge Functions

| Function | Auth | Purpose |
|---|---|---|
| `place-order` | user JWT | Transactional order placement; creates the Razorpay order for online methods |
| `verify-payment` | user JWT | Verifies the checkout signature and marks the order placed |
| `razorpay-webhook` | Razorpay signature | Authoritative payment capture / failure / refund events |
| `cancel-order` | user JWT | Customer cancellation with stock release and refund |
| `send-sms` | hook secret | Supabase Auth Send-SMS hook delivering OTPs through MSG91 |

Secrets (set with `supabase secrets set`): `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`,
`MSG91_AUTH_KEY`, `MSG91_OTP_TEMPLATE_ID`, `SEND_SMS_HOOK_SECRET`.

Deploy: `supabase functions deploy place-order verify-payment cancel-order` and
`supabase functions deploy razorpay-webhook send-sms --no-verify-jwt`.

Typecheck locally: `cd supabase/functions && deno check **/index.ts`.
