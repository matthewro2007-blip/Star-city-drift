/**
 * 1.9.0 Scene player: data-driven story scenes (presentation + flow only; no combat, no saves).
 *
 * TEAM API (import from './scene_player.js'):
 *   registerScene(def)            add / replace a scene by def.id (Jack: story files register scenes as data)
 *   playScene(idOrDef, opts)      start it; opts = { onDone(skipped), vars } → true if started
 *   skipScene()                   skip the running scene (Esc / pad Start or B / touch Skip already call this)
 *   isScenePlaying(), currentScene(), getScene(id), listScenes()
 *   setVoiceHook(fn)              Kody: fn(clipId, { speaker, name, text, sceneId }) plays a voice clip.
 *                                 Without a hook, window.sorVoice?.play(clipId, info) is tried; else a no-op.
 *
 * A scene def:
 *   { id, area?,                           area the scene happens in (main.js warps there when set)
 *     actors: [ActorDef] | (ctx) => [...], camera?: { x, zoom, feetY? } (omit = the normal follow lens)
 *     hidePlayer?, bystanders?: 'near' | 'all' | 'none' (default 'near'), keepNpcs?: [ids],
 *     letterbox?: 0..1 at start, fade?: 0..1 at start, steps: [Step] | (ctx) => [...] }
 *   ctx (built by main.js) = { player, band, frame, area, gameState, vars }
 *   ActorDef = { id, kind: 'cast' | 'matthew' | 'thug', key, x, y, facing, state?, scale?, color?, outfit? }
 *
 * Steps run in order; `async: true` starts a step and moves straight on (walk under a pan).
 *   { kind: 'moveActor', id, to, speed=70 }                 walks (actor.walking) and stops at x = to
 *   { kind: 'anim', id, state?, key?, facing?, pose? }      set an anim state / swap art (e.g. 'silas_cuffed');
 *                                                           pose = cutscene still (talk|point|crossed|shocked|laugh|kneel,
 *                                                           sprites.js getCutscenePose; mouth opens on the talk blips); null clears
 *   { kind: 'cameraPan', x, zoom?, dur=1 }                  scene lens (x = frame centre, world px)
 *   { kind: 'cameraZoom', zoom, dur=1 }
 *   { kind: 'cameraFollow' }                                hand the lens back to the follow camera
 *   { kind: 'line', speaker, name, text, voice?, dur?, pose?, expr? }  one line (expr = portrait expression; waits for E / Enter /
 *   { kind: 'lines', lines: [{ id, name, text, voice? }] }   Cross / A, or auto-advances after dur seconds)
 *   { kind: 'wait', dur }
 *   { kind: 'fade', to, dur=0.6 }                            0 = clear, 1 = black
 *   { kind: 'letterbox', to, dur=0.5 }                       0..1 (bars are drawn inside the visible lens)
 *   { kind: 'call', fn(ctx, actors), onSkip=true }           escape hatch (flags, sfx); onSkip:false = not run on skip
 * Skip fast-forwards: walks / pans / fades snap, lines and waits are dropped, `call` steps still run (unless
 * onSkip:false), so the end state is the same as playing it through.
 */
import { play as voPlay, preload as voPreload, stop as voStop } from './vo.js'; // VO-HOOK

const registry = new Map();
let hooks = {};
let voiceHook = (clipId) => { voPlay(clipId); }; // VO-HOOK: default = js/vo.js (setVoiceHook still overrides)

/** main.js only: { say(lines, done), closeLine(), build(def) → ctx, onStart(scene), onEnd(scene, skipped) }. */
export function setSceneHooks(h) { hooks = h || {}; }
export function setVoiceHook(fn) { voiceHook = typeof fn === 'function' ? fn : null; }
export function registerScene(def) { if (!def || !def.id) throw new Error('scene needs an id'); registry.set(def.id, def); return def; }
export function getScene(id) { return registry.get(id) || null; }
export function listScenes() { return [...registry.keys()]; }

export function playVoice(clipId, info) {
  if (!clipId) return false;
  try {
    if (voiceHook) { voiceHook(clipId, info); return true; }
    const v = typeof window !== 'undefined' && window.sorVoice;
    if (v && typeof v.play === 'function') { v.play(clipId, info); return true; }
  } catch (err) { console.warn('[scene] voice hook', err); }
  return false;
}

const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

const S = {
  def: null, ctx: null, actors: [], steps: [], idx: 0, jobs: [], blocking: null, t: 0,
  cam: null,                 // null = follow lens; else { x, zoom, feetY? }
  fx: { fade: 0, letterbox: 0 },
  onDone: null, skipping: false
};

function actor(id) { return S.actors.find((a) => a.id === id); }

function begin(step) {
  const j = { step, t: 0, done: false };
  switch (step.kind) {
    case 'moveActor': {
      const a = actor(step.id);
      if (!a) { j.done = true; break; }
      a.stopAt = step.to; a.walking = true; a.facing = step.to >= a.x ? 1 : -1;
      if (S.skipping) { a.x = step.to; a.walking = false; j.done = true; }
      break;
    }
    case 'anim': {
      const a = actor(step.id);
      if (a) {
        if (step.state !== undefined) a.state = step.state;
        if (step.key) a.key = step.key;
        if (step.facing) a.facing = step.facing;
        if (step.pose !== undefined) a.pose = step.pose; // cutscene still pose (cs_talk / cs_point / …); null clears
      }
      j.done = true; break;
    }
    case 'cameraPan': case 'cameraZoom': {
      if (!S.cam) S.cam = { ...(hooks.currentLens ? hooks.currentLens() : { x: 480, zoom: 1.34 }) };
      j.from = { x: S.cam.x, zoom: S.cam.zoom };
      if (S.skipping) { if (step.x != null) S.cam.x = step.x; if (step.zoom != null) S.cam.zoom = step.zoom; j.done = true; }
      break;
    }
    case 'cameraFollow': S.cam = null; j.done = true; break;
    case 'fade': case 'letterbox': {
      const k = step.kind;
      j.from = S.fx[k];
      if (S.skipping || !(step.dur > 0) && step.dur !== undefined) { S.fx[k] = step.to; j.done = true; }
      break;
    }
    case 'wait': if (S.skipping) j.done = true; break;
    case 'line': case 'lines': {
      if (S.skipping) { j.done = true; break; }
      const lines = step.kind === 'line' ? [{ id: step.speaker, name: step.name || step.speaker, text: step.text, voice: step.voice, expr: step.expr }] : step.lines;
      if (step.kind === 'line' && step.pose !== undefined) { const sp = actor(step.speaker); if (sp) sp.pose = step.pose; }
      j.lineIdx = 0;
      const first = lines[0];
      if (first && first.voice) playVoice(first.voice, { speaker: first.id, name: first.name, text: first.text, sceneId: S.def.id });
      j.lines = lines;
      if (hooks.say) hooks.say(lines, () => { j.done = true; }, (i) => { // onLine(i): voice per line
        const l = lines[i]; if (i > 0 && l && l.voice) playVoice(l.voice, { speaker: l.id, name: l.name, text: l.text, sceneId: S.def.id });
      }, { moreLines: S.steps.slice(S.idx).some((st) => st && (st.kind === 'line' || st.kind === 'lines')) }); // 1.9.0: 'Close' only on the scene's last line
      else j.done = true;
      break;
    }
    case 'call':
      if (!S.skipping || step.onSkip !== false) { try { step.fn && step.fn(S.ctx, S.actors); } catch (err) { console.error('[scene] call', err); } }
      j.done = true; break;
    default: j.done = true;
  }
  return j;
}

function tick(j, dt) {
  const s = j.step;
  j.t += dt;
  const k = Math.min(1, j.t / Math.max(0.001, s.dur ?? (s.kind === 'fade' ? 0.6 : s.kind === 'letterbox' ? 0.5 : 1)));
  switch (s.kind) {
    case 'moveActor': {
      const a = actor(s.id); if (!a) { j.done = true; break; }
      const d = s.to - a.x, v = (s.speed || 70) * dt;
      if (Math.abs(d) <= v) { a.x = s.to; a.walking = false; j.done = true; } else { a.x += Math.sign(d) * v; a.facing = d > 0 ? 1 : -1; }
      break;
    }
    case 'cameraPan': case 'cameraZoom': {
      const e = ease(k);
      if (s.x != null) S.cam.x = j.from.x + (s.x - j.from.x) * e;
      if (s.zoom != null) S.cam.zoom = j.from.zoom + (s.zoom - j.from.zoom) * e;
      if (k >= 1) j.done = true; break;
    }
    case 'fade': case 'letterbox': S.fx[s.kind] = j.from + (s.to - j.from) * (s.kind === 'letterbox' ? ease(k) : k); if (k >= 1) j.done = true; break;
    case 'wait': if (j.t >= (s.dur ?? 1)) j.done = true; break;
    case 'line': case 'lines':
      if (s.dur && j.t >= s.dur && !j.done && hooks.advance) hooks.advance(); // auto-advance (one box per dur)
      if (s.dur && j.t >= s.dur) j.t = 0;
      break;
  }
}

function finish(skipped) {
  const def = S.def, cb = S.onDone;
  voStop(); // VO-HOOK: a skipped / finished scene cuts its line
  S.def = null; S.jobs = []; S.blocking = null; S.cam = null; S.skipping = false;
  S.fx.fade = 0; S.fx.letterbox = 0;
  if (hooks.onEnd) hooks.onEnd(def, skipped);
  S.actors = [];
  if (cb) cb(skipped);
}

export function playScene(idOrDef, opts = {}) {
  const def = typeof idOrDef === 'string' ? registry.get(idOrDef) : idOrDef;
  if (!def) { console.warn('[scene] unknown scene', idOrDef); return false; }
  if (S.def) finish(true);
  S.def = def; S.idx = 0; S.t = 0; S.jobs = []; S.blocking = null; S.skipping = false;
  S.onDone = opts.onDone || null;
  S.ctx = hooks.build ? hooks.build(def, opts.vars || {}) : { vars: opts.vars || {} };
  const acts = typeof def.actors === 'function' ? def.actors(S.ctx) : (def.actors || []);
  S.actors = acts.map((a) => ({ kind: 'cast', facing: 1, phase: 0, area: S.ctx.areaId, ...a }));
  S.steps = typeof def.steps === 'function' ? def.steps(S.ctx, S.actors) : def.steps;
  try { voPreload(S.steps.flatMap((st) => (st.voice ? [st.voice] : (st.lines || []).map((l) => l.voice).filter(Boolean)))); } catch (_) { /* VO-HOOK: warm this scene's clips */ }
  S.cam = def.camera ? { ...def.camera } : null;
  S.fx.fade = def.fade ?? 0; S.fx.letterbox = def.letterbox ?? 0;
  if (hooks.onStart) hooks.onStart(def, S.actors);
  return true;
}

export function skipScene() {
  if (!S.def || S.skipping) return false;
  S.skipping = true;
  if (hooks.closeLine) hooks.closeLine();
  for (const j of S.jobs) { // snap what is running
    const s = j.step;
    if (s.kind === 'moveActor') { const a = actor(s.id); if (a) { a.x = s.to; a.walking = false; } }
    if ((s.kind === 'cameraPan' || s.kind === 'cameraZoom') && S.cam) { if (s.x != null) S.cam.x = s.x; if (s.zoom != null) S.cam.zoom = s.zoom; }
    if (s.kind === 'fade' || s.kind === 'letterbox') S.fx[s.kind] = s.to;
  }
  S.jobs = []; S.blocking = null;
  while (S.def && S.idx < S.steps.length) begin(S.steps[S.idx++]);
  if (S.def) finish(true);
  return true;
}

export function isScenePlaying() { return !!S.def; }
export function currentScene() {
  return S.def ? { id: S.def.id, def: S.def, t: S.t, step: S.idx, actors: S.actors, cam: S.cam, fx: S.fx, skipping: S.skipping } : null;
}
export function sceneActors() { return S.actors; }
export function sceneLens() { return S.def ? S.cam : null; }
export function sceneFx() { return S.fx; }

/** main.js calls this once per frame while a scene plays (play and dialogue modes). */
export function updateScene(dt) {
  if (!S.def) return;
  S.t += dt;
  for (const a of S.actors) a.t = (a.t || 0) + dt;
  while (S.def && !S.blocking && S.idx < S.steps.length) {
    const j = begin(S.steps[S.idx++]);
    if (!j.done) S.jobs.push(j);
    if (!j.step.async && !j.done) S.blocking = j;
  }
  if (!S.def) return;
  for (const j of S.jobs) if (!j.done) tick(j, dt);
  S.jobs = S.jobs.filter((j) => !j.done);
  if (S.blocking && S.blocking.done) S.blocking = null;
  if (S.def && !S.blocking && S.idx >= S.steps.length && !S.jobs.length) finish(false);
}
