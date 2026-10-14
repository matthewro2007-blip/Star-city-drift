import { sfx } from './audio.js'; // audio: mission start / complete, pickups, outfit unlocks
/** Mission + collectible system — preserved from 3D Star City Drift. */
export function createMissionSystem(state) {
  const missions = {
    main1: {
      id: 'main1', type: 'main',
      title: 'Gone Quiet',
      desc: "Ask Dee Morales at Dee's Diner about Wren.",
      npc: 'dee', done: false
    },
    main2: {
      id: 'main2', type: 'main',
      title: 'The Missing List',
      desc: 'Ask Priya Shah at Valley Pages who else has vanished.',
      npc: 'priya', requires: 'main1', done: false
    },
    main3: {
      id: 'main3', type: 'main',
      title: 'Badges in the Rail Yards',
      desc: 'Find Hank "Rail" Pettigrew at the rail yards and learn who the patrol cars protect.',
      npc: 'hank', requires: 'main2', done: false
    },
    main4: {
      id: 'main4', type: 'main',
      title: 'The Star Goes Dark',
      desc: 'Climb Mill Mountain before midnight. Stop Silas Boone and bring Wren home.',
      npc: 'silas', requires: 'main3', done: false
    },
    side_june: {
      id: 'side_june', type: 'side',
      title: 'Soft Landing',
      desc: 'Help June Whitaker shelter burned-out families at the Community Center.',
      npc: 'june', done: false
    },
    side_tessa: {
      id: 'side_tessa', type: 'side',
      title: 'Street Rumors',
      desc: 'Hit up Tessa Quinn at Starboard Skate for street rumors and gear tips.',
      npc: 'tessa', done: false
    },
    side_coach: {
      id: 'side_coach', type: 'side',
      title: 'Hustle Delivery',
      desc: 'Carry medicine for Coach Ray Delgado from Valley Gym.',
      npc: 'coach', done: false,
      deliver: { area: 'river', name: 'River Bridge' }
    },
    side_cam: {
      id: 'side_cam', type: 'side',
      title: 'Wrong Pin',
      desc: 'Talk to Cam Ortiz, the rideshare driver Vera Lisk keeps sending to the wrong pins.',
      npc: 'cam', done: false
    },
    // ---------- v2 side missions (kind = objective type, handled in main.js) ----------
    side_diner: {
      id: 'side_diner', type: 'side', kind: 'defend', area: 'diner',
      title: 'Lunch Rush Defense',
      desc: "Defend Dee's Diner from 3 waves of the Foreman's crew.",
      npc: 'dee', requires: 'main1', done: false, waves: 3,
      reward: { score: 1500, reveal: 'apron' },
      offer: [
        "Matthew, before you head to Priya's: trouble. The Foreman's crew burned the hardware store last week. Tonight they're coming for my diner.",
        "They've got gas cans and a 'final notice' from Boone Holdings. Keep them off my door for three rounds and the apron's yours."
      ],
      active: ["Keep 'em off my door! Hit the ones with the cans first!"],
      winLines: "The diner's still standing. Grab my spare apron off the hook by the door. You earned it."
    },
    side_snatch: {
      id: 'side_snatch', type: 'side', kind: 'chase', area: 'downtown',
      title: 'Petal Pusher',
      desc: 'Catch the Boone runner who grabbed Wren\'s purse before he gets past Valley Pages.',
      npc: 'wren', done: false, time: 45,
      reward: { score: 1200 },
      offer: [
        "Hey! HEY! That guy in the orange just grabbed my purse off the flower cart! My Boone Holdings receipts are in there!",
        "He's heading east toward the diner. He gets winded every few seconds. Catch him and land one hit!"
      ],
      active: ['He went that way — east! Go go go!'],
      winLines: 'Wren gets her purse back. A zinnia tucked in your pocket, free of charge.'
    },
    side_skate: {
      id: 'side_skate', type: 'side', kind: 'survive', area: 'skate',
      title: 'Kickflip Gauntlet',
      desc: 'Survive the waves at Starboard Skate until the timer runs out.',
      npc: 'tessa', requires: 'side_tessa', done: false, time: 40,
      reward: { score: 1500 },
      offer: [
        "Okay so. I posted a video of Boone's guys hanging around the shop. It got a LOT of views.",
        "Now a whole crew's rolling up in the rain. Hold the bowl for forty seconds and they'll back off. Probably."
      ],
      active: ['Just stay standing! Forty seconds! You got this!'],
      winLines: "They bailed! Tessa's video gets shared all over town. People are starting to talk about Boone."
    },
    side_potluck: {
      id: 'side_potluck', type: 'side', kind: 'fetch', area: 'community',
      title: 'Potluck Run',
      desc: "Collect Dee's peach pie, Priya's large-print books and Tessa's string lights for June.",
      npc: 'june', requires: 'side_june', done: false,
      items: [
        { id: 'pie', npc: 'dee', name: 'Peach Pie', line: "One peach pie for June. Hold it level, Matthew — LEVEL." },
        { id: 'books', npc: 'priya', name: 'Large-Print Books', line: 'A box of large-print mysteries for the reading corner. Tell June the third one has a twist.' },
        { id: 'lights', npc: 'tessa', name: 'String Lights', line: 'String lights! I only tangled them a little. Okay, a lot.' }
      ],
      reward: { score: 1000 },
      offer: [
        "Matthew! Families who lost their shops to the fires are sleeping here tonight, and I am three things short.",
        "Dee promised a pie, Priya's lending books for the kids, and Tessa has string lights so it isn't so dark. Could you fetch them?"
      ],
      active: ["Pie from Dee, books from Priya, lights from Tessa. Then back to me, hon."],
      winLines: 'June hangs the lights. For one hour, the shelter feels like a home. She saves you the corner piece.'
    },
    side_spar: {
      id: 'side_spar', type: 'side', kind: 'spar', area: 'gym',
      title: 'Sparring Rounds',
      desc: 'KO 6 sparring partners at Valley Gym without taking too many hits.',
      npc: 'coach', requires: 'side_coach', done: false, target: 6,
      reward: { score: 1500, reveal: 'varsity' },
      offer: [
        "Delivery was quick. But can you take a punch? Better question — can you NOT take one?",
        "Six sparring partners, light gloves. Get tagged too many times and we start over. Win, and the old varsity jacket's yours."
      ],
      active: ['Hands up! Move your feet! Don\'t get tagged!'],
      winLines: "That's footwork! The varsity jacket's hanging by the ropes — take it."
    },
    side_night: {
      id: 'side_night', type: 'side', kind: 'escort', area: 'rails',
      title: 'Night Shift',
      desc: 'Escort Hank from the Rail Yards to the River Bridge and keep him safe.',
      npc: 'hank', requires: 'main3', done: false, dest: 'river',
      reward: { score: 2000, reveal: 'lantern' },
      offer: [
        "I'm telling the state inspector about those patrol cars. He's waiting at the River Bridge, away from local badges.",
        "These knees don't move fast, and Boone's people know my face. Walk me down to the bridge and keep them off me."
      ],
      active: ["Easy, kid. Bridge is past the yards, to the right. I'm right behind you."],
      winLines: "Hank hands over his notes, then finds an old lantern stenciled 'S.B. — 2nd shift'. \"Boone's been at this a long time,\" he says."
    }
  };

  const collectibles = [
    { id: 'glasses', name: 'Glasses', area: 'downtown', x: 420, outfit: null, score: 100 },
    { id: 'bottle', name: 'Water Bottle', area: 'diner', x: 600, outfit: null, score: 100 }, // clear of Dee (x 320)
    { id: 'hoodie', name: 'Star City Hoodie', area: 'star', x: 500, outfit: 'hoodie' },
    { id: 'jacket', name: 'Rail Yard Jacket', area: 'rails', x: 620, outfit: 'jacket' },
    { id: 'street', name: 'Skate Fit', area: 'skate', x: 640, outfit: 'street' }, // clear of Tessa (x 340)
    { id: 'notebook', name: 'Notebook', area: 'pages', x: 200, outfit: null, score: 100 },
    { id: 'photo', name: 'Classroom Photo', area: 'community', x: 660, outfit: 'photo' }, // clear of June (x 300)
    // v2 — several tucked at area edges (edge transitions fire at x<=35 / x>=width-35)
    { id: 'flyer', name: 'Bake-Sale Flyer', area: 'community', x: 70, outfit: null, score: 250 },
    { id: 'token', name: 'Old Trolley Token', area: 'downtown', x: 70, outfit: null, score: 250 },
    { id: 'bookmark', name: 'Valley Pages Bookmark', area: 'pages', x: 930, outfit: null, score: 250 },
    { id: 'wax', name: 'Starboard Board Wax', area: 'skate', x: 70, outfit: null, score: 250 },
    { id: 'webmask', name: 'Web-Slinger Mask (top of the half-pipe)', area: 'skate', x: 500, outfit: 'webslinger' },
    { id: 'coveralls', name: 'Rail Yard Coveralls', area: 'rails', x: 1240, outfit: 'mechanic' },
    { id: 'ticket', name: 'Excursion Train Ticket Stub', area: 'river', x: 1030, outfit: null, score: 250 },
    { id: 'pin', name: 'Mill Mountain Star Pin', area: 'star', x: 940, outfit: null, score: 400 },
    // mission rewards: hidden (area 'hidden:<area>') until the linked mission completes
    { id: 'apron', name: "Dee's Spare Apron", area: 'diner', x: 1180, outfit: 'diner', reveal: 'side_diner' },
    { id: 'varsity', name: 'Valley Gym Varsity Jacket', area: 'gym', x: 800, outfit: 'varsity', reveal: 'side_spar' },
    { id: 'lantern', name: 'Night Shift Lantern', area: 'river', x: 300, outfit: null, score: 500, reveal: 'side_night' },
    // v3: glows at the foot of the Mill Mountain Star once main mission 2 (Missing Shipment) is done
    { id: 'beaconring', name: 'Beacon Ring (under the Mill Mountain Star)', area: 'star', x: 720, outfit: 'beacon', reveal: 'main2' },
    // 1.3.2: Hell's Nightmare helmet (outfit `ironclad`), hidden by the last boxcar at the far end of the Rail Yards.
    // `stealth`: drawn faint with no label until Matthew is close (main.js); once spotted it stays visible (save v4 `spotted`).
    { id: 'ironcrate', name: "Hell's Nightmare Helmet", area: 'rails', x: 1070, outfit: 'ironclad', stealth: true,
      hint: "Unlock: a helmet is hidden somewhere in the Rail Yards. Look along the last boxcar at the far end of the yard." }
  ];

  state.missions = missions;
  state.collectibles = collectibles.map((c) => ({ ...c, home: c.area, area: c.reveal ? 'hidden:' + c.area : c.area, taken: false }));
  state.side = null;          // in-progress v2 side mission runtime ({ id, ... })
  state.fetchItems = [];      // Potluck Run items picked up so far (saved)
  state.beatHard = false;     // beat Silas on Hard / Arcade (unlocks Gold)
  state.unlockedOutfits = new Set(['polo']);
  state.activeMissionId = 'main1';
  state.mainComplete = false;
  state.deliveryActive = false;
  state.deliveryTarget = null;

  // NOTE: methods below always go through state.missions / state.collectibles so a
  // New Game (which rebuilds the state bag) can never leave them pointing at stale objects.

  return {
    /** Current main-story mission, or null once the story is finished. */
    getActive() {
      if (state.activeMissionId == null) return null;
      return state.missions[state.activeMissionId] || null;
    },
    /** Mission this NPC can progress right now (not done, prerequisites met), or null. */
    missionFor(npcId) {
      return Object.values(state.missions).find(
        (x) => x.npc === npcId && !x.done && (!x.requires || state.missions[x.requires].done)
      ) || null;
    },
    /** 'available' | 'active' (accepted, in progress) | 'locked' | 'done' | 'none' for an NPC. */
    npcStatus(npcId) {
      const linked = Object.values(state.missions).filter((x) => x.npc === npcId);
      if (!linked.length) return 'none';
      const m = this.missionFor(npcId);
      if (m) return ((m.id === 'side_coach' && state.deliveryActive) || (state.side && state.side.id === m.id)) ? 'active' : 'available';
      return linked.every((x) => x.done) ? 'done' : 'locked';
    },
    /** Coach's job: accepting it starts the delivery; it completes on arrival at the target. */
    startDelivery(toast, onUpdate) {
      const m = state.missions.side_coach;
      if (m.done || state.deliveryActive) return false;
      state.deliveryActive = true;
      state.deliveryTarget = m.deliver;
      sfx('mission_start');
      toast(`Job accepted: deliver the package to the ${m.deliver.name}`);
      onUpdate && onUpdate();
      return true;
    },
    /** Unhide mission-reward collectibles whose mission is done. */
    refreshReveals() {
      for (const c of state.collectibles) {
        if (c.reveal) c.area = state.missions[c.reveal]?.done ? c.home : 'hidden:' + c.home;
      }
    },
    /** 'done' | 'active' | 'available' | 'locked' for the pause-menu mission list. */
    missionStatus(id) {
      const m = state.missions[id];
      if (!m) return 'locked';
      if (m.done) return 'done';
      if (m.requires && !state.missions[m.requires].done) return 'locked';
      if ((state.side && state.side.id === id) || (id === 'side_coach' && state.deliveryActive) ||
          (m.type === 'main' && state.activeMissionId === id)) return 'active';
      return 'available';
    },
    allDone() {
      return Object.values(state.missions).every((m) => m.done) && state.collectibles.every((c) => c.taken);
    },
    completeMission(id, toast, onUpdate) {
      const m = state.missions[id];
      if (!m || m.done) return;
      m.done = true;
      sfx('mission_complete');
      toast(`Mission complete: ${m.title}`);
      if (state.side && state.side.id === id) state.side = null;
      if (m.reward?.reveal) {
        this.refreshReveals();
        const c = state.collectibles.find((k) => k.id === m.reward.reveal);
        if (c) toast(`Reward: ${c.name} is waiting nearby`);
      }
      // collectibles unlocked by this mission without a reward entry (main2 → Beacon Ring)
      for (const c of state.collectibles) {
        if (c.reveal === id && !c.taken && c.id !== m.reward?.reveal) {
          this.refreshReveals();
          toast('Something is glowing up at the Mill Mountain Star…');
        }
      }
      if (id === 'main1') state.activeMissionId = 'main2';
      else if (id === 'main2') state.activeMissionId = 'main3';
      else if (id === 'main3') state.activeMissionId = 'main4';
      else if (id === 'main4') {
        state.mainComplete = true;
        state.activeMissionId = null;
      } else if (id === 'side_coach') {
        state.deliveryActive = false;
        state.deliveryTarget = null;
      }
      onUpdate && onUpdate();
    },
    tryCollect(areaId, x, toast, onUpdate) {
      for (const c of state.collectibles) {
        if (c.taken || c.area !== areaId) continue;
        if (Math.abs(c.x - x) < 40) {
          c.taken = true;
          sfx(c.outfit ? 'unlock' : 'pickup'); // audio: outfit unlocks get the bigger fanfare
          const n = state.collectibles.filter((k) => k.taken).length;
          if (c.outfit) {
            state.unlockedOutfits.add(c.outfit);
            toast(`Collected ${c.name} — outfit unlocked! (${n}/${state.collectibles.length})`);
          } else {
            toast(`Collected: ${c.name} (${n}/${state.collectibles.length})`);
          }
          onUpdate && onUpdate();
          return c;
        }
      }
      return null;
    },
    checkDelivery(areaId, toast, onUpdate) {
      if (!state.deliveryActive || !state.deliveryTarget) return false;
      if (areaId === state.deliveryTarget.area) {
        toast(`Package delivered to the ${state.deliveryTarget.name}. Nice hustle.`);
        this.completeMission('side_coach', toast, onUpdate);
        return true;
      }
      return false;
    },
    collectCount() {
      return state.collectibles.filter((c) => c.taken).length;
    },
    collectTotal() {
      return state.collectibles.length;
    },
    shouldShowEnding() {
      return state.mainComplete;
    }
  };
}

/** 1.6.0: opening card for a new campaign. */
export const STORY_INTRO = `THE STAR GOES DARK
Roanoke, the night before the city's anniversary. It has rained for six days.
Wren Calloway closed her flower cart on Jefferson Street last night and never came home. The police call her a runaway.
Matthew Rose doesn't believe them.`;

export const SEQUEL_HOOKS = `
<strong>Hank "Rail" Pettigrew:</strong> The state inspector has his notes. The night shift at the yards is clean for the first time in years.<br><br>
<strong>Cam Ortiz:</strong> No more wrong pins. But Vera Lisk's files were never found.<br><br>
<strong>Silas Boone:</strong> Led down the mountain in handcuffs by officers who still answer to the city. He said they'd speak again.
`;

export const ENDING_TEXT = `Midnight on Mill Mountain. The Star went dark, and for one long minute so did Roanoke.
Matthew Rose put Silas Boone on the ground, broke the switch-house lock and walked Wren Calloway out into the rain. When he threw the breaker, the Star came back on.
He's okay. Wren's okay. Boone Holdings is finished, and the missing are coming home one by one. Star City glows again.`;
