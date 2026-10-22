#!/usr/bin/env node
/**
 * Generates supabase/seeds/catalog.sql (categories, brands, products, shelves, stock) from:
 *   supabase/catalog/assortment.json   department -> category -> subcategory tree and brands
 *   supabase/catalog/products/*.json   products (validated by validate-products.mjs)
 *   supabase/catalog/pinned.json       products the automated tests rely on
 *   supabase/catalog/images.json       licensed image lookups (written by resolve-images.mjs)
 *   supabase/catalog/image-overrides.json  photos chosen by hand in the photo picker, by product slug
 * Deterministic: the same inputs always give the same file.
 *   node scripts/catalog/build-seed.mjs
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const CAT = path.join(ROOT, "supabase/catalog");
const read = (f) => JSON.parse(fs.readFileSync(f, "utf8"));

execFileSync("node", [path.join(ROOT, "scripts/catalog/validate-products.mjs"), ...fs.readdirSync(path.join(CAT, "products")).filter((f) => f.endsWith(".json")).map((f) => path.join(CAT, "products", f)), path.join(CAT, "pinned.json")], { stdio: "inherit" });

const assortment = read(path.join(CAT, "assortment.json"));
const images = fs.existsSync(path.join(CAT, "images.json")) ? read(path.join(CAT, "images.json")) : {};
const overrides = fs.existsSync(path.join(CAT, "image-overrides.json")) ? read(path.join(CAT, "image-overrides.json")) : {};
const productFiles = fs.readdirSync(path.join(CAT, "products")).filter((f) => f.endsWith(".json")).sort();

// Department and category icons, shown until a category has a photo.
const ICONS = {
  "grocery-kitchen": "🛒", "snacks-drinks": "🍿", "beauty-personal-care": "💄", "household-essentials": "🧴",
  "vegetables-fruits": "🥦", "atta-rice-dal": "🌾", "oil-ghee-masala": "🫙", "dairy-bread-eggs": "🥛",
  "bakery-biscuits": "🍪", "dry-fruits-cereals": "🥜", "chicken-meat-fish": "🍗", "kitchenware-appliances": "🍳",
  "chips-namkeen": "🥨", "sweets-chocolates": "🍫", "drinks-juices": "🧃", "tea-coffee-milk-drinks": "☕",
  "instant-food": "🍜", "sauces-spreads": "🥫", "paan-corner": "🌿", "ice-creams-more": "🍨",
  "bath-body": "🧼", "hair": "💇", "skin-face": "🧴", "beauty-cosmetics": "💋", "feminine-hygiene": "🌸",
  "cleaners-repellents": "🧽", "stationery-games": "✏️",
};
// Hidden at launch: regulated or not a deliverable product.
const HIDDEN = new Set(["paan-corner-smoking-cessation", "beauty-cosmetics-beauty-e-card"]);

const q = (v) => (v === null || v === undefined ? "null" : typeof v === "number" || typeof v === "boolean" ? String(v) : `'${String(v).replace(/'/g, "''")}'`);
const arr = (a) => (a.length ? `array[${a.map(q).join(", ")}]::text[]` : "'{}'::text[]");
const chunks = (rows, n = 250) => Array.from({ length: Math.ceil(rows.length / n) }, (_, i) => rows.slice(i * n, i * n + n));
const slugify = (s) => s.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/&/g, " ").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
const imageKey = (img) => (!img ? null : img.wiki ? `wiki:${img.wiki}` : `off:${img.off.brand.toLowerCase()}|${img.off.query.toLowerCase()}`);

// Products: pinned first, then each file in category order. Twin shelves are already merged by slug.
const order = assortment.departments.flatMap((d) => d.categories.map((c) => c.slug));
productFiles.sort((a, b) => order.indexOf(a.replace(/\.json$/, "")) - order.indexOf(b.replace(/\.json$/, "")));
const products = [...read(path.join(CAT, "pinned.json")), ...productFiles.flatMap((f) => read(path.join(CAT, "products", f)))];

const shelfProducts = new Map(); // subcategory slug -> product slugs in order
for (const p of products) for (const s of p.subcategories) (shelfProducts.get(s) ?? shelfProducts.set(s, []).get(s)).push(p);
const unknownOverrides = Object.keys(overrides).filter((slug) => !products.some((p) => p.slug === slug));
if (unknownOverrides.length) throw new Error(`image-overrides.json names products that do not exist: ${unknownOverrides.join(", ")}`);
// A photo chosen in the picker wins; {"none": true} means show no photo.
const imageOf = (p) => {
  const hit = overrides[p.slug] ?? images[imageKey(p.image)];
  return hit && hit.url ? hit : null;
};

// Category rows with an image taken from the first product on the shelf that has one.
const categoryRows = []; // [parentSlug, name, slug, sort, icon, description, image, active]
const shelfImage = (slugs) => {
  for (const s of slugs) for (const p of shelfProducts.get(s) ?? []) if (imageOf(p)) return imageOf(p).url;
  return null;
};
assortment.departments.forEach((d, di) => {
  const catSlugs = d.categories.flatMap((c) => c.subcategories.filter((s) => s.slug).map((s) => s.slug));
  categoryRows.push([null, d.name, d.slug, di + 1, ICONS[d.slug] ?? null, d.categories.map((c) => c.name).join(", "), shelfImage(catSlugs), true]);
});
assortment.departments.forEach((d) =>
  d.categories.forEach((c, ci) => {
    const subs = c.subcategories.filter((s) => s.slug);
    const live = subs.filter((s) => !HIDDEN.has(s.slug) && (shelfProducts.get(s.slug)?.length ?? 0) > 0);
    categoryRows.push([d.slug, c.name, c.slug, ci + 1, ICONS[c.slug] ?? null, live.map((s) => s.name).slice(0, 6).join(", "), shelfImage(live.map((s) => s.slug)), live.length > 0]);
  }),
);
assortment.departments.forEach((d) =>
  d.categories.forEach((c) =>
    c.subcategories.filter((s) => s.slug).forEach((s, si) => {
      const n = shelfProducts.get(s.slug)?.length ?? 0;
      categoryRows.push([c.slug, s.name, s.slug, si + 1, null, null, shelfImage([s.slug]), !HIDDEN.has(s.slug) && n > 0]);
    }),
  ),
);

const brands = [...new Set(assortment.departments.flatMap((d) => d.categories.flatMap((c) => c.subcategories.flatMap((s) => s.families.flatMap((f) => f.brands)))))].sort((a, b) => a.localeCompare(b));
const brandSlugs = new Map();
for (const b of brands) {
  let s = slugify(b) || "brand";
  for (let i = 2; [...brandSlugs.values()].includes(s); i++) s = `${slugify(b)}-${i}`;
  brandSlugs.set(b, s);
}

const out = [];
out.push(`-- GENERATED by scripts/catalog/build-seed.mjs from supabase/catalog. Do not edit by hand.
-- ${categoryRows.length} categories, ${brands.length} brands, ${products.length} products.
-- Prices are SAMPLE prices for the test stack; production prices come from the admin CSV import.
`);
out.push("-- Departments, categories and subcategories (parents before children)");
for (const level of [0, 1, 2]) {
  const rows = categoryRows.filter((r) => (level === 0 ? r[0] === null : level === 1 ? r[0] !== null && assortment.departments.some((d) => d.slug === r[0]) : r[0] !== null && !assortment.departments.some((d) => d.slug === r[0])));
  for (const chunk of chunks(rows)) {
    if (level === 0) out.push(`insert into public.categories (parent_id, name, slug, sort_order, icon, description, image_url, is_active) values\n${chunk.map((r) => `  (null, ${q(r[1])}, ${q(r[2])}, ${r[3]}, ${q(r[4])}, ${q(r[5])}, ${q(r[6])}, ${r[7]})`).join(",\n")};`);
    else out.push(`insert into public.categories (parent_id, name, slug, sort_order, icon, description, image_url, is_active)\nselect p.id, v.name, v.slug, v.sort_order, v.icon, v.description, v.image_url, v.is_active from (values\n${chunk.map((r) => `  (${q(r[0])}, ${q(r[1])}, ${q(r[2])}, ${r[3]}, ${q(r[4])}, ${q(r[5])}, ${q(r[6])}, ${r[7]})`).join(",\n")}\n) as v(parent_slug, name, slug, sort_order, icon, description, image_url, is_active)\njoin public.categories p on p.slug = v.parent_slug;`);
  }
}

out.push("\n-- Brands");
for (const chunk of chunks(brands, 400)) out.push(`insert into public.brands (name, slug) values\n${chunk.map((b) => `  (${q(b)}, ${q(brandSlugs.get(b))})`).join(",\n")};`);

out.push("\n-- Products (primary shelf = first subcategory)");
for (const chunk of chunks(products, 200)) {
  out.push(`insert into public.products (category_id, brand_id, name, slug, description, unit_label, mrp, price, tax_rate, images, tags, is_veg, orderable, image_credit)
select c.id, b.id, v.name, v.slug, v.description, v.unit_label, v.mrp, v.price, v.tax_rate, v.images, v.tags, v.is_veg, v.orderable, v.image_credit from (values
${chunk
  .map((p) => {
    const img = imageOf(p);
    return `  (${q(p.subcategories[0])}, ${q(p.brand)}, ${q(p.name)}, ${q(p.slug)}, ${q(p.description)}, ${q(p.unit_label)}, ${p.mrp}, ${p.price}, ${p.tax_rate}, ${arr(img ? [img.url] : [])}, ${arr(p.tags)}, ${q(p.is_veg)}::boolean, ${p.orderable}, ${q(img?.credit ?? null)})`;
  })
  .join(",\n")}
) as v(cat, brand, name, slug, description, unit_label, mrp, price, tax_rate, images, tags, is_veg, orderable, image_credit)
join public.categories c on c.slug = v.cat
left join public.brands b on b.name = v.brand;`);
}

out.push("\n-- Extra shelves and display order (the primary shelf row is added by a trigger)");
const shelfRows = [];
for (const [shelf, list] of shelfProducts) list.forEach((p, i) => shelfRows.push([p.slug, shelf, i + 1]));
for (const chunk of chunks(shelfRows, 500)) {
  out.push(`insert into public.product_categories (product_id, category_id, sort_order)
select p.id, c.id, v.sort_order from (values
${chunk.map((r) => `  (${q(r[0])}, ${q(r[1])}, ${r[2]})`).join(",\n")}
) as v(product_slug, category_slug, sort_order)
join public.products p on p.slug = v.product_slug
join public.categories c on c.slug = v.category_slug
on conflict (product_id, category_id) do update set sort_order = excluded.sort_order;`);
}

out.push(`\n-- Stock: 50 of everything at every store (test stack only)
insert into public.inventory (store_id, product_id, quantity)
select s.id, p.id, 50 from public.stores s cross join public.products p
on conflict do nothing;
`);

fs.mkdirSync(path.join(ROOT, "supabase/seeds"), { recursive: true });
fs.writeFileSync(path.join(ROOT, "supabase/seeds/catalog.sql"), out.join("\n\n"));
const withImage = products.filter(imageOf).length;
console.log(`Wrote supabase/seeds/catalog.sql: ${categoryRows.length} categories (${categoryRows.filter((r) => r[7]).length} visible), ${brands.length} brands, ${products.length} products (${withImage} with photos), ${shelfRows.length} shelf placements.`);
