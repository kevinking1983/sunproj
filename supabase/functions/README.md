# Edge Functions

| Function | Auth | Purpose |
|---|---|---|
| `place-order` | user JWT | Transactional order placement; creates the Razorpay order for online methods |
| `verify-payment` | user JWT | Verifies the checkout signature and marks the order placed |
| `razorpay-webhook` | Razorpay signature | Authoritative payment capture / failure / refund events |
| `cancel-order` | user JWT | Customer cancellation with stock release and refund |
| `send-sms` | hook secret | Supabase Auth Send-SMS hook delivering OTPs through MSG91 |
| `notify-order` | service role key | Order status pushes to customers and assignment alerts to riders, called by the database |

Secrets (set with `supabase secrets set`): `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`,
`MSG91_AUTH_KEY`, `MSG91_OTP_TEMPLATE_ID`, `SEND_SMS_HOOK_SECRET`.

Deploy: `supabase functions deploy place-order verify-payment cancel-order` and
`supabase functions deploy razorpay-webhook send-sms notify-order --no-verify-jwt`.

Order notifications: run this once in the SQL editor of each project. It stores both values in
Supabase Vault, and the `orders_notify` trigger starts calling `notify-order`. Do not also add a
dashboard Database Webhook for orders, or every push is sent twice.

```sql
select public.set_notify_config('https://<project-ref>.supabase.co/functions/v1', '<service role key>');
```

`npm run oss:start` does this automatically for the local stack.

Typecheck locally: `cd supabase/functions && deno check */index.ts`.
