/**
 * vo.js: on-demand voice-over loader (Streets of Roanoke). ES module, no dependencies beyond audio.js settings.
 * - Clips: assets/vo/<char>/<lineId>.ogg (Opus) or .m4a (AAC) picked with canPlayType; index in assets/vo/manifest.json.
 *   Packaged builds stage one format and set manifest.bundled ('ogg' | 'm4a'); then only that format is requested.
 * - Nothing is fetched until preload()/play() is called (no service-worker precache, no app-files.json entries).
 * - Volume follows the SFX slider + mute from js/audio.js (same curve: sfx², 0 when muted).
 * - Any failure (missing file, offline, autoplay block) resolves quietly: subtitles/text still show.
 */
import { getAudioSettings } from './audio.js';

const BASE = 'assets/vo/';
const LRU_MAX = 48;                      // decoded clips kept as blob URLs
const cache = new Map();                 // lineId -> Promise<string|null> (blob URL), Map order = LRU
let manifest = null, manifestP = null, ext = null, bundled = null, cur = null, duckFn = null, enabled = true;

function pickExt() {
  if (ext !== null) return ext;
  if (bundled) { // packaged app (Electron/Android: ogg, iOS: m4a): request only what is bundled; unplayable = silent
    try { const a = document.createElement('audio'); ext = a.canPlayType(bundled === 'ogg' ? 'audio/ogg; codecs="opus"' : 'audio/mp4; codecs="mp4a.40.2"') ? bundled : ''; } catch (_) { ext = ''; }
    return ext;
  }
  try {
    const a = document.createElement('audio');
    ext = a.canPlayType('audio/ogg; codecs="opus"') ? 'ogg' : a.canPlayType('audio/mp4; codecs="mp4a.40.2"') ? 'm4a' : '';
  } catch (_) { ext = ''; }
  return ext;
}
function loadManifest() {
  if (manifest) return Promise.resolve(manifest);
  if (!manifestP) manifestP = fetch(BASE + 'manifest.json').then((r) => (r.ok ? r.json() : null)).then((m) => { bundled = (m && (m.bundled === 'ogg' || m.bundled === 'm4a')) ? m.bundled : null; ext = null; return (manifest = (m && m.lines) || {}); })
    .catch(() => (manifest = {}));
  return manifestP;
}
function volume() {
  const s = getAudioSettings();
  return s.muted ? 0 : Math.max(0, Math.min(1, s.sfx * s.sfx * 1.6)); // VO sits a bit above SFX on the same slider
}
function touch(id, p) { cache.delete(id); cache.set(id, p); while (cache.size > LRU_MAX) { const [k, old] = cache.entries().next().value; cache.delete(k); old.then((u) => u && URL.revokeObjectURL(u)); } }
function fetchClip(id) {
  if (cache.has(id)) { const p = cache.get(id); touch(id, p); return p; }
  const p = loadManifest().then((m) => {
    const e = m[id], x = pickExt();
    if (!e || !x) return null;
    return fetch(`${BASE}${e.file}.${x}`).then((r) => (r.ok ? r.blob() : null)).then((b) => (b ? URL.createObjectURL(b) : null));
  }).catch(() => null);
  touch(id, p);
  p.then((u) => { if (!u) cache.delete(id); }); // don't pin failures
  return p;
}

/** Warm clips for a scene. Accepts line ids and/or scene ids (manifest `scene`, e.g. 'npc.dee', 'dlc.m4', 'prison.arrest', 'bark.thug_hot'). */
export function preload(ids) {
  const list = Array.isArray(ids) ? ids : [ids];
  return loadManifest().then((m) => {
    const want = new Set();
    for (const id of list) { if (m[id]) want.add(id); else for (const k in m) if (m[k].scene === id) want.add(k); }
    return Promise.all([...want].map(fetchClip)).then((r) => r.filter(Boolean).length);
  });
}
/** Play one line. Resolves true when it finished, false if skipped/missing/stopped. Never rejects. */
export function play(lineId) {
  stop();
  if (!enabled || !lineId || volume() <= 0) return Promise.resolve(false);
  const token = {};
  cur = { token, a: null };
  return fetchClip(lineId).then((url) => new Promise((res) => {
    if (!url || !cur || cur.token !== token) return res(false);
    const a = new Audio(url); a.volume = volume(); cur.a = a; cur.res = res;
    const end = (ok) => { if (cur && cur.a === a) { cur = null; duck(false); } res(ok); };
    a.onended = () => end(true); a.onerror = () => end(false);
    duck(true);
    a.play().catch(() => end(false));
  })).catch(() => false);
}
/** Stop the current line (resolves its play() promise with false). */
export function stop() {
  if (!cur) return;
  const c = cur; cur = null;
  if (c.a) { try { c.a.pause(); } catch (_) { /* gone */ } duck(false); }
  if (c.res) c.res(false);
}
export function isPlaying() { return !!(cur && cur.a); }
/** Ducking hook: fn(on:boolean) is called when VO starts/stops (e.g. dip music / talk blips). */
export function setDuckHandler(fn) { duckFn = typeof fn === 'function' ? fn : null; }
function duck(on) { try { duckFn && duckFn(on); } catch (_) { /* hook errors never break VO */ } }
/** Global VO switch (e.g. a future "Voice: on/off" setting). */
export function setVoEnabled(on) { enabled = !!on; if (!enabled) stop(); }
/** Re-apply volume after the SFX slider / mute changes. */
export function refreshVolume() { if (cur && cur.a) cur.a.volume = volume(); }
/** Lookup helper for hooks that only have speaker + text (e.g. main.js showLine). */
export function lineIdFor(text, char) {
  if (!manifest) return null;
  for (const k in manifest) if (manifest[k].text === text && (!char || manifest[k].speaker === char || manifest[k].char === char)) return k;
  return null;
}
export { loadManifest as voReady };
export function voDebug() { return { ext: pickExt(), cached: [...cache.keys()], playing: cur && cur.a ? cur.a.src : null, enabled }; }
