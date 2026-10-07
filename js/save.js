/**
 * localStorage save — versioned. Current key/format: `starCityDrift_v1`, data.v = 2.
 * Older saves (`starCityDrift2d_v1`, data.v = 1) are migrated on read.
 * A corrupt/unknown save never throws: it is moved aside and reported as 'corrupt'.
 */
import { getDepth } from './world.js';

export const SAVE_KEY = 'starCityDrift_v1';
export const SAVE_VERSION = 2;
const LEGACY_KEYS = ['starCityDrift2d_v1'];
const BAD_KEY = SAVE_KEY + '_corrupt';

function ls() {
  try { return window.localStorage; } catch { return null; }
}

function isObj(o) { return !!o && typeof o === 'object' && !Array.isArray(o); }
function num(v, d) { return typeof v === 'number' && Number.isFinite(v) ? v : d; }

/** Convert a legacy v1 payload into the v2 shape. */
function migrateV1(d) {
  return {
    v: SAVE_VERSION,
    savedAt: num(d.savedAt, Date.now()),
    areaId: typeof d.areaId === 'string' ? d.areaId : 'downtown',
    player: isObj(d.player) ? d.player : {},
    outfitId: d.outfitId || 'polo',
    unlockedOutfits: Array.isArray(d.unlockedOutfits) ? d.unlockedOutfits : ['polo'],
    missionFlags: isObj(d.missionFlags) ? d.missionFlags : {},
    activeMissionId: d.activeMissionId ?? 'main1',
    collectTaken: Array.isArray(d.collectTaken) ? d.collectTaken.filter((c) => c && c.taken).map((c) => c.id) : [],
    mainComplete: !!d.mainComplete,
    ended: !!d.ended,
    deliveryActive: !!d.deliveryActive,
    score: 0,
    special: 40,
    playTime: 0
  };
}

/** Throws if the payload can't be trusted. */
function validate(d) {
  if (!isObj(d)) throw new Error('save is not an object');
  if (d.v !== SAVE_VERSION) throw new Error('unknown save version ' + d.v);
  if (typeof d.areaId !== 'string') throw new Error('bad areaId');
  if (!isObj(d.player)) throw new Error('bad player');
  if (!isObj(d.missionFlags)) throw new Error('bad missionFlags');
  if (!Array.isArray(d.collectTaken) || !Array.isArray(d.unlockedOutfits)) throw new Error('bad lists');
  return d;
}

/**
 * Read + validate without side effects beyond migration/quarantine.
 * @returns {{status:'none'|'ok'|'migrated'|'corrupt', data:object|null, error?:string}}
 */
export function inspectSave() {
  const store = ls();
  if (!store) return { status: 'none', data: null };
  let raw = null;
  try { raw = store.getItem(SAVE_KEY); } catch { return { status: 'none', data: null }; }
  if (raw) {
    try {
      return { status: 'ok', data: validate(JSON.parse(raw)) };
    } catch (e) {
      try { store.setItem(BAD_KEY, raw); store.removeItem(SAVE_KEY); } catch (_) {}
      console.warn('[save] ignoring corrupt save:', e.message);
      return { status: 'corrupt', data: null, error: e.message };
    }
  }
  for (const key of LEGACY_KEYS) {
    let old = null;
    try { old = store.getItem(key); } catch { old = null; }
    if (!old) continue;
    try {
      const d = JSON.parse(old);
      if (!isObj(d) || d.v !== 1) throw new Error('unknown legacy format');
      const data = validate(migrateV1(d));
      try { store.setItem(SAVE_KEY, JSON.stringify(data)); store.removeItem(key); } catch (_) {}
      return { status: 'migrated', data };
    } catch (e) {
      try { store.setItem(BAD_KEY, old); store.removeItem(key); } catch (_) {}
      console.warn('[save] ignoring corrupt legacy save:', e.message);
      return { status: 'corrupt', data: null, error: e.message };
    }
  }
  return { status: 'none', data: null };
}

export function hasSave() {
  const s = inspectSave().status;
  return s === 'ok' || s === 'migrated';
}

export function clearSave() {
  const store = ls();
  if (!store) return;
  try {
    store.removeItem(SAVE_KEY);
    for (const k of LEGACY_KEYS) store.removeItem(k);
  } catch (_) {}
}

export function serializeSave({ player, stateBag, gameState, outfitId, areaId }) {
  const missionFlags = {};
  for (const [id, m] of Object.entries(stateBag.missions || {})) missionFlags[id] = !!m.done;
  return {
    v: SAVE_VERSION,
    savedAt: Date.now(),
    areaId,
    player: {
      x: Math.round(player.x), y: Math.round(player.y),
      hp: player.hp, maxHp: player.maxHp, facing: player.facing
    },
    outfitId: outfitId || 'polo',
    unlockedOutfits: [...(stateBag.unlockedOutfits || ['polo'])],
    missionFlags,
    activeMissionId: stateBag.activeMissionId ?? null,
    collectTaken: (stateBag.collectibles || []).filter((c) => c.taken).map((c) => c.id),
    mainComplete: !!stateBag.mainComplete,
    ended: !!gameState.ended,
    deliveryActive: !!stateBag.deliveryActive,
    score: gameState.score || 0,
    special: gameState.special ?? 40,
    playTime: Math.floor(gameState.playTime || 0)
  };
}

export function saveGame(payload) {
  const store = ls();
  if (!store) return false;
  try {
    store.setItem(SAVE_KEY, JSON.stringify(payload));
    return true;
  } catch (e) {
    console.warn('Save failed', e);
    return false;
  }
}

/** Valid save data or null (corrupt/legacy handling happens in inspectSave). */
export function loadSave() {
  const r = inspectSave();
  return r.data;
}

/**
 * Apply save data onto a freshly created mission system / player.
 * Unknown ids are ignored; values are clamped so an edited save can't break the game.
 */
export function applySave(data, { player, stateBag, gameState, areas }) {
  if (!data) return null;
  try {
    for (const [id, done] of Object.entries(data.missionFlags || {})) {
      if (stateBag.missions[id]) stateBag.missions[id].done = !!done;
    }
    const act = data.activeMissionId;
    stateBag.activeMissionId = act === null ? null : (stateBag.missions[act] ? act : 'main1');
    stateBag.mainComplete = !!data.mainComplete;
    stateBag.deliveryActive = !!data.deliveryActive && !stateBag.missions.side_coach?.done;
    stateBag.deliveryTarget = stateBag.deliveryActive ? (stateBag.missions.side_coach?.deliver || null) : null;
    stateBag.unlockedOutfits = new Set(['polo', ...(data.unlockedOutfits || []).filter((o) => typeof o === 'string')]);
    const taken = new Set(data.collectTaken || []);
    for (const c of stateBag.collectibles) c.taken = taken.has(c.id);

    const areaId = areas && areas[data.areaId] ? data.areaId : 'downtown';
    const areaW = areas && areas[areaId] ? areas[areaId].width : 1000;
    const p = data.player || {};
    player.x = Math.max(40, Math.min(areaW - 40, num(p.x, 200)));
    const band = getDepth(areaId);
    player.y = Math.max(band.min, Math.min(band.max, num(p.y, (band.min + band.max) / 2)));
    player.maxHp = Math.max(1, num(p.maxHp, player.maxHp));
    player.hp = Math.max(1, Math.min(player.maxHp, num(p.hp, player.maxHp)));
    player.facing = p.facing === -1 ? -1 : 1;

    gameState.ended = !!data.ended;
    gameState.score = Math.max(0, num(data.score, 0));
    gameState.special = Math.max(0, Math.min(100, num(data.special, 40)));
    gameState.playTime = Math.max(0, num(data.playTime, 0));
    let outfitId = typeof data.outfitId === 'string' ? data.outfitId : 'polo';
    if (!stateBag.unlockedOutfits.has(outfitId)) outfitId = 'polo';
    return { areaId, outfitId };
  } catch (e) {
    console.warn('[save] apply failed:', e.message);
    return null;
  }
}
