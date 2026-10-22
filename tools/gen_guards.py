"""2.0.1 Blackriver guards + Voss + Lockkeeper: derived HD sheets from Jack's foreman_crew / foreman art.
Per frame: classify palette (hat / hi-vis / reflective / denim / skin / brown), split brown into
gloves+boots (small blobs) vs coat (large blobs), recolour with luminance-preserving ramps, add props.
Writes assets/sprites/<key>_hd_anim(.png|_wide.png) and adds <key> to anims_enemies.json."""
import json, sys, copy, numpy as np
from PIL import Image, ImageDraw, ImageFilter
from scipy import ndimage
ROOT = '/workspace/roanoke-open-world-2d/'
MAN = ROOT + 'assets/sprites/anims_enemies.json'
OUTL = (14, 10, 16, 255)

def hsv(a):
    rgb = a[..., :3] / 255.0; mx = rgb.max(-1); mn = rgb.min(-1); d = np.maximum(mx - mn, 1e-6)
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    h = np.where(mx == r, ((g - b) / d) % 6, np.where(mx == g, (b - r) / d + 2, (r - g) / d + 4)) * 60
    s = np.where(mx > 0, (mx - mn) / np.maximum(mx, 1e-6), 0)
    return h, s, mx

def classes(a):
    h, s, v = hsv(a); vis = a[..., 3] > 76
    dark = v < 0.11
    hat_y = vis & (h > 38) & (h < 62) & (s > 0.45) & (v > 0.35)
    hat_w = vis & (s < 0.18) & (v > 0.72)
    orange = vis & (h > 12) & (h < 38) & (s > 0.65) & (v > 0.55)
    grey = vis & (s < 0.22) & (v > 0.3) & ~dark & ~hat_w
    blue = vis & (h > 195) & (h < 265) & ~dark
    warm = vis & ~hat_y & ~hat_w & ~orange & ~grey & ~dark & ~blue
    skin = warm & (v > 0.45)
    brown = warm & ~skin
    return dict(vis=vis, dark=dark, hat_y=hat_y, hat_w=hat_w, orange=orange, grey=grey, blue=blue, skin=skin, brown=brown)

def hx(c):
    c = c.lstrip('#'); return np.array([int(c[i:i + 2], 16) for i in (0, 2, 4)], float)

def ramp(a, m, col, ref):
    if col is None: return
    v = a[..., :3].max(-1) / 255.0
    k = np.clip(v / ref, 0.35, 1.9)[..., None]
    a[..., :3] = np.where(m[..., None], np.clip(hx(col) * k, 0, 255), a[..., :3])

def small_blobs(m, maxarea):
    lab, n = ndimage.label(m); out = np.zeros_like(m)
    if n == 0: return out
    areas = ndimage.sum(m, lab, range(1, n + 1))
    for i, ar in enumerate(areas, 1):
        if ar <= maxarea: out |= lab == i
    return out

def largest(m):
    lab, n = ndimage.label(m)
    if n == 0: return m & False
    ar = ndimage.sum(m, lab, range(1, n + 1)); return lab == (int(np.argmax(ar)) + 1)

def outlined(size, fn, w=3):
    lay = Image.new('RGBA', size, (0, 0, 0, 0)); fn(ImageDraw.Draw(lay))
    al = lay.split()[3].filter(ImageFilter.MaxFilter(2 * w + 1))
    ink = Image.new('RGBA', size, OUTL); ink.putalpha(al)
    out = Image.new('RGBA', size, (0, 0, 0, 0)); out.alpha_composite(ink); out.alpha_composite(lay); return out

def bbox(m):
    ys, xs = np.where(m)
    return None if not len(xs) else (xs.min(), ys.min(), xs.max(), ys.max())

def badge(d, x, y, col='#d8b24a', r=6):
    d.polygon([(x, y - r - 1), (x + r, y - r // 3), (x + r * 2 // 3, y + r), (x - r * 2 // 3, y + r), (x - r, y - r // 3)], fill=col)

# ---------------------------------------------------------------- variants
V = {
  'guard_co':    dict(src='foreman_crew', coat='#5d7386', trous='#232a3a', hat='#202838', gear='#1c1c22', stripe='#3c4b5a', refl='#9aa7b3', skin=None, cap='peaked', crown='#232c3e', band='#151a26', badge='#d8b24a'),
  'guard_riot':  dict(src='foreman_crew', coat='#3b4048', trous='#1f232b', hat='#15171c', gear='#111114', stripe='#596270', refl='#6c7684', cap='helmet', shield=True),
  'guard_baton': dict(src='foreman_crew', coat='#7e93a3', trous='#2b3140', hat='#3d4b5a', gear='#1a1a1f', stripe='#55687a', refl='#c9d2da', cap=None, baton=True, lean=0.9),
  'guard_sgt':   dict(src='foreman_crew', coat='#2d3a55', trous='#1b2133', hat='#ecebe4', gear='#16161b', stripe='#d8b24a', refl='#d8b24a', cap='peaked', crown='#ecebe4', band='#d8b24a', badge='#d8b24a'),
  'br_voss':     dict(src='foreman', coat='#5a1f24', vest='#2f3033', trous='#2a2622', hat='#4a4038', gear='#1a1714', refl='#5b5148', keyring=True),
  'br_lockkeeper': dict(src='foreman', coat='#202127', vest='#121316', trous='#18191d', hat='#121316', gear='#0e0e10', refl='#b8963e', keyring=True, ringcol='#b8963e'),
}

def process_frame(fr, cfg, state, lying, i):
    a = np.array(fr).astype(float); C = classes(a)
    if not C['vis'].any(): return fr
    hraw = C['hat_y'] if cfg['src'] == 'foreman_crew' else C['hat_w']
    hatm = largest(hraw)
    if hatm.any():  # keep every hat-coloured pixel near the main hat blob (brim pieces split by ink lines)
        near = ndimage.binary_dilation(hatm, iterations=22); hatm = hraw & near
    # skin blobs away from the head are the work gloves (tan leather): they become uniform gear too
    glove_skin = np.zeros_like(C['skin']); hb0 = bbox(hatm)
    if hb0:
        lab, n = ndimage.label(C['skin'])
        hcx, hcy = (hb0[0] + hb0[2]) / 2, (hb0[1] + hb0[3]) / 2
        comps = [(k, ndimage.center_of_mass(lab == k), (lab == k).sum()) for k in range(1, n + 1)]
        for k, cm, ar in comps:
            if ((cm[1] - hcx) ** 2 + (cm[0] - hcy) ** 2) ** 0.5 > 62 and ar < 2500: glove_skin |= lab == k
    vb = bbox(C['vis']); yy = np.arange(a.shape[0])[:, None]
    boots = small_blobs(C['brown'], 2500) & (yy > vb[1] + (vb[3] - vb[1]) * 0.86) if (vb and not lying) else np.zeros_like(C['brown'])
    fistb = small_blobs(C['brown'], 650) & (yy < vb[1] + (vb[3] - vb[1]) * 0.62) if vb else np.zeros_like(C['brown'])
    small = boots | glove_skin | fistb
    coat = C['brown'] & ~small
    ramp(a, coat, cfg['coat'], 0.30)
    ramp(a, small, cfg['gear'], 0.32)
    ramp(a, C['blue'], cfg['trous'], 0.22)
    ramp(a, hatm, cfg['hat'], 0.85 if cfg['src'] == 'foreman' else 0.75)
    if cfg['src'] == 'foreman_crew':
        ramp(a, C['orange'], cfg.get('stripe'), 0.75)
        ramp(a, C['grey'], cfg.get('refl'), 0.6)
    else:  # Foreman frame: the hi-vis vest becomes the coat/vest colour, reflective tape becomes trim
        ramp(a, C['orange'], cfg.get('vest'), 0.85)
        ramp(a, C['grey'] & (a[..., :3].max(-1) > 200), cfg.get('refl'), 0.9)
    im = Image.fromarray(a.clip(0, 255).astype(np.uint8))
    W, H = im.size; hb = bbox(hatm); upright = not lying and state not in ('ko', 'knockdown_fall', 'knockdown_ground', 'defeat')
    gl = bbox(small & (np.arange(H)[:, None] < H * 0.62)) if upright else None
    lab, n = ndimage.label(small & (np.arange(H)[:, None] < H * 0.62))
    fists = [bbox(lab == k) for k in range(1, n + 1)] if upright else []
    fists = [f for f in fists if f and (f[2] - f[0]) * (f[3] - f[1]) > 150]
    front = max(fists, key=lambda f: f[2]) if fists else None
    def props(d):
        if hb and upright and hb[2] - hb[0] > 30:
            x0, y0, x1, y1 = hb
            if cfg.get('cap') == 'peaked':
                d.polygon([(x0 - 4, y0 + 8), (x1 + 2, y0 - 2), (x1 + 4, y1 - 4), (x0 - 2, y1 + 2)], fill=cfg['crown'])
                d.polygon([(x0 + 2, y1 - 8), (x1 + 2, y1 - 14), (x1 + 4, y1 - 2), (x0 + 4, y1 + 2)], fill=cfg['band'])
                d.polygon([(x1 - 18, y1 - 6), (x1 + 20, y1 - 2), (x1 + 14, y1 + 6), (x1 - 20, y1 + 4)], fill='#0d1018')
                badge(d, x1 - 10, y0 + 12, cfg['badge'], 6)
            elif cfg.get('cap') == 'helmet':
                d.polygon([(x0 + (x1 - x0) * 0.45, y1 - 2), (x1 + 6, y1 - 4), (x1 + 8, y1 + 28), (x0 + (x1 - x0) * 0.5, y1 + 32)], fill=(60, 80, 96, 170))
        if cfg.get('shield') and front and upright:
            fx = (front[0] + front[2]) // 2; fy = (front[1] + front[3]) // 2
            d.rounded_rectangle((fx - 24, fy - 30, fx + 52, fy + 136), radius=14, fill=(148, 170, 186, 150))
            d.rectangle((fx - 16, fy - 16, fx + 44, fy - 2), fill=(230, 236, 240, 170))
            d.text((fx - 12, fy - 15), 'C.H.C.F.', fill=(20, 24, 30, 255))
        if cfg.get('baton') and front and upright:
            fx = (front[0] + front[2]) // 2; fy = (front[1] + front[3]) // 2
            atk = state.startswith('attack')
            dx, dy = ((46, -10) if atk else (16, 50))
            d.line([(fx, fy), (fx + dx * 2, fy + dy * 2)], fill='#16161b', width=8)
        if cfg.get('keyring') and upright:
            bm = largest(C['blue']); bb = bbox(bm)
            if bb:
                cx = (bb[0] + bb[2]) // 2 + 6; cy = bb[1] + 4
                col = cfg.get('ringcol', '#c9a24a')
                d.ellipse((cx - 14, cy - 2, cx + 14, cy + 26), outline=col, width=4)
                for k in range(3): d.rectangle((cx - 7 + k * 6, cy + 24, cx - 4 + k * 6, cy + 38), fill=col)
    lay = outlined(im.size, props, 3)
    im.alpha_composite(lay)
    if cfg.get('lean'):  # narrower build: squeeze around the frame's horizontal centre
        s = cfg['lean']; nw = round(W * s); sq = im.resize((nw, H), Image.LANCZOS)
        out = Image.new('RGBA', (W, H), (0, 0, 0, 0)); out.alpha_composite(sq, ((W - nw) // 2, 0)); im = out
    return im

def build(key, cfg, man):
    src = man['characters'][cfg['src']]
    files = {}
    def get(f):
        if f not in files: files[f] = Image.open(ROOT + f).convert('RGBA')
        return files[f]
    outs = {}
    def out_for(f):
        nf = f.replace(cfg['src'] + '_hd_anim', key + '_hd_anim')
        if nf not in outs: outs[nf] = Image.new('RGBA', get(f).size, (0, 0, 0, 0))
        return nf
    ent = copy.deepcopy(src)
    for k in ('file', 'wideFile'):
        if k in ent: ent[k] = ent[k].replace(cfg['src'] + '_hd_anim', key + '_hd_anim')
    for st, sd in src['states'].items():
        if 'frames' not in sd: continue
        fl = sd.get('file', src['file']); n = len(sd['frames'])
        for i in range(n):
            f = fl[i] if isinstance(fl, list) else fl
            sx, sy, sw, sh = sd['sx'][i], sd['sy'][i], sd['sw'][i], sd['sh'][i]
            fr = get(f).crop((sx, sy, sx + sw, sy + sh))
            nf = out_for(f)
            outs[nf].paste(process_frame(fr, cfg, st, sd['lying'][i], i), (sx, sy))
        if 'file' in sd:
            ent['states'][st]['file'] = [x.replace(cfg['src'] + '_hd_anim', key + '_hd_anim') for x in fl] if isinstance(fl, list) else fl.replace(cfg['src'] + '_hd_anim', key + '_hd_anim')
    for nf, im in outs.items(): im.save(ROOT + nf, optimize=True)
    man['characters'][key] = ent
    return list(outs)

if __name__ == '__main__':
    man = json.load(open(MAN))
    keys = sys.argv[1:] or list(V)
    for k in keys: print(k, build(k, V[k], man))
    json.dump(man, open(MAN, 'w'), separators=(',', ':'))
