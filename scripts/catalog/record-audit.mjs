#!/usr/bin/env node
/**
 * Records the results of a visual photo review: approved photos go to visual-audit.json,
 * rejected ones to photo-rejects.json (never shown again for that listing), and photos the
 * reviewers could not settle are marked NEEDS_HUMAN_REVIEW.
 *
 *   node scripts/catalog/record-audit.mjs <results.json> --by "<reviewer>" --date YYYY-MM-DD
 *
 * results.json: [{ "slug", "url", "final": "ok" | "wrong" | "unsure", "shows", "reason" }]
 * Each result applies only to the photo (url) that was reviewed.
 */
import path from "node:path";
import * as lib from "../photos/lib.mjs";

const args = process.argv.slice(2);
const opt = (name) => (args.includes(name) ? args[args.indexOf(name) + 1] : null);
const by = opt("--by");
const date = opt("--date");
if (!args[0] || !by || !/^\d{4}-\d{2}-\d{2}$/.test(date ?? "")) {
  console.error('Usage: node scripts/catalog/record-audit.mjs <results.json> --by "<reviewer>" --date YYYY-MM-DD');
  process.exit(1);
}
const AUDIT = path.join(lib.CAT, "visual-audit.json");
const results = lib.read(path.resolve(args[0]));
const audit = lib.readIf(AUDIT, {});
const rejects = lib.readIf(lib.REJECTS, {});
const known = new Set(lib.loadCatalog().map((p) => p.slug));
const count = { ok: 0, wrong: 0, unsure: 0, skipped: 0 };
for (const r of results) {
  if (!known.has(r.slug) || !/^https:\/\//.test(r.url ?? "") || !["ok", "wrong", "unsure"].includes(r.final)) {
    count.skipped++;
    continue;
  }
  const note = [r.shows && `Shows: ${r.shows}.`, r.reason].filter(Boolean).join(" ").slice(0, 300);
  if (r.final === "wrong") {
    rejects[r.slug] = [...new Set([...(rejects[r.slug] ?? []), r.url])];
    if (audit[r.slug]?.url === r.url) delete audit[r.slug];
  } else audit[r.slug] = { url: r.url, status: r.final === "ok" ? "APPROVED" : "NEEDS_HUMAN_REVIEW", by, date, note };
  count[r.final]++;
}
lib.writeJson(AUDIT, audit);
lib.writeJson(lib.REJECTS, rejects);
console.log(`Recorded ${count.ok} approved, ${count.wrong} rejected, ${count.unsure} needing a person${count.skipped ? `, ${count.skipped} skipped (unknown listing or bad entry)` : ""}.`);
