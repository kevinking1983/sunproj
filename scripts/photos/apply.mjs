#!/usr/bin/env node
/**
 * Puts photo choices into the catalog: merges them into supabase/catalog/image-overrides.json
 * (keyed by product slug, used ahead of images.json) and regenerates the seed.
 *
 *   npm run photos:apply                         uses photo-picker/choices.json
 *   npm run photos:apply -- photo-choices.json   a file exported from the picker
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import * as lib from "./lib.mjs";

const file = process.argv[2] ? path.resolve(process.argv[2]) : lib.CHOICES;
if (!fs.existsSync(file)) {
  console.error(`No choices file at ${file}. Run npm run photos:pick first, or pass the exported file.`);
  process.exit(1);
}
const choices = lib.read(file);
const known = new Set(lib.loadCatalog().map((p) => p.slug));
const overrides = lib.readIf(lib.OVERRIDES, {});
const ALLOWED = /^https:\/\/((upload|thumb)\.wikimedia\.org|images\.open(food|beauty|products)facts\.org|static\.open(food|beauty|products)facts\.org)\//;
let applied = 0;
const skipped = [];
for (const [slug, c] of Object.entries(choices)) {
  if (!known.has(slug)) skipped.push(`${slug}: no such product`);
  else if (c?.none) (overrides[slug] = { none: true }), applied++;
  else if (typeof c?.url === "string" && ALLOWED.test(c.url) && typeof c.credit === "string" && c.credit.trim() && /^https:\/\//.test(c.page ?? ""))
    (overrides[slug] = { url: c.url, credit: c.credit.trim().slice(0, 200), page: c.page, source: String(c.source ?? ""), license: String(c.license ?? "") }), applied++;
  else skipped.push(`${slug}: not a photo from Wikimedia Commons or Open Facts with a credit`);
}
lib.writeJson(lib.OVERRIDES, overrides);
console.log(`Applied ${applied} choices to supabase/catalog/image-overrides.json (${Object.keys(overrides).length} in total).`);
for (const s of skipped) console.warn(`  skipped ${s}`);
execFileSync("node", [path.join(lib.ROOT, "scripts/catalog/build-seed.mjs")], { stdio: "inherit" });
