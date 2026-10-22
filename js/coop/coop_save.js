/**
 * 2.1.0 co-op save slot: localStorage `starCityDrift_coop_v1` (the solo save `starCityDrift_v1` is never touched).
 * { v:1, sessions: { [partnershipId]: entry } }
 * entry = { partnershipId, partnerName, selfName, role, payload (serializeSave shape), progress, progressScore,
 *           updatedAt, saveRev, hash, complete, savedWhy }
 * Both devices keep a copy. On rejoin the furthest progress wins (score, then saveRev, then updatedAt);
 * collectibles + unlocked outfits are unioned.
 */
export const COOP_SAVE_KEY = 'starCityDrift_coop_v1';
const MAIN = ['main1', 'main2', 'main3', 'main4'];

function store() { try { return globalThis.localStorage || null; } catch (_) { return null; } }
function readAll() {
  const s = store(); if (!s) return { v: 1, sessions: {} };
  try { const d = JSON.parse(s.getItem(COOP_SAVE_KEY) || 'null'); if (d && d.v === 1 && d.sessions && typeof d.sessions === 'object') return d; } catch (_) {}
  return { v: 1, sessions: {} };
}
function writeAll(d) { const s = store(); if (!s) return false; try { s.setItem(COOP_SAVE_KEY, JSON.stringify(d)); return true; } catch (e) { console.warn('[coop] save failed', e); return false; } }

export function newPartnershipId() {
  const a = new Uint8Array(8); (globalThis.crypto || {}).getRandomValues ? crypto.getRandomValues(a) : a.forEach((_, i) => (a[i] = Math.random() * 256));
  return 'p-' + [...a].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Deterministic: main missions ×1000 + side quests ×100 + collectibles. */
export function progressScore(payload) {
  if (!payload) return 0;
  const f = payload.missionFlags || {};
  let main = 0, side = 0;
  for (const [id, done] of Object.entries(f)) if (done) { if (MAIN.includes(id)) main++; else side++; }
  return main * 1000 + side * 100 + (payload.collectTaken || []).length;
}
export function progressSummary(payload) {
  const f = (payload && payload.missionFlags) || {};
  const doneMain = MAIN.filter((id) => f[id]).length;
  return { mainDone: doneMain, next: payload && payload.mainComplete ? null : MAIN[doneMain] || null, area: payload && payload.areaId, collectibles: (payload && payload.collectTaken || []).length };
}
export function hashPayload(p) { // tiny FNV-1a over the stable JSON (identical copies → identical hash)
  const s = JSON.stringify({ ...p, savedAt: 0 }); let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  return h.toString(16);
}

export function listSessions({ unfinished = false } = {}) {
  return Object.values(readAll().sessions).filter((e) => !unfinished || !e.complete).sort((a, b) => b.updatedAt - a.updatedAt);
}
export function getSession(id) { return readAll().sessions[id] || null; }

/** Write (or overwrite) this device's copy. Returns the stored entry. */
export function writeSession(entry) {
  const all = readAll();
  const prev = all.sessions[entry.partnershipId];
  const payload = entry.payload;
  const e = {
    ...prev, ...entry,
    progress: progressSummary(payload), progressScore: progressScore(payload),
    updatedAt: entry.updatedAt || Date.now(), saveRev: entry.saveRev != null ? entry.saveRev : ((prev && prev.saveRev) || 0) + 1,
    complete: !!(payload && payload.mainComplete)
  };
  e.hash = hashPayload(payload);
  all.sessions[e.partnershipId] = e;
  writeAll(all);
  return e;
}
export function deleteSession(id) { const all = readAll(); delete all.sessions[id]; writeAll(all); }

/** Furthest progress wins; ties → higher saveRev → newer updatedAt. Returns the winning entry (or null). */
export function pickFurthest(a, b) {
  if (!a) return b || null; if (!b) return a;
  if (a.progressScore !== b.progressScore) return a.progressScore > b.progressScore ? a : b;
  if ((a.saveRev || 0) !== (b.saveRev || 0)) return (a.saveRev || 0) > (b.saveRev || 0) ? a : b;
  return (a.updatedAt || 0) >= (b.updatedAt || 0) ? a : b;
}
/** Merge two copies: the winner's payload, with collectibles + outfits unioned. */
export function mergeCopies(a, b) {
  const w = pickFurthest(a, b); if (!w) return null;
  const o = w === a ? b : a;
  if (!o || !o.payload) return w;
  const p = { ...w.payload };
  p.collectTaken = [...new Set([...(w.payload.collectTaken || []), ...(o.payload.collectTaken || [])])];
  p.unlockedOutfits = [...new Set([...(w.payload.unlockedOutfits || []), ...(o.payload.unlockedOutfits || [])])];
  return { ...w, payload: p, saveRev: Math.max(a.saveRev || 0, b.saveRev || 0) + 1, updatedAt: Date.now() };
}
