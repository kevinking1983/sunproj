#!/usr/bin/env python3
"""
Contact sheets of every linked photo still awaiting visual audit (from image-tracker.csv), for the
visual check the image policy requires. Each sheet holds 20 numbered photos with the product,
brand, pack size and photo title; index.json maps sheet and number to the listing. Wrong photos go
into photo-rejects.json, approved ones into visual-audit.json.

    python3 scripts/catalog/contact-sheets.py <out_dir>        (needs Pillow)
"""
import csv
import json
import sys
import urllib.request
from io import BytesIO
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[2]
CAT = ROOT / "supabase" / "catalog"
OUT = Path(sys.argv[1])
UA = "RATION-catalog/1.0 (https://github.com/kevinking1983/sunproj; contact sheets)"
COLS, ROWS, CELL, LABEL = 5, 4, 260, 70


def font(size):
    for f in ("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", "DejaVuSans.ttf"):
        try:
            return ImageFont.truetype(f, size)
        except OSError:
            pass
    return ImageFont.load_default()


def fit(draw, text, f, width):
    """Text cut to fit the cell width, with an ellipsis."""
    if draw.textlength(text, font=f) <= width:
        return text
    while text and draw.textlength(text + "…", font=f) > width:
        text = text[:-1]
    return text + "…"


def tracker_rows():
    with open(CAT / "image-tracker.csv", encoding="utf-8-sig", newline="") as f:
        return [r for r in csv.DictReader(f) if r["Image Collection Status"] == "LINKED" and r["Visual Audit Status"] == "VISUAL_AUDIT_PENDING"]


items = tracker_rows()
OUT.mkdir(parents=True, exist_ok=True)
small, tiny = font(15), font(12)
index = []
per = COLS * ROWS
for s in range(0, len(items), per):
    sheet_no = s // per + 1
    chunk = items[s : s + per]
    rows = -(-len(chunk) // COLS)
    sheet = Image.new("RGB", (COLS * CELL, rows * (CELL + LABEL)), "white")
    draw = ImageDraw.Draw(sheet)
    for i, r in enumerate(chunk):
        x, y = (i % COLS) * CELL, (i // COLS) * (CELL + LABEL)
        try:
            req = urllib.request.Request(r["Direct Image URL"], headers={"User-Agent": UA})
            raw = Image.open(BytesIO(urllib.request.urlopen(req, timeout=30).read()))
            # Transparent PNGs go on white, as on the site; a plain convert would turn them black.
            img = Image.new("RGB", raw.size, "white")
            img.paste(raw.convert("RGBA"), mask=raw.convert("RGBA").split()[3])
            img.thumbnail((CELL - 10, CELL - 10))
            sheet.paste(img, (x + (CELL - img.width) // 2, y + (CELL - img.height) // 2))
        except Exception as e:  # a broken photo is worth rejecting too
            draw.text((x + 10, y + CELL // 2), f"failed: {e}"[:40], fill="red", font=tiny)
        n = i + 1
        tag = {"Pack shot": "P", "Representative": "R", "Variety representative": "V"}.get(r["Image Kind"], "?")
        brand = r["Brand"] if r["Brand Classification"] == "Branded" else ""
        name = r["Product / Variant"] if brand.lower() in r["Product / Variant"].lower() else f"{brand} {r['Product / Variant']}".strip()
        w = CELL - 12
        draw.rectangle([x, y, x + CELL - 1, y + CELL + LABEL - 1], outline="#bbbbbb")
        draw.text((x + 6, y + CELL + 2), fit(draw, f"{n}. [{tag}] {name}", small, w), fill="black", font=small)
        draw.text((x + 6, y + CELL + 22), fit(draw, f"{r['Pack Size']} | {r['Source Website']}", tiny, w), fill="#555555", font=tiny)
        draw.text((x + 6, y + CELL + 40), fit(draw, r["Listing ID"], tiny, w), fill="#888888", font=tiny)
        index.append({"sheet": sheet_no, "n": n, "slug": r["Listing ID"], "name": r["Product / Variant"], "brand": brand, "kind": r["Image Kind"], "url": r["Direct Image URL"]})
    sheet.save(OUT / f"sheet-{sheet_no:03d}.jpg", quality=80)
(OUT / "index.json").write_text(json.dumps(index, indent=1))
print(f"{len(items)} photos on {-(-len(items) // per)} sheets in {OUT}")
