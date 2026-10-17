# Feature parity: production stack vs open-source test stack

One codebase, one feature set. The rows below list every customer, partner and staff feature,
the service that powers it in production, and the free or open-source stand-in used by
`npm run oss:start`. "Same" means the exact same code path runs; only the endpoint differs.

| Feature | Production | Open-source test stack | Code path |
|---|---|---|---|
| Phone OTP login (app, web, partner, admin) | Supabase Auth + MSG91 SMS | Supabase Auth local; fixed OTP `123456` for test numbers, other numbers' OTPs printed by the mock at `/otps` | Same |
| Sessions, profiles, roles | Supabase Auth + Postgres RLS | Same, local | Same |
| Delivery location: GPS, search, reverse geocode | Ola Maps | OpenStreetMap: Nominatim + Photon (device geocoder fallback in the app) | Same, provider switch |
| Serviceability by dark-store radius | PostGIS | Same, local | Same |
| Saved addresses | Postgres | Same | Same |
| Home, categories, banners, product rails, product page | Postgres + Supabase Storage images | Same, local storage | Same |
| Search with typo tolerance and ranking | Postgres full text + trigram | Same | Same |
| Cart, coupons, tip, bill | Shared pricing + `place_order` SQL | Same | Same |
| Online payment: UPI, cards, netbanking, wallets | Razorpay Checkout + REST + webhooks | Mock gateway: same endpoints, hosted checkout page, HMAC signatures, webhooks | Same, base URL switch |
| Cash on delivery | Postgres | Same | Same |
| RATION wallet, refunds, cancellation | SQL + Razorpay refund API | Same + mock refund endpoint | Same |
| Payment verification and idempotency | Edge functions | Same, served locally | Same |
| Order tracking: status timeline | Supabase Realtime | Same, local | Same |
| Live rider map | MapLibre + Ola vector tiles | MapLibre + OpenStreetMap raster tiles | Same, style switch |
| Rider position publishing (foreground + background) | Partner app + `rider_update_location` | Same, or the rider simulator | Same |
| Push notifications: order status, rider assignment | Expo push (FCM / APNs) | ntfy self-hosted (phone app subscribes to `ration-<user id>`) | Same function, provider switch |
| Referral rewards, product ratings | SQL triggers | Same | Same |
| Partner app: online toggle, pool, claim, steps, cash confirmation, earnings | SQL rider RPCs | Same | Same |
| Automatic rider assignment: nearest free online rider when packing starts, decline hands over to the next, waiting orders picked up when a rider comes online or finishes | SQL trigger + `rider_decline_order` | Same | Same |
| Admin: dashboard, orders board, inventory, products, categories, coupons, banners, stores, people | Next.js + staff RPCs | Same, local | Same |
| Image upload (products, banners, categories) | Supabase Storage | Same, local | Same |
| Website and admin hosting | Cloudflare Pages | `next dev` on localhost | Same build |
| App distribution | EAS Build + stores | Expo Go for everything except the native map (needs a free local or EAS development build) | Same |

## Not implemented in either stack

- Rider and vendor payouts (RazorpayX). The partner app shows cash to deposit; settlement is manual for now.
- In-app support chat. Support is WhatsApp, call and email links.

## Limits of the free stand-ins

- Public OpenStreetMap endpoints allow about one request per second and are for testing only.
  Self-host Nominatim with `--profile geocoder` for heavier use.
- ntfy delivers notifications through the ntfy app rather than the RATION app icon.
- The mock gateway never moves real money and refuses to start with `NODE_ENV=production`.
