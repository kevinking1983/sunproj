#!/usr/bin/env node
/**
 * Photo picker: finds openly licensed photo candidates for catalog products and serves a review
 * page on http://localhost:4321 where you choose one per product (or save it to your PC).
 *
 *   npm run photos:pick
 *   npm run photos:pick -- --category vegetables-fruits --all --audit "C:\path\PRODUCE_107_VISUAL_AUDIT.csv"
 *
 *   --category <slug>   only products in this department or category (repeatable)
 *   --all               include products that already have a photo (to replace it)
 *   --audit <csv>       add the Commons files listed in a photo audit CSV ("Source URL" column)
 *   --candidates <n>    photos to find per product (default 4)
 *   --port <n>          default 4321
 *   --no-open           do not open the browser
 *
 * Choices are saved as you click to photo-picker/choices.json. When you are done, run
 * `npm run photos:apply` to put them in the catalog (or send that file to be committed).
 * Lookups are cached in photo-picker/cache.json, so restarting is quick.
 */
import { spawn } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import * as lib from "./lib.mjs";

const args = process.argv.slice(2);
const opt = (name, fallback) => (args.includes(name) ? args[args.indexOf(name) + 1] : fallback);
const many = (name) => args.flatMap((a, i) => (a === name && args[i + 1] ? [args[i + 1]] : []));
const categories = many("--category");
const includeAll = args.includes("--all");
const perProduct = Math.max(1, Math.min(8, Number(opt("--candidates", 4)) || 4));
const port = Number(opt("--port", 4321)) || 4321;
const auditFiles = many("--audit");

fs.mkdirSync(path.join(lib.WORK, "img"), { recursive: true });
const CACHE_FILE = path.join(lib.WORK, "cache.json");
const cache = lib.readIf(CACHE_FILE, {});
let cacheDirty = false;
const saveCache = () => cacheDirty && (fs.writeFileSync(CACHE_FILE, JSON.stringify(cache)), (cacheDirty = false));
setInterval(saveCache, 5_000).unref();
const choices = lib.readIf(lib.CHOICES, {});

// --- Which products ---------------------------------------------------------------------
const catalog = lib.loadCatalog();
const wanted = catalog.filter((p) => (includeAll || !p.current || choices[p.slug]) && (!categories.length || categories.some((c) => p.subcategories.some((s) => s === c || s.startsWith(`${c}-`)) || p.dept === c)));
if (!wanted.length) {
  console.log(categories.length ? `No products match --category ${categories.join(", ")}.` : "Every product already has a photo. Use --all to review them anyway.");
  process.exit(0);
}

const audit = new Map();
for (const f of auditFiles) {
  if (!fs.existsSync(f)) {
    console.error(`Audit file not found: ${f}`);
    process.exit(1);
  }
  for (const [slug, list] of lib.auditMatches(lib.parseCsv(fs.readFileSync(f, "utf8")), wanted)) (audit.get(slug) ?? audit.set(slug, []).get(slug)).push(...list);
}

// --- Lookups, paced per service, cached on disk ------------------------------------------
const pace = (gapMs) => {
  let tail = Promise.resolve();
  return (fn) => {
    const run = tail.then(fn);
    tail = run.catch(() => {}).then(() => lib.sleep(gapMs));
    return run;
  };
};
const commonsPace = pace(400);
const factsPace = pace(6_500); // Open Facts search allows about 10 requests a minute
const cached = async (key, paced, fn) => {
  if (key in cache) return cache[key];
  const v = await paced(fn);
  cache[key] = v;
  cacheDirty = true;
  return v;
};

const candidates = new Map(); // id -> candidate (with its remote url)
const state = new Map(); // slug -> { status, candidates: [ids], error }
const remember = (c, extra = {}) => {
  const id = lib.idOf(c.url);
  if (!candidates.has(id)) candidates.set(id, { ...c, ...extra, id });
  else if (extra.note && !candidates.get(id).note) candidates.get(id).note = extra.note;
  return id;
};

const packQuery = (p) => (p.name.toLowerCase().includes((p.brand ?? "").toLowerCase()) ? p.name : `${p.brand} ${p.name}`);

async function gather(p) {
  const s = { status: "searching", candidates: [], error: null };
  state.set(p.slug, s);
  const ids = [];
  const add = (c, extra) => {
    const id = remember(c, extra);
    if (!ids.includes(id) && c.url !== p.current?.url) ids.push(id);
  };
  const errors = [];
  try {
    await auditReady;
    for (const m of audit.get(p.slug) ?? []) {
      const c = cache[`file:${m.title}`];
      if (c && !c.reject) add(c, { note: `Your audit: ${m.note}` });
    }
  } catch (e) {
    errors.push(`audit files: ${e.message}`);
  }
  const lookups = [];
  if (lib.isGeneric(p)) {
    const queries = [...new Set([p.name, p.image?.wiki].filter(Boolean))];
    for (const q of queries) lookups.push(cached(`commons:${q.toLowerCase()}`, commonsPace, () => lib.commonsSearch(q)).then((list) => list.forEach((c) => add(c))));
  } else {
    const kind = lib.factsKind(p);
    lookups.push(cached(`facts:${kind}|${lib.brandTag(p.brand ?? "")}`, factsPace, () => lib.factsByBrand(kind, p.brand)).then((list) => lib.rankFacts(kind, list, p, perProduct).forEach((c) => add(c))));
    // Commons rarely has pack shots; keep only files whose title names the brand.
    const brandWords = lib.words(p.brand).filter((w) => !lib.GENERIC.has(w));
    if (brandWords.length)
      lookups.push(
        cached(`commons:${packQuery(p).toLowerCase()}`, commonsPace, () => lib.commonsSearch(packQuery(p), 6)).then((list) =>
          list.filter((c) => brandWords.every((w) => lib.words(c.title).includes(w))).forEach((c) => add(c)),
        ),
      );
  }
  for (const r of await Promise.allSettled(lookups)) if (r.status === "rejected") errors.push(r.reason?.message ?? String(r.reason));
  // Audit picks first, then the rest, up to the limit (a chosen photo always stays visible).
  const chosenId = choices[p.slug]?.url ? lib.idOf(choices[p.slug].url) : null;
  if (chosenId && !candidates.has(chosenId)) remember(choices[p.slug]);
  s.candidates = [...new Set([...(chosenId ? [chosenId] : []), ...ids])].slice(0, perProduct + (audit.get(p.slug)?.length ?? 0) + (chosenId ? 1 : 0));
  s.error = errors.length ? errors.join("; ") : null;
  s.status = s.candidates.length ? "ready" : errors.length ? "error" : "none";
}

// The audit's Commons files, checked 50 at a time before anything else.
const auditTitles = [...new Set([...audit.values()].flat().map((m) => m.title))].filter((t) => !(`file:${t}` in cache));
const auditReady = auditTitles.length
  ? commonsPace(() => lib.commonsFiles(auditTitles)).then((found) => {
      for (const t of auditTitles) cache[`file:${t}`] = found[t] ?? { reject: "not found on Wikimedia Commons" };
      cacheDirty = true;
      const rejected = auditTitles.filter((t) => cache[`file:${t}`].reject);
      if (rejected.length) console.log(`  ${rejected.length} audit photos left out: ${rejected.map((t) => `${t} (${cache[`file:${t}`].reject})`).join("; ")}`);
    })
  : Promise.resolve();

// A few products at a time, in catalog order, so the page fills from the top.
let finished = 0;
let next = 0;
console.log(`Looking for photos for ${wanted.length} products${audit.size ? ` (${audit.size} with photos from your audit)` : ""}...`);
for (const p of wanted) state.set(p.slug, { status: "waiting", candidates: [], error: null });
const worker = async () => {
  while (next < wanted.length) {
    const p = wanted[next++];
    await gather(p).catch((e) => Object.assign(state.get(p.slug), { status: "error", error: e.message }));
    if (++finished % 50 === 0 || finished === wanted.length) console.log(`  ${finished}/${wanted.length} products searched`);
  }
};
const started = Promise.all(Array.from({ length: 6 }, worker)).then(() => {
  saveCache();
  console.log("All searches finished. Refresh the page to see everything.");
});

// --- Choosing -----------------------------------------------------------------------------
const saveChoices = () => lib.writeJson(lib.CHOICES, choices);
const choose = (slug, id) => {
  if (!wanted.some((p) => p.slug === slug)) throw new Error("unknown product");
  if (id === null) delete choices[slug];
  else if (id === "none") choices[slug] = { none: true };
  else {
    const c = candidates.get(id);
    if (!c || !state.get(slug)?.candidates.includes(id)) throw new Error("unknown photo");
    choices[slug] = { url: c.url, credit: c.credit, page: c.page, source: c.source, license: c.license, title: c.title };
  }
  saveChoices();
};

/** A link the user pasted: a Commons file page or an Open Facts product page. */
async function addLink(slug, link) {
  const s = state.get(slug);
  if (!s) throw new Error("unknown product");
  let c = null;
  const title = lib.commonsTitleFromLink(link);
  const facts = lib.factsCodeFromLink(link);
  if (title) {
    c = (await lib.commonsFiles([title]))[title];
    if (!c || c.reject) throw new Error(`That file can't be used: ${c?.reject ?? "not found"}.`);
  } else if (facts) {
    c = await lib.factsProduct(facts.kind, facts.code);
    if (!c) throw new Error("That Open Facts product has no front photo.");
  } else throw new Error("Paste a Wikimedia Commons file link (commons.wikimedia.org/wiki/File:...) or an Open Food, Beauty or Products Facts product link.");
  const id = remember(c, { note: "Added by you" });
  if (!s.candidates.includes(id)) s.candidates.unshift(id);
  s.status = "ready";
  return id;
}

// --- Page and API -------------------------------------------------------------------------
const TOKEN = crypto.randomBytes(16).toString("hex");
const PAGE = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), "page.html"), "utf8").replace("__TOKEN__", TOKEN);
const view = () => ({
  searched: finished,
  total: wanted.length,
  products: wanted.map((p) => {
    const s = state.get(p.slug) ?? { status: "waiting", candidates: [] };
    return {
      slug: p.slug,
      name: p.name,
      brand: p.brand,
      unit: p.unit_label,
      dept: p.dept,
      deptName: p.deptName,
      path: p.path,
      current: p.current,
      choice: choices[p.slug] ? (choices[p.slug].none ? "none" : lib.idOf(choices[p.slug].url)) : null,
      status: s.status,
      error: s.error,
      candidates: s.candidates.map((id) => {
        const c = candidates.get(id);
        return { id, title: c.title, license: c.license, credit: c.credit, page: c.page, source: c.source, width: c.width, height: c.height, note: c.note ?? null, warning: c.warning ?? null };
      }),
    };
  }),
});

const send = (res, code, body, type = "application/json; charset=utf-8", headers = {}) => {
  res.writeHead(code, { "Content-Type": type, "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", ...headers });
  res.end(typeof body === "string" || Buffer.isBuffer(body) ? body : JSON.stringify(body));
};
const body = (req) =>
  new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (d) => {
      data += d;
      if (data.length > 10_000) req.destroy();
    });
    req.on("end", () => {
      try {
        resolve(JSON.parse(data || "{}"));
      } catch (e) {
        reject(e);
      }
    });
  });

const imageFile = async (c) => {
  const ext = /\.png($|\?)/i.test(c.url) ? "png" : /\.webp($|\?)/i.test(c.url) ? "webp" : "jpg";
  const file = path.join(lib.WORK, "img", `${c.id}.${ext}`);
  if (!fs.existsSync(file)) {
    const res = await fetch(c.url, { headers: { "User-Agent": lib.UA } });
    if (!res.ok) throw new Error(`${res.status} fetching photo`);
    fs.writeFileSync(file, Buffer.from(await res.arrayBuffer()));
  }
  return { file, ext };
};

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  try {
    if (req.method === "GET" && url.pathname === "/") return send(res, 200, PAGE, "text/html; charset=utf-8");
    if (req.method === "GET" && url.pathname === "/data.json") return send(res, 200, view());
    if (req.method === "GET" && url.pathname.startsWith("/img/")) {
      const c = candidates.get(url.pathname.slice(5));
      if (!c) return send(res, 404, { error: "unknown photo" });
      const { file, ext } = await imageFile(c);
      const slug = String(url.searchParams.get("slug") ?? "photo").replace(/[^a-z0-9-]/g, "") || "photo";
      const headers = url.searchParams.has("download") ? { "Content-Disposition": `attachment; filename="${slug}-${c.id}.${ext}"` } : { "Cache-Control": "max-age=86400" };
      res.writeHead(200, { "Content-Type": ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg", ...headers });
      return fs.createReadStream(file).pipe(res);
    }
    if (req.method === "GET" && url.pathname === "/choices.json") return send(res, 200, JSON.stringify(choices, null, 1), "application/json", { "Content-Disposition": 'attachment; filename="photo-choices.json"' });
    if (req.method === "POST" && url.pathname.startsWith("/api/")) {
      // Only this page may change choices: it carries a token other sites cannot read.
      if (req.headers["x-picker-token"] !== TOKEN) return send(res, 403, { error: "forbidden" });
      const b = await body(req);
      if (url.pathname === "/api/choose") {
        choose(String(b.slug), b.id === null || b.id === "none" ? b.id : String(b.id));
        return send(res, 200, { ok: true, chosen: Object.keys(choices).length });
      }
      if (url.pathname === "/api/add") return send(res, 200, { ok: true, id: await addLink(String(b.slug), String(b.link ?? "")) });
    }
    send(res, 404, { error: "not found" });
  } catch (e) {
    send(res, 400, { error: e.message });
  }
});

server.on("error", (e) => {
  console.error(e.code === "EADDRINUSE" ? `Port ${port} is busy. Close the other picker, or pass --port 4322.` : e.message);
  process.exit(1);
});
server.listen(port, "127.0.0.1", () => {
  const link = `http://localhost:${port}`;
  console.log(`\nPhoto picker: ${link}\nChoices save as you click (photo-picker/choices.json). Press Ctrl+C here when done, then run: npm run photos:apply\n`);
  if (args.includes("--no-open")) return;
  const [cmd, cmdArgs] = process.platform === "win32" ? ["cmd", ["/c", "start", "", link]] : process.platform === "darwin" ? ["open", [link]] : ["xdg-open", [link]];
  spawn(cmd, cmdArgs, { stdio: "ignore", detached: true }).on("error", () => {}).unref();
});
process.on("SIGINT", () => {
  saveCache();
  console.log(`\n${Object.keys(choices).length} choices saved in photo-picker/choices.json. Next: npm run photos:apply`);
  process.exit(0);
});
export { started };
