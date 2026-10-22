/**
 * Animated sprites — loads PNG sheets when available, canvas fallback.
 * Matthew v3: one 1152x192 sheet per outfit (8 frames of 144x192, same poses), see ASSETS.md.
 * Thugs + Silas (boss) use the same 8-pose sheet layout; NPCs are single 144x192 stills.
 *
 * 1.8.0-hd (staged, see HD_CONTRACT.md): art may be authored at artScale 2 (288x384 cells, soft alpha).
 * Every value this module RETURNS is in logical (1x) units: anchorX, feetRow, hitbox, dw/dh, anchorY.
 * sx/sy/sw/sh stay the SOURCE rect in image pixels (what drawImage needs); draw it at dw x dh.
 * `smooth` is true for HD art (draw with imageSmoothingEnabled = true, quality 'high').
 */

const SCALE = 2;
const cache = new Map();
const images = {};
let loaded = false;
let loadPromise = null;

const SHEET = {
  matthew: { src: 'assets/sprites/matthew_sheet.png', frameW: 48 * 3, frameH: 64 * 3, poses: {
    idle: [0, 1], walk: [2, 3], punch: [4, 5], kick: [6], hurt: [7]
  }}
};

/** Per-outfit Matthew sheets (same layout contract as SHEET.matthew). Unknown ids try
 *  assets/sprites/matthew_<id>.png lazily, else use the default sheet. */
const OUTFIT_SHEETS = {
  polo: 'assets/sprites/matthew_sheet.png',
  photo: 'assets/sprites/matthew_photo.png',
  hoodie: 'assets/sprites/matthew_hoodie.png',
  jacket: 'assets/sprites/matthew_jacket.png',
  street: 'assets/sprites/matthew_street.png',
  varsity: 'assets/sprites/matthew_varsity.png',
  mechanic: 'assets/sprites/matthew_mechanic.png',
  diner: 'assets/sprites/matthew_diner.png',
  gold: 'assets/sprites/matthew_gold.png',
  webslinger: 'assets/sprites/matthew_webslinger.png',
  beacon: 'assets/sprites/matthew_beacon.png',
  ironclad: 'assets/sprites/matthew_ironclad.png',     // display name "Hell's Nightmare"
  silas: 'assets/sprites/matthew_silas.png',            // 1.5.1: Silas's Suit (prequel DLC reward)
  darkstar: 'assets/sprites/matthew_darkstar.png',
  cinder: 'assets/sprites/matthew_cinder.png'          // 1.7.0: Cinder Hollow Orange (first visit to Silas's cell)       // 1.6.0: Dark Star Suit (beat the main campaign)
};
/** Cache-bust for outfit sheets / outfit portraits (bump when sheets are regenerated). */
const SPRITE_REV = '1.9.1-m2028';
const vb = (src) => src + (src.includes('?') ? '&' : '?') + 'v=' + SPRITE_REV;
/** Optional per-outfit HUD/picker busts (112x112); outfits without one use portrait_matthew.png. */
const OUTFIT_PORTRAITS = { ironclad: 'assets/sprites/portrait_matthew_ironclad.png', silas: 'assets/sprites/portrait_matthew_silas.png' };
const outfitPortraits = {};
/** 1.5.0 DLC: per-character HUD busts (112x112) for non-Matthew playable characters. */
const CHARACTER_PORTRAITS = { silas_player: 'assets/sprites/portrait_silas.png', silas_c14: 'assets/sprites/portrait_silas.png', silas_red: 'assets/sprites/portrait_silas.png' }; // 2.0.0 Blackriver
const characterPortraits = {};
const outfitSheets = {};      // outfitId -> Image (loaded)
const outfitPending = {};     // outfitId -> true while lazily loading / after failure

/** Enemy fight sheets (8-pose layout). Keyed by thug colour from combat.js THUG_COLORS. */
const ENEMY_SHEET_SRC = {
  thug_purple: 'assets/sprites/thug_purple_sheet.png',
  thug_red: 'assets/sprites/thug_red_sheet.png',
  thug_teal: 'assets/sprites/thug_teal_sheet.png',
  thug_orange: 'assets/sprites/thug_orange_sheet.png',
  thug_grey: 'assets/sprites/thug_grey_sheet.png',
  silas: 'assets/sprites/silas_sheet.png'
};
const THUG_BY_COLOR = {
  '#8e44ad': 'thug_purple', '#c0392b': 'thug_red', '#16a085': 'thug_teal',
  '#d35400': 'thug_orange', '#7f8c8d': 'thug_grey'
};
const enemySheets = {};

const NPC_SRC = {
  dee: 'assets/sprites/dee.png',
  // 1.7.0 "Locked Up": Cinder Hollow cast + the arrest
  ellis: 'assets/sprites/ellis.png',
  ramos: 'assets/sprites/ramos.png',
  quay: 'assets/sprites/quay.png',
  reed: 'assets/sprites/reed.png',
  mina: 'assets/sprites/mina.png',
  dora: 'assets/sprites/dora.png',
  otto: 'assets/sprites/otto.png',
  bart: 'assets/sprites/bart.png',
  silas_prison: 'assets/sprites/silas_prison.png',
  reyes: 'assets/sprites/reyes.png',
  okafor: 'assets/sprites/okafor.png',
  silas_cuffed: 'assets/sprites/silas_cuffed.png',
  // 1.9.0-cutscene: Marcus Hale (2015 / 2026 / 2028) + teenage Matthew (2015 prequel NPC)
  marcus_young: 'assets/sprites/marcus_young.png',
  marcus: 'assets/sprites/marcus.png',
  william: 'assets/sprites/william.png', // 2.0.2: William Burks
  marcus_lockkeeper: 'assets/sprites/marcus_lockkeeper.png',
  matthew_young: 'assets/sprites/matthew_young.png',
  matthew_2028: 'assets/sprites/matthew_2028.png',   // 1.9.1-m2028: Blackriver DLC NPC (age ~29)
  // 1.9.1: 2015 prequel cast (js/dlc_silas.js CAST): Rosa Calloway + the 2015 selves of the Cinder Hollow inmates
  rosa: 'assets/sprites/rosa.png',
  dora_young: 'assets/sprites/dora_young.png',
  mina_young: 'assets/sprites/mina_young.png',
  bart_young: 'assets/sprites/bart_young.png',
  otto_young: 'assets/sprites/otto_young.png',
  priya: 'assets/sprites/priya.png',
  hank: 'assets/sprites/hank.png',
  june: 'assets/sprites/june.png',
  tessa: 'assets/sprites/tessa.png',
  coach: 'assets/sprites/coach.png',
  cam: 'assets/sprites/cam.png',
  wren: 'assets/sprites/wren.png',
  // 1.5.2: prequel (DLC "Second Shift") NPCs, ids from js/dlc_silas.js CAST — never the rectangle fallback
  lou: 'assets/sprites/lou.png',
  gus: 'assets/sprites/gus.png',
  ivy: 'assets/sprites/ivy.png',
  pip: 'assets/sprites/pip.png',
  silas: 'assets/sprites/silas.png',
  thug_purple: 'assets/sprites/thug_purple.png',
  thug_red: 'assets/sprites/thug_red.png',
  thug_teal: 'assets/sprites/thug_teal.png',
  thug_orange: 'assets/sprites/thug_orange.png',
  thug_grey: 'assets/sprites/thug_grey.png'
};

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

export function loadSprites() {
  if (loadPromise) return loadPromise;
  loadPromise = (async () => {
    try {
      images.matthewSheet = await loadImage(SHEET.matthew.src);
      images.portrait = await loadImage('assets/sprites/portrait_matthew.png');
      images.heart = await loadImage('assets/sprites/heart.png');
      images.heartEmpty = await loadImage('assets/sprites/heart_empty.png');
      outfitSheets.polo = images.matthewSheet;
      const opt = async (src) => { try { return await loadImage(src); } catch (_) { console.warn('Sprite missing:', src); return null; } };
      await Promise.all([
        ...Object.entries(OUTFIT_SHEETS).filter(([id]) => id !== 'polo').map(async ([id, src]) => {
          const img = await opt(vb(src)); if (img) outfitSheets[id] = img; else outfitPending[id] = true;
        }),
        ...Object.entries(OUTFIT_PORTRAITS).map(async ([id, src]) => { const img = await opt(vb(src)); if (img) outfitPortraits[id] = img; }),
        ...Object.entries(CHARACTER_PORTRAITS).map(async ([k, src]) => { const img = await opt(vb(src)); if (img) characterPortraits[k] = img; }),
        ...Object.entries(NPC_SRC).map(async ([k, src]) => { const img = await opt(src); if (img) images[k] = img; }),
        ...Object.entries(ENEMY_SHEET_SRC).map(async ([k, src]) => { const img = await opt(src); if (img) enemySheets[k] = img; }),
        loadAnimManifests(),
        loadCollectibles(),
        loadWeapons()
      ]);
      loaded = true;
    } catch (e) {
      console.warn('Sprite sheet load failed, using canvas fallback', e);
      loaded = false;
    }
    return loaded;
  })();
  return loadPromise;
}

// ---------------------------------------------------------------- extended animations
// anims.json (Matthew outfits + cast) and optional anims_enemies.json (enemies) share one schema
// (see ASSETS.md "Animation manifest"); both merge into ANIM_MANIFEST[charKey].states[state].
const ANIM_MANIFEST = {};
/** artScale of a state / character / manifest (1 = legacy 144x192 art). */
const artScaleOf = (...o) => { for (const x of o) if (x && x.artScale) return x.artScale; return 1; };
const animImages = {};
let ANIM_REV = '';
const CHAR_ALIASES = { coachray: 'coach', ray: 'coach', raydelgado: 'coach', deemorales: 'dee', priyashah: 'priya',
  hankrail: 'hank', hankpettigrew: 'hank', rail: 'hank', junewhitaker: 'june', tessaquinn: 'tessa', camortiz: 'cam',
  wrencalloway: 'wren', loubadger: 'lou', guspell: 'gus', ivymarsh: 'ivy', silasboone: 'silas', silasnpc: 'silas', stranger: 'silas', boss: 'silas_boss', silasboss: 'silas_boss',
  matthewrose: 'matthew', player: 'matthew', hero: 'matthew', runner: 'snatcher', pursesnatcher: 'snatcher',
  // 1.9.0-cutscene (manifest keyAliases are merged in too)
  lockkeeper: 'marcus_lockkeeper', thelockkeeper: 'marcus_lockkeeper', marcushale: 'marcus', kessler: 'foreman', mortkessler: 'foreman',
  rosacalloway: 'rosa', dorakeene: 'dora', minasolis: 'mina', bartholley: 'bart', ottopike: 'otto',
  matthewolder: 'matthew_2028', matthewblackriver: 'matthew_2028' };
export const ANIM_STATES = {
  matthew: ['idle_signature', 'run', 'sprint', 'combo1', 'combo2', 'combo3', 'jump_kick', 'special',
    'hurt', 'ko', 'victory', 'knockdown_fall', 'knockdown_ground', 'getup'],
  cast: ['idle_personality', 'talk'],
  /** 2.0.2: William Burks (anims.json `william`): NPC set + the full player set for co-op (Phase B). */
  william: ['idle_personality', 'talk', 'walk', 'idle_signature', 'run', 'sprint', 'combo1', 'combo2', 'combo3', 'jump_kick', 'special',
    'hurt', 'ko', 'victory', 'knockdown_fall', 'knockdown_ground', 'getup'],
  boss: ['boss_attack1', 'boss_attack2', 'boss_attack3', 'taunt', 'defeat', 'knockdown_fall', 'knockdown_ground', 'getup'],
  thug: ['attackA', 'attackB', 'ko', 'knockdown_fall', 'knockdown_ground', 'getup'],
  snatcher: ['idle', 'run', 'caught', 'ko', 'knockdown_fall', 'knockdown_ground', 'getup'],
  silas_player: ['idle_signature', 'idle', 'walk', 'run', 'sprint', 'combo1', 'combo2', 'combo3', 'jump_kick', 'special',
    'hurt', 'ko', 'victory', 'knockdown_fall', 'knockdown_ground', 'getup',
    'hs_grab', 'hs_slam', 'velvet_grip_grab', 'velvet_grip_throw', 'last_word_stance', 'last_word_strike', 'cold_stare', 'boss_rush',
    'gentlemans_jab', 'jab1', 'jab2', 'jab3', 'iron_handshake', 'velvet_grip', 'last_word', 'grab', 'whiff', 'throw', 'stance', 'counter', 'stare', 'rush'],
  /** 1.5.1: extra states of matthew_silas (Silas's Suit) on top of ANIM_STATES.matthew; same names/aliases as silas_player. */
  matthew_silas: ['jab1', 'jab2', 'jab3', 'gentlemans_jab', 'velvet_grip_grab', 'velvet_grip_throw', 'velvet_grip', 'hs_grab', 'hs_slam', 'iron_handshake',
    'last_word_stance', 'last_word_strike', 'last_word', 'cold_stare', 'boss_rush', 'grab', 'whiff', 'throw', 'stance', 'counter', 'stare', 'rush'],
  /** 1.5.2: prequel bosses (own art, anims_enemies.json): boss set + attackA/attackB aliases for the createThug() miniBoss path. */
  vera: ['boss_attack1', 'boss_attack2', 'boss_attack3', 'taunt', 'defeat', 'ko', 'knockdown_fall', 'knockdown_ground', 'getup',
    'idle', 'walk', 'run', 'hurt', 'attackA', 'attackB'],
  foreman: ['boss_attack1', 'boss_attack2', 'boss_attack3', 'taunt', 'defeat', 'ko', 'knockdown_fall', 'knockdown_ground', 'getup',
    'idle', 'walk', 'run', 'hurt', 'attackA', 'attackB'],
  foreman_crew: ['attackA', 'attackB', 'ko', 'knockdown_fall', 'knockdown_ground', 'getup', 'idle', 'walk', 'run', 'hurt'],
  /** 2.0.1 Blackriver: derived from foreman_crew / foreman (tools/gen_guards.py); same states as their source rig. */
  guard_co: ['attackA', 'attackB', 'ko', 'knockdown_fall', 'knockdown_ground', 'getup', 'idle', 'walk', 'run', 'hurt'],
  guard_baton: ['attackA', 'attackB', 'ko', 'knockdown_fall', 'knockdown_ground', 'getup', 'idle', 'walk', 'run', 'hurt'],
  guard_riot: ['attackA', 'attackB', 'ko', 'knockdown_fall', 'knockdown_ground', 'getup', 'idle', 'walk', 'run', 'hurt'],
  guard_sgt: ['attackA', 'attackB', 'ko', 'knockdown_fall', 'knockdown_ground', 'getup', 'idle', 'walk', 'run', 'hurt'],
  br_voss: ['boss_attack1', 'boss_attack2', 'boss_attack3', 'taunt', 'defeat', 'ko', 'knockdown_fall', 'knockdown_ground', 'getup', 'idle', 'walk', 'run', 'hurt', 'attackA', 'attackB'],
  br_lockkeeper: ['boss_attack1', 'boss_attack2', 'boss_attack3', 'taunt', 'defeat', 'ko', 'knockdown_fall', 'knockdown_ground', 'getup', 'idle', 'walk', 'run', 'hurt', 'attackA', 'attackB']
};

async function fetchManifest(src, quiet) {
  try {
    const r = await fetch(src, { cache: 'no-cache' });   // revalidate: a stale manifest hid new characters
    if (!r.ok) { if (!quiet) console.warn('Anim manifest missing:', src); return null; }
    const txt = await r.text();
    let h = 0; for (let i = 0; i < txt.length; i++) h = (h * 31 + txt.charCodeAt(i)) | 0;
    const j = JSON.parse(txt); j.__hash = (h >>> 0).toString(36); return j;
  } catch (_) { if (!quiet) console.warn('Anim manifest failed:', src); return null; }
}

let ANIM_LATE = Promise.resolve(), LATE_FILES = new Set(), lateLoad = () => null;
/** 2.0.3: resolves once every streamed anim strip has loaded (tests / captures). */
export function animStripsReady() { return Promise.all([...LATE_FILES].map((f) => lateLoad(f))); }
async function loadAnimManifests() {
  const [main, enemies, poses, portraits] = await Promise.all([
    fetchManifest('assets/sprites/anims.json', false),
    fetchManifest('assets/sprites/anims_enemies.json', true),   // optional (Jack's file)
    fetchManifest('assets/sprites/cutscene_poses.json', true),  // 1.9.0-cutscene: cs_<pose> states (frame 0 closed, 1 open)
    fetchManifest('assets/sprites/portraits.json', true)        // 1.9.0-cutscene: dialogue busts (loaded lazily by getPortrait)
  ]);
  // cache-bust strips by manifest content: any regenerate (mine or Jack's) changes the URL
  ANIM_REV = [main, enemies, poses].map((m) => m && m.__hash).filter(Boolean).join('.') || String(Date.now());
  if (portraits && portraits.characters) { PORTRAITS.m = portraits; PORTRAITS.rev = portraits.__hash || ''; }
  for (const m of [main, enemies]) if (m && m.keyAliases) for (const [a, k] of Object.entries(m.keyAliases)) CHAR_ALIASES[a.replace(/_/g, '')] = k;
  for (const m of [main, enemies, poses]) {
    if (!m || !m.characters) continue;
    for (const [key, ch] of Object.entries(m.characters)) {
      const dst = ANIM_MANIFEST[key] || (ANIM_MANIFEST[key] = { file: ch.file, wideFile: ch.wideFile, states: {} });
      if (ch.wideFile) dst.wideFile = ch.wideFile;
      const s = artScaleOf(ch, m);          // stamp the scale on every state so mixed 1x/2x manifests merge safely
      for (const [n, st] of Object.entries(ch.states || {})) dst.states[n] = st.artScale ? st : { ...st, artScale: s };
    }
  }
  const files = new Set();
  for (const ch of Object.values(ANIM_MANIFEST)) {
    if (ch.file) files.add(ch.file); if (ch.wideFile) files.add(ch.wideFile);
    for (const st of Object.values(ch.states)) for (const f of [].concat(st.file || ch.file)) files.add(f);   // file may be a per-frame list
  }
  const load = async (src) => {
    try { animImages[src] = await loadImage(src + '?v=' + ANIM_REV); } catch (_) { console.warn('Anim strip missing:', src); }
  };
  // 2.0.3: the per-state *_jk strips (~150 MB) stream in after boot; until one lands, getAnimFrame returns null for
  // that state and the caller's fallback draws (same as before the art existed)
  const all = [...files].filter(Boolean), late = all.filter((f) => /_jk\.png$/.test(f));
  await Promise.all(all.filter((f) => !late.includes(f)).map(load));
  // loaded on first use (getAnimFrame) and streamed in the background right after boot, four at a time
  const pending = new Map();
  lateLoad = (src) => { if (!pending.has(src)) pending.set(src, load(src)); return pending.get(src); };
  LATE_FILES = new Set(late);
  const afterLoad = (fn) => (document.readyState === 'complete' ? setTimeout(fn, 0) : addEventListener('load', () => setTimeout(fn, 0), { once: true })); // don't hold up window.onload
  ANIM_LATE = new Promise((res) => afterLoad(async () => {
    const q = late.slice().sort((x, y) => (/matthew_(?!polo)/.test(x) ? 1 : 0) - (/matthew_(?!polo)/.test(y) ? 1 : 0)); // other outfits last
    await Promise.all([0, 1, 2, 3].map(async () => { while (q.length) await lateLoad(q.shift()); }));
    res();
  }));
}

function outfitKey(o) {
  if (o && typeof o === 'object') o = o.id || o.key || o.outfitId || o.name;
  o = String(o || 'polo').toLowerCase().replace(/^matthew[_-]?/, '').replace(/[^a-z0-9]/g, '');
  return o || 'polo';
}
const squash = (k) => String(k || '').replace(/([a-z])([A-Z])/g, '$1_$2').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
// Accepts 'dee'/'Dee'/'coach_ray'/'coachRay'/'thug-Purple'/'matthew_hoodie'/'matthew' + outfit (string or {id}).
function animKey(charKey, outfitId) {
  let k = squash(charKey);
  if (k.startsWith('matthew_') && !ANIM_MANIFEST[k]) { outfitId = k.slice(8); k = 'matthew'; }
  if (!ANIM_MANIFEST[k]) k = CHAR_ALIASES[k.replace(/_/g, '')] || CHAR_ALIASES[k.split('_')[0]] || k;
  if (!ANIM_MANIFEST[k] && !k.startsWith('matthew')) { const first = k.split('_')[0]; if (ANIM_MANIFEST[first]) k = first; }
  if (k === 'matthew') {
    const m = 'matthew_' + outfitKey(outfitId);
    return ANIM_MANIFEST[m] ? m : 'matthew_polo';
  }
  return k;
}

/** True when charKey (and, for matthew, that exact outfit) has its own anim strips — no polo fallback. */
export function hasAnims(charKey, outfitId) {
  const k = animKey(charKey, outfitId);
  if (k.startsWith('matthew_') && squash(charKey) === 'matthew') return k === 'matthew_' + outfitKey(outfitId) && !!ANIM_MANIFEST[k];
  return !!ANIM_MANIFEST[k];
}

export function listAnims(charKey, outfitId) {
  const ch = ANIM_MANIFEST[animKey(charKey, outfitId)];
  return ch ? Object.keys(ch.states) : [];
}

// -> {img, sx, sy, sw, sh, anchorX, feetRow, done, active, hitbox, grounded, lying, index} or null (caller falls back).
// Draw so frame-x anchorX sits on the actor's x and row feetRow on its ground y (sw/sh may exceed 144x192).
// aliasOf: a state with no own frames is the concatenation of the named states (if it has frames, they win)
function resolveState(ch, state, depth = 0) {
  const st = ch && ch.states[state];
  if (!st) return null;
  if ((st.frames && st.frames.length) || !st.aliasOf || depth > 3) return st;
  const parts = [].concat(st.aliasOf).map((n) => resolveState(ch, n, depth + 1)).filter(Boolean);
  if (!parts.length) return null;
  const cat = (k, d) => parts.flatMap((p) => p.frames.map((_, i) => (Array.isArray(p[k]) ? p[k][i] : (p[k] !== undefined ? p[k] : d))));
  const r = { ...parts[0], ...st, frames: cat('frames'), file: undefined,
    fwA: cat('fw', 144), fhA: cat('fh', 192), ax: cat('anchorX', null),
    sx: cat('sx', null), sw: cat('sw', null), sy: cat('sy', 0), sh: cat('sh', null),
    grounded: cat('grounded', true), lying: cat('lying', false), active: cat('active', false), hitbox: cat('hitbox', null),
    artScaleA: parts.flatMap((p) => p.frames.map(() => p.artScale || 1)), feetRowA: cat('feetRow', null) };
  r._files = parts.flatMap((p) => p.frames.map((_, i) => (Array.isArray(p.file) ? p.file[i] : p.file) || ch.file));
  ch.states[state] = r;                      // cache
  return r;
}

// -> {img, sx, sy, sw, sh, anchorX, feetRow, done, active, hitbox, grounded, lying, index} or null (caller falls back).
// Draw so frame-x anchorX sits on the actor's x and row feetRow on its ground y (sw/sh may exceed 144x192).
export function getAnimFrame(charKey, state, tMs, outfitId) {
  const key = animKey(charKey, outfitId);
  let ch = ANIM_MANIFEST[key];
  let st = resolveState(ch, state);
  if (!st && key.startsWith('matthew_') && key !== 'matthew_polo') { ch = ANIM_MANIFEST.matthew_polo; st = resolveState(ch, state); }
  if (!st || !st.frames || !st.frames.length) return null;
  const n = st.frames.length;
  let i = Math.floor(Math.max(0, tMs || 0) * (st.fps || 10) / 1000);
  let done = false;
  if (st.loop) i %= n; else if (i >= n - 1) { i = n - 1; done = true; }
  const pick = (a, d) => (Array.isArray(a) ? (a[i] != null ? a[i] : d) : (a != null ? a : d));
  const file = st._files ? st._files[i] : (pick(st.file, null) || ch.file);
  const img = animImages[file];
  if (!img) { if (LATE_FILES.has(file)) lateLoad(file); return null; } // 2.0.3: streamed strip, first use
  const s = pick(st.artScaleA, st.artScale || 1);
  const fw = pick(st.fwA, st.fw || 144 * s), fh = pick(st.fhA, st.fh || 192 * s), idx = st.frames[i];
  const sw = pick(st.sw, fw), sh = pick(st.sh, fh), sx = pick(st.sx, idx * fw), sy = pick(st.sy, 0);
  const ax = pick(st.ax, pick(st.anchorX, sw / 2));                 // anchorX may be a per-frame list (480-wide cells)
  const fr = pick(st.feetRowA, pick(st.feetRow, sh - 3 * s));
  const hb = pick(st.hitbox, null);
  return { img, sx, sy, sw, sh, dw: sw / s, dh: sh / s, artScale: s, smooth: s > 1, done, index: i,
    anchorX: ax / s, feetRow: fr / s,
    active: !!pick(st.active, false), hitbox: hb ? { x: hb.x / s, y: hb.y / s, w: hb.w / s, h: hb.h / s } : null,
    grounded: pick(st.grounded, true) !== false, lying: !!pick(st.lying, false) };
}

// ---------------------------------------------------------------- 1.9.0-cutscene: cutscene poses + dialogue portraits
/** Cutscene pose cell: pose = 'talk'|'point'|'crossed'|'shocked'|'laugh'|'kneel' (or 'cs_talk'), open = mouth open.
 * -> same shape as getAnimFrame (dw/dh/anchorX/feetRow in logical px, artScale normalised) or null (fall back to idle). */
export function getCutscenePose(charKey, pose, open, outfitId) {
  const key = animKey(charKey, outfitId);
  const name = String(pose || 'talk').startsWith('cs_') ? pose : 'cs_' + pose;
  let ch = ANIM_MANIFEST[key], st = resolveState(ch, name);
  if (!st && key.startsWith('matthew_') && key !== 'matthew_polo') { ch = ANIM_MANIFEST.matthew_polo; st = resolveState(ch, name); }
  if (!st || !st.frames || !st.frames.length) return null;
  const i = open && st.frames.length > 1 ? 1 : 0;
  const pick = (a, d) => (Array.isArray(a) ? (a[i] != null ? a[i] : d) : (a != null ? a : d));
  const img = animImages[pick(st.file, null) || ch.file];
  if (!img) return null;
  const s = st.artScale || 1, sw = pick(st.sw, st.fw || 144 * s), sh = pick(st.sh, st.fh || 192 * s);
  return { img, sx: pick(st.sx, 0), sy: pick(st.sy, 0), sw, sh, dw: sw / s, dh: sh / s, artScale: s, smooth: s > 1,
    anchorX: pick(st.anchorX, sw / 2) / s, feetRow: pick(st.feetRow, sh - 3 * s) / s, expr: st.expr || null, open: i === 1,
    grounded: true, lying: false, done: false, index: i, active: false, hitbox: null };
}

const PORTRAITS = { m: null, rev: '', img: {} };
/** Dialogue bust: expr = 'neutral'|'happy'|'angry'|'sad'|'surprised' (Marcus: neutral|angry|smug), open = mouth open.
 * Falls back to 'neutral' when the expression is missing. Loads lazily: returns null until the image arrives (draw nothing or a
 * placeholder that frame). -> {img, sw, sh, dw, dh, artScale, smooth}; dw/dh = 112 logical. size >= 300 on screen picks the 3x file. */
export function getPortrait(charKey, expr, open, size) {
  const m = PORTRAITS.m; if (!m) return null;
  let k = squash(charKey && typeof charKey === 'object' ? charKey.key || charKey.id : charKey);
  if (!m.characters[k]) { const a = animKey(k); k = m.characters[a] ? a : (m.characters[k.split('_')[0]] ? k.split('_')[0] : k); }
  const c = m.characters[k]; if (!c) return null;
  const e = c[expr] || c.neutral || Object.values(c)[0]; if (!e) return null;
  const big = size >= 300 && e.files3x;
  const src = (big ? e.files3x : e)[open ? 'open' : 'closed'];
  if (!src) return null;
  const slot = PORTRAITS.img[src];
  if (slot === undefined) {
    PORTRAITS.img[src] = null;
    loadImage(src + '?v=' + (PORTRAITS.rev || SPRITE_REV)).then((im) => { PORTRAITS.img[src] = im; }).catch(() => { console.warn('Portrait missing:', src); });
    return null;
  }
  if (!slot) return null;
  const s = big ? 3 : (m.artScale || 2);
  return { img: slot, sx: 0, sy: 0, sw: slot.width, sh: slot.height, dw: slot.width / s, dh: slot.height / s, artScale: s, smooth: true };
}
/** Warm the portrait cache for a scene (call before a dialogue so the first line isn't blank). */
export function preloadPortraits(list) { for (const [k, e] of list || []) { getPortrait(k, e, false); getPortrait(k, e, true); } }

export function getHeartImages() {
  return { full: images.heart, empty: images.heartEmpty };
}

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w * SCALE;
  c.height = h * SCALE;
  const ctx = c.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.scale(SCALE, SCALE);
  return { c, ctx };
}

function px(ctx, x, y, w, h, color) {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), w, h);
}

/** Last-resort procedural Matthew (only if matthew_sheet.png itself fails to load). v3 skin palette. */
function drawMatthewPose(ctx, pose, outfit, t) {
  const skin = '#f8d6be', skinShade = '#e6baa2', hair = '#1a1210', facial = '#1a1210';
  const shirt = outfit.shirt || '#fafaf8';
  const pants = outfit.pants || '#5a7aa8';
  const accent = outfit.accent || '#1a2f5c';
  const shoe = '#5a371e';
  let armPunch = 0, kickExt = 0, legL = 0, legR = 0, torsoX = 0;
  if (pose === 'walk') {
    const phase = t * 10;
    legL = Math.sin(phase) * 6; legR = Math.sin(phase + Math.PI) * 6;
  } else if (pose === 'punch') { armPunch = 14; torsoX = 3; }
  else if (pose === 'kick') { kickExt = 16; }
  else if (pose === 'hurt') { torsoX = -4; }

  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath(); ctx.ellipse(20, 54, 12, 3, 0, 0, Math.PI * 2); ctx.fill();

  px(ctx, 14 + legL * 0.15, 36, 5, 14, pants);
  if (kickExt) {
    px(ctx, 26, 38, 14, 5, pants);
    px(ctx, 38, 37, 6, 6, shoe);
  } else {
    px(ctx, 21 + legR * 0.15, 36, 5, 14, pants);
  }
  px(ctx, 15, 42, 3, 2, skin);
  px(ctx, 22, 44, 2, 2, skin);
  px(ctx, 13, 49, 7, 4, shoe);
  if (!kickExt) px(ctx, 20, 49, 7, 4, shoe);

  px(ctx, 12 + torsoX, 20, 16, 17, shirt);
  px(ctx, 16 + torsoX, 18, 8, 3, skin);
  px(ctx, 12 + torsoX, 36, 16, 3, '#786028');
  px(ctx, 19 + torsoX, 36, 3, 3, '#c8a03c');

  if (armPunch) {
    px(ctx, 8 + torsoX, 22, 5, 12, skin);
    px(ctx, 26 + torsoX, 22, 5 + armPunch, 5, skin);
    px(ctx, 30 + torsoX + armPunch, 20, 7, 7, skinShade);
  } else {
    // SoR combat stance fists up
    px(ctx, 6 + torsoX, 14, 7, 7, skin);
    px(ctx, 8 + torsoX, 20, 5, 10, skin);
    px(ctx, 8 + torsoX, 20, 5, 5, shirt);
    px(ctx, 29 + torsoX, 12, 7, 7, skinShade);
    px(ctx, 29 + torsoX, 18, 5, 10, skin);
    px(ctx, 27 + torsoX, 20, 5, 5, shirt);
  }

  px(ctx, 14 + torsoX, 4, 12, 14, skin);
  px(ctx, 14 + torsoX, 3, 12, 5, hair);
  px(ctx, 13 + torsoX, 5, 2, 4, hair);
  px(ctx, 25 + torsoX, 5, 2, 4, hair);
  px(ctx, 15 + torsoX, 8, 4, 1, facial);
  px(ctx, 21 + torsoX, 8, 4, 1, facial);
  px(ctx, 16 + torsoX, 10, 3, 2, '#f0ece4');
  px(ctx, 21 + torsoX, 10, 3, 2, '#f0ece4');
  px(ctx, 17 + torsoX, 10, 2, 2, '#1a1510');
  px(ctx, 22 + torsoX, 10, 2, 2, '#1a1510');
  px(ctx, 16 + torsoX, 14, 8, 2, facial);
  px(ctx, 19 + torsoX, 16, 2, 3, facial);
}

function drawNpcPose(ctx, pose, color, t, isBoss) {
  const skin = '#c4a484', pants = '#2c3e50', shoe = '#1a1a1e';
  let punchExt = 0, legL = 0, legR = 0;
  if (pose === 'walk' || pose === 'chase') {
    const phase = t * 9;
    legL = Math.sin(phase) * 5; legR = Math.sin(phase + Math.PI) * 5;
  } else if (pose === 'punch') punchExt = 12;

  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath(); ctx.ellipse(20, 54, 11, 3, 0, 0, Math.PI * 2); ctx.fill();
  px(ctx, 14, 36, 5, 14, pants); px(ctx, 21, 36, 5, 14, pants);
  px(ctx, 13, 49, 7, 4, shoe); px(ctx, 20, 49, 7, 4, shoe);
  if (isBoss) { px(ctx, 11, 20, 18, 18, '#1a2535'); px(ctx, 13, 22, 14, 14, color); }
  else px(ctx, 12, 20, 16, 17, color);
  px(ctx, 16, 18, 8, 3, skin);
  px(ctx, 8, 22, 5, 12, skin);
  if (punchExt) {
    px(ctx, 26, 22, 5 + punchExt, 5, skin);
    px(ctx, 30 + punchExt, 20, 7, 7, skin);
  } else px(ctx, 27, 22, 5, 12, skin);
  px(ctx, 14, 4, 12, 14, skin);
  px(ctx, 14, 3, 12, 5, isBoss ? '#2c3e50' : '#3a2a20');
  px(ctx, 16, 10, 3, 2, '#f0ece4'); px(ctx, 21, 10, 3, 2, '#f0ece4');
}

function sheetFrame(pose, animT) {
  const map = SHEET.matthew.poses;
  const frames = map[pose] || map.idle;
  const idx = frames[Math.floor(Math.max(0, animT) * (pose === 'walk' ? 8 : 6)) % frames.length];
  return idx;
}

/** Copy one 144x192 frame out of an 8-pose sheet (cached per key). */
function sliceFrame(img, idx, key) {
  if (cache.has(key)) return cache.get(key);
  const s = Math.max(1, Math.round(img.width / (SHEET.matthew.frameW * 8)));   // 2304-wide sheet = artScale 2
  const frameW = SHEET.matthew.frameW * s, frameH = SHEET.matthew.frameH * s;
  const c = document.createElement('canvas');
  c.width = frameW; c.height = frameH;
  const ctx = c.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(img, idx * frameW, 0, frameW, frameH, 0, 0, frameW, frameH);
  cache.set(key, c);
  return c;
}

/** 112x112 bust for an outfit (e.g. 'ironclad' = helmet on), else the default HUD portrait (or null before load). */
export function getOutfitPortrait(outfitId) {
  const id = outfitId && typeof outfitId === 'object' ? outfitId.id : outfitId;
  return outfitPortraits[id] || images.portrait || null;
}

/** 112x112 HUD bust for a playable character key (e.g. 'silas_player' -> portrait_silas.png), else the default HUD portrait (or null before load). */
export function getCharacterPortrait(charKey) {
  const k = squash(charKey && typeof charKey === 'object' ? charKey.id || charKey.key : charKey);
  return characterPortraits[k] || images.portrait || null;
}

/** Sheet for an outfit; lazily tries matthew_<id>.png for ids not in OUTFIT_SHEETS. Falls back to the default sheet. */
function outfitSheet(outfitId) {
  const id = outfitId || 'polo';
  if (outfitSheets[id]) return { img: outfitSheets[id], id };
  if (!outfitPending[id] && /^[a-z0-9_-]+$/i.test(id)) {
    outfitPending[id] = true;
    loadImage(vb(OUTFIT_SHEETS[id] || `assets/sprites/matthew_${id}.png`))
      .then((img) => { outfitSheets[id] = img; })
      .catch(() => {});
  }
  return { img: images.matthewSheet, id: 'polo' };
}

export function getMatthewSprite(pose, outfitId, outfit, animT) {
  if (loaded && images.matthewSheet) {
    const idx = sheetFrame(pose === 'chase' ? 'walk' : pose, animT);
    const { img, id } = outfitSheet(outfitId);
    return sliceFrame(img, idx, `msheet|${idx}|${id}`);
  }
  const frame = pose === 'walk' ? Math.floor(animT * 8) % 4 : Math.floor(animT * 2) % 2;
  const key = `matt|${pose}|${outfitId}|${frame}`;
  if (cache.has(key)) return cache.get(key);
  const { c, ctx } = makeCanvas(48, 56);
  drawMatthewPose(ctx, pose, { ...outfit, ripped: true }, frame * 0.4);
  cache.set(key, c);
  return c;
}

export function getEnemySprite(pose, color, animT, isBoss) {
  const thugKey = THUG_BY_COLOR[color] || null;
  const sheetKey = isBoss ? 'silas' : thugKey;
  if (loaded && sheetKey && enemySheets[sheetKey]) {
    const idx = sheetFrame(pose === 'chase' ? 'walk' : pose, animT);
    return sliceFrame(enemySheets[sheetKey], idx, `esheet|${sheetKey}|${idx}`);
  }
  if (loaded && !isBoss && thugKey && images[thugKey] && (pose === 'idle' || pose === 'walk' || pose === 'chase')) {
    return images[thugKey];
  }
  if (loaded && isBoss && images.silas && pose !== 'punch') return images.silas;

  const frame = (pose === 'walk' || pose === 'chase') ? Math.floor(animT * 8) % 4 : Math.floor(animT * 2) % 2;
  const key = `${isBoss ? 'boss' : 'thug'}|${pose}|${color}|${frame}`;
  if (cache.has(key)) return cache.get(key);
  const { c, ctx } = makeCanvas(48, 56);
  drawNpcPose(ctx, pose, color, frame * 0.4, isBoss);
  cache.set(key, c);
  return c;
}

export function getNpcSprite(npcId, color, animT) {
  if (loaded && images[npcId]) return images[npcId];
  const frame = Math.floor(animT * 2) % 2;
  const key = `npc|${npcId || color}|${frame}`;
  if (cache.has(key)) return cache.get(key);
  const { c, ctx } = makeCanvas(48, 56);
  drawNpcPose(ctx, 'idle', color, frame * 0.5, npcId === 'silas');
  cache.set(key, c);
  return c;
}

export function drawSprite(ctx, spriteCanvas, x, y, facing) {
  if (!spriteCanvas) return;
  const drawW = 64, drawH = 84;
  ctx.save();
  ctx.imageSmoothingEnabled = (spriteCanvas.width || 0) > 144;     // HD (artScale 2) art is drawn smoothed
  if (ctx.imageSmoothingEnabled) ctx.imageSmoothingQuality = 'high';
  if (facing < 0) {
    ctx.translate(x, y - drawH);
    ctx.scale(-1, 1);
    ctx.drawImage(spriteCanvas, -drawW / 2, 0, drawW, drawH);
  } else {
    ctx.drawImage(spriteCanvas, x - drawW / 2, y - drawH, drawW, drawH);
  }
  ctx.restore();
}

// ---------------------------------------------------------------- collectibles (tools/gen_collectibles.py)
// collectibles.png: one row per item, 6 cols of 48x48 (bob + glint baked in); collectibles.json: id -> {row, frames, fw, fh, fps, name, names}
const COLLECT = { img: null, items: {}, index: {}, s: 1, ax: 24, ay: 47 };
const normName = (v) => String(v || '').toLowerCase().replace(/\([^)]*\)/g, '').replace(/[^a-z0-9]/g, '');
async function loadCollectibles() {
  const m = await fetchManifest('assets/sprites/collectibles.json', false);
  if (!m) return;
  const meta = m._meta || {};
  COLLECT.s = meta.artScale || 1; COLLECT.ax = meta.anchorX != null ? meta.anchorX : 24 * COLLECT.s; COLLECT.ay = meta.anchorY != null ? meta.anchorY : 47 * COLLECT.s;
  for (const [id, it] of Object.entries(m)) {
    if (id.startsWith('_')) continue;
    COLLECT.items[id] = it;
    for (const n of [id, it.name, ...(it.names || [])]) { const k = normName(n); if (k && !COLLECT.index[k]) COLLECT.index[k] = id; }
  }
  try { COLLECT.img = await loadImage((meta.file || 'assets/sprites/collectibles.png') + '?v=' + m.__hash); }
  catch (_) { console.warn('Sprite missing: assets/sprites/collectibles.png'); }
}
function collectibleId(idOrName) {
  if (idOrName && typeof idOrName === 'object') idOrName = idOrName.id || idOrName.name;
  if (COLLECT.items[idOrName]) return idOrName;
  const k = normName(idOrName);
  if (COLLECT.index[k]) return COLLECT.index[k];
  for (const [n, id] of Object.entries(COLLECT.index)) if (k && (n.startsWith(k) || k.startsWith(n)) && Math.min(n.length, k.length) >= 4) return id;
  return null;
}
/** Item frame {img, sx, sy, sw, sh, anchorX:24, anchorY:47} or null. Accepts id or name (any case, parentheticals ignored). */
export function getCollectibleSprite(idOrName, tMs = 0) {
  const id = collectibleId(idOrName);
  const it = id && COLLECT.items[id];
  if (!it || !COLLECT.img) return null;
  const s = COLLECT.s, fw = it.fw || 48 * s, fh = it.fh || 48 * s, n = it.frames || 6;
  const f = Math.floor(Math.max(0, tMs || 0) * (it.fps || 8) / 1000) % n;
  return { img: COLLECT.img, sx: f * fw, sy: it.row * fh, sw: fw, sh: fh, dw: fw / s, dh: fh / s, artScale: s, smooth: s > 1,
    anchorX: COLLECT.ax / s, anchorY: COLLECT.ay / s, id, name: it.name };
}

// ---------------------------------------------------------------- outfit weapon icons (tools/gen_weapon_icons.py)
// weapons.png: one row of 48x48 icons (outfit order); weapons.json: outfit -> {name, move, index, x, y, w, h}
const WEAPONS = { img: null, items: {} };
async function loadWeapons() {
  const m = await fetchManifest('assets/sprites/weapons.json', false);
  if (!m) return;
  const meta = m._meta || {};
  WEAPONS.s = meta.artScale || 1;
  for (const [id, it] of Object.entries(m)) if (!id.startsWith('_') && id !== '__hash') WEAPONS.items[id] = it;
  try { WEAPONS.img = await loadImage((meta.file || 'assets/sprites/weapons.png') + '?v=' + m.__hash); }
  catch (_) { console.warn('Sprite missing: assets/sprites/weapons.png'); }
}
/** Outfit weapon icon {img, sx, sy, sw, sh, id, name, move} or null (unknown outfit / not loaded yet).
 *  Accepts an outfit id ('street', 'matthew_street', 'Street') or an outfit object {id}. Draw with
 *  ctx.drawImage(icon.img, icon.sx, icon.sy, icon.sw, icon.sh, x, y, icon.sw, icon.sh). */
export function getWeaponIcon(outfitId) {
  const id = outfitKey(outfitId);
  const it = WEAPONS.items[id];
  if (!it || !WEAPONS.img) return null;
  const s = WEAPONS.s || 1;
  return { img: WEAPONS.img, sx: it.x, sy: it.y, sw: it.w || 48 * s, sh: it.h || 48 * s, dw: (it.w || 48 * s) / s, dh: (it.h || 48 * s) / s,
    artScale: s, smooth: s > 1, id, name: it.name, move: it.move };
}

export function drawCollectible(ctx, x, y, name, pulse) {
  const spr = getCollectibleSprite(name, (pulse || 0) / 5 * 1000);   // pulse is seconds*5 at the call site
  if (spr) {
    const dx = Math.round(x - spr.anchorX), dy = Math.round(y - 4 - spr.anchorY);
    ctx.save(); ctx.imageSmoothingEnabled = spr.smooth; if (spr.smooth) ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(spr.img, spr.sx, spr.sy, spr.sw, spr.sh, dx, dy, spr.dw, spr.dh); ctx.restore();
    ctx.fillStyle = '#fff'; ctx.font = '9px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(name, x, dy - 4); ctx.textAlign = 'left';
    return;
  }
  const s = 8 + Math.sin(pulse) * 2;
  ctx.fillStyle = 'rgba(255,210,74,0.3)';
  ctx.beginPath(); ctx.arc(x, y - 20, s + 6, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#ffd24a';
  ctx.beginPath(); ctx.arc(x, y - 20, s, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.font = '9px sans-serif'; ctx.textAlign = 'center';
  ctx.fillText(name, x, y - 36); ctx.textAlign = 'left';
}

export function clearSpriteCache() { cache.clear(); }

/** 1.8.0-hd: the art scale the loaded manifests use for a character (1 = legacy). */
export function getArtScale(charKey, outfitId) {
  const ch = ANIM_MANIFEST[animKey(charKey, outfitId)];
  const st = ch && Object.values(ch.states)[0];
  return (st && st.artScale) || 1;
}
