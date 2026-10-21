#!/usr/bin/env python3
"""1.7.0 Cinder Hollow Correctional cast: 6 prisoners, 2 guards, Silas in prison blues.
Writes stills + anim strips (idle_personality / talk) and appends to anims.json. Does not rewrite other characters."""
import json, math, os, sys, time, io
from multiprocessing import Pool
from PIL import Image
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
REPO = os.path.dirname(HERE); SPR = os.path.join(REPO, "assets", "sprites")
import gen_matthew_v2 as g
import gen_cast as gc
from gen_matthew_v2 import C, ramp
from gen_cast import fit, SKINS, make_head
import gen_anims as ga

# Orange jumpsuit palette (inmates) / slate-blue guard uniforms / Silas navy blues with "C-14"
JUMP = fit("tee", (214, 120, 40), (190, 100, 32), boot=(40, 40, 44), sole=(30, 30, 34), untucked=True,
           sleeves="long", accent=(40, 40, 48), shoe="sneaker", hem="plain", nostar=True)
GUARD = fit("jacket", (52, 70, 96), (40, 48, 64), boot=(30, 30, 34), sleeves="long", untucked=True,
            inner=(230, 230, 234), accent=(200, 170, 50), track=False, hem="rib")
SILAS_P = fit("tee", (48, 72, 120), (40, 60, 100), boot=(28, 28, 32), sole=(20, 20, 24), untucked=True,
              sleeves="long", accent=(200, 180, 80), shoe="sneaker", hem="plain", nostar=True)

PRISON = {
    # Reed "Tags" Malloy — graffiti kid, non-violent; knew Wren's street corners
    "reed": dict(skin="olive", build=(0.94, 0.98), prop="sketchbook", hold=True,
                 head=dict(hair="short", hair_col="black", facial="stubble", brow_angry=False, earring=C(220, 220, 230)),
                 fit=JUMP),
    # Dora Keene — former Boone bookkeeper who flipped on the company
    "dora": dict(skin="fair", build=(0.92, 0.96), prop="book", hold=True,
                 head=dict(hair="ponytail", hair_col="brown", lashes=True, glasses=C(50, 40, 40), lip=C(170, 90, 90)),
                 fit=JUMP),
    # Otto "Wrench" Pike — Foreman's crew mechanic; set the fires downtown
    "otto": dict(skin="ruddy", build=(1.08, 1.02), prop="pipe", hold=True,
                 head=dict(hair="bald", hair_col="brown", facial="beard", facial_col="brown", brow_angry=True, scar=True, brow_w=1.9),
                 fit=JUMP),
    # Mina Solis — Vera Lisk's former courier, caught with the wrong pin list
    "mina": dict(skin="tan", build=(0.9, 0.94), prop="phone", hold=True,
                 head=dict(hair="long", hair_col="black", lashes=True, blush=True, lip=C(160, 80, 90), earring=C(240, 200, 90)),
                 fit=JUMP),
    # Bart Holley — corrupt Rail Yards patrolman, flipped after the state inspector
    "bart": dict(skin="peach", build=(1.04, 1.0), prop=None, hold=False,
                 head=dict(hair="buzz", hair_col="brown", facial="mustache", facial_col="brown", brow_col="brown", age=True),
                 fit=JUMP),
    # Quay "Quiet" Dunn — older lifer, knows every corridor; soft-spoken
    "quay": dict(skin="deep", build=(1.0, 0.98), prop="book_open", hold=True,
                 head=dict(hair="bald", hair_col="grey", facial="goatee", facial_col="grey", brow_col="grey", age=True, brow_w=1.8),
                 fit=JUMP),
    # Guards
    "ellis": dict(skin="brown", build=(1.06, 1.02), prop="clipboard", hold=True,
                  head=dict(hair="short", hair_col="black", facial="stubble", hat="cap", hat_rgb=(40, 52, 72), hat_logo=C(200, 170, 50)),
                  fit=GUARD),
    "ramos": dict(skin="olive", build=(1.0, 1.0), prop=None, hold=False,
                  head=dict(hair="buzz", hair_col="black", facial="goatee", hat="cap", hat_rgb=(40, 52, 72)),
                  fit=GUARD),
    # Honest Roanoke police (arrest cutscene): Sgt. Dana Reyes + Officer Ben Okafor
    "reyes": dict(skin="tan", build=(0.94, 0.98), prop="radio", hold=True,
                  head=dict(hair="bun", hair_col="black", lashes=True, lip=C(170, 90, 86), hat="cap", hat_rgb=(24, 34, 60), hat_logo=C(214, 180, 70)),
                  fit=fit("buttondown", (34, 50, 88), (26, 32, 52), boot=(20, 20, 24), sole=(12, 12, 14), untucked=False, accent=(214, 180, 70))),
    "okafor": dict(skin="deep", build=(1.08, 1.04), prop="cuffs", hold=True,
                   head=dict(hair="buzz", hair_col="black", facial="beard", hat="cap", hat_rgb=(24, 34, 60), hat_logo=C(214, 180, 70)),
                   fit=fit("buttondown", (34, 50, 88), (26, 32, 52), boot=(20, 20, 24), sole=(12, 12, 14), untucked=False, accent=(214, 180, 70))),
    # Silas in his coat, hands cuffed behind his back (arrest cutscene)
    "silas_cuffed": dict(gc.SILAS, prop=None, hold=False),
    # Silas Boone in Cinder Hollow blues (cell C-14)
    "silas_prison": dict(skin="pale", build=(1.09, 1.06), anchor_x=63.0, prop=None, hold=False,
                         head=dict(hair="slick", hair_col="silver", facial="goatee", facial_col="silver", brow_col="grey",
                                   narrow=True, smirk=True, brow_w=1.8, scar=True),
                         fit=SILAS_P),
}
KEYS = list(PRISON)

_prop_at = gc.draw_prop_at
def draw_prop_at(cv, kind, f, ang=0.0, k=0.0):
    from gen_matthew_v2 import Part, add, rot, ellipse_pts
    R_ = lambda q: add(f, rot(q, ang))
    if kind == "cuffs":                            # steel handcuffs (two rings + short chain)
        st = ramp((196, 200, 210), hi=(244, 246, 250))
        for c in ((-3.2, 1.0), (3.4, 1.4)):
            b = Part(cv, [ellipse_pts(R_(c), 3.0, 2.4, n=14)], st, shade=(0.8, 0.6), hi=(0.4, -0.4), rim=0.4, ink=0.6)
            b.poly(ellipse_pts(R_(c), 1.7, 1.2, n=12), (0, 0, 0, 0)); b.commit()
        Part(cv, [[R_(q) for q in [(-0.4, 0.6), (0.8, 0.6), (0.8, 1.8), (-0.4, 1.8)]]], st, shade=(0.4, 0.4), hi=None, rim=0, ink=0.5).commit()
        return
    if kind == "radio":                            # handheld radio with antenna
        b = Part(cv, [[R_(q) for q in [(0, -9), (5.6, -9), (5.8, 2), (0.2, 2)]]], ramp((40, 42, 48)), shade=(1, 1), hi=(0.4, -0.4), rim=0.5, ink=0.6)
        b.line([R_((1.2, -9)), R_((1.0, -16))], C(30, 30, 34), 0.8)
        b.dot(R_((4.2, -7.4)), 0.7, C(230, 60, 50)); b.commit()
        return
    return _prop_at(cv, kind, f, ang, k)
gc.draw_prop_at = draw_prop_at
_draw_prop = gc.draw_prop
def draw_prop(cv, kind, P):
    from gen_matthew_v2 import add, rot
    if kind in ("cuffs", "radio"):
        o = P["torso"]; lean = P.get("lean", 0)
        return draw_prop_at(cv, kind, add(rot(P["near_fist"], lean), o))
    return _draw_prop(cv, kind, P)
gc.draw_prop = draw_prop

# Patch gen_cast so gen_anims can resolve these keys
gc.PRISON = PRISON
gc.PRISON_KEYS = KEYS

# Number stencil on jumpsuits: draw a chest number after the figure
_draw_overlay = gc.draw_overlay
def draw_overlay_num(cv, P, style):
    _draw_overlay(cv, P, style)
    num = style.get("prison_num")
    if not num: return
    from gen_matthew_v2 import Part, add, rot
    o = P["torso"]; lean = P.get("lean", 0)
    TL = lambda q: add(rot(q, lean), o)
    # number plate on chest
    b = Part(cv, [[TL(q) for q in [(-6, -36), (14, -36.5), (14.5, -26), (-5.5, -25.5)]]], ramp((40, 40, 48)), shade=(1, 1), hi=None, rim=0.4, ink=0.5)
    # simple block digits via dots (readable at game scale)
    # just draw the string with PIL after finish — handled in render_prison
    b.commit()
gc.draw_overlay = draw_overlay_num

def stamp_number(im, text):
    from PIL import ImageDraw, ImageFont
    d = ImageDraw.Draw(im)
    try: f = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 8)
    except Exception: f = ImageFont.load_default()
    # chest region ~ (60, 70)
    bb = d.textbbox((0, 0), text, font=f); tw = bb[2] - bb[0]
    x = 76 - tw // 2; y = 84
    d.rectangle([x - 2, y, x + tw + 2, y + 9], fill=(238, 232, 214, 255), outline=(40, 34, 30, 255))
    d.text((x, y), text, font=f, fill=(30, 30, 36, 255))
    return im

NUMS = {"reed": "4821", "dora": "5107", "otto": "3390", "mina": "6214", "bart": "1188", "quay": "0904", "silas_prison": "C-14"}

def render_still(key):
    ch = dict(PRISON[key])
    ch["fit"] = dict(ch["fit"]); ch["fit"]["prison_num"] = NUMS.get(key)
    st = gc.npc_still(ch)
    if key in NUMS: st = stamp_number(st.convert("RGBA"), NUMS[key])
    return st

def write_stills():
    os.makedirs(SPR, exist_ok=True)
    for k in KEYS:
        if k == "silas_cuffed": continue
        st = render_still(k)
        # alias: silas_prison.png, and also keep id file
        st.save(os.path.join(SPR, k + ".png"))
        print("still", k)

# --- anims: reuse gen_anims pipeline by registering keys ---
def prison_states(key):
    """idle_personality 6f + talk 4f, matching cast contract."""
    F, S, npc, talk = ga.F, ga.S, ga.npc, ga.talk
    prop = PRISON[key].get("prop")
    hold = PRISON[key].get("hold")
    st = {}
    if key == "silas_prison":
        fr = []
        for k in range(6):
            up = k in (1, 2, 3)
            P = npc(head=-2 if up else 0, near_el=(-6, -30) if up else (-14, -19),
                    near_fist=(8, -44 + (k - 2) * 1.5) if up else (-6, -2), open_near=up, expr="calm")
            fr.append(F(P))
        st["idle_personality"] = S(fr, 6, True)
        st["talk"] = S(talk(dict()), 6, True)
        return st
    if key == "silas_cuffed":
        behind = dict(near_el=(-17, -19), near_fist=(-15, -3), open_near=False, far_el=(3, -19), far_fist=(-11, -3), open_far=False)
        fr = []
        for k in range(4):
            P = npc(head=6 + (2 if k in (1, 2) else 0), expr="calm", **behind)
            fr.append(F(P, props=[("cuffs", "near", 0, 0)]))
        st["idle_personality"] = S(fr, 4, True)
        st["talk"] = S([F(npc(head=2 + (2 if k % 2 else 0), expr="talk" if k % 2 == 0 else "calm", **behind), props=[("cuffs", "near", 0, 0)]) for k in range(4)], 6, True)
        wf = []
        for k in range(6):
            ph = 2 * math.pi * k / 6
            P = npc(head=5, expr="calm", **behind)
            P.update(ga.legs((66, 104), 2, ph, stride=16, lift=8, kick=5))
            P["torso"] = (66, 104 - 1.2 * abs(math.cos(ph)))
            wf.append(F(P, props=[("cuffs", "near", 0, 0)]))
        st["walk"] = S(wf, 8, True)
        return st
    if key in ("reyes", "okafor"):
        fr = []
        for k in range(6):
            P = npc(head=1 + (2 if k in (2, 3) else 0), **gc.HOLD)
            fr.append(F(P, props=[(prop, "near", 0, 0)]))
        st["idle_personality"] = S(fr, 6, True)
        st["talk"] = S(talk(dict(gc.HOLD), props=[(prop, "near", 0, 0)]), 6, True)
        wf = []
        for k in range(6):
            ph = 2 * math.pi * k / 6
            P = npc(head=1, **gc.HOLD)
            P.update(ga.legs((66, 104), 4, ph, stride=20, lift=10, kick=6))
            P["torso"] = (66, 104 - 1.6 * abs(math.cos(ph)))
            wf.append(F(P, props=[(prop, "near", 0, 0)]))
        st["walk"] = S(wf, 9, True)
        return st
    if key in ("ellis", "ramos"):
        fr = []
        for k in range(6):
            P = npc(head=1 + (2 if k in (2, 3) else 0), **(gc.HOLD if hold else {}))
            props = [("clipboard", "near", 0, k / 6.0)] if prop == "clipboard" else []
            fr.append(F(P, props=props) if props else F(P))
        st["idle_personality"] = S(fr, 6, True)
        st["talk"] = S(talk(dict(gc.HOLD) if hold else dict(), props=[("clipboard", "near", 0, 0)] if prop == "clipboard" else []), 6, True)
        return st
    # generic prisoner idle: shift weight, maybe hold prop
    fr = []
    for k in range(6):
        base = dict(gc.HOLD) if hold else {}
        base["head"] = 1 + (2 if k in (2, 3) else 0)
        P = npc(**base)
        props = []
        if prop == "book": props = [("book", "near", 0, 0)]
        elif prop == "book_open": props = [("book_open", "near", 0, k / 6.0)]
        elif prop == "phone": props = [("phone", "near", 0, 0)]
        elif prop == "pipe": props = [("pipe", "near", 10 * math.sin(k), 0)]
        elif prop == "sketchbook": props = [("sketchbook", "near", 0, 0)]
        fr.append(F(P, props=props) if props else F(P))
    st["idle_personality"] = S(fr, 6, True)
    tprops = []
    if prop in ("book", "book_open"): tprops = [(prop if prop != "book_open" else "book_open", "near", 0, 0)]
    elif prop: tprops = [(prop, "near", 0, 0)]
    st["talk"] = S(talk(dict(gc.HOLD) if hold else dict(), props=tprops), 6, True)
    return st

# Hook into gen_anims
_orig_char_cfg = ga.char_cfg
_orig_states_for = ga.states_for
def char_cfg(key):
    if key in PRISON: return ("cast", PRISON[key])
    return _orig_char_cfg(key)
def states_for(key):
    if key in PRISON: return prison_states(key)
    return _orig_states_for(key)
ga.char_cfg = char_cfg
ga.states_for = states_for

def build_anims(jobs=6):
    # Monkeypatch job() path: gen_anims.job uses char_cfg/states via module globals — already patched
    ga.build(KEYS, jobs)
    # Stamp numbers onto each frame of anim strips for inmates + silas
    man = json.load(open(os.path.join(SPR, "anims.json")))
    for key in KEYS:
        if key not in NUMS: continue
        entry = man["characters"].get(key)
        if not entry: continue
        for fname in {entry.get("file", "").replace("assets/sprites/", ""), (entry.get("wideFile") or "").replace("assets/sprites/", "")}:
            if not fname: continue
            path = os.path.join(SPR, fname)
            if not os.path.exists(path): continue
            im = Image.open(path).convert("RGBA")
            # stamp on each 144-wide cell (narrow strip only)
            if "wide" in fname: continue
            fw = 144
            n = im.width // fw
            for i in range(n):
                cell = im.crop((i * fw, 0, (i + 1) * fw, im.height))
                cell = stamp_number(cell, NUMS[key])
                im.paste(cell, (i * fw, 0))
            im.save(path)
        print("stamped", key)

if __name__ == "__main__":
    jobs = 6
    a = sys.argv[1:]
    if "--jobs" in a: jobs = int(a[a.index("--jobs") + 1])
    if "--keys" in a: KEYS[:] = a[a.index("--keys") + 1].split(",")
    write_stills()
    build_anims(jobs)
    g.HEAD_FN[0] = g.head_parts; g.set_outfit("polo")
    print("prison cast done")
