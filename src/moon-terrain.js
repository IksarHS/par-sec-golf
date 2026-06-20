// ── moon-terrain.js — POLYGON terrain for the Moon (overhangs + carved caves) ─────────────────────
// The heightfield can't do overhangs, so the Moon's terrain is a POLYGON (a closed loop of the solid
// boundary). Two flavours, mixed per hole:
//   • faceted-folds — flat/angular facets with occasional cantilever LIPS that jut over a void (true
//     overhangs you can hit the ball under). Most holes.
//   • carved-field — a 2D noise field contoured (marching squares) → caves/hooks/pockets. Some holes.
// Collision is ball-vs-polygon-edges (outward normals → handles overhangs/caves); render fills the
// polygon; vertices[] holds the monotonic TOP surface so terrainYAt (tee / OOB / sampling) still works.
// Deterministic via the engine's seeded random(). Wired in: level-design.js (gen:'field' branch),
// modes/desert-golfing.js (collide / draw / terrainYAt branches), worlds/run.js (moon gen:'field').

// ── value noise (for carved holes) ──
function _mh2(xi, yi, s) { let h = (Math.imul(xi, 374761393) + Math.imul(yi, 668265263) + Math.imul(s, 2246822519)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
function _msm(t) { return t * t * (3 - 2 * t); }
function _vn2(x, y, s) { const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, u = _msm(xf), v = _msm(yf); const L = (a, b, t) => a + (b - a) * t; return L(L(_mh2(xi, yi, s), _mh2(xi + 1, yi, s), u), L(_mh2(xi, yi + 1, s), _mh2(xi + 1, yi + 1, s), u), v); }
function _fbm2(x, y, s, o) { let a = 0.5, f = 1, sum = 0, n = 0; for (let i = 0; i < o; i++) { sum += a * _vn2(x * f, y * f, s + i * 1013); n += a; a *= 0.5; f *= 2; } return sum / n; }

// push a flat-green approach + the cup NOTCH (the dip the ball drops into) onto a top-edge point list
function _pushCupNotch(top, cupX, greenY) {
  const hw = CUP_WIDTH / 2;
  top.push({ x: cupX - hw, y: greenY });
  top.push({ x: cupX - hw + 3, y: greenY + CUP_DEPTH });
  top.push({ x: cupX + hw - 3, y: greenY + CUP_DEPTH });
  top.push({ x: cupX + hw, y: greenY });
  top.push({ x: cupX + 40, y: greenY });
}

// outward-normal edges for a polygon loop (winding-agnostic via signed area)
function _moonEdges(loop) {
  let area = 0; for (let i = 0; i < loop.length; i++) { const a = loop[i], b = loop[(i + 1) % loop.length]; area += a.x * b.y - b.x * a.y; }
  const ccw = area > 0;                                  // screen y-down: sign tells winding
  const edges = [];
  for (let i = 0; i < loop.length; i++) {
    const a = loop[i], b = loop[(i + 1) % loop.length];
    const ex = b.x - a.x, ey = b.y - a.y, len = Math.hypot(ex, ey) || 1;
    // outward normal: rotate edge dir by -90 (ccw) or +90 (cw) so it points OUT of the solid
    let nx = ccw ? ey / len : -ey / len, ny = ccw ? -ex / len : ex / len;
    edges.push({ ax: a.x, ay: a.y, bx: b.x, by: b.y, nx, ny, len });
  }
  return edges;
}

// ── build one Moon hole (continuous: teeX from prev cup). Returns nothing; fills vertices[]/holes[]. ──
function generateMoonHole(holeIndex) {
  let teeX, teeY;
  if (holeIndex === 0) { teeX = 100; teeY = H * 0.5; if (vertices.length === 0) { vertices.push({ x: -200, y: teeY, mat: 'regolith' }); vertices.push({ x: teeX, y: teeY, mat: 'regolith' }); } }
  else { teeX = holes[holeIndex - 1].cupX; teeY = holes[holeIndex - 1].cupY; }

  const difficulty = getDifficulty(holeIndex);
  const effectiveW = Math.max(960, W);
  const maxDist = (typeof window !== 'undefined' && window.RG && window.RG._holeDistCap) ? window.RG._holeDistCap : (effectiveW - 150);
  const dMin = currentCourse.holeDistMin != null ? currentCourse.holeDistMin : 360;
  const dMax = currentCourse.holeDistMax != null ? currentCourse.holeDistMax : 640;
  const dist = Math.min(dMin + random() * (dMax - dMin) + difficulty * 80, maxDist);
  const startX = teeX + 40, cupX = startX + dist;

  // trim previous terrain past startX (continuity)
  vertices = vertices.filter(v => v.x <= startX);

  const carved = random() < 0.32;                        // ~1/3 carved-field caves, rest faceted-folds
  const built = carved ? _buildCarved(startX, teeY, dist, difficulty, holeIndex)
    : _buildFacetedFolds(startX, teeY, dist, difficulty);

  // top surface → vertices[] (monotonic heightfield for terrainYAt)
  for (const v of built.top) vertices.push({ x: v.x, y: clampY(v.y), mat: 'regolith' });
  // background past the cup
  const isLast = holeIndex === (currentCourse?.holeCount ?? 9) - 1;
  if (isLast) { vertices.push({ x: cupX + 80, y: built.top[built.top.length - 1].y, mat: 'regolith' }); vertices.push({ x: cupX + 90, y: H + 200, mat: 'regolith' }); }
  else { vertices.push({ x: cupX + 90, y: clampY(built.top[built.top.length - 1].y + (random() - 0.5) * 40), mat: 'regolith' }); }

  // the overlay polygon (the REAL terrain, with overhangs/caves) for collision + render
  placeCup(holeIndex, cupX, teeX, teeY);
  const hole = holes[holeIndex];
  hole.archetype = carved ? 'moon-carved' : 'moon-folds';
  hole._moonPoly = built.polys;                          // array of loops
  hole._moonEdges = built.polys.map(_moonEdges);
  hole._moonGen = true;

  // strict monotonic x on vertices[]
  let mx = -Infinity; vertices = vertices.filter(v => { if (v.x >= mx - 0.5) { mx = v.x; return true; } return false; });
}

// faceted facets + occasional overhang lips; returns {top:[{x,y}] monotonic, polys:[loop,...]}
function _buildFacetedFolds(sx, sy, dist, diff) {
  const TOP = H * 0.14, BOT = H * 0.82, floorBot = H + 60;
  const cupX = sx + dist, greenStart = cupX - 110;
  const top = []; const lips = [];
  top.push({ x: sx - 55, y: sy });                       // cover the tee so the ball sits on the polygon
  let x = sx + 20 + random() * 40, y = sy; top.push({ x, y });
  let lipBudget = random() < 0.85 ? 1 + (random() * 2 | 0) : 0;
  while (x < greenStart - 20) {
    const t = random();
    if (t < 0.42) { const len = Math.min(greenStart - 20 - x, 80 + random() * 150); x += len; top.push({ x, y }); }
    else if (t < 0.74) { const len = 50 + random() * 95, dy = (random() < 0.5 ? -1 : 1) * (55 + random() * 150 + diff * 40); x = Math.min(greenStart - 20, x + len); y = Math.max(TOP, Math.min(BOT, y + dy)); top.push({ x, y }); }
    else if (lipBudget > 0 && t < 0.90) {                // OVERHANG LIP: a cantilever jutting back-left over a void
      lipBudget--;
      const baseY = y, lipY = Math.max(TOP, baseY - (60 + random() * 90));
      const px = x + 14 + random() * 14; y = lipY; top.push({ x: px, y });          // steep rise to the lip top
      const jut = 40 + random() * 60;                                                // how far the top juts left
      lips.push([{ x: px, y: lipY + 4 }, { x: px - jut, y: lipY + 4 }, { x: px - jut, y: lipY + 4 + (38 + random() * 22) }, { x: px, y: lipY + 4 + (38 + random() * 22) }]);
      x = px; const fwd = px + 6 + random() * 10; y = Math.max(TOP, Math.min(BOT, lipY + (40 + random() * 70))); top.push({ x: fwd, y }); x = fwd;  // drop forward
    } else { const dyT = (random() < 0.5 ? -1 : 1) * (45 + random() * 60); for (let k = 0; k < 3 && x < greenStart - 20; k++) { x = Math.min(greenStart - 20, x + 24 + random() * 22); y = Math.max(TOP, Math.min(BOT, y + dyT * (k === 1 ? 1 : 0.55))); top.push({ x, y }); } }
  }
  const greenY = y; top.push({ x: greenStart, y: greenY });
  _pushCupNotch(top, cupX, greenY);                      // flat green + cup notch the ball drops into
  // monotonic top (drop any backward points just in case)
  const mono = []; let mx = -Infinity; for (const v of top) { if (v.x >= mx) { mono.push(v); mx = v.x; } }
  // main solid polygon = the top line + bottom corners
  const main = mono.map(v => ({ x: v.x, y: v.y })); main.push({ x: cupX + 100, y: floorBot }); main.push({ x: sx - 60, y: floorBot });
  return { top: mono, polys: [main, ...lips] };
}

// carved 2D field → an organic CURVY surface (gom_3 look) with the cup notch. Returns {top, polys}.
function _buildCarved(sx, sy, dist, diff, holeIndex) {
  const cupX = sx + dist, greenStart = cupX - 80, floorBot = H + 60, step = 12;
  const seed = (getSeed() | 0) ^ Math.imul(holeIndex + 1, 0x9e3779b1);
  const midY = H * 0.42, hAmp = 105, hf = 1 / 175, wAmp = 70, wf = 1 / 90;
  // a flowing surface: low-freq base + a second wobble — curvy/organic, distinct from the faceted holes
  const surfaceY = (x) => midY + hAmp * (_fbm2(x * hf, 0.137, seed, 4) - 0.5) * 2 + wAmp * (_fbm2(x * wf, 11.3, seed + 5, 2) - 0.5) * 2;
  const top = [];
  top.push({ x: sx - 55, y: sy });                       // cover the tee
  for (let x = sx + 30; x < greenStart; x += step) top.push({ x, y: Math.max(H * 0.16, Math.min(H * 0.84, surfaceY(x))) });
  const greenY = top[top.length - 1].y; top.push({ x: greenStart, y: greenY });
  _pushCupNotch(top, cupX, greenY);
  // monotonic
  const mono = []; let mx = -Infinity; for (const v of top) { if (v.x >= mx) { mono.push(v); mx = v.x; } }
  const main = mono.map(v => ({ x: v.x, y: v.y })); main.push({ x: cupX + 100, y: floorBot }); main.push({ x: sx - 60, y: floorBot });
  return { top: mono, polys: [main] };
}

// ── collision: ball vs the current Moon hole's polygon edges (called from collideWithTerrain) ──
function moonCollide() {
  const h = holes[currentHole]; if (!h || !h._moonEdges) return false;
  const BR = BALL_RADIUS, rest = (MATERIALS.regolith || MATERIALS[DEFAULT_MAT]).restitution;
  let collided = false;
  for (const edges of h._moonEdges) {
    for (let i = 0; i < edges.length; i++) {
      const e = edges[i];
      if (ball.x < Math.min(e.ax, e.bx) - BR || ball.x > Math.max(e.ax, e.bx) + BR) continue;
      const dx = e.bx - e.ax, dy = e.by - e.ay, lenSq = dx * dx + dy * dy; if (lenSq < 0.001) continue;
      let t = ((ball.x - e.ax) * dx + (ball.y - e.ay) * dy) / lenSq; t = Math.max(0, Math.min(1, t));
      const qx = e.ax + t * dx, qy = e.ay + t * dy, ddx = ball.x - qx, ddy = ball.y - qy, d2 = ddx * ddx + ddy * ddy;
      if (d2 < BR * BR && d2 > 0.0001) {
        const d = Math.sqrt(d2); let nx = ddx / d, ny = ddy / d;
        if (nx * e.nx + ny * e.ny < 0) { nx = e.nx; ny = e.ny; }   // keep the outward side
        ball.x += nx * (BR - d); ball.y += ny * (BR - d);
        const dot = ball.vx * nx + ball.vy * ny;
        if (dot < 0) { const isGround = Math.abs(ny) > Math.abs(nx); if (isGround && -dot < BOUNCE_THRESHOLD) { ball.vx -= dot * nx; ball.vy -= dot * ny; } else { ball.vx -= (1 + rest) * dot * nx; ball.vy -= (1 + rest) * dot * ny; } }
        ball.lastCollidedMat = 'regolith';
        if (ny < -0.3) ball.onGround = true;
        collided = true;
      }
    }
  }
  return collided;
}

// ── render: fill the current (and during-transition, previous) Moon hole's polygons ──
function moonDrawHole(h) {
  if (!h || !h._moonPoly) return;
  const mat = MATERIALS.regolith || MATERIALS[DEFAULT_MAT];
  for (const loop of h._moonPoly) {
    ctx.beginPath(); ctx.moveTo(loop[0].x, loop[0].y); for (let i = 1; i < loop.length; i++) ctx.lineTo(loop[i].x, loop[i].y); ctx.closePath();
    ctx.fillStyle = mat.color; ctx.fill();
  }
}
function moonDraw() {
  if (state === STATE_TRANSITION && currentHole > 0) moonDrawHole(holes[currentHole - 1]);
  if (holes[currentHole]) moonDrawHole(holes[currentHole]);
}
