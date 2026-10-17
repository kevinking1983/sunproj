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

const getJson = async (url, attempt = 1) => {
  const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json" } });
  if (res.status === 404) return null;
  if ((res.status === 429 || res.status >= 500) && attempt < 4) {
    await sleep(15_000 * attempt);
    return getJson(url, attempt + 1);
  }
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.json();
};
const stripHtml = (s) => String(s ?? "").replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();

// --- Wikipedia / Wikimedia Commons -----------------------------------------------------
const FREE = /^(cc[ -]|cc0|public domain|pd)/i;
const wiki = async (title) => {
  const summary = await getJson(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/ /g, "_"))}?redirect=true`);
  const src = summary?.originalimage?.source ?? summary?.thumbnail?.source;
  if (!src || !src.includes("/wikipedia/commons/")) return null; // local files are usually non-free
  const file = decodeURIComponent(src.split("/").pop().replace(/^\d+px-/, ""));
  await sleep(250);
  const info = await getJson(`https://commons.wikimedia.org/w/api.php?action=query&format=json&prop=imageinfo&iiprop=url%7Cextmetadata&iiurlwidth=480&titles=${encodeURIComponent(`File:${file}`)}`);
  const page = info && Object.values(info.query?.pages ?? {})[0];
  const ii = page?.imageinfo?.[0];
  const meta = ii?.extmetadata ?? {};
  const license = stripHtml(meta.LicenseShortName?.value);
  if (!ii || meta.NonFree?.value === "true" || !FREE.test(license)) return null;
  const artist = stripHtml(meta.Artist?.value).slice(0, 80) || "Unknown author";
  return { url: ii.thumburl ?? ii.url, credit: `Photo: ${artist}, ${license}, via Wikimedia Commons`, page: ii.descriptionurl, source: "wikimedia" };
};

// --- Open Food / Beauty / Products Facts --------------------------------------------------
const OFF_HOSTS = { food: "world.openfoodfacts.org", beauty: "world.openbeautyfacts.org", products: "world.openproductsfacts.org" };
const brandCache = new Map();
const brandTag = (b) => b.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/&/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
const byBrand = async (host, brand) => {
  const key = `${host}|${brand}`;
  if (!brandCache.has(key)) {
    // Search endpoints allow about 10 requests a minute: stay under it.
    await sleep(6_500);
    const data = await getJson(`https://${host}/api/v2/search?brands_tags=${encodeURIComponent(brandTag(brand))}&fields=code,product_name,product_name_en,image_front_url,countries_tags&page_size=100`);
    brandCache.set(key, (data?.products ?? []).filter((p) => p.image_front_url));
  }
  return brandCache.get(key);
};
const off = async (brand, query, dept) => {
  const kind = dept === "beauty-personal-care" ? "beauty" : dept === "household-essentials" || dept === "kitchenware" ? "products" : "food";
  const host = OFF_HOSTS[kind];
  const words = query.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 2);
  const candidates = await byBrand(host, brand);
  let best = null;
  for (const p of candidates) {
    const name = `${p.product_name ?? ""} ${p.product_name_en ?? ""}`.toLowerCase();
    const hits = words.filter((w) => name.includes(w)).length;
    const score = hits + (p.countries_tags?.includes("en:india") ? 0.5 : 0);
    if (hits >= Math.max(1, Math.ceil(words.length / 2)) && (!best || score > best.score)) best = { p, score };
  }
  if (!best) return null;
  return {
    url: best.p.image_front_url.replace(/\.(\d+)\.jpg$/, ".$1.400.jpg").replace(/\.full\.jpg$/, ".400.jpg"),
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
console.log(`${jobs.size} lookups to do (${Object.keys(cache).length} cached).`);
let done = 0;
let found = 0;
for (const [key, { image, dept }] of jobs) {
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
  if (image.wiki) await sleep(250);
  if (++done % 25 === 0) {
    save();
    console.log(`  ${done}/${jobs.size} looked up, ${found} photos found`);
  }
}
save();
const total = Object.values(cache).filter((v) => v.url).length;
console.log(`Done: ${found} new photos this run; ${total} photos cached in total.`);
