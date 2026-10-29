import {
  AREAS, AREA_ORDER, drawBackground, drawMinimap, DEPTH, getDepth, loadBackgrounds,
  drawSceneGrade, drawGroundShadow, getSignRects, setStarDark, isPrisonArea, getSceneLights
} from './world.js';
import { drawWeather, cycleWeather, setWeather, weatherName, weatherShort, getWeather } from './weather.js'; // 1.7.0: Kody's Sunny / Night / Rainy (PR #20)
import { ARREST_COPS, ARREST_LINES, SENTENCING_CARD, PRISON_CARD, prisonOpen, prisonSpot, KEEPSAKE, SILAS_TREE, silasChoices } from './prison.js'; // 1.7.0 "Locked Up"
import { NPC_DEFS, OUTFITS, OUTFIT_ORDER, OUTFIT_HOTKEYS } from './npcs.js';
import { williamStageSpot } from './william.js'; // 2.0.2
import { updateWilliamAlly, williamAlly } from './william_ally.js'; // 2.0.3: William fights alongside (anim pass)
import { createMissionSystem, SEQUEL_HOOKS, ENDING_TEXT, STORY_INTRO } from './missions.js';
import { drawRainNight, drawLetterbox } from './rain.js'; // 1.6.0: rainy-night campaign
import { hasSave, clearSave, serializeSave, saveGame, inspectSave, applySave, saveSummary, makeNgPlusSave } from './save.js';
import { setNgPlus } from './combat.js'; // NG+ enemy scaling
import { createInput, getPromptLabel, getPromptDevice, rumble } from './input.js';
import {
  createPlayer, updatePlayer, updateEnemy, resolveHits,
  drawEnemy, spawnWave, createSilasFighter, clampDepth, setDepthBand, getDepthBand,
  createThug, setDifficulty, getDifficulty, DIFFICULTIES, DIFFICULTY_ORDER, SPECIAL_COST, knockDown,
  updateKits, getKitFx, getProjectiles, clearKitFx, slowMul, tickPull, specialTiming
} from './combat.js';
import { KITS, getKit, kitRow, PLAYER_DRAW_SCALE } from './kits.js'; // 1.4.0 outfit kits
import { animFrame, animMs, setAnim, enemyCharKey, animApiReady, strideClockMs } from './anim.js';
import * as SpriteLib from './sprites.js'; // optional newer helpers (getCollectibleSprite) without a hard import
import { getMatthewSprite, getNpcSprite, getEnemySprite, drawSprite, drawCollectible, clearSpriteCache, loadSprites, getHeartImages } from './sprites.js';
import { createTitle } from './title.js';
import { createOutfitsMenu } from './outfits_menu.js';
import { getHeroFrame, drawHero, clearHeroCache, HERO_DRAW_H, HERO_SHADOW_W } from './hero.js';
import { createFollowCamera, cycleZoom, getZoomLevel, setZoomLevel } from './camera.js'; // 1.9.0: zoom levels (window.sorZoom)
import { setVoiceHook, setSceneHooks, registerScene, playScene, skipScene, isScenePlaying, currentScene, updateScene, sceneActors, sceneLens, sceneFx, listScenes, getScene } from './scene_player.js'; // 1.9.0 scene player
import { setTrafficPaused } from './world.js'; // 1.9.0: ambient sedan holds during scenes
import { createPresenter, cheapPresentation } from './present.js';
import { talkLevel } from './audio.js'; // 1.9.0: mouth flaps follow the talk blips
import * as VO from './vo.js'; // VO-HOOK: voice-over (on demand)
import { setMusic, sting, setPaused, setDialogueDuck, sfx, voice, talk, stopTalk, adjustFocusedSlider, mountAudioSettings, audioDebug, setRainAmbience } from './audio.js';
// >>> DLC: Silas prequel (1.5.0) — shared Silas moveset, Silas's Suit art glue, prequel content + own save slot
import { silasWorld, coldStare, silasAnimMap, silasCooldowns } from './silas_moves.js';
import { artOutfitFor, suitAnimMap, suitNeedsTint, tintedFrame, tintedCanvas, suitPortraitSrc } from './silas_outfit.js';
import { createBlackriver, brHasRun, brCompleted } from './dlc_blackriver.js'; // 2.0.0 WIP: DLC 'Blackriver'
import { createDlc, dlcHasRun, dlcCompleted, silasPortraitSrc, silasPlayerKey, drawNightGrade, MISSIONS as DLC_MISSIONS } from './dlc_silas.js';
import { SILAS_MOVES, silasMoveRows } from './kits.js';
import { GAME_VERSION } from './version.js';
import { coop } from './coop/hooks.js'; // COOP-HOOK: 2.1.0 online co-op (js/coop/*, no-op when co-op is off)
import { updateBarks, drawBarks, drawBarksScreen, BARKS } from './barks.js'; // barks (Bob)
import './zoom_ui.js'; // zoom UI (Bob): pause + touch zoom buttons; talks to the camera only via sor:zoom events
// <<< DLC: Silas prequel

/** true: player + title Matthew use the high-res procedural hero (hero.js); false: Joe's matthew_sheet.png. */
const USE_HERO_RENDER = false; // Joe's approved v3 sheet ships; hero.js kept as an alternate renderer
const PLAYER_SCALE = PLAYER_DRAW_SCALE; // 1.3 (kits.js converts art hitboxes with it) — heroic presentation scale for Matthew vs 64x84 NPCs (draw only; hitboxes unchanged)

const canvas = document.getElementById('game');
const W = canvas.width;
const H = canvas.height;
// Gameplay draws into a 960×540 scene. present.js crops the follow camera and
// upscales with filtering onto the display canvas. DOM HUD / touch controls
// sit outside this canvas, so the lens never moves them.
// 1.8.0 HD: the scene backing store is SS x the logical 960x540 (1920x1080 on desktop, 1x on
// phones / low-power). Game code keeps drawing in logical px; every base transform is SS.
const SS_PARAM = new URLSearchParams(location.search).get('ss'); // ?ss=1 / ?ss=2 pins it (tests, debugging)
let SS = SS_PARAM === '1' || (!SS_PARAM && cheapPresentation()) ? 1 : 2;
// Auto resolution: if a machine can't hold ~40 fps at 2x for a few seconds, drop to 1x for the
// session (the HD art is still drawn, just into a 960x540 buffer). Never switches back up mid-session.
const autoRes = { t: 0, n: 0, slow: 0, dropped: false };
function setSceneScale(k) {
  if (k === SS) return;
  SS = k; scene.width = W * SS; scene.height = H * SS;
  ctx.setTransform(SS, 0, 0, SS, 0, 0); ctx.imageSmoothingEnabled = false;
}
function watchFrameRate(rawDt) {
  if (SS === 1 || SS_PARAM || autoRes.dropped || document.hidden || rawDt > 0.5) return;
  autoRes.t += rawDt; autoRes.n++; if (rawDt > 1 / 40) autoRes.slow++;
  if (autoRes.t < 3) return;
  const slowShare = autoRes.slow / autoRes.n;
  autoRes.t = 0; autoRes.n = 0; autoRes.slow = 0;
  if (slowShare > 0.5) { autoRes.dropped = true; setSceneScale(1); console.info('[Streets of Roanoke] 2x scene too slow here; using 1x'); }
}
const scene = document.createElement('canvas');
scene.width = W * SS;
scene.height = H * SS;
const ctx = scene.getContext('2d');
ctx.setTransform(SS, 0, 0, SS, 0, 0);
ctx.imageSmoothingEnabled = false;
const presenter = createPresenter(canvas, scene, W, H);
const followCam = createFollowCamera();
let lensZ = 1, CRISP = false; // 1.9.0 3x fix: lens render scale + crisp sprites at 3x
VO.voReady(); // VO-HOOK: fetch manifest.json once (~130 KB, no clips)
// VO-HOOK: music dips while VO plays (barks too). gameState is read lazily (declared below).
VO.setDuckHandler((on) => setDialogueDuck(on || gameState.mode === 'dialogue'));
/** 1.9.0: mouth open? A playing voice clip flaps at ~9 Hz; otherwise the procedural talk blips' loudness. */
function mouthOpen() {
  if (VO.isPlaying()) return Math.floor(performance.now() / 110) % 2 === 0;
  return talkLevel() > 0.12;
}

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
  ngPlus: 0,                 // NG+ cycle (saved); 0 = first playthrough
  storyBeaten: false,        // NG+: main story beaten at least once (sticky, saved)
  fetchGive: null,           // Potluck Run item being handed over in the current dialogue
  dlc: false,                // DLC: Silas prequel running (own save slot; main save untouched)
  pendingDlc: false,         // title difficulty picker opened for the prequel
  cutscene: null,            // DLC closing scene (input locked)
  finaleActors: []           // DLC closing scene extras (Matthew far off, crew gathering)
};
const isDlc = () => !!gameState.dlc;
/** Silas's moveset is active: playing Silas in the prequel, or Matthew in Silas's Suit. */
const silasSet = () => isDlc() || gameState.outfitId === 'silas';

/**
 * Ground rows inside the current area's walkable band (getDepth(area) = feet-Y range measured
 * per bg plate; combat.js clamps fighters to the same band via setDepthBand).
 */
const PLAYER_START_Y = Math.round((getDepth('downtown').min + getDepth('downtown').max) / 2);
const npcFeetY = () => getDepthBand().min + 6;   // NPCs stand on the back edge of the sidewalk
const collectY = () => getDepthBand().min + 24;  // collectible orbs float just above the sidewalk

/** Switch the walkable band to the current area and keep the player inside it. */
function syncDepthBand() {
  clearKitFx(); // area change: no footballs / flashes carried over
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
  community: ['COMMUNITY CENTER', 'Neighborhood'],
  pr_lobby: ['CINDER HOLLOW', 'Visitor Lobby'], pr_block: ['CINDER HOLLOW', 'Cell Block C'], pr_mess: ['CINDER HOLLOW', 'Mess Hall'],
  pr_library: ['CINDER HOLLOW', 'Library'], pr_shop: ['CINDER HOLLOW', 'Workshop'], pr_yard: ['CINDER HOLLOW', 'The Yard']
};

/** 1.3.2: HUD portrait follows the outfit (Sprites.getOutfitPortrait: helmet bust for Hell's Nightmare, else default). */
function syncPortrait() {
  const el = $('portrait');
  if (!el || typeof SpriteLib.getOutfitPortrait !== 'function') return;
  // DLC: Silas in the prequel; Matthew in Silas's Suit (Joe's bust when installed, else a tinted default)
  const dsrc = isDlc() ? silasPortraitSrc() : gameState.outfitId === 'silas' ? suitPortraitSrc() : null;
  if (dsrc) { if (el.src !== dsrc) { el.src = dsrc; el.alt = isDlc() ? 'Silas Boone' : 'Matthew'; } return; }
  if (el.alt !== 'Matthew') el.alt = 'Matthew';
  let img = null;
  try { img = SpriteLib.getOutfitPortrait(gameState.outfitId); } catch (_) { img = null; }
  const src = img && img.src;
  if (src && el.src !== src) el.src = src;
}
/** 1.4.0: HUD weapon badge for the current outfit (Sprites.getWeaponIcon) + Star Drive readiness. */
let weaponSig = '';
function syncWeaponIcon() {
  const c = $('hud-weapon-icon'), wrap = $('hud-weapon');
  if (!c || !wrap) return;
  const kitId = isDlc() ? 'silas' : gameState.outfitId; // DLC: Silas's own signature (Iron Handshake)
  const kit = getKit(kitId);
  const ready = player.specialCd <= 0 && gameState.special >= kit.special.cost;
  const sig = kitId + '|' + ready;
  if (sig === weaponSig && c.dataset.drawn === '1') return;
  let icon = null;
  try { icon = typeof SpriteLib.getWeaponIcon === 'function' ? SpriteLib.getWeaponIcon(kitId) : null; } catch (_) { icon = null; }
  const g = c.getContext('2d');
  g.clearRect(0, 0, c.width, c.height);
  g.imageSmoothingEnabled = !!(icon && icon.smooth);
  if (icon) { g.drawImage(icon.img, icon.sx, icon.sy, icon.sw, icon.sh, 0, 0, c.width, c.height); c.dataset.drawn = '1'; }
  else { g.fillStyle = '#ffd24a'; g.font = 'bold 28px sans-serif'; g.textAlign = 'center'; g.fillText('★', c.width / 2, c.height * 0.72); c.dataset.drawn = '0'; }
  weaponSig = sig;
  wrap.classList.toggle('ready', ready);
  wrap.dataset.outfit = kitId;
  wrap.title = `${kit.weapon} — ${kit.move}: ${kit.ability}`;
  const mv = $('hud-weapon-move');
  if (mv) mv.textContent = kit.move;
}
function updateHUD() {
  syncPortrait();
  syncWeaponIcon();
  if (isDlc() && dlc.state) { // DLC: Silas prequel objective + keepsakes
    const o = dlc.objective();
    $('mission-title').textContent = o.title;
    $('mission-desc').textContent = o.desc;
    $('collect-row').dataset.dlc = '1';
    $('collect-row').textContent = `${dlc.collectText()} · ${getDifficulty().name}`;
  } else {
  if ($('collect-row').dataset.dlc) { delete $('collect-row').dataset.dlc; $('collect-row').innerHTML = 'Collectibles <span id="collect-count">0/7</span> · Outfits <span id="outfit-count">1/5</span>'; }
  const m = missions.getActive();
  const sm = sideMission();
  const inPrison = isPrisonArea(gameState.areaId);
  if (gameState.arrest) { $('mission-title').textContent = 'The Star Goes Dark'; $('mission-desc').textContent = 'Sirens on the mountain road'; } else {
  $('mission-title').textContent = inPrison ? 'Cinder Hollow' : sm ? sm.title : m ? m.title : 'Free Roam';
  $('mission-desc').textContent = inPrison ? (stateBag.silasVisited ? 'Look around. The Route 9 bus home waits in the lobby.' : 'Visit Silas Boone: Cell Block C, cell C-14')
    : sm ? sideObjective(sm) : m ? m.desc : (stateBag.deliveryActive ? 'Deliver to River Bridge' : prisonOpen(stateBag) && !stateBag.silasVisited ? 'Route 9 bus at the Community Center: visit Cinder Hollow' : 'Explore Star City');
  }
  $('outfit-count').textContent = `${stateBag.unlockedOutfits.size}/${OUTFIT_ORDER.length}`;
  let ngTag = $('hud-ngplus'); // NG+ cycle tag on the collectibles row
  if (!ngTag) { ngTag = document.createElement('span'); ngTag.id = 'hud-ngplus'; $('collect-row').appendChild(ngTag); }
  ngTag.textContent = gameState.ngPlus > 0 ? ` · NG+${gameState.ngPlus}` : '';
  $('collect-count').textContent = `${missions.collectCount()}/${missions.collectTotal()}`;
  }
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
  hideStoryIntro();
  leaveDlcUi();
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
  // NG+: only once the main story has been beaten; Continue shows the save's cycle
  const ng = saveSummary();
  if ($('btn-ngplus')) $('btn-ngplus').classList.toggle('hidden', !(has && ng.storyBeaten));
  $('btn-continue').textContent = ng.ngPlus > 0 ? `Continue · NG+${ng.ngPlus}` : 'Continue';
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
  gameState.ngPlus = 0; gameState.storyBeaten = false; // applySave restores them
  const ngStart = !!gameState.ngPlusStart; gameState.ngPlusStart = false;
  let restored = false;
  if (fromSave) {
    const r = coop.saveSource() || inspectSave(); // COOP-HOOK: a co-op session loads its own slot
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
  setNgPlus(gameState.ngPlus); // NG+ enemy scaling (0 = none)
  setDifficulty(gameState.difficulty);
  // >>> DLC: Silas prequel — finishing the prequel (its own save slot) unlocks Silas's Suit; the main save keeps a flag
  let suitNew = false;
  if (dlcCompleted() || stateBag.dlcSilas) {
    stateBag.dlcSilas = true;
    if (!stateBag.unlockedOutfits.has('silas')) { stateBag.unlockedOutfits.add('silas'); suitNew = true; }
  }
  // <<< DLC
  stateBag.storyBeaten = !!gameState.storyBeaten; // NG+: Cinder Hollow stays open in later cycles
  const cinderNew = checkCinder(); // 1.7.0: saves that already visited Silas's cell get Cinder Hollow Orange
  const darkNew = checkDarkStar(); // 1.6.0: existing saves that already beat the campaign get the Dark Star Suit
  gameState.darkStarNew = false;
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
  if (restored && !ngStart) {
    toast('Welcome back to Star City');
    gameState.areaVisitCombat[gameState.areaId] = 1; // no instant ambush on load
  } else {
    if (ngStart) toast(`New Game+ ${gameState.ngPlus}: the story starts over. Your outfits and finds came with you.`, true);
    toast("Wren is missing. Find Dee Morales at Dee's Diner");
    showStoryIntro(); // 1.6.0: "The Star Goes Dark" opening card (non-blocking)
    maybeSpawnEncounter(true);
  }
  if (suitNew) toast(`Silas's Suit unlocked — ${suitHowTo()}`, true);
  if (darkNew) toast(`Dark Star Suit unlocked! ${darkStarHowTo()}`, true);
  if (cinderNew) toast(`Cinder Hollow Orange unlocked! ${cinderHowTo()}`, true);
  if (prisonOpen(stateBag) && !stateBag.silasVisited && restored && !ngStart) toast('New: the Route 9 bus at the Community Center goes to Cinder Hollow.');
  persist();
  followCam.cut();
}

function maybeSpawnEncounter(force) {
  if (gameState.mode !== 'play') return;
  if (isScenePlaying()) return; // 1.9.0: no fights start mid-scene
  const area = AREAS[gameState.areaId];
  if (!area.spawnCombat) return;
  if (hostilesAlive()) return;
  if (isDlc()) { // DLC: light night-time ambushes on the way; mission areas run their own fights
    if (gameState.cutscene || isScenePlaying() || !dlc.ambientFights() || gameState.areaId === dlc.missionArea() || gameState.areaId === 'star') return;
    if (Math.random() > area.combatChance * 0.6) return;
    dlcApi.spawnCrew(2 + Math.min(2, gameState.wave) + getDifficulty().wave, { color: Math.random() < 0.5 ? '#7f8c8d' : '#c0392b', wave: Math.min(3, gameState.wave) });
    gameState.wave++;
    toast("The Foreman's boys want a word.");
    return;
  }
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
  toast("Boone's thugs! Clear the street!");
}

// ---------- 1.6.0 "The Star Goes Dark" story state ----------
/** Wren is gone from her cart from Dee's news (main1) until she is rescued (main4), unless her own job is running. */
function wrenMissing() {
  const m = stateBag.missions; if (!m) return false;
  return !!(m.main1?.done && !stateBag.mainComplete && !(stateBag.side && stateBag.side.id === 'side_snatch'));
}
/** Anniversary night: after Hank's twist (main3) the city goes dark until Silas falls. */
function storyBlackout() {
  const m = stateBag.missions; if (!m || isDlc()) return false;
  return !!(m.main3?.done && !stateBag.mainComplete);
}
let introTimer = null;
function showStoryIntro() {
  const el = $('story-intro'); if (!el) return;
  $('story-intro-text').textContent = STORY_INTRO;
  el.classList.remove('hidden'); el.classList.remove('fade');
  clearTimeout(introTimer);
  introTimer = setTimeout(() => { el.classList.add('fade'); introTimer = setTimeout(() => el.classList.add('hidden'), 1200); }, 9000);
}
function hideStoryIntro() { const el = $('story-intro'); if (el) el.classList.add('hidden'); clearTimeout(introTimer); }

function npcsInArea() {
  if (isDlc()) return dlc.npcs(gameState.areaId); // DLC: the prequel's own cast
  // Silas is the boss while the fight is on, and he's gone after the ending.
  const escM = stateBag.side && stateBag.missions[stateBag.side.id]?.kind === 'escort' ? stateBag.missions[stateBag.side.id] : null;
  const esc = escM ? stateBag.side : null;
  syncWilliam(); // 2.0.2: William's spot follows the story / his pending quest
  const list = NPC_DEFS.filter((n) => n.area === gameState.areaId &&
    !(n.id === 'silas' && (gameState.bossActive || stateBag.mainComplete)) &&
    !(n.id === 'wren' && wrenMissing()) && // 1.6.0: her cart stands empty while she's missing
    !(esc && n.id === escM.npc));
  if (esc && esc.area === gameState.areaId) { // the escorted NPC (Hank, or 2.0.2 William) walks with Matthew
    const who = NPC_DEFS.find((n) => n.id === escM.npc);
    list.push({ ...who, area: esc.area, x: esc.x });
  }
  return coop.filterNpcs(list); // COOP-HOOK: no NPC William while Player 2 plays him
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
  if (isDlc()) return dlc.linesFor(npc);
  const sm = missions.missionFor(npc.id);
  if (sm && sm.offer) {
    if (stateBag.side && stateBag.side.id === sm.id) {
      return sm.kind === 'fetch' && fetchDone()
        ? [sm.doneLine || "You found everything! Matthew, this potluck is going to be perfect."] // JACK-STORY: per-mission fetch return line
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
  if (npc.id === 'silas_prison') { startSilasTalk(npc); return; } // 1.7.0: branching talk in cell C-14
  let lines = coop.lines(npc, linesFor(npc)); // COOP-HOOK: two-player script variants
  if (isDlc() && !isScenePlaying()) { // 1.9.0: a prequel talk that is a registered scene (js/scenes_silas.js) plays as it
    const sid = sceneForLines(lines);
    if (sid && playScene(sid, { onDone: () => { dlc.onTalkDone(npc); updateHUD(); persist(); } })) return;
  }
  gameState.fetchGive = null;
  const fm = sideMission();
  if (fm && fm.kind === 'fetch') {
    const item = fm.items.find((it) => it.npc === npc.id && !stateBag.fetchItems.includes(it.id));
    if (item) { gameState.fetchGive = item; lines = [item.line]; }
  }
  hideStoryIntro(); // 1.6.0: the opening card never sits over a conversation
  gameState.mode = 'dialogue';
  gameState.dialogueNpc = npc;
  gameState.dialogue = lines;
  VO.preload(lines.map((l) => (l && typeof l === 'object' && l.voice) || VO.lineIdFor(typeof l === 'object' ? l.text : l, typeof l === 'object' ? l.id : npc.id)).filter(Boolean)); // VO-HOOK
  gameState.dialogueIdx = 0;
  if (typeof SpriteLib.preloadPortraits === 'function') SpriteLib.preloadPortraits(lines.map((l) => [(l && l.key) || (l && l.id) || npc.key || npc.id, (l && l.expr) || 'neutral'])); // 1.9.0
  $('dialogue').classList.remove('hidden');
  showLine(npc, lines[0], true);
  $('interact-prompt').classList.add('hidden');
  updateDialogueButton();
  input.flush();
}

/** One dialogue line: a string (spoken by the NPC) or, in the prequel, { id, name, text } per speaker. */
function showLine(npc, line, greet) {
  const obj = line && typeof line === 'object';
  const text = obj ? line.text : line, id = obj ? line.id : npc.id;
  const castRole = obj && ARREST_COPS[line.id] ? ARREST_COPS[line.id].role : obj && line.id === npc.id ? npc.role : obj && line.id === 'silas' ? (isDlc() ? 'Second shift' : 'Boone Holdings') : null;
  $('dialogue-name').textContent = obj ? (castRole ? `${line.name} — ${castRole}` : line.name) : `${npc.name} — ${npc.role}`;
  $('dialogue-text').textContent = text;
  // VO-HOOK: the line's clip (scene lines carry `voice`; others are looked up by text + speaker), else the old talk blips
  const voId = (obj && line.voice) || VO.lineIdFor(text, id);
  if (voId) { stopTalk(); VO.play(voId); } else { VO.stop(); talk(id, text, greet); }
  dlgPortrait.line = obj ? line : { id: npc.id, key: npc.key }; dlgPortrait.src = ''; syncDialoguePortrait(); // 1.9.0
}
// >>> 1.9.0 dialogue portrait: sprites.js getPortrait(key, expr, open); the open-mouth frame follows talkLevel()
const dlgPortrait = { line: null, src: '', el: null };
function syncDialoguePortrait() {
  const card = document.querySelector('#dialogue .dialogue-card');
  if (!card || typeof SpriteLib.getPortrait !== 'function') return;
  if (!dlgPortrait.el) {
    const im = document.createElement('img'); im.id = 'dialogue-portrait'; im.alt = ''; im.className = 'hidden';
    card.insertBefore(im, card.firstChild); dlgPortrait.el = im;
  }
  const l = gameState.mode === 'dialogue' ? dlgPortrait.line : null;
  let key = l && (l.key || (gameState.dialogueNpc && gameState.dialogueNpc.id === l.id && gameState.dialogueNpc.key) || l.id);
  if (key === 'matthew' && isDlc() && dlc && dlc.which === 'blackriver') key = 'matthew_2028'; // 1.9.1-m2028: Joe's 2028 Matthew in Blackriver
  const p = key ? SpriteLib.getPortrait(key, l.expr || 'neutral', mouthOpen(), 224) : null;
  const src = p && p.img ? p.img.src : '';
  if (src !== dlgPortrait.src) { dlgPortrait.src = src; if (src) dlgPortrait.el.src = src; }
  dlgPortrait.el.classList.toggle('hidden', !src);
  card.classList.toggle('has-portrait', !!src);
}
// <<< 1.9.0 dialogue portrait
function updateDialogueButton() {
  const btn = $('dialogue-next');
  if (!btn || !gameState.dialogue) return;
  const lastLine = gameState.dialogueIdx >= gameState.dialogue.length - 1;
  const dev = getPromptDevice();
  const key = dev === 'touch' ? '' : dev === 'keyboard' ? ' (E)' : ` (${getPromptLabel('confirm')})`;
  btn.textContent = (lastLine && !(gameState.sceneMoreLines && isScenePlaying()) ? 'Close' : 'Continue') + key; // 1.9.0
}

function advanceDialogue() {
  if (gameState.mode !== 'dialogue' || !gameState.dialogue) return;
  if (gameState.choice) { pickChoice(gameState.choice.focus); return; } // 1.7.0: Silas's cell talk
  if (gameState.choiceVo) { VO.stop(); return; } // 1.9.0: skip Matthew's choice clip → Silas answers
  gameState.dialogueIdx++;
  if (gameState.dialogueIdx >= gameState.dialogue.length) {
    finishDialogue();
  } else {
    if (gameState.dialogueNpc) showLine(gameState.dialogueNpc, gameState.dialogue[gameState.dialogueIdx], false);
    if (gameState.dialogueNpc && gameState.dialogueNpc.onLine) gameState.dialogueNpc.onLine(gameState.dialogueIdx); // 1.9.0 scene voice clips
    updateDialogueButton();
  }
}

function finishDialogue() {
  if (gameState.mode !== 'dialogue') return;
  const npc = gameState.dialogueNpc;
  stopTalk();
  VO.stop(); // VO-HOOK
  $('dialogue').classList.add('hidden');
  $('dialogue-next').classList.remove('pad-focus');
  gameState.mode = 'play';
  gameState.dialogue = null;
  gameState.dialogueNpc = null;
  input.flush();
  input.focusGame();
  if (!npc) return;
  if (npc.onDone) { npc.onDone(); updateHUD(); return; } // DLC scene lines
  if (isDlc()) { dlc.onTalkDone(npc); updateHUD(); persist(); return; }

  if (gameState.fetchGive) {
    const it = gameState.fetchGive;
    gameState.fetchGive = null;
    if (!stateBag.fetchItems.includes(it.id)) stateBag.fetchItems.push(it.id);
    const fmi = sideMission() || stateBag.missions.side_potluck; // JACK-STORY: any fetch mission (Marcus's pages)
    const n = stateBag.fetchItems.length, total = fmi.items.length;
    toast(`Got ${it.name} (${n}/${total})${n >= total ? ` — back to ${fmi.returnTo || 'June'}!` : ''}`);
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
            toast("Boone's men were waiting outside the diner!");
          }
        }, 400);
      }
      if (m.id === 'side_june') toast('June gets the families settled. Soft landing secured.');
      if (m.id === 'side_tessa') toast('Tessa says gear is stashed all over town. Check the far ends of every street.');
      if (m.id === 'side_cam') toast('Cam deletes the app and drives home. One less pair of eyes for Vera Lisk.');
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
  toast('Midnight. The Star goes dark. Silas wants a word, with fists.');
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
  const m = sideMission()?.kind === 'fetch' ? sideMission() : stateBag.missions.side_potluck; // JACK-STORY
  return m.items.every((it) => stateBag.fetchItems.includes(it.id));
}
const npcDef = (id) => NPC_DEFS.find((n) => n.id === id);
/** 2.0.2: William stands where his next quest starts, else where the story has him (js/william.js). */
function syncWilliam() {
  const w = npcDef('william');
  if (!w || !stateBag.missions) return;
  const m = missions.missionFor('william');
  const sp = (m && m.spot) || williamStageSpot(stateBag.missions, stateBag.mainComplete);
  w.area = sp ? sp.area : 'offscreen'; if (sp) w.x = sp.x;
}

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
    case 'escort': return `${m.escortName || 'Hank'} ${Math.max(0, Math.ceil(s.hp))}/100 · ${s.ambush ? 'Fight off the ambush!' : (m.escortGoal || 'Walk him to the River Bridge')}`;
    case 'fetch': {
      const left = m.items.filter((it) => !stateBag.fetchItems.includes(it.id));
      return left.length ? `Fetch: ${left.map((it) => `${it.name} (${npcDef(it.npc).name.split(' ')[0]})`).join(', ')}` : `Bring everything back to ${m.returnTo || 'June'}`; // JACK-STORY
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
  } else if (m.kind === 'escort') { syncWilliam(); s.hp = 100; s.area = gameState.areaId; s.x = npcDef(m.npc).x; s.ambush = false; }
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

/** 1.7.0 Cinder Hollow Orange: unlocked by the first finished visit to Silas's cell (silasVisited). True when newly added. */
function checkCinder() {
  if (!stateBag.silasVisited || !stateBag.unlockedOutfits || stateBag.unlockedOutfits.has('cinder')) return false;
  stateBag.unlockedOutfits.add('cinder');
  return true;
}
function cinderHowTo() { return input.isMobile() ? 'Pick it in Pause → Outfits.' : 'Wear it with Shift+5 or Pause → Outfits (L1/R1 to cycle).'; }
/** 1.6.0 Dark Star Suit: unlocked by beating the main campaign (mainComplete). Returns true when newly added. */
function checkDarkStar() {
  if (!stateBag.mainComplete || !stateBag.unlockedOutfits || stateBag.unlockedOutfits.has('darkstar')) return false;
  stateBag.unlockedOutfits.add('darkstar');
  return true;
}
function darkStarHowTo() { return input.isMobile() ? 'Pick it in Pause → Outfits.' : 'Wear it with Shift+4 or Pause → Outfits (L1/R1 to cycle).'; }

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
  if (e.slowT > 0) e.slowT -= dt;
  if (e.pull) { tickPull(e, dt); setAnim(e, 'hurt'); return; } // 1.4.0 Star Yank
  if (e.stun > 0) { e.stun -= dt; e.pose = 'hurt'; setAnim(e, 'hurt', { key: 'snatcher', sec: e.stun + dt }); if (e.stun <= 0) e.dazed = false; return; }
  if (e.restT > 0) {
    e.restT -= dt; e.pose = 'idle'; e.facing = player.x > e.x ? 1 : -1; setAnim(e, 'idle');
    if (e.restT <= 0) e.runT = 2 + Math.random();
    return;
  }
  e.runT -= dt;
  if (e.runT <= 0) { e.restT = 0.9; return; } // winded
  e.facing = 1; e.pose = 'chase'; setAnim(e, 'run');
  e.x += getDifficulty().runner * dt * slowMul(e); // Hot Plate slows the snatcher too
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
        toast(`${m.waveLabel || 'Lunch rush'} wave ${s.wave}/${m.waves}!`);
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
        if (e.alive && e.target === 'escort' && e.hitbox && !e.hitbox.hit.has('escortee') && Math.abs(e.x - s.x) < 50) {
          e.hitbox.hit.add('escortee');
          s.hp -= e.dmg;
        }
      }
    }
    if (s.hp <= 0) { failSide(m.escortFail || "Hank's knees have had enough — he heads home."); return; }
    if (gameState.areaId === m.dest && !s.ambush) {
      s.ambush = true;
      addSideWave(3 + D.wave, (e, i) => { e.sideFoe = true; if (i % 2 === 0) e.target = 'escort'; });
      toast(m.escortAmbush || 'Ambush on the bridge — protect Hank!', true);
    } else if (s.ambush && !hostilesAlive()) {
      completeSide();
    }
  }
}

function tryInteract() {
  // >>> DLC: Silas prequel — Cold Stare lives on the talk button, but only with no NPC in talk range
  if (silasSet()) {
    const npcNear = nearestNPC();
    const fighting = gameState.combatLock && hostilesAlive();
    if (!npcNear && isDlc() && !fighting && dlc.usable(gameState.areaId, player.x)) { dlc.use(); return; }
    // 1.5.1: mid-fight, talking is blocked anyway, so Cold Stare wins even next to an NPC
    if (fighting || (!npcNear && gameState.enemies.some((e) => e.alive))) {
      const r = coldStare(player, gameState.enemies);
      if (!r.ok && r.reason === 'cooldown') toast(`Cold Stare ready in ${Math.ceil(r.left)}s`);
      return;
    }
    if (!npcNear) { // 1.5.1: nobody to stare down → just pick up / deliver (no pose, no cooldown toast)
      collectHere();
      if (!isDlc()) missions.checkDelivery(gameState.areaId, toast, onProgress);
      return;
    }
  }
  // <<< DLC
  if (gameState.combatLock && hostilesAlive()) {
    toast('Clear the thugs first!');
    return;
  }
  const npc = nearestNPC();
  if (npc) {
    startDialogue(npc);
    return;
  }
  if (!isDlc()) { const sp = prisonSpot(stateBag, gameState.areaId, player.x); if (sp) { usePrisonSpot(sp); return; } } // 1.7.0
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
  if (!isDlc()) missions.checkDelivery(nextId, toast, onProgress);
  // chance encounter on enter (only if still here and playing)
  setTimeout(() => {
    if (gameState.mode === 'play' && gameState.areaId === nextId) maybeSpawnEncounter(false);
  }, 300);
  persist();
  followCam.cut();
  return true;
}

function persist() {
  if (isDlc()) { // DLC: its own slot only — the main save is never written while the prequel runs
    return dlc.persist({ areaId: gameState.areaId, x: Math.round(player.x), y: Math.round(player.y), hp: player.hp, special: gameState.special, score: gameState.score, difficulty: gameState.difficulty });
  }
  const payload = serializeSave({
    player, stateBag, gameState,
    outfitId: gameState.outfitId,
    areaId: gameState.areaId
  });
  if (coop.persist(payload)) return true; // COOP-HOOK: co-op writes its own slot (solo save untouched)
  return saveGame(payload);
}

function showEnding() {
  hideStoryIntro();
  gameState.mode = 'ending';
  gameState.ended = true;
  gameState.storyBeaten = true; // NG+ unlocks on the title
  $('ending-screen').classList.remove('hidden');
  $('ending-text').textContent = ENDING_TEXT;
  $('sequel-hooks').innerHTML = SEQUEL_HOOKS;
  $('interact-prompt').classList.add('hidden');
  persist();
  menuFocus(0);
}

function setOutfit(id, quiet = false) {
  if (!OUTFITS[id] || isDlc()) return;
  if (!stateBag.unlockedOutfits.has(id)) {
    sfx('denied');
    toast(id === 'silas' ? "Silas's Suit is locked — beat the Silas Boone prequel (Title → Prequel)" : id === 'darkstar' ? 'Dark Star Suit is locked: beat the main campaign, "The Star Goes Dark"' : id === 'cinder' ? "Cinder Hollow Orange is locked: visit Silas Boone's cell at Cinder Hollow" : 'Outfit locked — find collectibles');
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
  if (id === 'silas' && !quiet) toast("Silas's moves: Z jab · C grip · V Iron Handshake · X hold Last Word · E Cold Stare · sprint+Z Boss Rush");
  syncSilasControls();
  refreshPrompts(true);
  updateOutfitButton();
  updateHUD();
  persist();
}

/** Next/previous unlocked outfit (L1/R1 · LB/RB, pause-menu Outfit button). */
function cycleOutfit(dir = 1) {
  if (isDlc()) return;
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
  for (const id of ['dlc-ending-screen', 'dlc-mission-card', 'confirm-screen', 'ending-screen', 'pause-screen', 'title-screen']) { // DLC cards sit on top (Bob)
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
  if ((inp.navLeft || inp.navRight) && adjustFocusedSlider(inp.navRight ? 1 : -1)) { inp.navLeft = inp.navRight = false; VO.refreshVolume(); } // VO-HOOK
  const inGameMenu = el.id !== 'title-screen'; // title.js plays its own menu blips
  if (inp.navUp || inp.navLeft) { menuFocus(menuIdx - 1, el); if (inGameMenu) sfx('ui_move'); }
  else if (inp.navDown || inp.navRight) { menuFocus(menuIdx + 1, el); if (inGameMenu) sfx('ui_move'); }
  if (inp.confirmPressed) {
    const b = menuButtons(el)[menuIdx];
    if (b && inGameMenu && !b.closest('.audio-settings') && !b.classList.contains('weather-opt')) sfx('ui_select');
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
  if (isScenePlaying()) return; // 1.9.0: no pausing mid-scene (Esc / Start skip it instead)
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

// ============================================================ >>> DLC: Silas prequel (1.5.0) — game-logic lane
/** main.js's hit callback (shared by resolveHits, kits and Silas's thrown bodies). */
function onHitEnemy(e) {
  gameState.hitStop = e.kd ? 0.07 : 0.04;
  gameState.special = Math.min(100, gameState.special + 4);
  if (!e.alive) gameState.score += e.scoreValue || 100;
  rumble(0.25, 0.45, 60);
  followCam.kick(e.kd ? 3.5 : 2);
}
const NEUTRAL_INPUT = { ax: 0, ay: 0, punchPressed: false, kickPressed: false, heavyPressed: false, specialPressed: false, interactPressed: false,
  sprintHeld: false, kickHeld: false, punchHeld: false, outfitKey: null, outfitCycle: 0 };
/** Extra updatePlayer hooks: ONE shared Silas moveset for prequel Silas and Matthew in Silas's Suit; {} otherwise. */
function silasHooks() {
  if (isDlc()) {
    const key = player.animKey || 'silas_boss';
    return { moveset: 'silas', animMap: silasAnimMap(key), enemies: gameState.enemies, onHitEnemy };
  }
  if (gameState.outfitId === 'silas') return { moveset: 'silas', animMap: suitAnimMap(), artOutfit: artOutfitFor('silas'), enemies: gameState.enemies, onHitEnemy };
  return {};
}

// ---------- prequel controller + the api it drives ----------
function crewify(e) { e.charKey = 'foreman_crew'; e.crew = true; return e; } // 1.5.2: Jack's Foreman's-crew art
/** 2.0.1 Blackriver: Cinder Hollow C.O. variants (tools/gen_guards.py). Mixed per wave, at most one sergeant on the floor. */
const GUARD_VARIANTS = [
  { variant: 'co', charKey: 'guard_co', w: 40 },
  { variant: 'baton', charKey: 'guard_baton', w: 25 },
  { variant: 'riot', charKey: 'guard_riot', w: 20, drawScale: 1.3 }, // riot kit reads ~8% bigger (THUG_SCALE 1.2)
  { variant: 'sgt', charKey: 'guard_sgt', w: 15 }
];
function guardify(e, i, takeSgt) {
  let pool = GUARD_VARIANTS;
  if (i === 0) pool = pool.filter((g) => g.variant !== 'sgt'); // the first through the door is never the sergeant
  let r = Math.random() * pool.reduce((a, g) => a + g.w, 0), g = pool[0];
  for (const x of pool) { r -= x.w; if (r <= 0) { g = x; break; } }
  if (g.variant === 'sgt' && !takeSgt()) g = GUARD_VARIANTS[0];
  e.charKey = g.charKey; e.variant = g.variant; e.guard = true; e.crew = false;
  if (g.drawScale) e.drawScale = g.drawScale;
  return e;
}
const dlcApi = {
  toast, sfx, sting, voice,
  player: () => player,
  areaId: () => gameState.areaId,
  hostiles: () => hostilesAlive(),
  foeCount: () => gameState.enemies.filter((e) => e.alive).length,
  setSpecial: (v) => { gameState.special = v; },
  heal: (n) => heal(n, false),
  spawnCrew(n, { color = '#7f8c8d', wave = 0, guard = false } = {}) {
    const area = AREAS[gameState.areaId];
    const br = isDlc() && dlc && dlc.which === 'blackriver';
    let sgt = gameState.enemies.some((e) => e.alive && e.variant === 'sgt');
    const add = spawnWave(area, Math.max(1, n), wave, player.x).map((e, i) => {
      e.color = color; crewify(e);
      if (br && (guard || isPrisonArea(gameState.areaId))) guardify(e, i, () => sgt ? false : (sgt = true)); // 2.0.1: mixed 2028 C.O. variants
      else if (br) e.lkCrew = true; // the Lockkeeper's people outside the walls (Foreman's-crew art, own barks)
      return e;
    });
    gameState.enemies = gameState.enemies.filter((e) => e.alive).concat(add);
    gameState.combatLock = true;
    sfx('fight_start');
    return add;
  },
  clearFoes(msg) {
    for (const e of gameState.enemies) if (e.alive) { e.alive = false; e.hp = 0; e.stun = 0; e.koT = 0; }
    gameState.enemies = []; gameState.combatLock = false; gameState.bossActive = false;
    if (msg) toast(msg, true);
  },
  spawnBoss(who, adds = 0) {
    const area = AREAS[gameState.areaId];
    const D = getDifficulty();
    const bx = player.x + 180 < area.width - 60 ? player.x + 180 : player.x - 180;
    const b = createThug(bx, player.y, 2);
    if (who === 'voss') Object.assign(b, { color: '#4a4a52', charKey: 'br_voss', who: 'voss', nameTag: 'Rudy "Tumbler" Voss', drawScale: 1.35, hp: Math.round(160 * D.bossHp), dmg: Math.round(14 * D.bossDmg), speed: 100 * Math.min(1.1, D.speed), scoreValue: 2000 });
    else if (who === 'lockkeeper') Object.assign(b, { color: '#1e1f24', charKey: 'br_lockkeeper', who: 'lockkeeper', nameTag: 'The Lockkeeper', drawScale: 1.45, hp: Math.round(230 * D.bossHp), dmg: Math.round(17 * D.bossDmg), speed: 98 * Math.min(1.1, D.speed), scoreValue: 4000 }); // 2.0.1: own fight art (tools/gen_guards.py, from the Foreman's rig)
    else if (who === 'vera') Object.assign(b, { color: '#16a085', charKey: 'vera', nameTag: 'Vera Lisk', drawScale: 1.3, hp: Math.round(130 * D.bossHp), dmg: Math.round(13 * D.bossDmg), speed: 105 * Math.min(1.1, D.speed), scoreValue: 1500 });
    else Object.assign(b, { color: '#7f8c8d', charKey: 'foreman', nameTag: 'Mort "The Foreman" Kessler', drawScale: 1.45, hp: Math.round(200 * D.bossHp), dmg: Math.round(17 * D.bossDmg), speed: 90 * Math.min(1.1, D.speed), scoreValue: 3000 });
    b.maxHp = b.hp; b.miniBoss = true; b.boss = who; // 1.5.2: Jack's real boss art (no tint)
    gameState.enemies = [b, ...this.spawnCrew(adds, { color: who === 'vera' ? '#16a085' : '#c0392b', wave: 2 })];
    gameState.combatLock = true; gameState.bossActive = true;
    sfx('fight_start');
    toast(who === 'voss' ? 'Tumbler Voss cracks his knuckles.' : who === 'lockkeeper' ? 'The Lockkeeper draws his ring of keys.' : who === 'vera' ? 'Vera Lisk wants her lamp back.' : 'The Foreman blows his whistle.', true);
    return b;
  },
  /** Scene / extra lines (no NPC to stand next to). */
  say(lines, onDone) {
    if (!isScenePlaying()) { const sid = sceneForLines(lines); if (sid && playScene(sid, { onDone: () => { if (onDone) onDone(); } })) return; } // 1.9.0: a prequel talk with a scene plays as it
    const first = lines[0] || {};
    startDialogueRaw({ id: first.id || 'silas', name: first.name || 'Silas Boone', role: '', onDone }, lines);
  },
  missionCard(info, onDone) { showDlcCard(info, onDone); },
  travel: (areaId, x) => travelTo(areaId, x, 1), // 2.0.0 Blackriver: mission warps
  playScene: (id, onDone) => { if (!playScene(id, { onDone: () => { if (onDone) onDone(); } }) && onDone) onDone(); },
  finale(onDone, sceneId) { if (sceneId) { gameState.enemies = []; gameState.combatLock = false; if (!playScene(sceneId, { onDone: () => onDone && onDone() }) && onDone) onDone(); return; } startFinale(onDone); },
  ending() { showDlcEnding(); }
};
const dlcSilas = createDlc(dlcApi);
const dlcBr = createBlackriver(dlcApi); // 2.0.0 WIP
let dlc = dlcSilas; // active DLC controller (startDlc picks one)
const isBr = () => isDlc() && dlc === dlcBr;

/** startDialogue with explicit lines (DLC scenes). */
function startDialogueRaw(npc, lines) {
  gameState.fetchGive = null;
  hideStoryIntro(); // 1.6.0: the opening card never sits over a conversation
  gameState.mode = 'dialogue';
  gameState.dialogueNpc = npc;
  gameState.dialogue = lines;
  VO.preload(lines.map((l) => (l && typeof l === 'object' && l.voice) || VO.lineIdFor(typeof l === 'object' ? l.text : l, typeof l === 'object' ? l.id : npc.id)).filter(Boolean)); // VO-HOOK
  gameState.dialogueIdx = 0;
  if (typeof SpriteLib.preloadPortraits === 'function') SpriteLib.preloadPortraits(lines.map((l) => [(l && l.key) || (l && l.id) || npc.key || npc.id, (l && l.expr) || 'neutral'])); // 1.9.0
  $('dialogue').classList.remove('hidden');
  showLine(npc, lines[0], true);
  $('interact-prompt').classList.add('hidden');
  updateDialogueButton();
  input.flush();
}

/** Prequel start: New (difficulty picked on the shared selector) or Continue (own save slot). */
function startDlc(cont, which = 'silas') {
  if (!booted) { pendingAction = () => startDlc(cont, which); return; }
  if (gameState.mode !== 'title') return;
  dlc = which === 'blackriver' ? dlcBr : dlcSilas;
  clearSpriteCache();
  clearHeroCache();
  Object.keys(stateBag).forEach((k) => delete stateBag[k]);
  createMissionSystem(stateBag);      // a throwaway mission bag so shared code paths stay valid; never saved
  stateBag.collectibles = [];
  stateBag.unlockedOutfits = new Set(['polo']);
  let run = cont ? dlc.continueRun() : null;
  if (!run) run = dlc.newRun(gameState.pendingDifficulty || 'normal');
  gameState.pendingDifficulty = null;
  gameState.dlc = true;
  gameState.difficulty = run.difficulty || 'normal';
  setNgPlus(0); // the prequel never uses NG+ scaling
  setDifficulty(gameState.difficulty);
  gameState.areaId = AREAS[run.areaId] ? run.areaId : 'downtown';
  gameState.outfitId = 'polo';
  gameState.ended = false;
  gameState.score = run.score || 0;
  gameState.playTime = run.playTime || 0;
  gameState.special = run.special != null ? run.special : 100;
  gameState.bossActive = false;
  gameState.cutscene = null; gameState.finaleActors = [];
  player = createPlayer(run.x || 200, PLAYER_START_Y);
  player.animKey = dlc.playerKey ? dlc.playerKey() : silasPlayerKey();  // Jack's 'silas_player' when installed, else 'silas_boss'
  player.voiceKey = 'silas';
  player.maxHp = 120; player.hp = Math.max(1, Math.min(120, run.hp || 120));
  gameState.enemies = [];
  gameState.combatLock = false;
  gameState.wave = 0;
  gameState.spawnChecked = false;
  gameState.areaVisitCombat = { [gameState.areaId]: 1 };
  gameState.saveTimer = 0;
  syncDepthBand();
  if (run.y != null) player.y = clampDepth(run.y);
  gameState.mode = 'play';
  document.body.classList.add('dlc-silas'); // Bob's prequel theme
  document.body.classList.toggle('dlc-blackriver', dlc === dlcBr);
  $('title-screen').classList.add('hidden');
  $('confirm-screen')?.classList.add('hidden');
  clearMenuFocus();
  $('hud').classList.remove('hidden');
  $('desktop-hint').classList.toggle('hidden', input.isMobile());
  input.showMobile(input.isMobile());
  input.flush();
  input.focusGame();
  syncSilasControls();
  syncDlcPause();
  refreshPrompts(true);
  updateHUD();
  const m = (dlc.missions || DLC_MISSIONS)[run.mi];
  toast(dlc.titleToast ? dlc.titleToast(cont) : cont ? 'Prequel: welcome back, Mr. Boone' : 'Prequel: Silas Boone — "Second Shift"', true);
  if (m) toast(`${m.title} — ${m.obj || m.sub}`);
  persist();
  followCam.cut();
}
/** Leave the prequel (title / main story): theme off, Silas-only UI hidden. */
function leaveDlcUi() {
  if (gameState.dlc) { persist(); }
  gameState.dlc = false; gameState.cutscene = null; gameState.finaleActors = [];
  dlc.stop();
  document.body.classList.remove('dlc-silas'); document.body.classList.remove('dlc-blackriver');
  $('dlc-mission-card')?.classList.add('hidden');
  $('dlc-ending-screen')?.classList.add('hidden');
  syncSilasControls();
  syncDlcPause();
  const el = $('portrait'); if (el) { el.alt = 'Matthew'; }
  weaponSig = '';
}
function quitDlcToTitle() {
  setPaused(false);
  $('pause-screen').classList.add('hidden');
  showTitle();                               // leaveDlcUi() → persist() while `player` is still Silas (1.5.1)
  player = createPlayer(200, PLAYER_START_Y);
}
/** How to wear the suit, worded for the current device. */
function suitHowTo() {
  const dev = getPromptDevice();
  return dev === 'touch' ? 'Pause → Outfits' : dev === 'keyboard' ? 'press # (Shift+3) or Pause → Outfits' : `${getPromptLabel('outfit')} or Pause → Outfits`;
}
/** Knocked out in the prequel: Arcade reloads the prequel save, otherwise restart the step at full health. */
function dlcKnockout() {
  const arcade = getDifficulty().arcade;
  player.hp = player.maxHp; player.alive = true;
  player.kd = null; player.koT = 0; player.lift = 0; player.invuln = 1.2; player.koSting = false;
  gameState.enemies = []; gameState.combatLock = false; gameState.bossActive = false;
  if (arcade) {
    const w = dlc.which === 'blackriver' ? 'blackriver' : 'silas';
    gameState.dlc = false; gameState.mode = 'title';
    startDlc(true, w);
    toast('GAME OVER — back to your last DLC save', true);
    return;
  }
  dlc.onKO();
  toast('Silas straightens his tie… and tries again.', true);
  syncDepthBand();
  followCam.cut();
  updateHUD();
  persist();
}
function dlcCollect() {
  for (const c of dlc.visibleCollectibles(gameState.areaId)) {
    if (Math.abs(c.x - player.x) < 42) dlc.take(c);
  }
}
function drawUseMarker(cam) {
  const u = dlc.usableMarker();
  if (!u || u.area !== gameState.areaId) return;
  const x = u.x - cam, y = npcFeetY() - 4, now = performance.now() / 1000;
  ctx.save();
  ctx.fillStyle = `rgba(255,220,140,${0.25 + 0.15 * Math.sin(now * 4)})`;
  ctx.beginPath(); ctx.ellipse(x, y, 26, 7, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#c9a77a'; ctx.fillRect(x - 9, y - 22, 18, 20);     // paper to-go bag
  ctx.fillStyle = '#a3825a'; ctx.fillRect(x - 9, y - 22, 18, 4);
  ctx.fillStyle = '#fff'; ctx.fillRect(x - 5, y - 15, 10, 6);           // order ticket
  ctx.font = 'bold 9px sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#e6d3a2';
  ctx.fillText('PICK-UP', x, y - 28); ctx.textAlign = 'left';
  ctx.restore();
}
/** Playable Silas: Jack's silas_player (or the silas_boss art) at BOSS_SCALE, sheet fallback. */
function drawDlcSilas(cam) {
  const px = player.x - cam;
  if (player.invuln > 0 && player.attackType !== 'silas' && Math.floor(performance.now() / 80) % 2) ctx.globalAlpha = 0.45;
  const key = player.animKey || 'silas_boss';
  let f = animFrame(key, player.animState, animMs(player));
  if (!f && key !== 'silas_boss') f = animFrame('silas_boss', (silasAnimMap('silas_boss')[player.animState] || player.animState), animMs(player));
  if (player.silasMove && player.silasMove.kind === 'rush' && f) { // shoulder-charge afterimages
    const a0 = ctx.globalAlpha;
    for (let i = 3; i >= 1; i--) { ctx.globalAlpha = 0.14 * (4 - i); drawAnimFrame(f, px - player.facing * 18 * i, player.y, player.facing, BOSS_SCALE); }
    ctx.globalAlpha = a0;
  }
  if (f) drawAnimFrame(f, px, player.y, player.facing, BOSS_SCALE);
  else {
    const pose = player.pose === 'walk' ? 'walk' : player.pose === 'hurt' ? 'hurt' : player.attackType ? 'attack' : 'idle';
    withLie(player, px, player.y, () => drawCastSprite(getEnemySprite(pose, '#2c3e50', player.animT, true), px, player.y, player.facing, BOSS_SCALE));
  }
  ctx.globalAlpha = 1;
  if (player.stamina < 100 && player.alive) drawStaminaPip(px, player.y);
}
/** Closing scene extras: Matthew far off (polo, no interaction) and the crew gathering at the far end. */
function drawFinaleActor(a, cam) {
  const x = a.x - cam;
  if (a.kind === 'cast') { // 1.7.0 arrest: cast anim actors (cops, Silas, Wren)
    const st = a.walking ? 'walk' : (gameState.mode === 'dialogue' && gameState.dialogue && gameState.dialogue[gameState.dialogueIdx]?.id === a.id ? 'talk' : (a.state || 'idle_personality')); // 1.9.0: scene anim state
    const sc = a.scale || castScaleNpc(a.key);
    const speaking = gameState.mode === 'dialogue' && gameState.dialogue && gameState.dialogue[gameState.dialogueIdx]?.id === a.id;
    const pf = a.pose && !a.walking && SpriteLib.getCutscenePose ? SpriteLib.getCutscenePose(a.key, a.pose, speaking && mouthOpen()) : null; // 1.9.0 scene pose
    const wt = a.walking ? strideClockMs(a, a.key, 'walk', sc) : null; // 2.1.1: feet locked to distance walked
    const f = pf || animFrame(a.key, st, wt ?? (performance.now() + (a.phase || 0))) || animFrame(a.key, 'idle_personality', performance.now()) || animFrame(a.key, 'idle', performance.now()); // Foreman: anim frame when no still
    if (f) drawAnimFrame(f, x, a.y, a.facing, sc);
    else drawCastSprite(getNpcSprite(a.key, '#2c3e50', performance.now() / 1000), x, a.y, a.facing, sc);
    return;
  }
  if (a.kind === 'matthew') {
    const st = a.walking ? 'walk' : 'idle';   // 2.1.1: strut + breathing idle (new art)
    const wt = a.walking ? strideClockMs(a, 'matthew', 'walk', PLAYER_SCALE, 'polo') : null;
    const f = animFrame('matthew', st, wt ?? a.t * 1000, 'polo');
    if (f) drawAnimFrame(f, x, a.y, a.facing, PLAYER_SCALE);
    else drawMatthew(a.walking ? 'walk' : 'idle', 'polo', OUTFITS.polo, a.t, x, a.y, a.facing);
  } else {
    const f = animFrame('foreman_crew', 'idle', a.t * 1000); // 1.5.2: the Foreman's crew art
    if (f) drawAnimFrame(f, x, a.y, a.facing, THUG_SCALE);
    else drawCastSprite(getEnemySprite('idle', '#7f8c8d', a.t, false), x, a.y, a.facing, THUG_SCALE);
  }
}
/** Closing scene: golden hour, Silas at x 700, Cam at 520; Matthew walks into frame far off; no meeting. */
function startFinale(onDone) {
  gameState.enemies = []; gameState.combatLock = false;
  const band = getDepthBand();
  player.x = 700; player.y = clampDepth(Math.round((band.min + band.max) / 2)); player.facing = -1; player.vx = 0;
  player.attackType = null; player.attackTimer = 0; player.hitbox = null;
  gameState.cutscene = { t: 0, phase: 'walk', onDone };
  // 1.9.0: played by the scene player (js/scene_player.js); the frame is the camera Silas will have
  // (facing left at x 700), so Matthew walks INTO view (1.5.1)
  playScene('dlc_closing', { onDone: () => { const fn = onDone; gameState.cutscene = null; if (fn) fn(); } });
  toast('Golden hour, Jefferson Street.', true);
}
/** 1.9.0: the DLC closing scene as data (was updateCutscene). */
registerScene({
  id: 'dlc_closing',
  keepNpcs: ['cam'],
  actors: (c) => {
    const L = c.frame.x, V = c.frame.viewW, band = c.band;
    return [
      { kind: 'matthew', id: 'matthew', x: L - 40, y: band.max - 6, facing: 1, walking: false, t: 0, stopAt: Math.round(L + V * 0.2) },
      { kind: 'thug', id: 'crew1', color: 'grey', x: Math.round(L + V - 70), y: band.min + 10, facing: -1, t: 0 },
      { kind: 'thug', id: 'crew2', color: 'red', x: Math.round(L + V - 30), y: band.min + 26, facing: -1, t: 0.4 }
    ];
  },
  steps: (c, A) => [
    { kind: 'letterbox', to: 1, dur: 0.5, async: true },
    { kind: 'moveActor', id: 'matthew', to: A[0].stopAt, speed: 70 },
    { kind: 'call', fn: () => { if (gameState.cutscene) gameState.cutscene.phase = 'talk'; } },
    { kind: 'lines', lines: [
      { id: 'silas', name: 'Silas Boone', text: 'An everyday guy in a white polo, buying zinnias from the girl at the flower cart. She owes three people money. Soon she\'ll owe only me.' },
      { id: 'silas', name: 'Silas Boone', text: 'Matthew Rose. Wren Calloway\'s friend. Write that name down, Pip.' },
      { id: 'silas', name: 'Silas Boone', text: 'Every name on this street is a debt, sooner or later. One day this whole city will look up at that Star and think of me.' }
    ] },
    { kind: 'call', fn: () => { if (gameState.cutscene) { gameState.cutscene.phase = 'done'; gameState.cutscene.doneT = gameState.cutscene.t; } } },
    { kind: 'wait', dur: 0.8 }
  ]
});
/** Kept for old call sites: the scene player drives the closing scene now. */
function updateCutscene(dt) { if (gameState.cutscene) gameState.cutscene.t += dt; }

// ---------- Bob's cards (#dlc-mission-card, #dlc-ending-screen) ----------
let dlcCardDone = null;
// ===================== 1.7.0 "Locked Up": the arrest, Cinder Hollow use-spots, Silas in cell C-14 =====================
/** Boss down → honest police arrive in the rain, cuff Silas, walk him off; then the court + prison cards → ending. */
function startArrest(bossX, bossY) {
  gameState.enemies = []; gameState.combatLock = false;
  player.vx = 0; player.attackType = null; player.attackTimer = 0; player.hitbox = null;
  gameState.arrest = { t: 0, phase: 'arrive', bossX, bossY };
  playScene('arrest', { onDone: () => { // 1.9.0: scene player; court + prison cards follow (or straight to the ending)
    const A = gameState.arrest; if (!A) return;
    A.phase = 'court'; gameState.finaleActors = [];
    if (A.direct) endArrest();
    else showDlcCard(SENTENCING_CARD, () => showDlcCard(PRISON_CARD, () => endArrest()));
  } });
  toast('Sirens on the mountain road. Blue and red through the rain.', true);
  sfx('denied');
}
function arrestActor(id) { return gameState.finaleActors.find((a) => a.id === id); }
/** 1.9.0: the 1.7.0 arrest as scene data. Phases (gameState.arrest.phase) stay arrive → talk1 → cuff → talk2 → leave → court. */
registerScene({
  id: 'arrest',
  actors: (c) => {
    const A = gameState.arrest, band = c.band, L = c.frame.x, V = c.frame.viewW;
    const sx = Math.round(Math.max(L + 260, Math.min(L + V - 90, A.bossX ?? player.x + 110)));
    const sy = clampDepth(Math.round(A.bossY ?? player.y));
    A.sx = sx; A.sy = sy;
    player.facing = sx >= player.x ? 1 : -1;
    if (Math.abs(player.x - sx) < 70) player.x = sx + 90 < L + V - 30 ? sx + 90 : sx - 90;
    return [
      { kind: 'cast', id: 'silas', key: 'silas', x: sx, y: sy, facing: player.x > sx ? 1 : -1 },
      { kind: 'cast', id: 'reyes', key: 'reyes', x: L - 50, y: Math.max(band.min + 10, sy - 14), facing: 1, walking: true, stopAt: sx - 150, phase: 300 },
      { kind: 'cast', id: 'okafor', key: 'okafor', x: L - 120, y: Math.min(band.max - 4, sy + 12), facing: 1, walking: true, stopAt: sx - 80, phase: 700 },
      { kind: 'cast', id: 'wren', key: 'wren', x: Math.round(Math.min(L + V - 40, Math.max(player.x, sx) + 120)), y: band.min + 4, facing: -1, phase: 200 }
    ];
  },
  steps: (c, act) => {
    const A = gameState.arrest, sx = A.sx, ph = (p) => ({ kind: 'call', fn: () => { if (gameState.arrest) { gameState.arrest.phase = p; gameState.arrest.pt = gameState.arrest.t; } } });
    return [
      { kind: 'letterbox', to: 1, dur: 0.5, async: true },
      { kind: 'moveActor', id: 'reyes', to: sx - 150, speed: 110, async: true },
      { kind: 'moveActor', id: 'okafor', to: sx - 80, speed: 110 },
      { kind: 'anim', id: 'reyes', facing: 1 }, { kind: 'anim', id: 'okafor', facing: 1 },
      ph('talk1'),
      { kind: 'lines', lines: ARREST_LINES.slice(0, 3) },
      ph('cuff'),
      { kind: 'moveActor', id: 'okafor', to: sx - 40, speed: 90, async: true },
      { kind: 'wait', dur: 0.6 },
      { kind: 'anim', id: 'silas', key: 'silas_cuffed', facing: -1 },
      { kind: 'call', onSkip: false, fn: () => { sfx('block'); sfx('pickup', { delay: 0.12 }); rumble(0.3, 0.3, 120); } }, // metal click of the cuffs
      { kind: 'wait', dur: 1.0 },
      ph('talk2'),
      { kind: 'lines', lines: ARREST_LINES.slice(3) },
      { kind: 'anim', id: 'wren', facing: player.x < (act.find((a) => a.id === 'wren')?.x ?? 0) ? -1 : 1 },
      { kind: 'lines', lines: [{ id: 'wren', name: 'Wren Calloway', text: "He kept saying you'd come. Like he knew you." }] }, // JACK-STORY: Wren's rescue line (connections_map.md)
      ph('leave'),
      { kind: 'anim', id: 'reyes', facing: -1 },
      { kind: 'moveActor', id: 'okafor', to: sx - 40 - 900, speed: 70, async: true },
      { kind: 'moveActor', id: 'silas', to: sx - 900, speed: 70, async: true },
      { kind: 'wait', dur: 3.4 }
    ];
  }
});
/** Kept for old call sites: the arrest clock (police lights fade in on it). */
function updateArrest(dt) { if (gameState.arrest) gameState.arrest.t += dt; }
function endArrest() {
  gameState.arrest = null;
  gameState.finaleActors = [];
  if (!gameState.ended) showEnding();
}
/** Debug / tests: jump straight past the arrest to the ending (same end state). */
function skipArrest() {
  if (!gameState.arrest) return false;
  if (isScenePlaying() && currentScene().id === 'arrest') { gameState.arrest.direct = true; skipScene(); return true; } // 1.9.0
  gameState.arrest.phase = 'court';
  if (gameState.mode === 'dialogue') { stopTalk(); $('dialogue').classList.add('hidden'); gameState.mode = 'play'; gameState.dialogue = null; gameState.dialogueNpc = null; }
  if (gameState.mode === 'card') { $('dlc-mission-card').classList.add('hidden'); clearMenuFocus(); dlcCardDone = null; gameState.mode = 'play'; }
  endArrest();
  return true;
}
function drawPoliceLights(w, h) {
  const t = performance.now() / 1000, A = gameState.arrest;
  const k = Math.min(1, (A ? A.t : 1) / 1.5);
  const red = Math.floor(t * 3) % 2 === 0;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const g = ctx.createRadialGradient(0, h * 0.55, 10, 0, h * 0.55, w * 0.55);
  g.addColorStop(0, red ? `rgba(255,40,40,${0.32 * k})` : `rgba(40,90,255,${0.32 * k})`);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

/** Bus stop signs + the library return cart. */
function drawPrisonMarkers(cam) {
  if (!prisonOpen(stateBag)) return;
  const y = npcFeetY() - 4, now = performance.now() / 1000;
  if (gameState.areaId === 'pr_block') { // Silas's cell C-14 (world space, behind him)
    const cx = 1260 - cam, top = y - 168;
    ctx.save();
    ctx.fillStyle = 'rgba(20,24,32,0.55)'; ctx.fillRect(cx - 62, top, 124, 164);          // cell interior shade
    ctx.fillStyle = '#6d7480'; ctx.fillRect(cx - 68, top - 6, 136, 8); ctx.fillRect(cx - 68, top, 7, 166); ctx.fillRect(cx + 61, top, 7, 166);
    ctx.fillStyle = '#8a919c'; for (let i = 0; i < 6; i++) ctx.fillRect(cx - 58 + i * 9, top + 2, 3, 160); // slid-open door bars (left)
    ctx.fillStyle = '#4b4f57'; ctx.fillRect(cx - 60, top + 60, 54, 4);
    ctx.fillStyle = '#7b6a4e'; ctx.fillRect(cx + 14, y - 46, 44, 10); ctx.fillStyle = '#c9c2b0'; ctx.fillRect(cx + 16, y - 52, 40, 6); // cot
    ctx.fillStyle = '#2a2d33'; ctx.fillRect(cx - 26, top - 30, 52, 20); ctx.strokeStyle = '#f0dc64'; ctx.lineWidth = 2; ctx.strokeRect(cx - 26, top - 30, 52, 20);
    ctx.fillStyle = '#f0dc64'; ctx.font = 'bold 13px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('C-14', cx, top - 15); ctx.textAlign = 'left';
    ctx.restore();
  }
  for (const sId of ['bus_out', 'bus_home', 'keepsake']) {
    const sp = prisonSpot(stateBag, gameState.areaId, ({ bus_out: 820, bus_home: 110, keepsake: 930 })[sId]);
    if (!sp || sp.id !== sId) continue;
    const x = sp.x - cam;
    if (x < -60 || x > W + 60) continue;
    ctx.save();
    ctx.fillStyle = `rgba(255,220,140,${0.22 + 0.14 * Math.sin(now * 4)})`;
    ctx.beginPath(); ctx.ellipse(x, y, 26, 7, 0, 0, Math.PI * 2); ctx.fill();
    if (sId === 'keepsake') {
      ctx.fillStyle = '#6b4a2e'; ctx.fillRect(x - 16, y - 26, 32, 20);    // return cart
      ctx.fillStyle = '#2b2b2b'; ctx.fillRect(x - 14, y - 6, 4, 4); ctx.fillRect(x + 10, y - 6, 4, 4);
      ctx.fillStyle = '#d9cfb4'; ctx.fillRect(x - 12, y - 32, 10, 8); ctx.fillStyle = '#b44a3a'; ctx.fillRect(x, y - 33, 6, 9); ctx.fillStyle = '#3c6b8f'; ctx.fillRect(x + 7, y - 31, 6, 7);
      ctx.font = 'bold 9px sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#e6d3a2'; ctx.fillText('RETURNS', x, y - 38);
    } else {
      ctx.fillStyle = '#5a5f66'; ctx.fillRect(x - 2, y - 74, 4, 72);       // pole
      ctx.fillStyle = '#1f5fa8'; ctx.fillRect(x - 18, y - 92, 36, 22);    // sign
      ctx.fillStyle = '#fff'; ctx.font = 'bold 9px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('BUS', x, y - 83); ctx.fillText('ROUTE 9', x, y - 73);
    }
    ctx.textAlign = 'left';
    ctx.restore();
  }
}
function travelTo(areaId, x, facing = 1) {
  if (!AREAS[areaId]) return false;
  gameState.areaId = areaId;
  player.x = x; player.facing = facing; player.vx = 0;
  syncDepthBand();
  gameState.enemies = []; gameState.combatLock = false; gameState.spawnChecked = false;
  gameState.areaVisitCombat[areaId] = 1; // no ambush right off the bus
  updateHUD();
  persist();
  followCam.cut();
  return true;
}
function usePrisonSpot(sp) {
  if (sp.id === 'bus_out') {
    sfx('ui_move');
    showDlcCard(PRISON_CARD, () => { travelTo('pr_lobby', 220, 1); toast(stateBag.silasVisited ? 'Cinder Hollow Correctional. Visiting hours.' : 'Cinder Hollow Correctional. Silas Boone is in Cell Block C, cell C-14.', true); });
  } else if (sp.id === 'bus_home') {
    sfx('ui_move');
    travelTo('community', 780, -1);
    toast('Back in Roanoke. The Route 9 bus goes back to Cinder Hollow any time.');
  } else if (sp.id === 'keepsake') {
    stateBag.prisonKeepsake = true;
    gameState.score += KEEPSAKE.score;
    sfx('pickup');
    toast(`Found: ${KEEPSAKE.name} (+${KEEPSAKE.score})`, true);
    startDialogueRaw({ id: 'matthew', name: KEEPSAKE.name, role: '', onDone: () => persist() }, [{ id: 'matthew', name: KEEPSAKE.name, text: KEEPSAKE.text }]);
    updateHUD();
    persist();
  }
}

/** Silas in cell C-14: node lines play as dialogue, then up to 5 choices (click, 1-5, arrows + E/Enter). */
function startSilasTalk(npc) {
  gameState.silasTalk = { npc, node: 'start' };
  playSilasNode('start');
}
function playSilasNode(id) {
  const T = gameState.silasTalk; if (!T) return;
  const node = SILAS_TREE[id]; T.node = id;
  const npc = { ...T.npc, onDone: () => {
    if (!gameState.silasTalk) return;
    if (node.end) { endSilasTalk(); return; }
    const list = silasChoices(node, { keepsake: !!stateBag.prisonKeepsake, visited: !!stateBag.silasVisited });
    if (!list || !list.length) { endSilasTalk(); return; }
    showChoices(T.npc, node.lines[node.lines.length - 1], list);
  } };
  startDialogueRaw(npc, node.lines.slice());
}
function showChoices(npc, lastLine, list) {
  hideStoryIntro();
  gameState.mode = 'dialogue';
  gameState.dialogueNpc = { ...npc, onDone: null };
  gameState.dialogue = [lastLine];
  gameState.dialogueIdx = 0;
  gameState.choice = { list, focus: 0 };
  $('dialogue').classList.remove('hidden');
  $('dialogue-name').textContent = `${npc.name} — ${npc.role}`;
  $('dialogue-text').textContent = lastLine;
  const box = $('dialogue-choices');
  box.innerHTML = '';
  list.forEach((c, i) => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'choice'; b.dataset.i = String(i);
    b.textContent = `${i + 1}. ${c.label}`;
    b.addEventListener('click', (e) => { e.preventDefault(); pickChoice(i); });
    box.appendChild(b);
  });
  box.classList.remove('hidden');
  $('dialogue-next').classList.add('hidden');
  focusChoice(0);
  input.flush();
}
function focusChoice(i) {
  const C = gameState.choice; if (!C) return;
  C.focus = (i + C.list.length) % C.list.length;
  [...$('dialogue-choices').children].forEach((b, j) => b.classList.toggle('pad-focus', j === C.focus));
}
function hideChoices() {
  gameState.choice = null;
  $('dialogue-choices').classList.add('hidden');
  $('dialogue-choices').innerHTML = '';
  $('dialogue-next').classList.remove('hidden');
}
function pickChoice(i) {
  const C = gameState.choice; if (!C || !C.list[i]) return;
  const c = C.list[i];
  hideChoices();
  sfx('ui_move');
  // 1.9.0 fix (VO-HOOK M5): stay in 'dialogue' while Matthew's choice clip plays, so the player can't walk off or
  // re-open the talk mid-clip; his line shows in the box and E / Enter / Cross skips the clip (VO.stop resolves play()).
  const tok = {}; gameState.choiceVo = tok;
  gameState.mode = 'dialogue'; gameState.dialogue = [c.label]; gameState.dialogueIdx = 0;
  gameState.dialogueNpc = { id: 'matthew', name: 'Matthew Rose', role: '', onDone: null };
  dlgPortrait.line = { id: 'matthew' };
  $('dialogue-name').textContent = 'Matthew Rose'; $('dialogue-text').textContent = c.label;
  VO.play(`prison.choice.${c.to}`).then(() => { if (gameState.choiceVo !== tok) return; gameState.choiceVo = null; playSilasNode(c.to); }); // VO-HOOK: Matthew speaks his choice ("Ask something else." has no clip → at once)
}
function endSilasTalk() {
  if (gameState.choiceVo) { gameState.choiceVo = null; VO.stop(); } // 1.9.0: closing mid choice clip
  hideChoices();
  gameState.silasTalk = null;
  if (gameState.mode === 'dialogue') { stopTalk(); $('dialogue').classList.add('hidden'); gameState.mode = 'play'; gameState.dialogue = null; gameState.dialogueNpc = null; input.flush(); input.focusGame(); }
  const first = !stateBag.silasVisited;
  stateBag.silasVisited = true;
  if (checkCinder()) toast(`Cinder Hollow Orange unlocked! ${cinderHowTo()}`, true);
  else if (first) toast('You visited Silas Boone.');
  updateHUD();
  persist();
}
window.addEventListener('keydown', (e) => {
  const C = gameState.choice;
  if (!C || gameState.mode !== 'dialogue') return;
  if (e.key >= '1' && e.key <= '9') { const i = Number(e.key) - 1; if (C.list[i]) { e.preventDefault(); e.stopImmediatePropagation(); pickChoice(i); } return; }
  if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') { e.preventDefault(); focusChoice(C.focus + 1); }
  else if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') { e.preventDefault(); focusChoice(C.focus - 1); }
}, true);
// ===================== <<< 1.7.0 =====================

function showDlcCard({ eyebrow = 'Prequel · Silas Boone', title: t = 'Mission Complete', name = '', sub = '' }, onDone) {
  $('dlc-mission-eyebrow').textContent = eyebrow;
  $('dlc-mission-title').textContent = t;
  $('dlc-mission-name').textContent = name;
  $('dlc-mission-sub').textContent = sub;
  const dev = getPromptDevice();
  $('dlc-mission-hint').textContent = dev === 'touch' ? 'Tap to continue' : dev === 'keyboard' ? 'Enter · Z to continue' : `${getPromptLabel('confirm')} to continue`;
  dlcCardDone = onDone || null;
  gameState.mode = 'card';            // game loop + input paused while the card is up
  $('interact-prompt').classList.add('hidden');
  $('dlc-mission-card').classList.remove('hidden');
  input.flush();
  menuFocus(0, $('dlc-mission-card'));
}
function closeDlcCard() {
  if (gameState.mode !== 'card') return;
  $('dlc-mission-card').classList.add('hidden');
  clearMenuFocus();
  gameState.mode = 'play';
  input.flush(); input.focusGame();
  const fn = dlcCardDone; dlcCardDone = null;
  if (fn) fn();
  updateHUD();
}
function suitStillSrc() {
  try {
    const own = SpriteLib.getAnimFrame && SpriteLib.getAnimFrame('matthew', 'idle_signature', 0, artOutfitFor('silas'));
    let c;
    if (own && !suitNeedsTint('silas')) { c = document.createElement('canvas'); c.width = own.sw; c.height = own.sh; c.getContext('2d').drawImage(own.img, own.sx, own.sy, own.sw, own.sh, 0, 0, own.sw, own.sh); }
    else c = tintedCanvas(getMatthewSprite('idle', artOutfitFor('silas'), OUTFITS[artOutfitFor('silas')], 0));
    return c ? c.toDataURL('image/png') : null;
  } catch (_) { return null; }
}
function showDlcEnding() {
  gameState.mode = 'ending';
  gameState.ended = true;
  if (dlc.endingInfo) { // 2.0.0 Blackriver: own ending card + sequel hook
    const e = dlc.endingInfo();
    $('dlc-ending-eyebrow').textContent = e.eyebrow; $('dlc-ending-title').textContent = e.title; $('dlc-ending-text').textContent = e.text;
    $('dlc-unlock-label').textContent = e.unlock; $('dlc-unlock-sub').textContent = e.unlockSub;
    const im = $('dlc-unlock-img'); if (im) im.src = 'assets/sprites/portrait_silas.png';
    const mb = $('btn-dlc-ending-main'); if (mb) mb.textContent = hasSave() ? 'Continue the Main Story ▸' : 'Start the Main Story ▸';
    $('interact-prompt').classList.add('hidden'); $('dlc-ending-screen').classList.remove('hidden'); persist(); input.flush();
    menuFocus(0, $('dlc-ending-screen')); return;
  }
  $('dlc-ending-eyebrow').textContent = 'Prequel Ending · Second Shift';
  $('dlc-ending-title').textContent = 'Before the Star';
  // JACK-STORY: the 2015 rework's ending + 'Eleven years later.' card come from js/dlc_silas.js
  $('dlc-ending-text').textContent = (dlc && dlc.endingText && dlc.endingText()) || 'The Foreman\'s crew answers to a new boss. Vera Lisk\'s files sit in a new safe. Two patrol cars look the other way.\n' +
    'A lantern stenciled "S.B. — 2nd shift" waits under the River Bridge rail, and a crate of Boone Holdings paperwork rolled out of the Rail Yards.\n' +
    'Across Jefferson Street, Matthew Rose buys zinnias from a friend whose name is already in Silas\'s ledger.\n\n' +
    'Silas Boone straightens his gloves. The man who once stood up to the Foreman has become something worse. Lovely evening.';
  const src = suitStillSrc(); if (src) $('dlc-unlock-img').src = src;
  $('dlc-unlock-label').textContent = "Silas's Suit unlocked for Matthew";
  $('dlc-unlock-sub').textContent = `Main game: ${suitHowTo()}. Fights with all six of Silas's moves.`;
  const mainBtn = $('btn-dlc-ending-main');
  if (mainBtn) mainBtn.textContent = hasSave() ? 'Continue the Main Story ▸' : 'Start the Main Story ▸';
  $('interact-prompt').classList.add('hidden');
  $('dlc-ending-screen').classList.remove('hidden');
  persist();
  input.flush();
  menuFocus(mainBtn ? 0 : 0, $('dlc-ending-screen'));
}
// one extra button next to Bob's "Back to Title": straight into the main opening ("Find Dee Morales")
(() => {
  const back = $('btn-dlc-ending-continue');
  if (!back || $('btn-dlc-ending-main')) return;
  const b = document.createElement('button');
  b.type = 'button'; b.id = 'btn-dlc-ending-main'; b.className = 'btn dlc-btn';
  b.textContent = 'Start the Main Story ▸';
  back.parentNode.insertBefore(b, back);
})();

// ---------- pause (prequel): Quit to Title instead of Outfits ----------
(() => {
  const card = $('pause-screen') && $('pause-screen').querySelector('.overlay-card');
  if (!card || $('btn-dlc-quit')) return;
  const b = document.createElement('button');
  b.type = 'button'; b.id = 'btn-dlc-quit'; b.className = 'btn btn-secondary hidden';
  b.textContent = 'Save & Quit to Title';
  const ref = $('btn-missions');
  card.insertBefore(b, ref || null);
})();
function syncDlcPause() {
  $('btn-dlc-quit')?.classList.toggle('hidden', !isDlc());
  $('btn-outfit')?.classList.toggle('hidden', isDlc());
  $('btn-missions')?.classList.toggle('hidden', isDlc());
  if (isDlc()) $('mission-list')?.classList.add('hidden');
}

// ---------- touch: GRIP button (Velvet Grip / heavy) while Silas's moveset is active ----------
(() => {
  const host = $('mobile-buttons');
  if (!host || $('btn-grip')) return;
  const b = document.createElement('button');
  b.type = 'button'; b.id = 'btn-grip'; b.className = 'mob-btn hidden';
  b.setAttribute('aria-label', 'Velvet Grip (heavy)');
  b.textContent = 'GRIP';
  host.insertBefore(b, $('btn-pause') || null);
  input.bindButton && input.bindButton('btn-grip', () => { input.state.heavyPressed = true; });
})();
function syncSilasControls() {
  $('btn-grip')?.classList.toggle('hidden', !silasSet());
  const sp = $('btn-special');
  if (sp) sp.setAttribute('aria-label', silasSet() ? 'Iron Handshake (special)' : 'Star Drive special');
}

// ---------- title: Prequel entry (Bob's #btn-prequel) ----------
// small prequel panel (Continue / New / Back) — only shown when a prequel run is saved; uses the title panel styles
(() => {
  const host = $('title-screen');
  if (!host || $('title-prequel')) return;
  const sec = document.createElement('section');
  sec.id = 'title-prequel'; sec.className = 'title-panel'; sec.setAttribute('aria-label', 'Prequel: Silas Boone');
  sec.innerHTML = '<h2>Prequel: Silas Boone</h2><div class="title-help prequel-blurb">Second Shift: one long night in Star City and the evening after. How a man who protected one corner became the owner of the whole city, months before the Star went dark.</div>' +
    '<button type="button" id="btn-prequel-continue" class="btn">Continue Prequel</button>' +
    '<button type="button" id="btn-prequel-new" class="btn">New Prequel</button>' +
    '<button type="button" id="btn-prequel-back" class="btn btn-secondary">Back</button>';
  const after = $('title-difficulty');
  host.insertBefore(sec, after ? after.nextSibling : null);
})();
let confirmTextSaved = null;
function restoreConfirmText() {
  if (confirmTextSaved) { $('confirm-title').textContent = confirmTextSaved[0]; $('confirm-text').textContent = confirmTextSaved[1]; $('btn-confirm-yes').textContent = confirmTextSaved[2]; }
  confirmTextSaved = null; gameState.confirmDlc = false; gameState.confirmNg = false;
}
function openPrequel() {
  if (dlcHasRun()) title.openPrequel();
  else { gameState.pendingDlc = true; title.openDifficulty(true); }
}
bindTap('btn-prequel', () => whenReady(openPrequel));
// ---------- 2.0.0: title entry for DLC 'Blackriver' (continue if a run exists, else pick a difficulty) ----------
(function addBlackriverButton() {
  const pre = $('btn-prequel'); if (!pre || $('btn-blackriver')) return;
  const b = document.createElement('button'); b.type = 'button'; b.id = 'btn-blackriver'; b.className = 'btn btn-prequel btn-blackriver';
  b.setAttribute('aria-label', 'DLC: Blackriver (Silas Boone, 2028)');
  b.innerHTML = '<span class="prequel-label">DLC: Blackriver</span><span class="dlc-badge" aria-hidden="true">2028 · NEW</span>';
  pre.insertAdjacentElement('afterend', b);
})();
bindTap('btn-blackriver', () => whenReady(() => {
  if (brHasRun()) { startDlc(true, 'blackriver'); return; }
  gameState.pendingDlc = 'blackriver'; title.openDifficulty(true);
}));
function brToggleOutfit() {
  if (!isBr()) return null;
  if (!dlc.outfitUnlocked()) { toast('The C-14 jumpsuit unlocks once Silas has his red suit.'); return null; }
  const o = dlc.toggleOutfit(); toast(o === 'c14' ? 'Outfit: C-14 jumpsuit' : 'Outfit: red suit', true); sfx('ui_select'); return o;
}
bindTap('btn-prequel-continue', () => whenReady(() => startDlc(true)));
bindTap('btn-prequel-new', () => whenReady(() => {
  gameState.pendingDlc = true;
  if (!dlcHasRun()) { title.openDifficulty(true); return; }
  confirmTextSaved = [$('confirm-title').textContent, $('confirm-text').textContent, $('btn-confirm-yes').textContent];
  gameState.confirmDlc = true;
  $('confirm-title').textContent = 'Start the Prequel Over?';
  $('confirm-text').textContent = 'This restarts your Silas Boone run. Your main-game save and any unlocked Silas\'s Suit are kept.';
  $('btn-confirm-yes').textContent = 'Yes, Start Over';
  openConfirm();
}));
bindTap('btn-dlc-mission-continue', () => closeDlcCard());
bindTap('btn-dlc-ending-continue', () => { $('dlc-ending-screen').classList.add('hidden'); quitDlcToTitle(); });
bindTap('btn-dlc-ending-main', () => {
  $('dlc-ending-screen').classList.add('hidden');
  quitDlcToTitle();
  whenReady(() => {
    if (hasSave()) startGame(true);
    else { gameState.pendingDlc = false; title.openDifficulty(); }
  });
});
bindTap('btn-dlc-quit', () => { if (gameState.mode === 'pause') quitDlcToTitle(); });
// 1.5.1: version tag (title corner + Credits) and the prequel cast in Credits
(() => {
  const host = $('title-screen');
  if (host && !$('game-version')) {
    const v = document.createElement('div');
    v.id = 'game-version'; v.textContent = 'v' + GAME_VERSION; v.setAttribute('aria-label', 'Version ' + GAME_VERSION);
    host.appendChild(v);
  }
  const cred = $('title-credits');
  if (cred && !$('credits-prequel')) {
    const d = document.createElement('div');
    d.id = 'credits-prequel'; d.className = 'credits-prequel';
    d.innerHTML = '<strong>Prequel: Silas Boone</strong><br>Lou Badger · Ivy Marsh · Gus Pell · Pip · Vera Lisk · Mort "The Foreman" Kessler';
    const made = cred.querySelector('.made-with');
    cred.insertBefore(d, made || cred.querySelector('#btn-credits-back'));
    if (made && !/v\d/.test(made.textContent)) made.textContent += ' · v' + GAME_VERSION;
  }
})();
// ============================================================ <<< DLC: Silas prequel

// New Game -> (overwrite confirm) -> difficulty selector -> start
bindTap('btn-start', () => whenReady(() => { gameState.pendingDlc = false; title.openDifficulty(); }));
bindTap('btn-continue', () => whenReady(() => startGame(true)));
bindTap('btn-new-game', () => {
  gameState.pendingDlc = false;
  if (hasSave()) openConfirm();
  else whenReady(() => title.openDifficulty());
});
// New Game+ -> confirm -> story reset, unlocks kept, ngPlus + 1 (difficulty carries over)
bindTap('btn-ngplus', () => {
  if (gameState.mode !== 'title' || !saveSummary().storyBeaten) return;
  confirmTextSaved = [$('confirm-title').textContent, $('confirm-text').textContent, $('btn-confirm-yes').textContent];
  gameState.confirmNg = true;
  $('confirm-title').textContent = `Start New Game+ ${saveSummary().ngPlus + 1}?`;
  $('confirm-text').textContent = 'The story starts over from the beginning and overwrites your current save. Outfits, collectibles, score and unlocks are kept. Enemies hit a little harder.';
  $('btn-confirm-yes').textContent = 'Yes, New Game+';
  openConfirm();
});
function startNgPlus() {
  if (gameState.mode !== 'title') return;
  const r = inspectSave();
  const d = r.data && makeNgPlusSave(r.data);
  if (!d || !saveGame(d)) { toast("Couldn't start New Game+ — save unavailable"); return; }
  gameState.ngPlusStart = true;
  startGame(true);
}
bindTap('btn-confirm-yes', () => {
  if (gameState.confirmNg) { $('confirm-screen').classList.add('hidden'); restoreConfirmText(); whenReady(startNgPlus); return; }
  $('confirm-screen').classList.add('hidden');
  if (gameState.confirmDlc) restoreConfirmText(); // DLC: "start the prequel over" used the same dialog
  whenReady(() => title.openDifficulty(gameState.pendingDlc));
});
for (const id of DIFFICULTY_ORDER) {
  bindTap(`btn-diff-${id}`, () => whenReady(() => {
    if (gameState.mode !== 'title') return;
    if (gameState.pendingDlc) { // DLC: Silas prequel — its own slot; the main save is not touched
      const which = gameState.pendingDlc === 'blackriver' ? 'blackriver' : 'silas';
      gameState.pendingDlc = false;
      gameState.pendingDifficulty = id;
      startDlc(false, which);
      toast(`Difficulty: ${DIFFICULTIES[id].name}`);
      return;
    }
    clearSave(); // only reachable via New Game (with the overwrite confirm when a save exists)
    gameState.pendingDifficulty = id;
    startGame(false);
    toast(`Difficulty: ${DIFFICULTIES[id].name}`);
  }));
}
bindTap('btn-difficulty', () => cycleDifficulty());
bindTap('btn-missions', () => toggleMissionList());
bindTap('btn-confirm-no', () => { if (gameState.confirmNg) restoreConfirmText(); if (gameState.confirmDlc) { restoreConfirmText(); gameState.pendingDlc = false; } closeConfirm(); });
bindTap('btn-resume', () => resumeGame());
bindTap('btn-save', () => manualSave());
bindTap('btn-outfit', () => openOutfitPicker()); // opens the visual picker (L1/R1 + 1-9/0/-/= still cycle in play)
bindTap('btn-pause', () => pauseGame()); // phone pause button (Save Game / outfits live there)

// >>> 1.7.0 weather (Kody, PR #20): Sunny / Night / Rainy on the title, pause menu, T / View-Create, touch button
function refreshWeatherUi() {
  const id = getWeather();
  document.querySelectorAll('.weather-opt').forEach((b) => {
    const on = b.dataset.weather === id;
    b.classList.toggle('is-on', on);
    b.setAttribute('aria-pressed', on ? 'true' : 'false');
  });
  const touch = $('btn-weather-touch');
  if (touch) {
    touch.textContent = weatherShort();
    touch.setAttribute('aria-label', `Weather: ${weatherName()}. Tap to change.`);
  }
}
function pickWeather(id) {
  if (id !== 'sunny' && id !== 'night' && id !== 'rainy') return;
  if (id === getWeather()) return;
  setWeather(id);
  refreshWeatherUi();
  if (gameState.mode !== 'title') sfx('ui_select');
}
function cycleWeatherChoice() {
  cycleWeather();
  refreshWeatherUi();
  sfx('ui_select');
  if (gameState.mode !== 'title') toast(`Weather: ${weatherName()}`, true);
}
document.querySelectorAll('.weather-opt').forEach((b) => {
  b.addEventListener('click', () => pickWeather(b.dataset.weather));
});
bindTap('btn-weather-touch', () => cycleWeatherChoice());
refreshWeatherUi();
// <<< 1.7.0 weather
bindTap('btn-replay', () => {
  $('ending-screen').classList.add('hidden');
  clearMenuFocus();
  gameState.mode = 'play';
  input.flush();
  input.focusGame();
  toast('Keep roaming Star City');
  if (gameState.darkStarNew) { gameState.darkStarNew = false; toast(`Dark Star Suit unlocked! ${darkStarHowTo()}`, true); } // 1.6.0: after the credits
});
bindTap('dialogue-next', () => advanceDialogue());
// Validate the save once up front (a corrupt / old-format save is quarantined, never fatal),
// then set the title buttons right away so a pre-boot click can't skip the New Game confirm.
const bootSaveState = inspectSave();
refreshTitleButtons();
const title = createTitle({ focusMenu: (i) => menuFocus(i, $('title-screen')) });
// audio: Music / SFX sliders + mute at the bottom of the pause menu (same widget as the title Controls panel)
if ($('pause-screen')) mountAudioSettings($('pause-screen').querySelector('.overlay-card'));
if ($('pause-screen')) ['input', 'click'].forEach((ev) => $('pause-screen').addEventListener(ev, () => VO.refreshVolume())); // VO-HOOK: slider / mute → a playing line

/** Device-aware prompts in the DOM (interact kbd, pause/desktop hints, dialogue button). */
let promptSig = '';
function refreshPrompts(force) {
  const sig = getPromptDevice();
  if (!force && sig === promptSig) return;
  promptSig = sig;
  const L = (a) => (a === 'heavy' && sig === 'touch' && silasSet() ? 'GRIP' : getPromptLabel(a)); // 1.5.1: touch Velvet Grip
  const kbd = document.querySelector('#interact-prompt kbd');
  if (kbd) kbd.textContent = L('interact');
  const parts = silasSet()
    ? [['move', 'move'], ['sprint', 'sprint (+punch: Boss Rush)'], ['punch', 'Jab'], ['heavy', 'Velvet Grip'], ['special', 'Iron Handshake'], ['kick', 'Last Word (counter stance)'],
      ['interact', 'talk / Cold Stare'], ...(isDlc() ? [] : [['outfit', 'outfits']]), ['weather', 'weather'], ['pause', 'pause']]
    : [['move', 'move'], ['sprint', 'sprint'], ['punch', 'punch'], ['kick', 'kick'], ['special', 'Star Drive'], ['heavy', 'heavy'],
    ['interact', 'talk'], ['outfit', 'outfits'], ['weather', 'weather'], ['pause', 'pause']];
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
  const rawDt = Math.max(0, (now - last) / 1000);
  const dt = Math.min(0.05, rawDt);
  last = now;
  watchFrameRate(rawDt);
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
  setRainAmbience(getWeather() === 'rainy' && !AREAS[gameState.areaId]?.indoor); // weather: rain bed (not indoors)
  setDialogueDuck(m === 'dialogue');
  if (m === 'title' || m === 'ending') { setMusic('title'); return; }
  if (isDlc()) { // DLC: night-shift variations on Silas's motif
    if (gameState.combatLock && hostilesAlive()) fightHold = 1.5; else if (m === 'play') fightHold -= dt;
    setMusic(dlc.music(fightHold > 0, gameState.bossActive));
    return;
  }
  if (gameState.bossActive) { setMusic('boss'); return; }
  if (gameState.combatLock && hostilesAlive()) fightHold = stateBag.side ? 2.5 : 0.05; // side-mission waves have gaps
  else if (m === 'play') fightHold -= dt;
  setMusic(fightHold > 0 ? 'fight' : 'street');
}

const pressBuffer = {};
function step(dt) {
  tickToast(dt);
  updateBarks(dt, { gameState, stateBag, player, npcs: npcsInArea, npcY: npcFeetY(), dlc: isDlc() }); // barks (Bob): polls state, silent outside play
  const inp = input.poll();
  coop.preStep(dt, inp); // COOP-HOOK: network pump, lobby, guest input capture
  refreshPrompts();
  syncMusic(dt);
  if (inp.weatherPressed) cycleWeatherChoice(); // 1.7.0 weather: T / View / Create

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
  if (gameState.mode === 'pause' || gameState.mode === 'ending' || gameState.mode === 'card') { // 'card' = DLC mission card
    handleMenu(inp);
    drawWorld(0);
    return;
  }
  // >>> 1.9.0 scene player + zoom: scenes run in play + dialogue; Esc / Start / B skip (no pause mid-scene)
  if (isScenePlaying() && (gameState.mode === 'play' || gameState.mode === 'dialogue')) {
    if (inp.pausePressed || inp.backPressed) { skipScene(); input.flush(); drawWorld(dt); return; }
    updateScene(dt);
  }
  if (inp.zoomPressed && gameState.mode === 'play' && !isScenePlaying()) { const z = cycleZoom(); toast(`Camera zoom ${z}x`); }
  // <<< 1.9.0
  if (inp.pausePressed && gameState.mode === 'play') {
    pauseGame();
    drawWorld(0);
    return;
  }

  if ((inp.outfitKey || inp.outfitCycle) && gameState.mode === 'play' && isBr()) brToggleOutfit(); // 2.0.0: red suit <-> C-14
  if (inp.outfitKey && !isDlc()) {
    const k = inp.outfitKey;
    const id = OUTFIT_ORDER[k in OUTFIT_HOTKEYS ? OUTFIT_HOTKEYS[k] : Number(k) - 1];
    if (id) setOutfit(id);
  }
  if (inp.outfitCycle && gameState.mode === 'play' && !isDlc()) cycleOutfit(inp.outfitCycle);

  if (gameState.mode === 'dialogue') {
    if (inp.backPressed) { if (gameState.silasTalk) endSilasTalk(); else finishDialogue(); } // Circle/B/Esc: close
    else if ((inp.interactPressed || inp.confirmPressed) && coop.allowAdvance()) advanceDialogue(); // E/Enter/Cross/A/Square
    syncDialoguePortrait(); // 1.9.0: mouth frame follows the talk blips
    drawWorld(dt);
    return;
  }

  // PLAY
  if (coop.guestStep(dt, inp)) { updateHUD(); drawWorld(dt); return; } // COOP-HOOK: the guest renders host snapshots
  gameState.playTime += dt;
  if (DEBUG && gameState.god) player.hp = player.maxHp;
  if (!player.alive && player.koT > 0) {
    // v3: hold the KO pose briefly before the respawn / game over
    if (!player.koSting) { player.koSting = true; sting('gameover'); }
    updatePlayer(player, inp, dt, AREAS[gameState.areaId].width);
    coop.downStep(dt, AREAS[gameState.areaId]); // COOP-HOOK: William keeps fighting and can revive Matthew (holds the KO)
    for (const e of gameState.enemies) if (!e.runner) updateEnemy(e, coop.targetFor(e, player), dt, AREAS[gameState.areaId].width); // COOP-HOOK
    drawWorld(dt);
    return;
  }
  if (!player.alive && isDlc()) { dlcKnockout(); return; } // DLC: back to the step's start
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
    if (lostBoss) toast('Silas is still up at the Star. Talk to him to try again.');
    updateHUD();
    persist();
  }

  const area = AREAS[gameState.areaId];
  if (gameState.cutscene || gameState.arrest || isScenePlaying()) Object.assign(inp, NEUTRAL_INPUT); // DLC closing scene / 1.7.0 arrest / 1.9.0 scenes: hands off

  // v3: attack presses made during a hit-stop freeze are buffered, not dropped
  const BUFFERED = ['punchPressed', 'kickPressed', 'heavyPressed', 'specialPressed'];
  if (gameState.hitStop > 0) {
    gameState.hitStop -= dt;
    for (const k of BUFFERED) if (inp[k]) pressBuffer[k] = true;
  } else {
    for (const k of BUFFERED) if (pressBuffer[k]) { inp[k] = true; pressBuffer[k] = false; }
    updatePlayer(player, inp, dt, area.width, {
      outfit: gameState.outfitId,
      canSpecial: (cost = SPECIAL_COST) => gameState.special >= cost,
      onSpecial: (cost = SPECIAL_COST) => { gameState.special = Math.max(0, gameState.special - cost); gameState.hitStop = 0; rumble(0.6, 0.6, 160); followCam.kick(3); },
      onSpecialDenied: (why, cost = SPECIAL_COST) => { sfx('denied'); if (why === 'meter') toast(`${getKit(isDlc() ? 'silas' : gameState.outfitId).move} (Star Drive) needs ${cost}% special meter`); },
      ...silasHooks() // DLC: Silas's six moves (prequel Silas / Silas's Suit); {} for every other outfit
    });
    for (const e of gameState.enemies) {
      if (e.runner) updateRunner(e, dt, area);
      else updateEnemy(e, e.target ? sideTarget(e) : coop.targetFor(e, player), dt, area.width); // COOP-HOOK: foes pick P1 or P2
    }
    resolveHits(player, gameState.enemies,
      onHitEnemy,
      (dmg, knocked) => {
        if (stateBag.side && stateBag.side.id === 'side_spar') stateBag.side.hits++;
        rumble(knocked ? 1 : 0.8, 0.5, knocked ? 260 : 140); updateHUD();
        followCam.kick(knocked ? 5 : 3.5);
      },
      area.width
    );
    updateKits(player, gameState.enemies, dt, area.width, onHitEnemy); // 1.4.0: Spiral flight, Star Yank, kit FX
    silasWorld(player, gameState.enemies, dt, area.width, onHitEnemy); // DLC: Silas cooldowns, held / thrown bodies
    coop.hostStep(dt, area); // COOP-HOOK: Player 2 (William) sim + snapshots
    if (!isDlc()) updateWilliamAlly(player, gameState.enemies, dt, area.width, onHitEnemy, npcsInArea().find((n) => n.id === 'william'), hostilesAlive(), (hp) => { player.hp = Math.min(player.maxHp, player.hp + hp); updateHUD(); toast('William: "Extra life, Player One!"'); }); // 2.0.3
    if (stateBag.side && sideMission()?.kind === 'spar') { // 2.0.2: any spar mission (Coach's rounds, William's rematch)
      for (const e of gameState.enemies) if (e.sparring && !e.alive && !e.counted) { e.counted = true; stateBag.side.kos++; }
    }
    { const b = gameState.enemies.find((e) => e.isBoss); if (b) gameState.lastBoss = { x: b.x, y: b.y }; }
    gameState.enemies = gameState.enemies.filter((e) => e.alive || e.stun > 0 || e.koT > 0 || (e.runner && sideMission()));
    if (gameState.combatLock && !hostilesAlive()) {
      gameState.combatLock = false;
      gameState.enemies = [];
      if (isDlc()) { // DLC: the prequel's mission logic reacts to the cleared street itself
        gameState.bossActive = false;
        sting('victory');
        if (player.alive && !player.kd) { player.victoryT = 1.2; player.idleT = 0; }
      } else if (gameState.bossActive) {
        // Silas is down: story complete → good ending
        gameState.bossActive = false;
        if (gameState.difficulty === 'hard' || gameState.difficulty === 'arcade') stateBag.beatHard = true;
        sting('victory_big');
        toast('Silas Boone goes down. Matthew throws the breaker. The Star comes back on.');
        const bossE = gameState.enemies.find((e) => e.isBoss) || gameState.lastBoss;
        missions.completeMission('main4', toast, onProgress);
        if (checkDarkStar()) { gameState.darkStarNew = true; persist(); } // toast waits until the ending / credits close
        if (!gameState.ended) startArrest(bossE ? bossE.x : null, bossE ? bossE.y : null); // 1.7.0: honest cops make the arrest, then court, then the ending
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

  if (inp.interactPressed && !gameState.cutscene && !gameState.arrest) tryInteract();
  if (gameState.mode !== 'play') { drawWorld(dt); return; }
  if (gameState.arrest) { updateArrest(dt); if (gameState.mode !== 'play') { drawWorld(dt); return; } }
  if (isDlc()) { dlc.update(dt); updateCutscene(dt); if (dlc.playerKey) { const k = dlc.playerKey(); if (player.animKey !== k) { player.animKey = k; weaponSig = ''; } } if (gameState.mode !== 'play') { drawWorld(dt); return; } }

  // Auto pickup nearby collectibles (autosaves; outfit pickups are worn right away)
  if (isDlc()) dlcCollect();
  else {
    checkStealthSpots(); // 1.3.2: hidden Hell's Nightmare helmet reveals itself up close
    collectHere();
  }

  // Interact prompt
  const npc = nearestNPC();
  const useSpot = isDlc() && !npc && !hostilesAlive() ? dlc.usable(gameState.areaId, player.x) : (!isDlc() && !npc && !hostilesAlive() && !gameState.arrest ? prisonSpot(stateBag, gameState.areaId, player.x) : null);
  if (gameState.arrest) {
    $('interact-prompt').classList.add('hidden');
  } else if (npc && !(gameState.combatLock && hostilesAlive()) && !gameState.cutscene) {
    $('interact-prompt').classList.remove('hidden');
    $('interact-text').textContent = `Talk to ${npc.name}`;
  } else if (useSpot && !gameState.cutscene) {
    $('interact-prompt').classList.remove('hidden');
    $('interact-text').textContent = useSpot.label;
  } else if (silasSet() && hostilesAlive() && (!npc || gameState.combatLock) && !gameState.cutscene && getPromptDevice() !== 'touch') { // 1.5.1: touch has the E button; the prompt hid the objective
    const cd = silasCooldowns(player).stare;
    $('interact-prompt').classList.remove('hidden');
    $('interact-text').textContent = cd > 0 ? `Cold Stare ${Math.ceil(cd)}s` : 'Cold Stare';
  } else {
    $('interact-prompt').classList.add('hidden');
  }

  // Camera — eased follow, see CAMERA in camera.js. Drawn from drawWorld so
  // pause / dialogue hold or settle with the same lens. The crop lives in
  // present.js and does not touch the DOM HUD.

  // Autosave
  gameState.saveTimer += dt;
  if (gameState.saveTimer > 8 && !isScenePlaying() && !(getDifficulty().arcade && hostilesAlive())) { // 1.9.0: never mid-scene // Arcade: last save = pre-fight checkpoint
    gameState.saveTimer = 0;
    persist();
  }

  updateHUD();
  drawWorld(dt);
}

/** Where the minimap should point: active mission NPC, or delivery target. */
function currentDestination() {
  if (isDlc()) return dlc.dest();
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
const castScaleNpc = (id) => (id === 'silas' || id === 'silas_cuffed' ? BOSS_SCALE : NPC_SCALE);
const castScaleEnemy = (e) => (e.drawScale || (e.isBoss ? BOSS_SCALE : THUG_SCALE)); // DLC bosses carry drawScale

/** Any cast frame at `scale`, feet on feetY (same footPad rule as drawMatthew). Returns draw height. */
function drawCastSprite(spr, x, feetY, facing, scale) {
  if (!spr) return 0;
  const dw = Math.round(64 * scale), dh = Math.round(84 * scale);
  const footPad = spr.height >= 192 ? Math.round(dh * (3 / 192)) : 0;
  const top = feetY - dh + footPad;
  ctx.save();
  ctx.imageSmoothingEnabled = !CRISP && (spr.width || 0) > 144; // 1.8.0 HD stills (288x384) are drawn smoothed (1.9.0: crisp at 3x)
  if (ctx.imageSmoothingEnabled) ctx.imageSmoothingQuality = 'high';
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
  let af = animFrame(enemyCharKey(e), e.animState, animMs(e));
  if (af && e.tint) af = tintedFrame(af, e.tint, e.tintFrac || 0.62); // DLC: the Foreman's crew wear dark work coats
  let h = 0;
  if (af) h = drawAnimFrame(af, sx, e.y, e.facing, castScaleEnemy(e));
  else withLie(e, sx, e.y, () => { h = drawCastSprite(e.tint ? tintedCanvas(spr, e.tint, e.tintFrac || 0.62) : spr, sx, e.y, e.facing, castScaleEnemy(e)); });
  // <<< v3
  ctx.globalAlpha = 1;
  drawFoeStatus(e, sx, h); // 1.4.0 kit effects: stun stars, Hot Plate slow
  if (e.nameTag && e.alive) { // DLC bosses: name over the head
    ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center';
    ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(10,8,6,0.9)'; ctx.strokeText(e.nameTag, sx, Math.round(e.y - h * 0.92) - 12);
    ctx.fillStyle = '#e6d3a2'; ctx.fillText(e.nameTag, sx, Math.round(e.y - h * 0.92) - 12); ctx.textAlign = 'left';
  }
  if (e.hp < e.maxHp && e.alive) {
    const pw = e.isBoss || e.miniBoss ? 44 : 32, py = Math.round(e.y - h * 0.92) - 6;
    ctx.fillStyle = '#2a2a30';
    ctx.fillRect(sx - pw / 2, py, pw, 4);
    ctx.fillStyle = e.isBoss || e.miniBoss ? '#e74c3c' : '#2ecc71';
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
    const artId = artOutfitFor(outfitId); // DLC: Silas's Suit → fallback outfit + dark-suit tint until Joe's art lands
    let spr = getMatthewSprite(pose, artId, artId !== outfitId ? OUTFITS[artId] : outfit, t);
    if (!spr) return;
    if (suitNeedsTint(outfitId)) spr = tintedCanvas(spr);
    // Draw Joe's 144x192 frame at heroic scale; v3 feet sit on row 189 of 192, so anchor that row to feetY
    const dw = Math.round(64 * PLAYER_SCALE), dh = Math.round(84 * PLAYER_SCALE);
    const footPad = spr.height >= 192 ? Math.round(dh * (3 / 192)) : 0;
    const top = feetY - dh + footPad;
    ctx.save();
    ctx.imageSmoothingEnabled = !CRISP && (spr.width || 0) > 144; // 1.8.0 HD (1.9.0: crisp at 3x)
    if (ctx.imageSmoothingEnabled) ctx.imageSmoothingQuality = 'high';
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
  const dw = Math.round((f.dw != null ? f.dw : f.sw) * k), dh = Math.round((f.dh != null ? f.dh : f.sh) * k);
  const top = Math.round(feetY - feet * k);
  ctx.save();
  ctx.imageSmoothingEnabled = !CRISP && !!f.smooth; // 1.8.0 HD: soft-alpha 2x art is drawn smoothed (1.9.0: crisp at 3x)
  if (f.smooth) ctx.imageSmoothingQuality = 'high';
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
// >>> 1.4.0 outfit kits (game-logic lane; draw-only)
const KIT_FX_COLOR = { polo: '#fff4dc', photo: '#fffbe0', hoodie: '#ffd24a', jacket: '#ffb36b', street: '#ffffff', varsity: '#f2e6c8', mechanic: '#ffd27a',
  diner: '#ff9a4a', gold: '#ffd24a', webslinger: '#ff5a6a', beacon: '#7dffb2', ironclad: '#ffb020', silas: '#e6d3a2' };
function star(x, y, r, color, rot = 0) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) { const a = rot + i * Math.PI / 5 - Math.PI / 2, rr = i % 2 ? r * 0.45 : r; ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
  ctx.closePath(); ctx.fillStyle = color; ctx.fill();
}
/** Stun stars over a dazed foe; steam + an orange ring for a Hot Plate slow. */
function drawFoeStatus(e, sx, h) {
  if (!e.alive) return;
  const now = performance.now() / 1000, top = Math.round(e.y - (h || 84) - 4);
  if (e.stun > 0 && e.dazed && !e.kd) {
    for (let i = 0; i < 3; i++) {
      const a = now * 6 + i * (Math.PI * 2 / 3);
      const x = sx + Math.cos(a) * 15, y = top + Math.sin(a) * 4;
      ctx.globalAlpha = Math.sin(a) > 0 ? 1 : 0.6;
      star(x, y, 5, i === 1 ? '#fff4a8' : '#ffd24a', a);
    }
    ctx.globalAlpha = 1;
  }
  if (e.slowT > 0) {
    ctx.save();
    ctx.strokeStyle = 'rgba(255,140,50,0.75)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(sx, e.y, 20 + Math.sin(now * 8) * 2, 5, 0, 0, Math.PI * 2); ctx.stroke();
    for (let i = 0; i < 3; i++) {
      const k = (now * 0.9 + i / 3) % 1;
      ctx.globalAlpha = 0.55 * (1 - k);
      ctx.fillStyle = '#f4efe6';
      ctx.beginPath(); ctx.arc(sx - 10 + i * 10 + Math.sin(now * 3 + i) * 3, top + 18 - k * 22, 3 + k * 4, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.font = 'bold 9px sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#ff9a4a';
    ctx.fillText('SLOW', sx, e.y + 14); ctx.textAlign = 'left';
    ctx.restore();
  }
}
/** Spiral footballs, Star Yank line, kit flashes / rings / cones / cracks / sparks / callouts. */
function drawKitFx(cam) {
  const now = performance.now() / 1000;
  ctx.save();
  for (const pr of getProjectiles()) {
    const x = pr.x - cam, y = pr.y + pr.hy;
    ctx.globalAlpha = 0.35; ctx.fillStyle = '#f2e6c8';
    ctx.fillRect(Math.min(x, x - pr.facing * 34), y - 1, 34, 2);
    ctx.globalAlpha = 1;
    ctx.save(); ctx.translate(x, y); ctx.rotate(pr.facing * 0.15); ctx.scale(1, 0.75 + 0.25 * Math.cos(pr.t * 40));
    ctx.fillStyle = '#7a3e1a'; ctx.beginPath(); ctx.ellipse(0, 0, 10, 6, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#2a1206'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(-4, 0); ctx.lineTo(4, 0); ctx.stroke();
    for (let i = -3; i <= 3; i += 2) { ctx.beginPath(); ctx.moveTo(i, -2); ctx.lineTo(i, 2); ctx.stroke(); }
    ctx.restore();
    ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.ellipse(x, pr.y, 8, 2.5, 0, 0, Math.PI * 2); ctx.fill();
  }
  for (const fx of getKitFx()) {
    const k = Math.min(1, fx.t / fx.dur), a = 1 - k;
    const x = (fx.follow ? player.x : fx.x) - cam;
    ctx.globalAlpha = 1;
    switch (fx.type) {
      case 'callout': {
        const y = player.y - 128 - k * 14;
        ctx.globalAlpha = Math.min(1, a * 2);
        ctx.font = 'bold 15px sans-serif'; ctx.textAlign = 'center';
        ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(20,10,4,0.9)'; ctx.strokeText(fx.text, x, y);
        ctx.fillStyle = KIT_FX_COLOR[fx.kit] || '#ffd24a'; ctx.fillText(fx.text, x, y);
        ctx.textAlign = 'left';
        break;
      }
      case 'text': {
        ctx.globalAlpha = Math.min(1, a * 2);
        ctx.font = 'bold 10px sans-serif'; ctx.textAlign = 'center';
        ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(20,10,4,0.9)'; ctx.strokeText(fx.text, x, fx.y - k * 12);
        ctx.fillStyle = fx.color || '#fff'; ctx.fillText(fx.text, x, fx.y - k * 12); ctx.textAlign = 'left';
        break;
      }
      case 'darkpulse': { // 1.6.0 Lights Out: the lens dims, a midnight ring rolls out both ways
        ctx.save();
        ctx.fillStyle = `rgba(4,6,18,${0.55 * Math.sin(Math.PI * Math.min(1, k))})`;
        ctx.fillRect(0, 0, W, H);
        const rx = 30 + (fx.reach || 150) * k, ry = rx * 0.32;
        ctx.strokeStyle = `rgba(150,172,230,${0.8 * a})`; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.ellipse(x, fx.y - 4, rx, ry, 0, 0, Math.PI * 2); ctx.stroke();
        ctx.strokeStyle = `rgba(20,24,52,${0.9 * a})`; ctx.lineWidth = 6;
        ctx.beginPath(); ctx.ellipse(x, fx.y - 4, rx * 0.8, ry * 0.8, 0, 0, Math.PI * 2); ctx.stroke();
        ctx.restore();
        break;
      }
      case 'flash': { // Flash Pop: white-gold burst in front of the lens
        const r = 30 + (fx.reach || 100) * (0.6 + 0.6 * k);
        const g = ctx.createRadialGradient(x, fx.y - 58, 2, x, fx.y - 58, r);
        g.addColorStop(0, `rgba(255,255,255,${0.95 * a})`); g.addColorStop(0.45, `rgba(255,240,170,${0.55 * a})`); g.addColorStop(1, 'rgba(255,240,170,0)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.moveTo(x, fx.y - 58);
        ctx.arc(x, fx.y - 58, r, fx.facing > 0 ? -0.75 : Math.PI - 0.75, fx.facing > 0 ? 0.75 : Math.PI + 0.75); ctx.closePath(); ctx.fill();
        break;
      }
      case 'cone': { // Star Flare: emerald cone
        const r = (fx.reach || 96) * (0.5 + 0.6 * k), cy = fx.y - 56;
        const g = ctx.createRadialGradient(x, cy, 2, x, cy, r);
        g.addColorStop(0, `rgba(220,255,235,${0.9 * a})`); g.addColorStop(0.5, `rgba(125,255,178,${0.6 * a})`); g.addColorStop(1, 'rgba(30,143,90,0)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.moveTo(x, cy);
        ctx.arc(x, cy, r, fx.facing > 0 ? -0.5 : Math.PI - 0.5, fx.facing > 0 ? 0.5 : Math.PI + 0.5); ctx.closePath(); ctx.fill();
        for (let i = 0; i < 4; i++) star(x + fx.facing * r * (0.4 + i * 0.15), cy + Math.sin(i * 2.1) * r * 0.25, 4 * a + 1, '#c8ffe0', now * 4 + i);
        break;
      }
      case 'ring': { // Breach: planted-palm shockwave
        const r = 12 + (fx.reach || 84) * k;
        ctx.strokeStyle = `rgba(255,176,32,${0.9 * a})`; ctx.lineWidth = 4 * a + 1;
        ctx.beginPath(); ctx.ellipse(x + fx.facing * r * 0.4, fx.y - 2, r, r * 0.28, 0, 0, Math.PI * 2); ctx.stroke();
        ctx.strokeStyle = `rgba(255,236,170,${0.7 * a})`; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(x, fx.y - 56, 10 + r * 0.6, fx.facing > 0 ? -1 : Math.PI - 1, fx.facing > 0 ? 1 : Math.PI + 1); ctx.stroke();
        break;
      }
      case 'crack': { // Torque / Detention: ground crack + chips
        ctx.strokeStyle = `rgba(40,30,20,${0.85 * a})`; ctx.lineWidth = 2;
        for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.moveTo(x, fx.y); ctx.lineTo(x + i * 9, fx.y + 3 + Math.abs(i) * 1.5); ctx.lineTo(x + i * 16, fx.y + 2 - (i % 2) * 2); ctx.stroke(); }
        ctx.fillStyle = `rgba(255,220,150,${a})`;
        for (let i = 0; i < 5; i++) ctx.fillRect(x - 12 + i * 6, fx.y - 6 - Math.sin(i * 1.7 + 1) * 14 * k - 4 * k, 2, 2);
        break;
      }
      case 'arc': { // weapon swoosh
        ctx.strokeStyle = fx.color || '#fff4dc'; ctx.globalAlpha = 0.8 * a; ctx.lineWidth = 3;
        const r = Math.max(30, (fx.reach || 60) * 0.85);
        ctx.beginPath(); ctx.arc(x, fx.y, r, fx.facing > 0 ? -0.9 + k * 0.3 : Math.PI - 0.6 + k * 0.3, fx.facing > 0 ? 0.6 + k * 0.3 : Math.PI + 0.9 + k * 0.3); ctx.stroke();
        break;
      }
      case 'dust': {
        ctx.fillStyle = `rgba(200,180,150,${0.6 * a})`;
        for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.arc(x - fx.facing * i * 10, fx.y - 3 - k * 6, 4 + k * 6 - i, 0, Math.PI * 2); ctx.fill(); }
        break;
      }
      case 'spark': {
        const r = (fx.big ? 14 : 9) * (0.6 + k);
        ctx.globalAlpha = a; star(x, fx.y, r, fx.color || '#fff4a8', k * 2);
        if (fx.seg >= 2) { ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#ffd24a'; ctx.fillText('x2', x + 14, fx.y - 14); ctx.textAlign = 'left'; }
        break;
      }
      case 'pop': {
        ctx.globalAlpha = a; ctx.strokeStyle = '#f2e6c8'; ctx.lineWidth = 2;
        for (let i = 0; i < 6; i++) { const ang = i * Math.PI / 3; ctx.beginPath(); ctx.moveTo(x + Math.cos(ang) * 4, fx.y + Math.sin(ang) * 4); ctx.lineTo(x + Math.cos(ang) * (8 + k * (fx.small ? 4 : 10)), fx.y + Math.sin(ang) * (8 + k * (fx.small ? 4 : 10))); ctx.stroke(); }
        break;
      }
      // >>> DLC: Silas moveset FX
      case 'stance': { // Last Word: brass guard ring while the counter window is open
        if (!(player.silasMove && player.silasMove.kind === 'stance' && player.silasMove.el < player.silasMove.stanceEnd)) break;
        const cy = player.y - 60;
        ctx.globalAlpha = 0.55 + 0.25 * Math.sin(now * 18);
        ctx.strokeStyle = '#e6d3a2'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(x + player.facing * 10, cy, 34, -1.1, 1.1); ctx.stroke();
        ctx.beginPath(); ctx.arc(x - player.facing * 2, cy, 40, Math.PI - 1.1, Math.PI + 1.1); ctx.stroke();
        ctx.fillStyle = 'rgba(194,164,103,0.15)'; ctx.beginPath(); ctx.ellipse(x, player.y - 2, 26, 6, 0, 0, Math.PI * 2); ctx.fill();
        break;
      }
      case 'shock': { // Iron Handshake: ground shockwave ring + dust wall
        const r = 16 + (fx.reach || 150) * k;
        ctx.strokeStyle = `rgba(230,211,162,${0.95 * a})`; ctx.lineWidth = 6 * a + 1;
        ctx.beginPath(); ctx.ellipse(x, fx.y - 2, r, r * 0.26, 0, 0, Math.PI * 2); ctx.stroke();
        ctx.strokeStyle = `rgba(168,32,42,${0.7 * a})`; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.ellipse(x, fx.y - 2, r * 0.7, r * 0.18, 0, 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = `rgba(200,180,150,${0.45 * a})`;
        for (let i = -1; i <= 1; i += 2) for (let j = 0; j < 3; j++) { ctx.beginPath(); ctx.arc(x + i * r * (0.85 + j * 0.05), fx.y - 6 - j * 6 * a, 6 + j * 2, 0, Math.PI * 2); ctx.fill(); }
        break;
      }
      case 'stare': { // Cold Stare: icy sweep from the eyes
        const cy = player.y - 74, r = 40 + 200 * k, f = fx.facing || player.facing;
        const g = ctx.createRadialGradient(x, cy, 2, x, cy, r);
        g.addColorStop(0, `rgba(200,230,255,${0.5 * a})`); g.addColorStop(1, 'rgba(120,170,230,0)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.moveTo(x, cy); ctx.arc(x, cy, r, f > 0 ? -0.35 : Math.PI - 0.35, f > 0 ? 0.35 : Math.PI + 0.35); ctx.closePath(); ctx.fill();
        ctx.fillStyle = `rgba(4,8,20,${0.25 * a})`; ctx.fillRect(-W, -H, W * 4, H * 3);
        break;
      }
      // <<< DLC
      case 'cord': { // Star Yank: line from Matthew's hand to the foe (or out to full length on a miss)
        const hx = player.x + player.facing * 30 - cam, hy = player.y - 62;
        const tx = fx.target ? fx.target.x - cam : fx.tx - cam, ty = fx.target ? fx.target.y - 58 : fx.ty;
        ctx.globalAlpha = Math.min(1, a * 3);
        ctx.strokeStyle = '#f4f0ff'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(hx, hy); ctx.quadraticCurveTo((hx + tx) / 2, Math.max(hy, ty) + 8 * a, tx, ty); ctx.stroke();
        star(tx, ty, 6, '#ffd24a', now * 10);
        break;
      }
      default: break;
    }
  }
  ctx.restore();
}
// <<< 1.4.0 outfit kits

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
  const cy = dy + (f.dh || f.sh) / 2;
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.beginPath(); ctx.ellipse(x, y - 2, 13, 4, 0, 0, Math.PI * 2); ctx.fill();
  const pulse = (0.55 + 0.25 * Math.sin(now / 330 + c.x)) * (vis < 1 ? 0.3 : 1);
  const g = ctx.createRadialGradient(x, cy, 2, x, cy, 32);
  g.addColorStop(0, `rgba(255,224,120,${0.5 * pulse})`); g.addColorStop(1, 'rgba(255,224,120,0)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, cy, 32, 0, Math.PI * 2); ctx.fill();
  ctx.save();
  ctx.imageSmoothingEnabled = !CRISP && !!f.smooth; // 1.9.0: crisp at 3x
  if (f.smooth) ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(f.img, f.sx || 0, f.sy || 0, f.sw, f.sh, dx, dy, f.dw || f.sw, f.dh || f.sh);
  ctx.restore();
  if (vis < 1) { ctx.restore(); return; } // no name tag until it's been spotted
  ctx.fillStyle = '#fff'; ctx.font = '9px sans-serif'; ctx.textAlign = 'center';
  ctx.fillText(c.name, x, dy - 4); ctx.textAlign = 'left';
}
// <<< v3


// >>> 1.9.0 scene player glue (js/scene_player.js holds the API; scenes are data)
function drawLensLetterbox(fr, k) {
  ctx.save(); ctx.translate(0, fr.y); drawLetterbox(ctx, fr.viewW, fr.viewH, k); ctx.restore();
}
/** Bystanders: 'near' (default) hides NPCs within 260 px of any actor or the lens; 'all'; 'none'. keepNpcs stay. */
function sceneHidesNpc(n) {
  if (!isScenePlaying()) return false;
  const def = currentScene().def, mode = def.bystanders || 'near';
  if (mode === 'none' || (def.keepNpcs || []).includes(n.id)) return false;
  if (mode === 'all') return true;
  const fr = followCam.frame, inLens = n.x > fr.x - 40 && n.x < fr.x + fr.viewW + 40;
  return inLens || sceneActors().some((a) => Math.abs(a.x - n.x) < 260);
}
/** 1.9.0: put the player (stand-in for Silas / Matthew) on the scene's mark (def.playerMark {x, facing}), or step him
 *  clear of any cast actor within 56 px, facing them. */
function placeSceneStandIn(def, actors) {
  const area = AREAS[gameState.areaId], W0 = area ? area.width : 2000;
  const mark = def && def.playerMark;
  if (mark && typeof mark.x === 'number') { player.x = mark.x; if (mark.facing) player.facing = mark.facing; return; }
  const near = (actors || []).filter((a) => a && a.kind !== 'thug' && typeof a.x === 'number' && Math.abs(a.x - player.x) < 56);
  if (!near.length) return;
  const a = near[0], side = player.x >= a.x ? 1 : -1;
  let x = a.x + side * 90; if (x < 40 || x > W0 - 40) x = a.x - side * 90;
  player.x = Math.max(40, Math.min(W0 - 40, x)); player.facing = a.x > player.x ? 1 : -1;
}
let sceneCastRef = null;
function closeSceneLine() {
  if (gameState.mode !== 'dialogue') return;
  stopTalk(); VO.stop(); $('dialogue').classList.add('hidden');
  gameState.mode = 'play'; gameState.dialogue = null; gameState.dialogueNpc = null; gameState.sceneMoreLines = false; input.flush();
}
setVoiceHook((clipId, info) => { if (!info || !info.text) VO.play(clipId); }); // VO-HOOK: dialogue lines are voiced in showLine (no double start)
setSceneHooks({
  build(def, vars) {
    if (def.area && AREAS[def.area] && def.area !== gameState.areaId) { gameState.areaId = def.area; syncDepthBand(); }
    if (def.clearEnemies !== false) { gameState.enemies = []; gameState.combatLock = false; }
    followCam.cut();
    const frame = syncCamera(0);
    return { player, band: getDepthBand(), frame, areaId: gameState.areaId, area: AREAS[gameState.areaId], gameState, vars };
  },
  currentLens() { const f = followCam.frame; return { x: f.x + f.viewW / 2, zoom: f.zoom }; },
  say(lines, done, onLine, info) {
    const first = lines[0] || {};
    gameState.sceneMoreLines = !!(info && info.moreLines); // 1.9.0: button says Continue until the scene's last line
    startDialogueRaw({ id: first.id || 'silas', name: first.name || '', role: '', onDone: done, onLine }, lines);
  },
  advance() { advanceDialogue(); },
  closeLine: closeSceneLine,
  onStart(def, actors) {
    placeSceneStandIn(def, actors); // 1.9.0: the player stand-in never overlaps a cast actor
    gameState.finaleActors = actors; // drawn + read (tests) through the existing finale-actor lane
    sceneCastRef = actors; // dupe fix: remembered so onEnd can take the cast off the street
    document.body.classList.add('sor-scene');
    hideStoryIntro();
  },
  onEnd(def, skipped) {
    document.body.classList.remove('sor-scene');
    if (gameState.finaleActors === sceneCastRef) gameState.finaleActors = []; // dupe fix: cast actors (Silas, 2028 Matthew) no longer linger beside the playable stand-in
    sceneCastRef = null;
    closeSceneLine();
    followCam.cut();
    if (skipped) toast('Scene skipped');
  }
});
{ // cinematic mode CSS + touch Skip button (HUD, hint and touch controls step aside; dialogue + toast stay)
  const st = document.createElement('style');
  st.textContent = 'body.sor-scene #hud, body.sor-scene #desktop-hint, body.sor-scene #mobile-controls, body.sor-scene #interact-prompt { visibility: hidden !important; }'
    + ' #btn-scene-skip { display: none; position: absolute; right: 14px; top: 14px; z-index: 40; padding: 6px 14px; font: 700 13px sans-serif; color: #ffd24a; background: rgba(10,10,14,0.72); border: 1px solid rgba(255,210,74,0.7); border-radius: 6px; pointer-events: auto; }'
    + ' body.sor-scene #btn-scene-skip { display: block; }';
  document.head.appendChild(st);
  const b = document.createElement('button');
  b.type = 'button'; b.id = 'btn-scene-skip'; b.textContent = 'Skip ▸▸'; b.setAttribute('aria-label', 'Skip scene');
  const go = (e) => { e.preventDefault(); skipScene(); input.focusGame(); };
  b.addEventListener('touchstart', go, { passive: false }); b.addEventListener('click', go);
  ($('ui-layer') || document.body).appendChild(b);
}
/** Review demo (debug: __scd.playScene('demo_downtown_confront')): Matthew confronts Silas on Jefferson Street, ~20 s. */
registerScene({
  id: 'demo_downtown_confront', area: 'downtown', hidePlayer: true, bystanders: 'all', fade: 1,
  camera: { x: 620, zoom: 1.34 },
  actors: (c) => [
    { kind: 'matthew', id: 'matthew', x: 420, y: c.band.max - 40, facing: 1, t: 0 },
    { kind: 'cast', id: 'silas', key: 'silas', x: 1010, y: c.band.max - 52, facing: -1 }
  ],
  steps: [
    { kind: 'letterbox', to: 1, dur: 0 },
    { kind: 'fade', to: 0, dur: 1.0 },
    { kind: 'moveActor', id: 'matthew', to: 830, speed: 80, async: true },
    { kind: 'cameraPan', x: 880, dur: 4.6 },
    { kind: 'wait', dur: 0.6 },
    { kind: 'line', speaker: 'silas', name: 'Silas Boone', text: 'Matthew Rose. Jefferson Street suits you. Pity it\'s already mine.', voice: 'demo_silas_01', dur: 3.2 },
    { kind: 'cameraZoom', zoom: 2.68, dur: 1.2 },
    { kind: 'line', speaker: 'matthew', name: 'Matthew Rose', text: 'Wren\'s debt is paid, Silas. You don\'t get to collect twice.', voice: 'demo_matthew_01', dur: 3.2 },
    { kind: 'line', speaker: 'silas', name: 'Silas Boone', text: 'Every name on this street is a debt. Yours just came due.', voice: 'demo_silas_02', dur: 3.0 },
    { kind: 'cameraZoom', zoom: 1.34, dur: 1.0 },
    { kind: 'fade', to: 1, dur: 1.0 },
    { kind: 'letterbox', to: 0, dur: 0 },
    { kind: 'fade', to: 0, dur: 0.4 }
  ]
});
/**
 * 1.9.0 scene triggers: a DLC talk / scene step whose lines are exactly a registered scene's lines (in order) plays
 * that scene instead of the bare dialogue box (js/scenes_silas.js: dlc1_m1_kid, dlc1_m2_errand, dlc1_m4_vera_after,
 * dlc1_m4_marcus (the late-night variant of his talk), dlc1_m6_quit). Same text, so mission flow is unchanged.
 */
function sceneLineTexts(def) {
  if (!def || !Array.isArray(def.steps)) return null; // built-at-start scenes (arrest, closing) never auto-trigger
  const out = [];
  for (const st of def.steps) {
    if (st.kind === 'line') out.push(st.text);
    else if (st.kind === 'lines') for (const l of st.lines) out.push(l.text);
  }
  return out.length ? out : null;
}
function sceneForLines(lines) {
  if (!isDlc() || !Array.isArray(lines) || !lines.length) return null;
  const want = lines.map((l) => (l && l.text) || '');
  for (const id of listScenes()) {
    if (!/^dlc1_/.test(id)) continue;
    const got = sceneLineTexts(getScene(id));
    if (got && got.length === want.length && got.every((t, i) => t === want[i])) return id;
  }
  return null;
}
// <<< 1.9.0 scene player glue

function syncCamera(dt) {
  const area = AREAS[gameState.areaId];
  const frame = followCam.update({
    playerX: coop.camX(player.x), // COOP-HOOK: midpoint of both players
    playerY: player.y, // 1.9.0: 2x / 3x keep head room above the feet
    facing: player.facing,
    areaWidth: area.width,
    areaId: gameState.areaId,
    screenW: W,
    screenH: H,
    dt,
    enemies: gameState.enemies.filter((e) => e.alive), // 1.9.0: close lenses lean toward a nearby fight
    override: sceneLens() // 1.9.0: a scene's cameraPan / cameraZoom (null = follow)
  });
  gameState.cameraX = frame.x; gameState.cameraViewW = frame.viewW; // 1.5.1: closing-scene framing + tests
  return frame;
}

function drawWorld(dt) {
  const area = AREAS[gameState.areaId];
  const camFrame = syncCamera(dt);
  const cam = camFrame.x;
  const viewW = camFrame.viewW;
  // 1.9.0 3x fix: at 2x / 3x the lens is drawn straight into the full scene buffer (scale SS*zoom), so the
  // HD art is sampled once at screen resolution instead of a small crop being upscaled (the blur). Level 1 keeps the crop.
  lensZ = camFrame.zoom >= 1.9 ? camFrame.zoom : 1;
  CRISP = lensZ >= 3.5; // 3x: nearest-neighbour sprites (crisp), 2x keeps Joe's smoothed HD draw
  ctx.setTransform(SS * lensZ, 0, 0, SS * lensZ, 0, lensZ > 1 ? -camFrame.y * SS * lensZ : 0);
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, W, H);
  setStarDark(!isDlc() && storyBlackout()); // 1.6.0: anniversary-night blackout
  setTrafficPaused(isScenePlaying()); // 1.9.0: the ambient sedan holds still during scenes
  drawBackground(ctx, area, cam, viewW, H, dt); // dt drives the ambient sedan (0 = frozen while paused)

  // Collectibles
  for (const c of (isScenePlaying() && currentScene()?.def?.day ? [] : isDlc() ? dlc.visibleCollectibles(gameState.areaId) : stateBag.collectibles)) {
    if (c.taken || c.area !== gameState.areaId) continue;
    drawCollectibleItem(c, c.x - cam, collectY()); // v3: Joe's item art with bob + glow, dot fallback
  }
  if (isDlc()) drawUseMarker(cam);
  else drawPrisonMarkers(cam); // 1.7.0

  // Sort draw by depth (y)
  const drawList = [];
  for (const n of npcsInArea()) {
    if (sceneHidesNpc(n)) continue; // 1.9.0: bystanders step out of a scene
    if (n.id === 'william' && williamAlly() && !isDlc()) { drawList.push({ type: 'ally', y: williamAlly().y, a: williamAlly() }); continue; } // 2.0.3: fighting
    drawList.push({ type: 'npc', y: npcFeetY(), n });
  }
  for (const e of gameState.enemies) {
    if (e.alive || e.stun > 0 || e.koT > 0) drawList.push({ type: 'enemy', y: e.y, e });
  }
  if (!(isScenePlaying() && currentScene().def.hidePlayer)) drawList.push({ type: 'player', y: player.y }); // 1.9.0
  for (const a of gameState.finaleActors) if (a.area === gameState.areaId) drawList.push({ type: 'actor', y: a.y, a }); // DLC closing scene
  drawList.sort((a, b) => a.y - b.y);
  if (DEBUG) window.__drawn = drawList.map((d) => d.type === 'npc' ? { t: 'npc', id: d.n.id, key: d.n.key || d.n.id, x: Math.round(d.n.x) } : d.type === 'enemy' ? { t: 'enemy', id: d.e.who || d.e.kind || 'thug', key: d.e.charKey || '', name: d.e.nameTag || '', x: Math.round(d.e.x) } : d.type === 'actor' ? { t: 'actor', id: d.a.id, key: d.a.key || d.a.kind, kind: d.a.kind, x: Math.round(d.a.x) } : d.type === 'ally' ? { t: 'npc', id: 'william', key: 'william', x: Math.round(d.a.x) } : { t: 'player', id: isDlc() ? dlc.which : 'matthew', x: Math.round(player.x) }); // dupe checker (tests)
  coop.drawItems(drawList); // COOP-HOOK: Player 2 joins the depth-sorted cast

  // Ground shadows first so no character's shadow overlaps another's body
  for (const item of drawList) {
    if (item.type === 'coop') continue; // COOP-HOOK: drawn by js/coop
    if (item.type === 'npc') drawGroundShadow(ctx, item.n.x - cam, item.y, NPC_DRAW_W * castScaleNpc(item.n.id));
    else if (item.type === 'enemy') drawGroundShadow(ctx, item.e.x - cam, item.e.y, NPC_DRAW_W * castScaleEnemy(item.e), item.e.alive ? 0.42 : 0.25);
    else if (item.type === 'ally') drawGroundShadow(ctx, item.a.x - cam, item.y, NPC_DRAW_W * castScaleNpc('william'));
    else if (item.type === 'actor') drawGroundShadow(ctx, item.a.x - cam, item.a.y, item.a.kind === 'matthew' ? CHAR_DRAW_W : NPC_DRAW_W * THUG_SCALE, 0.35);
    else drawGroundShadow(ctx, player.x - cam, player.y, isDlc() ? NPC_DRAW_W * BOSS_SCALE : CHAR_DRAW_W);
  }

  const fighters = lensZ > 1 ? [player.x, ...gameState.enemies.filter((e) => e.alive).map((e) => e.x)] : null;
  for (const item of drawList) {
    // 1.9.0 3x fix: at 2x / 3x a bystander standing over Matthew or a foe fades to 0.15 (never the one he talks to)
    const fadeNpc = fighters && item.type === 'npc' && !(gameState.dialogueNpc === item.n) && !isScenePlaying() && fighters.some((fx) => Math.abs(fx - item.n.x) < 80);
    if (item.type === 'coop') { item.draw(cam); continue; } // COOP-HOOK
    if (fadeNpc) { ctx.save(); ctx.globalAlpha = 0.15; }
    if (item.type === 'npc') {
      const n = item.n;
      const spr = getNpcSprite(n.id, n.color, performance.now() / 1000);
      const sx = n.x - cam;
      // >>> v3 anim states: talk while in dialogue with this NPC, idle_personality otherwise
      const nState = gameState.mode === 'dialogue' && gameState.dialogueNpc === n ? 'talk' : 'idle_personality';
      const nk = n.key || n.id; // 1.9.0: art key (the 2015 selves: dora_young …)
      const naf = animFrame(nk, nState, performance.now()) || animFrame(nk, 'idle', performance.now()); // Foreman: no still → his anim frame
      const nh = naf ? drawAnimFrame(naf, sx, item.y, 1, castScaleNpc(n.id)) : drawCastSprite(n.key ? getNpcSprite(nk, n.color, performance.now() / 1000) : spr, sx, item.y, 1, castScaleNpc(n.id));
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
    } else if (item.type === 'ally') { // 2.0.3: William mid-fight (Joe's 480x394 strips)
      const f = animFrame('william', item.a.animState, animMs(item.a));
      if (f) drawAnimFrame(f, item.a.x - cam, item.y, item.a.facing, castScaleNpc('william'));
    } else if (item.type === 'actor') {
      drawFinaleActor(item.a, cam);
    } else if (item.type === 'player' && isDlc()) {
      drawDlcSilas(cam); // DLC: playable Silas (silas_boss art at BOSS_SCALE)
    } else if (item.type === 'player') {
      const outfit = OUTFITS[gameState.outfitId] || OUTFITS.polo;
      let pose = player.pose;
      if (player.invuln > 0 && player.attackType !== 'special' && Math.floor(performance.now() / 80) % 2) ctx.globalAlpha = 0.4; // 1.4.0: no blink through a signature move
      const t = USE_HERO_RENDER ? heroPoseTime(player) : player.animT;
      // >>> v3 anim states (game-logic lane): getAnimFrame('matthew', state) when the art exists, else the
      // old sheet with fallbacks: jump-kick lift, Star Drive afterimages, faster sprint cycle, lie-down tilt
      const px = player.x - cam;
      let maf = USE_HERO_RENDER ? null : animFrame('matthew', player.animState, animMs(player), artOutfitFor(gameState.outfitId));
      // 2.1.1: a strip still streaming in shows the new model's idle, never the old sheet (no model pop on state changes)
      if (!maf && !USE_HERO_RENDER && player.alive && !player.kd) maf = animFrame('matthew', 'idle', player.animT * 1000, artOutfitFor(gameState.outfitId));
      if (maf && suitNeedsTint(gameState.outfitId)) maf = tintedFrame(maf); // DLC: Silas's Suit fallback look
      if (player.attackType === 'special' && player.kitMove && player.kitMove.lunge >= 60 && player.kitMove.el < player.kitMove.lungeT) {
        // 1.4.0: afterimages only for the moves that travel (Kickflip); planted moves stay crisp
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
    if (fadeNpc) ctx.restore();
  }
  drawKitFx(cam); // 1.4.0: Spiral footballs, Star Yank line, flashes / rings / sparks / callouts (over the cast)

  // Shared golden-hour light over characters too (lens width, full plate height)
  // 1.7.0 weather: Sunny keeps the golden-hour grade; Night / Rainy are Kody's grades (js/weather.js).
  // Rainy in the main campaign is the 1.6.0 story rain (lightning, the blackout after the twist).
  // The story blackout applies in every weather. Indoor areas (Cinder Hollow) keep their own light.
  const wx = getWeather(), nowS = performance.now() / 1000;
  if (wx === 'sunny') drawSceneGrade(ctx, area, viewW, H);
  if (isDlc() && dlc.isNight() && !(isScenePlaying() && currentScene()?.def?.day)) drawNightGrade(ctx, viewW, H, nowS); // DLC: night shift (story)
  if (!area.indoor) {
    if (!isDlc() && wx === 'rainy' && !area.prison) drawRainNight(ctx, viewW, H, nowS, { blackout: storyBlackout(), groundY: getDepthBand().min, heavy: stateBag.mainComplete ? 0.45 : 1, after: !!stateBag.mainComplete, frozen: !dt });
    else drawWeather(ctx, viewW, H, nowS, { groundY: getDepthBand().min, blackout: !isDlc() && storyBlackout(), frozen: !dt, lights: getSceneLights(), cheap: cheapPresentation() });
  }
  if (!isDlc()) {
    if (((gameState.mode === 'dialogue' && gameState.dialogueNpc?.id === 'silas') || gameState.arrest) && !isScenePlaying()) drawLensLetterbox(camFrame, 1); // 1.9.0: inside the visible lens
    if (gameState.arrest && gameState.arrest.phase !== 'court') drawPoliceLights(viewW, H);
  }

  drawBarks(ctx, camFrame, gameState.areaId, gameState.mode); // barks (Bob): speech bubble over the cast + weather, under the DOM HUD

  if (isScenePlaying()) { // 1.9.0 scene letterbox + fade, inside the cropped lens (camFrame.y .. +viewH)
    const fx = sceneFx();
    if (fx.letterbox > 0) drawLensLetterbox(camFrame, fx.letterbox);
    if (fx.fade > 0) { ctx.fillStyle = `rgba(0,0,0,${Math.min(1, fx.fade)})`; ctx.fillRect(0, camFrame.y, viewW, camFrame.viewH); }
  }

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
  if (banner) {
    banner.classList.toggle('hidden', !fighting);
    const bt = (fighting && isDlc() && dlc.bannerText()) || (fighting && !isDlc() && gameState.bossActive ? 'BOSS: Silas Boone' : '') || 'FIGHT! Clear the street'; // 1.5.1: survive / boss wording
    if (banner.textContent !== bt) banner.textContent = bt;
  }

  ctx.setTransform(SS, 0, 0, SS, 0, 0); CRISP = false;
  presenter.present({
    mode: 'world',
    cameraY: lensZ > 1 ? 0 : camFrame.y, // 1.9.0: the lens already fills the buffer at 2x / 3x
    viewW: lensZ > 1 ? W : camFrame.viewW,
    viewH: lensZ > 1 ? H : camFrame.viewH,
    grade: getWeather()
  });
  drawBarksScreen(canvas); // barks (Bob): bubble on the presented canvas, constant size at every zoom
}

/** Title backdrop: animated Roanoke skyline (title.js) + Matthew heroic idle vs a Silas silhouette. */
/** 2.1.1: one strip cell as its own canvas (cached), for effects that take a whole sprite (title silhouette). */
const cellCanvases = new Map();
function cellCanvas(f) {
  const k = (f.img.src || '') + '|' + f.sx + '|' + f.sy + '|' + f.sw;
  let c = cellCanvases.get(k);
  if (!c) { c = document.createElement('canvas'); c.width = f.sw; c.height = f.sh; c.getContext('2d').drawImage(f.img, f.sx, f.sy, f.sw, f.sh, 0, 0, f.sw, f.sh); cellCanvases.set(k, c); }
  return c;
}
function drawTitleBg(dt) {
  ctx.setTransform(SS, 0, 0, SS, 0, 0);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  ctx.imageSmoothingEnabled = false;
  title.drawBackdrop(ctx, W, H, dt);
  const t = performance.now() / 1000;
  const feetY = 512;
  // Silas: big rim-lit silhouette on the right, facing Matthew (2.1.1: Jack's new Silas, breathing idle)
  const saf = animFrame('silas_boss', 'idle', t * 1000);
  const sil = saf ? null : title.silhouette(getNpcSprite('silas', '#2c3e50', t));
  if (saf || sil) {
    ctx.save();
    ctx.globalAlpha = 0.92;
    drawGroundShadow(ctx, W * 0.78, feetY, 120);
    if (saf) drawAnimFrame({ ...saf, img: title.silhouette(cellCanvas(saf)), sx: 0, sy: 0 }, W * 0.78, feetY, -1, BOSS_SCALE * 1.55);
    else drawCastSprite(sil, W * 0.78, feetY, -1, BOSS_SCALE * 1.55);
    ctx.restore();
  }
  // Matthew (locked look) at heroic scale, left (2.1.1: Joe's new Matthew, breathing idle)
  const mx = W * 0.22;
  drawGroundShadow(ctx, mx, feetY, CHAR_DRAW_W * 1.5);
  ctx.save();
  ctx.translate(mx, feetY); ctx.scale(1.5, 1.5); ctx.translate(-mx, -feetY);
  const tmaf = USE_HERO_RENDER ? null : animFrame('matthew', 'idle', t * 1000, 'polo');
  if (tmaf) drawAnimFrame(tmaf, mx, feetY, 1, PLAYER_SCALE);
  else drawMatthew('idle', 'polo', OUTFITS.polo, t, mx, feetY, 1);
  ctx.restore();
  title.drawGrade(ctx, W, H);
  drawWeather(ctx, W, H, t, { groundY: feetY, title: true, cheap: cheapPresentation() }); // 1.7.0 weather over the title
  presenter.present({ mode: 'full', grade: getWeather() });
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
  if (window.__SCD_PREVIEW) return; // 1.5.0 preview build (/preview/): no SW, no auto-update
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
  console.log("Streets of Roanoke — Beat'em Up ready (assets loaded)");
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
      if (id === 'william') syncWilliam(); // 2.0.2: his spot moves with the story
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
    npcs() { return npcsInArea().map((n) => ({ id: n.id, x: n.x })); },
    killAll() { for (const e of gameState.enemies) { e.hp = 0; e.alive = false; e.stun = 0; } },
    god(on = true) { gameState.god = !!on; },
    /** v3: knock an enemy (index) or Matthew ('player') down; anim API status. */
    knockDown(which = 0) { const t = which === 'player' ? player : gameState.enemies[which]; if (t) knockDown(t, t === player ? -player.facing : player.facing); return !!t; },
    animApiReady,
    animFrame: (k, s, t) => !!animFrame(k, s, t), barks: { BARKS }, // 2.0.1 tests
    setSpecial(v) { gameState.special = v; },
    /** 1.4.0 outfit kits: table, art timing, live FX / projectiles (tests). */
    kits: { KITS, getKit, kitRow, specialTiming, fx: () => getKitFx(), projectiles: () => getProjectiles() },
    audio: audioDebug,
    persist,
    // >>> DLC: Silas prequel (tests)
    get dlc() { return dlc; },
    startDlc: (cont = false, diff = 'normal', which = 'silas') => { if (gameState.mode !== 'title') showTitle(); gameState.pendingDifficulty = diff; startDlc(cont, which); },
    startBlackriver: (cont = false, diff = 'normal') => { if (gameState.mode !== 'title') showTitle(); gameState.pendingDifficulty = diff; startDlc(cont, 'blackriver'); },
    brToggleOutfit: () => brToggleOutfit(),
    quitDlc: () => quitDlcToTitle(),
    showTitle: () => showTitle(),
    booted: () => booted, // 1.9.0: tests wait for boot (the title is reset when sprites finish loading)
    startMain: (fromSave = true) => { if (gameState.mode !== 'title') showTitle(); startGame(fromSave); },
    silasCooldowns: () => silasCooldowns(player),
    silasHooks: () => silasHooks(),
    coldStare: () => coldStare(player, gameState.enemies),
    interact: () => tryInteract(),
    silasMoves: { SILAS_MOVES, rows: silasMoveRows },
    dlcCard: () => ({ mission: !$('dlc-mission-card').classList.contains('hidden'), ending: !$('dlc-ending-screen').classList.contains('hidden') }),
    closeCard: () => closeDlcCard(),
    // 1.7.0 "Locked Up"
    arrest: () => gameState.arrest ? { phase: gameState.arrest.phase, actors: gameState.finaleActors.map((x) => ({ id: x.id, key: x.key, x: Math.round(x.x), walking: !!x.walking })) } : null,
    skipArrest: () => skipArrest(),
    // 1.9.0 scene player + zoom (tests)
    playScene: (id, o) => playScene(id, o), skipScene: () => skipScene(), listScenes: () => listScenes(),
    scene: () => { const c = currentScene(); return c ? { id: c.id, t: c.t, step: c.step, fx: { ...c.fx }, cam: c.cam && { ...c.cam }, actors: c.actors.map((a) => ({ id: a.id, x: Math.round(a.x), walking: !!a.walking, key: a.key })) } : null; },
    zoom: { get: getZoomLevel, set: setZoomLevel, cycle: cycleZoom },
    cameraFrame: () => ({ ...followCam.frame }),
    spawnFight(n = 2) { gameState.enemies = spawnWave(AREAS[gameState.areaId], n, gameState.wave++, player.x); gameState.combatLock = true; return gameState.enemies.length; },
    sceneSize: () => ({ ss: SS, w: scene.width, h: scene.height, dropped: autoRes.dropped }), // 1.8.0 HD
    startArrest: (x, y) => startArrest(x, y),
    travel: (areaId, x = 200) => travelTo(areaId, x, 1),
    prison: () => ({ open: prisonOpen(stateBag), visited: !!stateBag.silasVisited, keepsake: !!stateBag.prisonKeepsake, inPrison: isPrisonArea(gameState.areaId) }),
    useSpot: () => { const sp = prisonSpot(stateBag, gameState.areaId, player.x); if (sp) usePrisonSpot(sp); return sp ? sp.id : null; },
    choices: () => gameState.choice ? gameState.choice.list.map((c) => c.label) : null,
    pick: (i) => pickChoice(i),
    silasNode: () => gameState.silasTalk ? gameState.silasTalk.node : null,
    finishFinale: () => { if (gameState.cutscene) { const fn = gameState.cutscene.onDone; gameState.cutscene = null; if (gameState.mode === 'dialogue') finishDialogue(); fn && fn(); } }
    // <<< DLC
  };
}
// COOP-HOOK: hand js/coop the few internals it needs (read-only getters + existing functions)
coop.attach({
  gameState, stateBag, missions, input, followCam, AREAS, NPC_DEFS, GAME_VERSION,
  get player() { return player; }, get ctx() { return ctx; }, get booted() { return booted; },
  PLAYER_SCALE, CHAR_DRAW_W, PLAYER_START_Y,
  startGame, showTitle, persist, toast, updateHUD, syncDepthBand, pauseGame, resumeGame, advanceDialogue,
  onHitEnemy, drawAnimFrame, startDialogueRaw, startSide, completeSide, fetchDone, npcsInArea, sideMission, drawGroundShadow: (x, y, w, a) => drawGroundShadow(ctx, x, y, w, a), isDlc, refreshTitleButtons
});
boot();
