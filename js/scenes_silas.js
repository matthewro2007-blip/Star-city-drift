/**
 * JACK-STORY (DRAFT, pending Matthew's approval): "Second Shift" (2015) cutscenes as scene-player data,
 * in the step format of /workspace/samples/proto/js/scene_player.js (moveActor / anim / cameraPan / line / wait / fade / letterbox).
 * Every spoken line carries `voice` (the clip id in /workspace/tmp_sprite/story_impl/voice_lines.csv) and a `delivery` note.
 * registerSilasScenes() (called by js/dlc_silas.js when a prequel run starts, i.e. after main.js has registered its own
 * scenes) registers these with js/scene_player.js and REPLACES main.js's 'dlc_closing' with the 2015 villain beat
 * (no Matthew walk-in, no lead-in to the main game). The other scenes are registered for review / future triggers;
 * the live missions still play the same lines through js/dlc_silas.js talk steps.
 * No 2028 DLC content here.
 */
import { registerScene } from './scene_player.js';

export const SILAS_SCENES = [
 {
  "id": "dlc1_m1_kid",
  "area": "downtown",
  "actors": [
   {
    "id": "silas",
    "key": "silas_player",
    "x": 420,
    "facing": -1,
    "state": "idle"
   },
   {
    "id": "matthew_young",
    "key": "matthew_young",
    "x": 330,
    "facing": 1,
    "state": "idle"
   }
  ],
  "steps": [
   {
    "kind": "letterbox",
    "to": 1,
    "dur": 0.5
   },
   {
    "kind": "cameraPan",
    "x": 380,
    "zoom": 1.4,
    "dur": 0.8
   },
   {
    "kind": "line",
    "speaker": "matthew_young",
    "name": "Matthew Rose",
    "text": "That was— you just— they ran.",
    "voice": "vo_matthew_young_dlc1_m1_kid_l01",
    "delivery": "breathless, awed"
   },
   {
    "kind": "line",
    "speaker": "silas",
    "name": "Silas Boone",
    "text": "They walked briskly. Name?",
    "voice": "vo_silas_dlc1_m1_kid_l02",
    "delivery": "dry, amused"
   },
   {
    "kind": "line",
    "speaker": "matthew_young",
    "name": "Matthew Rose",
    "text": "Matthew. Matthew Rose.",
    "voice": "vo_matthew_young_dlc1_m1_kid_l03",
    "delivery": "shy, straightening up"
   },
   {
    "kind": "line",
    "speaker": "silas",
    "name": "Silas Boone",
    "text": "Go home, Matthew Rose. Nights belong to men like them. For now.",
    "voice": "vo_silas_dlc1_m1_kid_l04",
    "delivery": "kind, with a hint of plan"
   },
   {
    "kind": "letterbox",
    "to": 0,
    "dur": 0.5
   }
  ]
 },
 {
  "id": "dlc1_m2_errand",
  "area": "pages",
  "actors": [
   {
    "id": "silas",
    "key": "silas_player",
    "x": 600,
    "facing": -1,
    "state": "idle"
   },
   {
    "id": "matthew_young",
    "key": "matthew_young",
    "x": 520,
    "facing": 1,
    "state": "idle"
   }
  ],
  "steps": [
   {
    "kind": "line",
    "speaker": "matthew_young",
    "name": "Matthew Rose",
    "text": "Is Priya right? About you?",
    "voice": "vo_matthew_young_dlc1_m2_errand_l01",
    "delivery": "testing, half-joking"
   },
   {
    "kind": "line",
    "speaker": "silas",
    "name": "Silas Boone",
    "text": "Priya is right about most things. An errand, kid. Dee's Diner, the counter. Don't open it.",
    "voice": "vo_silas_dlc1_m2_errand_l02",
    "delivery": "warm, smooth"
   },
   {
    "kind": "line",
    "speaker": "matthew_young",
    "name": "Matthew Rose",
    "text": "Ten bucks? For walking two blocks?",
    "voice": "vo_matthew_young_dlc1_m2_errand_l03",
    "delivery": "delighted"
   },
   {
    "kind": "line",
    "speaker": "silas",
    "name": "Silas Boone",
    "text": "For not opening it.",
    "voice": "vo_silas_dlc1_m2_errand_l04",
    "delivery": "soft, a little cold"
   }
  ]
 },
 {
  "id": "dlc1_m4_vera_after",
  "area": "river",
  "actors": [
   {
    "id": "silas",
    "key": "silas_player",
    "x": 600,
    "facing": -1,
    "state": "idle"
   },
   {
    "id": "vera",
    "key": "vera",
    "x": 520,
    "facing": 1,
    "state": "idle"
   },
   {
    "id": "marcus_young",
    "key": "marcus_young",
    "x": 820,
    "facing": -1,
    "state": "idle"
   }
  ],
  "steps": [
   {
    "kind": "anim",
    "id": "vera",
    "state": "knockdown_ground"
   },
   {
    "kind": "cameraPan",
    "x": 600,
    "dur": 0.8
   },
   {
    "kind": "line",
    "speaker": "vera",
    "name": "Vera Lisk",
    "text": "Fine. Take the files. He's at the Star. Go and lose there.",
    "voice": "vo_vera_dlc1_m4_vera_after_l01",
    "delivery": "winded, still sharp"
   },
   {
    "kind": "line",
    "speaker": "silas",
    "name": "Silas Boone",
    "text": "Keep your files, Ms. Lisk. Keep making them. From tonight, you make them for me.",
    "voice": "vo_silas_dlc1_m4_vera_after_l02",
    "delivery": "warm, unhurried"
   },
   {
    "kind": "line",
    "speaker": "silas",
    "name": "Silas Boone",
    "text": "…My lantern. It went under the rail. Leave it. Lanterns are for being found.",
    "voice": "vo_silas_dlc1_m4_vera_after_l03",
    "delivery": "quiet, almost amused"
   },
   {
    "kind": "anim",
    "id": "marcus_young",
    "state": "idle",
    "facing": -1
   },
   {
    "kind": "wait",
    "dur": 1.2
   },
   {
    "kind": "fade",
    "to": 1,
    "dur": 0.6
   }
  ]
 },
 {
  "id": "dlc1_m4_marcus",
  "area": "river",
  "actors": [
   {
    "id": "silas",
    "key": "silas_player",
    "x": 760,
    "facing": 1,
    "state": "idle"
   },
   {
    "id": "marcus_young",
    "key": "marcus_young",
    "x": 820,
    "facing": -1,
    "state": "idle"
   }
  ],
  "steps": [
   {
    "kind": "line",
    "speaker": "marcus_young",
    "name": "Marcus Hale",
    "text": "Evening. The lady with the green lamp's been up here three nights running. I log her. Don't tell her.",
    "voice": "vo_marcus_young_dlc1_m4_marcus_l01",
    "delivery": "dry, friendly"
   },
   {
    "kind": "line",
    "speaker": "silas",
    "name": "Silas Boone",
    "text": "Your secret is safe with me, Mr. …?",
    "voice": "vo_silas_dlc1_m4_marcus_l02",
    "delivery": "courteous"
   },
   {
    "kind": "line",
    "speaker": "marcus_young",
    "name": "Marcus Hale",
    "text": "Hale. Bridge tender.",
    "voice": "vo_marcus_young_dlc1_m4_marcus_l03",
    "delivery": "plain"
   },
   {
    "kind": "line",
    "speaker": "marcus_young",
    "name": "Marcus Hale",
    "text": "Quiet now. Lamps are lit. Whatever went under the rail can stay there.",
    "voice": "vo_marcus_young_dlc1_m4_marcus_l04",
    "delivery": "after the fight; calm, hiding something"
   }
  ]
 },
 {
  "id": "dlc1_m6_quit",
  "area": "diner",
  "actors": [
   {
    "id": "silas",
    "key": "silas_player",
    "x": 560,
    "facing": -1,
    "state": "idle"
   },
   {
    "id": "matthew_young",
    "key": "matthew_young",
    "x": 470,
    "facing": 1,
    "state": "idle"
   }
  ],
  "steps": [
   {
    "kind": "letterbox",
    "to": 1,
    "dur": 0.5
   },
   {
    "kind": "line",
    "speaker": "matthew_young",
    "name": "Matthew Rose",
    "text": "That's Wren's mom. You bought her loan?",
    "voice": "vo_matthew_young_dlc1_m6_quit_l01",
    "delivery": "hurt, disbelieving"
   },
   {
    "kind": "line",
    "speaker": "silas",
    "name": "Silas Boone",
    "text": "I bought her time, kid. Someone kind had to.",
    "voice": "vo_silas_dlc1_m6_quit_l02",
    "delivery": "gentle, reasonable"
   },
   {
    "kind": "line",
    "speaker": "matthew_young",
    "name": "Matthew Rose",
    "text": "Here's your money. All of it. I don't run your envelopes anymore.",
    "voice": "vo_matthew_young_dlc1_m6_quit_l03",
    "delivery": "shaky but firm"
   },
   {
    "kind": "line",
    "speaker": "silas",
    "name": "Silas Boone",
    "text": "Everyone runs my envelopes eventually. Do your homework, Matthew.",
    "voice": "vo_silas_dlc1_m6_quit_l04",
    "delivery": "calm; the first crack of a grudge"
   },
   {
    "kind": "moveActor",
    "id": "matthew_young",
    "to": 200,
    "state": "walk"
   },
   {
    "kind": "letterbox",
    "to": 0,
    "dur": 0.5
   }
  ]
 },
 {
  "id": "dlc1_finale",
  "area": "downtown",
  "actors": [
   {
    "id": "silas",
    "key": "silas_player",
    "x": 700,
    "facing": -1,
    "state": "idle"
   },
   {
    "id": "foreman",
    "key": "foreman",
    "x": 820,
    "facing": -1,
    "state": "idle"
   },
   {
    "id": "lou",
    "key": "lou",
    "x": 430,
    "facing": 1,
    "state": "idle"
   }
  ],
  "steps": [
   {
    "kind": "letterbox",
    "to": 1,
    "dur": 0.5
   },
   {
    "kind": "cameraPan",
    "x": 700,
    "zoom": 1.3,
    "dur": 1
   },
   {
    "kind": "line",
    "speaker": "foreman",
    "name": "Mort \"The Foreman\" Kessler",
    "text": "Pharmacy on Campbell says it won't pay.",
    "voice": "vo_foreman_dlc1_finale_l01",
    "delivery": "gruff, reporting"
   },
   {
    "kind": "line",
    "speaker": "silas",
    "name": "Silas Boone",
    "text": "Then write it down, Mr. Kessler. Everyone pays eventually. We're a patient company.",
    "voice": "vo_silas_dlc1_finale_l02",
    "delivery": "pleasant; a threat"
   },
   {
    "kind": "line",
    "speaker": "silas",
    "name": "Silas Boone",
    "text": "This was Lou's corner. I stood here and kept it safe. Now I keep all of them.",
    "voice": "vo_silas_dlc1_finale_l03",
    "delivery": "quiet, satisfied"
   },
   {
    "kind": "anim",
    "id": "lou",
    "state": "idle",
    "facing": -1
   },
   {
    "kind": "wait",
    "dur": 1.0
   },
   {
    "kind": "fade",
    "to": 1,
    "dur": 0.9
   },
   {
    "kind": "line",
    "speaker": "card",
    "name": "",
    "text": "Eleven years later.",
    "voice": null,
    "dur": 2.5
   }
  ]
 }
];
export const sceneById = (id) => SILAS_SCENES.find((s) => s.id === id) || null;

const castActors = (sc) => (c) => sc.actors.filter((a) => a.id !== 'silas').map((a) => ({ kind: 'cast', id: a.id, key: a.key, x: a.x, y: c.band ? Math.round((c.band.min + c.band.max) / 2) : undefined, facing: a.facing, state: a.state }));
let registered = false;
/** Idempotent. Silas is the player in every prequel scene, so his ActorDef is dropped (the player stands in). */
export function registerSilasScenes() {
  if (registered) return; registered = true;
  for (const sc of SILAS_SCENES) registerScene({ id: sc.id, area: sc.area, actors: castActors(sc), playerMark: (sc.actors.find((a) => a.id === 'silas') || {}).x !== undefined ? { x: sc.actors.find((a) => a.id === 'silas').x, facing: sc.actors.find((a) => a.id === 'silas').facing } : null /* 1.9.0: player stands on Silas's mark */, steps: sc.steps.filter((st) => st.speaker !== 'card') });
  const fin = sceneById('dlc1_finale');
  registerScene({ // replaces main.js 1.9.0 'dlc_closing' (same id, same onDone flow via playScene opts)
    id: 'dlc_closing',
    keepNpcs: [],
    actors: (c) => {
      const L = c.frame.x, V = c.frame.viewW, band = c.band;
      return [
        { kind: 'cast', id: 'foreman', key: 'foreman', x: Math.round(L + V - 150), y: Math.round((band.min + band.max) / 2), facing: -1 },
        { kind: 'thug', id: 'crew1', color: 'grey', x: Math.round(L + V - 70), y: band.min + 10, facing: -1, t: 0 },
        { kind: 'thug', id: 'crew2', color: 'red', x: Math.round(L + V - 30), y: band.min + 26, facing: -1, t: 0.4 }
      ];
    },
    steps: (c) => [
      { kind: 'letterbox', to: 1, dur: 0.5, async: true },
      { kind: 'call', fn: () => { const cs = c.gameState && c.gameState.cutscene; if (cs) cs.phase = 'talk'; } },
      { kind: 'lines', lines: fin.steps.filter((st) => st.kind === 'line' && st.speaker !== 'card').map((st) => ({ id: st.speaker, name: st.name, text: st.text, voice: st.voice })) },
      { kind: 'call', fn: () => { const cs = c.gameState && c.gameState.cutscene; if (cs) { cs.phase = 'done'; cs.doneT = cs.t; } } },
      { kind: 'wait', dur: 0.8 }
    ]
  });
}
