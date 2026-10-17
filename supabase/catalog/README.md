# Catalog

The store's departments, categories, subcategories and sample products, built from
`Grocery_Details_Expanded_Product_Listings.docx`.

| File | What it is |
|---|---|
| `assortment.json` | The document as data: 4 departments, 23 categories, 226 subcategories, 652 product families with their brands. Names follow the document, with obvious typos fixed. |
| `products/<category>.json` | 1,245 sample products: original descriptions, realistic pack sizes, **sample** prices, GST rate, search tags and a photo lookup key. |
| `pinned.json` | Toor Dal, Toned Milk and Brown Bread with fixed prices; the automated tests rely on them. |
| `images.json` | Licensed photos and their credits, written by the "Catalog photos" GitHub Actions workflow. |
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
Products with no match show a placeholder. For launch, replace these with your own photos or the
pack shots brands and distributors supply, using the admin CSV import (`image_url`, `image_credit`).

## Production catalog

The sample prices are for the test stack only. Load real products, prices and stock with
**Admin > Products > Import CSV**: download the template and the subcategory list there, fill it
in Excel, save as CSV UTF-8 and upload. Re-importing a slug updates that product.

## Held back at launch

- Hidden: "Smoking Cessation" (regulatory check) and "Beauty E-Card" (needs a voucher flow).
- Listed as "Coming soon", orders refused: fresh chicken, meat and fish, until the FSSAI licence
  and cold chain are confirmed. To open them, re-import those products with `orderable` set to yes.
