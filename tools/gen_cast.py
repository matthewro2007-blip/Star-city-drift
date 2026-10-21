#!/usr/bin/env python3
"""Star City Drift 2D - NPC / thug / boss sprite generator.

Re-uses the Matthew v3 rig, cel shading, inking and finishing from
gen_matthew_v2.py (same poses, same 144x192 frame, feet on row 189) and swaps
in per-character heads, skin, clothing palettes and builds.

Outputs (assets/sprites/):
  <npc>.png            144x192 relaxed idle still (getNpcSprite contract)
  <npc>_sheet.png      1152x192, 8 frames in matthew_sheet order (not loaded yet; for later animation)
  thug_<c>.png         144x192 idle still (legacy single-image contract)
  thug_<c>_sheet.png   1152x192, 8 frames (idle 0-1, walk 2-3, punch 4-5, kick 6, hurt 7)
  silas_sheet.png      1152x192 boss sheet, same layout, bigger build
  npcs.png             664x768 atlas (88px label gutter + 9 cols x 8 rows of 64x96)
"""
import math, os, sys, random
from PIL import Image, ImageDraw, ImageFont
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import gen_matthew_v2 as g
from gen_matthew_v2 import (C, Part, Canvas, add, rot, lerp, mix, ramp, taper, ellipse_pts,
                            PAL, OUT, finish, POSES, pose, render_figure, FW, FH)

SPR = g.SPR
HERO_SKIN = dict(PAL["skin"])
SKINS = {
    "fair":   HERO_SKIN,
    "peach":  dict(base=C(240, 200, 172), sh=C(218, 170, 144), dk=C(184, 134, 112), hi=C(255, 226, 204)),
    "olive":  dict(base=C(222, 178, 136), sh=C(196, 148, 108), dk=C(156, 110, 78), hi=C(240, 206, 168)),
    "tan":    dict(base=C(200, 148, 104), sh=C(170, 118, 80), dk=C(128, 84, 56), hi=C(226, 180, 136)),
    "brown":  dict(base=C(150, 98, 64), sh=C(120, 74, 48), dk=C(86, 50, 32), hi=C(184, 132, 92)),
    "deep":   dict(base=C(104, 66, 44), sh=C(80, 48, 32), dk=C(54, 32, 22), hi=C(140, 96, 68)),
    "ruddy":  dict(base=C(236, 186, 160), sh=C(210, 152, 128), dk=C(172, 112, 94), hi=C(252, 214, 192)),
    "golden": dict(base=C(214, 160, 112), sh=C(186, 130, 88), dk=C(142, 92, 60), hi=C(236, 190, 146)),
    "pale":   dict(base=C(232, 210, 196), sh=C(204, 178, 166), dk=C(164, 136, 128), hi=C(248, 232, 222)),
}
def hairpal(rgb): return ramp(rgb, sh=0.7, dk=0.48)
HAIR = {
    "black": dict(base=C(30, 22, 20), sh=C(20, 14, 12), dk=C(12, 8, 6), hi=C(76, 62, 58)),
    "brown": hairpal((84, 52, 32)), "auburn": hairpal((140, 64, 34)), "grey": hairpal((168, 166, 162)),
    "silver": dict(base=C(190, 192, 198), sh=C(140, 142, 152), dk=C(96, 98, 110), hi=C(236, 238, 244)),
    "dark": hairpal((44, 32, 26)), "blond": hairpal((206, 168, 96)),
}

# ---------------------------------------------------------------- heads
HK = 1.08
OUTLINE = [(-2.5, -14.4), (3.5, -14.2), (7.8, -12), (10.1, -8), (10.7, -4.4), (10.1, -2.4),
           (10.8, 0), (12.6, 3.5), (11.1, 4.6), (11.6, 6.0), (11.1, 7.5), (11.4, 8.7), (11.2, 10.6),
           (10.2, 12.6), (8.2, 14.0), (5.2, 14.6), (2.0, 13.8), (-1.0, 11.8), (-3.6, 8.8),
           (-6.8, 5.2), (-10.0, -0.5), (-10.4, -6), (-7.6, -11.8)]

def make_head(cfg):
    """Return a HEAD_FN for gen_matthew_v2.render_figure with this character's look.
    cfg: hair style/colour, facial hair, brows, glasses, lashes, earring, hat."""
    def head(cv, hc, ang, expr="calm", pal_skin=None):
        sk = pal_skin; hair = HAIR[cfg.get("hair_col", "black")]
        T = lambda q: add(rot((q[0]*HK, q[1]*HK), ang), hc)
        style = cfg.get("hair", "short")
        # ---- back hair (behind the skull)
        back = None
        if style == "long":
            back = [(-3, -15.5), (-10, -13), (-13.8, -5), (-14.4, 6), (-13.6, 17), (-10.5, 23.5), (-4.5, 24.5), (-1.5, 18), (-2.5, 8), (0, -2)]
        elif style == "ponytail":
            back = [(-9, -8), (-14.5, -5.5), (-18, 2), (-19, 11), (-16.8, 18), (-14.6, 12), (-14.2, 4), (-11, -1)]
        elif style == "bun":
            back = ellipse_pts((-11.2, -11.5), 5.6, 5.0, 10, n=20)
        elif style == "curly":
            back = [(q[0], q[1]) for q in ellipse_pts((-3.4, -9.6), 15.5, 12.8, -8, n=30)]
        if back:
            bp = Part(cv, [[T(q) for q in back]], hair, shade=(3, 2), hi=(1.2, -1.2), rim=1.0)
            if style == "curly":
                for c in [(-14, -6), (-10, -17), (-1, -20), (7, -18), (-15, 2), (-6, -13), (3, -14)]:
                    bp.line([T(add(c, (-1.6, 0.6))), T(add(c, (0, -1.2))), T(add(c, (1.6, 0.6)))], hair["hi"], 0.5)
            elif style == "long":
                bp.line([T((-9, -10)), T((-11.5, 4)), T((-9.5, 20))], hair["sh"], 0.6)
            elif style == "ponytail":
                bp.line([T((-14, -2)), T((-16.5, 8)), T((-16, 15))], hair["hi"], 0.5)
                bp.poly([T(q) for q in [(-11.5, -6.5), (-14.4, -4.8), (-13.2, -2.6), (-10.6, -4.2)]], C(220, 60, 60))  # scrunchie
            bp.commit()
        # ---- skull + face
        h = Part(cv, [[T(q) for q in OUTLINE]], sk, shade=(3.6, 2.0), hi=(1.4, -1.2), rim=1.0, deep=(1.2, 0.9))
        soft = mix(sk["base"], sk["sh"], 0.6)
        h.poly([T(q) for q in [(1.5, 6.5), (6.5, 9.8), (8.4, 13.6), (5.2, 14.4), (2.0, 13.6), (-0.8, 11.4)]], soft)
        h.poly([T(q) for q in [(4.0, 0.6), (8.6, 2.4), (7.0, 5.0), (3.4, 4.0)]], sk["hi"])
        if cfg.get("blush"):
            h.poly(ellipse_pts(T((6.2, 3.2)), 2.4, 1.5, n=12), mix(sk["base"], (236, 120, 110), 0.3))
        # close-cropped hair inside the skull silhouette
        edge_c = mix(sk["sh"], hair["base"], 0.55)
        if style in ("buzz", "short", "slick", "bun", "ponytail", "long", "cap", "beanie", "bandana", "mohawk", "engineer", "curly"):
            if style == "mohawk":     # shaved sides: just stubble tint
                h.poly([T(q) for q in [(9, -9.5), (3, -8.6), (2.6, -0.6), (-3.4, -2.6), (-6.4, 2.4), (-12, 2.6), (-12, -16), (9, -16)]], mix(sk["base"], hair["base"], 0.25))
            else:
                h.poly([T(q) for q in [(11.5, -9.0), (5.0, -8.6), (3.0, -6.8), (2.4, -0.6), (0.4, -2.4), (-3.4, -2.6),
                                       (-6.4, 2.4), (-12, 2.6), (-12, -16), (11.5, -16)]], edge_c)
                h.poly([T(q) for q in [(11.5, -9.2), (5.0, -8.9), (3.4, -7.6), (2.6, -4.6), (-0.4, -4.4), (-4.4, -4.0),
                                       (-7.6, -1.0), (-12, -1.2), (-12, -16), (11.5, -16)]], hair["base"])
        elif style == "bald":
            h.poly([T(q) for q in [(2.8, -5.2), (-0.6, -3.6), (-4.8, -3.6), (-8.4, 0), (-12, 0), (-12, -7.5), (-6, -7.4), (-1, -6.6)]], hair["base"])
            h.poly(ellipse_pts(T((-1.5, -11.5)), 4.0, 1.6, ang - 10, n=14), sk["hi"])     # scalp shine
        # ear
        h.poly([T(q) for q in [(-0.4, -2.6), (1.6, -1.2), (1.8, 2.4), (0.4, 4.4), (-2.2, 4.2), (-3, 1.2), (-2.4, -2)]], sk["base"])
        h.line([T((-0.6, -1.2)), T((0.6, 0.8)), T((-0.4, 3))], sk["dk"], 0.6)
        if cfg.get("earring"):
            h.dot(T((-0.2, 4.8)), 0.9, cfg["earring"])
        # brows
        bc = HAIR[cfg.get("brow_col", cfg.get("hair_col", "black"))]["base"]
        bw = cfg.get("brow_w", 1.6)
        if cfg.get("brow_angry"):
            h.poly([T(q) for q in [(4.8, -6.4), (10.8, -4.8), (10.8, -3.2), (5.0, -4.6)]], bc)
        else:
            h.poly([T(q) for q in [(4.8, -5.6), (10.8, -5.7), (10.8, -5.7 + bw), (5.0, -5.6 + bw)]], bc)
        # eyes
        iris = cfg.get("iris", C(28, 20, 18))
        if expr == "hurt":
            h.line([T((6.6, -1.6)), T((8.4, -0.9)), T((9.6, -1.8))], OUT, 0.8)
        else:
            h.poly([T(q) for q in [(6.6, -2.0), (9.7, -2.1), (9.4, -0.8), (7.0, -0.8)]], C(240, 230, 220))
            h.poly([T(q) for q in [(7.7, -2.1), (9.5, -2.1), (9.3, -0.8), (7.8, -0.8)]], iris)
            h.line([T((6.6, -2.2)), T((9.8, -2.3))], C(70, 44, 36), 0.55 if cfg.get("lashes") else 0.45)
            if cfg.get("lashes"):
                h.line([T((9.4, -2.3)), T((10.6, -3.0))], C(30, 20, 18), 0.5)
            h.line([T((6.8, -0.4)), T((9.2, -0.5))], sk["sh"], 0.45)
            if cfg.get("narrow"):
                h.line([T((6.4, -2.0)), T((9.8, -1.7))], sk["sh"], 0.6)
        if cfg.get("age"):
            h.line([T((5.2, -0.4)), T((6.0, 1.4))], sk["sh"], 0.4)
            h.line([T((6.5, -7.6)), T((9.6, -7.8))], sk["sh"], 0.4)
        h.line([T((10.2, 0.2)), T((12.0, 3.4)), T((10.8, 4.4))], sk["dk"], 0.5)
        h.poly([T(q) for q in [(9.4, 3.3), (11.2, 4.6), (9.8, 4.6)]], sk["dk"])
        h.line([T((5.4, 4.4)), T((7.4, 7.6))], sk["sh"], 0.5)
        lip = cfg.get("lip", C(206, 132, 118))
        if expr == "hurt":
            h.poly([T(q) for q in [(8.8, 7.0), (11.4, 6.9), (11.2, 9.0), (9.2, 8.8)]], C(96, 34, 30))
            h.line([T((9.2, 7.2)), T((11.2, 7.2))], C(240, 232, 220), 0.5)
        elif expr == "talk":                       # open mouth (talk anims)
            h.poly([T(q) for q in [(8.8, 7.0), (11.4, 6.8), (11.2, 9.2), (9.2, 9.0)]], C(110, 40, 36))
            h.line([T((9.0, 7.0)), T((11.3, 6.9))], lip, 0.6)
        elif cfg.get("smirk"):
            h.poly([T(q) for q in [(8.8, 7.4), (11.3, 6.6), (11.4, 7.6), (9.2, 8.0)]], lip)
            h.line([T((8.4, 7.9)), T((11.3, 7.0))], C(120, 66, 60), 0.5)
        else:
            h.poly([T(q) for q in [(9.0, 7.2), (11.3, 7.0), (11.4, 7.9), (9.2, 7.9)]], lip)
            h.line([T((9.0, 7.6)), T((11.3, 7.5))], mix(lip, (60, 20, 20), 0.4), 0.45)
        fh = cfg.get("facial", "none")
        fc = HAIR[cfg.get("facial_col", cfg.get("hair_col", "black"))]
        if fh in ("beard", "stubble"):
            col = fc["base"] if fh == "beard" else mix(sk["base"], fc["base"], 0.28)
            h.poly([T(q) for q in [(-1.4, 3.4), (1.2, 2.2), (3.2, 6.0), (7.2, 9.0), (8.6, 9.4), (9.6, 8.4), (11.8, 8.9), (11.6, 10.8),
                                   (10.4, 13.4), (8.0, 15.2), (4.8, 15.6), (1.6, 14.2), (-1.2, 11.8), (-3.6, 8.8)]], col)
            if fh == "beard":
                for a, b in (((2, 8), (4, 12)), ((5, 10.5), (6.6, 14)), ((8.6, 11), (9.2, 14))):
                    h.line([T(a), T(b)], fc["hi"], 0.45)
        if fh in ("beard", "mustache", "goatee"):
            h.poly([T(q) for q in [(7.4, 5.4), (9.6, 4.9), (11.8, 4.8), (12.3, 5.6), (11.8, 6.5), (9.4, 6.7), (7.4, 7.1)]], fc["base"])
        if fh == "goatee":
            h.poly([T(q) for q in [(7.8, 9.0), (11.0, 8.8), (11.0, 11.8), (9.6, 14.2), (8.0, 13.4)]], fc["base"])
            h.line([T((8.6, 10)), T((9.2, 13))], fc["hi"], 0.4)
        if cfg.get("scar"):
            h.line([T((4.6, -3.6)), T((6.4, 1.6))], mix(sk["base"], (190, 90, 90), 0.5), 0.55)
        h.commit()
        # ---- front hair / hats (over the skull, can add volume)
        hp = None; hpal = hair
        if style == "short":
            hp = [(11.6, -9.4), (11.4, -12.6), (7, -16.6), (-0.5, -18.2), (-8.2, -16.2), (-12.2, -10.4), (-12.4, -2.6), (-8.4, -1.2),
                  (-5, -4.0), (0.5, -4.6), (3, -7.6), (6.5, -8.0)]
        elif style == "slick":
            hp = [(11.4, -9.2), (11.0, -13.4), (6, -17.2), (-2, -18.0), (-9, -15.8), (-13, -10), (-13.2, -3.6), (-9.4, -1.8),
                  (-5.2, -4.4), (0.8, -5.4), (3.2, -8.2), (7, -9.0)]
        elif style in ("long", "bun", "ponytail"):
            hp = [(11.8, -6.8), (12.0, -11.4), (7.5, -16.2), (-0.5, -17.0), (-8.2, -15.4), (-12.0, -10.4), (-12.4, -2.0), (-9.4, 1.2),
                  (-4.6, -3.2), (1.0, -5.0), (5.0, -8.0), (8.4, -6.2)]
        elif style == "curly":
            hp = [(11.6, -6.4), (13.4, -10.6), (10.4, -17), (2.6, -21), (-6, -20.4), (-12.4, -15.6), (-13.6, -6), (-9.4, -1.4), (-4.6, -4), (1.4, -6.4), (6.2, -8.6)]
        elif style == "mohawk":
            hp = [(9.6, -9.0), (10.4, -15.6), (6.2, -21.4), (-1.6, -23.6), (-9.4, -20.2), (-12.4, -13.4), (-9.2, -12.8), (-2, -15.4), (5, -13.4)]
            hpal = ramp(cfg.get("mohawk_rgb", (150, 70, 200)), sh=0.72, dk=0.5)
        if hp:
            fp = Part(cv, [[T(q) for q in hp]], hpal, shade=(3.0, 2.2), hi=(1.3, -1.3), rim=1.0, ink=0.75)
            fp.line([T((-6, -15)), T((1, -16.6)), T((7, -14))], hpal["hi"], 0.7)
            if style == "slick":
                for k in (-1.5, 1.5):
                    fp.line([T((8, -11 + k)), T((-2, -14 + k)), T((-11, -9 + k))], hpal["sh"], 0.45)
            if style == "curly":
                for c in [(-8, -16), (0, -18.4), (7, -15), (-11, -9)]:
                    fp.line([T(add(c, (-1.6, 0.6))), T(add(c, (0, -1.2))), T(add(c, (1.6, 0.6)))], hpal["hi"], 0.5)
            fp.commit()
        hat = cfg.get("hat")
        if hat:
            hr = ramp(cfg["hat_rgb"])
            if hat == "cap":           # ball cap, brim forward
                dome = [(11.4, -8.4), (11.2, -12.4), (7, -17.2), (-1, -18.8), (-8.4, -17), (-12.4, -11.2), (-12.4, -6.2), (-4, -7.8), (4, -8.8)]
                brim = [(8.4, -10.0), (18.6, -9.4), (19.2, -7.4), (8.6, -7.0)]
                cp = Part(cv, [[T(q) for q in dome], [T(q) for q in brim]], hr, shade=(3, 2), hi=(1.2, -1.2), rim=1.0, ink=0.75)
                cp.line([T((8.6, -9.6)), T((18.6, -9.0))], hr["hi"], 0.5)
                cp.line([T((2, -18)), T((3.8, -9))], hr["sh"], 0.5)
                cp.dot(T((-0.4, -18.4)), 0.9, hr["dk"])
                if cfg.get("hat_logo"):
                    cp.dot(T((7.4, -13.0)), 1.6, cfg["hat_logo"])
                cp.commit()
            elif hat == "engineer":    # pinstriped rail engineer cap
                dome = [(11.6, -8.0), (12.6, -12.8), (8, -18.8), (-1.6, -20.4), (-10, -18.2), (-13.2, -11.6), (-12.4, -6.4), (-3, -7.6), (5, -8.6)]
                brim = [(8.8, -9.4), (17.4, -8.8), (17.6, -6.8), (8.8, -6.6)]
                cp = Part(cv, [[T(q) for q in dome], [T(q) for q in brim]], hr, shade=(3, 2), hi=(1.2, -1.2), rim=1.0, ink=0.75)
                for x in range(-11, 12, 2):
                    cp.line([T((x, -19.6)), T((x + 0.8, -8.0))], C(236, 238, 240), 0.35)
                cp.line([T((-12.8, -9.0)), T((11.8, -10.0))], hr["dk"], 0.7)
                cp.poly([T(q) for q in brim], hr["dk"])
                cp.commit()
            elif hat == "beanie":
                dome = [(11.4, -7.6), (11.6, -12.6), (7, -18.6), (-1.4, -20.6), (-9, -18.6), (-13, -12.2), (-12.8, -5.4), (-4, -6.8), (4, -8.2)]
                cp = Part(cv, [[T(q) for q in dome]], hr, shade=(3, 2), hi=(1.2, -1.2), rim=1.0, ink=0.75)
                cp.poly([T(q) for q in [(-12.9, -9.6), (11.6, -11.0), (11.4, -7.6), (4, -8.2), (-4, -6.8), (-12.8, -5.4)]], hr["sh"])
                for x in range(-11, 11, 2):
                    cp.line([T((x, -9.6)), T((x, -6.6))], hr["dk"], 0.35)
                cp.commit()
            elif hat == "bandana":
                dome = [(11.2, -8.2), (11.0, -12.4), (7, -16.4), (-1, -17.4), (-8.4, -15.6), (-12.4, -10.2), (-12.6, -5.8), (-4, -7.6), (4, -8.8)]
                tail = [(-11.6, -8), (-17.4, -6.4), (-16.2, -2.6), (-11.4, -5.2)]
                cp = Part(cv, [[T(q) for q in dome], [T(q) for q in tail]], hr, shade=(3, 2), hi=(1.2, -1.2), rim=1.0, ink=0.75)
                for c in [(-6, -13), (0, -14.6), (5, -12.4), (-9.6, -9)]:
                    cp.dot(T(c), 0.7, C(240, 236, 228))
                cp.commit()
            elif hat == "hood":        # hoodie hood up, face opening at the front
                hood = [(10.4, -8.4), (11.6, -13), (7, -19.6), (-2, -21.6), (-11, -18.4), (-15.4, -10), (-15.6, 2), (-12.6, 12),
                        (-6, 16), (-1.6, 13), (-3.6, 6), (-2.4, -2), (2, -7.4)]
                cp = Part(cv, [[T(q) for q in hood]], hr, shade=(3, 2.2), hi=(1.2, -1.2), rim=1.0, ink=0.8)
                cp.line([T((10.4, -8.4)), T((2, -7.4)), T((-2.4, -2)), T((-3.6, 6)), T((-1.6, 13))], hr["dk"], 0.9)
                cp.line([T((-9, -16)), T((-12, -4)), T((-9, 10))], hr["sh"], 0.6)
                cp.commit()
            elif hat == "hairnet":
                dome = [(11.0, -8.6), (11.2, -12.2), (7, -16.4), (-1, -17.6), (-8.6, -16), (-12.4, -10.4), (-12.2, -4.2), (-4, -6.6), (4, -8.6)]
                cp = Part(cv, [[T(q) for q in dome]], hr, shade=(3, 2), hi=(1.2, -1.2), rim=1.0, ink=0.75)
                cp.line([T((-12.4, -6.6)), T((11.2, -9.6))], hr["sh"], 0.8)
                cp.commit()
            elif hat == "helmet":      # 1.5.2 (Ivy): early-90s vented bike helmet, chin strap, little visor
                shell = [(12.6, -9.0), (12.8, -13.6), (8, -19.8), (-1.6, -22.4), (-10.6, -20.6), (-15.6, -14.6), (-15.4, -8.0), (-6, -9.6), (4, -10.4)]
                visor = [(9.6, -11.4), (16.8, -10.8), (16.2, -8.4), (9.8, -8.6)]
                cp = Part(cv, [[T(q) for q in shell], [T(q) for q in visor]], hr, shade=(3, 2), hi=(1.3, -1.3), rim=1.0, ink=0.8)
                for a_, b_ in (((-9, -19.4), (-6, -12.2)), ((-2, -21.4), (0, -12.8)), ((5, -19.4), (5.6, -12.4))):   # vents
                    cp.line([T(a_), T(b_)], C(30, 32, 40), 0.9)
                cp.line([T((-14.6, -12.6)), T((11.8, -12.8))], cfg.get("hat_stripe", C(240, 240, 236)), 0.8)
                cp.poly([T(q) for q in visor], hr["dk"])
                cp.line([T((-1.0, -9.8)), T((1.2, 2.0)), T((6.8, 12.6))], C(36, 36, 42), 0.45)        # chin strap
                cp.commit()
        if cfg.get("glasses"):
            d = ImageDraw.Draw(cv.img)
            col = cfg["glasses"]
            pts = [cv.P(*T(q)) for q in [(5.6, -3.4), (10.9, -3.6), (10.6, 0.6), (6.0, 0.6), (5.6, -3.4)]]
            d.line(pts, fill=col, width=int(0.7*g.S))
            d.line([cv.P(*T((5.6, -2.4))), cv.P(*T((-0.4, -2.8)))], fill=col, width=int(0.6*g.S))
        if cfg.get("shades"):
            d = ImageDraw.Draw(cv.img)
            d.polygon([cv.P(*T(q)) for q in [(5.4, -3.6), (11.4, -3.8), (11.0, -0.2), (8.4, 0.4), (6.0, -0.4)]], fill=C(20, 22, 30))
            d.line([cv.P(*T((6.6, -3.0))), cv.P(*T((9.4, -3.1)))], fill=C(120, 150, 190), width=int(0.5*g.S))
            d.line([cv.P(*T((5.6, -2.8))), cv.P(*T((-0.4, -2.6)))], fill=C(20, 22, 30), width=int(0.6*g.S))
    return head

# ---------------------------------------------------------------- props (near hand, drawn last)
def draw_prop(cv, kind, P):
    o = P["torso"]; lean = P.get("lean", 0)
    TL = lambda q: add(rot(q, lean), o)
    f = TL(P["near_fist"])
    if kind == "book":
        pr = ramp((120, 40, 52))
        b = Part(cv, [[add(f, q) for q in [(-3, -12), (9, -13), (10, 4), (-2, 5)]]], pr, shade=(2, 1.5), hi=(1, -1), rim=0.8, ink=0.7)
        b.line([add(f, (-2.2, -11.4)), add(f, (-1.4, 4.2))], C(236, 220, 180), 0.8)
        b.line([add(f, (1, -8)), add(f, (7, -8.6))], C(224, 184, 90), 0.6)
        b.commit()
    elif kind == "clipboard":
        pr = ramp((150, 104, 60))
        b = Part(cv, [[add(f, q) for q in [(-2, -15), (10, -15.5), (10.6, 3), (-1.4, 3.4)]]], pr, shade=(2, 1.5), hi=(1, -1), rim=0.8, ink=0.7)
        b.poly([add(f, q) for q in [(0, -12), (8.6, -12.4), (9, 1.4), (0.4, 1.6)]], C(246, 244, 236))
        for y in (-9, -6, -3):
            b.line([add(f, (1.4, y)), add(f, (7.4, y - 0.2))], C(120, 140, 170), 0.4)
        b.poly([add(f, q) for q in [(2.6, -16.4), (6.6, -16.6), (6.6, -13.6), (2.6, -13.4)]], C(190, 190, 196))
        b.commit()
    elif kind == "spatula":
        st = ramp((190, 192, 198))
        b = Part(cv, [taper(add(f, (2, 0)), 1.0, add(f, (10, -14)), 1.0), [add(f, q) for q in [(7.4, -15.4), (13.6, -20.8), (16.2, -17.4), (10.6, -12.4)]]],
                 st, shade=(1.4, 1), hi=(0.6, -0.6), rim=0.6, ink=0.6)
        b.commit()
    elif kind == "phone":
        b = Part(cv, [[add(f, q) for q in [(1, -10), (5.6, -10.6), (6.2, -0.6), (1.6, 0)]]], ramp((30, 32, 40)), shade=(1, 1), hi=None, rim=0.6, ink=0.6)
        b.poly([add(f, q) for q in [(1.9, -9.2), (5.0, -9.6), (5.4, -1.6), (2.3, -1.2)]], C(110, 190, 240))
        b.commit()
    elif kind == "mug":
        b = Part(cv, [[add(f, q) for q in [(0, -9), (7, -9), (6.6, 1), (0.4, 1)]], ellipse_pts(add(f, (7.8, -4)), 2.6, 3, n=12)],
                 ramp((40, 90, 140)), shade=(1.4, 1), hi=(0.8, -0.8), rim=0.6, ink=0.6)
        b.poly(ellipse_pts(add(f, (7.8, -4)), 1.2, 1.6, n=10), (0, 0, 0, 0))
        b.line([add(f, (2, -11)), add(f, (1, -15)), add(f, (2.6, -18))], C(240, 240, 240), 0.5)
        b.commit()
    elif kind == "skateboard":
        deck = ramp((232, 76, 60))
        b = Part(cv, [[add(f, q) for q in [(-5, -26), (1, -28), (4, 14), (-2, 16)]]], deck, shade=(2, 1.6), hi=(1, -1), rim=0.8, ink=0.7)
        b.line([add(f, (-2, -22)), add(f, (1.8, 10))], C(250, 220, 90), 0.8)
        b.commit()
        for w in ((-5.5, -20), (-3.5, 9.5)):
            wh = Part(cv, [ellipse_pts(add(f, w), 2.2, 2.2, n=12)], ramp((240, 236, 220)), shade=(1, 1), hi=None, rim=0, ink=0.6)
            wh.commit()
    elif kind == "whistle":
        pass
    else:
        draw_prop_at(cv, kind, f)

def draw_prop_at(cv, kind, f, ang=0.0, k=0.0):
    """Hand-anchored props for the anim generator. f = hand point, ang = tilt (deg), k = 0..1 phase."""
    R_ = lambda q: add(f, rot(q, ang))
    if kind == "rag":
        pr = ramp((236, 236, 228))
        b = Part(cv, [[R_(q) for q in [(-6, -3), (7, -5), (9, 3), (2, 6), (-7, 4)]]], pr, shade=(1.6, 1.2), hi=(0.8, -0.8), rim=0.6, ink=0.6)
        b.line([R_((-4, 0)), R_((6, -1.6))], C(120, 160, 200), 0.6); b.commit()
    elif kind == "watch":
        g = ramp((224, 184, 80))
        b = Part(cv, [ellipse_pts(add(f, (3, -3)), 4.2, 4.2, n=16)], g, shade=(1.4, 1), hi=(0.7, -0.7), rim=0.6, ink=0.6)
        b.poly(ellipse_pts(add(f, (3, -3)), 3.0, 3.0, n=14), C(248, 244, 230))
        b.line([add(f, (3, -3)), add(f, (3 + 2*math.cos(k*6.28), -3 + 2*math.sin(k*6.28)))], C(30, 30, 30), 0.5)
        b.line([add(f, (3, -7.2)), add(f, (-2, -14)), add(f, (-6, -12))], C(200, 170, 80), 0.6); b.commit()
    elif kind == "book_open":
        pr = ramp((120, 40, 52))
        b = Part(cv, [[R_(q) for q in [(-10, -6), (0, -4), (10, -6), (10, 4), (0, 6), (-10, 4)]]], pr, shade=(1.6, 1.2), hi=(0.8, -0.8), rim=0.6, ink=0.7)
        b.poly([R_(q) for q in [(-9, -5), (-0.6, -3.4), (-0.6, 4.6), (-9, 3)]], C(248, 242, 222))
        b.poly([R_(q) for q in [(9, -5), (0.6, -3.4), (0.6, 4.6), (9, 3)]], C(240, 232, 210))
        tip = R_((9 - 18*k, -5 - 6*math.sin(k*math.pi)))                   # turning page
        b.poly([R_((0.6, -3.4)), tip, R_((9 - 18*k, 3 - 6*math.sin(k*math.pi))), R_((0.6, 4.6))], C(255, 252, 240))
        for y in (-1.5, 1.0): b.line([R_((-8, y)), R_((-2, y + 0.6))], C(140, 140, 160), 0.35)
        b.commit()
    elif kind == "keys":
        b = Part(cv, [ellipse_pts(f, 3.0, 3.0, n=12)], ramp((200, 200, 206)), shade=(1, 1), hi=None, rim=0.4, ink=0.6)
        b.poly(ellipse_pts(f, 1.8, 1.8, n=10), (0, 0, 0, 0))
        for j in range(2):
            a = math.radians(k*360 + j*140)
            e = add(f, (8*math.cos(a), 8*math.sin(a)))
            b.line([add(f, (3*math.cos(a), 3*math.sin(a))), e], C(220, 200, 90) if j == 0 else C(190, 196, 206), 1.1)
        b.commit()
    elif kind == "wateringcan":
        g = ramp((60, 150, 120))
        body = [R_(q) for q in [(-2, -8), (10, -8), (11, 4), (-3, 4)]]
        spout = [R_(q) for q in [(10, -2), (22, -9), (23, -7), (11, 1)]]
        b = Part(cv, [body, spout], g, shade=(1.6, 1.2), hi=(0.8, -0.8), rim=0.6, ink=0.7)
        b.line([R_((-2, -6)), R_((-6, -2)), R_((-3, 2))], g["dk"], 1.0); b.commit()
        if ang > 20:                                               # water drops
            sp = R_((23, -8))
            for j in range(4):
                d = Part(cv, [ellipse_pts(add(sp, (2 + j*1.5, 4 + j*6 + k*4)), 1.2, 1.8, n=8)], ramp((120, 190, 240)), shade=(0.6, 0.6), hi=None, rim=0, ink=0.4)
                d.commit()
    elif kind == "spraycan":
        g = ramp((230, 70, 140))
        b = Part(cv, [[R_(q) for q in [(-2.6, -14), (2.6, -14), (2.8, 3), (-2.8, 3)]]], g, shade=(1.2, 1), hi=(0.6, -0.6), rim=0.6, ink=0.7)
        b.poly([R_(q) for q in [(-2.6, -14), (2.6, -14), (1.4, -17), (-1.4, -17)]], C(210, 210, 216))
        b.line([R_((-2.6, -6)), R_((2.6, -6))], C(250, 250, 250), 0.6); b.commit()
    elif kind == "mist":
        for j in range(5):
            c = add(f, (6 + j*4, -2 + (j % 2)*3 - j))
            d = Part(cv, [ellipse_pts(c, 1.6 + j*0.5, 1.4 + j*0.4, n=10)], ramp((240, 120, 190)), shade=(0.6, 0.6), hi=None, rim=0, ink=0.3)
            d.commit()
    elif kind == "sketchbook":
        b = Part(cv, [[R_(q) for q in [(-4, -13), (10, -14), (10.6, 4), (-3.4, 5)]]], ramp((40, 44, 56)), shade=(1.6, 1.2), hi=(0.8, -0.8), rim=0.6, ink=0.7)
        b.poly([R_(q) for q in [(-2.4, -11.4), (8.8, -12.2), (9.2, 2.6), (-2, 3.2)]], C(248, 244, 232))
        b.line([R_((0, -8)), R_((3, -5)), R_((6, -9)), R_((7, -3))], C(230, 70, 140), 0.5)
        b.commit()
    elif kind == "pencil":
        b = Part(cv, [taper(f, 0.8, add(f, rot((9, -6), ang)), 0.6)], ramp((240, 196, 60)), shade=(0.6, 0.6), hi=None, rim=0.3, ink=0.5)
        b.commit()
    elif kind == "purse":
        pr = ramp((232, 96, 160))
        b = Part(cv, [[R_(q) for q in [(-7, 4), (7, 4), (8, 14), (-8, 14)]]], pr, shade=(1.6, 1.2), hi=(0.8, -0.8), rim=0.6, ink=0.7)
        b.line([R_((-6, 4)), R_((-3, -3)), R_((3, -3)), R_((6, 4))], C(120, 40, 80), 1.0)
        b.dot(R_((0, 8)), 1.1, C(240, 210, 90)); b.commit()
    elif kind == "pipe":
        b = Part(cv, [taper(add(f, rot((-4, 0), ang)), 1.8, add(f, rot((30, 0), ang)), 1.8)], ramp((150, 156, 164)), shade=(1, 1), hi=(0.6, -0.6), rim=0.6, ink=0.7)
        b.line([add(f, rot((-2, -1), ang)), add(f, rot((28, -1), ang))], C(220, 224, 230), 0.5); b.commit()
    elif kind == "bouquet":                        # 1.5.2 Wren: armful of market blooms in a kraft-paper cone; ang = tilt, k = rustle
        sc = 1.4
        Rb = lambda q: add(f, rot((q[0] * sc, q[1] * sc), ang))
        kraft = ramp((206, 164, 112))
        stems = ramp((70, 140, 70))
        for dx, dy in ((-6, -14), (-1, -18), (4, -16), (9, -12), (-9, -9)):               # leaves / greenery behind
            Part(cv, [ellipse_pts(Rb((dx, dy)), 3.4 * sc, 1.6 * sc, -40 + dx * 6, n=10)], ramp((60, 132, 72)), shade=(0.8, 0.6), hi=None, rim=0, ink=0.5).commit()
        rs = 0.8 * math.sin(k * 6.283)
        blooms = [((-5, -16), (236, 84, 132), 3.2), ((1, -20 + rs), (255, 206, 64), 3.0), ((6, -17), (178, 120, 236), 3.0),
                  ((-1, -13), (250, 246, 240), 2.8), ((8, -11 + rs), (240, 120, 60), 2.6), ((-8, -11), (255, 150, 180), 2.6),
                  ((3, -24 + rs), (220, 60, 70), 2.4)]
        for c, col, r in blooms:
            b = Part(cv, [ellipse_pts(Rb(c), r * sc, r * sc * 0.92, n=12)], ramp(col), shade=(0.9, 0.7), hi=(0.5, -0.5), rim=0.3, ink=0.55)
            b.dot(Rb(add(c, (0.2, 0.2))), r * sc * 0.38, mix(C(*col), (90, 60, 20), 0.55)); b.commit()
        cone = Part(cv, [[Rb(q) for q in [(-10, -9), (11, -9), (3, 8), (-1, 8)]]], kraft, shade=(1.6, 1.2), hi=(0.8, -0.8), rim=0.6, ink=0.7)
        cone.line([Rb((-8, -8)), Rb((1, 6))], kraft["sh"], 0.5)
        cone.line([Rb((-2.2, -1)), Rb((5.6, -1.4))], C(60, 160, 150), 0.8)                  # teal ribbon
        cone.commit()
    elif kind == "stem":                           # 1.5.2 Wren: a single bloom offered out (ang = stem angle from hand)
        tip = R_((0, -16))
        Part(cv, [taper(R_((0, 4)), 0.8, tip, 0.7)], ramp((70, 140, 70)), shade=(0, 0), hi=None, rim=0, ink=0.45).commit()
        Part(cv, [ellipse_pts(R_((3, -8)), 3.0, 1.4, ang - 30, n=10)], ramp((60, 132, 72)), shade=(0.8, 0.6), hi=None, rim=0, ink=0.45).commit()
        b = Part(cv, [ellipse_pts(tip, 3.6, 3.3, n=12)], ramp((236, 84, 132)), shade=(0.9, 0.7), hi=(0.5, -0.5), rim=0.4, ink=0.6)
        b.dot(add(tip, (0.3, 0.3)), 1.3, mix(C(236, 84, 132), (90, 60, 20), 0.55)); b.commit()
    # ---- 1.5.2 prequel NPC props (Lou / Gus / Pip)
    elif kind == "newspaper":                      # folded broadsheet: k = 0..1 shake/flutter of the loose page
        pp = ramp((236, 232, 214))
        fl = 1.6 * math.sin(k * 6.283)
        b = Part(cv, [[R_(q) for q in [(-3, -16), (9, -17), (10, 5), (-2, 6)]],
                      [R_(q) for q in [(9, -17), (14 + fl, -15), (14.6 + fl, 4), (10, 5)]]], pp, shade=(1.8, 1.2), hi=(0.8, -0.8), rim=0.6, ink=0.7)
        b.poly([R_(q) for q in [(-1.4, -14.4), (8, -15.2), (8.1, -11.8), (-1.2, -11.2)]], C(40, 40, 48))         # masthead
        for y in (-9, -6.6, -4.2, -1.8, 0.6, 3.0):
            b.line([R_((-1, y)), R_((7.6, y - 0.4))], C(150, 150, 160), 0.4)
        b.poly([R_(q) for q in [(1, -9.6), (6.6, -10), (6.8, -5.4), (1.2, -5.0)]], C(170, 160, 140))               # photo box
        b.line([R_((10, -17)), R_((10, 5))], C(196, 190, 170), 0.5)
        b.commit()
    elif kind == "lantern":                        # railroad hand lantern hanging from the fist: ang = swing, k = flame flicker
        bail = R_((0, 1))
        top = add(f, rot((0, 7), ang))
        tin = ramp((60, 64, 72)); glass = ramp((220, 60, 40), sh=0.8, dk=0.6, hi=(255, 170, 120))
        h = Part(cv, [taper(add(f, rot((-3.6, 0.6), ang)), 0.6, add(f, rot((-4.6, 8), ang)), 0.6),
                      taper(add(f, rot((3.6, 0.6), ang)), 0.6, add(f, rot((4.6, 8), ang)), 0.6)], tin, shade=(0.6, 0.6), hi=None, rim=0.3, ink=0.5)
        h.commit()
        Q = lambda q: add(top, rot(q, ang))
        b = Part(cv, [[Q(q) for q in [(-5.6, 0), (5.6, 0), (6.4, 3), (-6.4, 3)]],            # cap
                      [Q(q) for q in [(-6.6, 13.6), (6.6, 13.6), (7.2, 17), (-7.2, 17)]]],   # base
                 tin, shade=(1.2, 1), hi=(0.6, -0.6), rim=0.6, ink=0.7)
        b.commit()
        gl = Part(cv, [[Q(q) for q in [(-5.4, 3), (5.4, 3), (6.8, 8.4), (5.4, 13.6), (-5.4, 13.6), (-6.8, 8.4)]]], glass, shade=(1.4, 1), hi=(0.8, -0.8), rim=0.8, ink=0.7)
        gl.poly(ellipse_pts(Q((0.4, 8.6)), 2.0 + 0.5 * math.sin(k * 6.283), 3.0, n=12), C(255, 236, 150))      # flame
        for x in (-3.4, 3.4): gl.line([Q((x, 3.2)), Q((x * 1.2, 13.4))], tin["base"], 0.6)               # guard wires
        gl.commit()
    elif kind == "parcel":                         # brown-paper package tied with twine; k = small toss offset
        pr = ramp((176, 132, 84))
        o = add(f, (0, -4 - 16 * math.sin(k * math.pi)))
        Rp = lambda q: add(o, rot(q, ang))
        b = Part(cv, [[Rp(q) for q in [(-8, -7), (8, -8), (9, 6), (-7, 7)]]], pr, shade=(1.8, 1.3), hi=(0.8, -0.8), rim=0.7, ink=0.7)
        b.line([Rp((0.2, -7.6)), Rp((1.0, 6.6))], C(236, 224, 196), 0.6)
        b.line([Rp((-7.6, -0.4)), Rp((8.6, -1.2))], C(236, 224, 196), 0.6)
        b.poly([Rp(q) for q in [(-5.6, 1.4), (-1.4, 1.2), (-1.3, 4.6), (-5.4, 4.8)]], C(244, 240, 228))          # address label
        b.commit()

def draw_overlay(cv, P, style):
    """Outfit extras drawn over the figure: messenger-bag strap + bag, paint splatter."""
    o = P["torso"]; lean = P.get("lean", 0)
    TL = lambda q: add(rot(q, lean), o)
    if style.get("splatter"):
        rnd = random.Random(11)
        for _ in range(9):
            c = TL((rnd.uniform(-14, 16), rnd.uniform(-44, 6)))
            col = rnd.choice([C(236, 120, 40), C(60, 160, 150), C(230, 70, 140), C(250, 240, 120)])
            sp = Part(cv, [ellipse_pts(c, rnd.uniform(0.9, 1.8), rnd.uniform(0.8, 1.5), rnd.uniform(0, 90), n=8)],
                      dict(base=col, sh=col, dk=col, hi=col), shade=(0, 0), hi=None, rim=0, ink=0)
            sp.commit()
    if style.get("bag"):
        bc = style["bag"]; bp = dict(base=bc, sh=mix(bc, (0, 0, 0), 0.3), dk=mix(bc, (0, 0, 0), 0.5), hi=mix(bc, (255, 255, 255), 0.3))
        st = Part(cv, [taper(TL((12, -47)), 1.4, TL((-12, -2)), 1.4)], bp, shade=(0.8, 0.8), hi=None, rim=0.4, ink=0.5)
        st.commit()
        bag = Part(cv, [[TL(q) for q in [(-22, -6), (-8, -6), (-7, 10), (-23, 10)]]], bp, shade=(2, 1.4), hi=(0.8, -0.8), rim=0.8, ink=0.7)
        bag.poly([TL(q) for q in [(-22.4, -6), (-7.6, -6), (-8, 0), (-22.2, 0)]], bp["sh"])
        bag.dot(TL((-15, -1)), 1.0, C(236, 120, 40))
        bag.commit()

# ---------------------------------------------------------------- poses
NPC_IDLE = pose(lean=1, head=1,
                near_sh=(-11, -40), near_el=(-14, -19), near_fist=(-6, -2), open_near=True,
                far_sh=(13, -41), far_el=(17, -20), far_fist=(22, -3), open_far=True,
                near_knee=(60, 142), near_ankle=(55, 174), near_foot=2,
                far_knee=(80, 142), far_ankle=(85, 174), far_foot=0)
HOLD = dict(near_el=(-13, -21), near_fist=(4, -22), open_near=False)

# ---------------------------------------------------------------- outfits per character (gen_matthew_v2 STYLE dicts)
def fit(top="buttondown", shirt=(240, 234, 220), pants=(50, 82, 140), boot=None, sole=None, **kw):
    pal = dict(shirt=ramp(shirt) if isinstance(shirt, tuple) else shirt, jeans=ramp(pants),
               cuff=ramp(tuple(min(255, int(v*1.25 + 12)) for v in pants)))
    if boot: pal["boot"] = ramp(boot)
    if sole: pal["sole"] = ramp(sole, sh=0.86, dk=0.7)
    d = dict(kw); d["pal"] = pal
    if top != "buttondown": d["top"] = top
    for k in ("accent", "graphic"):
        if isinstance(d.get(k), tuple): d[k] = ramp(d[k])
    if isinstance(d.get("inner"), tuple): d["inner"] = ramp(d["inner"])
    return d

CAST = {
    # Dee Morales - diner cook (#d35400): orange tee, white apron, hair net over a bun, spatula
    "dee": dict(skin="tan", build=(0.94, 0.97), prop="spatula", hold=True,
                head=dict(hair="bun", hair_col="dark", hat="hairnet", hat_rgb=(70, 60, 58), lashes=True, lip=C(184, 92, 84), earring=C(240, 200, 90)),
                fit=fit("tee", (211, 84, 0), (36, 36, 42), boot=(30, 30, 32), sole=(200, 196, 190), untucked=True, shoe="sneaker",
                        apron=C(246, 244, 238), accent=(211, 84, 0))),
    # Priya Shah - bookstore clerk (#8e44ad): purple cardigan over cream top, long hair, glasses, book
    "priya": dict(skin="olive", build=(0.92, 0.96), prop="book", hold=True,
                  head=dict(hair="long", hair_col="black", glasses=C(60, 40, 40), lashes=True, lip=C(170, 80, 90), earring=C(230, 196, 90)),
                  fit=fit("jacket", (142, 68, 173), (44, 52, 74), boot=(70, 40, 40), sleeves="long", untucked=True,
                          inner=(236, 226, 206), accent=None, cardigan=True)),
    # Hank "Rail" Pettigrew - retired rail worker (#7f8c8d): engineer cap, grey beard, chambray shirt, work pants
    "hank": dict(skin="ruddy", build=(1.06, 1.0), prop="mug", hold=True,
                 head=dict(hair="bald", hair_col="grey", facial="beard", facial_col="grey", brow_col="grey", age=True,
                           hat="engineer", hat_rgb=(52, 70, 104), brow_w=1.9),
                 fit=fit("buttondown", (127, 140, 141), (92, 76, 58), boot=(94, 60, 34), suspenders=C(150, 40, 36))),
    # June Whitaker - community center volunteer (#27ae60): curly hair, green volunteer vest over white long-sleeve
    "june": dict(skin="deep", build=(0.93, 0.97), prop="clipboard", hold=True,
                 head=dict(hair="curly", hair_col="dark", lashes=True, lip=C(150, 70, 70), earring=C(240, 210, 110)),
                 fit=fit("jacket", (39, 174, 96), (60, 70, 96), boot=(120, 80, 50), untucked=True, vest=True,
                         inner=(244, 240, 232), accent=(244, 240, 232), sleeves="long", sleeve_pal=(244, 240, 232))),
    # Tessa Quinn - skate-shop kid (#e74c3c): red cap, ponytail, graphic tee, ripped jeans, skate shoes, board
    "tessa": dict(skin="peach", build=(0.88, 0.9), prop="skateboard", hold=False,
                  head=dict(hair="ponytail", hair_col="auburn", hat="cap", hat_rgb=(231, 76, 60), hat_logo=C(250, 240, 220), lashes=True, blush=True, lip=C(214, 120, 110)),
                  fit=fit("tee", (40, 44, 52), (98, 132, 180), boot=(231, 76, 60), sole=(244, 240, 232), untucked=True,
                          graphic=(231, 76, 60), ripped=True, shoe="sneaker")),
    # Coach Ray Delgado - gym (#2980b9): blue tracksuit w/ white stripes, whistle, buzz cut + goatee
    "coach": dict(skin="brown", build=(1.08, 1.03), prop=None, hold=False,
                  head=dict(hair="buzz", hair_col="black", facial="goatee", brow_w=1.9),
                  fit=fit("jacket", (41, 128, 185), (36, 90, 140), boot=(240, 240, 236), sole=(40, 40, 46), untucked=True,
                          sleeves="long", track=True, inner=(244, 244, 240), accent=(244, 244, 240), shoe="sneaker", hem="rib", whistle=True)),
    # Cam Ortiz - rideshare driver (#f1c40f): yellow bomber over black tee, shades, stubble, phone
    "cam": dict(skin="olive", build=(0.98, 1.0), prop="phone", hold=True,
                head=dict(hair="short", hair_col="black", facial="stubble", shades=True),
                fit=fit("jacket", (241, 196, 15), (38, 44, 60), boot=(40, 40, 44), sole=(236, 232, 224), untucked=True,
                        sleeves="long", inner=(30, 30, 34), accent=None, bomber=True, shoe="sneaker", hem="rib")),
}
# Wren Calloway - City Market flower seller (npcs.js role; 1.5.2 redraw). SAME head/skin/build as before (golden-tan skin,
# short black hair under her orange pom beanie, lashes, blush, teal earring; 0.9/0.93 build) so she stays recognizable.
# Lavender tee (no paint now), green canvas market apron, olive work pants, hi-top sneakers, armful of colorful blooms
# wrapped in kraft paper. (The street-artist spraycan/mist/sketchbook props stay available in draw_prop_at.)
WREN = dict(skin="golden", build=(0.9, 0.93), prop="bouquet", hold=True,
            head=dict(hair="short", hair_col="black", hat="beanie", hat_rgb=(236, 120, 40), lashes=True, blush=True,
                      lip=C(186, 104, 92), earring=C(120, 220, 210)),
            fit=fit("tee", (176, 150, 214), (92, 98, 64), boot=(240, 236, 226), sole=(60, 160, 150), untucked=True,
                    shoe="sneaker", accent=(60, 160, 150), apron=C(74, 124, 86)))
# Snatcher - original purse-snatcher thug: hood up (dark olive), grey joggers, stolen pink purse.
SNATCHER = dict(skin="peach", build=(0.96, 0.98),
                head=dict(hair="short", hair_col="brown", hat="hood", hat_rgb=(70, 78, 56), facial="stubble", facial_col="brown", brow_angry=True),
                fit=fit("hoodie", (70, 78, 56), (110, 112, 118), boot=(40, 40, 44), sole=(220, 220, 214), untucked=True,
                        sleeves="long", accent=(220, 220, 214), hem="rib", shoe="sneaker", nostar=True))
SILAS = dict(skin="pale", build=(1.09, 1.06), anchor_x=63.0,
             head=dict(hair="slick", hair_col="silver", facial="goatee", facial_col="silver", brow_col="grey",
                       narrow=True, smirk=True, brow_angry=True, brow_w=1.8, scar=True),
             fit=fit("coat", (40, 54, 72), (28, 30, 38), boot=(22, 22, 26), sole=(14, 14, 16), sleeves="long",
                     inner=(214, 216, 222), accent=(170, 30, 40), gloves=C(26, 26, 30)))
# ---------------------------------------------------------------- 1.5.2: prequel ("Second Shift", js/dlc_silas.js CAST) NPCs
# Night-shift Roanoke, early 90s. Same rig/shading as CAST; separate dict so main() (CAST/atlas loop) never rewrites them.
PREQUEL = {
    # Lou Badger - night newsstand (#7a5a3a): stocky older man, bald crown w/ grey fringe, big grey mustache,
    # brown shawl cardigan over a cream shirt, charcoal slacks, folded evening paper
    "lou": dict(skin="brown", build=(1.1, 0.96), anchor_x=72.0, prop="newspaper", hold=True,   # anchor_x 72: kick frame stays inside 144
                head=dict(hair="bald", hair_col="grey", facial="mustache", facial_col="grey", brow_col="grey", brow_w=2.0, age=True),
                fit=fit("jacket", (122, 90, 58), (62, 62, 68), boot=(70, 46, 30), sleeves="long", untucked=True,
                        inner=(232, 222, 196), accent=None, cardigan=True)),
    # Gus Pell - night dock clerk (#b7950b): lanky young guy, new on nights; shaggy grunge-era blond hair + stubble, mustard canvas
    # work jacket w/ reflective band + cord collar, oxblood flannel, navy work pants, tan boots, red rail lantern
    "gus": dict(skin="peach", build=(0.92, 1.04), prop="lantern", hold=False,
                head=dict(hair="long", hair_col="blond", facial="stubble", facial_col="brown", brow_col="brown"),
                fit=fit("jacket", (183, 149, 11), (44, 52, 74), boot=(150, 108, 62), sleeves="long", untucked=True,
                        inner=(140, 36, 40), accent=(214, 222, 226))),
    # Ivy Marsh - bike courier (#2e86c1): athletic young woman, dark ponytail under a white-and-blue vented helmet,
    # royal-blue pullover, black cycling tights, gloves, red messenger bag, clipboard of rail paperwork
    "ivy": dict(skin="deep", build=(0.9, 0.98), prop="clipboard", hold=True,
                head=dict(hair="ponytail", hair_col="black", hat="helmet", hat_rgb=(236, 238, 240), hat_stripe=C(46, 134, 193),
                          lashes=True, lip=C(150, 74, 78), earring=C(236, 210, 110)),
                fit=fit("hoodie", (46, 134, 193), (30, 30, 36), boot=(236, 236, 230), sole=(46, 134, 193), untucked=True,
                        sleeves="long", accent=(236, 236, 230), hem="rib", shoe="sneaker", nostar=True,
                        gloves=C(30, 30, 34), bag=C(196, 54, 44))),
    # Pip - courier kid (#27ae60): ~12, small; white ball cap w/ green logo, green track jacket w/ white stripes
    # over a white tee, cuffed jeans, white high-tops, brown-paper parcel
    "pip": dict(skin="olive", build=(0.82, 0.8), prop="parcel", hold=True,
                head=dict(hair="short", hair_col="brown", hat="cap", hat_rgb=(240, 240, 234), hat_logo=C(39, 174, 96), blush=True),
                fit=fit("jacket", (39, 174, 96), (70, 100, 150), boot=(240, 240, 234), sole=(39, 174, 96), untucked=True,
                        sleeves="long", track=True, inner=(244, 244, 240), accent=(244, 244, 240), shoe="sneaker", hem="rib")),
}
PREQUEL_KEYS = list(PREQUEL)

THUGS = {
    "thug_purple": dict(skin="tan", build=(1.02, 1.0), head=dict(hair="mohawk", hair_col="black", mohawk_rgb=(142, 68, 173), facial="stubble", brow_angry=True, earring=C(220, 220, 230)),
                        fit=fit("tee", (142, 68, 173), (40, 40, 48), boot=(36, 30, 28), untucked=True, sleeves="none", graphic=None, tank=True)),
    "thug_red": dict(skin="fair", build=(1.06, 1.0), head=dict(hair="buzz", hair_col="brown", hat="bandana", hat_rgb=(192, 57, 43), facial="beard", facial_col="brown", brow_angry=True),
                     fit=fit("jacket", (60, 44, 40), (52, 60, 80), boot=(40, 30, 26), untucked=True, sleeves="none", inner=(192, 57, 43), accent=None, vest=True)),
    "thug_teal": dict(skin="brown", build=(1.0, 1.0), head=dict(hair="buzz", hair_col="black", hat="beanie", hat_rgb=(22, 160, 133), facial="mustache", brow_angry=True),
                      fit=fit("hoodie", (22, 160, 133), (44, 46, 54), boot=(30, 30, 34), sole=(220, 220, 214), untucked=True, sleeves="long",
                              accent=(240, 240, 236), hem="rib", shoe="sneaker", nostar=True)),
    "thug_orange": dict(skin="olive", build=(1.1, 1.02), head=dict(hair="bald", hair_col="black", facial="goatee", brow_angry=True, scar=True),
                        fit=fit("tee", (211, 84, 0), (70, 74, 60), boot=(60, 44, 30), untucked=True, sleeves="none", tank=True)),
    "thug_grey": dict(skin="deep", build=(1.0, 1.0), head=dict(hair="buzz", hair_col="black", hat="cap", hat_rgb=(127, 140, 141), facial="stubble", brow_angry=True),
                      fit=fit("jacket", (127, 140, 141), (40, 42, 50), boot=(30, 30, 34), untucked=True, sleeves="long", inner=(30, 30, 34), accent=None, bomber=True)),
}

# ---------------------------------------------------------------- rendering
def setup(ch):
    g.OUTFITS["_cast"] = ch["fit"]
    g.set_outfit("_cast")
    PAL["skin"] = dict(SKINS[ch["skin"]])
    g.HEAD_FN[0] = make_head(ch["head"])

def render(ch, P, prop=None):
    kx, ky = ch.get("build", (1, 1))
    cv = Canvas(FW, FH, xf=None if (kx, ky) == (1, 1) else (kx, ky, ch.get("anchor_x", 68.0), 189.0))
    render_figure(cv, P)
    if ch["fit"].get("splatter") or ch["fit"].get("bag"):
        draw_overlay(cv, P, ch["fit"])
    if prop:
        draw_prop(cv, prop, P)
    return finish(cv)

def npc_still(ch):
    setup(ch)
    P = dict(NPC_IDLE)
    if ch.get("hold"):
        P.update(HOLD)
    if ch.get("prop") == "skateboard":
        P.update(near_el=(-15, -20), near_fist=(-10, -6), open_near=False)
    return render(ch, P, ch.get("prop"))

def fight_sheet(ch):
    setup(ch)
    sheet = Image.new("RGBA", (FW*8, FH), (0, 0, 0, 0))
    frames = []
    for i, P in enumerate(POSES):
        f = render(ch, P); frames.append(f); sheet.paste(f, (i*FW, 0))
    return sheet, frames

def build_atlas(stills_and_sheets):
    """664x768: 88px gutter (id + name) then 9 columns of 64x96, one row per NPC
    (tools/asset_meta.json NPC_ORDER). Columns: idle, idle-bob, walk x4, idle, punch x2."""
    meta_order = ["dee", "priya", "hank", "silas", "june", "tessa", "coach", "cam"]
    names = {"dee": "Dee Morales", "priya": "Priya Shah", "hank": "Hank Rail", "silas": "Silas Boone",
             "june": "June Whitaker", "tessa": "Tessa Quinn", "coach": "Coach Ray", "cam": "Cam Ortiz"}
    at = Image.new("RGBA", (664, 768), (0, 0, 0, 0))
    d = ImageDraw.Draw(at)
    d.rectangle([0, 0, 87, 767], fill=(34, 38, 48, 255))
    try:
        fb = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 13)
        fs = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 9)
    except Exception:
        fb = fs = ImageFont.load_default()
    for r, nid in enumerate(meta_order):
        frames = stills_and_sheets[nid]           # list of 8 frames (144x192)
        d.text((6, r*96 + 8), nid, fill=(255, 210, 74, 255), font=fb)
        d.text((6, r*96 + 28), names[nid], fill=(232, 220, 196, 255), font=fs)
        cols = [0, 1, 2, 3, 2, 3, 0, 4, 5]
        for c, fi in enumerate(cols):
            fr = frames[fi].resize((64, 85), Image.LANCZOS)
            a = fr.getchannel("A").point(lambda v: 255 if v >= 128 else 0); fr.putalpha(a)
            at.alpha_composite(fr, (88 + c*64, r*96 + 96 - 85 - 1))
    return at

def silas_only(out=SPR):
    st = npc_still(SILAS); st.save(os.path.join(out, "silas.png"))
    sheet, frames = fight_sheet(SILAS); sheet.save(os.path.join(out, "silas_sheet.png"))
    return st, frames

def atlas_from_disk(out=SPR):
    """Rebuild npcs.png from the already-written <npc>.png stills + <npc>_sheet.png sheets."""
    fr = {}
    for nid in list(CAST) + ["silas"]:
        sh = Image.open(os.path.join(out, nid + "_sheet.png"))
        frames = [sh.crop((i*FW, 0, i*FW + FW, FH)) for i in range(8)]
        frames[0] = Image.open(os.path.join(out, nid + ".png")).convert("RGBA")
        fr[nid] = frames
    build_atlas(fr).save(os.path.join(out, "npcs.png"))

def main(out=SPR):
    os.makedirs(out, exist_ok=True)
    atlas_frames = {}
    for nid, ch in CAST.items():
        st = npc_still(ch); st.save(os.path.join(out, nid + ".png"))
        sheet, frames = fight_sheet(dict(ch, prop=None))
        sheet.save(os.path.join(out, nid + "_sheet.png"))   # 8-pose sheet for future NPC animation
        frames[0] = st                               # atlas idle = the still (with prop)
        atlas_frames[nid] = frames
        print("npc", nid)
    # Silas: NPC still (relaxed, gloved) + boss fight sheet
    st = npc_still(SILAS); st.save(os.path.join(out, "silas.png"))
    sheet, frames = fight_sheet(SILAS); sheet.save(os.path.join(out, "silas_sheet.png"))
    atlas_frames["silas"] = [st] + frames[1:]
    print("boss silas")
    for tid, ch in THUGS.items():
        sheet, frames = fight_sheet(ch)
        sheet.save(os.path.join(out, tid + "_sheet.png"))
        frames[0].save(os.path.join(out, tid + ".png"))
        print("thug", tid)
    write_wren(out)                                  # not in the npcs.png atlas (layout is fixed)
    build_atlas(atlas_frames).save(os.path.join(out, "npcs.png"))
    g.HEAD_FN[0] = g.head_parts
    g.set_outfit("polo")
    print("wrote", out)

def write_wren(out=SPR):
    npc_still(WREN).save(os.path.join(out, "wren.png"))
    fight_sheet(dict(WREN, prop=None))[0].save(os.path.join(out, "wren_sheet.png"))
    g.HEAD_FN[0] = g.head_parts; g.set_outfit("polo")
    print("npc wren")

def write_prequel(out=SPR, keys=None):
    """1.5.2: prequel NPCs only (<key>.png still + <key>_sheet.png 8-pose). Touches no other file (not in npcs.png atlas)."""
    for k in (keys or PREQUEL_KEYS):
        ch = PREQUEL[k]
        npc_still(ch).save(os.path.join(out, k + ".png"))
        fight_sheet(dict(ch, prop=None))[0].save(os.path.join(out, k + "_sheet.png"))
        print("npc", k)
    g.HEAD_FN[0] = g.head_parts; g.set_outfit("polo")

if __name__ == "__main__":
    # usage: gen_cast.py [outdir] [--atlas-only]
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    out = args[0] if args else SPR
    if "--wren" in sys.argv:          # new NPC only (doesn't touch other cast files)
        write_wren(out)
    elif "--prequel" in sys.argv:     # 1.5.2: lou/gus/ivy/pip only (doesn't touch other cast files)
        write_prequel(out)
    elif "--atlas-only" in sys.argv:
        atlas_from_disk(out)
    else:
        main(out)
