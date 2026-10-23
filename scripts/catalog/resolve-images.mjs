#!/usr/bin/env node
/**
 * Finds openly licensed photos for catalog products and records them, with the attribution
 * each licence requires, in supabase/catalog/images.json. Runs in GitHub Actions
 * (.github/workflows/catalog-images.yml) because it needs open internet access.
 *
 *   {"wiki": "<article>"}           -> lead photo of the English Wikipedia article, accepted only
 *                                      when Wikimedia Commons marks it as freely licensed
 *   {"off": {"brand", "query"}}     -> front-of-pack photo from Open Food Facts (food),
 *                                      Open Beauty Facts (beauty) or Open Products Facts (other)
 *
 * Results are cached by lookup key, so reruns only fetch what is new. Misses are cached too;
 * pass --retry-misses to try them again. --max-minutes stops early and saves progress.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { factsThumb } from "../photos/lib.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const CAT = path.join(ROOT, "supabase/catalog");
const OUT = path.join(CAT, "images.json");
const args = process.argv.slice(2);
const retryMisses = args.includes("--retry-misses");
const maxMinutes = Number(args[args.indexOf("--max-minutes") + 1]) || 100;
const deadline = Date.now() + maxMinutes * 60_000;
const UA = "RATION-catalog/1.0 (https://github.com/kevinking1983/sunproj; catalog photo lookup)";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const read = (f) => JSON.parse(fs.readFileSync(f, "utf8"));

const assortment = read(path.join(CAT, "assortment.json"));
const deptOf = new Map();
for (const d of assortment.departments) for (const c of d.categories) for (const s of c.subcategories) if (s.slug) deptOf.set(s.slug, d.slug);
const products = [read(path.join(CAT, "pinned.json")), ...fs.readdirSync(path.join(CAT, "products")).filter((f) => f.endsWith(".json")).sort().map((f) => read(path.join(CAT, "products", f)))].flat();
const cache = fs.existsSync(OUT) ? read(OUT) : {};
const save = () => fs.writeFileSync(OUT, JSON.stringify(Object.fromEntries(Object.entries(cache).sort(([a], [b]) => a.localeCompare(b))), null, 1) + "\n");

const getJson = async (url, { retries = 2 } = {}) => {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json" } });
    if (res.status === 404) return null;
    if (res.ok) return res.json();
    // Overloaded or rate limited: a short backoff, then give up so one slow service cannot
    // eat the whole run. Failed lookups are not cached and are retried next run.
    if ((res.status === 429 || res.status >= 500) && attempt < retries) {
      await sleep(5_000 * (attempt + 1));
      continue;
    }
    throw new Error(`${res.status} ${url}`);
  }
};
const stripHtml = (s) => String(s ?? "").replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
const why = new Map(); // miss reasons, summarised at the end

// --- Wikipedia / Wikimedia Commons -----------------------------------------------------
// Uses the long-standing Action API: pageimages gives the article's lead image file, then
// Commons gives its licence. Files that only exist on English Wikipedia are usually non-free
// and are skipped (Commons reports them missing).
const FREE = /^(cc[ -]|cc0|public domain|pd)/i;
const miss = (reason) => {
  why.set(reason, (why.get(reason) ?? 0) + 1);
  return null;
};
const wiki = async (title) => {
  const page = await getJson(`https://en.wikipedia.org/w/api.php?action=query&format=json&formatversion=2&redirects=1&prop=pageimages&piprop=name&titles=${encodeURIComponent(title)}`);
  const p = page?.query?.pages?.[0];
  if (!p || p.missing) return miss("wikipedia: no such article");
  if (!p.pageimage) return miss("wikipedia: article has no lead image");
  await sleep(200);
  const info = await getJson(`https://commons.wikimedia.org/w/api.php?action=query&format=json&formatversion=2&prop=imageinfo&iiprop=url%7Cextmetadata&iiurlwidth=480&titles=${encodeURIComponent(`File:${p.pageimage}`)}`);
  const file = info?.query?.pages?.[0];
  const ii = file?.imageinfo?.[0];
  if (!ii) return miss("wikipedia: lead image is not on Commons (likely non-free)");
  const meta = ii.extmetadata ?? {};
  const license = stripHtml(meta.LicenseShortName?.value);
  if (meta.NonFree?.value === "true" || !FREE.test(license)) return miss(`wikipedia: licence not free (${license || "unknown"})`);
  const artist = stripHtml(meta.Artist?.value).slice(0, 80) || "Unknown author";
  return { url: ii.thumburl ?? ii.url, credit: `Photo: ${artist}, ${license}, via Wikimedia Commons`, page: ii.descriptionurl, source: "wikimedia" };
};

// --- Open Food / Beauty / Products Facts --------------------------------------------------
const OFF_HOSTS = { food: "world.openfoodfacts.org", beauty: "world.openbeautyfacts.org", products: "world.openproductsfacts.org" };
const FIELDS = "code,product_name,product_name_en,image_front_url,countries_tags";
const brandCache = new Map();
const brandTag = (b) => b.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/&/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
const byBrand = async (kind, brand) => {
  const key = `${kind}|${brand}`;
  if (!brandCache.has(key)) {
    const host = OFF_HOSTS[kind];
    let list = null;
    // Search endpoints allow about 10 requests a minute: stay under it.
    await sleep(6_500);
    try {
      const data = await getJson(`https://${host}/api/v2/search?brands_tags=${encodeURIComponent(brandTag(brand))}&fields=${FIELDS}&page_size=100`, { retries: 1 });
      list = data?.products ?? [];
    } catch (e) {
      if (kind !== "food") throw e;
      // The classic search is often overloaded; Open Food Facts' newer search service is the fallback.
      const data = await getJson(`https://search.openfoodfacts.org/search?q=${encodeURIComponent(`brands_tags:"${brandTag(brand)}"`)}&page_size=100&fields=${FIELDS}`, { retries: 1 });
      list = data?.hits ?? [];
    }
    brandCache.set(key, list.filter((p) => p.image_front_url));
  }
  return brandCache.get(key);
};
// Words that say nothing about which product it is: never enough on their own for a match.
const GENERIC = new Set("organic premium pure natural fresh classic original regular india indian best new pack combo value family special select gold super plus the and with for from made fine refined whole style flavour flavor taste real rich instant ready mix".split(" "));
const words = (s) => s.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").split(/[^a-z0-9]+/).filter((w) => w.length > 2);
const off = async (brand, query, dept) => {
  const kind = dept === "beauty-personal-care" ? "beauty" : dept === "household-essentials" || dept === "kitchenware" ? "products" : "food";
  const brandWords = new Set(words(brand));
  const needed = words(query).filter((w) => !GENERIC.has(w) && !brandWords.has(w));
  if (!needed.length) return miss("open facts: query has no distinctive words");
  const candidates = await byBrand(kind, brand);
  if (!candidates.length) return miss(`open facts: no ${kind} products with photos for this brand`);
  let best = null;
  for (const p of candidates) {
    const name = new Set(words(`${p.product_name ?? ""} ${p.product_name_en ?? ""}`));
    const hits = needed.filter((w) => name.has(w) || name.has(w.replace(/s$/, "")) || name.has(`${w}s`)).length;
    // Every distinctive word must appear (two of three for longer queries).
    if (hits < Math.max(1, needed.length <= 2 ? needed.length : Math.ceil(needed.length * 0.66))) continue;
    const score = hits + (p.countries_tags?.includes("en:india") ? 0.5 : 0);
    if (!best || score > best.score) best = { p, score };
  }
  if (!best) return miss("open facts: no product name matched closely enough");
  const host = OFF_HOSTS[kind];
  return {
    url: factsThumb(best.p.image_front_url),
    credit: `Photo: ${kind === "food" ? "Open Food Facts" : kind === "beauty" ? "Open Beauty Facts" : "Open Products Facts"} contributors, CC BY-SA`,
    page: `https://${host}/product/${best.p.code}`,
    source: kind === "food" ? "openfoodfacts" : kind === "beauty" ? "openbeautyfacts" : "openproductsfacts",
  };
};

// --- Run ------------------------------------------------------------------------------
const jobs = new Map();
for (const p of products) {
  if (!p.image) continue;
  const dept = p.subcategories[0]?.startsWith("kitchenware-appliances") ? "kitchenware" : deptOf.get(p.subcategories[0]);
  const key = p.image.wiki ? `wiki:${p.image.wiki}` : `off:${p.image.off.brand.toLowerCase()}|${p.image.off.query.toLowerCase()}`;
  if (cache[key] && (cache[key].url || !retryMisses)) continue;
  jobs.set(key, { image: p.image, dept });
}
const ordered = [...jobs].sort(([a], [b]) => Number(b.startsWith("wiki:")) - Number(a.startsWith("wiki:")));
console.log(`${jobs.size} lookups to do (${Object.keys(cache).length} cached).`);
let done = 0;
let found = 0;
for (const [key, { image, dept }] of ordered) {
  if (Date.now() > deadline) {
    console.log("Time limit reached; saving progress for the next run.");
    break;
  }
  try {
    const hit = image.wiki ? await wiki(image.wiki) : await off(image.off.brand, image.off.query, dept);
    cache[key] = hit ?? { miss: true };
    if (hit) found++;
  } catch (e) {
    console.warn(`  ${key}: ${e.message}`);
  }
  if (image.wiki) await sleep(200);
  if (++done % 25 === 0) {
    save();
    console.log(`  ${done}/${jobs.size} looked up, ${found} photos found`);
  }
}
save();
const total = Object.values(cache).filter((v) => v.url).length;
console.log(`Done: ${found} new photos this run; ${total} photos cached in total.`);
for (const [reason, n] of [...why].sort((a, b) => b[1] - a[1])) console.log(`  missed ${n}: ${reason}`);
