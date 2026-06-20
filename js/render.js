// ── render.js — draw the world (terrain, cup, fill animation, flag, ball, aim, HUD) ────────────────
function draw() {
  // sky
  ctx.fillStyle = currentCourse?.sky || '#232c40';
  ctx.fillRect(0, 0, W, H);

  ctx.save();
  ctx.translate(-camera.x, -camera.y);

  drawTerrain();
  // cup hole + fill + flag for the previous hole (during the pan) and the current hole
  if (state === STATE_TRANSITION && currentHole > 0) drawCup(holes[currentHole - 1]);
  const cur = holes[currentHole]; if (cur) drawCup(cur);

  drawBall();
  ctx.restore();

  drawAim();
  drawHUD();
}

function drawTerrain() {
  if (vertices.length < 2) return;
  const left = camera.x - 20, right = camera.x + W + 20;
  // visible window of vertices (+ one on each side)
  let i0 = _bsearchVertex(left); if (i0 < 0) i0 = 0; i0 = Math.max(0, i0 - 1);
  let i1 = _bsearchVertex(right); if (i1 < 0) i1 = vertices.length - 1; i1 = Math.min(vertices.length - 1, i1 + 2);

  // fill body (grass), bottom corners close the polygon
  ctx.beginPath();
  ctx.moveTo(vertices[i0].x, vertices[i0].y);
  for (let i = i0 + 1; i <= i1; i++) ctx.lineTo(vertices[i].x, vertices[i].y);
  ctx.lineTo(vertices[i1].x, H + camera.y + 40);
  ctx.lineTo(vertices[i0].x, H + camera.y + 40);
  ctx.closePath();
  ctx.fillStyle = MATERIALS.grass.color;
  ctx.fill();

  // bunkers: re-fill any segment whose material is bunker
  for (let i = i0; i < i1; i++) {
    if ((vertices[i].mat || 'grass') !== 'grass') {
      const a = vertices[i], b = vertices[i + 1];
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.lineTo(b.x, H + camera.y + 40); ctx.lineTo(a.x, H + camera.y + 40); ctx.closePath();
      ctx.fillStyle = (MATERIALS[a.mat] || MATERIALS.grass).color; ctx.fill();
    }
  }

  // lighter top lip along the surface
  ctx.beginPath();
  ctx.moveTo(vertices[i0].x, vertices[i0].y);
  for (let i = i0 + 1; i <= i1; i++) ctx.lineTo(vertices[i].x, vertices[i].y);
  ctx.lineWidth = 4; ctx.strokeStyle = MATERIALS.grass.colorLight; ctx.lineJoin = 'round'; ctx.stroke();
}

function drawCup(c) {
  if (!c) return;
  if (!c.cupFilled) {
    // the dark hole (notch interior)
    const inset = 3;
    ctx.beginPath();
    ctx.moveTo(c.cupLeftX, c.cupLeftY);
    ctx.lineTo(c.cupLeftX + inset, c.cupBottomY);
    ctx.lineTo(c.cupRightX - inset, c.cupBottomY);
    ctx.lineTo(c.cupRightX, c.cupRightY);
    ctx.closePath();
    ctx.fillStyle = '#16202f';
    ctx.fill();
    // sand/grass fill rising during the transition
    if (c.cupFillProgress > 0) {
      const topRim = Math.min(c.cupLeftY, c.cupRightY);
      const fillTopY = c.cupBottomY + (topRim - c.cupBottomY) * c.cupFillProgress;
      ctx.beginPath();
      ctx.moveTo(c.cupLeftX, Math.max(fillTopY, c.cupLeftY));
      ctx.lineTo(c.cupLeftX + inset, c.cupBottomY);
      ctx.lineTo(c.cupRightX - inset, c.cupBottomY);
      ctx.lineTo(c.cupRightX, Math.max(fillTopY, c.cupRightY));
      ctx.closePath();
      ctx.fillStyle = MATERIALS.grass.color; ctx.fill();
    }
  }
  // flag
  if (c.flagOpacity > 0.01 && c.flagVisible !== false) {
    ctx.globalAlpha = c.flagOpacity;
    const fx = c.cupX, fy = c.cupY;
    ctx.strokeStyle = '#cbd2e0'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(fx, fy); ctx.lineTo(fx, fy - 44); ctx.stroke();
    ctx.fillStyle = '#e8c84a';
    ctx.beginPath(); ctx.moveTo(fx, fy - 44); ctx.lineTo(fx + 24, fy - 38); ctx.lineTo(fx, fy - 30); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#3a3320'; ctx.font = "11px 'Departure Mono', monospace"; ctx.textAlign = 'center';
    ctx.fillText(String(c.flagHole), fx + 9, fy - 35);
    ctx.globalAlpha = 1;
  }
}

function drawBall() {
  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  ctx.beginPath(); ctx.ellipse(ball.x, ball.y + BALL_RADIUS + 1, BALL_RADIUS + 1, 2.2, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#f6f6f6';
  ctx.beginPath(); ctx.arc(ball.x, ball.y, BALL_RADIUS + 1.2, 0, Math.PI * 2); ctx.fill();
}

function drawAim() {
  if (!aiming || state !== STATE_AIM) return;
  const dx = aimStartX - aimCurrentX, dy = aimStartY - aimCurrentY;
  const dist = Math.sqrt(dx * dx + dy * dy); if (dist < 5) return;
  const power = Math.min(dist * POWER_SCALE, MAX_POWER), angle = Math.atan2(dy, dx);
  const sx = ball.x - camera.x, sy = ball.y - camera.y;
  const len = (power / MAX_POWER) * 150;
  const ex = sx + Math.cos(angle) * len, ey = sy + Math.sin(angle) * len;
  ctx.setLineDash([4, 5]); ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(ex, ey); ctx.stroke(); ctx.setLineDash([]);
  // arrowhead
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.beginPath(); ctx.moveTo(ex, ey);
  ctx.lineTo(ex - Math.cos(angle - 0.4) * 10, ey - Math.sin(angle - 0.4) * 10);
  ctx.lineTo(ex - Math.cos(angle + 0.4) * 10, ey - Math.sin(angle + 0.4) * 10);
  ctx.closePath(); ctx.fill();
}

function drawHUD() {
  ctx.textAlign = 'left';
  if (showTitle && currentHole === 0) {
    ctx.fillStyle = '#ffffff';
    ctx.font = "28px 'Departure Mono', monospace"; ctx.fillText(currentCourse.worldName, 20, 34);
    ctx.font = "20px 'Departure Mono', monospace"; ctx.fillText(currentCourse.name, 20, 58);
    ctx.font = "16px 'Departure Mono', monospace"; ctx.fillText(currentCourse.holeCount + ' Holes', 20, 78);
  } else {
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.font = "16px 'Departure Mono', monospace";
    ctx.fillText('Hole ' + (currentHole + 1) + ' / ' + currentCourse.holeCount, 20, 30);
    ctx.fillText('Strokes ' + strokes, 20, 50);
  }
  if (state === STATE_COMPLETE) {
    completeTimer++;
    const a = Math.min(1, completeTimer / 30);
    ctx.fillStyle = 'rgba(255,255,255,' + a + ')'; ctx.textAlign = 'center';
    ctx.font = "28px 'Departure Mono', monospace"; ctx.fillText('COURSE COMPLETE', W / 2, H * 0.32);
    ctx.font = "18px 'Departure Mono', monospace"; ctx.fillText(currentCourse.worldName + ' · ' + totalStrokes + ' strokes', W / 2, H * 0.32 + 30);
    ctx.font = "14px 'Departure Mono', monospace"; ctx.fillStyle = 'rgba(255,255,255,' + (a * 0.7) + ')'; ctx.fillText('click to replay', W / 2, H * 0.32 + 64);
  }
}
