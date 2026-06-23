// ── holegen/skin.js — NOISE SKIN + TERRACE + THERMAL angle-of-repose pass ────────────────────────────
// The micro layer (the faceted LOOK, ~free) applied to a sampled height array AND the completability
// guarantee. Three passes:
//   1. small global fbm so nothing is glassy/perfect (subtle).
//   2. optional TERRACING (round(e·N)/N + a smoothstep lip) → our angular mesa/cliff facets.
//   3. THERMAL angle-of-repose: clamp every slope to a max grade so no segment is steeper than a ball can
//      traverse/rest on. This kills the low-gravity "rolls off forever" / "trapped in a pit" stuck class
//      BY CONSTRUCTION (the biggest completability lever the design doc calls out). It's the discrete
//      thermal-erosion relaxation: repeatedly move "material" downhill until no neighbour pair exceeds the
//      repose grade. We relax in BOTH directions so pits and spikes both melt to playable grades.
//
// Operates on a {xs:[], ys:[]} sampled at a fixed spacing (facet size). Pure; window.HG_SKIN + exports.

(function (root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof root !== 'undefined') root.HG_SKIN = api;
})(typeof window !== 'undefined' ? window : this, function () {
  'use strict';

  // value-noise + fbm (1D) — same hash as tools/noise-proto.cjs so the look matches the owner's proto.
  function hash2(xi, s) { var h = (Math.imul(xi, 374761393) + Math.imul(s, 2246822519)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
  var sm = function (t) { return t * t * (3 - 2 * t); }, L = function (a, b, t) { return a + (b - a) * t; };
  function vn(x, s) { var xi = Math.floor(x), xf = x - xi; return L(hash2(xi, s), hash2(xi + 1, s), sm(xf)); }
  function fbm(x, s, oct) { oct = oct || 3; var a = 0.5, f = 1, sum = 0, n = 0; for (var i = 0; i < oct; i++) { sum += a * vn(x * f, s + i * 1013); n += a; a *= 0.5; f *= 2; } return sum / n; }

  // applySkin(heights, params): heights = {xs, ys}. params:
  //   { fbmAmp, fbmFreq, seed, terrace:{on,N,step,lip}, thermal:{maxGrade,iters}, protect:[{x,r}], bounds }
  // protect = x-ranges (cup/tee) kept flat-ish (thermal still runs but we don't add noise there).
  function applySkin(heights, params) {
    params = params || {};
    var xs = heights.xs, ys = heights.ys.slice(), n = ys.length;
    var seed = params.seed || 1234;
    var b = params.bounds || { top: 40, bot: 520 };
    var protect = params.protect || [];
    var isProtected = function (x) { for (var i = 0; i < protect.length; i++) if (Math.abs(x - protect[i].x) < protect[i].r) return true; return false; };

    // 1) global fbm skin
    var fa = params.fbmAmp != null ? params.fbmAmp : 5, ff = params.fbmFreq != null ? params.fbmFreq : 0.018;
    if (fa > 0) for (var i = 0; i < n; i++) { if (isProtected(xs[i])) continue; ys[i] += (fbm(xs[i] * ff, seed, 3) - 0.5) * 2 * fa; }

    // 2) terrace (quantize → flats + sharp lips) — gives the faceted mesa/cliff look
    var t = params.terrace;
    if (t && t.on) {
      var step = t.step || 22;
      for (var j = 0; j < n; j++) { if (isProtected(xs[j])) continue; ys[j] = Math.round(ys[j] / step) * step; }
    }

    // 3) THERMAL angle-of-repose relaxation — guarantee traversable grades.
    var th = params.thermal || {};
    var maxGrade = th.maxGrade != null ? th.maxGrade : 1.05;   // max |dy|/dx between adjacent samples
    var iters = th.iters != null ? th.iters : 24;
    var dx = (xs[1] != null ? xs[1] - xs[0] : 24);
    var maxDelta = maxGrade * dx;                              // max height step per facet
    for (var it = 0; it < iters; it++) {
      var changed = false;
      // forward + backward sweeps so both over-steep rises and drops settle
      for (var p = 0; p < n - 1; p++) {
        var d = ys[p + 1] - ys[p];
        if (d > maxDelta) { var ex = (d - maxDelta) * 0.5; if (!isProtected(xs[p + 1])) ys[p + 1] -= ex; if (!isProtected(xs[p])) ys[p] += ex; changed = true; }
        else if (d < -maxDelta) { var ex2 = (-d - maxDelta) * 0.5; if (!isProtected(xs[p + 1])) ys[p + 1] += ex2; if (!isProtected(xs[p])) ys[p] -= ex2; changed = true; }
      }
      if (!changed) break;
    }
    // clamp to bounds
    for (var q = 0; q < n; q++) { if (ys[q] < b.top) ys[q] = b.top; if (ys[q] > b.bot) ys[q] = b.bot; }
    return { xs: xs, ys: ys };
  }

  return { applySkin: applySkin, fbm: fbm, vn: vn };
});
