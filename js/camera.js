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
  zoom: 1.34,
  landmarkZoom: 1.13,
  landmarkAreas: ['star'],
  lookAhead: 0.58,
  smoothTime: 0.2,
  maxSpeed: 780,
  zoomSmoothTime: 0.5,
  yBias: 1
};

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
    return Math.max(1, (far ? CAMERA.landmarkZoom : CAMERA.zoom) || 1);
  }

  return {
    get frame() { return frame; },
    /** Next update cuts to the target (area change, respawn, warp, new game). */
    cut() { cutNext = true; mag = 0; },
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
     * @param {object} o { playerX, facing, areaWidth, areaId, screenW, screenH, dt }
     * @returns {{ x, y, viewW, viewH, zoom, shakeX, shakeY }}
     */
    update(o) {
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
      const anchor = o.facing < 0 ? ahead : 1 - ahead;
      const maxX = Math.max(0, o.areaWidth - viewW);
      const target = clamp(o.playerX - viewW * anchor, 0, maxX);

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
      const yBase = yMax * clamp(CAMERA.yBias ?? 1, 0, 1);
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
