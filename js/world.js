
/** Connected Roanoke street areas — free-roam left/right between locations. */

import { loadProps, drawSceneLayer } from './props.js';
import { cheapPresentation } from './present.js';

const bgImages = {};
let bgsReady = false;

/**
 * Area id → preferred plate files (first loaded wins).
 * Primary 1920×540 plates: diner, downtown, railyard, millmountain.
 * 960×540 extras are tiled with parallax.
 */
const PLATE_FILES = {
  rails: ['railyard', 'rails'],
  star: ['millmountain', 'star']
};

/**
 * Plate-space (native px of the 1920×540 art) anchors for glow FX so
 * star / neon blooms stay locked to the painted features while panning.
 */
const PLATE_FX = {
  millmountain: { focus: 0.5, star: { x: 960, y: 120, r: 1.15 } },
  diner: {
    focus: 0,
    star: { x: 1250, y: 174, r: 0.55 },
    neon: [
      { x: 270, y: 100, rx: 150, ry: 34, color: '255,70,60' },   // DINER sign
      { x: 230, y: 290, rx: 50, ry: 20, color: '80,255,140' }    // OPEN sign
    ],
    lamps: [{ x: 704, y: 222 }]
  },
  downtown: {
    focus: 0.5,
    star: { x: 1050, y: 150, r: 0.6 },
    neon: [
      { x: 585, y: 190, rx: 28, ry: 90, color: '200,120,255' },  // BOOKS blade
      { x: 700, y: 214, rx: 80, ry: 18, color: '170,90,230' }    // VALLEY PAGES
    ]
  },
  // Railyard: no neon or star painted; its only sign (ROANOKE RAIL YARD, plate x 40–340) sits
  // left of the rails travel window (plate 248–1548), so no glows here.
  railyard: { focus: 0.4 }
};
// All four 1920 plates are fully opaque above the walk band (Joe, pass 3); every glow above is an
// additive bloom over painted art — nothing is drawn under the plates or relies on holes.
// Verified anchors (plate px): diner star 1250,172 · DINER 120–420×70–130 · OPEN 180–281×270–311 ·
// lamp head 704,222 · downtown BOOKS blade 559–611×100–281 · VALLEY PAGES 619–780×199–229 ·
// downtown star 1050,~148 · millmountain star 960,119 (rings r≈110).

/** Max plate pan speed relative to camera (set to Infinity for strict full-plate mapping). */
const PLATE_PAN_MAX_RATIO = 1;

/** Legacy 960×540 layout (rails / star / downtown_golden — fallback-only plates, not repainted). */
const EXTRA_FX = {
  star: { x: 480, y: 125, r: 0.5 },
  neon: [
    { x: 145, y: 148, rx: 110, ry: 24, color: '255,70,70' },     // DINER
    { x: 200, y: 273, rx: 52, ry: 24, color: '255,60,60' },      // OPEN
    { x: 730, y: 240, rx: 30, ry: 95, color: '255,170,90' }      // BOOKS blade
  ],
  lamps: [{ x: 323, y: 245 }, { x: 523, y: 245 }, { x: 623, y: 245 }]
};
for (const k of ['rails', 'star', 'downtown_golden']) {
  PLATE_FX[k] = EXTRA_FX;
}
/**
 * Repainted 960 extras (pass 3): new landmark above y 339, same street below (painted bench/bin
 * x 300–425, car x 720–880). Glows anchored to the new art; the old DINER/OPEN/BOOKS blooms are gone.
 */
Object.assign(PLATE_FX, {
  community: {
    star: { x: 859, y: 199, r: 0.2 }                                  // star-topped pole right of the hall
  },
  gym: {
    neon: [
      { x: 365, y: 149, rx: 240, ry: 20, color: '90,170,255' },     // VALLEY GYM light box
      { x: 489, y: 151, rx: 22, ry: 10, color: '255,210,90' }        // 24/7
    ],
    lamps: [{ x: 70, y: 249 }, { x: 655, y: 249 }]
  },
  pages: {
    star: { x: 860, y: 194, r: 0.2 },                                // rooftop star, right block
    neon: [{ x: 666, y: 160, rx: 14, ry: 100, color: '255,110,200' }], // BOOKS blade (pink)
    lamps: [{ x: 170, y: 249 }, { x: 690, y: 249 }]
  },
  river: {
    star: { x: 179, y: 194, r: 0.2 },                                // star on the bridge pole
    neon: [{ x: 463, y: 148, rx: 90, ry: 14, color: '255,220,140' }], // ROANOKE RIVER sign
    lamps: [{ x: 300, y: 239 }, { x: 780, y: 239 }]
  },
  skate: {
    star: { x: 205, y: 195, r: 0.28 },                               // star painted on the sign
    neon: [{ x: 386, y: 191, rx: 150, ry: 15, color: '255,90,70' }], // STARBOARD SKATE lettering
    lamps: [{ x: 776, y: 248 }]
  }
});

/**
 * Scene props (assets/props, drawn by props.js after the plate, before characters).
 * x = world x (on the 1920 plates the pan is camera-locked: plate x = world x + plate offset;
 * diner offset 0, downtown offset 260). `plate` guards against fallback plates. Bottom y
 * defaults to the plate's walk band top - 2 (back edge of the sidewalk, behind every character).
 * The 960-wide extra plates already paint a bench + bin + car, so they get no props here.
 */
const SCENE_PROPS = {
  diner: [
    // Concept: bench + metal can outside the diner. Window spans x 140–380, door 440–520,
    // painted bench 560–660, lamp 704, Dee stands at 320 — keep clear of all of them.
    { img: 'bench', x: 172, plate: 'diner' },
    { img: 'trashcan', x: 410, plate: 'diner' }
  ],
  downtown: [
    // No painted bench downtown. Can by the brown block (plate 380–560); bench + can in front of
    // the purple block (plate 1200–1360) right of the Mill Mountain gap / painted car.
    { img: 'trashcan', x: 262, plate: 'downtown' },
    { img: 'bench', x: 1010, plate: 'downtown' },
    { img: 'trashcan', x: 1086, plate: 'downtown' }
  ]
};

/**
 * Receding cross street toward Mill Mountain + the star (concept centrepiece). World x
 * (diner: plate x == world x). Base on the main road's far curb (y 420), cut through the
 * sidewalk (380–419) with a crosswalk, apex at the mountain foot just left of the star (1250).
 */
const SCENE_STREETS = {
  diner: { plate: 'diner', mouthX: 1130, mouthW: 320, baseY: 420, sidewalkTop: 380, vpX: 1220, vpY: 338 }
};

/**
 * Floating street labels, anchored in PLATE space (cx, cy = centre in plate px) so they stay on
 * the painted building/awning band while panning (960 plates parallax at 0.45×, so world-space
 * labels used to drift onto NPC legs). `post` draws a sign post down to the sidewalk back edge.
 * Dropped: diner OPEN 24HRS (painted OPEN sign), river ROANOKE RIVER (painted), community WELCOME
 * (painted STAR CITY COMMUNITY CENTER). area.props 'sign' entries remain for the procedural fallback.
 */
const SCENE_SIGNS = {
  downtown: [{ text: 'JEFFERSON ST', cx: 1135, cy: 318, post: true }], // corner post in the gap right of the parked car (clear of Cam 520 / Silas 700)
  railyard: [{ text: 'YARD 3', cx: 520, cy: 322 }],                   // on the second shed
  millmountain: [{ text: 'STAR CITY', cx: 960, cy: 402 }],            // plaque on the overlook slab
  pages: [{ text: 'RARE MAPS', cx: 290, cy: 297 }],                   // placard in the left display window
  skate: [{ text: 'SESSION', cx: 510, cy: 262 }],                     // top of the roll-up door
  gym: [{ text: 'OPEN IRON', cx: 515, cy: 306 }]                      // brick right of the gym door
};

/** Painted signs (plate px rects) that NPC nametags must not cover — see getSignRects(). */
const PAINTED_SIGNS = {
  diner: [[120, 70, 420, 130], [180, 270, 281, 311]],
  downtown: [[559, 100, 611, 281], [619, 199, 780, 229]],
  railyard: [[40, 195, 340, 230]],
  millmountain: [[30, 30, 270, 70]],
  community: [[290, 182, 630, 210]],
  gym: [[120, 128, 610, 170]],
  pages: [[215, 222, 626, 252], [654, 60, 678, 260]],
  river: [[375, 135, 552, 162]],
  skate: [[170, 168, 740, 226]]
};

/** Ambient sedan on the far lane (cosmetic, no collision). laneY = tyre line just past the far curb. */
const SCENE_TRAFFIC = {
  diner: { plate: 'diner', laneY: 426, speed: 150, turnChance: 0.6 },
  downtown: { plate: 'downtown', laneY: 426, speed: 150 }
};

/** Areas where neon reads strongest (concept: diner neon at golden hour). */
const NEON_AREAS = { diner: 1.4, pages: 0.8, skate: 0.8, downtown: 0.55, gym: 0.45, river: 0.5, community: 0.45 };

export function loadBackgrounds() {
  const ids = [
    'downtown', 'diner', 'railyard', 'millmountain',
    'pages', 'skate', 'gym', 'rails', 'river', 'star', 'community', 'downtown_golden'
  ];
  return Promise.all([loadProps(), ...ids.map((id) => new Promise((resolve) => {
    const img = new Image();
    img.onload = () => { bgImages[id] = img; resolve(); };
    img.onerror = () => resolve();
    img.src = `assets/bg/${id}.png`;
  }))]).then(() => { bgsReady = true; return true; });
}

/** Resolve the plate image + its file key for an area id. */
function resolvePlate(areaId) {
  const prefs = PLATE_FILES[areaId] || [areaId];
  for (const key of prefs) if (bgImages[key]) return { img: bgImages[key], key };
  if (bgImages.downtown_golden) return { img: bgImages.downtown_golden, key: 'downtown_golden' };
  if (bgImages.downtown) return { img: bgImages.downtown, key: 'downtown' };
  return null;
}

export const AREAS = {
  downtown: {
    id: 'downtown', name: 'Downtown Roanoke',
    width: 1400,
    leftTo: 'community', rightTo: 'diner',
    sky: ['#f4a261', '#e76f51', '#2a3a5c'],
    ground: '#3a3a42', sidewalk: '#6a6a72',
    accent: '#c45c26',
    buildings: [
      { x: 40, w: 180, h: 220, color: '#8b4513', label: 'Market' },
      { x: 260, w: 140, h: 180, color: '#a0522d', label: 'Hotel' },
      { x: 440, w: 160, h: 200, color: '#6b4423', label: 'City Hall' },
      { x: 650, w: 120, h: 160, color: '#7a5230', label: 'Shop' },
      { x: 820, w: 200, h: 240, color: '#5c4033', label: 'Offices' },
      { x: 1080, w: 150, h: 190, color: '#8b5a2b', label: 'Bank' }
    ],
    props: [
      { type: 'lamp', x: 200 }, { type: 'lamp', x: 500 },
      { type: 'lamp', x: 800 }, { type: 'tree', x: 1000 },
      { type: 'sign', x: 600, text: 'JEFFERSON ST' }
    ],
    spawnCombat: true, combatChance: 0.35
  },
  diner: {
    id: 'diner', name: "Dee's Diner",
    width: 1500, // reveals the plate's Mill Mountain + star side (plate is 1920 wide, camera-locked pan)
    leftTo: 'downtown', rightTo: 'pages',
    sky: ['#f4a261', '#e9c46a', '#264653'],
    ground: '#3a3a42', sidewalk: '#6a6a72',
    accent: '#d35400',
    buildings: [
      { x: 80, w: 280, h: 160, color: '#c0392b', label: "DEE'S DINER", neon: true },
      { x: 420, w: 140, h: 140, color: '#7f8c8d', label: 'Parking' },
      { x: 620, w: 180, h: 180, color: '#8b6914', label: 'Apartments' },
      { x: 860, w: 120, h: 150, color: '#6b4423', label: 'Alley' }
    ],
    props: [
      { type: 'lamp', x: 180 }, { type: 'table', x: 300 },
      { type: 'sign', x: 500, text: 'OPEN 24HRS' }
    ],
    spawnCombat: true, combatChance: 0.25
  },
  pages: {
    id: 'pages', name: 'Valley Pages',
    width: 1000,
    leftTo: 'diner', rightTo: 'skate',
    sky: ['#e9c46a', '#f4a261', '#2a3a5c'],
    ground: '#3a3a42', sidewalk: '#6a6a72',
    accent: '#8e44ad',
    buildings: [
      { x: 100, w: 260, h: 170, color: '#6c3483', label: 'VALLEY PAGES', neon: true },
      { x: 420, w: 150, h: 150, color: '#5d4e37', label: 'Cafe' },
      { x: 620, w: 180, h: 200, color: '#7a5230', label: 'Gallery' },
      { x: 850, w: 100, h: 140, color: '#4a3728', label: 'Alley' }
    ],
    props: [
      { type: 'lamp', x: 220 }, { type: 'tree', x: 550 },
      { type: 'sign', x: 350, text: 'RARE MAPS' }
    ],
    spawnCombat: true, combatChance: 0.3
  },
  skate: {
    id: 'skate', name: 'Starboard Skate',
    width: 950,
    leftTo: 'pages', rightTo: 'gym',
    sky: ['#e76f51', '#f4a261', '#1a2740'],
    ground: '#3a3a42', sidewalk: '#5a5a62',
    accent: '#e74c3c',
    buildings: [
      { x: 80, w: 240, h: 150, color: '#c0392b', label: 'STARBOARD SKATE', neon: true },
      { x: 380, w: 160, h: 130, color: '#2c3e50', label: 'Ramp' },
      { x: 600, w: 180, h: 180, color: '#7f8c8d', label: 'Warehouse' }
    ],
    props: [
      { type: 'rail', x: 400 }, { type: 'lamp', x: 250 },
      { type: 'sign', x: 500, text: 'SESSION' }
    ],
    spawnCombat: true, combatChance: 0.4
  },
  gym: {
    id: 'gym', name: 'Valley Gym',
    width: 900,
    leftTo: 'skate', rightTo: 'rails',
    sky: ['#f4a261', '#e76f51', '#264653'],
    ground: '#3a3a42', sidewalk: '#6a6a72',
    accent: '#2980b9',
    buildings: [
      { x: 100, w: 280, h: 180, color: '#1a5276', label: 'VALLEY GYM', neon: true },
      { x: 440, w: 160, h: 140, color: '#5d6d7e', label: 'Locker' },
      { x: 660, w: 140, h: 160, color: '#4a3728', label: 'Supply' }
    ],
    props: [
      { type: 'lamp', x: 200 }, { type: 'sign', x: 380, text: 'OPEN IRON' }
    ],
    spawnCombat: true, combatChance: 0.35
  },
  rails: {
    id: 'rails', name: 'Rail Yards',
    width: 1300,
    leftTo: 'gym', rightTo: 'river',
    sky: ['#e76f51', '#264653', '#1a1a2e'],
    ground: '#2a2a30', sidewalk: '#4a4a50',
    accent: '#7f8c8d',
    buildings: [
      { x: 60, w: 200, h: 100, color: '#566573', label: 'Boxcar' },
      { x: 300, w: 180, h: 90, color: '#784212', label: 'Boxcar' },
      { x: 520, w: 120, h: 160, color: '#1c2833', label: 'Signal' },
      { x: 700, w: 220, h: 110, color: '#5d6d7e', label: 'Platform' },
      { x: 980, w: 160, h: 100, color: '#784212', label: 'Crates' }
    ],
    props: [
      { type: 'rail', x: 200 }, { type: 'rail', x: 600 },
      { type: 'lamp', x: 450 }, { type: 'sign', x: 800, text: 'YARD 3' }
    ],
    spawnCombat: true, combatChance: 0.5
  },
  river: {
    id: 'river', name: 'River Bridge',
    width: 1100,
    leftTo: 'rails', rightTo: 'star',
    sky: ['#e9c46a', '#f4a261', '#1a2740'],
    ground: '#3a3a42', sidewalk: '#5a5a62',
    accent: '#3498db',
    buildings: [
      { x: 200, w: 600, h: 80, color: '#5d6d7e', label: 'BRIDGE DECK' },
      { x: 100, w: 60, h: 200, color: '#2c3e50', label: 'Pier' },
      { x: 800, w: 60, h: 200, color: '#2c3e50', label: 'Pier' }
    ],
    props: [
      { type: 'lamp', x: 300 }, { type: 'lamp', x: 550 }, { type: 'lamp', x: 750 },
      { type: 'sign', x: 450, text: 'ROANOKE RIVER' }
    ],
    spawnCombat: true, combatChance: 0.3,
    water: true
  },
  star: {
    id: 'star', name: 'Mill Mountain Star',
    width: 1000,
    leftTo: 'river', rightTo: null,
    sky: ['#f4a261', '#e76f51', '#0d1b2a'],
    ground: '#3a4a3a', sidewalk: '#5a6a5a',
    accent: '#ffd24a',
    buildings: [
      { x: 350, w: 200, h: 40, color: '#4a5a4a', label: 'Overlook' },
      { x: 700, w: 120, h: 100, color: '#3d4a3a', label: 'Trail Hut' }
    ],
    props: [
      { type: 'star', x: 450 }, { type: 'tree', x: 150 }, { type: 'tree', x: 800 },
      { type: 'lamp', x: 300 }, { type: 'sign', x: 600, text: 'STAR CITY' }
    ],
    spawnCombat: false, combatChance: 0
  },
  community: {
    id: 'community', name: 'Community Center',
    width: 950,
    leftTo: null, rightTo: 'downtown',
    sky: ['#e9c46a', '#f4a261', '#264653'],
    ground: '#3a3a42', sidewalk: '#6a6a72',
    accent: '#27ae60',
    buildings: [
      { x: 80, w: 280, h: 170, color: '#1e8449', label: 'COMMUNITY CENTER', neon: true },
      { x: 420, w: 160, h: 140, color: '#5d6d7e', label: 'Park' },
      { x: 640, w: 180, h: 160, color: '#6b4423', label: 'Elmwood' }
    ],
    props: [
      { type: 'tree', x: 480 }, { type: 'tree', x: 560 },
      { type: 'lamp', x: 200 }, { type: 'sign', x: 350, text: 'WELCOME' }
    ],
    spawnCombat: false, combatChance: 0.15
  }
};

export const AREA_ORDER = [
  'community', 'downtown', 'diner', 'pages', 'skate', 'gym', 'rails', 'river', 'star'
];

/**
 * Walkable depth band = feet Y (world px == plate px; plates are drawn at scale 1, y offset 0).
 * Smaller Y = farther back. Values from the measured table in ASSETS.md ("Walkable bands"):
 * walkable top + 8 .. 528 (12px off the canvas bottom so feet/shadows never clip).
 * DEPTH is the global fallback (safe on every plate); gameplay uses getDepth(area).
 */
export const DEPTH = { min: 408, max: 528, groundY: 536 };

const PLATE_DEPTH = {
  diner: { min: 388, max: 528 },        // sidewalk 380-419, street 420-539
  downtown: { min: 388, max: 528 },
  railyard: { min: 388, max: 528 },     // dirt platform 380-429, track bed 430-539
  millmountain: { min: 408, max: 528 }, // sidewalk 400-439 (plaza slab 390-415 mid-plate)
  narrow: { min: 340, max: 528 }        // all 960-wide plates: sidewalk 339-399, street 400-539
};

/** Walkable feet-Y band {min, max} for an area (object or id), keyed by the plate it draws. */
export function getDepth(area) {
  const id = typeof area === 'string' ? area : area && area.id;
  const plate = id ? resolvePlate(id) : null;
  if (!plate) return DEPTH;
  return PLATE_DEPTH[plate.key] || (plate.img.width < 1440 ? PLATE_DEPTH.narrow : DEPTH);
}

let lastBgT = 0;

/** @param {number} [dt] frame step for ambient scene motion (0 = frozen, omitted = wall clock). */
export function drawBackground(ctx, area, cameraX, W, H, dt) {
  const t = performance.now() / 1000;
  const stepDt = dt === undefined ? Math.min(0.05, Math.max(0, t - (lastBgT || t))) : dt;
  lastBgT = t;
  const plate = resolvePlate(area.id);
  const band = getDepth(area); // per-area walk band (plate-measured); DEPTH is only the fallback
  const glow = { stars: [], neon: [], lamps: [] };
  const neonK = NEON_AREAS[area.id] || 0.3;
  lastPlate = { areaId: area.id, key: null, offsets: [], scale: 1, W };

  if (plate) {
    const { img, key } = plate;
    const scale = H / img.height;
    const drawW = img.width * scale;
    const offsets = [];
    if (drawW > W + 1) {
      // Plate wider than the lens: pan across area width (no tiling / seams).
      // Map cameraX over [0, area.width - W] onto the plate, but never faster than
      // PLATE_PAN_MAX_RATIO× camera speed (plates have the street baked in, so a
      // faster pan makes the painted sidewalk slide under the characters). When the
      // area is too short to cover the whole plate, the travel window sits at the
      // plate's `focus` (0 = left, 0.5 = centered) so key art stays framed.
      // W is the visible lens width (narrower than the canvas when the camera is zoomed).
      const maxCam = Math.max(1, area.width - W);
      const span = drawW - W;
      const travel = Math.min(span, maxCam * PLATE_PAN_MAX_RATIO);
      const focus = PLATE_FX[key]?.focus ?? 0.5;
      const k = Math.max(0, Math.min(1, cameraX / maxCam));
      const off = Math.round(focus * (span - travel) + k * travel);
      ctx.drawImage(img, -off, 0, drawW, H);
      offsets.push(-off);
    } else {
      // Narrow extra: parallax tile
      const shift = ((cameraX * 0.45) % drawW + drawW) % drawW;
      for (let x0 = -shift; x0 < W; x0 += drawW - 1) {
        ctx.drawImage(img, x0, 0, drawW, H);
        offsets.push(x0);
      }
    }
    // Props / receding street / ambient sedan: above the plate, below grade + characters.
    const scene = drawSceneLayer(ctx, {
      areaId: area.id, plateKey: key, cameraX, W, dt: stepDt,
      groundY: band.min - 2,
      props: SCENE_PROPS[area.id], street: SCENE_STREETS[area.id], traffic: SCENE_TRAFFIC[area.id]
    });
    for (const l of scene.lamps) glow.lamps.push(l);
    lastPlate = { areaId: area.id, key, offsets, scale, W };
    const fx = PLATE_FX[key];
    if (fx) {
      for (const ox of offsets) {
        if (fx.star) {
          const sx = ox + fx.star.x * scale;
          if (sx > -260 && sx < W + 260) glow.stars.push({ x: sx, y: fx.star.y * scale, r: fx.star.r });
        }
        for (const n of fx.neon || []) {
          glow.neon.push({ x: ox + n.x * scale, y: n.y * scale, rx: n.rx * scale, ry: n.ry * scale, color: n.color });
        }
        for (const l of fx.lamps || []) glow.lamps.push({ x: ox + l.x * scale, y: l.y * scale });
      }
    }
  } else {
    drawProceduralScene(ctx, area, cameraX, W, H, t, glow, band);
  }

  // Mill Mountain star from prop (procedural, or plate without an anchor)
  if (area.id === 'star' && glow.stars.length === 0) {
    const sp = (area.props || []).find((p) => p.type === 'star');
    if (sp) glow.stars.push({ x: sp.x - cameraX, y: band.min - 140, r: 1.15, drawShape: true });
  }

  // 1) Golden-hour grade over the plate, then sun shafts, contact, and street sheen
  drawGoldenGrade(ctx, area, W, H, glow.stars[0], band);
  drawSunShafts(ctx, W, H, glow.stars[0], band);
  drawStreetMaterial(ctx, W, H, band);

  // 2) Additive glows (after grade so they stay punchy)
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const l of glow.lamps) drawLampGlow(ctx, l.x, l.y, t, l.s);
  for (const n of glow.neon) drawNeonBloom(ctx, n, t, neonK);
  for (const s of glow.stars) {
    const strength = area.id === 'star' ? s.r : s.r * 0.75;
    drawStarGlow(ctx, s.x, s.y, strength, t);
  }
  ctx.restore();
  for (const s of glow.stars) {
    if (s.drawShape) {
      ctx.fillStyle = '#ffe58a';
      drawStar(ctx, s.x, s.y, 5, 26, 11);
    }
  }

  // 3) Sidewalk depth lanes (gameplay readability) + sunlit dust in the air
  drawDepthLanes(ctx, W, H, band);
  drawDust(ctx, W, H, stepDt, band);

  // Lens vignette is applied after the camera crop (present.js) so it frames the
  // visible picture instead of the cropped sky.

  // Edge exit hints — on the back strip of this area's sidewalk (under the characters)
  ctx.font = 'bold 12px sans-serif';
  const hintY = band.min + 10;
  if (area.leftTo && cameraX < 40) {
    drawHint(ctx, '◀ ' + (AREAS[area.leftTo]?.name || ''), 12, hintY);
  }
  if (area.rightTo && cameraX > area.width - W - 40) {
    const nm = (AREAS[area.rightTo]?.name || '') + ' ▶';
    drawHint(ctx, nm, W - ctx.measureText(nm).width - 12, hintY);
  }

  // Street labels: plate-anchored on the building band (procedural fallback keeps area.props signs)
  if (plate) {
    for (const r of signRects(SCENE_SIGNS[lastPlate.key])) {
      drawPlateSign(ctx, r, band.min - 8);
    }
  } else {
    for (const p of area.props || []) {
      if (p.type !== 'sign') continue;
      const px = p.x - cameraX;
      if (px < -100 || px > W + 40) continue;
      drawProp(ctx, p, px, band.min - 22);
    }
  }
}

let lastPlate = { areaId: null, key: null, offsets: [], scale: 1, W: 960 };
const SIGN_FONT = 'bold 9px sans-serif';
let measureCtx = null;
function signWidth(text) {
  if (!measureCtx) measureCtx = document.createElement('canvas').getContext('2d');
  measureCtx.font = SIGN_FONT;
  return Math.ceil(measureCtx.measureText(text).width) + 18;
}

/** Plate-space labels → screen rects for every visible plate tile (last drawn plate). */
function signRects(list) {
  const out = [];
  const { offsets, scale, W } = lastPlate;
  for (const sgn of list || []) {
    const w = signWidth(sgn.text), h = 20;
    for (const ox of offsets) {
      const cx = ox + sgn.cx * scale, cy = sgn.cy * scale;
      if (cx + w < 0 || cx - w > W) continue;
      out.push({ x: Math.round(cx - w / 2), y: Math.round(cy - h / 2), w, h, text: sgn.text, post: sgn.post });
    }
  }
  return out;
}

function drawPlateSign(ctx, r, groundY) {
  ctx.save();
  if (r.post) {
    ctx.fillStyle = '#23232a';
    ctx.fillRect(r.x + Math.round(r.w / 2) - 2, r.y + r.h, 4, Math.max(0, groundY - (r.y + r.h)));
  }
  ctx.fillStyle = 'rgba(20,16,12,0.88)';
  ctx.fillRect(r.x, r.y, r.w, r.h);
  ctx.strokeStyle = '#ffd24a';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1);
  ctx.fillStyle = '#ffd24a';
  ctx.font = SIGN_FONT;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(r.text, r.x + r.w / 2, r.y + r.h / 2 + 1);
  ctx.restore();
}

/**
 * Screen-space rects (canvas px) of painted shop signs + plate-anchored street labels for the
 * area last drawn by drawBackground — main.js keeps NPC nametags off them.
 * @returns {{x:number,y:number,w:number,h:number}[]}
 */
export function getSignRects(areaId) {
  if (!lastPlate.key || (areaId && areaId !== lastPlate.areaId)) return [];
  const out = signRects(SCENE_SIGNS[lastPlate.key]).map(({ x, y, w, h }) => ({ x, y, w, h }));
  const { offsets, scale, W } = lastPlate;
  for (const [x0, y0, x1, y1] of PAINTED_SIGNS[lastPlate.key] || []) {
    for (const ox of offsets) {
      const x = ox + x0 * scale, w = (x1 - x0) * scale;
      if (x + w < 0 || x > W) continue;
      out.push({ x, y: y0 * scale, w, h: (y1 - y0) * scale });
    }
  }
  return out;
}

function drawHint(ctx, text, x, y) {
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.85)';
  ctx.shadowBlur = 4;
  ctx.fillStyle = 'rgba(255,214,90,0.95)';
  ctx.fillText(text, x, y);
  ctx.restore();
}

/** Warm sky / cooler street grade. Uses soft-light + screen so the plate keeps its detail. */
function drawGoldenGrade(ctx, area, W, H, star, band = DEPTH) {
  ctx.save();
  // Soft-light warm-to-cool ramp
  ctx.globalCompositeOperation = 'soft-light';
  let g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, 'rgba(255,130,40,0.45)');
  g.addColorStop(0.45, 'rgba(255,165,70,0.32)');
  g.addColorStop(0.62, 'rgba(255,190,120,0.12)');
  g.addColorStop(0.8, 'rgba(60,80,140,0.30)');
  g.addColorStop(1, 'rgba(20,30,80,0.42)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  // Low sun haze near horizon (screen)
  ctx.globalCompositeOperation = 'screen';
  const sx = star ? Math.max(W * 0.2, Math.min(W * 0.85, star.x + 120)) : W * 0.64;
  const sy = band.min - 70;
  g = ctx.createRadialGradient(sx, sy, 10, sx, sy, W * 0.62);
  g.addColorStop(0, 'rgba(255,190,90,0.22)');
  g.addColorStop(0.35, 'rgba(255,140,60,0.07)');
  g.addColorStop(1, 'rgba(255,120,40,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, band.max);

  // Rim of warm light raking across the sidewalk (feathered, no hard edge)
  g = ctx.createLinearGradient(0, band.min - 40, 0, band.max);
  g.addColorStop(0, 'rgba(255,170,90,0)');
  g.addColorStop(0.45, 'rgba(255,170,90,0.1)');
  g.addColorStop(1, 'rgba(255,170,90,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, band.min - 40, W, band.max - band.min + 40);
  ctx.restore();
}

/**
 * A few screen-blended shafts from the low sun. Cheap stand-in for volumetric
 * light: a handful of gradient wedges, no blur. Fewer wedges on small or
 * low-power screens.
 */
function drawSunShafts(ctx, W, H, star, band) {
  const sx = star ? Math.max(W * 0.12, Math.min(W * 0.88, star.x)) : W * 0.68;
  const sy = star ? star.y : Math.min(band.min - 150, H * 0.22);
  const angles = cheapPresentation() ? [0.7, 1.25, 1.8] : [0.55, 0.92, 1.25, 1.58, 1.95];
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  ctx.translate(sx, sy);
  for (let i = 0; i < angles.length; i++) {
    ctx.save();
    ctx.rotate(angles[i]);
    const len = H * 0.92;
    const g = ctx.createLinearGradient(0, 0, len, 0);
    const a = 0.04 + (i % 2) * 0.018;
    g.addColorStop(0, `rgba(255,220,160,${a + 0.025})`);
    g.addColorStop(0.5, `rgba(255,186,110,${a})`);
    g.addColorStop(1, 'rgba(255,170,80,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(0, -8 - i);
    ctx.lineTo(len, -42 - i * 5);
    ctx.lineTo(len, 42 + i * 5);
    ctx.lineTo(0, 8 + i);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  ctx.restore();
}

/**
 * Asphalt catching the low sun, plus a soft contact shadow where the
 * storefronts meet the sidewalk (a cheap ambient-occlusion seam).
 */
function drawStreetMaterial(ctx, W, H, band) {
  ctx.save();
  ctx.globalCompositeOperation = 'soft-light';
  const y0 = band.max - 50;
  const g = ctx.createLinearGradient(0, y0, 0, H);
  g.addColorStop(0, 'rgba(255,196,140,0)');
  g.addColorStop(0.28, 'rgba(255,186,120,0.42)');
  g.addColorStop(0.62, 'rgba(140,148,170,0.22)');
  g.addColorStop(1, 'rgba(16,22,40,0.5)');
  ctx.fillStyle = g;
  ctx.fillRect(0, y0, W, H - y0);

  const ao = ctx.createLinearGradient(0, band.min - 24, 0, band.min + 28);
  ao.addColorStop(0, 'rgba(40,18,8,0)');
  ao.addColorStop(0.55, 'rgba(24,10,6,0.62)');
  ao.addColorStop(1, 'rgba(24,10,6,0)');
  ctx.fillStyle = ao;
  ctx.fillRect(0, band.min - 24, W, 52);
  ctx.restore();
}

const DUST = [];
function drawDust(ctx, W, H, dt, band) {
  const count = cheapPresentation() ? 8 : 22;
  if (!DUST.length) {
    for (let i = 0; i < 22; i++) {
      DUST.push({
        x: Math.random(),
        y: Math.random() * 0.72,
        s: 0.7 + Math.random() * 1.3,
        v: 0.01 + Math.random() * 0.028,
        p: Math.random() * Math.PI * 2,
        a: 0.12 + Math.random() * 0.28
      });
    }
  }
  const t = performance.now() / 1000;
  const span = Math.max(band.min - 8, H * 0.72);
  ctx.save();
  ctx.fillStyle = '#ffe6b8';
  for (let i = 0; i < count; i++) {
    const p = DUST[i];
    if (dt > 0) {
      p.y -= p.v * dt;
      p.x += Math.sin(t * 0.55 + p.p) * 0.02 * dt;
      if (p.y < -0.02) { p.y = 0.74; p.x = Math.random(); }
      if (p.x < -0.02) p.x += 1;
      if (p.x > 1.02) p.x -= 1;
    }
    const tw = 0.4 + 0.6 * (0.5 + 0.5 * Math.sin(t * 1.3 + p.p));
    ctx.globalAlpha = p.a * tw;
    ctx.fillRect(p.x * W, p.y * span, p.s, p.s);
  }
  ctx.restore();
}

function drawStarGlow(ctx, x, y, strength, t) {
  const pulse = 0.85 + 0.15 * Math.sin(t * 2.1);
  const s = strength * pulse;
  // Wide halo
  let g = ctx.createRadialGradient(x, y, 0, x, y, 170 * strength);
  g.addColorStop(0, `rgba(255,236,170,${0.55 * s})`);
  g.addColorStop(0.25, `rgba(255,200,100,${0.28 * s})`);
  g.addColorStop(1, 'rgba(255,150,60,0)');
  ctx.fillStyle = g;
  ctx.fillRect(x - 180 * strength, y - 180 * strength, 360 * strength, 360 * strength);
  // Rays
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(t * 0.08);
  const rays = 14;
  for (let i = 0; i < rays; i++) {
    const len = (i % 2 ? 70 : 115) * strength * (0.9 + 0.1 * Math.sin(t * 3 + i));
    const a = (i / rays) * Math.PI * 2;
    ctx.save();
    ctx.rotate(a);
    const rg = ctx.createLinearGradient(0, 0, len, 0);
    rg.addColorStop(0, `rgba(255,230,150,${0.35 * s})`);
    rg.addColorStop(1, 'rgba(255,200,100,0)');
    ctx.fillStyle = rg;
    ctx.beginPath();
    ctx.moveTo(0, -3 * strength);
    ctx.lineTo(len, 0);
    ctx.lineTo(0, 3 * strength);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  ctx.restore();
  // Hot core
  g = ctx.createRadialGradient(x, y, 0, x, y, 34 * strength);
  g.addColorStop(0, `rgba(255,255,230,${0.7 * s})`);
  g.addColorStop(1, 'rgba(255,220,140,0)');
  ctx.fillStyle = g;
  ctx.fillRect(x - 40 * strength, y - 40 * strength, 80 * strength, 80 * strength);
}

function drawNeonBloom(ctx, n, t, k) {
  if (n.x + n.rx * 2 < 0 || n.x - n.rx * 2 > ctx.canvas.width) return;
  // Neon flicker: slow breathe + rare quick buzz
  const buzz = Math.sin(t * 37 + n.x) > 0.985 ? 0.55 : 1;
  const a = (0.32 + 0.12 * Math.sin(t * 3.2 + n.x * 0.01)) * buzz * k;
  ctx.save();
  ctx.translate(n.x, n.y);
  ctx.scale(1, n.ry / n.rx);
  const r = n.rx * 1.6;
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
  g.addColorStop(0, `rgba(${n.color},${a})`);
  g.addColorStop(0.5, `rgba(${n.color},${a * 0.4})`);
  g.addColorStop(1, `rgba(${n.color},0)`);
  ctx.fillStyle = g;
  ctx.fillRect(-r, -r, r * 2, r * 2);
  ctx.restore();
}

function drawLampGlow(ctx, x, y, t, s = 1) {
  const a = (0.22 + 0.03 * Math.sin(t * 5 + x)) * Math.min(1, 0.5 + s * 0.5);
  const r = 46 * s;
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  // Hot core so the lamp head reads as an emissive material, then the spill.
  g.addColorStop(0, `rgba(255,244,214,${Math.min(0.9, a + 0.34)})`);
  g.addColorStop(0.16, `rgba(255,214,130,${a})`);
  g.addColorStop(1, 'rgba(255,180,80,0)');
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
}

/** Feathered lane guides + street falloff so depth movement stays readable. */
function drawDepthLanes(ctx, W, H, band = DEPTH) {
  const lanes = 4;
  const span = band.max - band.min;
  const lg = ctx.createLinearGradient(0, 0, W, 0);
  lg.addColorStop(0, 'rgba(255,225,180,0)');
  lg.addColorStop(0.2, 'rgba(255,225,180,0.07)');
  lg.addColorStop(0.8, 'rgba(255,225,180,0.07)');
  lg.addColorStop(1, 'rgba(255,225,180,0)');
  ctx.fillStyle = lg;
  for (let i = 1; i < lanes; i++) {
    const y = Math.round(band.min + (i / lanes) * span);
    ctx.fillRect(0, y, W, 1);
  }
  // Cool street falloff in front of the walkable band
  const g = ctx.createLinearGradient(0, band.max - 20, 0, H);
  g.addColorStop(0, 'rgba(10,14,30,0)');
  g.addColorStop(1, 'rgba(10,14,30,0.35)');
  ctx.fillStyle = g;
  ctx.fillRect(0, band.max - 20, W, H - (band.max - 20));
}

/** Procedural fallback scene (no PNG) — golden hour with neon + lamps + mountain star. */
function drawProceduralScene(ctx, area, cameraX, W, H, t, glow, band = DEPTH) {
  const DEPTH = band; // shadow the global fallback: procedural layout follows the area's walk band
  const sky = area.sky;
  const g = ctx.createLinearGradient(0, 0, 0, DEPTH.min);
  g.addColorStop(0, sky[2]);
  g.addColorStop(0.5, sky[1]);
  g.addColorStop(1, sky[0]);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  // Distant Mill Mountain silhouette (slow parallax)
  const mx = W * 0.55 - cameraX * 0.12;
  ctx.fillStyle = 'rgba(40,36,56,0.9)';
  ctx.beginPath();
  ctx.moveTo(mx - 420, DEPTH.min);
  ctx.lineTo(mx - 140, DEPTH.min - 120);
  ctx.lineTo(mx, DEPTH.min - 165);
  ctx.lineTo(mx + 160, DEPTH.min - 110);
  ctx.lineTo(mx + 460, DEPTH.min);
  ctx.closePath();
  ctx.fill();
  if (area.id !== 'star') {
    glow.stars.push({ x: mx, y: DEPTH.min - 178, r: 0.45, drawShape: true });
  }

  ctx.fillStyle = area.sidewalk;
  ctx.fillRect(0, DEPTH.min, W, DEPTH.max - DEPTH.min);
  ctx.fillStyle = area.ground;
  ctx.fillRect(0, DEPTH.max - 10, W, H - (DEPTH.max - 10));

  for (const b of area.buildings) {
    const bx = b.x - cameraX;
    if (bx + b.w < -20 || bx > W + 20) continue;
    const by = DEPTH.min - b.h + 40;
    ctx.fillStyle = b.color;
    ctx.fillRect(bx, by, b.w, b.h);
    ctx.fillStyle = shade(b.color, -30);
    ctx.fillRect(bx, by, b.w, 6);
    // Windows (warm lit)
    for (let wy = by + 18; wy < by + b.h - 50; wy += 26) {
      for (let wx = bx + 12; wx < bx + b.w - 18; wx += 24) {
        const lit = ((wx * 7 + wy * 13) | 0) % 5 !== 0;
        ctx.fillStyle = lit ? 'rgba(255,214,140,0.85)' : 'rgba(30,30,45,0.8)';
        ctx.fillRect(wx, wy, 10, 14);
      }
    }
    if (b.neon) {
      const flick = 0.75 + 0.25 * Math.sin(t * 3 + b.x);
      ctx.save();
      ctx.font = 'bold 18px sans-serif';
      ctx.textAlign = 'center';
      ctx.shadowColor = area.accent;
      ctx.shadowBlur = 18 * flick;
      ctx.fillStyle = '#fff2e0';
      ctx.fillText(b.label, bx + b.w / 2, by + 26);
      ctx.restore();
      glow.neon.push({ x: bx + b.w / 2, y: by + 20, rx: b.w * 0.5, ry: 20, color: hexToRgb(area.accent) });
    }
  }
  for (const p of area.props || []) {
    if (p.type === 'sign' || p.type === 'star') continue;
    const px = p.x - cameraX;
    if (px < -60 || px > W + 60) continue;
    drawProp(ctx, p, px, DEPTH.min + 20);
    if (p.type === 'lamp') glow.lamps.push({ x: px + 3, y: DEPTH.min + 20 - 95 });
  }
}

function hexToRgb(hex) {
  const n = parseInt(hex.replace('#', ''), 16);
  return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`;
}

function shade(hex, amt) {
  const n = parseInt(hex.replace('#', ''), 16);
  let r = Math.max(0, Math.min(255, ((n >> 16) & 255) + amt));
  let g = Math.max(0, Math.min(255, ((n >> 8) & 255) + amt));
  let b = Math.max(0, Math.min(255, (n & 255) + amt));
  return `rgb(${r},${g},${b})`;
}

function drawProp(ctx, p, x, baseY) {
  if (p.type === 'lamp') {
    ctx.fillStyle = '#2a2a30';
    ctx.fillRect(x, baseY - 90, 6, 90);
    ctx.fillStyle = 'rgba(255,210,100,0.9)';
    ctx.beginPath();
    ctx.arc(x + 3, baseY - 95, 8, 0, Math.PI * 2);
    ctx.fill();
  } else if (p.type === 'tree') {
    ctx.fillStyle = '#4a3728';
    ctx.fillRect(x + 8, baseY - 50, 10, 50);
    ctx.fillStyle = '#1e8449';
    ctx.beginPath();
    ctx.arc(x + 13, baseY - 70, 28, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#27ae60';
    ctx.beginPath();
    ctx.arc(x + 5, baseY - 80, 18, 0, Math.PI * 2);
    ctx.fill();
  } else if (p.type === 'sign') {
    ctx.save();
    ctx.fillStyle = 'rgba(20,16,12,0.88)';
    ctx.fillRect(x, baseY - 50, 90, 22);
    ctx.strokeStyle = '#ffd24a';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x + 0.5, baseY - 49.5, 89, 21);
    ctx.fillStyle = '#ffd24a';
    ctx.font = 'bold 9px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(p.text || '', x + 45, baseY - 35);
    ctx.restore();
  } else if (p.type === 'table') {
    ctx.fillStyle = '#8b4513';
    ctx.fillRect(x, baseY - 20, 40, 6);
    ctx.fillRect(x + 4, baseY - 14, 4, 14);
    ctx.fillRect(x + 32, baseY - 14, 4, 14);
  } else if (p.type === 'rail') {
    ctx.strokeStyle = '#7f8c8d';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x, baseY - 5);
    ctx.lineTo(x + 120, baseY - 5);
    ctx.stroke();
    ctx.lineWidth = 1;
    ctx.fillStyle = '#566573';
    for (let i = 0; i < 5; i++) ctx.fillRect(x + i * 28, baseY - 12, 6, 12);
  }
}

function drawStar(ctx, cx, cy, spikes, outer, inner) {
  let rot = Math.PI / 2 * 3;
  const step = Math.PI / spikes;
  ctx.beginPath();
  ctx.moveTo(cx, cy - outer);
  for (let i = 0; i < spikes; i++) {
    ctx.lineTo(cx + Math.cos(rot) * outer, cy + Math.sin(rot) * outer);
    rot += step;
    ctx.lineTo(cx + Math.cos(rot) * inner, cy + Math.sin(rot) * inner);
    rot += step;
  }
  ctx.closePath();
  ctx.fill();
}

/**
 * Final light pass over characters so sprites share the golden-hour grade:
 * cool sky fill from the upper left, warm key from the sun side.
 */
export function drawSceneGrade(ctx, area, W, H) {
  ctx.save();
  ctx.globalCompositeOperation = 'soft-light';
  const g = ctx.createLinearGradient(0, 0, W, H * 0.2);
  g.addColorStop(0, 'rgba(130,160,210,0.2)');
  g.addColorStop(0.4, 'rgba(255,180,100,0.08)');
  g.addColorStop(1, 'rgba(255,140,50,0.24)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  // Soft rim so the sun-facing side of a sprite picks up a little warmth.
  ctx.globalCompositeOperation = 'screen';
  const rim = ctx.createLinearGradient(W * 0.35, 0, W, H * 0.7);
  rim.addColorStop(0, 'rgba(255,190,110,0)');
  rim.addColorStop(1, 'rgba(255,176,80,0.07)');
  ctx.fillStyle = rim;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
}

/** Soft elliptical ground shadow under a character's feet (sized for 3:4 character frames). */
export function drawGroundShadow(ctx, x, y, drawW = 64, alpha = 0.42) {
  const rx = drawW * 0.36;
  const ry = Math.max(3, rx * 0.26);
  ctx.save();
  ctx.translate(x, y - 1);
  ctx.scale(1, ry / rx);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
  g.addColorStop(0, `rgba(10,6,4,${alpha})`);
  g.addColorStop(0.65, `rgba(10,6,4,${alpha * 0.55})`);
  g.addColorStop(1, 'rgba(10,6,4,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, rx, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/**
 * HUD minimap — draws into the dedicated HUD canvas (#minimap, 140×72).
 * @param {HTMLCanvasElement} canvas
 * @param {object} opts { areaId, playerX, areaWidth, facing, dest: { areaId, x } | null }
 */
export function drawMinimap(canvas, opts) {
  if (!canvas) return;
  const mctx = canvas.getContext('2d');
  const { areaId, playerX, areaWidth, facing = 1, dest = null } = opts;
  const mw = canvas.width, mh = canvas.height;
  const t = performance.now() / 1000;
  const order = AREA_ORDER;

  // Dark plate
  mctx.clearRect(0, 0, mw, mh);
  const bg = mctx.createLinearGradient(0, 0, 0, mh);
  bg.addColorStop(0, '#141a26');
  bg.addColorStop(1, '#0a0e16');
  mctx.fillStyle = bg;
  mctx.fillRect(0, 0, mw, mh);

  // Faint street grid (concept look)
  mctx.strokeStyle = 'rgba(190,200,215,0.10)';
  mctx.lineWidth = 1;
  for (let x = 6; x < mw; x += 13) {
    mctx.beginPath(); mctx.moveTo(x + 0.5, 4); mctx.lineTo(x + 0.5, mh - 16); mctx.stroke();
  }
  for (let y = 8; y < mh - 16; y += 10) {
    mctx.beginPath(); mctx.moveTo(4, y + 0.5); mctx.lineTo(mw - 4, y + 0.5); mctx.stroke();
  }

  // City strip: one segment per area along the main road
  const pad = 6;
  const seg = (mw - pad * 2) / order.length;
  const roadY = 26, roadH = 10;
  mctx.fillStyle = 'rgba(200,205,215,0.22)';
  mctx.fillRect(pad, roadY, mw - pad * 2, roadH);
  order.forEach((id, i) => {
    const ax = pad + i * seg;
    const cur = id === areaId;
    // block "buildings" above/below the road
    mctx.fillStyle = cur ? 'rgba(255,210,74,0.30)' : 'rgba(150,160,180,0.16)';
    mctx.fillRect(ax + 1, roadY - 12, seg - 2, 9);
    mctx.fillRect(ax + 1, roadY + roadH + 3, seg - 2, 9);
    // current segment stays muted gold so the yellow player triangle reads on top of it
    mctx.fillStyle = cur ? 'rgba(255,210,74,0.42)' : 'rgba(220,225,235,0.35)';
    mctx.fillRect(ax + 1, roadY + 2, seg - 2, roadH - 4);
  });

  // Destination: red dot with a pulsing ring (concept minimap)
  if (dest && order.includes(dest.areaId)) {
    const di = order.indexOf(dest.areaId);
    const dw = AREAS[dest.areaId]?.width || 1000;
    const dx = pad + di * seg + Math.max(0.1, Math.min(0.9, (dest.x ?? dw / 2) / dw)) * seg;
    const dy = roadY + roadH / 2;
    const pr = 5 + Math.sin(t * 4) * 1.2;
    mctx.fillStyle = 'rgba(255,60,50,0.28)';
    mctx.beginPath(); mctx.arc(dx, dy, pr, 0, Math.PI * 2); mctx.fill();
    mctx.fillStyle = '#ff3b30';
    mctx.strokeStyle = '#2a0806';
    mctx.lineWidth = 1;
    mctx.beginPath(); mctx.arc(dx, dy, 2.8, 0, Math.PI * 2); mctx.fill(); mctx.stroke();
  }

  // Player triangle
  const idx = Math.max(0, order.indexOf(areaId));
  const frac = Math.max(0, Math.min(1, playerX / Math.max(1, areaWidth)));
  const px = pad + idx * seg + 1 + frac * (seg - 2);
  const py = roadY + roadH / 2;
  mctx.save();
  mctx.translate(px, py);
  mctx.scale(facing < 0 ? -1 : 1, 1);
  mctx.fillStyle = 'rgba(255,210,74,0.35)';
  mctx.beginPath(); mctx.arc(0, 0, 7, 0, Math.PI * 2); mctx.fill();
  mctx.fillStyle = '#ffd21f';
  mctx.strokeStyle = '#1a1206';
  mctx.lineWidth = 1;
  mctx.beginPath();
  mctx.moveTo(6, 0); mctx.lineTo(-4, -5); mctx.lineTo(-2, 0); mctx.lineTo(-4, 5);
  mctx.closePath();
  mctx.fill(); mctx.stroke();
  mctx.restore();

  // Caption
  mctx.fillStyle = 'rgba(0,0,0,0.45)';
  mctx.fillRect(0, mh - 14, mw, 14);
  mctx.font = 'bold 9px sans-serif';
  mctx.textAlign = 'center';
  mctx.textBaseline = 'middle';
  mctx.fillStyle = '#ffd24a';
  const name = (AREAS[areaId]?.name || '').toUpperCase();
  const destName = dest && dest.areaId !== areaId ? AREAS[dest.areaId]?.name : '';
  mctx.fillText(destName ? `${name} → ${destName.toUpperCase()}` : name, mw / 2, mh - 7, mw - 6);
  mctx.textAlign = 'left';
  mctx.textBaseline = 'alphabetic';
}
