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
    // 2-4 angular peaks and valleys — sharp zigzag terrain
    const numHills = 2 + Math.floor(random() * (1 + diff * 2));
    const verts = [];
    const segW = dist / (numHills + 1);
    for (let i = 1; i <= numHills; i++) {
      const hx = sx + segW * i + (random() - 0.5) * segW * 0.3;
      const amp = randRange(40, 80 + diff * 80);
      const up = (i % 2 === 1) ? -1 : 1;
      const hy = clampY(lerp(sy, cupY, i / (numHills + 1)) + up * amp);
      verts.push({ x: hx, y: hy });
    }
    verts.push({ x: sx + dist, y: cupY });
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
  if (_recentArchetypes.length > 3) _recentArchetypes.shift();
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
  const archName = pickArchetype(difficulty);
  const archFunc = archetypes[archName];
  const startX = teeX + 40; // small gap after tee
  let rawVerts = archFunc(startX, teeY, dist, cupTargetY, difficulty);

  // No terrain validation — the autogolfer handles all terrain via simulation.

  // Add micro-noise: subdivide long segments with subtle perturbations.
  // FACETED courses (Earth, in this port) skip micro-noise so the long straight facets stay clean.
  const holeVerts = (currentCourse && currentCourse.gen === 'faceted')
    ? rawVerts.map(v => ({ x: v.x, y: clampY(v.y) }))
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
  const cupX = lastVert.x;
  const cupSurfaceY = lastVert.y;

  // Add background terrain past the cup
  const maxHoles = currentCourse?.holeCount ?? Infinity;
  const isLastHole = (holeIndex === maxHoles - 1);

  if (isLastHole) {
    // Last hole: cliff edge — terrain drops off sharply
    const cliffX = cupX + 80;
    vertices.push({ x: cliffX, y: cupSurfaceY });
    vertices.push({ x: cliffX + 10, y: H + 200 }); // straight down
  } else {
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
  if (typeof generateOverhangs === 'function' && currentCourse && currentCourse.planetComplexity != null) {
    generateOverhangs(holes[holeIndex], currentCourse.planetComplexity);
  }

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
  const save = { x: ball.x, y: ball.y, vx: ball.vx, vy: ball.vy, r: ball.atRest, og: ball.onGround, st: state, ch: currentHole };
  const sSteps = window.RG_BOT_STEPS; window.RG_BOT_STEPS = 14;
  _inValidation = true;
  let ok = false, minD = Infinity;
  try {
    currentHole = i; const h = holes[i];
    ball.x = h.teeX; ball.y = terrainYAt(h.teeX) - BALL_RADIUS; ball.vx = 0; ball.vy = 0; ball.atRest = true; ball.onGround = true; state = STATE_AIM;
    let prevD = Infinity;
    for (let shot = 0; shot < 6 && !ok; shot++) {
      const s = RG.bot.calculateShot(); if (!s) break;
      const r = RG.bot.simulateShot(s.vx, s.vy);
      if (r.scored) { ok = true; break; }
      if (r.distToCup < minD) minD = r.distToCup;
      if (r.oob || !(r.distToCup < prevD - 5)) break;              // OOB or no further progress → give up on this hole
      prevD = r.distToCup; ball.x = r.x; ball.y = r.y; ball.vx = 0; ball.vy = 0; ball.atRest = true; ball.onGround = true; state = STATE_AIM;
    }
    // LENIENT: the coarse validation solver needn't pot it exactly — getting the ball within ~2 cup widths
    // means the real (finer, multi-shot) bot will finish it. Only the truly stuck holes (always OOB / never
    // close) fail → those we re-roll. Avoids false-negatives that would reject perfectly playable holes.
    if (!ok && minD < CUP_WIDTH * 2.2) ok = true;
  } catch (e) { ok = true; }
  _inValidation = false;
  window.RG_BOT_STEPS = sSteps;
  ball.x = save.x; ball.y = save.y; ball.vx = save.vx; ball.vy = save.vy; ball.atRest = save.r; ball.onGround = save.og; state = save.st; currentHole = save.ch;
  return ok;
}
function _genValidatedHole(i) {
  if (_inValidation) { generateHoleTerrain(i); return; }            // re-entrant (during a sim) → plain generate, no recurse
  for (let attempt = 0; attempt < 8; attempt++) {
    generateHoleTerrain(i);
    if (_validateHole(i)) return;
    if (holes.length > i) holes.length = i;                         // drop the unsinkable hole; re-roll (PRNG advances → different hole)
  }
  // exhausted (very rare): keep the last build; the stroke-budget skip is the final backstop.
}

function ensureHolesAhead(upToHole) {
  // Cap at course hole count if defined
  const maxHoles = currentCourse?.holeCount ?? Infinity;
  const cap = Math.min(upToHole, maxHoles - 1);
  // Make sure terrain and cups exist for holes up to cap
  for (let i = holes.length; i <= cap; i++) {
    generateHoleTerrain(i);
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
