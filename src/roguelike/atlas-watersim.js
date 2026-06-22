// ── atlas-watersim.js — WATER SIMULATOR (on a real hole) ──────────────────────────────────────────
// A peel-off dev mode (?watersim) that runs the standalone water-sandbox's good HEIGHT-FIELD water on a
// REAL generated hole — real heightfield terrain (drawTerrainDG), the real engine ball + drag-aim. You can
//   (1) POUR water anywhere onto the terrain (click / click-and-HOLD above the ground) → it pools in the
//       dips, the level RISES (volume → surface), ripples, and OVERFLOWS the rims into lower basins, and
//   (2) shoot the real ball → a clear SPLASH (ripples + droplets) on hitting the surface, SINK in deep
//       water (hazard: settles, then reshoots from the last dry rest), bounce/roll on dry land as normal.
//
// The water surface is a row of springs (wave-equation height field) on top of a column model whose floor
// is the engine terrainYAt(x); flowWater() settles/spills volume between columns so it fills the basins.
// Renders in WORLD space (RG_ATLAS.frame, inside the camera transform) — it REPLACES the engine's flat
// water for this mode (this course never registers a flat pool, so src/water.js's drawWater/collideWater
// no-op). Screen-space pour hint + CLEAR WATER button via frameScreen.
//
// Built on the engine's inert atlas hooks (NO core edits): RG_ATLAS.register + camera()/collide()/frame()/
// frameScreen(), a registered archetype + course, and an autostart for ?watersim. Gated on
// RG.course === 'watersim' — every hook no-ops on any other course; peel the file + its <script> tag (+
// the ?watersim autostart) and the base game is byte-for-byte unchanged.
(function () {
  if (typeof window === 'undefined' || !window.RG_ATLAS) return;
  var A = window.RG_ATLAS;
  var ID = 'watersim';

  function isWS() { return !!(window.RG && RG.course === ID); }
  function H_() { return (typeof H !== 'undefined') ? H : 540; }
  function W_() { return (typeof W !== 'undefined') ? W : 960; }

  // ── PALETTE (matches the water-sandbox / water-test look) ──
  var WATER = 'rgba(58,126,200,0.92)', DEEP = 'rgba(12,40,78,0.72)',
      HI = 'rgba(205,238,252,0.55)', DROP = '#9bd4f2', POUR = 'rgba(120,185,235,0.92)';

  // ── the basin archetype — a hilly run with several distinct dips so water pools, spills + cascades ──
  // World-coord version of the water-sandbox terrain: a rolling baseline with subtracted Gaussian basins
  // of varied width/depth (deep wide pool, narrow well, broad shallow dish …). Registered as a pure ADD
  // onto the engine's archetype table; only this course's archetype subset names it, so it's inert
  // everywhere else. The cup sits on a flat green at the far end (dry).
  if (typeof archetypes !== 'undefined' && !archetypes.watersim_basins) {
    archetypes.watersim_basins = function (sx, sy, dist, cupY, diff) {
      // basins expressed as fractions of the hole span, so they scale with dist. {f: centre frac, w, d}
      var span = dist;
      var BAS = [
        { f: 0.16, w: 70, d: 150 },   // wide deep pool
        { f: 0.34, w: 46, d: 110 },   // medium pit
        { f: 0.50, w: 34, d: 165 },   // narrow deep well
        { f: 0.66, w: 64, d: 95  },   // broad shallow dish
        { f: 0.82, w: 44, d: 130 }    // right pocket
      ];
      var basins = BAS.map(function (b) { return { cx: sx + span * b.f, w: b.w, d: b.d }; });
      function gy(x) {
        var y = sy + Math.sin((x - sx) * 0.011) * 16;     // gentle rolling baseline
        for (var i = 0; i < basins.length; i++) {
          var b = basins[i], t = (x - b.cx) / b.w;
          y += b.d * Math.exp(-t * t * 1.6);              // dig the basin (down = +y)
        }
        return clampY(y);
      }
      var verts = [];
      var greenStart = sx + dist - 110;
      for (var x = sx; x < greenStart; x += 14) verts.push({ x: x, y: gy(x) });
      // flat green + cup pad at the far end (dry, above the water)
      var greenY = clampY(sy + 8);
      verts.push({ x: greenStart, y: greenY });
      verts.push({ x: sx + dist, y: greenY });
      return verts;
    };
    if (typeof ARCHETYPE_TABLE !== 'undefined') ARCHETYPE_TABLE.push(['watersim_basins', 0.0, 5.0, 1]);
  }

  // ── HEIGHT-FIELD WATER (column model on terrainYAt) ───────────────────────────────────────────────
  // Columns span the hole's world X. Each column has a terrain floor tY (from terrainYAt) and a water
  // surface wy (== floor when dry). Pour raises wy; flowWater() moves volume between neighbours toward the
  // lower level (fills/overflows); a wave-equation ripple field hh/hv perturbs the drawn surface.
  var NC = 0, x0 = 0, x1 = 0, cw = 0;
  var tY = null, wy = null, hh = null, hv = null;
  var drops = [], pourStreams = [], frame = 0, hint = 360, built = false;
  var FLOORDEPTH = 360;                                   // max water column depth (px) — a hard fill clamp

  function colX(i) { return x0 + (i + 0.5) * cw; }
  function colAt(x) { var i = Math.floor((x - x0) / cw); return i < 0 ? 0 : (i > NC - 1 ? NC - 1 : i); }
  function depth(i) { return tY[i] - wy[i]; }

  function buildField() {
    var h = (typeof holes !== 'undefined') ? holes[(typeof currentHole !== 'undefined') ? currentHole : 0] : null;
    if (!h || typeof terrainYAt !== 'function') { built = false; return; }
    x0 = h.teeX - 30; x1 = h.cupX + 30;
    NC = Math.max(80, Math.min(420, Math.round((x1 - x0) / 5)));
    cw = (x1 - x0) / NC;
    tY = new Float32Array(NC); wy = new Float32Array(NC); hh = new Float32Array(NC); hv = new Float32Array(NC);
    for (var i = 0; i < NC; i++) { tY[i] = terrainYAt(colX(i)); wy[i] = tY[i]; }
    drops = []; pourStreams = []; built = true;
  }
  function clearWater() { if (!built) return; for (var i = 0; i < NC; i++) { wy[i] = tY[i]; hh[i] = 0; hv[i] = 0; } drops = []; pourStreams = []; }

  // POUR: add a slug of water volume into the column under x (raise its surface), ripple, throw droplets.
  function pourInto(x) {
    var i = colAt(x);
    wy[i] -= 2.6;                                          // raise (y smaller = higher)
    if (wy[i] < tY[i] - FLOORDEPTH) wy[i] = tY[i] - FLOORDEPTH;
    hv[i] -= 0.5; if (i > 0) hv[i - 1] -= 0.25; if (i < NC - 1) hv[i + 1] -= 0.25;
    if (Math.random() < 0.5) {
      var sy = wy[i] - 2, a = -Math.PI / 2 + (Math.random() - 0.5) * 1.4, s = 1 + Math.random() * 2;
      drops.push({ x: x + (Math.random() - 0.5) * 12, y: sy, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0, max: 26, sz: 1.4 + Math.random() * 1.6 });
    }
  }
  function addPourStream(x, y) { if (!built) return; pourStreams.push({ x: x, y: Math.min(y, terrainYAt(x) - 4), t: 0 }); }

  // FLOW: per adjacent pair, move volume from the higher surface to the lower (settle / fill / overflow).
  function flowWater() {
    var ITER = 4;
    for (var k = 0; k < ITER; k++) {
      var fwd = (k % 2 === 0);
      for (var s = 0; s < NC - 1; s++) {
        var i = fwd ? s : (NC - 2 - s), j = i + 1;
        var di = depth(i), dj = depth(j);
        if (di <= 0 && dj <= 0) continue;
        var li = wy[i], lj = wy[j];
        if (Math.abs(li - lj) < 0.02) continue;
        var hi = li < lj ? i : j, lo = li < lj ? j : i;   // hi = higher water surface (smaller y)
        if (depth(hi) <= 0) continue;
        var diff = wy[lo] - wy[hi], move = diff * 0.5;
        if (move > depth(hi)) move = depth(hi);
        wy[hi] += move; wy[lo] -= move;
        if (wy[lo] < tY[lo] - FLOORDEPTH) wy[lo] = tY[lo] - FLOORDEPTH;
        if (wy[hi] > tY[hi]) wy[hi] = tY[hi];
        if (wy[lo] > tY[lo]) wy[lo] = tY[lo];
      }
    }
    for (var i2 = 0; i2 < NC; i2++) if (depth(i2) < 0.4) wy[i2] = tY[i2];
  }

  function stepRipples() {
    var T = 0.022, S = 0.26, D = 0.972;
    for (var i = 0; i < NC; i++) {
      if (depth(i) <= 0.5) { hh[i] *= 0.6; hv[i] *= 0.6; continue; }
      var l = i > 0 ? hh[i - 1] : hh[i], r = i < NC - 1 ? hh[i + 1] : hh[i];
      hv[i] += (-T * hh[i]) + S * ((l + r) * 0.5 - hh[i]); hv[i] *= D;
    }
    for (var i = 0; i < NC; i++) hh[i] += hv[i];
  }
  function surfYAt(x) { var i = colAt(x); return wy[i] + (depth(i) > 0.5 ? hh[i] : 0); }
  function waterDepthAt(x) { var i = colAt(x); return tY[i] - wy[i]; }   // live (uses current wy), not ripple

  // SPLASH: a dent in the spring field + a fan of droplets, sized to impact speed.
  function splash(x, speed) {
    speed = Math.min(speed, 18);
    var idx = colAt(x);
    for (var o = -6; o <= 6; o++) { var j = idx + o; if (j >= 1 && j < NC - 1 && depth(j) > 0.5) hv[j] -= speed * 0.45 * Math.exp(-o * o * 0.12); }
    var n = Math.round(6 + speed * 0.9);
    for (var d = 0; d < n; d++) {
      var a = -Math.PI / 2 + (Math.random() - 0.5) * 1.8, sp = 1.5 + Math.random() * speed * 0.5;
      drops.push({ x: x + (Math.random() - 0.5) * 16, y: surfYAt(x) - 3, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 1.25, life: 0, max: 22 + Math.random() * 16, sz: 1.6 + Math.random() * 2.2 });
    }
  }

  function stepDrops() {
    for (var i = drops.length - 1; i >= 0; i--) {
      var p = drops[i]; p.life++; p.vy += 0.2; p.x += p.vx; p.y += p.vy;
      if (p.vy > 0 && waterDepthAt(p.x) > 0.5 && p.y >= surfYAt(p.x)) { var j = colAt(p.x); if (j >= 1 && j < NC - 1) hv[j] -= 0.4; drops.splice(i, 1); continue; }
      if (p.life > p.max || p.y > terrainYAt(p.x) + 4) drops.splice(i, 1);
    }
  }

  // step the whole water sim one frame (called from the world-frame hook, once per draw).
  function stepSim() {
    if (!built) return;
    frame++;
    for (var i = pourStreams.length - 1; i >= 0; i--) { var ps = pourStreams[i]; ps.t++; pourInto(ps.x); if (ps.t > 2) pourStreams.splice(i, 1); }
    if (heldPour) addPourStream(heldPour.x, heldPour.y);   // continuous pour while the button is held
    flowWater(); stepRipples(); stepDrops();
  }

  // ── BALL ↔ WATER (splash + sink hazard) ───────────────────────────────────────────────────────────
  // The engine ball flies/rolls on the heightfield as normal (base collide owns the terrain). We add:
  //  • SPLASH when it first crosses the water surface coming down,
  //  • SINK in DEEP water → a short sink, then OOB-style reshoot from the last dry rest (mirrors water.js).
  // Side-effect only: we mutate ball velocity / position and return false so the base collide still runs.
  var sinkT = null, lastSafeX = null;
  function ballWater() {
    if (!built || typeof ball === 'undefined') return false;
    var dep = waterDepthAt(ball.x);
    if (dep > 0.5 && ball.y + (typeof BALL_RADIUS !== 'undefined' ? BALL_RADIUS : 4) >= surfYAt(ball.x)) {
      if (sinkT == null) {                                 // moment of entry → splash sized to impact speed
        var spd = Math.hypot(ball.vx || 0, ball.vy || 0);
        splash(ball.x, spd);
        sinkT = 0;
      }
      sinkT++;
      ball.vx *= 0.7; ball.vy = ball.vy * 0.55 + 0.5;      // water drag, slow sink
      ball.atRest = false; ball.onGround = false;
      if (frame % 6 === 0) { var i = colAt(ball.x); if (depth(i) > 1) hv[i] -= 0.3; }
      if (sinkT >= 14) {                                   // sunk → reshoot from last dry rest
        var sx = (lastSafeX != null) ? lastSafeX : (holes[currentHole] ? holes[currentHole].teeX : ball.x);
        ball.x = sx; ball.y = terrainYAt(sx) - (typeof BALL_RADIUS !== 'undefined' ? BALL_RADIUS : 4);
        ball.vx = 0; ball.vy = 0; ball.atRest = true; ball.onGround = true;
        if (typeof state !== 'undefined' && typeof STATE_AIM !== 'undefined') state = STATE_AIM;
        sinkT = null;
      }
      return true;
    }
    sinkT = null;
    if (ball.atRest && waterDepthAt(ball.x) <= 0.5) lastSafeX = ball.x;   // remember last dry rest
    return false;
  }

  // ── camera: frame the whole hole (sandbox view), gentle follow in flight ───────────────────────────
  function teeX() { var h = holes[(typeof currentHole !== 'undefined') ? currentHole : 0]; return h ? h.teeX : 0; }
  function camHook() {
    if (!isWS()) return false;
    if (typeof camera === 'undefined' || typeof ball === 'undefined') return false;
    var h = holes[(typeof currentHole !== 'undefined') ? currentHole : 0]; if (!h) return false;
    var W = W_(), Hh = H_();
    // static frame: centre the whole hole horizontally; keep camera.y = 0 (terrain fits the band).
    var centre = (h.teeX + h.cupX) / 2;
    var targetX = centre - W / 2;
    camera.x += (targetX - camera.x) * 0.12;
    camera.y += (0 - camera.y) * 0.12;
    return true;
  }

  // ── world-space draw: the height-field water + pour streams + droplets ─────────────────────────────
  function drawWaterWorld(ctx) {
    if (!built) return;
    var i = 0;
    while (i < NC) {
      if (depth(i) <= 0.5) { i++; continue; }
      var s = i; while (i < NC && depth(i) > 0.5) i++;
      var e = i - 1;
      function bodyPath() {
        ctx.beginPath();
        ctx.moveTo(colX(s), wy[s] + hh[s]);
        for (var j = s; j <= e; j++) ctx.lineTo(colX(j), wy[j] + hh[j]);
        for (var j2 = e; j2 >= s; j2--) ctx.lineTo(colX(j2), tY[j2]);
        ctx.closePath();
      }
      ctx.fillStyle = WATER; bodyPath(); ctx.fill();
      var minWy = 1e9, maxT = -1e9;
      for (var j = s; j <= e; j++) { if (wy[j] < minWy) minWy = wy[j]; if (tY[j] > maxT) maxT = tY[j]; }
      var wg = ctx.createLinearGradient(0, minWy, 0, maxT); wg.addColorStop(0, 'rgba(0,0,0,0)'); wg.addColorStop(1, DEEP);
      ctx.fillStyle = wg; bodyPath(); ctx.fill();
      ctx.strokeStyle = HI; ctx.lineWidth = 2; ctx.beginPath();
      ctx.moveTo(colX(s), wy[s] + hh[s]);
      for (var j3 = s; j3 <= e; j3++) ctx.lineTo(colX(j3), wy[j3] + hh[j3]);
      ctx.stroke();
    }
    // pour streams (vertical wobbling sheet, terrain floor → surface)
    ctx.fillStyle = POUR;
    for (var p = 0; p < pourStreams.length; p++) {
      var ps = pourStreams[p], by = surfYAt(ps.x) - 2;
      for (var y = ps.y; y < by; y += 6) { var wob = Math.sin(y * 0.12 + frame * 0.5) * 1.8; ctx.fillRect(ps.x - 4 + wob, y, 8, 6); }
    }
    // droplets
    for (var d = 0; d < drops.length; d++) {
      var q = drops[d];
      ctx.globalAlpha = Math.max(0, 1 - q.life / q.max) * 0.92; ctx.fillStyle = DROP;
      ctx.fillRect(q.x - q.sz / 2, q.y - q.sz / 2, q.sz, q.sz);
    }
    ctx.globalAlpha = 1;
  }

  // the world-space frame hook: step the sim + draw water (inside the camera transform).
  function frameHook(ctx) {
    if (!isWS() || !ctx) return;
    if (!built) buildField();
    stepSim();
    drawWaterWorld(ctx);
  }

  // ── screen-space HUD: pour hint + CLEAR WATER button ──
  var CLEAR_BTN = { x: 0, y: 16, w: 132, h: 30 };
  function clearBtnRect() { var W = W_(); return { x: W - CLEAR_BTN.w - 22, y: 16, w: CLEAR_BTN.w, h: CLEAR_BTN.h }; }
  function frameScreenHook(ctx) {
    if (!isWS() || !ctx) return;
    var W = W_();
    // hint (top-left, fades after a while)
    if (hint > 0) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, hint / 90);
      ctx.fillStyle = 'rgba(8,12,20,0.62)'; ctx.fillRect(20, 14, 470, 58);
      ctx.fillStyle = 'rgba(235,244,255,0.95)'; ctx.font = "13px 'Departure Mono', monospace"; ctx.textAlign = 'left';
      ctx.fillText('WATER SIM · click / HOLD above the ground → POUR water', 32, 36);
      ctx.fillText('drag back from the ball → aim + power, release → SHOOT', 32, 56);
      ctx.restore();
      hint--;
    }
    // CLEAR WATER button
    var b = clearBtnRect();
    ctx.save();
    ctx.fillStyle = 'rgba(20,28,40,0.85)'; ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.strokeStyle = 'rgba(120,185,235,0.8)'; ctx.lineWidth = 1.5; ctx.strokeRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = 'rgba(235,244,255,0.92)'; ctx.font = "12px 'Departure Mono', monospace";
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('CLEAR WATER', b.x + b.w / 2, b.y + b.h / 2);
    ctx.restore();
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  }

  // ── register the course + hooks ──
  A.register({
    id: ID,
    name: 'Water Sim',
    blurb: 'pour water on a real hole — it pools in the dips, ripples + overflows; shoot the ball → splash + sink',
    mats: [['wsturf', 'sand', { restitution: 0.42, rollingFriction: 0.965, surfaceFriction: 0.008, color: '#b76b38', colorLight: '#d18a52' }]],
    course: {
      worldName: 'Water Sim · pour & shoot on a real hole',
      sky: '#171c26',
      defaultMaterial: 'wsturf', materials: ['wsturf'],
      archetypes: ['watersim_basins'],
      difficultyRange: [0.0, 0.0],
      holeDistMin: 920, holeDistMax: 920,
      holeCount: 1,
      cupElevation: function (tY2) { return tY2; },
    },
    hooks: {
      beforeStart: function () { built = false; sinkT = null; lastSafeX = null; hint = 360; if (window.RG) { RG._clampYBand = null; RG._zoom = 1; } },
      onStart: function () { built = false; setTimeout(function () { buildField(); }, 60); },
      camera: camHook,
      collide: function () { if (!isWS()) return false; ballWater(); return false; },   // side-effect only; base collide owns terrain/rest
      frame: frameHook,
      frameScreen: frameScreenHook,
    },
  });

  // ── POUR INPUT (capture-phase, so it pre-empts the engine's drag-aim for pour clicks) ──
  // A pour is a press that is NOT near the ball and NOT on the CLEAR button. We handle it here and
  // stopPropagation so gameplay.js never starts an aim drag for it. Near the ball → let the event through
  // so the normal drag-aim shot works. Gated on isWS(): inert in every other mode.
  var heldPour = null;
  function evtWorld(e) {
    var cx = (e.touches && e.touches[0]) ? e.touches[0].clientX : e.clientX;
    var cy = (e.touches && e.touches[0]) ? e.touches[0].clientY : e.clientY;
    var cnv = document.getElementById('c'); if (!cnv) return null;
    var r = cnv.getBoundingClientRect();
    var gx = (cx - r.left) * (W_() / r.width), gy = (cy - r.top) * (H_() / r.height);
    return { gx: gx, gy: gy, wx: gx + ((typeof camera !== 'undefined' && camera.x) || 0), wy: gy + ((typeof camera !== 'undefined' && camera.y) || 0) };
  }
  function nearBall(wx, wy) {
    if (typeof ball === 'undefined') return false;
    return Math.hypot(wx - ball.x, wy - ball.y) < 40 && (typeof state === 'undefined' || state === STATE_AIM);
  }
  function onDown(e) {
    if (!isWS() || !built) return;
    var p = evtWorld(e); if (!p) return;
    var b = clearBtnRect();
    if (p.gx >= b.x && p.gx <= b.x + b.w && p.gy >= b.y && p.gy <= b.y + b.h) { clearWater(); e.stopPropagation(); e.preventDefault(); return; }
    if (nearBall(p.wx, p.wy)) return;                      // let the engine handle the drag-aim shot
    // a pour: above the terrain, inside the field
    if (p.wx > x0 && p.wx < x1 && p.wy < terrainYAt(p.wx) - 2) {
      addPourStream(p.wx, p.wy);
      heldPour = { x: p.wx, y: p.wy };
      e.stopPropagation(); e.preventDefault();
    }
  }
  function onMove(e) {
    if (!heldPour) return;
    var p = evtWorld(e); if (!p) return;
    if (p.wx > x0 && p.wx < x1 && p.wy < terrainYAt(p.wx) - 2) heldPour = { x: p.wx, y: p.wy };
  }
  function onUp() { heldPour = null; }
  document.addEventListener('mousedown', onDown, true);
  document.addEventListener('mousemove', onMove, true);
  window.addEventListener('mouseup', onUp, true);
  document.addEventListener('touchstart', onDown, true);
  document.addEventListener('touchmove', onMove, true);
  window.addEventListener('touchend', onUp, true);

  // ── public test hooks ──
  window.__ws = {
    pour: function (wx, wy) { addPourStream(wx, wy == null ? terrainYAt(wx) - 80 : wy); },
    pourAt: function (frac, above) {   // frac 0..1 along the hole; pour from `above` px over the terrain
      var h = holes[(typeof currentHole !== 'undefined') ? currentHole : 0]; if (!h) return;
      var wx = h.teeX + (h.cupX - h.teeX) * frac;
      addPourStream(wx, terrainYAt(wx) - (above == null ? 90 : above));
    },
    hold: function (frac) { var h = holes[currentHole]; if (!h) return; var wx = h.teeX + (h.cupX - h.teeX) * frac; heldPour = { x: wx, y: terrainYAt(wx) - 90 }; },
    release: function () { heldPour = null; },
    clear: clearWater,
    shoot: function (vx, vy) { if (typeof ball === 'undefined') return; ball.vx = vx; ball.vy = vy; ball.atRest = false; ball.onGround = false; if (typeof state !== 'undefined') state = STATE_FLIGHT; },
    state: function () {
      if (!built) return { built: false };
      var wet = 0, maxd = 0; for (var i = 0; i < NC; i++) { if (depth(i) > 0.5) wet++; if (depth(i) > maxd) maxd = depth(i); }
      return { built: true, NC: NC, wetCols: wet, maxDepth: Math.round(maxd), drops: drops.length, ballX: Math.round(ball.x), ballY: Math.round(ball.y), sinkT: sinkT, frame: frame };
    },
    rebuild: buildField,
  };

  // ── AUTOSTART for ?watersim (not a ?course= flag) ──
  // galaxy.js resolves ?course=; ?watersim is its own flag, so kick the run here once the engine is ready.
  if (/[?&]watersim\b/.test(location.search)) {
    var n = 0, kicked = 0;
    (function go() {
      if (window.RG && RG.startRun && typeof holes !== 'undefined' && holes.length > 0) {
        if (RG.course !== ID && kicked < 4) { kicked++; try { RG.startRun({ course: ID, seed: (RG.rollSeed ? RG.rollSeed() : 4242) }); } catch (e) {} }
      }
      // keep watching for ~6s: the run.html dev-shortcut also kicks a course at boot, so re-assert
      // 'watersim' a few times until it sticks (then stop — no perpetual churn).
      if (RG && RG.course === ID && built) return;
      if (n++ < 120) setTimeout(go, 50);
    })();
  }
})();
