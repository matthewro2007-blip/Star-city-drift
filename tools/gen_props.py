#!/usr/bin/env python3
"""Street props for Streets of Roanoke (Bob's lane): sedan_rear, sedan_side, bench, trashcan.

Style target: concept-preview-finished-look.jpg -- cartoon shapes, 1px dark warm
outline, golden-hour grade with a warm rim light from behind (sun low behind the
street): top edges catch gold, right-hand edges a softer gold, faces toward the
camera fall into cool shadow.

Output rules: RGBA, transparent background, alpha strictly 0 or 255, object's
lowest pixel on the last row, centred horizontally.

Usage: python3 tools/gen_props.py [--preview /workspace/tmp_sprite/props_contact.png]
"""
import os, sys
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "assets", "props")

OUTLINE = (24, 14, 20, 255)
RIM = (255, 196, 110)          # warm golden-hour rim
RIM_HOT = (255, 226, 160)
CLEAR = (0, 0, 0, 0)


def c(rgb, a=255):
    return tuple(rgb[:3]) + (a,)


def mix(a, b, t):
    return tuple(int(round(a[i] + (b[i] - a[i]) * t)) for i in range(3))


def vgrad_poly(img, pts, top, bot, y0=None, y1=None):
    """Polygon filled with a vertical gradient (hard alpha)."""
    w, h = img.size
    m = Image.new("L", (w, h), 0)
    ImageDraw.Draw(m).polygon(pts, fill=255)
    ys = [p[1] for p in pts]
    y0 = min(ys) if y0 is None else y0
    y1 = max(ys) if y1 is None else y1
    g = Image.new("RGBA", (w, h))
    gd = ImageDraw.Draw(g)
    for y in range(h):
        t = 0 if y1 == y0 else max(0.0, min(1.0, (y - y0) / (y1 - y0)))
        gd.line([(0, y), (w, y)], fill=c(mix(top, bot, t)))
    img.paste(g, (0, 0), m)


def finish(img, size, rim_top=0.75, rim_right=0.45, rim_left=0.2):
    """Rim-light the silhouette, add 1px outline, threshold alpha, place on canvas."""
    w, h = img.size
    px = img.load()
    inside = lambda x, y: 0 <= x < w and 0 <= y < h and px[x, y][3] > 0
    src = img.copy()
    sp = src.load()
    for y in range(h):
        for x in range(w):
            if not inside(x, y):
                continue
            col = sp[x, y][:3]
            t = 0.0
            if not inside(x, y - 1):
                t = max(t, rim_top)
            elif not inside(x, y - 2):
                t = max(t, rim_top * 0.35)
            if not inside(x + 1, y):
                t = max(t, rim_right)
            if not inside(x - 1, y):
                t = max(t, rim_left)
            if t:
                px[x, y] = c(mix(col, RIM, t))
    # 1px outline (8-neighbour dilation) in dark warm ink
    out = img.copy()
    op = out.load()
    for y in range(h):
        for x in range(w):
            if inside(x, y):
                continue
            if any(inside(x + dx, y + dy) for dx in (-1, 0, 1) for dy in (-1, 0, 1)):
                op[x, y] = OUTLINE
    # hard alpha
    a = out.getchannel("A").point(lambda v: 255 if v >= 128 else 0)
    out.putalpha(a)
    bbox = a.getbbox()
    obj = out.crop(bbox)
    W, H = size
    assert obj.width <= W and obj.height <= H, (obj.size, size)
    canvas = Image.new("RGBA", (W, H), CLEAR)
    canvas.paste(obj, ((W - obj.width) // 2, H - obj.height), obj)
    # clean: any alpha that isn't 0 becomes 255 and fully transparent px are (0,0,0,0)
    cp = canvas.load()
    for y in range(H):
        for x in range(W):
            r, g, b, al = cp[x, y]
            cp[x, y] = (r, g, b, 255) if al else CLEAR
    return canvas


# ---------------------------------------------------------------- palette
BLUE_HI = (70, 92, 150)
BLUE = (34, 48, 92)
BLUE_MID = (26, 36, 72)
BLUE_SH = (14, 20, 44)
GLASS_TOP = (236, 150, 86)     # sunset reflected in glass
GLASS = (48, 54, 78)
GLASS_SH = (22, 24, 38)
CHROME = (206, 204, 210)
CHROME_HI = (255, 236, 196)
CHROME_SH = (104, 100, 112)
TIRE = (22, 20, 24)
TIRE_HI = (58, 52, 56)
TAIL = (210, 30, 34)
TAIL_HOT = (255, 120, 90)
HEAD = (255, 236, 170)


def wheel_side(d, cx, cy, r):
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=c(TIRE))
    d.arc([cx - r + 1, cy - r + 1, cx + r - 1, cy + r - 1], 200, 320, fill=c(TIRE_HI))
    hr = r - 4
    d.ellipse([cx - hr, cy - hr, cx + hr, cy + hr], fill=c(CHROME_SH))
    d.ellipse([cx - hr + 1, cy - hr + 1, cx + hr - 1, cy + hr - 1], fill=c(CHROME))
    d.arc([cx - hr + 1, cy - hr + 1, cx + hr - 1, cy + hr - 1], 200, 300, fill=c(CHROME_HI))
    d.ellipse([cx - 2, cy - 2, cx + 2, cy + 2], fill=c(CHROME_SH))
    d.point((cx, cy), fill=c(CHROME_HI))


# ---------------------------------------------------------------- sedan side
def sedan_side():
    W, H = 160, 64
    im = Image.new("RGBA", (W + 8, H + 8), CLEAR)   # margin for the outline
    d = ImageDraw.Draw(im)
    o = 4  # offset
    P = lambda pts: [(x + o, y + o) for x, y in pts]
    rw, fw, wy, wr = 36, 122, 50, 10                # wheel centres / radius

    # greenhouse (cabin) -- drawn first, body overlaps its base
    cabin = P([(40, 30), (56, 14), (60, 12), (94, 12), (100, 14), (116, 30)])
    d.polygon(cabin, fill=c(BLUE))
    vgrad_poly(im, cabin, BLUE_HI, BLUE, 12, 30)
    # windows: rear quarter + door glass, chrome-framed
    rear_win = P([(46, 29), (58, 16), (74, 16), (74, 29)])
    front_win = P([(78, 29), (78, 16), (96, 16), (110, 29)])
    for wpts in (rear_win, front_win):
        d.polygon(wpts, fill=c(CHROME))
    vgrad_poly(im, P([(48, 28), (59, 17), (73, 17), (73, 28)]), GLASS_TOP, GLASS_SH, 17, 28)
    vgrad_poly(im, P([(79, 28), (79, 17), (95, 17), (108, 28)]), GLASS_TOP, GLASS_SH, 17, 28)
    # reflection streaks
    d.line(P([(62, 27), (68, 18)]), fill=c(mix(GLASS_TOP, (255, 255, 255), 0.3)))
    d.line(P([(88, 27), (94, 18)]), fill=c(mix(GLASS_TOP, (255, 255, 255), 0.3)))
    d.line(P([(75, 15), (75, 29)]), fill=c(BLUE_SH))      # B pillar shade
    d.line(P([(76, 15), (76, 29)]), fill=c(BLUE))

    # main body: long low classic slab, trunk at rear, hood at front
    body = P([(2, 32), (6, 29), (40, 29), (116, 29), (150, 30), (156, 33),
              (157, 40), (156, 48), (150, 52), (4, 52), (1, 48), (1, 36)])
    vgrad_poly(im, body, BLUE_HI, BLUE_SH, 29, 52)
    # upper body flat colour band then lower shadow (light from behind => side in shade)
    vgrad_poly(im, P([(2, 33), (156, 33), (157, 39), (1, 39)]), BLUE, BLUE_MID, 33, 39)
    vgrad_poly(im, P([(1, 40), (157, 40), (156, 48), (150, 52), (4, 52), (1, 48)]), BLUE_MID, BLUE_SH, 40, 52)
    # wheel wells (dark cut-outs)
    for cx in (rw, fw):
        d.pieslice([cx - wr - 3 + o, wy - wr - 3 + o, cx + wr + 3 + o, wy + wr + 3 + o], 180, 360, fill=c(OUTLINE))
        d.rectangle([cx - wr - 3 + o, wy + o, cx + wr + 3 + o, 53 + o], fill=CLEAR)
    # chrome side spear + rocker trim
    d.line(P([(8, 38), (150, 38)]), fill=c(CHROME))
    d.line(P([(8, 37), (150, 37)]), fill=c(CHROME_HI))
    d.line(P([(rw + wr + 4, 50), (fw - wr - 4, 50)]), fill=c(CHROME_SH))
    # door seams + handles
    for x in (76, 112):
        d.line(P([(x, 30), (x, 49)]), fill=c(BLUE_SH))
    d.line(P([(40, 30), (40, 40)]), fill=c(BLUE_SH))
    d.rectangle(P([(70, 34), (73, 35)]), fill=c(CHROME))
    d.rectangle(P([(105, 34), (108, 35)]), fill=c(CHROME))
    # front: chrome bumper, grille edge, headlight
    d.rectangle(P([(151, 42), (157, 47)]), fill=c(CHROME))
    d.line(P([(151, 42), (157, 42)]), fill=c(CHROME_HI))
    d.line(P([(151, 47), (157, 47)]), fill=c(CHROME_SH))
    d.rectangle(P([(153, 33), (157, 37)]), fill=c(CHROME))
    d.rectangle(P([(154, 34), (157, 36)]), fill=c(HEAD))
    # rear: chrome bumper + tail light
    d.rectangle(P([(1, 42), (7, 47)]), fill=c(CHROME))
    d.line(P([(1, 42), (7, 42)]), fill=c(CHROME_HI))
    d.line(P([(1, 47), (7, 47)]), fill=c(CHROME_SH))
    d.rectangle(P([(1, 33), (4, 39)]), fill=c(TAIL))
    d.rectangle(P([(1, 34), (2, 36)]), fill=c(TAIL_HOT))
    # roof drip-rail highlight
    d.line(P([(60, 12), (94, 12)]), fill=c(RIM_HOT))
    # wheels
    for cx in (rw, fw):
        wheel_side(d, cx + o, wy + o, wr)
    # little shadow wedge under the body between wheels stays transparent (sprite only)
    return finish(im, (W, H), rim_top=0.7, rim_right=0.45, rim_left=0.25)


# ---------------------------------------------------------------- sedan rear 3/4
def sedan_rear():
    W, H = 96, 64
    im = Image.new("RGBA", (W + 8, H + 8), CLEAR)
    d = ImageDraw.Draw(im)
    o = 4
    P = lambda pts: [(x + o, y + o) for x, y in pts]

    # left side panel receding to upper-left (in shade)
    side = P([(36, 28), (5, 27), (3, 30), (3, 44), (6, 50), (36, 55)])
    vgrad_poly(im, side, BLUE, BLUE_SH, 27, 55)
    # far (front-left) wheel: arch cut into the side + tyre with hubcap
    d.pieslice(P([(5, 40), (23, 58)]), 180, 360, fill=c(OUTLINE))
    d.ellipse(P([(7, 43), (19, 58)]), fill=c(TIRE))
    d.ellipse(P([(10, 46), (16, 54)]), fill=c(CHROME_SH))
    d.ellipse(P([(11, 47), (15, 52)]), fill=c(CHROME))
    # near rear wheel arch on the side panel (tyre drawn later from behind)
    d.pieslice(P([(28, 44), (42, 58)]), 180, 270, fill=c(OUTLINE))
    d.ellipse(P([(30, 47), (40, 61)]), fill=c(TIRE))
    d.arc(P([(31, 48), (39, 60)]), 160, 260, fill=c(TIRE_HI))
    # side greenhouse
    gh = P([(42, 26), (48, 11), (28, 10), (14, 26)])
    vgrad_poly(im, gh, BLUE_HI, BLUE, 10, 26)
    vgrad_poly(im, P([(41, 25), (46, 13), (31, 12), (19, 25)]), GLASS_TOP, GLASS_SH, 12, 25)
    d.line(P([(32, 12), (26, 25)]), fill=c(BLUE))             # B-pillar
    d.line(P([(40, 24), (44, 15)]), fill=c(mix(GLASS_TOP, (255, 255, 255), 0.35)))
    # chrome spear along the side
    d.line(P([(4, 36), (36, 39)]), fill=c(CHROME))
    # roof (seen slightly from above)
    roof = P([(50, 10), (80, 10), (76, 7), (32, 7), (28, 10)])
    vgrad_poly(im, roof, mix(BLUE_HI, RIM, 0.35), BLUE_HI, 7, 10)
    # trunk deck + rear window frame (C-pillars)
    vgrad_poly(im, P([(40, 28), (92, 28), (88, 24), (44, 24)]), BLUE_HI, BLUE, 24, 28)
    vgrad_poly(im, P([(44, 24), (88, 24), (80, 10), (50, 10)]), BLUE, BLUE_MID, 10, 24)
    # rear window (wraparound, reflecting the sunset)
    vgrad_poly(im, P([(47, 23), (85, 23), (78, 12), (53, 12)]), GLASS_TOP, GLASS_SH, 12, 23)
    d.line(P([(56, 22), (60, 13)]), fill=c(mix(GLASS_TOP, (255, 255, 255), 0.35)))
    d.line(P([(58, 22), (62, 13)]), fill=c(mix(GLASS_TOP, (255, 255, 255), 0.15)))
    d.line(P([(47, 23), (85, 23)]), fill=c(CHROME))
    # rear face (facing camera, away from the sun -> deep blue)
    rear = P([(36, 28), (93, 28), (94, 32), (94, 50), (92, 54), (37, 55), (36, 50)])
    vgrad_poly(im, rear, BLUE, BLUE_SH, 28, 55)
    d.line(P([(37, 29), (93, 29)]), fill=c(BLUE_HI))
    # tail lights (big classic horizontal lamps) + glow cores
    for x0, x1 in ((38, 49), (81, 92)):
        d.rectangle(P([(x0, 32), (x1, 38)]), fill=c(CHROME))
        d.rectangle(P([(x0 + 1, 33), (x1 - 1, 37)]), fill=c(TAIL))
        d.rectangle(P([(x0 + 3, 34), (x1 - 3, 35)]), fill=c(TAIL_HOT))
    # trunk lock / emblem
    d.rectangle(P([(64, 33), (66, 35)]), fill=c(CHROME))
    # licence plate (Virginia-ish cream plate)
    d.rectangle(P([(58, 40), (72, 46)]), fill=c((236, 226, 196)))
    d.line(P([(60, 43), (70, 43)]), fill=c((40, 50, 110)))
    # chrome rear bumper
    d.rectangle(P([(35, 47), (94, 51)]), fill=c(CHROME))
    d.line(P([(35, 47), (94, 47)]), fill=c(CHROME_HI))
    d.line(P([(35, 51), (94, 51)]), fill=c(CHROME_SH))
    d.rectangle(P([(62, 52), (68, 53)]), fill=c(CHROME_SH))   # exhaust
    # rear tyres seen from behind
    for x0 in (39, 80):
        d.rounded_rectangle(P([(x0, 51), (x0 + 11, 63)]), radius=3, fill=c(TIRE))
        d.line(P([(x0 + 2, 53), (x0 + 2, 61)]), fill=c(TIRE_HI))
    return finish(im, (W, H), rim_top=0.75, rim_right=0.5, rim_left=0.3)


# ---------------------------------------------------------------- bench
def bench():
    W, H = 96, 48
    im = Image.new("RGBA", (W + 8, H + 8), CLEAR)
    d = ImageDraw.Draw(im)
    o = 4
    P = lambda pts: [(x + o, y + o) for x, y in pts]
    WOOD_HI, WOOD, WOOD_SH = (204, 136, 70), (150, 92, 46), (92, 54, 28)
    IRON, IRON_SH, IRON_HI = (44, 42, 50), (26, 24, 30), (104, 94, 90)

    def slat(x0, x1, y0, y1, top=WOOD_HI, bot=WOOD_SH):
        vgrad_poly(im, P([(x0, y0), (x1, y0), (x1, y1), (x0, y1)]), top, bot, y0, y1)
        for gx in range(x0 + 7, x1 - 6, 17):                       # grain ticks
            d.line(P([(gx, (y0 + y1) // 2), (gx + 5, (y0 + y1) // 2)]), fill=c(mix(WOOD, WOOD_SH, 0.55)))
        d.point(P([(x0 + 2, y0 + 1)]), fill=c(IRON_SH))            # bolt heads
        d.point(P([(x1 - 2, y0 + 1)]), fill=c(IRON_SH))

    # cast-iron back uprights (behind the slats), angled slightly back
    for x in (8, 46, 84):
        d.polygon(P([(x, 1), (x + 3, 1), (x + 3, 27), (x, 27)]), fill=c(IRON))
        d.line(P([(x + 3, 1), (x + 3, 26)]), fill=c(IRON_HI))
    # back rest: 3 slats with see-through gaps
    for y in (1, 9, 17):
        slat(2, 93, y, y + 4)
    # seat seen slightly from above: rear deck slat, front deck slat, thin apron
    slat(4, 91, 26, 28, WOOD_HI, WOOD)
    slat(3, 92, 31, 33, WOOD_HI, WOOD)
    d.rectangle(P([(3, 34), (92, 35)]), fill=c(WOOD_SH))
    # end frames: scrolled armrest + front leg, splayed rear foot
    for x, s in ((5, 1), (88, -1)):
        # rear leg (behind, darker), angled back
        d.line(P([(x + 3 * s, 27), (x + 5 * s, 45)]), fill=c(IRON_SH), width=2)
        # armrest: flat top bar from the upright to the front, curling down
        ax0, ax1 = (x - 3, x + 9) if s > 0 else (x - 9, x + 3)
        d.rectangle(P([(ax0, 20), (ax1, 22)]), fill=c(IRON))
        d.line(P([(ax0, 20), (ax1, 20)]), fill=c(IRON_HI))
        d.ellipse(P([(ax0 - 1, 20), (ax0 + 3, 24)]) if s > 0 else P([(ax1 - 3, 20), (ax1 + 1, 24)]), fill=c(IRON))
        # arm support down to the front leg
        d.line(P([(x, 22), (x, 35)]), fill=c(IRON), width=3)
        # front leg + foot
        d.rectangle(P([(x - 1, 35), (x + 2, 44)]), fill=c(IRON))
        d.line(P([(x - 1, 36), (x - 1, 43)]), fill=c(IRON_HI))
        d.rectangle(P([(x - 3, 44), (x + 4, 46)]), fill=c(IRON))
    # centre leg
    d.rectangle(P([(46, 36), (49, 44)]), fill=c(IRON))
    d.rectangle(P([(44, 44), (51, 46)]), fill=c(IRON))
    return finish(im, (W, H), rim_top=0.7, rim_right=0.45, rim_left=0.2)


# ---------------------------------------------------------------- trash can
def trashcan():
    W, H = 32, 48
    im = Image.new("RGBA", (W + 8, H + 8), CLEAR)
    d = ImageDraw.Draw(im)
    o = 4
    P = lambda pts: [(x + o, y + o) for x, y in pts]
    M_HI, M, M_SH, M_DK = (128, 136, 128), (78, 86, 82), (46, 52, 52), (26, 30, 32)

    # body (slight taper), horizontal cylinder shading: lit right edge (sun behind-right)
    body = P([(3, 8), (28, 8), (27, 43), (4, 43)])
    w, h = im.size
    m = Image.new("L", (w, h), 0)
    ImageDraw.Draw(m).polygon(body, fill=255)
    g = Image.new("RGBA", (w, h))
    gd = ImageDraw.Draw(g)
    for x in range(w):
        t = (x - o - 3) / 25.0
        if t < 0.15:
            col = mix(M_SH, M, t / 0.15)
        elif t < 0.7:
            col = mix(M, M_SH, (t - 0.15) / 0.55)
        else:
            col = mix(M_SH, M_HI, (t - 0.7) / 0.3)
        gd.line([(x, 0), (x, h)], fill=c(col))
    im.paste(g, (0, 0), m)
    # vertical ribs
    for x in (8, 12, 16, 20, 24):
        d.line(P([(x, 11), (x, 40)]), fill=c(M_DK))
        d.line(P([(x + 1, 11), (x + 1, 40)]), fill=c(mix(M, M_HI, 0.3)))
    # reinforcing bands
    for y in (10, 25, 40):
        d.rectangle(P([(3, y), (28, y + 2)]), fill=c(M))
        d.line(P([(3, y), (28, y)]), fill=c(M_HI))
        d.line(P([(3, y + 2), (28, y + 2)]), fill=c(M_DK))
    # base ring / feet
    d.rectangle(P([(4, 43), (27, 45)]), fill=c(M_DK))
    d.line(P([(4, 43), (27, 43)]), fill=c(M_SH))
    # lid: rim + dark opening + domed cap
    d.rectangle(P([(1, 6), (30, 9)]), fill=c(M))
    d.line(P([(1, 6), (30, 6)]), fill=c(M_HI))
    d.line(P([(1, 9), (30, 9)]), fill=c(M_DK))
    d.chord(P([(5, 2), (26, 12)]), 180, 360, fill=c(M))
    d.chord(P([(8, 4), (23, 10)]), 180, 360, fill=c(mix(M, M_HI, 0.4)))
    d.rectangle(P([(14, 1), (17, 2)]), fill=c(M_SH))                 # handle knob
    # "CITY OF ROANOKE" plate hint
    d.rectangle(P([(10, 17), (21, 21)]), fill=c((44, 70, 60)))
    d.line(P([(12, 19), (19, 19)]), fill=c((210, 190, 120)))
    return finish(im, (W, H), rim_top=0.75, rim_right=0.55, rim_left=0.25)


PROPS = {
    "sedan_rear": (sedan_rear, (96, 64)),
    "sedan_side": (sedan_side, (160, 64)),
    "bench": (bench, (96, 48)),
    "trashcan": (trashcan, (32, 48)),
}


def verify(path, size):
    im = Image.open(path)
    assert im.size == size, (path, im.size)
    assert im.mode == "RGBA", (path, im.mode)
    a = im.getchannel("A")
    hist = a.histogram()
    vals = {i for i, n in enumerate(hist) if n}
    assert vals <= {0, 255}, (path, vals)
    w, h = im.size
    for xy in ((0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)):
        assert a.getpixel(xy) == 0, (path, "corner", xy)
    assert any(a.getpixel((x, h - 1)) for x in range(w)), (path, "bottom row empty")
    bb = a.getbbox()
    return bb


def contact(paths, out, scale=3, pad=12, bg=(128, 128, 128, 255)):
    ims = [Image.open(p) for p in paths]
    W = sum(i.width * scale for i in ims) + pad * (len(ims) + 1)
    H = max(i.height * scale for i in ims) + pad * 2
    sheet = Image.new("RGBA", (W, H), bg)
    x = pad
    for i in ims:
        big = i.resize((i.width * scale, i.height * scale), Image.NEAREST)
        sheet.alpha_composite(big, (x, H - pad - big.height))
        x += big.width + pad
    os.makedirs(os.path.dirname(out), exist_ok=True)
    sheet.convert("RGB").save(out)


def main():
    os.makedirs(OUT, exist_ok=True)
    paths = []
    for name, (fn, size) in PROPS.items():
        img = fn()
        p = os.path.join(OUT, name + ".png")
        img.save(p)
        bb = verify(p, size)
        print(f"{p}: {size[0]}x{size[1]} RGBA ok, bbox={bb}")
        paths.append(p)
    if "--preview" in sys.argv:
        out = sys.argv[sys.argv.index("--preview") + 1]
        contact(paths, out)
        print("preview:", out)


if __name__ == "__main__":
    main()
