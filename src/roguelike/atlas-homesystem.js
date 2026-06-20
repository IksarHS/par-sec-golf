// ── atlas-homesystem.js — HOME-SYSTEM ROSTER, versions to choose from (peel-off, gated ?course=) ───
// Per docs/home-system-roster.md: the prototype's home system = REAL solar-system bodies, normal golf
// made interesting by TERRAIN + MATERIAL + GRAVITY (no gameplay hooks). For review, each new body has
// 2–3 VERSIONS (different terrain interpretations) — the designer plays them and picks one per body;
// the rest get cut. IDs: <body>-1/2/3.  Theming/sky here is placeholder colour only — real surface art
// routes to the gen-art pipeline later. Each planet uses the per-hole STILL frame (camera holds during
// play, re-frames only between holes) so even dramatic terrain stays on-screen.
(function () {
  if (typeof window === 'undefined' || !window.RG_ATLAS) return;
  var A = window.RG_ATLAS;

  function hole() { return (typeof holes !== 'undefined') ? holes[(typeof currentHole !== 'undefined') ? currentHole : 0] : null; }
  // per-hole still frame: centre the tee↔cup span, ball near the left margin (from the normalized Descent)
  function frameHole() {
    var h = hole(); if (!h) return null;
    var loY = Math.min(h.teeY, h.cupY), hiY = Math.max(h.teeY, h.cupY);
    return { x: h.teeX - W * 0.12, y: (loY + hiY) / 2 - H * 0.52 };
  }
  var HK = {
    onStart: function () { if (typeof camera !== 'undefined') { var f = frameHole(); if (f) { camera.x = f.x; camera.y = f.y; } } },
    holeCam: function () { return frameHole(); },
  };
  // build a normal-golf planet: distance/count fixed, terrain via archetype subset, body identity via mat+grav+sky
  function P(id, name, blurb, sky, mat, grav, arch, diff) {
    A.register({ id: id, name: name, blurb: blurb,
      course: { worldName: name, sky: sky, defaultMaterial: mat, materials: [mat, mat, 'rock'],
        archetypes: arch, difficultyRange: diff, holeDistMin: 360, holeDistMax: 600, holeCount: 3,
        phys: { gravityScale: grav, windScale: 0 } },
      hooks: HK });
  }
  function defMat(name, base, rest, roll, surf, col, colL) { return [[name, base, { restitution: rest, rollingFriction: roll, surfaceFriction: surf, color: col, colorLight: colL }]]; }
  // register a body's material once (on its v1) via a throwaway planet-less register is not possible, so
  // we attach mats to v1 through a small wrapper:
  function PM(id, name, blurb, sky, matDef, mat, grav, arch, diff) {
    A.register({ id: id, name: name, blurb: blurb, mats: matDef,
      course: { worldName: name, sky: sky, defaultMaterial: mat, materials: [mat, mat, 'rock'],
        archetypes: arch, difficultyRange: diff, holeDistMin: 360, holeDistMax: 600, holeCount: 3,
        phys: { gravityScale: grav, windScale: 0 } },
      hooks: HK });
  }

  // terrain-character presets (reused across bodies; each is a distinct level-design feel)
  var SMOOTH = ['flat_run', 'gentle_slope', 'rolling_hills', 'downhill', 'gentle_hill'];
  var RUGGED = ['cliff_drop', 'shelf', 'mesa', 'valley', 'stepped_descent'];
  var BROKEN = ['canyon', 'cliff_shelf', 'narrow_gap', 'deep_pocket', 'twin_peaks'];
  var DRAMATIC = ['dramatic_ridge', 'shelf_drop_shelf', 'cliff_valley_climb', 'twin_peaks', 'mesa'];
  var CRATERED = ['deep_pocket', 'canyon_cup', 'valley', 'mesa', 'shelf'];
  var DS = [0.1, 0.4], DM = [0.3, 0.6], DH = [0.45, 0.82];

  // ═══ MERCURY — scorched, cratered rock; low gravity, hard light ═══
  PM('mercury-1', 'Mercury · Caloris', 'scorched basin — cratered, pocketed rock', '#050507',
    defMat('mercrock', 'rock', 0.42, 0.97, 0.012, '#5a4f48', '#7a6d63'), 'mercrock', 0.55, CRATERED, DM);
  P('mercury-2', 'Mercury · Scarps', 'long escarpments stepping down the dayside', '#050507', 'mercrock', 0.55, RUGGED, DM);
  P('mercury-3', 'Mercury · Plains', 'smooth scorched flats — gentle, open', '#050507', 'mercrock', 0.55, SMOOTH, DS);

  // ═══ VENUS — basalt volcanic plains; near-Earth gravity, thick murk ═══
  PM('venus-1', 'Venus · Shield', 'broad volcanic shields and rises', '#2e1c0e',
    defMat('basalt', 'rock', 0.40, 0.965, 0.014, '#4a3b38', '#6a5550'), 'basalt', 0.9, ['rolling_hills', 'mesa', 'peak_obstacle', 'gentle_hill', 'shelf'], DM);
  P('venus-2', 'Venus · Rifts', 'fractured basalt — canyons and gaps', '#2e1c0e', 'basalt', 0.9, BROKEN, DH);
  P('venus-3', 'Venus · Lava Plains', 'flat cooled flows, the odd shelf', '#2e1c0e', 'basalt', 0.9, ['flat_run', 'shelf', 'downhill', 'valley', 'gentle_slope'], DS);

  // ═══ IO — sulfur, volcanic yellow; low gravity ═══
  PM('io-1', 'Io · Calderas', 'sulfur basins and caldera pockets', '#0a0812',
    defMat('sulfur', 'sand', 0.46, 0.955, 0.010, '#b8a13a', '#d8c45a'), 'sulfur', 0.55, CRATERED, DM);
  P('io-2', 'Io · Flows', 'rolling sulfur flows', '#0a0812', 'sulfur', 0.55, SMOOTH, DS);
  P('io-3', 'Io · Fissures', 'volcanic ridges and plunges', '#0a0812', 'sulfur', 0.55, ['dramatic_ridge', 'deep_plunge', 'twin_peaks', 'cliff_drop', 'mesa'], DH);

  // ═══ EUROPA — cracked ice crust, slick; floaty ═══
  PM('europa-1', 'Europa · Ice Plains', 'smooth slick ice — long glides', '#060a16',
    defMat('europaice', 'ice', 0.55, 0.985, 0.003, '#acc4d4', '#d2e6f0'), 'europaice', 0.45, SMOOTH, DS);
  P('europa-2', 'Europa · Ridges', 'chaos terrain — buckled ice ridges', '#060a16', 'europaice', 0.45, DRAMATIC, DH);
  P('europa-3', 'Europa · Rifts', 'cracked crust — canyons over the ocean', '#060a16', 'europaice', 0.45, BROKEN, DM);

  // ═══ TITAN — methane-wet sand, sticky; floaty, dense air ═══
  PM('titan-1', 'Titan · Dunes', 'rolling methane-damp dunes', '#4a2f16',
    defMat('methane', 'sand', 0.30, 0.940, 0.020, '#8a6a3a', '#a8884a'), 'methane', 0.5, ['rolling_hills', 'gentle_slope', 'downhill', 'mesa', 'gentle_hill'], DS);
  P('titan-2', 'Titan · Lakeshore', 'basins and shorelines of the methane seas', '#4a2f16', 'methane', 0.5, ['valley', 'deep_pocket', 'water_valley', 'shelf', 'canyon'], DM);
  P('titan-3', 'Titan · Highlands', 'rugged icy-rock highlands', '#4a2f16', 'methane', 0.5, RUGGED, DM);

  // ═══ JUPITER — STYLIZED cloud-storm deck (no real surface); HIGH gravity. Tests the gas-giant call. ═══
  PM('jupiter-1', 'Jupiter · Bands', 'stylized cloud deck — rolling storm bands; heavy g', '#5a3f24',
    defMat('cloudtop', 'sand', 0.35, 0.960, 0.013, '#c9a878', '#e3c89a'), 'cloudtop', 1.7, ['rolling_hills', 'gentle_slope', 'downhill', 'mesa', 'gentle_hill'], DS);
  P('jupiter-2', 'Jupiter · The Spot', 'great-storm relief — big rises and basins', '#5a3f24', 'cloudtop', 1.7, ['peak_obstacle', 'twin_peaks', 'mesa', 'dramatic_ridge', 'valley'], DH);
  P('jupiter-3', 'Jupiter · Calm Deck', 'flat upper deck — heavy, low arcs', '#5a3f24', 'cloudtop', 1.7, ['flat_run', 'gentle_slope', 'shelf', 'downhill', 'gentle_hill'], DS);
})();
