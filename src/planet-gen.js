// ── planet-gen.js — ONE tunable hole generator, 9 varied planets via different SETTINGS ──────────────
// Goal: a single generator that goes simple → increasingly complex (Golf-on-Mars-style), driven only by
// a per-planet settings object. Built on the engine's NATIVE faceted heightfield (clean cups/tees/fills/
// collision, all free). The ONE knob is `complexity` (0..1): it selects which archetype tiers are in play
// AND scales difficulty (drama). Other settings (material→colour+physics, sky, distance, gravity) give
// each planet its identity. Phase 2 adds overhang/cave set-pieces on the higher-complexity planets.
// Reachable by ?course=p1 .. p9 (and ?planets lists them). Registers into WORLDS['run-world'].courses.

(function () {
  if (typeof WORLDS === 'undefined' || !WORLDS['run-world'] || !WORLDS['run-world'].courses) return;
  const COURSES = WORLDS['run-world'].courses;

  // Cumulative archetype tiers — higher complexity unlocks more dramatic native archetypes on top of the
  // calmer ones (so simple planets stay simple, complex planets get the wild stuff too).
  const TIERS = [
    ['flat_run', 'faceted', 'gentle_slope', 'downhill', 'uphill'],                  // t0  always (gentle)
    ['rolling_hills', 'valley', 'shelf', 'cliff_drop'],                              // t1  ~0.2  (angular)
    ['mesa', 'peak_obstacle', 'stepped_descent', 'dramatic_ridge'],                  // t2  ~0.4  (dramatic)
    ['canyon', 'twin_peaks', 'deep_plunge', 'shelf_drop_shelf', 'cliff_valley_climb'], // t3 ~0.6 (big)
    ['deep_pocket', 'fortress', 'narrow_gap', 'compound_terrain', 'canyon_cup'],     // t4  ~0.8  (gnarly)
  ];
  function archetypesFor(complexity) {
    const upto = Math.min(TIERS.length, 1 + Math.floor(complexity / 0.2 + 0.001));
    let a = [];
    for (let i = 0; i < upto; i++) a = a.concat(TIERS[i]);
    return a;
  }

  // The 9 planets — same generator, different settings. complexity rises 0.06 → 0.94 (simple → complex);
  // material/sky give identity; gravity stays Earth-ish (no floatiness) with a touch more carry on the
  // wildest worlds so long holes stay reachable.
  const PLANETS = [
    { id: 'p1', name: 'Verdance',     world: 'Verdance',     c: 0.06, mat: 'grass', sky: '#232c40', grav: 1.00 },
    { id: 'p2', name: 'The Flats',    world: 'Calderos',     c: 0.16, mat: 'sand',  sky: '#3a3450', grav: 1.00 },
    { id: 'p3', name: 'Ochre Mesa',   world: 'Ochre',        c: 0.28, mat: 'rock',  sky: '#9fb0a8', grav: 1.00 },
    { id: 'p4', name: 'Hoarfrost',    world: 'Hoarfrost',    c: 0.40, mat: 'ice',   sky: '#2a3a48', grav: 1.00 },
    { id: 'p5', name: 'The Quagmire', world: 'Mire',         c: 0.52, mat: 'mud',   sky: '#2d3328', grav: 1.00 },
    { id: 'p6', name: 'Redcliff',     world: 'Redcliff',     c: 0.64, mat: 'rock',  sky: '#1a2230', grav: 0.96 },
    { id: 'p7', name: 'Glasswastes',  world: 'Glasswastes',  c: 0.74, mat: 'ice',   sky: '#18222e', grav: 0.94 },
    { id: 'p8', name: 'The Shatter',  world: 'Shatter',      c: 0.84, mat: 'rock',  sky: '#12161f', grav: 0.92 },
    { id: 'p9', name: 'The Maw',      world: 'The Maw',      c: 0.94, mat: 'sand',  sky: '#0c0e14', grav: 0.90 },
  ];

  for (const p of PLANETS) {
    const dMin = Math.round(360 + p.c * 120);          // simple planets shorter, complex ones longer
    const dMax = Math.round(540 + p.c * 260);
    COURSES[p.id] = {
      name: p.name, worldName: p.world, sky: p.sky,
      defaultMaterial: p.mat, materials: [p.mat],
      gen: 'faceted',                                   // native heightfield, micro-noise off (crisp angular)
      archetypes: archetypesFor(p.c),
      difficultyRange: [Math.max(0.04, p.c * 0.7), Math.min(0.95, p.c + 0.22)],
      holeDistMin: dMin, holeDistMax: dMax, holeCount: 9,
      phys: { gravityScale: p.grav, windScale: 1 },
      planetComplexity: p.c,                            // Phase 2 uses this for set-piece frequency
    };
  }
  if (typeof window !== 'undefined') window.PLANETS = PLANETS;
})();
