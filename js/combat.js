import { DEPTH, getDepth } from './world.js';
import { getEnemySprite, drawSprite } from './sprites.js';
import { setAnim, gateHitbox, enemyCharKey, animFrame, animMs } from './anim.js';
import { sfx, voice } from './audio.js'; // audio: hits, whooshes, knockdowns, fighter voices
import { KITS, getKit, isArmored, artBoxToWorld, KIT_DIFF, BOSS_RESIST, SPECIAL_ACTIVE, COMBO3_ACTIVE, SPECIAL_FRAMES, KIT_FPS, PULL_FRAME } from './kits.js'; // 1.4.0 outfit kits

/**
 * Difficulty tuning. hp/dmg scale thugs, cool scales the gap between enemy attacks (lower = more
 * aggressive), wave adds thugs per encounter, boss* scale Silas, heal scales healing (0 = none).
 * Arcade = Hard numbers + no healing + game over reloads the last save.
 */
export const DIFFICULTIES = {
  easy:   { id: 'easy',   name: 'Easy',   hp: 0.7,  dmg: 0.6, cool: 1.4,  speed: 0.9,  wave: -1, bossHp: 0.75, bossDmg: 0.7, heal: 1.5, sparHits: 5, runner: 120, kdPlayer: 0.6, kdEnemy: 1.0 },
  normal: { id: 'normal', name: 'Normal', hp: 1,    dmg: 1,   cool: 1,    speed: 1,    wave: 0,  bossHp: 1,    bossDmg: 1,   heal: 1,   sparHits: 3, runner: 135, kdPlayer: 0.8, kdEnemy: 0.85 },
  hard:   { id: 'hard',   name: 'Hard',   hp: 1.35, dmg: 1.5, cool: 0.7,  speed: 1.15, wave: 1,  bossHp: 1.5,  bossDmg: 1.4, heal: 0.5, sparHits: 2, runner: 145, kdPlayer: 0.95, kdEnemy: 0.7 },
  arcade: { id: 'arcade', name: 'Arcade', hp: 1.35, dmg: 1.5, cool: 0.7,  speed: 1.15, wave: 1,  bossHp: 1.5,  bossDmg: 1.4, heal: 0,   sparHits: 2, runner: 145, arcade: true, kdPlayer: 1.0, kdEnemy: 0.6 }
};
export const DIFFICULTY_ORDER = ['easy', 'normal', 'hard', 'arcade'];
let diff = DIFFICULTIES.normal;
export function setDifficulty(id) { diff = DIFFICULTIES[id] || DIFFICULTIES.normal; return diff; }
export function getDifficulty() { return diff; }

const THUG_COLORS = ['#8e44ad', '#c0392b', '#16a085', '#d35400', '#7f8c8d'];

/** Walkable feet-Y band of the current area (main.js sets it on every area change). */
let band = DEPTH;
export function setDepthBand(b) { band = b || DEPTH; }
export function getDepthBand() { return band; }

/** Keep feet inside the walkable sidewalk/street band (no extra offsets: band == feet range). */
export function clampDepth(y, b = band) {
  return Math.max(b.min, Math.min(b.max, y));
}

export function createPlayer(x, y) {
  return {
    x, y,
    vx: 0, vy: 0,
    facing: 1,
    hp: 100, maxHp: 100,
    pose: 'idle',
    animT: 0,
    attackTimer: 0,
    attackType: null,
    invuln: 0,
    combo: 0,
    comboTimer: 0,
    hitbox: null,
    speed: 160,
    depthSpeed: 110,
    alive: true,
    // v3: animation states, sprint/stamina, knockdown, special
    animState: 'idle', animStart: 0, idleT: 0,
    comboStep: 0, sprinting: false, stamina: 100, staminaLock: false, staminaDelay: 0,
    kd: null, specialCd: 0, victoryT: 0, koT: 0, lift: 0
  };
}

export function createThug(x, y, wave) {
  const boss = false;
  return {
    x, y,
    facing: -1,
    hp: Math.round((30 + wave * 8) * diff.hp),
    maxHp: Math.round((30 + wave * 8) * diff.hp),
    dmg: Math.max(1, Math.round(10 * diff.dmg)),
    cool: diff.cool,
    pose: 'idle',
    animT: Math.random() * 10,
    attackTimer: 0,
    stun: 0,
    color: THUG_COLORS[Math.floor(Math.random() * THUG_COLORS.length)],
    speed: Math.min(150, (70 + wave * 5) * diff.speed),
    alive: true,
    aiCooldown: 0.3 + Math.random() * 0.5,
    isBoss: boss,
    scoreValue: 100
  };
}

export function createSilasFighter(x, y) {
  return {
    x, y,
    facing: -1,
    hp: Math.round(120 * diff.bossHp), maxHp: Math.round(120 * diff.bossHp),
    dmg: Math.round(16 * diff.bossDmg),
    cool: diff.cool,
    pose: 'idle',
    animT: 0,
    attackTimer: 0,
    stun: 0,
    color: '#2c3e50',
    speed: 95 * Math.min(1.1, diff.speed),
    alive: true,
    aiCooldown: 0.4,
    isBoss: true,
    scoreValue: 1000
  };
}

// ---------------- v3: knockdown / sprint / special tuning ----------------
export const SPRINT_MULT = 1.6;
export const SPECIAL_COST = 25;      // default special-meter cost of the Star Drive slot (1.4.0: per-kit cost in kits.js)
export const SPECIAL_COOLDOWN = 3;   // default seconds (per-kit cooldown in kits.js)
const COMBO3_KIT_DUR = 0.34;         // weapon finisher window (4 frames @ 12 fps = 0.333 s of art)
const JUMPKICK_DUR = 0.5;
const KD_FALL = 0.35, KD_GETUP = 0.4, KD_IFRAMES = 0.5;
const STAMINA_DRAIN = 32, STAMINA_REGEN = 28, STAMINA_UNLOCK = 25;
const clampX = (x, w) => Math.max(30, Math.min(w - 30, x));

/** Start a knockdown (fall → lie on the ground, invulnerable → get up with brief i-frames). */
export function knockDown(ent, dir) {
  if (ent.kd) return;
  ent.kd = { phase: 'fall', t: KD_FALL, dir: dir || -ent.facing || 1 };
  ent.attackTimer = 0; ent.attackType = null; ent.hitbox = null; ent.stun = 0; ent.tauntT = 0; ent.lift = 0;
  ent.dazed = false; ent.pull = null;
  ent.pose = 'hurt';
}
const groundTime = (ent, isPlayer) => (isPlayer ? diff.kdPlayer : diff.kdEnemy * (ent.isBoss ? 0.75 : 1)) || 0.8;
/** Advance a knockdown. Dead fighters stay on the ground. */
function tickKnockdown(ent, dt, areaWidth, isPlayer) {
  const k = ent.kd;
  k.t -= dt;
  ent.pose = 'hurt';
  if (k.phase === 'fall') {
    ent.x = clampX(ent.x + k.dir * 150 * (k.push || 1) * dt * Math.max(0, k.t / KD_FALL), areaWidth);
    if (k.t <= 0) { k.phase = 'ground'; k.t = groundTime(ent, isPlayer); sfx('thud', { heavy: !!ent.isBoss }); }
  } else if (k.phase === 'ground') {
    if (k.t <= 0 && ent.alive) { k.phase = 'getup'; k.t = KD_GETUP; sfx('getup'); }
  } else if (k.t <= 0) {
    ent.kd = null;
    ent.invuln = Math.max(ent.invuln || 0, KD_IFRAMES);
    ent.pose = 'idle';
    if (!isPlayer) ent.aiCooldown = Math.max(ent.aiCooldown || 0, 0.35);
  }
}
const KD_ANIM = { fall: 'knockdown_fall', ground: 'knockdown_ground', getup: 'getup' };

// >>> DLC: Silas prequel — pluggable movesets (js/silas_moves.js registers 'silas'). A player whose hooks carry
// `moveset` routes attack input through it; `animMap` renames logical states for a different character's art
// (playable Silas uses Joe's silas_boss strips); p.animKey / p.voiceKey pick the art + voice (default Matthew).
const MOVESETS = {};
export function registerMoveset(name, impl) { MOVESETS[name] = impl; }
export function getMoveset(name) { return MOVESETS[name] || null; }
const pkey = (p) => p.animKey || 'matthew';
const vkey = (p) => p.voiceKey || 'matthew';
function pickPlayerAnim(p) {
  const st = pickPlayerAnimRaw(p);
  return (p.animMap && p.animMap[st]) || st;
}
// <<< DLC: Silas prequel
function pickPlayerAnimRaw(p) {
  if (!p.alive) return 'ko';
  if (p.attackType === 'silas' && p.silasAnim && !p.kd) return p.silasAnim;
  if (p.kd) return KD_ANIM[p.kd.phase];
  if (p.pose === 'hurt') return 'hurt';
  if (p.attackType === 'special') return 'special';
  if (p.attackType === 'jumpkick') return 'jump_kick';
  if (p.attackType === 'combo') return 'combo' + Math.max(1, p.comboStep);
  if (p.attackType === 'heavy') return 'combo3';
  if (p.pose === 'walk') return p.sprinting ? 'sprint' : 'run';
  if (p.victoryT > 0) return 'victory';
  if (p.idleT >= 4) return 'idle_signature';
  return 'idle'; // not a Matthew anim state → existing sheet
}

/**
 * DLC: Silas moveset hitbox gating. The timer window in silas_moves.js stays the outer bound; when real art
 * drives the move (identity anim map: silas_player, or Joe's matthew_silas), Gentleman's Jab is live only on the
 * art's active frames inside that window. Grip / Handshake / Last Word land their hits on their own clock, and
 * Boss Rush keeps its travel window (a charge must connect along the whole run). Same rule for prequel Silas and the suit.
 */
function gateSilas(p) {
  const hb = p.hitbox, sm = p.silasMove;
  if (!hb || !hb.live || !sm || sm.kind !== 'jab') return;
  if (p.animMap && Object.keys(p.animMap).length) return; // fallback art: timer only
  const f = animFrame(pkey(p), p.animState, animMs(p), p.artOutfit);
  if (f && typeof f.active === 'boolean') hb.live = f.active;
}
function makeHitbox(p, off, y, w, h, extra) {
  const hb = { x: p.x + p.facing * off, y: p.y - y, w, h, hit: new Set(), off, oy: y, ...extra };
  if (p.facing < 0) hb.x -= w;
  return hb;
}
/** Keep a moving attack's hitbox glued to the attacker. */
function followHitbox(p) {
  const hb = p.hitbox;
  if (!hb) return;
  hb.x = p.x + p.facing * hb.off - (p.facing < 0 ? hb.w : 0);
  hb.y = p.y - hb.oy;
}

/**
 * hooks: { outfit, canSpecial(): bool, onSpecial(), onSpecialDenied(reason) } — main.js owns the meter.
 */
export function updatePlayer(p, input, dt, areaWidth, hooks = {}) {
  p.animT += dt;
  p.outfit = hooks.outfit || p.outfit;
  p.artOutfit = hooks.artOutfit || hooks.outfit || p.outfit; // DLC: the outfit whose art is drawn (Silas's Suit fallback)
  p.animMap = hooks.animMap || null;
  p.moveset = hooks.moveset || null;
  const ms = hooks.moveset ? MOVESETS[hooks.moveset] : null; // DLC: Silas prequel
  const done = () => {
    const st = pickPlayerAnim(p);
    const sec = p.kd ? (p.kd.phase === 'ground' ? 0 : p.kd.t) : p.attackTimer > 0 ? p.attackTimer : 0;
    setAnim(p, st, { key: pkey(p), sec, outfit: p.artOutfit });
  };
  if (!p.alive) {
    p.koT = Math.max(0, (p.koT || 0) - dt);
    if (p.kd && p.kd.phase === 'fall') tickKnockdown(p, dt, areaWidth, true);
    p.pose = 'hurt';
    return done();
  }
  if (p.invuln > 0) p.invuln -= dt;
  if (p.specialCd > 0) p.specialCd -= dt;
  if (p.victoryT > 0) p.victoryT -= dt;
  // stamina: drains while sprinting, refills after a short pause; empty = locked until STAMINA_UNLOCK
  if (p.sprinting) { p.stamina = Math.max(0, p.stamina - STAMINA_DRAIN * dt); p.staminaDelay = 0.5; if (p.stamina <= 0) p.staminaLock = true; }
  else if (p.staminaDelay > 0) p.staminaDelay -= dt;
  else p.stamina = Math.min(100, p.stamina + STAMINA_REGEN * dt);
  if (p.staminaLock && p.stamina >= STAMINA_UNLOCK) p.staminaLock = false;
  p.sprinting = false;
  if (p.comboTimer > 0) {
    p.comboTimer -= dt;
    if (p.comboTimer <= 0) { p.combo = 0; p.comboStep = 0; }
  }

  // Input buffer: attack/special presses made while locked (attack, hurt, get-up) fire within 0.2 s
  p.buf = p.buf || {};
  for (const k of ['punchPressed', 'kickPressed', 'heavyPressed', 'specialPressed']) {
    if (input[k]) p.buf[k] = 0.2;
    else if (p.buf[k] > 0) p.buf[k] -= dt;
  }
  const locked = !!p.kd || p.attackTimer > 0;
  if (!locked) {
    const b = {};
    for (const k in p.buf) if (p.buf[k] > 0) { b[k] = true; p.buf[k] = 0; }
    input = { ...input, ...b };
  }
  if (p.kd) { tickKnockdown(p, dt, areaWidth, true); p.idleT = 0; return done(); }

  if (p.attackTimer > 0) {
    p.attackTimer -= dt;
    if (p.attackType === 'silas' && ms) ms.tick(p, input, dt, areaWidth, hooks); // DLC: Silas prequel
    if (p.attackType === 'special') {
      const km = p.kitMove;
      if (km && km.lunge > 0 && km.el < km.lungeT) p.x = clampX(p.x + p.facing * (km.lunge / km.lungeT) * Math.min(dt, km.lungeT - km.el), areaWidth);
      if (km) km.el += dt;
      p.invuln = Math.max(p.invuln, 0.06); // the Star Drive slot still goes through attacks
    } else if (p.attackType === 'jumpkick') {
      p.x = clampX(p.x + p.facing * p.speed * 1.35 * dt, areaWidth);
      p.lift = Math.sin(Math.PI * Math.min(1, 1 - p.attackTimer / JUMPKICK_DUR)) * 30;
      followHitbox(p);
    }
    if (p.attackTimer <= 0) {
      if (p.attackType === 'jumpkick') sfx('land');
      p.pose = 'idle';
      p.attackType = null;
      p.hitbox = null;
      p.lift = 0;
      p.kitMove = null;
      if (ms) ms.end(p, hooks); // DLC: Silas prequel
    }
    p.idleT = 0;
    done();
    if (p.attackType !== 'silas') { gateHitbox(p, 'matthew', p.artOutfit); kitGate(p, hooks.outfit); }
    else gateSilas(p); // DLC: Silas's Jab also waits for the art's active frames (real art only)
    return; // lock movement during attack (SoR style)
  }

  const ax = input.ax;
  const ay = input.ay;
  const moving = Math.abs(ax) > 0.1 || Math.abs(ay) > 0.1;
  const wantSprint = !!input.sprintHeld && moving && !p.staminaLock && p.stamina > 0;
  const startAttack = (type, pose, dur) => { p.attackType = type; p.pose = pose; p.attackTimer = dur; p.idleT = 0; p.victoryT = 0; p.kitMove = null; };
  // >>> DLC: Silas prequel — Silas's moveset replaces punch / kick / heavy / special for this player
  if (ms) {
    if (ms.start(p, input, dt, areaWidth, hooks, wantSprint)) { done(); ms.restartAnim(p); return; }
    input = { ...input, punchPressed: false, kickPressed: false, heavyPressed: false, specialPressed: false };
  }
  // <<< DLC: Silas prequel

  // Special: the Star Drive slot (V / R2 / RT / touch ★) — 1.4.0: each outfit's signature move (kits.js).
  // Costs meter, has a cooldown; startup / effect / reach come from the kit + the outfit's special art.
  if (input.specialPressed) {
    const kit = getKit(hooks.outfit), ks = kit.special;
    const can = p.specialCd <= 0 && (!hooks.canSpecial || hooks.canSpecial(ks.cost));
    if (can) {
      if (Math.abs(ax) > 0.15) p.facing = ax > 0 ? 1 : -1;
      const tm = specialTiming(hooks.outfit);
      startAttack('special', 'kick', tm.dur);
      p.specialCd = ks.cooldown;
      p.combo = 0; p.comboStep = 0; p.comboTimer = 0;
      const iron = hooks.outfit === 'ironclad'; // Hell's Nightmare armor: heavier launch + impact (audio.js)
      p.kitMove = { id: kitId(hooks.outfit), kind: 'special', el: 0, lunge: ks.lunge || 0, lungeT: Math.max(0.05, tm.lastActiveEnd), fired: {}, rate: tm.rate };
      p.hitbox = makeHitbox(p, 0, 70, 50, 60, { dmg: ks.dmg, knock: ks.knock || 0, knockdown: !!ks.knockdown, special: true, kit: p.kitMove.id, kitKind: 'special',
        sfx: iron ? 'star_iron' : 'star', live: false });
      sfx('stardrive', { iron }); voice(vkey(p), 'special');
      hooks.onSpecial && hooks.onSpecial(ks.cost);
      pushFx({ type: 'callout', text: kit.move.toUpperCase() + '!', follow: true, dur: 0.8, kit: p.kitMove.id });
      done();
      setAnim(p, 'special', null, true); p.animRate = tm.rate; // re-time the 8-frame strip to the kit's startup
      gateHitbox(p, 'matthew', hooks.outfit); kitGate(p, hooks.outfit);
      return;
    }
    hooks.onSpecialDenied && hooks.onSpecialDenied(p.specialCd > 0 ? 'cooldown' : 'meter', ks.cost);
  }
  if (input.heavyPressed) {
    // Triangle / Y / C: slower haymaker with a wide hitbox and big knockback
    startAttack('heavy', 'punch', 0.42);
    p.combo = 0; p.comboStep = 0; p.comboTimer = 0;
    p.hitbox = makeHitbox(p, 22, 34, 50, 32, { dmg: 26, knock: 40, sfx: 'heavy' });
    sfx('whiff', { heavy: true }); voice(vkey(p), 'attack', { chance: 0.6 });
    done(); gateHitbox(p, 'matthew', hooks.outfit);
    return;
  }
  if (input.kickPressed && wantSprint) {
    // Running jump kick (sprint + kick): travels forward, knocks down
    startAttack('jumpkick', 'kick', JUMPKICK_DUR);
    p.combo = 0; p.comboStep = 0; p.comboTimer = 0;
    p.hitbox = makeHitbox(p, -4, 46, 56, 34, { dmg: 20, knock: 30, knockdown: true, sfx: 'finisher' });
    sfx('jump'); voice(vkey(p), 'big');
    done(); gateHitbox(p, 'matthew', hooks.outfit);
    return;
  }
  if (input.punchPressed || input.kickPressed) {
    // Combo chain: punches/kicks within 0.8 s count combo1 → combo2 → combo3 (finisher knocks down)
    const kick = !input.punchPressed;
    p.comboStep = p.comboStep >= 3 ? 1 : p.comboStep + 1;
    p.combo = p.comboStep;
    p.comboTimer = 0.8;
    const fin = p.comboStep === 3;
    if (fin) {
      // 1.4.0: the 3rd hit is the outfit's weapon finisher (combo3 art; hitbox from the art, kits.js numbers)
      const id = kitId(hooks.outfit), c3 = getKit(id).combo3;
      startAttack('combo', kick ? 'kick' : 'punch', COMBO3_KIT_DUR);
      p.kitMove = { id, kind: 'combo3', el: 0, lunge: 0, lungeT: 0, fired: {} };
      p.hitbox = makeHitbox(p, 10, 60, 44, 50, { dmg: c3.dmg, knock: c3.knock, knockdown: !!c3.knockdown, armor: c3.armor, kit: id, kitKind: 'combo3', sfx: 'finisher', live: false });
      sfx('whiff', { heavy: true }); voice(vkey(p), 'big');
      p.comboTimer = 0.25;
      done(); gateHitbox(p, 'matthew', hooks.outfit); kitGate(p, hooks.outfit);
      return;
    }
    if (kick) {
      startAttack('combo', 'kick', fin ? 0.36 : 0.32);
      p.hitbox = makeHitbox(p, 10, 28, 44, 24, { dmg: fin ? 20 : 18, knock: 26, knockdown: fin, sfx: fin ? 'finisher' : 'kick' });
    } else {
      startAttack('combo', 'punch', fin ? 0.3 : 0.22);
      p.hitbox = makeHitbox(p, 10, 34, 36, 28, { dmg: 12 + p.comboStep * 2, knock: fin ? 30 : undefined, knockdown: fin, sfx: fin ? 'finisher' : 'punch' });
    }
    sfx('whiff', { heavy: kick }); voice(vkey(p), fin ? 'big' : 'attack', { chance: fin ? 1 : 0.3 });
    if (fin) p.comboTimer = 0.25;
    done(); gateHitbox(p, 'matthew', hooks.outfit);
    return;
  }

  p.sprinting = wantSprint;
  if (wantSprint) { p.stepT = (p.stepT || 0) - dt; if (p.stepT <= 0) { p.stepT = 0.17; p.stepAlt = !p.stepAlt; sfx('step', { alt: p.stepAlt }); } }
  else p.stepT = 0;
  const sp = wantSprint ? SPRINT_MULT : 1;
  p.vx = ax * p.speed * sp;
  p.vy = ay * p.depthSpeed * (wantSprint ? 1.25 : 1);
  if (Math.abs(ax) > 0.15) p.facing = ax > 0 ? 1 : -1;
  p.x += p.vx * dt;
  p.y += p.vy * dt;
  p.x = clampX(p.x, areaWidth);
  p.y = clampDepth(p.y);
  p.pose = moving ? 'walk' : 'idle';
  if (moving) { p.idleT = 0; p.victoryT = 0; }
  else if (p.pose === 'idle' && p.victoryT <= 0) p.idleT += dt;
  done();
}


// ---------------------------------------------------------------- 1.4.0 outfit kits (kits.js data)
const kitId = (o) => { const id = o && typeof o === 'object' ? o.id : o; return KITS[id] ? id : 'polo'; };
const kitFx = [];          // short-lived visual effects for main.js (callouts, flashes, rings, sparks, cords)
const projectiles = [];    // Spiral footballs in flight
export function getKitFx() { return kitFx; }
export function getProjectiles() { return projectiles; }
export function clearKitFx() { kitFx.length = 0; projectiles.length = 0; }
export function pushFx(fx) { fx.t = 0; fx.dur = fx.dur || 0.4; kitFx.push(fx); if (kitFx.length > 40) kitFx.shift(); return fx; }

/** Special timing for an outfit: art active frames (or the kits.js table) → strip rate + window. */
const timingCache = new Map();
export function specialTiming(outfit) {
  const id = kitId(outfit), ks = getKit(id).special;
  let act = null;
  if (animFrame('matthew', 'special', 0, id)) {
    act = [];
    for (let i = 0; i < SPECIAL_FRAMES; i++) { const f = animFrame('matthew', 'special', (i + 0.5) * 1000 / KIT_FPS, id); if (f && f.active) act.push(f.index != null ? f.index : i); }
    if (!act.length) act = null;
  }
  const cached = timingCache.get(id);
  if (!act && cached) return cached;
  const a = act || SPECIAL_ACTIVE[id] || [3, 4];
  const first = Math.min(...a), last = Math.max(...a);
  const rate = (first / KIT_FPS) / ks.startup;               // >1 = faster than the art's 12 fps
  const t = { id, first, last, active: a, rate, startup: ks.startup, dur: (SPECIAL_FRAMES / KIT_FPS) / rate, lastActiveEnd: ((last + 1) / KIT_FPS) / rate, fromArt: !!act };
  if (act) timingCache.set(id, t);
  return t;
}

/** Where a kit hit can land on a foe: the drawn body (thugs ~96 px tall, Silas ~112), not just the legs. */
function kitHurt(e) { return [e.x - 16, e.y - (e.isBoss ? 112 : 96), 32, e.isBoss ? 112 : 96]; }

/**
 * Per-frame kit attack update (after gateHitbox): hitbox geometry from the art frame's own hitbox,
 * live only on active frames, hit-once reset between separate active runs (Encore: frames 3 and 5),
 * one-shot events (kit sound, Spiral throw, Star Yank pull on frame 4, FX).
 */
function kitGate(p, outfit) {
  const hb = p.hitbox, km = p.kitMove;
  if (!hb || !hb.kit || !km) return;
  const kit = getKit(hb.kit), spec = hb.kitKind === 'special', ks = spec ? kit.special : kit.combo3;
  const f = animFrame('matthew', p.animState, animMs(p), hb.kit);
  let idx, active, box = null;
  if (f) {
    idx = f.index != null ? f.index : 0; active = !!f.active;
    if (f.hitbox) box = artBoxToWorld(f, f.hitbox);
  } else { // no art: same timeline from the kits.js frame table
    idx = Math.min((spec ? SPECIAL_FRAMES : 4) - 1, Math.floor(animMs(p) * KIT_FPS / 1000));
    const a = spec ? (SPECIAL_ACTIVE[hb.kit] || [3, 4]) : COMBO3_ACTIVE;
    active = spec && hb.kit === 'gold' ? a.includes(idx) : idx >= a[0] && idx <= a[a.length - 1];
  }
  if (!box) box = hb.lastBox || { x0: 6, x1: 56, y0: -84, y1: -12 };
  hb.lastBox = box;
  let { x0, x1, y0, y1 } = box;
  const pad = ks.pad || null;
  if (pad) {
    if (pad.reach) x1 = Math.max(x1, pad.reach);
    if (pad.back != null) x0 = Math.min(x0, -pad.back);
    if (pad.reach) { y0 = Math.min(y0, -96); y1 = Math.max(y1, 0); } // area moves cover the whole body height
  }
  hb.depth = (pad && pad.depth) || ks.depth || 22;
  hb.w = Math.max(4, x1 - x0); hb.h = Math.max(4, y1 - y0);
  hb.x = p.facing > 0 ? p.x + x0 : p.x - x1;
  hb.y = p.y + y0;
  // separate active runs (gold frames 3 and 5) each hit once
  if (active) {
    if (hb.lastActive == null || idx - hb.lastActive > 1) { hb.seg = (hb.seg || 0) + 1; if (hb.seg > 1) hb.hit.clear(); }
    hb.lastActive = idx;
  }
  hb.live = active && !(spec && ks.effect === 'projectile');   // Spiral hits with the ball, not the hand
  if (spec && ks.effect === 'double' && hb.seg >= 2) { hb.dmg = ks.dmg2 || ks.dmg; hb.knockdown = !!ks.knockdown2; }
  const id = hb.kit, fwd = p.facing;
  if (active && !km.fired.sound) {
    km.fired.sound = true;
    sfx(kit.sfx, { lite: !spec });
    if (spec) {
      const hx = p.x + fwd * (x0 + x1) / 2, hy = p.y + (y0 + y1) / 2;
      if (ks.effect === 'area_stun') pushFx({ type: 'flash', x: p.x + fwd * 20, y: p.y, facing: fwd, reach: x1, dur: 0.35 });
      else if (ks.effect === 'cone') pushFx({ type: 'cone', x: p.x + fwd * 14, y: p.y, facing: fwd, reach: x1, dur: 0.35 });
      else if (id === 'ironclad') pushFx({ type: 'ring', x: p.x + fwd * 26, y: p.y, facing: fwd, reach: x1, dur: 0.45 });
      else if (id === 'mechanic' || id === 'polo') pushFx({ type: 'crack', x: p.x + fwd * x1 * 0.8, y: p.y, facing: fwd, dur: 0.5 });
      else if (ks.effect === 'sweep') pushFx({ type: 'arc', x: p.x, y: p.y + y0, facing: fwd, reach: x1, dur: 0.25, color: '#ffb36b' });
      else if (id === 'hoodie') pushFx({ type: 'dust', x: p.x + fwd * 30, y: p.y, facing: fwd, dur: 0.4 });
      else pushFx({ type: 'arc', x: p.x, y: hy, facing: fwd, reach: x1, dur: 0.22, color: id === 'gold' ? '#ffd24a' : '#fff4dc' });
      if (ks.effect === 'projectile' && !km.fired.proj) {
        km.fired.proj = true;
        const pr = ks.projectile;
        projectiles.push({ kit: id, x: hx, y: p.y, hy: (y0 + y1) / 2, vx: fwd * pr.speed, dist: 0, range: pr.range, depth: pr.depth, t: 0,
          dmg: ks.dmg, stun: ks.stun, facing: fwd, hit: new Set() });
      }
    }
  }
  if (spec && id === 'gold' && hb.seg >= 2 && !km.fired.second) { km.fired.second = true; sfx(kit.sfx, { second: true }); pushFx({ type: 'arc', x: p.x, y: p.y - 30, facing: fwd, reach: x1, dur: 0.22, color: '#ffd24a' }); }
  if (spec && ks.effect === 'pull' && idx >= PULL_FRAME && !km.fired.pull) { km.fired.pull = true; km.pullPending = true; }
}

/** Foe effect strengths for the current difficulty (boss resists part of it). */
export function effStun(e, t) { return t * (KIT_DIFF[diff.id] || KIT_DIFF.normal).stun * (e.isBoss ? BOSS_RESIST.stun : 1); }
/** Movement / attack-clock multiplier while slowed (Hot Plate). */
export function slowMul(e) { return e && e.slowT > 0 ? e.slowMul || 1 : 1; }

/**
 * One player hit on one foe: damage (kit armor bonus), knockdown / stun / slow / knockback, audio,
 * KO, then onHitEnemy. Shared by melee hitboxes, the Spiral and Star Yank.
 */
export function applyHit(player, e, hb, areaWidth, onHitEnemy, dir = player.facing) {
  const kit = hb.kit ? getKit(hb.kit) : null;
  const ks = kit ? (hb.kitKind === 'special' ? kit.special : kit.combo3) : null;
  let dmg = hb.dmg;
  const armor = hb.armor || (ks && ks.armor);
  if (armor && isArmored(e)) { dmg = Math.round(dmg * armor); pushFx({ type: 'text', text: 'ARMOR BREAK', x: e.x, y: e.y - (e.isBoss ? 120 : 104), dur: 0.7, color: '#ffb020' }); }
  e.hp -= dmg;
  if (hb.knockdown) {
    knockDown(e, dir);
    if (e.kd && ks && ks.kdPush) e.kd.push = ks.kdPush;
    if (e.kd && hb.kdPush) e.kd.push = hb.kdPush; // DLC: Silas moves
  } else {
    const kitStun = ks && hb.kitKind === 'special' && ks.stun ? effStun(e, ks.stun) : 0;
    e.stun = Math.max(hb.knock ? 0.4 : 0.25, kitStun, hb.stun ? effStun(e, hb.stun) : 0); // hb.stun: DLC Silas moves
    if (kitStun >= 0.3) { e.dazed = true; e.attackTimer = 0; e.hitbox = null; e.tauntT = 0; }
    if (!hb.noPush) e.x = Math.max(30, Math.min(areaWidth - 30, e.x + dir * (hb.knock != null && hb.knock !== 0 ? hb.knock : (kit ? 6 : 18))));
  }
  if (ks && hb.kitKind === 'special' && ks.slow) {
    const d = (KIT_DIFF[diff.id] || KIT_DIFF.normal).slow;
    e.slowT = ks.slow.t * d;
    e.slowMul = e.isBoss ? 1 - (1 - ks.slow.mul) * BOSS_RESIST.slow : ks.slow.mul;
  }
  if (kit) pushFx({ type: 'spark', x: e.x, y: e.y - 52, dur: 0.22, big: hb.kitKind === 'special', color: hb.kit === 'beacon' ? '#7dffb2' : hb.kit === 'ironclad' ? '#ffb020' : '#fff4a8', seg: hb.seg || 1 });
  if (e.hp <= 0) {
    e.alive = false;
    e.pose = 'hurt';
    e.koT = e.kd ? 1.3 : 0.7; // body stays briefly for the ko / defeat / caught anim
    e.pull = null;
  }
  { // audio: impact by attack type, then the foe's own voice (hurt / ko / defeat / caught)
    const pan = Math.max(-0.6, Math.min(0.6, (e.x - player.x) / 300)), vk = enemyCharKey(e);
    sfx(hb.sfx || 'punch', { pan });
    if (e.alive) voice(vk, 'hurt', { chance: 0.6, id: e, pan });
    else {
      voice(vk, deadAnim(e) === 'caught' ? 'caught' : deadAnim(e), { pan });
      if (e.runner) sfx('caught');
      else if (!e.kd) sfx('thud', { delay: 0.4, pan }); // KO'd body hits the pavement (knockdowns thud on landing)
    }
  }
  onHitEnemy && onHitEnemy(e, dmg); // after the KO flag so score sees it
}

/** Star Yank in progress: slide the foe to Matthew; true while it's being reeled in. */
export function tickPull(e, dt) {
  const pl = e.pull;
  if (!pl) return false;
  pl.t += dt;
  const k = Math.min(1, pl.t / pl.dur), ease = 1 - (1 - k) * (1 - k);
  e.x = pl.x0 + (pl.x1 - pl.x0) * ease;
  e.y = pl.y0 + (pl.y1 - pl.y0) * ease;
  e.pose = 'hurt';
  if (k >= 1) e.pull = null;
  return !!e.pull;
}

/**
 * Kit systems that need the foe list + dt (call after resolveHits): Spiral flight / impact,
 * Star Yank target pick + pull, FX clocks. onHitEnemy = the same callback resolveHits gets.
 */
export function updateKits(player, enemies, dt, areaWidth = Infinity, onHitEnemy) {
  for (const fx of kitFx) fx.t += dt;
  for (let i = kitFx.length - 1; i >= 0; i--) if (kitFx[i].t >= kitFx[i].dur) kitFx.splice(i, 1);
  // Spiral
  for (let i = projectiles.length - 1; i >= 0; i--) {
    const pr = projectiles[i];
    const step = pr.vx * dt;
    pr.x += step; pr.dist += Math.abs(step); pr.t += dt;
    let done = pr.dist >= pr.range || pr.x < 0 || pr.x > areaWidth;
    if (!done) {
      for (const e of enemies) {
        if (!e.alive || e.kd || pr.hit.has(e) || Math.abs(pr.y - e.y) >= pr.depth) continue;
        const [hx, hy, hw, hh] = kitHurt(e);
        const by = pr.y + pr.hy;
        if (pr.x + 8 > hx && pr.x - 8 < hx + hw && by + 6 > hy && by - 6 < hy + hh) {
          pr.hit.add(e);
          if (e.invuln > 0) { sfx('block'); done = true; break; }
          applyHit(player, e, { dmg: pr.dmg, knock: 8, kit: pr.kit, kitKind: 'special', sfx: 'kit_varsity_hit', hit: pr.hit }, areaWidth, onHitEnemy, pr.facing);
          pushFx({ type: 'pop', x: pr.x, y: by, dur: 0.3 });
          done = true; break;   // stuns one target
        }
      }
    }
    if (done) { if (pr.dist >= pr.range) pushFx({ type: 'pop', x: pr.x, y: pr.y + pr.hy, dur: 0.2, small: true }); projectiles.splice(i, 1); }
  }
  // Star Yank (frame 4): nearest foe in front within the line's range is reeled in
  const km = player.kitMove;
  if (km && km.pullPending) {
    km.pullPending = false;
    const ks = getKit(km.id).special, pl = ks.pull;
    let best = null, bd = Infinity;
    for (const e of enemies) {
      if (!e.alive || e.kd || e.pull || e.invuln > 0) continue;
      const along = (e.x - player.x) * player.facing, dy = Math.abs(e.y - player.y);
      if (along < -10 || along > pl.range || dy > pl.depth) continue;
      const d = Math.hypot(along, dy);
      if (d < bd) { bd = d; best = e; }
    }
    const hand = { x: player.x + player.facing * 30, y: player.y - 62 };
    if (best) {
      const e = best;
      let x1 = player.x + player.facing * pl.to;
      if (e.isBoss) x1 = e.x + (x1 - e.x) * BOSS_RESIST.pull;   // Silas only gets dragged halfway
      if ((x1 - e.x) * player.facing > 0) x1 = e.x;             // never push a foe that's already close
      e.pull = { t: 0, dur: pl.time, x0: e.x, y0: e.y, x1: Math.max(30, Math.min(areaWidth - 30, x1)), y1: e.isBoss ? e.y : e.y + (player.y - e.y) * 0.7 };
      const hb = player.hitbox && player.hitbox.kit === km.id ? player.hitbox : null;
      if (!hb || !hb.hit.has(e)) {
        if (hb) hb.hit.add(e);
        applyHit(player, e, { dmg: ks.dmg, knock: 0, noPush: true, kit: km.id, kitKind: 'special', sfx: 'star' }, areaWidth, onHitEnemy, -player.facing);
      } else { e.stun = Math.max(e.stun || 0, effStun(e, ks.stun)); e.dazed = true; }
      e.stun = Math.max(e.stun || 0, pl.time + 0.05);
      pushFx({ type: 'cord', target: e, x: hand.x, y: hand.y, dur: pl.time + 0.12 });
      km.pullTarget = e;
    } else pushFx({ type: 'cord', x: hand.x, y: hand.y, tx: hand.x + player.facing * pl.range * 0.75, ty: hand.y + 6, dur: 0.2 });
  }
}

function deadAnim(e) { return e.isBoss ? 'defeat' : e.runner ? 'caught' : 'ko'; }

export function updateEnemy(e, player, dt, areaWidth = Infinity) {
  if (e.slowT > 0) e.slowT -= dt;
  const slow = slowMul(e);  // Hot Plate: everything (walk, swing, anim) runs at slowMul
  e.animT += dt * slow;
  const key = enemyCharKey(e);
  if (!e.alive) {
    if (e.koT > 0) e.koT -= dt;
    if (e.kd && e.kd.phase === 'fall') { tickKnockdown(e, dt, areaWidth, false); setAnim(e, 'knockdown_fall', { key, sec: e.kd.t }); }
    else setAnim(e, deadAnim(e), { key, sec: Math.max(0.3, e.koT) });
    return;
  }
  if (e.invuln > 0) e.invuln -= dt;
  if (e.kd) { tickKnockdown(e, dt, areaWidth, false); setAnim(e, e.kd ? KD_ANIM[e.kd.phase] : 'idle', e.kd && e.kd.phase !== 'ground' ? { key, sec: e.kd.t } : null); return; }
  if (e.pull) { tickPull(e, dt); setAnim(e, 'hurt'); return; } // Star Yank
  if (e.stun > 0) {
    e.stun -= dt;
    e.pose = 'hurt';
    setAnim(e, 'hurt', { key, sec: e.stun });
    if (e.stun <= 0) e.dazed = false;
    return;
  }
  if (e.attackTimer > 0) {
    e.attackTimer -= dt * slow;
    if (e.attackTimer <= 0) {
      e.pose = 'idle';
      e.hitbox = null;
      if (e.tauntNext) { e.tauntNext = false; e.tauntT = 1.1; voice(key, 'taunt', { delay: 0.15 }); } // Silas taunts between attack patterns
    }
    gateHitbox(e, key);
    return;
  }
  if (e.tauntT > 0) {
    e.tauntT -= dt;
    e.pose = 'idle';
    e.facing = player.x > e.x ? 1 : -1;
    setAnim(e, 'taunt');
    return;
  }

  e.aiCooldown -= dt * slow;
  const dx = player.x - e.x;
  const dy = player.y - e.y;
  const dist = Math.hypot(dx, dy);
  e.facing = dx > 0 ? 1 : -1;

  if (player.kd) {
    // don't pile on a downed Matthew: hold position
    e.pose = 'idle';
    setAnim(e, e.isBoss ? 'taunt' : 'idle');
  } else if (dist < 42 && Math.abs(dy) < 18) {
    if (e.aiCooldown <= 0) {
      e.pose = 'punch';
      e.attackTimer = 0.28;
      e.aiCooldown = (0.7 + Math.random() * 0.6) * (e.cool || 1);
      const dmg = e.dmg || (e.isBoss ? 16 : 10);
      e.hitbox = { x: e.x + e.facing * 8, y: e.y - 32, w: 32, h: 26, dmg, hit: new Set() };
      if (e.isBoss) {
        // 3-hit pattern: attack1, attack2, then a heavy attack3 that knocks Matthew down → taunt
        const step = (e.patIdx || 0) % 3;
        e.patIdx = (e.patIdx || 0) + 1;
        e.nextAnim = 'boss_attack' + (step + 1);
        if (step === 2) {
          e.attackTimer = 0.5;
          e.hitbox = { x: e.x + e.facing * 6, y: e.y - 38, w: 46, h: 34, dmg: Math.round(dmg * 1.3), knockdown: true, hit: new Set() };
          e.tauntNext = true;
          e.aiCooldown = Math.max(e.aiCooldown, 0.5);
        }
      } else {
        // thugs alternate attackA / attackB
        e.altAtk = !e.altAtk;
        e.nextAnim = e.altAtk ? 'attackA' : 'attackB';
        if (!e.altAtk) e.attackTimer = 0.32;
        if (e.miniBoss) { // DLC: Silas prequel bosses (thug art, boss rules): every 3rd swing is a heavy knockdown
          e.patIdx = (e.patIdx || 0) + 1;
          if (e.patIdx % 3 === 0) {
            e.attackTimer = 0.42;
            e.hitbox = { x: e.x + e.facing * 6, y: e.y - 38, w: 44, h: 34, dmg: Math.round(dmg * 1.3), knockdown: true, hit: new Set() };
            e.aiCooldown = Math.max(e.aiCooldown, 0.6);
          }
        }
      }
      if (e.facing < 0) e.hitbox.x -= e.hitbox.w;
      setAnim(e, e.nextAnim, { key, sec: e.attackTimer }, true); // restart even when the same attack repeats
      sfx('whiff', { quiet: !e.isBoss, heavy: e.isBoss && e.nextAnim === 'boss_attack3' });
      voice(key, e.isBoss ? (e.nextAnim === 'boss_attack3' ? 'big' : 'attack') : 'grunt', { chance: e.isBoss ? 0.75 : 0.3, id: e });
      gateHitbox(e, key);
    } else {
      e.pose = 'idle';
      setAnim(e, 'idle');
    }
  } else {
    e.pose = 'chase';
    setAnim(e, 'walk'); // thugs/Silas walk in; the snatcher's 'run' is set in main.js updateRunner
    const sp = e.speed * dt * slow;
    if (dist > 1) {
      e.x += (dx / dist) * sp;
      e.y += (dy / dist) * sp * 0.7;
    }
    e.y = clampDepth(e.y);
  }
  e.x = Math.max(30, Math.min(areaWidth - 30, e.x));
}

export function resolveHits(player, enemies, onHitEnemy, onHitPlayer, areaWidth = Infinity) {
  // Player hits enemies (hitbox.live === false = between 'active' frames)
  const hb = player.hitbox;
  if (hb && hb.live !== false) {
    for (const e of enemies) {
      if (!e.alive || hb.hit.has(e) || e.kd || e.pull) continue;
      // kit weapons hit the drawn body (kitHurt) within their own depth band; fists keep the old box
      const [bx, by, bw, bh] = hb.kit ? kitHurt(e) : [e.x - 14, e.y - 60, 28, 56];
      const near = overlap(hb, bx, by, bw, bh) && Math.abs(player.y - e.y) < (hb.depth || 22);
      if (e.invuln > 0) {
        // getting-up i-frames: the blow glances off (once per swing)
        if (near) { hb.hit.add(e); sfx('block'); }
        continue;
      }
      if (near) {
        hb.hit.add(e);
        applyHit(player, e, hb, areaWidth, onHitEnemy);
      }
    }
  }
  // Enemy hits player
  if (player.attackType === 'special' && player.invuln > 0) {
    // Star Drive dashes through attacks: they clank off
    for (const e of enemies) {
      if (e.alive && e.hitbox && e.hitbox.live !== false && !e.hitbox.hit.has(player) &&
          overlap(e.hitbox, player.x - 14, player.y - 60, 28, 56) && Math.abs(player.y - e.y) < 22) { e.hitbox.hit.add(player); sfx('block'); }
    }
  }
  if (player.invuln > 0 || player.kd || !player.alive) return;
  for (const e of enemies) {
    if (!e.alive || !e.hitbox || e.hitbox.live === false) continue;
    if (e.hitbox.hit.has(player)) continue;
    if (overlap(e.hitbox, player.x - 14, player.y - 60, 28, 56) && Math.abs(player.y - e.y) < 22) {
      e.hitbox.hit.add(player);
      // DLC: Silas prequel — Last Word counter stance: no damage, the moveset answers the blow
      const msx = player.moveset ? MOVESETS[player.moveset] : null;
      if (msx && msx.intercept && msx.intercept(player, e)) continue;
      player.hp -= e.hitbox.dmg;
      player.victoryT = 0; player.idleT = 0; player.lift = 0;
      if (e.hitbox.knockdown) {
        knockDown(player, e.facing);
      } else {
        player.invuln = 0.6;
        player.pose = 'hurt';
        player.attackTimer = 0.2;
        player.attackType = null;
        player.hitbox = null;
        player.kitMove = null;
        player.x = Math.max(30, Math.min(areaWidth - 30, player.x + e.facing * 20));
      }
      if (player.attackType === null && player.silasMove) { const m = MOVESETS[player.moveset]; if (m) m.cancel(player); } // DLC: hit out of a Silas move
      { const st = player.kd ? 'knockdown_fall' : 'hurt'; setAnim(player, (player.animMap && player.animMap[st]) || st, { key: pkey(player), sec: player.kd ? KD_FALL : 0.2, outfit: player.artOutfit || player.outfit }); }
      sfx(e.isBoss ? 'heavy' : 'punch', { taken: true });
      if (player.hp > 0) voice(vkey(player), 'hurt', { cd: 0.35 });
      onHitPlayer && onHitPlayer(e.hitbox.dmg, !!e.hitbox.knockdown);
      if (player.hp <= 0) {
        player.hp = 0;
        player.alive = false;
        player.koT = 1.2; // main.js waits for the KO pose before respawning
        setAnim(player, (player.animMap && player.animMap.ko) || 'ko', { key: pkey(player), sec: 1.2, outfit: player.artOutfit || player.outfit });
        voice(vkey(player), 'ko');
      }
      if (player.kd || !player.alive) return;
    }
  }
}

function overlap(hb, x, y, w, h) {
  return hb.x < x + w && hb.x + hb.w > x && hb.y < y + h && hb.y + hb.h > y;
}

export function drawEnemy(ctx, e, cameraX) {
  if (!e.alive && e.hp <= 0) {
    // brief corpse fade handled by filtering
  }
  const pose = e.pose === 'chase' ? 'walk' : e.pose;
  const spr = getEnemySprite(pose, e.color, e.animT, e.isBoss);
  const sx = e.x - cameraX;
  if (e.invulnFlash) ctx.globalAlpha = 0.5;
  drawSprite(ctx, spr, sx, e.y, e.facing);
  ctx.globalAlpha = 1;
  // HP pip
  if (e.hp < e.maxHp && e.alive) {
    ctx.fillStyle = '#2a2a30';
    ctx.fillRect(sx - 16, e.y - 80, 32, 4);
    ctx.fillStyle = e.isBoss ? '#e74c3c' : '#2ecc71';
    ctx.fillRect(sx - 16, e.y - 80, 32 * (e.hp / e.maxHp), 4);
  }
}

export function spawnWave(area, count, waveNum, preferX) {
  const enemies = [];
  for (let i = 0; i < count; i++) {
    const side = i % 2 === 0 ? 1 : -1;
    const x = (preferX || area.width / 2) + side * (140 + i * 50) + (Math.random() * 40 - 20);
    const b = getDepth(area);
    const y = b.min + 8 + Math.random() * (b.max - b.min - 16);
    enemies.push(createThug(Math.max(60, Math.min(area.width - 60, x)), y, waveNum));
  }
  return enemies;
}
