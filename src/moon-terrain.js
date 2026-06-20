// ── moon-terrain.js — dramatic Moon terrain: faceted heightfield + overhang LIPS (tiered) ─────────
// ROBUST design: the Moon's BASE terrain is the normal heightfield (vertices[]) — so it always renders
// and collides like Earth (no blank-terrain bug). On top, we add overhang LIPS (floating cantilever
// slabs that jut over a void → true overhangs you can hit the ball under) and deep V-valleys / cave-
// mouths cut into the surface. Drama scales with the course's `moonTier` (1 = modest+, 2 = more,
// 3 = most). Wired behind gen:'field': level-design.js → generateMoonHole; desert-golfing.js draws the
// heightfield then the lips, and collides the heightfield then the lips. Deterministic via random().

// outward-normal edges for a lip polygon (winding-agnostic)
function _moonEdges(loop) {
  let area = 0; for (let i = 0; i < loop.length; i++) { const a = loop[i], b = loop[(i + 1) % loop.length]; area += a.x * b.y - b.x * a.y; }
  const ccw = area > 0; const edges = [];
  for (let i = 0; i < loop.length; i++) {
    const a = loop[i], b = loop[(i + 1) % loop.length];
    const ex = b.x - a.x, ey = b.y - a.y, len = Math.hypot(ex, ey) || 1;
    edges.push({ ax: a.x, ay: a.y, bx: b.x, by: b.y, nx: ccw ? ey / len : -ey / len, ny: ccw ? -ex / len : ex / len, len });
  }
  return edges;
}
function _addLip(lips, px, lipY, jut, tier) {                  // a cantilever lip jutting LEFT over a void
  const th = 34 + random() * (16 + tier * 8);
  lips.push([{ x: px, y: lipY }, { x: px - jut, y: lipY }, { x: px - jut, y: lipY + th }, { x: px, y: lipY + th }]);
}
const _clF = (v, a, b) => v < a ? a : v > b ? b : v;

function generateMoonHole(holeIndex) {
  const tier = (currentCourse && currentCourse.moonTier) || 1;
  let teeX, teeY;
  if (holeIndex === 0) { teeX = 100; teeY = H * 0.5; if (vertices.length === 0) { vertices.push({ x: -300, y: teeY, mat: 'regolith' }); vertices.push({ x: teeX, y: teeY, mat: 'regolith' }); } }
  else { teeX = holes[holeIndex - 1].cupX; teeY = holes[holeIndex - 1].cupY; }

  const difficulty = getDifficulty(holeIndex);
  const effW = Math.max(960, W), maxDist = (typeof window !== 'undefined' && window.RG && window.RG._holeDistCap) ? window.RG._holeDistCap : (effW - 150);
  const dMin = currentCourse.holeDistMin != null ? currentCourse.holeDistMin : 460;
  const dMax = currentCourse.holeDistMax != null ? currentCourse.holeDistMax : 760;
  const dist = Math.min(dMin + random() * (dMax - dMin) + difficulty * 70, maxDist);
  const startX = teeX + 40, cupX = startX + dist, greenStart = cupX - 105;
  vertices = vertices.filter(v => v.x <= startX);

  const TOP = H * 0.12, BOT = H * 0.84;
  // drama dials per tier [_, t1, t2, t3]
  const slopeAmp = [0, 120, 175, 235][tier], valleyChance = [0, 0.16, 0.27, 0.40][tier];
  const valleyDepth = [0, 115, 165, 220][tier], lipChance = [0, 0.45, 0.62, 0.80][tier], lipMax = [0, 1, 2, 3][tier];

  const top = [], lips = [];
  top.push({ x: startX - 15, y: teeY });                       // tee flat (ball sits here)
  let x = startX + 30 + random() * 40, y = teeY; top.push({ x, y });
  let lipBudget = (random() < lipChance) ? 1 + (random() * lipMax | 0) : (tier >= 2 && random() < 0.5 ? 1 : 0);

  while (x < greenStart - 20) {
    const t = random();
    if (t < 0.40) { const len = Math.min(greenStart - 20 - x, 75 + random() * 150); x += len; top.push({ x, y }); }
    else if (t < 0.64) { const len = 50 + random() * 90, dy = (random() < 0.5 ? -1 : 1) * (45 + random() * slopeAmp); x = Math.min(greenStart - 20, x + len); y = _clF(y + dy, TOP, BOT); top.push({ x, y }); }
    else if (t < 0.64 + valleyChance) {                        // DEEP V-VALLEY / cave-mouth notch
      const w = 38 + random() * 46, apex = _clF(y + valleyDepth * (0.6 + random() * 0.6), TOP, BOT);
      x = Math.min(greenStart - 20, x + w); top.push({ x, y: apex });
      const ny = _clF(apex - valleyDepth * (0.5 + random() * 0.6), TOP, BOT);
      x = Math.min(greenStart - 20, x + w); y = ny; top.push({ x, y });
      if (lipBudget > 0 && random() < 0.65) { lipBudget--; _addLip(lips, x - 6, Math.min(apex, y) - (60 + random() * 50), w * (0.9 + tier * 0.15), tier); }  // arch over the valley
    }
    else if (lipBudget > 0) {                                   // overhang LIP jutting over a void
      lipBudget--;
      const lipY = _clF(y - (60 + random() * (60 + tier * 30)), TOP, BOT), px = x + 12 + random() * 14;
      y = lipY; top.push({ x: px, y });
      _addLip(lips, px, lipY + 4, 50 + random() * 60 + tier * 18, tier);
      x = px; const fwd = px + 6 + random() * 10; y = _clF(lipY + (40 + random() * 70), TOP, BOT); top.push({ x: fwd, y }); x = fwd;
    }
    else { const len = 70 + random() * 100; x = Math.min(greenStart - 20, x + len); top.push({ x, y }); }
  }
  const greenY = y; top.push({ x: greenStart, y: greenY }); top.push({ x: cupX, y: greenY });

  // monotonic top surface → vertices[] (the heightfield base; placeCup cuts the cup notch)
  let mx = -Infinity; for (const v of top) { if (v.x >= mx) { vertices.push({ x: v.x, y: clampY(v.y), mat: 'regolith' }); mx = v.x; } }
  const isLast = holeIndex === (currentCourse?.holeCount ?? 9) - 1;
  if (isLast) { vertices.push({ x: cupX + 80, y: clampY(greenY), mat: 'regolith' }); vertices.push({ x: cupX + 90, y: H + 200, mat: 'regolith' }); }
  else vertices.push({ x: cupX + 90, y: clampY(greenY + (random() - 0.5) * 40), mat: 'regolith' });

  placeCup(holeIndex, cupX, teeX, teeY);
  const hole = holes[holeIndex];
  hole.archetype = 'moon-t' + tier;
  hole._moonLips = lips.map(l => ({ pts: l, edges: _moonEdges(l) }));

  let m2 = -Infinity; vertices = vertices.filter(v => { if (v.x >= m2 - 0.5) { m2 = v.x; return true; } return false; });
}

// ── extra collision: ball vs the overhang LIPS (called after the normal heightfield collide) ──
function moonLipCollide() {
  const h = holes[currentHole]; if (!h || !h._moonLips || !h._moonLips.length) return false;
  const BR = BALL_RADIUS, rest = (MATERIALS.regolith || MATERIALS[DEFAULT_MAT]).restitution; let hit = false;
  for (const lip of h._moonLips) {
    const e0 = lip.edges; let minX = 1e9, maxX = -1e9; for (const e of e0) { minX = Math.min(minX, e.ax); maxX = Math.max(maxX, e.ax); }
    if (ball.x < minX - BR || ball.x > maxX + BR) continue;
    for (const e of e0) {
      const dx = e.bx - e.ax, dy = e.by - e.ay, lenSq = dx * dx + dy * dy; if (lenSq < 0.001) continue;
      let t = ((ball.x - e.ax) * dx + (ball.y - e.ay) * dy) / lenSq; t = Math.max(0, Math.min(1, t));
      const qx = e.ax + t * dx, qy = e.ay + t * dy, ddx = ball.x - qx, ddy = ball.y - qy, d2 = ddx * ddx + ddy * ddy;
      if (d2 < BR * BR && d2 > 0.0001) {
        const d = Math.sqrt(d2); let nx = ddx / d, ny = ddy / d;
        if (nx * e.nx + ny * e.ny < 0) { nx = e.nx; ny = e.ny; }
        ball.x += nx * (BR - d); ball.y += ny * (BR - d);
        const dot = ball.vx * nx + ball.vy * ny;
        if (dot < 0) { const g = Math.abs(ny) > Math.abs(nx); if (g && -dot < BOUNCE_THRESHOLD) { ball.vx -= dot * nx; ball.vy -= dot * ny; } else { ball.vx -= (1 + rest) * dot * nx; ball.vy -= (1 + rest) * dot * ny; } }
        ball.lastCollidedMat = 'regolith'; if (ny < -0.3) ball.onGround = true; hit = true;
      }
    }
  }
  return hit;
}

// ── extra render: fill the overhang LIPS (called after drawTerrainDG) ──
function moonDrawLips() {
  const mat = MATERIALS.regolith || MATERIALS[DEFAULT_MAT];
  const drawH = (h) => { if (!h || !h._moonLips) return; for (const lip of h._moonLips) { const p = lip.pts; ctx.beginPath(); ctx.moveTo(p[0].x, p[0].y); for (let i = 1; i < p.length; i++) ctx.lineTo(p[i].x, p[i].y); ctx.closePath(); ctx.fillStyle = mat.color; ctx.fill(); ctx.fillStyle = mat.colorLight; ctx.fillRect(p[1].x, p[1].y, p[0].x - p[1].x, 3); } };
  if (state === STATE_TRANSITION && currentHole > 0) drawH(holes[currentHole - 1]);
  drawH(holes[currentHole]);
}
