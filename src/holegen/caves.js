// ── holegen/caves.js — REAL cave/overhang layer (SDF/metaball → coarse contour → convex slabs) ───────
// The heightfield is one ground-line per column, so it can't do tunnels / overhangs / tucked pins. This
// layer shapes the heightfield FLOOR (a pocket, a mouth, a slot) AND emits convex ROOF/LIP slabs above it,
// collided by the engine's swept circle-vs-poly set-pieces (src/set-pieces.js). To stay flat-faceted AND
// keep the swept collision happy (it assumes CONVEX slabs), we build the roof as a COARSE band of convex
// quads (a marching-squares contour of a metaball/SDF field, decomposed into vertical convex strips). Each
// dream cave concept maps to a parametric field; the cup may sit under the lip / in the cavern.
//
// genCave(concept, opts) → { floor:[{x,y,cup?}], overhangs:[[{x,y}...]], cupX, cupY }
// opts: { sx, sy, dist, diff, rng, bounds, ballR }.  Pure (no engine globals); window.HG_CAVES + exports.

(function (root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof root !== 'undefined') root.HG_CAVES = api;
})(typeof window !== 'undefined' ? window : this, function () {
  'use strict';
  var clamp = function (v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; };
  var lerp = function (a, b, t) { return a + (b - a) * t; };

  // Convert a roof PROFILE (top edge yTop(x) over [xL,xR]) + thickness into a COARSE band of convex quads.
  // We sample the profile at `cols` columns and emit one convex quad per column-pair. Convex by
  // construction (4 points, top edge from the profile, bottom edge parallel-ish below it). thickness can be
  // a function of x for a drooping lip. This is the "coarse marching-squares → convex strips" path.
  function roofBand(xL, xR, cols, yTopFn, thickFn) {
    var quads = [], step = (xR - xL) / cols;
    for (var c = 0; c < cols; c++) {
      var x0 = xL + c * step, x1 = x0 + step;
      var t0 = yTopFn(x0), t1 = yTopFn(x1), th0 = thickFn(x0), th1 = thickFn(x1);
      // a near-rectangular convex quad (slight tilt allowed) — clockwise
      quads.push([{ x: x0, y: t0 }, { x: x1, y: t1 }, { x: x1, y: t1 + th1 }, { x: x0, y: t0 + th0 }]);
    }
    return quads;
  }

  // ── the dream cave concepts → field params ──────────────────────────────────────────────────────────
  // Each builds a floor polyline (with a cup) + roof slabs. ballR sets the clearance mouth so a putt fits.
  var CONCEPTS = {
    // CUP_UNDER_LIP — pin in shadow beneath a heavy ledge; bank under or stay out forever.
    cup_under_lip: function (o) {
      var endX = o.sx + o.dist, base = clamp(o.sy, o.bounds.top, o.bounds.bot);
      var floorY = clamp(Math.max(base, o.bounds.bot - 120), o.bounds.top, o.bounds.bot);
      var lipL = o.sx + o.dist * (0.5 + o.rng() * 0.06), lipR = Math.min(lipL + o.dist * 0.34, endX - 50);
      var gap = o.ballR * 5 + 18 + o.diff * 6, lipY = clamp(floorY - gap, o.bounds.top, o.bounds.bot);
      var cupX = lerp(lipL, lipR, 0.62);
      var floor = [
        { x: o.sx, y: base },
        { x: lipL - 70, y: clamp(lerp(base, floorY, 0.6), o.bounds.top, o.bounds.bot) },
        { x: lipL - 20, y: floorY },                     // open mouth front
        { x: cupX, y: floorY, cup: true },               // CUP under the lip
        { x: lipR, y: floorY },
        { x: lipR + 18, y: clamp(floorY - 30, o.bounds.top, o.bounds.bot) },
        { x: endX, y: clamp(lipY - 24, o.bounds.top, o.bounds.bot) },
      ];
      var roof = roofBand(lipL, lipR + 20, 6, function (x) { return lipY + Math.sin((x - lipL) / (lipR - lipL + 1) * Math.PI) * -4; }, function () { return 16 + o.diff * 8; });
      return { floor: floor, overhangs: roof, cupX: cupX, cupY: floorY };
    },
    // TUNNEL — putt down a slot, straight through a rock tunnel, pop out the far side. Cup past the tunnel.
    tunnel_putt: function (o) {
      var endX = o.sx + o.dist, base = clamp(o.sy, o.bounds.top, o.bounds.bot);
      var floorY = clamp(Math.max(base, o.bounds.bot - 100), o.bounds.top, o.bounds.bot);
      var mouthX = o.sx + o.dist * 0.32, tunEnd = mouthX + o.dist * (0.34 + o.rng() * 0.06);
      var gap = o.ballR * 4.5 + 16 + o.diff * 5, roofY = clamp(floorY - gap, o.bounds.top, o.bounds.bot);
      var greenY = clamp(base - o.diff * 8, o.bounds.top, o.bounds.bot), cupX = Math.min(tunEnd + o.dist * 0.16, endX - 50);
      var floor = [
        { x: o.sx, y: base },
        { x: mouthX - 60, y: clamp(lerp(base, floorY, 0.7), o.bounds.top, o.bounds.bot) },
        { x: mouthX, y: floorY }, { x: tunEnd, y: floorY },
        { x: tunEnd + 40, y: clamp(lerp(floorY, greenY, 0.5), o.bounds.top, o.bounds.bot) },
        { x: cupX, y: greenY, cup: true },
        { x: Math.min(cupX + 70, endX - 20), y: greenY }, { x: endX, y: greenY },
      ];
      var roof = roofBand(mouthX - 6, tunEnd + 6, 7, function () { return roofY; }, function () { return 18 + o.diff * 8; });
      return { floor: floor, overhangs: roof, cupX: cupX, cupY: greenY };
    },
    // STONE_ARCH — a great arch frames the fairway; thread the eye or go round. Cup on open green past it.
    stone_arch: function (o) {
      var endX = o.sx + o.dist, base = clamp(o.sy, o.bounds.top, o.bounds.bot);
      var archX = o.sx + o.dist * (0.42 + o.rng() * 0.06), span = o.dist * 0.22;
      var dipY = clamp(Math.max(base, o.bounds.bot - 130) + 10, o.bounds.top, o.bounds.bot);
      var head = o.ballR * 5 + 26 + o.diff * 6, crownY = clamp(dipY - head - 60, o.bounds.top + 10, o.bounds.bot);
      var greenStart = archX + span * 0.5 + o.dist * 0.12, greenY = clamp(base - o.diff * 6, o.bounds.top, o.bounds.bot);
      var cupX = Math.min(greenStart + o.dist * 0.12, endX - 50);
      var floor = [
        { x: o.sx, y: base },
        { x: archX - span * 0.5 - 30, y: clamp(lerp(base, dipY, 0.7), o.bounds.top, o.bounds.bot) },
        { x: archX, y: dipY }, { x: archX + span * 0.5, y: dipY },
        { x: archX + span * 0.5 + 30, y: clamp(lerp(dipY, greenY, 0.6), o.bounds.top, o.bounds.bot) },
        { x: greenStart, y: greenY }, { x: cupX, y: greenY, cup: true },
        { x: Math.min(cupX + 70, endX - 20), y: greenY }, { x: endX, y: greenY },
      ];
      // ARCH as a curved band (metaball-style top) — convex strips. Top arcs UP over the span.
      var aL = archX - span * 0.5 - 12, aR = archX + span * 0.5 + 12;
      var roof = roofBand(aL, aR, 8, function (x) { var t = (x - aL) / (aR - aL + 1); return crownY + (1 - Math.sin(t * Math.PI)) * (head * 0.6); }, function () { return 24 + o.diff * 10; });
      return { floor: floor, overhangs: roof, cupX: cupX, cupY: greenY };
    },
    // DROP_CAVERN — punch through a mouth and plunge into a cavern; pin on the dark floor.
    drop_cavern: function (o) {
      var endX = o.sx + o.dist, base = clamp(o.sy, o.bounds.top, o.bounds.bot);
      var mouthL = o.sx + o.dist * (0.30 + o.rng() * 0.05), mouthR = mouthL + o.dist * 0.40;
      var floorY = clamp(o.bounds.bot - 16, o.bounds.top, o.bounds.bot), shoulderY = clamp(base, o.bounds.top, o.bounds.bot);
      var cupX = lerp(mouthL, mouthR, 0.5);
      var floor = [
        { x: o.sx, y: shoulderY }, { x: mouthL - 20, y: shoulderY },
        { x: mouthL, y: clamp(shoulderY + 40, o.bounds.top, o.bounds.bot) },
        { x: mouthL + 30, y: floorY }, { x: cupX, y: floorY, cup: true }, { x: mouthR - 30, y: floorY },
        { x: mouthR, y: clamp(shoulderY + 40, o.bounds.top, o.bounds.bot) },
        { x: mouthR + 20, y: shoulderY }, { x: endX, y: shoulderY },
      ];
      // overhanging shoulders narrowing the mouth (two convex lips), leaving a ball-width drop slot.
      var gap = o.ballR * 6 + 24;
      var roof = [];
      roof.push([{ x: mouthL, y: clamp(shoulderY + 6, o.bounds.top, o.bounds.bot) }, { x: lerp(mouthL, cupX, 0.45), y: clamp(shoulderY + 6, o.bounds.top, o.bounds.bot) }, { x: lerp(mouthL, cupX, 0.45), y: clamp(shoulderY + 28, o.bounds.top, o.bounds.bot) }, { x: mouthL, y: clamp(shoulderY + 22, o.bounds.top, o.bounds.bot) }]);
      roof.push([{ x: lerp(cupX, mouthR, 0.55), y: clamp(shoulderY + 6, o.bounds.top, o.bounds.bot) }, { x: mouthR, y: clamp(shoulderY + 6, o.bounds.top, o.bounds.bot) }, { x: mouthR, y: clamp(shoulderY + 22, o.bounds.top, o.bounds.bot) }, { x: lerp(cupX, mouthR, 0.55), y: clamp(shoulderY + 28, o.bounds.top, o.bounds.bot) }]);
      return { floor: floor, overhangs: roof, cupX: cupX, cupY: floorY };
    },
    // SLOT_CANYON — thread a hairline slot; sheer walls. Cup on the floor past the slot.
    slot_canyon: function (o) {
      var endX = o.sx + o.dist, base = clamp(o.sy, o.bounds.top, o.bounds.bot);
      var slotX = o.sx + o.dist * (0.45 + o.rng() * 0.05);
      var rimY = clamp(base - 40, o.bounds.top + 10, o.bounds.bot);
      var floorY = clamp(base + 20, o.bounds.top, o.bounds.bot);
      var cupX = Math.min(slotX + o.dist * 0.2, endX - 50);
      var floor = [
        { x: o.sx, y: base }, { x: slotX - 40, y: rimY }, { x: slotX - 12, y: floorY },
        { x: slotX + 12, y: floorY }, { x: slotX + 40, y: rimY },
        { x: cupX, y: clamp(base + 6, o.bounds.top, o.bounds.bot), cup: true }, { x: endX, y: base },
      ];
      // two tall convex pillars forming the slot walls (above the floor), gap = ball-width+
      var gap = o.ballR * 3 + 8, wallTop = clamp(rimY - 70 - o.diff * 40, o.bounds.top, o.bounds.bot);
      var roof = [
        [{ x: slotX - 60, y: wallTop }, { x: slotX - gap, y: wallTop }, { x: slotX - gap, y: rimY }, { x: slotX - 60, y: rimY }],
        [{ x: slotX + gap, y: wallTop }, { x: slotX + 60, y: wallTop }, { x: slotX + 60, y: rimY }, { x: slotX + gap, y: rimY }],
      ];
      return { floor: floor, overhangs: roof, cupX: cupX, cupY: clamp(base + 6, o.bounds.top, o.bounds.bot) };
    },
    // KEYHOLE — a hole bored through a massif; putt through the slot to the green inside.
    keyhole: function (o) {
      var endX = o.sx + o.dist, base = clamp(o.sy, o.bounds.top, o.bounds.bot);
      var massL = o.sx + o.dist * 0.34, massR = massL + o.dist * 0.38;
      var floorY = clamp(base + 8, o.bounds.top, o.bounds.bot);
      var cupX = lerp(massL, massR, 0.55);
      var floor = [
        { x: o.sx, y: base }, { x: massL - 10, y: floorY }, { x: cupX, y: floorY, cup: true },
        { x: massR + 10, y: floorY }, { x: endX, y: base },
      ];
      // the massif = a big convex block ABOVE a ball-clearance keyhole slot (two stacked convex pieces with the slot between)
      var slotTop = clamp(floorY - (o.ballR * 4 + 16), o.bounds.top, o.bounds.bot);
      var topY = clamp(base - 150 - o.diff * 50, o.bounds.top + 6, o.bounds.bot);
      var roof = roofBand(massL, massR, 6, function () { return topY; }, function (x) { return slotTop - topY; });
      return { floor: floor, overhangs: roof, cupX: cupX, cupY: floorY };
    },
    // THE_MAW — a toothy mouth yawns open; drop past the fangs into the throat where the pin hides.
    the_maw: function (o) {
      var endX = o.sx + o.dist, base = clamp(o.sy, o.bounds.top, o.bounds.bot);
      var mawL = o.sx + o.dist * (0.32 + o.rng() * 0.04), mawR = mawL + o.dist * 0.40;
      var throatY = clamp(o.bounds.bot - 16, o.bounds.top, o.bounds.bot), lipY = clamp(base - 30, o.bounds.top, o.bounds.bot);
      var cupX = lerp(mawL, mawR, 0.5);
      var floor = [
        { x: o.sx, y: base }, { x: mawL - 30, y: lipY }, { x: mawL, y: clamp(lipY + 30, o.bounds.top, o.bounds.bot) },
        { x: mawL + 30, y: throatY }, { x: cupX, y: throatY, cup: true }, { x: mawR - 30, y: throatY },
        { x: mawR, y: clamp(lipY + 30, o.bounds.top, o.bounds.bot) }, { x: mawR + 30, y: lipY }, { x: endX, y: base },
      ];
      // upper fang row as convex teeth hanging from a lintel (each tooth a convex triangle), gap above throat
      var lintelY = clamp(lipY - 40, o.bounds.top, o.bounds.bot), teeth = 4, roof = [];
      roof.push(roofBand(mawL - 10, mawR + 10, 1, function () { return lintelY - 18; }, function () { return 18; })[0]);
      for (var t = 0; t < teeth; t++) {
        var fx = lerp(mawL, mawR, (t + 0.5) / teeth), fw = (mawR - mawL) / teeth * 0.32;
        roof.push([{ x: fx - fw, y: lintelY }, { x: fx + fw, y: lintelY }, { x: fx, y: lintelY + 26 + o.diff * 10 }]);
      }
      return { floor: floor, overhangs: roof, cupX: cupX, cupY: throatY };
    },
    // CANTILEVER — a shelf juts out over nothing; land on the hanging green in mid-air.
    cantilever: function (o) {
      var endX = o.sx + o.dist, base = clamp(o.sy, o.bounds.top, o.bounds.bot);
      var shelfY = clamp(base - 60 - o.diff * 40, o.bounds.top + 20, o.bounds.bot - 40);
      var shelfL = o.sx + o.dist * 0.30, shelfR = shelfL + o.dist * 0.30;
      var floorY = clamp(o.bounds.bot - 16, o.bounds.top, o.bounds.bot);
      var cupX = lerp(shelfL, shelfR, 0.5);
      // floor: a low gulf under the shelf; the shelf TOP is the green (built as a solid convex slab the ball lands ON).
      var floor = [
        { x: o.sx, y: base }, { x: shelfL - 20, y: clamp(base + 30, o.bounds.top, o.bounds.bot) },
        { x: shelfL - 10, y: floorY }, { x: shelfR + 10, y: floorY },
        { x: shelfR + 30, y: clamp(base + 10, o.bounds.top, o.bounds.bot) }, { x: endX, y: base },
      ];
      // the cantilevered slab: a thick convex shelf whose TOP at shelfY is the landable green; the cup is placed on top.
      var slab = [{ x: shelfL, y: shelfY }, { x: shelfR, y: shelfY }, { x: shelfR, y: shelfY + 26 }, { x: shelfL - 6, y: shelfY + 34 }];
      return { floor: floor, overhangs: [slab], cupX: cupX, cupY: shelfY - o.ballR, cupOnSlab: { x0: shelfL, x1: shelfR, y: shelfY } };
    },
    // POCKET_BEHIND_WALL — a tall wall hides the green; clear it, nestle into a pocket beneath the far ledge.
    pocket_wall: function (o) {
      var endX = o.sx + o.dist, base = clamp(o.sy, o.bounds.top, o.bounds.bot);
      var wallX = o.sx + o.dist * 0.34, wallTop = clamp(base - 120 - o.diff * 50, o.bounds.top + 10, o.bounds.bot);
      var pocketX = o.sx + o.dist * 0.7, floorY = clamp(base + 16, o.bounds.top, o.bounds.bot);
      var cupX = pocketX;
      var floor = [
        { x: o.sx, y: base }, { x: wallX - 18, y: base }, { x: wallX - 6, y: wallTop }, { x: wallX + 6, y: wallTop },
        { x: wallX + 18, y: base }, { x: pocketX - 50, y: floorY }, { x: cupX, y: floorY, cup: true },
        { x: pocketX + 40, y: clamp(floorY - 20, o.bounds.top, o.bounds.bot) }, { x: endX, y: base },
      ];
      // a far ledge lip over the pocket (one convex slab) so it's a tucked pocket
      var lipY = clamp(floorY - (o.ballR * 4 + 16), o.bounds.top, o.bounds.bot);
      var roof = roofBand(pocketX - 20, Math.min(pocketX + 90, endX - 30), 4, function () { return lipY; }, function () { return 16 + o.diff * 8; });
      return { floor: floor, overhangs: roof, cupX: cupX, cupY: floorY };
    },
    // DOUBLE_DECKER — two stacked stone decks; the pin sits in the gap between floors.
    double_decker: function (o) {
      var endX = o.sx + o.dist, base = clamp(o.sy, o.bounds.top, o.bounds.bot);
      var deckL = o.sx + o.dist * 0.22, deckR = endX - o.dist * 0.12;
      var midY = clamp(base - 70 - o.diff * 30, o.bounds.top + 30, o.bounds.bot - 30);
      var cupX = lerp(deckL, deckR, 0.5);
      var floor = [
        { x: o.sx, y: base }, { x: deckL - 10, y: clamp(base, o.bounds.top, o.bounds.bot) },
        { x: deckL, y: midY }, { x: cupX, y: midY, cup: true }, { x: deckR, y: midY },
        { x: deckR + 10, y: clamp(base, o.bounds.top, o.bounds.bot) }, { x: endX, y: base },
      ];
      // upper deck slab hanging over the mid floor (the gap = the playable shelf the pin sits on)
      var upperY = clamp(midY - (o.ballR * 5 + 22), o.bounds.top, o.bounds.bot);
      var roof = roofBand(deckL + 30, deckR - 30, 6, function () { return upperY; }, function () { return 18 + o.diff * 8; });
      return { floor: floor, overhangs: roof, cupX: cupX, cupY: midY };
    },
    // MUSHROOM_ROCKS — top-heavy hoodoos loom over the green; putt into the shade beneath their caps.
    mushroom_rocks: function (o) {
      var endX = o.sx + o.dist, base = clamp(o.sy, o.bounds.top, o.bounds.bot);
      var floorY = clamp(base + 6, o.bounds.top, o.bounds.bot);
      var cupX = o.sx + o.dist * (0.62 + o.rng() * 0.06);
      var floor = [{ x: o.sx, y: base }, { x: cupX - 60, y: floorY }, { x: cupX, y: floorY, cup: true }, { x: cupX + 60, y: floorY }, { x: endX, y: base }];
      // two mushrooms: a thin stem (convex) + a wide cap (convex) overhanging
      var roof = [];
      [o.sx + o.dist * 0.3, cupX].forEach(function (mx, idx) {
        var capY = clamp(floorY - (o.ballR * 4 + 30 + idx * 10), o.bounds.top, o.bounds.bot), capW = 70;
        roof.push([{ x: mx - capW, y: capY }, { x: mx + capW, y: capY }, { x: mx + capW * 0.7, y: capY + 22 }, { x: mx - capW * 0.7, y: capY + 22 }]);   // cap
      });
      return { floor: floor, overhangs: roof, cupX: cupX, cupY: floorY };
    },
  };

  var NAMES = Object.keys(CONCEPTS);
  function genCave(concept, opts) {
    var fn = CONCEPTS[concept] || CONCEPTS.cup_under_lip;
    var o = {
      sx: opts.sx, sy: opts.sy, dist: opts.dist, diff: opts.diff != null ? opts.diff : 0.5,
      rng: opts.rng || Math.random, bounds: opts.bounds || { top: 40, bot: 520 }, ballR: opts.ballR || 6,
    };
    return fn(o);
  }
  return { genCave: genCave, CONCEPTS: CONCEPTS, NAMES: NAMES, roofBand: roofBand };
});
