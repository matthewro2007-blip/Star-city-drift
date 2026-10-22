// 2.1.0 co-op beats: guest overlays + VO, William revives Matthew, W1–W4 co-op rules, main3 stealth split,
// boss double-team finisher, TURN wiring. Two headless Chrome browsers over the test relay (see PROGRESS.md).
import { chromium } from 'playwright-core';
import fs from 'node:fs';
const BASE = process.env.BASE || 'http://localhost:5180/';
const SIG = process.env.SIGNAL || 'relay';
const OUT = new URL('../demo/', import.meta.url).pathname; fs.mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let fails = 0; const results = [];
const check = (n, ok, info = '') => { if (!ok) fails++; const l = `${ok ? 'PASS' : 'FAIL'}  ${n}${info ? '  — ' + info : ''}`; results.push(l); console.log(l); };
const args = ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'];
async function mk(name) {
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true, args });
  const p = await (await b.newContext({ viewport: { width: 1280, height: 720 }, serviceWorkers: 'block' })).newPage(); p.errors = [];
  p.on('pageerror', (e) => { p.errors.push(e.message); console.log(`[${name} pageerror]`, e.message); });
  return { b, p };
}
const ev = (p, fn, a) => p.evaluate(fn, a);
async function waitFor(p, fn, a, ms = 15000) { try { await p.waitForFunction(fn, a, { timeout: ms, polling: 100 }); return true; } catch { return false; } }
async function press(p, key, hold = 60) { await p.keyboard.down(key); await sleep(hold); await p.keyboard.up(key); }
async function boot(p) { await p.goto(BASE + '?debug=1&signal=' + SIG, { waitUntil: 'load' }); await p.waitForFunction(() => window.__scd && window.__scd.booted() && window.__coop, null, { timeout: 90000 }); await sleep(600); }

// TURN wiring (PeerJS path, no network: the endpoint is a static fixture)
{
  const T = await mk('turn');
  await T.p.goto(BASE + 'sw.js?signal=cloud&turnUrl=/test/fixtures/turn.json');
  const ice = await ev(T.p, async () => { const N = await import('/js/coop/net.js'); await N.ensureTurn(); return N.currentIceServers(); });
  check('TURN: PeerJS path fetches /api/turn and adds the relay servers', ice.some((s) => [].concat(s.urls).some((u) => /^turns?:/.test(u))) && ice.some((s) => /^stun:/.test([].concat(s.urls)[0])), JSON.stringify(ice).slice(0, 120));
  await T.p.goto(BASE + 'sw.js?signal=local');
  const ice2 = await ev(T.p, async () => { const N = await import('/js/coop/net.js'); await N.ensureTurn(); return N.currentIceServers(); });
  check('TURN: skipped on the local signaling server', ice2.length === 0);
  await T.b.close();
}

const H = await mk('host'), G = await mk('guest'); const hp = H.p, gp = G.p;
await Promise.all([boot(hp), boot(gp)]);
await ev(hp, () => window.__coop.createGame(null)); await waitFor(hp, () => !!window.__coop.S.code);
const code = await ev(hp, () => window.__coop.S.code);
await ev(gp, (c) => window.__coop.joinGame(c), code);
await waitFor(hp, () => !!window.__coop.S.link && window.__coop.S.partnerVersion);
await ev(hp, () => window.__coop.setReady(true)); await ev(gp, () => window.__coop.setReady(true)); await sleep(400);
await ev(hp, () => window.__coop.start());
check('co-op running', await waitFor(gp, () => window.__coop.S.phase === 'play' && window.__scd.gameState.mode === 'play'));
// host-only overlays: the story intro card (new campaign)
check('guest sees the host\'s story intro card', await waitFor(gp, () => { const e = document.getElementById('story-intro'); return e && !e.classList.contains('hidden') && /STAR GOES DARK/i.test(e.textContent); }, null, 6000));
await hp.screenshot({ path: OUT + '20_intro_card_host.png' }); await gp.screenshot({ path: OUT + '20_intro_card_guest.png' });
await sleep(1500);
check('host toasts are mirrored to the guest', await waitFor(gp, () => /Dee|Star City|Wren/.test(document.getElementById('toast').textContent), null, 8000));
const placeW = async (x) => { await ev(hp, (x) => { const w = window.__coop.S.w; w.x = x; w.y = window.__scd.player.y; }, x); await ev(gp, (x) => { const w = window.__coop.S.wLocal; if (w) { w.x = x; w.y = window.__scd.player.y; } }, x); await sleep(250); };
async function bothAdvance(max = 14) { const seen = []; for (let i = 0; i < max && (await ev(hp, () => window.__scd.gameState.mode)) === 'dialogue'; i++) { seen.push(await ev(gp, () => (window.__coop.S.dlg || {}).vo || '')); await press(hp, 'e'); await press(gp, 'e'); await sleep(350); } return seen; }
const mode = () => ev(hp, () => window.__scd.gameState.mode);

// guest hears the co-op VO
await ev(hp, () => { window.__scd.warpToNpc('dee'); window.__scd.gameState.enemies = []; window.__scd.gameState.combatLock = false; }); await sleep(700);
await press(hp, 'e'); await sleep(500);
const vo = await ev(gp, () => (window.__coop.S.dlg || {}).vo);
check('guest dialogue carries the co-op voice clip id', vo === 'coop.story.dee.01', vo);
check('co-op clip is in the VO manifest', await ev(gp, async () => { const r = await fetch('assets/vo/manifest.json'); const m = await r.json(); return !!m.lines['coop.story.dee.01'] && !!m.lines['coop.finisher.01']; }));
await bothAdvance();
check('main1 done', await ev(hp, () => window.__scd.stateBag.missions.main1.done));
await ev(hp, () => { window.__scd.killAll(); }); await sleep(800); await ev(hp, () => window.__scd.killAll()); await sleep(1500);

// William revives Matthew
await ev(hp, () => { window.__scd.spawnFight(1); const p = window.__scd.player; p.hp = 0; p.alive = false; p.koT = 1.2; });
await sleep(2200);
check('Matthew stays down while William is up (no instant respawn)', await ev(hp, () => !window.__scd.player.alive && window.__coop.S.mDown));
check('guest sees the revive prompt', await waitFor(gp, () => /Matthew is down|reviving/.test(document.getElementById('coop-prompt').textContent)));
await gp.screenshot({ path: OUT + '21_revive_prompt_guest.png' });
await placeW(await ev(hp, () => window.__scd.player.x + 20));
await press(gp, 'e'); await sleep(2600);
check('William revived Matthew (Interact, 2 s)', await ev(hp, () => window.__scd.player.alive && window.__scd.player.hp > 0), await ev(hp, () => window.__scd.player.hp));
await ev(hp, () => { window.__scd.killAll(); window.__scd.god(true); }); await sleep(1200);

// W1 The Boys' Booth: William's quest starts from his spot as two-way banter, shared
await ev(hp, () => { window.__scd.warp('diner', 800); window.__scd.gameState.combatLock = false; }); await placeW(860); await sleep(400);
check('quest prompt shows for William\'s idea', await waitFor(gp, () => /William's idea: The Boys' Booth/.test(document.getElementById('coop-prompt').textContent)));
await gp.screenshot({ path: OUT + '22_w1_quest_marker_guest.png' });
await press(gp, 'e'); await sleep(500);
check('W1 offer is the co-op banter', /Dee's window/.test(await ev(hp, () => document.getElementById('dialogue-text').textContent)));
await bothAdvance();
check('W1 started', await ev(hp, () => window.__scd.stateBag.side && window.__scd.stateBag.side.id === 'side_william_booth'));
for (let i = 0; i < 60 && !(await ev(hp, () => window.__scd.stateBag.missions.side_william_booth.done)); i++) { await ev(hp, () => window.__scd.killAll()); await sleep(400); }
check('W1 complete for both (shared reward on both copies)', await ev(hp, () => window.__scd.stateBag.missions.side_william_booth.done) && await waitFor(gp, () => window.__scd.stateBag.missions.side_william_booth.done));

// W2 High Score: William pushes the cabinet (the escort is Player 2)
await ev(hp, () => { window.__scd.warp('downtown', 860); }); await placeW(900); await sleep(300);
await press(gp, 'e'); await sleep(400); await bothAdvance();
check('W2 started from William\'s spot', await ev(hp, () => window.__scd.stateBag.side && window.__scd.stateBag.side.id === 'side_william_score'));
await placeW(640); await sleep(400);
const esc = await ev(hp, () => ({ s: window.__scd.stateBag.side.x, w: window.__coop.S.w.x }));
check('W2: the escort position is William himself', Math.abs(esc.s - esc.w) < 12, JSON.stringify(esc));
await ev(hp, () => window.__scd.warp('pages', 300)); await sleep(800);
for (let i = 0; i < 40 && !(await ev(hp, () => window.__scd.stateBag.missions.side_william_score.done)); i++) { await ev(hp, () => window.__scd.killAll()); await sleep(400); }
check('W2 complete', await ev(hp, () => window.__scd.stateBag.missions.side_william_score.done));

// W3 Water the Flowers: split errands — William grabs one himself
await ev(hp, () => { const m = window.__scd.stateBag.missions; m.main2.done = true; window.__scd.stateBag.activeMissionId = 'main3'; window.__scd.warp('downtown', 860); }); await placeW(900); await sleep(400);
await press(gp, 'e'); await sleep(400); await bothAdvance();
check('W3 started', await ev(hp, () => window.__scd.stateBag.side && window.__scd.stateBag.side.id === 'side_william_flowers'));
const deeX = await ev(hp, () => { window.__scd.warp('diner', 700); return window.__scd.npcs().find((n) => n.id === 'dee').x; }); await sleep(400);
await placeW(deeX); await press(gp, 'e'); await sleep(500);
check('W3: William picked up the watering can from Dee', await ev(hp, () => window.__scd.stateBag.fetchItems.includes('w_can')));
await ev(hp, () => { window.__scd.stateBag.fetchItems.push('w_tarp', 'w_twine'); }); await sleep(600);
check('W3: last errand → William closes it out (no NPC William needed)', /flower cart/.test(await ev(hp, () => document.getElementById('dialogue-text').textContent)));
await bothAdvance();
check('W3 complete', await ev(hp, () => window.__scd.stateBag.missions.side_william_flowers.done));

// main3 stealth split
await ev(hp, () => { const m = window.__scd.stateBag.missions; m.main3.done = true; window.__scd.stateBag.activeMissionId = 'main4'; window.__scd.warp('rails', 260); }); await sleep(700);
check('stealth split briefing from Hank', /Patrol cars at the gate/.test(await ev(hp, () => document.getElementById('dialogue-text').textContent)));
await bothAdvance();
await placeW(1060); await sleep(800);
await hp.screenshot({ path: OUT + '23_stealth_split_host.png' }); await gp.screenshot({ path: OUT + '23_stealth_split_guest.png' });
check('guest sees the stealth objective', /Stealth split/.test(await ev(gp, () => document.getElementById('coop-obj').textContent)));
await waitFor(hp, () => window.__scd.gameState.mode === 'dialogue', null, 6000);
check('phase 1 done (gate held, records read) → swap', /Now swap/.test(await ev(hp, () => document.getElementById('dialogue-text').textContent)));
await bothAdvance();
await ev(hp, () => { window.__scd.player.x = 1060; }); await placeW(260);
await waitFor(hp, () => window.__scd.gameState.mode === 'dialogue', null, 6000);
await bothAdvance();
check('stealth split complete (+ saved in the co-op flags)', await ev(hp, () => window.__coop.S.flags.stealth === true && JSON.parse(localStorage.getItem('starCityDrift_coop_v1')).sessions[window.__coop.S.pid].coopFlags.stealth === true));

// boss double-team finisher
await ev(hp, () => { window.__scd.warpToNpc('silas'); window.__scd.gameState.enemies = []; window.__scd.gameState.combatLock = false; }); await sleep(600);
await press(hp, 'e'); await sleep(400);
check('co-op Silas scene', /And the friend/.test(await ev(hp, () => document.getElementById('dialogue-text').textContent)));
await bothAdvance();
check('boss fight on', await waitFor(hp, () => window.__scd.gameState.bossActive));
await sleep(500);
await ev(hp, () => { const b = window.__scd.gameState.enemies.find((e) => e.isBoss); b.hp = Math.round(b.maxHp * 0.1); });
await sleep(400);
check('finisher prompt at low HP', await waitFor(hp, () => window.__coop.S.finWarned === true));
// a lone Matthew blow cannot finish him
await ev(hp, () => { const b = window.__scd.gameState.enemies.find((e) => e.isBoss); window.__coop.S.p2HitT = -1e9; b.hp = 0; b.alive = false; b.koT = 1; });
await sleep(300);
check('a lone hit does not finish Silas', await ev(hp, () => { const b = window.__scd.gameState.enemies.find((e) => e.isBoss); return !!b && b.alive && b.hp > 0 && window.__scd.gameState.bossActive; }));
// both inside 1 s
await ev(hp, () => { const b = window.__scd.gameState.enemies.find((e) => e.isBoss); window.__coop.S.p2HitT = performance.now(); b.hp = 0; b.alive = false; b.koT = 1; });
check('two hits inside 1 s finish Silas (main4 done)', await waitFor(hp, () => window.__scd.stateBag.missions.main4.done && window.__coop.S.flags.finisher, null, 5000));
await hp.screenshot({ path: OUT + '24_double_team_host.png' }); await gp.screenshot({ path: OUT + '24_double_team_guest.png' });
// ending (host-only overlay) shows on the guest
await sleep(9000);
await ev(hp, () => window.__scd.skipArrest && window.__scd.skipArrest());
check('guest sees the ending screen', await waitFor(gp, () => !document.getElementById('ending-screen').classList.contains('hidden') && document.getElementById('ending-text').textContent.length > 20, null, 30000));
await gp.screenshot({ path: OUT + '25_ending_guest.png' });
await ev(hp, () => document.getElementById('btn-replay') && document.getElementById('btn-replay').click()); await sleep(800);

// W4 Coach's Corner Rematch → P1 vs P2 points match
await ev(hp, () => { window.__scd.warp('gym', 560); window.__scd.gameState.enemies = []; window.__scd.gameState.combatLock = false; }); await placeW(620); await sleep(500);
await press(gp, 'e'); await sleep(400); await bothAdvance();
check('W4 started as PvP (no AI sparring buddies)', await ev(hp, () => window.__scd.stateBag.side && window.__scd.stateBag.side.id === 'side_william_rematch' && !!window.__scd.stateBag.side.pvp && !window.__scd.gameState.enemies.some((e) => e.sparring)));
await ev(hp, () => { window.__scd.stateBag.side.pvp.p2 = 4; window.__scd.god(false); const p = window.__scd.player; p.invuln = 0; });
for (let i = 0; i < 14 && !(await ev(hp, () => window.__scd.stateBag.side && window.__scd.stateBag.side.pvpDone)); i++) {
  await ev(hp, () => { const p = window.__scd.player, w = window.__coop.S.w; w.x = p.x - 30; w.y = p.y; w.facing = 1; p.invuln = 0; });
  await ev(gp, () => { const p = window.__scd.player, w = window.__coop.S.wLocal; w.x = p.x - 30; w.y = p.y; w.facing = 1; });
  await press(gp, 'j', 50); await sleep(350);
}
await gp.screenshot({ path: OUT + '26_rematch_guest.png' });
check('W4: William lands the 5th clean hit (points only)', await ev(hp, () => window.__scd.stateBag.side && window.__scd.stateBag.side.pvp.p2 >= 5), JSON.stringify(await ev(hp, () => window.__scd.stateBag.side && window.__scd.stateBag.side.pvp)));
await sleep(400); await bothAdvance();
check('W4 complete', await ev(hp, () => window.__scd.stateBag.missions.side_william_rematch.done));
await ev(gp, () => window.__coop.leave('quit')); await sleep(800);
const errs = [...hp.errors, ...gp.errors].filter((e) => !/reading 'update'|AudioContext|NotAllowedError|play\(\)/.test(e));
check('no page errors', errs.length === 0, errs.slice(0, 3).join(' | '));
fs.writeFileSync(OUT + 'beats_results.txt', results.join('\n') + `\n\n${results.length - fails}/${results.length} passed\n`);
console.log(`\n${results.length - fails}/${results.length} passed`);
await H.b.close(); await G.b.close(); process.exit(fails ? 1 : 0);
