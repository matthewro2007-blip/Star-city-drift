/**
 * Star City Drift 1.4.0 — outfit kits (game-logic lane).
 *
 * Every outfit carries its own signature weapon. Two moves use it:
 *   - combo3  : the weapon finisher (3rd hit of the punch/kick chain)
 *   - special : the outfit's signature move in the Star Drive slot (V / RT / R2 / touch ★)
 * Art (Joe): per-outfit idle_signature / combo3 / special states in anims.json, HUD icons via
 * Sprites.getWeaponIcon(). Hitboxes come from the art (getAnimFrame(...).hitbox, cell-relative),
 * converted to world px with the same scale main.js draws Matthew at; `pad` only widens the far
 * edge / depth for area moves (Flash Pop, Whip Crack, Star Flare, Breach).
 *
 * Special fields: dmg, startup (s to the first active frame; the 8-frame strip is re-timed to hit it),
 * lunge (px travelled during the move), effect, stun / slow / knock / knockdown / kdPush, armor (dmg
 * multiplier vs armored foes: Silas + grey thugs), cost (% meter), cooldown (s). Range (reported by
 * kitRange) = lunge + forward edge of the art hitbox (+ pad), or the projectile / pull distance.
 */
export const PLAYER_DRAW_SCALE = 1.3;                 // main.js PLAYER_SCALE (Matthew draw scale)
export const ART_K = (84 * PLAYER_DRAW_SCALE) / 192;  // art px (192-row cell) → world px
export const BASE_SPECIAL = { dmg: 22, cost: 25, cooldown: 3 }; // the pre-1.4 Star Drive

/** Effect strength by difficulty (enemy hp/dmg already scale in combat.js DIFFICULTIES). */
export const KIT_DIFF = {
  easy:   { stun: 1.25, slow: 1.2,  dmg: 1.0 },
  normal: { stun: 1.0,  slow: 1.0,  dmg: 1.0 },
  hard:   { stun: 0.85, slow: 0.9,  dmg: 1.0 },
  arcade: { stun: 0.8,  slow: 0.85, dmg: 1.0 }
};
/** Silas shrugs off part of every control effect (but never all of it). */
export const BOSS_RESIST = { stun: 0.5, slow: 0.6, pull: 0.5 };

export const KITS = {
  polo: {
    weapon: 'Hardcover Book', move: 'Detention', ability: 'Overhead book slam — short stun.', sfx: 'kit_polo',
    special: { dmg: 20, startup: 0.2, lunge: 34, effect: 'stun', stun: 0.9, knock: 12, cost: 25, cooldown: 3 },
    combo3: { dmg: 20, knock: 28, knockdown: true }
  },
  photo: {
    weapon: 'Strap Camera', move: 'Flash Pop', ability: 'Camera flash stuns everyone in front — low damage.', sfx: 'kit_photo',
    special: { dmg: 8, startup: 0.15, lunge: 0, effect: 'area_stun', stun: 1.6, knock: 0, pad: { reach: 112, back: 6, depth: 36 }, cost: 25, cooldown: 3.5 },
    combo3: { dmg: 18, knock: 26, knockdown: true }
  },
  hoodie: {
    weapon: 'Skateboard', move: 'Kickflip', ability: 'Forward low board sweep that knocks down.', sfx: 'kit_hoodie',
    special: { dmg: 20, startup: 0.15, lunge: 96, effect: 'knockdown', knockdown: true, depth: 26, cost: 25, cooldown: 3 },
    combo3: { dmg: 20, knock: 26, knockdown: true }
  },
  jacket: {
    weapon: 'Bike Chain', move: 'Whip Crack', ability: 'Long-reach horizontal chain sweep.', sfx: 'kit_jacket',
    special: { dmg: 18, startup: 0.15, lunge: 0, effect: 'sweep', knock: 34, stun: 0.5, pad: { reach: 108, depth: 28 }, cost: 25, cooldown: 3 },
    combo3: { dmg: 19, knock: 30, knockdown: true }
  },
  street: {
    weapon: 'Baseball Bat', move: 'Line Drive', ability: 'Big bat swing — heavy knockback.', sfx: 'kit_street',
    special: { dmg: 26, startup: 0.22, lunge: 22, effect: 'knockdown', knockdown: true, kdPush: 3, cost: 25, cooldown: 3 },
    combo3: { dmg: 22, knock: 34, knockdown: true }
  },
  varsity: {
    weapon: 'Football', move: 'Spiral', ability: 'Thrown spiral that stuns the first foe it hits.', sfx: 'kit_varsity',
    special: { dmg: 16, startup: 0.2, lunge: 0, effect: 'projectile', stun: 1.4, projectile: { speed: 520, range: 300, depth: 26 }, cost: 25, cooldown: 3 },
    combo3: { dmg: 19, knock: 28, knockdown: true }
  },
  mechanic: {
    weapon: 'Pipe Wrench', move: 'Torque', ability: 'Overhead wrench smash — extra damage to armored foes.', sfx: 'kit_mechanic',
    special: { dmg: 22, startup: 0.22, lunge: 20, effect: 'knockdown', knockdown: true, armor: 1.6, cost: 25, cooldown: 3 },
    combo3: { dmg: 20, knock: 28, knockdown: true, armor: 1.3 }
  },
  diner: {
    weapon: 'Frying Pan', move: 'Hot Plate', ability: 'Pan smack plus a sizzling slow.', sfx: 'kit_diner',
    special: { dmg: 18, startup: 0.15, lunge: 24, effect: 'slow', stun: 0.35, knock: 20, slow: { t: 3, mul: 0.5 }, cost: 25, cooldown: 3 },
    combo3: { dmg: 20, knock: 28, knockdown: true }
  },
  gold: {
    weapon: 'Gold Chain', move: 'Encore', ability: 'Chain spin that hits twice, high then low.', sfx: 'kit_gold',
    special: { dmg: 12, dmg2: 14, startup: 0.2, lunge: 0, effect: 'double', hits: 2, stun: 0.45, knockdown2: true, pad: { depth: 26 }, cost: 25, cooldown: 3 },
    combo3: { dmg: 19, knock: 28, knockdown: true }
  },
  webslinger: {
    weapon: 'Star-Line', move: 'Star Yank', ability: 'Star-weighted line yanks the nearest foe in.', sfx: 'kit_webslinger',
    special: { dmg: 12, startup: 0.2, lunge: 0, effect: 'pull', stun: 0.9, pull: { range: 280, depth: 48, to: 36, time: 0.18 }, cost: 25, cooldown: 3 },
    combo3: { dmg: 18, knock: 26, knockdown: true }
  },
  beacon: {
    weapon: 'The Ring', move: 'Star Flare', ability: 'Short emerald cone burst that knocks down.', sfx: 'kit_beacon',
    special: { dmg: 20, startup: 0.15, lunge: 14, effect: 'cone', knockdown: true, pad: { reach: 96, depth: 30 }, cost: 25, cooldown: 3 },
    combo3: { dmg: 20, knock: 28, knockdown: true }
  },
  ironclad: {
    weapon: 'Breach Gauntlets', move: 'Breach', ability: 'Planted-palm shockwave — heavy knockback, slower start.', sfx: 'kit_ironclad',
    special: { dmg: 26, startup: 0.27, lunge: 0, effect: 'knockdown', knockdown: true, kdPush: 3.2, pad: { reach: 84, depth: 30 }, cost: 25, cooldown: 3 },
    combo3: { dmg: 22, knock: 32, knockdown: true }
  },
  // 1.5.0 (DLC: Silas prequel reward): Silas's Suit. Matthew in this outfit fights with Silas Boone's own
  // moveset (js/silas_moves.js, numbers in SILAS_MOVES below); the kit entry keeps the HUD / picker / tables
  // working. The special slot is Iron Handshake (grab-and-slam shockwave).
  silas: {
    weapon: 'Iron Gauntlet', move: 'Iron Handshake', ability: 'Grab-and-slam: a ground shockwave knocks down everyone nearby.', sfx: 'silas_slam',
    special: { dmg: 28, startup: 0.3, lunge: 0, effect: 'shockwave', knockdown: true, pad: { reach: 150, depth: 40 }, cost: 25, cooldown: 3 },
    combo3: { dmg: 16, knock: 52 }
  }
};
export const KIT_ORDER = Object.keys(KITS);

/** Art timing (12 fps strips): special active frames per outfit, combo3 active on 1-2 for all. Used only
 *  when the art isn't loaded (the live frames' own `active` flags win); gold hits on 3 and 5. */
export const SPECIAL_ACTIVE = {
  polo: [3, 4], street: [3, 4], varsity: [3, 4], mechanic: [3, 4], webslinger: [3, 4], ironclad: [3, 4],
  photo: [2, 3], hoodie: [2, 3], jacket: [2, 3], diner: [2, 3], beacon: [2, 3], gold: [3, 5], silas: [0, 1, 4, 5] /* Joe's Iron Handshake: grab 0-1, slam + shockwave 4-5 */
};
export const COMBO3_ACTIVE = [1, 2];
export const SPECIAL_FRAMES = 8, COMBO3_FRAMES = 4, KIT_FPS = 12;
export const PULL_FRAME = 4; // Star Yank reels the line in on frame 4

/** Kit for an outfit id (unknown → polo). */
export function getKit(outfitId) { return KITS[outfitId] || KITS.polo; }

/** Armored foes for Torque: Silas and the grey (heavy) thugs. */
export function isArmored(e) { return !!(e && (e.isBoss || e.color === '#7f8c8d')); }

/**
 * Art hitbox (cell-relative {x,y,w,h}) → world offsets from the actor (facing right):
 * {x0, x1} along facing, {y0, y1} relative to the feet (negative = up).
 */
export function artBoxToWorld(f, hb) {
  const ax = f.anchorX != null ? f.anchorX : f.sw / 2;
  const feet = f.feetRow != null ? f.feetRow : f.sh - 3;
  return { x0: (hb.x - ax) * ART_K, x1: (hb.x + hb.w - ax) * ART_K, y0: (hb.y - feet) * ART_K, y1: (hb.y + hb.h - feet) * ART_K };
}

/** Human-readable table row (README / tests / report). */
export function kitRow(id) {
  const k = KITS[id], s = k.special;
  const eff = { stun: `stun ${s.stun}s`, area_stun: `area stun ${s.stun}s`, knockdown: 'knockdown', sweep: `knockback ${s.knock}px + ${s.stun}s stagger`,
    projectile: `projectile, stun ${s.stun}s (1 target)`, slow: s.slow ? `slow ${Math.round((1 - s.slow.mul) * 100)}% for ${s.slow.t}s` : '', double: '2 hits (2nd knocks down)',
    pull: s.pull ? `pull from ${s.pull.range}px + stun ${s.stun}s` : '', cone: 'cone, knockdown', shockwave: `grab-slam + shockwave ${s.pad && s.pad.reach}px, knockdown` }[s.effect];
  return { id, weapon: k.weapon, move: k.move, dmg: s.dmg2 ? `${s.dmg}+${s.dmg2}` : String(s.dmg), startup: s.startup, effect: eff + (s.kdPush ? `, heavy knockback x${s.kdPush}` : '') + (s.armor ? `, x${s.armor} vs armored` : ''),
    cost: s.cost, cooldown: s.cooldown, combo3: k.combo3.dmg };
}

/**
 * 1.5.0 DLC: Silas Boone's moveset (playable Silas in the prequel + Matthew in Silas's Suit). One table,
 * one implementation (js/silas_moves.js). Times in seconds, distances in world px, stun/hesitate scale with
 * KIT_DIFF[difficulty].stun like the kits. "Boss-like" foes (main-game Silas, DLC bosses) are immune to
 * Cold Stare and take a strong hit instead of being thrown.
 */
export const SILAS_MOVES = {
  jab: { name: "Gentleman's Jab", window: 0.8, hits: [
    { dmg: 10, startup: 0.08, active: 0.1, dur: 0.22, reach: 42, knock: 8 },
    { dmg: 11, startup: 0.08, active: 0.1, dur: 0.22, reach: 42, knock: 8 },
    { dmg: 16, startup: 0.12, active: 0.1, dur: 0.34, reach: 48, knock: 52, stun: 0.45 } // pushes back
  ] },
  grip: { name: 'Velvet Grip', startup: 0.12, reach: 52, depth: 22, hold: 0.3, throwDur: 0.3, whiff: 0.35, cooldown: 0.6,
    dmg: 14, splash: 12, throwSpeed: 430, flight: 0.42, bossDmg: 24, bossStun: 0.5 },
  handshake: { name: 'Iron Handshake', cost: 25, cooldown: 3, startup: 0.3, dur: 0.62, grabReach: 58, depth: 24,
    dmg: 28, bossDmg: 20, radius: 150, waveDepth: 40, waveDmg: 14, kdPush: 1.6 },
  lastWord: { name: 'Last Word', window: 0.6, maxHold: 1.0, recover: 0.25, cooldown: 1.0, startup: 0.06, counterDur: 0.34, dmg: 24, reach: 90 },
  stare: { name: 'Cold Stare', cooldown: 8, radius: 240, depth: 70, hesitate: 1.0, dur: 0.45 },
  rush: { name: 'Boss Rush', startup: 0.1, dist: 160, travel: 0.36, dur: 0.5, dmg: 16, depth: 24, stamina: 20, cooldown: 1.0 }
};
/** Rows for README / report / tests. */
export function silasMoveRows() {
  const M = SILAS_MOVES;
  return [
    { move: M.jab.name, input: 'punch', dmg: M.jab.hits.map((h) => h.dmg).join('/'), startup: M.jab.hits.map((h) => h.startup).join('/'), cooldown: `chain window ${M.jab.window}s`, effect: `3-hit combo; hit 3 pushes back ${M.jab.hits[2].knock}px + ${M.jab.hits[2].stun}s stagger` },
    { move: M.grip.name, input: 'heavy near a foe', dmg: `${M.grip.dmg} (+${M.grip.splash} to each foe hit by the body)`, startup: M.grip.startup, cooldown: M.grip.cooldown, effect: `grab within ${M.grip.reach}px, hold ${M.grip.hold}s (aim), throw ${Math.round(M.grip.throwSpeed * M.grip.flight)}px+; bosses: ${M.grip.bossDmg} dmg hit, no throw` },
    { move: M.handshake.name, input: 'Star Drive (special)', dmg: `${M.handshake.dmg} grabbed / ${M.handshake.waveDmg} wave`, startup: M.handshake.startup, cooldown: `${M.handshake.cooldown}s, ${M.handshake.cost}% meter`, effect: `grab-slam; shockwave ${M.handshake.radius}px knocks down everyone nearby` },
    { move: M.lastWord.name, input: 'kick (hold)', dmg: M.lastWord.dmg, startup: M.lastWord.startup, cooldown: M.lastWord.cooldown, effect: `counter stance ${M.lastWord.window}s (hold up to ${M.lastWord.maxHold}s): a hit taken does 0 dmg and is answered with a knockdown strike` },
    { move: M.stare.name, input: 'talk (no NPC in range)', dmg: 0, startup: 0, cooldown: M.stare.cooldown, effect: `thugs within ${M.stare.radius}px hesitate ${M.stare.hesitate}s; bosses immune` },
    { move: M.rush.name, input: 'punch while sprinting', dmg: M.rush.dmg, startup: M.rush.startup, cooldown: M.rush.cooldown, effect: `${M.rush.dist}px shoulder charge through a line of foes, knockdown each; ${M.rush.stamina} stamina` }
  ];
}
