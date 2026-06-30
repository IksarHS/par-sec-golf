// ── atlas-puzzle-mode.js — PUZZLE MODE: a Super Stickman Golf-style 2D hand-designed hole ────────────
// A peel-off atlas planet (?course=puzzle) that brings the SSG/Stickman format into the REAL engine: a
// BIG 2D hand-authored level (multiple screens) the player works the ball through over several shots,
// with WALLS, RAMPS, BLOCKS and STICKY surfaces — rendered in OUR flat faceted art so it reads native.
//
// Built ENTIRELY on the engine's inert peel-off hooks (NO engine-core edits):
//   • beforeStart   — push the generated heightfield FAR BELOW the level (RG._clampYBand) so it is only
//                     an OOB safety floor and never collides with real play; unlock the long-hole cap.
//   • onStart       — build the 2D geometry ONCE (segments + convex bodies), place tee/cup, hide the
//                     base flag, drop the ball on our tee. Geometry is fixed for the whole hole.
//   • collide()     — swept circle vs every level segment + body edge (anti-tunnel). NORMAL → reflect by
//                     material restitution + bleed by friction (bank/bounce). STICKY → stop the ball DEAD
//                     (vx=vy=0, onGround) so the player putts the next shot off it.
//   • isOOB()       — fall outside the level bounds → reshoot from the last rest (handled in-hook, no
//                     base STATE_OOB teleport to the wrong heightfield tee).
//   • isGoalReached — rest near the cup → holed.
//   • camera()      — a free 2D FOLLOW cam: pan camera.x AND camera.y, drive RG._zoom to frame the
//                     puzzle, CLAMPED to the level bounds so you never see past the edge.
//   • frame()       — draw the bodies/segments in OUR flat art (material colour + lighter top lip),
//                     sticky = a glowing green, plus the cup + our flag.
//
// LEVEL FORMAT (hand-author more in PUZZLE_LEVELS below):
//   { name, w, h, tee:{x,y}, cup:{x,y},
//     segments:[{ax,ay,bx,by,mat}],            // line colliders: floors, walls, ramps, ceilings
//     bodies:[{points:[[x,y],...], mat}] }     // closed convex polygons: platforms, pillars, blocks
//   mat is 'normal' (wall/floor/platform) or 'sticky' (ball stops dead). +y is DOWN. The cup can be
//   anywhere (not just right of the tee). Levels are ~3-6 screens (w~2400, h~1500).
//
// Gated on RG.course === 'puzzle'; peel this file + its <script> tag → the hooks go inert and the base
// game is byte-for-byte unchanged.
(function () {
  if (typeof window === 'undefined' || !window.RG_ATLAS) return;
  var A = window.RG_ATLAS;
  var ID = 'puzzle';
  var BR = (typeof BALL_RADIUS !== 'undefined') ? BALL_RADIUS : 4;

  function isPuzzle() { return !!(window.RG && RG.course === ID); }
  function H_() { return (typeof H !== 'undefined') ? H : 540; }
  function W_() { return (typeof W !== 'undefined') ? W : 960; }

  // ── materials ──────────────────────────────────────────────────────────────────────────────────────
  // Base wall/floor = a Mars-rust 'rock' (non-green) so the sticky green pops. We layer two named mats:
  //   pzrock  — the structural rust wall/floor/platform (bank off it)
  //   pzstick — a distinct glowing green; the ball stops dead on contact (putt off it)
  // restitution here is the bank energy on a NORMAL surface; tan is tangential keep (friction bleed).
  var MAT = {
    pzrock:  { rest: 0.42, tan: 0.78, color: '#c45c4a', light: '#e07e5f', edge: '#8f3d30', sticky: false },
    pzstick: { rest: 0.00, tan: 0.00, color: '#2ff07a', light: '#7dffb0', edge: '#13a04f', sticky: true },
  };
  function matOf(name) {
    if (name === 'sticky') return MAT.pzstick;
    return MAT.pzrock;        // 'normal' (and anything else) → the rust wall
  }

  // ── the hand-authored levels ─────────────────────────────────────────────────────────────────────────
  // Helpers to keep authoring terse.
  function seg(ax, ay, bx, by, mat) { return { ax: ax, ay: ay, bx: bx, by: by, mat: mat || 'normal' }; }
  function rect(x, y, w, h, mat) { return { points: [[x, y], [x + w, y], [x + w, y + h], [x, y + h]], mat: mat || 'normal' }; }
  // a polyline of [x,y] points sharing one material → a chain of segments
  function poly(pts, mat) { var out = []; for (var i = 0; i < pts.length - 1; i++) out.push(seg(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], mat)); return out; }

  var PUZZLE_LEVELS = [

    // ───────────── LEVEL 1 — "Bank & Stick" — a 3-screen puzzle, cup up-and-right of the tee ───────────
    // The intended solve (a few shots):
    //   1. From the tee, BANK a flattish shot off the tall RIGHT WALL — it caroms back LEFT and drops onto
    //      the wide mid platform.
    //   2. From the mid platform, loft UP onto the STICKY green ledge (the ball lands on top and STOPS DEAD).
    //   3. Putt off the sticky ledge into the raised cup pocket on the right.
    // Big open bays so shots have room; the right wall is the bank surface, the green ledge is the stick.
    (function () {
      var W = 2400, Hh = 1400;
      var segs = [];
      var bodies = [];
      // outer frame
      segs = segs.concat(poly([[60, 80], [60, 1320]], 'normal'));             // left wall
      segs = segs.concat(poly([[2340, 80], [2340, 1320]], 'normal'));         // right wall (BANK off this)
      segs = segs.concat(poly([[60, 1320], [2340, 1320]], 'normal'));         // floor
      segs = segs.concat(poly([[60, 80], [2340, 80]], 'normal'));             // ceiling
      // tee plinth, bottom-left
      bodies.push(rect(120, 1240, 260, 80, 'normal'));
      // a wide mid platform the bank-shot caroms back onto (left-of-centre, mid height)
      bodies.push(rect(700, 920, 620, 46, 'normal'));                         // mid platform
      // the STICKY green ledge — sits ABOVE the mid platform's left end, the loft target
      bodies.push(rect(420, 620, 320, 40, 'sticky'));                         // sticky ledge (land on top)
      // a raised cup shelf on the RIGHT with a back-stop wall so the putt gathers into the pocket
      bodies.push(rect(1640, 560, 520, 46, 'normal'));                        // cup shelf
      segs.push(seg(2160, 560, 2160, 470, 'normal'));                         // right back-stop lip
      segs.push(seg(1640, 560, 1640, 510, 'normal'));                         // left lip (catch the putt)
      return {
        name: 'Bank & Stick', w: W, h: Hh,
        tee: { x: 250, y: 1240 - BR },
        cup: { x: 1900, y: 560 - BR },
        segments: segs,
        bodies: bodies,
      };
    })(),

    // ───────────── LEVEL 2 — "The Sticky Stair" — climb sticky steps, cup tucked behind a wall ─────────
    // Hop UP a staircase of STICKY ledges (each stops the ball dead so you re-aim from it), then loft over
    // a dividing wall and drop into the cup chamber on the far right. Generously spaced so each hop is one
    // controllable shot; the right wall is available as a bank if you over/under-cook a hop.
    (function () {
      var W = 2400, Hh = 1450;
      var segs = [];
      var bodies = [];
      segs = segs.concat(poly([[60, 80], [60, 1360]], 'normal'));             // left wall
      segs = segs.concat(poly([[2340, 80], [2340, 1360]], 'normal'));         // right wall (bank)
      segs = segs.concat(poly([[60, 1360], [2340, 1360]], 'normal'));         // floor
      segs = segs.concat(poly([[60, 80], [2340, 80]], 'normal'));             // ceiling
      // tee plinth bottom-left
      bodies.push(rect(120, 1280, 240, 80, 'normal'));
      // staircase of STICKY ledges climbing up-right (wide tops, easy to land on)
      bodies.push(rect(560, 1120, 300, 40, 'sticky'));                        // step 1
      bodies.push(rect(1040, 900, 300, 40, 'sticky'));                        // step 2
      bodies.push(rect(1520, 680, 300, 40, 'sticky'));                        // step 3 (top of the climb)
      // a dividing wall guarding the cup chamber (loft over it from step 3)
      bodies.push(rect(1980, 440, 90, 740, 'normal'));                        // divider wall
      // the cup chamber: a shelf on the far right past the divider, cup near the right wall
      bodies.push(rect(2080, 740, 260, 46, 'normal'));                        // cup chamber floor
      return {
        name: 'The Sticky Stair', w: W, h: Hh,
        tee: { x: 240, y: 1280 - BR },
        cup: { x: 2230, y: 740 - BR },
        segments: segs,
        bodies: bodies,
      };
    })(),

  ];

  // ── compile a level into a flat collider list (segments + every body edge) ───────────────────────────
  function compile(level) {
    var cols = [];
    for (var i = 0; i < level.segments.length; i++) {
      var s = level.segments[i];
      cols.push({ ax: s.ax, ay: s.ay, bx: s.bx, by: s.by, mat: s.mat });
    }
    if (level.bodies) {
      for (var b = 0; b < level.bodies.length; b++) {
        var bd = level.bodies[b], p = bd.points;
        for (var k = 0; k < p.length; k++) {
          var a = p[k], c = p[(k + 1) % p.length];
          cols.push({ ax: a[0], ay: a[1], bx: c[0], by: c[1], mat: bd.mat });
        }
      }
    }
    level._cols = cols;
    return level;
  }

  // closest point on segment AB to P (+ squared distance), lifted from the Stickman clone.
  function closestOnSeg(px, py, ax, ay, bx, by) {
    var abx = bx - ax, aby = by - ay;
    var apx = px - ax, apy = py - ay;
    var len2 = abx * abx + aby * aby || 1e-9;
    var t = (apx * abx + apy * aby) / len2;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    var cx = ax + abx * t, cy = ay + aby * t;
    var dx = px - cx, dy = py - cy;
    return { cx: cx, cy: cy, d2: dx * dx + dy * dy };
  }

  function level() { var p = A.cur(); return (p && p._level) ? p._level : null; }

  A.register({
    id: ID,
    name: 'Puzzle Mode',
    blurb: 'a Super Stickman Golf-style 2D hand-designed hole — bank off walls, stick to sticky greens, work it to the cup over several shots',
    course: {
      worldName: 'Puzzle Mode · the 2D hole',
      sky: '#140b0a',                                            // dark rust sky (matches the Mars-rust walls)
      defaultMaterial: 'rock', materials: ['rock'],
      archetypes: ['puzzle_void'],
      difficultyRange: [0.0, 0.0],
      holeDistMin: 600, holeDistMax: 600,
      holeCount: 1,
      cupElevation: function (tY) { return tY; },
      phys: { gravityScale: 1.0, windScale: 0 },
    },
    hooks: {
      // ── push the heightfield FAR BELOW the level so it never touches real play ───────────────────────
      beforeStart: function (p) {
        if (!window.RG) return;
        // pick the level (cycle with the same digit/[ ] keys the atlas uses isn't wired here; default 0,
        // or ?level=N on the URL for testing).
        var li = 0;
        var m = /[?&]level=(\d+)/i.exec(location.search);
        if (m) li = Math.max(0, Math.min(PUZZLE_LEVELS.length - 1, parseInt(m[1], 10)));
        p._levelIndex = li;
        var lv = compile(PUZZLE_LEVELS[li]);
        p._level = lv;
        // The generated heightfield (one ground line) sits at this Y — WAY below the 2D level (whose play
        // space is y∈[0, lv.h]). clampY pins every terrain vertex into this deep band, so the heightfield
        // is only a far OOB safety net and never collides with the authored geometry.
        var deep = lv.h + 2200;
        RG._clampYBand = [deep, deep + 200];
        RG._holeDistCap = 4000;                                  // unlock the one-screen distance cap
        RG._zoom = 1; RG._zoomPivot = { x: W_() / 2, y: H_() / 2 };
        RG._hideStrokeCounter = false;
      },

      // ── build geometry + place tee/cup + drop the ball; runs AFTER terrain + base tee placement ──────
      onStart: function (p) {
        var lv = p._level;
        if (!lv) return;
        // place tee + cup into holes[0] so the base score/par logic has sane data; hide the base flag
        // (we draw our own at the 2D cup). cupX/cupY are also our goal target.
        if (typeof holes !== 'undefined' && holes[0]) {
          holes[0].teeX = lv.tee.x; holes[0].teeY = lv.tee.y;
          holes[0].cupX = lv.cup.x; holes[0].cupY = lv.cup.y;
          holes[0].flagVisible = false;
        }
        // drop the ball on our tee
        if (typeof ball !== 'undefined') {
          ball.x = lv.tee.x; ball.y = lv.tee.y;
          ball.vx = 0; ball.vy = 0; ball.atRest = true; ball.onGround = true;
        }
        p._rest = { x: lv.tee.x, y: lv.tee.y };                  // last safe rest (for OOB reshoot)
        // prime the camera so the first frame is already on the tee (no snap)
        if (typeof camera !== 'undefined') { camera.x = lv.tee.x - W_() / 2; camera.y = lv.tee.y - H_() / 2; }
      },

      // ── 2D COLLISION — swept circle vs every collider; NORMAL banks, STICKY stops dead ───────────────
      collide: function (p) {
        if (!isPuzzle() || typeof ball === 'undefined') return false;
        var lv = p._level; if (!lv || !lv._cols) return false;
        var cols = lv._cols;
        var onGround = false;

        // ANTI-TUNNEL: if the ball moved far this substep, sub-sample the swept path and snap to the first
        // crossing so a fast bank shot can't pass through a thin wall. ball._px/_py = pre-move position.
        var px = (ball._px != null) ? ball._px : ball.x;
        var py = (ball._py != null) ? ball._py : ball.y;
        var mvx = ball.x - px, mvy = ball.y - py;
        var moved = Math.hypot(mvx, mvy);
        if (moved > BR) {
          var steps = Math.min(64, Math.ceil(moved / (BR * 0.75)));
          for (var st = 1; st <= steps; st++) {
            var t = st / steps;
            var sx = px + mvx * t, sy = py + mvy * t;
            var hit = false;
            for (var ci = 0; ci < cols.length; ci++) {
              var sc = cols[ci];
              var cc = closestOnSeg(sx, sy, sc.ax, sc.ay, sc.bx, sc.by);
              if (cc.d2 < BR * BR) { hit = true; break; }
            }
            if (hit) { ball.x = sx; ball.y = sy; break; }        // back the ball up to the entry point
          }
        }

        // RELAXATION PASSES — resolve corners cleanly (a few passes so overlapping edges settle).
        for (var pass = 0; pass < 3; pass++) {
          var any = false;
          for (var i = 0; i < cols.length; i++) {
            var s = cols[i];
            var m = matOf(s.mat);
            // sticky surfaces grab a hair early (BR+1.5) so a ball settling EXACTLY at rest distance on a
            // sticky top still sticks (a strict <BR misses the d==BR boundary). Normal surfaces stay strict.
            var grab = m.sticky ? (BR + 1.5) : BR;
            var c = closestOnSeg(ball.x, ball.y, s.ax, s.ay, s.bx, s.by);
            if (c.d2 >= grab * grab) continue;
            any = true;

            var d = Math.sqrt(c.d2);
            var nx, ny;
            if (d > 1e-4) { nx = (ball.x - c.cx) / d; ny = (ball.y - c.cy) / d; }
            else {
              // ball centre exactly on the line — use the segment normal opposing motion
              var ex = s.bx - s.ax, ey = s.by - s.ay;
              var el = Math.hypot(ex, ey) || 1; ex /= el; ey /= el;
              nx = -ey; ny = ex;
              if (nx * ball.vx + ny * ball.vy > 0) { nx = -nx; ny = -ny; }
              d = 0.001;
            }
            // push out of penetration
            var pen = BR - d;
            ball.x += nx * pen;
            ball.y += ny * pen;

            if (ny < -0.4) onGround = true;                      // top-facing surface → standable

            if (m.sticky) {
              // STICKY: the ball stops DEAD wherever it touched — on TOP, a WALL, or an UNDERSIDE — and
              // FREEZES there (atRest) until the player putts the next shot off it (the Stickman model).
              // We must set atRest so the engine stops integrating; otherwise gravity peels it off a wall
              // or underside next frame. The player's next drag relaunches it from this exact spot.
              ball.x += nx * 0.4;                                // settle just clear of the surface
              ball.y += ny * 0.4;
              ball.vx = 0; ball.vy = 0;
              ball.onGround = true; ball.atRest = true;
              ball.slowFrames = 0;
              ball.lastCollidedMat = 'rock';
              onGround = true;
              ball._stuck = true;
              p._rest = { x: ball.x, y: ball.y };                // putt the next shot from here
              return true;                                       // sticky owns the contact this substep
            }

            // NORMAL: split velocity into normal / tangent and respond by material.
            var vn = ball.vx * nx + ball.vy * ny;                // <0 = moving into the surface
            if (vn < 0) {
              var tvx = ball.vx - vn * nx, tvy = ball.vy - vn * ny;
              var speedIn = -vn;
              var BOUNCE_MIN = 0.45;                             // engine velocity units (px/frame)
              if (speedIn > BOUNCE_MIN) {
                var nb = speedIn * m.rest;
                ball.vx = tvx * m.tan + nx * nb;
                ball.vy = tvy * m.tan + ny * nb;
              } else {
                // resting contact: kill normal motion, keep tangential roll
                ball.vx = tvx;
                ball.vy = tvy;
              }
            }
            ball.lastCollidedMat = 'rock';
          }
          if (!any) break;
        }
        if (onGround) ball.onGround = true;
        return onGround;
      },

      // ── GOAL — rest (or crawl slowly) near the cup → holed ───────────────────────────────────────────
      isGoalReached: function (p) {
        if (!isPuzzle() || typeof ball === 'undefined') return undefined;
        var lv = p._level; if (!lv) return undefined;
        var dx = ball.x - lv.cup.x, dy = ball.y - lv.cup.y;
        var d = Math.hypot(dx, dy);
        var speed = Math.hypot(ball.vx, ball.vy);
        if (d < BR + 9 && speed < 4.5) {
          // snap into the cup
          ball.x = lv.cup.x; ball.y = lv.cup.y; ball.vx = 0; ball.vy = 0; ball.atRest = true;
          if (typeof holes !== 'undefined') return holes[currentHole] || true;
          return true;
        }
        return false;                                            // not yet — base sunken-cup is skipped
      },

      // ── OOB — fell outside the level bounds → reshoot from the last rest (handled here, return false) ─
      isOOB: function (p) {
        if (!isPuzzle() || typeof ball === 'undefined') return null;
        var lv = p._level; if (!lv) return null;
        var out = (ball.x < -40 || ball.x > lv.w + 40 || ball.y < -400 || ball.y > lv.h + 80);
        if (out && p._rest) {
          ball.x = p._rest.x; ball.y = p._rest.y; ball.vx = 0; ball.vy = 0;
          ball.atRest = true; ball.onGround = true; ball._stuck = false;
        }
        return false;                                            // never enter the base STATE_OOB path
      },

      // ── record the last safe rest (so OOB reshoots from where the ball actually came to rest) ─────────
      onRest: function (p) {
        if (!isPuzzle() || typeof ball === 'undefined') return false;
        var lv = p._level; if (!lv) return false;
        // only record a rest that is inside the level (not a mid-OOB snap)
        if (ball.x > 0 && ball.x < lv.w && ball.y > -200 && ball.y < lv.h) {
          p._rest = { x: ball.x, y: ball.y };
        }
        ball._stuck = false;
        return false;                                            // don't consume the rest
      },

      // ── CAMERA — free 2D follow, zoom to frame the puzzle, clamped to the level bounds ───────────────
      camera: function (p) {
        if (!isPuzzle() || typeof camera === 'undefined' || typeof ball === 'undefined') return false;
        var lv = p._level; if (!lv) return false;
        var W = W_(), H = H_();

        // zoom: out a touch in flight to show the nearby puzzle, in for precision while aiming.
        var aiming_ = (typeof state !== 'undefined' && state === STATE_AIM);
        var speed = Math.hypot(ball.vx, ball.vy);
        var ztarget;
        if (aiming_) ztarget = 0.92;                             // a hair out at address (see a bit of context)
        else ztarget = Math.max(0.62, Math.min(0.92, 0.92 - speed * 0.02));   // faster → zoom out to keep the shot framed
        var cz = (RG._zoom != null) ? RG._zoom : 1;
        RG._zoom = cz + (ztarget - cz) * 0.08;
        var z = RG._zoom;
        RG._zoomPivot = { x: W / 2, y: H / 2 };

        // follow the ball, centred. The camera transform (wrap.applyCameraTransform) is, with pivot=W/2,H/2:
        //   screenX = W/2 + z*(wx - camX - W/2)  → to put the ball at screen centre: camX = ball.x - W/2.
        var targetX = ball.x - W / 2;
        var targetY = ball.y - H / 2;

        // CLAMP to the level bounds so we never see past the edges. The visible world half-extent (from the
        // pivot at screen-centre) is (W/2)/z each way, so the valid camera centre range keeps [0,w]×[0,h]
        // outside the frame edges. When the level is smaller than the viewport on an axis, centre it.
        var halfW = (W / 2) / z, halfH = (H / 2) / z;
        // camera centre = camX + W/2 ; constrain centre ∈ [halfW, lv.w - halfW]
        var cxCenter = targetX + W / 2;
        if (lv.w >= 2 * halfW) cxCenter = Math.max(halfW, Math.min(lv.w - halfW, cxCenter));
        else cxCenter = lv.w / 2;
        var cyCenter = targetY + H / 2;
        if (lv.h >= 2 * halfH) cyCenter = Math.max(halfH, Math.min(lv.h - halfH, cyCenter));
        else cyCenter = lv.h / 2;
        targetX = cxCenter - W / 2;
        targetY = cyCenter - H / 2;

        var lerp = aiming_ ? 0.10 : 0.16;
        camera.x += (targetX - camera.x) * lerp;
        camera.y += (targetY - camera.y) * lerp;
        return true;
      },

      // ── RENDER — the level in OUR flat faceted art (world space, inside the camera transform) ────────
      frame: function (ctx, p) {
        if (!isPuzzle() || !ctx) return;
        var lv = p._level; if (!lv) return;

        // backdrop wash inside the level frame (subtle, so the geometry reads as the foreground)
        ctx.save();
        ctx.fillStyle = 'rgba(40,18,14,0.45)';
        ctx.fillRect(0, 0, lv.w, lv.h);
        ctx.restore();

        // ── solid bodies — fill with the material colour + a lighter lip on the TOP edge ──
        if (lv.bodies) {
          for (var b = 0; b < lv.bodies.length; b++) {
            var bd = lv.bodies[b], pts = bd.points, m = matOf(bd.mat);
            // body fill
            ctx.beginPath();
            ctx.moveTo(pts[0][0], pts[0][1]);
            for (var k = 1; k < pts.length; k++) ctx.lineTo(pts[k][0], pts[k][1]);
            ctx.closePath();
            // drop shadow for depth
            ctx.save();
            ctx.fillStyle = 'rgba(0,0,0,0.30)';
            ctx.translate(4, 6); ctx.fill(); ctx.restore();
            ctx.fillStyle = m.color; ctx.fill();
            // dark edge stroke
            ctx.lineWidth = 2; ctx.strokeStyle = m.edge; ctx.stroke();
            // lighter top lip (find the min-y edge run; rects → the top edge)
            var minY = Infinity, maxY = -Infinity;
            for (var q = 0; q < pts.length; q++) { if (pts[q][1] < minY) minY = pts[q][1]; if (pts[q][1] > maxY) maxY = pts[q][1]; }
            var minX = Infinity, maxX = -Infinity;
            for (var q2 = 0; q2 < pts.length; q2++) { if (pts[q2][0] < minX) minX = pts[q2][0]; if (pts[q2][0] > maxX) maxX = pts[q2][0]; }
            ctx.fillStyle = m.light;
            ctx.fillRect(minX, minY, maxX - minX, m.sticky ? 7 : 5);
            // sticky glow — a soft green bloom above the ledge so it reads as the "stick here" surface
            if (m.sticky) {
              ctx.save();
              var g = ctx.createLinearGradient(0, minY - 18, 0, minY + 4);
              g.addColorStop(0, 'rgba(47,240,122,0)');
              g.addColorStop(1, 'rgba(47,240,122,0.42)');
              ctx.fillStyle = g;
              ctx.fillRect(minX - 4, minY - 18, (maxX - minX) + 8, 22);
              ctx.restore();
            }
          }
        }

        // ── segments — walls / floors / ramps as thick strokes in the material colour ──
        for (var i = 0; i < lv.segments.length; i++) {
          var s = lv.segments[i], sm = matOf(s.mat);
          ctx.lineCap = 'round';
          ctx.lineWidth = 9; ctx.strokeStyle = sm.color;
          ctx.beginPath(); ctx.moveTo(s.ax, s.ay); ctx.lineTo(s.bx, s.by); ctx.stroke();
          // a thin lighter core line for the flat-art lip
          ctx.lineWidth = 3; ctx.strokeStyle = sm.light;
          ctx.beginPath(); ctx.moveTo(s.ax, s.ay); ctx.lineTo(s.bx, s.by); ctx.stroke();
          if (sm.sticky) {
            ctx.save(); ctx.globalAlpha = 0.5; ctx.lineWidth = 16; ctx.strokeStyle = 'rgba(47,240,122,0.35)';
            ctx.beginPath(); ctx.moveTo(s.ax, s.ay); ctx.lineTo(s.bx, s.by); ctx.stroke(); ctx.restore();
          }
        }

        // ── the cup + our flag (engine flag look: pole + gold pennant) ──
        var cx = lv.cup.x, cy = lv.cup.y;
        // cup mouth (dark indent on the pad)
        ctx.fillStyle = '#1a0f0c';
        ctx.beginPath(); ctx.ellipse(cx, cy + BR - 1, 12, 5, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#2a1712';
        ctx.fillRect(cx - 11, cy + BR - 4, 22, 8);
        // flag pole + gold pennant (matches drawFlag's look)
        var poleH = 56, poleTopY = cy - poleH;
        ctx.strokeStyle = '#7888a0'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(cx, cy + BR - 2); ctx.lineTo(cx, poleTopY); ctx.stroke();
        ctx.fillStyle = '#e8c840';
        ctx.beginPath();
        ctx.moveTo(cx, poleTopY); ctx.lineTo(cx + 24, poleTopY + 7);
        ctx.lineTo(cx + 30, poleTopY + 13); ctx.lineTo(cx + 24, poleTopY + 17);
        ctx.lineTo(cx, poleTopY + 16); ctx.closePath(); ctx.fill();

        // ── tee marker (small chevron at the tee, fades once you've shot) ──
        if (typeof strokes !== 'undefined' && strokes === 0) {
          ctx.fillStyle = 'rgba(255,255,255,0.5)';
          ctx.beginPath();
          ctx.moveTo(lv.tee.x, lv.tee.y - BR - 14);
          ctx.lineTo(lv.tee.x - 6, lv.tee.y - BR - 24);
          ctx.lineTo(lv.tee.x + 6, lv.tee.y - BR - 24);
          ctx.closePath(); ctx.fill();
        }
      },

      // ── SCREEN-space label (level name + shot count) ─────────────────────────────────────────────────
      frameScreen: function (ctx, p) {
        if (!isPuzzle() || !ctx) return;
        var lv = p._level; if (!lv) return;
        ctx.save();
        ctx.textAlign = 'left';
        ctx.font = "12px 'Departure Mono', monospace";
        ctx.fillStyle = 'rgba(255,255,255,0.72)';
        ctx.fillText('PUZZLE · ' + lv.name, 18, H_() - 18);
        ctx.restore();
      },
    },
  });

  // The flat 'void' archetype the heightfield uses — a dead-flat line far below the level (clampY pins it
  // into the deep band set in beforeStart). It only ever serves as the OOB safety floor.
  if (typeof archetypes !== 'undefined' && !archetypes.puzzle_void) {
    archetypes.puzzle_void = function (sx, sy, dist) {
      return [{ x: sx, y: (typeof clampY === 'function') ? clampY(sy) : sy },
              { x: sx + dist, y: (typeof clampY === 'function') ? clampY(sy) : sy }];
    };
    if (typeof ARCHETYPE_TABLE !== 'undefined') ARCHETYPE_TABLE.push(['puzzle_void', 0, 1, 1]);
  }
})();
