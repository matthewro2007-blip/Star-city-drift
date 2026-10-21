#!/usr/bin/env python3
"""1.6.0: build Matthew outfit `darkstar` (Dark Star Suit) on the shared rig and INSTALL it (append-only):
assets/sprites/matthew_darkstar{,_anim,_anim_wide,_kit,_kit_wide}.png, anims.json characters.matthew_darkstar
(+ "darkstar" in outfits), weapons.png/json icon. Existing characters / icons stay identical.
usage: python3 tools/gen_darkstar_outfit.py [--jobs N]"""
import json, os, shutil, sys, time
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
REPO = os.path.dirname(HERE); SPR = os.path.join(REPO, "assets", "sprites")
from PIL import Image, ImageChops
import darkstar_ext as dx
g, ga, gk = dx.g, __import__("gen_anims"), dx.gk
a = sys.argv[1:]; JOBS = int(a[a.index("--jobs") + 1]) if "--jobs" in a else 8
OUT = "/workspace/tmp_sprite/darkstar_build"; WORK = os.path.join(OUT, "work"); os.makedirs(WORK, exist_ok=True)
gk.OUT_SPR = gk.SPR_DIR = os.path.join(WORK, "kit_live_guard")
t0 = time.time()
g.set_outfit(dx.OID); sheet, _ = g.build_sheet(); sheet.save(os.path.join(OUT, "matthew_darkstar.png")); g.set_outfit("polo")
AD = os.path.join(WORK, "anim"); os.makedirs(AD, exist_ok=True)
if os.path.exists(os.path.join(AD, "anims.json")): os.remove(os.path.join(AD, "anims.json"))
ga.SPR = AD; ga.build([dx.KEY], JOBS)
anim = json.load(open(os.path.join(AD, "anims.json")))["characters"][dx.KEY]
KD = os.path.join(WORK, "kit"); gk.build([dx.OID], JOBS, KD)
kit = json.load(open(os.path.join(KD, "kits_anims.json")))["characters"][dx.KEY]
files = {os.path.join(AD, "matthew_darkstar_anim.png"), os.path.join(AD, "matthew_darkstar_anim_wide.png"),
         os.path.join(KD, "assets", "sprites", "matthew_darkstar_kit.png"), os.path.join(KD, "assets", "sprites", "matthew_darkstar_kit_wide.png"),
         os.path.join(OUT, "matthew_darkstar.png")}
for f in files:
    if os.path.exists(f): shutil.copyfile(f, os.path.join(SPR, os.path.basename(f)))
entry = dict(anim); entry["states"] = dict(anim["states"])
for st in gk.KIT_STATES: entry["states"][st] = kit["states"][st]
entry["kit"] = kit["kit"]
mp = os.path.join(SPR, "anims.json"); man = json.load(open(mp)); before = {k: json.dumps(v, sort_keys=True) for k, v in man["characters"].items()}
man["characters"][dx.KEY] = entry
if dx.OID not in man.setdefault("outfits", []): man["outfits"].append(dx.OID)
for k, v in before.items():
    if k != dx.KEY: assert json.dumps(man["characters"][k], sort_keys=True) == v, k
json.dump(man, open(mp, "w"), indent=1)
print("anims.json:", dx.KEY, len(entry["states"]), "states:", sorted(entry["states"]))
# weapon icon (append)
wj_p, wp_p = os.path.join(SPR, "weapons.json"), os.path.join(SPR, "weapons.png")
wj = json.load(open(wj_p)); wp = Image.open(wp_p).convert("RGBA"); icon = dx.weapon_icon()
idx = wj[dx.OID]["index"] if dx.OID in wj else wj["_meta"]["count"]
W = max(wp.width, 48 * (idx + 1)); out = Image.new("RGBA", (W, 48), (0, 0, 0, 0)); out.paste(wp.crop((0, 0, 48 * idx, 48)), (0, 0)); out.paste(icon, (48 * idx, 0))
assert ImageChops.difference(out.crop((0, 0, 48 * idx, 48)), wp.crop((0, 0, 48 * idx, 48))).getbbox() is None
out.save(wp_p)
wj[dx.OID] = dict(name=dx.WEAPON, move=dx.MOVE, index=idx, x=48 * idx, y=0, w=48, h=48)
wj["_meta"]["order"] = [o for o in wj["_meta"]["order"] if o != dx.OID] + [dx.OID]; wj["_meta"]["count"] = len(wj["_meta"]["order"])
json.dump(wj, open(wj_p, "w"), indent=1)
print("weapon icon index", idx, "done %.1fs" % (time.time() - t0))
