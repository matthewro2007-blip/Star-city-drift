/**
 * 2.1.0 co-op: TURN credentials for strict-NAT networks (school Wi-Fi, carrier NAT). CODE ONLY — not deployed,
 * no account created. Keeps any TURN key on the server; the client asks /api/turn and gets short-lived ICE servers.
 * Configure ONE of (Netlify env vars):
 *   CF_TURN_KEY_ID + CF_TURN_API_TOKEN   → Cloudflare Realtime TURN (generates 1 h credentials)
 *   TURN_URLS (comma list) + TURN_USERNAME + TURN_CREDENTIAL → any static TURN (e.g. Metered Open Relay)
 * With nothing configured it returns STUN only, and the game shows "Couldn't connect – try another network".
 */
export default async function handler() {
  const env = (k) => (globalThis.Netlify ? Netlify.env.get(k) : process.env[k]);
  const ice = [{ urls: 'stun:stun.l.google.com:19302' }];
  try {
    if (env('CF_TURN_KEY_ID') && env('CF_TURN_API_TOKEN')) {
      const r = await fetch(`https://rtc.live.cloudflare.com/v1/turn/keys/${env('CF_TURN_KEY_ID')}/credentials/generate`, {
        method: 'POST', headers: { authorization: `Bearer ${env('CF_TURN_API_TOKEN')}`, 'content-type': 'application/json' }, body: JSON.stringify({ ttl: 3600 })
      });
      if (r.ok) { const d = await r.json(); if (d.iceServers) ice.push(d.iceServers); }
    } else if (env('TURN_URLS')) {
      ice.push({ urls: env('TURN_URLS').split(','), username: env('TURN_USERNAME'), credential: env('TURN_CREDENTIAL') });
    }
  } catch (_) { /* STUN only */ }
  return new Response(JSON.stringify({ iceServers: ice }), { headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
}
export const config = { path: '/api/turn' };
