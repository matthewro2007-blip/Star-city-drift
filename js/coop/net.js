/**
 * 2.1.0 online co-op: transport. WebRTC data channels set up through PeerJS (vendored: js/vendor/peerjs.min.js).
 * Two channels per partner: 'rel' (reliable, ordered: scene/dialogue events, saves, lobby) and 'unrel'
 * (PeerJS reliable:false = unordered: inputs + snapshots). Falls back to the Netlify polling signal (netlify_signal.js).
 *
 * Signaling choice (URL params win):
 *   ?signal=local  → a local PeerJS server (npm 'peer') at ?peerHost (default this page's host) : ?peerPort (9000) /sor
 *   ?signal=cloud  → PeerJS cloud broker (0.peerjs.com, the library default)
 *   ?signal=netlify→ /api/signal (Netlify Function, code in netlify/functions/signal.mjs; not deployed)
 *   ?signal=relay  → TEST-ONLY WebSocket data relay (test/relay_server.mjs, ws://localhost:9001) for machines where
 *                    WebRTC is blocked by policy; carries the same messages, so the game code is identical.
 *   default: local when the page is served from localhost / 127.0.0.1, cloud otherwise.
 */
const Q = new URLSearchParams(typeof location !== 'undefined' ? location.search : '');
export const ROOM_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no O/0/I/1
export const PEER_PREFIX = 'sor-';

export function makeRoomCode(rand = Math.random) {
  let s = '';
  for (let i = 0; i < 6; i++) s += ROOM_ALPHABET[Math.floor(rand() * ROOM_ALPHABET.length)];
  return s;
}
export const prettyCode = (c) => (c || '').slice(0, 3) + '-' + (c || '').slice(3);
export function normalizeCode(txt) {
  const c = String(txt || '').toUpperCase().replace(/[^A-Z0-9]/g, '').replace(/O/g, '0').replace(/I/g, '1');
  return c.length === 6 && [...c].every((ch) => ROOM_ALPHABET.includes(ch)) ? c : null;
}

export function signalMode() {
  const s = Q.get('signal');
  if (s === 'local' || s === 'cloud' || s === 'netlify' || s === 'relay') return s;
  return typeof location !== 'undefined' && /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname) ? 'local' : 'cloud';
}

function iceServers() {
  if (signalMode() === 'local') return []; // same machine / LAN tests: host candidates only
  const list = [{ urls: 'stun:stun.l.google.com:19302' }];
  if (globalThis.__sorTurn) list.push(...globalThis.__sorTurn); // filled from /api/turn when a TURN tier is configured
  return list;
}

function peerOptions() {
  const base = { config: { iceServers: iceServers() }, debug: 0 };
  if (signalMode() === 'local') {
    return { ...base, host: Q.get('peerHost') || location.hostname || 'localhost', port: Number(Q.get('peerPort') || 9000), path: '/sor', secure: location.protocol === 'https:' };
  }
  return base;
}

/**
 * TURN for strict NAT: ask the Netlify function /api/turn (netlify/functions/turn.mjs) once per session, off localhost only.
 * ?turnUrl= overrides the endpoint (tests point it at a static JSON file). Never blocks longer than 2.5 s.
 */
let turnP = null;
export function ensureTurn() {
  if (signalMode() === 'local' || signalMode() === 'relay') return Promise.resolve([]);
  if (turnP) return turnP;
  turnP = (async () => {
    try {
      const ac = new AbortController(); const to = setTimeout(() => ac.abort(), 2500);
      const r = await fetch(Q.get('turnUrl') || 'api/turn', { cache: 'no-store', signal: ac.signal }); clearTimeout(to);
      if (!r.ok) return [];
      const d = await r.json();
      const list = (d.iceServers || []).filter((s) => s && s.urls && [].concat(s.urls).some((u) => /^turns?:/.test(u)));
      globalThis.__sorTurn = list; return list;
    } catch (_) { return []; }
  })();
  return turnP;
}
export const currentIceServers = () => iceServers();

let peerLib = null;
/** Load the vendored PeerJS once (classic UMD script → window.peerjs). Works from file://, Electron and Capacitor. */
export function loadPeerJs() {
  if (peerLib) return peerLib;
  peerLib = new Promise((resolve, reject) => {
    if (globalThis.peerjs && globalThis.peerjs.Peer) return resolve(globalThis.peerjs);
    const s = document.createElement('script');
    s.src = new URL('../vendor/peerjs.min.js', import.meta.url).href;
    s.onload = () => (globalThis.peerjs ? resolve(globalThis.peerjs) : reject(new Error('peerjs missing')));
    s.onerror = () => { peerLib = null; reject(new Error('Could not load js/vendor/peerjs.min.js')); };
    document.head.appendChild(s);
  });
  return peerLib;
}

/** One partner link: both channels + ping + liveness. */
export function createLink(sendRel, sendUnrel, closeFn) {
  const subs = new Set(), closers = new Set();
  const link = {
    rtt: 0, lastRx: performance.now(), closed: false,
    send(type, data) { if (!link.closed) try { sendRel({ t: type, d: data }); } catch (e) { console.warn('[coop] send', e); } },
    sendFast(type, data) { if (!link.closed) try { (sendUnrel || sendRel)({ t: type, d: data }); } catch (_) { /* dropped: fine for snapshots */ } },
    on(fn) { subs.add(fn); return () => subs.delete(fn); },
    onClose(fn) { closers.add(fn); },
    receive(msg) {
      link.lastRx = performance.now();
      if (!msg || typeof msg !== 'object') return;
      if (msg.t === '_ping') { link.send('_pong', msg.d); return; }
      if (msg.t === '_pong') { link.rtt = Math.round(performance.now() - msg.d); return; }
      for (const f of subs) f(msg.t, msg.d);
    },
    close(reason = 'closed') {
      if (link.closed) return;
      link.closed = true; clearInterval(timer);
      try { closeFn && closeFn(); } catch (_) {}
      for (const f of closers) f(reason);
    }
  };
  const timer = setInterval(() => {
    if (link.closed) return;
    link.send('_ping', performance.now());
    if (performance.now() - link.lastRx > (globalThis.__sorCoopTimeoutMs || 5000)) link.close('timeout');
  }, 1000);
  return link;
}

function wrapPeerConns(rel, unrel, peerToClose) {
  const link = createLink((m) => rel.send(m), unrel ? (m) => unrel.open && unrel.send(m) : null, () => { try { rel.close(); unrel && unrel.close(); } catch (_) {} if (peerToClose) try { peerToClose.destroy(); } catch (_) {} });
  rel.on('data', (m) => link.receive(m));
  if (unrel) unrel.on('data', (m) => link.receive(m));
  rel.on('close', () => link.close('peer-left'));
  rel.on('error', () => link.close('error'));
  return link;
}

/**
 * Host a room. onLink(link, meta) fires per partner that opens both channels. Returns { code, close() }.
 * The PeerJS id is `sor-<CODE>`; a taken id ("unavailable-id") rolls a new code.
 */
export async function hostRoom(onLink, { code = makeRoomCode(), tries = 4 } = {}) {
  if (signalMode() === 'relay') return relayHost(onLink, code);
  await ensureTurn();
  if (signalMode() === 'netlify') { const N = await import('./netlify_signal.js'); return N.hostRoom(onLink, { code }); }
  const { Peer } = await loadPeerJs();
  for (let i = 0; i < tries; i++) {
    try {
      const peer = await new Promise((res, rej) => {
        const p = new Peer(PEER_PREFIX + code, peerOptions());
        const to = setTimeout(() => rej(new Error('signal-timeout')), 10000);
        p.on('open', () => { clearTimeout(to); res(p); });
        p.on('error', (e) => { clearTimeout(to); rej(e); });
      });
      const pending = new Map();
      peer.on('connection', (conn) => {
        const slot = pending.get(conn.peer) || {}; pending.set(conn.peer, slot);
        conn.on('open', () => {
          slot[conn.label === 'unrel' ? 'unrel' : 'rel'] = conn;
          if (slot.rel && (slot.unrel || !conn.metadata?.two)) { pending.delete(conn.peer); onLink(wrapPeerConns(slot.rel, slot.unrel, null), conn.metadata || {}); }
        });
      });
      peer.on('disconnected', () => { try { peer.reconnect(); } catch (_) {} }); // lost the broker: open links stay up
      return { code, close: () => { try { peer.destroy(); } catch (_) {} } };
    } catch (e) {
      if (String(e && e.type) === 'unavailable-id') { code = makeRoomCode(); continue; }
      throw e;
    }
  }
  throw new Error('no-free-room-code');
}

/** Join a host's room by code. Resolves with a link once both channels are open. */
export async function joinRoom(code, meta = {}) {
  if (signalMode() === 'relay') return relayJoin(code, meta);
  await ensureTurn();
  if (signalMode() === 'netlify') { const N = await import('./netlify_signal.js'); return N.joinRoom(code, meta); }
  const { Peer } = await loadPeerJs();
  const peer = await new Promise((res, rej) => {
    const p = new Peer(undefined, peerOptions());
    const to = setTimeout(() => rej(new Error('signal-timeout')), 10000);
    p.on('open', () => { clearTimeout(to); res(p); });
    p.on('error', (e) => { clearTimeout(to); rej(e); });
  });
  return new Promise((res, rej) => {
    const opts = { metadata: { ...meta, two: true }, serialization: 'json' };
    const rel = peer.connect(PEER_PREFIX + code, { ...opts, label: 'rel', reliable: true });
    const unrel = peer.connect(PEER_PREFIX + code, { ...opts, label: 'unrel', reliable: false });
    let n = 0;
    const to = setTimeout(() => { try { peer.destroy(); } catch (_) {} rej(new Error('connect-timeout')); }, 12000);
    const ready = () => { if (++n === 2) { clearTimeout(to); res(wrapPeerConns(rel, unrel, peer)); } };
    rel.on('open', ready); unrel.on('open', ready);
    peer.on('error', (e) => { clearTimeout(to); try { peer.destroy(); } catch (_) {} rej(e); });
  });
}

// ---------------- TEST-ONLY relay transport (see test/relay_server.mjs)
const relayUrl = () => `ws://${Q.get('peerHost') || location.hostname || 'localhost'}:${Number(Q.get('relayPort') || 9001)}`;
function relayHost(onLink, code) {
  return new Promise((res, rej) => {
    const ws = new WebSocket(relayUrl()); const links = new Map();
    ws.onopen = () => ws.send(JSON.stringify({ op: 'host', room: code }));
    ws.onerror = () => rej(new Error('relay-unreachable'));
    ws.onmessage = (ev) => {
      const m = JSON.parse(ev.data);
      if (m.op === 'open') res({ code, close: () => ws.close() });
      else if (m.op === 'taken') { ws.close(); relayHost(onLink, makeRoomCode()).then(res, rej); }
      else if (m.op === 'peer') { const send = (x) => ws.readyState === 1 && ws.send(JSON.stringify({ op: 'to', id: m.id, m: x })); const l = createLink(send, send, () => ws.readyState === 1 && ws.send(JSON.stringify({ op: 'drop', id: m.id }))); links.set(m.id, l); onLink(l, m.meta); }
      else if (m.op === 'from') { const l = links.get(m.id); if (l) l.receive(m.m); }
      else if (m.op === 'gone') { const l = links.get(m.id); links.delete(m.id); if (l) l.close('peer-left'); }
    };
    ws.onclose = () => { for (const l of links.values()) l.close('peer-left'); };
  });
}
function relayJoin(code, meta) {
  return new Promise((res, rej) => {
    const ws = new WebSocket(relayUrl()); let link = null;
    ws.onopen = () => ws.send(JSON.stringify({ op: 'join', room: code, meta }));
    ws.onerror = () => rej(new Error('relay-unreachable'));
    ws.onmessage = (ev) => {
      const m = JSON.parse(ev.data);
      if (m.op === 'nohost') { ws.close(); const e = new Error('peer-unavailable'); e.type = 'peer-unavailable'; rej(e); }
      else if (m.op === 'joined') { const send = (x) => ws.readyState === 1 && ws.send(JSON.stringify({ op: 'up', m: x })); link = createLink(send, send, () => ws.close()); res(link); }
      else if (m.op === 'from' && link) link.receive(m.m);
    };
    ws.onclose = () => { if (link) link.close('peer-left'); };
  });
}
