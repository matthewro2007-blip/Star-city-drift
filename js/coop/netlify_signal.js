/**
 * 2.1.0 co-op: signaling FALLBACK over the Netlify Function /api/signal (netlify/functions/signal.mjs).
 * Plain RTCPeerConnection, non-trickle ICE (wait for gathering), 1 s polling. Same link interface as net.js.
 * Channels: 'rel' (ordered, reliable) + 'unrel' (ordered:false, maxRetransmits:0) — the true unreliable channel.
 */
import { createLink } from './net.js';
const API = () => (new URLSearchParams(location.search).get('signalUrl') || '/api/signal');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function call(method, body, qs) {
  const r = await fetch(API() + (qs ? '?' + new URLSearchParams(qs) : ''), method === 'GET' ? { cache: 'no-store' } : { method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) { const e = new Error(d.error || 'signal-' + r.status); e.type = d.error; throw e; }
  return d;
}
async function iceConfig() {
  try { const r = await fetch('/api/turn', { cache: 'no-store' }); if (r.ok) return (await r.json()).iceServers; } catch (_) {}
  return [{ urls: 'stun:stun.l.google.com:19302' }];
}
function gathered(pc) {
  return new Promise((res) => { if (pc.iceGatheringState === 'complete') return res(); const to = setTimeout(res, 4000); pc.addEventListener('icegatheringstatechange', () => { if (pc.iceGatheringState === 'complete') { clearTimeout(to); res(); } }); });
}
function linkFor(pc, rel, unrel) {
  const link = createLink((m) => rel.readyState === 'open' && rel.send(JSON.stringify(m)), (m) => unrel.readyState === 'open' && unrel.send(JSON.stringify(m)), () => pc.close());
  const rx = (ev) => { try { link.receive(JSON.parse(ev.data)); } catch (_) {} };
  rel.onmessage = rx; unrel.onmessage = rx;
  rel.onclose = () => link.close('peer-left');
  pc.addEventListener('connectionstatechange', () => { if (pc.connectionState === 'failed') link.close('error'); });
  return link;
}
export async function hostRoom(onLink, { code }) {
  await call('POST', { op: 'open', room: code });
  const iceServers = await iceConfig();
  let open = true; const done = new Set();
  (async () => {
    while (open) {
      try {
        const { offers } = await call('GET', null, { op: 'offers', room: code });
        for (const o of offers) {
          if (done.has(o.id)) continue; done.add(o.id);
          const pc = new RTCPeerConnection({ iceServers }); const ch = {};
          pc.ondatachannel = (ev) => { ch[ev.channel.label] = ev.channel; ev.channel.onopen = () => { if (ch.rel && ch.unrel && ch.rel.readyState === 'open' && ch.unrel.readyState === 'open') onLink(linkFor(pc, ch.rel, ch.unrel), {}); }; };
          await pc.setRemoteDescription({ type: 'offer', sdp: o.sdp });
          await pc.setLocalDescription(await pc.createAnswer()); await gathered(pc);
          await call('POST', { op: 'answer', room: code, id: o.id, sdp: pc.localDescription.sdp });
        }
      } catch (e) { console.warn('[coop] netlify poll', e.message); }
      await sleep(1000);
    }
  })();
  return { code, close: () => { open = false; call('POST', { op: 'close', room: code }).catch(() => {}); } };
}
export async function joinRoom(code) {
  const pc = new RTCPeerConnection({ iceServers: await iceConfig() });
  const rel = pc.createDataChannel('rel', { ordered: true });
  const unrel = pc.createDataChannel('unrel', { ordered: false, maxRetransmits: 0 });
  await pc.setLocalDescription(await pc.createOffer()); await gathered(pc);
  const id = 'g-' + Math.random().toString(36).slice(2, 10);
  await call('POST', { op: 'offer', room: code, id, sdp: pc.localDescription.sdp });
  for (let i = 0; i < 20; i++) {
    const { sdp } = await call('GET', null, { op: 'answer', room: code, id });
    if (sdp) { await pc.setRemoteDescription({ type: 'answer', sdp }); break; }
    await sleep(1000);
  }
  await new Promise((res, rej) => { const to = setTimeout(() => rej(new Error('connect-timeout')), 12000); const chk = () => { if (rel.readyState === 'open' && unrel.readyState === 'open') { clearTimeout(to); res(); } }; rel.onopen = chk; unrel.onopen = chk; });
  return linkFor(pc, rel, unrel);
}
