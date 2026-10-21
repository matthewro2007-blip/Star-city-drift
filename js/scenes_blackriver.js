/**
 * 2.0.0 (WIP) Blackriver DLC cutscenes, scene-player data (js/scene_player.js). Lines are voiced by text lookup
 * (assets/vo/manifest.json, speaker + text), generated with tools/gen_blackriver_vo.py.
 * Silas is a cast actor in these scenes (hidePlayer) so he can walk on his own marks; the player is put on his end mark.
 */
import { registerScene } from './scene_player.js';

const MID = (c, d = 0) => (c.band ? Math.round((c.band.min + c.band.max) / 2) + d : undefined);
const S = (text, extra = {}) => ({ kind: 'line', speaker: 'silas', name: 'Silas Boone', text, ...extra });
const M = (text, extra = {}) => ({ kind: 'line', speaker: 'matthew', name: 'Matthew Rose', text, expr: 'neutral', ...extra }); // portrait: matthew_2028 (main.js maps it in Blackriver)
const P = (text, name = 'C.O. Pruitt') => ({ kind: 'line', speaker: 'pruitt', name, text });
const K = (text, name = 'The Lockkeeper') => ({ kind: 'line', speaker: 'lockkeeper', name, text });
const markPlayer = (x, facing = 1) => ({ kind: 'call', fn: (c) => { if (c.player) { c.player.x = x; c.player.facing = facing; } } });

export const BR_SCENES = [
  { // M0: the DLC opening (script: /workspace/samples/blackriver/cutscene/matthew_visits_silas_SAMPLE.md)
    id: 'br_visiting_hours', area: 'pr_lobby', hidePlayer: true, bystanders: 'all', fade: 1,
    camera: { x: 560, zoom: 1.45 },
    actors: (c) => [
      { kind: 'cast', id: 'matthew', key: 'matthew_2028', x: 470, y: MID(c), facing: 1 }, // 1.9.1-m2028: Joe's 2028 Matthew
      { kind: 'cast', id: 'silas', key: 'silas_c14', x: 940, y: MID(c), facing: -1 },
      { kind: 'cast', id: 'pruitt', key: 'okafor', x: 1020, y: MID(c, -10), facing: -1 }
    ],
    steps: [
      { kind: 'letterbox', to: 1, dur: 0 },
      { kind: 'fade', to: 0, dur: 1.2 },
      { kind: 'line', speaker: 'card', name: 'Cinder Hollow Correctional', text: 'Autumn 2028. Two years after the Star came back on.', dur: 2.6 },
      { kind: 'moveActor', id: 'silas', to: 650, speed: 70, async: true },
      { kind: 'moveActor', id: 'pruitt', to: 760, speed: 70, async: true },
      { kind: 'cameraPan', x: 580, dur: 2.2 },
      P('Fifteen minutes. Hands where I can see them, C-14.'),
      S('Matthew Rose. Two years, and you finally use the bus pass.'),
      M("I didn't come for small talk, Silas."),
      S("No. You look like a man who hasn't slept since the Star came back on."),
      { kind: 'cameraZoom', zoom: 2.3, dur: 1.0 },
      M("Two years I've been cleaning up after you. Burned-out shops. Families who lost everything to your loans. People still scared to open their own doors.", { expr: 'concerned' }),
      M("Every time we close one hole, someone else is already digging the next one. Same way you did it. Better money.", { expr: 'concerned' }),
      S("Imitation. I'd be flattered if it weren't so sloppy."),
      M("Blackriver. That name's on every one of them. Do you know anything about Blackriver?", { expr: 'concerned' }),
      { kind: 'wait', dur: 1.2 },
      S('I know a great many names, Matthew. Most of them owed me money.'),
      M("That's not an answer.", { expr: 'concerned' }),
      S("It's the only one the state of Virginia lets me give for free."),
      { kind: 'cameraZoom', zoom: 1.45, dur: 0.8 },
      P('Time.'),
      M('If you hear anything, you send word. For once in your life, help somebody.', { expr: 'concerned' }),
      S("Go home, Matthew. Get some sleep. Roanoke's going to need you awake."),
      { kind: 'moveActor', id: 'matthew', to: 140, speed: 90, async: true },
      { kind: 'wait', dur: 1.6 },
      { kind: 'fade', to: 1, dur: 0.8 },
      { kind: 'line', speaker: 'card', name: 'Cell 14', text: 'That evening. The library cart comes by. His returned book is heavier than it should be.', dur: 3.0 },
      { kind: 'fade', to: 0, dur: 0.6 },
      S("...Well. Someone's been listening."),
      { kind: 'fade', to: 1, dur: 0.8 },
      { kind: 'letterbox', to: 0, dur: 0 },
      { kind: 'fade', to: 0, dur: 0.3 }
    ] },
  { // M1: lights out, cell 14 opens (from the sample proto)
    id: 'br_prison_escape', area: 'pr_block', hidePlayer: true, bystanders: 'all', fade: 1,
    camera: { x: 670, zoom: 1.5 },
    actors: (c) => [
      { kind: 'cast', id: 'silas', key: 'silas_c14', x: 580, y: MID(c), facing: 1 },
      { kind: 'cast', id: 'pruitt', key: 'okafor', x: 760, y: MID(c, 10), facing: -1 }
    ],
    steps: [
      { kind: 'letterbox', to: 1, dur: 0 },
      { kind: 'fade', to: 0, dur: 1.0 },
      P("Lights out, C-14. Two years in, and you still fold your blanket like it's a hotel."),
      { kind: 'cameraZoom', zoom: 2.3, dur: 1.0 },
      S("Habit, Officer Pruitt. A man should leave every room the way he'd like to find it."),
      { kind: 'moveActor', id: 'pruitt', to: 1400, speed: 90, async: true },
      { kind: 'cameraZoom', zoom: 1.5, dur: 0.8 },
      { kind: 'fade', to: 0.85, dur: 0.6 },
      { kind: 'wait', dur: 0.8 },
      { kind: 'fade', to: 0.35, dur: 0.6 },
      S('Twenty-five years, the judge said. I counted seven hundred and thirty days. That was plenty.'),
      S("Somebody went to a great deal of trouble to get these tools in here. I'd like to thank them in person."),
      { kind: 'fade', to: 0, dur: 0.3 },
      { kind: 'moveActor', id: 'silas', to: 900, speed: 110, async: true },
      { kind: 'cameraPan', x: 900, dur: 2.4 },
      P('Hey! Who opened cell fourteen? Lock it down! Lock the whole block down!'),
      markPlayer(900, 1),
      { kind: 'letterbox', to: 0, dur: 0.4 }
    ] },
  { // M8: after the Lockkeeper fight, the mask comes off (Marcus Hale)
    id: 'br_reveal', area: 'rails', hidePlayer: true, bystanders: 'all',
    actors: (c) => {
      const x = c.player ? Math.round(c.player.x) : 700;
      return [
        { kind: 'cast', id: 'silas', key: 'silas_red', x, y: MID(c), facing: 1 },
        { kind: 'cast', id: 'lockkeeper', key: 'marcus_lockkeeper', x: x + 190, y: MID(c), facing: -1 },
        { kind: 'cast', id: 'thorne', key: 'thorne', color: '#1b2a33', x: x - 260, y: MID(c, -12), facing: 1 }
      ];
    },
    steps: (c) => {
      const x = c.player ? Math.round(c.player.x) : 700;
      return [
        { kind: 'letterbox', to: 1, dur: 0.5 },
        { kind: 'cameraPan', x: x + 95, zoom: 1.9, dur: 1.0 },
        K('Go on, then. You always wanted to know who was holding the leash.', 'The Lockkeeper'),
        { kind: 'fade', to: 1, dur: 0.4 },
        { kind: 'anim', id: 'lockkeeper', key: 'marcus' },
        { kind: 'fade', to: 0, dur: 0.6 },
        { kind: 'cameraZoom', zoom: 2.6, dur: 0.8 },
        { kind: 'line', speaker: 'marcus', name: 'Marcus Hale', text: 'Two years tending the bridge, watching your people walk over it. Somebody had to keep the keys, Silas.' },
        S('Marcus Hale. The bridge tender. The scar on the mask should have told me.'),
        { kind: 'line', speaker: 'marcus', name: 'Marcus Hale', text: 'Blackriver promised me the city once the locks were mine. They lied.' },
        { kind: 'cameraZoom', zoom: 1.6, dur: 0.8 },
        { kind: 'line', speaker: 'thorne', name: 'Celia Thorne', text: "We don't lie, Mr. Hale. We choose. Mr. Boone, the job is yours if you want it." },
        S('I always walk out on my own two feet, Ms. Thorne. Tonight I think I will walk out with you.'),
        { kind: 'letterbox', to: 0, dur: 0.4 }
      ];
    } },
  { // finale: Silas joins Blackriver; ending card + sequel hook follow (main.js showDlcEnding)
    id: 'br_ending', area: 'river', hidePlayer: true, bystanders: 'all', fade: 1,
    camera: { x: 560, zoom: 1.5 },
    actors: (c) => [
      { kind: 'cast', id: 'silas', key: 'silas_red', x: 420, y: MID(c), facing: 1 },
      { kind: 'cast', id: 'thorne', key: 'thorne', color: '#1b2a33', x: 640, y: MID(c), facing: -1 }
    ],
    steps: [
      { kind: 'letterbox', to: 1, dur: 0 },
      { kind: 'fade', to: 0, dur: 1.0 },
      { kind: 'line', speaker: 'thorne', name: 'Celia Thorne', text: 'Welcome to Blackriver, Mr. Boone. We have a car waiting, and a great many doors.' },
      S('Then let us go and open them.'),
      { kind: 'moveActor', id: 'silas', to: 1050, speed: 70, async: true },
      { kind: 'moveActor', id: 'thorne', to: 1110, speed: 70, async: true },
      { kind: 'cameraPan', x: 900, dur: 3.2 },
      { kind: 'fade', to: 1, dur: 1.0 },
      { kind: 'letterbox', to: 0, dur: 0 }
    ] },
  { // epilogue / sequel hook: City Market, Wren's flower cart, daylight (day: main.js skips the DLC night grade)
    id: 'br_epilogue', area: 'downtown', day: true, hidePlayer: true, bystanders: 'all', fade: 1,
    camera: { x: 960, zoom: 2.5 },
    actors: (c) => [
      { kind: 'cast', id: 'wren', key: 'wren', x: 1040, y: MID(c, -6), facing: -1 },
      { kind: 'cast', id: 'matthew', key: 'matthew_2028', x: 760, y: MID(c, 6), facing: 1 }
    ],
    steps: [
      { kind: 'letterbox', to: 1, dur: 0 },
      { kind: 'fade', to: 0, dur: 0.9 },
      { kind: 'moveActor', id: 'matthew', to: 930, speed: 70 },
      { kind: 'anim', id: 'matthew', state: 'idle_personality' },
      { kind: 'line', speaker: 'card', name: 'Roanoke · six weeks later', text: 'An envelope on Wren\'s flower cart, addressed to Matthew Rose. Inside: a blank key, and one line. "Ask better next time."', dur: 4.2 },
      { kind: 'cameraZoom', zoom: 2.9, dur: 1.2 },
      { kind: 'wait', dur: 1.0 },
      { kind: 'fade', to: 1, dur: 1.0 },
      { kind: 'line', speaker: 'card', name: 'Blackriver will return.', text: 'Somewhere far from Roanoke, Silas Boone shakes hands with someone we have not met yet.', dur: 3.6 },
      { kind: 'letterbox', to: 0, dur: 0 }
    ] }
];
export const brSceneById = (id) => BR_SCENES.find((s) => s.id === id) || null;
let registered = false;
/** Idempotent; called when a Blackriver run starts. */
export function registerBlackriverScenes() {
  if (registered) return; registered = true;
  const auto = (steps) => steps.map((st) => (st.kind === 'line' && st.dur == null ? { ...st, dur: Math.max(2.4, st.text.split(/\s+/).length * 0.36 + 0.9) } : st)); // auto-advance (E still skips ahead)
  for (const sc of BR_SCENES) registerScene({ ...sc, steps: typeof sc.steps === 'function' ? (c) => auto(sc.steps(c)) : auto(sc.steps) });
}
/** All spoken scene lines (not cards), for VO generation and tests. */
export function brSceneLines() {
  const out = [];
  const fake = { player: { x: 700 }, band: { min: 300, max: 400 } };
  for (const sc of BR_SCENES) {
    const steps = typeof sc.steps === 'function' ? sc.steps(fake) : sc.steps;
    for (const st of steps) if (st.kind === 'line' && st.speaker !== 'card') out.push({ id: st.speaker, name: st.name, text: st.text, scene: sc.id });
  }
  return out;
}
