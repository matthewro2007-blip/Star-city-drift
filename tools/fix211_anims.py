"""2.1.1 animation pass (deterministic, no image model, no cross-fades).

1. Breathing / weight-shift idle loops synthesised from each character's own approved still (sub-pixel warp of the
   same pixels, feet pinned): Matthew x15 outfits (`idle`, `idle_signature`), William (`idle_personality`, `idle`,
   `idle_signature`) and Joe's 30 single-pose cast (`idle_personality`, `talk`, `idle`).
2. Locomotion / idle states of every character (anims.json + anims_enemies.json): per-frame anchorX on the hip
   centre (no body jumps inside a cycle or between idle / walk / attack cells, 288 or 480 wide), feet row per frame
   on the drawn feet, duplicate-frame hitch removed (Matthew sprint), and `travel` (logical px per loop) so the
   game can match leg speed to move speed.
Run from the repo root: python3 tools/fix211_anims.py   (idempotent: idles always rebuilt from the original stills)
"""
import json, os, sys, math
import numpy as np
from PIL import Image
from scipy.ndimage import map_coordinates
sys.path.insert(0, os.path.dirname(__file__))
from anim_metrics import cell_metrics, load

SPR = 'assets/sprites'
N_IDLE, FPS_IDLE = 16, 8

def cell(path, st, i=0):
    a = load(path)
    fw = st['sw'][i] if isinstance(st.get('sw'), list) else st.get('fw', 288)
    fh = st['sh'][i] if isinstance(st.get('sh'), list) else st.get('fh', 384)
    sx = st['sx'][i] if isinstance(st.get('sx'), list) else st['frames'][i] * fw
    sy = st['sy'][i] if isinstance(st.get('sy'), list) else 0
    return a[sy:sy + fh, sx:sx + fw].copy()

sys.path.insert(0, '/workspace/anim_pass/joe/fix211')
from breathe2 import breathe2 as _joe_breathe2

def breathe(src, n=N_IDLE, breath=0.011, shift=2.2, sway=0.0, pad=12):
    """2.1.1b: Joe's breathe2 (4x Lanczos supersample, the same warp + box downsample on EVERY frame incl. frame 0,
    feet rows outside the field) -> no sub-pixel shimmer. Output cropped back to the source cell."""
    H, W = src.shape[:2]
    ims = _joe_breathe2(Image.fromarray(src, 'RGBA'), n=n, breath=breath, shift=shift, sway=sway, pad=pad)
    return [np.array(im)[pad:pad + H, pad:pad + W].copy() for im in ims]

def write_strip(name, cells):
    h, w = cells[0].shape[:2]
    Image.fromarray(np.concatenate(cells, axis=1), 'RGBA').save(f'{SPR}/{name}', optimize=True)
    return f'{SPR}/{name}', w, h

def loop_state(file, w, h, n, fps, feet, base):
    return {'file': file, 'artScale': base.get('artScale', 2), 'fps': fps, 'loop': True, 'fw': w, 'fh': h,
            'feetRow': feet, 'anchorX': w // 2, 'frames': list(range(n)), 'sx': [i * w for i in range(n)],
            'sy': [0] * n, 'sw': [w] * n, 'sh': [h] * n, 'active': [False] * n, 'grounded': [True] * n,
            'lying': [False] * n, 'hitbox': [None] * n, 'gen': 'fix211 breathe'}

def normalize_talk(st, ref):
    """2.1.1b: William's talk keys were drawn ~16 px apart in height; scale every key to the idle key's height,
    feet on the same row, feet centre kept."""
    st = json.loads(json.dumps(st)); n = len(st['frames'])
    rm = cell_metrics(ref); target = rm['bot'] - rm['top']
    cells = []
    for i in range(n):
        c = cell(st['file'], st, i); m = cell_metrics(c); h = m['bot'] - m['top']
        if abs(h - target) > 1:
            im = Image.fromarray(c, 'RGBA'); sc = target / h
            big = im.resize((round(im.width * sc), round(im.height * sc)), Image.LANCZOS)
            fx = (m['fl'] + m['fr']) / 2
            out = Image.new('RGBA', im.size)
            ox, oy = round(fx - fx * sc), round(m['bot'] - m['bot'] * sc)
            out.paste(big, (ox, oy))                  # empty canvas: plain paste keeps alpha exact
            c = np.array(out)
        cells.append(c)
    f, w, h = write_strip('william_talk_fix211_jk.png', cells)
    return dict(st, file=f, frames=list(range(n)), sx=[i * w for i in range(n)], sy=[0] * n, sw=[w] * n, sh=[h] * n, fix211='talk scale normalised')

LOCO = ('idle', 'idle_personality', 'idle_signature', 'talk', 'walk', 'run', 'sprint')

def per_frame(st, n, key, default):
    v = st.get(key, default)
    return list(v) if isinstance(v, list) else [v] * n

def fix_loco(ch, name, R, log):
    st = ch['states'][name]
    if not isinstance(st.get('file'), str) or not st.get('frames'): return
    if str(st.get('gen', '')).startswith('joe fix211'): return     # Joe's merged walks / idles: his anchors, feet and travel
    n = len(st['frames'])
    ms = [cell_metrics(cell(st['file'], st, i)) for i in range(n)]
    if any(m is None or m['hip'] is None for m in ms): return
    fw = per_frame(st, n, 'sw', st.get('fw', 288))
    fh = per_frame(st, n, 'sh', st.get('fh', 384))
    for k in ('sx', 'sy', 'sw', 'sh'):
        if not isinstance(st.get(k), list):
            st[k] = [st['frames'][i] * fw[i] for i in range(n)] if k == 'sx' else (fw if k == 'sw' else fh if k == 'sh' else [0] * n)
    grounded = per_frame(st, n, 'grounded', True)
    old_fr = per_frame(st, n, 'feetRow', None)
    if name in ('walk', 'run', 'sprint'):
        ax = [round(ms[i]['hip'] + R, 1) for i in range(n)]      # body steady over the moving legs
        if max(ax) - min(ax) < 15:                                 # 2.1.1b: pose noise only (arms/lean) -> steady anchor
            ax = [round(sum(ax) / n, 1)] * n
    else:                                                         # idles: feet pinned, so one anchor for the loop
        ax = [round(ms[0]['hip'] + R, 1)] * n
    fr = [(ms[i]['bot'] - 1) if grounded[i] is not False else (old_fr[i] if old_fr[i] is not None else fh[i] - 6) for i in range(n)]
    st['anchorX'] = ax
    st['feetRow'] = fr
    st['fix211'] = True
    if name in ('walk', 'run', 'sprint'):
        spans = [m['span'] for m in ms]
        lo, hi = min(spans), max(spans)
        steps = sum(1 for i in range(n) if spans[i] >= lo + 0.75 * (hi - lo) and spans[i] > spans[i - 1] - 1 and spans[i] >= spans[(i + 1) % n] - 1)
        step = max(0, hi - lo) * 0.92
        s = st.get('artScale', 2)
        if hi - lo > 12 and steps:
            st['travel'] = round(steps * step / s, 1)      # logical px covered by one loop of the strip
    log.append((name, n, [round(a) for a in ax], fr, st.get('travel')))

def dedupe_sprint(st):
    """Matthew sprint shipped as poses [0,1,2,3,1,3]: the two extra passing poses double-step. Keep the 4-pose cycle."""
    if len(st['frames']) == 6:
        for k, v in list(st.items()):
            if isinstance(v, list) and len(v) == 6: st[k] = v[:4]

def main():
    am = json.load(open(f'{SPR}/anims.json'))
    em = json.load(open(f'{SPR}/anims_enemies.json'))
    report = {'idles': [], 'loco': {}}
    C = am['characters']
    orig = json.load(open('tools/fix211_orig_states.json')) if os.path.exists('tools/fix211_orig_states.json') else None
    if orig is None:                                  # remember the 2.1.0 sources once (idempotent re-runs)
        orig = {k: {n: C[k]['states'][n] for n in ('idle_signature', 'idle_personality', 'talk', 'walk', 'idle', 'run', 'sprint') if n in C[k]['states']} for k in C}
        orig['__enemies'] = {k: {n: v['states'][n] for n in LOCO if n in v['states']} for k, v in em['characters'].items()}
        json.dump(orig, open('tools/fix211_orig_states.json', 'w'))
    for k in C:
        for n, v in orig.get(k, {}).items(): C[k]['states'][n] = json.loads(json.dumps(v))
    for k, v in orig['__enemies'].items():
        for n, s in v.items(): em['characters'][k]['states'][n] = json.loads(json.dumps(s))
    for k, ch in C.items():
        S = ch['states']
        if k.startswith('matthew_') and 'idle_signature' in S and S['idle_signature']['fw'] == 480 and not str(S.get('idle', {}).get('gen', '')).startswith('joe'):
            base = S['idle_signature']
            src = cell(base['file'], base, 0)
            f1, w, h = write_strip(f'{k}_idle_jk.png', breathe(src))
            S['idle'] = loop_state(f1, w, h, N_IDLE, FPS_IDLE, 388, base)
            f2, w, h = write_strip(f'{k}_idle_signature_jk.png', breathe(src, breath=0.015, shift=4.5, sway=0.6))
            S['idle_signature'] = loop_state(f2, w, h, N_IDLE, 7, 388, base)
            report['idles'].append(k)
            if 'sprint' in S: dedupe_sprint(S['sprint'])
        elif k == 'william' and str(S['idle_personality'].get('gen', '')).startswith('joe'):
            S['talk'] = normalize_talk(orig['william']['talk'], cell(S['idle_personality']['file'], S['idle_personality'], 0))  # Joe's merged idles stay
        elif k == 'william':
            base = S['idle_personality']
            src = cell(base['file'], base, 0)
            f1, w, h = write_strip('william_idle_jk.png', breathe(src))
            S['idle_personality'] = loop_state(f1, w, h, N_IDLE, FPS_IDLE, 388, base)
            S['idle'] = dict(S['idle_personality'])
            f2, w, h = write_strip('william_idle_signature_jk.png', breathe(cell(orig['william']['idle_signature']['file'], orig['william']['idle_signature'], 0), breath=0.015, shift=4.5, sway=0.6))
            S['idle_signature'] = loop_state(f2, w, h, N_IDLE, 7, 388, base)
            S['talk'] = normalize_talk(orig['william']['talk'], cell(base['file'], base, 0))
            report['idles'].append(k)
        elif isinstance(S.get('idle_personality', {}).get('file'), str) and S['idle_personality']['file'].endswith('_cast_jk.png') and len(S['idle_personality']['frames']) == 1:
            base = S['idle_personality']
            src = cell(base['file'], base, 0)
            f1, w, h = write_strip(f'{k}_idle_jk.png', breathe(src, breath=0.010, shift=1.6))
            st = loop_state(f1, w, h, N_IDLE, FPS_IDLE, base.get('feetRow', 378), base)
            S['idle_personality'] = st
            S['idle'] = dict(st)
            if 'talk' in S: S['talk'] = dict(st, fps=10)     # talking: same body, breathing a touch quicker (mouth is the portrait)
            report['idles'].append(k)
    # anchors / feet / travel
    for man, tag in ((C, 'main'), (em['characters'], 'enemies')):
        for k, ch in man.items():
            S = ch['states']
            ref = next((S[n] for n in ('idle', 'idle_personality', 'idle_signature') if n in S and isinstance(S[n].get('file'), str) and S[n].get('frames')), None)
            if not ref: continue
            m0 = cell_metrics(cell(ref['file'], ref, 0))
            if not m0 or m0['hip'] is None: continue
            ax0 = ref['anchorX'][0] if isinstance(ref.get('anchorX'), list) else ref.get('anchorX', ref.get('fw', 288) / 2)
            R = ax0 - m0['hip']
            log = []
            for n in LOCO:
                if n in S: fix_loco(ch, n, R, log)
            report['loco'][k] = log
    print('old art left:', fill_all(am, em, report))
    for m, p in ((am, 'anims.json'), (em, 'anims_enemies.json')):
        m['rev'] = str(m.get('rev', '')).split('+')[0] + '+fix211'
        json.dump(m, open(f'{SPR}/{p}', 'w'), separators=(',', ':'))
    json.dump(report, open('/workspace/gh-up/v211/fix211_report.json', 'w'), indent=1)
    print('idles', len(report['idles']), report['idles'])


# ------------------------------------------------------------------ 2.1.1 (b): no state falls back to pre-2.1 art
def is_new(st):
    fs = st.get('file'); fs = fs if isinstance(fs, list) else [fs]
    return bool(st.get('frames')) and all(isinstance(f, str) and f.endswith('_jk.png') for f in fs)

def alias(S, name, parts, fps=None, loop=None):
    parts = [p for p in parts if p in S and (is_new(S[p]) or S[p].get('aliasOf'))]
    if not parts: return False
    old = S.get(name, {})
    st = {'aliasOf': parts, 'frames': [], 'fix211': 'alias'}
    st['loop'] = old.get('loop', False) if loop is None else loop
    if fps: st['fps'] = fps
    elif old.get('fps'): st['fps'] = old['fps']
    S[name] = st
    return True

# state -> new-art states it is built from (in order of preference); fps, loop
FILL = {
    'run': (['walk'], 12, True), 'sprint': (['walk'], 14, True), 'boss_rush': (['walk'], 14, True),
    'taunt': (['idle'], None, True), 'idle_signature': (['idle'], None, True), 'cold_stare': (['idle'], None, True),
    'stance': (['idle'], None, True), 'stare': (['idle'], None, True), 'last_word_stance': (['idle'], None, True),
    'victory': (['idle'], None, True),
    'hurt': (['hurt_high'], None, False), 'stumble': (['hurt_body'], None, False), 'caught': (['hurt_high'], None, False),
    'defeat': (['knockdown_fall', 'knockdown_ground'], None, False), 'ko': (['knockdown_fall', 'knockdown_ground'], None, False),
    'jump_kick': (['combo3'], None, False), 'special': (['combo3'], None, False), 'iron_handshake': (['combo1', 'combo3'], None, False),
    'jab1': (['combo1'], None, False), 'jab2': (['combo2'], None, False), 'jab3': (['combo3'], None, False),
    'gentlemans_jab': (['combo1'], None, False), 'grab': (['combo1'], None, False), 'whiff': (['combo1'], None, False),
    'throw': (['combo3'], None, False), 'counter': (['combo2'], None, False), 'rush': (['walk'], 14, True),
    'velvet_grip': (['combo1', 'combo3'], None, False), 'last_word': (['idle', 'combo3'], None, False), 'hs_grab': (['combo1'], None, False), 'velvet_grip_grab': (['combo1'], None, False),
    'hs_slam': (['combo3'], None, False), 'velvet_grip_throw': (['combo3'], None, False), 'last_word_strike': (['combo3'], None, False),
}

def paint_combos(E):
    """silas_c14 / silas_red have no new combo strips: paint them from silas_player's new ones (same paint-over as 2.0.0)."""
    import ast
    src = open('tools/gen_blackriver_silas.py').read()
    tree = ast.parse(src)
    keep = [n for n in tree.body if isinstance(n, (ast.Import, ast.ImportFrom, ast.FunctionDef)) or
            (isinstance(n, ast.Assign) and isinstance(n.value, ast.Call) and 'truetype' in ast.unparse(n.value))]
    ns = {}
    exec(compile(ast.Module(keep, []), 'gen_blackriver_silas', 'exec'), ns)
    C = E['characters']; base = C['silas_player']['states']; done = []
    for tag, fn in (('c14', ns['suit']), ('red', ns['red'])):
        S = C['silas_' + tag]['states']
        for n in ('combo1', 'combo2', 'combo3'):
            b = base.get(n)
            if not b or not is_new(b) or (n in S and is_new(S[n])): continue
            im = Image.open(b['file']).convert('RGBA'); out = Image.new('RGBA', im.size, (0, 0, 0, 0))
            k = len(b['frames'])
            for i in range(k):
                fw = b['sw'][i] if isinstance(b.get('sw'), list) else b['fw']; fh = b['sh'][i] if isinstance(b.get('sh'), list) else b['fh']
                sx = b['sx'][i] if isinstance(b.get('sx'), list) else b['frames'][i] * fw; sy = b['sy'][i] if isinstance(b.get('sy'), list) else 0
                out.paste(fn(im.crop((sx, sy, sx + fw, sy + fh))).convert('RGBA'), (sx, sy))
            f = b['file'].replace('silas_player_', 'silas_' + tag + '_')
            out.save(f, optimize=True)
            S[n] = dict(json.loads(json.dumps(b)), file=f)
            done.append(f)
    return done

def fill_all(am, em, report):
    report['painted'] = paint_combos(em)
    # anims.json Silas / Lockkeeper NPC looks -> Jack's new rigs of the same person
    src_of = {'silas': 'silas_boss', 'silas_prison': 'silas_older_prison', 'silas_cuffed': 'silas_c14', 'marcus_lockkeeper': 'br_lockkeeper', 'foreman': 'foreman'}
    for k, s in src_of.items():
        if k not in am['characters'] or s not in em['characters']: continue
        S, T = am['characters'][k]['states'], em['characters'][s]['states']
        for n in list(S):
            if n.startswith('cs_') or is_new(S[n]): continue
            pick = 'walk' if n in ('walk', 'run') else 'hurt_body' if n == 'stumble' else 'idle'
            if pick in T and is_new(T[pick]):
                S[n] = dict(json.loads(json.dumps(T[pick])), fix211='from ' + s)
    left = {}
    for man in (am['characters'], em['characters']):
        for k, ch in man.items():
            if k.startswith('matthew_'): continue
            S = ch['states']
            for n in list(S):
                if n.startswith('cs_') or is_new(S[n]) or S[n].get('aliasOf') and not S[n].get('frames'): continue
                if n in FILL and alias(S, n, *FILL[n]): continue
                left.setdefault(k, []).append(n)
    # 'ko' etc. already aliasing an old state resolve through the filled state; report anything still on old art
    report['old_left'] = left
    return left


if __name__ == '__main__':
    main()
