# Open-source test stack

Runs the whole platform on your laptop with **no paid accounts**. Every third-party
provider is swapped for an open-source or local stand-in by environment variable, so
the production code paths are exercised unchanged.

| Production | Test stand-in | Switch |
|---|---|---|
| Supabase cloud | Supabase CLI local stack (Postgres, Auth, PostgREST, Realtime, Storage, Edge runtime, Studio) | `npm run db:start` |
| Razorpay | `mock-gateway` (same endpoints, HMAC signatures and webhooks) | `RAZORPAY_BASE_URL`, `EXPO_PUBLIC_PAYMENT_PROVIDER=mock` |
| MSG91 OTP SMS | fixed test OTPs in `supabase/config.toml`, plus the mock's OTP sink for any other number | built in |
| Ola / Google Maps | OpenStreetMap: Nominatim (reverse geocode) + Photon (autocomplete), public or self-hosted | `EXPO_PUBLIC_MAPS_PROVIDER=osm` |
| Expo push | ntfy (self-hosted) | `PUSH_PROVIDER=ntfy` |

## Start

```bash
# 1. Supabase local stack (Docker)
npm run db:start            # prints the API URL, anon key and service role key
npm run db:reset            # applies migrations + seed

# 2. Stand-in services
docker compose -f infra/opensource/docker-compose.yml up -d
#    add --profile geocoder for a self-hosted Nominatim (optional, heavy)

# 3. Edge functions with the test environment
cp supabase/functions/.env.example supabase/functions/.env   # already points at the mocks
npm run functions:serve

# 4. App
cp .env.opensource.example apps/mobile/.env                   # fill the anon key from step 1
npm run mobile
```

Log in with `9999900001` and OTP `123456` (see `[auth.sms.test_otp]`). Any other number
sends its OTP to the mock, visible at <http://localhost:4010/otps> and in the container log.

## Paying

Choose **Pay online** at checkout. Instead of the native Razorpay SDK, the app opens the
mock's hosted checkout page in a browser sheet. **Pay with mock UPI** signs the result the
way Razorpay does, redirects back into the app (`ration://payment`), and fires a
`payment.captured` webhook at the local `razorpay-webhook` function, so both the
in-app verification and the webhook path run for real. Refunds on cancellation call the
mock's refund endpoint and fire `refund.processed`.

Inspect state at `/orders`, `/payments`, `/otps`, `/health` on port 4010.

## Push notifications

Install the ntfy app (iOS/Android/web) and subscribe to the topic `ration-<your user id>`
on `http://<your-lan-ip>:4020`. `notify-order` publishes there when `PUSH_PROVIDER=ntfy`.

## Maps

`EXPO_PUBLIC_MAPS_PROVIDER=osm` uses the public OpenStreetMap endpoints by default
(Nominatim usage policy: max 1 request/second, identify your app, testing only). Point
`EXPO_PUBLIC_NOMINATIM_URL` at `http://<lan-ip>:4030` once the optional self-hosted
geocoder has imported its region.

## Never in production

`mock-gateway` exits if `NODE_ENV=production`. The switches above default to the real
providers, and the production `.env` must not contain `mock` or `osm` values.
