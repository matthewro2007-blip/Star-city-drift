/**
 * 1.6.0 "The Star Goes Dark": rainy-night grade for the main campaign (original, procedural).
 * Drawn over the scene + cast (lens width). `blackout` = anniversary night after the midpoint twist:
 * the city's lights are down and the Mill Mountain Star is off (world.js setStarDark).
 */
const drops = [];
let lastT = 0, flash = 0, nextFlash = 9;

function seed(W, H, n) {
  while (drops.length < n) drops.push({ x: Math.random() * W, y: Math.random() * H, v: 620 + Math.random() * 380, l: 10 + Math.random() * 14, a: 0.18 + Math.random() * 0.22 });
  drops.length = n;
}

/** @param {{blackout?: boolean, groundY?: number, heavy?: number, frozen?: boolean}} o */
export function drawRainNight(ctx, W, H, t, o = {}) {
  const dt = o.frozen ? 0 : Math.min(0.05, Math.max(0, t - (lastT || t)));
  lastT = t;
  const dark = !!o.blackout;
  const heavy = o.heavy == null ? 1 : o.heavy;
  ctx.save();
  // wash the painted golden-hour plates out: less colour, then a stormy night sky above the street
  const gy0 = o.groundY || H * 0.75;
  ctx.globalCompositeOperation = 'saturation';
  ctx.fillStyle = `rgba(128,128,128,${o.after ? 0.35 : 0.55})`; ctx.fillRect(0, 0, W, H);
  ctx.globalCompositeOperation = 'multiply';
  const sky = ctx.createLinearGradient(0, 0, 0, gy0);
  sky.addColorStop(0, dark ? 'rgb(40,44,70)' : 'rgb(70,80,124)'); sky.addColorStop(1, 'rgb(255,255,255)');
  ctx.fillStyle = sky; ctx.fillRect(0, 0, W, gy0);
  // night: cool multiply, deeper once the city goes dark
  ctx.fillStyle = dark ? 'rgb(62,70,104)' : o.after ? 'rgb(122,132,172)' : 'rgb(98,110,152)';
  ctx.fillRect(0, 0, W, H);
  // a few wet sodium pools so the street still reads (dimmer and fewer in the blackout)
  ctx.globalCompositeOperation = 'screen';
  const pools = dark ? 2 : 4;
  for (let i = 0; i < pools; i++) {
    const x = ((i + 0.5) * W) / pools, y = H * 0.36;
    const k = dark ? 0.08 + 0.05 * Math.max(0, Math.sin(t * 7 + i * 3)) : 0.16 + 0.02 * Math.sin(t * 2 + i);
    const g = ctx.createRadialGradient(x, y, 4, x, y + 140, 280);
    g.addColorStop(0, `rgba(255,186,120,${k})`); g.addColorStop(1, 'rgba(255,170,90,0)');
    ctx.fillStyle = g; ctx.fillRect(x - 280, 0, 560, H);
  }
  // street sheen: reflected light streaks on the wet sidewalk
  const gy = o.groundY || H * 0.75;
  const sh = ctx.createLinearGradient(0, gy, 0, H);
  sh.addColorStop(0, 'rgba(120,150,210,0.10)'); sh.addColorStop(1, 'rgba(120,150,210,0)');
  ctx.fillStyle = sh; ctx.fillRect(0, gy, W, H - gy);
  // distant lightning: rare, soft, never a strobe
  nextFlash -= dt;
  if (nextFlash <= 0) { flash = 1; nextFlash = 10 + Math.random() * 14; }
  if (flash > 0) {
    ctx.fillStyle = `rgba(190,205,255,${0.1 * flash})`; ctx.fillRect(0, 0, W, H);
    flash = Math.max(0, flash - dt * 2.2);
  }
  ctx.globalCompositeOperation = 'source-over';
  // rain streaks (slanted)
  seed(W, H, Math.round(150 * heavy));
  ctx.lineWidth = 1;
  ctx.strokeStyle = 'rgb(190,205,235)';
  for (const d of drops) {
    d.y += d.v * dt; d.x -= d.v * 0.18 * dt;
    if (d.y > H) { d.y = -d.l - Math.random() * 40; d.x = Math.random() * (W + 80); }
    if (d.x < -20) d.x += W + 40;
    ctx.globalAlpha = d.a;
    ctx.beginPath(); ctx.moveTo(d.x, d.y); ctx.lineTo(d.x + d.l * 0.18, d.y - d.l); ctx.stroke();
  }
  // splashes along the sidewalk
  ctx.globalAlpha = 0.35; ctx.fillStyle = 'rgb(200,215,240)';
  for (let i = 0; i < 18 * heavy; i++) {
    const x = (Math.sin(i * 91.7 + Math.floor(t * 6) * 13.3) * 0.5 + 0.5) * W;
    const y = gy + ((i * 37) % Math.max(1, H - gy - 6));
    ctx.fillRect(x, y, 3, 1);
  }
  ctx.globalAlpha = 1;
  // vignette
  const v = ctx.createRadialGradient(W / 2, H * 0.55, H * 0.3, W / 2, H * 0.55, W * 0.72);
  v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, dark ? 'rgba(2,3,10,0.62)' : 'rgba(4,6,16,0.45)');
  ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
  ctx.restore();
}

/** Cinematic letterbox for story scenes. */
export function drawLetterbox(ctx, W, H, k = 1) {
  const h = Math.round(H * 0.09 * k);
  ctx.save(); ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, h); ctx.fillRect(0, H - h, W, h); ctx.restore();
}
