/**
 * Animated sprites — loads PNG sheets when available, canvas fallback.
 * Matthew v3: one 1152x192 sheet per outfit (8 frames of 144x192, same poses), see ASSETS.md.
 * Thugs + Silas (boss) use the same 8-pose sheet layout; NPCs are single 144x192 stills.
 */

const SCALE = 2;
const cache = new Map();
const images = {};
let loaded = false;
let loadPromise = null;

const SHEET = {
  matthew: { src: 'assets/sprites/matthew_sheet.png', frameW: 48 * 3, frameH: 64 * 3, poses: {
    idle: [0, 1], walk: [2, 3], punch: [4, 5], kick: [6], hurt: [7]
  }}
};

/** Per-outfit Matthew sheets (same layout contract as SHEET.matthew). Unknown ids try
 *  assets/sprites/matthew_<id>.png lazily, else use the default sheet. */
const OUTFIT_SHEETS = {
  polo: 'assets/sprites/matthew_sheet.png',
  photo: 'assets/sprites/matthew_photo.png',
  hoodie: 'assets/sprites/matthew_hoodie.png',
  jacket: 'assets/sprites/matthew_jacket.png',
  street: 'assets/sprites/matthew_street.png'
};
const outfitSheets = {};      // outfitId -> Image (loaded)
const outfitPending = {};     // outfitId -> true while lazily loading / after failure

/** Enemy fight sheets (8-pose layout). Keyed by thug colour from combat.js THUG_COLORS. */
const ENEMY_SHEET_SRC = {
  thug_purple: 'assets/sprites/thug_purple_sheet.png',
  thug_red: 'assets/sprites/thug_red_sheet.png',
  thug_teal: 'assets/sprites/thug_teal_sheet.png',
  thug_orange: 'assets/sprites/thug_orange_sheet.png',
  thug_grey: 'assets/sprites/thug_grey_sheet.png',
  silas: 'assets/sprites/silas_sheet.png'
};
const THUG_BY_COLOR = {
  '#8e44ad': 'thug_purple', '#c0392b': 'thug_red', '#16a085': 'thug_teal',
  '#d35400': 'thug_orange', '#7f8c8d': 'thug_grey'
};
const enemySheets = {};

const NPC_SRC = {
  dee: 'assets/sprites/dee.png',
  priya: 'assets/sprites/priya.png',
  hank: 'assets/sprites/hank.png',
  june: 'assets/sprites/june.png',
  tessa: 'assets/sprites/tessa.png',
  coach: 'assets/sprites/coach.png',
  cam: 'assets/sprites/cam.png',
  silas: 'assets/sprites/silas.png',
  thug_purple: 'assets/sprites/thug_purple.png',
  thug_red: 'assets/sprites/thug_red.png',
  thug_teal: 'assets/sprites/thug_teal.png',
  thug_orange: 'assets/sprites/thug_orange.png',
  thug_grey: 'assets/sprites/thug_grey.png'
};

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

export function loadSprites() {
  if (loadPromise) return loadPromise;
  loadPromise = (async () => {
    try {
      images.matthewSheet = await loadImage(SHEET.matthew.src);
      images.portrait = await loadImage('assets/sprites/portrait_matthew.png');
      images.heart = await loadImage('assets/sprites/heart.png');
      images.heartEmpty = await loadImage('assets/sprites/heart_empty.png');
      outfitSheets.polo = images.matthewSheet;
      const opt = async (src) => { try { return await loadImage(src); } catch (_) { console.warn('Sprite missing:', src); return null; } };
      await Promise.all([
        ...Object.entries(OUTFIT_SHEETS).filter(([id]) => id !== 'polo').map(async ([id, src]) => {
          const img = await opt(src); if (img) outfitSheets[id] = img; else outfitPending[id] = true;
        }),
        ...Object.entries(NPC_SRC).map(async ([k, src]) => { const img = await opt(src); if (img) images[k] = img; }),
        ...Object.entries(ENEMY_SHEET_SRC).map(async ([k, src]) => { const img = await opt(src); if (img) enemySheets[k] = img; })
      ]);
      loaded = true;
    } catch (e) {
      console.warn('Sprite sheet load failed, using canvas fallback', e);
      loaded = false;
    }
    return loaded;
  })();
  return loadPromise;
}

export function getHeartImages() {
  return { full: images.heart, empty: images.heartEmpty };
}

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w * SCALE;
  c.height = h * SCALE;
  const ctx = c.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.scale(SCALE, SCALE);
  return { c, ctx };
}

function px(ctx, x, y, w, h, color) {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), w, h);
}

/** Last-resort procedural Matthew (only if matthew_sheet.png itself fails to load). v3 skin palette. */
function drawMatthewPose(ctx, pose, outfit, t) {
  const skin = '#f8d6be', skinShade = '#e6baa2', hair = '#1a1210', facial = '#1a1210';
  const shirt = outfit.shirt || '#fafaf8';
  const pants = outfit.pants || '#5a7aa8';
  const accent = outfit.accent || '#1a2f5c';
  const shoe = '#5a371e';
  let armPunch = 0, kickExt = 0, legL = 0, legR = 0, torsoX = 0;
  if (pose === 'walk') {
    const phase = t * 10;
    legL = Math.sin(phase) * 6; legR = Math.sin(phase + Math.PI) * 6;
  } else if (pose === 'punch') { armPunch = 14; torsoX = 3; }
  else if (pose === 'kick') { kickExt = 16; }
  else if (pose === 'hurt') { torsoX = -4; }

  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath(); ctx.ellipse(20, 54, 12, 3, 0, 0, Math.PI * 2); ctx.fill();

  px(ctx, 14 + legL * 0.15, 36, 5, 14, pants);
  if (kickExt) {
    px(ctx, 26, 38, 14, 5, pants);
    px(ctx, 38, 37, 6, 6, shoe);
  } else {
    px(ctx, 21 + legR * 0.15, 36, 5, 14, pants);
  }
  px(ctx, 15, 42, 3, 2, skin);
  px(ctx, 22, 44, 2, 2, skin);
  px(ctx, 13, 49, 7, 4, shoe);
  if (!kickExt) px(ctx, 20, 49, 7, 4, shoe);

  px(ctx, 12 + torsoX, 20, 16, 17, shirt);
  px(ctx, 16 + torsoX, 18, 8, 3, skin);
  px(ctx, 12 + torsoX, 36, 16, 3, '#786028');
  px(ctx, 19 + torsoX, 36, 3, 3, '#c8a03c');

  if (armPunch) {
    px(ctx, 8 + torsoX, 22, 5, 12, skin);
    px(ctx, 26 + torsoX, 22, 5 + armPunch, 5, skin);
    px(ctx, 30 + torsoX + armPunch, 20, 7, 7, skinShade);
  } else {
    // SoR combat stance fists up
    px(ctx, 6 + torsoX, 14, 7, 7, skin);
    px(ctx, 8 + torsoX, 20, 5, 10, skin);
    px(ctx, 8 + torsoX, 20, 5, 5, shirt);
    px(ctx, 29 + torsoX, 12, 7, 7, skinShade);
    px(ctx, 29 + torsoX, 18, 5, 10, skin);
    px(ctx, 27 + torsoX, 20, 5, 5, shirt);
  }

  px(ctx, 14 + torsoX, 4, 12, 14, skin);
  px(ctx, 14 + torsoX, 3, 12, 5, hair);
  px(ctx, 13 + torsoX, 5, 2, 4, hair);
  px(ctx, 25 + torsoX, 5, 2, 4, hair);
  px(ctx, 15 + torsoX, 8, 4, 1, facial);
  px(ctx, 21 + torsoX, 8, 4, 1, facial);
  px(ctx, 16 + torsoX, 10, 3, 2, '#f0ece4');
  px(ctx, 21 + torsoX, 10, 3, 2, '#f0ece4');
  px(ctx, 17 + torsoX, 10, 2, 2, '#1a1510');
  px(ctx, 22 + torsoX, 10, 2, 2, '#1a1510');
  px(ctx, 16 + torsoX, 14, 8, 2, facial);
  px(ctx, 19 + torsoX, 16, 2, 3, facial);
}

function drawNpcPose(ctx, pose, color, t, isBoss) {
  const skin = '#c4a484', pants = '#2c3e50', shoe = '#1a1a1e';
  let punchExt = 0, legL = 0, legR = 0;
  if (pose === 'walk' || pose === 'chase') {
    const phase = t * 9;
    legL = Math.sin(phase) * 5; legR = Math.sin(phase + Math.PI) * 5;
  } else if (pose === 'punch') punchExt = 12;

  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath(); ctx.ellipse(20, 54, 11, 3, 0, 0, Math.PI * 2); ctx.fill();
  px(ctx, 14, 36, 5, 14, pants); px(ctx, 21, 36, 5, 14, pants);
  px(ctx, 13, 49, 7, 4, shoe); px(ctx, 20, 49, 7, 4, shoe);
  if (isBoss) { px(ctx, 11, 20, 18, 18, '#1a2535'); px(ctx, 13, 22, 14, 14, color); }
  else px(ctx, 12, 20, 16, 17, color);
  px(ctx, 16, 18, 8, 3, skin);
  px(ctx, 8, 22, 5, 12, skin);
  if (punchExt) {
    px(ctx, 26, 22, 5 + punchExt, 5, skin);
    px(ctx, 30 + punchExt, 20, 7, 7, skin);
  } else px(ctx, 27, 22, 5, 12, skin);
  px(ctx, 14, 4, 12, 14, skin);
  px(ctx, 14, 3, 12, 5, isBoss ? '#2c3e50' : '#3a2a20');
  px(ctx, 16, 10, 3, 2, '#f0ece4'); px(ctx, 21, 10, 3, 2, '#f0ece4');
}

function sheetFrame(pose, animT) {
  const map = SHEET.matthew.poses;
  const frames = map[pose] || map.idle;
  const idx = frames[Math.floor(Math.max(0, animT) * (pose === 'walk' ? 8 : 6)) % frames.length];
  return idx;
}

/** Copy one 144x192 frame out of an 8-pose sheet (cached per key). */
function sliceFrame(img, idx, key) {
  if (cache.has(key)) return cache.get(key);
  const { frameW, frameH } = SHEET.matthew;
  const c = document.createElement('canvas');
  c.width = frameW; c.height = frameH;
  const ctx = c.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(img, idx * frameW, 0, frameW, frameH, 0, 0, frameW, frameH);
  cache.set(key, c);
  return c;
}

/** Sheet for an outfit; lazily tries matthew_<id>.png for ids not in OUTFIT_SHEETS. Falls back to the default sheet. */
function outfitSheet(outfitId) {
  const id = outfitId || 'polo';
  if (outfitSheets[id]) return { img: outfitSheets[id], id };
  if (!outfitPending[id] && /^[a-z0-9_-]+$/i.test(id)) {
    outfitPending[id] = true;
    loadImage(OUTFIT_SHEETS[id] || `assets/sprites/matthew_${id}.png`)
      .then((img) => { outfitSheets[id] = img; })
      .catch(() => {});
  }
  return { img: images.matthewSheet, id: 'polo' };
}

export function getMatthewSprite(pose, outfitId, outfit, animT) {
  if (loaded && images.matthewSheet) {
    const idx = sheetFrame(pose === 'chase' ? 'walk' : pose, animT);
    const { img, id } = outfitSheet(outfitId);
    return sliceFrame(img, idx, `msheet|${idx}|${id}`);
  }
  const frame = pose === 'walk' ? Math.floor(animT * 8) % 4 : Math.floor(animT * 2) % 2;
  const key = `matt|${pose}|${outfitId}|${frame}`;
  if (cache.has(key)) return cache.get(key);
  const { c, ctx } = makeCanvas(48, 56);
  drawMatthewPose(ctx, pose, { ...outfit, ripped: true }, frame * 0.4);
  cache.set(key, c);
  return c;
}

export function getEnemySprite(pose, color, animT, isBoss) {
  const thugKey = THUG_BY_COLOR[color] || null;
  const sheetKey = isBoss ? 'silas' : thugKey;
  if (loaded && sheetKey && enemySheets[sheetKey]) {
    const idx = sheetFrame(pose === 'chase' ? 'walk' : pose, animT);
    return sliceFrame(enemySheets[sheetKey], idx, `esheet|${sheetKey}|${idx}`);
  }
  if (loaded && !isBoss && thugKey && images[thugKey] && (pose === 'idle' || pose === 'walk' || pose === 'chase')) {
    return images[thugKey];
  }
  if (loaded && isBoss && images.silas && pose !== 'punch') return images.silas;

  const frame = (pose === 'walk' || pose === 'chase') ? Math.floor(animT * 8) % 4 : Math.floor(animT * 2) % 2;
  const key = `${isBoss ? 'boss' : 'thug'}|${pose}|${color}|${frame}`;
  if (cache.has(key)) return cache.get(key);
  const { c, ctx } = makeCanvas(48, 56);
  drawNpcPose(ctx, pose, color, frame * 0.4, isBoss);
  cache.set(key, c);
  return c;
}

export function getNpcSprite(npcId, color, animT) {
  if (loaded && images[npcId]) return images[npcId];
  const frame = Math.floor(animT * 2) % 2;
  const key = `npc|${npcId || color}|${frame}`;
  if (cache.has(key)) return cache.get(key);
  const { c, ctx } = makeCanvas(48, 56);
  drawNpcPose(ctx, 'idle', color, frame * 0.5, npcId === 'silas');
  cache.set(key, c);
  return c;
}

export function drawSprite(ctx, spriteCanvas, x, y, facing) {
  if (!spriteCanvas) return;
  const drawW = 64, drawH = 84;
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  if (facing < 0) {
    ctx.translate(x, y - drawH);
    ctx.scale(-1, 1);
    ctx.drawImage(spriteCanvas, -drawW / 2, 0, drawW, drawH);
  } else {
    ctx.drawImage(spriteCanvas, x - drawW / 2, y - drawH, drawW, drawH);
  }
  ctx.restore();
}

export function drawCollectible(ctx, x, y, name, pulse) {
  const s = 8 + Math.sin(pulse) * 2;
  ctx.fillStyle = 'rgba(255,210,74,0.3)';
  ctx.beginPath(); ctx.arc(x, y - 20, s + 6, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#ffd24a';
  ctx.beginPath(); ctx.arc(x, y - 20, s, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.font = '9px sans-serif'; ctx.textAlign = 'center';
  ctx.fillText(name, x, y - 36); ctx.textAlign = 'left';
}

export function clearSpriteCache() { cache.clear(); }
