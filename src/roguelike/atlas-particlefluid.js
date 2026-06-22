// ── atlas-particlefluid.js — PARTICLE FLUID (Position-Based Fluids, on a real hole) ─────────────────
// The HEAVY-DUTY fluid, IN the game on a real generated hole. Where atlas-watersim.js runs a HEIGHT-FIELD
// (one water level per column — fast, but it CANNOT fill under an overhang and reads blocky in a narrow
// notch), this mode runs a real 2D PARTICLE FLUID — Position-Based Fluids (Macklin & Müller 2013): a
// spatial-hash neighbour grid, a density constraint solved with a few relaxation iterations per frame,
// gravity, and light XSPH viscosity. The particles collide with the REAL engine terrain (terrainYAt
// push-out) AND with a floating SOLID block, so they settle FLUSH into ANY bounded space — a narrow deep
// notch, varied basins, and the POCKET UNDER AN OVERHANG (the money demo a height-field literally can't do)
// — self-leveling like real water.
//
//   • POUR  — click / click-and-HOLD above the terrain → a stream of particles (capture-phase input, so a
//             press near the ball still starts the normal drag-aim shot, exactly like atlas-watersim).
//   • BALL  — the real engine ball (normal drag-aim) pushes particles, splashes, and sinks into the fluid.
//   • CLEAR — wipe all particles.
//   • RENDER — a SMOOTH METABALL surface: each particle is a soft radial blob, summed into an offscreen
//             buffer and thresholded/clipped into one smooth water body (water blue #3a7ec8 + a lighter
//             #9bd4f2 highlight), NOT loose dots — drawn in WORLD space so it sits flush in the terrain.
//
// Built on the engine's inert atlas hooks (NO core edits): RG_ATLAS.register + camera()/collide()/frame()/
// frameScreen()/drawSkyBehind(). The floating block collides via the same collide() hook as atlas-blocks.
// Gated on RG.course === 'particlefluid' — every hook no-ops on any other course; peel the file + its
// <script> tag (+ the index.html launcher) and the base game is byte-for-byte unchanged.
(function () {
  if (typeof window === 'undefined' || !window.RG_ATLAS) return;
  var A = window.RG_ATLAS;
  var ID = 'particlefluid';

  function isPF() { return !!(window.RG && RG.course === ID); }
  function H_() { return (typeof H !== 'undefined') ? H : 540; }
  function W_() { return (typeof W !== 'undefined') ? W : 960; }

  // ── PALETTE ──
  var WATER = '#3a7ec8', HILITE = '#9bd4f2', DEEP = '#1c4f8a', DROP = '#bfe6ff', POUR = 'rgba(150,205,240,0.92)';
  var RUST = '#b76b38', RUST_LT = '#d18a52';

  // ── THE TEST HOLE — a narrow deep notch + varied basins (the watersim_basins family), with the cup on a
  // dry green at the far end. The notch is the user's exact failing case; the basins show self-leveling.
  if (typeof archetypes !== 'undefined' && !archetypes.pfluid_basins) {
    archetypes.pfluid_basins = function (sx, sy, dist, cupY, diff) {
      var span = dist;
      // {f: centre frac of the span, w: width px, d: depth px}
      var BAS = [
        { f: 0.14, w: 80, d: 130 },   // wide shallow-ish basin (left)
        { f: 0.30, w: 16, d: 215 },   // ★ NARROW DEEP NOTCH — the money case (very thin, very deep)
        { f: 0.46, w: 58, d: 120 },   // medium pit (under the overhang block — see OVERHANG below)
        { f: 0.66, w: 40, d: 175 },   // narrow deep well
        { f: 0.83, w: 70, d: 100 }    // broad shallow dish (right)
      ];
      var basins = BAS.map(function (b) { return { cx: sx + span * b.f, w: b.w, d: b.d }; });
      function gy(x) {
        var y = sy + Math.sin((x - sx) * 0.010) * 14;       // gentle rolling baseline
        for (var i = 0; i < basins.length; i++) {
          var b = basins[i], t = (x - b.cx) / b.w;
          y += b.d * Math.exp(-t * t * 1.8);                // dig the basin (down = +y)
        }
        return clampY(y);
      }
      var verts = [];
      var greenStart = sx + dist - 110;
      // fine vertex step so the NARROW notch's walls are captured (a coarse step would round it off)
      for (var x = sx; x < greenStart; x += 8) verts.push({ x: x, y: gy(x) });
      var greenY = clampY(sy + 8);
      verts.push({ x: greenStart, y: greenY });
      verts.push({ x: sx + dist, y: greenY });
      return verts;
    };
    if (typeof ARCHETYPE_TABLE !== 'undefined') ARCHETYPE_TABLE.push(['pfluid_basins', 0.0, 5.0, 1]);
  }

  // ════════════════════════════════════════════════════════════════════════════════════════════════════
  //  THE FLOATING OVERHANG BLOCK (the money demo — a height-field CANNOT fill under this)
  //  A solid AABB floating over basin #3 (f≈0.46), forming an overhang/pocket: particles flow in from the
  //  open left side and POOL UNDER the slab, filling the pocket above where a height-field would clip. The
  //  ball collides with it too (circle-vs-AABB, mirrors atlas-blocks.js). Built once the hole exists.
  // ════════════════════════════════════════════════════════════════════════════════════════════════════
  var blocks = [];                          // [{x,y,w,h}] solid AABBs (world coords)
  function buildBlocks() {
    blocks = [];
    var h = hole(); if (!h) return;
    var span = h.cupX - h.teeX;
    // the slab sits a little ABOVE the basin floor at f≈0.46, leaving a pocket beneath it. Its LEFT edge is
    // open (particles flow in), its underside + right edge are closed → the fluid pools up under the slab.
    var bx = h.teeX + span * 0.40;
    var bw = span * 0.135;
    var floorY = terrainYAt(h.teeX + span * 0.46);          // the basin floor under the slab
    var by = floorY - 120;                                  // slab underside ~120px above the floor → a fillable pocket
    blocks.push({ x: bx, y: by, w: bw, h: 22 });
    // a short right WALL hanging down from the slab's right end, so the pocket is closed on the right and
    // the fluid is TRAPPED under the slab (otherwise it would just sheet out the right side and not pool).
    blocks.push({ x: bx + bw - 14, y: by, w: 14, h: 86 });
  }

  // ════════════════════════════════════════════════════════════════════════════════════════════════════
  //  POSITION-BASED FLUIDS (Macklin & Müller 2013)
  //  Per frame: predict positions under gravity → build a spatial hash → solve the density constraint with
  //  a few Jacobi relaxation iterations (compute λ per particle, then position corrections from neighbours)
  //  → collide against terrain + the solid blocks → derive velocity from the position change → apply XSPH
  //  viscosity. Tuned for a smooth framerate at ~480 particles.
  // ════════════════════════════════════════════════════════════════════════════════════════════════════
  var P = [];                               // particles: {x,y,px,py,vx,vy,lx,ly,lam}
  var MAXP = 560;                           // hard cap (perf): pours stop adding past this
  var Hk = 13;                              // SPH smoothing radius (px) — also the spatial-hash cell size. SMALL → particles pack tight & POOL DEEP (a bigger radius spreads them into a thin sheet)
  var H2 = Hk * Hk;
  var SPACING = 6.0;                        // target rest spacing (px) — rest density is computed from this so the fluid settles to a definite, incompressible packing (not a thin film)
  var REST = 0.0;                           // rest density (computed from SPACING on build)
  var REST_SET = false;
  var SOLVE_ITERS = 4;                      // density-constraint relaxation iterations per frame
  var EPS_REL = 80.0;                       // CFM relaxation (softens the constraint → stable)
  var GRAV = 0.40;                          // gravity per frame (px/frame²) — engine-feel, not engine GRAVITY
  var VISC = 0.020;                         // XSPH viscosity coefficient (light) — enough cohesion that pools hold together
  var DAMP = 0.992;                         // velocity damping
  var VMAX = 14;                            // velocity clamp (px/frame) — tight, so the solver never ejects a particle into the sky
  // s_corr (artificial pressure — removes clustering / surface tension clumping)
  var KCORR = 0.0008, NCORR = 4, QCORR = 0.2;
  var WPOLY6, WSPIKY, WQ;                   // kernel normalisation + the s_corr reference value (set on build)

  var built = false, frame = 0, hint = 360;
  var drops = [], pourStreams = [];
  var fieldX0 = 0, fieldX1 = 0;             // world-x bounds of the play field

  function hole() { return (typeof holes !== 'undefined') ? holes[(typeof currentHole !== 'undefined') ? currentHole : 0] : null; }

  // Poly6 kernel W(r) and Spiky gradient ∇W(r) (2D forms), precomputed normalisation.
  // spikyGrad returns the SCALAR factor s such that ∇W(p_i-p_j) = s·(p_i-p_j). The spiky kernel
  // DECREASES with r, so W'(r) is NEGATIVE → s = W'(r)/r is negative → ∇W points from i toward j. This
  // sign is load-bearing: with it, a COMPRESSED pair (λ<0) gets pushed APART (incompressibility → the
  // fluid holds volume and POOLS); flipped, compressed particles would ATTRACT and the fluid collapses
  // into a clinging film. (W'(r) = -45/(π h^6)(h-r)² in 2D.)
  function poly6(r2) { if (r2 >= H2) return 0; var d = H2 - r2; return WPOLY6 * d * d * d; }
  function spikyGrad(r) { if (r <= 1e-6 || r >= Hk) return 0; var d = Hk - r; return -WSPIKY * d * d / r; } // = W'(r)/r (negative) — multiply by (dx,dy) for ∇W

  function buildKernels() {
    // 2D normalisations: Poly6 = 4/(π h^8), Spiky gradient W'(r) = -45/(π h^6)(h-r)²
    WPOLY6 = 4 / (Math.PI * Math.pow(Hk, 8));
    WSPIKY = 45 / (Math.PI * Math.pow(Hk, 6));
    WQ = poly6((QCORR * Hk) * (QCORR * Hk));   // reference for the s_corr artificial-pressure term
  }

  function buildField() {
    var h = hole();
    if (!h || typeof terrainYAt !== 'function') { built = false; return; }
    fieldX0 = h.teeX - 20; fieldX1 = h.cupX + 20;
    buildKernels();
    buildBlocks();
    P = []; drops = []; pourStreams = []; REST_SET = false; built = true;
  }
  function clearFluid() { P = []; drops = []; pourStreams = []; REST_SET = false; }

  // ── SPATIAL HASH (uniform grid, cell = smoothing radius) ──
  var grid = null, gW = 0, gH = 0, gx0 = 0, gy0 = 0;
  function rebuildGrid() {
    if (!P.length) { grid = null; return; }
    var minx = 1e9, miny = 1e9, maxx = -1e9, maxy = -1e9;
    for (var i = 0; i < P.length; i++) {
      var p = P[i];
      if (p.x < minx) minx = p.x; if (p.x > maxx) maxx = p.x;
      if (p.y < miny) miny = p.y; if (p.y > maxy) maxy = p.y;
    }
    gx0 = minx - Hk; gy0 = miny - Hk;
    gW = Math.max(1, Math.ceil((maxx - minx + 2 * Hk) / Hk));
    gH = Math.max(1, Math.ceil((maxy - miny + 2 * Hk) / Hk));
    if (gW * gH > 200000) { grid = null; return; }       // safety: degenerate spread → skip hashing this frame
    grid = new Array(gW * gH);
    for (var c = 0; c < grid.length; c++) grid[c] = null;
    for (var k = 0; k < P.length; k++) {
      var q = P[k];
      var cx = Math.floor((q.x - gx0) / Hk), cy = Math.floor((q.y - gy0) / Hk);
      if (cx < 0) cx = 0; if (cx >= gW) cx = gW - 1; if (cy < 0) cy = 0; if (cy >= gH) cy = gH - 1;
      var ci = cy * gW + cx;
      q._g = ci;
      if (!grid[ci]) grid[ci] = [];
      grid[ci].push(k);
    }
  }
  // call fn(j) for every particle index j whose cell is within the 3×3 block around particle i.
  function forNeighbors(i, fn) {
    if (!grid) { for (var j = 0; j < P.length; j++) if (j !== i) fn(j); return; }
    var p = P[i];
    var cx = Math.floor((p.x - gx0) / Hk), cy = Math.floor((p.y - gy0) / Hk);
    for (var oy = -1; oy <= 1; oy++) for (var ox = -1; ox <= 1; ox++) {
      var nx = cx + ox, ny = cy + oy;
      if (nx < 0 || ny < 0 || nx >= gW || ny >= gH) continue;
      var cell = grid[ny * gW + nx];
      if (!cell) continue;
      for (var m = 0; m < cell.length; m++) { var j = cell[m]; if (j !== i) fn(j); }
    }
  }

  // ── COLLISION: push a particle out of terrain (below the heightfield surface) + out of solid blocks ──
  function collideParticle(p) {
    // walls of the play field (so a pour near the edge doesn't leak off-world)
    if (p.x < fieldX0) { p.x = fieldX0; if (p.vx < 0) p.vx *= -0.3; }
    if (p.x > fieldX1) { p.x = fieldX1; if (p.vx > 0) p.vx *= -0.3; }
    // TERRAIN: if below the surface, push up to the surface (terrainYAt = ground Y at this x).
    var gY = terrainYAt(p.x);
    if (p.y > gY) {
      p.y = gY;
      // approximate the surface normal from the local slope so particles slide along sloped walls/floors.
      var s = (terrainYAt(p.x + 3) - terrainYAt(p.x - 3)) / 6;   // dY/dX
      var nlen = Math.hypot(s, 1), nxn = -s / nlen, nyn = -1 / nlen;  // outward normal (points up out of ground)
      var vn = p.vx * nxn + p.vy * nyn;
      if (vn < 0) { p.vx -= vn * nxn; p.vy -= vn * nyn; }   // project out the into-surface velocity (no bounce) → keeps the tangential (downhill) component so fluid RUNS down slopes into the basins
    }
    // SOLID BLOCKS (the overhang slab + its right wall): circle(point)-vs-AABB push-out.
    for (var b = 0; b < blocks.length; b++) {
      var B = blocks[b];
      if (p.x > B.x && p.x < B.x + B.w && p.y > B.y && p.y < B.y + B.h) {
        // nearest exit edge
        var dl = p.x - B.x, dr = B.x + B.w - p.x, dt = p.y - B.y, db = B.y + B.h - p.y;
        var mn = Math.min(dl, dr, dt, db);
        if (mn === dt) { p.y = B.y; if (p.vy > 0) p.vy *= -0.2; }
        else if (mn === db) { p.y = B.y + B.h; if (p.vy < 0) p.vy *= -0.2; }
        else if (mn === dl) { p.x = B.x; if (p.vx > 0) p.vx *= -0.2; }
        else { p.x = B.x + B.w; if (p.vx < 0) p.vx *= -0.2; }
      }
    }
  }

  // ── one PBF step ──
  function stepFluid() {
    if (!built) return;
    frame++;
    // feed pour streams
    for (var s = pourStreams.length - 1; s >= 0; s--) { var ps = pourStreams[s]; ps.t++; spawnAt(ps.x, ps.y); if (ps.t > 2) pourStreams.splice(s, 1); }
    if (heldPour) addPourStream(heldPour.x, heldPour.y);
    if (!P.length) { stepDrops(); return; }

    var i, j, p, q;
    // 1) apply gravity + predict positions
    for (i = 0; i < P.length; i++) {
      p = P[i];
      p.vy += GRAV;
      p.vx *= DAMP; p.vy *= DAMP;
      var vlen = Math.hypot(p.vx, p.vy); if (vlen > VMAX) { var sc = VMAX / vlen; p.vx *= sc; p.vy *= sc; }
      p.px = p.x; p.py = p.y;                 // remember pre-prediction (for velocity derivation)
      p.x += p.vx; p.y += p.vy;
    }
    rebuildGrid();

    // REST DENSITY — calibrate ONCE from the fluid itself: the density a well-packed interior particle
    // actually reaches. We take a high percentile (not the max → ignores a few momentarily-crushed
    // outliers) of sampled densities, so the constraint targets the real settled packing → the fluid is
    // incompressible at that density and POOLS to a definite depth (a too-low target makes every particle
    // read as over-compressed → it repels into a thin clinging film).
    if (!REST_SET && P.length > 120) {
      var samp = [];
      for (i = 0; i < P.length; i += 3) {
        var rho = poly6(0);
        (function (pi) { forNeighbors(pi, function (jj) { var dx = P[pi].x - P[jj].x, dy = P[pi].y - P[jj].y; rho += poly6(dx * dx + dy * dy); }); })(i);
        samp.push(rho);
      }
      samp.sort(function (a, b) { return a - b; });
      // Target the DENSEST observed packing (~95th percentile): the constraint then drives the fluid to
      // pack at least that tight → particles STACK into deep pools instead of resting as a 1-thick film
      // (a target calibrated from the loose film makes the film itself the rest state → no pooling).
      REST = (samp[Math.floor(samp.length * 0.95)] || poly6(0) * 8) * 1.0;
      REST_SET = true;
    }

    // 2) constraint solve (Jacobi relaxation)
    for (var iter = 0; iter < SOLVE_ITERS; iter++) {
      // 2a) density + λ
      for (i = 0; i < P.length; i++) {
        p = P[i];
        var rho = poly6(0);
        var gradXi = 0, gradYi = 0, sumGrad2 = 0;
        (function (pi) {
          forNeighbors(pi, function (jj) {
            q = P[jj];
            var dx = p.x - q.x, dy = p.y - q.y, r2 = dx * dx + dy * dy;
            if (r2 >= H2) return;
            rho += poly6(r2);
            var r = Math.sqrt(r2);
            var g = spikyGrad(r);                  // |∇W|/r factor
            var gx = g * dx, gy = g * dy;          // ∇_pj C contribution (toward i)
            gradXi += gx; gradYi += gy;
            sumGrad2 += (gx * gx + gy * gy);        // |∇_pj C|² over neighbours
          });
        })(i);
        var Ci = rho / (REST || 1) - 1;
        sumGrad2 += gradXi * gradXi + gradYi * gradYi;   // + |∇_pi C|²
        p.lam = -Ci / (sumGrad2 + EPS_REL);
      }
      // 2b) position corrections Δp
      for (i = 0; i < P.length; i++) {
        p = P[i];
        var dpx = 0, dpy = 0;
        (function (pi) {
          forNeighbors(pi, function (jj) {
            q = P[jj];
            var dx = p.x - q.x, dy = p.y - q.y, r2 = dx * dx + dy * dy;
            if (r2 >= H2) return;
            var r = Math.sqrt(r2);
            var g = spikyGrad(r);
            // s_corr artificial pressure (anti-clustering)
            var w = poly6(r2), ratio = WQ > 0 ? (w / WQ) : 0;
            var scorr = -KCORR * Math.pow(ratio, NCORR);
            var coef = (p.lam + q.lam + scorr) * g;
            dpx += coef * dx; dpy += coef * dy;
          });
        })(i);
        dpx /= (REST || 1); dpy /= (REST || 1);
        // clamp the per-iter correction so a bad λ can't explode a particle
        var dl = Math.hypot(dpx, dpy); if (dl > 4) { var sc2 = 4 / dl; dpx *= sc2; dpy *= sc2; }
        p.x += dpx; p.y += dpy;
        collideParticle(p);
      }
    }

    // 3) derive velocity from the net position change, apply ball push, re-collide
    for (i = 0; i < P.length; i++) {
      p = P[i];
      p.vx = (p.x - p.px); p.vy = (p.y - p.py);
      ballPush(p);
      collideParticle(p);
    }

    // 4) XSPH viscosity (smooth velocities toward neighbour average → cohesive sheet, not jittery dots)
    for (i = 0; i < P.length; i++) {
      p = P[i];
      var ax = 0, ay = 0;
      (function (pi) {
        forNeighbors(pi, function (jj) {
          q = P[jj];
          var dx = p.x - q.x, dy = p.y - q.y, r2 = dx * dx + dy * dy;
          if (r2 >= H2) return;
          var w = poly6(r2);
          ax += (q.vx - p.vx) * w; ay += (q.vy - p.vy) * w;
        });
      })(i);
      p.vx += VISC * ax; p.vy += VISC * ay;
    }

    stepDrops();
  }

  // ── pour: spawn particles from a stream point above the terrain ──
  function spawnAt(x, y) {
    if (P.length >= MAXP) return;
    var n = 3;
    for (var k = 0; k < n; k++) {
      if (P.length >= MAXP) break;
      // tight horizontal jitter so a stream drops cleanly INTO a narrow notch instead of splattering wide
      var jx = x + (Math.random() - 0.5) * 4, jy = y + (Math.random() - 0.5) * 4;
      P.push({ x: jx, y: jy, px: jx, py: jy, vx: (Math.random() - 0.5) * 0.4, vy: 1.4 + Math.random() * 0.8, lam: 0 });
    }
    if (Math.random() < 0.4) drops.push({ x: x + (Math.random() - 0.5) * 8, y: y, vx: (Math.random() - 0.5) * 1.5, vy: 0.5, life: 0, max: 18, sz: 1.3 + Math.random() });
  }
  function addPourStream(x, y) { if (!built) return; pourStreams.push({ x: x, y: Math.min(y, terrainYAt(x) - 6), t: 0 }); }

  // airborne pour droplets (cosmetic spray)
  function stepDrops() {
    for (var i = drops.length - 1; i >= 0; i--) {
      var d = drops[i]; d.life++; d.vy += 0.3; d.x += d.vx; d.y += d.vy;
      if (d.life > d.max || d.y > terrainYAt(d.x)) drops.splice(i, 1);
    }
  }

  // ════════════════════════════════════════════════════════════════════════════════════════════════════
  //  BALL ↔ FLUID — the real engine ball pushes particles, splashes, and sinks
  // ════════════════════════════════════════════════════════════════════════════════════════════════════
  var BALL_INFLU = 22;                       // ball influence radius (px)
  function ballPush(p) {
    if (typeof ball === 'undefined') return;
    var dx = p.x - ball.x, dy = p.y - ball.y, d2 = dx * dx + dy * dy;
    if (d2 > BALL_INFLU * BALL_INFLU || d2 < 1e-4) return;
    var d = Math.sqrt(d2), nx = dx / d, ny = dy / d, pen = BALL_INFLU - d;
    p.x += nx * pen * 0.5; p.y += ny * pen * 0.5;            // shove the particle outside the ball
    var bvx = ball.vx || 0, bvy = ball.vy || 0;
    p.vx += nx * 0.4 + bvx * 0.18; p.vy += ny * 0.4 + bvy * 0.18;   // impart ball momentum (splash)
  }

  // sink hazard: deep submersion → drag the ball + reshoot from the last dry rest (mirrors atlas-watersim).
  var sinkT = null, lastSafeX = null;
  var SUBMERGE_N = 5;                          // # of particles overlapping the ball that counts as "in fluid"
  function ballFluid() {
    if (!built || typeof ball === 'undefined') return false;
    var BR = (typeof BALL_RADIUS !== 'undefined') ? BALL_RADIUS : 4;
    // count particles within ~ball radius and find the local fluid-surface height (min y = highest)
    var over = 0, surf = 1e9, dxc = 0;
    for (var i = 0; i < P.length; i++) {
      var p = P[i], dx = p.x - ball.x, dy = p.y - ball.y;
      if (Math.abs(dx) < BR + 10 && Math.abs(dy) < BR + 18) { over++; if (p.y < surf) surf = p.y; dxc += dx; }
    }
    if (over >= SUBMERGE_N && ball.y + BR >= surf) {
      if (sinkT == null) { var spd = Math.hypot(ball.vx || 0, ball.vy || 0); splash(ball.x, ball.y, spd); sinkT = 0; }
      sinkT++;
      ball.vx *= 0.74; ball.vy = ball.vy * 0.6 + 0.35;        // fluid drag, slow sink
      ball.atRest = false; ball.onGround = false;
      if (sinkT >= 16) {                                       // sunk → reshoot from last dry rest
        var sx = (lastSafeX != null) ? lastSafeX : (hole() ? hole().teeX : ball.x);
        ball.x = sx; ball.y = terrainYAt(sx) - BR; ball.vx = 0; ball.vy = 0; ball.atRest = true; ball.onGround = true;
        if (typeof state !== 'undefined' && typeof STATE_AIM !== 'undefined') state = STATE_AIM;
        sinkT = null;
      }
      return true;
    }
    sinkT = null;
    if (ball.atRest && over < SUBMERGE_N) lastSafeX = ball.x;  // remember last dry rest
    return false;
  }
  function splash(x, y, speed) {
    speed = Math.min(speed, 18);
    var n = Math.round(5 + speed);
    for (var d = 0; d < n; d++) {
      var a = -Math.PI / 2 + (Math.random() - 0.5) * 1.8, sp = 1 + Math.random() * speed * 0.5;
      drops.push({ x: x + (Math.random() - 0.5) * 14, y: y - 3, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 1.2, life: 0, max: 20 + Math.random() * 14, sz: 1.5 + Math.random() * 2 });
    }
  }

  // ── BALL vs the SOLID overhang BLOCK (circle-vs-AABB; mirrors atlas-blocks.js) — so the ball can rest
  //    on the slab / be stopped by the wall, same as the fluid. Side-effect; returns "onTop". ──
  function ballBlocks() {
    if (typeof ball === 'undefined' || !blocks.length) return false;
    var BR = (typeof BALL_RADIUS !== 'undefined') ? BALL_RADIUS : 4;
    var rest = 0.3, onTop = false;
    for (var i = 0; i < blocks.length; i++) {
      var pl = blocks[i];
      var qx = Math.max(pl.x, Math.min(ball.x, pl.x + pl.w));
      var qy = Math.max(pl.y, Math.min(ball.y, pl.y + pl.h));
      var dx = ball.x - qx, dy = ball.y - qy, d2 = dx * dx + dy * dy;
      if (d2 >= BR * BR) continue;
      var nx, ny, pen;
      if (d2 < 1e-4) {
        var L = ball.x - pl.x, Rr = pl.x + pl.w - ball.x, T = ball.y - pl.y, Bm = pl.y + pl.h - ball.y;
        var m = Math.min(L, Rr, T, Bm);
        if (m === T) { nx = 0; ny = -1; pen = T + BR; }
        else if (m === Bm) { nx = 0; ny = 1; pen = Bm + BR; }
        else if (m === L) { nx = -1; ny = 0; pen = L + BR; }
        else { nx = 1; ny = 0; pen = Rr + BR; }
      } else { var d = Math.sqrt(d2); nx = dx / d; ny = dy / d; pen = BR - d; }
      ball.x += nx * pen; ball.y += ny * pen;
      var dot = ball.vx * nx + ball.vy * ny;
      if (dot < 0) { ball.vx -= (1 + rest) * dot * nx; ball.vy -= (1 + rest) * dot * ny; }
      if (ny < -0.5) { onTop = true; ball.onGround = true; }
    }
    return onTop;
  }

  // ════════════════════════════════════════════════════════════════════════════════════════════════════
  //  METABALL RENDER — soft radial blobs → threshold/clip into one smooth water body (in WORLD space)
  //  We rasterize each particle as a soft radial blob into an OFFSCREEN buffer (additive alpha), then read
  //  it back through an alpha THRESHOLD: pixels above the threshold become solid water, the rest clear —
  //  one smooth surface, not loose dots. The buffer is in SCREEN space (so it's cheap, screen-sized); the
  //  drawSkyBehind hook is screen-space too, so the body lands BEHIND the terrain → the opaque terrain
  //  occludes it → the fluid shows only in open bounded space, FLUSH to every wall/floor (and trapped under
  //  the overhang slab, which we draw on top in frame()).
  // ════════════════════════════════════════════════════════════════════════════════════════════════════
  var buf = null, bctx = null, BUFW = 0, BUFH = 0, BSCALE = 0.5;   // half-res field for speed
  function ensureBuf() {
    var w = Math.ceil(W_() * BSCALE), h = Math.ceil(H_() * BSCALE);
    if (!buf || BUFW !== w || BUFH !== h) {
      buf = document.createElement('canvas'); buf.width = w; buf.height = h;
      bctx = buf.getContext('2d', { willReadFrequently: true }); BUFW = w; BUFH = h;
    }
  }
  // world → screen (mirror wrap.applyCameraTransform with RG._zoom defaulting to 1)
  function worldToScreen(wx, wy) {
    var cx = (typeof camera !== 'undefined' && camera.x) || 0;
    var cy = (typeof camera !== 'undefined' && camera.y) || 0;
    var z = (window.RG && RG._zoom != null) ? RG._zoom : 1;
    var px = (window.RG && RG._zoomPivot) ? RG._zoomPivot.x : W_() / 2;
    var py = (window.RG && RG._zoomPivot) ? RG._zoomPivot.y : H_() / 2;
    var sx = px + z * (wx - cx - px);
    var sy = py + z * (wy - cy - py);
    return { x: sx, y: sy };
  }
  function drawFluidBody(ctx) {
    if (!built || !P.length || !ctx) return;
    ensureBuf();
    bctx.setTransform(1, 0, 0, 1, 0, 0);
    bctx.clearRect(0, 0, BUFW, BUFH);
    // 1) splat soft radial blobs (additive) into the half-res buffer, in SCREEN space.
    var z = (window.RG && RG._zoom != null) ? RG._zoom : 1;
    var R = 13 * z * BSCALE;                                  // blob radius (screen px, scaled to buffer) — ~2× the rest spacing so settled particles MERGE into one smooth body
    bctx.globalCompositeOperation = 'lighter';
    for (var i = 0; i < P.length; i++) {
      var s = worldToScreen(P[i].x, P[i].y);
      var bx = s.x * BSCALE, by = s.y * BSCALE;
      if (bx < -R || by < -R || bx > BUFW + R || by > BUFH + R) continue;
      var g = bctx.createRadialGradient(bx, by, 0, bx, by, R);
      g.addColorStop(0, 'rgba(255,255,255,0.95)');
      g.addColorStop(0.5, 'rgba(255,255,255,0.45)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      bctx.fillStyle = g;
      bctx.beginPath(); bctx.arc(bx, by, R, 0, 6.2832); bctx.fill();
    }
    bctx.globalCompositeOperation = 'source-over';
    // 2) THRESHOLD the accumulated field into a smooth body (alpha clip), tint to water blue + a highlight.
    var img = bctx.getImageData(0, 0, BUFW, BUFH);
    var d = img.data;
    // parse hex colours once
    var wc = hexRGB(WATER), hc = hexRGB(HILITE), dc = hexRGB(DEEP);
    var TLO = 70, THI = 150;                                   // alpha thresholds (0..255): below TLO = empty (lower → settled blobs MERGE into one smooth body)
    for (var px2 = 0; px2 < d.length; px2 += 4) {
      var a = d[px2 + 3];
      if (a < TLO) { d[px2 + 3] = 0; continue; }
      // dense core = deep water; thin edge = bright highlight rim; mid = water blue
      var col;
      if (a >= THI) col = wc;
      else { var t = (a - TLO) / (THI - TLO); col = mix(hc, wc, t); }   // rim → body
      d[px2] = col[0]; d[px2 + 1] = col[1]; d[px2 + 2] = col[2]; d[px2 + 3] = 235;
    }
    bctx.putImageData(img, 0, 0);
    // 3) blit the smooth body into the world (screen-space here = behind the terrain) at full res.
    ctx.save();
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(buf, 0, 0, BUFW, BUFH, 0, 0, W_(), H_());
    ctx.restore();
  }
  function hexRGB(h) { return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]; }
  function mix(a, b, t) { return [Math.round(a[0] + (b[0] - a[0]) * t), Math.round(a[1] + (b[1] - a[1]) * t), Math.round(a[2] + (b[2] - a[2]) * t)]; }

  // ── world-space front layer (pour streams + airborne droplets) — drawn in frame(), inside the camera ──
  function drawFront(ctx) {
    if (!built) return;
    ctx.fillStyle = POUR;
    for (var p = 0; p < pourStreams.length; p++) {
      var ps = pourStreams[p], by = terrainYAt(ps.x) - 4;
      for (var y = ps.y; y < by; y += 6) { var wob = Math.sin(y * 0.13 + frame * 0.5) * 1.8; ctx.fillRect(ps.x - 3 + wob, y, 6, 5); }
    }
    for (var d = 0; d < drops.length; d++) {
      var q = drops[d];
      ctx.globalAlpha = Math.max(0, 1 - q.life / q.max) * 0.9; ctx.fillStyle = DROP;
      ctx.fillRect(q.x - q.sz / 2, q.y - q.sz / 2, q.sz, q.sz);
    }
    ctx.globalAlpha = 1;
  }

  // ── draw the SOLID overhang block (world-space, in frame() so it sits on top of the fluid) ──
  function drawBlocks(ctx) {
    for (var i = 0; i < blocks.length; i++) {
      var b = blocks[i];
      ctx.fillStyle = 'rgba(0,0,0,0.34)'; ctx.fillRect(b.x + 3, b.y + 4, b.w, b.h);     // drop shadow
      ctx.fillStyle = RUST; ctx.fillRect(b.x, b.y, b.w, b.h);                            // body (flat rust)
      ctx.fillStyle = RUST_LT; ctx.fillRect(b.x, b.y, b.w, 4);                           // lit top cap
      ctx.fillStyle = '#7d4a26'; ctx.fillRect(b.x, b.y + b.h - 3, b.w, 3);               // dark underside
      ctx.fillStyle = 'rgba(255,235,210,0.18)'; ctx.fillRect(b.x, b.y, b.w, 1);          // rim highlight
    }
  }

  // ── camera: frame the whole hole (static sandbox view) ──
  function camHook() {
    if (!isPF()) return false;
    if (typeof camera === 'undefined' || typeof ball === 'undefined') return false;
    var h = hole(); if (!h) return false;
    var centre = (h.teeX + h.cupX) / 2;
    var targetX = centre - W_() / 2;
    camera.x += (targetX - camera.x) * 0.12;
    camera.y += (0 - camera.y) * 0.12;
    return true;
  }

  // ── drawSkyBehind: step the sim (first touch of the frame) + draw the fluid BODY behind the terrain ──
  function skyBehindHook(ctx) {
    if (!isPF() || !ctx) return;
    if (!built) buildField();
    stepFluid();
    drawFluidBody(ctx);
  }
  // ── frame (world-space, in front of terrain): the overhang block + pour streams + droplets ──
  function frameHook(ctx) {
    if (!isPF() || !ctx) return;
    if (!built) { buildField(); }
    drawBlocks(ctx);
    drawFront(ctx);
  }

  // ── screen-space HUD: hint + CLEAR + particle/FPS readout ──
  var CLEAR_BTN = { w: 130, h: 30 };
  function clearBtnRect() { var W = W_(); return { x: W - CLEAR_BTN.w - 22, y: 16, w: CLEAR_BTN.w, h: CLEAR_BTN.h }; }
  var fpsT = 0, fpsLast = (typeof performance !== 'undefined' ? performance.now() : Date.now()), fps = 60;
  function frameScreenHook(ctx) {
    if (!isPF() || !ctx) return;
    var W = W_();
    var now = (typeof performance !== 'undefined' ? performance.now() : Date.now());
    var dt = now - fpsLast; fpsLast = now; if (dt > 0) fps = fps * 0.9 + (1000 / dt) * 0.1;
    if (hint > 0) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, hint / 90);
      ctx.fillStyle = 'rgba(8,12,20,0.62)'; ctx.fillRect(20, 14, 520, 76);
      ctx.fillStyle = 'rgba(235,244,255,0.95)'; ctx.font = "13px 'Departure Mono', monospace"; ctx.textAlign = 'left';
      ctx.fillText('PARTICLE FLUID (PBF) · click / HOLD above the ground → POUR', 32, 36);
      ctx.fillText('fills the narrow notch + UNDER the overhang, self-levels', 32, 56);
      ctx.fillText('drag back from the ball → aim + power, release → SHOOT', 32, 76);
      ctx.restore();
      hint--;
    }
    // particle / FPS readout
    ctx.save();
    ctx.fillStyle = 'rgba(180,220,255,0.78)'; ctx.font = "11px 'Departure Mono', monospace"; ctx.textAlign = 'left';
    ctx.fillText(P.length + ' particles · ' + Math.round(fps) + ' fps', 32, hint > 0 ? 104 : 30);
    ctx.restore();
    // CLEAR button
    var b = clearBtnRect();
    ctx.save();
    ctx.fillStyle = 'rgba(20,28,40,0.85)'; ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.strokeStyle = 'rgba(120,185,235,0.8)'; ctx.lineWidth = 1.5; ctx.strokeRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = 'rgba(235,244,255,0.92)'; ctx.font = "12px 'Departure Mono', monospace";
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('CLEAR FLUID', b.x + b.w / 2, b.y + b.h / 2);
    ctx.restore();
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  }

  // ── register the course + hooks ──
  A.register({
    id: ID,
    name: 'Particle Fluid',
    blurb: 'a real 2D particle fluid (PBF) on a real hole — pour it, it fills the narrow notch + under an overhang flush, self-levels; shoot the ball → splash + sink',
    mats: [['pfsand', 'sand', { restitution: 0.40, rollingFriction: 0.965, surfaceFriction: 0.010, color: RUST, colorLight: RUST_LT }]],
    course: {
      worldName: 'Particle Fluid · PBF on a real hole',
      sky: '#10141c',                          // dark sky
      defaultMaterial: 'pfsand', materials: ['pfsand'],
      archetypes: ['pfluid_basins'],
      difficultyRange: [0.0, 0.0],
      holeDistMin: 940, holeDistMax: 940,
      holeCount: 1,
      cupElevation: function (tY2) { return tY2; },
    },
    hooks: {
      beforeStart: function () { built = false; sinkT = null; lastSafeX = null; hint = 360; if (window.RG) { RG._clampYBand = null; RG._zoom = 1; } },
      onStart: function () { built = false; setTimeout(function () { buildField(); }, 60); },
      camera: camHook,
      collide: function () { if (!isPF()) return false; var onB = ballBlocks(); ballFluid(); return onB; },   // block = solid (return onTop); fluid = side-effect
      drawSkyBehind: skyBehindHook,            // the fluid BODY (metaball), behind the terrain. Steps the sim.
      frame: frameHook,                        // overhang block + pour streams + droplets, in front
      frameScreen: frameScreenHook,
    },
  });

  // ════════════════════════════════════════════════════════════════════════════════════════════════════
  //  POUR INPUT (capture-phase, pre-empts the engine drag-aim for pour clicks; near the ball → normal shot)
  //  Identical scheme to atlas-watersim.js so a press near the ball still starts the drag-aim shot.
  // ════════════════════════════════════════════════════════════════════════════════════════════════════
  var heldPour = null;
  function evtWorld(e) {
    var cx = (e.touches && e.touches[0]) ? e.touches[0].clientX : e.clientX;
    var cy = (e.touches && e.touches[0]) ? e.touches[0].clientY : e.clientY;
    var cnv = document.getElementById('c'); if (!cnv) return null;
    var r = cnv.getBoundingClientRect();
    var gx = (cx - r.left) * (W_() / r.width), gy = (cy - r.top) * (H_() / r.height);
    // invert the camera/zoom transform to get world coords (matches worldToScreen)
    var camx = (typeof camera !== 'undefined' && camera.x) || 0, camy = (typeof camera !== 'undefined' && camera.y) || 0;
    var z = (window.RG && RG._zoom != null) ? RG._zoom : 1;
    var pvx = (window.RG && RG._zoomPivot) ? RG._zoomPivot.x : W_() / 2, pvy = (window.RG && RG._zoomPivot) ? RG._zoomPivot.y : H_() / 2;
    var wx = camx + pvx + (gx - pvx) / z, wy = camy + pvy + (gy - pvy) / z;
    return { gx: gx, gy: gy, wx: wx, wy: wy };
  }
  function nearBall(wx, wy) {
    if (typeof ball === 'undefined') return false;
    return Math.hypot(wx - ball.x, wy - ball.y) < 40 && (typeof state === 'undefined' || state === STATE_AIM);
  }
  function onDown(e) {
    if (!isPF() || !built) return;
    var p = evtWorld(e); if (!p) return;
    var b = clearBtnRect();
    if (p.gx >= b.x && p.gx <= b.x + b.w && p.gy >= b.y && p.gy <= b.y + b.h) { clearFluid(); e.stopPropagation(); e.preventDefault(); return; }
    if (nearBall(p.wx, p.wy)) return;                        // let the engine handle the drag-aim shot
    if (p.wx > fieldX0 && p.wx < fieldX1 && p.wy < terrainYAt(p.wx) - 2) {
      addPourStream(p.wx, p.wy);
      heldPour = { x: p.wx, y: p.wy };
      e.stopPropagation(); e.preventDefault();
    }
  }
  function onMove(e) {
    if (!heldPour) return;
    var p = evtWorld(e); if (!p) return;
    if (p.wx > fieldX0 && p.wx < fieldX1 && p.wy < terrainYAt(p.wx) - 2) heldPour = { x: p.wx, y: p.wy };
  }
  function onUp() { heldPour = null; }
  document.addEventListener('mousedown', onDown, true);
  document.addEventListener('mousemove', onMove, true);
  window.addEventListener('mouseup', onUp, true);
  document.addEventListener('touchstart', onDown, true);
  document.addEventListener('touchmove', onMove, true);
  window.addEventListener('touchend', onUp, true);

  // ── public test hooks ──
  window.__pf = {
    pour: function (wx, wy) { addPourStream(wx, wy == null ? terrainYAt(wx) - 80 : wy); },
    pourAt: function (frac, above) {
      var h = hole(); if (!h) return;
      var wx = h.teeX + (h.cupX - h.teeX) * frac;
      addPourStream(wx, terrainYAt(wx) - (above == null ? 90 : above));
    },
    hold: function (frac, above) { var h = hole(); if (!h) return; var wx = h.teeX + (h.cupX - h.teeX) * frac; heldPour = { x: wx, y: terrainYAt(wx) - (above == null ? 90 : above) }; },
    release: function () { heldPour = null; },
    clear: clearFluid,
    blocks: function () { return blocks; },
    shoot: function (vx, vy) { if (typeof ball === 'undefined') return; ball.vx = vx; ball.vy = vy; ball.atRest = false; ball.onGround = false; if (typeof state !== 'undefined') state = STATE_FLIGHT; },
    state: function () {
      if (!built) return { built: false };
      return { built: true, particles: P.length, drops: drops.length, rest: Math.round(REST * 1000) / 1000, ballX: Math.round(ball.x), ballY: Math.round(ball.y), sinkT: sinkT, frame: frame, blocks: blocks.length };
    },
    rebuild: buildField,
  };
})();
