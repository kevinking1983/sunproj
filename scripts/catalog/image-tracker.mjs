#!/usr/bin/env node
/**
 * Image-mapping tracker and coverage report, computed from the catalogue and the photo files
 * under the image policy (supabase/catalog/IMAGE_POLICY.md). Writes:
 *   supabase/catalog/image-tracker.csv          one row per listing (Output C and D)
 *   supabase/catalog/family-classification.csv  one row per product family in the document
 *   supabase/catalog/IMAGE_COVERAGE.md          classification, requirements, priority, coverage
 * Deterministic: the same inputs give the same files. Nothing here is marked verified or
 * visually approved unless it is recorded, with who checked it, in visual-audit.json.
 *
 *   node scripts/catalog/image-tracker.mjs
 */
import fs from "node:fs";
import path from "node:path";
import * as lib from "../photos/lib.mjs";

const assortment = lib.read(path.join(lib.CAT, "assortment.json"));
const audit = lib.readIf(path.join(lib.CAT, "visual-audit.json"), {}); // slug -> {url, status, by, date, note}
const catalog = lib.loadCatalog();
const varieties = lib.varietyListings(catalog);

// Where each subcategory sits, and its families.
const shelf = new Map();
for (const d of assortment.departments)
  for (const c of d.categories) for (const s of c.subcategories) if (s.slug) shelf.set(s.slug, { dept: d.name, cat: c.name, sub: s.name, families: s.families });

// The family a listing belongs to: its brand among the family's brands, and words in common.
const familyOf = (p) => {
  let best = null;
  for (const slug of p.subcategories) {
    for (const f of shelf.get(slug)?.families ?? []) {
      const fw = new Set(lib.words(`${f.name} ${f.varieties.join(" ")}`));
      const overlap = lib.words(p.name).filter((w) => fw.has(w) || fw.has(w.replace(/s$/, ""))).length;
      const brand = p.brand && f.brands.some((b) => b.toLowerCase() === p.brand.toLowerCase()) ? 3 : 0;
      const score = brand + overlap;
      if (score > 0 && (!best || score > best.score)) best = { f, slug, score };
    }
  }
  return best;
};

const SOURCE = { wikimedia: "Wikimedia Commons", openfoodfacts: "Open Food Facts", openbeautyfacts: "Open Beauty Facts", openproductsfacts: "Open Products Facts" };
const kindOf = (ph) => (!ph ? "" : ph.match === "variety" ? "Variety representative" : ph.match === "representative" || (ph.source === "wikimedia" && ph.from !== "manual") ? "Representative" : ph.source === "wikimedia" ? "Hand-picked" : "Pack shot");
const STAPLES = new Set(["atta-rice-dal", "oil-ghee-masala", "dairy-bread-eggs", "tea-coffee-milk-drinks", "bakery-biscuits", "instant-food"]);

const rows = catalog.map((p) => {
  const where = shelf.get(p.subcategories[0]) ?? { dept: "", cat: "", sub: p.subcategories[0] };
  const fam = familyOf(p);
  const cls = lib.brandClass(p);
  const spec = lib.specReason(p);
  const variety = varieties.get(p.slug);
  const ph = p.photo;
  const requirement = cls === "Branded" ? "Exact SKU" : variety ? "Variety" : "Generic";
  const group = cls === "Branded" ? `SKU-${p.slug}` : variety ? `VAR-${p.slug}` : p.image?.wiki ? `GEN-${lib.brandTag(p.image.wiki)}` : `GEN-${p.slug}`;
  let status;
  let notes;
  let priority;
  if (ph) {
    status = "LINKED";
    priority = cls === "Branded" ? 3 : "";
    const how = { manual: "chosen by hand", strict: "strict automatic lookup", auto: "broader automatic match" }[ph.from];
    notes =
      cls === "Branded"
        ? `${SOURCE[ph.source] ?? ph.source} pack shot, brand and product name matched (${how}).${ph.confidence === "High" ? ` Pack size matched (${ph.quantity}).` : " Pack size not verified."} Needs visual check of variant and size.`
        : `${kindOf(ph)} photo from ${SOURCE[ph.source] ?? ph.source} (${how}). Needs visual check that it shows this ${variety ? "variety" : "item"}.`;
  } else if (cls === "Branded") {
    status = "MANUAL_VERIFICATION_REQUIRED";
    priority = spec ? 5 : 4;
    notes = `No matching ${p.brand} pack shot found in open sources. Needs an authentic pack shot (brand or distributor asset, or own photo). Generic photos are not allowed for branded listings.`;
  } else if (variety) {
    status = "VARIANT_MISMATCH";
    priority = 2;
    notes = `Looks different from ${variety.base} (${variety.extra.join(", ")}); does not share its photo. Needs its own ${p.name.toLowerCase()} photo.`;
  } else {
    status = "NEEDS_NEW_SOURCE";
    priority = 1;
    notes = "No freely licensed representative photo found yet.";
  }
  const confidence = !ph ? "" : ph.confidence ?? (ph.from === "manual" ? "Medium" : "Medium");
  // An audit result only counts for the photo it was given for.
  const a = ph && audit[p.slug]?.url === ph.url ? audit[p.slug] : null;
  return {
    "Listing ID": p.slug,
    Department: where.dept,
    Category: where.cat,
    Subcategory: where.sub,
    "Product Family": fam?.f.name ?? "",
    "Product / Variant": p.name,
    Brand: p.brand ?? cls,
    "Brand Classification": cls,
    "Specification-dependent": spec ?? "",
    "Pack Size": p.unit_label,
    "Pack Size Verified": "No (sample listing)",
    "Image Requirement": requirement,
    "Image Reuse Allowed": cls === "Branded" ? "No" : "Yes",
    "Image Group ID": group,
    "Image Asset ID": ph ? lib.idOf(ph.url) : "",
    "Image Kind": kindOf(ph),
    "Source Website": ph ? (SOURCE[ph.source] ?? ph.source) : "",
    "Product Page URL": ph?.page ?? "",
    "Direct Image URL": ph?.url ?? "",
    "Licence / Credit": ph?.credit ?? "",
    "Match Confidence": confidence,
    "Image Collection Status": status,
    "Visual Audit Status": ph ? (a?.status ?? "VISUAL_AUDIT_PENDING") : "",
    Priority: priority,
    "Reason / Notes": a?.note ? `${notes} Audit: ${a.note}` : notes,
    _staple: p.subcategories.some((s) => [...STAPLES].some((c) => s.startsWith(c))),
    _family: fam ? `${fam.slug}|${fam.f.name}` : null,
  };
});

// --- Files --------------------------------------------------------------------------------
const cell = (v) => (/[",\n\r]/.test(String(v ?? "")) ? `"${String(v).replace(/"/g, '""')}"` : String(v ?? ""));
const writeCsv = (file, list) => {
  const head = Object.keys(list[0]).filter((k) => !k.startsWith("_"));
  fs.writeFileSync(path.join(lib.CAT, file), "\uFEFF" + [head, ...list.map((r) => head.map((h) => r[h]))].map((r) => r.map(cell).join(",")).join("\n") + "\n");
};
writeCsv("image-tracker.csv", rows);

const families = [];
for (const d of assortment.departments)
  for (const c of d.categories)
    for (const s of c.subcategories) {
      for (const f of s.families) {
        // "All (Sub-Categories)" families describe a whole category and have no shelf of their own.
        const mine = s.slug ? rows.filter((r) => r._family === `${s.slug}|${f.name}`) : [];
        const branded = f.brands.length > 0;
        const unbranded = Boolean(f.unbranded?.trim());
        const produce = /^(vegetables-fruits|chicken-meat-fish)/.test(s.slug);
        const type = produce && !branded ? "Generic" : branded && unbranded ? "Branded + unbranded" : branded ? "Branded only" : unbranded ? "Unbranded only" : "Generic";
        families.push({
          Department: d.name,
          Category: c.name,
          Subcategory: s.name,
          "Product Family": f.name,
          Varieties: f.varieties.join("; "),
          "Family Type": type,
          "Branded Options": f.brands.length,
          Brands: f.brands.join("; "),
          "Unbranded Option": f.unbranded ?? "",
          "Specification-dependent": mine.some((r) => r["Specification-dependent"]) ? "Yes" : "",
          "Sample Listings": mine.length,
          "Listings With Photo": mine.filter((r) => r["Image Collection Status"] === "LINKED").length,
          "Listings Without Photo": mine.filter((r) => r["Image Collection Status"] !== "LINKED").length,
        });
      }
    }
writeCsv("family-classification.csv", families);

// --- Report -------------------------------------------------------------------------------
const n = (f) => rows.filter(f).length;
const linked = (r) => r["Image Collection Status"] === "LINKED";
const by = (cls) => (r) => r["Brand Classification"] === cls;
const genericRows = rows.filter((r) => r["Brand Classification"] !== "Branded");
const brandedRows = rows.filter(by("Branded"));
const genericGroups = new Set(genericRows.map((r) => r["Image Group ID"]));
const genericGroupsLinked = new Set(genericRows.filter(linked).map((r) => r["Image Group ID"]));
const linkedRows = rows.filter(linked);
const uniqueAssets = new Set(linkedRows.map((r) => r["Image Asset ID"]));
const genericAssets = new Set(genericRows.filter(linked).map((r) => r["Image Asset ID"]));
const sharedBranded = (() => {
  const count = new Map();
  for (const r of brandedRows.filter(linked)) count.set(r["Image Asset ID"], (count.get(r["Image Asset ID"]) ?? 0) + 1);
  return brandedRows.filter((r) => linked(r) && count.get(r["Image Asset ID"]) > 1);
})();
const famType = (t) => families.filter((f) => f["Family Type"] === t).length;
const wholeCategory = families.filter((f) => /^all\b/i.test(f.Subcategory)).length;
const docOptions = families.reduce((s, f) => s + f["Branded Options"] + (f["Unbranded Option"] ? 1 : 0), 0);
const pct = (a, b) => (b ? `${Math.round((a / b) * 1000) / 10}%` : "0%");
const status = (s) => n((r) => r["Image Collection Status"] === s);
const prio = (k) => rows.filter((r) => r.Priority === k);
const top = (list, k = 12) => list.slice(0, k).map((r) => `${r["Product / Variant"]}${r.Brand && r["Brand Classification"] === "Branded" ? ` (${r.Brand})` : ""}`).join(", ");
const catTable = (() => {
  const m = new Map();
  for (const r of rows) {
    const k = `${r.Department} › ${r.Category}`;
    const e = m.get(k) ?? { total: 0, linked: 0, branded: 0, brandedMissing: 0 };
    e.total++;
    if (linked(r)) e.linked++;
    if (r["Brand Classification"] === "Branded") (e.branded++, linked(r) || e.brandedMissing++);
    m.set(k, e);
  }
  return [...m].map(([k, e]) => `| ${k} | ${e.total} | ${e.linked} | ${pct(e.linked, e.total)} | ${e.brandedMissing} |`).join("\n");
})();

const md = `# Image coverage report

Generated by \`scripts/catalog/image-tracker.mjs\` from the catalogue and the photo files; do not
edit by hand. The row-level mapping is in \`image-tracker.csv\` and the family classification in
\`family-classification.csv\`. The policy is in \`IMAGE_POLICY.md\`.

**Important limits.** The ${rows.length} listings are the test stack's *sample* catalogue, built from
the families and brands in the assortment document. Their pack sizes are typical sizes, not
verified retail SKUs, and production listings come from the admin CSV import. No photo counts as
visually approved unless the tracker says \`APPROVED\` (recorded in \`visual-audit.json\` with who checked it). "Linked" means a
licensed photo URL is recorded; photos are not downloaded, but the review contact sheets fetch
every pending photo, so a broken link shows up there as a failed tile.

## A. Classification summary

| | Count |
|---|---|
| Product families in the document | ${families.length} |
| — Generic (produce, meat, no brands listed) | ${famType("Generic")} |
| — Branded only | ${famType("Branded only")} |
| — Unbranded only | ${famType("Unbranded only")} |
| — Branded + unbranded options | ${famType("Branded + unbranded")} |
| Brand and unbranded options named in the document (candidates, not SKUs) | ${docOptions} |
| Sample listings in the catalogue | ${rows.length} |
| — Generic listings | ${n(by("Generic"))} |
| — Unbranded listings | ${n(by("Unbranded"))} |
| — Branded listings | ${n(by("Branded"))} |
| — of all listings, specification-dependent (cosmetics, chemicals, appliances, hygiene, organic claims) | ${n((r) => r["Specification-dependent"])} |
| Families with no sample listing yet (${wholeCategory} of them describe a whole category) | ${families.filter((f) => !f["Sample Listings"]).length} |

## B. Image requirement summary

| | Count |
|---|---|
| Unique representative images required (generic and unbranded image groups) | ${genericGroups.size} |
| — of which variety-specific | ${n((r) => r["Image Requirement"] === "Variety")} |
| Unique branded images required (one per branded listing) | ${brandedRows.length} |
| Representative image groups already covered | ${genericGroupsLinked.size} |
| Representative images in use (distinct photos) | ${genericAssets.size} |
| Branded listings with a linked pack shot | ${n((r) => by("Branded")(r) && linked(r))} |
| — of which pack size also matched (high confidence) | ${n((r) => by("Branded")(r) && r["Match Confidence"] === "High")} |
| — sharing one photo with another listing (other size of the same pack; check) | ${sharedBranded.length} |
| Additional representative images still needed | ${genericGroups.size - genericGroupsLinked.size} |
| Missing branded images (no authentic pack shot yet) | ${n((r) => by("Branded")(r) && !linked(r))} |
| Distinct photos in use, all listings | ${uniqueAssets.size} |
| Image reuse (listings covered per distinct photo) | ${linkedRows.length} listings on ${uniqueAssets.size} photos, ${pct(linkedRows.length - uniqueAssets.size, linkedRows.length)} reuse |

## C. Complete image mapping

See \`image-tracker.csv\` (${rows.length} rows; open in Excel). Columns follow the requested tracker,
plus licence/credit, image kind, specification-dependent reason and priority.

## D. Source and missing-asset tracker

| Collection status | Listings | Meaning |
|---|---|---|
| LINKED | ${status("LINKED")} | Licensed photo recorded; visual audit pending |
| NEEDS_NEW_SOURCE | ${status("NEEDS_NEW_SOURCE")} | Generic or unbranded; no free representative photo found yet |
| VARIANT_MISMATCH | ${status("VARIANT_MISMATCH")} | A variety that looks different from the listing whose photo it would share; needs its own |
| MANUAL_VERIFICATION_REQUIRED | ${status("MANUAL_VERIFICATION_REQUIRED")} | Branded; no authentic pack shot in open sources. Needs a brand or distributor asset or an own photo |

Sources in use: ${[...new Set(linkedRows.map((r) => r["Source Website"]))].map((s) => `${s} (${n((r) => linked(r) && r["Source Website"] === s)})`).join(", ")}.

| Department › Category | Listings | With photo | Coverage | Branded still missing |
|---|---|---|---|---|
${catTable}

## E. Collection priority

1. **Generic images that can cover listings** (${prio(1).length}): ${top(prio(1)) || "none"}${prio(1).length > 12 ? ", …" : ""}
2. **Varieties needing their own photo** (${prio(2).length}): ${top(prio(2)) || "none"}${prio(2).length > 12 ? ", …" : ""}
3. **Branded pack shots to confirm by visual audit** (${prio(3).length}): staples first (${prio(3).filter((r) => r._staple).length} in atta, rice, dal, oil, masala, dairy, tea, biscuits, instant food).
4. **Remaining branded listings without a pack shot** (${prio(4).length}), staples first: ${top(prio(4).filter((r) => r._staple))}${prio(4).filter((r) => r._staple).length > 12 ? ", …" : ""}
5. **Specification-dependent branded listings without a pack shot** (${prio(5).length}): cosmetics, cleaners and repellents, appliances, hygiene and organic products, where only the exact product image will do.

## F. Coverage report

| | Count |
|---|---|
| Total listings | ${rows.length} |
| Covered by a linked photo | ${linkedRows.length} (${pct(linkedRows.length, rows.length)}) |
| — representative photography (generic and unbranded) | ${n((r) => linked(r) && r["Brand Classification"] !== "Branded")} |
| — branded pack shots | ${n((r) => linked(r) && by("Branded")(r))} |
| Missing photos | ${rows.length - linkedRows.length} |
| Brand mismatches (generic or other-brand photo on a branded listing) | ${n((r) => by("Branded")(r) && linked(r) && r["Image Kind"] !== "Pack shot")} |
| Visual audit pending | ${n((r) => r["Visual Audit Status"] === "VISUAL_AUDIT_PENDING")} |
| Visually approved | ${n((r) => r["Visual Audit Status"] === "APPROVED")} |
| Needs a person to decide | ${n((r) => r["Visual Audit Status"] === "NEEDS_HUMAN_REVIEW")} |
| Photos rejected on review so far (never shown again for that listing) | ${Object.values(lib.readIf(lib.REJECTS, {})).flat().length} |

Not complete: ${rows.length - linkedRows.length} listings have no photo, and ${n((r) => r["Visual Audit Status"] === "VISUAL_AUDIT_PENDING")} linked photos still await a visual audit.
`;
fs.writeFileSync(path.join(lib.CAT, "IMAGE_COVERAGE.md"), md);
console.log(`Wrote image-tracker.csv (${rows.length} rows), family-classification.csv (${families.length} families), IMAGE_COVERAGE.md: ${linkedRows.length} listings with photos, ${rows.length - linkedRows.length} without.`);
