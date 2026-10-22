// 2.1.0 online co-op e2e: two headless Chrome browsers (Playwright) + a local PeerJS server (npm 'peer', localhost:9000/sor).
// Run: node node_modules/.bin/peerjs --port 9000 --path /sor &  python3 -m http.server 5180 (repo root) &  node test/coop_e2e.mjs
import { chromium } from 'playwright-core';
import fs from 'node:fs';
const BASE = process.env.BASE || 'http://localhost:5180/';
const OUT = new URL('../demo/', import.meta.url).pathname;
const FR = OUT + 'frames/'; fs.mkdirSync(FR, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let fails = 0; const results = [];
const check = (n, ok, info = '') => { if (!ok) fails++; const l = `${ok ? 'PASS' : 'FAIL'}  ${n}${info ? '  — ' + info : ''}`; results.push(l); console.log(l); };
const SIG = process.env.SIGNAL || 'relay'; // 'local' = real WebRTC via the local PeerJS server (blocked by this box's Chrome policy)

async function mkBrowser(name) {
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required', '--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--disable-features=WebRtcHideLocalIpsWithMdns', '--allow-loopback-in-peer-connection'] });
  const ctx = await b.newContext({ viewport: { width: 1280, height: 720 }, serviceWorkers: 'block' });
  const p = await ctx.newPage(); p.errors = []; p.tag = name;
  p.on('pageerror', (e) => { p.errors.push(e.message); console.log(`[${name} pageerror]`, e.message); });
  p.on('console', (m) => { const t = m.text(); if (m.type() === 'error' && !/Failed to load resource|favicon/.test(t)) { p.errors.push(t); console.log(`[${name} console]`, t); } if (/\[coop\]/.test(t)) console.log(`[${name}]`, t); });
  return { b, ctx, p };
}
async function boot(p, q = '') {
  await p.goto(BASE + '?debug=1&signal=' + SIG + q, { waitUntil: 'load' });
  await p.waitForFunction(() => window.__scd && window.__scd.booted() && window.__coop, null, { timeout: 90000 });
  await sleep(800);
}
const ev = (p, fn, a) => p.evaluate(fn, a);
const mode = (p) => ev(p, () => window.__scd.gameState.mode);
const S = (p) => ev(p, () => { const S = window.__coop.S; return { role: S.role, phase: S.phase, code: S.code, linked: !!S.link, ready: S.ready, status: S.status, wState: S.wState, versionOk: S.versionOk, pid: S.pid }; });
async function waitFor(p, fn, a, ms = 20000) { try { await p.waitForFunction(fn, a, { timeout: ms, polling: 100 }); return true; } catch { return false; } }
async function press(p, key, hold = 60) { await p.keyboard.down(key); await sleep(hold); await p.keyboard.up(key); }
async function shot(p, name) { await p.screenshot({ path: OUT + name }); }
const coopSave = (p) => ev(p, () => JSON.parse(localStorage.getItem('starCityDrift_coop_v1') || 'null'));
const soloSave = (p) => ev(p, () => localStorage.getItem('starCityDrift_v1'));

const H = await mkBrowser('host'), G = await mkBrowser('guest');
// ---------- 0. real PeerJS signaling against the local 'peer' server (localhost:9000/sor)
{
  await H.p.goto(BASE + 'sw.js'); await G.p.goto(BASE + 'sw.js');
  const code = await ev(H.p, async () => { const N = await import('/js/coop/net.js'); window.__r = await N.hostRoom(() => { window.__gotConn = true; }); return window.__r.code; });
  check('PeerJS: host registered sor-<code> on the local signaling server', /^[A-Z2-9]{6}$/.test(code), code);
  const r = await ev(G.p, async (c) => { const N = await import('/js/coop/net.js'); try { await N.joinRoom(c, {}); return 'open'; } catch (e) { return String(e.type || e.message); } }, code);
  const policy = await ev(G.p, async () => { const a = new RTCPeerConnection({ iceServers: [] }); a.createDataChannel('x'); let n = 0; a.onicecandidate = (e) => { if (e.candidate) n++; }; await a.setLocalDescription(await a.createOffer()); await new Promise((r) => setTimeout(r, 1500)); return n; });
  if (r === 'open') check('PeerJS/WebRTC data channels open (local server)', true);
  else console.log(`INFO  WebRTC data channel did not open (${r}); ICE candidates gathered: ${policy}. This box's managed Chrome policy (WebRtcIPHandling: disable_non_proxied_udp) blocks UDP; gameplay tests use SIGNAL=${SIG}.`);
  results.push(`INFO  PeerJS signaling OK; WebRTC data channel: ${r} (ICE candidates: ${policy}; box policy disable_non_proxied_udp)`);
  await ev(H.p, () => window.__r.close());
}
const hp = H.p, gp = G.p;
await Promise.all([boot(hp), boot(gp)]);
check('both games booted (v2.1.0)', (await ev(hp, () => document.getElementById('game-version')?.textContent)) === 'v2.1.0');

// ---------- 1. lobby: create, invite by link, ready, version check
await press(hp, 'Enter'); await sleep(600);
check('main menu shows Play Online', await ev(hp, () => !!document.getElementById('btn-coop') && document.getElementById('btn-coop').offsetParent !== null));
await ev(hp, () => document.getElementById('btn-coop').click()); await sleep(300);
await ev(hp, () => document.getElementById('coop-new').click());
check('host room opened', await waitFor(hp, () => !!window.__coop.S.code));
const hs = await S(hp);
const link = await ev(hp, () => window.__coop.inviteLink(window.__coop.S.code));
console.log('room', hs.code, link);
check('room code alphabet (no O/0/I/1)', /^[A-HJ-NP-Z2-9]{6}$/.test(hs.code), hs.code);
check('invite link carries ?join=', /[?&]join=[A-Z2-9]{3}-[A-Z2-9]{3}/.test(link), link);
await gp.goto(link, { waitUntil: 'load' });
await gp.waitForFunction(() => window.__scd && window.__scd.booted() && window.__coop, null, { timeout: 90000 });
check('guest joined via invite link', await waitFor(gp, () => window.__coop.S.link && window.__coop.S.pid, null, 25000));
check('host sees the guest', await waitFor(hp, () => !!window.__coop.S.link && window.__coop.S.partnerVersion === '2.1.0'));
check('START locked until both ready', await ev(hp, () => document.getElementById('coop-start').disabled));
await ev(hp, () => document.getElementById('coop-ready').click());
await ev(gp, () => document.getElementById('coop-ready').click());
check('both READY → START unlocks', await waitFor(hp, () => !document.getElementById('coop-start').disabled));
await sleep(400);
await shot(hp, '01_lobby_host.png'); await shot(gp, '01_lobby_guest.png');

// version mismatch: a third browser on 2.0.9 joins a second room
{
  const X = await mkBrowser('old'); const H2 = await mkBrowser('host2');
  await boot(H2.p); await ev(H2.p, () => window.__coop.createGame(null));
  await waitFor(H2.p, () => !!window.__coop.S.code);
  const code2 = await ev(H2.p, () => window.__coop.S.code);
  await boot(X.p, '&coopVersion=2.0.9'); await ev(X.p, (c) => window.__coop.joinGame(c), code2);
  const okH = await waitFor(H2.p, () => window.__coop.S.partnerVersion === '2.0.9' && !window.__coop.S.versionOk);
  const msg = await ev(X.p, () => window.__coop.S.status);
  await ev(H2.p, () => document.getElementById('coop-ready').click());
  check('version check: mismatch blocks START + says which version to get', okH && /Update to 2\.1\.0/.test(msg) && (await ev(H2.p, () => document.getElementById('coop-start').disabled)) && (await ev(X.p, () => document.getElementById('coop-ready').disabled)), msg);
  await shot(X.p, '02_lobby_version_mismatch.png');
  await X.b.close(); await H2.b.close();
}

// ---------- 2. start + play main1 together
await ev(hp, () => document.getElementById('coop-start').click());
check('host in game', await waitFor(hp, () => window.__scd.gameState.mode === 'play'));
check('guest in game', await waitFor(gp, () => window.__scd.gameState.mode === 'play' && window.__coop.S.phase === 'play'));
await sleep(2500);
check('host sim has William (P2)', await ev(hp, () => !!window.__coop.S.w && window.__coop.S.wState === 'active'));
check('guest renders host snapshots', await waitFor(gp, () => window.__coop.S.snaps.length > 5));
check('William is not also an NPC in co-op', await ev(hp, () => !window.__scd.npcs().some((n) => n.id === 'william')));
// guest walks right; host sees William move (input path)
const wx0 = await ev(hp, () => window.__coop.S.w.x);
await gp.keyboard.down('ArrowRight'); await sleep(900); await gp.keyboard.up('ArrowRight'); await sleep(500);
const wx1 = await ev(hp, () => window.__coop.S.w.x);
check('guest input moves William on the host', wx1 - wx0 > 60, `${Math.round(wx0)} → ${Math.round(wx1)}`);
const gw = await ev(gp, () => window.__coop.S.wLocal.x);
check('guest prediction matches host (±40 px)', Math.abs(gw - wx1) < 40, `guest ${Math.round(gw)} host ${Math.round(wx1)}`);
await shot(hp, '03_both_in_game_host.png'); await shot(gp, '03_both_in_game_guest.png');

// mission 1 "Gone Quiet": talk to Dee (both players), co-op script
await ev(hp, () => window.__scd.warpToNpc('dee')); await sleep(900);
check('William followed Matthew to the diner', await ev(hp, () => Math.abs(window.__coop.S.w.x - window.__scd.player.x) < 200));
check('guest switched area with the host', await waitFor(gp, () => window.__scd.gameState.areaId === 'diner'));
await press(hp, 'e'); await sleep(500);
check('co-op Dee line on host', /Both of you in my door/.test(await ev(hp, () => document.getElementById('dialogue-text').textContent)));
check('co-op Dee line mirrored to guest', await waitFor(gp, () => /Both of you in my door/.test(document.getElementById('dialogue-text').textContent) && !document.getElementById('dialogue').classList.contains('hidden')));
await shot(hp, '04_dialogue_host.png'); await shot(gp, '04_dialogue_guest.png');
// both must press (or 4 s)
await press(hp, 'e'); await sleep(400);
const stillFirst = /Both of you/.test(await ev(hp, () => document.getElementById('dialogue-text').textContent));
await press(gp, 'e'); await sleep(500);
const second = await ev(hp, () => document.getElementById('dialogue-text').textContent);
check('dialogue advances only when both press', stillFirst && /booth still wobbles/.test(second), second);
const lines = [];
for (let i = 0; i < 12 && (await mode(hp)) === 'dialogue'; i++) {
  lines.push(await ev(gp, () => document.getElementById('dialogue-name').textContent.split(' —')[0]));
  await press(hp, 'e'); await press(gp, 'e'); await sleep(450);
}
check('William speaks in the scene (guest view)', lines.includes('William Burks'), lines.join(','));
check('main1 complete on host', await ev(hp, () => window.__scd.stateBag.missions.main1.done));
check('main1 complete mirrored on guest', await waitFor(gp, () => window.__scd.stateBag.missions.main1.done));
// fight outside the diner: scaled for two
check('street fight spawned', await waitFor(hp, () => window.__scd.gameState.combatLock && window.__scd.gameState.enemies.length > 0, null, 5000));
const nE = await ev(hp, () => window.__scd.gameState.enemies.length);
check('wave scaled ~1.5× for two players (3 → 5)', nE === 5, 'enemies ' + nE);
check('guest sees the same enemies', await waitFor(gp, (n) => window.__scd.gameState.enemies.length === n, nE));
await ev(hp, () => window.__scd.god(true));
// William fights: walk the guest to the nearest enemy and punch; record a GIF
const hp0 = await ev(hp, () => window.__scd.gameState.enemies.reduce((s, e) => s + e.hp, 0));
let f = 0;
const grab = async () => { const n = String(f++).padStart(3, '0'); await Promise.all([hp.screenshot({ path: `${FR}h_${n}.png` }), gp.screenshot({ path: `${FR}g_${n}.png` })]); };
for (let i = 0; i < 26; i++) {
  const tgt = await ev(hp, () => { const w = window.__coop.S.w; const es = window.__scd.gameState.enemies.filter((e) => e.alive); if (!es.length) return null; es.sort((a, b) => Math.abs(a.x - w.x) - Math.abs(b.x - w.x)); return { dx: es[0].x - w.x, dy: es[0].y - w.y }; });
  if (!tgt) break;
  const k = Math.abs(tgt.dx) > 34 ? (tgt.dx > 0 ? 'ArrowRight' : 'ArrowLeft') : null;
  const kv = Math.abs(tgt.dy) > 10 ? (tgt.dy > 0 ? 'ArrowDown' : 'ArrowUp') : null;
  if (k) await gp.keyboard.down(k); if (kv) await gp.keyboard.down(kv);
  await sleep(140); if (k) await gp.keyboard.up(k); if (kv) await gp.keyboard.up(kv);
  if (!k) { await press(gp, 'j', 40); await sleep(90); await press(gp, 'j', 40); }
  // Matthew swings too (demo: keep William on his feet so the clip shows both fighting)
  await ev(hp, () => { const w = window.__coop.S.w; if (w.alive) w.hp = Math.max(w.hp, 60); });
  await press(hp, 'j', 40);
  await grab();
}
const hp1 = await ev(hp, () => window.__scd.gameState.enemies.reduce((s, e) => s + e.hp, 0));
const wHits = await ev(hp, () => window.__coop.S.lastPress);
check('William\'s punches (guest presses) reached the host', wHits > 3, 'press ids ' + wHits);
check('enemies took damage', hp1 < hp0, `${hp0} → ${hp1}`);
await shot(hp, '05_fight_downtown_host.png'); await shot(gp, '05_fight_downtown_guest.png');
await ev(hp, () => window.__scd.killAll());
check('fight cleared', await waitFor(hp, () => !window.__scd.gameState.combatLock, null, 8000));
for (let i = 0; i < 6; i++) { await sleep(150); await grab(); }
await ev(hp, () => window.__scd.persist()); await sleep(600);

// ---------- 3. saves: separate slot on both devices
const hS = await coopSave(hp), gS = await coopSave(gp);
const pid = (await S(hp)).pid;
check('co-op save on host', !!hS && !!hS.sessions[pid] && hS.sessions[pid].payload.missionFlags.main1 === true);
check('identical copy on guest', !!gS && !!gS.sessions[pid] && gS.sessions[pid].hash === hS.sessions[pid].hash, gS && gS.sessions[pid] && gS.sessions[pid].hash);
check('solo save untouched (never written) on both', (await soloSave(hp)) === null && (await soloSave(gp)) === null);

// ---------- 4. lag: 150 ms simulated latency on the snapshot stream still interpolates smoothly
await ev(gp, () => { const S = window.__coop.S; const orig = S.link.receive; window.__lagOn = true; S.link.receive = (m) => (window.__lagOn ? setTimeout(() => orig(m), 75 + Math.random() * 40) : orig(m)); });
await gp.keyboard.down('ArrowLeft'); await sleep(1200); await gp.keyboard.up('ArrowLeft'); await sleep(900);
const lagH = await ev(hp, () => window.__coop.S.w.x), lagG = await ev(gp, () => window.__coop.S.wLocal.x);
check('with ~95 ms one-way jitter William stays in sync (±40 px)', Math.abs(lagH - lagG) < 40, `host ${Math.round(lagH)} guest ${Math.round(lagG)}`);
const jumps = await ev(gp, async () => { const xs = []; for (let i = 0; i < 30; i++) { xs.push(window.__scd.player.x); await new Promise((r) => requestAnimationFrame(r)); } return xs; });
check('interpolated Matthew on the guest has no teleport jumps', jumps.every((x, i) => i === 0 || Math.abs(x - jumps[i - 1]) < 20));
await ev(gp, () => { window.__lagOn = false; });

// ---------- 5. drop-out: guest's tab dies → AFK + autosave; drop back in with the link
await ev(hp, () => { window.__coopTimeout = 1; });
await G.ctx.close();
check('host: William disconnected → AFK + saved', await waitFor(hp, () => window.__coop.S.wState === 'afk', null, 12000));
const afkSave = (await coopSave(hp)).sessions[pid];
check('autosave on disconnect', /disconnected|left/.test(afkSave.savedWhy || ''), afkSave.savedWhy);
await shot(hp, '06_host_partner_dropped.png');
const G2ctx = await G.b.newContext({ viewport: { width: 1280, height: 720 }, serviceWorkers: 'block' });
const gp2 = await G2ctx.newPage(); gp2.on('pageerror', (e) => console.log('[guest2 pageerror]', e.message));
await gp2.goto(link, { waitUntil: 'load' });
check('drop-in: guest rejoins mid-session', await waitFor(gp2, () => window.__coop && window.__coop.S.phase === 'play', null, 40000));
check('host: William active again', await waitFor(hp, () => window.__coop.S.wState === 'active'));
await sleep(1500);
await shot(gp2, '07_guest_dropped_back_in.png');

// ---------- 6. guest leaves cleanly (pause → Leave Online Game) → saved on both
await press(gp2, 'Escape'); await sleep(500);
check('guest pause pauses the host too', await waitFor(hp, () => window.__scd.gameState.mode === 'pause'));
await shot(hp, '08_host_william_paused.png');
await ev(gp2, () => document.getElementById('btn-coop-leave').click());
check('guest back on the title', await waitFor(gp2, () => window.__scd.gameState.mode === 'title'));
check('host: William left → saved', await waitFor(hp, () => window.__coop.S.wState === 'afk' && /William left/.test(JSON.parse(localStorage.getItem('starCityDrift_coop_v1')).sessions[window.__coop.S.pid].savedWhy || '')));
await ev(hp, () => window.__scd.gameState.mode === 'pause' && document.getElementById('btn-resume').click());
// host continues a bit, then quits too
await ev(hp, () => window.__scd.warp('downtown', 400)); await sleep(400);
await ev(hp, () => window.__coop.leave('quit'));
check('host back on title', await waitFor(hp, () => window.__scd.gameState.mode === 'title'));
const g2S = await coopSave(gp2);
check('guest kept its own copy after leaving', !!g2S && !!g2S.sessions[pid] && g2S.sessions[pid].payload.missionFlags.main1);

// ---------- 7. Continue Online Game (guest device hosts this time; furthest progress wins)
await gp2.reload({ waitUntil: 'load' }); await gp2.waitForFunction(() => window.__scd && window.__scd.booted() && window.__coop, null, { timeout: 90000 }); await sleep(1500);
await press(gp2, 'Enter'); await sleep(1600);
check('"Continue Online Game" on the main menu', await ev(gp2, () => { const b = document.getElementById('btn-coop-continue'); return !!b && !b.classList.contains('hidden') && b.offsetParent !== null; }));
await ev(gp2, () => document.getElementById('btn-coop-continue').dispatchEvent(new Event('mouseenter')));
await sleep(200);
const tip = await ev(gp2, () => document.getElementById('coop-save-tip').textContent);
check('tooltip shows partner / mission / when', /Matthew \+ William/.test(tip) && /Main 2/.test(tip), tip);
await shot(gp2, '09_main_menu_continue_online.png');
await ev(gp2, () => document.getElementById('btn-coop-continue').click());
check('continue lobby opened with the same partnership id + a fresh code', await waitFor(gp2, (pid) => window.__coop.S.pid === pid && !!window.__coop.S.code, pid));
const code3 = await ev(gp2, () => window.__coop.S.code);
check('fresh room code', code3 !== hs.code, code3);
// make the old host's copy further along (it did a side quest offline?) → its copy must win
await ev(hp, (pid) => { const d = JSON.parse(localStorage.getItem('starCityDrift_coop_v1')); const e = d.sessions[pid]; e.payload.missionFlags.side_june = true; e.payload.collectTaken = [...(e.payload.collectTaken || []), 'cx_test']; e.progressScore += 101; e.saveRev += 1; localStorage.setItem('starCityDrift_coop_v1', JSON.stringify(d)); }, pid);
await ev(hp, (c) => window.__coop.joinGame(c), code3);
check('rejoin connected', await waitFor(gp2, () => !!window.__coop.S.link && window.__coop.S.partnerVersion));
const cont = await ev(gp2, () => document.getElementById('coop-continuing').textContent);
check('lobby says what is being continued', /Continuing: Main 2/.test(cont), cont);
check('furthest progress won (the partner copy with the extra side quest)', await waitFor(gp2, (pid) => JSON.parse(localStorage.getItem('starCityDrift_coop_v1')).sessions[pid].payload.missionFlags.side_june === true, pid));
await shot(gp2, '10_continue_lobby.png');
await ev(gp2, () => document.getElementById('coop-ready').click()); await ev(hp, () => document.getElementById('coop-ready').click());
await waitFor(gp2, () => !document.getElementById('coop-start').disabled);
await ev(gp2, () => document.getElementById('coop-start').click());
check('continued game running on both', await waitFor(hp, () => window.__coop.S.phase === 'play' && window.__scd.gameState.mode === 'play') && await waitFor(gp2, () => window.__scd.gameState.mode === 'play'));
await sleep(2000);
const st = await ev(gp2, () => ({ m1: window.__scd.stateBag.missions.main1.done, june: window.__scd.stateBag.missions.side_june.done, act: window.__scd.stateBag.activeMissionId }));
check('resumed at the saved progress (main1 done, main2 next, union kept)', st.m1 && st.june, JSON.stringify(st));
check('both copies identical after the sync', await waitFor(hp, (pid) => { const a = JSON.parse(localStorage.getItem('starCityDrift_coop_v1')).sessions[pid]; return !!a && a.payload.missionFlags.side_june; }, pid));
await shot(gp2, '11_continued_host_side.png'); await shot(hp, '11_continued_guest_side.png');
await ev(gp2, () => window.__coop.leave('quit')); await sleep(800);

const errs = [...hp.errors, ...gp.errors].filter((e) => !/AudioContext|play\(\) failed|NotAllowedError|reading 'update'/.test(e)); // 'update': index.html calls reg.update() on hide while the test blocks service workers
check('no page errors', errs.length === 0, errs.slice(0, 3).join(' | '));
fs.writeFileSync(OUT + 'test_results.txt', results.join('\n') + `\n\n${results.length - fails}/${results.length} passed\n`);
console.log(`\n${results.length - fails}/${results.length} passed`);
await H.b.close(); await G.b.close();
process.exit(fails ? 1 : 0);
