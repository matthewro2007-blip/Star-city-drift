import { DEPTH, getDepth } from './world.js';
import { getEnemySprite, drawSprite } from './sprites.js';

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
    alive: true
  };
}

export function createThug(x, y, wave) {
  const boss = false;
  return {
    x, y,
    facing: -1,
    hp: 30 + wave * 8,
    maxHp: 30 + wave * 8,
    pose: 'idle',
    animT: Math.random() * 10,
    attackTimer: 0,
    stun: 0,
    color: THUG_COLORS[Math.floor(Math.random() * THUG_COLORS.length)],
    speed: 70 + wave * 5,
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
    hp: 120, maxHp: 120,
    pose: 'idle',
    animT: 0,
    attackTimer: 0,
    stun: 0,
    color: '#2c3e50',
    speed: 95,
    alive: true,
    aiCooldown: 0.4,
    isBoss: true,
    scoreValue: 1000
  };
}

export function updatePlayer(p, input, dt, areaWidth) {
  if (!p.alive) return;
  p.animT += dt;
  if (p.invuln > 0) p.invuln -= dt;
  if (p.comboTimer > 0) {
    p.comboTimer -= dt;
    if (p.comboTimer <= 0) p.combo = 0;
  }

  if (p.attackTimer > 0) {
    p.attackTimer -= dt;
    if (p.attackTimer <= 0) {
      p.pose = 'idle';
      p.attackType = null;
      p.hitbox = null;
    }
    return; // lock movement during attack (SoR style)
  }

  // Attacks
  if (input.heavyPressed) {
    // Triangle / Y / C: slower haymaker with a wide hitbox and big knockback
    p.attackType = 'heavy';
    p.pose = 'punch';
    p.attackTimer = 0.42;
    p.combo = 0;
    p.comboTimer = 0;
    p.hitbox = { x: p.x + p.facing * 22, y: p.y - 34, w: 50, h: 32, dmg: 26, knock: 40, hit: new Set() };
    if (p.facing < 0) p.hitbox.x -= p.hitbox.w;
    return;
  }
  if (input.punchPressed) {
    p.attackType = p.combo >= 2 ? 'punch' : 'punch';
    p.pose = 'punch';
    p.attackTimer = 0.22;
    p.combo = (p.combo + 1) % 4;
    p.comboTimer = 0.8;
    p.hitbox = { x: p.x + p.facing * 10, y: p.y - 34, w: 36, h: 28, dmg: 12 + p.combo * 2, hit: new Set() };
    if (p.facing < 0) p.hitbox.x -= p.hitbox.w;
    return;
  }
  if (input.kickPressed) {
    p.pose = 'kick';
    p.attackType = 'kick';
    p.attackTimer = 0.32;
    p.combo = (p.combo + 1) % 4;
    p.comboTimer = 0.8;
    p.hitbox = { x: p.x + p.facing * 10, y: p.y - 28, w: 44, h: 24, dmg: 18, knock: 26, hit: new Set() };
    if (p.facing < 0) p.hitbox.x -= p.hitbox.w;
    return;
  }

  const ax = input.ax;
  const ay = input.ay;
  p.vx = ax * p.speed;
  p.vy = ay * p.depthSpeed;
  if (Math.abs(ax) > 0.15) p.facing = ax > 0 ? 1 : -1;
  p.x += p.vx * dt;
  p.y += p.vy * dt;
  p.x = Math.max(30, Math.min(areaWidth - 30, p.x));
  p.y = clampDepth(p.y);
  p.pose = (Math.abs(ax) > 0.1 || Math.abs(ay) > 0.1) ? 'walk' : 'idle';
}

export function updateEnemy(e, player, dt, areaWidth = Infinity) {
  if (!e.alive) return;
  e.animT += dt;
  if (e.stun > 0) {
    e.stun -= dt;
    e.pose = 'hurt';
    return;
  }
  if (e.attackTimer > 0) {
    e.attackTimer -= dt;
    if (e.attackTimer <= 0) {
      e.pose = 'idle';
      e.hitbox = null;
    }
    return;
  }

  e.aiCooldown -= dt;
  const dx = player.x - e.x;
  const dy = player.y - e.y;
  const dist = Math.hypot(dx, dy);
  e.facing = dx > 0 ? 1 : -1;

  if (dist < 42 && Math.abs(dy) < 18) {
    if (e.aiCooldown <= 0) {
      e.pose = 'punch';
      e.attackTimer = 0.28;
      e.aiCooldown = 0.7 + Math.random() * 0.6;
      e.hitbox = { x: e.x + e.facing * 8, y: e.y - 32, w: 32, h: 26, dmg: e.isBoss ? 16 : 10, hit: new Set() };
      if (e.facing < 0) e.hitbox.x -= e.hitbox.w;
    } else {
      e.pose = 'idle';
    }
  } else {
    e.pose = 'chase';
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
  // Player hits enemies
  if (player.hitbox) {
    for (const e of enemies) {
      if (!e.alive || player.hitbox.hit.has(e)) continue;
      if (overlap(player.hitbox, e.x - 14, e.y - 60, 28, 56) && Math.abs(player.y - e.y) < 22) {
        player.hitbox.hit.add(e);
        e.hp -= player.hitbox.dmg;
        e.stun = player.hitbox.knock ? 0.4 : 0.25;
        e.x = Math.max(30, Math.min(areaWidth - 30, e.x + player.facing * (player.hitbox.knock || 18)));
        if (e.hp <= 0) {
          e.alive = false;
          e.pose = 'hurt';
        }
        onHitEnemy && onHitEnemy(e, player.hitbox.dmg); // after the KO flag so score sees it
      }
    }
  }
  // Enemy hits player
  if (player.invuln > 0) return;
  for (const e of enemies) {
    if (!e.alive || !e.hitbox) continue;
    if (e.hitbox.hit.has(player)) continue;
    if (overlap(e.hitbox, player.x - 14, player.y - 60, 28, 56) && Math.abs(player.y - e.y) < 22) {
      e.hitbox.hit.add(player);
      player.hp -= e.hitbox.dmg;
      player.invuln = 0.6;
      player.pose = 'hurt';
      player.attackTimer = 0.2;
      player.attackType = null;
      player.hitbox = null;
      player.x = Math.max(30, Math.min(areaWidth - 30, player.x + e.facing * 20));
      onHitPlayer && onHitPlayer(e.hitbox.dmg);
      if (player.hp <= 0) {
        player.hp = 0;
        player.alive = false;
      }
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
