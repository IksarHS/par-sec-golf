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
      ash: ['rock', '#46464f'], ember: ['rock', '#c2603a'], cobalt: ['rock', '#4f6fc0'],
      cactus: ['grass', '#4f7d39'], stone: ['rock', '#8b8e94'],   // cactus = green obstacle; stone = grey-rock accent
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
    ['compound_terrain', 'dramatic_ridge', 'deep_plunge', 'twin_peaks', 'stepped_descent', 'fortress', 'narrow_gap', 'canyon_cup', 'deep_pocket'], // t4 ~0.8 (gnarly cup-trapping archetypes added back — measuring completability via tools/verify.cjs)
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
  // THE generator-from-settings: one complexity knob `c` (0..1) → a full course config. Used both for the
  // 24 fixed planets and the live LAB planet (lab.js) + the headless harness, so there's one source of truth.
  function buildConfig(c, mat, sky, name, holeCount) {
    c = Math.max(0, Math.min(1, c));
    const dMin = Math.round(360 + c * 110), dMax = Math.round(540 + c * 250);
    const grav = c < 0.6 ? 1.0 : (1.0 - (c - 0.6) * 0.28);   // tiny extra carry on the wildest worlds
    return {
      name: name, worldName: name, sky: sky,
      defaultMaterial: mat, materials: [mat],                 // clean single-colour terrain (GoM-style)
      gen: 'faceted',                                          // native heightfield, micro-noise off
      archetypes: archetypesFor(c),
      difficultyRange: [Math.max(0.04, c * 0.7), Math.min(0.95, c + 0.2)],
      holeDistMin: dMin, holeDistMax: dMax, holeCount: holeCount || 9,
      phys: { gravityScale: grav, windScale: 1 },
      planetComplexity: c,
    };
  }

  const N = 24;
  for (let i = 0; i < N; i++) {
    const c = Math.min(0.97, 0.05 + i * (0.92 / (N - 1)));
    COURSES['p' + (i + 1)] = buildConfig(c, MATS[i % MATS.length], SKIES[i % SKIES.length], NAMES[i % NAMES.length]);
  }

  // The GoM generator as a real course (?course=gom): the engine drives physics, one-hole camera, fill+pan;
  // the 'gom' archetype emits the terrain. difficultyRange ramps simple→complex across the 9 holes.
  // The GoM generator in several BIOMES (matches the user's colourful targets). Same generator, different
  // material + sky per course — clean, no per-frame hooks. ?course=gom (Mars) / gom-cobalt / gom-teal / …
  const GOM_BIOMES = [
    ['gom', 'Mars', 'crimson', '#9fb0a8'],
    ['gom-cobalt', 'Cobalt', 'cobalt', '#aab4e0'],
    ['gom-teal', 'Tealwastes', 'teal', '#b2dde4'],
    ['gom-jade', 'Jade Reach', 'jade', '#bfe0c4'],
    ['gom-rose', 'Roselands', 'rose', '#ecd2d8'],
  ];
  for (const [id, nm, mat, sky] of GOM_BIOMES) {
    COURSES[id] = {
      name: nm, worldName: nm, sky: sky,
      defaultMaterial: mat, materials: [mat],
      gen: 'faceted', archetypes: ['gom', 'gom_smooth'],   // mix angular + smooth holes (like real GoM)
      difficultyRange: [0.15, 1.15], holeDistMin: 420, holeDistMax: 760, holeCount: 9,
      gomObstacles: true,                                  // cacti (Phase O)
      gomWater: true,                                       // flat water pools (Phase W)
      validate: true,                                       // simulate-and-validate: re-roll any unsinkable hole
      // gomCaves (floating-mass overhangs) pulled — they hurt completability + aren't the cup-under-lip
      // cave look; proper carved caves are a dedicated future build.
      phys: { gravityScale: 1, windScale: 1 },
    };
  }

  // ── WATER PLANETS ── a global SEA LEVEL floods the terrain into islands/lagoons (showcases water.js).
  // Warm/green LAND contrasts the blue/turquoise WATER; gentler difficulty so carries over water are fair.
  // ?course=sea / atoll / lakes. seaLevel = px the waterline sits below the tee/cup greens (smaller = more
  // flooding / smaller islands). The validator guarantees a playable island-to-island path to the cup.
  const WATER_WORLDS = [
    // id,     name,           land,    sky,       seaLevel, waterColor,                archetypes
    ['sea',   'Archipelago',  'amber', '#cdeef2', 15, 'rgba(40,165,190,0.86)', ['gom_islands']],
    ['atoll', 'The Atolls',   'bone',  '#d6f0ec',  8, 'rgba(54,186,196,0.84)', ['gom_islands']],
    ['lakes', 'Lake Country', 'jade',  '#bcd6e0', 18, 'rgba(64,135,205,0.86)', ['gom_lake']],
  ];
  for (const [id, nm, mat, sky, sea, wcol, arch] of WATER_WORLDS) {
    COURSES[id] = {
      name: nm, worldName: nm, sky: sky, defaultMaterial: mat, materials: [mat],
      gen: 'faceted', archetypes: arch,
      difficultyRange: [0.2, 0.72], holeDistMin: 420, holeDistMax: 720, holeCount: 9,
      seaLevel: sea, waterColor: wcol, validate: true,
      phys: { gravityScale: 1, windScale: 1 },
    };
  }

  // expose the generator so lab.js + the harness build planets at any complexity from the SAME logic
  const API = { buildConfig: buildConfig, archetypesFor: archetypesFor, MATS: MATS, SKIES: SKIES, NAMES: NAMES, count: N };
  if (typeof window !== 'undefined') { window.PLANET_GEN = API; window.PLANET_COUNT = N; }
})();
