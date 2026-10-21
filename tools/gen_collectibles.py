#!/usr/bin/env python3
"""Star City Drift 2D - collectible item sprites.

Writes assets/sprites/collectibles.png (one row per item, 6 columns of 48x48, transparent, hard alpha)
and assets/sprites/collectibles.json {id: {row, frames, fw, fh, fps, name, names}}.
Same cartoon style as the character rig (gen_matthew_v2.Part: dark ink, cel shading steps, warm gold rim).
Idle loop: gentle vertical bob (+-2 px) with a glint sparkle sweeping across on frames 2-3.
Ids/names follow js/missions.js `collectibles` (read-only source of truth).
usage: python3 tools/gen_collectibles.py
"""
import json, math, os, sys
from PIL import Image, ImageChops, ImageDraw
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import gen_matthew_v2 as g
from gen_matthew_v2 import C, Part, Canvas, ramp, ellipse_pts, star_pts, add, rot, lerp, finish

SPR = g.SPR
CW = CH = 48
NF = 6
FPS = 8
BOB = [0, -1, -2, -1, 0, 1]          # px, per frame (+-2 overall range)
GLINT = {2: 0.3, 3: 0.75}             # frame -> sweep position 0..1

def P(cv, polys, pal, **kw):
    kw.setdefault("shade", (1.6, 1.2)); kw.setdefault("hi", (0.8, -0.8)); kw.setdefault("rim", 0.8); kw.setdefault("ink", 0.6)
    return Part(cv, polys, pal, **kw)

def R(pts, c, a): return [add(c, rot(q, a)) for q in pts]
def rrect(x0, y0, x1, y1, r=2.0, n=4):
    pts = []
    for cx, cy, a0 in ((x1 - r, y0 + r, -90), (x1 - r, y1 - r, 0), (x0 + r, y1 - r, 90), (x0 + r, y0 + r, 180)):
        for i in range(n + 1):
            a = math.radians(a0 + 90 * i / n); pts.append((cx + r * math.cos(a), cy + r * math.sin(a)))
    return pts

GOLD = ramp((236, 186, 60)); BRASS = ramp((206, 160, 72)); WHITE = ramp((246, 244, 236)); INK = C(30, 18, 16)
STAR_GOLD = C(255, 214, 80)

# ------------------------------------------------------------------ items
def glasses(cv):
    fr = ramp((44, 40, 46))
    for cx in (15.5, 32.5):
        P(cv, [ellipse_pts((cx, 25), 8.6, 7.0, n=24)], fr, shade=(1, 1)).commit()
        l = P(cv, [ellipse_pts((cx, 25), 6.6, 5.0, n=22)], ramp((170, 214, 236)), shade=(1.4, 1.0), rim=0, ink=0)
        l.line([(cx - 3.5, 23.2), (cx - 0.5, 21.4)], C(250, 252, 255), 0.9); l.commit()
    P(cv, [[(22, 23), (26, 23), (26, 25), (22, 25)]], fr, ink=0.5).commit()                      # bridge
    P(cv, [[(5.5, 22), (7.2, 21.6), (5.0, 33), (3.4, 33)], [(40.8, 21.6), (42.5, 22), (44.6, 33), (43, 33)]], fr, ink=0.5).commit()

def bottle(cv):
    b = P(cv, [rrect(16, 13, 32, 43, 4)], ramp((120, 190, 230)))
    b.poly(rrect(16, 22, 32, 33, 0.5), C(250, 250, 246)); b.line([(16, 22), (32, 22)], C(40, 110, 170), 0.6); b.line([(16, 33), (32, 33)], C(40, 110, 170), 0.6)
    b.poly(star_pts((24, 27.5), 3.6, 0), C(46, 120, 190))
    b.line([(19.5, 15.5), (19.5, 40)], C(220, 244, 255), 1.0); b.commit()
    c = P(cv, [rrect(18.5, 5, 29.5, 13.5, 1.6)], ramp((40, 110, 180)))
    for x in (21, 24, 27): c.line([(x, 6.5), (x, 12.5)], C(28, 80, 140), 0.5)
    c.commit()

def _flat_top(cv, pal, body, sleeves, hood=None):
    """flat-laid garment: sleeves first, then body."""
    P(cv, sleeves, pal, shade=(1.8, 1.4)).commit()
    return P(cv, [body], pal, shade=(2.2, 1.6))

def hoodie(cv):
    pal = ramp((44, 74, 122))
    hd = P(cv, [[(16, 12), (20, 5.5), (28, 5.5), (32, 12), (28, 14), (20, 14)]], {k: g.mix(v, (0, 0, 0), 0.15) for k, v in pal.items()})
    hd.commit()
    b = _flat_top(cv, pal, [(13, 12), (35, 12), (37, 42), (11, 42)],
                  [[(13, 12), (5, 34), (9.5, 36), (16, 20)], [(35, 12), (43, 34), (38.5, 36), (32, 20)]])
    b.poly([(16, 29), (32, 29), (33.5, 38), (14.5, 38)], pal["sh"])                       # kangaroo pocket
    b.poly([(11, 39.5), (37, 39.5), (37, 42), (11, 42)], pal["dk"])                       # rib hem
    b.line([(21, 13), (20.4, 22)], C(236, 232, 222), 0.6); b.line([(27, 13), (27.6, 22)], C(236, 232, 222), 0.6)
    b.poly(star_pts((24, 20.5), 5.4, 0), C(60, 34, 14)); b.poly(star_pts((24, 20.5), 4.4, 0), STAR_GOLD)
    b.commit()

def jacket(cv):
    pal = ramp((70, 86, 64)); acc = C(226, 108, 46)
    b = _flat_top(cv, pal, [(13, 9), (35, 9), (36.5, 41), (11.5, 41)],
                  [[(13, 9), (4.5, 36), (9.5, 38), (16, 18)], [(35, 9), (43.5, 36), (38.5, 38), (32, 18)]])
    b.poly([(19, 9), (29, 9), (24, 17)], C(240, 236, 226))                                  # cream collar lining
    b.line([(19, 9), (24, 17), (29, 9)], pal["dk"], 0.7)
    b.line([(24, 17), (24, 41)], C(40, 46, 36), 0.8)                                        # zip
    b.poly([(11.8, 28), (36.2, 28), (36.4, 31.6), (11.6, 31.6)], acc)                     # hi-vis band
    b.line([(11.8, 29.8), (36.2, 29.8)], C(214, 218, 222), 0.5)
    b.poly([(15, 17), (21, 17), (21, 22), (15, 22)], pal["sh"]); b.poly([(27, 17), (33, 17), (33, 22), (27, 22)], pal["sh"])
    b.commit()
    s = P(cv, [[(7.2, 27.5), (11, 28.6), (9.8, 32), (6, 30.8)], [(40.8, 27.5), (37, 28.6), (38.2, 32), (42, 30.8)]], ramp((226, 108, 46)), ink=0.4)
    s.commit()

def street(cv):
    jp = ramp((90, 122, 170))
    j = P(cv, [rrect(7, 28, 41, 42, 2.5)], jp)                                           # folded jeans
    j.line([(7.5, 35), (40.5, 35)], jp["dk"], 0.6); j.line([(33, 28.5), (33, 41.5)], jp["sh"], 0.6)
    j.line([(9.5, 30.5), (30, 30.5)], C(236, 196, 120), 0.5); j.line([(9.5, 39.5), (30, 39.5)], C(236, 196, 120), 0.5)
    j.commit()
    tp = ramp((34, 32, 36), sh=0.7, dk=0.45, hi=(80, 78, 86))
    t = P(cv, [rrect(9, 10, 39, 30, 2.5)], tp)                                            # folded black tee
    t.poly([(18, 10), (30, 10), (27.5, 13.5), (20.5, 13.5)], C(60, 58, 64))               # crew neck
    t.line([(9.5, 16), (13, 16)], tp["hi"], 0.5); t.line([(35, 16), (38.5, 16)], tp["hi"], 0.5)
    t.poly(star_pts((24, 21.5), 6.0, 0), C(120, 20, 20)); t.poly(star_pts((24, 21.5), 5.0, 0), C(232, 62, 62))
    t.commit()

def notebook(cv):
    a = -8; c = (25, 25)
    b = P(cv, [R(rrect(-12, -16, 13, 17, 1.5), c, a)], ramp((46, 124, 120)))
    b.poly(R([(-7, -9), (9, -9), (9, -2), (-7, -2)], c, a), C(246, 240, 220))
    for y in (-7, -4.5): b.line(R([(-5, y), (7, y)], c, a), C(150, 140, 120), 0.5)
    b.line(R([(13, -16), (13, 17)], c, a), C(240, 236, 220), 0.9)                       # page edge
    b.commit()
    for k in range(7):
        y = -13 + k * 4.6
        P(cv, [ellipse_pts(add(c, rot((-12, y), a)), 2.4, 1.3, n=10)], ramp((200, 200, 206)), shade=(0.6, 0.6), hi=None, rim=0, ink=0.45).commit()

def photo(cv):
    a = 6; c = (24, 24)
    f = P(cv, [R(rrect(-14.5, -17, 14.5, 18, 1.2), c, a)], WHITE, shade=(1.6, 1.2))
    f.poly(R([(-12, -15), (12, -15), (12, 9), (-12, 9)], c, a), C(150, 196, 226))           # picture: sky/board
    f.poly(R([(-12, 2), (12, 2), (12, 9), (-12, 9)], c, a), C(120, 150, 110))               # floor/grass
    f.poly(R([(-7, 9), (-6, 1), (-2, -2), (2, -2), (6, 1), (7, 9)], c, a), C(200, 70, 60))   # generic figure: shirt
    f.dot(add(c, rot((0, -6), a)), 3.6, C(232, 190, 150))                                     # head
    f.poly(R([(-3.6, -8), (3.6, -8), (3.2, -10.2), (-3.2, -10.2)], c, a), C(70, 50, 40))    # hair
    f.line(R([(-15, 13), (15, 13)], c, a), C(220, 216, 204), 0.5)
    f.commit()

def flyer(cv):
    a = -6; c = (24, 25)
    f = P(cv, [R([(-14, -17), (14, -17), (15, 17), (-13, 18)], c, a)], ramp((255, 236, 200)))
    f.poly(R([(-11, -14), (11, -14), (11, -9), (-11, -9)], c, a), C(226, 90, 120))          # header band
    for y in (-12.6, -10.6): f.line(R([(-8, y), (8, y)], c, a), C(255, 240, 240), 0.5)
    f.poly(R([(-6, 4), (6, 4), (4.5, 12), (-4.5, 12)], c, a), C(200, 140, 80))              # cupcake case
    f.dot(add(c, rot((0, 1.5), a)), 6.0, C(250, 170, 200))                                    # frosting
    f.dot(add(c, rot((0, -4.5), a)), 1.8, C(220, 40, 60))                                     # cherry
    for y in (-5, -2.6): f.line(R([(-9, y), (9, y)], c, a), C(150, 120, 100), 0.5)
    f.commit()
    P(cv, [ellipse_pts(add(c, rot((0, -17), a)), 2.4, 2.4, n=12)], ramp((220, 50, 50)), shade=(0.6, 0.6), ink=0.5).commit()   # push pin

def token(cv):
    c = (24, 25)
    b = P(cv, [ellipse_pts(c, 16, 16, n=36)], BRASS, shade=(2.2, 1.8), hi=(1.1, -1.1))
    b.poly(ellipse_pts(c, 12.6, 12.6, n=32), C(186, 140, 58)); b.poly(ellipse_pts(c, 11.8, 11.8, n=32), C(214, 170, 82))
    for k in range(24):
        q = rot((14.4, 0), k * 15); b.dot(add(c, q), 0.55, C(150, 110, 44))
    dk = C(110, 74, 30)                                                                      # trolley silhouette
    b.poly([(14.5, 21), (33.5, 21), (34.5, 23), (34.5, 30), (13.5, 30), (13.5, 23)], dk)
    b.poly([(16, 19.4), (32, 19.4), (33, 21), (15, 21)], dk)
    for x in (16, 20.5, 25, 29.5): b.poly([(x, 23), (x + 3, 23), (x + 3, 26), (x, 26)], C(236, 200, 120))
    b.dot((18, 31), 1.6, dk); b.dot((30, 31), 1.6, dk)
    b.line([(24, 19.4), (27, 14), (31, 14)], dk, 0.6)                                       # trolley pole
    b.line([(17, 15), (21, 13)], C(255, 240, 190), 0.8)
    b.commit()

def bookmark(cv):
    a = 10; c = (24, 22)
    b = P(cv, [R([(-6.5, -18), (6.5, -18), (6.5, 16), (0, 11), (-6.5, 16)], c, a)], ramp((126, 52, 160)))
    b.poly(R([(-4.6, -16), (4.6, -16), (4.6, 10.5), (0, 7), (-4.6, 10.5)], c, a), C(150, 74, 186))
    b.poly(R(star_pts((0, -8), 4.2, 0), c, a), STAR_GOLD)
    b.poly(R([(-3.2, 0), (0, -1.4), (3.2, 0), (3.2, 4.6), (0, 3.2), (-3.2, 4.6)], c, a), C(246, 240, 220))   # open-book icon
    b.line(R([(0, -1.4), (0, 3.2)], c, a), C(126, 52, 160), 0.4)
    b.commit()
    top = add(c, rot((0, -18), a))
    P(cv, [[top, add(top, (-6, 4)), add(top, (-7.6, 12)), add(top, (-5, 12.4)), add(top, (-4.4, 5))]], GOLD, shade=(0.8, 0.8), ink=0.45).commit()  # tassel

def wax(cv):
    side = ramp((150, 206, 232))
    s = P(cv, [[(8, 22), (40, 22), (40, 33), (8, 33)] + ellipse_pts((24, 33), 16, 7, n=28)[0:15]], side)
    s.commit()
    s = P(cv, [ellipse_pts((24, 33), 16, 7, n=28)], side); s.commit()
    P(cv, [[(8, 22), (40, 22), (40, 33), (8, 33)]], side, rim=0).commit()
    t = P(cv, [ellipse_pts((24, 22), 16, 7, n=28)], ramp((236, 246, 250)), shade=(1.2, 0.8))
    t.poly(ellipse_pts((24, 22), 10, 4.2, n=24), C(240, 120, 60))
    t.poly([(add((24, 22), (x, y))) for x, y in star_pts((0, 0), 3.4, 0)], STAR_GOLD)
    t.commit()
    m = P(cv, [[(8, 25.5), (40, 25.5), (40, 29.5), (8, 29.5)]], ramp((240, 120, 60)), ink=0, rim=0, shade=(0.8, 0.6))
    m.commit()

def webmask(cv):
    cr = ramp((176, 28, 44)); bl = C(36, 56, 150); gd = C(240, 190, 60); lat = C(92, 10, 24)
    m = P(cv, [[(24, 5), (34, 8), (38.5, 18), (37, 30), (31, 39), (24, 42), (17, 39), (11, 30), (9.5, 18), (14, 8)]], cr, shade=(2.2, 1.6))
    for k in range(-5, 6):
        x = 24 + k * 4.2
        m.line([(x - 8, 4), (x + 8, 44)], lat, 0.45); m.line([(x + 8, 4), (x - 8, 44)], lat, 0.45)
    m.poly([(9.5, 18), (14, 8), (17, 12), (14.5, 20), (16.5, 28), (13.5, 36), (11, 30)], bl)       # blue side panels (zig-zag)
    m.poly([(38.5, 18), (34, 8), (31, 12), (33.5, 20), (31.5, 28), (34.5, 36), (37, 30)], bl)
    for side in (1, -1):                                                                              # angular gold visor eyes
        q = lambda x, y: (24 + side * x, y)
        m.poly([q(2.4, 18), q(12.6, 15.2), q(11.6, 22), q(5, 23.6)], C(40, 16, 18))
        m.poly([q(3.6, 18.8), q(11.4, 16.6), q(10.6, 21), q(5.4, 22.4)], gd)
        m.line([q(5.4, 19.4), q(9.6, 18.2)], C(255, 244, 190), 0.5)
    m.commit()

def coveralls(cv):
    pal = ramp((40, 52, 86)); acc = C(240, 120, 40)
    P(cv, [[(14, 8), (6, 26), (10, 28.5), (16, 17)], [(34, 8), (42, 26), (38, 28.5), (32, 17)]], pal, shade=(1.6, 1.2)).commit()
    b = P(cv, [[(14, 8), (34, 8), (34.6, 26), (33, 44), (25.4, 44), (24, 30), (22.6, 44), (15, 44), (13.4, 26)]], pal, shade=(2.2, 1.6))
    b.poly([(18.5, 8), (29.5, 8), (27.5, 13), (24, 11.4), (20.5, 13)], C(30, 40, 70))               # collar
    b.line([(24, 11.4), (24, 28)], C(150, 160, 180), 0.6)                                             # zip
    b.poly([(13.6, 20), (34.4, 20), (34.5, 23), (13.5, 23)], acc)                                     # chest hi-vis band
    b.poly([(15.2, 36), (23, 36), (22.9, 39), (15.1, 39)], acc); b.poly([(25, 36), (32.9, 36), (32.6, 39), (25.1, 39)], acc)
    b.line([(13.6, 21.5), (34.4, 21.5)], C(214, 218, 222), 0.45)
    b.poly([(14, 25.6), (34.3, 25.6), (34.3, 27.4), (14, 27.4)], pal["dk"])                         # waist tab
    b.commit()

def ticket(cv):
    a = -12; c = (24, 25)
    t = P(cv, [R([(-17, -9.5), (17, -9.5), (17, 9.5), (-17, 9.5)], c, a)], ramp((246, 226, 180)))
    t.poly(R([(-17, -9.5), (-7, -9.5), (-7, 9.5), (-17, 9.5)], c, a), C(200, 56, 52))                 # red stub end
    for k in range(7): t.dot(add(c, rot((-7, -8 + k * 2.7), a)), 0.7, C(170, 150, 110))               # perforation
    t.poly(R([(-1, -2), (11, -2), (12.5, 1), (12.5, 4), (-2, 4), (-2, 0)], c, a), C(60, 50, 44))        # train icon
    t.poly(R([(1, -5), (5, -5), (5, -2), (1, -2)], c, a), C(60, 50, 44))
    t.dot(add(c, rot((1.5, 5), a)), 1.3, C(60, 50, 44)); t.dot(add(c, rot((9.5, 5), a)), 1.3, C(60, 50, 44))
    t.line(R([(0, -6.5), (12, -6.5)], c, a), C(150, 120, 90), 0.5)
    t.poly(R(star_pts((-12, 0), 3.4, 0), c, a), C(255, 236, 170))
    t.commit()

def pin(cv):
    c = (24, 24)
    P(cv, [ellipse_pts((24, 40), 3.0, 1.6, n=12)], ramp((180, 180, 186)), shade=(0.6, 0.6), ink=0.45).commit()   # pin back
    s = P(cv, [star_pts(c, 17, 0)], GOLD, shade=(2.0, 1.6), hi=(1.0, -1.0))
    s.poly(star_pts(c, 9.5, 0), C(250, 210, 90))
    s.poly([(c[0] + x * 0.45, c[1] + y * 0.45) for x, y in [(-12, 4), (-4, -6), (0, -2), (4, -7), (12, 4)]], C(196, 140, 40))   # mountain
    s.line([(19, 15), (23, 9)], C(255, 246, 200), 0.9)
    s.commit()

def apron(cv):
    red = C(206, 40, 44)
    P(cv, [[(16, 5), (19, 4), (21, 14), (19, 14)], [(32, 5), (29, 4), (27, 14), (29, 14)]], ramp((206, 40, 44)), shade=(0.6, 0.6), ink=0.45).commit()  # neck strap
    a = P(cv, [[(17, 13), (31, 13), (31.5, 22), (39, 23), (37, 44), (11, 44), (9, 23), (16.5, 22)]], WHITE, shade=(2.0, 1.6))
    edge = [(17, 13), (31, 13), (31.5, 22), (39, 23), (37, 44), (11, 44), (9, 23), (16.5, 22), (17, 13)]
    a.line(edge, red, 1.1)
    a.poly([(17, 31), (31, 31), (30.5, 38), (17.5, 38)], C(230, 228, 220)); a.line([(17, 31), (31, 31)], red, 0.8)
    a.line([(24, 31), (24, 38)], C(200, 196, 188), 0.5)
    a.commit()
    P(cv, [[(9, 23), (3, 27), (4, 29.5), (9.5, 25.5)], [(39, 23), (45, 27), (44, 29.5), (38.5, 25.5)]], ramp((206, 40, 44)), shade=(0.6, 0.6), ink=0.45).commit()  # waist ties

def varsity(cv):
    body = ramp((122, 30, 44)); sl = ramp((238, 228, 204))
    P(cv, [[(13, 9), (4.5, 36), (9.5, 38), (16, 18)], [(35, 9), (43.5, 36), (38.5, 38), (32, 18)]], sl, shade=(1.8, 1.4)).commit()
    for x0, x1 in ((4.5, 9.5), (43.5, 38.5)):                                                     # striped cuffs
        P(cv, [[(x0 + (0.6 if x0 < 20 else -0.6), 33), (x1 + (0.4 if x0 < 20 else -0.4), 35), (x1, 38), (x0, 36)]], body, ink=0.4, rim=0).commit()
    b = P(cv, [[(13, 9), (35, 9), (36.5, 41), (11.5, 41)]], body, shade=(2.2, 1.6))
    b.poly([(19, 9), (29, 9), (24, 16)], C(246, 244, 238))                                        # white tee at the collar
    b.poly([(11.5, 37), (36.5, 37), (36.6, 41), (11.4, 41)], body["dk"])                          # rib hem
    b.line([(11.5, 38.6), (36.5, 38.6)], C(238, 228, 204), 0.6)
    for y in (20, 25, 30, 35): b.dot((24.6, y), 0.8, C(238, 228, 204))                            # snaps
    b.poly(star_pts((18, 22.5), 6.6, 0), C(60, 14, 20)); b.poly(star_pts((18, 22.5), 5.6, 0), C(238, 228, 204))
    b.poly(star_pts((18, 22.5), 2.6, 0), STAR_GOLD)
    b.commit()

def lantern(cv):
    red = ramp((176, 40, 36)); blk = ramp((40, 38, 42))
    P(cv, [[(14, 9), (24, 3), (34, 9), (32.5, 10), (24, 5.4), (15.5, 10)]], blk, shade=(0.6, 0.6), ink=0.45).commit()   # bail handle
    P(cv, [rrect(16, 9, 32, 15, 1.2)], red).commit()                                               # top cap
    gl = P(cv, [[(16.5, 15), (31.5, 15), (34, 26), (31.5, 36), (16.5, 36), (14, 26)]], ramp((255, 214, 110)), shade=(1.4, 1.0), rim=0)
    gl.poly(ellipse_pts((24, 26), 5.2, 6.4, n=20), C(255, 244, 196))                               # flame glow
    gl.poly(ellipse_pts((24, 27), 1.8, 3.4, n=12), C(255, 160, 60))
    gl.line([(18, 17), (16.5, 26)], C(255, 252, 230), 0.8)
    gl.commit()
    cage = P(cv, [[(18.6, 15), (20, 15), (20, 36), (18.6, 36)], [(28, 15), (29.4, 15), (29.4, 36), (28, 36)],
                  [(14.6, 25), (33.4, 25), (33.4, 26.6), (14.6, 26.6)]], blk, shade=(0.4, 0.4), hi=None, rim=0, ink=0.35)
    cage.commit()
    P(cv, [rrect(14, 36, 34, 43, 1.4)], red).commit()                                              # base

def beaconring(cv):
    halo = C(150, 255, 170); mid = C(70, 230, 120); core = C(232, 255, 236)
    band = P(cv, [ellipse_pts((24, 31), 14, 10, n=36)], ramp((44, 46, 52)), shade=(1.6, 1.2), hi=(0.8, -0.8))
    band.poly(ellipse_pts((24, 32), 9.6, 6.4, n=32), (0, 0, 0, 0))
    band.commit()
    # cut the band's hole (transparent) - redraw inner as empty
    hole = cv.mask([ellipse_pts((24, 32.4), 9.4, 6.0, n=32)])
    a = cv.img.getchannel("A"); a = ImageChops.subtract(a, hole); cv.img.putalpha(a)
    P(cv, [[(14, 22), (34, 22), (32, 25), (16, 25)]], ramp((232, 184, 52)), shade=(0.8, 0.6), ink=0.45).commit()   # gold setting
    gem = P(cv, [star_pts((24, 15), 11.4, 0)], dict(base=halo, sh=halo, dk=mid, hi=core), shade=(0, 0), hi=None, rim=0, ink=0)
    gem.commit()                                                                                    # glow band (hard alpha)
    g2 = P(cv, [star_pts((24, 15), 9.0, 0)], ramp((40, 200, 100)), shade=(1.0, 0.8), hi=(0.6, -0.6), rim=0, ink=0.6)
    g2.poly(star_pts((24, 15), 5.0, 0), mid); g2.poly(star_pts((23.4, 14.2), 2.2, 0), core)
    g2.commit()

def ironclad(cv):
    """'Hell's Nightmare' (key ironclad) v2 helmet: angular olive-green shell, wide gold visor, grey boxy slatted jaw,
    scuffs + scorch. No red glow."""
    pl = ramp((82, 98, 48), sh=0.7, dk=0.48, hi=(124, 142, 78)); gun = ramp((96, 98, 104))
    h = P(cv, [[(16.8, 8.9), (31.2, 8.9), (35.7, 10.7), (38.85, 15.2), (39.75, 22.4), (39.75, 32.3), (37.95, 37.7), (33, 42.65), (24, 44), (15, 42.65), (10.05, 37.7), (8.25, 32.3), (8.25, 22.4), (9.15, 15.2), (12.3, 10.7)]],
          pl, shade=(2.2, 1.6))
    h.poly([(16.8, 8.9), (31.2, 8.9), (35.7, 10.7), (37.05, 12.86), (31.2, 12.14), (16.8, 12.14), (10.95, 12.86), (12.3, 10.7)], pl["hi"])     # flat crown bevel
    h.poly([(8.34, 26.9), (11.04, 26.9), (11.04, 34.1), (8.52, 34.1)], gun["base"]); h.poly([(36.96, 26.9), (39.66, 26.9), (39.48, 34.1), (36.96, 34.1)], gun["base"])
    h.poly([(15.45, 32.3), (32.55, 32.3), (33.9, 35), (32.55, 40.4), (28.5, 43.1), (19.5, 43.1), (15.45, 40.4), (14.1, 35)], gun["base"])  # boxy jaw
    h.poly([(15.45, 32.3), (32.55, 32.3), (33.18, 33.92), (14.82, 33.92)], gun["sh"])
    for y in (35.2, 37.8, 40.2): h.line([(18, y), (30, y)], gun["dk"], 0.55)
    h.poly([(9.06, 19.7), (15, 18.26), (24, 17.9), (33, 18.26), (38.94, 19.7), (39.12, 30.5), (33, 31.76), (24, 31.94), (15, 31.76), (8.88, 30.5)], C(40, 26, 12))
    h.poly([(10.32, 20.96), (15, 19.7), (24, 19.34), (33, 19.7), (37.68, 20.96), (37.86, 29.24), (33, 30.32), (24, 30.5), (15, 30.32), (10.14, 29.24)], C(212, 150, 38))
    h.poly([(11.4, 21.86), (24, 20.6), (36.6, 21.86), (36.6, 24.74), (24, 24.38), (11.4, 24.74)], C(250, 202, 76))
    h.poly([(10.32, 27.44), (24, 27.8), (37.68, 27.44), (37.86, 29.24), (33, 30.32), (24, 30.5), (15, 30.32), (10.14, 29.24)], C(170, 112, 30))
    h.line([(13.2, 22.94), (24, 22.04), (34.8, 22.94)], C(255, 244, 196), 0.6)
    h.line([(14.1, 13.94), (17.7, 15.56)], C(150, 160, 120), 0.5); h.line([(30.3, 34.55), (33, 36.8)], C(160, 162, 168), 0.45)
    h.poly([(32.1, 13.4), (35.7, 14.84), (34.8, 17.36), (31.56, 16.1)], C(30, 30, 22))
    h.commit()

ITEMS = [  # (id, name from js/missions.js, drawer)
    ("glasses", "Glasses", glasses),
    ("bottle", "Water Bottle", bottle),
    ("hoodie", "Star City Hoodie", hoodie),
    ("jacket", "Rail Yard Jacket", jacket),
    ("street", "Skate Fit", street),
    ("notebook", "Notebook", notebook),
    ("photo", "Classroom Photo", photo),
    ("flyer", "Bake-Sale Flyer", flyer),
    ("token", "Old Trolley Token", token),
    ("bookmark", "Valley Pages Bookmark", bookmark),
    ("wax", "Starboard Board Wax", wax),
    ("webmask", "Web-Slinger Mask (top of the half-pipe)", webmask),
    ("coveralls", "Rail Yard Coveralls", coveralls),
    ("ticket", "Excursion Train Ticket Stub", ticket),
    ("pin", "Mill Mountain Star Pin", pin),
    ("apron", "Dee's Spare Apron", apron),
    ("varsity", "Valley Gym Varsity Jacket", varsity),
    ("lantern", "Night Shift Lantern", lantern),
    ("beaconring", "Beacon Ring (under the Mill Mountain Star)", beaconring),
    # appended rows (never reorder above: rows are referenced by index)
    ("ironclad", "Hell's Nightmare", ironclad),
]
ALT_NAMES = {"wax": ["Board Wax"], "webmask": ["Web-Slinger Mask", "Webslinger Mask"], "coveralls": ["Coveralls"],
             "varsity": ["Varsity Jacket"], "beaconring": ["Beacon Ring"], "street": ["Skate Outfit"], "bottle": ["Bottle"],
             "token": ["Trolley Token"], "ticket": ["Ticket Stub", "Train Ticket"], "pin": ["Star Pin"], "apron": ["Apron"],
             "lantern": ["Lantern"], "ironclad": ["ironcrate", "Hell's Nightmare Armor Crate", "Hell's Nightmare Helmet", "Ironclad", "Ironclad Helmet", "Star City Ironclad"], "flyer": ["Flyer"], "photo": ["Photo"], "bookmark": ["Bookmark"], "hoodie": ["Hoodie"]}

def render_item(fn):
    cv = Canvas(CW, CH)
    fn(cv)
    im = finish(cv, outline=1)
    bb = im.getchannel("A").getbbox()               # centre horizontally, sit item so its bottom is at row 44
    out = Image.new("RGBA", (CW, CH), (0, 0, 0, 0))
    out.paste(im, (int(round(24 - (bb[0] + bb[2]) / 2)), 44 - bb[3]), im)
    return out

def glint(base, k):
    """white diagonal band clipped to the item + a 4-point sparkle at the band's top."""
    a = base.getchannel("A")
    bb = a.getbbox(); x0, x1 = bb[0] - 10, bb[2] + 4
    cx = x0 + (x1 - x0) * k
    band = Image.new("L", base.size, 0); d = ImageDraw.Draw(band)
    d.polygon([(cx, bb[1] - 2), (cx + 3, bb[1] - 2), (cx - 7, bb[3] + 2), (cx - 10, bb[3] + 2)], fill=150)
    band = ImageChops.multiply(band, a)
    out = base.copy()
    white = Image.new("RGBA", base.size, (255, 252, 236, 255))
    out = Image.composite(Image.blend(out, white, 0.65), out, band.point(lambda v: 255 if v > 60 else 0))
    sx = int(min(max(cx + 1, 5), 42)); sy = int(max(bb[1] + 2, 6))
    sp = ImageDraw.Draw(out)
    for (dx, dy, L) in ((1, 0, 3), (-1, 0, 3), (0, 1, 3), (0, -1, 3)):
        sp.line([(sx, sy), (sx + dx * L, sy + dy * L)], fill=(255, 255, 255, 255))
    sp.point([(sx + 1, sy + 1), (sx - 1, sy - 1), (sx + 1, sy - 1), (sx - 1, sy + 1)], fill=(255, 236, 160, 255))
    return out

def build():
    atlas = Image.new("RGBA", (CW * NF, CH * len(ITEMS)), (0, 0, 0, 0))
    man = {}
    for row, (iid, name, fn) in enumerate(ITEMS):
        base = render_item(fn)
        for f in range(NF):
            fr = glint(base, GLINT[f]) if f in GLINT else base
            atlas.paste(fr, (f * CW, row * CH + BOB[f]), fr)
        man[iid] = dict(row=row, frames=NF, fw=CW, fh=CH, fps=FPS, name=name, names=[name] + ALT_NAMES.get(iid, []))
        print("item", iid)
    # hard alpha guarantee
    r, gg, b, a = atlas.split(); atlas = Image.merge("RGBA", (r, gg, b, a.point(lambda v: 255 if v >= 128 else 0)))
    atlas.save(os.path.join(SPR, "collectibles.png"))
    out = dict(_meta=dict(version=1, file="assets/sprites/collectibles.png", cols=NF, anchorX=24, anchorY=47,
                          note="frame f of item = (f*fw, row*fh); bob +-2px and glint (frames 2-3) are baked in"))
    out.update(man)
    json.dump(out, open(os.path.join(SPR, "collectibles.json"), "w"), indent=1)
    print("wrote collectibles.png", atlas.size)

def preview(out="/workspace/tmp_sprite"):
    os.makedirs(out, exist_ok=True)
    atlas = Image.open(os.path.join(SPR, "collectibles.png"))
    cols, sc, lab = 5, 3, 22
    rows = (len(ITEMS) + cols - 1) // cols
    cw, ch = CW * sc + 40, CH * sc + lab + 10
    img = Image.new("RGBA", (cols * cw, rows * ch), (128, 130, 136, 255)); d = ImageDraw.Draw(img)
    for i, (iid, name, _) in enumerate(ITEMS):
        x, y = (i % cols) * cw + 20, (i // cols) * ch + 6
        img.alpha_composite(atlas.crop((0, i * CH, CW, i * CH + CH)).resize((CW * sc, CH * sc), Image.NEAREST), (x, y))
        d.text((x - 14, y + CH * sc + 2), (name.split(" (")[0])[:28], fill=(255, 255, 255))
        d.text((x - 14, y + CH * sc + 12), iid, fill=(255, 226, 140))
    img.save(os.path.join(out, "collectibles_preview.png"))
    fr = []
    for f in range(NF):                      # every item, one frame per gif frame, 2x
        s = Image.new("RGB", (len(ITEMS) * CW * 2, CH * 2), (128, 130, 136))
        for i in range(len(ITEMS)):
            c = atlas.crop((f * CW, i * CH, f * CW + CW, i * CH + CH)).resize((CW * 2, CH * 2), Image.NEAREST)
            s.paste(c, (i * CW * 2, 0), c)
        fr.append(s)
    fr[0].save(os.path.join(out, "collectibles_bob.gif"), save_all=True, append_images=fr[1:], duration=int(1000 / FPS), loop=0)
    print("previews written")

if __name__ == "__main__":
    build(); preview()
