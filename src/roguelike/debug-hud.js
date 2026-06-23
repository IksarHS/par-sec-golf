// ── debug-hud.js — toggleable playtest DEBUG OVERLAY (peel-off-able, OFF by default) ──
// A compact live state read-out for the owner's playtest→review loop, so a piece of feedback
// can cite the EXACT engine state ("on earth, hole 3, ball resting on sand 40px from cup,
// zoom 1.0"). It is a fixed DOM box (never the game canvas, so render/feel/z-order are untouched)
// and pointer-events:none (never blocks a shot).
//
// GATED + OFF BY DEFAULT (this is the REAL/public game): nothing renders, nothing reads the
// engine, and the rAF loop does no work, until the overlay is summoned. The public build stays
// clean — no corner hint is drawn until you toggle it on.
//
// Toggle:  the backtick ` key shows/hides it (works even when an element is focused), OR boot
//          with ?debug in the URL to start shown.
// Reads (each guarded with typeof/null checks — a missing global shows "—", never throws):
//   PLANET  RG.course            HOLE  currentHole+1 / RG.holeCount     PAR   RG.holePars[i]
//   STROKES strokes              BALL  ball.x,ball.y                    SPEED hypot(ball.vx,ball.vy)
//   STATE   derived from `state` + ball.atRest/onGround
//   SURFACE ball.lastCollidedMat || getMaterialAt(ball.x)
//   DIST→CUP ball→holes[currentHole].cupX/cupY     ZOOM RG._zoom    W  the W global    FPS rolling
// Peel-off: delete this file + its <script> tag and nothing else changes.
(function () {
  if (typeof location === 'undefined' || typeof document === 'undefined') return;

  var on = /[?&]debug\b/.test(location.search);   // OFF unless ?debug
  var el = null, body = null;

  // Rolling FPS, measured off the rAF cadence (independent of the game loop).
  var last = (typeof performance !== 'undefined') ? performance.now() : 0;
  var acc = 0, accN = 0, fps = 0, frames = 0;

  // Safe reads — return the value or a fallback, never throw.
  function g(fn, fb) { try { var v = fn(); return (v == null || (typeof v === 'number' && !isFinite(v))) ? fb : v; } catch (e) { return fb; } }
  var DASH = '—';   // —

  function num(fn, dec, fb) {
    var v = g(fn, null);
    if (v == null || typeof v !== 'number' || !isFinite(v)) return fb == null ? DASH : fb;
    return v.toFixed(dec == null ? 0 : dec);
  }

  function make() {
    el = document.createElement('div');
    el.id = 'rg-debug-hud';
    el.style.cssText = 'position:fixed;top:8px;left:10px;z-index:9994;'
      + 'font:11px/1.45 "Departure Mono",monospace;color:#dfe6f7;'
      + 'background:rgba(8,7,12,0.78);border:1px solid rgba(180,140,255,0.22);border-radius:7px;'
      + 'padding:7px 10px;pointer-events:none;min-width:172px;white-space:pre;'
      + 'box-shadow:0 2px 12px rgba(0,0,0,0.55);letter-spacing:0.3px;';
    body = document.createElement('div');
    el.appendChild(body);
    (document.body || document.documentElement).appendChild(el);
  }

  // Map the numeric STATE constants (+ ball rest flags) to a readable label.
  function stateLabel() {
    var s = (typeof state !== 'undefined') ? state : null;
    var b = (typeof ball !== 'undefined') ? ball : null;
    var SA = (typeof STATE_AIM !== 'undefined') ? STATE_AIM : 0;
    var SF = (typeof STATE_FLIGHT !== 'undefined') ? STATE_FLIGHT : 1;
    if (s === SA) return 'AIM';
    if (s === SF) {
      if (b) {
        if (b.atRest) return 'REST';
        if (b.onGround) return 'ROLLING';
      }
      return 'FLIGHT';
    }
    if (typeof STATE_PAUSE !== 'undefined' && s === STATE_PAUSE) return 'IN-CUP';
    if (typeof STATE_TRANSITION !== 'undefined' && s === STATE_TRANSITION) return 'TRANSITION';
    if (typeof STATE_OOB !== 'undefined' && s === STATE_OOB) return 'OOB';
    if (typeof STATE_COMPLETE !== 'undefined' && s === STATE_COMPLETE) return 'COMPLETE';
    if (b) { if (b.atRest) return 'REST'; if (b.onGround) return 'ROLLING'; }
    return DASH;
  }

  function surface() {
    var b = (typeof ball !== 'undefined') ? ball : null;
    if (b && b.lastCollidedMat) return String(b.lastCollidedMat);
    if (typeof getMaterialAt === 'function' && b) {
      var m = g(function () { return getMaterialAt(b.x); }, null);
      if (m != null) return String(m);
    }
    return DASH;
  }

  function curHole() {
    return (typeof currentHole !== 'undefined' && typeof currentHole === 'number') ? currentHole : null;
  }

  function render() {
    var b = (typeof ball !== 'undefined') ? ball : null;
    var hi = curHole();

    // PLANET — the body id (uppercased for legibility).
    var planet = g(function () { return window.RG && RG.course; }, null);
    planet = planet ? String(planet).toUpperCase() : DASH;

    // HOLE / PAR
    var holeCount = g(function () { return window.RG && RG.holeCount; }, null);
    var holeStr = (hi != null ? (hi + 1) : DASH) + ' / ' + (holeCount != null ? holeCount : DASH);
    var par = DASH;
    if (hi != null) {
      par = g(function () { return window.RG && RG.holePars && RG.holePars[hi]; }, null);
      if (par == null) par = g(function () { return window.RG && RG.parForHole && RG.parForHole(hi); }, null);
      par = (par == null) ? DASH : par;
    }

    var strokesStr = num(function () { return strokes; });

    var speed = num(function () { return Math.hypot(b.vx, b.vy); }, 1);

    // DIST→CUP
    var dist = DASH;
    if (b && hi != null) {
      dist = num(function () {
        var h = holes[hi];
        return Math.hypot(h.cupX - b.x, h.cupY - b.y);
      }, 0);
    }

    var zoom = num(function () { return window.RG._zoom; }, 2);
    var wv = num(function () { return W; });

    var lines = [
      'PLANET  ' + planet,
      'HOLE  ' + holeStr + '   PAR ' + par,
      'STROKES ' + strokesStr,
      'STATE   ' + stateLabel(),
      'BALL    ' + num(function () { return b.x; }) + ', ' + num(function () { return b.y; }),
      'SPEED   ' + speed + '   ZOOM ' + zoom,
      'SURFACE ' + surface(),
      'DIST→CUP ' + dist,
      'W ' + wv + '   FPS ' + (fps || DASH)
    ];
    body.textContent = lines.join('\n');
  }

  function tick() {
    var now = performance.now(), dt = now - last; last = now;
    if (on) {
      acc += dt; accN++; frames++;
      if (frames % 10 === 0) { fps = Math.round(1000 / (acc / accN)); acc = 0; accN = 0; }
      if (body) render();
    }
    requestAnimationFrame(tick);
  }

  function setOn(v) {
    on = v;
    if (on && !el) make();
    if (el) el.style.display = on ? 'block' : 'none';
    if (on) { acc = 0; accN = 0; frames = 0; }   // reset the FPS window when summoned
  }

  // Robust toggle: fires even if an input/element is focused; backtick by key OR code.
  window.addEventListener('keydown', function (e) {
    if (e.key === '`' || e.code === 'Backquote') {
      e.preventDefault();
      setOn(!on);
    }
  });

  if (on) make();
  requestAnimationFrame(tick);
})();
