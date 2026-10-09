/**
 * Star City Drift 1.5.0 — FREE prequel DLC "Second Shift" (playable Silas Boone). Game-logic lane.
 *
 * Story, cast, missions, collectibles, its OWN save slot (localStorage 'starCityDrift_dlc_silas'; the
 * main v4 save is never read-modified here), night grade and HUD portrait. main.js owns the loop and
 * calls into the controller from createDlc(api). Canon: /workspace/scd2/dlc/CANON_NOTES.md (Kody):
 *  - Silas never properly meets Matthew (Matthew only walks into frame, far off, in the closing scene).
 *  - Silas ends alive, free and standing downtown at x 700, golden hour, Cam at x 520.
 *  - Sets up (and solves none of): the deliberate leftovers swap, Priya's missing map shipment, the
 *    crate moved after hours (not Hank's old crew); the "S.B. — 2nd shift" lantern left by the bridge.
 *  - Dee doesn't know his name; Priya and Hank's world knows him as "Mr. Boone". He never openly commands
 *    the alley crews. He fights with his overhead / lunge / jump-slam art (silas_boss).
 */
import { registerTalkVoices } from './audio.js';
import * as Sprites from './sprites.js';
import { onSilasMove } from './silas_moves.js';

export const DLC_SAVE_KEY = 'starCityDrift_dlc_silas';
const DLC_SAVE_V = 1;

// ------------------------------------------------------------------ save slot (own key only)
function store() { try { return window.localStorage; } catch (_) { return null; } }
export function dlcLoad() {
  const s = store(); if (!s) return null;
  try {
    const raw = s.getItem(DLC_SAVE_KEY); if (!raw) return null;
    const d = JSON.parse(raw);
    if (!d || typeof d !== 'object' || d.v !== DLC_SAVE_V) return null;
    return d;
  } catch (_) { return null; }
}
function dlcWrite(d) { const s = store(); if (!s) return false; try { s.setItem(DLC_SAVE_KEY, JSON.stringify(d)); return true; } catch (_) { return false; } }
/** A prequel run in progress (Continue Prequel). */
export function dlcHasRun() { const d = dlcLoad(); return !!(d && d.run && !d.run.done); }
/** Ever finished (unlocks Silas's Suit in the main game). */
export function dlcCompleted() { const d = dlcLoad(); return !!(d && d.completed); }

// ------------------------------------------------------------------ cast (new characters; procedural placeholder bodies)
// Talk voices (procedural, js/audio.js). Main-cast cameos (priya, dee, cam) keep their own voices.
registerTalkVoices({
  lou: { wave: 'triangle', f0: 150, rate: 0.1, len: 0.08, steps: [1, 0.92, 1.1], vowels: ['o', 'uh', 'a'], fs: 0.95, grit: 0.15, greet: ['uh', 'o'] },
  ivy: { wave: 'sine', f0: 360, rate: 0.06, len: 0.045, steps: [1, 1.2, 1.35, 1.5], vowels: ['i', 'e', 'a'], fs: 1.2, greet: ['e', 'i'] },
  gus: { wave: 'triangle', f0: 175, rate: 0.085, len: 0.07, steps: [1, 1.1, 0.95], vowels: ['a', 'u', 'o'], fs: 1.0, greet: ['a', 'u'] },
  pip: { wave: 'square', f0: 410, rate: 0.045, len: 0.035, steps: [1, 1.25, 1.5, 1.33], vowels: ['i', 'ae', 'e'], fs: 1.3, greet: ['ae', 'i'] },
  vera: { wave: 'triangle', f0: 245, rate: 0.08, len: 0.06, steps: [1, 0.9, 1.12], vowels: ['e', 'a', 'o'], fs: 1.1, grit: 0.1, greet: ['e', 'a'] },
  foreman: { wave: 'sawtooth', f0: 88, rate: 0.12, len: 0.1, steps: [1, 0.9, 1.05], vowels: ['o', 'uh', 'a'], fs: 0.82, grit: 0.45, greet: ['uh', 'o'], greetFall: true }
});
const SILAS = { id: 'silas', name: 'Silas Boone' };
const S = (t) => ({ id: 'silas', name: 'Silas Boone', text: t });
const L = (who, t) => ({ id: who.id, name: who.name, text: t });

const CAST = {
  lou: { id: 'lou', name: 'Lou Badger', role: 'Night newsstand', color: '#7a5a3a' },
  priya: { id: 'priya', name: 'Priya Shah', role: 'Valley Pages', color: '#8e44ad' },
  ivy: { id: 'ivy', name: 'Ivy Marsh', role: 'Bike courier', color: '#2e86c1' },
  gus: { id: 'gus', name: 'Gus Pell', role: 'Night dock clerk', color: '#b7950b' },
  pip: { id: 'pip', name: 'Pip', role: 'Courier kid', color: '#27ae60' },
  dee: { id: 'dee', name: 'Dee Morales', role: "Dee's Diner", color: '#d35400' },
  cam: { id: 'cam', name: 'Cam Ortiz', role: 'Rideshare driver', color: '#f1c40f' }
};
const NPC_X = { lou: ['downtown', 430], priya: ['pages', 380], ivy: ['pages', 760], gus: ['rails', 320], pip: ['diner', 980], dee: ['diner', 320], cam: ['downtown', 520] };

// ------------------------------------------------------------------ collectibles (prequel only; ids are dlc_*)
const COLLECTIBLES = [
  { id: 'dlc_manifest', name: 'Shipping Manifest Page', area: 'pages', x: 860, after: 'm2' },
  { id: 'dlc_thermos', name: 'Night-Shift Thermos', area: 'gym', x: 520 },
  { id: 'dlc_cufflink', name: 'Silver Cufflink', area: 'skate', x: 640 },
  { id: 'dlc_switchkey', name: 'Brass Switch Key', area: 'rails', x: 1120, after: 'm3' },
  { id: 'dlc_watch', name: "Foreman's Pocket Watch", area: 'star', x: 720, after: 'm5' }
];

// ------------------------------------------------------------------ story
/**
 * steps: talk (npc, lines) · tutorial · fight (count, color) · survive (sec) · boss (who) · goto (area, x)
 *        · scene (lines, then auto) · use (an object to press talk on) · finale
 */
export const MISSIONS = [
  { id: 'm1', title: 'Polite Introductions', area: 'downtown', night: true,
    sub: 'Jefferson Street, after midnight. Somebody new is collecting "rent".',
    steps: [
      { type: 'talk', npc: 'lou', obj: 'Talk to Lou at the night newsstand', lines: [
        L(CAST.lou, "Evening, Mr. Boone. Paper's late. So's everybody else tonight."),
        S("Lou. Who's the new crew leaning on your stand?"),
        L(CAST.lou, "Calls themselves the Foreman's boys. Want 'rent' for the corner. Here they come now."),
        S("Then let's have a polite word with them. Watch the technique, Lou.")] },
      { type: 'tutorial', obj: 'Show the Foreman\'s boys all six moves', count: 3 },
      { type: 'talk', npc: 'lou', obj: 'Check on Lou', lines: [
        L(CAST.lou, "Didn't know a coat that nice could move like that."),
        S("Everyone has something in them, Lou. The trick is knowing what."),
        L(CAST.lou, "Word is the Foreman's waiting on a delivery. Rare maps, for the bookshop. Valley Pages."),
        S("Is it, now. Then I'll go and offer to help.")] }
    ] },
  { id: 'm2', title: 'Homework', area: 'pages', night: true,
    sub: 'Valley Pages. Priya Shah is expecting a delicate shipment, and Silas is expecting to help.',
    steps: [
      { type: 'talk', npc: 'priya', obj: 'Offer Priya your help at Valley Pages', lines: [
        L(CAST.priya, "Mr. Boone. We're closed."),
        S("Then I'm early for tomorrow. I hear you're expecting a delicate shipment."),
        L(CAST.priya, "I hear lots of things. If I need help, I'll ask for it."),
        S("Of course. I only ever offer."),
        L(CAST.priya, "And that is exactly what worries me. Good night, Mr. Boone.")] },
      { type: 'fight', obj: 'A courier is being shaken down outside. Step in.', count: 4, color: '#8e44ad', toast: 'The Foreman\'s boys have the courier cornered!' },
      { type: 'talk', npc: 'ivy', obj: 'Talk to the courier', lines: [
        L(CAST.ivy, "They grabbed my clipboard! That's the rail paperwork for Ms. Shah's crate."),
        S("And here it is, back in your hands. Quite safe."),
        L(CAST.ivy, "Thanks, mister. Wait… a page is missing."),
        S("Pages go missing in this town. The crate comes in at the Rail Yards… second shift, wasn't it?"),
        L(CAST.ivy, "How did you — never mind. I didn't say anything.")] }
    ] },
  { id: 'm3', title: 'Second Shift', area: 'rails', night: true,
    sub: 'The Rail Yards after hours. Not Hank\'s old crew. Somebody with a foreman\'s whistle.',
    steps: [
      { type: 'talk', npc: 'gus', obj: 'Find the night dock clerk at the Rail Yards', lines: [
        L(CAST.gus, "New on nights. They said a man in a long coat might come by."),
        S("They were right. Who's moving freight at this hour?"),
        L(CAST.gus, "Not Hank's old crew, they're all retired. Some outfit with a foreman's whistle. Listen —"),
        S("I hear it. Stay behind the switch house, Gus.")] },
      { type: 'survive', obj: 'Hold the yard', sec: 40, color: '#d35400', toast: 'Dock hands! Hold the yard!' },
      { type: 'talk', npc: 'gus', obj: 'Talk to Gus', lines: [
        L(CAST.gus, "The crate's gone. While you were busy, they rolled it out the far gate."),
        S("So they did. Let it travel. Things that travel leave tracks."),
        L(CAST.gus, "Every night-shift lantern gets initials. What do I paint on yours?"),
        S("S.B. Second shift."),
        L(CAST.gus, "'S.B. — 2nd shift.' There you go. Mind the bridge, somebody's been signaling from it.")],
        reward: "Got the Night-Shift Lantern: 'S.B. — 2nd shift'" }
    ] },
  { id: 'm4', title: 'Signals on the Bridge', area: 'river', night: true,
    sub: 'A lamp blinking on the River Bridge after dark.',
    steps: [
      { type: 'goto', area: 'river', x: 560, obj: 'Follow the signal lamp to the River Bridge' },
      { type: 'scene', lines: [
        { id: 'vera', name: 'Vera Lisk', text: "That lamp's for my friends, Mr. Boone. Not for you." },
        S("Then your friends will miss the message. Shall we discuss it?"),
        { id: 'vera', name: 'Vera Lisk', text: 'The Foreman said you talk too much.' },
        S("The Foreman is right more often than he knows.")] },
      { type: 'boss', who: 'vera', obj: 'Defeat Vera Lisk, the Foreman\'s lieutenant', adds: 2 },
      { type: 'scene', lines: [
        { id: 'vera', name: 'Vera Lisk', text: 'Mill Mountain. He\'ll be at the Star. Go and lose there.' },
        S("…My lantern. It went under the rail."),
        S("Leave it. Someone will find it. Lanterns are for being found.")],
        reward: 'The S.B. lantern stays under the bridge rail…' }
    ] },
  { id: 'm5', title: 'The Foreman', area: 'star', night: true,
    sub: 'Mill Mountain, under the Star. The man with the whistle.',
    steps: [
      { type: 'goto', area: 'star', x: 480, obj: 'Climb to the Mill Mountain Star' },
      { type: 'scene', lines: [
        { id: 'foreman', name: 'Mort "The Foreman" Kessler', text: "Boone. You've been asking questions all night." },
        S("And you've been answering them, Mr. Kessler. Mostly with your fists."),
        { id: 'foreman', name: 'Mort "The Foreman" Kessler', text: "That crate's not yours." },
        S("Nor yours, it seems. Shall we?")] },
      { type: 'boss', who: 'foreman', obj: 'Defeat the Foreman', adds: 2, final: true },
      { type: 'scene', lines: [
        { id: 'foreman', name: 'Mort "The Foreman" Kessler', text: 'Who do you even work for?' },
        S("Nearly dawn, Mr. Kessler. Go home. Take your whistle."),
        S("The crate, the maps, the bridge… everyone in this town has something worth knowing.")],
        reward: 'The crews scatter into the dark. Dawn breaks over the Star.' }
    ] },
  { id: 'm6', title: 'Curious Coincidence', area: 'diner', night: false,
    sub: 'The next evening. Golden hour on Jefferson Street.',
    steps: [
      { type: 'talk', npc: 'pip', obj: "Meet Pip behind Dee's Diner", lines: [
        L(CAST.pip, "Package for you, Mr. Boone. No questions, like you said."),
        S("Questions are my department, Pip. Off you go.")] },
      { type: 'talk', npc: 'dee', obj: 'Have a word at the counter', lines: [
        L(CAST.dee, "Evening! Table, or to-go?"),
        S("Just admiring your pick-up shelf. Busy night?"),
        L(CAST.dee, "Regulars. Two leftover bags tonight, same brown paper. One's for a regular who always forgets his."),
        S("Then let's make sure he takes one home tonight.")] },
      { type: 'use', area: 'diner', x: 560, label: 'Swap the to-go bags', obj: 'Swap the bags on the pick-up shelf', lines: [
        S("Two bags on the shelf. The ticket on one reads 'Matthew Rose — leftovers, to go.'"),
        S("The parcel goes into the other bag… and the tickets trade places."),
        S("Matthew Rose. Let's see what a man does with somebody else's leftovers.")],
        reward: "Matthew Rose's ticket now sits on somebody else's leftovers, parcel inside." },
      { type: 'goto', area: 'downtown', x: 700, obj: 'Take your spot on Jefferson Street' },
      { type: 'finale' }
    ] }
];

const TUTORIAL = [
  ['jab', "Gentleman's Jab", 'punch ×3'],
  ['grip', 'Velvet Grip', 'heavy near a foe'],
  ['handshake', 'Iron Handshake', 'Star Drive / special'],
  ['lastword', 'Last Word', 'kick: counter stance'],
  ['stare', 'Cold Stare', 'talk with no one near'],
  ['rush', 'Boss Rush', 'sprint + punch']
];
export const TUTORIAL_MOVES = TUTORIAL;

// ------------------------------------------------------------------ portrait (Silas head crop from the boss art)
let portraitUrl = null;
/** Anim key for playable Silas: Jack's 'silas_player' once installed, else the boss art. */
export function silasPlayerKey() {
  // strict: the alias fallback in sprites.js would map an unknown 'silas_player' onto the NPC 'silas' set
  try { if (typeof Sprites.listAnims === 'function') { const st = Sprites.listAnims('silas_player'); if (st.includes('stance') && st.includes('hs_slam') && st.includes('combo1')) return 'silas_player'; } } catch (_) { /* not loaded */ }
  return 'silas_boss';
}
export function silasPortraitSrc() {
  // Jack's bust (portrait_silas.png) through whichever getter sprites.js exposes once installed
  for (const fn of ['getCharacterPortrait', 'getPortrait', 'getCastPortrait']) {
    try {
      const g = Sprites[fn];
      if (typeof g === 'function') { const img = g('silas_player') || g('silas'); if (img && img.src && /silas/i.test(img.src) && img.complete && img.naturalWidth) return img.src; }
    } catch (_) { /* optional helper */ }
  }
  if (portraitUrl) return portraitUrl;
  try {
    const f = Sprites.getAnimFrame && Sprites.getAnimFrame('silas_boss', 'idle', 0);
    if (!f || !f.img || !f.img.complete) return null;
    const ax = f.anchorX != null ? f.anchorX : f.sw / 2;
    // find the head: first opaque row near the anchor column
    const c0 = document.createElement('canvas'); c0.width = f.sw; c0.height = f.sh;
    const g0 = c0.getContext('2d'); g0.drawImage(f.img, f.sx, f.sy, f.sw, f.sh, 0, 0, f.sw, f.sh);
    const data = g0.getImageData(0, 0, f.sw, f.sh).data;
    let top = 0;
    outer: for (let y = 0; y < f.sh; y++) for (let x = Math.max(0, Math.round(ax) - 30); x < Math.min(f.sw, Math.round(ax) + 30); x++) if (data[(y * f.sw + x) * 4 + 3] > 40) { top = y; break outer; }
    let minX = f.sw, maxX = 0;
    for (let y = top; y < Math.min(f.sh, top + 40); y++) for (let x = 0; x < f.sw; x++) if (data[(y * f.sw + x) * 4 + 3] > 40) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); }
    const cx = maxX > minX ? (minX + maxX) / 2 : ax, size = 64;
    const c = document.createElement('canvas'); c.width = 112; c.height = 112;
    const g = c.getContext('2d'); g.imageSmoothingEnabled = false;
    g.drawImage(c0, Math.round(cx - size / 2), Math.max(0, top - 6), size, size, 0, 0, 112, 112);
    portraitUrl = c.toDataURL('image/png');
  } catch (_) { portraitUrl = null; }
  return portraitUrl;
}

// ------------------------------------------------------------------ night grade
export function drawNightGrade(ctx, W, H, t) {
  ctx.save();
  ctx.globalCompositeOperation = 'multiply';
  ctx.fillStyle = 'rgb(92,104,150)'; ctx.fillRect(0, 0, W, H);
  ctx.globalCompositeOperation = 'screen';
  for (let i = 0; i < 4; i++) { // sodium street lamps
    const x = ((i + 0.5) * W) / 4, y = H * 0.32;
    const g = ctx.createRadialGradient(x, y, 4, x, y + 120, 260);
    g.addColorStop(0, `rgba(255,190,110,${0.22 + 0.02 * Math.sin(t * 3 + i)})`); g.addColorStop(1, 'rgba(255,170,80,0)');
    ctx.fillStyle = g; ctx.fillRect(x - 260, 0, 520, H);
  }
  ctx.globalCompositeOperation = 'source-over';
  const v = ctx.createRadialGradient(W / 2, H * 0.55, H * 0.3, W / 2, H * 0.55, W * 0.72);
  v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(4,6,16,0.5)');
  ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
  ctx.restore();
}

// ------------------------------------------------------------------ controller
/**
 * api (from main.js): toast(msg, urgent), sfx(name), sting(name), voice(char, kind, opts),
 *   spawnCrew(n, { color, wave, tint }) → enemies[], spawnBoss(who, adds) → boss, enemies() → list,
 *   hostiles() → bool, player() → p, areaId() → id, setSpecial(v), heal(n), say(lines, onDone),
 *   missionCard({ title, name, sub }, onDone), ending(), areaWidth(id), difficulty() → id
 */
const TRANSIENT = ['sceneOn', 'finaleOn', 'spawned', 'stepT', 'timer'];
/**
 * 1.5.1 self-heal for a loaded run (stale / blank objective, Save & Quit mid-scene, out-of-range indices):
 * a run saved inside the closing scene resumes at its checkpoint (the "Take your spot" step, so the scene replays),
 * any unknown step falls back to the start of its mission. Exported for tests.
 */
export function healRun(run) {
  const r = { ...run };
  for (const k of TRANSIENT) delete r[k];
  const last = MISSIONS.length - 1;
  let mi = Number.isInteger(r.mi) ? r.mi : 0, si = Number.isInteger(r.si) ? r.si : 0;
  if (mi < 0) { mi = 0; si = 0; }
  if (mi > last) { mi = last; si = MISSIONS[last].steps.findIndex((s) => s.type === 'finale'); }
  const steps = MISSIONS[mi].steps;
  if (si < 0 || si >= steps.length) si = 0;
  if (steps[si].type === 'finale') si = Math.max(0, si - 1); // checkpoint: the walk to Jefferson Street → the scene replays
  r.mi = mi; r.si = si;
  if (r.done && !(mi === last && si >= steps.length - 2)) r.done = false;
  if (!Array.isArray(r.collected)) r.collected = [];
  if (!Array.isArray(r.tutorialDone)) r.tutorialDone = [];
  return r;
}

export function createDlc(api) {
  let st = null; // run state
  const done = new Set(); // tutorial moves this mission
  let unsub = null;

  function fresh(difficulty) {
    return { mi: 0, si: 0, areaId: 'downtown', x: 200, y: null, hp: null, special: 100, difficulty: difficulty || 'normal',
      collected: [], playTime: 0, score: 0, done: false, flags: {} };
  }
  const mission = () => MISSIONS[st.mi] || null;
  const stepDef = () => { const m = mission(); return m ? m.steps[st.si] || null : null; };

  function persist(extra = {}) {
    if (!st) return false;
    const prev = dlcLoad() || {};
    return dlcWrite({ v: DLC_SAVE_V, savedAt: Date.now(), completed: !!(prev.completed || extra.completed), completedAt: prev.completedAt || extra.completedAt || null,
      bestDifficulty: extra.bestDifficulty || prev.bestDifficulty || null, run: snapshot() });
  }
  /** 1.5.1: what a save keeps. In-flight flags (a scene/finale playing, a spawned fight) are never saved. */
  function snapshot() {
    const r = { ...st };
    for (const k of TRANSIENT) delete r[k];
    const s = stepDef(); if (s && s.type === 'finale' && !st.done) r.si = Math.max(0, st.si - 1); // checkpoint: the closing scene replays
    r.tutorialDone = [...done];
    return r;
  }

  function listen() {
    if (unsub) return;
    unsub = onSilasMove((move, d) => {
      if (!st) return;
      const s = stepDef(); if (!s || s.type !== 'tutorial') return;
      const k = move === 'jab' ? (d.step === 3 ? 'jab' : null)
        : move === 'grip_throw' || move === 'grip_boss' ? 'grip'
        : move === 'handshake' ? 'handshake'
        : move === 'lastword_stance' || move === 'lastword_counter' ? 'lastword'
        : move === 'stare' ? 'stare' : move === 'rush' ? 'rush' : null;
      if (k && !done.has(k)) {
        done.add(k);
        const row = TUTORIAL.find((r) => r[0] === k);
        api.toast(`✓ ${row[1]} (${done.size}/6)`, true); api.sfx('ui_select');
      }
    });
  }

  function beginStep() {
    const s = stepDef(); if (!s) return;
    st.stepT = 0; st.spawned = false; st.timer = s.sec || 0; st.sceneOn = false; st.finaleOn = false;
    if (s.type === 'tutorial') { done.clear(); api.setSpecial(100); }
  }

  function advance() {
    const m = mission();
    st.si++;
    if (st.si >= m.steps.length) { completeMission(); return; }
    beginStep(); persist();
  }

  function completeMission() {
    const m = mission();
    api.sting('victory_big');
    const next = MISSIONS[st.mi + 1];
    st.mi++; st.si = 0;
    persist();
    api.missionCard({ title: 'Mission Complete', name: `${st.mi}/6 · ${m.title}`, sub: next ? `Next: ${next.title} — ${next.sub}` : '' }, () => {
      if (next) { beginStep(); api.toast(next.title, true); if (!next.night) api.toast('The next evening. Golden hour.'); }
    });
  }

  function npcActive(id) {
    const s = stepDef();
    return s && s.type === 'talk' && s.npc === id;
  }

  return {
    get state() { return st; },
    missions: MISSIONS,
    collectibles: COLLECTIBLES,
    newRun(difficulty) { st = fresh(difficulty); listen(); beginStep(); persist(); return st; },
    continueRun() {
      const d = dlcLoad(); if (!d || !d.run) return null;
      const run = healRun(d.run);
      st = { ...fresh(run.difficulty), ...run }; listen(); beginStep();
      const s = stepDef(); if (s && s.type === 'tutorial') for (const k of run.tutorialDone) if (TUTORIAL.some((t) => t[0] === k)) done.add(k);
      delete st.tutorialDone;
      persist(); // the healed run replaces a stale one on disk
      return st;
    },
    stop() { st = null; },
    persist(snap) { if (!st) return false; if (snap) Object.assign(st, snap); return persist(); },
    isNight() { const m = mission(); return m ? m.night !== false : false; },
    music(hostiles, bossOn) { return bossOn ? 'dlc_boss' : hostiles ? 'dlc_fight' : 'dlc_street'; },
    objective() {
      const m = mission(), s = stepDef();
      if (!m) return { title: 'Prequel complete', desc: 'Silas waits on Jefferson Street.' };
      let desc = s ? s.obj || (s.type === 'scene' ? '…' : s.type === 'finale' ? 'Watch Jefferson Street' : '') || m.sub : m.sub;
      if (s && s.type === 'tutorial') desc = TUTORIAL.map(([k, n]) => `${done.has(k) ? '✓' : '○'} ${n}`).join(' · ');
      if (s && s.type === 'survive') desc = `${s.obj}: ${Math.max(0, Math.ceil(st.timer))}s`;
      return { title: `${st.mi + 1}/6 · ${m.title}`, desc };
    },
    /** 1.5.1: combat banner wording for the current step. */
    bannerText() {
      const s = stepDef(); if (!s) return null;
      if (s.type === 'survive') return 'HOLD THE YARD!';
      if (s.type === 'boss') return s.who === 'vera' ? 'BOSS: Vera Lisk' : 'BOSS: The Foreman';
      return null;
    },
    collectText() { return `Keepsakes ${st.collected.length}/${COLLECTIBLES.length}`; },
    tutorialDone: () => new Set(done),
    /** NPCs standing in this area right now. */
    npcs(areaId) {
      if (!st) return [];
      const list = [];
      const m = mission();
      for (const [id, [area, x]] of Object.entries(NPC_X)) {
        if (area !== areaId) continue;
        const mid = m ? m.id : 'end';
        // who is around when
        const here = id === 'lou' ? mid === 'm1' || mid === 'm2'
          : id === 'priya' ? mid === 'm2' || mid === 'm3'
          : id === 'ivy' ? mid === 'm2' && st.si >= 1
          : id === 'gus' ? mid === 'm3' || mid === 'm4'
          : id === 'pip' ? mid === 'm6' && st.si === 0
          : id === 'dee' ? mid === 'm6'
          : id === 'cam' ? mid === 'm6' || mid === 'end' : false;
        if (here) list.push({ ...CAST[id], area, x, dlc: true });
      }
      return list;
    },
    linesFor(npc) {
      const s = stepDef();
      if (npcActive(npc.id)) return s.lines;
      const idle = {
        lou: [L(CAST.lou, 'Quiet night, Mr. Boone. Quiet-ish.')],
        priya: [L(CAST.priya, 'Still closed, Mr. Boone.')],
        ivy: [L(CAST.ivy, 'I just deliver things. I don\'t read them.')],
        gus: [L(CAST.gus, 'Lantern suits you.')],
        pip: [L(CAST.pip, 'Can\'t talk, got deliveries.')],
        dee: [L(CAST.dee, 'Kitchen closes at ten, hon.')],
        cam: [L(CAST.cam, 'App keeps sending me to the wrong pin. Need a ride, sir?'), S('Not tonight. I like it right here.')]
      };
      return idle[npc.id] || [L(npc, '…')];
    },
    /** After a dialogue with an NPC closes. */
    onTalkDone(npc) {
      if (!st) return;
      const s = stepDef();
      if (npcActive(npc.id)) { if (s.reward) api.toast(s.reward, true); advance(); }
    },
    /** 'use' step: something to press talk on (no NPC). */
    usable(areaId, x) {
      const s = stepDef();
      return s && s.type === 'use' && s.area === areaId && Math.abs(x - s.x) < 60 ? s : null;
    },
    use() { const s = stepDef(); if (!s || s.type !== 'use') return false; api.say(s.lines, () => { if (s.reward) api.toast(s.reward, true); api.sfx('pickup'); advance(); }); return true; },
    usableMarker() { const s = stepDef(); return s && s.type === 'use' ? { area: s.area, x: s.x, label: s.label } : null; },
    /** Per-frame mission logic in play. */
    update(dt) {
      if (!st) return;
      st.playTime += dt;
      const s = stepDef(); if (!s) return;
      st.stepT += dt;
      const m = mission();
      const here = api.areaId();
      switch (s.type) {
        case 'tutorial': {
          if (here !== m.area) break;
          if (!api.hostiles()) {
            if (done.size >= 6) { api.toast('Tutorial complete. Lou looks impressed.', true); advance(); break; }
            api.spawnCrew(s.count, { color: '#7f8c8d', wave: 0 }); api.toast(st.spawned ? 'More of the Foreman\'s boys!' : 'The Foreman\'s boys! Show them your manners.', true); st.spawned = true;
          }
          if (!done.has('handshake')) api.setSpecial(100);
          break;
        }
        case 'fight': {
          if (here !== m.area) break;
          if (!st.spawned) { st.spawned = true; api.spawnCrew(s.count, { color: s.color, wave: 1 }); if (s.toast) api.toast(s.toast, true); }
          else if (!api.hostiles()) { api.toast('Street clear.'); api.heal(15); advance(); }
          break;
        }
        case 'survive': {
          if (here !== m.area) break;
          if (!st.spawned) { st.spawned = true; st.timer = s.sec; api.toast(s.toast, true); }
          st.timer -= dt;
          if (st.timer <= 0) { api.clearFoes('They scatter with the crate.'); api.heal(20); advance(); break; }
          if (!api.hostiles() || (api.foeCount() < 2 && st.stepT > 3)) { api.spawnCrew(api.hostiles() ? 2 : 3, { color: s.color, wave: 1 + Math.floor((s.sec - st.timer) / 15) }); st.stepT = 0; }
          break;
        }
        case 'goto': {
          if (here === s.area && Math.abs(api.player().x - s.x) < 70) advance();
          break;
        }
        case 'scene': {
          if (!st.sceneOn) { st.sceneOn = true; api.say(s.lines, () => { st.sceneOn = false; if (s.reward) api.toast(s.reward, true); advance(); }); }
          break;
        }
        case 'boss': {
          if (here !== m.area) break;
          if (!st.spawned) { st.spawned = true; api.spawnBoss(s.who, s.adds); }
          else if (!api.hostiles()) { api.heal(30); advance(); }
          break;
        }
        case 'finale': {
          if (!st.finaleOn) { st.finaleOn = true; api.finale(() => { st.done = true; st.finaleOn = false; persist({ completed: true, completedAt: Date.now(), bestDifficulty: st.difficulty }); api.ending(); }); }
          break;
        }
        default: break;
      }
    },
    /** Knocked out: restart the current step (fights respawn), full health. */
    onKO() { if (!st) return; st.spawned = false; st.sceneOn = false; if (stepDef() && stepDef().type === 'survive') st.timer = stepDef().sec; },
    missionArea() { const m = mission(), s = stepDef(); if (!m) return 'downtown'; return (s && s.area) || m.area; },
    /** Minimap destination. */
    dest() {
      const m = mission(), s = stepDef(); if (!m || !s) return { areaId: 'downtown', x: 700 };
      if (s.type === 'talk') { const [a, x] = NPC_X[s.npc]; return { areaId: a, x }; }
      if (s.area) return { areaId: s.area, x: s.x || null };
      return { areaId: m.area, x: null };
    },
    /** Should normal encounters spawn here? (only on the way, at night, lightly) */
    ambientFights() { const m = mission(); return !!(m && m.night); },
    /** Collectibles visible in an area. */
    visibleCollectibles(areaId) {
      if (!st) return [];
      const passed = (mid) => MISSIONS.findIndex((m) => m.id === mid) < st.mi;
      return COLLECTIBLES.filter((c) => c.area === areaId && !st.collected.includes(c.id) && (!c.after || passed(c.after)));
    },
    take(c) { if (!st.collected.includes(c.id)) { st.collected.push(c.id); api.toast(`Keepsake: ${c.name} (${st.collected.length}/${COLLECTIBLES.length})`, true); api.sfx('pickup'); persist(); } },
    // debug / tests
    debugJump(mi, si = 0) { st.mi = mi; st.si = si; st.sceneOn = false; st.finaleOn = false; beginStep(); persist(); },
    debugAdvance() { advance(); },
    debugTutorial(keys) { for (const k of keys) done.add(k); }
  };
}
