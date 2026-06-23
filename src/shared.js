// ── Constants ──────────────────────────────────────────────
// Colors (used by art.js)
const SKY    = '#d5ad72';
const GROUND = '#d68841';
const GROUND_LIGHT = '#dea050'; // cup indent color
const BALL_COLOR = '#ffffff';

// Physics — tunable at runtime (press ~ to open settings panel)
let GRAVITY        = 0.04;
let RESTITUTION    = 0.47;
let ROLLING_FRICTION = 0.98;
let SURFACE_FRICTION = 0.004;
let POWER_SCALE    = 0.04;
let MAX_POWER      = 8;
let BOUNCE_THRESHOLD = 1.0;
let BALL_RADIUS    = 4;
const CUP_WIDTH      = 36;
const CUP_DEPTH      = 20;

const TRANSITION_PAUSE = 60;   // frames: ball sits in cup
const TRANSITION_PAN   = 90;   // frames: camera pans to next hole
const OOB_PAUSE        = 60;   // frames: pause before respawning after out-of-bounds

// Terrain generation
const HOLE_DIST_MIN    = 600;   // min tee-to-cup world px
const HOLE_DIST_MAX    = 1000;  // max tee-to-cup world px
const BG_EXTEND        = 300;   // background terrain past cup area
const PEAK_HEIGHT_MIN  = 60;    // min obstacle peak above surroundings
const PEAK_HEIGHT_MAX  = 180;   // max obstacle peak (at full difficulty)

// ── Canvas Setup ───────────────────────────────────────────
// Game height is fixed at 540 units; width adapts to viewport aspect ratio
const H = 540;
let W = 960; // updated dynamically on resize

const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');

let displayScale = 1;

// ── Sprite Assets ─────────────────────────────────────────
// SPRITE_CATALOG defines all placeable assets: { label, category, defaultHeight, src }
// SPRITES holds loaded Image objects keyed by sprite name
const SPRITE_CATALOG = {
  lander:                  { label: 'Lunar Lander',           category: 'vehicles', defaultHeight: 95,  src: 'assets/lunar_lander.png' },
  cactus_1:                { label: 'Cactus 1',               category: 'plants',   defaultHeight: 60,  src: 'assets/plants/cactus_1.png' },
  cactus_2:                { label: 'Cactus 2',               category: 'plants',   defaultHeight: 60,  src: 'assets/plants/cactus_2.png' },
  agave:                   { label: 'Agave',                  category: 'plants',   defaultHeight: 40,  src: 'assets/plants/agave_small.png' },
  barrel_cactus:           { label: 'Barrel Cactus',          category: 'plants',   defaultHeight: 45,  src: 'assets/plants/barrel_cactus_flowering.png' },
  prickly_pear:            { label: 'Prickly Pear',           category: 'plants',   defaultHeight: 50,  src: 'assets/plants/prickly_pear_cactus.png' },
  desert_scrub:            { label: 'Desert Scrub',           category: 'plants',   defaultHeight: 35,  src: 'assets/plants/desert_scrub_brush.png' },
  alien_eye_plant:         { label: 'Alien Eye Plant',        category: 'plants',   defaultHeight: 50,  src: 'assets/plants/alien_eye_plant_small.png' },
  purple_alien_eye_plant:  { label: 'Purple Alien Eye Plant', category: 'plants',   defaultHeight: 50,  src: 'assets/plants/purple_alien_eye_plant.png' },
};

const SPRITES = {};
// Preload all sprite images
for (const [key, info] of Object.entries(SPRITE_CATALOG)) {
  const img = new Image();
  img.src = info.src;
  img.onload = () => { SPRITES[key] = img; };
}

// ── Materials ─────────────────────────────────────────────
const DEFAULT_MAT = 'sand';
const MATERIALS = {
  sand:  { restitution: 0.47, rollingFriction: 0.98,  surfaceFriction: 0.004, color: '#c9743f', colorLight: '#d88f55' },
  grass: { restitution: 0.35, rollingFriction: 0.975, surfaceFriction: 0.004, color: '#5a9e4b', colorLight: '#6db85a' },
  ice:   { restitution: 0.55, rollingFriction: 0.998, surfaceFriction: 0.001, color: '#6ba8c7', colorLight: '#82bdd8' },
  rock:  { restitution: 0.75, rollingFriction: 0.97,  surfaceFriction: 0.003, color: '#c45c4a', colorLight: '#d4705f' },
  mud:   { restitution: 0.15, rollingFriction: 0.90,  surfaceFriction: 0.015, color: '#8b6b4a', colorLight: '#a07d5a' },
  water: { restitution: 0.10, rollingFriction: 0.85,  surfaceFriction: 0.025, color: '#3a7ec8', colorLight: '#5094d8' },
};

function getMaterialAt(worldX) {
  const i = _bsearchVertex(worldX);
  if (i >= 0 && i < vertices.length - 1) return vertices[i].mat || DEFAULT_MAT;
  return DEFAULT_MAT;
}

// ── Terrain ────────────────────────────────────────────────
let vertices = [];
let objects = []; // placeable sprite objects [{x, y, key, height, hull, mat}]
let holes = []; // [{cupX, cupY, cupFilled, flagHole, teeX, teeY, flagVisible}]
let currentHole = 0;
let totalStrokes = 0;

// ── Ball ───────────────────────────────────────────────────
let ball = { x: 0, y: 0, vx: 0, vy: 0, onGround: false, atRest: true, slowFrames: 0, rotation: 0, spinRate: 0 };
let strokes = 0;

// ── Camera ─────────────────────────────────────────────────
// Camera is FIXED for the entire hole. Only moves during transition.
let camera = { x: 0, y: 0 };

// ── Mode System ───────────────────────────────────────────
// MODE is set by the mode file (e.g. modes/desert-golfing.js or modes/only-up.js)
// before art.js, gameplay.js, and main.js load.
let MODE = null;

// ── World / Course ────────────────────────────────────────
// WORLDS is populated by world definition files (e.g. worlds/desert-planet.js)
// currentWorld and currentCourse are set during init
const WORLDS = {};
function invalidateCustomHolesCache() { /* no-op — editor calls this to signal holes changed */ }
let currentWorld = null;
let currentCourse = null;

// ── Game State ─────────────────────────────────────────────
const STATE_AIM       = 0;
const STATE_FLIGHT    = 1;
const STATE_PAUSE      = 2;  // ball in cup, waiting
const STATE_TRANSITION = 3;  // camera panning to next hole
const STATE_OOB        = 4;  // ball out of bounds, waiting to respawn
const STATE_COMPLETE   = 5;  // course finished — idle end screen

let state = STATE_AIM;
let transitionTimer = 0;
let transitionCamStart = 0;   // camera X at start of transition
let transitionCamEnd   = 0;   // camera X at end of transition
let transitionCamYStart = 0;  // camera Y at start of transition (eased alongside X so verticalCam/portrait
let transitionCamYEnd   = 0;  //   framing doesn't SNAP between holes — see desert-golfing onTransitionUpdate)
let transitionBallStartY = 0; // ball's Y when it rested in cup
let showTitle = true;
let courseComplete = false;
let completeTimer = 0;

// Transition: cup fills and flag fades DURING the camera pan

// ── Aim UI ─────────────────────────────────────────────────
let aiming = false;
let aimStartX = 0, aimStartY = 0;
let aimCurrentX = 0, aimCurrentY = 0;

// ── Debug Ball Tracker ────────────────────────────────────
const _ballLog = [];
const _BALL_LOG_MAX = 2000;
let _ballLogFrame = 0;

// No-op by default — overridden by debug.js with real implementation
let _logBall = function() {};

// ── Utility Functions ──────────────────────────────────────
function clampY(y) {
  // Inert-by-default hook (same class as the wind-line / camera.y terrain-close precedents): an
  // experimental planet (?atlas only-up ascent) may widen the vertical terrain band so holes can
  // climb across multiple screens. RG._clampYBand is null in the shipped game, so the main Earth->Moon
  // loop is byte-for-byte unchanged.
  if (typeof window !== 'undefined' && window.RG && window.RG._clampYBand) {
    return Math.max(window.RG._clampYBand[0], Math.min(window.RG._clampYBand[1], y));
  }
  const minY = H * 0.20;  // highest terrain allowed
  const maxY = H * 0.90;  // lowest terrain allowed
  return Math.max(minY, Math.min(maxY, y));
}

function lerp(a, b, t) { return a + (b - a) * t; }
function randRange(lo, hi) { return lo + Math.random() * (hi - lo); }

// Helper: add slight random jitter to a Y value
function jitter(y, amount) { return clampY(y + (Math.random() - 0.5) * amount); }

// Binary search: find index i such that vertices[i].x <= worldX <= vertices[i+1].x
// Vertices are sorted by x (terrain extends left-to-right).
// Returns -1 if worldX is outside all segments.
function _bsearchVertex(worldX) {
  const n = vertices.length;
  if (n < 2) return -1;
  if (worldX <= vertices[0].x) return 0;
  if (worldX >= vertices[n - 1].x) return n - 2;
  let lo = 0, hi = n - 2;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (worldX < vertices[mid].x) { hi = mid - 1; }
    else if (worldX > vertices[mid + 1].x) { lo = mid + 1; }
    else { return mid; }
  }
  return lo; // closest segment
}

function terrainYAt(worldX) {
  const i = _bsearchVertex(worldX);
  if (i < 0) return H * 0.6;
  const a = vertices[i], b = vertices[i + 1];
  const dx = b.x - a.x;
  if (dx < 0.001) return a.y;
  const t = (worldX - a.x) / dx;
  return a.y + t * (b.y - a.y);
}

// Convert mouse/touch screen coords to game coords
function toGameCoords(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (clientX - rect.left) * (W / rect.width),
    y: (clientY - rect.top) * (H / rect.height)
  };
}
