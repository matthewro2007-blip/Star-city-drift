"""2.1.1: per-frame metrics of anim strips (hip centre, feet row, foot span). Used by fix211_anims.py."""
import numpy as np
from PIL import Image
_cache = {}
def load(path):
    if path not in _cache: _cache[path] = np.array(Image.open(path).convert('RGBA'))
    return _cache[path]
def longest_run_center(row):
    xs = np.nonzero(row)[0]
    if not len(xs): return None
    splits = np.split(xs, np.nonzero(np.diff(xs) > 2)[0] + 1)
    best = max(splits, key=len)
    return (best[0] + best[-1]) / 2, len(best)
def cell_metrics(a):
    m = a[..., 3] > 60
    ys = np.nonzero(m.any(1))[0]
    if not len(ys): return None
    top, bot = ys[0], ys[-1]
    h = bot - top
    cs = []
    for y in range(int(top + 0.50 * h), int(top + 0.58 * h)):
        r = longest_run_center(m[y])
        if r: cs.append(r[0])
    hip = float(np.median(cs)) if cs else None
    feet = m[max(top, bot - 12):bot + 1]
    fx = np.nonzero(feet.any(0))[0]
    return dict(top=int(top), bot=int(bot), hip=hip, fl=int(fx[0]), fr=int(fx[-1]), span=int(fx[-1] - fx[0]))
def strip_metrics(path, st):
    a = load(path)
    out = []
    n = len(st['frames'])
    for i in range(n):
        fw = st['sw'][i] if isinstance(st.get('sw'), list) else st.get('fw', 288)
        fh = st['sh'][i] if isinstance(st.get('sh'), list) else st.get('fh', 384)
        sx = st['sx'][i] if isinstance(st.get('sx'), list) else st['frames'][i] * fw
        sy = st['sy'][i] if isinstance(st.get('sy'), list) else 0
        out.append(cell_metrics(a[sy:sy + fh, sx:sx + fw]))
    return out
