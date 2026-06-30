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

// PORTRAIT framing (peel-off): FIT-TO-CONTENT. The old framing used a fixed zoom-out (0.78) + a fixed
// terrain-top anchor (~0.46H), which on most holes left the hole crammed into a mid-screen band with a WALL
// of empty sky above (the real-device symptom). Instead we frame the hole's actual CONTENT bounding box —
// the ball (tee) + the cup + the terrain surface between them — and pick a per-hole ZOOM + vertical PAN so
// that box FILLS most of the tall phone frame: hole spans the width, ball sits in the lower third, cup is in
// view, terrain is prominent, and only a sensible band of sky (~25-35%) reads above for the shot arc.
// Map a desired SCREEN fraction (0..1 of W/H) for a WORLD point to the camera offset, accounting for the
// portrait zoom (applyCameraTransform: sx = z*(wx-camx) + (W/2)(1-z); pivot at canvas centre). z=1 reduces
// to the plain offset, so this is safe to use unconditionally on the portrait path. `z` may be passed
// explicitly (the per-hole fit zoom is computed BEFORE it is committed to RG._zoom).
function _portraitCamForScreen(wx, fracW, isY, zOverride) {
  const z = (zOverride != null) ? zOverride
    : ((typeof window !== 'undefined' && window.RG && window.RG._zoom) || 1);
  const span = isY ? H : W;
  const pivot = span / 2;                       // pivot is canvas centre on both axes
  // sx = z*(wx - cam) + pivot*(1-z)  →  cam = wx - (fracW*span - pivot*(1-z)) / z
  return wx - (fracW * span - pivot * (1 - z)) / z;
}

// Gather the hole's content bounds (world units): ball/tee + cup + terrain surface between them.
// Y grows DOWNWARD here, so yTop = highest point (smallest Y), yBot = lowest point (largest Y).
function _portraitHoleBounds(hole) {
  let lo = Infinity, hi = -Infinity;
  if (typeof terrainYAt === 'function') {
    const x0 = Math.min(hole.teeX, hole.cupX), x1 = Math.max(hole.teeX, hole.cupX);
    for (let x = x0; x <= x1; x += 8) { const y = terrainYAt(x); if (y < lo) lo = y; if (y > hi) hi = y; }
  }
  const teeY = hole.teeY != null ? hole.teeY : (isFinite(hi) ? hi : 0);
  const cupY = hole.cupY != null ? hole.cupY : (isFinite(hi) ? hi : 0);
  if (!isFinite(lo)) { lo = Math.min(teeY, cupY); hi = Math.max(teeY, cupY); }
  return {
    xLo: Math.min(hole.teeX, hole.cupX),
    xHi: Math.max(hole.teeX, hole.cupX),
    yTop: Math.min(lo, teeY, cupY),     // highest point (ball, cup, or terrain crest)
    yBot: Math.max(hi, teeY, cupY),     // lowest point (deepest terrain / lower of ball|cup)
    teeY: teeY, cupY: cupY,
  };
}

// Per-hole FIT zoom: make the tee→cup x-span fill most of the frame width, AND keep the ball→cup→terrain
// y-span (plus arc headroom) inside the frame. Returns a zoom clamped to a tasteful phone range so a very
// short or very tall hole can't blow up / shrink absurdly. Larger z = MORE zoomed IN (content fills more).
function _portraitFitZoom(b) {
  const FILL_W = 0.92;                           // tee→cup (+ flag pennant allowance) should fill ~92% of W
  const FLAG_ALLOW = 55;                          // the flag pole+pennant reads ~55px right of the cup — must
                                                  // be budgeted into the width or the tee/ball is shoved off-left
  const CONTENT_H = 0.60;                         // ball→cup→terrain should fit in ~60% of the frame height
                                                  // (leaves the remaining ~40% as a sky band for the arc)
  const xSpan = Math.max((b.xHi - b.xLo) + FLAG_ALLOW, 60);   // include the flag so the whole hole frames
  const ySpan = Math.max(b.yBot - b.yTop, 40);
  const zX = (W * FILL_W) / xSpan;
  const zY = (H * CONTENT_H) / ySpan;
  let z = Math.min(zX, zY);                       // the tighter constraint wins (both must fit)
  return Math.max(0.82, Math.min(1.30, z));       // tasteful clamp: never wilder than the old 0.78, never huge
}

// Compute the per-hole portrait zoom (and stash it so the wrap.js keep-alive holds THIS hole's value, not
// the static default). Called from setHoleCamera before the camera offsets are computed. Inert in landscape.
function portraitHoleZoom(hole) {
  const z = _portraitFitZoom(_portraitHoleBounds(hole));
  if (typeof window !== 'undefined' && window.RG_PORTRAIT) window.RG_PORTRAIT.zoom = z;  // keep-alive reads this
  return z;
}

function setHoleCameraY(hole) {
  const z = (typeof window !== 'undefined' && window.RG && window.RG._zoom) || 1;
  const b = _portraitHoleBounds(hole);
  const ballY = hole.teeY != null ? hole.teeY : b.yBot;   // the resting ball sits on the tee
  const cupY = hole.cupY != null ? hole.cupY : b.yTop;
  // Vertical PAN — the KEY to killing the dead-sky symptom. We have three competing goals; resolve in order:
  //  (1) sky band: keep the HIGHEST content point (yTop = top of ball|cup|terrain crest) at ~0.34 of the
  //      screen, so terrain+action FILL the lower ~66% and only a sensible ~34% sky band reads above for the
  //      shot arc (NOT the old ~60-75% wall of sky). This is the default anchor.
  // (NOTE on sign: a SMALLER camera.y puts content LOWER on screen — _portraitCamForScreen returns the
  //  camera.y that lands a world point at a target fraction, larger fraction → smaller cam.)
  let cy = _portraitCamForScreen(b.yTop, 0.40, true, z);
  //  (2) keep the BALL in the lower-middle band — don't let it ride too HIGH (above ~0.40, where a flat hole
  //      would strand it near the top with a big empty green slab below) and don't let it drop too LOW (below
  //      ~0.80, off into the bottom on a tall climb). Clamp the ball into [0.40, 0.80] of the screen height.
  const cyBallFloor = _portraitCamForScreen(ballY, 0.80, true, z);   // ball no lower than 0.80
  const cyBallCeil  = _portraitCamForScreen(ballY, 0.46, true, z);   // ball no higher than 0.46
  cy = Math.max(cy, cyBallFloor);
  cy = Math.min(cy, cyBallCeil);
  //  (3) cup/flag must stay visible: the flag pole rises ~60px above the cup; keep that tip at/below 0.06 so
  //      a HIGH cup doesn't clip off the top. Lowering the flag on screen = SMALLER cam → take the min.
  //      (The cup is the aim target, so this caps how far up goal (2) can push.)
  const cyFlagTop = _portraitCamForScreen(cupY - 60, 0.06, true, z);
  cy = Math.min(cy, cyFlagTop);
  // Final safety: never push the deepest content off the bottom edge (keep yBot at/above fraction 0.97 →
  //  LARGER cam → max).
  const cyDeep = _portraitCamForScreen(b.yBot, 0.97, true, z);
  cy = Math.max(cy, cyDeep);
  camera.y = cy;
}

// PORTRAIT horizontal framing (peel-off): the narrow phone frame (W~250) is barely wider than a snack hole
// (dist ~200), so the OLD static "centre the whole span" left the TEE (and the resting ball) clipped off
// the left edge — the real-device "ball not visible" symptom. Instead anchor on the BALL: hold it at
// ~0.30W from the left so you see AHEAD toward the cup, and clamp so the cup/flag still reads on the right.
// The same anchor is reused by the per-frame follow-cam (wrap.js updateCamera) so the ball is ALWAYS on
// screen, at address and in flight. Inert in landscape. Optional `target` overrides the ball x (used by the
// follow-cam to look slightly ahead of a fast ball).
function portraitCameraX(hole, target) {
  const bx = (target != null) ? target : (typeof ball !== 'undefined' ? ball.x : hole.teeX);
  // Ideal: ball at ~30% of the SCREEN width from the left → room to see the cup ahead. Zoom-aware.
  let cx = _portraitCamForScreen(bx, 0.30, false);
  // Bounds (zoom-aware): keep the whole FLAG on the right AND the tee on the left. With the portrait zoom
  // the visible world is wider, so an authored hole fits and these only bind on long flights. Cup-side
  // takes priority (it's the aim target) if a hole still can't satisfy both.
  const loForCup = _portraitCamForScreen(hole.cupX + 55, 0.985, false);   // flag pole+pennant ~55px right of cupX, kept just inside the right edge
  const hiForTee = _portraitCamForScreen(hole.teeX, 0.06, false);          // tee with a small left margin
  if (hiForTee >= loForCup) cx = Math.max(loForCup, Math.min(cx, hiForTee));  // both fit: clamp into the window
  else cx = loForCup;                                                          // too wide even zoomed: favour the cup
  return cx;
}

// ── Camera ─────────────────────────────────────────────────
function setHoleCamera(hole) {
  // PORTRAIT MODE (peel-off, inert by default): the narrow phone frame can't afford the 120px landscape
  // margin, and centring the whole span clipped the ball off-frame. Anchor on the ball (portraitCameraX)
  // so the resting ball is ~30% in from the left + the flag still reads; the follow-cam keeps it there in
  // flight. Gated entirely on RG._portraitCapture (set only under ?portrait) — landscape is byte-identical.
  if (typeof window !== 'undefined' && window.RG && window.RG._portraitCapture) {
    // FIT-TO-CONTENT: pick this hole's zoom FIRST (so the x/y framing below sees the right scale), commit it
    // to RG._zoom (+ RG_PORTRAIT.zoom for the wrap.js keep-alive), then frame x + y against it.
    const z = portraitHoleZoom(hole);
    window.RG._zoom = z;
    window.RG._zoomPivot = { x: W / 2, y: H / 2 };
    camera.x = portraitCameraX(hole);
    setHoleCameraY(hole);                  // portrait-tuned vertical framing (below)
    return;
  }
  const margin = 120;
  const teeScreenX = margin;
  camera.x = hole.teeX - teeScreenX;

  const cupScreenX = hole.cupX - camera.x;
  if (cupScreenX > W - margin) {
    const center = (hole.teeX + hole.cupX) / 2;
    camera.x = center - W / 2;
  }

  // OPT-IN vertical framing (separate from the horizontal logic above; base game keeps camera.y = 0).
  // When the course sets verticalCam (or window.VCAM), nudge camera.y so the hole's playable band is
  // centred — high holes pan UP to show their verticality + the star background instead of stranding the
  // flag at the top. Reads terrain min/max over tee→cup. Safe: the engine already supports non-zero camera.y.
  const vcam = (typeof currentCourse !== 'undefined' && currentCourse && currentCourse.verticalCam) ||
    (typeof window !== 'undefined' && window.VCAM);
  if (vcam && typeof terrainYAt === 'function') {
    let mx = -Infinity;                                    // deepest terrain over the hole
    for (let x = hole.teeX; x <= hole.cupX; x += 12) { const y = terrainYAt(x); if (y > mx) mx = y; }
    // Bring a HIGH cup DOWN toward ~38% of the screen (reveals the star background above), but never pan so
    // far up that the deepest terrain leaves the view bottom; never pan down. Low holes → camera.y stays 0.
    camera.y = Math.max(mx - H + 40, Math.min(0, hole.cupY - H * 0.38));
  } else {
    camera.y = 0;   // horizontal-only (unchanged behaviour)
  }
}

// ── Cup Logic ──────────────────────────────────────────────
function isBallInCup() {
  const hole = holes[currentHole];
  if (!hole || hole.cupFilled) return false;

  // Portrait mode (peel-off, inert by default): widen the cup-X capture so the bigger phone ball drops
  // more forgivingly. RG._portraitCapture is undefined in the landscape game → multiplier 1 (unchanged).
  const cap = (typeof window !== 'undefined' && window.RG && window.RG._portraitCapture) || 1;
  const inCupX = Math.abs(ball.x - hole.cupX) < (CUP_WIDTH / 2) * cap;
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

  // WORLD-CURVE (golf-orbit): a screen-space parabolic bow that makes the flat heightfield read as the
  // convex limb of a planet when zoomed OUT. Inert by default — RG._worldCurve is unset in the base game,
  // so `cv` is null and every lineTo below uses the raw vertex Y (byte-identical to the old render).
  // When active, RG._curveWorldDY(wx) returns a WORLD-Y offset (added to a vertex's y) that, after the
  // camera scale, lands the point at its bowed screen Y — the SAME offset the ball/flag use, so they all
  // stay glued to the surface. Long segments are subdivided so the parabola reads as a smooth curve
  // (a chord between two far-apart vertices would otherwise show as a flat facet).
  const cv = (typeof window !== 'undefined' && window.RG && window.RG._worldCurve && window.RG._curveWorldDY) ? window.RG._curveWorldDY : null;
  const cvY = cv ? function (x, y) { return y + cv(x); } : null;
  const cvLineTo = cv ? function (x, yPrev, x2, y2) {
    // subdivide the segment (yPrev,y2 are RAW vertex Ys) so the bow is smooth
    const steps = Math.max(1, Math.min(40, Math.ceil(Math.abs(x2 - x) / 60)));
    for (let s = 1; s <= steps; s++) { const t = s / steps; const xx = x + (x2 - x) * t, yy = yPrev + (y2 - yPrev) * t; ctx.lineTo(xx, cvY(xx, yy)); }
  } : null;

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
    // The terrain's left end (vertex 0) would otherwise show as a hard cliff against the sky.
    // Extend that first run flat off the left screen edge so the ground just runs offscreen — you're
    // on a planet, it shouldn't simply end. Only the left start is extended; the course's RIGHT end
    // still shows (a deliberate "course is ending" cue). Applied on EVERY frame including the travel
    // landing pan — the old `camera.y === 0` (on-surface) gate caused a one-frame terrain POP as the
    // camera eased to 0 at landing and the fill suddenly switched on. (Secret rooms, which wanted the
    // left wall, are removed, so the gate is no longer needed.)
    const leftX = (runStart === 0) ? Math.min(vertices[runStart].x, startX) : vertices[runStart].x;
    ctx.beginPath();
    if (cv) {
      ctx.moveTo(leftX, cvY(leftX, vertices[runStart].y));
      cvLineTo(leftX, vertices[runStart].y, vertices[runStart].x, vertices[runStart].y);
      for (let j = runStart + 1; j <= runEnd && j < vertices.length; j++) {
        cvLineTo(vertices[j - 1].x, vertices[j - 1].y, vertices[j].x, vertices[j].y);
      }
    } else {
      ctx.moveTo(leftX, vertices[runStart].y);
      ctx.lineTo(vertices[runStart].x, vertices[runStart].y);
      for (let j = runStart + 1; j <= runEnd && j < vertices.length; j++) {
        ctx.lineTo(vertices[j].x, vertices[j].y);
      }
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
    // Phase 2: overhang set-pieces (planets) — explicit slabs over the heightfield floor.
    let sp = false;
    if (typeof collideSetPieces === 'function') sp = collideSetPieces();
    // Phase W: water hazard (flat pools) — splash → reshoot from last safe.
    if (typeof collideWater === 'function') collideWater();
    ball.onGround = terrain || obj || lip || sp;
    return terrain || obj || lip || sp;
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
    transitionCamYStart = (typeof camera.y === 'number') ? camera.y : 0;
    transitionCamYEnd = transitionCamYStart;   // default: no Y move (landscape, camera.y === 0)
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
      // Compute target camera position for new hole. setHoleCamera mutates BOTH camera.x and (in
      // portrait / verticalCam) camera.y. Capture both targets, then restore both — the transition
      // tween eases each axis to its target so neither SNAPS (the portrait camera "pop" was camera.y
      // jumping here while only camera.x was being animated). camera-Y easing lives in onTransitionUpdate.
      const newHole = holes[currentHole];
      const savedCamX = camera.x, savedCamY = camera.y;
      // PORTRAIT zoom ease (gated): setHoleCamera computes the NEW hole's fit-zoom + frames camera.x/y at it.
      // Holes differ in fit-zoom (a short hole zooms in more than a wide one), so a raw snap would POP the
      // world scale at the transition. Capture old→new zoom; onTransitionUpdate eases RG_PORTRAIT.zoom (which
      // the wrap.js keep-alive mirrors into RG._zoom every frame), so the scale GLIDES into the new hole.
      // Inert in landscape (RG_PORTRAIT only exists under ?portrait).
      const portraitZoom = (typeof window !== 'undefined' && window.RG_PORTRAIT);
      _transZoomStart = portraitZoom ? window.RG_PORTRAIT.zoom : null;
      setHoleCamera(newHole);
      _transZoomEnd = portraitZoom ? window.RG_PORTRAIT.zoom : null;
      transitionCamEnd = camera.x;
      transitionCamYEnd = (typeof camera.y === 'number') ? camera.y : 0;
      camera.x = savedCamX; // restore — we'll animate to target
      camera.y = savedCamY;
      // RESTORE the zoom too (setHoleCamera just set RG._zoom + RG_PORTRAIT.zoom to the NEW hole's fit-zoom).
      // Without this, the frame BEFORE the first onTransitionUpdate renders at the new scale = a one-frame
      // ZOOM POP ("a different screen flashed"). Restoring to start lets onTransitionUpdate ease it cleanly.
      if (portraitZoom && _transZoomStart != null) {
        window.RG_PORTRAIT.zoom = _transZoomStart;
        if (window.RG) { window.RG._zoom = _transZoomStart; window.RG._zoomPivot = { x: W / 2, y: H / 2 }; }
      }
    }

    if (currentHole === 1) showTitle = false;
  },

  setCameraPos(val) {
    camera.x = val;
  },

  // Ease camera.y alongside the X pan so verticalCam / PORTRAIT framing glides into the new hole instead
  // of snapping (the portrait "pop"). Inert in the base landscape game (start === end === 0 → no change).
  // The roguelike wrap.js overrides onTransitionUpdate; it calls THIS first so the Y ease always runs.
  onTransitionUpdate(ease) {
    if (transitionCamYEnd !== transitionCamYStart) {
      camera.y = transitionCamYStart + (transitionCamYEnd - transitionCamYStart) * ease;
    }
    // PORTRAIT fit-zoom ease (gated): glide the world scale from the previous hole's zoom to the new hole's
    // zoom so the scale doesn't pop at the cut. We ease RG_PORTRAIT.zoom; the wrap.js keep-alive mirrors it
    // into RG._zoom every frame, so the live transform follows. Inert in landscape (_transZoom* stay null).
    if (_transZoomStart != null && _transZoomEnd != null && _transZoomStart !== _transZoomEnd
        && typeof window !== 'undefined' && window.RG_PORTRAIT) {
      const z = _transZoomStart + (_transZoomEnd - _transZoomStart) * ease;
      window.RG_PORTRAIT.zoom = z;
      if (window.RG) { window.RG._zoom = z; window.RG._zoomPivot = { x: W / 2, y: H / 2 }; }
    }
  },

  getTransitionCupData() {
    return currentHole > 0 ? holes[currentHole - 1] : null;
  },

  onTransitionEnd() {
    // PORTRAIT: settle the zoom on the new hole's exact fit value + clear the ease endpoints (so a later
    // resize-reframe isn't clobbered by a stale tween). Inert in landscape (_transZoom* are null).
    if (_transZoomEnd != null && typeof window !== 'undefined' && window.RG_PORTRAIT) {
      window.RG_PORTRAIT.zoom = _transZoomEnd;
      if (window.RG) { window.RG._zoom = _transZoomEnd; window.RG._zoomPivot = { x: W / 2, y: H / 2 }; }
    }
    _transZoomStart = null; _transZoomEnd = null;
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
    // PIXEL-SNAP the camera to the display grid: terrain + the sand-grain texture otherwise render at sub-pixel
    // offsets that shift every frame as the camera moves → the "choppy/shimmer on camera move" jank. Snapping
    // the world's screen offset to whole device pixels makes it crawl-free. Physics/positions are untouched —
    // only the render transform snaps (everything else still reads the real camera.x).
    var _sc = (typeof displayScale === 'number' && displayScale) ? displayScale : 1;
    ctx.translate(-Math.round(camera.x * _sc) / _sc, 0);
  },

  drawSky() {
    ctx.fillStyle = currentWorld?.sky || SKY;
    ctx.fillRect(0, 0, W, H);
  },

  drawWorld() {
    drawTerrainDG();                                  // the heightfield base (always renders → no blank terrain)
    // Moon (gen:'field'): draw the overhang LIPS on top.
    if (currentCourse && currentCourse.gen === 'field' && typeof moonDrawLips === 'function') moonDrawLips();
    // Phase 2: overhang set-pieces (planets) — draw the slabs over the heightfield.
    if (typeof drawSetPieces === 'function') drawSetPieces();
    // Phase W: flat water pools (drawn over the terrain so the basin reads as flat water, not angular).
    if (typeof drawWater === 'function') drawWater();

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

      // PORTRAIT title (peel-off, gated): the narrow phone frame can't fit the 28px name + a redundant
      // second line. Show ONE compact name (long "Planet · Subname" reduced to the subname, which is the
      // distinct part) + the hole count, at a size that fits W~304. Inert in landscape.
      if (typeof window !== 'undefined' && window.RG && window.RG._portraitCapture) {
        let name = worldName || courseName || '';
        if (name.indexOf('·') >= 0) name = name.split('·').pop().trim();   // "Kepler-90b · Verdshoal" → "Verdshoal"
        // Drop the title BELOW the notch (same inset as the score readout it hands off to) so it isn't
        // jammed under the status bar. Inset comes from RG_PORTRAIT (exists only under ?portrait).
        const _pt = window.RG_PORTRAIT;
        const top = (_pt && _pt.hudTopInset) ? _pt.hudTopInset() : 0;
        ctx.font = "20px 'Departure Mono', monospace";
        ctx.fillText(name, 20, top + 18);
        ctx.font = "13px 'Departure Mono', monospace";
        ctx.fillStyle = 'rgba(255,255,255,0.6)';
        ctx.fillText(holeCount + ' Holes', 20, top + 38);
        ctx.textAlign = 'left';
        return;
      }

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
