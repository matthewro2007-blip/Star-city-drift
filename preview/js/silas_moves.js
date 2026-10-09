/**
 * DLC: Silas prequel — Silas Boone's moveset (game-logic lane).
 *
 * ONE implementation shared by playable Silas in the prequel and by Matthew wearing Silas's Suit in the
 * main game. combat.js routes a player's attack input here when its hooks carry `moveset: 'silas'`
 * (registerMoveset below); numbers live in kits.js SILAS_MOVES.
 *
 *   Gentleman's Jab  punch                  3-hit combo, the 3rd hit pushes the foe back
 *   Velvet Grip      heavy near a foe        grab, aim (hold ←/→), throw into others (thrown body hits them)
 *   Iron Handshake   Star Drive / special    25% meter: grab-and-slam, ground shockwave knocks down everyone near
 *   Last Word        kick (hold)             counter stance: a hit taken does no damage and is answered hard
 *   Cold Stare       talk, no NPC in range   8 s cooldown: regular thugs nearby hesitate ~1 s (bosses immune)
 *   Boss Rush        punch while sprinting   shoulder charge that plows through a line of foes
 *
 * Boss-like foes (main-game Silas, the prequel's bosses: e.isBoss || e.miniBoss) are immune to Cold Stare and
 * take a strong hit instead of being grabbed / thrown. Stun / hesitate scale by difficulty (effStun, kits.js KIT_DIFF).
 */
import { registerMoveset, applyHit, pushFx, effStun, knockDown, clampDepth } from './combat.js';
import { SILAS_MOVES as M } from './kits.js';
import { setAnim } from './anim.js';
import { sfx, voice } from './audio.js';

export const isBossLike = (e) => !!(e && (e.isBoss || e.miniBoss));
const vk = (p) => p.voiceKey || 'matthew';
const clampX = (x, w) => Math.max(30, Math.min(w - 30, x));

// ---------------------------------------------------------------- move-used events (tutorial, tests, HUD)
const listeners = new Set();
export function onSilasMove(fn) { listeners.add(fn); return () => listeners.delete(fn); }
function emit(move, detail = {}) { for (const fn of listeners) { try { fn(move, detail); } catch (_) { /* listener bug never breaks combat */ } } }

// ---------------------------------------------------------------- art state maps
/** Logical Silas states → art states. 'silas_boss' = Joe's boss strips (playable Silas in the prequel);
 *  'matthew' = Matthew in Silas's Suit (realArt: Joe's outfit art is installed; else the fallback outfit's
 *  plain strips, never its weapon (kit) frames). */
export function silasAnimMap(charKey, realArt = false) {
  if (charKey === 'silas_player') return {}; // Jack's playable-Silas set has every logical state (identity map)
  if (charKey === 'silas_boss') {
    return { idle_signature: 'idle', run: 'walk', sprint: 'run', victory: 'taunt', jump_kick: 'run', special: 'boss_attack3',
      combo1: 'boss_attack1', combo2: 'boss_attack2', combo3: 'boss_attack2',
      jab1: 'boss_attack1', jab2: 'boss_attack1', jab3: 'boss_attack2', grab: 'boss_attack1', whiff: 'boss_attack1', throw: 'boss_attack2',
      hs_grab: 'boss_attack1', hs_slam: 'boss_attack3', stance: 'taunt', counter: 'boss_attack2', stare: 'taunt', rush: 'run' };
  }
  // Matthew in Silas's Suit: Joe's matthew_silas set has every logical state (jab1-3, grab, whiff, throw, hs_grab,
  // hs_slam, stance, counter, stare, rush) → identity map, like silas_player. No-art fallback: closest plain states.
  if (realArt) return {};
  return { jab1: 'combo1', jab2: 'combo2', jab3: 'combo2', grab: 'combo1', whiff: 'combo1', throw: 'combo2',
    hs_grab: 'combo1', hs_slam: 'jump_kick', stance: 'idle', counter: 'combo2',
    stare: 'idle', rush: 'sprint', idle_signature: 'idle', special: 'jump_kick', combo3: 'combo2' };
}
/** Sheet pose for the no-art fallback draw (punch / kick / idle / walk). */
const POSE = { jab1: 'punch', jab2: 'punch', jab3: 'punch', grab: 'punch', whiff: 'punch', throw: 'punch', hs_grab: 'punch', hs_slam: 'kick',
  stance: 'idle', counter: 'punch', stare: 'idle', rush: 'walk' };

// ---------------------------------------------------------------- helpers
function cds(p) { return p.silasCd || (p.silasCd = { grip: 0, lastWord: 0, stare: 0, rush: 0 }); }
function begin(p, kind, anim, dur, extra = {}) {
  p.attackType = 'silas'; p.attackTimer = dur; p.idleT = 0; p.victoryT = 0; p.kitMove = null; p.hitbox = null;
  p.silasMove = { kind, el: 0, ...extra };
  setPose(p, anim);
}
function setPose(p, anim) { p.silasAnim = anim; p.pose = POSE[anim] || 'punch'; p.silasRestart = true; }
function box(p, off, w, top, h, extra) {
  const hb = { x: p.x + p.facing * off - (p.facing < 0 ? w : 0), y: p.y - top, w, h, hit: new Set(), off, oy: top, live: false, silas: true, ...extra };
  return hb;
}
function glue(p) {
  const hb = p.hitbox; if (!hb || !hb.silas) return;
  hb.x = p.x + p.facing * hb.off - (p.facing < 0 ? hb.w : 0); hb.y = p.y - hb.oy;
}
/** Nearest grabbable foe in front (along the facing, same lane). */
function frontFoe(p, enemies, reach, depth) {
  let best = null, bd = Infinity;
  for (const e of enemies || []) {
    if (!e.alive || e.kd || e.pull || e.grabbed || e.runner) continue;
    const along = (e.x - p.x) * p.facing, dy = Math.abs(e.y - p.y);
    if (along < -8 || along > reach || dy > depth) continue;
    const d = Math.abs(along) + dy;
    if (d < bd) { bd = d; best = e; }
  }
  return best;
}
function holdInFront(p, e) { e.x = p.x + p.facing * 30; e.y = p.y + 1; e.stun = Math.max(e.stun || 0, 0.3); e.attackTimer = 0; e.hitbox = null; e.pose = 'hurt'; }
function release(p) {
  const sm = p.silasMove;
  if (sm && sm.held) { const e = sm.held; e.grabbed = false; e.stun = Math.min(e.stun || 0, 0.25); sm.held = null; }
}
function hit(p, e, hb, hooks, dir) {
  if (!e || !e.alive) return false;
  applyHit(p, e, { hit: new Set(), ...hb }, hooks.areaWidth || 2400, hooks.onHitEnemy, dir == null ? p.facing : dir);
  return true;
}
function callout(text) { pushFx({ type: 'callout', text, follow: true, dur: 0.8, kit: 'silas' }); }

// ---------------------------------------------------------------- start (unlocked player, input this frame)
function start(p, input, dt, areaWidth, hooks, wantSprint) {
  const c = cds(p);
  hooks.areaWidth = areaWidth;
  const enemies = hooks.enemies || [];
  const ax = input.ax || 0;
  // Iron Handshake (special slot, meter)
  if (input.specialPressed) {
    const H = M.handshake;
    const can = p.specialCd <= 0 && (!hooks.canSpecial || hooks.canSpecial(H.cost));
    if (!can) { hooks.onSpecialDenied && hooks.onSpecialDenied(p.specialCd > 0 ? 'cooldown' : 'meter', H.cost); return false; }
    if (Math.abs(ax) > 0.15) p.facing = ax > 0 ? 1 : -1;
    hooks.onSpecial && hooks.onSpecial(H.cost);
    p.specialCd = H.cooldown;
    p.combo = 0; p.comboStep = 0; p.comboTimer = 0;
    const t = frontFoe(p, enemies, H.grabReach, H.depth);
    begin(p, 'handshake', 'hs_grab', H.dur, { held: null, boss: null, slammed: false });
    if (t && isBossLike(t)) p.silasMove.boss = t;
    else if (t) { p.silasMove.held = t; t.grabbed = true; holdInFront(p, t); }
    p.invuln = Math.max(p.invuln, 0.06);
    sfx('silas_grab'); voice(vk(p), 'special');
    callout('IRON HANDSHAKE!');
    emit('handshake', { grabbed: !!p.silasMove.held });
    return true;
  }
  // Boss Rush (attack while sprinting)
  if ((input.punchPressed || input.heavyPressed) && wantSprint && c.rush <= 0) {
    const R = M.rush;
    p.stamina = Math.max(0, p.stamina - R.stamina);
    if (p.stamina <= 0) p.staminaLock = true;
    if (Math.abs(ax) > 0.15) p.facing = ax > 0 ? 1 : -1;
    p.combo = 0; p.comboStep = 0; p.comboTimer = 0;
    begin(p, 'rush', 'rush', R.dur, { moved: 0 });
    p.hitbox = box(p, -6, 52, 72, 66, { dmg: R.dmg, knock: 30, knockdown: true, kdPush: 1.4, sfx: 'heavy', depth: R.depth });
    sfx('silas_rush'); voice(vk(p), 'big');
    callout('BOSS RUSH!');
    emit('rush');
    return true;
  }
  // Velvet Grip (heavy)
  if (input.heavyPressed) {
    if (c.grip > 0) return false;
    const G = M.grip;
    if (Math.abs(ax) > 0.15) p.facing = ax > 0 ? 1 : -1;
    p.combo = 0; p.comboStep = 0; p.comboTimer = 0;
    const t = frontFoe(p, enemies, G.reach, G.depth);
    begin(p, 'grip', t ? 'grab' : 'whiff', t ? G.startup + G.hold + G.throwDur : G.whiff, { target: t, phase: 'reach', held: null });
    sfx('whiff', { heavy: true }); voice(vk(p), 'attack', { chance: 0.6 });
    emit('grip_try', { target: !!t });
    return true;
  }
  // Last Word (kick: counter stance)
  if (input.kickPressed) {
    if (c.lastWord > 0) return false;
    const L = M.lastWord;
    p.combo = 0; p.comboStep = 0; p.comboTimer = 0;
    begin(p, 'stance', 'stance', L.window + L.recover, { stanceEnd: L.window, countered: false });
    sfx('silas_stance');
    pushFx({ type: 'stance', follow: true, dur: L.window, x: p.x, y: p.y });
    emit('lastword_stance');
    return true;
  }
  // Gentleman's Jab (punch)
  if (input.punchPressed) {
    p.comboStep = p.comboStep >= 3 ? 1 : p.comboStep + 1;
    p.combo = p.comboStep;
    p.comboTimer = M.jab.window;
    const h = M.jab.hits[p.comboStep - 1];
    if (Math.abs(ax) > 0.15) p.facing = ax > 0 ? 1 : -1;
    begin(p, 'jab', 'jab' + p.comboStep, h.dur, { step: p.comboStep, h });
    p.hitbox = box(p, 6, h.reach, 64, 40, { dmg: h.dmg, knock: h.knock, stun: h.stun || 0, sfx: p.comboStep === 3 ? 'finisher' : 'punch' });
    sfx('whiff', { heavy: p.comboStep === 3 }); voice(vk(p), p.comboStep === 3 ? 'big' : 'attack', { chance: p.comboStep === 3 ? 1 : 0.3 });
    if (p.comboStep === 3) p.comboTimer = 0.25;
    emit('jab', { step: p.comboStep });
    return true;
  }
  return false;
}

// ---------------------------------------------------------------- tick (locked in a move)
function tick(p, input, dt, areaWidth, hooks) {
  const sm = p.silasMove;
  if (!sm) return;
  hooks.areaWidth = areaWidth;
  sm.el += dt;
  const el = sm.el;
  if (sm.kind === 'jab') {
    const h = sm.h;
    if (p.hitbox) { glue(p); p.hitbox.live = el >= h.startup && el < h.startup + h.active; }
  } else if (sm.kind === 'rush') {
    const R = M.rush;
    if (el >= R.startup && el < R.startup + R.travel) {
      const step = (R.dist / R.travel) * dt;
      p.x = clampX(p.x + p.facing * step, areaWidth);
      p.invuln = Math.max(p.invuln, 0.06); // shoulder-first: plows through swings
      if (p.hitbox) p.hitbox.live = true;
      if (!sm.dust) { sm.dust = true; pushFx({ type: 'dust', x: p.x, y: p.y, facing: p.facing, dur: 0.4 }); }
    } else if (p.hitbox) p.hitbox.live = false;
    glue(p);
  } else if (sm.kind === 'grip') {
    const G = M.grip;
    if (sm.phase === 'reach' && el >= G.startup) {
      const t = sm.target;
      const ok = t && t.alive && !t.kd && !t.pull && Math.abs(t.y - p.y) <= G.depth + 6 && (t.x - p.x) * p.facing > -12 && (t.x - p.x) * p.facing < G.reach + 16;
      if (!ok) { sm.phase = 'whiff'; setPose(p, 'whiff'); p.attackTimer = Math.min(p.attackTimer, 0.22); }
      else if (isBossLike(t)) { // bosses: a strong hit instead of a throw
        sm.phase = 'boss';
        hit(p, t, { dmg: G.bossDmg, knock: 24, stun: G.bossStun, sfx: 'heavy' }, hooks);
        callout('VELVET GRIP!');
        emit('grip_boss');
        p.attackTimer = Math.min(p.attackTimer, 0.28);
      } else {
        sm.phase = 'hold'; sm.held = t; t.grabbed = true; sm.holdT = 0;
        holdInFront(p, t);
        sfx('silas_grab');
        emit('grip_grab');
      }
    } else if (sm.phase === 'hold') {
      sm.holdT += dt;
      const ax = input.ax || 0;
      if (Math.abs(ax) > 0.3) p.facing = ax > 0 ? 1 : -1; // aim the throw
      if (sm.held && sm.held.alive) holdInFront(p, sm.held);
      if (sm.holdT >= G.hold || !sm.held || !sm.held.alive) {
        sm.phase = 'throw'; setPose(p, 'throw');
        const e = sm.held; sm.held = null;
        if (e && e.alive) {
          e.grabbed = false;
          const dir = p.facing;
          hit(p, e, { dmg: G.dmg, knockdown: true, kdPush: 0.0001, sfx: 'heavy' }, hooks, dir);
          if (e.kd) { e.kd.t = G.flight; e.thrown = { vx: dir * G.throwSpeed, t: 0, dur: G.flight, dmg: G.splash, hit: new Set([e]), dir, by: p }; }
          sfx('silas_throw'); voice(vk(p), 'big');
          callout('VELVET GRIP!');
          emit('grip_throw');
        }
      }
    }
  } else if (sm.kind === 'handshake') {
    const H = M.handshake;
    p.invuln = Math.max(p.invuln, 0.06);
    if (sm.held && sm.held.alive && !sm.slammed) holdInFront(p, sm.held);
    if (!sm.slammed && el >= H.startup) {
      sm.slammed = true;
      setPose(p, 'hs_slam');
      const hitList = new Set();
      if (sm.held && sm.held.alive) { const e = sm.held; e.grabbed = false; hit(p, e, { dmg: H.dmg, knockdown: true, kdPush: 0.6, sfx: 'heavy' }, hooks); hitList.add(e); }
      sm.held = null;
      if (sm.boss && sm.boss.alive && !sm.boss.kd) { hit(p, sm.boss, { dmg: H.bossDmg, knockdown: true, sfx: 'heavy' }, hooks); hitList.add(sm.boss); }
      let n = 0;
      for (const e of hooks.enemies || []) {
        if (hitList.has(e) || !e.alive || e.kd || e.grabbed || (e.invuln > 0)) continue;
        if (Math.abs(e.x - p.x) > H.radius || Math.abs(e.y - p.y) > H.waveDepth) continue;
        hit(p, e, { dmg: H.waveDmg, knockdown: true, kdPush: H.kdPush, sfx: 'kick' }, hooks, e.x >= p.x ? 1 : -1);
        n++;
      }
      sfx('silas_slam');
      pushFx({ type: 'shock', x: p.x, y: p.y, reach: H.radius, dur: 0.55, facing: p.facing });
      pushFx({ type: 'crack', x: p.x + p.facing * 24, y: p.y, facing: p.facing, dur: 0.6 });
      sm.waveHits = n;
      emit('handshake_slam', { wave: n, total: hitList.size + n });
    }
  } else if (sm.kind === 'stance') {
    const L = M.lastWord;
    if (input.kickHeld && el < L.maxHold) sm.stanceEnd = Math.max(sm.stanceEnd, Math.min(L.maxHold, el + dt * 1.5));
    if (el < sm.stanceEnd) p.attackTimer = Math.max(p.attackTimer, sm.stanceEnd - el + L.recover);
    sm.active = el < sm.stanceEnd;
  } else if (sm.kind === 'counter') {
    const L = M.lastWord;
    p.invuln = Math.max(p.invuln, 0.06);
    if (!sm.done && el >= L.startup) {
      sm.done = true;
      const e = sm.target;
      if (e && e.alive && Math.abs(e.x - p.x) <= L.reach && Math.abs(e.y - p.y) <= 40) {
        p.facing = e.x >= p.x ? 1 : -1;
        hit(p, e, { dmg: L.dmg, knockdown: true, kdPush: 1.3, sfx: 'finisher' }, hooks);
        emit('lastword_counter', { boss: isBossLike(e) });
      } else emit('lastword_counter', { miss: true });
    }
  } else if (sm.kind === 'stare') {
    // pose only; the effect landed on start
  }
}

/** Last Word: an enemy hit landed on Silas during the stance → no damage, counter. */
function intercept(p, e) {
  const sm = p.silasMove;
  if (!sm || sm.kind !== 'stance' || sm.el >= sm.stanceEnd || sm.countered) return false;
  sm.countered = true;
  const L = M.lastWord;
  p.silasMove = { kind: 'counter', el: 0, target: e, done: false };
  p.attackType = 'silas'; p.attackTimer = L.counterDur; p.invuln = Math.max(p.invuln, L.counterDur);
  p.facing = e.x >= p.x ? 1 : -1;
  setPose(p, 'counter');
  if (e.hitbox) e.hitbox.hit.add(p);
  e.attackTimer = Math.min(e.attackTimer || 0, 0.05);
  sfx('silas_counter'); voice(vk(p), 'big');
  callout('LAST WORD!');
  emit('lastword_block', { by: e.isBoss ? 'boss' : 'thug' });
  return true;
}

function end(p) {
  const sm = p.silasMove, c = cds(p);
  if (sm) {
    release(p);
    if (sm.kind === 'grip') c.grip = M.grip.cooldown;
    if (sm.kind === 'stance' || sm.kind === 'counter') c.lastWord = M.lastWord.cooldown;
    if (sm.kind === 'rush') c.rush = M.rush.cooldown;
  }
  p.silasMove = null; p.silasAnim = null;
}
/** Knocked / hit out of a move: drop whatever is held, start cooldowns. */
function cancel(p) { end(p); }

function restartAnim(p) {
  if (!p.silasRestart) return;
  p.silasRestart = false;
  setAnim(p, p.animState, { key: p.animKey || 'matthew', sec: p.attackTimer, outfit: p.artOutfit }, true);
}

// ---------------------------------------------------------------- per-frame world update (after resolveHits)
/** Cooldowns, held / thrown bodies, pose restarts. onHitEnemy = main.js's hit callback. */
export function silasWorld(p, enemies, dt, areaWidth, onHitEnemy) {
  const c = cds(p);
  for (const k in c) if (c[k] > 0) c[k] -= dt;
  if (p.silasRestart && p.attackType === 'silas') restartAnim(p);
  const sm = p.silasMove;
  if (sm && sm.held && sm.held.alive) holdInFront(p, sm.held);
  if (!sm || p.attackType !== 'silas') { if (sm) end(p); }
  for (const e of enemies) {
    if (e.grabbed && !(p.silasMove && p.silasMove.held === e)) e.grabbed = false;
    const th = e.thrown;
    if (!th) continue;
    th.t += dt;
    if (!e.kd || e.kd.phase !== 'fall' || th.t > th.dur) { e.thrown = null; continue; }
    const k = 1 - th.t / th.dur;
    e.x = clampX(e.x + th.vx * dt * (0.4 + 0.6 * k), areaWidth);
    for (const o of enemies) {
      if (o === e || th.hit.has(o) || !o.alive || o.kd || o.grabbed || o.invuln > 0) continue;
      if (Math.abs(o.x - e.x) < 34 && Math.abs(o.y - e.y) < 26) {
        th.hit.add(o);
        applyHit(p, o, { dmg: th.dmg, knockdown: true, kdPush: 1.5, sfx: 'heavy', hit: new Set() }, areaWidth, onHitEnemy, th.dir);
        pushFx({ type: 'spark', x: o.x, y: o.y - 52, dur: 0.25, big: true, color: '#e8e2d6' });
        emit('grip_splash');
      }
    }
  }
}

// ---------------------------------------------------------------- Cold Stare (talk button, no NPC)
/** Returns { ok, reason?, left?, affected, immune }. */
export function coldStare(p, enemies) {
  const c = cds(p), S = M.stare;
  if (!p.alive || p.kd) return { ok: false, reason: 'busy', affected: 0, immune: 0 };
  if (c.stare > 0) return { ok: false, reason: 'cooldown', left: c.stare, affected: 0, immune: 0 };
  if (p.attackTimer > 0 && p.attackType !== null) return { ok: false, reason: 'busy', affected: 0, immune: 0 };
  c.stare = S.cooldown;
  begin(p, 'stare', 'stare', S.dur);
  let affected = 0, immune = 0;
  for (const e of enemies || []) {
    if (!e.alive || e.kd || e.runner) continue;
    if (Math.abs(e.x - p.x) > S.radius || Math.abs(e.y - p.y) > S.depth) continue;
    if (isBossLike(e)) { immune++; pushFx({ type: 'text', text: 'UNFAZED', x: e.x, y: e.y - 120, dur: 0.8, color: '#c8d2e0' }); continue; }
    const t = effStun(e, S.hesitate);
    e.stun = Math.max(e.stun || 0, t); e.hesitT = t; e.dazed = false;
    e.attackTimer = 0; e.hitbox = null; e.tauntT = 0;
    if (e.facing === (p.x > e.x ? 1 : -1)) e.x = clampX(e.x - (p.x > e.x ? 1 : -1) * 8, 99999); // a half-step back
    pushFx({ type: 'text', text: '!?', x: e.x, y: e.y - 104, dur: Math.min(1.2, t), color: '#9fd8ff' });
    affected++;
  }
  pushFx({ type: 'stare', follow: true, dur: 0.7, x: p.x, y: p.y, facing: p.facing });
  sfx('silas_stare'); voice(vk(p), 'stare');
  callout('COLD STARE');
  emit('stare', { affected, immune });
  return { ok: true, affected, immune };
}

/** HUD / tests: seconds left on each cooldown. */
export function silasCooldowns(p) { const c = cds(p); return { grip: Math.max(0, c.grip), lastWord: Math.max(0, c.lastWord), stare: Math.max(0, c.stare), rush: Math.max(0, c.rush), handshake: Math.max(0, p.specialCd || 0) }; }

registerMoveset('silas', { start, tick, end, cancel, intercept, restartAnim });
