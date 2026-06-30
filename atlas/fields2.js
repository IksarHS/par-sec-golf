// ── atlas-fields2.js — more FORCE-FIELD planets (all via the bot-simulatable force() hook) ────────
// Each gimmick is a force applied in wrap.js collide() (every physics substep, incl. the bot sim), so
// trajectories are lawful + bot-predictable. Motion is always conveyed visually (the house rule):
// streaks, drifting motes, pulse-rings, flow chevrons. Determinism: all field geometry is a pure
// function of hole layout, never the terrain PRNG. Peel the file + its <script> tag off → all gone.
(function () {
  if (typeof window === 'undefined' || !window.RG_ATLAS) return;
  var A = window.RG_ATLAS;
  var _clk = 0;
  function air() { return typeof ball !== 'undefined' && !ball.atRest && !ball.onGround; }
  function curHole() { return (typeof holes !== 'undefined') ? holes[(typeof currentHole !== 'undefined') ? currentHole : 0] : null; }
  function camx() { return (typeof camera !== 'undefined') ? camera.x : 0; }
  function camy() { return (typeof camera !== 'undefined') ? (camera.y || 0) : 0; }

  // ── HELION — gravity is normal below a line, but FLIPS UP above it. Keep every shot LOW, or the
  //    ball is sucked off the top of the world (the lawful "ceiling gravity"). ──
  A.register({
    id: 'field-updraft', name: 'Helion', blurb: 'gravity flips UPWARD above the shimmer — keep it low or lose it to the sky',
    course: { worldName: 'Helion · the ceiling void', sky: '#241a2e', defaultMaterial: 'dust', materials: ['dust'],
      archetypes: ['flat_run', 'gentle_slope', 'downhill', 'rolling_hills', 'shelf'],
      cupElevation: function (teeY) { return teeY + 10 + random() * 40; },          // low cups so a flat shot suffices
      difficultyRange: [0.15, 0.45], holeDistMin: 460, holeDistMax: 720, phys: { gravityScale: 0.85, windScale: 0 } },
    _up: 0.16,
    hooks: {
      onStart: function (p) { p._line = []; var n = holes ? holes.length : 0; for (var i = 0; i < n; i++) { var h = holes[i]; p._line.push(h ? (Math.min(h.teeY, h.cupY) - H * 0.40) : 0); } },
      force: function (p) { if (!air()) return; var ly = p._line[(typeof currentHole !== 'undefined') ? currentHole : 0]; if (ball.y < ly) ball.vy -= p._up; },
      isOOB: function (p) { var h = curHole(); if (!h) return null; if (ball.y < h.teeY - H * 1.7) return true; return null; },   // flung off the top
      frame: function (ctx, p) {
        var ly = p._line[(typeof currentHole !== 'undefined') ? currentHole : 0];
        _clk += 1;
        // the inversion boundary — a shimmering line; everything above it falls UP. Upward motes sell it.
        ctx.globalAlpha = 0.5; ctx.strokeStyle = '#caa6ff'; ctx.lineWidth = 1.4; ctx.setLineDash([7, 6]);
        ctx.beginPath(); ctx.moveTo(camx(), ly); ctx.lineTo(camx() + W, ly); ctx.stroke(); ctx.setLineDash([]);
        ctx.fillStyle = '#caa6ff';
        for (var m = 0; m < 22; m++) {
          var mx = camx() + ((m * 97) % W);
          var my = ly - ((m * 41 + _clk * 2) % (H * 0.5));     // motes drift UPWARD above the line
          ctx.globalAlpha = 0.32 * (1 - (ly - my) / (H * 0.5));
          ctx.fillRect(mx, my, 1.4, 4);
        }
        ctx.globalAlpha = 1;
      },
    },
  });

  // ── LODESTAR — the cup is magnetised: get near and the field finishes the putt for you.
  //    "forgiveness as physics" — a calm planet where good-enough aim curls in. ──
  A.register({
    id: 'field-magnet', name: 'Lodestar', blurb: 'a magnetised cup pulls a near-enough ball home — forgiveness as physics',
    course: { worldName: 'Lodestar · the pull', sky: '#0c1422', defaultMaterial: 'ironcrust', materials: ['ironcrust', 'ironcrust', 'ice'],
      archetypes: ['gentle_slope', 'rolling_hills', 'valley', 'shelf', 'downhill'],
      difficultyRange: [0.2, 0.5], holeDistMin: 440, holeDistMax: 700, phys: { gravityScale: 0.9, windScale: 0 } },
    _R: 150, _K: 0.10,
    hooks: {
      force: function (p) { if (ball.atRest) return; var h = curHole(); if (!h) return; var dx = h.cupX - ball.x, dy = h.cupY - ball.y, d = Math.sqrt(dx * dx + dy * dy); if (d < p._R && d > 1) { var f = p._K * (1 - d / p._R); ball.vx += f * dx / d; ball.vy += f * dy / d; } },
      frame: function (ctx, p) {   // pulsing field rings show the cup's reach
        var h = curHole(); if (!h) return; _clk += 1;
        ctx.strokeStyle = '#7ad0ff';
        for (var r = 0; r < 3; r++) { var rr = p._R * (0.4 + r * 0.3) + Math.sin(_clk * 0.05 - r) * 6; ctx.globalAlpha = 0.10 + 0.05 * Math.sin(_clk * 0.05 - r); ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(h.cupX, h.cupY, rr, 0, Math.PI * 2); ctx.stroke(); }
        ctx.globalAlpha = 1;
      },
    },
  });

  // ── AVERSION — a repulsor sits right in front of the cup, pushing the ball away. Aim AROUND it;
  //    a straight shot at the flag is shoved off. ──
  A.register({
    id: 'field-repulsar', name: 'Aversion', blurb: 'a repulsor guards the cup — never aim straight; curve around the push',
    course: { worldName: 'Aversion · the pusher', sky: '#1a0f14', defaultMaterial: 'dust', materials: ['dust'],
      archetypes: ['flat_run', 'gentle_slope', 'shelf', 'rolling_hills'],
      difficultyRange: [0.15, 0.4], holeDistMin: 460, holeDistMax: 720, phys: { gravityScale: 0.7, windScale: 0 } },
    _K: 30, _soft: 3400, _cap: 0.7,
    hooks: {
      onStart: function (p) { p._rep = []; var n = holes ? holes.length : 0; for (var i = 0; i < n; i++) { var h = holes[i]; p._rep.push(h ? { x: h.cupX - (h.cupX - h.teeX) * 0.16, y: h.cupY - 34 } : null); } },
      force: function (p) { if (!air()) return; var r = p._rep[(typeof currentHole !== 'undefined') ? currentHole : 0]; if (!r) return; var dx = ball.x - r.x, dy = ball.y - r.y, d2 = dx * dx + dy * dy + p._soft; var a = Math.min(p._cap, p._K / d2), inv = 1 / Math.sqrt(d2); ball.vx += a * dx * inv; ball.vy += a * dy * inv; },
      frame: function (ctx, p) {   // an outward-pushing bloom marks the repulsor (don't aim here)
        var r = p._rep[(typeof currentHole !== 'undefined') ? currentHole : 0]; if (!r) return; _clk += 1;
        ctx.strokeStyle = '#ff7a6a';
        for (var k = 0; k < 3; k++) { var rr = 10 + ((_clk * 0.6 + k * 16) % 48); ctx.globalAlpha = 0.5 * (1 - rr / 58); ctx.lineWidth = 1.6; ctx.beginPath(); ctx.arc(r.x, r.y, rr, 0, Math.PI * 2); ctx.stroke(); }
        ctx.fillStyle = '#ff9a8a'; ctx.globalAlpha = 0.9; ctx.beginPath(); ctx.arc(r.x, r.y, 5, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 1;
      },
    },
  });

  // ── WESTERLY — one strong, constant prevailing wind across the whole hole (alternating direction by
  //    hole). Aim into it. Streaks blow across so the wind is always read-able. ──
  A.register({
    id: 'field-wind', name: 'Westerly', blurb: 'a hard prevailing wind — lean your aim into it; watch the streaks',
    course: { worldName: 'Westerly · the trade winds', sky: '#10202c', defaultMaterial: 'turf', materials: ['turf', 'turf', 'bunker'],
      archetypes: ['gentle_slope', 'rolling_hills', 'valley', 'downhill', 'shelf'],
      difficultyRange: [0.15, 0.45], holeDistMin: 460, holeDistMax: 720, phys: { gravityScale: 0.85, windScale: 0 } },
    hooks: {
      onStart: function (p) { p._w = []; var n = holes ? holes.length : 0; for (var i = 0; i < n; i++) { var h = holes[i]; var into = (h && h.cupX < h.teeX) ? 1 : -1; p._w.push(into * (0.011 + (i % 3) * 0.004)); } },
      force: function (p) { if (!air()) return; ball.vx += p._w[(typeof currentHole !== 'undefined') ? currentHole : 0]; },
      frame: function (ctx, p) {
        var w = p._w[(typeof currentHole !== 'undefined') ? currentHole : 0], dir = w > 0 ? 1 : -1, sp = Math.min(1, Math.abs(w) / 0.02);
        _clk += 1 + sp * 2;
        ctx.globalAlpha = 0.16; ctx.strokeStyle = '#cfe0ff'; ctx.lineWidth = 1.4;
        for (var s = 0; s < 40; s++) {
          var sx = camx() + ((s * 71 + _clk * dir * 3) % (W + 120)) - 60;
          var sy = camy() + ((s * 53) % H);
          ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx + dir * (10 + sp * 14), sy); ctx.stroke();
        }
        ctx.globalAlpha = 1;
      },
    },
  });

  // ── CONVEYORS — drift bands of moving ground carry the ball sideways while it rolls; aim 'wrong'
  //    upstream and let the current feed you to the cup. ──
  A.register({
    id: 'field-drift', name: 'Conveyance', blurb: 'the ground itself drifts — aim upstream and let the current feed the cup',
    course: { worldName: 'Conveyance · drift bands', sky: '#08121a', defaultMaterial: 'slick', materials: ['slick'],
      archetypes: ['flat_run', 'gentle_slope', 'shelf', 'rolling_hills'],
      difficultyRange: [0.15, 0.4], holeDistMin: 460, holeDistMax: 720, phys: { gravityScale: 0.9, windScale: 0 } },
    hooks: {
      onStart: function (p) {
        p._bands = []; var n = holes ? holes.length : 0;
        for (var i = 0; i < n; i++) { var h = holes[i]; if (!h) { p._bands.push([]); continue; }
          var span = h.cupX - h.teeX, dir = (i % 2 ? 1 : -1) * (span >= 0 ? 1 : -1);
          var cx = h.teeX + span * 0.5, hw = Math.abs(span) * 0.22;
          p._bands.push([{ x1: cx - hw, x2: cx + hw, dir: -dir, s: 0.05 }]);   // pushes opposite the cup, so you aim past it
        }
      },
      force: function (p) {
        if (typeof ball === 'undefined' || ball.atRest || !ball.onGround) return;
        var bs = p._bands[(typeof currentHole !== 'undefined') ? currentHole : 0]; if (!bs) return;
        for (var i = 0; i < bs.length; i++) if (ball.x > bs[i].x1 && ball.x < bs[i].x2) ball.vx += bs[i].dir * bs[i].s;
      },
      frame: function (ctx, p) {
        var bs = p._bands[(typeof currentHole !== 'undefined') ? currentHole : 0]; if (!bs) return;
        _clk += 1.5;
        for (var i = 0; i < bs.length; i++) {
          var b = bs[i];
          ctx.globalAlpha = 0.5; ctx.strokeStyle = '#7fd0ff'; ctx.lineWidth = 2;
          for (var x = b.x1; x < b.x2; x += 26) {
            var gy = (typeof terrainYAt === 'function') ? terrainYAt(x) - 7 : 0;
            var off = ((x + _clk * b.dir * 2) % 26);
            ctx.beginPath(); ctx.moveTo(x + off - 6, gy - 4); ctx.lineTo(x + off, gy); ctx.lineTo(x + off - 6, gy + 4); ctx.stroke();
          }
        }
        ctx.globalAlpha = 1;
      },
    },
  });

})();
