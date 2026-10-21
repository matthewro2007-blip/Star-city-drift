#!/usr/bin/env python3
"""Star City Drift 2D - extended animation generator (NEW sheets only).

Never touches the 8-frame sheets. Renders <key>_anim.png strips (one row of 144x192
frames, facing right, transparent, feet on row 189 unless airborne) with the shared
gen_matthew_v2 rig + gen_cast heads/outfits, and writes assets/sprites/anims.json:

  characters.<key>.states.<state> = {file, frames:[strip indices], fps, loop,
                                     grounded:[bool], lying:[bool], active:[bool], hitbox:[{x,y,w,h}|null]}
usage: gen_anims.py [--only key1,key2] [--jobs N]

Outfit kits: matthew_<outfit> idle_signature / combo3 / special are OWNED by tools/gen_kits.py (strips *_kit.png /
*_kit_wide.png). This script still renders its generic versions into <key>_anim.png, but keeps the kit states that are
already in anims.json when it rewrites a matthew_<outfit> entry, so a regenerate never drops them.
"""
import io, json, math, os, sys, time
from multiprocessing import Pool
from PIL import Image
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import gen_matthew_v2 as g
import gen_cast as gc
from gen_matthew_v2 import C, Part, Canvas, add, rot, lerp, mix, ramp, taper, ellipse_pts, PAL, FW, FH, POSES, pose, render_figure, finish

SPR = g.SPR
FEET = 189
OUTFIT_IDS = ["polo", "photo", "hoodie", "jacket", "street", "varsity", "mechanic", "diner", "gold", "webslinger", "beacon", "ironclad"]
GOLD = ramp((240, 192, 64)); PALEGOLD = ramp((255, 232, 150)); AURA = ramp((255, 214, 110)); SPEED = ramp((255, 232, 160)); CORE = C(255, 250, 220)
FX_GOLD = (GOLD, PALEGOLD, AURA, SPEED, CORE)
FX_GREEN = (ramp((60, 220, 110)), ramp((170, 255, 190)), ramp((110, 240, 150)), ramp((140, 255, 170)), C(232, 255, 236))   # beacon energy
FX_EMBER = (ramp((255, 168, 48)), ramp((255, 214, 120)), ramp((255, 150, 56)), ramp((255, 176, 84)), C(255, 246, 210))   # orange-gold   # Hell's Nightmare
def set_fx(pal):
    global GOLD, PALEGOLD, AURA, SPEED, CORE
    GOLD, PALEGOLD, AURA, SPEED, CORE = pal
WHITE = ramp((250, 248, 240)); DUST = ramp((200, 186, 160))

def F(P, **o):
    d = dict(P=P); d.update(o); return d

# ---------------------------------------------------------------- generic helpers
def legs(torso, lean, phase, stride=22, lift=12, kick=8):
    out = {}
    for side, rel, ph in (("near", (-7, 8), phase), ("far", (8, 8), phase + math.pi)):
        hip = add(rot(rel, lean), torso)
        s, c = math.sin(ph), math.cos(ph)
        ay = 174 - (lift * c if c > 0 else 0)
        ax = hip[0] + stride * s
        kx = (hip[0] + ax) / 2 + kick + (5 * c if c > 0 else 0)
        ky = (hip[1] + ay) / 2 - (4 * c if c > 0 else 0)
        out[side + "_ankle"] = (ax, ay); out[side + "_knee"] = (kx, ky)
        out[side + "_foot"] = 22 if (c < 0 and s < 0) else (-8 if c > 0.2 else 0)
        out[side + "_ground"] = not (c > 0.3)
    return out

def run_cycle(n, lean, stride, lift, tx, bob, pump, fist_hi=0, extra=None, base=None):
    fr = []
    for k in range(n):
        ph = 2 * math.pi * k / n
        s = math.sin(ph)
        torso = (tx, 104 - bob * abs(math.cos(ph)))
        d = dict(torso=torso, lean=lean, head=-lean * 0.35,
                 near_el=(-13 - 6 * s * pump, -20 + fist_hi), near_fist=(6 - 12 * s * pump, -28 + 3 * abs(s) + fist_hi),
                 far_el=(22 + 7 * s * pump, -24 + fist_hi), far_fist=(31 + 12 * s * pump, -36 + fist_hi))
        d.update(legs(torso, lean, ph, stride, lift))
        if extra: d.update(extra)
        fr.append(F((base or pose)(**d)))
    return fr

SIT = dict(torso=(66, 140), lean=0, head=-10, expr="hurt", near_hip=(-7, 8), far_hip=(8, 8),
           near_knee=(98, 147), near_ankle=(100, 176), near_ground=False, near_foot=0,
           far_knee=(103, 145), far_ankle=(106, 176), far_ground=False, far_foot=0,
           near_sh=(-12, -40), near_el=(-26, -26), near_fist=(-38, -14), open_near=True,
           far_sh=(13, -41), far_el=(26, -26), far_fist=(34, -12), open_far=True)
HURT = dict(POSES[7])
# sitting on the floor, knees up, hands planted behind (getup / lying base)
FLOORSIT = dict(torso=(62, 158), lean=-12, head=-6, expr="hurt", near_hip=(-7, 8), far_hip=(8, 8),
                near_knee=(90, 142), near_ankle=(104, 176), near_ground=False, near_foot=0,
                far_knee=(95, 140), far_ankle=(110, 176), far_ground=False, far_foot=0,
                near_sh=(-12, -40), near_el=(-20, -18), near_fist=(-24, 4), open_near=True,
                far_sh=(13, -41), far_el=(20, -20), far_fist=(14, -2), open_far=True)

def lying(head=-10, rot_=76):
    P = pose(**{**FLOORSIT, "near_el": (-26, -26), "near_fist": (-36, -14), "far_el": (24, -28), "far_fist": (34, -16)}); P["head"] = head
    return F(P, rot=rot_, pivot=(62, 166), center=True, lying=True)

def ko_frames(base=pose, hurt=None):
    H = hurt or HURT
    return [F(base(**{**H})),
            F(base(**{**H, "lean": -22, "head": -12}), rot=14, pivot=(70, 187), center=True),
            F(base(**{**FLOORSIT, "head": -12}), rot=38, pivot=(62, 166), center=True),
            lying(-10, 74), lying(-6, 76)]

def knockdown(base=pose):
    H = HURT
    fall = [F(base(**{**H, "lean": -26, "head": -14}), dx=-4),
            F(base(**{**FLOORSIT, "head": -14, "lean": -4}), rot=26, pivot=(62, 166), lift=12, grounded=False, center=True),
            F(base(**{**FLOORSIT, "head": -12}), rot=50, pivot=(62, 166), lift=4, grounded=False, center=True),
            lying(-10, 76)]
    ground = [lying(-10, 76), lying(-4, 75)]
    getup = [F(base(**{**FLOORSIT, "expr": "calm", "head": -2}), rot=30, pivot=(62, 166), center=True),
             F(base(**{**FLOORSIT, "expr": "calm", "head": 4, "lean": 8, "near_el": (-2, -20), "near_fist": (14, -12), "open_near": False,
                      "far_el": (22, -22), "far_fist": (30, -12), "open_far": False}), center=True),
             F(base(torso=(64, 122), lean=16, head=4, near_knee=(84, 150), near_ankle=(58, 174), near_foot=30,
                    far_knee=(96, 152), far_ankle=(100, 174), near_fist=(10, -22), far_fist=(30, -26))),
             F(base())]
    return fall, ground, getup

def guard_bob(n, base=pose, amp=2.0):
    fr = []
    for k in range(n):
        a = 2 * math.pi * k / n; dy = amp * (1 - math.cos(a)) / 2 * 2
        fr.append(F(base(torso=(66, 103 + dy), near_knee=(55, 142 + dy * 0.6), far_knee=(86, 141 + dy * 0.6),
                         near_fist=(6, -29 + dy * 0.4), far_fist=(33, -36 + dy * 0.4))))
    return fr

def S(frames, fps, loop, active=(), hit=None):
    return dict(frames=frames, fps=fps, loop=loop, active=set(active), hit=hit)

# ---------------------------------------------------------------- Matthew
def matthew_states():
    st = {}
    fr = []
    for k in range(6):
        a = 2 * math.pi * k / 6; dy = 1.5 * (1 - math.cos(a)); r = math.sin(a)
        fr.append(F(pose(torso=(66, 103 + dy), lean=4 + 1.5 * r, head=1.5 * r,
                         near_knee=(55, 142 + dy * 0.6), far_knee=(86, 141 + dy * 0.6),
                         far_sh=(13, -41 - 2.5 * max(0, r)), near_sh=(-12, -40 - 2.5 * max(0, -r)),
                         near_fist=(6, -29 + dy * 0.5 + 1.5 * r), far_fist=(33, -36 + dy * 0.5 - 1.5 * r),
                         far_el=(24, -24 + dy * 0.3))))
    st["idle_signature"] = S(fr, 8, True)
    st["run"] = S(run_cycle(8, 12, 24, 14, 68, 2.0, 1.0), 12, True)
    st["sprint"] = S(run_cycle(6, 22, 31, 18, 72, 2.5, 1.5, fist_hi=4), 16, True)
    st["combo1"] = S([F(pose(torso=(67, 103), lean=6, far_el=(26, -30), far_fist=(36, -38))),
                      F(pose(torso=(70, 103), lean=8, far_sh=(14, -42), far_el=(32, -40), far_fist=(52, -42), far_knee=(88, 141), far_ankle=(98, 174))),
                      F(pose(lean=5, far_el=(26, -28), far_fist=(36, -37)))], 14, False, [1], "far_fist")
    p5 = dict(POSES[5])
    st["combo2"] = S([F(dict(POSES[4])), F(p5), F({**p5, "lean": 13, "torso": (76, 105), "near_fist": (40, -45), "near_el": (19, -44)}),
                      F(pose(torso=(68, 104), lean=6, near_el=(-4, -30), near_fist=(14, -34)))], 14, False, [1, 2], "near_fist")
    st["combo3"] = S([F(pose(torso=(64, 111), lean=12, head=4, near_el=(-6, -14), near_fist=(4, -8), far_fist=(30, -40),
                             near_knee=(52, 150), far_knee=(88, 149), near_ankle=(42, 174), far_ankle=(96, 174))),
                      F(pose(torso=(68, 104), lean=2, head=-2, near_sh=(-6, -42), near_el=(8, -28), near_fist=(22, -50),
                             near_knee=(55, 143), far_knee=(86, 142))),
                      F(pose(torso=(70, 99), lean=-6, head=-8, near_sh=(-2, -44), near_el=(14, -50), near_fist=(20, -74),
                             far_el=(18, -20), far_fist=(26, -30), near_knee=(58, 138), near_ankle=(48, 172), near_foot=18,
                             far_knee=(86, 138), far_ankle=(94, 172), far_foot=10)),
                      F(pose(torso=(67, 104), lean=4))], 12, False, [1, 2], "near_fist")
    crouch = pose(torso=(64, 112), lean=8, near_knee=(52, 150), far_knee=(86, 149))
    kick = dict(torso=(54, 100), lean=-14, head=6, near_hip=(2, 8), near_knee=(88, 98), near_ankle=(114, 90), near_foot=-60,
                near_ground=False, far_knee=(68, 128), far_ankle=(48, 144), far_ground=False, far_foot=20,
                near_el=(-20, -24), near_fist=(-10, -34), far_el=(24, -27), far_fist=(30, -44))
    st["jump_kick"] = S([F(crouch),
                         F(pose(torso=(66, 100), lean=0, near_knee=(82, 122), near_ankle=(62, 142), near_ground=False, near_foot=30,
                                far_knee=(92, 126), far_ankle=(82, 152), far_ground=False, far_foot=10), lift=24, grounded=False),
                         F(pose(**kick), lift=34, grounded=False), F(pose(**kick), lift=20, grounded=False),
                         F(crouch)], 12, False, [2, 3], "near_ankle")
    charge = dict(torso=(60, 110), lean=-4, head=2, near_el=(-20, -22), near_fist=(-14, -10), far_el=(16, -20), far_fist=(12, -10),
                  near_knee=(50, 148), far_knee=(88, 147), near_ankle=(40, 174), far_ankle=(98, 174))
    dash = dict(torso=(74, 106), lean=22, head=-8, near_sh=(-6, -42), near_el=(6, -26), near_fist=(14, -36),
                far_sh=(14, -42), far_el=(12, -24), far_fist=(22, -30),
                near_knee=(50, 146), near_ankle=(30, 172), near_foot=26, far_knee=(96, 140), far_ankle=(104, 174))
    st["special"] = S([F(pose(**charge), fx=[("sparkle", (46, 92), 5), ("sparkle", (76, 92), 4)]),
                       F(pose(**charge), fx_back=[("aura", (62, 92), 40)], fx=[("sparkle", (40, 70), 6), ("sparkle", (88, 66), 5), ("sparkle", (66, 40), 4)]),
                       F(pose(**dash), fx_back=[("speed", (8, 46), [70, 90, 110, 130])]),
                       F(pose(**{**dash, "lean": 26}), dx=6, fx_back=[("speed", (0, 50), [64, 84, 104, 124, 144])], fx=[("burst", (114, 76), 14)]),
                       F(pose(**{**dash, "lean": 24}), dx=8, fx=[("burst", (116, 74), 22), ("sparkle", (130, 40), 5), ("sparkle", (124, 118), 5)]),
                       F(pose(torso=(72, 104), lean=14, head=-2), fx=[("sparkle", (118, 60), 6), ("sparkle", (132, 92), 4), ("sparkle", (108, 110), 3)]),
                       F(pose(torso=(68, 104), lean=6)), F(pose())], 12, False, [3, 4], ("box", 96, 50, 46, 50))
    st["hurt"] = S([F(dict(HURT)), F({**HURT, "lean": -22, "head": -12, "torso": (58, 109)}),
                    F(pose(torso=(63, 105), lean=-6, expr="hurt"))], 10, False)
    st["ko"] = S(ko_frames(), 8, False)
    vic_star = dict(lean=0, head=-6, near_sh=(-12, -42), near_el=(-18, -62), near_fist=(-26, -84),
                    far_sh=(13, -42), far_el=(28, -62), far_fist=(38, -82),
                    near_knee=(46, 142), near_ankle=(36, 174), far_knee=(96, 142), far_ankle=(104, 174))
    st["victory"] = S([F(pose()), F(pose(lean=2, near_el=(-16, -18), near_fist=(-8, -6))),
                       F(pose(lean=-2, head=-6, near_sh=(-10, -42), near_el=(-14, -62), near_fist=(-6, -84), far_fist=(30, -34))),
                       F(pose(torso=(66, 101), lean=-2, head=-6, near_sh=(-10, -42), near_el=(-14, -62), near_fist=(-6, -86), far_fist=(30, -34)),
                         fx=[("sparkle", (60, 10), 5)]),
                       F(pose(**vic_star), fx=[("star", (66, 12), 7)]),
                       F(pose(**vic_star), fx=[("star", (66, 12), 9), ("sparkle", (40, 22), 4), ("sparkle", (96, 20), 4)])], 8, False)
    fall, ground, getup = knockdown()
    st["knockdown_fall"] = S(fall, 10, False); st["knockdown_ground"] = S(ground, 3, True); st["getup"] = S(getup, 8, False)
    return st

# ---------------------------------------------------------------- cast (NPC personality + talk)
def npc(**kw):
    d = dict(gc.NPC_IDLE); d.update(kw); return d

def talk(base_kw, props=(), gesture="far", n=4):
    fr = []
    for k in range(n):
        kw = dict(base_kw)
        kw["expr"] = "talk" if k % 2 == 0 else "calm"
        kw["head"] = kw.get("head", 1) + (2 if k in (1, 2) else 0)
        if gesture == "far":
            kw.update(far_el=(24, -26), far_fist=(32 + (k % 2) * 3, -32 - (k % 3) * 3), open_far=True)
        elif gesture == "near":
            kw.update(near_el=(-6, -24), near_fist=(14 + (k % 2) * 3, -30 - (k % 3) * 3), open_near=True)
        fr.append(F(npc(**kw), props=list(props)))
    return fr

def cast_states(key):
    st = {}
    if key == "dee":
        fr = []
        for k in range(6):
            a = 2 * math.pi * k / 6
            P = npc(head=4, near_el=(-6, -18), near_fist=(14 + 6 * math.cos(a), -12 + 3 * math.sin(a)), open_near=False,
                    far_el=(20, -20), far_fist=(26, -8))
            fr.append(F(P, props=[("rag", "near", 10 * math.sin(a), 0)]))
        st["idle_personality"] = S(fr, 8, True)
        st["talk"] = S(talk(dict(near_el=(-13, -21), near_fist=(4, -22), open_near=False), props=[("spatula", "near", 0, 0)]), 6, True)
    elif key == "hank":
        fr = []
        for k in range(6):
            up = k in (1, 2, 3, 4)
            P = npc(head=7 if up else 1, near_el=(-10, -20) if up else (-14, -19), near_fist=(6, -26) if up else (-6, -2),
                    open_near=not up, far_el=(26, -22), far_fist=(20, -6))
            fr.append(F(P, props=[("watch", "near", 0, k / 6.0)] if up else []))
        st["idle_personality"] = S(fr, 6, True)
        st["talk"] = S(talk(dict(gc.HOLD), props=[("mug", "near", 0, 0)]), 6, True)
    elif key == "priya":
        fr = []
        for k in range(6):
            kk = [0, 0, 0.35, 0.7, 1.0, 1.0][k]
            P = npc(head=6, near_el=(-10, -18), near_fist=(6, -22), open_near=False,
                    far_el=(18, -14 - (4 if 2 <= k <= 4 else 0)), far_fist=(20, -22 - (4 if 2 <= k <= 4 else 0)), open_far=False)
            fr.append(F(P, props=[("book_open", (P["torso"][0] + 12, P["torso"][1] - 26), 0, kk)]))
        st["idle_personality"] = S(fr, 6, True)
        st["talk"] = S(talk(dict(gc.HOLD), props=[("book", "near", 0, 0)]), 6, True)
    elif key == "cam":
        fr = []
        for k in range(6):
            if k < 3:
                P = npc(head=7, near_el=(-10, -20), near_fist=(6, -24), open_near=False,
                        far_el=(18, -18), far_fist=(14 + k, -26), open_far=True)
                fr.append(F(P, props=[("phone", "near", 0, 0)]))
            else:
                P = npc(head=1, far_el=(28, -22), far_fist=(36, -18), open_far=False)
                fr.append(F(P, props=[("keys", "far", 0, (k - 3) / 3.0)]))
        st["idle_personality"] = S(fr, 7, True)
        st["talk"] = S(talk(dict(near_el=(-14, -19), near_fist=(-6, -2))), 6, True)
    elif key == "june":
        fr = []
        for k in range(6):
            tilt = [0, 15, 35, 40, 35, 10][k]
            P = npc(head=6, near_el=(-4, -20), near_fist=(14, -14), open_near=False)
            fr.append(F(P, props=[("wateringcan", "near", tilt, k / 6.0)], fx=[("flowers", (118, 186), 0)]))
        st["idle_personality"] = S(fr, 6, True)
        st["talk"] = S(talk(dict(gc.HOLD), props=[("clipboard", "near", 0, 0)]), 6, True)
    elif key == "silas":
        fr = []
        for k in range(6):
            up = k in (1, 2, 3)
            P = npc(head=-2 if up else 0, near_el=(-6, -30) if up else (-14, -19), near_fist=(8, -44 + (k - 2) * 1.5) if up else (-6, -2),
                    open_near=up, expr="calm")
            fr.append(F(P))
        st["idle_personality"] = S(fr, 6, True)
        st["talk"] = S(talk(dict()), 6, True)
    elif key == "tessa":
        fr = []
        boardP = dict(near_ankle=(56, 168), far_ankle=(86, 168), near_ground=False, far_ground=False, near_foot=0, far_foot=0,
                      near_knee=(62, 138), far_knee=(88, 138), near_el=(-22, -28), near_fist=(-30, -22), open_near=True,
                      far_el=(26, -30), far_fist=(38, -26), open_far=True)
        seq = [(0, 0, 0, 0, True), (6, 0, 0, 0, True), (2, 10, -20, 0, False), (-2, 18, 0, 1, False),
               (-2, 16, 0, 2, False), (2, 8, 0, 0, False), (8, 0, 0, 0, True), (0, 0, 0, 0, True)]
        for crouch, lift, bang, flip, gnd in seq:
            P = npc(**boardP)
            P["torso"] = (66, 103 + crouch)
            P["near_knee"] = (64, 138 + crouch * 0.7); P["far_knee"] = (90, 138 + crouch * 0.7)
            fr.append(F(P, fx=[("board", (72, 178), bang, flip)], lift=lift, grounded=gnd))
        st["idle_personality"] = S(fr, 9, True)
        st["talk"] = S(talk(dict(near_el=(-15, -20), near_fist=(-10, -6), open_near=False), props=[("skateboard", "near", 0, 0)]), 6, True)
    elif key == "coach":
        p4, p5 = dict(POSES[4]), dict(POSES[5])
        st["idle_personality"] = S([F(pose()), F(pose(torso=(70, 103), lean=8, far_sh=(14, -42), far_el=(32, -40), far_fist=(52, -42))),
                                    F(pose()), F(p4), F(p5), F(pose(torso=(66, 105), near_knee=(54, 144), far_knee=(87, 143)))], 8, True)
        fr = []
        for k in range(4):
            clap = k % 2 == 0
            P = npc(expr="talk" if k % 2 == 0 else "calm", head=1 + (k in (1, 2)) * 2,
                    near_el=(-6, -24), near_fist=(14 if clap else 8, -30), open_near=True,
                    far_el=(22, -24), far_fist=(18 if clap else 34, -30 if clap else -36), open_far=True)
            fr.append(F(P))
        st["talk"] = S(fr, 6, True)
    elif key == "wren":                      # 1.5.2 flower seller: tends her armful of blooms (frames 0-3), then offers one out (4-5)
        fr = []
        for k in range(6):
            if k < 4:
                P = npc(head=5, near_el=(-13, -21), near_fist=(4, -22), open_near=False,
                        far_el=(20, -22), far_fist=(12 + (3 if k % 2 else 0), -36 + (2 if k in (1, 2) else 0)), open_far=True)
                fr.append(F(P, props=[("bouquet", "near", -6 if k % 2 else 4, k / 4.0)]))
            else:
                P = npc(head=0, near_el=(-13, -21), near_fist=(4, -22), open_near=False,
                        far_sh=(13, -41), far_el=(26, -32), far_fist=(40 if k == 4 else 44, -36), open_far=False)
                fr.append(F(P, props=[("bouquet", "near", 0, 0.5), ("stem", "far", -60, 0)]))
        st["idle_personality"] = S(fr, 8, True)
        st["talk"] = S(talk(dict(gc.HOLD), props=[("bouquet", "near", 0, 0)]), 6, True)
    # ---- 1.5.2 prequel NPCs (gen_cast.PREQUEL): same contract as dee - idle_personality 6f, talk 4f@6, 144x192, anchorX 72
    elif key == "lou":                       # reads the evening paper, page flutters, glances up over it
        fr = []
        for k in range(6):
            look = k in (3, 4)
            P = npc(head=0 if look else 6, near_el=(-8, -20), near_fist=(8, -24), open_near=False,
                    far_el=(20, -20), far_fist=(22, -24 + (2 if look else 0)), open_far=True)
            fr.append(F(P, props=[("newspaper", "near", 0, k / 6.0)]))
        st["idle_personality"] = S(fr, 8, True)
        st["talk"] = S(talk(dict(gc.HOLD), props=[("newspaper", "near", 0, 0)]), 6, True)
    elif key == "gus":                       # rail lantern swinging at his side, checks the yard (head turn)
        fr = []
        for k in range(6):
            a = 2 * math.pi * k / 6
            P = npc(head=1 + (3 if k in (2, 3) else 0), near_el=(-14, -19), near_fist=(-6 + 2 * math.sin(a), -2), open_near=False)
            fr.append(F(P, props=[("lantern", "near", 16 * math.sin(a), k / 6.0)]))
        st["idle_personality"] = S(fr, 8, True)
        st["talk"] = S(talk(dict(near_el=(-14, -19), near_fist=(-6, -2), open_near=False), props=[("lantern", "near", 0, 0)]), 6, True)
    elif key == "ivy":                       # ticks the rail paperwork with a pencil, glances back over her shoulder
        fr = []
        for k in range(6):
            back = k in (4, 5)
            P = npc(head=-4 if back else 5, near_el=(-13, -21), near_fist=(4, -22), open_near=False,
                    far_el=(20, -22), far_fist=(12 + (2 if k % 2 else 0), -30 + (2 if k % 2 else 0)), open_far=False)
            fr.append(F(P, props=[("clipboard", "near", 0, 0), ("pencil", "far", -30 if k % 2 else -10, 0)]))
        st["idle_personality"] = S(fr, 8, True)
        st["talk"] = S(talk(dict(gc.HOLD), props=[("clipboard", "near", 0, 0)]), 6, True)
    elif key == "pip":                       # bounces on his toes tossing the parcel up and catching it
        fr = []
        for k in range(6):
            t = k / 6.0; up = math.sin(t * math.pi)
            dy = 1.6 * (1 - math.cos(2 * math.pi * t))
            P = npc(head=2 - 4 * up, near_el=(-12, -22 - 4 * up), near_fist=(4, -24 - 8 * up), open_near=up > 0.5)
            P["torso"] = (P["torso"][0], P["torso"][1] + dy)
            fr.append(F(P, props=[("parcel", "near", 0, t)]))
        st["idle_personality"] = S(fr, 8, True)
        st["talk"] = S(talk(dict(gc.HOLD), props=[("parcel", "near", 0, 0)]), 6, True)
    return st

# ---------------------------------------------------------------- Silas boss
def silas_boss_states():
    st = {}
    st["boss_idle"] = S(guard_bob(4, amp=2.5), 6, True)
    st["boss_attack1"] = S([F(pose(lean=-6, head=-4, near_sh=(-12, -42), near_el=(-14, -62), near_fist=(-2, -82),
                                   far_sh=(13, -42), far_el=(20, -62), far_fist=(14, -84))),
                            F(pose(torso=(70, 104), lean=10, near_el=(10, -56), near_fist=(34, -58), far_el=(22, -54), far_fist=(42, -54))),
                            F(pose(torso=(74, 108), lean=20, head=6, near_el=(20, -36), near_fist=(44, -22), far_el=(28, -34), far_fist=(50, -20),
                                   near_knee=(54, 148), far_knee=(96, 146))),
                            F(pose(torso=(68, 104), lean=6))], 10, False, [1, 2], "near_fist")
    lunge = dict(torso=(76, 106), lean=22, head=-6, near_sh=(-4, -42), near_el=(18, -38), near_fist=(42, -36), open_near=True,
                 far_sh=(14, -42), far_el=(30, -40), far_fist=(50, -40), open_far=True,
                 near_knee=(52, 148), near_ankle=(30, 172), near_foot=26, far_knee=(98, 142), far_ankle=(108, 174))
    st["boss_attack2"] = S([F(pose(torso=(60, 108), lean=-6, near_knee=(50, 146), far_knee=(84, 146))),
                            F(pose(**lunge)), F(pose(**{**lunge, "open_near": False, "open_far": False})),
                            F(pose(torso=(66, 104), lean=0, near_fist=(10, -34), far_fist=(20, -34))), F(pose())], 10, False, [1, 2], "far_fist")
    slam_up = dict(lean=-4, head=-6, near_sh=(-12, -42), near_el=(-12, -64), near_fist=(0, -84), far_sh=(13, -42), far_el=(20, -64), far_fist=(14, -86),
                   near_knee=(62, 132), near_ankle=(52, 156), near_ground=False, far_knee=(90, 132), far_ankle=(90, 158), far_ground=False)
    slam = dict(torso=(64, 118), lean=20, head=8, near_el=(4, -26), near_fist=(26, 0), far_el=(18, -26), far_fist=(38, 2),
                near_knee=(50, 152), near_ankle=(36, 174), far_knee=(92, 150), far_ankle=(100, 174))
    st["boss_attack3"] = S([F(pose(**slam_up), lift=18, grounded=False),
                            F(pose(**slam), fx=[("shock", (104, 182), 1)]), F(pose(**slam), fx=[("shock", (100, 182), 2)]),
                            F(pose(**{**slam, "lean": 12, "torso": (64, 112)}), fx=[("shock", (98, 182), 3)]),
                            F(pose())], 10, False, [1, 2], ("box", 70, 150, 74, 40))
    fr = []
    for k in range(4):
        fr.append(F(pose(lean=-4, head=-4 + (k % 2) * 3, expr="talk" if k % 2 == 0 else "calm",
                         far_el=(28, -26), far_fist=(38 - (k % 2) * 4, -34 - (k % 2) * 3), open_far=True,
                         near_el=(-14, -20), near_fist=(-8, -4), open_near=True)))
    st["taunt"] = S(fr, 6, True)
    kneel = dict(torso=(62, 130), lean=10, head=12, expr="hurt", near_knee=(64, 176), near_ankle=(38, 178), near_ground=False, near_foot=60,
                 far_knee=(94, 152), far_ankle=(98, 174), near_el=(-14, -20), near_fist=(-10, -2), open_near=True,
                 far_el=(20, -20), far_fist=(30, -6), open_far=True)
    st["defeat"] = S([F(dict(HURT)), F({**HURT, "lean": -10, "head": -6}, dx=-4), F(pose(**kneel)),
                      F(pose(**{**kneel, "head": 20, "lean": 16})),
                      F(pose(**{**FLOORSIT, "head": -12}), rot=40, pivot=(62, 166), center=True), lying(-10, 76)], 7, False)
    fall, ground, getup = knockdown()
    st["knockdown_fall"] = S(fall, 10, False); st["knockdown_ground"] = S(ground, 3, True); st["getup"] = S(getup, 8, False)
    return st

# ---------------------------------------------------------------- thugs + snatcher
def thug_states(key):
    st = {}
    rec = F(pose(torso=(68, 104), lean=4))
    if key == "thug_purple":
        A = [F(pose(lean=-6, near_el=(-28, -36), near_fist=(-36, -48))),
             F(pose(torso=(68, 104), lean=8, near_sh=(-8, -42), near_el=(0, -48), near_fist=(20, -52))),
             F(pose(torso=(72, 106), lean=14, near_sh=(-2, -42), near_el=(20, -42), near_fist=(42, -40))), rec]
        B = [F(pose(lean=-4, near_el=(4, -30), near_fist=(28, -34), open_near=True, far_fist=(40, -36), open_far=True)),
             F(pose(lean=-12, head=-10)), F(pose(torso=(74, 106), lean=24, head=14), dx=4), rec]
        st["attackA"] = S(A, 12, False, [2], "near_fist"); st["attackB"] = S(B, 12, False, [2], "head")
    elif key == "thug_red":
        lar = dict(torso=(72, 104), lean=12, near_sh=(-6, -42), near_el=(16, -44), near_fist=(40, -44),
                   near_knee=(54, 144), near_ankle=(40, 172), near_foot=20, far_knee=(92, 140), far_ankle=(100, 174))
        A = [F(pose(lean=-4, near_el=(-24, -40), near_fist=(-30, -44))), F(pose(**lar)), F(pose(**lar), dx=6), rec]
        sc = dict(torso=(74, 106), lean=22, head=-6, near_sh=(-6, -42), near_el=(6, -26), near_fist=(14, -36),
                  far_sh=(14, -42), far_el=(12, -24), far_fist=(22, -30), near_knee=(50, 146), near_ankle=(30, 172), near_foot=26,
                  far_knee=(96, 140), far_ankle=(104, 174))
        B = [F(pose(torso=(62, 108), lean=-4)), F(pose(**sc)), F(pose(**sc), dx=8), rec]
        st["attackA"] = S(A, 12, False, [1, 2], "near_fist"); st["attackB"] = S(B, 12, False, [1, 2], ("box", 80, 50, 50, 70))
    elif key == "thug_teal":
        A = [F(pose(lean=-4, far_knee=(94, 136), far_ankle=(100, 160), far_ground=False, far_foot=-10)),
             F(pose(lean=-10, far_knee=(100, 150), far_ankle=(122, 170), far_ground=False, far_foot=-20)),
             F(pose(lean=-10, far_knee=(100, 150), far_ankle=(122, 170), far_ground=False, far_foot=-20)), rec]
        dp = dict(torso=(72, 104), lean=10, near_sh=(-4, -42), near_el=(18, -42), near_fist=(40, -42),
                  far_sh=(14, -42), far_el=(32, -40), far_fist=(50, -40))
        B = [F(pose(lean=0, near_fist=(10, -32), far_fist=(22, -32))), F(pose(**dp)), F(pose(**dp)), rec]
        st["attackA"] = S(A, 12, False, [1, 2], "far_ankle"); st["attackB"] = S(B, 12, False, [1, 2], "far_fist")
    elif key == "thug_orange":
        A = [F(pose(lean=-6, near_el=(-14, -60), near_fist=(-4, -78)), props=[("pipe", "near", -120, 0)]),
             F(pose(torso=(68, 104), lean=8, near_el=(4, -54), near_fist=(28, -58)), props=[("pipe", "near", -40, 0)]),
             F(pose(torso=(72, 106), lean=16, near_el=(18, -36), near_fist=(40, -32)), props=[("pipe", "near", 30, 0)]),
             F(pose(torso=(68, 104), lean=6, near_el=(-10, -20), near_fist=(-4, -6)), props=[("pipe", "near", 80, 0)])]
        B = [F(pose(torso=(62, 112), lean=8, near_knee=(52, 150), far_knee=(86, 149))),
             F(pose(torso=(70, 100), lean=30, near_el=(-20, -40), near_fist=(-30, -50), open_near=True, far_el=(36, -50), far_fist=(48, -58), open_far=True,
                    near_knee=(60, 132), near_ankle=(40, 150), near_ground=False, far_knee=(86, 134), far_ankle=(70, 156), far_ground=False), lift=16, grounded=False),
             F(pose(torso=(76, 104), lean=44, near_fist=(30, -10), far_fist=(44, -14),
                    near_knee=(64, 136), near_ankle=(40, 150), near_ground=False, far_knee=(90, 138), far_ankle=(70, 156), far_ground=False), lift=6, grounded=False),
             F(pose(torso=(70, 118), lean=26, near_knee=(54, 152), far_knee=(96, 150), near_fist=(30, -8), far_fist=(40, -10))), rec]
        st["attackA"] = S(A, 12, False, [2], ("box", 92, 80, 46, 50)); st["attackB"] = S(B, 12, False, [2, 3], ("box", 76, 60, 64, 80))
    elif key == "thug_grey":
        sh = dict(torso=(72, 104), lean=14, near_sh=(-4, -42), near_el=(18, -40), near_fist=(38, -40), open_near=True,
                  far_sh=(14, -42), far_el=(30, -42), far_fist=(44, -42), open_far=True)
        A = [F(pose(lean=-2, near_fist=(10, -34), far_fist=(22, -34), open_near=True, open_far=True)), F(pose(**sh)), F(pose(**sh)), rec]
        fk = dict(torso=(66, 100), lean=-6, near_knee=(96, 112), near_ankle=(76, 140), near_ground=False, near_foot=10,
                  far_knee=(64, 134), far_ankle=(44, 150), far_ground=False, far_foot=30,
                  near_el=(-22, -30), near_fist=(-26, -44), far_el=(24, -30), far_fist=(14, -44))
        B = [F(pose(torso=(64, 112), lean=8, near_knee=(52, 150), far_knee=(86, 149))),
             F(pose(**fk), lift=16, grounded=False), F(pose(**fk), lift=20, grounded=False),
             F(pose(torso=(66, 110), lean=6, near_knee=(54, 148), far_knee=(88, 147)))]
        st["attackA"] = S(A, 12, False, [1, 2], "far_fist"); st["attackB"] = S(B, 12, False, [1, 2], "near_knee")
    st["ko"] = S(ko_frames(), 8, False)
    fall, ground, getup = knockdown()
    st["knockdown_fall"] = S(fall, 10, False); st["knockdown_ground"] = S(ground, 3, True); st["getup"] = S(getup, 8, False)
    return st

def snatcher_states():
    st = {}
    run = run_cycle(8, 16, 26, 16, 70, 2.0, 1.2)
    for f in run:
        f["props"] = [("purse", "near", 0, 0)]
    st["run"] = S(run, 13, True)
    st["caught"] = S([F(dict(HURT), props=[("purse", "near", -30, 0)]),
                      F({**HURT, "lean": -20, "head": -10}, fx=[("purse_drop", (96, 168), 0)]),
                      F(pose(lean=-4, expr="hurt", near_el=(-16, -46), near_fist=(-10, -62), open_near=True,
                             far_el=(24, -48), far_fist=(30, -64), open_far=True), fx=[("purse_drop", (100, 176), 1)])], 8, False)
    st["ko"] = S(ko_frames(), 8, False)
    fall, ground, getup = knockdown()
    st["knockdown_fall"] = S(fall, 10, False); st["knockdown_ground"] = S(ground, 3, True); st["getup"] = S(getup, 8, False)
    return st

# ---------------------------------------------------------------- characters
CAST_KEYS = ["dee", "hank", "priya", "cam", "june", "silas", "tessa", "coach", "wren"]
PREQUEL_KEYS = list(gc.PREQUEL_KEYS)            # 1.5.2: lou, gus, ivy, pip (js/dlc_silas.js CAST ids)
THUG_KEYS = ["thug_purple", "thug_red", "thug_teal", "thug_orange", "thug_grey"]

def char_cfg(key):
    if key.startswith("matthew_"):
        return ("matthew", key[len("matthew_"):])
    if key == "silas_boss": return ("cast", gc.SILAS)
    if key == "silas": return ("cast", gc.SILAS)
    if key == "wren": return ("cast", gc.WREN)
    if key == "snatcher": return ("cast", gc.SNATCHER)
    if key in gc.CAST: return ("cast", gc.CAST[key])
    if key in gc.PREQUEL: return ("cast", gc.PREQUEL[key])         # 1.5.2 prequel NPCs (lou/gus/ivy/pip)
    if key in gc.THUGS: return ("cast", gc.THUGS[key])
    raise KeyError(key)

def states_for(key):
    if key.startswith("matthew_"): return matthew_states()
    if key == "silas_boss": return silas_boss_states()
    if key in CAST_KEYS or key in PREQUEL_KEYS: return cast_states(key)
    if key in THUG_KEYS: return thug_states(key)
    if key == "snatcher": return snatcher_states()
    raise KeyError(key)

def all_keys():
    # Enemy anims (silas_boss, thug_*, snatcher) are owned by Jack: tools/gen_anim_enemies.py -> anims_enemies.json.
    # The enemy state builders below are kept only as reference and are never written by this script.
    return ["matthew_" + o for o in OUTFIT_IDS] + CAST_KEYS + PREQUEL_KEYS

# ---------------------------------------------------------------- FX
def fx_draw(cv, fx):
    kind = fx[0]
    if kind == "sparkle":
        _, c, r = fx
        pts = []
        for i in range(8):
            rr = r if i % 2 == 0 else r * 0.3; a = math.radians(45 * i)
            pts.append((c[0] + rr * math.cos(a), c[1] + rr * math.sin(a)))
        Part(cv, [pts], PALEGOLD, shade=(0.6, 0.6), hi=None, rim=0, ink=0.5).commit()
    elif kind in ("star", "aura"):
        _, c, r = fx
        pal = GOLD if kind == "star" else AURA
        p = Part(cv, [g.star_pts(c, r, 0)], pal, shade=(1.5, 1.2), hi=(0.8, -0.8), rim=0, ink=0.6 if kind == "star" else 0)
        p.poly(g.star_pts(c, r * 0.45, 0), PALEGOLD["base"]); p.commit()
    elif kind == "burst":
        _, c, r = fx
        rays = []
        for i in range(8):
            a = math.radians(22.5 + 45 * i)
            rays.append([add(c, (r * 0.5 * math.cos(a - 0.25), r * 0.5 * math.sin(a - 0.25))),
                         add(c, (r * 1.45 * math.cos(a), r * 1.45 * math.sin(a))),
                         add(c, (r * 0.5 * math.cos(a + 0.25), r * 0.5 * math.sin(a + 0.25)))])
        Part(cv, rays, PALEGOLD, shade=(0.8, 0.8), hi=None, rim=0, ink=0.4).commit()
        p = Part(cv, [g.star_pts(c, r, 0)], GOLD, shade=(1.6, 1.2), hi=(0.8, -0.8), rim=0, ink=0.6)
        p.poly(g.star_pts(c, r * 0.5, 0), CORE); p.commit()
    elif kind == "speed":
        _, (x0, x1), ys = fx
        for i, y in enumerate(ys):
            Part(cv, [taper((x0 + i * 4, y), 0.8, (x1 + i * 6, y), 1.0)], SPEED, shade=(0, 0), hi=None, rim=0, ink=0).commit()
    elif kind == "embers":            # ember sparks trailing behind a heavy charge (k = phase)
        _, c, k = fx
        for i in range(12):
            a = 2.399 * i + k * 0.9; r = 6 + (i * 7 + k * 11) % 30
            q = (c[0] - abs(r * math.cos(a)) * 1.5, c[1] + r * math.sin(a) * 0.8)
            sz = 2.0 if i % 3 else 3.0
            Part(cv, [[(q[0], q[1] - sz), (q[0] + sz * 0.8, q[1]), (q[0], q[1] + sz), (q[0] - sz * 0.8, q[1])]],
                 dict(base=C(255, 120, 40), sh=C(230, 70, 30), dk=C(200, 50, 24), hi=C(255, 220, 140)), shade=(0.4, 0.4), hi=(0.3, -0.3), rim=0, ink=0.3).commit()
    elif kind == "shock":
        _, c, stage = fx
        for i in range(2 + stage):
            x = c[0] - 26 + i * 14 + stage * 4
            r = 4 + stage * 1.5 + (i % 2) * 2
            Part(cv, [ellipse_pts((x, c[1] - r * 0.6), r * 1.3, r, n=14)], DUST, shade=(1.2, 1), hi=(0.6, -0.6), rim=0, ink=0.5).commit()
        if stage < 3:
            Part(cv, [[(c[0] - 30, c[1] + 2), (c[0] + 36 + stage * 2, c[1] + 1), (c[0] + 36 + stage * 2, c[1] + 3), (c[0] - 30, c[1] + 4)]],
                 ramp((140, 120, 96)), shade=(0, 0), hi=None, rim=0, ink=0.4).commit()
    elif kind == "flowers":
        _, c, _k = fx
        pot = Part(cv, [[(c[0] - 8, c[1] - 12), (c[0] + 8, c[1] - 12), (c[0] + 6, c[1]), (c[0] - 6, c[1])]], ramp((190, 100, 70)),
                   shade=(1.6, 1), hi=(0.6, -0.6), rim=0.6, ink=0.6)
        pot.commit()
        for dx, col in ((-5, (240, 90, 140)), (0, (255, 210, 74)), (5, (180, 120, 240))):
            Part(cv, [taper((c[0] + dx * 0.6, c[1] - 12), 0.7, (c[0] + dx, c[1] - 22), 0.7)], ramp((70, 140, 70)), shade=(0, 0), hi=None, rim=0, ink=0.4).commit()
            Part(cv, [ellipse_pts((c[0] + dx, c[1] - 24), 2.6, 2.4, n=10)], ramp(col), shade=(0.8, 0.6), hi=None, rim=0, ink=0.5).commit()
    elif kind == "board":
        _, c, ang, flip = fx
        deck_col = (232, 76, 60) if flip != 1 else (36, 36, 40)
        w = 18 if flip != 2 else 6
        deck = [add(c, rot(q, ang)) for q in [(-w - 4, -2.6), (w + 4, -2.6), (w + 6, -0.6), (w + 4, 1.4), (-w - 4, 1.4), (-w - 6, -0.6)]]
        b = Part(cv, [deck], ramp(deck_col), shade=(1.2, 1), hi=(0.6, -0.6), rim=0.6, ink=0.7)
        b.line([add(c, rot((-w, -0.6), ang)), add(c, rot((w, -0.6), ang))], C(250, 220, 90), 0.6); b.commit()
        if flip != 2:
            for wx in (-w + 2, w - 2):
                wy = 4 if flip == 0 else -6
                Part(cv, [ellipse_pts(add(c, rot((wx, wy), ang)), 2.4, 2.4, n=10)], ramp((240, 236, 220)), shade=(0.6, 0.6), hi=None, rim=0, ink=0.6).commit()
    elif kind == "purse_drop":
        _, c, k = fx
        gc.draw_prop_at(cv, "purse", c, 40 + 50 * k, 0)

# ---------------------------------------------------------------- render one frame
def setup(key):
    kind, cfg = char_cfg(key)
    set_fx(FX_GREEN if key == "matthew_beacon" else FX_EMBER if key == "matthew_ironclad" else FX_GOLD)
    if kind == "matthew":
        g.set_outfit(cfg); g.HEAD_FN[0] = g.head_parts
        return None, {}
    gc.setup(cfg)
    kx, ky = cfg.get("build", (1, 1))
    xf = None if (kx, ky) == (1, 1) else (kx, ky, cfg.get("anchor_x", 68.0), 189.0)
    return xf, cfg

def hand_pt(P, which):
    o = P["torso"]; lean = P.get("lean", 0)
    return add(rot(P[which + "_fist"], lean), o)

def limb_pt(P, which):
    o = P["torso"]; lean = P.get("lean", 0)
    if which in ("near_fist", "far_fist"): return add(rot(P[which], lean), o)
    if which in ("near_ankle", "far_ankle", "near_knee", "far_knee"): return P[which]
    if which == "head": return add(add(rot((2, -46), lean), o), (6, -16))
    return o

OLD_PROPS = {"book", "clipboard", "spatula", "phone", "mug", "skateboard"}

def render_spec(key, spec):
    xf, cfg = setup(key)
    P = spec["P"]
    PX, PY = 80, 100                      # padding so rotated / dashing frames never clip
    cv = PadCanvas(FW + 2 * PX, FH + 2 * PY, xf, PX, PY)
    for fx in spec.get("fx_back", []): fx_draw(cv, fx)
    render_figure(cv, P)
    fit = cfg.get("fit", {}) if cfg else {}
    if fit.get("splatter") or fit.get("bag"): gc.draw_overlay(cv, P, fit)
    for kind, hand, ang, k in spec.get("props", []):
        if kind in OLD_PROPS and hand == "near": gc.draw_prop(cv, kind, P)
        else:
            pt = hand_pt(P, hand) if isinstance(hand, str) else hand
            gc.draw_prop_at(cv, kind, pt, ang, k)
    r = spec.get("rot", 0); dx = spec.get("dx", 0)
    if r or dx:
        px, py = spec.get("pivot", (68, 187))
        im = cv.img.rotate(r, resample=Image.BICUBIC, center=((px + PX) * g.S, (py + PY) * g.S)) if r else cv.img
        if dx:
            out = Image.new("RGBA", im.size, (0, 0, 0, 0)); out.paste(im, (int(dx * g.S), 0)); im = out
        cv.img = im
    for fx in spec.get("fx", []): fx_draw(cv, fx)
    big = finish(cv)
    bb = big.getchannel("A").getbbox()
    wx = PX
    if spec.get("center") and bb:
        wx = int(round((bb[0] + bb[2]) / 2 - 72))
    wy = (bb[3] - 1 - FEET) if bb else PY
    wy += int(spec.get("lift", 0))
    # never clip: grow the crop to the content; build() widens the state's cell (fw/fh/anchorX)
    l = min(wx, bb[0] - 1) if bb else wx; r_ = max(wx + FW, bb[2] + 1) if bb else wx + FW   # 1px clear margin
    t = min(wy, bb[1] - 1) if bb else wy
    out = big.crop((l, t, r_, wy + FH))
    sx, sy = PX - wx, PY - wy                 # native-pose -> 144x192 window offset (for hitboxes)
    return out, sx, sy, xf, (wx - l, r_ - wx - FW, wy - t)

class PadCanvas(Canvas):
    """Canvas whose native coords are offset by (ox, oy) so out-of-frame motion isn't lost."""
    def __init__(self, w, h, xf, ox, oy):
        super().__init__(w, h, xf); self.ox, self.oy = ox, oy
    def P(self, x, y):
        X, Y = Canvas.P(self, x, y)
        return (X + self.ox * g.S, Y + self.oy * g.S)

POSE_ABS = ("torso", "near_knee", "near_ankle", "far_knee", "far_ankle")
def shift_pose(P, dx, dy):
    Q = dict(P)
    for k in POSE_ABS:
        if k in Q: Q[k] = (Q[k][0] + dx, Q[k][1] + dy)
    return Q

def shift_fx(fx, dx, dy):
    kind = fx[0]
    if kind == "speed":
        _, (x0, x1), ys = fx
        return (kind, (x0 + dx, x1 + dx), [y + dy for y in ys])
    return (kind, add(fx[1], (dx, dy))) + tuple(fx[2:])

def job(args):
    key, state, idx = args
    sts = states_for(key)
    stt = sts[state]; spec = stt["frames"][idx]
    if key == "matthew_ironclad" and state == "special":
        P2 = dict(spec["P"], visor_flare=idx in (1, 2, 3, 4))                 # amber/orange visor flare
        fxb = list(spec.get("fx_back", []))
        if 2 <= idx <= 5: fxb.append(("embers", (52, 96), idx))           # ember sparks in the shoulder-charge trail
        spec = dict(spec, P=P2, fx_back=fxb)
    if key == "matthew_beacon" and (state.startswith("combo") or state == "special") and idx in stt["active"]:
        spec = dict(spec, P=dict(spec["P"], ring_flare=True))       # ring flares on hits
    im, sx, sy, xf, extra = render_spec(key, spec)
    hb = None
    if idx in stt["active"] and stt["hit"]:
        h = stt["hit"]
        if isinstance(h, tuple):
            hb = dict(x=h[1], y=h[2], w=h[3], h=h[4])
        else:
            pt = limb_pt(spec["P"], h)
            if xf: pt = (xf[2] + (pt[0] - xf[2]) * xf[0], xf[3] + (pt[1] - xf[3]) * xf[1])
            x, y = pt[0] + spec.get("dx", 0) + sx, pt[1] + sy
            hb = dict(x=int(x - 14), y=int(y - 12), w=28, h=24)
    buf = io.BytesIO(); im.save(buf, "PNG")
    return key, state, idx, buf.getvalue(), dict(grounded=spec.get("grounded", True), lying=spec.get("lying", False),
                                                  active=idx in stt["active"], hitbox=hb, extra=extra)

def build(keys, jobs=6):
    t0 = time.time()
    tasks = []
    plan = {}
    for key in keys:
        sts = states_for(key)
        plan[key] = [(s, len(v["frames"]), v["fps"], v["loop"]) for s, v in sts.items()]
        for s, v in sts.items():
            for i in range(len(v["frames"])): tasks.append((key, s, i))
    with Pool(jobs) as pool:
        res = pool.map(job, tasks, chunksize=2)
    frames = {(k, s, i): (Image.open(io.BytesIO(b)).convert("RGBA"), m) for k, s, i, b, m in res}
    man_path = os.path.join(SPR, "anims.json")
    manifest = json.load(open(man_path)) if os.path.exists(man_path) else {}
    manifest.setdefault("version", 1); manifest["frameW"] = FW; manifest["frameH"] = FH; manifest["feetRow"] = FEET
    chars = manifest.setdefault("characters", {})
    import gen_kits                                    # kit states (gen_kits.py) survive a rebuild of the shared states
    keep_kits = gen_kits.kit_states_from(manifest)
    for key in keys:
        # Shared schema with anims_enemies.json: states that fit 144x192 go in <key>_anim.png,
        # states whose poses would touch a frame edge go in <key>_anim_wide.png at 240x(192+) with anchorX 120.
        # Frame indices count within each state's own file; per-frame sx/sw/sy/sh are always written.
        WW = 240
        lay = []; cnt_n = cnt_w = 0; H_n = FH; H_w = FH
        for s, cnt, fps, loop in plan[key]:
            ex = [frames[(key, s, i)][1]["extra"] for i in range(cnt)]
            L = max(e[0] for e in ex); R = max(e[1] for e in ex); T = max(e[2] for e in ex)
            wide = (L or R)
            if wide:
                assert max(L, R) <= (WW - FW) // 2, (key, s, L, R)
                L = (WW - FW) // 2; fw = WW; start = cnt_w; cnt_w += cnt; H_w = max(H_w, FH + T)
            else:
                fw = FW; start = cnt_n; cnt_n += cnt; H_n = max(H_n, FH + T)
            lay.append((s, cnt, fps, loop, wide, start, fw, FH + T, L, T))
        fname = "assets/sprites/%s_anim.png" % key; wname = "assets/sprites/%s_anim_wide.png" % key
        strips = {False: Image.new("RGBA", (max(1, cnt_n) * FW, H_n), (0, 0, 0, 0)),
                  True: Image.new("RGBA", (max(1, cnt_w) * WW, H_w), (0, 0, 0, 0))}
        entry = dict(file=fname, states={})
        if cnt_w: entry["wideFile"] = wname
        for s, cnt, fps, loop, wide, start, fw, fh, L, T in lay:
            ms = []
            for i in range(cnt):
                im, m = frames[(key, s, i)]
                eL, _, eT = m["extra"]
                strips[bool(wide)].paste(im, ((start + i) * fw + L - eL, T - eT)); ms.append(m)
            hb = [None if not m["hitbox"] else dict(m["hitbox"], x=m["hitbox"]["x"] + L, y=m["hitbox"]["y"] + T) for m in ms]
            entry["states"][s] = dict(file=wname if wide else fname, frames=list(range(start, start + cnt)), fps=fps, loop=loop,
                                      fw=fw, fh=fh, anchorX=fw // 2,
                                      sx=[(start + i) * fw for i in range(cnt)], sw=[fw] * cnt, sy=[0] * cnt, sh=[fh] * cnt,
                                      grounded=[m["grounded"] for m in ms], lying=[m["lying"] for m in ms],
                                      active=[m["active"] for m in ms], hitbox=hb)
        pos = cnt_n + cnt_w
        strips[False].save(os.path.join(SPR, key + "_anim.png"))
        if cnt_w: strips[True].save(os.path.join(SPR, key + "_anim_wide.png"))
        chars[key] = entry
        print("anim", key, pos, "frames")
    kept = {k: v for k, v in keep_kits.items() if k in keys}
    if kept: gen_kits.apply_kit(manifest, kept); print("kept kit states for", sorted(kept))
    manifest["aliases"] = {"matthew": "matthew_<outfit> (falls back to matthew_polo)"}
    # 1.5.2: keep outfits installed by other tools (e.g. "silas" from install_silas_outfit.py) instead of dropping them
    manifest["outfits"] = OUTFIT_IDS + [o for o in manifest.get("outfits", []) if o not in OUTFIT_IDS]
    manifest["rev"] = str(int(time.time()))          # cache-bust key for strips (sprites.js appends ?v=rev)
    json.dump(manifest, open(man_path, "w"), indent=1)
    print("done %d frames in %.1fs" % (len(tasks), time.time() - t0))

if __name__ == "__main__":
    keys = all_keys()
    ENEMY = {"silas_boss", "snatcher", *THUG_KEYS}
    jobs = 6
    a = sys.argv[1:]
    if "--only" in a: keys = [k for k in a[a.index("--only") + 1].split(",") if k not in ENEMY]
    if "--jobs" in a: jobs = int(a[a.index("--jobs") + 1])
    build(keys, jobs)
