#!/usr/bin/env bash
# Health checks for the open-source test stack.
set -u
ok=0; bad=0
check() { # label url
  if curl -fsS -m 5 -o /dev/null "$2"; then printf '  \033[32m✓\033[0m %s\n' "$1"; ok=$((ok+1)); else printf '  \033[31m✗\033[0m %s  (%s)\n' "$1" "$2"; bad=$((bad+1)); fi
}
check "Supabase API"        "http://127.0.0.1:54321/rest/v1/"
check "Supabase Auth"       "http://127.0.0.1:54321/auth/v1/health"
check "Supabase Studio"     "http://127.0.0.1:54323/"
check "Mock gateway"        "http://127.0.0.1:4010/health"
check "ntfy"                "http://127.0.0.1:4020/v1/health"
check "Edge functions"      "http://127.0.0.1:54321/functions/v1/place-order"   # 401/405 counts as reachable below
if curl -sS -m 5 -o /dev/null -w '%{http_code}' -X OPTIONS http://127.0.0.1:54321/functions/v1/place-order | grep -q "200"; then :; fi
[ "$bad" -eq 0 ] && echo "All services healthy." || { echo "$bad service(s) not reachable. If only edge functions fail, run: npm run functions:serve"; exit 1; }
