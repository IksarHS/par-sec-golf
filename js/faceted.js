// ── faceted.js — the NEW hole generation: a continuous FACETED heightfield ────────────────────────
// Built from the Golf-on-Mars research: terrain is FEW LONG facets — flat segments (where the ball can
// actually stop, giving shot variety) + straight angular slopes, with occasional gentle curvature.
// Mostly flat + angular, not uniformly curvy. Holes are CONTINUOUS: each cup's X is the next hole's tee,
// so the world is one strip the camera pans across (same as the base game). Cups sit on a flat green.

let SEED = (Math.random() * 1e9) | 0;             // fresh course each load (set ?seed=N to pin)
(function () { const m = /[?&]seed=(\d+)/.exec(location.search); if (m) SEED = parseInt(m[1], 10) | 0; })();

function rngForHole(h) {                          // deterministic per (SEED, holeIndex) — mulberry32
  let s = (SEED ^ Math.imul((h | 0) + 1, 0x9e3779b1)) >>> 0;
  return function () { s = (s + 0x6d2b79f5) >>> 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const _clampF = (v, a, b) => v < a ? a : v > b ? b : v;

function _addV(x, y) { vertices.push({ x: x, y: clampY(y), mat: 'grass' }); }

// Generate one hole's faceted terrain, appended continuously to the right; place its cup on a flat green.
function generateHole(holeIndex) {
  let teeX, teeY;
  if (holeIndex === 0) {
    teeX = 120; teeY = H * 0.62;
    if (vertices.length === 0) { vertices.push({ x: -400, y: teeY, mat: 'grass' }); vertices.push({ x: teeX, y: teeY, mat: 'grass' }); }
  } else { teeX = holes[holeIndex - 1].cupX; teeY = holes[holeIndex - 1].cupY; }

  const r = rngForHole(holeIndex);
  const TOP = H * 0.16, BOT = H * 0.86;
  const holeDist = Math.min(560 + r() * 220, W - 240);   // fit one screen (tee at margin, cup visible)
  const cupX = teeX + holeDist;
  const greenStart = cupX - 105;                  // flat green + approach start

  let last = vertices[vertices.length - 1];
  let x = last.x, y = last.y;
  // a short flat off the tee
  x = Math.min(greenStart, x + 30 + r() * 50); _addV(x, y);

  while (x < greenStart - 20) {
    const t = r();
    if (t < 0.46) {                               // FLAT facet — the resting shelves
      const len = Math.min(greenStart - 20 - x, 80 + r() * 170);
      x += len; _addV(x, y);
    } else if (t < 0.82) {                         // STRAIGHT angular slope
      const len = 55 + r() * 100, dy = (r() < 0.5 ? -1 : 1) * (45 + r() * 135);
      x = Math.min(greenStart - 20, x + len); y = _clampF(y + dy, TOP, BOT); _addV(x, y);
    } else {                                        // OCCASIONAL gentle curve (a few short steps)
      const dyT = (r() < 0.5 ? -1 : 1) * (45 + r() * 65);
      for (let k = 0; k < 3 && x < greenStart - 20; k++) { x = Math.min(greenStart - 20, x + 24 + r() * 22); y = _clampF(y + dyT * (k === 1 ? 1 : 0.55), TOP, BOT); _addV(x, y); }
    }
  }
  // FLAT GREEN through the cup (a clean landing + a place to stop)
  const greenY = y;
  _addV(greenStart, greenY);
  _addV(cupX + 95, greenY);

  placeCup(holeIndex, cupX, teeX, teeY);
  _enforceMonotonic();
}

// Cut the cup notch into the terrain at cupX and register the hole (ported from the base placeCup).
function placeCup(holeIndex, cupX, teeX, teeY) {
  const halfW = CUP_WIDTH / 2, flatMargin = 20, wallInset = 3;
  const leftX = cupX - halfW, rightX = cupX + halfW;
  const rimY = (terrainYAt(leftX) + terrainYAt(rightX)) / 2;
  const bottomY = rimY + CUP_DEPTH;
  vertices = vertices.filter(v => v.x < leftX - flatMargin || v.x > rightX + flatMargin);
  const cupVerts = [
    { x: leftX - flatMargin, y: rimY, mat: 'grass' }, { x: leftX, y: rimY, mat: 'grass' },
    { x: leftX + wallInset, y: bottomY, mat: 'grass' }, { x: rightX - wallInset, y: bottomY, mat: 'grass' },
    { x: rightX, y: rimY, mat: 'grass' }, { x: rightX + flatMargin, y: rimY, mat: 'grass' },
  ];
  let ins = vertices.findIndex(v => v.x >= leftX - flatMargin);
  if (ins === -1) ins = vertices.length;
  vertices.splice(ins, 0, ...cupVerts);
  holes.push({
    cupX, cupY: rimY, cupLeftX: leftX, cupLeftY: rimY, cupRightX: rightX, cupRightY: rimY, cupBottomY: bottomY,
    cupFilled: false, cupFillProgress: 0, flagHole: holeIndex + 1, flagVisible: true, flagOpacity: 1, teeX, teeY,
  });
}

// Flatten a sunk cup to two flat rim points (called at the end of the transition).
function flattenCup(hole) {
  const halfW = CUP_WIDTH / 2, flatMargin = 20;
  const leftX = hole.cupX - halfW, rightX = hole.cupX + halfW;
  vertices = vertices.filter(v => v.x < leftX - flatMargin || v.x > rightX + flatMargin);
  let ins = vertices.findIndex(v => v.x >= leftX - flatMargin);
  if (ins === -1) ins = vertices.length;
  vertices.splice(ins, 0, { x: leftX - flatMargin, y: hole.cupLeftY, mat: 'grass' }, { x: rightX + flatMargin, y: hole.cupRightY, mat: 'grass' });
}

function _enforceMonotonic() {
  let mx = -Infinity;
  vertices = vertices.filter(v => { if (v.x >= mx - 0.5) { mx = v.x; return true; } return false; });
}

function ensureHolesAhead(n) { while (holes.length <= n && holes.length < (currentCourse?.holeCount ?? 9)) generateHole(holes.length); }
