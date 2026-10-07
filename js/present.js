/**
 * Present the 960×540 scene: closer-camera crop, filtered upscale (the AA
 * pass), a cheap highlight bloom, lens vignette, and fine grain.
 * One filtered blit — no per-pixel loops on the full frame.
 * HUD and other DOM UI are never drawn here, so the lens cannot move them.
 *
 * Phones and low-power screens use a smaller bloom, one blur, no grain, and
 * a 1× backing store. Desktop keeps a quarter-res bloom and a 2× backing store.
 */

function makeGrain(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d');
  const img = g.createImageData(w, h);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = 118 + ((Math.random() * 80) | 0);
    d[i] = d[i + 1] = d[i + 2] = n;
    d[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  return c;
}

/**
 * Phones and other small viewports, plus genuinely low-power devices.
 * A modest desktop CPU with a large window keeps the full present pass.
 */
export function cheapPresentation() {
  const w = window.innerWidth || 0;
  const h = window.innerHeight || 0;
  if ((w > 0 && w < 900) || (h > 0 && h < 520)) return true;
  const cores = navigator.hardwareConcurrency || 8;
  const mem = navigator.deviceMemory;
  const saveData = !!(navigator.connection && navigator.connection.saveData);
  const coarse = !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
  return cores <= 2 || (typeof mem === 'number' && mem <= 2) || saveData || (coarse && cores <= 4);
}

export function createPresenter(display, scene) {
  const bloom = document.createElement('canvas');
  const bloomCtx = bloom.getContext('2d');
  const scratch = document.createElement('canvas');
  const scratchCtx = scratch.getContext('2d');
  const grain = makeGrain(96, 96);
  bloom.width = 240;
  bloom.height = 135;
  scratch.width = 120;
  scratch.height = 68;
  // Pattern source must be a different canvas than the context that builds it.
  const grainPat = bloomCtx.createPattern(grain, 'repeat');
  let tier = '';

  function applyTier(low) {
    const next = low ? 'low' : 'high';
    if (next === tier) return low;
    tier = next;
    bloom.width = low ? 120 : 240;
    bloom.height = low ? 68 : 135;
    scratch.width = low ? 60 : 120;
    scratch.height = low ? 34 : 68;
    return low;
  }

  function backingSize(low) {
    const dpr = low ? 1 : Math.min(2, Math.max(1, window.devicePixelRatio || 1));
    const bw = Math.round(scene.width * dpr);
    const bh = Math.round(scene.height * dpr);
    if (display.width !== bw || display.height !== bh) {
      display.width = bw;
      display.height = bh;
    }
    return { bw, bh };
  }

  /** Keep only near-whites, then a bilinear down/up so the bloom has a soft edge. */
  function extractBloom(sx, sy, sw, sh, passes) {
    const bw = bloom.width;
    const bh = bloom.height;
    bloomCtx.setTransform(1, 0, 0, 1, 0, 0);
    bloomCtx.globalAlpha = 1;
    bloomCtx.globalCompositeOperation = 'source-over';
    bloomCtx.imageSmoothingEnabled = true;
    bloomCtx.imageSmoothingQuality = 'low';
    bloomCtx.drawImage(scene, sx, sy, sw, sh, 0, 0, bw, bh);
    bloomCtx.globalCompositeOperation = 'multiply';
    bloomCtx.drawImage(bloom, 0, 0);
    bloomCtx.drawImage(bloom, 0, 0);
    bloomCtx.drawImage(bloom, 0, 0);
    bloomCtx.globalCompositeOperation = 'source-over';
    scratchCtx.imageSmoothingEnabled = true;
    for (let i = 0; i < passes; i++) {
      scratchCtx.drawImage(bloom, 0, 0, scratch.width, scratch.height);
      bloomCtx.drawImage(scratch, 0, 0, bw, bh);
    }
  }

  function vignette(ctx, w, h) {
    const g = ctx.createRadialGradient(w * 0.5, h * 0.46, h * 0.32, w * 0.5, h * 0.5, w * 0.72);
    g.addColorStop(0, 'rgba(24,10,2,0)');
    g.addColorStop(0.72, 'rgba(18,8,2,0.08)');
    g.addColorStop(1, 'rgba(12,6,2,0.46)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }

  function grainPass(ctx, w, h) {
    if (!grainPat) return;
    const t = performance.now() / 1000;
    const ox = (t * 23) % 96;
    const oy = (t * 17) % 96;
    ctx.save();
    ctx.globalCompositeOperation = 'overlay';
    ctx.globalAlpha = 0.05;
    ctx.translate(ox, oy);
    ctx.fillStyle = grainPat;
    ctx.fillRect(-ox, -oy, w, h);
    ctx.restore();
  }

  /**
   * @param {object} opts
   *   mode 'world' crops the follow camera; 'full' blits the whole scene (title).
   *   cameraY, viewW, viewH — world-mode source rect in the scene buffer.
   */
  function present(opts) {
    const low = applyTier(cheapPresentation());
    const dctx = display.getContext('2d');
    const { bw, bh } = backingSize(low);
    const full = !opts || opts.mode !== 'world';
    const sx = 0;
    const sy = full ? 0 : opts.cameraY;
    const sw = full ? scene.width : opts.viewW;
    const sh = full ? scene.height : opts.viewH;

    dctx.setTransform(1, 0, 0, 1, 0, 0);
    dctx.globalAlpha = 1;
    dctx.globalCompositeOperation = 'source-over';
    dctx.imageSmoothingEnabled = true;
    dctx.imageSmoothingQuality = low ? 'low' : 'high';
    dctx.clearRect(0, 0, bw, bh);
    dctx.drawImage(scene, sx, sy, sw, sh, 0, 0, bw, bh);

    extractBloom(sx, sy, sw, sh, low ? 1 : 2);
    dctx.save();
    dctx.globalCompositeOperation = 'screen';
    dctx.globalAlpha = low ? 0.14 : 0.2;
    dctx.imageSmoothingEnabled = true;
    dctx.imageSmoothingQuality = 'low';
    dctx.drawImage(bloom, 0, 0, bw, bh);
    dctx.restore();

    if (!full) vignette(dctx, bw, bh);
    if (!low) grainPass(dctx, bw, bh);
  }

  return { present };
}
