# Catalog

The store's departments, categories, subcategories and sample products, built from
`Grocery_Details_Expanded_Product_Listings.docx`.

| File | What it is |
|---|---|
| `assortment.json` | The document as data: 4 departments, 23 categories, 226 subcategories, 652 product families with their brands. Names follow the document, with obvious typos fixed. |
| `products/<category>.json` | 1,245 sample products: original descriptions, realistic pack sizes, **sample** prices, GST rate, search tags and a photo lookup key. |
| `pinned.json` | Toor Dal, Toned Milk and Brown Bread with fixed prices; the automated tests rely on them. |
| `images.json` | Licensed photos and their credits, written by the "Catalog photos" GitHub Actions workflow. |
| `photo-links.csv` | Products still without a photo, with a column to paste an Open Food Facts or Commons link. |
| `auto-photos.json`, `photo-rejects.json` | Broader automatic matches, and photos rejected on review. |
| `image-overrides.json` | Photos chosen by hand (photo-links.csv or the photo picker), by product slug. They win over `images.json`; `{"none": true}` removes a wrong photo. |
| `IMAGE_POLICY.md` | Which photo each kind of listing may use (branded = own pack only; varieties get their own photo). |
| `IMAGE_COVERAGE.md`, `image-tracker.csv`, `family-classification.csv` | Generated coverage report, row-level image mapping and family classification (`node scripts/catalog/image-tracker.mjs`). |
| `visual-audit.json` | Photos a person has checked and approved. |
| `AGENT_BRIEF.md` | The rules the product files were written to. |

`../seeds/catalog.sql` is generated from these files and loaded after `../seed.sql` on every
local reset. Do not edit it by hand:

```bash
node scripts/catalog/validate-products.mjs   # check product files
node scripts/catalog/build-seed.mjs          # regenerate seeds/catalog.sql
```

CI fails if the seed is out of date.

## Photos

Photos are looked up only from openly licensed sources, and each carries the credit its licence
requires (shown under the photo on the product page):

- Fresh produce and generic items: the lead photo of the matching English Wikipedia article,
  accepted only when Wikimedia Commons marks it as freely licensed.
- Packaged goods: front-of-pack photos from Open Food Facts, Open Beauty Facts or Open Products
  Facts (CC BY-SA).

The lookup runs in GitHub Actions (workflow "Catalog photos") whenever product files change on
`main`, or from the Actions tab on demand. It commits `images.json` and the regenerated seed.
Products with no match show a placeholder.

### Broader automatic matches

The "Catalog auto photos" workflow handles products the strict lookup missed: a full-text search
of Open Food / Beauty / Products Facts (brand plus at least half the distinctive words of the name
must match), else a freely licensed Wikimedia Commons photo of the item itself, credited as
"Representative photo". Results go to `auto-photos.json` (used after hand-picked photos and the
strict lookup). Contact sheets of every match are published to the `photo-review` branch; add wrong
ones to `photo-rejects.json` (`{"<product slug>": ["<photo url>"]}`) and the workflow tries the
next candidate.

### Photos from links (photo-links.csv)

`photo-links.csv` lists every product still without a photo. Find the product on
[Open Food Facts](https://world.openfoodfacts.org) (or Open Beauty / Products Facts, or Wikimedia
Commons), copy the page address (or right-click the photo you want and "Copy image address") and
paste it in that product's `photo_link` column. A bare barcode works too. Save as CSV UTF-8.

When the file changes on `main`, the "Catalog photos" workflow checks each link (Commons files must
be freely licensed), records the photo and its credit in `image-overrides.json`, and commits the
regenerated seed. Links it cannot use are listed in the workflow log. Clearing a link removes
that photo again. To refresh the list locally: `node scripts/photos/import-links.mjs --template`.

### Choosing photos by hand (photo picker)

Run on your own computer (it needs normal internet access):

```bash
npm run photos:pick                                   # every product without a photo
npm run photos:pick -- --category vegetables-fruits --all      # review a shelf, photos included
npm run photos:pick -- --audit "C:\path\PRODUCE_107_VISUAL_AUDIT.csv"   # add files from a photo audit
```

It opens http://localhost:4321 with up to four openly licensed candidates per product from
Wikimedia Commons and Open Food / Beauty / Products Facts, each with its licence and credit.
**Use this** chooses a photo (saved at once to `photo-picker/choices.json`), **Save** downloads
it, and a pasted Commons file link or Open Facts product link adds your own find; its licence is
checked first. Audit rows marked REPLACE, and files Commons does not mark as freely licensed, are
left out. Stop with Ctrl+C, then:

```bash
npm run photos:apply      # merges your choices into image-overrides.json and rebuilds the seed
```

`photo-picker/` is your local workspace and is not committed. For launch, replace these with your own photos or the
pack shots brands and distributors supply, using the admin CSV import (`image_url`, `image_credit`).

## Production catalog

The sample prices are for the test stack only. Load real products, prices and stock with
**Admin > Products > Import CSV**: download the template and the subcategory list there, fill it
in Excel, save as CSV UTF-8 and upload. Re-importing a slug updates that product.

## Held back at launch

- Hidden: "Smoking Cessation" (regulatory check) and "Beauty E-Card" (needs a voucher flow).
- Listed as "Coming soon", orders refused: fresh chicken, meat and fish, until the FSSAI licence
  and cold chain are confirmed. To open them, re-import those products with `orderable` set to yes.
