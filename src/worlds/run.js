// ── Roguelike Run World (Mars) ─────────────────────────────
// A single "world" + "course" the run controller plays through. The run
// controller (src/roguelike/run.js) rebuilds this course from a pristine
// template each run, so opt-in modifiers can reshape it without accumulating.
//
// Shape matches every other world (see worlds/desert-planet.js): the engine's
// startCourse() reads currentCourse.{materials,archetypes,difficultyRange,holeCount}.

WORLDS['run-world'] = {
  name: 'Mars',
  system: 'Roguelike',
  sky: '#1a1320',                 // placeholder; the minimal style sets the real palette
  materials: ['sand', 'grass', 'rock', 'ice', 'mud', 'water'],
  defaultMaterial: 'sand',
  assets: [],                     // clean by default; obstacles can be added later
  courses: {},
};

// Gentle elevation shared by the easy surface courses: flat or a soft downhill
// roll toward the cup, never a hard climb.
function gentleCupElevation(teeY, difficulty) {
  if (random() < 0.30) return clampY(teeY + (random() - 0.5) * 24); // near-flat
  return clampY(teeY + randRange(20, 70));                          // gentle downhill
}

// The Mars run: a short, seeded, winnable front-nine. holeCount drives the existing
// course-completion machinery (currentHole >= holeCount -> STATE_COMPLETE = our win).
// In the space arc this is a DESTINATION; Earth (below) is where the game now boots.
WORLDS['run-world'].courses['run-course'] = {
  name: 'Front Nine',
  worldName: 'Mars',
  sky: '#1a1320',
  // Just sand. The base course is dead simple — one terrain, no colour variety. Any
  // special texture (and water hazards) arrives later as a rare, emergent surprise.
  materials: ['sand'],
  // Gentle, varied shapes — every hole easily sinkable. Level design is not the focus;
  // depth comes from secrets + emergent per-hole conditions, not hard terrain.
  archetypes: [
    'gentle_slope', 'gentle_hill', 'downhill', 'uphill', 'rolling_hills', 'valley', 'shelf',
  ],
  difficultyRange: [0.05, 0.4],   // gentle throughout
  holeDistMin: 360,               // short, easy holes (engine default is 600)
  holeDistMax: 640,
  cupElevation: gentleCupElevation,
  holeCount: 9,
};

// ── Earth (where the space arc begins) ─────────────────────
// Ordinary golf: grass fairways, sand bunkers, a pre-dawn sky. Identical gentle shapes
// to the Mars nine — the surface promise is unchanged. The broken ship (src/roguelike/
// ship.js) sits past the ninth cup.
// Earth bunker sand: same physics as sand, but pale tan — Mars keeps its orange.
if (typeof MATERIALS !== 'undefined' && MATERIALS.sand && !MATERIALS.bunker) {
  MATERIALS.bunker = Object.assign({}, MATERIALS.sand, { color: '#d8c08a', colorLight: '#e6d4a8' });
}
WORLDS['run-world'].courses['earth-course'] = {
  name: 'Front Nine',
  worldName: 'Earth',
  sky: '#232c40',                 // pre-dawn blue; the stars are already out
  defaultMaterial: 'grass',       // grass-first golf (the world default fills the base terrain)
  materials: ['grass', 'grass', 'bunker'],   // accent regions: mostly grass, occasional bunker
  gen: 'faceted',                 // NEW: Earth uses the faceted hole generator (flats + angular slopes)
  archetypes: ['faceted'],
  difficultyRange: [0.05, 0.4],
  holeDistMin: 420,
  holeDistMax: 760,
  cupElevation: gentleCupElevation,
  holeCount: 9,
  phys: { gravityScale: 1, windScale: 1 },   // baseline — Earth defines "ordinary"
  shipApron: true,                           // flat ground past the 9th cup for the wreck
};
// WEIRD Earth test courses — true 2D field terrain (interlocking plates, overhangs, carved caves; the
// Golf-on-Mars look). Earth gravity (no floatiness). weirdTier 1/2/3 = progressively wilder. ?course=earth2/3/4.
WORLDS['run-world'].courses['earth2'] = {
  name: 'The Badlands', worldName: 'Earth', sky: '#232c40',   // original Earth navy → cups read as clean dark divots
  defaultMaterial: 'grass', materials: ['grass'], gen: 'weird', weirdTier: 1,
  difficultyRange: [0.1, 0.45], holeDistMin: 360, holeDistMax: 560, holeCount: 9,
  phys: { gravityScale: 1, windScale: 1 },
};
WORLDS['run-world'].courses['earth3'] = Object.assign({}, WORLDS['run-world'].courses['earth2'], {
  name: 'The Shatterlands', weirdTier: 2, holeDistMin: 380, holeDistMax: 580,
});
WORLDS['run-world'].courses['earth4'] = Object.assign({}, WORLDS['run-world'].courses['earth2'], {
  name: 'The Tumble', weirdTier: 3, holeDistMin: 400, holeDistMax: 600,
});

// ── The Moon (first stop off Earth) ────────────────────────
// Real lunar gravity (0.165 g), vacuum (wind never rolls), gray regolith under a black
// sky with a small blue Earth (drawn by run.js _drawMoonSky). Holes run a touch longer
// because drives CARRY up there — judging the float is the whole game.
if (typeof MATERIALS !== 'undefined' && MATERIALS.sand && !MATERIALS.regolith) {
  MATERIALS.regolith = Object.assign({}, MATERIALS.sand, { color: '#9a9aa2', colorLight: '#b4b4bc' });
}
// The Moon comes in three dramatic tiers (moonTier 1→3). The default 'moon' is tier 1; 'moon2'/'moon3'
// are reachable via ?course= for testing the more dramatic generation. Gravity eased from 0.45 (too
// floaty) toward Earth so shots feel controllable on the bigger terrain.
WORLDS['run-world'].courses['moon'] = {
  name: 'Mare Imbrium', worldName: 'The Moon', sky: '#07070d',
  defaultMaterial: 'regolith', materials: ['regolith'],
  gen: 'field', moonTier: 1, archetypes: ['faceted'],
  difficultyRange: [0.1, 0.5], holeDistMin: 460, holeDistMax: 760,
  cupElevation: gentleCupElevation, holeCount: 9,
  phys: { gravityScale: 0.72, windScale: 0 },     // eased antigrav (was 0.45) — controllable, less floaty
};
WORLDS['run-world'].courses['moon2'] = Object.assign({}, WORLDS['run-world'].courses['moon'], {
  name: 'Vallis Schröteri', moonTier: 2, holeDistMin: 480, holeDistMax: 800,
  phys: { gravityScale: 0.68, windScale: 0 },
});
WORLDS['run-world'].courses['moon3'] = Object.assign({}, WORLDS['run-world'].courses['moon'], {
  name: 'The Far Side', moonTier: 3, holeDistMin: 500, holeDistMax: 820,
  phys: { gravityScale: 0.64, windScale: 0 },
});

// ── The Vault (secret) ─────────────────────────────────────
// A single brutal, guarded bonus hole — DISCOVERED by finishing a run at or under
// par, never announced. One more, if you dare. (Seed derived from the run seed.)
WORLDS['run-world'].courses['vault'] = {
  name: 'The Vault',
  materials: ['rock', 'rock', 'ice', 'water', 'sand'],
  archetypes: ['canyon_cup', 'fortress', 'narrow_gap', 'cliff_shelf', 'deep_pocket', 'twin_peaks'],
  difficultyRange: [0.9, 0.98],
  holeCount: 1,
};

// ── The Undercroft (deeper secret) ─────────────────────────
// A hidden hole you DROP INTO mid-run by coming to rest on a Fault anomaly tile (see
// src/roguelike/run.js: _legibleHazards places the tile, descend() diverts here). Never
// announced anywhere — discovered only by noticing the off-palette tile and playing to it.
WORLDS['run-world'].courses['undercroft'] = {
  name: 'The Hollow',
  materials: ['rock', 'rock', 'ice', 'sand'],
  archetypes: ['deep_pocket', 'canyon_cup', 'narrow_gap', 'cliff_shelf', 'twin_peaks'],
  difficultyRange: [0.55, 0.78],
  holeCount: 1,
};

