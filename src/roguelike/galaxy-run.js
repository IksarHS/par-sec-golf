// ── galaxy-run.js — the GALAXY RUN roguelike layer (peel-off-able, gated to ?rogue) ──
//
// Adds a roguelike CORE LOOP on top of the existing PORTRAIT mode (?portrait): a 3-strike,
// par-buffer run across an endless string of 5-hole planets. It is PURE BOOKKEEPING derived
// from the engine's own per-hole strokes/par — it does NOT change how golf is played, the
// camera, the travel, or any base draw. It only:
//   * polls the engine each frame (in its own rAF) to detect a hole completing / a course
//     completing, then applies the strike / par-buffer economy,
//   * paints a small DOM HUD below the notch (pointer-events:none — never blocks a shot),
//   * on game-over paints a tap-to-retry overlay and wires the tap to start a fresh run.
//
// GATED: nothing installs unless the URL has ?rogue (used as ?portrait&rogue). The base game
// (no ?rogue) and portrait-without-rogue are byte-untouched. Peel this file + its <script> tag
// in run.html → gone.
//
// Integration hooks used (all READ, none mutated):
//   * RG.holeScores[i]  — strokes taken on completed hole i (set by RG.recordHole in wrap.js
//                         onTransitionStart, the moment currentHole advances).
//   * RG.holePars[i]    — par for hole i (set when the course is built in startRun).
//   * currentHole       — global; increments per completed hole (desert-golfing.js onTransitionStart).
//   * RG.course         — the active planet id; changes when travel lands on the next body.
//   * RG.holeCount      — holes per course (5 in portrait).
//   * RG.startRun({course, seed}) + RG.rollSeed() — to start a fresh run on retry.
//   * window.SOLAR_ITINERARY[0] — the first portrait planet to (re)start from.
//
// Economy (locked design):
//   3 strikes. overall = cumulative (strokes-par) since the last strike, starting at 0.
//   After each hole: overall += (holeStrokes - holePar). If overall > 0 → lose a strike AND
//   reset overall to 0. strikes==0 → GAME OVER. Money at course-complete: +5 + 2*max(0, under-par).
//   Score = planetsCleared + holesCleared.
//
(function () {
  'use strict';
  // ── GATE ──────────────────────────────────────────────────────────────────────────────────
  if (typeof location === 'undefined' || !/[?&]rogue\b/.test(location.search)) return;
  if (typeof document === 'undefined') return;

  // ── STATE (structured so a shop + a `bag` of balls slot in next slice; bag unused for now) ──
  var RUN = {
    strikes: 3,
    overall: 0,            // banked par buffer since last strike; <=0 = cushion, >0 spends a strike
    money: 0,
    planetsCleared: 0,
    holesCleared: 0,
    gameOver: false,
    courseStartStrokes: 0, // totalStrokes at the start of the current course (for course under-par)
    lastHole: 0,           // last currentHole we processed (to detect a hole advancing)
    lastCourse: null,      // last RG.course we saw (to detect travel to a new planet)
    bag: ['normal'],       // PLACEHOLDER for the next slice (shop + special balls); unused now
    _booted: false,        // becomes true once we've latched onto a live run
  };
  window.__rogue = RUN;    // headless verification handle

  // ── safe reads — never throw on a missing/early global ──
  function g(fn, fb) { try { var v = fn(); return (v == null) ? fb : v; } catch (e) { return fb; } }
  function curHole()   { return g(function () { return currentHole; }, 0); }
  function curCourse() { return g(function () { return RG.course; }, null); }
  function holeCount() { return g(function () { return RG.holeCount; }, 5) || 5; }

  // ── THE RULE — apply one finished hole's (strokes - par) to the run. Pure: mutates RUN only.
  // Returns true if this hole spent a strike. Logs a verifiable trace line.
  function applyHole(strokes, par) {
    if (RUN.gameOver) return false;
    var delta = strokes - par;
    RUN.overall += delta;
    var spentStrike = false;
    if (RUN.overall > 0) {
      RUN.strikes -= 1;
      RUN.overall = 0;       // reset the buffer when a strike is spent
      spentStrike = true;
      if (RUN.strikes <= 0) {
        RUN.strikes = 0;
        RUN.gameOver = true;
      }
    }
    RUN.holesCleared += 1;
    try {
      console.log('[rogue] hole done: ' + (delta >= 0 ? '+' : '') + delta +
        ' (' + strokes + ' vs par ' + par + ') -> overall ' + RUN.overall +
        ', strikes ' + RUN.strikes + (spentStrike ? ' [STRIKE]' : '') +
        (RUN.gameOver ? ' [GAME OVER]' : ''));
    } catch (e) {}
    return spentStrike;
  }
  RUN._applyHole = applyHole;   // exposed for the headless unit-check

  // ── money at course-complete: +5 base + 2 per stroke under par across the 5 holes ──
  function awardCourseMoney(courseStrokes, coursePar) {
    var under = Math.max(0, coursePar - courseStrokes);
    var pay = 5 + 2 * under;
    RUN.money += pay;
    return pay;
  }

  // Sum par over the holes of the current course (RG.holePars is per-course, rebuilt each startRun).
  function coursePar() {
    var pars = g(function () { return RG.holePars; }, null);
    if (!pars || !pars.length) return 0;
    var n = holeCount(), s = 0;
    for (var i = 0; i < n && i < pars.length; i++) s += (pars[i] || 0);
    return s;
  }

  // ── reset to a fresh run + restart the engine from the first portrait planet ──
  function startFreshRun() {
    RUN.strikes = 3; RUN.overall = 0; RUN.money = 0;
    RUN.planetsCleared = 0; RUN.holesCleared = 0; RUN.gameOver = false;
    RUN.courseStartStrokes = 0; RUN.lastHole = 0; RUN.lastCourse = null;
    RUN.bag = ['normal'];
    var first = g(function () { return window.SOLAR_ITINERARY && window.SOLAR_ITINERARY[0]; }, 'earth') || 'earth';
    try {
      if (window.RG && RG.startRun) {
        RG.startRun({ course: first, seed: (RG.rollSeed ? RG.rollSeed() : 12345) });
        RUN.lastCourse = curCourse();
        RUN.lastHole = curHole();
      }
    } catch (e) {}
    console.log('[rogue] fresh run started on ' + first);
  }
  RUN.startFreshRun = startFreshRun;

  // ── PER-FRAME POLL ──────────────────────────────────────────────────────────────────────────
  // Detect (a) a hole completing — currentHole advanced — and (b) a course completing — RG.course
  // changed (travel landed on the next body). We process exactly the holes that advanced, reading
  // their real strokes/par from RG.holeScores / RG.holePars.
  function poll() {
    if (!(window.RG && RG.active)) return;          // not in a live run yet
    var course = curCourse();
    var hole = curHole();

    // First sighting of a live run → latch baselines, don't replay history.
    if (!RUN._booted) {
      RUN._booted = true;
      RUN.lastCourse = course;
      RUN.lastHole = hole;
      RUN.courseStartStrokes = g(function () { return totalStrokes; }, 0);
      return;
    }
    if (RUN.gameOver) return;                        // progression frozen on game over

    // ── COURSE CHANGED (travel landed on a new planet) ──
    // The hole index resets (new course is built fresh, currentHole back near 0). Award money for
    // the course we just left, bump the planet count, then re-baseline for the new course.
    if (course !== RUN.lastCourse && course != null) {
      // The course we just finished cleared all its holes (we only travel on course-complete).
      var cPar = RUN._lastCoursePar || 0;
      var cStrokes = RUN._lastCourseStrokes || 0;
      if (cPar > 0) {
        var pay = awardCourseMoney(cStrokes, cPar);
        RUN.planetsCleared += 1;
        console.log('[rogue] PLANET CLEAR: course strokes ' + cStrokes + ' vs par ' + cPar +
          ' -> +$' + pay + ' (money $' + RUN.money + '), planets ' + RUN.planetsCleared);
      }
      RUN.lastCourse = course;
      RUN.lastHole = hole;
      RUN.courseStartStrokes = g(function () { return totalStrokes; }, 0);
      RUN._lastCoursePar = 0; RUN._lastCourseStrokes = 0;
      return;
    }

    // ── HOLE(S) ADVANCED within the current course ──
    if (hole > RUN.lastHole) {
      var pars = g(function () { return RG.holePars; }, []);
      var scores = g(function () { return RG.holeScores; }, []);
      for (var i = RUN.lastHole; i < hole && !RUN.gameOver; i++) {
        var par = (pars && pars[i] != null) ? pars[i] : 3;
        var strokes = (scores && scores[i] != null) ? scores[i] : par;   // fallback = even par
        applyHole(strokes, par);
      }
      RUN.lastHole = hole;

      // If this completed the course (cleared all holes), remember its totals so the NEXT poll —
      // when travel has swapped RG.course — can award money against this course's par. We capture
      // here because RG.holePars/holeScores get cleared when the next course is built.
      if (hole >= holeCount()) {
        var cp = coursePar();
        var cs = 0, n = holeCount();
        var sc = g(function () { return RG.holeScores; }, []);
        for (var j = 0; j < n; j++) cs += (sc && sc[j] != null ? sc[j] : 0);
        RUN._lastCoursePar = cp;
        RUN._lastCourseStrokes = cs;
      }
    }
  }

  // ── HUD (DOM overlay; below the notch; pointer-events:none so it never blocks a shot) ──
  var hud = null, over = null;
  function topInsetPx() {
    // Convert the portrait game-unit inset to CSS px so the DOM HUD sits below the notch like the
    // canvas HUD. cssToGame is game-units-per-css-px, so divide. Falls back to a safe 44px.
    var inset = g(function () { return window.RG_PORTRAIT && RG_PORTRAIT.hudTopInset && RG_PORTRAIT.hudTopInset(); }, null);
    var c2g = g(function () { return window.RG_PORTRAIT && RG_PORTRAIT.cssToGame; }, 1) || 1;
    if (inset != null) return Math.round(inset / c2g);
    return 44;
  }

  function makeHud() {
    hud = document.createElement('div');
    hud.id = 'rg-galaxy-hud';
    hud.style.cssText = 'position:fixed;left:0;right:0;z-index:60;pointer-events:none;' +
      'display:flex;flex-direction:column;align-items:center;gap:3px;' +
      "font:13px/1.3 'Departure Mono',monospace;color:#f2ecff;" +
      'text-shadow:0 1px 4px rgba(0,0,0,0.7);';
    (document.body || document.documentElement).appendChild(hud);
  }

  function drawHud() {
    if (!hud) makeHud();
    hud.style.top = (topInsetPx() + 30) + 'px';   // sit just under the engine's "HOLE x / 5" readout
    if (RUN.gameOver) { hud.style.display = 'none'; return; }
    hud.style.display = 'flex';

    // Strikes: 3 pips, lost ones dimmed.
    var pips = '';
    for (var i = 0; i < 3; i++) pips += (i < RUN.strikes ? '◆' : '◇');   // ◆ filled / ◇ empty

    // overall vs par: <=0 reads as banked cushion (green); a hole just pushed it positive reads as a
    // spent strike (but overall is reset to 0 at that moment, so we show the cushion / EVEN state).
    var ov = RUN.overall;
    var ovTxt, ovColor;
    if (ov < 0) { ovTxt = String(ov); ovColor = '#7CFFA0'; }          // e.g. -3, green cushion
    else if (ov === 0) { ovTxt = 'E'; ovColor = 'rgba(242,236,255,0.7)'; }
    else { ovTxt = '+' + ov; ovColor = '#ff9a7c'; }                  // (transient; reset on strike)

    var course = curCourse();
    var planetNo = RUN.planetsCleared + 1;
    var holeNo = Math.min(curHole() + 1, holeCount());

    hud.innerHTML =
      '<div style="display:flex;align-items:center;gap:14px;">' +
        '<span style="font-size:16px;letter-spacing:3px;color:#ff6f6f;">' + pips + '</span>' +
        '<span style="color:' + ovColor + ';">' + ovTxt + '</span>' +
        '<span style="color:#ffd86b;">$' + RUN.money + '</span>' +
      '</div>' +
      '<div style="font-size:11px;color:rgba(242,236,255,0.6);letter-spacing:1px;">' +
        'PLANET ' + planetNo + ' · HOLE ' + holeNo + '/' + holeCount() + '</div>';
  }

  // ── GAME-OVER overlay (full-screen, pointer-events:auto, tap/click to retry) ──
  function makeOver() {
    over = document.createElement('div');
    over.id = 'rg-galaxy-over';
    over.style.cssText = 'position:fixed;inset:0;z-index:9000;display:none;' +
      'flex-direction:column;align-items:center;justify-content:center;gap:14px;' +
      'background:rgba(8,6,14,0.86);cursor:pointer;' +
      "font-family:'Departure Mono',monospace;color:#f2ecff;text-align:center;padding:24px;";
    over.addEventListener('click', onRetry);
    over.addEventListener('touchstart', function (e) { e.preventDefault(); onRetry(); }, { passive: false });
    (document.body || document.documentElement).appendChild(over);
  }
  var _retrying = false;
  function onRetry() {
    if (!RUN.gameOver || _retrying) return;
    _retrying = true;
    if (over) over.style.display = 'none';
    startFreshRun();
    RUN._booted = false;               // re-latch baselines onto the fresh run on the next poll
    setTimeout(function () { _retrying = false; }, 400);
  }

  function drawOver() {
    if (!over) makeOver();
    if (!RUN.gameOver) { if (over.style.display !== 'none') over.style.display = 'none'; return; }
    over.style.display = 'flex';
    var score = RUN.planetsCleared + RUN.holesCleared;
    over.innerHTML =
      '<div style="font-size:30px;letter-spacing:3px;">GAME OVER</div>' +
      '<div style="font-size:15px;color:rgba(242,236,255,0.78);line-height:1.7;">' +
        'Planet ' + (RUN.planetsCleared + 1) + ' · ' + RUN.holesCleared + ' holes' +
        ' · $' + RUN.money + '<br>score ' + score + '</div>' +
      '<div style="font-size:13px;color:#ffd86b;margin-top:6px;">tap to retry</div>';
  }

  // ── DRIVE: own cheap rAF (independent of the game loop) so the HUD + poll run every frame ──
  function tick() {
    try { poll(); drawHud(); drawOver(); } catch (e) { /* never break the page */ }
    requestAnimationFrame(tick);
  }
  // Wait until the body exists, then go.
  function boot() {
    if (!document.body) { return setTimeout(boot, 30); }
    requestAnimationFrame(tick);
    console.log('[rogue] galaxy-run armed (?rogue) — 3 strikes, par-buffer economy');
  }
  boot();
})();
