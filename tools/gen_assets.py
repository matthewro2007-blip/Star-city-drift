#!/usr/bin/env python3
"""Generate concept-matching sprite + background PNGs for Star City Drift 2D."""
from PIL import Image, ImageDraw, ImageFont
import os, math

ROOT = "/workspace/roanoke-open-world-2d/assets"
SPR = os.path.join(ROOT, "sprites")
BG = os.path.join(ROOT, "bg")
os.makedirs(SPR, exist_ok=True)
os.makedirs(BG, exist_ok=True)

def scale_nn(im, s):
    return im.resize((im.width * s, im.height * s), Image.NEAREST)

def draw_matthew_frame(pose="idle"):
    """Buzz cut, mustache, soul patch, white shirt, ripped jeans, brown boots, SoR stance."""
    W, H = 48, 64
    im = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    skin = (240, 212, 188, 255)
    skin2 = (212, 176, 154, 255)
    hair = (26, 18, 16, 255)
    facial = (26, 18, 16, 255)
    shirt = (250, 250, 248, 255)
    shirt2 = (220, 220, 218, 255)
    jeans = (90, 122, 168, 255)
    belt = (120, 72, 40, 255)
    boot = (90, 55, 30, 255)
    boot2 = (60, 35, 18, 255)

    punch = pose == "punch"
    kick = pose == "kick"
    walk = pose == "walk"
    walk2 = pose == "walk2"
    hurt = pose == "hurt"

    legL = 3 if walk else (-3 if walk2 else 0)
    legR = -3 if walk else (3 if walk2 else 0)
    tx = 3 if punch else (-2 if hurt else 0)

    d.ellipse([10, 58, 38, 63], fill=(0, 0, 0, 70))

    d.rectangle([14, 38 + legL, 20, 52 + legL], fill=jeans)
    d.rectangle([13, 50 + legL, 22, 56 + legL], fill=boot)
    d.rectangle([13, 54 + legL, 22, 57 + legL], fill=boot2)
    if kick:
        d.rectangle([24, 40, 42, 46], fill=jeans)
        d.rectangle([40, 39, 47, 48], fill=boot)
    else:
        d.rectangle([22, 38 + legR, 28, 52 + legR], fill=jeans)
        d.rectangle([21, 50 + legR, 30, 56 + legR], fill=boot)
        d.rectangle([21, 54 + legR, 30, 57 + legR], fill=boot2)
    d.rectangle([15, 44, 18, 47], fill=skin)
    d.rectangle([23, 46, 26, 48], fill=skin)

    d.rectangle([13 + tx, 22, 31 + tx, 40], fill=shirt)
    d.rectangle([13 + tx, 35, 31 + tx, 40], fill=shirt2)
    d.polygon([(17 + tx, 22), (22 + tx, 26), (27 + tx, 22)], fill=shirt2)
    for by in (26, 30, 34):
        d.ellipse([21 + tx, by, 23 + tx, by + 2], fill=(190, 190, 188, 255))
    d.rectangle([13 + tx, 39, 31 + tx, 42], fill=belt)
    d.rectangle([21 + tx, 39, 24 + tx, 42], fill=(200, 160, 60, 255))

    if punch:
        d.rectangle([8 + tx, 24, 14 + tx, 36], fill=skin)
        d.rectangle([8 + tx, 24, 14 + tx, 28], fill=shirt)
        d.rectangle([28 + tx, 24, 42 + tx, 30], fill=skin)
        d.rectangle([28 + tx, 24, 32 + tx, 30], fill=shirt)
        d.ellipse([38 + tx, 21, 47 + tx, 32], fill=skin2)
    else:
        d.rectangle([7 + tx, 22, 13 + tx, 34], fill=skin)
        d.rectangle([7 + tx, 22, 13 + tx, 27], fill=shirt)
        d.ellipse([5 + tx, 16, 14 + tx, 25], fill=skin)
        d.rectangle([31 + tx, 20, 37 + tx, 32], fill=skin)
        d.rectangle([29 + tx, 22, 35 + tx, 27], fill=shirt)
        d.ellipse([31 + tx, 14, 40 + tx, 23], fill=skin2)

    d.rectangle([20 + tx, 18, 26 + tx, 23], fill=skin)
    hx = 15 + tx
    d.ellipse([hx, 4, hx + 16, 22], fill=skin)
    d.ellipse([hx - 2, 10, hx + 2, 16], fill=skin2)
    d.ellipse([hx + 14, 10, hx + 18, 16], fill=skin2)
    d.ellipse([hx, 3, hx + 16, 12], fill=hair)
    d.rectangle([hx, 8, hx + 16, 11], fill=hair)
    d.rectangle([hx + 2, 9, hx + 6, 11], fill=facial)
    d.rectangle([hx + 10, 9, hx + 14, 11], fill=facial)
    d.rectangle([hx + 3, 11, hx + 6, 14], fill=(240, 236, 228, 255))
    d.rectangle([hx + 10, 11, hx + 13, 14], fill=(240, 236, 228, 255))
    d.rectangle([hx + 4, 12, hx + 6, 14], fill=(26, 21, 16, 255))
    d.rectangle([hx + 11, 12, hx + 13, 14], fill=(26, 21, 16, 255))
    d.rectangle([hx + 7, 13, hx + 9, 16], fill=skin2)
    d.rectangle([hx + 3, 16, hx + 13, 18], fill=facial)
    d.rectangle([hx + 7, 18, hx + 9, 21], fill=facial)
    return im

def sheet_matthew():
    poses = ["idle", "idle2", "walk", "walk2", "punch", "punch2", "kick", "hurt"]
    cell_w, cell_h = 48, 64
    sheet = Image.new("RGBA", (cell_w * len(poses), cell_h), (0, 0, 0, 0))
    for i, p in enumerate(poses):
        src = "idle" if p == "idle2" else ("punch" if p == "punch2" else p)
        fr = draw_matthew_frame(src)
        if p == "idle2":
            fr2 = Image.new("RGBA", (cell_w, cell_h), (0, 0, 0, 0))
            fr2.paste(fr, (0, -1), fr)
            fr = fr2
        if p == "punch2":
            fr = draw_matthew_frame("punch")
        sheet.paste(fr, (i * cell_w, 0), fr)
    scale_nn(sheet, 3).save(os.path.join(SPR, "matthew_sheet.png"))
    scale_nn(draw_matthew_frame("idle"), 4).save(os.path.join(SPR, "matthew_idle.png"))
    print("matthew sheet ok")

def draw_npc(color, boss=False):
    W, H = 48, 64
    im = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    skin = (196, 164, 132, 255)
    pants = (44, 62, 80, 255)
    shoe = (26, 26, 30, 255)
    d.ellipse([10, 58, 38, 63], fill=(0, 0, 0, 70))
    d.rectangle([14, 38, 20, 52], fill=pants)
    d.rectangle([22, 38, 28, 52], fill=pants)
    d.rectangle([13, 50, 21, 56], fill=shoe)
    d.rectangle([21, 50, 29, 56], fill=shoe)
    shirt = color + (255,)
    if boss:
        d.rectangle([12, 20, 32, 40], fill=(26, 37, 53, 255))
        d.rectangle([14, 22, 30, 38], fill=shirt)
    else:
        d.rectangle([13, 22, 31, 40], fill=shirt)
    d.rectangle([20, 18, 26, 23], fill=skin)
    d.ellipse([15, 4, 31, 22], fill=skin)
    hair = (42, 32, 28, 255) if not boss else (44, 62, 80, 255)
    d.ellipse([15, 3, 31, 12], fill=hair)
    d.rectangle([18, 11, 21, 14], fill=(240, 236, 228, 255))
    d.rectangle([24, 11, 27, 14], fill=(240, 236, 228, 255))
    # casual arms
    d.rectangle([8, 24, 13, 36], fill=skin)
    d.rectangle([31, 24, 36, 36], fill=skin)
    return im

def sheet_cast():
    colors = {
        "dee": (211, 84, 0),
        "priya": (142, 68, 173),
        "hank": (127, 140, 141),
        "june": (39, 174, 96),
        "tessa": (231, 76, 60),
        "coach": (41, 128, 185),
        "cam": (241, 196, 15),
        "silas": (44, 62, 80),
        "thug_purple": (142, 68, 173),
        "thug_red": (192, 57, 43),
        "thug_teal": (22, 160, 133),
    }
    for name, col in colors.items():
        im = scale_nn(draw_npc(col, boss=(name == "silas")), 3)
        im.save(os.path.join(SPR, f"{name}.png"))
    print("cast sprites ok")

def make_bg_diner():
    W, H = 960, 540
    im = Image.new("RGBA", (W, H), (40, 50, 70, 255))
    d = ImageDraw.Draw(im)
    for y in range(0, 280):
        t = y / 280.0
        r = int(244 * (1 - t) + 40 * t)
        g = int(162 * (1 - t) + 50 * t)
        b = int(97 * (1 - t) + 80 * t)
        if t > 0.5:
            u = (t - 0.5) / 0.5
            r = int(r * (1 - u) + 25 * u)
            g = int(g * (1 - u) + 35 * u)
            b = int(b * (1 - u) + 55 * u)
        d.line([(0, y), (W, y)], fill=(r, g, b, 255))

    for rad, a in ((90, 28), (55, 50), (28, 120)):
        overlay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        ImageDraw.Draw(overlay).ellipse([700 - rad, 70 - rad, 700 + rad, 70 + rad], fill=(255, 200, 80, a))
        im = Image.alpha_composite(im, overlay)

    d = ImageDraw.Draw(im)
    d.polygon([(180, 280), (400, 115), (620, 280)], fill=(45, 55, 70, 255))
    d.polygon([(420, 280), (580, 145), (800, 280)], fill=(35, 45, 60, 255))

    cx, cy = 480, 125
    for rad, a in ((45, 40), (22, 100)):
        overlay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        ImageDraw.Draw(overlay).ellipse([cx - rad, cy - rad, cx + rad, cy + rad], fill=(255, 240, 200, a))
        im = Image.alpha_composite(im, overlay)
    d = ImageDraw.Draw(im)
    pts = []
    for i in range(10):
        ang = math.radians(-90 + i * 36)
        rr = 22 if i % 2 == 0 else 10
        pts.append((cx + math.cos(ang) * rr, cy + math.sin(ang) * rr))
    d.polygon(pts, fill=(255, 245, 200, 255))

    for bx, bw, bh in [(0, 90, 100), (100, 70, 130), (180, 80, 90), (620, 80, 120), (720, 100, 100), (850, 110, 140)]:
        d.rectangle([bx, 280 - bh, bx + bw, 280], fill=(55, 45, 50, 255))
        for wy in range(280 - bh + 10, 270, 22):
            for wx in range(bx + 8, bx + bw - 8, 18):
                lit = (wx + wy) % 36 < 20
                d.rectangle([wx, wy, wx + 8, wy + 12], fill=(255, 200, 100, 255) if lit else (40, 35, 40, 255))

    d.rectangle([20, 160, 280, 340], fill=(140, 55, 45, 255))
    d.rectangle([20, 160, 280, 200], fill=(100, 35, 30, 255))
    d.rectangle([40, 128, 250, 168], fill=(40, 10, 10, 255))
    try:
        font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 28)
        font_sm = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 14)
    except Exception:
        font = ImageFont.load_default()
        font_sm = font
    d.text((70, 133), "DINER", fill=(255, 70, 70, 255), font=font)
    d.rectangle([40, 165, 250, 169], fill=(255, 90, 90, 255))
    for i in range(0, 240, 20):
        col = (220, 40, 40, 255) if (i // 20) % 2 == 0 else (240, 240, 240, 255)
        d.rectangle([30 + i, 200, 50 + i, 230], fill=col)
    d.rectangle([50, 240, 130, 310], fill=(40, 30, 25, 255))
    d.rectangle([55, 245, 125, 305], fill=(255, 180, 100, 255))
    d.rectangle([150, 250, 250, 300], fill=(30, 25, 20, 255))
    d.text((170, 265), "OPEN", fill=(255, 50, 50, 255), font=font_sm)
    for sx in (70, 95, 120):
        d.ellipse([sx, 290, sx + 14, 300], fill=(180, 40, 40, 255))

    d.rectangle([680, 170, 920, 340], fill=(120, 70, 50, 255))
    d.rectangle([700, 140, 760, 340], fill=(80, 40, 30, 255))
    for i, ch in enumerate("BOOKS"):
        d.text((708, 175 + i * 30), ch, fill=(255, 220, 120, 255), font=font_sm)
    d.rectangle([780, 220, 900, 320], fill=(50, 35, 30, 255))
    d.rectangle([790, 230, 890, 310], fill=(200, 160, 90, 255))

    d.rectangle([0, 330, W, 400], fill=(110, 110, 118, 255))
    d.rectangle([0, 330, W, 338], fill=(70, 70, 75, 255))
    d.rectangle([0, 400, W, H], fill=(35, 38, 48, 255))
    for i in range(18):
        x = 30 + i * 50
        d.rectangle([x, 420, x + 18, 530], fill=(70, 45, 40, 255))
        d.rectangle([x + 4, 435, x + 10, 510], fill=(140, 55, 50, 255))
    overlay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    ImageDraw.Draw(overlay).rectangle([0, 400, W, H], fill=(244, 140, 60, 40))
    im = Image.alpha_composite(im, overlay)
    d = ImageDraw.Draw(im)

    d.rectangle([720, 430, 880, 480], fill=(40, 80, 140, 255))
    d.rectangle([740, 410, 860, 440], fill=(50, 90, 150, 255))
    d.ellipse([730, 465, 760, 495], fill=(20, 20, 25, 255))
    d.ellipse([840, 465, 870, 495], fill=(20, 20, 25, 255))
    d.rectangle([300, 360, 380, 375], fill=(100, 60, 30, 255))
    d.rectangle([305, 375, 312, 395], fill=(80, 50, 25, 255))
    d.rectangle([368, 375, 375, 395], fill=(80, 50, 25, 255))
    d.rectangle([400, 355, 425, 395], fill=(50, 55, 50, 255))
    for lx in (320, 520, 620):
        d.rectangle([lx, 250, lx + 6, 330], fill=(40, 40, 45, 255))
        d.ellipse([lx - 8, 235, lx + 14, 255], fill=(255, 210, 100, 255))

    im.convert("RGB").save(os.path.join(BG, "downtown_golden.png"))
    print("downtown bg ok")
    return im.convert("RGB")

def make_bg_variants(base):
    variants = {
        "diner": (1.05, 0.95, 0.9),
        "pages": (0.95, 0.9, 1.05),
        "rails": (0.85, 0.85, 0.9),
        "river": (0.9, 0.95, 1.1),
        "star": (1.1, 0.95, 0.8),
        "community": (0.95, 1.05, 0.9),
        "skate": (1.0, 0.85, 0.85),
        "gym": (0.9, 0.95, 1.05),
        "downtown": (1.0, 1.0, 1.0),
    }
    for name, (rr, gg, bb) in variants.items():
        im = base.copy()
        if name != "downtown":
            px = im.load()
            for y in range(im.height):
                for x in range(im.width):
                    pr, pg, pb = px[x, y]
                    px[x, y] = (min(255, int(pr * rr)), min(255, int(pg * gg)), min(255, int(pb * bb)))
        im.save(os.path.join(BG, f"{name}.png"))
    print("bg variants ok")

def make_portrait():
    face = draw_matthew_frame("idle")
    head = face.crop((12, 2, 36, 28)).resize((96, 96), Image.NEAREST)
    out = Image.new("RGBA", (112, 112), (0, 0, 0, 0))
    mask = Image.new("L", (96, 96), 0)
    ImageDraw.Draw(mask).ellipse([0, 0, 95, 95], fill=255)
    out.paste(head, (8, 8), mask)
    ImageDraw.Draw(out).ellipse([6, 6, 105, 105], outline=(255, 200, 80, 255), width=4)
    out.save(os.path.join(SPR, "portrait_matthew.png"))
    print("portrait ok")

def make_hud_bits():
    heart = Image.new("RGBA", (24, 24), (0, 0, 0, 0))
    d = ImageDraw.Draw(heart)
    d.polygon([(12, 22), (2, 10), (2, 6), (6, 2), (12, 6), (18, 2), (22, 6), (22, 10)], fill=(220, 50, 50, 255))
    heart.save(os.path.join(SPR, "heart.png"))
    empty = Image.new("RGBA", (24, 24), (0, 0, 0, 0))
    d = ImageDraw.Draw(empty)
    d.polygon([(12, 22), (2, 10), (2, 6), (6, 2), (12, 6), (18, 2), (22, 6), (22, 10)], outline=(180, 180, 180, 200))
    empty.save(os.path.join(SPR, "heart_empty.png"))
    print("hud bits ok")

if __name__ == "__main__":
    sheet_matthew()
    sheet_cast()
    base = make_bg_diner()
    make_bg_variants(base)
    make_portrait()
    make_hud_bits()
    print("ALL ASSETS DONE")
    print("sprites:", os.listdir(SPR))
    print("bg:", os.listdir(BG))
