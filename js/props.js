/**
 * Scene props layer (bench / trash can), receding street, ambient traffic.
 * Pure draw + cosmetic sim: no collision, no game state. world.js owns the per-area data
 * (SCENE_PROPS / SCENE_STREETS / SCENE_TRAFFIC) and calls drawSceneLayer() right after the
 * plate, so props share the golden-hour grade and sit behind every character.
 * Sprites: assets/props/*.png (Joe) — RGBA, hard alpha, bottom row = ground, centred.
 */

const PROP_FILES = ['bench', 'trashcan', 'sedan_side', 'sedan_rear'];
const IMG = {};

/** Preload prop PNGs; a missing/broken file is skipped (that prop just isn't drawn). */
export function loadProps() {
  return Promise.all(PROP_FILES.map((id) => new Promise((resolve) => {
    const img = new Image();
    img.onload = () => { IMG[id] = img; resolve(); };
    img.onerror = () => { console.warn(`[props] skipped missing prop: assets/props/${id}.png`); resolve(); };
    img.src = `assets/props/${id}.png`;
  })));
}

/** Soft elliptical contact shadow centred at (cx, y). */
function softShadow(ctx, cx, y, w, alpha = 0.38) {
  const rx = w * 0.5, ry = Math.max(2.5, w * 0.075);
  ctx.save();
  ctx.translate(cx, y);
  ctx.scale(1, ry / rx);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
  g.addColorStop(0, `rgba(12,8,6,${alpha})`);
  g.addColorStop(0.6, `rgba(12,8,6,${alpha * 0.55})`);
  g.addColorStop(1, 'rgba(12,8,6,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, rx, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** Bottom-centre anchored sprite, nearest-neighbour, optional mirror. */
function blit(ctx, img, cx, bottomY, scale = 1, flip = false, alpha = 1) {
  const w = Math.max(1, Math.round(img.width * scale));
  const h = Math.max(1, Math.round(img.height * scale));
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  if (alpha < 1) ctx.globalAlpha *= alpha;
  const x = Math.round(cx - w / 2), y = Math.round(bottomY - h);
  if (flip) {
    ctx.translate(x + w, y);
    ctx.scale(-1, 1);
    ctx.drawImage(img, 0, 0, w, h);
  } else {
    ctx.drawImage(img, x, y, w, h);
  }
  ctx.restore();
}

// ---------------------------------------------------------------------------
// Receding street (concept centrepiece): a cross street cut through the sidewalk,
// converging on a vanishing point at the foot of Mill Mountain under the star.
// Geometry in screen space: base edge on the main road's far curb, apex at the VP.
// Perspective param z >= 1: y = vpY + (baseY - vpY) / z, x = vpX + (X0 - vpX) / z.
// ---------------------------------------------------------------------------

function persp(st, ox, x0, z) {
  return [ox + st.vpX + (x0 - st.vpX) / z, st.vpY + (st.baseY - st.vpY) / z];
}

/** Quad between two base x's (world/plate x at z=1) over [z1, z2]. */
function roadQuad(ctx, st, ox, xa, xb, z1, z2) {
  const p1 = persp(st, ox, xa, z1), p2 = persp(st, ox, xb, z1);
  const p3 = persp(st, ox, xb, z2), p4 = persp(st, ox, xa, z2);
  ctx.beginPath();
  ctx.moveTo(p1[0], p1[1]); ctx.lineTo(p2[0], p2[1]);
  ctx.lineTo(p3[0], p3[1]); ctx.lineTo(p4[0], p4[1]);
  ctx.closePath();
}

const Z_FAR = 14;

function drawRecedingStreet(ctx, st, ox, W, lamps) {
  const L = st.mouthX - st.mouthW / 2, R = st.mouthX + st.mouthW / 2;
  const walk = st.mouthW * 0.2;              // flanking sidewalks
  if (ox + R + walk < -20 || ox + L - walk > W + 20) return;
  const zSide = (st.baseY - st.vpY) / (st.sidewalkTop - st.vpY); // z where the main sidewalk's back edge is

  ctx.save();
  // Flanking sidewalks run from the main sidewalk's back edge toward the VP.
  ctx.fillStyle = 'rgb(104,102,112)';
  roadQuad(ctx, st, ox, L - walk, L, zSide, Z_FAR); ctx.fill();
  roadQuad(ctx, st, ox, R, R + walk, zSide, Z_FAR); ctx.fill();

  // Asphalt: matches the plate's road near, warms toward the sunset haze far away.
  const g = ctx.createLinearGradient(0, st.baseY, 0, st.vpY);
  g.addColorStop(0, 'rgb(58,58,66)');
  g.addColorStop(0.45, 'rgb(62,60,68)');
  g.addColorStop(0.8, 'rgb(96,76,72)');
  g.addColorStop(1, 'rgb(150,100,76)');
  ctx.fillStyle = g;
  roadQuad(ctx, st, ox, L, R, 1, Z_FAR); ctx.fill();

  // Curbs (thin light edge lines along the road edges)
  ctx.strokeStyle = 'rgba(176,170,170,0.85)';
  ctx.lineWidth = 1;
  for (const x0 of [L, R]) {
    const a = persp(st, ox, x0, zSide), b = persp(st, ox, x0, Z_FAR);
    ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
  }

  // Crosswalk across the mouth (where the main sidewalk crosses the side street) — kept
  // to the middle of the sidewalk band and muted so it doesn't out-shout the plate.
  const zAt = (y) => (st.baseY - st.vpY) / (y - st.vpY);
  const zA = zAt(st.baseY - 8), zB = zAt(st.sidewalkTop + 10);
  ctx.fillStyle = 'rgba(214,206,196,0.55)';
  const stripes = 7;
  const sw = st.mouthW / (stripes * 2 - 1);
  for (let i = 0; i < stripes; i++) {
    const xa = L + i * 2 * sw;
    roadQuad(ctx, st, ox, xa + 1, xa + sw, zA, zB); ctx.fill();
  }

  // Centre line: perspective dashes (constant road length, shrinking on screen)
  ctx.fillStyle = 'rgb(212,175,55)';
  const cx = st.mouthX, hw = Math.max(2, st.mouthW * 0.012);
  for (let d = zSide + 0.1; d < Z_FAR; d += 0.9) {
    roadQuad(ctx, st, ox, cx - hw, cx + hw, d, d + 0.45); ctx.fill();
  }

  // Street lamps receding along both sidewalks (glows are added by world.js after the grade)
  const lampH = st.lampH || 150;
  for (let z = zSide + 0.7; z < 9; z += 1.5) {
    for (const x0 of [L - walk * 0.55, R + walk * 0.55]) {
      const [lx, ly] = persp(st, ox, x0, z);
      const h = lampH / z;
      ctx.fillStyle = 'rgba(34,30,38,0.95)';
      ctx.fillRect(Math.round(lx), Math.round(ly - h), Math.max(1, Math.round(4 / z)), Math.round(h));
      ctx.fillStyle = 'rgba(255,214,140,0.95)';
      const r = Math.max(1, 7 / z);
      ctx.beginPath(); ctx.arc(lx + 1, ly - h, r, 0, Math.PI * 2); ctx.fill();
      if (lamps) lamps.push({ x: lx + 1, y: ly - h, s: Math.max(0.18, 1.1 / z) });
    }
  }

  // Golden sunset sheen down the road + haze where it meets the mountain
  ctx.globalCompositeOperation = 'screen';
  const vx = ox + st.vpX;
  const sh = ctx.createRadialGradient(vx, st.vpY, 2, vx, st.vpY + 20, st.mouthW * 0.55);
  sh.addColorStop(0, 'rgba(255,200,120,0.55)');
  sh.addColorStop(0.35, 'rgba(255,150,80,0.18)');
  sh.addColorStop(1, 'rgba(255,120,60,0)');
  ctx.fillStyle = sh;
  roadQuad(ctx, st, ox, L - walk, R + walk, zSide, Z_FAR); ctx.fill();
  ctx.restore();
}

// ---------------------------------------------------------------------------
// Ambient traffic: one cosmetic sedan at a time on the far road lane.
// ---------------------------------------------------------------------------

const traffic = { areaId: null, timer: 0, car: null };
const rand = (a, b) => a + Math.random() * (b - a);

function resetTraffic(areaId) {
  traffic.areaId = areaId;
  traffic.car = null;
  traffic.timer = rand(3, 7); // first pass soon after arriving, then every 12–25 s
}

function updateTraffic(cfg, st, cameraX, W, dt) {
  if (!cfg || !IMG.sedan_side) { traffic.car = null; return; }
  const c = traffic.car;
  if (!c) {
    traffic.timer -= dt;
    if (traffic.timer > 0) return;
    const dir = Math.random() < 0.6 ? -1 : 1;
    const wide = IMG.sedan_side.width;
    traffic.car = {
      mode: 'side', dir,
      x: dir > 0 ? cameraX - wide : cameraX + W + wide,
      turn: !!(st && IMG.sedan_rear && Math.random() < (cfg.turnChance ?? 0.5)),
      z: 1, alpha: 1
    };
    return;
  }
  if (c.mode === 'side') {
    const prev = c.x;
    c.x += c.dir * cfg.speed * dt;
    const turnX = st ? st.mouthX + st.mouthW * 0.22 : null;
    if (c.turn && turnX !== null && (prev - turnX) * (c.x - turnX) <= 0) {
      // Swing into the side street and drive off toward Mill Mountain.
      c.mode = 'rear';
      c.x = turnX;
      c.z0 = (st.baseY - st.vpY) / (cfg.laneY - st.vpY);
      c.z = c.z0;
      return;
    }
    if ((c.dir > 0 && c.x - cameraX > W + 260) || (c.dir < 0 && c.x - cameraX < -260)) done();
  } else {
    c.z += (cfg.recedeRate ?? 0.8) * dt * Math.min(2, c.z / c.z0);
    c.alpha = c.z < 4 ? 1 : Math.max(0, 1 - (c.z - 4) / 4);
    if (c.alpha <= 0) done();
  }
}

function done() {
  traffic.car = null;
  traffic.timer = rand(12, 25);
}

function drawTraffic(ctx, cfg, st, cameraX) {
  const c = traffic.car;
  if (!c || !cfg) return;
  if (c.mode === 'side') {
    const img = IMG.sedan_side;
    const sx = c.x - cameraX;
    softShadow(ctx, sx, cfg.laneY - 1, img.width * 0.95, 0.42);
    blit(ctx, img, sx, cfg.laneY, 1, c.dir < 0);
  } else {
    const img = IMG.sedan_rear;
    const s = c.z0 / c.z;
    const [px, py] = persp(st, -cameraX, c.x, c.z);
    softShadow(ctx, px, py - 1, img.width * s * 0.95, 0.4 * c.alpha);
    blit(ctx, img, px, py, s, false, c.alpha);
  }
}

// ---------------------------------------------------------------------------

/**
 * Draw the scene layer for an area (call after the plate, before characters).
 * @param {object} o { areaId, plateKey, cameraX, W, dt, props[], street, traffic, groundY }
 * @returns {{lamps: {x:number,y:number,s:number}[]}} screen-space lamp heads for glow
 */
export function drawSceneLayer(ctx, o) {
  const { areaId, plateKey, cameraX, W } = o;
  if (traffic.areaId !== areaId) resetTraffic(areaId);
  const st = o.street && o.street.plate === plateKey ? o.street : null;
  const tr = o.traffic && o.traffic.plate === plateKey ? o.traffic : null;

  const lamps = [];
  if (st) drawRecedingStreet(ctx, st, -cameraX, W, lamps);

  for (const p of o.props || []) {
    if (p.plate && p.plate !== plateKey) continue;
    const img = IMG[p.img];
    if (!img) continue;
    const s = p.scale || 1;
    const sx = p.x - cameraX;
    if (sx < -img.width * s || sx > W + img.width * s) continue;
    const by = (p.y ?? o.groundY);
    softShadow(ctx, sx, by - 1, img.width * s * 0.9, 0.36);
    blit(ctx, img, sx, by, s, !!p.flip);
  }

  updateTraffic(tr, st, cameraX, W, Math.max(0, o.dt || 0));
  drawTraffic(ctx, tr, st, cameraX);
  return { lamps };
}
