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
  const images = readIf(path.join(CAT, "images.json"), {});
  const overrides = readIf(OVERRIDES, {});
  const shelf = new Map(); // subcategory slug -> { dept, deptName, path }
  for (const d of assortment.departments)
    for (const c of d.categories) for (const s of c.subcategories) if (s.slug) shelf.set(s.slug, { dept: d.slug, deptName: d.name, path: `${d.name} › ${c.name} › ${s.name}` });
  const order = assortment.departments.flatMap((d) => d.categories.map((c) => c.slug));
  const files = fs.readdirSync(path.join(CAT, "products")).filter((f) => f.endsWith(".json"));
  files.sort((a, b) => order.indexOf(a.replace(/\.json$/, "")) - order.indexOf(b.replace(/\.json$/, "")));
  const products = [read(path.join(CAT, "pinned.json")), ...files.map((f) => read(path.join(CAT, "products", f)))].flat();
  const seen = new Set();
  return products
    .filter((p) => !seen.has(p.slug) && seen.add(p.slug))
    .map((p) => {
      const where = shelf.get(p.subcategories[0]) ?? { dept: "", deptName: "", path: p.subcategories[0] };
      const key = !p.image ? null : p.image.wiki ? `wiki:${p.image.wiki}` : `off:${p.image.off.brand.toLowerCase()}|${p.image.off.query.toLowerCase()}`;
      const o = overrides[p.slug];
      const hit = o ? (o.url ? o : null) : images[key]?.url ? images[key] : null;
      return { ...p, dept: where.dept, deptName: where.deptName, path: where.path, current: hit ? { url: hit.url, credit: hit.credit, page: hit.page, source: hit.source } : null };
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
const FIELDS = "code,product_name,product_name_en,brands,image_front_url,countries_tags";
const factsThumb = (url) => url.replace(/\.(\d+)\.jpg$/, ".$1.400.jpg").replace(/\.full\.jpg$/, ".400.jpg");
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
  const m = /^https?:\/\/(?:[a-z]+\.)?open(food|beauty|products)facts\.org\/product\/(\d{6,14})/i.exec(link.trim());
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
