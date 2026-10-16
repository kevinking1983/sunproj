// One-command start for the open-source test stack. Idempotent: re-run any time.
//
//   npm run oss:start                   everything
//   npm run oss:start -- --no-functions skip the edge functions server
//
// Needs: Docker Desktop running, Node >= 20. The Supabase CLI is a dev dependency (npx).
import fs from "node:fs";
import path from "node:path";

import { ROOT, checkAll, die, has, lanIp, run, say, startDetached, writeEnv } from "./oss-lib.mjs";

const args = process.argv.slice(2);
process.chdir(ROOT);

if (!has("docker")) die("Docker is not installed. Install Docker Desktop and start it.");
try {
  run("docker", ["info"], { quiet: true });
} catch {
  die("Docker is installed but not running. Start Docker Desktop, wait for it to say 'running', then retry.");
}
if (!fs.existsSync(path.join(ROOT, "node_modules"))) {
  say("Installing dependencies");
  run("npm", ["install"]);
}

const ip = lanIp();

say("Starting Supabase (Postgres, Auth, Storage, Realtime, Studio). First run downloads images; be patient.");
run("npx", ["supabase", "start"]);

let status;
try {
  status = JSON.parse(run("npx", ["supabase", "status", "-o", "json"], { quiet: true }));
} catch (e) {
  die(`Could not read Supabase status: ${e.message}`);
}
const API_URL = status.API_URL ?? "http://127.0.0.1:54321";
const ANON = status.ANON_KEY;
const SERVICE = status.SERVICE_ROLE_KEY;
const STUDIO = status.STUDIO_URL ?? "http://127.0.0.1:54323";
if (!ANON || !SERVICE) die("Supabase status did not include keys. Run `npx supabase status` to inspect.");

say("Applying migrations and seed");
run("npx", ["supabase", "db", "reset"]);

// Docker Hub downloads can drop mid-pull on flaky connections; retry, and never let the
// optional notification service block the rest of the stack.
const composeUp = (service, attempts) => {
  for (let i = 1; i <= attempts; i++) {
    try {
      run("docker", ["compose", "-f", "infra/opensource/docker-compose.yml", "up", "-d", "--build", service]);
      return true;
    } catch {
      if (i < attempts) console.log(`  ${service}: attempt ${i} failed, retrying…`);
    }
  }
  return false;
};
say("Starting mock gateway");
if (!composeUp("mock-gateway", 3)) die("Could not start the mock gateway after 3 attempts. Check Docker Desktop and your internet connection, then re-run npm run oss:start.");
say("Starting ntfy (push notifications, optional)");
const ntfyUp = composeUp("ntfy", 3);
if (!ntfyUp) console.log("  ntfy could not be downloaded. Everything else works; push notifications are off until you re-run npm run oss:start with a stable connection.");

say("Writing environment files");
writeEnv("apps/web/.env.local", {
  NEXT_PUBLIC_SUPABASE_URL: API_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: ANON,
  NEXT_PUBLIC_PAYMENT_PROVIDER: "mock",
  NEXT_PUBLIC_MOCK_GATEWAY_URL: "http://127.0.0.1:4010",
  NEXT_PUBLIC_MAPS_PROVIDER: "osm",
});
writeEnv("apps/admin/.env.local", { NEXT_PUBLIC_SUPABASE_URL: API_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY: ANON });
for (const app of ["mobile", "rider"]) {
  writeEnv(`apps/${app}/.env`, {
    EXPO_PUBLIC_SUPABASE_URL: `http://${ip}:54321`,
    EXPO_PUBLIC_SUPABASE_ANON_KEY: ANON,
    EXPO_PUBLIC_PAYMENT_PROVIDER: "mock",
    EXPO_PUBLIC_MOCK_GATEWAY_URL: `http://${ip}:4010`,
    EXPO_PUBLIC_MAPS_PROVIDER: "osm",
  });
}
writeEnv("supabase/functions/.env", {
  RAZORPAY_BASE_URL: "http://host.docker.internal:4010/v1",
  RAZORPAY_KEY_ID: "rzp_test_mock",
  RAZORPAY_KEY_SECRET: "mock_key_secret",
  RAZORPAY_WEBHOOK_SECRET: "mock_webhook_secret",
  MSG91_BASE_URL: "http://host.docker.internal:4010",
  MSG91_AUTH_KEY: "mock",
  MSG91_OTP_TEMPLATE_ID: "mock",
  SEND_SMS_HOOK_SECRET: "v1,whsec_bW9ja19zZW5kX3Ntc19ob29rX3NlY3JldA==",
  PUSH_PROVIDER: "ntfy",
  NTFY_URL: "http://host.docker.internal:4020",
});
writeEnv(".oss.env", { SUPABASE_URL: API_URL, SUPABASE_SERVICE_ROLE_KEY: SERVICE, SUPABASE_ANON_KEY: ANON });

if (!args.includes("--no-functions")) {
  say("Starting edge functions (log: .oss-functions.log)");
  const pid = startDetached("npx", ["supabase", "functions", "serve", "--env-file", "supabase/functions/.env", "--no-verify-jwt"], path.join(ROOT, ".oss-functions.log"));
  fs.writeFileSync(path.join(ROOT, ".oss-functions.pid"), String(pid));
  await new Promise((r) => setTimeout(r, 4000));
}

say("Checking services");
await checkAll();

console.log(`
Everything is up. Next:

  npm run web          website  -> http://localhost:3000   (login 9999900001, OTP 123456)
  npm run admin        admin    -> http://localhost:3001   (promote yourself first, see below)
  npm run mobile       customer app in Expo Go (phone on the same Wi-Fi; API at http://${ip}:54321)
  npm run rider        partner app in Expo Go

  Studio:              ${STUDIO}
  Mock gateway:        http://localhost:4010/health   (orders, payments, otps)
  ntfy:                http://localhost:4020

Make yourself admin after first login (Studio > SQL editor):
  update public.profiles set role = 'admin' where phone = '919999900001';

Simulate a rider on an order (keys are read from .oss.env):
  npm run oss:rider -- RT100001

Stop everything:  npm run oss:stop
`);
