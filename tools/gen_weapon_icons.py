"""HUD weapon icons (outfit kits): assets/sprites/weapons.png (12 x 48x48, one row, order = gen_kits.OUTFITS, transparent,
hard alpha) + assets/sprites/weapons.json. Read by js/sprites.js getWeaponIcon(). usage: gen_weapon_icons.py [--out DIR]"""
import json, math, os, sys
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
from PIL import Image
import gen_matthew_v2 as g
from gen_matthew_v2 import C, Canvas, Part, ramp, taper, add, rot, finish
import kit_draw as kd
from gen_kits import OUTFITS, KIT, ScaleCV
CELL = 48

class PadCV(Canvas):
    PAD = 16
    def __init__(self, n): super().__init__(n + 2 * self.PAD, n + 2 * self.PAD); self.xf = (1, 1, 0, 0)
    def P(self, x, y): return ((x + self.PAD) * g.S, (y + self.PAD) * g.S)
def icon(o):
    g.set_outfit(o)
    cv = PadCV(CELL)
    S = lambda c, s: ScaleCV(cv, c, s)
    if o == "polo":     kd.w_book(S((15, 30), 1.35), f=(15, 30), ang=-25)
    elif o == "photo":
        kd.w_camera(S((20, 28), 1.3), f=(20, 28), ang=0, neck=(12, 12))
    elif o == "hoodie": kd.w_board(S((24, 24), 0.74), c=(24, 24), ang=-32, flip=0)
    elif o == "jacket": kd.w_bikechain(S((0, 0), 1.0), path=[(12, 37), (17, 30), (25, 29), (29, 21), (34, 14), (37, 10)])
    elif o == "street": kd.w_bat(S((10, 38), 0.78), f=(10, 38), ang=-45)
    elif o == "varsity": kd.w_football(S((24, 24), 2.0), c=(24, 24), ang=-30)
    elif o == "mechanic": kd.w_wrench(S((12, 38), 0.74), f=(12, 38), ang=-48)
    elif o == "diner":  kd.w_pan(S((8, 40), 0.95), f=(8, 40), ang=-42, face=1.0)
    elif o == "gold":
        path = [(24 + 14 * math.cos(math.radians(a)), 22 + 12 * math.sin(math.radians(a))) for a in range(100, 470, 30)]
        kd.w_goldchain(S((0, 0), 1.0), path=path)
    elif o == "webslinger":
        kd.w_starline(S((0, 0), 1.0), hand=(10, 12), weight=(31, 31), slack=4, spin=12, coil=(11, 14))
    elif o == "beacon":
        kd.fx_greenburst(S((0, 0), 1.0), c=(24, 24), r=9, spin=0)
        kd.w_shard(S((0, 0), 1.0), c=(24, 24), r=11, spin=0)
    elif o == "ironclad":                         # raised open gauntlet inside its concussive ring (no gun read)
        kd.fx_ring(S((0, 0), 1.0), c=(24, 19), rx=14, ry=14, w=2.0, sparks=(-40, 200))
        pl = g.STYLE["plate"]
        p = Part(cv, [taper((25, 35), 6.0, (24, 26), 5.8)], pl, shade=(2, 1.5), hi=(0.8, -0.8), rim=0.8, ink=0.75)
        p.line([(22, 34), (22, 28)], pl["hi"], 0.6); p.line([(20, 31), (29, 31)], g.SEAMC(), 0.5); p.commit()
        g.draw_fist(cv, (24, 30), (24, 19), g.PAL["skin"], open_hand=False, fist_ang=-90)
    big = finish(cv); bb = big.getchannel("A").getbbox()
    w, h = bb[2] - bb[0], bb[3] - bb[1]
    if not (w <= CELL - 2 and h <= CELL - 2): print("!! too big", o, w, h); bb = (bb[0], bb[1], bb[0] + min(w, CELL - 2), bb[1] + min(h, CELL - 2)); w, h = bb[2] - bb[0], bb[3] - bb[1]
    out = Image.new("RGBA", (CELL, CELL), (0, 0, 0, 0))
    out.paste(big.crop(bb), ((CELL - w) // 2, (CELL - h) // 2))
    return out

def main():
    sheet = Image.new("RGBA", (CELL * len(OUTFITS), CELL), (0, 0, 0, 0))
    man = {"_meta": dict(file="assets/sprites/weapons.png", fw=CELL, fh=CELL, count=len(OUTFITS), order=OUTFITS,
                         note="One icon per outfit, left->right in this order; transparent, hard alpha, rig outline/cel style.")}
    for i, o in enumerate(OUTFITS):
        im = icon(o); bb = im.getchannel("A").getbbox()
        assert bb and bb[0] > 0 and bb[1] > 0 and bb[2] < CELL and bb[3] < CELL, (o, bb)
        sheet.alpha_composite(im, (i * CELL, 0))
        man[o] = dict(name=KIT[o][0], move=KIT[o][1], index=i, x=i * CELL, y=0, w=CELL, h=CELL)
        print(o, bb)
    a = sys.argv[1:]; out = os.path.join(a[a.index("--out") + 1], "assets", "sprites") if "--out" in a else g.SPR
    os.makedirs(out, exist_ok=True)
    sheet.save(os.path.join(out, "weapons.png"))
    json.dump(man, open(os.path.join(out, "weapons.json"), "w"), indent=1)
    bg = Image.new("RGBA", sheet.size, (60, 60, 70, 255)); bg.alpha_composite(sheet)
    bg2 = Image.new("RGBA", sheet.size, (214, 214, 220, 255)); bg2.alpha_composite(sheet)
    both = Image.new("RGBA", (sheet.width, CELL * 2)); both.paste(bg, (0, 0)); both.paste(bg2, (0, CELL))
    os.makedirs("/workspace/tmp_sprite", exist_ok=True)
    both.resize((both.width * 3, both.height * 3), Image.NEAREST).save("/workspace/tmp_sprite/weapons_preview.png")
if __name__ == "__main__": main()
