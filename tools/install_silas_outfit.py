#!/usr/bin/env python3
"""Install the Matthew `silas` outfit build (tools/gen_silas_outfit.py output) into assets/sprites. APPEND-ONLY, idempotent:
  - copies matthew_silas.png, matthew_silas_{anim,anim_wide,kit,kit_wide,moves,moves_wide}.png, portrait_matthew_silas.png
  - anims.json: sets characters.matthew_silas (every other character, incl. Jack's silas_player, untouched) + appends "silas" to outfits
  - weapons.png/json: Iron Gauntlet icon at index 12 (x 576); existing icons stay pixel-identical
  - collectibles.png/json: "Boone's Overcoat" at row 20; existing rows stay pixel-identical
usage: python3 tools/install_silas_outfit.py [BUILD_DIR]   (default /workspace/tmp_sprite/silas_outfit_build)"""
import json, os, shutil, sys
from PIL import Image, ImageChops
REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); SPR = os.path.join(REPO, "assets", "sprites")
SRC = sys.argv[1] if len(sys.argv) > 1 else "/workspace/tmp_sprite/silas_outfit_build"
PNGS = ["matthew_silas.png", "matthew_silas_anim.png", "matthew_silas_anim_wide.png", "matthew_silas_kit.png", "matthew_silas_kit_wide.png",
        "matthew_silas_moves.png", "matthew_silas_moves_wide.png", "portrait_matthew_silas.png"]
def same(a, b): return a.size == b.size and ImageChops.difference(a.convert("RGBA"), b.convert("RGBA")).getbbox() is None
for f in PNGS: shutil.copyfile(os.path.join(SRC, f), os.path.join(SPR, f))
print("copied", len(PNGS), "strips/sheets/portrait")

# anims.json
mp = os.path.join(SPR, "anims.json"); man = json.load(open(mp)); before = {k: json.dumps(v, sort_keys=True) for k, v in man["characters"].items()}
st = json.load(open(os.path.join(SRC, "silas_anims.json")))
man["characters"]["matthew_silas"] = st["characters"]["matthew_silas"]
if "silas" not in man.setdefault("outfits", []): man["outfits"].append("silas")
for k, v in before.items():
    if k != "matthew_silas": assert json.dumps(man["characters"][k], sort_keys=True) == v, k
json.dump(man, open(mp, "w"), indent=1)
print("anims.json: matthew_silas", len(man["characters"]["matthew_silas"]["states"]), "states; outfits", man["outfits"])

# weapons
wj_p, wp_p = os.path.join(SPR, "weapons.json"), os.path.join(SPR, "weapons.png")
wj = json.load(open(wj_p)); wp = Image.open(wp_p).convert("RGBA"); ent = json.load(open(os.path.join(SRC, "weapons_silas.json")))["silas"]
icon = Image.open(os.path.join(SRC, "weapon_silas.png")).convert("RGBA"); assert icon.size == (48, 48)
idx = wj["silas"]["index"] if "silas" in wj else wj["_meta"]["count"]; assert idx == ent["index"] == 12, (idx, ent)
W = max(wp.width, 48 * (idx + 1)); out = Image.new("RGBA", (W, 48), (0, 0, 0, 0)); out.paste(wp.crop((0, 0, 48 * idx, 48)), (0, 0)); out.paste(icon, (48 * idx, 0))
assert same(out.crop((0, 0, 48 * idx, 48)), wp.crop((0, 0, 48 * idx, 48)))
out.save(wp_p)
wj["silas"] = dict(name="Iron Gauntlet", move="Iron Handshake", index=idx, x=48 * idx, y=0, w=48, h=48)
wj["_meta"]["order"] = [o for o in wj["_meta"]["order"] if o != "silas"] + ["silas"]; wj["_meta"]["count"] = len(wj["_meta"]["order"])
assert wj["_meta"]["order"].index("silas") == idx
json.dump(wj, open(wj_p, "w"), indent=1)
print("weapons.png", out.size, "count", wj["_meta"]["count"])

# collectibles
cj_p, cp_p = os.path.join(SPR, "collectibles.json"), os.path.join(SPR, "collectibles.png")
cj = json.load(open(cj_p)); cp = Image.open(cp_p).convert("RGBA"); cent = json.load(open(os.path.join(SRC, "collectibles_silas.json")))["silas"]
row_img = Image.open(os.path.join(SRC, "collectible_silas.png")).convert("RGBA"); assert row_img.size == (288, 48)
rows = [v["row"] for k, v in cj.items() if not k.startswith("_") and k != "silas"]
row = cj["silas"]["row"] if "silas" in cj else max(rows) + 1; assert row == cent["row"] == 20, (row, cent)
out = Image.new("RGBA", (288, 48 * (row + 1)), (0, 0, 0, 0)); out.paste(cp.crop((0, 0, 288, 48 * row)), (0, 0)); out.paste(row_img, (0, 48 * row))
assert same(out.crop((0, 0, 288, 48 * row)), cp.crop((0, 0, 288, 48 * row)))
out.save(cp_p)
cj["silas"] = cent; json.dump(cj, open(cj_p, "w"), indent=1)
print("collectibles.png", out.size, "rows", len([k for k in cj if not k.startswith("_")]))
