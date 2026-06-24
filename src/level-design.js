// ── Seeded PRNG ──────────────────────────────────────────────
// Mulberry32: fast, high-quality 32-bit PRNG for reproducible terrain.
//
// IMPORTANT: random() is the seeded PRNG used for terrain generation.
// It MUST only be called from terrain generation code (this file).
// Never call random() from gameplay, rendering, or UI code — it will
// shift the PRNG sequence and break terrain determinism for all
// subsequent holes. Use Math.random() for non-terrain randomness.
function _mulberry32(seed) {
  return function() {
    seed |= 0;
    seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

let _prngFn = null;       // null = use Math.random (default/unseeded)
let _currentSeed = null;

function random() {
  return _prngFn ? _prngFn() : Math.random();
}

function setSeed(seed) {
  if (seed === null || seed === undefined) {
    _prngFn = null;
    _currentSeed = null;
  } else {
    _currentSeed = seed | 0;
    _prngFn = _mulberry32(_currentSeed);
  }
}

function getSeed() {
  return _currentSeed;
}

// Override shared.js utilities to route through seeded PRNG
randRange = function(lo, hi) { return lo + random() * (hi - lo); };
jitter = function(y, amount) { return clampY(y + (random() - 0.5) * amount); };

// ── Sandbox Override Hooks ──────────────────────────────────
// Set these from sandbox.html to control generation; null = default behavior
let _archetypeOverride = null;
let _difficultyOverride = null;

// ── Hand-Defined Holes (1-10) ──────────────────────────────
// Override procedural generation for the first 10 holes to ensure
// a polished, curated intro sequence. Each entry defines:
//   teeY:    tee elevation (game units, 0=top, 540=bottom)
//   dist:    horizontal distance from tee to cup
//   cupY:    cup elevation
//   verts:   terrain vertices as [{dx, y}] where dx = offset from tee
//            (only the mid-hole shape — tee/cup ends are added automatically)
//
// After hole 10, procedural generation takes over.
const HAND_DEFINED_HOLES = [];

// ── Reference Holes ──────────────────────────────────────────
// REFERENCE_HOLES_500 is defined here (original 10 holes from DG 502-699).
// Additional tiers (2300, 4000, 5900, 6400) are in src/reference-holes.js.
// All auto-extracted from Desert Golfing gameplay screenshots.
var REFERENCE_HOLES_500 = [
  { teeY: 540, dist: 675, cupY: 472,
    verts: [
      { dx: 0, y: 540 }, { dx: 66, y: 540 }, { dx: 93, y: 500 }, { dx: 240, y: 431 },
      { dx: 459, y: 431 }, { dx: 486, y: 479 }, { dx: 531, y: 479 }, { dx: 549, y: 493 },
      { dx: 576, y: 459 }, { dx: 603, y: 448 }, { dx: 630, y: 479 }, { dx: 657, y: 479 },
      { dx: 675, y: 472 }, { dx: 756, y: 412 }, { dx: 786, y: 407 }
    ]
  },
  { teeY: 383, dist: 735, cupY: 311,
    verts: [
      { dx: 0, y: 383 }, { dx: 72, y: 383 }, { dx: 135, y: 359 }, { dx: 213, y: 359 },
      { dx: 324, y: 407 }, { dx: 450, y: 407 }, { dx: 480, y: 374 }, { dx: 606, y: 312 },
      { dx: 663, y: 311 }, { dx: 687, y: 325 }, { dx: 708, y: 296 }, { dx: 735, y: 311 },
      { dx: 786, y: 311 }
    ]
  },
  { teeY: 311, dist: 459, cupY: 407,
    verts: [
      { dx: 0, y: 311 }, { dx: 171, y: 311 }, { dx: 180, y: 280 }, { dx: 192, y: 280 },
      { dx: 219, y: 383 }, { dx: 252, y: 384 }, { dx: 309, y: 407 }, { dx: 348, y: 406 },
      { dx: 432, y: 366 }, { dx: 459, y: 407 }, { dx: 786, y: 407 }
    ]
  },
  { teeY: 335, dist: 729, cupY: 226,
    verts: [
      { dx: 0, y: 335 }, { dx: 228, y: 335 }, { dx: 267, y: 327 }, { dx: 315, y: 314 },
      { dx: 366, y: 231 }, { dx: 381, y: 217 }, { dx: 477, y: 215 }, { dx: 492, y: 221 },
      { dx: 522, y: 202 }, { dx: 555, y: 243 }, { dx: 582, y: 215 }, { dx: 693, y: 215 },
      { dx: 702, y: 163 }, { dx: 720, y: 175 }, { dx: 729, y: 226 }, { dx: 753, y: 197 },
      { dx: 786, y: 228 }
    ]
  },
  { teeY: 335, dist: 738, cupY: 494,
    verts: [
      { dx: 0, y: 335 }, { dx: 78, y: 336 }, { dx: 210, y: 400 }, { dx: 228, y: 415 },
      { dx: 267, y: 470 }, { dx: 282, y: 479 }, { dx: 408, y: 479 }, { dx: 432, y: 472 },
      { dx: 459, y: 407 }, { dx: 480, y: 407 }, { dx: 489, y: 357 }, { dx: 507, y: 357 },
      { dx: 516, y: 407 }, { dx: 600, y: 407 }, { dx: 615, y: 412 }, { dx: 738, y: 494 },
      { dx: 765, y: 540 }, { dx: 783, y: 540 }
    ]
  },
  { teeY: 239, dist: 627, cupY: 188,
    verts: [
      { dx: 0, y: 239 }, { dx: 123, y: 239 }, { dx: 150, y: 287 }, { dx: 222, y: 287 },
      { dx: 237, y: 281 }, { dx: 291, y: 234 }, { dx: 417, y: 171 }, { dx: 423, y: 169 },
      { dx: 444, y: 184 }, { dx: 471, y: 149 }, { dx: 495, y: 185 }, { dx: 567, y: 234 },
      { dx: 627, y: 188 }, { dx: 708, y: 168 }, { dx: 786, y: 167 }
    ]
  },
  { teeY: 330, dist: 555, cupY: 232,
    verts: [
      { dx: 0, y: 330 }, { dx: 45, y: 312 }, { dx: 99, y: 307 }, { dx: 186, y: 266 },
      { dx: 285, y: 287 }, { dx: 417, y: 287 }, { dx: 432, y: 277 }, { dx: 474, y: 220 },
      { dx: 480, y: 217 }, { dx: 501, y: 229 }, { dx: 525, y: 200 }, { dx: 555, y: 232 },
      { dx: 663, y: 285 }, { dx: 792, y: 287 }
    ]
  },
  { teeY: 407, dist: 693, cupY: 363,
    verts: [
      { dx: 0, y: 407 }, { dx: 129, y: 406 }, { dx: 186, y: 382 }, { dx: 309, y: 362 },
      { dx: 336, y: 330 }, { dx: 366, y: 374 }, { dx: 381, y: 383 }, { dx: 564, y: 383 },
      { dx: 585, y: 398 }, { dx: 612, y: 364 }, { dx: 639, y: 377 }, { dx: 693, y: 363 },
      { dx: 720, y: 407 }, { dx: 792, y: 407 }
    ]
  },
  { teeY: 245, dist: 684, cupY: 303,
    verts: [
      { dx: 0, y: 245 }, { dx: 39, y: 263 }, { dx: 405, y: 263 }, { dx: 513, y: 332 },
      { dx: 546, y: 318 }, { dx: 567, y: 293 }, { dx: 588, y: 301 }, { dx: 615, y: 268 },
      { dx: 639, y: 287 }, { dx: 657, y: 287 }, { dx: 672, y: 314 }, { dx: 684, y: 303 },
      { dx: 699, y: 263 }, { dx: 792, y: 263 }
    ]
  },
  { teeY: 183, dist: 747, cupY: 375,
    verts: [
      { dx: 0, y: 183 }, { dx: 30, y: 191 }, { dx: 171, y: 191 }, { dx: 198, y: 287 },
      { dx: 315, y: 287 }, { dx: 342, y: 430 }, { dx: 354, y: 446 }, { dx: 369, y: 452 },
      { dx: 495, y: 410 }, { dx: 558, y: 357 }, { dx: 681, y: 316 }, { dx: 708, y: 359 },
      { dx: 720, y: 359 }, { dx: 741, y: 375 }, { dx: 747, y: 375 }, { dx: 768, y: 346 },
      { dx: 792, y: 359 }
    ]
  },
];

// ── Difficulty Curve ─────────────────────────────────────────
// Logarithmic ramp matching real Desert Golfing's gradual progression.
// Analysis of 990 real holes shows difficulty ramps over ~2000 holes:
//   - Height range grows from 0.24 → 0.40
//   - Flatness decreases from 0.57 → 0.40
//   - Steepness increases from 0.03 → 0.07
function getDifficulty(holeIndex) {
  if (_difficultyOverride !== null) return _difficultyOverride;
  // Base ramp: 0 at hole 0, ~1.0 at hole 20, up to 5.0
  const raw = holeIndex <= 0 ? 0 : Math.min(5.0, 5.0 * Math.log(1 + holeIndex) / Math.log(1 + 20));
  // Clamp to course difficulty range if set
  const [minD, maxD] = currentCourse?.difficultyRange || [0, 5];
  return minD + raw * (maxD - minD) / 5.0;
}

// ── Terrain Micro-Noise ──────────────────────────────────────
// Real Desert Golfing has subtle roughness (~0.006 normalized per sample).
// Insert intermediate vertices on long segments with small perturbations
// for organic, natural-looking terrain instead of perfectly straight lines.
function addMicroNoise(verts, startX, startY, difficulty) {
  const noiseAmp = 2 + difficulty * 4; // 2-6px of noise
  const result = [];
  let prevV = { x: startX, y: startY };

  for (const v of verts) {
    const gap = v.x - prevV.x;
    if (gap > 80) {
      const numPts = gap > 200 ? 3 : gap > 120 ? 2 : 1;
      for (let j = 1; j <= numPts; j++) {
        const t = j / (numPts + 1);
        const x = lerp(prevV.x, v.x, t);
        const baseY = lerp(prevV.y, v.y, t);
        result.push({ x, y: clampY(baseY + (random() - 0.5) * noiseAmp) });
      }
    }
    result.push({ x: v.x, y: clampY(v.y) });
    prevV = v;
  }
  return result;
}

// ── Archetype Library ─────────────────────────────────────
// Each archetype returns an array of {x, y} vertices for one hole's terrain.
// Parameters: startX, startY, dist (tee-to-cup distance), cupTargetY, difficulty (0-1)
// The LAST vertex should be near the cup zone. Background vertices are added separately.
// Based on analysis of real Desert Golfing gameplay footage (holes 1-6400).
// Real DG uses sharp, angular, construction-paper geometry — not smooth curves.

// ── P4: archetype-authored OVERHANGS / CAVES ─────────────────────────────────────────────────────────
// The heightfield is a single ground-line per column, so it can't draw a roof/lip over a pocket. The
// set-pieces system (src/set-pieces.js) already gives us SOLID convex slabs floating over the heightfield
// with swept circle-vs-polygon collision. A CAVE/OVERHANG archetype shapes the heightfield FLOOR (a pocket,
// a mouth, a notch) AND emits one or more convex slabs to act as the ROOF / LIP / cantilever above it.
// During generation an archetype pushes slab specs to _archOverhangSpecs (absolute world coords); the main
// generator converts them to hole._overhangs (so collision + draw just work). Reachable BY CONSTRUCTION:
// the cup sits on the heightfield floor under the lip, with a ball-clearance mouth, so a putt/lob can reach
// it; the bot validator (which drives the REAL collide() incl. set-pieces) re-rolls anything it can't sink.
let _archOverhangSpecs = [];
// push a convex slab (array of {x,y} in absolute world coords). MUST be convex (the swept collision assumes it).
function _emitOverhang(pts) { if (pts && pts.length >= 3) _archOverhangSpecs.push(pts); }

// P5: monotonic-x SANITIZER for the big batch of new archetypes. The engine deletes any vertex whose x goes
// backwards (X-monotonicity is required), which would silently corrupt a shape that overshoots. Wrapping a
// new archetype in _monoArch forces x to be non-decreasing FIRST (collapsing the rare overshoot into a
// near-vertical wall) so the intended silhouette survives intact. Preserves cup/mat flags. Existing
// hand-tuned archetypes are NOT wrapped (they're already clean); only the P5 pool below.
function _monoArch(fn) {
  return function (sx, sy, dist, cupY, diff) {
    const v = fn(sx, sy, dist, cupY, diff);
    if (!Array.isArray(v)) return v;
    let mx = -Infinity; const out = [];
    for (const p of v) {
      let x = p.x; if (!(x >= mx)) x = mx; mx = x + 0.01;
      const q = { x, y: clampY(p.y) }; if (p.cup) q.cup = true; if (p.mat) q.mat = p.mat;
      out.push(q);
    }
    return out;
  };
}

const archetypes = {
  // ── EASY ──────────────────────────────────────────────
  flat_run(sx, sy, dist, cupY, diff) {
    // Nearly flat with maybe one gentle kink
    const kinkX = sx + dist * randRange(0.3, 0.7);
    const kinkY = clampY(lerp(sy, cupY, 0.5) + (random() - 0.5) * 20);
    return [
      { x: kinkX, y: kinkY },
      { x: sx + dist, y: cupY }
    ];
  },

  // ── GoM generator: ONE archetype that emits varied angular multi-level terrain (flats / slopes /
  // cliffs / valleys) tee→cup, drama scaling with difficulty. The "new generator" — runs inside the real
  // engine (real physics, one-hole camera, fill+pan), no archetype LIST needed. Last vert = the cup, on a
  // short flat green so the ball settles + the cup fill reads. Matches the user's GoM targets (gom-targets/).
  gom(sx, sy, dist, cupY, diff) {
    const verts = [];
    const drama = 50 + diff * 178;                 // vertical scale grows with difficulty (capped so deep valleys stay escapable)
    const endX = sx + dist;
    let x = sx, y = sy, features = 0;
    // low diff → mostly flat + gentle (steam_01 opener); high diff → cliffs + deep valleys (gap-crossing).
    const flatP = 0.58 - diff * 0.38, slopeP = flatP + 0.26, cliffP = slopeP + 0.10 + diff * 0.10;
    while (x < endX - 190) {
      const step = randRange(70, 140), r = random();
      if (r < flatP) { x += step; verts.push({ x, y: clampY(y) }); }                                   // flat / plateau
      else if (r < slopeP) { x += step; y = clampY(y + (random() - 0.5) * drama * 1.1); verts.push({ x, y }); features++; } // slope
      else if (r < cliffP) {                                                                            // cliff (sharp step)
        const ny = clampY(y + (random() < 0.5 ? -1 : 1) * randRange(drama * 0.6, drama * 1.2));
        x += randRange(6, 18); verts.push({ x, y: ny }); y = ny; x += step * 0.45; verts.push({ x, y }); features++;
      } else {                                                                                          // valley (dip to cross) — a basin; water.js may pool flat water in it
        const vy = clampY(y + randRange(drama * 0.7, drama * 1.1));
        x += step * 0.35; verts.push({ x, y }); x += randRange(30, 64); verts.push({ x, y: vy });
        x += randRange(30, 64); verts.push({ x, y: vy }); x += step * 0.35; verts.push({ x, y }); features++;
      }
    }
    // guarantee drama on harder holes: if the random walk came out tame, carve one big feature
    if (features < Math.round(diff * 3.5) && endX - sx > 360) {   // only force drama on harder holes (easy holes may be calm)
      const fx = sx + (endX - sx) * randRange(0.3, 0.6), big = drama * randRange(1.1, 1.6) * (random() < 0.5 ? -1 : 1);
      verts.push({ x: fx - 30, y: clampY(y) }); verts.push({ x: fx, y: clampY(y + big) }); verts.push({ x: fx + randRange(40, 90), y: clampY(y + big) }); verts.push({ x: fx + randRange(110, 170), y: clampY(y) });
      verts.sort((a, b) => a.x - b.x);
    }
    verts.push({ x: Math.min(x + 45, endX - 45), y: clampY(y) });   // flat green
    verts.push({ x: endX, y: clampY(y) });                          // cup
    return verts;
  },

  // GoM SMOOTH style (refs: holes 148, 575, itch_01) — soft rounded rolling terrain, densely sampled so the
  // engine's straight segments read as smooth curves. Amplitude grows with difficulty. Paired with 'gom'
  // (angular) in the gom courses so holes alternate smooth/angular like real GoM.
  gom_smooth(sx, sy, dist, cupY, diff) {
    const verts = [];
    const endX = sx + dist;
    const amp = 28 + diff * 120;
    const w1 = randRange(0.004, 0.008), p1 = random() * 6.283, a1 = amp * randRange(0.55, 1.0);
    const w2 = randRange(0.011, 0.020), p2 = random() * 6.283, a2 = amp * randRange(0.18, 0.45);
    const drift = randRange(-0.10, 0.10);
    const off = a1 * Math.sin(p1) + a2 * Math.sin(p2);            // so the curve starts at ~sy (connects to tee)
    for (let x = sx; x < endX - 70; x += 15) {
      const t = x - sx;
      verts.push({ x, y: clampY(sy + drift * t + a1 * Math.sin(t * w1 + p1) + a2 * Math.sin(t * w2 + p2) - off) });
    }
    const gy = verts.length ? verts[verts.length - 1].y : sy;     // flat green into the cup
    verts.push({ x: endX - 60, y: clampY(gy) });
    verts.push({ x: endX, y: clampY(gy) });
    return verts;
  },

  // ARCHIPELAGO: flat island-tops near the baseline (stay above the sea line → dry) separated by deep,
  // steep-walled troughs (sink below the sea line → flood). Carries are short (≤~110px) so island-hopping
  // is fair. Pairs with a course `seaLevel` (water planets). Tee + cup are islands at the baseline.
  gom_islands(sx, sy, dist, cupY, diff) {
    const verts = [];
    const endX = sx + dist, base = sy;
    const relief = 50 + diff * 110;                              // how tall islands rise above the waterline
    const lowTop = () => clampY(base - random() * relief * 0.3); // a low shoulder (still dry, near the water)
    let x = sx;
    verts.push({ x, y: clampY(base) });                         // tee island (low, at the baseline)
    x += randRange(55, 95); verts.push({ x, y: clampY(base) });
    while (x < endX - 260) {
      // TROUGH (floods) — varied width/depth
      const depth = randRange(70, 130) + diff * 35;
      x += randRange(8, 16); verts.push({ x, y: clampY(base + depth) });
      x += randRange(40, 95); verts.push({ x, y: clampY(base + depth) });
      x += randRange(8, 16);
      // ISLAND — varied SHAPE + height (always at/above base → stays dry above the sea line)
      const top = clampY(base - random() * relief);
      const s = random();
      if (s < 0.56) {                                            // flat shelf / plateau (most common → landable)
        verts.push({ x, y: top }); x += randRange(80, 175); verts.push({ x, y: top });
      } else if (s < 0.82) {                                     // peak island (up then down)
        verts.push({ x, y: lowTop() });
        x += randRange(38, 78); verts.push({ x, y: top });
        x += randRange(38, 78); verts.push({ x, y: lowTop() });
      } else {                                                   // tilted shelf
        verts.push({ x, y: lowTop() });
        x += randRange(85, 165); verts.push({ x, y: top });
      }
    }
    const ey = clampY(base);                                    // cup island (low, flat green)
    verts.push({ x: Math.min(x + randRange(40, 80), endX - 60), y: ey });
    verts.push({ x: endX, y: ey });
    return verts;
  },

  // ONE big lake to carry: a land run-up, a wide basin that floods, a far shore, then the cup green. Pairs
  // with a course `seaLevel` so the basin holds a broad lake the ball must clear in a shot or two.
  gom_lake(sx, sy, dist, cupY, diff) {
    const verts = [];
    const endX = sx + dist, base = sy;
    let x = sx;
    verts.push({ x, y: clampY(base) });
    x += randRange(120, 180); verts.push({ x, y: clampY(base) });          // tee shore run-up
    const depth = randRange(70, 115);
    x += 16; verts.push({ x, y: clampY(base + depth) });                   // drop to the lake bed
    x += randRange(120, 175); verts.push({ x, y: clampY(base + depth) });  // wide lake bed (floods)
    const fy = clampY(base + (random() - 0.5) * 24);
    x += 16; verts.push({ x, y: fy });                                     // far shore
    verts.push({ x: Math.min(x + randRange(90, 150), endX - 60), y: fy }); // far land
    verts.push({ x: endX, y: clampY(fy) });
    return verts;
  },

  // ── COMPLEX archetypes for the deep-water / overhang worlds ──────────────────────────────────────────
  // DROWNED SPIRE: a lone monolith rises from a flooded abyss; the cup crowns it. Tee headland → plunge to a
  // deep abyss floor (floods deep) → a near-vertical spire at the end with a small flat crown (the cup).
  // Carry the abyss, land the crown, or splash. Pairs with deep water + an overhang floating over the void.
  spire_drown(sx, sy, dist, cupY, diff) {
    const endX = sx + dist;
    const floorY = clampY(H * 0.9);                          // abyss floor (deep → big water column)
    const topY = clampY(Math.min(sy, H * 0.30) - diff * 30); // crown (cup), high
    const cx = endX - 96, crownHalf = 72;                    // WIDE crown (~144px) shaped as a shallow BOWL so a
    const lipY = topY, cupYY = clampY(topY + 22);            // landed ball GATHERS to the cup instead of rolling off (works even at 0.42 gravity)
    return [
      { x: sx, y: clampY(sy) },
      { x: sx + dist * 0.17, y: clampY(sy) },                // tee headland
      { x: sx + dist * 0.17 + 24, y: floorY },               // plunge into the abyss
      { x: cx - crownHalf - 24, y: floorY },                 // abyss floor (long span → lots of water)
      { x: cx - crownHalf, y: lipY },                        // spire rises to the raised crown lip
      { x: cx - crownHalf * 0.42, y: cupYY },                // inner wall down into the dished crown
      { x: cx, y: cupYY, cup: true },                        // CUP in the dished centre — the bowl gathers the ball
      { x: cx + crownHalf * 0.42, y: cupYY },
      { x: cx + crownHalf, y: lipY },                        // far crown lip (raised back-stop)
      { x: endX, y: clampY(lipY + 30) },                     // step down off the crown
    ];
  },

  // THE CENOTE: a flooded sinkhole punched into a high plateau — carry the deep pit to the far rim. Steep
  // wide walls, deep water in the shaft; the cup waits on the far plateau. An overhang over the shaft = the
  // canyon_cup-with-overhang feel, but the carry (not a chip-in) is the test.
  cenote(sx, sy, dist, cupY, diff) {
    const endX = sx + dist;
    const plY = clampY(Math.min(sy, H * 0.4));
    const pitY = clampY(H * 0.92);                           // deep shaft floor (floods)
    const pitL = sx + dist * randRange(0.34, 0.44);
    const pitR = sx + dist * randRange(0.6, 0.72);
    return [
      { x: sx, y: clampY(sy) },
      { x: pitL - 34, y: plY },                              // approach plateau
      { x: pitL, y: plY },                                   // near rim
      { x: pitL + 22, y: pitY },                             // steep drop into the shaft
      { x: pitR - 22, y: pitY },                             // shaft floor (deep water)
      { x: pitR, y: plY },                                   // steep rise to the far rim
      { x: endX - 55, y: plY },                              // far plateau
      { x: endX, y: clampY(cupY != null ? Math.min(cupY, plY) : plY) },
    ];
  },

  // THE GAUNTLET: shattered stepping-stones across a drowned rift — hop the spires or sink. Deep rift floor
  // (floods) with 2–3 narrow spire-tops the ball must land; the cup on the far headland.
  gauntlet(sx, sy, dist, cupY, diff) {
    const endX = sx + dist;
    const floorY = clampY(H * 0.9);                          // rift floor (deep water)
    const topY = clampY(Math.min(sy, H * 0.44));            // spire-top play level
    const v = [{ x: sx, y: clampY(sy) }];
    v.push({ x: sx + dist * 0.12, y: clampY(sy) });          // tee headland
    let x = sx + dist * 0.12 + 18; v.push({ x, y: floorY }); // drop into the rift
    const n = 2 + Math.floor(randRange(0, 2.2));             // 2–3 spires
    for (let i = 0; i < n; i++) {
      x += randRange(44, 72); v.push({ x, y: floorY });      // water gap
      x += 16; v.push({ x, y: topY });                       // spire up
      x += randRange(50, 78); v.push({ x, y: topY });        // spire top (landable)
      x += 16; v.push({ x, y: floorY });                     // spire down
      if (x > endX - 200) break;
    }
    x += randRange(44, 66); v.push({ x, y: floorY });        // final gap
    v.push({ x: Math.min(x + 22, endX - 70), y: topY });     // cup headland
    v.push({ x: endX, y: topY });
    return v;
  },

  // ISLAND GREEN: the cup sits on a small island in the MIDDLE of open water — land it or splash. Water on
  // BOTH sides of the pin (uses the cup-anywhere unlock). Tee shore → water → island (cup) → water → far shore.
  island_green(sx, sy, dist, cupY, diff) {
    const endX = sx + dist, base = sy;
    const floorY = clampY(H * 0.9);
    const isl = clampY(base);
    const cx = sx + dist * randRange(0.46, 0.6), half = randRange(50, 72);   // island half-width (landable)
    return [
      { x: sx, y: clampY(base) },
      { x: sx + dist * 0.2, y: clampY(base) },               // tee shore
      { x: sx + dist * 0.2 + 18, y: floorY },                // drop to water
      { x: cx - half - 14, y: floorY },
      { x: cx - half, y: isl },                              // island rises
      { x: cx, y: isl, cup: true },                          // CUP on the island
      { x: cx + half, y: isl },
      { x: cx + half + 14, y: floorY },                      // drop to water
      { x: endX - dist * 0.18, y: floorY },
      { x: endX - 60, y: clampY(base) },                     // far shore
      { x: endX, y: clampY(base) },
    ];
  },

  // SEA STACK: the cup CROWNS a freestanding monolith rising from deep water mid-hole (the true spire, now
  // possible). Tee shore → deep water → tall narrow stack (cup on top) → deep water → far shore.
  sea_stack(sx, sy, dist, cupY, diff) {
    const endX = sx + dist, base = sy;
    const floorY = clampY(H * 0.9);
    const crown = clampY(Math.min(base, H * 0.34) - diff * 22);
    const cx = sx + dist * randRange(0.46, 0.6), half = randRange(42, 58);   // narrow crown — precise landing
    return [
      { x: sx, y: clampY(base) },
      { x: sx + dist * 0.2, y: clampY(base) },               // tee shore
      { x: sx + dist * 0.2 + 18, y: floorY },                // deep water
      { x: cx - half - 16, y: floorY },
      { x: cx - half, y: crown },                            // stack rises near-vertical
      { x: cx, y: crown, cup: true },                        // CUP crowns the monolith
      { x: cx + half, y: crown },
      { x: cx + half + 16, y: floorY },                      // deep water
      { x: endX - dist * 0.18, y: floorY },
      { x: endX - 60, y: clampY(base) },                     // far shore
      { x: endX, y: clampY(base) },
    ];
  },

  // ── SPECIAL "something lived here" archetypes (rare set-pieces — a course's signature hole) ───────────
  // RUINS: a colonnade of broken pillars on a foundation; the cup rests among the toppled columns.
  ruins(sx, sy, dist, cupY, diff) {
    const endX = sx + dist, base = clampY(Math.max(sy, H * 0.6));
    const v = [{ x: sx, y: clampY(sy) }, { x: sx + dist * 0.16, y: base }];
    const n = 4 + Math.floor(randRange(0, 3));                  // 4–6 columns
    const span = dist * 0.6, gap = span / n, cupIdx = Math.floor(n / 2);
    let x = sx + dist * 0.2;
    for (let i = 0; i < n; i++) {
      if (i === cupIdx) {
        // an OPEN PLAZA among the ruins — a wide flat clearing with NO tall column to block the lob, so a
        // dropped ball lands and settles on the cup (the old layout wedged the cup beside a tall column → unsinkable in low gravity).
        v.push({ x, y: base });
        v.push({ x: x + gap * 0.5, y: base, cup: true });        // CUP in the open clearing
        v.push({ x: x + gap, y: base });
        x += gap; continue;
      }
      const ph = randRange(45, 80) + random() * (60 + diff * 50);   // broken column height (varied)
      const pw = randRange(15, 24);
      v.push({ x, y: base });                                   // foundation
      v.push({ x: x + gap * 0.5, y: base });
      v.push({ x: x + gap * 0.5 + 3, y: clampY(base - ph) });   // column up (jagged broken top)
      v.push({ x: x + gap * 0.5 + pw, y: clampY(base - ph) });
      v.push({ x: x + gap * 0.5 + pw + 3, y: base });           // column down
      x += gap;
    }
    v.push({ x: endX - 60, y: base }); v.push({ x: endX, y: base });
    return v;
  },

  // LAUNCHPAD: a raised launch platform (cup on the pad) over a flame trench, with a tall gantry tower beside.
  launchpad(sx, sy, dist, cupY, diff) {
    const endX = sx + dist, base = clampY(Math.max(sy, H * 0.64));
    const px = sx + dist * randRange(0.46, 0.58), padY = clampY(base - 12);
    const g = clampY(base - 150 - diff * 70);                   // gantry height
    return [
      { x: sx, y: clampY(sy) },
      { x: px - 120, y: base },
      { x: px - 92, y: base }, { x: px - 80, y: clampY(base + 48) },   // flame trench
      { x: px - 52, y: clampY(base + 48) }, { x: px - 40, y: padY },   // up onto the pad
      { x: px, y: padY, cup: true },                            // CUP on the launch pad
      { x: px + 52, y: padY }, { x: px + 64, y: base },
      { x: px + 86, y: base }, { x: px + 90, y: g },            // gantry tower up
      { x: px + 106, y: g }, { x: px + 110, y: base },          // gantry top + down
      { x: endX - 60, y: base }, { x: endX, y: base },
    ];
  },

  // OBELISK: a lone monolith standing on a plain — a landmark; the cup waits at its foot.
  obelisk(sx, sy, dist, cupY, diff) {
    const endX = sx + dist, base = clampY(Math.max(sy, H * 0.62));
    const ox = sx + dist * randRange(0.42, 0.56), top = clampY(base - 170 - diff * 80);
    return [
      { x: sx, y: clampY(sy) },
      { x: ox - 95, y: base },
      { x: ox - 70, y: base, cup: true },                       // cup at the monolith's NEAR foot (no need to clear it)
      { x: ox - 13, y: base }, { x: ox - 11, y: top },          // monolith up (tall, narrow) — a landmark past the cup
      { x: ox + 11, y: top }, { x: ox + 13, y: base },          // monolith top + down
      { x: ox + 70, y: base },
      { x: endX - 60, y: base }, { x: endX, y: base },
    ];
  },

  // ── new NON-water complex archetypes ────────────────────────────────────────────────────────────────
  // CRATER: a raised rim with the cup sunk in a bowl on top — lob UP then drop INTO the crater (cup-anywhere).
  crater(sx, sy, dist, cupY, diff) {
    const endX = sx + dist, base = clampY(sy);
    const rimY = clampY(Math.min(sy, H * 0.42) - 24 - diff * 46);
    const bowlY = clampY(rimY + randRange(52, 92));
    const cx = sx + dist * randRange(0.5, 0.62), rimHalf = randRange(70, 105);
    return [
      { x: sx, y: base },
      { x: cx - rimHalf - 46, y: clampY(lerp(base, rimY, 0.6)) },   // climb to the rim
      { x: cx - rimHalf, y: rimY },                                 // near rim
      { x: cx - rimHalf * 0.45, y: bowlY },                         // inner wall down
      { x: cx, y: bowlY, cup: true },                              // CUP in the crater
      { x: cx + rimHalf * 0.45, y: bowlY },
      { x: cx + rimHalf, y: rimY },                                 // far rim
      { x: endX - 60, y: clampY(lerp(rimY, base, 0.45)) },
      { x: endX, y: base },
    ];
  },

  // PUNCHBOWL: a big smooth funnel — anything landing in the bowl gathers to the cup at the bottom centre.
  // A forgiving, satisfying "gather" hole (contrast to the brutal carries).
  punchbowl(sx, sy, dist, cupY, diff) {
    const endX = sx + dist, base = clampY(sy);
    const cx = sx + dist * randRange(0.52, 0.64), bowlW = randRange(170, 260);
    const botY = clampY(Math.max(base, H * 0.62) + randRange(36, 80));
    const rimY = clampY(botY - randRange(80, 140));
    return [
      { x: sx, y: base },
      { x: cx - bowlW, y: rimY },                                   // left rim
      { x: cx - bowlW * 0.55, y: clampY(lerp(rimY, botY, 0.55)) },  // funnel down
      { x: cx - bowlW * 0.2, y: clampY(lerp(rimY, botY, 0.9)) },
      { x: cx, y: botY, cup: true },                               // CUP at the bottom (gathers)
      { x: cx + bowlW * 0.2, y: clampY(lerp(rimY, botY, 0.9)) },
      { x: cx + bowlW * 0.55, y: clampY(lerp(rimY, botY, 0.55)) },  // funnel up
      { x: cx + bowlW, y: rimY },                                   // right rim
      { x: endX, y: base },
    ];
  },

  // ZIGGURAT: a stepped pyramid climbing to a cup on the top terrace — a staircase of ledges to bank up.
  ziggurat(sx, sy, dist, cupY, diff) {
    const endX = sx + dist, base = clampY(sy);
    const steps = 3 + Math.floor(randRange(0, 2.4));             // 3–5 steps
    const topY = clampY(Math.min(sy, H * 0.34) - diff * 30);
    const dy = (base - topY) / steps, stepW = (dist * 0.72) / steps;
    const v = [{ x: sx, y: base }];
    let x = sx + dist * 0.14, y = base;
    for (let i = 0; i < steps; i++) {
      y = clampY(base - dy * (i + 1));
      x += 14; v.push({ x, y });                                  // riser
      x += stepW - 14; v.push({ x, y });                         // terrace
    }
    v.push({ x: Math.min(x + 12, endX - 50), y, cup: true });     // CUP on the top terrace
    v.push({ x: endX, y });
    return v;
  },

  gentle_slope(sx, sy, dist, cupY, diff) {
    // Simple slope with one break point — like early DG holes
    const breakX = sx + dist * randRange(0.3, 0.6);
    const breakY = clampY(lerp(sy, cupY, randRange(0.3, 0.7)) + (random() - 0.5) * 15);
    return [
      { x: breakX, y: breakY },
      { x: sx + dist, y: cupY }
    ];
  },

  gentle_hill(sx, sy, dist, cupY, diff) {
    // One broad hill or dip — angular peak, not smooth
    const peakX = sx + dist * randRange(0.3, 0.6);
    const isHill = random() < 0.5;
    const amp = randRange(40, 80 + diff * 50);
    const peakY = clampY(lerp(sy, cupY, 0.5) + (isHill ? -amp : amp));
    return [
      { x: peakX, y: peakY },
      { x: sx + dist, y: cupY }
    ];
  },

  // ── EASY-MED ──────────────────────────────────────────
  downhill(sx, sy, dist, cupY, diff) {
    // Slope down with angular break point
    const drop = 60 + diff * 120;
    const actualCupY = clampY(Math.max(cupY, sy + drop));
    const breakX = sx + dist * randRange(0.25, 0.5);
    const breakY = clampY(lerp(sy, actualCupY, randRange(0.2, 0.6)));
    return [
      { x: breakX, y: breakY },
      { x: sx + dist, y: actualCupY }
    ];
  },

  uphill(sx, sy, dist, cupY, diff) {
    // Slope up with angular break
    const rise = 60 + diff * 120;
    const actualCupY = clampY(Math.min(cupY, sy - rise));
    const breakX = sx + dist * randRange(0.3, 0.6);
    const breakY = clampY(lerp(sy, actualCupY, randRange(0.3, 0.7)));
    return [
      { x: breakX, y: breakY },
      { x: sx + dist, y: actualCupY }
    ];
  },

  rolling_hills(sx, sy, dist, cupY, diff) {
    // 2-4 angular peaks and valleys in the FIRST ~62%, then a wide flat green with the cup in the middle.
    const numHills = 2 + Math.floor(random() * (1 + diff * 2));
    const verts = [];
    const hillSpan = dist * 0.62;                      // hills only occupy the front; leave room for a real green
    const segW = hillSpan / (numHills + 1);
    for (let i = 1; i <= numHills; i++) {
      const hx = sx + segW * i + (random() - 0.5) * segW * 0.3;
      const amp = randRange(35, 70 + diff * 70);
      const up = (i % 2 === 1) ? -1 : 1;
      const hy = clampY(lerp(sy, cupY, i / (numHills + 1)) + up * amp);
      verts.push({ x: hx, y: hy });
    }
    // WIDE flat green with the cup in the MIDDLE (flat on both sides = a forgiving landing that settles the
    // ball even in low gravity, where a cup on a slope or at the very edge rolls off forever).
    const fy = clampY(cupY);
    verts.push({ x: sx + hillSpan + 30, y: fy });           // gentle arrival onto the green (always after the last hill)
    verts.push({ x: sx + dist - 70, y: fy, cup: true });    // CUP mid-green
    verts.push({ x: sx + dist, y: fy });                    // green continues past the cup (backstop)
    return verts;
  },

  // ── MEDIUM ────────────────────────────────────────────
  cliff_drop(sx, sy, dist, cupY, diff) {
    // Flat plateau then near-vertical cliff drop — sharp angular step-down
    // Like real DG holes 100-300 with dramatic drops
    const cliffX = sx + dist * randRange(0.3, 0.55);
    const dropH = randRange(80, 160 + diff * 100);
    const topY = clampY(sy);
    const botY = clampY(topY + dropH);
    return [
      { x: cliffX - 20, y: topY },           // flat run to edge
      { x: cliffX, y: topY },                 // cliff edge
      { x: cliffX + 8, y: botY },             // near-vertical drop (8px wide!)
      { x: sx + dist, y: botY }
    ];
  },

  valley(sx, sy, dist, cupY, diff) {
    // Angular V or U valley — steep walls, flat or pointed bottom
    const valleyX = sx + dist * randRange(0.3, 0.55);
    const depth = randRange(60, 140 + diff * 80);
    const baseLevel = Math.max(sy, cupY);
    const botY = clampY(baseLevel + depth);
    const flatBottom = random() < 0.4; // 40% chance of flat-bottom canyon
    const wallW = randRange(8, 20 + diff * 10);
    if (flatBottom) {
      const gapW = randRange(40, 80);
      return [
        { x: valleyX - gapW / 2 - wallW, y: clampY(baseLevel - 10) },
        { x: valleyX - gapW / 2, y: botY },    // left wall bottom
        { x: valleyX + gapW / 2, y: botY },    // right wall bottom (flat floor)
        { x: valleyX + gapW / 2 + wallW, y: clampY(baseLevel - 10) },
        { x: sx + dist, y: cupY }
      ];
    }
    return [
      { x: valleyX - wallW, y: clampY(baseLevel - 10) },
      { x: valleyX, y: botY },                  // V-bottom
      { x: valleyX + wallW, y: clampY(baseLevel - 10) },
      { x: sx + dist, y: cupY }
    ];
  },

  mesa(sx, sy, dist, cupY, diff) {
    // Elevated flat-top platform with steep walls on both sides
    // Like the rectangular blocks seen in holes 2000+
    const mesaL = sx + dist * randRange(0.15, 0.3);
    const mesaR = sx + dist * randRange(0.55, 0.75);
    const mesaH = randRange(60, 120 + diff * 100);
    const mesaTopY = clampY(Math.min(sy, cupY) - mesaH);
    const wallW = randRange(8, 15);
    return [
      { x: mesaL, y: sy },                      // base left
      { x: mesaL + wallW, y: mesaTopY },         // steep wall up
      { x: mesaR - wallW, y: mesaTopY },         // flat top
      { x: mesaR, y: clampY(mesaTopY + mesaH * 0.8) }, // steep wall down
      { x: sx + dist, y: cupY }
    ];
  },

  shelf(sx, sy, dist, cupY, diff) {
    // Flat shelf → steep step-down → flat shelf (staircase feel)
    // Very common in real DG — sharp rectangular steps
    const stepX = sx + dist * randRange(0.35, 0.55);
    const stepH = randRange(60, 120 + diff * 80);
    const goingDown = random() < 0.6;
    const topY = goingDown ? sy : clampY(sy - stepH);
    const botY = goingDown ? clampY(sy + stepH) : sy;
    const wallW = randRange(8, 15);
    return [
      { x: stepX - 30, y: topY },               // flat approach
      { x: stepX, y: topY },                    // step edge
      { x: stepX + wallW, y: botY },            // steep drop/rise
      { x: sx + dist, y: botY }
    ];
  },

  // ── MED-HARD ──────────────────────────────────────────
  canyon(sx, sy, dist, cupY, diff) {
    // Deep rectangular canyon — flat bottom between vertical walls
    // Signature feature of real DG mid-game (holes 500+)
    const canyonL = sx + dist * randRange(0.25, 0.4);
    const canyonR = sx + dist * randRange(0.55, 0.7);
    const depth = randRange(100, 200 + diff * 100);
    const topY = clampY(Math.min(sy, H * 0.4));
    const botY = clampY(topY + depth);
    const wallW = randRange(8, 15);
    return [
      { x: canyonL - 20, y: topY },             // approach
      { x: canyonL, y: topY },                  // left edge
      { x: canyonL + wallW, y: botY },           // left wall (near vertical)
      { x: canyonR - wallW, y: botY },           // flat canyon floor
      { x: canyonR, y: topY },                  // right wall up
      { x: sx + dist, y: cupY }
    ];
  },

  peak_obstacle(sx, sy, dist, cupY, diff) {
    // Sharp triangular peak — must lob over. Narrow base, steep sides.
    const peakX = sx + dist * randRange(0.3, 0.55);
    const baseLevel = Math.max(sy, cupY);
    const peakH = randRange(80, 140 + diff * 120);
    const peakY = clampY(baseLevel - peakH);
    const baseW = randRange(20, 50 + diff * 30); // narrow base!
    return [
      { x: peakX - baseW, y: clampY(baseLevel) },
      { x: peakX, y: peakY },                   // sharp peak
      { x: peakX + baseW, y: clampY(baseLevel) },
      { x: sx + dist, y: cupY }
    ];
  },

  wall_shot(sx, sy, dist, cupY, diff) {
    // Cup tucked at base of tall wall (backstop)
    // Common pattern in real DG — wall catches overshoots
    const wallX = sx + dist * randRange(0.65, 0.8);
    const wallH = randRange(80, 140 + diff * 60);   // reduced max height
    const floorY = clampY(Math.max(sy + 30, H * 0.7));
    const wallTopY = clampY(floorY - wallH);
    // Wall width proportional to height — climbable slope, not vertical
    const wallWidth = Math.max(30, wallH * 0.35);
    return [
      { x: sx + dist * 0.3, y: clampY(lerp(sy, floorY, 0.5)) },
      { x: wallX - 30, y: floorY },             // flat approach to wall
      { x: wallX, y: floorY },                  // cup area (at wall base)
      { x: wallX + wallWidth, y: wallTopY },     // angled wall (not vertical)
      { x: sx + dist + 80, y: wallTopY }
    ];
  },

  twin_peaks(sx, sy, dist, cupY, diff) {
    // Two sharp peaks with narrow gap between — ball must thread through
    const baseLevel = clampY(Math.max(sy, cupY) + 20);
    const gap = randRange(40, 70);
    const centerX = sx + dist * randRange(0.35, 0.55);
    const peakH1 = randRange(80, 140 + diff * 80);
    const peakH2 = randRange(80, 140 + diff * 80);
    const peak1Y = clampY(baseLevel - peakH1);
    const peak2Y = clampY(baseLevel - peakH2);
    const baseW = randRange(15, 30);
    return [
      { x: centerX - gap / 2 - baseW, y: baseLevel },
      { x: centerX - gap / 2, y: peak1Y },      // peak 1
      { x: centerX - gap / 2 + baseW * 0.5, y: baseLevel },
      { x: centerX + gap / 2 - baseW * 0.5, y: baseLevel },
      { x: centerX + gap / 2, y: peak2Y },      // peak 2
      { x: centerX + gap / 2 + baseW, y: baseLevel },
      { x: sx + dist, y: cupY }
    ];
  },

  stepped_descent(sx, sy, dist, cupY, diff) {
    // Multiple sharp step-downs — rectangular staircase like real DG holes 200+
    const numSteps = 2 + Math.floor(random() * (1 + diff));
    const verts = [];
    const stepW = dist / (numSteps + 1);
    let currentY = sy;
    const totalDrop = clampY(sy + 80 + diff * 150) - sy;

    for (let i = 1; i <= numSteps; i++) {
      const stepX = sx + stepW * i;
      const flatLen = randRange(30, 60);
      verts.push({ x: stepX - flatLen, y: currentY }); // flat shelf
      verts.push({ x: stepX, y: currentY });            // edge
      currentY = clampY(sy + totalDrop * (i / numSteps));
      verts.push({ x: stepX + 8, y: currentY });        // steep drop
    }
    verts.push({ x: sx + dist, y: currentY });
    return verts;
  },

  // ── HARD ──────────────────────────────────────────────
  deep_pocket(sx, sy, dist, cupY, diff) {
    // Cup sits in a narrow pocket/notch — steep walls on both sides
    // Like real DG holes where cup is tucked in a crevice
    const pocketX = sx + dist * randRange(0.55, 0.75);
    const pocketW = randRange(50, 80);
    const pocketDepth = randRange(80, 160 + diff * 80);
    const rimY = clampY(Math.min(sy, H * 0.45));
    const pocketBotY = clampY(rimY + pocketDepth);
    const wallW = randRange(8, 15);
    return [
      { x: sx + dist * 0.25, y: clampY(lerp(sy, rimY, 0.5)) },
      { x: pocketX - pocketW / 2 - 20, y: rimY },  // approach
      { x: pocketX - pocketW / 2, y: rimY },        // left rim
      { x: pocketX - pocketW / 2 + wallW, y: pocketBotY }, // left wall
      { x: pocketX + pocketW / 2 - wallW, y: pocketBotY }, // floor
      { x: pocketX + pocketW / 2, y: rimY },        // right rim
      { x: sx + dist, y: rimY }
    ];
  },

  canyon_cup(sx, sy, dist, cupY, diff) {
    // Cup at the bottom of a deep canyon — must chip ball down into it
    // Seen frequently in real DG holes 2000+
    const canyonX = sx + dist * randRange(0.5, 0.7);
    const depth = randRange(120, 220 + diff * 60);
    const topY = clampY(Math.min(sy, H * 0.35));
    const botY = clampY(topY + depth);
    const canyonW = randRange(60, 100);
    const wallW = randRange(8, 15);
    return [
      { x: sx + dist * 0.2, y: clampY(lerp(sy, topY, 0.4)) },
      { x: canyonX - canyonW / 2, y: topY },    // left rim
      { x: canyonX - canyonW / 2 + wallW, y: botY }, // left wall
      { x: canyonX + canyonW / 2 - wallW, y: botY }, // canyon floor (cup here)
      { x: canyonX + canyonW / 2, y: topY },    // right wall up
      { x: sx + dist, y: topY }
    ];
  },

  fortress(sx, sy, dist, cupY, diff) {
    // Tall rectangular block in the middle — must lob over or around
    // Like the block shapes seen in holes 4000+
    const blockL = sx + dist * randRange(0.25, 0.4);
    const blockR = sx + dist * randRange(0.5, 0.65);
    const blockH = randRange(120, 200 + diff * 80);
    const floorY = clampY(Math.max(sy, H * 0.65));
    const blockTopY = clampY(floorY - blockH);
    const wallW = randRange(8, 15);
    return [
      { x: blockL - 10, y: floorY },            // ground level
      { x: blockL, y: floorY },                 // base left
      { x: blockL + wallW, y: blockTopY },       // wall up
      { x: blockR - wallW, y: blockTopY },       // flat top
      { x: blockR, y: floorY },                 // wall down
      { x: sx + dist, y: cupY }
    ];
  },

  narrow_gap(sx, sy, dist, cupY, diff) {
    // Two tall walls with a narrow gap — ball must be threaded through
    // Signature hard feature of real DG
    const gapX = sx + dist * randRange(0.35, 0.55);
    const gapW = randRange(30, 55);
    const wallH = randRange(120, 200 + diff * 80);
    const floorY = clampY(Math.max(sy + 30, H * 0.7));
    const wallTopY = clampY(floorY - wallH);
    // Proportional wall width for tall walls
    const wallW = Math.max(30, wallH * 0.3);
    return [
      { x: sx + 20, y: sy },                    // match tee
      { x: gapX - gapW / 2 - 60, y: floorY },  // transition to floor
      { x: gapX - gapW / 2 - wallW, y: floorY },
      { x: gapX - gapW / 2, y: wallTopY },      // left wall top
      { x: gapX - gapW / 2 + wallW, y: floorY },// left wall inner
      { x: gapX + gapW / 2 - wallW, y: floorY },// right wall inner
      { x: gapX + gapW / 2, y: wallTopY },      // right wall top
      { x: gapX + gapW / 2 + wallW, y: floorY },
      { x: sx + dist, y: cupY }
    ];
  },

  cliff_shelf(sx, sy, dist, cupY, diff) {
    // Dramatic cliff with cup on a narrow shelf partway down
    // Like real DG holes with elevated ledges
    const cliffX = sx + dist * randRange(0.4, 0.55);
    const totalH = randRange(140, 240 + diff * 60);
    const shelfH = totalH * randRange(0.3, 0.6);
    const topY = clampY(Math.min(sy, H * 0.3));
    const shelfY = clampY(topY + shelfH);
    const botY = clampY(topY + totalH);
    const shelfW = randRange(50, 90);
    // Proportional wall widths
    const wallW1 = Math.max(30, shelfH * 0.4);
    const wallW2 = Math.max(30, (totalH - shelfH) * 0.4);
    return [
      { x: sx + 20, y: sy },                    // match tee
      { x: cliffX - 20, y: topY },              // transition to cliff top
      { x: cliffX, y: topY },                   // cliff top
      { x: cliffX + wallW1, y: shelfY },          // wall to shelf
      { x: cliffX + wallW1 + shelfW, y: shelfY }, // shelf (cup goes here)
      { x: cliffX + wallW1 + shelfW + wallW2, y: botY }, // drop below shelf
      { x: sx + dist, y: botY }
    ];
  },

  compound_terrain(sx, sy, dist, cupY, diff) {
    // Multiple mixed features — peak + valley + step, like late-game DG
    const verts = [];
    const numFeatures = 2 + Math.floor(random() * 2);
    const segW = dist / (numFeatures + 1);
    let y = sy;

    for (let i = 1; i <= numFeatures; i++) {
      const fx = sx + segW * i;
      const featureType = random();
      const amp = randRange(60, 120 + diff * 80);

      if (featureType < 0.3) {
        // Sharp peak
        verts.push({ x: fx - 20, y: y });
        verts.push({ x: fx, y: clampY(y - amp) });
        verts.push({ x: fx + 20, y: y });
      } else if (featureType < 0.6) {
        // Step down
        verts.push({ x: fx, y: y });
        y = clampY(y + amp * 0.7);
        verts.push({ x: fx + 8, y: y });
      } else {
        // V-dip
        const dipY = clampY(y + amp);
        verts.push({ x: fx - 15, y: y });
        verts.push({ x: fx, y: dipY });
        verts.push({ x: fx + 15, y: y });
      }
    }
    verts.push({ x: sx + dist, y: cupY });
    return verts;
  },

  // ── DRAMATIC — extreme elevation, full screen use ──────
  // Inspired by late-game Desert Golfing (holes 10000+)

  deep_plunge(sx, sy, dist, cupY, diff) {
    // Flat shelf on left → steep drop → deep valley floor → long steep climb to high cup
    // Uses nearly the full screen height
    const shelfEnd = sx + dist * randRange(0.15, 0.3);
    const valleyBottom = H * randRange(0.88, 0.96); // near screen bottom
    const plateauTop = H * randRange(0.06, 0.20);   // near screen top
    const riseStart = sx + dist * randRange(0.35, 0.5);
    // Proportional wall width for the big drop
    const dropH = Math.abs(valleyBottom - sy);
    const wallW = Math.max(45, dropH * 0.5);
    return [
      { x: shelfEnd, y: sy },                         // shelf edge
      { x: shelfEnd + wallW, y: valleyBottom },        // sloped drop
      { x: riseStart, y: valleyBottom },               // valley floor
      { x: riseStart + dist * 0.15, y: lerp(valleyBottom, plateauTop, 0.5) }, // mid-slope
      { x: sx + dist - 60, y: plateauTop },            // high plateau
      { x: sx + dist, y: plateauTop }                  // cup on top
    ];
  },

  cliff_valley_climb(sx, sy, dist, cupY, diff) {
    // Shelf → drop → narrow valley → gradual climb → elevated cup
    // Like the reference image: multiple distinct terrain zones in one hole
    const shelfW = dist * randRange(0.15, 0.25);
    const shelfY = H * randRange(0.25, 0.45);
    const dropX = sx + shelfW;
    const valleyY = H * randRange(0.85, 0.96);
    const valleyW = dist * randRange(0.08, 0.15);
    const climbEnd = sx + dist * randRange(0.75, 0.85);
    const cupHeight = H * randRange(0.08, 0.30);
    // Proportional wall widths for deep drops
    const drop1 = Math.abs(valleyY - shelfY);
    const wallW1 = Math.max(45, drop1 * 0.5);
    const rise1 = Math.abs(valleyY - lerp(valleyY, cupHeight, 0.3));
    const wallW2 = Math.max(45, rise1 * 0.5);
    return [
      { x: sx + 20, y: sy },                          // match tee
      { x: sx + dist * 0.08, y: shelfY },             // transition to shelf
      { x: dropX, y: shelfY },                        // shelf edge
      { x: dropX + wallW1, y: valleyY },               // sloped drop to valley
      { x: dropX + wallW1 + valleyW, y: valleyY },     // valley floor
      { x: dropX + wallW1 + valleyW + wallW2, y: lerp(valleyY, cupHeight, 0.3) }, // start climbing
      { x: climbEnd, y: cupHeight + 40 },              // approaching cup
      { x: sx + dist - 30, y: cupHeight },             // cup plateau
      { x: sx + dist, y: cupHeight }
    ];
  },

  dramatic_ridge(sx, sy, dist, cupY, diff) {
    // Low start → massive climb to a high ridge → steep drop on the other side → cup below
    const ridgeX = sx + dist * randRange(0.4, 0.6);
    const ridgeTop = H * randRange(0.05, 0.18);
    const lowY = H * randRange(0.75, 0.92);
    const cupFloorY = H * randRange(0.50, 0.70);
    return [
      { x: sx + 20, y: sy },                          // match tee
      { x: sx + dist * 0.08, y: lowY },               // transition to low start
      { x: ridgeX - 80, y: lerp(lowY, ridgeTop, 0.4) }, // climbing
      { x: ridgeX - 30, y: ridgeTop + 15 },            // near peak
      { x: ridgeX, y: ridgeTop },                      // ridge peak
      { x: ridgeX + 20, y: ridgeTop + 10 },            // sharp other side
      { x: ridgeX + 60, y: lerp(ridgeTop, cupFloorY, 0.6) }, // descending
      { x: sx + dist - 40, y: cupFloorY },             // cup area
      { x: sx + dist, y: cupFloorY }
    ];
  },

  shelf_drop_shelf(sx, sy, dist, cupY, diff) {
    // FLAT tee runway → rise to a high shelf (capped so it's reachable from the tee, never a trapped pit) →
    // drop → mid shelf → drop → low shelf with the cup. Walls ≤ ~55° so the ball can always escape.
    const endX = sx + dist;
    const highY = clampY(Math.min(H * randRange(0.20, 0.34), sy - 110));   // high shelf, but a reachable rise above the tee
    const midY = clampY(H * randRange(0.46, 0.58));
    const lowY = clampY(H * randRange(0.66, 0.80));
    const riseW = Math.max(90, Math.abs(sy - highY) * 0.8);
    const wallW1 = Math.max(70, Math.abs(midY - highY) * 0.7);
    const wallW2 = Math.max(70, Math.abs(lowY - midY) * 0.7);
    const v = [{ x: sx + 20, y: sy }];
    let x = sx + dist * 0.14; v.push({ x, y: sy });                 // FLAT runway off the tee (ball builds up; never trapped)
    x += riseW; v.push({ x, y: highY });                            // rise to the high shelf
    x += Math.max(60, dist * 0.12); v.push({ x, y: highY });        // high shelf top
    x += wallW1; v.push({ x, y: midY });                           // drop to the mid shelf
    x += Math.max(60, dist * 0.10); v.push({ x, y: midY });         // mid shelf
    x += wallW2; x = Math.min(x, endX - 130); v.push({ x, y: lowY });  // drop to the low shelf (keep ≥130px of green)
    v.push({ x: endX, y: lowY });                                   // low shelf — cup lands here on the flat
    return v;
  },

  water_valley(sx, sy, dist, cupY, diff) {
    // Terrain dips below a "water line" — creates a water hazard
    // Ball going into the water = OOB
    const waterY = H * 0.88;  // water level near screen bottom
    const valleyX = sx + dist * randRange(0.3, 0.5);
    const valleyW = dist * randRange(0.1, 0.2);
    const leftY = H * randRange(0.40, 0.55);
    const rightY = H * randRange(0.35, 0.55);
    // Proportional wall width for the drop
    const dropH = Math.abs(waterY + 20 - leftY);
    const wallW = Math.max(35, dropH * 0.4);
    return [
      { x: sx + 20, y: sy },                          // match tee
      { x: sx + dist * 0.08, y: leftY },              // transition to left terrain
      { x: valleyX - 30, y: leftY + 20 },             // approaching valley
      { x: valleyX, y: leftY + 10 },                  // valley rim left
      { x: valleyX + wallW, y: waterY + 20 },          // sloped drop below water
      { x: valleyX + valleyW, y: waterY + 20 },        // valley floor (underwater)
      { x: valleyX + valleyW + wallW, y: rightY + 10 },// climb out
      { x: valleyX + valleyW + 60, y: rightY },        // right terrain
      { x: sx + dist, y: rightY }
    ];
  },

  // ════ NEW ARCHETYPES — generic variance batch ════
  // SKY_TERRACE: A switchback mountain road climbing in alternating wide terraces to a broad summit terrace where the cup waits against open sky
  sky_terrace(sx, sy, dist, cupY, diff) {
  const endX = sx + dist, base = clampY(sy);
  const tiers = 3 + Math.floor(diff * 2 + randRange(0, 1.4));
  const topY = clampY(Math.min(sy, H * 0.30) - diff * 80 - randRange(20, 50));
  const climbW = dist * 0.78;
  const dy = (base - topY) / tiers;
  const v = [{ x: sx, y: base }];
  let x = sx + dist * 0.08, y = base;
  for (let i = 0; i < tiers; i++) {
    const next = clampY(base - dy * (i + 1));
    const riseW = (climbW / tiers) * 0.42;
    const flatW = (climbW / tiers) * 0.58;
    x += riseW; y = next; v.push({ x, y });
    x += flatW; v.push({ x, y });
  }
  const sumW = Math.min(dist * 0.16, endX - x - 30);
  v.push({ x: x + sumW * 0.5, y: topY, cup: true });
  v.push({ x: x + sumW, y: topY });
  v.push({ x: endX, y: clampY(topY + randRange(10, 40)) });
  return v;
},

  // FLAT_TOP_BUTTE: A lone towering flat-topped butte rising out of the desert floor, sheer dramatic sides and a wide windswept mesa-cap holding the cup
  flat_top_butte(sx, sy, dist, cupY, diff) {
  const endX = sx + dist, base = clampY(sy);
  const cx = sx + dist * randRange(0.46, 0.58);
  const capHalf = randRange(80, 120);
  const capY = clampY(Math.min(sy, H * 0.34) - diff * 90 - randRange(20, 60));
  const shoulderY = clampY(lerp(capY, base, 0.62));
  return [
    { x: sx, y: base },
    { x: cx - capHalf - randRange(50, 90), y: clampY(lerp(base, shoulderY, 0.7)) },
    { x: cx - capHalf - 18, y: shoulderY },
    { x: cx - capHalf, y: capY },
    { x: cx - capHalf * 0.4, y: capY },
    { x: cx, y: capY, cup: true },
    { x: cx + capHalf * 0.4, y: capY },
    { x: cx + capHalf, y: capY },
    { x: cx + capHalf + 18, y: shoulderY },
    { x: cx + capHalf + randRange(50, 90), y: clampY(lerp(base, shoulderY, 0.7)) },
    { x: endX, y: base },
  ];
},

  // SUMMIT_SADDLE: Twin shoulders flanking a high mountain saddle — you crest the ridge and the cup nestles in a broad gentle dip cradled between two soaring peaks
  summit_saddle(sx, sy, dist, cupY, diff) {
  const endX = sx + dist, base = clampY(sy);
  const cx = sx + dist * randRange(0.48, 0.56);
  const peakY = clampY(Math.min(sy, H * 0.26) - diff * 95 - randRange(20, 55));
  const saddleY = clampY(peakY + randRange(46, 78));
  const saddleHalf = randRange(80, 130);
  const peakOff = saddleHalf + randRange(40, 80);
  return [
    { x: sx, y: base },
    { x: cx - peakOff - randRange(40, 80), y: clampY(lerp(base, peakY, 0.6)) },
    { x: cx - peakOff, y: peakY },
    { x: cx - saddleHalf, y: clampY(lerp(peakY, saddleY, 0.85)) },
    { x: cx - saddleHalf * 0.45, y: saddleY },
    { x: cx, y: saddleY, cup: true },
    { x: cx + saddleHalf * 0.45, y: saddleY },
    { x: cx + saddleHalf, y: clampY(lerp(peakY, saddleY, 0.85)) },
    { x: cx + peakOff, y: peakY },
    { x: cx + peakOff + randRange(40, 80), y: clampY(lerp(base, peakY, 0.6)) },
    { x: endX, y: base },
  ];
},

  // CHASM_CARRY: A single yawning vertical-walled chasm splits the fairway; clear it to a broad sunlit mesa where the cup waits
  chasm_carry(sx, sy, dist, cupY, diff) {
  const endX = sx + dist, base = clampY(sy);
  const gapW = randRange(70, 110) + diff * 90;
  const gx = sx + dist * randRange(0.34, 0.42);
  const pitY = clampY(Math.max(base, H * 0.6) + randRange(70, 120) + diff * 60);
  const landY = clampY(base - randRange(0, 18) - diff * 14);
  const landStart = gx + gapW;
  const landFlat = Math.min(landStart + randRange(150, 230), endX - 70);
  const cupX = (landStart + landFlat) / 2;
  return [
    { x: sx, y: base },
    { x: gx - 60, y: base },
    { x: gx - 8, y: clampY(base + 6) },
    { x: gx, y: pitY },
    { x: gx + gapW * 0.5, y: clampY(pitY + 10) },
    { x: gx + gapW, y: clampY(base + 6) },
    { x: landStart + 24, y: landY },
    { x: cupX, y: landY, cup: true },
    { x: landFlat, y: landY },
    { x: endX, y: clampY(landY + randRange(0, 24)) },
  ];
},

  // STEPPING_STONES: Two carry hazards in a row with a safe rest plateau between, then a generous green — a rhythmic skip-skip-land
  stepping_stones(sx, sy, dist, cupY, diff) {
  const endX = sx + dist, base = clampY(sy);
  const pitY = clampY(Math.max(base, H * 0.58) + randRange(60, 100) + diff * 55);
  const g1 = sx + dist * 0.24, g1w = randRange(55, 80) + diff * 45;
  const restStart = g1 + g1w;
  const restW = randRange(80, 120);
  const g2 = restStart + restW, g2w = randRange(55, 80) + diff * 45;
  const restY = clampY(base - randRange(4, 16));
  const greenStart = g2 + g2w;
  const greenFlat = Math.min(greenStart + randRange(140, 200), endX - 60);
  const greenY = clampY(base - diff * 12);
  const cupX = (greenStart + greenFlat) / 2;
  return [
    { x: sx, y: base },
    { x: g1 - 30, y: base },
    { x: g1, y: pitY },
    { x: g1 + g1w * 0.5, y: clampY(pitY + 8) },
    { x: restStart, y: clampY(base + 4) },
    { x: restStart + restW * 0.5, y: restY },
    { x: g2, y: pitY },
    { x: g2 + g2w * 0.5, y: clampY(pitY + 8) },
    { x: greenStart, y: clampY(base + 4) },
    { x: greenStart + 26, y: greenY },
    { x: cupX, y: greenY, cup: true },
    { x: greenFlat, y: greenY },
    { x: endX, y: clampY(greenY + randRange(0, 20)) },
  ];
},

  // MOAT_ISLAND_FLAT: A wide flat green ringed by a moat-like dip on its approach side — carry the moat and the ball rolls onto an oversized landing apron with the pin
  moat_island_flat(sx, sy, dist, cupY, diff) {
  const endX = sx + dist, base = clampY(sy);
  const moatStart = sx + dist * randRange(0.4, 0.5);
  const moatW = randRange(90, 130) + diff * 70;
  const moatY = clampY(Math.max(base, H * 0.6) + randRange(55, 95) + diff * 50);
  const apronStart = moatStart + moatW;
  const apronY = clampY(base - randRange(6, 22) - diff * 16);
  const apronEnd = Math.min(apronStart + randRange(180, 260), endX - 50);
  const cupX = lerp(apronStart, apronEnd, 0.5);
  return [
    { x: sx, y: base },
    { x: moatStart - 70, y: base },
    { x: moatStart - 18, y: clampY(base + 4) },
    { x: moatStart, y: clampY(lerp(base, moatY, 0.7)) },
    { x: moatStart + moatW * 0.5, y: moatY },
    { x: apronStart - 12, y: clampY(lerp(moatY, apronY, 0.6)) },
    { x: apronStart + 30, y: apronY },
    { x: cupX, y: apronY, cup: true },
    { x: apronEnd, y: apronY },
    { x: endX, y: clampY(apronY + randRange(4, 28)) },
  ];
},

  // FUNNEL_GATHER: A wide symmetric V-funnel of converging slopes that vacuums any landing ball straight down into a flat sink at the throat
  funnel_gather(sx, sy, dist, cupY, diff) {
  const endX = sx + dist, base = clampY(sy);
  const cx = sx + dist * randRange(0.5, 0.6);
  const mouthHalf = randRange(150, 230);
  const floorY = clampY(Math.max(base, H * 0.6) + diff * randRange(30, 70));
  const rimY = clampY(floorY - randRange(90, 150) - diff * 40);
  const flatHalf = randRange(34, 52);
  return [
    { x: sx, y: base },
    { x: cx - mouthHalf, y: rimY },
    { x: cx - mouthHalf * 0.6, y: clampY(lerp(rimY, floorY, 0.5)) },
    { x: cx - mouthHalf * 0.28, y: clampY(lerp(rimY, floorY, 0.82)) },
    { x: cx - flatHalf, y: floorY },
    { x: cx, y: floorY, cup: true },
    { x: cx + flatHalf, y: floorY },
    { x: cx + mouthHalf * 0.28, y: clampY(lerp(rimY, floorY, 0.82)) },
    { x: cx + mouthHalf * 0.6, y: clampY(lerp(rimY, floorY, 0.5)) },
    { x: cx + mouthHalf, y: rimY },
    { x: endX, y: base },
  ];
},

  // WASHBOARD_CRADLE: A gentle ramp textured with small washboard ripples that bleed off speed, ending in a soft scooped cradle where the ball nestles
  washboard_cradle(sx, sy, dist, cupY, diff) {
  const endX = sx + dist, base = clampY(sy);
  const v = [{ x: sx, y: base }];
  const rampEnd = sx + dist * randRange(0.58, 0.68);
  const rampTopY = clampY(Math.min(sy, H * 0.4) - diff * 26);
  const bumps = 4 + Math.floor(randRange(0, 3));
  const amp = randRange(7, 13);
  for (let i = 1; i <= bumps; i++) {
    const t = i / (bumps + 1);
    const x = lerp(sx + dist * 0.1, rampEnd, t);
    const baseLine = lerp(base, rampTopY, t);
    v.push({ x: x - 10, y: clampY(baseLine - amp) });
    v.push({ x: x + 10, y: clampY(baseLine + amp * 0.5) });
  }
  const cradleW = randRange(120, 180);
  const cradleLip = clampY(rampTopY - randRange(6, 18));
  const cradleBot = clampY(rampTopY + randRange(40, 80) + diff * 24);
  const ccx = rampEnd + cradleW * 0.5;
  v.push({ x: rampEnd, y: cradleLip });
  v.push({ x: ccx - cradleW * 0.25, y: clampY(lerp(cradleLip, cradleBot, 0.85)) });
  v.push({ x: ccx, y: cradleBot, cup: true });
  v.push({ x: ccx + cradleW * 0.25, y: clampY(lerp(cradleLip, cradleBot, 0.85)) });
  v.push({ x: ccx + cradleW * 0.5, y: cradleLip });
  v.push({ x: endX, y: clampY(lerp(cradleLip, base, 0.5)) });
  v.push({ x: endX, y: base });
  return v;
},

  // BANKED_CURVE: A sweeping banked turn like a luge wall — the outer bank rises high then curls down into a wide flat infield where the ball comes to rest
  banked_curve(sx, sy, dist, cupY, diff) {
  const endX = sx + dist, base = clampY(sy);
  const v = [{ x: sx, y: base }];
  const bankStart = sx + dist * randRange(0.22, 0.3);
  const bankPeakX = sx + dist * randRange(0.46, 0.56);
  const bankY = clampY(Math.min(sy, H * 0.34) - diff * randRange(40, 80));
  v.push({ x: bankStart, y: clampY(lerp(base, bankY, 0.45)) });
  v.push({ x: lerp(bankStart, bankPeakX, 0.5), y: clampY(lerp(base, bankY, 0.85)) });
  v.push({ x: bankPeakX, y: bankY });
  const infieldY = clampY(bankY + randRange(70, 120) + diff * 20);
  const infW = randRange(150, 220);
  const infStart = bankPeakX + randRange(40, 70);
  v.push({ x: bankPeakX + 30, y: clampY(lerp(bankY, infieldY, 0.55)) });
  v.push({ x: infStart, y: clampY(lerp(bankY, infieldY, 0.92)) });
  const icx = infStart + infW * 0.5;
  v.push({ x: icx, y: infieldY, cup: true });
  v.push({ x: infStart + infW, y: clampY(infieldY - randRange(6, 16)) });
  v.push({ x: endX - 50, y: clampY(lerp(infieldY, base, 0.5)) });
  v.push({ x: endX, y: base });
  return v;
},

  // AMPHITHEATRE: An ancient alien amphitheatre — concentric stone tiers stepping down to a broad central stage where the cup rests
  amphitheatre(sx, sy, dist, cupY, diff) {
    const endX = sx + dist, base = clampY(sy);
    const cx = sx + dist * randRange(0.5, 0.6);
    const tiers = 3 + Math.floor(randRange(0, 2.2));
    const stageY = clampY(Math.max(base, H * 0.6) + randRange(28, 64) + diff * 30);
    const topY = clampY(stageY - randRange(70, 120) - diff * 40);
    const stageHalf = randRange(70, 110);
    const dy = (stageY - topY) / tiers;
    const tierW = (dist * 0.34 - stageHalf) / tiers;
    const v = [{ x: sx, y: base }];
    let lx = cx - stageHalf - tierW * tiers;
    v.push({ x: lx, y: topY });
    for (let i = 0; i < tiers; i++) {
      const y = clampY(lerp(topY, stageY, (i + 1) / tiers));
      lx += tierW - 12; v.push({ x: lx, y: clampY(y - dy * 0.5) });
      lx += 12; v.push({ x: lx, y });
    }
    v.push({ x: cx, y: stageY, cup: true });
    let rx = cx + stageHalf;
    for (let i = tiers - 1; i >= 0; i--) {
      const y = clampY(lerp(topY, stageY, (i + 1) / tiers));
      v.push({ x: rx, y });
      rx += 12; v.push({ x: rx, y: clampY(y - dy * 0.5) });
      rx += tierW - 12;
    }
    v.push({ x: Math.min(rx, endX - 40), y: topY });
    v.push({ x: endX, y: base });
    return v;
  },

  // CRASHED_HULL: The buckled fuselage of a crashed alien ship juts from the ground; the cup nestles in the sheltered sand pocket scooped out behind the wreck
  crashed_hull(sx, sy, dist, cupY, diff) {
    const endX = sx + dist, base = clampY(sy);
    const hullX = sx + dist * randRange(0.4, 0.52);
    const hullLen = randRange(120, 180);
    const noseY = clampY(Math.min(sy, H * 0.4) - 30 - diff * 50);
    const tailY = clampY(noseY + randRange(50, 90));
    const pocketY = clampY(Math.max(base, H * 0.62) + randRange(20, 55) + diff * 22);
    const pocketHalf = randRange(75, 105);
    const farRim = clampY(lerp(pocketY, base, 0.55));
    return [
      { x: sx, y: base },
      { x: hullX - 40, y: clampY(lerp(base, noseY, 0.7)) },
      { x: hullX, y: noseY },
      { x: hullX + hullLen * 0.5, y: clampY(noseY + (tailY - noseY) * 0.35) },
      { x: hullX + hullLen, y: tailY },
      { x: hullX + hullLen + 28, y: clampY(lerp(tailY, pocketY, 0.85)) },
      { x: hullX + hullLen + 28 + pocketHalf, y: pocketY, cup: true },
      { x: hullX + hullLen + 28 + pocketHalf * 2, y: clampY(lerp(pocketY, farRim, 0.8)) },
      { x: endX - 50, y: farRim },
      { x: endX, y: base },
    ];
  },

  // GEYSER_CONES: A field of mineral geyser cones rises across the plain; the cup sits in the calm wide caldera atop the largest, dormant cone
  geyser_cones(sx, sy, dist, cupY, diff) {
    const endX = sx + dist, base = clampY(sy);
    const v = [{ x: sx, y: base }];
    const small1X = sx + dist * 0.22, small1Y = clampY(base - randRange(30, 55) - diff * 18);
    v.push({ x: small1X - 26, y: clampY(lerp(base, small1Y, 0.6)) });
    v.push({ x: small1X, y: small1Y });
    v.push({ x: small1X + 26, y: clampY(lerp(base, small1Y, 0.6)) });
    v.push({ x: sx + dist * 0.34, y: base });
    const cx = sx + dist * randRange(0.52, 0.62);
    const coneH = randRange(80, 130) + diff * 45;
    const rimY = clampY(Math.min(sy, H * 0.5) - coneH);
    const caldHalf = randRange(60, 90);
    const caldY = clampY(rimY + randRange(20, 38));
    v.push({ x: cx - caldHalf - 70, y: clampY(lerp(base, rimY, 0.5)) });
    v.push({ x: cx - caldHalf, y: rimY });
    v.push({ x: cx - caldHalf * 0.45, y: caldY });
    v.push({ x: cx, y: caldY, cup: true });
    v.push({ x: cx + caldHalf * 0.45, y: caldY });
    v.push({ x: cx + caldHalf, y: rimY });
    v.push({ x: cx + caldHalf + 70, y: clampY(lerp(base, rimY, 0.5)) });
    const small2X = sx + dist * 0.82, small2Y = clampY(base - randRange(26, 48) - diff * 16);
    v.push({ x: small2X - 24, y: clampY(lerp(base, small2Y, 0.6)) });
    v.push({ x: small2X, y: small2Y });
    v.push({ x: small2X + 24, y: clampY(lerp(base, small2Y, 0.6)) });
    v.push({ x: endX, y: base });
    return v;
  },

  // ════ NEW ARCHETYPES — TRAPPIST-1 system ════
  // TIDAL_TERMINATOR: A planet frozen on one face, baked on the other. The right half is the SUNLIT side: a sing
  tidal_terminator(sx, sy, dist, cupY, diff) {
  const endX = sx + dist, base = clampY(sy);
  // terminator sits left-of-center: frozen steps on the left, melt-slope on the right
  const termX = sx + dist * randRange(0.40, 0.50);
  // broad calm pocket at the terminator (the habitable ring) -- this is the cup floor
  const pocketY = clampY(Math.min(sy + 8, H * 0.60));
  const pocketHalf = randRange(64, 96); // generous catch width
  // FROZEN NIGHTSIDE: stepped ice shelves descending from tee down into the pocket
  const steps = 2 + Math.floor(randRange(0, 1.6 + diff * 1.4));
  const iceTopY = clampY(Math.min(sy, H * 0.40) - diff * 26); // raised frozen plateau near tee
  const v = [{ x: sx, y: base }];
  // climb/settle onto frozen plateau
  v.push({ x: sx + dist * 0.07, y: iceTopY });
  const stepSpan = (termX - pocketHalf) - (sx + dist * 0.07);
  const dy = (pocketY - iceTopY) / steps;
  let x = sx + dist * 0.07, y = iceTopY;
  for (let i = 0; i < steps; i++) {
    x += stepSpan / steps * 0.34; v.push({ x, y }); // flat tread
    y = clampY(iceTopY + dy * (i + 1));
    x += stepSpan / steps * 0.66; v.push({ x, y }); // riser drop
  }
  // enter the broad terminator pocket (left lip -> flat floor -> cup -> flat floor)
  v.push({ x: termX - pocketHalf, y: pocketY });
  v.push({ x: termX, y: pocketY, cup: true });
  v.push({ x: termX + pocketHalf, y: pocketY });
  // SUNLIT DAYSIDE: one long smooth melted slope rising gently away to the right
  const sunPeakY = clampY(pocketY - randRange(40, 70) - diff * 30);
  v.push({ x: lerp(termX + pocketHalf, endX, 0.62), y: clampY(lerp(pocketY, sunPeakY, 0.7)) });
  v.push({ x: endX, y: sunPeakY });
  return v;
},

  // MELT_BASIN_SHELF: This is the inverse stitching of the same locked world: the SUNLIT melt is now the BIG fea
  melt_basin_shelf(sx, sy, dist, cupY, diff) {
  const endX = sx + dist, base = clampY(sy);
  // terminator sits right-of-center: long sunlit melt on the left, frozen ledge-wall on the right
  const termX = sx + dist * randRange(0.55, 0.66);
  // broad meltwater basin floor at the seam -- the cup catch
  const basinY = clampY(Math.min(sy + randRange(40, 80) + diff * 24, H * 0.66));
  const basinHalf = randRange(70, 100); // generous catch width
  // SUNLIT DAYSIDE: one long smooth melted slope from tee down to the basin
  const dayHighY = clampY(Math.min(sy, H * 0.46) - diff * 20);
  const v = [{ x: sx, y: base }];
  v.push({ x: sx + dist * 0.10, y: dayHighY }); // crest of the warm slope
  // smooth multi-point melt ramp easing down into the basin (concave, gentle)
  const rampEnd = termX - basinHalf;
  for (let t = 0.30; t <= 0.85; t += 0.275) {
    const ease = t * t; // accelerating melt-drop, smooth
    v.push({ x: lerp(sx + dist * 0.10, rampEnd, t), y: clampY(lerp(dayHighY, basinY, ease)) });
  }
  // broad basin: left lip -> flat floor -> cup -> flat floor (the calm ring)
  v.push({ x: rampEnd, y: basinY });
  v.push({ x: termX, y: basinY, cup: true });
  v.push({ x: termX + basinHalf, y: basinY });
  // FROZEN NIGHTSIDE: stepped ice ledges climbing UP and away as a back-wall
  const iceSteps = 2 + Math.floor(randRange(0, 1.4 + diff * 1.2));
  const iceTopY = clampY(basinY - randRange(70, 110) - diff * 34);
  const iceSpan = endX - (termX + basinHalf);
  const idy = (basinY - iceTopY) / iceSteps;
  let x = termX + basinHalf, y = basinY;
  for (let i = 0; i < iceSteps; i++) {
    y = clampY(basinY - idy * (i + 1));
    x += iceSpan / iceSteps * 0.45; v.push({ x, y }); // riser up
    x += iceSpan / iceSteps * 0.55; v.push({ x: Math.min(x, endX), y }); // flat ice tread
  }
  return v;
},

  // GRANULATION_CELLS: The boiling skin of the red dwarf: a row of broad, low convective domes (granules) glowing
  granulation_cells(sx, sy, dist, cupY, diff) {
  const endX = sx + dist, base = clampY(sy);
  const cells = 3 + Math.floor(randRange(0, 1.6));              // 3-4 broad convective domes
  const domeH = 26 + diff * 40;                                // dome rise (drama scales w/ diff)
  const laneY = clampY(Math.min(base, H * 0.5));              // flat intergranular lanes
  const cellW = (dist * 0.82) / cells, pocket = cellW * 0.18; // pocket half-width scales w/ cell
  const v = [{ x: sx, y: base }, { x: sx + dist * 0.09, y: laneY }];
  let x = sx + dist * 0.09;
  const cupCell = 1 + Math.floor(random() * (cells - 2));      // interior lane: index 1..cells-2
  for (let i = 0; i < cells; i++) {
    const last = i === cells - 1, peakX = x + cellW * 0.5;
    const domeY = clampY(laneY - domeH - randRange(0, 14));
    v.push({ x: peakX - cellW * 0.22, y: clampY(lerp(laneY, domeY, 0.7)) });
    v.push({ x: peakX, y: domeY });                           // rounded granule crest
    v.push({ x: peakX + cellW * 0.22, y: clampY(lerp(laneY, domeY, 0.7)) });
    x += cellW;
    const laneX = last ? Math.min(x, endX - 60) : x;
    if (i === cupCell) {                                       // wide flat lane = generous catch pocket
      v.push({ x: laneX - pocket, y: laneY });
      v.push({ x: laneX, y: laneY, cup: true });
      v.push({ x: laneX + pocket, y: laneY });
    } else {
      v.push({ x: laneX, y: laneY });
    }
  }
  v.push({ x: endX, y: base });
  return v;
},

  // SUNSPOT_BASIN: A vast magnetic sunspot: a raised, brilliant penumbral ring of hot plasma encircling a wid
  sunspot_basin(sx, sy, dist, cupY, diff) {
  const endX = sx + dist, base = clampY(sy);
  const penY = clampY(Math.min(base, H * 0.44) - diff * 30);   // raised bright penumbral rim
  const floorY = clampY(penY + randRange(70, 110) + diff * 24);// deep cool umbral floor
  const cx = sx + dist * randRange(0.46, 0.56);
  const maxHalf = Math.min(cx - sx, endX - cx) - 70;           // keep room for approach + exit
  const ringHalf = Math.min(dist * (0.30 + diff * 0.06), maxHalf);
  const floorHalf = Math.max(ringHalf - randRange(58, 86), ringHalf * 0.45); // broad flat floor
  return [
    { x: sx, y: base },
    { x: cx - ringHalf - 40, y: clampY(lerp(base, penY, 0.55)) },
    { x: cx - ringHalf, y: penY },                            // bright rim crest
    { x: cx - floorHalf, y: floorY },                         // dive into the umbra
    { x: cx - floorHalf * 0.5, y: floorY },
    { x: cx, y: floorY, cup: true },                         // cup on the wide flat dark floor
    { x: cx + floorHalf * 0.5, y: floorY },
    { x: cx + floorHalf, y: floorY },
    { x: cx + ringHalf, y: penY },
    { x: cx + ringHalf + 40, y: clampY(lerp(penY, base, 0.5)) },
    { x: endX, y: base }
  ];
},

  // PRESSURE_RIDGE: A field of low jagged pressure ridges — buckled plates of sea ice shoved up against each o
  pressure_ridge(sx, sy, dist, cupY, diff) {
  const endX = sx + dist, base = clampY(sy);
  const v = [{ x: sx, y: base }];
  // ----- pressure-ridge field across first ~58% of the hole -----
  const fieldEnd = sx + dist * 0.58;
  const ridges = 3 + Math.floor(randRange(0, 2.6));
  const ridgeAmp = 16 + diff * 30;          // low; scales with drama
  const span = fieldEnd - (sx + dist * 0.08);
  const stepW = span / ridges;
  let x = sx + dist * 0.08;
  for (let i = 0; i < ridges; i++) {
    // shallow trough then a rounded ridge crest (no deep slots)
    const troughY = clampY(base + randRange(4, 12));
    const crestY  = clampY(base - ridgeAmp * randRange(0.7, 1.0));
    x += stepW * 0.30; v.push({ x, y: troughY });
    x += stepW * 0.22; v.push({ x, y: crestY });
    x += stepW * 0.48; v.push({ x, y: clampY(base + randRange(0, 6)) });
  }
  // ----- gentle lip down into the cracked fissure -----
  const lipX = clampY ? x + 30 : x + 30;
  const fissureFloorY = clampY(base + 46 + diff * 60);   // deeper with drama
  v.push({ x: x + 26, y: clampY(base + randRange(2, 10)) });          // outer rim
  v.push({ x: x + 56, y: clampY(lerp(base, fissureFloorY, 0.55)) });   // wall in
  // ----- BROAD flat refrozen basin floor = the cup (generous catch) -----
  const basinStart = x + 84;
  const basinW = Math.max(110, (endX - 60) - basinStart - 40);
  const cupX = basinStart + basinW * 0.5;
  v.push({ x: basinStart, y: fissureFloorY });
  v.push({ x: cupX, y: fissureFloorY, cup: true });
  v.push({ x: basinStart + basinW, y: fissureFloorY });
  // ----- gentle far wall back up so the ball is contained -----
  v.push({ x: Math.min(basinStart + basinW + 46, endX - 24), y: clampY(lerp(fissureFloorY, base, 0.5)) });
  v.push({ x: endX, y: clampY(lerp(fissureFloorY, base, 0.8)) });
  return v;
},

  // FROZEN_LAKE: After the tee the terrain drops to a long, almost perfectly smooth frozen-lake apron — gla
  frozen_lake(sx, sy, dist, cupY, diff) {
  const endX = sx + dist, base = clampY(sy);
  const v = [{ x: sx, y: base }];
  // ----- short slope from tee down onto the lake apron -----
  const apronY = clampY(Math.max(base + 18, H * 0.52) + diff * 26);
  v.push({ x: sx + dist * 0.10, y: clampY(lerp(base, apronY, 0.65)) });
  // ----- long glassy near-level apron with micro undulations -----
  const apronEnd = sx + dist * 0.66;
  const segs = 4;
  let x = sx + dist * 0.16;
  const segW = (apronEnd - x) / segs;
  for (let i = 0; i < segs; i++) {
    x += segW;
    const wobble = randRange(-3, 3);                 // glassy = tiny variance
    const tilt = lerp(apronY, apronY + 10, i / segs); // faint drift downhill
    v.push({ x, y: clampY(tilt + wobble) });
  }
  const apronFloorY = clampY(apronY + 10);
  // ----- low lip into a wide, shallow refrozen scoop -----
  const scoopFloorY = clampY(apronFloorY + 26 + diff * 34);  // gentle, scales w/ drama
  v.push({ x: x + 34, y: clampY(apronFloorY - randRange(0, 6)) });   // faint lip
  v.push({ x: x + 64, y: clampY(lerp(apronFloorY, scoopFloorY, 0.6)) });
  // ----- BROAD flat scoop floor = the cup (generous catch) -----
  const basinStart = x + 92;
  const basinW = Math.max(120, (endX - 50) - basinStart - 36);
  const cupX = basinStart + basinW * 0.5;
  v.push({ x: basinStart, y: scoopFloorY });
  v.push({ x: cupX, y: scoopFloorY, cup: true });
  v.push({ x: basinStart + basinW, y: scoopFloorY });
  // ----- gentle far rise so the glide is contained -----
  v.push({ x: Math.min(basinStart + basinW + 40, endX - 20), y: clampY(lerp(scoopFloorY, apronFloorY, 0.55)) });
  v.push({ x: endX, y: clampY(lerp(scoopFloorY, base, 0.6)) });
  return v;
},

  // CALDERA_SHELF: A massive volcanic caldera dominates the hole. The terrain climbs from the tee up a broad 
  caldera_shelf(sx, sy, dist, cupY, diff) {
  const endX = sx + dist, base = clampY(sy);
  const rimY = clampY(Math.min(sy, H * 0.40) - 26 - diff * 40);
  const shelfY = clampY(rimY + randRange(40, 58));        // cooled crust shelf, below rim lip
  const lavaY = clampY(shelfY + randRange(120, 150) + diff * 60); // molten floor far below shelf = hazard
  const cx = sx + dist * randRange(0.50, 0.60);
  const shelfHalf = randRange(78, 100) + diff * 26;       // WIDER catch area with difficulty
  const rampX = cx - shelfHalf - randRange(40, 60);       // soft approach lip onto shelf
  return [
    { x: sx, y: base },
    { x: lerp(sx, rampX, 0.55), y: clampY(lerp(base, rimY, 0.5)) }, // ash slope up to rim
    { x: rampX, y: clampY(rimY - 6) },                    // outer rim crest
    { x: cx - shelfHalf, y: shelfY },                     // onto the broad cooled shelf
    { x: cx, y: shelfY, cup: true },                      // cup centered on wide flat
    { x: cx + shelfHalf, y: shelfY },                     // shelf still flat past the cup
    { x: cx + shelfHalf + 18, y: lavaY },                 // shelf ends, drop to molten floor
    { x: lerp(cx + shelfHalf, endX, 0.55), y: lavaY },    // lava lake floor
    { x: endX - 70, y: clampY(lerp(lavaY, base, 0.5)) },  // far rim rises back
    { x: endX, y: base }
  ];
},

  // COLLAPSED_LAVA_TUBE: A roof of basalt has caved in, exposing a collapsed lava tube. The ground runs flat-ish fr
  collapsed_lava_tube(sx, sy, dist, cupY, diff) {
  const endX = sx + dist, base = clampY(sy);
  const lipY = clampY(sy - randRange(6, 22) - diff * 18);   // crust edge of the collapse
  const benchY = clampY(lipY + randRange(70, 92) + diff * 26); // rescued tube-floor bench, partway down
  const sag = randRange(12, 20) + diff * 8;                 // shallow dish so the ball gathers to center
  const lavaY = clampY(benchY + randRange(60, 84) + diff * 50); // lava channel against far wall = hazard
  const px = sx + dist * randRange(0.42, 0.52);             // front edge of pit
  const benchHalf = randRange(72, 94) + diff * 24;          // WIDE bench, wider with difficulty
  return [
    { x: sx, y: base },
    { x: px - randRange(50, 70), y: clampY(lipY + 4) },     // approach run to the collapse
    { x: px, y: lipY },                                     // crust lip, edge of the open pit
    { x: px + 16, y: clampY(benchY - sag) },               // drop onto the bench (raised front rim)
    { x: px + 16 + benchHalf, y: benchY, cup: true },      // cup in the dished saucer center
    { x: px + 16 + benchHalf * 2, y: clampY(benchY - sag * 0.6) }, // bench far rim, still solid
    { x: px + 16 + benchHalf * 2 + 14, y: lavaY },         // beyond bench: drop to lava channel
    { x: lerp(px + benchHalf * 2, endX, 0.5), y: lavaY },  // molten channel floor
    { x: endX - 64, y: clampY(lerp(lavaY, base, 0.55)) },  // far wall climbs back to grade
    { x: endX, y: base }
  ];
},


  // ════ NEW ARCHETYPES — Barnard's Star system ════
  // WEED_MAT_DRIFT: Tidewell's slow copper seas, read as a string of floating weed-mats the ball hop
  weed_mat_drift(sx, sy, dist, cupY, diff) {
  const verts = [];
  const endX = sx + dist, base = clampY(sy);
  const gapW = 36 + diff * 60;                 // water gap widens with difficulty
  const flood = 70 + diff * 60;                // how deep the gap floods below the mats
  const lip = 8 + diff * 6;                    // tide lip catching a landed ball
  let x = sx;
  // tee anchor mat (broad, flat, at the waterline)
  verts.push({ x, y: base });
  x += randRange(80, 120); verts.push({ x, y: base });
  while (x < endX - 230) {
    // WATER GAP (floods): drop, span, climb
    x += randRange(8, 14); verts.push({ x, y: clampY(base + flood) });
    x += gapW;             verts.push({ x, y: clampY(base + flood) });
    x += randRange(8, 14);
    // MAT: a tiny lifted lip then a long dead-flat top, gently riding the swell
    const matY = clampY(base - randRange(0, 18) - diff * 14);
    verts.push({ x, y: clampY(matY + lip) });   // leading lip
    x += randRange(14, 26); verts.push({ x, y: matY });
    x += randRange(90, 150); verts.push({ x, y: matY });  // wide flat body
  }
  // final water gap before the cup mat
  x += randRange(8, 14); verts.push({ x, y: clampY(base + flood) });
  x += gapW;             verts.push({ x, y: clampY(base + flood) });
  x += randRange(8, 14);
  // CUP MAT: widest, dead flat, cup centered with mat on both sides
  const cupMatY = clampY(base - randRange(4, 16));
  verts.push({ x, y: clampY(cupMatY + lip) });
  x += randRange(18, 30); verts.push({ x, y: cupMatY });
  const cupX = Math.min(x + randRange(60, 100), endX - 80);
  verts.push({ x: cupX, y: cupMatY, cup: true });
  verts.push({ x: Math.min(cupX + randRange(70, 110), endX - 10), y: cupMatY });
  verts.push({ x: endX, y: cupMatY });
  return verts;
},

  // WEED_MAT_CLUSTER: A cluster-and-bridge reading of the copper sea: the ball works across a couple o
  weed_mat_cluster(sx, sy, dist, cupY, diff) {
  const verts = [];
  const endX = sx + dist, base = clampY(sy);
  const gapW = 34 + diff * 55;
  const flood = 65 + diff * 65;
  let x = sx;
  verts.push({ x, y: base });
  x += randRange(70, 110); verts.push({ x, y: base });   // tee mat
  // 2-3 mid stepping mats
  const steps = 2 + (random() < 0.4 + diff * 0.3 ? 1 : 0);
  for (let i = 0; i < steps; i++) {
    x += randRange(8, 14); verts.push({ x, y: clampY(base + flood) });
    x += gapW;             verts.push({ x, y: clampY(base + flood) });
    x += randRange(8, 14);
    const matY = clampY(base - randRange(0, 20) - diff * 12);
    verts.push({ x, y: matY });
    x += randRange(85, 135); verts.push({ x, y: matY });   // wide flat stepping mat
    if (x > endX - 300) break;
  }
  // final flooded gap before the giant raft
  x += randRange(8, 14); verts.push({ x, y: clampY(base + flood) });
  x += gapW;             verts.push({ x, y: clampY(base + flood) });
  x += randRange(8, 14);
  // GIANT RAFT: shoulder up, long shallow gathering saucer (cup at low center), shoulder up
  const rimY  = clampY(base - randRange(10, 26) - diff * 10);
  const sagY  = clampY(rimY + randRange(20, 34) + diff * 14);   // shallow dish low point
  const remain = Math.max(endX - 30 - x, 220);
  const half = remain * 0.5;
  verts.push({ x, y: rimY });                       // near rim of raft
  x += half * randRange(0.34, 0.42); verts.push({ x, y: lerp(rimY, sagY, 0.7) });
  const cupX = x + half * randRange(0.28, 0.42);
  verts.push({ x: cupX, y: sagY, cup: true });      // cup in the shallow saucer center
  x = cupX + half * randRange(0.30, 0.44); verts.push({ x, y: lerp(rimY, sagY, 0.7) });
  verts.push({ x: Math.min(x + half * 0.5, endX - 20), y: rimY });   // far rim
  verts.push({ x: endX, y: rimY });
  return verts;
},

  // TWILIGHT_SHELF: Solace's habitable band is a single broad terminator shelf where the eternal-twi
  twilight_shelf(sx, sy, dist, cupY, diff) {
  const endX = sx + dist, base = clampY(sy);
  // terminator shelf sits right-of-center: dim day-slope leads in, shadowed abyss drops away after
  const termX = sx + dist * randRange(0.50, 0.62);
  const shelfY = clampY(Math.min(sy + randRange(10, 34), H * 0.58)); // calm twilight shelf level
  const ringHalf = randRange(78, 116) + diff * 18;                   // generous catch ring
  const dayCrestY = clampY(Math.min(sy, H * 0.44) - diff * 22);      // low warm day crest
  const v = [{ x: sx, y: base }];
  v.push({ x: sx + dist * 0.09, y: dayCrestY });
  // DIM DAYSIDE: long smooth slope easing down into the shelf (concave, gentle)
  const rampEnd = termX - ringHalf;
  for (let t = 0.32; t <= 0.86; t += 0.27) {
    const ease = t * t;
    v.push({ x: lerp(sx + dist * 0.09, rampEnd, t), y: clampY(lerp(dayCrestY, shelfY, ease)) });
  }
  // FORESTED TERMINATOR RING: shelf lip -> gentle pocket -> cup -> pocket -> lip (the calm catch)
  const cupLip = clampY(shelfY + randRange(4, 12));
  v.push({ x: rampEnd, y: shelfY });
  v.push({ x: termX - ringHalf * 0.42, y: cupLip });
  v.push({ x: termX, y: cupLip, cup: true });
  v.push({ x: termX + ringHalf * 0.42, y: cupLip });
  v.push({ x: termX + ringHalf, y: shelfY });
  // SHADOWED NIGHTSIDE: the world falls away into a deep dark drop just past the ring
  const dropX = lerp(termX + ringHalf, endX, randRange(0.18, 0.30));
  const abyssY = clampY(shelfY + randRange(120, 180) + diff * 70);
  v.push({ x: dropX, y: shelfY });
  v.push({ x: dropX + randRange(10, 22), y: abyssY });
  v.push({ x: endX, y: abyssY });
  return v;
},

  // FOREST_CLEARING: A forest clearing carved into Solace's twilight band. The ball is fed in by a di
  forest_clearing(sx, sy, dist, cupY, diff) {
  const endX = sx + dist, base = clampY(sy);
  // terminator clearing sits slightly left-of-center; dim day-slope leads in from the tee
  const termX = sx + dist * randRange(0.46, 0.56);
  const shelfY = clampY(Math.min(sy + randRange(20, 48), H * 0.60)); // calm forested shelf level
  const clearHalf = randRange(72, 104) + diff * 16;                  // generous clearing catch
  const v = [{ x: sx, y: base }];
  // DIM DAYSIDE: gentle smooth slope easing down from a low crest into the shelf
  const dayCrestY = clampY(Math.min(sy, H * 0.46) - diff * 18);
  v.push({ x: sx + dist * 0.08, y: dayCrestY });
  const rampEnd = termX - clearHalf;
  for (let t = 0.30; t <= 0.85; t += 0.275) {
    const ease = t * t;
    v.push({ x: lerp(sx + dist * 0.08, rampEnd, t), y: clampY(lerp(dayCrestY, shelfY, ease)) });
  }
  // FORESTED CLEARING: broad shelf lip -> flat pocket floor -> cup -> floor -> lip (the calm ring)
  const floorY = clampY(shelfY + randRange(14, 28) + diff * 12);
  v.push({ x: rampEnd, y: shelfY });
  v.push({ x: termX - clearHalf * 0.55, y: floorY });
  v.push({ x: termX, y: floorY, cup: true });
  v.push({ x: termX + clearHalf * 0.55, y: floorY });
  v.push({ x: termX + clearHalf, y: shelfY });
  // SHADOWED NIGHTSIDE: dark canopy ledges stepping DOWN into the shadow as a back-wall
  const canopySteps = 2 + Math.floor(randRange(0, 1.3 + diff * 1.1));
  const canopyBotY = clampY(shelfY + randRange(100, 160) + diff * 64);
  const canopySpan = endX - (termX + clearHalf);
  const cdy = (canopyBotY - shelfY) / canopySteps;
  let x = termX + clearHalf, y = shelfY;
  for (let i = 0; i < canopySteps; i++) {
    y = clampY(shelfY + cdy * (i + 1));
    x += canopySpan / canopySteps * 0.42; v.push({ x: Math.min(x, endX - 1), y }); // drop riser
    x += canopySpan / canopySteps * 0.58; v.push({ x: Math.min(x, endX), y });     // dark tread
  }
  return v;
},

  // CLOUD_DECK_ASCENSION: A stack of horizontal cloud-band platforms climbing left-to-right, each a broad 
  cloud_deck_ascension(sx, sy, dist, cupY, diff) {
  const endX = sx + dist, base = clampY(sy);
  const bands = 2 + Math.round(diff * 2); // 2..4 decks
  const topY = clampY(Math.min(sy, H * 0.5) - 110 - diff * 150);
  const gapW = 30 + diff * 46; // horizontal sky-gap between decks
  const usable = dist - gapW * (bands - 1);
  const deckW = usable / bands; // each deck is broad and flat
  const pts = [{ x: sx, y: base }];
  let x = sx;
  for (let i = 0; i < bands; i++) {
    const t = bands === 1 ? 1 : i / (bands - 1);
    const deckY = clampY(lerp(base, topY, t));
    const x0 = x, x1 = x + deckW;
    // thin shoulder up onto the deck (gentle, not a slot)
    pts.push({ x: x0 + 8, y: clampY(deckY + 14) });
    // broad flat deck top
    if (i === bands - 1) {
      // top band: wide flat deck, cup centered with generous catch area
      pts.push({ x: x0 + deckW * 0.18, y: deckY });
      pts.push({ x: x0 + deckW * 0.5, y: deckY, cup: true });
      pts.push({ x: x1 - deckW * 0.12, y: deckY });
    } else {
      pts.push({ x: x0 + deckW * 0.2, y: deckY });
      pts.push({ x: x1 - deckW * 0.12, y: deckY });
      // thin shoulder dropping into the short sky-gap
      pts.push({ x: x1 - 4, y: clampY(deckY + 18) });
      x = x1 + gapW; // jump the gap to next deck
      continue;
    }
    x = x1;
  }
  pts.push({ x: endX, y: clampY(topY + 4) });
  return pts;
},

  // CLOUD_BREAK_LANDING: Two long, broad cloud bands at very different altitudes with a single wide cloud
  cloud_break_landing(sx, sy, dist, cupY, diff) {
  const endX = sx + dist, base = clampY(sy);
  // low near band: long flat launch deck
  const lowY = clampY(sy);
  const lowEnd = sx + dist * randRange(0.3, 0.4);
  // the wide cloud-break (single big sky-gap)
  const gapW = dist * (0.16 + diff * 0.12);
  const highStart = lowEnd + gapW;
  // high target band: broad flat deck, higher than near band
  const highY = clampY(Math.min(sy, H * 0.46) - 70 - diff * 120);
  const deckEnd = endX - 40;
  const deckMid = (highStart + deckEnd) / 2;
  // shallow center pocket on the high deck (gentle gather, not a trap)
  const pocketY = clampY(highY + randRange(20, 34));
  const pocketHalf = (deckEnd - highStart) * 0.22;
  return [
    { x: sx, y: lowY },
    { x: lowEnd - 40, y: lowY }, // long flat launch deck
    { x: lowEnd - 6, y: clampY(lowY + 16) }, // thin shoulder into the break
    // ---- wide cloud-break (sky-gap) ----
    { x: highStart + 4, y: clampY(highY + 16) }, // thin shoulder up onto high deck
    { x: highStart + (deckEnd - highStart) * 0.16, y: highY }, // broad flat landing lip
    { x: deckMid - pocketHalf, y: highY }, // flat rim of pocket
    { x: deckMid - pocketHalf * 0.4, y: pocketY }, // gentle slope in
    { x: deckMid, y: pocketY, cup: true }, // cup in shallow center pocket
    { x: deckMid + pocketHalf * 0.4, y: pocketY }, // gentle slope out
    { x: deckMid + pocketHalf, y: highY }, // flat far rim
    { x: deckEnd, y: highY }, // broad flat deck continues
    { x: endX, y: clampY(highY + 8) }
  ];
},

  // VEIL_PLUME_FIELD: A flat cryo plain studded with a row of tall, needle-thin cryovolcanic jets that
  veil_plume_field(sx, sy, dist, cupY, diff) {
  const endX = sx + dist, base = clampY(Math.min(sy, H * 0.6));
  const pts = [{ x: sx, y: base }];
  // run-up plain before the plume field
  const fieldStart = sx + dist * 0.24;
  pts.push({ x: fieldStart - 30, y: base });
  const nPlumes = 3 + Math.round(diff * 3); // 3..6 jets
  const fieldEnd = sx + dist * 0.6;
  const span = fieldEnd - fieldStart;
  const step = span / nPlumes;
  for (let i = 0; i < nPlumes; i++) {
    const cx = fieldStart + step * (i + 0.5);
    const halfW = lerp(16, 7, diff) + randRange(-2, 2); // narrower at high diff
    const tipY = clampY(base - lerp(70, 150, diff) - randRange(0, 30));
    pts.push({ x: cx - halfW * 1.8, y: base });
    pts.push({ x: cx - halfW, y: clampY(lerp(base, tipY, 0.55)) });
    pts.push({ x: cx, y: tipY });
    pts.push({ x: cx + halfW, y: clampY(lerp(base, tipY, 0.55)) });
    pts.push({ x: cx + halfW * 1.8, y: base });
  }
  // broad calm landing shelf beyond the last plume
  const shelfL = fieldEnd + dist * 0.06;
  const shelfR = endX - 40;
  const cupX = (shelfL + shelfR) * 0.5;
  const dishY = clampY(Math.max(base + 14, Math.min(cupY, base + 28)));
  pts.push({ x: fieldEnd + 12, y: base });
  pts.push({ x: shelfL, y: clampY(base + 4) });
  pts.push({ x: cupX - 70, y: dishY });          // broad gentle shoulder
  pts.push({ x: cupX, y: dishY, cup: true });     // wide flat catch
  pts.push({ x: cupX + 70, y: dishY });
  pts.push({ x: shelfR, y: clampY(base + 4) });
  pts.push({ x: endX, y: base });
  return pts;
},

  // ICE_CRUST_RIFT: The frozen crust has cracked open over the Hollow's sub-ice ocean: a wide chasm 
  ice_crust_rift(sx, sy, dist, cupY, diff) {
  const endX = sx + dist, base = clampY(Math.min(sy, H * 0.58));
  // near ice plain
  const nearLip = sx + dist * lerp(0.34, 0.26, diff);
  // rift (deep water) — widens with diff
  const riftW = dist * lerp(0.18, 0.34, diff);
  const farLip = nearLip + riftW;
  const waterY = clampY(base + lerp(70, 150, diff)); // deep below both shelves
  const nearWallTop = clampY(base + 6);
  // far broad ice shelf, slightly raised, holds the cup
  const shelfY = clampY(Math.min(cupY, base - lerp(0, 18, diff)));
  const shelfStart = farLip + dist * 0.05;
  const cupX = Math.min(endX - 90, shelfStart + dist * 0.16);
  return [
    { x: sx, y: base },
    { x: nearLip - dist * 0.06, y: base },
    { x: nearLip, y: nearWallTop },                         // near edge of rift
    { x: nearLip + riftW * 0.18, y: waterY },               // steep drop to water
    { x: nearLip + riftW * 0.5, y: clampY(waterY + 6) },    // dark water floor
    { x: farLip - riftW * 0.18, y: waterY },
    { x: farLip, y: clampY(base + 4) },                     // far rift edge climbs out
    { x: shelfStart, y: shelfY },                           // onto broad shelf
    { x: cupX - 80, y: shelfY },                            // wide flat approach
    { x: cupX, y: shelfY, cup: true },                      // generous level catch
    { x: cupX + 80, y: clampY(shelfY + 2) },                // gentle far shoulder
    { x: endX - 30, y: clampY(shelfY + 8) },
    { x: endX, y: clampY(shelfY + 10) }
  ];
},

  // ════ COMPLEX_COMPOSITE — the TRUE-complexity spine (P3) ════════════════════════════════════════════
  // The complexity axis used to just swap which single-feature archetype was picked, so a "high complexity"
  // hole could still be one trivial slope. This archetype instead STITCHES several features into one hole,
  // with the FEATURE COUNT, VERTICAL DRAMA, FEATURE VARIETY and HAZARD-DIP frequency all scaling with `diff`.
  // Low diff → 1 gentle feature on a calm baseline (reads like flat_run/gentle_hill). High diff → 4–6 mixed
  // features (humps, plateaus, steps, terraces, ramps) with big elevation swings and occasional gather-dips —
  // genuinely intricate. Always ends on a WIDE flat green (cup sinkable in low gravity); the validator still
  // re-rolls anything unsinkable, so drama never costs completability.
  complex_composite(sx, sy, dist, cupY, diff) {
    const endX = sx + dist;
    const TOP = H * 0.20, BOT = H * 0.88;
    const cl = (y) => Math.max(TOP, Math.min(BOT, y));
    // feature count ramps 1 → ~6 with complexity (the heart of the "simple→intricate" axis)
    const nFeat = Math.max(1, Math.round(1 + diff * 5 + (random() - 0.5)));
    const drama = 34 + diff * 150;                 // per-feature vertical scale (calm → dramatic)
    const greenW = 110 + random() * 50;            // wide flat green at the end (sinkable)
    const playEnd = endX - greenW;
    const span = playEnd - sx;
    const v = [{ x: sx, y: cl(sy) }];
    let x = sx + 18, y = sy;
    // a short flat runway off the tee so the ball never starts trapped on a steep wall
    x += Math.min(span * 0.10, 70); v.push({ x, y: cl(y) });
    const segW = (playEnd - x) / nFeat;
    // feature palette widens with complexity — low diff sticks to gentle kinds, high diff unlocks drama
    for (let i = 0; i < nFeat; i++) {
      const fx0 = x, fx1 = x + segW;
      const r = random();
      const dramaKind = diff > 0.32;
      const wildKind = diff > 0.6;
      let kind;
      if (!dramaKind) kind = r < 0.55 ? 'flat' : (r < 0.8 ? 'slope' : 'hump');
      else if (!wildKind) kind = r < 0.24 ? 'flat' : r < 0.46 ? 'slope' : r < 0.66 ? 'hump' : r < 0.84 ? 'plateau' : 'step';
      else kind = r < 0.12 ? 'flat' : r < 0.28 ? 'slope' : r < 0.44 ? 'hump' : r < 0.6 ? 'plateau' : r < 0.74 ? 'step' : r < 0.88 ? 'terrace' : 'dip';
      if (kind === 'flat') {                               // calm flat (a place the ball can stop)
        x = fx1; v.push({ x, y: cl(y) });
      } else if (kind === 'slope') {                       // straight angular ramp
        const dy = (random() < 0.5 ? -1 : 1) * drama * randRange(0.5, 1.0);
        x = fx1; y = cl(y + dy); v.push({ x, y });
      } else if (kind === 'hump') {                        // a rounded hill or dip to carry/roll over
        const up = (random() < 0.62 ? -1 : 1) * drama * randRange(0.7, 1.2);
        x = fx0 + segW * 0.5; v.push({ x, y: cl(y + up) });
        x = fx1; v.push({ x, y: cl(y) });
      } else if (kind === 'plateau') {                     // up a wall onto a flat-top, back down
        const top = cl(y - drama * randRange(0.8, 1.3));
        x = fx0 + segW * 0.18; v.push({ x, y: top });
        x = fx0 + segW * 0.82; v.push({ x, y: top });
        x = fx1; v.push({ x, y: cl(y) });
      } else if (kind === 'step') {                        // a sharp step up or down to a new level
        const ny = cl(y + (random() < 0.5 ? -1 : 1) * drama * randRange(0.9, 1.4));
        x = fx0 + segW * 0.45; v.push({ x, y: cl(y) });
        x += Math.min(segW * 0.12, 14); v.push({ x, y: ny }); y = ny;
        x = fx1; v.push({ x, y });
      } else if (kind === 'terrace') {                     // 2 little stair-steps (intricate texture)
        const s1 = cl(y + (random() < 0.5 ? -1 : 1) * drama * 0.6);
        x = fx0 + segW * 0.34; v.push({ x, y: cl(y) }); x += 12; v.push({ x, y: s1 }); y = s1;
        const s2 = cl(y + (random() < 0.5 ? -1 : 1) * drama * 0.6);
        x = fx0 + segW * 0.72; v.push({ x, y }); x += 12; v.push({ x, y: s2 }); y = s2;
        x = fx1; v.push({ x, y });
      } else {                                             // dip — a gathering valley (a soft hazard pocket)
        const lo = cl(Math.max(y, H * 0.6) + drama * randRange(0.5, 0.9));
        x = fx0 + segW * 0.22; v.push({ x, y: cl(y) });
        x = fx0 + segW * 0.5; v.push({ x, y: lo });
        x = fx0 + segW * 0.78; v.push({ x, y: lo });
        x = fx1; v.push({ x, y: cl(y) });
      }
    }
    // WIDE flat green into the cup — y settles wherever the last feature left us
    const gy = cl(y);
    v.push({ x: playEnd, y: gy });
    v.push({ x: Math.min(playEnd + greenW * 0.5, endX - 40), y: gy, cup: true });
    v.push({ x: endX, y: gy });
    return v;
  },

  // ════ P4 CAVE / OVERHANG ARCHETYPES ════════════════════════════════════════════════════════════════
  // CUP_UNDER_LIP — the cup sits in a shallow scoop, sheltered under a stone LIP that cantilevers out over
  // it from the BACK. The front (tee side) is wide open, so the ball rolls/lobs down the approach INTO the
  // scoop and settles under the lip. The lip is a solid slab (set-piece) high enough to clear a rolling ball
  // but low enough to read as a roof. Reachable: the cup is on the open heightfield floor; the lip only caps
  // the back half, never the mouth.
  cup_under_lip(sx, sy, dist, cupY, diff) {
    const endX = sx + dist, base = clampY(sy);
    const cx = sx + dist * randRange(0.56, 0.66);                 // scoop centre (cup), past the approach
    const scoopHalf = randRange(70, 95);
    const floorY = clampY(Math.max(base, H * 0.6) + randRange(26, 50) + diff * 20);   // shallow scoop floor (cup)
    const lipY = clampY(floorY - (60 + BALL_RADIUS * 4) - diff * 16);                 // roof height: clear ball roll
    const v = [
      { x: sx, y: base },
      { x: cx - scoopHalf - randRange(40, 70), y: clampY(lerp(base, floorY, 0.5)) },  // approach ramps down
      { x: cx - scoopHalf, y: clampY(floorY - 4) },                                    // mouth lip (open front)
      { x: cx - scoopHalf * 0.4, y: floorY },                                          // into the scoop
      { x: cx, y: floorY, cup: true },                                                 // CUP on the sheltered floor
      { x: cx + scoopHalf * 0.5, y: floorY },
      { x: cx + scoopHalf, y: clampY(floorY - 10) },                                   // back wall rises
      { x: cx + scoopHalf + 16, y: clampY(lipY - 26) },                                // back pillar up to the lip
      { x: endX - 60, y: clampY(lipY - 30) },                                          // high back shelf
      { x: endX, y: clampY(lipY - 30) },
    ];
    // the LIP slab: a flat stone roof cantilevering FORWARD over the back of the scoop (covers cup..back),
    // leaving the front mouth open. Convex quad.
    const lipL = cx - scoopHalf * 0.15, lipR = cx + scoopHalf + 20, lipTh = 16 + diff * 10;
    _emitOverhang([
      { x: lipL, y: lipY },
      { x: lipR, y: lipY },
      { x: lipR, y: lipY + lipTh },
      { x: lipL, y: lipY + lipTh + 6 },          // slightly thicker drooping front edge (reads as a lip)
    ]);
    return v;
  },

  // PUTT_CAVE — a cave you PUTT into: a flat approach runs into a low cave MOUTH; the roof is a long solid
  // slab with a generous ball-clearance gap to the floor, and the cup waits on the flat floor deep inside.
  // The ball rolls in along the floor (a putt) and the roof keeps lobs out, so it rewards the ground game.
  putt_cave(sx, sy, dist, cupY, diff) {
    const endX = sx + dist, base = clampY(sy);
    const floorY = clampY(Math.max(base, H * 0.62));                     // flat cave floor (tee-height-ish)
    const mouthX = sx + dist * randRange(0.42, 0.52);                    // where the cave begins
    const caveEnd = Math.min(mouthX + randRange(190, 260), endX - 70);
    const cupX = lerp(mouthX, caveEnd, 0.62);
    const roofGap = BALL_RADIUS * 4 + 22 + diff * 8;                     // clear gap so a rolling ball fits
    const roofY = clampY(floorY - roofGap);
    const v = [
      { x: sx, y: base },
      { x: mouthX - randRange(50, 80), y: clampY(lerp(base, floorY, 0.6)) },   // approach down to floor level
      { x: mouthX - 20, y: floorY },                                           // flat run into the mouth
      { x: cupX, y: floorY, cup: true },                                       // CUP on the cave floor
      { x: caveEnd, y: floorY },                                               // floor continues (backstop)
      { x: caveEnd + 18, y: clampY(floorY - 30) },                            // far wall rises out of the cave
      { x: endX - 50, y: clampY(roofY - 24) },
      { x: endX, y: clampY(roofY - 24) },
    ];
    // the cave ROOF: a long flat slab over the floor from the mouth to the back wall.
    const rL = mouthX - 8, rR = caveEnd + 8, rTh = 18 + diff * 10;
    _emitOverhang([
      { x: rL, y: clampY(roofY - 14) },          // mouth slightly higher (an inviting opening)
      { x: rR, y: roofY },
      { x: rR, y: roofY + rTh },
      { x: rL, y: clampY(roofY - 14) + rTh },
    ]);
    return v;
  },

  // ARCH_UNDER — a cantilevered ARCH you go UNDER: the floor runs continuous (gentle dip) and a thick stone
  // arch spans over the mid-fairway with headroom; the cup is on the OPEN green past the arch. Tests threading
  // UNDER the overhang (a low, fast shot) vs lobbing over it (which lands long). Reachable: the floor path
  // under the arch is clear to the green.
  arch_under(sx, sy, dist, cupY, diff) {
    const endX = sx + dist, base = clampY(sy);
    const archX = sx + dist * randRange(0.4, 0.5);
    const floorDipY = clampY(Math.max(base, H * 0.58) + randRange(10, 30));   // gentle dip under the arch
    const archSpan = randRange(120, 170);
    const headroom = BALL_RADIUS * 4 + 28 + diff * 6;
    const archY = clampY(floorDipY - headroom);
    const greenStart = archX + archSpan + randRange(50, 90);
    const greenY = clampY(base - diff * 10);
    const cupX = Math.min(greenStart + randRange(70, 130), endX - 60);
    const v = [
      { x: sx, y: base },
      { x: archX - archSpan * 0.5 - 30, y: clampY(lerp(base, floorDipY, 0.7)) },   // down into the dip
      { x: archX, y: floorDipY },                                                  // floor under the arch
      { x: archX + archSpan * 0.5, y: floorDipY },
      { x: archX + archSpan * 0.5 + 30, y: clampY(lerp(floorDipY, greenY, 0.6)) }, // climb out
      { x: greenStart, y: greenY },                                               // onto the open green
      { x: cupX, y: greenY, cup: true },                                          // CUP past the arch
      { x: Math.min(cupX + 80, endX - 20), y: greenY },
      { x: endX, y: clampY(greenY + randRange(0, 20)) },
    ];
    // the ARCH: a thick stone span over the dip, both feet planted (drawn as one convex block; the headroom
    // gap below it is the playable tunnel). Trapezoid wider at the top.
    const aL = archX - archSpan * 0.5 - 10, aR = archX + archSpan * 0.5 + 10, aTh = 26 + diff * 14;
    _emitOverhang([
      { x: aL - 8, y: clampY(archY - aTh) },
      { x: aR + 8, y: clampY(archY - aTh) },
      { x: aR, y: archY },
      { x: aL, y: archY },
    ]);
    return v;
  },


  // ════════ P5: 100+ NEW VISUALLY-DISTINCT HOLE ARCHETYPES ════════════════════════════════════════════
  // Invented across silhouette categories (PEAK_RIDGE / PLATEAU_MESA / BASIN_BOWL / WAVE_ROLLING /
  // GAP_CARRY / STAIR_TERRACE / STRUCTURE / CAVE_OVERHANG / EXOTIC). All are wrapped in _monoArch at
  // registration (X-monotonic) and bot-validated for completability. Category map: P5_ARCHETYPE_CATS.
  // CAT: PEAK_RIDGE — row of jagged rock fins/teeth the ball threads between, cup on flat past the last fin
  jagged_rock_fins(sx, sy, dist, cupY, diff) {
    const endX = sx + dist, base = clampY(sy + 30);
    const v = [{x: sx, y: clampY(sy)}];
    v.push({x: sx + 22, y: base});
    const fins = 4 + Math.round(diff * 4), zone = dist * 0.62, x0 = sx + 40;
    const step = zone / fins;
    for (let i = 0; i < fins; i++) {
      const fx = x0 + i * step;
      const tipH = base - (60 + diff * 130) * (0.6 + 0.4 * random());
      v.push({x: fx + step * 0.18, y: clampY(base - 8)});
      v.push({x: fx + step * 0.42, y: clampY(tipH)});
      v.push({x: fx + step * 0.66, y: clampY(base - 8)});
      v.push({x: fx + step * 0.84, y: clampY(base + 18)});
    }
    const gx = lerp(x0 + zone, endX, 0.6);
    const gy = clampY(base + 14);
    v.push({x: gx - 70, y: gy});
    v.push({x: gx - 40, y: gy});
    v.push({x: gx, y: gy, cup: true});
    v.push({x: gx + 40, y: gy});
    v.push({x: endX, y: gy});
    return v;
  },

  needle_spire_crown(sx, sy, dist, cupY, diff) {
    const endX = sx + dist, base = clampY(sy + 20);
    const v = [{x: sx, y: clampY(sy)}, {x: sx + dist * 0.30, y: base}];
    const cx = sx + dist * 0.52;
    const crownY = clampY(base - (140 + diff * 120));
    v.push({x: cx - 60, y: clampY(base - 20)});
    v.push({x: cx - 22, y: clampY(crownY + 40)});
    v.push({x: cx - 50, y: crownY});
    v.push({x: cx, y: crownY, cup: true});
    v.push({x: cx + 50, y: crownY});
    v.push({x: cx + 22, y: clampY(crownY + 40)});
    v.push({x: cx + 60, y: clampY(base - 20)});
    v.push({x: cx + 110, y: base});
    v.push({x: endX, y: base});
    return v;
  },

  twin_tower_gateway(sx, sy, dist, cupY, diff) {
    const endX = sx + dist, base = clampY(sy + 25);
    const v = [{x: sx, y: clampY(sy)}, {x: sx + dist * 0.18, y: base}];
    const t1 = sx + dist * 0.34, t2 = sx + dist * 0.60;
    const topY = clampY(base - (120 + diff * 110));
    v.push({x: t1 - 26, y: clampY(base - 10)});
    v.push({x: t1 - 22, y: topY});
    v.push({x: t1 + 22, y: topY});
    v.push({x: t1 + 26, y: clampY(base + 10)});
    v.push({x: (t1 + t2) / 2, y: clampY(base + 30)});
    v.push({x: t2 - 26, y: clampY(base + 10)});
    v.push({x: t2 - 22, y: topY});
    v.push({x: t2 + 22, y: topY});
    v.push({x: t2 + 26, y: clampY(base - 10)});
    const gx = lerp(t2 + 40, endX, 0.5), gy = base;
    v.push({x: gx - 50, y: gy});
    v.push({x: gx, y: gy, cup: true});
    v.push({x: gx + 50, y: gy});
    v.push({x: endX, y: gy});
    return v;
  },

  tilted_flatiron(sx, sy, dist, cupY, diff) {
    const endX = sx + dist, base = clampY(sy + 30);
    const v = [{x: sx, y: clampY(sy)}, {x: sx + dist * 0.16, y: base}];
    const rampTop = clampY(base - (120 + diff * 120));
    const r0 = sx + dist * 0.22, r1 = sx + dist * 0.66;
    const segs = 8;
    for (let i = 0; i <= segs; i++) {
      const t = i / segs;
      v.push({x: lerp(r0, r1, t), y: clampY(lerp(base, rampTop, t))});
    }
    const gy = rampTop;
    v.push({x: r1 + 20, y: gy});
    v.push({x: r1 + 60, y: gy});
    v.push({x: r1 + 100, y: gy, cup: true});
    v.push({x: r1 + 140, y: gy});
    v.push({x: endX, y: gy});
    return v;
  },

  stepped_pyramid_notch(sx, sy, dist, cupY, diff) {
    const endX = sx + dist, base = clampY(sy + 30);
    const v = [{x: sx, y: clampY(sy)}, {x: sx + dist * 0.12, y: base}];
    const steps = 3 + Math.round(diff * 2);
    const peakX = sx + dist * 0.50, rise = 50 + diff * 50;
    const upW = (peakX - (sx + dist * 0.16)) / steps;
    let cy = base;
    let x = sx + dist * 0.16;
    for (let i = 0; i < steps; i++) {
      cy = clampY(cy - rise);
      v.push({x: x, y: cy});
      x += upW;
      v.push({x: x, y: cy});
    }
    const ntop = cy;
    v.push({x: peakX - 30, y: ntop});
    v.push({x: peakX - 25, y: clampY(ntop + 36)});
    v.push({x: peakX, y: clampY(ntop + 36), cup: true});
    v.push({x: peakX + 25, y: clampY(ntop + 36)});
    v.push({x: peakX + 30, y: ntop});
    let dx = peakX + 30;
    for (let i = 0; i < steps; i++) {
      v.push({x: dx, y: cy});
      dx += upW;
      cy = clampY(cy + rise);
      v.push({x: dx, y: cy});
    }
    v.push({x: endX, y: base});
    return v;
  },

  layered_cake_butte(sx, sy, dist, cupY, diff) {
    const endX = sx + dist, base = clampY(sy + 30);
    const v = [{x: sx, y: clampY(sy)}, {x: sx + dist * 0.14, y: base}];
    const bands = 3 + Math.round(diff * 2);
    const totRise = 110 + diff * 110;
    const bandRise = totRise / bands;
    const climbW = (dist * 0.46) / bands;
    let cy = base, x = sx + dist * 0.18;
    for (let i = 0; i < bands; i++) {
      cy = clampY(cy - bandRise);
      v.push({x: x, y: cy});
      x += climbW * 0.55;
      v.push({x: x, y: cy});
      x += climbW * 0.45;
    }
    const gy = cy;
    v.push({x: x, y: gy});
    v.push({x: x + 50, y: gy});
    v.push({x: x + 95, y: gy, cup: true});
    v.push({x: x + 140, y: gy});
    v.push({x: endX, y: gy});
    return v;
  },

  anvil_rock(sx, sy, dist, cupY, diff) {
    const endX = sx + dist, base = clampY(sy + 25);
    const v = [{x: sx, y: clampY(sy)}, {x: sx + dist * 0.28, y: base}];
    const cx = sx + dist * 0.54;
    const neckY = clampY(base - 50);
    const topY = clampY(base - (130 + diff * 110));
    v.push({x: cx - 24, y: neckY});
    v.push({x: cx - 30, y: topY});
    v.push({x: cx - 60, y: topY});
    v.push({x: cx, y: topY, cup: true});
    v.push({x: cx + 60, y: topY});
    v.push({x: cx + 30, y: topY});
    v.push({x: cx + 24, y: neckY});
    v.push({x: cx + 40, y: base});
    v.push({x: endX, y: base});
    return v;
  },

  domed_knoll_cluster(sx, sy, dist, cupY, diff) {
    const endX = sx + dist, base = clampY(sy + 20);
    const v = [{x: sx, y: clampY(sy)}];
    const knolls = 3 + Math.round(diff * 2);
    const zone = dist * 0.70, w = zone / knolls;
    for (let k = 0; k < knolls; k++) {
      const kx = sx + 30 + k * w;
      const h = (40 + diff * 70) * (0.7 + 0.3 * random());
      const segs = 10;
      for (let i = 0; i <= segs; i++) {
        const t = i / segs;
        const yy = base - h * Math.sin(Math.PI * t);
        v.push({x: kx + w * t, y: clampY(yy)});
      }
    }
    const gx = lerp(sx + 30 + zone, endX, 0.5), gy = base;
    v.push({x: gx - 50, y: gy});
    v.push({x: gx, y: gy, cup: true});
    v.push({x: gx + 50, y: gy});
    v.push({x: endX, y: gy});
    return v;
  },

  table_mountain_saddle(sx, sy, dist, cupY, diff) {
    const endX = sx + dist, base = clampY(sy + 30);
    const v = [{x: sx, y: clampY(sy)}, {x: sx + dist * 0.10, y: base}];
    const topY = clampY(base - (120 + diff * 100));
    const l = sx + dist * 0.18, r = sx + dist * 0.82;
    v.push({x: l + 18, y: topY});
    v.push({x: l + 60, y: topY});
    const cx = (l + r) / 2;
    const saddleY = clampY(topY + 30);
    v.push({x: cx - 70, y: clampY(topY + 6)});
    v.push({x: cx - 45, y: saddleY});
    v.push({x: cx, y: saddleY, cup: true});
    v.push({x: cx + 45, y: saddleY});
    v.push({x: cx + 70, y: clampY(topY + 6)});
    v.push({x: r - 60, y: topY});
    v.push({x: r - 18, y: topY});
    v.push({x: r, y: base});
    v.push({x: endX, y: base});
    return v;
  },

  serrated_comb(sx, sy, dist, cupY, diff) {
    const endX = sx + dist, base = clampY(sy + 25);
    const v = [{x: sx, y: clampY(sy)}, {x: sx + 24, y: base}];
    const teeth = 6 + Math.round(diff * 6), zone = dist * 0.58, x0 = sx + 40;
    const w = zone / teeth, h = 40 + diff * 70;
    for (let i = 0; i < teeth; i++) {
      const tx = x0 + i * w;
      v.push({x: tx + w * 0.5, y: clampY(base - h)});
      v.push({x: tx + w, y: clampY(base)});
    }
    const gx = lerp(x0 + zone, endX, 0.55), gy = base;
    v.push({x: gx - 60, y: gy});
    v.push({x: gx, y: gy, cup: true});
    v.push({x: gx + 60, y: gy});
    v.push({x: endX, y: gy});
    return v;
  },

  leaning_tower(sx, sy, dist, cupY, diff) {
    const endX = sx + dist, base = clampY(sy + 25);
    const v = [{x: sx, y: clampY(sy)}, {x: sx + dist * 0.30, y: base}];
    const bx = sx + dist * 0.46;
    const lean = 50 + diff * 40;
    const topY = clampY(base - (140 + diff * 110));
    v.push({x: bx, y: clampY(base - 20)});
    v.push({x: bx + lean * 0.5, y: clampY(base - 90)});
    v.push({x: bx + lean, y: clampY(topY + 30)});
    v.push({x: bx + lean - 4, y: topY});
    v.push({x: bx + lean + 44, y: topY, cup: true});
    v.push({x: bx + lean + 90, y: topY});
    v.push({x: bx + lean + 100, y: clampY(base - 60)});
    v.push({x: bx + lean + 120, y: base});
    v.push({x: endX, y: base});
    return v;
  },

  crouching_sphinx(sx, sy, dist, cupY, diff) {
    const endX = sx + dist, base = clampY(sy + 25);
    const v = [{x: sx, y: clampY(sy)}, {x: sx + dist * 0.14, y: base}];
    const headX = sx + dist * 0.30;
    const headY = clampY(base - (110 + diff * 90));
    v.push({x: headX - 30, y: clampY(base - 30)});
    v.push({x: headX, y: headY});
    v.push({x: headX + 30, y: clampY(headY + 26)});
    const backY = clampY(base - 40);
    v.push({x: headX + 70, y: backY});
    const cx = sx + dist * 0.62;
    v.push({x: cx - 50, y: backY});
    v.push({x: cx, y: backY, cup: true});
    v.push({x: cx + 50, y: backY});
    v.push({x: cx + 110, y: clampY(base - 70)});
    v.push({x: cx + 150, y: base});
    v.push({x: endX, y: base});
    return v;
  },

  radiating_ridge_fan(sx, sy, dist, cupY, diff) {
    const endX = sx + dist, base = clampY(sy + 25);
    const v = [{x: sx, y: clampY(sy)}, {x: sx + 24, y: base}];
    const ridges = 5 + Math.round(diff * 3), zone = dist * 0.60, x0 = sx + 40;
    const w = zone / ridges;
    for (let i = 0; i < ridges; i++) {
      const t = i / (ridges - 1);
      const h = (50 + diff * 110) * Math.sin(Math.PI * (0.25 + 0.75 * (1 - Math.abs(t - 0.5) * 2)));
      const rx = x0 + i * w;
      v.push({x: rx + w * 0.45, y: clampY(base - Math.max(20, h))});
      v.push({x: rx + w * 0.9, y: clampY(base - 6)});
    }
    const gx = lerp(x0 + zone, endX, 0.5), gy = base;
    v.push({x: gx - 55, y: gy});
    v.push({x: gx, y: gy, cup: true});
    v.push({x: gx + 55, y: gy});
    v.push({x: endX, y: gy});
    return v;
  },

  castle_battlement(sx, sy, dist, cupY, diff) {
    const endX = sx + dist, base = clampY(sy + 25);
    const v = [{x: sx, y: clampY(sy)}, {x: sx + dist * 0.10, y: base}];
    const wallX = sx + dist * 0.18;
    const topY = clampY(base - (110 + diff * 90));
    v.push({x: wallX, y: topY});
    const merlons = 4 + Math.round(diff * 3);
    const wzone = dist * 0.40, w = wzone / merlons;
    let x = wallX;
    for (let i = 0; i < merlons; i++) {
      v.push({x: x, y: topY});
      v.push({x: x + w * 0.5, y: topY});
      v.push({x: x + w * 0.5, y: clampY(topY + 28)});
      v.push({x: x + w, y: clampY(topY + 28)});
      v.push({x: x + w, y: topY});
      x += w;
    }
    const gy = clampY(base - 20);
    v.push({x: x + 6, y: clampY(topY + 50)});
    v.push({x: x + 30, y: gy});
    const cx = lerp(x + 30, endX, 0.5);
    v.push({x: cx - 50, y: gy});
    v.push({x: cx, y: gy, cup: true});
    v.push({x: cx + 50, y: gy});
    v.push({x: endX, y: gy});
    return v;
  },

  hoodoo_field(sx, sy, dist, cupY, diff) {
    const endX = sx + dist, base = clampY(sy + 25);
    const v = [{x: sx, y: clampY(sy)}, {x: sx + 26, y: base}];
    const hoodoos = 3 + Math.round(diff * 3), zone = dist * 0.62, x0 = sx + 45;
    const w = zone / hoodoos;
    for (let i = 0; i < hoodoos; i++) {
      const hx = x0 + i * w + w * 0.5;
      const capY = clampY(base - (90 + diff * 110) * (0.7 + 0.3 * random()));
      v.push({x: hx - 22, y: clampY(base - 10)});
      v.push({x: hx - 10, y: clampY(capY + 40)});
      v.push({x: hx - 20, y: capY});
      v.push({x: hx + 20, y: capY});
      v.push({x: hx + 10, y: clampY(capY + 40)});
      v.push({x: hx + 22, y: clampY(base - 10)});
      v.push({x: hx + 30, y: base});
    }
    const gx = lerp(x0 + zone, endX, 0.5), gy = base;
    v.push({x: gx - 55, y: gy});
    v.push({x: gx, y: gy, cup: true});
    v.push({x: gx + 55, y: gy});
    v.push({x: endX, y: gy});
    return v;
  },

  cathedral_spires(sx, sy, dist, cupY, diff) {
    const endX = sx + dist, base = clampY(sy + 25);
    const v = [{x: sx, y: clampY(sy)}, {x: sx + dist * 0.12, y: base}];
    const spires = 4, zone = dist * 0.50, x0 = sx + dist * 0.16;
    const w = zone / spires;
    const heights = [0.6, 1.0, 1.0, 0.6];
    for (let i = 0; i < spires; i++) {
      const sxp = x0 + i * w;
      const h = (130 + diff * 110) * heights[i];
      v.push({x: sxp + w * 0.2, y: clampY(base - 10)});
      v.push({x: sxp + w * 0.5, y: clampY(base - h)});
      v.push({x: sxp + w * 0.8, y: clampY(base - 10)});
    }
    const gy = clampY(base + 10);
    const cx = lerp(x0 + zone + 20, endX, 0.5);
    v.push({x: x0 + zone + 10, y: gy});
    v.push({x: cx - 55, y: gy});
    v.push({x: cx, y: gy, cup: true});
    v.push({x: cx + 55, y: gy});
    v.push({x: endX, y: gy});
    return v;
  },

  shark_fin_ridge(sx, sy, dist, cupY, diff) {
    const endX = sx + dist, base = clampY(sy + 25);
    const v = [{x: sx, y: clampY(sy)}, {x: sx + dist * 0.18, y: base}];
    const tipX = sx + dist * 0.50;
    const tipY = clampY(base - (150 + diff * 120));
    const segs = 7;
    for (let i = 1; i <= segs; i++) {
      const t = i / segs;
      v.push({x: lerp(sx + dist * 0.18, tipX, t), y: clampY(lerp(base, tipY, t))});
    }
    v.push({x: tipX + 24, y: clampY(base - 30)});
    v.push({x: tipX + 40, y: base});
    const gx = lerp(tipX + 40, endX, 0.55), gy = base;
    v.push({x: gx - 55, y: gy});
    v.push({x: gx, y: gy, cup: true});
    v.push({x: gx + 55, y: gy});
    v.push({x: endX, y: gy});
    return v;
  },

  double_decker_mesa(sx, sy, dist, cupY, diff) {
    const endX = sx + dist, base = clampY(sy + 30);
    const v = [{x: sx, y: clampY(sy)}, {x: sx + dist * 0.12, y: base}];
    const lowY = clampY(base - (80 + diff * 50));
    const l = sx + dist * 0.18;
    v.push({x: l + 18, y: lowY});
    v.push({x: l + 70, y: lowY});
    const upY = clampY(lowY - (70 + diff * 60));
    const u = l + 110;
    v.push({x: u + 16, y: upY});
    v.push({x: u + 50, y: upY});
    v.push({x: u + 95, y: upY, cup: true});
    v.push({x: u + 140, y: upY});
    v.push({x: u + 156, y: lowY});
    v.push({x: u + 200, y: lowY});
    v.push({x: u + 216, y: base});
    v.push({x: endX, y: base});
    return v;
  },

  matterhorn_col(sx, sy, dist, cupY, diff) {
    const endX = sx + dist, base = clampY(sy + 25);
    const v = [{x: sx, y: clampY(sy)}, {x: sx + dist * 0.16, y: base}];
    const peakX = sx + dist * 0.40;
    const peakY = clampY(base - (170 + diff * 120));
    v.push({x: peakX - 60, y: clampY(base - 50)});
    v.push({x: peakX, y: peakY});
    v.push({x: peakX + 55, y: clampY(base - 70)});
    const colY = clampY(base - 55);
    const cx = sx + dist * 0.66;
    v.push({x: cx - 50, y: colY});
    v.push({x: cx, y: colY, cup: true});
    v.push({x: cx + 50, y: colY});
    v.push({x: cx + 90, y: clampY(base - 100)});
    v.push({x: cx + 120, y: base});
    v.push({x: endX, y: base});
    return v;
  },

  slot_mesa_pocket(sx, sy, dist, cupY, diff) {
    const endX = sx + dist, base = clampY(sy + 30);
    const v = [{x: sx, y: clampY(sy)}, {x: sx + dist * 0.12, y: base}];
    const topY = clampY(base - (120 + diff * 90));
    const l = sx + dist * 0.18;
    v.push({x: l + 18, y: topY});
    const slotX = sx + dist * 0.50;
    v.push({x: slotX - 40, y: topY});
    const pocketY = clampY(topY + (60 + diff * 30));
    v.push({x: slotX - 30, y: pocketY});
    v.push({x: slotX - 28, y: pocketY});
    v.push({x: slotX, y: pocketY, cup: true});
    v.push({x: slotX + 28, y: pocketY});
    v.push({x: slotX + 30, y: pocketY});
    v.push({x: slotX + 40, y: topY});
    const r = sx + dist * 0.84;
    v.push({x: r, y: topY});
    v.push({x: r + 18, y: base});
    v.push({x: endX, y: base});
    return v;
  },

  ascending_peak_stair(sx, sy, dist, cupY, diff) {
    const endX = sx + dist, base = clampY(sy + 25);
    const v = [{x: sx, y: clampY(sy)}, {x: sx + 26, y: base}];
    const peaks = 3 + Math.round(diff * 2), zone = dist * 0.62, x0 = sx + 45;
    const w = zone / peaks;
    let valley = base;
    for (let i = 0; i < peaks; i++) {
      const px = x0 + i * w;
      const h = (60 + diff * 70) * (1 + i * 0.45);
      v.push({x: px + w * 0.5, y: clampY(base - h)});
      valley = clampY(base - h * 0.35);
      v.push({x: px + w * 0.9, y: valley});
    }
    const gy = valley;
    const gx = x0 + zone + 30;
    v.push({x: gx - 20, y: gy});
    v.push({x: gx + 25, y: gy, cup: true});
    v.push({x: gx + 70, y: gy});
    v.push({x: endX, y: gy});
    return v;
  },

  undercut_mesa(sx, sy, dist, cupY, diff) {
    const endX = sx + dist, base = clampY(sy + 30);
    const v = [{x: sx, y: clampY(sy)}, {x: sx + dist * 0.20, y: base}];
    const topY = clampY(base - (130 + diff * 90));
    const l = sx + dist * 0.30;
    v.push({x: l, y: clampY(base - 30)});
    v.push({x: l + 10, y: clampY(base - 90)});
    v.push({x: l + 26, y: topY});
    v.push({x: l + 60, y: topY});
    const cx = lerp(l + 60, sx + dist * 0.86, 0.5);
    v.push({x: cx - 45, y: topY});
    v.push({x: cx, y: topY, cup: true});
    v.push({x: cx + 45, y: topY});
    const r = sx + dist * 0.86;
    v.push({x: r, y: topY});
    v.push({x: r + 18, y: clampY(base - 40)});
    v.push({x: r + 40, y: base});
    v.push({x: endX, y: base});
    return v;
  },

  molar_ridge(sx, sy, dist, cupY, diff) {
    const endX = sx + dist, base = clampY(sy + 25);
    const v = [{x: sx, y: clampY(sy)}, {x: sx + dist * 0.10, y: base}];
    const h = 90 + diff * 90;
    const m1 = sx + dist * 0.28, m2 = sx + dist * 0.62;
    const segs = 8;
    for (let i = 0; i <= segs; i++) {
      const t = i / segs;
      v.push({x: lerp(m1 - 40, m1 + 40, t), y: clampY(base - h * Math.sin(Math.PI * t))});
    }
    const cx = (m1 + m2) / 2;
    const gy = clampY(base - 14);
    v.push({x: cx - 50, y: gy});
    v.push({x: cx, y: gy, cup: true});
    v.push({x: cx + 50, y: gy});
    for (let i = 0; i <= segs; i++) {
      const t = i / segs;
      v.push({x: lerp(m2 - 40, m2 + 40, t), y: clampY(base - h * Math.sin(Math.PI * t))});
    }
    v.push({x: endX, y: base});
    return v;
  },

  wedge_ramp_mesa(sx, sy, dist, cupY, diff) {
    const endX = sx + dist, base = clampY(sy + 30);
    const v = [{x: sx, y: clampY(sy)}];
    const topY = clampY(base - (130 + diff * 110));
    const r0 = sx + dist * 0.06, r1 = sx + dist * 0.70;
    const segs = 12;
    v.push({x: r0, y: base});
    for (let i = 1; i <= segs; i++) {
      const t = i / segs;
      v.push({x: lerp(r0, r1, t), y: clampY(lerp(base, topY, t))});
    }
    const gy = topY;
    v.push({x: r1 + 20, y: gy});
    v.push({x: r1 + 65, y: gy});
    v.push({x: r1 + 110, y: gy, cup: true});
    v.push({x: r1 + 155, y: gy});
    v.push({x: endX, y: gy});
    return v;
  },

  knife_edge_arete(sx, sy, dist, cupY, diff) {
    const endX = sx + dist, base = clampY(sy + 25);
    const v = [{x: sx, y: clampY(sy)}, {x: sx + dist * 0.10, y: base}];
    const teeth = 4 + Math.round(diff * 3), zone = dist * 0.55, x0 = sx + dist * 0.14;
    const w = zone / teeth;
    for (let i = 0; i < teeth; i++) {
      const tx = x0 + i * w;
      const climb = (i + 1) / teeth;
      const hi = clampY(base - (60 + diff * 130) * climb);
      const lo = clampY(base - (30 + diff * 90) * climb);
      v.push({x: tx + w * 0.5, y: hi});
      v.push({x: tx + w, y: lo});
    }
    const capY = clampY(base - (90 + diff * 140));
    const gx = x0 + zone + 24;
    v.push({x: gx, y: capY});
    v.push({x: gx + 40, y: capY, cup: true});
    v.push({x: gx + 84, y: capY});
    v.push({x: endX, y: capY});
    return v;
  },

  split_mesa_chasm(sx, sy, dist, cupY, diff) {
    const endX = sx + dist, base = clampY(sy + 30);
    const v = [{x: sx, y: clampY(sy)}, {x: sx + dist * 0.12, y: base}];
    const topY = clampY(base - (120 + diff * 90));
    const l = sx + dist * 0.18;
    v.push({x: l + 18, y: topY});
    const chasmX = sx + dist * 0.46;
    v.push({x: chasmX - 30, y: topY});
    v.push({x: chasmX - 18, y: clampY(base + 30)});
    v.push({x: chasmX + 18, y: clampY(base + 30)});
    v.push({x: chasmX + 30, y: topY});
    v.push({x: chasmX + 64, y: topY});
    const cx = lerp(chasmX + 64, sx + dist * 0.86, 0.5);
    v.push({x: cx - 45, y: topY});
    v.push({x: cx, y: topY, cup: true});
    v.push({x: cx + 45, y: topY});
    v.push({x: sx + dist * 0.86, y: topY});
    v.push({x: sx + dist * 0.86 + 18, y: base});
    v.push({x: endX, y: base});
    return v;
  },

  volcano_crater_cup(sx, sy, dist, cupY, diff) {
    const endX = sx + dist, base = clampY(sy + 25);
    const v = [{x: sx, y: clampY(sy)}, {x: sx + dist * 0.16, y: base}];
    const cx = sx + dist * 0.50;
    const rimY = clampY(base - (140 + diff * 110));
    v.push({x: cx - 90, y: clampY(base - 40)});
    v.push({x: cx - 50, y: rimY});
    const floorY = clampY(rimY + (55 + diff * 30));
    v.push({x: cx - 42, y: floorY});
    v.push({x: cx - 38, y: floorY});
    v.push({x: cx, y: floorY, cup: true});
    v.push({x: cx + 38, y: floorY});
    v.push({x: cx + 42, y: floorY});
    v.push({x: cx + 50, y: rimY});
    v.push({x: cx + 90, y: clampY(base - 40)});
    v.push({x: cx + 130, y: base});
    v.push({x: endX, y: base});
    return v;
  },
  halfpipe_gather(sx, sy, dist, cupY, diff) {
    const endX = sx + dist, base = clampY(sy);
    const depth = 70 + diff * 120;
    const cx = sx + dist * 0.5;
    const v = [{ x: sx, y: base }];
    for (let x = sx; x <= cx - 50; x += 12) {
      const t = (x - sx) / (cx - 50 - sx);
      const y = base + depth * (1 - Math.cos(t * Math.PI / 2));
      v.push({ x, y: clampY(y) });
    }
    const gy = clampY(base + depth);
    v.push({ x: cx - 50, y: gy });
    v.push({ x: cx - 40, y: gy });
    v.push({ x: cx, y: gy, cup: true });
    v.push({ x: cx + 40, y: gy });
    v.push({ x: cx + 50, y: gy });
    for (let x = cx + 50; x <= endX; x += 12) {
      const t = (x - (cx + 50)) / (endX - (cx + 50));
      const y = base + depth * Math.cos(t * Math.PI / 2);
      v.push({ x, y: clampY(y) });
    }
    return v;
  },

  horseshoe_bay(sx, sy, dist, cupY, diff) {
    const endX = sx + dist, base = clampY(sy);
    const depth = 80 + diff * 110;
    const cx = sx + dist * 0.55;
    const v = [{ x: sx, y: base }];
    for (let x = sx; x <= cx - 55; x += 12) {
      const t = (x - sx) / (cx - 55 - sx);
      const y = base + depth * (t * t);
      v.push({ x, y: clampY(y) });
    }
    const gy = clampY(base + depth);
    v.push({ x: cx - 55, y: gy });
    v.push({ x: cx - 45, y: gy });
    v.push({ x: cx, y: gy, cup: true });
    v.push({ x: cx + 45, y: gy });
    v.push({ x: cx + 55, y: gy });
    const rimY = clampY(base - 30);
    for (let x = cx + 55; x <= cx + 130; x += 14) {
      const t = (x - (cx + 55)) / 75;
      v.push({ x, y: clampY(base + depth - (depth + 30) * (t * t)) });
    }
    v.push({ x: cx + 130, y: rimY });
    v.push({ x: endX, y: rimY });
    return v;
  },

  double_bowl_saddle(sx, sy, dist, cupY, diff) {
    const endX = sx + dist, base = clampY(sy);
    const d1 = 90 + diff * 110, d2 = 55 + diff * 80;
    const saddleY = clampY(base + 25);
    const c1 = sx + dist * 0.28, c2 = sx + dist * 0.72;
    const v = [{ x: sx, y: base }];
    for (let x = sx; x <= c1 - 50; x += 12) {
      const t = (x - sx) / (c1 - 50 - sx);
      v.push({ x, y: clampY(base + d1 * (1 - Math.cos(t * Math.PI / 2))) });
    }
    const gy = clampY(base + d1);
    v.push({ x: c1 - 50, y: gy });
    v.push({ x: c1 - 40, y: gy });
    v.push({ x: c1, y: gy, cup: true });
    v.push({ x: c1 + 40, y: gy });
    v.push({ x: c1 + 50, y: gy });
    const sx2 = (c1 + c2) / 2;
    for (let x = c1 + 50; x <= sx2; x += 12) {
      const t = (x - (c1 + 50)) / (sx2 - (c1 + 50));
      v.push({ x, y: clampY(base + d1 + (saddleY - (base + d1)) * t) });
    }
    for (let x = sx2; x <= c2; x += 12) {
      const t = (x - sx2) / (c2 - sx2);
      v.push({ x, y: clampY(lerp(saddleY, base + d2, 1 - Math.cos(t * Math.PI / 2))) });
    }
    for (let x = c2; x <= endX; x += 12) {
      const t = (x - c2) / (endX - c2);
      v.push({ x, y: clampY(lerp(base + d2, base, Math.sin(t * Math.PI / 2))) });
    }
    return v;
  },

  shallow_saucer_pin(sx, sy, dist, cupY, diff) {
    const endX = sx + dist, base = clampY(sy);
    const depth = 35 + diff * 55;
    const cx = sx + dist * 0.5;
    const v = [{ x: sx, y: base }];
    for (let x = sx; x <= cx - 60; x += 12) {
      const t = (x - sx) / (cx - 60 - sx);
      v.push({ x, y: clampY(base + depth * (t * t * (3 - 2 * t))) });
    }
    const gy = clampY(base + depth);
    v.push({ x: cx - 60, y: gy });
    v.push({ x: cx - 50, y: gy });
    v.push({ x: cx, y: gy, cup: true });
    v.push({ x: cx + 50, y: gy });
    v.push({ x: cx + 60, y: gy });
    for (let x = cx + 60; x <= endX; x += 12) {
      const t = (x - (cx + 60)) / (endX - (cx + 60));
      v.push({ x, y: clampY(base + depth * (1 - (t * t * (3 - 2 * t)))) });
    }
    return v;
  },

  teacup_saucer(sx, sy, dist, cupY, diff) {
    const endX = sx + dist, base = clampY(sy);
    const saucer = 30 + diff * 35, cup = 70 + diff * 90;
    const cx = sx + dist * 0.5;
    const v = [{ x: sx, y: base }];
    for (let x = sx; x <= cx - 110; x += 13) {
      const t = (x - sx) / (cx - 110 - sx);
      v.push({ x, y: clampY(base + saucer * (t * t * (3 - 2 * t))) });
    }
    const sLevel = clampY(base + saucer);
    v.push({ x: cx - 110, y: sLevel });
    v.push({ x: cx - 95, y: sLevel });
    for (let x = cx - 95; x <= cx - 45; x += 12) {
      const t = (x - (cx - 95)) / 50;
      v.push({ x, y: clampY(base + saucer + (cup - saucer) * t) });
    }
    const gy = clampY(base + cup);
    v.push({ x: cx - 45, y: gy });
    v.push({ x: cx, y: gy, cup: true });
    v.push({ x: cx + 45, y: gy });
    for (let x = cx + 45; x <= cx + 95; x += 12) {
      const t = (x - (cx + 45)) / 50;
      v.push({ x, y: clampY(base + cup - (cup - saucer) * t) });
    }
    v.push({ x: cx + 95, y: sLevel });
    v.push({ x: cx + 110, y: sLevel });
    for (let x = cx + 110; x <= endX; x += 13) {
      const t = (x - (cx + 110)) / (endX - (cx + 110));
      v.push({ x, y: clampY(base + saucer * (1 - t * t * (3 - 2 * t))) });
    }
    return v;
  },

  kettle_pond(sx, sy, dist, cupY, diff) {
    const endX = sx + dist, base = clampY(sy);
    const depth = 95 + diff * 105;
    const cx = sx + dist * 0.5;
    const v = [{ x: sx, y: base }];
    for (let x = sx; x <= cx - 95; x += 14) v.push({ x, y: base });
    for (let x = cx - 95; x <= cx - 50; x += 11) {
      const t = (x - (cx - 95)) / 45;
      v.push({ x, y: clampY(base + depth * Math.sin(t * Math.PI / 2)) });
    }
    const gy = clampY(base + depth);
    v.push({ x: cx - 50, y: gy });
    v.push({ x: cx, y: gy, cup: true });
    v.push({ x: cx + 50, y: gy });
    for (let x = cx + 50; x <= cx + 95; x += 11) {
      const t = (x - (cx + 50)) / 45;
      v.push({ x, y: clampY(base + depth * Math.cos(t * Math.PI / 2)) });
    }
    for (let x = cx + 95; x <= endX; x += 14) v.push({ x, y: base });
    return v;
  },

  sine_swell_run(sx, sy, dist, cupY, diff) {
    const endX = sx + dist, base = clampY(sy);
    const amp = 25 + diff * 50, waves = 3;
    const greenStart = sx + dist * 0.78;
    const v = [{ x: sx, y: base }];
    for (let x = sx; x <= greenStart; x += 12) {
      const t = (x - sx) / (greenStart - sx);
      const y = base + amp * Math.sin(t * waves * Math.PI * 2) + 30 * t;
      v.push({ x, y: clampY(y) });
    }
    const gy = clampY(base + 30);
    v.push({ x: greenStart, y: gy });
    v.push({ x: greenStart + 40, y: gy });
    v.push({ x: (greenStart + endX) / 2, y: gy, cup: true });
    v.push({ x: endX - 40, y: gy });
    v.push({ x: endX, y: gy });
    return v;
  },

  washboard_humps(sx, sy, dist, cupY, diff) {
    const endX = sx + dist, base = clampY(sy);
    const amp = 14 + diff * 26, humps = 8;
    const greenStart = sx + dist * 0.82;
    const v = [{ x: sx, y: base }];
    for (let x = sx; x <= greenStart; x += 10) {
      const t = (x - sx) / (greenStart - sx);
      const y = base + amp * (1 - Math.cos(t * humps * Math.PI * 2)) / 2 + 40 * t;
      v.push({ x, y: clampY(y) });
    }
    const gy = clampY(base + 40);
    v.push({ x: greenStart, y: gy });
    v.push({ x: greenStart + 40, y: gy });
    v.push({ x: (greenStart + endX) / 2, y: gy, cup: true });
    v.push({ x: endX - 40, y: gy });
    v.push({ x: endX, y: gy });
    return v;
  },

  smooth_s_curve(sx, sy, dist, cupY, diff) {
    const endX = sx + dist, base = clampY(sy);
    const amp = 40 + diff * 70;
    const greenStart = sx + dist * 0.8;
    const v = [{ x: sx, y: base }];
    for (let x = sx; x <= greenStart; x += 12) {
      const t = (x - sx) / (greenStart - sx);
      const y = base + amp * Math.sin(t * Math.PI * 1.5) * (1 - t) + 50 * t;
      v.push({ x, y: clampY(y) });
    }
    const gy = clampY(base + 50);
    v.push({ x: greenStart, y: gy });
    v.push({ x: greenStart + 40, y: gy });
    v.push({ x: (greenStart + endX) / 2, y: gy, cup: true });
    v.push({ x: endX - 40, y: gy });
    v.push({ x: endX, y: gy });
    return v;
  },

  amphitheater_hollow(sx, sy, dist, cupY, diff) {
    const endX = sx + dist, base = clampY(sy);
    const depth = 100 + diff * 110;
    const cx = sx + dist * 0.6;
    const v = [{ x: sx, y: base }];
    for (let x = sx; x <= cx - 55; x += 12) {
      const t = (x - sx) / (cx - 55 - sx);
      v.push({ x, y: clampY(base + depth * Math.pow(t, 1.6)) });
    }
    const gy = clampY(base + depth);
    v.push({ x: cx - 55, y: gy });
    v.push({ x: cx - 45, y: gy });
    v.push({ x: cx, y: gy, cup: true });
    v.push({ x: cx + 45, y: gy });
    v.push({ x: cx + 55, y: gy });
    for (let x = cx + 55; x <= endX; x += 12) {
      const t = (x - (cx + 55)) / (endX - (cx + 55));
      v.push({ x, y: clampY(base + depth * (1 - Math.pow(t, 1.4))) });
    }
    return v;
  },

  cloverleaf_bowls(sx, sy, dist, cupY, diff) {
    const endX = sx + dist, base = clampY(sy);
    const d = 45 + diff * 60, dc = 75 + diff * 95;
    const lobes = [sx + dist * 0.22, sx + dist * 0.5, sx + dist * 0.78];
    const ridge = clampY(base + 18);
    const v = [{ x: sx, y: base }];
    const scoop = (xa, xb, depth, centerCup) => {
      for (let x = xa; x <= (xa + xb) / 2 - (centerCup ? 50 : 0); x += 12) {
        const t = (x - xa) / ((xb - xa) / 2);
        v.push({ x, y: clampY(lerp(ridge, base + depth, Math.sin(Math.min(t, 1) * Math.PI / 2))) });
      }
      const gy = clampY(base + depth);
      const mid = (xa + xb) / 2;
      if (centerCup) {
        v.push({ x: mid - 50, y: gy });
        v.push({ x: mid, y: gy, cup: true });
        v.push({ x: mid + 50, y: gy });
      } else {
        v.push({ x: mid, y: gy });
      }
      for (let x = mid + (centerCup ? 50 : 12); x <= xb; x += 12) {
        const t = (x - mid) / ((xb - xa) / 2);
        v.push({ x, y: clampY(lerp(base + depth, ridge, Math.sin(Math.min(t, 1) * Math.PI / 2))) });
      }
    };
    scoop(sx, lobes[1] - 40, d, false);
    scoop(lobes[1] - 40, lobes[2] - 40, dc, true);
    scoop(lobes[2] - 40, endX, d, false);
    return v;
  },

  spiral_gather(sx, sy, dist, cupY, diff) {
    const endX = sx + dist, base = clampY(sy);
    const cx = sx + dist * 0.5;
    const depth = 90 + diff * 100;
    const v = [{ x: sx, y: base }];
    const steps = 5;
    for (let i = 0; i < steps; i++) {
      const xa = sx + (cx - 55 - sx) * (i / steps);
      const xb = sx + (cx - 55 - sx) * ((i + 1) / steps);
      const ya = clampY(base + depth * (i / steps));
      const yb = clampY(base + depth * ((i + 1) / steps));
      for (let x = xa; x <= xb; x += 12) {
        const t = (x - xa) / (xb - xa);
        v.push({ x, y: clampY(lerp(ya, yb, t) + Math.sin(t * Math.PI) * 8 * (1 - i / steps)) });
      }
    }
    const gy = clampY(base + depth);
    v.push({ x: cx - 55, y: gy });
    v.push({ x: cx, y: gy, cup: true });
    v.push({ x: cx + 55, y: gy });
    for (let x = cx + 55; x <= endX; x += 13) {
      const t = (x - (cx + 55)) / (endX - (cx + 55));
      v.push({ x, y: clampY(base + depth * (1 - Math.sin(t * Math.PI / 2))) });
    }
    return v;
  },

  quilted_dunes(sx, sy, dist, cupY, diff) {
    const endX = sx + dist, base = clampY(sy);
    const greenStart = sx + dist * 0.8;
    const v = [{ x: sx, y: base }];
    for (let x = sx; x <= greenStart; x += 11) {
      const t = (x - sx) / (greenStart - sx);
      const y = base
        + (18 + diff * 22) * Math.sin(t * Math.PI * 2 * 2.5)
        + (10 + diff * 14) * Math.sin(t * Math.PI * 2 * 5.5 + 1.3);
      v.push({ x, y: clampY(y) });
    }
    const gy = clampY(base);
    v.push({ x: greenStart, y: gy });
    v.push({ x: greenStart + 40, y: gy });
    v.push({ x: (greenStart + endX) / 2, y: gy, cup: true });
    v.push({ x: endX - 40, y: gy });
    v.push({ x: endX, y: gy });
    return v;
  },

  bermed_basin(sx, sy, dist, cupY, diff) {
    const endX = sx + dist, base = clampY(sy);
    const depth = 80 + diff * 100, berm = 25 + diff * 25;
    const cx = sx + dist * 0.5;
    const bermY = clampY(base - berm);
    const v = [{ x: sx, y: base }];
    for (let x = sx; x <= sx + 60; x += 14) {
      const t = (x - sx) / 60;
      v.push({ x, y: clampY(base - berm * Math.sin(t * Math.PI / 2)) });
    }
    v.push({ x: sx + 60, y: bermY });
    for (let x = sx + 60; x <= cx - 55; x += 12) {
      const t = (x - (sx + 60)) / (cx - 55 - (sx + 60));
      v.push({ x, y: clampY(lerp(bermY, base + depth, Math.sin(t * Math.PI / 2))) });
    }
    const gy = clampY(base + depth);
    v.push({ x: cx - 55, y: gy });
    v.push({ x: cx, y: gy, cup: true });
    v.push({ x: cx + 55, y: gy });
    for (let x = cx + 55; x <= endX - 60; x += 12) {
      const t = (x - (cx + 55)) / (endX - 60 - (cx + 55));
      v.push({ x, y: clampY(lerp(base + depth, bermY, Math.sin(t * Math.PI / 2))) });
    }
    v.push({ x: endX - 60, y: bermY });
    v.push({ x: endX, y: bermY });
    return v;
  },

  river_valley(sx, sy, dist, cupY, diff) {
    const endX = sx + dist, base = clampY(sy);
    const depth = 70 + diff * 90;
    const cx = sx + dist * 0.5;
    const v = [{ x: sx, y: base }];
    for (let x = sx; x <= cx - 60; x += 12) {
      const t = (x - sx) / (cx - 60 - sx);
      const y = base + depth * (t * t * (3 - 2 * t)) + 14 * Math.sin(t * Math.PI * 3);
      v.push({ x, y: clampY(y) });
    }
    const gy = clampY(base + depth);
    v.push({ x: cx - 60, y: gy });
    v.push({ x: cx - 50, y: gy });
    v.push({ x: cx, y: gy, cup: true });
    v.push({ x: cx + 50, y: gy });
    v.push({ x: cx + 60, y: gy });
    for (let x = cx + 60; x <= endX; x += 12) {
      const t = (x - (cx + 60)) / (endX - (cx + 60));
      const y = base + depth * (1 - t * t * (3 - 2 * t)) + 14 * Math.sin((1 - t) * Math.PI * 3);
      v.push({ x, y: clampY(y) });
    }
    return v;
  },

  caldera_dish(sx, sy, dist, cupY, diff) {
    const endX = sx + dist, base = clampY(sy);
    const depth = 110 + diff * 110, rim = 30 + diff * 30;
    const cx = sx + dist * 0.5;
    const rimY = clampY(base - rim);
    const v = [{ x: sx, y: base }];
    for (let x = sx; x <= sx + 70; x += 13) {
      const t = (x - sx) / 70;
      v.push({ x, y: clampY(base - rim * (t * t * (3 - 2 * t))) });
    }
    v.push({ x: sx + 70, y: rimY });
    for (let x = sx + 70; x <= cx - 55; x += 12) {
      const t = (x - (sx + 70)) / (cx - 55 - (sx + 70));
      v.push({ x, y: clampY(lerp(rimY, base + depth, 1 - Math.cos(t * Math.PI / 2))) });
    }
    const gy = clampY(base + depth);
    v.push({ x: cx - 55, y: gy });
    v.push({ x: cx, y: gy, cup: true });
    v.push({ x: cx + 55, y: gy });
    for (let x = cx + 55; x <= endX - 70; x += 12) {
      const t = (x - (cx + 55)) / (endX - 70 - (cx + 55));
      v.push({ x, y: clampY(lerp(base + depth, rimY, Math.sin(t * Math.PI / 2))) });
    }
    v.push({ x: endX - 70, y: rimY });
    for (let x = endX - 70; x <= endX; x += 13) {
      const t = (x - (endX - 70)) / 70;
      v.push({ x, y: clampY(rimY + rim * (t * t * (3 - 2 * t))) });
    }
    return v;
  },

  terraced_bowl(sx, sy, dist, cupY, diff) {
    const endX = sx + dist, base = clampY(sy);
    const cx = sx + dist * 0.5;
    const rings = 3;
    const depth = 95 + diff * 100;
    const v = [{ x: sx, y: base }];
    const half = cx - 55 - sx;
    for (let i = 0; i < rings; i++) {
      const xa = sx + half * (i / rings);
      const xb = sx + half * ((i + 1) / rings);
      const treadY = clampY(base + depth * (i / rings));
      v.push({ x: xa, y: treadY });
      v.push({ x: xb - 14, y: treadY });
      const nextY = clampY(base + depth * ((i + 1) / rings));
      v.push({ x: xb, y: nextY });
    }
    const gy = clampY(base + depth);
    v.push({ x: cx - 55, y: gy });
    v.push({ x: cx, y: gy, cup: true });
    v.push({ x: cx + 55, y: gy });
    for (let i = rings - 1; i >= 0; i--) {
      const xa = cx + 55 + half * ((rings - 1 - i) / rings);
      const treadY = clampY(base + depth * (i / rings));
      v.push({ x: xa, y: clampY(base + depth * ((i + 1) / rings)) });
      v.push({ x: xa + 14, y: treadY });
      v.push({ x: cx + 55 + half * ((rings - i) / rings) - 1, y: treadY });
    }
    v.push({ x: endX, y: base });
    return v;
  },

  scoop_catch(sx, sy, dist, cupY, diff) {
    const endX = sx + dist, base = clampY(sy);
    const depth = 100 + diff * 110;
    const toe = sx + dist * 0.72;
    const v = [{ x: sx, y: base }];
    for (let x = sx; x <= toe - 55; x += 12) {
      const t = (x - sx) / (toe - 55 - sx);
      v.push({ x, y: clampY(base + depth * (t * t * (3 - 2 * t))) });
    }
    const gy = clampY(base + depth);
    v.push({ x: toe - 55, y: gy });
    v.push({ x: toe - 45, y: gy });
    v.push({ x: toe, y: gy, cup: true });
    v.push({ x: toe + 45, y: gy });
    v.push({ x: toe + 55, y: gy });
    const lipY = clampY(base - 20);
    for (let x = toe + 55; x <= toe + 120; x += 13) {
      const t = (x - (toe + 55)) / 65;
      v.push({ x, y: clampY(base + depth - (depth + 20) * Math.sin(t * Math.PI / 2)) });
    }
    v.push({ x: toe + 120, y: lipY });
    v.push({ x: endX, y: lipY });
    return v;
  },

  rolling_moguls(sx, sy, dist, cupY, diff) {
    const endX = sx + dist, base = clampY(sy);
    const amp = 28 + diff * 42, bumps = 5;
    const greenStart = sx + dist * 0.8;
    const v = [{ x: sx, y: base }];
    for (let x = sx; x <= greenStart; x += 11) {
      const t = (x - sx) / (greenStart - sx);
      const y = base + amp * Math.abs(Math.sin(t * bumps * Math.PI)) + 20 * t;
      v.push({ x, y: clampY(y) });
    }
    const gy = clampY(base + 20);
    v.push({ x: greenStart, y: gy });
    v.push({ x: greenStart + 40, y: gy });
    v.push({ x: (greenStart + endX) / 2, y: gy, cup: true });
    v.push({ x: endX - 40, y: gy });
    v.push({ x: endX, y: gy });
    return v;
  },

  damped_ripple(sx, sy, dist, cupY, diff) {
    const endX = sx + dist, base = clampY(sy);
    const amp = 55 + diff * 70;
    const greenStart = sx + dist * 0.82;
    const v = [{ x: sx, y: base }];
    for (let x = sx; x <= greenStart; x += 11) {
      const t = (x - sx) / (greenStart - sx);
      const y = base + amp * Math.exp(-2.4 * t) * Math.sin(t * Math.PI * 2 * 3.2) + 35 * t;
      v.push({ x, y: clampY(y) });
    }
    const gy = clampY(base + 35);
    v.push({ x: greenStart, y: gy });
    v.push({ x: greenStart + 40, y: gy });
    v.push({ x: (greenStart + endX) / 2, y: gy, cup: true });
    v.push({ x: endX - 40, y: gy });
    v.push({ x: endX, y: gy });
    return v;
  },

  funnel_chute(sx, sy, dist, cupY, diff) {
    const endX = sx + dist, base = clampY(sy);
    const depth = 110 + diff * 110;
    const cx = sx + dist * 0.5;
    const v = [{ x: sx, y: base }];
    for (let x = sx; x <= cx - 45; x += 12) {
      const t = (x - sx) / (cx - 45 - sx);
      v.push({ x, y: clampY(base + depth * Math.pow(t, 1.3)) });
    }
    const gy = clampY(base + depth);
    v.push({ x: cx - 45, y: gy });
    v.push({ x: cx - 40, y: gy });
    v.push({ x: cx, y: gy, cup: true });
    v.push({ x: cx + 40, y: gy });
    v.push({ x: cx + 45, y: gy });
    for (let x = cx + 45; x <= endX; x += 12) {
      const t = (x - (cx + 45)) / (endX - (cx + 45));
      v.push({ x, y: clampY(base + depth * Math.pow(1 - t, 1.3)) });
    }
    return v;
  },

  ocean_groundswell(sx, sy, dist, cupY, diff) {
    const endX = sx + dist, base = clampY(sy);
    const amp = 20 + diff * 30;
    const greenStart = sx + dist * 0.83;
    const v = [{ x: sx, y: base }];
    for (let x = sx; x <= greenStart; x += 12) {
      const t = (x - sx) / (greenStart - sx);
      const phase = t * Math.PI * 2 * 3;
      const y = base + amp * Math.sin(phase + 0.5 * Math.sin(phase)) + 55 * t;
      v.push({ x, y: clampY(y) });
    }
    const gy = clampY(base + 55);
    v.push({ x: greenStart, y: gy });
    v.push({ x: greenStart + 40, y: gy });
    v.push({ x: (greenStart + endX) / 2, y: gy, cup: true });
    v.push({ x: endX - 40, y: gy });
    v.push({ x: endX, y: gy });
    return v;
  },

  lilypad_pockets(sx, sy, dist, cupY, diff) {
    const endX = sx + dist, base = clampY(sy);
    const cx = sx + dist * 0.62;
    const depth = 95 + diff * 100;
    const v = [{ x: sx, y: base }];
    const pads = 3;
    const span = cx - 55 - sx;
    for (let i = 0; i < pads; i++) {
      const padY = clampY(base + depth * ((i + 0.5) / pads) * 0.7);
      const xa = sx + span * (i / pads);
      const xb = sx + span * ((i + 1) / pads);
      for (let x = xa; x <= xa + 16; x += 8) {
        const t = (x - xa) / 16;
        const prev = i === 0 ? base : clampY(base + depth * ((i - 0.5) / pads) * 0.7);
        v.push({ x, y: clampY(lerp(prev, padY, t)) });
      }
      v.push({ x: xb - 6, y: padY });
    }
    for (let x = sx + span; x <= cx - 55; x += 10) {
      const t = (x - (sx + span)) / 55;
      const prev = clampY(base + depth * ((pads - 0.5) / pads) * 0.7);
      v.push({ x, y: clampY(lerp(prev, base + depth, Math.sin(t * Math.PI / 2))) });
    }
    const gy = clampY(base + depth);
    v.push({ x: cx - 55, y: gy });
    v.push({ x: cx, y: gy, cup: true });
    v.push({ x: cx + 55, y: gy });
    for (let x = cx + 55; x <= endX; x += 12) {
      const t = (x - (cx + 55)) / (endX - (cx + 55));
      v.push({ x, y: clampY(base + depth * (1 - Math.sin(t * Math.PI / 2))) });
    }
    return v;
  },

  corduroy_flat(sx, sy, dist, cupY, diff) {
    const endX = sx + dist, base = clampY(sy);
    const amp = 8 + diff * 16, ripples = 11;
    const greenStart = sx + dist * 0.82;
    const v = [{ x: sx, y: base }];
    for (let x = sx; x <= greenStart; x += 10) {
      const t = (x - sx) / (greenStart - sx);
      const y = base + amp * Math.sin(t * ripples * Math.PI * 2);
      v.push({ x, y: clampY(y) });
    }
    const gy = clampY(base);
    v.push({ x: greenStart, y: gy });
    v.push({ x: greenStart + 40, y: gy });
    v.push({ x: (greenStart + endX) / 2, y: gy, cup: true });
    v.push({ x: endX - 40, y: gy });
    v.push({ x: endX, y: gy });
    return v;
  },

  crescent_dune_bay(sx, sy, dist, cupY, diff) {
    const endX = sx + dist, base = clampY(sy);
    const crest = 45 + diff * 50, depth = 75 + diff * 90;
    const cx = sx + dist * 0.6;
    const crestX = sx + dist * 0.2;
    const crestY = clampY(base - crest);
    const v = [{ x: sx, y: base }];
    for (let x = sx; x <= crestX; x += 12) {
      const t = (x - sx) / (crestX - sx);
      v.push({ x, y: clampY(base - crest * Math.sin(t * Math.PI / 2)) });
    }
    v.push({ x: crestX, y: crestY });
    for (let x = crestX; x <= cx - 55; x += 12) {
      const t = (x - crestX) / (cx - 55 - crestX);
      v.push({ x, y: clampY(lerp(crestY, base + depth, t * t)) });
    }
    const gy = clampY(base + depth);
    v.push({ x: cx - 55, y: gy });
    v.push({ x: cx, y: gy, cup: true });
    v.push({ x: cx + 55, y: gy });
    for (let x = cx + 55; x <= endX; x += 12) {
      const t = (x - (cx + 55)) / (endX - (cx + 55));
      v.push({ x, y: clampY(lerp(base + depth, base, Math.sin(t * Math.PI / 2))) });
    }
    return v;
  },

  chirp_swells(sx, sy, dist, cupY, diff) {
    const endX = sx + dist, base = clampY(sy);
    const amp = 26 + diff * 38;
    const greenStart = sx + dist * 0.8;
    const v = [{ x: sx, y: base }];
    for (let x = sx; x <= greenStart; x += 11) {
      const t = (x - sx) / (greenStart - sx);
      const phase = (6.0 - 4.0 * t) * t * Math.PI * 2;
      const y = base + amp * (1 - 0.4 * t) * Math.sin(phase) + 30 * t;
      v.push({ x, y: clampY(y) });
    }
    const gy = clampY(base + 30);
    v.push({ x: greenStart, y: gy });
    v.push({ x: greenStart + 40, y: gy });
    v.push({ x: (greenStart + endX) / 2, y: gy, cup: true });
    v.push({ x: endX - 40, y: gy });
    v.push({ x: endX, y: gy });
    return v;
  },

  twin_lobe_valley(sx, sy, dist, cupY, diff) {
    const endX = sx + dist, base = clampY(sy);
    const depth = 85 + diff * 100;
    const l1 = sx + dist * 0.3, l2 = sx + dist * 0.72;
    const islandY = clampY(base + 22);
    const v = [{ x: sx, y: base }];
    for (let x = sx; x <= l1; x += 12) {
      const t = (x - sx) / (l1 - sx);
      v.push({ x, y: clampY(lerp(base, base + depth * 0.85, Math.sin(t * Math.PI / 2))) });
    }
    for (let x = l1; x <= (l1 + l2) / 2; x += 12) {
      const t = (x - l1) / ((l1 + l2) / 2 - l1);
      v.push({ x, y: clampY(lerp(base + depth * 0.85, islandY, Math.sin(t * Math.PI / 2))) });
    }
    for (let x = (l1 + l2) / 2; x <= l2 - 55; x += 12) {
      const t = (x - (l1 + l2) / 2) / (l2 - 55 - (l1 + l2) / 2);
      v.push({ x, y: clampY(lerp(islandY, base + depth, Math.sin(t * Math.PI / 2))) });
    }
    const gy = clampY(base + depth);
    v.push({ x: l2 - 55, y: gy });
    v.push({ x: l2, y: gy, cup: true });
    v.push({ x: l2 + 55, y: gy });
    for (let x = l2 + 55; x <= endX; x += 12) {
      const t = (x - (l2 + 55)) / (endX - (l2 + 55));
      v.push({ x, y: clampY(lerp(base + depth, base, Math.sin(t * Math.PI / 2))) });
    }
    return v;
  },

  billowing_hills(sx, sy, dist, cupY, diff) {
    const endX = sx + dist, base = clampY(sy);
    const amp = 45 + diff * 60;
    const cupX = sx + dist * 0.5;
    const v = [{ x: sx, y: base }];
    for (let x = sx; x <= cupX - 55; x += 12) {
      const t = (x - sx) / (cupX - 55 - sx);
      v.push({ x, y: clampY(base + amp * (1 - Math.cos(t * Math.PI)) / 2 + amp) });
    }
    const gy = clampY(base + amp);
    v.push({ x: cupX - 55, y: gy });
    v.push({ x: cupX - 45, y: gy });
    v.push({ x: cupX, y: gy, cup: true });
    v.push({ x: cupX + 45, y: gy });
    v.push({ x: cupX + 55, y: gy });
    for (let x = cupX + 55; x <= endX; x += 12) {
      const t = (x - (cupX + 55)) / (endX - (cupX + 55));
      v.push({ x, y: clampY(base + amp + amp * Math.sin(t * Math.PI) * 0.8) });
    }
    return v;
  },
  slot_canyon_carry(sx, sy, dist, cupY, diff) {
    const endX = sx + dist, base = clampY(sy);
    const v = [];
    const gapW = lerp(70, 180, diff);
    const depth = clampY(base + lerp(120, 240, diff));
    const teeRun = sx + dist * 0.30;
    const gapL = teeRun, gapR = teeRun + gapW;
    v.push({ x: sx, y: base });
    v.push({ x: gapL - 40, y: base });
    v.push({ x: gapL, y: base });
    v.push({ x: gapL + 10, y: depth });
    v.push({ x: (gapL + gapR) / 2, y: depth });
    v.push({ x: gapR - 10, y: depth });
    v.push({ x: gapR, y: clampY(base + 20) });
    const gy = clampY(base + 25);
    const cx = (gapR + endX) / 2;
    v.push({ x: gapR + 30, y: gy });
    v.push({ x: cx - 50, y: gy });
    v.push({ x: cx, y: gy, cup: true });
    v.push({ x: cx + 50, y: gy });
    v.push({ x: endX, y: gy });
    return v;
  },

  archipelago_hop(sx, sy, dist, cupY, diff) {
    const endX = sx + dist, base = clampY(sy);
    const v = [];
    const sea = clampY(base + lerp(110, 210, diff));
    const span = dist;
    v.push({ x: sx, y: base });
    v.push({ x: sx + span * 0.16, y: base });
    v.push({ x: sx + span * 0.18, y: sea });
    const i1 = sx + span * 0.30;
    v.push({ x: i1 - 8, y: sea });
    v.push({ x: i1 - 6, y: clampY(base + 30) });
    v.push({ x: i1 + 30, y: clampY(base + 30) });
    v.push({ x: i1 + 38, y: sea });
    const i2 = sx + span * 0.52;
    v.push({ x: i2 - 8, y: sea });
    v.push({ x: i2 - 6, y: clampY(base + 30) });
    v.push({ x: i2 + 36, y: clampY(base + 30) });
    v.push({ x: i2 + 44, y: sea });
    const i3 = sx + span * 0.74;
    const gy = clampY(base + 25);
    v.push({ x: i3 - 8, y: sea });
    v.push({ x: i3 - 6, y: gy });
    const cx = (i3 + endX) / 2;
    v.push({ x: cx - 55, y: gy });
    v.push({ x: cx, y: gy, cup: true });
    v.push({ x: cx + 55, y: gy });
    v.push({ x: endX, y: gy });
    return v;
  },

  broken_bridge_pillar(sx, sy, dist, cupY, diff) {
    const endX = sx + dist, base = clampY(sy);
    const v = [];
    const chasm = clampY(base + lerp(140, 250, diff));
    const gL = sx + dist * 0.28, gR = sx + dist * 0.72;
    v.push({ x: sx, y: base });
    v.push({ x: gL - 30, y: base });
    v.push({ x: gL, y: base });
    v.push({ x: gL + 10, y: chasm });
    const pc = (gL + gR) / 2;
    v.push({ x: pc - 22, y: chasm });
    v.push({ x: pc - 14, y: clampY(base + 35) });
    v.push({ x: pc + 14, y: clampY(base + 35) });
    v.push({ x: pc + 22, y: chasm });
    v.push({ x: gR - 10, y: chasm });
    v.push({ x: gR, y: clampY(base + 15) });
    const gy = clampY(base + 18);
    const cx = (gR + endX) / 2;
    v.push({ x: gR + 30, y: gy });
    v.push({ x: cx - 50, y: gy });
    v.push({ x: cx, y: gy, cup: true });
    v.push({ x: cx + 50, y: gy });
    v.push({ x: endX, y: gy });
    return v;
  },

  moat_ringed_plateau(sx, sy, dist, cupY, diff) {
    const endX = sx + dist, base = clampY(sy);
    const v = [];
    const moat = clampY(base + lerp(100, 190, diff));
    const top = clampY(base - lerp(20, 70, diff));
    const mL = sx + dist * 0.30, mR = sx + dist * 0.46;
    v.push({ x: sx, y: base });
    v.push({ x: mL - 20, y: base });
    v.push({ x: mL, y: base });
    v.push({ x: mL + 10, y: moat });
    v.push({ x: mR - 10, y: moat });
    v.push({ x: mR, y: top });
    const gy = top;
    const cx = (mR + endX) / 2;
    v.push({ x: mR + 40, y: gy });
    v.push({ x: cx - 60, y: gy });
    v.push({ x: cx, y: gy, cup: true });
    v.push({ x: cx + 60, y: gy });
    v.push({ x: endX, y: gy });
    return v;
  },

  double_chasm_rest(sx, sy, dist, cupY, diff) {
    const endX = sx + dist, base = clampY(sy);
    const v = [];
    const deep = clampY(base + lerp(130, 230, diff));
    const g1L = sx + dist * 0.22, g1R = sx + dist * 0.36;
    const g2L = sx + dist * 0.56, g2R = sx + dist * 0.70;
    v.push({ x: sx, y: base });
    v.push({ x: g1L, y: base });
    v.push({ x: g1L + 10, y: deep });
    v.push({ x: g1R - 10, y: deep });
    v.push({ x: g1R, y: clampY(base + 20) });
    v.push({ x: g1R + 25, y: clampY(base + 20) });
    v.push({ x: g2L - 25, y: clampY(base + 20) });
    v.push({ x: g2L, y: clampY(base + 20) });
    v.push({ x: g2L + 10, y: deep });
    v.push({ x: g2R - 10, y: deep });
    v.push({ x: g2R, y: clampY(base + 25) });
    const gy = clampY(base + 28);
    const cx = (g2R + endX) / 2;
    v.push({ x: g2R + 30, y: gy });
    v.push({ x: cx - 50, y: gy });
    v.push({ x: cx, y: gy, cup: true });
    v.push({ x: cx + 50, y: gy });
    v.push({ x: endX, y: gy });
    return v;
  },

  fjord_crossing(sx, sy, dist, cupY, diff) {
    const endX = sx + dist, base = clampY(sy);
    const v = [];
    const floor = clampY(base + lerp(150, 260, diff));
    const wL = sx + dist * 0.34, wR = sx + dist * 0.58;
    v.push({ x: sx, y: base });
    v.push({ x: wL - 30, y: base });
    v.push({ x: wL, y: base });
    v.push({ x: wL + 12, y: clampY(base + (floor - base) * 0.5) });
    v.push({ x: wL + 24, y: floor });
    v.push({ x: (wL + wR) / 2, y: floor });
    v.push({ x: wR - 24, y: floor });
    v.push({ x: wR - 12, y: clampY(base + (floor - base) * 0.5) });
    v.push({ x: wR, y: clampY(base + 10) });
    const gy = clampY(base + 12);
    const cx = (wR + endX) / 2;
    v.push({ x: wR + 35, y: gy });
    v.push({ x: cx - 55, y: gy });
    v.push({ x: cx, y: gy, cup: true });
    v.push({ x: cx + 55, y: gy });
    v.push({ x: endX, y: gy });
    return v;
  },

  catwalk_pads(sx, sy, dist, cupY, diff) {
    const endX = sx + dist, base = clampY(sy);
    const v = [];
    const voidY = clampY(base + lerp(140, 250, diff));
    const pads = 4;
    const startGap = sx + dist * 0.18;
    v.push({ x: sx, y: base });
    v.push({ x: startGap, y: base });
    v.push({ x: startGap + 8, y: voidY });
    const stepW = (dist * 0.60) / pads;
    let px = startGap + 8;
    for (let i = 0; i < pads; i++) {
      const padL = px + stepW * 0.45;
      const padR = padL + stepW * 0.30;
      v.push({ x: padL, y: voidY });
      v.push({ x: padL + 6, y: clampY(base + 35) });
      v.push({ x: padR - 6, y: clampY(base + 35) });
      v.push({ x: padR, y: voidY });
      px = padR;
    }
    const gy = clampY(base + 30);
    v.push({ x: px + 12, y: voidY });
    v.push({ x: px + 20, y: gy });
    const cx = (px + 20 + endX) / 2;
    v.push({ x: cx - 50, y: gy });
    v.push({ x: cx, y: gy, cup: true });
    v.push({ x: cx + 50, y: gy });
    v.push({ x: endX, y: gy });
    return v;
  },

  leapfrog_risers(sx, sy, dist, cupY, diff) {
    const endX = sx + dist, base = clampY(sy);
    const v = [];
    const voidY = clampY(base + lerp(120, 220, diff));
    v.push({ x: sx, y: base });
    v.push({ x: sx + dist * 0.16, y: base });
    v.push({ x: sx + dist * 0.18, y: voidY });
    const steps = 3;
    const segW = (dist * 0.55) / steps;
    let px = sx + dist * 0.18;
    for (let i = 0; i < steps; i++) {
      const top = clampY(base - i * lerp(8, 30, diff));
      const padL = px + segW * 0.40;
      const padR = padL + segW * 0.40;
      v.push({ x: padL, y: voidY });
      v.push({ x: padL + 6, y: top });
      v.push({ x: padR - 6, y: top });
      v.push({ x: padR, y: voidY });
      px = padR;
    }
    const gy = clampY(base - steps * lerp(8, 30, diff) + 10);
    v.push({ x: px + 12, y: voidY });
    v.push({ x: px + 20, y: gy });
    const cx = (px + 20 + endX) / 2;
    v.push({ x: cx - 50, y: gy });
    v.push({ x: cx, y: gy, cup: true });
    v.push({ x: cx + 50, y: gy });
    v.push({ x: endX, y: gy });
    return v;
  },

  land_bridge_neck(sx, sy, dist, cupY, diff) {
    const endX = sx + dist, base = clampY(sy);
    const v = [];
    const voidY = clampY(base + lerp(130, 230, diff));
    const g1 = sx + dist * 0.22, neckL = sx + dist * 0.40, neckR = sx + dist * 0.52, g2 = sx + dist * 0.70;
    v.push({ x: sx, y: base });
    v.push({ x: g1, y: base });
    v.push({ x: g1 + 10, y: voidY });
    v.push({ x: neckL - 8, y: voidY });
    v.push({ x: neckL, y: clampY(base + 25) });
    v.push({ x: neckR, y: clampY(base + 25) });
    v.push({ x: neckR + 8, y: voidY });
    v.push({ x: g2 - 10, y: voidY });
    v.push({ x: g2, y: clampY(base + 15) });
    const gy = clampY(base + 18);
    const cx = (g2 + endX) / 2;
    v.push({ x: g2 + 30, y: gy });
    v.push({ x: cx - 55, y: gy });
    v.push({ x: cx, y: gy, cup: true });
    v.push({ x: cx + 55, y: gy });
    v.push({ x: endX, y: gy });
    return v;
  },

  sinkhole_off_tee(sx, sy, dist, cupY, diff) {
    const endX = sx + dist, base = clampY(sy);
    const v = [];
    const pit = clampY(base + lerp(120, 220, diff));
    const pL = sx + dist * 0.12, pR = pL + lerp(60, 150, diff);
    v.push({ x: sx, y: base });
    v.push({ x: pL, y: base });
    v.push({ x: pL + 10, y: pit });
    v.push({ x: (pL + pR) / 2, y: pit });
    v.push({ x: pR - 10, y: pit });
    v.push({ x: pR, y: clampY(base + 10) });
    const gy = clampY(base + 12);
    const cx = (pR + endX) / 2 + dist * 0.05;
    v.push({ x: pR + 40, y: gy });
    v.push({ x: cx - 60, y: gy });
    v.push({ x: cx, y: gy, cup: true });
    v.push({ x: cx + 60, y: gy });
    v.push({ x: endX, y: gy });
    return v;
  },

  crevasse_to_clifftop(sx, sy, dist, cupY, diff) {
    const endX = sx + dist, base = clampY(sy);
    const v = [];
    const deep = clampY(base + lerp(120, 210, diff));
    const top = clampY(base - lerp(15, 60, diff));
    const cL = sx + dist * 0.28, cR = sx + dist * 0.50;
    v.push({ x: sx, y: base });
    v.push({ x: cL, y: base });
    v.push({ x: cL + 10, y: deep });
    v.push({ x: cR - 10, y: deep });
    v.push({ x: cR, y: clampY(base + (deep - base) * 0.4) });
    v.push({ x: cR + 14, y: clampY(base - 5) });
    v.push({ x: cR + 26, y: top });
    const gy = top;
    const cx = (cR + 26 + endX) / 2;
    v.push({ x: cR + 50, y: gy });
    v.push({ x: cx - 55, y: gy });
    v.push({ x: cx, y: gy, cup: true });
    v.push({ x: cx + 55, y: gy });
    v.push({ x: endX, y: gy });
    return v;
  },

  twin_slot_mesa(sx, sy, dist, cupY, diff) {
    const endX = sx + dist, base = clampY(sy);
    const v = [];
    const slot = clampY(base + lerp(120, 210, diff));
    const s1L = sx + dist * 0.20, s1R = sx + dist * 0.30;
    const mL = s1R, mR = sx + dist * 0.52;
    const s2L = mR, s2R = sx + dist * 0.62;
    v.push({ x: sx, y: base });
    v.push({ x: s1L, y: base });
    v.push({ x: s1L + 10, y: slot });
    v.push({ x: s1R - 10, y: slot });
    v.push({ x: mL, y: clampY(base - 15) });
    v.push({ x: mR, y: clampY(base - 15) });
    v.push({ x: s2L + 10, y: slot });
    v.push({ x: s2R - 10, y: slot });
    v.push({ x: s2R, y: clampY(base + 10) });
    const gy = clampY(base + 12);
    const cx = (s2R + endX) / 2;
    v.push({ x: s2R + 35, y: gy });
    v.push({ x: cx - 55, y: gy });
    v.push({ x: cx, y: gy, cup: true });
    v.push({ x: cx + 55, y: gy });
    v.push({ x: endX, y: gy });
    return v;
  },

  drawbridge_leap(sx, sy, dist, cupY, diff) {
    const endX = sx + dist, base = clampY(sy);
    const v = [];
    const voidY = clampY(base + lerp(140, 240, diff));
    const lip = sx + dist * 0.40, far = sx + dist * 0.62;
    v.push({ x: sx, y: base });
    v.push({ x: sx + dist * 0.14, y: clampY(base + 10) });
    v.push({ x: sx + dist * 0.28, y: clampY(base + 35) });
    v.push({ x: lip, y: clampY(base + 50) });
    v.push({ x: lip + 10, y: voidY });
    v.push({ x: far - 10, y: voidY });
    v.push({ x: far, y: clampY(base + 45) });
    v.push({ x: far + dist * 0.10, y: clampY(base + 15) });
    const gy = clampY(base + 12);
    v.push({ x: far + dist * 0.16, y: gy });
    const cx = (far + dist * 0.16 + endX) / 2;
    v.push({ x: cx - 55, y: gy });
    v.push({ x: cx, y: gy, cup: true });
    v.push({ x: cx + 55, y: gy });
    v.push({ x: endX, y: gy });
    return v;
  },

  keyhole_canyon(sx, sy, dist, cupY, diff) {
    const endX = sx + dist, base = clampY(sy);
    const v = [];
    const deep = clampY(base + lerp(130, 230, diff));
    const gL = sx + dist * 0.24, gR = sx + dist * 0.50;
    const notchL = sx + dist * 0.55, notchR = sx + dist * 0.62;
    v.push({ x: sx, y: base });
    v.push({ x: gL, y: base });
    v.push({ x: gL + 10, y: deep });
    v.push({ x: gR - 10, y: deep });
    v.push({ x: gR, y: clampY(base + 40) });
    v.push({ x: notchL, y: clampY(base + 5) });
    v.push({ x: notchR, y: clampY(base + 5) });
    const gy = clampY(base + 8);
    const cx = (notchR + endX) / 2;
    v.push({ x: notchR + 30, y: gy });
    v.push({ x: cx - 55, y: gy });
    v.push({ x: cx, y: gy, cup: true });
    v.push({ x: cx + 55, y: gy });
    v.push({ x: endX, y: gy });
    return v;
  },

  valley_of_steps(sx, sy, dist, cupY, diff) {
    const endX = sx + dist, base = clampY(sy);
    const v = [];
    const steps = 3 + Math.round(diff * 2);
    const stepH = lerp(18, 34, diff);
    const half = dist * 0.42;
    const stepW = half / steps;
    v.push({ x: sx, y: base });
    let y = base, x = sx + dist * 0.06;
    v.push({ x: x, y: y });
    for (let i = 0; i < steps; i++) {
      y = clampY(y + stepH);
      v.push({ x: x + 8, y: y });
      x += stepW;
      v.push({ x: x, y: y });
    }
    v.push({ x: x + 30, y: y });
    x += 30;
    for (let i = 0; i < steps; i++) {
      y = clampY(y - stepH);
      x += stepW;
      v.push({ x: x - 8, y: y });
      v.push({ x: x, y: y });
    }
    const gy = y;
    const cx = (x + endX) / 2;
    v.push({ x: x + 30, y: gy });
    v.push({ x: cx - 55, y: gy });
    v.push({ x: cx, y: gy, cup: true });
    v.push({ x: cx + 55, y: gy });
    v.push({ x: endX, y: gy });
    return v;
  },

  switchback_ramp(sx, sy, dist, cupY, diff) {
    const endX = sx + dist, base = clampY(sy);
    const v = [];
    const rise = lerp(60, 150, diff);
    const top = clampY(base - rise);
    const b1 = sx + dist * 0.10;
    v.push({ x: sx, y: base });
    v.push({ x: b1, y: base });
    v.push({ x: sx + dist * 0.34, y: clampY(base - rise * 0.45) });
    v.push({ x: sx + dist * 0.42, y: clampY(base - rise * 0.45) });
    v.push({ x: sx + dist * 0.66, y: clampY(base - rise * 0.90) });
    v.push({ x: sx + dist * 0.74, y: top });
    const gy = top;
    const cx = (sx + dist * 0.74 + endX) / 2;
    v.push({ x: sx + dist * 0.80, y: gy });
    v.push({ x: cx - 55, y: gy });
    v.push({ x: cx, y: gy, cup: true });
    v.push({ x: cx + 55, y: gy });
    v.push({ x: endX, y: gy });
    return v;
  },

  rice_paddy_terraces(sx, sy, dist, cupY, diff) {
    const endX = sx + dist, base = clampY(sy);
    const v = [];
    const tiers = 4 + Math.round(diff * 2);
    const stepH = lerp(12, 26, diff);
    const tierW = (dist * 0.78) / tiers;
    v.push({ x: sx, y: base });
    let y = base, x = sx + dist * 0.05;
    v.push({ x: x, y: y });
    for (let i = 0; i < tiers; i++) {
      v.push({ x: x + tierW * 0.78, y: y });
      y = clampY(y + stepH);
      v.push({ x: x + tierW * 0.78 + 8, y: y });
      x += tierW;
    }
    const gy = y;
    const cx = (x + endX) / 2;
    v.push({ x: x + 20, y: gy });
    v.push({ x: cx - 55, y: gy });
    v.push({ x: cx, y: gy, cup: true });
    v.push({ x: cx + 55, y: gy });
    v.push({ x: endX, y: gy });
    return v;
  },

  zigzag_ledge_climb(sx, sy, dist, cupY, diff) {
    const endX = sx + dist, base = clampY(sy);
    const v = [];
    const ledges = 4;
    const stepH = lerp(20, 40, diff);
    const ledgeW = (dist * 0.72) / ledges;
    v.push({ x: sx, y: base });
    let y = base, x = sx + dist * 0.06;
    v.push({ x: x, y: y });
    for (let i = 0; i < ledges; i++) {
      v.push({ x: x + ledgeW * 0.62, y: y });
      y = clampY(y - stepH);
      v.push({ x: x + ledgeW * 0.62 + 12, y: y });
      x += ledgeW;
    }
    const gy = y;
    const cx = (x + endX) / 2;
    v.push({ x: x + 20, y: gy });
    v.push({ x: cx - 55, y: gy });
    v.push({ x: cx, y: gy, cup: true });
    v.push({ x: cx + 55, y: gy });
    v.push({ x: endX, y: gy });
    return v;
  },

  stepped_mesa_tier2(sx, sy, dist, cupY, diff) {
    const endX = sx + dist, base = clampY(sy);
    const v = [];
    const stepH = lerp(24, 46, diff);
    const t1 = clampY(base - stepH);
    const t2 = clampY(base - stepH * 2);
    const t3 = clampY(base - stepH * 3);
    v.push({ x: sx, y: base });
    v.push({ x: sx + dist * 0.16, y: base });
    v.push({ x: sx + dist * 0.20, y: t1 });
    v.push({ x: sx + dist * 0.36, y: t1 });
    v.push({ x: sx + dist * 0.40, y: t2 });
    const cx = sx + dist * 0.58;
    v.push({ x: cx - 55, y: t2 });
    v.push({ x: cx, y: t2, cup: true });
    v.push({ x: cx + 55, y: t2 });
    v.push({ x: sx + dist * 0.78, y: t2 });
    v.push({ x: sx + dist * 0.82, y: t3 });
    v.push({ x: endX, y: t3 });
    return v;
  },

  sunken_stadium(sx, sy, dist, cupY, diff) {
    const endX = sx + dist, base = clampY(sy);
    const v = [];
    const steps = 3 + Math.round(diff * 2);
    const stepH = lerp(16, 30, diff);
    const downW = (dist * 0.32) / steps;
    v.push({ x: sx, y: base });
    let y = base, x = sx + dist * 0.06;
    v.push({ x: x, y: y });
    for (let i = 0; i < steps; i++) {
      v.push({ x: x + downW * 0.7, y: y });
      y = clampY(y + stepH);
      v.push({ x: x + downW * 0.7 + 8, y: y });
      x += downW;
    }
    const stageY = y;
    const cx = (x + sx + dist * 0.68) / 2;
    v.push({ x: x + 20, y: stageY });
    v.push({ x: cx - 50, y: stageY });
    v.push({ x: cx, y: stageY, cup: true });
    v.push({ x: cx + 50, y: stageY });
    const stageR = sx + dist * 0.68;
    v.push({ x: stageR, y: stageY });
    for (let i = 0; i < steps; i++) {
      y = clampY(y - stepH);
      const sx2 = stageR + (i + 1) * downW;
      v.push({ x: sx2 - 8, y: clampY(y + stepH) });
      v.push({ x: sx2, y: y });
    }
    v.push({ x: endX, y: y });
    return v;
  },

  temple_grand_staircase(sx, sy, dist, cupY, diff) {
    const endX = sx + dist, base = clampY(sy);
    const v = [];
    const steps = 5 + Math.round(diff * 3);
    const stepH = lerp(14, 28, diff);
    const stairW = (dist * 0.66) / steps;
    v.push({ x: sx, y: base });
    let y = base, x = sx + dist * 0.06;
    v.push({ x: x, y: y });
    for (let i = 0; i < steps; i++) {
      v.push({ x: x + stairW * 0.6, y: y });
      y = clampY(y - stepH);
      v.push({ x: x + stairW * 0.6 + 10, y: y });
      x += stairW;
    }
    const gy = y;
    const cx = (x + endX) / 2;
    v.push({ x: x + 20, y: gy });
    v.push({ x: cx - 60, y: gy });
    v.push({ x: cx, y: gy, cup: true });
    v.push({ x: cx + 60, y: gy });
    v.push({ x: endX, y: gy });
    return v;
  },

  dropped_shelf_cascade(sx, sy, dist, cupY, diff) {
    const endX = sx + dist, base = clampY(sy);
    const v = [];
    const shelves = 3 + Math.round(diff * 2);
    const dropH = lerp(22, 44, diff);
    const shelfW = (dist * 0.74) / shelves;
    v.push({ x: sx, y: base });
    let y = base, x = sx + dist * 0.05;
    v.push({ x: x, y: y });
    for (let i = 0; i < shelves; i++) {
      v.push({ x: x + shelfW * 0.7, y: y });
      y = clampY(y + dropH);
      v.push({ x: x + shelfW * 0.7 + 10, y: y });
      x += shelfW;
    }
    const gy = y;
    const cx = (x + endX) / 2;
    v.push({ x: x + 20, y: gy });
    v.push({ x: cx - 60, y: gy });
    v.push({ x: cx, y: gy, cup: true });
    v.push({ x: cx + 60, y: gy });
    v.push({ x: endX, y: gy });
    return v;
  },

  stair_up_cliff_down(sx, sy, dist, cupY, diff) {
    const endX = sx + dist, base = clampY(sy);
    const v = [];
    const steps = 3 + Math.round(diff * 2);
    const stepH = lerp(18, 34, diff);
    const upW = (dist * 0.42) / steps;
    v.push({ x: sx, y: base });
    let y = base, x = sx + dist * 0.05;
    v.push({ x: x, y: y });
    for (let i = 0; i < steps; i++) {
      v.push({ x: x + upW * 0.6, y: y });
      y = clampY(y - stepH);
      v.push({ x: x + upW * 0.6 + 10, y: y });
      x += upW;
    }
    v.push({ x: x + 20, y: y });
    const low = clampY(base + lerp(20, 70, diff));
    v.push({ x: x + 34, y: low });
    const gy = low;
    const cx = (x + 34 + endX) / 2;
    v.push({ x: x + 60, y: gy });
    v.push({ x: cx - 55, y: gy });
    v.push({ x: cx, y: gy, cup: true });
    v.push({ x: cx + 55, y: gy });
    v.push({ x: endX, y: gy });
    return v;
  },

  split_level_benches(sx, sy, dist, cupY, diff) {
    const endX = sx + dist, base = clampY(sy);
    const v = [];
    const drop = lerp(30, 70, diff);
    const upper = base;
    const lower = clampY(base + drop);
    v.push({ x: sx, y: upper });
    v.push({ x: sx + dist * 0.30, y: upper });
    v.push({ x: sx + dist * 0.46, y: lower });
    const cx = sx + dist * 0.66;
    v.push({ x: cx - 60, y: lower });
    v.push({ x: cx, y: lower, cup: true });
    v.push({ x: cx + 60, y: lower });
    v.push({ x: endX, y: lower });
    return v;
  },

  pyramid_step_apex(sx, sy, dist, cupY, diff) {
    const endX = sx + dist, base = clampY(sy);
    const v = [];
    const steps = 4 + Math.round(diff * 2);
    const stepH = lerp(16, 30, diff);
    const climbW = (dist * 0.56) / steps;
    v.push({ x: sx, y: base });
    let y = base, x = sx + dist * 0.06;
    v.push({ x: x, y: y });
    for (let i = 0; i < steps; i++) {
      v.push({ x: x + climbW * 0.55, y: y });
      y = clampY(y - stepH);
      v.push({ x: x + climbW * 0.55 + 9, y: y });
      x += climbW;
    }
    const gy = y;
    const apexL = x + 14;
    const cx = (apexL + sx + dist * 0.82) / 2;
    v.push({ x: apexL, y: gy });
    v.push({ x: cx - 50, y: gy });
    v.push({ x: cx, y: gy, cup: true });
    v.push({ x: cx + 50, y: gy });
    const apexR = sx + dist * 0.82;
    v.push({ x: apexR, y: gy });
    v.push({ x: apexR + 12, y: clampY(gy + stepH) });
    v.push({ x: endX, y: clampY(gy + stepH * 1.5) });
    return v;
  },

  descending_sump_stairs(sx, sy, dist, cupY, diff) {
    const endX = sx + dist, base = clampY(sy);
    const v = [];
    const steps = 4 + Math.round(diff * 3);
    const stepH = lerp(16, 30, diff);
    const downW = (dist * 0.72) / steps;
    v.push({ x: sx, y: base });
    let y = base, x = sx + dist * 0.05;
    v.push({ x: x, y: y });
    for (let i = 0; i < steps; i++) {
      v.push({ x: x + downW * 0.62, y: y });
      y = clampY(y + stepH);
      v.push({ x: x + downW * 0.62 + 9, y: y });
      x += downW;
    }
    const gy = y;
    const cx = (x + endX) / 2;
    v.push({ x: x + 18, y: gy });
    v.push({ x: cx - 60, y: gy });
    v.push({ x: cx, y: gy, cup: true });
    v.push({ x: cx + 60, y: gy });
    v.push({ x: endX - 12, y: gy });
    v.push({ x: endX, y: clampY(gy - 18) });
    return v;
  },

  staircase_gap_staircase(sx, sy, dist, cupY, diff) {
    const endX = sx + dist, base = clampY(sy);
    const v = [];
    const stepH = lerp(16, 30, diff);
    const voidY = clampY(base + lerp(110, 190, diff));
    const steps = 3;
    const upW = (dist * 0.28) / steps;
    v.push({ x: sx, y: base });
    let y = base, x = sx + dist * 0.05;
    v.push({ x: x, y: y });
    for (let i = 0; i < steps; i++) {
      v.push({ x: x + upW * 0.6, y: y });
      y = clampY(y - stepH);
      v.push({ x: x + upW * 0.6 + 9, y: y });
      x += upW;
    }
    v.push({ x: x + 20, y: y });
    v.push({ x: x + 30, y: voidY });
    const farL = sx + dist * 0.60;
    v.push({ x: farL - 10, y: voidY });
    v.push({ x: farL, y: y });
    let y2 = y;
    let x2 = farL;
    const upW2 = (dist * 0.20) / steps;
    for (let i = 0; i < steps; i++) {
      v.push({ x: x2 + upW2 * 0.6, y: y2 });
      y2 = clampY(y2 - stepH);
      v.push({ x: x2 + upW2 * 0.6 + 9, y: y2 });
      x2 += upW2;
    }
    const gy = y2;
    const cx = (x2 + endX) / 2;
    v.push({ x: x2 + 18, y: gy });
    v.push({ x: cx - 50, y: gy });
    v.push({ x: cx, y: gy, cup: true });
    v.push({ x: cx + 50, y: gy });
    v.push({ x: endX, y: gy });
    return v;
  },
  rock_arch_bridge(sx, sy, dist, cupY, diff) {
    const endX = sx + dist, base = clampY(sy);
    const v = [{x:sx, y:base}];
    const floor = clampY(base + 30);
    const ax = sx + dist*0.30, bx = sx + dist*0.70;
    v.push({x:sx+dist*0.14, y:clampY(base+18)});
    v.push({x:ax-60, y:floor});
    const cx = (ax+bx)/2;
    v.push({x:cx-55, y:floor});
    v.push({x:cx-45, y:floor});
    v.push({x:cx, y:floor, cup:true});
    v.push({x:cx+45, y:floor});
    v.push({x:cx+55, y:floor});
    v.push({x:bx+60, y:floor});
    v.push({x:endX-dist*0.10, y:clampY(base+10)});
    v.push({x:endX, y:base});
    const roofY = clampY(floor - (BALL_RADIUS*4 + 22) - 30*diff);
    const crown = clampY(roofY - 34 - 30*diff);
    _emitOverhang([
      {x:ax-30, y:roofY},
      {x:cx-30, y:crown},
      {x:cx+30, y:crown},
      {x:bx+30, y:roofY},
      {x:bx+30, y:clampY(roofY-40)},
      {x:ax-30, y:clampY(roofY-40)},
    ]);
    return v;
  },

  slot_grotto(sx, sy, dist, cupY, diff) {
    const endX = sx + dist, base = clampY(sy);
    const v = [{x:sx, y:base}];
    const lipX = sx + dist*0.42;
    const floor = clampY(base + 70 + 50*diff);
    v.push({x:sx+dist*0.20, y:clampY(base+12)});
    v.push({x:lipX-10, y:clampY(base+20)});
    v.push({x:lipX+6, y:clampY(base+50)});
    v.push({x:lipX+16, y:floor});
    const cx = sx + dist*0.58;
    v.push({x:cx-48, y:floor});
    v.push({x:cx, y:floor, cup:true});
    v.push({x:cx+48, y:floor});
    v.push({x:cx+62, y:clampY(floor-40)});
    v.push({x:cx+76, y:clampY(base+18)});
    v.push({x:endX, y:base});
    const roofY = clampY(floor - (BALL_RADIUS*4 + 22));
    _emitOverhang([
      {x:lipX+2, y:roofY},
      {x:cx+50, y:roofY},
      {x:cx+50, y:clampY(roofY-30)},
      {x:lipX+2, y:clampY(roofY-46)},
    ]);
    return v;
  },

  colonnade_cloister(sx, sy, dist, cupY, diff) {
    const endX = sx + dist, base = clampY(sy);
    const v = [{x:sx, y:base}];
    const floor = clampY(base + 24);
    v.push({x:sx+dist*0.10, y:floor});
    const n = 3 + Math.round(diff*2);
    const spanStart = sx + dist*0.18, spanEnd = sx + dist*0.62;
    const step = (spanEnd-spanStart)/n;
    for (let i=0;i<n;i++){
      const px = spanStart + i*step;
      const ph = clampY(floor - 36 - 26*diff);
      v.push({x:px, y:floor});
      v.push({x:px+8, y:ph});
      v.push({x:px+step*0.32, y:ph});
      v.push({x:px+step*0.32+8, y:floor});
    }
    const cx = sx + dist*0.80;
    v.push({x:cx-50, y:floor});
    v.push({x:cx, y:floor, cup:true});
    v.push({x:cx+50, y:floor});
    v.push({x:endX, y:floor});
    const roofY = clampY(floor - (BALL_RADIUS*4 + 22));
    _emitOverhang([
      {x:cx-58, y:roofY},
      {x:cx+58, y:roofY},
      {x:cx+58, y:clampY(roofY-22)},
      {x:cx-58, y:clampY(roofY-22)},
    ]);
    return v;
  },

  halfpipe_tube(sx, sy, dist, cupY, diff) {
    const endX = sx + dist, base = clampY(sy);
    const v = [{x:sx, y:base}];
    const cx = sx + dist*0.55;
    const floor = clampY(base + 80 + 50*diff);
    const lipX = sx + dist*0.20;
    for (let x=sx; x<=cx; x+=14){
      const t=(x-sx)/(cx-sx);
      v.push({x, y:clampY(lerp(base, floor, t*t))});
    }
    v.push({x:cx-45, y:floor});
    v.push({x:cx, y:floor, cup:true});
    v.push({x:cx+45, y:floor});
    for (let x=cx+45; x<=endX; x+=14){
      const t=(x-(cx+45))/(endX-(cx+45));
      v.push({x, y:clampY(lerp(floor, base, t*t))});
    }
    v.push({x:endX, y:base});
    const roofY = clampY(floor - (BALL_RADIUS*4 + 22) - 20);
    _emitOverhang([
      {x:lipX, y:clampY(base+20)},
      {x:cx-20, y:roofY},
      {x:cx-20, y:clampY(roofY-26)},
      {x:lipX, y:clampY(base-4)},
    ]);
    return v;
  },

  aqueduct_arches(sx, sy, dist, cupY, diff) {
    const endX = sx + dist, base = clampY(sy);
    const v = [{x:sx, y:base}];
    const deck = clampY(base + 8);
    const ground = clampY(base + 90 + 30*diff);
    v.push({x:sx+dist*0.06, y:deck});
    const n = 3 + Math.round(diff*2);
    const aS = sx+dist*0.12, aE = sx+dist*0.70;
    const w = (aE-aS)/n;
    for (let i=0;i<n;i++){
      const px=aS+i*w;
      v.push({x:px, y:deck});
      v.push({x:px+10, y:ground});
      v.push({x:px+w*0.30, y:ground});
      v.push({x:px+w*0.34, y:clampY(ground-30)});
      v.push({x:px+w*0.50, y:deck});
      v.push({x:px+w*0.66, y:clampY(ground-30)});
      v.push({x:px+w*0.70, y:ground});
      v.push({x:px+w-10, y:ground});
      v.push({x:px+w, y:deck});
    }
    const cx = sx + dist*0.86;
    v.push({x:cx-50, y:deck});
    v.push({x:cx, y:deck, cup:true});
    v.push({x:cx+50, y:deck});
    v.push({x:endX, y:deck});
    return v;
  },

  ziggurat_chamber(sx, sy, dist, cupY, diff) {
    const endX = sx + dist, base = clampY(sy);
    const v = [{x:sx, y:base}];
    const ground = clampY(base + 40);
    v.push({x:sx+dist*0.08, y:ground});
    const tiers = 3;
    let x = sx+dist*0.10, y = ground;
    const tw = dist*0.10, th = 30+18*diff;
    for (let i=0;i<tiers;i++){
      y=clampY(y-th);
      v.push({x:x, y:clampY(y+th)});
      v.push({x:x+10, y});
      v.push({x:x+tw, y});
      x+=tw;
    }
    const topX=x;
    v.push({x:topX, y});
    const floor = clampY(ground - 6);
    const cx = sx + dist*0.66;
    v.push({x:topX+14, y:clampY(y+20)});
    v.push({x:cx-50, y:floor});
    v.push({x:cx, y:floor, cup:true});
    v.push({x:cx+50, y:floor});
    v.push({x:cx+70, y:clampY(floor-30)});
    v.push({x:cx+90, y:ground});
    v.push({x:endX, y:ground});
    const roofY = clampY(floor - (BALL_RADIUS*4 + 22));
    _emitOverhang([
      {x:cx-56, y:roofY},
      {x:cx+56, y:roofY},
      {x:cx+56, y:clampY(roofY-26)},
      {x:cx-56, y:clampY(roofY-26)},
    ]);
    return v;
  },

  mushroom_rock(sx, sy, dist, cupY, diff) {
    const endX = sx + dist, base = clampY(sy);
    const v = [{x:sx, y:base}];
    const floor = clampY(base + 40);
    v.push({x:sx+dist*0.18, y:floor});
    const cx = sx + dist*0.55;
    v.push({x:cx-50, y:floor});
    v.push({x:cx, y:floor, cup:true});
    v.push({x:cx+50, y:floor});
    v.push({x:cx+70, y:floor});
    v.push({x:cx+82, y:clampY(floor-50)});
    v.push({x:cx+96, y:clampY(base)});
    v.push({x:endX, y:base});
    const roofY = clampY(floor - (BALL_RADIUS*4 + 22) - 10);
    const capCx = cx + 78;
    _emitOverhang([
      {x:cx-70, y:roofY},
      {x:capCx-10, y:clampY(roofY-30)},
      {x:capCx+30, y:clampY(roofY-30)},
      {x:capCx+30, y:clampY(roofY-58)},
      {x:cx-70, y:clampY(roofY-50)},
    ]);
    return v;
  },

  cantilever_ledge(sx, sy, dist, cupY, diff) {
    const endX = sx + dist, base = clampY(sy);
    const v = [{x:sx, y:base}];
    const towerY = clampY(base - 50 - 40*diff);
    v.push({x:sx+dist*0.14, y:clampY(base-10)});
    v.push({x:sx+dist*0.28, y:towerY});
    const boardY = clampY(towerY);
    v.push({x:sx+dist*0.30, y:boardY});
    const cx = sx + dist*0.55;
    v.push({x:cx-45, y:boardY});
    v.push({x:cx, y:boardY, cup:true});
    v.push({x:cx+45, y:boardY});
    v.push({x:cx+58, y:boardY});
    v.push({x:cx+70, y:clampY(boardY+90)});
    const lowY = clampY(base + 60);
    v.push({x:cx+84, y:lowY});
    v.push({x:endX, y:lowY});
    return v;
  },

  sea_arch_lagoon(sx, sy, dist, cupY, diff) {
    const endX = sx + dist, base = clampY(sy);
    const v = [{x:sx, y:base}];
    const water = clampY(base + 60 + 30*diff);
    v.push({x:sx+dist*0.16, y:clampY(base+24)});
    v.push({x:sx+dist*0.30, y:water});
    const cx = sx + dist*0.50;
    v.push({x:cx-52, y:water});
    v.push({x:cx, y:water, cup:true});
    v.push({x:cx+52, y:water});
    v.push({x:cx+74, y:water});
    v.push({x:cx+86, y:clampY(water-50)});
    v.push({x:cx+100, y:clampY(base+10)});
    v.push({x:endX, y:base});
    const roofY = clampY(water - (BALL_RADIUS*4 + 22) - 14);
    const crown = clampY(roofY - 40);
    _emitOverhang([
      {x:sx+dist*0.30, y:roofY},
      {x:cx, y:crown},
      {x:cx+90, y:roofY},
      {x:cx+90, y:clampY(roofY-30)},
      {x:cx, y:clampY(crown-30)},
      {x:sx+dist*0.30, y:clampY(roofY-30)},
    ]);
    return v;
  },

  crystal_cluster(sx, sy, dist, cupY, diff) {
    const endX = sx + dist, base = clampY(sy);
    const v = [{x:sx, y:base}];
    const floor = clampY(base + 50);
    v.push({x:sx+dist*0.10, y:floor});
    const cS = sx+dist*0.16, cE = sx+dist*0.50;
    let x=cS, i=0;
    while (x < cE){
      const h = 30 + (i%3)*22 + 30*diff;
      v.push({x:x, y:floor});
      v.push({x:x+9, y:clampY(floor-h)});
      v.push({x:x+18, y:floor});
      x+=24; i++;
    }
    const cx = sx + dist*0.72;
    v.push({x:cx-52, y:floor});
    v.push({x:cx, y:floor, cup:true});
    v.push({x:cx+52, y:floor});
    v.push({x:cx+66, y:clampY(floor-44)});
    v.push({x:cx+80, y:floor});
    v.push({x:endX, y:floor});
    return v;
  },

  honeycomb_pockets(sx, sy, dist, cupY, diff) {
    const endX = sx + dist, base = clampY(sy);
    const v = [{x:sx, y:base}];
    const top = clampY(base + 10);
    v.push({x:sx+dist*0.06, y:top});
    const n = 4 + Math.round(diff*2);
    const s = sx+dist*0.10, e = sx+dist*0.78;
    const w = (e-s)/n;
    let cupCell = Math.floor(n*0.7);
    for (let i=0;i<n;i++){
      const px=s+i*w;
      const depth = 30 + (i===cupCell ? 30 : i*4) + 24*diff;
      const cellFloor = clampY(top+depth);
      v.push({x:px, y:top});
      if (i===cupCell){
        v.push({x:px+w*0.18, y:cellFloor});
        v.push({x:px+w*0.30, y:cellFloor});
        v.push({x:px+w*0.50, y:cellFloor, cup:true});
        v.push({x:px+w*0.70, y:cellFloor});
        v.push({x:px+w*0.82, y:cellFloor});
      } else {
        v.push({x:px+w*0.22, y:cellFloor});
        v.push({x:px+w*0.78, y:cellFloor});
      }
      v.push({x:px+w, y:top});
    }
    v.push({x:endX, y:top});
    return v;
  },

  derelict_hull_ramp(sx, sy, dist, cupY, diff) {
    const endX = sx + dist, base = clampY(sy);
    const v = [{x:sx, y:base}];
    v.push({x:sx+dist*0.10, y:clampY(base-30-20*diff)});
    const holdY = clampY(base + 70 + 40*diff);
    v.push({x:sx+dist*0.20, y:clampY(base-30-20*diff)});
    v.push({x:sx+dist*0.55, y:holdY});
    const cx = sx + dist*0.72;
    v.push({x:cx-50, y:holdY});
    v.push({x:cx, y:holdY, cup:true});
    v.push({x:cx+50, y:holdY});
    v.push({x:cx+64, y:holdY});
    v.push({x:cx+74, y:clampY(holdY-50)});
    v.push({x:cx+86, y:clampY(base-10)});
    v.push({x:endX, y:clampY(base-10)});
    return v;
  },

  radio_dish(sx, sy, dist, cupY, diff) {
    const endX = sx + dist, base = clampY(sy);
    const v = [{x:sx, y:base}];
    const cx = sx + dist*0.50;
    const floor = clampY(base + 100 + 40*diff);
    for (let x=sx; x<=cx; x+=12){
      const t=(x-sx)/(cx-sx);
      v.push({x, y:clampY(lerp(base, floor, t*t))});
    }
    v.push({x:cx-44, y:floor});
    v.push({x:cx, y:floor, cup:true});
    v.push({x:cx+44, y:floor});
    for (let x=cx+44; x<=endX; x+=12){
      const t=(x-(cx+44))/(endX-(cx+44));
      v.push({x, y:clampY(lerp(floor, base, t*t))});
    }
    v.push({x:endX, y:base});
    return v;
  },

  pyramid_temple(sx, sy, dist, cupY, diff) {
    const endX = sx + dist, base = clampY(sy);
    const v = [{x:sx, y:base}];
    const ground = clampY(base + 20);
    v.push({x:sx+dist*0.08, y:ground});
    const steps = 4 + Math.round(diff*2);
    const sw = (dist*0.40)/steps, sh = 24+10*diff;
    let x=sx+dist*0.10, y=ground;
    for (let i=0;i<steps;i++){
      v.push({x:x, y});
      y=clampY(y-sh);
      v.push({x:x+10, y});
      x+=sw;
      v.push({x:x, y});
    }
    const cx = x + dist*0.06;
    v.push({x:cx-46, y});
    v.push({x:cx, y, cup:true});
    v.push({x:cx+46, y});
    x=cx+46;
    for (let i=0;i<steps;i++){
      v.push({x:x, y});
      y=clampY(y+sh);
      v.push({x:x+10, y});
      x+=sw;
      v.push({x:x, y});
    }
    v.push({x:endX, y:ground});
    return v;
  },

  pylon_base(sx, sy, dist, cupY, diff) {
    const endX = sx + dist, base = clampY(sy);
    const v = [{x:sx, y:base}];
    const ground = clampY(base + 20);
    v.push({x:sx+dist*0.06, y:ground});
    const cx = sx + dist*0.24;
    v.push({x:cx-52, y:ground});
    v.push({x:cx, y:ground, cup:true});
    v.push({x:cx+52, y:ground});
    const tx = sx + dist*0.55;
    v.push({x:tx-30, y:ground});
    v.push({x:tx-8, y:clampY(base-80-60*diff)});
    v.push({x:tx, y:clampY(base-92-60*diff)});
    v.push({x:tx+8, y:clampY(base-80-60*diff)});
    v.push({x:tx+30, y:ground});
    v.push({x:endX, y:ground});
    return v;
  },

  dragon_back(sx, sy, dist, cupY, diff) {
    const endX = sx + dist, base = clampY(sy);
    const v = [{x:sx, y:base}];
    const ridge = clampY(base - 20);
    v.push({x:sx+dist*0.06, y:ridge});
    const n = 5 + Math.round(diff*3);
    const s=sx+dist*0.10, e=sx+dist*0.70, w=(e-s)/n;
    for (let i=0;i<n;i++){
      const px=s+i*w;
      const arc = Math.sin((i/n)*Math.PI);
      const h = 24 + arc*(40+40*diff);
      v.push({x:px, y:clampY(ridge - h)});
      v.push({x:px+w*0.5, y:clampY(ridge)});
    }
    const greenY = clampY(base + 40);
    v.push({x:e+14, y:clampY(ridge+30)});
    const cx = sx + dist*0.84;
    v.push({x:cx-48, y:greenY});
    v.push({x:cx, y:greenY, cup:true});
    v.push({x:cx+48, y:greenY});
    v.push({x:endX, y:greenY});
    return v;
  },

  piano_keys(sx, sy, dist, cupY, diff) {
    const endX = sx + dist, base = clampY(sy);
    const v = [{x:sx, y:base}];
    const low = clampY(base + 30);
    const high = clampY(base - 20 - 30*diff);
    v.push({x:sx+dist*0.06, y:low});
    const n = 5 + Math.round(diff*2);
    const s=sx+dist*0.08, e=sx+dist*0.72, w=(e-s)/n;
    for (let i=0;i<n;i++){
      const px=s+i*w;
      const top = (i%2===0)? high : low;
      v.push({x:px, y:low});
      v.push({x:px+6, y:top});
      v.push({x:px+w-6, y:top});
      v.push({x:px+w, y:low});
    }
    const cx = sx + dist*0.84;
    v.push({x:cx-48, y:low});
    v.push({x:cx, y:low, cup:true});
    v.push({x:cx+48, y:low});
    v.push({x:endX, y:low});
    return v;
  },

  lightning_zigzag(sx, sy, dist, cupY, diff) {
    const endX = sx + dist, base = clampY(sy);
    const v = [{x:sx, y:base}];
    const lo = clampY(base + 70 + 40*diff);
    v.push({x:sx+dist*0.16, y:clampY(base+10)});
    v.push({x:sx+dist*0.22, y:clampY(base-20)});
    v.push({x:sx+dist*0.34, y:clampY(base+40)});
    v.push({x:sx+dist*0.40, y:clampY(base+6)});
    v.push({x:sx+dist*0.52, y:lo});
    const cx = sx + dist*0.70;
    v.push({x:cx-50, y:lo});
    v.push({x:cx, y:lo, cup:true});
    v.push({x:cx+50, y:lo});
    v.push({x:endX, y:lo});
    return v;
  },

  y_fork_plateau(sx, sy, dist, cupY, diff) {
    const endX = sx + dist, base = clampY(sy);
    const v = [{x:sx, y:base}];
    const stem = clampY(base + 10);
    v.push({x:sx+dist*0.10, y:stem});
    const junc = clampY(base - 30 - 24*diff);
    v.push({x:sx+dist*0.34, y:junc});
    v.push({x:sx+dist*0.42, y:clampY(junc+10)});
    v.push({x:sx+dist*0.50, y:clampY(junc+50)});
    v.push({x:sx+dist*0.58, y:clampY(junc+10)});
    const prong = clampY(junc - 14);
    const cx = sx + dist*0.78;
    v.push({x:cx-50, y:prong});
    v.push({x:cx, y:prong, cup:true});
    v.push({x:cx+50, y:prong});
    v.push({x:endX, y:prong});
    return v;
  },

  undercut_cliff(sx, sy, dist, cupY, diff) {
    const endX = sx + dist, base = clampY(sy);
    const v = [{x:sx, y:base}];
    v.push({x:sx+dist*0.20, y:base});
    const shelfY = clampY(base + 70 + 40*diff);
    v.push({x:sx+dist*0.26, y:clampY(base+40)});
    v.push({x:sx+dist*0.32, y:shelfY});
    const cx = sx + dist*0.52;
    v.push({x:cx-52, y:shelfY});
    v.push({x:cx, y:shelfY, cup:true});
    v.push({x:cx+52, y:shelfY});
    v.push({x:cx+72, y:shelfY});
    v.push({x:endX, y:shelfY});
    const roofY = clampY(shelfY - (BALL_RADIUS*4 + 22) - 6);
    _emitOverhang([
      {x:sx+dist*0.30, y:roofY},
      {x:cx+60, y:roofY},
      {x:cx+60, y:clampY(roofY-50)},
      {x:sx+dist*0.30, y:clampY(roofY-70)},
    ]);
    return v;
  },

  gatehouse_bridge(sx, sy, dist, cupY, diff) {
    const endX = sx + dist, base = clampY(sy);
    const v = [{x:sx, y:base}];
    const ground = clampY(base + 30);
    const moat = clampY(base + 80 + 30*diff);
    v.push({x:sx+dist*0.10, y:ground});
    v.push({x:sx+dist*0.22, y:ground});
    v.push({x:sx+dist*0.23, y:clampY(base-50-30*diff)});
    v.push({x:sx+dist*0.30, y:clampY(base-50-30*diff)});
    v.push({x:sx+dist*0.31, y:ground});
    v.push({x:sx+dist*0.36, y:moat});
    const deck = clampY(moat - 10);
    const cx = sx + dist*0.55;
    v.push({x:cx-50, y:deck});
    v.push({x:cx, y:deck, cup:true});
    v.push({x:cx+50, y:deck});
    v.push({x:sx+dist*0.74, y:moat});
    v.push({x:sx+dist*0.78, y:ground});
    v.push({x:sx+dist*0.79, y:clampY(base-50-30*diff)});
    v.push({x:sx+dist*0.86, y:clampY(base-50-30*diff)});
    v.push({x:sx+dist*0.87, y:ground});
    v.push({x:endX, y:ground});
    return v;
  },

  coral_fan(sx, sy, dist, cupY, diff) {
    const endX = sx + dist, base = clampY(sy);
    const v = [{x:sx, y:base}];
    const floor = clampY(base + 40);
    v.push({x:sx+dist*0.10, y:floor});
    const n = 5 + Math.round(diff*3);
    const s=sx+dist*0.16, e=sx+dist*0.56, w=(e-s)/n;
    for (let i=0;i<n;i++){
      const px=s+i*w;
      const arc=Math.sin((i/(n-1))*Math.PI);
      const h=20+arc*(50+50*diff);
      v.push({x:px, y:floor});
      v.push({x:px+6, y:clampY(floor-h)});
      v.push({x:px+12, y:floor});
    }
    const cx = sx + dist*0.78;
    v.push({x:cx-50, y:floor});
    v.push({x:cx, y:floor, cup:true});
    v.push({x:cx+50, y:floor});
    v.push({x:endX, y:floor});
    return v;
  },

  tunnel_mouth(sx, sy, dist, cupY, diff) {
    const endX = sx + dist, base = clampY(sy);
    const v = [{x:sx, y:base}];
    const floor = clampY(base + 30);
    v.push({x:sx+dist*0.12, y:floor});
    const mouthX = sx + dist*0.30;
    v.push({x:mouthX, y:floor});
    const cx = sx + dist*0.55;
    v.push({x:cx-54, y:floor});
    v.push({x:cx, y:floor, cup:true});
    v.push({x:cx+54, y:floor});
    const exitX = sx + dist*0.80;
    v.push({x:exitX, y:floor});
    v.push({x:endX, y:floor});
    const roofY = clampY(floor - (BALL_RADIUS*4 + 22));
    _emitOverhang([
      {x:mouthX, y:roofY},
      {x:exitX, y:roofY},
      {x:exitX, y:clampY(roofY-24)},
      {x:mouthX, y:clampY(roofY-24)},
    ]);
    return v;
  },

  solar_gantry(sx, sy, dist, cupY, diff) {
    const endX = sx + dist, base = clampY(sy);
    const v = [{x:sx, y:base}];
    const ground = clampY(base + 70);
    const deck = clampY(base - 10 - 20*diff);
    v.push({x:sx+dist*0.10, y:ground});
    v.push({x:sx+dist*0.18, y:ground});
    v.push({x:sx+dist*0.22, y:deck});
    const cx = sx + dist*0.50;
    v.push({x:cx-54, y:deck});
    v.push({x:cx, y:deck, cup:true});
    v.push({x:cx+54, y:deck});
    v.push({x:sx+dist*0.70, y:deck});
    v.push({x:sx+dist*0.74, y:ground});
    v.push({x:sx+dist*0.80, y:ground});
    v.push({x:sx+dist*0.84, y:deck});
    v.push({x:endX, y:deck});
    return v;
  },

  accordion_fins(sx, sy, dist, cupY, diff) {
    const endX = sx + dist, base = clampY(sy);
    const v = [{x:sx, y:base}];
    const floor = clampY(base + 30);
    v.push({x:sx+dist*0.08, y:floor});
    const n = 4 + Math.round(diff*2);
    const s=sx+dist*0.12, e=sx+dist*0.62, w=(e-s)/n;
    const h = 40+30*diff;
    for (let i=0;i<n;i++){
      const px=s+i*w;
      v.push({x:px, y:floor});
      v.push({x:px+w*0.45, y:clampY(floor-h)});
      v.push({x:px+w*0.62, y:clampY(floor-h)});
      v.push({x:px+w*0.66, y:floor});
    }
    const cx = sx + dist*0.82;
    v.push({x:cx-50, y:floor});
    v.push({x:cx, y:floor, cup:true});
    v.push({x:cx+50, y:floor});
    v.push({x:endX, y:floor});
    return v;
  },

  clamshell_grotto(sx, sy, dist, cupY, diff) {
    const endX = sx + dist, base = clampY(sy);
    const v = [{x:sx, y:base}];
    const floor = clampY(base + 70 + 40*diff);
    for (let x=sx; x<=sx+dist*0.44; x+=14){
      const t=(x-sx)/(dist*0.44);
      v.push({x, y:clampY(lerp(base+10, floor, Math.sin(t*Math.PI*0.5)))});
    }
    const cx = sx + dist*0.54;
    v.push({x:cx-46, y:floor});
    v.push({x:cx, y:floor, cup:true});
    v.push({x:cx+46, y:floor});
    for (let x=cx+46; x<=endX; x+=14){
      const t=(x-(cx+46))/(endX-(cx+46));
      v.push({x, y:clampY(lerp(floor, base+10, Math.sin(t*Math.PI*0.5)))});
    }
    v.push({x:endX, y:base});
    const roofY = clampY(floor - (BALL_RADIUS*4 + 22) - 18);
    const crown = clampY(roofY - 30);
    _emitOverhang([
      {x:sx+dist*0.30, y:clampY(base+20)},
      {x:cx, y:crown},
      {x:cx+70, y:roofY},
      {x:cx+70, y:clampY(roofY-26)},
      {x:cx, y:clampY(crown-26)},
      {x:sx+dist*0.30, y:clampY(base-4)},
    ]);
    return v;
  },

  silo_cluster(sx, sy, dist, cupY, diff) {
    const endX = sx + dist, base = clampY(sy);
    const v = [{x:sx, y:base}];
    const ground = clampY(base + 30);
    v.push({x:sx+dist*0.08, y:ground});
    const sh = 50+30*diff;
    v.push({x:sx+dist*0.14, y:clampY(ground-sh*0.5)});
    v.push({x:sx+dist*0.20, y:clampY(ground-sh)});
    v.push({x:sx+dist*0.26, y:clampY(ground-sh*0.5)});
    const cx = sx + dist*0.42;
    const saddleY = clampY(ground-10);
    v.push({x:cx-48, y:saddleY});
    v.push({x:cx, y:saddleY, cup:true});
    v.push({x:cx+48, y:saddleY});
    v.push({x:sx+dist*0.66, y:clampY(ground-sh*0.5)});
    v.push({x:sx+dist*0.72, y:clampY(ground-sh)});
    v.push({x:sx+dist*0.78, y:clampY(ground-sh*0.5)});
    v.push({x:sx+dist*0.84, y:ground});
    v.push({x:endX, y:ground});
    return v;
  },

  spiral_ramp(sx, sy, dist, cupY, diff) {
    const endX = sx + dist, base = clampY(sy);
    const v = [{x:sx, y:base}];
    const ground = clampY(base + 40);
    v.push({x:sx+dist*0.08, y:ground});
    const flights = 3 + Math.round(diff*2);
    let x=sx+dist*0.12, y=ground;
    const fw=(dist*0.55)/flights, rise=(ground - clampY(base-60-40*diff))/flights;
    for (let i=0;i<flights;i++){
      v.push({x:x, y});
      y=clampY(y-rise);
      v.push({x:x+fw*0.7, y});
      v.push({x:x+fw, y});
      x+=fw;
    }
    const cx = x + dist*0.06;
    v.push({x:cx-46, y});
    v.push({x:cx, y, cup:true});
    v.push({x:cx+46, y});
    v.push({x:cx+58, y:clampY(y+50)});
    v.push({x:cx+70, y:ground});
    v.push({x:endX, y:ground});
    return v;
  },
};

// ── Archetype Selection ──────────────────────────────────────
// Weights and difficulty ranges tuned from real Desert Golfing gameplay footage.
// Early game (diff 0-0.3): simple slopes, gentle hills, flat runs
// Mid game (diff 0.3-0.6): cliffs, valleys, mesas, steps
// Late game (diff 0.6+): canyons, pockets, fortresses, narrow gaps, compound
// Each entry: [archetypeName, minDifficulty, maxDifficulty, weight]
const ARCHETYPE_TABLE = [
  // Easy — gentle terrain, available from the start
  ['flat_run',         0.0, 1.0, 3],
  ['gentle_slope',     0.0, 0.7, 3],
  ['gentle_hill',      0.0, 0.7, 3],
  // Easy-Med — slopes with character
  ['downhill',         0.0, 1.0, 4],
  ['uphill',           0.05, 1.0, 3],
  ['rolling_hills',    0.1, 1.0, 3],
  // Medium — angular features appear
  ['cliff_drop',       0.15, 1.0, 3],
  ['valley',           0.15, 1.0, 3],
  ['shelf',            0.2, 1.0, 3],
  ['mesa',             0.25, 1.0, 2],
  // Med-Hard — dramatic geometry
  ['peak_obstacle',    0.3, 1.0, 3],
  ['wall_shot',        0.35, 1.0, 2],
  ['stepped_descent',  0.3, 1.0, 2],
  ['canyon',           0.35, 1.0, 2],
  // Hard — complex multi-feature terrain
  ['twin_peaks',       0.4, 1.0, 2],
  ['deep_pocket',      0.45, 1.0, 2],
  ['canyon_cup',       0.5, 1.0, 2],
  ['fortress',         0.5, 1.0, 2],
  ['narrow_gap',       0.55, 1.0, 2],
  ['cliff_shelf',      0.5, 1.0, 2],
  ['compound_terrain', 0.6, 1.0, 3],
  // Dramatic — extreme elevation, full screen terrain
  ['deep_plunge',      0.3, 1.0, 3],
  ['cliff_valley_climb', 0.3, 1.0, 3],
  ['dramatic_ridge',   0.2, 1.0, 3],
  ['shelf_drop_shelf', 0.2, 1.0, 3],
  ['water_valley',     0.3, 1.0, 2],
];

// Anti-repetition: track last 3 archetypes to halve their selection weight
const _recentArchetypes = [];

function pickArchetype(difficulty) {
  if (_archetypeOverride && archetypes[_archetypeOverride]) {
    return _archetypeOverride;
  }
  // Filter to archetypes available at this difficulty, then weighted random
  // If the current course defines an archetype subset, only pick from those
  const courseArchetypes = currentCourse?.archetypes || null;
  let available = ARCHETYPE_TABLE.filter(
    ([name, minD, maxD]) => difficulty >= minD
      && (!courseArchetypes || courseArchetypes.includes(name))
  );
  // Fallback: if nothing matches at this difficulty, allow all course archetypes regardless of minD
  if (available.length === 0 && courseArchetypes) {
    available = ARCHETYPE_TABLE.filter(([name]) => courseArchetypes.includes(name));
  }
  // Ultimate fallback: pick from everything
  if (available.length === 0) {
    available = ARCHETYPE_TABLE;
  }
  // Pool MULTIPLICITY as a weight lever: a course pool may list an archetype more than once to bias toward
  // it (P3 uses this so 'complex_composite' grows its share with complexity). Count occurrences in the
  // course pool (default 1 when no pool / not listed) and scale the base weight by it.
  const _poolMult = (name) => {
    if (!courseArchetypes) return 1;
    let n = 0; for (const a of courseArchetypes) if (a === name) n++;
    return n > 0 ? n : 1;
  };
  // Apply anti-repetition: halve weight if archetype was used in last 3 holes
  const weights = available.map(([name, , , w]) =>
    (_recentArchetypes.includes(name) ? w * 0.5 : w) * _poolMult(name)
  );
  const totalWeight = weights.reduce((sum, w) => sum + w, 0);
  let roll = random() * totalWeight;
  let picked = available[available.length - 1][0];
  for (let i = 0; i < available.length; i++) {
    roll -= weights[i];
    if (roll <= 0) { picked = available[i][0]; break; }
  }
  // Update recent history
  _recentArchetypes.push(picked);
  if (_recentArchetypes.length > 5) _recentArchetypes.shift();   // longer memory → a 9-hole course rarely repeats a shape
  return picked;
}

// ── FACETED archetype (the new Golf-on-Mars-style generator for Earth) ───────────────────────────
// FEW LONG facets: flat segments (the ball can stop on them → shot variety) + straight angular slopes
// + occasional gentle curvature. Returns verts from sx to sx+dist, ending on a flat green at the cup.
archetypes.faceted = function (sx, sy, dist, cupY, diff) {
  const TOP = H * 0.18, BOT = H * 0.86;
  const cupAtX = sx + dist, greenStart = cupAtX - 100;
  const verts = [];
  let x = sx + 20 + random() * 40, y = sy; verts.push({ x, y });
  while (x < greenStart - 20) {
    const t = random();
    if (t < 0.48) {                                  // FLAT facet
      const len = Math.min(greenStart - 20 - x, 85 + random() * 165); x += len; verts.push({ x, y });
    } else if (t < 0.82) {                            // STRAIGHT angular slope
      const len = 55 + random() * 100, dy = (random() < 0.5 ? -1 : 1) * (40 + random() * 115 + diff * 45);
      x = Math.min(greenStart - 20, x + len); y = Math.max(TOP, Math.min(BOT, y + dy)); verts.push({ x, y });
    } else {                                          // OCCASIONAL gentle curve (a few short steps)
      const dyT = (random() < 0.5 ? -1 : 1) * (40 + random() * 60);
      for (let k = 0; k < 3 && x < greenStart - 20; k++) { x = Math.min(greenStart - 20, x + 24 + random() * 22); y = Math.max(TOP, Math.min(BOT, y + dyT * (k === 1 ? 1 : 0.55))); verts.push({ x, y }); }
    }
  }
  const greenY = y;
  verts.push({ x: greenStart, y: greenY });           // flat green approach
  verts.push({ x: cupAtX, y: greenY });               // green pad (cup sits here)
  return verts;
};
ARCHETYPE_TABLE.push(['faceted', 0.0, 1.0, 1]);       // so pickArchetype selects it for faceted courses
ARCHETYPE_TABLE.push(['gom', 0.0, 5.0, 1]);           // the GoM generator, selectable at every difficulty (?course=gom)
ARCHETYPE_TABLE.push(['gom_smooth', 0.0, 5.0, 1]);    // GoM smooth-terrain style (mixes with 'gom' in the gom courses)
ARCHETYPE_TABLE.push(['gom_islands', 0.0, 5.0, 1]);   // archipelago islands+troughs (water planets, ?course=sea/atoll)
ARCHETYPE_TABLE.push(['gom_lake', 0.0, 5.0, 1]);      // one big carry-the-lake basin (water planet, ?course=lakes)
ARCHETYPE_TABLE.push(['spire_drown', 0.0, 5.0, 1]);   // cup on a monolith over a flooded abyss (deep-water worlds)
ARCHETYPE_TABLE.push(['cenote', 0.0, 5.0, 1]);        // carry a flooded sinkhole to the far rim
ARCHETYPE_TABLE.push(['gauntlet', 0.0, 5.0, 1]);      // stepping-stone spires across a drowned rift
ARCHETYPE_TABLE.push(['island_green', 0.0, 5.0, 1]);  // cup on a mid-water island (cup-anywhere)
ARCHETYPE_TABLE.push(['sea_stack', 0.0, 5.0, 1]);     // cup crowns a freestanding monolith in deep water
ARCHETYPE_TABLE.push(['crater', 0.0, 5.0, 1]);        // cup in a bowl atop a raised rim
ARCHETYPE_TABLE.push(['punchbowl', 0.0, 5.0, 1]);     // forgiving funnel that gathers to the cup
ARCHETYPE_TABLE.push(['ziggurat', 0.0, 5.0, 1]);      // stepped climb to a cup on the top terrace
ARCHETYPE_TABLE.push(['ruins', 0.0, 5.0, 1]);         // special: colonnade of broken columns, cup among them
ARCHETYPE_TABLE.push(['launchpad', 0.0, 5.0, 1]);     // special: launch platform + gantry, cup on the pad
ARCHETYPE_TABLE.push(['obelisk', 0.0, 5.0, 1]);       // special: a lone monolith, cup at its foot
// ── NEW: generic variance archetypes ──
ARCHETYPE_TABLE.push(['sky_terrace', 0.0, 5.0, 1]);
ARCHETYPE_TABLE.push(['flat_top_butte', 0.0, 5.0, 1]);
ARCHETYPE_TABLE.push(['summit_saddle', 0.0, 5.0, 1]);
ARCHETYPE_TABLE.push(['chasm_carry', 0.0, 5.0, 1]);
ARCHETYPE_TABLE.push(['stepping_stones', 0.0, 5.0, 1]);
ARCHETYPE_TABLE.push(['moat_island_flat', 0.0, 5.0, 1]);
ARCHETYPE_TABLE.push(['funnel_gather', 0.0, 5.0, 1]);
ARCHETYPE_TABLE.push(['washboard_cradle', 0.0, 5.0, 1]);
ARCHETYPE_TABLE.push(['banked_curve', 0.0, 5.0, 1]);
ARCHETYPE_TABLE.push(['amphitheatre', 0.0, 5.0, 1]);
ARCHETYPE_TABLE.push(['crashed_hull', 0.0, 5.0, 1]);
ARCHETYPE_TABLE.push(['geyser_cones', 0.0, 5.0, 1]);
// ── NEW: TRAPPIST-1 system archetypes ──
ARCHETYPE_TABLE.push(['tidal_terminator', 0.0, 5.0, 1]);
ARCHETYPE_TABLE.push(['melt_basin_shelf', 0.0, 5.0, 1]);
ARCHETYPE_TABLE.push(['granulation_cells', 0.0, 5.0, 1]);
ARCHETYPE_TABLE.push(['sunspot_basin', 0.0, 5.0, 1]);
ARCHETYPE_TABLE.push(['pressure_ridge', 0.0, 5.0, 1]);
ARCHETYPE_TABLE.push(['frozen_lake', 0.0, 5.0, 1]);
ARCHETYPE_TABLE.push(['caldera_shelf', 0.0, 5.0, 1]);
ARCHETYPE_TABLE.push(['collapsed_lava_tube', 0.0, 5.0, 1]);
// ── NEW: Barnard's Star system archetypes ──
ARCHETYPE_TABLE.push(['weed_mat_drift', 0.0, 5.0, 1]);
ARCHETYPE_TABLE.push(['weed_mat_cluster', 0.0, 5.0, 1]);
ARCHETYPE_TABLE.push(['twilight_shelf', 0.0, 5.0, 1]);
ARCHETYPE_TABLE.push(['forest_clearing', 0.0, 5.0, 1]);
ARCHETYPE_TABLE.push(['cloud_deck_ascension', 0.0, 5.0, 1]);
ARCHETYPE_TABLE.push(['cloud_break_landing', 0.0, 5.0, 1]);
ARCHETYPE_TABLE.push(['veil_plume_field', 0.0, 5.0, 1]);
ARCHETYPE_TABLE.push(['ice_crust_rift', 0.0, 5.0, 1]);
// P3: the multi-feature complexity spine — feature count + drama scale with difficulty.
ARCHETYPE_TABLE.push(['complex_composite', 0.0, 5.0, 1]);
// P4: cave / overhang archetypes (designed heightfield floor + an authored solid roof/lip slab).
ARCHETYPE_TABLE.push(['cup_under_lip', 0.0, 5.0, 1]);
ARCHETYPE_TABLE.push(['putt_cave', 0.0, 5.0, 1]);
ARCHETYPE_TABLE.push(['arch_under', 0.0, 5.0, 1]);

// ── P5: register the 100+ new archetypes — wrap each in _monoArch (X-monotone) + add to the pool ──
const P5_ARCHETYPE_CATS = {
  jagged_rock_fins: 'PEAK_RIDGE',
  needle_spire_crown: 'PEAK_RIDGE',
  twin_tower_gateway: 'STRUCTURE',
  tilted_flatiron: 'PLATEAU_MESA',
  stepped_pyramid_notch: 'PLATEAU_MESA',
  layered_cake_butte: 'PLATEAU_MESA',
  anvil_rock: 'PEAK_RIDGE',
  domed_knoll_cluster: 'WAVE_ROLLING',
  table_mountain_saddle: 'PLATEAU_MESA',
  serrated_comb: 'PEAK_RIDGE',
  leaning_tower: 'STRUCTURE',
  crouching_sphinx: 'PEAK_RIDGE',
  radiating_ridge_fan: 'PEAK_RIDGE',
  castle_battlement: 'STRUCTURE',
  hoodoo_field: 'PEAK_RIDGE',
  cathedral_spires: 'STRUCTURE',
  shark_fin_ridge: 'PEAK_RIDGE',
  double_decker_mesa: 'PLATEAU_MESA',
  matterhorn_col: 'PEAK_RIDGE',
  slot_mesa_pocket: 'PLATEAU_MESA',
  ascending_peak_stair: 'PEAK_RIDGE',
  undercut_mesa: 'PLATEAU_MESA',
  molar_ridge: 'PEAK_RIDGE',
  wedge_ramp_mesa: 'PLATEAU_MESA',
  knife_edge_arete: 'PEAK_RIDGE',
  split_mesa_chasm: 'PLATEAU_MESA',
  volcano_crater_cup: 'PEAK_RIDGE',
  halfpipe_gather: 'BASIN_BOWL',
  horseshoe_bay: 'BASIN_BOWL',
  double_bowl_saddle: 'BASIN_BOWL',
  shallow_saucer_pin: 'BASIN_BOWL',
  teacup_saucer: 'BASIN_BOWL',
  kettle_pond: 'BASIN_BOWL',
  sine_swell_run: 'WAVE_ROLLING',
  washboard_humps: 'WAVE_ROLLING',
  smooth_s_curve: 'WAVE_ROLLING',
  amphitheater_hollow: 'BASIN_BOWL',
  cloverleaf_bowls: 'BASIN_BOWL',
  spiral_gather: 'BASIN_BOWL',
  quilted_dunes: 'WAVE_ROLLING',
  bermed_basin: 'BASIN_BOWL',
  river_valley: 'WAVE_ROLLING',
  caldera_dish: 'BASIN_BOWL',
  terraced_bowl: 'BASIN_BOWL',
  scoop_catch: 'BASIN_BOWL',
  rolling_moguls: 'WAVE_ROLLING',
  damped_ripple: 'WAVE_ROLLING',
  funnel_chute: 'BASIN_BOWL',
  ocean_groundswell: 'WAVE_ROLLING',
  lilypad_pockets: 'BASIN_BOWL',
  corduroy_flat: 'WAVE_ROLLING',
  crescent_dune_bay: 'BASIN_BOWL',
  chirp_swells: 'WAVE_ROLLING',
  twin_lobe_valley: 'BASIN_BOWL',
  billowing_hills: 'WAVE_ROLLING',
  slot_canyon_carry: 'GAP_CARRY',
  archipelago_hop: 'GAP_CARRY',
  broken_bridge_pillar: 'GAP_CARRY',
  moat_ringed_plateau: 'GAP_CARRY',
  double_chasm_rest: 'GAP_CARRY',
  fjord_crossing: 'GAP_CARRY',
  catwalk_pads: 'GAP_CARRY',
  leapfrog_risers: 'GAP_CARRY',
  land_bridge_neck: 'GAP_CARRY',
  sinkhole_off_tee: 'GAP_CARRY',
  crevasse_to_clifftop: 'GAP_CARRY',
  twin_slot_mesa: 'GAP_CARRY',
  drawbridge_leap: 'GAP_CARRY',
  keyhole_canyon: 'GAP_CARRY',
  valley_of_steps: 'STAIR_TERRACE',
  switchback_ramp: 'STAIR_TERRACE',
  rice_paddy_terraces: 'STAIR_TERRACE',
  zigzag_ledge_climb: 'STAIR_TERRACE',
  stepped_mesa_tier2: 'STAIR_TERRACE',
  sunken_stadium: 'STAIR_TERRACE',
  temple_grand_staircase: 'STAIR_TERRACE',
  dropped_shelf_cascade: 'STAIR_TERRACE',
  stair_up_cliff_down: 'STAIR_TERRACE',
  split_level_benches: 'STAIR_TERRACE',
  pyramid_step_apex: 'STAIR_TERRACE',
  descending_sump_stairs: 'STAIR_TERRACE',
  staircase_gap_staircase: 'STAIR_TERRACE',
  rock_arch_bridge: 'CAVE_OVERHANG',
  colonnade_cloister: 'STRUCTURE',
  halfpipe_tube: 'CAVE_OVERHANG',
  aqueduct_arches: 'STRUCTURE',
  ziggurat_chamber: 'CAVE_OVERHANG',
  mushroom_rock: 'CAVE_OVERHANG',
  cantilever_ledge: 'STRUCTURE',
  sea_arch_lagoon: 'CAVE_OVERHANG',
  crystal_cluster: 'EXOTIC',
  honeycomb_pockets: 'EXOTIC',
  derelict_hull_ramp: 'STRUCTURE',
  radio_dish: 'STRUCTURE',
  pyramid_temple: 'STRUCTURE',
  pylon_base: 'STRUCTURE',
  dragon_back: 'EXOTIC',
  piano_keys: 'EXOTIC',
  lightning_zigzag: 'EXOTIC',
  y_fork_plateau: 'EXOTIC',
  undercut_cliff: 'CAVE_OVERHANG',
  gatehouse_bridge: 'STRUCTURE',
  coral_fan: 'EXOTIC',
  tunnel_mouth: 'CAVE_OVERHANG',
  solar_gantry: 'STRUCTURE',
  accordion_fins: 'EXOTIC',
  silo_cluster: 'STRUCTURE',
  spiral_ramp: 'EXOTIC',
};
for (const _n in P5_ARCHETYPE_CATS) {
  if (archetypes[_n]) {
    archetypes[_n] = _monoArch(archetypes[_n]);            // force X-monotone output
    ARCHETYPE_TABLE.push([_n, 0.0, 5.0, 1]);               // selectable at every difficulty
  }
}
// expose the category map so courses/curation can pick a varied set by silhouette
if (typeof window !== 'undefined') window.P5_ARCHETYPE_CATS = P5_ARCHETYPE_CATS;


// TEST FIXTURE (NOT in any course pool — force via the lab's "⛰ Terrain-pop test hole" button or
// setArchetypeOverride('strata_test')). A deliberate WORST CASE for the terrain-strata colour pop: a tall peak
// + deep pit + greens of several depths packed into one screen, so EVERY rock-strata band shows at once and any
// per-view recolour on a camera move / hole transition is glaring. (Terrain colour in the default textured
// mode is the depth strata, not per-vertex materials — so a depth-varied hole like this is the right probe.)
// Rule of thumb: for any visual bug, build a hole that exaggerates it and test against THAT, not the wild.
archetypes.strata_test = function (sx, sy, dist, cupY, diff) {
  const d = Math.min(dist, 760);
  const green = clampY(H * 0.62);
  const peak = clampY(H * randRange(0.10, 0.34));   // RANDOM per hole → consecutive holes differ maximally,
  const deep = clampY(H * randRange(0.80, 0.95));   //   which is exactly what would swing a per-regen strata
  const mid  = clampY(H * randRange(0.34, 0.48));   //   anchor — the hardest stress for the recolour pop
  return [
    { x: sx,            y: green },               // tee on a flat green
    { x: sx + d * 0.08, y: green },
    { x: sx + d * 0.14, y: peak },                // tall peak — lightest strata
    { x: sx + d * 0.22, y: peak },
    { x: sx + d * 0.26, y: deep },                // deep pit — darkest strata
    { x: sx + d * 0.38, y: deep },
    { x: sx + d * 0.42, y: mid },
    { x: sx + d * 0.50, y: green },
    { x: sx + d * 0.58, y: peak },                // second peak
    { x: sx + d * 0.66, y: deep },                // second pit
    { x: sx + d * 0.74, y: green },
    { x: sx + d * 0.88, y: green, cup: true },    // cup on a flat green near the END, so the dramatic
    { x: sx + d,        y: green }                //   terrain sits BETWEEN tee and cup → rendered + framed
  ];
};

// ── CURVY / HILLY archetypes (REVIEW SET, 2026-06-21) ────────────────────────────────────────────────────
// The pools read very angular; these build SMOOTH terrain from dense vertices (~12px) sampling smooth
// functions, so the straight-segment heightfield reads as curves. In the lab hole-type tour for review;
// deliberately NOT in ARCHETYPE_TABLE / any course pool yet — add them there once you approve the look.
// Cups sit in gathering valleys or on flat greens so they stay sinkable.
archetypes.smooth_bowl = function (sx, sy, dist, cupY, diff) {            // smooth parabolic gathering bowl
  const v = [], rim = clampY(H * 0.40), depth = 90 + (diff || 0) * 70, cx = dist * 0.5;
  for (let x = 0; x <= dist; x += 12) { const t = (x - cx) / (dist * 0.5); v.push({ x: sx + x, y: clampY(rim + depth * (1 - t * t)) }); }
  let ci = 2, my = -1; for (let i = 2; i < v.length - 2; i++) if (v[i].y > my) { my = v[i].y; ci = i; }
  v[ci].cup = true; v[ci - 1].y = v[ci].y; v[ci + 1].y = v[ci].y;          // tiny flat at the bottom
  return v;
};
archetypes.rolling_dunes = function (sx, sy, dist, cupY, diff) {          // 2–3 smooth dunes, cup in a valley
  const v = [], base = clampY(H * 0.60), amp = 42 + (diff || 0) * 38, n = 2 + Math.round(random() * 1.5);
  for (let x = 0; x <= dist; x += 14) { const t = x / dist, env = Math.pow(Math.sin(t * Math.PI), 0.55); v.push({ x: sx + x, y: clampY(base - amp * env * Math.cos(t * Math.PI * 2 * n)) }); }
  let ci = -1, my = -1; for (let i = Math.floor(v.length * 0.55); i < v.length - 2; i++) if (v[i].y > my) { my = v[i].y; ci = i; }
  if (ci > 0) { v[ci].cup = true; v[ci - 1].y = v[ci].y; v[ci + 1].y = v[ci].y; }
  return v;
};
archetypes.ocean_swells = function (sx, sy, dist, cupY, diff) {           // smooth low swells → flat green + cup
  const v = [], base = clampY(H * 0.56), amp = 26 + (diff || 0) * 24, green = clampY(H * 0.58);
  for (let x = 0; x <= dist * 0.72; x += 12) { const t = x / dist; v.push({ x: sx + x, y: clampY(base - amp * Math.sin(t * Math.PI * 6)) }); }
  v.push({ x: sx + dist * 0.80, y: green }); v.push({ x: sx + dist * 0.90, y: green, cup: true }); v.push({ x: sx + dist, y: green });
  return v;
};
archetypes.gentle_knoll = function (sx, sy, dist, cupY, diff) {           // one smooth gaussian hill → flat green behind
  const v = [], flat = clampY(H * 0.64), rise = 90 + (diff || 0) * 55, kc = dist * 0.42;
  for (let x = 0; x <= dist * 0.7; x += 12) { const t = (x - kc) / (dist * 0.30); v.push({ x: sx + x, y: clampY(flat - rise * Math.exp(-t * t * 1.6)) }); }
  v.push({ x: sx + dist * 0.80, y: flat }); v.push({ x: sx + dist * 0.90, y: flat, cup: true }); v.push({ x: sx + dist, y: flat });
  return v;
};

// LAB TOUR: expose every hole-type name + an override setter so the lab can step through them one by one.
if (typeof window !== 'undefined') {
  window.ARCHETYPE_NAMES = Object.keys(archetypes);                 // all polygon hole-types (incl. the new ones)
  window.setArchetypeOverride = function (n) { _archetypeOverride = (n && archetypes[n]) ? n : null; return _archetypeOverride; };
}

// ── Main Terrain Generation ──────────────────────────────
function generateHoleTerrain(holeIndex) {
  // Moon: polygon terrain with overhangs / carved caves (see moon-terrain.js)
  if (currentCourse && currentCourse.gen === 'field' && typeof generateMoonHole === 'function') {
    return generateMoonHole(holeIndex);
  }
  // Weird: true 2D field terrain — interlocking plates, overhangs, caves (see weird-terrain.js)
  if (currentCourse && currentCourse.gen === 'weird' && typeof generateWeirdHole === 'function') {
    return generateWeirdHole(holeIndex);
  }
  // Use hand-defined hole if available
  const isDesertWorld = !currentWorld || currentWorld === WORLDS['desert-world-1'];
  if (isDesertWorld && HAND_DEFINED_HOLES[holeIndex]) {
    return generateHandDefinedHole(holeIndex);
  }

  // Check for course-specific reference holes (e.g. recreated from real Desert Golfing)
  if (currentCourse?.handDefinedSource && typeof window !== 'undefined') {
    const sourceArray = window[currentCourse.handDefinedSource];
    if (sourceArray && sourceArray[holeIndex]) {
      // Temporarily inject into HAND_DEFINED_HOLES and generate
      const saved = HAND_DEFINED_HOLES[holeIndex];
      HAND_DEFINED_HOLES[holeIndex] = sourceArray[holeIndex];
      generateHandDefinedHole(holeIndex);
      HAND_DEFINED_HOLES[holeIndex] = saved;
      return;
    }
  }

  let difficulty = getDifficulty(holeIndex);
  // EASY OPENER (portrait / roguelike): the log difficulty ramp barely moves across a 5-hole course, so the
  // first hole wasn't a clearly gentle start. Cap hole 0's difficulty low so EVERY course opens on the easy
  // side. Gated on portrait so the landscape game is byte-unchanged.
  if (holeIndex === 0 && typeof window !== 'undefined' && window.RG_PORTRAIT) {
    difficulty = Math.min(difficulty, 0.15);
  }

  // Determine tee position
  let teeX, teeY;
  if (holeIndex === 0) {
    teeX = 100;
    teeY = H * 0.65;
    // Seed initial terrain: flat run up to tee area
    if (vertices.length === 0) {
      vertices.push({ x: -100, y: teeY });
      vertices.push({ x: teeX - 20, y: teeY });
    }
  } else {
    teeX = holes[holeIndex - 1].cupX;
    teeY = holes[holeIndex - 1].cupY;
  }

  // Determine hole distance — must fit in viewport (W minus camera margins)
  // Use at least 960 for W to avoid tiny holes in small preview windows
  const effectiveW = Math.max(960, W);
  // Inert-by-default hook (same class as the clampY band): an experimental planet (?atlas drive-far)
  // may raise the one-screen distance cap so a hole can stretch across many screens (its own chase-cam
  // follows the ball). RG._holeDistCap is null in the shipped game → the base loop is unchanged.
  const maxDist = (typeof window !== 'undefined' && window.RG && window.RG._holeDistCap)
    ? window.RG._holeDistCap
    : (effectiveW - 150); // leave room for margins + flag + background visibility
  // Courses may shrink the distance range (the roguelike wants short, easy holes);
  // omitting these preserves the original game's distances exactly.
  const dMin = (currentCourse && currentCourse.holeDistMin != null) ? currentCourse.holeDistMin : HOLE_DIST_MIN;
  const dMax = (currentCourse && currentCourse.holeDistMax != null) ? currentCourse.holeDistMax : HOLE_DIST_MAX;
  const rawDist = dMin + random() * (dMax - dMin) + difficulty * 100;
  const dist = Math.min(rawDist, maxDist);

  // Determine cup target elevation
  // Courses can override elevation logic (e.g. Mars has different distribution)
  let cupTargetY;
  if (currentCourse?.cupElevation) {
    cupTargetY = currentCourse.cupElevation(teeY, difficulty);
  } else {
    // Real Desert Golfing: 74% ball higher than hole (downhill to cup)
    // (analysis of 509 ball-hole pairs from real game footage)
    const elevRoll = random();
    if (elevRoll < 0.10) {
      // Same level (10%)
      cupTargetY = clampY(teeY + (random() - 0.5) * 20);
    } else if (elevRoll < 0.25) {
      // Cup higher = uphill shot (15%)
      cupTargetY = clampY(teeY - randRange(30, 60 + difficulty * 80));
    } else {
      // Cup lower = downhill shot (75%)
      cupTargetY = clampY(teeY + randRange(30, 60 + difficulty * 80));
    }
  }

  // Pick archetype and generate vertices
  // Special signature holes: a course may force archetypes at given hole indices (ruins/launchpad/obelisk).
  // Supports a single specialHole/specialHoleAt OR a specialHoles:[{a,at},...] list (1–2 per course).
  let _special = null;
  if (currentCourse) {
    if (currentCourse.specialHole && holeIndex === currentCourse.specialHoleAt && archetypes[currentCourse.specialHole]) _special = currentCourse.specialHole;
    else if (currentCourse.specialHoles) { for (const sh of currentCourse.specialHoles) { if (sh.at === holeIndex && archetypes[sh.a]) { _special = sh.a; break; } } }
  }
  const archName = _special || pickArchetype(difficulty);
  const archFunc = archetypes[archName];
  const startX = teeX + 40; // small gap after tee
  _archOverhangSpecs = [];                    // P4: collect any cave/overhang slabs this archetype emits
  let rawVerts = archFunc(startX, teeY, dist, cupTargetY, difficulty);

  // No terrain validation — the autogolfer handles all terrain via simulation.

  // Add micro-noise: subdivide long segments with subtle perturbations.
  // FACETED courses (Earth, in this port) skip micro-noise so the long straight facets stay clean.
  // 'composed' (the DREAM pipeline, gated to Tau Ceti) ALSO skips it — the holegen skin pass already owns the
  // faceted noise/terrace, and micro-noise would corrupt the cave/floating flat pads + drop the cup flag.
  const holeVerts = (currentCourse && (currentCourse.gen === 'faceted' || currentCourse.gen === 'composed'))
    ? rawVerts.map(v => ({ x: v.x, y: clampY(v.y), mat: v.mat, cup: v.cup }))   // preserve archetype-set materials (gom water) + cup-anywhere flag
    : (currentCourse?.noiseFunction || addMicroNoise)(rawVerts, startX, teeY, difficulty);

  // The cup X is at the last feature vertex (end of hole)
  const lastVert = holeVerts[holeVerts.length - 1];

  // Remove all vertices past startX — the new hole terrain replaces everything
  // from startX onward (background verts from previous hole get regenerated)
  vertices = vertices.filter(v => v.x <= startX);

  // Assign materials from course palette to vertex segments
  const courseMats = currentCourse?.materials || [DEFAULT_MAT];
  if (courseMats.length > 1) {
    // Divide hole into 2-4 material zones
    const zoneCount = 2 + Math.floor(random() * Math.min(3, courseMats.length));
    const vertsPerZone = Math.ceil(holeVerts.length / zoneCount);
    for (let z = 0; z < zoneCount; z++) {
      const mat = courseMats[Math.floor(random() * courseMats.length)];
      const start = z * vertsPerZone;
      const end = Math.min((z + 1) * vertsPerZone, holeVerts.length);
      for (let vi = start; vi < end; vi++) {
        if (!holeVerts[vi].mat) holeVerts[vi].mat = mat;
      }
    }
  }

  // Append hole vertices to global array
  for (const v of holeVerts) {
    vertices.push(v);
  }
  // CUP can be placed anywhere: an archetype may mark a vertex `cup:true` (a mid-hole spire crown, an island,
  // under an overhang…). Otherwise the cup is the last vertex (the classic end-of-hole green).
  const cupVert = holeVerts.find(v => v.cup) || lastVert;
  const cupX = cupVert.x;
  const cupSurfaceY = cupVert.y;
  const cupIsEnd = (cupVert === lastVert);

  // Add background terrain past the cup — ONLY when the cup is the hole's end. A mid-hole cup already has
  // terrain continuing past it (the archetype drew it), so adding background would corrupt it.
  const maxHoles = currentCourse?.holeCount ?? Infinity;
  const isLastHole = (holeIndex === maxHoles - 1);

  if (cupIsEnd && isLastHole) {
    // Last hole: cliff edge — terrain drops off sharply
    const cliffX = cupX + 80;
    vertices.push({ x: cliffX, y: cupSurfaceY });
    vertices.push({ x: cliffX + 10, y: H + 200 }); // straight down
  } else if (cupIsEnd) {
    // Normal: gentle background terrain extending right
    const bgY = cupSurfaceY;
    const backstop = currentCourse?.backstopBias || 0;
    const bg1X = cupX + randRange(80, 150);
    const bg1Y = clampY(bgY + backstop + (random() - 0.5) * (40 + difficulty * 60));
    const bg2X = bg1X + randRange(100, 200);
    const bg2Y = clampY(bg1Y + backstop + (random() - 0.5) * (40 + difficulty * 60));
    vertices.push({ x: bg1X, y: bg1Y });
    vertices.push({ x: bg2X, y: bg2Y });
  }

  // Now place the cup into the terrain at cupX
  placeCup(holeIndex, cupX, teeX, teeY);
  holes[holeIndex].archetype = archName;
  // P4: archetype-AUTHORED caves/overhangs (cup-under-lip, putt-in cave, walk-under cantilever). These are
  // designed slabs the archetype emitted in absolute coords — convert to hole._overhangs (collision + draw).
  // When an archetype authors its own overhangs we DON'T also roll the random chasm-floaters (would clutter
  // the designed cave); a cave archetype owns the hole's overhang space.
  if (_archOverhangSpecs.length && typeof _spEdges === 'function') {
    holes[holeIndex]._overhangs = _archOverhangSpecs.map(pts => ({ pts, edges: _spEdges(pts) }));
  } else if (typeof generateOverhangs === 'function' && currentCourse) {
    // Phase 2: random overhang set-pieces on complex planets — explicit slabs over the heightfield.
    const _oc = (currentCourse.planetComplexity != null) ? currentCourse.planetComplexity
      : ((currentCourse.gomCaves || currentCourse.overhangs) ? difficulty : null);   // overhangs on the solar tour, scaled by hole difficulty
    if (_oc != null) generateOverhangs(holes[holeIndex], _oc);
  }
  _archOverhangSpecs = [];
  // Phase W: flat water pools in deep basins (water.js, its own system — not terrain). BEFORE cacti so
  // cactus placement can avoid the pools.
  if (typeof placeWater === 'function') placeWater(holeIndex);
  // Phase O: cacti — sparse green obstacles the ball bounces off (GoM refs 575/351). Never near cup/water.
  if (currentCourse && currentCourse.gomObstacles) placeCacti(holeIndex);

  // Enforce strict X-monotonicity — remove any vertex that goes backwards.
  // Background verts from earlier holes or cup insertion can create overlaps.
  let _maxX = -Infinity;
  vertices = vertices.filter(v => {
    if (v.x >= _maxX - 0.5) { _maxX = v.x; return true; }
    return false;
  });
}

function generateHandDefinedHole(holeIndex) {
  const def = HAND_DEFINED_HOLES[holeIndex];
  const teeY = def.teeY;

  // Determine tee position
  let teeX;
  if (holeIndex === 0) {
    teeX = 100;
    // Seed initial terrain: flat run up to tee area
    if (vertices.length === 0) {
      vertices.push({ x: -100, y: teeY });
      vertices.push({ x: teeX - 20, y: teeY });
    }
  } else {
    teeX = holes[holeIndex - 1].cupX;
    // If previous cup Y differs from this tee Y, the flattenCup + background
    // vertices already handle the connection — teeY is embedded in the verts
  }

  // Convert relative dx vertices to absolute world positions
  const startX = teeX + 40;
  const holeVerts = def.verts.map(v => {
    const vert = { x: startX + v.dx, y: v.y };
    if (v.mat) vert.mat = v.mat;
    return vert;
  });
  // Add the cup endpoint
  holeVerts.push({ x: teeX + def.dist, y: def.cupY });

  // Remove all vertices past startX — the new hole terrain replaces everything
  // from startX onward (background verts from previous hole get regenerated)
  vertices = vertices.filter(v => v.x <= startX);

  // Append hole vertices to global array
  for (const v of holeVerts) {
    vertices.push(v);
  }

  const cupX = teeX + def.dist;

  // Add background terrain past the cup (deterministic for hand-defined holes)
  const bg1X = cupX + 120;
  const bg1Y = clampY(def.cupY + ((holeIndex * 7 % 13) / 13 - 0.5) * 30);
  const bg2X = bg1X + 150;
  const bg2Y = clampY(bg1Y + ((holeIndex * 11 % 17) / 17 - 0.5) * 30);
  vertices.push({ x: bg1X, y: bg1Y });
  vertices.push({ x: bg2X, y: bg2Y });

  // Place the cup
  placeCup(holeIndex, cupX, teeX, teeY);
  holes[holeIndex].archetype = 'hand_defined';

  // Enforce strict X-monotonicity
  for (let i = vertices.length - 1; i > 0; i--) {
    if (vertices[i].x < vertices[i - 1].x - 0.5) {
      vertices.splice(i, 1);
    }
  }

  // Load objects defined for this hole
  if (def.objects && def.objects.length > 0) {
    for (const od of def.objects) {
      const verts = od.verts.map(v => ({ x: startX + v.dx, y: v.y }));
      const obj = { verts, mat: od.mat || DEFAULT_MAT, holeIndex };
      if (od.sprite) obj.sprite = od.sprite;
      if (od.rotation) obj.rotation = od.rotation;
      objects.push(obj);
    }
  }
}

// Phase O: sparse cactus obstacles on the fairway (GoM refs 575/351). Small green saguaro-ish silhouettes
// the ball bounces off (collideWithObjects). Kept clear of the cup, tee, and water → never seals a hole.
function placeCacti(holeIndex) {
  const h = holes[holeIndex]; if (!h || typeof terrainYAt !== 'function') return;
  const teeX = h.teeX, cupX = h.cupX, span = cupX - teeX; if (span < 320) return;
  const count = random() < 0.55 ? (random() < 0.30 ? 2 : 1) : 0;
  for (let k = 0; k < count; k++) {
    const cx = teeX + span * randRange(0.28, 0.72);
    if (Math.abs(cx - cupX) < 95 || Math.abs(cx - teeX) < 70) continue;                 // clear cup + tee
    if (typeof isInWater === 'function' && isInWater(cx)) continue;                       // not in a water pool
    const surfY = terrainYAt(cx), hgt = randRange(22, 36), w = randRange(5, 7.5);
    const v = [                                                                          // small saguaro silhouette
      { x: cx - w, y: surfY }, { x: cx - w, y: surfY - hgt * 0.55 }, { x: cx - w * 1.9, y: surfY - hgt * 0.55 }, { x: cx - w * 1.9, y: surfY - hgt * 0.78 }, { x: cx - w, y: surfY - hgt * 0.80 },
      { x: cx - w * 0.8, y: surfY - hgt }, { x: cx + w * 0.8, y: surfY - hgt },
      { x: cx + w, y: surfY - hgt * 0.68 }, { x: cx + w * 1.9, y: surfY - hgt * 0.68 }, { x: cx + w * 1.9, y: surfY - hgt * 0.88 }, { x: cx + w, y: surfY - hgt * 0.88 }, { x: cx + w, y: surfY },
    ];
    objects.push({ x: cx, y: surfY, verts: v, mat: 'cactus' });
  }
}

function placeCup(holeIndex, cupX, teeX, teeY) {
  const halfW = CUP_WIDTH / 2;
  const leftX = cupX - halfW;
  const rightX = cupX + halfW;

  // Sample rim heights BEFORE modifying vertices, then FLATTEN to a single Y.
  // This ensures the cup sits on perfectly flat ground, which makes the
  // sand-fill transition animation trivial (no asymmetric rim heights).
  const sampledLeftY = terrainYAt(leftX);
  const sampledRightY = terrainYAt(rightX);
  const rimY = (sampledLeftY + sampledRightY) / 2; // flat rim height
  const leftY = rimY;
  const rightY = rimY;
  const cupY = rimY;

  // Remove existing vertices inside the cup range (+ small margin for flat approach)
  const flatMargin = 20;
  vertices = vertices.filter(v => v.x < leftX - flatMargin || v.x > rightX + flatMargin);

  // Insert flat approach vertices + cup notch
  const wallInset = 3;  // nearly vertical walls with wide flat bottom
  const bottomY = rimY + CUP_DEPTH;
  const cupVerts = [
    { x: leftX - flatMargin,   y: rimY },        // flat approach left
    { x: leftX,                y: rimY },         // left rim
    { x: leftX + wallInset,    y: bottomY },      // bottom-left
    { x: rightX - wallInset,   y: bottomY },      // bottom-right
    { x: rightX,               y: rimY },         // right rim
    { x: rightX + flatMargin,  y: rimY },         // flat approach right
  ];

  // Insert into vertex array maintaining x-sort order
  let insertIdx = vertices.findIndex(v => v.x >= leftX - flatMargin);
  if (insertIdx === -1) insertIdx = vertices.length;
  vertices.splice(insertIdx, 0, ...cupVerts);

  holes.push({
    cupX, cupY,
    cupLeftX: leftX, cupLeftY: leftY,
    cupRightX: rightX, cupRightY: rightY,
    cupBottomY: bottomY,
    cupWallInset: wallInset,
    cupFilled: false,
    cupFillProgress: 0,
    flagHole: holeIndex + 1,
    flagVisible: true,
    flagOpacity: 1,
    teeX, teeY
  });

  return { cupX, cupY, teeX, teeY };
}

function flattenCup(hole) {
  // Replace the cup notch + flat approach vertices with just two flat points
  const halfW = CUP_WIDTH / 2;
  const flatMargin = 20;
  const leftX = hole.cupX - halfW;
  const rightX = hole.cupX + halfW;

  // Remove all vertices in the cup zone (including flat approach margins)
  vertices = vertices.filter(v => v.x < leftX - flatMargin || v.x > rightX + flatMargin);

  // Insert two flat vertices at the rim height
  let insertIdx = vertices.findIndex(v => v.x >= leftX - flatMargin);
  if (insertIdx === -1) insertIdx = vertices.length;
  vertices.splice(insertIdx, 0,
    { x: leftX - flatMargin, y: hole.cupLeftY },
    { x: rightX + flatMargin, y: hole.cupRightY }
  );
}

// ── Editor-saved hole overrides ──────────────────────────────
// The game generates every hole procedurally from the seed (so the seeded
// sequence is never disturbed), then overlays edits saved from the editor on
// top — replacing only the geometry of holes that have actually been edited.
// This mirrors the editor's own applySavedHoleEdits(). Gated on
// window.HOLE_OVERRIDES_ENABLED (set in the game's main.js).
let _holeOverrides = {};
let _holeOverridesApplied = new Set();

function loadHoleOverrides(worldId, courseId) {
  _holeOverrides = {};
  _holeOverridesApplied = new Set();
  try {
    const raw = localStorage.getItem('dg-course-' + worldId + '-' + courseId);
    if (raw) {
      const data = JSON.parse(raw);
      if (data && data.holes) _holeOverrides = data.holes;
    }
  } catch (e) { /* ignore malformed saves */ }
}

// Snap a hole's cup onto the actual ground at its cupX: find the ground height
// from the vertices bounding the cup zone and cut a clean notch there. Shared by
// the game (loading edited holes) and the editor (so the preview matches), since
// reshaping terrain otherwise leaves the cup stranded at a stale height.
function reanchorCupToTerrain(hole) {
  if (!hole || typeof hole.cupX !== 'number') return;
  const cupX = hole.cupX;
  const halfW = CUP_WIDTH / 2, flatMargin = 20, wallInset = 3;
  const leftX = cupX - halfW, rightX = cupX + halfW;
  const zoneL = leftX - flatMargin, zoneR = rightX + flatMargin;
  let leftV = null, rightV = null;
  for (let i = 0; i < vertices.length; i++) {
    if (vertices[i].x < zoneL) leftV = vertices[i];
    else if (vertices[i].x > zoneR) { rightV = vertices[i]; break; }
  }
  let rimY;
  if (leftV && rightV) rimY = leftV.y + (cupX - leftV.x) / (rightV.x - leftV.x) * (rightV.y - leftV.y);
  else if (leftV || rightV) rimY = (leftV || rightV).y;
  else return; // nothing to sample — leave the cup as-is
  const bottomY = rimY + CUP_DEPTH;
  vertices = vertices.filter(v => v.x < zoneL || v.x > zoneR);
  const cupVerts = [
    { x: zoneL,              y: rimY },
    { x: leftX,              y: rimY },
    { x: leftX + wallInset,  y: bottomY },
    { x: rightX - wallInset, y: bottomY },
    { x: rightX,             y: rimY },
    { x: zoneR,              y: rimY },
  ];
  let ci = vertices.findIndex(v => v.x >= zoneL);
  if (ci === -1) ci = vertices.length;
  vertices.splice(ci, 0, ...cupVerts);
  hole.cupX = cupX; hole.cupY = rimY;
  hole.cupLeftX = leftX; hole.cupRightX = rightX;
  hole.cupLeftY = rimY; hole.cupRightY = rimY;
  hole.cupBottomY = bottomY; hole.cupWallInset = wallInset;
}

function applyHoleOverride(idx) {
  const def = _holeOverrides[String(idx)];
  const hole = holes[idx];
  if (!def || !def.verts || !hole) return;
  const startX = hole.teeX + 40;
  const nextHole = idx < holes.length - 1 ? holes[idx + 1] : null;
  const cupRightEdge = (hole.cupRightX || hole.cupX + 20) + 22;
  const endX = nextHole ? Math.max(nextHole.teeX, cupRightEdge + 50) : hole.cupX + 300;
  // Drop the generated vertices in this hole's range, splice in the saved ones.
  vertices = vertices.filter(v => v.x <= startX || v.x >= endX);
  const newVerts = def.verts.map(v => {
    const vert = { x: startX + v.dx, y: v.y };
    if (v.mat) vert.mat = v.mat;
    return vert;
  });
  let insertIdx = vertices.findIndex(v => v.x > startX);
  if (insertIdx === -1) insertIdx = vertices.length;
  vertices.splice(insertIdx, 0, ...newVerts);

  // Re-anchor the cup to the EDITED terrain. The editor doesn't keep cupY in sync
  // when you reshape the ground, so the saved cupY can be stale — leaving the cup
  // floating above (or buried under) the surface, i.e. an impossible hole. So we
  // ignore def.cupY: find the actual ground height at the cup's X (from the
  // vertices bounding the cup zone) and cut a clean notch there, like generation.
  if (typeof def.dist === 'number') {
    hole.cupX = hole.teeX + def.dist;
    reanchorCupToTerrain(hole); // snap cup to the edited ground (ignores stale def.cupY)
  }
  if (typeof def.teeY === 'number') hole.teeY = def.teeY;

  // Restore this hole's objects (Sq/Rect/Tri/Cir shapes + sprites). The game can
  // already render and collide with these (same as hand-defined holes), but
  // procedural generation never places them — so drop any objects this hole had
  // and re-add the saved ones at absolute coordinates.
  if (typeof objects !== 'undefined' && Array.isArray(objects)) {
    for (let oi = objects.length - 1; oi >= 0; oi--) {
      if (objects[oi].holeIndex === idx) objects.splice(oi, 1);
    }
    if (def.objects && def.objects.length) {
      for (const od of def.objects) {
        const overts = od.verts.map(v => ({ x: startX + v.dx, y: v.y }));
        const obj = { verts: overts, mat: od.mat || DEFAULT_MAT, holeIndex: idx };
        if (od.sprite) obj.sprite = od.sprite;
        if (od.rotation) obj.rotation = od.rotation;
        objects.push(obj);
      }
    }
  }
}

// ── Phase 1: simulate-and-validate cup reachability (guarantee every generated hole is sinkable) ──────
// After generating a hole, drive the autoplay bot's own solver from the tee; if it can't sink it (or make
// progress), re-roll the hole. This is exactly how the genre ships solvable levels (and what GoM's author
// did by hand). Cheap on reachable holes (the solver stops at the first scoring shot); only the rare
// unsinkable hole pays for the full search, and that one we throw away. Falls back gracefully if the bot
// layer isn't present (e.g. headless audits) so the seeded sequence is never disturbed there.
let _inValidation = false;
function _validateHole(i) {
  if (_inValidation) return true;                                  // never recurse (the bot's update() can re-enter generation)
  if (typeof window === 'undefined' || !window.RG || !RG.bot || !RG.bot.calculateShot || !RG.bot.simulateShot) return true;
  if (!holes[i] || typeof terrainYAt !== 'function' || typeof ball === 'undefined') return true;
  const save = { x: ball.x, y: ball.y, vx: ball.vx, vy: ball.vy, r: ball.atRest, og: ball.onGround, st: state, ch: currentHole, cx: (typeof camera !== 'undefined' ? camera.x : 0), cy: (typeof camera !== 'undefined' ? camera.y : 0) };
  const sSteps = window.RG_BOT_STEPS; window.RG_BOT_STEPS = 20;   // match the real bot's base search grid
  _inValidation = true;
  let ok = false, minD = Infinity;
  try {
    currentHole = i; const h = holes[i];
    ball.x = h.teeX; ball.y = terrainYAt(h.teeX) - BALL_RADIUS; ball.vx = 0; ball.vy = 0; ball.atRest = true; ball.onGround = true; state = STATE_AIM;
    // Frame the hole EXACTLY like real play (fixed per-hole camera). isBallOffScreen() is camera-relative,
    // so the validator MUST face the same camera the bot will — otherwise it can't see the OOB walls that
    // make a hole unsinkable in play. The prior ball-following camera hid every OOB → slip-through stuck holes.
    if (typeof setHoleCamera === 'function') setHoleCamera(h);
    let prevD = Infinity, noProg = 0;
    for (let shot = 0; shot < 20 && !ok; shot++) {
      const s = RG.bot.calculateShot(); if (!s) break;
      const r = RG.bot.simulateShot(s.vx, s.vy);
      if (r.scored) { ok = true; break; }
      if (r.distToCup < minD) minD = r.distToCup;
      if (r.oob) break;
      if (!(r.distToCup < prevD - 5)) { if (++noProg >= 3) break; } else noProg = 0;   // persist through a couple stalls (like the real bot) before giving up
      prevD = r.distToCup; ball.x = r.x; ball.y = r.y; ball.vx = 0; ball.vy = 0; ball.atRest = true; ball.onGround = true; state = STATE_AIM;
    }
    // REQUIRE AN ACTUAL SINK (r.scored). The old rest-near lenient kept passing balls that come to rest NEAR
    // the cup on a slope/shelf but roll off and never drop in (the recurring low-gravity stuck-hole class:
    // rolling_hills/spire_drown/shelf_drop_shelf...). A genuinely sinkable hole still scores within 20 shots;
    // anything that can't is re-rolled. Tiny 0.28 safety only for a ball literally resting in the cup footprint
    // (sim didn't latch STATE_PAUSE within the frame budget).
    if (!ok && minD < CUP_WIDTH * 0.28) ok = true;
  } catch (e) { ok = true; }
  _inValidation = false;
  window.RG_BOT_STEPS = sSteps;
  ball.x = save.x; ball.y = save.y; ball.vx = save.vx; ball.vy = save.vy; ball.atRest = save.r; ball.onGround = save.og; state = save.st; currentHole = save.ch;
  if (typeof camera !== 'undefined') { camera.x = save.cx; camera.y = save.cy; }
  return ok;
}
function _genValidatedHole(i) {
  if (_inValidation) { generateHoleTerrain(i); return; }            // re-entrant (during a sim) → plain generate, no recurse
  const LAST = 24;   // more re-roll attempts → rare bad seeds (e.g. a trapped-tee shelf hole) reliably find a sinkable variant
  for (let attempt = 0; attempt <= LAST; attempt++) {
    generateHoleTerrain(i);
    if (_validateHole(i)) return;
    if (attempt < LAST && holes.length > i) holes.length = i;       // drop + re-roll (PRNG advances → different hole); KEEP the last attempt so holes[i] always exists
  }
  // exhausted (very rare): keep the last build; the stroke-budget skip is the final backstop.
}

function ensureHolesAhead(upToHole) {
  if (_inValidation) return;   // a validation sim's update() can re-enter here; generating ahead would desync
  // Cap at course hole count if defined
  const maxHoles = currentCourse?.holeCount ?? Infinity;
  // Courses can opt into simulate-and-validate (re-roll any unsinkable hole). Generate the WHOLE course
  // up-front then (never lazily mid-play — a validation sim runs update(), which corrupts mid-transition).
  const _validate = currentCourse && currentCourse.validate && isFinite(maxHoles);
  const cap = _validate ? (maxHoles - 1) : Math.min(upToHole, maxHoles - 1);
  // Make sure terrain and cups exist for holes up to cap
  for (let i = holes.length; i <= cap; i++) {
    if (_validate) _genValidatedHole(i); else generateHoleTerrain(i);
    holes[i].flagVisible = true;
  }
  // Overlay editor-saved edits on top (game only; the editor applies its own).
  // The generation above is untouched, so the seeded sequence is identical — we
  // only replace geometry for holes that have been edited and saved.
  if (window.HOLE_OVERRIDES_ENABLED) {
    const _fullyGenerated = holes.length >= maxHoles;
    for (const _k in _holeOverrides) {
      const _i = Number(_k);
      if (_holeOverridesApplied.has(_i) || !holes[_i]) continue;
      if (holes[_i + 1] || (_fullyGenerated && _i === holes.length - 1)) {
        applyHoleOverride(_i);
        _holeOverridesApplied.add(_i);
      }
    }
  }
  // Final enforcement: remove any vertex that breaks X-monotonicity.
  // Per-hole generation handles most cases, but inter-hole boundaries
  // (background verts from hole N overlapping hole N+1) can slip through.
  let _maxX2 = -Infinity;
  vertices = vertices.filter(v => {
    if (v.x >= _maxX2 - 0.5) { _maxX2 = v.x; return true; }
    return false;
  });
}
