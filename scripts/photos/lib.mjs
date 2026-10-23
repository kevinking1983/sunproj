/**
 * Shared pieces of the photo picker: the catalog, and lookups against openly licensed sources
 * (Wikimedia Commons and Open Food / Beauty / Products Facts). Every candidate carries its
 * licence and the credit that licence requires.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
export const CAT = path.join(ROOT, "supabase/catalog");
export const WORK = path.join(ROOT, "photo-picker");
export const OVERRIDES = path.join(CAT, "image-overrides.json");
export const CHOICES = path.join(WORK, "choices.json");
export const AUTO = path.join(CAT, "auto-photos.json");
export const REJECTS = path.join(CAT, "photo-rejects.json");
export const UA = "RATION-photo-picker/1.0 (https://github.com/kevinking1983/sunproj; catalog photo review)";

export const read = (f) => JSON.parse(fs.readFileSync(f, "utf8"));
export const readIf = (f, fallback) => (fs.existsSync(f) ? read(f) : fallback);
export const writeJson = (f, v) => {
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, JSON.stringify(Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b))), null, 1) + "\n");
};
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export const idOf = (s) => crypto.createHash("sha1").update(s).digest("hex").slice(0, 12);
export const stripHtml = (s) => String(s ?? "").replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
export const words = (s) => String(s ?? "").toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").split(/[^a-z0-9]+/).filter((w) => w.length > 2);
// Words that say nothing about which product it is.
export const GENERIC = new Set("organic premium pure natural fresh classic original regular india indian best new pack combo value family special select gold super plus the and with for from made fine refined whole style flavour flavor taste real rich instant ready mix".split(" "));

/** Products in catalog order, with their department and category path, and the photo they have now. */
export function loadCatalog() {
  const assortment = read(path.join(CAT, "assortment.json"));

  const shelf = new Map(); // subcategory slug -> { dept, deptName, path }
  for (const d of assortment.departments)
    for (const c of d.categories) for (const s of c.subcategories) if (s.slug) shelf.set(s.slug, { dept: d.slug, deptName: d.name, path: `${d.name} › ${c.name} › ${s.name}` });
  const order = assortment.departments.flatMap((d) => d.categories.map((c) => c.slug));
  const files = fs.readdirSync(path.join(CAT, "products")).filter((f) => f.endsWith(".json"));
  files.sort((a, b) => order.indexOf(a.replace(/\.json$/, "")) - order.indexOf(b.replace(/\.json$/, "")));
  const products = [read(path.join(CAT, "pinned.json")), ...files.map((f) => read(path.join(CAT, "products", f)))].flat();
  const seen = new Set();
  const unique = products.filter((p) => !seen.has(p.slug) && seen.add(p.slug));
  const photoOf = imageResolver(unique);
  return unique
    .map((p) => {
      const where = shelf.get(p.subcategories[0]) ?? { dept: "", deptName: "", path: p.subcategories[0] };
      const hit = photoOf(p);
      return { ...p, dept: where.dept, deptName: where.deptName, path: where.path, current: hit ? { url: hit.url, credit: hit.credit, page: hit.page, source: hit.source } : null, photo: hit };
    });
}

// Generic produce and meat get photos of the thing itself; packaged goods need a pack shot.
export const isGeneric = (p) => Boolean(p.image?.wiki) || /^(vegetables-fruits|chicken-meat-fish)-/.test(p.subcategories[0] ?? "");
export const factsKind = (p) => (p.dept === "beauty-personal-care" ? "beauty" : p.dept === "household-essentials" || p.subcategories[0]?.startsWith("kitchenware-appliances") ? "products" : "food");
export const FACTS = {
  food: { host: "world.openfoodfacts.org", name: "Open Food Facts", source: "openfoodfacts" },
  beauty: { host: "world.openbeautyfacts.org", name: "Open Beauty Facts", source: "openbeautyfacts" },
  products: { host: "world.openproductsfacts.org", name: "Open Products Facts", source: "openproductsfacts" },
};
export const brandTag = (b) => b.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/&/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

export async function getJson(url, { retries = 2 } = {}) {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json" } });
    if (res.status === 404) return null;
    if (res.ok) return res.json();
    if ((res.status === 429 || res.status >= 500) && attempt < retries) {
      await sleep(5_000 * (attempt + 1));
      continue;
    }
    throw new Error(`${res.status} from ${new URL(url).host}`);
  }
}

// --- Wikimedia Commons ------------------------------------------------------------------
const FREE = /^(cc[ -]|cc0|public domain|pd)/i;
const COMMONS_API = "https://commons.wikimedia.org/w/api.php?action=query&format=json&formatversion=2&prop=imageinfo&iiprop=url%7Csize%7Cmime%7Cextmetadata&iiurlwidth=640";

/** A Commons file page as a candidate, or the reason it cannot be used. */
export function commonsCandidate(page) {
  const ii = page?.imageinfo?.[0];
  if (!ii) return { reject: "not found on Wikimedia Commons" };
  if (!/^image\/(jpeg|png|webp)$/.test(ii.mime ?? "")) return { reject: `not a photo (${ii.mime})` };
  const meta = ii.extmetadata ?? {};
  const license = stripHtml(meta.LicenseShortName?.value);
  if (meta.NonFree?.value === "true" || !FREE.test(license)) return { reject: `licence is not free (${license || "unknown"})` };
  const artist = stripHtml(meta.Artist?.value).slice(0, 80) || "Unknown author";
  return {
    title: page.title.replace(/^File:/, ""),
    url: ii.thumburl ?? ii.url,
    page: ii.descriptionurl,
    license,
    credit: `Photo: ${artist}, ${license}, via Wikimedia Commons`,
    source: "wikimedia",
    width: ii.width,
    height: ii.height,
    warning: stripHtml(meta.Restrictions?.value) ? `Restrictions: ${stripHtml(meta.Restrictions.value)}` : null,
  };
}

/** Photos on Commons matching a text search, freely licensed only. */
export async function commonsSearch(query, limit = 10) {
  const data = await getJson(`${COMMONS_API}&generator=search&gsrnamespace=6&gsrlimit=${limit}&gsrsearch=${encodeURIComponent(`${query} filetype:bitmap`)}`);
  const pages = (data?.query?.pages ?? []).sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
  return pages.map(commonsCandidate).filter((c) => !c.reject && c.width >= 300);
}

/** Commons files by title ("File:..." or bare), up to 50 per call. Returns bare title -> candidate or reject. */
export async function commonsFiles(titles) {
  const out = {};
  for (let i = 0; i < titles.length; i += 50) {
    const batch = titles.slice(i, i + 50).map((t) => (t.startsWith("File:") ? t : `File:${t}`));
    const data = await getJson(`${COMMONS_API}&titles=${encodeURIComponent(batch.join("|"))}`);
    const norm = new Map((data?.query?.normalized ?? []).map((n) => [n.to, n.from]));
    for (const page of data?.query?.pages ?? []) out[(norm.get(page.title) ?? page.title).replace(/^File:/, "")] = page.missing ? { reject: "not found on Wikimedia Commons" } : commonsCandidate(page);
  }
  return out;
}

export const commonsTitleFromLink = (link) => {
  const m = /^https?:\/\/(?:commons\.wikimedia\.org|[a-z-]+\.wikipedia\.org)\/wiki\/(File:[^?#]+)/i.exec(link.trim()) ?? /[?&]title=(File:[^&#]+)/i.exec(link.trim());
  return m ? decodeURIComponent(m[1]).replace(/_/g, " ").replace(/^File:/i, "") : null;
};

// --- Open Food / Beauty / Products Facts ------------------------------------------------
export const FIELDS = "code,product_name,product_name_en,brands,quantity,image_front_url,countries_tags";
// Open Facts photo URLs: ".../front_en.12.400.jpg" is the 400 px version of photo revision 12,
// which also exists as ".../front_en.12.jpg" and ".../front_en.12.full.jpg". URLs that already
// name a size are kept at (or moved to) 400 px; nothing is ever sized twice.
export const factsThumb = (url) =>
  url
    .replace(/\.400\.400\.jpg$/, ".400.jpg")
    .replace(/\.(\d+)\.(?:\d+|full)\.jpg$/, ".$1.400.jpg")
    .replace(/(\/[a-z]+(?:_[a-z]{2,3})?\.\d+)\.jpg$/i, "$1.400.jpg");
export const factsCandidate = (kind, p) => ({
  title: [p.brands, p.product_name_en || p.product_name].filter(Boolean).join(" · ") || p.code,
  url: factsThumb(p.image_front_url),
  page: `https://${FACTS[kind].host}/product/${p.code}`,
  license: "CC BY-SA",
  credit: `Photo: ${FACTS[kind].name} contributors, CC BY-SA`,
  source: FACTS[kind].source,
  india: p.countries_tags?.includes("en:india") ?? false,
});

/** Every product of a brand that has a front photo. */
export async function factsByBrand(kind, brand) {
  let list;
  try {
    const data = await getJson(`https://${FACTS[kind].host}/api/v2/search?brands_tags=${encodeURIComponent(brandTag(brand))}&fields=${FIELDS}&page_size=100`, { retries: 1 });
    list = data?.products ?? [];
  } catch (e) {
    if (kind !== "food") throw e;
    const data = await getJson(`https://search.openfoodfacts.org/search?q=${encodeURIComponent(`brands_tags:"${brandTag(brand)}"`)}&page_size=100&fields=${FIELDS}`, { retries: 1 });
    list = data?.hits ?? [];
  }
  return list.filter((p) => p.image_front_url && p.code);
}

/** The brand's products ranked by how well their names match ours; at least one distinctive word must match. */
export function rankFacts(kind, list, product, n) {
  const brandWords = new Set(words(product.brand));
  const needed = [...new Set(words(`${product.image?.off?.query ?? ""} ${product.name}`).filter((w) => !GENERIC.has(w) && !brandWords.has(w)))];
  return list
    .map((p) => {
      const name = new Set(words(`${p.product_name ?? ""} ${p.product_name_en ?? ""}`));
      const hits = needed.filter((w) => name.has(w) || name.has(w.replace(/s$/, "")) || name.has(`${w}s`)).length;
      return { p, score: hits + (p.countries_tags?.includes("en:india") ? 0.5 : 0), hits };
    })
    .filter((r) => r.hits > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, n)
    .map((r) => factsCandidate(kind, r.p));
}

export const factsCodeFromLink = (link) => {
  const m = /^https?:\/\/(?:[a-z-]+\.)?open(food|beauty|products)facts\.org\/product\/(\d{6,14})/i.exec(link.trim());
  return m ? { kind: m[1].toLowerCase() === "food" ? "food" : m[1].toLowerCase(), code: m[2] } : null;
};

export async function factsProduct(kind, code) {
  const data = await getJson(`https://${FACTS[kind].host}/api/v2/product/${code}?fields=${FIELDS}`);
  return data?.product?.image_front_url ? factsCandidate(kind, { ...data.product, code }) : null;
}

// --- The user's own photo audit (CSV with Commons file links) -----------------------------
export function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  text = text.replace(/^﻿/, "");
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') (cell += '"'), i++;
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") row.push(cell), (cell = "");
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell), rows.push(row), (row = []), (cell = "");
    } else cell += ch;
  }
  if (cell || row.length) row.push(cell), rows.push(row);
  const [head, ...body] = rows.filter((r) => r.some((c) => c.trim()));
  return body.map((r) => Object.fromEntries(head.map((h, i) => [h.trim(), (r[i] ?? "").trim()])));
}

/**
 * Rows of an audit CSV that point at a Commons file and were not marked REPLACE, matched to
 * products by the words of their product family (e.g. "Brinjal/eggplant" -> Brinjal).
 */
export function auditMatches(rows, products) {
  const out = new Map(); // product slug -> [{ title, note }]
  const slug = (s) => words(s.replace(/&/g, " ")).join("-");
  const shelves = new Set(products.flatMap((p) => p.subcategories));
  for (const r of rows) {
    // A row's subcategory ("Fresh Vegetables") keeps it on that shelf when the catalog has one by that name.
    const sub = slug(r["Subcategory"] ?? "");
    const onShelf = (p) => !sub || ![...shelves].some((s) => s.endsWith(`-${sub}`)) || p.subcategories.some((s) => s.endsWith(`-${sub}`));
    const title = commonsTitleFromLink(r["Source URL"] ?? "");
    if (!title || /^replace$/i.test(r["Visual review"] ?? "")) continue;
    // "Brinjal/eggplant" is two names for one thing: any one name, with all its words, matches.
    const names = String(r["Product family"] ?? "").split(/\/|,|\bor\b/).map((n) => words(n).filter((w) => !GENERIC.has(w))).filter((n) => n.length);
    if (!names.length) continue;
    const note = [r["Visual review"], r["Photo label"], r["Finding"]].filter(Boolean).join(" — ");
    for (const p of products) {
      if (!isGeneric(p) || !onShelf(p)) continue;
      const mine = new Set(words(`${p.name} ${p.tags.join(" ")}`).flatMap((w) => [w, w.replace(/s$/, "")]));
      if (!names.some((n) => n.every((w) => mine.has(w) || mine.has(w.replace(/s$/, ""))))) continue;
      // Photos whose label shares more words with the product name ("Long purple brinjal" for Long Brinjal) come first.
      const label = new Set(words(r["Photo label"]));
      const score = words(p.name).filter((w) => label.has(w) || label.has(`${w}s`)).length;
      (out.get(p.slug) ?? out.set(p.slug, []).get(p.slug)).push({ title, note, score });
    }
  }
  for (const list of out.values()) list.sort((a, b) => b.score - a.score);
  return out;
}

// --- Image policy --------------------------------------------------------------------------
// Generic produce, meat and eggs; unbranded commodities; branded goods. Branded products only
// ever get their own pack shot; generic and unbranded ones may share a representative photo when
// they look the same.
export function brandClass(p) {
  if (p.brand) return "Branded";
  return /^(vegetables-fruits|chicken-meat-fish|dairy-bread-eggs-eggs)/.test(p.subcategories[0] ?? "") ? "Generic" : "Unbranded";
}

/** Why a listing's exact identity matters (cosmetics, chemicals, appliances, claims), or null. */
export function specReason(p) {
  const s = p.subcategories.join(" ");
  if (/\bappliances?\b|-appliances/.test(s) || /\b(electric|mixer|grinder|kettle|induction|toaster|iron|trimmer|dryer)\b/i.test(p.name)) return "electrical appliance: model must match";
  if (p.subcategories.some((x) => x.startsWith("feminine-hygiene"))) return "hygiene product";
  if (p.subcategories.some((x) => x.startsWith("cleaners-repellents"))) return "chemical or repellent: formulation must match";
  if (/baby/.test(s) || /\bbaby\b/i.test(p.name) && p.brand) return "baby product";
  if (p.dept === "beauty-personal-care") return "cosmetic or personal care: formula/shade must match";
  if (/\borganic\b/i.test(p.name)) return "organic claim: certified pack must be shown";
  return null;
}

// Words that change the name but not what the product looks like.
const LOOKS_SAME = new Set("hybrid local desi nati country tender large big small medium fine farm loose imported indian pooja".split(" "));
const NAME_ONLY = new Set([...GENERIC, ...LOOKS_SAME]);
const nameWords = (s) => new Set(words(s).filter((w) => !NAME_ONLY.has(w) && !/^\d/.test(w)));

/**
 * Generic listings that share one representative photo (same Wikipedia article) but differ in
 * look: Red Potato and Baby Potato against Potato, White Onion against Onion. Returns
 * slug -> the words that make it a different variety. The simplest name in each group keeps the
 * shared photo.
 */
export function varietyListings(products) {
  const groups = new Map();
  for (const p of products) if (!p.brand && p.image?.wiki) (groups.get(p.image.wiki) ?? groups.set(p.image.wiki, []).get(p.image.wiki)).push(p);
  const out = new Map();
  for (const list of groups.values()) {
    if (list.length < 2) continue;
    const base = [...list].sort((a, b) => nameWords(a.name).size - nameWords(b.name).size)[0];
    const baseWords = nameWords(base.name);
    for (const p of list) {
      if (p === base) continue;
      const extra = [...nameWords(p.name)].filter((w) => !baseWords.has(w) && !baseWords.has(w.replace(/s$/, "")));
      if (extra.length) out.set(p.slug, { base: base.slug, extra });
    }
  }
  return out;
}

/** "5 kg" against an Open Food Facts quantity such as "5kg" or "5000 g". */
export function sameSize(unitLabel, quantity) {
  const parse = (s) => {
    const m = /(\d+(?:[.,]\d+)?)\s*(kg|g|gm|gms|grams?|l|ltr|litres?|liters?|ml)\b/i.exec(String(s ?? "").replace(/\s+/g, " "));
    if (!m) return null;
    const n = Number(m[1].replace(",", "."));
    const u = m[2].toLowerCase();
    return u === "kg" || u.startsWith("l") ? [n * 1000, u === "kg" ? "g" : "ml"] : [n, u === "ml" ? "ml" : "g"];
  };
  const a = parse(unitLabel);
  const b = parse(quantity);
  return Boolean(a && b && a[1] === b[1] && Math.abs(a[0] - b[0]) <= a[0] * 0.01);
}

/**
 * The photo a listing gets under the image policy, with where it came from, or null:
 *   1. chosen by hand (image-overrides.json; {"none": true} = no photo)
 *   2. a variety's own photo (auto-photos.json)
 *   3. the strict lookup (images.json), except that a variety never borrows the photo of a
 *      listing that looks different
 *   4. the broader automatic match (auto-photos.json); never a generic photo on a branded listing
 * Automatic photos rejected on review (photo-rejects.json) are never used for that listing.
 */
export function imageResolver(products, sources = {}) {
  const images = sources.images ?? readIf(path.join(CAT, "images.json"), {});
  const overrides = sources.overrides ?? readIf(OVERRIDES, {});
  const auto = sources.auto ?? readIf(AUTO, {});
  const rejects = sources.rejects ?? readIf(REJECTS, {});
  const varieties = varietyListings(products);
  const keyOf = (img) => (!img ? null : img.wiki ? `wiki:${img.wiki}` : `off:${img.off.brand.toLowerCase()}|${img.off.query.toLowerCase()}`);
  return (p) => {
    const manual = overrides[p.slug];
    if (manual) return manual.url ? { ...manual, from: "manual" } : null;
    const rejected = new Set(rejects[p.slug] ?? []);
    const a = auto[p.slug]?.url && !(p.brand && auto[p.slug].match !== "pack") && !rejected.has(auto[p.slug].url) ? auto[p.slug] : null;
    if (a?.match === "variety") return { ...a, from: "auto" };
    const hit = images[keyOf(p.image)];
    if (hit?.url && !varieties.has(p.slug) && !rejected.has(hit.url)) return { ...hit, from: "strict", key: keyOf(p.image) };
    if (a && !varieties.has(p.slug)) return { ...a, from: "auto" };
    return null;
  };
}
