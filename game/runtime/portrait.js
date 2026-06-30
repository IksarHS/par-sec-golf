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

  // Clearly distinguish the two builds at a glance (browser tab / window title). The landscape PC build
  // keeps devbuild.html's static "Par Sec"; this mobile-portrait build relabels to "Par Sec Mobile".
  try { document.title = 'Par Sec Mobile'; } catch (e) {}

  window.RG_PORTRAIT = {
    active: true,
    safeTopCss: 0,
    cssToGame: 1,
    // Game-unit top inset for the canvas-drawn HUD: the realised notch/status-bar inset (floored so it
    // clears a phone status bar even when the PWA reports 0) + a small breathing gap, converted CSS→game.
    // Read by _drawScoreHUD (run.js) and the portrait title (desert-golfing.js) so the HUD sits below the
    // notch instead of jammed under it. ~0 contribution in landscape (this object only exists under ?portrait).
    hudTopInset: function () {
      var css = Math.max(this.safeTopCss || 0, 28);   // floor: ~status-bar height even when inset reads 0
      return (css + 8) * (this.cssToGame || 1) + 6;    // + small gap, converted to game units
    },
    // The portrait HUD is scaled DOWN to phone size: landscape draws it at 28/20px, which is huge on a
    // ~250-game-unit-wide phone frame. ~0.62 brings "HOLE 1 / 5" down to a tidy phone readout.
    hudScale: 0.62,
    // Earth's (and other authored intro bodies') holes carry BAKED tee→cup distances (~185-205) that the
    // procedural _holeDistCap can't shrink — wider than the narrow phone W (~250). So zoom the world OUT a
    // touch in portrait: at z=0.78 the visible world is W/0.78 (~320) wide — enough to frame the WHOLE hole
    // (ball + cup + flag) with margins. The portrait camera math (desert-golfing.js) is zoom-aware. Read by
    // wrap.js applyCameraTransform (RG._zoom); pivot is set on the canvas centre. Inert in landscape.
    zoom: 0.78,
  };
  window.RG_PORTRAIT_ZOOM = window.RG_PORTRAIT.zoom;   // convenience flag the camera math reads directly

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
  // W on a real phone (logical width ~390-430px) comes out ~250 game units — NARROWER than the ~304 these
  // numbers originally assumed, so the old 170-220 holes (cap 230) were as wide as the frame: the ball/tee
  // got clipped at the left while the cup sat off the right. Squeeze the snack hole to ~120-160 so the
  // WHOLE hole (ball at ~30% in + cup with a right margin) reads inside W~250 with comfortable padding.
  var SNACK = {
    holeDistMin: 120,    // was ~440 — fits the narrow W~250 with the ball anchored ~30% in
    holeDistMax: 160,    // was ~760 — cap so tee→cup span < W minus both margins (ball + flag both in frame)
    holeCount: 5,        // was 9 — a body is a 5-hole snack
  };
  var PORTRAIT_BALL_RADIUS = 6;   // was 4 — bigger, friendlier, reads on a phone
  var PORTRAIT_HOLE_DIST_CAP = 165; // inert RG._holeDistCap: hole never wider than ~the snack max → always framed
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
      // Zoom the world OUT so the WHOLE authored hole fits the narrow phone frame (authored intro bodies
      // carry baked tee→cup distances the _holeDistCap can't shrink). startRun RESETS RG._zoom to 1, so we
      // assert it AFTER baseStart. The portrait camera math (desert-golfing.js) frames the zoomed viewport,
      // and setHoleCamera (re-)runs after this on the first hole. Pivot is the canvas centre.
      window.RG._zoom = window.RG_PORTRAIT.zoom;
      window.RG._zoomPivot = { x: W / 2, y: H / 2 };
      // Re-frame the first hole now that zoom is active (baseStart framed it at z=1).
      if (typeof holes !== 'undefined' && typeof currentHole !== 'undefined' && holes[currentHole]
          && typeof setHoleCamera === 'function') { try { setHoleCamera(holes[currentHole]); } catch (e) {} }
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
      '  height:min(100svh, calc((100vw - env(safe-area-inset-left) - env(safe-area-inset-right)) * 19.5 / 9));',
      '  width:calc(var(--ph,0px) * 9 / 19.5);',
      '  max-width:100vw;max-height:100svh;',
      '  border-radius:18px;box-shadow:0 0 0 2px rgba(255,255,255,0.04),0 24px 60px rgba(0,0,0,0.6);}',
      // HUD: top-of-frame, clear of a notch via safe-area inset; centred-ish for a thumb-held phone.
      '#rg-hud{top:calc(env(safe-area-inset-top,0px) + 14px) !important;left:50% !important;',
      '  transform:translateX(-50%);align-items:center !important;text-align:center;}',
      // MAP chip: anchor to the TOP-RIGHT of the centred phone frame (not the desktop viewport corner),
      // give it a real ~44px tap target (padding), and inset from the edge + safe area.
      '#rg-map-chip{top:calc(50% - (var(--ph,0px) / 2) + env(safe-area-inset-top,0px) + 10px) !important;',
      '  right:calc(50% - (var(--ph,0px) * 9 / 39) + 18px) !important;',
      '  font-size:12px !important;padding:9px 11px;margin:-9px -11px;border-radius:8px;}',
    ].join('');
    document.head.appendChild(style);
    // --ph carries the realised pixel height so width can be derived as height*9/16 (CSS can't read its
    // own computed height for a sibling property). Recompute on resize.
    // Probe the real safe-area-inset-top (notch / status bar). Headless + most desktops report 0, so we
    // floor it to a sensible status-bar height in portrait — the canvas-drawn HUD reads this (converted to
    // game units) to sit BELOW the notch instead of jammed under it (the real-device symptom).
    var insetProbe = document.createElement('div');
    insetProbe.style.cssText = 'position:fixed;top:0;left:0;width:0;height:env(safe-area-inset-top,0px);'
      + 'pointer-events:none;visibility:hidden;';
    document.body && document.body.appendChild(insetProbe);
    function syncFrame() {
      var vh = window.innerHeight;
      var vw = window.innerWidth;
      var h = Math.min(vh, (vw) * 19.5 / 9);
      document.documentElement.style.setProperty('--ph', h + 'px');
      // Realised safe-area-inset-top in CSS px (0 on desktop/headless). The HUD floors this so it always
      // clears a phone status bar even where the inset reads 0 (PWA standalone sometimes reports 0).
      var insetCss = (insetProbe && insetProbe.getBoundingClientRect().height) || 0;
      window.RG_PORTRAIT.safeTopCss = insetCss;
      // Game units per CSS px = H / realised-canvas-height. The canvas CSS height == min(vh, frame), and
      // the HUD is drawn in game units (H tall), so multiply by H/cssHeight to convert. cssHeight ~= h.
      window.RG_PORTRAIT.cssToGame = (typeof H !== 'undefined' && h) ? (H / h) : 1;
      if (typeof resizeDisplay === 'function') resizeDisplay();
      // FIT-TO-CONTENT re-frame on resize: the portrait camera is framed ONCE per hole against the live W
      // (W is derived from the canvas aspect by resizeDisplay). A viewport/orientation change (or a desktop
      // window resize in the phone-preview) changes W, leaving the static framing stale — the hole drifts
      // off-frame. Re-run setHoleCamera so the fit-zoom + vertical pan recompute for the new W. Gated on the
      // portrait capture flag + only while resting (not mid-shot), so it never fights the static shot frame.
      if (window.RG && RG._portraitCapture && typeof holes !== 'undefined' && typeof currentHole !== 'undefined'
          && holes[currentHole] && typeof setHoleCamera === 'function'
          && !(typeof state !== 'undefined' && (state === STATE_FLIGHT || state === STATE_OOB))) {
        try { setHoleCamera(holes[currentHole]); } catch (e) {}
      }
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
