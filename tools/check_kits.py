"""Outfit-kit contract check (read-only): every matthew_<outfit> in assets/sprites/anims.json must take idle_signature /
combo3 / special from its *_kit strips (special wide 240, anchorX 120), with the same frame rules as check_sprites.py
check_anims() plus hitbox-inside-cell and active->hitbox; and weapons.png/json must match gen_weapon_icons.py.
usage: check_kits.py [ROOT]   (ROOT defaults to the repo; a --out test dir from gen_kits.py also works)"""
import json, os, copy
from PIL import Image
import sys
LIVE = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); HERE = sys.argv[1] if len(sys.argv) > 1 else LIVE
OUT = ["polo", "photo", "hoodie", "jacket", "street", "varsity", "mechanic", "diner", "gold", "webslinger", "beacon", "ironclad", "silas"]
WEAPONS = OUT + ["darkstar", "cinder"]  # HUD icons also cover the 1.6.0 Dark Star Suit + 1.7.0 Cinder Hollow Orange (no kit strips)
# 1.8.0 HD art: states may carry artScale (2), per-frame file / anchorX lists, feetRow and soft alpha. Frame rules are
# checked in source pixels at that scale, the way js/sprites.js getAnimFrame() reads them (feetRow = sh - 3*s by default).
def pick(v, i, d=None):
    return (v[i] if i < len(v) and v[i] is not None else d) if isinstance(v, list) else (v if v is not None else d)
def art_scale(st):
    return st.get("artScale") or 1
def solid_bbox(im_a, s):
    """1x art: any alpha. HD (soft alpha, smoothed): the >= 50% coverage silhouette, so AA fringes don't count."""
    return (im_a.point(lambda v: 255 if v >= 128 else 0) if s > 1 else im_a).getbbox()
fails = 0
def resolve(rel):
    p = os.path.join(HERE, rel)
    return p if os.path.exists(p) else os.path.join(LIVE, rel)
def check_anims(man, label):
    global fails
    nfr = bad = 0
    for key, ch in man["characters"].items():
        for state, st in ch["states"].items():
            files = st.get("file") or ch["file"]; files = files if isinstance(files, list) else [files] * len(st["frames"])
            ims = {}
            for f_ in set(files):
                path = resolve(f_)
                if not os.path.exists(path): print("FAIL missing", path); fails += 1; continue
                ims[f_] = Image.open(path)
            if len(ims) != len(set(files)): continue
            s = st.get("artScale") or ch.get("artScale") or man.get("artScale") or 1; fw, fh = st.get("fw", 144 * s), st.get("fh", 192 * s)
            if any(im.mode != "RGBA" for im in ims.values()): print("FAIL strip mode", key, state); fails += 1; continue
            n = len(st["frames"])
            for arr in ("grounded", "lying", "active", "hitbox", "sx", "sw", "sy", "sh"):
                if arr in st and len(st[arr]) != n: print("FAIL", key, state, arr, "length"); fails += 1
            for i, f in enumerate(st["frames"]):
                nfr += 1
                im = ims[files[i]]
                sx = st["sx"][i]; sw = st["sw"][i]; sy = st["sy"][i]; sh = st["sh"][i]; feet = pick(st.get("feetRow"), i, sh - 3 * s)
                if sx + sw > im.width or sy + sh > im.height: print("FAIL", key, state, f, "out of strip"); fails += 1; continue
                a = im.crop((sx, sy, sx + sw, sy + sh)).getchannel("A"); bb = solid_bbox(a, s); notes = []
                if not bb: notes.append("empty")
                else:
                    if bb[0] == 0 or bb[1] == 0 or bb[2] == sw: notes.append(f"touches edge {bb}")
                    g = st.get("grounded", [True] * n)[i]
                    if g and abs(bb[3] - 1 - feet) > s - 1: notes.append(f"feet {bb[3]-1}")  # 2x: half a logical px of slack either way
                    if not g and bb[3] - 1 > feet: notes.append(f"below {bb[3]-1}")
                    hb = st.get("hitbox", [None] * n)[i]
                    if st.get("active", [False] * n)[i] and not hb: notes.append("active w/o hitbox")
                    if hb and (hb["x"] < 0 or hb["y"] < 0 or hb["x"] + hb["w"] > sw or hb["y"] + hb["h"] > sh): notes.append(f"hitbox outside cell {hb}")
                    ax = pick(st.get("anchorX"), i)
                    if ax is None or not (0 < ax < sw) or (not isinstance(st.get("anchorX"), list) and ax != sw // 2): notes.append(f"anchorX {ax}")
                if notes: print("FAIL", key, state, i, notes); bad += 1
    fails += bad
    print(("OK  " if not bad else "FAIL"), label, len(man["characters"]), "chars", nfr, "frames")
live = json.load(open(os.path.join(HERE, "assets/sprites/anims.json") if os.path.exists(os.path.join(HERE, "assets/sprites/anims.json")) else os.path.join(LIVE, "assets/sprites/anims.json")))
if os.path.exists(os.path.join(HERE, "kits_anims.json")):          # test build dir: check it merged over the live manifest
    import copy; kit = json.load(open(os.path.join(HERE, "kits_anims.json"))); live = copy.deepcopy(live)
    for k, ch in kit["characters"].items(): live["characters"][k]["states"].update(ch["states"])
for o in OUT:
    ch = live["characters"].get("matthew_" + o)
    if not ch: print("FAIL missing matthew_" + o); fails += 1; continue
    for s_ in ("idle_signature", "combo3", "special"):
        st = ch["states"].get(s_)
        fl = st and st.get("file"); fl = " ".join(fl) if isinstance(fl, list) else (fl or "")
        if not st or "_kit" not in fl: print("FAIL", o, s_, "not a kit state", st and st.get("file")); fails += 1
    sp = ch["states"].get("special", {}); k_ = art_scale(sp)
    # wide special: 240-px logical cell (480 at 2x); anchorX 120 logical, or a per-frame list inside the cell
    ax_ok = sp.get("anchorX") == 120 * k_ or (isinstance(sp.get("anchorX"), list) and all(0 < v < sp.get("fw", 0) for v in sp["anchorX"]))
    if not (sp.get("fw", 0) >= 240 * k_) or not ax_ok: print("FAIL special not wide", o, sp.get("fw"), sp.get("anchorX")); fails += 1  # HD wide cells are sized to the move (480-544 at 2x)
    if not ch.get("kit"): print("FAIL", o, "no kit tag"); fails += 1
check_anims({"artScale": live.get("artScale"), "characters": {k: v for k, v in live["characters"].items() if k.startswith("matthew_")}}, "matthew_* states in anims.json (kit + shared)")
for k, ch in live["characters"].items():                       # schema keys getAnimFrame relies on
    for s_, st in ch["states"].items():
        fl = st.get("file", ""); fl = " ".join(fl) if isinstance(fl, list) else fl
        if "_kit" not in fl: continue
        for f in ("frames", "fps", "loop", "fw", "fh", "anchorX", "sx", "sw", "sy", "sh", "grounded", "lying", "active", "hitbox"):
            if f not in st: print("FAIL schema", k, s_, f); fails += 1
# weapons strip
wp = Image.open(os.path.join(HERE, "assets/sprites/weapons.png")); wj = json.load(open(os.path.join(HERE, "assets/sprites/weapons.json")))
WS = wj.get("_meta", {}).get("artScale", 1); CELL = wj.get("_meta", {}).get("fw", 48)  # 1.8.0: 96 px, 2x, soft alpha
if wp.mode != "RGBA" or wp.size != (CELL * len(WEAPONS), CELL) or CELL != 48 * WS: print("FAIL weapons.png size", wp.size, CELL, WS); fails += 1
hist = wp.getchannel("A").histogram()
if WS == 1 and any(hist[v] for v in range(1, 255)): print("FAIL weapons alpha not hard"); fails += 1
for i, o in enumerate(WEAPONS):
    it = wj[o]; c = wp.crop((it["x"], it["y"], it["x"] + it["w"], it["y"] + it["h"])); bb = solid_bbox(c.getchannel("A"), WS); E = it["w"] - 1
    if it["index"] != i or not bb or bb[0] == 0 or bb[1] == 0 or bb[2] == it["w"] or bb[3] == it["h"]: print("FAIL weapon icon", o, bb); fails += 1
    if any(c.getchannel("A").getpixel(p) for p in [(0, 0), (E, 0), (0, E), (E, E)]): print("FAIL weapon corner", o); fails += 1
if wj.get("_meta", {}).get("order") != WEAPONS or wj["_meta"].get("count") != len(WEAPONS): print("FAIL weapons.json _meta order/count"); fails += 1
print("OK  " if not fails else "FAIL", "weapons.png/json", wp.size)
print("FAILS:", fails)
