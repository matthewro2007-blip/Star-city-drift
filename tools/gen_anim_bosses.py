#!/usr/bin/env python3
"""Star City Drift 1.5.x prequel DLC - ORIGINAL boss art for Vera Lisk (`vera`), Mort "The Foreman" Kessler (`foreman`)
and the Foreman's crew grunt (`foreman_crew`). Owner: Jack.

Replaces main.js spawnBoss()'s tinted thug art. Same rig, style and schema as tools/gen_anim_enemies.py:
  assets/sprites/<key>_anim.png       144x192 cells (anchorX 72)
  assets/sprites/<key>_anim_wide.png  240x192 cells (anchorX 120)
Writes the strips + a manifest fragment to an output dir (default /workspace/tmp_sprite/bosses_dlc/out); installing into
assets/ and anims_enemies.json is a separate, careful merge step. Shared rigs (gen_cast / gen_anims / gen_matthew_v2 /
gen_anim_enemies) are imported, never edited: character lookup is overridden locally (ga.setup), like states_for.
usage (repo root): python3 tools/gen_anim_bosses.py [--out DIR] [--jobs N]
"""
import io, json, math, os, sys, time
from multiprocessing import Pool
from PIL import Image
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import gen_matthew_v2 as g
import gen_cast as gc
import gen_anims as ga
import gen_anim_enemies as e
from gen_matthew_v2 import C, Part, add, rot, ramp, mix, ellipse_pts, taper, pose, FW, FH
from gen_anims import F, S, HURT, SIT, lying, ko_frames, knockdown, guard_bob, run_cycle

FEET = 189; P_ = pose
KEYS = ["vera", "foreman", "foreman_crew"]

# ------------------------------------------------------------ character designs (original)
# Vera Lisk - the Foreman's lieutenant, works the River Bridge signal lamps at night. Lean, sharp, quick feet.
# Raven ponytail, berry lipstick, teal drop earrings, fitted deep-teal bomber jacket (ribbed hem) over a black turtleneck,
# charcoal slim trousers, black knee boots, fingerless black gloves; carries a brass railway signal lantern (green glass).
VERA = dict(skin="peach", build=(0.95, 1.03), anchor_x=68.0,
            head=dict(hair="ponytail", hair_col="black", lashes=True, lip=C(150, 40, 70), earring=C(70, 210, 190),
                      brow_angry=True, narrow=True, blush=False),
            fit=gc.fit("jacket", (22, 102, 98), (40, 42, 52), boot=(26, 22, 28), sole=(14, 12, 16), sleeves="long",
                       inner=(30, 30, 36), accent=None, bomber=True, hem="rib", untucked=True, gloves=C(26, 26, 30)),
            scrunchie=C(70, 210, 190))
# Mort "The Foreman" Kessler - big rail-yard / dock crew boss. White supervisor's hard hat, grey buzz + full grey beard,
# ruddy face, hi-vis orange vest (reflective bands) over a brown canvas chore coat, grey work trousers, tan work boots,
# leather work gloves, brass whistle on a lanyard, pocket watch. Swings a length of steel pipe.
FOREMAN = dict(skin="ruddy", build=(1.17, 1.04), anchor_x=63.0,   # 1.04 tall: the hard hat must fit the 192 cell
               head=dict(hair="buzz", hair_col="grey", facial="beard", facial_col="grey", brow_col="grey", brow_angry=True,
                         brow_w=2.1, age=True),
               fit=gc.fit("jacket", (236, 128, 26), (74, 78, 86), boot=(150, 104, 56), sole=(40, 32, 26), vest=True,
                          sleeves="long", sleeve_pal=(116, 82, 50), inner=(116, 82, 50), accent=(236, 236, 214), untucked=True,
                          gloves=C(150, 108, 64), whistle=True),
               hardhat=(238, 236, 228))
# Crew grunt ("the Foreman's boys"): yellow hard hat, stubble, dark brown work jacket (corduroy collar, orange hi-vis band)
# over a grey shirt, navy work pants.
CREW = dict(skin="olive", build=(1.03, 1.0), anchor_x=68.0,
            head=dict(hair="short", hair_col="brown", facial="stubble", brow_angry=True),
            fit=gc.fit("jacket", (84, 62, 44), (46, 52, 70), boot=(70, 50, 34), sole=(30, 26, 22), sleeves="long",
                       inner=(116, 118, 124), accent=(236, 140, 30), untucked=True, gloves=C(130, 96, 60)),
            hardhat=(240, 190, 40))
CFG = {"vera": VERA, "foreman": FOREMAN, "foreman_crew": CREW}

def hardhat_head(base_head, rgb):
    hr = ramp(rgb); HK = gc.HK
    def head(cv, hc, ang, expr="calm", pal_skin=None):
        base_head(cv, hc, ang, expr, pal_skin)
        T = lambda q: add(rot((q[0] * HK, q[1] * HK), ang), hc)
        dome = [(12.8, -9.0), (12.6, -14.0), (8.4, -20.4), (-1.0, -22.6), (-10.2, -20.6), (-14.2, -13.8), (-14.4, -9.4)]
        brim = [(-16.2, -10.2), (18.6, -11.2), (19.2, -8.4), (-16.0, -7.6)]
        p = Part(cv, [[T(q) for q in dome], [T(q) for q in brim]], hr, shade=(3, 2), hi=(1.2, -1.2), rim=1.0, ink=0.8)
        p.line([T((-9.6, -19.4)), T((-1.0, -22.0)), T((8.0, -19.6))], hr["hi"], 0.8)          # crown ridge
        p.line([T((-1.4, -22.2)), T((0.4, -11.0))], hr["sh"], 0.6)
        p.poly([T(q) for q in brim], hr["sh"])
        p.line([T((-16.0, -9.6)), T((18.8, -10.6))], hr["hi"], 0.4)
        p.commit()
    return head

def recolor_scrunchie(base_head, rgb):
    return base_head          # gen_cast hard-codes the scrunchie colour; left as-is (small red accent reads fine)

def my_setup(key):
    if key not in CFG: return _orig_setup(key)
    cfg = CFG[key]
    ga.set_fx(ga.FX_GREEN if key == "vera" else ga.FX_GOLD)
    gc.setup(cfg)
    if cfg.get("hardhat"): g.HEAD_FN[0] = hardhat_head(g.HEAD_FN[0], cfg["hardhat"])
    kx, ky = cfg.get("build", (1, 1))
    return (kx, ky, cfg.get("anchor_x", 68.0), 189.0), cfg
_orig_setup = ga.setup
ga.setup = my_setup

# ------------------------------------------------------------ props: lantern (+ cane/chain via gen_anim_enemies)
_prev_prop = gc.draw_prop_at
def draw_prop_at(cv, kind, f, ang=0.0, k=0.0):
    if kind == "lantern":          # railway signal lantern hanging from the hand; ang = swing tilt
        R_ = lambda q: add(f, rot(q, ang))
        brass = ramp((200, 150, 60)); glass = ramp((90, 220, 140))
        Part(cv, [taper(R_((0, -1)), 0.9, R_((0, 5)), 0.9)], ramp((60, 56, 50)), shade=(0, 0), hi=None, rim=0, ink=0.6).commit()  # bail
        body = [R_(q) for q in [(-6, 5), (6, 5), (7, 8), (7, 20), (5.6, 23), (-5.6, 23), (-7, 20), (-7, 8)]]
        b = Part(cv, [body], brass, shade=(1.6, 1.2), hi=(0.8, -0.8), rim=0.6, ink=0.75)
        b.poly([R_(q) for q in [(-5, 9), (5, 9), (5, 19), (-5, 19)]], glass["base"])
        b.poly([R_(q) for q in [(-4, 10), (-1, 10), (-1, 18), (-4, 18)]], glass["hi"])
        for y in (9, 14, 19): b.line([R_((-5.4, y)), R_((5.4, y))], brass["dk"], 0.5)
        b.line([R_((0, 9)), R_((0, 19))], brass["dk"], 0.5)
        b.commit()
        return
    if kind == "whistle_hand":     # brass whistle held at the lips
        Part(cv, [[add(f, q) for q in [(-1, -2.2), (6.5, -2.0), (7, 1.6), (-1, 2.0)]]], ramp((214, 170, 70)), shade=(1, 1), hi=(0.6, -0.6), rim=0.4, ink=0.7).commit()
        return
    if kind == "watch_open":       # pocket watch on its chain, face toward camera
        Part(cv, [ellipse_pts(add(f, (2, -4)), 3.6, 3.6, n=14)], ramp((214, 170, 70)), shade=(1, 1), hi=(0.6, -0.6), rim=0.4, ink=0.7).commit()
        Part(cv, [ellipse_pts(add(f, (2, -4)), 2.4, 2.4, n=12)], ramp((246, 240, 224)), shade=(0, 0), hi=None, rim=0, ink=0).commit()
        return
    return _prev_prop(cv, kind, f, ang, k)
gc.draw_prop_at = draw_prop_at

# ------------------------------------------------------------ shared reactions (same timing as silas_boss / thugs)
def reactions(st, boss=True):
    fall, ground, getup = knockdown()
    st["knockdown_fall"] = S(fall, 10, False); st["knockdown_ground"] = S(ground, 3, True); st["getup"] = S(getup, 8, False)
    loc = e.locomotion_states()
    for k in ("idle", "walk", "run", "hurt"): st[k] = loc[k]
    if boss:
        kneel = dict(torso=(62, 130), lean=10, head=12, expr="hurt", near_knee=(64, 176), near_ankle=(38, 178), near_ground=False, near_foot=60,
                     far_knee=(94, 152), far_ankle=(98, 174), near_el=(-14, -20), near_fist=(-10, -2), open_near=True,
                     far_el=(20, -20), far_fist=(30, -6), open_far=True)
        st["defeat"] = S([F(dict(HURT)), F({**HURT, "lean": -10, "head": -6}, dx=-4), F(P_(**kneel)),
                          F(P_(**{**kneel, "head": 20, "lean": 16})),
                          F(P_(**{**SIT, "head": -12}), rot=60, pivot=(66, 150), center=True), lying(-10, 90)], 7, False)
    else:
        st["ko"] = S(ko_frames(), 8, False)
    return st

# ------------------------------------------------------------ Vera Lisk
def vera_states():
    st = {}
    LAN = lambda a=0: [("lantern", "near", a, 0)]
    # attack1 "Bridge Kick": chambered high snap kick (near leg)
    chamber = dict(torso=(60, 104), lean=-10, head=4, near_knee=(84, 122), near_ankle=(76, 146), near_ground=False, near_foot=20,
                   near_el=(-14, -24), near_fist=(-6, -36), far_el=(24, -28), far_fist=(30, -40))
    kick = dict(torso=(56, 104), lean=-18, head=8, near_hip=(2, 8), near_knee=(90, 100), near_ankle=(118, 86), near_ground=False, near_foot=-64,
                near_el=(-18, -24), near_fist=(-12, -36), far_el=(22, -28), far_fist=(28, -42))
    st["boss_attack1"] = S([F(P_(**chamber)), F(P_(**kick)), F(P_(**kick), fx=[("sparkle", (122, 80), 5)]), F(P_(**chamber)),
                            F(P_(torso=(66, 104), lean=2))], 10, False, [1, 2], "near_ankle")
    # attack2 "Signal Swing": the brass lantern swung on its bail in a wide arc
    st["boss_attack2"] = S([
        F(P_(torso=(62, 104), lean=-10, head=-2, near_sh=(-14, -40), near_el=(-28, -36), near_fist=(-40, -46), far_fist=(26, -36)), props=LAN(140)),
        F(P_(torso=(66, 104), lean=0, near_sh=(-10, -42), near_el=(-6, -52), near_fist=(12, -62), far_fist=(26, -34)), props=LAN(150)),
        F(P_(torso=(72, 105), lean=14, head=4, near_sh=(-2, -42), near_el=(22, -48), near_fist=(46, -50), far_fist=(20, -30),
             near_knee=(56, 146), near_ankle=(40, 174), far_knee=(96, 142), far_ankle=(104, 174)), props=LAN(-80)),
        F(P_(torso=(72, 106), lean=14, near_el=(20, -32), near_fist=(40, -20), far_fist=(20, -30),
             near_knee=(56, 146), near_ankle=(40, 174), far_knee=(96, 142), far_ankle=(104, 174)), props=LAN(-30)),
        F(P_(torso=(66, 104), lean=2, near_el=(-10, -20), near_fist=(-4, -8)), props=LAN(0))], 10, False, [2, 3], ("box", 92, 40, 52, 60))
    # attack3 "Green Light": lantern raised, blinding green flash, then a low sweeping kick
    st["boss_attack3"] = S([
        F(P_(torso=(64, 104), lean=-6, head=-4, near_el=(-6, -60), near_fist=(4, -78), far_fist=(28, -36)), props=LAN(0)),
        F(P_(torso=(64, 104), lean=-6, head=-4, near_el=(-6, -60), near_fist=(4, -78), far_fist=(28, -36)), props=LAN(0),
          fx=[("burst", (78, 30), 14)]),
        F(P_(torso=(62, 132), lean=8, head=6, near_knee=(56, 160), near_ankle=(40, 178), near_ground=False, near_foot=60,
             far_knee=(96, 164), far_ankle=(124, 178), far_ground=False, far_foot=-10,
             near_el=(-20, -16), near_fist=(-30, -2), far_el=(20, -18), far_fist=(30, -6)), fx_back=[("speed", (0, 40), [150, 162, 174])]),
        F(P_(torso=(64, 132), lean=8, head=6, near_knee=(56, 160), near_ankle=(40, 178), near_ground=False, near_foot=60,
             far_knee=(98, 166), far_ankle=(128, 178), far_ground=False, far_foot=-10,
             near_el=(-20, -16), near_fist=(-30, -2), far_el=(20, -18), far_fist=(30, -6)), dx=4),
        F(P_(torso=(64, 112), lean=8, near_knee=(52, 150), far_knee=(86, 149))),
        F(P_(torso=(66, 104), lean=2))], 10, False, [1, 2, 3], ("box", 70, 120, 74, 70))
    # taunt: hand on hip, beckons with two fingers, ponytail flick
    fr = []
    for k in range(4):
        fr.append(F(P_(lean=-4, head=-4 + (k % 2) * 4, expr="talk" if k % 2 == 0 else "calm",
                       near_el=(-20, -20), near_fist=(-12, -8), open_near=False,
                       far_el=(28, -34), far_fist=(42 - (k % 2) * 6, -44 - (k % 2) * 4), open_far=True)))
    st["taunt"] = S(fr, 6, True)
    return reactions(st)

# ------------------------------------------------------------ The Foreman
def foreman_states():
    st = {}
    PIPE = lambda a: [("pipe", "near", a, 0)]
    # attack1 "Overtime": two-handed overhead pipe slam
    st["boss_attack1"] = S([
        F(P_(torso=(62, 106), lean=-10, head=-4, near_sh=(-12, -42), near_el=(-16, -58), near_fist=(-10, -70),
             far_sh=(13, -42), far_el=(6, -58), far_fist=(-4, -70)), props=PIPE(-150)),
        F(P_(torso=(66, 104), lean=2, near_el=(4, -54), near_fist=(16, -64), far_el=(14, -54), far_fist=(24, -64)), props=PIPE(-35)),
        F(P_(torso=(72, 110), lean=18, head=6, near_el=(18, -40), near_fist=(38, -34), far_el=(26, -40), far_fist=(44, -34),
             near_knee=(54, 150), near_ankle=(40, 174), far_knee=(96, 146), far_ankle=(104, 174)), props=PIPE(30)),
        F(P_(torso=(72, 112), lean=20, head=6, near_el=(18, -30), near_fist=(36, -16), far_el=(26, -30), far_fist=(42, -16),
             near_knee=(54, 152), near_ankle=(40, 174), far_knee=(96, 148), far_ankle=(104, 174)), props=PIPE(70),
          fx=[("shock", (112, 182), 1)]),
        F(P_(torso=(68, 106), lean=6, near_el=(-8, -22), near_fist=(0, -10)), props=PIPE(85))], 10, False, [2, 3], ("box", 88, 50, 56, 100))
    # attack2 "Bull Rush": head-down charge into a big clothesline
    rush = dict(torso=(76, 108), lean=26, head=-8, near_sh=(-2, -44), near_el=(6, -28), near_fist=(12, -38),
                far_sh=(14, -42), far_el=(10, -24), far_fist=(18, -30),
                near_knee=(50, 148), near_ankle=(28, 172), near_foot=26, far_knee=(98, 142), far_ankle=(106, 174))
    st["boss_attack2"] = S([
        F(P_(torso=(60, 110), lean=-6, near_knee=(50, 148), far_knee=(86, 147), near_fist=(-4, -30), far_fist=(10, -32))),
        F(P_(**rush), fx_back=[("speed", (0, 40), [80, 98, 116])]),
        F(P_(**rush), dx=8, fx_back=[("speed", (-4, 40), [74, 92, 110, 128])]),
        F(P_(torso=(76, 104), lean=10, head=-2, far_sh=(16, -42), far_el=(38, -44), far_fist=(60, -44), open_far=True, near_fist=(4, -30),
             near_knee=(54, 146), near_ankle=(36, 174), far_knee=(96, 142), far_ankle=(106, 174)), dx=6),
        F(P_(torso=(68, 104), lean=4))], 10, False, [1, 2, 3], ("box", 84, 40, 56, 80))
    # attack3 "Ground Breaker": hop + double-boot stomp, big shockwave
    hop = dict(lean=-4, head=-6, near_el=(-20, -50), near_fist=(-24, -66), open_near=True, far_el=(24, -52), far_fist=(30, -66), open_far=True,
               near_knee=(60, 130), near_ankle=(54, 156), near_ground=False, far_knee=(88, 130), far_ankle=(88, 158), far_ground=False)
    stomp = dict(torso=(66, 116), lean=10, head=6, near_el=(-18, -22), near_fist=(-26, -8), far_el=(24, -22), far_fist=(32, -8),
                 near_knee=(50, 150), near_ankle=(40, 174), far_knee=(90, 150), far_ankle=(98, 174))
    st["boss_attack3"] = S([F(P_(torso=(64, 112), lean=6, near_knee=(52, 150), far_knee=(86, 149))),
                            F(P_(**hop), lift=14, grounded=False),
                            F(P_(**stomp), fx=[("shock", (104, 182), 1), ("shock", (36, 182), 1)]),
                            F(P_(**stomp), fx=[("shock", (108, 182), 2), ("shock", (30, 182), 2)]),
                            F(P_(**{**stomp, "torso": (66, 110), "lean": 6}), fx=[("shock", (110, 182), 3)]),
                            F(P_())], 10, False, [2, 3], ("box", 40, 150, 140, 40))
    # taunt: blows the whistle, then checks his pocket watch
    whistle = dict(lean=-6, head=-8, near_el=(-4, -40), near_fist=(10, -56), far_el=(22, -24), far_fist=(14, -10))
    watch = dict(lean=2, head=8, expr="calm", near_el=(-8, -24), near_fist=(10, -32), far_el=(22, -26), far_fist=(16, -34))
    st["taunt"] = S([F(P_(**whistle), props=[("whistle_hand", "near", 0, 0)], fx=[("sparkle", (96, 34), 4)]),
                     F(P_(**whistle), props=[("whistle_hand", "near", 0, 0)], fx=[("sparkle", (104, 28), 6)]),
                     F(P_(**watch), props=[("watch_open", "near", 0, 0)]),
                     F(P_(**watch), props=[("watch_open", "near", 0, 0)], fx=[("sparkle", (82, 64), 3)])], 6, True)
    return reactions(st)

# ------------------------------------------------------------ crew grunt (thug state set)
def crew_states():
    st = {}
    j1 = dict(torso=(70, 104), lean=8, far_sh=(14, -42), far_el=(32, -40), far_fist=(52, -42), near_fist=(4, -30))
    j2 = dict(torso=(74, 105), lean=14, near_sh=(-2, -42), near_el=(20, -44), near_fist=(44, -44), far_el=(22, -26), far_fist=(30, -34),
              near_knee=(56, 144), far_knee=(92, 142))
    st["attackA"] = S([F(P_(lean=2, near_fist=(10, -32), far_fist=(24, -34))), F(P_(**j1)), F(P_(lean=4)), F(P_(**j2)),
                       F(P_(torso=(68, 104), lean=4))], 12, False, [1, 3], ("box", 92, 48, 40, 30))
    tackle = dict(torso=(76, 110), lean=30, head=-6, near_sh=(-2, -44), near_el=(16, -30), near_fist=(30, -24), open_near=True,
                  far_el=(22, -30), far_fist=(36, -26), open_far=True, near_knee=(50, 150), near_ankle=(28, 172), near_foot=26,
                  far_knee=(98, 144), far_ankle=(108, 174))
    st["attackB"] = S([F(P_(torso=(62, 110), lean=-4, near_knee=(50, 148), far_knee=(86, 147))),
                       F(P_(**tackle), fx_back=[("speed", (0, 44), [84, 102, 120])]), F(P_(**tackle), dx=8),
                       F(P_(torso=(68, 104), lean=4))], 12, False, [1, 2], ("box", 84, 60, 50, 70))
    return reactions(st, boss=False)

def states_for(key):
    return {"vera": vera_states, "foreman": foreman_states, "foreman_crew": crew_states}[key]()

# ------------------------------------------------------------ build (same cell / manifest rules as gen_anim_enemies)
WIDE_W = (240, 288, 336)
ORDER = {"boss": ["boss_attack1", "boss_attack2", "boss_attack3", "taunt", "defeat", "knockdown_fall", "knockdown_ground", "getup",
                  "idle", "walk", "run", "hurt"],
         "thug": ["attackA", "attackB", "ko", "knockdown_fall", "knockdown_ground", "getup", "idle", "walk", "run", "hurt"]}
# boss: ko = defeat (as silas_boss); attackA/attackB aliases so a createThug()-based miniBoss (combat.js thug path) also animates
ALIASES = {"vera": {"ko": ["defeat"], "attackA": ["boss_attack1"], "attackB": ["boss_attack2"]},
           "foreman": {"ko": ["defeat"], "attackA": ["boss_attack1"], "attackB": ["boss_attack2"]}, "foreman_crew": {}}

def job(args):
    key, s, i = args
    stt = states_for(key)[s]; spec = stt["frames"][i]
    big, bb, wx, wy, sx, sy, xf = e.render_big(key, spec)
    hb = None
    if i in stt["active"] and stt["hit"]:
        h = stt["hit"]
        if isinstance(h, tuple): hb = dict(x=h[1], y=h[2], w=h[3], h=h[4])
        else:
            pt = ga.limb_pt(spec["P"], h)
            if xf: pt = (xf[2] + (pt[0] - xf[2]) * xf[0], xf[3] + (pt[1] - xf[3]) * xf[1])
            hb = dict(x=int(pt[0] + spec.get("dx", 0) + sx - 14), y=int(pt[1] + sy - 12), w=28, h=24)
    buf = io.BytesIO(); big.save(buf, "PNG")
    return key, s, i, buf.getvalue(), (bb, wx, wy), dict(grounded=spec.get("grounded", True), lying=spec.get("lying", False),
                                                         active=i in stt["active"], hitbox=hb)

def build(out, jobs=6, keys=KEYS):
    t0 = time.time(); os.makedirs(out, exist_ok=True)
    plans = {k: states_for(k) for k in keys}
    tasks = [(k, s, i) for k, sts in plans.items() for s, v in sts.items() for i in range(len(v["frames"]))]
    with Pool(jobs) as pool: res = pool.map(job, tasks, chunksize=1)
    R = {(k, s, i): (Image.open(io.BytesIO(b)).convert("RGBA"), geo, m) for k, s, i, b, geo, m in res}
    errs = [(k, s, i) for (k, s, i), (_, geo, _m) in R.items() if not 0 < e.need_w(*geo) <= WIDE_W[-1]]
    if errs: raise SystemExit("clipping frames: %s" % errs)
    frag = {}
    for key in keys:
        sts = plans[key]; order = ORDER["thug" if key == "foreman_crew" else "boss"]
        assert set(order) == set(sts), (key, set(order) ^ set(sts))
        fname = "assets/sprites/%s_anim.png" % key; wname = "assets/sprites/%s_anim_wide.png" % key
        entry = dict(file=fname, wideFile=wname, states={}); norm, wide = [], []
        for s in order:
            v = sts[s]; n = len(v["frames"])
            ws = [e.need_w(*R[(key, s, i)][1]) for i in range(n)]
            if min(ws) < 0 or max(ws) > WIDE_W[-1]: raise SystemExit("clip %s %s %s" % (key, s, ws))
            W = max(ws)
            if W > 144: W = next(w for w in WIDE_W if w >= W)
            pad = (W - 144) // 2; tgt = wide if W > 144 else norm; x0 = sum(i.width for i in tgt); base = len(tgt); ms = []
            for i in range(n):
                big, (bb, wx, wy), m = R[(key, s, i)]
                im = big.crop((wx - pad, wy, wx - pad + W, wy + FH))
                ab = im.getchannel("A").getbbox()
                assert ab[0] > 0 and ab[1] > 0 and ab[2] < W and ab[3] < FH, (key, s, i, ab)
                if m["hitbox"]: m = {**m, "hitbox": {**m["hitbox"], "x": m["hitbox"]["x"] + pad}}
                tgt.append(im); ms.append(m)
            entry["states"][s] = dict(file=wname if W > 144 else fname, frames=list(range(base, base + n)), fps=v["fps"], loop=v["loop"],
                                      fw=W, fh=FH, anchorX=W // 2, sx=[x0 + k * W for k in range(n)], sw=[W] * n, sy=[0] * n, sh=[FH] * n,
                                      grounded=[m["grounded"] for m in ms], lying=[m["lying"] for m in ms],
                                      active=[m["active"] for m in ms], hitbox=[m["hitbox"] for m in ms])
        for al, parts in ALIASES[key].items():
            ps = [entry["states"][p] for p in parts]; a = dict(ps[0]); a["aliasOf"] = parts
            for f in ("frames", "sx", "sw", "sy", "sh", "grounded", "lying", "active", "hitbox"): a[f] = [x for p in ps for x in p[f]]
            if al == "ko": a["fps"] = 8
            entry["states"][al] = a
        for lst, nm in ((norm, fname), (wide, wname)):
            strip = Image.new("RGBA", (max(1, sum(i.width for i in lst)), FH), (0, 0, 0, 0)); x = 0
            for i in lst: strip.paste(i, (x, 0)); x += i.width
            strip.save(os.path.join(out, os.path.basename(nm)))
        if not wide: entry.pop("wideFile")
        frag[key] = entry
        print("anim", key, len(norm), "std +", len(wide), "wide")
    json.dump(dict(version=1, frameW=FW, frameH=FH, feetRow=FEET, characters=frag), open(os.path.join(out, "anims_bosses_fragment.json"), "w"), indent=1)
    print("done %d frames in %.1fs" % (len(tasks), time.time() - t0))

if __name__ == "__main__":
    a = sys.argv[1:]
    out = a[a.index("--out") + 1] if "--out" in a else "/workspace/tmp_sprite/bosses_dlc/out"
    keys = a[a.index("--only") + 1].split(",") if "--only" in a else KEYS
    build(out, int(a[a.index("--jobs") + 1]) if "--jobs" in a else 6, keys)
