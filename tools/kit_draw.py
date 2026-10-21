"""Outfit kits: weapon + move-FX drawers (used by tools/gen_kits.py and tools/gen_weapon_icons.py) (shared rig style: cel-shaded Part, ink, gold rim)."""
import math, sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import gen_matthew_v2 as g
from gen_matthew_v2 import C, Part, add, rot, lerp, ramp, taper, ellipse_pts, star_pts

def Rf(f, ang): return lambda q: add(f, rot(q, ang))
def mk(cv, polys, pal, ink=0.7, shade=(1.4, 1.0), hi=(0.7, -0.7), rim=0.6, ink_col=None):
    return Part(cv, polys, pal, shade=shade, hi=hi, rim=rim, ink=ink, ink_col=ink_col)
def flat(rgb):
    c = C(*rgb); return dict(base=c, sh=c, dk=c, hi=c)

def resample(path, step):
    out = [path[0]]; acc = 0.0
    for a, b in zip(path, path[1:]):
        L = math.hypot(b[0]-a[0], b[1]-a[1]); t = 0.0
        while L > 0 and acc + (L - t) >= step:
            t += step - acc; acc = 0.0
            out.append(lerp(a, b, t / L))
        acc += L - t
    if math.hypot(out[-1][0]-path[-1][0], out[-1][1]-path[-1][1]) > step * 0.4: out.append(path[-1])
    return out
def stroke(path, r, n=8):
    return [taper(a, r, b, r, n=n) for a, b in zip(path, path[1:]) if math.hypot(b[0]-a[0], b[1]-a[1]) > 0.05]
def qcurve(a, ctrl, b, n=16):
    return [((1-t)**2*a[0] + 2*(1-t)*t*ctrl[0] + t*t*b[0], (1-t)**2*a[1] + 2*(1-t)*t*ctrl[1] + t*t*b[1]) for t in [i/n for i in range(n+1)]]
def ell_path(c, rx, ry, a0=0, a1=360, n=36, ang=0):
    return [add(c, rot((rx*math.cos(math.radians(a0+(a1-a0)*i/n)), ry*math.sin(math.radians(a0+(a1-a0)*i/n))), ang)) for i in range(n+1)]

INK_DK = C(30, 18, 16)

# ------------------------------------------------------------------ weapons
def w_book(cv, f, ang, **_):
    T = Rf(f, ang); cover = ramp((178, 52, 40)); pages = ramp((246, 236, 210))
    pg = mk(cv, [[T(q) for q in [(-1, 5), (18, 5), (19.6, 9.4), (0.6, 9.4)]]], pages, shade=(0.8, 0.6), hi=None, rim=0.4, ink=0.6)
    for yy in (6.6, 8.0): pg.line([T((1.4, yy)), T((18.4, yy))], C(190, 172, 140), 0.35)
    pg.commit()
    b = mk(cv, [[T(q) for q in [(-2.4, -8.4), (18.4, -8.4), (18.4, 6), (-2.4, 6)]]], cover, shade=(1.6, 1.2), hi=(0.8, -0.8), rim=0.8, ink=0.75)
    b.poly([T(q) for q in [(-2.4, -8.4), (1.6, -8.4), (1.6, 6), (-2.4, 6)]], cover["dk"])
    for xx in (-1.2, 0.6): b.line([T((xx, -7.8)), T((xx, 5.4))], C(236, 196, 90), 0.45)
    b.poly([T(q) for q in [(5, -5.2), (15, -5.2), (15, 1.0), (5, 1.0)]], C(236, 196, 90))
    b.poly([T(q) for q in [(6, -4.2), (14, -4.2), (14, 0), (6, 0)]], cover["sh"])
    b.poly(star_pts(T((10, -2.1)), 1.7, ang), C(250, 226, 140))
    b.commit()
    return [T(q) for q in [(-2.4, -8.4), (18.4, -8.4), (19.6, 9.4), (-2.4, 9.4)]]

def w_camera(cv, f, ang, neck=None, **_):
    T = Rf(f, ang); body = ramp((46, 46, 52)); silver = ramp((204, 206, 212))
    if neck:
        s = mk(cv, stroke(qcurve(T((-5, -5)), lerp(T((-5, -5)), neck, 0.5), neck), 1.0), ramp((150, 30, 36)), shade=(0.4, 0.4), hi=None, rim=0.3, ink=0.45)
        s.commit()
    b = mk(cv, [[T(q) for q in [(-7, -6), (9, -6), (9, 5.4), (-7, 5.4)]], [T(q) for q in [(-1, -10), (5.4, -10), (6.4, -6), (-2, -6)]]],
           body, shade=(1.4, 1.0), hi=(0.6, -0.6), rim=0.7, ink=0.75)
    b.poly([T(q) for q in [(-7, -6), (9, -6), (9, -3.4), (-7, -3.4)]], silver["base"])
    b.poly([T(q) for q in [(-1, -10), (5.4, -10), (5.8, -8.4), (-1.4, -8.4)]], silver["sh"])
    b.poly([T(q) for q in [(-6, -5.6), (-2.4, -5.6), (-2.4, -3.8), (-6, -3.8)]], C(255, 250, 230))     # flash window
    for xx in (-5, -3, -1): b.line([T((xx, -2)), T((xx, 4.4))], body["dk"], 0.35)                       # grip texture
    b.dot(T((6.6, -7.4)), 0.9, C(220, 60, 50))                                                        # shutter button
    b.commit()
    l = mk(cv, [[T(q) for q in [(8.6, -4.6), (15.4, -4.2), (15.4, 3.6), (8.6, 4.0)]]], ramp((70, 70, 78)), shade=(1, 0.8), hi=(0.5, -0.5), rim=0.6, ink=0.7)
    l.line([T((11, -4.4)), T((11, 3.8))], C(150, 152, 160), 0.5)
    l.poly(ellipse_pts(T((15.4, -0.3)), 1.4, 3.4, ang, n=12), C(70, 140, 210))
    l.dot(T((15.6, -1.8)), 0.7, C(220, 240, 255))
    l.commit()
    return [T(q) for q in [(-7, -10), (16, -10), (16, 5.4), (-7, 5.4)]]

BOARD_DECK = (244, 198, 56); NAVY = (36, 52, 104)
def w_board(cv, c, ang, flip=0, **_):
    T = Rf(c, ang); w = 21
    deck = ramp(BOARD_DECK)
    if flip == 2:                       # face view mid-flip: graphic side towards camera
        pts = [(-w-6, -3.2), (-w, -5.6), (w, -5.6), (w+6, -3.2), (w+6, 3.2), (w, 5.6), (-w, 5.6), (-w-6, 3.2)]
        b = mk(cv, [[T(q) for q in pts]], deck, shade=(1.4, 1.0), hi=(0.7, -0.7), rim=0.7, ink=0.75)
        b.poly(star_pts(T((0, 0)), 5.0, ang), C(*NAVY)); b.poly(star_pts(T((0, 0)), 2.4, ang), C(255, 236, 150))
        for xx in (-w + 2, w - 2): b.line([T((xx, -4)), T((xx, 4))], C(*NAVY), 0.7)
        b.commit()
        return [T(q) for q in pts]
    s = 1 if flip == 0 else -1
    pts = [(-w-4, -2.0*s), (w+4, -2.0*s), (w+7.5, -4.8*s), (w+8.6, -3.4*s), (w+5, 1.0*s), (-w-5, 1.0*s), (-w-8.6, -3.4*s), (-w-7.5, -4.8*s)]
    b = mk(cv, [[T(q) for q in pts]], deck, shade=(1.2, 1.0), hi=(0.6, -0.6), rim=0.7, ink=0.75)
    b.line([T((-w-6, -2.8*s)), T((w+6, -2.8*s))], C(40, 40, 46), 0.7)        # grip tape
    b.line([T((-w, 0)), T((w, 0))], C(*NAVY), 0.6)
    b.commit()
    for wx in (-w + 3, w - 3):
        tr = mk(cv, [[T(q) for q in [(wx-3, 1.0*s), (wx+3, 1.0*s), (wx+2, 3.0*s), (wx-2, 3.0*s)]]], ramp((150, 154, 162)), shade=(0.6, 0.6), hi=None, rim=0.3, ink=0.5)
        tr.commit()
        wh = mk(cv, [ellipse_pts(T((wx, 4.6*s)), 2.6, 2.6, n=12)], ramp((244, 236, 214)), shade=(0.8, 0.6), hi=None, rim=0, ink=0.6)
        wh.dot(T((wx, 4.6*s)), 0.8, C(170, 160, 140)); wh.commit()
    return [T(q) for q in [(-w-8.6, -5*s), (w+8.6, -5*s), (w+8.6, 7.4*s), (-w-8.6, 7.4*s)]]

def w_bikechain(cv, path, **_):
    pts = resample(path, 4.8); steel = ramp((156, 160, 170), hi=(226, 230, 236))
    outer = [taper(pts[i], 2.5, pts[i+1], 2.5, n=8) for i in range(0, len(pts)-1, 2)]
    inner = [taper(pts[i], 1.8, pts[i+1], 1.8, n=8) for i in range(1, len(pts)-1, 2)]
    if inner:
        a = mk(cv, inner, ramp((118, 122, 132)), shade=(0.6, 0.5), hi=None, rim=0.3, ink=0.5); a.commit()
    b = mk(cv, outer, steel, shade=(0.8, 0.6), hi=(0.5, -0.5), rim=0.5, ink=0.55)
    for p in pts: b.dot(p, 0.8, C(54, 56, 64))
    b.commit()
    gp = path[0]; d = (path[1][0]-gp[0], path[1][1]-gp[1]); L = math.hypot(*d) or 1
    gr = mk(cv, [taper(add(gp, (-d[0]/L*5, -d[1]/L*5)), 2.6, add(gp, (d[0]/L*3, d[1]/L*3)), 2.6)], ramp((36, 36, 40)), shade=(0.6, 0.6), hi=None, rim=0.4, ink=0.6)
    gr.line([add(gp, (-d[0]/L*1, -d[1]/L*1 - 2.4)), add(gp, (-d[0]/L*1, -d[1]/L*1 + 2.4))], C(236, 120, 46), 0.9)
    gr.commit()
    return pts

def w_goldchain(cv, path, **_):
    pts = resample(path, 6.4); gold = ramp((238, 186, 54), hi=(255, 240, 160))
    rings, bars = [], []
    for i in range(len(pts)-1):
        a, b = pts[i], pts[i+1]; ang = math.degrees(math.atan2(b[1]-a[1], b[0]-a[0])); m = lerp(a, b, 0.5)
        if i % 2 == 0: rings.append((m, ang))
        else: bars.append(taper(a, 2.0, b, 2.0, n=8))
    if bars:
        p = mk(cv, bars, ramp((200, 150, 40), hi=(250, 220, 130)), shade=(0.6, 0.6), hi=(0.4, -0.4), rim=0.4, ink=0.6); p.commit()
    p = mk(cv, [ellipse_pts(m, 5.4, 3.8, ang, n=16) for m, ang in rings], gold, shade=(1.0, 0.8), hi=(0.6, -0.6), rim=0.6, ink=0.65)
    for m, ang in rings:
        p.poly(ellipse_pts(m, 2.7, 1.2, ang, n=10), C(90, 60, 16))
        p.dot(add(m, rot((-1.8, -2.0), ang)), 0.7, gold["hi"])
    p.commit()
    return pts

def w_bat(cv, f, ang, **_):
    T = Rf(f, ang); wood = ramp((214, 166, 104), hi=(246, 214, 160))
    b = mk(cv, [taper(T((-6, 0)), 2.2, T((10, 0)), 2.0, n=10), taper(T((10, 0)), 2.0, T((46, 0)), 4.8, n=14), ellipse_pts(T((-7.2, 0)), 1.6, 3.2, ang, n=12)],
           wood, shade=(1.2, 1.0), hi=(0.6, -0.6), rim=0.8, ink=0.75)
    b.line([T((14, -1.0)), T((40, -2.6))], wood["hi"], 0.6)
    b.line([T((20, 1.2)), T((44, 2.4))], wood["sh"], 0.4)
    b.poly([T(q) for q in [(-6, -2.4), (6, -2.3), (6, 2.3), (-6, 2.4)]], C(36, 34, 38))         # grip tape
    for xx in (-3.5, -0.5, 2.5): b.line([T((xx, -2.2)), T((xx + 1.4, 2.2))], C(80, 78, 84), 0.35)
    b.line([T((40, -3.4)), T((40.6, 3.4))], C(170, 40, 40), 0.5)                               # red ring near the end
    b.commit()
    return [T((24, -6)), T((48, -6)), T((48, 6)), T((24, 6))]

def ball_pts(c, ang, rx=8.6, ry=5.4, n=24):
    out = []
    for i in range(n):
        t = 2*math.pi*i/n; s = math.sin(t)
        out.append(add(c, rot((rx*math.cos(t), ry*s*(0.55 + 0.45*abs(s))), ang)))
    return out
def w_football(cv, c, ang, **_):
    T = Rf(c, ang); lea = ramp((150, 80, 40), hi=(206, 140, 90))
    b = mk(cv, [ball_pts(c, ang)], lea, shade=(1.4, 1.1), hi=(0.8, -0.8), rim=0.7, ink=0.75)
    for xx in (-5.2, 5.2): b.line([T((xx, -3.6)), T((xx * 1.06, 3.6))], C(248, 244, 232), 0.7)
    b.line([T((-3.2, -2.6)), T((3.2, -2.6))], C(248, 244, 232), 0.5)
    for xx in (-2.2, -0.7, 0.8, 2.3): b.line([T((xx, -3.5)), T((xx, -1.7))], C(248, 244, 232), 0.4)
    b.commit()
    return [T(q) for q in [(-9, -6), (9, -6), (9, 6), (-9, 6)]]

def w_wrench(cv, f, ang, **_):
    T = Rf(f, ang); red = ramp((204, 52, 40)); steel = ramp((172, 178, 188), hi=(232, 236, 240))
    h = mk(cv, [taper(T((-7, 0)), 2.6, T((24, 0)), 3.0, n=10)], red, shade=(1.0, 0.8), hi=(0.5, -0.5), rim=0.6, ink=0.7)
    h.line([T((-4, -1.2)), T((20, -1.6))], red["hi"], 0.5); h.dot(T((-4.4, 0)), 1.0, C(40, 20, 18)); h.commit()
    hook = [(25, -2.6), (26, -18), (40, -19), (41.4, -13.6), (35.6, -13.2), (31.6, -12.6), (31.6, -2.6)]
    jaw = [(30, -1.0), (38.6, -2.6), (39.8, -9.8), (35.4, -10.2), (33.6, -6.2), (30, -4.4)]
    hd = mk(cv, [taper(T((22, 0)), 3.6, T((32, -0.4)), 3.8, n=10), [T(q) for q in hook], [T(q) for q in jaw]], steel,
            shade=(1.2, 1.0), hi=(0.6, -0.6), rim=0.7, ink=0.75)
    for xx in (34.5, 36.5, 38.5): hd.line([T((xx, -13.4)), T((xx + 0.6, -12.0))], steel["dk"], 0.4)
    for xx in (35, 37, 39): hd.line([T((xx, -9.8)), T((xx + 0.4, -8.4))], steel["dk"], 0.4)
    hd.poly(ellipse_pts(T((28.6, -8.4)), 3.2, 2.4, ang, n=12), steel["sh"])                  # knurled nut
    for yy in (-9.6, -8.4, -7.2): hd.line([T((26.2, yy)), T((31.0, yy))], steel["dk"], 0.3)
    hd.commit()
    return [T(q) for q in [(22, -19), (42, -19), (42, 4), (22, 4)]]

def w_pan(cv, f, ang, face=1.0, **_):
    T = Rf(f, ang); iron = ramp((60, 60, 68), hi=(140, 140, 150))
    h = mk(cv, [taper(T((-7, 0)), 2.0, T((13, 0)), 1.8, n=10)], ramp((40, 34, 32)), shade=(0.6, 0.6), hi=(0.4, -0.4), rim=0.5, ink=0.7)
    h.dot(T((-4.6, 0)), 0.9, C(14, 10, 10)); h.commit()
    c = T((25, 0))
    if face > 0.2:
        rx, ry = 11.5 * face, 11.5
        p = mk(cv, [ellipse_pts(c, rx, ry, ang, n=28)], iron, shade=(1.4, 1.2), hi=(0.8, -0.8), rim=0.8, ink=0.75)
        p.poly(ellipse_pts(c, rx * 0.78, ry * 0.78, ang, n=24), C(36, 36, 42))
        p.poly(ellipse_pts(add(c, rot((-2.5 * face, -3.4), ang)), rx * 0.32, ry * 0.2, ang - 20, n=12), C(110, 110, 122))
        p.commit()
        return [add(c, rot(q, ang)) for q in [(-rx, -ry), (rx, -ry), (rx, ry), (-rx, ry)]]
    prof = [(13, -1.2), (14, -4.6), (37, -4.6), (38, -1.2), (35, 2.4), (16, 2.4)]
    p = mk(cv, [[T(q) for q in prof]], iron, shade=(1.0, 0.8), hi=(0.5, -0.5), rim=0.7, ink=0.75)
    p.line([T((15, -4.0)), T((36, -4.0))], C(36, 36, 42), 0.8); p.commit()
    return [T(q) for q in [(13, -6), (38, -6), (38, 3), (13, 3)]]

CORD = (240, 226, 186); WBLUE = (40, 64, 170)
def w_starline(cv, hand, weight, slack=0.0, spin=0, coil=None, cord=True, **_):
    hits = []
    if coil:
        for i in range(3):
            cp = ell_path(add(coil, (i * 1.6 - 1.6, i * 0.8)), 4.6, 6.4, n=20)
            s = mk(cv, stroke(cp, 0.75), ramp(CORD), shade=(0.4, 0.4), hi=None, rim=0.3, ink=0.45); s.commit()
    if cord and weight is not None and math.hypot(weight[0]-hand[0], weight[1]-hand[1]) > 3:
        mid = lerp(hand, weight, 0.5); ctrl = add(mid, (0, slack))
        path = qcurve(hand, ctrl, weight, n=18)
        s = mk(cv, stroke(path, 1.1), ramp(CORD), shade=(0.4, 0.4), hi=None, rim=0.3, ink=0.5)
        for q in resample(path, 7)[1:-1]: s.dot(q, 1.0, C(*WBLUE))
        s.commit()
    if weight is not None:
        p = mk(cv, [star_pts(weight, 8.4, spin)], ramp((240, 192, 60), hi=(255, 240, 160)), shade=(1.2, 1.0), hi=(0.6, -0.6), rim=0.6, ink=0.75)
        p.poly(star_pts(weight, 3.8, spin), C(*WBLUE)); p.dot(weight, 0.9, C(255, 236, 150)); p.commit()
        hits = [add(weight, (-9, -9)), add(weight, (9, 9))]
    return hits

GL = dict(base=C(70, 230, 120), sh=C(40, 190, 96), dk=C(22, 140, 70), hi=C(200, 255, 214))
GL_INK = C(12, 70, 36)
def w_shard(cv, c, r=6.0, spin=0, **_):
    p = mk(cv, [star_pts(c, r, spin)], GL, shade=(1.0, 0.8), hi=(0.6, -0.6), rim=0, ink=0.55, ink_col=GL_INK)
    p.poly(star_pts(c, r * 0.45, spin), C(230, 255, 232)); p.commit()
    return [add(c, (-r, -r)), add(c, (r, r))]

def w_wrap(cv, fist, ang, **_):         # gold chain wrapped round the knuckles
    T = Rf(fist, ang); gold = ramp((238, 186, 54), hi=(255, 240, 160))
    p = mk(cv, [ellipse_pts(T((2.6 + 2.6 * i, 0)), 1.6, 6.2, ang, n=12) for i in range(3)], gold, shade=(0.8, 0.6), hi=(0.5, -0.5), rim=0.5, ink=0.6)
    for i in range(3): p.line([T((2.6 + 2.6 * i, -5)), T((2.6 + 2.6 * i, 5))], C(150, 100, 20), 0.35)
    p.commit()
    return [T((-2, -8)), T((14, 8))]

# ------------------------------------------------------------------ FX
def fx_swoosh(cv, c, r, a0, a1, width=8.0, col=(255, 248, 226), n=22, ang=0, sq=1.0, **_):
    outer, inner = [], []
    for i in range(n + 1):
        t = i / n; a = math.radians(a0 + (a1 - a0) * t); w = width * (t ** 0.9)
        outer.append(add(c, rot((r * math.cos(a), r * sq * math.sin(a)), ang)))
        inner.append(add(c, rot(((r - w) * math.cos(a), (r - w) * sq * math.sin(a)), ang)))
    p = mk(cv, [outer + inner[::-1]], ramp(col), shade=(0.5, 0.5), hi=None, rim=0, ink=0.35)
    p.commit()
    return outer[n // 2:] + inner[n // 2:]

def fx_pow(cv, c, r, col=(255, 214, 90), core=(255, 250, 220), rays=8, spin=0, **_):
    rr = []
    for i in range(rays):
        a = math.radians(spin + 22.5 + 360 / rays * i)
        rr.append([add(c, (r*0.5*math.cos(a-0.28), r*0.5*math.sin(a-0.28))), add(c, (r*1.5*math.cos(a), r*1.5*math.sin(a))),
                   add(c, (r*0.5*math.cos(a+0.28), r*0.5*math.sin(a+0.28)))])
    mk(cv, rr, ramp(core), shade=(0.6, 0.6), hi=None, rim=0, ink=0.4).commit()
    p = mk(cv, [star_pts(c, r, spin)], ramp(col), shade=(1.4, 1.0), hi=(0.7, -0.7), rim=0, ink=0.6)
    p.poly(star_pts(c, r * 0.5, spin), C(*core)); p.commit()
    return [add(c, (-r, -r)), add(c, (r, r))]

def fx_flash(cv, c, r, **_):
    rays = []
    for i in range(16):
        a = math.radians(11.25 * 2 * i / 2 + (0 if i % 2 else 11.25)); L = r * (1.9 if i % 2 == 0 else 1.25)
        rays.append([add(c, (r*0.45*math.cos(a-0.16), r*0.45*math.sin(a-0.16))), add(c, (L*math.cos(a), L*math.sin(a))),
                     add(c, (r*0.45*math.cos(a+0.16), r*0.45*math.sin(a+0.16)))])
    mk(cv, rays, ramp((255, 226, 120)), shade=(0.5, 0.5), hi=None, rim=0, ink=0.4).commit()
    p = mk(cv, [ellipse_pts(c, r, r, n=28)], ramp((255, 240, 170)), shade=(0.8, 0.6), hi=None, rim=0, ink=0.45)
    p.poly(ellipse_pts(c, r * 0.74, r * 0.74, n=24), C(255, 252, 236)); p.poly(ellipse_pts(c, r * 0.4, r * 0.4, n=16), C(255, 255, 255))
    p.commit()
    return [add(c, (-r*1.2, -r*1.2)), add(c, (r*1.4, r*1.2))]

def fx_sparkle(cv, c, r, col=(255, 236, 150), **_):
    pts = []
    for i in range(8):
        rr = r if i % 2 == 0 else r * 0.3; a = math.radians(45 * i)
        pts.append((c[0] + rr * math.cos(a), c[1] + rr * math.sin(a)))
    mk(cv, [pts], ramp(col), shade=(0.6, 0.6), hi=None, rim=0, ink=0.5).commit()
    return []

def fx_lines(cv, c, r0, r1, angs, col=(255, 250, 236), w=0.9, **_):
    p = mk(cv, [taper(add(c, (r0*math.cos(math.radians(a)), r0*math.sin(math.radians(a)))), w*0.5,
                      add(c, (r1*math.cos(math.radians(a)), r1*math.sin(math.radians(a)))), w, n=6) for a in angs],
           ramp(col), shade=(0.3, 0.3), hi=None, rim=0, ink=0.4)
    p.commit(); return []

def fx_paper(cv, c, ang, **_):
    T = Rf(c, ang)
    p = mk(cv, [[T(q) for q in [(-3.4, -4.4), (3.4, -4.0), (3.0, 4.4), (-3.8, 4.0)]]], ramp((250, 248, 240)), shade=(0.6, 0.6), hi=None, rim=0.3, ink=0.5)
    for yy in (-1.6, 0.4, 2.2): p.line([T((-2.4, yy)), T((2.2, yy))], C(150, 160, 190), 0.3)
    p.commit(); return []

def fx_splash(cv, c, k, dirx=1.0, **_):
    gr = ramp((246, 196, 70), hi=(255, 244, 190)); hits = []
    for i in range(7):
        a = math.radians(-70 + i * 22); d = 6 + k * 14 + (i % 3) * 4
        q = add(c, (dirx * d * math.cos(a) * 1.2, d * math.sin(a) - k * 3 + (i % 2) * 2))
        sz = 2.6 - (i % 3) * 0.5
        tail = add(q, (-dirx * math.cos(a) * sz * 2.2, -math.sin(a) * sz * 2.2))
        p = mk(cv, [taper(tail, sz * 0.35, q, sz, n=8)], gr, shade=(0.6, 0.6), hi=(0.4, -0.4), rim=0, ink=0.5); p.commit()
        hits.append(q)
    return hits

def fx_spiral(cv, c, ang, k=0, **_):
    T = Rf(c, ang); hits = []
    for i in range(3):
        x0 = -12 - i * 7
        path = [T((x0 + j * 1.2, 6.0 * math.sin((j + k * 3 + i * 2) * 0.9))) for j in range(6)]
        p = mk(cv, stroke(path, 0.7, n=6), ramp((255, 250, 236)), shade=(0.3, 0.3), hi=None, rim=0, ink=0.35); p.commit()
    return hits

def fx_crack(cv, c, k, **_):
    dk = ramp((70, 60, 52)); paths = []
    for sgn, lens in ((1, (14, 26 + k * 6)), (-1, (12, 20 + k * 5))):
        x = c[0]; pts = [(x, c[1])]
        for j, L in enumerate((6, 6, 7, 7)):
            x += sgn * L * (1 + k * 0.25); pts.append((x, c[1] + (1.4 if j % 2 else -0.8)))
        paths.append(pts)
    p = mk(cv, [s for pth in paths for s in stroke(pth, 1.0, n=6)], dk, shade=(0.2, 0.2), hi=None, rim=0, ink=0.3); p.commit()
    for i in range(4 + k):
        q = add(c, ((i - 2) * 7 + (3 if i % 2 else -2), -6 - (i % 3) * 5 - k * 4))
        r = mk(cv, [[add(q, v) for v in [(-2, -1.4), (1.6, -2), (2.2, 1.2), (-1.4, 2)]]], ramp((150, 140, 128)), shade=(0.6, 0.6), hi=None, rim=0, ink=0.5)
        r.commit()
    return [add(c, (-24, -26)), add(c, (30, 0))]

def fx_dust(cv, c, k, spread=1.0, **_):
    for i in range(3 + k):
        x = c[0] + (i - 1) * 10 * spread
        r = 3.6 + k * 1.2 + (i % 2) * 1.6
        mk(cv, [ellipse_pts((x, c[1] - r * 0.6), r * 1.3, r, n=14)], ramp((206, 194, 170)), shade=(1.0, 0.8), hi=(0.5, -0.5), rim=0, ink=0.45).commit()
    return []

def fx_speed(cv, x0, x1, ys, col=(240, 236, 220), **_):
    for i, y in enumerate(ys):
        mk(cv, [taper((x0 + i * 4, y), 0.7, (x1 + i * 6, y), 1.0)], ramp(col), shade=(0, 0), hi=None, rim=0, ink=0).commit()
    return []

RING_OUT = ramp((198, 214, 150), hi=(236, 244, 210)); RING_IN = (246, 250, 230)
def fx_ring(cv, c, rx, ry, w=2.0, sparks=(), **_):
    path = ell_path(c, rx, ry, n=40)
    p = mk(cv, stroke(path, w, n=6), RING_OUT, shade=(0.5, 0.5), hi=None, rim=0, ink=0.5, ink_col=C(52, 62, 30)); p.commit()
    q = mk(cv, stroke(ell_path(c, rx, ry, -70, 70, n=16), w * 0.5, n=6), ramp(RING_IN), shade=(0, 0), hi=None, rim=0, ink=0); q.commit()
    for a in sparks:
        s = add(c, (rx * math.cos(math.radians(a)), ry * math.sin(math.radians(a))))
        mk(cv, [[add(s, v) for v in [(0, -2.6), (1.6, 0), (0, 2.6), (-1.6, 0)]]], ramp((255, 190, 70), hi=(255, 236, 170)), shade=(0.4, 0.4), hi=None, rim=0, ink=0.4).commit()
    return [add(c, (-rx - w, -ry - w)), add(c, (rx + w, ry + w))]

def fx_greenburst(cv, c, r, spin=0, **_):
    rays = []
    for i in range(10):
        a = math.radians(spin - 90 + 36 * i + 18); L = r * (1.55 if i % 2 == 0 else 1.25)
        rays.append([add(c, (r*0.5*math.cos(a-0.2), r*0.5*math.sin(a-0.2))), add(c, (L*math.cos(a), L*math.sin(a))),
                     add(c, (r*0.5*math.cos(a+0.2), r*0.5*math.sin(a+0.2)))])
    mk(cv, rays, dict(base=C(150, 255, 170), sh=C(120, 240, 150), dk=C(90, 220, 130), hi=C(220, 255, 228)), shade=(0.4, 0.4), hi=None, rim=0, ink=0.45, ink_col=GL_INK).commit()
    p = mk(cv, [star_pts(c, r, spin)], GL, shade=(1.2, 1.0), hi=(0.6, -0.6), rim=0, ink=0.6, ink_col=GL_INK)
    p.poly(star_pts(c, r * 0.55, spin), C(170, 255, 190)); p.poly(star_pts(c, r * 0.28, spin), C(240, 255, 242)); p.commit()
    return [add(c, (-r * 1.2, -r * 1.2)), add(c, (r * 1.3, r * 1.2))]

DRAW = dict(book=w_book, camera=w_camera, board=w_board, bikechain=w_bikechain, goldchain=w_goldchain, bat=w_bat,
            football=w_football, wrench=w_wrench, pan=w_pan, starline=w_starline, shard=w_shard, wrap=w_wrap,
            swoosh=fx_swoosh, pow=fx_pow, flash=fx_flash, sparkle=fx_sparkle, lines=fx_lines, paper=fx_paper,
            splash=fx_splash, spiral=fx_spiral, crack=fx_crack, dust=fx_dust, speed=fx_speed, ring=fx_ring, greenburst=fx_greenburst)
