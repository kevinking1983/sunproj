# RATION

Quick-commerce platform (groceries in minutes) for India. Monorepo with the customer mobile app, customer website, admin panel, shared packages and the Supabase backend.

## Layout

```
apps/mobile      Expo (React Native) customer app, iOS + Android
apps/web         Next.js customer website
apps/admin       Next.js admin and dark-store panel (staff only)
packages/shared  Brand theme, pricing, domain types, generated DB types
packages/api     Client-injected data layer shared by app, web and admin
supabase/        Postgres schema, RLS policies, edge functions, seed, smoke test
infra/opensource Keyless test stack: mock payment gateway, ntfy push, rider simulator
```

## Branches

- `main`: integration branch; always releasable.
- `app`: mobile app work. Merges from `main` often.
- `web`: website and admin work. Merges from `main` often.

## Stack

| Concern | Production | Open-source test stand-in |
|---|---|---|
| Backend | Supabase: Postgres + PostGIS, phone OTP auth, storage, realtime, edge functions | Supabase CLI local stack |
| Mobile | Expo SDK 58, Expo Router, TypeScript | same |
| Web / admin | Next.js 16 + Tailwind on Cloudflare Pages | same |
| Payments | Razorpay (UPI, cards, netbanking, wallets, COD); RazorpayX for payouts | `mock-gateway` with the same endpoints and signatures |
| OTP SMS | MSG91 through the Supabase send-SMS auth hook | fixed test OTPs + OTP sink |
| Maps | Ola Maps (geocoding, search, vector tiles) | OpenStreetMap: Nominatim, Photon, OSM tiles on MapLibre |
| Live tracking | MapLibre map with rider position over Supabase realtime | same, plus `simulate-rider.mjs` |
| Push | Expo push via FCM / APNs | ntfy |

## Getting started

```bash
nvm use                                   # Node 22
npm install                               # installs every workspace
cp .env.example apps/mobile/.env          # fill in keys
npm run mobile                            # Expo dev server
npm run web                               # website at http://localhost:3000
npm run admin                             # admin at http://localhost:3001 (staff or admin role)
```

Local database (needs Docker and the Supabase CLI):

```bash
npm run db:start        # Postgres, Auth, Storage, Studio at :54323; prints keys
npm run db:reset        # applies migrations + seed.sql
npm run db:types        # regenerates packages/shared/src/database.types.ts
npm run functions:serve # edge functions with supabase/functions/.env
```

## Open-source test stack

Run everything with no paid accounts: local Supabase, the mock Razorpay/MSG91 gateway,
OpenStreetMap maps, ntfy push and a rider simulator. See `infra/opensource/README.md`.

```bash
npm run db:start && npm run db:reset
npm run oss:up
npm run functions:serve
cp .env.opensource.example apps/mobile/.env && npm run mobile
npm run oss:rider -- RT100001   # streams a rider to an order's address
```

## Staff access

Everyone signs up as a customer. Promote your own account once with SQL (Studio or `psql`):

```sql
update public.profiles set role = 'admin' where phone = '91XXXXXXXXXX';
```

After that, admins change roles from the People page in the admin panel.

## Quality gates

CI (`.github/workflows/ci.yml`) typechecks every workspace, lints and builds the apps,
typechecks the edge functions with Deno, and applies every migration plus
`supabase/tests/smoke.sql` on a PostGIS container.

## Money

All amounts are integer paise. Use `formatInr()` from `@ration/shared` for display. The
bill is computed in `packages/shared/src/pricing.ts` for previews and mirrored in the
`place_order` SQL function, which is the source of truth at checkout.

## Brand

Colours live in `packages/shared/src/theme/colors.ts` (app) and `apps/web/src/app/globals.css`
(web) with the measured contrast rules. Gold surfaces take dark text, never white.
