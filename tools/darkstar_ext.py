"""1.6.0 Matthew outfit `darkstar` ("Dark Star Suit", unlocked by beating "The Star Goes Dark").
Original design on the shared rig: black + midnight-blue double-breasted suit (the coat cut), slate-blue shirt,
and a cracked, dimmed Mill Mountain star emblem on the chest that glows faintly. Kit: weapon "Dead Star Emblem",
signature move "Lights Out" (darkness pulse that staggers everyone around Matthew)."""
import math, os, sys
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
import gen_matthew_v2 as g
import kit_draw as kd
import gen_kits as gk
from gen_matthew_v2 import C, ramp, star_pts, add, mix
from gen_kits import K, Fr, X, bob

OID = "darkstar"; KEY = "matthew_darkstar"
WEAPON, MOVE = "Dead Star Emblem", "Lights Out"
GLOW_C = (150, 172, 230); CORE_C = (214, 222, 246); DEAD = (58, 64, 86)

g.OUTFITS[OID] = dict(
    top="coat", sleeves="long", darkstar=True,
    inner=ramp((44, 52, 78)), accent=ramp((26, 30, 52)), gloves=C(16, 16, 22),
    pal=dict(shirt=ramp((22, 26, 44)), jeans=ramp((16, 18, 28)), cuff=ramp((30, 34, 56)),
             boot=ramp((14, 14, 18)), sole=ramp((8, 8, 10), sh=0.8, dk=0.6)))

_coat = g.draw_coat_detail
def draw_coat_detail(p, T, pal, sk):
    _coat(p, T, pal, sk)
    if not g.STYLE.get("darkstar"): return
    c = (9.0, -19.0)                                            # cracked star on the visible chest panel
    p.poly([T(q) for q in star_pts(add(c, (0.3, 0.3)), 8.6, 0)], C(10, 10, 16))
    p.poly([T(q) for q in star_pts(c, 7.6, 0)], C(*DEAD))
    p.poly([T(q) for q in star_pts(c, 4.6, 0)], C(*GLOW_C))       # faint inner glow
    p.dot(T((c[0] - 0.8, c[1] - 0.8)), 0.9, C(*CORE_C))
    p.line([T((c[0] - 2.6, c[1] - 4.6)), T((c[0] - 0.2, c[1] - 1.2)), T((c[0] + 1.4, c[1] + 0.6)), T((c[0] + 3.4, c[1] + 4.2))], C(8, 8, 12), 0.55)  # the crack
    p.line([T((c[0] + 0.2, c[1] - 1.0)), T((c[0] + 3.0, c[1] - 2.0))], C(8, 8, 12), 0.4)
g.draw_coat_detail = draw_coat_detail

# ------------------------------------------------------------------ FX: darkness pulse
def fx_darkpulse(cv, c, r, k=0, **_):
    """Lights Out: a wide midnight ring rolling out from Matthew, cracked-star shards at its edge, pale rim."""
    rx, ry = r, r * 0.42
    ring = kd.mk(cv, kd.stroke(kd.ell_path(c, rx, ry, n=40), 3.0 + k, n=6), ramp((34, 38, 70), hi=(120, 134, 196)),
                 shade=(0.6, 0.6), hi=None, rim=0, ink=0.55, ink_col=C(6, 6, 12)); ring.commit()
    rim = kd.mk(cv, kd.stroke(kd.ell_path(c, rx * 0.86, ry * 0.86, 200, 340, n=18), 1.0, n=6), ramp(GLOW_C), shade=(0, 0), hi=None, rim=0, ink=0); rim.commit()
    for i, a in enumerate((-40, 20, 150, 210)):
        s = add(c, (rx * math.cos(math.radians(a)), ry * math.sin(math.radians(a))))
        q = kd.mk(cv, [star_pts(s, 3.0 + (i % 2), a)], ramp(DEAD, hi=GLOW_C), shade=(0.4, 0.4), hi=None, rim=0, ink=0.5); q.commit()
    return [add(c, (-rx - 4, -ry - 4)), add(c, (rx + 4, ry + 4))]

def fx_deadstar(cv, c, r, glow=True, **_):
    p = kd.mk(cv, [star_pts(c, r, 0)], ramp(DEAD), shade=(0.8, 0.6), hi=None, rim=0, ink=0.6, ink_col=C(6, 6, 12))
    if glow: p.poly(star_pts(c, r * 0.55, 0), C(*GLOW_C)); p.dot(c, max(0.6, r * 0.16), C(*CORE_C))
    p.line([add(c, (-r * 0.45, -r * 0.8)), add(c, (0, -r * 0.1)), add(c, (r * 0.5, r * 0.7))], C(8, 8, 12), 0.55)
    p.commit()
    return [add(c, (-r, -r)), add(c, (r, r))]
kd.DRAW["darkpulse"] = fx_darkpulse
kd.DRAW["deadstar"] = fx_deadstar

NR = dict(regrip=False)
def kit_darkstar():
    idle = []
    for k in range(6):                       # hand over the emblem; it flickers on frames 2-3
        dy, r = bob(k)
        P = K(torso=(66, 104 + dy), lean=2, head=1.2 * r, nh=(84, 92 + dy), fh=(98, 78 + dy), lg="stance",
              near_knee=(55, 142 + dy * 0.6), far_knee=(86, 141 + dy * 0.6))
        fx = [X("sparkle", c=(81, 76 + dy), r=3.2, col=GLOW_C)] if k in (2, 3) else []
        idle.append(Fr(P, fx=fx, **NR))
    c3 = [Fr(K(torso=(62, 106), lean=-6, head=2, nh=(56, 94), fh=(96, 76), lg="back"), **NR),
          Fr(K(torso=(72, 105), lean=12, head=-2, nh=(116, 72), fh=(90, 86), lg="lunge", open_near=True), **NR,
             fx=[X("deadstar", c=(122, 72), r=6, hit=True), X("speed", x0=80, x1=104, ys=[66, 78], col=GLOW_C)]),
          Fr(K(torso=(74, 106), lean=14, head=-2, nh=(118, 74), fh=(90, 86), lg="lunge", open_near=True), **NR,
             fx=[X("deadstar", c=(128, 74), r=8.5, hit=True), X("lines", c=(128, 74), r0=11, r1=18, angs=(-50, -15, 20, 55), col=GLOW_C)]),
          Fr(K(torso=(67, 104), lean=4, nh=(84, 92), fh=(98, 78)), **NR)]
    palms = dict(open_near=True, open_far=True)
    sp = [Fr(K(torso=(66, 106), lean=-2, nh=(80, 84), fh=(90, 84), lg="wide", **palms), **NR, fx=[X("deadstar", c=(86, 80), r=4)]),
          Fr(K(torso=(64, 110), lean=-4, head=2, nh=(70, 60), fh=(98, 58), lg="crouch", **palms), **NR, fx=[X("deadstar", c=(84, 50), r=6.5)]),
          Fr(K(torso=(66, 112), lean=0, head=4, nh=(62, 120), fh=(104, 120), lg="crouch", **palms), **NR,       # palms to the ground: PULSE
             fx=[X("darkpulse", c=(82, 176), r=30, k=1, hit=True), X("deadstar", c=(84, 118), r=7, glow=False)]),
          Fr(K(torso=(66, 112), lean=0, head=4, nh=(62, 120), fh=(104, 120), lg="crouch", **palms), **NR,
             fx=[X("darkpulse", c=(82, 176), r=46, k=1, hit=True), X("darkpulse", c=(82, 176), r=26, k=0)]),
          Fr(K(torso=(66, 110), lean=0, head=2, nh=(64, 112), fh=(102, 112), lg="crouch", **palms), **NR,
             fx=[X("darkpulse", c=(82, 176), r=56, k=0)]),
          Fr(K(torso=(66, 107), lean=0, nh=(72, 96), fh=(98, 92), lg="wide"), **NR, fx=[X("sparkle", c=(81, 76), r=3, col=GLOW_C)]),
          Fr(K(torso=(66, 105), lean=2, nh=(80, 94), fh=(98, 80)), **NR),
          Fr(K(torso=(66, 104), lean=2, nh=(84, 92), fh=(98, 78)), **NR)]
    return idle, c3, [1, 2], sp, [2, 3]

gk.KITS[OID] = kit_darkstar
gk.KIT[OID] = (WEAPON, MOVE)
if OID not in gk.OUTFITS: gk.OUTFITS.append(OID)

def weapon_icon():
    import gen_weapon_icons as wi
    from PIL import Image
    g.set_outfit(OID)
    cv = wi.PadCV(wi.CELL)
    fx_deadstar(cv, c=(24, 24), r=18)
    big = g.finish(cv); bb = big.getchannel("A").getbbox()
    w, h = bb[2] - bb[0], bb[3] - bb[1]
    out = Image.new("RGBA", (48, 48), (0, 0, 0, 0))
    crop = big.crop(bb)
    if w > 46 or h > 46: crop = crop.resize((min(46, w), min(46, h))); w, h = crop.size
    out.paste(crop, ((48 - w) // 2, (48 - h) // 2))
    g.set_outfit("polo")
    return out
