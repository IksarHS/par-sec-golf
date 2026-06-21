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
      earthgreen: ['grass', '#4f8a3e'], sulfur: ['sand', '#d6c63e'], cyan: ['ice', '#79c6cf'],   // solar-system bodies
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
    ['compound_terrain', 'dramatic_ridge', 'deep_plunge', 'twin_peaks', 'stepped_descent', 'fortress', 'narrow_gap', 'canyon_cup', 'deep_pocket', 'crater', 'punchbowl', 'ziggurat'], // t4 ~0.8 (gnarly + new crater/punchbowl/ziggurat)
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
  // CRANKED-complexity gom terrain with water flooded into the deep spots + rendered as DEEP sea (down to
  // the screen bottom). Each world: different water amount (seaLevel) + colours. Mostly complex gom for
  // varied silhouettes, with the occasional island/lake hole for change of pace.
  // Water is a MODIFIER on top of normal level gen. Terrain = ordinary gom/gom_smooth archetypes across the
  // FULL difficulty span (simple early holes → complex late holes); the water modifier floods each hole by a
  // per-hole varied amount (waterBias sets the per-world tendency). So every world has the matrix: simple
  // holes with lots of water, complex holes with a little, complex holes with complex water, etc.
  const WATER_WORLDS = [
    // id,    name,             land,    sky,       waterBias, surface waterColor,      deep waterDeep,         archetypes,         difficulty
    ['sea',   'Sunken Reach',   'amber', '#cdeef2', 0.6,  'rgba(40,165,190,0.90)', 'rgba(8,44,74,0.97)',  ['gom', 'gom_islands', 'gom_lake', 'island_green', 'sea_stack'], [0.25, 0.9]],
    ['atoll', 'The Shoals',     'bone',  '#d6f0ec', 0.82, 'rgba(54,186,196,0.88)', 'rgba(10,58,80,0.97)', ['gom', 'gom_islands', 'island_green', 'sea_stack'],            [0.2, 0.82]],
    ['lakes', 'Drowned Canyons','jade',  '#bcd6e0', 0.45, 'rgba(64,135,205,0.90)', 'rgba(8,28,66,0.97)',  ['gom', 'gom', 'gom_lake'],        [0.45, 0.97]],
  ];
  for (const [id, nm, mat, sky, wbias, wcol, wdeep, arch, diff] of WATER_WORLDS) {
    COURSES[id] = {
      name: nm, worldName: nm, sky: sky, defaultMaterial: mat, materials: [mat],
      gen: 'faceted', archetypes: arch,
      difficultyRange: diff, holeDistMin: 460, holeDistMax: 780, holeCount: 9,
      floodWater: true, waterBias: wbias, waterColor: wcol, waterDeep: wdeep, waterRarity: 0.12, validate: true,   // water WORLDS stay wet
      phys: { gravityScale: 1, windScale: 1 },
    };
  }

  // THE ABYSS — a high-complexity showcase: the new deep archetypes (drowned spires, cenotes, gauntlets) +
  // canyon_cup/deep_pocket, with OVERHANGS floating over the chasms (planetComplexity) and DEEP water
  // flooded in. The marriage of complex terrain + overhang + water the way canyon_cup+overhang felt cool.
  COURSES['abyss'] = {
    name: 'The Abyss', worldName: 'The Abyss', sky: '#0c1622',
    defaultMaterial: 'slate', materials: ['slate'],
    gen: 'faceted',
    archetypes: ['spire_drown', 'cenote', 'gauntlet', 'canyon_cup', 'deep_pocket', 'island_green', 'sea_stack'],
    difficultyRange: [0.6, 0.95], holeDistMin: 500, holeDistMax: 820, holeCount: 9,
    planetComplexity: 0.9,                                  // → overhang set-pieces over the chasms
    floodWater: true, waterBias: 0.72,
    waterColor: 'rgba(40,150,185,0.90)', waterDeep: 'rgba(6,28,58,0.98)',
    validate: true,
    phys: { gravityScale: 1, windScale: 1 },
  };

  // ── THE SOLAR SYSTEM ── 12 courses, Earth → Uranus + moons. Each = a palette (land + sky), gravity, an
  // optional liquid (water/lava/methane with its own colour), an archetype mix for its vibe, and a signature
  // SPECIAL hole (ruins / launchpad / obelisk — "something was here") at one index.
  const SOLAR = [
    // id, name, land, sky, grav, archetypes, [dMin,dMax], waterBias|null, surfCol, deepCol, special, atIdx
    ['earth', 'Earth', 'earthgreen', '#3a6a8a', 1.0, ['gom', 'gom_smooth', 'gom_lake', 'punchbowl', 'island_green'], [0.15, 0.7], 0.4, 'rgba(50,120,180,0.9)', 'rgba(10,40,90,0.97)', 'ruins', 4],
    ['luna', 'Luna', 'stone', '#05050a', 0.55, ['crater', 'gom', 'deep_pocket', 'fortress', 'gom_smooth'], [0.2, 0.85], null, null, null, 'launchpad', 5],
    ['mars', 'Mars', 'crimson', '#c08868', 0.6, ['gom', 'canyon_cup', 'cenote', 'deep_plunge', 'crater'], [0.3, 0.9], 0.25, 'rgba(80,135,150,0.85)', 'rgba(20,45,60,0.96)', 'obelisk', 6],
    ['phobos', 'Phobos', 'ash', '#08080e', 0.5, ['gauntlet', 'gom', 'narrow_gap', 'twin_peaks', 'spire_drown'], [0.4, 0.95], null, null, null, null, 0],
    ['jupiter', 'Jupiter', 'ember', '#3a2818', 1.2, ['gom_islands', 'gauntlet', 'gom', 'fortress'], [0.4, 0.9], null, null, null, null, 0],
    ['europa', 'Europa', 'frost', '#1a2838', 0.55, ['gom', 'island_green', 'sea_stack', 'gom_islands', 'gom_lake'], [0.25, 0.8], 0.66, 'rgba(95,175,205,0.9)', 'rgba(10,40,72,0.97)', 'sea_stack', 7],
    ['io', 'Io', 'sulfur', '#241208', 0.55, ['gom', 'cenote', 'crater', 'deep_plunge', 'canyon_cup'], [0.3, 0.9], 0.4, 'rgba(228,95,28,0.93)', 'rgba(112,18,8,0.98)', null, 0],
    ['ganymede', 'Ganymede', 'slate', '#10161f', 0.55, ['gom', 'ziggurat', 'stepped_descent', 'gom_smooth', 'crater'], [0.25, 0.85], 0.35, 'rgba(85,145,185,0.88)', 'rgba(15,38,68,0.96)', null, 0],
    ['titan', 'Titan', 'amber', '#b8722a', 0.5, ['gom', 'gom_lake', 'island_green', 'punchbowl', 'gom_smooth'], [0.2, 0.78], 0.55, 'rgba(120,78,36,0.9)', 'rgba(40,22,8,0.97)', 'ruins', 5],
    ['enceladus', 'Enceladus', 'bone', '#16222e', 0.5, ['gom', 'sea_stack', 'island_green', 'crater', 'gom_islands'], [0.25, 0.82], 0.7, 'rgba(150,205,225,0.9)', 'rgba(30,72,102,0.97)', null, 0],
    ['uranus', 'Uranus', 'cyan', '#143038', 0.95, ['gom_islands', 'gom_smooth', 'gauntlet', 'gom'], [0.3, 0.85], null, null, null, null, 0],
    ['miranda', 'Miranda', 'plum', '#0e0a16', 0.5, ['deep_plunge', 'canyon_cup', 'cenote', 'fortress', 'narrow_gap', 'spire_drown'], [0.5, 0.97], null, null, null, 'obelisk', 6],
    ['saturn', 'Saturn', 'gold', '#4a3a1c', 1.1, ['gom_islands', 'gauntlet', 'gom', 'gom_smooth'], [0.35, 0.85], null, null, null, null, 0],
    ['neptune', 'Neptune', 'cobalt', '#0f2547', 1.05, ['gom_islands', 'gom_smooth', 'gauntlet', 'gom'], [0.35, 0.85], null, null, null, null, 0],
    ['triton', 'Triton', 'rose', '#1a1424', 0.5, ['gom', 'cenote', 'crater', 'sea_stack', 'gom_smooth'], [0.25, 0.8], 0.4, 'rgba(120,150,200,0.88)', 'rgba(20,40,80,0.96)', null, 0],
    ['pluto', 'Pluto', 'bone', '#0a0810', 0.45, ['gom', 'gom_smooth', 'punchbowl', 'crater', 'deep_pocket'], [0.2, 0.8], 0.35, 'rgba(120,160,180,0.85)', 'rgba(25,45,70,0.96)', 'ruins', 4],
    ['charon', 'Charon', 'rust', '#08060c', 0.45, ['canyon_cup', 'deep_plunge', 'cenote', 'fortress', 'spire_drown'], [0.45, 0.95], null, null, null, 'obelisk', 6],
  ];
  for (const [id, nm, mat, sky, grav, arch, diff, wbias, wcol, wdeep, special, atIdx] of SOLAR) {
    const c = {
      name: nm, worldName: nm, sky: sky, defaultMaterial: mat, materials: [mat],
      gen: 'faceted', archetypes: arch, difficultyRange: diff,
      holeDistMin: 440, holeDistMax: 760, holeCount: 9, validate: true,
      phys: { gravityScale: grav, windScale: 1 },
    };
    if (wbias != null) { c.floodWater = true; c.waterBias = wbias; c.waterColor = wcol; c.waterDeep = wdeep; }
    if (special) { c.specialHole = special; c.specialHoleAt = atIdx; }
    COURSES[id] = c;
  }
  // Water is RARE on the planets (a hazard, not the theme) — only the genuinely watery worlds stay wet.
  const WET = { europa: 0.28, enceladus: 0.4, titan: 0.45, earth: 0.5 };
  for (const id in WET) if (COURSES[id]) COURSES[id].waterRarity = WET[id];

  // THE SOLAR TOUR — the ordered itinerary, Earth → Pluto. A run plays each in order; finishing one warps
  // (the seamless ship-travel transition) to the next. The last (Charon) finishes to the recap.
  if (typeof window !== 'undefined') {
    window.SOLAR_ITINERARY = ['earth', 'luna', 'mars', 'phobos', 'jupiter', 'io', 'europa', 'ganymede',
      'saturn', 'titan', 'enceladus', 'uranus', 'miranda', 'neptune', 'triton', 'pluto', 'charon'];
  }

  // expose the generator so lab.js + the harness build planets at any complexity from the SAME logic
  const API = { buildConfig: buildConfig, archetypesFor: archetypesFor, MATS: MATS, SKIES: SKIES, NAMES: NAMES, count: N };
  if (typeof window !== 'undefined') { window.PLANET_GEN = API; window.PLANET_COUNT = N; }
})();
