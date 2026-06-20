// ── shared.js — constants, globals, materials, terrain helpers ────────────────────────────────────
// Ported from the desert-golf-roguelike base engine (physics/cup/transition feel kept identical), with
// the roguelike layer stripped. Terrain is a single-valued HEIGHTFIELD of vertices; the FACETED
// generator (faceted.js) fills it. This is a standalone Earth golf game.

// ── physics (identical to the base engine) ──
const GRAVITY = 0.04;
const POWER_SCALE = 0.04;
const MAX_POWER = 8;
const BOUNCE_THRESHOLD = 1.0;
const BALL_RADIUS = 4;
const CUP_WIDTH = 36;
const CUP_DEPTH = 20;

const TRANSITION_PAUSE = 60;   // frames the ball sits in the cup before the pan
const TRANSITION_PAN = 90;     // frames the camera pans to the next hole
const OOB_PAUSE = 60;

// ── canvas / viewport (H fixed at 540 game units; W follows the window aspect) ──
const H = 540;
let W = 960;
const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
let displayScale = 1;
function resize() {
  const winW = window.innerWidth, winH = window.innerHeight;
  W = Math.max(640, Math.round(H * winW / winH));
  canvas.width = W; canvas.height = H;
  canvas.style.width = winW + 'px'; canvas.style.height = winH + 'px';
}
window.addEventListener('resize', resize);

// ── materials (Earth palette: grass + sand bunkers) ──
const DEFAULT_MAT = 'grass';
const MATERIALS = {
  grass:  { restitution: 0.35, rollingFriction: 0.95,  surfaceFriction: 0.008, color: '#5a9e4b', colorLight: '#6db85a' },
  bunker: { restitution: 0.30, rollingFriction: 0.90,  surfaceFriction: 0.018, color: '#caa25e', colorLight: '#e0bd7c' },
  rock:   { restitution: 0.70, rollingFriction: 0.97,  surfaceFriction: 0.003, color: '#7c7a86', colorLight: '#9a97a6' },
};

// ── terrain + ball + camera state ──
let vertices = [];   // heightfield: [{x, y, mat}], sorted by x
let holes = [];      // [{cupX, cupY, cupLeftX/Y, cupRightX/Y, cupBottomY, cupFilled, cupFillProgress, flagHole, flagVisible, flagOpacity, teeX, teeY}]
let objects = [];
let currentHole = 0;
let totalStrokes = 0;
let ball = { x: 0, y: 0, vx: 0, vy: 0, onGround: false, atRest: true, slowFrames: 0, flightFrames: 0, stuckFrames: 0, rotation: 0, spinRate: 0, lastCollidedMat: null };
let strokes = 0;
let camera = { x: 0, y: 0 };

// ── game state ──
const STATE_AIM = 0, STATE_FLIGHT = 1, STATE_PAUSE = 2, STATE_TRANSITION = 3, STATE_OOB = 4, STATE_COMPLETE = 5;
let state = STATE_AIM;
let transitionTimer = 0, transitionCamStart = 0, transitionCamEnd = 0, transitionBallStartY = 0;
let completeTimer = 0;
let courseComplete = false;
let showTitle = true;

// aim
let aiming = false, aimStartX = 0, aimStartY = 0, aimCurrentX = 0, aimCurrentY = 0;

// course config (set by main)
let currentCourse = null;

// ── helpers ──
function clampY(y) { return Math.max(H * 0.12, Math.min(H * 0.92, y)); }
function lerp(a, b, t) { return a + (b - a) * t; }

function _bsearchVertex(worldX) {
  const n = vertices.length;
  if (n < 2) return -1;
  if (worldX <= vertices[0].x) return 0;
  if (worldX >= vertices[n - 1].x) return n - 2;
  let lo = 0, hi = n - 2;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (worldX < vertices[mid].x) hi = mid - 1;
    else if (worldX > vertices[mid + 1].x) lo = mid + 1;
    else return mid;
  }
  return lo;
}
function terrainYAt(worldX) {
  const i = _bsearchVertex(worldX);
  if (i < 0) return H * 0.6;
  const a = vertices[i], b = vertices[i + 1];
  const dx = b.x - a.x;
  if (dx < 0.001) return a.y;
  return a.y + (worldX - a.x) / dx * (b.y - a.y);
}
function getMaterialAt(worldX) {
  const i = _bsearchVertex(worldX);
  if (i >= 0 && i < vertices.length - 1) return vertices[i].mat || DEFAULT_MAT;
  return DEFAULT_MAT;
}
function toGameCoords(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  return { x: (clientX - rect.left) * (W / rect.width), y: (clientY - rect.top) * (H / rect.height) };
}
