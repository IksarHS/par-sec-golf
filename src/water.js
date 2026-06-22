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
let _splash = [];          // splash droplets {x,y,vx,vy,life,max}
let _ripples = [];         // expanding surface rings {x,y,r,life,max}

function _spawnSplash(x, y, power) {
  const n = 9 + Math.round(power * 6);
  for (let i = 0; i < n; i++) {
    const t = (i / (n - 1) - 0.5);                       // -0.5..0.5 across the fan
    const sp = (1.3 + Math.abs(t) * 2.4) * (0.8 + power * 0.5);
    _splash.push({ x, y, vx: t * 3.2, vy: -sp - 1.0, life: 0, max: 20 + (i % 5) * 5 });
  }
  _ripples.push({ x, y, r: 4, life: 0, max: 26 });
  _ripples.push({ x, y, r: 4, life: -7, max: 32 });     // a second ring, delayed
}

// scan a hole for the deepest basin; if deep enough + gated, register a flat pool that fills it ~to the rim
function placeWater(holeIndex) {
  if (holeIndex === 0) { _waters = []; _waterSafe = null; _splash = []; _ripples = []; }   // fresh course
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
    if (random() < (currentCourse.waterRarity != null ? currentCourse.waterRarity : 0.62)) return;   // water is RARE: most eligible holes stay dry
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
    // CALM, continuous surface: a small always-on gentle ripple — NOT a big decaying "settle-slosh" on reveal,
    // which read as a non-physical POP when a water hole spawned / scrolled into view. Subtle + smooth (±~2px).
    const topY = (x) => sY + 1.5 * Math.sin(x * 0.04 + w._ph + _waterFrame * 0.045)
                           + 0.7 * Math.sin(x * 0.018 - _waterFrame * 0.03 + w._ph);
    // DEEP fill: each wet span (terrain below the waterline) fills from the surface STRAIGHT DOWN to past the
    // screen bottom — a vertical gradient (surface tint → near-black deep) sells depth instead of a floor.
    const grad = ctx.createLinearGradient(0, sY, 0, camY + H);
    grad.addColorStop(0, surfCol); grad.addColorStop(1, deepCol);
    ctx.fillStyle = grad;
    const tv = [{ x: w.x0, y: terrainYAt(w.x0) }];
    for (let k = 0; k < vertices.length; k++) { const v = vertices[k]; if (v.x > w.x0 && v.x < w.x1) tv.push({ x: v.x, y: v.y }); }
    tv.push({ x: w.x1, y: terrainYAt(w.x1) });
    // CONFORM TO THE BASIN: each wet run fills from the water surface (top) DOWN TO THE TERRAIN FLOOR (bottom),
    // so the pool SETTLES into the basin instead of dropping straight past the screen and covering the walls
    // (the old "deep-sea, no floor" look read as water sitting ON TOP of a V). A genuinely deep basin still reads
    // deep — its floor is simply off-screen, so the fill (and the surface→deep gradient) still runs past the view.
    let run = [];                                          // terrain points of the current submerged run (+ sY crossings)
    const flush = () => {
      if (run.length < 2) { run = []; return; }
      const rx0 = run[0].x, rx1 = run[run.length - 1].x;
      ctx.beginPath();
      ctx.moveTo(rx0, topY(rx0));
      for (let x = rx0 + 4; x < rx1; x += 4) ctx.lineTo(x, topY(x));                    // gentle rippling surface (top)
      ctx.lineTo(rx1, topY(rx1));
      for (let k = run.length - 1; k >= 0; k--) ctx.lineTo(run[k].x, run[k].y);          // trace the terrain floor back (bottom)
      ctx.closePath(); ctx.fill();
      run = [];
    };
    for (let i = 0; i < tv.length - 1; i++) {
      const a = tv[i], b = tv[i + 1], aB = a.y > sY, bB = b.y > sY;
      const cross = () => a.x + (b.x - a.x) * ((sY - a.y) / (b.y - a.y));               // x where terrain meets the waterline
      if (aB && bB) { if (!run.length) run.push({ x: a.x, y: a.y }); run.push({ x: b.x, y: b.y }); }
      else if (aB && !bB) { if (!run.length) run.push({ x: a.x, y: a.y }); run.push({ x: cross(), y: sY }); flush(); }
      else if (!aB && bB) { run = [{ x: cross(), y: sY }, { x: b.x, y: b.y }]; }
    }
    flush();
    // surface highlight line
    ctx.strokeStyle = 'rgba(205,238,252,0.5)'; ctx.lineWidth = 2; ctx.beginPath();
    let pen = false;
    for (let x = w.x0; x <= w.x1; x += 4) {
      if (terrainYAt(x) > sY + 0.5) { const yy = topY(x); if (!pen) { ctx.moveTo(x, yy); pen = true; } else ctx.lineTo(x, yy); }
      else pen = false;
    }
    ctx.stroke();
  }
  // splash droplets + expanding ripples (water-entry juice)
  for (let i = _ripples.length - 1; i >= 0; i--) {
    const r = _ripples[i]; r.life++; if (r.life < 0) continue; r.r += 1.7;
    if (r.life > r.max) { _ripples.splice(i, 1); continue; }
    ctx.strokeStyle = 'rgba(200,232,248,' + (1 - r.life / r.max) * 0.3 + ')'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.ellipse(r.x, r.y, r.r, r.r * 0.38, 0, 0, 6.283); ctx.stroke();
  }
  for (let i = _splash.length - 1; i >= 0; i--) {
    const p = _splash[i]; p.life++; p.vy += 0.16; p.x += p.vx; p.y += p.vy;
    if (p.life > p.max) { _splash.splice(i, 1); continue; }
    ctx.fillStyle = 'rgba(155,212,242,' + (1 - p.life / p.max) * 0.6 + ')';
    ctx.fillRect(p.x - 1.25, p.y - 1.25, 2.5, 2.5);
  }
}

// hazard: the ball PLOPS into the water (splash + a short sink with water drag), then goes out of bounds —
// reshoot from the last safe rest. Keeps _waterSafe fresh on land rests.
function collideWater() {
  if (typeof ball === 'undefined' || typeof currentHole === 'undefined') return false;
  let wreg = null;
  for (const w of _waters) {
    if (w.hole !== currentHole) continue;
    if (ball.x >= w.x0 && ball.x <= w.x1 && ball.y >= w.surfaceY - BALL_RADIUS && terrainYAt(ball.x) > w.surfaceY) { wreg = w; break; }
  }
  if (wreg) {
    if (ball._waterT == null) {                          // moment of entry → splash sized to impact speed
      ball._waterT = 0;
      const spd = Math.min(2, Math.hypot(ball.vx || 0, ball.vy || 0) / 7);
      _spawnSplash(ball.x, wreg.surfaceY, spd);
    }
    ball._waterT++;
    ball.vx *= 0.68; ball.vy = ball.vy * 0.5 + 0.55;     // water physics: heavy drag, slow sink
    ball.atRest = false; ball.onGround = false;
    if (ball._waterT >= 13) {                            // sunk → out of bounds, reshoot from last safe
      const safe = _waterSafe || ((window.RG && RG._lastSafe) ? RG._lastSafe : { x: holes[currentHole].teeX });
      const sx = safe.x, sy = terrainYAt(sx) - BALL_RADIUS;
      ball.x = sx; ball.y = sy; ball.vx = 0; ball.vy = 0; ball.atRest = true; ball.onGround = true;
      if (typeof state !== 'undefined' && typeof STATE_AIM !== 'undefined') state = STATE_AIM;
      ball._waterT = null;
    }
    return true;
  }
  ball._waterT = null;
  if (ball.atRest) _waterSafe = { x: ball.x };           // remember the last dry rest
  return false;
}
