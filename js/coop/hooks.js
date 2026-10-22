/**
 * 2.1.0 online co-op: the ONE object main.js talks to (every call is a no-op while co-op is off).
 * Host-authoritative: the host (P1, Matthew) runs the whole sim incl. Player 2 (William Burks); the guest sends
 * inputs (60 Hz, redundant press list = input buffering) and draws host snapshots (20 Hz) ~100 ms in the past
 * (interpolation). The guest predicts only its own movement and is softly corrected toward the host.
 * Hooks used in main.js are listed in /COOP.md ("main.js hooks").
 */
import { createPlayer, createThug, updatePlayer, resolveHits, clampDepth, getDepthBand } from '../combat.js';
import { animFrame, animMs, enemyCharKey } from '../anim.js';
import { CAMERA } from '../camera.js';
import { hostRoom, joinRoom, prettyCode, normalizeCode, signalMode } from './net.js';
import * as CS from './coop_save.js';
import { coopLinesFor, COOP_BARKS, COOP_SIDE_OFFERS, COOP_SIDE_DONE, COOP_STEALTH, COOP_FINISHER } from './story.js';
import * as VO from '../vo.js';
import { sfx } from '../audio.js';
import { createLobbyUi } from './lobby.js';

const Q = new URLSearchParams(location.search);
const SNAP_HZ = 20, INTERP_MS = Number(Q.get('interp') || 100), AFK_SEC = Number(Q.get('afkSec') || 60);
const P1 = 'Matthew Rose', P2 = 'William Burks';
let api = null; // main.js internals (attach)
const now = () => performance.now();

const S = {
  role: null,          // 'host' | 'guest' | null
  phase: 'off',        // off | lobby | play | ended
  link: null, room: null, code: null,
  pid: null, entry: null, partnerName: '', version: '', partnerVersion: '', versionOk: true,
  ready: { me: false, them: false },
  loadPayload: null,
  // host
  w: null, wState: 'none', afkT: 0, goneT: 0, inq: [], lastPress: 0, lastAxes: null, lastInT: 0, hostInp: null,
  seen: new WeakSet(), ids: new WeakMap(), nextId: 1, snapT: 0, seq: 0, areaSeen: null, reviveT: 0, holdJoin: null,
  adv: { host: false, guest: false, t: 0, sig: '' }, lastDlgSig: '', metaT: 0,
  // guest
  snaps: [], offset: null, ghosts: new Map(), meta: new Map(), pressId: 0, presses: [], dlg: null, inSeq: 0,
  wLocal: null, auth: null, lastMode: 'title', paused: null, flags: {}
};
const baseZoom = { v: null };

function myName() { return S.role === 'guest' ? P2 : P1; }
function toast(m, u) { if (api) api.toast(m, u); }

// ---------------------------------------------------------------- lobby / session
const ui = createLobbyUi({
  version: () => effVersion(),
  create: (entry) => createGame(entry),
  join: (code) => joinGame(code),
  setReady: (r) => { S.ready.me = r; S.link && S.link.send('ready', { ready: r }); ui.render(lobbyView()); },
  start: () => hostStart(),
  leave: () => leave('lobby'),
  sessions: () => CS.listSessions({ unfinished: true })
});

function effVersion() { return Q.get('coopVersion') || (api && api.GAME_VERSION) || '0'; }

function lobbyView() {
  const e = S.entry;
  const cont = e && e.payload ? continuingLabel(e) : 'New co-op campaign';
  return {
    role: S.role, code: S.code, pretty: S.code ? prettyCode(S.code) : '', link: S.code ? inviteLink(S.code) : '',
    continuing: cont, partner: S.link ? S.partnerName || P2 : null, rtt: S.link ? S.link.rtt : 0,
    ready: { ...S.ready }, versionOk: S.versionOk, partnerVersion: S.partnerVersion, myVersion: effVersion(),
    canStart: S.role === 'host' && !!S.link && S.ready.me && S.ready.them && S.versionOk, status: S.status || ''
  };
}
function continuingLabel(e) {
  const titles = { main1: 'Main 1 · Gone Quiet', main2: 'Main 2 · The Missing List', main3: 'Main 3 · Badges in the Rail Yards', main4: 'Main 4 · The Star Goes Dark' };
  const p = e.progress || CS.progressSummary(e.payload);
  return 'Continuing: ' + (p.next ? titles[p.next] : 'Campaign complete · free roam');
}
export function inviteLink(code) {
  const u = new URL(location.href); u.search = ''; u.hash = '';
  const keep = new URLSearchParams(location.search); ['signal', 'peerHost', 'peerPort', 'debug'].forEach((k) => keep.has(k) && u.searchParams.set(k, keep.get(k)));
  u.searchParams.set('join', prettyCode(code));
  return u.href;
}

async function createGame(entry) {
  reset();
  S.role = 'host'; S.phase = 'lobby'; S.version = effVersion();
  S.entry = entry || null;
  S.pid = entry ? entry.partnershipId : CS.newPartnershipId();
  S.status = 'Opening room…'; ui.open(lobbyView());
  try {
    S.room = await hostRoom(onHostLink, { code: Q.get('room') ? normalizeCode(Q.get('room')) || undefined : undefined });
    S.code = S.room.code; S.status = 'Waiting for Player 2 — share the code or link.';
  } catch (e) {
    console.warn('[coop] host failed', e);
    S.status = "Couldn't reach the signaling server (" + (e.type || e.message) + '). Try again or another network.';
  }
  ui.render(lobbyView());
}

function onHostLink(link, meta) {
  if (S.link && !S.link.closed) { link.send('full', {}); setTimeout(() => link.close('full'), 200); return; }
  S.link = link;
  link.on((t, d) => hostMsg(t, d));
  link.onClose((why) => onLinkClosed(why));
  link.send('hello', { version: S.version, name: P1, pid: S.pid, inGame: S.phase === 'play' });
}

async function joinGame(codeTxt) {
  const code = normalizeCode(codeTxt);
  if (!code) { ui.error('That code doesn\'t look right — 6 letters/numbers, like RKE-4F7.'); return; }
  reset();
  S.role = 'guest'; S.phase = 'lobby'; S.version = effVersion(); S.code = code;
  S.status = 'Connecting to ' + prettyCode(code) + '…'; ui.open(lobbyView());
  try {
    const link = await joinRoom(code, { name: P2 });
    S.link = link;
    link.on((t, d) => guestMsg(t, d));
    link.onClose((why) => onLinkClosed(why));
    S.status = 'Connected.';
  } catch (e) {
    console.warn('[coop] join failed', e);
    S.status = /peer-unavailable/.test(String(e.type || e.message)) ? 'No game with that code. Check it with your friend.' : "Couldn't connect – try another network. (" + (e.type || e.message) + ')';
    S.role = null;
  }
  ui.render(lobbyView());
}

function checkVersion(v) {
  S.partnerVersion = v; S.versionOk = v === S.version;
  if (!S.versionOk) S.status = `Version mismatch: you have ${S.version}, your friend has ${v}. Update to ${[S.version, v].sort().pop()} to play together.`;
}

// host side messages
function hostMsg(t, d) {
  if (t === 'hello') {
    checkVersion(d.version); S.partnerName = d.name || P2;
    // furthest progress wins: the guest's copy of this partnership (if any) vs ours
    if (d.copy && d.copy.partnershipId === S.pid) {
      const merged = CS.mergeCopies(S.entry, d.copy);
      if (merged && merged !== S.entry) { S.entry = CS.writeSession({ ...merged, role: 'host', partnerName: S.partnerName }); toast('Co-op saves synced — furthest progress kept.'); }
    }
    if (S.phase === 'play') { // drop-in / rejoin
      if (d.pid && d.pid !== S.pid) { S.link.send('reject', { why: 'This game belongs to another co-op save.' }); return; }
      admitDropIn();
    } else {
      S.link.send('lobby', { pid: S.pid, entry: S.entry, continuing: lobbyView().continuing });
      S.status = S.versionOk ? 'William joined. Ready up!' : S.status;
    }
    ui.render(lobbyView());
  } else if (t === 'ready') { S.ready.them = !!d.ready; ui.render(lobbyView()); }
  else if (t === 'in') hostInput(d);
  else if (t === 'adv') { S.adv.guest = true; tryAdvance(); }
  else if (t === 'pause') { if (api.gameState.mode === 'play') { api.pauseGame(); banner('William paused'); } }
  else if (t === 'resume') { if (api.gameState.mode === 'pause') { api.resumeGame(); banner(''); } }
  else if (t === 'bye') { S.byeWhy = d.why; S.link && S.link.close('bye'); }
}

// guest side messages
function guestMsg(t, d) {
  if (t === 'hello') {
    checkVersion(d.version); S.partnerName = d.name || P1; S.pid = d.pid;
    const copy = d.pid ? CS.getSession(d.pid) : null;
    S.link.send('hello', { version: S.version, name: P2, pid: d.pid, copy });
    if (!S.versionOk) S.link.send('ready', { ready: false });
    ui.render(lobbyView());
  } else if (t === 'lobby') {
    S.pid = d.pid; S.entry = d.entry;
    if (S.versionOk) S.status = d.entry ? 'Joined. ' + d.continuing + ' — ready up!' : 'Joined a new co-op campaign — ready up!';
    if (d.entry) CS.writeSession({ ...d.entry, role: 'guest', partnerName: P1 }); // new phone: receive the host's copy
    ui.render(lobbyView());
  } else if (t === 'reject' || t === 'full') { S.status = t === 'full' ? 'That game already has two players.' : d.why; ui.render(lobbyView()); }
  else if (t === 'hold') { S.status = 'Your friend is in a cutscene or boss fight — you join at the next checkpoint…'; ui.render(lobbyView()); }
  else if (t === 'start') guestStart(d);
  else if (t === 'save') guestSave(d.entry, d.why);
  else if (t === 'dlg') guestDialogue(d);
  else if (t === 's') { if (d.s > S.inSeq) S.inSeq = d.s; S.snaps.push({ ...d, rx: now() }); if (S.snaps.length > 40) S.snaps.shift(); const off = d.t - now(); S.offset = S.offset == null ? off : Math.max(off, S.offset + (off - S.offset) * 0.02, S.offset - 1); }
  else if (t === 'm') { for (const m of d) S.meta.set(m.i, m); }
  else if (t === 'pause') { if (api.gameState.mode === 'play') { S.remotePause = true; api.pauseGame(); banner('Matthew paused'); } }
  else if (t === 'resume') { if (api.gameState.mode === 'pause') { api.resumeGame(); banner(''); } }
  else if (t === 'toast') toast(d.msg, d.urgent);
  else if (t === 'ov') guestOverlays(d);
  else if (t === 'vo') { try { VO.play(d.id); } catch (_) {} }
  else if (t === 'bark') bark(d.text);
  else if (t === 'bye') { S.byeWhy = d.why; S.link && S.link.close('bye'); }
}

function hostStart() {
  if (!lobbyView().canStart) return;
  const e = S.entry;
  S.loadPayload = e && e.payload ? e.payload : null;
  S.flags = { ...((e && e.coopFlags) || {}) };
  S.phase = 'play';
  ui.close();
  api.startGame(!!S.loadPayload);
  S.loadPayload = null;
  spawnWilliam();
  api.persist(); // writes the co-op slot + sends the copy
  S.link.send('start', { entry: S.entry });
  setHud(true);
}
function admitDropIn() {
  const busy = api.gameState.mode === 'dialogue' || api.gameState.bossActive || api.gameState.cutscene;
  if (busy) { S.link.send('hold', {}); S.holdJoin = true; return; }
  S.holdJoin = false;
  if (!S.w || S.wState === 'gone') spawnWilliam(); else { S.wState = 'active'; S.w.afk = false; }
  api.persist();
  S.link.send('start', { entry: S.entry, dropIn: true });
  toast('William joined the game.');
}
function guestStart(d) {
  S.entry = CS.writeSession({ ...d.entry, role: 'guest', partnerName: P1 });
  S.pid = S.entry.partnershipId; S.flags = { ...(S.entry.coopFlags || {}) };
  S.phase = 'play'; ui.close();
  if (api.gameState.mode !== 'title') api.showTitle();
  S.loadPayload = S.entry.payload;
  api.startGame(true);
  S.loadPayload = null;
  const p = api.player;
  S.wLocal = makeWilliam(p.x - 50, p.y);
  S.snaps = []; S.offset = null; S.ghosts.clear();
  setHud(true);
  toast(d.dropIn ? 'Joined Matthew in progress.' : 'Co-op started — you are William (P2).');
}
function guestSave(entry, why) {
  if (!entry) return;
  S.entry = CS.writeSession({ ...entry, role: 'guest', partnerName: P1, savedWhy: why || entry.savedWhy });
  // mirror the story state so the HUD / objective / minimap match the host
  const sb = api.stateBag, p = entry.payload; if (!sb.missions || !p) return;
  for (const [id, done] of Object.entries(p.missionFlags || {})) if (sb.missions[id]) {
    if (done && !sb.missions[id].done) toast('Mission complete: ' + (sb.missions[id].title || id));
    sb.missions[id].done = !!done;
  }
  sb.activeMissionId = p.activeMissionId; sb.mainComplete = !!p.mainComplete;
  const taken = new Set(p.collectTaken || []); for (const c of sb.collectibles || []) c.taken = taken.has(c.id);
  api.gameState.score = p.score || 0;
}

/** Autosave + tell the partner. `why` ends up in the save tooltip ("Saved when William left"). */
function saveNow(why) {
  if (S.phase !== 'play' || !api) return;
  S.saveWhy = why;
  if (S.role === 'host') api.persist();
  else if (S.entry) { S.entry = CS.writeSession({ ...S.entry, savedWhy: why, updatedAt: S.entry.updatedAt, saveRev: S.entry.saveRev }); S.link && S.link.send('saved', { why }); }
}

function leave(why) {
  if (S.phase === 'play') saveNow(why === 'quit' ? (S.role === 'host' ? 'Saved when Matthew left' : 'Saved when William left') : why);
  if (S.link) { S.link.send('bye', { why }); const l = S.link; setTimeout(() => l.close('left'), 150); }
  if (S.room) { const r = S.room; setTimeout(() => r.close(), 200); }
  const wasPlay = S.phase === 'play';
  reset();
  ui.close(); setHud(false);
  if (wasPlay && api.gameState.mode !== 'title') api.showTitle();
  refreshTitle(true);
}

function onLinkClosed(why) {
  const link = S.link; S.link = null;
  if (S.phase === 'lobby') { S.ready.them = false; S.status = S.role === 'host' ? 'Player 2 left the lobby. Waiting…' : 'Lost the host.'; ui.render(lobbyView()); return; }
  if (S.phase !== 'play') return;
  if (S.role === 'host') {
    S.wState = 'afk'; S.afkT = AFK_SEC; if (S.w) { S.w.afk = true; S.w.invuln = 99; } pvpFallback();
    saveNow(S.byeWhy ? 'Saved when William left' : 'Saved when William disconnected');
    toast(S.byeWhy ? 'William left – saved.' : 'William disconnected – saved.', true);
    S.byeWhy = null;
  } else {
    saveNow("Saved when Matthew's game ended");
    toast("Matthew's game ended – saved on your device too.", true);
    S.phase = 'ended';
    setTimeout(() => { reset(); setHud(false); if (api.gameState.mode !== 'title') api.showTitle(); refreshTitle(true); }, 1500);
  }
  void link;
}

function reset() {
  S.role = null; S.phase = 'off'; S.link = null; S.room = null; S.code = null; S.pid = null; S.entry = null;
  S.ready = { me: false, them: false }; S.versionOk = true; S.partnerVersion = ''; S.status = '';
  S.w = null; S.wState = 'none'; S.inq = []; S.lastPress = 0; S.snaps = []; S.offset = null; S.ghosts.clear(); S.meta.clear();
  S.wLocal = null; S.auth = null; S.dlg = null; S.presses = []; S.pressId = 0; S.holdJoin = null;
  S.adv = { host: false, guest: false, t: 0, sig: '' };
  S.flags = {}; S.st = null; S.obj = ''; S.prompt = ''; S.zones = null; S.mDown = null; S.bossPrev = null; S.finWarned = false; S.lastOv = ''; S.lastToast = '';
  if (baseZoom.v != null) { CAMERA.zoom = baseZoom.v; baseZoom.v = null; }
  const d = document.getElementById('dialogue'); if (d && api && api.gameState.mode !== 'dialogue') d.classList.add('hidden');
}

// ---------------------------------------------------------------- Player 2 entity
function makeWilliam(x, y) {
  const w = createPlayer(x, clampDepth(y));
  w.animKey = 'william'; w.voiceKey = 'william'; w.special = 40; w.coop = true;
  return w;
}
function spawnWilliam() {
  const p = api.player;
  S.w = makeWilliam(Math.max(60, p.x - 60), p.y + 6);
  S.wState = 'active'; S.areaSeen = api.gameState.areaId;
}
const williamHooks = (w) => ({
  outfit: 'polo',
  animMap: { special: 'magazine' }, // 2.1.0: Joe's William set; his own 'special' is Extra Life (no hit frames), so the Star Drive slot plays the magazine swat
  canSpecial: (cost = 25) => w.special >= cost,
  onSpecial: (cost = 25) => { w.special = Math.max(0, w.special - cost); },
  onSpecialDenied: () => {}
});

const NEUTRAL = { ax: 0, ay: 0, punchPressed: false, kickPressed: false, heavyPressed: false, specialPressed: false, interactPressed: false, sprintHeld: false, kickHeld: false, punchHeld: false };
function hostInput(d) { S.inq.push(d); if (S.inq.length > 30) S.inq.splice(0, S.inq.length - 30); S.lastInT = now(); }
/** Input buffer: keep ~2 frames of jitter, never let a backlog grow, apply every press exactly once. */
function nextRemoteInput() {
  const q = S.inq;
  while (q.length > 3) q.shift();
  const f = q.shift();
  const inp = { ...NEUTRAL };
  if (f) S.lastAxes = f;
  const a = f || (now() - S.lastInT < 250 ? S.lastAxes : null);
  if (a) { inp.ax = a.ax; inp.ay = a.ay; inp.sprintHeld = !!a.sp; inp.punchHeld = !!a.ph; inp.kickHeld = !!a.kh; }
  for (const src of [f, ...q]) if (src && src.pr) for (const [id, k] of src.pr) if (id > S.lastPress) { S.lastPress = id; inp[k] = true; }
  return inp;
}

function hostStep(dt, area) {
  if (S.role !== 'host' || S.phase !== 'play' || !S.w || S.wState === 'gone') return;
  const w = S.w, p = api.player, gs = api.gameState;
  if (S.areaSeen !== gs.areaId) { S.areaSeen = gs.areaId; w.x = Math.max(40, p.x - p.facing * 60); w.y = clampDepth(p.y + 4); }
  scaleWaves();
  if (S.wState === 'afk') {
    S.afkT -= dt; w.invuln = 99; w.hitbox = null;
    updatePlayer(w, NEUTRAL, dt, area.width, williamHooks(w));
    if (S.afkT <= 0) { S.wState = 'leaving'; S.goneT = 1.6; toast('Continuing solo. William\'s co-op save is kept for next time.'); }
    return;
  }
  if (S.wState === 'leaving') { // walks off and fades
    S.goneT -= dt; updatePlayer(w, { ...NEUTRAL, ax: -1 }, dt, area.width + 4000, williamHooks(w)); w.alpha = Math.max(0, S.goneT / 1.6);
    if (S.goneT <= 0) S.wState = 'gone';
    return;
  }
  const inp = nextRemoteInput();
  S.remoteInp = inp;
  beats(dt, inp);
  if (w.downed) { // revive: Matthew presses Interact next to him, then stays close for 2 s (or the street clears)
    w.hitbox = null;
    const near = Math.abs(p.x - w.x) < 60 && Math.abs(p.y - w.y) < 30;
    if (S.hostInp && S.hostInp.interactPressed && near) S.reviveT = S.reviveT || 2;
    if (S.reviveT > 0) { if (!near) S.reviveT = 0; else if ((S.reviveT -= dt) <= 0) revive(w, 'Matthew got William back up!'); }
    if (!gs.combatLock && w.downed && !gs.enemies.some((e) => e.alive)) revive(w, 'William dusts himself off.');
    if (!p.alive) revive(w, ''); // both down → both back at the checkpoint (main.js respawns Matthew)
    return;
  }
  w.special = Math.min(100, w.special + dt * 2);
  updatePlayer(w, inp, dt, area.width, williamHooks(w));
  const fin = bossPre();
  resolveHits(w, gs.enemies, api.onHitEnemy, () => {}, area.width);
  bossPost(fin);
  pvp();
  // leash: never more than one screen apart
  const leash = 820;
  w.x = Math.max(p.x - leash, Math.min(p.x + leash, w.x));
  w.x = Math.max(30, Math.min(area.width - 30, w.x));
  if (!w.alive && w.koT <= 0 && !w.downed) { w.downed = true; S.reviveT = 0; toast('William is down! Stand by him and press Interact to revive.'); }
  if (!w.alive && !w.downed && w.koT > 0) w.koT -= 0; // updatePlayer counts it down
}
function revive(w, msg) {
  w.downed = false; w.alive = true; w.hp = Math.round(w.maxHp * 0.5); w.kd = null; w.koT = 0; w.invuln = 1.5; w.lift = 0;
  S.reviveT = 0;
  if (!api.player.alive || msg === '') { w.hp = w.maxHp; }
  if (msg) toast(msg); // host toasts are mirrored to the guest (preStep)
}
/** ~1.5× wave size and +25 % boss HP while two players are in (the 2.0.1 sergeant cap is untouched: extras are plain thugs). */
function scaleWaves() {
  if (S.wState !== 'active') return;
  const gs = api.gameState; let fresh = 0;
  for (const e of gs.enemies) {
    if (S.seen.has(e)) continue; S.seen.add(e);
    if (e.isBoss) { e.maxHp = Math.round(e.maxHp * 1.25); e.hp = Math.round(e.hp * 1.25); continue; }
    if (!e.runner && !e.sparring && !e.noLock && e.alive) fresh++;
  }
  if (fresh >= 2) {
    const extra = Math.ceil(fresh * 0.5), area = api.AREAS[gs.areaId], b = getDepthBand();
    for (let i = 0; i < extra; i++) {
      const x = Math.max(60, Math.min(area.width - 60, S.w.x + (i % 2 ? 1 : -1) * (160 + 40 * i)));
      const e = createThug(x, b.min + 8 + Math.random() * Math.max(1, b.max - b.min - 16), gs.wave || 0);
      S.seen.add(e); gs.enemies.push(e);
    }
    const txt = COOP_BARKS[Math.floor(Math.random() * COOP_BARKS.length)];
    bark(txt); S.link && S.link.send('bark', { text: txt });
  }
}
function targetFor(e, player) {
  if (S.role !== 'host' || !S.w || S.wState !== 'active' || S.w.downed || !S.w.alive) return player;
  if (!player.alive) return S.w; // Matthew is down: the crew turns on William
  const t = now();
  if (!e.__coopPick || t - e.__coopPickT > 2000) {
    const dp = Math.hypot(player.x - e.x, player.y - e.y), dw = Math.hypot(S.w.x - e.x, S.w.y - e.y);
    if (!S.ids.has(e)) S.ids.set(e, S.nextId++);
    const bias = (S.ids.get(e) % 2) ? 60 : -60; // split the pack: odd ids lean to William
    e.__coopPick = dw - bias < dp || !player.alive ? 'w' : 'p'; e.__coopPickT = t;
  }
  return e.__coopPick === 'w' ? S.w : player;
}

// ---------------------------------------------------------------- snapshots (host → guest)
function eid(e) { if (!S.ids.has(e)) S.ids.set(e, S.nextId++); return S.ids.get(e); }
const r1 = (v) => Math.round(v * 10) / 10;
function entSnap(p) { return [r1(p.x), r1(p.y), p.facing, p.animState, Math.round(animMs(p)), Math.round(p.hp), p.maxHp, p.alive ? 1 : 0, p.invuln > 0 ? 1 : 0]; }
function sendSnapshot(dt) {
  const gs = api.gameState;
  S.snapT += dt; if (S.snapT < 1 / SNAP_HZ) return; S.snapT = 0;
  const live = gs.enemies.filter((e) => e.alive || e.stun > 0 || e.koT > 0);
  const newMeta = [];
  for (const e of live) { const i = eid(e); if (!e.__coopMeta) { e.__coopMeta = 1; newMeta.push({ i, ck: enemyCharKey(e), boss: !!e.isBoss, mini: !!e.miniBoss, tint: e.tint || null, tf: e.tintFrac || 0, nt: e.nameTag || '', color: e.color || '', noLock: !!e.noLock, runner: !!e.runner }); } }
  S.metaT += 1 / SNAP_HZ;
  if (newMeta.length) S.link.send('m', newMeta);
  const w = S.w;
  S.link.sendFast('s', {
    s: ++S.seq, t: now(), a: gs.areaId, md: gs.mode,
    p: entSnap(api.player),
    w: w ? [...entSnap(w), S.wState === 'active' ? (w.downed ? 2 : 0) : S.wState === 'afk' ? 1 : 3, Math.round(w.special)] : null,
    e: live.map((e) => [eid(e), r1(e.x), r1(e.y), e.facing, e.animState, Math.round(animMs(e)), Math.round(e.hp), e.maxHp, e.alive ? 1 : 0, r1(e.stun || 0), r1(e.koT || 0)]),
    g: [gs.combatLock ? 1 : 0, gs.bossActive ? 1 : 0, Math.round(gs.special), gs.score || 0, gs.outfitId, Math.floor(gs.playTime || 0)],
    o: S.obj || '', pr: S.prompt || '', z: S.zones || null
  });
}

function hostDialoguePump() {
  const gs = api.gameState;
  const dlg = gs.mode === 'dialogue' ? { name: txt('dialogue-name'), text: txt('dialogue-text'), last: gs.dialogue ? gs.dialogueIdx >= gs.dialogue.length - 1 : true, vo: lineVo(gs) } : null;
  const sig = dlg ? dlg.name + '|' + dlg.text : '';
  if (sig !== S.lastDlgSig) { S.lastDlgSig = sig; S.link.send('dlg', dlg); S.adv = { host: false, guest: false, t: 0, sig }; }
  if (dlg && (S.adv.host || S.adv.guest)) { S.adv.t += 1 / 60; if (S.adv.t >= 4 || (S.adv.host && S.adv.guest)) { S.adv = { host: false, guest: false, t: 0, sig }; api.advanceDialogue(); } }
  if (S.holdJoin && S.link && gs.mode === 'play' && !gs.bossActive) admitDropIn();
}
function tryAdvance() { if (S.adv.host && S.adv.guest) { S.adv = { host: false, guest: false, t: 0, sig: S.adv.sig }; api.advanceDialogue(); } }
function allowAdvance() {
  if (S.role !== 'host' || S.phase !== 'play' || !S.link || S.wState !== 'active') return true;
  S.adv.host = true;
  if (S.adv.guest) { S.adv = { host: false, guest: false, t: 0, sig: S.adv.sig }; return true; }
  setNext('Waiting for William… (4 s)');
  return false;
}
const txt = (id) => { const e = document.getElementById(id); return e ? e.textContent : ''; };
function setNext(s) { const b = document.getElementById('dialogue-next'); if (b) b.textContent = s; }

// ---------------------------------------------------------------- guest step
function guestDialogue(d) {
  S.dlg = d;
  const el = document.getElementById('dialogue'); if (!el) return;
  if (!d) { el.classList.add('hidden'); return; }
  el.classList.remove('hidden');
  document.getElementById('dialogue-name').textContent = d.name;
  document.getElementById('dialogue-text').textContent = d.text;
  setNext(d.last ? 'Close (E)' : 'Continue (E)');
  try { if (d.vo) VO.play(d.vo); else VO.stop(); } catch (_) {} // the guest hears the same voice clip
}
function guestCapture(inp) {
  for (const k of ['punchPressed', 'kickPressed', 'heavyPressed', 'specialPressed', 'interactPressed']) if (inp[k]) S.presses.push([++S.pressId, k, now()]);
  const t = now(); S.presses = S.presses.filter((p) => t - p[2] < 600); // resent for 600 ms → survives drops on the unordered channel
  if (S.link) S.link.sendFast('in', { q: ++S.seq, ax: inp.ax, ay: inp.ay, sp: inp.sprintHeld ? 1 : 0, ph: inp.punchHeld ? 1 : 0, kh: inp.kickHeld ? 1 : 0, pr: S.presses.map((p) => [p[0], p[1]]) });
}
function lerp(a, b, k) { return a + (b - a) * k; }
function sampleSnaps() {
  const sn = S.snaps; if (!sn.length) return null;
  const rt = now() + (S.offset || 0) - INTERP_MS;
  let i = sn.length - 1; while (i > 0 && sn[i - 1].t > rt) i--;
  const b = sn[i], a = i > 0 ? sn[i - 1] : b;
  const k = b.t === a.t ? 1 : Math.max(0, Math.min(1, (rt - a.t) / (b.t - a.t)));
  return { a, b, k, latest: sn[sn.length - 1] };
}
function applyEnt(o, A, B, k, key) {
  const src = k < 0.5 ? A : B;
  o.x = lerp(A[0], B[0], k); o.y = lerp(A[1], B[1], k); o.facing = src[2];
  if (o.animState !== src[3]) o.animState = src[3];
  o.animT = src[4] / 1000 + (k < 0.5 ? 0 : 0); o.animStart = 0; o.animRate = 1;
  o.hp = src[5]; o.maxHp = src[6]; o.alive = !!src[7]; o.invuln = src[8] ? 0.2 : 0;
  void key;
}
function guestStep(dt, inp) {
  if (S.role !== 'guest' || S.phase !== 'play') return false;
  const gs = api.gameState;
  if (S.dlg) { if (inp.interactPressed || inp.confirmPressed) { S.link && S.link.send('adv', {}); setNext('Waiting for Matthew…'); } }
  else guestCapture(inp);
  const smp = sampleSnaps();
  if (smp) {
    const { a, b, k, latest } = smp;
    if (latest.a !== gs.areaId) { gs.areaId = latest.a; gs.enemies = []; S.ghosts.clear(); api.syncDepthBand(); api.followCam.cut(); }
    const p = api.player;
    applyEnt(p, a.p, b.p, k); p.stamina = 100; p.kitMove = null; p.attackType = null; p.kd = null; p.koT = 1; p.lift = 0; p.sprinting = false;
    S.obj = latest.o || ''; S.prompt = latest.pr || ''; S.zones = latest.z || null;
    const g = latest.g; gs.combatLock = !!g[0]; gs.bossActive = !!g[1]; gs.special = g[2]; gs.score = g[3]; if (gs.outfitId !== g[4]) gs.outfitId = g[4]; gs.playTime = g[5];
    // enemies (by id)
    const prev = new Map(a.e.map((e) => [e[0], e])); const list = [];
    for (const E of b.e) {
      const A = prev.get(E[0]) || E; let o = S.ghosts.get(E[0]);
      if (!o) { const m = S.meta.get(E[0]) || {}; o = { ghost: true, charKey: m.ck, isBoss: m.boss, miniBoss: m.mini, tint: m.tint, tintFrac: m.tf, nameTag: m.nt, color: m.color, noLock: m.noLock, runner: m.runner, pose: 'idle' }; S.ghosts.set(E[0], o); }
      if (!o.charKey && S.meta.get(E[0])) o.charKey = S.meta.get(E[0]).ck;
      applyEnt(o, A.slice(1), E.slice(1), k); o.stun = E[9]; o.koT = E[10]; if (!o.alive && o.koT <= 0 && o.stun <= 0) o.koT = 0.01;
      list.push(o);
    }
    for (const id of [...S.ghosts.keys()]) if (!b.e.some((e) => e[0] === id)) S.ghosts.delete(id);
    gs.enemies = list;
    // William: predicted locally, softly corrected toward the host's latest position
    if (latest.w) {
      S.auth = latest.w;
      const w = S.wLocal || (S.wLocal = makeWilliam(latest.w[0], latest.w[1]));
      const st = latest.w[9];
      if (st === 0 && !S.dlg && gs.mode === 'play' && latest.md === 'play') updatePlayer(w, inp, dt, api.AREAS[gs.areaId].width, williamHooks(w));
      const ex = latest.w[0] - w.x, ey = latest.w[1] - w.y;
      if (Math.abs(ex) > 120 || st !== 0) { w.x = latest.w[0]; w.y = latest.w[1]; } else { const kk = Math.min(1, dt * 6); w.x += ex * kk; w.y += ey * kk; }
      w.hp = latest.w[5]; w.alive = !!latest.w[7]; w.downed = st === 2; w.afk = st === 1; w.special = latest.w[10];
      if (st !== 0 || w.hp <= 0) { w.animState = latest.w[3]; w.animT = latest.w[4] / 1000; w.animStart = 0; w.animRate = 1; w.facing = latest.w[2]; }
    }
  }
  return true;
}

// ---------------------------------------------------------------- drawing
function drawItems(list) {
  if (S.phase !== 'play') return;
  if (S.zones) list.unshift({ type: 'coop', y: -1e9, draw: (cam) => drawZones(cam) });
  const w = S.role === 'host' ? S.w : S.wLocal;
  if (!w || (S.role === 'host' && S.wState === 'gone')) { list.push({ type: 'coop', y: api.player.y + 0.01, draw: (cam) => tag(api.player, cam, 'P1', '#2f6fd6') }); return; }
  const item = { type: 'coop', y: w.y, draw: (cam) => drawWilliam(w, cam) };
  let i = list.findIndex((it) => it.y > w.y); if (i < 0) i = list.length; list.splice(i, 0, item);
  list.push({ type: 'coop', y: 1e9, draw: (cam) => { tag(api.player, cam, 'P1', '#2f6fd6'); tag(w, cam, 'P2', '#2a9d55'); } });
}
function drawWilliam(w, cam) {
  const ctx = api.ctx, x = w.x - cam;
  const a = w.alpha != null ? w.alpha : 1;
  api.drawGroundShadow(x, w.y, api.CHAR_DRAW_W, 0.42 * a);
  ctx.save();
  ctx.globalAlpha = a * (w.afk ? 0.45 : (w.invuln > 0 && w.invuln < 50 && Math.floor(now() / 80) % 2 ? 0.5 : 1));
  if (w.afk) ctx.filter = 'grayscale(1)';
  const f = animFrame('william', w.animState || 'idle_signature', animMs(w)) || animFrame('william', 'idle_signature', now()) || animFrame('william', 'idle_personality', now());
  if (f) api.drawAnimFrame(f, x, w.y, w.facing, api.PLAYER_SCALE);
  else { ctx.fillStyle = '#4a5f8a'; ctx.fillRect(x - 12, w.y - 80, 24, 80); }
  ctx.restore();
  if (w.downed) { ctx.save(); ctx.fillStyle = '#ffd24a'; ctx.font = 'bold 14px sans-serif'; ctx.textAlign = 'center'; const t = now() / 300; for (let i = 0; i < 3; i++) ctx.fillText('★', x + Math.cos(t + i * 2.1) * 18, w.y - 40 + Math.sin(t + i * 2.1) * 5); ctx.restore(); }
}
function tag(ent, cam, label, color) {
  if (!ent || ent.alpha === 0) return;
  const ctx = api.ctx, x = Math.round(ent.x - cam), y = Math.round(ent.y - 84 * api.PLAYER_SCALE - 4);
  ctx.save(); ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'center';
  ctx.fillStyle = color; ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(x - 17, y - 11, 34, 18, 4); else ctx.rect(x - 17, y - 11, 34, 18); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.fillText(label, x, y + 3); ctx.restore();
}
function camX(x) {
  if (S.phase !== 'play') { if (baseZoom.v != null) { CAMERA.zoom = baseZoom.v; baseZoom.v = null; } return x; }
  const w = S.role === 'host' ? (S.wState === 'active' || S.wState === 'afk' ? S.w : null) : S.wLocal;
  if (!w) { if (baseZoom.v != null) { CAMERA.zoom = baseZoom.v; baseZoom.v = null; } return x; }
  if (baseZoom.v == null) baseZoom.v = CAMERA.zoom;
  const dist = Math.abs(x - w.x);
  CAMERA.zoom = Math.max(1, Math.min(baseZoom.v, 960 / (dist + 260))); // zooms out (to 1.0×) to keep both on screen
  return (x + w.x) / 2;
}

// ---------------------------------------------------------------- HUD + banners + title buttons
let hudEl = null;
function setHud(on) {
  if (!hudEl) {
    hudEl = document.createElement('div'); hudEl.id = 'coop-hud'; hudEl.className = 'hidden';
    hudEl.innerHTML = '<div id="coop-p2"><img src="assets/sprites/portraits/portrait_william_neutral_closed.png" alt=""><div><div class="coop-p2-name">P2&nbsp; WILLIAM</div><div id="coop-p2-hearts"></div><div class="coop-p2-bar"><div id="coop-p2-special"></div></div></div></div>' +
      '<div id="coop-net"><span class="dot"></span><span id="coop-net-text">Online</span></div><div id="coop-banner" class="hidden"></div><div id="coop-bark" class="hidden"></div><div id="coop-obj" class="hidden"></div><div id="coop-prompt" class="hidden"></div>';
    (document.getElementById('ui-layer') || document.body).appendChild(hudEl);
  }
  hudEl.classList.toggle('hidden', !on);
  const lb = document.getElementById('btn-coop-leave'); if (lb) lb.classList.toggle('hidden', !on);
}
let hudT = 0;
function updateHudCoop(dt) {
  if (!hudEl || S.phase !== 'play') return;
  hudT += dt; if (hudT < 0.2) return; hudT = 0;
  const w = S.role === 'host' ? S.w : S.wLocal;
  const hp = w ? Math.max(0, w.hp) : 0, n = Math.ceil(hp / 100 * 6);
  document.getElementById('coop-p2-hearts').textContent = '♥'.repeat(n) + '♡'.repeat(6 - n);
  document.getElementById('coop-p2-special').style.width = (w ? w.special : 0) + '%';
  const st = S.role === 'host' ? S.wState : 'active';
  const rtt = S.link ? S.link.rtt : 0;
  const t = !S.link ? (S.role === 'host' ? (st === 'afk' ? `William disconnected · waiting ${Math.ceil(S.afkT)} s` : 'Solo · room ' + prettyCode(S.code) + ' open') : 'Offline') : `Online · room ${prettyCode(S.code)} · ${rtt} ms`;
  document.getElementById('coop-net-text').textContent = t;
  const net = document.getElementById('coop-net'); net.classList.toggle('warn', !!S.link && rtt > 200); net.classList.toggle('off', !S.link);
  document.getElementById('coop-p2').classList.toggle('afk', !S.link || !!(w && w.downed));
  const ob = document.getElementById('coop-obj'); ob.textContent = S.obj || ''; ob.classList.toggle('hidden', !S.obj);
  const pr = document.getElementById('coop-prompt'); pr.textContent = S.prompt || ''; pr.classList.toggle('hidden', !S.prompt);
}
function banner(text) { setHud(S.phase === 'play'); const b = document.getElementById('coop-banner'); if (!b) return; b.textContent = text; b.classList.toggle('hidden', !text); }
let barkT = null;
function bark(text) { const b = document.getElementById('coop-bark'); if (!b) return; b.textContent = text; b.classList.remove('hidden'); clearTimeout(barkT); barkT = setTimeout(() => b.classList.add('hidden'), 2200); }

let titleBuilt = false, titleT = 9;
function refreshTitle(force) {
  if (!api || !api.booted) return;
  const host = document.getElementById('title-actions'); if (!host) return;
  if (!titleBuilt) {
    titleBuilt = true;
    const cont = document.createElement('button'); cont.type = 'button'; cont.id = 'btn-coop-continue'; cont.className = 'btn hidden'; cont.textContent = 'Continue Online Game';
    const play = document.createElement('button'); play.type = 'button'; play.id = 'btn-coop'; play.className = 'btn'; play.textContent = 'Play Online';
    const tip = document.createElement('div'); tip.id = 'coop-save-tip'; tip.className = 'coop-tip hidden';
    const after = document.getElementById('btn-ngplus') || document.getElementById('btn-continue'); // 2.1.0 merge: after New Game / NG+, so solo Start keeps first focus
    after.insertAdjacentElement('afterend', cont); cont.insertAdjacentElement('afterend', play); host.appendChild(tip);
    cont.addEventListener('click', () => { const l = CS.listSessions({ unfinished: true }); if (l.length > 1) ui.picker(l, (e) => createGame(e)); else if (l.length) createGame(l[0]); });
    play.addEventListener('click', () => ui.openMenu());
    const show = () => { const l = CS.listSessions({ unfinished: true }); if (!l.length) return; tip.innerHTML = tipHtml(l[0]) + (l.length > 1 ? `<div class="sub">+${l.length - 1} more co-op save(s)</div>` : ''); tip.classList.remove('hidden'); };
    cont.addEventListener('mouseenter', show); cont.addEventListener('focus', show);
    cont.addEventListener('mouseleave', () => tip.classList.add('hidden')); cont.addEventListener('blur', () => tip.classList.add('hidden'));
    // pause menu: leave the online game (autosaves on both devices)
    const ps = document.getElementById('btn-resume');
    if (ps) { const lb = document.createElement('button'); lb.type = 'button'; lb.id = 'btn-coop-leave'; lb.className = 'btn btn-secondary hidden'; lb.textContent = 'Leave Online Game (saves)'; ps.insertAdjacentElement('afterend', lb); lb.addEventListener('click', () => leave('quit')); }
  }
  if (!force && api.gameState.mode !== 'title') return;
  const has = CS.listSessions({ unfinished: true }).length > 0;
  document.getElementById('btn-coop-continue').classList.toggle('hidden', !has);
}
export function tipHtml(e) {
  const when = new Date(e.updatedAt); const ts = when.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  const partner = e.role === 'guest' ? 'Matthew + William (you)' : 'Matthew + William';
  return `<div class="t">Co-op save: ${partner}</div><div class="sub">${continuingLabel(e).replace('Continuing: ', '')}</div><div class="sub">${(e.savedWhy || 'Saved')} · ${ts}</div>`;
}

// ---------------------------------------------------------------- lifecycle (backgrounding, quit)
function installLifecycle() {
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') saveNow('Saved when the app went to the background'); });
  window.addEventListener('pagehide', () => { if (S.phase === 'play') { saveNow('Saved on quit'); S.link && S.link.send('bye', { why: 'quit' }); } });
  try { const App = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.App; if (App) App.addListener('appStateChange', (s) => { if (!s.isActive) saveNow('Saved when the app went to the background'); }); } catch (_) {}
  try { if (window.sorElectron && window.sorElectron.onBeforeQuit) window.sorElectron.onBeforeQuit(() => saveNow('Saved on quit')); } catch (_) {}
}

// ---------------------------------------------------------------- the hooks object
export const coop = {
  attach(a) {
    api = a; installLifecycle();
    if (Q.has('debug')) window.__coop = { S, CS, api: () => api, leave, createGame, joinGame, saveNow, lobbyView, setReady: (r) => ui.setReady(r), start: hostStart, inviteLink, signalMode };
    const j = Q.get('join');
    if (j) { try { const u = new URL(location.href); u.searchParams.delete('join'); history.replaceState(null, '', u.href); } catch (_) {} } // a reload never re-joins a stale room
    if (j) { const go = () => (api.booted ? joinGame(j) : setTimeout(go, 300)); setTimeout(go, 300); }
  },
  active: () => S.phase === 'play',
  isGuest: () => S.role === 'guest' && S.phase === 'play',
  preStep(dt, inp) {
    if (!api) return;
    titleT += dt; if (titleT > 1) { titleT = 0; refreshTitle(false); }
    if (S.phase !== 'play') return;
    const gs = api.gameState;
    if (gs.mode === 'title') { leave('quit'); return; } // left through some other menu: still autosave + tell the partner
    if (S.role === 'host') {
      S.hostInp = inp;
      if (S.link) { sendSnapshot(dt); hostDialoguePump(); hostOverlays(); }
      if (gs.mode !== S.lastMode) { if (S.link && gs.mode === 'pause' && S.lastMode === 'play') { S.link.send('pause', {}); } if (S.link && S.lastMode === 'pause' && gs.mode === 'play') { S.link.send('resume', {}); banner(''); } }
    } else {
      if (gs.mode !== S.lastMode && S.link) {
        if (gs.mode === 'pause' && S.lastMode === 'play' && !S.remotePause) S.link.send('pause', {});
        if (S.lastMode === 'pause' && gs.mode === 'play') { S.link.send('resume', {}); banner(''); }
        S.remotePause = false;
      }
    }
    S.lastMode = gs.mode;
    updateHudCoop(dt);
  },
  guestStep,
  hostStep,
  downStep,
  targetFor,
  drawItems,
  camX,
  allowAdvance,
  lines(npc, solo) { return S.phase === 'play' && api ? coopLinesFor(npc, solo, api) : solo; },
  filterNpcs(list) { return S.phase === 'play' && (S.role === 'guest' || S.wState !== 'gone') ? list.filter((n) => n.id !== 'william') : list; }, // solo again after William left: NPC William is back
  saveSource() { return S.loadPayload ? { data: S.loadPayload, status: 'ok' } : null; },
  persist(payload) {
    if (S.phase !== 'play' && S.phase !== 'ended') return false;
    if (S.role !== 'host') return true; // the guest's copy arrives from the host ('save')
    const why = S.saveWhy || 'Checkpoint'; S.saveWhy = null;
    S.entry = CS.writeSession({ ...(S.entry || {}), partnershipId: S.pid, partnerName: P2, selfName: P1, role: 'host', payload, coopFlags: { ...S.flags }, savedWhy: why, updatedAt: Date.now(), saveRev: undefined });
    if (S.link) S.link.send('save', { entry: S.entry, why });
    return true;
  }
};

// ---------------------------------------------------------------- 2.1.0: co-op beats (W1–W4, stealth split, boss finisher, revive Matthew)
const near = (a, x, r = 90) => a && Math.abs(a.x - x) < r;
function coopNpc(id, name, onDone) { return { id, name, role: 'Co-op', onDone }; }
function lineVo(gs) {
  const L = gs.dialogue && gs.dialogue[gs.dialogueIdx]; if (!L) return null;
  try { return typeof L === 'object' ? (L.voice || VO.lineIdFor(L.text, L.id)) : VO.lineIdFor(L, gs.dialogueNpc && gs.dialogueNpc.id); } catch (_) { return null; }
}
function talk(npcId, name, lines, onDone) { api.startDialogueRaw(coopNpc(npcId, name, onDone), lines); }
function beats(dt, inp) {
  const gs = api.gameState, sb = api.stateBag, p = api.player, w = S.w;
  S.prompt = ''; S.obj = ''; S.zones = null;
  if (gs.mode !== 'play') return;
  const side = sb.side, m = side ? api.sideMission() : null;
  const zones = [];
  // W1–W4: William is Player 2, so his quests start from his spot as two-way banter (either player presses Interact)
  if (!side && !gs.combatLock) {
    const q = api.missions.missionFor('william');
    const def = api.NPC_DEFS.find((n) => n.id === 'william');
    if (q && q.kind && def && def.area === gs.areaId) {
      zones.push([def.x, "William's idea: " + q.title, 'quest']);
      if (near(w, def.x) || near(p, def.x)) {
        S.prompt = `E — William's idea: ${q.title}`;
        if (inp.interactPressed || (S.hostInp && S.hostInp.interactPressed && !api.npcsInArea().some((n) => Math.abs(n.x - p.x) < 55))) {
          talk('william', 'William Burks', COOP_SIDE_OFFERS[q.id] || q.offer, () => { api.startSide(q); if (q.kind === 'fetch') toast('Split the errands: either of you can pick up an item.'); });
          return;
        }
      }
    }
  }
  if (m && m.id === 'side_william_score' && side.area === gs.areaId) side.x = w.x; // W2: William pushes the cabinet dolly himself
  if (m && m.kind === 'fetch' && m.id === 'side_william_flowers') { // W3: two runners, either can grab an errand
    if (inp.interactPressed) {
      const it = m.items.find((x) => !sb.fetchItems.includes(x.id) && api.npcsInArea().some((n) => n.id === x.npc && Math.abs(n.x - w.x) < 60));
      if (it) { sb.fetchItems.push(it.id); toast(`William got the ${it.name} (${sb.fetchItems.length}/${m.items.length})`); api.persist(); }
    }
    for (const x of m.items) { if (sb.fetchItems.includes(x.id)) continue; const n = api.npcsInArea().find((k) => k.id === x.npc); if (n) zones.push([n.x, x.name, 'item']); }
    if (api.fetchDone() && !S.fetchClosing) { S.fetchClosing = true; talk('william', 'William Burks', COOP_SIDE_DONE.side_william_flowers, () => { S.fetchClosing = false; api.completeSide(); }); return; }
  }
  if (m && m.id === 'side_william_rematch') S.obj = side.pvp ? `Rematch · P1 ${side.pvp.p1} – ${side.pvp.p2} P2 · first to 5 clean hits` : '';
  stealth(dt, zones);
  S.zones = zones.length ? zones : null;
}
/** W4 Coach's Corner Rematch in co-op: friendly P1 vs P2 points match (no damage); falls back to AI sparring if William drops. */
function overlapBody(hb, d) { return hb.x < d.x + 14 && hb.x + hb.w > d.x - 14 && hb.y < d.y - 4 && hb.y + hb.h > d.y - 60 && Math.abs((hb.y + hb.h) - d.y) < 80; }
function pvp() {
  const sb = api.stateBag, side = sb.side, gs = api.gameState;
  if (!side || side.id !== 'side_william_rematch') return;
  const p = api.player, w = S.w;
  side.pvp ||= { p1: 0, p2: 0 }; side.next = 99; side.hits = 0;
  gs.enemies = gs.enemies.filter((e) => !e.sparring);
  const tag = (att, def) => { const hb = att.hitbox; if (!hb || hb.live === false || hb.hit.has(def) || Math.abs(att.y - def.y) > 22) return false; if (!overlapBody(hb, def)) return false; hb.hit.add(def); def.invuln = 0.3; sfx('punch'); return true; };
  if (tag(p, w)) side.pvp.p1++;
  if (tag(w, p)) side.pvp.p2++;
  const win = side.pvp.p1 >= 5 ? 'p1' : side.pvp.p2 >= 5 ? 'p2' : null;
  if (win && !side.pvpDone) { side.pvpDone = true; talk('coach', 'Coach Ray Delgado', COOP_SIDE_DONE['side_william_rematch_' + win], () => api.completeSide()); }
}
function pvpFallback() { const side = api.stateBag.side; if (side && side.id === 'side_william_rematch' && side.pvp && !side.pvpDone) { side.pvp = null; side.next = 0.6; toast("William's gone — Coach sends in his league buddies instead."); } }
/** main3 co-op stealth split. */
const GATE_X = 260, OFFICE_X = 1060; // 800 px apart: inside the one-screen leash
function stealth(dt, zones) {
  const gs = api.gameState, sb = api.stateBag, p = api.player, w = S.w;
  if (S.flags.stealth || !sb.missions.main3 || !sb.missions.main3.done || (sb.missions.main4 && sb.missions.main4.done)) return;
  if (gs.areaId !== 'rails') { S.obj = 'Co-op: back to the Rail Yards for the stealth split (gate + records)'; return; }
  if (!S.st) { S.st = { phase: 'in', t: 0, cool: 0 }; talk('hank', 'Hank "Rail" Pettigrew', COOP_STEALTH.start, () => {}); return; }
  const st = S.st; st.cool -= dt;
  const pGate = near(p, GATE_X), wGate = near(w, GATE_X), pOff = near(p, OFFICE_X), wOff = near(w, OFFICE_X);
  zones.push([GATE_X, 'GATE · distract the patrol', pGate || wGate ? 'on' : 'off'], [OFFICE_X, st.phase === 'in' ? "RECORDS · Hank's ledger" : 'OFFICE · cover the exit', pOff || wOff ? 'on' : 'off']);
  const gateHeld = pGate || wGate, someoneNearOffice = Math.abs(p.x - OFFICE_X) < 320 || Math.abs(w.x - OFFICE_X) < 320;
  if (!gateHeld && someoneNearOffice && st.cool <= 0 && !gs.combatLock) {
    st.cool = 8; st.t = 0;
    const b = getDepthBand();
    for (let i = 0; i < 2; i++) { const e = createThug(OFFICE_X - 140 - i * 60, b.min + 10 + i * 20, gs.wave || 0); e.nameTag = 'Rail Patrol'; S.seen.add(e); gs.enemies.push(e); }
    gs.combatLock = true; toast(COOP_STEALTH.spotted, true);
  }
  let ok, reader;
  if (st.phase === 'in') { ok = (pGate && wOff) || (wGate && pOff); reader = pOff ? 'p' : 'w'; }
  else { ok = st.reader === 'p' ? (pGate && wOff) : (wGate && pOff); }
  st.t = ok ? st.t + dt : Math.max(0, st.t - dt * 0.5);
  const need = st.phase === 'in' ? 3 : 2;
  S.obj = st.phase === 'in'
    ? `Stealth split: one at the GATE, one reads Hank's records · ${Math.min(100, Math.round(st.t / need * 100))}%`
    : `Swap for the escape: ${st.reader === 'p' ? 'Matthew' : 'William'} out the GATE, the other covers the OFFICE · ${Math.min(100, Math.round(st.t / need * 100))}%`;
  if (st.t >= need) {
    if (st.phase === 'in') { st.phase = 'out'; st.reader = reader; st.t = 0; talk('hank', 'Hank "Rail" Pettigrew', COOP_STEALTH.swap, () => {}); }
    else { S.flags.stealth = true; S.st = null; api.gameState.score += 800; talk('hank', 'Hank "Rail" Pettigrew', COOP_STEALTH.done, () => { toast('Stealth split complete: +800'); api.persist(); }); }
  }
}
/** Boss double-team finisher: once Silas is staggering, only two hits inside the same 1 s window put him down. */
function bossPre() {
  const gs = api.gameState;
  if (!gs.bossActive || S.wState !== 'active' || !S.w || S.w.downed) { S.bossPrev = null; return null; }
  const b = gs.enemies.find((e) => e.isBoss); if (!b) return null;
  const t = now();
  if (S.bossPrev && S.bossPrev.e === b && b.hp < S.bossPrev.hp) S.p1HitT = t; // Matthew (and his kit) hit since our last look
  return { b, hp1: b.hp, t };
}
function bossPost(f) {
  if (!f) return;
  const { b, hp1, t } = f;
  if (b.hp < hp1) S.p2HitT = t;
  if (b.hp > 0 && b.hp <= b.maxHp * 0.12 && !S.finWarned) { S.finWarned = true; toast(COOP_FINISHER.ready, true); }
  if (b.hp <= 0 || !b.alive) {
    const both = t - (S.p1HitT || -1e9) <= 1000 && t - (S.p2HitT || -1e9) <= 1000;
    if (!both) {
      b.alive = true; b.hp = Math.max(1, Math.round(b.maxHp * 0.06)); b.koT = 0; b.kd = null; b.stun = 0.35; b.invuln = 0.15;
      if (!S.finBlockT || t - S.finBlockT > 3000) { S.finBlockT = t; toast(COOP_FINISHER.blocked); }
    } else if (!S.flags.finisher) {
      S.flags.finisher = true; bark('DOUBLE-TEAM FINISHER!'); S.link && S.link.send('bark', { text: 'DOUBLE-TEAM FINISHER!' });
      COOP_FINISHER.done.forEach((l, i) => setTimeout(() => {
        toast(`${l.name.toUpperCase()}: "${l.text}"`);
        const id = VO.lineIdFor(l.text, l.id); if (id) { try { VO.play(id); } catch (_) {} S.link && S.link.send('vo', { id }); }
      }, 2500 + i * 2600));
    }
  }
  S.bossPrev = { e: b, hp: b.hp };
}
/** KO-branch hook: Matthew stays down (up to 20 s) while William fights on; William presses Interact next to him for 2 s to revive. */
function downStep(dt, area) {
  if (S.role !== 'host' || S.phase !== 'play' || !S.w || S.wState !== 'active' || S.w.downed || !S.w.alive) { S.mDown = null; return false; }
  const p = api.player, w = S.w;
  if (!S.mDown) { S.mDown = { t: 0, rev: 0 }; toast('Matthew is down! William: get to him and press Interact to revive.', true); }
  S.mDown.t += dt;
  if (S.mDown.t > 20) { S.mDown = null; return false; } // nobody came: the normal checkpoint respawn runs
  p.koT = Math.max(p.koT, 0.2);
  hostStep(dt, area);
  if (!p.alive && !w.downed) {
    const close = Math.abs(w.x - p.x) < 60 && Math.abs(w.y - p.y) < 30;
    S.prompt = close ? 'William: reviving Matthew…' : 'Matthew is down — William, get to him and press E';
    if (S.remoteInp && S.remoteInp.interactPressed && close) S.mDown.rev = S.mDown.rev || 2;
    if (S.mDown.rev > 0) {
      if (!close) S.mDown.rev = 0;
      else if ((S.mDown.rev -= dt) <= 0) {
        p.alive = true; p.hp = Math.round(p.maxHp * 0.5); p.koT = 0; p.kd = null; p.lift = 0; p.invuln = 1.5; p.koSting = false; p.attackTimer = 0; p.hitbox = null;
        S.mDown = null; S.prompt = ''; toast('William got Matthew back up!');
      }
    }
  }
  return true;
}
/** Host-only overlays (story intro card, ending) and every host toast are mirrored to the guest. */
function vis(id) { const e = document.getElementById(id); return !!e && !e.classList.contains('hidden'); }
function hostOverlays() {
  const ov = { intro: vis('story-intro') ? txt('story-intro-text') : null, end: vis('ending-screen') ? { text: txt('ending-text'), hooks: (document.getElementById('sequel-hooks') || {}).innerHTML || '', title: (document.querySelector('#ending-screen h1') || {}).textContent || '' } : null };
  const sig = JSON.stringify(ov);
  if (sig !== S.lastOv) { S.lastOv = sig; S.link.send('ov', ov); }
  const tt = vis('toast') ? txt('toast') : '';
  if (tt && tt !== S.lastToast) S.link.send('toast', { msg: tt });
  S.lastToast = tt;
}
function guestOverlays(d) {
  const si = document.getElementById('story-intro');
  if (si) { if (d.intro) document.getElementById('story-intro-text').textContent = d.intro; si.classList.toggle('hidden', !d.intro); }
  const es = document.getElementById('ending-screen');
  if (es) {
    if (d.end) { document.getElementById('ending-text').textContent = d.end.text; document.getElementById('sequel-hooks').innerHTML = d.end.hooks; const h = es.querySelector('h1'); if (h && d.end.title) h.textContent = d.end.title; }
    es.classList.toggle('hidden', !d.end);
  }
}
function drawZones(cam) {
  const ctx = api.ctx, y = getDepthBand().max - 6;
  for (const [x, label, st] of S.zones || []) {
    const sx = x - cam; ctx.save();
    ctx.globalAlpha = 0.75; ctx.strokeStyle = st === 'on' ? '#3ccf6e' : st === 'quest' ? '#ffd24a' : st === 'item' ? '#9fd3ff' : '#ff8a5c'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.ellipse(sx, y, 70, 14, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.globalAlpha = 1; ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(10,10,16,.8)';
    const tw = ctx.measureText(label).width + 12; ctx.fillRect(sx - tw / 2, y + 16, tw, 16); ctx.fillStyle = '#fff'; ctx.fillText(label, sx, y + 28);
    if (st === 'quest') { ctx.fillStyle = '#ffd24a'; ctx.font = 'bold 22px sans-serif'; ctx.fillText('!', sx, y - 110); }
    ctx.restore();
  }
}
