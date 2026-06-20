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

// Build 0-2 overhang slabs for a hole. `complexity` 0..1 gates frequency/size. Deterministic via random().
function generateOverhangs(hole, complexity) {
  if (!hole || complexity == null || complexity < 0.5 || typeof terrainYAt !== 'function') return;
  const teeX = hole.teeX, cupX = hole.cupX, span = cupX - teeX; if (span < 240) return;
  const pieces = [];
  const want = (random() < (complexity - 0.45) * 1.3) ? (random() < (complexity - 0.6) ? 2 : 1) : 0;
  for (let k = 0; k < want; k++) {
    // span in the MIDDLE of the hole (never over the tee or the cup → cup approach stays open)
    const fx = 0.30 + (k * 0.30) + random() * 0.12;
    const x0 = teeX + span * fx, x1 = x0 + span * (0.14 + random() * 0.12 + complexity * 0.06);
    if (x1 > cupX - 90) continue;                       // keep clear of the cup green
    let floorTop = 1e9; for (let x = x0 - 10; x <= x1 + 10; x += 8) { const y = terrainYAt(x); if (y < floorTop) floorTop = y; }
    const gap = BALL_RADIUS * 4.5 + random() * 26;      // clearance so the ball can roll/loft UNDER it
    const th = 26 + random() * (30 + complexity * 40);
    const ceilB = floorTop - gap, ceilT = ceilB - th;
    if (ceilT < H * 0.08) continue;                     // don't poke off the top
    // a slightly trapezoidal slab so it reads angular, not a plain bar
    const lean = (random() - 0.5) * 26;
    const slab = [{ x: x0 + lean, y: ceilT }, { x: x1 + lean, y: ceilT }, { x: x1, y: ceilB }, { x: x0, y: ceilB }];
    pieces.push({ pts: slab, edges: _spEdges(slab) });
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
