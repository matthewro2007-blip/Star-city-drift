#!/usr/bin/env python3
"""Matthew sprite generator (Star City Drift 2D) - v3: fair skin + real facial features.

Matches the concept hero in concept-preview-finished-look.jpg:
no glasses, short dark fade, thick mustache + soul patch, white short-sleeve
button-down tucked in, brown belt w/ gold buckle, blue jeans (rolled cuffs),
brown work boots, broad/stocky build. Side (3/4) view facing RIGHT.

Rendering: each body part is drawn as a vector mask at 4x supersampling,
cel-shaded from its own mask (light from upper-front, warm golden rim from
behind), inked with a per-part line, composited back-to-front, downsampled,
alpha-hardened, then given a crisp dark silhouette outline.

Outputs (layout contract unchanged):
  assets/sprites/matthew_sheet.png   1152x192, 8 frames of 144x192
  assets/sprites/matthew_idle.png    192x256
  assets/sprites/portrait_matthew.png 112x112
"""
import math, os, sys
from PIL import Image, ImageDraw, ImageFilter, ImageChops

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SPR = os.path.join(ROOT, "assets", "sprites")

S = 4                      # supersample factor
FW, FH = 144, 192          # native frame
GROUND = 187               # boot-sole baseline (native px)

# ---------------------------------------------------------------- palette
def C(*v): return tuple(v) + (255,)
OUT = C(30, 18, 16)
PAL = {
    # v3: fair light-peach skin (from Matthew's classroom photo), lighter shading
    "skin":  dict(base=C(248, 214, 190), sh=C(230, 186, 162), dk=C(200, 150, 128), hi=C(255, 237, 222)),
    "shirt": dict(base=C(240, 234, 220), sh=C(198, 188, 182), dk=C(150, 138, 146), hi=C(255, 252, 240)),
    "jeans": dict(base=C(50, 82, 140), sh=C(36, 58, 106), dk=C(24, 38, 74), hi=C(84, 122, 178)),
    "cuff":  dict(base=C(80, 114, 166), sh=C(56, 84, 132), dk=C(36, 56, 96), hi=C(120, 154, 198)),
    "belt":  dict(base=C(108, 64, 34), sh=C(76, 42, 22), dk=C(52, 28, 16), hi=C(146, 94, 54)),
    "gold":  dict(base=C(224, 176, 64), sh=C(164, 116, 36), dk=C(110, 72, 22), hi=C(255, 234, 150)),
    "boot":  dict(base=C(130, 80, 42), sh=C(94, 56, 30), dk=C(62, 36, 20), hi=C(178, 122, 70)),
    "sole":  dict(base=C(52, 34, 26), sh=C(40, 26, 20), dk=C(30, 18, 14), hi=C(78, 54, 40)),
    "hair":  dict(base=C(34, 24, 20), sh=C(24, 16, 14), dk=C(16, 10, 8), hi=C(74, 58, 50)),
}
RIM = (255, 168, 84)       # golden-hour back rim

# ---------------------------------------------------------------- outfits
# Same v3 body / poses / skin / face; only the clothing changes. The default
# outfit ("polo" in js/npcs.js OUTFITS) is the locked, user-approved look and has
# no overrides, so it renders byte-identical to assets/sprites/matthew_sheet.png.
def ramp(rgb, sh=0.76, dk=0.54, hi=None):
    """4-tone cel ramp from one base colour."""
    r, g, b = rgb
    hi = hi or tuple(min(255, int(v + (255 - v) * 0.28 + 10)) for v in rgb)
    return dict(base=C(r, g, b), sh=C(int(r*sh), int(g*sh), int(min(255, b*sh*1.06))),
                dk=C(int(r*dk), int(g*dk), int(min(255, b*dk*1.1))), hi=C(*hi))

BASE_PAL = {k: dict(v) for k, v in PAL.items()}
OUTFITS = {
    # default: tucked white button-down, brown belt + gold buckle, rolled jeans, brown boots
    "polo":   dict(),
    # Matthew's reference photo: white pocket tee w/ navy logo, faded ripped jeans
    "photo":  dict(top="tee", untucked=True, logo=C(26, 40, 92), ripped=True,
                   pal=dict(shirt=dict(base=C(246, 244, 238), sh=C(206, 200, 198), dk=C(156, 148, 156), hi=C(255, 255, 252)),
                            jeans=ramp((70, 106, 160)), cuff=ramp((104, 140, 186)))),
    # Star City Hoodie (#2c4a7a body, #ffd24a accent, #2a2a2e pants)
    "hoodie": dict(top="hoodie", untucked=True, sleeves="long", accent=ramp((255, 210, 74)),
                   hem="rib", shoe="sneaker",
                   pal=dict(shirt=ramp((44, 74, 122)), jeans=ramp((48, 48, 54)), cuff=ramp((40, 40, 46)),
                            boot=ramp((236, 234, 228), sh=0.82, dk=0.62), sole=ramp((210, 60, 52)))),
    # Rail Yard Jacket (#3d4a3a canvas, #c45c26 hi-vis accent, #3a3a48 pants) over a white tee
    "jacket": dict(top="jacket", untucked=True, sleeves="long", accent=ramp((226, 108, 46)),
                   inner=dict(base=C(240, 236, 226), sh=C(200, 192, 186), dk=C(150, 140, 146), hi=C(255, 252, 244)),
                   pal=dict(shirt=ramp((70, 86, 64)), jeans=ramp((58, 58, 76)), cuff=ramp((80, 80, 100)))),
    # Skate Fit (#111 tee, #e83e3e accent, #5a7aaa light jeans) + skate shoes
    "street": dict(top="tee", untucked=True, graphic=ramp((232, 62, 62)), ripped=True, shoe="sneaker",
                   pal=dict(shirt=dict(base=C(34, 32, 36), sh=C(22, 20, 24), dk=C(12, 10, 14), hi=C(70, 68, 76)),
                            jeans=ramp((90, 122, 170)), cuff=ramp((124, 154, 196)),
                            boot=ramp((30, 30, 34)), sole=ramp((240, 238, 232), sh=0.86, dk=0.7))),
    # Roanoke 'Star City' varsity letterman: maroon wool body, cream sleeves, star patch, white tee, jeans
    "varsity": dict(top="jacket", untucked=True, sleeves="long", varsity=True,
                    sleeve_pal=dict(base=C(238, 228, 204), sh=C(204, 190, 164), dk=C(160, 144, 122), hi=C(255, 248, 230)),
                    cuff_pal=ramp((122, 30, 44)), stripe=C(238, 228, 204),
                    inner=dict(base=C(246, 244, 238), sh=C(206, 200, 198), dk=C(156, 148, 156), hi=C(255, 255, 252)),
                    accent=ramp((238, 228, 204)),
                    pal=dict(shirt=ramp((122, 30, 44)))),
    # navy rail-yard coveralls, orange hi-vis bands (chest, sleeves, shins), work boots
    "mechanic": dict(top="jacket", untucked=True, sleeves="long", coveralls=True, hem="plain",
                     accent=ramp((240, 120, 40)), leg_band=True,
                     inner=ramp((40, 52, 86)),
                     pal=dict(shirt=ramp((40, 52, 86)), jeans=ramp((40, 52, 86)), cuff=ramp((40, 52, 86)),
                              boot=ramp((96, 62, 34)))),
    # Dee's Diner: red shirt w/ white collar + piping, white apron, paper cap, black pants
    "diner": dict(top="diner", untucked=True, apron=C(248, 246, 240), sleeve_trim=C(248, 246, 240),
                  headwear="paper_cap", shoe="sneaker",
                  pal=dict(shirt=ramp((206, 40, 44)), jeans=ramp((36, 36, 42)), cuff=ramp((50, 50, 58)),
                           boot=ramp((30, 30, 34)), sole=ramp((236, 234, 228), sh=0.86, dk=0.7))),
    # 'Star Champion' gold-and-black tracksuit, star on the sleeve + back shoulder
    "gold": dict(top="jacket", untucked=True, sleeves="long", track=True, stripe=C(24, 22, 26),
                 sleeve_star=True, back_star=True, inner=ramp((28, 26, 30)), accent=ramp((24, 22, 26)),
                 hem="rib", shoe="sneaker", leg_stripe=C(232, 184, 52),
                 pal=dict(shirt=ramp((232, 184, 52)), jeans=ramp((28, 26, 30)), cuff=ramp((24, 22, 26)),
                          boot=ramp((24, 22, 26)), sole=ramp((236, 196, 70), sh=0.82, dk=0.62))),
    # ORIGINAL hero suit (not Spider-Man): crimson w/ royal-blue zig-zag side panels, diamond lattice
    # lines (not a radial web), gold Star City star, full mask w/ angular gold visor, blue gloves/boots w/ gold trim
    "webslinger": dict(top="suit", sleeves="long", hem="plain", suit=True, headwear="mask",
                       gloves=C(36, 56, 150), cuff_pal=ramp((228, 176, 52)), panel=ramp((36, 56, 150)),
                       lattice=C(92, 10, 24), neck_pal=ramp((176, 28, 44)),
                       pal=dict(shirt=ramp((176, 28, 44)), jeans=ramp((176, 28, 44)), cuff=ramp((176, 28, 44)),
                                boot=ramp((36, 56, 150)), sole=ramp((228, 176, 52), sh=0.8, dk=0.6))),
    # ORIGINAL 'Star City Beacon' (not Green Lantern): emerald suit cut by ONE black diagonal sash
    # (back-shoulder -> front hip, gold piping), glowing green Star City star, green domino mask,
    # black gloves + glowing ring on the near hand, emerald legs w/ gold seam + knee stars, emerald boots/black soles
    "beacon": dict(top="suit", sleeves="long", hem="plain", beacon=True, headwear="domino", ring=True,
                   gloves=C(30, 32, 36), cuff_pal=ramp((30, 32, 36)), neck_pal=ramp((22, 150, 84)),
                   leg_stripe=C(232, 184, 52), knee_star=True,
                   pal=dict(shirt=ramp((22, 150, 84)), jeans=ramp((22, 150, 84)), cuff=ramp((22, 150, 84)),
                            boot=ramp((18, 128, 70)), sole=ramp((28, 28, 32), sh=0.8, dk=0.6))),
    # ORIGINAL 'Hell's Nightmare' armour (key `ironclad`; not Doom): near-black olive plates over a charcoal
    # undersuit, rounded pauldrons, gunmetal gauntlets/boots, scorch + scuffs, thin ember glow at the seams,
    # rounded helmet with a wide wraparound orange-red visor (no slit/T visor, no brow ridge), bronze star decal
    "ironclad": dict(top="suit", sleeves="long", hem="plain", ironclad=True, headwear="helmet",
                     sleeve_pal=ramp((170, 140, 96)), gloves=C(74, 74, 78), cuff_pal=ramp((82, 98, 48)),
                     neck_pal=ramp((96, 98, 104)), plate=ramp((82, 98, 48), sh=0.72, dk=0.5, hi=(124, 142, 78)),
                     gun=ramp((98, 100, 106)), leather=ramp((112, 74, 42)), seam=C(52, 62, 30),
                     pal=dict(shirt=ramp((170, 140, 96)), jeans=ramp((170, 140, 96)), cuff=ramp((170, 140, 96)),
                              boot=ramp((84, 70, 54)), sole=ramp((34, 30, 28), sh=0.8, dk=0.6))),
}
STYLE = {}
def SEAMC(): return STYLE.get("seam", EMBER)     # v2: plate grooves instead of a red glow
EMBER = C(255, 104, 40); EMBER_HOT = C(255, 186, 96); SCORCH = C(22, 22, 18); SCUFF = C(120, 128, 104)
GLOW = dict(halo=C(150, 255, 170), mid=C(70, 230, 120), core=C(230, 255, 230))

def set_outfit(oid):
    """Swap the clothing palette/style in place (PAL object identity is kept)."""
    global STYLE
    cfg = OUTFITS[oid]
    for k, v in BASE_PAL.items():
        PAL[k] = dict(v)
    for k, v in cfg.get("pal", {}).items():
        PAL[k] = dict(v)
    STYLE = cfg
    return cfg

def far(p, f=0.80):
    """Darker variant for the far-side limbs (depth)."""
    return {k: (int(v[0]*f), int(v[1]*f), int(min(255, v[2]*f*1.04)), 255) for k, v in p.items()}

def mix(a, b, t):
    return tuple(int(a[i]*(1-t) + b[i]*t) for i in range(3)) + (255,)

# ---------------------------------------------------------------- geometry
def rot(p, ang, o=(0, 0)):
    a = math.radians(ang); c, s = math.cos(a), math.sin(a)
    x, y = p[0]-o[0], p[1]-o[1]
    return (o[0] + x*c - y*s, o[1] + x*s + y*c)

def add(a, b): return (a[0]+b[0], a[1]+b[1])
def lerp(a, b, t): return (a[0]+(b[0]-a[0])*t, a[1]+(b[1]-a[1])*t)
def dist(a, b): return math.hypot(b[0]-a[0], b[1]-a[1])

def taper(p1, r1, p2, r2, n=14):
    """Polygon hull of two circles (tapered capsule)."""
    dx, dy = p2[0]-p1[0], p2[1]-p1[1]
    d = math.hypot(dx, dy) or 1e-3
    base = math.atan2(dy, dx)
    k = max(-1, min(1, (r1-r2)/d))
    off = math.acos(k)
    pts = []
    for i in range(n+1):          # around p2 (front cap)
        a = base - off + (2*off) * i / n
        pts.append((p2[0] + r2*math.cos(a), p2[1] + r2*math.sin(a)))
    for i in range(n+1):          # around p1 (back cap)
        a = base + off + (2*math.pi - 2*off) * i / n
        pts.append((p1[0] + r1*math.cos(a), p1[1] + r1*math.sin(a)))
    return pts

def ellipse_pts(c, rx, ry, ang=0, n=28):
    return [rot((c[0]+rx*math.cos(2*math.pi*i/n), c[1]+ry*math.sin(2*math.pi*i/n)), ang, c) for i in range(n)]

# ---------------------------------------------------------------- canvas
class Canvas:
    """xf = optional (kx, ky, ax, ay) build transform: scales the figure about the
    anchor (ax, ay) (e.g. feet centre) so other characters can be bigger/slimmer
    with the same rig. None = identity (keeps Matthew's locked output byte-exact)."""
    def __init__(self, w, h, xf=None):
        self.w, self.h = w, h
        self.xf = xf
        self.img = Image.new("RGBA", (w*S, h*S), (0, 0, 0, 0))

    def P(self, x, y):
        if self.xf is None:
            return (x*S, y*S)
        kx, ky, ax, ay = self.xf
        return ((ax + (x-ax)*kx)*S, (ay + (y-ay)*ky)*S)

    def mask(self, polys):
        m = Image.new("L", self.img.size, 0)
        d = ImageDraw.Draw(m)
        for p in polys:
            d.polygon([self.P(x, y) for x, y in p], fill=255)
        return m

def shift(m, dx, dy):
    out = Image.new("L", m.size, 0)
    out.paste(m, (int(round(dx*S)), int(round(dy*S))))
    return out

def edge(m, dx, dy):
    """Pixels of m whose neighbour at (dx,dy) is outside m."""
    return ImageChops.subtract(m, shift(m, -dx, -dy))

class Part:
    """A cel-shaded, inked body part."""
    def __init__(self, cv, polys, pal, shade=(4, 3), hi=(1.6, -1.6), rim=1.2,
                 ink=0.85, deep=None, clip=None, ink_col=None):
        self.cv = cv
        m = cv.mask(polys)
        if clip is not None:
            m = ImageChops.multiply(m, clip)
        self.m = m
        size = m.size
        layer = Image.new("RGBA", size, pal["base"])
        # shadow on the back/lower side (light comes from upper-front)
        sh = edge(m, -shade[0], shade[1])
        layer.paste(Image.new("RGBA", size, pal["sh"]), (0, 0), sh)
        dsh = deep if deep is not None else (shade[0]*0.45, shade[1]*0.45)
        dk = edge(m, -dsh[0], dsh[1])
        layer.paste(Image.new("RGBA", size, pal["dk"]), (0, 0), dk)
        if hi:
            h = edge(m, hi[0], hi[1])
            h = ImageChops.subtract(h, sh)
            layer.paste(Image.new("RGBA", size, pal["hi"]), (0, 0), h)
        if rim:
            r = edge(m, -rim, -rim*0.3)
            r = r.point(lambda v: int(v*0.55))
            layer.paste(Image.new("RGBA", size, RIM + (255,)), (0, 0), r)
        self.layer = layer
        self.d = ImageDraw.Draw(layer)
        self.ink = ink
        self.ink_col = ink_col or OUT

    # detail helpers (native coords)
    def poly(self, pts, col):
        self.d.polygon([self.cv.P(x, y) for x, y in pts], fill=col)
    def line(self, pts, col, w=0.8):
        self.d.line([self.cv.P(x, y) for x, y in pts], fill=col, width=max(1, int(w*S)), joint="curve")
    def dot(self, c, r, col):
        if self.cv.xf is None:
            self.d.ellipse([(c[0]-r)*S, (c[1]-r)*S, (c[0]+r)*S, (c[1]+r)*S], fill=col)
        else:
            (x, y), k = self.cv.P(*c), (self.cv.xf[0] + self.cv.xf[1]) / 2
            self.d.ellipse([x-r*k*S, y-r*k*S, x+r*k*S, y+r*k*S], fill=col)

    def commit(self):
        cv = self.cv
        a = self.m
        if self.ink:
            k = int(self.ink*S)*2 + 1
            grown = a.filter(ImageFilter.MaxFilter(k))
            ink = Image.new("RGBA", a.size, self.ink_col)
            ink.putalpha(grown)
            cv.img.alpha_composite(ink)
        lay = self.layer.copy()
        lay.putalpha(a)
        cv.img.alpha_composite(lay)

# ---------------------------------------------------------------- body parts
def draw_leg(cv, hip, knee, ankle, foot_ang, pal, bpal, spal, cpal, ground=True):
    # shin/thigh (straight-leg work jeans, a little loose)
    thigh = taper(hip, 10.5, knee, 8.6)
    shin = taper(knee, 8.6, ankle, 8.4)
    p = Part(cv, [thigh, shin], pal, shade=(4.5, 2.5))
    # creases at knee + seam
    kd = (knee[0]-hip[0], knee[1]-hip[1])
    n = (-(ankle[1]-knee[1]), ankle[0]-knee[0]); ln = math.hypot(*n) or 1; n = (n[0]/ln, n[1]/ln)
    for t, w in ((0.0, 5), (0.12, 4)):
        c = lerp(knee, ankle, t)
        p.line([add(c, (-n[0]*w, -n[1]*w - 1)), add(c, (n[0]*w*0.5, n[1]*w*0.5 + 1.5))], pal["dk"], 0.7)
    seam_a = lerp(hip, knee, 0.15); seam_b = lerp(knee, ankle, 0.9)
    p.line([add(seam_a, (n[0]*-6, n[1]*-6)), add(lerp(hip, knee, 0.9), (n[0]*-6.5, n[1]*-6.5)), add(seam_b, (n[0]*-6, n[1]*-6))], pal["sh"], 0.5)
    p.line([add(lerp(hip, knee, 0.3), (n[0]*3, n[1]*3)), add(lerp(hip, knee, 0.7), (n[0]*4, n[1]*4))], pal["hi"], 0.6)
    if STYLE.get("ripped"):
        draw_rips(p, hip, knee, ankle, pal)
    if STYLE.get("suit"):
        pnl = STYLE["panel"] if pal is PAL["jeans"] else far(STYLE["panel"])
        lat = STYLE["lattice"]
        for t0, t1 in ((0.0, 0.5), (0.5, 1.0)):            # lattice over the crimson
            for k in range(-2, 3):
                a0 = lerp(hip, knee, t0) if t1 <= 0.5 else lerp(knee, ankle, (t0-0.5)*2)
                a1 = lerp(hip, knee, t1*2 if t1 <= 0.5 else 1) if t1 <= 0.5 else lerp(knee, ankle, 1.0)
                p.line([add(a0, (n[0]*k*3.2 - 3, n[1]*k*3.2)), add(a1, (n[0]*k*3.2 + 3, n[1]*k*3.2))], lat, 0.35)
                p.line([add(a0, (n[0]*k*3.2 + 3, n[1]*k*3.2)), add(a1, (n[0]*k*3.2 - 3, n[1]*k*3.2))], lat, 0.35)
        # zig-zag outer panel (blue) along the back seam
        zz = []
        for i in range(7):
            t = i / 6.0
            c = lerp(hip, knee, t*2) if t <= 0.5 else lerp(knee, ankle, (t-0.5)*2)
            w = 4.2 if i % 2 == 0 else 1.8
            zz.append(add(c, (-n[0]*w, -n[1]*w)))
        outer = [add(lerp(knee, ankle, 1.0), (-n[0]*12, -n[1]*12)), add(lerp(hip, knee, 0.0), (-n[0]*14, -n[1]*14))]
        p.poly(zz + outer, pnl["base"])
        p.line(zz, C(228, 176, 52), 0.45)
    if STYLE.get("leg_stripe"):                    # tracksuit side stripe (outer seam)
        p.line([add(seam_a, (n[0]*-6.4, n[1]*-6.4)), add(lerp(hip, knee, 0.9), (n[0]*-6.9, n[1]*-6.9)),
                add(seam_b, (n[0]*-6.4, n[1]*-6.4))], STYLE["leg_stripe"], 1.3)
    if STYLE.get("ironclad"):          # tan thigh (undersuit), olive knee pad + shin plate, dark grey shin detail
        pl = STYLE["plate"] if pal is PAL["jeans"] else far(STYLE["plate"])
        gy = STYLE["gun"] if pal is PAL["jeans"] else far(STYLE["gun"])
        def band(t0, t1, a, b, w0, w1, col):
            c0 = lerp(a, b, t0); c1 = lerp(a, b, t1)
            p.poly([add(c0, (n[0]*w0, n[1]*w0)), add(c1, (n[0]*w1, n[1]*w1)), add(c1, (-n[0]*w1, -n[1]*w1)), add(c0, (-n[0]*w0, -n[1]*w0))], col)
        band(0.10, 0.92, knee, ankle, 9.0, 8.6, pl["base"]); band(0.10, 0.92, knee, ankle, 3.2, 2.8, pl["hi"])   # shin plate
        band(0.40, 0.70, knee, ankle, 9.0, 8.8, pl["sh"])
        band(0.44, 0.66, knee, ankle, 2.0, 2.0, gy["base"])                                                    # grey shin detail
        p.line([add(lerp(knee, ankle, 0.10), (n[0]*8.8, n[1]*8.8)), add(lerp(knee, ankle, 0.10), (-n[0]*8.8, -n[1]*8.8))], SEAMC(), 0.5)
        p.poly(ellipse_pts(add(knee, (n[0]*1.0, n[1]*1.0)), 7.0, 6.0, n=14), pl["base"])                 # knee pad
        p.poly(ellipse_pts(add(knee, (n[0]*2.2, n[1]*0.4 - 1.4)), 3.2, 2.2, n=10), pl["hi"])
        p.line([add(lerp(hip, knee, 0.35), (n[0]*-3, n[1]*-3)), add(lerp(hip, knee, 0.6), (n[0]*-4, n[1]*-4))], C(132, 106, 70), 0.5)   # thigh fold
        p.poly(ellipse_pts(lerp(hip, knee, 0.5), 2.2, 1.4, n=10), C(122, 98, 66))                            # dirt
        p.line([add(lerp(knee, ankle, 0.25), (n[0]*3, n[1]*3)), add(lerp(knee, ankle, 0.35), (n[0]*6, n[1]*6))], SCUFF, 0.45)
        p.poly(ellipse_pts(lerp(knee, ankle, 0.8), 2.4, 1.6, n=10), SCORCH)
    if STYLE.get("knee_star"):                     # small gold Star City star on the knee
        p.poly(star_pts(add(knee, (n[0]*1.5, n[1]*1.5)), 3.4, 0), C(232, 184, 52))
    if STYLE.get("leg_band"):                      # hi-vis band round the shin
        acc = STYLE["accent"]
        b0 = lerp(knee, ankle, 0.50); b1 = lerp(knee, ankle, 0.64)
        p.poly([add(b0, (n[0]*10, n[1]*10)), add(b0, (-n[0]*10, -n[1]*10)), add(b1, (-n[0]*10, -n[1]*10)), add(b1, (n[0]*10, n[1]*10))], acc["base"])
        m = lerp(b0, b1, 0.5)
        p.line([add(m, (n[0]*10, n[1]*10)), add(m, (-n[0]*10, -n[1]*10))], C(214, 218, 222), 0.5)
    p.commit()
    # boot (local origin = shaft top centre, x along foot)
    loc = [(-6, -1), (6, -1), (9, 4), (14.5, 5.8), (18.5, 8.8), (19, 13), (-8, 13), (-8.2, 4)]
    sole = [(-8.2, 10.6), (19.2, 10.6), (19, 13.2), (-8, 13.2)]
    poly = [add(rot(q, foot_ang), ankle) for q in loc]
    b = Part(cv, [poly], bpal, shade=(3.5, 2.5), rim=1.0)
    T = lambda q: add(rot(q, foot_ang), ankle)
    if STYLE.get("shoe") == "sneaker":
        draw_sneaker(b, T, bpal, spal)
    else:
        draw_boot_detail(b, T, bpal, spal, sole)
    b.commit()
    if STYLE.get("hem") == "rib":
        draw_rib_hem(cv, knee, ankle, n, cpal)
    elif STYLE.get("hem") == "plain":
        pass
    else:
        draw_rolled_cuff(cv, knee, ankle, n, cpal)

def draw_boot_detail(b, T, bpal, spal, sole):
    b.line([T((9, 5.2)), T((11.5, 8.5)), T((11.2, 10.6))], bpal["dk"], 0.6)
    for i in range(3):
        b.line([T((2 + i*2.2, 0.5 + i*1.6)), T((5 + i*2.2, -0.2 + i*1.6))], bpal["hi"], 0.55)
    b.dot(T((14.5, 8.0)), 1.6, bpal["hi"])
    b.poly([T(q) for q in sole], spal["base"])
    b.line([T((-7.5, 10.8)), T((18, 10.8))], C(176, 140, 96), 0.45)   # stitched welt

def draw_rolled_cuff(cv, knee, ankle, n, cpal):
    # rolled cuff (over boot top)
    d = (ankle[0]-knee[0], ankle[1]-knee[1]); L = math.hypot(*d) or 1; u = (d[0]/L, d[1]/L)
    c0 = add(ankle, (-u[0]*6.0, -u[1]*6.0)); c1 = add(ankle, (u[0]*0.8, u[1]*0.8))
    band = [add(c0, (n[0]*8.8, n[1]*8.8)), add(c0, (-n[0]*8.8, -n[1]*8.8)),
            add(c1, (-n[0]*9.4, -n[1]*9.4)), add(c1, (n[0]*9.4, n[1]*9.4))]
    cf = Part(cv, [band], cpal, shade=(3.0, 1.6), hi=(0.6, -0.9), rim=0.8, ink=0.6)
    mid = lerp(c0, c1, 0.45)
    cf.line([add(mid, (-n[0]*9, -n[1]*9)), add(mid, (n[0]*9, n[1]*9))], cpal["sh"], 0.6)
    cf.commit()

def draw_rib_hem(cv, knee, ankle, n, cpal):
    """Jogger-style ribbed ankle band (no roll)."""
    d = (ankle[0]-knee[0], ankle[1]-knee[1]); L = math.hypot(*d) or 1; u = (d[0]/L, d[1]/L)
    c0 = add(ankle, (-u[0]*4.2, -u[1]*4.2)); c1 = add(ankle, (u[0]*0.6, u[1]*0.6))
    band = [add(c0, (n[0]*8.2, n[1]*8.2)), add(c0, (-n[0]*8.2, -n[1]*8.2)),
            add(c1, (-n[0]*7.6, -n[1]*7.6)), add(c1, (n[0]*7.6, n[1]*7.6))]
    cf = Part(cv, [band], cpal, shade=(2.4, 1.2), hi=(0.5, -0.6), rim=0.6, ink=0.6)
    for t in (0.25, 0.5, 0.75):
        a = lerp(c0, c1, 0.15); b = lerp(c0, c1, 0.95)
        off = (n[0]*(-7 + 14*t), n[1]*(-7 + 14*t))
        cf.line([add(a, off), add(b, off)], cpal["sh"], 0.45)
    cf.commit()

def draw_sneaker(b, T, bpal, spal):
    """Low-top sneaker on the boot silhouette: chunky contrast sole, toe cap, side stripe."""
    b.poly([T(q) for q in [(-8.3, 9.2), (17.6, 9.2), (19.3, 10.4), (19.1, 13.3), (-8.1, 13.3)]], spal["base"])
    b.line([T((-8.0, 12.4)), T((19.0, 12.4))], spal["sh"], 0.6)
    b.line([T((-7.8, 9.4)), T((17.4, 9.4))], spal["dk"], 0.45)
    b.poly([T(q) for q in [(12.5, 5.6), (16.6, 6.6), (19.0, 9.2), (12.0, 9.2)]], bpal["hi"])          # toe cap
    acc = STYLE.get("accent") or STYLE.get("graphic") or ramp((200, 60, 50))
    b.poly([T(q) for q in [(-5.5, 7.8), (2.0, 3.6), (9.5, 4.4), (4.0, 6.0), (11.5, 8.2), (-4.0, 8.6)]], acc["base"])   # stripe
    for i in range(3):
        b.line([T((1.5 + i*2.3, 0.2 + i*1.5)), T((4.6 + i*2.3, -0.6 + i*1.5))], spal["base"], 0.55)   # laces
    b.dot(T((-6.4, 1.0)), 1.1, bpal["sh"])                                                           # heel tab

def draw_rips(p, hip, knee, ankle, pal):
    """Distressed knee/thigh rips: pale frayed patch, white weft threads, dark slit."""
    light = mix(pal["base"], (236, 236, 240), 0.62)
    for (a, b, t, rx, ry, off) in ((hip, knee, 0.86, 5.6, 2.0, 1.2), (hip, knee, 0.40, 3.0, 1.2, 3.6)):
        d = (b[0]-a[0], b[1]-a[1]); L = math.hypot(*d) or 1
        fx, fy = d[1]/L, -d[0]/L                       # leg-front normal
        if fx < 0: fx, fy = -fx, -fy
        c = add(lerp(a, b, t), (fx*off, fy*off))
        ang = math.degrees(math.atan2(fy, fx))
        p.poly(ellipse_pts(c, rx, ry, ang, n=14), light)
        for k in (-0.9, 0.0, 0.9):
            q = add(c, (d[0]/L*k*ry, d[1]/L*k*ry))
            p.line([add(q, (-fx*rx*0.85, -fy*rx*0.85)), add(q, (fx*rx*0.85, fy*rx*0.85))], C(250, 250, 248), 0.4)
        p.line([add(c, (-fx*rx*0.6, -fy*rx*0.6)), add(c, (fx*rx*0.6, fy*rx*0.6))], pal["dk"], 0.4)

def draw_arm(cv, sh, el, fist, pal_skin, pal_shirt, open_hand=False, fist_ang=None):
    # skin arm
    up = taper(sh, 7.6, el, 6.4)
    fo = taper(el, 6.4, fist, 4.6)
    a = Part(cv, [up, fo], pal_skin, shade=(3.2, 2.2), hi=(1.2, -1.2))
    # forearm muscle line
    a.line([lerp(el, fist, 0.25), lerp(el, fist, 0.65)], pal_skin["sh"], 0.5)
    a.commit()
    is_near = pal_shirt is PAL["shirt"]
    if STYLE.get("sleeve_pal"):
        sp = STYLE["sleeve_pal"]; sp = ramp(sp) if isinstance(sp, tuple) else sp
        pal_shirt = sp if pal_shirt is PAL["shirt"] else far(sp, 0.86)
    if STYLE.get("sleeves") == "none":
        draw_fist(cv, el, fist, pal_skin, open_hand, fist_ang)
        return
    if STYLE.get("sleeves") == "long":
        draw_long_sleeve(cv, sh, el, fist, pal_shirt)
        if STYLE.get("ironclad"):
            draw_armour_arm(cv, sh, el, fist, is_near)
        draw_fist(cv, el, fist, pal_skin, open_hand, fist_ang)
        return
    # short sleeve
    send = lerp(sh, el, 0.52)
    sl = Part(cv, [taper(add(sh, (0, -0.5)), 8.8, send, 7.4)], pal_shirt, shade=(3.6, 2.4), hi=(1.4, -1.4))
    d = (el[0]-sh[0], el[1]-sh[1]); L = math.hypot(*d) or 1; nx, ny = -d[1]/L, d[0]/L
    cuff_c = lerp(sh, el, 0.44)
    sl.line([add(cuff_c, (nx*8, ny*8)), add(cuff_c, (-nx*8, -ny*8))], pal_shirt["sh"], 0.7)
    sl.line([lerp(sh, el, 0.08), add(lerp(sh, el, 0.3), (nx*3, ny*3))], pal_shirt["sh"], 0.55)
    if STYLE.get("sleeve_trim"):
        tc = lerp(sh, el, 0.50)
        sl.line([add(tc, (nx*8, ny*8)), add(tc, (-nx*8, -ny*8))], STYLE["sleeve_trim"], 1.1)
    sl.commit()
    draw_fist(cv, el, fist, pal_skin, open_hand, fist_ang)

def draw_armour_arm(cv, sh, el, fist, is_near):
    """Ironclad v2: thick olive forearm gauntlet + big rounded olive pauldron over the tan sleeve."""
    pl = STYLE["plate"] if is_near else far(STYLE["plate"])
    g0 = lerp(el, fist, 0.08); g1 = lerp(el, fist, 0.76)
    ga = Part(cv, [taper(g0, 8.6, g1, 7.8)], pl, shade=(2.4, 1.8), hi=(1.0, -1.0), rim=0.8, ink=0.75)
    ga.line([lerp(g0, g1, 0.25), lerp(g0, g1, 0.8)], pl["hi"], 0.7)
    ga.line([add(lerp(g0, g1, 0.5), (0, -3.5)), add(lerp(g0, g1, 0.5), (0, 3.5))], SEAMC(), 0.5)
    ga.line([lerp(g0, g1, 0.35), add(lerp(g0, g1, 0.45), (1.5, 2))], SCUFF, 0.4)
    ga.commit()
    d = (el[0]-sh[0], el[1]-sh[1]); L = math.hypot(*d) or 1; ux, uy = d[0]/L, d[1]/L
    c = add(sh, (ux*3.0, uy*3.0 - 1.5))
    ang = math.degrees(math.atan2(uy, ux)) - 90
    pa = Part(cv, [ellipse_pts(c, 12.2, 9.6, ang, n=24)], pl, shade=(2.8, 2.2), hi=(1.3, -1.3), rim=1.0, ink=0.85)
    pa.poly(ellipse_pts(add(c, rot((0, 6.0), ang)), 11.0, 2.8, ang, n=16), pl["sh"])                  # lower rim band
    pa.line([add(c, rot((-10.4, 5.6), ang)), add(c, rot((10.4, 5.6), ang))], SEAMC(), 0.5)
    pa.poly(ellipse_pts(add(c, rot((-3.0, -3.6), ang)), 5.0, 2.6, ang, n=12), pl["hi"])
    pa.line([add(c, rot((-6, -1), ang)), add(c, rot((-1.5, 3), ang))], SCUFF, 0.45)                    # scratches
    pa.line([add(c, rot((2, -5.5), ang)), add(c, rot((6, -2.5), ang))], SCUFF, 0.4)
    pa.poly(ellipse_pts(add(c, rot((6, 1.5), ang)), 2.6, 1.7, ang, n=10), SCORCH)                      # scorch
    pa.poly(ellipse_pts(add(c, rot((-5, 2.6), ang)), 1.6, 1.0, ang, n=8), pl["dk"])                    # dent
    pa.commit()

def draw_long_sleeve(cv, sh, el, fist, pal_shirt):
    wrist = lerp(el, fist, 0.70)
    sl = Part(cv, [taper(add(sh, (0, -0.5)), 9.0, el, 7.8), taper(el, 7.8, wrist, 6.6)], pal_shirt,
              shade=(3.6, 2.4), hi=(1.4, -1.4))
    d = (el[0]-sh[0], el[1]-sh[1]); L = math.hypot(*d) or 1; nx, ny = -d[1]/L, d[0]/L
    sl.line([add(el, (nx*5, ny*5)), add(lerp(el, sh, 0.18), (-nx*2, -ny*2))], pal_shirt["sh"], 0.6)   # elbow bunching
    sl.line([add(el, (-nx*4, -ny*4)), add(lerp(el, wrist, 0.3), (nx*1, ny*1))], pal_shirt["sh"], 0.55)
    sl.line([lerp(sh, el, 0.08), add(lerp(sh, el, 0.3), (nx*3, ny*3))], pal_shirt["sh"], 0.55)
    acc = STYLE.get("accent")
    if STYLE.get("suit"):
        pnl = STYLE["panel"] if pal_shirt is PAL["shirt"] else far(STYLE["panel"])
        sl.poly([add(sh, (-nx*2, -ny*2)), add(el, (-nx*1.5, -ny*1.5)), add(wrist, (-nx*1.2, -ny*1.2)),
                 add(wrist, (-nx*9, -ny*9)), add(el, (-nx*10, -ny*10)), add(sh, (-nx*11, -ny*11))], pnl["base"])
        sl.line([add(sh, (-nx*2, -ny*2)), add(el, (-nx*1.5, -ny*1.5)), add(wrist, (-nx*1.2, -ny*1.2))], C(228, 176, 52), 0.4)
        for k in (0.25, 0.5, 0.75):
            c = lerp(sh, wrist, k)
            sl.line([add(c, (nx*1, ny*1)), add(c, (nx*7, ny*7))], STYLE["lattice"], 0.35)
    if STYLE.get("track"):                            # tracksuit stripe down the sleeve
        sl.line([add(lerp(sh, el, 0.05), (nx*5.5, ny*5.5)), add(el, (nx*5.2, ny*5.2)), add(wrist, (nx*4.6, ny*4.6))], STYLE.get("stripe", C(244, 244, 240)), 1.0)
        if STYLE.get("sleeve_star"):                  # star patch on the upper sleeve (reads facing right)
            sc = lerp(sh, el, 0.42)
            sl.poly(star_pts(sc, 4.6, 0), C(24, 22, 26))
            sl.poly(star_pts(sc, 3.4, 0), C(255, 236, 150))
    elif STYLE.get("top") == "jacket" and acc and not (STYLE.get("vest") or STYLE.get("cardigan") or STYLE.get("bomber") or STYLE.get("varsity")):
        a0 = lerp(sh, el, 0.55); a1 = lerp(sh, el, 0.72)
        sl.poly([add(a0, (nx*9, ny*9)), add(a0, (-nx*9, -ny*9)), add(a1, (-nx*9, -ny*9)), add(a1, (nx*9, ny*9))], acc["base"])
        m = lerp(a0, a1, 0.5)
        sl.line([add(m, (nx*9, ny*9)), add(m, (-nx*9, -ny*9))], C(214, 218, 222), 0.5)
    sl.commit()
    # ribbed cuff band at the wrist
    f = (fist[0]-el[0], fist[1]-el[1]); Lf = math.hypot(*f) or 1; fx, fy = -f[1]/Lf, f[0]/Lf
    c0 = lerp(el, fist, 0.56); c1 = lerp(el, fist, 0.72)
    band = [add(c0, (fx*6.6, fy*6.6)), add(c0, (-fx*6.6, -fy*6.6)), add(c1, (-fx*6.0, -fy*6.0)), add(c1, (fx*6.0, fy*6.0))]
    cpal = pal_shirt if STYLE.get("top") != "hoodie" else {k: mix(v, (0, 0, 0), 0.12) for k, v in pal_shirt.items()}
    if STYLE.get("cuff_pal"):
        cpal = STYLE["cuff_pal"] if pal_shirt is PAL["shirt"] or STYLE.get("sleeve_pal") is pal_shirt else far(STYLE["cuff_pal"], 0.86)
    cf = Part(cv, [band], cpal, shade=(2.0, 1.2), hi=(0.5, -0.5), rim=0.6, ink=0.55)
    for t in (0.3, 0.7):
        cf.line([add(lerp(c0, c1, 0.1), (fx*(-6 + 12*t), fy*(-6 + 12*t))), add(lerp(c0, c1, 0.9), (fx*(-6 + 12*t), fy*(-6 + 12*t)))], cpal["sh"], 0.4)
    cf.commit()

def draw_fist(cv, el, fist, pal_skin, open_hand=False, fist_ang=None):
    if STYLE.get("gloves"):
        gc = STYLE["gloves"]; pal_skin = dict(base=gc, sh=mix(gc, (0, 0, 0), 0.3), dk=mix(gc, (0, 0, 0), 0.55), hi=mix(gc, (255, 255, 255), 0.25))
    ang = fist_ang if fist_ang is not None else math.degrees(math.atan2(fist[1]-el[1], fist[0]-el[0]))
    fc = add(fist, rot((1.5, 0), ang))
    if open_hand:
        hand = [add(fc, rot(q, ang)) for q in [(-4, -3.6), (2, -4.2), (8.4, -3.4), (9.4, -1.6), (9.2, 2.4),
                                               (7.6, 3.4), (1.5, 3.6), (-4, 3.4)]]
        thumb = [add(fc, rot(q, ang)) for q in [(-2, -3), (2.5, -7.4), (4.4, -6.6), (2.6, -2.4)]]
        f = Part(cv, [hand, thumb], pal_skin, shade=(2.2, 1.6), hi=(1, -1), ink=0.7)
        for i in (-1.4, 0.4, 2.0):
            f.line([add(fc, rot((3.5, i), ang)), add(fc, rot((9.0, i), ang))], pal_skin["sh"], 0.45)
    else:
        box = [add(fc, rot(q, ang)) for q in [(-4.5, -5.2), (3.5, -6), (6.2, -3.8), (6.6, 3.2), (4, 5.6), (-4.5, 5.2), (-6, 0)]]
        f = Part(cv, [box], pal_skin, shade=(2.6, 2.0), hi=(1.1, -1.1), ink=0.75)
        for i in (-3.0, -0.6, 1.8):    # finger creases
            f.line([add(fc, rot((2.8, i), ang)), add(fc, rot((6.0, i + 0.4), ang))], pal_skin["dk"], 0.5)
        f.line([add(fc, rot((-3.8, -4.2), ang)), add(fc, rot((1.8, -4.6), ang)), add(fc, rot((3.0, -2.2), ang))], pal_skin["sh"], 0.6)  # thumb
        f.dot(add(fc, rot((5.4, -3.4), ang)), 0.9, pal_skin["hi"])
    f.commit()

HEAD_K = 1.08
def head_parts(cv, hc, ang, expr="calm", pal_skin=PAL["skin"]):
    """v3 head: Matthew's real features - oval face, softly rounded jaw, very short
    dark buzz cut, thick straight dark brows, dark eyes, thin mustache, small soul
    patch centred on the chin. Fair skin with light shading."""
    T = lambda q: add(rot((q[0]*HEAD_K, q[1]*HEAD_K), ang), hc)
    outline = [(-2.5, -14.4), (3.5, -14.2), (7.8, -12), (10.1, -8), (10.7, -4.4), (10.1, -2.4),
               (10.8, 0), (12.6, 3.5), (11.1, 4.6), (11.6, 6.0), (11.1, 7.5), (11.4, 8.7), (11.2, 10.6),
               (10.2, 12.6), (8.2, 14.0), (5.2, 14.6), (2.0, 13.8), (-1.0, 11.8), (-3.6, 8.8),
               (-6.8, 5.2), (-10.0, -0.5), (-10.4, -6), (-7.6, -11.8)]
    hp = [T(q) for q in outline]
    h = Part(cv, [hp], pal_skin, shade=(3.6, 2.0), hi=(1.4, -1.2), rim=1.0,
             deep=(1.2, 0.9))
    sk = pal_skin; hair = PAL["hair"]
    soft = mix(sk["base"], sk["sh"], 0.6)
    # soft jaw / under-cheek plane (rounded jaw, light shading)
    h.poly([T(q) for q in [(1.5, 6.5), (6.5, 9.8), (8.4, 13.6), (5.2, 14.4), (2.0, 13.6), (-0.8, 11.4)]], soft)
    h.poly([T(q) for q in [(4.0, 0.6), (8.6, 2.4), (7.0, 5.0), (3.4, 4.0)]], sk["hi"])     # cheek light
    # very short dark buzz cut: dark cap, thin skin-tinted edge at sides/nape
    edge_c = mix(sk["sh"], hair["base"], 0.55)
    h.poly([T(q) for q in [(11.5, -9.0), (5.0, -8.6), (3.0, -6.8), (2.4, -0.6), (0.4, -2.4), (-3.4, -2.6),
                           (-6.4, 2.4), (-12, 2.6), (-12, -16), (11.5, -16)]], edge_c)
    h.poly([T(q) for q in [(11.5, -9.2), (5.0, -8.9), (3.4, -7.6), (2.6, -4.6), (-0.4, -4.4), (-4.4, -4.0),
                           (-7.6, -1.0), (-12, -1.2), (-12, -16), (11.5, -16)]], hair["base"])
    h.line([T((-4.0, -12.8)), T((1.5, -13.4)), T((6.2, -11.8))], hair["hi"], 0.8)        # buzz sheen
    h.line([T((10.4, -9.0)), T((5.2, -8.8))], hair["dk"], 0.6)                         # straight hairline
    # ear
    h.poly([T(q) for q in [(-0.4, -2.6), (1.6, -1.2), (1.8, 2.4), (0.4, 4.4), (-2.2, 4.2), (-3, 1.2), (-2.4, -2)]], sk["base"])
    h.line([T((-0.6, -1.2)), T((0.6, 0.8)), T((-0.4, 3))], sk["dk"], 0.6)
    # thick, dark, straight brow
    h.poly([T(q) for q in [(4.8, -5.7), (10.8, -5.7), (10.8, -3.9), (5.0, -4.0)]], hair["base"])
    if expr == "hurt":
        h.line([T((6.6, -1.6)), T((8.4, -0.9)), T((9.6, -1.8))], OUT, 0.8)               # squeezed eye
    else:
        h.poly([T(q) for q in [(6.6, -2.0), (9.7, -2.1), (9.4, -0.8), (7.0, -0.8)]], C(240, 230, 220))
        h.poly([T(q) for q in [(7.7, -2.1), (9.5, -2.1), (9.3, -0.8), (7.8, -0.8)]], C(28, 20, 18))  # dark eye
        h.line([T((6.6, -2.2)), T((9.8, -2.3))], C(96, 62, 52), 0.45)                    # upper lid
        h.line([T((6.8, -0.4)), T((9.2, -0.5))], sk["sh"], 0.45)                         # lower lid
    h.line([T((10.2, 0.2)), T((12.0, 3.4)), T((10.8, 4.4))], sk["dk"], 0.5)               # nose edge
    h.poly([T(q) for q in [(9.4, 3.3), (11.2, 4.6), (9.8, 4.6)]], sk["dk"])               # nostril
    h.line([T((5.4, 4.4)), T((7.4, 7.6))], sk["sh"], 0.5)                                 # smile fold
    # mouth
    if expr == "hurt":
        h.poly([T(q) for q in [(8.8, 7.0), (11.4, 6.9), (11.2, 9.0), (9.2, 8.8)]], C(96, 34, 30))
        h.line([T((9.2, 7.2)), T((11.2, 7.2))], C(240, 232, 220), 0.5)
    else:
        h.poly([T(q) for q in [(9.0, 7.2), (11.3, 7.0), (11.4, 7.9), (9.2, 7.9)]], C(214, 140, 128))  # lips
        h.line([T((9.0, 7.6)), T((11.3, 7.5))], C(150, 86, 76), 0.45)
    # thin dark mustache
    h.poly([T(q) for q in [(7.4, 5.5), (9.6, 5.0), (11.6, 4.9), (12.1, 5.5), (11.6, 6.2), (9.4, 6.4), (7.6, 6.7)]], hair["base"])
    # small soul patch centred on the chin + faint chin stubble
    h.poly([T(q) for q in [(7.4, 10.4), (10.9, 10.0), (10.8, 12.4), (9.4, 13.6), (7.6, 13.0)]],
           mix(sk["base"], hair["base"], 0.10))
    h.poly([T(q) for q in [(8.8, 9.0), (10.6, 8.9), (10.4, 11.6), (9.6, 12.2), (9.0, 11.6)]], hair["base"])
    h.commit()

HEAD_FN = [head_parts]   # cast generator swaps in other heads

def draw_neck(cv, nb, hc, pal_skin):
    if STYLE.get("neck_pal"):
        pal_skin = STYLE["neck_pal"]
    p = Part(cv, [taper(nb, 6.6, add(hc, (-1, 6)), 5.6)], pal_skin, shade=(3.0, 1.8), hi=None)
    p.poly([add(hc, q) for q in [(-6, 6), (8, 10), (6, 13), (-6, 12)]], pal_skin["sh"])   # soft jaw shadow
    p.commit()

def draw_torso(cv, o, ang, pal):
    top = STYLE.get("top")
    if top in ("tee", "hoodie", "jacket", "coat", "diner", "suit"):
        return draw_torso_alt(cv, o, ang, pal, top)
    T = lambda q: add(rot(q, ang), o)
    shirt = [(-6, -49.5), (8.5, -49.5), (17, -47.2), (21.6, -41), (22.4, -28), (19.0, -14), (16.2, -4),
             (15.0, 3), (-13.4, 3), (-15.2, -6), (-17.6, -20), (-20.4, -33), (-20.0, -41), (-16.2, -47.4)]
    p = Part(cv, [[T(q) for q in shirt]], pal, shade=(6, 4), hi=(1.6, -1.4), rim=1.4, deep=(2.4, 1.8))
    sk = PAL["skin"]
    # open collar V (skin) + collar points
    p.poly([T(q) for q in [(1.8, -49.5), (10, -49.5), (6.8, -40.8)]], sk["sh"])
    p.poly([T(q) for q in [(1.0, -50), (4.4, -48.2), (6.4, -40.4), (2.2, -43.2), (-1.0, -47)]], pal["hi"])
    p.poly([T(q) for q in [(10.4, -50), (13.4, -47.4), (8.2, -40.2), (7.2, -41.6)]], pal["base"])
    p.line([T((1.0, -50)), T((-1.0, -47)), T((2.2, -43.2)), T((6.4, -40.4))], pal["dk"], 0.55)
    p.line([T((13.4, -47.4)), T((8.2, -40.2))], pal["dk"], 0.55)
    # placket + buttons
    p.line([T((7.0, -40)), T((8.4, -26)), T((8.6, -12)), T((8.2, 2))], pal["sh"], 0.65)
    for y in (-34, -24, -14, -4):
        p.dot(T((9.6 + (0.6 if y < -20 else 0.4), y)), 0.85, pal["dk"])
    # chest pocket (far side)
    p.poly([T(q) for q in [(12, -35), (19.4, -35.6), (19.6, -27.2), (15.8, -25.8), (12.2, -27)]], pal["base"])
    p.line([T((12, -35)), T((19.4, -35.6)), T((19.6, -27.2)), T((15.8, -25.8)), T((12.2, -27)), T((12, -35))], pal["sh"], 0.55)
    p.line([T((12, -33.6)), T((19.4, -34.2))], pal["sh"], 0.5)
    # folds: armpit pulls + tuck blousing
    p.line([T((-14, -32)), T((-6, -24)), T((-2, -14))], pal["sh"], 0.7)
    p.line([T((-17, -18)), T((-10, -8))], pal["sh"], 0.6)
    p.line([T((16, -20)), T((12, -10))], pal["sh"], 0.6)
    p.line([T((-13, 0.4)), T((-9, -1.6)), T((-5, 0.6)), T((0, -1.8)), T((5, 0.4)), T((10, -1.4)), T((14.6, 0.4))], pal["sh"], 0.7)
    if STYLE.get("suspenders"):
        sc = STYLE["suspenders"]
        p.line([T((-9, -48)), T((-8, -24)), T((-6.5, 0))], sc, 1.6)
        p.line([T((14, -47)), T((14.6, -24)), T((13.5, 0))], sc, 1.6)
    p.commit()
    # belt
    belt = [(-14.2, -0.6), (15.6, -1.2), (16.0, 4.8), (-14.0, 5.4)]
    b = Part(cv, [[T(q) for q in belt]], PAL["belt"], shade=(3, 1.6), hi=(0, -0.8), rim=0.8, ink=0.6)
    for x in (-10, 2):
        b.poly([T(q) for q in [(x, -1.4), (x+1.8, -1.4), (x+1.8, 5.8), (x, 5.8)]], PAL["jeans"]["sh"])   # loops
    b.line([T((-13.6, 0.6)), T((15.6, 0.0))], PAL["belt"]["dk"], 0.4)
    b.commit()
    g = PAL["gold"]
    buckle = [(8.8, -2.6), (14.8, -2.8), (15.0, 6.0), (9.0, 6.2)]
    bk = Part(cv, [[T(q) for q in buckle]], g, shade=(1.6, 1.2), hi=(1, -1), rim=0, ink=0.55)
    bk.poly([T(q) for q in [(10.6, -0.8), (13.2, -0.9), (13.3, 4.3), (10.7, 4.4)]], PAL["belt"]["sh"])
    bk.line([T((10.4, 1.8)), T((13.6, 1.7))], g["hi"], 0.55)
    bk.commit()

TEE = [(-6, -49.5), (8.5, -49.5), (17, -47.2), (21.6, -41), (22.4, -28), (19.0, -14), (16.6, -3), (17.2, 11.2),
       (-14.6, 11.8), (-15.6, -4), (-17.6, -20), (-20.4, -33), (-20.0, -41), (-16.2, -47.4)]

def star_pts(c, r, ang=0, k=0.45):
    return [rot((c[0] + (r if i % 2 == 0 else r*k)*math.cos(math.radians(-90 + 36*i)),
                 c[1] + (r if i % 2 == 0 else r*k)*math.sin(math.radians(-90 + 36*i))), ang, c) for i in range(10)]

def draw_torso_alt(cv, o, ang, pal, top):
    """Untucked tops: pocket tee / graphic tee, zip-less hoodie, open work jacket."""
    T = lambda q: add(rot(q, ang), o)
    sk = PAL["skin"]
    if top == "hoodie":
        body = [(-6, -50), (9, -50), (17.8, -47.6), (22.6, -41), (23.4, -28), (20.0, -13), (17.8, -2), (18.4, 13.4),
                (-15.8, 14.0), (-16.6, -4), (-18.6, -20), (-21.4, -33), (-21.0, -41), (-17.0, -48)]
        hood = [(-19.5, -44), (-17.5, -53.5), (-9, -58.5), (0, -57.5), (5.5, -52.5), (4.5, -46.5), (-8, -43.5)]
        hd = Part(cv, [[T(q) for q in hood]], {k: mix(v, (0, 0, 0), 0.10) for k, v in pal.items()}, shade=(4, 3), hi=(1.2, -1.2), rim=1.2)
        hd.line([T((-15.5, -50)), T((-8, -55.5)), T((1, -53.5))], pal["dk"], 0.7)
        hd.commit()
    elif top == "coat":
        body = [(-7, -51), (9.5, -51), (19, -48.4), (24.2, -41.5), (25.0, -28), (22.0, -13), (21.2, 4), (23.4, 30), (20.6, 40),
                (-15.0, 41), (-19.2, 30), (-18.6, 4), (-19.8, -20), (-22.8, -33), (-22.4, -41.5), (-18.0, -48.8)]
    elif top in ("diner", "suit"):
        body = TEE
    elif top == "jacket":
        body = [(-6.5, -50.5), (9, -50.5), (18.4, -48), (23.4, -41.5), (24.2, -28), (21.0, -13), (19.0, -2), (19.6, 14.2),
                (-16.6, 14.8), (-17.4, -4), (-19.4, -20), (-22.2, -33), (-21.8, -41.5), (-17.6, -48.4)]
    else:
        body = TEE
    p = Part(cv, [[T(q) for q in body]], pal, shade=(6, 4), hi=(1.6, -1.4), rim=1.4, deep=(2.4, 1.8))
    # shared folds
    p.line([T((-14, -32)), T((-6, -24)), T((-2, -14))], pal["sh"], 0.7)
    p.line([T((-17, -18)), T((-10, -6))], pal["sh"], 0.6)
    p.line([T((16, -20)), T((13, -8))], pal["sh"], 0.6)
    if top == "tee" and STYLE.get("tank"):
        p.poly([T(q) for q in [(-1.0, -50), (11.6, -50), (10.0, -42.6), (5.4, -40.6), (1.0, -43.0)]], sk["base"])
        p.line([T((-1.0, -49.8)), T((1.0, -43.0)), T((5.4, -40.4)), T((10.0, -42.4)), T((11.8, -49.8))], pal["dk"], 0.7)
        p.poly([T(q) for q in [(-18.6, -48), (-14, -49), (-11.6, -40), (-14.2, -31), (-20.4, -33), (-21, -41)]], sk["sh"])   # armhole
        p.line([T((-14, -49)), T((-11.6, -40)), T((-14.2, -31))], pal["dk"], 0.6)
        p.line([T((-14.4, 9.4)), T((-6, 10.4)), T((4, 9.6)), T((16.8, 10.0))], pal["sh"], 0.6)
    elif top == "tee":
        # crew neck: skin dip + rib
        p.poly([T(q) for q in [(1.2, -50), (10.4, -50), (9.0, -46.2), (5.6, -45.2), (2.6, -46.4)]], sk["sh"])
        p.line([T((1.0, -49.8)), T((2.6, -46.2)), T((5.6, -45.0)), T((9.2, -46.0)), T((10.6, -49.8))], pal["dk"], 0.6)
        p.line([T((2.0, -48.4)), T((5.6, -44.0)), T((10.0, -45.4))], pal["sh"], 0.45)
        # chest pocket (front side) + optional navy logo
        pk = [(11.6, -36), (19.2, -36.4), (19.4, -27.6), (11.8, -27.2)]
        p.poly([T(q) for q in pk], pal["base"])
        p.line([T(q) for q in pk + [pk[0]]], pal["sh"], 0.55)
        p.line([T((11.8, -34.8)), T((19.2, -35.2))], pal["sh"], 0.45)
        if STYLE.get("logo"):
            lg = STYLE["logo"]
            p.dot(T((15.4, -31.6)), 1.15, lg)                                   # rider
            p.line([T((13.6, -30.4)), T((17.4, -30.6))], lg, 0.75)              # horse
            p.line([T((14.2, -30.2)), T((14.0, -28.8))], lg, 0.45)
            p.line([T((16.8, -30.4)), T((17.2, -28.8))], lg, 0.45)
            p.line([T((17.4, -30.6)), T((18.4, -31.8))], lg, 0.5)              # mallet
        if STYLE.get("graphic"):
            g = STYLE["graphic"]
            p.poly([T(q) for q in star_pts((5.5, -24.5), 8.2, 0)], g["dk"])
            p.poly([T(q) for q in star_pts((5.0, -25.0), 7.2, 0)], g["base"])
            p.poly([T(q) for q in star_pts((4.4, -25.8), 3.0, 0)], g["hi"])
            p.line([T((-4.5, -12.5)), T((14.5, -12.8))], C(236, 232, 226), 0.9)    # wordmark bar
            p.line([T((-2.5, -10.2)), T((12.5, -10.4))], g["base"], 0.6)
        # untucked hem
        p.line([T((-14.4, 9.4)), T((-6, 10.4)), T((4, 9.6)), T((16.8, 10.0))], pal["sh"], 0.6)
        p.line([T((-14, 2)), T((-9, 6))], pal["sh"], 0.5)
        p.line([T((12, 1)), T((15.4, 7))], pal["sh"], 0.5)
        if STYLE.get("apron"):
            ap = STYLE["apron"]
            p.poly([T(q) for q in [(1.5, -37), (13.6, -37.4), (15.2, -14), (19.6, -10), (19.4, 13), (-8, 13.4), (-6.6, -10), (2.4, -14)]], ap)
            p.line([T((2.4, -14)), T((-6.6, -10)), T((-8, 13.4))], mix(ap, (0, 0, 0), 0.25), 0.6)
            p.line([T((1.5, -37)), T((-3, -48.6))], mix(ap, (0, 0, 0), 0.15), 0.9)                 # neck strap
            p.line([T((-6.6, -10)), T((-16.4, -9))], mix(ap, (0, 0, 0), 0.12), 1.0)                  # waist tie
            p.poly([T(q) for q in [(2, -2), (10, -2.2), (10.2, 5), (2.2, 5.2)]], mix(ap, (0, 0, 0), 0.08))  # pocket
            p.line([T((4, -30)), T((11, -30.2))], mix(ap, (200, 120, 60), 0.2), 0.4)
    elif top == "hoodie":
        acc = STYLE["accent"]
        p.poly([T(q) for q in [(1.0, -50.5), (10.6, -50.5), (8.8, -46.0), (3.0, -46.0)]], sk["sh"])
        p.line([T((0.6, -50.2)), T((3.0, -45.6)), T((9.0, -45.6)), T((11.0, -50.2))], pal["dk"], 0.9)
        for x0, x1 in ((4.2, 4.8), (8.2, 9.2)):                                  # drawstrings
            p.line([T((x0, -45.4)), T((x1, -35.6))], C(236, 232, 222), 0.6)
            p.dot(T((x1, -35.0)), 0.8, acc["base"])
        if not STYLE.get("nostar"):
            p.poly([T(q) for q in star_pts((13.8, -30.0), 4.6, 0)], acc["dk"])      # gold star logo
            p.poly([T(q) for q in star_pts((13.6, -30.3), 3.8, 0)], acc["base"])
            p.dot(T((13.0, -31.4)), 0.8, acc["hi"])
        pk = [(-5.5, -5.5), (14.6, -6.0), (17.2, 5.6), (-8.2, 6.4)]              # kangaroo pocket
        p.poly([T(q) for q in pk], pal["base"])
        p.line([T(q) for q in pk + [pk[0]]], pal["sh"], 0.6)
        p.line([T((-5.5, -5.5)), T((-8.0, 4.6))], pal["dk"], 0.6)
        p.line([T((14.6, -6.0)), T((16.6, 4.0))], pal["dk"], 0.6)
        rib = [(-16.2, 9.0), (18.2, 8.4), (18.4, 13.4), (-15.8, 14.0)]           # ribbed waistband
        p.poly([T(q) for q in rib], pal["sh"])
        for x in range(-13, 18, 3):
            p.line([T((x, 9.2)), T((x + 0.2, 13.4))], pal["dk"], 0.35)
    elif top == "coat":
        draw_coat_detail(p, T, pal, sk)
    elif top == "diner":
        draw_diner_detail(p, T, pal, sk)
    elif top == "suit" and STYLE.get("ironclad"):
        draw_ironclad_detail(p, T, pal)
    elif top == "suit" and STYLE.get("beacon"):
        draw_beacon_detail(p, T, pal)
    elif top == "suit":
        draw_suit_detail(p, T, pal)
    elif STYLE.get("varsity"):
        draw_varsity_detail(p, T, pal, sk)
    elif STYLE.get("coveralls"):
        draw_coveralls_detail(p, T, pal, sk)
    elif STYLE.get("cardigan") or STYLE.get("vest") or STYLE.get("bomber") or STYLE.get("track"):
        draw_jacket_variant(p, T, pal, sk)
    else:  # jacket over white tee
        inner = STYLE["inner"]; acc = STYLE["accent"]
        tee = [(2.0, -50), (10.4, -50), (12.6, -38), (12.0, -10), (11.6, 14.0), (5.0, 14.4), (5.6, -12), (4.0, -38)]
        p.poly([T(q) for q in tee], inner["base"])
        p.poly([T(q) for q in [(9.4, -40), (12.6, -38), (12.0, -10), (11.6, 14), (9.6, 14.2), (10.2, -12)]], inner["sh"])
        p.poly([T(q) for q in [(2.4, -50), (10.0, -50), (8.6, -46.6), (3.8, -46.8)]], sk["sh"])
        p.line([T((2.4, -49.8)), T((3.8, -46.6)), T((8.6, -46.4)), T((10.0, -49.8))], inner["dk"], 0.5)
        # lapels / corduroy collar (brown)
        cord = ramp((110, 72, 44))
        p.poly([T(q) for q in [(-1.6, -51), (3.0, -50.4), (5.2, -40.6), (3.6, -36.2), (0.8, -42.4)]], cord["base"])
        p.poly([T(q) for q in [(11.0, -51), (16.2, -48.2), (13.2, -38.4), (11.2, -40.6)]], cord["sh"])
        p.line([T((-1.6, -51)), T((0.8, -42.4)), T((3.6, -36.2))], cord["dk"], 0.5)
        # front edges + snaps
        p.line([T((4.0, -38)), T((5.6, -12)), T((5.0, 14.2))], pal["dk"], 0.8)
        p.line([T((12.6, -38)), T((12.0, -10)), T((11.6, 14.0))], pal["dk"], 0.8)
        for y in (-28, -16, -4, 8):
            p.dot(T((3.2 + (y + 30) * 0.03, y)), 0.8, C(196, 196, 186))
        # hi-vis band across the panels
        for poly in ([(-19.2, -22.6), (4.6, -22.6), (4.9, -18.4), (-18.4, -18.4)],
                     [(12.4, -22.6), (20.8, -22.6), (20.2, -18.4), (12.3, -18.4)]):
            p.poly([T(q) for q in poly], acc["base"])
        p.line([T((-18.8, -20.5)), T((4.7, -20.5))], C(214, 218, 222), 0.55)
        p.line([T((12.4, -20.5)), T((20.5, -20.5))], C(214, 218, 222), 0.55)
        # chest pocket flap (near panel) + hem band
        p.poly([T(q) for q in [(-8.0, -36.0), (1.4, -36.4), (1.6, -32.0), (-7.8, -31.6)]], pal["sh"])
        p.line([T((-8.0, -36.0)), T((1.4, -36.4))], pal["dk"], 0.5)
        p.dot(T((-3.2, -33.0)), 0.75, C(196, 196, 186))
        p.poly([T(q) for q in [(-17.2, 10.4), (5.2, 10.4), (5.0, 14.6), (-16.6, 14.8)]], pal["sh"])
        p.poly([T(q) for q in [(11.8, 10.4), (19.6, 10.4), (19.6, 14.2), (11.6, 14.0)]], pal["sh"])
        p.line([T((-12, 4)), T((-6, 1.6))], pal["sh"], 0.5)
    if STYLE.get("whistle"):
        p.line([T((1.6, -49)), T((6.4, -34)), T((10.6, -49))], C(30, 30, 34), 0.5)
        p.poly([T(q) for q in [(4.6, -35), (9.2, -35.2), (9.4, -32.0), (4.8, -31.8)]], C(206, 208, 214))
        p.dot(T((5.4, -33.4)), 0.7, C(120, 122, 130))
    p.commit()

def _inner_front(p, T, inner, sk, x0=4.0, x1=12.6, hem=14.0):
    tee = [(2.0, -50), (10.4, -50), (x1, -38), (x1 - 0.6, -10), (x1 - 1.0, hem), (x0 + 1.0, hem + 0.4), (x0 + 1.6, -12), (x0, -38)]
    p.poly([T(q) for q in tee], inner["base"])
    p.poly([T(q) for q in [(x1 - 3.2, -40), (x1, -38), (x1 - 0.6, -10), (x1 - 1.0, hem), (x1 - 3.0, hem), (x1 - 2.4, -12)]], inner["sh"])
    p.poly([T(q) for q in [(2.4, -50), (10.0, -50), (8.6, -46.6), (3.8, -46.8)]], sk["sh"])
    p.line([T((x0, -38)), T((x0 + 1.6, -12)), T((x0 + 1.0, hem))], p_dk(p), 0.8)
    p.line([T((x1, -38)), T((x1 - 0.6, -10)), T((x1 - 1.0, hem))], p_dk(p), 0.8)

def p_dk(p):
    return p._pal["dk"]

def draw_jacket_variant(p, T, pal, sk):
    inner = STYLE.get("inner") or ramp((236, 230, 220))
    p._pal = pal
    _inner_front(p, T, inner, sk)
    if STYLE.get("cardigan"):
        for y in (-30, -20, -10, 0):
            p.dot(T((3.6 + (y + 30) * 0.03, y)), 0.9, pal["hi"])
        p.line([T((-17.2, 9.6)), T((4.8, 9.8))], pal["sh"], 0.7)
        for x in range(-15, 4, 3):
            p.line([T((x, 10)), T((x + 0.2, 14.4))], pal["sh"], 0.35)
        p.poly([T(q) for q in [(-9, -6), (0, -6.2), (0.2, 2), (-8.8, 2.2)]], pal["sh"])          # patch pocket
    if STYLE.get("vest"):
        acc = STYLE.get("accent")
        if acc and acc is not inner:
            p.poly([T(q) for q in [(-19.2, -22.6), (4.6, -22.6), (4.9, -19.6), (-18.6, -19.6)]], acc["base"])
        p.line([T((-14, -48)), T((-12, -38)), T((-15, -30))], pal["dk"], 0.8)                       # armhole seam
        if STYLE.get("accent") is not None and isinstance(STYLE.get("accent"), dict):
            p.line([T((-10, -36)), T((-2, -36.4))], C(250, 250, 246), 1.2)                        # name badge
    if STYLE.get("bomber"):
        rib = mix(pal["dk"], (0, 0, 0), 0.2)
        p.poly([T(q) for q in [(-17.2, 9.8), (4.8, 9.8), (5.0, 14.6), (-16.6, 14.8)]], rib)
        p.poly([T(q) for q in [(11.8, 9.8), (19.6, 9.8), (19.6, 14.2), (11.6, 14.0)]], rib)
        p.poly([T(q) for q in [(-2, -51), (3, -50.4), (4.4, -46), (-1, -46.6)]], rib)
        p.poly([T(q) for q in [(-11, -32), (-4, -32.4), (-1.6, -25), (-8.6, -24.6)]], pal["sh"])    # sleeve pocket look
        p.line([T((-12, -2)), T((-6, -4))], pal["sh"], 0.5)
    if STYLE.get("track"):
        stc = STYLE.get("stripe", C(244, 244, 240))
        p.line([T((8.4, -50)), T((8.6, -20)), T((8.2, 14))], C(200, 200, 206), 0.6)                # zip
        p.line([T((-20.4, -38)), T((-17.4, -16)), T((-16.6, 12))], stc, 1.0)
        hem = STYLE["accent"]["base"] if STYLE.get("back_star") else pal["sh"]
        p.poly([T(q) for q in [(-17.2, 9.8), (4.8, 9.8), (5.0, 14.6), (-16.6, 14.8)]], hem)
        p.poly([T(q) for q in [(11.8, 9.8), (19.6, 9.8), (19.6, 14.2), (11.6, 14.0)]], hem) if STYLE.get("back_star") else None
        if STYLE.get("back_star"):                   # star wrapping onto the back shoulder (visible side)
            p.poly([T(q) for q in star_pts((-12.0, -36.5), 7.4, -8)], C(24, 22, 26))
            p.poly([T(q) for q in star_pts((-12.0, -36.5), 5.8, -8)], C(255, 236, 150))
            p.poly([T(q) for q in star_pts((-12.6, -37.4), 2.2, -8)], C(255, 252, 230))
            p.poly([T(q) for q in [(-1.8, -51), (3, -50.4), (4.4, -45.6), (-1, -46.4)]], STYLE["accent"]["base"])   # black collar

def _apron(p, T, ap):
    p.poly([T(q) for q in [(1.5, -37), (13.6, -37.4), (15.2, -14), (19.6, -10), (19.4, 13), (-8, 13.4), (-6.6, -10), (2.4, -14)]], ap)
    p.line([T((2.4, -14)), T((-6.6, -10)), T((-8, 13.4))], mix(ap, (0, 0, 0), 0.25), 0.6)
    p.line([T((1.5, -37)), T((-3, -48.6))], mix(ap, (0, 0, 0), 0.15), 0.9)                 # neck strap
    p.line([T((-6.6, -10)), T((-16.4, -9))], mix(ap, (0, 0, 0), 0.12), 1.0)                  # waist tie
    p.poly([T(q) for q in [(2, -2), (10, -2.2), (10.2, 5), (2.2, 5.2)]], mix(ap, (0, 0, 0), 0.08))  # pocket
    p.line([T((4, 6.5)), T((17, 6.2))], mix(ap, (0, 0, 0), 0.12), 0.5)

def draw_diner_detail(p, T, pal, sk):
    """Dee's Diner shirt: red, white collar points + placket piping + pocket trim, white apron."""
    W_ = C(248, 246, 240)
    p.poly([T(q) for q in [(1.8, -49.5), (10, -49.5), (6.8, -42.8)]], sk["sh"])
    p.poly([T(q) for q in [(0.6, -50.4), (4.6, -48.6), (6.6, -41.6), (2.0, -44.4), (-1.4, -47.6)]], W_)
    p.poly([T(q) for q in [(10.4, -50.4), (13.8, -47.8), (8.4, -41.4), (7.2, -42.8)]], C(226, 222, 214))
    p.line([T((0.6, -50.4)), T((-1.4, -47.6)), T((2.0, -44.4)), T((6.6, -41.6))], mix(W_, (0, 0, 0), 0.35), 0.5)
    p.line([T((7.0, -41)), T((8.4, -26)), T((8.6, -12))], W_, 0.9)                         # piping placket
    p.line([T((-20.0, -41)), T((-16.2, -47.4)), T((-6, -49.6))], W_, 0.8)                    # yoke piping
    _apron(p, T, STYLE["apron"])
    p.poly([T(q) for q in [(4.8, -31.5), (11.4, -31.8), (11.0, -28.4), (5.0, -28.2)]], C(206, 40, 44))   # name tag on bib
    p.line([T((5.8, -30.0)), T((10.4, -30.2))], W_, 0.5)

def draw_varsity_detail(p, T, pal, sk):
    """Letterman: maroon body open over a white tee, knit collar/hem w/ cream stripes, snaps, star patch."""
    inner = STYLE["inner"]; cream = STYLE["stripe"]
    p._pal = pal
    _inner_front(p, T, inner, sk)
    rib = mix(pal["base"], (0, 0, 0), 0.12)
    for poly in ([(-17.2, 9.4), (5.0, 9.4), (5.0, 14.6), (-16.6, 14.8)], [(11.8, 9.4), (19.6, 9.4), (19.6, 14.2), (11.6, 14.0)],
                 [(-2.2, -51.6), (3.2, -50.6), (4.6, -45.4), (-1.0, -46.2)], [(10.6, -51.6), (16.4, -49), (14.6, -45.6), (11.0, -47)]):
        p.poly([T(q) for q in poly], rib)
    for y in (11.0, 12.8):
        p.line([T((-16.8, y)), T((4.8, y))], cream, 0.55)
        p.line([T((12.0, y)), T((19.4, y - 0.2))], cream, 0.55)
    p.line([T((-1.6, -49.2)), T((3.6, -48.6))], cream, 0.5)
    for y in (-30, -20, -10, 0):
        p.dot(T((3.4 + (y + 30) * 0.03, y)), 0.9, C(236, 226, 200))
    # star chenille patch on the near chest panel: cream star, gold edge, maroon felt
    # (front panel, so it reads past the guard-up fists; second patch on the near panel for punch frames)
    for c, r in (((16.6, -30.6), 5.0), ((-6.4, -29.4), 7.0)):
        p.poly([T(q) for q in star_pts(c, r + 1.2, 0)], C(214, 168, 60))
        p.poly([T(q) for q in star_pts(c, r, 0)], cream)
        p.poly([T(q) for q in star_pts(c, r * 0.38, 0)], C(122, 30, 44))
    p.line([T((-16, -6)), T((-9, -2))], pal["sh"], 0.5)

def draw_coveralls_detail(p, T, pal, sk):
    """One-piece navy coveralls: point collar, zip, chest pockets, waist tab, hi-vis chest band."""
    acc = STYLE["accent"]
    p.poly([T(q) for q in [(2.2, -50), (10.2, -50), (7.0, -43.6)]], sk["sh"])
    p.poly([T(q) for q in [(0.6, -51), (4.6, -49), (6.8, -42.6), (2.0, -45.4), (-1.6, -48.4)]], pal["hi"])
    p.poly([T(q) for q in [(10.6, -51), (14.2, -48.4), (8.6, -42.4), (7.4, -43.6)]], pal["base"])
    p.line([T((0.6, -51)), T((-1.6, -48.4)), T((2.0, -45.4)), T((6.8, -42.6))], pal["dk"], 0.55)
    p.line([T((7.2, -42.6)), T((8.4, -26)), T((8.6, -10)), T((8.4, 13))], C(176, 180, 190), 0.6)   # zip
    for x0 in (-8.0, 12.4):                                                              # chest pockets
        x1 = x0 + 7.4 if x0 > 0 else x0 + 8.4
        p.poly([T(q) for q in [(x0, -36), (x1, -36.2), (x1, -29.6), (x0, -29.4)]], pal["sh"])
        p.line([T((x0, -34.8)), T((x1, -35.0))], pal["dk"], 0.5)
    for poly in ([(-19.4, -22.8), (8.0, -22.8), (8.0, -18.4), (-18.6, -18.4)], [(9.0, -22.8), (21.2, -22.8), (20.6, -18.4), (9.0, -18.4)]):
        p.poly([T(q) for q in poly], acc["base"])
    p.line([T((-19.0, -20.6)), T((20.9, -20.6))], C(214, 218, 222), 0.55)
    p.poly([T(q) for q in [(-15.6, 1.6), (17.0, 1.0), (17.2, 4.8), (-15.4, 5.4)]], pal["sh"])       # waist band
    p.line([T((-15.6, 1.6)), T((17.0, 1.0))], pal["dk"], 0.5)
    p.line([T((-15.4, 5.4)), T((17.2, 4.8))], pal["dk"], 0.5)
    p.poly([T(q) for q in [(-4, 7), (-14, 8), (-15.0, 13.6), (-5, 13.0)]], pal["sh"])          # hip pocket
    p.poly([T(q) for q in [(1, -12), (6.6, -12.2), (6.6, -9.6), (1, -9.4)]], C(236, 232, 222))  # name patch

def draw_suit_detail(p, T, pal):
    """Hero suit torso: diamond lattice over crimson, blue zig-zag side panel, gold star, utility belt."""
    lat = STYLE["lattice"]; pnl = STYLE["panel"]; gold = C(228, 176, 52)
    for k in range(-9, 8):                                    # diamond lattice (diagonals both ways)
        x = k * 5.0
        p.line([T((x - 6, -50)), T((x + 26, 11))], lat, 0.35)
        p.line([T((x + 26, -50)), T((x - 6, 11))], lat, 0.35)
    side = [(-21, -42), (-12.5, -42), (-9.5, -34), (-13, -26), (-9.0, -18), (-12.5, -10), (-9.5, -2), (-12, 12), (-16, 12), (-18, -20)]
    p.poly([T(q) for q in side], pnl["base"])
    p.poly([T(q) for q in [(-21, -42), (-17, -42), (-16.5, -20), (-15, 12), (-16, 12), (-18, -20)]], pnl["sh"])
    p.line([T(q) for q in side[1:9]], gold, 0.5)
    # gold Star City star on the chest (ink, gold, highlight) - no spider motif
    c = (12.6, -33.0)                                          # high on the chest so it clears the guard
    p.poly([T(q) for q in star_pts(c, 9.4, 0)], C(60, 24, 20))
    p.poly([T(q) for q in star_pts(c, 8.2, 0)], gold)
    p.poly([T(q) for q in star_pts((12.0, -33.9), 3.2, 0)], C(255, 240, 170))
    # utility belt: blue band, gold edge, star buckle
    p.poly([T(q) for q in [(-14.2, -0.6), (16.6, -1.2), (17.0, 4.8), (-14.0, 5.4)]], pnl["base"])
    p.line([T((-14.2, -0.6)), T((16.6, -1.2))], gold, 0.5)
    p.line([T((-14.0, 5.4)), T((17.0, 4.8))], gold, 0.5)
    p.poly([T(q) for q in star_pts((12.4, 2.0), 3.6, 0)], gold)

def draw_beacon_detail(p, T, pal):
    """Beacon torso: one black diagonal sash (upper back -> front hip) with gold piping,
    glowing green five-point star high on the chest (glow = lighter green band, hard alpha), black belt."""
    blk = C(30, 32, 36); gold = C(232, 184, 52)
    sash = [(-22, -44), (-13, -50.5), (21.5, -10), (20.5, 2), (14, 3)]
    p.poly([T(q) for q in sash], blk)
    p.line([T((-13, -50.5)), T((21.5, -10))], gold, 0.55)
    p.line([T((-22, -44)), T((14, 3))], gold, 0.55)
    c = (12.0, -36.0)
    p.poly([T(q) for q in star_pts(c, 11.4, 0)], GLOW["halo"])          # soft-glow band
    p.poly([T(q) for q in star_pts(c, 9.6, 0)], C(12, 60, 34))           # ink
    p.poly([T(q) for q in star_pts(c, 8.4, 0)], GLOW["mid"])
    p.poly([T(q) for q in star_pts((11.6, -36.6), 3.6, 0)], GLOW["core"])
    p.poly([T(q) for q in [(-14.2, -0.6), (16.6, -1.2), (17.0, 4.8), (-14.0, 5.4)]], blk)   # belt
    p.line([T((-14.0, 5.4)), T((17.0, 4.8))], gold, 0.5)
    p.poly([T(q) for q in star_pts((12.4, 2.0), 3.4, 0)], gold)

def draw_ironclad_detail(p, T, pal):
    """Ironclad v2 torso: olive chest plate over the tan undersuit belly, brown leather belt w/ pouches,
    grime, scuffs, scorch, small bronze Star City star on the plate."""
    pl = STYLE["plate"]; lea = STYLE["leather"]; gy = STYLE["gun"]
    plate = [(-19, -46), (-12, -50.5), (12, -50.5), (20, -46), (21, -30), (18, -20), (6, -17.5), (-8, -18), (-18.5, -22)]
    p.poly([T(q) for q in plate], pl["base"])
    p.poly([T(q) for q in [(-19, -46), (-12, -50.5), (-6, -50.5), (-12, -44), (-14, -24), (-18.5, -22)]], pl["sh"])    # back-side shade
    p.poly([T(q) for q in [(4, -48), (12, -48.5), (17.5, -44), (16, -40), (6, -42)]], pl["hi"])                         # bevel light
    p.line([T((-18.5, -22)), T((-8, -18)), T((6, -17.5)), T((18, -20))], pl["dk"], 0.7)                                # plate edge
    p.line([T((-14, -36)), T((19, -37))], SEAMC(), 0.5)                                                                # panel groove
    p.poly([T(q) for q in [(-6, -50.5), (8, -50.5), (6.5, -47.5), (-4.5, -47.5)]], gy["base"])                         # collar ring
    for a, b in (((-10, -42), (-4, -39)), ((7, -31), (12, -33)), ((-3, -27), (2, -25))): p.line([T(a), T(b)], SCUFF, 0.45)
    p.poly([T(q) for q in [(-14, -33), (-9.5, -34.5), (-8, -30), (-12.5, -28.5)]], SCORCH)
    p.poly([T(q) for q in [(14, -26), (17.5, -26.5), (17, -23.2), (14.4, -23.4)]], pl["dk"])                           # dent
    c = (13.6, -42.0)                                                                                                    # bronze star (small)
    p.poly([T(q) for q in star_pts(c, 5.4, 0)], C(40, 26, 14)); p.poly([T(q) for q in star_pts(c, 4.4, 0)], C(198, 142, 66))
    p.poly([T(q) for q in star_pts((13.3, -42.5), 1.8, 0)], C(240, 200, 130))
    # tan belly: soft folds + grime
    p.line([T((-6, -14)), T((10, -14.5))], pal["sh"], 0.6); p.line([T((-8, -8)), T((12, -8.5))], pal["sh"], 0.6)
    p.poly(ellipse_pts(T((-10, -10)), 2.4, 1.4, n=10), C(132, 106, 72))
    # brown leather belt + pouches + buckle
    p.poly([T(q) for q in [(-14.6, -3.0), (17.0, -3.6), (17.4, 3.4), (-14.4, 4.0)]], lea["base"])
    p.line([T((-14.6, -3.0)), T((17.0, -3.6))], lea["hi"], 0.5); p.line([T((-14.4, 4.0)), T((17.4, 3.4))], lea["dk"], 0.5)
    for x0 in (-11.5, -3.5):                                                                             # pouches
        p.poly([T(q) for q in [(x0, -2.0), (x0 + 6.4, -2.2), (x0 + 6.6, 7.2), (x0 + 0.2, 7.4)]], lea["sh"])
        p.poly([T(q) for q in [(x0, -2.0), (x0 + 6.4, -2.2), (x0 + 6.4, 1.6), (x0, 1.8)]], lea["base"])
        p.dot(T((x0 + 3.2, 1.2)), 0.7, C(170, 170, 160))
    p.poly([T(q) for q in [(9.8, -2.6), (15.2, -2.9), (15.4, 2.8), (10.0, 3.0)]], gy["base"])            # buckle
    p.poly([T(q) for q in [(11.2, -1.4), (13.8, -1.5), (13.9, 1.6), (11.3, 1.7)]], lea["dk"])

def draw_ring(cv, fist, flare=False):
    """Glowing ring on the near (gloved) hand: bright green pixel cluster + lighter halo band."""
    c = add(fist, (1.0, -2.6))
    r0 = 5.6 if flare else 3.2
    halo = Part(cv, [ellipse_pts(c, r0, r0, n=14)], dict(base=GLOW["halo"], sh=GLOW["halo"], dk=GLOW["mid"], hi=GLOW["core"]),
                shade=(0, 0), hi=None, rim=0, ink=0)
    halo.poly(ellipse_pts(c, r0 * 0.62, r0 * 0.62, n=12), GLOW["mid"])
    halo.poly(ellipse_pts(c, 1.2 if not flare else 1.9, 1.2 if not flare else 1.9, n=8), GLOW["core"])
    if flare:
        for a in range(0, 360, 45):
            d = rot((r0 + 3.4, 0), a); e = rot((r0 + 0.6, 0), a)
            halo.line([add(c, e), add(c, d)], GLOW["halo"], 0.6)
    halo.commit()

HEAD_OUTLINE = [(-2.5, -14.4), (3.5, -14.2), (7.8, -12), (10.1, -8), (10.7, -4.4), (10.1, -2.4),
                (10.8, 0), (12.6, 3.5), (11.1, 4.6), (11.6, 6.0), (11.1, 7.5), (11.4, 8.7), (11.2, 10.6),
                (10.2, 12.6), (8.2, 14.0), (5.2, 14.6), (2.0, 13.8), (-1.0, 11.8), (-3.6, 8.8),
                (-6.8, 5.2), (-10.0, -0.5), (-10.4, -6), (-7.6, -11.8)]   # = head_parts outline (locked shape)

def draw_headwear(cv, hc, ang):
    """Hat layer over the locked head (only drawn when the outfit asks for it)."""
    kind = STYLE.get("headwear")
    T = lambda q: add(rot((q[0]*HEAD_K, q[1]*HEAD_K), ang), hc)
    if kind == "paper_cap":            # white paper diner cap with a red band
        cap = [(-10.6, -10.6), (9.6, -10.8), (11.2, -13.0), (6.0, -18.2), (-2.0, -19.6), (-9.0, -17.4), (-12.2, -13.2)]
        pp = dict(base=C(250, 248, 242), sh=C(214, 210, 202), dk=C(170, 164, 158), hi=C(255, 255, 255))
        c = Part(cv, [[T(q) for q in cap]], pp, shade=(2.4, 1.6), hi=(1, -1), rim=0.9, ink=0.7)
        c.poly([T(q) for q in [(-11.4, -12.0), (10.6, -12.4), (9.6, -10.8), (-10.6, -10.6)]], C(206, 40, 44))
        c.line([T((-6, -17.8)), T((-1, -12.6))], pp["sh"], 0.5)
        c.line([T((-2.0, -19.4)), T((4.0, -12.8))], pp["sh"], 0.5)
        c.commit()
    elif kind == "helmet":             # v2: angular boxy green helmet, wide gold visor, grey jaw/breather (no centre slit/ridge, no brow notch, no cheek vents)
        pl = STYLE["plate"]; gun = STYLE["gun"]
        shell = [(-6.0, -17.6), (8.0, -17.4), (12.6, -14.0), (14.2, -7.6), (14.2, 3.0), (13.0, 9.0), (10.6, 15.4),
                 (2.0, 16.8), (-5.0, 15.6), (-10.6, 11.0), (-12.6, 2.0), (-12.8, -8.0), (-10.8, -14.6)]
        m = Part(cv, [[T(q) for q in shell]], pl, shade=(3.2, 2.0), hi=(1.4, -1.2), rim=1.0, deep=(1.2, 0.9))
        m.poly([T(q) for q in [(-10.8, -14.6), (-6.0, -17.6), (8.0, -17.4), (12.6, -14.0), (8.0, -14.6), (-6.0, -14.8)]], pl["hi"])   # flat crown bevel
        m.poly([T(q) for q in [(-12.8, -8.0), (-9.0, -8.0), (-8.0, 8.0), (-10.6, 11.0), (-12.6, 2.0)]], pl["sh"])                     # back plate
        m.line([T((-9.0, -8.0)), T((-8.0, 8.0))], SEAMC(), 0.5)
        m.poly([T(q) for q in [(-6.0, 1.5), (0.0, 1.0), (1.0, 8.0), (-5.0, 8.6)]], gun["base"])                                       # side bolt plate (square)
        m.dot(T((-2.5, 4.8)), 1.0, gun["hi"])
        # grey jaw / breather (boxy, below the visor)
        jaw = [(3.0, 3.6), (14.4, 3.6), (14.0, 9.4), (11.0, 15.0), (3.4, 15.6)]
        m.poly([T(q) for q in jaw], gun["base"])
        m.poly([T(q) for q in [(3.0, 3.6), (14.4, 3.6), (14.3, 5.4), (3.1, 5.6)]], gun["sh"])
        for yy in (8.0, 10.6, 13.0): m.line([T((6.4, yy)), T((12.6, yy - 0.4))], gun["dk"], 0.45)                                    # horizontal breather slats
        # wide horizontal gold reflective visor (wraps to the side)
        flare = STYLE.get("_visor_flare")
        m.poly([T(q) for q in [(-7.6, -9.4), (14.8, -9.6), (15.0, 3.0), (-7.0, 2.6)]], C(40, 26, 12))
        m.poly([T(q) for q in [(-6.2, -8.0), (14.2, -8.2), (14.4, 1.6), (-5.6, 1.2)]], C(212, 150, 38))
        m.poly([T(q) for q in [(-4.6, -7.0), (14.0, -7.2), (14.0, -3.6), (-4.2, -3.2)]], C(250, 202, 76))
        m.poly([T(q) for q in [(-5.6, -1.4), (14.3, -1.6), (14.4, 1.6), (-5.6, 1.2)]], C(170, 112, 30))           # lower reflection band
        m.line([T((-2.0, -5.6)), T((13.6, -5.9))], C(255, 244, 196) if not flare else C(255, 255, 236), 0.7 if not flare else 1.2)
        m.line([T((-6, -13)), T((-1, -15.6))], SCUFF, 0.45); m.line([T((5, -15.2)), T((9, -12.8))], SCUFF, 0.4)        # scuffs
        m.poly([T(q) for q in [(-11.6, -6), (-9.6, -7.6), (-9.0, -4.0), (-11.2, -2.6)]], SCORCH)
        m.poly(ellipse_pts(T((3.0, -12.4)), 1.6, 1.0, n=8), pl["dk"])                                              # dent
        m.commit()
        if flare:                                                                                                   # orange-gold flare rays
            fl = Part(cv, [[T(q) for q in [(13.6, -6.4), (24, -11), (14.2, -4.2), (25, -2.4), (14.0, -2.4)]]],
                      dict(base=C(255, 186, 70), sh=C(255, 150, 50), dk=C(240, 120, 40), hi=C(255, 240, 190)), shade=(0, 0), hi=None, rim=0, ink=0)
            fl.commit()
    elif kind == "domino":             # green domino mask: eye band only; face, buzz cut, brows stay visible
        band = [(-0.6, -5.0), (5.0, -6.0), (11.6, -5.0), (12.0, -1.0), (9.4, 0.4), (7.0, -0.6), (4.6, 0.2), (0.6, -1.0)]
        mp = dict(base=C(22, 150, 84), sh=C(14, 110, 60), dk=C(8, 70, 38), hi=C(90, 210, 130))
        m = Part(cv, [[T(q) for q in band]], mp, shade=(1.2, 1.0), hi=(0.6, -0.6), rim=0.6, ink=0.8)
        m.poly([T(q) for q in [(6.6, -3.8), (9.8, -4.0), (10.2, -2.2), (7.4, -1.8)]], C(250, 250, 244))   # eye hole
        m.poly([T(q) for q in [(8.4, -3.6), (9.8, -3.6), (9.9, -2.3), (8.5, -2.2)]], C(34, 26, 22))      # pupil
        m.line([T((-0.6, -5.0)), T((-3.6, -3.4))], mp["dk"], 0.6)                                       # tie tail
        m.commit()
    elif kind == "mask":               # full hero mask on the exact locked head silhouette
        mp = PAL["shirt"]; pnl = STYLE["panel"]; lat = STYLE["lattice"]
        m = Part(cv, [[T(q) for q in HEAD_OUTLINE]], mp, shade=(3.6, 2.0), hi=(1.4, -1.2), rim=1.0, deep=(1.2, 0.9))
        for k in range(-5, 5):                                # lattice
            x = k * 4.2
            m.line([T((x - 6, -16)), T((x + 10, 16))], lat, 0.35)
            m.line([T((x + 10, -16)), T((x - 6, 16))], lat, 0.35)
        # blue back-of-head panel with a zig-zag edge
        m.poly([T(q) for q in [(-12, -16), (-3.5, -16), (-1.0, -9), (-4.4, -4), (-1.4, 2), (-4.6, 8), (-2.4, 16), (-12, 16)]], pnl["base"])
        m.line([T(q) for q in [(-3.5, -16), (-1.0, -9), (-4.4, -4), (-1.4, 2), (-4.6, 8), (-2.4, 16)]], C(228, 176, 52), 0.45)
        # angular gold visor: a narrow swept wedge with a dark frame (not a white teardrop)
        visor = [(2.6, -6.2), (11.6, -5.4), (10.8, -1.4), (7.0, -0.8), (4.4, -2.6)]      # swept-back chevron
        m.poly([T(q) for q in [(1.6, -7.2), (12.4, -6.4), (11.6, -0.6), (6.8, 0.4), (3.4, -2.0)]], C(40, 16, 18))
        m.poly([T(q) for q in visor], C(240, 190, 60))
        m.line([T((5.6, -3.6)), T((10.6, -4.2))], C(255, 244, 190), 0.5)
        m.line([T((9.0, 3.6)), T((11.6, 4.6))], mp["dk"], 0.5)          # nose ridge hint
        m.line([T((8.8, 8.0)), T((11.2, 7.6))], mp["dk"], 0.45)         # mouth seam
        m.commit()

def draw_coat_detail(p, T, pal, sk):
    """Silas: long double-breasted overcoat, pale shirt, crimson tie, pocket square."""
    inner = STYLE["inner"]; acc = STYLE["accent"]
    p.poly([T(q) for q in [(2.4, -50.5), (10.4, -50.5), (11.6, -36), (6.6, -30), (3.4, -36)]], inner["base"])
    p.poly([T(q) for q in [(2.6, -50.5), (10.0, -50.5), (8.6, -47.4), (4.0, -47.6)]], sk["sh"])
    p.poly([T(q) for q in [(6.0, -47.2), (8.2, -47.2), (8.8, -44.6), (7.4, -32), (5.6, -33.4), (5.8, -44.6)]], acc["base"])  # tie
    p.line([T((6.2, -44.6)), T((8.6, -44.6))], acc["dk"], 0.5)
    # wide lapels
    p.poly([T(q) for q in [(-1.8, -51.5), (2.6, -50.8), (6.6, -30), (2.0, -33.4), (-0.4, -40), (-2.8, -44.6)]], pal["sh"])
    p.poly([T(q) for q in [(10.6, -51.5), (16.0, -48.8), (13.6, -42.4), (11.0, -36.6), (6.8, -30)]], pal["hi"])
    p.line([T((-1.8, -51.5)), T((-2.8, -44.6)), T((-0.4, -40)), T((2.0, -33.4)), T((6.6, -30))], pal["dk"], 0.6)
    p.line([T((16.0, -48.8)), T((13.6, -42.4)), T((11.0, -36.6)), T((6.8, -30))], pal["dk"], 0.6)
    # double-breasted buttons + front edge + belt
    for y in (-22, -12):
        for x in (4.4, 12.2):
            p.dot(T((x + (y + 22) * 0.02, y)), 1.0, C(18, 20, 26))
    p.line([T((14.0, -30)), T((15.4, 0)), T((17.6, 40))], pal["dk"], 0.8)
    p.poly([T(q) for q in [(-19.0, -4.2), (21.6, -4.8), (21.8, 0.4), (-18.8, 0.8)]], pal["dk"])
    p.poly([T(q) for q in [(11.4, -5.4), (15.8, -5.6), (15.9, 1.2), (11.5, 1.4)]], C(150, 150, 158))
    p.poly([T(q) for q in [(13.4, -34.6), (19.6, -35.0), (18.2, -32.0), (16.2, -33.4), (14.4, -31.8)]], acc["base"])  # pocket square
    p.line([T((-16, 10)), T((-12, 38))], pal["sh"], 0.8)
    p.line([T((4, 6)), T((6, 39))], pal["sh"], 0.7)
    p.line([T((-15, 38.6)), T((20.6, 38.2))], pal["sh"], 0.6)

def draw_pelvis(cv, o, ang, pal):
    T = lambda q: add(rot(q, ang), o)
    pel = [(-14.5, -1), (15.5, -1.5), (17.5, 10), (11.5, 18), (-9.5, 18.5), (-16, 11)]
    p = Part(cv, [[T(q) for q in pel]], pal, shade=(5, 3), rim=1.2)
    p.line([T((10.5, 4)), T((11.5, 14))], pal["dk"], 0.6)            # fly
    p.line([T((14, 4)), T((17.5, 8))], pal["sh"], 0.6)              # front pocket
    p.commit()

# ---------------------------------------------------------------- pose model
def foot_on_ground(ankle, ang, ground=GROUND):
    loc = [(-6, -1), (6, -1), (9, 4), (14.5, 5.8), (18.5, 8.8), (19, 13), (-8, 13), (-8.2, 4), (-8, 13.2), (19, 13.2)]
    low = max(rot(q, ang)[1] for q in loc)
    return (ankle[0], ground - low)

def render_figure(cv, P, ox=0, oy=0, scale=1.0):
    """Draw Matthew from pose dict P onto cv (native coords offset)."""
    o = P["torso"]; lean = P.get("lean", 0)
    skin, shirt, jeans = PAL["skin"], PAL["shirt"], PAL["jeans"]
    fskin, fshirt, fjeans = far(skin, 0.91), far(shirt, 0.86), far(jeans)
    fboot, fsole, fcuff = far(PAL["boot"]), far(PAL["sole"]), far(PAL["cuff"])
    TL = lambda q: add(rot(q, lean), o)
    nb = TL((2, -46))
    hc = add(nb, rot((3.4, -17.2), lean + P.get("head", 0)*0.4))
    hang = lean*0.5 + P.get("head", 0)

    def fa(): draw_arm(cv, TL(P["far_sh"]), TL(P["far_el"]), TL(P["far_fist"]), fskin, fshirt,
                       open_hand=P.get("open_far", False))
    def leg(side, pals):
        hip = TL(P[side+"_hip"]); knee = P[side+"_knee"]; ang = P.get(side+"_foot", 0)
        ankle = P[side+"_ankle"]
        if P.get(side+"_ground", True):
            ankle = foot_on_ground(ankle, ang)
        draw_leg(cv, hip, knee, ankle, ang, *pals)
    fa()
    leg("far", (fjeans, fboot, fsole, fcuff))
    draw_pelvis(cv, o, lean, jeans)
    if P.get("near_over_shirt"):
        draw_neck(cv, nb, hc, skin)
        draw_torso(cv, o, lean, shirt)
        leg("near", (jeans, PAL["boot"], PAL["sole"], PAL["cuff"]))
    else:
        leg("near", (jeans, PAL["boot"], PAL["sole"], PAL["cuff"]))
        draw_neck(cv, nb, hc, skin)
        draw_torso(cv, o, lean, shirt)
    HEAD_FN[0](cv, hc, hang, P.get("expr", "calm"), pal_skin=skin)
    if STYLE.get("headwear"):
        STYLE["_visor_flare"] = P.get("visor_flare", False)
        draw_headwear(cv, hc, hang)
    draw_arm(cv, TL(P["near_sh"]), TL(P["near_el"]), TL(P["near_fist"]), skin, shirt,
             open_hand=P.get("open_near", False))
    if STYLE.get("ring"):
        draw_ring(cv, TL(P["near_fist"]), flare=P.get("ring_flare", False))

BASE = dict(
    torso=(66, 103), lean=4, head=0,
    near_sh=(-12, -40), near_el=(-13, -20), near_fist=(6, -29),
    far_sh=(13, -41), far_el=(24, -24), far_fist=(33, -36),
    near_hip=(-7, 8), near_knee=(55, 142), near_ankle=(44, 174), near_foot=4,
    far_hip=(8, 8), far_knee=(86, 141), far_ankle=(95, 174), far_foot=0,
)

def pose(**kw):
    p = dict(BASE); p.update(kw); return p

POSES = [
    # 0 idle A — fists up, guard
    pose(),
    # 1 idle B — bob down, knees flex, fists dip
    pose(torso=(66, 105), near_knee=(54, 144), far_knee=(87, 143),
         near_fist=(6, -27.5), far_fist=(33, -34.5), far_el=(24, -22.5), near_el=(-13, -19)),
    # 2 walk A — near (rear) leg swings forward, far leg pushes off
    pose(torso=(67, 102), lean=6, near_knee=(76, 140), near_ankle=(80, 174), near_foot=0,
         far_knee=(70, 142), far_ankle=(54, 172), far_foot=24,
         near_fist=(7, -30), far_fist=(32, -37)),
    # 3 walk B — far (lead) leg steps out, near leg trails on toe
    pose(torso=(66, 104), lean=5, near_knee=(54, 142), near_ankle=(40, 172), near_foot=26,
         far_knee=(84, 141), far_ankle=(94, 174), far_foot=0,
         near_fist=(6, -28), far_fist=(34, -35)),
    # 4 punch wind-up — weight back, rear fist chambered at the chin
    pose(torso=(61, 105), lean=-4, head=2,
         near_sh=(-14, -40), near_el=(-28, -27), near_fist=(-17, -41),
         far_sh=(12, -41), far_el=(22, -26), far_fist=(26, -40),
         near_knee=(50, 144), near_ankle=(40, 174), near_foot=6,
         far_knee=(84, 143), far_ankle=(95, 174)),
    # 5 punch extended — rear cross fully extended, lunge
    pose(torso=(74, 105), lean=10, head=-4,
         near_sh=(-3, -42), near_el=(17, -43), near_fist=(38, -44),
         far_sh=(12, -41), far_el=(14, -24), far_fist=(19, -38),
         near_knee=(56, 146), near_ankle=(38, 172), near_foot=22,
         far_knee=(98, 143), far_ankle=(106, 174)),
    # 6 kick — rear-leg front kick at waist height
    pose(torso=(56, 104), lean=-12, head=6,
         near_sh=(-12, -40), near_el=(-20, -24), near_fist=(-10, -34),
         far_sh=(13, -41), far_el=(24, -27), far_fist=(30, -42),
         near_hip=(2, 8), near_knee=(86, 100), near_ankle=(112, 92), near_foot=-58, near_ground=False,
         far_knee=(58, 142), far_ankle=(54, 174), far_foot=0),
    # 7 hurt — snapped back, arms flung, grimace
    pose(torso=(60, 108), lean=-17, head=-10, expr="hurt",
         near_sh=(-12, -40), near_el=(-22, -24), near_fist=(-30, -8), open_near=True,
         far_sh=(13, -41), far_el=(25, -26), far_fist=(38, -16), open_far=True,
         near_knee=(52, 146), near_ankle=(42, 174), near_foot=6,
         far_knee=(82, 146), far_ankle=(92, 174), far_foot=-4),
]

# ---------------------------------------------------------------- finishing
def finish(cv, out_w=None, out_h=None, outline=2, alpha_cut=110):
    w, h = cv.w, cv.h
    im = cv.img.resize((w, h), Image.LANCZOS)
    r, g, b, a = im.split()
    a = a.point(lambda v: 255 if v >= alpha_cut else 0)
    im = Image.merge("RGBA", (r, g, b, a))
    # gentle sharpen on colour only
    rgb = Image.merge("RGB", (r, g, b)).filter(ImageFilter.UnsharpMask(radius=0.8, percent=60, threshold=2))
    im = Image.merge("RGBA", (*rgb.split(), a))
    # silhouette outline (4-connected then optional second ring)
    cur = a
    for i in range(outline):
        up = shift_native(cur, 0, -1); dn = shift_native(cur, 0, 1)
        lf = shift_native(cur, -1, 0); rt = shift_native(cur, 1, 0)
        grown = ImageChops.lighter(ImageChops.lighter(up, dn), ImageChops.lighter(lf, rt))
        ring = ImageChops.subtract(grown, cur)
        ol = Image.new("RGBA", im.size, OUT if i == 0 else (58, 34, 26, 255))
        base = im.copy()
        im = Image.new("RGBA", im.size, (0, 0, 0, 0))
        im.paste(ol, (0, 0), ring)
        im.alpha_composite(base)
        cur = grown
    # clear any colour in fully transparent pixels
    r, g, b, a = im.split()
    z = Image.new("L", im.size, 0)
    im = Image.merge("RGBA", (Image.composite(r, z, a), Image.composite(g, z, a), Image.composite(b, z, a), a))
    return im

def shift_native(m, dx, dy):
    out = Image.new("L", m.size, 0); out.paste(m, (dx, dy)); return out

def render_frame(P):
    cv = Canvas(FW, FH)
    render_figure(cv, P)
    return finish(cv)

def build_sheet():
    sheet = Image.new("RGBA", (FW*8, FH), (0, 0, 0, 0))
    frames = []
    for i, P in enumerate(POSES):
        f = render_frame(P)
        frames.append(f)
        sheet.paste(f, (i*FW, 0))
    return sheet, frames

def build_idle():
    """192x256 still: idle frame A rendered at 4/3 scale, bottom-centred."""
    cv = Canvas(FW, FH)
    render_figure(cv, POSES[0])
    big = Image.new("RGBA", (192*S, 256*S), (0, 0, 0, 0))
    sc = 256/192
    hi = cv.img.resize((int(FW*S*sc), int(FH*S*sc)), Image.LANCZOS)
    big.paste(hi, ((192*S - hi.width)//2, 256*S - hi.height - 2*S), hi)
    c2 = Canvas(192, 256); c2.img = big
    return finish(c2)

def build_portrait():
    """112x112 head & shoulders, 3/4 facing right."""
    cv = Canvas(FW, FH)
    P = pose(near_fist=(-12, -12), near_el=(-13, -18), far_fist=(24, -8), far_el=(20, -18))
    render_figure_portrait(cv, P)
    # crop region around head/shoulders (native coords), then scale to 112
    o = P["torso"]
    box_native = (44, 13, 100, 69)           # 56x56 native window centred on the head
    crop = cv.img.crop(tuple(v*S for v in box_native))
    big = crop.resize((112*S, 112*S), Image.LANCZOS)
    c2 = Canvas(112, 112); c2.img = big
    return finish(c2, outline=1)

def render_figure_portrait(cv, P):
    o = P["torso"]; lean = 0
    skin, shirt = PAL["skin"], PAL["shirt"]
    TL = lambda q: add(rot(q, lean), o)
    nb = TL((2, -46)); hc = add(nb, (3.4, -17.2))
    # both shoulders, arms hanging (just the sleeves show in crop)
    draw_arm(cv, TL((14, -41)), TL((18, -20)), TL((20, -4)), far(skin, 0.91), far(shirt, 0.86))
    draw_neck(cv, nb, hc, skin)
    draw_torso(cv, o, lean, shirt)
    head_parts(cv, hc, 0)
    draw_arm(cv, TL((-12, -40)), TL((-14, -20)), TL((-12, -2)), skin, shirt)

# ---------------------------------------------------------------- front HUD portrait
def build_portrait_front(outfit="polo"):
    """112x112 front-facing bust for the HUD ring, same cel/ink style as the sheet.
    Matches Matthew's photo: oval face with slightly fuller rounded cheeks, short dark
    buzz cut, thick straight brows, dark eyes, thin mustache, small soul patch, fair skin."""
    set_outfit(outfit)
    cv = Canvas(112, 112)
    sk, hair, shirt = PAL["skin"], PAL["hair"], PAL["shirt"]
    CX = 56.0
    def mirror(half):            # half = right-side points top->chin as (dx, y)
        return [(CX + dx, y) for dx, y in half] + [(CX - dx, y) for dx, y in reversed(half)]
    # shoulders + shirt (open collar, like the default outfit)
    sh_poly = [(4, 113), (3, 100), (8, 92.5), (22, 87.5), (40, 85), (56, 88), (72, 85), (90, 87.5), (104, 92.5), (109, 100), (108, 113)]
    body = Part(cv, [sh_poly], shirt, shade=(5, 3), hi=(1.4, -1.4), rim=1.2, deep=(2, 1.5))
    body.line([(24, 96), (30, 112)], shirt["sh"], 0.8)
    body.line([(88, 96), (82, 112)], shirt["sh"], 0.8)
    body.commit()
    neck = Part(cv, [[(44.5, 66), (67.5, 66), (68.5, 89), (56, 101), (43.5, 89)]], sk, shade=(3.5, 1.5), hi=(1.2, -1), rim=0.8)
    neck.poly([(44, 66), (68, 66), (67, 80), (56, 84), (45, 80)], sk["sh"])           # under-jaw shadow
    neck.line([(52, 86), (56, 91), (60, 86)], sk["dk"], 0.5)                        # throat notch
    neck.commit()
    col = Part(cv, [[(41, 84.5), (49.5, 89), (56, 101.5), (50, 104), (38, 92)], [(71, 84.5), (62.5, 89), (56, 101.5), (62, 104), (74, 92)]],
               shirt, shade=(2.5, 2), hi=(1, -1), rim=0.6, ink=0.6)
    col.line([(49.5, 89), (56, 101.5)], shirt["dk"], 0.5)
    col.line([(62.5, 89), (56, 101.5)], shirt["dk"], 0.5)
    col.commit()
    # ears
    for sgn in (-1, 1):
        ear = [(CX + sgn*dx, y) for dx, y in [(20, 41), (25.6, 39.2), (28.8, 42.6), (28.6, 49.5), (26.4, 56.4), (22.6, 59.4), (20.4, 58)]]
        e = Part(cv, [ear], sk, shade=(2.4 * sgn * -1 if sgn < 0 else 2.4, 1.5), hi=(1, -1), rim=0.6, ink=0.7)
        e.line([(CX + sgn*25.2, 43), (CX + sgn*26.6, 48.5), (CX + sgn*25.0, 54)], sk["dk"], 0.6)
        e.commit()
    # face: oval, fuller rounded cheeks, rounded jaw
    face = mirror([(0, 13.5), (8.5, 14.2), (15.5, 17.5), (20.2, 23.5), (22.2, 31), (22.8, 39), (23.2, 47),
                   (23.6, 54), (23.0, 60.5), (20.8, 66.5), (17.2, 71.6), (12.0, 75.6), (6.0, 78.0), (0, 78.8)])
    h = Part(cv, [face], sk, shade=(3.2, 2.2), hi=(1.4, -1.2), rim=0.8, deep=(1.2, 0.9))
    soft = mix(sk["base"], sk["sh"], 0.55)
    # right-side (shadow side) cheek/jaw plane + under-cheek softness
    h.poly([(CX + 13, 50), (CX + 23.4, 50), (CX + 23.0, 60.5), (CX + 20.8, 66.5), (CX + 17, 71.4), (CX + 12, 74.5), (CX + 15.5, 64)], soft)
    h.poly([(CX - 18, 64.5), (CX - 10, 72), (CX - 5, 75.6), (CX + 5, 75.6), (CX + 10, 72), (CX + 18, 64.5),
            (CX + 17.2, 71.6), (CX + 12, 75.6), (CX + 6, 78), (CX, 78.8), (CX - 6, 78), (CX - 12, 75.6), (CX - 17.2, 71.6)], soft)
    # fuller cheeks: soft under-cheek shading curves + a faint warm glow
    h.line([(CX - 19.5, 55), (CX - 16.5, 62), (CX - 12, 66.5)], soft, 1.2)
    h.line([(CX + 19.5, 55), (CX + 16.5, 62), (CX + 12, 66.5)], sk["sh"], 1.2)
    h.poly(ellipse_pts((CX - 14, 54), 4.4, 2.6, n=18), mix(sk["base"], (240, 170, 150), 0.18))
    h.poly(ellipse_pts((CX + 14, 54), 4.4, 2.6, n=18), mix(sk["base"], (230, 160, 140), 0.22))
    h.poly(ellipse_pts((CX - 11, 30), 6, 3, n=16), sk["hi"])                          # forehead light
    # buzz cut: dark cap with straight hairline + short temples/sideburns
    edge_c = mix(sk["sh"], hair["base"], 0.55)
    cap_e = mirror([(0, 11.0), (9, 11.6), (16.6, 15), (21.6, 21.5), (23.6, 30), (23.9, 41), (22.6, 46),
                    (21.0, 46), (20.2, 34), (17.6, 29.2), (11, 27.8), (0, 27.4)])
    h.poly(cap_e, edge_c)
    cap = mirror([(0, 10.4), (9, 11.0), (16.6, 14.4), (21.6, 21), (23.4, 29), (23.6, 39), (22.2, 43),
                  (21.0, 43), (20.6, 33), (17.8, 28.0), (11, 26.6), (0, 26.2)])
    h.poly(cap, hair["base"])
    h.line([(CX - 13, 15.5), (CX - 4, 13.2), (CX + 6, 13.6)], hair["hi"], 0.9)          # buzz sheen
    h.line([(CX - 16, 19), (CX - 10, 16.6)], hair["hi"], 0.6)
    h.line([(CX - 11, 26.4), (CX + 11, 26.4)], hair["dk"], 0.6)                         # straight hairline
    # thick, straight dark brows
    for sgn in (-1, 1):
        x0, x1 = CX + sgn*4.2, CX + sgn*17.6
        h.poly([(x0, 35.2), (x1, 34.6), (x1 + sgn*0.6, 37.6), (x0, 38.4)], hair["base"])
        h.line([(x0 + sgn*1, 35.4), (x1 - sgn*1.5, 34.9)], hair["hi"], 0.4)
    # eyes: almond, dark iris, upper lid, lower lid
    for sgn in (-1, 1):
        ex = CX + sgn*10.6
        white = [(ex - 5.2, 43.6), (ex - 2, 41.6), (ex + 2.4, 41.6), (ex + 5.2, 43.4), (ex + 2.4, 45.3), (ex - 2.2, 45.4)]
        h.poly(white, C(234, 222, 212))
        h.poly(ellipse_pts((ex - sgn*0.3, 43.4), 2.5, 2.1, n=16), C(46, 30, 24))
        h.poly(ellipse_pts((ex - sgn*0.3, 43.4), 1.2, 1.2, n=12), C(14, 10, 8))
        h.dot((ex - sgn*0.3 - 0.8, 42.6), 0.55, C(255, 250, 244))
        h.line([(ex - 5.4, 43.8), (ex - 2, 41.3), (ex + 2.4, 41.3), (ex + 5.4, 43.4)], C(40, 26, 22), 0.8)
        h.line([(ex - 3.6, 46.2), (ex + 3.4, 46.0)], sk["sh"], 0.5)
        h.line([(ex - 4.4, 39.6), (ex + 4.0, 39.4)], sk["sh"], 0.45)                   # lid crease
    # nose: straight bridge (shadow side), rounded tip, nostrils
    h.line([(CX + 2.4, 42), (CX + 3.2, 52), (CX + 4.6, 56.4)], sk["sh"], 0.7)
    h.poly([(CX - 4.2, 57.2), (CX - 2, 55.4), (CX + 2, 55.4), (CX + 4.4, 57.2), (CX + 2.6, 59.2), (CX - 2.6, 59.2)], sk["sh"])
    h.poly(ellipse_pts((CX - 0.6, 56.0), 2.2, 1.4, n=12), sk["hi"])
    h.dot((CX - 2.4, 58.4), 0.8, sk["dk"]); h.dot((CX + 2.4, 58.4), 0.8, sk["dk"])
    h.line([(CX - 8.6, 58), (CX - 10.4, 64)], sk["sh"], 0.5)                           # smile folds
    h.line([(CX + 8.6, 58), (CX + 10.4, 64)], sk["sh"], 0.5)
    # thin mustache (slight downward taper at the corners)
    h.poly([(CX - 7.6, 63.6), (CX - 5.4, 61.8), (CX - 1.2, 61.2), (CX, 61.5), (CX + 1.2, 61.2), (CX + 5.4, 61.8), (CX + 7.6, 63.6),
            (CX + 6.2, 63.5), (CX + 4.6, 63.0), (CX, 62.8), (CX - 4.6, 63.0), (CX - 6.2, 63.5)], hair["base"])
    # mouth: closed, neutral
    h.poly([(CX - 5.6, 64.8), (CX + 5.6, 64.8), (CX + 4, 67.2), (CX - 4, 67.2)], C(214, 140, 128))
    h.line([(CX - 6.0, 65.0), (CX, 64.6), (CX + 6.0, 65.0)], C(140, 78, 70), 0.6)
    h.line([(CX - 3.2, 66.8), (CX + 3.2, 66.8)], C(236, 170, 156), 0.4)
    # soul patch + faint chin stubble
    h.poly(ellipse_pts((CX, 74.0), 7.5, 3.6, n=18), mix(sk["base"], hair["base"], 0.10))
    h.poly([(CX - 2.6, 68.8), (CX + 2.6, 68.8), (CX + 2.0, 72.6), (CX, 74.0), (CX - 2.0, 72.6)], hair["base"])
    h.commit()
    return finish(cv, outline=1)

def build_portrait_ironclad():
    """112x112 front bust for 'Hell's Nightmare' (key ironclad) v2, helmet on: angular green helmet, wide gold
    visor, grey boxy jaw/breather, olive chest plate + big pauldrons over tan undersuit, brown strap, bronze star."""
    set_outfit("ironclad")
    cv = Canvas(112, 112); CX = 56.0
    pl = STYLE["plate"]; gun = STYLE["gun"]; lea = STYLE["leather"]; tan = PAL["shirt"]
    def mirror(half): return [(CX + dx, y) for dx, y in half] + [(CX - dx, y) for dx, y in reversed(half)]
    body = Part(cv, [[(10, 113), (12, 98), (26, 89), (44, 85), (56, 86), (68, 85), (86, 89), (100, 98), (102, 113)]], tan,
                shade=(5, 3), hi=(1.4, -1.4), rim=1.2, deep=(2, 1.5))
    body.poly([(28, 92), (44, 88), (68, 88), (84, 92), (82, 113), (30, 113)], pl["base"])                     # chest plate
    body.poly([(28, 92), (44, 88), (48, 88), (36, 96), (34, 113), (30, 113)], pl["sh"])
    body.poly([(62, 89), (68, 88), (80, 92), (76, 96), (64, 93)], pl["hi"])
    body.line([(30, 104), (82, 104)], SEAMC(), 0.7)
    body.poly([(32, 87), (40, 87), (50, 113), (42, 113)], lea["base"]); body.line([(33, 87), (43, 113)], lea["hi"], 0.5)   # diagonal strap
    body.poly(star_pts((70, 98), 5.2, 0), C(40, 26, 14)); body.poly(star_pts((70, 98), 4.2, 0), C(198, 142, 66))
    body.poly(star_pts((69.6, 97.4), 1.8, 0), C(240, 200, 130))
    for a_, b_ in (((58, 108), (64, 110)), ((74, 106), (80, 108))): body.line([a_, b_], SCUFF, 0.6)
    body.poly([(52, 96), (57, 95), (58, 99), (53, 100)], SCORCH)
    body.commit()
    neck = Part(cv, [[(42, 74), (70, 74), (72, 89), (40, 89)]], gun, shade=(3, 1.5), hi=(1, -1), rim=0.6)
    neck.line([(42, 84), (70, 84)], gun["dk"], 0.6); neck.commit()
    for sgn in (-1, 1):                                    # big rounded pauldrons
        c = (CX + sgn * 39, 96)
        pa = Part(cv, [ellipse_pts(c, 18, 14, n=26)], pl, shade=(3 if sgn > 0 else -3, 2.4), hi=(1.4, -1.4), rim=1.0, ink=0.85)
        pa.poly(ellipse_pts((c[0], c[1] + 8.5), 16, 3.8, n=18), pl["sh"]); pa.line([(c[0] - 15, c[1] + 6.5), (c[0] + 15, c[1] + 6.5)], SEAMC(), 0.6)
        pa.poly(ellipse_pts((c[0] - 3 * sgn, c[1] - 5), 8, 3.4, n=14), pl["hi"])
        pa.line([(c[0] - 7, c[1] - 1), (c[0] + 2, c[1] + 3)], SCUFF, 0.6); pa.poly(ellipse_pts((c[0] + 6 * sgn, c[1] + 1), 3, 2, n=10), SCORCH)
        pa.poly(ellipse_pts((c[0] - 6 * sgn, c[1] + 2), 1.8, 1.2, n=8), pl["dk"])
        pa.commit()
    shell = mirror([(0, 9), (14, 9.4), (22, 12.6), (27, 19), (28.6, 30), (28.6, 50), (27, 62), (22, 72), (12, 78.6), (0, 80)])
    h = Part(cv, [shell], pl, shade=(3.6, 2.4), hi=(1.6, -1.4), rim=1.0, deep=(1.4, 1.0))
    h.poly(mirror([(0, 9), (14, 9.4), (22, 12.6), (24, 16), (14, 14.6), (0, 14.4)]), pl["hi"])                  # flat crown bevel
    for sgn in (-1, 1):                                    # square side plates
        h.poly([(CX + sgn * 23, 46), (CX + sgn * 28.4, 46), (CX + sgn * 28.4, 60), (CX + sgn * 23, 60)], gun["base"])
        h.dot((CX + sgn * 25.6, 53), 1.2, gun["hi"])
    jaw = mirror([(0, 57), (16, 57), (19.5, 62), (18, 72), (11, 77.6), (0, 78.6)])
    h.poly(jaw, gun["base"]); h.poly(mirror([(0, 57), (16, 57), (17, 60), (0, 60)]), gun["sh"])
    for yy in (65, 69, 73): h.line([(CX - 11, yy), (CX + 11, yy)], gun["dk"], 0.7)                               # horizontal breather slats
    h.poly(mirror([(0, 31), (16, 31.4), (25, 33.5), (29, 37), (29, 52), (25, 55.4), (16, 56.4), (0, 56.6)]), C(40, 26, 12))   # visor frame
    h.poly(mirror([(0, 33.6), (16, 34), (24, 36), (27, 39), (27, 50.4), (24, 53), (16, 53.8), (0, 54)]), C(212, 150, 38))
    h.poly(mirror([(0, 35.6), (16, 36), (23, 38), (25, 41), (25, 44), (16, 44.4), (0, 44.6)]), C(250, 202, 76))
    h.poly(mirror([(0, 49), (16, 49), (24, 48.6), (26.6, 48.4), (26.6, 50.6), (24, 53), (16, 53.8), (0, 54)]), C(170, 112, 30))
    h.line([(CX - 20, 39.6), (CX + 20, 39.6)], C(255, 244, 196), 1.0)
    h.line([(CX + 4, 37.5), (CX + 14, 37.5)], C(255, 252, 230), 0.8)
    for a_, b_ in (((CX - 14, 18), (CX - 7, 14)), ((CX + 8, 22), (CX + 15, 25)), ((CX - 24, 62), (CX - 20, 68))): h.line([a_, b_], SCUFF, 0.6)
    h.poly([(CX + 16, 15), (CX + 22, 18), (CX + 20, 24), (CX + 14, 21)], SCORCH)
    h.poly(ellipse_pts((CX - 16, 24), 2.4, 1.6, n=10), pl["dk"])                                                 # dent
    h.commit()
    out = finish(cv, outline=1)
    set_outfit("polo")
    return out

if __name__ == "__main__":
    # usage: gen_matthew_v2.py [outdir] [--outfit ID|all] [--no-portrait]
    args = [a for a in sys.argv[1:]]
    want = "all"
    if "--outfit" in args:
        j = args.index("--outfit"); want = args[j+1]; del args[j:j+2]
    portrait = "--no-portrait" not in args
    args = [a for a in args if not a.startswith("--")]
    out = args[0] if args else SPR
    ids = list(OUTFITS) if want == "all" else [want]
    for oid in ids:
        set_outfit(oid)
        sheet, frames = build_sheet()
        if oid == "polo":                       # locked default sheet + still
            sheet.save(os.path.join(out, "matthew_sheet.png"))
            build_idle().save(os.path.join(out, "matthew_idle.png"))
            if portrait:
                build_portrait().save(os.path.join(out, "portrait_matthew_v3_side.png"))
        else:
            sheet.save(os.path.join(out, "matthew_%s.png" % oid))
        if oid == "ironclad":                   # outfit-specific HUD/picker bust (helmet on)
            build_portrait_ironclad().save(os.path.join(out, "portrait_matthew_ironclad.png"))
            set_outfit(oid)
        print("outfit", oid)
    if portrait:
        build_portrait_front().save(os.path.join(out, "portrait_matthew.png"))
    set_outfit("polo")
    print("wrote", out)
