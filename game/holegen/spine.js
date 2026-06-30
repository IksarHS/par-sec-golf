// ── holegen/spine.js — the narrative SPINE (low-freq "story" of a hole) ──────────────────────────────
// A hole is a COMPOSED SIGNAL, not a deck draw. The spine is the lowest-frequency layer: a small set of
// monotone-x control points tee → landing → hazard → green that encode the hole's CONCEPT (descent /
// carry-then-climb / plateau-hop / gather-bowl / tucked-pin / ridge-run / valley-cross). Difficulty scales
// drop, carry width, green size. A monotone Hermite spline samples between the points so the macro line
// NEVER overshoots backward (X-monotonicity, required by the engine) and pacing/playability hold BY
// CONSTRUCTION. Operators + skin add the meso/micro detail on top (operators.js / skin.js).
//
// Pure functions, no engine globals → prototyped headlessly in tools/dreamgen-proto.cjs before wiring in.
// Exposed on window.HG_SPINE (browser) and module.exports (node).

(function (root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof root !== 'undefined') root.HG_SPINE = api;
})(typeof window !== 'undefined' ? window : this, function () {
  'use strict';

  var clamp = function (v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; };

  // monotone cubic Hermite (Fritsch–Carlson tangents) → smooth, never-overshoot interpolation of (x,y) knots.
  // Returns a sampler y(x). Used to draw the macro fairway line between spine control points.
  function monotoneSpline(pts) {
    var n = pts.length;
    if (n < 2) return function (x) { return pts[0] ? pts[0].y : 0; };
    var xs = pts.map(function (p) { return p.x; }), ys = pts.map(function (p) { return p.y; });
    var dx = [], dy = [], slope = [];
    for (var i = 0; i < n - 1; i++) { dx[i] = xs[i + 1] - xs[i] || 1e-6; dy[i] = ys[i + 1] - ys[i]; slope[i] = dy[i] / dx[i]; }
    var m = [slope[0]];
    for (var k = 1; k < n - 1; k++) {
      if (slope[k - 1] * slope[k] <= 0) { m[k] = 0; }
      else { var w1 = 2 * dx[k] + dx[k - 1], w2 = dx[k] + 2 * dx[k - 1]; m[k] = (w1 + w2) / (w1 / slope[k - 1] + w2 / slope[k]); }
    }
    m[n - 1] = slope[n - 2];
    return function (x) {
      if (x <= xs[0]) return ys[0];
      if (x >= xs[n - 1]) return ys[n - 1];
      var lo = 0, hi = n - 1;
      while (hi - lo > 1) { var mid = (lo + hi) >> 1; if (xs[mid] <= x) lo = mid; else hi = mid; }
      var h = dx[lo], t = (x - xs[lo]) / h, t2 = t * t, t3 = t2 * t;
      var h00 = 2 * t3 - 3 * t2 + 1, h10 = t3 - 2 * t2 + t, h01 = -2 * t3 + 3 * t2, h11 = t3 - t2;
      return h00 * ys[lo] + h10 * h * m[lo] + h01 * ys[lo + 1] + h11 * h * m[lo + 1];
    };
  }

  // The CONCEPTS. Each returns control points in world coords (x increasing, y down) given:
  //   tee {x,y}, dist (tee→green px), diff (0..1+), rng() (seeded 0..1), bounds {top,bot}
  // The LAST point is the green (cup zone, flat). carryX/hazard markers are returned as `feature` hints so
  // operators/score can know where the tempting carry / hazard lives. Stays inside [top,bot].
  var CONCEPTS = {
    // straightforward drop from a high tee to a low green — gravity does the work, control the run-out
    descent: function (tee, dist, diff, rng, b) {
      var drop = (70 + diff * 150) * (0.7 + rng() * 0.5);
      var gx = tee.x + dist, gy = clamp(tee.y + drop, b.top + 40, b.bot - 20);
      var l1 = tee.x + dist * (0.30 + rng() * 0.1);
      var l2 = tee.x + dist * (0.62 + rng() * 0.1);
      return { pts: [{ x: tee.x, y: tee.y }, { x: l1, y: clamp(tee.y + drop * 0.45, b.top, b.bot) }, { x: l2, y: clamp(tee.y + drop * 0.8, b.top, b.bot) }, { x: gx, y: gy }], feature: { kind: 'descent' } };
    },
    // a tempting CARRY across a low gap, then a CLIMB to a raised green (risk/reward: lay up or go for it)
    carry_then_climb: function (tee, dist, diff, rng, b) {
      var gapX = tee.x + dist * (0.42 + rng() * 0.08);
      var gapY = clamp(tee.y + 80 + diff * 90, b.top, b.bot - 10);
      var climb = (50 + diff * 110) * (0.7 + rng() * 0.5);
      var gx = tee.x + dist, gy = clamp(tee.y - climb, b.top + 30, b.bot - 20);
      return { pts: [{ x: tee.x, y: tee.y }, { x: tee.x + dist * 0.20, y: clamp(tee.y - 6, b.top, b.bot) }, { x: gapX, y: gapY }, { x: tee.x + dist * 0.70, y: clamp(gy + climb * 0.4, b.top, b.bot) }, { x: gx, y: gy }], feature: { kind: 'carry', carryX: gapX, carryY: gapY } };
    },
    // hop across one or two plateaus at different heights to a green on the far shelf
    plateau_hop: function (tee, dist, diff, rng, b) {
      var pY = clamp(tee.y - (30 + diff * 70), b.top + 30, b.bot - 20);
      var p1 = tee.x + dist * (0.30 + rng() * 0.06);
      var p2 = tee.x + dist * (0.60 + rng() * 0.06);
      var gx = tee.x + dist, gy = clamp(pY + (rng() - 0.5) * 40, b.top + 30, b.bot - 20);
      return { pts: [{ x: tee.x, y: tee.y }, { x: p1, y: pY }, { x: tee.x + dist * 0.45, y: clamp(pY + 60 + diff * 40, b.top, b.bot) }, { x: p2, y: clamp(pY + (rng() - 0.5) * 20, b.top, b.bot) }, { x: gx, y: gy }], feature: { kind: 'plateau' } };
    },
    // everything funnels into a bowl with the pin at the bottom — forgiving but reads dramatic
    gather_bowl: function (tee, dist, diff, rng, b) {
      var rimY = clamp(tee.y - (10 + diff * 40), b.top + 30, b.bot - 80);
      var floorY = clamp(rimY + 90 + diff * 70, b.top, b.bot - 14);
      var cx = tee.x + dist;
      return { pts: [{ x: tee.x, y: tee.y }, { x: tee.x + dist * 0.30, y: rimY }, { x: tee.x + dist * 0.58, y: clamp(floorY - 30, b.top, b.bot) }, { x: cx, y: floorY }], feature: { kind: 'bowl', bowlX: cx, bowlY: floorY } };
    },
    // the pin is tucked low/behind a rise — you must shape a shot to a hidden green
    tucked_pin: function (tee, dist, diff, rng, b) {
      var riseX = tee.x + dist * (0.55 + rng() * 0.08);
      var riseY = clamp(tee.y - (50 + diff * 80), b.top + 25, b.bot - 40);
      var gx = tee.x + dist, gy = clamp(tee.y + 40 + diff * 50, b.top, b.bot - 16);
      return { pts: [{ x: tee.x, y: tee.y }, { x: tee.x + dist * 0.30, y: clamp(tee.y - 20, b.top, b.bot) }, { x: riseX, y: riseY }, { x: riseX + dist * 0.12, y: clamp(gy - 20, b.top, b.bot) }, { x: gx, y: gy }], feature: { kind: 'tuck', wallX: riseX } };
    },
    // a long climbing ridge — relentless ascent ledge by ledge, no shortcuts
    ridge_run: function (tee, dist, diff, rng, b) {
      var rise = 110 + diff * 130;
      var gx = tee.x + dist, gy = clamp(tee.y - rise, b.top + 20, b.bot - 20);
      var n = 4, pts = [{ x: tee.x, y: tee.y }];
      for (var i = 1; i <= n; i++) { var t = i / n; pts.push({ x: tee.x + dist * t, y: clamp(tee.y - rise * t + (rng() - 0.5) * 30, b.top, b.bot) }); }
      pts[pts.length - 1] = { x: gx, y: gy };
      return { pts: pts, feature: { kind: 'ridge' } };
    },
    // drop into a valley then up the other side to a green level-ish with the tee
    valley_cross: function (tee, dist, diff, rng, b) {
      var floorX = tee.x + dist * (0.5 + (rng() - 0.5) * 0.1);
      var floorY = clamp(tee.y + 100 + diff * 90, b.top, b.bot - 10);
      var gx = tee.x + dist, gy = clamp(tee.y + (rng() - 0.5) * 50, b.top + 30, b.bot - 20);
      return { pts: [{ x: tee.x, y: tee.y }, { x: tee.x + dist * 0.26, y: clamp(tee.y + 30, b.top, b.bot) }, { x: floorX, y: floorY }, { x: tee.x + dist * 0.74, y: clamp(gy + 40, b.top, b.bot) }, { x: gx, y: gy }], feature: { kind: 'valley', floorX: floorX, floorY: floorY } };
    },
  };

  var CONCEPT_NAMES = Object.keys(CONCEPTS);

  // makeSpine(concept, opts) → { pts, sample(x), feature, cupX, teeX, greenX, range }
  //   opts: { tee:{x,y}, dist, diff, rng, bounds:{top,bot} }
  function makeSpine(concept, opts) {
    var tee = opts.tee, dist = opts.dist, diff = opts.diff != null ? opts.diff : 0.4;
    var rng = opts.rng || Math.random, b = opts.bounds || { top: 60, bot: 480 };
    var fn = CONCEPTS[concept] || CONCEPTS.descent;
    var out = fn(tee, dist, diff, rng, b);
    // enforce strictly increasing x on control points (Hermite needs it)
    var mx = -Infinity;
    for (var i = 0; i < out.pts.length; i++) { if (out.pts[i].x <= mx) out.pts[i].x = mx + 2; mx = out.pts[i].x; }
    var sampler = monotoneSpline(out.pts);
    var green = out.pts[out.pts.length - 1];
    return { pts: out.pts, sample: sampler, feature: out.feature, teeX: tee.x, greenX: green.x, greenY: green.y, range: { x0: tee.x, x1: green.x } };
  }

  return { makeSpine: makeSpine, monotoneSpline: monotoneSpline, CONCEPTS: CONCEPTS, CONCEPT_NAMES: CONCEPT_NAMES };
});
