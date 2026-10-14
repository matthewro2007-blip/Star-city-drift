/**
 * Streets of Roanoke — arcade attract / title menu (title screen lane).
 * Attract ("PRESS START") -> intro flash -> vertical menu (Continue / New Game / Controls / Credits).
 * Draws the animated golden-hour Roanoke backdrop; main.js draws Matthew on top via its hook.
 * The menu buttons themselves stay the original #btn-continue / #btn-start / #btn-new-game,
 * so main.js start / continue / confirm / save logic is untouched.
 */
import { getPromptLabel, getPromptDevice, getPromptSet } from './input.js';
import { unlockAudio, uiSound, mountAudioSettings } from './audio.js';
import { silasMoveRows } from './kits.js'; // DLC: Silas prequel moves on the Controls screen
import { getWeather } from './weather.js';

const $ = (id) => document.getElementById(id);
const reduceMQ = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
const reduced = () => !!(reduceMQ && reduceMQ.matches);
const lowPower = () => (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) || (navigator.hardwareConcurrency || 8) <= 4;

// ---------------- menu sounds: js/audio.js (one AudioContext for the whole game; unlocks on Press Start) ----------------
const blip = (kind) => uiSound(kind === 'select' ? 'select' : kind);

// ---------------- backdrop (pre-rendered layers, cheap per frame) ----------------
function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

function makeSkyline(w, h, seed, base, minH, maxH, color, winColor, winChance) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d'); const r = rng(seed);
  let x = 0;
  while (x < w) {
    const bw = 26 + r() * 54, bh = minH + r() * (maxH - minH);
    const top = base - bh;
    g.fillStyle = color; g.fillRect(x, top, bw, h - top);
    if (r() < 0.25) g.fillRect(x + bw * 0.4, top - 14 - r() * 18, 3, 30); // antenna
    if (r() < 0.2) { g.fillRect(x + 4, top - 8, bw - 8, 8); }            // stepped roof
    if (winChance > 0) {
      for (let wy = top + 8; wy < base - 6; wy += 11) for (let wx = x + 5; wx < x + bw - 6; wx += 9) {
        if (r() < winChance) { g.fillStyle = r() < 0.15 ? '#ffe9b0' : winColor; g.fillRect(wx, wy, 4, 5); }
      }
      g.fillStyle = color;
    }
    x += bw + r() * 6;
  }
  return c;
}

function makeMountain(w, h) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d');
  const grd = g.createLinearGradient(0, 150, 0, 330);
  grd.addColorStop(0, '#4a2f5a'); grd.addColorStop(1, '#2a1d3c');
  g.fillStyle = grd;
  g.beginPath(); g.moveTo(0, 330);
  g.bezierCurveTo(160, 300, 260, 200, 400, 190); // Mill Mountain shoulder (peak ~x 430)
  g.bezierCurveTo(470, 186, 520, 196, 600, 230);
  g.bezierCurveTo(720, 280, 840, 250, w, 280);
  g.lineTo(w, h); g.lineTo(0, h); g.closePath(); g.fill();
  return c;
}

function starPath(g, cx, cy, R, r) {
  g.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5, rad = i % 2 ? r : R;
    g.lineTo(cx + Math.cos(a) * rad, cy + Math.sin(a) * rad);
  }
  g.closePath();
}

export function createTitle({ focusMenu }) {
  const screen = $('title-screen');
  let phase = 'attract'; // attract | flash | menu | controls | credits | difficulty | prequel (DLC)
  let flashT = 0, t = 0, starOnT = 0;
  let layers = null;
  let parts = [];
  let cars = [];
  let lastDev = '';
  const silCache = new WeakMap();

  function setPhase(p) {
    phase = p;
    screen.dataset.phase = p;
  }

  function ensureLayers(W, H) {
    if (layers) return;
    layers = {
      mountain: makeMountain(W, H),
      far: makeSkyline(W * 2, H, 7, 330, 40, 120, '#3b2a4a', '#ffb860', 0.06),
      mid: makeSkyline(W * 2, H, 21, 372, 50, 170, '#22182e', '#ffc870', 0.16),
    };
    const n = reduced() ? 10 : lowPower() ? 18 : 40;
    const r = rng(99);
    parts = Array.from({ length: n }, () => ({ x: r() * W, y: r() * H, v: 6 + r() * 14, s: 0.6 + r() * 1.8, p: r() * 6.28 }));
  }

  /** Animated golden-hour skyline. Characters are drawn by main.js afterwards. */
  function drawBackdrop(ctx, W, H, dt) {
    ensureLayers(W, H);
    const rm = reduced();
    t += dt; starOnT += dt;
    const spd = rm ? 0.15 : 1;
    const weather = getWeather();
    // sky — Sunny is bright warm daylight (the old dusk grade is Night / Rainy)
    const sky = ctx.createLinearGradient(0, 0, 0, 380);
    if (weather === 'night') {
      sky.addColorStop(0, '#070b16'); sky.addColorStop(0.55, '#121a30'); sky.addColorStop(1, '#1a2436');
    } else if (weather === 'rainy') {
      sky.addColorStop(0, '#6d7682'); sky.addColorStop(0.5, '#98a1ab'); sky.addColorStop(1, '#c5ccd3');
    } else {
      sky.addColorStop(0, '#7ec8f2'); sky.addColorStop(0.38, '#ffe6b0'); sky.addColorStop(0.72, '#ffc56a'); sky.addColorStop(1, '#fff3d2');
    }
    ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
    if (weather === 'sunny') {
      const sx = W * 0.7, sy = 250;
      const sun = ctx.createRadialGradient(sx, sy, 8, sx, sy, 280);
      sun.addColorStop(0, 'rgba(255,252,236,0.98)'); sun.addColorStop(0.16, 'rgba(255,214,120,0.72)'); sun.addColorStop(1, 'rgba(255,170,70,0)');
      ctx.fillStyle = sun; ctx.fillRect(0, 0, W, H);
    } else if (weather === 'night') {
      const mx = W * 0.78, my = 78;
      const moon = ctx.createRadialGradient(mx, my, 2, mx, my, 70);
      moon.addColorStop(0, 'rgba(244,247,255,0.95)'); moon.addColorStop(0.35, 'rgba(190,206,240,0.35)'); moon.addColorStop(1, 'rgba(140,160,210,0)');
      ctx.fillStyle = moon; ctx.fillRect(mx - 80, my - 80, 160, 160);
      ctx.fillStyle = '#fff6dd';
      for (let i = 0; i < 28; i++) {
        const x = (i * 197) % W, y = (i * 61) % 160;
        ctx.globalAlpha = 0.35 + 0.55 * (0.5 + 0.5 * Math.sin(t * 1.5 * spd + i));
        ctx.fillRect(x, y, i % 5 === 0 ? 2 : 1, i % 5 === 0 ? 2 : 1);
      }
      ctx.globalAlpha = 1;
    } else {
      ctx.fillStyle = 'rgba(232,236,240,0.2)';
      for (let i = 0; i < 4; i++) {
        const x = ((i * 260 + t * 12) % (W + 180)) - 80;
        ctx.beginPath(); ctx.ellipse(x, 50 + (i % 3) * 28, 110, 18, 0, 0, Math.PI * 2); ctx.fill();
      }
    }
    // Mill Mountain + the star (flickers on, then a steady neon glow)
    ctx.drawImage(layers.mountain, 0, 0); // far away: no parallax
    const starDim = weather === 'rainy' ? 0.35 : weather === 'night' ? 1 : 0.85;
    const on = starDim * (rm ? 1 : starOnT < 0.4 ? 0 : starOnT < 1.6 ? (Math.sin(starOnT * 37) > 0.2 ? 1 : 0.15) : 0.88 + 0.12 * Math.sin(t * 9) * Math.sin(t * 2.3));
    const scx = 430, scy = 112;
    const glow = ctx.createRadialGradient(scx, scy, 4, scx, scy, 120);
    glow.addColorStop(0, `rgba(255,250,235,${0.7 * on})`); glow.addColorStop(0.3, `rgba(255,220,140,${0.3 * on})`); glow.addColorStop(1, 'rgba(255,200,120,0)');
    ctx.fillStyle = glow; ctx.fillRect(scx - 120, scy - 120, 240, 240);
    ctx.fillStyle = '#2a1d3c'; ctx.fillRect(scx - 2, scy + 20, 4, 60); ctx.fillRect(scx - 14, scy + 30, 28, 3); ctx.fillRect(scx - 10, scy + 50, 20, 3); // scaffold
    starPath(ctx, scx, scy, 30, 12);
    ctx.lineWidth = 6; ctx.strokeStyle = `rgba(255,236,190,${0.35 * on})`; ctx.stroke();
    ctx.lineWidth = 2.5; ctx.strokeStyle = on > 0.5 ? '#fffaf0' : '#7d6a80'; ctx.stroke();
    // parallax skylines
    const fx = (t * 4 * spd) % W, mx = (t * 10 * spd) % W;
    ctx.drawImage(layers.far, -fx, 0); ctx.drawImage(layers.far, W * 2 - fx, 0);
    ctx.drawImage(layers.mid, -mx, 0); ctx.drawImage(layers.mid, W * 2 - mx, 0);
    // haze at the horizon
    const hz = ctx.createLinearGradient(0, 300, 0, 400);
    if (weather === 'night') {
      hz.addColorStop(0, 'rgba(20,28,48,0)'); hz.addColorStop(1, 'rgba(12,16,28,0.45)');
    } else if (weather === 'rainy') {
      hz.addColorStop(0, 'rgba(180,188,196,0)'); hz.addColorStop(1, 'rgba(150,158,168,0.4)');
    } else {
      hz.addColorStop(0, 'rgba(255,210,140,0)'); hz.addColorStop(1, 'rgba(255,186,100,0.4)');
    }
    ctx.fillStyle = hz; ctx.fillRect(0, 300, W, 100);
    // street
    const road = ctx.createLinearGradient(0, 372, 0, H);
    if (weather === 'night') {
      road.addColorStop(0, '#1a2030'); road.addColorStop(0.15, '#121722'); road.addColorStop(1, '#070910');
    } else if (weather === 'rainy') {
      road.addColorStop(0, '#3a4048'); road.addColorStop(0.18, '#2a3038'); road.addColorStop(1, '#161a20');
    } else {
      road.addColorStop(0, '#6a5348'); road.addColorStop(0.15, '#4a382e'); road.addColorStop(1, '#241810');
    }
    ctx.fillStyle = road; ctx.fillRect(0, 372, W, H - 372);
    ctx.fillStyle = weather === 'night' ? 'rgba(255,190,120,0.45)' : weather === 'rainy' ? 'rgba(190,205,220,0.4)' : 'rgba(255,220,160,0.55)';
    ctx.fillRect(0, 372, W, 3); // curb catch-light
    if (weather === 'rainy') {
      ctx.globalCompositeOperation = 'screen';
      ctx.fillStyle = 'rgba(200,216,230,0.18)';
      for (let i = 0; i < 4; i++) ctx.fillRect(0, 400 + i * 22, W, 2);
      ctx.globalCompositeOperation = 'source-over';
    }
    ctx.fillStyle = weather === 'night' ? 'rgba(255,220,150,0.18)' : weather === 'rainy' ? 'rgba(210,220,230,0.2)' : 'rgba(255,230,170,0.4)';
    const dash = (t * 60 * spd) % 80;
    for (let x = -dash; x < W; x += 80) ctx.fillRect(x, 430, 40, 3);
    // passing cars: headlights one way, taillights the other
    if (!rm && Math.random() < dt * 0.35 && cars.length < 3) {
      const dir = Math.random() < 0.5 ? 1 : -1;
      cars.push({ x: dir > 0 ? -160 : W + 160, dir, v: 220 + Math.random() * 140, y: dir > 0 ? 448 : 410 });
    }
    ctx.globalCompositeOperation = 'lighter';
    for (const c of cars) {
      c.x += c.dir * c.v * dt;
      const front = c.dir > 0 ? c.x + 50 : c.x - 50;
      const beam = ctx.createLinearGradient(front, 0, front + c.dir * 220, 0);
      beam.addColorStop(0, 'rgba(255,240,200,0.45)'); beam.addColorStop(1, 'rgba(255,240,200,0)');
      ctx.fillStyle = beam;
      ctx.beginPath(); ctx.moveTo(front, c.y - 4); ctx.lineTo(front + c.dir * 220, c.y - 26); ctx.lineTo(front + c.dir * 220, c.y + 18); ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(255,250,230,0.95)'; ctx.fillRect(front - 3, c.y - 4, 6, 5);
      ctx.fillStyle = 'rgba(255,60,40,0.8)'; ctx.fillRect((c.dir > 0 ? c.x - 50 : c.x + 50) - 3, c.y - 4, 6, 4);
    }
    ctx.globalCompositeOperation = 'source-over';
    cars = cars.filter((c) => c.x > -300 && c.x < W + 300);
    // drifting dust — warm in daylight, gone under rain and night (those grades bring their own sky)
    if (weather === 'sunny') {
      for (const p of parts) {
        p.y -= p.v * dt * spd; p.x += Math.sin(t * 0.7 + p.p) * 6 * dt * spd;
        if (p.y < -4) { p.y = H + 4; p.x = Math.random() * W; }
        ctx.globalAlpha = 0.35 + 0.35 * Math.sin(t * 2 + p.p);
        ctx.fillStyle = '#ffd890'; ctx.fillRect(p.x, p.y, p.s * 2, p.s * 2);
      }
    }
    ctx.globalAlpha = 1;
  }

  /** Dark rim-lit silhouette of any sprite (cached per source canvas). */
  function silhouette(spr) {
    if (!spr) return null;
    let c = silCache.get(spr);
    if (c) return c;
    c = document.createElement('canvas'); c.width = spr.width; c.height = spr.height;
    const g = c.getContext('2d');
    g.drawImage(spr, 0, 0);
    g.globalCompositeOperation = 'source-in';
    const grd = g.createLinearGradient(0, 0, spr.width, 0);
    grd.addColorStop(0, '#ff9a4a'); grd.addColorStop(0.12, '#120a18'); grd.addColorStop(1, '#120a18');
    g.fillStyle = grd; g.fillRect(0, 0, spr.width, spr.height);
    silCache.set(spr, c);
    return c;
  }

  /** Final grade over everything. Sunny stays bright; Night and Rainy vignette cooler. */
  function drawGrade(ctx, W, H) {
    const weather = getWeather();
    const edge = weather === 'night' ? 'rgba(2,4,12,0.62)' : weather === 'rainy' ? 'rgba(8,10,14,0.42)' : 'rgba(40,22,8,0.28)';
    const v = ctx.createRadialGradient(W / 2, H * 0.45, H * 0.3, W / 2, H * 0.5, W * 0.7);
    v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, edge);
    ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
  }

  // ---------------- controls panel ----------------
  const ACTIONS = [['move', 'Move'], ['sprint', 'Sprint (hold)'], ['punch', 'Punch (3rd hit = outfit weapon finisher)'], ['kick', 'Kick'], ['jumpkick', 'Jump kick (sprint + kick)'], ['special', 'Star Drive (outfit signature move)'], ['heavy', 'Heavy'], ['interact', 'Talk / use'], ['outfit', 'Outfits'], ['nightmare', "Hell's Nightmare suit"], ['suit', "Silas's Suit (after the prequel)"], ['weather', 'Weather (Sunny / Night / Rainy)'], ['pause', 'Pause'], ['confirm', 'Menu select'], ['back', 'Menu back']];
  function renderControls() {
    const dev = getPromptDevice();
    const padType = dev === 'ps' ? 'ps' : 'xbox';
    const cols = [['keyboard', 'Keyboard'], [padType, padType === 'ps' ? 'PlayStation pad' : 'Xbox / gamepad'], ['touch', 'Touch']];
    const head = cols.map(([k, n]) => `<th class="${k === dev ? 'cur' : ''}">${n}${k === dev ? ' <span class="you">●</span>' : ''}</th>`).join('');
    const rows = ACTIONS.map(([a, label]) => `<tr><td>${label}</td>${cols.map(([k]) => {
      let v = getPromptSet(k)[a] || '—';
      if (k === 'keyboard' && a === 'confirm') v = 'Enter / Z';
      if (k === 'keyboard' && a === 'back') v = 'Esc / X';
      return `<td class="${k === dev ? 'cur' : ''}"><kbd>${v}</kbd></td>`;
    }).join('')}</tr>`).join('');
    // DLC: Silas Boone's six moves (prequel Silas and Matthew in Silas's Suit share them)
    const P = (k) => getPromptSet(k);
    const keyFor = (k, a) => (P(k)[a] || '—');
    const silasInputs = {
      punch: (k) => keyFor(k, 'punch'), heavy: (k) => k === 'touch' ? 'GRIP' : keyFor(k, 'heavy'), special: (k) => keyFor(k, 'special'),
      kick: (k) => `${keyFor(k, 'kick')} (hold)`, interact: (k) => keyFor(k, 'interact'), rush: (k) => `${keyFor(k, 'sprint')} + ${keyFor(k, 'punch')}`
    };
    const order = ['punch', 'heavy', 'special', 'kick', 'interact', 'rush'];
    const srows = silasMoveRows().map((r, i) => `<tr class="silas-move"><td>${r.move} <small>· ${r.input}</small></td>${cols.map(([k]) => `<td class="${k === dev ? 'cur' : ''}"><kbd>${silasInputs[order[i]](k)}</kbd></td>`).join('')}</tr>`).join('');
    const sh = `<tr class="silas-head"><td colspan="${cols.length + 1}">Silas Boone's moveset · Prequel &amp; Silas's Suit</td></tr>`;
    $('controls-table').innerHTML = `<thead><tr><th></th>${head}</tr></thead><tbody>${rows}${sh}${srows}</tbody>`;
  }

  function refreshPrompt() {
    const dev = getPromptDevice();
    if (dev === lastDev) return;
    lastDev = dev;
    $('title-press').textContent = dev === 'touch' ? 'TAP TO START' : 'PRESS START';
    $('title-press-sub').textContent = dev === 'touch' ? '' : dev === 'keyboard' ? 'Enter · Z · Space' : `${getPromptLabel('confirm')} · ${getPromptLabel('pause')}`;
    const L = getPromptLabel('confirm'), B = getPromptLabel('back');
    $('title-help').textContent = dev === 'touch' ? 'Tap to select' : `${dev === 'keyboard' ? '↑↓ / WS' : 'D-pad'} move · ${dev === 'keyboard' ? 'Enter/Z' : L} select · ${dev === 'keyboard' ? 'Esc/X' : B} back`;
    if (phase === 'controls') renderControls();
  }

  function pressStart() {
    if (phase !== 'attract') return;
    unlockAudio(); blip('start');
    setPhase('flash');
    flashT = reduced() ? 0.12 : 0.42;
  }
  function openPanel(p) {
    if (p === 'controls') renderControls();
    setPhase(p);
    focusMenu(p === 'controls' ? -1 : 0); // Controls: focus Back (audio sliders sit above it)
  }
  let prequelFlow = false; // DLC: difficulty picker opened for the prequel
  function closePanel() {
    const from = phase;
    setPhase('menu');
    const ids = ['btn-continue', 'btn-start', 'btn-new-game', 'btn-ngplus', 'btn-controls', 'btn-credits', 'btn-prequel'].filter((id) => $(id) && !$(id).classList.contains('hidden'));
    const back = from === 'controls' ? 'btn-controls' : from === 'credits' ? 'btn-credits'
      : (from === 'prequel' || prequelFlow) ? 'btn-prequel' // DLC: back to the prequel entry
      : (!$('btn-new-game').classList.contains('hidden') ? 'btn-new-game' : 'btn-start');
    prequelFlow = false;
    focusMenu(Math.max(0, ids.indexOf(back)));
  }

  // pointer: tap/click anywhere to leave attract. The weather settings bar stays put.
  screen.addEventListener('pointerdown', (e) => {
    if (phase !== 'attract') return;
    if (e.target.closest && e.target.closest('#title-weather')) return;
    e.preventDefault();
    pressStart();
  });
  window.addEventListener('keydown', (e) => { if (phase === 'attract' && e.key === ' ' && !screen.classList.contains('hidden')) pressStart(); });
  // menu sounds for mouse / touch / keyboard / pad (handleMenu clicks the button)
  let lastSnd = 0;
  const sel = () => { const n = performance.now(); if (n - lastSnd > 120) { lastSnd = n; blip('select'); } };
  screen.querySelectorAll('button').forEach((b) => {
    if (b.closest('.audio-settings')) return; // audio widget plays its own ticks
    b.addEventListener('click', sel); b.addEventListener('touchend', sel, { passive: true });
    b.addEventListener('mouseenter', () => { if (b.offsetParent && document.activeElement !== b) { b.focus({ preventScroll: true }); blip('move'); } });
  });
  // audio settings (Music / SFX / mute) on the Controls panel, above Back
  const ctlBack = $('btn-controls-back');
  if (ctlBack) {
    const slot = document.createElement('div');
    slot.className = 'audio-slot';
    slot.innerHTML = '<h3 class="audio-title">Audio</h3>';
    ctlBack.parentNode.insertBefore(slot, ctlBack);
    mountAudioSettings(slot);
  }
  $('btn-controls').addEventListener('click', () => openPanel('controls'));
  $('btn-credits').addEventListener('click', () => openPanel('credits'));
  $('btn-controls-back').addEventListener('click', closePanel);
  $('btn-credits-back').addEventListener('click', closePanel);
  $('btn-diff-back').addEventListener('click', closePanel);
  if ($('btn-prequel-back')) $('btn-prequel-back').addEventListener('click', closePanel); // DLC
  // difficulty descriptions follow focus (mouse hover, keys, pad)
  const DIFF_DESC = {
    easy: 'Softer thugs, gentler hits, extra healing. Enjoy the sights.',
    normal: 'Balanced fights. The way Star City was meant to be roamed.',
    hard: 'Tougher, faster, meaner thugs and a stronger Silas. Less healing. Beat it for the Gold Star Suit.',
    arcade: 'Hard rules, no healing, and a knockout sends you back to your last save.'
  };
  screen.querySelectorAll('[data-diff]').forEach((b) => b.addEventListener('focus', () => { $('diff-desc').textContent = DIFF_DESC[b.dataset.diff]; }));
  // touch: bindTap-style instant tap for the new buttons (click after touch is a no-op on hidden menus)
  ['btn-controls', 'btn-credits', 'btn-controls-back', 'btn-credits-back', 'btn-diff-back', 'btn-prequel-back'].forEach((id) => {
    if (!$(id)) return;
    $(id).addEventListener('touchend', (e) => { if (e.cancelable) e.preventDefault(); $(id).click(); }, { passive: false });
  });

  return {
    drawBackdrop, drawGrade, silhouette,
    get phase() { return phase; },
    /** New Game flow: open the difficulty selector (focus defaults to Normal). */
    openDifficulty(fromPrequel = false) { prequelFlow = !!fromPrequel; setPhase('difficulty'); focusMenu(1); },
    /** DLC: Prequel panel (Continue / New / Back) when a prequel run is saved. */
    openPrequel() { setPhase('prequel'); focusMenu(0); },
    show() { setPhase('attract'); starOnT = 0; lastDev = ''; refreshPrompt(); },
    /** Title-mode input. Returns true when the input was consumed (skip handleMenu). */
    update(inp, dt) {
      refreshPrompt();
      const confirmScreenOpen = !$('confirm-screen').classList.contains('hidden');
      // Z = select, X = back on menus (keyboard), matching the arcade layout
      if (inp.punchPressed) inp.confirmPressed = true;
      if (inp.kickPressed) inp.backPressed = true;
      if (phase === 'attract') {
        if (inp.confirmPressed || inp.pausePressed || inp.interactPressed) pressStart();
        return true;
      }
      if (phase === 'flash') {
        flashT -= dt;
        if (flashT <= 0) { setPhase('menu'); focusMenu(0); }
        return true;
      }
      if (confirmScreenOpen) {
        if (inp.backPressed) blip('back');
        return false;
      }
      const onSlider = !!(document.activeElement && document.activeElement.classList && document.activeElement.classList.contains('audio-slider'));
      if (inp.navUp || inp.navDown || ((inp.navLeft || inp.navRight) && !onSlider)) blip('move');
      if (inp.backPressed) {
        blip('back');
        if (phase === 'controls' || phase === 'credits' || phase === 'difficulty' || phase === 'prequel') closePanel();
        else { setPhase('attract'); }
        return true;
      }
      return false;
    }
  };
}
