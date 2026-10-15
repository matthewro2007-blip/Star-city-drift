/**
 * Zoom UI (Bob). UI only: never touches the camera, never persists, no keybindings (those are Arlo's).
 * Contract with camera.js (Arlo, 1.9.0):
 *  - set:  window.dispatchEvent(new CustomEvent('sor:zoom', { detail: { level } }))  level = 1 | 2 | 3
 *  - read: window.sorZoom?.get?.()  (current level; label defaults to 1x when camera.js isn't there)
 *  - 'sor:zoomchanged' (detail.level) refreshes the labels; camera.js persists 'sor_zoom' itself.
 * Controls: pause-menu cycle button #btn-zoom (gamepad menu nav / .pad-focus) and touch button #btn-zoom-touch (phones).
 */
const LEVELS = [1, 2, 3];
let shown = 1; // last level we know of (from the camera, an event, or our own request)

export function currentZoom() {
  try {
    const v = Number(window.sorZoom && typeof window.sorZoom.get === 'function' ? window.sorZoom.get() : NaN);
    if (LEVELS.includes(v)) shown = v;
  } catch { /* camera not ready */ }
  return shown;
}
export function requestZoom(level) {
  if (!LEVELS.includes(level)) return;
  if (!(window.sorZoom && typeof window.sorZoom.get === 'function')) shown = level; // no camera yet: show the request
  try { window.dispatchEvent(new CustomEvent('sor:zoom', { detail: { level } })); } catch { /* old browser */ }
  syncLabels();
}
export function cycleZoom() { const c = currentZoom(); requestZoom(LEVELS[(LEVELS.indexOf(c) + 1) % LEVELS.length]); }

function syncLabels() {
  const z = currentZoom();
  const b = document.getElementById('btn-zoom');
  if (b) { const t = `Zoom: ${z}x ▸`; if (b.textContent !== t) b.textContent = t; }
  const lbl = document.getElementById('zoom-touch-level');
  if (lbl && lbl.textContent !== `${z}x`) lbl.textContent = `${z}x`;
  const tb = document.getElementById('btn-zoom-touch');
  if (tb) tb.setAttribute('aria-label', `Zoom ${z}x (tap to change)`);
}

function init() {
  const b = document.getElementById('btn-zoom');
  if (b) b.addEventListener('click', cycleZoom);
  const tb = document.getElementById('btn-zoom-touch');
  if (tb) {
    tb.addEventListener('pointerdown', (e) => e.stopPropagation()); // keep the tap off the game canvas / joystick
    tb.addEventListener('click', (e) => { e.stopPropagation(); cycleZoom(); });
  }
  window.addEventListener('sor:zoomchanged', (e) => {
    const v = Number(e && e.detail ? e.detail.level : NaN);
    if (LEVELS.includes(v)) shown = v;
    syncLabels();
  });
  syncLabels();
  setTimeout(syncLabels, 0); // camera.js may define window.sorZoom after us
}
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
}
