#!/usr/bin/env node
/**
 * Photos from links pasted into supabase/catalog/photo-links.csv (one row per product, column
 * photo_link). Accepted links:
 *   Open Food / Beauty / Products Facts product page   https://in.openfoodfacts.org/product/8901058000290/...
 *   one of its photos ("Copy image address")           https://images.openfoodfacts.org/images/products/890/105/800/0290/front_en.12.400.jpg
 *   a bare barcode                                     8901058000290
 *   a Wikimedia Commons file page or image address     https://commons.wikimedia.org/wiki/File:Onions.jpg
 * Each link is checked (the photo exists; Commons files must be freely licensed) and recorded with
 * its credit in supabase/catalog/image-overrides.json. Runs in GitHub Actions ("Catalog photos").
 *
 *   node scripts/photos/import-links.mjs              resolve new or changed links
 *   node scripts/photos/import-links.mjs --template   add rows for every product still without a photo
 */
import fs from "node:fs";
import path from "node:path";
import * as lib from "./lib.mjs";

const FILE = path.join(lib.CAT, "photo-links.csv");
const HEAD = ["slug", "product", "brand", "pack", "shelf", "photo_link"];
const cell = (v) => (/[",\n\r]/.test(String(v ?? "")) ? `"${String(v).replace(/"/g, '""')}"` : String(v ?? ""));
const rows = fs.existsSync(FILE) ? lib.parseCsv(fs.readFileSync(FILE, "utf8")) : [];
const catalog = lib.loadCatalog();
const bySlug = new Map(catalog.map((p) => [p.slug, p]));

if (process.argv.includes("--template")) {
  const have = new Set(rows.map((r) => r.slug));
  let added = 0;
  for (const p of catalog)
    if (!p.current && !have.has(p.slug)) rows.push({ slug: p.slug, product: p.name, brand: p.brand ?? "", pack: p.unit_label, shelf: p.path.replace(/ › /g, " > "), photo_link: "" }), added++;
  // The byte-order mark makes Excel open the file as UTF-8.
  fs.writeFileSync(FILE, "\uFEFF" + [HEAD, ...rows.map((r) => HEAD.map((h) => r[h] ?? ""))].map((r) => r.map(cell).join(",")).join("\r\n") + "\r\n");
  console.log(`photo-links.csv: ${rows.length} rows (${added} added).`);
  process.exit(0);
}

/** What a pasted link points at. */
function parse(link) {
  const s = link.trim();
  if (/^\d{8,14}$/.test(s)) return { barcode: s };
  const page = lib.factsCodeFromLink(s);
  if (page) return { kind: page.kind, barcode: page.code };
  const img = /^https:\/\/images\.open(food|beauty|products)facts\.org\/images\/products\/([\d/]+)\/([\w.-]+\.(?:jpg|png|webp))$/i.exec(s);
  if (img) return { kind: img[1].toLowerCase(), barcode: img[2].replace(/\//g, ""), image: s };
  const title = lib.commonsTitleFromLink(s) ?? /^https:\/\/upload\.wikimedia\.org\/wikipedia\/commons\/(?:thumb\/)?[0-9a-f]\/[0-9a-f]{2}\/([^/?#]+)/i.exec(s)?.[1];
  if (title) return { commons: decodeURIComponent(title).replace(/_/g, " ").replace(/^File:/i, "") };
  return null;
}

async function resolve(link) {
  const t = parse(link);
  if (!t) throw new Error("not an Open Food/Beauty/Products Facts or Wikimedia Commons link");
  if (t.commons) {
    const c = (await lib.commonsFiles([t.commons]))[t.commons];
    if (!c || c.reject) throw new Error(`Commons file can't be used: ${c?.reject ?? "not found"}`);
    return c;
  }
  if (t.image) {
    const res = await fetch(t.image, { method: "HEAD", headers: { "User-Agent": lib.UA } });
    if (!res.ok) throw new Error(`photo not found (${res.status})`);
    const f = lib.FACTS[t.kind];
    return { url: t.image, page: `https://${f.host}/product/${t.barcode}`, license: "CC BY-SA", credit: `Photo: ${f.name} contributors, CC BY-SA`, source: f.source };
  }
  for (const kind of t.kind ? [t.kind] : ["food", "beauty", "products"]) {
    const c = await lib.factsProduct(kind, t.barcode);
    if (c) return c;
    await lib.sleep(700);
  }
  throw new Error(`no product with a front photo for barcode ${t.barcode}`);
}

const overrides = lib.readIf(lib.OVERRIDES, {});
let added = 0;
let removed = 0;
const problems = [];
for (const r of rows) {
  const link = (r.photo_link ?? "").trim();
  if (!link) {
    // A link cleared from the sheet takes its photo away again.
    if (overrides[r.slug]?.link) delete overrides[r.slug], removed++;
    continue;
  }
  if (!bySlug.has(r.slug)) {
    problems.push(`${r.slug}: no such product`);
    continue;
  }
  if (overrides[r.slug]?.link === link) continue; // already done
  try {
    const c = await resolve(link);
    overrides[r.slug] = { url: c.url, credit: c.credit, page: c.page, source: c.source, license: c.license, link };
    added++;
    console.log(`  ${r.slug}: ${c.page}`);
  } catch (e) {
    problems.push(`${r.slug}: ${e.message}`);
  }
  await lib.sleep(700);
}
lib.writeJson(lib.OVERRIDES, overrides);
console.log(`${added} photos added${removed ? `, ${removed} removed` : ""} from photo-links.csv.`);
if (problems.length) console.log(`${problems.length} links could not be used:\n${problems.map((p) => `  ${p}`).join("\n")}`);
