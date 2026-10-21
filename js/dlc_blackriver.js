/**
 * Streets of Roanoke 2.0.0 (WIP, pending Matthew's review): DLC "Blackriver". Autumn 2028, two years after the main game.
 * Playable Silas Boone (C-14): visited in Cinder Hollow by Matthew, breaks out with tools smuggled in, is hunted by
 * The Lockkeeper (masked Marcus Hale), and ends by joining Blackriver. Outline: /workspace/samples/blackriver/DLC_missions_outline.md (v3).
 * Same controller contract as js/dlc_silas.js (main.js swaps the active controller). Own save slot 'starCityDrift_dlc_blackriver'.
 * Teen: knockouts only, no gore, no profanity. All names and places original.
 */
import { registerTalkVoices } from './audio.js';
import { onSilasMove } from './silas_moves.js';
import { registerBlackriverScenes } from './scenes_blackriver.js';

export const BR_SAVE_KEY = 'starCityDrift_dlc_blackriver';
const SAVE_V = 1;
function store() { try { return window.localStorage; } catch (_) { return null; } }
export function brLoad() {
  const s = store(); if (!s) return null;
  try { const raw = s.getItem(BR_SAVE_KEY); if (!raw) return null; const d = JSON.parse(raw); return d && typeof d === 'object' && d.v === SAVE_V ? d : null; } catch (_) { return null; }
}
function brWrite(d) { const s = store(); if (!s) return false; try { s.setItem(BR_SAVE_KEY, JSON.stringify(d)); return true; } catch (_) { return false; } }
export function brHasRun() { const d = brLoad(); return !!(d && d.run && !d.run.done); }
export function brCompleted() { const d = brLoad(); return !!(d && d.completed); }
/** C-14 jumpsuit outfit unlocked (finish M4 once). */
export function brC14Unlocked() { const d = brLoad(); return !!(d && (d.c14 || (d.run && d.run.mi >= 5))); }

registerTalkVoices({
  pruitt: { wave: 'square', f0: 150, rate: 0.085, len: 0.07, steps: [1, 0.92, 1.06], vowels: ['a', 'o', 'uh'], fs: 0.95, greet: ['a', 'o'] },
  ida: { wave: 'sine', f0: 270, rate: 0.085, len: 0.065, steps: [1, 1.1, 0.95], vowels: ['e', 'a', 'o'], fs: 1.08, greet: ['e', 'a'] },
  voss: { wave: 'sawtooth', f0: 110, rate: 0.1, len: 0.08, steps: [1, 0.9, 1.0], vowels: ['uh', 'o', 'a'], fs: 0.85, grit: 0.3, greet: ['uh', 'o'] },
  thorne: { wave: 'triangle', f0: 230, rate: 0.075, len: 0.06, steps: [1, 1.05, 0.92], vowels: ['e', 'i', 'a'], fs: 1.1, greet: ['e', 'i'] },
  lockkeeper: { wave: 'sawtooth', f0: 95, rate: 0.11, len: 0.09, steps: [1, 0.94, 1.02], vowels: ['o', 'uh'], fs: 0.8, grit: 0.35, greet: ['uh', 'o'] }
});

export const CAST = {
  matthew: { id: 'matthew', name: 'Matthew Rose', role: 'Visitor' },
  pruitt: { id: 'pruitt', key: 'okafor', name: 'C.O. Pruitt', role: 'Cinder Hollow guard', color: '#2c3e50' },
  ida: { id: 'ida', name: 'Ida Vance', role: 'Retired tailor', color: '#8e2f4f' },
  hank: { id: 'hank', name: 'Hank "Rail" Pettigrew', role: 'Retired', color: '#7f6a3a' },
  voss: { id: 'voss', name: 'Rudy "Tumbler" Voss', role: "The Lockkeeper's lieutenant", color: '#4a4a52' },
  thorne: { id: 'thorne', name: 'Celia Thorne', role: 'Blackriver', color: '#1b2a33' },
  lockkeeper: { id: 'lockkeeper', key: 'marcus_lockkeeper', name: 'The Lockkeeper', role: '???' },
  marcus: { id: 'marcus', key: 'marcus', name: 'Marcus Hale', role: 'The Lockkeeper' }
};
const S = (t) => ({ id: 'silas', name: 'Silas Boone', text: t });
const L = (who, t) => ({ id: who.id, name: who.name, text: t, ...(who.key ? { key: who.key } : {}) });
const NPC_X = { hank: ['rails', 980], ida: ['downtown', 1050], pruitt: ['pr_lobby', 760] };

const COLLECTIBLES = [ // the five Smuggled Tools (Key Ring set)
  { id: 'br_shim', name: 'Smuggled Tool: Shim', area: 'pr_block', x: 1180 },
  { id: 'br_boltkey', name: 'Smuggled Tool: Bolt Key', area: 'pr_shop', x: 820 },
  { id: 'br_cutters', name: 'Smuggled Tool: Wire Cutters', area: 'pr_yard', x: 1150 },
  { id: 'br_codecard', name: 'Smuggled Tool: Code Card', area: 'downtown', x: 760, after: 'b4' },
  { id: 'br_blank', name: 'Smuggled Tool: Master Blank', area: 'star', x: 760, after: 'b5' }
];

/** Step types: as js/dlc_silas.js + cutscene (registered scene id) · warp (area, x) · outfit (red suit + C-14 unlock). */
export const MISSIONS = [
  { id: 'b0', title: 'Visiting Hours', area: 'pr_lobby', night: false,
    sub: 'Cinder Hollow Correctional, autumn 2028. Inmate C-14 has a visitor.',
    steps: [
      { type: 'warp', area: 'pr_lobby', x: 420 },
      { type: 'cutscene', scene: 'br_visiting_hours', obj: 'Visiting hours' }
    ] },
  { id: 'b1', title: 'Seven Hundred and Thirty Days', area: 'pr_block', night: true,
    sub: 'Lights out on Block C. Cell 14 is not as locked as it looks.',
    steps: [
      { type: 'warp', area: 'pr_block', x: 300 },
      { type: 'cutscene', scene: 'br_prison_escape', obj: 'Lights out' },
      { type: 'tutorial', obj: 'Night guards. Show them your manners (knockouts only)', count: 3 }
    ] },
  { id: 'b2', title: 'Lockdown', area: 'pr_mess', night: true,
    sub: 'The alarm is up. The guards are in riot gear, and they know the routine. So does Silas.',
    steps: [
      { type: 'warp', area: 'pr_mess', x: 180 },
      { type: 'fight', obj: 'Get through the mess hall', count: 4, color: '#2c3e50', toast: 'Riot squad! Through the mess hall!' },
      { type: 'goto', area: 'pr_shop', x: 820, obj: 'Head for the prison workshop' },
      { type: 'fight', obj: 'Clear the workshop', count: 3, color: '#2c3e50', toast: 'They followed you into the shop!' }
    ] },
  { id: 'b3', title: 'Over the Wall', area: 'pr_yard', night: true,
    sub: 'The yard, the lights, the wall. And someone already sitting on top of it.',
    steps: [
      { type: 'warp', area: 'pr_yard', x: 200 },
      { type: 'scene', lines: [
        L(CAST.lockkeeper, 'Every lock in this city has a key, Silas. I just collect them.'),
        S('So you are the one who sent the library book. I would like to thank you in person.'),
        L(CAST.lockkeeper, 'You owe me a door, old man. Walk through it.')] },
      { type: 'survive', obj: 'Hold the yard until the wall lights cut out', sec: 35, color: '#2c3e50', toast: 'Searchlights! Hold the yard!' },
      { type: 'scene', lines: [
        { id: 'pruitt', key: 'okafor', name: 'C.O. Pruitt (radio)', text: 'Control, this is Block C. Runner in the yard. Gray hair, headed for the wall!' },
        S('Two years, Officer Pruitt. Do give my regards to the blanket.')],
        reward: 'Silas is over the wall. The Lockkeeper is gone.' }
    ] },
  { id: 'b4', title: 'Old Debts', area: 'rails', night: true,
    sub: 'The Rail Yards. What is left of Boone Holdings, and who took it.',
    steps: [
      { type: 'warp', area: 'rails', x: 200 },
      { type: 'fight', obj: "The Lockkeeper's crew runs your old routes now", count: 4, color: '#16323f', toast: 'Key crew! They wear his stripe.' },
      { type: 'talk', npc: 'hank', obj: 'Hank Pettigrew is watching from the switch house', lines: [
        L(CAST.hank, 'Silas Boone. In an orange suit. I retired too early.'),
        S('Mr. Pettigrew. Who runs my old yard?'),
        L(CAST.hank, 'Nobody you know. Masked fella. His crew collects keys, not money. Every vault and lockbox in Roanoke.'),
        S('Keys. How very patient of him.')] },
      { type: 'talk', npc: 'ida', obj: 'Find a tailor downtown. You cannot stay in orange.', lines: [
        L(CAST.ida, 'Silas Boone. Twelve years ago you told me my shop was a fire risk. I told you to get out.'),
        S('I remember, Mrs. Vance. You were the only one who did.'),
        L(CAST.ida, 'So why should I sew you anything?'),
        S('Because I can pay, and because you would like to see what I do next.'),
        L(CAST.ida, 'Red, then. If you are going to be a problem, be a visible one.')] },
      { type: 'outfit', outfit: 'red', reward: 'New look: the red suit. The C-14 jumpsuit is now an unlockable outfit (Pause menu).' }
    ] },
  { id: 'b5', title: 'Every Lock in the City', area: 'downtown', night: true,
    sub: 'Jefferson Street. The Lockkeeper wants every key in Roanoke, and Silas keeps hearing a name.',
    steps: [
      { type: 'fight', obj: 'Key crew on Jefferson Street', count: 4, color: '#16323f', toast: 'They are cracking the bank night drop!' },
      { type: 'scene', lines: [
        S('Blackriver. That is what the crate stamps say. The same name Matthew asked me about.'),
        S('And there he is, across the street. Older. Tired. Still looking out for everyone.'),
        S('Not tonight, Matthew. Tonight I am busy.')] },
      { type: 'survive', obj: 'The crew wants their code card back', sec: 30, color: '#16323f', toast: 'They want the card back!' }
    ] },
  { id: 'b6', title: 'The Switch House', area: 'star', night: true,
    sub: 'Mill Mountain, under the Star. Where it ended last time.',
    steps: [
      { type: 'goto', area: 'star', x: 480, obj: 'Climb to the Mill Mountain Star' },
      { type: 'scene', lines: [
        L(CAST.voss, 'The boss said you would come up here. Old men like their memories.'),
        S('And young men like their bosses. Shall we?')] },
      { type: 'boss', who: 'voss', obj: "Defeat Tumbler Voss, the Lockkeeper's lieutenant", adds: 2 },
      { type: 'scene', lines: [
        L(CAST.voss, 'Fine. Take the ledger. He gets his tools from the river. Not from us.'),
        S('A supplier. Every lock has a maker, Mr. Voss.')],
        reward: "The Lockkeeper's ledger: the tools came from an outside supplier." }
    ] },
  { id: 'b7', title: 'Blackriver', area: 'river', night: true,
    sub: 'The riverside warehouses. The stamp on every crate finally has a face.',
    steps: [
      { type: 'goto', area: 'river', x: 560, obj: 'Follow the crate stamps to the river warehouses' },
      { type: 'scene', lines: [
        L(CAST.thorne, 'Mr. Boone. Celia Thorne, Blackriver. You took our tools and used every one. We were impressed.'),
        S('You broke me out to see what I would do.'),
        L(CAST.thorne, 'We broke you out to see if you were still worth anything. Our contractors will finish the interview.')] },
      { type: 'fight', obj: 'Pass the Blackriver interview', count: 5, color: '#0f1b22', toast: 'Blackriver contractors. Quiet, careful, unarmed.' },
      { type: 'scene', lines: [
        L(CAST.thorne, 'Good. One last question. The Lockkeeper works for us too, and he has started keeping keys for himself.'),
        S('Then he and I should talk. On the roof, I assume.')] }
    ] },
  { id: 'b8', title: 'The Face Under the Plate', area: 'rails', night: true,
    sub: 'The warehouse roof over the Rail Yards. The Lockkeeper is waiting.',
    steps: [
      { type: 'goto', area: 'rails', x: 700, obj: 'Climb to the warehouse roof' },
      { type: 'scene', lines: [
        L(CAST.lockkeeper, 'You were supposed to be my key, Silas. Not their errand boy.'),
        S('Take off the mask. I would like to see who thinks he can hold my leash.')] },
      { type: 'boss', who: 'lockkeeper', obj: 'Defeat The Lockkeeper', adds: 2, final: true },
      { type: 'cutscene', scene: 'br_reveal', obj: 'The face under the plate' },
      { type: 'finale' }
    ] }
];
export const ENDING_EYEBROW = 'DLC Ending · Blackriver';
export const ENDING_TITLE = 'Blackriver Will Return';
export const ENDING_TEXT = 'Marcus Hale is left on the roof with his mask in his hands and every key he collected gone. Blackriver takes the keys, and the man who found them.\n\n' +
  'Silas Boone straightens the cuffs of a red suit and walks out with Celia Thorne. Not back to Cinder Hollow. Not away. In.\n\n' +
  'Roanoke · six weeks later. On Wren\'s flower cart, an envelope addressed to Matthew Rose in a careful hand. Inside: a blank key and one line. "Ask better next time."\n\n' +
  'Somewhere far from Roanoke, Silas shakes hands with someone we have not met yet.\n\nBLACKRIVER WILL RETURN.';

const TUTORIAL = [
  ['jab', "Gentleman's Jab", 'punch ×3'], ['grip', 'Velvet Grip', 'heavy near a foe'], ['handshake', 'Iron Handshake', 'special'],
  ['lastword', 'Last Word', 'kick: counter stance'], ['stare', 'Cold Stare', 'talk with no one near'], ['rush', 'Boss Rush', 'sprint + punch']
];
/** Every spoken line (VO generation + tests). */
export function allLines() {
  const out = [];
  for (const m of MISSIONS) for (const s of m.steps) if (s.lines) out.push(...s.lines);
  for (const v of Object.values(IDLE)) out.push(...v);
  return out;
}
const IDLE = {
  hank: [L(CAST.hank, 'I log trains now, not crooks. Mostly.')],
  ida: [L(CAST.ida, 'The suit is paid for. Try not to bleed on it. Metaphorically.')],
  pruitt: [L(CAST.pruitt, 'Visiting hours are over, sir.')]
};

const TRANSIENT = ['sceneOn', 'finaleOn', 'spawned', 'stepT', 'timer'];
export function healRun(run) {
  const r = { ...run };
  for (const k of TRANSIENT) delete r[k];
  const last = MISSIONS.length - 1;
  let mi = Number.isInteger(r.mi) ? r.mi : 0, si = Number.isInteger(r.si) ? r.si : 0;
  if (mi < 0) { mi = 0; si = 0; }
  if (mi > last) { mi = last; si = MISSIONS[last].steps.findIndex((s) => s.type === 'finale'); }
  const steps = MISSIONS[mi].steps;
  if (si < 0 || si >= steps.length) si = 0;
  if (steps[si].type === 'finale' || steps[si].type === 'cutscene') si = Math.max(0, si - 1); // a scene saved mid-play replays
  if (steps[si].type === 'boss' && steps[si + 1] && steps[si + 1].type === 'cutscene' && si + 1 !== r.si) { /* keep boss */ }
  r.mi = mi; r.si = si;
  if (r.done && !(mi === last && si >= steps.length - 2)) r.done = false;
  if (!Array.isArray(r.collected)) r.collected = [];
  if (!Array.isArray(r.tutorialDone)) r.tutorialDone = [];
  if (!r.flags || typeof r.flags !== 'object') r.flags = {};
  return r;
}

export function createBlackriver(api) {
  let st = null; const done = new Set(); let unsub = null; let gen = 0; // gen: stale scene/dialogue callbacks (after a jump / KO) are ignored
  const fresh = (difficulty) => ({ mi: 0, si: 0, areaId: 'pr_lobby', x: 420, y: null, hp: null, special: 100, difficulty: difficulty || 'normal',
    collected: [], playTime: 0, score: 0, done: false, flags: {} });
  const mission = () => MISSIONS[st.mi] || null;
  const stepDef = () => { const m = mission(); return m ? m.steps[st.si] || null : null; };
  function persist(extra = {}) {
    if (!st) return false;
    const prev = brLoad() || {};
    return brWrite({ v: SAVE_V, savedAt: Date.now(), completed: !!(prev.completed || extra.completed), completedAt: prev.completedAt || extra.completedAt || null,
      c14: !!(prev.c14 || extra.c14 || st.mi >= 5 || (st.flags && st.flags.redSuit)), bestDifficulty: extra.bestDifficulty || prev.bestDifficulty || null, run: snapshot() });
  }
  function snapshot() {
    const r = { ...st }; for (const k of TRANSIENT) delete r[k];
    const s = stepDef(); if (s && (s.type === 'finale' || s.type === 'cutscene') && !st.done) r.si = Math.max(0, st.si - 1);
    r.tutorialDone = [...done]; return r;
  }
  function listen() {
    if (unsub) return;
    unsub = onSilasMove((move, d) => {
      if (!st) return; const s = stepDef(); if (!s || s.type !== 'tutorial') return;
      const k = move === 'jab' ? (d.step === 3 ? 'jab' : null) : move === 'grip_throw' || move === 'grip_boss' ? 'grip' : move === 'handshake' ? 'handshake'
        : move === 'lastword_stance' || move === 'lastword_counter' ? 'lastword' : move === 'stare' ? 'stare' : move === 'rush' ? 'rush' : null;
      if (k && !done.has(k)) { done.add(k); const row = TUTORIAL.find((r) => r[0] === k); api.toast(`✓ ${row[1]} (${done.size}/6)`, true); api.sfx('ui_select'); }
    });
  }
  function beginStep() {
    const s = stepDef(); if (!s) return;
    st.stepT = 0; st.spawned = false; st.timer = s.sec || 0; st.sceneOn = false; st.finaleOn = false;
    if (s.type === 'tutorial') { done.clear(); api.setSpecial(100); }
  }
  function advance() { const m = mission(); st.si++; if (st.si >= m.steps.length) { completeMission(); return; } beginStep(); persist(); }
  function completeMission() {
    const m = mission(); api.sting('victory_big');
    const next = MISSIONS[st.mi + 1]; st.mi++; st.si = 0; persist();
    api.missionCard({ eyebrow: 'Blackriver · Silas Boone, 2028', title: 'Mission Complete', name: `${st.mi}/${MISSIONS.length - 1} · ${m.title}`, sub: next ? `Next: ${next.title} — ${next.sub}` : '' }, () => {
      if (next) { beginStep(); api.toast(next.title, true); }
    });
  }
  const npcActive = (id) => { const s = stepDef(); return s && s.type === 'talk' && s.npc === id; };
  return {
    which: 'blackriver',
    get state() { return st; },
    missions: MISSIONS, collectibles: COLLECTIBLES,
    newRun(difficulty) { registerBlackriverScenes(); st = fresh(difficulty); listen(); beginStep(); persist(); return st; },
    continueRun() {
      const d = brLoad(); if (!d || !d.run) return null;
      registerBlackriverScenes();
      const run = healRun(d.run); st = { ...fresh(run.difficulty), ...run }; listen(); beginStep();
      const s = stepDef(); if (s && s.type === 'tutorial') for (const k of run.tutorialDone) if (TUTORIAL.some((t) => t[0] === k)) done.add(k);
      delete st.tutorialDone; persist(); return st;
    },
    stop() { gen++; st = null; },
    persist(snap) { if (!st) return false; if (snap) Object.assign(st, snap); return persist(); },
    isNight() { const m = mission(); return m ? m.night !== false : false; },
    music(hostiles, bossOn) { return bossOn ? 'dlc_boss' : hostiles ? 'dlc_fight' : 'dlc_street'; },
    /** Anim key for playable Silas: orange C-14 jumpsuit until the red suit (M4 end), then red unless the player picks C-14. */
    playerKey() {
      if (!st) return 'silas_c14';
      const red = st.mi >= 5 || (st.flags && st.flags.redSuit);
      if (!red) return 'silas_c14';
      return st.flags && st.flags.outfit === 'c14' ? 'silas_c14' : 'silas_red';
    },
    outfitUnlocked() { return !!st && (st.mi >= 5 || !!(st.flags && st.flags.redSuit)); },
    toggleOutfit() {
      if (!this.outfitUnlocked()) return null;
      st.flags.outfit = st.flags.outfit === 'c14' ? 'red' : 'c14'; persist();
      return st.flags.outfit;
    },
    roleTag: 'C-14',
    titleToast(cont) { return cont ? 'Blackriver: welcome back, Mr. Boone' : 'DLC: Blackriver — Silas Boone, 2028'; },
    objective() {
      const m = mission(), s = stepDef();
      if (!m) return { title: 'Blackriver complete', desc: 'Blackriver will return.' };
      let desc = s ? s.obj || (s.type === 'scene' || s.type === 'cutscene' ? '…' : s.type === 'finale' ? 'Blackriver' : '') || m.sub : m.sub;
      if (s && s.type === 'tutorial') desc = TUTORIAL.map(([k, n]) => `${done.has(k) ? '✓' : '○'} ${n}`).join(' · ');
      if (s && s.type === 'survive') desc = `${s.obj}: ${Math.max(0, Math.ceil(st.timer))}s`;
      return { title: `${st.mi}/${MISSIONS.length - 1} · ${m.title}`, desc };
    },
    bannerText() {
      const s = stepDef(); if (!s) return null;
      if (s.type === 'survive') return 'HOLD ON!';
      if (s.type === 'boss') return s.who === 'voss' ? 'BOSS: Tumbler Voss' : 'BOSS: The Lockkeeper';
      return null;
    },
    collectText() { return `Smuggled Tools ${st.collected.length}/${COLLECTIBLES.length}`; },
    tutorialDone: () => new Set(done),
    npcs(areaId) {
      if (!st) return [];
      const m = mission(); const mid = m ? m.id : 'end'; const list = [];
      for (const [id, [area, x]] of Object.entries(NPC_X)) {
        if (area !== areaId) continue;
        const here = id === 'hank' ? mid === 'b4' : id === 'ida' ? mid === 'b4' || mid === 'b5' : false;
        if (here) list.push({ ...CAST[id], area, x, dlc: true });
      }
      return list;
    },
    linesFor(npc) { const s = stepDef(); if (npcActive(npc.id)) return s.lines; return IDLE[npc.id] || [L(npc, '…')]; },
    finaleLines() { return []; },
    finaleScene: 'br_ending',
    endingText() { return ENDING_TEXT; },
    endingInfo() { return { eyebrow: ENDING_EYEBROW, title: ENDING_TITLE, text: ENDING_TEXT, unlock: 'C-14 jumpsuit unlocked', unlockSub: 'Pause → Outfit in Blackriver. Blackriver will return.' }; },
    onTalkDone(npc) { if (!st) return; const s = stepDef(); if (npcActive(npc.id)) { if (s.reward) api.toast(s.reward, true); advance(); } },
    usable() { return null; }, use() { return false; }, usableMarker() { return null; },
    update(dt) {
      if (!st) return;
      st.playTime += dt;
      const s = stepDef(); if (!s) return;
      st.stepT += dt;
      const m = mission(); const here = api.areaId();
      switch (s.type) {
        case 'warp': { if (here !== s.area || Math.abs(api.player().x - s.x) > 400) api.travel(s.area, s.x); advance(); break; }
        case 'cutscene': {
          if (!st.sceneOn) { st.sceneOn = true; const g = gen; api.playScene(s.scene, () => { if (!st || g !== gen) return; st.sceneOn = false; if (s.reward) api.toast(s.reward, true); advance(); }); }
          break;
        }
        case 'outfit': { st.flags.redSuit = true; st.flags.outfit = 'red'; if (s.reward) api.toast(s.reward, true); api.sfx('pickup'); persist({ c14: true }); advance(); break; }
        case 'tutorial': {
          if (here !== m.area) break;
          if (!api.hostiles()) {
            if (done.size >= 6) { api.toast('Block C is quiet. Time to go.', true); advance(); break; }
            api.spawnCrew(s.count, { color: '#2c3e50', wave: 0, guard: true }); api.toast(st.spawned ? 'More guards!' : 'Night guards! Knock them out, nothing worse.', true); st.spawned = true;
          }
          if (!done.has('handshake')) api.setSpecial(100);
          break;
        }
        case 'fight': {
          if (here !== (s.area || m.area) && here !== m.area) break;
          if (!st.spawned) { st.spawned = true; api.spawnCrew(s.count, { color: s.color, wave: 1, guard: m.area.startsWith('pr_') }); if (s.toast) api.toast(s.toast, true); }
          else if (!api.hostiles()) { api.toast('Clear.'); api.heal(15); advance(); }
          break;
        }
        case 'survive': {
          if (here !== m.area) break;
          if (!st.spawned) { st.spawned = true; st.timer = s.sec; api.toast(s.toast, true); }
          st.timer -= dt;
          if (st.timer <= 0) { api.clearFoes('They fall back.'); api.heal(20); advance(); break; }
          if (!api.hostiles() || (api.foeCount() < 2 && st.stepT > 3)) { api.spawnCrew(api.hostiles() ? 2 : 3, { color: s.color, wave: 1 + Math.floor((s.sec - st.timer) / 15), guard: m.area.startsWith('pr_') }); st.stepT = 0; }
          break;
        }
        case 'goto': { if (here === s.area && Math.abs(api.player().x - s.x) < 70) advance(); break; }
        case 'scene': { if (!st.sceneOn) { st.sceneOn = true; const g = gen; api.say(s.lines, () => { if (!st || g !== gen) return; st.sceneOn = false; if (s.reward) api.toast(s.reward, true); advance(); }); } break; }
        case 'boss': {
          if (here !== m.area) break;
          if (!st.spawned) { st.spawned = true; api.spawnBoss(s.who, s.adds); } else if (!api.hostiles()) { api.heal(30); advance(); }
          break;
        }
        case 'finale': {
          if (!st.finaleOn) { st.finaleOn = true; api.finale(() => api.playScene('br_epilogue', () => { st.done = true; st.finaleOn = false; persist({ completed: true, completedAt: Date.now(), bestDifficulty: st.difficulty, c14: true }); api.ending(); }), 'br_ending'); }
          break;
        }
        default: break;
      }
    },
    onKO() { if (!st) return; st.spawned = false; st.sceneOn = false; if (stepDef() && stepDef().type === 'survive') st.timer = stepDef().sec; },
    missionArea() { const m = mission(), s = stepDef(); if (!m) return 'downtown'; return (s && s.area) || m.area; },
    dest() {
      const m = mission(), s = stepDef(); if (!m || !s) return { areaId: 'downtown', x: 700 };
      if (s.type === 'talk') { const [a, x] = NPC_X[s.npc]; return { areaId: a, x }; }
      if (s.area) return { areaId: s.area, x: s.x || null };
      return { areaId: m.area, x: null };
    },
    ambientFights() { const m = mission(); return !!(m && m.night && !m.area.startsWith('pr_')); },
    visibleCollectibles(areaId) {
      if (!st) return [];
      const passed = (mid) => MISSIONS.findIndex((m) => m.id === mid) < st.mi;
      return COLLECTIBLES.filter((c) => c.area === areaId && !st.collected.includes(c.id) && (!c.after || passed(c.after)));
    },
    take(c) { if (!st.collected.includes(c.id)) { st.collected.push(c.id); api.toast(`${c.name} (${st.collected.length}/${COLLECTIBLES.length})`, true); api.sfx('pickup'); persist(); } },
    debugJump(mi, si = 0) { gen++; st.mi = mi; st.si = si; st.sceneOn = false; st.finaleOn = false; beginStep(); persist(); },
    debugAdvance() { advance(); },
    debugTutorial(keys) { for (const k of keys) done.add(k); }
  };
}
