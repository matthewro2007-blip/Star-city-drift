/**
 * 2.1.0 co-op script track (from /workspace/samples/coop/coop_story.md §3–5).
 * Rule: every scene keeps its solo version. A co-op line is used when one exists, the solo line otherwise.
 * Lines are { id, name, text } speaker objects (main.js showLine already supports them).
 */
const M = (text) => ({ id: 'matthew', name: 'Matthew Rose', text });
const Wl = (text) => ({ id: 'william', name: 'William Burks', text });
const N = (id, name) => (text) => ({ id, name, text });
const DEE = N('dee', 'Dee Morales'), PRIYA = N('priya', 'Priya Shah'), HANK = N('hank', 'Hank "Rail" Pettigrew'), SILAS = N('silas', 'Silas Boone');
const COACH = N('coach', 'Coach Ray Delgado'), JUNE = N('june', 'June Whitaker'), TESSA = N('tessa', 'Tessa Quinn'), CAM = N('cam', 'Cam Ortiz'), WREN = N('wren', 'Wren Calloway');

/** Main story scenes: replace the solo `lines` of that NPC while its mission is the one being told. */
export const COOP_STORY = {
  dee: [
    DEE("Well, look at that. Both of you in my door at once, like it's 2010. Sit down, boys. Your booth."),
    Wl('Dee, the booth still wobbles.'),
    DEE('It wobbles because you carved your names in the leg. Wren never came back from closing her cart last night.'),
    M('The police?'),
    DEE("Say she's a runaway."),
    Wl("Wren sold us dandelions for a quarter when we were eight. She doesn't run from anything."),
    DEE('She owed Boone Holdings. Same as half this street. Priya keeps a list. Go. Both of you. And William, you let him do the talking.')
  ],
  priya: [
    PRIYA('Matthew. And William Burks, who still owes me for a comic from 2011.'),
    Wl('It was a really good comic.'),
    PRIYA('Eleven people gone since spring. All Boone debtors. Fires, "accidents"...'),
    M("Will. That's the Kowalski bakery on this list."),
    Wl('...We used to get the day-old rolls there.'),
    PRIYA("The Foreman's crew burned it in May. Split up if you have to, but don't do anything stupid alone."),
    Wl("Then we'll do it stupid together.")
  ],
  hank: [
    HANK('Two of you this time. Good. Eleven years these patrol cars have waved Boone trucks through, kids.'),
    Wl("Kids. I'm twenty-seven, Hank."),
    HANK("And I've got boots older than both of you. Listen. Boone's going to black out the Star. And I saw a girl with flowers on her coat in the back of that truck."),
    M('Wren.'),
    Wl('(quiet) Okay. Okay. No jokes now.')
  ],
  silas: [
    SILAS("Matthew Rose. And the friend. You were the boy who waited outside Lou's newsstand, weren't you? Always waiting."),
    Wl("Funny. I don't remember you."),
    SILAS("No one remembers the man holding the umbrella. Did he ever tell you, William? Spring 2015. He ran my envelopes. One of them was Rosa Calloway's loan. Wren's mother."),
    Wl("...That's why you quit all at once that summer."),
    M("I was sixteen. I gave the money back. I should've told you."),
    Wl("Yeah, you should've. We'll talk about it after. Player One, left side."),
    M('Left side.'),
    SILAS('At midnight the Star goes out. Walk away, or both of you can stand in the dark with her.')
  ]
};

/** NPC reactions (any time after their story beat, in co-op only). */
export const COOP_REACTIONS = {
  dee: [DEE('One slice, two forks, like always. Eat, boys.')],
  coach: [COACH('Burks! Still dropping your left?'), Wl('Only when you watch, Coach.')],
  tessa: [TESSA('Duo content. This is going to do numbers.')],
  june: [JUNE('Two of you? Then two thermoses. Stay warm out there.')],
  cam: [CAM('Two of you? Vera only planned for one.')],
  wren: [WREN('Dee says you two carved this table.'), Wl('Allegedly.'), WREN('William, you watered them? You hate plants.')]
};

/** Enemy barks for a fresh wave when two players are in. */
export const COOP_BARKS = ["There's two of 'em!", 'Take the flannel one!', 'Split up, split up!'];

/** Pick the co-op variant of a conversation. `solo` is what linesFor() returned. */
export function coopLinesFor(npc, solo, { missions, stateBag }) {
  if (!npc || !Array.isArray(solo)) return solo;
  const story = COOP_STORY[npc.id];
  if (story && solo === npc.lines) {
    const m = missions.missionFor(npc.id);
    if (m && !m.done) return story;
  }
  const react = COOP_REACTIONS[npc.id];
  if (react && (solo === npc.doneLines || (npc.id !== 'dee' && solo === npc.lines && !COOP_STORY[npc.id])) && (npc.id !== 'wren' || stateBag.mainComplete)) {
    return [...react, ...solo.slice(0, 1)];
  }
  return solo;
}

// ---------------------------------------------------------------- 2.1.0 co-op side quests (W1–W4) and beats
const OKAFOR = N('okafor', 'Officer Okafor');
/** William's quests in co-op: William is Player 2, so his offer becomes two-way banter between the two players. */
export const COOP_SIDE_OFFERS = {
  side_william_booth: [
    Wl("Matty. Dee's window. Two of the Foreman's guys keep 'checking on' her. Gas can, clipboard, the whole act."),
    M("Tonight?"),
    Wl("Tonight. Our booth's right behind that glass. M.R. plus W.B., carved in the leg."),
    M("Then we hold the window. Two rounds."),
    Wl("Same as dodgeball in sixth grade. You throw, I yell. Except this time I'm also throwing.")
  ],
  side_william_score: [
    Wl("The Starlite owes Boone. They're repossessing Star Raiders tomorrow. Our cabinet, Matty. Nine hundred twelve thousand."),
    M("Priya said she'd keep it at Valley Pages?"),
    Wl("I push the dolly, you keep the repo crew off me. If they hit me, they hit the CRT."),
    M("So don't get hit."),
    Wl("Great plan. Love it. Let's go.")
  ],
  side_william_flowers: [
    Wl("Somebody's gotta water these. She'd kill us both if they died."),
    M("Can from Dee, tarp from Tessa, twine from June."),
    Wl("Split it. You take one side of town, I take the other. Whoever's last buys pie.")
  ],
  side_william_rematch: [
    Wl("Fifteen years since you dropped me in Coach's corner. I said best of three. I'm saying it again."),
    COACH("Light gloves, points only. First to five clean hits. No knockouts in my gym."),
    M("You sure about this, Will?"),
    Wl("Hands up, Player One. Coach is watching.")
  ]
};
export const COOP_SIDE_DONE = {
  side_william_flowers: [Wl("Can, tarp, twine. Look at us. Two grown men running a flower cart. She's gonna laugh so hard.")],
  side_william_rematch_p1: [COACH("Five to the kid in the white shirt. Burks, you dropped your left. Again."), Wl("Best of seven?")],
  side_william_rematch_p2: [COACH("Five! Burks takes it! Fifteen years, son. I'll put it on the wall."), Wl("Rematch record: one and one, Matty.")]
};
/** main3 co-op stealth split (Rail Yards): one distracts the patrol cars at the gate, the other reaches Hank's records; then swap for the escape. */
export const COOP_STEALTH = {
  start: [HANK("Patrol cars at the gate, records in the yard office at the far end. One of you makes noise at the gate. The other one reads."), Wl("I'll be the noise. I'm great at noise.")],
  swap: [HANK("Got the ledger? Good. Now swap. Whoever read slips back out the gate, the noisy one covers the office."), M("Your turn to be quiet, Will.")],
  done: [Wl("Nobody saw a thing. Mostly because I was doing a very loud cartwheel."), HANK("Plates on the ledger match Boone's trucks. Now you've got proof.")],
  spotted: "Patrol spotted you! Somebody has to hold the gate."
};
export const COOP_FINISHER = {
  ready: 'Silas is staggering — DOUBLE-TEAM him: both hit within 1 second!',
  blocked: "He shrugs off a lone hit. Hit him together!",
  done: [OKAFOR('Which one of you threw the breaker?'), M('He did.'), Wl('He did.')]
};
/** Every co-op line that has a voice (tools/gen_coop_vo_210.py reads this list). */
export function allVoicedCoopLines() {
  const out = [];
  const add = (scene, arr) => arr.forEach((l, i) => l && l.text && out.push({ scene, idx: i + 1, speaker: l.id, text: l.text }));
  for (const [k, v] of Object.entries(COOP_STORY)) add('coop.story.' + k, v);
  for (const [k, v] of Object.entries(COOP_REACTIONS)) add('coop.react.' + k, v);
  for (const [k, v] of Object.entries(COOP_SIDE_OFFERS)) add('coop.offer.' + k, v);
  for (const [k, v] of Object.entries(COOP_SIDE_DONE)) add('coop.done.' + k, v);
  for (const k of ['start', 'swap', 'done']) add('coop.stealth.' + k, COOP_STEALTH[k]);
  add('coop.finisher', COOP_FINISHER.done);
  return out;
}
