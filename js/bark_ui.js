/**
 * Barks (Bob): bubble + subtitle rendering. Look matches the approved sample
 * (/workspace/samples/barks): cream pixel bubble, dark outline, accent stripe, stepped tail;
 * boss bubbles get a thick gold frame. Subtitles: dark bar, gold rules, coloured speaker name.
 */
import { getSignRects } from './world.js';

const ACC = { friend: '#2fae8f', thug: '#d23c2c', boss: '#d9a441' };
const INK = '#1b120a', PAPER = '#f4e6c4', TEXT = '#2a1a0e';
const SCREEN_W = 960, SCREEN_H = 540; // game canvas logical size (screen px)
const font = (large) => (large ? 'bold 20px' : 'bold 15px') + ' monospace';

function wrap(ctx, t, max, large) {
  ctx.font = font(large);
  const words = t.split(' ');
  const l = [''];
  for (const w of words) {
    const tr = (l[l.length - 1] + ' ' + w).trim();
    if (ctx.measureText(tr).width > max && l[l.length - 1]) l.push(w); else l[l.length - 1] = tr;
  }
  return l.length > (wrap.maxLines || 2) ? wrap(ctx, t, max + 40, large) : l;
}
function rr(ctx, X, Y, W, H, col) { ctx.fillStyle = col; ctx.fillRect(X + 2, Y, W - 4, H); ctx.fillRect(X, Y + 2, W, H - 4); }

/** Head point (scene space) of the speaker: x on screen, y = where the tail tip should sit. */
function headPoint(cur, cam, areaId) {
  const e = cur.ent;
  const sx = e.x - cam.x;
  if (e.npc) {
    const feet = e.y;
    const h = 85 * (e.__barkKey === 'silas' ? 1.4 : 1.2);
    // same rule as main.js nametagY: the tag hops above a painted sign, or drops under the feet
    const rects = getSignRects(areaId);
    const zoom = cam.zoom > 0 ? cam.zoom : 1;
    const topLimit = Math.round(cam.y + 64 / zoom);
    let ty = Math.round(feet - h - 30);
    for (let pass = 0; pass < 4; pass++) {
      const hit = rects.find((r) => r.x < sx + 60 && r.x + r.w > sx - 60 && r.y < ty + 30 && r.y + r.h > ty - 2);
      if (!hit) break;
      ty = Math.round(hit.y - 32);
      if (ty < topLimit) { ty = feet + 6; break; }
    }
    return { x: sx, y: ty > feet ? Math.round(feet - h - 4) : ty - 4 };
  }
  const h = 85 * (e.drawScale || (e.isBoss ? 1.4 : 1.2));
  return { x: sx, y: Math.round(e.y - h - (e.nameTag ? 22 : 14)) };
}

function overlaps(rects, X, Y, W, H) { return rects.some((r) => r.x < X + W && r.x + r.w > X && r.y < Y + H && r.y + r.h > Y); }

/** screen: draw on the presented display canvas (crisp at any zoom); else into the scene buffer (lens space). */
export function drawBarkBubble(ctx, cur, cam, areaId, st, reduced, screen = false) {
  const large = st.size === 'large';
  const boss = cur.kind === 'boss';
  const lh = large ? 24 : 18;
  ctx.save();
  // Screen space: the scene buffer shows the lens (cam.x, cam.y, viewW x viewH) stretched to the 960-wide
  // canvas, so k scene px -> 1 screen px. Drawing under translate(0, cam.y) * scale(1/k) makes every
  // size below (font, padding, outline, tail) a constant screen size at 1x / 2x / 3x.
  const k = SCREEN_W / (cam.viewW > 0 ? cam.viewW : SCREEN_W);
  if (screen) ctx.setTransform(ctx.canvas.width / SCREEN_W, 0, 0, ctx.canvas.height / SCREEN_H, 0, 0);
  else { ctx.translate(0, cam.y || 0); ctx.scale(1 / k, 1 / k); }
  ctx.imageSmoothingEnabled = false; ctx.globalCompositeOperation = 'source-over';
  let lines = wrap(ctx, cur.text, large ? 300 : 250, large);
  let W = Math.round(Math.max(...lines.map((l) => ctx.measureText(l).width)) + 24), H = lines.length * lh + 16;
  const hs = headPoint(cur, cam, areaId);
  const hp = { x: Math.round(hs.x * k), y: Math.round((hs.y - (cam.y || 0)) * k) }; // head in screen px
  const top = 70;                                            // keep clear of the top HUD band (screen px)
  const viewW = SCREEN_W;
  let X = Math.round(hp.x - W / 2), Y = Math.round(hp.y - H - 12);
  X = Math.max(8, Math.min(viewW - W - 8, X));
  // avoid shop signs: try sliding sideways, then above the sign
  const rects = getSignRects(areaId).map((r) => ({ x: r.x * k, y: (r.y - (cam.y || 0)) * k, w: r.w * k, h: r.h * k })); // to screen px
  if (overlaps(rects, X - 4, Y - 4, W + 8, H + 8)) {
    const tries = [X - W / 2 - 20, X + W / 2 + 20, X - W - 30, X + W + 30].map((v) => Math.round(Math.max(8, Math.min(viewW - W - 8, v))));
    const ok = tries.find((tx) => !overlaps(rects, tx - 4, Y - 4, W + 8, H + 8));
    if (ok != null) X = ok;
  }
  let side = 0; // no room above the head (or the nametag): sit beside the head instead, tail pointing in
  if (Y < top) {
    // narrower, taller bubble so it fits beside the head
    wrap.maxLines = large ? 3 : 4; lines = wrap(ctx, cur.text, large ? 190 : 150, large); wrap.maxLines = 2;
    W = Math.round(Math.max(...lines.map((l) => ctx.measureText(l).width)) + 24); H = lines.length * lh + 16;
    const tagHalf = Math.round(56 * k) + 6; // nametag half-width (scene 56px) in screen px
    Y = Math.max(top, hp.y + 2);
    side = hp.x + tagHalf + W < viewW - 8 ? 1 : -1;
    X = side > 0 ? Math.round(hp.x + tagHalf) : Math.round(hp.x - tagHalf - W);
    X = Math.max(8, Math.min(viewW - W - 8, X));
    if (X < hp.x + tagHalf - 12 && X + W > hp.x - tagHalf + 12) { Y = top; side = 0; } // still squeezed: top of the lens (may cover the nametag, never the face)
  }
  const e = cur.t, tot = cur.hold + 0.4;
  const al = reduced ? 1 : e < 0.15 ? e / 0.15 : e > tot - 0.25 ? Math.max(0, (tot - e) / 0.25) : 1;
  ctx.globalAlpha = al;
  if (!reduced && e < 0.15) { const s = 0.85 + 0.15 * e / 0.15; ctx.translate(hp.x, hp.y); ctx.scale(s, s); ctx.translate(-hp.x, -hp.y); }
  const o = boss ? 4 : 2;
  rr(ctx, X - o, Y - o, W + 2 * o, H + 2 * o, INK);
  if (boss) rr(ctx, X - 2, Y - 2, W + 4, H + 4, ACC.boss);
  rr(ctx, X, Y, W, H, PAPER);
  ctx.fillStyle = ACC[cur.kind] || ACC.friend; ctx.fillRect(X + 4, Y + 3, W - 8, 3);
  // stepped tail toward the head (only when the bubble sits above it)
  if (side) {
    const ty = Y + Math.min(H - 14, 10), ex = side > 0 ? X : X + W;
    for (let k = 0; k < 10; k += 2) {
      const w = 10 - k;
      ctx.fillStyle = INK; ctx.fillRect(side > 0 ? ex - w - o : ex, ty + k / 2 - o + 1, w + o, 2 + o);
      ctx.fillStyle = PAPER; ctx.fillRect(side > 0 ? ex - w + 1 : ex - 1, ty + k / 2 + 1, w, 2);
    }
  } else if (Y + H < hp.y + 4) { // tail down to the head
    const tx = Math.max(X + 12, Math.min(X + W - 20, hp.x - 4));
    ctx.fillStyle = INK; for (let k = 0; k < 12; k += 2) ctx.fillRect(tx + k / 2 - o, Y + H + k, 10 - k + 2 * o, 2);
    ctx.fillStyle = PAPER; for (let k = 0; k < 10; k += 2) ctx.fillRect(tx + k / 2, Y + H + k - 2, 8 - k, 2);
  }
  ctx.fillStyle = TEXT; ctx.textBaseline = 'top'; ctx.textAlign = 'left';
  lines.forEach((l, i) => ctx.fillText(l, X + 12, Y + 10 + i * lh));
  ctx.restore();
}

// ---------- subtitles (DOM bar inside #ui-layer: screen space, clear of OBJECTIVE/TIME + touch controls) ----------
let subEl = null;
function subBar() {
  if (subEl) return subEl;
  subEl = document.getElementById('barks-sub');
  return subEl;
}
export function showSubtitle(cur, st) {
  const el = subBar(); if (!el) return;
  el.classList.toggle('barks-large', st.size === 'large');
  el.dataset.kind = cur.kind;
  el.innerHTML = '';
  const n = document.createElement('span'); n.className = 'barks-name'; n.textContent = cur.name + ': ';
  const t = document.createElement('span'); t.className = 'barks-text'; t.textContent = cur.text;
  el.append(n, t);
  el.classList.remove('hidden');
}
export function hideSubtitle() { const el = subBar(); if (el) el.classList.add('hidden'); }
