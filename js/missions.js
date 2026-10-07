/** Mission + collectible system — preserved from 3D Star City Drift. */
export function createMissionSystem(state) {
  const missions = {
    main1: {
      id: 'main1', type: 'main',
      title: 'Wrong Bag of Leftovers',
      desc: "Talk to Dee Morales at Dee's Diner.",
      npc: 'dee', done: false
    },
    main2: {
      id: 'main2', type: 'main',
      title: 'Missing Shipment',
      desc: 'Ask Priya Shah at Valley Pages about the maps.',
      npc: 'priya', requires: 'main1', done: false
    },
    main3: {
      id: 'main3', type: 'main',
      title: 'Rail Yard Lead',
      desc: 'Find Hank "Rail" Pettigrew at the rail yards.',
      npc: 'hank', requires: 'main2', done: false
    },
    main4: {
      id: 'main4', type: 'main',
      title: 'Polite Pressure',
      desc: 'Confront Silas Boone downtown — then walk away.',
      npc: 'silas', requires: 'main3', done: false
    },
    side_june: {
      id: 'side_june', type: 'side',
      title: 'Soft Landing',
      desc: 'Help June Whitaker at the Community Center.',
      npc: 'june', done: false
    },
    side_tessa: {
      id: 'side_tessa', type: 'side',
      title: 'Street Rumors',
      desc: 'Hit up Tessa Quinn at Starboard Skate for collectible tips.',
      npc: 'tessa', done: false
    },
    side_coach: {
      id: 'side_coach', type: 'side',
      title: 'Hustle Delivery',
      desc: 'Take a delivery job from Coach Ray Delgado at Valley Gym.',
      npc: 'coach', done: false,
      deliver: { area: 'river', name: 'River Bridge' }
    },
    side_cam: {
      id: 'side_cam', type: 'side',
      title: 'Wrong Pin',
      desc: 'Talk to Cam Ortiz — the rideshare who keeps showing up.',
      npc: 'cam', done: false
    },
    // ---------- v2 side missions (kind = objective type, handled in main.js) ----------
    side_diner: {
      id: 'side_diner', type: 'side', kind: 'defend', area: 'diner',
      title: 'Lunch Rush Defense',
      desc: "Defend Dee's Diner from 3 waves of window-smashers.",
      npc: 'dee', requires: 'main1', done: false, waves: 3,
      reward: { score: 1500, reveal: 'apron' },
      offer: [
        "Matthew, before you head to Priya's — trouble. Same crew from the alley says they'll 'redecorate' my front window.",
        "Lunch rush is in ten minutes. Keep them off the glass for three rounds and the apron's yours. Kidding. Mostly."
      ],
      active: ["Keep 'em off my window! Hit the ones going for the glass first!"],
      winLines: "Window's intact! Grab my spare apron off the hook by the door — you earned it."
    },
    side_snatch: {
      id: 'side_snatch', type: 'side', kind: 'chase', area: 'downtown',
      title: 'Petal Pusher',
      desc: 'Catch the purse snatcher before he gets past Valley Pages.',
      npc: 'wren', done: false, time: 45,
      reward: { score: 1200 },
      offer: [
        "Hey — HEY! That guy in the orange just grabbed my purse off the flower cart!",
        "He's heading east toward the diner. He gets winded every few seconds — catch him and land one hit!"
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
        "Okay so. I MAY have posted that the skate park is 'unguarded tonight.' As a joke.",
        "A whole crew's rolling up. Hold the bowl for forty seconds and they'll get bored. Probably."
      ],
      active: ['Just stay standing! Forty seconds! You got this!'],
      winLines: "They bailed! Tessa's filming a hype reel. You're internet-famous for twelve minutes."
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
        "Matthew! The neighborhood potluck is tonight and I am three things short.",
        "Dee promised a pie, Priya's lending books for the reading corner, and Tessa has string lights. Could you fetch them?"
      ],
      active: ["Pie from Dee, books from Priya, lights from Tessa. Then back to me, hon."],
      winLines: 'June hangs the lights, slices the pie, and saves you the corner piece.'
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
        "Remember what I said about the night shift? Somebody's signaling from the River Bridge after dark.",
        "These knees don't move fast. Walk me down to the bridge and keep the riff-raff off me."
      ],
      active: ["Easy, kid. Bridge is past the yards, to the right. I'm right behind you."],
      winLines: "Hank finds a dropped lantern with a stencil: 'S.B. — 2nd shift'. \"That's for next time,\" he says."
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
    { id: 'beaconring', name: 'Beacon Ring (under the Mill Mountain Star)', area: 'star', x: 720, outfit: 'beacon', reveal: 'main2' }
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

export const SEQUEL_HOOKS = `
<strong>Hank "Rail" Pettigrew:</strong> "Watch the night shift…" — something still moves after dark at the yards.<br><br>
<strong>Cam Ortiz:</strong> Wrong pins keep pulling him into Matthew's path — maybe not coincidence.<br><br>
<strong>Silas Boone:</strong> He already knew too much. He said you'd speak again.
`;

export const ENDING_TEXT = `Matthew Rose walked away from Silas Boone with the leftovers mess sorted, Priya's lead closed, and his name still his own.
He's okay — an everyday guy who stumbled into trouble and chose the quiet exit.
Star City keeps glowing on Mill Mountain. The sequel can wait… for now.`;
