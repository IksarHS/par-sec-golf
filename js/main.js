// ── main.js — boot the Earth course + run the loop ────────────────────────────────────────────────
function startGame() {
  vertices = []; holes = []; objects = [];
  currentHole = 0; totalStrokes = 0; strokes = 0;
  state = STATE_AIM; transitionTimer = 0; completeTimer = 0; courseComplete = false; showTitle = true;
  camera.x = 0; camera.y = 0;

  currentCourse = { worldName: 'Earth', name: 'Front Nine', sky: '#232c40', defaultMaterial: 'grass', holeCount: 9 };

  ensureHolesAhead(1);
  const h0 = holes[0];
  ball.x = h0.teeX; ball.y = terrainYAt(h0.teeX) - BALL_RADIUS;
  ball.vx = 0; ball.vy = 0; ball.atRest = true; ball.onGround = true; ball.rotation = 0;
  setHoleCamera(h0);
}

function loop() { update(); draw(); requestAnimationFrame(loop); }

// replay on the completion screen
canvas.addEventListener('mousedown', () => { if (state === STATE_COMPLETE) { SEED = (Math.random() * 1e9) | 0; startGame(); } });
canvas.addEventListener('touchstart', () => { if (state === STATE_COMPLETE) { SEED = (Math.random() * 1e9) | 0; startGame(); } }, { passive: false });

resize();
startGame();
requestAnimationFrame(loop);
