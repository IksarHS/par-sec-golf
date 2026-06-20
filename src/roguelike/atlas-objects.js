// ── atlas-objects.js — OBJECT planets: launch-pad plumes + pinball bumpers ────────────────────────
// Two mechanics that add physical OBJECTS to a hole. Both act through the force() hook (wrap.js
// collide(), every physics substep incl. the bot sim) so they are lawful and bot-predictable.
// Determinism: object positions are a pure function of hole geometry. Motion is conveyed visually
// (erupting plume spray; bumper glow). Peel the file + its <script> tag off → both planets vanish.
(function () {
  if (typeof window === 'undefined' || !window.RG_ATLAS) return;
  var A = window.RG_ATLAS;
  var _clk = 0;
  function ballR() { return (typeof BALL_RADIUS !== 'undefined') ? BALL_RADIUS : 4; }
  function gY(x) { return (typeof terrainYAt === 'function') ? terrainYAt(x) : 0; }
  function idxH() { return (typeof currentHole !== 'undefined') ? currentHole : 0; }

  // ── ENCELADUS — cryovolcanic vents are launch pads: land on one and it boosts the ball up-and-on,
  //    reaching ledges a flat shot can't. The vent is the elevator. ──
  A.register({
    id: 'plume-vents', name: 'Enceladus', blurb: 'cryo-vents are launch pads — land on the jet and it boosts you onward and up',
    mats: [['frost', 'ice', { restitution: 0.45, rollingFriction: 0.97, surfaceFriction: 0.003, color: '#9fc4d6', colorLight: '#c2e0ee' }]],
    course: { worldName: 'Enceladus · the plumes', sky: '#08141c', defaultMaterial: 'frost', materials: ['frost'],
      archetypes: ['valley', 'shelf', 'gentle_hill', 'rolling_hills', 'mesa'],
      difficultyRange: [0.2, 0.5], holeDistMin: 460, holeDistMax: 720, phys: { gravityScale: 0.6, windScale: 0 } },
    _boost: 7.0,
    hooks: {
      onStart: function (p) {
        p._vents = []; var n = (typeof holes !== 'undefined') ? holes.length : 0;
        for (var i = 0; i < n; i++) { var h = holes[i]; if (!h) { p._vents.push([]); continue; }
          var span = h.cupX - h.teeX, dir = span >= 0 ? 1 : -1;
          var v = [{ x: h.teeX + span * 0.5, w: 26, dir: dir, _armed: true }];
          if (Math.abs(span) > 540) v.push({ x: h.teeX + span * 0.72, w: 22, dir: dir, _armed: true });
          p._vents.push(v);
        }
      },
      force: function (p) {
        if (typeof ball === 'undefined' || ball.atRest) return;
        var vs = p._vents[idxH()]; if (!vs) return;
        for (var i = 0; i < vs.length; i++) {
          var inX = Math.abs(ball.x - vs[i].x) < vs[i].w;
          if (!inX) { vs[i]._armed = true; continue; }    // re-arm once the ball clears this vent (one boost per pass; self-heals each shot, sim-consistent)
          if (ball.onGround && ball.vy >= -1 && vs[i]._armed) { ball.vy = -p._boost; ball.vx += vs[i].dir * 1.6; ball.onGround = false; vs[i]._armed = false; }   // erupt!
        }
      },
      frame: function (ctx, p) {
        var vs = p._vents[idxH()]; if (!vs) return; _clk += 1;
        for (var i = 0; i < vs.length; i++) {
          var v = vs[i], gy = gY(v.x);
          // vent mouth
          ctx.fillStyle = '#2a4250'; ctx.fillRect(v.x - v.w, gy - 2, v.w * 2, 6);
          // erupting plume — particles rising + fading (the motion tell that it's live)
          for (var s = 0; s < 14; s++) {
            var age = ((_clk * 0.9 + s * 17) % 60) / 60;
            ctx.globalAlpha = 0.6 * (1 - age);
            ctx.fillStyle = '#dff2fb';
            var px = v.x + (((s * 53) % (v.w * 2)) - v.w) * (0.4 + age);
            ctx.beginPath(); ctx.arc(px, gy - age * 70, 1.4 + age * 2, 0, Math.PI * 2); ctx.fill();
          }
          ctx.globalAlpha = 1;
        }
      },
    },
  });

  // ── CASSINI — bumpers float over the fairway like ring particles; the ball pinballs off them. Aim
  //    the first bounce, not the cup. ──
  A.register({
    id: 'bump-rings', name: 'Cassini', blurb: 'bumpers everywhere — pinball the ball off them; aim the first bounce, not the cup',
    course: { worldName: 'Cassini · the ring gap', sky: '#100c1e', defaultMaterial: 'dust', materials: ['dust'],
      archetypes: ['flat_run', 'gentle_slope', 'valley', 'shelf'],
      difficultyRange: [0.15, 0.45], holeDistMin: 480, holeDistMax: 740, phys: { gravityScale: 0.7, windScale: 0 } },
    _e: 0.86,
    hooks: {
      onStart: function (p) {
        p._bump = []; var n = (typeof holes !== 'undefined') ? holes.length : 0;
        for (var i = 0; i < n; i++) { var h = holes[i]; if (!h) { p._bump.push([]); continue; }
          var span = h.cupX - h.teeX, topY = Math.min(h.teeY, h.cupY), b = [];
          var cnt = 2 + (i % 3);
          for (var k = 0; k < cnt; k++) { b.push({ x: h.teeX + span * (0.28 + k * (0.44 / Math.max(1, cnt - 1))), y: topY - 30 - ((k % 2) * 70), r: 16 + (k % 2) * 4, _lit: 0 }); }
          p._bump.push(b);
        }
      },
      force: function (p) {
        if (typeof ball === 'undefined' || ball.atRest) return;
        var bs = p._bump[idxH()]; if (!bs) return; var br = ballR();
        for (var i = 0; i < bs.length; i++) {
          var bm = bs[i], dx = ball.x - bm.x, dy = ball.y - bm.y, d = Math.sqrt(dx * dx + dy * dy);
          if (d < bm.r + br && d > 0.01) {
            var nx = dx / d, ny = dy / d, vdn = ball.vx * nx + ball.vy * ny;
            if (vdn < 0) { ball.vx -= (1 + p._e) * vdn * nx; ball.vy -= (1 + p._e) * vdn * ny; }   // reflect off the bumper
            ball.x = bm.x + nx * (bm.r + br + 0.5); ball.y = bm.y + ny * (bm.r + br + 0.5);          // push clear of the surface
            if (!(window.RG && RG._simulating)) bm._lit = 6;   // glow is cosmetic; don't set it in the bot sim (the frame() that clears it never runs there)
          }
        }
      },
      frame: function (ctx, p) {
        var bs = p._bump[idxH()]; if (!bs) return;
        for (var i = 0; i < bs.length; i++) {
          var bm = bs[i], lit = bm._lit > 0;
          if (bm._lit > 0) bm._lit--;
          ctx.fillStyle = lit ? 'rgba(255,230,150,0.9)' : 'rgba(120,160,230,0.18)';
          ctx.beginPath(); ctx.arc(bm.x, bm.y, bm.r, 0, Math.PI * 2); ctx.fill();
          ctx.strokeStyle = lit ? '#ffe796' : '#7ba0ff'; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.arc(bm.x, bm.y, bm.r, 0, Math.PI * 2); ctx.stroke();
        }
      },
    },
  });
})();
