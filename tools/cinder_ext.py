"""1.7.0 Matthew outfit `cinder` ("Cinder Hollow Orange"): classic orange jumpsuit with a stenciled number patch (0417),
white tee at the collar, snap front, canvas slip-ons. Unlocked by visiting Silas Boone in cell C-14.
Kit: weapon "Mess Hall Tray", signature move "Chow Line" (a long tray-first shoulder rush that shoves everyone in a line)."""
import math, os, sys
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
import gen_matthew_v2 as g
import kit_draw as kd
import gen_kits as gk
from gen_matthew_v2 import C, ramp, add, mix
from gen_kits import K, Fr, X, W, bob

OID = "cinder"; KEY = "matthew_cinder"
WEAPON, MOVE = "Mess Hall Tray", "Chow Line"
ORANGE = (222, 116, 34)
g.OUTFITS[OID] = dict(
    top="jacket", untucked=True, sleeves="long", coveralls=True, jumpsuit=True, hem="plain",
    accent=ramp((48, 48, 56)), inner=ramp((238, 236, 228)), shoe="sneaker",
    pal=dict(shirt=ramp(ORANGE), jeans=ramp(ORANGE), cuff=ramp((200, 100, 28)),
             boot=ramp((236, 232, 222), sh=0.84, dk=0.66), sole=ramp((70, 70, 76), sh=0.8, dk=0.6)))

SEG = {"0": "abcdef", "1": "bc", "2": "abged", "3": "abgcd", "4": "fgbc", "5": "afgcd", "6": "afgedc", "7": "abc", "8": "abcdefg", "9": "abcfgd"}
def seg_digit(p, T, x, y, d, w=1.9, h=3.4, col=C(30, 28, 32), lw=0.42):
    pts = dict(a=((x, y), (x + w, y)), b=((x + w, y), (x + w, y + h / 2)), c=((x + w, y + h / 2), (x + w, y + h)),
               d=((x, y + h), (x + w, y + h)), e=((x, y + h / 2), (x, y + h)), f=((x, y), (x, y + h / 2)), g=((x, y + h / 2), (x + w, y + h / 2)))
    for s in SEG[d]:
        a, b = pts[s]; p.line([T(a), T(b)], col, lw)

_cov = g.draw_coveralls_detail
def draw_coveralls_detail(p, T, pal, sk):
    if not g.STYLE.get("jumpsuit"): return _cov(p, T, pal, sk)
    tee = g.STYLE["inner"]
    # V collar with white tee showing
    p.poly([T(q) for q in [(1.0, -51), (11.0, -51), (7.0, -41.0)]], tee["base"])
    p.line([T((1.0, -51)), T((7.0, -41.0)), T((11.0, -51))], pal["dk"], 0.55)
    p.poly([T(q) for q in [(-1.8, -51.4), (1.4, -51.2), (6.4, -41.6), (2.0, -45.0)]], pal["hi"])   # collar flap
    p.poly([T(q) for q in [(10.6, -51.2), (14.2, -48.6), (8.0, -41.4)]], pal["base"])
    # snap placket
    p.line([T((7.0, -41)), T((7.6, -24)), T((7.8, -8)), T((7.6, 12))], pal["dk"], 0.5)
    for y in (-36, -28, -20, -12, -4, 4):
        p.dot(T((7.4 + 0.02 * y, y)), 0.55, C(210, 210, 214))
    # number patch (white cloth, 4 stenciled digits)
    p.poly([T(q) for q in [(9.6, -37.4), (21.0, -37.6), (21.0, -31.0), (9.6, -30.8)]], C(240, 236, 224))
    p.line([T((9.6, -37.4)), T((21.0, -37.6)), T((21.0, -31.0)), T((9.6, -30.8)), T((9.6, -37.4))], C(120, 110, 100), 0.35)
    for i, dch in enumerate("0417"):
        seg_digit(p, T, 10.5 + i * 2.6, -36.4, dch, w=1.7, h=4.4)
    # left chest pocket + waist seam
    p.poly([T(q) for q in [(-9.0, -36), (-1.0, -36.2), (-1.0, -29.6), (-9.0, -29.4)]], pal["sh"])
    p.line([T((-9.0, -34.8)), T((-1.0, -35.0))], pal["dk"], 0.5)
    p.line([T((-15.6, 2.2)), T((17.0, 1.6))], pal["dk"], 0.55)
    # stencil stripe on the hip
    p.poly([T(q) for q in [(-14, 8), (-4, 7.6), (-4, 10.4), (-14, 10.8)]], C(40, 40, 46))
g.draw_coveralls_detail = draw_coveralls_detail

# ------------------------------------------------------------------ weapon: Mess Hall Tray
def w_tray(cv, c=None, ang=0, f=None, **_):
    f = c if c is not None else f
    T = kd.Rf(f, ang); body = ramp((150, 156, 164), hi=(214, 218, 224)); rim = ramp((112, 118, 128))
    outer = [(-2, -11), (22, -11), (23, 9), (-1, 9)]
    b = kd.mk(cv, [[T(q) for q in outer]], body, shade=(1.4, 1.0), hi=(0.7, -0.7), rim=0.8, ink=0.75)
    for poly in ([(1, -8.4), (10.6, -8.4), (10.6, -1.4), (1, -1.4)], [(12.6, -8.4), (20.2, -8.4), (20.2, -1.4), (12.6, -1.4)],
                 [(1, 0.6), (20.2, 0.6), (20.6, 6.6), (1.4, 6.6)]):
        b.poly([T(q) for q in poly], rim["sh"])
    b.line([T((0, -10)), T((21, -10))], C(230, 232, 236), 0.5)
    b.commit()
    return [T(q) for q in outer]
kd.DRAW["tray"] = w_tray
_resolve = gk.resolve
def resolve(P, it):
    if it["kind"] == "tray":
        kw = {kk: v for kk, v in it.items() if kk not in ("kind", "at", "hit", "off", "tail", "tailf", "wrel", "layer")}
        gp = gk.grip(P, it.get("at", "near"))
        kw["c"] = add(gp, it.get("off", (0, 0)))
        return "tray", kw
    return _resolve(P, it)
gk.resolve = resolve

def fx_rush(cv, c, r, k=0, **_):
    """Chow Line: dust wedge + orange speed streaks trailing the rush."""
    for i in range(3):
        y = c[1] - 18 + i * 12
        st = kd.mk(cv, kd.stroke([(c[0] - r - i * 6, y), (c[0] - 6, y + 1)], 1.6 - i * 0.3, n=6), ramp((250, 186, 120)), shade=(0, 0), hi=None, rim=0, ink=0)
        st.commit()
    d = kd.mk(cv, [kd.ell_path((c[0] - r * 0.4, c[1] + 22), r * 0.5, 5 + k, n=20)], ramp((178, 160, 140)), shade=(0.4, 0.4), hi=None, rim=0, ink=0.3)
    d.commit()
    return [(c[0] - r - 20, c[1] - 24), (c[0] + 4, c[1] + 30)]
kd.DRAW["rush"] = fx_rush

NR = dict(regrip=False)
def kit_cinder():
    idle = []
    for k in range(6):                       # tray spun flat on the near fingertips, far hand on hip
        dy, r = bob(k)
        P = K(torso=(66, 103 + dy), lean=3, head=1.2 * r, nh=(86, 82 + dy), fh=(96, 100 + dy), near_knee=(55, 142 + dy * 0.6), far_knee=(86, 141 + dy * 0.6))
        idle.append(Fr(P, front=[W("tray", at="near", off=(-10, -4), ang=-8 + 16 * math.sin(2 * math.pi * k / 6))]))
    c3 = [Fr(K(torso=(62, 106), lean=-6, head=2, nh=(48, 76), fh=(92, 84), lg="back"), back=[W("tray", at="near", off=(-6, -6), ang=-70)]),
          Fr(K(torso=(72, 105), lean=12, head=-2, nh=(110, 74), fh=(92, 86), lg="lunge"), front=[W("tray", at="near", off=(0, -8), ang=-10, hit=True)],
             fx=[X("lines", c=(140, 70), r0=8, r1=16, angs=(-50, -15, 20, 55))]),
          Fr(K(torso=(74, 106), lean=14, head=-2, nh=(114, 80), fh=(92, 86), lg="lunge"), front=[W("tray", at="near", off=(0, -8), ang=4, hit=True)]),
          Fr(K(torso=(67, 104), lean=4, nh=(86, 86), fh=(96, 100)), front=[W("tray", at="near", off=(-10, -4), ang=-6)])]
    sp = [Fr(K(torso=(62, 108), lean=-4, head=2, nh=(80, 80), fh=(84, 86), lg="crouch"), front=[W("tray", at="near", off=(0, -10), ang=-90)], **NR),
          Fr(K(torso=(70, 108), lean=14, head=-2, nh=(104, 78), fh=(100, 90), lg="lunge"), front=[W("tray", at="near", off=(0, -10), ang=-90, hit=True)],
             fx=[X("rush", c=(70, 100), r=40, k=0)], **NR, dx=6),
          Fr(K(torso=(76, 108), lean=18, head=-4, nh=(110, 78), fh=(104, 90), lg="lunge"), front=[W("tray", at="near", off=(0, -10), ang=-90, hit=True)],
             fx=[X("rush", c=(76, 100), r=56, k=1), X("lines", c=(124, 80), r0=10, r1=20, angs=(-40, 0, 40))], **NR, dx=14),
          Fr(K(torso=(80, 108), lean=18, head=-4, nh=(114, 78), fh=(106, 90), lg="lunge"), front=[W("tray", at="near", off=(0, -10), ang=-90, hit=True)],
             fx=[X("rush", c=(80, 100), r=60, k=1)], **NR, dx=20),
          Fr(K(torso=(76, 106), lean=10, head=-2, nh=(108, 82), fh=(100, 92), lg="stride"), front=[W("tray", at="near", off=(0, -10), ang=-80)], **NR, dx=18),
          Fr(K(torso=(70, 104), lean=6, nh=(94, 86), fh=(98, 96)), front=[W("tray", at="near", off=(-6, -6), ang=-40)], **NR, dx=12),
          Fr(K(torso=(67, 104), lean=4, nh=(88, 84), fh=(96, 100)), front=[W("tray", at="near", off=(-10, -4), ang=-10)], **NR, dx=6),
          Fr(K(torso=(66, 103), lean=3, nh=(86, 82), fh=(96, 100)), front=[W("tray", at="near", off=(-10, -4), ang=-8)], **NR)]
    return idle, c3, [1, 2], sp, [1, 2, 3]

gk.KITS[OID] = kit_cinder
gk.KIT[OID] = (WEAPON, MOVE)
if OID not in gk.OUTFITS: gk.OUTFITS.append(OID)

def weapon_icon():
    import gen_weapon_icons as wi
    from PIL import Image
    g.set_outfit(OID)
    cv = wi.PadCV(wi.CELL)
    w_tray(cv, c=(14, 26), ang=-20)
    big = g.finish(cv); bb = big.getchannel("A").getbbox()
    w, h = bb[2] - bb[0], bb[3] - bb[1]
    out = Image.new("RGBA", (48, 48), (0, 0, 0, 0))
    crop = big.crop(bb)
    if w > 46 or h > 46:
        s = min(46 / w, 46 / h); crop = crop.resize((max(1, int(w * s)), max(1, int(h * s)))); w, h = crop.size
    out.paste(crop, ((48 - w) // 2, (48 - h) // 2))
    g.set_outfit("polo")
    return out
