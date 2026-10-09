/**
 * Star City Drift — audio (game-logic lane).
 *
 * Everything is synthesised live in WebAudio: four original looping themes (title, street, fight,
 * Silas boss), stings, every SFX and every character voice. There are no audio files, so the
 * payload is this one module, the loops are sample-accurate (a step sequencer, not a decoded file),
 * it works offline and inside the Electron/Android shells, and there are no codec gaps on iOS.
 *
 * The same Engine runs on a real AudioContext (the game) or an OfflineAudioContext
 * (renderPreview() for the shareable preview), so the preview is exactly what the game plays.
 *
 * Nothing here ever throws into the game: every public call is a no-op until the first user
 * gesture unlocks audio (required on iOS), or when WebAudio is missing.
 */
import { NPC_DEFS } from './npcs.js';

// ------------------------------------------------------------------ notes / helpers
const PC = { C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5, 'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11 };
const midi = (n) => { const m = /^([A-G][#b]?)(-?\d)$/.exec(n); if (!m) throw new Error('bad note ' + n); return 12 * (+m[2] + 1) + PC[m[1]]; };
const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);
const rnd = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const QUAL = { '': [0, 4, 7], m: [0, 3, 7], '7': [0, 4, 7, 10], m7: [0, 3, 7, 10], maj7: [0, 4, 7, 11], sus: [0, 5, 7], dim: [0, 3, 6] };
function chord(name) {
  const m = /^([A-G][#b]?)(.*)$/.exec(name);
  return { pc: PC[m[1]], iv: QUAL[m[2]] || QUAL[''] };
}
/** "E5 - - . A5 …" → events. '-' holds the previous note, '.' is a rest. One token = one 16th. */
function parseLine(str) {
  const toks = str.trim().split(/\s+/), ev = [];
  let cur = null;
  toks.forEach((t, i) => {
    if (t === '-') { if (cur) cur.len++; }
    else if (t === '.') cur = null;
    else { cur = { step: i, m: midi(t), len: 1 }; ev.push(cur); }
  });
  return { ev, steps: toks.length };
}

// ------------------------------------------------------------------ the music (all original)
// Bass grooves: R root, O octave, F fifth, b flat 7th, P chromatic approach to next bar's root.
const SONGS = {
  // "Star City Nights" — dusk over Mill Mountain, hopeful A minor.
  title: {
    bpm: 104, swing: 0, delayBeats: 0.75, chords: ['Am', 'F', 'C', 'G', 'Am', 'F', 'G', 'E'],
    bass: 'R - - . . . R . O - . . R . F .', bassVol: 0.8,
    lead: [
      'E5 - - . A5 - - . B5 - C6 - B5 - A5 -',
      'A5 - - - - - G5 - F5 - - - E5 - C5 -',
      'E5 - - . G5 - - . C6 - - - B5 - G5 -',
      'D5 - - - - - - - . . B4 - D5 - G5 -',
      'E5 - - . A5 - - . B5 - C6 - D6 - E6 -',
      'C6 - - - A5 - - - F5 - A5 - C6 - A5 -',
      'B5 - - - G5 - - - D6 - - - B5 - D6 -',
      'E6 - - - - - - - G#5 - - - B5 - - -'
    ],
    leadWave: 'square', leadVol: 0.8,
    arp: { every: 2, pat: 'updown', oct: 5, vol: 0.6 }, pad: 1, stab: null,
    drums: { k: 'x.......x.x.....', s: '....x.......x...', h: '..x...x...x...x.' },
    fill: { s: '....x.......x.xx' }, crash: [0]
  },
  // "Jefferson Street" — roaming groove, D dorian funk with brass stabs.
  street: {
    bpm: 116, swing: 0.14, delayBeats: 0.75, chords: ['Dm7', 'G7', 'Dm7', 'G7', 'Bbmaj7', 'C', 'Am7', 'A7'],
    bass: 'R - . R O . R . . R F . O b R P', bassVol: 0.95,
    lead: [
      'A4 - C5 . D5 - . . F5 - E5 - D5 - C5 .',
      'D5 - - - . . . . B4 - C5 . D5 - . .',
      'A4 - C5 . D5 - . . F5 - G5 - A5 - - .',
      'G5 - F5 - D5 - - - . . . . . . . .',
      'F5 - - . D5 - F5 . A5 - - - G5 - F5 -',
      'E5 - - - C5 - - . E5 - G5 - - - . .',
      'A5 - - . G5 - E5 . C5 - D5 - E5 - - .',
      'C#5 - - - E5 - - - G5 - - - A5 - - -'
    ],
    leadWave: 'sawtooth', leadVol: 0.62,
    arp: null, pad: 0.55, stab: '...x......x.....',
    drums: { k: 'x.....x...x.....', s: '....x.......x...', h: 'x.xxx.x.x.xxx.x.', o: '..............x.', g: '.......g......g.' },
    fill: { s: '....x.....x..xxx' }, crash: [0]
  },
  // "Clear the Street" — the fight theme, driving E minor.
  fight: {
    bpm: 140, swing: 0, delayBeats: 0.75, chords: ['Em', 'C', 'D', 'B7', 'Em', 'C', 'Am', 'B'],
    bass: 'R . O . R . O . R . O . R O b O', bassVol: 1,
    lead: [
      'E5 - - - G5 - - - B5 - - - A5 - G5 -',
      'E5 - - - - - - - . . G5 - A5 - B5 -',
      'A5 - - - F#5 - - - D5 - - - E5 - F#5 -',
      'D#5 - - - - - - - F#5 - - - B5 - - -',
      'E6 - - - D6 - B5 - G5 - - - A5 - B5 -',
      'C6 - - - B5 - G5 - E5 - - - G5 - C6 -',
      'B5 - - - A5 - - - E5 - A5 - C6 - E6 -',
      'D#6 - - - - - - - B5 - - - F#5 - - -'
    ],
    leadWave: 'square', leadVol: 0.8,
    arp: { every: 1, pat: 'up', oct: 4, vol: 0.75 }, pad: 0, stab: 'x.....x.........',
    drums: { k: 'x...x...x...x...', s: '....X.......X..g', h: 'x.x.x.x.x.x.x.x.', o: '..............x.', c: '....x.......x...' },
    fill: { s: '....X...x.x.xxxx', t: '............x.x.' }, crash: [0, 64]
  },
  // "Polite Stranger" — Silas Boone, ominous C minor with a Neapolitan turn.
  boss: {
    bpm: 152, swing: 0, delayBeats: 0.5, chords: ['Cm', 'Cm', 'Ab', 'G', 'Cm', 'Db', 'Fm', 'G7'],
    bass: 'R R O R R R O R R R O R b R O R', bassVol: 0.9, bassShort: true,
    lead: [
      'C5 - - - - - D5 - Eb5 - - - G5 - - -',
      'F5 - Eb5 - D5 - Eb5 - C5 - - - - - - -',
      'Ab5 - - - G5 - - - Eb5 - - - C5 - Eb5 -',
      'D5 - - - B4 - - - G4 - - - B4 - D5 -',
      'C6 - - - B5 - C6 - G5 - - - Eb5 - G5 -',
      'F5 - - - Ab5 - - - Db6 - - - C6 - Ab5 -',
      'G5 - - - Ab5 - G5 - F5 - Eb5 - D5 - C5 -',
      'B4 - - - D5 - - - F5 - - - G5 - B5 -'
    ],
    leadWave: 'sawtooth', leadVol: 0.75,
    arp: { every: 2, pat: 'down', oct: 4, vol: 0.55 }, pad: 0.8, stab: 'x..x..x.........',
    drums: { k: 'x..x..x.x..x..x.', s: '....x.......x...', h: 'x.x.x.x.x.x.x.x.', c: '............x...' },
    fill: { t: '........x.x.x.xx', s: '....x.........xx' }, crash: [0, 64]
  }
};
const STINGS = {
  // [time(s), note, len(s)] for the lead, plus a chord hit
  victory: { lead: [[0, 'G4', 0.09], [0.1, 'C5', 0.09], [0.2, 'E5', 0.09], [0.3, 'G5', 0.09], [0.42, 'C6', 0.9]], chord: [0.42, ['C4', 'E4', 'G4', 'C5'], 1.0], bass: [0.42, 'C2', 1.0], crash: 0.42, len: 1.6 },
  victory_big: { lead: [[0, 'G4', 0.12], [0.14, 'C5', 0.12], [0.28, 'E5', 0.12], [0.42, 'G5', 0.25], [0.7, 'F5', 0.12], [0.84, 'A5', 0.12], [0.98, 'C6', 0.25], [1.26, 'B5', 0.12], [1.4, 'D6', 0.12], [1.54, 'E6', 1.2]], chord: [1.54, ['C4', 'G4', 'C5', 'E5'], 1.4], bass: [1.54, 'C2', 1.4], crash: 1.54, len: 3.2 },
  gameover: { lead: [[0, 'G4', 0.32], [0.36, 'F#4', 0.32], [0.72, 'F4', 0.32], [1.08, 'E4', 1.3]], chord: [1.08, ['C3', 'Eb3', 'G3', 'Bb3'], 1.6], bass: [1.08, 'C2', 1.6], wave: 'triangle', len: 2.9 }
};
for (const s of Object.values(SONGS)) {
  s.bars = s.chords.length;
  s.len = s.bars * 16;
  s.ch = s.chords.map(chord);
  s.leadEv = parseLine(s.lead.join(' '));
  s.bassToks = s.bass.split(/\s+/);
  if (s.bassToks.length !== 16) throw new Error('bass groove must be 16 steps');
  s.leadAt = {}; for (const e of s.leadEv.ev) (s.leadAt[e.step] = s.leadAt[e.step] || []).push(e);
  if (s.leadEv.steps !== s.len) throw new Error('lead length mismatch');
}

// ------------------------------------------------------------------ character voices
const VOWEL = { a: [730, 1090, 2440], e: [530, 1840, 2480], i: [300, 2200, 3010], o: [570, 840, 2410], u: [320, 870, 2240], uh: [640, 1190, 2390], ae: [660, 1720, 2410] };
/** Fighters: f0 Hz, waveform, formant shift, grit (growl AM), breath (noise). */
const FIGHTERS = {
  matthew: { f0: 150, wave: 'sawtooth', fs: 1.0, grit: 0, breath: 0.15 },
  thug_purple: { f0: 106, wave: 'sawtooth', fs: 0.95, grit: 0.25, breath: 0.2 },
  thug_red: { f0: 82, wave: 'sawtooth', fs: 0.88, grit: 0.6, breath: 0.15 },
  thug_teal: { f0: 136, wave: 'square', fs: 1.1, grit: 0.05, breath: 0.08, nasal: true },
  thug_orange: { f0: 120, wave: 'sawtooth', fs: 1.0, grit: 0.15, breath: 0.6 },
  thug_grey: { f0: 68, wave: 'sawtooth', fs: 0.82, grit: 0.4, breath: 0.25 },
  silas_boss: { f0: 96, wave: 'sawtooth', fs: 0.92, grit: 0.06, breath: 0.35 },
  snatcher: { f0: 178, wave: 'square', fs: 1.14, grit: 0.1, breath: 0.3 }
};
const DEFAULT_TALK = { wave: 'triangle', f0: 220, rate: 0.08, len: 0.06, steps: [1, 1.12, 1.25, 1.5], vowels: ['a', 'e', 'o'], fs: 1 };
const talkProfile = (id) => (NPC_DEFS.find((n) => n.id === id) || {}).voice || DEFAULT_TALK;

// ------------------------------------------------------------------ engine
const SFX_COOLDOWN = { punch: 0.03, kick: 0.03, heavy: 0.04, finisher: 0.05, star: 0.08, whiff: 0.05, step: 0.09, block: 0.08, thud: 0.06, getup: 0.1, glass: 0.07, ui_move: 0.04, pickup: 0.08, denied: 0.25, save: 0.3, jump: 0.08, land: 0.08,
  kit_polo: 0.06, kit_photo: 0.06, kit_hoodie: 0.06, kit_jacket: 0.06, kit_street: 0.06, kit_varsity: 0.06, kit_varsity_hit: 0.05, kit_mechanic: 0.06,
  kit_diner: 0.06, kit_gold: 0.04, kit_webslinger: 0.06, kit_beacon: 0.06, kit_ironclad: 0.06 };
const MAX_SFX = 18, MAX_VOICES = 3;

class Engine {
  constructor(ac) {
    this.ac = ac;
    const sr = ac.sampleRate;
    this.master = ac.createGain();
    this.comp = ac.createDynamicsCompressor();
    this.comp.threshold.value = -12; this.comp.knee.value = 8; this.comp.ratio.value = 4;
    this.comp.attack.value = 0.004; this.comp.release.value = 0.2;
    this.post = ac.createGain(); this.post.gain.value = 0.8; // the compressor adds make-up gain: keep peaks < 0 dBFS
    this.master.connect(this.comp).connect(this.post).connect(ac.destination);
    this.musicBus = ac.createGain(); this.musicBus.connect(this.master);
    this.duck = ac.createGain(); this.duck.connect(this.musicBus);
    this.musicIn = ac.createGain(); this.musicIn.connect(this.duck);
    this.sfxBus = ac.createGain(); this.sfxBus.connect(this.master);
    this.sfxIn = ac.createGain(); this.sfxIn.connect(this.sfxBus);
    // noise + a generated room impulse (no files)
    this.noiseBuf = ac.createBuffer(1, sr * 2, sr);
    const nd = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
    this.musicVerb = ac.createConvolver();
    this.musicVerbIn = ac.createGain(); this.musicVerbIn.gain.value = 0.32;
    this.musicVerbIn.connect(this.musicVerb).connect(this.musicIn);
    this.sfxVerb = ac.createConvolver();
    // room impulse: built right away offline, a moment after the unlock gesture live (keeps the first tap snappy)
    const buildIR = () => {
      const irLen = Math.floor(sr * 1.4), ir = ac.createBuffer(2, irLen, sr), k = Math.exp(Math.log(0.0005) / irLen);
      for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); let e = 1; for (let i = 0; i < irLen; i++, e *= k) d[i] = (Math.random() * 2 - 1) * e; }
      this.musicVerb.buffer = ir; this.sfxVerb.buffer = ir;
    };
    if (typeof AudioContext !== 'undefined' && ac instanceof AudioContext) setTimeout(() => { try { buildIR(); } catch (_) { /* no reverb */ } }, 30);
    else buildIR();
    this.sfxVerbIn = ac.createGain(); this.sfxVerbIn.gain.value = 0.25;
    this.sfxVerbIn.connect(this.sfxVerb).connect(this.sfxBus);
    // tempo delay for the lead
    this.delay = ac.createDelay(1.5); this.delay.delayTime.value = 0.32;
    this.delayFb = ac.createGain(); this.delayFb.gain.value = 0.28;
    const dlp = ac.createBiquadFilter(); dlp.type = 'lowpass'; dlp.frequency.value = 2600;
    this.delayIn = ac.createGain(); this.delayIn.gain.value = 0.22;
    this.delayIn.connect(this.delay); this.delay.connect(dlp).connect(this.delayFb).connect(this.delay);
    dlp.connect(this.musicIn);
    this.players = [];
    this.cur = null; this.track = null;
    this.last = {}; this.activeSfx = []; this.activeVoices = []; this.voiceLast = {};
    this.musicOn = true;
  }
  now() { return this.ac.currentTime; }
  applySettings(s) {
    const t = this.now(), m = s.muted ? 0 : s.music * s.music, f = s.muted ? 0 : s.sfx * s.sfx;
    this.musicBus.gain.setTargetAtTime(m * 0.9, t, 0.03);
    this.sfxBus.gain.setTargetAtTime(f, t, 0.03);
    this.musicOn = m > 0;
  }
  // ---------- node helpers
  osc(type, f, t, dur) { const o = this.ac.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, t); o.start(t); o.stop(t + dur + 0.05); return o; }
  noise(t, dur) { const n = this.ac.createBufferSource(); n.buffer = this.noiseBuf; n.loop = true; n.start(t, Math.random() * 1.5); n.stop(t + dur + 0.05); return n; }
  filt(type, f, q = 0.8, t = 0) { const b = this.ac.createBiquadFilter(); b.type = type; b.frequency.setValueAtTime(f, t); b.Q.value = q; return b; }
  env(t, a, peak, dur) { const g = this.ac.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(a + 0.01, dur)); return g; }
  hold(t, a, peak, dur, rel) { const g = this.ac.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + a); g.gain.setValueAtTime(Math.max(0.0002, peak), t + Math.max(a, dur)); g.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(a, dur) + rel); return g; }
  sweep(param, t, a, b, dur) { param.setValueAtTime(a, t); param.exponentialRampToValueAtTime(Math.max(1, b), t + dur); }

  // ---------- instruments (music)
  bass(t, f, dur, vel, out) {
    const o1 = this.osc('sawtooth', f, t, dur + 0.1), o2 = this.osc('square', f / 2, t, dur + 0.1);
    const lp = this.filt('lowpass', f * 10 + 500, 7, t); lp.frequency.exponentialRampToValueAtTime(f * 2.2 + 120, t + 0.16);
    const s = this.ac.createGain(); s.gain.value = 0.5;
    const g = this.hold(t, 0.005, 0.42 * vel, dur, 0.06);
    o1.connect(lp); o2.connect(s).connect(lp); lp.connect(g).connect(out);
  }
  lead(t, f, dur, vel, out, wave) {
    const o1 = this.osc(wave, f, t, dur + 0.15), o2 = this.osc('sawtooth', f * 1.004, t, dur + 0.15);
    const lfo = this.osc('sine', 5.6, t, dur + 0.15), lg = this.ac.createGain();
    lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(f * 0.007, t + Math.min(0.35, dur));
    lfo.connect(lg); lg.connect(o1.frequency); lg.connect(o2.frequency);
    const lp = this.filt('lowpass', 3200, 1, t);
    const mix = this.ac.createGain(); mix.gain.value = 0.5;
    const g = this.hold(t, 0.012, 0.2 * vel, dur, 0.09);
    o1.connect(lp); o2.connect(mix).connect(lp); lp.connect(g); g.connect(out); g.connect(this.delayIn); g.connect(this.musicVerbIn);
  }
  arp(t, f, vel, out) {
    const o = this.osc('square', f, t, 0.14), lp = this.filt('lowpass', 3600, 2, t);
    lp.frequency.exponentialRampToValueAtTime(900, t + 0.1);
    const g = this.env(t, 0.003, 0.085 * vel, 0.12);
    o.connect(lp).connect(g); g.connect(out); g.connect(this.delayIn);
  }
  pad(t, fs, dur, vel, out) {
    const lp = this.filt('lowpass', 1300, 0.7, t), g = this.hold(t, 0.22, 0.05 * vel, dur, 0.35);
    for (const f of fs) for (const d of [-7, 7]) { const o = this.osc('sawtooth', f, t, dur + 0.5); o.detune.value = d; o.connect(lp); }
    lp.connect(g); g.connect(out); g.connect(this.musicVerbIn);
  }
  stab(t, fs, vel, out) {
    const lp = this.filt('lowpass', 3400, 2, t); lp.frequency.exponentialRampToValueAtTime(700, t + 0.18);
    const g = this.env(t, 0.004, 0.08 * vel, 0.24);
    for (const f of fs) { const o = this.osc('sawtooth', f, t, 0.3); o.detune.value = rnd(-6, 6); o.connect(lp); }
    lp.connect(g); g.connect(out); g.connect(this.musicVerbIn);
  }
  drum(kind, t, vel, out) {
    if (kind === 'k') {
      const o = this.osc('sine', 150, t, 0.32); this.sweep(o.frequency, t, 150, 44, 0.12);
      o.connect(this.env(t, 0.002, 0.95 * vel, 0.3)).connect(out);
      const n = this.noise(t, 0.02); n.connect(this.filt('highpass', 2000)).connect(this.env(t, 0.001, 0.18 * vel, 0.02)).connect(out);
    } else if (kind === 's' || kind === 'g') {
      const v = kind === 'g' ? 0.3 * vel : vel;
      const n = this.noise(t, 0.2); const g = this.env(t, 0.002, 0.4 * v, 0.18);
      n.connect(this.filt('highpass', 900)).connect(g); g.connect(out); g.connect(this.musicVerbIn);
      const o = this.osc('triangle', 200, t, 0.12); this.sweep(o.frequency, t, 200, 150, 0.1);
      o.connect(this.env(t, 0.002, 0.28 * v, 0.1)).connect(out);
    } else if (kind === 'c') {
      const n = this.noise(t, 0.2), bp = this.filt('bandpass', 1400, 1.2), g = this.ac.createGain();
      g.gain.setValueAtTime(0.0001, t);
      for (let i = 0; i < 3; i++) { g.gain.setValueAtTime(0.32 * vel, t + i * 0.011); g.gain.exponentialRampToValueAtTime(0.02, t + i * 0.011 + 0.009); }
      g.gain.setValueAtTime(0.3 * vel, t + 0.033); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.17);
      n.connect(bp).connect(g); g.connect(out); g.connect(this.musicVerbIn);
    } else if (kind === 'h' || kind === 'o') {
      const n = this.noise(t, 0.3);
      n.connect(this.filt('highpass', 7200)).connect(this.env(t, 0.001, 0.11 * vel, kind === 'o' ? 0.24 : 0.04)).connect(out);
    } else if (kind === 't') {
      const o = this.osc('sine', 210, t, 0.3); this.sweep(o.frequency, t, 210, 95, 0.25);
      o.connect(this.env(t, 0.002, 0.5 * vel, 0.26)).connect(out);
    } else if (kind === 'x') {
      const n = this.noise(t, 1.3), g = this.env(t, 0.002, 0.16 * vel, 1.2);
      n.connect(this.filt('highpass', 4200)).connect(g); g.connect(out); g.connect(this.musicVerbIn);
    }
  }

  // ---------- sequencer
  startSong(name, at, fadeIn = 0) {
    const song = SONGS[name];
    if (!song) return null;
    const g = this.ac.createGain();
    g.gain.setValueAtTime(fadeIn ? 0.0001 : 1, at);
    if (fadeIn) g.gain.setTargetAtTime(1, at, fadeIn / 3);
    g.connect(this.musicIn);
    this.delay.delayTime.setValueAtTime((60 / song.bpm) * song.delayBeats, at);
    const pl = { name, song, start: at, step: 0, g, stopAt: Infinity, sd: 60 / song.bpm / 4 };
    this.players.push(pl);
    return pl;
  }
  stopSong(pl, at, fade = 1) {
    if (!pl || pl.stopAt !== Infinity) return;
    pl.stopAt = at + fade * 1.6;
    pl.g.gain.cancelScheduledValues(at);
    pl.g.gain.setTargetAtTime(0.0001, at, fade / 3);
  }
  pump(until) {
    const now = this.now();
    for (const pl of this.players) {
      for (;;) {
        const s = pl.song, odd = pl.step % 2 === 1;
        const t = pl.start + pl.step * pl.sd + (odd ? s.swing * pl.sd : 0);
        if (t >= until || t >= pl.stopAt) break;
        if (t >= now - 0.02 && this.musicOn) this.step(pl, pl.step % s.len, t);
        pl.step++;
      }
    }
    this.players = this.players.filter((pl) => {
      if (pl.stopAt <= now) { try { pl.g.disconnect(); } catch (_) { /* gone */ } return false; }
      return true;
    });
  }
  step(pl, s, t) {
    const song = pl.song, out = pl.g, bar = Math.floor(s / 16), i = s % 16, sd = pl.sd;
    const ch = song.ch[bar];
    // drums (last bar gets the fill lanes on top)
    const lanes = bar === song.bars - 1 && song.fill ? { ...song.drums, ...song.fill } : song.drums;
    for (const k in lanes) {
      const c = lanes[k][i];
      if (c === 'x' || c === 'X' || c === 'g') this.drum(c === 'g' ? 'g' : k, t, c === 'X' ? 1.15 : 0.9, out);
    }
    if (song.crash && song.crash.includes(s)) this.drum('x', t, 1, out);
    // bass
    const toks = song.bassToks, tok = toks[i];
    if (tok && tok !== '-' && tok !== '.') {
      let root = ch.pc + 36; if (root > 41) root -= 12;
      const next = song.ch[(bar + 1) % song.bars];
      let nroot = next.pc + 36; if (nroot > 41) nroot -= 12;
      const m = tok === 'R' ? root : tok === 'O' ? root + 12 : tok === 'F' ? root + 7 : tok === 'b' ? root + 10 : tok === 'P' ? nroot - 1 : root;
      let len = 1;
      while (toks[i + len] === '-') len++;
      this.bass(t, hz(m), (song.bassShort ? 0.6 : len * 0.92) * sd, song.bassVol, out);
    }
    // lead
    for (const e of song.leadAt[s] || []) this.lead(t, hz(e.m), e.len * sd * 0.94, song.leadVol, out, song.leadWave);
    // arp from the chord tones
    if (song.arp && i % song.arp.every === 0) {
      const base = 12 * (song.arp.oct + 1) + ch.pc;
      const tones = [...ch.iv.map((v) => base + v), ...ch.iv.map((v) => base + 12 + v)];
      const k = i / song.arp.every;
      let idx = k % tones.length;
      if (song.arp.pat === 'down') idx = tones.length - 1 - idx;
      if (song.arp.pat === 'updown') { const p = (tones.length - 1) * 2; const q = k % p; idx = q < tones.length ? q : p - q; }
      this.arp(t, hz(tones[clamp(idx, 0, tones.length - 1)]), song.arp.vol, out);
    }
    // pad + stabs
    const voicing = ch.iv.map((v) => { let m = 48 + ch.pc + v; while (m < 55) m += 12; while (m >= 67) m -= 12; return hz(m); });
    if (song.pad && i === 0) this.pad(t, voicing, 16 * sd * 0.98, song.pad, out);
    if (song.stab && song.stab[i] === 'x') this.stab(t, voicing.map((f) => f * 2), 1, out);
  }
  setTrack(name) {
    if (name === this.track) return;
    const t = this.now(), from = this.track;
    this.track = name;
    if (this.cur) this.stopSong(this.cur, t, name === 'fight' ? 0.45 : from === 'fight' ? 1.6 : 1.1);
    this.cur = name ? this.startSong(name, t + 0.04, name === 'fight' || name === 'boss' ? 0.35 : 1.4) : null;
  }
  duckMusic(level, t, hold, rel = 0.6) {
    const d = this.duck.gain;
    d.cancelScheduledValues(t);
    d.setTargetAtTime(level, t, 0.04);
    if (hold != null) d.setTargetAtTime(1, t + hold, rel / 3);
  }
  sting(name, t) {
    const st = STINGS[name];
    if (!st) return;
    const out = this.ac.createGain(); out.gain.value = 1; out.connect(this.musicBus); // not ducked
    for (const [dt, n, len] of st.lead) this.lead(t + dt, hz(midi(n)), len, 1.1, out, st.wave || 'square');
    if (st.chord) { const [dt, ns, len] = st.chord; this.pad(t + dt, ns.map((n) => hz(midi(n))), len, 2.2, out); this.stab(t + dt, ns.map((n) => hz(midi(n)) * 2), 1.3, out); }
    if (st.bass) this.bass(t + st.bass[0], hz(midi(st.bass[1])), st.bass[2], 1, out);
    if (st.crash != null) { this.drum('x', t + st.crash, 1.1, out); this.drum('k', t + st.crash, 1, out); }
    this.duckMusic(name === 'gameover' ? 0.05 : 0.18, t, st.len, 1.2);
  }

  // ---------- SFX
  allow(name, t, prio) {
    const cd = SFX_COOLDOWN[name] || 0.02;
    if (this.last[name] != null && t - this.last[name] < cd && t >= this.last[name]) return false;
    this.activeSfx = this.activeSfx.filter((e) => e > t);
    if (this.activeSfx.length >= MAX_SFX && !prio) return false;
    this.last[name] = t;
    this.activeSfx.push(t + 0.4);
    return true;
  }
  out(o, t) {
    if (o && o.pan && this.ac.createStereoPanner) { const p = this.ac.createStereoPanner(); p.pan.setValueAtTime(clamp(o.pan, -0.8, 0.8), t); p.connect(this.sfxIn); return p; }
    return this.sfxIn;
  }
  /** 1.4.0 kits: combo3 finishers play the weapon sound quieter (o.lite). */
  kitOut(out, o) { if (!o || !o.lite) return out; const g = this.ac.createGain(); g.gain.value = 0.5; g.connect(out); return g; }
  thump(t, f0, f1, dur, peak, out) { const o = this.osc('sine', f0, t, dur); this.sweep(o.frequency, t, f0, f1, dur * 0.7); o.connect(this.env(t, 0.002, peak, dur)).connect(out); }
  burst(t, type, f, q, dur, peak, out, verb = 0) {
    const n = this.noise(t, dur), g = this.env(t, 0.002, peak, dur);
    n.connect(this.filt(type, f, q)).connect(g); g.connect(out);
    if (verb) { const s = this.ac.createGain(); s.gain.value = verb; g.connect(s).connect(this.sfxVerbIn); }
  }
  tone(t, type, f0, f1, dur, peak, out, verb = 0) {
    const o = this.osc(type, f0, t, dur); if (f1 && f1 !== f0) this.sweep(o.frequency, t, f0, f1, dur);
    const g = this.env(t, 0.004, peak, dur); o.connect(g); g.connect(out);
    if (verb) { const s = this.ac.createGain(); s.gain.value = verb; g.connect(s).connect(this.sfxVerbIn); }
  }
  sfx(name, t, o = {}) {
    if (!this.allow(name, t, o.prio)) return false;
    const out = this.out(o, t), v = rnd(0.88, 1.14);
    switch (name) {
      case 'punch': // three random flavours: snappy jab, meaty cross, slap
        this.thump(t, 165 * v, 55, 0.13, 0.7, out);
        this.burst(t, 'bandpass', pick([900, 1200, 1600]) * v, 0.9, 0.08, 0.55, out);
        this.burst(t, 'highpass', 3200, 0.7, 0.03, o.taken ? 0.12 : 0.22, out);
        break;
      case 'kick':
        this.thump(t, 130 * v, 44, 0.17, 0.85, out);
        this.burst(t, 'lowpass', 1800 * v, 0.7, 0.12, 0.5, out);
        this.burst(t + 0.005, 'bandpass', 2400, 1.2, 0.04, 0.25, out);
        break;
      case 'heavy':
      case 'finisher':
        this.thump(t, 140 * v, 40, 0.2, 0.9, out);
        this.thump(t, 72, 30, 0.38, 0.6, out);
        this.burst(t, 'lowpass', 2000, 0.7, 0.14, 0.55, out, 0.3);
        this.burst(t, 'highpass', 2600, 0.7, 0.12, 0.32, out);
        break;
      case 'star':
        this.sfx('finisher', t, { prio: true });
        [2093, 2637, 3136, 4186].forEach((f, k) => this.tone(t + 0.02 + k * 0.035, 'triangle', f, f, 0.45, 0.07, out, 0.6));
        break;
      case 'star_iron': { // Star Drive landing in the Hell's Nightmare armor: sub boom + armour clang
        this.sfx('finisher', t, { prio: true });
        this.thump(t, 70, 26, 0.6, 1, out);
        this.burst(t, 'lowpass', 300, 0.8, 0.45, 0.7, out, 0.4);
        [311, 467, 739, 1093].forEach((f, k) => this.tone(t + 0.01, 'square', f * v, f * v * 0.97, 0.5 - k * 0.08, 0.05, out, 0.5));
        const sv = this.ac.createGain(); sv.gain.value = 0.35; this.burst(t + 0.02, 'bandpass', 1400, 2, 0.3, 0.25, sv); sv.connect(this.sfxVerbIn);
        break;
      }
      case 'whiff': {
        const n = this.noise(t, 0.18), bp = this.filt('bandpass', o.heavy ? 350 : 600, 1.6, t);
        this.sweep(bp.frequency, t, o.heavy ? 350 : 600 * v, o.heavy ? 1500 : 2600 * v, o.heavy ? 0.18 : 0.13);
        const g = this.ac.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime((o.quiet ? 0.08 : 0.2), t + 0.04); g.gain.exponentialRampToValueAtTime(0.0001, t + (o.heavy ? 0.2 : 0.14));
        n.connect(bp).connect(g).connect(out);
        break;
      }
      case 'block':
        this.tone(t, 'square', 1250 * v, 1180 * v, 0.12, 0.07, out, 0.3);
        this.tone(t, 'square', 1870 * v, 1800 * v, 0.1, 0.05, out);
        this.burst(t, 'highpass', 2200, 0.7, 0.04, 0.3, out);
        break;
      case 'thud':
        this.thump(t, 95, 32, 0.42, o.heavy ? 1 : 0.85, out);
        this.burst(t, 'lowpass', 420, 0.7, 0.26, 0.55, out);
        this.thump(t + 0.13, 80, 40, 0.15, 0.3, out);
        this.burst(t + 0.13, 'lowpass', 700, 0.7, 0.08, 0.2, out);
        break;
      case 'getup': {
        const n = this.noise(t, 0.24), bp = this.filt('bandpass', 900, 1.1, t);
        this.sweep(bp.frequency, t, 800, 2000, 0.22);
        n.connect(bp).connect(this.env(t, 0.06, 0.1, 0.24)).connect(out);
        this.thump(t + 0.2, 110, 60, 0.07, 0.3, out);
        break;
      }
      case 'jump': {
        const n = this.noise(t, 0.2), bp = this.filt('bandpass', 500, 1.4, t);
        this.sweep(bp.frequency, t, 500, 1600, 0.18);
        n.connect(bp).connect(this.env(t, 0.03, 0.14, 0.2)).connect(out);
        this.tone(t, 'square', 220, 440, 0.08, 0.025, out);
        break;
      }
      case 'land':
        this.thump(t, 120, 50, 0.1, 0.5, out);
        this.burst(t, 'lowpass', 900, 0.7, 0.08, 0.25, out);
        break;
      case 'step':
        this.burst(t, 'lowpass', (o.alt ? 700 : 950) * v, 1, 0.045, 0.11, out);
        this.thump(t, 90, 60, 0.05, 0.12, out);
        break;
      case 'stardrive': {
        const n = this.noise(t, 0.5), bp = this.filt('bandpass', 300, 2, t);
        this.sweep(bp.frequency, t, 300, 5200, 0.42);
        const g = this.env(t, 0.06, 0.42, 0.48); n.connect(bp).connect(g); g.connect(out);
        const s = this.ac.createGain(); s.gain.value = 0.3; g.connect(s).connect(this.sfxVerbIn);
        const o2 = this.osc('sawtooth', 180, t, 0.45); this.sweep(o2.frequency, t, 180, 1600, 0.4);
        o2.connect(this.filt('lowpass', 2400)).connect(this.env(t, 0.03, 0.07, 0.42)).connect(out);
        for (let k = 0; k < 5; k++) this.tone(t + 0.05 + k * 0.07, 'triangle', rnd(2600, 5200), 0, 0.12, 0.04, out, 0.5);
        if (o.iron) { // armoured launch: servo growl under the whoosh
          const g2 = this.osc('sawtooth', 90, t, 0.5); this.sweep(g2.frequency, t, 90, 42, 0.45);
          g2.connect(this.filt('lowpass', 500)).connect(this.env(t, 0.02, 0.2, 0.45)).connect(out);
          this.thump(t, 60, 30, 0.3, 0.6, out);
        }
        break;
      }
      // >>> 1.4.0 outfit kits: one signature sound per weapon (special = full, combo3 finisher = o.lite)
      case 'kit_polo': { // Hardcover Book "Detention": page flutter + flat cover slap
        const q = this.kitOut(out, o);
        for (let k = 0; k < 3; k++) this.burst(t + k * 0.025, 'highpass', 3500 * v, 0.8, 0.02, 0.12, q);
        this.thump(t + 0.06, 190 * v, 70, 0.14, 0.8, q);
        this.burst(t + 0.06, 'bandpass', 1100 * v, 1.2, 0.07, 0.6, q);
        this.burst(t + 0.06, 'lowpass', 600, 0.7, 0.12, 0.3, q, 0.2);
        break;
      }
      case 'kit_photo': { // Strap Camera "Flash Pop": shutter clack + flash whine + pop
        const q = this.kitOut(out, o);
        this.burst(t, 'highpass', 4200, 2, 0.012, 0.35, q); this.burst(t + 0.035, 'highpass', 3000, 2, 0.015, 0.3, q);
        this.tone(t + 0.02, 'sine', 1800, 7200, 0.22, 0.06, q, 0.4);
        this.burst(t + 0.2, 'bandpass', 2500, 0.7, 0.08, 0.35, q, 0.3);
        break;
      }
      case 'kit_hoodie': { // Skateboard "Kickflip": wheel roll + double deck clack
        const q = this.kitOut(out, o);
        this.burst(t, 'lowpass', 380 * v, 1.5, 0.3, 0.32, q);
        this.tone(t + 0.04, 'square', 820 * v, 760 * v, 0.03, 0.12, q);
        this.tone(t + 0.14, 'square', 640 * v, 600 * v, 0.04, 0.14, q);
        this.thump(t + 0.14, 160, 80, 0.08, 0.4, q);
        break;
      }
      case 'kit_jacket': { // Bike Chain "Whip Crack": rattle + sharp crack at the tip
        const q = this.kitOut(out, o);
        for (let k = 0; k < 8; k++) this.tone(t + k * 0.012, 'sine', rnd(3200, 6400), 0, 0.05, 0.03, q);
        this.burst(t + 0.1, 'highpass', 2600, 0.9, 0.025, 0.75, q, 0.35);
        this.burst(t + 0.1, 'bandpass', 900, 1.5, 0.05, 0.3, q);
        break;
      }
      case 'kit_street': { // Baseball Bat "Line Drive": wooden crack
        const q = this.kitOut(out, o);
        this.tone(t, 'triangle', 640 * v, 520 * v, 0.07, 0.3, q);
        this.burst(t, 'bandpass', 1500 * v, 1.6, 0.05, 0.7, q, 0.3);
        this.thump(t, 140, 60, 0.12, 0.6, q);
        this.burst(t + 0.005, 'highpass', 3500, 0.7, 0.03, 0.3, q);
        break;
      }
      case 'kit_varsity': { // Football "Spiral": throw grunt-thump + spinning whistle
        const q = this.kitOut(out, o);
        this.thump(t, 120, 60, 0.08, 0.45, q);
        const w = this.osc('sine', 1500 * v, t + 0.03, 0.35); this.sweep(w.frequency, t + 0.03, 1500 * v, 900 * v, 0.33);
        const l = this.osc('sine', 22, t + 0.03, 0.35), lg = this.ac.createGain(); lg.gain.value = 120; l.connect(lg).connect(w.frequency);
        w.connect(this.env(t + 0.03, 0.02, 0.05, 0.32)).connect(q);
        break;
      }
      case 'kit_varsity_hit': // leather ball hitting a body
        this.thump(t, 210 * v, 90, 0.1, 0.7, out);
        this.burst(t, 'bandpass', 700, 1.1, 0.06, 0.5, out);
        break;
      case 'kit_mechanic': { // Pipe Wrench "Torque": steel clang (inharmonic) + heavy hit
        const q = this.kitOut(out, o);
        [523, 1187, 1813, 2650].forEach((f, k) => this.tone(t, 'square', f * v, f * v * 0.99, 0.45 - k * 0.08, 0.05, q, 0.4));
        this.thump(t, 110, 40, 0.25, 0.8, q);
        this.burst(t, 'highpass', 2400, 0.7, 0.05, 0.4, q);
        break;
      }
      case 'kit_diner': { // Frying Pan "Hot Plate": pan BONG + grease sizzle
        const q = this.kitOut(out, o);
        [410, 1120, 1890].forEach((f, k) => this.tone(t, 'sine', f * v, f * v, 0.6 - k * 0.15, 0.12 - k * 0.03, q, 0.4));
        this.thump(t, 150, 70, 0.1, 0.5, q);
        const n = this.noise(t + 0.05, 0.7); n.connect(this.filt('highpass', 5200, 0.7)).connect(this.env(t + 0.05, 0.03, o.lite ? 0.06 : 0.14, 0.65)).connect(q);
        break;
      }
      case 'kit_gold': { // Gold Chain "Encore": bright chain shimmer (second hit pitched up)
        const q = this.kitOut(out, o), up = o.second ? 1.26 : 1;
        [2637, 3136, 3951, 4699].forEach((f, k) => this.tone(t + k * 0.02, 'triangle', f * up, f * up, 0.25, 0.05, q, 0.5));
        this.burst(t, 'bandpass', 1800 * up, 1.2, 0.08, 0.4, q);
        this.thump(t, 150 * up, 60, 0.1, 0.5, q);
        break;
      }
      case 'kit_webslinger': { // Star-Line "Star Yank": line zip out + taut twang + star ping
        const q = this.kitOut(out, o);
        const n = this.noise(t, 0.2), bp = this.filt('bandpass', 3200, 3, t); this.sweep(bp.frequency, t, 3200, 700, 0.18);
        n.connect(bp).connect(this.env(t, 0.01, 0.3, 0.2)).connect(q);
        this.tone(t + 0.12, 'sawtooth', 230 * v, 110 * v, 0.18, 0.06, q);
        this.tone(t + 0.12, 'sine', 2349, 2349, 0.3, 0.05, q, 0.5);
        break;
      }
      case 'kit_beacon': { // The Ring "Star Flare": rising emerald chime + air burst
        const q = this.kitOut(out, o);
        [784, 988, 1175, 1568, 1976].forEach((f, k) => this.tone(t + k * 0.03, 'sine', f, f * 1.01, 0.4, 0.06, q, 0.6));
        const n = this.noise(t, 0.3), bp = this.filt('bandpass', 600, 1.2, t); this.sweep(bp.frequency, t, 600, 3200, 0.25);
        n.connect(bp).connect(this.env(t, 0.02, 0.25, 0.28)).connect(q);
        break;
      }
      case 'kit_ironclad': { // Breach Gauntlets "Breach": servo hiss + concussive sub boom + plate clank
        const q = this.kitOut(out, o);
        this.burst(t, 'highpass', 3800, 0.7, 0.12, 0.2, q);
        this.thump(t + 0.04, 62, 24, 0.55, 1, q);
        this.burst(t + 0.04, 'lowpass', 260, 0.8, 0.4, 0.6, q, 0.4);
        [277, 415, 659].forEach((f) => this.tone(t + 0.05, 'square', f * v, f * v * 0.96, 0.3, 0.045, q, 0.3));
        break;
      }
      // <<< 1.4.0 outfit kits
      case 'glint': // hidden collectible spotted (Hell's Nightmare helmet): two soft high sparkles
        [2637, 3520].forEach((f, k) => this.tone(t + k * 0.09, 'sine', f, f * 1.01, 0.22, 0.05, out, 0.5));
        break;
      case 'pickup':
        [1046.5, 1318.5, 1568, 2093].forEach((f, k) => { this.tone(t + k * 0.05, 'triangle', f, f, 0.2, 0.16, out, 0.3); this.tone(t + k * 0.05, 'sine', f * 2, f * 2, 0.12, 0.04, out); });
        break;
      case 'unlock': {
        this.sfx('pickup', t, { prio: true });
        const lp = this.filt('lowpass', 2600, 0.7, t), g = this.hold(t + 0.2, 0.08, 0.05, 0.6, 0.6);
        for (const f of [523.25, 659.25, 783.99, 987.77]) for (const d of [-8, 8]) { const x = this.osc('sawtooth', f, t + 0.2, 1.3); x.detune.value = d; x.connect(lp); }
        lp.connect(g); g.connect(out); g.connect(this.sfxVerbIn);
        for (let k = 0; k < 8; k++) this.tone(t + 0.25 + k * 0.06, 'sine', 2093 * Math.pow(2, (k % 4) / 4), 0, 0.2, 0.04, out, 0.6);
        break;
      }
      case 'mission_start':
        this.tone(t, 'sawtooth', 392, 392, 0.12, 0.09, out, 0.3);
        this.tone(t + 0.13, 'sawtooth', 523.25, 523.25, 0.3, 0.1, out, 0.3);
        this.tone(t + 0.13, 'square', 659.25, 659.25, 0.3, 0.05, out);
        this.burst(t + 0.13, 'highpass', 900, 0.7, 0.12, 0.2, out);
        break;
      case 'mission_complete':
        [523.25, 659.25, 783.99].forEach((f, k) => this.tone(t + k * 0.09, 'square', f, f, 0.1, 0.07, out));
        this.tone(t + 0.27, 'square', 1046.5, 1046.5, 0.6, 0.08, out, 0.4);
        this.tone(t + 0.27, 'sawtooth', 783.99, 783.99, 0.6, 0.05, out, 0.4);
        this.burst(t + 0.27, 'highpass', 4500, 0.7, 0.9, 0.12, out, 0.4);
        break;
      case 'fight_start':
        for (const f of [164.8, 196, 246.9, 329.6]) this.tone(t, 'sawtooth', f, f * 0.98, 0.32, 0.05, out, 0.3);
        this.thump(t, 140, 44, 0.3, 0.7, out);
        this.burst(t, 'highpass', 4200, 0.7, 0.6, 0.12, out, 0.3);
        break;
      case 'ui_move': this.tone(t, 'square', 660, 760, 0.05, 0.035, out); break;
      case 'ui_select': this.tone(t, 'square', 520, 1040, 0.09, 0.05, out); this.tone(t + 0.07, 'triangle', 1040, 1400, 0.08, 0.04, out); break;
      case 'ui_back': this.tone(t, 'square', 520, 300, 0.09, 0.04, out); break;
      case 'ui_start': this.tone(t, 'square', 392, 784, 0.12, 0.05, out); this.tone(t + 0.1, 'square', 587, 1175, 0.12, 0.04, out); this.tone(t + 0.2, 'triangle', 784, 1568, 0.2, 0.05, out, 0.3); break;
      case 'ui_tick': this.tone(t, 'triangle', 880 * (o.level != null ? 0.75 + o.level * 0.6 : 1), 0, 0.05, 0.06, out); break;
      case 'outfit': this.tone(t, 'triangle', 1318.5, 1318.5, 0.08, 0.08, out); this.tone(t + 0.06, 'triangle', 1975.5, 1975.5, 0.14, 0.07, out, 0.3); break;
      case 'save': // two-tone bell
        for (const [dt, f] of [[0, 880], [0.16, 1318.5]]) { this.tone(t + dt, 'sine', f, f, 0.45, 0.12, out, 0.3); this.tone(t + dt, 'sine', f * 2.76, f * 2.76, 0.18, 0.025, out); }
        break;
      case 'denied': this.tone(t, 'square', 210, 170, 0.08, 0.05, out); this.tone(t + 0.1, 'square', 180, 140, 0.1, 0.05, out); break;
      case 'glass': { // diner window: crack + shards
        const big = !!o.big;
        this.burst(t, 'highpass', 2500, 0.7, big ? 0.5 : 0.22, big ? 0.6 : 0.4, out, 0.3);
        this.thump(t, 300, 120, 0.08, 0.3, out);
        for (let k = 0; k < (big ? 14 : 6); k++) this.tone(t + rnd(0, big ? 0.35 : 0.12), 'sine', rnd(2600, 6800), 0, rnd(0.12, 0.45), rnd(0.02, 0.06), out, 0.4);
        if (big) this.thump(t, 80, 35, 0.5, 0.7, out);
        break;
      }
      case 'caught': { // comic "boing" + bump
        const x = this.osc('sine', 260, t, 0.5); x.frequency.exponentialRampToValueAtTime(900, t + 0.12); x.frequency.exponentialRampToValueAtTime(200, t + 0.45);
        const lfo = this.osc('sine', 18, t, 0.5), lg = this.ac.createGain(); lg.gain.value = 30; lfo.connect(lg).connect(x.frequency);
        x.connect(this.env(t, 0.01, 0.16, 0.48)).connect(out);
        this.sfx('thud', t + 0.05, { prio: true });
        break;
      }
      default: return false;
    }
    return true;
  }

  // ---------- voices
  /** One formant syllable: glottal-ish source → 3 parallel formant band-passes (+ breath, growl). */
  syl(t, p, vowel, dur, f0a, f0b, vel, out, o = {}) {
    const ac = this.ac, src = this.osc(p.wave, f0a, t, dur + 0.05);
    src.frequency.exponentialRampToValueAtTime(Math.max(30, f0b), t + dur);
    if (o.vib) { const l = this.osc('sine', 6.5, t, dur), lg = ac.createGain(); lg.gain.value = f0a * o.vib; l.connect(lg).connect(src.frequency); }
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vel, t + Math.min(0.025, dur * 0.3));
    g.gain.setValueAtTime(vel, t + dur * 0.55); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let body = g;
    if (p.grit) { // growl: amplitude modulation
      const am = ac.createGain(); am.gain.value = 1 - p.grit * 0.6;
      const l = this.osc('square', rnd(32, 48), t, dur), lg = ac.createGain(); lg.gain.value = p.grit * 0.6;
      l.connect(lg).connect(am.gain); g.connect(am); body = am;
    }
    const F = VOWEL[vowel] || VOWEL.a, gains = [1, 0.55, 0.22];
    F.forEach((f, k) => {
      const bp = this.filt('bandpass', f * p.fs, k === 0 ? 6 : 9);
      const fg = ac.createGain(); fg.gain.value = gains[k] * (p.nasal && k === 1 ? 1.8 : 1) * 3;
      src.connect(bp).connect(fg).connect(g);
    });
    body.connect(out);
    if (p.breath || o.h) {
      const n = this.noise(o.h ? t - 0.04 : t, dur + 0.05), bp = this.filt('bandpass', F[1] * p.fs, 1.2);
      const ng = ac.createGain(); ng.gain.setValueAtTime(0.0001, o.h ? t - 0.04 : t);
      ng.gain.exponentialRampToValueAtTime(vel * (o.h ? 0.9 : p.breath * 0.6), o.h ? t - 0.01 : t + 0.02);
      ng.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      n.connect(bp).connect(ng).connect(out);
    }
  }
  voice(key, kind, t, o = {}) {
    const p = FIGHTERS[key] || FIGHTERS.thug_purple;
    const prio = kind === 'ko' || kind === 'defeat' || kind === 'victory' || kind === 'special' || kind === 'caught';
    const cd = o.cd != null ? o.cd : prio ? 0 : 0.28;
    const lk = (o.id || key) + ':' + (prio ? kind : 'v');
    if (this.voiceLast[lk] != null && t - this.voiceLast[lk] < cd && t >= this.voiceLast[lk]) return false;
    this.activeVoices = this.activeVoices.filter((e) => e > t);
    if (this.activeVoices.length >= (prio ? MAX_VOICES + 2 : MAX_VOICES)) return false;
    this.voiceLast[lk] = t;
    const out = this.out(o, t), f = p.f0 * rnd(0.95, 1.06), V = 0.5;
    let len = 0.3;
    switch (kind) {
      case 'attack': len = rnd(0.13, 0.19); this.syl(t, p, pick(['a', 'uh', 'ae']), len, f * 1.3, f * 0.95, V, out, { h: true }); break;
      case 'grunt': len = 0.13; this.syl(t, p, pick(['uh', 'u']), len, f * 1.05, f * 0.85, V * 0.8, out, { h: true }); break;
      case 'big': this.syl(t, p, 'i', 0.08, f * 1.15, f * 1.3, V, out, { h: true }); this.syl(t + 0.09, p, 'a', 0.22, f * 1.55, f * 1.05, V, out); len = 0.32; break;
      case 'special': // "Star — DRIVE!"-ish two-beat yell
        this.syl(t, p, 'a', 0.14, f * 1.2, f * 1.35, V, out, { h: true });
        this.syl(t + 0.17, p, 'ae', 0.1, f * 1.4, f * 1.5, V, out);
        this.syl(t + 0.28, p, 'i', 0.26, f * 1.7, f * 1.1, V * 1.05, out, { vib: 0.02 }); len = 0.56; break;
      case 'hurt': len = rnd(0.16, 0.22); this.syl(t, p, pick(['uh', 'u', 'o']), len, f * 1.15, f * 0.72, V * 0.9, out, { h: true }); break;
      case 'ko': this.syl(t, p, 'a', 0.55, f * 1.3, f * 0.5, V, out, { h: true, vib: 0.03 }); this.syl(t + 0.5, p, 'u', 0.25, f * 0.6, f * 0.42, V * 0.5, out); len = 0.8; break;
      case 'victory': this.syl(t, p, 'e', 0.12, f, f * 1.3, V, out, { h: true }); this.syl(t + 0.12, p, 'ae', 0.3, f * 1.35, f * 1.05, V, out, { vib: 0.02 }); len = 0.45; break;
      case 'taunt': for (let k = 0; k < 3; k++) this.syl(t + k * 0.15, p, 'e', 0.09, f * (1.1 - k * 0.05), f * 0.95, V * 0.8, out, { h: true }); len = 0.45; break;
      case 'defeat': this.syl(t, p, 'u', 0.3, f * 1.1, f * 0.85, V, out, { h: true }); this.syl(t + 0.32, p, 'o', 0.55, f * 0.95, f * 0.55, V * 0.85, out, { vib: 0.025 }); len = 0.9; break;
      case 'caught': this.syl(t, p, 'u', 0.12, f, f * 1.5, V, out, { h: true }); this.syl(t + 0.12, p, 'o', 0.26, f * 1.6, f * 0.9, V, out); len = 0.4; break;
      default: return false;
    }
    this.activeVoices.push(t + len);
    return true;
  }
  /** A cast member's talk blip (Animal-Crossing style), and a short two-syllable greeting. */
  blip(t, p, out, up = false) {
    const f = p.f0 * pick(p.steps) * (up ? 1.3 : 1);
    const src = this.osc(p.wave, f, t, p.len + 0.03);
    if (p.slide) src.frequency.exponentialRampToValueAtTime(f * p.slide, t + p.len);
    const F = VOWEL[pick(p.vowels)];
    const g = this.env(t, 0.006, 0.42 * (p.gain || 1), p.len);
    const a = this.filt('bandpass', F[0] * p.fs, 3), b = this.filt('bandpass', F[1] * p.fs, 5);
    const ga = this.ac.createGain(); ga.gain.value = 1.6; const gb = this.ac.createGain(); gb.gain.value = 1.1;
    src.connect(a).connect(ga).connect(g); src.connect(b).connect(gb).connect(g);
    const dry = this.ac.createGain(); dry.gain.value = p.f0 < 160 ? 0.55 : 0.3; src.connect(dry).connect(g);
    g.connect(out);
  }
  talk(id, text, t, out) {
    const p = talkProfile(id);
    let tt = t, n = 0;
    const words = String(text || '').split(/\s+/).filter(Boolean);
    for (const w of words) {
      const syl = Math.max(1, (w.toLowerCase().match(/[aeiouy]+/g) || []).length);
      for (let k = 0; k < syl && n < 26; k++, n++) {
        this.blip(tt, p, out, /\?$/.test(w) && k === syl - 1);
        tt += p.rate * rnd(0.85, 1.15);
      }
      if (/[.,!?…;:—]$/.test(w)) tt += p.rate * 2.2;
      if (n >= 26 || tt - t > 2.4) break;
    }
    return tt - t;
  }
  greet(id, t, out) {
    const p = talkProfile(id);
    const fp = { f0: p.f0, wave: p.wave, fs: p.fs || 1, grit: p.grit || 0, breath: 0.2 };
    const [v1, v2] = p.greet || ['e', 'i'];
    this.syl(t, fp, v1, 0.11, p.f0 * 0.95, p.f0 * 1.1, 0.55, out, { h: true });
    this.syl(t + 0.12, fp, v2, 0.17, p.f0 * 1.25, p.f0 * (p.greetFall ? 0.9 : 1.35), 0.55, out);
    return 0.32;
  }
}

// ------------------------------------------------------------------ settings + realtime driver
const SETTINGS_KEY = 'starCityDrift_audio';
const settings = { music: 0.7, sfx: 0.8, muted: false };
try {
  const s = JSON.parse(localStorage.getItem(SETTINGS_KEY) || 'null');
  if (s && typeof s === 'object') {
    if (Number.isFinite(s.music)) settings.music = clamp(s.music, 0, 1);
    if (Number.isFinite(s.sfx)) settings.sfx = clamp(s.sfx, 0, 1);
    settings.muted = !!s.muted;
  }
} catch (_) { /* private mode / bad JSON: defaults */ }

let eng = null, ac = null, timer = null, wanted = null, paused = false, talkOut = null, hiddenSuspended = false;
const widgets = new Set();
const AC = typeof window !== 'undefined' ? (window.AudioContext || window.webkitAudioContext) : null;
let unlockAt = -1e9;
// running, or just unlocked inside this gesture (resume() is async; the first sound still plays)
const ready = () => !!(eng && ac && (ac.state === 'running' || (ac.state === 'suspended' && !hiddenSuspended && performance.now() - unlockAt < 1000)));
const safe = (fn) => { try { return fn(); } catch (err) { if (typeof console !== 'undefined') console.warn('[audio]', err && err.message); return false; } };

/** Create / resume the AudioContext. Must run inside a user gesture the first time (iOS). */
export function unlockAudio() {
  if (!AC) return false;
  return safe(() => {
    if (!ac) {
      try { ac = new AC({ latencyHint: 'interactive' }); } catch (_) { ac = new AC(); }
      eng = new Engine(ac);
      eng.applySettings(settings);
      // iOS: play one silent buffer inside the gesture
      const b = ac.createBufferSource(); b.buffer = ac.createBuffer(1, 1, 22050); b.connect(ac.destination); b.start(0);
      timer = setInterval(() => safe(() => { if (ac.state === 'running') { eng.pump(ac.currentTime + 0.3); if (wanted !== eng.track) eng.setTrack(wanted); } }), 50);
    }
    if (ac.state === 'suspended' && !(document.hidden)) { unlockAt = performance.now(); ac.resume().catch(() => {}); }
    return true;
  });
}
if (typeof window !== 'undefined') {
  ['pointerdown', 'keydown', 'touchend', 'mousedown'].forEach((ev) => window.addEventListener(ev, unlockAudio, { capture: true, passive: true }));
  // hidden tab / app in background: suspend everything; resume where the loop left off
  document.addEventListener('visibilitychange', () => safe(() => {
    if (!ac) return;
    if (document.hidden) { if (ac.state === 'running') { hiddenSuspended = true; ac.suspend().catch(() => {}); } }
    else if (hiddenSuspended) { hiddenSuspended = false; ac.resume().catch(() => {}); }
  }));
  window.addEventListener('pagehide', () => safe(() => ac && ac.state === 'running' && ac.suspend().catch(() => {})));
}

function saveSettings() {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch (_) { /* storage off */ }
  if (eng) eng.applySettings(settings);
  widgets.forEach((w) => w.refresh());
}
export function getAudioSettings() { return { ...settings }; }
export function setAudioSetting(key, value) {
  if (key === 'muted') settings.muted = !!value;
  else if (key === 'music' || key === 'sfx') settings[key] = Math.round(clamp(+value || 0, 0, 1) * 100) / 100;
  else return;
  saveSettings();
}
export function toggleMute() { setAudioSetting('muted', !settings.muted); return settings.muted; }

/** Desired music: 'title' | 'street' | 'fight' | 'boss' | null. Cheap to call every frame. */
export function setMusic(name) { wanted = name || null; if (ready() && eng.track !== wanted) safe(() => eng.setTrack(wanted)); }
export function sting(name) { if (ready()) { safe(() => eng.sting(name, ac.currentTime + 0.02)); count(stats.sting, name); } }
/** Pause menu: duck the music, keep it going. */
export function setPaused(on) {
  paused = !!on;
  if (ready()) safe(() => eng.duckMusic(paused ? 0.3 : talking ? 0.55 : 1, ac.currentTime));
}
let talking = false;
/** Dialogue open: music dips a little so the talk blips sit on top. */
export function setDialogueDuck(on) {
  if (!!on === talking) return;
  talking = !!on;
  if (ready() && !paused) safe(() => eng.duckMusic(talking ? 0.55 : 1, ac.currentTime));
}
const stats = { sfx: {}, voice: {}, talk: 0, sting: {} }; // test/debug counters
const count = (bag, k) => { bag[k] = (bag[k] || 0) + 1; };
export function sfx(name, o) {
  if (!ready()) return false;
  const ok = safe(() => eng.sfx(name, ac.currentTime + (o && o.delay || 0), o));
  if (ok) count(stats.sfx, name);
  return ok;
}
export function voice(key, kind, o) {
  if (!ready()) return false;
  if (o && o.chance != null && Math.random() > o.chance) return false;
  const ok = safe(() => eng.voice(key, kind, ac.currentTime + (o && o.delay || 0), o));
  if (ok) count(stats.voice, key + ':' + kind);
  return ok;
}
export function uiSound(kind) { return sfx('ui_' + kind); }
/** Dialogue: greeting (first line only) + talk blips for the line; stopTalk() cuts them off. */
export function talk(npcId, text, greetFirst = false) {
  if (!ready()) return;
  safe(() => {
    stopTalk();
    talkOut = ac.createGain(); talkOut.connect(eng.sfxIn);
    let t = ac.currentTime + 0.02;
    if (greetFirst) t += eng.greet(npcId, t, talkOut) + 0.06;
    eng.talk(npcId, text, t, talkOut);
    stats.talk++; stats.lastTalk = npcId;
  });
}
export function stopTalk() {
  if (!talkOut || !ac) return;
  const g = talkOut; talkOut = null;
  safe(() => { g.gain.setTargetAtTime(0.0001, ac.currentTime, 0.02); setTimeout(() => { try { g.disconnect(); } catch (_) { /* gone */ } }, 300); });
}
/** Test/debug snapshot. */
export function audioDebug() {
  return { supported: !!AC, state: ac ? ac.state : 'locked', track: eng ? eng.track : null, wanted, playing: eng ? eng.players.map((p) => p.name) : [], settings: { ...settings }, paused, stats: JSON.parse(JSON.stringify(stats)) };
}

// ------------------------------------------------------------------ settings widget (pause menu + title Controls)
/**
 * Builds Music / SFX sliders + a mute button inside `container`. Each slider is a focusable menu
 * button (pad/keyboard: ◂ ▸ adjust, confirm = +10% wrap) paired with a range input for mouse/touch.
 */
export function mountAudioSettings(container) {
  if (!container || typeof document === 'undefined') return null;
  const box = document.createElement('div');
  box.className = 'audio-settings';
  box.setAttribute('role', 'group');
  box.setAttribute('aria-label', 'Audio settings');
  box.innerHTML = ['music', 'sfx'].map((k) => `<div class="audio-row"><button type="button" class="btn btn-secondary audio-slider" data-audio="${k}"></button><input type="range" min="0" max="100" step="5" data-audio="${k}" aria-label="${k === 'music' ? 'Music' : 'Sound effects'} volume" tabindex="-1"></div>`).join('') +
    '<button type="button" class="btn btn-secondary audio-mute" data-audio="mute"></button>';
  container.appendChild(box);
  const refresh = () => {
    box.querySelectorAll('button.audio-slider').forEach((b) => {
      const k = b.dataset.audio, v = Math.round(settings[k] * 100);
      const bars = Math.round(v / 10);
      b.innerHTML = `${k === 'music' ? 'Music' : 'SFX'} <span class="audio-bars">${'▮'.repeat(bars)}${'▯'.repeat(10 - bars)}</span> ${v}%`;
      b.setAttribute('aria-label', `${k === 'music' ? 'Music' : 'Sound effects'} volume ${v}%`);
    });
    box.querySelectorAll('input[type=range]').forEach((r) => { const v = String(Math.round(settings[r.dataset.audio] * 100)); if (r.value !== v) r.value = v; });
    const m = box.querySelector('.audio-mute');
    m.textContent = settings.muted ? 'Sound: Muted 🔇' : 'Sound: On 🔊';
    m.setAttribute('aria-pressed', String(settings.muted));
    box.classList.toggle('muted', settings.muted);
  };
  box.querySelectorAll('button.audio-slider').forEach((b) => b.addEventListener('click', () => {
    const k = b.dataset.audio; let v = Math.round(settings[k] * 10) + 1; if (v > 10) v = 0;
    setAudioSetting(k, v / 10); sfx('ui_tick', { level: v / 10 });
  }));
  box.querySelectorAll('input[type=range]').forEach((r) => {
    r.addEventListener('input', () => setAudioSetting(r.dataset.audio, +r.value / 100));
    r.addEventListener('change', () => sfx('ui_tick', { level: +r.value / 100 }));
  });
  box.querySelector('.audio-mute').addEventListener('click', () => { toggleMute(); if (!settings.muted) sfx('ui_select'); });
  const w = { refresh, el: box };
  widgets.add(w);
  refresh();
  return w;
}
/** Pad / arrow left-right on a focused slider button. Returns true when it consumed the input. */
export function adjustFocusedSlider(dir) {
  const el = typeof document !== 'undefined' ? document.activeElement : null;
  if (!el || !el.classList || !el.classList.contains('audio-slider')) return false;
  const k = el.dataset.audio;
  setAudioSetting(k, settings[k] + dir * 0.1);
  sfx('ui_tick', { level: settings[k] });
  return true;
}

// ------------------------------------------------------------------ offline preview render
/**
 * Render a ~seconds-long showcase with the game's own engine: title theme → (UI) → fight theme
 * with hits, whooshes and voices → victory sting → Silas boss theme. Returns an AudioBuffer.
 */
export async function renderPreview(seconds = 42, sampleRate = 44100) {
  const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
  const oac = new OAC(2, Math.ceil(seconds * sampleRate), sampleRate);
  const e = new Engine(oac);
  e.applySettings({ music: 0.85, sfx: 0.9, muted: false });
  const ev = []; // [time, fn] — scheduled ~1 s ahead like the live game (keeps the graph small)
  const at = (t, fn) => ev.push([t, fn]);
  const S = (t, name, o) => at(t, () => e.sfx(name, t, o));
  const Vo = (t, key, kind) => at(t, () => e.voice(key, kind, t, { cd: 0 }));
  const songs = {};
  // 0–10 s: title theme + menu blips
  at(0, () => { songs.title = e.startSong('title', 0.05, 0); });
  [7.6, 8.0, 8.4].forEach((t) => S(t, 'ui_move'));
  S(9.0, 'ui_select'); S(9.6, 'ui_start');
  at(10.2, () => e.stopSong(songs.title, 10.2, 0.8));
  // 10.4–23 s: a street fight (crossfade into the fight theme)
  at(10.4, () => { songs.fight = e.startSong('fight', 10.4, 0.35); });
  S(10.4, 'fight_start');
  Vo(11.0, 'thug_red', 'taunt');
  const beat = 60 / 140;
  for (const [t, kind, foe, shout] of [[12.0, 'punch', 'thug_purple'], [12.0 + beat, 'punch', 'thug_purple'], [12.0 + beat * 2, 'finisher', 'thug_purple', 'big']]) {
    S(t - 0.06, 'whiff'); Vo(t - 0.05, 'matthew', shout || 'attack'); S(t, kind); Vo(t + 0.05, foe, 'hurt');
  }
  S(12.0 + beat * 2 + 0.35, 'thud');
  Vo(14.2, 'thug_teal', 'grunt'); S(14.25, 'whiff', { quiet: true });
  S(14.4, 'punch', { taken: true }); Vo(14.45, 'matthew', 'hurt');
  for (let k = 0; k < 6; k++) S(15.4 + k * 0.17, 'step', { alt: k % 2, prio: true });
  S(16.45, 'jump'); Vo(16.45, 'matthew', 'big');
  S(16.75, 'finisher'); Vo(16.8, 'thug_orange', 'hurt'); S(16.95, 'land'); S(17.15, 'thud');
  S(18.0, 'getup'); Vo(18.3, 'thug_grey', 'grunt');
  S(19.2, 'stardrive'); Vo(19.2, 'matthew', 'special');
  S(19.55, 'star'); Vo(19.6, 'thug_grey', 'ko'); S(20.0, 'thud');
  Vo(20.4, 'thug_teal', 'ko');
  S(21.2, 'block');
  S(22.0, 'kick'); Vo(22.05, 'thug_red', 'ko'); S(22.4, 'thud');
  // street clear → victory sting, pickups
  at(23.2, () => e.stopSong(songs.fight, 23.2, 0.6));
  at(23.3, () => e.sting('victory', 23.3)); Vo(23.5, 'matthew', 'victory');
  S(25.3, 'pickup'); S(26.0, 'unlock');
  // roaming again: the street theme under the cast greetings + talk blips (dialogue duck)
  at(24.6, () => { songs.street = e.startSong('street', 24.6, 1.2); });
  at(27.4, () => e.duckMusic(0.5, 27.4));
  at(34.6, () => { e.duckMusic(1, 34.6); e.stopSong(songs.street, 34.6, 0.5); });
  let tt = 27.6;
  for (const id of ['dee', 'hank', 'tessa', 'wren']) {
    const t0 = tt;
    at(t0, () => { const g = oac.createGain(); g.connect(e.sfxIn); const d = e.greet(id, t0, g); e.talk(id, 'Hey Matthew, good to see you around here!', t0 + d + 0.05, g); });
    tt += 1.85;
  }
  // 35 s+: Silas boss theme
  at(35.0, () => { songs.boss = e.startSong('boss', 35.0, 0.3); });
  Vo(35.4, 'silas_boss', 'taunt');
  Vo(37.0, 'silas_boss', 'big'); S(37.0, 'whiff', { heavy: true }); S(37.25, 'heavy', { taken: true }); Vo(37.3, 'matthew', 'hurt'); S(37.6, 'thud');
  S(38.6, 'punch'); Vo(38.65, 'silas_boss', 'hurt');
  at(seconds - 1.6, () => e.stopSong(songs.boss, seconds - 1.6, 1.0));
  ev.sort((a, b) => a[0] - b[0]);
  let i = 0;
  const schedule = (until) => { while (i < ev.length && ev[i][0] < until) ev[i++][1](); e.pump(until); };
  const SLICE = 0.5, AHEAD = 0.8;
  schedule(AHEAD);
  for (let t = SLICE; t < seconds; t += SLICE) {
    const tt2 = t;
    oac.suspend(tt2).then(() => { schedule(tt2 + AHEAD); oac.resume(); });
  }
  return oac.startRendering();
}
/** Render one theme on its own (loop checks / benchmarks). */
export async function renderTrack(name, seconds = 10, sampleRate = 44100) {
  const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
  const oac = new OAC(2, Math.ceil(seconds * sampleRate), sampleRate);
  const e = new Engine(oac);
  e.applySettings({ music: 0.85, sfx: 0.9, muted: false });
  if (STINGS[name]) e.sting(name, 0.05); else e.startSong(name, 0, 0);
  e.pump(seconds);
  return oac.startRendering();
}
/** 16-bit PCM WAV bytes of an AudioBuffer (base64) — used by the preview tool. */
export function bufferToWavBase64(buf) {
  const ch = buf.numberOfChannels, len = buf.length, sr = buf.sampleRate;
  const out = new DataView(new ArrayBuffer(44 + len * ch * 2));
  const w = (o, s) => { for (let i = 0; i < s.length; i++) out.setUint8(o + i, s.charCodeAt(i)); };
  w(0, 'RIFF'); out.setUint32(4, 36 + len * ch * 2, true); w(8, 'WAVEfmt '); out.setUint32(16, 16, true);
  out.setUint16(20, 1, true); out.setUint16(22, ch, true); out.setUint32(24, sr, true); out.setUint32(28, sr * ch * 2, true);
  out.setUint16(32, ch * 2, true); out.setUint16(34, 16, true); w(36, 'data'); out.setUint32(40, len * ch * 2, true);
  const data = []; for (let c = 0; c < ch; c++) data.push(buf.getChannelData(c));
  let o = 44;
  for (let i = 0; i < len; i++) for (let c = 0; c < ch; c++) { out.setInt16(o, clamp(data[c][i], -1, 1) * 32767, true); o += 2; }
  const bytes = new Uint8Array(out.buffer); let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}
export const AUDIO_TRACKS = Object.keys(SONGS);
export { Engine as _AudioEngine }; // tests / offline tools
