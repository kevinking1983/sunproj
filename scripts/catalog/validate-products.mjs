#!/usr/bin/env node
/**
 * Checks product files in supabase/catalog/products/*.json against the assortment.
 *   node scripts/catalog/validate-products.mjs [file ...]   (default: every products file)
 * Exits non-zero on any error so CI and the seed generator can rely on it.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const assortment = JSON.parse(fs.readFileSync(path.join(ROOT, "supabase/catalog/assortment.json"), "utf8"));
const subSlugs = new Set();
const brands = new Set();
for (const d of assortment.departments)
  for (const c of d.categories)
    for (const s of c.subcategories) {
      if (s.slug) subSlugs.add(s.slug);
      for (const f of s.families) for (const b of f.brands) brands.add(b);
    }

const dir = path.join(ROOT, "supabase/catalog/products");
const files = process.argv.slice(2).length ? process.argv.slice(2) : fs.readdirSync(dir).filter((f) => f.endsWith(".json")).map((f) => path.join(dir, f));

const errors = [];
const seen = new Map();
let count = 0;
const UNIT = /^\d+(\.\d+)?\s?(g|kg|ml|L|pc|pcs|pack|packs|bunch|dozen|sheets|rolls|m|cm|in|tabs|caps|sachets|units|pairs|set)( x \d+)?$|^(pack of \d+|\d+ x \d+(\.\d+)?\s?(g|kg|ml|L|pc|pcs))$/i;
for (const file of files) {
  let list;
  try {
    list = JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (e) {
    errors.push(`${path.basename(file)}: not valid JSON (${e.message})`);
    continue;
  }
  if (!Array.isArray(list)) {
    errors.push(`${path.basename(file)}: top level must be an array`);
    continue;
  }
  list.forEach((p, i) => {
    const at = `${path.basename(file)}[${i}] ${p?.slug ?? ""}`;
    const bad = (m) => errors.push(`${at}: ${m}`);
    count++;
    if (typeof p.slug !== "string" || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(p.slug)) bad("slug must be lowercase kebab-case");
    else if (seen.has(p.slug)) bad(`duplicate slug (also in ${seen.get(p.slug)})`);
    else seen.set(p.slug, path.basename(file));
    if (typeof p.name !== "string" || p.name.length < 3 || p.name.length > 90) bad("name must be 3-90 characters");
    if (p.brand !== null && typeof p.brand !== "string") bad("brand must be a string or null");
    if (typeof p.brand === "string" && !brands.has(p.brand)) bad(`brand "${p.brand}" is not in the assortment brand list`);
    if (!Array.isArray(p.subcategories) || p.subcategories.length === 0) bad("subcategories must be a non-empty array");
    else for (const s of p.subcategories) if (!subSlugs.has(s)) bad(`unknown subcategory slug "${s}"`);
    if (typeof p.unit_label !== "string" || !UNIT.test(p.unit_label.trim())) bad(`unit_label "${p.unit_label}" should look like "500 g", "1 L", "6 pcs", "1 bunch", "Pack of 3"`);
    if (!Number.isInteger(p.mrp) || p.mrp < 500 || p.mrp > 5_000_000) bad("mrp must be integer paise between 500 and 5000000");
    if (!Number.isInteger(p.price) || p.price < 500 || p.price > p.mrp) bad("price must be integer paise, at least 500 and not above mrp");
    if (Number.isInteger(p.mrp) && Number.isInteger(p.price) && p.price < p.mrp * 0.6) bad("price more than 40% below mrp");
    if (typeof p.description !== "string" || p.description.length < 40 || p.description.length > 420) bad("description must be 40-420 characters");
    if (![0, 5, 12, 18, 28].includes(p.tax_rate)) bad("tax_rate must be one of 0, 5, 12, 18, 28");
    if (![true, false, null].includes(p.is_veg)) bad("is_veg must be true, false or null");
    if (!Array.isArray(p.tags) || p.tags.some((t) => typeof t !== "string")) bad("tags must be an array of strings");
    if (typeof p.orderable !== "boolean") bad("orderable must be true or false");
    const img = p.image;
    if (img !== null) {
      if (typeof img !== "object") bad("image must be an object or null");
      else if (typeof img.wiki === "string") {
        if (!img.wiki.trim()) bad("image.wiki must be a Wikipedia article title");
      } else if (img.off && typeof img.off === "object") {
        if (typeof img.off.brand !== "string" || typeof img.off.query !== "string") bad("image.off needs brand and query strings");
      } else bad('image must be {"wiki": "<title>"} or {"off": {"brand", "query"}} or null');
    }
  });
}

if (errors.length) {
  console.error(errors.slice(0, 200).join("\n"));
  console.error(`\n${errors.length} problem(s) in ${count} product(s).`);
  process.exit(1);
}
console.log(`OK: ${count} product(s) in ${files.length} file(s).`);
