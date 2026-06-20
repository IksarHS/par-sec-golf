// ── planet-gen.js — ONE tunable hole generator, 24 varied planets via different SETTINGS ─────────────
// A single generator that runs simple → increasingly complex (Golf-on-Mars-style), driven only by a
// per-planet settings object. Built on the engine's NATIVE faceted heightfield (clean cups/tees/fills/
// collision, all free + reliably completable) and, on the complex planets, explicit overhang set-pieces
// (set-pieces.js). The ONE knob is `c` (complexity 0..1): it picks which archetype tiers are in play,
// scales difficulty (drama), and gates overhang frequency. Material+sky give each planet its identity.
// Reachable by ?course=p1 .. p24. Registers into WORLDS['run-world'].courses.

(function () {
  if (typeof WORLDS === 'undefined' || !WORLDS['run-world'] || !WORLDS['run-world'].courses) return;
  const COURSES = WORLDS['run-world'].courses;

  // Extra terrain colours (the roguelike fixes the 6 base hues; these are new keys it won't touch).
  // Each clones a base material's physics and just recolours, so behaviour stays sane.
  if (typeof MATERIALS !== 'undefined') {
    const phys = (b) => ({ restitution: MATERIALS[b].restitution, rollingFriction: MATERIALS[b].rollingFriction, surfaceFriction: MATERIALS[b].surfaceFriction });
    const CUSTOM = {
      jade: ['grass', '#3fa688'], moss: ['grass', '#7a8f3c'], crimson: ['rock', '#b0463e'],
      rust: ['rock', '#a85a36'], slate: ['rock', '#586878'], plum: ['rock', '#6e4a6e'],
      amber: ['sand', '#d99a3c'], rose: ['sand', '#c77d8a'], gold: ['sand', '#c2a24a'],
      bone: ['sand', '#cabfa0'], teal: ['ice', '#3f9aa6'], frost: ['ice', '#9fd8e8'],
      ash: ['rock', '#46464f'], ember: ['rock', '#c2603a'],
    };
    for (const k in CUSTOM) if (!MATERIALS[k]) { const c = CUSTOM[k]; MATERIALS[k] = Object.assign(phys(c[0]), { color: c[1], colorLight: c[1] }); }
  }

  // Cumulative archetype tiers — higher complexity unlocks more dramatic native archetypes ON TOP of the
  // calmer ones, so simple planets stay simple and complex ones get the wild stuff too.
  const TIERS = [
    ['flat_run', 'faceted', 'gentle_slope', 'downhill', 'uphill'],                  // t0  (gentle)
    ['rolling_hills', 'valley', 'shelf', 'cliff_drop'],                              // t1  ~0.2  (angular)
    ['mesa', 'peak_obstacle', 'stepped_descent', 'dramatic_ridge'],                  // t2  ~0.4  (dramatic)
    ['canyon', 'twin_peaks', 'deep_plunge', 'shelf_drop_shelf', 'cliff_valley_climb'], // t3 ~0.6 (big)
    ['compound_terrain', 'dramatic_ridge', 'deep_plunge', 'twin_peaks', 'stepped_descent'], // t4 ~0.8 (dramatic but reachable — cup-trapping archetypes dropped for completability)
  ];
  function archetypesFor(c) {
    const upto = Math.min(TIERS.length, 1 + Math.floor(c / 0.2 + 0.001));
    let a = []; for (let i = 0; i < upto; i++) a = a.concat(TIERS[i]); return a;
  }

  // 24 planets. complexity rises smoothly 0.05 → 0.97 (simple → complex). material + sky cycle
  // INDEPENDENTLY of complexity so neighbours look distinct (not "all simple planets are green").
  const MATS = ['grass', 'amber', 'slate', 'frost', 'rust', 'jade', 'rose', 'rock', 'moss', 'gold', 'teal', 'crimson',
                'bone', 'plum', 'sand', 'ash', 'ember', 'ice', 'grass', 'amber', 'slate', 'jade', 'rust', 'crimson'];
  const SKIES = ['#232c40', '#3a3450', '#9fb0a8', '#2a3a48', '#2d3328', '#1c2733', '#3b2f3a', '#1a2230', '#1e2a22',
                 '#2b2535', '#16222e', '#241a22', '#c0c8c2', '#12161f', '#34302a', '#0f1219', '#2a1d18', '#223040',
                 '#1a1f2e', '#2e2a3a', '#11161c', '#1d2a24', '#26201a', '#0c0e14'];
  const NAMES = ['Verdance', 'Calderos', 'Slategarde', 'Hoarfrost', 'Rustreach', 'Jadefall', 'Roselands', 'Basalt Flats',
                 'Mosswood', 'Goldmere', 'Tealspire', 'Crimson Cut', 'Bonewastes', 'Plumdark', 'The Dunes', 'Ashen',
                 'Emberfell', 'Glacium', 'Greenfield', 'Amberdeep', 'Slatebreak', 'Jadechasm', 'Rustmaw', 'The Maw'];

  // a complementary ACCENT material per primary (subtle terrain variety — occasional bunker/outcrop bands)
  const ACCENT = {
    grass: 'sand', amber: 'rust', slate: 'ash', frost: 'teal', rust: 'ember', jade: 'moss', rose: 'plum',
    rock: 'ash', moss: 'gold', gold: 'bone', teal: 'frost', crimson: 'rust', bone: 'sand', plum: 'slate',
    sand: 'gold', ash: 'slate', ember: 'gold', ice: 'frost',
  };
  const N = 24;
  for (let i = 0; i < N; i++) {
    const c = Math.min(0.97, 0.05 + i * (0.92 / (N - 1)));
    const mat = MATS[i % MATS.length], sky = SKIES[i % SKIES.length];
    const acc = ACCENT[mat] || mat;
    const dMin = Math.round(360 + c * 110), dMax = Math.round(540 + c * 250);
    const grav = c < 0.6 ? 1.0 : (1.0 - (c - 0.6) * 0.28);   // tiny extra carry on the wildest worlds
    COURSES['p' + (i + 1)] = {
      name: NAMES[i % NAMES.length], worldName: NAMES[i % NAMES.length], sky: sky,
      defaultMaterial: mat, materials: [mat],                 // clean single-colour terrain (GoM-style)
      gen: 'faceted',                                          // native heightfield, micro-noise off
      archetypes: archetypesFor(c),
      difficultyRange: [Math.max(0.04, c * 0.7), Math.min(0.95, c + 0.2)],
      holeDistMin: dMin, holeDistMax: dMax, holeCount: 9,
      phys: { gravityScale: grav, windScale: 1 },
      planetComplexity: c,
    };
  }
  if (typeof window !== 'undefined') window.PLANET_COUNT = N;
})();
