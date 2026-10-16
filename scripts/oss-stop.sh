#!/usr/bin/env bash
set -u
cd "$(dirname "${BASH_SOURCE[0]}")/.."
command -v pkill >/dev/null && pkill -f "supabase functions serve" 2>/dev/null || true
docker compose -f infra/opensource/docker-compose.yml down
npx supabase stop
echo "Open-source test stack stopped."
