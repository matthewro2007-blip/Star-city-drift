/**
 * Animation-state glue (game-logic lane). Picks the named animation state for every character and
 * asks Joe's sprites.js getAnimFrame(charKey, state, tMs, outfit?) for the frame. Guarded shim:
 * until sprites.js exports getAnimFrame (or while a sheet hasn't loaded / a state is unknown) every
 * call returns null and the draw code falls back to the existing 8-frame sheets.
 */
import * as Sprites from './sprites.js';

const THUG_NAMES = { '#8e44ad': 'purple', '#c0392b': 'red', '#16a085': 'teal', '#d35400': 'orange', '#7f8c8d': 'grey' };

/** charKey for a combat entity: matthew | silas_boss | snatcher | thug_<colour>. */
export function enemyCharKey(e) {
  if (e.charKey) return e.charKey; // DLC: Silas prequel bosses reuse a thug's art
  if (e.isBoss) return 'silas_boss';
  if (e.runner) return 'snatcher';
  return 'thug_' + (THUG_NAMES[e.color] || 'grey');
}

/** {img,sx,sy,sw,sh,done,active,...} or null (no art yet → caller falls back). Never throws. */
export function animFrame(charKey, state, tMs, outfit) {
  const fn = Sprites.getAnimFrame;
  if (typeof fn !== 'function' || !state) return null;
  if (charKey === 'matthew' && typeof Sprites.hasAnims === 'function' && !Sprites.hasAnims('matthew', outfit)) return null;
  try {
    const f = fn(charKey, state, Math.max(0, tMs), outfit);
    return f && f.img ? f : null;
  } catch (_) { return null; }
}

/** Length (ms) of a one-shot anim, probed via the `done` flag; 0 if unknown / looping / no art. */
const durCache = new Map();
export function animDuration(charKey, state, outfit) {
  const k = charKey + '|' + state + '|' + (charKey === 'matthew' ? outfit || 'polo' : '');
  if (durCache.has(k)) return durCache.get(k);
  let d = 0;
  if (animFrame(charKey, state, 0, outfit)) {
    for (let t = 0; t <= 3000; t += 1000 / 60) { const f = animFrame(charKey, state, t, outfit); if (f && f.done) { d = t + 1000 / 60; break; } }
    durCache.set(k, d); // only cache once the art is loaded
  }
  return d;
}

/**
 * Set an entity's anim state; restarts its clock only on change (or when `restart`).
 * fit = { key, sec, outfit }: if the art is longer than the gameplay window (attack / fall / get-up),
 * play it faster so the whole anim — and its 'active' frames — land inside that window.
 */
export function setAnim(ent, state, fit, restart = false) {
  if (ent.animState === state && !restart) return;
  ent.animState = state;
  ent.animStart = ent.animT || 0;
  ent.animRate = 1;
  if (fit && fit.sec > 0) {
    const d = animDuration(fit.key, state, fit.outfit);
    if (d > fit.sec * 1000) ent.animRate = d / (fit.sec * 1000);
  }
}
/** ms into the current anim state (scaled by the fit rate). */
export function animMs(ent) { return ((ent.animT || 0) - (ent.animStart || 0)) * 1000 * (ent.animRate || 1); }

/**
 * Hitbox gating by 'active' frames: when the current frame reports a boolean `active`, the hitbox
 * only connects on active frames; with no art (or no flag) it's always live (old behaviour).
 */
export function gateHitbox(ent, charKey, outfit) {
  if (!ent.hitbox) return;
  const f = animFrame(charKey, ent.animState, animMs(ent), outfit);
  ent.hitbox.live = !(f && typeof f.active === 'boolean') || f.active;
  // 2.0.3 anim pass: separate active runs in one strip (Matthew combo2 f2-3 + f5-6, William combo1 f1 + f4) each hit once.
  // Kit hitboxes do this in combat.js kitGate.
  const hb = ent.hitbox;
  if (f && f.active && !hb.kit && f.index != null && hb.hit) {
    if (hb.lastActive != null && f.index - hb.lastActive > 1) { hb.hit.clear(); hb.seg = (hb.seg || 1) + 1; }
    hb.lastActive = f.index;
  }
}

/** 2.0.3: art timing of a one-shot state, probed from the manifest: { dur, first, last, lastEnd } in ms (0 / -1 when unknown).
 * first / lastEnd = start of the first active frame / end of the last one. Cached once the art is loaded. */
const tCache = new Map();
export function animTiming(charKey, state, outfit) {
  const k = charKey + '|' + state + '|' + (String(charKey).startsWith('matthew') ? outfit || 'polo' : '');
  if (tCache.has(k)) return tCache.get(k);
  const r = { dur: 0, first: -1, last: -1, lastEnd: -1, firstIdx: -1, lastIdx: -1 };
  if (!animFrame(charKey, state, 0, outfit)) return r;
  const step = 1000 / 240;
  for (let t = 0; t <= 4000; t += step) {
    const f = animFrame(charKey, state, t, outfit);
    if (!f) break;
    if (f.active) { if (r.first < 0) { r.first = t; r.firstIdx = f.index; } r.last = t; r.lastIdx = f.index; r.lastEnd = t + step; }
    if (f.done) { r.dur = t + (f.index > 0 ? t / f.index : step); break; } // done fires as the last frame starts
  }
  tCache.set(k, r);
  return r;
}

/** True once Joe's API is present (for reports/tests). */
export function animApiReady() { return typeof Sprites.getAnimFrame === 'function'; }
export function animList(charKey, outfit) {
  try { return typeof Sprites.listAnims === 'function' ? Sprites.listAnims(charKey, outfit) || [] : []; } catch (_) { return []; }
}
