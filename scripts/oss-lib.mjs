// Shared helpers for the open-source test stack scripts. Cross-platform: runs from
// PowerShell, Command Prompt, WSL, macOS and Linux with plain Node.
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const isWindows = process.platform === "win32";

const green = (s) => `\x1b[1;32m${s}\x1b[0m`;
const red = (s) => `\x1b[1;31m${s}\x1b[0m`;
export const say = (s) => console.log(`\n${green("==> " + s)}`);
export const die = (s) => {
  console.error(`\n${red(s)}`);
  process.exit(1);
};

/** Runs a command, streaming output unless quiet; returns stdout. Throws on non-zero exit. */
export const run = (cmd, args, { quiet = false, cwd = ROOT, check = true, env } = {}) => {
  const res = spawnSync(cmd, args, { cwd, shell: isWindows, stdio: quiet ? ["ignore", "pipe", "pipe"] : "inherit", encoding: "utf8", env: { ...process.env, ...env } });
  if (check && res.status !== 0) {
    if (quiet) process.stderr.write((res.stdout ?? "") + (res.stderr ?? ""));
    throw new Error(`${cmd} ${args.join(" ")} exited with ${res.status}`);
  }
  return res.stdout ?? "";
};

export const has = (cmd) => spawnSync(isWindows ? "where" : "which", [cmd], { stdio: "ignore", shell: isWindows }).status === 0;

/** Starts a long-running process detached, logging to a file. */
export const startDetached = (cmd, args, logFile) => {
  const out = fs.openSync(logFile, "a");
  const child = spawn(cmd, args, { cwd: ROOT, shell: isWindows, detached: !isWindows, stdio: ["ignore", out, out], windowsHide: true });
  child.unref();
  return child.pid;
};

export const lanIp = () => {
  const all = Object.values(os.networkInterfaces()).flat();
  const pick = all.find((i) => i && i.family === "IPv4" && !i.internal && !i.address.startsWith("169.254"));
  return pick ? pick.address : "127.0.0.1";
};

/** Upserts KEY=VALUE lines into an env file, keeping unrelated lines. */
export const writeEnv = (file, values) => {
  const full = path.join(ROOT, file);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  const lines = fs.existsSync(full) ? fs.readFileSync(full, "utf8").split(/\r?\n/).filter((l, i, a) => !(i === a.length - 1 && l === "")) : [];
  for (const [k, v] of Object.entries(values)) {
    const i = lines.findIndex((l) => l.startsWith(`${k}=`));
    if (i === -1) lines.push(`${k}=${v}`);
    else lines[i] = `${k}=${v}`;
  }
  fs.writeFileSync(full, lines.join("\n") + "\n");
};

export const check = async (label, url, okStatuses = [200]) => {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    const ok = okStatuses.includes(res.status);
    console.log(`  ${ok ? green("✓") : red("✗")} ${label}${ok ? "" : `  (${url} -> ${res.status})`}`);
    return ok;
  } catch {
    console.log(`  ${red("✗")} ${label}  (${url} unreachable)`);
    return false;
  }
};

export const checkAll = async () => {
  const results = await Promise.all([
    check("Supabase API", "http://127.0.0.1:54321/rest/v1/", [200, 401]),
    check("Supabase Auth", "http://127.0.0.1:54321/auth/v1/health"),
    check("Supabase Studio", "http://127.0.0.1:54323/"),
    check("Mock gateway", "http://127.0.0.1:4010/health"),
    check("ntfy", "http://127.0.0.1:4020/v1/health"),
    check("Edge functions", "http://127.0.0.1:54321/functions/v1/place-order", [200, 401, 405]),
  ]);
  const bad = results.filter((r) => !r).length;
  if (bad === 0) console.log(green("All services healthy."));
  else console.log(red(`${bad} service(s) not reachable.`) + " If only edge functions fail, run: npm run functions:serve");
  return bad === 0;
};
