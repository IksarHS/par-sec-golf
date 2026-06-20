// ── atlas-climb.js — THE ASCENT (a Kinda Hard Golf homage) ────────────────────────────────────────
// Same golf, same look — but the course climbs UP instead of out to the right. The key realisation
// (designer's): a Kinda Hard Golf "checkpoint" is just a HOLE. So The Ascent is simply a STACK of
// short vertical holes — each cup you sink is your checkpoint, and the engine's normal hole machinery
// gives us the save system for free:
//   • each hole's tee is the previous hole's cup (engine default) → the climb is continuous, going UP.
//   • sink a cup → advance to the next (higher) segment, camera re-frames on it (the "camera adjusts
//     when a hole is made" behaviour, already built in).
//   • fall back below the current segment's tee → reshoot from that tee (= your last cup/checkpoint),
//     never the bottom of the whole tower. That's the only-up isOOB pattern (Spire), no custom save.
//
// Mastery-preserving + additive: the core aim-and-power shot is untouched; the planet just orients the
// course vertically and makes the segments short so you "check in" at every cup. No bespoke checkpoint
// system — it's golf holes that go up. Built on the inert RG._clampYBand hook (a tall vertical band so
// the stacked segments fit). Gated (?course=climb). Peel the file + its <script> tag → the planet's gone.
(function () {
  if (typeof window === 'undefined' || !window.RG_ATLAS) return;
  var A = window.RG_ATLAS;

  // ── the ASCENDING STAIRCASE — the terrain for each short vertical hole ─────────────────────────────
  // Registered onto the engine's global `archetypes` table (a pure ADD from the peel-off layer — the
  // core file is untouched; only THIS course lists it, so nothing else is affected). Flat ledges +
  // near-vertical risers: you loft from ledge to ledge, and a flat ledge CATCHES the ball so progress
  // holds between hops (a smooth slope just slides you back to the bottom — that's why the homage uses
  // ledges). Pure terrain gen, so random() is the right tool here (where the terrain PRNG is meant to run).
  if (typeof archetypes !== 'undefined' && !archetypes.climb_staircase) {
    archetypes.climb_staircase = function (sx, sy, dist, cupY, diff) {
      var totalRise = sy - cupY;                                  // >0 = how far up to the cup
      if (totalRise < 80) return [{ x: sx + dist, y: clampY(cupY) }];   // degenerate (not a climb)
      var stepTarget = 150 + diff * 30;
      var N = Math.max(2, Math.min(4, Math.round(totalRise / stepTarget)));   // 2–4 ledges per short hole
      var stepH = totalRise / N;                                  // even steps land exactly on cupY
      var riserW = 12;                                            // near-vertical wall between ledges
      var segW = (dist * 0.80) / N;                               // leave ~20% of the run for the cup ledge
      var verts = [], x = sx, y = sy;
      for (var i = 0; i < N; i++) {
        var sw = Math.max(58, (segW - riserW) * randRange(0.85, 1.05));
        x += sw;
        verts.push({ x: x, y: clampY(y) });                       // flat LEDGE (land + rest here)
        var ny = (i === N - 1) ? cupY : y - stepH * randRange(0.9, 1.1);
        x += riserW;
        verts.push({ x: x, y: clampY(ny) });                      // steep RISER up to the next ledge
        y = ny;
      }
      verts.push({ x: Math.max(x + 40, sx + dist), y: clampY(cupY) });  // top ledge that holds the cup
      return verts;
    };
    // pickArchetype only considers names in ARCHETYPE_TABLE; add ours so the course can select it. Every
    // real course + atlas planet defines its own archetype SUBSET that excludes this name, so it is inert
    // everywhere except the one course that lists 'climb_staircase'. ([name, minDiff, maxDiff, weight])
    if (typeof ARCHETYPE_TABLE !== 'undefined') ARCHETYPE_TABLE.push(['climb_staircase', 0.0, 1.0, 1]);
  }

  function hole() { return (typeof holes !== 'undefined') ? holes[(typeof currentHole !== 'undefined') ? currentHole : 0] : null; }

  A.register({
    id: 'climb', name: 'The Ascent', blurb: 'golf UP a tower of short holes — every cup is a checkpoint; fall and you only drop to the last cup (a Kinda Hard Golf homage)',
    // a UNIQUE dark-slate rock (NOT galaxy.js's pre-existing brown 'scree' — that name is taken, and defMat
    // skips a name that already exists, so reusing it would silently render brown). One cohesive material.
    mats: [['ascentstone', 'rock', { restitution: 0.38, rollingFriction: 0.94, surfaceFriction: 0.008, color: '#3a3a44', colorLight: '#4e4e5a' }]],
    course: {
      worldName: 'The Ascent · a tower of short holes', sky: '#0b0a14', defaultMaterial: 'ascentstone', materials: ['ascentstone'],
      archetypes: ['climb_staircase'],
      // SHORT segments (~0.55–0.85 screen up) so you reach a cup/checkpoint often — the anti-frustration
      // of never re-doing more than one little climb. Eight of them stacked = a tall tower.
      cupElevation: function (teeY) { return teeY - (H * 0.55) - random() * (H * 0.3); },
      difficultyRange: [0.4, 0.6], holeDistMin: 380, holeDistMax: 520, holeCount: 8,
      // HEAVY world: the same aim-and-power physics, only gravity is turned up (the Moon turns it DOWN to
      // 0.45; this is the mirror). Heavier gravity = shorter, punchier hops. Not a new mechanic.
      phys: { gravityScale: 1.7, windScale: 0 },
    },
    hooks: {
      // a TALL world band so eight stacked vertical segments fit without clampY clipping the high cups;
      // floor stays at the normal bottom (segment 1 tees low). Reset on every planet switch by the atlas.
      beforeStart: function () { if (window.RG) RG._clampYBand = [-H * 6, H * 0.92]; },

      // climb camera — frame the ball + this segment's cup, biased to the ball, panning up (like the Spire).
      // When a cup is sunk the engine advances currentHole and this re-frames onto the next (higher) segment.
      camera: function () {
        if (typeof camera === 'undefined' || typeof ball === 'undefined') return false;
        var h = hole(); if (!h) return false;
        var fx = ball.x * 0.5 + h.cupX * 0.5, fy = ball.y * 0.6 + h.cupY * 0.4;
        camera.x += ((fx - W / 2) - camera.x) * 0.12;
        camera.y += ((fy - H / 2) - camera.y) * 0.12;
        return true;
      },

      // FALL = reshoot from this segment's tee (= the last cup you sank). The cup IS the checkpoint, so
      // there's no custom save: settle well below where this little hole started and it's out-of-bounds,
      // exactly like tumbling off the edge — the engine reshoots from the tee. Runs in the bot sim too
      // (pure function of ball state), so the bot avoids falls just like a player would.
      isOOB: function () {
        if (typeof ball === 'undefined') return null;
        var h = hole(); if (!h) return null;
        var slow = (ball.vx * ball.vx + ball.vy * ball.vy) < 1.2;
        if (ball.onGround && slow && ball.y > h.teeY + H * 0.32) return true;
        return null;
      },
    },
  });
})();
