// ── tools/verify.cjs — HEADLESS completability harness ───────────────────────────────────────────────
// Loads the REAL engine (physics + generation + the autoplay bot's solver) into a Node vm context with
// minimal browser stubs, then plays every planet to completion deterministically. No browser, no flaky
// test harness, no reimplemented physics (→ no divergence). Reproducible: same seed → same result.
//
//   node tools/verify.cjs [planets] [seedsPerPlanet]
//   node tools/verify.cjs p24 5          # one planet, 5 seeds
//   node tools/verify.cjs all 3          # all 24, 3 seeds each
//
// Cross-check against the browser: the engine code IS the browser's, so a planet that completes here
// completes there (modulo the roguelike's colour palette, which doesn't touch physics).

const fs = require('fs'), vm = require('vm'), path = require('path');
const ROOT = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');

// ── browser stubs (only what the core gen/physics files touch) ──
const noop = () => {};
const stubCtx = new Proxy({}, { get: () => () => stubCtx });             // every ctx.* is a no-op returning ctx
const canvasEl = { width: 960, height: 540, style: {}, getContext: () => stubCtx, addEventListener: noop, getBoundingClientRect: () => ({ left: 0, top: 0, width: 960, height: 540 }) };
const store = {};
const sandbox = {
  Math, JSON, Date, Array, Object, Number, String, Boolean, isFinite, isNaN, parseInt, parseFloat, Infinity, NaN,
  console, Proxy, Symbol, Map, Set, Float64Array, Float32Array, Int32Array,
  document: { getElementById: () => canvasEl, createElement: () => canvasEl, addEventListener: noop, body: { appendChild: noop }, querySelector: () => null },
  localStorage: { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } },
  requestAnimationFrame: () => 0, cancelAnimationFrame: noop, setTimeout: () => 0, clearTimeout: noop,
  performance: { now: () => 0 }, navigator: { userAgent: 'node' },
  addEventListener: noop, removeEventListener: noop,
  Image: function () { return { addEventListener: noop, set src(v) {}, get src() { return ''; }, onload: null, width: 0, height: 0 }; },
  AudioContext: function () { return { createGain: () => ({ connect: noop, gain: {} }), createOscillator: () => ({ connect: noop, start: noop, stop: noop, frequency: {} }), destination: {} }; },
};
sandbox.window = sandbox;            // engine reads window.X for many globals
sandbox.globalThis = sandbox;
sandbox.RG = { _simulating: false }; // minimal roguelike stub (the bot sets RG._simulating)
vm.createContext(sandbox);

// ── load the real engine (concatenate so top-level let/const are shared across files) ──
const FILES = [
  'src/shared.js', 'src/worlds/run.js', 'src/planet-gen.js', 'src/level-design.js',
  'src/modes/desert-golfing.js', 'src/set-pieces.js', 'src/gameplay.js', 'src/roguelike/playtest-bot.js',
];
let combined = '';
for (const f of FILES) combined += `\n/* ===== ${f} ===== */\n` + read(f);
try {
  vm.runInContext(combined, sandbox, { filename: 'engine.bundle.js' });
} catch (e) {
  console.error('ENGINE LOAD FAILED:', e.message, '\n', (e.stack || '').split('\n').slice(0, 4).join('\n'));
  process.exit(1);
}

// ── the driver runs INSIDE the context (so it can see the engine's let/const globals) ──
const driver = `
RESULT = (function () {
  // start a planet by id, or build one at an arbitrary complexity via "c:0.6" (same generator as the lab)
  function startPlanet(courseId) {
    if (courseId.indexOf('c:') === 0 && window.PLANET_GEN) {
      const c = parseFloat(courseId.slice(2));
      WORLDS['run-world'].courses['_lab'] = window.PLANET_GEN.buildConfig(c, 'rock', '#1a2230', 'lab c=' + c);
      startCourse('run-world', '_lab');
    } else {
      startCourse('run-world', courseId);
    }
  }

  function playPlanet(courseId, seed) {
    localStorage.setItem('dg-seed', String(seed));
    startPlanet(courseId);
    // Match the browser: the roguelike sets GRAVITY = baseGravity * course.phys.gravityScale (run.js:871).
    GRAVITY = 0.04 * ((currentCourse.phys && currentCourse.phys.gravityScale != null) ? currentCourse.phys.gravityScale : 1);
    ensureHolesAhead(8);
    const holeCount = currentCourse.holeCount || 9;
    let masses = 0;
    for (let i = 0; i < holeCount; i++) if (holes[i] && holes[i]._overhangs) masses++;
    // Run the REAL autoplay (the exact loop the browser runs): aiUpdate() picks/fires shots with the bot's
    // full logic (stuck-mode escalation, OOB respawn, hole advancement); update() is the real game tick.
    window.aiEnabled = true; window.aiSpeed = 1;
    if (RG.bot && RG.bot.start) RG.bot.start({ runs: 1, speed: 1 });
    for (let f = 0; f < 400000; f++) {
      aiUpdate(); update();
      if (state === STATE_COMPLETE) return { ok: true, masses };
      const st = RG.bot.stats && RG.bot.stats();
      if (st && st.stuckHole) return { ok: false, hole: st.stuckHole.hole, why: 'stuck' + (st.stuckHole.shots || ''), masses };
    }
    return { ok: false, hole: currentHole, why: 'timeout', masses };
  }

  // GEOM mode: dump the exact generated geometry for a fixed seed (for browser cross-check), don't play.
  if (typeof GEOM_SEED !== 'undefined' && GEOM_SEED !== null) {
    const out = [];
    for (const courseId of PLANETS_TO_RUN) {
      localStorage.setItem('dg-seed', String(GEOM_SEED));
      startPlanet(courseId);
      ensureHolesAhead(8);
      const g = [];
      for (let i = 0; i < (currentCourse.holeCount || 9); i++) { const h = holes[i]; g.push([Math.round(h.teeX), Math.round(h.cupX), Math.round(h.cupY), h.archetype || '?']); }
      out.push({ planet: courseId, seed: GEOM_SEED, holes: g });
    }
    return out;
  }

  const out = [];
  for (const courseId of PLANETS_TO_RUN) {
    for (let s = 0; s < SEEDS_PER; s++) {
      const seed = 1000 + s * 7919;        // fixed, reproducible seed ladder
      let r;
      try { r = playPlanet(courseId, seed); } catch (e) { r = { ok: false, why: 'ERR:' + e.message }; }
      out.push({ planet: courseId, seed, ...r });
    }
  }
  return out;
})();
`;

// pass args into the context
const argPlanets = process.argv[2] || 'all';
const seedsPer = parseInt(process.argv[3] || '3', 10);
const allPlanets = Array.from({ length: 24 }, (_, i) => 'p' + (i + 1));
sandbox.PLANETS_TO_RUN = argPlanets === 'all' ? allPlanets : argPlanets.split(',');
sandbox.SEEDS_PER = seedsPer;
sandbox.GEOM_SEED = (process.argv[3] === 'geom') ? (parseInt(process.argv[4] || '777', 10)) : null;

try {
  vm.runInContext(driver, sandbox, { filename: 'driver.js' });
} catch (e) {
  console.error('DRIVER FAILED:', e.message, '\n', (e.stack || '').split('\n').slice(0, 5).join('\n'));
  process.exit(1);
}

// ── report ──
const res = sandbox.RESULT;
if (sandbox.GEOM_SEED !== null) {                 // geometry dump for cross-check
  for (const p of res) { console.log(`${p.planet} seed=${p.seed}`); for (const h of p.holes) console.log('  tee=' + h[0] + ' cup=' + h[1] + ',' + h[2] + ' ' + h[3]); }
  process.exit(0);
}
const byPlanet = {};
for (const r of res) (byPlanet[r.planet] = byPlanet[r.planet] || []).push(r);
let pass = 0, fail = 0;
console.log('planet  seeds  result');
for (const p of Object.keys(byPlanet)) {
  const rs = byPlanet[p];
  const ok = rs.filter((r) => r.ok).length;
  const masses = rs.reduce((a, r) => a + (r.masses || 0), 0);
  pass += ok; fail += rs.length - ok;
  const fails = rs.filter((r) => !r.ok).map((r) => `seed${r.seed}@h${r.hole}(${r.why})`).join(' ');
  console.log(`${p.padEnd(6)}  ${ok}/${rs.length}    ${ok === rs.length ? 'OK' : 'FAIL: ' + fails}   masses=${masses}`);
}
console.log(`\nTOTAL: ${pass}/${pass + fail} hole-runs complete (${fail} fail)`);
process.exit(fail > 0 ? 1 : 0);
