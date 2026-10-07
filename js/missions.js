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
    }
  };

  const collectibles = [
    { id: 'glasses', name: 'Glasses', area: 'downtown', x: 420, outfit: null },
    { id: 'bottle', name: 'Water Bottle', area: 'diner', x: 600, outfit: null }, // clear of Dee (x 320)
    { id: 'hoodie', name: 'Star City Hoodie', area: 'star', x: 500, outfit: 'hoodie' },
    { id: 'jacket', name: 'Rail Yard Jacket', area: 'rails', x: 620, outfit: 'jacket' },
    { id: 'street', name: 'Skate Fit', area: 'skate', x: 640, outfit: 'street' }, // clear of Tessa (x 340)
    { id: 'notebook', name: 'Notebook', area: 'pages', x: 200, outfit: null },
    { id: 'photo', name: 'Classroom Photo', area: 'community', x: 660, outfit: 'photo' } // clear of June (x 300)
  ];

  state.missions = missions;
  state.collectibles = collectibles.map((c) => ({ ...c, taken: false }));
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
      if (m) return (m.id === 'side_coach' && state.deliveryActive) ? 'active' : 'available';
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
    completeMission(id, toast, onUpdate) {
      const m = state.missions[id];
      if (!m || m.done) return;
      m.done = true;
      toast(`Mission complete: ${m.title}`);
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
