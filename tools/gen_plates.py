#!/usr/bin/env python3
"""Redraw the 960x540 'narrow' area plates that were recoloured copies of one scene.

Contract kept (js/world.js PLATE_DEPTH.narrow): sidewalk 339-399, street 400-539.
Rows y >= 339 are copied unchanged from the original (<name>_v1.png) so the walkable
area and street props stay identical; only the backdrop above y=339 is redrawn,
with a signature building per area. Plates tile horizontally (edges match).
usage: gen_plates.py [names...]   (default: pages skate gym community river)
"""
import math, os, shutil, sys, random
from PIL import Image, ImageDraw, ImageFont, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BG = os.path.join(ROOT, "assets", "bg")
W, H, CUT, K = 960, 540, 339, 2
FONT = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
def F(sz): 
    try: return ImageFont.truetype(FONT, sz*K)
    except Exception: return ImageFont.load_default()

def sky(d, top, mid, bot, horizon=CUT):
    for y in range(horizon*K):
        t = y / (horizon*K)
        a, b, u = (top, mid, t/0.55) if t < 0.55 else (mid, bot, (t-0.55)/0.45)
        d.line([(0, y), (W*K, y)], fill=tuple(int(a[i]*(1-u) + b[i]*u) for i in range(3)))

def ridge(d, base, amp, col, seed, periods=(1, 2, 5)):
    pts = [(0, H*K)]
    for x in range(0, W*K + 1, 4):
        u = x / (W*K) * 2*math.pi
        y = base - amp*(0.55*math.sin(u*periods[0] + seed) + 0.3*math.sin(u*periods[1] + seed*2.1) + 0.15*math.sin(u*periods[2] + seed*0.7))
        pts.append((x, y*K))
    pts.append((W*K, H*K)); d.polygon(pts, fill=col)

def R(d, x0, y0, x1, y1, col, out=(28, 20, 22)):
    d.rectangle([x0*K, y0*K, x1*K, y1*K], fill=col, outline=out, width=K)

def windows(d, x0, y0, x1, y1, cols, rows, lit=(255, 206, 120), dark=(56, 52, 70), rnd=None, frame=(40, 32, 34)):
    rnd = rnd or random.Random(1)
    cw, ch = (x1-x0)/cols, (y1-y0)/rows
    for i in range(cols):
        for j in range(rows):
            c = lit if rnd.random() < 0.6 else dark
            R(d, x0 + i*cw + cw*0.18, y0 + j*ch + ch*0.15, x0 + (i+1)*cw - cw*0.18, y0 + (j+1)*ch - ch*0.2, c, frame)

def sign(d, x, y, text, sz, fg, bg=None, glow=None, pad=6):
    f = F(sz); bb = d.textbbox((0, 0), text, font=f); tw, th = bb[2]-bb[0], bb[3]-bb[1]
    if bg: R(d, x - pad, y - pad, x + tw/K + pad, y + th/K + pad*1.4, bg)
    d.text((x*K, y*K - bb[1]*0.2), text, font=f, fill=fg)
    return tw/K

def lamp(d, x, top=250):
    R(d, x-2, top, x+2, CUT, (40, 40, 48), (20, 20, 24))
    d.ellipse([(x-7)*K, (top-6)*K, (x+7)*K, (top+4)*K], fill=(255, 226, 150), outline=(40, 30, 20), width=K)

def tree(d, x, base, s=1.0, col=(46, 66, 52)):
    R(d, x-3*s, base-30*s, x+3*s, base, (70, 50, 36))
    for dx, dy, r in ((0, -46, 20), (-14, -36, 15), (14, -36, 15), (0, -30, 16)):
        d.ellipse([(x+dx*s-r*s)*K, (base+dy*s-r*s)*K, (x+dx*s+r*s)*K, (base+dy*s+r*s)*K], fill=col, outline=(24, 34, 28), width=K)

def star_sign(d, x, y, r, col=(255, 236, 150)):
    pts = []
    for i in range(10):
        rr = r if i % 2 == 0 else r*0.45; a = math.radians(-90 + 36*i)
        pts.append(((x + rr*math.cos(a))*K, (y + rr*math.sin(a))*K))
    d.polygon(pts, fill=col, outline=(120, 90, 40))

def base_scene(top, mid, bot, seed):
    im = Image.new("RGB", (W*K, H*K)); d = ImageDraw.Draw(im)
    sky(d, top, mid, bot)
    ridge(d, 250, 40, tuple(int(v*0.55) for v in mid), seed)            # Blue Ridge, far
    ridge(d, 285, 26, tuple(int(v*0.36) for v in mid), seed + 1.7, (2, 3, 7))
    return im, d

def mill_star(d, x=820, y=210):
    d.line([(x*K, (y+10)*K), (x*K, 262*K)], fill=(60, 56, 70), width=2*K)
    star_sign(d, x, y, 10)

# ---------------------------------------------------------------- areas
def pages():
    im, d = base_scene((44, 40, 92), (232, 120, 84), (255, 196, 120), 0.3); mill_star(d, 860, 196)
    rnd = random.Random(3)
    R(d, -4, 170, 150, CUT, (120, 74, 60)); windows(d, 14, 186, 136, 300, 3, 3, rnd=rnd)
    # Valley Pages: brick storefront, green awning, display windows w/ book stacks
    R(d, 190, 120, 650, CUT, (142, 62, 50)); R(d, 190, 112, 650, 128, (92, 44, 38))
    for x in range(196, 650, 18): d.line([(x*K, 132*K), (x*K, CUT*K)], fill=(126, 54, 44), width=K)
    windows(d, 210, 140, 630, 210, 7, 1, rnd=rnd)
    R(d, 214, 222, 626, 252, (34, 70, 52)); sign(d, 300, 226, "VALLEY PAGES", 20, (255, 226, 150))
    for i in range(12):
        x = 205 + i*37
        d.polygon([(x*K, 256*K), ((x+37)*K, 256*K), ((x+37)*K, 270*K), ((x+18)*K, 276*K), (x*K, 270*K)],
                  fill=(36, 96, 64) if i % 2 else (232, 220, 190), outline=(20, 40, 30))
    for x0 in (214, 470):
        R(d, x0, 282, x0+150, CUT-4, (255, 214, 140))
        for k in range(9):
            c = [(150, 50, 50), (40, 80, 140), (220, 180, 70), (60, 120, 80), (110, 60, 130)][k % 5]
            R(d, x0 + 8 + k*15, CUT-34 - (k % 3)*6, x0 + 20 + k*15, CUT-6, c)
    R(d, 380, 280, 450, CUT, (70, 40, 30)); R(d, 390, 290, 440, CUT, (60, 34, 26))
    R(d, 654, 60, 678, 260, (40, 28, 40)); 
    for i, ch in enumerate("BOOKS"): sign(d, 660, 72 + i*36, ch, 18, (255, 120, 200))
    R(d, 700, 200, 964, CUT, (86, 92, 120)); windows(d, 716, 214, 950, 320, 6, 3, rnd=rnd)
    lamp(d, 170); lamp(d, 690)
    return im

def skate():
    im, d = base_scene((56, 36, 96), (248, 112, 92), (255, 200, 110), 1.1); mill_star(d, 120, 200)
    rnd = random.Random(5)
    # Starboard Skate: corrugated warehouse with graffiti mural + roll-up door
    R(d, 150, 150, 760, CUT, (58, 120, 150)); R(d, 140, 138, 770, 154, (30, 60, 80))
    for x in range(154, 760, 10): d.line([(x*K, 156*K), (x*K, CUT*K)], fill=(48, 104, 132), width=K)
    R(d, 170, 168, 740, 226, (24, 26, 36)); 
    star_sign(d, 206, 197, 20, (255, 210, 74)); sign(d, 236, 176, "STARBOARD SKATE", 28, (255, 92, 70))
    for i, c in enumerate([(255, 92, 70), (255, 210, 74), (90, 220, 200), (190, 110, 240)]):     # mural stripes
        d.polygon([((170 + i*30)*K, 240*K), ((330 + i*30)*K, 240*K), ((290 + i*30)*K, (CUT-50)*K), ((130 + i*30)*K, (CUT-50)*K)], fill=c)
    R(d, 420, 240, 600, CUT, (150, 150, 156))
    for y in range(246, CUT, 8): d.line([(422*K, y*K), (598*K, y*K)], fill=(120, 120, 128), width=K)
    R(d, 630, 250, 730, CUT-6, (255, 214, 140)); 
    for k in range(5):                                                                        # decks on the wall
        R(d, 640 + k*18, 262, 652 + k*18, 318, [(231, 76, 60), (40, 40, 44), (255, 210, 74), (60, 160, 200), (240, 240, 236)][k])
    # quarter-pipe silhouette at right
    d.pieslice([(790*K, 230*K), (1010*K, 450*K)], 180, 270, fill=(120, 124, 140), outline=(30, 30, 40), width=K)
    R(d, 790, 336, 900, CUT, (120, 124, 140))
    R(d, -4, 200, 140, CUT, (96, 70, 90)); windows(d, 10, 214, 130, 320, 3, 3, rnd=rnd)
    lamp(d, 776)
    return im

def gym():
    im, d = base_scene((40, 44, 90), (226, 124, 90), (255, 190, 120), 2.2); mill_star(d, 470, 186)
    rnd = random.Random(7)
    # Valley Gym: tall brick block, big lit windows with silhouettes of racks, blue banner
    R(d, 90, 110, 640, CUT, (108, 60, 52)); R(d, 82, 100, 648, 116, (70, 40, 36))
    for y in range(120, CUT, 12): d.line([(92*K, y*K), (638*K, y*K)], fill=(96, 52, 46), width=K)
    R(d, 120, 128, 610, 170, (41, 128, 185)); sign(d, 220, 136, "VALLEY GYM", 26, (255, 255, 255))
    sign(d, 470, 142, "24/7", 16, (255, 210, 74))
    for i in range(4):
        x0 = 120 + i*124
        R(d, x0, 186, x0 + 100, 270, (255, 222, 150))
        R(d, x0 + 10, 240, x0 + 90, 246, (60, 60, 70)); 
        for xx in (x0 + 14, x0 + 82): R(d, xx - 4, 232, xx + 4, 254, (40, 40, 48))
        d.ellipse([(x0+40)*K, 206*K, (x0+60)*K, 226*K], fill=(70, 60, 70))
    R(d, 330, 282, 400, CUT, (40, 60, 90)); R(d, 340, 292, 390, CUT, (255, 222, 150))
    R(d, 670, 180, 964, CUT, (70, 78, 104)); windows(d, 690, 196, 940, 318, 6, 3, rnd=rnd)
    R(d, -4, 220, 80, CUT, (84, 60, 74))
    lamp(d, 655); lamp(d, 70)
    return im

def community():
    im, d = base_scene((48, 50, 100), (236, 140, 100), (255, 208, 140), 3.0); mill_star(d, 860, 200)
    # Community Center: low civic building, columns, green roof, garden, flag
    d.polygon([(150*K, 170*K), (480*K, 120*K), (810*K, 170*K)], fill=(60, 110, 80), outline=(24, 40, 30))
    R(d, 160, 170, 800, CUT, (226, 210, 180)); R(d, 150, 166, 810, 178, (190, 170, 140))
    sign(d, 300, 186, "STAR CITY COMMUNITY CENTER", 18, (60, 60, 80))
    for i in range(8):
        x = 190 + i*82
        R(d, x, 214, x + 14, CUT, (244, 236, 216)); R(d, x - 3, 210, x + 17, 216, (200, 186, 160))
    for i in range(7):
        x0 = 212 + i*82
        R(d, x0, 232, x0 + 52, 296, (255, 214, 140)); d.line([((x0+26)*K, 232*K), ((x0+26)*K, 296*K)], fill=(120, 100, 80), width=K)
    R(d, 446, 280, 514, CUT, (110, 70, 50)); R(d, 456, 290, 504, CUT, (255, 220, 160))
    R(d, 470, 60, 473, 120, (200, 200, 210))
    d.polygon([(473*K, 62*K), (512*K, 70*K), (473*K, 82*K)], fill=(200, 60, 60))
    for x in (60, 120, 860, 920): tree(d, x, CUT, 1.1)
    for x in range(170, 800, 16):
        d.ellipse([x*K, (CUT-14)*K, (x+14)*K, CUT*K], fill=(70, 130, 80), outline=(30, 60, 40))
        if x % 48 == 10: d.ellipse([(x+4)*K, (CUT-12)*K, (x+9)*K, (CUT-7)*K], fill=(255, 140, 180))
    return im

def river():
    im, d = base_scene((36, 40, 88), (240, 128, 90), (255, 200, 130), 4.1); mill_star(d, 180, 196)
    # Roanoke River: water band behind a railing, steel truss bridge, tree line
    for y in range(262, CUT):
        t = (y - 262) / (CUT - 262)
        d.line([(0, y*K), (W*K, y*K)], fill=(int(90 - 40*t), int(110 - 30*t), int(150 - 20*t)))
    rnd = random.Random(9)
    for _ in range(70):
        x, y = rnd.randrange(0, W), rnd.randrange(266, CUT - 4)
        d.line([(x*K, y*K), ((x + rnd.randrange(6, 20))*K, y*K)], fill=(255, 196, 130), width=K)
    for x in range(0, W, 46): tree(d, x + 20, 266, 0.8, (40, 60, 50))
    # bridge deck + truss
    R(d, -4, 220, 964, 232, (70, 76, 92))
    for x in range(0, W, 80):
        d.line([(x*K, 220*K), ((x+40)*K, 170*K), ((x+80)*K, 220*K)], fill=(96, 110, 140), width=3*K)
        d.line([((x+40)*K, 170*K), ((x+40)*K, 220*K)], fill=(96, 110, 140), width=2*K)
    d.line([(0, 170*K), (W*K, 170*K)], fill=(96, 110, 140), width=3*K)
    for x in (120, 520, 900):
        R(d, x - 12, 232, x + 12, 300, (110, 104, 100))
    sign(d, 380, 140, "ROANOKE RIVER", 18, (255, 226, 150), bg=(30, 50, 70))
    # sidewalk railing
    R(d, -4, 312, 964, 318, (60, 64, 76))
    for x in range(0, W, 24): R(d, x, 318, x + 3, CUT, (60, 64, 76))
    lamp(d, 300, 240); lamp(d, 780, 240)
    return im

AREAS = dict(pages=pages, skate=skate, gym=gym, community=community, river=river)

def build(name):
    p = os.path.join(BG, name + ".png"); bak = os.path.join(BG, name + "_v1.png")
    if not os.path.exists(bak): shutil.copy2(p, bak)
    orig = Image.open(bak).convert("RGB")
    top = AREAS[name]().resize((W, H), Image.LANCZOS)
    top.paste(orig.crop((0, CUT, W, H)), (0, CUT))              # walkable band unchanged
    top.save(p); print("plate", name, top.size)

if __name__ == "__main__":
    for n in (sys.argv[1:] or list(AREAS)): build(n)
