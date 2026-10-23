#!/usr/bin/env python3
"""
Contact sheets of the automatic photo matches (auto-photos.json), for a quick visual check.
Each sheet holds 20 numbered photos with the product name; index.json maps sheet and number to
the product slug. Wrong matches go into photo-rejects.json.

    python3 scripts/catalog/contact-sheets.py <out_dir>        (needs Pillow)
"""
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


def products():
    """Products in catalog order: pinned first, then each category file in assortment order."""
    assortment = json.loads((CAT / "assortment.json").read_text())
    order = [c["slug"] for d in assortment["departments"] for c in d["categories"]]
    files = sorted((CAT / "products").glob("*.json"), key=lambda f: order.index(f.stem) if f.stem in order else 999)
    out = json.loads((CAT / "pinned.json").read_text())
    for f in files:
        out += json.loads(f.read_text())
    return out


def fit(draw, text, f, width):
    """Text cut to fit the cell width, with an ellipsis."""
    if draw.textlength(text, font=f) <= width:
        return text
    while text and draw.textlength(text + "…", font=f) > width:
        text = text[:-1]
    return text + "…"


auto = json.loads((CAT / "auto-photos.json").read_text())
items = [(p, auto[p["slug"]]) for p in products() if auto.get(p["slug"], {}).get("url")]
seen = set()
items = [(p, a) for p, a in items if not (p["slug"] in seen or seen.add(p["slug"]))]
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
    for i, (p, a) in enumerate(chunk):
        x, y = (i % COLS) * CELL, (i // COLS) * (CELL + LABEL)
        try:
            req = urllib.request.Request(a["url"], headers={"User-Agent": UA})
            img = Image.open(BytesIO(urllib.request.urlopen(req, timeout=30).read())).convert("RGB")
            img.thumbnail((CELL - 10, CELL - 10))
            sheet.paste(img, (x + (CELL - img.width) // 2, y + (CELL - img.height) // 2))
        except Exception as e:  # a broken photo is worth rejecting too
            draw.text((x + 10, y + CELL // 2), f"failed: {e}"[:40], fill="red", font=tiny)
        n = i + 1
        tag = "R" if a.get("match") == "representative" else "P"
        draw.rectangle([x, y, x + CELL - 1, y + CELL + LABEL - 1], outline="#bbbbbb")
        brand = p.get("brand") or ""
        name = p["name"] if brand.lower() in p["name"].lower() else f"{brand} {p['name']}".strip()
        w = CELL - 12
        draw.text((x + 6, y + CELL + 2), fit(draw, f"{n}. [{tag}] {name}", small, w), fill="black", font=small)
        draw.text((x + 6, y + CELL + 22), fit(draw, f"{p['unit_label']} | {a.get('title', '')}", tiny, w), fill="#555555", font=tiny)
        draw.text((x + 6, y + CELL + 40), fit(draw, p["slug"], tiny, w), fill="#888888", font=tiny)
        index.append({"sheet": sheet_no, "n": n, "slug": p["slug"], "name": p["name"], "match": a.get("match"), "url": a["url"]})
    sheet.save(OUT / f"sheet-{sheet_no:03d}.jpg", quality=80)
(OUT / "index.json").write_text(json.dumps(index, indent=1))
print(f"{len(items)} photos on {-(-len(items) // per)} sheets in {OUT}")
