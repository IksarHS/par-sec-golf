// ── galaxy.js — THE ATLAS: a registry of experimental "planets" to feel the variance of our galaxy ──
// A peel-off framework for standalone EXPERIMENT courses, isolated from the base Earth->Moon loop. Each
// planet is a single clear idea — a new MECHANIC or a DISCOVERY/NARRATIVE vehicle — expressed through
// the engine's planets-as-data levers (gravity sign/magnitude, wind, per-material physics, hole
// distance, terrain archetypes, sky skin) and, for the wilder ones, optional per-planet CODE HOOKS that
// ride the wrap.js dispatch points (camera / isOOB / onRest / frame) — so a planet can own its camera
// (only-up pan, long-drive chase-cam), redefine out-of-bounds, claim a rest (ball-eating creature), or
// run mid-flight forces + world-space draw (gravity wells, moving hazards). NO engine-core edits; never
// touches the terrain PRNG; gated behind ?galaxy / ?atlas / ?course= so the default build is untouched.
//
//   ?galaxy            boot the atlas (first planet); [ ] cycle, digits jump, R re-roll, T travel-cycle
//   ?galaxy=3          boot into planet 3
//   ?course=only-up    deep-link a specific planet by id
//
// System planets register from their own files (atlas-*.js) via RG_ATLAS.register(def) — peel a file
// off and that planet is gone. Data planets live inline below. Hooks fire ONLY while their planet's
// course is the live one, so they are self-isolating.
(function () {
  if (typeof location === 'undefined' || !/[?&](galaxy|atlas|course=|watersim)/i.test(location.search)) return;

  // ── material helper: a physics identity layered on a base material (Moon-regolith pattern) ──
  function defMat(name, base, over) {
    if (typeof MATERIALS !== 'undefined' && MATERIALS[base] && !MATERIALS[name]) {
      MATERIALS[name] = Object.assign({}, MATERIALS[base], over);
    }
  }
  // shared surfaces used by the data planets below
  defMat('rubber',    'sand', { restitution: 0.92, rollingFriction: 0.97,  surfaceFriction: 0.004,  color: '#c0436a', colorLight: '#e0688c' }); // hyper-bounce
  defMat('slick',     'ice',  { restitution: 0.40, rollingFriction: 0.999, surfaceFriction: 0.0006, color: '#7fb8d8', colorLight: '#a8d6ee' }); // frictionless glide
  defMat('tar',       'mud',  { restitution: 0.06, rollingFriction: 0.80,  surfaceFriction: 0.020,  color: '#2e2a33', colorLight: '#46414e' });  // dead — no roll/bounce
  defMat('ironcrust', 'sand', { restitution: 0.30, rollingFriction: 0.94,  surfaceFriction: 0.006,  color: '#6b5a55', colorLight: '#857069' });  // dark heavy metal
  defMat('dust',      'sand', { restitution: 0.35, rollingFriction: 0.96,  surfaceFriction: 0.006,  color: '#b9b2a0', colorLight: '#d2ccbc' });  // pale asteroid dust
  defMat('turf',      'grass',{ restitution: 0.30, rollingFriction: 0.96,  surfaceFriction: 0.006,  color: '#4e8f5a', colorLight: '#63a86f' });  // fairway
  defMat('scree',     'sand', { restitution: 0.40, rollingFriction: 0.97,  surfaceFriction: 0.004,  color: '#8a7d6e', colorLight: '#a89a88' });  // loose downhill gravel

  // ── the registry ──
  var PLANETS = [];        // ordered list (selector order)
  var byId = {};           // courseId -> planet def

  // register(def): def = { id, name, blurb, course:{...config...}, mats?:[[name,base,over]...], hooks?:{} }
  // Adds the planet's MATERIALS + course config (into WORLDS) and appends it to the atlas. Call from
  // this file (data planets) or from an atlas-*.js system file (mechanic planets).
  function register(def) {
    if (!def || !def.id || byId[def.id]) return;
    if (def.mats) for (var i = 0; i < def.mats.length; i++) defMat(def.mats[i][0], def.mats[i][1], def.mats[i][2]);
    var c = Object.assign({ name: def.name, worldName: def.name, holeCount: 3 }, def.course || {});
    if (typeof WORLDS !== 'undefined' && WORLDS['run-world']) WORLDS['run-world'].courses[def.id] = c;
    def.course = c;
    byId[def.id] = def;
    PLANETS.push(def);
    return def;
  }

  // ── DATA PLANETS (config only — guaranteed playable, fast to add) ──
  register({ id: 'g-ferro', name: 'Ferro', blurb: 'crushing gravity — the ball plummets, fight the drop',
    course: { worldName: 'Ferro · 1.9 g', sky: '#160d0a', defaultMaterial: 'ironcrust', materials: ['ironcrust', 'ironcrust', 'rock'],
      archetypes: ['valley', 'peak_obstacle', 'wall_shot', 'mesa', 'cliff_drop', 'shelf', 'canyon'],
      difficultyRange: [0.3, 0.6], holeDistMin: 300, holeDistMax: 520, phys: { gravityScale: 1.9, windScale: 1 } } });

  register({ id: 'g-caucho', name: 'Caucho', blurb: 'rubber world — everything ricochets, bank your shots',
    course: { worldName: 'Caucho · rubber world', sky: '#1a0f2a', defaultMaterial: 'rubber', materials: ['rubber'],
      archetypes: ['wall_shot', 'peak_obstacle', 'canyon', 'twin_peaks', 'valley', 'shelf'],
      difficultyRange: [0.35, 0.6], holeDistMin: 380, holeDistMax: 640, phys: { gravityScale: 0.6, windScale: 1 } } });

  register({ id: 'g-glacio', name: 'Glacio', blurb: 'frictionless ice — the ball never stops rolling',
    course: { worldName: 'Glacio · frictionless ice', sky: '#0a1822', defaultMaterial: 'slick', materials: ['slick'],
      archetypes: ['flat_run', 'gentle_slope', 'rolling_hills', 'downhill', 'valley', 'shelf'],
      difficultyRange: [0.15, 0.45], holeDistMin: 420, holeDistMax: 700, phys: { gravityScale: 0.9, windScale: 0 } } });

  register({ id: 'g-limus', name: 'Limus', blurb: 'tar — no roll, no bounce, all carry and precision',
    course: { worldName: 'Limus · tar flats · no roll', sky: '#0e1410', defaultMaterial: 'tar', materials: ['tar'],
      archetypes: ['gentle_hill', 'valley', 'mesa', 'peak_obstacle', 'shelf', 'uphill'],
      difficultyRange: [0.25, 0.55], holeDistMin: 360, holeDistMax: 600, phys: { gravityScale: 1.0, windScale: 1 } } });

  // (The old one-screen 'g-range' long-drive was replaced by the cinematic chase-cam DRIVE course in
  // atlas-drive.js — a bespoke camera + anime power-shot. See ?course=drive-epic.)

  register({ id: 'g-patch', name: 'Tessera', blurb: 'patchwork fairway — slick ice patches scattered in the turf',
    course: { worldName: 'Tessera · mixed surface', sky: '#0c2620', defaultMaterial: 'turf', materials: ['turf', 'slick', 'turf', 'slick'],
      archetypes: ['gentle_slope', 'rolling_hills', 'valley', 'shelf', 'downhill', 'gentle_hill'],
      difficultyRange: [0.2, 0.5], holeDistMin: 400, holeDistMax: 680, phys: { gravityScale: 0.95, windScale: 1 } } });

  register({ id: 'g-crags', name: 'Crags', blurb: 'brutal angular terrain — thread the canyons and fortresses',
    course: { worldName: 'Crags · hard country', sky: '#14121c', defaultMaterial: 'rock', materials: ['rock', 'rock', 'ice'],
      archetypes: ['canyon', 'fortress', 'narrow_gap', 'cliff_shelf', 'twin_peaks', 'wall_shot', 'peak_obstacle'],
      difficultyRange: [0.5, 0.82], holeDistMin: 360, holeDistMax: 620, phys: { gravityScale: 1.0, windScale: 1 } } });

  register({ id: 'g-cascade', name: 'Cascade', blurb: 'a world that only falls — every hole pours downhill',
    course: { worldName: 'Cascade · the long fall', sky: '#161024', defaultMaterial: 'scree', materials: ['scree', 'scree', 'rock'],
      archetypes: ['downhill', 'cliff_drop', 'stepped_descent', 'deep_plunge', 'shelf_drop_shelf'],
      difficultyRange: [0.3, 0.6], holeDistMin: 380, holeDistMax: 660, phys: { gravityScale: 0.8, windScale: 1 } } });

  // ── the live planet + hook dispatch ──
  // current() = the planet whose course is on screen RIGHT NOW (so hooks self-isolate to their planet).
  function current() { return (window.RG && byId[RG.course]) || null; }

  window.RG_ATLAS = {
    register: register,
    // wrap.js dispatch surface — each defers to the live planet's hook if it defines one
    camera: function () { var p = current(); return !!(p && p.hooks && p.hooks.camera && p.hooks.camera(p)); },
    holeCam: function () { var p = current(); return (p && p.hooks && p.hooks.holeCam) ? p.hooks.holeCam(p) : null; },   // desired RESTING camera {x,y} for the entering hole — wrap pre-frames the hole-to-hole pan to it (no aim-time snap)
    isOOB:  function () { var p = current(); return (p && p.hooks && p.hooks.isOOB) ? p.hooks.isOOB(p) : null; },
    onRest: function () { var p = current(); return !!(p && p.hooks && p.hooks.onRest && p.hooks.onRest(p)); },
    frame:  function (ctx) { var p = current(); if (p && p.hooks && p.hooks.frame) p.hooks.frame(ctx, p); },
    frameScreen: function (ctx) { var p = current(); if (p && p.hooks && p.hooks.frameScreen) p.hooks.frameScreen(ctx, p); },   // SCREEN-space HUD (after the world transform) — e.g. the long-drive distance bar
    drawSkyBehind: function (ctx) { var p = current(); if (p && p.hooks && p.hooks.drawSkyBehind) p.hooks.drawSkyBehind(ctx, p); },   // SCREEN-space sky drawn BEHIND the terrain — e.g. golf-orbit's deep-space starfield + limb glow
    force:  function () { var p = current(); if (p && p.hooks && p.hooks.force) p.hooks.force(p); },   // every physics substep (sim-consistent)
    collide: function () { var p = current(); return !!(p && p.hooks && p.hooks.collide && p.hooks.collide(p)); },   // SOLID-PLATFORM collision (circle vs AABB) — returns true if the ball rests on a platform top; runs alongside the base heightfield collide
    isGoalReached: function () { var p = current(); return (p && p.hooks && p.hooks.isGoalReached) ? p.hooks.isGoalReached(p) : undefined; },   // custom goal (finish ON a goal block); undefined = no planet goal → engine uses the base sunken-cup
    cur:    current,   // system files can read the live planet
    // selector
    list: function () { return PLANETS.map(function (p) { return p.id; }); },
    count: function () { return PLANETS.length; },
    go: function (n) { if (n != null) idx = Math.max(0, Math.min(PLANETS.length - 1, n)); go(); return PLANETS[idx] && PLANETS[idx].id; },
    step: function (d) { step(d); },
    planet: function () { return PLANETS[idx]; },
  };

  function R() { return window.RG; }
  function ready() {
    return !!(window.RG && RG.active && typeof holes !== 'undefined' && holes.length
      && typeof ball !== 'undefined' && typeof terrainYAt === 'function' && RG.startRun);
  }

  var idx = 0, started = false;
  function go(reseed) {
    var p = PLANETS[idx]; if (!p) return;
    if (R()) { R()._clampYBand = null; R()._holeDistCap = null; R()._zoom = 1; R()._zoomPivot = null; }   // reset cross-planet overrides (world bounds, long-hole cap, cinematic zoom)
    if (p.hooks && p.hooks.beforeStart) { try { p.hooks.beforeStart(p); } catch (e) {} }   // set generation-time state (e.g. only-up's tall clampY band) BEFORE terrain is built
    try { R().startRun({ course: p.id, seed: R().rollSeed() }); }
    catch (e) { label('start error: ' + (e && e.message)); return; }
    if (p.hooks && p.hooks.onStart) { try { p.hooks.onStart(p); } catch (e) {} }
    label('🪐 ' + (idx + 1) + '/' + PLANETS.length + ' · ' + (p.course.worldName || p.name) + ' — ' + (p.blurb || ''));
  }
  function step(d) { idx = (idx + d + PLANETS.length) % PLANETS.length; go(); }
  // Travel to the next planet via the REAL course-to-course transition (exercises + lets us iterate it).
  function travelStep(d) {
    if (R()) { R()._clampYBand = null; R()._holeDistCap = null; R()._zoom = 1; R()._zoomPivot = null; }   // leaving a custom planet resets its overrides
    idx = (idx + d + PLANETS.length) % PLANETS.length;
    var p = PLANETS[idx];
    if (R() && R()._beginTravel) { try { R()._beginTravel(p.id, 'descend'); } catch (e) { go(); } }
    else go();
    label('▸ travelling to ' + (idx + 1) + '/' + PLANETS.length + ' · ' + (p.course.worldName || p.name));
  }

  function label(text) {
    var el = document.getElementById('rg-atlas-label');
    if (!el) {
      el = document.createElement('div'); el.id = 'rg-atlas-label';
      el.style.cssText = 'position:fixed;left:50%;bottom:14px;transform:translateX(-50%);z-index:9992;'
        + 'font:12px/1.4 "Departure Mono",monospace;color:#cdd6f5;background:rgba(12,10,18,0.82);'
        + 'border:1px solid rgba(150,170,230,0.40);border-radius:9px;padding:7px 14px;pointer-events:none;'
        + 'text-align:center;box-shadow:0 3px 16px rgba(0,0,0,0.5);max-width:92vw;white-space:nowrap;';
      document.body.appendChild(el);
    }
    el.innerHTML = text + '<br><span style="opacity:0.6">[ &nbsp;] cycle · digits jump · R re-roll · T travel to next</span>';
  }

  window.addEventListener('keydown', function (e) {
    var tag = e.target && e.target.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;
    if (e.key === ']') step(1);
    else if (e.key === '[') step(-1);
    else if (e.key === 'r' || e.key === 'R') go(true);
    else if (e.key === 't' || e.key === 'T') travelStep(1);
    else if (e.key >= '1' && e.key <= '9') { var n = (+e.key) - 1; if (n < PLANETS.length) { idx = n; go(); } }
  });

  // back-compat alias for earlier tests
  window.RG_GALAXY = { list: RG_ATLAS.list, go: RG_ATLAS.go, step: RG_ATLAS.step, courses: byId };

  // ?galaxy=N (1-based) or ?course=<id> pick the start planet (resolved at boot, after system files register).
  var aborted = false;
  function resolveStart() {
    // ?watersim is its OWN flag (atlas-watersim.js autostarts the 'watersim' course); don't auto-boot a
    // galaxy planet under it — RG_ATLAS is still defined (so its hooks work), we just don't pick a start.
    if (/[?&]watersim\b/i.test(location.search) && !/[?&](galaxy|atlas|course=)/i.test(location.search)) { aborted = true; return; }
    var qN = /[?&]galaxy=(\d+)/i.exec(location.search);
    if (qN) idx = Math.max(0, Math.min(PLANETS.length - 1, (parseInt(qN[1], 10) || 1) - 1));
    var qC = /[?&]course=([a-z0-9-]+)/i.exec(location.search);
    if (qC) {
      var found = false;
      for (var i = 0; i < PLANETS.length; i++) if (PLANETS[i].id === qC[1].toLowerCase()) { idx = i; found = true; }
      // ?course=<id> that is NOT a galaxy planet (e.g. a base course like earth2/moon) → don't hijack:
      // abort so the base game + the devbuild.html dev shortcut start that course, with no Ferro fallback.
      if (!found && !qN && !/[?&](galaxy|atlas)\b/i.test(location.search)) aborted = true;
    }
  }

  // Boot once the game is ready. setTimeout (not rAF — rAF throttles in a backgrounded tab). A short
  // defer also lets the atlas-*.js system files finish registering before we resolve the start planet.
  (function wait() {
    if (started) return;
    if (ready()) { started = true; setTimeout(function () { resolveStart(); if (!aborted) go(); }, 60); return; }
    setTimeout(wait, 50);
  })();
})();
