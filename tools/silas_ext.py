"""Matthew outfit `silas` (Silas Boone's look on Matthew's locked head/build) - STAGING extension of the shared rig.
Lives in tools/ and imports the shared rig modules from tools/ (gen_matthew_v2, gen_cast, gen_anims, kit_draw, gen_kits). Registers:
  g.OUTFITS["silas"]          = exact gen_cast.SILAS["fit"] (coat (40,54,72), trousers (28,30,38), inner (214,216,222),
                                crimson (170,30,40), gloves (26,26,30), boots (22,22,26), soles (14,14,16)); no hat, no cane
  kit_draw.DRAW["gauntlet"]   = Iron Gauntlet (weapon) ; DRAW["shockring"] = ground shockwave ring
  gen_kits KITS/KIT["silas"]  = idle_signature / combo3 / special "Iron Handshake"
  MOVES                       = Silas six-move set for Matthew-in-silas (gentlemans_jab ... boss_rush)
"""
import inspect, io, math, os, sys, textwrap
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)                                # tools/
from PIL import Image
import gen_matthew_v2 as g
import gen_cast as gc
import gen_anims as ga
import kit_draw as kd
import gen_kits as gk
from gen_matthew_v2 import C, Part, add, rot, lerp, ramp, taper, ellipse_pts, star_pts, mix, FW, FH
from gen_kits import K, Fr, W, X, bob, TLp, grip

OID = "silas"; KEY = "matthew_silas"
WEAPON, MOVE = "Iron Gauntlet", "Iron Handshake"

# ------------------------------------------------------------------ outfit (exact Silas fit, Matthew head/skin/build untouched)
g.OUTFITS[OID] = dict(gc.SILAS["fit"])
assert g.OUTFITS[OID]["top"] == "coat" and "headwear" not in g.OUTFITS[OID]

# ------------------------------------------------------------------ weapon + FX drawers
IRON = ramp((96, 100, 112), hi=(176, 182, 196)); RIVET = C(40, 42, 50); CRIMSON = C(170, 30, 40)
def w_gauntlet(cv, f, el, open_hand=False, glint=False, **_):
    """Iron Gauntlet over Silas's black glove: riveted bracer on the forearm (crimson cuff line) + knuckle plate."""
    ang = math.degrees(math.atan2(f[1] - el[1], f[0] - el[0]))
    b0 = lerp(el, f, 0.40); b1 = lerp(el, f, 0.80)
    br = kd.mk(cv, [taper(b0, 6.4, b1, 6.0, n=12)], IRON, shade=(1.4, 1.1), hi=(0.7, -0.7), rim=0.8, ink=0.75)
    T = kd.Rf(b0, ang); L = math.hypot(b1[0] - b0[0], b1[1] - b0[1])
    br.line([T((L * 0.12, -5.0)), T((L * 0.9, -4.6))], IRON["hi"], 0.6)
    br.line([T((L * 0.80, -5.8)), T((L * 0.80, 5.8))], CRIMSON, 0.9)                   # crimson cuff line (Silas accent)
    for t in (0.25, 0.55):
        br.dot(T((L * t, -3.4)), 0.8, RIVET); br.dot(T((L * t, 3.4)), 0.8, RIVET)
    br.commit()
    fc = add(f, rot((1.5, 0), ang)); R = kd.Rf(fc, ang)
    plate = [(-2.6, -5.6), (5.2, -6.0), (7.0, -4.0), (7.2, 3.6), (5.0, 5.4), (-2.6, 5.0)] if not open_hand else \
            [(-3.0, -4.0), (6.0, -4.4), (7.4, -2.6), (7.4, 2.4), (6.0, 3.6), (-3.0, 3.2)]
    kp = kd.mk(cv, [[R(q) for q in plate]], IRON, shade=(1.0, 0.8), hi=(0.6, -0.6), rim=0.6, ink=0.7)
    for i in ((-3.4, -2.6) if open_hand else (-3.6, -0.6, 2.4)):
        kp.dot(R((5.4, i * (0.8 if open_hand else 1))), 0.95, IRON["hi"])           # knuckle studs
    kp.line([R((-1.8, -4.6)), R((-1.8, 4.2))], IRON["dk"], 0.5)
    kp.commit()
    if glint: kd.fx_sparkle(cv, add(fc, rot((5, -6), ang)), 4.2, col=(255, 244, 220))
    return [R(q) for q in plate]

def fx_shockring(cv, c, rx, ry, w=2.2, k=0, **_):
    """Low, wide ground shockwave: flat steel-white ring hugging the floor + dust + crimson flecks (front arc thicker)."""
    path = kd.ell_path(c, rx, ry, n=48)
    p = kd.mk(cv, kd.stroke(path, w, n=6), ramp((206, 212, 226), hi=(246, 248, 255)), shade=(0.5, 0.5), hi=None, rim=0, ink=0.5, ink_col=C(36, 30, 40))
    p.commit()
    q = kd.mk(cv, kd.stroke(kd.ell_path(c, rx, ry, 20, 160, n=24), w * 0.55, n=6), ramp((255, 255, 255)), shade=(0, 0), hi=None, rim=0, ink=0); q.commit()
    for a in (-30, 200, 300) if k else (-30,):
        s = add(c, (rx * math.cos(math.radians(a)), ry * math.sin(math.radians(a))))
        kd.mk(cv, [[add(s, v) for v in [(0, -2.4), (1.5, 0), (0, 2.4), (-1.5, 0)]]], ramp((214, 60, 64), hi=(255, 170, 170)), shade=(0.4, 0.4), hi=None, rim=0, ink=0.4).commit()
    return [add(c, (-rx - w, -ry - w)), add(c, (rx + w, ry + w))]

kd.DRAW["gauntlet"] = w_gauntlet
kd.DRAW["shockring"] = fx_shockring

_orig_resolve = gk.resolve
def resolve(P, it):
    if it["kind"] == "gauntlet":
        at = it.get("at") or "near"
        return "gauntlet", dict(f=TLp(P, P[at + "_fist"]), el=TLp(P, P[at + "_el"]), open_hand=P.get("open_" + at, False), glint=it.get("glint", False))
    return _orig_resolve(P, it)
gk.resolve = resolve

def GA(hit=False, glint=False): return W("gauntlet", hit=hit, glint=glint)
GRIP_POW = dict(col=(214, 60, 64), core=(255, 236, 230))
NR = dict(regrip=False)

# ------------------------------------------------------------------ kit: idle_signature / combo3 / special (Iron Handshake)
def hs_frames(weapon):
    """Iron Handshake, 8 frames @12 (= silas_dlc hs_grab 2 + hs_slam 6). weapon=True -> kit special (Iron Gauntlet);
    weapon=False -> gloved fists only (moves strip hs_grab/hs_slam). Frame 3 (= hs_slam[1]) is airborne (grounded False)."""
    def A(hit=False, glint=False): return [GA(hit=hit, glint=glint)] if weapon else []
    crouch = dict(torso=(72, 120), lean=22, head=6, nh=(104, 126), fh=(110, 122), lg="wide", ldx=2)
    return [Fr(K(torso=(70, 104), lean=8, head=-2, nh=(108, 80), fh=(96, 86), lg="stride", open_near=True), front=A(), **NR),        # 0 reach (active: open hand)
          Fr(K(torso=(74, 105), lean=12, head=-2, nh=(112, 76), fh=(108, 80), lg="stride"), front=A(hit=True), **NR,                   # 1 GRAB (active)
             fx=[X("pow", c=(118, 74), r=5, hit=True, **GRIP_POW), X("lines", c=(118, 74), r0=9, r1=15, angs=(-70, -20, 30, 80))]),
          Fr(K(torso=(66, 102), lean=-8, head=-6, nh=(86, 36), fh=(96, 40), lg="tiptoe"), front=A(), **NR,                            # 2 lift
             mid=[X("swoosh", c=(80, 74), r=40, a0=30, a1=-80, width=8, col=(232, 236, 246))]),
          Fr(K(torso=(64, 104), lean=-12, head=-8, nh=(80, 28), fh=(90, 32), lg="crouch"), front=A(glint=weapon), **NR,                # 3 apex HOP (airborne)
             lift=12, grounded=False),
          Fr(K(**crouch), front=A(hit=True), **NR,                                                                                     # 4 SLAM (active)
             mid=[X("swoosh", c=(84, 100), r=54, a0=-100, a1=30, width=11, col=(232, 236, 246))],
             fx=[X("pow", c=(122, 172), r=10, col=(226, 230, 240), core=(255, 255, 255), hit=True), X("crack", c=(122, 186), k=1, hit=True),
                 X("lines", c=(122, 174), r0=14, r1=24, angs=(-160, -130, -100, -70, -40, -10))]),
          Fr(K(**crouch), front=A(), **NR,                                                                                            # 5 SHOCKWAVE (active, low+wide)
             fx=[X("crack", c=(122, 186), k=2), X("shockring", c=(128, 180), rx=40, ry=5.5, w=2.2, k=1, hit=True), X("dust", c=(120, 186), k=1, spread=1.6)]),
          Fr(K(**{**crouch, "torso": (72, 116), "lean": 16}), front=A(), **NR,                                                        # 6 ring dissipates
             fx=[X("shockring", c=(134, 181), rx=48, ry=5, w=1.4, k=0), X("dust", c=(130, 186), k=0, spread=2.2)]),
          Fr(K(torso=(67, 106), lean=6, nh=(82, 96), fh=(98, 76)), front=A(), **NR)]                                                 # 7 recover

def kit_silas():
    idle = []
    for k in range(6):                       # cracks the iron knuckles: fist at the belt -> raised, opened, re-clenched (glint)
        dy, r = bob(k)
        up = k in (2, 3)
        P = K(torso=(66, 104 + dy), lean=2, head=1.2 * r + (2 if up else 0), nh=(88, 82 + dy) if up else (82, 96 + dy), fh=(98, 76 + dy), lg="stance",
              near_knee=(55, 142 + dy * 0.6), far_knee=(86, 141 + dy * 0.6), open_near=(k == 2))
        idle.append(Fr(P, front=[GA(glint=(k == 3))], **NR))
    c3 = [Fr(K(torso=(62, 106), lean=-6, head=2, nh=(52, 94), fh=(96, 76), lg="back"), front=[GA()], **NR),
          Fr(K(torso=(72, 105), lean=12, head=-2, nh=(116, 72), fh=(90, 86), lg="lunge"), front=[GA(hit=True)], **NR,
             mid=[X("swoosh", c=(74, 84), r=40, a0=160, a1=20, width=7, col=(232, 236, 246))],
             fx=[X("pow", c=(118, 70), r=6, col=(226, 230, 240), core=(255, 255, 255), hit=True)]),
          Fr(K(torso=(74, 106), lean=14, head=-2, nh=(118, 74), fh=(90, 86), lg="lunge"), front=[GA(hit=True)], **NR,
             fx=[X("pow", c=(120, 72), r=9, col=(226, 230, 240), core=(255, 255, 255), hit=True), X("lines", c=(120, 72), r0=12, r1=19, angs=(-50, -15, 20, 55))]),
          Fr(K(torso=(67, 104), lean=4, nh=(82, 96), fh=(98, 76)), front=[GA()], **NR)]
    sp = hs_frames(weapon=True)
    return idle, c3, [1, 2], sp, [0, 1, 4, 5]   # matches silas_dlc special active [0,1,4,5]

gk.KITS[OID] = kit_silas
gk.KIT[OID] = (WEAPON, MOVE)
if OID not in gk.OUTFITS: gk.OUTFITS.append(OID)

# ------------------------------------------------------------------ the six Silas moves (Matthew-in-silas)
def guard(dy=0): return dict(torso=(66, 104 + dy), lean=4, nh=(84, 92 + dy), fh=(100, 76 + dy))
def moves():
    """Matthew-in-silas move set, timing = silas_dlc/anims_silas_player.json (Jack, final). GLOVED FISTS ONLY (no gauntlet,
    no hat, no cane). Each entry: frames, fps, loop, active, width (forced 144 or 240). Aliases are added by build_silas.py."""
    st = {}
    pw = dict(col=(226, 230, 240), core=(255, 255, 255))
    # jab1 = Gentleman's Jab hit 1: lead (far-hand) jab. 3 @14, active [1]. 144 wide.
    st["jab1"] = dict(width=144, fps=14, loop=False, active={1}, frames=[
        Fr(K(**guard()), **NR),
        Fr(K(torso=(70, 104), lean=8, nh=(84, 90), fh=(122, 70)), hand_hit="far", **NR, fx=[X("lines", c=(127, 68), r0=3, r1=8, angs=(-40, 0, 40))]),
        Fr(K(torso=(68, 104), lean=6, nh=(84, 90), fh=(104, 74)), **NR)])
    # jab2 = hit 2: low rear body shot (near hand). 3 @14, active [1]. 144 wide.
    st["jab2"] = dict(width=144, fps=14, loop=False, active={1}, frames=[
        Fr(K(torso=(66, 106), lean=-2, nh=(70, 100), fh=(98, 78)), **NR),
        Fr(K(torso=(72, 110), lean=14, head=-2, nh=(116, 102), fh=(96, 80), lg="lunge"), hand_hit="near", **NR,
           fx=[X("pow", c=(121, 102), r=5, hit=True, **pw)]),
        Fr(K(torso=(68, 106), lean=6, nh=(92, 98), fh=(100, 78)), **NR)])
    # jab3 = hit 3: rising finisher + burst. 5 @12, active [1,2]. 144 wide.
    st["jab3"] = dict(width=144, fps=12, loop=False, active={1, 2}, frames=[
        Fr(K(torso=(64, 110), lean=-4, nh=(70, 110), fh=(96, 82), lg="crouch"), **NR),
        Fr(K(torso=(72, 104), lean=10, head=-4, nh=(110, 72), fh=(94, 84), lg="lunge"), **NR, fx=[X("pow", c=(114, 70), r=6, hit=True, **pw)]),
        Fr(K(torso=(72, 102), lean=6, head=-6, nh=(110, 52), fh=(94, 82), lg="tiptoe"), **NR,
           fx=[X("pow", c=(112, 50), r=8, hit=True, **pw), X("lines", c=(112, 50), r0=11, r1=17, angs=(-150, -110, -70, -30, 10))]),
        Fr(K(torso=(68, 104), lean=2, head=-3, nh=(100, 64), fh=(96, 80)), **NR),
        Fr(K(**guard()), **NR)])
    # velvet_grip_grab 4 @10 active [1,2,3] (reach, clamp, squeeze) / velvet_grip_throw 5 @12 active [3] (release). 240 wide.
    hold = dict(torso=(72, 104), lean=8, nh=(108, 74), fh=(112, 70), lg="stride")
    st["velvet_grip_grab"] = dict(width=240, fps=10, loop=False, active={1, 2, 3}, frames=[
        Fr(K(torso=(62, 107), lean=-6, nh=(80, 92), fh=(96, 84), lg="back"), **NR),
        Fr(K(torso=(74, 106), lean=18, head=-4, nh=(112, 78), fh=(118, 72), lg="lunge", open_near=True, open_far=True), hand_hit="far", **NR,
           fx=[X("speed", x0=8, x1=36, ys=[80, 98, 116])]),
        Fr(K(**hold), **NR, fx=[X("pow", c=(116, 72), r=5, hit=True, **GRIP_POW), X("lines", c=(116, 72), r0=8, r1=14, angs=(-60, -10, 40))]),
        Fr(K(**hold), **NR, fx=[X("pow", c=(116, 72), r=3.5, hit=True, **GRIP_POW)])])
    st["velvet_grip_throw"] = dict(width=240, fps=12, loop=False, active={3}, frames=[
        Fr(K(**{**hold, "torso": (70, 104), "lean": 4}), **NR),
        Fr(K(torso=(62, 106), lean=-14, head=-6, nh=(60, 52), fh=(70, 48), lg="back"), **NR),
        Fr(K(torso=(68, 102), lean=0, head=-2, nh=(92, 34), fh=(100, 32), lg="stance", open_near=True, open_far=True), **NR,
           mid=[X("swoosh", c=(80, 70), r=44, a0=-150, a1=-20, width=9, col=(232, 236, 246))]),
        Fr(K(torso=(76, 106), lean=22, head=6, nh=(118, 98), fh=(122, 94), lg="lunge", open_near=True, open_far=True), **NR,
           fx=[X("speed", x0=104, x1=136, ys=[70, 84, 98])], hb=(98, 44, 150, 112)),
        Fr(K(torso=(68, 104), lean=4, nh=(84, 92), fh=(100, 76)), **NR)])
    # Iron Handshake, gloved: hs_grab 2 @10 active [0,1]; hs_slam 6 @12 active [2,3], frame 1 airborne. 240 wide.
    H = hs_frames(weapon=False)
    st["hs_grab"] = dict(width=240, fps=10, loop=False, active={0, 1}, frames=H[:2])
    st["hs_slam"] = dict(width=240, fps=12, loop=False, active={2, 3}, frames=H[2:])
    # last_word_stance 4 @6 LOOP (counter window, 144) -> last_word_strike 4 @14 active [1,2] (240)
    Lw = []
    for k in range(4):
        dy = (0, 1, 2, 1)[k]
        Lw.append(Fr(K(torso=(64, 108 + dy), lean=-4, head=-2, nh=(92, 58 + dy), fh=(98, 88 + dy), lg="wide", ldx=-2), **NR))
    st["last_word_stance"] = dict(width=144, fps=6, loop=True, active=set(), counter=True, frames=Lw)
    st["last_word_strike"] = dict(width=240, fps=14, loop=False, active={1, 2}, counter=False, frames=[
        Fr(K(torso=(66, 106), lean=-6, head=-4, nh=(98, 44), fh=(96, 86), lg="wide", ldx=-2), **NR,
           fx=[X("lines", c=(106, 40), r0=6, r1=13, angs=(-120, -80, -40, 0)), X("sparkle", c=(110, 36), r=5, col=(255, 244, 220))]),
        Fr(K(torso=(76, 106), lean=16, head=0, nh=(124, 74), fh=(94, 86), lg="lunge"), **NR, fx=[X("pow", c=(129, 72), r=9, hit=True, **pw)]),
        Fr(K(torso=(77, 106), lean=16, head=0, nh=(124, 76), fh=(94, 86), lg="lunge"), **NR,
           fx=[X("pow", c=(130, 74), r=12, hit=True, **pw), X("lines", c=(130, 74), r0=16, r1=24, angs=(-60, -25, 10, 45))]),
        Fr(K(torso=(68, 105), lean=6, nh=(84, 92), fh=(100, 78)), **NR)])
    # cold_stare 5 @6, no loop, no hits. 144 wide. Chin drops, gloved hand straightens the lapel, settles.
    def stare(head, nh, open_n=False, dy=0):
        return Fr(K(torso=(65, 103 + dy), lean=-3, head=head, nh=nh, fh=(84, 104 + dy), lg="stance", open_near=open_n), **NR)
    st["cold_stare"] = dict(width=144, fps=6, loop=False, active=set(),
                            frames=[stare(0, (80, 104)), stare(4, (82, 90)), stare(6, (84, 74), True), stare(6, (84, 74), True), stare(6, (82, 98))])
    # boss_rush 6 @14 active [2,3]: shoulder charge, hitbox rides the lead shoulder forward (dx 8 -> 14). 240 wide.
    sc = dict(torso=(76, 106), lean=26, head=-8, nh=(80, 100), fh=(92, 98), lg="lunge")
    st["boss_rush"] = dict(width=240, fps=14, loop=False, active={2, 3}, frames=[
        Fr(K(torso=(60, 110), lean=-4, nh=(60, 98), fh=(80, 94), lg="back"), **NR),
        Fr(K(**sc), **NR, fx=[X("speed", x0=2, x1=40, ys=[76, 94, 112])]),
        Fr(K(**sc), **NR, fx=[X("speed", x0=0, x1=44, ys=[72, 90, 108, 126])], dx=8, hb_sh=True),
        Fr(K(**{**sc, "lean": 28}), **NR, fx=[X("pow", c=(124, 74), r=8, **pw)], dx=14, hb_sh=True),
        Fr(K(torso=(70, 106), lean=10, head=-2, nh=(88, 96), fh=(98, 84)), **NR, dx=6),
        Fr(K(**guard()), **NR)])
    return st

# ------------------------------------------------------------------ move frame job (gen_kits.job_ + explicit hb / moving shoulder box)
def move_job(args):
    state, idx = args
    stt = moves()[state]; spec = stt["frames"][idx]
    im, sx, sy, extra, hits = gk.render_kit(OID, spec)
    hb = None
    if idx in stt["active"]:
        d = spec.get("dx", 0)
        if spec.get("hb"):
            x0, y0, x1, y1 = spec["hb"]; hits = [(x0 + d, y0), (x1 + d, y1)]
        elif spec.get("hb_sh"):                       # lead shoulder + chest front, carried by dx
            s = TLp(spec["P"], spec["P"]["far_sh"]); hits = [(s[0] + d - 8, s[1] - 12), (s[0] + d + 24, s[1] + 40)]
        elif not hits:
            gp = grip(spec["P"], spec.get("hand_hit", "near")); hits = [(gp[0] + d - 12, gp[1] - 12), (gp[0] + d + 12, gp[1] + 12)]
        xs = [p[0] for p in hits]; ys = [p[1] for p in hits]
        x0, x1, y0, y1 = min(xs) - 2, max(xs) + 2, min(ys) - 2, max(ys) + 2
        if x1 - x0 < 20: c = (x0 + x1) / 2; x0, x1 = c - 10, c + 10
        if y1 - y0 < 20: c = (y0 + y1) / 2; y0, y1 = c - 10, c + 10
        hb = dict(x=int(round(x0 + sx)), y=int(round(y0 + sy)), w=int(round(x1 - x0)), h=int(round(y1 - y0)))
    buf = io.BytesIO(); im.save(buf, "PNG")
    return state, idx, buf.getvalue(), dict(grounded=spec.get("grounded", True), lying=False, active=idx in stt["active"], hitbox=hb, extra=extra)

# ------------------------------------------------------------------ portrait (112x112 front bust; face block = verbatim build_portrait_front)
def build_portrait_silas():
    g.set_outfit(OID)
    cv = g.Canvas(112, 112); CX = 56.0
    sk, hair = g.PAL["skin"], g.PAL["hair"]; coat = g.PAL["shirt"]; inner = g.STYLE["inner"]; acc = g.STYLE["accent"]
    def mirror(half): return [(CX + dx, y) for dx, y in half] + [(CX - dx, y) for dx, y in reversed(half)]
    sh_poly = [(4, 113), (3, 100), (8, 92.5), (22, 87.5), (40, 85), (56, 88), (72, 85), (90, 87.5), (104, 92.5), (109, 100), (108, 113)]
    body = Part(cv, [sh_poly], coat, shade=(5, 3), hi=(1.4, -1.4), rim=1.2, deep=(2, 1.5))
    body.line([(24, 96), (30, 112)], coat["sh"], 0.8); body.line([(88, 96), (82, 112)], coat["sh"], 0.8)
    body.commit()
    neck = Part(cv, [[(44.5, 66), (67.5, 66), (68.5, 89), (56, 101), (43.5, 89)]], sk, shade=(3.5, 1.5), hi=(1.2, -1), rim=0.8)
    neck.poly([(44, 66), (68, 66), (67, 80), (56, 84), (45, 80)], sk["sh"]); neck.commit()
    # pale shirt V + closed collar, crimson tie, wide navy lapels, pocket square, double-breasted buttons
    sv = Part(cv, [[(42, 85), (70, 85), (63, 113), (49, 113)]], inner, shade=(2.0, 1.4), hi=(0.8, -0.8), rim=0.5, ink=0.6)
    sv.poly([(53, 92.5), (59, 92.5), (60.4, 97), (58.6, 113), (53.4, 113), (51.6, 97)], acc["base"])          # tie
    sv.poly([(52.6, 88.6), (59.4, 88.6), (58.6, 93.6), (53.4, 93.6)], acc["dk"])                                # knot
    sv.line([(56, 97), (56, 112)], acc["dk"], 0.5)
    sv.commit()
    col = Part(cv, [[(43.5, 84), (52.6, 88.4), (54, 94), (48.4, 96)], [(68.5, 84), (59.4, 88.4), (58, 94), (63.6, 96)]],
               inner, shade=(1.6, 1.2), hi=(0.8, -0.8), rim=0.5, ink=0.6)
    col.commit()
    lap = Part(cv, [[(40, 84.5), (47, 88.5), (52.5, 113), (41, 113), (31, 98), (26, 89)], [(72, 84.5), (65, 88.5), (59.5, 113), (71, 113), (81, 98), (86, 89)]],
               coat, shade=(2.2, 1.6), hi=(1.0, -1.0), rim=0.8, ink=0.7)
    lap.poly([(72, 84.5), (65, 88.5), (59.5, 113), (71, 113), (81, 98), (86, 89)], coat["hi"])
    lap.line([(47, 88.5), (52.5, 113)], coat["dk"], 0.6); lap.line([(65, 88.5), (59.5, 113)], coat["dk"], 0.6)
    lap.commit()
    sq = Part(cv, [[(82, 101), (92, 100.2), (90.4, 104.6), (87, 102.6), (84, 104.8)]], acc, shade=(0.8, 0.6), hi=None, rim=0.4, ink=0.55); sq.commit()
    bt = Part(cv, [ellipse_pts((x, 109), 1.5, 1.5, n=10) for x in (38, 74)], ramp((18, 20, 26)), shade=(0.4, 0.4), hi=None, rim=0, ink=0.4); bt.commit()
    # --- face: the exact code of gen_matthew_v2.build_portrait_front (ears ... soul patch), executed verbatim
    src = inspect.getsource(g.build_portrait_front)
    face = textwrap.dedent(src[src.index("    # ears"): src.index("    return finish")])
    ns = dict(vars(g)); ns.update(cv=cv, sk=sk, hair=hair, CX=CX, mirror=mirror)
    exec(compile(face, "build_portrait_front[face]", "exec"), ns)
    out = g.finish(cv, outline=1)
    g.set_outfit("polo")
    return out

# ------------------------------------------------------------------ weapon icon (weapons.png style, 48x48)
def weapon_icon():
    import gen_weapon_icons as wi
    g.set_outfit(OID)
    cv = wi.PadCV(wi.CELL)
    fx_shockring(cv, c=(24, 41), rx=16, ry=3.8, w=1.6, k=1)
    g.draw_fist(cv, (24, 44), (24, 20), g.PAL["skin"], open_hand=False, fist_ang=-90)              # black-gloved fist (gloves via STYLE)
    w_gauntlet(cv, f=(24, 20), el=(24, 46))
    big = g.finish(cv); bb = big.getchannel("A").getbbox()
    w, h = bb[2] - bb[0], bb[3] - bb[1]
    assert w <= 46 and h <= 46, (w, h)
    out = Image.new("RGBA", (48, 48), (0, 0, 0, 0)); out.paste(big.crop(bb), ((48 - w) // 2, (48 - h) // 2))
    g.set_outfit("polo")
    return out

# ------------------------------------------------------------------ collectible (gen_collectibles row style): Boone's Overcoat, flat-laid
def collectible_row():
    import gen_collectibles as gcol
    P = gcol.P
    def coat(cv):
        pal = ramp((40, 54, 72)); inner = ramp((214, 216, 222)); red = ramp((170, 30, 40))
        b = gcol._flat_top(cv, pal, [(13, 7), (35, 7), (38, 44), (10, 44)],
                           [[(13, 7), (4, 36), (9, 38.5), (16, 17)], [(35, 7), (44, 36), (39, 38.5), (32, 17)]])
        b.poly([(19, 7), (29, 7), (26.4, 22), (21.6, 22)], inner["base"])                         # shirt V
        b.poly([(22.8, 9.6), (25.2, 9.6), (25.8, 20.5), (24, 22.5), (22.2, 20.5)], red["base"])       # crimson tie
        b.poly([(22.6, 8), (25.4, 8), (25.0, 10.4), (23.0, 10.4)], red["dk"])
        b.poly([(17, 7), (21.6, 22), (19, 24), (14.6, 12)], pal["sh"]); b.poly([(31, 7), (26.4, 22), (29, 24), (33.4, 12)], pal["hi"])   # lapels
        for x in (19.5, 28.5):
            for y in (27, 33): b.dot((x, y), 0.9, C(18, 20, 26))
        b.poly([(11, 36.5), (37, 36.5), (37.4, 39), (10.6, 39)], pal["dk"])                        # belt
        b.poly([(29.5, 15), (33.5, 14.6), (32.8, 17), (31.4, 16), (30.2, 17.2)], red["base"])      # pocket square
        b.commit()
        return b
    base = gcol.render_item(coat)
    row = Image.new("RGBA", (gcol.CW * gcol.NF, gcol.CH), (0, 0, 0, 0))
    for f in range(gcol.NF):
        fr = gcol.glint(base, gcol.GLINT[f]) if f in gcol.GLINT else base
        row.paste(fr, (f * gcol.CW, gcol.BOB[f]), fr)
    r, g_, b, a = row.split()
    return Image.merge("RGBA", (r, g_, b, a.point(lambda v: 255 if v >= 128 else 0)))
