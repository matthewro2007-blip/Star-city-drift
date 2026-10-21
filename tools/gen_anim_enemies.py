#!/usr/bin/env python3
"""Star City Drift 2D - ENEMY animation strips (silas_boss, thug_<colour>, snatcher).

Writes assets/sprites/<key>_anim.png (+ snatcher.png still) and assets/sprites/anims_enemies.json
(same schema as anims.json, see ASSETS.md 'Animation manifest'). Reuses the shared rig:
gen_matthew_v2 (pose/render), gen_cast (heads/outfits/props) and gen_anims (render_spec/job helpers).
Never touches anims.json or any existing sheet.   usage: python3 tools/gen_anim_enemies.py [--jobs N]
"""
import io, json, math, os, sys, time
from multiprocessing import Pool
from PIL import Image
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import gen_matthew_v2 as g
import gen_cast as gc
import gen_anims as ga
from gen_matthew_v2 import C, Part, add, rot, taper, ellipse_pts, ramp, pose, POSES, FW, FH
from gen_anims import F, S, HURT, SIT, lying, ko_frames, knockdown, guard_bob, run_cycle

SPR = g.SPR; FEET = 189
THUG_KEYS = ga.THUG_KEYS
KEYS = ["silas_boss"] + THUG_KEYS + ["snatcher"]

# ------------------------------------------------ extra hand props (cane, chain); others delegate to gen_cast
_orig_prop = gc.draw_prop_at
def draw_prop_at(cv, kind, f, ang=0.0, k=0.0):
    if kind == "cane":
        b = Part(cv, [taper(add(f, rot((-6, 0), ang)), 1.6, add(f, rot((40, 0), ang)), 1.5)], ramp((40, 30, 26)),
                 shade=(1, 1), hi=(0.6, -0.6), rim=0.6, ink=0.7)
        b.line([add(f, rot((-4, -0.8), ang)), add(f, rot((38, -0.8), ang))], C(110, 84, 64), 0.5); b.commit()
        h = add(f, rot((-7, 0), ang))
        Part(cv, [ellipse_pts(h, 3.4, 3.4, n=12)], ramp((240, 192, 64)), shade=(1.2, 1), hi=(0.6, -0.6), rim=0, ink=0.7).commit()
        return
    if kind == "chain":
        # k = curl (0 straight .. 1 strongly curved trailing)
        n = 7
        for i in range(n):
            d = 5 + i * 5.2
            a = ang + k * 9 * i
            p = add(f, rot((d, 0), a))
            Part(cv, [ellipse_pts(p, 3.0 if i % 2 == 0 else 2.2, 2.2 if i % 2 == 0 else 3.0, n=10)], ramp((176, 180, 188)),
                 shade=(1, 1), hi=(0.6, -0.6), rim=0.6, ink=0.7).commit()
        return
    return _orig_prop(cv, kind, f, ang, k)
gc.draw_prop_at = draw_prop_at

def P_(**kw): return pose(**kw)
def rec(): return F(pose(torso=(68, 104), lean=4))

# ------------------------------------------------ silas boss
def silas_states():
    st = {}
    cane = lambda a: [("cane", "near", a, 0)]
    st["boss_attack1"] = S([
        F(P_(lean=-8, head=-4, near_sh=(-12, -42), near_el=(-20, -54), near_fist=(-16, -70), far_el=(22, -26), far_fist=(30, -34)), props=cane(-165)),
        F(P_(torso=(70, 104), lean=8, near_el=(4, -58), near_fist=(26, -66), far_el=(22, -26), far_fist=(30, -34)), props=cane(-40)),
        F(P_(torso=(74, 108), lean=20, head=6, near_el=(18, -38), near_fist=(40, -30), far_el=(24, -24), far_fist=(30, -28),
             near_knee=(54, 148), far_knee=(96, 146)), props=cane(20)),
        F(P_(torso=(70, 106), lean=12, near_el=(10, -22), near_fist=(24, -12)), props=cane(55)),
        F(P_(torso=(68, 104), lean=4, near_el=(-12, -22), near_fist=(-4, -10)), props=cane(80))], 10, False, [1, 2], ("box", 88, 46, 52, 70))
    lunge = dict(torso=(76, 106), lean=22, head=-6, near_sh=(-4, -42), near_el=(18, -38), near_fist=(42, -36), open_near=True,
                 far_sh=(14, -42), far_el=(30, -40), far_fist=(50, -40), open_far=True,
                 near_knee=(52, 148), near_ankle=(30, 172), near_foot=26, far_knee=(98, 142), far_ankle=(108, 174))
    st["boss_attack2"] = S([F(P_(torso=(60, 108), lean=-6, near_knee=(50, 146), far_knee=(84, 146), near_fist=(-6, -22), far_fist=(14, -24))),
                            F(P_(**lunge), fx_back=[("speed", (0, 40), [80, 100, 120])]),
                            F(P_(**lunge), dx=8, fx_back=[("speed", (0, 48), [76, 96, 116, 136])]),
                            F(P_(**{**lunge, "open_near": False, "open_far": False, "lean": 16}), dx=6),
                            F(P_(torso=(66, 104), lean=0, near_fist=(10, -34), far_fist=(20, -34)))], 10, False, [1, 2, 3], "far_fist")
    slam_up = dict(lean=-4, head=-6, near_sh=(-12, -42), near_el=(-14, -58), near_fist=(-4, -74), far_sh=(13, -42), far_el=(18, -58), far_fist=(10, -76),
                   near_knee=(62, 132), near_ankle=(52, 156), near_ground=False, far_knee=(90, 132), far_ankle=(90, 158), far_ground=False)
    slam = dict(torso=(64, 118), lean=20, head=8, near_el=(4, -26), near_fist=(26, 0), far_el=(18, -26), far_fist=(38, 2),
                near_knee=(50, 152), near_ankle=(36, 174), far_knee=(92, 150), far_ankle=(100, 174))
    st["boss_attack3"] = S([F(P_(torso=(64, 110), lean=6, near_knee=(52, 148), far_knee=(86, 147), near_el=(-12, -50), near_fist=(-2, -66),
                                 far_el=(20, -50), far_fist=(12, -68))),
                            F(P_(**slam_up), lift=12, grounded=False),
                            F(P_(**slam), fx=[("shock", (104, 182), 1)]), F(P_(**slam), fx=[("shock", (100, 182), 2)]),
                            F(P_(**{**slam, "lean": 12, "torso": (64, 112)}), fx=[("shock", (98, 182), 3)]),
                            F(P_())], 10, False, [2, 3], ("box", 70, 150, 74, 40))
    fr = []
    for k in range(4):
        fr.append(F(P_(lean=-4, head=-4 + (k % 2) * 3, expr="talk" if k % 2 == 0 else "calm",
                       far_el=(28, -26), far_fist=(38 - (k % 2) * 4, -34 - (k % 2) * 3), open_far=True,
                       near_el=(-14, -20), near_fist=(-8, -4)), props=[("cane", "near", 95, 0)]))
    st["taunt"] = S(fr, 6, True)
    kneel = dict(torso=(62, 130), lean=10, head=12, expr="hurt", near_knee=(64, 176), near_ankle=(38, 178), near_ground=False, near_foot=60,
                 far_knee=(94, 152), far_ankle=(98, 174), near_el=(-14, -20), near_fist=(-10, -2), open_near=True,
                 far_el=(20, -20), far_fist=(30, -6), open_far=True)
    st["defeat"] = S([F(dict(HURT)), F({**HURT, "lean": -10, "head": -6}, dx=-4), F(P_(**kneel)),
                      F(P_(**{**kneel, "head": 20, "lean": 16})),
                      F(P_(**{**SIT, "head": -12}), rot=60, pivot=(66, 150), center=True), lying(-10, 90)], 7, False)
    fall, ground, getup = knockdown()
    st["knockdown_fall"] = S(fall, 10, False); st["knockdown_ground"] = S(ground, 3, True); st["getup"] = S(getup, 8, False)
    return st

# ------------------------------------------------ thugs
def thug_states(key):
    if key == "thug_red":
        st = {}
        ch = lambda a, k: [("chain", "near", a, k)]
        A = [F(P_(lean=-6, near_el=(-24, -44), near_fist=(-28, -58)), props=ch(-150, 0.5)),
             F(P_(lean=0, near_el=(-8, -50), near_fist=(4, -62)), props=ch(-140, 0.5)),
             F(P_(torso=(72, 104), lean=12, near_sh=(-6, -42), near_el=(16, -44), near_fist=(38, -46),
                  near_knee=(54, 144), near_ankle=(40, 172), near_foot=20, far_knee=(92, 140), far_ankle=(100, 174)), props=ch(-8, 0.1)),
             F(P_(torso=(72, 106), lean=14, near_el=(18, -32), near_fist=(38, -22)), props=ch(50, 0.4)),
             F(P_(torso=(68, 104), lean=4, near_el=(-10, -20), near_fist=(0, -10)), props=ch(85, 0.2))]
        sc = dict(torso=(74, 106), lean=24, head=-6, near_sh=(-6, -42), near_el=(6, -26), near_fist=(14, -36),
                  far_sh=(14, -42), far_el=(12, -24), far_fist=(22, -30), near_knee=(50, 146), near_ankle=(30, 172), near_foot=26,
                  far_knee=(96, 140), far_ankle=(104, 174))
        B = [F(P_(torso=(62, 108), lean=-4, near_knee=(50, 146), far_knee=(84, 146))),
             F(P_(**sc), fx_back=[("speed", (0, 40), [80, 100, 120])]),
             F(P_(**sc), dx=8, fx_back=[("speed", (0, 46), [74, 94, 114, 134])]), rec()]
        st["attackA"] = S(A, 12, False, [2, 3], ("box", 92, 50, 50, 50))
        st["attackB"] = S(B, 12, False, [1, 2], ("box", 80, 50, 50, 70))
    elif key == "thug_teal":
        st = {}
        A = [F(P_(lean=-4, far_knee=(94, 136), far_ankle=(100, 160), far_ground=False, far_foot=-10)),
             F(P_(lean=-12, head=-4, far_knee=(104, 156), far_ankle=(128, 176), far_ground=False, far_foot=-30)),
             F(P_(lean=-12, head=-4, far_knee=(104, 156), far_ankle=(128, 176), far_ground=False, far_foot=-30), dx=3), rec()]
        j1 = dict(torso=(70, 104), lean=8, far_sh=(14, -42), far_el=(32, -40), far_fist=(52, -42), near_fist=(4, -30))
        j2 = dict(torso=(74, 105), lean=14, near_sh=(-2, -42), near_el=(20, -44), near_fist=(44, -44), far_el=(22, -26), far_fist=(30, -34),
                  near_knee=(56, 144), far_knee=(92, 142))
        B = [F(P_(lean=2, near_fist=(10, -32), far_fist=(24, -34))), F(P_(**j1)), F(P_(lean=4, far_el=(24, -28), far_fist=(32, -36))),
             F(P_(**j2)), rec()]
        st["attackA"] = S(A, 12, False, [1, 2], "far_ankle"); st["attackB"] = S(B, 14, False, [1, 3], ("box", 92, 48, 40, 30))
    else:
        st = {k: v for k, v in ga.thug_states(key).items() if k in ("attackA", "attackB")}
        if key == "thug_orange":   # widen pipe active window a touch
            st["attackA"]["active"] = {1, 2}
            st["attackA"]["frames"][0] = F(P_(lean=-6, near_el=(-16, -54), near_fist=(-10, -68)), props=[("pipe", "near", -150, 0)])
    st["ko"] = S(ko_frames(), 8, False)
    fall, ground, getup = knockdown()
    st["knockdown_fall"] = S(fall, 10, False); st["knockdown_ground"] = S(ground, 3, True); st["getup"] = S(getup, 8, False)
    return st

# ------------------------------------------------ snatcher
PURSE = lambda a=0: [("purse", "near", a, 0)]
def snatcher_idle():
    fr = []
    for k in range(4):
        a = 2 * math.pi * k / 4; dy = 1.5 * (1 - math.cos(a))
        fr.append(F(P_(torso=(66, 104 + dy), lean=6, head=(-6 if k in (1, 2) else 4), near_knee=(55, 142 + dy * 0.6), far_knee=(86, 141 + dy * 0.6),
                       near_el=(-13, -21), near_fist=(4, -22 + dy * 0.4), open_near=False, far_fist=(32, -34 + dy * 0.4)), props=PURSE()))
    return fr
def snatcher_states():
    st = {"idle": S(snatcher_idle(), 6, True)}
    run = run_cycle(8, 16, 26, 16, 70, 2.0, 1.2)
    for f in run: f["props"] = PURSE()
    st["run"] = S(run, 13, True)
    st["caught"] = S([F(dict(HURT), props=PURSE(-30)),
                      F({**HURT, "lean": -20, "head": -10}, fx=[("purse_drop", (96, 168), 0)]),
                      F(P_(lean=-4, expr="hurt", near_el=(-16, -46), near_fist=(-10, -62), open_near=True,
                           far_el=(24, -48), far_fist=(30, -64), open_far=True), fx=[("purse_drop", (100, 176), 1)])], 8, False)
    fall, ground, getup = knockdown()
    st["knockdown_fall"] = S(fall, 10, False); st["knockdown_ground"] = S(ground, 3, True); st["getup"] = S(getup, 8, False)
    return st

def locomotion_states():
    """ADDED (Joe): idle/walk/run/hurt. Appended after every existing state so existing frames keep their sx."""
    walk = run_cycle(4, 4, 14, 6, 68, 1.0, 0.6)
    run = run_cycle(6, 14, 24, 14, 70, 2.0, 1.1)
    hurt = [F(dict(HURT)), F({**HURT, "lean": -22, "head": -12, "torso": (58, 109)}),
            F(pose(torso=(63, 105), lean=-6, expr="hurt"))]
    return {"idle": S(guard_bob(4), 6, True), "walk": S(walk, 8, True), "run": S(run, 13, True), "hurt": S(hurt, 10, False)}

def _base_states(key):
    if key == "silas_boss": return silas_states()
    if key in THUG_KEYS: return thug_states(key)
    if key == "snatcher": return snatcher_states()
    raise KeyError(key)

def states_for(key):
    st = _base_states(key)
    add = locomotion_states()
    if key == "snatcher": add = {"hurt": add["hurt"]}      # snatcher already has idle/run
    for k, v in add.items():
        if k not in st: st[k] = v
    return st
ga.states_for = states_for   # job() in gen_anims resolves through this

WIDE_W = (240, 288, 336)
FORCE_WIDE = {("snatcher", "caught")}          # so the snatcher ko alias lives in one strip
ALIASES = {"snatcher": {"ko": ["caught", "knockdown_fall", "knockdown_ground"]}, "silas_boss": {"ko": ["defeat"]}}

def render_big(key, spec):
    """Same as gen_anims.render_spec but returns the padded image + the 144-frame window origin."""
    xf, cfg = ga.setup(key)
    P = spec["P"]; PX, PY = 80, 100
    cv = ga.PadCanvas(FW + 2 * PX, FH + 2 * PY, xf, PX, PY)
    for fx in spec.get("fx_back", []): ga.fx_draw(cv, fx)
    g.render_figure(cv, P)
    fit = cfg.get("fit", {}) if cfg else {}
    if fit.get("splatter") or fit.get("bag"): gc.draw_overlay(cv, P, fit)
    for kind, hand, ang, k in spec.get("props", []):
        pt = ga.hand_pt(P, hand) if isinstance(hand, str) else hand
        gc.draw_prop_at(cv, kind, pt, ang, k)
    r = spec.get("rot", 0); dx = spec.get("dx", 0)
    if r or dx:
        px, py = spec.get("pivot", (68, 187))
        im = cv.img.rotate(r, resample=Image.BICUBIC, center=((px + PX) * g.S, (py + PY) * g.S)) if r else cv.img
        if dx:
            out = Image.new("RGBA", im.size, (0, 0, 0, 0)); out.paste(im, (int(dx * g.S), 0)); im = out
        cv.img = im
    for fx in spec.get("fx", []): ga.fx_draw(cv, fx)
    big = g.finish(cv)
    bb = big.getchannel("A").getbbox()
    wx = PX
    if spec.get("center") and bb: wx = int(round((bb[0] + bb[2]) / 2 - 72))
    wy = (bb[3] - 1 - FEET) + int(spec.get("lift", 0))
    return big, bb, wx, wy, PX - wx, PY - wy, xf

def need_w(bb, wx, wy):
    """smallest frame width (centred on the 144 window) with >=2px margin, or None if the top clips."""
    if bb[1] < wy + 2: return -1
    for W in (144,) + WIDE_W:
        pad = (W - 144) // 2
        if bb[0] >= wx - pad + 2 and bb[2] <= wx - pad + W - 2: return W
    return 999

def job(args):
    key, state, idx = args
    stt = states_for(key)[state]; spec = stt["frames"][idx]
    big, bb, wx, wy, sx, sy, xf = render_big(key, spec)
    hb = None
    if idx in stt["active"] and stt["hit"]:
        h = stt["hit"]
        if isinstance(h, tuple): hb = dict(x=h[1], y=h[2], w=h[3], h=h[4])
        else:
            pt = ga.limb_pt(spec["P"], h)
            if xf: pt = (xf[2] + (pt[0] - xf[2]) * xf[0], xf[3] + (pt[1] - xf[3]) * xf[1])
            hb = dict(x=int(pt[0] + spec.get("dx", 0) + sx - 14), y=int(pt[1] + sy - 12), w=28, h=24)
    buf = io.BytesIO(); big.save(buf, "PNG")
    return key, state, idx, buf.getvalue(), (bb, wx, wy), dict(grounded=spec.get("grounded", True), lying=spec.get("lying", False),
                                                            active=idx in stt["active"], hitbox=hb)

def build(jobs=6):
    t0 = time.time(); tasks = []; plan = {}
    for key in KEYS:
        sts = states_for(key)
        plan[key] = [(s, len(v["frames"]), v["fps"], v["loop"]) for s, v in sts.items()]
        tasks += [(key, s, i) for s, v in sts.items() for i in range(len(v["frames"]))]
    with Pool(jobs) as pool:
        res = pool.map(job, tasks, chunksize=2)
    R = {(k, s, i): (Image.open(io.BytesIO(b)).convert("RGBA"), geo, m) for k, s, i, b, geo, m in res}
    man = dict(version=1, frameW=FW, frameH=FH, feetRow=FEET, characters={})
    for key in KEYS:
        fname = "assets/sprites/%s_anim.png" % key; wname = "assets/sprites/%s_anim_wide.png" % key
        entry = dict(file=fname, states={})
        norm, wide = [], []          # (image) lists
        grpW = {}
        for parts in ALIASES.get(key, {}).values():   # alias groups share one strip + width
            W = max(max(need_w(*R[(key, p, i)][1]) for i in range(len(states_for(key)[p]["frames"]))) for p in parts)
            for p in parts: grpW[p] = max(W, WIDE_W[0])
        for s, cnt, fps, loop in plan[key]:
            ws = [need_w(*R[(key, s, i)][1]) for i in range(cnt)]
            if min(ws) < 0 or max(ws) > WIDE_W[-1]: raise SystemExit("unfixable clip %s %s %s" % (key, s, ws))
            W = max(ws)
            if (key, s) in FORCE_WIDE: W = max(W, WIDE_W[0])
            if s in grpW: W = max(W, grpW[s])
            pad = (W - 144) // 2
            tgt = norm if W == 144 else wide
            x0 = sum(im.width for im in tgt)
            ms, sxs, idxs = [], [], []
            for i in range(cnt):
                big, (bb, wx, wy), m = R[(key, s, i)]
                im = big.crop((wx - pad, wy, wx - pad + W, wy + FH))
                abb = im.getchannel("A").getbbox()
                assert abb[0] > 0 and abb[1] > 0 and abb[2] < W and abb[3] < FH, (key, s, i, abb)
                if m["hitbox"]: m = {**m, "hitbox": {**m["hitbox"], "x": m["hitbox"]["x"] + pad}}
                sxs.append(x0 + i * W); idxs.append(len(tgt)); tgt.append(im); ms.append(m)
            st = dict(file=wname if W > 144 else fname, frames=idxs, fps=fps, loop=loop, fw=W, fh=FH, anchorX=W // 2,
                      sx=sxs, sw=[W] * cnt, sy=[0] * cnt, sh=[FH] * cnt,
                      grounded=[m["grounded"] for m in ms], lying=[m["lying"] for m in ms],
                      active=[m["active"] for m in ms], hitbox=[m["hitbox"] for m in ms])
            entry["states"][s] = st
        for alias, parts in ALIASES.get(key, {}).items():
            ps = [entry["states"][p] for p in parts]
            assert len({p["file"] for p in ps}) == 1 and len({p["fw"] for p in ps}) == 1
            a = dict(ps[0]); a["aliasOf"] = parts; a["fps"] = 8; a["loop"] = False
            for f in ("frames", "sx", "sw", "sy", "sh", "grounded", "lying", "active", "hitbox"):
                a[f] = [v for p in ps for v in p[f]]
            entry["states"][alias] = a
        for lst, nm in ((norm, fname), (wide, wname)):
            path = os.path.join(SPR, os.path.basename(nm))
            if not lst:
                if os.path.exists(path): os.remove(path)
                continue
            strip = Image.new("RGBA", (sum(i.width for i in lst), FH), (0, 0, 0, 0)); x = 0
            for i in lst: strip.paste(i, (x, 0)); x += i.width
            strip.save(path)
        if wide: entry["wideFile"] = wname
        man["characters"][key] = entry
        print("anim", key, len(norm), "std +", len(wide), "wide frames")
    json.dump(man, open(os.path.join(SPR, "anims_enemies.json"), "w"), indent=1)
    st = man["characters"]["snatcher"]["states"]["idle"]
    Image.open(os.path.join(SPR, os.path.basename(st["file"]))).crop((st["sx"][0], 0, st["sx"][0] + FW, FH)).save(os.path.join(SPR, "snatcher.png"))
    print("done %d frames in %.1fs" % (len(tasks), time.time() - t0))

if __name__ == "__main__":
    a = sys.argv[1:]
    build(int(a[a.index("--jobs") + 1]) if "--jobs" in a else 6)
