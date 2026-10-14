/**
 * Streets of Roanoke 1.7.0 "Locked Up": the arrest ending + Cinder Hollow Correctional (story data; main.js runs it).
 * Original content. Teen rating: no gore, no profanity.
 */

/** Honest Roanoke police who make the arrest on Mill Mountain (cutscene actors; art: tools/prison_cast.py). */
export const ARREST_COPS = {
  reyes: { id: 'reyes', name: 'Sgt. Dana Reyes', role: 'Roanoke Police (Internal Affairs)' },
  okafor: { id: 'okafor', name: 'Officer Ben Okafor', role: 'Roanoke Police' }
};

/** Lines spoken during the arrest (speaker objects for the dialogue box). */
export const ARREST_LINES = [
  { id: 'reyes', name: 'Sgt. Dana Reyes', text: "Roanoke Police! Nobody move. Matthew Rose? Stay where you are, son. You've done enough for one night." },
  { id: 'reyes', name: 'Sgt. Dana Reyes', text: "Silas Boone, you're under arrest for kidnapping, arson, extortion and bribing officers of this city. The ones on your payroll are already in the back of a van." },
  { id: 'okafor', name: 'Officer Ben Okafor', text: "Hands behind your back, Mr. Boone. Slowly." },
  { id: 'silas', name: 'Silas Boone', text: "No need for the bracelets, officer. I always walk out on my own two feet." },
  { id: 'okafor', name: 'Officer Ben Okafor', text: "Not tonight you don't." },
  { id: 'reyes', name: 'Sgt. Dana Reyes', text: "Hank Pettigrew's notes. Priya's list. Cam's pins. Tessa's video. Every name you buried, Boone. This city kept the receipts." },
  { id: 'silas', name: 'Silas Boone', text: "Matthew. Enjoy the light while it lasts." },
  { id: 'reyes', name: 'Sgt. Dana Reyes', text: "Take him down the mountain, Ben. And somebody get Miss Calloway a blanket." }
];

/** Cards after the arrest (court, then prison), shown before the ending screen. */
export const SENTENCING_CARD = {
  eyebrow: 'Roanoke Circuit Court · Three months later',
  title: 'Sentenced',
  name: 'The People v. Silas Boone',
  sub: "Guilty on every count. Hank, Priya, Cam and Wren testified. Dora Keene, Boone Holdings' own bookkeeper, opened the Foreman's ledger for the jury. Silas Boone: twenty-five years. Boone Holdings: dissolved. The debts: cancelled."
};
export const PRISON_CARD = {
  eyebrow: 'Route 9 · Cinder Hollow',
  title: 'Locked Up',
  name: 'Cinder Hollow Correctional Facility',
  sub: "Inmate C-14 arrives on a gray morning, still standing very straight. Visiting hours are open now. Take the Route 9 bus from the Community Center."
};

/** 1.7.0: visiting hours open once the campaign is beaten (old saves with mainComplete get it automatically). */
export function prisonOpen(stateBag) { return !!(stateBag && (stateBag.mainComplete || stateBag.storyBeaten)); } // NG+: stays open across cycles

/** Interactable spots (the main game's "use" points). Returns the first spot within reach or null. */
export const PRISON_SPOTS = [
  { id: 'bus_out', area: 'community', x: 820, label: 'Ride the Route 9 bus to Cinder Hollow', when: (sb) => prisonOpen(sb) },
  { id: 'bus_home', area: 'pr_lobby', x: 110, label: 'Take the Route 9 bus back to Roanoke', when: (sb) => prisonOpen(sb) },
  { id: 'keepsake', area: 'pr_library', x: 930, label: 'Look through the return cart', when: (sb) => prisonOpen(sb) && !sb.prisonKeepsake }
];
export function prisonSpot(stateBag, areaId, x) {
  for (const s of PRISON_SPOTS) if (s.area === areaId && Math.abs(s.x - x) < 48 && s.when(stateBag)) return s;
  return null;
}

export const KEEPSAKE = {
  name: 'The Evening Paper (last spring)',
  text: "A Roanoke evening paper from last spring, folded soft. Page 3: 'SECOND-SHIFT STRANGER RUNS OFF RENT COLLECTORS AT JEFFERSON NEWSSTAND.' A man in a pressed navy coat stands beside newsstand owner Lou Badger. The caption calls him a good neighbor. His name is Silas Boone.",
  score: 1000
};

/**
 * Silas in cell C-14: a branching talk. Nodes: { lines: [text...], choices: [{ label, to, when? }] }.
 * 'end' closes the talk. `when(ctx)` hides a choice (ctx = { keepsake, visited }).
 */
export const SILAS_TREE = {
  start: {
    lines: [
      "Matthew Rose. Visiting hours. How thoughtful. Forgive the decor; the previous tenant had no taste either.",
      "They gave me the blues, a cot and a window that looks at a wall. I've had worse offices."
    ],
    choices: [
      { label: 'Why did you do it?', to: 'why' },
      { label: 'Where is Vera Lisk?', to: 'vera' },
      { label: 'Do you regret any of it?', to: 'regret' },
      { label: 'I found an old newspaper in the library.', to: 'paper', when: (c) => c.keepsake },
      { label: 'Goodbye, Silas.', to: 'bye' }
    ]
  },
  why: {
    lines: [
      "Why. Everyone asks why, as if the answer would fit on a postcard.",
      "Last spring I worked second shift in this city. I watched good people get pushed around by men who simply wanted more. I decided I would never be the one pushed.",
      "So I learned the rules: everyone owes someone. I just made sure, sooner or later, they all owed me."
    ],
    choices: [
      { label: 'Wren never owed you anything real.', to: 'wren' },
      { label: 'Ask something else.', to: 'start_short' }
    ]
  },
  wren: {
    lines: [
      "No. She owed three loan sharks forty dollars apiece and she still gave flowers away for free.",
      "I took her because you cared about her, Matthew. That was the mistake. People who care are very hard to buy.",
      "Tell her... no. Tell her nothing. She's earned a quiet life."
    ],
    choices: [{ label: 'Ask something else.', to: 'start_short' }, { label: 'Goodbye, Silas.', to: 'bye' }]
  },
  vera: {
    lines: [
      "Vera. Ah. The police turned the city upside down and found three empty filing cabinets and a very nice umbrella.",
      "Vera Lisk never needed me, Matthew. She needed my secrets. I suspect she still has them.",
      "If you see her, give her my regards. Then check your pockets."
    ],
    choices: [{ label: 'Ask something else.', to: 'start_short' }, { label: 'Goodbye, Silas.', to: 'bye' }]
  },
  regret: {
    lines: [
      "Regret is a luxury for people with free time. I appear to have twenty-five years of it.",
      "Do I regret the Star? No. For one minute the whole city looked up and thought of me.",
      "Do I regret losing to a young man in a white polo? ...Ask me again in a few years."
    ],
    choices: [{ label: 'Ask something else.', to: 'start_short' }, { label: 'Goodbye, Silas.', to: 'bye' }]
  },
  paper: {
    lines: [
      "Where did you... Lou Badger's newsstand. Jefferson Street. Last spring.",
      "The Foreman's boys came to collect 'rent' for Lou's corner. I had a polite word with them. The paper called me a good neighbor.",
      "Lou said folks would pay me to keep them safe. That was the night I started counting. I kept that clipping in my coat all year, Matthew. Somewhere along the way I forgot why.",
      "Keep it. Some stories are better told by someone else."
    ],
    choices: [{ label: 'Ask something else.', to: 'start_short' }, { label: 'Goodbye, Silas.', to: 'bye' }]
  },
  start_short: {
    lines: ["What else, Matthew? I'm not going anywhere."],
    choices: null // filled from start.choices at runtime
  },
  bye: {
    lines: [
      "Goodbye, Matthew Rose. Mind the rain on your way out.",
      "And Matthew? The lights always come back on. Remember who turned them off."
    ],
    choices: null,
    end: true
  }
};
/** Resolve a node's visible choices for this visit. */
export function silasChoices(node, ctx) {
  const list = node.choices || (node === SILAS_TREE.start_short ? SILAS_TREE.start.choices : null);
  if (!list) return null;
  return list.filter((c) => !c.when || c.when(ctx));
}
