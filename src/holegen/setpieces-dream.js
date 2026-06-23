// ── holegen/setpieces-dream.js — FLOATING / non-terrain landmark bodies (the rare signature holes) ───
// August's explicit ask: designed standalone bodies that hang in the void — a floating ziggurat, floating
// isles, a great arch, a spire/monolith pin, twin horns, a leviathan, plus more silhouettes (orbital ring,
// broken bridge, moon-shards, derelict hull, balanced hoodoo, cathedral buttress, crystal geode). Each is a
// CONVEX-DECOMPOSED polygon body collided via the engine's swept circle-vs-poly set-pieces. The LANDABLE
// TOP is represented as a heightfield green PAD at the top height (so the cup places normally + the bot can
// rest there), while the body silhouette + tethers below are emitted as convex `_overhangs`. The heightfield
// FLOOR everywhere else is pushed low (a void / OOB catch) so only the body is in play.
//
// genFloater(name, opts) → { floor:[{x,y,cup?}], overhangs:[[{x,y}...]], cupX, cupY, sky? }
// opts: { sx, sy, dist, diff, rng, bounds, ballR }. These are the RARE injected holes (idiosyncrasy rule).
// Pure; window.HG_FLOAT + exports.

(function (root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof root !== 'undefined') root.HG_FLOAT = api;
})(typeof window !== 'undefined' ? window : this, function () {
  'use strict';
  var clamp = function (v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; };

  // build a flat GREEN PAD on the heightfield at height padY over [padL,padR], with a low MOAT floor either
  // side (the void that makes the body read as floating). The pad MUST be wide enough that the engine's
  // placeCup (which samples terrainYAt at cupX ± (CUP_WIDTH/2 + 20) ≈ ±38) lands on the pad, not the moat —
  // so we force a minimum pad half-width of 70 and put the cup at the pad centre. The moat sits a bounded
  // depth below the pad (NOT at screen bottom) so terrainYAt interpolation near the pad edges stays sane and
  // the cup never gets dragged into the void. The body silhouette + tethers (emitted as slabs) carry the
  // "floating" read below the moat. voidDepth = px below the pad for the moat floor.
  function padFloor(o, padL, padR, padY, cupX, voidDepth) {
    var endX = o.sx + o.dist;
    voidDepth = voidDepth != null ? voidDepth : 120;
    var moatY = clamp(padY + voidDepth, o.bounds.top, o.bounds.bot);
    var teeY = clamp(o.sy, o.bounds.top, o.bounds.bot);
    // ensure the pad is WIDE (≥ ±80 around the cup) so the bot can land + the cup places cleanly
    if (cupX - padL < 80) padL = cupX - 80;
    if (padR - cupX < 80) padR = cupX + 80;
    // a RAMPED approach (not a vertical wall): the front of the pad slopes up from the moat over a run
    // proportional to its height, so the optimal bot can ROLL/BOUNCE up onto the pad (a vertical wall + a
    // high pad stranded the bot → stuck holes). The ramp grade is kept ≤ the thermal repose so it's climbable.
    var rampRun = Math.max(70, (moatY - padY) * 1.4);
    var rampL = Math.max(o.sx + 64, padL - rampRun);
    return [
      { x: o.sx, y: teeY }, { x: o.sx + 40, y: teeY },     // tee launch shelf
      { x: o.sx + 58, y: moatY },                          // drop off the tee shelf into the moat
      { x: rampL, y: moatY },                              // moat floor
      { x: padL, y: padY },                                // RAMP up onto the landing pad
      { x: cupX, y: padY, cup: true },                     // CUP on the floating top (wide flat pad)
      { x: padR, y: padY },
      { x: padR + 16, y: moatY },                          // back drop into the moat
      { x: endX, y: moatY },
    ];
  }

  var BODIES = {
    // FLOATING ZIGGURAT — a stepped pyramid hanging in the void; cup on the top terrace. (the NEW one)
    ziggurat: function (o) {
      var cx = o.sx + o.dist * 0.6, baseY = clamp(o.bounds.bot - 70, o.bounds.top, o.bounds.bot);
      var tiers = 4, tierH = 30, tierStepIn = 42;
      var topW = 150, padY = baseY - tiers * tierH;
      var ov = [];
      for (var t = 0; t < tiers; t++) {
        var halfW = topW / 2 + (tiers - t) * tierStepIn, yTop = baseY - t * tierH;
        ov.push([{ x: cx - halfW, y: yTop }, { x: cx + halfW, y: yTop }, { x: cx + halfW - 10, y: yTop + tierH + 4 }, { x: cx - halfW + 10, y: yTop + tierH + 4 }]);
      }
      // a thin tether descending into the void so the float reads intentional
      ov.push([{ x: cx - 8, y: baseY + 8 }, { x: cx + 8, y: baseY + 8 }, { x: cx + 5, y: o.bounds.bot }, { x: cx - 5, y: o.bounds.bot }]);
      var padL = cx - topW / 2, padR = cx + topW / 2;
      return { floor: padFloor(o, padL, padR, padY, cx, 150), overhangs: ov, cupX: cx, cupY: padY };
    },
    // FLOATING ISLES — flat-topped chunks tethered in the void; hop isle to isle to the green on the last.
    // The isles are REAL heightfield steps (the ball rolls/hops up them) with void gaps + tethers BELOW for
    // the floating read — so the bot can always traverse to the green (a disconnected-slab version stranded it).
    floating_isles: function (o) {
      var n = 3, isleW = 110, ov = [], floor = [];
      var teeY = clamp(o.sy, o.bounds.top, o.bounds.bot);
      var isleX = [], isleY = [];
      // gentle rising staircase of isles (small steps the optimal bot can climb)
      for (var i = 0; i < n; i++) { isleX.push(o.sx + o.dist * (0.30 + i * 0.22)); isleY.push(clamp(teeY - i * 22 - o.diff * 14, o.bounds.top + 30, o.bounds.bot - 60)); }
      var moatY = clamp(isleY[0] + 110, o.bounds.top, o.bounds.bot - 4);
      var cx = isleX[n - 1], cupY = isleY[n - 1];
      // floor: tee shelf → (void → isle pad)×n → void. Each pad is flat heightfield; the cup is on the last.
      floor.push({ x: o.sx, y: teeY }, { x: o.sx + 38, y: teeY }, { x: o.sx + 58, y: moatY });
      for (var j = 0; j < n; j++) {
        var l = isleX[j] - isleW / 2, r = isleX[j] + isleW / 2;
        floor.push({ x: l - 10, y: moatY }, { x: l, y: isleY[j] });
        if (j === n - 1) floor.push({ x: cx, y: cupY, cup: true });
        else floor.push({ x: isleX[j], y: isleY[j] });
        floor.push({ x: r, y: isleY[j] }, { x: r + 10, y: moatY });
        // tether below each isle (visual float read)
        ov.push([{ x: isleX[j] - 6, y: isleY[j] + 30 }, { x: isleX[j] + 6, y: isleY[j] + 30 }, { x: isleX[j] + 3, y: clamp(isleY[j] + 140, o.bounds.top, o.bounds.bot) }, { x: isleX[j] - 3, y: clamp(isleY[j] + 140, o.bounds.top, o.bounds.bot) }]);
      }
      floor.push({ x: o.sx + o.dist, y: moatY });
      return { floor: floor, overhangs: ov, cupX: cx, cupY: cupY };
    },
    // THE GREAT ARCH — a colossal stone rainbow arcing over the hole; golf beneath a world-wonder.
    great_arch: function (o) {
      var endX = o.sx + o.dist, base = clamp(o.sy, o.bounds.top, o.bounds.bot);
      var cupX = endX - o.dist * 0.12, cupY = clamp(base, o.bounds.top, o.bounds.bot);
      var floor = [{ x: o.sx, y: base }, { x: cupX - 80, y: base }, { x: cupX, y: cupY, cup: true }, { x: cupX + 80, y: base }, { x: endX, y: base }];
      // the arch: a faceted band of convex quads arcing over the fairway (feet planted on terrain).
      var aL = o.sx + o.dist * 0.16, aR = o.sx + o.dist * 0.82, crown = clamp(base - 220 - o.diff * 40, o.bounds.top + 6, o.bounds.bot);
      var ov = [], cols = 9;
      for (var c = 0; c < cols; c++) {
        var t0 = c / cols, t1 = (c + 1) / cols, x0 = aL + (aR - aL) * t0, x1 = aL + (aR - aL) * t1;
        var y0 = base - Math.sin(t0 * Math.PI) * (base - crown), y1 = base - Math.sin(t1 * Math.PI) * (base - crown);
        var th = 30 + o.diff * 12;
        ov.push([{ x: x0, y: y0 }, { x: x1, y: y1 }, { x: x1, y: y1 + th }, { x: x0, y: y0 + th }]);
      }
      return { floor: floor, overhangs: ov, cupX: cupX, cupY: cupY };
    },
    // SPIRE / MONOLITH PIN — a needle of rock; one perfect arc onto its tiny crown or a long tumble.
    spire_pin: function (o) {
      var cx = o.sx + o.dist * 0.58;
      var topY = clamp(o.sy - 20 - o.diff * 24, o.bounds.top + 30, o.bounds.bot - 90), padW = 160;   // wide, landable crown
      var ov = [];
      // a tapering monolith (trapezoid, wide at base) below the crown pad — reads as a spire, lands like a mesa
      ov.push([{ x: cx - padW / 2 - 6, y: topY + 30 }, { x: cx + padW / 2 + 6, y: topY + 30 }, { x: cx + 34, y: o.bounds.bot }, { x: cx - 34, y: o.bounds.bot }]);
      return { floor: padFloor(o, cx - padW / 2, cx + padW / 2, topY, cx, 130), overhangs: ov, cupX: cx, cupY: topY };
    },
    // TWIN HORNS — two sharp peaks; climb the right horn and balance the pin on its tip.
    twin_horns: function (o) {
      var voidY = clamp(o.sy + 150, o.bounds.top, o.bounds.bot - 6);
      var h1 = o.sx + o.dist * 0.4, h2 = o.sx + o.dist * 0.66, padW = 150;
      var topY = clamp(o.sy - 30 - o.diff * 24, o.bounds.top + 30, o.bounds.bot - 90);
      var ov = [];
      ov.push([{ x: h1 - 50, y: o.bounds.bot }, { x: h1, y: topY + 50 }, { x: h1 + 50, y: o.bounds.bot }]);             // left horn (visual)
      ov.push([{ x: h2 - padW / 2 - 30, y: o.bounds.bot }, { x: h2 - padW / 2, y: topY }, { x: h2 + padW / 2, y: topY }, { x: h2 + padW / 2 + 30, y: o.bounds.bot }]); // right horn (landable)
      return { floor: padFloor(o, h2 - padW / 2, h2 + padW / 2, topY, h2, 150), overhangs: ov, cupX: h2, cupY: topY };
    },
    // THE LEVIATHAN — the fairway IS a sleeping ice-whale; putt up its breaching back to the blowhole pin.
    leviathan: function (o) {
      var endX = o.sx + o.dist, base = clamp(o.bounds.bot - 60, o.bounds.top, o.bounds.bot);
      var backTop = clamp(o.sy - 50 - o.diff * 30, o.bounds.top + 30, o.bounds.bot - 60);
      var headX = o.sx + o.dist * 0.5, blowX = headX + 30;
      // the whale's back as a continuous faceted heightfield ridge; cup on the blowhole (a small dip on top).
      var floor = [
        { x: o.sx, y: base }, { x: o.sx + o.dist * 0.18, y: clamp(base - 30, o.bounds.top, o.bounds.bot) },
        { x: o.sx + o.dist * 0.34, y: backTop + 20 }, { x: headX - 30, y: backTop },
        { x: blowX, y: clamp(backTop + 14, o.bounds.top, o.bounds.bot), cup: true },                 // blowhole dip = cup
        { x: headX + 70, y: backTop }, { x: o.sx + o.dist * 0.74, y: clamp(base - 20, o.bounds.top, o.bounds.bot) },
        { x: endX, y: base },
      ];
      return { floor: floor, overhangs: [], cupX: blowX, cupY: clamp(backTop + 14, o.bounds.top, o.bounds.bot) };
    },
    // ORBITAL RING FRAGMENT — a faceted arc of broken ring; bank up the rising facets to the saddle pin.
    orbital_ring: function (o) {
      var voidY = clamp(o.sy + 150, o.bounds.top, o.bounds.bot - 6);
      var padL = o.sx + o.dist * 0.5, padR = o.sx + o.dist * 0.74, padY = clamp(o.sy - 60 - o.diff * 20, o.bounds.top + 20, o.bounds.bot - 80);
      var cx = (padL + padR) / 2;
      var ov = [];
      // three rising trapezoid segments up to the landing segment
      var s1 = o.sx + o.dist * 0.18, s2 = o.sx + o.dist * 0.34;
      ov.push([{ x: s1, y: clamp(o.sy + 60, o.bounds.top, o.bounds.bot) }, { x: s2, y: clamp(o.sy + 20, o.bounds.top, o.bounds.bot) }, { x: s2 + 10, y: clamp(o.sy + 80, o.bounds.top, o.bounds.bot) }, { x: s1 + 5, y: clamp(o.sy + 110, o.bounds.top, o.bounds.bot) }]);
      ov.push([{ x: s2, y: clamp(o.sy + 20, o.bounds.top, o.bounds.bot) }, { x: padL, y: padY + 10 }, { x: padL + 6, y: padY + 60 }, { x: s2 + 8, y: clamp(o.sy + 70, o.bounds.top, o.bounds.bot) }]);
      // counterweight backstop block right of the pad
      ov.push([{ x: padR, y: padY }, { x: padR + 90, y: padY - 14 }, { x: padR + 100, y: padY + 50 }, { x: padR + 6, y: padY + 50 }]);
      return { floor: padFloor(o, padL, padR, padY, cx, 140), overhangs: ov, cupX: cx, cupY: padY };
    },
    // BROKEN BRIDGE — two snapped deck slabs; carry the void from near deck to the far deck pin.
    broken_bridge: function (o) {
      var voidY = clamp(o.sy + 150, o.bounds.top, o.bounds.bot - 6);
      var farL = o.sx + o.dist * 0.56, farR = o.sx + o.dist * 0.9, farY = clamp(o.sy - 20, o.bounds.top + 20, o.bounds.bot - 60);
      var cupX = farL + (farR - farL) * 0.2;
      var ov = [];
      // near deck slab + pylon (the ball launches from the tee shelf; near deck is mostly visual support)
      var nearL = o.sx + o.dist * 0.08, nearR = o.sx + o.dist * 0.36, nearY = clamp(o.sy, o.bounds.top, o.bounds.bot);
      ov.push([{ x: nearL, y: nearY + 24 }, { x: nearR, y: nearY + 24 }, { x: nearR, y: nearY + 40 }, { x: nearL, y: nearY + 40 }]);
      ov.push([{ x: (nearL + nearR) / 2 - 30, y: nearY + 40 }, { x: (nearL + nearR) / 2 + 30, y: nearY + 40 }, { x: (nearL + nearR) / 2 + 20, y: o.bounds.bot }, { x: (nearL + nearR) / 2 - 20, y: o.bounds.bot }]);
      // far deck pylon (visual)
      ov.push([{ x: (farL + farR) / 2 - 30, y: farY + 24 }, { x: (farL + farR) / 2 + 30, y: farY + 24 }, { x: (farL + farR) / 2 + 20, y: o.bounds.bot }, { x: (farL + farR) / 2 - 20, y: o.bounds.bot }]);
      // floor: tee shelf on near deck height, void, far deck pad
      var floor = [
        { x: o.sx, y: nearY }, { x: nearR - 30, y: nearY }, { x: nearR, y: voidY },
        { x: farL - 8, y: voidY }, { x: farL, y: farY }, { x: cupX, y: farY, cup: true }, { x: farR, y: farY },
        { x: farR + 8, y: voidY }, { x: o.sx + o.dist, y: voidY },
      ];
      return { floor: floor, overhangs: ov, cupX: cupX, cupY: farY };
    },
    // MOON-SHARDS — a cracked moon's shards form a stepped staircase to the big central shard pin.
    moon_shards: function (o) {
      var voidY = clamp(o.sy + 150, o.bounds.top, o.bounds.bot - 6);
      var ov = [], xs = [0.26, 0.42, 0.58], ys = [70, 30, -10];
      var padL = o.sx + o.dist * 0.5, padR = o.sx + o.dist * 0.72, padY = clamp(o.sy - 30 - o.diff * 20, o.bounds.top + 20, o.bounds.bot - 70);
      var cx = (padL + padR) / 2;
      for (var i = 0; i < 2; i++) { var sx2 = o.sx + o.dist * xs[i], sy2 = clamp(o.sy + ys[i], o.bounds.top + 30, o.bounds.bot - 40);
        ov.push([{ x: sx2 - 50, y: sy2 }, { x: sx2 + 50, y: sy2 }, { x: sx2 + 36, y: sy2 + 60 }, { x: sx2 - 36, y: sy2 + 60 }]); }
      // the central big shard = the landing pad (also draw a small high cap shard right of it for silhouette)
      ov.push([{ x: padR + 14, y: padY - 18 }, { x: padR + 90, y: padY - 8 }, { x: padR + 84, y: padY + 44 }, { x: padR + 20, y: padY + 44 }]);
      return { floor: padFloor(o, padL, padR, padY, cx, 140), overhangs: ov, cupX: cx, cupY: padY };
    },
    // DERELICT HULL — a dead capital ship hangs nose-up; carry the deck, pop onto the bridge-tower pin.
    derelict_hull: function (o) {
      var voidY = clamp(o.sy + 150, o.bounds.top, o.bounds.bot - 6);
      var padL = o.sx + o.dist * 0.5, padR = o.sx + o.dist * 0.62, padY = clamp(o.sy - 50 - o.diff * 20, o.bounds.top + 20, o.bounds.bot - 80);
      var cx = (padL + padR) / 2;
      var ov = [];
      // main hull wedge
      ov.push([{ x: o.sx + o.dist * 0.16, y: clamp(o.sy + 60, o.bounds.top, o.bounds.bot) }, { x: o.sx + o.dist * 0.72, y: clamp(o.sy - 10, o.bounds.top, o.bounds.bot) }, { x: o.sx + o.dist * 0.76, y: clamp(o.sy + 60, o.bounds.top, o.bounds.bot) }, { x: o.sx + o.dist * 0.2, y: o.bounds.bot - 40 }]);
      // upper deck plate (landable intermediate, just below the tower pad)
      ov.push([{ x: o.sx + o.dist * 0.4, y: clamp(o.sy + 10, o.bounds.top, o.bounds.bot) }, { x: o.sx + o.dist * 0.66, y: clamp(o.sy - 14, o.bounds.top, o.bounds.bot) }, { x: o.sx + o.dist * 0.66, y: clamp(o.sy + 22, o.bounds.top, o.bounds.bot) }, { x: o.sx + o.dist * 0.4, y: clamp(o.sy + 44, o.bounds.top, o.bounds.bot) }]);
      // bridge tower (the pad sits ON its top; emit the tower body just below the pad)
      ov.push([{ x: padL, y: padY + 4 }, { x: padR, y: padY + 4 }, { x: padR, y: padY + 50 }, { x: padL, y: padY + 50 }]);
      return { floor: padFloor(o, padL, padR, padY, cx, 140), overhangs: ov, cupX: cx, cupY: padY };
    },
    // BALANCED HOODOO — a fat boulder on a thin stalk; high drop onto the improbably wide capstone.
    balanced_hoodoo: function (o) {
      var voidY = clamp(o.sy + 150, o.bounds.top, o.bounds.bot - 6);
      var cx = o.sx + o.dist * 0.56, padW = 150, padY = clamp(o.sy - 30 - o.diff * 20, o.bounds.top + 30, o.bounds.bot - 90);
      var ov = [];
      // capstone body (just below the pad), thin stalk, base plinth
      ov.push([{ x: cx - padW / 2, y: padY + 4 }, { x: cx + padW / 2, y: padY + 4 }, { x: cx + padW / 2 - 30, y: padY + 44 }, { x: cx - padW / 2 + 30, y: padY + 44 }]);
      ov.push([{ x: cx - 26, y: padY + 44 }, { x: cx + 26, y: padY + 44 }, { x: cx + 20, y: padY + 130 }, { x: cx - 20, y: padY + 130 }]);  // stalk
      ov.push([{ x: cx - 60, y: padY + 130 }, { x: cx + 60, y: padY + 130 }, { x: cx + 50, y: o.bounds.bot }, { x: cx - 50, y: o.bounds.bot }]);  // plinth
      return { floor: padFloor(o, cx - padW / 2, cx + padW / 2, padY, cx, 140), overhangs: ov, cupX: cx, cupY: padY };
    },
  };

  var NAMES = Object.keys(BODIES);
  function genFloater(name, opts) {
    var fn = BODIES[name] || BODIES.ziggurat;
    var o = {
      sx: opts.sx, sy: opts.sy, dist: opts.dist, diff: opts.diff != null ? opts.diff : 0.5,
      rng: opts.rng || Math.random, bounds: opts.bounds || { top: 40, bot: 520 }, ballR: opts.ballR || 6,
    };
    return fn(o);
  }
  return { genFloater: genFloater, BODIES: BODIES, NAMES: NAMES };
});
