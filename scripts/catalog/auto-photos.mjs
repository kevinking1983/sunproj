#!/usr/bin/env node
/**
 * Broader automatic photo matching, following the catalogue image policy
 * (supabase/catalog/IMAGE_POLICY.md). Runs in GitHub Actions ("Catalog auto photos") and writes
 * supabase/catalog/auto-photos.json.
 *
 *   Branded products: only their own pack shot, from a full-text search of Open Food / Beauty /
 *   Products Facts. The brand and every distinctive word of the name (product line, variant,
 *   flavour) must match; a matching pack size makes it high confidence. No match, no photo: a
 *   branded listing is never given a generic or another brand's photo.
 *   Generic and unbranded products: a freely licensed Wikimedia Commons photo of the item itself,
 *   credited as "Representative photo". Varieties that look different from the listing they share
 *   a photo with (Red Potato, White Onion) get their own photo.
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
    // Every variant word must be there: "Tata Sampann Toor Dal" is not "Tata Sampann Moong Dal".
    if (!needed.every((w) => has(text, w))) continue;
    const c = lib.factsCandidate(kind, { ...hit, brands });
    if (rejected.has(c.url)) continue;
    const size = lib.sameSize(p.unit_label, hit.quantity);
    const score = (size ? 2 : 0) + (hit.countries_tags?.includes("en:india") ? 1 : 0);
    if (!best || score > best.score) best = { c: { ...c, confidence: size ? "High" : "Medium", quantity: hit.quantity ?? "" }, score };
  }
  return best ? { ...best.c, match: "pack" } : null;
}

// Titles of maps, logos, drawings and dishes are not photos of the item as sold; nor are plants
// still growing (reviewers rejected most of those), unless the product is itself a flower or leaf.
const NOT_A_PHOTO = /\b(logo|map|diagram|chart|poster|advert|advertisement|label|icon|stamp|coat of arms|flag|graph|screenshot|illustration|drawing|painting|engraving|botanical|herbarium|k[oö]hler|blanco|plate \d+|dish|recipe|cooked|curry|salad|soup|fry|fried|biryani|sapling|seedling|nursery|butterfly|moth|beetle|caterpillar|larva|insect|bird|duckling|ship|boat|vessel|harbour|harbor|landscape|street|building|museum|specimen|anatomy|sign)\b/i;
// Dried seeds are the product for pulses, grains and spices, and the wrong thing for fresh produce.
const DRIED = /\b(dried|dry|seeds?)\b/i;
const soldDried = (p) => /^(atta-rice-dal|oil-ghee-masala|dry-fruits)/.test(p.subcategories[0] ?? "");
const GROWING = /\b(plant|plants|tree|trees|field|farm|orchard|plantation|crop|growing|cultivation|flowering|flower|flowers|blossom|bloom)\b/i;
const isFlowerOrLeaf = (p) => /\b(flower|flowers|garland|rose|marigold|jasmine|tuberose|chrysanthemum|lotus|leaf|leaves|tulsi)\b/i.test(p.name);
// The listing's Wikipedia article is the item's standard English name ("Okra" for Lady Finger,
// "Bell pepper" for Capsicum, "Green bean" for French Beans); searching by it avoids the
// homonyms reviewers kept rejecting (lady finger bananas, chillies, coffee beans).
const englishName = (p) => (p.image?.wiki ?? "").replace(/\s*\(.*\)$/, "");
async function representative(p, rejected, variety) {
  if (p.brand) return null; // never for branded listings
  const english = englishName(p);
  // A variety is searched with its distinguishing words ("red bell pepper", "baby potato").
  const raw = variety
    ? [english && `${variety.extra.join(" ")} ${english}`, p.name]
    : [english, p.name, ...p.tags];
  const queries = [...new Set(raw.filter(Boolean).map((t) => distinct(t).join(" ")).filter((t) => t.length > 2))].slice(0, 4);
  for (const q of queries) {
    const want = q.split(" ");
    const results = await commonsPace(() => lib.commonsSearch(q, 30));
    for (const c of results) {
      if (rejected.has(c.url) || NOT_A_PHOTO.test(c.title) || (!isFlowerOrLeaf(p) && GROWING.test(c.title)) || (!soldDried(p) && DRIED.test(c.title))) continue;
      const title = new Set(lib.words(c.title));
      if (!want.every((w) => has(title, w))) continue;
      return { ...c, credit: c.credit.replace(/^Photo:/, "Representative photo:"), match: variety ? "variety" : "representative", confidence: "Medium", query: q };
    }
  }
  return null;
}

const overrides = lib.readIf(lib.OVERRIDES, {});
const catalog = lib.loadCatalog();
const varieties = lib.varietyListings(catalog);
// A representative photo on a branded listing breaks the policy: drop it and look again.
for (const p of catalog) if (p.brand && auto[p.slug] && auto[p.slug].match !== "pack" && !auto[p.slug].miss) delete auto[p.slug];
// Products with no hand-picked photo and no strict match, plus varieties sharing another listing's photo.
const targets = catalog.filter((p) => !overrides[p.slug] && (!p.current || p.current.url === auto[p.slug]?.url || varieties.has(p.slug)));
let done = 0;
let found = 0;
// Bumped when the representative search improves, so generic and unbranded misses get one more try.
const REPRESENTATIVE_SEARCH = 4;
const only = args.includes("--category") ? args[args.indexOf("--category") + 1] : null;
const todo = targets.filter((p) => {
  if (only && !p.subcategories.some((s) => s.startsWith(only))) return false;
  const a = auto[p.slug];
  const rejected = new Set(rejects[p.slug] ?? []);
  if (a?.url && rejected.has(a.url)) return true;
  return !a || (a.miss && (retryMisses || (!p.brand && (a.search ?? 1) < REPRESENTATIVE_SEARCH)));
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
    const c = (await packShot(p, rejected)) ?? (await representative(p, rejected, varieties.get(p.slug)));
    auto[p.slug] = c ? { url: c.url, credit: c.credit, page: c.page, source: c.source, license: c.license, match: c.match, confidence: c.confidence, title: c.title, ...(c.quantity ? { quantity: c.quantity } : {}) } : { miss: true, ...(p.brand ? {} : { search: REPRESENTATIVE_SEARCH }) };
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
const count = (m) => all.filter((a) => a.match === m).length;
console.log(`Done: ${found} new. auto-photos.json has ${count("pack")} pack shots, ${count("representative")} representative and ${count("variety")} variety photos, ${all.filter((a) => a.miss).length} misses.`);
