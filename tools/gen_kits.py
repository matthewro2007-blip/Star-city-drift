#!/usr/bin/env python3
"""Star City Drift 2D - outfit KITS (signature weapon + signature move). OWNS the per-outfit Matthew states
idle_signature / combo3 / special (every other Matthew state is still built by tools/gen_anims.py).

Writes (live):
  assets/sprites/matthew_<outfit>_kit.png       states that fit 144x192
  assets/sprites/matthew_<outfit>_kit_wide.png  special (always) + any state whose weapon/FX leaves the 144 cell (240 wide, anchorX 120)
  assets/sprites/anims.json                     merges ONLY those three states (+ a `kit` {weapon, move} tag) into
                                                characters.matthew_<outfit>; the rest of the file is re-read and preserved.
tools/gen_anims.py keeps these kit states across its own rebuilds (states whose file is a *_kit strip).
Weapon/FX drawers: tools/kit_draw.py. HUD icons: tools/gen_weapon_icons.py. Check: tools/check_kits.py.
usage: gen_kits.py [--only polo,street] [--jobs N] [--out DIR]
       --out DIR = test build (strips + kits_anims.json under DIR), live files untouched. KITS_CACHE=dir enables a render cache.
"""
import io, json, math, os, sys, time
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from multiprocessing import Pool
from PIL import Image
import gen_matthew_v2 as g
import gen_anims as ga
from gen_matthew_v2 import C, add, rot, lerp, pose, render_figure, finish, FW, FH
import kit_draw as kd

OUT_SPR = g.SPR
KIT_REV = "1.3.1-kits"
FEET = 189; WW = 240
OUTFITS = ["polo", "photo", "hoodie", "jacket", "street", "varsity", "mechanic", "diner", "gold", "webslinger", "beacon", "ironclad"]
KIT = {
    "polo":       ("Hardcover Book", "Detention"),
    "photo":      ("Strap Camera", "Flash Pop"),
    "hoodie":     ("Skateboard", "Kickflip"),
    "jacket":     ("Bike Chain", "Whip Crack"),
    "street":     ("Baseball Bat", "Line Drive"),
    "varsity":    ("Football", "Spiral"),
    "mechanic":   ("Pipe Wrench", "Torque"),
    "diner":      ("Frying Pan", "Hot Plate"),
    "gold":       ("Gold Chain", "Encore"),
    "webslinger": ("Star-Line", "Star Yank"),
    "beacon":     ("Hard-Light Star Shard", "Star Flare"),
    "ironclad":   ("Breach Gauntlets", "Breach"),
}

# ---------------------------------------------------------------- pose helpers (hands in ABSOLUTE native px)
NSH, FSH = (-12, -40), (13, -41)
L1, L2 = 20.0, 21.0
def ik(sh, hand, bend):
    dx, dy = hand[0] - sh[0], hand[1] - sh[1]; d = math.hypot(dx, dy) or 1e-3
    dd = min(max(d, 9.0), L1 + L2 - 0.8)
    hand = (sh[0] + dx / d * dd, sh[1] + dy / d * dd)
    a = math.acos(max(-1, min(1, (L1 * L1 + dd * dd - L2 * L2) / (2 * L1 * dd))))
    base = math.atan2(dy, dx)
    return (sh[0] + L1 * math.cos(base + bend * a), sh[1] + L1 * math.sin(base + bend * a)), hand

LEGS = dict(
    stance=dict(near_knee=(55, 142), near_ankle=(44, 174), near_foot=4, far_knee=(86, 141), far_ankle=(95, 174), far_foot=0),
    crouch=dict(near_knee=(52, 150), near_ankle=(42, 174), near_foot=4, far_knee=(88, 149), far_ankle=(96, 174), far_foot=0),
    wide=dict(near_knee=(46, 147), near_ankle=(33, 174), near_foot=8, far_knee=(99, 146), far_ankle=(110, 174), far_foot=-4),
    lunge=dict(near_knee=(56, 146), near_ankle=(38, 172), near_foot=22, far_knee=(98, 143), far_ankle=(106, 174), far_foot=0),
    back=dict(near_knee=(50, 144), near_ankle=(40, 174), near_foot=6, far_knee=(84, 143), far_ankle=(95, 174), far_foot=0),
    tiptoe=dict(near_knee=(58, 138), near_ankle=(48, 172), near_foot=18, far_knee=(86, 138), far_ankle=(94, 172), far_foot=10),
    slide=dict(near_knee=(46, 156), near_ankle=(24, 172), near_foot=34, far_knee=(100, 152), far_ankle=(128, 172), far_foot=-12),
    stride=dict(near_knee=(52, 146), near_ankle=(36, 173), near_foot=16, far_knee=(96, 142), far_ankle=(108, 174), far_foot=0),
)
def legs(name, dx=0, dy=0):
    out = {}
    for k, v in LEGS[name].items():
        out[k] = (v[0] + dx, v[1] + dy) if isinstance(v, tuple) else v
    return out

def K(torso=(66, 103), lean=4, head=0, nh=None, fh=None, nb=1, fb=1, lg="stance", ldx=0, ldy=0, **kw):
    P = pose(torso=torso, lean=lean, head=head)
    P.update(legs(lg, ldx, ldy))
    loc = lambda a: rot((a[0] - torso[0], a[1] - torso[1]), -lean)
    if nh is not None:
        el, h = ik(P["near_sh"], loc(nh), nb); P["near_el"], P["near_fist"] = el, h
    if fh is not None:
        el, h = ik(P["far_sh"], loc(fh), fb); P["far_el"], P["far_fist"] = el, h
    P.update(kw)
    return P

def TLp(P, q): return add(rot(q, P.get("lean", 0)), P["torso"])
def grip(P, which="near"):
    f = TLp(P, P[which + "_fist"]); e = TLp(P, P[which + "_el"])
    a = math.atan2(f[1] - e[1], f[0] - e[0])
    return (f[0] + 1.5 * math.cos(a), f[1] + 1.5 * math.sin(a))
def neck(P): return TLp(P, (4, -44))

def W(kind, at="near", **kw): d = dict(kind=kind, at=at); d.update(kw); return d
def X(kind, **kw): d = dict(kind=kind, at=None); d.update(kw); return d
def Fr(P, front=(), back=(), fx=(), mid=(), regrip=True, **o):
    d = dict(P=P, front=list(front), back=list(back), fx=list(fx), mid=list(mid), regrip=regrip); d.update(o); return d
def bob(k, n=6):
    a = 2 * math.pi * k / n; return 1.5 * (1 - math.cos(a)), math.sin(a)

SWOOSH = (255, 248, 226)

# ---------------------------------------------------------------- per-outfit kits
def kit_polo():
    idle = []
    for k in range(6):
        dy, r = bob(k)
        P = K(torso=(66, 103 + dy), lean=4, head=1.5 * r, nh=(80, 88 + dy), fh=(100, 70 + dy), lg="stance", ldy=0,
              near_knee=(55, 142 + dy * 0.6), far_knee=(86, 141 + dy * 0.6))
        idle.append(Fr(P, front=[W("book", ang=-78 + 14 * max(0, r), hit=False)]))
    c3 = [Fr(K(torso=(64, 111), lean=10, head=4, nh=(52, 120), fh=(96, 80), lg="crouch"), back=[W("book", ang=120)]),
          Fr(K(torso=(68, 104), lean=2, head=-2, nh=(100, 86), fh=(92, 82), lg="stance"),
             front=[W("book", ang=-40, hit=True)], mid=[X("swoosh", c=(70, 92), r=38, a0=150, a1=20, width=7)]),
          Fr(K(torso=(70, 99), lean=-6, head=-8, nh=(96, 56), fh=(88, 84), lg="tiptoe"),
             front=[W("book", ang=-95, hit=True)], mid=[X("swoosh", c=(70, 86), r=34, a0=60, a1=-60, width=8)]),
          Fr(K(torso=(67, 104), lean=4, nh=(80, 88), fh=(100, 70)), front=[W("book", ang=-70)])]
    sp = [Fr(K(torso=(64, 104), lean=-2, head=-2, nh=(78, 62), fh=(98, 72), lg="stance"), front=[W("book", ang=-96)]),
          Fr(K(torso=(64, 101), lean=-8, head=-8, nh=(62, 22), fh=(96, 66), nb=1, lg="tiptoe", ldx=-2), back=[W("book", ang=-150)], regrip=False),
          Fr(K(torso=(70, 104), lean=8, head=-2, nh=(100, 46), fh=(92, 80), nb=1, lg="stride"),
             front=[W("book", ang=-50)], mid=[X("swoosh", c=(76, 80), r=44, a0=-140, a1=-50, width=10)]),
          Fr(K(torso=(74, 110), lean=18, head=6, nh=(112, 98), fh=(92, 96), lg="stride", ldx=2),
             front=[W("book", ang=72, hit=True)], mid=[X("swoosh", c=(78, 84), r=44, a0=-100, a1=40, width=11)],
             fx=[X("pow", c=(124, 130), r=9, col=(255, 236, 190), core=(255, 255, 250), hit=True),
                 X("lines", c=(124, 130), r0=14, r1=24, angs=(-160, -125, -90, -55, -20)), X("dust", c=(122, 186), k=0)]),
          Fr(K(torso=(74, 110), lean=18, head=6, nh=(112, 98), fh=(92, 96), lg="stride", ldx=2),
             front=[W("book", ang=74, hit=True)],
             fx=[X("pow", c=(126, 130), r=12, col=(255, 236, 190), core=(255, 255, 250), hit=True),
                 X("lines", c=(126, 130), r0=18, r1=30, angs=(-165, -130, -95, -60, -25, 5)),
                 X("paper", c=(142, 100), ang=20), X("paper", c=(116, 92), ang=-30), X("dust", c=(122, 186), k=1)]),
          Fr(K(torso=(72, 107), lean=12, head=2, nh=(104, 86), fh=(94, 86), lg="stride"), front=[W("book", ang=30)],
             fx=[X("paper", c=(150, 86), ang=50), X("paper", c=(126, 70), ang=-10)]),
          Fr(K(torso=(68, 104), lean=6, nh=(84, 86), fh=(100, 72)), front=[W("book", ang=-50)]),
          Fr(K(torso=(66, 103), lean=4, nh=(80, 88), fh=(100, 70)), front=[W("book", ang=-78)])]
    return idle, c3, [1, 2], sp, [3, 4]

def kit_photo():
    idle = []
    for k in range(6):
        dy, r = bob(k)
        lift = 6 if k in (2, 3) else 0
        P = K(torso=(66, 103 + dy), lean=4, head=1.5 * r - (3 if lift else 0), nh=(84, 92 + dy - lift), fh=(100, 70 + dy),
              near_knee=(55, 142 + dy * 0.6), far_knee=(86, 141 + dy * 0.6))
        idle.append(Fr(P, front=[W("camera", ang=-4, neck=True)]))
    c3 = [Fr(K(torso=(62, 106), lean=-4, head=2, nh=(50, 108), fh=(98, 74), lg="back"), back=[W("camera", ang=150, neck=True)]),
          Fr(K(torso=(68, 104), lean=6, nh=(88, 98), fh=(98, 76), lg="stance"),
             front=[W("camera", at="strap", off=(20, 6), ang=10, hit=True)], mid=[X("swoosh", c=(72, 90), r=40, a0=130, a1=30, width=7)]),
          Fr(K(torso=(72, 104), lean=10, head=-2, nh=(100, 80), fh=(94, 80), lg="lunge"),
             front=[W("camera", at="strap", off=(24, -10), ang=-30, hit=True)], mid=[X("swoosh", c=(76, 92), r=46, a0=90, a1=-40, width=8)]),
          Fr(K(torso=(67, 104), lean=4, nh=(84, 92), fh=(100, 70)), front=[W("camera", ang=-4, neck=True)])]
    up = dict(nh=(90, 50), fh=(98, 54))
    low = dict(torso=(70, 118), lean=14, head=-4, nh=(98, 80), fh=(104, 84), lg="crouch", ldx=4, ldy=0)
    sp = [Fr(K(torso=(66, 104), lean=0, head=-2, nh=(86, 64), fh=(98, 66)), front=[W("camera", ang=0, neck=True)]),
          Fr(K(torso=(66, 104), lean=-2, head=-4, **up), front=[W("camera", ang=0, neck=True)], fx=[X("sparkle", c=(110, 46), r=5)]),
          Fr(K(torso=(66, 104), lean=-2, head=-4, **up), front=[W("camera", ang=0, neck=True)],
             fx=[X("flash", c=(118, 47), r=12, hit=True)]),
          Fr(K(**low), front=[W("camera", ang=-6, neck=True)],
             fx=[X("flash", c=(134, 72), r=19, hit=True), X("lines", c=(134, 72), r0=26, r1=36, angs=(-60, -30, 0, 30, 60), col=(255, 236, 160))]),
          Fr(K(**low), front=[W("camera", ang=-6, neck=True)],
             fx=[X("flash", c=(140, 74), r=13), X("sparkle", c=(156, 50), r=6), X("sparkle", c=(162, 96), r=5), X("sparkle", c=(124, 44), r=4)]),
          Fr(K(**low), front=[W("camera", ang=-6, neck=True)], fx=[X("sparkle", c=(150, 60), r=4), X("sparkle", c=(158, 92), r=3)]),
          Fr(K(torso=(68, 108), lean=8, nh=(88, 84), fh=(100, 76), lg="crouch"), front=[W("camera", ang=-4, neck=True)]),
          Fr(K(torso=(66, 103), lean=4, nh=(84, 92), fh=(100, 70)), front=[W("camera", ang=-4, neck=True)])]
    return idle, c3, [1, 2], sp, [2, 3]

def kit_hoodie():
    idle = []
    for k in range(6):
        dy, r = bob(k)
        P = K(torso=(66, 103 + dy), lean=4, head=1.5 * r, nh=(46, 112 + dy), fh=(100, 70 + dy), nb=-1,
              near_knee=(55, 142 + dy * 0.6), far_knee=(86, 141 + dy * 0.6))
        idle.append(Fr(P, front=[W("board", at="near", off=(-4, 30), ang=96 + 4 * r, flip=0)]))
    c3 = [Fr(K(torso=(62, 106), lean=-4, nh=(60, 86), fh=(76, 88), lg="back"), front=[W("board", at="near", off=(14, 0), ang=0, flip=0)]),
          Fr(K(torso=(74, 105), lean=12, head=-2, nh=(100, 84), fh=(112, 84), lg="lunge"),
             front=[W("board", at="near", off=(22, 0), ang=-4, flip=0, hit=True)], fx=[X("lines", c=(152, 82), r0=4, r1=12, angs=(-40, 0, 40))]),
          Fr(K(torso=(74, 105), lean=12, head=-2, nh=(102, 84), fh=(114, 84), lg="lunge"),
             front=[W("board", at="near", off=(22, 0), ang=-4, flip=0, hit=True)]),
          Fr(K(torso=(66, 104), lean=4, nh=(70, 92), fh=(84, 92)), front=[W("board", at="near", off=(14, 0), ang=0, flip=0)])]
    sl = dict(torso=(68, 130), lean=10, head=-4, lg="slide")
    sp = [Fr(K(torso=(64, 112), lean=10, head=2, nh=(46, 120), fh=(98, 90), lg="crouch"), back=[W("board", at="near", off=(-6, 10), ang=160, flip=0)]),
          Fr(K(nh=(90, 118), fh=(108, 104), **sl), regrip=False, front=[X("board", c=(126, 172), ang=0, flip=0)],
             fx=[X("speed", x0=0, x1=30, ys=[118, 136, 154]), X("dust", c=(30, 184), k=0)]),
          Fr(K(nh=(92, 112), fh=(108, 100), **sl), regrip=False, front=[X("board", c=(134, 158), ang=-24, flip=2, hit=True)],
             mid=[X("swoosh", c=(118, 168), r=26, a0=150, a1=290, width=8)],
             fx=[X("speed", x0=0, x1=34, ys=[114, 132, 150]), X("dust", c=(26, 184), k=1)], dx=4),
          Fr(K(nh=(94, 110), fh=(108, 100), **sl), regrip=False, front=[X("board", c=(140, 146), ang=-40, flip=1, hit=True)],
             mid=[X("swoosh", c=(124, 160), r=28, a0=200, a1=330, width=9)],
             fx=[X("speed", x0=0, x1=30, ys=[116, 134, 152]), X("dust", c=(22, 184), k=2), X("lines", c=(140, 146), r0=24, r1=32, angs=(-60, -30, 0))], dx=8),
          Fr(K(nh=(100, 108), fh=(110, 102), **sl), front=[W("board", at="near", off=(22, 2), ang=-8, flip=0)], fx=[X("dust", c=(30, 184), k=1)], dx=8),
          Fr(K(torso=(72, 112), lean=8, nh=(86, 106), fh=(104, 96), lg="crouch", ldx=4), front=[W("board", at="near", off=(14, 2), ang=0, flip=0)], dx=6),
          Fr(K(torso=(68, 106), lean=4, nh=(62, 104), fh=(100, 74)), front=[W("board", at="near", off=(-4, 28), ang=100, flip=0)], dx=2),
          Fr(K(torso=(66, 103), lean=4, nh=(46, 112), fh=(100, 70), nb=-1), front=[W("board", at="near", off=(-4, 30), ang=96, flip=0)])]
    return idle, c3, [1, 2], sp, [2, 3]

def chain_hang(g0, sway, n=5, L=7.0):
    pts, a = [], 90 + sway
    p = g0
    for i in range(n):
        a2 = a - sway * 0.25 * i
        p = add(p, (L * math.cos(math.radians(a2)), L * math.sin(math.radians(a2)))); pts.append(p)
    return pts
def chain_line(g0, end, sag=0.0, wave=0.0, n=10):
    out = []
    for i in range(1, n + 1):
        t = i / n; p = lerp(g0, end, t)
        out.append((p[0], p[1] + sag * 4 * t * (1 - t) + wave * math.sin(t * math.pi * 2)))
    return out

def kit_jacket():
    idle = []
    for k in range(6):
        dy, r = bob(k)
        P = K(torso=(66, 103 + dy), lean=4, head=1.5 * r, nh=(70, 106 + dy), fh=(100, 70 + dy),
              near_knee=(55, 142 + dy * 0.6), far_knee=(86, 141 + dy * 0.6))
        idle.append(Fr(P, front=[W("bikechain", tailf=("hang", 14 * r, 6, 6.4))]))
    c3 = [Fr(K(torso=(62, 104), lean=-6, head=-2, nh=(60, 40), fh=(96, 72), nb=-1, lg="back"), back=[W("bikechain", tail=[(48, 30), (38, 26), (30, 28), (24, 34)])]),
          Fr(K(torso=(68, 104), lean=6, nh=(92, 54), fh=(96, 80), nb=-1),
             front=[W("bikechain", tailf=("arc", (110, 34), (134, 52), 9), hit=True)], mid=[X("swoosh", c=(80, 80), r=52, a0=-150, a1=-40, width=8)]),
          Fr(K(torso=(72, 106), lean=14, head=4, nh=(104, 92), fh=(94, 92), lg="lunge"),
             front=[W("bikechain", tailf=("arc", (130, 112), (140, 150), 9), hit=True)], mid=[X("swoosh", c=(84, 92), r=54, a0=-60, a1=50, width=9)]),
          Fr(K(torso=(67, 104), lean=4, nh=(74, 104), fh=(100, 70)), front=[W("bikechain", tailf=("hang", 4, 6, 6.4))])]
    sp = [Fr(K(torso=(62, 106), lean=-8, head=-2, nh=(46, 84), fh=(96, 74), nb=1, lg="back"),
             back=[W("bikechain", tail=[(40, 92), (32, 98), (24, 102), (16, 106), (10, 110)])]),
          Fr(K(torso=(66, 105), lean=0, nh=(80, 82), fh=(98, 78), lg="stride", ldx=-4),
             back=[W("bikechain", tail=[(70, 92), (58, 98), (46, 102), (34, 104), (24, 104), (14, 102)])],
             fx=[X("swoosh", c=(70, 84), r=40, a0=190, a1=110, width=6, sq=0.5)]),
          Fr(K(torso=(72, 104), lean=10, head=-2, nh=(104, 78), fh=(96, 84), lg="stride"),
             front=[W("bikechain", tailf=("line", (170, 80), 4, 1.5, 15), hit=True)],
             mid=[X("swoosh", c=(90, 82), r=74, a0=180, a1=360, width=8, sq=0.22)]),
          Fr(K(torso=(74, 104), lean=12, head=-2, nh=(106, 78), fh=(96, 84), lg="stride"),
             front=[W("bikechain", tailf=("line", (172, 76), -2, 0, 16), hit=True)],
             fx=[X("pow", c=(174, 76), r=6, col=(250, 250, 240), core=(255, 255, 255), rays=8, hit=True), X("lines", c=(174, 76), r0=9, r1=13, angs=(-60, -20, 20, 60))]),
          Fr(K(torso=(72, 104), lean=8, nh=(100, 82), fh=(96, 84), lg="stride"),
             front=[W("bikechain", tailf=("line", (160, 92), 10, 6, 14))]),
          Fr(K(torso=(68, 104), lean=4, nh=(88, 92), fh=(98, 78), lg="stride", ldx=-2), front=[W("bikechain", tailf=("hang", -30, 6, 6.4))]),
          Fr(K(torso=(67, 104), lean=4, nh=(76, 102), fh=(100, 72)), front=[W("bikechain", tailf=("hang", -10, 6, 6.4))]),
          Fr(K(torso=(66, 103), lean=4, nh=(70, 106), fh=(100, 70)), front=[W("bikechain", tailf=("hang", 0, 6, 6.4))])]
    return idle, c3, [1, 2], sp, [2, 3]

def kit_street():
    idle = []
    for k in range(6):
        dy, r = bob(k)
        P = K(torso=(66, 103 + dy), lean=4, head=1.5 * r, nh=(78, 78 + dy), fh=(100, 72 + dy), nb=1,
              near_knee=(55, 142 + dy * 0.6), far_knee=(86, 141 + dy * 0.6))
        idle.append(Fr(P, front=[W("bat", ang=-128 + 3 * r)]))
    two = lambda gp, ang, d=7: (gp[0] + d * math.cos(math.radians(ang)), gp[1] + d * math.sin(math.radians(ang)))
    c3 = [Fr(K(torso=(64, 104), lean=-2, nh=(72, 60), fh=two((72, 60), -110), nb=1, lg="back"), back=[W("bat", ang=-110)], regrip=False),
          Fr(K(torso=(70, 104), lean=8, nh=(96, 74), fh=two((96, 74), -20), lg="stance"), front=[W("bat", ang=-20, hit=True)],
             mid=[X("swoosh", c=(80, 78), r=50, a0=-110, a1=-20, width=8)]),
          Fr(K(torso=(74, 106), lean=12, head=2, nh=(102, 92), fh=two((102, 92), 10), lg="lunge"), front=[W("bat", ang=10, hit=True)],
             fx=[X("lines", c=(152, 100), r0=4, r1=12, angs=(-40, 0, 40))]),
          Fr(K(torso=(67, 104), lean=4, nh=(78, 78), fh=(100, 72)), front=[W("bat", ang=-128)])]
    sp = [Fr(K(torso=(62, 104), lean=-6, head=0, nh=(64, 64), fh=two((64, 64), -120), lg="back"), back=[W("bat", ang=-120)], regrip=False),
          Fr(K(torso=(60, 106), lean=-10, head=2, nh=(56, 68), fh=two((56, 68), -168), lg="stride", ldx=-6), back=[W("bat", ang=-168)], regrip=False),
          Fr(K(torso=(68, 106), lean=4, head=-2, nh=(84, 92), fh=two((84, 92), -110), lg="stride"), back=[W("bat", ang=-110)], regrip=False,
             fx=[X("swoosh", c=(78, 96), r=52, a0=200, a1=260, width=8)]),
          Fr(K(torso=(74, 106), lean=12, head=0, nh=(100, 96), fh=two((100, 96), 0), lg="stride", ldx=2), front=[W("bat", ang=0, hit=True)],
             mid=[X("swoosh", c=(80, 98), r=66, a0=-150, a1=0, width=12, sq=0.55)],
             fx=[X("pow", c=(150, 96), r=10, hit=True)]),
          Fr(K(torso=(74, 106), lean=12, head=-2, nh=(104, 90), fh=two((104, 90), -28), lg="stride", ldx=2), front=[W("bat", ang=-28, hit=True)],
             mid=[X("swoosh", c=(80, 98), r=66, a0=-130, a1=-28, width=13, sq=0.55)],
             fx=[X("pow", c=(156, 82), r=14, hit=True), X("lines", c=(156, 82), r0=20, r1=30, angs=(-40, -10, 20, 50))]),
          Fr(K(torso=(70, 104), lean=-4, head=-6, nh=(84, 56), fh=two((84, 56), -150), nb=-1, lg="stride"), back=[W("bat", ang=-150)], regrip=False,
             fx=[X("swoosh", c=(78, 80), r=50, a0=-30, a1=-120, width=8)]),
          Fr(K(torso=(68, 104), lean=0, head=-4, nh=(80, 62), fh=two((80, 62), -150), nb=-1), back=[W("bat", ang=-150)], regrip=False),
          Fr(K(torso=(66, 103), lean=4, nh=(78, 78), fh=(100, 72)), front=[W("bat", ang=-128)])]
    return idle, c3, [1, 2], sp, [3, 4]

def kit_varsity():
    idle = []
    for k in range(6):
        dy, r = bob(k)
        toss = [0, 6, 14, 18, 12, 4][k]
        P = K(torso=(66, 103 + dy), lean=4, head=1.5 * r - toss * 0.2, nh=(82, 90 + dy - (3 if toss else 0)), fh=(100, 70 + dy),
              near_knee=(55, 142 + dy * 0.6), far_knee=(86, 141 + dy * 0.6))
        idle.append(Fr(P, front=[W("football", at="near", off=(4, -6 - toss), ang=-30 + 60 * k)], regrip=(toss == 0)))
    c3 = [Fr(K(torso=(64, 110), lean=10, head=4, nh=(78, 86), fh=(96, 92), lg="crouch"), front=[W("football", at="near", off=(4, -3), ang=-20)]),
          Fr(K(torso=(76, 106), lean=22, head=-6, nh=(84, 84), fh=(126, 72), open_far=True, lg="lunge", ldx=2),
             front=[W("football", at="near", off=(4, -3), ang=-10)], fx=[X("speed", x0=4, x1=34, ys=[60, 80, 100])], dx=4, hand_hit="far"),
          Fr(K(torso=(78, 106), lean=22, head=-6, nh=(86, 84), fh=(128, 70), open_far=True, lg="lunge", ldx=4),
             front=[W("football", at="near", off=(4, -3), ang=-10)], fx=[X("lines", c=(140, 66), r0=6, r1=14, angs=(-50, -10, 30))], dx=8, hand_hit="far"),
          Fr(K(torso=(68, 104), lean=6, nh=(82, 90), fh=(100, 72)), front=[W("football", at="near", off=(4, -6), ang=-30)], dx=4)]
    sp = [Fr(K(torso=(62, 105), lean=-6, head=-2, nh=(56, 50), fh=(100, 64), open_far=True, lg="back"), front=[W("football", at="near", off=(-2, -4), ang=-20)]),
          Fr(K(torso=(60, 106), lean=-10, head=-4, nh=(46, 50), fh=(104, 60), open_far=True, lg="stride", ldx=-6), back=[W("football", at="near", off=(-4, -4), ang=-30)]),
          Fr(K(torso=(70, 104), lean=8, head=-4, nh=(98, 50), fh=(84, 94), nb=-1, lg="stride"),
             front=[W("football", c=(116, 48), ang=-8, hit=True)], mid=[X("swoosh", c=(72, 80), r=40, a0=-150, a1=-50, width=7)]),
          Fr(K(torso=(74, 106), lean=16, head=-2, nh=(100, 96), fh=(82, 98), lg="stride", ldx=2), regrip=False,
             fx=[X("spiral", c=(146, 52), ang=-4, k=0), W("football", at=None, c=(146, 52), ang=-4, hit=True)]),
          Fr(K(torso=(74, 106), lean=16, head=-2, nh=(98, 104), fh=(82, 100), lg="stride", ldx=2), regrip=False,
             fx=[X("spiral", c=(166, 54), ang=-2, k=1), W("football", at=None, c=(166, 54), ang=-2, hit=True)]),
          Fr(K(torso=(72, 105), lean=10, head=-4, nh=(94, 100), fh=(84, 96), lg="stride"), regrip=False,
             fx=[X("speed", x0=140, x1=162, ys=[50, 58])]),
          Fr(K(torso=(68, 104), lean=4, head=-6, nh=(82, 92), fh=(100, 70)), regrip=False),
          Fr(K(torso=(66, 103), lean=4, nh=(82, 90), fh=(100, 70)), front=[W("football", at="near", off=(4, -6), ang=-30)])]
    return idle, c3, [1, 2], sp, [3, 4]

def kit_mechanic():
    idle = []
    for k in range(6):
        dy, r = bob(k)
        tap = k in (2, 3)
        P = K(torso=(66, 103 + dy), lean=4, head=1.5 * r + 2, nh=(80, 92 + dy - (4 if tap else 0)), fh=(104, 104 + dy), fb=1, open_far=True,
              near_knee=(55, 142 + dy * 0.6), far_knee=(86, 141 + dy * 0.6))
        idle.append(Fr(P, front=[W("wrench", ang=40 if not tap else 26)]))
    c3 = [Fr(K(torso=(62, 104), lean=-4, head=-2, nh=(66, 52), fh=(96, 74), nb=-1, lg="back"), back=[W("wrench", ang=-110)]),
          Fr(K(torso=(70, 104), lean=10, nh=(100, 66), fh=(94, 82), nb=-1), front=[W("wrench", ang=-20, hit=True)],
             mid=[X("swoosh", c=(78, 80), r=48, a0=-120, a1=-20, width=8)]),
          Fr(K(torso=(74, 108), lean=18, head=4, nh=(104, 100), fh=(94, 96), lg="lunge"), front=[W("wrench", ang=50, hit=True)],
             mid=[X("swoosh", c=(80, 88), r=50, a0=-40, a1=60, width=9)]),
          Fr(K(torso=(67, 104), lean=4, nh=(80, 92), fh=(104, 104), open_far=True), front=[W("wrench", ang=40)])]
    two = lambda gp, ang, d=6: (gp[0] + d * math.cos(math.radians(ang)), gp[1] + d * math.sin(math.radians(ang)))
    sp = [Fr(K(torso=(66, 108), lean=4, head=2, nh=(80, 90), fh=two((80, 90), -60), lg="crouch"), front=[W("wrench", ang=-60)]),
          Fr(K(torso=(66, 100), lean=-6, head=-8, nh=(70, 26), fh=two((70, 26), -100), nb=-1, fb=-1, lg="tiptoe"), front=[W("wrench", ang=-100)]),
          Fr(K(torso=(64, 100), lean=-12, head=-10, nh=(62, 26), fh=two((62, 26), -150), nb=-1, fb=-1, lg="tiptoe", ldx=-2), back=[W("wrench", ang=-150)], regrip=False),
          Fr(K(torso=(74, 116), lean=26, head=8, nh=(104, 118), fh=two((104, 118), 62), lg="wide", ldx=2), front=[W("wrench", ang=62, hit=True)],
             mid=[X("swoosh", c=(78, 90), r=54, a0=-110, a1=55, width=12)],
             fx=[X("crack", c=(124, 185), k=0, hit=True), X("pow", c=(124, 170), r=9, hit=True)]),
          Fr(K(torso=(74, 116), lean=26, head=8, nh=(104, 118), fh=two((104, 118), 62), lg="wide", ldx=2), front=[W("wrench", ang=62, hit=True)],
             fx=[X("crack", c=(124, 185), k=2, hit=True), X("lines", c=(124, 176), r0=18, r1=30, angs=(-170, -140, -110, -70, -40, -10)), X("dust", c=(124, 186), k=1, spread=1.6)]),
          Fr(K(torso=(72, 112), lean=16, head=4, nh=(100, 104), fh=two((100, 104), 30), lg="wide", ldx=2), front=[W("wrench", ang=30)],
             fx=[X("dust", c=(126, 186), k=0, spread=2.0)]),
          Fr(K(torso=(68, 106), lean=6, nh=(84, 92), fh=(98, 92)), front=[W("wrench", ang=10)]),
          Fr(K(torso=(66, 103), lean=4, nh=(80, 92), fh=(104, 104), open_far=True), front=[W("wrench", ang=40)])]
    return idle, c3, [1, 2], sp, [3, 4]

def kit_diner():
    idle = []
    for k in range(6):
        dy, r = bob(k)
        P = K(torso=(66, 103 + dy), lean=4, head=1.5 * r + 3, nh=(80, 96 + dy), fh=(100, 72 + dy),
              near_knee=(55, 142 + dy * 0.6), far_knee=(86, 141 + dy * 0.6))
        fx = [X("splash", c=(104, 88 + dy), k=0.0, dirx=0.4)] if k in (2, 3) else []
        idle.append(Fr(P, front=[W("pan", ang=-6 + (4 if k in (2, 3) else 0), face=0)], fx=fx))
    c3 = [Fr(K(torso=(64, 110), lean=8, head=2, nh=(52, 122), fh=(96, 80), lg="crouch"), back=[W("pan", ang=150, face=0.6)]),
          Fr(K(torso=(68, 104), lean=4, nh=(96, 98), fh=(96, 80)), front=[W("pan", ang=-30, face=0.8, hit=True)],
             mid=[X("swoosh", c=(74, 92), r=44, a0=140, a1=10, width=8)]),
          Fr(K(torso=(70, 100), lean=-6, head=-6, nh=(96, 64), fh=(88, 84), lg="tiptoe"), front=[W("pan", ang=-80, face=1.0, hit=True)],
             fx=[X("lines", c=(108, 26), r0=10, r1=18, angs=(-150, -110, -70, -30))]),
          Fr(K(torso=(67, 104), lean=4, nh=(80, 96), fh=(100, 72)), front=[W("pan", ang=-6, face=0)])]
    sp = [Fr(K(torso=(62, 104), lean=-8, head=-2, nh=(46, 66), fh=(96, 76), lg="back"), back=[W("pan", ang=-150, face=0.7)]),
          Fr(K(torso=(66, 104), lean=0, nh=(78, 70), fh=(96, 80), lg="stride", ldx=-4), front=[W("pan", ang=-60, face=0.5)],
             mid=[X("swoosh", c=(70, 76), r=34, a0=200, a1=270, width=6)]),
          Fr(K(torso=(72, 104), lean=10, head=-2, nh=(100, 70), fh=(94, 84), lg="stride"), front=[W("pan", ang=-10, face=1.0, hit=True)],
             mid=[X("swoosh", c=(78, 76), r=48, a0=-150, a1=-10, width=10, sq=0.7)],
             fx=[X("lines", c=(126, 66), r0=14, r1=22, angs=(-80, -40, 0, 40, 80)), X("splash", c=(130, 60), k=0.2, hit=True)]),
          Fr(K(torso=(74, 104), lean=12, head=-2, nh=(102, 72), fh=(94, 84), lg="stride"), front=[W("pan", ang=-4, face=1.0, hit=True)],
             fx=[X("pow", c=(140, 70), r=8, col=(255, 200, 80)), X("splash", c=(136, 62), k=1.0, hit=True)]),
          Fr(K(torso=(72, 104), lean=8, head=0, nh=(96, 90), fh=(92, 86), lg="stride"), front=[W("pan", ang=40, face=0.6)],
             fx=[X("splash", c=(142, 66), k=1.8)]),
          Fr(K(torso=(68, 104), lean=4, nh=(84, 98), fh=(98, 78), lg="stride", ldx=-2), front=[W("pan", ang=20, face=0)]),
          Fr(K(torso=(67, 104), lean=4, nh=(80, 96), fh=(100, 72)), front=[W("pan", ang=0, face=0)]),
          Fr(K(torso=(66, 103), lean=4, nh=(80, 96), fh=(100, 72)), front=[W("pan", ang=-6, face=0)])]
    return idle, c3, [1, 2], sp, [2, 3]

def circ(c, r, a0, n=8, step=40, sq=1.0):
    return [(c[0] + r * math.cos(math.radians(a0 + step * i)), c[1] + r * sq * math.sin(math.radians(a0 + step * i))) for i in range(1, n + 1)]

def kit_gold():
    idle = []
    for k in range(6):
        dy, r = bob(k)
        P = K(torso=(66, 103 + dy), lean=4, head=1.5 * r, nh=(96, 108 + dy), fh=(100, 70 + dy),
              near_knee=(55, 142 + dy * 0.6), far_knee=(86, 141 + dy * 0.6))
        idle.append(Fr(P, front=[W("goldchain", tailf=("hang", 22 * r, 5, 6.4))]))
    c3 = [Fr(K(torso=(64, 111), lean=12, head=4, nh=(70, 106), fh=(96, 72), lg="crouch"), front=[W("goldchain", tailf=("hang", 20, 3, 6.4)), W("wrap", ang=-30)]),
          Fr(K(torso=(68, 104), lean=2, head=-2, nh=(92, 54), fh=(94, 80), nb=1), front=[W("goldchain", tailf=("hang", -60, 3, 6.4)), W("wrap", ang=-70, hit=True)],
             mid=[X("swoosh", c=(80, 76), r=30, a0=150, a1=290, width=7, col=(255, 226, 120))]),
          Fr(K(torso=(70, 99), lean=-6, head=-8, nh=(90, 30), fh=(90, 82), nb=1, lg="tiptoe"), front=[W("goldchain", tailf=("hang", -150, 3, 6.4)), W("wrap", ang=-85, hit=True)],
             fx=[X("sparkle", c=(104, 14), r=6), X("sparkle", c=(80, 18), r=4)]),
          Fr(K(torso=(67, 104), lean=4, nh=(96, 108), fh=(100, 70)), front=[W("goldchain", tailf=("hang", 10, 5, 6.4))])]
    GC = (255, 222, 110)
    sp = [Fr(K(torso=(66, 104), lean=0, head=-4, nh=(70, 28), fh=(98, 74), nb=-1, lg="stance"),
             front=[W("goldchain", tail=circ((70, 22), 16, 90, 7, 40, 0.35)[:6])], fx=[X("sparkle", c=(98, 18), r=4)]),
          Fr(K(torso=(66, 104), lean=-2, head=-6, nh=(70, 26), fh=(98, 74), nb=-1, lg="stance"),
             front=[W("goldchain", tail=circ((70, 22), 26, 200, 6, 30, 0.35))],
             mid=[X("swoosh", c=(70, 22), r=34, a0=-20, a1=200, width=6, sq=0.35, col=GC)]),
          Fr(K(torso=(68, 104), lean=4, head=-4, nh=(76, 30), fh=(98, 74), nb=-1, lg="stride", ldx=-2),
             front=[W("goldchain", tail=circ((76, 26), 34, 120, 6, 40, 0.35))],
             mid=[X("swoosh", c=(76, 26), r=42, a0=60, a1=330, width=8, sq=0.35, col=GC)]),
          Fr(K(torso=(72, 104), lean=10, head=-2, nh=(96, 46), fh=(98, 80), nb=-1, lg="stride"),
             front=[W("goldchain", tailf=("line", (166, 44), 6, 0, 11), hit=True)],
             mid=[X("swoosh", c=(84, 40), r=60, a0=200, a1=360, width=9, sq=0.35, col=GC)],
             fx=[X("pow", c=(168, 44), r=10, col=(255, 210, 70), hit=True)]),
          Fr(K(torso=(70, 106), lean=4, head=-2, nh=(84, 70), fh=(98, 82), lg="stride"),
             front=[W("goldchain", tail=circ((84, 74), 30, -60, 7, 45, 0.6))],
             mid=[X("swoosh", c=(84, 80), r=42, a0=-90, a1=200, width=8, sq=0.6, col=GC)]),
          Fr(K(torso=(74, 110), lean=14, head=2, nh=(100, 104), fh=(96, 92), lg="lunge"),
             front=[W("goldchain", tailf=("line", (168, 126), -6, 0, 11), hit=True)],
             mid=[X("swoosh", c=(86, 110), r=60, a0=180, a1=370, width=9, sq=0.4, col=GC)],
             fx=[X("pow", c=(170, 126), r=12, col=(255, 210, 70), hit=True)]),
          Fr(K(torso=(70, 106), lean=6, nh=(88, 92), fh=(98, 78)), front=[W("goldchain", tailf=("hang", -20, 5, 6.0))]),
          Fr(K(torso=(66, 103), lean=4, nh=(96, 108), fh=(100, 70)), front=[W("goldchain", tailf=("hang", 0, 5, 6.4))])]
    return idle, c3, [1, 2], sp, [3, 5]

def kit_webslinger():
    idle = []
    for k in range(6):
        dy, r = bob(k)
        a = math.radians(60 * k)
        P = K(torso=(66, 103 + dy), lean=4, head=1.5 * r, nh=(84, 92 + dy), fh=(100, 74 + dy),
              near_knee=(55, 142 + dy * 0.6), far_knee=(86, 141 + dy * 0.6))
        idle.append(Fr(P, front=[W("starline", wrel=(10 * math.cos(a) + 2, 12 + 8 * math.sin(a)), spin=30 * k, coil="far")]))
    c3 = [Fr(K(torso=(62, 106), lean=-4, nh=(58, 112), fh=(98, 74), lg="back"), front=[W("starline", wrel=(-6, 14), coil="far")]),
          Fr(K(torso=(68, 104), lean=6, nh=(94, 90), fh=(98, 76)), front=[W("starline", wrel=(22, -6), spin=20, hit=True, coil="far")],
             mid=[X("swoosh", c=(96, 70), r=26, a0=110, a1=0, width=7)]),
          Fr(K(torso=(70, 100), lean=-2, head=-6, nh=(96, 80), fh=(96, 76), lg="tiptoe"),
             front=[W("starline", wrel=(10, -28), spin=50, hit=True, coil="far")],
             mid=[X("swoosh", c=(100, 66), r=26, a0=40, a1=-80, width=8)]),
          Fr(K(torso=(67, 104), lean=4, nh=(84, 92), fh=(100, 74)), front=[W("starline", wrel=(2, 12), coil="far")])]
    sp = [Fr(K(torso=(62, 105), lean=-8, head=-2, nh=(50, 52), fh=(98, 78), lg="back"), front=[W("starline", wrel=(-2, -4), coil="far")]),
          Fr(K(torso=(70, 104), lean=8, head=-2, nh=(100, 64), fh=(94, 84), lg="stride"),
             front=[W("starline", weight=(122, 60), spin=30, coil="far")], mid=[X("swoosh", c=(70, 76), r=36, a0=-150, a1=-30, width=7)]),
          Fr(K(torso=(72, 104), lean=10, head=-2, nh=(104, 70), fh=(94, 86), lg="stride"),
             front=[W("starline", weight=(150, 66), spin=80, coil="far", hit=True)], fx=[X("speed", x0=114, x1=138, ys=[60, 72])]),
          Fr(K(torso=(72, 104), lean=10, head=-2, nh=(104, 72), fh=(94, 86), lg="stride"),
             front=[W("starline", weight=(170, 70), spin=120, coil="far", hit=True)],
             fx=[X("pow", c=(170, 70), r=7, col=(255, 214, 90)), X("lines", c=(170, 70), r0=11, r1=15, angs=(-50, -10, 30, 70))]),
          Fr(K(torso=(62, 106), lean=-12, head=-6, nh=(74, 86), fh=(70, 92), lg="back"),
             front=[W("starline", weight=(158, 76), spin=150, slack=-2, coil="far", hit=True)],
             fx=[X("lines", c=(90, 84), r0=4, r1=12, angs=(150, 180, 210)), X("speed", x0=164, x1=170, ys=[68, 84])]),
          Fr(K(torso=(64, 105), lean=-6, head=-2, nh=(78, 88), fh=(86, 92), lg="back"),
             front=[W("starline", weight=(126, 82), spin=200, slack=8, coil="far")]),
          Fr(K(torso=(66, 104), lean=2, nh=(84, 88), fh=(98, 78)), front=[W("starline", wrel=(4, -2), spin=240, coil="far")]),
          Fr(K(torso=(66, 103), lean=4, nh=(84, 92), fh=(100, 74)), front=[W("starline", wrel=(2, 12), coil="far")])]
    return idle, c3, [1, 2], sp, [3, 4]

def kit_beacon():
    idle = []
    for k in range(6):
        dy, r = bob(k)
        P = K(torso=(66, 103 + dy), lean=4, head=1.5 * r, nh=(78, 86 + dy), fh=(100, 70 + dy),
              near_knee=(55, 142 + dy * 0.6), far_knee=(86, 141 + dy * 0.6))
        idle.append(Fr(P, fx=[W("shard", at="near", off=(2, -14 - 2 * abs(r)), r=4.4, spin=24 * k)], regrip=False))
    c3 = [Fr(K(torso=(63, 106), lean=-2, head=2, nh=(66, 92), fh=(96, 74), lg="back"), fx=[W("shard", at="near", off=(4, -8), r=4.6, spin=0)], regrip=False),
          Fr(K(torso=(72, 105), lean=10, head=-2, nh=(112, 72), fh=(90, 84), lg="lunge", ring_flare=True), regrip=False,
             fx=[W("shard", at="near", off=(12, -2), r=7.5, spin=20, hit=True), X("speed", x0=78, x1=100, ys=[66, 76], col=(150, 255, 170))]),
          Fr(K(torso=(72, 105), lean=10, head=-2, nh=(112, 72), fh=(90, 84), lg="lunge"), regrip=False,
             fx=[X("shard", c=(142, 68), r=7, spin=50, hit=True), X("speed", x0=104, x1=128, ys=[64, 72], col=(150, 255, 170))]),
          Fr(K(torso=(67, 104), lean=4, nh=(78, 86), fh=(100, 70)), fx=[W("shard", at="near", off=(2, -14), r=4.4, spin=0)], regrip=False)]
    palms = dict(open_near=True, open_far=True)
    sp = [Fr(K(torso=(64, 106), lean=-2, head=0, nh=(80, 82), fh=(88, 84), **palms), fx=[X("shard", c=(92, 76), r=4, spin=0)], regrip=False),
          Fr(K(torso=(62, 107), lean=-6, head=-2, nh=(72, 78), fh=(84, 80), lg="back", ring_flare=True, **palms), regrip=False,
             fx=[X("shard", c=(84, 72), r=7, spin=18), X("sparkle", c=(72, 56), r=4, col=(170, 255, 190)), X("sparkle", c=(98, 60), r=4, col=(170, 255, 190))]),
          Fr(K(torso=(72, 106), lean=10, head=-2, nh=(108, 74), fh=(112, 82), lg="stride", ring_flare=True, **palms), regrip=False,
             fx=[X("greenburst", c=(132, 76), r=15, spin=0, hit=True), X("shard", c=(150, 64), r=4.5, spin=20, hit=True)]),
          Fr(K(torso=(72, 106), lean=10, head=-2, nh=(108, 74), fh=(112, 82), lg="stride", ring_flare=True, **palms), regrip=False,
             fx=[X("greenburst", c=(138, 76), r=21, spin=12, hit=True), X("shard", c=(172, 56), r=5, spin=40, hit=True),
                 X("shard", c=(170, 98), r=4.5, spin=10, hit=True), X("shard", c=(176, 76), r=4, spin=70, hit=True)]),
          Fr(K(torso=(72, 106), lean=10, head=-2, nh=(106, 76), fh=(110, 84), lg="stride", **palms), regrip=False,
             fx=[X("greenburst", c=(140, 76), r=10, spin=30), X("shard", c=(182, 50), r=3.6, spin=60), X("shard", c=(180, 104), r=3.4, spin=20)]),
          Fr(K(torso=(70, 105), lean=6, nh=(96, 82), fh=(104, 84), lg="stride", **palms), regrip=False, fx=[X("sparkle", c=(140, 70), r=4, col=(170, 255, 190))]),
          Fr(K(torso=(67, 104), lean=4, nh=(82, 86), fh=(100, 72)), regrip=False),
          Fr(K(torso=(66, 103), lean=4, nh=(78, 86), fh=(100, 70)), fx=[W("shard", at="near", off=(2, -14), r=4.4, spin=0)], regrip=False)]
    return idle, c3, [1, 2], sp, [2, 3]

def kit_ironclad():
    idle = []
    for k in range(6):
        dy, r = bob(k)
        bump = k in (2, 3)
        P = K(torso=(66, 104 + dy), lean=6, head=1.5 * r, nh=(84 if bump else 78, 94 + dy), fh=(96 if bump else 102, 90 + dy), lg="wide", ldx=-2,
              near_knee=(48, 146 + dy * 0.6), far_knee=(96, 145 + dy * 0.6))
        fx = [X("sparkle", c=(92, 84 + dy), r=3.4, col=(255, 196, 80))] if k == 2 else []
        idle.append(Fr(P, fx=fx, regrip=False))
    c3 = [Fr(K(torso=(64, 108), lean=-2, head=2, nh=(60, 100), fh=(80, 96), lg="wide", ldx=-2), regrip=False),
          Fr(K(torso=(72, 106), lean=12, head=-2, nh=(110, 76), fh=(86, 92), lg="wide"), regrip=False,
             fx=[X("ring", c=(120, 74), rx=3.5, ry=11, w=1.6, hit=True)]),
          Fr(K(torso=(72, 106), lean=12, head=-2, nh=(110, 76), fh=(86, 92), lg="wide"), regrip=False,
             fx=[X("ring", c=(128, 74), rx=5, ry=16, w=1.6, sparks=(0,), hit=True)]),
          Fr(K(torso=(67, 106), lean=6, nh=(78, 94), fh=(102, 90), lg="wide", ldx=-2), regrip=False)]
    palms = dict(open_near=True, open_far=True, lg="wide")
    sp = [Fr(K(torso=(64, 110), lean=0, head=2, nh=(72, 86), fh=(86, 88), **palms), regrip=False),
          Fr(K(torso=(62, 111), lean=-4, head=2, nh=(66, 82), fh=(80, 84), **palms), regrip=False, fx=[X("sparkle", c=(86, 80), r=3.6, col=(255, 196, 80))]),
          Fr(K(torso=(70, 110), lean=10, head=-2, nh=(106, 76), fh=(110, 86), **palms), regrip=False,
             fx=[X("ring", c=(118, 80), rx=4.5, ry=16, w=2.0, hit=True), X("lines", c=(118, 80), r0=20, r1=26, angs=(-30, 0, 30))]),
          Fr(K(torso=(70, 110), lean=10, head=-2, nh=(108, 76), fh=(112, 86), **palms), regrip=False,
             fx=[X("ring", c=(138, 80), rx=8, ry=30, w=2.4, sparks=(-60,), hit=True), X("ring", c=(124, 80), rx=4, ry=16, w=1.4), X("dust", c=(112, 186), k=0)]),
          Fr(K(torso=(70, 110), lean=10, head=-2, nh=(108, 76), fh=(112, 86), **palms), regrip=False,
             fx=[X("ring", c=(160, 80), rx=9, ry=38, w=1.8, sparks=(40,), hit=True), X("ring", c=(140, 80), rx=6, ry=24, w=1.2), X("dust", c=(118, 186), k=1, spread=1.4)]),
          Fr(K(torso=(70, 110), lean=8, head=0, nh=(104, 78), fh=(108, 88), **palms), regrip=False,
             fx=[X("ring", c=(176, 80), rx=6, ry=34, w=1.0)]),
          Fr(K(torso=(67, 108), lean=6, nh=(84, 92), fh=(100, 90), lg="wide", ldx=-2), regrip=False),
          Fr(K(torso=(66, 104), lean=6, nh=(78, 94), fh=(102, 90), lg="wide", ldx=-2), regrip=False)]
    return idle, c3, [1, 2], sp, [3, 4]

KITS = {o: globals()["kit_" + o] for o in OUTFITS}

def states_for(outfit):
    idle, c3, a3, sp, asp = KITS[outfit]()
    return {"idle_signature": dict(frames=idle, fps=8, loop=True, active=set()),
            "combo3": dict(frames=c3, fps=12, loop=False, active=set(a3)),
            "special": dict(frames=sp, fps=12, loop=False, active=set(asp))}

# ---------------------------------------------------------------- render
def resolve(P, it):
    k = it["kind"]; at = it.get("at"); kw = {kk: v for kk, v in it.items() if kk not in ("kind", "at", "hit", "off", "tail", "tailf", "wrel", "layer")}
    if at == "strap":                                  # camera swinging on its strap from the near hand
        gp = grip(P, "near"); c = add(gp, it["off"])
        kw["neck"] = gp; kw["f"] = c
        return k, kw
    gp = grip(P, at) if at in ("near", "far") else None
    if k in ("book", "camera", "bat", "wrench", "pan", "wrap"):
        kw["f"] = gp if gp else kw.pop("c")
        if k == "camera" and kw.get("neck") is True: kw["neck"] = neck(P)
        if k == "wrap": kw["fist"] = kw.pop("f")
    elif k in ("board", "football", "shard"):
        if "c" not in kw: kw["c"] = add(gp, it.get("off", (0, 0)))
    elif k in ("bikechain", "goldchain"):
        if "tail" in it: tail = it["tail"]
        else:
            t = it["tailf"]
            if t[0] == "hang": tail = ga_hang(gp, t[1], t[2], t[3])
            elif t[0] == "arc": tail = kd.qcurve(gp, t[1], t[2], n=t[3])[1:]
            else: tail = chain_line(gp, t[1], t[2], t[3], t[4])
        kw["path"] = [gp] + list(tail)
    elif k == "starline":
        kw["hand"] = gp
        if "wrel" in it: kw["weight"] = add(gp, it["wrel"])
        if kw.get("coil") == "far": kw["coil"] = add(grip(P, "far"), (0, 6))
    return k, kw

def ga_hang(gp, sway, n, L): return chain_hang(gp, sway, n, L)

WSCALE = dict(book=1.4, camera=1.3, board=1.1, bat=1.1, football=1.35, wrench=1.2, pan=1.2)
class ScaleCV:
    """Draw-through proxy: scales a weapon about its grip/centre (and makes Part.dot honour the pad offset)."""
    def __init__(self, cv, c, s): self.cv, self.c, self.s = cv, c, s; self.xf = (s, s, 0, 0); self.w, self.h = cv.w, cv.h
    @property
    def img(self): return self.cv.img
    def P(self, x, y): return self.cv.P(self.c[0] + (x - self.c[0]) * self.s, self.c[1] + (y - self.c[1]) * self.s)
    def mask(self, polys):
        from PIL import ImageDraw
        m = Image.new("L", self.cv.img.size, 0); d = ImageDraw.Draw(m)
        for p in polys: d.polygon([self.P(x, y) for x, y in p], fill=255)
        return m
def draw_items(cv, P, items, hits, shift):
    for it in items:
        k, kw = resolve(P, it)
        s = it.get("s", WSCALE.get(k, 1.0)); c = kw.get("f") or kw.get("c") or kw.get("fist") or (0, 0)
        pts = kd.DRAW[k](ScaleCV(cv, c, s), **kw) or []
        pts = [(c[0] + (x - c[0]) * s, c[1] + (y - c[1]) * s) for x, y in pts]
        if it.get("hit"): hits.extend([(x + shift, y) for x, y in pts])

def render_kit(outfit, spec):
    key = "matthew_" + outfit
    ga.setup(key)
    P = spec["P"]; PX, PY = 80, 100
    cv = ga.PadCanvas(FW + 2 * PX, FH + 2 * PY, None, PX, PY)
    hits = []; dx = spec.get("dx", 0)
    draw_items(cv, P, spec["back"], hits, dx)
    render_figure(cv, P)
    draw_items(cv, P, spec["mid"], hits, dx)
    draw_items(cv, P, spec["front"], hits, dx)
    if spec["regrip"] and (spec["front"]):
        g.draw_fist(cv, TLp(P, P["near_el"]), TLp(P, P["near_fist"]), g.PAL["skin"], P.get("open_near", False))
        if g.STYLE.get("ring"): g.draw_ring(cv, TLp(P, P["near_fist"]), flare=P.get("ring_flare", False))
    if dx:
        im = cv.img; out = Image.new("RGBA", im.size, (0, 0, 0, 0)); out.paste(im, (int(dx * g.S), 0)); cv.img = out
    draw_items(cv, P, spec["fx"], hits, 0)
    big = finish(cv)
    bb = big.getchannel("A").getbbox()
    wx = PX; wy = (bb[3] - 1 - FEET) + int(spec.get("lift", 0))
    l = min(wx, bb[0] - 1); r_ = max(wx + FW, bb[2] + 1); t = min(wy, bb[1] - 1)
    out = big.crop((l, t, r_, wy + FH))
    return out, PX - wx, PY - wy, (wx - l, r_ - wx - FW, wy - t), hits

import hashlib, pickle
CACHE = os.environ.get("KITS_CACHE")          # optional render cache dir; off by default
if CACHE: os.makedirs(CACHE, exist_ok=True)
_SRC = open(os.path.join(HERE, "kit_draw.py")).read() + repr(WSCALE) + "v3"
def job(args):
    outfit, state, idx = args
    stt = states_for(outfit)[state]; spec = stt["frames"][idx]
    key = hashlib.md5((_SRC + outfit + state + str(idx) + repr(sorted(stt["active"])) + repr(spec)).encode()).hexdigest()
    cp = os.path.join(CACHE, key + ".pkl") if CACHE else None
    if cp and os.path.exists(cp): return pickle.load(open(cp, "rb"))
    r = job_(outfit, state, idx, stt, spec)
    if cp: pickle.dump(r, open(cp, "wb"))
    return r
def job_(outfit, state, idx, stt, spec):
    im, sx, sy, extra, hits = render_kit(outfit, spec)
    hb = None
    if idx in stt["active"]:
        if not hits:                                  # bare-hand hit (e.g. varsity stiff-arm): box round that hand
            gp = grip(spec["P"], spec.get("hand_hit", "near")); d = spec.get("dx", 0)
            hits = [(gp[0] + d - 12, gp[1] - 12), (gp[0] + d + 12, gp[1] + 12)]
        xs = [p[0] for p in hits]; ys = [p[1] for p in hits]
        x0, x1, y0, y1 = min(xs) - 2, max(xs) + 2, min(ys) - 2, max(ys) + 2
        if x1 - x0 < 20: c = (x0 + x1) / 2; x0, x1 = c - 10, c + 10
        if y1 - y0 < 20: c = (y0 + y1) / 2; y0, y1 = c - 10, c + 10
        hb = dict(x=int(round(x0 + sx)), y=int(round(y0 + sy)), w=int(round(x1 - x0)), h=int(round(y1 - y0)))
    buf = io.BytesIO(); im.save(buf, "PNG")
    return outfit, state, idx, buf.getvalue(), dict(grounded=spec.get("grounded", True), lying=False, active=idx in stt["active"], hitbox=hb, extra=extra)

FORCE_WIDE = {"special"}
def build(outfits, jobs=6, out_dir=None):
    out_spr = os.path.join(out_dir, "assets", "sprites") if out_dir else OUT_SPR
    os.makedirs(out_spr, exist_ok=True)
    t0 = time.time(); tasks = []; plan = {}
    for o in outfits:
        sts = states_for(o); plan[o] = [(s, len(v["frames"]), v["fps"], v["loop"]) for s, v in sts.items()]
        tasks += [(o, s, i) for s, v in sts.items() for i in range(len(v["frames"]))]
    with Pool(jobs) as pool: res = pool.map(job, tasks, chunksize=1)
    frames = {(o, s, i): (Image.open(io.BytesIO(b)).convert("RGBA"), m) for o, s, i, b, m in res}
    man = dict(version=1, frameW=FW, frameH=FH, feetRow=FEET, kitRev=KIT_REV, characters={})
    for o in outfits:
        lay = []; cn = cw = 0; Hn = Hw = FH
        for s, cnt, fps, loop in plan[o]:
            ex = [frames[(o, s, i)][1]["extra"] for i in range(cnt)]
            L = max(e[0] for e in ex); R = max(e[1] for e in ex); T = max(e[2] for e in ex)
            wide = bool(L or R) or s in FORCE_WIDE
            if wide:
                if max(L, R) > (WW - FW) // 2: print("!! TOO WIDE", o, s, L, R, [e[:2] for e in ex]); L = R = 0
                L = (WW - FW) // 2; fw = WW; start = cw; cw += cnt; Hw = max(Hw, FH + T)
            else:
                fw = FW; start = cn; cn += cnt; Hn = max(Hn, FH + T)
            lay.append((s, cnt, fps, loop, wide, start, fw, FH + T, L, T))
        fname = "assets/sprites/matthew_%s_kit.png" % o; wname = "assets/sprites/matthew_%s_kit_wide.png" % o
        strips = {False: Image.new("RGBA", (max(1, cn) * FW, Hn), (0, 0, 0, 0)), True: Image.new("RGBA", (max(1, cw) * WW, Hw), (0, 0, 0, 0))}
        entry = dict(kit=dict(weapon=KIT[o][0], move=KIT[o][1]), file=fname, states={})
        if cw: entry["wideFile"] = wname
        for s, cnt, fps, loop, wide, start, fw, fh, L, T in lay:
            ms = []
            H = Hw if wide else Hn
            for i in range(cnt):
                im, m = frames[(o, s, i)]; eL, _, eT = m["extra"]
                strips[wide].paste(im, ((start + i) * fw + L - eL, T - eT)); ms.append(m)      # top-aligned, sy=0 (same as gen_anims)
            hb = [None if not m["hitbox"] else dict(m["hitbox"], x=m["hitbox"]["x"] + L, y=m["hitbox"]["y"] + T) for m in ms]
            entry["states"][s] = dict(file=wname if wide else fname, frames=list(range(start, start + cnt)), fps=fps, loop=loop,
                                      fw=fw, fh=fh, anchorX=fw // 2, wide=bool(wide),
                                      sx=[(start + i) * fw for i in range(cnt)], sw=[fw] * cnt, sy=[0] * cnt, sh=[fh] * cnt,
                                      grounded=[m["grounded"] for m in ms], lying=[m["lying"] for m in ms],
                                      active=[m["active"] for m in ms], hitbox=hb)
        strips[False].save(os.path.join(out_spr, "matthew_%s_kit.png" % o)) if cn else None
        if cw: strips[True].save(os.path.join(out_spr, "matthew_%s_kit_wide.png" % o))
        if not cn: entry.pop("file")
        man["characters"]["matthew_" + o] = entry
        print("kit", o, cn, "normal", cw, "wide")
    if out_dir: json.dump(man, open(os.path.join(out_dir, "kits_anims.json"), "w"), indent=1)
    else: merge_into_live(man)
    print("done %d frames in %.1fs" % (len(tasks), time.time() - t0))

KIT_STATES = ("idle_signature", "combo3", "special")
SPR_DIR = g.SPR
def apply_kit(manifest, kit_chars):
    """Merge kit states into an anims.json-shaped dict: only characters.matthew_<o>.states[KIT_STATES] + `kit` tag change."""
    chars = manifest.setdefault("characters", {})
    for key, ch in kit_chars.items():
        dst = chars.get(key)
        if dst is None: raise KeyError("%s missing from anims.json - run tools/gen_anims.py first" % key)
        for st in KIT_STATES:
            if st in ch["states"]: dst["states"][st] = ch["states"][st]
        if ch.get("kit"): dst["kit"] = ch["kit"]
    manifest["kitRev"] = KIT_REV
    return manifest

def merge_into_live(man):
    mp = os.path.join(SPR_DIR, "anims.json")
    live = json.load(open(mp))                     # re-read right before writing: never clobber someone else's edits
    apply_kit(live, man["characters"])
    json.dump(live, open(mp, "w"), indent=1)
    print("merged kit states into", mp, len(man["characters"]), "outfits")

def kit_states_from(manifest):
    """Kit states present in an anims.json dict (gen_anims.py uses this to keep them across its rebuilds)."""
    out = {}
    for key, ch in manifest.get("characters", {}).items():
        sts = {st: v for st, v in ch.get("states", {}).items() if st in KIT_STATES and "_kit" in (v.get("file") or "")}
        if sts: out[key] = dict(states=sts, kit=ch.get("kit"))
    return out

if __name__ == "__main__":
    a = sys.argv[1:]; outs = OUTFITS; jobs = 6; out_dir = None
    if "--only" in a: outs = a[a.index("--only") + 1].split(",")
    if "--jobs" in a: jobs = int(a[a.index("--jobs") + 1])
    if "--out" in a: out_dir = a[a.index("--out") + 1]
    build(outs, jobs, out_dir)
