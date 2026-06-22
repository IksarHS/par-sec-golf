// ── Display Setup ──────────────────────────────────────────
function resizeDisplay() {
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  // Fill entire viewport, scale uniformly based on height
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.round(vw * dpr);
  canvas.height = Math.round(vh * dpr);
  canvas.style.width = vw + 'px';
  canvas.style.height = vh + 'px';

  displayScale = canvas.height / H;
  W = Math.round(vw * dpr / displayScale); // game units visible horizontally
}

window.addEventListener('resize', resizeDisplay);
resizeDisplay();

// ── Shared Drawing Utilities ──────────────────────────────
// These work on any object with the cup data interface:
//   cupLeftX, cupRightX, cupLeftY, cupRightY, cupBottomY,
//   cupWallInset, cupFillProgress, flagVisible, flagOpacity, flagHole/index

function drawCupFill(cupData) {
  // Draw sand filling a cup — works in world coords (camera transform already applied)
  if (!cupData.cupFillProgress || cupData.cupFillProgress <= 0) return;

  const leftX = cupData.cupLeftX;
  const rightX = cupData.cupRightX;
  const leftY = cupData.cupLeftY;
  const rightY = cupData.cupRightY;
  const bottomY = cupData.cupBottomY;
  const wallInset = cupData.cupWallInset;
  const blX = leftX + wallInset;   // bottom-left x
  const brX = rightX - wallInset;  // bottom-right x

  // Fill level: rises from bottomY (empty) up to the higher rim (full)
  const topRim = Math.min(leftY, rightY);
  const fillTopY = bottomY + (topRim - bottomY) * cupData.cupFillProgress;

  if (fillTopY >= bottomY) return;

  // Find where fillTopY intersects the left wall
  let flx;
  if (fillTopY <= leftY) {
    flx = leftX;
  } else {
    const t = (bottomY - fillTopY) / (bottomY - leftY);
    flx = blX + (leftX - blX) * t;
  }

  // Find where fillTopY intersects the right wall
  let frx;
  if (fillTopY <= rightY) {
    frx = rightX;
  } else {
    const t = (bottomY - fillTopY) / (bottomY - rightY);
    frx = brX + (rightX - brX) * t;
  }

  // Draw fill polygon — overdraw by 1px to cover sub-pixel gaps
  const overdraw = 1;
  // A sunk putt fills the cup with the SURROUNDING ground colour so it heals into the terrain
  // (on Earth's grass the fixed GROUND brown read as a jarring green->brown seam). Inert hook:
  // when the roguelike layer is absent, RG._cupFillColorFor is undefined and we keep GROUND
  // exactly (base Desert Golfing is byte-identical).
  ctx.fillStyle = (typeof window !== 'undefined' && window.RG && RG._cupFillColorFor && RG._cupFillColorFor(cupData)) || GROUND;
  ctx.beginPath();
  ctx.moveTo(flx - overdraw, fillTopY);
  ctx.lineTo(blX - overdraw, bottomY + overdraw);
  ctx.lineTo(brX + overdraw, bottomY + overdraw);
  ctx.lineTo(frx + overdraw, fillTopY);
  ctx.closePath();
  ctx.fill();
}

function drawFlag(cupData, surfaceYFn) {
  // Draw flag pole + pennant — works in world coords
  // surfaceYFn(x): returns terrain/platform Y at world x (for pole base)
  if (!cupData.flagVisible) return;

  const opacity = cupData.flagOpacity !== undefined ? cupData.flagOpacity : 1;
  if (opacity <= 0) return;

  const cupW = cupData.cupRightX - cupData.cupLeftX;
  const poleWorldX = cupData.cupLeftX + cupW + 2;
  let sy = surfaceYFn ? surfaceYFn(poleWorldX) : cupData.cupY;
  // WORLD-CURVE (golf-orbit): bow the pole base onto the curved surface too (render-only). Inert by default.
  if (typeof window !== 'undefined' && window.RG && window.RG._worldCurve && window.RG._curveWorldDY) sy += window.RG._curveWorldDY(poleWorldX);

  ctx.globalAlpha = opacity;

  // Pole
  const poleH = 55;
  ctx.strokeStyle = '#7888a0';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(poleWorldX, sy);
  ctx.lineTo(poleWorldX, sy - poleH);
  ctx.stroke();

  // Pennant (pentagon — rectangle body + triangular point right)
  const pTop = sy - poleH;
  const pBot = sy - poleH + 16;
  const pMid = (pTop + pBot) / 2;
  const bodyW = 22;
  const pointW = 10;
  ctx.fillStyle = '#e8c840';
  ctx.beginPath();
  ctx.moveTo(poleWorldX, pTop);
  ctx.lineTo(poleWorldX + bodyW, pTop);
  ctx.lineTo(poleWorldX + bodyW + pointW, pMid);
  ctx.lineTo(poleWorldX + bodyW, pBot);
  ctx.lineTo(poleWorldX, pBot);
  ctx.closePath();
  ctx.fill();

  // Hole number on pennant body
  const holeNum = cupData.flagHole !== undefined ? cupData.flagHole : (cupData.index !== undefined ? cupData.index + 1 : '');
  ctx.fillStyle = '#4a3520';
  ctx.font = "10px 'Departure Mono', monospace";
  ctx.textAlign = 'center';
  ctx.fillText(String(holeNum), poleWorldX + bodyW / 2, pMid + 4);

  ctx.globalAlpha = 1;
}

function drawObjects() {
  // Draw placed objects (polygons / sprites) in world coords
  for (let oi = 0; oi < objects.length; oi++) {
    const ov = objects[oi];
    if (!ov.verts || ov.verts.length < 3) continue;

    ctx.beginPath();
    ctx.moveTo(ov.verts[0].x, ov.verts[0].y);
    for (let k = 1; k < ov.verts.length; k++) {
      ctx.lineTo(ov.verts[k].x, ov.verts[k].y);
    }
    ctx.closePath();

    if (ov.sprite && SPRITES[ov.sprite]) {
      // Sprite object: draw image within bounding box
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      for (const v of ov.verts) {
        if (v.x < minX) minX = v.x;
        if (v.x > maxX) maxX = v.x;
        if (v.y < minY) minY = v.y;
        if (v.y > maxY) maxY = v.y;
      }
      ctx.save();
      if (ov.rotation) {
        const cx = (minX + maxX) / 2;
        const cy = (minY + maxY) / 2;
        ctx.translate(cx, cy);
        ctx.rotate(ov.rotation);
        ctx.drawImage(SPRITES[ov.sprite],
          -(maxX - minX) / 2, -(maxY - minY) / 2,
          maxX - minX, maxY - minY);
      } else {
        ctx.drawImage(SPRITES[ov.sprite], minX, minY, maxX - minX, maxY - minY);
      }
      ctx.restore();
    } else {
      // Non-sprite: fill with the object's own material colour (e.g. green cactus), else terrain colour
      ctx.fillStyle = (ov.mat && typeof MATERIALS !== 'undefined' && MATERIALS[ov.mat] && MATERIALS[ov.mat].color) || GROUND;
      ctx.fill();
    }
  }
}

function drawBall() {
  // Draw ball in world coords (camera transform already applied).
  // WORLD-CURVE (golf-orbit): add the SAME screen-bow offset the terrain uses so the ball stays glued
  // to the curved surface (render-only — ball.x/ball.y physics are untouched). Inert in the base game.
  const _by = ball.y + ((typeof window !== 'undefined' && window.RG && window.RG._worldCurve && window.RG._curveWorldDY) ? window.RG._curveWorldDY(ball.x) : 0);
  // WORLD-CURVE (golf-orbit): when zoomed way OUT the ball would shrink to a sub-pixel speck. Grow its
  // WORLD radius by ~1/zoom (capped) so it stays a visible dot on the planet (like the prototype's min
  // radius). Render-only; gated on _worldCurve so the base game uses the plain BALL_RADIUS.
  let _br = BALL_RADIUS;
  if (typeof window !== 'undefined' && window.RG && window.RG._worldCurve && window.RG._zoom && window.RG._zoom < 1) {
    _br = Math.min(BALL_RADIUS / window.RG._zoom, BALL_RADIUS * 3.4);   // keep ~visible, never balloon
  }
  ctx.fillStyle = BALL_COLOR;
  ctx.beginPath();
  ctx.arc(ball.x, _by, _br, 0, Math.PI * 2);
  ctx.fill();

  // Draw 3 dots on the ball that rotate to show spin
  ctx.save();
  ctx.translate(ball.x, _by);
  ctx.rotate(ball.rotation || 0);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
  const dotR = 1;
  const dotDist = BALL_RADIUS * 0.55;
  for (let i = 0; i < 3; i++) {
    const angle = (i / 3) * Math.PI * 2;
    const dx = Math.cos(angle) * dotDist;
    const dy = Math.sin(angle) * dotDist;
    ctx.beginPath();
    ctx.arc(dx, dy, dotR, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawAimUI() {
  // Draw aim indicator in screen space (no camera transform)
  if (!aiming || state !== STATE_AIM) return;

  const dx = aimCurrentX - aimStartX;
  const dy = aimCurrentY - aimStartY;
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist < 5) return;

  const nx = dx / dist;
  const ny = dy / dist;

  // 1. Faded circle at drag start point
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(aimStartX, aimStartY, 8, 0, Math.PI * 2);
  ctx.stroke();

  // 2. White line from drag start in LAUNCH direction (opposite of drag)
  const launchEndX = aimStartX - dx;
  const launchEndY = aimStartY - dy;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(aimStartX, aimStartY);
  ctx.lineTo(launchEndX, launchEndY);
  ctx.stroke();

  // 3. Arrowhead at launch end (pointing in launch direction)
  const arrowLen = 10;
  const arrowAngle = 0.45;
  const launchAngle = Math.atan2(-dy, -dx);
  ctx.beginPath();
  ctx.moveTo(launchEndX, launchEndY);
  ctx.lineTo(
    launchEndX - arrowLen * Math.cos(launchAngle - arrowAngle),
    launchEndY - arrowLen * Math.sin(launchAngle - arrowAngle)
  );
  ctx.moveTo(launchEndX, launchEndY);
  ctx.lineTo(
    launchEndX - arrowLen * Math.cos(launchAngle + arrowAngle),
    launchEndY - arrowLen * Math.sin(launchAngle + arrowAngle)
  );
  ctx.stroke();

  // 4. Dark dots extending in DRAG direction (toward cursor)
  const dotSpacing = 10;
  const numDots = Math.min(Math.floor(dist / dotSpacing), 15);
  ctx.fillStyle = 'rgba(80, 70, 55, 0.5)';
  for (let i = 1; i <= numDots; i++) {
    const dotX = aimStartX + nx * i * dotSpacing;
    const dotY = aimStartY + ny * i * dotSpacing;
    ctx.beginPath();
    ctx.arc(dotX, dotY, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawStrokeCounter() {
  // Inert hook: the roguelike's corner readout owns the on-course score when active (RG._scoreStyle
  // 'corner'). Undefined/false in the base game, so this line is a no-op there.
  if (typeof window !== 'undefined' && window.RG && RG._hideStrokeCounter) return;
  // Shared stroke HUD — screen space
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.font = "26px 'Departure Mono', monospace";

  if (totalStrokes > 0) {
    ctx.fillText(String(totalStrokes), W / 2 - 40, 30);
  }

  if (strokes > 0) {
    ctx.fillText('+' + strokes, W / 2 + 40, 30);
  }
}

// ── Draw Orchestrator ──────────────────────────────────────
function draw() {
  ctx.save();
  ctx.scale(displayScale, displayScale);

  // Sky (screen space)
  MODE.drawSky(ctx);

  // World space
  ctx.save();
  MODE.applyCameraTransform(ctx);
  MODE.drawWorld(ctx);
  drawBall();
  ctx.restore();

  // Screen space: aim UI + HUD
  drawAimUI();
  drawStrokeCounter();
  MODE.drawHUD(ctx);

  ctx.restore();
}
