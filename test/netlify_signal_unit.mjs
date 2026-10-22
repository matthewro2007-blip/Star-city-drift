// Unit test of netlify/functions/signal.mjs with the in-memory store (no Netlify runtime, nothing deployed).
import handler from '../netlify/functions/signal.mjs';
let fails = 0; const ok = (n, c) => { if (!c) fails++; console.log((c ? 'PASS  ' : 'FAIL  ') + n); };
const post = (b) => handler(new Request('http://x/api/signal', { method: 'POST', body: JSON.stringify(b) }));
const get = (q) => handler(new Request('http://x/api/signal?' + new URLSearchParams(q)));
ok('open room', (await post({ op: 'open', room: 'RKE4F7' })).status === 200);
ok('taken room → 409', (await post({ op: 'open', room: 'RKE4F7' })).status === 409);
ok('bad code rejected', (await post({ op: 'open', room: 'RKE0F7' })).status === 400);
ok('unknown room → 404 peer-unavailable', (await get({ op: 'offers', room: 'ZZZZZZ' })).status === 404);
ok('guest offer stored', (await post({ op: 'offer', room: 'RKE4F7', id: 'g-abc1', sdp: 'v=0 offer' })).status === 200);
const offers = await (await get({ op: 'offers', room: 'RKE4F7' })).json();
ok('host sees the offer', offers.offers.length === 1 && offers.offers[0].sdp === 'v=0 offer');
ok('answer stored', (await post({ op: 'answer', room: 'RKE4F7', id: 'g-abc1', sdp: 'v=0 answer' })).status === 200);
ok('guest gets the answer', (await (await get({ op: 'answer', room: 'RKE4F7', id: 'g-abc1' })).json()).sdp === 'v=0 answer');
ok('answered offers leave the queue', (await (await get({ op: 'offers', room: 'RKE4F7' })).json()).offers.length === 0);
ok('close', (await post({ op: 'close', room: 'RKE4F7' })).status === 200);
const turn = (await import('../netlify/functions/turn.mjs')).default;
ok('turn: STUN-only without config', (await (await turn()).json()).iceServers.length === 1);
console.log(fails ? `${fails} failed` : 'ALL PASS'); process.exit(fails ? 1 : 0);
