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
  _waters.push({ x0: x0, x1: x1, surfaceY: surfaceY, hole: holeIndex });
}

function isInWater(x) { for (const w of _waters) if (x >= w.x0 && x <= w.x1) return true; return false; }

function drawWater() {
  if (typeof ctx === 'undefined' || !_waters.length) return;
  _waterFrame++;
  for (const w of _waters) {
    // flat top at surfaceY [x0..x1]; bottom follows the terrain → a flat-topped pool conforming to the basin
    ctx.beginPath();
    ctx.moveTo(w.x0, w.surfaceY); ctx.lineTo(w.x1, w.surfaceY);
    for (let x = w.x1; x >= w.x0; x -= 6) ctx.lineTo(x, Math.max(w.surfaceY, terrainYAt(x)));
    ctx.closePath();
    ctx.fillStyle = 'rgba(74,150,210,0.86)'; ctx.fill();
    // subtle animated surface — a soft shimmer line gently rippling along the top
    ctx.strokeStyle = 'rgba(175,215,240,0.65)'; ctx.lineWidth = 2; ctx.beginPath();
    for (let x = w.x0; x <= w.x1; x += 5) {
      const yy = w.surfaceY + Math.sin(x * 0.05 + _waterFrame * 0.06) * 1.6 + Math.sin(x * 0.013 - _waterFrame * 0.03) * 1.2;
      if (x === w.x0) ctx.moveTo(x, yy); else ctx.lineTo(x, yy);
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
    if (ball.x >= w.x0 && ball.x <= w.x1 && ball.y >= w.surfaceY - BALL_RADIUS) { inWater = true; break; }
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
