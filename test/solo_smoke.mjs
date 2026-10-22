// Solo regression: with co-op off the hooks are no-ops (solo dialogue, solo save written, no William P2, no errors).
import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox'] });
const p = await (await b.newContext({ viewport: { width: 1280, height: 720 }, serviceWorkers: 'block' })).newPage();
const errs = []; p.on('pageerror', (e) => errs.push(e.message));
let fails = 0; const ok = (n, c, i = '') => { if (!c) fails++; console.log((c ? 'PASS  ' : 'FAIL  ') + n + (i ? '  — ' + i : '')); };
await p.goto('http://localhost:5180/?debug=1'); await p.waitForFunction(() => window.__scd && window.__scd.booted(), null, { timeout: 90000 });
await p.evaluate(() => window.__scd.startMain(false)); await p.waitForTimeout(1500);
ok('solo game running', await p.evaluate(() => window.__scd.gameState.mode === 'play'));
await p.evaluate(() => { window.__scd.warpToNpc('dee'); window.__scd.gameState.enemies = []; window.__scd.gameState.combatLock = false; }); await p.waitForTimeout(400);
await p.keyboard.press('e'); await p.waitForTimeout(300);
const t = await p.evaluate(() => document.getElementById('dialogue-text').textContent);
ok('solo Dee line (not the co-op variant)', /Sit down, hon/.test(t), t);
for (let i = 0; i < 6; i++) { await p.keyboard.press('e'); await p.waitForTimeout(150); }
ok('dialogue advances on one press (solo)', await p.evaluate(() => window.__scd.stateBag.missions.main1.done));
await p.evaluate(() => window.__scd.persist());
ok('solo save written to starCityDrift_v1', await p.evaluate(() => !!localStorage.getItem('starCityDrift_v1')));
ok('no co-op slot written in solo', await p.evaluate(() => !localStorage.getItem('starCityDrift_coop_v1')));
ok('no P2 drawn', await p.evaluate(() => !window.__coop.S.w && window.__coop.S.phase === 'off'));
ok('no page errors', errs.filter((e) => !/reading 'update'/.test(e)).length === 0, errs.join(' | '));
await b.close(); process.exit(fails ? 1 : 0);
