// ── atlas-relics.js — DISCOVERY/NARRATIVE: "someone came before you" ─────────────────────────────
// The wordless spine I want running through the universe: extend the Apollo-balls idea (real golf
// balls left unlabeled on the Moon) into a found story. On "Cairn" you keep finding the relics of a
// golfer who passed this way long ago — weathered balls half-buried in a line, stacked-stone cairns
// marking a route, and, at the summit hole, their derelict lander beside the cup. No text; the world
// tells it. Pure golf underneath (normal physics) — the relics are environmental, drawn in world space.
// Determinism: every relic position is a pure function of hole geometry + RG._faultHash (never the
// terrain PRNG). Peel this file + its <script> tag off → the planet vanishes.
(function () {
  if (typeof window === 'undefined' || !window.RG_ATLAS) return;
  var A = window.RG_ATLAS;
  function hsh(n) { return (window.RG && RG._faultHash) ? RG._faultHash((n >>> 0)) : ((n * 2654435761) >>> 0); }
  function gY(x) { return (typeof terrainYAt === 'function') ? terrainYAt(x) : 0; }

  function drawBall(ctx, x, y, a) { ctx.globalAlpha = a; ctx.fillStyle = '#d9d2c4'; ctx.beginPath(); ctx.arc(x, y, 3, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1; }
  function drawCairn(ctx, x, gy) {                       // a stack of weathered stones
    ctx.fillStyle = '#6c6055';
    var ws = [13, 10, 7, 4], hs = [0, 8, 15, 21];
    for (var i = 0; i < 4; i++) { ctx.beginPath(); ctx.ellipse(x, gy - hs[i], ws[i], ws[i] * 0.6, 0, 0, Math.PI * 2); ctx.fill(); }
  }
  function drawLander(ctx, x, gy) {                       // the predecessor's derelict craft, half-sunk + leaning
    ctx.save(); ctx.translate(x, gy); ctx.rotate(-0.12);
    ctx.fillStyle = '#3a3f47'; ctx.beginPath();
    ctx.moveTo(-22, 0); ctx.lineTo(-14, -26); ctx.lineTo(14, -26); ctx.lineTo(22, 0); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#2a2e35'; ctx.fillRect(-6, -38, 12, 14);          // antenna mast housing
    ctx.strokeStyle = '#2a2e35'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(-18, 0); ctx.lineTo(-26, 14); ctx.moveTo(18, 0); ctx.lineTo(26, 14); ctx.stroke();   // splayed legs
    ctx.fillStyle = '#8a7a52'; ctx.beginPath(); ctx.arc(-2, -16, 4, 0, Math.PI * 2); ctx.fill();   // a dim porthole, still catching light
    ctx.restore();
  }

  A.register({
    id: 'relic-cairn', name: 'Cairn', blurb: 'someone golfed here before you — follow their trail to the summit',
    mats: [['ash', 'sand', { restitution: 0.34, rollingFriction: 0.95, surfaceFriction: 0.006, color: '#8d8278', colorLight: '#a59a8e' }]],
    course: { worldName: 'Cairn · the ones before', sky: '#1a1620', defaultMaterial: 'ash', materials: ['ash', 'ash', 'rock'],
      archetypes: ['gentle_slope', 'rolling_hills', 'shelf', 'valley', 'uphill', 'mesa'],
      difficultyRange: [0.2, 0.5], holeDistMin: 420, holeDistMax: 700, phys: { gravityScale: 0.7, windScale: 0 } },
    hooks: {
      onStart: function (p) {
        p._relics = [];
        var n = (typeof holes !== 'undefined') ? holes.length : 0;
        for (var i = 0; i < n; i++) {
          var h = holes[i]; if (!h) { p._relics.push(null); continue; }
          var span = h.cupX - h.teeX, last = (i === n - 1);
          var items = [];
          // a cairn marking the route, just off the tee
          items.push({ t: 'cairn', x: h.teeX + span * 0.18 });
          // a line of the predecessor's half-buried balls, trailing toward the cup (their old shots)
          var balls = 3 + (hsh(i * 7 + 3) % 3);
          for (var b = 0; b < balls; b++) items.push({ t: 'ball', x: h.teeX + span * (0.30 + b * 0.11) + ((hsh(i * 31 + b) % 18) - 9), a: 0.5 + (hsh(i + b) % 40) / 100 });
          if (last) items.push({ t: 'lander', x: h.cupX - span * 0.10 });   // their craft, beside the final cup
          else if (hsh(i * 13) % 2) items.push({ t: 'cairn', x: h.teeX + span * 0.72 });
          p._relics.push(items);
        }
      },
      frame: function (ctx, p) {
        if (!p._relics) return;
        var items = p._relics[(typeof currentHole !== 'undefined') ? currentHole : 0]; if (!items) return;
        for (var i = 0; i < items.length; i++) {
          var it = items[i], gy = gY(it.x);
          if (it.t === 'ball') drawBall(ctx, it.x, gy - 2, it.a);
          else if (it.t === 'cairn') drawCairn(ctx, it.x, gy);
          else if (it.t === 'lander') drawLander(ctx, it.x, gy);
        }
      },
    },
  });
})();
