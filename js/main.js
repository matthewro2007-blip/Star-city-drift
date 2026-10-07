import {
  AREAS, AREA_ORDER, drawBackground, drawMinimap, DEPTH, getDepth, loadBackgrounds,
  drawSceneGrade, drawGroundShadow, getSignRects
} from './world.js';
import { NPC_DEFS, OUTFITS, OUTFIT_ORDER } from './npcs.js';
import { createMissionSystem, SEQUEL_HOOKS, ENDING_TEXT } from './missions.js';
import { hasSave, clearSave, serializeSave, saveGame, inspectSave, applySave } from './save.js';
import { createInput, getPromptLabel, getPromptDevice, rumble } from './input.js';
import {
  createPlayer, updatePlayer, updateEnemy, resolveHits,
  drawEnemy, spawnWave, createSilasFighter, clampDepth, setDepthBand, getDepthBand
} from './combat.js';
import { getMatthewSprite, getNpcSprite, getEnemySprite, drawSprite, drawCollectible, clearSpriteCache, loadSprites, getHeartImages } from './sprites.js';
import { createTitle } from './title.js';
import { getHeroFrame, drawHero, clearHeroCache, HERO_DRAW_H, HERO_SHADOW_W } from './hero.js';

/** true: player + title Matthew use the high-res procedural hero (hero.js); false: Joe's matthew_sheet.png. */
const USE_HERO_RENDER = false; // Joe's approved v3 sheet ships; hero.js kept as an alternate renderer
const PLAYER_SCALE = 1.3; // heroic presentation scale for Matthew vs 64x84 NPCs (draw only; hitboxes unchanged)

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false;

const W = canvas.width;
const H = canvas.height;

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
  special: 40
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

function updateHUD() {
  const m = missions.getActive();
  $('mission-title').textContent = m ? m.title : 'Free Roam';
  $('mission-desc').textContent = m ? m.desc : (stateBag.deliveryActive ? 'Deliver to River Bridge' : 'Explore Star City');
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
}

function maybeSpawnEncounter(force) {
  if (gameState.mode !== 'play') return;
  const area = AREAS[gameState.areaId];
  if (!area.spawnCombat) return;
  if (gameState.enemies.some((e) => e.alive)) return;
  const visited = gameState.areaVisitCombat[gameState.areaId] || 0;
  if (!force && visited > 0 && Math.random() > area.combatChance) return;
  // Don't spawn on first moment at diner until after talking? Actually spawn street thugs elsewhere
  if (gameState.areaId === 'diner' && !stateBag.missions.main1.done && !force) return;
  if (gameState.areaId === 'star') return;

  const count = 2 + Math.min(3, gameState.wave);
  gameState.enemies = spawnWave(area, count, gameState.wave, player.x);
  gameState.combatLock = true;
  gameState.areaVisitCombat[gameState.areaId] = visited + 1;
  gameState.wave++;
  toast('Thugs! Clear the street!');
}

function npcsInArea() {
  // Silas is the boss while the fight is on, and he's gone after the ending.
  return NPC_DEFS.filter((n) => n.area === gameState.areaId &&
    !(n.id === 'silas' && (gameState.bossActive || stateBag.mainComplete)));
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
  const st = missions.npcStatus(npc.id);
  if (st === 'locked') return npc.waitLines || npc.lines;
  if (st === 'active') return npc.activeLines || npc.doneLines || npc.lines;
  if (st === 'done') return npc.doneLines || npc.lines;
  return npc.lines;
}

function startDialogue(npc) {
  const lines = linesFor(npc);
  gameState.mode = 'dialogue';
  gameState.dialogueNpc = npc;
  gameState.dialogue = lines;
  gameState.dialogueIdx = 0;
  $('dialogue').classList.remove('hidden');
  $('dialogue-name').textContent = `${npc.name} — ${npc.role}`;
  $('dialogue-text').textContent = lines[0];
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
    updateDialogueButton();
  }
}

function finishDialogue() {
  if (gameState.mode !== 'dialogue') return;
  const npc = gameState.dialogueNpc;
  $('dialogue').classList.add('hidden');
  $('dialogue-next').classList.remove('pad-focus');
  gameState.mode = 'play';
  gameState.dialogue = null;
  gameState.dialogueNpc = null;
  input.flush();
  input.focusGame();
  if (!npc) return;

  const m = missions.missionFor(npc.id);
  if (m) {
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
          if (gameState.mode === 'play' && gameState.areaId === areaId && !gameState.enemies.some((e) => e.alive)) {
            gameState.enemies = spawnWave(AREAS[gameState.areaId], 3, gameState.wave++, player.x);
            gameState.combatLock = true;
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
  toast('Silas wants a word — with fists.');
}

/** Progress happened (mission, collectible, outfit): refresh HUD and autosave. */
function onProgress() {
  updateHUD();
  persist();
}

function tryInteract() {
  if (gameState.combatLock && gameState.enemies.some((e) => e.alive)) {
    toast('Clear the thugs first!');
    return;
  }
  const npc = nearestNPC();
  if (npc) {
    startDialogue(npc);
    return;
  }
  // collectibles
  const got = missions.tryCollect(gameState.areaId, player.x, toast, onProgress);
  if (got && got.outfit) setOutfit(got.outfit);
  missions.checkDelivery(gameState.areaId, toast, onProgress);
}

function transitionArea(dir) {
  if (gameState.combatLock && gameState.enemies.some((e) => e.alive)) {
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
  gameState.spawnChecked = false;
  updateHUD();
  toast(next.name);
  missions.checkDelivery(nextId, toast, onProgress);
  // chance encounter on enter (only if still here and playing)
  setTimeout(() => {
    if (gameState.mode === 'play' && gameState.areaId === nextId) maybeSpawnEncounter(false);
  }, 300);
  persist();
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

function setOutfit(id) {
  if (!OUTFITS[id]) return;
  if (!stateBag.unlockedOutfits.has(id)) {
    toast('Outfit locked — find collectibles');
    return;
  }
  gameState.outfitId = id;
  clearSpriteCache();
  clearHeroCache();
  toast(`Outfit: ${OUTFITS[id].name}`);
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
  b.textContent = `Outfit: ${(OUTFITS[gameState.outfitId] || OUTFITS.polo).name} ▸ (${n}/${OUTFIT_ORDER.length})`;
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
  if (inp.navUp || inp.navLeft) menuFocus(menuIdx - 1, el);
  else if (inp.navDown || inp.navRight) menuFocus(menuIdx + 1, el);
  if (inp.confirmPressed) {
    const b = menuButtons(el)[menuIdx];
    if (b) b.click();
    return;
  }
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
  $('interact-prompt').classList.add('hidden');
  menuFocus(0, $('pause-screen'));
}
function resumeGame() {
  if (gameState.mode !== 'pause') return;
  gameState.mode = 'play';
  $('pause-screen').classList.add('hidden');
  clearMenuFocus();
  input.flush();
  input.focusGame();
}
let saveLabelTimer = null;
function manualSave() {
  const ok = persist();
  const btn = $('btn-save');
  btn.textContent = ok ? 'Saved ✓' : 'Save failed';
  clearTimeout(saveLabelTimer);
  saveLabelTimer = setTimeout(() => { btn.textContent = 'Save Game'; }, 1500);
  toast(ok ? 'Saved' : 'Save failed — storage unavailable', true);
}

bindTap('btn-start', () => whenReady(() => startGame(false)));
bindTap('btn-continue', () => whenReady(() => startGame(true)));
bindTap('btn-new-game', () => {
  if (hasSave()) openConfirm();
  else whenReady(() => startGame(false));
});
bindTap('btn-confirm-yes', () => {
  clearSave();
  $('confirm-screen').classList.add('hidden');
  whenReady(() => startGame(false));
});
bindTap('btn-confirm-no', () => closeConfirm());
bindTap('btn-resume', () => resumeGame());
bindTap('btn-save', () => manualSave());
bindTap('btn-outfit', () => cycleOutfit(1));
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

/** Device-aware prompts in the DOM (interact kbd, pause/desktop hints, dialogue button). */
let promptSig = '';
function refreshPrompts(force) {
  const sig = getPromptDevice();
  if (!force && sig === promptSig) return;
  promptSig = sig;
  const L = getPromptLabel;
  const kbd = document.querySelector('#interact-prompt kbd');
  if (kbd) kbd.textContent = L('interact');
  const parts = [['move', 'move'], ['punch', 'punch'], ['kick', 'kick'], ['heavy', 'heavy'],
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

function step(dt) {
  tickToast(dt);
  const inp = input.poll();
  refreshPrompts();

  if (gameState.mode === 'title') {
    if (!title.update(inp, dt)) handleMenu(inp);
    drawTitleBg(dt);
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
    const id = OUTFIT_ORDER[Number(inp.outfitKey) - 1];
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
  if (!player.alive) {
    const lostBoss = gameState.bossActive;
    player.hp = player.maxHp;
    player.alive = true;
    player.x = 200;
    gameState.enemies = [];
    gameState.combatLock = false;
    gameState.bossActive = false;
    gameState.areaId = 'downtown';
    syncDepthBand();
    player.y = PLAYER_START_Y;
    toast('Matthew dusts himself off…');
    if (lostBoss) toast('Silas is still downtown. Talk to him to try again.');
    updateHUD();
    persist();
  }

  const area = AREAS[gameState.areaId];

  if (gameState.hitStop > 0) {
    gameState.hitStop -= dt;
  } else {
    updatePlayer(player, inp, dt, area.width);
    for (const e of gameState.enemies) updateEnemy(e, player, dt, area.width);
    resolveHits(player, gameState.enemies,
      (e) => {
        gameState.hitStop = 0.04;
        gameState.special = Math.min(100, gameState.special + 4);
        if (!e.alive) gameState.score += e.scoreValue || 100;
        rumble(0.25, 0.45, 60);
      },
      () => { rumble(0.8, 0.5, 140); updateHUD(); },
      area.width
    );
    gameState.enemies = gameState.enemies.filter((e) => e.alive || e.stun > 0);
    if (gameState.combatLock && !gameState.enemies.some((e) => e.alive)) {
      gameState.combatLock = false;
      gameState.enemies = [];
      if (gameState.bossActive) {
        // Silas is down: story complete → good ending
        gameState.bossActive = false;
        toast('Silas Boone backs off.');
        missions.completeMission('main4', toast, onProgress);
        if (!gameState.ended) showEnding();
      } else {
        toast('Street clear!');
      }
    }
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
  const got = missions.tryCollect(gameState.areaId, player.x, toast, onProgress);
  if (got && got.outfit) setOutfit(got.outfit);

  // Interact prompt
  const npc = nearestNPC();
  if (npc && !(gameState.combatLock && gameState.enemies.some((e) => e.alive))) {
    $('interact-prompt').classList.remove('hidden');
    $('interact-text').textContent = `Talk to ${npc.name}`;
  } else {
    $('interact-prompt').classList.add('hidden');
  }

  // Camera
  const camArea = AREAS[gameState.areaId];
  gameState.cameraX = Math.max(0, Math.min(camArea.width - W, player.x - W * 0.4));

  // Autosave
  gameState.saveTimer += dt;
  if (gameState.saveTimer > 8) {
    gameState.saveTimer = 0;
    persist();
  }

  updateHUD();
  drawWorld(dt);
}

/** Where the minimap should point: active mission NPC, or delivery target. */
function currentDestination() {
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
function nametagY(sx, tw, ty0, feetY) {
  const rects = getSignRects(gameState.areaId);
  const x0 = sx - tw / 2 - 2, x1 = sx + tw / 2 + 2;
  let ty = ty0;
  for (let pass = 0; pass < 4; pass++) {
    const hit = rects.find((r) => r.x < x1 && r.x + r.w > x0 && r.y < ty + 30 && r.y + r.h > ty - 2);
    if (!hit) return ty;
    ty = Math.round(hit.y - 32);
    if (ty < 64) return feetY + 6; // would sit under the location plaque / combat banner
  }
  return feetY + 6;
}

/** Scaled replacement for combat.js drawEnemy (same sprite lookup, flash + HP pip above the head). */
function drawEnemyCast(e, cam) {
  const pose = e.pose === 'chase' ? 'walk' : e.pose;
  const spr = getEnemySprite(pose, e.color, e.animT, e.isBoss);
  const sx = e.x - cam;
  if (e.invulnFlash) ctx.globalAlpha = 0.5;
  const h = drawCastSprite(spr, sx, e.y, e.facing, castScaleEnemy(e));
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

function drawWorld(dt) {
  const area = AREAS[gameState.areaId];
  const cam = gameState.cameraX;
  drawBackground(ctx, area, cam, W, H, dt); // dt drives the ambient sedan (0 = frozen while paused)

  // Collectibles
  for (const c of stateBag.collectibles) {
    if (c.taken || c.area !== gameState.areaId) continue;
    drawCollectible(ctx, c.x - cam, collectY(), c.name, performance.now() / 200);
  }

  // Sort draw by depth (y)
  const drawList = [];
  for (const n of npcsInArea()) {
    drawList.push({ type: 'npc', y: npcFeetY(), n });
  }
  for (const e of gameState.enemies) {
    if (e.alive || e.stun > 0) drawList.push({ type: 'enemy', y: e.y, e });
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
      const nh = drawCastSprite(spr, sx, item.y, 1, castScaleNpc(n.id));
      // nametag (sits just above the scaled frame; ty = tag top)
      ctx.font = 'bold 11px sans-serif';
      const tw = Math.max(ctx.measureText(n.name).width, (ctx.font = '9px sans-serif', ctx.measureText(n.role).width)) + 14;
      const ty = nametagY(sx, tw, Math.round(item.y - nh - 30), item.y);
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
      drawMatthew(pose, gameState.outfitId, outfit, t, player.x - cam, player.y, player.facing);
      ctx.globalAlpha = 1;
    }
  }

  // Shared golden-hour light over characters too
  drawSceneGrade(ctx, area, W, H);

  // HUD minimap (DOM canvas, not the game canvas)
  drawMinimap($('minimap'), {
    areaId: gameState.areaId,
    playerX: player.x,
    areaWidth: area.width,
    facing: player.facing,
    dest: currentDestination()
  });

  // Combat banner — DOM element sits under the location plaque (no overlap)
  const fighting = gameState.combatLock && gameState.enemies.some((e) => e.alive);
  const banner = $('combat-banner');
  if (banner) banner.classList.toggle('hidden', !fighting);
}

/** Title backdrop: animated Roanoke skyline (title.js) + Matthew heroic idle vs a Silas silhouette. */
function drawTitleBg(dt) {
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
}

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
    killAll() { for (const e of gameState.enemies) { e.hp = 0; e.alive = false; e.stun = 0; } },
    god(on = true) { gameState.god = !!on; },
    persist
  };
}
boot();
