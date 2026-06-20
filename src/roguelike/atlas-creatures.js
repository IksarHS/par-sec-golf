// ── atlas-creatures.js — LIFE planets: wordless creatures that are part of the hazard ───────────────
// Discovery/narrative axis (wordless): a planet has living things that react to your ball. v1 is "Fen",
// a bog where lurkers GUARD stretches of ground — touch down in a guarded zone and the creature takes
// your ball (a reshoot, like any hazard). The creature paces its zone and a pulsing danger-band marks
// the no-land ground, so the hazard is always LEGIBLE (motion conveyed visually, per the house rule).
//
// Determinism/fairness: the hazard is a ZONE that is a pure function of hole geometry, enforced via the
// isOOB() hook — which the engine (and the bot's simulateShot) runs every frame, so the creature is
// fully bot-predictable and avoidable. The creature's pacing/eye animation is wall-clock COSMETIC only
// and never affects the hazard. Peel this file + its <script> tag off → these planets vanish.
(function () {
  if (typeof window === 'undefined' || !window.RG_ATLAS) return;
  var A = window.RG_ATLAS;
  var _clk = 0;

  function zonesFor(p) { return p._zones && p._zones[(typeof currentHole !== 'undefined') ? currentHole : 0]; }
  function groundY(x) { return (typeof terrainYAt === 'function') ? terrainYAt(x) : 0; }

  A.register({
    id: 'creature-fen', name: 'Fen', blurb: 'lurkers guard the low ground — carry over them or lay up short',
    mats: [['bog', 'grass', { restitution: 0.25, rollingFriction: 0.93, surfaceFriction: 0.012, color: '#3a5a44', colorLight: '#4e7257' }]],
    course: { worldName: 'Fen · the lurkers', sky: '#081814', defaultMaterial: 'bog', materials: ['bog'],
      archetypes: ['valley', 'gentle_hill', 'shelf', 'rolling_hills', 'mesa'],
      difficultyRange: [0.2, 0.5], holeDistMin: 480, holeDistMax: 740, phys: { gravityScale: 0.9, windScale: 0 } },
    hooks: {
      onStart: function (p) {
        p._zones = [];
        var n = (typeof holes !== 'undefined') ? holes.length : 0;
        for (var i = 0; i < n; i++) {
          var h = holes[i]; if (!h) { p._zones.push([]); continue; }
          var span = h.cupX - h.teeX, dir = span >= 0 ? 1 : -1, aspan = Math.abs(span);
          var cx = h.teeX + span * 0.55;                       // a lurker guards the mid-low ground
          var hw = Math.max(48, Math.min(116, aspan * 0.13));
          var z = [{ x1: cx - hw, x2: cx + hw, cx: cx, hw: hw }];
          if (i >= 1 && aspan > 520) {                         // a second lurker on longer holes
            var cx2 = h.teeX + span * 0.30; z.push({ x1: cx2 - 44, x2: cx2 + 44, cx: cx2, hw: 44 });
          }
          // keep zones clear of the tee and the cup so every hole is finishable
          z = z.filter(function (zz) { return Math.abs(zz.cx - h.teeX) > 70 && Math.abs(zz.cx - h.cupX) > 80; });
          p._zones.push(z);
        }
      },
      // touch DOWN inside a lurker's ground = taken (OOB reshoot). Flying over high is safe. Bot-visible.
      isOOB: function (p) {
        if (typeof ball === 'undefined' || !ball.onGround) return null;
        var z = zonesFor(p); if (!z) return null;
        for (var i = 0; i < z.length; i++) if (ball.x > z[i].x1 && ball.x < z[i].x2) return true;
        return null;
      },
      frame: function (ctx, p) {
        var z = zonesFor(p); if (!z) return;
        _clk += 1;
        var bx = (typeof ball !== 'undefined') ? ball.x : 0;
        for (var i = 0; i < z.length; i++) {
          var zz = z[i];
          // danger ground band — pulsing, follows the terrain top, so the no-land strip is unmistakable
          var pulse = 0.16 + 0.10 * Math.sin(_clk * 0.07 + i);
          ctx.fillStyle = 'rgba(210,70,60,' + pulse.toFixed(3) + ')';
          ctx.beginPath();
          var step = 8, first = true;
          for (var x = zz.x1; x <= zz.x2; x += step) { var gy = groundY(x); if (first) { ctx.moveTo(x, gy); first = false; } else ctx.lineTo(x, gy); }
          ctx.lineTo(zz.x2, groundY(zz.x2) + 26); ctx.lineTo(zz.x1, groundY(zz.x1) + 26); ctx.closePath(); ctx.fill();
          // the lurker — paces within its zone; its eye tracks the ball; mouth opens when the ball is near
          var pace = Math.sin(_clk * 0.018 + i * 1.7) * (zz.hw * 0.55);
          var lx = zz.cx + pace, ly = groundY(lx) - 1;
          var near = Math.abs(bx - zz.cx) < zz.hw * 1.5;
          ctx.fillStyle = '#0c1a14';
          ctx.beginPath(); ctx.ellipse(lx, ly - 9, 17, 12, 0, Math.PI, 0); ctx.fill();   // dome body sitting on the ground
          ctx.beginPath(); ctx.ellipse(lx, ly, 18, 5, 0, 0, Math.PI * 2); ctx.fill();
          // eye (tracks the ball)
          var ex = lx + Math.max(-3, Math.min(3, (bx - lx) * 0.02));
          ctx.fillStyle = near ? '#ffd24a' : '#9fb86a';
          ctx.beginPath(); ctx.arc(ex, ly - 12, 3.2, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = '#0c1a14'; ctx.beginPath(); ctx.arc(ex + (bx > lx ? 1 : -1), ly - 12, 1.4, 0, Math.PI * 2); ctx.fill();
          if (near) {   // a teeth glint when it's alert — the "danger now" tell
            ctx.strokeStyle = 'rgba(255,235,200,0.7)'; ctx.lineWidth = 1;
            ctx.beginPath(); ctx.moveTo(lx - 8, ly - 2); ctx.lineTo(lx - 5, ly + 1); ctx.moveTo(lx, ly - 2); ctx.lineTo(lx + 3, ly + 1); ctx.stroke();
          }
        }
      },
    },
  });

  // ── BULBORIA — soft sleepers nap across the fairway. Land GENTLY near one and the ball settles
  //    (safe); drive into one HARD and it wakes and eats the ball. Tenderness scores. ──
  A.register({
    id: 'creature-bulb', name: 'Bulboria', blurb: 'soft sleepers nap on the green — lob gently; a hard drive wakes one and it eats the ball',
    mats: [['moss', 'grass', { restitution: 0.30, rollingFriction: 0.93, surfaceFriction: 0.011, color: '#46684c', colorLight: '#5a8060' }]],
    course: { worldName: 'Bulboria · the sleepers', sky: '#0a1710', defaultMaterial: 'moss', materials: ['moss'],
      archetypes: ['gentle_slope', 'rolling_hills', 'valley', 'shelf', 'gentle_hill'],
      difficultyRange: [0.2, 0.45], holeDistMin: 460, holeDistMax: 720, phys: { gravityScale: 0.85, windScale: 0 } },
    _wake: 4.6,   // impact speed above which a sleeper wakes (and eats)
    hooks: {
      onStart: function (p) {
        p._sleep = [];
        var n = (typeof holes !== 'undefined') ? holes.length : 0;
        for (var i = 0; i < n; i++) {
          var h = holes[i]; if (!h) { p._sleep.push([]); continue; }
          var span = h.cupX - h.teeX, items = [];
          for (var k = 0; k < 3; k++) { var cx = h.teeX + span * (0.4 + k * 0.18); items.push({ x1: cx - 40, x2: cx + 40, cx: cx, hw: 40 }); }
          items = items.filter(function (z) { return Math.abs(z.cx - h.teeX) > 70 && Math.abs(z.cx - h.cupX) > 64; });
          p._sleep.push(items);
        }
      },
      isOOB: function (p) {
        if (typeof ball === 'undefined' || !ball.onGround) return null;
        var z = p._sleep[(typeof currentHole !== 'undefined') ? currentHole : 0]; if (!z) return null;
        var sp = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
        for (var i = 0; i < z.length; i++) if (ball.x > z[i].x1 && ball.x < z[i].x2 && sp > p._wake) return true;   // woke it
        return null;
      },
      frame: function (ctx, p) {
        var z = p._sleep[(typeof currentHole !== 'undefined') ? currentHole : 0]; if (!z) return;
        var bx = (typeof ball !== 'undefined') ? ball.x : 0, bsp = (typeof ball !== 'undefined') ? Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy) : 0;
        for (var i = 0; i < z.length; i++) {
          var zz = z[i], gy = groundY(zz.cx) - 1;
          var alert = Math.abs(bx - zz.cx) < zz.hw * 1.8 && bsp > p._wake * 0.6;   // it stirs when a fast ball nears
          // soft rounded body
          ctx.fillStyle = alert ? '#7a8f5e' : '#3f5a44';
          ctx.beginPath(); ctx.ellipse(zz.cx, gy - 7, 22, 14, 0, Math.PI, 0); ctx.fill();
          ctx.beginPath(); ctx.ellipse(zz.cx, gy, 23, 6, 0, 0, Math.PI * 2); ctx.fill();
          // eyes: closed (sleeping) curve, or open dots when alert
          ctx.strokeStyle = '#0c160e'; ctx.lineWidth = 1.4;
          if (alert) { ctx.fillStyle = '#ffe6a0'; ctx.beginPath(); ctx.arc(zz.cx - 6, gy - 9, 2.4, 0, Math.PI * 2); ctx.arc(zz.cx + 6, gy - 9, 2.4, 0, Math.PI * 2); ctx.fill(); }
          else { ctx.beginPath(); ctx.arc(zz.cx - 6, gy - 9, 3, 0.2, Math.PI - 0.2); ctx.arc(zz.cx + 6, gy - 9, 3, 0.2, Math.PI - 0.2); ctx.stroke(); }
        }
      },
    },
  });
})();
