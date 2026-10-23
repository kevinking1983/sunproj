#!/usr/bin/env node
/**
 * Broader automatic photo matching for products the strict lookup (resolve-images.mjs) missed.
 * Runs in GitHub Actions ("Catalog auto photos") and writes supabase/catalog/auto-photos.json.
 *
 *   1. Pack shot: full-text search of Open Food / Beauty / Products Facts by brand and name. The
 *      brand must match and at least half of the distinctive words of the name.
 *   2. Representative photo: a freely licensed Wikimedia Commons photo of the item itself, found
 *      from the product's search tags ("toilet cleaner", "aloo bhujia"). Its credit says
 *      "Representative photo" so nobody mistakes it for the exact pack.
 *
 * Photos listed in photo-rejects.json (slug -> [url]) are never used again for that product; the
 * next best candidate is tried instead. Hand-picked photos (image-overrides.json) always win.
 *
 *   node scripts/catalog/auto-photos.mjs [--max-minutes 100] [--retry-misses] [--limit n] [--category <slug prefix>]
 */
import * as lib from "../photos/lib.mjs";

const args = process.argv.slice(2);
const retryMisses = args.includes("--retry-misses");
const limit = Number(args[args.indexOf("--limit") + 1]) || Infinity;
const deadline = Date.now() + (Number(args[args.indexOf("--max-minutes") + 1]) || 100) * 60_000;

const auto = lib.readIf(lib.AUTO, {});
const rejects = lib.readIf(lib.REJECTS, {});
const save = () => lib.writeJson(lib.AUTO, auto);

const pace = (gapMs) => {
  let last = 0;
  return async (fn) => {
    const wait = last + gapMs - Date.now();
    if (wait > 0) await lib.sleep(wait);
    try {
      return await fn();
    } finally {
      last = Date.now();
    }
  };
};
const commonsPace = pace(500);
const searchPace = pace(1_500); // search.openfoodfacts.org
const cgiPace = pace(6_500); // classic search: about 10 requests a minute

// Pack sizes and units say nothing about which product it is.
const UNIT = new Set("pack pcs pc piece pieces combo set box bottle jar pouch can tin sachet refill litre liter ltr ml kg gm gms grams gram".split(" "));
const distinct = (s, minus = new Set()) => [...new Set(lib.words(s).filter((w) => !lib.GENERIC.has(w) && !UNIT.has(w) && !/^\d/.test(w) && !minus.has(w)))];
const has = (set, w) => set.has(w) || set.has(w.replace(/s$/, "")) || set.has(`${w}s`) || set.has(w.replace(/es$/, ""));

async function searchFacts(kind, terms) {
  const q = encodeURIComponent(terms);
  if (kind === "food") {
    try {
      const data = await searchPace(() => lib.getJson(`https://search.openfoodfacts.org/search?q=${q}&page_size=24&fields=${lib.FIELDS}`, { retries: 1 }));
      return data?.hits ?? [];
    } catch {
      /* fall back to the classic search */
    }
  }
  const data = await cgiPace(() => lib.getJson(`https://${lib.FACTS[kind].host}/cgi/search.pl?search_terms=${q}&search_simple=1&action=process&json=1&page_size=24&fields=${lib.FIELDS}`, { retries: 1 }));
  return data?.products ?? [];
}

async function packShot(p, rejected) {
  if (!p.brand) return null;
  const kind = lib.factsKind(p);
  const brandAll = lib.words(p.brand);
  const brandWords = distinct(p.brand).length ? distinct(p.brand) : brandAll;
  const needed = distinct(p.name, new Set(brandAll));
  const terms = p.name.toLowerCase().includes(p.brand.toLowerCase()) ? p.name : `${p.brand} ${p.name}`;
  let best = null;
  for (const hit of await searchFacts(kind, terms)) {
    if (!hit.image_front_url || !hit.code) continue;
    const brands = [hit.brands].flat().filter(Boolean).join(", ");
    const text = new Set(lib.words(`${brands} ${hit.product_name ?? ""} ${hit.product_name_en ?? ""}`));
    if (!brandWords.every((w) => has(text, w))) continue;
    const hits = needed.filter((w) => has(text, w)).length;
    if (needed.length && hits < Math.ceil(needed.length / 2)) continue;
    const c = lib.factsCandidate(kind, { ...hit, brands });
    if (rejected.has(c.url)) continue;
    const score = hits + (hits === needed.length ? 1 : 0) + (hit.countries_tags?.includes("en:india") ? 0.5 : 0);
    if (!best || score > best.score) best = { c, score };
  }
  return best ? { ...best.c, match: "pack" } : null;
}

// Titles of maps, logos and charts are not product photos.
const NOT_A_PHOTO = /\b(logo|map|diagram|chart|poster|advert|advertisement|label|icon|stamp|coat of arms|flag|graph|screenshot)\b/i;
async function representative(p, rejected) {
  const brandAll = new Set(lib.words(p.brand ?? ""));
  // The English name first ("Kashmiri Apple"), then the search tags ("toilet cleaner").
  const queries = [...new Set([p.name, ...p.tags].map((t) => distinct(t, brandAll).join(" ")).filter((t) => t.length > 2))].slice(0, 4);
  for (const q of queries) {
    const want = q.split(" ");
    const results = await commonsPace(() => lib.commonsSearch(q, 12));
    for (const c of results) {
      if (rejected.has(c.url) || NOT_A_PHOTO.test(c.title)) continue;
      const title = new Set(lib.words(c.title));
      if (!want.every((w) => has(title, w))) continue;
      return { ...c, credit: c.credit.replace(/^Photo:/, "Representative photo:"), match: "representative", query: q };
    }
  }
  return null;
}

const overrides = lib.readIf(lib.OVERRIDES, {});
const catalog = lib.loadCatalog();
// Products with no hand-picked photo and no strict match.
const targets = catalog.filter((p) => !overrides[p.slug] && (!p.current || p.current.url === auto[p.slug]?.url));
let done = 0;
let found = 0;
const only = args.includes("--category") ? args[args.indexOf("--category") + 1] : null;
const todo = targets.filter((p) => {
  if (only && !p.subcategories.some((s) => s.startsWith(only))) return false;
  const a = auto[p.slug];
  const rejected = new Set(rejects[p.slug] ?? []);
  if (a?.url && rejected.has(a.url)) return true;
  return !a || (a.miss && retryMisses);
});
// Entries for products that now have a better photo are dropped.
for (const slug of Object.keys(auto)) if (!targets.some((p) => p.slug === slug)) delete auto[slug];
console.log(`${todo.length} products to match.`);
for (const p of todo.slice(0, limit)) {
  if (Date.now() > deadline) {
    console.log("Time limit reached; the next run continues.");
    break;
  }
  const rejected = new Set(rejects[p.slug] ?? []);
  try {
    const c = (await packShot(p, rejected)) ?? (await representative(p, rejected));
    auto[p.slug] = c ? { url: c.url, credit: c.credit, page: c.page, source: c.source, license: c.license, match: c.match, title: c.title } : { miss: true };
    if (c) found++;
  } catch (e) {
    console.warn(`  ${p.slug}: ${e.message}`); // not recorded, so the next run retries it
  }
  if (++done % 25 === 0) {
    save();
    console.log(`  ${done}/${todo.length} matched, ${found} photos found`);
  }
}
save();
const all = Object.values(auto);
console.log(`Done: ${found} new. auto-photos.json has ${all.filter((a) => a.match === "pack").length} pack shots, ${all.filter((a) => a.match === "representative").length} representative photos, ${all.filter((a) => a.miss).length} misses.`);
