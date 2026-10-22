/**
 * 2.1.0 co-op signaling FALLBACK (Netlify Functions v2 + Netlify Blobs). CODE ONLY — not deployed.
 * Route: /api/signal (see netlify.toml). Stores one SDP offer/answer per guest per room code; clients poll every 1 s.
 * Gameplay never goes through here: after the handshake the two devices talk over WebRTC directly.
 *   POST {op:'open', room}                         host claims a room (409 if taken & fresh)
 *   POST {op:'offer', room, id, sdp}               guest posts its complete (non-trickle) offer
 *   GET  ?op=offers&room=                          host polls: [{id, sdp}] not yet answered
 *   POST {op:'answer', room, id, sdp}              host answers one guest
 *   GET  ?op=answer&room=&id=                      guest polls for its answer
 *   POST {op:'close', room}                        host closes the room
 * Rooms expire after 15 min. Room codes: 6 chars from ABCDEFGHJKLMNPQRSTUVWXYZ23456789.
 */
const TTL_MS = 15 * 60 * 1000;
const CODE = /^[A-HJ-NP-Z2-9]{6}$/;
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });

async function getRoomStore() {
  try { const { getStore } = await import('@netlify/blobs'); return getStore({ name: 'sor-signal', consistency: 'strong' }); }
  catch (_) { // local harness (no Netlify runtime): in-memory
    const m = (globalThis.__sorSignalMemory ||= new Map());
    return { get: async (k) => m.get(k) ?? null, setJSON: async (k, v) => { m.set(k, v); }, delete: async (k) => { m.delete(k); } };
  }
}
async function load(store, room) {
  const raw = await store.get(room, { type: 'json' }); const r = typeof raw === 'string' ? JSON.parse(raw) : raw;
  return r && Date.now() - r.t < TTL_MS ? r : null;
}

export default async function handler(req) {
  const store = await getRoomStore();
  const url = new URL(req.url);
  if (req.method === 'GET') {
    const room = url.searchParams.get('room'), op = url.searchParams.get('op');
    if (!CODE.test(room || '')) return json({ error: 'bad-room' }, 400);
    const r = await load(store, room); if (!r) return json({ error: 'peer-unavailable' }, 404);
    if (op === 'offers') return json({ offers: Object.entries(r.offers).filter(([id]) => !r.answers[id]).map(([id, sdp]) => ({ id, sdp })) });
    if (op === 'answer') { const id = url.searchParams.get('id'); return json({ sdp: r.answers[id] || null }); }
    return json({ error: 'bad-op' }, 400);
  }
  if (req.method !== 'POST') return json({ error: 'method' }, 405);
  let b; try { b = await req.json(); } catch (_) { return json({ error: 'bad-json' }, 400); }
  if (!CODE.test(b.room || '')) return json({ error: 'bad-room' }, 400);
  const r = await load(store, b.room);
  const sdpOk = (s) => typeof s === 'string' && s.length < 20000;
  if (b.op === 'open') { if (r) return json({ error: 'unavailable-id' }, 409); await store.setJSON(b.room, { t: Date.now(), offers: {}, answers: {} }); return json({ ok: true }); }
  if (!r) return json({ error: 'peer-unavailable' }, 404);
  if (b.op === 'offer' && sdpOk(b.sdp) && /^[a-z0-9-]{4,40}$/.test(b.id || '')) { if (Object.keys(r.offers).length >= 4) return json({ error: 'full' }, 429); r.offers[b.id] = b.sdp; }
  else if (b.op === 'answer' && sdpOk(b.sdp) && r.offers[b.id]) r.answers[b.id] = b.sdp;
  else if (b.op === 'close') { await store.delete(b.room); return json({ ok: true }); }
  else return json({ error: 'bad-op' }, 400);
  await store.setJSON(b.room, r);
  return json({ ok: true });
}
export const config = { path: '/api/signal' };
