// ── holegen/operators.js — MESO operators (composable feature kernels) ───────────────────────────────
// The middle layer of the composed signal. Each operator is a height DELTA kernel over x that we stack onto
// the spine via soft min/max (k-blend smin/smax) so features MELT in instead of stamping. Operator
// count/scale is THE real complexity knob — it adds STRUCTURE (a tempting shortcut plateau, a bunker
// guarding the pin), not just amplitude. compose(baseFn, ops) returns a heightFn y(x) = blend(base, ops).
//
// y is DOWN (screen coords). A "mound" (higher ground) is NEGATIVE delta; a "bunker"/pit is POSITIVE.
// Pure functions; exposed on window.HG_OPS + module.exports. Prototyped in tools/dreamgen-proto.cjs.

(function (root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof root !== 'undefined') root.HG_OPS = api;
})(typeof window !== 'undefined' ? window : this, function () {
  'use strict';

  var smoothstep = function (a, bv, x) { var t = (x - a) / (bv - a || 1e-6); t = t < 0 ? 0 : t > 1 ? 1 : t; return t * t * (3 - 2 * t); };
  // soft-min / soft-max (polynomial, k = blend width). smin = take the lower surface (higher ground, y up)
  // with a rounded seam; smax = the opposite. We mostly blend by simple weighted add for facets + use
  // smin/smax only where a hard feature should round into the base.
  function smin(a, bv, k) { var h = Math.max(k - Math.abs(a - bv), 0) / (k || 1e-6); return Math.min(a, bv) - h * h * k * 0.25; }
  function smax(a, bv, k) { return -smin(-a, -bv, k); }

  // ── feature kernels: each returns a function delta(x) (a height offset to ADD to the base) ──
  // plateau: a raised flat shelf between [x0,x1], height h (up = -h), opposed smoothsteps for clean walls.
  function plateau(x0, x1, h, edge) {
    edge = edge || 26;
    return function (x) { return -h * (smoothstep(x0 - edge, x0 + edge, x) * (1 - smoothstep(x1 - edge, x1 + edge, x))); };
  }
  // cliffStep: a one-sided step of height h at xc (down by +h to the right when h>0); smoothstep wall.
  function cliffStep(xc, h, width) {
    width = width || 30;
    return function (x) { return h * smoothstep(xc - width, xc + width, x); };
  }
  // mound (+ up): a gaussian bump centred xc, peak h (up = -h), half-width w.
  function mound(xc, h, w) {
    return function (x) { var d = (x - xc) / (w || 1); return -h * Math.exp(-d * d); };
  }
  // bunker (pit): a gaussian depression centred xc, depth h (down = +h), half-width w.
  function bunker(xc, h, w) {
    return function (x) { var d = (x - xc) / (w || 1); return h * Math.exp(-d * d); };
  }
  // dunePatch: windowed fbm roughness over [x0,x1] (amp a), for a stretch of dunes/rough.
  function dunePatch(x0, x1, a, freq, seed, fbmFn) {
    return function (x) { if (x < x0 || x > x1) return 0; var w = Math.sin(Math.PI * (x - x0) / (x1 - x0 || 1)); return (fbmFn(x * freq, seed) - 0.5) * 2 * a * w; };
  }
  // ramp: a linear tilt over [x0,x1] adding dh across it (signed) — a banked approach / tilted shelf.
  function ramp(x0, x1, dh) {
    return function (x) { var t = smoothstep(x0, x1, x); return dh * t; };
  }

  // compose(baseFn, ops): y(x) = base(x) + Σ ops(x). ops is an array of delta fns.
  function compose(baseFn, ops) {
    return function (x) { var y = baseFn(x); for (var i = 0; i < ops.length; i++) y += ops[i](x); return y; };
  }

  return {
    smoothstep: smoothstep, smin: smin, smax: smax,
    plateau: plateau, cliffStep: cliffStep, mound: mound, bunker: bunker, dunePatch: dunePatch, ramp: ramp,
    compose: compose,
  };
});
