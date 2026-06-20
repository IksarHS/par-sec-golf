// ── engine.js — physics, heightfield collision, state machine, cup-sink + hole transition ──────────
// Ported from the desert-golf-roguelike base (gameplay.js + modes/desert-golfing.js), standalone — same
// feel: AIM → FLIGHT → (ball rests in cup) → PAUSE → TRANSITION (camera pans, cup fills, ball rises) →
// next hole. Holes are continuous (cup X = next tee X).

// ── input: drag back to aim, release to fire (angle + power) ──
function _fire(dx, dy) {
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist < 5) return;
  if (showTitle) showTitle = false;
  const power = Math.min(dist * POWER_SCALE, MAX_POWER);
  const angle = Math.atan2(dy, dx);
  ball.vx = Math.cos(angle) * power; ball.vy = Math.sin(angle) * power;
  ball.atRest = false; ball.onGround = false; ball.slowFrames = 0; ball.flightFrames = 0; ball.spinRate = 0;
  state = STATE_FLIGHT; strokes++;
}
function _down(px, py) { if (state !== STATE_AIM) return; aiming = true; aimStartX = px; aimStartY = py; aimCurrentX = px; aimCurrentY = py; }
function _move(px, py) { if (!aiming) return; aimCurrentX = px; aimCurrentY = py; }
function _up() { if (!aiming) return; aiming = false; _fire(aimStartX - aimCurrentX, aimStartY - aimCurrentY); }
canvas.addEventListener('mousedown', (e) => { const p = toGameCoords(e.clientX, e.clientY); _down(p.x, p.y); });
window.addEventListener('mousemove', (e) => { const p = toGameCoords(e.clientX, e.clientY); _move(p.x, p.y); });
window.addEventListener('mouseup', () => _up());
canvas.addEventListener('touchstart', (e) => { e.preventDefault(); const t = e.touches[0]; const p = toGameCoords(t.clientX, t.clientY); _down(p.x, p.y); }, { passive: false });
canvas.addEventListener('touchmove', (e) => { e.preventDefault(); const t = e.touches[0]; const p = toGameCoords(t.clientX, t.clientY); _move(p.x, p.y); }, { passive: false });
canvas.addEventListener('touchend', (e) => { e.preventDefault(); _up(); }, { passive: false });

// ── heightfield segment collision (closest point on nearby segments) ──
function collideWithTerrain() {
  let collided = false;
  const center = _bsearchVertex(ball.x);
  if (center < 0) return false;
  const lo = Math.max(0, center - 3), hi = Math.min(vertices.length - 2, center + 3);
  for (let i = lo; i <= hi; i++) {
    const a = vertices[i], b = vertices[i + 1];
    const dx = b.x - a.x, dy = b.y - a.y, lenSq = dx * dx + dy * dy;
    if (lenSq < 0.001) continue;
    let t = ((ball.x - a.x) * dx + (ball.y - a.y) * dy) / lenSq; t = Math.max(0, Math.min(1, t));
    const cxp = a.x + t * dx, cyp = a.y + t * dy, ddx = ball.x - cxp, ddy = ball.y - cyp, d2 = ddx * ddx + ddy * ddy;
    if (d2 < BALL_RADIUS * BALL_RADIUS && d2 > 0.0001) {
      const d = Math.sqrt(d2), nx = ddx / d, ny = ddy / d;
      ball.x += nx * (BALL_RADIUS - d); ball.y += ny * (BALL_RADIUS - d);
      const mat = MATERIALS[a.mat || DEFAULT_MAT], dot = ball.vx * nx + ball.vy * ny;
      if (dot < 0) {
        const isGround = Math.abs(ny) > Math.abs(nx);
        if (isGround && -dot < BOUNCE_THRESHOLD) { ball.vx -= dot * nx; ball.vy -= dot * ny; }
        else { ball.vx -= (1 + mat.restitution) * dot * nx; ball.vy -= (1 + mat.restitution) * dot * ny; }
      }
      ball.lastCollidedMat = a.mat || DEFAULT_MAT; collided = true;
    }
  }
  return collided;
}

function updatePhysics() {
  if (ball.atRest) return;
  for (let s = 0; s < 2; s++) {
    ball.vy += GRAVITY / 2; ball.x += ball.vx / 2; ball.y += ball.vy / 2; collideWithTerrain();
  }
  // grounded when the ball sits on (or just above) the heightfield surface at its x
  const grounded = ball.y >= terrainYAt(ball.x) - BALL_RADIUS - 1.5;
  if (grounded) {
    ball.onGround = true; ball.flightFrames = 0;
    const mat = MATERIALS[ball.lastCollidedMat || getMaterialAt(ball.x)] || MATERIALS[DEFAULT_MAT];
    ball.vx *= mat.rollingFriction; ball.vy *= mat.rollingFriction;
    const sp = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
    if (sp > mat.surfaceFriction) { ball.vx -= (ball.vx / sp) * mat.surfaceFriction; ball.vy -= (ball.vy / sp) * mat.surfaceFriction; }
    ball.spinRate = ball.vx / BALL_RADIUS; ball.rotation += ball.spinRate;
    ball.slowFrames = sp < 0.5 ? (ball.slowFrames || 0) + 1 : 0;
    if (sp < 0.05 || ball.slowFrames > 120) { ball.vx = 0; ball.vy = 0; ball.atRest = true; ball.slowFrames = 0; }
  } else {
    ball.onGround = false; ball.rotation += ball.spinRate || 0;
    const air = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
    if (air < 0.1) { ball.stuckFrames = (ball.stuckFrames || 0) + 1; if (ball.stuckFrames > 60) { ball.atRest = true; ball.onGround = true; ball.vx = ball.vy = 0; ball.stuckFrames = 0; } } else ball.stuckFrames = 0;
    ball.flightFrames = (ball.flightFrames || 0) + 1;
    if (ball.flightFrames > 600) { ball.y = terrainYAt(ball.x) - BALL_RADIUS; ball.vx = ball.vy = 0; ball.atRest = true; ball.onGround = true; ball.flightFrames = 0; }
  }
}

function isBallInCup() {
  const h = holes[currentHole];
  if (!h || h.cupFilled) return false;
  return Math.abs(ball.x - h.cupX) < CUP_WIDTH / 2 && ball.y > h.cupY;
}
function isBallOffScreen() {
  const sx = ball.x - camera.x, sy = ball.y - camera.y, m = BALL_RADIUS + 10;
  return sx < -m || sx > W + m || sy > H + m;
}
function setHoleCamera(hole) {
  const margin = 120;
  camera.x = hole.teeX - margin;
  if (hole.cupX - camera.x > W - margin) camera.x = (hole.teeX + hole.cupX) / 2 - W / 2;
}
function onOOB() { const h = holes[currentHole]; ball.x = h.teeX; ball.y = terrainYAt(h.teeX) - BALL_RADIUS; ball.vx = ball.vy = 0; ball.atRest = true; }

function onTransitionStart() {
  transitionCamStart = camera.x; transitionBallStartY = ball.y;
  currentHole++;
  if (currentHole >= (currentCourse?.holeCount ?? 9)) { courseComplete = true; transitionCamEnd = camera.x; }
  else { ensureHolesAhead(currentHole + 1); const saved = camera.x; setHoleCamera(holes[currentHole]); transitionCamEnd = camera.x; camera.x = saved; }
  if (currentHole === 1) showTitle = false;
}
function onTransitionEnd() {
  const prev = holes[currentHole - 1];
  if (prev) { prev.cupFilled = true; prev.cupFillProgress = 1; prev.flagVisible = false; prev.flagOpacity = 0; flattenCup(prev); }
  if (courseComplete) { state = STATE_COMPLETE; completeTimer = 0; return; }
  ball.y = terrainYAt(ball.x) - BALL_RADIUS;
  ensureHolesAhead(currentHole + 1);
}

// ── state machine (identical flow/timing to the base) ──
function update() {
  switch (state) {
    case STATE_AIM: break;
    case STATE_FLIGHT:
      updatePhysics();
      if (isBallOffScreen()) { state = STATE_OOB; transitionTimer = 0; break; }
      if (ball.atRest) {
        if (isBallInCup()) { state = STATE_PAUSE; transitionTimer = 0; }
        else if (isBallOffScreen()) { state = STATE_OOB; transitionTimer = 0; }
        else state = STATE_AIM;
      }
      break;
    case STATE_OOB:
      if (++transitionTimer >= OOB_PAUSE) { onOOB(); state = STATE_AIM; }
      break;
    case STATE_PAUSE:
      if (++transitionTimer >= TRANSITION_PAUSE) { totalStrokes += strokes; onTransitionStart(); transitionTimer = 0; strokes = 0; state = STATE_TRANSITION; }
      break;
    case STATE_TRANSITION: {
      transitionTimer++;
      const t = Math.min(transitionTimer / TRANSITION_PAN, 1);
      const ease = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      camera.x = transitionCamStart + (transitionCamEnd - transitionCamStart) * ease;
      const cup = currentHole > 0 ? holes[currentHole - 1] : null;
      if (cup) {
        if (t >= 0.3) cup.cupFillProgress = Math.min(1, (t - 0.3) / 0.6);
        if (t >= 0.3) cup.flagOpacity = Math.max(0, 1 - (t - 0.3) / 0.4);
        const topRim = Math.min(cup.cupLeftY, cup.cupRightY);
        ball.y = (cup.cupBottomY + (topRim - cup.cupBottomY) * cup.cupFillProgress) - BALL_RADIUS;  // ball rises with the fill
      }
      if (transitionTimer >= TRANSITION_PAN) { onTransitionEnd(); ball.atRest = true; ball.vx = ball.vy = 0; if (state !== STATE_COMPLETE) state = STATE_AIM; }
      break;
    }
  }
}
