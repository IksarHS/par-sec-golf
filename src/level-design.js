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
    const cx = endX - 92, crownHalf = 62;                    // WIDE flat crown (~124px), cup centred = landable even in low gravity
    return [
      { x: sx, y: clampY(sy) },
      { x: sx + dist * 0.17, y: clampY(sy) },                // tee headland
      { x: sx + dist * 0.17 + 24, y: floorY },               // plunge into the abyss
      { x: cx - crownHalf - 24, y: floorY },                 // abyss floor (long span → lots of water)
      { x: cx - crownHalf, y: topY },                        // spire rises near-vertical
      { x: cx, y: topY, cup: true },                         // CUP centred on the wide flat crown
      { x: cx + crownHalf, y: topY },                        // crown far edge
      { x: endX, y: clampY(topY + 26) },                     // small step down off the crown
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
    // High shelf → sloped drop → low shelf → another drop or rise
    const step1X = sx + dist * randRange(0.2, 0.35);
    const highY = H * randRange(0.18, 0.32);         // less extreme (was 0.10-0.30)
    const midY = H * randRange(0.45, 0.58);
    const lowY = H * randRange(0.72, 0.85);           // less extreme (was 0.75-0.92)
    // Proportional wall width — never steeper than ~55° so ball can escape
    const drop1 = Math.abs(midY - highY);
    const drop2 = Math.abs(lowY - midY);
    const wallW1 = Math.max(65, drop1 * 0.7);         // reduced from 0.8
    const wallW2 = Math.max(65, drop2 * 0.7);
    // Ensure step2 starts after step1's wall ends
    const step2X = Math.max(sx + dist * randRange(0.55, 0.7), step1X + wallW1 + 40);
    return [
      { x: sx + 20, y: sy },                          // match tee
      { x: sx + dist * 0.08, y: highY },              // transition to high shelf
      { x: step1X, y: highY },
      { x: step1X + wallW1, y: midY },
      { x: step2X, y: midY },
      { x: step2X + wallW2, y: lowY },
      { x: sx + dist, y: lowY }
    ];
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
  // Apply anti-repetition: halve weight if archetype was used in last 3 holes
  const weights = available.map(([name, , , w]) =>
    _recentArchetypes.includes(name) ? w * 0.5 : w
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

  const difficulty = getDifficulty(holeIndex);

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
  let rawVerts = archFunc(startX, teeY, dist, cupTargetY, difficulty);

  // No terrain validation — the autogolfer handles all terrain via simulation.

  // Add micro-noise: subdivide long segments with subtle perturbations.
  // FACETED courses (Earth, in this port) skip micro-noise so the long straight facets stay clean.
  const holeVerts = (currentCourse && currentCourse.gen === 'faceted')
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
  // Phase 2: overhang set-pieces (the weird 20%) on complex planets — explicit slabs over the heightfield.
  if (typeof generateOverhangs === 'function' && currentCourse) {
    const _oc = (currentCourse.planetComplexity != null) ? currentCourse.planetComplexity
      : ((currentCourse.gomCaves || currentCourse.overhangs) ? difficulty : null);   // overhangs on the solar tour, scaled by hole difficulty
    if (_oc != null) generateOverhangs(holes[holeIndex], _oc);
  }
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
    for (let shot = 0; shot < 16 && !ok; shot++) {
      const s = RG.bot.calculateShot(); if (!s) break;
      const r = RG.bot.simulateShot(s.vx, s.vy);
      if (r.scored) { ok = true; break; }
      if (r.distToCup < minD) minD = r.distToCup;
      if (r.oob) break;
      if (!(r.distToCup < prevD - 5)) { if (++noProg >= 3) break; } else noProg = 0;   // persist through a couple stalls (like the real bot) before giving up
      prevD = r.distToCup; ball.x = r.x; ball.y = r.y; ball.vx = 0; ball.vy = 0; ball.atRest = true; ball.onGround = true; state = STATE_AIM;
    }
    // r.scored above is the true sink. The lenient is now ONLY a tap-in safety: the ball must have RESTED
    // essentially in the cup footprint (<0.5 cup-widths). distToCup is a REST distance, so a slope/fly-by
    // near-miss no longer counts (that was the 0.9/1.3/2.2 bug — it passed balls that rest near but roll off).
    if (!ok && minD < CUP_WIDTH * 0.5) ok = true;
  } catch (e) { ok = true; }
  _inValidation = false;
  window.RG_BOT_STEPS = sSteps;
  ball.x = save.x; ball.y = save.y; ball.vx = save.vx; ball.vy = save.vy; ball.atRest = save.r; ball.onGround = save.og; state = save.st; currentHole = save.ch;
  if (typeof camera !== 'undefined') { camera.x = save.cx; camera.y = save.cy; }
  return ok;
}
function _genValidatedHole(i) {
  if (_inValidation) { generateHoleTerrain(i); return; }            // re-entrant (during a sim) → plain generate, no recurse
  const LAST = 13;
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
