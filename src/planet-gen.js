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
    // [2026-06-21] SOFTENED the surfaces: rock (restitution 0.75 = very bouncy/hard, and samey) was the base
    // for most worlds → the game played harder + more uniform than intended. Most rock→sand (0.47, forgiving);
    // a few uncertain/charred worlds→mud (0.15, sticky); rock kept ONLY for the genuinely volcanic/molten
    // bodies (ash, ember, plasma_crust, scorched_basalt, dim_ember) so hardness still exists as variety, not
    // the default. Colours unchanged — worlds LOOK identical, just play softer. (base physics in shared.js)
    const CUSTOM = {
      jade: ['grass', '#3fa688'], moss: ['grass', '#7a8f3c'], crimson: ['sand', '#b0463e'],
      rust: ['sand', '#a85a36'], slate: ['sand', '#586878'], plum: ['mud', '#6e4a6e'],
      amber: ['sand', '#d99a3c'], rose: ['sand', '#c77d8a'], gold: ['sand', '#c2a24a'],
      bone: ['sand', '#cabfa0'], teal: ['ice', '#3f9aa6'], frost: ['ice', '#9fd8e8'],
      ash: ['rock', '#46464f'], ember: ['rock', '#c2603a'], cobalt: ['sand', '#4f6fc0'],
      cactus: ['grass', '#4f7d39'], stone: ['sand', '#8b8e94'],   // cactus = green obstacle; stone = sandy-grey accent
      earthgreen: ['grass', '#4f8a3e'], sulfur: ['sand', '#d6c63e'], cyan: ['ice', '#79c6cf'],   // solar-system bodies
      // ── TRAPPIST-1 system (red dwarf) palettes ──
      trappist_plasma_crust: ['rock', '#7a1505'], trappist_charred_basalt: ['mud', '#241a18'],
      trappist_ultramafic_basalt: ['sand', '#4a3026'], trappist_haze_clay: ['sand', '#9a5d44'],
      trappist_terminator_loam: ['sand', '#3f6b5a'], trappist_glacier_ice: ['ice', '#8fa9b8'],   // e = the habitable jewel: dusky teal-green
      trappist_pack_ice: ['ice', '#7d8a93'], trappist_frost_ice: ['ice', '#9fb2bf'],
      trappist_riftice: ['ice', '#7c8a9c'], trappist_tidalbasalt: ['mud', '#2b211f'],
      trappist_regolith: ['sand', '#6b5048'],
      // ── Barnard's Star system (ancient red dwarf) palettes ──
      barnard_void_iron: ['sand', '#1A1A22'], barnard_banded_methane: ['ice', '#4A6B8A'],
      veil_pale_blue_ice: ['ice', '#C8DCE8'], barnard_rift_ice: ['ice', '#2A2E55'],
      barnard_regolith_dust: ['sand', '#8A7E6E'], barnard_copper_silt: ['sand', '#1F7A6D'],
      barnard_crimson_loam: ['grass', '#3B0A14'], barnard_scorched_basalt: ['rock', '#D94A1F'],
      barnard_dim_ember: ['rock', '#C23B22'],
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
    // id, name, land, sky, grav, archetypes (WIDE + distinct — variance), [dMin,dMax] (pushed), waterBias|null, surfCol, deepCol, special, atIdx
    ['earth', 'Earth', 'earthgreen', '#3a6a8a', 1.0, ['gom_smooth', 'gentle_slope', 'gentle_hill', 'rolling_hills', 'downhill', 'uphill', 'punchbowl'], [0.08, 0.5], null, null, null, 'ruins', 4],
    ['luna', 'Luna', 'stone', '#05050a', 0.55, ['crater', 'deep_pocket', 'fortress', 'mesa', 'stepped_descent', 'twin_peaks', 'narrow_gap', 'ziggurat', 'punchbowl'], [0.35, 0.95], null, null, null, 'launchpad', 5],
    ['mars', 'Mars', 'crimson', '#c08868', 0.6, ['canyon_cup', 'canyon', 'cenote', 'deep_plunge', 'mesa', 'cliff_drop', 'fortress', 'crater', 'dramatic_ridge'], [0.4, 1.0], 0.25, 'rgba(80,135,150,0.85)', 'rgba(20,45,60,0.96)', 'obelisk', 6],
    ['phobos', 'Phobos', 'ash', '#08080e', 0.5, ['gauntlet', 'narrow_gap', 'twin_peaks', 'spire_drown', 'deep_plunge', 'fortress', 'cliff_shelf', 'canyon'], [0.45, 1.0], null, null, null, null, 0],
    ['jupiter', 'Jupiter', 'ember', '#3a2818', 1.2, ['gom_islands', 'gauntlet', 'fortress', 'mesa', 'stepped_descent', 'twin_peaks', 'narrow_gap'], [0.45, 0.95], null, null, null, null, 0],
    ['europa', 'Europa', 'frost', '#1a2838', 0.55, ['island_green', 'sea_stack', 'gom_islands', 'cenote', 'crater', 'deep_pocket', 'gom_lake'], [0.3, 0.9], 0.66, 'rgba(95,175,205,0.9)', 'rgba(10,40,72,0.97)', 'sea_stack', 7],
    ['io', 'Io', 'sulfur', '#241208', 0.55, ['cenote', 'crater', 'canyon_cup', 'deep_plunge', 'canyon', 'fortress', 'dramatic_ridge', 'mesa'], [0.4, 1.0], 0.4, 'rgba(228,95,28,0.93)', 'rgba(112,18,8,0.98)', null, 0],
    ['ganymede', 'Ganymede', 'slate', '#10161f', 0.55, ['ziggurat', 'stepped_descent', 'mesa', 'crater', 'shelf', 'deep_pocket', 'canyon', 'gom_smooth'], [0.3, 0.9], 0.35, 'rgba(85,145,185,0.88)', 'rgba(15,38,68,0.96)', null, 0],
    ['titan', 'Titan', 'amber', '#b8722a', 0.5, ['gom_lake', 'island_green', 'cenote', 'punchbowl', 'crater', 'mesa', 'deep_pocket', 'rolling_hills'], [0.25, 0.85], 0.55, 'rgba(120,78,36,0.9)', 'rgba(40,22,8,0.97)', 'ruins', 5],
    ['enceladus', 'Enceladus', 'bone', '#16222e', 0.5, ['sea_stack', 'island_green', 'crater', 'cenote', 'gom_islands', 'deep_pocket', 'spire_drown'], [0.3, 0.9], 0.7, 'rgba(150,205,225,0.9)', 'rgba(30,72,102,0.97)', null, 0],
    ['uranus', 'Uranus', 'cyan', '#143038', 0.95, ['gom_islands', 'gauntlet', 'mesa', 'stepped_descent', 'twin_peaks', 'fortress', 'narrow_gap'], [0.35, 0.9], null, null, null, null, 0],
    ['miranda', 'Miranda', 'plum', '#0e0a16', 0.5, ['deep_plunge', 'canyon_cup', 'cenote', 'fortress', 'narrow_gap', 'spire_drown', 'cliff_shelf', 'dramatic_ridge', 'canyon'], [0.55, 1.0], null, null, null, 'obelisk', 6],
    ['saturn', 'Saturn', 'gold', '#4a3a1c', 1.1, ['gom_islands', 'gauntlet', 'fortress', 'mesa', 'twin_peaks', 'stepped_descent', 'narrow_gap'], [0.4, 0.95], null, null, null, null, 0],
    ['neptune', 'Neptune', 'cobalt', '#0f2547', 1.05, ['gom_islands', 'gauntlet', 'fortress', 'mesa', 'twin_peaks', 'narrow_gap', 'stepped_descent'], [0.4, 0.95], null, null, null, null, 0],
    ['triton', 'Triton', 'rose', '#1a1424', 0.5, ['cenote', 'crater', 'sea_stack', 'deep_pocket', 'gom_lake', 'mesa', 'canyon', 'island_green'], [0.3, 0.9], 0.4, 'rgba(120,150,200,0.88)', 'rgba(20,40,80,0.96)', null, 0],
    ['pluto', 'Pluto', 'bone', '#0a0810', 0.45, ['gom_smooth', 'punchbowl', 'crater', 'deep_pocket', 'rolling_hills', 'mesa', 'cenote', 'shelf'], [0.2, 0.8], 0.35, 'rgba(120,160,180,0.85)', 'rgba(25,45,70,0.96)', 'ruins', 4],
    ['charon', 'Charon', 'rust', '#08060c', 0.45, ['canyon_cup', 'deep_plunge', 'cenote', 'fortress', 'spire_drown', 'narrow_gap', 'cliff_shelf', 'dramatic_ridge'], [0.5, 1.0], null, null, null, 'obelisk', 6],
  ];
  for (const [id, nm, mat, sky, grav, arch, diff, wbias, wcol, wdeep, special, atIdx] of SOLAR) {
    const c = {
      name: nm, worldName: nm, sky: sky, defaultMaterial: mat, materials: [mat],
      gen: 'faceted', archetypes: arch, difficultyRange: diff,
      holeDistMin: 440, holeDistMax: 760, holeCount: 9, validate: true,
      // verticalCam left OFF: a per-hole pan can't help the tall dramatic holes (they exceed the screen);
      // the opt-in code remains in setHoleCamera for a possible future zoom-out approach.
      phys: { gravityScale: grav, windScale: 1 },
    };
    if (wbias != null) { c.floodWater = true; c.waterBias = wbias; c.waterColor = wcol; c.waterDeep = wdeep; }
    if (special) { c.specialHole = special; c.specialHoleAt = atIdx; }
    COURSES[id] = c;
  }
  // Water is RARE on the planets (a hazard, not the theme) — only the genuinely watery worlds stay wet.
  const WET = { europa: 0.28, enceladus: 0.4, titan: 0.45 };
  for (const id in WET) if (COURSES[id]) COURSES[id].waterRarity = WET[id];
  // OVERHANGS on the rocky/dramatic bodies (floating-mass set-pieces; validated; rare via the chasm gate).
  ['luna', 'mars', 'phobos', 'jupiter', 'io', 'ganymede', 'saturn', 'uranus', 'miranda', 'neptune', 'charon'].forEach(function (id) { if (COURSES[id]) COURSES[id].overhangs = true; });
  // A SECOND signature set-piece on some bodies (the first comes from special/atIdx above).
  const SPECIAL2 = { luna: { a: 'ruins', at: 2 }, mars: { a: 'ruins', at: 3 }, miranda: { a: 'ruins', at: 3 }, charon: { a: 'ruins', at: 2 }, titan: { a: 'obelisk', at: 2 }, pluto: { a: 'obelisk', at: 7 }, europa: { a: 'obelisk', at: 3 } };
  for (const id in SPECIAL2) if (COURSES[id]) COURSES[id].specialHoles = [SPECIAL2[id]];

  // ════════ THE TRAPPIST-1 SYSTEM ════════ the next system, reached after Charon: an ultracool RED DWARF
  // star + 7 tidally-locked rocky planets (b–h) + 3 assumed moons. Reddish dim palettes; lava on the hot
  // worlds, water/ice on the habitable ones; the red dwarf STAR itself is the grand finale course.
  const TRAPPIST = [
    // id, name, mat, sky, grav, archetypes, [dMin,dMax], waterBias|null, surfCol, deepCol, special, atIdx
    ['trappist1h', 'TRAPPIST-1h', 'trappist_frost_ice', '#1c1014', 0.52, ['gom_lake', 'cenote', 'spire_drown', 'sea_stack', 'deep_plunge', 'tidal_terminator', 'pressure_ridge', 'gom_islands', 'punchbowl'], [0.5, 0.9], 0.7, 'rgba(150,196,214,0.55)', 'rgba(28,58,82,0.95)', 'pressure_ridge', 7],
    ['trappist1g', 'TRAPPIST-1g', 'trappist_pack_ice', '#5a3242', 1.05, ['gom_islands', 'gom_lake', 'island_green', 'sea_stack', 'spire_drown', 'moat_island_flat', 'stepping_stones', 'cenote', 'chasm_carry', 'melt_basin_shelf'], [0.3, 0.7], 0.62, 'rgba(86,150,158,0.55)', 'rgba(18,46,62,0.94)', 'melt_basin_shelf', 4],
    ['geryn', 'Geryn (TRAPPIST-1g I)', 'trappist_regolith', '#1c1418', 0.48, ['flat_run', 'crater', 'rolling_hills', 'gentle_hill', 'punchbowl', 'mesa', 'stepped_descent', 'washboard_cradle'], [0.12, 0.45], null, null, null, 'washboard_cradle', 2],
    ['trappist1f', 'TRAPPIST-1f', 'trappist_glacier_ice', '#3a2230', 0.96, ['gom_lake', 'cenote', 'gom_islands', 'shelf', 'stepped_descent', 'crater', 'funnel_gather', 'spire_drown', 'frozen_lake'], [0.3, 0.7], 0.42, 'rgba(120,168,196,0.55)', 'rgba(28,52,86,0.92)', 'spire_drown', 6],
    ['fenra', 'Fenra (TRAPPIST-1f I)', 'trappist_tidalbasalt', '#2a0d0a', 0.55, ['geyser_cones', 'crater', 'spire_drown', 'gauntlet', 'deep_pocket', 'wall_shot', 'funnel_gather', 'obelisk', 'caldera_shelf'], [0.32, 0.72], 0.26, 'rgba(255,150,55,0.9)', 'rgba(150,32,12,0.95)', 'caldera_shelf', 6],
    ['trappist1e', 'TRAPPIST-1e', 'trappist_terminator_loam', '#6e3a34', 0.93, ['island_green', 'tidal_terminator', 'gom_lake', 'sea_stack', 'shelf', 'gentle_hill', 'cliff_drop', 'moat_island_flat'], [0.2, 0.6], 0.5, 'rgba(86,140,150,0.55)', 'rgba(24,58,74,0.92)', 'island_green', 4],
    ['elai', 'Elai (TRAPPIST-1e I)', 'trappist_riftice', '#1a1622', 0.42, ['gentle_slope', 'cenote', 'spire_drown', 'chasm_carry', 'stepping_stones', 'shelf', 'crater', 'narrow_gap', 'tidal_terminator'], [0.18, 0.5], 0.32, 'rgba(120,150,185,0.5)', 'rgba(40,60,95,0.85)', 'tidal_terminator', 4],
    ['trappist1d', 'TRAPPIST-1d', 'trappist_haze_clay', '#c47a4e', 0.55, ['mesa', 'gentle_slope', 'funnel_gather', 'water_valley', 'cliff_shelf', 'amphitheatre', 'rolling_hills', 'tidal_terminator', 'washboard_cradle'], [0.28, 0.62], 0.42, 'rgba(168,128,150,0.42)', 'rgba(74,52,86,0.86)', 'tidal_terminator', 4],
    ['trappist1c', 'TRAPPIST-1c', 'trappist_ultramafic_basalt', '#5e1f14', 1.05, ['faceted', 'mesa', 'canyon', 'cliff_drop', 'spire_drown', 'crater', 'dramatic_ridge', 'geyser_cones', 'shelf_drop_shelf', 'caldera_shelf', 'tidal_terminator'], [0.3, 0.7], 0.18, 'rgba(255,120,40,0.78)', 'rgba(150,28,8,0.92)', 'geyser_cones', 4],
    ['trappist1b', 'TRAPPIST-1b', 'trappist_charred_basalt', '#3a1410', 0.85, ['faceted', 'crater', 'geyser_cones', 'cliff_drop', 'mesa', 'spire_drown', 'gauntlet', 'cliff_valley_climb', 'collapsed_lava_tube', 'melt_basin_shelf'], [0.3, 0.8], 0.22, 'rgba(255,120,30,0.92)', 'rgba(150,20,5,0.96)', 'geyser_cones', 6],
    ['trappist1', 'TRAPPIST-1 (The Star)', 'trappist_plasma_crust', '#1a0402', 1.15, ['geyser_cones', 'spire_drown', 'deep_pocket', 'washboard_cradle', 'chasm_carry', 'dramatic_ridge', 'funnel_gather', 'amphitheatre', 'granulation_cells', 'sunspot_basin'], [0.8, 1.0], 0.46, 'rgba(255,150,40,0.78)', 'rgba(150,18,2,0.95)', 'sunspot_basin', 8],
  ];
  const TRAPPIST_OVERHANGS = ['trappist1', 'trappist1b', 'trappist1c', 'trappist1f', 'trappist1h', 'elai', 'fenra'];
  for (const [id, nm, mat, sky, grav, arch, diff, wbias, wcol, wdeep, special, atIdx] of TRAPPIST) {
    const c = {
      name: nm, worldName: nm, sky: sky, defaultMaterial: mat, materials: [mat],
      gen: 'faceted', archetypes: arch, difficultyRange: diff,
      holeDistMin: 440, holeDistMax: 760, holeCount: 9, validate: true,
      phys: { gravityScale: grav, windScale: 1 },
    };
    if (wbias != null) { c.floodWater = true; c.waterBias = wbias; c.waterColor = wcol; c.waterDeep = wdeep; c.waterRarity = 0.4; }
    if (special) { c.specialHole = special; c.specialHoleAt = atIdx; }
    if (TRAPPIST_OVERHANGS.indexOf(id) >= 0) c.overhangs = true;
    COURSES[id] = c;
  }

  // ════════ THE BARNARD'S STAR SYSTEM ════════ the 3rd system, reached after TRAPPIST-1: an ancient, dim,
  // brooding RED DWARF + planets b/d/e + the worlds Solace & Tidewell and the moons Veil/Hollow/Ember.
  const BARNARD = [
    // id, name, mat, sky, grav, archetypes, [dMin,dMax], waterBias|null, surfCol, deepCol, special, atIdx
    ['barnard_e', 'Barnard e', 'barnard_void_iron', '#3A4A66', 0.55, ['flat_run', 'cliff_drop', 'deep_plunge', 'chasm_carry', 'narrow_gap', 'frozen_lake', 'pressure_ridge', 'stepping_stones', 'ice_crust_rift'], [0.35, 0.78], 0.18, 'rgba(92,120,148,0.55)', 'rgba(30,44,64,0.95)', 'chasm_carry', 7],
    ['barnard_d', 'Barnard d', 'barnard_banded_methane', '#5E2436', 0.55, ['flat_run', 'sky_terrace', 'shelf', 'stepped_descent', 'chasm_carry', 'narrow_gap', 'banked_curve', 'funnel_gather', 'cloud_deck_ascension', 'cloud_break_landing'], [0.35, 0.8], null, null, null, 'dramatic_ridge', 7],
    ['veil', 'Veil', 'veil_pale_blue_ice', '#1A0E12', 0.55, ['pressure_ridge', 'geyser_cones', 'frozen_lake', 'spire_drown', 'cliff_shelf', 'narrow_gap', 'stepping_stones', 'veil_plume_field', 'amphitheatre'], [0.4, 0.85], 0.4, 'rgba(127,182,214,0.55)', 'rgba(22,56,79,0.94)', 'geyser_cones', 7],
    ['hollow', 'Hollow', 'barnard_rift_ice', '#5E3326', 0.62, ['frozen_lake', 'cenote', 'spire_drown', 'pressure_ridge', 'chasm_carry', 'stepping_stones', 'deep_plunge', 'narrow_gap', 'tidal_terminator'], [0.4, 0.85], 0.5, 'rgba(44,110,132,0.6)', 'rgba(10,39,64,0.96)', 'tidal_terminator', 7],
    ['ember', 'Ember', 'barnard_regolith_dust', '#2A1418', 0.55, ['crater', 'punchbowl', 'deep_pocket', 'funnel_gather', 'rolling_hills', 'gentle_slope', 'mesa', 'washboard_cradle', 'amphitheatre'], [0.3, 0.72], null, null, null, 'crater', 6],
    ['tidewell', 'Tidewell', 'barnard_copper_silt', '#3A1F2E', 0.78, ['gom_islands', 'gom_lake', 'stepping_stones', 'moat_island_flat', 'sea_stack', 'island_green', 'weed_mat_drift', 'tidal_terminator', 'water_valley'], [0.35, 0.8], 0.7, 'rgba(201,123,74,0.7)', 'rgba(26,74,85,0.95)', 'spire_drown', 7],
    ['solace', 'Solace', 'barnard_crimson_loam', '#E0805A', 0.92, ['twilight_shelf', 'valley', 'rolling_hills', 'gentle_hill', 'tidal_terminator', 'water_valley', 'funnel_gather', 'banked_curve', 'amphitheatre'], [0.3, 0.72], 0.34, 'rgba(122,78,92,0.5)', 'rgba(42,26,46,0.9)', 'tidal_terminator', 8],
    ['barnard_b', 'Barnard b', 'barnard_scorched_basalt', '#2A0E14', 0.82, ['flat_run', 'caldera_shelf', 'collapsed_lava_tube', 'geyser_cones', 'cliff_drop', 'chasm_carry', 'shelf_drop_shelf', 'dramatic_ridge', 'melt_basin_shelf'], [0.45, 0.85], 0.4, 'rgba(255,106,26,0.9)', 'rgba(122,26,5,0.96)', 'collapsed_lava_tube', 7],
    ['barnard_star', 'Barnard\'s Star', 'barnard_dim_ember', '#1A0E14', 1.3, ['granulation_cells', 'sunspot_basin', 'pressure_ridge', 'caldera_shelf', 'dramatic_ridge', 'chasm_carry', 'amphitheatre'], [0.78, 1.0], null, null, null, 'sunspot_basin', 8],
  ];
  const BARNARD_OVERHANGS = ['barnard_e', 'barnard_d', 'veil', 'hollow', 'solace', 'barnard_b', 'barnard_star'];
  for (const [id, nm, mat, sky, grav, arch, diff, wbias, wcol, wdeep, special, atIdx] of BARNARD) {
    const c = {
      name: nm, worldName: nm, sky: sky, defaultMaterial: mat, materials: [mat],
      gen: 'faceted', archetypes: arch, difficultyRange: diff,
      holeDistMin: 440, holeDistMax: 760, holeCount: 9, validate: true,
      phys: { gravityScale: grav, windScale: 1 },
    };
    if (wbias != null) { c.floodWater = true; c.waterBias = wbias; c.waterColor = wcol; c.waterDeep = wdeep; c.waterRarity = 0.4; }
    if (special) { c.specialHole = special; c.specialHoleAt = atIdx; }
    if (BARNARD_OVERHANGS.indexOf(id) >= 0) c.overhangs = true;
    COURSES[id] = c;
  }

  // THE SOLAR TOUR — the ordered itinerary, Earth → Pluto. A run plays each in order; finishing one warps
  // (the seamless ship-travel transition) to the next. The last (Charon) finishes to the recap.
  if (typeof window !== 'undefined') {
    window.SOLAR_ITINERARY = ['earth', 'luna', 'mars', 'phobos', 'jupiter', 'io', 'europa', 'ganymede',
      'saturn', 'titan', 'enceladus', 'uranus', 'miranda', 'neptune', 'triton', 'pluto', 'charon',
      // ── cross into the TRAPPIST-1 system: outer planets inward, moons after their planet, red dwarf star finale ──
      'trappist1h', 'trappist1g', 'geryn', 'trappist1f', 'fenra', 'trappist1e', 'elai', 'trappist1d', 'trappist1c', 'trappist1b', 'trappist1',
      // ── cross into the Barnard's Star system: outermost inward, moons after the ice giant, the dim red dwarf as the grand finale ──
      'barnard_e', 'barnard_d', 'veil', 'hollow', 'ember', 'tidewell', 'solace', 'barnard_b', 'barnard_star'];

    // ── FIRST TWO PLANETS LOOP (?loop2) — a gated, peel-off-able direct comparable to the
    // original desert-golf-roguelike (which loops Earth → Moon forever). When present, the run
    // plays ONLY this project's REAL first two itinerary bodies — earth (9) → luna/Moon (9) —
    // and LOOPS them indefinitely, never advancing to mars and never finishing to the recap.
    //
    // HOW it loops with ZERO change to the advance logic (which lives in the off-limits wrap.js):
    // wrap's tour-advance computes the next body as SOLAR_ITINERARY[indexOf(RG.course) + 1] and
    // only advances while indexOf(RG.course) < length-1. We build a 3-slot itinerary that wraps:
    //   ['earth','luna','earth']
    //   · on 'earth' → indexOf finds the FIRST (0) → next = [1] = 'luna'      (earth → luna)
    //   · on 'luna'  → indexOf = 1, 1 < 2 → next = [2] = 'earth'             (luna → BACK to earth)
    //   · on the 3rd 'earth' there is no separate state — indexOf re-finds 0, so it self-corrects
    //     and the next is 'luna' again. An endless earth ↔ luna ping-pong, no mars, no end.
    // The default tour (flag absent) is byte-for-byte the array above — untouched.
    if (/[?&]loop2(?:=|&|$)/.test(location.search)) {
      window.SOLAR_ITINERARY = ['earth', 'luna', 'earth'];
    }
  }

  // expose the generator so lab.js + the harness build planets at any complexity from the SAME logic
  const API = { buildConfig: buildConfig, archetypesFor: archetypesFor, MATS: MATS, SKIES: SKIES, NAMES: NAMES, count: N };
  if (typeof window !== 'undefined') { window.PLANET_GEN = API; window.PLANET_COUNT = N; }
})();
