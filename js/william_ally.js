/**
 * 2.0.3 anim pass: William Burks fights next to Matthew (single player) when a fight breaks out where he's standing
 * (his own quests: The Boys' Booth, the High Score ambush, ... or any street fight in his area). Uses Joe's William strips:
 * combo1 (7f@18, hits f1 + f4) -> combo2 (5f@16) -> hop_kick (6f@14, knockdown), dash (5f@16, hit f2, +60 px gap closer),
 * magazine (7f@14, rolled-up magazine swat f3-4, big knock) and extra_life (6f@10, NO hit frames: a revive / buff that
 * patches Matthew up once per fight when he's low). Foes keep targeting Matthew; William can't be hurt (support NPC).
 * Kept out of main.js on purpose (Kody's co-op patch rebases there): main.js only calls updateWilliamAlly / williamAlly.
 */
import { setAnim, animMs, animTiming, animFrame, gateHitbox, strideRate } from './anim.js';
import { applyHit } from './combat.js';
import { sfx } from './audio.js';

const KEY = 'william';
let ally = null;
export function williamAlly() { return ally; }
export function resetWilliamAlly() { ally = null; }

const sec = (st, d) => { const t = animTiming(KEY, st); return t.dur > 0 ? t.dur / 1000 : d; };
// fist boxes in world px (same scale as Matthew's makeHitbox), damage a notch under Matthew's
const MOVES = {
  combo1: { off: 10, y: 34, w: 38, h: 28, dmg: 9, knock: 14 },
  combo2: { off: 10, y: 36, w: 40, h: 30, dmg: 10, knock: 16 },
  hop_kick: { off: 6, y: 40, w: 50, h: 34, dmg: 14, knock: 30, knockdown: true },
  dash: { off: 4, y: 40, w: 46, h: 34, dmg: 10, knock: 24, lunge: 60 },
  magazine: { off: 10, y: 44, w: 48, h: 34, dmg: 13, knock: 40 }
};

function start(a, st) {
  const m = MOVES[st];
  a.move = st; a.timer = sec(st, 0.4); a.el = 0; a.x0 = a.x;
  a.hitbox = m ? { x: 0, y: 0, w: m.w, h: m.h, dmg: m.dmg, knock: m.knock, knockdown: !!m.knockdown, sfx: m.knockdown ? 'finisher' : 'punch', hit: new Set(), live: false } : null;
  setAnim(a, st, null, true);
  if (m) sfx('whiff', { quiet: true });
}

/**
 * npc: William's NPC def when he's in this area (else null); fight: true while hostiles are up;
 * heal(n): main.js adds n HP to Matthew. Returns the ally (or null when he's just an NPC again).
 */
export function updateWilliamAlly(player, enemies, dt, areaWidth, onHitEnemy, npc, fight, heal) {
  if (!npc || !fight) {
    if (ally && !ally.move) ally = null; // finish the swing, then back to standing at his spot
    if (!ally) return null;
  }
  if (!ally) ally = { x: npc.x, y: player.y, facing: player.x > npc.x ? 1 : -1, animT: 0, animState: '', move: null, timer: 0, chain: 0, cd: 0.4, lifeUsed: false };
  const a = ally;
  a.animT += dt;
  if (a.cd > 0) a.cd -= dt;
  const foes = enemies.filter((e) => e.alive && !e.kd && !e.noLock && !e.runner);
  if (a.move) {
    a.timer -= dt; a.el += dt;
    const m = MOVES[a.move];
    if (m && m.lunge) { const tm = animTiming(KEY, a.move); const T = Math.max(0.05, (tm.dur || 300) / 1000); a.x = Math.max(30, Math.min(areaWidth - 30, a.x0 + a.facing * m.lunge * Math.min(1, a.el / T))); }
    if (a.hitbox) {
      const hb = a.hitbox;
      hb.x = a.x + a.facing * m.off - (a.facing < 0 ? m.w : 0); hb.y = a.y - m.y;
      gateHitbox(a, KEY); // live on William's active frames only; combo1's two runs (f1, f4) each hit once
      if (hb.live) for (const e of foes) {
        if (hb.hit.has(e) || e.pull || e.invuln > 0) continue;
        if (hb.x < e.x + 14 && hb.x + hb.w > e.x - 14 && hb.y < e.y - 4 && hb.y + hb.h > e.y - 60 && Math.abs(a.y - e.y) < 22) {
          hb.hit.add(e);
          applyHit(a, e, hb, areaWidth, onHitEnemy, a.facing);
        }
      }
    }
    if (a.move === 'extra_life' && !a.healed && animMs(a) >= 300) { a.healed = true; heal && heal(30); sfx('getup'); }
    if (a.timer <= 0) { a.move = null; a.hitbox = null; a.cd = a.chain ? 0.12 : 0.45; }
    return a;
  }
  // Extra Life: once per fight, when Matthew is down to a third of his HP (or on the floor)
  if (!a.lifeUsed && player.alive && player.hp <= player.maxHp * 0.33 && Math.abs(player.x - a.x) < 260) {
    a.lifeUsed = true; a.healed = false; a.facing = player.x > a.x ? 1 : -1; start(a, 'extra_life'); return a;
  }
  // prefer a foe Matthew isn't already on (so the two don't stack on one thug)
  let best = null, bd = Infinity;
  for (const e of foes) { const d = Math.hypot(e.x - a.x, (e.y - a.y) * 1.5) + (Math.abs(e.x - player.x) < 60 && foes.length > 1 ? 120 : 0); if (d < bd) { bd = d; best = e; } }
  if (!best) { setAnim(a, 'idle_personality'); a.chain = 0; return a; }
  const dx = best.x - a.x, dy = best.y - a.y;
  a.facing = dx > 0 ? 1 : -1;
  if (a.cd <= 0 && Math.abs(dy) < 16 && Math.abs(dx) < 46 && Math.abs(dx) > 20) {
    // string: combo1 -> combo2 -> hop_kick (knockdown); every 4th opener is the magazine swat
    a.chain = (a.chain + 1) % 3;
    const st = a.chain === 1 ? ((a.opens = (a.opens || 0) + 1) % 4 === 0 ? 'magazine' : 'combo1') : a.chain === 2 ? 'combo2' : 'hop_kick';
    if (st === 'magazine') a.chain = 0;
    start(a, st); return a;
  }
  if (a.cd <= 0 && Math.abs(dy) < 14 && Math.abs(dx) > 90 && Math.abs(dx) < 150) { a.chain = 0; start(a, 'dash'); return a; }
  // walk in to the foe's far side from Matthew (flank), so the two friends never stand in one spot
  let side = Math.sign(a.x - best.x) || 1;
  if (Math.sign(player.x - best.x) === side && Math.abs(player.x - best.x) < 70) side = -side;
  const tx = best.x + side * 36, ty = best.y, mx = tx - a.x, my = ty - a.y, d = Math.hypot(mx, my), sp = 120 * dt;
  if (d > 6) {
    a.x += (mx / d) * Math.min(sp, d); a.y += (my / d) * Math.min(sp * 0.7, d);
    a.x = Math.max(30, Math.min(areaWidth - 30, a.x));
    setAnim(a, 'walk'); strideRate(a, 'william', 120, 1.2); // 2.1.1
  } else setAnim(a, 'idle_personality');
  return a;
}
