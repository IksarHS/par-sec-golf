// ── portrait.js — MOBILE PORTRAIT MODE (additive + gated, peel-off-able) ─────────────────────────────
// A feel-out build of Par Sec for a PHONE held in PORTRAIT (9:16). Loaded + active ONLY under ?portrait.
// With the flag absent this file installs NOTHING (one early return), so the landscape game is byte-for-
// byte untouched. Peel = delete this file + its <script> tag + the ?portrait branch in the boot override.
//
// WHAT IT DOES (all gated behind ?portrait):
//   1. CANVAS FRAME — letterboxes the canvas to a 9:16 portrait box centred on screen, devicePixelRatio-
//      aware, safe-area-inset aware. The engine ALREADY derives W from the canvas aspect (art.js: H=540
//      fixed, W = vw*dpr/displayScale), so a portrait box just yields a narrow W (~304) + tall H=540 with
//      ZERO core math changes. We only constrain the CSS box; resizeDisplay() does the rest.
//   2. SNACKABLE HOLES — wraps RG.startRun to retune the live course for the narrow frame: shorter
//      tee→cup distance (fits ~1 portrait screen), fewer holes per body, vertical camera ON for arc
//      headroom, and the inert RG._holeDistCap hook capped so no hole stretches off-screen.
//   3. FORGIVING BALL — bumps BALL_RADIUS (bigger, reads better on a phone) and widens cup capture via
//      the gated RG._portraitCapture flag (read by a one-line guard in desert-golfing.js isBallInCup).
//   4. 3-PLANET ON-RAMP — overrides SOLAR_ITINERARY to Earth → 2 colourful intro bodies, reusing the
//      REAL planet→planet travel flow (wrap.js advances via SOLAR_ITINERARY.indexOf(course)+1).
//   5. HUD — repositions the DOM hole readout for the tall frame (status up top, clear of a notch).
(function () {
  if (typeof location === 'undefined' || !/[?&]portrait(?:=|&|$)/.test(location.search)) return;  // GATE
  if (typeof window === 'undefined') return;

  window.RG_PORTRAIT = { active: true };

  // ── 1. PORTRAIT ITINERARY ──────────────────────────────────────────────────────────────────────────
  // Earth (home, gentle green) → Kepler-90b · Verdshoal (jade sea, gentle) → Proxima d · Dawnglass (coral
  // dunes, the gentlest body in the game, diff 0.2). All low-drama + colourful — a new player's first
  // session. The travel flow reads SOLAR_ITINERARY.indexOf(RG.course)+1, so this 3-slot array just works:
  // earth→kepler90b→proxima_d, and proxima_d (last) finishes to the recap. (same mechanism as ?loop2.)
  var ITIN_WANT = ['earth', 'kepler90b', 'proxima_d'];
  // Returns true once the 3-body tour is installed. If the courses aren't registered yet, it leaves
  // SOLAR_ITINERARY ALONE (never degrades to ['earth']) so a too-early call does no harm — the persistent
  // watcher re-runs until the bodies exist and the full tour resolves.
  function applyItinerary() {
    // WORLDS is a top-level `const` (shared.js) → a lexical global, NOT a window property. Reach it by
    // bare name (same scope chain), guarded by typeof so a peel/load-order slip can't throw.
    var courses = (typeof WORLDS !== 'undefined' && WORLDS['run-world'] && WORLDS['run-world'].courses) || {};
    var have = ITIN_WANT.filter(function (id) { return courses[id]; });   // exclude peeled bodies
    if (have.length < 2) return false;                                    // not ready — don't touch it
    var cur = window.SOLAR_ITINERARY || [];
    if (cur.length !== have.length || cur.some(function (id, i) { return id !== have[i]; })) {
      window.SOLAR_ITINERARY = have;
    }
    return true;
  }

  // ── 2+3. PORTRAIT COURSE RETUNE + FORGIVING BALL ─────────────────────────────────────────────────────
  // Mobile-snackable numbers, applied to whatever body startRun is about to build. Tee→cup is squeezed to
  // roughly fit the narrow portrait W (~300 game-px wide visible) so a hole READS in about one screen, with
  // a little vertical play; holeCount is trimmed so a body is a quick session.
  var SNACK = {
    holeDistMin: 170,    // was ~440 — fits the narrow frame with comfortable side padding (W~304)
    holeDistMax: 220,    // was ~760 — cap below W so the flag is ALWAYS in frame at the tee
    holeCount: 5,        // was 9 — a body is a 5-hole snack
  };
  var PORTRAIT_BALL_RADIUS = 6;   // was 4 — bigger, friendlier, reads on a phone
  var PORTRAIT_HOLE_DIST_CAP = 230; // inert RG._holeDistCap: hole never wider than ~75% of W → margins both sides
  var PORTRAIT_CAPTURE = 1.7;     // cup-capture X half-width multiplier (read by isBallInCup guard)

  // Retune a built course object IN PLACE (called on whatever _buildCourse returns, so it lands no matter
  // what the template cache held). Mutating the returned clone is safe — it's what startRun installs.
  function retuneCourse(c) {
    if (!c) return c;
    c.holeDistMin = SNACK.holeDistMin;
    c.holeDistMax = SNACK.holeDistMax;
    c.holeCount = SNACK.holeCount;
    c.verticalCam = true;          // tall frame: pan up so arcs have headroom (opt-in, already supported)
    return c;
  }

  // Wrap _buildCourse so the course object startRun consumes is ALWAYS retuned — bypasses the template
  // cache entirely (the boot may have cached the un-retuned template first).
  function installBuildWrap() {
    if (!window.RG || !RG._buildCourse || RG._portraitBuildWrapped) return false;
    RG._portraitBuildWrapped = true;
    var baseBuild = RG._buildCourse.bind(RG);
    RG._buildCourse = function (courseId) { return retuneCourse(baseBuild(courseId)); };
    return true;
  }

  // Wrap startRun: retune the course config BEFORE the engine reads it, then assert the portrait feel
  // hooks AFTER (startRun resets RG._zoom etc. and rebuilds the course from the live config).
  function installStartRunWrap() {
    if (!window.RG || !RG.startRun || RG._portraitWrapped) return false;
    RG._portraitWrapped = true;
    var baseStart = RG.startRun.bind(RG);
    RG.startRun = function (opts) {
      opts = opts || {};
      applyItinerary();              // courses are registered by now → the 3-body tour resolves cleanly
      // forgiving ball + capture (BALL_RADIUS is a mutable `let` global; the flag is read by the
      // gated guard in desert-golfing.js isBallInCup — both inert unless ?portrait set them).
      if (typeof BALL_RADIUS !== 'undefined') { try { BALL_RADIUS = PORTRAIT_BALL_RADIUS; } catch (e) {} }
      window.RG._portraitCapture = PORTRAIT_CAPTURE;
      // Set the one-screen distance cap BEFORE baseStart — the holes are generated INSIDE startRun
      // (ensureHolesAhead), and level-design reads RG._holeDistCap at generation time. Setting it after
      // would miss the first generation, letting a hole span the full width (flag clipped at the edge).
      window.RG._holeDistCap = PORTRAIT_HOLE_DIST_CAP;
      var r = baseStart(opts);
      window.RG._holeDistCap = PORTRAIT_HOLE_DIST_CAP;   // re-assert (defensive)
      return r;
    };
    return true;
  }

  // ── 1. PORTRAIT CANVAS FRAME (CSS) ───────────────────────────────────────────────────────────────────
  // Constrain the canvas to a 9:16 box centred in the viewport. On a real phone the viewport IS ~9:16, so
  // the box just fills it; on desktop it letterboxes to a phone-shaped frame so we can feel the real thing.
  // resizeDisplay() (art.js) reads the canvas CSS box → sets canvas.width/height (dpr-aware) → derives W.
  function applyPortraitCSS() {
    var style = document.createElement('style');
    style.id = 'portrait-css';
    style.textContent = [
      'html,body{background:#05060a;}',
      // the phone frame: 9:16, as tall as the viewport allows (minus safe-area insets), centred.
      '#c{position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);',
      '  height:min(100svh, calc((100vw - env(safe-area-inset-left) - env(safe-area-inset-right)) * 16 / 9));',
      '  width:calc(var(--ph,0px) * 9 / 16);',
      '  max-width:100vw;max-height:100svh;',
      '  border-radius:18px;box-shadow:0 0 0 2px rgba(255,255,255,0.04),0 24px 60px rgba(0,0,0,0.6);}',
      // HUD: top-of-frame, clear of a notch via safe-area inset; centred-ish for a thumb-held phone.
      '#rg-hud{top:calc(env(safe-area-inset-top,0px) + 14px) !important;left:50% !important;',
      '  transform:translateX(-50%);align-items:center !important;text-align:center;}',
      // MAP chip: anchor to the TOP-RIGHT of the centred phone frame (not the desktop viewport corner),
      // give it a real ~44px tap target (padding), and inset from the edge + safe area.
      '#rg-map-chip{top:calc(50% - (var(--ph,0px) / 2) + env(safe-area-inset-top,0px) + 10px) !important;',
      '  right:calc(50% - (var(--ph,0px) * 9 / 32) + 8px) !important;',
      '  font-size:12px !important;padding:9px 11px;margin:-9px -11px;border-radius:8px;}',
    ].join('');
    document.head.appendChild(style);
    // --ph carries the realised pixel height so width can be derived as height*9/16 (CSS can't read its
    // own computed height for a sibling property). Recompute on resize.
    function syncFrame() {
      var vh = window.innerHeight;
      var vw = window.innerWidth;
      var h = Math.min(vh, (vw) * 16 / 9);
      document.documentElement.style.setProperty('--ph', h + 'px');
      if (typeof resizeDisplay === 'function') resizeDisplay();
    }
    window.addEventListener('resize', syncFrame);
    // also re-sync after the engine's own resize listener so W is recomputed from the real box.
    syncFrame();
    setTimeout(syncFrame, 60);
    setTimeout(syncFrame, 300);
  }

  // ── BOOT ─────────────────────────────────────────────────────────────────────────────────────────────
  applyPortraitCSS();
  // Persistent itinerary watcher: planet-gen registers courses + reassigns SOLAR_ITINERARY at various
  // points during boot, so re-assert the 3-body tour until it's stably installed (and a few beats after).
  (function watchItin(n) {
    window.RG_PORTRAIT._itinTicks = n;
    window.RG_PORTRAIT._itinDone = applyItinerary();
    if (n < 300) setTimeout(function () { watchItin(n + 1); }, 60);   // ~18s of vigilance, cheap no-op once stable
  })(0);
  // The itinerary + startRun wrap must be in place before the boot override fires startRun('earth').
  // run.js/portrait.js load before main.js, but RG + SOLAR_ITINERARY exist by the time the boot override
  // polls. Install eagerly, and retry briefly until RG.startRun exists (mirrors the boot poll).
  (function tryInstall(n) {
    var a = installStartRunWrap(), b = installBuildWrap();
    var ok = (a || (window.RG && RG._portraitWrapped)) && (b || (window.RG && RG._portraitBuildWrapped));
    applyItinerary();
    // keep retrying until BOTH the wraps are in AND the multi-body itinerary has resolved (courses
    // registered). Early calls fall back to ['earth']; this re-runs applyItinerary once they exist.
    var itinReady = window.SOLAR_ITINERARY && window.SOLAR_ITINERARY.length >= 2;
    if ((!ok || !itinReady) && n < 240) { setTimeout(function () { tryInstall(n + 1); }, 50); return; }
    // If the boot already started a run through the ORIGINAL (un-wrapped) startRun, restart it ONCE
    // through the wrapped one so the portrait retune (short holes, count, vertical cam) takes effect.
    if (ok && !window.RG._portraitBooted) {
      (function awaitActive(m) {
        if (window.RG && RG.active && RG.course) {
          window.RG._portraitBooted = true;
          RG.startRun({ course: RG.course, seed: RG.seed });   // re-run the SAME body, now retuned
        } else if (m < 240) setTimeout(function () { awaitActive(m + 1); }, 50);
      })(0);
    }
  })(0);
})();
