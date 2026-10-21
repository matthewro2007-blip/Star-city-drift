#!/usr/bin/env python3
"""Generate Star City Drift app icons (PWA, Apple, favicon, Electron, Android).

Composes the Matthew HUD portrait in a gold ring over a dusk sky with the
Mill Mountain star + ridge silhouette. Re-run after the portrait changes:
    python3 tools/make-icons.py
Outputs go to icons/ (game root). Only reads assets/, never writes there.
"""
import math, os
from PIL import Image, ImageDraw, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'icons')
PORTRAIT = os.path.join(ROOT, 'assets', 'sprites', 'portrait_matthew.png')
S = 1024  # master canvas

GOLD, GOLD_DEEP, GOLD_LIGHT = (255, 210, 74), (184, 134, 42), (255, 241, 184)
NIGHT, DUSK_MID, DUSK_LOW = (16, 14, 34), (92, 40, 66), (244, 140, 60)
RIDGE, RIDGE_BACK = (22, 16, 26), (48, 30, 44)


def lerp(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))


def sky(size):
    img = Image.new('RGB', (size, size))
    d = ImageDraw.Draw(img)
    for y in range(size):
        t = y / (size - 1)
        c = lerp(NIGHT, DUSK_MID, t / 0.55) if t < 0.55 else lerp(DUSK_MID, DUSK_LOW, (t - 0.55) / 0.45)
        d.line([(0, y), (size, y)], fill=c)
    return img.convert('RGBA')


def star_points(cx, cy, r_out, r_in, rot=-90):
    pts = []
    for i in range(10):
        r = r_out if i % 2 == 0 else r_in
        a = math.radians(rot + i * 36)
        pts.append((cx + r * math.cos(a), cy + r * math.sin(a)))
    return pts


def glow(size, cx, cy, r, color, alpha):
    g = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    ImageDraw.Draw(g).ellipse([cx - r, cy - r, cx + r, cy + r], fill=color + (alpha,))
    return g.filter(ImageFilter.GaussianBlur(r * 0.45))


def ridges(img, scale):
    s = img.size[0]
    d = ImageDraw.Draw(img)
    back = [(0, .80), (.18, .70), (.34, .76), (.52, .64), (.70, .73), (.86, .68), (1, .75)]
    front = [(0, .88), (.14, .82), (.30, .86), (.46, .79), (.62, .85), (.80, .80), (1, .86)]
    for pts, col in ((back, RIDGE_BACK), (front, RIDGE)):
        poly = [(x * s, s * (0.5 + (y - 0.5) * scale + (1 - scale) * 0.5)) for x, y in pts]
        d.polygon(poly + [(s, s), (0, s)], fill=col)


def draw_star(img, cx, cy, r):
    s = img.size[0]
    img.alpha_composite(glow(s, cx, cy, r * 1.9, (255, 200, 90), 150))
    d = ImageDraw.Draw(img)
    d.polygon(star_points(cx, cy, r * 1.08, r * 0.45), fill=(90, 50, 12))
    d.polygon(star_points(cx, cy, r, r * 0.41), fill=GOLD)
    d.polygon(star_points(cx, cy - r * 0.06, r * 0.62, r * 0.25), fill=GOLD_LIGHT)


def portrait_disc(diam):
    """Gold-ringed portrait medallion (like the in-game HUD portrait ring)."""
    m = Image.new('RGBA', (diam, diam), (0, 0, 0, 0))
    d = ImageDraw.Draw(m)
    ring = int(diam * 0.075)
    d.ellipse([0, 0, diam - 1, diam - 1], fill=(42, 26, 8))
    d.ellipse([ring * 0.25, ring * 0.25, diam - ring * 0.25, diam - ring * 0.25], fill=GOLD_DEEP)
    d.ellipse([ring * 0.5, ring * 0.5, diam - ring * 0.5, diam - ring * 0.5], fill=GOLD)
    inner = diam - 2 * ring
    face_bg = Image.new('RGBA', (inner, inner))
    fd = ImageDraw.Draw(face_bg)
    for y in range(inner):  # warm radial-ish backdrop as in style.css #portrait-ring
        fd.line([(0, y), (inner, y)], fill=lerp((240, 179, 106), (138, 74, 28), y / inner) + (255,))
    p = Image.open(PORTRAIT).convert('RGBA')
    k = max(1, round(inner * 1.04 / p.size[0]))
    p = p.resize((p.size[0] * k, p.size[1] * k), Image.NEAREST)
    p = p.resize((int(inner * 1.04), int(inner * 1.04)), Image.LANCZOS)
    face_bg.alpha_composite(p, (int((inner - p.size[0]) / 2), int(inner * 0.06)))
    mask = Image.new('L', (inner, inner), 0)
    ImageDraw.Draw(mask).ellipse([0, 0, inner - 1, inner - 1], fill=255)
    m.paste(face_bg, (ring, ring), mask)
    return m


def compose(safe):
    """safe = fraction of canvas the art should occupy (maskable needs ~0.8)."""
    img = sky(S)
    sc = safe
    c = S / 2
    draw_star(img, c, c - S * 0.30 * sc, S * 0.15 * sc)
    ridges(img, sc)
    diam = int(S * 0.56 * sc)
    disc = portrait_disc(diam)
    shadow = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    ox, oy = int(c - diam / 2), int(c - diam / 2 + S * 0.10 * sc)
    ImageDraw.Draw(shadow).ellipse([ox, oy + 14, ox + diam, oy + diam + 14], fill=(0, 0, 0, 140))
    img.alpha_composite(shadow.filter(ImageFilter.GaussianBlur(18)))
    img.alpha_composite(disc, (ox, oy))
    return img


def small_icon(size):
    """Favicon-scale: just the glowing gold star on night sky (readable at 16-32px)."""
    m = 256
    img = sky(m)
    draw_star(img, m / 2, m / 2 + 6, m * 0.40)
    return img.resize((size, size), Image.LANCZOS)


def rounded(img, radius_frac=0.22):
    s = img.size[0]
    mask = Image.new('L', (s, s), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, s - 1, s - 1], radius=int(s * radius_frac), fill=255)
    out = Image.new('RGBA', (s, s), (0, 0, 0, 0))
    out.paste(img, (0, 0), mask)
    return out


def main():
    os.makedirs(OUT, exist_ok=True)
    full = compose(1.0)            # full-bleed art
    mask_art = compose(0.80)       # inside maskable safe zone
    any_icon = rounded(full)
    for n in (192, 512):
        any_icon.resize((n, n), Image.LANCZOS).save(os.path.join(OUT, f'icon-{n}.png'), optimize=True)
    mask_art.resize((512, 512), Image.LANCZOS).save(os.path.join(OUT, 'icon-maskable-512.png'), optimize=True)
    mask_art.resize((192, 192), Image.LANCZOS).save(os.path.join(OUT, 'icon-maskable-192.png'), optimize=True)
    # Apple: opaque square, iOS applies its own corner mask
    full.convert('RGB').resize((180, 180), Image.LANCZOS).save(os.path.join(OUT, 'apple-touch-icon.png'), optimize=True)
    # Master 1024 for Electron/Android tooling
    any_icon.save(os.path.join(OUT, 'icon-1024.png'), optimize=True)
    mask_art.save(os.path.join(OUT, 'icon-maskable-1024.png'), optimize=True)
    # Favicons
    small_icon(32).save(os.path.join(OUT, 'favicon-32.png'))
    fav_sizes = [16, 32, 48]
    big = rounded(full).resize((256, 256), Image.LANCZOS)
    small_icon(48).save(os.path.join(OUT, 'favicon.ico'), sizes=[(s, s) for s in fav_sizes])
    # Windows .ico with large sizes (Electron exe icon)
    big.save(os.path.join(OUT, 'icon.ico'), sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)])
    print('icons written to', OUT)
    for f in sorted(os.listdir(OUT)):
        print(f'  {f}  {os.path.getsize(os.path.join(OUT, f))} B')


if __name__ == '__main__':
    main()
