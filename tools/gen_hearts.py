#!/usr/bin/env python3
"""HUD hearts 24x24 RGBA (heart.png / heart_empty.png) in the v3 cel/ink style."""
import math, os, shutil
from PIL import Image, ImageDraw, ImageChops
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SPR = os.path.join(ROOT, "assets", "sprites")
S = 8
def heart_poly(cx, cy, r, n=120):
    pts = []
    for i in range(n):
        t = 2*math.pi*i/n
        x = 16*math.sin(t)**3
        y = -(13*math.cos(t) - 5*math.cos(2*t) - 2*math.cos(3*t) - math.cos(4*t))
        pts.append(((cx + x*r)*S, (cy + y*r)*S))
    return pts
def make(fill, sh, hi, out=(30, 18, 16, 255)):
    big = Image.new("RGBA", (24*S, 24*S), (0, 0, 0, 0)); d = ImageDraw.Draw(big)
    d.polygon(heart_poly(12, 12.6, 0.62), fill=out)
    d.polygon(heart_poly(12, 12.4, 0.50), fill=fill)
    m = Image.new("L", big.size, 0); ImageDraw.Draw(m).polygon(heart_poly(12, 12.4, 0.50), fill=255)
    sh_m = ImageChops.subtract(m, ImageChops.offset(m, -2*S, -2*S))     # lower-right shade
    big.paste(Image.new("RGBA", big.size, sh), (0, 0), sh_m)
    d.ellipse([7*S, 7*S, 10.5*S, 10*S], fill=hi)
    im = big.resize((24, 24), Image.LANCZOS)
    a = im.getchannel("A").point(lambda v: 255 if v >= 110 else 0); im.putalpha(a)
    return im
if __name__ == "__main__":
    for n in ("heart", "heart_empty"):
        b = os.path.join(SPR, n + "_v1.png")
        if not os.path.exists(b): shutil.copy2(os.path.join(SPR, n + ".png"), b)
    make((226, 52, 52, 255), (160, 28, 36, 255), (255, 190, 170, 255)).save(os.path.join(SPR, "heart.png"))
    make((70, 56, 60, 255), (48, 38, 42, 255), (110, 96, 100, 255)).save(os.path.join(SPR, "heart_empty.png"))
    print("hearts written")
