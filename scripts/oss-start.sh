#!/usr/bin/env bash
# One-command start for the open-source test stack. Idempotent: re-run any time.
#
#   npm run oss:start            # everything
#   npm run oss:start -- --no-functions   # skip the edge functions server (run `npm run functions:serve` yourself)
#
# Needs: Docker (running), Node >= 20, the Supabase CLI (installed as a dev dependency).
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

say() { printf '\n\033[1;32m==> %s\033[0m\n' "$*"; }
die() { printf '\n\033[1;31m%s\033[0m\n' "$*" >&2; exit 1; }

case "$(uname -s)" in MINGW*|MSYS*|CYGWIN*) export MSYS_NO_PATHCONV=1 ;; esac   # Git Bash: keep /v1 style paths intact
command -v docker >/dev/null || die "Docker is not installed. Install Docker Desktop and start it."
docker info >/dev/null 2>&1 || die "Docker is installed but not running. Start Docker Desktop and retry."
[ -d node_modules ] || { say "Installing dependencies"; npm install; }

# Your machine's LAN address, so a phone running Expo Go can reach the local stack.
# Resolved with Node so it works the same on Windows (Git Bash / WSL), macOS and Linux.
LAN_IP="$(node -e 'const n=require("os").networkInterfaces();const a=Object.values(n).flat().find(i=>i&&i.family==="IPv4"&&!i.internal&&!i.address.startsWith("169.254"));console.log(a?a.address:"127.0.0.1")')"

say "Starting Supabase (Postgres, Auth, Storage, Realtime, Studio)"
npx supabase start >/dev/null
STATUS="$(npx supabase status -o json)"
API_URL="$(printf '%s' "$STATUS" | node -e 'const s=JSON.parse(require("fs").readFileSync(0,"utf8"));console.log(s.API_URL)')"
ANON="$(printf '%s' "$STATUS" | node -e 'const s=JSON.parse(require("fs").readFileSync(0,"utf8"));console.log(s.ANON_KEY)')"
SERVICE="$(printf '%s' "$STATUS" | node -e 'const s=JSON.parse(require("fs").readFileSync(0,"utf8"));console.log(s.SERVICE_ROLE_KEY)')"
STUDIO="$(printf '%s' "$STATUS" | node -e 'const s=JSON.parse(require("fs").readFileSync(0,"utf8"));console.log(s.STUDIO_URL||"http://127.0.0.1:54323")')"

say "Applying migrations and seed"
npx supabase db reset >/dev/null

say "Starting mock gateway and ntfy"
docker compose -f infra/opensource/docker-compose.yml up -d --build >/dev/null

say "Writing environment files"
write_env() { # file, then KEY=VALUE lines on stdin; keeps other existing lines
  local f="$1"; mkdir -p "$(dirname "$f")"; touch "$f"
  while IFS= read -r line; do
    local k="${line%%=*}"
    if grep -q "^${k}=" "$f"; then sed -i.bak "s|^${k}=.*|${line}|" "$f" && rm -f "$f.bak"; else printf '%s\n' "$line" >> "$f"; fi
  done
}
write_env apps/web/.env.local <<ENV
NEXT_PUBLIC_SUPABASE_URL=$API_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=$ANON
NEXT_PUBLIC_PAYMENT_PROVIDER=mock
NEXT_PUBLIC_MOCK_GATEWAY_URL=http://127.0.0.1:4010
NEXT_PUBLIC_MAPS_PROVIDER=osm
ENV
write_env apps/admin/.env.local <<ENV
NEXT_PUBLIC_SUPABASE_URL=$API_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=$ANON
ENV
for app in mobile rider; do
write_env "apps/$app/.env" <<ENV
EXPO_PUBLIC_SUPABASE_URL=http://$LAN_IP:54321
EXPO_PUBLIC_SUPABASE_ANON_KEY=$ANON
EXPO_PUBLIC_PAYMENT_PROVIDER=mock
EXPO_PUBLIC_MOCK_GATEWAY_URL=http://$LAN_IP:4010
EXPO_PUBLIC_MAPS_PROVIDER=osm
ENV
done
write_env supabase/functions/.env <<ENV
RAZORPAY_BASE_URL=http://host.docker.internal:4010/v1
RAZORPAY_KEY_ID=rzp_test_mock
RAZORPAY_KEY_SECRET=mock_key_secret
RAZORPAY_WEBHOOK_SECRET=mock_webhook_secret
MSG91_BASE_URL=http://host.docker.internal:4010
MSG91_AUTH_KEY=mock
MSG91_OTP_TEMPLATE_ID=mock
SEND_SMS_HOOK_SECRET=v1,whsec_bW9ja19zZW5kX3Ntc19ob29rX3NlY3JldA==
PUSH_PROVIDER=ntfy
NTFY_URL=http://host.docker.internal:4020
ENV
printf 'SUPABASE_SERVICE_ROLE_KEY=%s\nSUPABASE_URL=%s\n' "$SERVICE" "$API_URL" > .oss.env

if [[ " $* " != *" --no-functions "* ]]; then
  say "Starting edge functions (log: .oss-functions.log)"
  command -v pkill >/dev/null && pkill -f "supabase functions serve" 2>/dev/null || true
  nohup npx supabase functions serve --env-file supabase/functions/.env --no-verify-jwt > .oss-functions.log 2>&1 &
  sleep 3
fi

say "Checking services"
bash scripts/oss-check.sh || true

cat <<NEXT

Everything is up. Next:

  npm run web          website  -> http://localhost:3000   (login 9999900001, OTP 123456)
  npm run admin        admin    -> http://localhost:3001   (promote yourself first, see below)
  npm run mobile       customer app in Expo Go (phone must be on the same Wi-Fi; API at http://$LAN_IP:54321)
  npm run rider        partner app in Expo Go

  Studio:              $STUDIO
  Mock gateway:        http://localhost:4010/health   (orders, payments, otps)
  ntfy:                http://localhost:4020

Make yourself admin after first login (Studio > SQL):
  update public.profiles set role = 'admin' where phone = '919999900001';

Simulate a rider on an order:
  set -a; source .oss.env; set +a; npm run oss:rider -- RT100001

Stop everything:  npm run oss:stop
NEXT
