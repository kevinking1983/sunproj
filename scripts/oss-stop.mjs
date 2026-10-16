import fs from "node:fs";
import path from "node:path";

import { ROOT, isWindows, run, say } from "./oss-lib.mjs";

process.chdir(ROOT);
const pidFile = path.join(ROOT, ".oss-functions.pid");
if (fs.existsSync(pidFile)) {
  const pid = Number(fs.readFileSync(pidFile, "utf8"));
  try {
    if (isWindows) run("taskkill", ["/PID", String(pid), "/T", "/F"], { quiet: true, check: false });
    else process.kill(-pid, "SIGTERM");
  } catch {
    // already gone
  }
  fs.unlinkSync(pidFile);
}
say("Stopping mock gateway and ntfy");
run("docker", ["compose", "-f", "infra/opensource/docker-compose.yml", "down"], { check: false });
say("Stopping Supabase");
run("npx", ["supabase", "stop"], { check: false });
console.log("Open-source test stack stopped.");
