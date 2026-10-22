/** Original fictional cast — preserved from 3D build. */
import { MARCUS_NPC } from './marcus.js';
import { WILLIAM_NPC } from './william.js'; // 2.0.2: Matthew's oldest friend (NPC + side quests) // JACK-STORY: River Bridge tender (side missions only)
export const NPC_DEFS = [
  {
    id: 'dee', name: 'Dee Morales', role: 'Diner cook',
    // audio: talk-blip voice (waveform, pitch, cadence) + greeting, used by js/audio.js
    voice: { wave: 'triangle', f0: 255, rate: 0.075, len: 0.06, steps: [1, 1.12, 1.26, 1.5], vowels: ['a', 'o', 'e'], fs: 1.12, greet: ['e', 'o'] },
    area: 'diner', x: 320, color: '#d35400',
    lines: [
      "Matthew. Sit down, hon. Your old booth. Wren never came back from closing her cart last night.",
      "I called the police. They say she's a runaway. Wren? She'd never leave her flowers.",
      "She owed money to Boone Holdings, same as half this street. Same man who used to tip you twenty for a coffee run.",
      "Priya at Valley Pages keeps a list. Go see her."
    ],
    doneLines: [
      "Priya's at Valley Pages, next street over to the right. Bring Wren home, Matthew. Please."
    ]
  },
  {
    id: 'priya', name: 'Priya Shah', role: 'Bookstore clerk',
    // audio: talk-blip voice (waveform, pitch, cadence) + greeting, used by js/audio.js
    voice: { wave: 'sine', f0: 330, rate: 0.065, len: 0.05, steps: [1, 1.12, 1.33, 1.5, 1.68], vowels: ['i', 'e', 'a'], fs: 1.18, slide: 1.08, greet: ['a', 'i'] },
    area: 'pages', x: 380, color: '#8e44ad',
    lines: [
      "Matthew. You got tall. Dee texted. Close the door. Here's my list: eleven people gone since spring.",
      "I told you at sixteen what that man was. I should've told everyone.",
      "Every one of them owed Boone Holdings. Silas Boone's front company. Then come the fires, the 'accidents', the shops that sell cheap.",
      "The Foreman's crew sets the fires. Vera Lisk keeps files on anyone who talks. And the trucks go through the Rail Yards. Hank sees everything there."
    ],
    waitLines: [
      "Sorry, we're closed early. Too many shops burning lately. Dee keeps texting about you. Talk to her first? The diner's just left of here."
    ],
    doneLines: [
      "Hank hangs around the Rail Yards, past the gym. Don't trust a badge out there, Matthew. Not tonight."
    ]
  },
  {
    id: 'hank', name: 'Hank "Rail" Pettigrew', role: 'Retired rail worker',
    // audio: talk-blip voice (waveform, pitch, cadence) + greeting, used by js/audio.js
    voice: { wave: 'sawtooth', f0: 105, rate: 0.115, len: 0.09, steps: [1, 0.94, 1.06], vowels: ['o', 'u', 'uh'], fs: 0.86, grit: 0.35, greet: ['uh', 'o'], greetFall: true },
    area: 'rails', x: 450, color: '#7f8c8d',
    lines: [
      "Boone trucks roll through here every night, and two patrol cars wave them on. Eleven years they've been on his payroll, kid.",
      "I said no to his envelope once, back in 2015. Cost me my nights.",
      "Last night they loaded spools of cable and a work order for the Mill Mountain Star. Tomorrow's the city's anniversary.",
      "He's going to black out the Star, kid. And I saw a girl with flowers on her coat in the back of that truck. They took her up the mountain."
    ],
    waitLines: [
      "Rail yard's no place for sightseeing, kid. Patrol cars out tonight. Come back when you've got a real reason to ask."
    ],
    doneLines: [
      "Silas Boone is up at the Star. Midnight, kid. Get your friend back before the lights go out."
    ]
  },
  {
    id: 'june', name: 'June Whitaker', role: 'Community center volunteer',
    // audio: talk-blip voice (waveform, pitch, cadence) + greeting, used by js/audio.js
    voice: { wave: 'triangle', f0: 290, rate: 0.095, len: 0.075, steps: [1, 1.12, 1.25], vowels: ['o', 'a', 'u'], fs: 1.12, slide: 0.94, greet: ['e', 'o'] },
    area: 'community', x: 300, color: '#27ae60',
    lines: [
      "Rough night? Community Center's open. Half the block sleeps here since the fires.",
      "Drop flyers for Wren at Elmwood, or help set cots. Soft landings matter.",
      "You're doing fine, Matthew. Come back if the city feels too dark."
    ],
    doneLines: [
      "Cots are set, Wren's flyers are out. Thanks, Matthew. Door's always open."
    ]
  },
  {
    id: 'tessa', name: 'Tessa Quinn', role: 'Skate-shop kid',
    // audio: talk-blip voice (waveform, pitch, cadence) + greeting, used by js/audio.js
    voice: { wave: 'square', f0: 385, rate: 0.05, len: 0.04, steps: [1, 1.19, 1.33, 1.5, 1.78], vowels: ['i', 'e', 'ae'], fs: 1.25, greet: ['ae', 'o'] },
    area: 'skate', x: 340, color: '#e74c3c',
    lines: [
      "Yo. Gear's stashed around Star City. Hoodie near the Star path, jacket by the rails.",
      "Street rumor: a rideshare keeps circling Jefferson right before a shop catches fire.",
      "Collect the gear. Stay out of the rain. And don't trust anyone in a Boone Holdings jacket."
    ],
    doneLines: [
      "Stuff's stashed all over town — check the far ends of every street. Some fits, some just cool junk. Go get 'em."
    ]
  },
  {
    id: 'coach', name: 'Coach Ray Delgado', role: 'Gym acquaintance',
    // audio: talk-blip voice (waveform, pitch, cadence) + greeting, used by js/audio.js
    voice: { wave: 'sawtooth', f0: 150, rate: 0.08, len: 0.07, steps: [1, 1.25, 1.5], vowels: ['a', 'o', 'uh'], fs: 0.95, grit: 0.1, greet: ['ae', 'a'], greetFall: true },
    area: 'gym', x: 360, color: '#2980b9',
    lines: [
      "Matthew! Need a courier who can hustle. Medicine for the folks camped by the River Bridge. Better than the errands you used to run, kid.",
      "Boone's people burned the pharmacy on Campbell. Somebody has to carry it.",
      "Keep your feet moving. Trouble hates a moving target."
    ],
    activeLines: [
      "Package goes to the River Bridge — right past the Rail Yards. Move those feet!"
    ],
    doneLines: [
      "Delivered on time? Knew you had hustle. Gym's open whenever."
    ]
  },
  {
    id: 'cam', name: 'Cam Ortiz', role: 'Rideshare driver',
    // audio: talk-blip voice (waveform, pitch, cadence) + greeting, used by js/audio.js
    voice: { wave: 'square', f0: 205, rate: 0.058, len: 0.05, steps: [1, 1.12, 1.26, 0.89], vowels: ['a', 'e', 'uh'], fs: 1.02, slide: 1.05, greet: ['ae', 'o'] },
    area: 'downtown', x: 520, color: '#f1c40f',
    lines: [
      "Need a lift? Wait. Wrong pin again. A woman named Vera Lisk keeps sending me the wrong pins.",
      "She has photos of my brother's bad night. Says she'll mail them to his boss unless I drive where she says.",
      "She's had my plate since my first year driving. 2015. Said she never forgets a car.",
      "Every pin lands on a shop that burns the next day. I'm done driving for her, Matthew. Tell the right people."
    ],
    doneLines: [
      "Last pin Vera sent says Mill Mountain, midnight. I'm not going. You shouldn't either. But you will, huh?"
    ]
  },
  {
    // v2 minor NPC (original). No sheet yet: drawn with the procedural NPC body tinted teal.
    id: 'wren', name: 'Wren Calloway', role: 'City Market flower seller',
    // audio: talk-blip voice (waveform, pitch, cadence) + greeting, used by js/audio.js
    voice: { wave: 'sine', f0: 430, rate: 0.088, len: 0.07, steps: [1, 1.26, 1.5, 2], vowels: ['i', 'e', 'o'], fs: 1.3, slide: 1.12, greet: ['i', 'o'] },
    area: 'downtown', x: 1000, color: '#1abc9c',
    lines: ["Matthew! Fresh zinnias, two for five. Boone's men came by again. Mom's loan never dies. Walk with me after close?"],
    doneLines: ["Purse is back, petals are fine. You came up that mountain for me. You're a good egg, Matthew."]
  },
  {
    id: 'silas', name: 'Silas Boone', role: 'Boone Holdings',
    // audio: talk-blip voice (waveform, pitch, cadence) + greeting, used by js/audio.js
    voice: { wave: 'sawtooth', f0: 118, rate: 0.105, len: 0.08, steps: [1, 0.89, 1.06], vowels: ['o', 'e', 'uh'], fs: 0.92, slide: 0.95, greet: ['e', 'o'], greetFall: true },
    area: 'star', x: 300, color: '#2c3e50', // 1.6.0: the finale is on Mill Mountain
    lines: [
      "Matthew Rose. Eleven years, and you still come when I call. You climbed a mountain in the rain to watch my city go dark.",
      "Every block that owed me, I collected. Wren owed a little more. Her mother's loan, kid. You carried the envelope.",
      "She's in the switch house. Quite safe, for now.",
      "At midnight the Star goes out. When it comes back on, Roanoke answers to Boone Holdings. Walk away, or stand in the dark with her."
    ],
    waitLines: [
      "You quit on me once, at Dee's counter. I kept your ten dollars.",
      "Matthew Rose. Lovely rain. Go home. We'll talk properly once you've done a little more homework."
    ],
    doneLines: [
      "The lights always come back on, Matthew. So do I."
    ]
  },
  // ===================== 1.7.0: Cinder Hollow Correctional (after the campaign; peaceful, no fights inside) =====================
  {
    id: 'ellis', name: 'Officer Dwayne Ellis', role: 'Visitor desk, Cinder Hollow', prison: true,
    voice: { wave: 'triangle', f0: 140, rate: 0.09, len: 0.08, steps: [1, 0.94, 1.06], vowels: ['o', 'uh', 'a'], fs: 0.9, greet: ['uh', 'o'], greetFall: true },
    area: 'pr_lobby', x: 300, color: '#34465e',
    lines: [
      "Visitor badge, please. Matthew Rose? Huh. Half this building knows your name. The other half wishes they didn't.",
      "Visiting hours run till the lights flicker twice. Cell Block C is through the right door. Mess hall, library, workshop and the yard after that.",
      "No contraband, no fighting, no feeding the yard pigeons. And if you're here for Boone: C-14. He's been expecting you."
    ]
  },
  {
    id: 'ramos', name: 'Officer Luis Ramos', role: 'Cell Block C', prison: true,
    voice: { wave: 'square', f0: 150, rate: 0.075, len: 0.06, steps: [1, 1.12, 0.94], vowels: ['a', 'o', 'e'], fs: 0.95, greet: ['a', 'o'] },
    area: 'pr_block', x: 260, color: '#34465e',
    lines: [
      "Cell Block C. Two tiers, ninety-six bunks and one man who still irons his blues.",
      "I worked the Rail Yards beat before this job. Didn't take a dime from Boone trucks. Got moved out here for it. Funny how it worked out.",
      "Boone's at the far end, C-14. Keep your hands where I can see them and you'll be fine."
    ]
  },
  {
    id: 'quay', name: 'Quay "Quiet" Dunn', role: 'Inmate 0904 · Cell Block C', prison: true,
    voice: { wave: 'sine', f0: 112, rate: 0.13, len: 0.1, steps: [1, 0.9, 1.0], vowels: ['o', 'u', 'uh'], fs: 0.85, greet: ['o', 'uh'], greetFall: true },
    area: 'pr_block', x: 760, color: '#d67828',
    lines: [
      "Twenty-two years in Block C. Long enough to tell a man's footsteps from the end of the hall. Yours are new.",
      "Boone came in like he owned the place. Asked the guards to call him Mister. They didn't.",
      "He reads every night. Same old newspaper, folded soft as cloth. Library's got the rest of that stack, if you're curious."
    ]
  },
  {
    id: 'reed', name: 'Reed "Tags" Malloy', role: 'Inmate 4821 · Mess Hall', prison: true,
    voice: { wave: 'square', f0: 240, rate: 0.055, len: 0.045, steps: [1, 1.19, 1.33, 1.5], vowels: ['e', 'a', 'i'], fs: 1.1, greet: ['e', 'o'] },
    area: 'pr_mess', x: 360, color: '#d67828',
    lines: [
      "Painted a star on the River Bridge pier. Wrong wall, wrong night. Eight months.",
      "You know Wren? Flower lady? She used to slip me zinnias to sketch. Tell her the drawings are getting good.",
      "Boone's guys tried to recruit me to tag 'final notice' on shop doors. I said no. Best bad decision I ever made."
    ]
  },
  {
    id: 'mina', name: 'Mina Solis', role: 'Inmate 6214 · Mess Hall', prison: true,
    voice: { wave: 'sine', f0: 360, rate: 0.07, len: 0.055, steps: [1, 1.12, 1.33, 1.26], vowels: ['i', 'a', 'e'], fs: 1.2, slide: 1.06, greet: ['a', 'i'] },
    area: 'pr_mess', x: 820, color: '#d67828',
    lines: [
      "I carried envelopes for Vera Lisk. Never opened one. Turns out that doesn't count for much in court.",
      "Cam Ortiz testified. Brave guy. He looked at me like he was sorry I got caught in it. I'm sorry too.",
      "Vera's files? Never found. She said once that paper burns but people remember. I think she meant it as a warning.",
      "I carried Vera's lamp the night she lost her first files. 2015. I was nineteen."
    ]
  },
  {
    id: 'dora', name: 'Dora Keene', role: 'Inmate 5107 · Library trustee', prison: true,
    voice: { wave: 'triangle', f0: 300, rate: 0.08, len: 0.06, steps: [1, 1.12, 1.26], vowels: ['e', 'a', 'o'], fs: 1.12, greet: ['e', 'a'] },
    area: 'pr_library', x: 360, color: '#d67828',
    lines: [
      "Shh. Library voice. I kept the books for Boone Holdings for eleven years. Signed on the day it opened. Now I keep these. Better company.",
      "The Foreman's ledger, the one with Wren's name? I'm the one who told the prosecutors where to look. I sleep a little better now.",
      "Someone donated a box of old Roanoke papers. Spring 2015. Check the return cart in the back. Silas keeps asking for one issue.",
      "The day the company opened, a boy was busing tables at Dee's. Silas watched him the whole time."
    ]
  },
  {
    id: 'otto', name: 'Otto "Wrench" Pike', role: 'Inmate 3390 · Workshop', prison: true,
    voice: { wave: 'sawtooth', f0: 98, rate: 0.11, len: 0.09, steps: [1, 0.94, 1.06], vowels: ['uh', 'o', 'a'], fs: 0.82, grit: 0.4, greet: ['uh', 'a'], greetFall: true },
    area: 'pr_shop', x: 520, color: '#d67828',
    lines: [
      "I ran the Foreman's tool truck. Gas cans, crowbars, all of it. I'm not proud. Just honest now.",
      "Building birdhouses for the Community Center. June Whitaker sent the plans. Said every block needs somewhere soft to land.",
      "Mort Kessler, the Foreman, he's in the other wing. Won't come to shop class. Says hammers are beneath him. Ha.",
      "I drove the Foreman's truck till the night Boone bought it. Same truck. New boss."
    ]
  },
  {
    id: 'bart', name: 'Bart Holley', role: 'Inmate 1188 · The Yard', prison: true,
    voice: { wave: 'sawtooth', f0: 130, rate: 0.095, len: 0.075, steps: [1, 0.89, 1.0], vowels: ['o', 'a', 'uh'], fs: 0.9, grit: 0.15, greet: ['o', 'a'], greetFall: true },
    area: 'pr_yard', x: 640, color: '#d67828',
    lines: [
      "I wore a badge in the Rail Yards. I waved the Boone trucks through. Took the envelope every Friday.",
      "Hank Pettigrew's notes put me here. Old man wrote down every plate number for two years. I'd shake his hand if he'd let me.",
      "Sergeant Reyes cuffed Boone on the mountain. She's the real thing. The city's lucky some of us never took the money.",
      "I took Boone's first envelope in 2015. Second shift. Hank Pettigrew watched me take it."
    ]
  },
  {
    id: 'silas_prison', name: 'Silas Boone', role: 'Inmate C-14 · Cell Block C', prison: true,
    voice: { wave: 'sawtooth', f0: 118, rate: 0.105, len: 0.08, steps: [1, 0.89, 1.06], vowels: ['o', 'e', 'uh'], fs: 0.92, slide: 0.95, greet: ['e', 'o'], greetFall: true },
    area: 'pr_block', x: 1260, color: '#30486e',
    lines: ["Matthew Rose. Visiting hours. How thoughtful."]   // the real conversation is the branching tree in js/prison.js
  },
  MARCUS_NPC, // JACK-STORY
  WILLIAM_NPC // 2.0.2
];

export const OUTFITS = {
  polo: { name: 'White Polo Tee', shirt: '#fafaf8', pants: '#5a7aa8', accent: '#1a2f5c', desc: "Matthew's everyday white polo. Clean, easy, ready for anything." },
  hoodie: { name: 'Star City Hoodie', shirt: '#2c4a7a', pants: '#2a2a2e', accent: '#ffd24a', desc: "Navy Star City hoodie with the gold star — the Mill Mountain classic." },
  jacket: { name: 'Rail Yard Jacket', shirt: '#3d4a3a', pants: '#3a3a48', accent: '#c45c26', desc: "Weathered rail-yard work jacket with burnt-orange trim." },
  street: { name: 'Skate Fit', shirt: '#111111', pants: '#5a7aaa', accent: '#e83e3e', desc: "All-black skate fit with red kicks, straight from Starboard Skate." },
  // Matthew's real look from his classroom photo (sheet: assets/sprites/matthew_photo.png)
  photo: { name: 'Classroom Photo Tee', shirt: '#fafaf8', pants: '#5a7aa8', accent: '#1a2f5c', desc: "The tee from Matthew's classroom photo. A little piece of the real guy." },
  // v2 outfits — Joe's sheets load as matthew_<id>.png; until then getMatthewSprite falls back to polo
  varsity: { name: 'Valley Gym Varsity Jacket', shirt: '#7a1f2b', pants: '#2a2a2e', accent: '#f2e6c8', desc: "Valley Gym varsity jacket in maroon and cream. Earned in the ring." },
  mechanic: { name: 'Rail Yard Coveralls', shirt: '#3b5a7a', pants: '#3b5a7a', accent: '#d9a441', desc: "Steel-blue rail yard coveralls with brass buttons. Built for night shifts." },
  diner: { name: "Dee's Diner Apron", shirt: '#fafaf8', pants: '#2a2a2e', accent: '#c0392b', desc: "Dee's spare apron over a white tee. Smells faintly of hash browns." },
  webslinger: { name: 'Star City Web-Slinger', shirt: '#b0182a', pants: '#1f3fa8', accent: '#ffd24a', desc: "An original Star City hero suit: red, blue and a lot of attitude." }, // original design
  gold: { name: 'Gold Star Suit', shirt: '#d4a52a', pants: '#3a2a10', accent: '#fff3b0', desc: "Pure gold, head to toe — proof you've truly conquered Star City." },
  // v3: original Star City design (Joe's matthew_beacon.png + anim set) — unlocked by the Beacon Ring
  beacon: { name: 'Star City Beacon', shirt: '#1e8f5a', pants: '#14202e', accent: '#7dffb2', desc: "Emerald glow from the ring hidden under the Mill Mountain Star." },
  // 1.3.2: original heavy-armor design (Joe's matthew_ironclad anim set; key stays `ironclad`) — hidden helmet in the Rail Yards
  ironclad: { name: "Hell's Nightmare", shirt: '#5b6b2e', pants: '#3b4422', accent: '#ffb020', desc: "Bulky olive demon-hunter armor and an amber-visored helmet — the things that go bump in the night check under their beds for him." },
  // 1.5.0 (DLC: Silas prequel reward): unlocked by finishing the free prequel. Fights with Silas Boone's moveset
  // (js/silas_moves.js). Art: Joe's matthew_silas set when installed; until then main.js / outfits_menu.js draw a
  // dark-suit tint over the Skate Fit's plain strips (silas_outfit.js).
  // 1.6.0: unlocked by beating "The Star Goes Dark" (the main campaign). Art: tools/gen_darkstar_outfit.py (matthew_darkstar).
  darkstar: { name: 'Dark Star Suit', shirt: '#161a2c', pants: '#10121c', accent: '#96ace6', desc: "Black and midnight-blue suit with a cracked Mill Mountain star on the chest. It still glows, just barely. Worn by the guy who turned the lights back on." },
  // 1.7.0: unlocked by visiting Silas Boone in cell C-14 at Cinder Hollow. Art: tools/gen_cinder_outfit.py (matthew_cinder).
  cinder: { name: 'Cinder Hollow Orange', shirt: '#de7422', pants: '#de7422', accent: '#303038', desc: "A classic orange jumpsuit, inmate number 0417 stenciled on the chest. A souvenir from visiting hours. Matthew swears it's surprisingly comfy." },
  silas: { name: "Silas's Suit", shirt: '#1f2a3a', pants: '#1a2230', accent: '#a8202a', desc: "A long navy double-breasted coat, crimson tie and black gloves. Polite, pressed, and very hard to say no to." }
};

/** Outfit order for keys 1-9, 0, - (or Shift+1) and = (or Shift+2), L1/R1 (LB/RB) cycling and the pause-menu outfit picker. */
export const OUTFIT_ORDER = ['polo', 'hoodie', 'jacket', 'street', 'photo', 'varsity', 'mechanic', 'diner', 'gold', 'webslinger', 'beacon', 'ironclad', 'silas', 'darkstar', 'cinder'];
/** Hotkey → outfit index for the keys past 1-9 / 0. */
export const OUTFIT_HOTKEYS = { '0': 9, '-': 10, '=': 11, '#': 12, '$': 13, '%': 14 }; // '%' = Shift+5 (Cinder Hollow Orange, 1.7.0) // '$' = Shift+4 (Dark Star Suit, 1.6.0) // '#' = Shift+3 (Silas's Suit, 1.5.0)
