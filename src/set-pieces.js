// ── set-pieces.js — Phase 2: explicit-polygon OVERHANGS over the heightfield (the weird 20%) ─────────
// The clean heightfield is the floor (cup/tee/fill/collision all native + reachable). On the complex
// planets we hang a FEW directly-authored solid slabs above the floor — real overhangs the ball must go
// UNDER. No field, no marching squares, no simplification (so no lacerations, ever). Reachable BY
// CONSTRUCTION: the cup stays on the heightfield floor, the slab sits mid-hole (not over the cup) with a
// ball-clearance gap, so the floor path to the cup is always open. Collision = swept circle-vs-segment.
// Wired in: level-design.js (after a faceted hole is built, call generateOverhangs); desert-golfing.js
// (drawWorld -> drawSetPieces after terrain; collide -> collideSetPieces after terrain).

// outward-normal edges for a convex slab (normals point away from the centroid)
function _spEdges(loop) {
  let cx = 0, cy = 0; for (const p of loop) { cx += p.x; cy += p.y; } cx /= loop.length; cy /= loop.length;
  const edges = [];
  for (let i = 0; i < loop.length; i++) {
    const a = loop[i], b = loop[(i + 1) % loop.length], ex = b.x - a.x, ey = b.y - a.y, len = Math.hypot(ex, ey) || 1;
    let nx = ey / len, ny = -ex / len; const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
    if ((mx - cx) * nx + (my - cy) * ny < 0) { nx = -nx; ny = -ny; }
    edges.push({ ax: a.x, ay: a.y, bx: b.x, by: b.y, nx, ny });
  }
  return edges;
}

// Build 0-2 floating ANGULAR MASSES over chasms for a hole — GoM-style floating terrain chunks the ball
// passes UNDER (through the chasm) or lands ON. We find a deep dip (chasm) in the mid-hole and float an
// angular polygon near its rim with clearance below. `complexity` 0..1 gates frequency/size. Reachable by
// construction: the cup is on the heightfield floor; the mass floats high over a chasm mid-hole (clear
// gap below), never blocking the cup approach.
function generateOverhangs(hole, complexity) {
  if (!hole || complexity == null || complexity < 0.5 || typeof terrainYAt !== 'function') return;
  const teeX = hole.teeX, cupX = hole.cupX, span = cupX - teeX; if (span < 300) return;
  const want = (random() < (complexity - 0.45) * 1.5) ? (random() < (complexity - 0.66) ? 2 : 1) : 0;
  const pieces = [];
  for (let k = 0; k < want; k++) {
    // find the deepest CHASM (local low flanked by higher terrain) in a mid-hole window
    const lo = teeX + span * (0.24 + k * 0.28), hi = Math.min(cupX - 130, teeX + span * (0.6 + k * 0.24));
    let chasmX = -1, deepest = 0;
    for (let x = lo; x < hi; x += 15) {
      const y = terrainYAt(x), depth = Math.min(y - terrainYAt(x - 72), y - terrainYAt(x + 72));
      if (depth > deepest) { deepest = depth; chasmX = x; }
    }
    if (chasmX < 0 || deepest < 60) continue;                    // need a real chasm to float over
    const rimY = Math.min(terrainYAt(chasmX - 72), terrainYAt(chasmX + 72));   // the higher rim
    const w = 56 + random() * 56 + complexity * 44, hh = 28 + random() * 34;
    const cx = chasmX + (random() - 0.5) * 30, cy = rimY - 8 - random() * (30 + complexity * 30);  // float near/above the rim
    if (cy - hh < H * 0.06) continue;
    // a 5-point ANGULAR convex blob (reads as a chunk of terrain, not a UI bar)
    const j = () => (random() - 0.5);
    const mass = [
      { x: cx - w * 0.5, y: cy + hh * (0.15 + random() * 0.2) },
      { x: cx - w * (0.28 + j() * 0.1), y: cy - hh * (0.4 + random() * 0.3) },
      { x: cx + w * (0.3 + j() * 0.1), y: cy - hh * (0.3 + random() * 0.35) },
      { x: cx + w * 0.5, y: cy + hh * (0.2 + random() * 0.2) },
      { x: cx + j() * w * 0.2, y: cy + hh * (0.55 + random() * 0.25) },
    ];
    pieces.push({ pts: mass, edges: _spEdges(mass) });
  }
  if (pieces.length) hole._overhangs = pieces;
}

// ── swept circle-vs-slab collision (no tunneling): also catch the case where the ball crossed the slab ──
function collideSetPieces() {
  const h = holes[currentHole]; if (!h || !h._overhangs || !h._overhangs.length) return false;
  const BR = BALL_RADIUS, mat = MATERIALS[ball.lastCollidedMat] || MATERIALS[currentCourse.defaultMaterial] || MATERIALS.grass;
  const rest = mat.restitution; let hit = false;
  for (const pc of h._overhangs) {
    const e0 = pc.edges; let minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9;
    for (const e of e0) { minX = Math.min(minX, e.ax); maxX = Math.max(maxX, e.ax); minY = Math.min(minY, e.ay); maxY = Math.max(maxY, e.ay); }
    // broadphase incl. the swept segment from the pre-move position
    const px = ball._px != null ? ball._px : ball.x, py = ball._py != null ? ball._py : ball.y;
    if (Math.max(ball.x, px) < minX - BR || Math.min(ball.x, px) > maxX + BR || Math.max(ball.y, py) < minY - BR || Math.min(ball.y, py) > maxY + BR) continue;
    // if the segment pre->cur passed through the slab, pull the ball back to entry (anti-tunnel)
    if (_pointInSlab(e0, ball.x, ball.y) === false && _pointInSlab(e0, px, py) === false) {
      const steps = Math.ceil(Math.hypot(ball.x - px, ball.y - py) / (BR * 0.6));
      for (let s = 1; s < steps; s++) { const t = s / steps, x = px + (ball.x - px) * t, y = py + (ball.y - py) * t; if (_pointInSlab(e0, x, y)) { ball.x = x; ball.y = y; break; } }
    }
    // push out of / off the slab via nearest edge
    for (let it = 0; it < 2; it++) {
      let bd = 1e9, bnx = 0, bny = 0;
      for (const e of e0) {
        const dx = e.bx - e.ax, dy = e.by - e.ay, ls = dx * dx + dy * dy; if (ls < 1e-4) continue;
        let t = ((ball.x - e.ax) * dx + (ball.y - e.ay) * dy) / ls; t = t < 0 ? 0 : t > 1 ? 1 : t;
        const qx = e.ax + t * dx, qy = e.ay + t * dy, ddx = ball.x - qx, ddy = ball.y - qy, d2 = ddx * ddx + ddy * ddy;
        if (d2 < BR * BR) { const d = Math.sqrt(d2) || 0.001; let nx = ddx / d, ny = ddy / d; if (nx * e.nx + ny * e.ny < 0) { nx = e.nx; ny = e.ny; } const pen = BR - d; if (pen < bd) { bd = pen; bnx = nx; bny = ny; } }
      }
      if (bd > 1e8) break;
      ball.x += bnx * (bd + 0.1); ball.y += bny * (bd + 0.1);
      const dot = ball.vx * bnx + ball.vy * bny;
      if (dot < 0) { const g = Math.abs(bny) > Math.abs(bnx); if (g && -dot < BOUNCE_THRESHOLD) { ball.vx -= dot * bnx; ball.vy -= dot * bny; } else { ball.vx -= (1 + rest) * dot * bnx; ball.vy -= (1 + rest) * dot * bny; } }
      if (bny < -0.3) ball.onGround = true; hit = true;
    }
  }
  return hit;
}
function _pointInSlab(edges, x, y) { for (const e of edges) { if ((x - e.ax) * e.nx + (y - e.ay) * e.ny > 0) return false; } return true; }   // convex: inside iff behind every outward edge

function drawSetPieces() {
  const drawH = (h) => {
    if (!h || !h._overhangs) return;
    const mat = MATERIALS[currentCourse.defaultMaterial] || MATERIALS.grass;
    for (const pc of h._overhangs) {
      const p = pc.pts; ctx.beginPath(); ctx.moveTo(p[0].x, p[0].y); for (let i = 1; i < p.length; i++) ctx.lineTo(p[i].x, p[i].y); ctx.closePath();
      ctx.fillStyle = mat.color; ctx.fill();
    }
  };
  if (state === STATE_TRANSITION && currentHole > 0) drawH(holes[currentHole - 1]);
  drawH(holes[currentHole]);
}
