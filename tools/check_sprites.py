#!/usr/bin/env python3
"""Verify sprite layout contracts + build preview contact sheets in /workspace/tmp_sprite."""
import os, sys
from PIL import Image
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SPR = os.path.join(ROOT, "assets", "sprites")
TMP = sys.argv[1] if len(sys.argv) > 1 else "/workspace/tmp_sprite"
os.makedirs(TMP, exist_ok=True)
OUTFITS = ["polo", "photo", "hoodie", "jacket", "street", "varsity", "mechanic", "diner", "gold", "webslinger", "beacon", "ironclad", "silas"]
NPCS = ["dee", "priya", "hank", "june", "tessa", "coach", "cam", "silas"]
THUGS = ["thug_purple", "thug_red", "thug_teal", "thug_orange", "thug_grey"]
def sheet_path(o): return os.path.join(SPR, "matthew_sheet.png" if o == "polo" else f"matthew_{o}.png")

fails = 0
def check(path, size, frames=1, feet=189, corners_ok=True):
    global fails
    im = Image.open(path)
    # 1.8.0 HD: a sheet may be authored at 2x (same layout, soft alpha); check it in its own pixels
    k = 2 if im.size == (size[0] * 2, size[1] * 2) else 1
    ok = im.size == (size[0] * k, size[1] * k) and im.mode == "RGBA"
    w = size[0] * k // frames; H = size[1] * k
    notes = []
    for i in range(frames):
        f = im.crop((i*w, 0, i*w + w, H))
        a = f.getchannel("A")
        corners = [a.getpixel(p) for p in ((0, 0), (w-1, 0), (0, H-1), (w-1, H-1))]
        bb = (a.point(lambda v: 255 if v >= 128 else 0) if k > 1 else a).getbbox()  # HD: >=50% silhouette
        # HD portraits (feet=None) are painted full-bleed; #portrait clips them to a circle (border-radius 50%)
        if any(corners) and corners_ok and not (k > 1 and feet is None): ok = False; notes.append(f"f{i} corner alpha")
        if feet is not None and (bb is None or not (feet * k <= bb[3] - 1 <= feet * k + 2 * (k - 1))): ok = False; notes.append(f"f{i} feet row {bb and bb[3]-1}")
        if bb and (bb[0] == 0 or bb[1] == 0 or bb[2] == w): notes.append(f"f{i} touches edge {bb}")
    print(("OK  " if ok else "FAIL"), os.path.relpath(path, ROOT), im.size, im.mode, frames, "frames", "; ".join(notes))
    fails += (not ok)

for o in OUTFITS: check(sheet_path(o), (1152, 192), 8)
for n in NPCS: check(os.path.join(SPR, n + ".png"), (144, 192), 1)
for n in NPCS:
    if n != "silas": check(os.path.join(SPR, n + "_sheet.png"), (1152, 192), 8)
check(os.path.join(SPR, "silas_sheet.png"), (1152, 192), 8)
for t in THUGS:
    check(os.path.join(SPR, t + ".png"), (144, 192), 1)
    check(os.path.join(SPR, t + "_sheet.png"), (1152, 192), 8)
check(os.path.join(SPR, "portrait_matthew.png"), (112, 112), 1, feet=None)
check(os.path.join(SPR, "npcs.png"), (664, 768), 1, feet=None, corners_ok=False)   # opaque label gutter by design

GREY = (210, 210, 210, 255)
def contact(paths_labels, out, idx=0, scale=3, cols=None):
    from PIL import ImageDraw
    cols = cols or len(paths_labels)
    rows = (len(paths_labels) + cols - 1) // cols
    cw, ch = 144*scale, 192*scale + 18
    sh = Image.new("RGBA", (cw*cols, ch*rows), GREY)
    d = ImageDraw.Draw(sh)
    for k, (p, lab, fi) in enumerate(paths_labels):
        im = Image.open(p); n = im.width // 144
        f = im.crop((fi*144, 0, fi*144 + 144, 192)).resize((144*scale, 192*scale), Image.NEAREST)
        x, y = (k % cols)*cw, (k // cols)*ch
        sh.alpha_composite(f, (x, y + 18)); d.text((x + 6, y + 3), lab, fill=(20, 20, 20, 255))
    sh.save(out); print("wrote", out, sh.size)

contact([(sheet_path(o), f"{o} ({os.path.basename(sheet_path(o))}) idle", 0) for o in OUTFITS], os.path.join(TMP, "outfits_contact_v2.png"))
cast = [(os.path.join(SPR, n + ".png"), n + ".png", 0) for n in NPCS]
cast += [(os.path.join(SPR, "silas_sheet.png"), f"silas_sheet f{i}", i) for i in (0, 5, 6, 7)]
cast += [(os.path.join(SPR, t + "_sheet.png"), f"{t}_sheet f{i}", i) for t in THUGS for i in (0, 5)]
contact(cast, os.path.join(TMP, "cast_contact.png"), scale=2, cols=8)
at = Image.open(os.path.join(SPR, "npcs.png")); bg = Image.new("RGBA", at.size, GREY); bg.alpha_composite(at)
bg.save(os.path.join(TMP, "npcs_atlas_preview.png"))
p = Image.open(os.path.join(SPR, "portrait_matthew.png")); bg = Image.new("RGBA", p.size, GREY); bg.alpha_composite(p)
bg.resize((448, 448), Image.NEAREST).save(os.path.join(TMP, "portrait_front_zoom.png"))
# ---- extended animation strips (anims.json + optional anims_enemies.json)
import json
def check_anims(man_path):
    global fails
    if not os.path.exists(man_path): print("skip (absent)", os.path.relpath(man_path, ROOT)); return
    man = json.load(open(man_path)); nfr = 0; bad = 0
    for key, ch in man["characters"].items():
        for state, st in ch["states"].items():
            if "frames" not in st: continue  # aliasOf states reuse another state's frames
            # 1.8.0 HD: `file` may be a per-frame list (normal + _wide strips), with artScale 2, per-frame sy/sh /
            # anchorX, feetRow and soft alpha; read the way js/sprites.js getAnimFrame() does.
            files = st.get("file") or ch["file"]; files = files if isinstance(files, list) else [files] * len(st["frames"])
            ims = {}
            for f_ in set(files):
                path = os.path.join(ROOT, f_)
                if not os.path.exists(path): print("FAIL missing", path); fails += 1; continue
                ims[f_] = Image.open(path)
            if len(ims) != len(set(files)): continue
            s = st.get("artScale") or ch.get("artScale") or man.get("artScale") or 1  # inherited like js/sprites.js artScaleOf()
            fw, fh = st.get("fw", 144 * s), st.get("fh", 192 * s)
            pk = lambda v, i, d=None: (v[i] if i < len(v) and v[i] is not None else d) if isinstance(v, list) else (v if v is not None else d)
            if any(im.mode != "RGBA" for im in ims.values()): print("FAIL strip mode", key, state); fails += 1; continue
            n = len(st["frames"])
            for arr in ("grounded", "lying", "active", "hitbox"):
                if arr in st and len(st[arr]) != n: print("FAIL", key, state, arr, "length"); fails += 1
            for i, f in enumerate(st["frames"]):
                nfr += 1
                im = ims[files[i]]
                sx = pk(st.get("sx"), i, f * fw); sw = pk(st.get("sw"), i, fw); sy = pk(st.get("sy"), i, 0); sh = pk(st.get("sh"), i, fh)
                feet = pk(st.get("feetRow"), i, sh - 3 * s)
                if sx + sw > im.width or sy + sh > im.height: print("FAIL", key, state, "frame", f, "out of strip"); fails += 1; continue
                fr = im.crop((sx, sy, sx + sw, sy + sh)); a = fr.getchannel("A"); W_, H_ = fr.size
                bb = (a.point(lambda v: 255 if v >= 128 else 0) if s > 1 else a).getbbox(); notes = []  # HD: >=50% silhouette
                if not bb: notes.append("empty")
                else:
                    if bb[0] == 0 or bb[1] == 0 or bb[2] == W_: notes.append(f"touches edge {bb}")   # would mean clipping
                    grounded = st.get("grounded", [True] * n)[i]
                    if grounded and abs(bb[3] - 1 - feet) > s - 1: notes.append(f"feet {bb[3]-1}")  # 2x: half a logical px of slack either way
                    if not grounded and bb[3] - 1 > feet: notes.append(f"below {bb[3]-1}")
                if notes: print("FAIL", key, state, i, notes); fails += 1; bad += 1
    print(("OK  " if not bad else "FAIL"), os.path.relpath(man_path, ROOT), len(man["characters"]), "chars", nfr, "frames")
check_anims(os.path.join(SPR, "anims.json"))
check_anims(os.path.join(SPR, "anims_enemies.json"))
for p_ in ["wren.png"]: check(os.path.join(SPR, p_), (144, 192))
check(os.path.join(SPR, "wren_sheet.png"), (1152, 192), 8)
for n in ["lou", "gus", "ivy", "pip"]:          # 1.5.2 prequel NPCs (gen_cast.py --prequel)
    check(os.path.join(SPR, n + ".png"), (144, 192))
    check(os.path.join(SPR, n + "_sheet.png"), (1152, 192), 8)
check(os.path.join(SPR, "portrait_matthew_ironclad.png"), (112, 112), feet=None)
check(os.path.join(SPR, "portrait_matthew_silas.png"), (112, 112), feet=None)

# ---- collectibles atlas (tools/gen_collectibles.py)
def check_collectibles():
    global fails
    mp = os.path.join(SPR, "collectibles.json"); ip = os.path.join(SPR, "collectibles.png")
    if not (os.path.exists(mp) and os.path.exists(ip)): print("FAIL collectibles missing"); fails += 1; return
    man = {k: v for k, v in json.load(open(mp)).items() if not k.startswith("_")}
    im = Image.open(ip); bad = 0
    K = json.load(open(mp)).get("_meta", {}).get("artScale", 1); C = 48 * K  # 1.8.0 HD: 96-px cells, soft alpha
    if im.mode != "RGBA" or im.size != (C * 6, C * len(man)): print("FAIL collectibles.png size/mode", im.size, im.mode); fails += 1; return
    hist = im.getchannel("A").histogram(); alphas = {v for v in range(256) if hist[v]}
    if K == 1 and not alphas <= {0, 255}: print("FAIL collectibles.png alpha not hard", sorted(alphas)[:6]); fails += 1
    for iid, it in man.items():
        if (it["frames"], it["fw"], it["fh"], it["fps"]) != (6, C, C, 8): print("FAIL", iid, "meta", it["fw"], it["fh"]); bad += 1
        for f in range(6):
            fr = im.crop((f * C, it["row"] * C, f * C + C, it["row"] * C + C)); a_ = fr.getchannel("A")
            bb = (a_.point(lambda v: 255 if v >= 128 else 0) if K > 1 else a_).getbbox()
            if not bb: print("FAIL", iid, f, "empty"); bad += 1; continue
            w, h = bb[2] - bb[0], bb[3] - bb[1]
            if max(w, h) < 30 * K or max(w, h) > 46 * K: print("FAIL", iid, f, "item size", w, h); bad += 1
            if any(a_.getpixel(c) for c in [(0, 0), (C - 1, 0), (0, C - 1), (C - 1, C - 1)]): print("FAIL", iid, f, "corner"); bad += 1
    # every id the game defines (js/missions.js) must exist
    import re
    src = open(os.path.join(ROOT, "js", "missions.js")).read()
    blk = src[src.index("const collectibles = ["):]; blk = blk[:blk.index("];")]
    ids = re.findall(r"\bid: '([^']+)'", blk)
    norm = lambda v: re.sub(r"[^a-z0-9]", "", re.sub(r"\([^)]*\)", "", v.lower()))
    known = {norm(k) for k in man} | {norm(n) for it in man.values() for n in it.get("names", [])}
    miss = [i for i in ids if i not in man and norm(i) not in known]      # aliases (e.g. ironcrate -> ironclad row) count
    if miss: print("FAIL collectible ids missing art:", miss); bad += 1
    fails += bad
    print(("OK  " if not bad else "FAIL"), "assets/sprites/collectibles.png", len(man), "items x 6 frames; game ids", len(ids))
check_collectibles()

print("FAILS:", fails)
