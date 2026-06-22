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
  // WATCHABILITY RETUNE: the old drive was V≈720 + g≈45 — a flat shot that screamed across in <2s, too
  // quick to appreciate the curve. We now want a SLOW, MAJESTIC, HIGH arc you can watch bow over the
  // planet for ~6-8 seconds. The engine has no air drag, so flight is purely ballistic:
  //     hangtime T(frames) = 2·V·sin(θ)/g ,  range = V·cos(θ)·T = V²·sin(2θ)/g  ,  g = 0.04·GRAV_SCALE
  // For a ~7s (≈420-frame) hang AND a ~11k carry (1k short of the 12k pin → then BOUNDS forward into it),
  // the horizontal speed must be only ~27 px/frame and the gravity must be TINY. Solving for a 43° launch:
  //   V=37, θ=43°, g=0.04·3.2=0.128 → T≈7.0s, carry≈11.5k (short of the 12k pin → bounds in), apex≈2.5k.
  // (Tuned empirically in-engine: the swept landing + a slight shallow descent stretch the idealized
  //  flat-ground numbers, so GRAV_SCALE is set to hit ~7s of measured airtime, not the textbook value.)
  var LAUNCH_DEG = 43;                 // a high, dramatic lob (was 26° flat) — long hang, tall arc to watch
  var VBASE = 20, VPOW = 17;           // power01 in [0,1] -> launch speed VBASE..VBASE+VPOW (perfect ≈ 37)
  var SWEET_LO = 0.74, SWEET_HI = 0.88;   // stop the bar here for a PERFECT (max-power) drive
  var METER_SPEED = 0.020;            // how fast the power marker sweeps per frame

  // long-hole geometry: a single hole spanning ~12000 world px, cup at the far end ("the pin").
  var HOLE_SPAN = 12000;

  // GRAVITY tuning (see the ballistic math above): a tiny g so the high lob hangs ~7s and carries ~11.5k.
  // Base GRAVITY is 0.04, so effective g = 0.04·GRAV_SCALE = 0.128 px/frame².
  var GRAV_SCALE = 3.2;

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

  // ── flight TRAIL state — sampled ball world positions for the glowing arc tracker ──
  // We push {x,y} world samples every frame the ball is in flight, then draw a fading line through them
  // in the world-space frame() hook (curveWorldDY applied per-sample so the trail follows the planet bow).
  var trail = [];                     // [{x, y}] oldest→newest world-space ball positions during this drive
  var TRAIL_MAX = 240;                // ~4s of samples at 60fps; plenty to span the whole arc on screen
  var trailWasFlying = false;         // edge-detect launch → clear the trail at the start of each drive

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

        // zoom target: 1 at address, shrinking HARD as the ball climbs so the apex frames the WHOLE
        // curving arc + the planet limb (not a lonely dot in empty sky). The high lob now peaks ~2,500
        // world-px up, so to fit ground→ball (~2,500px) into the ~0.45·H screen band between the ground
        // anchor and the ball anchor we need a deep pull-back (z ≈ 0.45·H/2500 ≈ 0.10). The numerator
        // H·0.55 makes apex zoom land near the FLOOR ~0.10 (whole arc + limb framed at full pull-back).
        var z;
        if (typeof state !== 'undefined' && state === STATE_AIM) {
          z = 1;
        } else {
          // floor 0.10 + this numerator pulls WAY back at the peak so the full majestic arc + the curved
          // planet limb all fit — the ball is framed low (see the vertical anchors below) so it never
          // drifts off the top even at full zoom-out.
          z = Math.max(0.10, Math.min(1, (H * 0.55) / (height + H * 0.55)));
        }
        // lerp toward the target. The mega-arc apex is BRIEF (~6 frames), so a slow lerp never reaches the
        // zoom-out before the ball descends (the old 0.09 barely bowed). Zoom OUT fast (track the climb so
        // the apex truly opens to the planet), ease back IN gently on the descent (no jarring snap-in).
        var cz = (RG._zoom != null) ? RG._zoom : 1;
        var zlerp = (z < cz) ? 0.30 : 0.10;     // out fast, in slow
        RG._zoom = cz + (z - cz) * zlerp;
        var zz = RG._zoom;

        // pivot: a fixed lower-screen point so the curved ground stays anchored and the planet limb fills
        // the lower band (the bow grows downward from the pivot toward the edges). Lowered to match the
        // lower ground anchor so the limb sits along the bottom and the sky opens for the tall arc.
        RG._zoomPivot = { x: W / 2, y: H * 0.84 };
        var px = RG._zoomPivot.x, py = RG._zoomPivot.y;

        // follow the ball horizontally: frame it ~38% across so the arc has room to its right. The mega-arc
        // races horizontally, so X tracks FAST (near the prototype's instant follow) — otherwise the ball
        // lags to the screen edge while the camera catches up.
        var wantSX = (typeof state !== 'undefined' && state === STATE_AIM) ? 120 : W * 0.38;
        // post-zoom screen x of a world point wx: px + (wx - camera.x - px) * zz  (mirrors applyCameraTransform)
        var targetCamX = ball.x - px - (wantSX - px) / zz;

        // VERTICAL: anchor the ground LOW so the planet limb sits along the bottom and the whole sky
        // opens above for the tall arc, BUT if the ball would still fly off the top at this zoom, lower
        // the camera so the ball sits no higher than ~28% down — framing the ball LOWER (a big ballTopSY)
        // so at full zoom-out the ball + the curved limb + the entire arc are all comfortably in frame.
        var wantGroundSY = H * 0.84;
        var targetCamY = gy - py - (wantGroundSY - py) / zz;            // ground-anchored frame (limb low)
        if (typeof state !== 'undefined' && state !== STATE_AIM) {
          // ball screen Y under this camera = py + (ball.y - camY - py)*zz; clamp it to >= ballTopSY.
          // 0.28 keeps the ball low-ish (lots of headroom is wasted otherwise) so the arc reads centred.
          var ballTopSY = H * 0.28;
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

      // WORLD-space per-frame hook (wrap.drawWorld → RG_ATLAS.frame, inside the camera transform). Two
      // jobs, both purely to make the small ball TRIVIAL TO TRACK through the whole majestic arc:
      //   1. sample the ball's world position each flight frame and draw a long FADING ARC TRAIL through
      //      the samples — curveWorldDY() applied to each sample's Y so the trail bows with the planet limb
      //      (a glowing arc spanning the sky, exactly tracing where the ball has flown).
      //   2. a soft GLOW HALO + a faint outer RING around the ball so the dot pops against deep space.
      // Runs after the base world + juice, so it draws on top; gated on isOrbit() so it's inert elsewhere.
      frame: function (ctx) {
        if (!isOrbit() || !ctx || typeof ball === 'undefined') return;
        var flying = (typeof state !== 'undefined') && (state === STATE_FLIGHT || (state !== STATE_AIM && state !== STATE_COMPLETE && !ball.atRest));
        // edge-detect a fresh launch (AIM→flight): clear last drive's trail so each shot starts clean.
        if (flying && !trailWasFlying) trail.length = 0;
        trailWasFlying = flying;

        // sample the ball's CURRENT world position while it's moving (skip while at rest/aiming).
        if (flying && !ball.atRest) {
          var lastS = trail.length ? trail[trail.length - 1] : null;
          // de-dupe near-identical points (cheap), keep the sample list bounded.
          if (!lastS || Math.abs(lastS.x - ball.x) > 1 || Math.abs(lastS.y - ball.y) > 1) {
            trail.push({ x: ball.x, y: ball.y });
            if (trail.length > TRAIL_MAX) trail.shift();
          }
        }

        var dy = (window.RG && RG._curveWorldDY) ? RG._curveWorldDY : function () { return 0; };
        var z = (window.RG && RG._zoom != null) ? RG._zoom : 1;

        // ── the fading arc trail ──────────────────────────────────────────────────────────────────────
        if (trail.length > 1) {
          ctx.save();
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          // draw as fading segments (newest = brightest/thickest). Two passes: a wide soft GLOW under a
          // crisp core line, so the arc reads as a luminous contrail. Line width is in WORLD units, so we
          // divide by z to keep a roughly constant ON-SCREEN thickness as the camera zooms way out.
          var n = trail.length;
          for (var pass = 0; pass < 2; pass++) {
            for (var i = 1; i < n; i++) {
              var a = trail[i - 1], b = trail[i];
              var t = i / n;                              // 0 (oldest) → 1 (newest)
              var alpha = Math.pow(t, 1.4) * (pass === 0 ? 0.22 : 0.85);   // tail fades out smoothly
              if (alpha < 0.01) continue;
              var wBase = (pass === 0 ? 10 : 3) * t + (pass === 0 ? 4 : 1.2);
              ctx.lineWidth = wBase / z;                  // world units → ~constant screen px
              ctx.strokeStyle = (pass === 0)
                ? 'rgba(120,200,255,' + (alpha * 0.5).toFixed(3) + ')'   // cool blue outer glow
                : 'rgba(235,248,255,' + alpha.toFixed(3) + ')';          // bright white-blue core
              ctx.beginPath();
              ctx.moveTo(a.x, a.y + dy(a.x));
              ctx.lineTo(b.x, b.y + dy(b.x));
              ctx.stroke();
            }
          }
          ctx.restore();
        }

        // ── ball glow + ring (only while it's the small high dot; harmless at rest too) ────────────────
        var bx = ball.x, by = ball.y + dy(ball.x);
        var BR = (typeof BALL_RADIUS !== 'undefined') ? BALL_RADIUS : 4;
        ctx.save();
        // soft radial halo — grows a touch as we zoom out so the dot never disappears. World-space radius
        // scaled by 1/z to hold a steady on-screen size.
        var haloR = (10 + 6 * Math.max(0, 1 - z)) / z;
        var g = ctx.createRadialGradient(bx, by, 0, bx, by, haloR);
        g.addColorStop(0, 'rgba(180,225,255,0.55)');
        g.addColorStop(0.5, 'rgba(150,205,255,0.22)');
        g.addColorStop(1, 'rgba(150,205,255,0)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(bx, by, haloR, 0, Math.PI * 2); ctx.fill();
        // a faint crisp ring a constant ~5 screen-px outside the ball's screen edge so it reads as a
        // tracked target, not a smudge. The ball draws at world-radius BR (×z on screen), so a ring at
        // world-radius BR + 5/z sits ~5 screen-px out at any zoom.
        ctx.lineWidth = 1.5 / z;
        ctx.strokeStyle = 'rgba(210,235,255,0.7)';
        ctx.beginPath(); ctx.arc(bx, by, BR + 5 / z, 0, Math.PI * 2); ctx.stroke();
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
