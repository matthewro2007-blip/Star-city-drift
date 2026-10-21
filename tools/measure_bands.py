#!/usr/bin/env python3
"""Measure the painted walkable ground band (sidewalk + street) in assets/bg plates.

Coordinate space: plate pixel rows. world.js drawBackground() draws every plate
with scale = H / img.height = 540/540 = 1 and y offset 0 (only x pans/tiles), and
the game canvas is 960x540, so plate y == screen y == the y space DEPTH uses.

Method (per plate):
  * Scan rows upward from the bottom. A row counts as "ground" while it is fully
    opaque and the same flat colour dominates (>= 50%) at least 3 of the 4
    width-quarters (flat painted pavement; props/lines/one parked car tolerated).
  * The first row that fails is the building/wall base line; walkable top = +1.
  * Also lists the colour bands inside the ground (curb strip, sidewalk, street).
Usage: python3 tools/measure_bands.py [--json]
"""
import glob, json, os, sys
from collections import Counter
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def row_ok(px, w, y):
    """Ground row: fully opaque, and >= 3 of 4 width-quarters share the same
    dominant colour covering >= 50% of that quarter (a car/bench in one quarter
    is tolerated; building rows differ colour-wise from quarter to quarter)."""
    quarters, modes = 4, []
    for q in range(quarters):
        x0, x1 = q * w // quarters, (q + 1) * w // quarters
        cols = [px[x, y] for x in range(x0, x1)]
        if any(c[3] < 255 for c in cols):
            return False
        c, n = Counter(c[:3] for c in cols).most_common(1)[0]
        if n >= 0.5 * (x1 - x0):
            modes.append(c)
    return bool(modes) and Counter(modes).most_common(1)[0][1] >= quarters - 1


def bands(px, w, top, h):
    out, cur, start = [], None, top
    for y in range(top, h):
        mode = Counter(px[x, y][:3] for x in range(0, w, 2)).most_common(1)[0][0]
        if cur is None:
            cur = mode
        elif sum(abs(a - b) for a, b in zip(mode, cur)) > 12:
            out.append((start, y - 1, cur))
            cur, start = mode, y
    out.append((start, h - 1, cur))
    return out


def measure(path):
    im = Image.open(path).convert('RGBA')
    w, h = im.size
    px = im.load()
    y = h - 1
    while y >= 0 and row_ok(px, w, y):
        y -= 1
    top = y + 1
    return {'plate': os.path.splitext(os.path.basename(path))[0], 'size': [w, h],
            'walk_top': top, 'walk_bottom': h - 1,
            'bands': [[a, b, list(c)] for a, b, c in bands(px, w, top, h)]}


if __name__ == '__main__':
    res = [measure(p) for p in sorted(glob.glob(os.path.join(ROOT, 'assets/bg/*.png')))]
    if '--json' in sys.argv:
        print(json.dumps(res, indent=1))
    else:
        for r in res:
            print(f"{r['plate']:16s} {r['size'][0]}x{r['size'][1]}  top={r['walk_top']} bottom={r['walk_bottom']}")
            for a, b, c in r['bands']:
                print(f"    y {a:3d}-{b:3d}  rgb{tuple(c)}")
