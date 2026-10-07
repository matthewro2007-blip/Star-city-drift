/**
 * PC keyboard + phone touch + Gamepad API (PS5 DualSense / Xbox, "standard" mapping).
 * All three work at the same time; poll() is called once per frame.
 */

const DEAD_ZONE = 0.2;
const NAV_THRESHOLD = 0.5;

// Which device prompts should describe: 'keyboard' | 'touch' | 'pad'
const promptState = { device: 'keyboard', padType: 'xbox', padId: '' };

const PROMPTS = {
  keyboard: {
    punch: 'Z', kick: 'X', heavy: 'C', interact: 'E', pause: 'Esc',
    confirm: 'Enter', back: 'Esc', move: 'WASD / Arrows', outfit: '1–5'
  },
  touch: {
    punch: 'Z', kick: 'X', heavy: '', interact: 'E', pause: 'II',
    confirm: 'Tap', back: 'Tap', move: 'Stick', outfit: ''
  },
  ps: {
    punch: '✕ Cross', kick: '○ Circle', heavy: '△ Triangle', interact: '□ Square',
    pause: 'Options', confirm: '✕ Cross', back: '○ Circle', move: 'Left stick / D-pad', outfit: 'L1 / R1'
  },
  xbox: {
    punch: 'A', kick: 'B', heavy: 'Y', interact: 'X', pause: 'Menu',
    confirm: 'A', back: 'B', move: 'Left stick / D-pad', outfit: 'LB / RB'
  }
};

/**
 * 'ps' for DualSense / DualShock ids ('DualSense', 'Wireless Controller', Sony vendor '054c'),
 * otherwise 'xbox' (generic A/B/X/Y). Xbox pads also call themselves "Xbox Wireless Controller"
 * (vendor 045e), so Xbox/XInput ids are checked first.
 */
export function padTypeFromId(id) {
  const s = id || '';
  if (/xbox|xinput|045e/i.test(s)) return 'xbox';
  return /dualsense|wireless controller|054c/i.test(s) ? 'ps' : 'xbox';
}

/** Device-aware button label for an action: punch|kick|heavy|interact|pause|confirm|back|move. */
export function getPromptLabel(action) {
  const set = promptState.device === 'pad' ? PROMPTS[promptState.padType]
    : promptState.device === 'touch' ? PROMPTS.touch : PROMPTS.keyboard;
  return set[action] ?? PROMPTS.keyboard[action] ?? action; // '' = no control for it on this device
}

/** 'keyboard' | 'touch' | 'ps' | 'xbox' — handy for HUD code that wants icons. */
export function getPromptDevice() {
  return promptState.device === 'pad' ? promptState.padType : promptState.device;
}

let activePadIndex = null;

/** Short rumble on supported pads (no-op elsewhere). */
export function rumble(strong = 0.5, weak = 0.3, ms = 90) {
  try {
    if (activePadIndex == null || !navigator.getGamepads) return;
    const gp = navigator.getGamepads()[activePadIndex];
    const act = gp && gp.vibrationActuator;
    if (act && typeof act.playEffect === 'function') {
      const p = act.playEffect('dual-rumble', { duration: ms, strongMagnitude: strong, weakMagnitude: weak });
      if (p && typeof p.catch === 'function') p.catch(() => {});
    }
  } catch (_) { /* unsupported */ }
}

export function createInput(canvas, opts = {}) {
  const keys = Object.create(null);
  const state = {
    ax: 0, ay: 0,
    punch: false, kick: false, interact: false,
    punchPressed: false, kickPressed: false, heavyPressed: false, interactPressed: false,
    pausePressed: false, confirmPressed: false, backPressed: false,
    navUp: false, navDown: false, navLeft: false, navRight: false,
    outfitKey: null,
    outfitCycle: 0,
    mobile: false
  };
  const onPadChange = opts.onPadChange || (() => {});
  const onDeviceChange = opts.onDeviceChange || (() => {});

  // Phone/tablet: coarse pointer, or a touch screen on a small display. Touch laptops with a
  // mouse keep the keyboard layout (touch + keyboard both still work either way).
  const coarse = matchMedia('(pointer: coarse)').matches;
  const isTouch = coarse || 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  state.mobile = coarse || (isTouch && Math.min(screen.width, screen.height) < 820);
  if (state.mobile) promptState.device = 'touch';

  function setDevice(d) {
    if (promptState.device !== d) {
      promptState.device = d;
      onDeviceChange(getPromptDevice());
    }
  }

  // Let the canvas take keyboard focus (keys are read on window, focus just keeps
  // buttons from swallowing Enter/Space and pulls focus back into the page).
  if (canvas) {
    if (!canvas.hasAttribute('tabindex')) canvas.tabIndex = 0;
    canvas.style.outline = 'none';
    canvas.addEventListener('pointerdown', () => canvas.focus({ preventScroll: true }));
  }

  const keyMap = {
    ArrowLeft: 'left', a: 'left', A: 'left',
    ArrowRight: 'right', d: 'right', D: 'right',
    ArrowUp: 'up', w: 'up', W: 'up',
    ArrowDown: 'down', s: 'down', S: 'down',
    z: 'punch', Z: 'punch', j: 'punch', J: 'punch',
    x: 'kick', X: 'kick', k: 'kick', K: 'kick',
    c: 'heavy', C: 'heavy', l: 'heavy', L: 'heavy',
    e: 'interact', E: 'interact',
    Enter: 'confirm',
    Escape: 'pause'
  };

  window.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const a = keyMap[e.key];
    if (!a && !(e.key >= '1' && e.key <= '5')) return;
    setDevice(state.mobile ? 'touch' : 'keyboard');
    if (a) {
      keys[a] = true;
      e.preventDefault(); // also stops Enter re-clicking a focused button (we confirm ourselves)
    }
    if (e.repeat) return; // edge-triggered actions never auto-repeat
    if (e.key >= '1' && e.key <= '5') state.outfitKey = e.key;
    if (a === 'punch') state.punchPressed = true;
    if (a === 'kick') state.kickPressed = true;
    if (a === 'heavy') state.heavyPressed = true;
    if (a === 'interact') state.interactPressed = true;
    if (a === 'confirm') state.confirmPressed = true;
    if (a === 'pause') { state.pausePressed = true; state.backPressed = true; }
    if (a === 'up') state.navUp = true;
    if (a === 'down') state.navDown = true;
    if (a === 'left') state.navLeft = true;
    if (a === 'right') state.navRight = true;
  });
  window.addEventListener('keyup', (e) => {
    const a = keyMap[e.key];
    if (a) keys[a] = false;
  });
  // Drop held keys when the tab loses focus (prevents "stuck walking").
  window.addEventListener('blur', () => { for (const k in keys) keys[k] = false; });

  // ---------- Touch: joystick + buttons ----------
  const joyZone = document.getElementById('joystick-zone');
  const knob = document.getElementById('joystick-knob');
  const base = document.getElementById('joystick-base');
  let joyId = null, joyOrigin = null;
  const touchAxis = { x: 0, y: 0 };

  function setJoy(dx, dy) {
    const max = 40;
    const len = Math.hypot(dx, dy) || 1;
    const cl = Math.min(len, max);
    const nx = (dx / len) * cl;
    const ny = (dy / len) * cl;
    if (knob) knob.style.transform = `translate(calc(-50% + ${nx}px), calc(-50% + ${ny}px))`;
    touchAxis.x = nx / max;
    touchAxis.y = ny / max;
  }
  function resetJoy() {
    if (knob) knob.style.transform = 'translate(-50%, -50%)';
    touchAxis.x = 0; touchAxis.y = 0;
    joyId = null; joyOrigin = null;
  }

  if (joyZone && base) {
    joyZone.addEventListener('touchstart', (e) => {
      const t = e.changedTouches[0];
      joyId = t.identifier;
      const r = base.getBoundingClientRect();
      joyOrigin = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      setJoy(t.clientX - joyOrigin.x, t.clientY - joyOrigin.y);
      setDevice('touch');
      e.preventDefault();
    }, { passive: false });
    joyZone.addEventListener('touchmove', (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier === joyId && joyOrigin) setJoy(t.clientX - joyOrigin.x, t.clientY - joyOrigin.y);
      }
      e.preventDefault();
    }, { passive: false });
    const endJoy = (e) => {
      for (const t of e.changedTouches) if (t.identifier === joyId) resetJoy();
    };
    joyZone.addEventListener('touchend', endJoy);
    joyZone.addEventListener('touchcancel', endJoy);
  }

  function bindBtn(id, onDown, onUp) {
    const el = document.getElementById(id);
    if (!el) return;
    let touched = -Infinity;
    const down = (e) => {
      if (e.type === 'mousedown' && performance.now() - touched < 600) return; // emulated mouse after touch
      if (e.type === 'touchstart') { touched = performance.now(); setDevice('touch'); }
      e.preventDefault();
      onDown();
    };
    const up = (e) => { if (e.cancelable) e.preventDefault(); onUp && onUp(); };
    el.addEventListener('touchstart', down, { passive: false });
    el.addEventListener('touchend', up);
    el.addEventListener('touchcancel', up);
    el.addEventListener('mousedown', down);
    el.addEventListener('mouseup', up);
    el.addEventListener('mouseleave', () => onUp && onUp());
  }
  bindBtn('btn-punch', () => { state.punch = true; state.punchPressed = true; }, () => { state.punch = false; });
  bindBtn('btn-kick', () => { state.kick = true; state.kickPressed = true; }, () => { state.kick = false; });
  bindBtn('btn-interact', () => { state.interact = true; state.interactPressed = true; }, () => { state.interact = false; });

  // ---------- Gamepad ----------
  const prevBtn = [];
  let prevNav = { up: false, down: false, left: false, right: false };
  const known = new Map(); // index -> id

  function padConnected(gp) {
    if (!gp || known.has(gp.index)) return;
    known.set(gp.index, gp.id);
    if (activePadIndex == null) {
      activePadIndex = gp.index;
      promptState.padType = padTypeFromId(gp.id);
      promptState.padId = gp.id;
      prevBtn.length = 0;
    }
    setDevice('pad');
    onPadChange(true, gp, getPromptDevice());
  }
  function padDisconnected(index, id) {
    if (!known.has(index)) return;
    known.delete(index);
    if (activePadIndex === index) {
      activePadIndex = null;
      prevBtn.length = 0;
      // fall back to another connected pad, else keyboard/touch prompts
      const next = known.keys().next();
      if (!next.done) {
        activePadIndex = next.value;
        promptState.padType = padTypeFromId(known.get(next.value));
      } else {
        setDevice(state.mobile ? 'touch' : 'keyboard');
      }
    }
    onPadChange(false, { index, id }, getPromptDevice());
  }

  window.addEventListener('gamepadconnected', (e) => padConnected(e.gamepad));
  window.addEventListener('gamepaddisconnected', (e) => padDisconnected(e.gamepad.index, e.gamepad.id));

  function readPads() {
    let pads = [];
    try { pads = navigator.getGamepads ? Array.from(navigator.getGamepads()) : []; } catch (_) { pads = []; }
    // Polling fallback: catch connects/disconnects the events missed.
    const seen = new Set();
    for (const gp of pads) {
      if (!gp || gp.connected === false) continue;
      seen.add(gp.index);
      if (!known.has(gp.index)) padConnected(gp);
    }
    for (const [idx, id] of [...known]) if (!seen.has(idx)) padDisconnected(idx, id);
    return activePadIndex != null ? pads[activePadIndex] : null;
  }

  function padState() {
    const gp = readPads();
    const out = { ax: 0, ay: 0, punch: false, kick: false, any: false };
    if (!gp) return out;
    const btn = (i) => {
      const b = gp.buttons && gp.buttons[i];
      return !!b && (b.pressed || b.value > 0.5);
    };
    const edge = (i) => {
      const now = btn(i);
      const was = !!prevBtn[i];
      prevBtn[i] = now;
      return now && !was;
    };
    let ax = gp.axes && gp.axes.length > 0 ? gp.axes[0] : 0;
    let ay = gp.axes && gp.axes.length > 1 ? gp.axes[1] : 0;
    // radial dead zone, rescaled so movement starts smoothly past it
    const mag = Math.hypot(ax, ay);
    if (mag < DEAD_ZONE) { ax = 0; ay = 0; } else {
      const k = Math.min(1, (mag - DEAD_ZONE) / (1 - DEAD_ZONE)) / mag;
      ax *= k; ay *= k;
    }
    const dUp = btn(12), dDown = btn(13), dLeft = btn(14), dRight = btn(15);
    if (dLeft || dRight) ax = (dRight ? 1 : 0) - (dLeft ? 1 : 0);
    if (dUp || dDown) ay = (dDown ? 1 : 0) - (dUp ? 1 : 0);
    out.ax = ax; out.ay = ay;

    // Rising edges (a held button never repeats)
    const e0 = edge(0), e1 = edge(1), e2 = edge(2), e3 = edge(3), e9 = edge(9);
    const e4 = edge(4), e5 = edge(5); // L1/R1 (LB/RB): cycle unlocked outfits
    for (let i = 6; i < 18; i++) if (i !== 9) edge(i);
    if (e4) state.outfitCycle = -1;
    if (e5) state.outfitCycle = 1;
    if (e0) { state.punchPressed = true; state.confirmPressed = true; }
    if (e1) { state.kickPressed = true; state.backPressed = true; }
    if (e2) state.interactPressed = true;
    if (e3) state.heavyPressed = true; // no jump in this game → extra (heavy) attack
    if (e9) state.pausePressed = true;
    out.punch = btn(0); out.kick = btn(1);

    // Menu navigation edges from D-pad or stick
    const nav = {
      up: dUp || ay < -NAV_THRESHOLD, down: dDown || ay > NAV_THRESHOLD,
      left: dLeft || ax < -NAV_THRESHOLD, right: dRight || ax > NAV_THRESHOLD
    };
    if (nav.up && !prevNav.up) state.navUp = true;
    if (nav.down && !prevNav.down) state.navDown = true;
    if (nav.left && !prevNav.left) state.navLeft = true;
    if (nav.right && !prevNav.right) state.navRight = true;
    prevNav = nav;

    out.any = e0 || e1 || e2 || e3 || e4 || e5 || e9 || Math.abs(ax) > 0 || Math.abs(ay) > 0;
    if (out.any) setDevice('pad');
    return out;
  }

  return {
    state,
    isMobile: () => state.mobile,
    hasPad: () => activePadIndex != null,
    showMobile(show) {
      const el = document.getElementById('mobile-controls');
      if (el) el.classList.toggle('hidden', !show);
    },
    /** Return focus to the game so keys work without clicking the canvas first. */
    focusGame() {
      const ae = document.activeElement;
      if (ae && ae !== canvas && ae !== document.body && typeof ae.blur === 'function') ae.blur();
      if (canvas) canvas.focus({ preventScroll: true });
    },
    /** Clear one-shot presses (e.g. after a menu button click) so they don't leak into play. */
    flush() {
      state.punchPressed = state.kickPressed = state.heavyPressed = false;
      state.interactPressed = state.confirmPressed = state.backPressed = state.pausePressed = false;
      state.navUp = state.navDown = state.navLeft = state.navRight = false;
      state.outfitKey = null;
      state.outfitCycle = 0;
    },
    poll() {
      const pad = padState();
      const kx = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
      const ky = (keys.down ? 1 : 0) - (keys.up ? 1 : 0);
      // Merge: keyboard, then touch stick, then pad — whichever is active wins.
      let ax = kx, ay = ky;
      if (!ax && !ay && (touchAxis.x || touchAxis.y)) { ax = touchAxis.x; ay = touchAxis.y; }
      if (!ax && !ay && (pad.ax || pad.ay)) { ax = pad.ax; ay = pad.ay; }
      state.ax = ax; state.ay = ay;
      const out = {
        ax, ay,
        punchPressed: state.punchPressed,
        kickPressed: state.kickPressed,
        heavyPressed: state.heavyPressed,
        interactPressed: state.interactPressed,
        confirmPressed: state.confirmPressed,
        backPressed: state.backPressed,
        pausePressed: state.pausePressed,
        navUp: state.navUp, navDown: state.navDown, navLeft: state.navLeft, navRight: state.navRight,
        outfitKey: state.outfitKey,
        outfitCycle: state.outfitCycle,
        punchHeld: !!keys.punch || state.punch || pad.punch,
        kickHeld: !!keys.kick || state.kick || pad.kick
      };
      this.flush();
      return out;
    }
  };
}
