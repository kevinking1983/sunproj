# Writing catalog product files (brief for catalog agents)

You turn product families from `supabase/catalog/assortment.json` into sellable sample products for the
RATION grocery app (an India-only quick-commerce store). Output is JSON consumed by a seed generator.

## Input
`supabase/catalog/assortment.json`: departments -> categories -> subcategories -> families.
Each family has `name`, `varieties` (forms), `brands` (real brand names, most popular first),
`brand_notes` (generic phrases, not brands), `unbranded` (loose/wholesale option text or null).
Subcategories with `is_all: true` are overviews: create NO products for them.

## Output
One file per category you own: `supabase/catalog/products/<category-slug>.json`, a JSON array of:

```json
{
  "slug": "aashirvaad-whole-wheat-atta-5kg",
  "name": "Aashirvaad Whole Wheat Atta",
  "brand": "Aashirvaad",
  "subcategories": ["atta-rice-dal-atta"],
  "unit_label": "5 kg",
  "mrp": 29500,
  "price": 27900,
  "tax_rate": 5,
  "is_veg": true,
  "description": "Whole wheat flour for soft everyday rotis and parathas. Pack it in an airtight container once opened.",
  "tags": ["atta", "wheat flour", "gehu atta", "chapati flour"],
  "image": {"off": {"brand": "aashirvaad", "query": "whole wheat atta"}},
  "orderable": true
}
```

## Rules
1. Products per family
   - Family with real `brands`: one product for each of the FIRST TWO brands (or one if only one).
     Name it "<Brand> <family product in Title Case>", e.g. "Pillsbury Whole Wheat Atta". Do not invent
     sub-brands, flavours or claims you are not sure exist; keep to the generic product name.
   - Family with no brands: one product per variety, at most 3, with natural names
     ("Baby Potato", "Kashmiri Apple", "Granny Smith Apple"). When a variety is plain ("regular",
     "local", "desi"), use the family name alone ("Potato", "Tomato").
   - "Other ..." or group families ("Other vegetables — drumstick, raw banana, ...") list distinct items:
     make up to 3 products named by the item ("Drumstick", "Raw Banana").
   - Families about services, vouchers or regulated medicines/nicotine: create nothing.
2. `slug`: kebab-case of name plus pack size, unique across the whole catalog ("amul-butter-100g").
   NEVER use these reserved names/slugs (they are added separately): "Toor Dal" (toor-dal),
   "Toned Milk" (toned-milk), "Brown Bread" (brown-bread).
3. `subcategories`: subcategory slugs from assortment.json; the first is the primary. Add the twin
   slugs listed below when a family appears in twin subcategories.
4. `unit_label`: realistic Indian retail pack ("500 g", "1 kg", "1 L", "200 ml", "6 pcs", "1 bunch",
   "Pack of 3", "1 pc"). Produce: "1 kg", "500 g", "250 g", "1 pc", "1 bunch" as natural.
5. `mrp` and `price`: integer PAISE (₹1 = 100). These are SAMPLE prices for a test store: make them
   plausible for the pack in India in 2026, rounded (…00 or …900). price <= mrp, discount 0-15%
   (produce may be 15-30% below mrp). Never exact copies of any retailer's listed price.
6. `tax_rate` (GST %): fresh produce, fresh meat/eggs, loose cereals, fresh milk 0; packaged staples,
   tea, edible oil, ghee 5 or 12; most packaged foods 12 or 18; beauty, household, stationery 18;
   aerated drinks 28. Use your best judgement.
7. `is_veg`: true for vegetarian food, false for meat/fish/egg items, null for non-food.
8. `description`: ORIGINAL, 1-2 sentences, 60-300 characters, factual and useful (what it is, typical
   use, storage tip). No health/medical claims, no "best/No.1", no copied marketing text, do not
   state specs you are unsure of.
9. `tags`: 2-6 lowercase search synonyms, including common Hindi/Indian names (chawal, dahi, jeera).
10. `image`: lookup key for openly licensed photos, resolved later by a CI job:
    - Unbranded or generic items: {"wiki": "<English Wikipedia article title>"} that best shows it
      ("Potato", "Okra", "Basmati", "Pressure cooking", "Notebook"). Use the plain article name.
    - Branded packaged goods: {"off": {"brand": "<brand lowercase>", "query": "<2-4 keywords>"}}
      (Open Food Facts search). For branded NON-food (shampoo, detergent, notebooks) use
      {"off": ...} as well; the resolver falls back to a placeholder when nothing matches.
    - null if no sensible image exists.
11. `orderable`: false for everything in the "chicken-meat-fish" category (sold after licence and
    cold-chain checks); true otherwise.
12. Skip entirely: subcategories "Smoking Cessation" and "Beauty E-Card" (create no products).

## Twin subcategories (same shelf shown in two places)
Create the product ONCE, in the owner's file, with both slugs in `subcategories`:
- eggs: owner dairy-bread-eggs -> ["dairy-bread-eggs-eggs", "chicken-meat-fish-eggs"]; chicken-meat-fish skips its Eggs.
- non-veg spices: owner oil-ghee-masala -> ["oil-ghee-masala-non-veg-spices", "chicken-meat-fish-non-veg-spices"]; chicken-meat-fish skips.
- soy milk & more: owner dairy-bread-eggs -> ["dairy-bread-eggs-soy-milk-more", "drinks-juices-soy-milk-more"]; drinks-juices skips.
- frozen non-veg snacks: owner chicken-meat-fish -> ["chicken-meat-fish-frozen-non-veg-snacks", "instant-food-frozen-non-veg-snacks"]; instant-food skips. These frozen packaged snacks ARE orderable (true).
- energy bars: owner sweets-chocolates, also "instant-food-energy-bars".
- syrups: owner sweets-chocolates, also "sauces-spreads-syrups" and "ice-creams-more-syrups".
- cold coffee & iced tea: owner drinks-juices, also "tea-coffee-milk-drinks-cold-coffee-iced-tea".
- shampoo / conditioner: owner hair, also "bath-body-shampoo" / "bath-body-conditioner".
- face cleaning / body lotions & oils: owner skin-face, also "bath-body-face-cleaning" / "bath-body-body-lotions-oils".
- bath & beauty gifts: owner bath-body, also "beauty-cosmetics-bath-beauty-gifts".

## Checking your work
Run `node scripts/catalog/validate-products.mjs supabase/catalog/products/<your files>` until it prints OK.
Write files with your file-writing tool, not shell heredocs (avoid quoting accidents).
Do not edit any other file in the repository. Do not run git commands.
