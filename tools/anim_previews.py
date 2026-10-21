"""Preview sheets + GIFs for anims.json -> /workspace/tmp_sprite/."""
import json, os
from PIL import Image, ImageDraw
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = "/workspace/tmp_sprite"; os.makedirs(OUT, exist_ok=True)
M = json.load(open(os.path.join(ROOT, "assets/sprites/anims.json")))["characters"]
_cache = {}
def frames(key, state):
    st = M[key]["states"][state]; p = os.path.join(ROOT, st["file"])
    im = _cache.get(p) or _cache.setdefault(p, Image.open(p).convert("RGBA"))
    fw, fh = st.get("fw", 144), st.get("fh", 192); ax = st.get("anchorX", fw // 2)
    out = []
    for i, f in enumerate(st["frames"]):           # recentre wide cells onto a common 240x232 canvas
        sx = st["sx"][i] if "sx" in st else f * fw
        c = Image.new("RGBA", (240, 232), (0, 0, 0, 0)); c.alpha_composite(im.crop((sx, 0, sx + fw, fh)), (120 - ax, 232 - fh))
        out.append(c)
    return out, st
def sheet(rows, out, scale=1):
    W = max(len(frames(k, s)[0]) for k, s in rows)
    img = Image.new("RGBA", (110 + W * 240, len(rows) * 232), (214, 214, 220, 255)); d = ImageDraw.Draw(img)
    for r, (k, s) in enumerate(rows):
        d.text((4, r * 232 + 110), f"{k}\n{s}", fill=(20, 20, 30))
        for c, f in enumerate(frames(k, s)[0]): img.alpha_composite(f, (110 + c * 240, r * 232))
        d.line([(110, r * 232 + 229), (img.width, r * 232 + 229)], fill=(170, 170, 180))
    if scale != 1: img = img.resize((int(img.width * scale), int(img.height * scale)), Image.NEAREST)
    img.save(os.path.join(OUT, out)); print(out, img.size)
def gif(seq, out, scale=2):
    fr, dur = [], []
    for k, s in seq:
        fs, st = frames(k, s)
        for f in fs:
            b = Image.new("RGBA", f.size, (214, 214, 220, 255)); b.alpha_composite(f)
            fr.append(b.convert("RGB").resize((240 * scale, 232 * scale), Image.NEAREST)); dur.append(int(1000 / st["fps"]))
        if not st["loop"]: dur[-1] += 400
    fr[0].save(os.path.join(OUT, out), save_all=True, append_images=fr[1:], duration=dur, loop=0); print(out, len(fr))
pol = M["matthew_polo"]["states"]
sheet([("matthew_polo", s) for s in pol], "anim_matthew_polo.png", 2)
outs = [k for k in M if k.startswith("matthew_")]
sheet([(k, "special") for k in outs], "anim_outfits_special.png")
cast = ["dee", "hank", "priya", "cam", "june", "silas", "tessa", "coach", "wren"]
sheet([(k, s) for k in cast for s in ("idle_personality", "talk")], "anim_cast.png", 0.6)
sheet([("silas", s) for s in ("idle_personality", "talk")], "anim_silas.png")
gif([("matthew_polo", "special")], "matthew_special.gif")
gif([("matthew_polo", s) for s in ("combo1", "combo2", "combo3")], "matthew_combo.gif")
gif([("tessa", "idle_personality")], "tessa_idle.gif")
gif([("silas", "idle_personality"), ("silas", "talk")], "silas_npc.gif")
