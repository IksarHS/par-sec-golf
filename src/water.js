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
  // SEA-LEVEL flood (water planets): one global water line → EVERYTHING below it floods into islands/
  // lagoons. The tee + cup greens sit above the line (dry); deep valleys become water the ball must carry.
  // `seaLevel` = px below the greens. drawWater/collideWater fill only columns where terrain dips below it.
  // WATER AS A MODIFIER on top of the generated terrain. The terrain is whatever the archetypes produced
  // (simple..complex, independent of water). Here we just pick a per-hole WATER LEVEL: how high the sea sits
  // below the tee/cup greens. Small margin → lots of water (everything below the greens floods); large
  // margin → a little (only the deepest pockets). Varied per hole → simple-hole-lots-of-water,
  // complex-hole-a-little, etc. Water complexity then emerges from terrain × level for free.
  if (typeof currentCourse !== 'undefined' && currentCourse && (currentCourse.floodWater || currentCourse.seaLevel != null)) {
    const hh = holes[holeIndex], teeX = hh.teeX, cupX = hh.cupX;
    const greensY = Math.max(terrainYAt(teeX + 5), hh.cupY);          // the higher of tee/cup → the waterline stays below it (greens dry)
    let deepest = greensY;
    for (let x = teeX; x <= cupX; x += 10) { const y = terrainYAt(x); if (y > deepest) deepest = y; }
    if (deepest - greensY < 32) return;                              // no basin below the greens → nothing to flood (dry hole)
    // per-hole WATER AMOUNT (the modifier): fraction of the basin depth that fills, varied around the
    // course bias. ~1 → floods up to the greens (lots of water); ~0 → only the deepest pocket (a little).
    const bias = currentCourse.waterBias != null ? currentCourse.waterBias : 0.55;
    let amt = Math.max(0.16, Math.min(0.92, bias + (random() - 0.5) * 0.5));
    const seaY = (currentCourse.seaLevel != null) ? Math.max(greensY + 8, greensY + currentCourse.seaLevel)
      : greensY + (deepest - greensY) * (1 - amt);
    _waters.push({ x0: teeX, x1: cupX, surfaceY: seaY, hole: holeIndex, _ph: (teeX * 0.013) % 6.283, _t0: null });
    return;
  }
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
  const camY = (typeof camera !== 'undefined') ? camera.y : 0;
  const botY = camY + H + 80;                 // fill PAST the screen bottom → no visible floor (deep sea / cavern)
  const surfCol = (typeof currentCourse !== 'undefined' && currentCourse && currentCourse.waterColor) || 'rgba(74,150,210,0.92)';
  const deepCol = (typeof currentCourse !== 'undefined' && currentCourse && currentCourse.waterDeep) || 'rgba(12,40,78,0.97)';
  for (const w of _waters) {
    const sY = w.surfaceY;
    // settle-on-reveal ripple (VISUAL ONLY; the hazard uses the flat sY → harness stays deterministic)
    const vis = (typeof camera === 'undefined') || (w.x1 > camera.x && w.x0 < camera.x + W);
    if (w._t0 == null && vis) w._t0 = _waterFrame;
    const amp = w._t0 == null ? 0 : 6.5 * Math.exp(-(_waterFrame - w._t0) / 30);
    const topY = (x) => (amp < 0.05) ? sY
      : sY + amp * (Math.sin(x * 0.06 + w._ph) + 0.55 * Math.sin(x * 0.028 - _waterFrame * 0.13 + w._ph));
    // DEEP fill: each wet span (terrain below the waterline) fills from the surface STRAIGHT DOWN to past the
    // screen bottom — a vertical gradient (surface tint → near-black deep) sells depth instead of a floor.
    const grad = ctx.createLinearGradient(0, sY, 0, camY + H);
    grad.addColorStop(0, surfCol); grad.addColorStop(1, deepCol);
    ctx.fillStyle = grad;
    const tv = [{ x: w.x0, y: terrainYAt(w.x0) }];
    for (let k = 0; k < vertices.length; k++) { const v = vertices[k]; if (v.x > w.x0 && v.x < w.x1) tv.push({ x: v.x, y: v.y }); }
    tv.push({ x: w.x1, y: terrainYAt(w.x1) });
    let a0 = null, b0 = null;
    const fill = () => {
      if (a0 == null) return;
      ctx.beginPath(); ctx.moveTo(a0, topY(a0));
      if (amp >= 0.05) for (let x = a0 + 4; x < b0; x += 4) ctx.lineTo(x, topY(x));   // rippling surface
      ctx.lineTo(b0, topY(b0));
      ctx.lineTo(b0, botY); ctx.lineTo(a0, botY);                                     // straight down → deep
      ctx.closePath(); ctx.fill(); a0 = null;
    };
    for (let i = 0; i < tv.length - 1; i++) {
      const a = tv[i], b = tv[i + 1], aB = a.y > sY, bB = b.y > sY;
      if (aB && bB) { if (a0 == null) a0 = a.x; b0 = b.x; }
      else if (aB && !bB) { if (a0 == null) a0 = a.x; b0 = a.x + (b.x - a.x) * ((sY - a.y) / (b.y - a.y)); fill(); }
      else if (!aB && bB) { a0 = a.x + (b.x - a.x) * ((sY - a.y) / (b.y - a.y)); b0 = b.x; }
    }
    fill();
    // surface highlight line
    ctx.strokeStyle = 'rgba(205,238,252,0.5)'; ctx.lineWidth = 2; ctx.beginPath();
    let pen = false;
    for (let x = w.x0; x <= w.x1; x += 4) {
      if (terrainYAt(x) > sY + 0.5) { const yy = topY(x); if (!pen) { ctx.moveTo(x, yy); pen = true; } else ctx.lineTo(x, yy); }
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
