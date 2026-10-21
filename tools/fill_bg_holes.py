#!/usr/bin/env python3
"""Make the free-roam bg plates fully opaque without changing composition.

For every non-opaque pixel above the walkable line (y < WALK), build an opaque
base colour from the same column: linear blend of the nearest fully-opaque pixel
above and below (keeps sky gradients smooth under semi-transparent glows); if the
pixel below is on the walkable sidewalk, or there is none, use the pixel above
only (extends the building base / sky down to the sidewalk). The original pixel
is then alpha-composited over that base. Pixels at y >= WALK are never touched.
Originals are backed up as <name>_v1.png (once).
usage: fill_bg_holes.py  (operates on assets/bg/{diner,downtown,railyard,millmountain}.png)
"""
import os, shutil
import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BG = os.path.join(ROOT, "assets", "bg")
PLATES = {"diner": 380, "downtown": 380, "railyard": 380, "millmountain": 400}

def fill(path, walk):
    a = np.array(Image.open(path).convert("RGBA")).astype(np.float64)
    H, W, _ = a.shape
    alpha = a[:, :, 3]
    out = a.copy()
    changed = np.zeros((H, W), bool)
    for x in range(W):
        col = alpha[:, x]
        bad = np.where(col[:walk] < 255)[0]
        if not len(bad):
            continue
        opaque = np.where(col == 255)[0]
        for y in bad:
            up = opaque[opaque < y]; dn = opaque[opaque > y]
            ya = up[-1] if len(up) else None
            yb = dn[0] if len(dn) else None
            if ya is not None and (yb is None or yb >= walk):
                base = a[ya, x, :3]
            elif ya is None and yb is not None:
                base = a[yb, x, :3]
            elif ya is not None:
                t = (y - ya) / float(yb - ya)
                base = a[ya, x, :3] * (1 - t) + a[yb, x, :3] * t
            else:
                base = np.array([0.0, 0.0, 0.0])
            k = col[y] / 255.0
            out[y, x, :3] = a[y, x, :3] * k + base * (1 - k)
            out[y, x, 3] = 255
            changed[y, x] = True
    return np.clip(out + 0.5, 0, 255).astype(np.uint8), changed

if __name__ == "__main__":
    for name, walk in PLATES.items():
        p = os.path.join(BG, name + ".png")
        bak = os.path.join(BG, name + "_v1.png")
        if not os.path.exists(bak):
            shutil.copy2(p, bak)
        src = bak                                   # always rebuild from the original
        img, changed = fill(src, walk)
        Image.fromarray(img, "RGBA").save(p)
        ys, xs = np.where(changed)
        full0 = (np.array(Image.open(src))[:, :, 3] == 0) & changed
        fy, fx = np.where(full0)
        print(f"{name}: changed {changed.sum()} px, bbox x{xs.min()}-{xs.max()} y{ys.min()}-{ys.max()}; "
              f"fully-transparent holes {full0.sum()} px" + (f" bbox x{fx.min()}-{fx.max()} y{fy.min()}-{fy.max()}" if len(fy) else ""))
