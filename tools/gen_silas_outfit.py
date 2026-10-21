#!/usr/bin/env python3
"""Build Matthew outfit `silas` (Silas Boone's look) + Iron Handshake kit + Silas six-move set into an OUTPUT folder.
Never writes assets/: install with tools/install_silas_outfit.py OUT (append-only merges, see ASSETS.md "Outfit: silas").
usage: python3 tools/gen_silas_outfit.py [--out DIR] [--jobs N] [--skip-anims]
       DIR defaults to /workspace/tmp_sprite/silas_outfit_build; DIR/work holds intermediate gen_anims / gen_kits output."""
import hashlib, io, json, os, shutil, sys, time
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)                 # tools/
REPO = os.path.dirname(HERE); LIVE = os.path.join(REPO, "assets", "sprites")
from multiprocessing import Pool
from PIL import Image
import silas_ext as sx
g, ga, gk = sx.g, sx.ga, sx.gk
FW, FH, FEET, WW = 144, 192, 189, 240
a = sys.argv[1:]
OUT = os.path.abspath(a[a.index("--out") + 1]) if "--out" in a else "/workspace/tmp_sprite/silas_outfit_build"
assert not os.path.realpath(OUT).startswith(os.path.realpath(REPO)), "--out must be outside the repo (install with tools/install_silas_outfit.py)"
WORK = os.path.join(OUT, "work"); os.makedirs(WORK, exist_ok=True)
for m in (g, ga, gk): assert os.path.dirname(os.path.realpath(m.__file__)) == os.path.realpath(HERE), m.__file__
gk.OUT_SPR = gk.SPR_DIR = os.path.join(WORK, "kit_live_guard")          # never the repo
JOBS = int(a[a.index("--jobs") + 1]) if "--jobs" in a else 8
P = lambda n: "assets/sprites/" + n
t0 = time.time()

# 0) rig sanity: the lib copy still renders the locked polo sheet byte-for-byte
g.set_outfit("polo"); polo, _ = g.build_sheet(); buf = io.BytesIO(); polo.save(os.path.join(WORK, "polo_check.png"))
same = list(polo.getdata()) == list(Image.open(os.path.join(LIVE, "matthew_sheet.png")).convert("RGBA").getdata())
print("rig check: tools polo sheet pixel-identical to live matthew_sheet.png:", same); assert same

# 1) base 8-pose sheet
g.set_outfit(sx.OID); sheet, frames = g.build_sheet(); sheet.save(os.path.join(OUT, "matthew_silas.png")); g.set_outfit("polo")
print("sheet", sheet.size)

# 2) shared 14 anim states (gen_anims.build -> work/anim)
AD = os.path.join(WORK, "anim"); os.makedirs(AD, exist_ok=True)
if "--skip-anims" not in a:
    if os.path.exists(os.path.join(AD, "anims.json")): os.remove(os.path.join(AD, "anims.json"))
    ga.SPR = AD; ga.build([sx.KEY], JOBS)
anim = json.load(open(os.path.join(AD, "anims.json")))["characters"][sx.KEY]
for fn in ("matthew_silas_anim.png", "matthew_silas_anim_wide.png"):
    if os.path.exists(os.path.join(AD, fn)): shutil.copy(os.path.join(AD, fn), os.path.join(OUT, fn))

# 3) kit strips (gen_kits.build --out work/kit)
KD = os.path.join(WORK, "kit"); gk.build([sx.OID], JOBS, KD)
kit = json.load(open(os.path.join(KD, "kits_anims.json")))["characters"][sx.KEY]
for fn in ("matthew_silas_kit.png", "matthew_silas_kit_wide.png"):
    shutil.copy(os.path.join(KD, "assets", "sprites", fn), os.path.join(OUT, fn))

# 4) six-move strips. Timing/widths = silas_dlc/anims_silas_player.json (Jack, final) + parent spec: grab/throw/hs/strike/rush 240
#    (anchorX 120), everything else 144 (anchorX 72). Widths are forced, not inferred; a 144 state whose art leaves the cell fails.
MV = sx.moves()
tasks = [(s, i) for s, v in MV.items() for i in range(len(v["frames"]))]
with Pool(JOBS) as pool: res = pool.map(sx.move_job, tasks, chunksize=1)
R = {(s, i): (Image.open(io.BytesIO(b)).convert("RGBA"), m) for s, i, b, m in res}
PAD = (WW - FW) // 2
lay = []; cn = cw = 0; Tn = Tw = 0
for s, v in MV.items():
    n = len(v["frames"]); ex = [R[(s, i)][1]["extra"] for i in range(n)]
    L = max(e[0] for e in ex); Rr = max(e[1] for e in ex); T = max(e[2] for e in ex)
    wide = v["width"] == WW
    if wide: assert max(L, Rr) <= PAD, ("TOO WIDE", s, L, Rr); start = cw; cw += n; Tw = max(Tw, T)
    else: assert L == 0 and Rr == 0, ("144 state leaves its cell", s, L, Rr); start = cn; cn += n; Tn = max(Tn, T)
    lay.append((s, n, v, wide, start))
cw_stance = cw; cw += len(MV["last_word_stance"]["frames"])          # 240-padded copies of the stance for the combined last_word
assert Tn == 0 and Tw == 0, ("art above the 192 cell", Tn, Tw)          # keeps every cell 192 tall like the DLC manifest
MF, MWF = P("matthew_silas_moves.png"), P("matthew_silas_moves_wide.png")
strips = {False: Image.new("RGBA", (cn * FW, FH), (0, 0, 0, 0)), True: Image.new("RGBA", (cw * WW, FH), (0, 0, 0, 0))}
moves = {}
def entry_for(file, frames, fw, fps, loop, ms, hb):
    n = len(frames)
    return dict(file=file, frames=frames, fps=fps, loop=loop, fw=fw, fh=FH, anchorX=fw // 2, wide=fw == WW,
                sx=[f * fw for f in frames], sw=[fw] * n, sy=[0] * n, sh=[FH] * n,
                grounded=[m["grounded"] for m in ms], lying=[m["lying"] for m in ms], active=[m["active"] for m in ms], hitbox=hb)
for s, n, v, wide, start in lay:
    ms = []; fw = WW if wide else FW; L = PAD if wide else 0
    for i in range(n):
        im, m = R[(s, i)]; eL = m["extra"][0]
        strips[wide].paste(im, ((start + i) * fw + L - eL, 0)); ms.append(m)
    hb = [None if not m["hitbox"] else dict(m["hitbox"], x=m["hitbox"]["x"] + L) for m in ms]
    e = entry_for(MWF if wide else MF, list(range(start, start + n)), fw, v["fps"], v["loop"], ms, hb)
    if "counter" in v: e["counter"] = [v["counter"]] * n
    moves[s] = e
# stance padded into 240 cells (pixel copy, centred: anchor 72 -> 120)
st0 = moves["last_word_stance"]
for i, f in enumerate(st0["frames"]):
    strips[True].paste(strips[False].crop((f * FW, 0, f * FW + FW, FH)), ((cw_stance + i) * WW + PAD, 0))
strips[False].save(os.path.join(OUT, os.path.basename(MF))); strips[True].save(os.path.join(OUT, os.path.basename(MWF)))
print("moves", cn, "normal +", cw, "wide frames")

def cat(name, parts, fps, loop=False):                              # Jack-style alias: own frames (concatenated) + aliasOf
    es = [moves[p] for p in parts]; fw = es[0]["fw"]; assert all(e["fw"] == fw for e in es), name
    e = dict(es[0]); e.update(fps=fps, loop=loop, aliasOf=list(parts))
    for k in ("frames", "sx", "sw", "sy", "sh", "grounded", "lying", "active", "hitbox"): e[k] = [x for q in es for x in q[k]]
    if any("counter" in q for q in es): e["counter"] = [x for q in es for x in q.get("counter", [False] * len(q["frames"]))]
    return e
def alias(name, of):
    e = dict(moves[of]); e["aliasOf"] = [of]; return e
# last_word stance part in 240 cells
lw_st = dict(st0); fr = list(range(cw_stance, cw_stance + len(st0["frames"])))
lw_st.update(file=MWF, frames=fr, fw=WW, anchorX=WW // 2, wide=True, sx=[f * WW for f in fr], sw=[WW] * len(fr),
             hitbox=[None if not h else dict(h, x=h["x"] + PAD) for h in st0["hitbox"]])
moves["_lw_stance240"] = lw_st
ALIASES = {}
ALIASES["gentlemans_jab"] = alias("gentlemans_jab", "jab1")
ALIASES["velvet_grip"] = cat("velvet_grip", ["velvet_grip_grab", "velvet_grip_throw"], 12)
ALIASES["iron_handshake"] = cat("iron_handshake", ["hs_grab", "hs_slam"], 12)
lw = cat("last_word", ["_lw_stance240", "last_word_strike"], 14); lw["aliasOf"] = ["last_word_stance", "last_word_strike"]; lw["holdLoop"] = [0, 3]
ALIASES["last_word"] = lw
for a_, of in (("grab", "velvet_grip_grab"), ("whiff", "velvet_grip_grab"), ("throw", "velvet_grip_throw"), ("stance", "last_word_stance"),
               ("counter", "last_word_strike"), ("stare", "cold_stare"), ("rush", "boss_rush")):
    ALIASES[a_] = alias(a_, of)                                           # Jack's short aliases, same structure
del moves["_lw_stance240"]
moves.update(ALIASES)

# 5) manifest (exact anims.json schema): shared states + kit overrides (gen_kits.apply_kit rules) + moves
entry = dict(anim)                                    # file / wideFile / states from gen_anims
entry["states"] = dict(anim["states"])
for st in gk.KIT_STATES: entry["states"][st] = kit["states"][st]
entry["kit"] = kit["kit"]
for s, v in moves.items(): entry["states"][s] = v
man = dict(version=1, frameW=FW, frameH=FH, feetRow=FEET, characters={sx.KEY: entry},
           install=dict(outfitsAppend=[sx.OID], kitRev_unchanged="1.3.1-kits", spriteRevSuggestion="1.5.0-silas",
                        note="merge characters.matthew_silas into assets/sprites/anims.json and append 'silas' to its top-level outfits list"))
json.dump(man, open(os.path.join(OUT, "silas_anims.json"), "w"), indent=1)

# 6) portrait, weapon icon, collectible
sx.build_portrait_silas().save(os.path.join(OUT, "portrait_matthew_silas.png"))
sx.weapon_icon().save(os.path.join(OUT, "weapon_silas.png"))
wj = json.load(open(os.path.join(LIVE, "weapons.json")))
idx = wj["silas"]["index"] if "silas" in wj else wj["_meta"]["count"]          # stable after install (index 12)
json.dump({"silas": dict(name=sx.WEAPON, move=sx.MOVE, index=idx, x=idx * 48, y=0, w=48, h=48),
           "_meta_after_append": dict(count=idx + 1, order=[o for o in wj["_meta"]["order"] if o != "silas"] + ["silas"], size=[48 * (idx + 1), 48])},
          open(os.path.join(OUT, "weapons_silas.json"), "w"), indent=1)
sx.collectible_row().save(os.path.join(OUT, "collectible_silas.png"))
cj = json.load(open(os.path.join(LIVE, "collectibles.json")))
row = cj["silas"]["row"] if "silas" in cj else len([k for k in cj if not k.startswith("_")])   # stable after install (row 20)
json.dump({"silas": dict(row=row, frames=6, fw=48, fh=48, fps=8, name="Boone's Overcoat",
                         names=["Boone's Overcoat", "Silas Boone's Overcoat", "Silas Outfit", "Silas Coat", "Iron Handshake"])},
          open(os.path.join(OUT, "collectibles_silas.json"), "w"), indent=1)
print("done %.1fs" % (time.time() - t0))
