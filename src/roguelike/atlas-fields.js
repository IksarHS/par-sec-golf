// ── atlas-fields.js — FORCE-FIELD planets (gravity wells + wind bands) ──────────────────────────
// Registers experimental planets whose gimmick is a force that bends the ball IN FLIGHT. The force is
// applied from the atlas force() hook, which rides wrap.js collide() — i.e. every physics substep,
// INCLUDING inside the bot's simulateShot — so the curved trajectories are lawful and bot-predictable,
// not a render-only trick. Determinism: field positions are a pure function of each hole's geometry
// (tee/cup), never the terrain PRNG. Peel this file + its <script> tag off → these planets vanish.
(function () {
  if (typeof window === 'undefined' || !window.RG_ATLAS) return;   // only registers under the atlas gate
  var A = window.RG_ATLAS;
  var _clk = 0;   // render-only animation clock (drives the drifting wind streaks)

  function holeGeom(i) {
    if (typeof holes === 'undefined' || !holes[i]) return null;
    var h = holes[i];
    return { teeX: h.teeX, teeY: h.teeY, cupX: h.cupX, cupY: h.cupY,
             midX: (h.teeX + h.cupX) / 2, topY: Math.min(h.teeY, h.cupY), span: Math.abs(h.cupX - h.teeX) };
  }
  function airborne() { return typeof ball !== 'undefined' && !ball.atRest && !ball.onGround; }

  // ── GRAVITY WELLS — a massive body curves the shot; aim around it or slingshot off it ──
  A.register({
    id: 'field-well', name: 'Sirens', blurb: 'gravity wells bend your shot in flight — aim around the pull',
    course: { worldName: 'Sirens · gravity wells', sky: '#04050c', defaultMaterial: 'dust', materials: ['dust'],
      // Loft-forcing terrain + elevated cups so the ball MUST arc UP through the well's pull (a low
      // putt-under is blocked). The well sits on that required arc — so it actually matters.
      archetypes: ['wall_shot', 'peak_obstacle', 'mesa', 'cliff_shelf', 'shelf'],
      cupElevation: function (teeY) { return teeY - 70 - random() * 90; },
      difficultyRange: [0.25, 0.5], holeDistMin: 440, holeDistMax: 700, phys: { gravityScale: 0.5, windScale: 0 } },
    _K: 42,            // pull strength (tuned so a shot clearly curves but holes stay solvable)
    _soft: 5200,       // softening so the force never blows up near the core
    _cap: 0.85,        // max velocity nudge per well per substep — prevents a violent "capture" into orbit
    hooks: {
      onStart: function (p) {
        p._wells = [];
        var n = (typeof holes !== 'undefined') ? holes.length : 0;
        for (var i = 0; i < n; i++) {
          var g = holeGeom(i); if (!g) { p._wells.push(null); continue; }
          // one well above the flight line, set just past the apex toward the cup, offset up so a
          // straight shot bows toward it. Second harder well on later holes.
          var wells = [{ x: g.midX + (g.cupX - g.teeX) * 0.12, y: g.topY - 150, r: 17 }];
          if (i >= 1) wells.push({ x: g.teeX + (g.cupX - g.teeX) * 0.62, y: g.topY - 60, r: 13 });
          p._wells.push(wells);
        }
      },
      force: function (p) {
        if (!airborne() || !p._wells) return;
        var ws = p._wells[(typeof currentHole !== 'undefined') ? currentHole : 0]; if (!ws) return;
        for (var k = 0; k < ws.length; k++) {
          var w = ws[k], dx = w.x - ball.x, dy = w.y - ball.y, d2 = dx * dx + dy * dy + p._soft;
          var a = Math.min(p._cap, p._K / d2);       // inverse-square-ish, softened + capped (no orbit capture)
          var inv = 1 / Math.sqrt(d2);
          ball.vx += a * dx * inv; ball.vy += a * dy * inv;
        }
      },
      frame: function (ctx, p) {
        if (!p._wells) return;
        var ws = p._wells[(typeof currentHole !== 'undefined') ? currentHole : 0]; if (!ws) return;
        for (var k = 0; k < ws.length; k++) {
          var w = ws[k];
          var grd = ctx.createRadialGradient(w.x, w.y, 1, w.x, w.y, w.r * 4.2);
          grd.addColorStop(0, 'rgba(180,210,255,0.95)'); grd.addColorStop(0.25, 'rgba(120,150,230,0.45)');
          grd.addColorStop(1, 'rgba(60,80,160,0)');
          ctx.fillStyle = grd; ctx.beginPath(); ctx.arc(w.x, w.y, w.r * 4.2, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = '#eaf2ff'; ctx.beginPath(); ctx.arc(w.x, w.y, w.r * 0.5, 0, Math.PI * 2); ctx.fill();
          ctx.strokeStyle = 'rgba(150,180,255,0.5)'; ctx.lineWidth = 1.2;
          ctx.beginPath(); ctx.arc(w.x, w.y, w.r * 1.7, 0, Math.PI * 2); ctx.stroke();
        }
      },
    },
  });

  // ── WIND BANDS — horizontal jet streams (alternating by altitude) shove the ball as it passes ──
  A.register({
    id: 'field-gusts', name: 'Aeolus', blurb: 'jet streams in layers — read the winds, fly through the gaps',
    course: { worldName: 'Aeolus · jet streams', sky: '#13243a', defaultMaterial: 'turf', materials: ['turf', 'turf', 'bunker'],
      archetypes: ['gentle_slope', 'rolling_hills', 'valley', 'shelf', 'downhill'],
      difficultyRange: [0.15, 0.45], holeDistMin: 460, holeDistMax: 760, phys: { gravityScale: 0.7, windScale: 0 } },
    _bands: null,
    hooks: {
      onStart: function (p) {
        // 3 horizontal jet bands at fixed screen-relative altitudes; alternating push direction.
        // Strength is gentle and constant within a band; the EDGES taper so there's no hard pop.
        p._bands = [
          { y: -H * 0.10, h: H * 0.16, dir: 1,  s: 0.018 },
          { y: -H * 0.30, h: H * 0.16, dir: -1, s: 0.024 },
          { y: -H * 0.50, h: H * 0.16, dir: 1,  s: 0.030 },
        ];
      },
      force: function (p) {
        if (!airborne() || !p._bands) return;
        // bands are placed relative to the ball's resting ground, so use terrain under the tee as datum
        var datum = (typeof holes !== 'undefined' && holes[currentHole]) ? holes[currentHole].teeY : 0;
        for (var b = 0; b < p._bands.length; b++) {
          var band = p._bands[b], by = datum + band.y;
          var t = 1 - Math.min(1, Math.abs(ball.y - by) / (band.h * 0.5));   // 1 at centre → 0 at edge
          if (t > 0) ball.vx += band.dir * band.s * t;
        }
      },
      frame: function (ctx, p) {
        if (!p._bands) return;
        var datum = (typeof holes !== 'undefined' && holes[currentHole]) ? holes[currentHole].teeY : 0;
        var camx = (typeof camera !== 'undefined') ? camera.x : 0;
        var ph = (_clk += 1.6);
        for (var b = 0; b < p._bands.length; b++) {
          var band = p._bands[b], by = datum + band.y;
          for (var s = 0; s < 26; s++) {
            var sx = camx + ((s * 91 + (ph * band.dir * 3)) % (W + 120)) - 60;
            var sy = by + ((s * 37) % band.h) - band.h / 2;
            ctx.globalAlpha = 0.20; ctx.strokeStyle = band.dir > 0 ? '#bcd0ff' : '#ffd0bc'; ctx.lineWidth = 1.4;
            ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx + band.dir * 16, sy); ctx.stroke();
          }
        }
        ctx.globalAlpha = 1;
      },
    },
  });
})();
