# RATION

Quick-commerce platform (groceries in minutes) for India. Monorepo with the mobile app, website, admin panel and Supabase backend.

## Layout

```
apps/mobile      Expo (React Native) customer app, iOS + Android
apps/web         Next.js customer website            (web branch)
apps/admin       Next.js admin and dark-store panel  (web branch)
packages/shared  Brand theme, domain types, generated DB types
supabase/        Postgres schema, RLS policies, edge functions, seed
```

## Branches

- `main`: integration branch. Backend (`supabase/`) and `packages/shared` land here first.
- `app`: mobile app work. Merges from `main` often.
- `web`: website and admin work. Merges from `main` often.

## Stack

| Concern | Choice |
|---|---|
| Backend | Supabase: Postgres + PostGIS, phone OTP auth, storage, realtime, edge functions |
| Mobile | Expo SDK 58, Expo Router, TypeScript |
| Web / admin | Next.js on Cloudflare Pages |
| Payments | Razorpay (UPI, cards, netbanking, wallets, COD), RazorpayX for payouts |
| OTP SMS | MSG91 through the Supabase send-SMS auth hook |
| Maps | Ola Maps primary, Google Maps fallback |
| Push | Expo push via FCM / APNs |

## Getting started

```bash
nvm use                 # Node 22
npm install             # installs every workspace
cp .env.example apps/mobile/.env   # fill in keys
npm run mobile          # Expo dev server
```

Local database (needs Docker and the Supabase CLI):

```bash
npm run db:start        # starts Postgres, Auth, Storage, Studio at :54323
npm run db:reset        # applies migrations + seed.sql
npm run db:types        # regenerates packages/shared/src/database.types.ts
```

## Money

All amounts are integer paise. Use `formatInr()` from `@ration/shared` for display.

## Brand

Colours live in `packages/shared/src/theme/colors.ts` with the measured contrast rules. Gold surfaces take dark text, never white.
