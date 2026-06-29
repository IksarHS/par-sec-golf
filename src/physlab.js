// ── PHYSICS LAB ─────────────────────────────────────────────────────────────
// A tuning tool for Par Sec's author (August) to dial how shots FEEL.
//
// It drives the REAL engine ball: it loads the same physics/render files run.html
// loads (shared.js / level-design.js / modes/desert-golfing.js / art.js / gameplay.js)
// and mutates the REAL feel knobs live (the GRAVITY/RESTITUTION/... globals in
// shared.js and the per-material MATERIALS table) — it does NOT fork the physics.
//
// Knobs wired (the real feel knobs found in src/shared.js + src/gameplay.js):
//   POWER_SCALE        launch power curve (drag px -> launch speed)
//   MAX_POWER          launch speed cap
//   GRAVITY            downward accel / frame
//   RESTITUTION        legacy global bounce (kept visible; collisions use per-material)
//   ROLLING_FRICTION   global proportional air/roll drag (legacy global)
//   SURFACE_FRICTION   global constant low-speed stop drag (legacy global)
//   BOUNCE_THRESHOLD   below this normal speed a ground hit sticks (no bounce)
//   BALL_RADIUS        ball size (also the spin<->roll coupling denominator: spin = vx / BALL_RADIUS)
//   per-material restitution / rollingFriction / surfaceFriction  (sand/grass/ice/rock/mud — the
//                      values collisions + friction ACTUALLY read; the live material is whatever's
//                      under the ball, shown in the readout).
//
// All values are copy-pasteable from the readout so the dialed feel can go straight
// back into src/shared.js / src/shared.js MATERIALS.

(function () {
  'use strict';

  // ── Boot guard ────────────────────────────────────────────────────────────
  // We do NOT load main.js, so the engine's init()/Firebase boot never runs. The
  // lab owns the whole lifecycle.
  window.HOLE_OVERRIDES_ENABLED = false;

  // RG_FX (landing-debris particles, src/roguelike/fx.js) gates its contact-detection on the roguelike
  // layer (window.RG) existing. The lab has no roguelike, so stub a minimal RG → impacts spawn debris.
  // Purely visual + reads ball state; does NOT touch the physics globals/materials being tuned.
  window.RG = window.RG || { active: true, _simulating: false };

  // ── Default knob values (the ship values, so "Reset knobs" restores feel) ───
  const DEFAULTS = {
    POWER_SCALE: POWER_SCALE,
    MAX_POWER: MAX_POWER,
    GRAVITY: GRAVITY,
    RESTITUTION: RESTITUTION,
    ROLLING_FRICTION: ROLLING_FRICTION,
    SURFACE_FRICTION: SURFACE_FRICTION,
    BOUNCE_THRESHOLD: BOUNCE_THRESHOLD,
    BALL_RADIUS: BALL_RADIUS,
  };
  // Deep snapshot of the ship MATERIALS so per-material sliders can reset too.
  const MAT_DEFAULTS = {};
  for (const k in MATERIALS) MAT_DEFAULTS[k] = Object.assign({}, MATERIALS[k]);

  // ── Test world / course (a minimal real WORLDS entry so MODE + render work) ──
  // Deep-space sky from the spec; Mars-rust ground palette via the real MATERIALS.
  const LAB_SKY = '#11151f';
  currentWorld = { name: 'PHYSICS LAB', sky: LAB_SKY, system: 'lab', courses: {} };
  currentCourse = { name: 'Test', holeCount: 1, materials: ['sand', 'grass', 'ice', 'rock'] };
  currentWorld.courses.lab = currentCourse;
  WORLDS['lab-world'] = currentWorld;

  // The textured terrain renderer in art.js is heavy + tuned for the sand world; the
  // lab wants legible FLAT facets per the spec, so render terrain flat (one tone +
  // material colour). This only flips the render flag the game already exposes (T key).
  if (typeof TERRAIN_TEXTURE_ON !== 'undefined') TERRAIN_TEXTURE_ON = false;

  // Deep-space sky: a dark vertical gradient + a fixed starfield (spec). We override
  // the mode's drawSky (a lab-owned tweak — we don't edit art.js/desert-golfing.js).
  const _stars = [];
  (function () {
    let s = 1234567;
    const rnd = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
    for (let i = 0; i < 70; i++) {
      _stars.push({ x: rnd(), y: rnd() * 0.7, r: rnd() < 0.18 ? 1.6 : 1,
        c: rnd() < 0.25 ? 'rgba(190,210,255,0.85)' : 'rgba(255,255,255,0.45)' });
    }
  })();
  MODE.drawSky = function () {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#08090f'); g.addColorStop(0.55, '#0f1622'); g.addColorStop(1, '#172534');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    for (const st of _stars) {
      ctx.fillStyle = st.c;
      ctx.beginPath(); ctx.arc(st.x * W, st.y * H, st.r, 0, 6.2832); ctx.fill();
    }
  };

  // ── Test terrains ───────────────────────────────────────────────────────────
  // Each builder returns { verts:[{x,y,mat?}], teeX, teeY, cupX }.
  // Coordinates are in game units (H=540). Camera is fixed per hole by the engine.
  // The hole is laid out to the LEFT of the side panel so the cup + flag are never
  // hidden behind it. PLAY_RIGHT is the rightmost world-x kept clear of the panel
  // (set in loadTerrain from the live W + panel width). Ground sits mid-screen so the
  // shot's arc reads against the deep-space sky above.
  const GROUND_Y = 360;
  const TEE_X = 120;

  function buildFlat() {
    const v = [];
    for (let x = 20; x <= 760; x += 30) v.push({ x, y: GROUND_Y, mat: 'sand' });
    return { verts: v, teeX: TEE_X, teeY: GROUND_Y, cupX: 600 };
  }

  function buildSlope() {
    // A clean downhill ramp into a short flat green at the cup (so a tuned roll reads).
    const v = [];
    v.push({ x: 20, y: 280, mat: 'sand' });
    v.push({ x: 110, y: 280, mat: 'sand' });
    for (let x = 150; x <= 520; x += 35) {
      const t = (x - 150) / (520 - 150);
      v.push({ x, y: 280 + t * 140, mat: 'sand' });
    }
    for (let x = 555; x <= 760; x += 30) v.push({ x, y: 420, mat: 'sand' });
    return { verts: v, teeX: 70, teeY: 280, cupX: 620 };
  }

  function buildMixed() {
    // Material bands so August can feel sand -> grass -> ice -> rock back to back:
    // a run that crosses materials, with a dip + plateau for bounce/roll contrast.
    const v = [];
    for (let x = 20; x <= 220; x += 30) v.push({ x, y: GROUND_Y, mat: 'sand' });
    // grass dip
    v.push({ x: 260, y: GROUND_Y + 36, mat: 'grass' });
    v.push({ x: 330, y: GROUND_Y + 36, mat: 'grass' });
    v.push({ x: 370, y: GROUND_Y, mat: 'grass' });
    // ice plateau
    for (let x = 405; x <= 540; x += 30) v.push({ x, y: GROUND_Y - 12, mat: 'ice' });
    // rock run-out (cup here)
    for (let x = 575; x <= 760; x += 30) v.push({ x, y: GROUND_Y - 12, mat: 'rock' });
    return { verts: v, teeX: TEE_X, teeY: GROUND_Y, cupX: 640 };
  }

  function buildSteep() {
    // A short, STEEP (~40°) drop — exaggerates momentum / terminal-velocity differences between presets.
    const v = [];
    v.push({ x: 20, y: 200, mat: 'sand' });
    v.push({ x: 120, y: 200, mat: 'sand' });
    for (let x = 160; x <= 420; x += 30) {
      const t = (x - 160) / (420 - 160);
      v.push({ x, y: 200 + t * 230, mat: 'sand' });
    }
    for (let x = 455; x <= 760; x += 30) v.push({ x, y: 430, mat: 'sand' });
    return { verts: v, teeX: 70, teeY: 200, cupX: 650 };
  }

  function buildValley() {
    // A parabolic bowl: roll in from the left rim, settle at the bottom. Best shape for FEELING stop-time
    // (the ball oscillates then comes to rest — long under ship friction, crisp under SNAPPY).
    const v = [];
    const cx = 390, halfW = 300, rimY = 290, botY = 450;
    for (let x = 20; x <= 760; x += 20) {
      let n = (x - cx) / halfW; if (n < -1) n = -1; if (n > 1) n = 1;
      v.push({ x, y: botY - (botY - rimY) * (n * n), mat: 'grass' });
    }
    return { verts: v, teeX: 55, teeY: rimY, cupX: 620 };
  }

  function buildBumps() {
    // Rolling undulation — tests bounce + roll over terrain that isn't a clean ramp.
    const v = [];
    for (let x = 20; x <= 760; x += 15) v.push({ x, y: 350 + Math.sin((x - 20) / 55) * 28, mat: 'grass' });
    return { verts: v, teeX: 60, teeY: 350, cupX: 645 };
  }

  const TERRAINS = [
    { id: 'flat',   label: 'FLAT',           build: buildFlat },
    { id: 'slope',  label: 'SLOPE',          build: buildSlope },
    { id: 'steep',  label: 'STEEP',          build: buildSteep },
    { id: 'valley', label: 'VALLEY (bowl)',  build: buildValley },
    { id: 'bumps',  label: 'BUMPS',          build: buildBumps },
    { id: 'mixed',  label: 'MIXED MATERIAL', build: buildMixed },
  ];
  let terrainIdx = 0;

  // ── Cup carving (mirrors level-design.js placeCup, but on OUR verts) ─────────
  function carveCup(cupX) {
    const halfW = CUP_WIDTH / 2;
    const leftX = cupX - halfW, rightX = cupX + halfW;
    const sampledLeftY = terrainYAt(leftX), sampledRightY = terrainYAt(rightX);
    const rimY = (sampledLeftY + sampledRightY) / 2;
    const flatMargin = 20, wallInset = 3;
    const bottomY = rimY + CUP_DEPTH;
    vertices = vertices.filter(v => v.x < leftX - flatMargin || v.x > rightX + flatMargin);
    const cupVerts = [
      { x: leftX - flatMargin, y: rimY, mat: matAt(leftX) },
      { x: leftX, y: rimY, mat: matAt(leftX) },
      { x: leftX + wallInset, y: bottomY, mat: matAt(leftX) },
      { x: rightX - wallInset, y: bottomY, mat: matAt(rightX) },
      { x: rightX, y: rimY, mat: matAt(rightX) },
      { x: rightX + flatMargin, y: rimY, mat: matAt(rightX) },
    ];
    let insertIdx = vertices.findIndex(v => v.x >= leftX - flatMargin);
    if (insertIdx === -1) insertIdx = vertices.length;
    vertices.splice(insertIdx, 0, ...cupVerts);
    holes.length = 0;
    holes.push({
      cupX, cupY: rimY,
      cupLeftX: leftX, cupLeftY: rimY,
      cupRightX: rightX, cupRightY: rimY,
      cupBottomY: bottomY, cupWallInset: wallInset,
      cupFilled: false, cupFillProgress: 0,
      flagHole: 1, flagVisible: true, flagOpacity: 1,
      teeX: TEE_X, teeY: GROUND_Y,
    });
  }
  let _matAtVerts = [];
  function matAt(x) {
    // material the original (pre-carve) terrain had at x
    let m = 'sand';
    for (const v of _matAtVerts) { if (v.x <= x) m = v.mat || 'sand'; else break; }
    return m;
  }

  // ── Load a terrain ──────────────────────────────────────────────────────────
  function loadTerrain(idx) {
    terrainIdx = ((idx % TERRAINS.length) + TERRAINS.length) % TERRAINS.length;
    const def = TERRAINS[terrainIdx].build();
    vertices = def.verts.map(v => ({ x: v.x, y: v.y, mat: v.mat || 'sand' }));
    // GROUND override: paint every vert (incl. the cup walls, via _matAtVerts) with the chosen material
    // so any shape can be tested on any surface. 'auto' keeps the terrain's authored materials.
    if (_groundMat !== 'auto') vertices.forEach(v => { v.mat = _groundMat; });
    _matAtVerts = vertices.map(v => ({ x: v.x, mat: v.mat }));
    holes.length = 0;
    objects.length = 0;
    currentHole = 0;
    carveCup(def.cupX);
    const h = holes[0];
    h.teeX = def.teeX; h.teeY = def.teeY;
    ball.x = def.teeX;
    ball.y = terrainYAt(def.teeX) - BALL_RADIUS;
    ball.vx = 0; ball.vy = 0; ball.atRest = true; ball.onGround = false;
    ball.spinRate = 0; ball.rotation = 0;
    ball.lastCollidedMat = null;
    strokes = 0; totalStrokes = 0;
    state = STATE_AIM;
    showTitle = false;
    setHoleCamera(h);
    // keep the camera framing the whole little hole
    camera.x = 0; camera.y = 0;
    _lastShot = null;
  }

  // ── A/B repeat-last-shot ─────────────────────────────────────────────────────
  // Records the exact launch (angle + power01 in [0,1] of MAX power) so a tweak can
  // be re-fired against the previous feel. Re-tees first so it's a true A/B.
  let _lastShot = null;
  function fireShot(angleRad, power01) {
    reTee();
    const power = Math.min(power01 * MAX_POWER, MAX_POWER);
    ball.vx = Math.cos(angleRad) * power;
    ball.vy = Math.sin(angleRad) * power;
    ball.atRest = false; ball.onGround = false;
    ball.slowFrames = 0; ball.flightFrames = 0; ball.spinRate = 0;
    state = STATE_FLIGHT;
    strokes++;
    _lastShot = { angleRad, power01 };
  }
  function repeatShot() { if (_lastShot) fireShot(_lastShot.angleRad, _lastShot.power01); }

  function reTee() {
    const h = holes[0];
    if (h.cupFilled) loadTerrain(terrainIdx); // a sunk shot fills the cup — rebuild
    ball.x = h.teeX;
    ball.y = terrainYAt(h.teeX) - BALL_RADIUS;
    ball.vx = 0; ball.vy = 0; ball.atRest = true; ball.onGround = false;
    ball.spinRate = 0; ball.rotation = 0; ball.lastCollidedMat = null;
    state = STATE_AIM; strokes = 0;
  }

  // ── Custom aim (drag BACK from the ball, like the real game) ─────────────────
  // The engine's own mouse handlers fire on the canvas, but they read POWER_SCALE
  // off raw drag PIXELS. We disable the panel area for aim and let the engine's aim
  // run on the world canvas — but we ALSO capture the last shot's angle+power so A/B
  // works. Simplest: intercept mouseup to record, then forward to the engine values.
  // The engine sets ball.vx/vy on mouseup already; we just snapshot the launch.
  const cv = document.getElementById('c');
  cv.addEventListener('mouseup', () => {
    // After the engine's own mouseup handler ran, ball has the launch velocity.
    // Record it as angle + power01 so repeat re-fires the identical launch even
    // after a knob tweak changes POWER_SCALE/MAX_POWER.
    setTimeout(() => {
      if (state === STATE_FLIGHT && (ball.vx || ball.vy)) {
        const sp = Math.hypot(ball.vx, ball.vy);
        _lastShot = { angleRad: Math.atan2(ball.vy, ball.vx), power01: Math.min(sp / MAX_POWER, 1) };
      }
    }, 0);
  }, true);

  // ── Knob registry ────────────────────────────────────────────────────────────
  // The feel knobs in shared.js are top-level `let` declarations. A top-level `let`
  // is NOT a property of `window` — but a sibling <script> (this file) shares the
  // same global lexical scope, so we read/write them by BARE NAME. Each knob gets an
  // explicit get/set closure (mutating the REAL engine variable, never a fork).
  // NOTE: the engine reads PER-MATERIAL rollingFriction/surfaceFriction/restitution for the actual
  // roll/bounce/stop (gameplay.js friction + desert-golfing.js collide). The old global ROLLING_FRICTION
  // and RESTITUTION sliders were DEAD (declared in shared.js, never read) — removed to cut the confusion.
  // SURFACE_FRICTION (global) IS read, but ONLY as the "slope too steep to rest" threshold in canRest() —
  // labelled as such. Dial real feel via the PER-MATERIAL knobs below + the PRESETS row.
  const GLOBAL_KNOBS = [
    { name: 'POWER_SCALE',      min: 0,    max: 0.20, step: 0.001, group: 'LAUNCH',
      get: () => POWER_SCALE,      set: (v) => { POWER_SCALE = v; } },
    { name: 'MAX_POWER',        min: 1,    max: 30,   step: 0.5,   group: 'LAUNCH',
      get: () => MAX_POWER,        set: (v) => { MAX_POWER = v; } },
    { name: 'GRAVITY',          min: 0,    max: 0.30, step: 0.001, group: 'FLIGHT',
      get: () => GRAVITY,          set: (v) => { GRAVITY = v; } },
    { name: 'BOUNCE_THRESHOLD', min: 0,    max: 8,    step: 0.05,  group: 'FLIGHT',
      get: () => BOUNCE_THRESHOLD, set: (v) => { BOUNCE_THRESHOLD = v; } },
    { name: 'SURFACE_FRICTION', label: 'SURFACE_FRICTION (slope-rest)', min: 0, max: 0.1, step: 0.001, group: 'ROLL/STOP',
      get: () => SURFACE_FRICTION, set: (v) => { SURFACE_FRICTION = v; } },
    { name: 'BALL_RADIUS',      min: 1,    max: 16,   step: 0.5,   group: 'BALL',
      get: () => BALL_RADIUS,      set: (v) => { BALL_RADIUS = v; } },
  ];
  const KNOB_BY_NAME = {};
  GLOBAL_KNOBS.forEach(k => { KNOB_BY_NAME[k.name] = k; });
  // Per-material knobs (the values collisions + friction actually read).
  const MAT_LIST = ['sand', 'grass', 'ice', 'rock', 'mud'];
  const MAT_FIELDS = [
    { key: 'restitution',     min: 0,    max: 1,    step: 0.01 },
    { key: 'rollingFriction', min: 0.50, max: 1.0,  step: 0.001 },
    { key: 'surfaceFriction', min: 0,    max: 0.1,  step: 0.001 },
  ];

  // ── PRESETS (feel starting points) ───────────────────────────────────────────
  // Each sets the global knobs + EVERY material together so the feel is coherent. SHIP = restore the
  // shipped defaults. The big lever for "ball stops sooner" is per-material surfaceFriction (the constant
  // low-speed drag): ship is a tiny 0.004 so the ball creeps near-stationary until the 2s slow-roll
  // failsafe — raising it makes the ball settle crisply in well under a second.
  const PRESET_NAMES = ['SHIP', 'REALISTIC', 'SNAPPY', 'FLOATY'];
  const PRESETS = {
    REALISTIC: {
      desc: 'heavier gravity, low air-drag → momentum builds downhill, stops on flats',
      globals: { GRAVITY: 0.07, SURFACE_FRICTION: 0.010, BOUNCE_THRESHOLD: 1.0, POWER_SCALE: 0.05, MAX_POWER: 11 },
      mats: {
        sand:  { restitution: 0.35, rollingFriction: 0.990, surfaceFriction: 0.014 },
        grass: { restitution: 0.30, rollingFriction: 0.990, surfaceFriction: 0.012 },
        ice:   { restitution: 0.50, rollingFriction: 0.997, surfaceFriction: 0.004 },
        rock:  { restitution: 0.60, rollingFriction: 0.990, surfaceFriction: 0.010 },
        mud:   { restitution: 0.12, rollingFriction: 0.960, surfaceFriction: 0.025 },
        water: { restitution: 0.10, rollingFriction: 0.880, surfaceFriction: 0.030 },
      },
    },
    SNAPPY: {
      desc: 'short roll-out, crisp quick stop (kills the long creep-to-rest)',
      globals: { GRAVITY: 0.045, SURFACE_FRICTION: 0.020, BOUNCE_THRESHOLD: 1.3, POWER_SCALE: 0.04, MAX_POWER: 8 },
      mats: {
        sand:  { restitution: 0.38, rollingFriction: 0.952, surfaceFriction: 0.020 },
        grass: { restitution: 0.30, rollingFriction: 0.950, surfaceFriction: 0.022 },
        ice:   { restitution: 0.48, rollingFriction: 0.984, surfaceFriction: 0.008 },
        rock:  { restitution: 0.55, rollingFriction: 0.950, surfaceFriction: 0.018 },
        mud:   { restitution: 0.12, rollingFriction: 0.880, surfaceFriction: 0.032 },
        water: { restitution: 0.10, rollingFriction: 0.840, surfaceFriction: 0.040 },
      },
    },
    FLOATY: {
      desc: 'low-g, bouncy, long lazy rolls (moon-golf arcade feel)',
      globals: { GRAVITY: 0.022, SURFACE_FRICTION: 0.003, BOUNCE_THRESHOLD: 0.7, POWER_SCALE: 0.045, MAX_POWER: 9 },
      mats: {
        sand:  { restitution: 0.55, rollingFriction: 0.992, surfaceFriction: 0.003 },
        grass: { restitution: 0.50, rollingFriction: 0.990, surfaceFriction: 0.003 },
        ice:   { restitution: 0.65, rollingFriction: 0.998, surfaceFriction: 0.001 },
        rock:  { restitution: 0.80, rollingFriction: 0.988, surfaceFriction: 0.003 },
        mud:   { restitution: 0.20, rollingFriction: 0.930, surfaceFriction: 0.012 },
        water: { restitution: 0.12, rollingFriction: 0.860, surfaceFriction: 0.022 },
      },
    },
  };

  // ── Side panel (HTML/CSS, Departure Mono) ────────────────────────────────────
  let panelVisible = true;
  const panel = document.createElement('div');
  panel.id = 'physlab-panel';
  document.body.appendChild(panel);

  const style = document.createElement('style');
  style.textContent = `
    #physlab-panel{position:fixed;top:0;right:0;height:100vh;width:316px;z-index:20;
      background:rgba(10,12,20,0.92);border-left:1px solid rgba(184,140,255,0.28);
      color:#e8e2ff;font:12px 'Departure Mono',monospace;overflow-y:auto;padding:12px 14px 28px;
      backdrop-filter:blur(3px);}
    #physlab-panel::-webkit-scrollbar{width:8px}
    #physlab-panel::-webkit-scrollbar-thumb{background:rgba(184,140,255,0.3);border-radius:4px}
    #physlab-panel h1{font-size:14px;letter-spacing:3px;color:#fff;margin:0 0 2px;font-weight:normal}
    #physlab-panel .sub{font-size:10px;color:#8f86b8;margin-bottom:12px;letter-spacing:1px}
    #physlab-panel .grp{font-size:10px;letter-spacing:2px;color:#b88cff;margin:14px 0 6px;
      border-bottom:1px solid rgba(184,140,255,0.18);padding-bottom:3px}
    #physlab-panel .knob{margin:7px 0}
    #physlab-panel .knob .row{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:2px}
    #physlab-panel .knob .lbl{color:#c9c2e8;font-size:11px}
    #physlab-panel .knob .val{color:#ffe08a;font-size:11px}
    #physlab-panel input[type=range]{width:100%;height:14px;-webkit-appearance:none;appearance:none;
      background:transparent;cursor:pointer;margin:0}
    #physlab-panel input[type=range]::-webkit-slider-runnable-track{height:3px;background:rgba(184,140,255,0.25);border-radius:2px}
    #physlab-panel input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;appearance:none;
      width:12px;height:12px;margin-top:-5px;border-radius:50%;background:#e8c840;border:1px solid #0c0e14}
    #physlab-panel input[type=range]::-moz-range-track{height:3px;background:rgba(184,140,255,0.25);border-radius:2px}
    #physlab-panel input[type=range]::-moz-range-thumb{width:12px;height:12px;border-radius:50%;background:#e8c840;border:1px solid #0c0e14}
    #physlab-panel .btnrow{display:flex;gap:6px;flex-wrap:wrap;margin:8px 0}
    #physlab-panel button{font:11px 'Departure Mono',monospace;background:rgba(184,140,255,0.12);
      color:#e8e2ff;border:1px solid rgba(184,140,255,0.32);border-radius:4px;padding:5px 9px;cursor:pointer}
    #physlab-panel button:hover{background:rgba(184,140,255,0.24)}
    #physlab-panel button.on{background:#e8c840;color:#221a06;border-color:#e8c840}
    #physlab-panel button.ab{background:rgba(232,200,64,0.16);border-color:rgba(232,200,64,0.5);color:#ffe08a}
    #physlab-panel select{width:100%;margin:2px 0 4px;background:#0c0e16;color:#e8e2ff;
      border:1px solid rgba(184,140,255,0.32);border-radius:4px;padding:5px 7px;
      font:11px 'Departure Mono',monospace;cursor:pointer}
    #physlab-panel textarea{width:100%;height:128px;margin-top:6px;background:#07080d;color:#9fe0b0;
      border:1px solid rgba(184,140,255,0.25);border-radius:4px;font:10px 'Departure Mono',monospace;
      padding:6px;resize:vertical;white-space:pre;overflow:auto}
    #physlab-panel .scrollcue{font-size:10px;color:#6f6694;text-align:center;margin:10px 0 0;letter-spacing:1px}
    #physlab-hint{position:fixed;left:14px;bottom:12px;z-index:20;font:11px 'Departure Mono',monospace;
      color:rgba(232,236,255,0.62);text-shadow:0 1px 4px #000,0 0 6px #000;pointer-events:none}
  `;
  document.head.appendChild(style);

  const hint = document.createElement('div');
  hint.id = 'physlab-hint';
  hint.textContent = 'drag BACK from the ball to aim · R re-tee · SPACE repeat shot · H hide panel · TERRAIN + GROUND dropdowns in panel (1/2/3 = first 3 shapes)';
  document.body.appendChild(hint);

  // Build panel DOM
  const sliderEls = {};      // name/"mat.key" -> {input, val}
  function knobRow(parent, label, get, set, min, max, step, fmt, id) {
    const wrap = document.createElement('div'); wrap.className = 'knob';
    const row = document.createElement('div'); row.className = 'row';
    const lbl = document.createElement('span'); lbl.className = 'lbl'; lbl.textContent = label;
    const val = document.createElement('span'); val.className = 'val';
    row.appendChild(lbl); row.appendChild(val);
    const inp = document.createElement('input');
    inp.type = 'range'; inp.min = min; inp.max = max; inp.step = step;
    inp.value = get();
    const refresh = () => { val.textContent = fmt(get()); };
    inp.addEventListener('input', () => { set(parseFloat(inp.value)); refresh(); writeReadout(); });
    wrap.appendChild(row); wrap.appendChild(inp); parent.appendChild(wrap);
    sliderEls[id] = { input: inp, refresh };
    refresh();
  }
  const fmt = (n) => {
    if (Math.abs(n) >= 100) return n.toFixed(0);
    if (Math.abs(n) >= 1) return n.toFixed(2);
    return n.toFixed(3);
  };

  function buildPanel() {
    panel.innerHTML = '';
    const h1 = document.createElement('h1'); h1.textContent = 'PHYSICS LAB'; panel.appendChild(h1);
    const sub = document.createElement('div'); sub.className = 'sub'; sub.textContent = 'PAR SEC · dial the feel'; panel.appendChild(sub);

    // PRESETS — set globals + every material together (coherent feel starting points).
    const pHead = document.createElement('div'); pHead.className = 'grp'; pHead.textContent = 'PRESETS'; panel.appendChild(pHead);
    presetRow = document.createElement('div'); presetRow.className = 'btnrow';
    PRESET_NAMES.forEach(name => {
      const b = document.createElement('button'); b.textContent = name; b._preset = name;
      b.title = (name === 'SHIP') ? 'restore shipped defaults' : (PRESETS[name] && PRESETS[name].desc) || '';
      b.onclick = () => applyPreset(name);
      presetRow.appendChild(b);
    });
    panel.appendChild(presetRow);
    presetDesc = document.createElement('div'); presetDesc.className = 'sub';
    presetDesc.style.cssText = 'margin:5px 0 2px;color:#9fe0b0';
    presetDesc.textContent = 'ball reads PER-MATERIAL roll/stop (below); globals = launch/flight/slope-rest';
    panel.appendChild(presetDesc);

    // TERRAIN shape (dropdown) + GROUND-material override (dropdown).
    const terrHead = document.createElement('div'); terrHead.className = 'grp'; terrHead.textContent = 'TERRAIN'; panel.appendChild(terrHead);
    const terrSel = document.createElement('select');
    TERRAINS.forEach((t, i) => { const o = document.createElement('option'); o.value = String(i); o.textContent = t.label; terrSel.appendChild(o); });
    terrSel.value = String(terrainIdx);
    terrSel.addEventListener('change', () => { loadTerrain(parseInt(terrSel.value, 10)); });
    panel.appendChild(terrSel);

    const groundLbl = document.createElement('div'); groundLbl.className = 'sub';
    groundLbl.style.cssText = 'margin:4px 0 1px;color:#8f86b8'; groundLbl.textContent = 'ground material (override)';
    panel.appendChild(groundLbl);
    const groundSel = document.createElement('select');
    ['auto'].concat(MAT_LIST).forEach(g => { const o = document.createElement('option'); o.value = g; o.textContent = g.toUpperCase(); groundSel.appendChild(o); });
    groundSel.value = _groundMat;
    groundSel.addEventListener('change', () => { _groundMat = groundSel.value; loadTerrain(terrainIdx); });
    panel.appendChild(groundSel);

    // Keep the terrain dropdown in sync when terrain changes via keyboard (1/2/3) or the headless API.
    refreshTerrainBtns = () => { terrSel.value = String(terrainIdx); };

    const aRow = document.createElement('div'); aRow.className = 'btnrow';
    const reBtn = document.createElement('button'); reBtn.textContent = 'RE-TEE (R)'; reBtn.onclick = reTee;
    const abBtn = document.createElement('button'); abBtn.textContent = '↺ REPEAT SHOT (A/B)'; abBtn.className = 'ab'; abBtn.onclick = repeatShot;
    aRow.appendChild(reBtn); aRow.appendChild(abBtn);
    panel.appendChild(aRow);

    const rRow = document.createElement('div'); rRow.className = 'btnrow';
    const resetK = document.createElement('button'); resetK.textContent = 'RESET KNOBS'; resetK.onclick = resetKnobs;
    rRow.appendChild(resetK);
    const fxBtn = document.createElement('button'); fxBtn.textContent = 'PARTICLES';
    fxBtn.className = showFX ? 'on' : '';
    fxBtn.title = 'landing-debris puff on ball impact (RG_FX) — off for pure-physics testing';
    fxBtn.onclick = () => { showFX = !showFX; fxBtn.className = showFX ? 'on' : ''; };
    rRow.appendChild(fxBtn);
    panel.appendChild(rRow);

    // Global knobs grouped
    const groups = {};
    GLOBAL_KNOBS.forEach(k => { (groups[k.group] = groups[k.group] || []).push(k); });
    for (const g in groups) {
      const gh = document.createElement('div'); gh.className = 'grp'; gh.textContent = g; panel.appendChild(gh);
      groups[g].forEach(k => {
        knobRow(panel, k.label || k.name, k.get, k.set, k.min, k.max, k.step, fmt, k.name);
      });
    }

    // Per-material knobs — ONE material at a time via a dropdown (keeps the panel uncluttered).
    // The readout below still lists ALL materials, so a copy-paste stays complete.
    const mh = document.createElement('div'); mh.className = 'grp'; mh.textContent = 'MATERIAL'; panel.appendChild(mh);
    const matSel = document.createElement('select');
    MAT_LIST.forEach(m => { const o = document.createElement('option'); o.value = m; o.textContent = m.toUpperCase(); matSel.appendChild(o); });
    matSel.value = _selMat;
    panel.appendChild(matSel);
    const matKnobs = document.createElement('div'); panel.appendChild(matKnobs);
    function renderMatKnobs(m) {
      _selMat = m;
      // Drop stale per-material slider refs so syncSliders() only touches the visible material.
      for (const id in sliderEls) { if (id.indexOf('mat.') === 0) delete sliderEls[id]; }
      matKnobs.innerHTML = '';
      MAT_FIELDS.forEach(f => {
        const id = 'mat.' + m + '.' + f.key;
        knobRow(matKnobs, f.key.toUpperCase(), () => MATERIALS[m][f.key], (v) => { MATERIALS[m][f.key] = v; },
          f.min, f.max, f.step, fmt, id);
      });
    }
    matSel.addEventListener('change', () => renderMatKnobs(matSel.value));
    renderMatKnobs(_selMat);

    // Readout
    const gh = document.createElement('div'); gh.className = 'grp'; gh.textContent = 'READOUT (copy → src/shared.js)'; panel.appendChild(gh);
    readoutEl = document.createElement('textarea'); readoutEl.readOnly = true; panel.appendChild(readoutEl);
    const cue = document.createElement('div'); cue.className = 'scrollcue';
    cue.textContent = '— scroll for all materials —'; panel.appendChild(cue);
    writeReadout();
  }
  let refreshTerrainBtns = () => {};
  let readoutEl = null;
  let presetRow = null, presetDesc = null;
  let _selMat = MAT_LIST[0];   // which material the dropdown is showing
  let _groundMat = 'auto';     // 'auto' = terrain's authored materials; else paint the whole ground this material
  let showFX = true;           // draw RG_FX landing-debris particles (toggle for pure-physics testing)

  function writeReadout() {
    if (!readoutEl) return;
    // Print ALL eight shared.js globals (even RESTITUTION/ROLLING_FRICTION, which have no slider — so a
    // copy-paste of this block stays a complete replacement for shared.js lines and never drops a line).
    let s = '// globals (src/shared.js)\n';
    s += 'let GRAVITY = ' + trim(GRAVITY) + ';\n';
    s += 'let RESTITUTION = ' + trim(RESTITUTION) + ';\n';
    s += 'let ROLLING_FRICTION = ' + trim(ROLLING_FRICTION) + ';\n';
    s += 'let SURFACE_FRICTION = ' + trim(SURFACE_FRICTION) + ';\n';
    s += 'let POWER_SCALE = ' + trim(POWER_SCALE) + ';\n';
    s += 'let MAX_POWER = ' + trim(MAX_POWER) + ';\n';
    s += 'let BOUNCE_THRESHOLD = ' + trim(BOUNCE_THRESHOLD) + ';\n';
    s += 'let BALL_RADIUS = ' + trim(BALL_RADIUS) + ';\n';
    s += '\n// MATERIALS (src/shared.js)\n';
    MAT_LIST.forEach(m => {
      const M = MATERIALS[m];
      s += m + ': { restitution: ' + trim(M.restitution) +
        ', rollingFriction: ' + trim(M.rollingFriction) +
        ', surfaceFriction: ' + trim(M.surfaceFriction) + ' },\n';
    });
    readoutEl.value = s;
  }
  function trim(n) {
    // tidy float: drop trailing zeros but keep precision
    return parseFloat(n.toFixed(4)).toString();
  }

  function syncSliders() {
    for (const id in sliderEls) {
      const e = sliderEls[id];
      let v;
      if (id.startsWith('mat.')) { const [, m, key] = id.split('.'); v = MATERIALS[m][key]; }
      else v = KNOB_BY_NAME[id].get();
      e.input.value = v; e.refresh();
    }
  }

  function resetKnobs() {
    for (const name in DEFAULTS) { if (KNOB_BY_NAME[name]) KNOB_BY_NAME[name].set(DEFAULTS[name]); }
    for (const m in MAT_DEFAULTS) Object.assign(MATERIALS[m], MAT_DEFAULTS[m]);
    syncSliders(); writeReadout();
  }

  // Highlight the active preset button + show its description.
  function markPreset(name) {
    if (presetRow) Array.from(presetRow.children).forEach(b => { b.className = (b._preset === name) ? 'on' : ''; });
    if (presetDesc) {
      presetDesc.textContent = (name === 'SHIP')
        ? 'SHIP — shipped defaults · ball reads PER-MATERIAL roll/stop (below)'
        : (name + ' — ' + (PRESETS[name] ? PRESETS[name].desc : ''));
    }
  }

  // Apply a preset: set the global knobs + every material, then refresh sliders/readout.
  function applyPreset(name) {
    if (name === 'SHIP') { resetKnobs(); markPreset('SHIP'); return; }
    const p = PRESETS[name];
    if (!p) return;
    for (const g in p.globals) { if (KNOB_BY_NAME[g]) KNOB_BY_NAME[g].set(p.globals[g]); }
    for (const m in p.mats) { if (MATERIALS[m]) Object.assign(MATERIALS[m], p.mats[m]); }
    syncSliders(); writeReadout(); markPreset(name);
  }

  buildPanel();
  markPreset('SHIP');

  // ── Keyboard ──────────────────────────────────────────────────────────────
  window.addEventListener('keydown', (e) => {
    const tag = e.target && e.target.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;
    if (e.key === 'h' || e.key === 'H') {
      panelVisible = !panelVisible;
      panel.style.display = panelVisible ? '' : 'none';
    } else if (e.key === 'r' || e.key === 'R') {
      reTee();
    } else if (e.key === ' ') {
      e.preventDefault(); repeatShot();
    } else if (e.key === '1') { loadTerrain(0); refreshTerrainBtns(); }
    else if (e.key === '2') { loadTerrain(1); refreshTerrainBtns(); }
    else if (e.key === '3') { loadTerrain(2); refreshTerrainBtns(); }
  });

  // ── Top-left status HUD on the canvas (terrain + live material + last shot) ──
  function drawLabHUD() {
    ctx.save();
    ctx.scale(displayScale, displayScale);
    ctx.textAlign = 'left';
    ctx.font = "13px 'Departure Mono', monospace";
    ctx.fillStyle = 'rgba(242,236,255,0.85)';
    ctx.fillText('PHYSICS LAB · ' + TERRAINS[terrainIdx].label, 18, 26);
    ctx.font = "11px 'Departure Mono', monospace";
    ctx.fillStyle = 'rgba(184,140,255,0.85)';
    const liveMat = (ball.lastCollidedMat || (typeof getMaterialAt === 'function' ? getMaterialAt(ball.x) : 'sand'));
    const sp = Math.hypot(ball.vx, ball.vy);
    let line = 'material: ' + liveMat + '   speed: ' + sp.toFixed(2) + '   strokes: ' + strokes;
    ctx.fillText(line, 18, 44);
    if (_lastShot) {
      ctx.fillStyle = 'rgba(232,200,64,0.8)';
      ctx.fillText('last shot: ' + (_lastShot.angleRad * 180 / Math.PI).toFixed(1) + '°  pow ' +
        (_lastShot.power01 * 100).toFixed(0) + '%   (SPACE to A/B)', 18, 62);
    }
    ctx.restore();
  }

  // ── Loop (fixed 60Hz step, like the engine; lab owns it) ─────────────────────
  let auto = true;
  function frame() {
    if (auto) update();
    draw();
    // Landing-debris particles in WORLD space, under the HUD (mirrors wrap.js drawWorld + fxlab.js).
    if (showFX && window.RG_FX) {
      ctx.save();
      ctx.scale(displayScale, displayScale);
      if (MODE.applyCameraTransform) MODE.applyCameraTransform(ctx);
      RG_FX.draw(ctx);
      ctx.restore();
    }
    drawLabHUD();
    // keep slider value labels live while the ball is rolling (material can change)
    window._physlabRAF = requestAnimationFrame(frame);
  }

  // ── Headless API (for screenshots / GIF) ─────────────────────────────────────
  window.__reset = function () { loadTerrain(terrainIdx); refreshTerrainBtns(); };
  window.__step = function (n) { n = n || 1; for (let i = 0; i < n; i++) update(); };
  window.__frame = function () { draw(); drawLabHUD(); };
  window.__setAuto = function (v) { auto = !!v; };
  window.__shoot = function (angleDeg, power01) {
    fireShot((angleDeg || 0) * Math.PI / 180, Math.max(0, Math.min(1, power01 == null ? 0.7 : power01)));
  };
  window.__setTerrain = function (i) { loadTerrain(i); refreshTerrainBtns(); };
  window.__setKnob = function (name, v) { if (KNOB_BY_NAME[name]) KNOB_BY_NAME[name].set(v); syncSliders(); writeReadout(); };
  window.__setMat = function (m, key, v) { MATERIALS[m][key] = v; syncSliders(); writeReadout(); };
  window.__state = function () {
    return { terrain: TERRAINS[terrainIdx].id, state: state, atRest: ball.atRest,
      ball: { x: ball.x, y: ball.y, vx: ball.vx, vy: ball.vy },
      lastShot: _lastShot, GRAVITY: GRAVITY, POWER_SCALE: POWER_SCALE };
  };

  // ── Boot ────────────────────────────────────────────────────────────────────
  // resizeDisplay() already ran in art.js on load; ensure W/H + camera are ready.
  loadTerrain(0);
  frame();
})();
