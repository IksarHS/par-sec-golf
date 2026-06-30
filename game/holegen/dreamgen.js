// ── holegen/dreamgen.js — the DREAM hole generator (orchestrator + engine wiring) ────────────────────
// Composes the spine + operators + skin (+ optional caves / floating set-pieces) into the engine's hole
// shape and registers it as archetypes the new system's courses use. THE pipeline:
//   pick concept → makeSpine → stack operators → sample to a faceted heightfield → applySkin (fbm + terrace
//   + THERMAL angle-of-repose, the completability guarantee) → emit overhangs (caves/floaters) → return
//   verts (engine archetype shape) with the cup marked. Quality-diversity selection (generate-K-keep-best
//   via the REAL bot + score.js) wraps full-hole generation for gen:'composed' courses.
//
// FULLY ADDITIVE + GATED: registers NEW archetype names into the engine's archetypes table; installs ONE
// wrapper around generateHoleTerrain that is INERT unless currentCourse.gen === 'composed'. Peel this file
// (+ the new system block in planet-gen.js) → every other course is byte-identical. Needs HG_SPINE/HG_OPS/
// HG_SKIN/HG_CAVES/HG_FLOAT (loaded before this) and the engine globals (archetypes, clampY, H, BALL_RADIUS…).

(function () {
  'use strict';
  if (typeof archetypes === 'undefined' || typeof ARCHETYPE_TABLE === 'undefined') return;   // not the engine → inert
  var SPINE = (typeof window !== 'undefined' && window.HG_SPINE) || (typeof HG_SPINE !== 'undefined' ? HG_SPINE : null);
  var OPS = (typeof window !== 'undefined' && window.HG_OPS) || (typeof HG_OPS !== 'undefined' ? HG_OPS : null);
  var SKIN = (typeof window !== 'undefined' && window.HG_SKIN) || (typeof HG_SKIN !== 'undefined' ? HG_SKIN : null);
  var CAVES = (typeof window !== 'undefined' && window.HG_CAVES) || (typeof HG_CAVES !== 'undefined' ? HG_CAVES : null);
  var FLOAT = (typeof window !== 'undefined' && window.HG_FLOAT) || (typeof HG_FLOAT !== 'undefined' ? HG_FLOAT : null);
  if (!SPINE || !OPS || !SKIN) return;   // pipeline missing → inert

  var FACET = 22;                        // facet sample spacing (chunky GoM-style)
  var BR = (typeof BALL_RADIUS !== 'undefined') ? BALL_RADIUS : 6;
  var bounds = function () { return { top: H * 0.10, bot: H * 0.90 }; };

  // map difficulty (0..~1.4 engine) → 0..1 normalized for the pipeline
  function nd(diff) { return Math.max(0, Math.min(1, diff / 1.2)); }

  // ── concept → operator presets (the qualitative complexity: structure, not amplitude) ──
  function buildOps(concept, sp, sx, dist, d, rng) {
    var ops = [], span = dist, gx = sp.greenX;
    // operator COUNT + SCALE = the real complexity knob. Bias to MORE, BIGGER features so holes read as
    // designed + demand a shaped human shot (the autoplay bot one-putts flat fairways either way).
    var nOps = 2 + Math.round(d * 3 + rng() * 2);
    var picks = ['mound', 'bunker', 'plateau', 'dune', 'cliff', 'ridge'];
    for (var i = 0; i < nOps; i++) {
      var px = sx + span * (0.15 + rng() * 0.62);
      if (Math.abs(px - gx) < 80) px = gx - 110 - rng() * 70;  // keep features off the green
      var kind = picks[(rng() * picks.length) | 0];
      if (kind === 'mound') ops.push(OPS.mound(px, 30 + d * 50, 48 + rng() * 44));
      else if (kind === 'bunker') ops.push(OPS.bunker(px, 22 + d * 36, 34 + rng() * 30));
      else if (kind === 'plateau') { var pw = 70 + rng() * 110; ops.push(OPS.plateau(px, px + pw, 30 + d * 48)); }
      else if (kind === 'dune') ops.push(OPS.dunePatch(sx + span * 0.12, gx - 60, 7 + d * 12, 0.016 + rng() * 0.012, (rng() * 1e6) | 0, SKIN.fbm));
      else if (kind === 'ridge') ops.push(OPS.mound(px, 50 + d * 70, 30 + rng() * 24));   // a sharp peak the ball threads
      else ops.push(OPS.cliffStep(px, (rng() < 0.5 ? -1 : 1) * (34 + d * 44), 26));
    }
    // a guarding bunker just short of the green (a real approach decision)
    ops.push(OPS.bunker(gx - 70 - rng() * 40, 18 + d * 26, 34));
    // a tempting shortcut plateau near a carry concept → a real decision
    if (sp.feature && sp.feature.kind === 'carry') ops.push(OPS.plateau(sp.feature.carryX + 60, sp.feature.carryX + 170, 34 + d * 30));
    return ops;
  }

  // sample a composed heightfield into engine verts (with the cup vertex), running the full skin pass.
  function composedVerts(concept, sx, sy, dist, diff, rng) {
    var b = bounds(), d = nd(diff);
    var tee = { x: sx, y: clampY(sy) };
    var sp = SPINE.makeSpine(concept, { tee: tee, dist: dist, diff: d, rng: rng, bounds: b });
    var ops = buildOps(concept, sp, sx, dist, d, rng);
    var baseFn = function (x) { return sp.sample(Math.max(tee.x, Math.min(sp.greenX, x))); };
    var composed = OPS.compose(baseFn, ops);
    var xs = [], ys = [];
    for (var x = sx; x <= sp.greenX + FACET; x += FACET) { xs.push(x); ys.push(composed(Math.min(sp.greenX, x))); }
    if (xs[xs.length - 1] < sp.greenX) { xs.push(sp.greenX); ys.push(composed(sp.greenX)); }
    var protect = [{ x: tee.x, r: 26 }, { x: sp.greenX, r: 44 }];
    var skinned = SKIN.applySkin({ xs: xs, ys: ys }, {
      fbmAmp: 3 + d * 3, fbmFreq: 0.02, seed: (rng() * 1e6) | 0,
      terrace: { on: d > 0.28, step: 14 + d * 22 },
      thermal: { maxGrade: 1.12, iters: 32 },
      protect: protect, bounds: b,
    });
    var verts = [];
    for (var k = 0; k < skinned.xs.length; k++) verts.push({ x: skinned.xs[k], y: clampY(skinned.ys[k]) });
    // mark the cup at the green; flatten a small green pad around it for a clean cup
    var cupX = sp.greenX, cupY = clampY(skinned.ys[skinned.ys.length - 1]);
    // find nearest vert to cupX, mark cup + level its neighbours into a pad
    var ci = verts.length - 1; for (var m = 0; m < verts.length; m++) if (Math.abs(verts[m].x - cupX) < FACET) ci = m;
    verts[ci] = { x: cupX, y: cupY, cup: true };
    if (verts[ci - 1]) verts[ci - 1].y = cupY; if (verts[ci + 1]) verts[ci + 1].y = cupY;
    return { verts: verts, feature: sp.feature, cupX: cupX, cupY: cupY };
  }

  // polygon area (shoelace) — for rejecting degenerate (zero/near-zero) slabs the swept collision chokes on.
  function _polyArea(p) { var a = 0; for (var i = 0; i < p.length; i++) { var b = p[(i + 1) % p.length]; a += p[i].x * b.y - b.x * p[i].y; } return Math.abs(a) * 0.5; }
  // sanitize a slab: drop NaN/coincident points, require ≥3 pts + real area; clamp to the FULL SCREEN band
  // (slabs may sit anywhere, NOT the heightfield band — clamping to [108,486] collapses tall walls → zero-area
  // → NaN normals in collideSetPieces → C-stack crash). Returns null if unusable.
  function _cleanSlab(poly) {
    var out = [], H2 = (typeof H !== 'undefined') ? H : 540;
    for (var i = 0; i < poly.length; i++) {
      var x = poly[i].x, y = Math.max(2, Math.min(H2 - 2, poly[i].y));
      if (!isFinite(x) || !isFinite(y)) return null;
      if (out.length && Math.abs(out[out.length - 1].x - x) < 0.5 && Math.abs(out[out.length - 1].y - y) < 0.5) continue;  // skip coincident
      out.push({ x: x, y: y });
    }
    if (out.length < 3 || _polyArea(out) < 60) return null;   // too small/degenerate → skip (visual only loss)
    return out;
  }
  // convert pure floor polyline (+cup flag) into engine verts and emit overhang specs (sanitized).
  function emitAndVerts(res) {
    var verts = res.floor.map(function (p) { var q = { x: p.x, y: clampY(p.y) }; if (p.cup) q.cup = true; if (p.mat) q.mat = p.mat; return q; });
    if (res.overhangs && typeof _emitOverhang === 'function') for (var i = 0; i < res.overhangs.length; i++) {
      var poly = _cleanSlab(res.overhangs[i]);
      if (poly) _emitOverhang(poly);
    }
    return verts;
  }

  // ── CONCEPT pool weighted by difficulty (calm concepts fade, dramatic ones grow) ──
  var CONCEPT_POOL = SPINE.CONCEPT_NAMES;
  function pickConcept(diff, rng) {
    var d = nd(diff);
    // weight: descent/gather are calm; ridge/valley/carry are dramatic
    var w = { descent: 1.0, gather_bowl: 1.0, plateau_hop: 0.9, carry_then_climb: 0.6 + d, tucked_pin: 0.5 + d * 0.8, ridge_run: 0.3 + d * 1.2, valley_cross: 0.4 + d };
    var tot = 0, names = CONCEPT_POOL; for (var i = 0; i < names.length; i++) tot += (w[names[i]] || 0.5);
    var r = rng() * tot;
    for (var j = 0; j < names.length; j++) { r -= (w[names[j]] || 0.5); if (r <= 0) return names[j]; }
    return names[0];
  }

  // ════ REGISTER the engine archetypes ════
  function reg(name, w) { archetypes[name] && 0; ARCHETYPE_TABLE.push([name, 0.0, 5.0, w || 1]); if (typeof window !== 'undefined' && window.ARCHETYPE_NAMES && window.ARCHETYPE_NAMES.indexOf(name) < 0) window.ARCHETYPE_NAMES.push(name); }

  // the generator-native COMPOSED archetype: picks a concept + composes. THE workhorse of the new system.
  archetypes.composed = function (sx, sy, dist, cupY, diff) {
    var rng = random;   // engine seeded PRNG
    var concept = pickConcept(diff, rng);
    var res = composedVerts(concept, sx, sy, dist, diff, rng);
    return res.verts;
  };
  reg('composed', 3);

  // CAVE-layer dream archetypes (each forces a cave concept). Names: dream_<cave>.
  CAVES && CAVES.NAMES.forEach(function (cn) {
    var an = 'dream_' + cn;
    archetypes[an] = function (sx, sy, dist, cupY, diff) {
      var res = CAVES.genCave(cn, { sx: sx, sy: sy, dist: dist, diff: nd(diff), rng: random, bounds: bounds(), ballR: BR });
      return emitAndVerts(res);
    };
    reg(an, 1);
  });

  // FLOATING / landmark dream archetypes (each forces a body). Names: dream_float_<body>.
  FLOAT && FLOAT.NAMES.forEach(function (bn) {
    var an = 'dream_float_' + bn;
    archetypes[an] = function (sx, sy, dist, cupY, diff) {
      var res = FLOAT.genFloater(bn, { sx: sx, sy: sy, dist: dist, diff: nd(diff), rng: random, bounds: bounds(), ballR: BR });
      return emitAndVerts(res);
    };
    reg(an, 1);
  });

  // ── QUALITY-DIVERSITY selection: generate-K-keep-best for gen:'composed' courses ──────────────────────
  // Wrap generateHoleTerrain so a composed-course hole is generated K times; the REAL bot gates playability
  // and score.js ranks interest; keep the best candidate. INERT for every other course (calls through).
  // We snapshot/restore the global terrain arrays between candidates so only the winner survives.
  if (typeof generateHoleTerrain === 'function' && !window.__HG_QD_WRAPPED) {
    window.__HG_QD_WRAPPED = true;
    var _origGen = generateHoleTerrain;
    var K = 6;                            // candidates per hole (generate-K-keep-best). MAP-Elites-lite below.
    var _qdDepth = 0;
    // capture the terrain state so we can rebuild each candidate and roll back to the winner.
    // is this hole a FORCED signature (cave/floater at a fixed index)? Those are DESIGNED, not selected, and
    // are the QD bottleneck (the bot grinds float pads) — so we skip the K-loop for them (one build + the
    // engine's own _validateHole gate). QD applies only to the generator-native 'composed' holes.
    function _isForcedSpecial(i) {
      if (!currentCourse) return false;
      if (currentCourse.specialHole && i === currentCourse.specialHoleAt) return true;
      var sh = currentCourse.specialHoles; if (sh) for (var k = 0; k < sh.length; k++) if (sh[k].at === i) return true;
      return false;
    }
    generateHoleTerrain = function (holeIndex) {
      if (!(currentCourse && currentCourse.gen === 'composed') || _inValidation || _qdDepth > 0 || !window.RG || !window.HG_SCORE || !window.RG.bot || _isForcedSpecial(holeIndex)) {
        return _origGen(holeIndex);       // INERT for non-composed / sim / nested / a forced signature hole
      }
      _qdDepth++;
      var beforeV = vertices.slice(), beforeHL = holes.length;
      var bestVal = -1, bestState = null;
      // Generate K candidates, score each by CHEAP STRUCTURAL interest (no bot — the engine's _validateHole
      // re-roll, which runs after QD picks, is the sinkability gate; a full bot playout per candidate made QD
      // pathologically slow). MAP-Elites-lite variety nudge: a candidate in the SAME (rugged×overhang) bin as
      // the previous hole loses a little, so a planet's holes are different KINDS of interesting.
      var prevBin = window.__HG_PREVBIN || null;
      for (var k = 0; k < K; k++) {
        vertices = beforeV.slice(); holes.length = beforeHL;
        try { _origGen(holeIndex); } catch (e) { continue; }
        if (!holes[holeIndex]) continue;
        var sres;
        try { sres = window.HG_SCORE.score(holeIndex, { cheap: true }); }
        catch (e) { sres = { interest: 0.4, rugged: 0, overh: 0 }; }
        var val = sres.interest + 0.001;
        var bin = (sres.rugged || 0) + ':' + ((sres.overh || 0) > 0 ? 1 : 0);
        if (prevBin && bin === prevBin) val -= 0.08;     // variety nudge
        if (val > bestVal) { bestVal = val; bestState = { v: vertices.slice(), hl: holes.length, h: holes[holeIndex], ovh: holes[holeIndex]._overhangs, s: sres, bin: bin }; }
        if (k >= 2 && sres.interest > 0.78) break;        // early-out on a clearly great hole
      }
      if (bestState) {
        vertices = bestState.v.slice(); holes.length = bestState.hl; holes[holeIndex] = bestState.h; holes[holeIndex]._overhangs = bestState.ovh;
        holes[holeIndex]._hgScore = bestState.s; window.__HG_PREVBIN = bestState.bin;
      } else { vertices = beforeV.slice(); holes.length = beforeHL; _qdDepth--; return _origGen(holeIndex); }
      _qdDepth--;
      return;
    };
  }

  if (typeof window !== 'undefined') window.HG_DREAM = { composedVerts: composedVerts, pickConcept: pickConcept, CONCEPT_POOL: CONCEPT_POOL, caveNames: CAVES ? CAVES.NAMES : [], floatNames: FLOAT ? FLOAT.NAMES : [] };
})();
