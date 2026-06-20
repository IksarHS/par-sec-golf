// ── water.js — water as its OWN system, not terrain (Phase W v2) ─────────────────────────────────────
// Real water pools and FLATTENS: a horizontal surface in a basin, never an angular slope. So water is
// decoupled from the heightfield: we detect deep basins in a hole, register a flat pool {x0,x1,surfaceY},
// render it as a flat translucent body with a SUBTLE animated surface, and treat it as a distinct HAZARD
// (ball touching the pool → splash → reshoot from the last safe rest). Peel-off: hooked from level-design
// (placeWater), desert-golfing.js drawWorld (drawWater) + collide (collideWater). Removing the file +
// hooks leaves the base game unchanged.

let _waters = [];          // [{x0, x1, surfaceY, hole}]
let _waterFrame = 0;
let _waterSafe = null;     // last ball rest OUTSIDE any water (reshoot target)

// scan a hole for the deepest basin; if deep enough + gated, register a flat pool that fills it ~to the rim
function placeWater(holeIndex) {
  if (holeIndex === 0) { _waters = []; _waterSafe = null; }      // fresh course
  if (typeof holes === 'undefined' || !holes[holeIndex] || typeof terrainYAt !== 'function') return;
  if (!(typeof currentCourse !== 'undefined' && currentCourse && currentCourse.gomWater)) return;
  const h = holes[holeIndex], teeX = h.teeX, cupX = h.cupX, span = cupX - teeX;
  if (span < 340) return;
  if (random() > 0.5) return;                                    // ~half the eligible holes get water
  // deepest basin (local low flanked by higher terrain on both sides), kept off the tee + cup
  let best = null;
  for (let x = teeX + span * 0.22; x < cupX - span * 0.20; x += 18) {
    const y = terrainYAt(x), depth = Math.min(y - terrainYAt(x - 95), y - terrainYAt(x + 95));
    if (depth > 55 && (!best || depth > best.depth)) best = { x: x, depth: depth, y: y };
  }
  if (!best) return;
  const rimL = terrainYAt(best.x - 110), rimR = terrainYAt(best.x + 110);
  const surfaceY = Math.min(rimL, rimR) + 6;                     // fill ~to the lower rim (flat lake)
  let x0 = best.x, x1 = best.x;
  while (x0 > teeX + 20 && terrainYAt(x0) > surfaceY) x0 -= 6;
  while (x1 < cupX - 20 && terrainYAt(x1) > surfaceY) x1 += 6;
  if (x1 - x0 < 26 || Math.abs((x0 + x1) / 2 - cupX) < 90) return;   // too small or under the cup
  // _ph = a per-pool phase so the settle ripple differs pool-to-pool; _t0 set on first reveal (see drawWater)
  _waters.push({ x0: x0, x1: x1, surfaceY: surfaceY, hole: holeIndex, _ph: (x0 * 0.013) % 6.283, _t0: null });
}

function isInWater(x) { for (const w of _waters) if (x >= w.x0 && x <= w.x1 && terrainYAt(x) > w.surfaceY) return true; return false; }

function drawWater() {
  if (typeof ctx === 'undefined' || !_waters.length || typeof vertices === 'undefined') return;
  _waterFrame++;
  ctx.fillStyle = 'rgba(74,150,210,0.88)';
  for (const w of _waters) {
    const sY = w.surfaceY;
    // settle-on-reveal: when the pool first comes on-screen, kick off a ripple that DECAYS to flat — the
    // "slosh a little before settling" from the sim, as a cheap decaying standing wave. VISUAL ONLY; the
    // hazard/physics use the flat sY (collideWater), so the harness stays deterministic.
    const vis = (typeof camera === 'undefined') || (w.x1 > camera.x && w.x0 < camera.x + W);
    if (w._t0 == null && vis) w._t0 = _waterFrame;
    const amp = w._t0 == null ? 0 : 6.5 * Math.exp(-(_waterFrame - w._t0) / 30);   // ~1.5s to settle flat
    const topY = (x) => (amp < 0.05) ? sY
      : sY + amp * (Math.sin(x * 0.06 + w._ph) + 0.55 * Math.sin(x * 0.028 - _waterFrame * 0.13 + w._ph));
    // FLUSH fill: bottom = exact terrain vertices (no stair-steps); top = the (rippling→flat) surface curve.
    const tv = [{ x: w.x0, y: terrainYAt(w.x0) }];
    for (let k = 0; k < vertices.length; k++) { const v = vertices[k]; if (v.x > w.x0 && v.x < w.x1) tv.push({ x: v.x, y: v.y }); }
    tv.push({ x: w.x1, y: terrainYAt(w.x1) });
    let poly = [];
    const fill = () => {
      if (poly.length < 2) { poly = []; return; }
      const xa = poly[0].x, xb = poly[poly.length - 1].x;
      ctx.beginPath(); ctx.moveTo(xa, topY(xa));
      if (amp >= 0.05) for (let x = xa + 4; x < xb; x += 4) ctx.lineTo(x, topY(x));   // wavy top while settling
      ctx.lineTo(xb, topY(xb));
      for (let j = poly.length - 1; j >= 0; j--) ctx.lineTo(poly[j].x, poly[j].y);     // exact terrain bottom
      ctx.closePath(); ctx.fill(); poly = [];
    };
    for (let i = 0; i < tv.length - 1; i++) {
      const a = tv[i], b = tv[i + 1], aB = a.y > sY, bB = b.y > sY;
      if (aB && bB) { if (!poly.length) poly.push(a); poly.push(b); }
      else if (aB && !bB) { if (!poly.length) poly.push(a); const t = (sY - a.y) / (b.y - a.y); poly.push({ x: a.x + (b.x - a.x) * t, y: sY }); fill(); }
      else if (!aB && bB) { const t = (sY - a.y) / (b.y - a.y); poly = [{ x: a.x + (b.x - a.x) * t, y: sY }, b]; }
    }
    fill();
    // surface highlight line (follows the rippling→flat top)
    ctx.strokeStyle = 'rgba(185,222,246,0.6)'; ctx.lineWidth = 2; ctx.beginPath();
    let pen = false;
    for (let x = w.x0; x <= w.x1; x += 4) {
      if (terrainYAt(x) > sY + 0.5) { const yy = topY(x) + Math.sin(x * 0.05 + _waterFrame * 0.05) * 0.8; if (!pen) { ctx.moveTo(x, yy); pen = true; } else ctx.lineTo(x, yy); }
      else pen = false;
    }
    ctx.stroke();
  }
}

// hazard: ball touching the pool surface = splash → reshoot from last safe. Also keeps _waterSafe fresh.
function collideWater() {
  if (typeof ball === 'undefined' || typeof currentHole === 'undefined') return false;
  let inWater = false;
  for (const w of _waters) {
    if (w.hole !== currentHole) continue;
    if (ball.x >= w.x0 && ball.x <= w.x1 && ball.y >= w.surfaceY - BALL_RADIUS && terrainYAt(ball.x) > w.surfaceY) { inWater = true; break; }
  }
  if (inWater) {
    const safe = _waterSafe || ((window.RG && RG._lastSafe) ? RG._lastSafe : { x: holes[currentHole].teeX });
    const sx = safe.x, sy = terrainYAt(sx) - BALL_RADIUS;
    ball.x = sx; ball.y = sy; ball.vx = 0; ball.vy = 0; ball.atRest = true; ball.onGround = true;
    if (typeof state !== 'undefined' && typeof STATE_AIM !== 'undefined') state = STATE_AIM;
    return true;
  }
  // remember a safe spot whenever the ball rests on land
  if (ball.atRest && !inWater) _waterSafe = { x: ball.x };
  return false;
}
