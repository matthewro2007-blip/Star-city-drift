/**
 * JACK-STORY (draft, pending Matthew's approval): Marcus Hale, the River Bridge tender.
 * Main game (2026): unmasked, side missions only. Source: /workspace/samples/scenes/marcus_*.md.
 * The look follows Joe's approved draft (teal twin stripe, left-cheek seam scar). No sheet yet:
 * TODO(Joe): `marcus` NPC art (idle_personality, talk). Until then the procedural NPC body draws in `color`.
 * No imports, so npcs.js / missions.js can include it without a cycle.
 */
export const MARCUS_NPC = {
  id: 'marcus', name: 'Marcus Hale', role: 'River Bridge tender',
  voice: { wave: 'triangle', f0: 132, rate: 0.1, len: 0.08, steps: [1, 0.94, 1.06], vowels: ['o', 'uh', 'a'], fs: 0.9, grit: 0.12, greet: ['o', 'uh'] },
  area: 'river', x: 700, color: '#3aa89a',
  // intro (first talk, after main1): marcus_main_intro.md
  lines: [
    "Bridge closes to foot traffic at two. You've got time.",
    "Crossed east Tuesday, nine-forty, with a bucket of zinnias. Didn't cross back. I write everybody down.",
    "Used to see you cross this bridge with envelopes. Sixteen, I'd guess. You stopped. Good.",
    "Lamps don't light themselves, and neither do people. Come back when you've got a minute. I could use a hand."
  ],
  waitLines: [
    "Evening. Bridge is quiet. Find your friend first, son. The lamps will keep."
  ],
  doneLines: [
    "Somebody's been signaling off this rail again. Green, this time of year.",
    "Some things you lock up and leave in the dark, Matthew. Until it's time."
  ]
};

/** Side missions (existing kinds only: survive / fetch). `noGold`: outside the 100% / Gold Star count (completion unchanged). */
export const MARCUS_SIDE_MISSIONS = {
  side_marcus_lamps: {
    id: 'side_marcus_lamps', type: 'side', kind: 'survive', area: 'river', noGold: true,
    title: 'Lamps Out',
    desc: 'Hold the River Bridge for 40 seconds while Marcus Hale relights the lamps.',
    npc: 'marcus', requires: 'main1', done: false, time: 40,
    reward: { score: 1500 },
    offer: [ // first talk = his intro (marcus_main_intro.md), then the ask
      ...MARCUS_NPC.lines,
      "They want this bridge dark, so Boone trucks can cross without being counted. I've kept it lit near thirty years.",
      "Give me forty seconds. I'll mend the glass, you keep them off the rail."
    ],
    active: ["Forty seconds. Cracks hold better if you fill them. Keep them off me."],
    winLines: 'Every lamp is back. Marcus beads copper wire along a cracked chimney. "Funny how a little light makes men nervous."'
  },
  side_marcus_pages: {
    id: 'side_marcus_pages', type: 'side', kind: 'fetch', area: 'river', noGold: true,
    title: 'Logbook Pages',
    desc: "Collect Marcus's storm-scattered logbook pages from Priya, Hank and Dee.",
    npc: 'marcus', requires: 'side_marcus_lamps', done: false,
    returnTo: 'Marcus', doneLine: "Every page. Thank you, Matthew. A man's memory is only as good as his paper.",
    items: [
      { id: 'page_priya', npc: 'priya', name: 'Logbook Page', line: "A page of times and initials. One says 'S.B.' a lot. Old pages, too. 2015." },
      { id: 'page_hank', npc: 'hank', name: 'Logbook Page', line: 'Bridge log. Same careful hand as the rail yard gate sheets, way back.' },
      { id: 'page_dee', npc: 'dee', name: 'Logbook Page', line: "Coffee ring on it. That's mine, sorry, hon." }
    ],
    reward: { score: 1000 },
    offer: [
      "Storm took my night logbook off the booth. Pages all over town.",
      "Priya, Hank and Dee each picked one up. Would you bring them back? Mind the torn one."
    ],
    active: ['Priya, Hank and Dee. Then back to the bridge.'],
    winLines: "One returned page has a torn line: \"Spring '15, 1:10 a.m.: lady with the green lamp. Bundle: —\". The rest is missing."
  },
  side_marcus_water: {
    id: 'side_marcus_water', type: 'side', kind: 'survive', area: 'river', noGold: true,
    title: 'High Water',
    desc: 'Keep the Foreman\'s crew off Marcus for 35 seconds while he checks the flood gauge at the Blackriver steps.',
    npc: 'marcus', requires: 'side_marcus_pages', done: false, time: 35,
    reward: { score: 2000 },
    offer: [
      "Flood gauge is down the Blackriver steps. My brother kept a boathouse down there.",
      "The Foreman's crew tails me whenever I go. Keep them busy while I read the water."
    ],
    active: ["Thirty-five seconds. Water's coming up fast tonight."],
    winLines: "Marcus taps a cracked iron plate on the Blackriver gate. \"That plate'll come off one day.\" Then he locks the gate behind him."
  }
};
