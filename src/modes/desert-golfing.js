// ── Desert Golfing Mode ───────────────────────────────────
// Horizontal golf: procedural terrain, left-to-right holes, fixed camera per hole.
// Requires: shared.js, level-design.js loaded before this file.

// ── DG-Specific Globals ──────────────────────────────────
// vertices[] and holes[] are declared in shared.js (used by level-design.js)
// currentHole is declared in shared.js
let _completeBtn = null; // click target for "Next Course/World" button
let _replayBtn = null;   // click target for "Replay Course" button

// Find the next course or world to play after completing the current course
function getNextDestination() {
  if (!currentWorld || !currentCourse) return null;

  // Find current course in the world's course list
  const courseIds = Object.keys(currentWorld.courses);
  const currentIdx = courseIds.findIndex(id => currentWorld.courses[id] === currentCourse);

  if (currentIdx < courseIds.length - 1) {
    // More courses in this world
    const nextId = courseIds[currentIdx + 1];
    return { type: 'course', worldId: _currentWorldId, courseId: nextId, course: currentWorld.courses[nextId] };
  }

  // No more courses — find next world (same system first, then any system)
  const worldIds = Object.keys(WORLDS);
  const currentWorldIdx = worldIds.findIndex(id => WORLDS[id] === currentWorld);

  // Same system first
  for (let i = currentWorldIdx + 1; i < worldIds.length; i++) {
    const nextWorld = WORLDS[worldIds[i]];
    if (nextWorld.system === currentWorld.system) {
      const firstCourseId = Object.keys(nextWorld.courses)[0];
      if (firstCourseId) {
        return { type: 'world', worldId: worldIds[i], courseId: firstCourseId, course: nextWorld.courses[firstCourseId], world: nextWorld };
      }
    }
  }

  // Different system — next adventure
  for (let i = currentWorldIdx + 1; i < worldIds.length; i++) {
    const nextWorld = WORLDS[worldIds[i]];
    if (nextWorld.system !== currentWorld.system) {
      const firstCourseId = Object.keys(nextWorld.courses)[0];
      if (firstCourseId) {
        return { type: 'world', worldId: worldIds[i], courseId: firstCourseId, course: nextWorld.courses[firstCourseId], world: nextWorld };
      }
    }
  }

  return null; // end of everything
}

// Start a new course (resets game state)
function startCourse(worldId, courseId) {
  currentWorld = WORLDS[worldId];
  currentCourse = currentWorld.courses[courseId];
  _currentWorldId = worldId;

  // Reset game state
  vertices.length = 0;
  holes.length = 0;
  objects.length = 0;
  _recentArchetypes.length = 0;
  currentHole = 0;
  totalStrokes = 0;
  strokes = 0;
  courseComplete = false;
  completeTimer = 0;
  showTitle = true;
  _completeBtn = null;
  _replayBtn = null;

  // Re-seed for this course so terrain is deterministic
  // Always use the base seed (42) + course offset, never the current mutated seed
  const baseSeed = parseInt(localStorage.getItem('dg-seed') || '42', 10);
  const _hash = hashString(worldId + courseId);
  setSeed(baseSeed + _hash);
  loadHoleOverrides(worldId, courseId);
  ensureHolesAhead(2);
  const firstHole = holes[0];
  ball.x = firstHole.teeX;
  ball.y = terrainYAt(firstHole.teeX) - BALL_RADIUS;
  ball.vx = 0; ball.vy = 0;
  ball.atRest = true; ball.onGround = false;
  ball.spinRate = 0; ball.rotation = 0;
  setHoleCamera(firstHole);
  state = STATE_AIM;
}

// Simple string hash for seed offset per course
function hashString(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h * 31 + str.charCodeAt(i)) | 0;
  }
  return h;
}

let _currentWorldId = 'desert-world-1';

// ── Course Data Loading ──────────────────────────────────
// Course data is now fully defined in code (desert-planet.js etc.)
// No preloading or localStorage overrides needed for the game.

// ── Terrain Collision ──────────────────────────────────────
function findSegment(worldX) {
  return _bsearchVertex(worldX);
}

function segmentNormal(i) {
  const a = vertices[i], b = vertices[i + 1];
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.sqrt(dx * dx + dy * dy);
  return { x: dy / len, y: -dx / len };
}

function collideWithTerrain() {
  let collided = false;

  // Binary search to find nearby segments instead of scanning all vertices.
  // Check a small window around ball.x (±BALL_RADIUS*2 worth of segments).
  const center = _bsearchVertex(ball.x);
  if (center < 0) return false;
  const lo = Math.max(0, center - 3);
  const hi = Math.min(vertices.length - 2, center + 3);

  for (let i = lo; i <= hi; i++) {
    const a = vertices[i], b = vertices[i + 1];

    // Find closest point on segment AB to ball center
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const lenSq = dx * dx + dy * dy;
    if (lenSq < 0.001) continue;

    let t = ((ball.x - a.x) * dx + (ball.y - a.y) * dy) / lenSq;
    t = Math.max(0, Math.min(1, t));

    const closestX = a.x + t * dx;
    const closestY = a.y + t * dy;

    const distX = ball.x - closestX;
    const distY = ball.y - closestY;
    const distSq = distX * distX + distY * distY;

    if (distSq < BALL_RADIUS * BALL_RADIUS && distSq > 0.0001) {
      const dist = Math.sqrt(distSq);

      const nx = distX / dist;
      const ny = distY / dist;

      // Push ball out of terrain
      const overlap = BALL_RADIUS - dist;
      ball.x += nx * overlap;
      ball.y += ny * overlap;

      // Velocity response — use material-specific restitution
      const segMat = MATERIALS[vertices[i].mat || DEFAULT_MAT];
      const dot = ball.vx * nx + ball.vy * ny;
      if (dot < 0) {
        const isGround = Math.abs(ny) > Math.abs(nx);
        if (isGround && -dot < BOUNCE_THRESHOLD) {
          ball.vx -= dot * nx;
          ball.vy -= dot * ny;
        } else {
          ball.vx -= (1 + segMat.restitution) * dot * nx;
          ball.vy -= (1 + segMat.restitution) * dot * ny;
        }
      }

      // Track last collided material for friction lookup
      ball.lastCollidedMat = vertices[i].mat || DEFAULT_MAT;

      collided = true;
    }
  }

  return collided;
}

function collideWithObjects() {
  let collided = false;

  for (let oi = 0; oi < objects.length; oi++) {
    const obj = objects[oi];
    const verts = obj.verts;
    if (!verts || verts.length < 2) continue;

    // Quick AABB check — skip objects far from ball
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const v of verts) {
      if (v.x < minX) minX = v.x;
      if (v.x > maxX) maxX = v.x;
      if (v.y < minY) minY = v.y;
      if (v.y > maxY) maxY = v.y;
    }
    if (ball.x + BALL_RADIUS < minX || ball.x - BALL_RADIUS > maxX ||
        ball.y + BALL_RADIUS < minY || ball.y - BALL_RADIUS > maxY) continue;

    // Check each edge of the polygon
    for (let i = 0; i < verts.length; i++) {
      const a = verts[i];
      const b = verts[(i + 1) % verts.length];

      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const lenSq = dx * dx + dy * dy;
      if (lenSq < 0.001) continue;

      let t = ((ball.x - a.x) * dx + (ball.y - a.y) * dy) / lenSq;
      t = Math.max(0, Math.min(1, t));

      const closestX = a.x + t * dx;
      const closestY = a.y + t * dy;

      const distX = ball.x - closestX;
      const distY = ball.y - closestY;
      const distSq = distX * distX + distY * distY;

      if (distSq < BALL_RADIUS * BALL_RADIUS && distSq > 0.0001) {
        const dist = Math.sqrt(distSq);
        const nx = distX / dist;
        const ny = distY / dist;

        // Push ball out
        const overlap = BALL_RADIUS - dist;
        ball.x += nx * overlap;
        ball.y += ny * overlap;

        // Velocity response — use object material or default
        const objMat = MATERIALS[obj.mat || DEFAULT_MAT];
        const dot = ball.vx * nx + ball.vy * ny;
        if (dot < 0) {
          const isGround = Math.abs(ny) > Math.abs(nx);
          if (isGround && -dot < BOUNCE_THRESHOLD) {
            ball.vx -= dot * nx;
            ball.vy -= dot * ny;
          } else {
            ball.vx -= (1 + objMat.restitution) * dot * nx;
            ball.vy -= (1 + objMat.restitution) * dot * ny;
          }
        }

        ball.lastCollidedMat = obj.mat || DEFAULT_MAT;
        collided = true;
      }
    }
  }

  return collided;
}

// ── Camera ─────────────────────────────────────────────────
function setHoleCamera(hole) {
  const margin = 120;
  const teeScreenX = margin;
  camera.x = hole.teeX - teeScreenX;

  const cupScreenX = hole.cupX - camera.x;
  if (cupScreenX > W - margin) {
    const center = (hole.teeX + hole.cupX) / 2;
    camera.x = center - W / 2;
  }
}

// ── Cup Logic ──────────────────────────────────────────────
function isBallInCup() {
  const hole = holes[currentHole];
  if (!hole || hole.cupFilled) return false;

  const inCupX = Math.abs(ball.x - hole.cupX) < CUP_WIDTH / 2;
  const belowRim = ball.y > hole.cupY;
  return inCupX && belowRim;
}

function isBallOffScreen() {
  const sx = ball.x - camera.x;
  const sy = ball.y - camera.y;   // camera-relative (camera.y is 0 in the base game; non-zero only for the pan-down secret)
  const margin = BALL_RADIUS + 10;
  // Only OOB on left, right, and bottom — not top (ball can fly upward freely)
  return sx < -margin || sx > W + margin || sy > H + margin;
}

// ── Drawing ────────────────────────────────────────────────

// ── Procedural terrain texture (experimental — toggle with the T key) ───────
// Swaps the flat terrain fill for slope-based dune shading + a baked sand-noise
// overlay. Pure rendering effect — geometry, physics, and the editor are
// untouched. Off by default; the toggle persists in localStorage.
let TERRAIN_TEXTURE_ON = true; // the textured look is the default now; T toggles it off
try { TERRAIN_TEXTURE_ON = localStorage.getItem('dg-terrain-texture') !== '0'; } catch (e) {}
window.addEventListener('keydown', (e) => {
  const t = e.target && e.target.tagName;
  if (t === 'INPUT' || t === 'TEXTAREA') return;
  if (e.key === 't' || e.key === 'T') {
    TERRAIN_TEXTURE_ON = !TERRAIN_TEXTURE_ON;
    try { localStorage.setItem('dg-terrain-texture', TERRAIN_TEXTURE_ON ? '1' : '0'); } catch (e2) {}
  }
});

const _LIGHT_X = 0.66, _LIGHT_Y = -0.75; // light from the upper-right (matches the dune reference)
const _STRATA_SPACING = 13, _STRATA_BANDS = 34; // sand striation grooves (depth between lines, how many)
let _sandNoisePattern = null;

// Color-grade the textured ground toward the parallax backdrop's red-clay palette
// so the foreground reads as the same world (but richer/closer). Applied as a
// multiply wash over the finished texture: shifts hue toward _TERRAIN_GRADE and
// darkens slightly, which also restores the correct depth cue (near = darker).
const _TERRAIN_GRADE = '#c25c30';      // red-clay sampled from the backdrop floor
const _TERRAIN_GRADE_ALPHA = 0.40;     // 0 = raw texture, 1 = full wash

// Authored sand texture (Poly Haven CC0 "Sand 01"). Used as the terrain fill,
// modulated by the slope shading. Falls back to plain shading if the file is
// missing. _SAND_TEX_SCALE controls how finely it tiles over the terrain.
const _SAND_TEX_SCALE = 0.42;
const _sandImg = new Image();
let _sandImgPattern = null;
_sandImg.onload = () => { _sandImgPattern = null; };  // rebuild the pattern when a new image loads
_sandImg.onerror = () => {                            // no sand.png? fall back to sand.jpg
  if (_sandImg.src.indexOf('sand.png') !== -1) _sandImg.src = 'assets/textures/sand.jpg?v=' + Date.now();
};
// Drop your texture at web/assets/textures/sand.png (or .jpg). Cache-busted so a
// page refresh always picks up your latest edit.
// (textured-art assets stripped for the roguelike — no load; flat render only)
function _getSandImgPattern() {
  if (!_sandImgPattern && _sandImg.complete && _sandImg.naturalWidth) {
    _sandImgPattern = ctx.createPattern(_sandImg, 'repeat');
    if (_sandImgPattern && _sandImgPattern.setTransform) {
      _sandImgPattern.setTransform(new DOMMatrix([_SAND_TEX_SCALE, 0, 0, _SAND_TEX_SCALE, 0, 0]));
    }
  }
  return _sandImgPattern;
}

function _buildSandNoisePattern() {
  const size = 200;
  const off = document.createElement('canvas');
  off.width = off.height = size;
  const octx = off.getContext('2d');
  const img = octx.createImageData(size, size);
  const sm = (t) => t * t * (3 - 2 * t);
  const mkGrid = (G) => { const g = []; for (let y = 0; y < G; y++) { g[y] = []; for (let x = 0; x < G; x++) g[y][x] = Math.random(); } return g; };
  const g1 = mkGrid(28), g2 = mkGrid(7); // fine grain + coarse dune mottle (both wrap → seamless)
  const sample = (grid, G, x, y) => {
    const fx = x / size * G, fy = y / size * G, x0 = Math.floor(fx), y0 = Math.floor(fy), tx = sm(fx - x0), ty = sm(fy - y0);
    const gg = (gx, gy) => grid[((gy % G) + G) % G][((gx % G) + G) % G];
    return (gg(x0, y0) * (1 - tx) + gg(x0 + 1, y0) * tx) * (1 - ty) + (gg(x0, y0 + 1) * (1 - tx) + gg(x0 + 1, y0 + 1) * tx) * ty;
  };
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let v = sample(g2, 7, x, y) * 0.6 + sample(g1, 28, x, y) * 0.4; // coarse mottle dominates
      v = v * 0.88 + Math.random() * 0.12;                            // a touch of fine grain
      const shade = 128 + (v - 0.5) * 70;
      const o = (y * size + x) * 4;
      img.data[o] = img.data[o + 1] = img.data[o + 2] = shade;
      img.data[o + 3] = 255;
    }
  }
  octx.putImageData(img, 0, 0);
  _sandNoisePattern = ctx.createPattern(off, 'repeat');
}

function _hexRGB(h) { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
function _shadeColor(mat, b) {
  const c = _hexRGB(mat.color || GROUND), cl = _hexRGB(mat.colorLight || mat.color || GROUND);
  // 3-stop warm ramp: deep red-brown shadow -> base -> bright warm highlight.
  const sh = [c[0] * 0.44, c[1] * 0.33, c[2] * 0.30];
  const hi = [cl[0] + (255 - cl[0]) * 0.42, cl[1] + (224 - cl[1]) * 0.42, cl[2] + (170 - cl[2]) * 0.42];
  let r, g, bl;
  if (b < 0.5) { const t = b * 2; r = sh[0] + (c[0] - sh[0]) * t; g = sh[1] + (c[1] - sh[1]) * t; bl = sh[2] + (c[2] - sh[2]) * t; }
  else { const t = (b - 0.5) * 2; r = c[0] + (hi[0] - c[0]) * t; g = c[1] + (hi[1] - c[1]) * t; bl = c[2] + (hi[2] - c[2]) * t; }
  return 'rgb(' + (r | 0) + ',' + (g | 0) + ',' + (bl | 0) + ')';
}
function _vertBright(s) {
  let nx = 0, ny = 0;
  const pairs = [[vertices[s - 1], vertices[s]], [vertices[s], vertices[s + 1]]];
  for (const pr of pairs) {
    const p = pr[0], q = pr[1];
    if (!p || !q) continue;
    const dx = q.x - p.x, dy = q.y - p.y, l = Math.hypot(dx, dy) || 1;
    let ax = dy / l, ay = -dx / l; if (ay > 0) { ax = -ax; ay = -ay; }
    nx += ax; ny += ay;
  }
  const l = Math.hypot(nx, ny) || 1;
  const raw = (nx / l) * _LIGHT_X + (ny / l) * _LIGHT_Y;
  return Math.max(0, Math.min(1, (raw - 0.6) * 2.1 + 0.42)); // contrast curve for dramatic dune shading
}

// Pseudo-random + smooth-noise helpers for breaking the striations up naturally.
function _hash01(n) { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }
function _streakAlpha(x, k) {
  const p = x * 0.013;
  const s = Math.sin(p + k * 5.1) + Math.sin(p * 1.9 + k * 2.3) * 0.6 + Math.sin(p * 0.47 + k * 9.0) * 0.5;
  return Math.max(0, s / 2.1); // 0..~1, with frequent 0 gaps along the line
}

// ── Parallax background (experimental — same T toggle) ──────────────────────
// A wide desert backdrop drawn in screen space, scrolling slower than the
// foreground terrain (parallax). Drop an image at assets/backgrounds/bg.png
// (ideally horizontally tileable so it loops without a seam). Cache-busted.
const _BG_PARALLAX = 0.3;
const _bgImg = new Image();
let _bgReady = false;
_bgImg.onload = () => { _bgReady = true; };
_bgImg.onerror = () => { if (_bgImg.src.indexOf('bg.png') !== -1) { _bgReady = false; _bgImg.src = 'assets/backgrounds/bg.jpg?v=' + Date.now(); } };
// (parallax backdrop stripped for the roguelike — no load; flat render only)

function drawParallaxBg() {
  if (!_bgReady || !_bgImg.naturalWidth) return;
  const scale = H / _bgImg.naturalHeight;
  const dw = _bgImg.naturalWidth * scale;
  if (dw <= 0) return;
  const shift = (((camera.x * _BG_PARALLAX) % dw) + dw) % dw; // [0, dw)
  for (let x = -shift; x < W; x += dw) ctx.drawImage(_bgImg, x, 0, dw, H);
}

// ── Cutaway cross-section ───────────────────────────────────────────────
// The ground is a vertical cutaway, not a tiled skin. The substrate is a stack
// of WORLD-HORIZONTAL sedimentary beds that the surface TRUNCATES (an erosion
// unconformity) — the ground cuts across the layers at an angle, which is what
// makes a cliff read as rock instead of a striped drape. A single thin
// wind-blown crust stays conformable on top (the sand the ball rolls on).
// sand.png is no longer the base — it's a neutral grain overlaid via soft-light
// (see _getSandImgPattern), texturing every zone without shifting hue/brightness.
const _CRUST_D    = 16;          // loose sunlit sand: depth (px) below the surface
const _CRUST_FADE = 40;          // crust has fully given way to substrate by here
const _CRUST_TOP  = '#e6b079';   // sunlit wind-blown sand at the very surface
const _CRUST_BOT  = '#d18f54';   // base of the loose crust
// Sedimentary clay palette: pale ochre (shallow) -> deep red-brown (deep).
const _CLAY_RAMP = [
  [208, 146, 88], [197, 123, 67], [188, 104, 55], [174, 86, 47],
  [156, 71, 42], [132, 57, 35], [104, 44, 28], [72, 30, 20],
];
function _clayAt(t) {
  const R = _CLAY_RAMP; t = Math.max(0, Math.min(0.999, t)) * (R.length - 1);
  const i = t | 0, f = t - i, a = R[i], b = R[i + 1] || a;
  return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
}
function _h01(x) { const s = Math.sin(x * 97.13 + 3.7) * 43758.5453; return s - Math.floor(s); }

// Neutral dune lighting: 128 = unchanged under soft-light; lit crests brighten,
// shadow faces darken — without re-tinting the clay.
function _greyLight(b) { const v = Math.round(64 + b * 150); return 'rgb(' + v + ',' + v + ',' + v + ')'; }

function drawTexturedTerrain(startX, endX) {
  const iv = Math.max(0, _bsearchVertex(startX) - 2);
  const iMax = Math.min(vertices.length - 1, _bsearchVertex(endX) + 4);
  if (iMax <= iv) return;

  const S = [];
  for (let s = iv; s <= iMax; s++) if (vertices[s]) S.push(vertices[s]);
  if (S.length < 2) return;
  const n = S.length, BOT = (((typeof camera !== 'undefined') && camera.y) || 0) + H + 300; // camera-relative (see drawTerrainDG)
  const xL = S[0].x - 50, xR = S[n - 1].x + 50;

  ctx.save();
  // Clip to the terrain polygon (surface line, closed along the bottom).
  ctx.beginPath();
  ctx.moveTo(S[0].x, S[0].y);
  for (let k = 1; k < n; k++) ctx.lineTo(S[k].x, S[k].y);
  ctx.lineTo(S[n - 1].x, BOT);
  ctx.lineTo(S[0].x, BOT);
  ctx.closePath();
  ctx.clip();

  // 1+2) Stratified substrate: world-horizontal beds (with a gentle shared fold)
  //      stacked top→deep. The terrain clip TRUNCATES them, so the surface cuts
  //      across the layers — the angular unconformity that reads as real rock.
  let topY = Infinity;
  for (let k = 0; k < n; k++) if (S[k].y < topY) topY = S[k].y;
  const yTop = topY - 40;          // start beds above the highest surface point
  const REF  = 300;                // depth (px) over which the ramp reaches deep red
  const anchor = Math.floor(yTop * 0.013); // varies the bed pattern per hole

  // a single low-frequency fold shared by every bed (they flex together)
  const fold = (x) => Math.sin(x * 0.0016 + 1.3) * 15 + Math.sin(x * 0.0041 + 5.1) * 6;
  const STEP = 26;
  const band = (yT, yB, col) => {
    ctx.beginPath();
    ctx.moveTo(xL, yT + fold(xL));
    for (let x = xL + STEP; x < xR; x += STEP) ctx.lineTo(x, yT + fold(x));
    ctx.lineTo(xR, yT + fold(xR));
    ctx.lineTo(xR, yB + fold(xR));
    for (let x = xR - STEP; x > xL; x -= STEP) ctx.lineTo(x, yB + fold(x));
    ctx.lineTo(xL, yB + fold(xL));
    ctx.closePath(); ctx.fillStyle = col; ctx.fill();
  };

  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  let y = yTop, bi = 0;
  while (y < BOT + 40) {
    const thick = 18 + _h01(bi * 1.7 + anchor) * 30;   // 18..48px, irregular
    const yB = y + thick;
    let c = _clayAt((y + thick * 0.5 - yTop) / REF);    // darker/redder with depth
    const j = _h01(bi * 5.3 + anchor) - 0.5;            // tonal jitter (non-monotonic)
    c = [c[0] + j * 22, c[1] + j * 17, c[2] + j * 12];
    if (_h01(bi * 1.91 + anchor) > 0.85) c = [c[0] + 20, c[1] + 17, c[2] + 12]; // occasional pale dust band
    band(y, yB + 1, 'rgb(' + (c[0] | 0) + ',' + (c[1] | 0) + ',' + (c[2] | 0) + ')');
    // darker seam on most bedding planes, varied strength
    if (_h01(bi * 3.3 + anchor) > 0.25) {
      ctx.beginPath();
      ctx.moveTo(xL, y + fold(xL));
      for (let x = xL + STEP; x <= xR; x += STEP) ctx.lineTo(x, y + fold(x));
      ctx.strokeStyle = 'rgba(44,18,10,' + (0.12 + _h01(bi * 7.1 + anchor) * 0.22).toFixed(3) + ')';
      ctx.lineWidth = 1 + _h01(bi * 2.2 + anchor) * 2.8;
      ctx.stroke();
    }
    y = yB; bi++;
  }

  // 3) Surface crust: loose wind-blown sand fading softly into the substrate
  //    (the soft break that reads as topsoil over bedrock).
  for (let s = 0; s < n - 1; s++) {
    const a = S[s], b = S[s + 1];
    const top = (a.y + b.y) * 0.5;
    const g = ctx.createLinearGradient(0, top, 0, top + _CRUST_FADE);
    g.addColorStop(0, _CRUST_TOP);
    g.addColorStop(_CRUST_D / _CRUST_FADE, _CRUST_BOT);
    g.addColorStop(1, 'rgba(211,147,87,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
    ctx.lineTo(b.x, b.y + _CRUST_FADE); ctx.lineTo(a.x, a.y + _CRUST_FADE);
    ctx.closePath(); ctx.fill();
  }

  // 4) Grain: neutral sand tooth (sand.png) over every zone via soft-light.
  const texPat = _getSandImgPattern();
  if (texPat) {
    ctx.globalCompositeOperation = 'soft-light';
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = texPat;
    ctx.fillRect(xL, -50, xR - xL, BOT + 50);
    ctx.globalAlpha = 1;
  }

  // 5) Dune lighting: lit crests / shadow faces, neutral grey via soft-light so
  //    it sculpts the form without re-tinting the clay.
  ctx.globalCompositeOperation = 'soft-light';
  for (let s = iv; s < iMax; s++) {
    const a = vertices[s], b = vertices[s + 1];
    if (!a || !b) continue;
    const g = ctx.createLinearGradient(a.x, 0, b.x, 0);
    g.addColorStop(0, _greyLight(_vertBright(s)));
    g.addColorStop(1, _greyLight(_vertBright(s + 1)));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
    ctx.lineTo(b.x, BOT); ctx.lineTo(a.x, BOT);
    ctx.closePath(); ctx.fill();
  }
  ctx.globalCompositeOperation = 'source-over';
  ctx.restore();
}

function drawTerrainDG() {
  // When an experimental planet zooms the camera OUT (RG._zoom < 1, e.g. the long-drive chase-cam),
  // the visible world is wider than W — extend the draw range so terrain fills the zoomed-out view.
  // Inert by default (RG._zoom undefined/1 in the base game → identical to the old fixed range).
  let startX = camera.x - 100;
  let endX   = camera.x + W + 100;
  if (typeof window !== 'undefined' && window.RG && RG._zoom && RG._zoom < 1) {
    const z = RG._zoom, px = (RG._zoomPivot && RG._zoomPivot.x) || W / 2;
    startX = camera.x + px - px / z - 100;
    endX   = camera.x + px + (W - px) / z + 100;
  }
  if (TERRAIN_TEXTURE_ON) { drawTexturedTerrain(startX, endX); return; }

  // Group consecutive same-material vertices into runs.
  // Each run is drawn as ONE polygon tracing all vertices in order,
  // closed along the bottom. Canvas nonzero fill rule handles
  // self-intersecting paths (overhangs) correctly.
  // Start iteration near the visible range instead of from vertex 0
  let i = Math.max(0, _bsearchVertex(startX) - 2);
  const iMax = Math.min(vertices.length - 1, _bsearchVertex(endX) + 4);
  while (i < iMax) {
    const matName = vertices[i].mat || DEFAULT_MAT;
    const mat = MATERIALS[matName] || MATERIALS[DEFAULT_MAT];
    const runStart = i;

    // Find end of this material run
    while (i < iMax && (vertices[i].mat || DEFAULT_MAT) === matName) {
      i++;
    }
    const runEnd = i; // exclusive — vertices[runEnd] is the first vertex of the next material

    // Check if any part of this run is visible
    let anyVisible = false;
    for (let j = runStart; j <= runEnd && j < vertices.length; j++) {
      if (vertices[j].x >= startX && vertices[j].x <= endX) { anyVisible = true; break; }
    }
    if (!anyVisible) continue;

    // Draw one polygon: trace all vertices in order, then close along bottom
    ctx.fillStyle = mat.color || GROUND;
    // At a SURFACE course's start, the terrain's left end (vertex 0) would otherwise show as a
    // hard cliff against the sky. Extend that first run flat off the left screen edge so the
    // ground just runs offscreen — you're on a planet, it shouldn't simply end. Only the left
    // start is extended; the course's RIGHT end still shows (a deliberate "course is ending" cue).
    // Skipped in the sunken secret rooms (camera.y > 0), where the left wall is intentional.
    const onSurface = !((typeof camera !== 'undefined') && camera.y);
    const leftX = (runStart === 0 && onSurface) ? Math.min(vertices[runStart].x, startX) : vertices[runStart].x;
    ctx.beginPath();
    ctx.moveTo(leftX, vertices[runStart].y);
    ctx.lineTo(vertices[runStart].x, vertices[runStart].y);
    for (let j = runStart + 1; j <= runEnd && j < vertices.length; j++) {
      ctx.lineTo(vertices[j].x, vertices[j].y);
    }
    // Close along the bottom — camera-relative on Y so a vertically-shifted world
    // (camera.y > 0 in the roguelike's sunken bonus rooms) still fills DOWNWARD.
    // camera.y is 0/undefined in the base game, leaving this branch identical.
    const lastIdx = Math.min(runEnd, vertices.length - 1);
    const botY = (((typeof camera !== 'undefined') && camera.y) || 0) + H + 300;
    ctx.lineTo(vertices[lastIdx].x, botY);
    ctx.lineTo(leftX, botY);
    ctx.closePath();
    ctx.fill();
  }
}

// Clean cup hole. Desert mode previously had no cup renderer — the hole was just
// the terrain notch, so its near-vertical walls + flat floor picked up extreme
// slope-shading (pale, washed-out, streaking downward). Draw an intentional dark
// notch over the terrain instead, so the cup reads as a deliberate hole.
function drawCupHoleDG(c) {
  if (!c || c.cupLeftX == null || c.cupFilled) return;
  const inset = c.cupWallInset || 3;
  // The cup interior reads as the BACKGROUND, not a filled pit: paint it the world's sky
  // colour so the hole looks like a clean opening to the background (a notch cut through the
  // sand), the way the sibling build reads — no muddy brown, no washed-out gradient.
  ctx.fillStyle = (typeof currentWorld !== 'undefined' && currentWorld && currentWorld.sky) || SKY;
  ctx.beginPath();
  ctx.moveTo(c.cupLeftX, c.cupLeftY);
  ctx.lineTo(c.cupLeftX + inset, c.cupBottomY);
  ctx.lineTo(c.cupRightX - inset, c.cupBottomY);
  ctx.lineTo(c.cupRightX, c.cupRightY);
  ctx.closePath();
  ctx.fill();
}

// ── MODE Object ────────────────────────────────────────────
MODE = {
  name: 'desert-golfing',

  init() {
    // No-op: all game initialization now goes through resetGame() in main.js.
    // This exists for editor compatibility (editor.html calls MODE.init()).
    // The editor has its own seed + course init in editorInit().
  },

  collide() {
    const terrain = collideWithTerrain();
    const obj = collideWithObjects();
    // Moon (gen:'field'): also collide the overhang LIPS on top of the heightfield base.
    let lip = false;
    if (currentCourse && currentCourse.gen === 'field' && typeof moonLipCollide === 'function') lip = moonLipCollide();
    ball.onGround = terrain || obj || lip;
    return terrain || obj || lip;
  },

  canRest(forceRest) {
    // Check if slope is too steep to rest (static friction check)
    const seg = findSegment(ball.x);
    const n = segmentNormal(seg);
    const slopeGravity = Math.abs(GRAVITY * n.x);
    if (slopeGravity > SURFACE_FRICTION && !forceRest) {
      return false; // too steep — let ball keep rolling
    }
    return true;
  },

  onRest() {
    // Trust the collision system — ball is already positioned correctly
    // whether on terrain or an object surface
  },

  isGoalReached() {
    if (isBallInCup()) {
      return holes[currentHole];
    }
    return false;
  },

  onGoalReached(cupData) {
    // Nothing extra needed — cup data is already tracked
  },

  isOOB() {
    return isBallOffScreen();
  },

  onOOB() {
    const hole = holes[currentHole];
    ball.x = hole.teeX;
    ball.y = terrainYAt(hole.teeX) - BALL_RADIUS;
    ball.vx = 0;
    ball.vy = 0;
    ball.atRest = true;
  },

  onTransitionStart() {
    transitionCamStart = camera.x;
    transitionBallStartY = ball.y;

    currentHole++;

    // Save progress after each hole
    if (typeof updateProgress === 'function') {
      updateProgress(_currentWorldId, Object.keys(currentWorld.courses).find(k => currentWorld.courses[k] === currentCourse), currentHole, totalStrokes);
    }
    if (typeof savePlayerData === 'function') savePlayerData();

    // Check if this was the last hole in the course
    if (currentHole >= (currentCourse?.holeCount ?? Infinity)) {
      courseComplete = true;
      // Don't compute new camera target — stay put
      transitionCamEnd = camera.x;
    } else {
      // Compute target camera position for new hole
      const newHole = holes[currentHole];
      const savedCamX = camera.x;
      setHoleCamera(newHole);
      transitionCamEnd = camera.x;
      camera.x = savedCamX; // restore — we'll animate to target
    }

    if (currentHole === 1) showTitle = false;
  },

  setCameraPos(val) {
    camera.x = val;
  },

  getTransitionCupData() {
    return currentHole > 0 ? holes[currentHole - 1] : null;
  },

  onTransitionEnd() {
    const prevHole = holes[currentHole - 1];
    if (prevHole) {
      prevHole.cupFilled = true;
      prevHole.cupFillProgress = 1;
      prevHole.flagVisible = false;
      prevHole.flagOpacity = 0;
      flattenCup(prevHole);
    }

    // Course complete — record and enter idle end state
    if (courseComplete) {
      state = STATE_COMPLETE;
      completeTimer = 0;
      // Record course completion in cloud save
      const cId = Object.keys(currentWorld.courses).find(k => currentWorld.courses[k] === currentCourse);
      if (typeof recordCourseComplete === 'function') {
        recordCourseComplete(_currentWorldId, cId, totalStrokes);
      }
      return;
    }

    // Ball stays at old cup X (which IS the new tee X) — just snap Y to terrain
    ball.y = terrainYAt(ball.x) - BALL_RADIUS;

    ensureHolesAhead(currentHole + 2);
  },

  // No camera update during flight (camera is fixed per hole in DG)
  updateCamera: null,

  // ── Rendering ──────────────────────────────────────────
  applyCameraTransform(ctx) {
    ctx.translate(-camera.x, 0);
  },

  drawSky() {
    ctx.fillStyle = currentWorld?.sky || SKY;
    ctx.fillRect(0, 0, W, H);
    if (TERRAIN_TEXTURE_ON) drawParallaxBg();
  },

  drawWorld() {
    drawTerrainDG();                                  // the heightfield base (always renders → no blank terrain)
    // Moon (gen:'field'): draw the overhang LIPS on top.
    if (currentCourse && currentCourse.gen === 'field' && typeof moonDrawLips === 'function') moonDrawLips();

    // Water layer — if current course uses water material, draw a flat blue band
    if (currentCourse?.materials?.includes('water')) {
      // Camera-relative on Y (see drawTerrainDG) — identical in the base game.
      const waterY = (((typeof camera !== 'undefined') && camera.y) || 0) + H * 0.88;
      const waterColor = MATERIALS.water?.color || '#3a7ec8';
      ctx.fillStyle = waterColor;
      ctx.fillRect(camera.x - 10, waterY, W + 20, H * 0.12 + 10);
      // Subtle highlight on water surface
      ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
      ctx.fillRect(camera.x - 10, waterY, W + 20, 3);
    }

    drawObjects();

    // Cup fill + flag for current and previous hole
    if (state === STATE_TRANSITION && currentHole > 0) {
      const prevHole = holes[currentHole - 1];
      drawCupHoleDG(prevHole);
      drawCupFill(prevHole);
      drawFlag(prevHole, terrainYAt);
    }

    const curHole = holes[currentHole];
    if (curHole) {
      drawCupHoleDG(curHole);
      drawCupFill(curHole);
      drawFlag(curHole, terrainYAt);
    }
  },

  drawHUD() {
    // Title on first hole — show world, course name, hole count
    if (showTitle && currentHole === 0) {
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'left';

      const worldName = currentWorld ? currentWorld.name : 'Desert Planet';
      const courseName = currentCourse ? currentCourse.name : '';
      const holeCount = currentCourse ? (currentCourse.holeCount || '?') : '?';

      ctx.font = "28px 'Departure Mono', monospace";
      ctx.fillText(worldName, 20, 34);

      if (courseName) {
        ctx.font = "20px 'Departure Mono', monospace";
        ctx.fillText(courseName, 20, 58);
      }

      ctx.font = "16px 'Departure Mono', monospace";
      ctx.fillText(holeCount + ' Holes', 20, 78);
    }

    // Course completion screen
    if (state === STATE_COMPLETE) {
      completeTimer++;
      const fadeIn = Math.min(1, completeTimer / 30);
      ctx.fillStyle = 'rgba(255, 255, 255, ' + fadeIn + ')';
      ctx.textAlign = 'center';

      ctx.font = "28px 'Departure Mono', monospace";
      ctx.fillText('COURSE COMPLETE', W / 2, H * 0.30);

      const courseName = currentCourse ? currentCourse.name : '';
      if (courseName) {
        ctx.font = "20px 'Departure Mono', monospace";
        ctx.fillText(courseName, W / 2, H * 0.30 + 30);
      }

      ctx.font = "20px 'Departure Mono', monospace";
      ctx.fillText(totalStrokes + ' strokes', W / 2, H * 0.30 + 58);

      // Show best score if this course was played before
      const courseKey = _currentWorldId + '/' + Object.keys(currentWorld.courses).find(k => currentWorld.courses[k] === currentCourse);
      if (typeof playerData !== 'undefined' && playerData.completed && playerData.completed[courseKey]) {
        const prev = playerData.completed[courseKey];
        ctx.font = "14px 'Departure Mono', monospace";
        ctx.fillStyle = 'rgba(232, 160, 48, ' + fadeIn * 0.7 + ')';
        if (prev.best < totalStrokes) {
          ctx.fillText('Best: ' + prev.best + '  (Attempt ' + (prev.attempts + 1) + ')', W / 2, H * 0.30 + 80);
        } else {
          ctx.fillText('New Best!  (Attempt ' + ((prev.attempts || 0) + 1) + ')', W / 2, H * 0.30 + 80);
        }
      }

      // Draw buttons after fade-in completes
      if (completeTimer > 60) {
        const next = getNextDestination();
        const btnW = 200, btnH = 36;

        // "Next Course" / "Next World" button
        if (next) {
          const btnText = next.type === 'course' ? '▶ Next Course' : '▶ Next World';
          const btnY = H * 0.30 + 110;
          const btnX = W / 2 - btnW / 2;
          ctx.fillStyle = 'rgba(232, 160, 48, ' + fadeIn + ')';
          ctx.beginPath();
          ctx.roundRect(btnX, btnY, btnW, btnH, 8);
          ctx.fill();
          ctx.fillStyle = 'rgba(26, 21, 16, ' + fadeIn + ')';
          ctx.font = "bold 14px 'Departure Mono', monospace";
          ctx.fillText(btnText, W / 2, btnY + 23);
          _completeBtn = { x: btnX, y: btnY, w: btnW, h: btnH, next: next };
        }

        // "Replay" button
        const replayY = H * 0.30 + (next ? 156 : 110);
        const replayX = W / 2 - btnW / 2;
        ctx.fillStyle = 'rgba(255, 255, 255, ' + fadeIn * 0.12 + ')';
        ctx.strokeStyle = 'rgba(255, 255, 255, ' + fadeIn * 0.3 + ')';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(replayX, replayY, btnW, btnH, 8);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = 'rgba(255, 255, 255, ' + fadeIn * 0.8 + ')';
        ctx.font = "14px 'Departure Mono', monospace";
        ctx.fillText('↺ Replay Course', W / 2, replayY + 23);
        _replayBtn = { x: replayX, y: replayY, w: btnW, h: btnH };
      }

      ctx.textAlign = 'left';
    } else {
      _completeBtn = null;
      _replayBtn = null;
    }
  }
};
