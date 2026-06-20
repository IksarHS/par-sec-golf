// ── perf-hud.js — live frame-time debug overlay (dev/test, peel-off-able) ──
// "Is there actually anything going on?" — a tiny always-measuring HUD so a felt hitch can be
// SEEN. It times the real frame interval (the thing a dropped frame shows up in), independent of
// the game loop, and renders to a DOM box (never the game canvas, so z-order/feel are untouched).
//
// Why frame interval matters here: the physics is frame-COUPLED (gameplay.js updatePhysics steps a
// fixed amount per rendered frame, for determinism), so a single dropped/long frame doesn't slow
// down — it momentarily PAUSES the motion. That reads as the "extremely slight not-smooth" hitch,
// worst during fast motion (just after a hit) and camera pans (hole-to-hole). This HUD surfaces
// those dropped frames as they happen.
//
// Toggle: Shift+D in ANY build (so you can check the real game), or boot with ?perf to start shown.
// Reads:  fps · current frame ms · worst frame in the last ~0.8s (turns red on a drop) ·
//         a running count of "janky" frames (>20ms = a dropped frame at 60Hz) · a sparkline.
// Peel-off: delete this file + its <script> tag and nothing else changes.
(function () {
  if (typeof location === 'undefined' || typeof document === 'undefined') return;

  var el = null, txt = null, spark = null;
  var on = /[?&]perf\b/.test(location.search);
  var times = [], N = 90, last = (typeof performance !== 'undefined') ? performance.now() : 0;
  var jank = 0, frames = 0, worstWin = 0, acc = 0, accN = 0;

  function make() {
    el = document.createElement('div');
    el.id = 'rg-perf-hud';
    el.style.cssText = 'position:fixed;top:8px;right:10px;z-index:9995;font:11px/1.4 "Departure Mono",monospace;'
      + 'color:#cdd6f5;background:rgba(10,8,14,0.80);border:1px solid rgba(205,214,245,0.18);border-radius:7px;'
      + 'padding:6px 9px;pointer-events:none;min-width:150px;box-shadow:0 2px 10px rgba(0,0,0,0.5);';
    txt = document.createElement('div');
    spark = document.createElement('canvas');
    spark.width = 150; spark.height = 28;
    spark.style.cssText = 'display:block;margin-top:5px;width:150px;height:28px;';
    el.appendChild(txt); el.appendChild(spark);
    (document.body || document.documentElement).appendChild(el);
  }

  function drawSpark() {
    var c = spark.getContext('2d'); if (!c) return;
    var W = spark.width, H = spark.height, scale = H / 40;     // 0..40ms maps to full height
    c.clearRect(0, 0, W, H);
    var y60 = H - 16.7 * scale;                                 // the 60fps reference line
    c.strokeStyle = 'rgba(120,140,180,0.35)'; c.lineWidth = 1;
    c.beginPath(); c.moveTo(0, y60); c.lineTo(W, y60); c.stroke();
    c.lineWidth = 1; c.beginPath();
    var lastJank = false;
    for (var i = 0; i < times.length; i++) {
      var x = (i / N) * W, h = Math.min(H, times[i] * scale), yy = H - h;
      var isJank = times[i] > 22;
      if (isJank !== lastJank) { c.stroke(); c.beginPath(); c.strokeStyle = isJank ? '#ff8a8a' : '#7fae8a'; lastJank = isJank; if (i > 0) c.moveTo((i - 1) / N * W, H - Math.min(H, times[i - 1] * scale)); }
      if (i === 0) c.moveTo(x, yy); else c.lineTo(x, yy);
    }
    c.stroke();
  }

  function tick() {
    var now = performance.now(), dt = now - last; last = now;
    if (on) {
      times.push(dt); if (times.length > N) times.shift();
      frames++; acc += dt; accN++;
      if (dt > worstWin) worstWin = dt;
      if (dt > 20) jank++;
      if (frames % 10 === 0 && txt) {                          // throttle the DOM/canvas writes
        var avg = acc / accN; acc = 0; accN = 0;
        var fps = Math.round(1000 / avg);
        var jp = jank / frames * 100;
        txt.innerHTML =
          'fps <b style="color:#9fe6a0">' + fps + '</b>  ' + avg.toFixed(1) + 'ms<br>' +
          'worst <b style="color:' + (worstWin > 22 ? '#ff8a8a' : '#cdd6f5') + '">' + worstWin.toFixed(1) + 'ms</b><br>' +
          'dropped <b style="color:' + (jank ? '#ffcf8a' : '#7fae8a') + '">' + jank + '</b> / ' + frames + '  (' + jp.toFixed(1) + '%)';
        worstWin = 0;
        drawSpark();
      }
    }
    requestAnimationFrame(tick);
  }

  function toggle() {
    on = !on;
    if (on && !el) make();
    if (el) el.style.display = on ? 'block' : 'none';
    if (on) { jank = 0; frames = 0; times.length = 0; }         // reset the tally each time it's summoned
  }

  window.addEventListener('keydown', function (e) {
    if (e.shiftKey && (e.key === 'D' || e.key === 'd')) { if (!el) make(); toggle(); }
  });

  if (on) make();
  requestAnimationFrame(tick);
})();
