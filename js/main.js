import {
  AREAS, AREA_ORDER, drawBackground, drawMinimap, DEPTH, getDepth, loadBackgrounds,
  drawSceneGrade, drawGroundShadow, getSignRects
} from './world.js';
import { NPC_DEFS, OUTFITS, OUTFIT_ORDER, OUTFIT_HOTKEYS } from './npcs.js';
import { createMissionSystem, SEQUEL_HOOKS, ENDING_TEXT } from './missions.js';
import { hasSave, clearSave, serializeSave, saveGame, inspectSave, applySave } from './save.js';
import { createInput, getPromptLabel, getPromptDevice, rumble } from './input.js';
import {
  createPlayer, updatePlayer, updateEnemy, resolveHits,
  drawEnemy, spawnWave, createSilasFighter, clampDepth, setDepthBand, getDepthBand,
  createThug, setDifficulty, getDifficulty, DIFFICULTIES, DIFFICULTY_ORDER, SPECIAL_COST, knockDown
} from './combat.js';
import { animFrame, animMs, setAnim, enemyCharKey, animApiReady } from './anim.js';
import * as SpriteLib from './sprites.js'; // optional newer helpers (getCollectibleSprite) without a hard import
import { getMatthewSprite, getNpcSprite, getEnemySprite, drawSprite, drawCollectible, clearSpriteCache, loadSprites, getHeartImages } from './sprites.js';
import { createTitle } from './title.js';
import { createOutfitsMenu } from './outfits_menu.js';
import { getHeroFrame, drawHero, clearHeroCache, HERO_DRAW_H, HERO_SHADOW_W } from './hero.js';
import { createFollowCamera } from './camera.js';
import { createPresenter } from './present.js';
import { setMusic, sting, setPaused, setDialogueDuck, sfx, voice, talk, stopTalk, adjustFocusedSlider, mountAudioSettings, audioDebug } from './audio.js';

/** true: player + title Matthew use the high-res procedural hero (hero.js); false: Joe's matthew_sheet.png. */
const USE_HERO_RENDER = false; // Joe's approved v3 sheet ships; hero.js kept as an alternate renderer
const PLAYER_SCALE = 1.3; // heroic presentation scale for Matthew vs 64x84 NPCs (draw only; hitboxes unchanged)

const canvas = document.getElementById('game');
const W = canvas.width;
const H = canvas.height;
// Gameplay draws into a 960×540 scene. present.js crops the follow camera and
// upscales with filtering onto the display canvas. DOM HUD / touch controls
// sit outside this canvas, so the lens never moves them.
const scene = document.createElement('canvas');
scene.width = W;
scene.height = H;
const ctx = scene.getContext('2d');
ctx.imageSmoothingEnabled = false;
const presenter = createPresenter(canvas, scene);
const followCam = createFollowCamera();

const stateBag = {};
const missions = createMissionSystem(stateBag);
const input = createInput(canvas, {
  onPadChange(connected, gp, device) {
    toast(connected
      ? `Controller connected (${device === 'ps' ? 'PlayStation' : 'Xbox / standard'})`
      : 'Controller disconnected', true);
    refreshPrompts(true);
    if (!connected && gameState.mode === 'play' && !input.hasPad()) pauseGame();
  },
  onDeviceChange() { refreshPrompts(true); }
});

/** ?debug=1 exposes window.__scd (mission jumps, warps). Off by default. */
const DEBUG = (() => {
  try { const v = new URLSearchParams(location.search).get('debug'); return v !== null && v !== '0' && v !== 'false'; }
  catch { return false; }
})();

const gameState = {
  mode: 'title', // title | play | pause | dialogue | ending
  areaId: 'downtown',
  cameraX: 0,
  outfitId: 'polo',
  enemies: [],
  wave: 0,
  combatLock: false, // when true, can't leave area until cleared
  toastTimer: 0,
  dialogue: null,
  dialogueIdx: 0,
  dialogueNpc: null,
  ended: false,
  saveTimer: 0,
  hitStop: 0,
  spawnChecked: false,
  areaVisitCombat: {},
  score: 0,
  playTime: 0,
  special: 40,
  difficulty: 'normal',      // easy | normal | hard | arcade (saved; old saves default to normal)
  pendingDifficulty: null,   // picked on the title difficulty selector for a New Game
  fetchGive: null            // Potluck Run item being handed over in the current dialogue
};

/**
 * Ground rows inside the current area's walkable band (getDepth(area) = feet-Y range measured
 * per bg plate; combat.js clamps fighters to the same band via setDepthBand).
 */
const PLAYER_START_Y = Math.round((getDepth('downtown').min + getDepth('downtown').max) / 2);
const npcFeetY = () => getDepthBand().min + 6;   // NPCs stand on the back edge of the sidewalk
const collectY = () => getDepthBand().min + 24;  // collectible orbs float just above the sidewalk

/** Switch the walkable band to the current area and keep the player inside it. */
function syncDepthBand() {
  setDepthBand(getDepth(AREAS[gameState.areaId]));
  if (player) player.y = clampDepth(player.y);
}

let player = createPlayer(200, PLAYER_START_Y);
let booted = false;
let pendingAction = null; // a title button pressed before assets finished loading

function $(id) { return document.getElementById(id); }

const toastQueue = [];
/** Queued toasts so mission/collectible messages aren't lost; urgent ones show immediately. */
function toast(msg, urgent = false) {
  if (!msg) return;
  const el = $('toast');
  if (!urgent && gameState.toastTimer > 0 && !el.classList.contains('hidden')) {
    if (el.textContent === msg || toastQueue[toastQueue.length - 1] === msg) return;
    toastQueue.push(msg);
    if (toastQueue.length > 4) toastQueue.shift();
    return;
  }
  showToastNow(msg);
}
function showToastNow(msg) {
  const el = $('toast');
  el.textContent = msg;
  el.classList.remove('hidden');
  gameState.toastTimer = toastQueue.length ? 1.5 : 2.2;
}
function tickToast(dt) {
  if (gameState.toastTimer <= 0) return;
  gameState.toastTimer -= dt;
  if (gameState.toastTimer <= 0) {
    if (toastQueue.length) showToastNow(toastQueue.shift());
    else $('toast').classList.add('hidden');
  }
}

/** Location plaque text: [title, subtitle] per area (concept: "DOWNTOWN / MAIN STREET"). */
const HUD_LOCATION = {
  downtown: ['DOWNTOWN', 'Jefferson Street'],
  diner: ["DEE'S DINER", 'Downtown Roanoke'],
  pages: ['VALLEY PAGES', 'Bookshop Row'],
  skate: ['STARBOARD SKATE', 'Skate Shop'],
  gym: ['VALLEY GYM', 'Iron District'],
  rails: ['RAIL YARDS', 'Freight Line'],
  river: ['RIVER BRIDGE', 'Roanoke River'],
  star: ['MILL MOUNTAIN', 'The Star'],
  community: ['COMMUNITY CENTER', 'Neighborhood']
};

/** 1.3.2: HUD portrait follows the outfit (Sprites.getOutfitPortrait: helmet bust for Hell's Nightmare, else default). */
function syncPortrait() {
  const el = $('portrait');
  if (!el || typeof SpriteLib.getOutfitPortrait !== 'function') return;
  let img = null;
  try { img = SpriteLib.getOutfitPortrait(gameState.outfitId); } catch (_) { img = null; }
  const src = img && img.src;
  if (src && el.src !== src) el.src = src;
}
function updateHUD() {
  syncPortrait();
  const m = missions.getActive();
  const sm = sideMission();
  $('mission-title').textContent = sm ? sm.title : m ? m.title : 'Free Roam';
  $('mission-desc').textContent = sm ? sideObjective(sm) : m ? m.desc : (stateBag.deliveryActive ? 'Deliver to River Bridge' : 'Explore Star City');
  $('outfit-count').textContent = `${stateBag.unlockedOutfits.size}/${OUTFIT_ORDER.length}`;
  $('collect-count').textContent = `${missions.collectCount()}/${missions.collectTotal()}`;
  const area = AREAS[gameState.areaId];
  const loc = HUD_LOCATION[gameState.areaId] || [area.name.toUpperCase(), ''];
  $('location-label').textContent = loc[0];
  $('location-sub').textContent = loc[1] || area.name;
  $('combo-label').textContent = player.combo > 1 ? `COMBO x${player.combo}` : '';
  $('score-val').textContent = 'x ' + gameState.score;
  if ($('special-fill')) $('special-fill').style.width = Math.min(100, gameState.special) + '%';

  // Hearts (6 slots like concept) — only rebuild when the count changes
  const hearts = $('hearts');
  if (hearts) {
    const maxSlots = 6;
    const filled = Math.max(0, Math.ceil((player.hp / player.maxHp) * maxSlots));
    if (hearts.dataset.filled !== String(filled)) {
      hearts.dataset.filled = String(filled);
      const { full, empty } = getHeartImages();
      hearts.innerHTML = '';
      for (let i = 0; i < maxSlots; i++) {
        const img = document.createElement('img');
        img.src = (i < filled ? full : empty)?.src || (i < filled ? 'assets/sprites/heart.png' : 'assets/sprites/heart_empty.png');
        img.alt = '';
        if (i >= filled) img.className = 'empty';
        hearts.appendChild(img);
      }
    }
  }
  // Time
  const t = Math.floor(gameState.playTime);
  const hh = String(Math.floor(t / 3600)).padStart(2, '0');
  const mm = String(Math.floor((t % 3600) / 60)).padStart(2, '0');
  const ss = String(t % 60).padStart(2, '0');
  if ($('time-val')) $('time-val').textContent = `${hh}:${mm}:${ss}`;
}

function showTitle() {
  gameState.mode = 'title';
  $('title-screen').classList.remove('hidden');
  $('hud').classList.add('hidden');
  $('pause-screen').classList.add('hidden');
  $('ending-screen').classList.add('hidden');
  $('confirm-screen')?.classList.add('hidden');
  refreshTitleButtons();
  input.showMobile(false);
  title.show(); // attract "PRESS START" first; the menu focuses itself when it opens
  menuFocus(0);
  if (updateReady) applyUpdate(); // v3: new version installed while playing → restart now (title = safe)
}

/** Continue + New Game only when a valid save exists; otherwise just Start Free Roam. */
function refreshTitleButtons() {
  const has = hasSave();
  $('btn-continue').classList.toggle('hidden', !has);
  $('btn-new-game').classList.toggle('hidden', !has);
  $('btn-start').classList.toggle('hidden', has);
}

function startGame(fromSave) {
  if (!booted) { pendingAction = () => startGame(fromSave); return; }
  if (gameState.mode !== 'title') return; // double tap / click + touch
  clearSpriteCache();
  clearHeroCache();
  // Always rebuild a fresh mission state, then overlay the save on top of it.
  Object.keys(stateBag).forEach((k) => delete stateBag[k]);
  createMissionSystem(stateBag);
  player = createPlayer(200, PLAYER_START_Y);
  gameState.areaId = 'downtown';
  gameState.outfitId = 'polo';
  gameState.ended = false;
  gameState.score = 0;
  gameState.playTime = 0;
  gameState.special = 40;
  gameState.bossActive = false;
  gameState.difficulty = (!fromSave && gameState.pendingDifficulty) || 'normal';
  gameState.pendingDifficulty = null;
  gameState.fetchGive = null;
  let restored = false;
  if (fromSave) {
    const r = inspectSave();
    const applied = r.data ? applySave(r.data, { player, stateBag, gameState, areas: AREAS }) : null;
    if (applied) {
      gameState.areaId = applied.areaId;
      gameState.outfitId = applied.outfitId;
      restored = true;
    } else {
      // corrupt / unreadable: start clean on a fresh mission state
      Object.keys(stateBag).forEach((k) => delete stateBag[k]);
      createMissionSystem(stateBag);
      player = createPlayer(200, PLAYER_START_Y);
      toast("Couldn't read that save — starting a new game");
    }
  }
  setDifficulty(gameState.difficulty);
  gameState.enemies = [];
  gameState.combatLock = false;
  gameState.wave = 0;
  gameState.spawnChecked = false;
  gameState.areaVisitCombat = {};
  gameState.saveTimer = 0;
  syncDepthBand();
  gameState.mode = 'play';
  $('title-screen').classList.add('hidden');
  $('confirm-screen')?.classList.add('hidden');
  clearMenuFocus();
  $('hud').classList.remove('hidden');
  $('desktop-hint').classList.toggle('hidden', input.isMobile());
  input.showMobile(input.isMobile());
  input.flush();
  input.focusGame();
  refreshPrompts(true);
  updateHUD();
  if (restored) {
    toast('Welcome back to Star City');
    gameState.areaVisitCombat[gameState.areaId] = 1; // no instant ambush on load
  } else {
    toast("Find Dee Morales at Dee's Diner");
    maybeSpawnEncounter(true);
  }
  persist();
  followCam.cut();
}

function maybeSpawnEncounter(force) {
  if (gameState.mode !== 'play') return;
  const area = AREAS[gameState.areaId];
  if (!area.spawnCombat) return;
  if (hostilesAlive()) return;
  const visited = gameState.areaVisitCombat[gameState.areaId] || 0;
  if (!force && visited > 0 && Math.random() > area.combatChance) return;
  // Don't spawn on first moment at diner until after talking? Actually spawn street thugs elsewhere
  if (gameState.areaId === 'diner' && !stateBag.missions.main1.done && !force) return;
  if (gameState.areaId === 'star') return;
  const sk = sideMission()?.kind;
  if (sk === 'defend' || sk === 'survive' || sk === 'spar' || sk === 'chase') return; // the mission runs its own fights
  if (sk === 'escort' && gameState.areaId === sideMission().dest) return;           // the ambush handles the bridge

  const count = Math.max(1, 2 + Math.min(3, gameState.wave) + getDifficulty().wave);
  gameState.enemies = spawnWave(area, count, gameState.wave, player.x);
  gameState.combatLock = true;
  gameState.areaVisitCombat[gameState.areaId] = visited + 1;
  gameState.wave++;
  sfx('fight_start');
  toast('Thugs! Clear the street!');
}

function npcsInArea() {
  // Silas is the boss while the fight is on, and he's gone after the ending.
  const esc = stateBag.side && stateBag.missions[stateBag.side.id]?.kind === 'escort' ? stateBag.side : null;
  const list = NPC_DEFS.filter((n) => n.area === gameState.areaId &&
    !(n.id === 'silas' && (gameState.bossActive || stateBag.mainComplete)) &&
    !(esc && n.id === 'hank'));
  if (esc && esc.area === gameState.areaId) {
    const hank = NPC_DEFS.find((n) => n.id === 'hank');
    list.push({ ...hank, area: esc.area, x: esc.x });
  }
  return list;
}

function nearestNPC() {
  // x distance only: the depth band is shallow enough that any lane can talk
  let best = null, bestD = 55;
  for (const n of npcsInArea()) {
    const d = Math.abs(n.x - player.x);
    if (d < bestD) { best = n; bestD = d; }
  }
  return best;
}

function canTalkTo(npc) {
  const m = stateBag.missions;
  const linked = Object.values(m).find(
    (x) => x.npc === npc.id && !x.done && (!x.requires || m[x.requires].done)
  );
  // Also allow talking if mission done for flavor? Only mission-linked first time completion
  return linked || true;
}

/** Lines depend on the NPC's mission state: story lines, "not yet", "in progress", or "done". */
function linesFor(npc) {
  const sm = missions.missionFor(npc.id);
  if (sm && sm.offer) {
    if (stateBag.side && stateBag.side.id === sm.id) {
      return sm.kind === 'fetch' && fetchDone()
        ? ["You found everything! Matthew, this potluck is going to be perfect."]
        : sm.active;
    }
    if (stateBag.side) return ["Looks like you've got your hands full. Finish that first, then come see me."];
    return sm.offer;
  }
  const st = missions.npcStatus(npc.id);
  if (st === 'locked') return npc.waitLines || npc.lines;
  if (st === 'active') return npc.activeLines || npc.doneLines || npc.lines;
  if (st === 'done') return npc.doneLines || npc.lines;
  return npc.lines;
}

function startDialogue(npc) {
  let lines = linesFor(npc);
  gameState.fetchGive = null;
  const fm = sideMission();
  if (fm && fm.kind === 'fetch') {
    const item = fm.items.find((it) => it.npc === npc.id && !stateBag.fetchItems.includes(it.id));
    if (item) { gameState.fetchGive = item; lines = [item.line]; }
  }
  gameState.mode = 'dialogue';
  gameState.dialogueNpc = npc;
  gameState.dialogue = lines;
  gameState.dialogueIdx = 0;
  $('dialogue').classList.remove('hidden');
  $('dialogue-name').textContent = `${npc.name} — ${npc.role}`;
  $('dialogue-text').textContent = lines[0];
  talk(npc.id, lines[0], true); // audio: greeting + this character's talk blips
  $('interact-prompt').classList.add('hidden');
  updateDialogueButton();
  input.flush();
}

function updateDialogueButton() {
  const btn = $('dialogue-next');
  if (!btn || !gameState.dialogue) return;
  const lastLine = gameState.dialogueIdx >= gameState.dialogue.length - 1;
  const dev = getPromptDevice();
  const key = dev === 'touch' ? '' : dev === 'keyboard' ? ' (E)' : ` (${getPromptLabel('confirm')})`;
  btn.textContent = (lastLine ? 'Close' : 'Continue') + key;
}

function advanceDialogue() {
  if (gameState.mode !== 'dialogue' || !gameState.dialogue) return;
  gameState.dialogueIdx++;
  if (gameState.dialogueIdx >= gameState.dialogue.length) {
    finishDialogue();
  } else {
    $('dialogue-text').textContent = gameState.dialogue[gameState.dialogueIdx];
    if (gameState.dialogueNpc) talk(gameState.dialogueNpc.id, gameState.dialogue[gameState.dialogueIdx]);
    updateDialogueButton();
  }
}

function finishDialogue() {
  if (gameState.mode !== 'dialogue') return;
  const npc = gameState.dialogueNpc;
  stopTalk();
  $('dialogue').classList.add('hidden');
  $('dialogue-next').classList.remove('pad-focus');
  gameState.mode = 'play';
  gameState.dialogue = null;
  gameState.dialogueNpc = null;
  input.flush();
  input.focusGame();
  if (!npc) return;

  if (gameState.fetchGive) {
    const it = gameState.fetchGive;
    gameState.fetchGive = null;
    if (!stateBag.fetchItems.includes(it.id)) stateBag.fetchItems.push(it.id);
    const n = stateBag.fetchItems.length, total = stateBag.missions.side_potluck.items.length;
    toast(`Got ${it.name} (${n}/${total})${n >= total ? ' — back to June!' : ''}`);
    updateHUD();
    persist();
    return;
  }

  const m = missions.missionFor(npc.id);
  if (m && m.kind) {
    if (stateBag.side && stateBag.side.id === m.id) {
      if (m.kind === 'fetch' && fetchDone()) completeSide();
    } else if (!stateBag.side) {
      startSide(m);
    }
  } else if (m) {
    if (m.id === 'side_coach') {
      // Accepting the job starts the delivery; it completes at the River Bridge.
      missions.startDelivery(toast, onProgress);
    } else if (m.id === 'main4') {
      // Silas confrontation becomes a boss fight; main4 completes when he's down.
      startBossFight();
    } else {
      missions.completeMission(m.id, toast, onProgress);
      if (m.id === 'main1') {
        // street fight after Dee
        const areaId = gameState.areaId;
        setTimeout(() => {
          if (gameState.mode === 'play' && gameState.areaId === areaId && !hostilesAlive()) {
            gameState.enemies = spawnWave(AREAS[gameState.areaId], 3, gameState.wave++, player.x);
            gameState.combatLock = true;
            sfx('fight_start');
            toast('Ambush outside the diner!');
          }
        }, 400);
      }
      if (m.id === 'side_june') toast('June appreciates the help. Soft landing secured.');
      if (m.id === 'side_tessa') toast('Check collectibles around Star City for outfits!');
      if (m.id === 'side_cam') toast('Cam pulls away… toward the wrong pin again.');
    }
  }
  updateHUD();
  persist();
}

function startBossFight() {
  const area = AREAS[gameState.areaId];
  const bx = player.x + 140 < area.width - 60 ? player.x + 140 : player.x - 140;
  gameState.enemies = [createSilasFighter(bx, player.y)];
  gameState.combatLock = true;
  gameState.bossActive = true;
  sfx('fight_start'); voice('silas_boss', 'taunt', { delay: 0.3 });
  toast('Silas wants a word — with fists.');
}

/** Progress happened (mission, collectible, outfit): refresh HUD and autosave. */
function onProgress() {
  checkGold();
  updateHUD();
  persist();
}

// ---------- v2 side-mission engine (defend / chase / survive / fetch / spar / escort) ----------
function hostilesAlive() { return gameState.enemies.some((e) => e.alive && !e.noLock); }
function sideMission() { return stateBag.side ? stateBag.missions[stateBag.side.id] || null : null; }
function fetchDone() {
  const m = stateBag.missions.side_potluck;
  return m.items.every((it) => stateBag.fetchItems.includes(it.id));
}
const npcDef = (id) => NPC_DEFS.find((n) => n.id === id);

function sideObjective(m) {
  const s = stateBag.side;
  switch (m.kind) {
    case 'defend': return `Wave ${Math.min(m.waves, Math.max(1, s.wave))}/${m.waves} · Diner window ${Math.max(0, Math.ceil(s.hp))}%`;
    case 'survive': return `Survive! ${Math.max(0, Math.ceil(s.t))}s left`;
    case 'spar': return `KOs ${s.kos}/${m.target} · Hits taken ${s.hits}/${s.maxHits}`;
    case 'chase': {
      const where = s.runnerArea && s.runnerArea !== gameState.areaId ? ` — he ran to ${AREAS[s.runnerArea].name}` : '';
      return `Catch the snatcher! ${Math.max(0, Math.ceil(s.t))}s${where}`;
    }
    case 'escort': return `Hank ${Math.max(0, Math.ceil(s.hp))}/100 · ${s.ambush ? 'Fight off the ambush!' : 'Walk him to the River Bridge'}`;
    case 'fetch': {
      const left = m.items.filter((it) => !stateBag.fetchItems.includes(it.id));
      return left.length ? `Fetch: ${left.map((it) => `${it.name} (${npcDef(it.npc).name.split(' ')[0]})`).join(', ')}` : 'Bring everything back to June';
    }
    default: return m.desc;
  }
}

function addSideWave(n, extra) {
  const area = AREAS[gameState.areaId];
  const list = spawnWave(area, Math.max(1, n), gameState.wave++, player.x);
  list.forEach((e, i) => extra && extra(e, i));
  gameState.enemies.push(...list);
  gameState.combatLock = true;
  return list;
}

function makeRunner(x) {
  const e = createThug(x, getDepthBand().min + 30, 0);
  Object.assign(e, { runner: true, noLock: true, hp: 1, maxHp: 1, color: '#d35400', scoreValue: 0, runT: 2.4, restT: 0 });
  return e;
}

function startSide(m) {
  if (stateBag.side) { toast('Finish your current job first'); return; }
  const D = getDifficulty();
  const s = { id: m.id };
  stateBag.side = s;
  if (m.kind === 'defend') { s.wave = 0; s.hp = 100; s.next = 0.8; }
  else if (m.kind === 'survive') { s.t = m.time; s.next = 0.5; }
  else if (m.kind === 'spar') { s.kos = 0; s.hits = 0; s.maxHits = D.sparHits; s.next = 0.6; }
  else if (m.kind === 'chase') {
    s.t = m.time; s.runnerArea = gameState.areaId;
    gameState.enemies.push(makeRunner(Math.min(AREAS[gameState.areaId].width - 120, npcDef(m.npc).x + 90)));
  } else if (m.kind === 'escort') { s.hp = 100; s.area = gameState.areaId; s.x = npcDef(m.npc).x; s.ambush = false; }
  else if (m.kind === 'fetch') { stateBag.fetchItems = []; }
  sfx('mission_start');
  toast(`Mission started: ${m.title}`);
  onProgress();
}

function failSide(msg) {
  const m = sideMission();
  if (!m) return;
  stateBag.side = null;
  gameState.enemies = gameState.enemies.filter((e) => !e.runner && !e.sideFoe);
  if (!hostilesAlive()) { gameState.enemies = []; gameState.combatLock = false; }
  toast(msg, true);
  toast(`Talk to ${npcDef(m.npc).name} to try "${m.title}" again.`);
  updateHUD();
  if (!getDifficulty().arcade) persist();
}

function completeSide() {
  const m = sideMission();
  if (!m) return;
  gameState.enemies = gameState.enemies.filter((e) => !e.runner && !e.sideFoe);
  if (!hostilesAlive()) { gameState.enemies = []; gameState.combatLock = false; }
  gameState.score += m.reward?.score || 0;
  heal(30, false);
  if (m.winLines) toast(m.winLines);
  missions.completeMission(m.id, toast, onProgress); // clears stateBag.side, reveals reward pickups, autosaves
  if (m.reward?.score) toast(`+${m.reward.score} score`);
}

/** Healing scales with difficulty (Arcade: none). */
function heal(base, announce = true) {
  const amt = Math.round(base * getDifficulty().heal);
  if (amt <= 0 || player.hp >= player.maxHp) return 0;
  player.hp = Math.min(player.maxHp, player.hp + amt);
  if (announce) toast(`Breather: +${amt} HP`);
  return amt;
}

/** Gold Star Suit: 100% completion (all missions + collectibles) or beating Silas on Hard / Arcade. */
function checkGold() {
  if (!stateBag.unlockedOutfits || stateBag.unlockedOutfits.has('gold')) return;
  if (stateBag.beatHard || missions.allDone()) {
    stateBag.unlockedOutfits.add('gold');
    toast(stateBag.beatHard ? 'Beat Silas on Hard — Gold Star Suit unlocked! (key 9)' : '100% complete — Gold Star Suit unlocked! (key 9)', true);
  }
}

// ---------- 1.3.2: Hell's Nightmare helmet (outfit `ironclad`) — hidden collectible in the Rail Yards ----------
// `stealth` collectibles are drawn faint and unlabelled until Matthew gets close; the first time he does,
// the helmet is "spotted" (glint sound + toast) and stays fully visible from then on (saved: save v4 `spotted`).
const STEALTH_SPOT_DIST = 170;
function stealthVis(c) {
  if (!c.stealth || c.spotted) return 1;
  const d = Math.abs(c.x - player.x);
  return d >= STEALTH_SPOT_DIST + 230 ? 0.12 : d <= STEALTH_SPOT_DIST ? 1 : 0.12 + 0.88 * (1 - (d - STEALTH_SPOT_DIST) / 230);
}
function checkStealthSpots() {
  for (const c of stateBag.collectibles) {
    if (!c.stealth || c.spotted || c.taken || c.area !== gameState.areaId) continue;
    if (Math.abs(c.x - player.x) > STEALTH_SPOT_DIST) continue;
    c.spotted = true;
    sfx('glint');
    toast(c.outfit === 'ironclad' ? 'Something glints by the last boxcar… a helmet?' : `You spotted the ${c.name}!`);
    persist();
  }
}

/** Collectible pickup: score for pure collectibles, outfits are worn right away. */
function collectHere() {
  const got = missions.tryCollect(gameState.areaId, player.x, toast, () => {});
  if (!got) return null;
  if (got.score) { gameState.score += got.score; toast(`+${got.score} score`); }
  if (got.outfit) setOutfit(got.outfit, true); // the unlock fanfare already played
  if (got.outfit === 'ironclad') toast("Hell's Nightmare suit unlocked! Wear it any time with = or Shift+2 (L1/R1 to cycle).");
  onProgress();
  return got;
}

/** Where a side mission's enemies walk to (Dee's window, escorted Hank), else the player. */
function sideTarget(e) {
  const s = stateBag.side;
  if (s && e.target === 'dee') { const dx = npcDef('dee').x; return { x: dx + (e.x < dx ? -26 : 26), y: npcFeetY() }; }
  if (s && e.target === 'escort' && s.area === gameState.areaId) return { x: s.x + (e.x < s.x ? -26 : 26), y: npcFeetY() };
  return player;
}

function updateRunner(e, dt, area) {
  if (!e.alive || e.kd) { updateEnemy(e, player, dt, area.width); return; } // caught / knockdown states
  e.animT += dt;
  if (e.stun > 0) { e.stun -= dt; e.pose = 'hurt'; setAnim(e, 'hurt', { key: 'snatcher', sec: e.stun + dt }); return; }
  if (e.restT > 0) {
    e.restT -= dt; e.pose = 'idle'; e.facing = player.x > e.x ? 1 : -1; setAnim(e, 'idle');
    if (e.restT <= 0) e.runT = 2 + Math.random();
    return;
  }
  e.runT -= dt;
  if (e.runT <= 0) { e.restT = 0.9; return; } // winded
  e.facing = 1; e.pose = 'chase'; setAnim(e, 'run');
  e.x += getDifficulty().runner * dt;
  const s = stateBag.side;
  if (e.x >= area.width - 40) {
    if (!area.rightTo || gameState.areaId === 'pages') { failSide('The snatcher got away past Valley Pages.'); return; }
    s.runnerArea = area.rightTo;
    gameState.enemies = gameState.enemies.filter((k) => k !== e);
    toast(`He ducked into ${AREAS[area.rightTo].name}!`);
  }
}

/** Per-frame side-mission logic (only in play, after combat). */
function updateSide(dt) {
  const m = sideMission();
  if (!m) return;
  const s = stateBag.side;
  const D = getDifficulty();
  const inArea = gameState.areaId === m.area;
  if ((m.kind === 'defend' || m.kind === 'survive' || m.kind === 'spar') && !inArea) {
    failSide(`You left ${AREAS[m.area].name} — mission failed.`);
    return;
  }
  if (m.kind === 'defend') {
    const deeX = npcDef('dee').x;
    for (const e of gameState.enemies) {
      if (e.alive && e.target === 'dee' && e.hitbox && !e.hitbox.hit.has('window') && Math.abs(e.x - deeX) < 60) {
        e.hitbox.hit.add('window');
        s.hp -= e.dmg * 0.8;
        sfx('glass', { big: s.hp <= 0 }); // audio: the diner window cracking
      }
    }
    if (s.hp <= 0) { failSide("The diner window's smashed — Dee's furious (at them, not you)."); return; }
    if (!hostilesAlive()) {
      if (s.wave >= m.waves) { completeSide(); return; }
      s.next -= dt;
      if (s.next <= 0) {
        s.wave++;
        addSideWave(2 + s.wave + D.wave, (e, i) => { e.sideFoe = true; if (i % 2 === 0) e.target = 'dee'; });
        toast(`Lunch rush wave ${s.wave}/${m.waves}!`);
        s.next = 1.5;
      }
    }
  } else if (m.kind === 'survive') {
    s.t -= dt;
    s.next -= dt;
    const alive = gameState.enemies.filter((e) => e.alive && !e.noLock).length;
    if (s.t <= 0) { toast('Time! The crew bails.'); completeSide(); return; }
    if (s.next <= 0 && alive < 2 + Math.max(0, D.wave)) {
      addSideWave(2 + D.wave, (e) => { e.sideFoe = true; });
      s.next = 7;
    }
  } else if (m.kind === 'spar') {
    if (s.hits > s.maxHits) {
      s.kos = 0; s.hits = 0; s.next = 1.2;
      for (const e of gameState.enemies) if (e.sideFoe) { e.alive = false; e.stun = 0; }
      gameState.enemies = gameState.enemies.filter((e) => !e.sideFoe);
      toast('Tagged too often — Coach resets the round!', true);
      return;
    }
    if (s.kos >= m.target) { completeSide(); return; }
    if (!hostilesAlive()) {
      s.next -= dt;
      if (s.next <= 0) {
        addSideWave(Math.min(2 + Math.max(0, D.wave), m.target - s.kos), (e) => { e.sideFoe = true; e.sparring = true; e.dmg = Math.max(1, Math.round(e.dmg * 0.6)); });
        s.next = 0.8;
      }
    }
  } else if (m.kind === 'chase') {
    s.t -= dt;
    if (s.t <= 0) { failSide('Out of breath — the snatcher vanished into the crowd.'); return; }
    const r = gameState.enemies.find((e) => e.runner);
    if (r && !r.alive) { toast('Caught him! Purse recovered.'); completeSide(); return; }
  } else if (m.kind === 'escort') {
    if (s.area === gameState.areaId) {
      const goal = player.x - player.facing * 50;
      const d = goal - s.x;
      if (Math.abs(d) > 4) s.x += Math.sign(d) * Math.min(Math.abs(d), 150 * dt);
      for (const e of gameState.enemies) {
        if (e.alive && e.target === 'escort' && e.hitbox && !e.hitbox.hit.has('hank') && Math.abs(e.x - s.x) < 50) {
          e.hitbox.hit.add('hank');
          s.hp -= e.dmg;
        }
      }
    }
    if (s.hp <= 0) { failSide("Hank's knees have had enough — he heads home."); return; }
    if (gameState.areaId === m.dest && !s.ambush) {
      s.ambush = true;
      addSideWave(3 + D.wave, (e, i) => { e.sideFoe = true; if (i % 2 === 0) e.target = 'escort'; });
      toast('Ambush on the bridge — protect Hank!', true);
    } else if (s.ambush && !hostilesAlive()) {
      completeSide();
    }
  }
}

function tryInteract() {
  if (gameState.combatLock && hostilesAlive()) {
    toast('Clear the thugs first!');
    return;
  }
  const npc = nearestNPC();
  if (npc) {
    startDialogue(npc);
    return;
  }
  // collectibles
  collectHere();
  missions.checkDelivery(gameState.areaId, toast, onProgress);
}

function transitionArea(dir) {
  if (gameState.combatLock && hostilesAlive()) {
    toast('Defeat all enemies to leave!');
    return false;
  }
  const area = AREAS[gameState.areaId];
  const nextId = dir === 'left' ? area.leftTo : area.rightTo;
  if (!nextId) return false;
  gameState.areaId = nextId;
  const next = AREAS[nextId];
  player.x = dir === 'left' ? next.width - 80 : 80;
  syncDepthBand();
  gameState.enemies = [];
  gameState.combatLock = false;
  const side = stateBag.side, sm = sideMission();
  if (sm && sm.kind === 'escort' && side.area !== nextId) {
    side.area = nextId; // Hank tags along
    side.x = Math.max(40, Math.min(next.width - 40, player.x + (dir === 'left' ? 50 : -50)));
  }
  if (sm && sm.kind === 'chase' && side.runnerArea === nextId) {
    gameState.enemies.push(makeRunner(Math.min(next.width - 200, player.x + 200)));
  }
  gameState.spawnChecked = false;
  updateHUD();
  toast(next.name);
  missions.checkDelivery(nextId, toast, onProgress);
  // chance encounter on enter (only if still here and playing)
  setTimeout(() => {
    if (gameState.mode === 'play' && gameState.areaId === nextId) maybeSpawnEncounter(false);
  }, 300);
  persist();
  followCam.cut();
  return true;
}

function persist() {
  const payload = serializeSave({
    player, stateBag, gameState,
    outfitId: gameState.outfitId,
    areaId: gameState.areaId
  });
  return saveGame(payload);
}

function showEnding() {
  gameState.mode = 'ending';
  gameState.ended = true;
  $('ending-screen').classList.remove('hidden');
  $('ending-text').textContent = ENDING_TEXT;
  $('sequel-hooks').innerHTML = SEQUEL_HOOKS;
  $('interact-prompt').classList.add('hidden');
  persist();
  menuFocus(0);
}

function setOutfit(id, quiet = false) {
  if (!OUTFITS[id]) return;
  if (!stateBag.unlockedOutfits.has(id)) {
    sfx('denied');
    toast('Outfit locked — find collectibles');
    return;
  }
  if (!quiet && id !== gameState.outfitId) sfx('outfit');
  gameState.outfitId = id;
  clearSpriteCache();
  clearHeroCache();
  // replace (not queue behind) an earlier outfit toast so rapid picker / L1-R1 changes stay current
  for (let i = toastQueue.length - 1; i >= 0; i--) if (toastQueue[i].startsWith('Outfit: ')) toastQueue.splice(i, 1);
  const tEl = $('toast');
  toast(`Outfit: ${OUTFITS[id].name}`, !tEl.classList.contains('hidden') && tEl.textContent.startsWith('Outfit: '));
  updateOutfitButton();
  updateHUD();
  persist();
}

/** Next/previous unlocked outfit (L1/R1 · LB/RB, pause-menu Outfit button). */
function cycleOutfit(dir = 1) {
  const owned = OUTFIT_ORDER.filter((id) => stateBag.unlockedOutfits.has(id));
  if (owned.length < 2) { toast('Find collectibles to unlock more outfits'); return; }
  const i = Math.max(0, owned.indexOf(gameState.outfitId));
  setOutfit(owned[(i + dir + owned.length) % owned.length]);
}
function updateOutfitButton() {
  const b = $('btn-outfit');
  if (!b) return;
  const n = OUTFIT_ORDER.filter((id) => stateBag.unlockedOutfits?.has(id)).length;
  b.textContent = `Outfits: ${(OUTFITS[gameState.outfitId] || OUTFITS.polo).name} ▸ (${n}/${OUTFIT_ORDER.length})`;
}

// ---------- Visual outfit picker (pause → Outfits; js/outfits_menu.js) ----------
const outfitsMenu = createOutfitsMenu({
  state: () => ({ unlocked: stateBag.unlockedOutfits, current: gameState.outfitId, stateBag }),
  equip: (id) => setOutfit(id),
  areaName: (id) => (AREAS[id] ? AREAS[id].name : id),
  onClose: () => { // back to the pause menu, focus on the Outfits button
    if (gameState.mode !== 'pause') return;
    $('pause-screen').classList.remove('hidden');
    updateOutfitButton();
    const el = $('pause-screen');
    menuFocus(Math.max(0, menuButtons(el).indexOf($('btn-outfit'))), el);
    input.flush();
  }
});
function openOutfitPicker() {
  if (gameState.mode !== 'pause') return;
  $('pause-screen').classList.add('hidden');
  clearMenuFocus();
  input.flush();
  outfitsMenu.open(getPromptDevice());
}

// ---------- Menus (mouse / touch / keyboard / gamepad) ----------

/**
 * Reliable tap: fires on the first click or tap. Touch is handled on touchend (no ghost-click
 * delay, works with body touch-action:none); the follow-up emulated click is ignored.
 */
function bindTap(id, fn) {
  const el = $(id);
  if (!el) return;
  let lastTouch = -Infinity; // (0 would swallow clicks in the first 700ms after page load)
  el.addEventListener('touchend', (e) => {
    const t = e.changedTouches && e.changedTouches[0];
    if (t) {
      const hit = document.elementFromPoint(t.clientX, t.clientY);
      if (hit && !el.contains(hit)) return; // finger slid off the button
    }
    lastTouch = performance.now();
    if (e.cancelable) e.preventDefault();
    fn(e);
  }, { passive: false });
  el.addEventListener('click', (e) => {
    if (performance.now() - lastTouch < 700) return;
    fn(e);
  });
}

/** Run now if assets are loaded, otherwise as soon as boot finishes (no lost first click). */
function whenReady(fn) {
  if (booted) fn();
  else { pendingAction = fn; toast('Loading Star City…'); }
}

function activeMenuEl() {
  for (const id of ['confirm-screen', 'ending-screen', 'pause-screen', 'title-screen']) {
    const el = $(id);
    if (el && !el.classList.contains('hidden')) return el;
  }
  return null;
}
function menuButtons(el) {
  return [...el.querySelectorAll('button')].filter((b) => !b.classList.contains('hidden') && b.offsetParent !== null);
}
let menuIdx = 0;
let menuElLast = null;
function clearMenuFocus() {
  document.querySelectorAll('.pad-focus').forEach((b) => b.classList.remove('pad-focus'));
  menuElLast = null;
}
function menuFocus(i, el = activeMenuEl()) {
  if (!el) return;
  const btns = menuButtons(el);
  if (!btns.length) return;
  menuIdx = ((i % btns.length) + btns.length) % btns.length;
  document.querySelectorAll('.pad-focus').forEach((b) => b.classList.remove('pad-focus'));
  const b = btns[menuIdx];
  b.classList.add('pad-focus');
  try { b.focus({ preventScroll: true }); } catch (_) { /* old browsers */ }
  menuElLast = el;
}
/** D-pad / stick / arrows move focus, Cross/A/Enter confirm, Circle/B/Esc back. */
function handleMenu(inp) {
  const el = activeMenuEl();
  if (!el) return;
  if (el !== menuElLast) menuFocus(el.id === 'confirm-screen' ? 0 : 0, el);
  const btns = menuButtons(el);
  const cur = btns.indexOf(document.activeElement);
  if (cur >= 0 && cur !== menuIdx) menuFocus(cur, el);
  // audio sliders: left / right change the volume instead of moving focus
  if ((inp.navLeft || inp.navRight) && adjustFocusedSlider(inp.navRight ? 1 : -1)) { inp.navLeft = inp.navRight = false; }
  const inGameMenu = el.id !== 'title-screen'; // title.js plays its own menu blips
  if (inp.navUp || inp.navLeft) { menuFocus(menuIdx - 1, el); if (inGameMenu) sfx('ui_move'); }
  else if (inp.navDown || inp.navRight) { menuFocus(menuIdx + 1, el); if (inGameMenu) sfx('ui_move'); }
  if (inp.confirmPressed) {
    const b = menuButtons(el)[menuIdx];
    if (b && inGameMenu && !b.closest('.audio-settings')) sfx('ui_select');
    if (b) b.click();
    return;
  }
  if ((inp.backPressed || inp.pausePressed) && inGameMenu) sfx('ui_back');
  if (inp.backPressed || inp.pausePressed) {
    if (el.id === 'confirm-screen') closeConfirm();
    else if (el.id === 'pause-screen') resumeGame();
  }
}

function openConfirm() {
  $('confirm-screen').classList.remove('hidden');
  menuFocus(0, $('confirm-screen')); // default: Cancel
}
function closeConfirm() {
  $('confirm-screen').classList.add('hidden');
  menuFocus(0, $('title-screen'));
}

function pauseGame() {
  if (gameState.mode !== 'play') return;
  gameState.mode = 'pause';
  $('pause-screen').classList.remove('hidden');
  $('btn-save').textContent = 'Save Game';
  updateOutfitButton();
  updateDifficultyButton();
  renderMissionList();
  $('interact-prompt').classList.add('hidden');
  setPaused(true);
  menuFocus(0, $('pause-screen'));
}
function resumeGame() {
  if (gameState.mode !== 'pause') return;
  gameState.mode = 'play';
  setPaused(false);
  outfitsMenu.close(true);
  $('pause-screen').classList.add('hidden');
  clearMenuFocus();
  input.flush();
  input.focusGame();
}
function updateDifficultyButton() {
  const b = $('btn-difficulty');
  if (b) b.textContent = `Difficulty: ${getDifficulty().name} ▸`;
}
function cycleDifficulty() {
  const i = DIFFICULTY_ORDER.indexOf(gameState.difficulty);
  gameState.difficulty = DIFFICULTY_ORDER[(i + 1) % DIFFICULTY_ORDER.length];
  setDifficulty(gameState.difficulty);
  updateDifficultyButton();
  toast(`Difficulty: ${getDifficulty().name}${getDifficulty().arcade ? ' — no healing, KO = back to last save' : ''} (applies to new fights)`, true);
  persist();
}
const STATUS_LABEL = { done: 'Done ✓', active: 'Active', available: 'Available', locked: 'Locked' };
function renderMissionList() {
  const el = $('mission-list');
  if (!el) return;
  const all = Object.values(stateBag.missions || {});
  const row = (m) => {
    const st = missions.missionStatus(m.id);
    const who = npcDef(m.npc);
    return `<div class="mi" data-mission="${m.id}" data-status="${st}"><span>${m.title}<small> · ${who ? who.name.split(' ')[0] : ''}</small></span><span class="st ${st}">${STATUS_LABEL[st]}</span></div>`;
  };
  const done = all.filter((m) => m.done).length;
  el.innerHTML = `<div class="mh">MAIN STORY</div>${all.filter((m) => m.type === 'main').map(row).join('')}` +
    `<div class="mh">SIDE MISSIONS</div>${all.filter((m) => m.type === 'side').map(row).join('')}` +
    `<div class="mh">${done}/${all.length} missions · ${missions.collectCount()}/${missions.collectTotal()} collectibles · ${getDifficulty().name}</div>`;
}
function toggleMissionList() {
  const el = $('mission-list');
  renderMissionList();
  el.classList.toggle('hidden');
  $('btn-missions').textContent = el.classList.contains('hidden') ? 'Missions ▾' : 'Missions ▴';
}

/** Arcade knockout: game over, reload the last save at full health. */
function arcadeGameOver() {
  toast('GAME OVER — back to your last save', true);
  stateBag.side = null;
  gameState.mode = 'title';
  startGame(true);
  player.hp = player.maxHp;
  player.alive = true;
  setTimeout(() => toast('GAME OVER — back to your last save', true), 0);
  updateHUD();
}

let saveLabelTimer = null;
function manualSave() {
  const ok = persist();
  const btn = $('btn-save');
  btn.textContent = ok ? 'Saved ✓' : 'Save failed';
  clearTimeout(saveLabelTimer);
  saveLabelTimer = setTimeout(() => { btn.textContent = 'Save Game'; }, 1500);
  sfx(ok ? 'save' : 'denied');
  toast(ok ? 'Saved' : 'Save failed — storage unavailable', true);
}

// New Game -> (overwrite confirm) -> difficulty selector -> start
bindTap('btn-start', () => whenReady(() => title.openDifficulty()));
bindTap('btn-continue', () => whenReady(() => startGame(true)));
bindTap('btn-new-game', () => {
  if (hasSave()) openConfirm();
  else whenReady(() => title.openDifficulty());
});
bindTap('btn-confirm-yes', () => {
  $('confirm-screen').classList.add('hidden');
  whenReady(() => title.openDifficulty());
});
for (const id of DIFFICULTY_ORDER) {
  bindTap(`btn-diff-${id}`, () => whenReady(() => {
    if (gameState.mode !== 'title') return;
    clearSave(); // only reachable via New Game (with the overwrite confirm when a save exists)
    gameState.pendingDifficulty = id;
    startGame(false);
    toast(`Difficulty: ${DIFFICULTIES[id].name}`);
  }));
}
bindTap('btn-difficulty', () => cycleDifficulty());
bindTap('btn-missions', () => toggleMissionList());
bindTap('btn-confirm-no', () => closeConfirm());
bindTap('btn-resume', () => resumeGame());
bindTap('btn-save', () => manualSave());
bindTap('btn-outfit', () => openOutfitPicker()); // opens the visual picker (L1/R1 + 1-9/0/-/= still cycle in play)
bindTap('btn-pause', () => pauseGame()); // phone pause button (Save Game / outfits live there)
bindTap('btn-replay', () => {
  $('ending-screen').classList.add('hidden');
  clearMenuFocus();
  gameState.mode = 'play';
  input.flush();
  input.focusGame();
  toast('Keep roaming Star City');
});
bindTap('dialogue-next', () => advanceDialogue());
// Validate the save once up front (a corrupt / old-format save is quarantined, never fatal),
// then set the title buttons right away so a pre-boot click can't skip the New Game confirm.
const bootSaveState = inspectSave();
refreshTitleButtons();
const title = createTitle({ focusMenu: (i) => menuFocus(i, $('title-screen')) });
// audio: Music / SFX sliders + mute at the bottom of the pause menu (same widget as the title Controls panel)
if ($('pause-screen')) mountAudioSettings($('pause-screen').querySelector('.overlay-card'));

/** Device-aware prompts in the DOM (interact kbd, pause/desktop hints, dialogue button). */
let promptSig = '';
function refreshPrompts(force) {
  const sig = getPromptDevice();
  if (!force && sig === promptSig) return;
  promptSig = sig;
  const L = getPromptLabel;
  const kbd = document.querySelector('#interact-prompt kbd');
  if (kbd) kbd.textContent = L('interact');
  const parts = [['move', 'move'], ['sprint', 'sprint'], ['punch', 'punch'], ['kick', 'kick'], ['special', 'Star Drive'], ['heavy', 'heavy'],
    ['interact', 'talk'], ['outfit', 'outfits'], ['pause', 'pause']];
  const hint = parts.filter(([a]) => L(a)).map(([a, w]) => `${L(a)} ${w}`).join(' · ');
  const pp = document.querySelector('#pause-screen p');
  if (pp) pp.textContent = sig === 'touch' ? hint : `${hint} · ${L('back')} resume`;
  const dh = $('desktop-hint');
  if (dh) dh.textContent = hint;
  updateDialogueButton();
}

// Resize canvas CSS already handles; keep internal res fixed

let last = performance.now();

function frame(now) {
  const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
  last = now;
  try {
    step(dt);
  } catch (err) {
    console.error('[frame]', err); // keep the loop alive; surfaced as a console error
  }
  requestAnimationFrame(frame);
}

/** audio: title / street / fight (crossfades in with a fight, out when the street is clear) / Silas. */
let fightHold = 0;
function syncMusic(dt) {
  const m = gameState.mode;
  setDialogueDuck(m === 'dialogue');
  if (m === 'title' || m === 'ending') { setMusic('title'); return; }
  if (gameState.bossActive) { setMusic('boss'); return; }
  if (gameState.combatLock && hostilesAlive()) fightHold = stateBag.side ? 2.5 : 0.05; // side-mission waves have gaps
  else if (m === 'play') fightHold -= dt;
  setMusic(fightHold > 0 ? 'fight' : 'street');
}

const pressBuffer = {};
function step(dt) {
  tickToast(dt);
  const inp = input.poll();
  refreshPrompts();
  syncMusic(dt);

  if (gameState.mode === 'title') {
    if (!title.update(inp, dt)) handleMenu(inp);
    drawTitleBg(dt);
    return;
  }
  if (gameState.mode === 'pause' && outfitsMenu.isOpen()) {
    outfitsMenu.update(inp, getPromptDevice());
    drawWorld(0);
    return;
  }
  if (gameState.mode === 'pause' || gameState.mode === 'ending') {
    handleMenu(inp);
    drawWorld(0);
    return;
  }
  if (inp.pausePressed && gameState.mode === 'play') {
    pauseGame();
    drawWorld(0);
    return;
  }

  if (inp.outfitKey) {
    const k = inp.outfitKey;
    const id = OUTFIT_ORDER[k in OUTFIT_HOTKEYS ? OUTFIT_HOTKEYS[k] : Number(k) - 1];
    if (id) setOutfit(id);
  }
  if (inp.outfitCycle && gameState.mode === 'play') cycleOutfit(inp.outfitCycle);

  if (gameState.mode === 'dialogue') {
    if (inp.backPressed) finishDialogue();                       // Circle/B/Esc: close
    else if (inp.interactPressed || inp.confirmPressed) advanceDialogue(); // E/Enter/Cross/A/Square
    drawWorld(dt);
    return;
  }

  // PLAY
  gameState.playTime += dt;
  if (DEBUG && gameState.god) player.hp = player.maxHp;
  if (!player.alive && player.koT > 0) {
    // v3: hold the KO pose briefly before the respawn / game over
    if (!player.koSting) { player.koSting = true; sting('gameover'); }
    updatePlayer(player, inp, dt, AREAS[gameState.areaId].width);
    for (const e of gameState.enemies) if (!e.runner) updateEnemy(e, player, dt, AREAS[gameState.areaId].width);
    drawWorld(dt);
    return;
  }
  if (!player.alive && getDifficulty().arcade) {
    arcadeGameOver();
    return;
  }
  if (!player.alive) {
    if (stateBag.side) failSide('Matthew got knocked down — mission failed.');
    const lostBoss = gameState.bossActive;
    player.hp = player.maxHp;
    player.alive = true;
    player.kd = null; player.koT = 0; player.lift = 0; player.invuln = 1; player.koSting = false;
    player.x = 200;
    gameState.enemies = [];
    gameState.combatLock = false;
    gameState.bossActive = false;
    gameState.areaId = 'downtown';
    syncDepthBand();
    player.y = PLAYER_START_Y;
    followCam.cut();
    toast('Matthew dusts himself off…');
    if (lostBoss) toast('Silas is still downtown. Talk to him to try again.');
    updateHUD();
    persist();
  }

  const area = AREAS[gameState.areaId];

  // v3: attack presses made during a hit-stop freeze are buffered, not dropped
  const BUFFERED = ['punchPressed', 'kickPressed', 'heavyPressed', 'specialPressed'];
  if (gameState.hitStop > 0) {
    gameState.hitStop -= dt;
    for (const k of BUFFERED) if (inp[k]) pressBuffer[k] = true;
  } else {
    for (const k of BUFFERED) if (pressBuffer[k]) { inp[k] = true; pressBuffer[k] = false; }
    updatePlayer(player, inp, dt, area.width, {
      outfit: gameState.outfitId,
      canSpecial: () => gameState.special >= SPECIAL_COST,
      onSpecial: () => { gameState.special = Math.max(0, gameState.special - SPECIAL_COST); gameState.hitStop = 0; rumble(0.6, 0.6, 160); followCam.kick(3); },
      onSpecialDenied: (why) => { sfx('denied'); if (why === 'meter') toast(`Star Drive needs ${SPECIAL_COST}% special meter`); }
    });
    for (const e of gameState.enemies) {
      if (e.runner) updateRunner(e, dt, area);
      else updateEnemy(e, e.target ? sideTarget(e) : player, dt, area.width);
    }
    resolveHits(player, gameState.enemies,
      (e) => {
        gameState.hitStop = e.kd ? 0.07 : 0.04;
        gameState.special = Math.min(100, gameState.special + 4);
        if (!e.alive) gameState.score += e.scoreValue || 100;
        rumble(0.25, 0.45, 60);
        followCam.kick(e.kd ? 3.5 : 2);
      },
      (dmg, knocked) => {
        if (stateBag.side && stateBag.side.id === 'side_spar') stateBag.side.hits++;
        rumble(knocked ? 1 : 0.8, 0.5, knocked ? 260 : 140); updateHUD();
        followCam.kick(knocked ? 5 : 3.5);
      },
      area.width
    );
    if (stateBag.side && stateBag.side.id === 'side_spar') {
      for (const e of gameState.enemies) if (e.sparring && !e.alive && !e.counted) { e.counted = true; stateBag.side.kos++; }
    }
    gameState.enemies = gameState.enemies.filter((e) => e.alive || e.stun > 0 || e.koT > 0 || (e.runner && sideMission()));
    if (gameState.combatLock && !hostilesAlive()) {
      gameState.combatLock = false;
      gameState.enemies = [];
      if (gameState.bossActive) {
        // Silas is down: story complete → good ending
        gameState.bossActive = false;
        if (gameState.difficulty === 'hard' || gameState.difficulty === 'arcade') stateBag.beatHard = true;
        sting('victory_big');
        toast('Silas Boone backs off.');
        missions.completeMission('main4', toast, onProgress);
        if (!gameState.ended) showEnding();
      } else if (!stateBag.side) {
        toast('Street clear!');
        heal(15);
        sting('victory');
        if (player.alive && !player.kd) { player.victoryT = 1.6; player.idleT = 0; voice('matthew', 'victory', { delay: 0.25 }); } // victory pose
      }
    }
    if (gameState.mode === 'play') updateSide(dt);
  }
  if (gameState.mode !== 'play') { drawWorld(0); return; }

  // Area transitions at edges
  if (!gameState.combatLock) {
    if (player.x <= 35 && area.leftTo) transitionArea('left');
    else if (player.x >= area.width - 35 && area.rightTo) transitionArea('right');
  }

  if (inp.interactPressed) tryInteract();
  if (gameState.mode !== 'play') { drawWorld(dt); return; }

  // Auto pickup nearby collectibles (autosaves; outfit pickups are worn right away)
  checkStealthSpots(); // 1.3.2: hidden Hell's Nightmare helmet reveals itself up close
  collectHere();

  // Interact prompt
  const npc = nearestNPC();
  if (npc && !(gameState.combatLock && hostilesAlive())) {
    $('interact-prompt').classList.remove('hidden');
    $('interact-text').textContent = `Talk to ${npc.name}`;
  } else {
    $('interact-prompt').classList.add('hidden');
  }

  // Camera — eased follow, see CAMERA in camera.js. Drawn from drawWorld so
  // pause / dialogue hold or settle with the same lens. The crop lives in
  // present.js and does not touch the DOM HUD.

  // Autosave
  gameState.saveTimer += dt;
  if (gameState.saveTimer > 8 && !(getDifficulty().arcade && hostilesAlive())) { // Arcade: last save = pre-fight checkpoint
    gameState.saveTimer = 0;
    persist();
  }

  updateHUD();
  drawWorld(dt);
}

/** Where the minimap should point: active mission NPC, or delivery target. */
function currentDestination() {
  const sm = sideMission();
  if (sm) {
    if (sm.kind === 'escort') return { areaId: sm.dest, x: null };
    if (sm.kind === 'chase') return { areaId: stateBag.side.runnerArea || sm.area, x: null };
    if (sm.kind === 'fetch') {
      const it = sm.items.find((k) => !stateBag.fetchItems.includes(k.id));
      const n = npcDef(it ? it.npc : sm.npc);
      return { areaId: n.area, x: n.x };
    }
    return { areaId: sm.area, x: null };
  }
  if (stateBag.deliveryActive && stateBag.deliveryTarget) {
    return { areaId: stateBag.deliveryTarget.area, x: null };
  }
  const m = missions.getActive();
  if (!m || !m.npc) return null;
  const npc = NPC_DEFS.find((n) => n.id === m.npc);
  return npc ? { areaId: npc.area, x: npc.x } : null;
}

const NPC_DRAW_W = 64; // matches drawSprite() draw width (3:4 character frames) — NPCs/enemies (Joe's sprites)
const CHAR_DRAW_W = USE_HERO_RENDER ? HERO_SHADOW_W : Math.round(NPC_DRAW_W * PLAYER_SCALE); // player shadow width (hero has a wider, taller stance)

/**
 * Draw scales for Joe's v3 cast (144x192 frames, feet on row 189) relative to the 64x84 base.
 * Draw only — hitboxes are unchanged. Thugs are drawn taller in-frame than Matthew, so 1.2 reads
 * the same height as Matthew at PLAYER_SCALE 1.3; Silas (bigger build) stays ~17% taller.
 */
const THUG_SCALE = 1.2;
const NPC_SCALE = 1.2;
const BOSS_SCALE = 1.4; // Silas as the boss and as the pre-fight NPC (same person, same size)
const castScaleNpc = (id) => (id === 'silas' ? BOSS_SCALE : NPC_SCALE);
const castScaleEnemy = (e) => (e.isBoss ? BOSS_SCALE : THUG_SCALE);

/** Any cast frame at `scale`, feet on feetY (same footPad rule as drawMatthew). Returns draw height. */
function drawCastSprite(spr, x, feetY, facing, scale) {
  if (!spr) return 0;
  const dw = Math.round(64 * scale), dh = Math.round(84 * scale);
  const footPad = spr.height >= 192 ? Math.round(dh * (3 / 192)) : 0;
  const top = feetY - dh + footPad;
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  if (facing < 0) {
    ctx.translate(Math.round(x), 0);
    ctx.scale(-1, 1);
    ctx.drawImage(spr, -dw / 2, top, dw, dh);
  } else {
    ctx.drawImage(spr, Math.round(x - dw / 2), top, dw, dh);
  }
  ctx.restore();
  return dh - footPad;
}

/**
 * Nametag top y: above the head unless that covers a painted shop sign / street label
 * (world.js getSignRects); then hop above the sign, or drop under the feet if that would
 * run into the top HUD band.
 */
function nametagY(sx, tw, ty0, feetY, camFrame) {
  const rects = getSignRects(gameState.areaId);
  const x0 = sx - tw / 2 - 2, x1 = sx + tw / 2 + 2;
  // The location plaque is screen-space DOM. In the cropped lens, its band
  // starts at the top of the visible source rect, not at scene y = 0.
  const zoom = camFrame && camFrame.zoom > 0 ? camFrame.zoom : 1;
  const topLimit = Math.round((camFrame ? camFrame.y : 0) + 64 / zoom);
  let ty = ty0;
  for (let pass = 0; pass < 4; pass++) {
    const hit = rects.find((r) => r.x < x1 && r.x + r.w > x0 && r.y < ty + 30 && r.y + r.h > ty - 2);
    if (!hit) return ty;
    ty = Math.round(hit.y - 32);
    if (ty < topLimit) return feetY + 6; // would sit under the location plaque / combat banner
  }
  return feetY + 6;
}

/** Scaled replacement for combat.js drawEnemy (same sprite lookup, flash + HP pip above the head). */
function drawEnemyCast(e, cam) {
  const pose = e.pose === 'chase' ? 'walk' : e.pose;
  const spr = getEnemySprite(pose, e.color, e.animT, e.isBoss);
  const sx = e.x - cam;
  if (e.invulnFlash || (e.invuln > 0 && Math.floor(performance.now() / 80) % 2)) ctx.globalAlpha = 0.5;
  // >>> v3 anim states (game-logic lane): Joe's getAnimFrame when present, else the old sheet (+ lie-down tilt)
  const af = animFrame(enemyCharKey(e), e.animState, animMs(e));
  let h = 0;
  if (af) h = drawAnimFrame(af, sx, e.y, e.facing, castScaleEnemy(e));
  else withLie(e, sx, e.y, () => { h = drawCastSprite(spr, sx, e.y, e.facing, castScaleEnemy(e)); });
  // <<< v3
  ctx.globalAlpha = 1;
  if (e.hp < e.maxHp && e.alive) {
    const pw = e.isBoss ? 44 : 32, py = Math.round(e.y - h * 0.92) - 6;
    ctx.fillStyle = '#2a2a30';
    ctx.fillRect(sx - pw / 2, py, pw, 4);
    ctx.fillStyle = e.isBoss ? '#e74c3c' : '#2ecc71';
    ctx.fillRect(sx - pw / 2, py, pw * Math.max(0, e.hp / e.maxHp), 4);
  }
}

// Draw-side pose clock so punch/kick frames start at the wind-up (player.animT never resets).
let heroPoseName = null;
let heroPoseStartT = 0;
function heroPoseTime(p) {
  if (p.pose !== heroPoseName) { heroPoseName = p.pose; heroPoseStartT = p.animT; }
  return (p.pose === 'punch' || p.pose === 'kick' || p.pose === 'hurt') ? p.animT - heroPoseStartT : p.animT;
}

/** Draw Matthew with whichever renderer is active (feet at feetY, centred on x). */
function drawMatthew(pose, outfitId, outfit, t, x, feetY, facing) {
  if (USE_HERO_RENDER) {
    drawHero(ctx, getHeroFrame(pose, outfitId, outfit, t), x, feetY, facing, HERO_DRAW_H);
  } else {
    const spr = getMatthewSprite(pose, outfitId, outfit, t);
    if (!spr) return;
    // Draw Joe's 144x192 frame at heroic scale; v3 feet sit on row 189 of 192, so anchor that row to feetY
    const dw = Math.round(64 * PLAYER_SCALE), dh = Math.round(84 * PLAYER_SCALE);
    const footPad = spr.height >= 192 ? Math.round(dh * (3 / 192)) : 0;
    const top = feetY - dh + footPad;
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    if (facing < 0) {
      ctx.translate(Math.round(x), 0);
      ctx.scale(-1, 1);
      ctx.drawImage(spr, -dw / 2, top, dw, dh);
    } else {
      ctx.drawImage(spr, Math.round(x - dw / 2), top, dw, dh);
    }
    ctx.restore();
  }
}

// >>> v3 anim draw helpers (game-logic lane; draw-only, used by the marked blocks in drawWorld)
/** Draw a getAnimFrame() slice: frame-x anchorX on the actor's x, row feetRow on feetY; a 192-row
 *  frame maps to the same 84*scale body height as the sheets (wide/tall frames just extend out). */
function drawAnimFrame(f, x, feetY, facing, scale) {
  const k = (84 * scale) / 192;
  const ax = f.anchorX != null ? f.anchorX : f.sw / 2;
  const feet = f.feetRow != null ? f.feetRow : (f.sh >= 192 ? f.sh - 3 : f.sh);
  const dw = Math.round(f.sw * k), dh = Math.round(f.sh * k);
  const top = Math.round(feetY - feet * k);
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.translate(Math.round(x), 0);
  if (facing < 0) ctx.scale(-1, 1);
  ctx.drawImage(f.img, f.sx, f.sy, f.sw, f.sh, -Math.round(ax * k), top, dw, dh);
  ctx.restore();
  return Math.round(feet * k);
}
/** Fallback knockdown look (no art yet): tip the old frame over around the feet. */
function lieAmount(ent) {
  const k = ent.kd;
  if (k) return k.phase === 'fall' ? Math.min(1, 1 - k.t / 0.35) : k.phase === 'ground' ? 1 : Math.max(0, k.t / 0.4);
  return ent.alive ? 0 : 1;
}
function withLie(ent, x, feetY, fn) {
  const amt = lieAmount(ent);
  if (!amt) { fn(); return; }
  const dir = ent.kd ? ent.kd.dir : -ent.facing || 1;
  ctx.save();
  ctx.translate(x, feetY);
  ctx.rotate(dir * (Math.PI / 2) * amt);
  ctx.translate(-x, -feetY + 6 * amt);
  fn();
  ctx.restore();
}
/** Small stamina bar under Matthew's feet while it's refilling (orange = empty/locked). */
function drawStaminaPip(x, feetY) {
  const w = 40, y = Math.round(feetY + 8);
  ctx.fillStyle = 'rgba(10,14,24,0.7)';
  ctx.fillRect(Math.round(x - w / 2) - 1, y - 1, w + 2, 5);
  ctx.fillStyle = player.staminaLock ? '#e67e22' : '#4fd1ff';
  ctx.fillRect(Math.round(x - w / 2), y, Math.round(w * player.stamina / 100), 3);
}
/**
 * Collectible as the actual item: Joe's getCollectibleSprite(id, tMs) → {img,sx,sy,sw,sh,anchorX,anchorY}
 * drawn 1:1 at its anchor (the frames carry their own bob), over a soft pulsing glow + ground shadow.
 * Falls back to the old yellow dot when the helper or that item's art isn't there yet.
 */
function drawCollectibleItem(c, x, y) {
  const now = performance.now();
  let f = null;
  try { f = typeof SpriteLib.getCollectibleSprite === 'function' ? SpriteLib.getCollectibleSprite(c.id, now) : null; } catch (_) { f = null; }
  const vis = stealthVis(c); // 1.3.2: hidden (stealth) items are faint + unlabelled until Matthew is close
  if (vis <= 0) return;
  if (vis < 1) { ctx.save(); ctx.globalAlpha = vis; }
  if (!f || !f.img || !f.sw || !f.sh) { drawCollectible(ctx, x, y, c.name, now / 200); if (vis < 1) ctx.restore(); return; }
  const ax = f.anchorX != null ? f.anchorX : f.sw / 2, ay = f.anchorY != null ? f.anchorY : f.sh - 1;
  const dx = Math.round(x - ax), dy = Math.round(y - 4 - ay);
  const cy = dy + f.sh / 2;
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.beginPath(); ctx.ellipse(x, y - 2, 13, 4, 0, 0, Math.PI * 2); ctx.fill();
  const pulse = (0.55 + 0.25 * Math.sin(now / 330 + c.x)) * (vis < 1 ? 0.3 : 1);
  const g = ctx.createRadialGradient(x, cy, 2, x, cy, 32);
  g.addColorStop(0, `rgba(255,224,120,${0.5 * pulse})`); g.addColorStop(1, 'rgba(255,224,120,0)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, cy, 32, 0, Math.PI * 2); ctx.fill();
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(f.img, f.sx || 0, f.sy || 0, f.sw, f.sh, dx, dy, f.sw, f.sh);
  ctx.restore();
  if (vis < 1) { ctx.restore(); return; } // no name tag until it's been spotted
  ctx.fillStyle = '#fff'; ctx.font = '9px sans-serif'; ctx.textAlign = 'center';
  ctx.fillText(c.name, x, dy - 4); ctx.textAlign = 'left';
}
// <<< v3


function syncCamera(dt) {
  const area = AREAS[gameState.areaId];
  const frame = followCam.update({
    playerX: player.x,
    facing: player.facing,
    areaWidth: area.width,
    areaId: gameState.areaId,
    screenW: W,
    screenH: H,
    dt
  });
  gameState.cameraX = frame.x;
  return frame;
}

function drawWorld(dt) {
  const area = AREAS[gameState.areaId];
  const camFrame = syncCamera(dt);
  const cam = camFrame.x;
  const viewW = camFrame.viewW;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, W, H);
  drawBackground(ctx, area, cam, viewW, H, dt); // dt drives the ambient sedan (0 = frozen while paused)

  // Collectibles
  for (const c of stateBag.collectibles) {
    if (c.taken || c.area !== gameState.areaId) continue;
    drawCollectibleItem(c, c.x - cam, collectY()); // v3: Joe's item art with bob + glow, dot fallback
  }

  // Sort draw by depth (y)
  const drawList = [];
  for (const n of npcsInArea()) {
    drawList.push({ type: 'npc', y: npcFeetY(), n });
  }
  for (const e of gameState.enemies) {
    if (e.alive || e.stun > 0 || e.koT > 0) drawList.push({ type: 'enemy', y: e.y, e });
  }
  drawList.push({ type: 'player', y: player.y });
  drawList.sort((a, b) => a.y - b.y);

  // Ground shadows first so no character's shadow overlaps another's body
  for (const item of drawList) {
    if (item.type === 'npc') drawGroundShadow(ctx, item.n.x - cam, item.y, NPC_DRAW_W * castScaleNpc(item.n.id));
    else if (item.type === 'enemy') drawGroundShadow(ctx, item.e.x - cam, item.e.y, NPC_DRAW_W * castScaleEnemy(item.e), item.e.alive ? 0.42 : 0.25);
    else drawGroundShadow(ctx, player.x - cam, player.y, CHAR_DRAW_W);
  }

  for (const item of drawList) {
    if (item.type === 'npc') {
      const n = item.n;
      const spr = getNpcSprite(n.id, n.color, performance.now() / 1000);
      const sx = n.x - cam;
      // >>> v3 anim states: talk while in dialogue with this NPC, idle_personality otherwise
      const nState = gameState.mode === 'dialogue' && gameState.dialogueNpc === n ? 'talk' : 'idle_personality';
      const naf = animFrame(n.id, nState, performance.now());
      const nh = naf ? drawAnimFrame(naf, sx, item.y, 1, castScaleNpc(n.id)) : drawCastSprite(spr, sx, item.y, 1, castScaleNpc(n.id));
      // <<< v3
      // nametag (sits just above the scaled frame; ty = tag top)
      ctx.font = 'bold 11px sans-serif';
      const tw = Math.max(ctx.measureText(n.name).width, (ctx.font = '9px sans-serif', ctx.measureText(n.role).width)) + 14;
      const ty = nametagY(sx, tw, Math.round(item.y - nh - 30), item.y, camFrame);
      ctx.fillStyle = 'rgba(14,10,6,0.82)';
      ctx.fillRect(sx - tw / 2, ty, tw, 28);
      ctx.strokeStyle = 'rgba(255,210,74,0.7)';
      ctx.lineWidth = 1;
      ctx.strokeRect(sx - tw / 2 + 0.5, ty + 0.5, tw - 1, 27);
      ctx.fillStyle = '#ffd24a';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(n.name, sx, ty + 12);
      ctx.fillStyle = '#e8dcc4';
      ctx.font = '9px sans-serif';
      ctx.fillText(n.role, sx, ty + 24);
      ctx.textAlign = 'left';
    } else if (item.type === 'enemy') {
      drawEnemyCast(item.e, cam);
    } else if (item.type === 'player') {
      const outfit = OUTFITS[gameState.outfitId] || OUTFITS.polo;
      let pose = player.pose;
      if (player.invuln > 0 && Math.floor(performance.now() / 80) % 2) ctx.globalAlpha = 0.4;
      const t = USE_HERO_RENDER ? heroPoseTime(player) : player.animT;
      // >>> v3 anim states (game-logic lane): getAnimFrame('matthew', state) when the art exists, else the
      // old sheet with fallbacks: jump-kick lift, Star Drive afterimages, faster sprint cycle, lie-down tilt
      const px = player.x - cam;
      const maf = USE_HERO_RENDER ? null : animFrame('matthew', player.animState, animMs(player), gameState.outfitId);
      if (player.attackType === 'special') {
        const a0 = ctx.globalAlpha;
        for (let i = 3; i >= 1; i--) {
          ctx.globalAlpha = 0.16 * (4 - i);
          if (maf) drawAnimFrame(maf, px - player.facing * 20 * i, player.y, player.facing, PLAYER_SCALE);
          else drawMatthew(pose, gameState.outfitId, outfit, t, px - player.facing * 20 * i, player.y, player.facing);
        }
        ctx.globalAlpha = a0;
        ctx.fillStyle = 'rgba(255,210,74,0.35)';
        ctx.fillRect(Math.min(px, px - player.facing * 80), player.y - 62, 80, 6);
        ctx.fillRect(Math.min(px, px - player.facing * 60), player.y - 40, 60, 4);
      }
      if (maf) drawAnimFrame(maf, px, player.y, player.facing, PLAYER_SCALE);
      else {
        const tt = player.sprinting ? t * 1.6 : t;
        withLie(player, px, player.y, () => drawMatthew(pose, gameState.outfitId, outfit, tt, px, player.y - (player.lift || 0), player.facing));
      }
      ctx.globalAlpha = 1;
      if (player.stamina < 100 && player.alive) drawStaminaPip(px, player.y);
      // <<< v3
    }
  }

  // Shared golden-hour light over characters too (lens width, full plate height)
  drawSceneGrade(ctx, area, viewW, H);

  // HUD minimap (DOM canvas, not the game canvas)
  drawMinimap($('minimap'), {
    areaId: gameState.areaId,
    playerX: player.x,
    areaWidth: area.width,
    facing: player.facing,
    dest: currentDestination()
  });

  // Combat banner — DOM element sits under the location plaque (no overlap)
  const fighting = gameState.combatLock && hostilesAlive();
  const banner = $('combat-banner');
  if (banner) banner.classList.toggle('hidden', !fighting);

  presenter.present({
    mode: 'world',
    cameraY: camFrame.y,
    viewW: camFrame.viewW,
    viewH: camFrame.viewH
  });
}

/** Title backdrop: animated Roanoke skyline (title.js) + Matthew heroic idle vs a Silas silhouette. */
function drawTitleBg(dt) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  ctx.imageSmoothingEnabled = false;
  title.drawBackdrop(ctx, W, H, dt);
  const t = performance.now() / 1000;
  const feetY = 512;
  // Silas: big rim-lit silhouette on the right, facing Matthew
  const sil = title.silhouette(getNpcSprite('silas', '#2c3e50', t));
  if (sil) {
    ctx.save();
    ctx.globalAlpha = 0.92;
    drawGroundShadow(ctx, W * 0.78, feetY, 120);
    drawCastSprite(sil, W * 0.78, feetY, -1, BOSS_SCALE * 1.55);
    ctx.restore();
  }
  // Matthew (locked look) at heroic scale, left
  const mx = W * 0.22;
  drawGroundShadow(ctx, mx, feetY, CHAR_DRAW_W * 1.5);
  ctx.save();
  ctx.translate(mx, feetY); ctx.scale(1.5, 1.5); ctx.translate(-mx, -feetY);
  drawMatthew('idle', 'polo', OUTFITS.polo, t, mx, feetY, 1);
  ctx.restore();
  title.drawGrade(ctx, W, H);
  presenter.present({ mode: 'full' });
}

// >>> v3 PWA auto-update: check on launch / focus / reconnect; when a new service worker takes over,
// restart right away on the title screen, otherwise toast and restart next time the title shows.
let updateReady = false;
function applyUpdate() {
  updateReady = false;
  toast('New version — restarting…', true);
  setTimeout(() => location.reload(), 900);
}
/** Desktop (app://) and Android (Capacitor) shells: they serve the live GitHub Pages build and answer
 *  /__live-version; a newer build is picked up on reload, so restart on the title screen. */
function initShellUpdate() {
  let lastCheck = 0, flagged = false;
  const check = () => {
    if (flagged || Date.now() - lastCheck < 30000) return;
    lastCheck = Date.now();
    fetch('__live-version', { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)).then((v) => {
      if (!v || !v.latest || v.latest === v.current || flagged) return;
      flagged = true;
      if (gameState.mode === 'title') applyUpdate();
      else { updateReady = true; toast('New version downloaded — it loads next time you’re on the title screen'); }
    }).catch(() => {});
  };
  window.addEventListener('focus', check);
  window.addEventListener('online', check);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') check(); });
  setInterval(check, 20 * 60 * 1000);
}
function initAutoUpdate() {
  if (location.protocol === 'app:' || (window.Capacitor && location.hostname === 'localhost')) { initShellUpdate(); return; }
  if (!('serviceWorker' in navigator) || !/^https?:$/.test(location.protocol) || window.Capacitor) return;
  const hadController = !!navigator.serviceWorker.controller; // first install also fires controllerchange
  let seen = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController || seen) return;
    seen = true;
    if (gameState.mode === 'title') applyUpdate();
    else { updateReady = true; toast('New version downloaded — it loads next time you’re on the title screen'); }
  });
  let lastCheck = 0;
  const check = () => {
    if (Date.now() - lastCheck < 10000) return;
    lastCheck = Date.now();
    navigator.serviceWorker.getRegistration().then((r) => r && r.update()).catch(() => {});
  };
  window.addEventListener('focus', check);
  window.addEventListener('online', check);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') check(); });
  setTimeout(check, 2500);                  // launch (index.html registers + updates too)
  setInterval(check, 20 * 60 * 1000);       // long sessions
}
initAutoUpdate();
// <<< v3

// Boot
async function boot() {
  toast('Loading Star City…');
  const saveState = bootSaveState;
  await Promise.all([loadSprites(), loadBackgrounds()]);
  $('toast').classList.add('hidden');
  gameState.toastTimer = 0;
  booted = true;
  showTitle();
  if (saveState.status === 'corrupt') toast('Save data was unreadable — it was set aside. Start a New Game.');
  else if (saveState.status === 'migrated') toast('Old save found and updated — press Continue');
  if (DEBUG) toast('DEBUG mode (window.__scd)');
  refreshPrompts(true);
  if (pendingAction) {
    const fn = pendingAction;
    pendingAction = null;
    fn();
  }
  if (input.isMobile()) $('desktop-hint').classList.add('hidden');
  // Pre-fill hearts
  updateHUD();
  requestAnimationFrame(frame);
  console.log("Star City Drift 2D — Beat'em Up ready (assets loaded)");
}

if (DEBUG) {
  const MAIN_ORDER = ['main1', 'main2', 'main3', 'main4'];
  window.__scd = {
    get gameState() { return gameState; },
    get stateBag() { return stateBag; },
    get player() { return player; },
    outfits: outfitsMenu,
    missions,
    input,
    depth: () => getDepthBand(),
    /** Move to an area (x, y optional). Clears any fight there. */
    warp(areaId, x = 200, y) {
      if (!AREAS[areaId]) throw new Error('unknown area ' + areaId);
      gameState.areaId = areaId;
      gameState.enemies = [];
      gameState.combatLock = false;
      gameState.bossActive = false;
      player.x = x;
      syncDepthBand();
      if (y != null) player.y = clampDepth(y);
      followCam.cut();
      gameState.areaVisitCombat[areaId] = (gameState.areaVisitCombat[areaId] || 0) + 1;
      updateHUD();
    },
    warpToNpc(id) {
      const n = NPC_DEFS.find((k) => k.id === id);
      if (!n) throw new Error('unknown npc ' + id);
      this.warp(n.area, n.x + 10);
    },
    /** Mark earlier main missions done and stand next to this mission's NPC. */
    jump(missionId) {
      const i = MAIN_ORDER.indexOf(missionId);
      if (i >= 0) {
        MAIN_ORDER.forEach((id, k) => { stateBag.missions[id].done = k < i; });
        stateBag.activeMissionId = missionId;
        stateBag.mainComplete = false;
        gameState.ended = false;
      }
      const m = stateBag.missions[missionId];
      if (m && m.npc) this.warpToNpc(m.npc);
      persist();
    },
    setDifficulty(id) { if (!DIFFICULTIES[id]) throw new Error('unknown difficulty ' + id); gameState.difficulty = id; setDifficulty(id); persist(); },
    difficulty: () => getDifficulty(),
    /** Fresh thug / Silas stat sample for the current difficulty. */
    sampleThug: (wave = 0) => { const e = createThug(0, 0, wave); return { hp: e.hp, dmg: e.dmg, speed: e.speed, cool: e.cool }; },
    sampleBoss: () => { const e = createSilasFighter(0, 0); return { hp: e.hp, dmg: e.dmg, speed: e.speed, cool: e.cool }; },
    get side() { return stateBag.side; },
    /** Stand next to a side mission's giver and accept it (prerequisites are marked done). */
    startSide(id) {
      const m = stateBag.missions[id];
      if (!m || !m.kind) throw new Error('not a v2 side mission ' + id);
      if (m.requires) stateBag.missions[m.requires].done = true;
      if (m.requires && m.requires.startsWith('main')) {
        for (const k of MAIN_ORDER) { stateBag.missions[k].done = true; if (k === m.requires) break; }
        const nx = MAIN_ORDER[MAIN_ORDER.indexOf(m.requires) + 1];
        stateBag.activeMissionId = nx || null;
      }
      this.warpToNpc(m.npc);
      startSide(m);
    },
    /** Skip time on the timed missions (survive / chase). */
    fastForward(sec) { if (stateBag.side && stateBag.side.t != null) stateBag.side.t -= sec; },
    collectAt(id) { const c = stateBag.collectibles.find((k) => k.id === id); if (!c) throw new Error('no ' + id); this.warp(c.home, c.x); },
    killAll() { for (const e of gameState.enemies) { e.hp = 0; e.alive = false; e.stun = 0; } },
    god(on = true) { gameState.god = !!on; },
    /** v3: knock an enemy (index) or Matthew ('player') down; anim API status. */
    knockDown(which = 0) { const t = which === 'player' ? player : gameState.enemies[which]; if (t) knockDown(t, t === player ? -player.facing : player.facing); return !!t; },
    animApiReady,
    setSpecial(v) { gameState.special = v; },
    audio: audioDebug,
    persist
  };
}
boot();
