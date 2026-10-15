/**
 * Follow camera. World units stay the 960×540 plate pixels; combat and hitboxes
 * never read these. Edit the values below to retune the lens.
 *
 * zoom             Magnification. 1 is the old full-frame street. Higher brings
 *                  the lens closer (Matthew reads larger). 1.34 is the default.
 * landmarkZoom     Milder magnification for landmarkAreas. The Mill Mountain
 *                  star sits high in the plate; this pull-back keeps the star
 *                  and Matthew's feet in the same frame.
 * landmarkAreas    Area ids that use landmarkZoom.
 * lookAhead        Fraction of the view kept in front of Matthew, in the
 *                  direction he faces. 0.58 leaves a readable stretch of road
 *                  ahead and still shows a beat of street behind him.
 *                  prefers-reduced-motion centers him instead (no lead).
 * smoothTime       Seconds to ease most of the way to the target. 0 locks on.
 * maxSpeed         Fastest the lens may travel, in world pixels per second.
 *                  Ignored when smoothTime is 0. Set above Matthew's run speed
 *                  (160) so the cap doesn't add lag on a straight sprint.
 * zoomSmoothTime   Seconds to ease a zoom change (the pull-back onto the star).
 * yBias            0 keeps the top of the plate, 1 keeps the bottom
 *                  (sidewalk, feet, and the road in front of him).
 */
export const CAMERA = {
  zoom: 1.34,          // base lens (zoom level 1); levels 2 / 3 multiply it (see ZOOM_LEVELS)
  landmarkZoom: 1.13,
  landmarkAreas: ['star'],
  lookAhead: 0.58,
  smoothTime: 0.2,
  maxSpeed: 780,
  zoomSmoothTime: 0.5,
  yBias: 1,
  // 1.9.0 zoom levels 2x / 3x (close lenses only; level 1 keeps the shipped framing above):
  headroom: 150,       // world px kept above the feet line (tallest cast: Silas at boss scale)
  footroom: 14,        // world px kept below the feet line
  enemyRange: 320,     // enemies within this many px of Matthew pull the frame toward them
  enemyBias: 0.5       // 0 = ignore enemies, 1 = centre on the fight's midpoint
};

// >>> 1.9.0 camera zoom levels (setting persisted in localStorage 'sor_zoom'; UI: Bob's js/zoom_ui.js)
/** Full-scene 1x / 2x / 3x. Camera values 1.34, 2.68, 4.02. */
export const ZOOM_LEVELS = [1, 2, 3];
export const ZOOM_KEY = 'sor_zoom';
let zoomLevel = 1;
try { const v = Number(localStorage.getItem(ZOOM_KEY)); if (ZOOM_LEVELS.includes(v)) zoomLevel = v; } catch (_) { /* private mode */ }
/** Current level (1 | 2 | 3). */
export function getZoomLevel() { return zoomLevel; }
/** Lens magnification for a level (1.34 × level). */
export function zoomForLevel(level) { return (CAMERA.zoom || 1.34) * level; }
/** Set the level (1 | 2 | 3), persist it, fire window 'sor:zoomchanged' { level }. Returns the level. */
export function setZoomLevel(level) {
  const n = Math.round(Number(level));
  if (!ZOOM_LEVELS.includes(n)) return zoomLevel;
  if (n === zoomLevel) return zoomLevel;
  zoomLevel = n;
  try { localStorage.setItem(ZOOM_KEY, String(n)); } catch (_) { /* ignore */ }
  try { window.dispatchEvent(new CustomEvent('sor:zoomchanged', { detail: { level: n } })); } catch (_) { /* ignore */ }
  return n;
}
/** 1 → 2 → 3 → 1. */
export function cycleZoom() { return setZoomLevel((zoomLevel % ZOOM_LEVELS.length) + 1); }
if (typeof window !== 'undefined') {
  window.sorZoom = { get: getZoomLevel, set: setZoomLevel, cycle: cycleZoom };
  window.addEventListener('sor:zoom', (e) => { if (e && e.detail) setZoomLevel(e.detail.level); });
}
// <<< 1.9.0 camera zoom levels

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

/** Exponential ease. dt <= 0 holds; smoothTime <= 0 jumps to the target. */
function damp(cur, target, dt, time) {
  if (!(time > 0)) return target;
  if (!(dt > 0)) return cur;
  const k = 1 - Math.exp(-dt / time);
  return cur + (target - cur) * k;
}

let reduceMQ = null;
function reducedMotion() {
  if (!reduceMQ && window.matchMedia) reduceMQ = window.matchMedia('(prefers-reduced-motion: reduce)');
  return !!(reduceMQ && reduceMQ.matches);
}

export function createFollowCamera() {
  let x = 0;
  let y = null;
  let zoom = CAMERA.zoom;
  let primed = false;
  let cutNext = true;
  let mag = 0;
  let phase = 0;
  let frame = {
    x: 0, y: 0, viewW: 960, viewH: 540, zoom: 1, shakeX: 0, shakeY: 0
  };

  function zoomFor(areaId) {
    const far = (CAMERA.landmarkAreas || []).indexOf(areaId) !== -1;
    // the landmark pull-back scales with the zoom level (1.13 / 2.26 / 3.39 on the star)
    return Math.max(1, ((far ? CAMERA.landmarkZoom : CAMERA.zoom) || 1) * zoomLevel);
  }

  return {
    get frame() { return frame; },
    /** Next update cuts to the target (area change, respawn, warp, new game). */
    cut() { cutNext = true; mag = 0; },
    /** 1.9.0: zoom level whose lens is being drawn (1 | 2 | 3). */
    get level() { return zoomLevel; },
    /**
     * Presentation-only hit kick, in world pixels. Ignored when the user
     * prefers reduced motion — shake never moves the HUD (it only offsets
     * this world lens).
     */
    kick(amount) {
      if (reducedMotion()) { mag = 0; return; }
      const a = Number(amount) || 0;
      if (a > 0) mag = Math.min(6, Math.max(mag, a));
    },
    /**
     * @param {object} o { playerX, playerY?, facing, areaWidth, areaId, screenW, screenH, dt,
     *                    enemies?: [{x,y}], override?: { x (frame centre), zoom } from the scene player }
     * @returns {{ x, y, viewW, viewH, zoom, shakeX, shakeY }}
     */
    update(o) {
      if (o.override && o.override.x != null) { // 1.9.0 scene player owns the lens (x = frame centre)
        zoom = Math.max(1, o.override.zoom || zoom);
        const vw = o.screenW / zoom, vh = o.screenH / zoom;
        x = clamp(o.override.x - vw / 2, 0, Math.max(0, o.areaWidth - vw));
        const yM = Math.max(0, o.screenH - vh);
        const oy = o.override.feetY != null ? o.override.feetY + CAMERA.footroom - vh : yM * clamp(CAMERA.yBias ?? 1, 0, 1);
        y = clamp(oy, 0, yM);
        primed = true; cutNext = true; // hand back to the follow lens with a cut
        frame = { x: Math.round(x), y, viewW: vw, viewH: vh, zoom, shakeX: 0, shakeY: 0 };
        return frame;
      }
      const snap = cutNext || !primed;
      cutNext = false;
      const reduced = reducedMotion();
      const zTarget = zoomFor(o.areaId);
      // Area changes already cut the picture, so magnification cuts with them.
      // Zoom still eases if the constants change mid-stroll (no cut).
      zoom = snap ? zTarget : damp(zoom, zTarget, o.dt, CAMERA.zoomSmoothTime);
      zoom = Math.max(1, zoom);

      const viewW = o.screenW / zoom;
      const viewH = o.screenH / zoom;
      // Reduced motion: no facing lead. The lens stays centered on Matthew.
      const ahead = reduced ? 0.5 : clamp(CAMERA.lookAhead ?? 0.58, 0.35, 0.8);
      // Facing right: Matthew sits left of center so the street in front fills the frame.
      const close = zoomLevel > 1;
      const maxX = Math.max(0, o.areaWidth - viewW);
      let target;
      if (!close) {
        const anchor = o.facing < 0 ? ahead : 1 - ahead;
        target = clamp(o.playerX - viewW * anchor, 0, maxX);
      } else {
        // 2x / 3x: Matthew centred, pulled toward nearby enemies so the fight stays in frame
        let cx = o.playerX;
        const near = (o.enemies || []).filter((e) => Math.abs(e.x - o.playerX) < (CAMERA.enemyRange || 320));
        if (near.length) {
          const mid = near.reduce((s, e) => s + e.x, 0) / near.length;
          // 1.9.0 3x fix: the bias shrinks with the lens so Matthew stays near the middle (3x: at most 12% off centre)
          const lim = zoomLevel >= 3 ? 0.12 : 0.22, bias = (CAMERA.enemyBias ?? 0.5) * (zoomLevel >= 3 ? 0.6 : 1);
          cx += clamp((mid - o.playerX) * bias, -viewW * lim, viewW * lim);
        }
        target = clamp(cx - viewW / 2, 0, maxX);
      }

      if (snap || !(CAMERA.smoothTime > 0)) {
        x = target;
      } else {
        let next = damp(x, target, o.dt, CAMERA.smoothTime);
        const cap = Math.max(0, CAMERA.maxSpeed) * Math.max(0, o.dt || 0);
        if (cap > 0) {
          const d = next - x;
          if (Math.abs(d) > cap) next = x + Math.sign(d) * cap;
        }
        x = clamp(next, 0, maxX);
      }
      primed = true;

      let sx = 0;
      let sy = 0;
      if (reduced) mag = 0;
      else if (mag > 0.15 && o.dt > 0) {
        phase += o.dt * 46;
        sx = Math.round(Math.sin(phase * 2.3) * mag);
        sy = Math.round(Math.cos(phase * 1.7) * mag * 0.4);
        mag *= Math.exp(-(o.dt) / 0.09);
        if (mag < 0.15) mag = 0;
      }
      const yMax = Math.max(0, o.screenH - viewH);
      let yBase = yMax * clamp(CAMERA.yBias ?? 1, 0, 1);
      if (close && o.playerY != null) {
        // loosen the bottom anchor: keep head room above the feet first, then foot room below
        const feet = o.playerY;
        let want = feet + CAMERA.footroom - viewH;                 // feet near the bottom edge
        const headTop = feet - CAMERA.headroom;
        if (want > headTop) want = headTop;                         // never crop the head
        if (viewH < CAMERA.headroom + CAMERA.footroom) want = feet + 6 - viewH; // 3x: lens shorter than the cast — feet just in, as much head as fits
        yBase = clamp(want, 0, yMax);
        y = (snap || y == null) ? yBase : damp(y, yBase, o.dt, CAMERA.smoothTime);
        yBase = y;
      } else y = yBase;
      frame = {
        x: Math.round(clamp(x + sx, 0, maxX)),
        y: clamp(yBase + sy, 0, yMax),
        viewW,
        viewH,
        zoom,
        shakeX: sx,
        shakeY: sy
      };
      return frame;
    }
  };
}
