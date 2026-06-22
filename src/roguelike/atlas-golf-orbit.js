// ── atlas-golf-orbit.js — GOLF ORBIT (the mega-drive) ─────────────────────────────────────────────
// A peel-off atlas planet (?course=golf-orbit) that brings the standalone golforbit.html mechanic into
// the REAL engine — real heightfield terrain (drawTerrainDG), the real ball (drawBall), real materials
// and sky. THE FEEL: at ADDRESS it reads as a perfectly normal hole (normal camera framing, RG._zoom=1)
// — the ONLY tell is a POWER BAR instead of the drag-aim. SLAM it and the ball is hit with MEGA force
// (hundreds of px/frame, ~26° flatish arc), flies thousands of world-units, the camera ZOOMS OUT to keep
// the high/fast arc framed, then smoothly zooms back IN as it descends; the ball lands fast and BOUNDS
// FORWARD in big skips before settling. No visible cup up close — the pin is thousands of yds away.
//
// Built entirely on the engine's existing inert hooks (NO core edits):
//   • RG._meterFire (gameplay.js mousedown/touchstart) — fire the metered drive instead of drag-aim
//   • RG._zoom / RG._zoomPivot (wrap.js applyCameraTransform + desert-golfing.js drawTerrainDG range)
//   • RG._holeDistCap (level-design.js) — a single long hole spanning the whole drive
//   • RG._clampYBand (shared.js clampY) — a tall band so the high arc isn't clipped
//   • RG_ATLAS hooks: camera() [follow + zoom], isOOB() [never OOB mid-flight], frameScreen() [power bar]
// Gated on RG.course === 'golf-orbit' — every hook no-ops on any other course, so peeling the file +
// its <script> tag removes it cleanly and the base game is byte-for-byte untouched.
(function () {
  if (typeof window === 'undefined' || !window.RG_ATLAS) return;
  var A = window.RG_ATLAS;
  var ID = 'golf-orbit';

  function isOrbit() { return !!(window.RG && RG.course === ID); }
  function H_() { return (typeof H !== 'undefined') ? H : 540; }
  function W_() { return (typeof W !== 'undefined') ? W : 960; }

  // ── tunables (engine units: world px, gravity per-frame) ──────────────────────────────────────────
  // Launch power is in the engine's velocity units (px/frame; the base game caps a normal shot at 8).
  // We slam at hundreds, so the ball screams across the long hole. LAUNCH_DEG sets the flatish arc.
  var LAUNCH_DEG = 26;
  var VBASE = 380, VPOW = 340;        // power01 in [0,1] -> launch speed VBASE..VBASE+VPOW (perfect ≈ 720)
  var SWEET_LO = 0.74, SWEET_HI = 0.88;   // stop the bar here for a PERFECT (max-power) drive
  var METER_SPEED = 0.020;            // how fast the power marker sweeps per frame

  // long-hole geometry: a single hole spanning ~12000 world px, cup at the far end ("the pin").
  var HOLE_SPAN = 12000;

  // GRAVITY tuning: the engine has NO air drag, so range is purely ballistic: range ≈ 0.787·V²/g.
  // With a perfect V≈720 we want the ball to carry ~10–11k px (landing near the far pin, then bounding
  // the rest), so g ≈ 0.787·720²/10500 ≈ 39. Base GRAVITY is 0.04, so gravityScale ≈ 39/0.04 ≈ 975.
  var GRAV_SCALE = 1130;

  // ── the long fairway archetype — gently rolling run spanning the whole drive, cup at the far end ──
  // Registered onto the engine's global archetypes table (pure ADD; the core file is untouched and every
  // other course's archetype subset excludes this name, so it's inert everywhere but this one course).
  if (typeof archetypes !== 'undefined' && !archetypes.golforbit_run) {
    archetypes.golforbit_run = function (sx, sy, dist, cupY, diff) {
      // sy = tee elevation; we want a long, gentle, mostly-flat fairway with soft rolling swells so the
      // ball can bound forward over it and settle. Cup sits on a flat green at the far end (the pin).
      var verts = [];
      var x = sx, y = sy;
      verts.push({ x: x, y: clampY(y) });                 // tee flat (ball sits here)
      // a flat tee apron so the address reads clean
      x += 120; verts.push({ x: x, y: clampY(y) });
      var greenStart = sx + dist - 220;
      var seg = 240;                                       // swell wavelength
      var phase = 0;
      while (x < greenStart) {
        x += seg * randRange(0.8, 1.25);
        if (x > greenStart) x = greenStart;
        // gentle rolling swells around the tee elevation (small amplitude → reads flat at planet scale,
        // a real rolling fairway up close). Amplitude grows a touch toward the middle of the drive.
        phase += 1;
        var amp = 26 + 22 * Math.sin(phase * 0.6);
        y = sy + Math.sin(phase * 1.7) * amp + randRange(-10, 10);
        verts.push({ x: x, y: clampY(y) });
      }
      // flat green approach + the cup pad at the very end (the pin)
      var greenY = sy + randRange(-12, 12);
      verts.push({ x: greenStart, y: clampY(greenY) });
      verts.push({ x: sx + dist, y: clampY(greenY) });    // cup sits here (last vertex)
      return verts;
    };
    if (typeof ARCHETYPE_TABLE !== 'undefined') ARCHETYPE_TABLE.push(['golforbit_run', 0.0, 5.0, 1]);
  }

  // ── meter state ──
  var pm = 0, pmDir = 1, lastPerfect = false, lastYds = 0;

  function teeX() {
    if (typeof holes === 'undefined' || !holes.length) return 0;
    var h = holes[(typeof currentHole !== 'undefined') ? currentHole : 0];
    return h ? h.teeX : 0;
  }
  function teeY() {
    if (typeof holes === 'undefined' || !holes.length) return H_() * 0.65;
    var h = holes[(typeof currentHole !== 'undefined') ? currentHole : 0];
    return (h && h.teeY != null) ? h.teeY : (typeof terrainYAt === 'function' ? terrainYAt(teeX()) : H_() * 0.65);
  }

  // FIRE the metered drive — mirrors gameplay.js mouseup exactly, but with mega force at LAUNCH_DEG.
  // Returns true to tell gameplay.js the shot was handled (skip the normal drag-aim).
  function meterFire() {
    if (!isOrbit()) return false;                          // only golf-orbit; normal holes untouched
    if (typeof state === 'undefined' || state !== STATE_AIM) return false;
    if (typeof ball === 'undefined') return false;
    var perfect = (pm >= SWEET_LO && pm <= SWEET_HI);
    lastPerfect = perfect;
    var p = perfect ? 1.0 : pm;
    var power = VBASE + p * VPOW;
    var a = -LAUNCH_DEG * Math.PI / 180;                   // negative = up-and-to-the-right (screen Y down)
    ball.vx = Math.cos(a) * power;
    ball.vy = Math.sin(a) * power;
    ball.atRest = false;
    ball.onGround = false;
    ball.slowFrames = 0;
    ball.flightFrames = 0;
    ball.spinRate = 0;
    if (typeof showTitle !== 'undefined') showTitle = false;
    state = STATE_FLIGHT;
    if (typeof strokes !== 'undefined') strokes++;
    if (typeof _logBall === 'function') _logBall('orbit-shot');
    return true;
  }

  function hole() { return (typeof holes !== 'undefined') ? holes[(typeof currentHole !== 'undefined') ? currentHole : 0] : null; }

  // ── WORLD CURVE — the planet's limb ───────────────────────────────────────────────────────────────
  // The engine draws terrain/ball/flag in WORLD coords inside a linear camera transform (translate+scale),
  // which can't express a parabola. So we publish a per-x WORLD-Y offset that, AFTER the camera scale,
  // lands each point at a screen Y bowed DOWN toward the screen edges — the convex limb of a planet.
  // drawTerrainDG / drawBall / drawFlag all add RG._curveWorldDY(worldX) to their Y, so the surface, the
  // ball and the pin share one bow and stay glued together. GATED on RG._worldCurve (set only here, only
  // on this course); 0 at address (RG._zoom==1) → flat, growing as the camera zooms OUT.
  //   screen math (wrap.applyCameraTransform, pivot x = W/2):
  //     screenX = W/2 + z*(wx - camera.x - W/2)         → screenDX = z*(wx - camera.x - W/2)
  //     want screenYoffset = amt * screenDX^2           where amt = RG._worldCurve * (1-z)^1.4
  //     worldYoffset = screenYoffset / z                (camera scales world-Y by z)
  var CURVE_BASE = 0.00100;     // limb strength; tuned so address reads flat and apex bows clearly
  function curveWorldDY(wx) {
    if (!window.RG || !window.RG._worldCurve) return 0;
    if (typeof camera === 'undefined') return 0;
    var z = (window.RG._zoom != null) ? window.RG._zoom : 1;
    if (z >= 0.999) return 0;                 // flat at address (and a hair below) → byte-identical look
    var W = W_();
    var amt = window.RG._worldCurve * Math.pow(Math.max(0, 1 - z), 1.4);
    var sdx = z * (wx - camera.x - W / 2);    // screen px from centre (pivot.x = W/2)
    return (amt * sdx * sdx) / z;             // → world-Y offset (screen bow / z)
  }
  window.RG_CURVE_curveWorldDY = curveWorldDY;   // (debug handle)
  if (window.RG) window.RG._curveWorldDY = curveWorldDY;

  // SAFE ground height: terrainYAt EXTRAPOLATES the last/first segment past the terrain ends, which on a
  // long hole shoots to ±millions (the ball then falls forever into a void). Clamp to a FLAT extension at
  // the boundary vertex's Y so a ball that bounds past the pin still lands on (flat) ground and settles.
  function groundY(x) {
    if (typeof vertices === 'undefined' || vertices.length < 2 || typeof terrainYAt !== 'function') {
      return (typeof terrainYAt === 'function') ? terrainYAt(x) : H_() * 0.8;
    }
    var first = vertices[0], last = vertices[vertices.length - 1];
    if (x <= first.x) return first.y;
    if (x >= last.x) return last.y;
    return terrainYAt(x);
  }

  A.register({
    id: ID,
    name: 'Golf Orbit',
    blurb: 'the mega-drive — slam the ball over the curve of the world, thousands of yards to the pin',
    // an earth-like fairway turf (a unique name so it never collides with an existing material).
    mats: [['orbitturf', 'grass', { restitution: 0.40, rollingFriction: 0.94, surfaceFriction: 0.014, color: '#4e9a4a', colorLight: '#62b257' }]],
    course: {
      worldName: 'Golf Orbit · the mega-drive',
      sky: '#0a0e18',                                      // deep-space sky (matches the prototype)
      defaultMaterial: 'orbitturf', materials: ['orbitturf'],
      archetypes: ['golforbit_run'],
      difficultyRange: [0.0, 0.0],
      holeDistMin: HOLE_SPAN, holeDistMax: HOLE_SPAN,
      holeCount: 1,                                        // single hole → no next-hole transition edge case
      // a flat tee (cup elevation ≈ tee elevation; the long fairway rolls around it)
      cupElevation: function (tY) { return tY; },
      phys: { gravityScale: GRAV_SCALE, windScale: 0 },    // very heavy gravity (no air drag) brings the mega-arc back down within the hole
    },
    hooks: {
      // generation-time state: a LONG hole and a TALL vertical band so the high arc isn't clipped.
      beforeStart: function () {
        if (!window.RG) return;
        RG._holeDistCap = HOLE_SPAN + 600;                 // unlock the one-screen distance cap
        RG._clampYBand = [-H_() * 4, H_() * 0.92];         // tall band so the fairway draws across the long hole
        RG._zoom = 1; RG._zoomPivot = { x: W_() / 2, y: H_() * 0.78 };
        RG._worldCurve = CURVE_BASE;            // arm the planet-limb bow (inert until zoomed out)
        RG._curveWorldDY = curveWorldDY;        // publish the shared world->screen bow offset
        pm = 0; pmDir = 1; lastPerfect = false; lastYds = 0;
      },

      // CAMERA — follow the ball horizontally + drive RG._zoom by ball HEIGHT above the tee. At ADDRESS
      // (AIM, ball at rest) RG._zoom eases to 1 and the camera frames like a normal hole, so it's
      // indistinguishable from a normal hole. High in the sky → zoom OUT; descending → zoom back IN.
      camera: function () {
        if (!isOrbit()) return false;
        if (typeof camera === 'undefined' || typeof ball === 'undefined') return false;
        var W = W_(), H = H_();
        var gy = teeY();                                   // tee/ground elevation (world Y)
        var height = Math.max(0, gy - ball.y);             // how far above the ground (world px)

        // zoom target: 1 at address, shrinking HARD as the ball climbs so the apex frames the curved
        // planet + the whole arc (not a lonely dot in empty sky). Floor at 0.34 keeps the ball a visible
        // dot at the very top of the arc; a smaller numerator makes height dominate (zooms out sooner).
        var z;
        if (typeof state !== 'undefined' && state === STATE_AIM) {
          z = 1;
        } else {
          // floor 0.22 + this numerator keeps the ball ~upper-third AND the planet anchored low even at a
          // PERFECT drive's extreme peak (so the apex never collapses to a lonely dot in empty sky).
          z = Math.max(0.22, Math.min(1, (H * 0.52) / (height + H * 0.52)));
        }
        // lerp toward the target. The mega-arc apex is BRIEF (~6 frames), so a slow lerp never reaches the
        // zoom-out before the ball descends (the old 0.09 barely bowed). Zoom OUT fast (track the climb so
        // the apex truly opens to the planet), ease back IN gently on the descent (no jarring snap-in).
        var cz = (RG._zoom != null) ? RG._zoom : 1;
        var zlerp = (z < cz) ? 0.30 : 0.10;     // out fast, in slow
        RG._zoom = cz + (z - cz) * zlerp;
        var zz = RG._zoom;

        // pivot: a fixed lower-screen point so the curved ground stays anchored and the planet limb fills
        // the lower third (the bow grows downward from the pivot toward the edges).
        RG._zoomPivot = { x: W / 2, y: H * 0.78 };
        var px = RG._zoomPivot.x, py = RG._zoomPivot.y;

        // follow the ball horizontally: frame it ~38% across so the arc has room to its right. The mega-arc
        // races horizontally, so X tracks FAST (near the prototype's instant follow) — otherwise the ball
        // lags to the screen edge while the camera catches up.
        var wantSX = (typeof state !== 'undefined' && state === STATE_AIM) ? 120 : W * 0.38;
        // post-zoom screen x of a world point wx: px + (wx - camera.x - px) * zz  (mirrors applyCameraTransform)
        var targetCamX = ball.x - px - (wantSX - px) / zz;

        // VERTICAL: anchor the ground so the planet fills the lower third, BUT if the ball would fly off
        // the top at this zoom, lower the camera so the ball sits no higher than ~30% down — both framed.
        var wantGroundSY = H * 0.70;
        var targetCamY = gy - py - (wantGroundSY - py) / zz;            // ground-anchored frame
        if (typeof state !== 'undefined' && state !== STATE_AIM) {
          // ball screen Y under this camera = py + (ball.y - camY - py)*zz; clamp it to >= ballTopSY
          var ballTopSY = H * 0.30;
          var camYForBall = ball.y - py - (ballTopSY - py) / zz;        // camera.y that puts the ball at ballTopSY
          // pick the camera that shows the ball if anchoring the ground would push it off the top
          if (camYForBall < targetCamY) targetCamY = camYForBall;
        }

        var lerpX = (typeof state !== 'undefined' && state === STATE_AIM) ? 0.14 : 0.55;   // X tracks fast (racing arc)
        var lerpY = (typeof state !== 'undefined' && state === STATE_AIM) ? 0.14 : 0.30;   // Y eases (no jarring)
        camera.x += (targetCamX - camera.x) * lerpX;
        camera.y += (targetCamY - camera.y) * lerpY;
        return true;
      },

      // SWEPT GROUND COLLISION — the mega-drive moves hundreds of px per substep, so it TUNNELS straight
      // through the engine's thin heightfield (the base collide only catches the ball within BALL_RADIUS
      // of a segment, which a fast ball skips over). We add a continuous (swept) ground check: the engine
      // sets ball._px/_py to the pre-move position each substep, so we test whether the ball CROSSED the
      // terrain surface between (_px,_py)→(x,y). On a crossing we place it on the surface, reflect vy with
      // the material restitution (a forward BOUND), and bleed horizontal speed by rolling friction — the
      // big skips-then-settle feel. Runs in the engine's collide dispatch (every substep, sim-consistent).
      // Returns true when the ball is resting on / bounding along the ground (wrap.js ORs it into onGround).
      collide: function () {
        if (!isOrbit()) return false;
        if (typeof ball === 'undefined' || typeof terrainYAt !== 'function') return false;
        var px = (ball._px != null) ? ball._px : ball.x;
        var py = (ball._py != null) ? ball._py : ball.y;
        var nx = ball.x, ny = ball.y;
        var BR = (typeof BALL_RADIUS !== 'undefined') ? BALL_RADIUS : 4;

        // March along the swept segment; find the first sub-sample where the ball is at/below the surface.
        var dx = nx - px, dy = ny - py;
        var dist = Math.hypot(dx, dy);
        var steps = Math.max(1, Math.min(400, Math.ceil(dist / 6)));   // ~6px granularity, capped
        var hitX = null, hitGY = 0;
        for (var i = 1; i <= steps; i++) {
          var t = i / steps;
          var sx = px + dx * t, sy = py + dy * t;
          var gY = groundY(sx);
          if (sy >= gY - BR) { hitX = sx; hitGY = gY; break; }
        }
        if (hitX == null) return false;                  // stayed above the surface this substep

        // resolve: sit the ball on the surface
        ball.x = hitX;
        ball.y = hitGY - BR;
        var matName = (typeof getMaterialAt === 'function') ? getMaterialAt(hitX) : 'orbitturf';
        var mat = (typeof MATERIALS !== 'undefined' && MATERIALS[matName]) ? MATERIALS[matName] : { restitution: 0.46, rollingFriction: 0.965 };

        var horiz = Math.abs(ball.vx);
        if (ball.vy > 0) {
          // a real bound only if coming down hard AND still moving forward; otherwise settle.
          if (ball.vy > 60 && horiz > 12) {
            ball.vy = -ball.vy * mat.restitution;        // BOUND forward
            ball.vx *= 0.82;                             // horizontal bleed per skip (big skips → settle)
            ball._obBounce = (ball._obBounce || 0) + 1;
          } else {
            ball.vy = 0;                                 // low vertical speed → roll along the ground
          }
        }
        // once the forward roll has bled out, fully stop so the engine's rest check settles it (no
        // perpetual micro-bounce: gravity would otherwise re-seed a tiny vy every substep).
        if (horiz < 8 && Math.abs(ball.vy) < 60) { ball.vx = 0; ball.vy = 0; }
        ball.onGround = true;
        ball.lastCollidedMat = matName;
        return true;
      },

      // never OOB while the ball is moving — the mega-drive ranges far beyond the normal screen frame,
      // so the base off-screen check would wrongly kill it. The ball settles via physics + the cup.
      isOOB: function () {
        if (!isOrbit()) return null;
        if (typeof ball === 'undefined') return null;
        // only consider OOB once the ball has truly come to rest far past the pin (a degenerate overshoot)
        return false;
      },

      // DEEP-SPACE SKY (behind the terrain) — a dense static starfield + a subtle atmosphere limb glow
      // that only emerges as we zoom OUT (hidden at address, so the hole still reads normal). Screen-space,
      // deterministic (seeded by index), drawn after the base sky fill and before the terrain (wrap.drawSky
      // → RG_ATLAS.drawSkyBehind) so the planet's green limb occludes the lower stars.
      drawSkyBehind: function (ctx) {
        if (!isOrbit()) return;
        var W = W_(), H = H_();
        var z = (window.RG && RG._zoom != null) ? RG._zoom : 1;
        ctx.save();
        // ~140 stars, seeded screen positions; a few brighter/blue. Twinkle is static (no per-frame jitter).
        for (var i = 0; i < 140; i++) {
          var h = (Math.imul(i + 1, 2654435761) >>> 0);
          var sx = h % W;
          var sy = (Math.imul(h ^ 0x9e3779b9, 40503) >>> 0) % H;
          var big = (i % 11 === 0);
          ctx.fillStyle = (i % 5 === 0) ? 'rgba(190,210,255,0.85)' : (big ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.45)');
          var b = big ? 2 : 1;
          ctx.fillRect(sx, sy, b, b);
        }
        // atmosphere glow hugging the limb — only as we zoom out, tracking the curved ground screen Y.
        var aA = 0.34 * Math.max(0, 1 - z);
        if (aA > 0.01 && typeof camera !== 'undefined') {
          // approximate ground screen Y at centre (where the bow is ~0): pivot-zoom of the tee elevation
          var py = (RG._zoomPivot && RG._zoomPivot.y) || H * 0.82;
          var gy = teeY();
          var groundSY = py + z * (gy - ((camera.y) || 0) - py);
          var atmo = ctx.createLinearGradient(0, groundSY - 150, 0, groundSY);
          atmo.addColorStop(0, 'rgba(80,150,215,0)');
          atmo.addColorStop(1, 'rgba(116,196,236,' + aA + ')');
          ctx.fillStyle = atmo;
          ctx.fillRect(0, groundSY - 150, W, 160);
        }
        ctx.restore();
      },

      // SCREEN-space HUD — the oscillating POWER BAR at address, and the yds-to-pin readout in flight.
      frameScreen: function (ctx) {
        if (!isOrbit() || !ctx) return;
        var W = W_(), H = H_();
        ctx.save();
        ctx.textAlign = 'left';
        ctx.fillStyle = '#fff';
        ctx.font = "13px 'Departure Mono', monospace";

        var h = hole();
        var pinYds = h ? Math.round((h.cupX - h.teeX)) : HOLE_SPAN;

        if (typeof state !== 'undefined' && state === STATE_AIM) {
          // sweep the power marker
          pm += pmDir * METER_SPEED;
          if (pm > 1) { pm = 1; pmDir = -1; }
          if (pm < 0) { pm = 0; pmDir = 1; }

          ctx.fillStyle = 'rgba(255,255,255,0.78)';
          ctx.font = "12px 'Departure Mono', monospace";
          ctx.fillText('PIN ' + pinYds.toLocaleString() + ' YDS · stop the bar in the green for a PERFECT drive', 20, 30);

          var bw = 460, bx = (W - bw) / 2, by = H - 44, bh = 22;
          ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(bx - 3, by - 3, bw + 6, bh + 6);
          ctx.fillStyle = '#1d2a24'; ctx.fillRect(bx, by, bw, bh);
          ctx.fillStyle = '#2e8b3a'; ctx.fillRect(bx + SWEET_LO * bw, by, (SWEET_HI - SWEET_LO) * bw, bh);
          var grd = ctx.createLinearGradient(bx, 0, bx + bw, 0);
          grd.addColorStop(0, '#3fd0e0'); grd.addColorStop(0.7, '#ffe14a'); grd.addColorStop(1, '#ff5a3c');
          ctx.fillStyle = grd; ctx.fillRect(bx, by, pm * bw, bh);
          ctx.fillStyle = '#fff'; ctx.fillRect(bx + pm * bw - 2, by - 5, 4, bh + 10);
          ctx.textAlign = 'center';
          ctx.fillStyle = 'rgba(255,255,255,0.85)';
          ctx.font = "11px 'Departure Mono', monospace";
          ctx.fillText('POWER', W / 2, by - 8);
        } else if (typeof ball !== 'undefined' && h) {
          var yds = Math.max(0, Math.round(ball.x - h.teeX));
          lastYds = yds;
          ctx.textAlign = 'center';
          ctx.fillStyle = '#fff';
          ctx.font = "bold 38px 'Departure Mono', monospace";
          ctx.fillText(yds.toLocaleString() + ' yds', W / 2, 52);
          ctx.font = "13px 'Departure Mono', monospace";
          ctx.fillStyle = 'rgba(255,255,255,0.82)';
          var toPin = Math.max(0, pinYds - yds);
          ctx.fillText((lastPerfect ? 'PERFECT!  ' : '') + toPin.toLocaleString() + ' yds to pin', W / 2, 76);
        }
        ctx.restore();
      },
    },
  });

  // Register the meter-fire entry point the engine's input layer calls (gameplay.js mousedown/touchstart).
  // Guarded internally on isOrbit() so normal holes never see it.
  window.RG._meterFire = meterFire;
})();
