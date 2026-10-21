#!/usr/bin/env python3
"""1.7.0 Cinder Hollow Correctional plates (960x540). Institutional cool light; walk band matches narrow plates (sidewalk 339-399)."""
import math, os, random
from PIL import Image, ImageDraw, ImageFont, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BG = os.path.join(ROOT, "assets", "bg")
W, H, CUT, K = 960, 540, 339, 2
FONT = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"

def F(sz):
    try: return ImageFont.truetype(FONT, sz * K)
    except Exception: return ImageFont.load_default()

def sky(d, top, mid, bot, horizon=CUT):
    for y in range(horizon * K):
        t = y / (horizon * K)
        a, b, u = (top, mid, t / 0.55) if t < 0.55 else (mid, bot, (t - 0.55) / 0.45)
        d.line([(0, y), (W * K, y)], fill=tuple(int(a[i] * (1 - u) + b[i] * u) for i in range(3)))

def R(d, x0, y0, x1, y1, col, out=(28, 24, 30)):
    d.rectangle([x0 * K, y0 * K, x1 * K, y1 * K], fill=col, outline=out, width=K)

def windows(d, x0, y0, x1, y1, cols, rows, lit=(180, 210, 230), dark=(40, 48, 58), rnd=None, frame=(50, 55, 65)):
    rnd = rnd or random.Random(1)
    cw, ch = (x1 - x0) / cols, (y1 - y0) / rows
    for i in range(cols):
        for j in range(rows):
            c = lit if rnd.random() < 0.55 else dark
            R(d, x0 + i * cw + cw * 0.18, y0 + j * ch + ch * 0.15,
              x0 + (i + 1) * cw - cw * 0.18, y0 + (j + 1) * ch - ch * 0.2, c, frame)

def sign(d, x, y, text, sz, fg, bg=None, pad=6):
    f = F(sz); bb = d.textbbox((0, 0), text, font=f); tw, th = bb[2] - bb[0], bb[3] - bb[1]
    if bg: R(d, x - pad, y - pad, x + tw / K + pad, y + th / K + pad * 1.4, bg)
    d.text((x * K, y * K - bb[1] * 0.2), text, font=f, fill=fg)
    return tw / K

def floor_band(img, top_col, bot_col):
    d = ImageDraw.Draw(img)
    for y in range(CUT * K, H * K):
        t = (y - CUT * K) / max(1, H * K - CUT * K)
        c = tuple(int(top_col[i] * (1 - t) + bot_col[i] * t) for i in range(3))
        d.line([(0, y), (W * K, y)], fill=c)
    # sidewalk strip
    for y in range(CUT * K, int(399 * K)):
        d.line([(0, y), (W * K, y)], fill=(92, 96, 104))
    # floor tiles hint
    dd = ImageDraw.Draw(img)
    for x in range(0, W * K, 48):
        dd.line([(x, CUT * K), (x, H * K)], fill=(70, 74, 82), width=1)

def lamp(d, x, top=250, glow=(190, 210, 230)):
    R(d, x - 2, top, x + 2, CUT, (50, 54, 62), (20, 20, 24))
    d.ellipse([(x - 8) * K, (top - 6) * K, (x + 8) * K, (top + 4) * K], fill=glow, outline=(40, 40, 48), width=K)

def save(name, fn):
    img = Image.new("RGB", (W * K, H * K), (30, 34, 42))
    fn(img)
    out = img.resize((W, H), Image.LANCZOS)
    path = os.path.join(BG, name + ".png")
    out.save(path)
    print("plate", name, path)

def lobby(img):
    d = ImageDraw.Draw(img); rnd = random.Random(17)
    sky(d, (48, 58, 78), (70, 84, 108), (90, 100, 118))
    # outer wall + fence silhouette
    R(d, 0, 180, 960, CUT, (58, 64, 76))
    for x in range(40, 920, 28):
        R(d, x, 160, x + 4, CUT, (70, 76, 88))
    R(d, 180, 120, 780, CUT, (72, 78, 92))  # main building
    windows(d, 210, 140, 750, 280, 8, 3, lit=(170, 200, 220), dark=(36, 44, 56), rnd=rnd)
    R(d, 420, 250, 540, CUT, (40, 44, 54))  # doors
    R(d, 430, 260, 470, CUT - 10, (90, 100, 120))
    R(d, 490, 260, 530, CUT - 10, (90, 100, 120))
    sign(d, 250, 100, "CINDER HOLLOW CORRECTIONAL", 18, (220, 230, 240), (32, 40, 56))
    sign(d, 430, 210, "VISITORS", 14, (240, 210, 90), (40, 48, 60))
    floor_band(img, (80, 84, 92), (48, 52, 60))
    lamp(d, 160); lamp(d, 800)
    # desk
    R(d, 100, 300, 280, CUT, (90, 70, 50))
    R(d, 700, 295, 860, CUT, (70, 78, 90))  # metal detector frame
    R(d, 720, 300, 840, CUT - 5, (50, 56, 68))

def block(img):
    d = ImageDraw.Draw(img); rnd = random.Random(31)
    sky(d, (36, 40, 52), (48, 54, 68), (60, 66, 80))
    R(d, 0, 80, 960, CUT, (64, 70, 84))
    # two tiers of cells
    for tier, y0 in enumerate((100, 210)):
        for i in range(6):
            x0 = 40 + i * 150
            R(d, x0, y0, x0 + 130, y0 + 95, (52, 58, 72))
            # bars
            for bx in range(x0 + 10, x0 + 120, 12):
                R(d, bx, y0 + 10, bx + 3, y0 + 85, (120, 128, 140))
            R(d, x0 + 8, y0 + 8, x0 + 122, y0 + 12, (100, 108, 120))
            if True:  # C-14 (Silas) is drawn in world space by the game, behind him
                sign(d, x0 + 40, y0 + 40, f"{'A' if tier==0 else 'C'}-{i+1}", 11, (180, 190, 200))
    # catwalk
    R(d, 0, 198, 960, 210, (90, 96, 110))
    for x in range(30, 930, 60):
        R(d, x, 210, x + 6, CUT, (80, 86, 100))
    floor_band(img, (70, 74, 84), (42, 46, 56))
    lamp(d, 120, 90, (200, 210, 220)); lamp(d, 480, 90); lamp(d, 840, 90)

def yard(img):
    d = ImageDraw.Draw(img); rnd = random.Random(44)
    sky(d, (70, 90, 120), (100, 120, 150), (130, 140, 160))
    # fence
    R(d, 0, 160, 960, CUT, (50, 90, 55))  # grass hint behind fence line
    for x in range(20, 940, 18):
        R(d, x, 140, x + 3, CUT, (100, 110, 120))
    R(d, 0, 140, 960, 148, (110, 120, 130))
    # basketball hoop
    R(d, 700, 180, 710, CUT, (80, 80, 90))
    d.ellipse([(680) * K, (160) * K, (730) * K, (200) * K], outline=(220, 220, 230), width=2 * K)
    # bleachers
    for i, y in enumerate((260, 280, 300)):
        R(d, 80, y, 320, y + 16, (90, 70, 55))
    # tower
    R(d, 40, 100, 100, CUT, (70, 76, 88))
    windows(d, 50, 120, 90, 200, 1, 2, lit=(255, 220, 140), dark=(40, 40, 50), rnd=rnd)
    sign(d, 360, 110, "REC YARD", 16, (230, 235, 240), (40, 50, 60))
    floor_band(img, (70, 100, 60), (50, 70, 45))
    # asphalt court patch
    R(d, 400, 360, 880, 500, (70, 72, 78))
    lamp(d, 200); lamp(d, 600)

def mess(img):
    d = ImageDraw.Draw(img); rnd = random.Random(55)
    sky(d, (50, 55, 65), (70, 76, 88), (90, 96, 108))
    R(d, 0, 100, 960, CUT, (78, 82, 92))
    # serving line
    R(d, 40, 180, 300, CUT, (100, 104, 114))
    R(d, 60, 200, 280, 280, (60, 64, 74))
    sign(d, 90, 150, "SERVING LINE", 12, (240, 240, 240), (40, 44, 54))
    # tables
    for i, x in enumerate((360, 560, 760)):
        R(d, x, 280, x + 140, 310, (90, 70, 50))
        R(d, x + 20, 310, x + 30, CUT, (70, 55, 40))
        R(d, x + 110, 310, x + 120, CUT, (70, 55, 40))
    windows(d, 320, 110, 900, 200, 6, 2, lit=(200, 210, 220), dark=(40, 48, 58), rnd=rnd)
    floor_band(img, (88, 90, 98), (55, 58, 66))
    lamp(d, 180); lamp(d, 500); lamp(d, 820)

def library(img):
    d = ImageDraw.Draw(img); rnd = random.Random(66)
    sky(d, (55, 60, 72), (75, 82, 96), (95, 100, 112))
    R(d, 0, 90, 960, CUT, (82, 70, 58))
    # shelves
    for i, x in enumerate((40, 180, 320, 700, 840)):
        R(d, x, 110, x + 110, CUT, (90, 60, 40))
        for y in range(130, 300, 35):
            R(d, x + 6, y, x + 104, y + 28, (70, 48, 32))
            for bx in range(x + 10, x + 100, 14):
                col = (rnd.randint(60, 180), rnd.randint(40, 100), rnd.randint(40, 120))
                R(d, bx, y + 4, bx + 10, y + 24, col)
    # reading table
    R(d, 460, 280, 640, 310, (110, 85, 55))
    R(d, 480, 310, 490, CUT, (80, 60, 40)); R(d, 610, 310, 620, CUT, (80, 60, 40))
    sign(d, 480, 120, "LIBRARY", 16, (240, 230, 200), (50, 40, 30))
    floor_band(img, (100, 90, 75), (70, 62, 50))
    lamp(d, 250, 100, (255, 220, 160)); lamp(d, 700, 100, (255, 220, 160))

def shop(img):
    d = ImageDraw.Draw(img); rnd = random.Random(77)
    sky(d, (45, 50, 60), (65, 70, 82), (85, 90, 100))
    R(d, 0, 100, 960, CUT, (70, 74, 84))
    # workbenches
    for x in (80, 320, 560, 780):
        R(d, x, 260, x + 140, 300, (90, 92, 100))
        R(d, x + 10, 300, x + 20, CUT, (60, 62, 70)); R(d, x + 120, 300, x + 130, CUT, (60, 62, 70))
    # tool wall
    R(d, 40, 120, 280, 240, (55, 58, 68))
    for i, x in enumerate(range(60, 260, 30)):
        R(d, x, 140, x + 8, 220, (140, 140, 150))
    sign(d, 360, 120, "WORKSHOP", 16, (230, 230, 235), (40, 44, 54))
    # wood crates
    R(d, 700, 220, 820, CUT, (130, 100, 60))
    windows(d, 500, 110, 680, 200, 3, 2, lit=(200, 200, 160), dark=(40, 40, 50), rnd=rnd)
    floor_band(img, (75, 78, 86), (48, 50, 58))
    lamp(d, 200); lamp(d, 600); lamp(d, 880)

PLATES = {
    "prison_lobby": lobby,
    "prison_block": block,
    "prison_yard": yard,
    "prison_mess": mess,
    "prison_library": library,
    "prison_shop": shop,
}

if __name__ == "__main__":
    os.makedirs(BG, exist_ok=True)
    for n, fn in PLATES.items():
        save(n, fn)
    print("done", len(PLATES))
