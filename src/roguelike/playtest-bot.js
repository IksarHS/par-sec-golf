// ── Autoplay Bot (AI golfer) ────────────────────────────────────────────────
// Press A to toggle autoplay: skim through runs hands-off and see what's there. The bot
// SIMULATES candidate shots with the REAL physics engine (suppressing onRest side effects via
// RG._simulating), picks one that sinks — or lands closest to the cup — and fires it through
// the engine's built-in autoplay loop (main.js runs aiUpdate()+update() aiSpeed times per frame
// when aiEnabled, then draw(), so Fault descents still animate). Plays real runs, so
// progression/unlocks (stars, the Fault, the Vault) actually fire. Also the headless-verify
// harness:
//
//   A                                       // toggle autoplay (loops runs at 8x)
//   RG.bot.start({ runs: 3, speed: 12 })    // play 3 full runs at 12x
//   RG.bot.stats()                          // shots/holes/runs + any stuck hole
//   RG.bot.stop()
(function () {

  // ── shot simulation (restore-after; no live side effects) ──
  function saveBall() {
    return { x: ball.x, y: ball.y, vx: ball.vx, vy: ball.vy, atRest: ball.atRest, onGround: ball.onGround,
      spinRate: ball.spinRate, rotation: ball.rotation, slowFrames: ball.slowFrames || 0,
      stuckFrames: ball.stuckFrames || 0, flightFrames: ball.flightFrames || 0 };
  }
  function restoreBall(s) {
    ball.x = s.x; ball.y = s.y; ball.vx = s.vx; ball.vy = s.vy; ball.atRest = s.atRest; ball.onGround = s.onGround;
    ball.spinRate = s.spinRate; ball.rotation = s.rotation; ball.slowFrames = s.slowFrames;
    ball.stuckFrames = s.stuckFrames; ball.flightFrames = s.flightFrames;
  }

  function simulateShot(vx, vy) {
    const hole = holes[currentHole];
    const sb = saveBall(), ss = state;
    const scx = (typeof camera !== 'undefined') ? camera.x : 0, scy = (typeof camera !== 'undefined' && camera.y) || 0;
    const origLog = (typeof _logBall === 'function') ? _logBall : null;
    const origSave = (typeof saveGameSnapshot === 'function') ? saveGameSnapshot : null;
    if (origLog) _logBall = function () {};
    if (origSave) saveGameSnapshot = function () {};
    if (window.RG) RG._simulating = true;          // suppress onRest side effects during the sim

    ball.vx = vx; ball.vy = vy; ball.atRest = false; ball.onGround = false;
    ball.slowFrames = 0; ball.stuckFrames = 0; ball.flightFrames = 0; ball.spinRate = 0;
    state = STATE_FLIGHT;

    let scored = false, oob = false;
    for (let f = 0; f < 600; f++) {
      const prev = state;
      update();
      if (state === STATE_OOB) { oob = true; for (let o = 0; o < 80; o++) update(); break; }
      if (state === STATE_PAUSE) { scored = true; break; }          // ball in cup
      if (state === STATE_AIM && prev === STATE_FLIGHT) break;       // rested, no score
      if (ball.atRest && state !== STATE_FLIGHT) break;
    }
    const res = {
      x: ball.x, y: ball.y,
      distToCup: hole ? Math.sqrt((ball.x - hole.cupX) ** 2 + (ball.y - hole.cupY) ** 2) : Infinity,
      scored: scored, oob: oob,
    };

    restoreBall(sb); state = ss;
    if (typeof camera !== 'undefined') { camera.x = scx; camera.y = scy; }
    if (window.RG) RG._simulating = false;
    if (origLog) _logBall = origLog;
    if (origSave) saveGameSnapshot = origSave;
    return res;
  }

  // ── shot search: grid of angle×power, refine around the best safe shot ──
  function calculateShot() {
    const hole = holes[currentHole];
    if (!hole) return null;
    const dx = hole.cupX - ball.x;
    const hdist = Math.abs(dx);
    const dir = dx > 0 ? 1 : -1;

    const stuck = botHoleStrokes >= 3;
    // RG_BOT_STEPS = the quality dial (search grid per axis). The shop's caddy buys
    // levels of it; null/unset = the full-depth verification bot.
    const steps = window.RG_BOT_STEPS || (stuck ? 30 : 20);
    const minLoft = 0.08, maxLoft = 1.4, minPower = 1.0, maxPower = (typeof MAX_POWER !== 'undefined') ? MAX_POWER : 30;

    let scoringShot = null, safeShot = null, safeDist = Infinity;
    for (let ai = 0; ai < steps; ai++) {
      const loft = minLoft + (maxLoft - minLoft) * (ai / (steps - 1));
      const angle = dir > 0 ? -loft : (Math.PI + loft);
      const cosA = Math.cos(angle), sinA = Math.sin(angle);
      for (let pi = 0; pi < steps; pi++) {
        const power = minPower + (maxPower - minPower) * (pi / (steps - 1));
        const r = simulateShot(cosA * power, sinA * power);
        if (r.scored && !scoringShot) scoringShot = { vx: cosA * power, vy: sinA * power };
        if (!r.oob && r.distToCup < safeDist) { safeDist = r.distToCup; safeShot = { vx: cosA * power, vy: sinA * power, power: power, angle: angle }; }
      }
      if (scoringShot) break;
    }
    if (scoringShot) return scoringShot;

    if (safeShot && safeDist < hdist * 2) {
      let fineAngle = safeShot.angle, finePower = safeShot.power;
      for (let pass = 0; pass < 3; pass++) {
        const range = (safeDist > 100 ? 0.3 : 0.15) / (pass + 1);
        for (let ai = 0; ai < 10; ai++) {
          const angle = fineAngle + (ai / 9 - 0.5) * 2 * range;
          for (let pi = 0; pi < 10; pi++) {
            const power = Math.max(1, Math.min(maxPower, finePower * (1 + (pi / 9 - 0.5) * 2 * range)));
            const r = simulateShot(Math.cos(angle) * power, Math.sin(angle) * power);
            if (r.scored) return { vx: Math.cos(angle) * power, vy: Math.sin(angle) * power };
            if (!r.oob && r.distToCup < safeDist) { safeDist = r.distToCup; safeShot = { vx: Math.cos(angle) * power, vy: Math.sin(angle) * power, power: power, angle: angle }; fineAngle = angle; finePower = power; }
          }
        }
      }
      return safeShot;
    }
    // fallback: a gentle lob toward the cup
    const loft = 0.5, angle = dir > 0 ? -loft : (Math.PI + loft), power = Math.min(maxPower, hdist * 0.01 + 2);
    return { vx: Math.cos(angle) * power, vy: Math.sin(angle) * power };
  }

  // ── driver (called by the engine autoplay loop each step when aiEnabled) ──
  window.aiEnabled = false;
  window.aiSpeed = 1;
  let botShot = null, botCompleteT = 0, botHoleStrokes = 0, botLastHole = -1;
  const STUCK = 45;  // shots on one hole before we declare it uncompletable
  const stats = { shots: 0, holes: 0, runs: 0, stuckHole: null, maxHoleShots: 0 };
  function resetStats() { stats.shots = 0; stats.holes = 0; stats.runs = 0; stats.stuckHole = null; stats.maxHoleShots = 0; botHoleStrokes = 0; botLastHole = -1; botCompleteT = 0; }

  window.aiUpdate = function () {
    if (!aiEnabled) return;
    // The crane (planet travel / descents) animates from draw() on the wall clock. When the tab is
    // HIDDEN the engine's background loop runs update()+aiUpdate() but NOT draw(), and many fixed
    // steps run per setInterval tick (so performance.now() barely moves across them) — a wall-clock
    // pan would stall. Drive it here with an explicit nominal per-step dt (~one 60Hz frame) so the
    // hidden pan advances by call count, finishing in ~the same number of steps as a 60Hz visible
    // pan. When the tab is visible draw() owns the pan (document.hidden is false) so this no-ops and
    // the crane never double-steps.
    if (window.RG && (RG.descending || (RG._descPhase && RG._descPhase !== 'none'))) {
      if (typeof document !== 'undefined' && document.hidden && RG._tickCrane) RG._tickCrane(null, 1000 / 60);
      return;
    }
    if (state === STATE_OOB || state === STATE_PAUSE || state === STATE_TRANSITION) return;

    if (typeof currentHole !== 'undefined' && currentHole !== botLastHole) {
      if (botLastHole >= 0 && botHoleStrokes > 0) { stats.holes++; if (botHoleStrokes > stats.maxHoleShots) stats.maxHoleShots = botHoleStrokes; }
      botLastHole = currentHole; botHoleStrokes = 0;
    }

    if (state === STATE_COMPLETE) {
      botCompleteT++;
      if (botCompleteT > 120) {                 // hold the recap ~2s at 1x so it's readable
        botCompleteT = 0; stats.runs++;
        if (stats.runs >= RG.bot._runsTarget) { RG.bot.stop(); return; }
        // The whole-game tour: Moon recap -> home to Earth; an Earth recap reached with a
        // whole ship (the ninth was sunk before the wreck) -> up to the Moon; otherwise a
        // fresh run on the current world.
        if (RG.course === 'moon' && RG.returnToEarth) RG.returnToEarth();
        else if (RG.course === 'earth-course' && window.RG_SHIP && RG_SHIP.complete() && RG.launchToMoon) RG.launchToMoon();
        else if (RG.beginNewRun) RG.beginNewRun();
        botLastHole = -1; botHoleStrokes = 0;
      }
      return;
    }

    if (state === STATE_AIM && ball.atRest) {
      if (botHoleStrokes >= STUCK) {           // can't sink this hole — flag it and halt for inspection
        stats.stuckHole = { hole: currentHole + 1, ballX: Math.round(ball.x), shots: botHoleStrokes };
        RG.bot.stop();
        return;
      }
      botShot = calculateShot();
      if (!botShot) return;
      if (typeof showTitle !== 'undefined' && showTitle) showTitle = false;
      ball.vx = botShot.vx; ball.vy = botShot.vy;
      ball.atRest = false; ball.onGround = false; ball.slowFrames = 0; ball.spinRate = 0;
      state = STATE_FLIGHT; strokes++; stats.shots++; botHoleStrokes++;
      if (typeof _logBall === 'function') _logBall('shot');
    }
  };

  // The on-screen tell while autoplay is live (and how to leave it) — hidden otherwise.
  function badge(on) {
    var el = document.getElementById('rg-auto');
    if (!el) {
      el = document.createElement('div'); el.id = 'rg-auto';
      el.style.cssText = 'position:fixed;right:12px;bottom:10px;z-index:9989;pointer-events:none;'
        + 'font:11px/1 "Departure Mono",monospace;color:rgba(242,236,255,0.6);'
        + 'background:rgba(14,11,18,0.65);border:1px solid rgba(242,236,255,0.18);'
        + 'border-radius:7px;padding:5px 9px;';
      document.body.appendChild(el);
    }
    el.textContent = '▶ AUTO — press A to stop';
    el.style.display = on ? 'block' : 'none';
  }

  RG.bot = {
    _runsTarget: 1,
    start: function (opts) {
      opts = opts || {};
      this._runsTarget = opts.runs || 1;
      window.aiSpeed = opts.speed || 12;
      window.RG_BOT_STEPS = opts.steps || null;
      resetStats();
      window.aiEnabled = true;
      badge(true);
      if (typeof ensureGameLoop === 'function') ensureGameLoop();
      return 'bot: playing ' + this._runsTarget + ' run(s) @ ' + aiSpeed + 'x';
    },
    stop: function () { window.aiEnabled = false; badge(false); return 'bot: stopped'; },
    stats: function () {
      return Object.assign({
        on: !!aiEnabled,
        hole: (typeof currentHole !== 'undefined') ? currentHole + 1 : null,
        state: state,
        starsDone: (window.RG) ? RG._starsDone : null,
      }, stats);
    },
    simulateShot: simulateShot,
    calculateShot: calculateShot,
  };

  // A toggles autoplay anywhere (loops run after run until pressed again, or a hole sticks).
  window.addEventListener('keydown', function (e) {
    if (/INPUT|TEXTAREA/.test((e.target && e.target.tagName) || '')) return;
    if (e.key === 'a' || e.key === 'A') {
      if (window.aiEnabled) RG.bot.stop();
      else RG.bot.start({ runs: Infinity, speed: 1 });
    }
  });
})();
