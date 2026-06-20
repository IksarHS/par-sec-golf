// ── atlas-portals.js — PORTAL planet: wormholes that jump the ball across the hole ───────────────
// A new mechanic: each hole has a one-way portal pair. Fly the ball into portal A and it re-emerges
// from portal B still carrying its momentum — a shortcut across the hole. The jump happens in the
// force() hook (wrap.js collide(), every physics substep, INCLUDING the bot sim) so it is lawful and
// bot-predictable. Determinism: portal positions are a pure function of hole geometry. Motion is
// conveyed by a swirling ring + inflowing motes so the portals read as active. Peel the file off → gone.
(function () {
  if (typeof window === 'undefined' || !window.RG_ATLAS) return;
  var A = window.RG_ATLAS;
  var _clk = 0;

  A.register({
    id: 'portal-warp', name: 'Lagrange', blurb: 'wormholes carry your ball across the hole — fly into the blue ring',
    course: { worldName: 'Lagrange · wormholes', sky: '#070a16', defaultMaterial: 'dust', materials: ['dust'],
      archetypes: ['flat_run', 'gentle_slope', 'valley', 'shelf', 'rolling_hills'],
      difficultyRange: [0.12, 0.4], holeDistMin: 520, holeDistMax: 780, phys: { gravityScale: 0.55, windScale: 0 } },
    _r: 26,            // portal trigger/visual radius
    hooks: {
      onStart: function (p) {
        p._pairs = [];
        var n = (typeof holes !== 'undefined') ? holes.length : 0;
        for (var i = 0; i < n; i++) {
          var h = holes[i]; if (!h) { p._pairs.push(null); continue; }
          var span = h.cupX - h.teeX, topY = Math.min(h.teeY, h.cupY);
          // A on the rising part of the arc; B further along + a touch above the cup approach, so the
          // ball pops out still heading toward the cup. One-way A -> B.
          var a = { x: h.teeX + span * 0.34, y: topY - 70 };
          var b = { x: h.teeX + span * 0.74, y: topY - 36 };
          p._pairs.push({ a: a, b: b, _cool: false });
        }
      },
      force: function (p) {
        if (typeof ball === 'undefined' || ball.atRest || ball.onGround) return;
        var pr = p._pairs && p._pairs[(typeof currentHole !== 'undefined') ? currentHole : 0]; if (!pr) return;
        var r2 = p._r * p._r;
        var ax = ball.x - pr.a.x, ay = ball.y - pr.a.y, da2 = ax * ax + ay * ay;
        var bx = ball.x - pr.b.x, by = ball.y - pr.b.y, db2 = bx * bx + by * by;
        // re-entry latch: after a jump, don't fire again until the ball has cleared BOTH mouths. A pure
        // function of ball position, so it self-heals at the start of every shot (ball starts at the tee,
        // clear of both) and stays identical in the bot sim. Without it the ball can oscillate A<->B.
        if (pr._cool) { if (da2 > r2 && db2 > r2) pr._cool = false; return; }
        if (da2 <= r2) {
          var sp = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy) || 1;
          var ux = ball.vx / sp, uy = ball.vy / sp;
          ball.x = pr.b.x + ux * (p._r + 7);          // exit just past B, along the travel direction
          ball.y = pr.b.y + uy * (p._r + 7);          // momentum preserved (a clean wormhole)
          pr._cool = true;
        }
      },
      frame: function (ctx, p) {
        var pr = p._pairs && p._pairs[(typeof currentHole !== 'undefined') ? currentHole : 0]; if (!pr) return;
        _clk += 1;
        drawPortal(ctx, pr.a.x, pr.a.y, p._r, '#5aa0ff', _clk);          // A = blue (entry)
        drawPortal(ctx, pr.b.x, pr.b.y, p._r, '#ff9a5a', -_clk);         // B = amber (exit)
      },
    },
  });

  function drawPortal(ctx, x, y, r, col, clk) {
    // ring
    ctx.strokeStyle = col; ctx.globalAlpha = 0.9; ctx.lineWidth = 2.4;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke();
    ctx.globalAlpha = 0.4; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(x, y, r * 0.66, 0, Math.PI * 2); ctx.stroke();
    // inflowing motes (the swirl — conveys it's active)
    ctx.globalAlpha = 0.85; ctx.fillStyle = col;
    for (var m = 0; m < 7; m++) {
      var ang = (clk * 0.06 + m * (Math.PI * 2 / 7));
      var rr = r * (0.85 - ((clk * 0.5 + m * 20) % 60) / 60 * 0.7);
      ctx.beginPath(); ctx.arc(x + Math.cos(ang) * rr, y + Math.sin(ang) * rr, 1.5, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
})();
