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
export const run = (cmd, args, { quiet = false, cwd = ROOT, check = true, env, input } = {}) => {
  const stdin = input === undefined ? (quiet ? "ignore" : "inherit") : "pipe";
  const res = spawnSync(cmd, args, { cwd, shell: isWindows, input, stdio: quiet ? [stdin, "pipe", "pipe"] : [stdin, "inherit", "inherit"], encoding: "utf8", env: { ...process.env, ...env } });
  if (check && res.status !== 0) {
    if (quiet) process.stderr.write((res.stdout ?? "") + (res.stderr ?? ""));
    throw new Error(`${cmd} ${args.join(" ")} exited with ${res.status}`);
  }
  return res.stdout ?? "";
};

export const has = (cmd) => spawnSync(isWindows ? "where" : "which", [cmd], { stdio: "ignore", shell: isWindows }).status === 0;

/**
 * Starts a long-running process that outlives this script. On Windows it opens its own
 * console window (so logs are visible and it survives this script exiting); elsewhere it
 * runs detached with output in a log file.
 */
export const startDetached = (cmd, args, logFile, title = "RATION") => {
  if (isWindows) {
    const line = [cmd, ...args].join(" ");
    const child = spawn("cmd.exe", ["/c", "start", `"${title}"`, "cmd.exe", "/k", line], { cwd: ROOT, detached: true, stdio: "ignore", windowsHide: false });
    child.unref();
    return child.pid;
  }
  const out = fs.openSync(logFile, "a");
  const child = spawn(cmd, args, { cwd: ROOT, detached: true, stdio: ["ignore", out, out] });
  child.unref();
  return child.pid;
};

/**
 * The address a phone on your Wi-Fi can reach. Skips virtual adapters (VirtualBox, VMware,
 * Hyper-V, WSL, Docker) and prefers home-network ranges. Override with RATION_LAN_IP.
 */
export const lanIp = () => {
  if (process.env.RATION_LAN_IP) return process.env.RATION_LAN_IP;
  const virtual = /virtualbox|vmware|vethernet|hyper-v|wsl|docker|vbox|tailscale|zerotier|loopback/i;
  const candidates = Object.entries(os.networkInterfaces())
    .filter(([name]) => !virtual.test(name))
    .flatMap(([name, list]) => (list ?? []).map((i) => ({ name, ...i })))
    .filter((i) => i.family === "IPv4" && !i.internal && !i.address.startsWith("169.254") && !i.address.startsWith("192.168.56.") && !/^172\.(1[6-9]|2\d|3[01])\./.test(i.address));
  const score = (a) => (/^192\.168\./.test(a) ? 3 : /^10\./.test(a) ? 2 : 1) + (/wi-?fi|wlan|en0|wlp/i.test(a) ? 0 : 0);
  candidates.sort((a, b) => score(b.address) - score(a.address) || (/wi-?fi|wlan|wlp|en0/i.test(b.name) ? 1 : 0) - (/wi-?fi|wlan|wlp|en0/i.test(a.name) ? 1 : 0));
  return candidates[0]?.address ?? "127.0.0.1";
};

/** Polls a URL until it returns one of the statuses or the time runs out. */
export const waitFor = async (url, okStatuses, seconds) => {
  const until = Date.now() + seconds * 1000;
  while (Date.now() < until) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
      if (okStatuses.includes(res.status)) return true;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  return false;
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
