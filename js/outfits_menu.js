/**
 * Star City Drift — visual outfit picker (pause menu → Outfits). Game-logic lane.
 *
 * A grid of cards, one per outfit, each with a live animated Matthew in that outfit
 * (Sprites.getAnimFrame('matthew', 'idle_signature', t, outfit) → static sheet fallback), plus a
 * large preview of the focused card (idle → victory loop) with its description. Locked outfits are
 * dark silhouettes with a lock and the unlock hint, and refuse to equip (denied blip).
 *
 * The DOM is built here and mounted next to #pause-screen; styling is the marked block in style.css.
 * Equipping goes through main.js setOutfit() — the same path as keys 1-9/0/-/= and L1/R1 cycling.
 * Outfits with their own bust (Sprites.getOutfitPortrait, e.g. Hell's Nightmare's helmet) show it as a
 * badge on the large preview once unlocked.
 * The preview animation runs on its own requestAnimationFrame only while the picker is open.
 * 1.4.0: the large preview also plays the outfit's signature move (special) and shows its kit — weapon
 * icon (Sprites.getWeaponIcon), move name and a one-line ability (kits.js).
 */
import { OUTFITS, OUTFIT_ORDER, OUTFIT_HOTKEYS } from './npcs.js';
import * as Sprites from './sprites.js';
import { sfx } from './audio.js';
import { getKit } from './kits.js';

const TILE_W = 120, TILE_H = 150, BIG_W = 240, BIG_H = 300;
const BIG_STATES = ['idle_signature', 'special', 'victory']; // 1.4.0: signature move in the middle
const HOLD_MS = 650; // pause on the last frame of a one-shot before looping
const LOOP_SHOW_MS = 2600; // big preview: how long a looping state plays before moving on

/**
 * opts: {
 *   state(): { unlocked:Set, current:string, stateBag },
 *   equip(id),            // apply + save + outfit sound (main.js setOutfit)
 *   onClose(),            // back to the pause menu
 *   areaName(id): string  // for unlock hints
 * }
 */
export function createOutfitsMenu(opts) {
  const $ = (id) => document.getElementById(id);
  const host = ($('pause-screen') && $('pause-screen').parentNode) || document.body;
  const root = document.createElement('div');
  root.id = 'outfit-screen';
  root.className = 'overlay hidden';
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-label', 'Choose an outfit');
  root.innerHTML = `
    <div class="overlay-card outfit-panel">
      <div class="outfit-head"><h2>Outfits</h2><span class="outfit-count" id="outfit-picker-count"></span></div>
      <div class="outfit-body">
        <div class="outfit-feature">
          <canvas class="outfit-big" width="${BIG_W}" height="${BIG_H}" aria-hidden="true"></canvas>
          <img class="of-portrait hidden" id="outfit-picker-portrait" alt="" aria-hidden="true" />
          <div class="of-name" id="outfit-picker-name"></div>
          <div class="of-desc" id="outfit-picker-desc"></div>
          <div class="of-kit" id="outfit-picker-kit">
            <canvas id="outfit-picker-weapon-icon" width="48" height="48" aria-hidden="true"></canvas>
            <div class="of-kit-text"><span class="of-move" id="outfit-picker-move"></span><span class="of-weapon-name" id="outfit-picker-weapon"></span><span class="of-ability" id="outfit-picker-ability"></span></div>
          </div>
          <button type="button" class="btn" id="btn-outfit-equip">Equip</button>
        </div>
        <div class="outfit-grid" role="listbox" aria-label="Outfits">
          ${OUTFIT_ORDER.map((id) => `<button type="button" class="outfit-tile" role="option" data-outfit="${id}">
            <canvas width="${TILE_W}" height="${TILE_H}" aria-hidden="true"></canvas>
            <span class="ot-name">${OUTFITS[id].name}</span><span class="ot-lock" aria-hidden="true">🔒</span><span class="ot-on">EQUIPPED</span></button>`).join('')}
        </div>
      </div>
      <div class="outfit-foot"><span class="outfit-help" id="outfit-picker-help"></span><button type="button" class="btn btn-secondary" id="btn-outfit-back">Back</button></div>
    </div>`;
  host.appendChild(root);

  const tiles = [...root.querySelectorAll('.outfit-tile')];
  const big = root.querySelector('.outfit-big');
  const bigCtx = big.getContext('2d');
  const tileCtx = tiles.map((t) => t.querySelector('canvas').getContext('2d'));
  let open = false, idx = 0, raf = 0, last = 0, openedAt = 0;
  const clocks = OUTFIT_ORDER.map(() => ({ start: 0, doneAt: 0 }));
  const bigClock = { start: 0, doneAt: 0, state: 0 };
  const lockedDrawn = new Set();

  const S = () => opts.state();
  const isUnlocked = (id) => { const u = S().unlocked; return !!(u && u.has(id)); };

  /** Where to get it, from the existing unlock data (collectibles / Gold Star rules). */
  function hintFor(id) {
    if (id === 'polo') return 'Starter outfit.';
    if (id === 'gold') return 'Unlock: finish 100% (every mission + collectible) or beat Silas on Hard / Arcade.';
    const bag = S().stateBag || {};
    const c = (bag.collectibles || []).find((k) => k.outfit === id);
    if (!c) return 'Unlock: keep exploring Star City.';
    const home = c.home || String(c.area || '').replace(/^hidden:/, '');
    if (c.hint) return c.spotted && !c.taken ? `Unlock: you've spotted the ${c.name} in the ${opts.areaName ? opts.areaName(home) : home}. Go grab it!` : c.hint;
    let h = `Unlock: find the ${c.name} — ${opts.areaName ? opts.areaName(home) : home}.`;
    const m = c.reveal && bag.missions && bag.missions[c.reveal];
    if (m && !m.done) h += ` Appears after "${m.title}".`;
    return h;
  }

  // ---------- drawing ----------
  /** Draw Matthew in `id` into a canvas: anim frame (anchorX/feetRow) or the static sheet frame. */
  function drawOutfit(ctx, W, H, id, state, tMs, locked) {
    ctx.clearRect(0, 0, W, H);
    ctx.imageSmoothingEnabled = false;
    const feetY = H - 8;
    // floor glow / shadow
    ctx.fillStyle = locked ? 'rgba(0,0,0,0.35)' : 'rgba(255,200,90,0.18)';
    ctx.beginPath(); ctx.ellipse(W / 2, feetY, W * 0.28, 6, 0, 0, Math.PI * 2); ctx.fill();
    let f = null, done = false;
    try { f = Sprites.getAnimFrame && Sprites.getAnimFrame('matthew', state, tMs, id); } catch (_) { f = null; }
    if (!f && state !== 'idle') { try { f = Sprites.getAnimFrame && Sprites.getAnimFrame('matthew', 'idle', tMs, id); } catch (_) { f = null; } }
    ctx.save();
    if (f) {
      done = !!f.done;
      let k = (H * 0.86) / 192;
      const ax = f.anchorX != null ? f.anchorX : f.sw / 2, feet = f.feetRow != null ? f.feetRow : f.sh - 3;
      let cx = W / 2;
      if (f.sw > 144) { // wide kit cell (240 px, 48 px empty on the left): fit the reach inside the canvas
        const padL = Math.max(0, ax - 72);
        k = Math.min(k, W / (f.sw - padL));
        cx = (ax - padL) * k;
      }
      ctx.drawImage(f.img, f.sx, f.sy, f.sw, f.sh, Math.round(cx - ax * k), Math.round(feetY - feet * k), Math.round(f.sw * k), Math.round(f.sh * k));
    } else {
      const spr = Sprites.getMatthewSprite && Sprites.getMatthewSprite('idle', id, OUTFITS[id], tMs / 1000);
      if (spr) { const dh = H * 0.86, dw = dh * (spr.width / spr.height); ctx.drawImage(spr, Math.round(W / 2 - dw / 2), Math.round(feetY - dh), Math.round(dw), Math.round(dh)); }
    }
    if (!locked && id !== 'polo' && Sprites.hasAnims && !Sprites.hasAnims('matthew', id) && OUTFITS[id] && OUTFITS[id].shirt) {
      // outfit art not in yet (polo frames): wash them in the outfit's colours so the card still reads
      ctx.globalCompositeOperation = 'source-atop';
      ctx.globalAlpha = 0.5; ctx.fillStyle = OUTFITS[id].shirt; ctx.fillRect(0, 0, W, H);
      ctx.globalAlpha = 0.35; ctx.fillStyle = OUTFITS[id].accent || OUTFITS[id].shirt; ctx.fillRect(0, 0, W, H * 0.3);
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    }
    if (locked) { // dark silhouette with a faint cool rim
      ctx.globalCompositeOperation = 'source-atop';
      const g = ctx.createLinearGradient(0, 0, W, 0);
      g.addColorStop(0, '#3a4a6a'); g.addColorStop(0.18, '#0a0c14'); g.addColorStop(1, '#0a0c14');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    }
    ctx.restore();
    return done;
  }
  function step(clock, done, now) {
    if (done) { if (!clock.doneAt) clock.doneAt = now; else if (now - clock.doneAt > HOLD_MS) { clock.start = now; clock.doneAt = 0; return true; } }
    return false;
  }
  function render(now) {
    raf = 0;
    if (!open) return;
    raf = requestAnimationFrame(render);
    if (document.hidden || now - last < 33) return; // ~30 fps is plenty for previews
    last = now;
    OUTFIT_ORDER.forEach((id, i) => {
      const locked = !isUnlocked(id);
      if (locked) { // static silhouette: draw once
        if (!lockedDrawn.has(id)) { drawOutfit(tileCtx[i], TILE_W, TILE_H, id, 'idle_signature', 0, true); lockedDrawn.add(id); }
        return;
      }
      lockedDrawn.delete(id);
      const c = clocks[i];
      step(c, drawOutfit(tileCtx[i], TILE_W, TILE_H, id, 'idle_signature', now - c.start + i * 37, false), now);
    });
    const id = OUTFIT_ORDER[idx], locked = !isUnlocked(id);
    if (kitDrawn !== id) drawWeapon(id); // icons can finish loading after the picker opened
    const st = locked ? 'idle_signature' : BIG_STATES[bigClock.state];
    const done = drawOutfit(bigCtx, BIG_W, BIG_H, id, st, locked ? 0 : now - bigClock.start, locked);
    const elapsed = now - bigClock.start;
    if (!locked && step(bigClock, done || elapsed > LOOP_SHOW_MS + 600 * bigClock.state, now)) bigClock.state = (bigClock.state + 1) % BIG_STATES.length;
  }

  // ---------- state / UI ----------
  function refresh() {
    const { current } = S();
    const n = OUTFIT_ORDER.filter(isUnlocked).length;
    $('outfit-picker-count').textContent = `${n}/${OUTFIT_ORDER.length} unlocked`;
    tiles.forEach((t, i) => {
      const id = OUTFIT_ORDER[i], locked = !isUnlocked(id);
      t.classList.toggle('locked', locked);
      t.classList.toggle('equipped', id === current);
      t.classList.toggle('focused', i === idx);
      t.setAttribute('aria-selected', String(i === idx));
      t.setAttribute('aria-label', `${OUTFITS[id].name}${locked ? ' (locked)' : id === current ? ' (equipped)' : ''}`);
    });
    const id = OUTFIT_ORDER[idx], locked = !isUnlocked(id);
    $('outfit-picker-name').textContent = locked ? `🔒 ${OUTFITS[id].name}` : OUTFITS[id].name;
    $('outfit-picker-desc').textContent = locked ? hintFor(id) : OUTFITS[id].desc || '';
    root.querySelector('.outfit-feature').classList.toggle('locked', locked);
    syncPortrait(id, locked);
    syncKit(id);
    const eb = $('btn-outfit-equip');
    eb.textContent = locked ? 'Locked' : id === current ? 'Equipped ✓' : 'Equip';
    eb.classList.toggle('disabled', locked || id === current);
    eb.setAttribute('aria-disabled', String(locked));
  }
  /** 1.4.0: kit row under the description — weapon icon, move name, weapon name, one-line ability. */
  let kitDrawn = '';
  function syncKit(id) {
    const kit = getKit(id);
    $('outfit-picker-move').textContent = kit.move;
    $('outfit-picker-weapon').textContent = kit.weapon;
    $('outfit-picker-ability').textContent = kit.ability;
    $('outfit-picker-kit').setAttribute('aria-label', `${kit.weapon}: ${kit.move} — ${kit.ability}`);
    drawWeapon(id);
  }
  function drawWeapon(id) {
    if (kitDrawn === id) return;
    const c = $('outfit-picker-weapon-icon'), g = c.getContext('2d');
    g.clearRect(0, 0, c.width, c.height); g.imageSmoothingEnabled = false;
    let icon = null;
    try { icon = Sprites.getWeaponIcon && Sprites.getWeaponIcon(id); } catch (_) { icon = null; }
    if (icon) { g.drawImage(icon.img, icon.sx, icon.sy, icon.sw, icon.sh, 0, 0, c.width, c.height); kitDrawn = id; }
    else { g.fillStyle = '#ffd24a'; g.font = 'bold 30px sans-serif'; g.textAlign = 'center'; g.fillText('★', 24, 35); kitDrawn = ''; }
  }
  /** Outfit bust badge (only for outfits that have their own portrait, e.g. Hell's Nightmare). */
  function syncPortrait(id, locked) {
    const el = $('outfit-picker-portrait');
    let src = '';
    try {
      const own = Sprites.getOutfitPortrait && Sprites.getOutfitPortrait(id), base = Sprites.getOutfitPortrait && Sprites.getOutfitPortrait('polo');
      if (!locked && own && own !== base && own.src) src = own.src;
    } catch (_) { src = ''; }
    if (src && el.getAttribute('src') !== src) el.setAttribute('src', src);
    el.classList.toggle('hidden', !src);
  }
  function setHelp(dev) {
    $('outfit-picker-help').textContent = dev === 'touch' ? 'Tap a card, tap again to equip'
      : dev === 'keyboard' ? '←↑↓→ choose · Enter / Z equip · Esc back'
      : dev === 'ps' ? 'D-pad choose · ✕ equip · ○ back · L1/R1 flip' : 'D-pad choose · A equip · B back · LB/RB flip';
  }
  function focus(i, sound = true) {
    const n = tiles.length;
    const j = ((i % n) + n) % n;
    if (j !== idx) { idx = j; bigClock.start = performance.now(); bigClock.doneAt = 0; bigClock.state = 0; if (sound) sfx('ui_move'); }
    refresh();
    const t = tiles[idx];
    try { t.focus({ preventScroll: true }); } catch (_) { /* old browsers */ }
    if (t.scrollIntoView) t.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }
  function equip() {
    const id = OUTFIT_ORDER[idx];
    if (!isUnlocked(id)) {
      sfx('denied');
      root.classList.remove('shake'); void root.offsetWidth; root.classList.add('shake');
      return false;
    }
    if (id === S().current) { sfx('ui_select'); return true; }
    opts.equip(id); // setOutfit: applies, saves, plays the outfit-switch sound, toasts
    refresh();
    return true;
  }
  function columns() {
    const top = tiles[0].offsetTop;
    let c = 0; for (const t of tiles) { if (t.offsetTop !== top) break; c++; }
    return Math.max(1, c);
  }
  function close(silent = false) {
    if (!open) return;
    open = false;
    root.classList.add('hidden');
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    if (!silent) { sfx('ui_back'); opts.onClose && opts.onClose(); }
  }

  // pointer / touch: tap focuses, tapping the focused card (or Equip) equips
  let lastTouch = -1e9;
  const onTap = (el, fn) => {
    el.addEventListener('touchend', (e) => {
      const t = e.changedTouches && e.changedTouches[0];
      if (t) { const hit = document.elementFromPoint(t.clientX, t.clientY); if (hit && !el.contains(hit)) return; }
      lastTouch = performance.now();
      if (e.cancelable) e.preventDefault();
      fn(e);
    }, { passive: false });
    el.addEventListener('click', (e) => { if (performance.now() - lastTouch < 700) return; fn(e); });
  };
  tiles.forEach((t, i) => onTap(t, () => { if (i === idx) equip(); else focus(i); }));
  tiles.forEach((t, i) => t.addEventListener('mouseenter', () => { if (open && performance.now() - lastTouch > 700 && i !== idx) focus(i); }));
  onTap($('btn-outfit-equip'), () => equip());
  onTap($('btn-outfit-back'), () => close());
  // the grid is scrollable on small screens: let the finger scroll it
  root.querySelector('.outfit-grid').addEventListener('touchmove', (e) => e.stopPropagation(), { passive: true });

  return {
    el: root,
    isOpen: () => open,
    /** Open on the equipped outfit. */
    open(dev) {
      open = true; openedAt = performance.now();
      idx = Math.max(0, OUTFIT_ORDER.indexOf(S().current));
      lockedDrawn.clear();
      clocks.forEach((c) => { c.start = openedAt; c.doneAt = 0; });
      bigClock.start = openedAt; bigClock.doneAt = 0; bigClock.state = 0;
      setHelp(dev);
      root.classList.remove('hidden');
      focus(idx, false);
      if (!raf) raf = requestAnimationFrame(render);
    },
    close,
    refresh,
    /** Keyboard / gamepad input while open. Returns true (always consumes). */
    update(inp, dev) {
      if (!open) return false;
      if (dev) setHelp(dev);
      const cols = columns();
      if (inp.navLeft) focus(idx - 1);
      else if (inp.navRight) focus(idx + 1);
      else if (inp.navUp) focus(idx - cols >= 0 ? idx - cols : idx);
      else if (inp.navDown) focus(idx + cols < tiles.length ? idx + cols : (Math.floor(idx / cols) < Math.floor((tiles.length - 1) / cols) ? tiles.length - 1 : idx));
      if (inp.outfitCycle) focus(idx + inp.outfitCycle); // L1/R1 flip through cards
      if (inp.outfitKey) { const k = inp.outfitKey; focus(k in OUTFIT_HOTKEYS ? OUTFIT_HOTKEYS[k] : Number(k) - 1); } // 1-9/0/-/= jump to a card
      if (inp.confirmPressed || inp.punchPressed) equip();
      else if (inp.backPressed || inp.pausePressed || inp.kickPressed) close();
      return true;
    },
    get focusedId() { return OUTFIT_ORDER[idx]; }
  };
}
