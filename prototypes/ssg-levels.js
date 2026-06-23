// ═══════════════════════════════════════════════════════════════════════════════
//  ssg-levels.js — PAR SEC · SSG CAMPAIGN — the designed-levels data
//  A 10-level hand-designed campaign (see docs/STICKMAN-LEVELS-PLAN.md) built on
//  the nailed SSG camera in ssg-camera.html. Levels are pure data; the html loads
//  this array and runs the camera + physics over each.
//
//  LEVEL FORMAT:
//    { name, sub, w, h, par, tee:{x,y}, cup:{x,y},
//      segments:[{ax,ay,bx,by,mat}],          // line colliders (walls/floors/ramps)
//      bodies:[{points:[[x,y]...], mat}],      // closed polygons (platforms/blocks)
//      solve:[ [angleDeg, power01], ... ] }    // a verified headless solve (intended line)
//  mat ∈ 'rock' | 'sticky' | 'ice' | 'sand' | 'water' | 'bound'. +y is DOWN.
//  World units = px; matches PHYS in ssg-camera.html (GRAVITY 2100, MAX_LAUNCH 1850,
//  BALL_R 11). angleDeg: 0=right, +y is DOWN (screen convention), so up-right ≈ -50.
// ═══════════════════════════════════════════════════════════════════════════════
(function () {
  var BR = 11;

  // ── terse authoring helpers (mirror ssg-camera.html) ─────────────────────────
  function seg(ax, ay, bx, by, mat) { return { ax: ax, ay: ay, bx: bx, by: by, mat: mat || 'rock' }; }
  function rect(x, y, w, h, mat) { return { points: [[x, y], [x + w, y], [x + w, y + h], [x, y + h]], mat: mat || 'rock' }; }
  function poly(pts, mat) { var o = []; for (var i = 0; i < pts.length - 1; i++) o.push(seg(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], mat)); return o; }
  // outer frame walls (dim 'bound' rust) for a W×H level
  function frame(W, H, m) {
    var s = [];
    s = s.concat(poly([[m, m], [m, H - m]], 'bound'));        // left
    s = s.concat(poly([[W - m, m], [W - m, H - m]], 'bound')); // right
    s = s.concat(poly([[m, H - m], [W - m, H - m]], 'bound')); // floor
    s = s.concat(poly([[m, m], [W - m, m]], 'bound'));        // ceiling
    return s;
  }

  var LEVELS = [

    // ───────── 1 · First Light — T — basic shot + bank ─────────
    (function () {
      var W = 2200, H = 1300, segs = frame(W, H, 60), bodies = [];
      bodies.push(rect(150, H - 280, 280, 220, 'rock'));          // tee plinth
      bodies.push(rect(980, H - 460, 120, 400, 'rock'));          // low divider mid-bay
      bodies.push(rect(1560, H - 360, 520, 56, 'rock'));          // cup shelf (right)
      return {
        name: 'First Light', sub: 'aim · loft · sink', w: W, h: H, par: 2,
        tee: { x: 290, y: H - 280 - BR }, cup: { x: 1820, y: H - 360 - BR },
        segments: segs, bodies: bodies,
        solve: [[-64, 0.9], [-54, 0.875]]
      };
    })(),

    // ───────── 2 · Caroms — T — bank wall as a tool ─────────
    (function () {
      var W = 2300, H = 1300, segs = frame(W, H, 60), bodies = [];
      bodies.push(rect(150, H - 280, 260, 220, 'rock'));          // tee plinth
      bodies.push(rect(820, H - 420, 1060, 56, 'rock'));          // cup shelf
      // ROOF over the cup, sealed on the LEFT so a loft-under is impossible: the only
      // entry is from the RIGHT wall bank. Roof spans further left + a left lip wall.
      bodies.push(rect(820, H - 700, 1060, 56, 'rock'));          // roof over the cup
      segs.push(seg(820, H - 700, 820, H - 420, 'rock'));         // LEFT wall seals the pocket
      // cup tucked at the right end of the shelf, open only to the right wall bank
      return {
        name: 'Caroms', sub: 'bank it home', w: W, h: H, par: 2,
        tee: { x: 290, y: H - 280 - BR }, cup: { x: 1740, y: H - 420 - BR },
        segments: segs, bodies: bodies,
        solve: [[-56, 0.975], [-24, 0.85]]
      };
    })(),

    // ───────── 3 · Flypaper — T — sticky ─────────
    (function () {
      var W = 2200, H = 1300, segs = frame(W, H, 60), bodies = [];
      bodies.push(rect(150, H - 280, 240, 220, 'rock'));          // tee plinth
      bodies.push(rect(820, 470, 520, 46, 'sticky'));             // sticky ledge (land on TOP)
      bodies.push(rect(1560, H - 360, 520, 56, 'rock'));          // cup shelf (right)
      return {
        name: 'Flypaper', sub: 'stick, then putt', w: W, h: H, par: 3,
        tee: { x: 280, y: H - 280 - BR }, cup: { x: 1820, y: H - 360 - BR },
        segments: segs, bodies: bodies,
        solve: [[-62, 0.875], [-54, 0.95]]
      };
    })(),

    // ───────── 4 · The Skating Rink — D — ice (slippery) ─────────
    (function () {
      var W = 2400, H = 1150, segs = frame(W, H, 60), bodies = [];
      bodies.push(rect(150, H - 260, 220, 200, 'rock'));          // tee plinth
      // long ICE floor running to the cup at the far end
      bodies.push(rect(370, H - 120, 1640, 60, 'ice'));           // ice floor
      bodies.push(rect(2010, H - 120, 330, 60, 'rock'));          // rock landing at cup end
      segs.push(seg(2340 - 60, H - 120, 2340 - 60, H - 360, 'rock')); // back wall (backstop)
      return {
        name: 'The Skating Rink', sub: 'soft touch — it skates', w: W, h: H, par: 2,
        tee: { x: 280, y: H - 260 - BR }, cup: { x: 2150, y: H - 120 - BR },
        segments: segs, bodies: bodies,
        solve: [[-14, 0.65]]
      };
    })(),

    // ───────── 5 · Plugged — D — sand (dead) / carry ─────────
    (function () {
      var W = 2400, H = 1200, segs = frame(W, H, 60), bodies = [];
      bodies.push(rect(150, H - 300, 240, 240, 'rock'));          // tee plinth
      // SAND pit across the middle (land here = plugged/dead)
      bodies.push(rect(470, H - 120, 1340, 60, 'sand'));          // sand pit
      bodies.push(rect(1810, H - 300, 530, 56, 'rock'));          // green shelf past the sand
      segs.push(seg(2340 - 60, H - 300, 2340 - 60, H - 560, 'rock')); // back wall
      return {
        name: 'Plugged', sub: 'carry the sand', w: W, h: H, par: 2,
        tee: { x: 290, y: H - 300 - BR }, cup: { x: 2080, y: H - 300 - BR },
        segments: segs, bodies: bodies,
        solve: [[-54, 0.975], [-84, 0.875]]
      };
    })(),

    // ───────── 6 · Two Ways Up — D — multi-route (safe vs hero) ─────────
    (function () {
      var W = 2300, H = 1500, segs = frame(W, H, 60), bodies = [];
      bodies.push(rect(150, H - 280, 220, 220, 'rock'));          // tee plinth
      // SAFE staircase: two sticky steps climbing up-right
      bodies.push(rect(560, H - 560, 280, 40, 'sticky'));         // step 1
      bodies.push(rect(1020, H - 860, 280, 40, 'sticky'));        // step 2
      // high sticky PAD next to the cup (both routes converge here)
      bodies.push(rect(1500, 360, 360, 44, 'sticky'));            // high sticky pad
      bodies.push(rect(1860, 560, 380, 56, 'rock'));              // cup shelf (right of pad)
      return {
        name: 'Two Ways Up', sub: 'climb safe — or bank the hero line', w: W, h: H, par: 3,
        tee: { x: 280, y: H - 280 - BR }, cup: { x: 2120, y: 560 - BR },
        segments: segs, bodies: bodies,
        // SAFE solve: tee→step1→step2→pad→cup
        solve: [[-76, 0.95], [-78, 0.95], [-68, 0.875]]
      };
    })(),

    // ───────── 7 · Threadneedle — C — tunnel threading ─────────
    (function () {
      var W = 2300, H = 1400, segs = frame(W, H, 60), bodies = [];
      bodies.push(rect(150, H - 280, 240, 220, 'rock'));          // tee plinth
      // a tall block wall with a vertical GAP that's the only way through
      bodies.push(rect(900, 110, 360, 720, 'rock'));              // upper block (above the gap)
      bodies.push(rect(900, 1010, 360, 330, 'rock'));             // lower block (below the gap)
      // gap is y∈[830,1010] at x∈[900,1260] — thread it
      bodies.push(rect(1500, H - 360, 740, 56, 'rock'));          // cup chamber floor (right)
      segs.push(seg(2340 - 60, H - 360, 2340 - 60, H - 620, 'rock')); // chamber back wall
      return {
        name: 'Threadneedle', sub: 'thread the gap', w: W, h: H, par: 3,
        tee: { x: 290, y: H - 280 - BR }, cup: { x: 1980, y: H - 360 - BR },
        segments: segs, bodies: bodies,
        solve: [[-34, 0.9]]
      };
    })(),

    // ───────── 8 · Cold Shoulder — C — ice bank + ice green ─────────
    // The cup hides in a right-hand pocket behind a tall rock barrier; a direct shot
    // is blocked. A big ICE BANK wall sits high-left: bank a hard shot up off it and
    // the lively ice rebound carries the ball OVER the barrier onto the ice green,
    // where it skates to a stop by the cup. Read the lively bounce + the slick run.
    (function () {
      var W = 2400, H = 1350, segs = frame(W, H, 60), bodies = [];
      bodies.push(rect(150, H - 280, 220, 220, 'rock'));          // tee plinth (bottom-left)
      // TALL rock barrier in the middle — blocks a direct shot to the cup pocket
      bodies.push(rect(1180, H - 620, 120, 560, 'rock'));         // central barrier wall
      // ICE BANK wall: a slab up-left the ball caroms UP-and-RIGHT off, over the barrier
      bodies.push(rect(700, 360, 230, 70, 'ice'));                // ice bank slab (overhead-left)
      // ICE GREEN: a shelf in the right pocket, cup at its far (right) end
      bodies.push(rect(1300, H - 360, 1040, 56, 'ice'));          // ice green shelf
      bodies.push(rect(2284, H - 360, 56, 56, 'rock'));           // rock backstop nib at cup end
      segs.push(seg(2340 - 60, H - 360, 2340 - 60, H - 700, 'rock')); // pocket back wall
      return {
        name: 'Cold Shoulder', sub: 'bank the ice — read the run', w: W, h: H, par: 3,
        tee: { x: 280, y: H - 280 - BR }, cup: { x: 2200, y: H - 360 - BR },
        segments: segs, bodies: bodies,
        solve: [[-64, 0.975]]   // bank up off the ice slab → over the barrier → ice green
      };
    })(),

    // ───────── 9 · Sand & Stick — C — sand + sticky + bank ─────────
    (function () {
      var W = 2400, H = 1300, segs = frame(W, H, 60), bodies = [];
      bodies.push(rect(150, H - 300, 220, 240, 'rock'));          // tee plinth
      // SAND floor across the bay (dead — don't land here)
      bodies.push(rect(430, H - 120, 1500, 60, 'sand'));          // sand floor
      // STICKY wall to hang from (over the sand) to re-aim
      bodies.push(rect(900, 360, 56, 560, 'sticky'));             // sticky wall
      // cup tucked under a roof on the right → bank in
      bodies.push(rect(1700, H - 420, 640, 56, 'rock'));          // cup shelf
      bodies.push(rect(1700, H - 660, 640, 56, 'rock'));          // roof over the cup
      return {
        name: 'Sand & Stick', sub: 'hang · putt · bank', w: W, h: H, par: 4,
        tee: { x: 280, y: H - 300 - BR }, cup: { x: 1940, y: H - 420 - BR },
        segments: segs, bodies: bodies,
        // 1) stick to the sticky wall over the sand  2) putt off, bank the right wall
        solve: [[-18, 0.95], [-76, 0.75]]
      };
    })(),

    // ───────── 10 · The Gauntlet — S — everything (signature) ─────────
    (function () {
      var W = 3000, H = 1700, segs = frame(W, H, 60), bodies = [];
      bodies.push(rect(150, H - 320, 240, 260, 'rock'));          // tee plinth (bottom-left)
      // (1) WATER hazard to carry off a bank
      bodies.push(rect(470, H - 100, 760, 40, 'water'));          // water band
      bodies.push(rect(1230, H - 120, 360, 60, 'sand'));          // (2) sand trap (avoid)
      bodies.push(rect(1590, H - 320, 360, 56, 'rock'));          // safe rock landing past sand
      // (3) high sticky PAD up-left of centre
      bodies.push(rect(1700, 520, 360, 44, 'sticky'));            // high sticky pad
      // (4) ICE ledge running right from under the pad
      bodies.push(rect(2060, 720, 520, 50, 'ice'));               // ice ledge
      // (5) thread gap: two blocks with a vertical gap before the cup chamber
      bodies.push(rect(2580, 110, 150, 560, 'rock'));             // gap upper block
      bodies.push(rect(2580, 870, 150, 770, 'rock'));             // gap lower block (gap y∈[670,870])
      // (6) tucked cup pocket on the far right
      bodies.push(rect(2730, 760, 210, 56, 'rock'));              // cup pocket floor
      segs.push(seg(2940 - 60 + 60, 760, 2940 - 60 + 60, 560, 'rock')); // (handled by right bound)
      return {
        name: 'The Gauntlet', sub: 'everything, all at once', w: W, h: H, par: 5,
        tee: { x: 290, y: H - 320 - BR }, cup: { x: 2840, y: 760 - BR },
        segments: segs, bodies: bodies,
        // multi-shot signature solve (refined by the headless solver)
        solve: [[-62, 0.975], [-84, 0.925], [-82, 0.975], [-80, 0.875]]
      };
    })()

  ];

  // expose to the html
  window.SSG_LEVELS = LEVELS;
})();
