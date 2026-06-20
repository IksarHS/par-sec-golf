// ── Input System ──────────────────────────────────────────
canvas.addEventListener('mousedown', (e) => {
  // Handle completion screen button clicks
  if (state === STATE_COMPLETE) {
    const rect = canvas.getBoundingClientRect();
    const cx = (e.clientX - rect.left) * (W / rect.width);
    const cy = (e.clientY - rect.top) * (H / rect.height);

    // "Next Course/World" button
    if (_completeBtn) {
      const b = _completeBtn;
      if (cx >= b.x && cx <= b.x + b.w && cy >= b.y && cy <= b.y + b.h) {
        startCourse(b.next.worldId, b.next.courseId);
        return;
      }
    }
    // "Replay Course" button
    if (typeof _replayBtn !== 'undefined' && _replayBtn) {
      const b = _replayBtn;
      if (cx >= b.x && cx <= b.x + b.w && cy >= b.y && cy <= b.y + b.h) {
        const wId = typeof _currentWorldId !== 'undefined' ? _currentWorldId : 'desert-world-1';
        const cId = Object.keys(currentWorld.courses).find(k => currentWorld.courses[k] === currentCourse) || 'desert-course-1';
        startCourse(wId, cId);
        return;
      }
    }
  }
  if (state !== STATE_AIM) return;
  // Long-drive tee meter: a single tap fires the metered drive (RG._meterFire returns true when it
  // handled the shot). Undefined/inert in the base game → normal angle-and-power aim.
  if (typeof window !== 'undefined' && window.RG && RG._meterFire && RG._meterFire()) return;
  const pos = toGameCoords(e.clientX, e.clientY);
  aiming = true;
  aimStartX = pos.x;
  aimStartY = pos.y;
  aimCurrentX = pos.x;
  aimCurrentY = pos.y;
});

window.addEventListener('mousemove', (e) => {
  if (!aiming) return;
  const pos = toGameCoords(e.clientX, e.clientY);
  aimCurrentX = pos.x;
  aimCurrentY = pos.y;
});

window.addEventListener('mouseup', (e) => {
  if (!aiming) return;
  aiming = false;

  const pos = toGameCoords(e.clientX, e.clientY);
  const dx = aimStartX - pos.x;
  const dy = aimStartY - pos.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist < 5) return;
  // Title card clears only on an ACTUAL strike (dist >= 5), not a bare click.
  if (showTitle) showTitle = false;

  const power = Math.min(dist * POWER_SCALE, MAX_POWER);
  const angle = Math.atan2(dy, dx);

  ball.vx = Math.cos(angle) * power;
  ball.vy = Math.sin(angle) * power;
  ball.atRest = false;
  ball.onGround = false;
  ball.slowFrames = 0;
  ball.flightFrames = 0;
  ball.spinRate = 0;  // No forced spin on launch — ground contact drives rotation
  state = STATE_FLIGHT;
  strokes++;
  _logBall('shot');
  // Save locally + push to cloud on every shot
  if (typeof saveGameSnapshot === 'function') saveGameSnapshot();
  if (typeof pushToCloud === 'function') pushToCloud();
});

// Touch support
canvas.addEventListener('touchstart', (e) => {
  e.preventDefault();
  if (state !== STATE_AIM) return;
  if (typeof window !== 'undefined' && window.RG && RG._meterFire && RG._meterFire()) return;   // long-drive tee meter (see mousedown)
  const pos = toGameCoords(e.touches[0].clientX, e.touches[0].clientY);
  aiming = true;
  aimStartX = pos.x;
  aimStartY = pos.y;
  aimCurrentX = pos.x;
  aimCurrentY = pos.y;
});

canvas.addEventListener('touchmove', (e) => {
  e.preventDefault();
  if (!aiming) return;
  const pos = toGameCoords(e.touches[0].clientX, e.touches[0].clientY);
  aimCurrentX = pos.x;
  aimCurrentY = pos.y;
});

canvas.addEventListener('touchend', (e) => {
  e.preventDefault();
  if (!aiming) return;
  aiming = false;

  const dx = aimStartX - aimCurrentX;
  const dy = aimStartY - aimCurrentY;
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist < 5) return;
  // Title card clears only on an ACTUAL strike (dist >= 5), not a bare tap.
  if (showTitle) showTitle = false;

  const power = Math.min(dist * POWER_SCALE, MAX_POWER);
  const angle = Math.atan2(dy, dx);

  ball.vx = Math.cos(angle) * power;
  ball.vy = Math.sin(angle) * power;
  ball.atRest = false;
  ball.onGround = false;
  ball.slowFrames = 0;
  ball.flightFrames = 0;
  ball.spinRate = 0;  // No forced spin on launch — ground contact drives rotation
  state = STATE_FLIGHT;
  strokes++;
  _logBall('shot');
  if (typeof saveGameSnapshot === 'function') saveGameSnapshot();
  if (typeof pushToCloud === 'function') pushToCloud();
});

// ── Physics Update ─────────────────────────────────────────
function updatePhysics() {
  if (ball.atRest) return;

  // 2 substeps for thin-surface safety
  const substeps = 2;
  for (let s = 0; s < substeps; s++) {
    ball.vy += GRAVITY / substeps;
    ball.vx += ((window.RG && window.RG.wind) || 0) / substeps; // roguelike wind (inert: 0 when no run)
    ball._px = ball.x; ball._py = ball.y;              // pre-move position (for swept field collision)
    ball.x += ball.vx / substeps;
    ball.y += ball.vy / substeps;
    if (s === 0) _logBall('physics');

    MODE.collide();
    if (ball.onGround && s === 0) _logBall('collision');
  }

  // Friction applied once per frame (outside substeps)
  if (ball.onGround) {
    ball.flightFrames = 0; // reset flight timer when on ground

    // Get material at ball position for material-specific physics
    const matName = (ball.lastCollidedMat) || getMaterialAt(ball.x);
    const mat = MATERIALS[matName] || MATERIALS[DEFAULT_MAT];

    // Proportional friction (gentle drag — handles high-speed deceleration)
    ball.vx *= mat.rollingFriction;
    ball.vy *= mat.rollingFriction;

    // Constant surface friction (smooth natural stop at low speed)
    const speed = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
    if (speed > mat.surfaceFriction) {
      ball.vx -= (ball.vx / speed) * mat.surfaceFriction;
      ball.vy -= (ball.vy / speed) * mat.surfaceFriction;
    }

    // Spin: on ground, rotate proportional to horizontal speed.
    // On bounce/liftoff, carry that spin into the air.
    ball.spinRate = ball.vx / BALL_RADIUS;
    ball.rotation += ball.spinRate;

    // Slow-roll failsafe: track how long ball has been rolling slowly on ground
    if (speed < 0.5) {
      ball.slowFrames = (ball.slowFrames || 0) + 1;
    } else {
      ball.slowFrames = 0;
    }

    // Rest check
    const REST_SPEED = 0.05;
    const forceRest = ball.slowFrames > 120; // ~2 seconds of slow rolling -> force stop
    if (speed < REST_SPEED || forceRest) {
      // Let mode decide if rest is allowed (e.g. slope check)
      if (MODE.canRest ? MODE.canRest(forceRest) : true) {
        ball.vx = 0;
        ball.vy = 0;
        ball.atRest = true;
        ball.slowFrames = 0;
        if (MODE.onRest) MODE.onRest();
        _logBall('rest');
        // Save position when ball comes to rest
        if (typeof saveGameSnapshot === 'function') saveGameSnapshot();
      }
    }
  } else {
    // In the air: maintain spin from last ground contact
    ball.rotation += ball.spinRate || 0;

    // Stuck-in-air failsafe: if ball has near-zero speed while airborne,
    // it's trapped in geometry. Snap to terrain and rest.
    const airSpeed = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
    if (airSpeed < 0.1) {
      ball.stuckFrames = (ball.stuckFrames || 0) + 1;
      if (ball.stuckFrames > 60) { // ~1 second stuck
        ball.vx = 0;
        ball.vy = 0;
        ball.atRest = true;
        ball.onGround = true;
        ball.stuckFrames = 0;
        ball.flightFrames = 0;
        _logBall('stuck-rest');
        if (typeof saveGameSnapshot === 'function') saveGameSnapshot();
      }
    } else {
      ball.stuckFrames = 0;
    }

    // Prolonged-flight failsafe: if ball has been airborne for 10+ seconds
    // (600 frames), it's caught in a perpetual bounce loop. Force rest.
    // Real golf balls don't bounce for 10 seconds.
    ball.flightFrames = (ball.flightFrames || 0) + 1;
    if (ball.flightFrames > 600) {
      ball.y = terrainYAt(ball.x) - BALL_RADIUS;
      ball.vx = 0;
      ball.vy = 0;
      ball.atRest = true;
      ball.onGround = true;
      ball.flightFrames = 0;
      _logBall('flight-timeout-rest');
      if (typeof saveGameSnapshot === 'function') saveGameSnapshot();
    }
  }
}

// ── Game State Machine ────────────────────────────────────
function update() {
  switch (state) {
    case STATE_AIM:
      break;

    case STATE_FLIGHT:
      updatePhysics();

      // Check out of bounds
      if (MODE.isOOB()) {
        state = STATE_OOB;
        transitionTimer = 0;
        break;
      }

      // Ball came to rest naturally via physics
      if (ball.atRest) {
        const goal = MODE.isGoalReached();
        if (goal) {
          MODE.onGoalReached(goal);
          state = STATE_PAUSE;
          transitionTimer = 0;
        } else if (MODE.isOOB()) {
          state = STATE_OOB;
          transitionTimer = 0;
        } else {
          state = STATE_AIM;
        }
      }

      if (MODE.updateCamera) MODE.updateCamera();
      break;

    case STATE_OOB:
      // Ball went off screen — wait then respawn
      transitionTimer++;
      if (transitionTimer >= OOB_PAUSE) {
        MODE.onOOB();
        state = STATE_AIM;
        _logBall('oob-respawn');
      }
      if (MODE.updateCamera) MODE.updateCamera();
      break;

    case STATE_PAUSE:
      // Ball in cup — wait before starting transition
      transitionTimer++;
      if (transitionTimer >= TRANSITION_PAUSE) {
        totalStrokes += strokes;
        MODE.onTransitionStart();

        transitionTimer = 0;
        strokes = 0;
        state = STATE_TRANSITION;
      }
      break;

    case STATE_TRANSITION: {
      transitionTimer++;
      const t = Math.min(transitionTimer / TRANSITION_PAN, 1);
      const ease = t < 0.5
        ? 2 * t * t
        : 1 - Math.pow(-2 * t + 2, 2) / 2;

      // Camera pan (axis-agnostic)
      MODE.setCameraPos(transitionCamStart + (transitionCamEnd - transitionCamStart) * ease);

      // Cup fill + flag fade during pan (shared timing, mode provides cup data)
      const cupData = MODE.getTransitionCupData ? MODE.getTransitionCupData() : null;
      if (cupData) {
        const fillStart = 0.3, fillEnd = 0.9;
        if (t >= fillStart) {
          cupData.cupFillProgress = Math.min(1, (t - fillStart) / (fillEnd - fillStart));
        }

        const fadeStart = 0.3, fadeEnd = 0.7;
        if (t >= fadeStart) {
          cupData.flagOpacity = Math.max(0, 1 - (t - fadeStart) / (fadeEnd - fadeStart));
        }

        // Ball rises with sand fill
        const topRim = Math.min(cupData.cupLeftY, cupData.cupRightY);
        const fillTopY = cupData.cupBottomY + (topRim - cupData.cupBottomY) * cupData.cupFillProgress;
        ball.y = fillTopY - BALL_RADIUS;
      }

      if (MODE.onTransitionUpdate) MODE.onTransitionUpdate(ease, t);

      // Done — pan complete
      if (transitionTimer >= TRANSITION_PAN) {
        MODE.onTransitionEnd();
        ball.atRest = true;
        ball.vx = 0;
        ball.vy = 0;
        // Don't overwrite STATE_COMPLETE if onTransitionEnd set it
        if (state !== STATE_COMPLETE) {
          state = STATE_AIM;
        }
        _logBall('transition-end-tee');
        // Save after hole transition completes
        if (typeof saveGameSnapshot === 'function') saveGameSnapshot();
      }
      break;
    }
  }
}
