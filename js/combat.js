import { DEPTH, getDepth } from './world.js';
import { getEnemySprite, drawSprite } from './sprites.js';
import { setAnim, gateHitbox, enemyCharKey } from './anim.js';
import { sfx, voice } from './audio.js'; // audio: hits, whooshes, knockdowns, fighter voices

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
export const SPECIAL_COST = 25;      // special-meter cost of Star Drive
export const SPECIAL_COOLDOWN = 3;   // seconds
const SPECIAL_DUR = 0.45, SPECIAL_SPEED = 470, SPECIAL_DMG = 22;
const JUMPKICK_DUR = 0.5;
const KD_FALL = 0.35, KD_GETUP = 0.4, KD_IFRAMES = 0.5;
const STAMINA_DRAIN = 32, STAMINA_REGEN = 28, STAMINA_UNLOCK = 25;
const clampX = (x, w) => Math.max(30, Math.min(w - 30, x));

/** Start a knockdown (fall → lie on the ground, invulnerable → get up with brief i-frames). */
export function knockDown(ent, dir) {
  if (ent.kd) return;
  ent.kd = { phase: 'fall', t: KD_FALL, dir: dir || -ent.facing || 1 };
  ent.attackTimer = 0; ent.attackType = null; ent.hitbox = null; ent.stun = 0; ent.tauntT = 0; ent.lift = 0;
  ent.pose = 'hurt';
}
const groundTime = (ent, isPlayer) => (isPlayer ? diff.kdPlayer : diff.kdEnemy * (ent.isBoss ? 0.75 : 1)) || 0.8;
/** Advance a knockdown. Dead fighters stay on the ground. */
function tickKnockdown(ent, dt, areaWidth, isPlayer) {
  const k = ent.kd;
  k.t -= dt;
  ent.pose = 'hurt';
  if (k.phase === 'fall') {
    ent.x = clampX(ent.x + k.dir * 150 * dt * Math.max(0, k.t / KD_FALL), areaWidth);
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

function pickPlayerAnim(p) {
  if (!p.alive) return 'ko';
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
  const done = () => {
    const st = pickPlayerAnim(p);
    const sec = p.kd ? (p.kd.phase === 'ground' ? 0 : p.kd.t) : p.attackTimer > 0 ? p.attackTimer : 0;
    setAnim(p, st, { key: 'matthew', sec, outfit: hooks.outfit });
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
    if (p.attackType === 'special') {
      p.x = clampX(p.x + p.facing * SPECIAL_SPEED * dt, areaWidth);
      p.invuln = Math.max(p.invuln, 0.06); // dash goes through attacks
      followHitbox(p);
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
    }
    p.idleT = 0;
    done();
    gateHitbox(p, 'matthew', hooks.outfit);
    return; // lock movement during attack (SoR style)
  }

  const ax = input.ax;
  const ay = input.ay;
  const moving = Math.abs(ax) > 0.1 || Math.abs(ay) > 0.1;
  const wantSprint = !!input.sprintHeld && moving && !p.staminaLock && p.stamina > 0;
  const startAttack = (type, pose, dur) => { p.attackType = type; p.pose = pose; p.attackTimer = dur; p.idleT = 0; p.victoryT = 0; };

  // Special: 'Star Drive' dash (V / R2 / RT / touch ★) — costs meter, has a cooldown, knocks down
  if (input.specialPressed) {
    const can = p.specialCd <= 0 && (!hooks.canSpecial || hooks.canSpecial());
    if (can) {
      if (Math.abs(ax) > 0.15) p.facing = ax > 0 ? 1 : -1;
      startAttack('special', 'kick', SPECIAL_DUR);
      p.specialCd = SPECIAL_COOLDOWN;
      p.combo = 0; p.comboStep = 0; p.comboTimer = 0;
      const iron = hooks.outfit === 'ironclad'; // Hell's Nightmare armor: heavier Star Drive launch + impact (audio.js)
      p.hitbox = makeHitbox(p, -6, 44, 56, 40, { dmg: SPECIAL_DMG, knock: 30, knockdown: true, special: true, sfx: iron ? 'star_iron' : 'star' });
      sfx('stardrive', { iron }); voice('matthew', 'special');
      hooks.onSpecial && hooks.onSpecial();
      done(); gateHitbox(p, 'matthew', hooks.outfit);
      return;
    }
    hooks.onSpecialDenied && hooks.onSpecialDenied(p.specialCd > 0 ? 'cooldown' : 'meter');
  }
  if (input.heavyPressed) {
    // Triangle / Y / C: slower haymaker with a wide hitbox and big knockback
    startAttack('heavy', 'punch', 0.42);
    p.combo = 0; p.comboStep = 0; p.comboTimer = 0;
    p.hitbox = makeHitbox(p, 22, 34, 50, 32, { dmg: 26, knock: 40, sfx: 'heavy' });
    sfx('whiff', { heavy: true }); voice('matthew', 'attack', { chance: 0.6 });
    done(); gateHitbox(p, 'matthew', hooks.outfit);
    return;
  }
  if (input.kickPressed && wantSprint) {
    // Running jump kick (sprint + kick): travels forward, knocks down
    startAttack('jumpkick', 'kick', JUMPKICK_DUR);
    p.combo = 0; p.comboStep = 0; p.comboTimer = 0;
    p.hitbox = makeHitbox(p, -4, 46, 56, 34, { dmg: 20, knock: 30, knockdown: true, sfx: 'finisher' });
    sfx('jump'); voice('matthew', 'big');
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
    if (kick) {
      startAttack('combo', 'kick', fin ? 0.36 : 0.32);
      p.hitbox = makeHitbox(p, 10, 28, 44, 24, { dmg: fin ? 20 : 18, knock: 26, knockdown: fin, sfx: fin ? 'finisher' : 'kick' });
    } else {
      startAttack('combo', 'punch', fin ? 0.3 : 0.22);
      p.hitbox = makeHitbox(p, 10, 34, 36, 28, { dmg: 12 + p.comboStep * 2, knock: fin ? 30 : undefined, knockdown: fin, sfx: fin ? 'finisher' : 'punch' });
    }
    sfx('whiff', { heavy: kick }); voice('matthew', fin ? 'big' : 'attack', { chance: fin ? 1 : 0.3 });
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

function deadAnim(e) { return e.isBoss ? 'defeat' : e.runner ? 'caught' : 'ko'; }

export function updateEnemy(e, player, dt, areaWidth = Infinity) {
  e.animT += dt;
  const key = enemyCharKey(e);
  if (!e.alive) {
    if (e.koT > 0) e.koT -= dt;
    if (e.kd && e.kd.phase === 'fall') { tickKnockdown(e, dt, areaWidth, false); setAnim(e, 'knockdown_fall', { key, sec: e.kd.t }); }
    else setAnim(e, deadAnim(e), { key, sec: Math.max(0.3, e.koT) });
    return;
  }
  if (e.invuln > 0) e.invuln -= dt;
  if (e.kd) { tickKnockdown(e, dt, areaWidth, false); setAnim(e, e.kd ? KD_ANIM[e.kd.phase] : 'idle', e.kd && e.kd.phase !== 'ground' ? { key, sec: e.kd.t } : null); return; }
  if (e.stun > 0) {
    e.stun -= dt;
    e.pose = 'hurt';
    setAnim(e, 'hurt', { key, sec: e.stun });
    return;
  }
  if (e.attackTimer > 0) {
    e.attackTimer -= dt;
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

  e.aiCooldown -= dt;
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
    const sp = e.speed * dt;
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
      if (!e.alive || hb.hit.has(e) || e.kd) continue;
      if (e.invuln > 0) {
        // getting-up i-frames: the blow glances off (once per swing)
        if (overlap(hb, e.x - 14, e.y - 60, 28, 56) && Math.abs(player.y - e.y) < 22) { hb.hit.add(e); sfx('block'); }
        continue;
      }
      if (overlap(hb, e.x - 14, e.y - 60, 28, 56) && Math.abs(player.y - e.y) < 22) {
        hb.hit.add(e);
        e.hp -= hb.dmg;
        if (hb.knockdown) knockDown(e, player.facing);
        else {
          e.stun = hb.knock ? 0.4 : 0.25;
          e.x = Math.max(30, Math.min(areaWidth - 30, e.x + player.facing * (hb.knock || 18)));
        }
        if (e.hp <= 0) {
          e.alive = false;
          e.pose = 'hurt';
          e.koT = e.kd ? 1.3 : 0.7; // body stays briefly for the ko / defeat / caught anim
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
        onHitEnemy && onHitEnemy(e, hb.dmg); // after the KO flag so score sees it
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
        player.x = Math.max(30, Math.min(areaWidth - 30, player.x + e.facing * 20));
      }
      setAnim(player, player.kd ? 'knockdown_fall' : 'hurt', { key: 'matthew', sec: player.kd ? KD_FALL : 0.2, outfit: player.outfit });
      sfx(e.isBoss ? 'heavy' : 'punch', { taken: true });
      if (player.hp > 0) voice('matthew', 'hurt', { cd: 0.35 });
      onHitPlayer && onHitPlayer(e.hitbox.dmg, !!e.hitbox.knockdown);
      if (player.hp <= 0) {
        player.hp = 0;
        player.alive = false;
        player.koT = 1.2; // main.js waits for the KO pose before respawning
        setAnim(player, 'ko', { key: 'matthew', sec: 1.2, outfit: player.outfit });
        voice('matthew', 'ko');
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
