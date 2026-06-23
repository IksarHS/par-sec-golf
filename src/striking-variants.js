/* ============================================================================
 * Par Sec — BALL-STRIKING UI VARIANTS  (P2 feel study)
 * ----------------------------------------------------------------------------
 * Self-contained on a simple flat-faceted test hole. Four DISTINCT striking
 * interactions, all in our art (Departure Mono, deep-space sky, white dimpled
 * ball, flat terrain, gold flag). Live-toggleable 1-4. Headless API exposed for
 * GIF capture (__step/__reset/__frame/__setAuto/__setVariant + per-variant auto).
 *
 * The four directions:
 *   1 TIMING + POWER METER  — click to charge, an oscillating marker sweeps a
 *                             power bar; release on the SWEET-SPOT band for max.
 *   2 DRAG-BACK + LIVE ARC  — native drag-back, but with a real ballistic
 *                             trajectory preview + a power RING around the ball.
 *   3 TWO-STAGE             — stage 1 fills a power meter (release to lock),
 *                             stage 2 a needle sweeps an accuracy gauge (release
 *                             on centre for true aim, off-centre curves the shot).
 *   4 PULL + TENSION        — drag back with visible SQUASH/STRETCH on the ball,
 *                             a tension cord, then a RECOIL SNAP + dust on release.
 * ==========================================================================*/
(function () {
'use strict';

// ── canvas / context ────────────────────────────────────────────────────────
var cv = document.getElementById('c');
cv.width = 960; cv.height = 540;
var ctx = cv.getContext('2d');
var W = 960, H = 540;
var FONT = function (px) { return px + "px 'Departure Mono', monospace"; };

// ── physics constants (tuned to feel like the real launch) ──────────────────
var GRAVITY = 0.42;
var POWER_SCALE = 0.11;     // px of drag -> launch speed
var MAX_POWER = 17;
var GROUND_FRICTION = 0.985;
var REST_SPEED = 0.45;

// ── test hole: a flat-faceted terrain polyline + a cup ──────────────────────
// A gentle bowl so the ball rolls and settles; tee on the left, flag on the right.
var TEE_X = 150, TEE_GROUND = 392;
var CUP_X = 792;
var terrainPts = [];
(function buildTerrain() {
  for (var x = 0; x <= W + 40; x += 24) {
    var t = x / W;
    // base slope + a couple of soft swells, then a small bowl by the cup
    var y = 392
          + Math.sin(t * 3.1) * 14
          + Math.sin(t * 7.7 + 1.3) * 6
          - (x > 700 && x < 860 ? 10 * (1 - Math.abs(x - 780) / 80) : 0);
    terrainPts.push({ x: x, y: Math.round(y) });
  }
})();
function terrainY(x) {
  if (x <= terrainPts[0].x) return terrainPts[0].y;
  for (var i = 1; i < terrainPts.length; i++) {
    if (x <= terrainPts[i].x) {
      var a = terrainPts[i - 1], b = terrainPts[i];
      var f = (x - a.x) / (b.x - a.x);
      return a.y + (b.y - a.y) * f;
    }
  }
  return terrainPts[terrainPts.length - 1].y;
}
TEE_GROUND = terrainY(TEE_X);
var CUP_Y = terrainY(CUP_X);

// ── stars (deep-space sky) ──────────────────────────────────────────────────
var stars = [];
(function () {
  for (var i = 0; i < 70; i++) {
    stars.push({
      x: Math.random() * W, y: Math.random() * (H * 0.72),
      r: Math.random() < 0.8 ? 1 : 2,
      c: Math.random() < 0.78 ? 'rgba(255,255,255,0.45)' : 'rgba(190,210,255,0.85)',
      tw: Math.random() * 6.28
    });
  }
})();

// ── palette (Mars-rust, per spec) ───────────────────────────────────────────
var PAL = { fill: '#c45c4a', shade: '#8f3d30', lip: '#e07e5f' };

// ── ball state ──────────────────────────────────────────────────────────────
var BALL_R = 9;
var ball = { x: TEE_X, y: TEE_GROUND - BALL_R, vx: 0, vy: 0, rotation: 0, flying: false, moving: false };

// squash/stretch (variant 4 + universal landing squash)
var squash = { sx: 1, sy: 1 };

// dust puffs (recoil / landing)
var puffs = [];
function spawnPuffs(x, y, dirAng, n, spd) {
  for (var i = 0; i < n; i++) {
    var a = dirAng + (Math.random() - 0.5) * 1.6;
    var s = spd * (0.4 + Math.random() * 0.8);
    puffs.push({ x: x, y: y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 0.6, life: 1, r: 2 + Math.random() * 3 });
  }
}

// ── input / variant state ───────────────────────────────────────────────────
var variant = 1;
var VARIANT_NAMES = {
  1: 'TIMING + POWER METER',
  2: 'DRAG-BACK + LIVE ARC',
  3: 'TWO-STAGE  (power -> accuracy)',
  4: 'PULL + TENSION  (squash/snap)'
};

// shared aim
var AIM_ANGLE = -0.62;        // default launch angle (up-right), radians
var charging = false;         // v1/v3 meter running
var chargeT = 0;              // oscillator phase
var lockedPower = 0;          // v3 stage-1 result (0..1)
var stage = 0;                // v3: 0 idle, 1 power, 2 accuracy
var dragging = false;         // v2/v4
var dragSX = 0, dragSY = 0, dragCX = 0, dragCY = 0;

// recoil flash timer (v4)
var recoil = 0;

// ── auto-demo driver ─────────────────────────────────────────────────────────
var auto = false;
var autoPhase = 0;     // ms-ish counter in frames
var paused = false;

function resetBall() {
  ball.x = TEE_X; ball.y = terrainY(TEE_X) - BALL_R;
  ball.vx = 0; ball.vy = 0; ball.rotation = 0; ball.flying = false; ball.moving = false;
  squash.sx = 1; squash.sy = 1;
  puffs.length = 0;
  charging = false; dragging = false; stage = 0; lockedPower = 0; recoil = 0;
  chargeT = 0; autoPhase = 0;
}

// ── fire the ball (shared launch) ───────────────────────────────────────────
// power01 in 0..1, angle radians, curve = lateral spin bias (-1..1)
function fire(power01, angle, curve) {
  var power = Math.max(0.06, Math.min(power01, 1)) * MAX_POWER;
  ball.vx = Math.cos(angle) * power;
  ball.vy = Math.sin(angle) * power;
  ball._curve = (curve || 0) * 0.10;   // gentle magnus-ish drift
  ball.flying = true; ball.moving = true;
  // launch squash kick
  squash.sx = 1.28; squash.sy = 0.72;
  spawnPuffs(ball.x, ball.y + BALL_R, Math.PI - angle, 7, power * 0.4);
  charging = false; dragging = false; stage = 0;
}

// ── per-frame physics ───────────────────────────────────────────────────────
function physics() {
  if (ball.moving) {
    var sub = 4;
    for (var s = 0; s < sub; s++) {
      ball.vy += GRAVITY / sub;
      if (ball.flying && ball._curve) ball.vx += ball._curve / sub;
      ball.x += ball.vx / sub;
      ball.y += ball.vy / sub;
      var gy = terrainY(ball.x) - BALL_R;
      if (ball.y >= gy) {
        ball.y = gy;
        if (ball.flying) {
          // landing: bounce + squash + dust
          ball.flying = false;
          var impact = Math.abs(ball.vy);
          ball.vy = -ball.vy * 0.34;
          ball.vx *= 0.7;
          ball._curve = 0;
          squash.sx = 1.22; squash.sy = 0.8;
          if (impact > 2) spawnPuffs(ball.x, ball.y + BALL_R, -Math.PI / 2, 4, impact * 0.3);
        } else {
          ball.vy = 0;
          ball.vx *= GROUND_FRICTION;
        }
      }
    }
    if (!ball.flying) {
      var spd = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
      ball.rotation += ball.vx / BALL_R * 0.25;
      if (spd < REST_SPEED && ball.y >= terrainY(ball.x) - BALL_R - 0.5) {
        ball.vx = 0; ball.vy = 0; ball.moving = false;
      }
    } else {
      ball.rotation += 0.12;
    }
    // sink in cup
    if (Math.abs(ball.x - CUP_X) < 10 && Math.abs(ball.y - (CUP_Y - BALL_R)) < 14 && !ball.flying) {
      ball.vx *= 0.5;
    }
  }
  // squash relax
  squash.sx += (1 - squash.sx) * 0.18;
  squash.sy += (1 - squash.sy) * 0.18;
  // puffs
  for (var i = puffs.length - 1; i >= 0; i--) {
    var p = puffs[i];
    p.x += p.vx; p.y += p.vy; p.vy += 0.12; p.vx *= 0.92; p.life -= 0.045;
    if (p.life <= 0) puffs.splice(i, 1);
  }
  if (recoil > 0) recoil -= 0.08;
  // variant meters tick
  if (charging || stage === 1 || stage === 2) chargeT += 0.055;
}

// ════════════════════════════════════════════════════════════════════════════
//  DRAW: world
// ════════════════════════════════════════════════════════════════════════════
function drawSky() {
  var g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#08090f'); g.addColorStop(0.55, '#0f1622'); g.addColorStop(1, '#172534');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  for (var i = 0; i < stars.length; i++) {
    var st = stars[i];
    ctx.globalAlpha = 0.6 + 0.4 * Math.sin(st.tw + chargeT * 0.3);
    ctx.fillStyle = st.c;
    ctx.fillRect(st.x, st.y, st.r, st.r);
  }
  ctx.globalAlpha = 1;
}

function drawTerrain() {
  // solid fill below the polyline
  ctx.beginPath();
  ctx.moveTo(terrainPts[0].x, terrainPts[0].y);
  for (var i = 1; i < terrainPts.length; i++) ctx.lineTo(terrainPts[i].x, terrainPts[i].y);
  ctx.lineTo(W + 40, H); ctx.lineTo(-40, H); ctx.closePath();
  ctx.fillStyle = PAL.fill; ctx.fill();
  // darker offset band (depth)
  ctx.beginPath();
  ctx.moveTo(terrainPts[0].x, terrainPts[0].y + 7);
  for (var j = 1; j < terrainPts.length; j++) ctx.lineTo(terrainPts[j].x, terrainPts[j].y + 7);
  ctx.lineTo(W + 40, H); ctx.lineTo(-40, H); ctx.closePath();
  ctx.fillStyle = PAL.shade; ctx.fill();
  // bright top lip
  ctx.beginPath();
  ctx.moveTo(terrainPts[0].x, terrainPts[0].y);
  for (var k = 1; k < terrainPts.length; k++) ctx.lineTo(terrainPts[k].x, terrainPts[k].y);
  ctx.strokeStyle = PAL.lip; ctx.lineWidth = 2.5; ctx.stroke();
}

function drawCup() {
  // dark notch carved into the surface
  var lx = CUP_X - 6, rx = CUP_X + 6, sy = CUP_Y;
  ctx.fillStyle = '#11161e';
  ctx.fillRect(lx, sy, rx - lx, 16);
  ctx.strokeStyle = 'rgba(255,255,255,0.12)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(lx, sy); ctx.lineTo(lx, sy + 16); ctx.stroke();
}

function drawFlag() {
  var poleX = CUP_X + 8, sy = CUP_Y;
  var poleH = 55;
  ctx.strokeStyle = '#7888a0'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(poleX, sy); ctx.lineTo(poleX, sy - poleH); ctx.stroke();
  var pTop = sy - poleH, pBot = pTop + 16, pMid = (pTop + pBot) / 2, bodyW = 22, pointW = 10;
  ctx.fillStyle = '#e8c840';
  ctx.beginPath();
  ctx.moveTo(poleX, pTop); ctx.lineTo(poleX + bodyW, pTop);
  ctx.lineTo(poleX + bodyW + pointW, pMid); ctx.lineTo(poleX + bodyW, pBot);
  ctx.lineTo(poleX, pBot); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#4a3520'; ctx.font = FONT(10); ctx.textAlign = 'center';
  ctx.fillText('1', poleX + bodyW / 2, pMid + 4);
}

function drawPuffs() {
  for (var i = 0; i < puffs.length; i++) {
    var p = puffs[i];
    ctx.globalAlpha = Math.max(0, p.life) * 0.5;
    ctx.fillStyle = '#d98a6e';
    ctx.beginPath(); ctx.arc(p.x, p.y, p.r * (0.6 + p.life * 0.6), 0, 6.2832); ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawBall() {
  ctx.save();
  ctx.translate(ball.x, ball.y);
  ctx.scale(squash.sx, squash.sy);
  // recoil flash ring (v4)
  if (recoil > 0) {
    ctx.globalAlpha = recoil * 0.6;
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(0, 0, BALL_R + (1 - recoil) * 14, 0, 6.2832); ctx.stroke();
    ctx.globalAlpha = 1;
  }
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.arc(0, 0, BALL_R, 0, 6.2832); ctx.fill();
  ctx.rotate(ball.rotation);
  ctx.fillStyle = 'rgba(0,0,0,0.32)';
  for (var i = 0; i < 3; i++) {
    var a = (i / 3) * Math.PI * 2;
    ctx.beginPath();
    ctx.arc(Math.cos(a) * BALL_R * 0.5, Math.sin(a) * BALL_R * 0.5, BALL_R * 0.18, 0, 6.2832);
    ctx.fill();
  }
  ctx.restore();
}

// ── ballistic trajectory sampler (for previews) ─────────────────────────────
function sampleArc(power01, angle, curve, maxPts) {
  var pts = [];
  var p = Math.max(0.06, Math.min(power01, 1)) * MAX_POWER;
  var x = ball.x, y = ball.y, vx = Math.cos(angle) * p, vy = Math.sin(angle) * p;
  var cv2 = (curve || 0) * 0.10;
  for (var i = 0; i < maxPts; i++) {
    for (var s = 0; s < 3; s++) { vy += GRAVITY / 3; vx += cv2 / 3; x += vx / 3; y += vy / 3; }
    if (y >= terrainY(x) - BALL_R) { pts.push({ x: x, y: terrainY(x) - BALL_R, end: true }); break; }
    pts.push({ x: x, y: y });
  }
  return pts;
}

// ════════════════════════════════════════════════════════════════════════════
//  VARIANT 1 — TIMING + POWER METER
//  Oscillating marker sweeps a vertical power bar by the ball; sweet-spot band.
// ════════════════════════════════════════════════════════════════════════════
function meterValue() {
  // triangle wave 0..1 from the oscillator
  var t = (chargeT * 0.9) % 2;
  return t < 1 ? t : 2 - t;
}
var SWEET_LO = 0.78, SWEET_HI = 0.95;
function drawVariant1() {
  if (ball.moving) return;
  var bx = ball.x, by = ball.y;
  // launch direction guide (faint)
  drawAimGuide(bx, by, AIM_ANGLE, 0.6);
  if (!charging) {
    hint('CLICK + HOLD to charge   •   RELEASE on the bright band');
    return;
  }
  var v = meterValue();
  var inSweet = v >= SWEET_LO && v <= SWEET_HI;
  // taller vertical bar to the right of the ball
  var barX = bx + 38, barY0 = by - 86, barH = 132, barW = 18;
  // 1. solid rust TRACK (faceted, opaque) so the meter reads as a real bar
  ctx.fillStyle = PAL.shade;
  roundRect(barX, barY0, barW, barH, 5); ctx.fill();
  // 2. sweet-spot band drawn ON the track
  var sLo = barY0 + barH - barH * SWEET_HI, sHi = barY0 + barH - barH * SWEET_LO;
  ctx.fillStyle = 'rgba(47,240,122,0.85)';
  ctx.fillRect(barX, sLo, barW, sHi - sLo);
  // 3. power fill up to the marker (green in-band, lip-rust otherwise)
  var fillH = barH * v;
  ctx.save();
  roundRect(barX, barY0, barW, barH, 5); ctx.clip();
  ctx.globalAlpha = 0.55;
  ctx.fillStyle = inSweet ? '#2ff07a' : '#e07e5f';
  ctx.fillRect(barX, barY0 + barH - fillH, barW, fillH);
  ctx.restore();
  // 4. bright top lip on the track (our terrain idiom)
  ctx.strokeStyle = inSweet ? '#2ff07a' : PAL.lip; ctx.lineWidth = 1.5;
  roundRect(barX, barY0, barW, barH, 5); ctx.stroke();
  // 5. marker tick
  var my = barY0 + barH - fillH;
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.moveTo(barX - 7, my); ctx.lineTo(barX + barW + 7, my); ctx.stroke();
  // label (mono, uppercase, aligned to bar right edge)
  ctx.fillStyle = inSweet ? '#2ff07a' : '#fff'; ctx.font = FONT(11); ctx.textAlign = 'left';
  ctx.fillText('PWR ' + Math.round(v * 100) + '%', barX + barW + 12, barY0 + 10);
  // launch arrow scales with power
  drawAimGuide(bx, by, AIM_ANGLE, 0.5 + v * 0.5);
  hint(inSweet ? 'RELEASE NOW — sweet spot!' : 'RELEASE on the bright band');
}

// ── shared faint aim guide (arrow in launch dir) ────────────────────────────
function drawAimGuide(bx, by, angle, strength) {
  var len = 28 + 44 * strength;
  var ex = bx + Math.cos(angle) * len, ey = by + Math.sin(angle) * len;
  ctx.strokeStyle = 'rgba(255,255,255,' + (0.25 + 0.5 * strength) + ')';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(ex, ey); ctx.stroke();
  var ah = 9, aa = 0.5;
  ctx.beginPath();
  ctx.moveTo(ex, ey);
  ctx.lineTo(ex - ah * Math.cos(angle - aa), ey - ah * Math.sin(angle - aa));
  ctx.moveTo(ex, ey);
  ctx.lineTo(ex - ah * Math.cos(angle + aa), ey - ah * Math.sin(angle + aa));
  ctx.stroke();
}

// ════════════════════════════════════════════════════════════════════════════
//  VARIANT 2 — DRAG-BACK + LIVE ARC + POWER RING
// ════════════════════════════════════════════════════════════════════════════
function dragPowerAngle() {
  var dx = dragCX - dragSX, dy = dragCY - dragSY;
  var dist = Math.sqrt(dx * dx + dy * dy);
  var power = Math.min(dist * POWER_SCALE / MAX_POWER, 1);     // 0..1
  var angle = Math.atan2(-dy, -dx);                            // opposite of drag
  return { power: power, angle: angle, dist: dist };
}
function drawVariant2() {
  if (ball.moving) return;
  var bx = ball.x, by = ball.y;
  if (!dragging) {
    hint('DRAG BACK from the ball   •   release to launch along the arc');
    // idle ring outline
    ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(bx, by, 22, 0, 6.2832); ctx.stroke();
    return;
  }
  var pa = dragPowerAngle();
  // 1. dark-brown drag dots toward cursor
  var ddx = dragCX - dragSX, ddy = dragCY - dragSY, dd = Math.sqrt(ddx*ddx+ddy*ddy) || 1;
  ctx.fillStyle = 'rgba(80,70,55,0.5)';
  for (var i = 1; i <= Math.min(Math.floor(dd / 10), 14); i++) {
    ctx.beginPath(); ctx.arc(bx + ddx/dd*i*10, by + ddy/dd*i*10, 2.5, 0, 6.2832); ctx.fill();
  }
  // 2. power RING around the ball (fills clockwise with power)
  ctx.strokeStyle = 'rgba(255,255,255,0.15)'; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.arc(bx, by, 22, 0, 6.2832); ctx.stroke();
  ctx.strokeStyle = pa.power > 0.9 ? '#e8c840' : '#2ff07a'; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.arc(bx, by, 22, -Math.PI/2, -Math.PI/2 + pa.power * 6.2832); ctx.stroke();
  // 3. LIVE trajectory arc (dotted)
  var arc = sampleArc(pa.power, pa.angle, 0, 90);
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  for (var k = 0; k < arc.length; k += 4) {
    var pt = arc[k];
    ctx.globalAlpha = 0.85 * (1 - k / arc.length) + 0.15;
    ctx.beginPath(); ctx.arc(pt.x, pt.y, 2, 0, 6.2832); ctx.fill();
  }
  ctx.globalAlpha = 1;
  // landing X marker
  if (arc.length) {
    var end = arc[arc.length - 1];
    ctx.strokeStyle = '#e8c840'; ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(end.x - 5, end.y - 5); ctx.lineTo(end.x + 5, end.y + 5);
    ctx.moveTo(end.x + 5, end.y - 5); ctx.lineTo(end.x - 5, end.y + 5);
    ctx.stroke();
  }
  // launch arrow
  drawAimGuide(bx, by, pa.angle, pa.power);
  hint('RELEASE to fire   •   power ' + Math.round(pa.power * 100) + '%');
}

// ════════════════════════════════════════════════════════════════════════════
//  VARIANT 3 — TWO-STAGE: power meter, then accuracy needle
// ════════════════════════════════════════════════════════════════════════════
function drawVariant3() {
  if (ball.moving) return;
  var bx = ball.x, by = ball.y;
  drawAimGuide(bx, by, AIM_ANGLE, 0.5);
  // horizontal gauge under the ball
  var gx = bx - 70, gy = by + 40, gw = 140, gh = 12;
  function gaugeTrack(label) {
    ctx.fillStyle = 'rgba(255,255,255,0.10)';
    roundRect(gx, gy, gw, gh, 5); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = FONT(10); ctx.textAlign = 'center';
    ctx.fillText(label, bx, gy - 8);
  }
  if (stage === 0) {
    hint('CLICK to start  —  STAGE 1: power');
    return;
  }
  if (stage === 1) {
    var v = meterValue();
    gaugeTrack('POWER');
    ctx.fillStyle = '#e07e5f';
    roundRect(gx, gy, gw * v, gh, 5); ctx.fill();
    // moving marker
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(gx + gw * v, gy - 4); ctx.lineTo(gx + gw * v, gy + gh + 4); ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.font = FONT(11); ctx.textAlign = 'left';
    ctx.fillText(Math.round(v * 100) + '%', gx + gw + 10, gy + 11);
    hint('CLICK to LOCK power');
  } else if (stage === 2) {
    // power locked: show filled, dim
    gaugeTrack('ACCURACY');
    ctx.fillStyle = 'rgba(224,126,95,0.35)';
    roundRect(gx, gy, gw * lockedPower, gh, 5); ctx.fill();
    // accuracy needle gauge below
    var ay = gy + 30;
    ctx.fillStyle = 'rgba(255,255,255,0.10)'; roundRect(gx, ay, gw, gh, 5); ctx.fill();
    // centre sweet zone
    var cz = gw * 0.10;
    ctx.fillStyle = 'rgba(47,240,122,0.30)';
    ctx.fillRect(gx + gw/2 - cz/2, ay - 3, cz, gh + 6);
    ctx.strokeStyle = '#2ff07a'; ctx.lineWidth = 1;
    ctx.strokeRect(gx + gw/2 - cz/2, ay - 3, cz, gh + 6);
    // needle (oscillates fast)
    var nv = meterValue();
    var off = Math.abs(nv - 0.5);
    ctx.strokeStyle = off < 0.05 ? '#2ff07a' : '#fff'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(gx + gw * nv, ay - 5); ctx.lineTo(gx + gw * nv, ay + gh + 5); ctx.stroke();
    // curved-arrow preview based on current needle offset
    var curve = (nv - 0.5) * 2;
    drawAimGuide(bx, by, AIM_ANGLE, lockedPower);
    hint('CLICK on CENTER for a true shot');
  }
}

// ════════════════════════════════════════════════════════════════════════════
//  VARIANT 4 — PULL + TENSION (squash/stretch cord + recoil snap)
// ════════════════════════════════════════════════════════════════════════════
function drawVariant4() {
  if (ball.moving) return;
  var bx = ball.x, by = ball.y;
  if (!dragging) {
    hint('PULL the ball back   •   feel the tension, release to SNAP');
    return;
  }
  var pa = dragPowerAngle();
  // tension cord from an anchor (at tee) to the pulled ball — taut, colour by tension
  var anchorX = TEE_X, anchorY = terrainY(TEE_X) - BALL_R;
  var tension = pa.power;
  // slingshot fork posts (thick, slate)
  ctx.strokeStyle = '#7888a0'; ctx.lineWidth = 4; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(anchorX - 11, anchorY + 16); ctx.lineTo(anchorX - 11, anchorY - 8); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(anchorX + 11, anchorY + 16); ctx.lineTo(anchorX + 11, anchorY - 8); ctx.stroke();
  // two THICK bands to the ball — colour grades lip-rust -> special-green by tension
  var bandCol = tension > 0.92 ? '#2ff07a' : (tension > 0.5 ? '#e07e5f' : '#9fb0c8');
  ctx.lineCap = 'round';
  ctx.strokeStyle = bandCol; ctx.lineWidth = 3 + tension * 4;
  ctx.beginPath(); ctx.moveTo(anchorX - 11, anchorY - 8); ctx.lineTo(bx, by); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(anchorX + 11, anchorY - 8); ctx.lineTo(bx, by); ctx.stroke();
  ctx.lineCap = 'butt';
  // STRETCH the ball along the pull axis (squash perpendicular) — pronounced
  squash.sx = 1 + tension * 0.55 * Math.abs(Math.cos(pa.angle));
  squash.sy = 1 + tension * 0.55 * Math.abs(Math.sin(pa.angle));
  // launch arrow + power label
  drawAimGuide(bx, by, pa.angle, tension);
  // tension meter ring arc
  ctx.strokeStyle = bandCol; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(bx, by, 26, -Math.PI/2, -Math.PI/2 + tension * 6.2832); ctx.stroke();
  hint('RELEASE to SNAP   •   tension ' + Math.round(tension * 100) + '%');
}

// ── helpers ─────────────────────────────────────────────────────────────────
function roundRect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
var _hint = '';
function hint(s) { _hint = s; }

function drawHUD() {
  // title
  ctx.textAlign = 'left';
  ctx.fillStyle = 'rgba(242,236,255,0.9)'; ctx.font = FONT(20);
  ctx.fillText('PAR SEC — STRIKING', 22, 34);
  ctx.fillStyle = '#b88cff'; ctx.font = FONT(13);
  ctx.fillText('[' + variant + ']  ' + VARIANT_NAMES[variant], 22, 56);
  // variant switcher chips
  ctx.font = FONT(12);
  for (var i = 1; i <= 4; i++) {
    var x = W - 22 - (4 - i) * 30 - 30;
    ctx.fillStyle = i === variant ? '#2ff07a' : 'rgba(255,255,255,0.18)';
    roundRect(x, 18, 24, 20, 4); ctx.fill();
    ctx.fillStyle = i === variant ? '#08090f' : 'rgba(255,255,255,0.7)';
    ctx.textAlign = 'center';
    ctx.fillText(String(i), x + 12, 32);
  }
  // bottom hint line
  if (_hint) {
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(242,236,255,0.7)'; ctx.font = FONT(13);
    ctx.fillText(_hint, W / 2, H - 24);
  }
}

// ════════════════════════════════════════════════════════════════════════════
//  AUTO-DEMO  (per variant: addresses, charges, fires, resets)
// ════════════════════════════════════════════════════════════════════════════
function autoDrive() {
  if (!auto) return;
  autoPhase++;
  var f = autoPhase;
  // after the ball settles post-shot, reset to tee and loop
  if (!ball.moving && f > 240) { resetBall(); auto = true; return; }
  if (variant === 1) {
    if (f === 30) { charging = true; chargeT = 0; }
    // release near the sweet spot (chargeT chosen so meterValue ~0.86)
    if (charging) {
      var v = meterValue();
      if (f > 60 && v >= SWEET_LO && v <= SWEET_HI) {
        fire(v, AIM_ANGLE, 0);
      }
    }
  } else if (variant === 2) {
    if (f === 30) { dragging = true; dragSX = ball.x; dragSY = ball.y; dragCX = ball.x; dragCY = ball.y; }
    if (dragging && f < 95) {
      // ease the drag back & down (so launch goes up-right)
      var t = Math.min((f - 30) / 60, 1);
      dragCX = ball.x - 96 * t; dragCY = ball.y + 70 * t;
    }
    if (f === 96) { var pa = dragPowerAngle(); fire(pa.power, pa.angle, 0); }
  } else if (variant === 3) {
    if (f === 30) { stage = 1; chargeT = 0; }
    // stage 1: lock power near the top of the first sweep (so the meter visibly fills first)
    if (stage === 1 && meterValue() >= 0.82 && f > 50) { lockedPower = meterValue(); stage = 2; chargeT = 0; }
    // stage 2: let the accuracy needle sweep for a beat, then release on (near) centre
    if (stage === 2 && f > 95) {
      var nv = meterValue();
      if (Math.abs(nv - 0.5) < 0.05) fire(lockedPower, AIM_ANGLE, (nv - 0.5) * 2);
    }
  } else if (variant === 4) {
    if (f === 30) { dragging = true; dragSX = ball.x; dragSY = ball.y; dragCX = ball.x; dragCY = ball.y; }
    if (dragging && f < 95) {
      var t2 = Math.min((f - 30) / 60, 1);
      dragCX = ball.x - 88 * t2; dragCY = ball.y + 62 * t2;
    }
    if (f === 96) { var pa2 = dragPowerAngle(); recoil = 1; fire(pa2.power, pa2.angle, 0); }
  }
}

// ════════════════════════════════════════════════════════════════════════════
//  FRAME
// ════════════════════════════════════════════════════════════════════════════
function frame() {
  autoDrive();
  physics();
  ctx.clearRect(0, 0, W, H);
  drawSky();
  drawTerrain();
  drawCup();
  drawPuffs();
  drawFlag();
  if (variant === 1) drawVariant1();
  else if (variant === 2) drawVariant2();
  else if (variant === 3) drawVariant3();
  else if (variant === 4) drawVariant4();
  drawBall();
  drawHUD();
}

function loop() {
  if (!paused) frame();
  requestAnimationFrame(loop);
}

// ════════════════════════════════════════════════════════════════════════════
//  LIVE INPUT (mouse/touch + keyboard)
// ════════════════════════════════════════════════════════════════════════════
function canvasPos(e) {
  var r = cv.getBoundingClientRect();
  var sx = cv.width / r.width, sy = cv.height / r.height;
  var cx = (e.touches ? e.touches[0].clientX : e.clientX) - r.left;
  var cy = (e.touches ? e.touches[0].clientY : e.clientY) - r.top;
  return { x: cx * sx, y: cy * sy };
}
function onDown(e) {
  if (ball.moving) return;
  e.preventDefault();
  var p = canvasPos(e);
  if (variant === 1) { charging = true; chargeT = 0; }
  else if (variant === 2 || variant === 4) {
    dragging = true; dragSX = ball.x; dragSY = ball.y; dragCX = p.x; dragCY = p.y;
  } else if (variant === 3) {
    if (stage === 0) { stage = 1; chargeT = 0; }
    else if (stage === 1) { lockedPower = meterValue(); stage = 2; chargeT = 0; }
    else if (stage === 2) { var nv = meterValue(); fire(lockedPower, AIM_ANGLE, (nv - 0.5) * 2); }
  }
}
function onMove(e) {
  if (!dragging) return;
  var p = canvasPos(e); dragCX = p.x; dragCY = p.y;
}
function onUp(e) {
  if (ball.moving) return;
  if (variant === 1 && charging) { fire(meterValue(), AIM_ANGLE, 0); }
  else if (variant === 2 && dragging) { var pa = dragPowerAngle(); if (pa.power > 0.04) fire(pa.power, pa.angle, 0); else dragging = false; }
  else if (variant === 4 && dragging) { var pa2 = dragPowerAngle(); if (pa2.power > 0.04) { recoil = 1; fire(pa2.power, pa2.angle, 0); } else dragging = false; }
}
cv.addEventListener('mousedown', onDown);
window.addEventListener('mousemove', onMove);
window.addEventListener('mouseup', onUp);
cv.addEventListener('touchstart', onDown, { passive: false });
window.addEventListener('touchmove', onMove, { passive: false });
window.addEventListener('touchend', onUp);
window.addEventListener('keydown', function (e) {
  if (e.key >= '1' && e.key <= '4') setVariant(parseInt(e.key, 10));
  if (e.key === 'r' || e.key === 'R') resetBall();
});

function setVariant(n) {
  variant = Math.max(1, Math.min(4, n | 0));
  resetBall();
}

// ════════════════════════════════════════════════════════════════════════════
//  HEADLESS API (for GIF capture)
// ════════════════════════════════════════════════════════════════════════════
window.__setVariant = setVariant;
window.__reset = resetBall;
window.__frame = frame;                 // advance + draw one frame (no rAF)
window.__step = function (n) { for (var i = 0; i < (n || 1); i++) frame(); };
window.__setAuto = function (v) { auto = !!v; if (auto) { paused = false; } autoPhase = 0; };
window.__pause = function (v) { paused = !!v; };
window.__state = function () { return { variant: variant, x: ball.x, y: ball.y, moving: ball.moving, auto: auto }; };

// boot: init state BEFORE the loop (avoid blank first frame)
resetBall();
cv.style.visibility = 'visible';
loop();

})();
