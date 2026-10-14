/** Original fictional cast — preserved from 3D build. */
export const NPC_DEFS = [
  {
    id: 'dee', name: 'Dee Morales', role: 'Diner cook',
    // audio: talk-blip voice (waveform, pitch, cadence) + greeting, used by js/audio.js
    voice: { wave: 'triangle', f0: 255, rate: 0.075, len: 0.06, steps: [1, 1.12, 1.26, 1.5], vowels: ['a', 'o', 'e'], fs: 1.12, greet: ['e', 'o'] },
    area: 'diner', x: 320, color: '#d35400',
    lines: [
      "Matthew. Sit down, hon. Wren never came back from closing her cart last night.",
      "I called the police. They say she's a runaway. Wren? She'd never leave her flowers.",
      "She owed money to Boone Holdings, same as half this street. Priya at Valley Pages keeps a list. Go see her."
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
      "You're Matthew? Dee texted. Close the door. Here's my list: eleven people gone since spring.",
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
      "Boone trucks roll through here every night, and two patrol cars wave them on. Cops on his payroll, kid.",
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
      "Matthew! Need a courier who can hustle. Medicine for the folks camped by the River Bridge.",
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
    lines: ["Matthew! Fresh zinnias, two for five. Boone's men came by my cart again. Walk with me after close?"],
    doneLines: ["Purse is back, petals are fine. You came up that mountain for me. You're a good egg, Matthew."]
  },
  {
    id: 'silas', name: 'Silas Boone', role: 'Boone Holdings',
    // audio: talk-blip voice (waveform, pitch, cadence) + greeting, used by js/audio.js
    voice: { wave: 'sawtooth', f0: 118, rate: 0.105, len: 0.08, steps: [1, 0.89, 1.06], vowels: ['o', 'e', 'uh'], fs: 0.92, slide: 0.95, greet: ['e', 'o'], greetFall: true },
    area: 'star', x: 300, color: '#2c3e50', // 1.6.0: the finale is on Mill Mountain
    lines: [
      "Matthew Rose. You climbed a mountain in the rain to watch my city go dark.",
      "Every block that owed me, I collected. Wren owed a little more. She's in the switch house. Quite safe, for now.",
      "At midnight the Star goes out. When it comes back on, Roanoke answers to Boone Holdings. Walk away, or stand in the dark with her."
    ],
    waitLines: [
      "Matthew Rose. Lovely rain. Go home. We'll talk properly once you've done a little more homework."
    ],
    doneLines: [
      "The lights always come back on, Matthew. So do I."
    ]
  }
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
  silas: { name: "Silas's Suit", shirt: '#1f2a3a', pants: '#1a2230', accent: '#a8202a', desc: "A long navy double-breasted coat, crimson tie and black gloves. Polite, pressed, and very hard to say no to." }
};

/** Outfit order for keys 1-9, 0, - (or Shift+1) and = (or Shift+2), L1/R1 (LB/RB) cycling and the pause-menu outfit picker. */
export const OUTFIT_ORDER = ['polo', 'hoodie', 'jacket', 'street', 'photo', 'varsity', 'mechanic', 'diner', 'gold', 'webslinger', 'beacon', 'ironclad', 'silas', 'darkstar'];
/** Hotkey → outfit index for the keys past 1-9 / 0. */
export const OUTFIT_HOTKEYS = { '0': 9, '-': 10, '=': 11, '#': 12, '$': 13 }; // '$' = Shift+4 (Dark Star Suit, 1.6.0) // '#' = Shift+3 (Silas's Suit, 1.5.0)
