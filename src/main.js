// ── Game Loop ──────────────────────────────────────────────

// Game-only flag: overlay editor-saved hole edits on top of the procedural
// terrain. The editor doesn't load main.js, so it keeps applying its own
// overlay and never double-applies.
window.HOLE_OVERRIDES_ENABLED = true;

let _gameLoopRunning = false;
let _backgroundInterval = null;

// ── Fixed-timestep accumulator ──────────────────────────────
// The physics advances a FIXED amount per update() (frame-coupled by design, so a seed reproduces
// exactly and the bot's shot-sim stays deterministic). Driving update() straight off the display
// refresh therefore (a) turns any dropped/long frame into a visible motion PAUSE — the ball covers
// one step over 2x the real time — and (b) runs the sim ~2.4x fast on a 144Hz monitor. Decouple
// them: accumulate real elapsed time and run as many fixed 60Hz steps as it covers (capped, so a
// long stall can't spiral). Each STEP is byte-identical to before, so determinism, the audit, and
// simulateShot (its own update() loop) are all untouched — only the *cadence* of update() changes.
const SIM_STEP_MS = 1000 / 60;     // the rate the physics was tuned at
const SIM_MAX_STEPS = 5;           // catch-up cap per rendered frame (no spiral-of-death)
let _simAccumMs = 0;
let _lastFrameT = 0;

function gameLoop(ts) {
  _ballLogFrame++;
  // If autoplay is active, run AI + extra physics steps for speed (deliberate fast-forward) —
  // bypass the accumulator so the bot still flies at its multiplier.
  if (typeof aiEnabled !== 'undefined' && aiEnabled) {
    const steps = typeof aiSpeed !== 'undefined' ? aiSpeed : 1;
    for (let i = 0; i < steps; i++) {
      if (typeof aiUpdate === 'function') aiUpdate();
      update();
    }
    _simAccumMs = 0; _lastFrameT = 0;   // so the first real-play frame after autoplay doesn't dump a backlog
  } else {
    const now = (typeof ts === 'number') ? ts : performance.now();
    if (!_lastFrameT) _lastFrameT = now;
    let frameMs = now - _lastFrameT;
    _lastFrameT = now;
    if (frameMs > 250) frameMs = SIM_STEP_MS;   // after a long stall (e.g. tab was hidden) take one step, not a flood
    // When the display runs AT/NEAR the sim rate (the common 60Hz case), run EXACTLY one step per
    // frame. This is the key to a smooth pan: a bare accumulator lets a tiny frame-time drift land an
    // occasional 0- or 2-step frame, which reads as a hitch in a moving camera even at a locked 60fps
    // (the frame timing is perfect, only the step COUNT jitters — so a frame-time meter never sees it).
    // Only a frame that's clearly OFF the sim rate uses the accumulator: a high-refresh monitor (short
    // frames, rate-limit to ~60Hz) or a genuinely dropped/long frame (catch up so motion doesn't pause).
    let steps;
    if (frameMs >= SIM_STEP_MS * 0.75 && frameMs <= SIM_STEP_MS * 1.5) {
      steps = 1; _simAccumMs = 0;
    } else {
      _simAccumMs += frameMs;
      steps = 0;
      while (_simAccumMs >= SIM_STEP_MS && steps < SIM_MAX_STEPS) { _simAccumMs -= SIM_STEP_MS; steps++; }
      if (steps >= SIM_MAX_STEPS) _simAccumMs = 0;  // hit the cap — drop the backlog
    }
    for (let i = 0; i < steps; i++) update();
  }
  draw();
  window._gameLoopRAF = requestAnimationFrame(gameLoop);
}

// When tab is hidden, RAF is suspended. Use setInterval as fallback
// so autoplay keeps running in the background (important for idle mode).
// Chrome throttles setInterval to ~1s for hidden tabs, so we run many
// steps per tick to compensate.
function _startBackgroundLoop() {
  if (_backgroundInterval) return;
  _backgroundInterval = setInterval(() => {
    if (typeof aiEnabled === 'undefined' || !aiEnabled) return;
    _ballLogFrame++;
    // Run ~60 steps per tick to compensate for 1s throttling
    const stepsPerTick = 60 * (typeof aiSpeed !== 'undefined' ? aiSpeed : 1);
    for (let i = 0; i < stepsPerTick; i++) {
      if (typeof aiUpdate === 'function') aiUpdate();
      update();
    }
  }, 100); // Request 100ms, Chrome may throttle to 1s
}

function _stopBackgroundLoop() {
  if (_backgroundInterval) {
    clearInterval(_backgroundInterval);
    _backgroundInterval = null;
  }
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden' && _gameLoopRunning) {
    _startBackgroundLoop();
  } else {
    _stopBackgroundLoop();
  }
});

function ensureGameLoop() {
  if (_gameLoopRunning) return;
  _gameLoopRunning = true;
  // If tab is already hidden (e.g. opened in background), start background loop
  if (document.visibilityState === 'hidden') {
    _startBackgroundLoop();
  }
  gameLoop(); // RAF will fire once tab becomes visible
}

// ── Shared Seed ────────────────────────────────────────────
// The default seed ensures every player gets the same holes.
// Stored in localStorage so it persists across refreshes.
// Only changes if explicitly set via setSeed() or the editor.
const DEFAULT_GAME_SEED = 42;

function initSeed() {
  const stored = localStorage.getItem('dg-seed');
  if (stored !== null) {
    setSeed(parseInt(stored, 10));
  } else {
    setSeed(DEFAULT_GAME_SEED);
    localStorage.setItem('dg-seed', String(DEFAULT_GAME_SEED));
  }
}

// ── Unified Game Reset ────────────────────────────────────
// THE SINGLE ENTRY POINT for starting or restarting the game.
// All code paths (sign-in, sign-out, refresh, first load) call this.
// This ensures startCourse() is called exactly ONCE per reset,
// keeping the PRNG deterministic.
//
// @param {string} worldId - world to load (default: 'desert-world-1')
// @param {string} courseId - course to load (default: 'desert-course-1')
// @param {object|null} progress - saved player progress to restore, or null for fresh start
function resetGame(worldId, courseId, progress) {
  // Reset PRNG to exact base seed before anything else
  setSeed(DEFAULT_GAME_SEED);
  localStorage.setItem('dg-seed', String(DEFAULT_GAME_SEED));
  startCourse(worldId || 'desert-world-1', courseId || 'desert-course-1');

  if (progress) {
    const resumeHole = progress.currentHole || 0;
    const hasProgress = resumeHole > 0 || (progress.ballState && progress.ballState.x) || (progress.strokes > 0);

    if (hasProgress) {
      const maxHoles = currentCourse?.holeCount ?? Infinity;

      // If saved hole is past the course end, player already completed it
      if (resumeHole >= maxHoles) {
        // Show completion screen for the last hole
        ensureHolesAhead(maxHoles - 1);
        for (let i = 0; i < maxHoles; i++) {
          holes[i].cupFilled = true;
          holes[i].cupFillProgress = 1;
          holes[i].flagVisible = false;
          holes[i].flagOpacity = 0;
          flattenCup(holes[i]);
        }
        currentHole = maxHoles;
        totalStrokes = progress.totalStrokes || 0;
        courseComplete = true;
        state = STATE_COMPLETE;
        completeTimer = 60; // skip fade-in
        setHoleCamera(holes[maxHoles - 1]);
        return;
      }

      ensureHolesAhead(resumeHole + 2);
      for (let i = 0; i < resumeHole; i++) {
        holes[i].cupFilled = true;
        holes[i].cupFillProgress = 1;
        holes[i].flagVisible = false;
        holes[i].flagOpacity = 0;
        flattenCup(holes[i]);
      }
      currentHole = resumeHole;
      totalStrokes = progress.totalStrokes || 0;
      strokes = progress.strokes || 0;
      if (resumeHole > 0 || strokes > 0) showTitle = false;

      if (progress.ballState && progress.ballState.x) {
        const bs = progress.ballState;
        ball.x = bs.x; ball.y = bs.y;
        // Always restore at rest — we only save on rest
        ball.vx = 0; ball.vy = 0;
        ball.onGround = true;
        ball.atRest = true;
        ball.spinRate = 0;
        ball.rotation = bs.rotation || 0;
        state = STATE_AIM;
        setHoleCamera(holes[currentHole]);
      } else {
        // Cross-device resume: restart hole from tee, strokes already charged
        const hole = holes[currentHole];
        ball.x = hole.teeX;
        ball.y = terrainYAt(hole.teeX) - BALL_RADIUS;
        ball.vx = 0; ball.vy = 0;
        ball.atRest = true; ball.onGround = false;
        setHoleCamera(hole);
        state = STATE_AIM;
      }
    }
  }
}

// ── Reveal UI ─────────────────────────────────────────────
function revealGame() {
  const loading = document.getElementById('loading');
  if (loading) loading.style.display = 'none';
  if (typeof canvas !== 'undefined') canvas.style.visibility = 'visible';
  const authUI = document.getElementById('auth-ui');
  if (authUI) authUI.style.display = 'block';
}

// ── Init ───────────────────────────────────────────────────
function init() {
  if (typeof initFirebase === 'function') {
    initFirebase(); // onAuthStateChanged will call resetGame + revealGame + ensureGameLoop
  } else {
    // No Firebase — start immediately
    resetGame();
    revealGame();
    ensureGameLoop();
  }
}

init();
