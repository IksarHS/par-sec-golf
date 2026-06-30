// ── atlas-blocks.js — THE STACKS: a Kinda Hard Golf tower on flexible block terrain ───────────────────
// Our game's shot, KHG's gameplay + look (in OUR dark, minimalist art style). The engine heightfield
// ("one ground line per column") can't do a KHG tower, so this planet adds SOLID BLOCK collision
// (circle-vs-AABB) + a custom goal — both via inert peel-off hooks, NO engine-core edits:
//   • RG_ATLAS.collide()       — ball vs solid blocks (overhangs, ceilings, gaps); + HAZARD kill-zones.
//   • RG_ATLAS.isGoalReached() — finish by RESTING ON the GOAL block at the top.
//   • onRest checkpoints       — land on a checkpoint block to save; fall/hit a hazard → respawn there.
//   • frame()                  — PULL-BACK-TO-ZOOM (drag harder → camera eases out to preview the route),
//                                plus the block/hazard/decor rendering.
// The shot (aim + power + gravity) is the engine's, unchanged. Gated (?course=blocks); peel the file +
// its <script> tag → the hooks go inert and the base game is byte-for-byte unchanged.
(function () {
  if (typeof window === 'undefined' || !window.RG_ATLAS) return;
  var A = window.RG_ATLAS;
  var BR = (typeof BALL_RADIUS !== 'undefined') ? BALL_RADIUS : 6;

  // a dead-flat FLOOR archetype (the tee sits on it; the tower floats above).
  if (typeof archetypes !== 'undefined' && !archetypes.blocks_floor) {
    archetypes.blocks_floor = function (sx, sy, dist) { return [{ x: sx + dist, y: clampY(sy) }]; };
    if (typeof ARCHETYPE_TABLE !== 'undefined') ARCHETYPE_TABLE.push(['blocks_floor', 0, 1, 1]);
  }

  // ── the level: a hand-authored KHG-style climb ─────────────────────────────────────────────────────
  // Narrow, varied ledges that zig-zag UP; an OVERHANG pocket you must exit sideways; HAZARD spike-zones
  // in the gaps so a missed hop dies (→ back to your last checkpoint, not a safe lower ledge); 2
  // checkpoints; a GOAL block at the top. Deterministic (no random) so it reads as designed, not noise.
  function buildTower(p) {
    var fy = (typeof holes !== 'undefined' && holes[0]) ? holes[0].teeY : H * 0.65;
    var B = [];
    function add(x, y, w, h, t) { B.push({ x: x, y: y, w: w, h: h, type: t || 'block' }); }
    add(280, fy - 145, 140, 22, 'block');       // L1
    add(440, fy - 138, 110, 16, 'hazard');      // HZ1 — overshoot L1 right → spikes
    add(560, fy - 255, 130, 22, 'block');       // L2
    add(540, fy - 372, 205, 24, 'ceiling');     // O1 — OVERHANG over L2 → must exit up-LEFT
    add(440, fy - 262, 100, 16, 'hazard');      // HZ2 — the L2→C1 gap
    add(275, fy - 388, 150, 22, 'checkpoint');  // C1 (around the overhang, up-left)
    add(455, fy - 398, 105, 16, 'hazard');      // HZ3 — gap right of C1
    add(565, fy - 512, 120, 22, 'block');       // L3
    add(330, fy - 632, 150, 22, 'block');       // L4
    add(470, fy - 642, 100, 16, 'hazard');      // HZ4 — gap under the L4→C2 line
    add(545, fy - 752, 150, 22, 'checkpoint');  // C2
    add(360, fy - 872, 140, 22, 'block');       // L5
    add(430, fy - 998, 175, 26, 'goal');        // GOAL (top)
    p._blocks = B;
    p._goal = B[B.length - 1];
    p._floorY = fy;
    var tx = holes[0] ? holes[0].teeX : 120;
    p._cp = { x: tx, y: fy - BR };                                   // respawn starts at the tee
    if (holes[0]) { holes[0].cupX = p._goal.x + p._goal.w / 2; holes[0].cupY = p._goal.y - BR; holes[0].flagVisible = false; }
  }

  A.register({
    id: 'blocks', name: 'The Stacks', blurb: 'climb a tower of floating blocks to the top — Kinda Hard Golf gameplay + look, in our style (overhangs, spike hazards, checkpoints)',
    mats: [['slate', 'rock', { restitution: 0.28, rollingFriction: 0.92, surfaceFriction: 0.014, color: '#3a3a44', colorLight: '#4e4e5a' }]],
    course: {
      worldName: 'The Stacks · climb the tower', sky: '#0b0a14', defaultMaterial: 'slate', materials: ['slate'],
      archetypes: ['blocks_floor'],
      cupElevation: function (teeY) { return teeY; },
      difficultyRange: [0.3, 0.5], holeDistMin: 900, holeDistMax: 960, holeCount: 1,
      phys: { gravityScale: 1.5, windScale: 0 },
    },
    hooks: {
      onStart: function (p) { buildTower(p); },

      // ── solid-block collision (+ hazard kill-zones) ────────────────────────────────────────────────
      collide: function (p) {
        if (typeof ball === 'undefined' || !p._blocks) return false;
        var sim = !!(window.RG && RG._simulating);
        var rest = (typeof MATERIALS !== 'undefined' && MATERIALS.slate) ? MATERIALS.slate.restitution : 0.28;
        var onTop = false;
        for (var i = 0; i < p._blocks.length; i++) {
          var pl = p._blocks[i];
          var qx = Math.max(pl.x, Math.min(ball.x, pl.x + pl.w));
          var qy = Math.max(pl.y, Math.min(ball.y, pl.y + pl.h));
          var dx = ball.x - qx, dy = ball.y - qy, d2 = dx * dx + dy * dy;
          if (d2 >= BR * BR) continue;                                 // no overlap
          if (pl.type === 'hazard') {                                  // spikes = death → back to checkpoint (live only)
            if (!sim && p._cp) { ball.x = p._cp.x; ball.y = p._cp.y; ball.vx = 0; ball.vy = 0; ball.onGround = true; ball._onBlock = null; }
            continue;                                                  // non-solid: no bounce
          }
          var nx, ny, pen;
          if (d2 < 0.0001) {
            var L = ball.x - pl.x, Rr = pl.x + pl.w - ball.x, T = ball.y - pl.y, Bm = pl.y + pl.h - ball.y;
            var m = Math.min(L, Rr, T, Bm);
            if (m === T) { nx = 0; ny = -1; pen = T + BR; }
            else if (m === Bm) { nx = 0; ny = 1; pen = Bm + BR; }
            else if (m === L) { nx = -1; ny = 0; pen = L + BR; }
            else { nx = 1; ny = 0; pen = Rr + BR; }
          } else {
            var d = Math.sqrt(d2); nx = dx / d; ny = dy / d; pen = BR - d;
          }
          ball.x += nx * pen; ball.y += ny * pen;
          var dot = ball.vx * nx + ball.vy * ny;
          if (dot < 0) { ball.vx -= (1 + rest) * dot * nx; ball.vy -= (1 + rest) * dot * ny; }
          if (ny < -0.5) { onTop = true; ball.lastCollidedMat = 'slate'; ball._onBlock = pl; }
        }
        if (!onTop) ball._onBlock = null;
        return onTop;
      },

      // ── goal: rest on the goal block near its centre ───────────────────────────────────────────────
      isGoalReached: function (p) {
        if (typeof ball === 'undefined' || !p._goal || !ball.atRest) return false;
        var g = p._goal;
        if (ball.x > g.x && ball.x < g.x + g.w && Math.abs(ball.y - (g.y - BR)) < BR + 6) {
          return (typeof holes !== 'undefined') ? holes[currentHole] : true;
        }
        return false;
      },

      // ── checkpoints: land on one → save; come to rest far below it → respawn (a fall off the tower) ──
      onRest: function (p) {
        if (typeof ball === 'undefined' || !p._blocks) return false;
        var b = ball._onBlock;
        if (b && b.type === 'checkpoint' && (!p._cp || (b.y - BR) < p._cp.y - 8)) {
          p._cp = { x: b.x + b.w / 2, y: b.y - BR }; b._lit = true;
        }
        if (p._cp && ball.y > p._cp.y + H * 0.55) {
          ball.x = p._cp.x; ball.y = p._cp.y; ball.vx = 0; ball.vy = 0; ball.onGround = true; ball.atRest = true;
          return true;
        }
        return false;
      },

      // ── draw: pull-back-zoom + decor + blocks/hazards in our dark minimalist style ──────────────────
      frame: function (ctx, p) {
        // PULL-BACK-TO-ZOOM: while aiming, ease the camera OUT with shot power, pivoting on the ball.
        if (window.RG) {
          var z = 0.82;
          if (typeof aiming !== 'undefined' && aiming && typeof aimStartX !== 'undefined') {
            var ddx = aimStartX - aimCurrentX, ddy = aimStartY - aimCurrentY;
            var dd = Math.sqrt(ddx * ddx + ddy * ddy);
            var ps = (typeof POWER_SCALE !== 'undefined') ? POWER_SCALE : 0.1;
            var mp = (typeof MAX_POWER !== 'undefined') ? MAX_POWER : 8;
            z = 0.82 - 0.40 * (Math.min(dd * ps, mp) / mp);
          }
          RG._zoom = z;
          RG._zoomPivot = { x: ball.x - camera.x, y: ball.y - ((typeof camera !== 'undefined' && camera.y) || 0) };
        }
        if (!p._blocks) return;
        var fy = p._floorY || H * 0.65;

        // ── decor (behind the blocks): a dim background planet + a faint structural spine ──
        ctx.save();
        ctx.globalAlpha = 0.16; ctx.fillStyle = '#332b4e';
        ctx.beginPath(); ctx.arc(W * 0.16, fy - 470, 300, 0, 6.2832); ctx.fill();   // distant planet
        ctx.globalAlpha = 0.10; ctx.fillStyle = '#0e1726';
        ctx.beginPath(); ctx.arc(W * 0.16, fy - 470, 300, 0, 3.1416, false); ctx.fill();   // shaded lower half
        ctx.globalAlpha = 0.07; ctx.strokeStyle = '#8a86a0'; ctx.lineWidth = 26;     // faint tower spine
        ctx.beginPath(); ctx.moveTo(W / 2, fy); ctx.lineTo(W / 2, fy - 1020); ctx.stroke();
        ctx.restore();

        // ── blocks ──
        for (var i = 0; i < p._blocks.length; i++) {
          var b = p._blocks[i];
          if (b.type === 'hazard') {                                   // spike strip in a danger magenta
            ctx.fillStyle = '#160a12'; ctx.fillRect(b.x, b.y, b.w, b.h);
            ctx.fillStyle = 'rgba(214,72,108,0.92)';
            var n = Math.max(3, Math.round(b.w / 17)), sw = b.w / n;
            for (var s = 0; s < n; s++) { var sx = b.x + s * sw; ctx.beginPath(); ctx.moveTo(sx, b.y + 2); ctx.lineTo(sx + sw / 2, b.y - 10); ctx.lineTo(sx + sw, b.y + 2); ctx.closePath(); ctx.fill(); }
            ctx.globalAlpha = 0.18; ctx.fillStyle = '#d6486c'; ctx.fillRect(b.x, b.y - 12, b.w, 14); ctx.globalAlpha = 1;
            continue;
          }
          var lit = b._lit || b.type === 'goal';
          ctx.fillStyle = 'rgba(0,0,0,0.32)'; ctx.fillRect(b.x + 3, b.y + 5, b.w, b.h);   // drop shadow (depth)
          ctx.fillStyle = '#3a3a44'; ctx.fillRect(b.x, b.y, b.w, b.h);                     // body
          ctx.fillStyle = '#2a2a32'; ctx.fillRect(b.x, b.y + b.h - 3, b.w, 3); ctx.fillRect(b.x + b.w - 3, b.y, 3, b.h);  // dark edges
          ctx.fillStyle = (b.type === 'goal') ? '#caa64a' : (b._lit ? '#c8a24a' : '#5a5668');  // top cap (gold = lit/goal)
          ctx.fillRect(b.x, b.y, b.w, 5);
          ctx.fillStyle = 'rgba(205,205,225,0.22)'; ctx.fillRect(b.x, b.y, b.w, 1);          // rim highlight
          if (b.type === 'ceiling') { ctx.fillStyle = 'rgba(214,72,108,0.45)'; ctx.fillRect(b.x, b.y + b.h - 3, b.w, 3); }  // mark the underside
          if (b.type === 'checkpoint' || b.type === 'goal') {                                // flag
            var fx = b.x + b.w / 2, fyy = b.y;
            ctx.strokeStyle = lit ? 'rgba(240,200,96,0.95)' : 'rgba(150,150,170,0.75)'; ctx.lineWidth = 1.6;
            ctx.beginPath(); ctx.moveTo(fx, fyy); ctx.lineTo(fx, fyy - 30); ctx.stroke();
            ctx.fillStyle = lit ? '#f0c860' : 'rgba(150,150,170,0.75)';
            ctx.beginPath(); ctx.moveTo(fx, fyy - 30); ctx.lineTo(fx + 14, fyy - 25); ctx.lineTo(fx, fyy - 20); ctx.closePath(); ctx.fill();
          }
        }
      },

      camera: function (p) {
        if (typeof camera === 'undefined' || typeof ball === 'undefined') return false;
        var fx = ball.x, fy = ball.y - 90;                                    // look up the climb
        camera.x += ((fx - W / 2) - camera.x) * 0.10;
        camera.y += ((fy - H / 2) - camera.y) * 0.10;
        return true;
      },
    },
  });
})();
