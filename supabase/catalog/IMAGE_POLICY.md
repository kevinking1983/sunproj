# Catalogue image policy

How every listing gets its photo, and how the code enforces it. The current state is in
`IMAGE_COVERAGE.md` and, row by row, in `image-tracker.csv`.

## Principles

1. **One accurate representative photo may serve several generic listings** when they look the
   same (Onion 500 g and Onion 1 kg).
2. **Each branded product keeps its own identity.** A branded listing only ever shows its own
   pack: never a generic photo, never another brand's pack. No pack shot, no photo; the listing is
   flagged for sourcing.
3. **Varieties that look different get their own photo**: red and white onion, red and yellow
   capsicum, green and black grapes, Kashmiri and Fuji apples. Words that do not change the look
   (hybrid, local, desi, tender, large, imported) do not need a new photo.
4. **Real photographs only.** No generated packaging, logos, labels, certification marks or
   claims.
5. **Only photos licensed for commercial reuse**, with the credit the licence asks for shown under
   the photo. A photo on a retailer's website is not licensed just because it is public.
6. **Finding a photo is not approving it.** Every photo stays `VISUAL_AUDIT_PENDING` until someone
   has looked at it.

## Classes

| Class | What | Photo |
|---|---|---|
| Generic | Loose produce, meat, eggs | Representative photo of the item (variety-specific where it looks different) |
| Unbranded | Loose commodities (loose dal, rice, whole spices) | Representative photo of the right grain, form and colour |
| Branded | Anything sold under a brand | Authentic pack shot of that brand, product line and variant |
| Specification-dependent (flag, any class) | Cosmetics, cleaners and repellents, appliances, hygiene and baby products, organic claims | Exact product image only |

## Sources, in order of use

1. Photos chosen by hand: `photo-links.csv` (paste an Open Facts or Commons link) or the photo
   picker; stored in `image-overrides.json`.
2. Strict automatic lookup (`resolve-images.mjs` → `images.json`): the Wikipedia article photo for
   generic items, accepted only when Commons marks it freely licensed; Open Food / Beauty /
   Products Facts pack shots matched by brand and name for branded items.
3. Broader automatic matching (`auto-photos.mjs` → `auto-photos.json`): branded items need the
   brand **and every distinctive word of the name** (product line, variant, flavour) to match; a
   matching pack size makes it high confidence. Generic and unbranded items get a freely
   licensed Commons photo of the item, credited "Representative photo"; varieties are searched by
   their own name.

Brand and distributor pack shots are the best source for branded items, and the only realistic
one for most cosmetics, cleaners, appliances and stationery. Use them with the brand's or
distributor's written permission and load them through the admin CSV import (`image_url`,
`image_credit`).

## Review

The "Catalog auto photos" workflow publishes contact sheets of every photo awaiting audit to the
`photo-review` branch (`sheet-NNN.jpg`, with `index.json` mapping each numbered photo to its
listing). After checking a sheet:

- wrong photo: add it to `photo-rejects.json` as `{"<listing slug>": ["<photo url>"]}`. It is
  never shown again for that listing, whichever source found it, and the next run looks for
  another candidate;
- right photo: add it to `visual-audit.json` as
  `{"<listing slug>": {"url": "<photo url>", "status": "APPROVED", "by": "<who>", "date": "YYYY-MM-DD", "note": "..."}}`.
  An approval only counts while the listing still shows that photo. `NEEDS_HUMAN_REVIEW` marks a
  photo the reviewers could not settle.

A change to `photo-rejects.json` re-runs the workflow, which looks for new candidates and
regenerates the seed, the tracker and the report. After recording approvals, run
`node scripts/catalog/build-seed.mjs` and `node scripts/catalog/image-tracker.mjs` (CI checks both
are up to date); `scripts/catalog/record-audit.mjs` writes a review's results into both files.

## Statuses

| Column | Values |
|---|---|
| Image Collection Status | `LINKED` (licensed photo URL recorded), `NEEDS_NEW_SOURCE`, `VARIANT_MISMATCH`, `MANUAL_VERIFICATION_REQUIRED` |
| Visual Audit Status | `VISUAL_AUDIT_PENDING`, `APPROVED`, `NEEDS_HUMAN_REVIEW` (from `visual-audit.json`) |
| Match Confidence | `High` (brand, variant and pack size match), `Medium` (brand and variant match, or a representative photo), blank when there is no photo |

The sample listings' pack sizes are not verified retail SKUs; production listings, prices and
stock come from the admin CSV import.
