/**
 * hero.js — high-res procedural pixel-art renderer for Matthew Rose (player).
 *
 * Concept-art hero, face per Matthew's photo: oval face + rounded jaw, fair
 * skin with pink-peach shading, short even buzz cut, thick straight dark brows,
 * a thin neat mustache and a small chin soul patch (no glasses). Crisp white
 * short-sleeve button-down, brown belt + gold buckle, blue jeans with rolled
 * cuffs and a knee rip, brown work boots, ready fighting stance.
 *
 * Logical frame: 112×128 px, feet at y=126, body centred on x=56, facing right.
 * Rendered pixel-by-pixel (no anti-aliasing): parts are rasterised into a
 * part/material/tone buffer, cylinder/ellipsoid-shaded with a light from the
 * upper-right (sunset), separated by 1px darker part lines, then wrapped in a
 * 1px dark silhouette outline. Frames are cached as offscreen canvases.
 */

export const HERO_FRAME_W = 112;
export const HERO_FRAME_H = 128;
export const HERO_FEET_Y = 126;
export const HERO_DRAW_H = 128; // on-screen height (≈1.5× the old 84px sprite)
export const HERO_SHADOW_W = 92; // drawGroundShadow width for the wide stance

const FW = HERO_FRAME_W, FH = HERO_FRAME_H, CX = 56;

/** Frames per pose (anything else falls back to idle). */
export const HERO_POSES = { idle: 2, walk: 4, punch: 2, kick: 2, hurt: 1 };

// ---------------------------------------------------------------- colours
function hex(c) {
  c = String(c || '#888888').replace('#', '');
  if (c.length === 3) c = c.split('').map((x) => x + x).join('');
  const n = parseInt(c, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function mix(a, b, t) { return [0, 1, 2].map((i) => Math.round(a[i] + (b[i] - a[i]) * t)); }
function lum(c) { return (0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]) / 255; }
function toHex(c) { return '#' + c.map((v) => v.toString(16).padStart(2, '0')).join(''); }
/** [line, shadow, base, highlight] — cool shadows, warm sunset highlights. */
function ramp(base) {
  let b = hex(base);
  if (lum(b) < 0.1) b = mix(b, [255, 255, 255], 0.14);
  return [mix(b, [18, 10, 16], 0.68), mix(b, [34, 22, 44], 0.3), b, mix(b, [255, 236, 200], 0.3)];
}
const flat = (c) => [c, c, c, c];

const OUTLINE = [24, 14, 10];

const BASE_MATS = {
  // fair skin, pink-peach shading: deep #cfa08a, shade #e6bfa8, base #f6dccb, hi #fff0e6
  skin: [hex('#cfa08a'), hex('#e6bfa8'), hex('#f6dccb'), hex('#fff0e6')],
  skinLine: [hex('#b9846f'), hex('#cfa08a'), hex('#e6bfa8'), hex('#f6dccb')],
  hair: [[16, 11, 10], [26, 20, 18], [40, 32, 30], [66, 56, 52]],
  fade: [[90, 74, 70], [120, 102, 96], [150, 128, 120], [176, 152, 142]],
  stache: [[16, 11, 9], [28, 19, 15], [52, 38, 31], [80, 62, 52]],
  brow: [[30, 21, 17], [44, 31, 25], [58, 41, 33], [82, 60, 48]],
  eyeW: flat([244, 238, 230]),
  eye: flat([30, 20, 16]),
  lip: [[176, 110, 104], [200, 134, 126], [222, 156, 146], [236, 178, 168]],
  shirt: [[118, 104, 104], [198, 186, 182], [236, 229, 216], [255, 251, 238]],
  button: [[90, 86, 92], [150, 148, 158], [206, 204, 210], [250, 250, 250]],
  jeans: [[16, 25, 52], [34, 56, 102], [56, 90, 144], [90, 126, 180]],
  cuff: [[16, 25, 52], [66, 96, 146], [100, 134, 184], [138, 168, 208]],
  rip: [[180, 176, 168], [214, 210, 200], [236, 232, 224], [250, 248, 242]],
  belt: [[26, 15, 9], [62, 36, 20], [100, 62, 34], [140, 92, 54]],
  gold: [[84, 58, 16], [176, 128, 40], [228, 186, 76], [255, 240, 160]],
  boot: [[28, 15, 8], [88, 50, 22], [130, 80, 38], [176, 118, 62]],
  sole: [[16, 10, 7], [34, 22, 15], [46, 31, 21], [62, 44, 30]]
};

function buildMats(outfitId, outfit) {
  const m = { ...BASE_MATS };
  const isDefault = !outfitId || outfitId === 'polo';
  if (!isDefault && outfit) {
    if (outfit.shirt) m.shirt = ramp(outfit.shirt);
    if (outfit.pants) {
      m.jeans = ramp(outfit.pants);
      m.cuff = ramp(toHex(mix(hex(outfit.pants), [255, 255, 255], 0.22)));
      m.cuff[0] = m.jeans[0];
    }
    if (outfit.accent) m.button = ramp(outfit.accent);
  }
  const keys = Object.keys(m);
  return { list: keys.map((k) => m[k]), idx: Object.fromEntries(keys.map((k, i) => [k, i])) };
}

// ---------------------------------------------------------------- lighting
const L = (() => { const v = [0.58, -0.55, 0.6]; const n = Math.hypot(...v); return v.map((x) => x / n); })();
function toneFor(nx, ny, nz, bias = 0) {
  const I = nx * L[0] + ny * L[1] + nz * L[2] + bias;
  if (I > 0.8) return 3;
  if (I > 0.4) return 2;
  return 1;
}

// ---------------------------------------------------------------- pixel buffer
class PixBuf {
  constructor(mats) {
    this.mats = mats;
    this.mat = new Int16Array(FW * FH).fill(-1);
    this.tone = new Int8Array(FW * FH);
    this.part = new Int16Array(FW * FH).fill(-1);
    this.grp = [];
    this.line = [];
    this.extra = new Map(); // silhouette outline pixels
  }
  begin(group, line = true) { this.grp.push(group); this.line.push(line); return this.grp.length - 1; }
  set(id, x, y, mat, tone) {
    x = Math.round(x); y = Math.round(y);
    if (x < 0 || y < 0 || x >= FW || y >= FH) return;
    const i = y * FW + x;
    this.part[i] = id; this.mat[i] = this.mats.idx[mat]; this.tone[i] = tone;
  }
  /** Detail pixel: only lands where part `id` is the visible top part. */
  dot(id, x, y, mat, tone) {
    x = Math.round(x); y = Math.round(y);
    if (x < 0 || y < 0 || x >= FW || y >= FH) return;
    const i = y * FW + x;
    if (id !== null && this.part[i] !== id) return;
    this.mat[i] = this.mats.idx[mat]; this.tone[i] = tone;
  }
  lineD(id, x0, y0, x1, y1, mat, tone) {
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      this.dot(id, x0, y0, mat, tone);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
  }
  /** Rasterise a shape: inside(px,py) at pixel centres, shade(px,py)->[mat,tone]. */
  fill(id, bb, inside, shade) {
    const x0 = Math.max(0, Math.floor(bb[0])), y0 = Math.max(0, Math.floor(bb[1]));
    const x1 = Math.min(FW - 1, Math.ceil(bb[2])), y1 = Math.min(FH - 1, Math.ceil(bb[3]));
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const px = x + 0.5, py = y + 0.5;
        if (!inside(px, py)) continue;
        const [m, t] = shade(px, py);
        this.set(id, x, y, m, t);
      }
    }
  }
  /** Inner part lines: top part's edge pixels over a different group go to the line tone. */
  finishLines() {
    const out = new Uint8Array(FW * FH);
    for (let y = 0; y < FH; y++) {
      for (let x = 0; x < FW; x++) {
        const i = y * FW + x, a = this.part[i];
        if (a < 0 || !this.line[a]) continue;
        const nb = [x > 0 ? i - 1 : -1, x < FW - 1 ? i + 1 : -1, y > 0 ? i - FW : -1, y < FH - 1 ? i + FW : -1];
        for (const j of nb) {
          if (j < 0) continue;
          const b = this.part[j];
          if (b >= 0 && b < a && this.grp[b] !== this.grp[a]) { out[i] = 1; break; }
        }
      }
    }
    const skin = this.mats.idx.skin, skinLine = this.mats.idx.skinLine;
    for (let i = 0; i < out.length; i++) {
      if (!out[i]) continue;
      if (this.mat[i] === skin) { this.mat[i] = skinLine; this.tone[i] = 0; } else this.tone[i] = 0;
    }
  }
  /** 1px dark silhouette outline outside the figure. */
  outline() {
    for (let y = 0; y < FH; y++) {
      for (let x = 0; x < FW; x++) {
        const i = y * FW + x;
        if (this.mat[i] >= 0) continue;
        if ((x > 0 && this.mat[i - 1] >= 0) || (x < FW - 1 && this.mat[i + 1] >= 0) ||
            (y > 0 && this.mat[i - FW] >= 0) || (y < FH - 1 && this.mat[i + FW] >= 0)) {
          this.extra.set(i, OUTLINE);
        }
      }
    }
  }
  rgba() {
    const d = new Uint8ClampedArray(FW * FH * 4);
    for (let i = 0; i < FW * FH; i++) {
      let c = null;
      if (this.mat[i] >= 0) c = this.mats.list[this.mat[i]][this.tone[i]];
      else if (this.extra.has(i)) c = this.extra.get(i);
      if (!c) continue;
      d[i * 4] = c[0]; d[i * 4 + 1] = c[1]; d[i * 4 + 2] = c[2]; d[i * 4 + 3] = 255;
    }
    return d;
  }
}

// ---------------------------------------------------------------- geometry
function pointInPoly(px, py, pts) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i], [xj, yj] = pts[j];
    if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
function bbox(pts, pad = 0) {
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  return [Math.min(...xs) - pad, Math.min(...ys) - pad, Math.max(...xs) + pad, Math.max(...ys) + pad];
}
/** Two-bone IK. Picks the elbow/knee solution closest to direction `pref`. */
function ik(a, c, l1, l2, pref) {
  const dx = c[0] - a[0], dy = c[1] - a[1];
  const d = Math.hypot(dx, dy) || 0.001;
  const maxD = l1 + l2 - 0.05, minD = Math.abs(l1 - l2) + 0.5;
  const dd = Math.max(minD, Math.min(maxD, d));
  const ux = dx / d, uy = dy / d;
  const end = [a[0] + ux * dd, a[1] + uy * dd];
  const aa = (l1 * l1 - l2 * l2 + dd * dd) / (2 * dd);
  const h = Math.sqrt(Math.max(0, l1 * l1 - aa * aa));
  const px = a[0] + ux * aa, py = a[1] + uy * aa;
  const s1 = [px - uy * h, py + ux * h], s2 = [px + uy * h, py - ux * h];
  const score = (s) => (s[0] - px) * pref[0] + (s[1] - py) * pref[1];
  return { mid: score(s1) >= score(s2) ? s1 : s2, end };
}

/** Tapered capsule with cylinder shading. opts.shade(tAlong, sAcross, tone) may override tone. */
function capsule(buf, id, a, b, r0, r1, mat, opts = {}) {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const len2 = dx * dx + dy * dy || 0.0001, len = Math.sqrt(len2);
  const pxv = -dy / len, pyv = dx / len;
  const rMax = Math.max(r0, r1);
  const bb = [Math.min(a[0], b[0]) - rMax - 1, Math.min(a[1], b[1]) - rMax - 1, Math.max(a[0], b[0]) + rMax + 1, Math.max(a[1], b[1]) + rMax + 1];
  const capEnds = opts.capEnds !== false;
  const geo = (x, y) => {
    const raw = ((x - a[0]) * dx + (y - a[1]) * dy) / len2;
    const t = Math.max(0, Math.min(1, raw));
    const cx = a[0] + dx * t, cy = a[1] + dy * t;
    const r = r0 + (r1 - r0) * t;
    return { t, raw, r, d: Math.hypot(x - cx, y - cy), s: ((x - cx) * pxv + (y - cy) * pyv) / r };
  };
  buf.fill(id, bb, (x, y) => {
    const g = geo(x, y);
    if (!capEnds && (g.raw < 0 || g.raw > 1)) return false;
    return g.d <= g.r;
  }, (x, y) => {
    const g = geo(x, y);
    const s = Math.max(-1, Math.min(1, g.s));
    const nz = Math.sqrt(Math.max(0, 1 - s * s));
    let tone = toneFor(pxv * s, pyv * s, nz, opts.bias || 0);
    if (opts.shade) tone = opts.shade(g.t, s, tone);
    return [mat, tone];
  });
  return { len, pxv, pyv, dir: [dx / len, dy / len] };
}

function ellipse(buf, id, c, rx, ry, mat, bias = 0) {
  buf.fill(id, [c[0] - rx - 1, c[1] - ry - 1, c[0] + rx + 1, c[1] + ry + 1],
    (x, y) => ((x - c[0]) / rx) ** 2 + ((y - c[1]) / ry) ** 2 <= 1,
    (x, y) => {
      const u = (x - c[0]) / rx, v = (y - c[1]) / ry;
      return [mat, toneFor(u * 0.9, v * 0.9, Math.sqrt(Math.max(0, 1 - u * u - v * v)), bias)];
    });
}

function polyShaded(buf, id, pts, mat, ctr, rx, ry, bias = 0) {
  buf.fill(id, bbox(pts, 1), (x, y) => pointInPoly(x, y, pts), (x, y) => {
    let u = (x - ctr[0]) / rx, v = (y - ctr[1]) / ry;
    const k = Math.hypot(u, v); if (k > 0.98) { u *= 0.98 / k; v *= 0.98 / k; }
    return [mat, toneFor(u, v, Math.sqrt(Math.max(0, 1 - u * u - v * v)), bias)];
  });
}

// ---------------------------------------------------------------- head pixel map (3/4, facing right)
// Oval face, rounded jaw, short even buzz cut (G/H/h stubble), F hairline blend,
// S/s/L/d skin base/shade/hi/deep, W eye white, E pupil, B thick straight brows,
// M thin mustache + small soul patch, R lip.
const HEAD = [
  '......GHHHHHG......',
  '....GHhHhHhHhHG....',
  '...GHHhHhHhhHhHG...',
  '..GHHHHhHhHhhHhH...',
  '..GHHHHHHhHhHhhHH..',
  '.GHHHHHHHHHFSSLLS..',
  '.GHHHHHHHHFSSSSLS..',
  '.HHHHHHFSBBBBSBBS..',
  '.HHHdSSdSBBBBsSBB..',
  '.HHHdsSdHsSSSsLss..',
  '.HHdddSdsSWEWsLESS.',
  '.HssdddssSSLSsSLSS.',
  '...sssssSSSSSsSSSLS',
  '....ssssSSSSSSsdss.',
  '....ssssSSSMMMMMMs.',
  '.....sssSSSSdRRRs..',
  '......ssSSSSSSLSs..',
  '.......ssSSSSSMSs..',
  '........ssSSSSMs...',
  '.........ssSSSLs...',
  '..........sssSs....',
  '...........sss.....'
];
const HEAD_HURT_ROWS = {
  7: '.HHHHHHFSBBBBSBBS..',
  8: '.HHHdSSdSsBBBBSBs..',
  10: '.HHdddSdsSdddsLdSS.',
  15: '.....sssSSSSdEEEs..'
};
const LEGEND = {
  G: ['hair', 1], H: ['hair', 2], h: ['hair', 3], F: ['fade', 2], f: ['fade', 1],
  S: ['skin', 2], s: ['skin', 1], L: ['skin', 3], d: ['skin', 0],
  W: ['eyeW', 2], E: ['eye', 2], B: ['brow', 2], M: ['stache', 2], m: ['stache', 3], R: ['lip', 2]
};
function stampHead(buf, id, ox, oy, hurt) {
  for (let r = 0; r < HEAD.length; r++) {
    const row = (hurt && HEAD_HURT_ROWS[r]) || HEAD[r];
    for (let c = 0; c < row.length; c++) {
      const e = LEGEND[row[c]];
      if (e) buf.set(id, ox + c, oy + r, e[0], e[1]);
    }
  }
}

// ---------------------------------------------------------------- pose rigs
// All coords for facing right. Fists are relative to neck base N unless fistAbsN.
function rig(pose, f) {
  const R = {
    W: [CX - 1, 62], lean: 2, head: [0, 0], hurt: false,
    ankN: [CX - 17, 116], ankF: [CX + 16, 116], bootN: 0, bootF: 0,
    fistN: [-3, 15], fistF: [23, 9], shN: [0, 0], shF: [0, 0],
    kick: false, punch: false
  };
  if (pose === 'idle') {
    if (f === 1) R.W = [CX - 1, 63];
  } else if (pose === 'walk') {
    R.lean = 3;
    Object.assign(R, [
      { W: [CX, 63], ankN: [CX - 19, 116], ankF: [CX + 18, 116], fistN: [0, 14], fistF: [21, 10] },
      { W: [CX, 61], ankN: [CX - 3, 111], ankF: [CX + 3, 116], fistN: [-3, 15], fistF: [23, 9], bootN: 18 },
      { W: [CX, 63], ankN: [CX + 17, 116], ankF: [CX - 18, 116], fistN: [-6, 16], fistF: [26, 8] },
      { W: [CX, 61], ankN: [CX + 3, 116], ankF: [CX - 3, 111], fistN: [-3, 15], fistF: [23, 9], bootF: 18 }
    ][f % 4]);
  } else if (pose === 'punch') {
    R.punch = f === 1;
    if (f === 0) {
      Object.assign(R, { W: [CX - 2, 63], lean: -1, ankN: [CX - 18, 116], ankF: [CX + 15, 116], fistN: [-6, 9], shN: [-2, 0], fistF: [23, 7] });
    } else {
      Object.assign(R, { W: [CX + 2, 63], lean: 6, ankN: [CX - 21, 116], ankF: [CX + 19, 116], shN: [16, -2], fistAbsN: [CX + 54, 41], fistF: [15, 3], shF: [-4, 0] });
    }
  } else if (pose === 'kick') {
    R.kick = true;
    if (f === 0) {
      Object.assign(R, { W: [CX - 2, 62], lean: -2, ankF: [CX + 1, 116], ankN: [CX + 11, 97], bootN: 30, fistN: [0, 12], fistF: [21, 7] });
    } else {
      Object.assign(R, { W: [CX - 5, 62], lean: -5, ankF: [CX - 2, 116], ankN: [CX + 41, 76], bootN: -78, fistN: [-5, 13], fistF: [19, 6] });
    }
  } else if (pose === 'hurt') {
    Object.assign(R, { W: [CX - 3, 64], lean: -7, head: [-2, -1], hurt: true, ankN: [CX - 16, 116], ankF: [CX + 13, 116], fistN: [-15, 21], fistF: [17, -1], shF: [-1, -1] });
  }
  return R;
}

// ---------------------------------------------------------------- the renderer
const THIGH = 26.5, SHIN = 26.5, UPPER = 18, FORE = 17;

function renderInto(buf, pose, f) {
  const R = rig(pose, f);
  const [wx, wy] = R.W;
  const lean = R.lean;
  // Torso-local transform: origin = neck base N, y down to the waist at 34 (sheared by lean).
  const T = (lx, ly) => [wx + lx + lean * (1 - ly / 34), wy - 34 + ly];
  const N = T(0, 0);
  const shoulderN = T(-15 + R.shN[0], 6 + R.shN[1]);
  const shoulderF = T(14 + R.shF[0], 6 + R.shF[1]);
  const hipN = [wx - 6, wy + 5], hipF = [wx + 6, wy + 5];

  const drawArm = (sh, fist, pref, g, bias) => {
    const { mid: el, end: fi } = ik(sh, fist, UPPER, FORE, pref);
    const idU = buf.begin(g + 'skin');
    capsule(buf, idU, sh, el, 4.1, 3.7, 'skin', { bias });
    const idF = buf.begin(g + 'skin');
    capsule(buf, idF, el, fi, 3.9, 3.2, 'skin', { bias });
    const sEnd = [sh[0] + (el[0] - sh[0]) * 0.62, sh[1] + (el[1] - sh[1]) * 0.62];
    const idS = buf.begin(g + 'sleeve');
    const sl = capsule(buf, idS, sh, sEnd, 5.4, 4.7, 'shirt', {
      bias, shade: (t, s, tone) => (t > 0.82 ? Math.min(tone, 1) : tone)
    });
    const idH = buf.begin(g + 'fist');
    ellipse(buf, idH, fi, 4.5, 4.1, 'skin', bias);
    return { el, fi, idU, idF, idS, idH, sl, sEnd };
  };

  const BOOT = [[-4.5, -4], [4.5, -4], [4.8, 1], [8.5, 2.8], [10.8, 5], [11, 10], [-5.2, 10], [-5.4, 6], [-5, 2]];
  const drawLeg = (hip, ank, bootAng, grp, rip, kneePref = [1, -0.15]) => {
    const { mid: kn, end: an } = ik(hip, ank, THIGH, SHIN, kneePref);
    const idT = buf.begin(grp);
    capsule(buf, idT, hip, kn, 6.0, 4.9, 'jeans');
    const idS = buf.begin(grp);
    const sh = capsule(buf, idS, kn, an, 4.9, 4.6, 'jeans');
    const idB = buf.begin(grp + 'boot');
    const rad = (bootAng * Math.PI) / 180, ca = Math.cos(rad), sa = Math.sin(rad);
    const toLocal = (x, y) => { const dx = x - an[0], dy = y - an[1]; return [dx * ca + dy * sa, -dx * sa + dy * ca]; };
    buf.fill(idB, [an[0] - 13, an[1] - 13, an[0] + 13, an[1] + 13], (x, y) => {
      const [lx, ly] = toLocal(x, y); return pointInPoly(lx, ly, BOOT);
    }, (x, y) => {
      const [lx, ly] = toLocal(x, y);
      if (ly >= 8) return ['sole', lx < -1 ? 1 : 2];
      const u = (lx - 3) / 9, v = (ly - 2) / 8;
      const nx = u * ca - v * sa, ny = u * sa + v * ca;
      return ['boot', toneFor(nx, ny, Math.sqrt(Math.max(0, 1 - u * u - v * v)))];
    });
    const cA = [an[0] - sh.dir[0] * 6.5, an[1] - sh.dir[1] * 6.5];
    const cB = [an[0] + sh.dir[0] * 0.5, an[1] + sh.dir[1] * 0.5];
    const idC = buf.begin(grp + 'cuff');
    capsule(buf, idC, cA, cB, 5.5, 5.6, 'cuff', { capEnds: false });
    return { kn, an, idT, idS, idB, idC, cA, cB, ca, sa, rip, hip };
  };

  // ---- draw order (back to front)
  const armF = drawArm(shoulderF, [N[0] + R.fistF[0], N[1] + R.fistF[1]], [0.5, 1], 'armF', -0.05);
  const legF = drawLeg(hipF, R.ankF, R.bootF, 'legF', false);
  let legN = null;
  if (!R.kick) legN = drawLeg(hipN, R.ankN, R.bootN, 'legN', true, R.ankN[0] < hipN[0] - 4 ? [-1, -0.1] : [1, -0.15]);

  const idP = buf.begin('pelvis');
  const pelvis = [T(-12.5, 32), T(12, 32), [wx + 12.5, wy + 7], [wx + 5, wy + 10], [wx + 1, wy + 13], [wx - 4, wy + 10], [wx - 12.5, wy + 7]];
  polyShaded(buf, idP, pelvis, 'jeans', [wx + 2, wy + 2], 16, 12);

  const idTo = buf.begin('torso');
  const TORSO = [[-6, -1], [5, -1], [12, 0], [16, 3], [17, 7], [15.5, 15], [13.5, 24], [12.5, 34.5], [-13, 34.5], [-14.5, 24], [-16.5, 15], [-19, 7], [-18, 3], [-13, 0]].map((p) => T(...p));
  polyShaded(buf, idTo, TORSO, 'shirt', T(2, 11), 20, 25);

  const idCb = buf.begin('collarB');
  const CB = [[-8, -4], [7, -4], [7.5, 0], [-8.5, 0]].map((p) => T(...p));
  polyShaded(buf, idCb, CB, 'shirt', T(0, -6), 14, 8, -0.1);

  const idNk = buf.begin('neck');
  const NECK = [[-5, -9], [4.5, -9], [5, 0], [2.5, 7.5], [0, 7.5], [-5.5, 0]].map((p) => T(...p));
  buf.fill(idNk, bbox(NECK, 1), (x, y) => pointInPoly(x, y, NECK), (x, y) => {
    const lx = x - N[0];
    const ly = y - N[1];
    if (ly < -2) return lx < 2.5 ? ['skinLine', 1] : ['skin', 1]; // under-jaw shadow
    return ['skin', lx < -1.5 ? 1 : lx > 2.5 ? 3 : 2];
  });

  const idHd = buf.begin('head');
  const hx = Math.round(N[0] - 8 + R.head[0]), hy = Math.round(N[1] - 24 + R.head[1]);
  stampHead(buf, idHd, hx, hy, R.hurt);

  const idCf = buf.begin('collarF');
  const FLAPN = [[-7, -3], [-4.5, -0.5], [-0.5, 8], [-5, 6.5], [-10.5, 1.5]].map((p) => T(...p));
  polyShaded(buf, idCf, FLAPN, 'shirt', T(-4, 0), 10, 10, 0.08);
  const idCf2 = buf.begin('collarF2');
  const FLAPF = [[6, -3], [4.5, -0.5], [2.5, 8], [6.5, 5.5], [9.5, 1]].map((p) => T(...p));
  polyShaded(buf, idCf2, FLAPF, 'shirt', T(6, 0), 10, 10, 0.1);

  const idBe = buf.begin('belt');
  const BELT = [T(-13.5, 31), T(13, 31), [wx + 13.4, wy + 2.5], [wx - 14, wy + 2.5]];
  buf.fill(idBe, bbox(BELT, 1), (x, y) => pointInPoly(x, y, BELT), (x, y) => ['belt', y < wy - 1.8 ? 3 : x < wx - 6 ? 1 : 2]);
  const idBk = buf.begin('buckle');
  const bk = T(1.5, 31).map(Math.round);
  buf.fill(idBk, [bk[0] - 1, bk[1] - 1, bk[0] + 6, bk[1] + 6], (x, y) => x >= bk[0] && x < bk[0] + 5 && y >= bk[1] && y < bk[1] + 5, (x, y) => {
    const lx = Math.floor(x - bk[0]), ly = Math.floor(y - bk[1]);
    if (lx >= 1 && lx <= 3 && ly >= 1 && ly <= 3) return lx === 2 ? ['gold', 1] : ['belt', 1];
    return ['gold', (lx === 4 || ly === 0) ? 3 : lx === 0 ? 1 : 2];
  });

  if (R.kick) legN = drawLeg(hipN, R.ankN, R.bootN, 'legK', true);

  const armN = drawArm(shoulderN, R.fistAbsN || [N[0] + R.fistN[0], N[1] + R.fistN[1]], [-0.55, 1], 'armN', 0);

  // ---- part separation lines
  buf.finishLines();

  // ---- details (only where the owning part is visible)
  for (let ly = 8; ly <= 33; ly++) { const p = T(0, ly); buf.dot(idTo, p[0] - 1, p[1], 'shirt', 1); }
  for (const ly of [11, 17, 23, 29]) {
    const p = T(0.5, ly);
    buf.dot(idTo, p[0], p[1], 'button', 1);
    buf.dot(idTo, p[0] + 1, p[1], 'button', 2);
  }
  { // chest pocket (far side)
    const q0 = T(5, 10), q1 = T(5, 16), q2 = T(11, 16), q3 = T(11, 10);
    buf.lineD(idTo, q0[0], q0[1], q3[0], q3[1], 'shirt', 1);
    buf.lineD(idTo, q0[0], q0[1], q1[0], q1[1], 'shirt', 1);
    buf.lineD(idTo, q1[0], q1[1], q2[0], q2[1], 'shirt', 1);
    buf.lineD(idTo, q2[0], q2[1], q3[0], q3[1], 'shirt', 1);
    const r0 = T(6, 11), r1 = T(10, 11);
    buf.lineD(idTo, r0[0], r0[1], r1[0], r1[1], 'shirt', 3);
  }
  const fold = (a, b, tone = 1) => { const p = T(...a), q = T(...b); buf.lineD(idTo, p[0], p[1], q[0], q[1], 'shirt', tone); };
  fold([-14, 15], [-8, 24]);
  fold([-12, 19], [-6, 27]);
  fold([13, 16], [9, 22]);
  fold([-9, 30], [-9, 33]); fold([-4, 29], [-4, 33]); fold([6, 30], [6, 33]); fold([10, 29], [10, 33]);
  fold([-3, 30], [-3, 33], 3); fold([7, 30], [7, 33], 3);
  fold([-17, 5], [-12, 2], 3); fold([12, 1], [15, 4], 3);

  for (const lx of [-9, 8]) { const p = T(lx, 31); for (let k = 1; k <= 3; k++) buf.dot(idBe, p[0], p[1] + k, 'belt', 0); }

  { const a = T(1, 34.5); buf.lineD(idP, a[0], a[1] + 1, wx + 1, wy + 10, 'jeans', 1); }
  buf.lineD(idP, wx - 11, wy + 3, wx - 6, wy + 6, 'jeans', 3);
  buf.lineD(idP, wx + 11, wy + 3, wx + 7, wy + 6, 'jeans', 3);

  const legDetail = (lg) => {
    if (!lg) return;
    const { kn, an, hip } = lg;
    const seam = (a, b, id) => {
      const dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy);
      const px = -dy / len, py = dx / len, off = -3.4;
      for (let t = 0.12; t <= 0.9; t += 1 / len) buf.dot(id, a[0] + dx * t + px * off, a[1] + dy * t + py * off, 'jeans', 1);
    };
    seam(hip, kn, lg.idT);
    seam(kn, an, lg.idS);
    const kdx = kn[0] - hip[0], kdy = kn[1] - hip[1], kl = Math.hypot(kdx, kdy);
    const ux = kdx / kl, uy = kdy / kl, px = -uy;
    for (const k of [-1, 1]) buf.dot(lg.idS, kn[0] - px * 2 + ux * k, kn[1] + 2 + uy * k, 'jeans', 1);
    buf.dot(lg.idT, kn[0] + 2, kn[1] - 3, 'jeans', 3);
    buf.dot(lg.idT, kn[0] + 3, kn[1] - 2, 'jeans', 3);
    buf.lineD(lg.idT, hip[0] + ux * 9 - 1, hip[1] + uy * 9, hip[0] + ux * 9 + 3, hip[1] + uy * 9 - 1, 'jeans', 1);
    if (lg.rip) {
      const rx = Math.round(kn[0]), ry = Math.round(kn[1] + 1);
      for (const [dx, dy, m, t] of [[-1, 0, 'rip', 2], [0, 0, 'rip', 3], [1, 0, 'rip', 2], [2, 0, 'rip', 1],
        [-1, 1, 'skin', 1], [0, 1, 'skin', 2], [1, 1, 'skin', 2], [0, 2, 'rip', 2], [1, 2, 'rip', 1], [-1, 2, 'rip', 1]]) {
        buf.dot(lg.idS, rx + dx, ry + dy, m, t);
        buf.dot(lg.idT, rx + dx, ry + dy, m, t);
      }
    }
    { const m = [(lg.cA[0] + lg.cB[0]) / 2, (lg.cA[1] + lg.cB[1]) / 2];
      const dx = lg.cB[0] - lg.cA[0], dy = lg.cB[1] - lg.cA[1], l = Math.hypot(dx, dy), qx = -dy / l, qy = dx / l;
      buf.lineD(lg.idC, m[0] - qx * 5, m[1] - qy * 5, m[0] + qx * 5, m[1] + qy * 5, 'cuff', 1); }
    const toS = (lx, ly) => [an[0] + lx * lg.ca - ly * lg.sa, an[1] + lx * lg.sa + ly * lg.ca];
    for (const [lx, ly] of [[2, -2], [3, 0], [5, 2]]) { const p = toS(lx, ly); buf.dot(lg.idB, p[0], p[1], 'boot', 0); }
    for (const [lx, ly] of [[8, 4], [9, 5]]) { const p = toS(lx, ly); buf.dot(lg.idB, p[0], p[1], 'boot', 3); }
    for (let lx = -5; lx <= 10; lx++) { const p = toS(lx, 7.5); buf.dot(lg.idB, p[0], p[1], 'boot', 0); }
  };
  legDetail(legF);
  legDetail(legN);

  const armDetail = (arm) => {
    const { fi, el, idH } = arm;
    const dx = fi[0] - el[0], dy = fi[1] - el[1], l = Math.hypot(dx, dy) || 1;
    const ux = dx / l, uy = dy / l;
    const kx = fi[0] + ux * 2, ky = fi[1] + uy * 2;
    buf.lineD(idH, kx - uy * 2, ky + ux * 2, kx + uy * 2, ky - ux * 2, 'skin', 1);
    buf.dot(idH, fi[0] - uy * 1.5 + 1, fi[1] - 1, 'skin', 3);
    buf.dot(idH, fi[0] - 1, fi[1] + 1, 'skin', 0);
    buf.dot(idH, fi[0] + 1, fi[1] + 1, 'skin', 0);
    const s = arm.sEnd, sh = arm.sl;
    buf.lineD(arm.idS, s[0] - sh.pxv * 4, s[1] - sh.pyv * 4 - 1, s[0] + sh.pxv * 4, s[1] + sh.pyv * 4 - 1, 'shirt', 1);
    buf.lineD(arm.idF, el[0] + ux * 3 + uy * 1.2, el[1] + uy * 3 - ux * 1.2, el[0] + ux * 7 + uy * 1.2, el[1] + uy * 7 - ux * 1.2, 'skin', 1);
  };
  armDetail(armF);
  armDetail(armN);

  buf.outline();
}

/** Raw RGBA render (works without a DOM — handy for tooling). */
export function renderHeroRGBA(pose, frameIdx, outfitId, outfit) {
  const p = HERO_POSES[pose] ? pose : (pose === 'chase' ? 'walk' : 'idle');
  const buf = new PixBuf(buildMats(outfitId, outfit));
  renderInto(buf, p, frameIdx % HERO_POSES[p]);
  return { width: FW, height: FH, data: buf.rgba() };
}

/** Pick a frame index from a time value. For punch/kick pass time since the pose began. */
export function heroFrameIndex(pose, t) {
  t = Math.max(0, t || 0);
  switch (pose) {
    case 'walk': case 'chase': return Math.floor(t * 8) % 4;
    case 'punch': case 'kick': return Math.min(1, Math.floor(t * 12));
    case 'hurt': return 0;
    default: return Math.floor(t * 2) % 2;
  }
}

const heroCache = new Map();

export function getHeroFrame(pose, outfitId, outfit, animT) {
  const p = HERO_POSES[pose] ? pose : (pose === 'chase' ? 'walk' : 'idle');
  const fi = heroFrameIndex(p, animT);
  const key = `${p}|${fi}|${outfitId || 'polo'}`;
  const hit = heroCache.get(key);
  if (hit) return hit;
  const { width, height, data } = renderHeroRGBA(p, fi, outfitId, outfit);
  const c = document.createElement('canvas');
  c.width = width; c.height = height;
  const cx = c.getContext('2d');
  cx.imageSmoothingEnabled = false;
  cx.putImageData(new ImageData(data, width, height), 0, 0);
  heroCache.set(key, c);
  return c;
}

/** Draw a hero frame with feet at (x, feetY); flipped around x when facing < 0. */
export function drawHero(ctx, frame, x, feetY, facing, drawH = HERO_DRAW_H) {
  if (!frame) return;
  const s = drawH / FH;
  const dw = FW * s, dh = FH * s;
  const rx = Math.round(x), top = Math.round(Math.round(feetY) - HERO_FEET_Y * s);
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  if (facing < 0) {
    ctx.translate(rx, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(frame, Math.round(-CX * s), top, dw, dh);
  } else {
    ctx.drawImage(frame, Math.round(rx - CX * s), top, dw, dh);
  }
  ctx.restore();
}

export function clearHeroCache() { heroCache.clear(); }
