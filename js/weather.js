/**
 * Player weather / time of day. Visual only: no gameplay, hitboxes, or campaign save data.
 *
 * The street plates are painted golden hour. That look is Sunny (the default). Night and Rainy
 * are grades on top of the same pipeline (world.js lamps/street, then this pass, then present.js
 * bloom / vignette). Choice is stored on its own localStorage key, not inside the game save.
 *
 * Tunables live in TUNING below. Rain loudness is TUNING.rainGain (read by js/audio.js).
 * Lamp anchors and the sunny street grade live in js/world.js. Switch with T, the pause menu,
 * the title menu, View/Create on a pad, or the Day/Night/Rain button on touch.
 */
import { cheapPresentation } from './present.js';

export const WEATHER_KEY = 'starCityDrift_weather';
export const WEATHER_ORDER = ['sunny', 'night', 'rainy'];

const NAMES = { sunny: 'Sunny', night: 'Night', rainy: 'Rainy' };
const SHORT = { sunny: 'Day', night: 'Night', rainy: 'Rain' };

/** Every knob for the three grades. Edit these; the drawers read them each frame. */
export const TUNING = {
  /** Soft filtered-noise bed while Rainy is selected (js/audio.js). 0–1, before the SFX slider. */
  rainGain: 0.075,
  sunny: {
    /** Screen-blend daylight lift over the sky (0–1). */
    skyLift: 0.32,
    skyLiftMid: 0.14,
    /** Full-frame warmth so sprites match the brighter street. */
    characterWarmth: 0.08,
    /** Extra sun disc, screen-blended, when the plate has no star anchor. */
    sunAlpha: 0.16
  },
  night: {
    /** Multiply colors. Darker = deeper night. Sky is the top of the grade, street the bottom. */
    skyTop: '#1c2748',
    skyMid: '#3a4c74',
    street: '#7d879f',
    blackoutSky: '#121628',
    blackoutMid: '#2a3148',
    blackoutStreet: '#4a5168',
    lampAlpha: 0.38,
    lampRadius: 200,
    windowCount: 18,
    windowCheap: 8,
    windowAlpha: 0.62,
    moonAlpha: 0.55,
    starCount: 16,
    vignette: 0.52
  },
  rainy: {
    /** saturation composite: 0 = full color, 1 = gray. */
    desat: 0.74,
    overcastTop: '#8b949f',
    overcastMid: '#b7bfc8',
    overcastStreet: '#d8dee4',
    blackoutTop: '#5c6572',
    blackoutStreet: '#9aa3ad',
    drops: 96,
    dropsCheap: 40,
    dropAlpha: 0.34,
    sheen: 0.22,
    puddles: 6,
    puddlesCheap: 3,
    splashes: 10,
    splashesCheap: 5,
    /** New splash rings per second. */
    splashRate: 6,
    clouds: 4,
    cloudsCheap: 2
  }
};

let mode = 'sunny';
try {
  const saved = localStorage.getItem(WEATHER_KEY);
  if (WEATHER_ORDER.includes(saved)) mode = saved;
} catch (_) { /* private mode: stay on Sunny */ }

export function getWeather() { return mode; }
export function weatherName(id = mode) { return NAMES[id] || NAMES.sunny; }
export function weatherShort(id = mode) { return SHORT[id] || SHORT.sunny; }

export function setWeather(id) {
  if (!WEATHER_ORDER.includes(id)) return mode;
  mode = id;
  try { localStorage.setItem(WEATHER_KEY, mode); } catch (_) { /* storage off */ }
  return mode;
}

export function cycleWeather() {
  const i = WEATHER_ORDER.indexOf(mode);
  return setWeather(WEATHER_ORDER[(i + 1) % WEATHER_ORDER.length]);
}

const reduced = () => !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

function hash(i) {
  let x = Math.imul(i + 1, 374761393);
  x = Math.imul(x ^ (x >>> 13), 1274126177);
  return (x ^ (x >>> 16)) >>> 0;
}

const drops = [];
let dropT = 0;
function ensureDrops(n) {
  while (drops.length < n) {
    drops.push({
      x: Math.random(),
      y: Math.random(),
      v: 0.55 + Math.random() * 0.7,
      len: 10 + Math.random() * 14,
      a: 0.16 + Math.random() * 0.22
    });
  }
  if (drops.length > n) drops.length = n;
}

const splashes = [];
function drawSplashes(ctx, W, gy, H, dt, cheap) {
  const cap = cheap || reduced() ? TUNING.rainy.splashesCheap : TUNING.rainy.splashes;
  const floor = Math.max(8, H - gy - 4);
  if (dt > 0 && splashes.length < cap && Math.random() < dt * TUNING.rainy.splashRate) {
    splashes.push({
      x: Math.random() * W,
      y: gy + 4 + Math.random() * floor,
      r: 1.2,
      life: 0.38 + Math.random() * 0.15
    });
  }
  ctx.save();
  ctx.strokeStyle = 'rgb(214, 226, 238)';
  ctx.lineWidth = 1;
  for (let i = splashes.length - 1; i >= 0; i--) {
    const s = splashes[i];
    if (dt > 0) { s.life -= dt; s.r += dt * 26; }
    if (s.life <= 0) { splashes.splice(i, 1); continue; }
    ctx.globalAlpha = Math.max(0, Math.min(0.65, s.life * 1.8));
    ctx.beginPath();
    ctx.ellipse(s.x, s.y, s.r, Math.max(1, s.r * 0.32), 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

const puddles = [];
function drawPuddles(ctx, W, gy, H, t, cheap) {
  const n = cheap ? TUNING.rainy.puddlesCheap : TUNING.rainy.puddles;
  while (puddles.length < n) puddles.push({ x: Math.random(), y: Math.random(), p: Math.random() * 6.28, w: 16 + Math.random() * 28 });
  const span = Math.max(10, H - gy - 8);
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  for (let i = 0; i < n; i++) {
    const p = puddles[i];
    const x = p.x * W;
    const y = gy + 6 + p.y * span;
    const shim = 0.1 + 0.1 * Math.sin(t * 1.8 + p.p);
    ctx.fillStyle = `rgba(198, 214, 230, ${shim})`;
    ctx.beginPath();
    ctx.ellipse(x, y, p.w, 3.4, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function fallbackLamps(W, H) {
  const y = H * 0.34;
  const n = cheapPresentation() ? 3 : 4;
  const out = [];
  for (let i = 0; i < n; i++) out.push({ x: ((i + 0.5) * W) / n, y });
  return out;
}

function drawSunny(ctx, W, H, t, o) {
  const gy = o.groundY || H * 0.68;
  const S = TUNING.sunny;
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  const sky = ctx.createLinearGradient(0, 0, 0, gy);
  sky.addColorStop(0, `rgba(255, 248, 230, ${S.skyLift})`);
  sky.addColorStop(0.45, `rgba(255, 214, 140, ${S.skyLiftMid})`);
  sky.addColorStop(1, 'rgba(255, 196, 120, 0)');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, gy);
  const sx = W * 0.72;
  const sy = Math.min(gy * 0.42, H * 0.22);
  const sun = ctx.createRadialGradient(sx, sy, 8, sx, sy, W * 0.28);
  sun.addColorStop(0, `rgba(255, 244, 210, ${S.sunAlpha + 0.06})`);
  sun.addColorStop(0.35, `rgba(255, 196, 110, ${S.sunAlpha})`);
  sun.addColorStop(1, 'rgba(255, 170, 80, 0)');
  ctx.fillStyle = sun;
  ctx.fillRect(sx - W * 0.3, 0, W * 0.6, gy);
  if (S.characterWarmth > 0) {
    ctx.fillStyle = `rgba(255, 206, 140, ${S.characterWarmth})`;
    ctx.fillRect(0, 0, W, H);
  }
  ctx.restore();
}

function drawWindows(ctx, W, skyH, t, count, alpha) {
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  for (let i = 0; i < count; i++) {
    const h = hash(i + 3);
    if (h % 5 === 0) continue;
    const x = (h % 997) / 997 * (W - 12);
    const y = 22 + ((h >>> 10) % 997) / 997 * Math.max(24, skyH * 0.46);
    const blink = (h % 19 === 0) && Math.sin(t * 8 + i) < -0.15;
    const flick = blink ? 0.2 : (0.72 + 0.28 * Math.sin(t * 1.6 + i * 1.7));
    const a = alpha * flick;
    ctx.fillStyle = `rgba(255, 198, 120, ${a})`;
    ctx.fillRect(x, y, 5, 7);
    const g = ctx.createRadialGradient(x + 2, y + 3, 0, x + 2, y + 3, 14);
    g.addColorStop(0, `rgba(255, 176, 80, ${0.22 * flick})`);
    g.addColorStop(1, 'rgba(255, 160, 60, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - 12, y - 8, 30, 28);
  }
  ctx.restore();
}

function drawNight(ctx, W, H, t, o) {
  const N = TUNING.night;
  const dark = !!o.blackout;
  const gy = o.groundY || H * 0.68;
  const cheap = !!o.cheap;
  ctx.save();
  ctx.globalCompositeOperation = 'multiply';
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, dark ? N.blackoutSky : N.skyTop);
  sky.addColorStop(0.42, dark ? N.blackoutMid : N.skyMid);
  sky.addColorStop(0.72, dark ? N.blackoutStreet : N.street);
  sky.addColorStop(1, dark ? N.blackoutStreet : N.street);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);

  ctx.globalCompositeOperation = 'screen';
  if (!dark) {
    const mx = W * 0.8;
    const my = H * 0.11;
    const moon = ctx.createRadialGradient(mx, my, 2, mx, my, 46);
    moon.addColorStop(0, `rgba(236, 242, 255, ${N.moonAlpha})`);
    moon.addColorStop(0.45, `rgba(186, 204, 240, ${N.moonAlpha * 0.35})`);
    moon.addColorStop(1, 'rgba(160, 180, 230, 0)');
    ctx.fillStyle = moon;
    ctx.fillRect(mx - 50, my - 50, 100, 100);
    ctx.fillStyle = 'rgba(255, 250, 240, 0.85)';
    const stars = cheap ? 7 : N.starCount;
    for (let i = 0; i < stars; i++) {
      const h = hash(i + 40);
      const x = (h % 991) / 991 * W;
      const y = ((h >>> 9) % 991) / 991 * H * 0.22;
      const tw = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(t * 1.8 + i));
      ctx.globalAlpha = 0.35 * tw;
      ctx.fillRect(x, y, i % 4 === 0 ? 2 : 1, i % 4 === 0 ? 2 : 1);
    }
    ctx.globalAlpha = 1;

    const lamps = (o.lights && o.lights.lamps && o.lights.lamps.length) ? o.lights.lamps : fallbackLamps(W, H);
    for (let i = 0; i < lamps.length; i++) {
      const l = lamps[i];
      const k = N.lampAlpha * (0.88 + 0.12 * Math.sin(t * 2.4 + l.x * 0.01));
      const r = N.lampRadius;
      const g = ctx.createRadialGradient(l.x, l.y, 3, l.x, l.y + r * 0.45, r);
      g.addColorStop(0, `rgba(255, 226, 176, ${Math.min(0.72, k + 0.22)})`);
      g.addColorStop(0.22, `rgba(255, 176, 90, ${k})`);
      g.addColorStop(1, 'rgba(255, 150, 60, 0)');
      ctx.fillStyle = g;
      ctx.fillRect(l.x - r, l.y - 30, r * 2, r * 1.7);
    }
    const neons = (o.lights && o.lights.neon) || [];
    for (let i = 0; i < neons.length && i < 6; i++) {
      const n = neons[i];
      const a = 0.22 + 0.06 * Math.sin(t * 3 + n.x);
      const rad = Math.max(24, (n.rx || 40) * 1.4);
      const g = ctx.createRadialGradient(n.x, n.y, 2, n.x, n.y, rad);
      g.addColorStop(0, `rgba(${n.color || '255,180,120'}, ${a})`);
      g.addColorStop(1, `rgba(${n.color || '255,180,120'}, 0)`);
      ctx.fillStyle = g;
      ctx.fillRect(n.x - rad, n.y - rad, rad * 2, rad * 2);
    }
    const starsGlow = (o.lights && o.lights.stars) || [];
    for (const s of starsGlow) {
      const pulse = 0.85 + 0.15 * Math.sin(t * 2.1);
      const rad = 90 * (s.r || 0.6);
      const g = ctx.createRadialGradient(s.x, s.y, 2, s.x, s.y, rad);
      g.addColorStop(0, `rgba(255, 236, 190, ${0.42 * pulse})`);
      g.addColorStop(1, 'rgba(255, 200, 120, 0)');
      ctx.fillStyle = g;
      ctx.fillRect(s.x - rad, s.y - rad, rad * 2, rad * 2);
    }
    drawWindows(ctx, W, gy, t, cheap ? N.windowCheap : N.windowCount, N.windowAlpha);
  }

  ctx.globalCompositeOperation = 'source-over';
  const v = ctx.createRadialGradient(W / 2, H * 0.5, H * 0.28, W / 2, H * 0.52, W * 0.72);
  v.addColorStop(0, 'rgba(0,0,0,0)');
  v.addColorStop(1, `rgba(2, 4, 12, ${dark ? Math.min(0.72, N.vignette + 0.12) : N.vignette})`);
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
}

function drawRainy(ctx, W, H, t, o) {
  const R = TUNING.rainy;
  const dark = !!o.blackout;
  const gy = o.groundY || H * 0.68;
  const cheap = !!o.cheap || reduced();
  const dt = o.frozen ? 0 : Math.min(0.05, Math.max(0, t - (dropT || t)));
  dropT = t;
  ctx.save();
  ctx.globalCompositeOperation = 'saturation';
  ctx.fillStyle = `rgba(128, 128, 128, ${R.desat})`;
  ctx.fillRect(0, 0, W, H);
  ctx.globalCompositeOperation = 'multiply';
  const wash = ctx.createLinearGradient(0, 0, 0, H);
  wash.addColorStop(0, dark ? R.blackoutTop : R.overcastTop);
  wash.addColorStop(0.5, dark ? R.blackoutStreet : R.overcastMid);
  wash.addColorStop(1, dark ? R.blackoutStreet : R.overcastStreet);
  ctx.fillStyle = wash;
  ctx.fillRect(0, 0, W, H);

  ctx.globalCompositeOperation = 'source-over';
  const clouds = cheap ? R.cloudsCheap : R.clouds;
  ctx.fillStyle = 'rgba(226, 230, 234, 0.16)';
  for (let i = 0; i < clouds; i++) {
    const x = ((i * 240 + (o.frozen ? 0 : t * 10)) % (W + 200)) - 100;
    const y = 26 + (i % 3) * 32;
    ctx.beginPath();
    ctx.ellipse(x, y, 100, 18, 0, 0, Math.PI * 2);
    ctx.ellipse(x + 40, y + 6, 70, 14, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.globalCompositeOperation = 'screen';
  const sh = ctx.createLinearGradient(0, gy, 0, H);
  sh.addColorStop(0, `rgba(190, 208, 224, ${R.sheen})`);
  sh.addColorStop(0.45, `rgba(160, 178, 198, ${R.sheen * 0.45})`);
  sh.addColorStop(1, 'rgba(140, 160, 180, 0)');
  ctx.fillStyle = sh;
  ctx.fillRect(0, gy - 2, W, H - gy + 2);
  ctx.restore();

  drawPuddles(ctx, W, gy, H, t, cheap);

  const n = cheap ? R.dropsCheap : R.drops;
  ensureDrops(n);
  ctx.save();
  ctx.lineWidth = 1;
  ctx.strokeStyle = 'rgb(226, 232, 238)';
  const speed = reduced() ? 0.35 : 1;
  for (let i = 0; i < n; i++) {
    const d = drops[i];
    if (dt > 0) {
      d.y += d.v * dt * speed;
      d.x -= d.v * 0.16 * dt * speed;
      if (d.y > 1.05) { d.y = -0.04 - Math.random() * 0.08; d.x = Math.random() * 1.15; }
      if (d.x < -0.05) d.x += 1.15;
    }
    const x = d.x * W;
    const y = d.y * H;
    ctx.globalAlpha = d.a * (0.65 + 0.35 * R.dropAlpha / 0.34);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + d.len * 0.16, y - d.len);
    ctx.stroke();
  }
  ctx.restore();
  drawSplashes(ctx, W, gy, H, dt, cheap);
}

/**
 * Grade over the finished scene (street + cast), before present.js.
 * @param {{groundY?: number, blackout?: boolean, frozen?: boolean, lights?: {lamps?: object[], neon?: object[], stars?: object[]}|null, title?: boolean, cheap?: boolean}} [o]
 */
export function drawWeather(ctx, W, H, t, o = {}) {
  const cheap = o.cheap != null ? !!o.cheap : cheapPresentation();
  const opt = o.title ? { ...o, cheap, lights: null } : { ...o, cheap };
  if (mode === 'night') drawNight(ctx, W, H, t, opt);
  else if (mode === 'rainy') drawRainy(ctx, W, H, t, opt);
  else drawSunny(ctx, W, H, t, opt);
}
