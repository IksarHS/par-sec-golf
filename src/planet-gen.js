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
      // ── KEPLER-90 system (Sun-like G-star, 8 planets — "the other solar system") — BRIGHT + varied ──
      kepler_jade_sea: ['ice', '#2FB39A'], kepler_amber_reef: ['sand', '#E0A23A'],
      kepler_violet_crystal: ['sand', '#8C5CD6'], kepler_teal_terrace: ['grass', '#3FAE9C'],
      kepler_coral_hollow: ['sand', '#E87A5C'], kepler_ice_loom: ['ice', '#9FE0E8'],
      kepler_jade_giant: ['grass', '#46B06A'], kepler_gold_crown: ['sand', '#D8B24A'],
      kepler_plasma: ['rock', '#FFAE3A'],
      // ── PROXIMA CENTAURI system (nearest star — red dwarf, planets b/c/d + invented moons) — kept COLORFUL ──
      prox_dawn_coral: ['sand', '#F08A6A'], prox_verdant: ['grass', '#3FB07A'],
      prox_amethyst: ['sand', '#9A6AD0'], prox_frost: ['ice', '#7FD0E0'],
      prox_cinder_bright: ['sand', '#E89A4A'], prox_near_fire: ['rock', '#FF9A30'],
      // ── TAU CETI system (6th system — the DREAM-GENERATOR system; bodies built ONLY by holegen/) — jade/
      // teal/violet/amber/coral/ice, NO brown. Each leans on composed concepts + (cavernous bodies) the cave
      // layer + (signature bodies) floating landmark set-pieces incl. the ziggurat. (peel with the system block) ──
      tau_jade_wake: ['grass', '#2FB389'], tau_teal_rise: ['ice', '#3FB3B0'],
      tau_violet_hollow: ['sand', '#8C6AD6'], tau_amber_veil: ['sand', '#E0A23A'],
      tau_coral_caldra: ['sand', '#E8775C'], tau_coral_shelf: ['sand', '#E89A7A'],
      tau_ice_vesh: ['ice', '#9FE0E8'], tau_plasma_gold: ['rock', '#FFB23A'],
    };
    for (const k in CUSTOM) if (!MATERIALS[k]) { const c = CUSTOM[k]; MATERIALS[k] = Object.assign(phys(c[0]), { color: c[1], colorLight: c[1] }); }
  }

  // ── TRUE complexity control (P3) ────────────────────────────────────────────────────────────────────
  // Cumulative archetype tiers — higher complexity unlocks more dramatic native archetypes ON TOP of the
  // calmer ones, so simple planets stay simple and complex ones get the wild stuff too. BUT tiers alone only
  // swap WHICH single-feature shape is picked — a "complex" hole could still roll a trivial slope. So the
  // pool is now (a) anchored by 'complex_composite' (a multi-feature, drama-scaling spine whose intricacy
  // tracks difficulty) whose PRESENCE grows with c, and (b) the calmest single-feature shapes are DROPPED as
  // c rises (no flat_run/gentle_slope on a gnarly world). Result: dragging c genuinely ramps intricacy, not
  // just shape vocabulary. ('complex_composite' is registered in level-design.js.)
  const TIERS = [
    ['flat_run', 'faceted', 'gentle_slope', 'downhill', 'uphill', 'gentle_hill'],   // t0  (gentle)
    ['rolling_hills', 'valley', 'shelf', 'cliff_drop', 'washboard_cradle'],          // t1  ~0.2  (angular)
    ['mesa', 'peak_obstacle', 'stepped_descent', 'dramatic_ridge', 'sky_terrace', 'summit_saddle'], // t2 ~0.4 (dramatic)
    ['canyon', 'twin_peaks', 'deep_plunge', 'shelf_drop_shelf', 'cliff_valley_climb', 'chasm_carry', 'amphitheatre'], // t3 ~0.6 (big)
    ['compound_terrain', 'dramatic_ridge', 'deep_plunge', 'twin_peaks', 'stepped_descent', 'fortress', 'narrow_gap', 'canyon_cup', 'deep_pocket', 'crater', 'punchbowl', 'ziggurat'], // t4 ~0.8 (gnarly)
  ];
  // The calmest shapes that should FADE OUT of the pool as complexity climbs (so high-c never rolls a
  // single trivial slope). Removed once c crosses the matching threshold.
  const FADE = [['flat_run', 0.45], ['gentle_slope', 0.5], ['faceted', 0.55], ['downhill', 0.6], ['uphill', 0.6], ['gentle_hill', 0.5]];
  function archetypesFor(c) {
    const upto = Math.min(TIERS.length, 1 + Math.floor(c / 0.2 + 0.001));
    let a = []; for (let i = 0; i < upto; i++) a = a.concat(TIERS[i]);
    // drop the calmest shapes once complexity passes their fade threshold
    for (const [name, thr] of FADE) if (c >= thr) a = a.filter((n) => n !== name);
    // the multi-feature spine: ALWAYS available, and its share of the pool grows with c so harder worlds
    // reliably get intricate multi-feature holes (repeats raise its weight in the filtered course pool).
    const composites = 1 + Math.round(c * 4);   // 1 copy at c=0 … 5 copies at c=1
    for (let i = 0; i < composites; i++) a.push('complex_composite');
    return a;
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
    // EARLY ON-RAMP: the opening bodies of the tour carry GENTLER difficulty ranges so the first session is
    // approachable (was earth[0.08,0.5] luna[0.35,0.95] mars[0.4,1.0] phobos[0.45,1.0] — too hard from hole 1).
    // Later planets keep their authored difficulty. Completability is unaffected (lower drama = easier holes).
    ['earth', 'Earth', 'earthgreen', '#3a6a8a', 1.0, ['gom_smooth', 'gentle_slope', 'gentle_hill', 'rolling_hills', 'downhill', 'uphill', 'punchbowl'], [0.06, 0.38], null, null, null, 'ruins', 4],
    ['luna', 'Luna', 'stone', '#05050a', 0.55, ['crater', 'deep_pocket', 'fortress', 'mesa', 'stepped_descent', 'twin_peaks', 'narrow_gap', 'ziggurat', 'punchbowl'], [0.22, 0.7], null, null, null, 'launchpad', 5],
    ['mars', 'Mars', 'crimson', '#c08868', 0.6, ['canyon_cup', 'canyon', 'cenote', 'deep_plunge', 'mesa', 'cliff_drop', 'fortress', 'crater', 'dramatic_ridge'], [0.28, 0.78], 0.25, 'rgba(80,135,150,0.85)', 'rgba(20,45,60,0.96)', 'obelisk', 6],
    ['phobos', 'Phobos', 'ash', '#08080e', 0.5, ['gauntlet', 'narrow_gap', 'twin_peaks', 'spire_drown', 'deep_plunge', 'fortress', 'cliff_shelf', 'canyon'], [0.32, 0.82], null, null, null, null, 0],
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
  // ── P4: CAVE / OVERHANG archetypes gated onto the dramatic rocky/cavernous bodies (cup-under-lip, putt-in
  // cave, walk-under arch). Each is a designed heightfield floor + an authored solid roof slab; bot-validated.
  // Added as ONE signature cave hole per body (via specialHoles, at a free index) so a cave reliably appears
  // without flooding the pool. Only on rocky/cratered worlds where a stone roof reads.
  const CAVE_BODIES = { luna: 'cup_under_lip', mars: 'arch_under', io: 'putt_cave', ganymede: 'cup_under_lip', miranda: 'arch_under', charon: 'putt_cave', phobos: 'cup_under_lip' };
  for (const id in CAVE_BODIES) {
    if (!COURSES[id]) continue;
    const a = CAVE_BODIES[id];
    if (COURSES[id].archetypes && COURSES[id].archetypes.indexOf(a) < 0) COURSES[id].archetypes = COURSES[id].archetypes.concat(a);
    const used = new Set();                                                    // avoid colliding with existing special hole indices
    if (COURSES[id].specialHoleAt != null) used.add(COURSES[id].specialHoleAt);
    (COURSES[id].specialHoles || []).forEach(sh => used.add(sh.at));
    let at = 5; while (used.has(at) && at < 9) at++;                          // first free index from 5
    COURSES[id].specialHoles = (COURSES[id].specialHoles || []).concat({ a, at });
  }

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

  // ── P4: signature CAVE / OVERHANG holes on the cavernous bodies of the outer two systems too. Same
  // designed-floor + authored-roof archetypes (cup-under-lip / putt-cave / arch-under), bot-validated.
  const CAVE_BODIES2 = {
    trappist1b: 'putt_cave', trappist1c: 'arch_under', fenra: 'cup_under_lip', elai: 'arch_under',
    veil: 'cup_under_lip', hollow: 'putt_cave', barnard_b: 'arch_under', ember: 'cup_under_lip',
  };
  for (const id in CAVE_BODIES2) {
    if (!COURSES[id]) continue;
    const a = CAVE_BODIES2[id];
    if (COURSES[id].archetypes && COURSES[id].archetypes.indexOf(a) < 0) COURSES[id].archetypes = COURSES[id].archetypes.concat(a);
    COURSES[id].overhangs = true;                                              // ensure set-piece collision path is on
    const used = new Set();
    if (COURSES[id].specialHoleAt != null) used.add(COURSES[id].specialHoleAt);
    (COURSES[id].specialHoles || []).forEach(sh => used.add(sh.at));
    let at = 5; while (used.has(at) && at < 9) at++;
    COURSES[id].specialHoles = (COURSES[id].specialHoles || []).concat({ a, at });
  }

  // ════════ THE KEPLER-90 SYSTEM ════════ (P6) the 4th system, reached after Barnard's Star: a real
  // Sun-like G-star with 8 confirmed planets — "the other solar system". COLORFUL invented bodies
  // (jade/teal/violet/amber/coral/ice — NOT brown), each leaning on a different P5 silhouette set so the
  // system reads as varied. The G-star itself is the grand finale. Bright skies.
  const KEPLER = [
    // id, name, mat, sky, grav, archetypes, [dMin,dMax], waterBias|null, surfCol, deepCol, special, atIdx
    ['kepler90b', 'Kepler-90b · Verdshoal', 'kepler_jade_sea', '#1e3a44', 0.92, ['horseshoe_bay', 'halfpipe_gather', 'archipelago_hop', 'island_green', 'shallow_saucer_pin', 'twin_lobe_valley', 'crescent_dune_bay', 'sea_stack'], [0.25, 0.65], 0.55, 'rgba(47,179,154,0.55)', 'rgba(12,70,64,0.95)', 'horseshoe_bay', 4],
    ['kepler90c', 'Kepler-90c · Amberreef', 'kepler_amber_reef', '#3a2e1a', 0.9, ['aqueduct_arches', 'colonnade_cloister', 'coral_fan', 'ocean_groundswell', 'silo_cluster', 'billowing_hills', 'derelict_hull_ramp', 'rolling_hills'], [0.3, 0.68], 0.3, 'rgba(224,162,58,0.45)', 'rgba(120,72,20,0.9)', 'aqueduct_arches', 5],
    ['kepler90i', 'Kepler-90i · Violetspire', 'kepler_violet_crystal', '#241a36', 0.6, ['cathedral_spires', 'crystal_cluster', 'needle_spire_crown', 'jagged_rock_fins', 'matterhorn_col', 'knife_edge_arete', 'hoodoo_field', 'dragon_back'], [0.4, 0.85], null, null, null, 'cathedral_spires', 6],
    ['kepler90d', 'Kepler-90d · Tealterrace', 'kepler_teal_terrace', '#1a3a34', 0.95, ['rice_paddy_terraces', 'temple_grand_staircase', 'pyramid_step_apex', 'sunken_stadium', 'zigzag_ledge_climb', 'split_level_benches', 'amphitheatre', 'dropped_shelf_cascade'], [0.3, 0.72], null, null, null, 'temple_grand_staircase', 4],
    ['kepler90e', 'Kepler-90e · Coral Hollows', 'kepler_coral_hollow', '#3a221c', 0.75, ['rock_arch_bridge', 'tunnel_mouth', 'undercut_cliff', 'mushroom_rock', 'colonnade_cloister', 'crater', 'punchbowl', 'honeycomb_pockets'], [0.35, 0.78], 0.32, 'rgba(232,122,92,0.5)', 'rgba(120,46,32,0.9)', 'rock_arch_bridge', 5],
    ['kepler90f', 'Kepler-90f · Iceloom', 'kepler_ice_loom', '#16323a', 0.9, ['caldera_dish', 'kettle_pond', 'teacup_saucer', 'frozen_lake', 'terraced_bowl', 'shallow_saucer_pin', 'funnel_chute', 'spiral_gather'], [0.3, 0.72], 0.45, 'rgba(159,224,232,0.5)', 'rgba(40,96,120,0.92)', 'caldera_dish', 6],
    ['kepler90g', 'Kepler-90g · Jade Giant', 'kepler_jade_giant', '#1a3624', 1.15, ['archipelago_hop', 'broken_bridge_pillar', 'catwalk_pads', 'leapfrog_risers', 'fjord_crossing', 'gom_islands', 'land_bridge_neck', 'stepping_stones'], [0.4, 0.85], 0.4, 'rgba(70,176,106,0.5)', 'rgba(18,72,40,0.92)', 'broken_bridge_pillar', 5],
    ['kepler90h', 'Kepler-90h · Goldcrown', 'kepler_gold_crown', '#322a16', 1.0, ['table_mountain_saddle', 'double_decker_mesa', 'wedge_ramp_mesa', 'tilted_flatiron', 'undercut_mesa', 'flat_top_butte', 'split_mesa_chasm', 'slot_mesa_pocket'], [0.35, 0.8], null, null, null, 'flat_top_butte', 5],
    ['kepler90', 'Kepler-90 (The Star)', 'kepler_plasma', '#2a1206', 1.2, ['granulation_cells', 'sunspot_basin', 'volcano_crater_cup', 'dragon_back', 'lightning_zigzag', 'geyser_cones', 'funnel_gather', 'amphitheatre'], [0.8, 1.0], 0.4, 'rgba(255,174,58,0.7)', 'rgba(150,40,4,0.95)', 'sunspot_basin', 8],
  ];
  const KEPLER_OVERHANGS = ['kepler90e', 'kepler90i', 'kepler90', 'kepler90g'];
  for (const [id, nm, mat, sky, grav, arch, diff, wbias, wcol, wdeep, special, atIdx] of KEPLER) {
    const c = {
      name: nm, worldName: nm, sky: sky, defaultMaterial: mat, materials: [mat],
      gen: 'faceted', archetypes: arch, difficultyRange: diff,
      holeDistMin: 440, holeDistMax: 760, holeCount: 9, validate: true,
      phys: { gravityScale: grav, windScale: 1 },
    };
    if (wbias != null) { c.floodWater = true; c.waterBias = wbias; c.waterColor = wcol; c.waterDeep = wdeep; c.waterRarity = 0.4; }
    if (special) { c.specialHole = special; c.specialHoleAt = atIdx; }
    if (KEPLER_OVERHANGS.indexOf(id) >= 0) c.overhangs = true;
    COURSES[id] = c;
  }

  // ════════ THE PROXIMA CENTAURI SYSTEM ════════ (P6) the 5th system, reached after Kepler-90: the NEAREST
  // star (a red dwarf), planets b/c/d + 2 invented moons. Kept deliberately COLORFUL (coral/jade/violet/
  // cyan/amber) despite the dim-red-dwarf reality — the brief is bright, not dreary. The near fire is the finale.
  const PROXIMA = [
    // id, name, mat, sky, grav, archetypes, [dMin,dMax], waterBias|null, surfCol, deepCol, special, atIdx
    ['proxima_d', 'Proxima d · Dawnglass', 'prox_dawn_coral', '#3a221c', 0.6, ['ocean_groundswell', 'billowing_hills', 'crescent_dune_bay', 'sine_swell_run', 'quilted_dunes', 'rolling_moguls', 'horseshoe_bay', 'gentle_hill'], [0.2, 0.6], null, null, null, 'crescent_dune_bay', 4],
    ['proxima_b', 'Proxima b · Verdant', 'prox_verdant', '#1a3a2c', 0.95, ['halfpipe_gather', 'amphitheater_hollow', 'twin_lobe_valley', 'bermed_basin', 'island_green', 'shallow_saucer_pin', 'moat_ringed_plateau', 'punchbowl'], [0.25, 0.66], 0.5, 'rgba(63,176,122,0.5)', 'rgba(20,80,52,0.92)', 'amphitheater_hollow', 5],
    ['wisp', 'Wisp (Proxima b I)', 'prox_amethyst', '#241a36', 0.45, ['arch_under', 'tunnel_mouth', 'rock_arch_bridge', 'crystal_cluster', 'undercut_cliff', 'mushroom_rock', 'pylon_base', 'crater'], [0.25, 0.62], null, null, null, 'arch_under', 4],
    ['proxima_c', 'Proxima c · Frostmere', 'prox_frost', '#16303a', 1.05, ['kettle_pond', 'caldera_dish', 'frozen_lake', 'rice_paddy_terraces', 'descending_sump_stairs', 'terraced_bowl', 'pressure_ridge', 'bermed_basin'], [0.3, 0.75], 0.46, 'rgba(127,208,224,0.5)', 'rgba(30,84,108,0.92)', 'caldera_dish', 6],
    ['cinder', 'Cinder (Proxima c I)', 'prox_cinder_bright', '#2a1c10', 0.5, ['volcano_crater_cup', 'geyser_cones', 'jagged_rock_fins', 'matterhorn_col', 'hoodoo_field', 'caldera_shelf', 'dragon_back', 'shark_fin_ridge'], [0.32, 0.78], 0.22, 'rgba(232,154,74,0.85)', 'rgba(150,52,16,0.92)', 'volcano_crater_cup', 5],
    ['proxima', 'Proxima Centauri (The Star)', 'prox_near_fire', '#2a0e06', 1.18, ['granulation_cells', 'sunspot_basin', 'lightning_zigzag', 'dragon_back', 'funnel_gather', 'chasm_carry', 'amphitheatre', 'volcano_crater_cup'], [0.8, 1.0], 0.42, 'rgba(255,154,48,0.72)', 'rgba(150,38,6,0.95)', 'sunspot_basin', 8],
  ];
  const PROXIMA_OVERHANGS = ['wisp', 'proxima_c', 'cinder', 'proxima', 'proxima_b'];
  for (const [id, nm, mat, sky, grav, arch, diff, wbias, wcol, wdeep, special, atIdx] of PROXIMA) {
    const c = {
      name: nm, worldName: nm, sky: sky, defaultMaterial: mat, materials: [mat],
      gen: 'faceted', archetypes: arch, difficultyRange: diff,
      holeDistMin: 440, holeDistMax: 760, holeCount: 9, validate: true,
      phys: { gravityScale: grav, windScale: 1 },
    };
    if (wbias != null) { c.floodWater = true; c.waterBias = wbias; c.waterColor = wcol; c.waterDeep = wdeep; c.waterRarity = 0.4; }
    if (special) { c.specialHole = special; c.specialHoleAt = atIdx; }
    if (PROXIMA_OVERHANGS.indexOf(id) >= 0) c.overhangs = true;
    COURSES[id] = c;
  }

  // ════════ THE TAU CETI SYSTEM ════════ (the DREAM-GENERATOR system) the 6th system, reached after Proxima:
  // a real Sun-like G-star (Tau Ceti, 12 ly) with confirmed planets e/f/g/h + invented moons. EVERY body's
  // holes come ONLY from the new composed-signal dream pipeline (gen:'composed' → holegen/) — NO old
  // archetypes. Colorful invented bodies (jade/teal/violet/amber/coral/ice, no brown). Cavernous bodies add
  // the REAL cave layer (dream_*); two SIGNATURE bodies add floating landmark set-pieces incl. the ziggurat.
  // GATED PEEL-OFF UNIT: this Tau Ceti block + its itinerary entries + the holegen/ <script> tags form ONE
  // deletable unit → delete all three and the 5-system tour (Sol→Proxima) is byte-identical. The courses use
  // gen:'composed' + dream_* archetype names that ONLY holegen/dreamgen.js registers, so they stay dormant
  // (never selectable, never on the tour) unless the pipeline is loaded.
  {
    var dc = function (n) { return 'dream_' + n; };
    var df = function (n) { return 'dream_float_' + n; };
    // Each body: id, name, mat, sky, grav, [dMin,dMax], caves:[{a,at}], floaters:[{a,at}].
    // gen:'composed' → the 'composed' archetype (picks a concept per hole); caves/floaters are signature
    // holes forced at fixed indices. All names come ONLY from the dream pipeline (no old archetypes).
    var TAU_CETI = [
      { id: 'tauceti_g', name: 'Tau Ceti g · Jadewake', mat: 'tau_jade_wake', sky: '#1e3a30', grav: 0.92, diff: [0.25, 0.62],
        caves: [{ a: dc('cup_under_lip'), at: 4 }], floaters: [] },
      { id: 'tauceti_h', name: 'Tau Ceti h · Tealrise', mat: 'tau_teal_rise', sky: '#16323a', grav: 0.96, diff: [0.3, 0.7],
        caves: [{ a: dc('pocket_wall'), at: 5 }], floaters: [] },
      { id: 'liss', name: 'Liss (Tau Ceti h I)', mat: 'tau_violet_hollow', sky: '#241a36', grav: 0.5, diff: [0.3, 0.72],
        caves: [{ a: dc('slot_canyon'), at: 3 }, { a: dc('drop_cavern'), at: 6 }], floaters: [] },
      { id: 'tauceti_e', name: 'Tau Ceti e · Amberveil', mat: 'tau_amber_veil', sky: '#3a2e1a', grav: 0.9, diff: [0.3, 0.72],
        caves: [{ a: dc('stone_arch'), at: 5 }], floaters: [] },
      { id: 'caldra', name: 'Caldra (Tau Ceti e I)', mat: 'tau_coral_caldra', sky: '#2a1c1c', grav: 0.55, diff: [0.32, 0.78],
        caves: [], floaters: [{ a: df('ziggurat'), at: 6 }, { a: df('floating_isles'), at: 3 }] },
      { id: 'tauceti_f', name: 'Tau Ceti f · Coralshelf', mat: 'tau_coral_shelf', sky: '#3a221c', grav: 0.88, diff: [0.3, 0.74],
        caves: [{ a: dc('tunnel_putt'), at: 4 }, { a: dc('double_decker'), at: 7 }], floaters: [] },
      { id: 'vesh', name: 'Vesh (Tau Ceti f I)', mat: 'tau_ice_vesh', sky: '#16242e', grav: 0.5, diff: [0.32, 0.78],
        caves: [{ a: dc('the_maw'), at: 4 }], floaters: [{ a: df('great_arch'), at: 6 }, { a: df('spire_pin'), at: 2 }] },
      { id: 'tauceti', name: 'Tau Ceti (The Star)', mat: 'tau_plasma_gold', sky: '#2a1a06', grav: 1.15, diff: [0.7, 1.0],
        caves: [{ a: dc('keyhole'), at: 5 }], floaters: [{ a: df('leviathan'), at: 7 }] },
    ];
    for (var ti = 0; ti < TAU_CETI.length; ti++) {
      var T = TAU_CETI[ti];
      // POOL = composed only → every NON-signature hole is a generator-native composed hole. The cave/float
      // signatures fire ONLY at their fixed specialHoles index (the idiosyncrasy rule: rare landmarks against a
      // calm composed baseline), since the specialHole path resolves archetypes[sh.a] directly (not via the pool).
      var arch = ['composed'];
      var specials = T.caves.concat(T.floaters);
      var co = {
        name: T.name, worldName: T.name, sky: T.sky, defaultMaterial: T.mat, materials: [T.mat],
        gen: 'composed',                                  // ← THE dream pipeline (no old archetypes)
        archetypes: arch, difficultyRange: T.diff,
        holeDistMin: 460, holeDistMax: 780, holeCount: 9, validate: true,
        overhangs: true,                                  // set-pieces collision path on (caves/floaters emit slabs)
        phys: { gravityScale: T.grav, windScale: 1 },
      };
      if (specials.length) co.specialHoles = specials;
      COURSES[T.id] = co;
    }
  }

  // THE SOLAR TOUR — the ordered itinerary, Earth → Pluto. A run plays each in order; finishing one warps
  // (the seamless ship-travel transition) to the next. The last (Charon) finishes to the recap.
  if (typeof window !== 'undefined') {
    window.SOLAR_ITINERARY = ['earth', 'luna', 'mars', 'phobos', 'jupiter', 'io', 'europa', 'ganymede',
      'saturn', 'titan', 'enceladus', 'uranus', 'miranda', 'neptune', 'triton', 'pluto', 'charon',
      // ── cross into the TRAPPIST-1 system: outer planets inward, moons after their planet, red dwarf star finale ──
      'trappist1h', 'trappist1g', 'geryn', 'trappist1f', 'fenra', 'trappist1e', 'elai', 'trappist1d', 'trappist1c', 'trappist1b', 'trappist1',
      // ── cross into the Barnard's Star system: outermost inward, moons after the ice giant, the dim red dwarf as the grand finale ──
      'barnard_e', 'barnard_d', 'veil', 'hollow', 'ember', 'tidewell', 'solace', 'barnard_b', 'barnard_star',
      // ── (P6) cross into KEPLER-90 — "the other solar system" (8 planets), bodies outer→inner, the G-star finale ──
      'kepler90b', 'kepler90c', 'kepler90i', 'kepler90d', 'kepler90e', 'kepler90f', 'kepler90g', 'kepler90h', 'kepler90',
      // ── (P6) cross into PROXIMA CENTAURI — the nearest star: planets + moons, the near fire as the grand finale ──
      'proxima_d', 'proxima_b', 'wisp', 'proxima_c', 'cinder', 'proxima'];

    // ── cross into TAU CETI — the DREAM-GENERATOR system. Part of the Tau Ceti peel-off unit (drop these 8
    // ids together with the system block + holegen tags → byte-identical tour). The composed/dream_* courses
    // are dormant without the pipeline, so a stray entry can't break the base tour. ──
    if (COURSES['tauceti_g']) {
      window.SOLAR_ITINERARY = window.SOLAR_ITINERARY.concat([
        'tauceti_g', 'tauceti_h', 'liss', 'tauceti_e', 'caldra', 'tauceti_f', 'vesh', 'tauceti']);
    }

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
