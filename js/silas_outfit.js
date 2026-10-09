/**
 * DLC: Silas prequel — art glue for Matthew's Silas's Suit outfit (game-logic lane; draw only).
 *
 * When Joe's Matthew-in-Silas's-outfit art is installed (Sprites.hasAnims('matthew', 'silas'), plus an
 * optional 'silas' entry in getOutfitPortrait) it is used as-is. Until then the suit falls back to the
 * Skate Fit's plain (non-weapon) strips with a dark navy suit tint below the collar, and a tinted copy of
 * the default HUD portrait. Nothing here edits sprites.js or assets/.
 */
import * as Sprites from './sprites.js';
import { silasAnimMap } from './silas_moves.js';

export const SUIT_FALLBACK_OUTFIT = 'street';   // all-black fit: the closest base for a dark suit
const SUIT_TINT = 'rgba(24,34,52,0.62)', TIE = 'rgba(168,32,42,0.85)';

export function hasSilasSuitArt() {
  try { return typeof Sprites.hasAnims === 'function' && !!Sprites.hasAnims('matthew', 'silas'); } catch (_) { return false; }
}
/** Art outfit id to draw for an outfit (the suit → fallback until Joe's art exists). */
export function artOutfitFor(outfitId) {
  return outfitId === 'silas' && !hasSilasSuitArt() ? SUIT_FALLBACK_OUTFIT : outfitId;
}
/** Logical state → art state for the suit (avoids the fallback outfit's weapon frames). */
export function suitAnimMap() { return silasAnimMap('matthew', hasSilasSuitArt()); }
export function suitNeedsTint(outfitId) { return outfitId === 'silas' && !hasSilasSuitArt(); }

/** Apply the suit tint to a canvas that holds only the character (source-atop), feet at feetY, body height bodyH. */
export function tintSuitOnCanvas(g, W, H, feetY, bodyH, color = SUIT_TINT, frac = 0.7) {
  g.save();
  g.globalCompositeOperation = 'source-atop';
  const collar = Math.round(feetY - bodyH * frac);
  g.fillStyle = color; g.fillRect(0, collar, W, H - collar);
  g.restore();
}

const cache = new Map();
/** Tinted copy of an anim frame / sheet canvas → a frame-shaped object { img, sx:0, sy:0, sw, sh, anchorX, feetRow }. */
export function tintedFrame(f, color = SUIT_TINT, frac = 0.7) {
  if (!f || !f.img) return f;
  const key = (f.img.src || f.img.__id || (f.img.__id = 'c' + Math.random())) + '|' + f.sx + '|' + f.sy + '|' + f.sw + '|' + f.sh + '|' + color + '|' + frac;
  let c = cache.get(key);
  if (!c) {
    c = document.createElement('canvas'); c.width = f.sw; c.height = f.sh;
    const g = c.getContext('2d'); g.imageSmoothingEnabled = false;
    g.drawImage(f.img, f.sx, f.sy, f.sw, f.sh, 0, 0, f.sw, f.sh);
    const feet = f.feetRow != null ? f.feetRow : f.sh - 3;
    tintSuitOnCanvas(g, f.sw, f.sh, feet, 180, color, frac);
    if (cache.size > 300) cache.clear();
    cache.set(key, c);
  }
  return { ...f, img: c, sx: 0, sy: 0 };
}
/** Tinted copy of a whole sprite canvas (old 144x192 sheet frames). */
export function tintedCanvas(spr, color, frac) {
  if (!spr) return spr;
  const tall = spr.height >= 192;
  const f = tintedFrame({ img: spr, sx: 0, sy: 0, sw: spr.width, sh: spr.height, feetRow: tall ? spr.height - 3 : spr.height - 2 }, color, tall ? frac : (frac || 0.7) * (spr.height / 180));
  return f.img;
}

let portraitUrl = null, portraitFor = null;
/** HUD portrait for the suit: Joe's own bust if present, else the default portrait with the suit tint on the shoulders. */
export function suitPortraitSrc() {
  let own = null, base = null;
  try { own = Sprites.getOutfitPortrait && Sprites.getOutfitPortrait('silas'); base = Sprites.getOutfitPortrait && Sprites.getOutfitPortrait('polo'); } catch (_) { /* not loaded */ }
  if (own && base && own !== base && own.src) return own.src;
  if (!base || !base.complete || !base.naturalWidth) return null;
  if (portraitFor === base.src && portraitUrl) return portraitUrl;
  try {
    const c = document.createElement('canvas'); c.width = base.naturalWidth; c.height = base.naturalHeight;
    const g = c.getContext('2d'); g.drawImage(base, 0, 0);
    g.globalCompositeOperation = 'source-atop';
    g.fillStyle = SUIT_TINT; g.fillRect(0, Math.round(c.height * 0.72), c.width, c.height);
    g.fillStyle = TIE; g.fillRect(Math.round(c.width * 0.47), Math.round(c.height * 0.8), Math.max(2, Math.round(c.width * 0.06)), c.height);
    portraitUrl = c.toDataURL('image/png'); portraitFor = base.src;
  } catch (_) { return base.src; }
  return portraitUrl;
}
