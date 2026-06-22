// ── showcase.js — GENERATOR SHOWCASE (dev curation tool) ──────────────────────────────────────────
// A CLEAN browser for the TYPES of holes the terrain generator can build. Three controls only —
// terrain COMPLEXITY (0.00–1.00), terrain TYPE (material/palette), hole TYPE (archetype) — plus a
// NEW SEED button. On any change it regenerates ONE hole with the REAL engine (generateHoleTerrain
// + drawTerrainDG + setHoleCamera) and frames it on screen. No secrets, no physics sliders, no
// shop/ship/economy. Entirely GATED on ?showcase — inert otherwise (the base game is byte-identical).
//
// HOW IT MAPS TO THE GENERATOR (reuse, do not reimplement):
//   COMPLEXITY  → the course's difficultyRange:[c,c] → getDifficulty() returns c for the hole
//                 (src/level-design.js:156). Drives archetype drama (slope/overhang/cup-depth),
//                 hole distance (difficulty*100, :2161) and cup elevation spread (:2178). We also
//                 set planetComplexity:c so overhang set-pieces gate in on the dramatic end.
//   TERRAIN TYPE→ the course's defaultMaterial/materials — a key in MATERIALS (src/shared.js:66 +
//                 the CUSTOM palettes in src/planet-gen.js:22). drawTerrainDG renders it.
//   HOLE TYPE   → window.setArchetypeOverride(name) locks ONE archetype from window.ARCHETYPE_NAMES
//                 (src/level-design.js:2098). "ALL / random" clears the lock → the generator picks
//                 from the course archetype pool per its normal weighted logic.

(function () {
  if (typeof location === 'undefined' || !/[?&]showcase\b/.test(location.search)) return;   // GATE

  var SC = {
    c: 0.35,                 // complexity 0..1
    matIdx: 0,               // terrain-type index
    archIdx: 0,              // hole-type index (0 = ALL / random)
    seed: 12345,
    ready: false,
  };

  // ── Curated TERRAIN TYPES (label → MATERIALS key + a sky tint) ─────────────────────────────────
  // Base engine materials first (sand/grass/rock/ice/mud), then a few planet palettes so the user
  // can see the generator in distinct looks. All keys exist in MATERIALS by the time we run (shared.js
  // base + planet-gen.js CUSTOM). Sky is just a backdrop tint per look — not load-bearing.
  var TERRAINS = [
    ['Sand',        'sand',    '#2a2330'],
    ['Grass',       'grass',   '#232c40'],
    ['Rock',        'rock',    '#241a18'],
    ['Ice',         'ice',     '#16222e'],
    ['Mud',         'mud',     '#211a16'],
    ['Jade',        'jade',    '#1e2a22'],
    ['Crimson',     'crimson', '#2a1518'],
    ['Slate',       'slate',   '#10161f'],
    ['Amber',       'amber',   '#2d2618'],
    ['Frost',       'frost',   '#16242e'],
    ['Ember',       'ember',   '#241208'],
    ['Plum',        'plum',    '#1a1220'],
    ['Bone',        'bone',    '#1c1a16'],
    ['Sulfur',      'sulfur',  '#241808'],
    ['Cobalt',      'cobalt',  '#0f2547'],
  ];

  // ── HOLE TYPES (archetype names). Index 0 is the "ALL / random" sentinel; the rest come from the
  // engine's ARCHETYPE_NAMES (every polygon hole-type). We filter to the ones that build a normal dry
  // hole well in the showcase (the water-only archetypes need a flooded course to read, so they are
  // still listed — they just render as their raw terrain shape here, which is the point: see the shape).
  var ARCH = ['ALL / random'];

  function gatherArchetypes() {
    var names = (window.ARCHETYPE_NAMES || []).slice();
    // Put the clean, legible shapes first so the dropdown opens on good examples.
    var FEATURED = ['faceted', 'flat_run', 'gentle_slope', 'gentle_hill', 'rolling_hills', 'downhill',
      'uphill', 'valley', 'shelf', 'cliff_drop', 'mesa', 'peak_obstacle', 'stepped_descent', 'canyon',
      'twin_peaks', 'deep_pocket', 'canyon_cup', 'fortress', 'narrow_gap', 'dramatic_ridge',
      'deep_plunge', 'crater', 'punchbowl', 'ziggurat', 'compound_terrain'];
    var seen = {}, out = [];
    FEATURED.forEach(function (n) { if (names.indexOf(n) >= 0 && !seen[n]) { seen[n] = 1; out.push(n); } });
    names.forEach(function (n) { if (!seen[n]) { seen[n] = 1; out.push(n); } });
    ARCH = ['ALL / random'].concat(out);
  }

  // ── Register / update the dynamic showcase course ───────────────────────────────────────────────
  // _dynamic makes RG._buildCourse re-read the live config every startRun (so live edits take effect).
  // We build it from the SAME knobs the planets use, but with difficultyRange:[c,c] so COMPLEXITY is a
  // direct dial (getDifficulty returns exactly c, independent of hole index — we only show 1 hole).
  function buildCourse() {
    var t = TERRAINS[SC.matIdx];
    var mat = t[1], sky = t[2];
    var pool;                                    // the archetype pool for ALL/random mode
    if (window.PLANET_GEN && window.PLANET_GEN.archetypesFor) {
      pool = window.PLANET_GEN.archetypesFor(SC.c);   // complexity-appropriate tiered pool (planet-gen.js)
    } else {
      pool = ['faceted', 'rolling_hills', 'valley', 'mesa', 'canyon', 'twin_peaks'];
    }
    var c = SC.c;
    var dMin = Math.round(420 + c * 120), dMax = Math.round(640 + c * 200);
    var course = {
      name: 'Showcase', worldName: 'Generator Showcase', sky: sky,
      defaultMaterial: mat, materials: [mat],
      gen: 'faceted',
      archetypes: pool,
      difficultyRange: [c, c],                   // COMPLEXITY as a flat dial
      holeDistMin: dMin, holeDistMax: dMax, holeCount: 1,
      planetComplexity: c,                       // gate overhang set-pieces on the dramatic end
      overhangs: c > 0.55,
      phys: { gravityScale: 1, windScale: 1 },
      validate: true,                            // re-roll an unsinkable hole (keeps shapes honest)
      _dynamic: true,                            // opt out of the course-template cache (live tuning)
    };
    WORLDS['run-world'].courses['showcase'] = course;
    return course;
  }

  // ── Regenerate + frame the hole with the current params ─────────────────────────────────────────
  function regen() {
    if (!(window.RG && RG.startRun) || typeof WORLDS === 'undefined' || !WORLDS['run-world']) return;
    // HOLE TYPE: lock one archetype, or clear the lock for ALL/random.
    if (window.setArchetypeOverride) {
      window.setArchetypeOverride(SC.archIdx === 0 ? null : ARCH[SC.archIdx]);
    }
    buildCourse();
    try {
      RG.startRun({ course: 'showcase', seed: SC.seed });
    } catch (e) { /* keep the panel alive even if a single roll throws */ }

    // Frame hole 0, park the ball off-screen (this is a VIEWER — no play), kill the HUD clutter.
    try {
      if (typeof currentHole !== 'undefined') currentHole = 0;
      var h = (typeof holes !== 'undefined') && holes[0];
      if (h && typeof setHoleCamera === 'function') setHoleCamera(h);
      if (typeof ball !== 'undefined') { ball.x = -99999; ball.y = -99999; ball.vx = 0; ball.vy = 0; ball.atRest = true; }
      if (typeof state !== 'undefined' && typeof STATE_AIM !== 'undefined') state = STATE_AIM;
      if (typeof showTitle !== 'undefined') showTitle = false;
      // Suppress ALL in-run HUD chrome — this is a pure viewer. The canvas score readout
      // (RG._drawScoreHUD, the "HOLE 1 / 1" + par + strokes) and the DOM hud are both neutered.
      if (window.RG) {
        if (!RG._scNoHUD) { RG._scNoHUD = true; RG._drawScoreHUD = function () {}; }
        RG._syncHUD = function () { var h = document.getElementById('rg-hud'); if (h) h.style.display = 'none'; };
      }
      var hud = document.getElementById('rg-hud'); if (hud) { hud.innerHTML = ''; hud.style.display = 'none'; }
    } catch (e) {}
    syncReadout();
  }

  // ── Panel UI ────────────────────────────────────────────────────────────────────────────────────
  var els = {};
  function syncReadout() {
    if (els.cval) els.cval.textContent = SC.c.toFixed(2);
    var archName = SC.archIdx === 0 ? '(generator pool)' : ARCH[SC.archIdx];
    if (els.read) {
      els.read.innerHTML =
        '<span style="color:#9fd8e8">complexity</span> ' + SC.c.toFixed(2) +
        ' &nbsp;·&nbsp; <span style="color:#9fd8e8">terrain</span> ' + TERRAINS[SC.matIdx][0] +
        ' &nbsp;·&nbsp; <span style="color:#9fd8e8">hole</span> ' + archName +
        ' &nbsp;·&nbsp; <span style="color:#9fd8e8">seed</span> ' + SC.seed;
    }
  }

  function lbl(text) {
    var d = document.createElement('div');
    d.textContent = text;
    d.style.cssText = 'margin:10px 0 3px;color:#9fb0c8;letter-spacing:1px;font-size:11px;text-transform:uppercase;';
    return d;
  }

  function build() {
    if (document.getElementById('sc-panel')) return;
    gatherArchetypes();

    var p = document.createElement('div');
    p.id = 'sc-panel';
    p.style.cssText = 'position:fixed;top:16px;left:16px;z-index:9990;width:262px;'
      + 'font:13px/1.4 "Departure Mono",monospace;color:#f2ecff;'
      + 'background:rgba(12,12,20,0.92);border:1px solid rgba(120,170,210,0.35);border-radius:12px;'
      + 'padding:14px 16px;box-shadow:0 8px 30px rgba(0,0,0,0.55);user-select:none;';

    var title = document.createElement('div');
    title.innerHTML = '🏔 &nbsp;GENERATOR&nbsp;SHOWCASE';
    title.style.cssText = 'font-size:14px;letter-spacing:2px;color:#cfe;margin-bottom:2px;';
    p.appendChild(title);
    var sub = document.createElement('div');
    sub.textContent = 'browse the holes the generator can build';
    sub.style.cssText = 'font-size:10px;color:rgba(242,236,255,0.4);margin-bottom:6px;';
    p.appendChild(sub);

    // COMPLEXITY slider
    var cl = lbl('Complexity');
    var cval = document.createElement('span');
    cval.style.cssText = 'float:right;color:#9fd8e8;';
    cval.textContent = SC.c.toFixed(2);
    cl.appendChild(cval); els.cval = cval;
    p.appendChild(cl);
    var slider = document.createElement('input');
    slider.type = 'range'; slider.min = '0'; slider.max = '1'; slider.step = '0.01';
    slider.value = String(SC.c);
    slider.style.cssText = 'width:100%;accent-color:#79c6cf;cursor:pointer;';
    slider.oninput = function () { SC.c = parseFloat(slider.value); els.cval.textContent = SC.c.toFixed(2); };
    slider.onchange = function () { SC.c = parseFloat(slider.value); regen(); };
    p.appendChild(slider);
    var hint = document.createElement('div');
    hint.textContent = 'flat & simple → dramatic & complex';
    hint.style.cssText = 'font-size:10px;color:rgba(242,236,255,0.35);margin-top:2px;';
    p.appendChild(hint);

    // TERRAIN TYPE select
    p.appendChild(lbl('Terrain type'));
    var matSel = document.createElement('select');
    matSel.style.cssText = selCss();
    TERRAINS.forEach(function (t, i) { var o = document.createElement('option'); o.value = i; o.textContent = t[0]; matSel.appendChild(o); });
    matSel.value = String(SC.matIdx);
    matSel.onchange = function () { SC.matIdx = parseInt(matSel.value, 10) || 0; regen(); };
    p.appendChild(matSel);

    // HOLE TYPE select
    p.appendChild(lbl('Hole type'));
    var archSel = document.createElement('select');
    archSel.style.cssText = selCss();
    ARCH.forEach(function (n, i) { var o = document.createElement('option'); o.value = i; o.textContent = n; archSel.appendChild(o); });
    archSel.value = String(SC.archIdx);
    archSel.onchange = function () { SC.archIdx = parseInt(archSel.value, 10) || 0; regen(); };
    p.appendChild(archSel);
    els.archSel = archSel;

    // NEW SEED button
    var btn = document.createElement('button');
    btn.textContent = '⟳  New seed';
    btn.style.cssText = 'display:block;width:100%;margin-top:14px;padding:9px;cursor:pointer;'
      + 'font:inherit;font-size:13px;color:#0e0b12;background:#79c6cf;border:none;border-radius:8px;letter-spacing:1px;';
    btn.onmouseenter = function () { btn.style.background = '#9fd8e8'; };
    btn.onmouseleave = function () { btn.style.background = '#79c6cf'; };
    btn.onclick = function () { SC.seed = (Math.floor(Math.random() * 0x7fffffff)) | 0; regen(); };
    p.appendChild(btn);

    // live readout
    var read = document.createElement('div');
    read.style.cssText = 'margin-top:12px;padding-top:10px;border-top:1px solid rgba(120,170,210,0.18);'
      + 'font-size:10px;color:rgba(242,236,255,0.6);line-height:1.6;';
    p.appendChild(read); els.read = read;

    document.body.appendChild(p);

    // Block aiming/shots — this is a viewer, not a playable hole. Capture pointer events on the
    // canvas BEFORE the gameplay handlers see them (they only fire a shot in STATE_AIM).
    var cv = document.getElementById('c');
    if (cv) {
      ['mousedown', 'mousemove', 'mouseup', 'touchstart', 'touchmove', 'touchend'].forEach(function (ev) {
        cv.addEventListener(ev, function (e) { e.stopPropagation(); }, true);
      });
    }
    SC.ready = true;
  }

  function selCss() {
    return 'width:100%;padding:7px 8px;font:inherit;font-size:12px;color:#f2ecff;'
      + 'background:rgba(30,36,48,0.9);border:1px solid rgba(120,170,210,0.35);border-radius:7px;cursor:pointer;';
  }

  // ── Boot: wait for the engine (RG + ARCHETYPE_NAMES + courses) then build + first regen ──────────
  var tries = 0;
  function boot() {
    if (window.RG && RG.startRun && window.ARCHETYPE_NAMES && typeof WORLDS !== 'undefined'
        && WORLDS['run-world'] && WORLDS['run-world'].courses && window.setArchetypeOverride) {
      build();
      // First render. A short defer lets the engine's own boot settle so our startRun is the last word.
      setTimeout(regen, 120);
      return;
    }
    if (tries++ < 300) setTimeout(boot, 50);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
