// ── testjump.js — ?goto= deep-links for fast testing (peel-off-able, dev/test only) ──
// The designer shouldn't have to play 9 holes to see a recap, or repair the ship to see the
// crane. A `?goto=<state>` URL param drops you straight onto a test point right after boot.
// Pure navigation over EXISTING controls (startRun / jump-to-hole / launchToMoon / the bot) —
// no new game logic, never touches the terrain PRNG, silent unless ?goto is present, so the
// public build (no ?goto links) is unaffected. Peel this file + its <script> tag off → gone.
//
//   ?goto=earth | mars | moon      jump to that course (hole 1)
//   ?goto=hole5                    jump to hole N of the current course (1-based)
//   ?goto=last                     jump to the final hole
//   ?goto=cup                      ball one putt from the current cup (test the sink / cup-fill)
//   ?goto=ship                     final hole + ship repaired (golf to the wreck / open the shop)
//   ?goto=launch                   repair the ship + fire the launch crane to the Moon
//   ?goto=recap                    auto-play the run fast → the end-of-run recap
//                                  (combine with ?recap=1..4 to pick the layout)
(function () {
  if (typeof location === 'undefined') return;
  var m = /[?&]goto=([a-z0-9]+)/i.exec(location.search);
  if (!m) return;
  var goto = m[1].toLowerCase();

  function R() { return window.RG; }
  function ready() {
    return !!(window.RG && RG.active && typeof holes !== 'undefined' && holes.length
      && typeof ball !== 'undefined' && typeof terrainYAt === 'function');
  }
  function holeTotal() { return (R().holeCount) || (holes.length) || 9; }
  function brad() { return (typeof BALL_RADIUS !== 'undefined') ? BALL_RADIUS : 7; }

  // Heal every prior hole exactly like the real onTransitionEnd: fill + FLATTEN the cup geometry so
  // its notch is gone. flattenCup mutates only the live terrain (post-generation), never the seeded
  // PRNG, so determinism is untouched. Without it the tee (= the prior cup's x) stays a carved pit
  // and the ball drops into it ("ball jammed in a hole").
  function healPrior(uptoIdx) {
    for (var j = 0; j < uptoIdx; j++) if (holes[j]) {
      holes[j].cupFilled = true; holes[j].cupFillProgress = 1; holes[j].flagVisible = false; holes[j].flagOpacity = 0;
      if (typeof flattenCup === 'function') flattenCup(holes[j]);
    }
  }
  // put the ball on hole idx's tee (prior cups healed flat, so it's not jammed in a pit), framed tee→cup.
  function jumpHole(idx) {
    idx = Math.max(0, Math.min(holeTotal() - 1, idx));
    currentHole = idx;
    healPrior(idx);
    var h = holes[idx];
    ball.x = h.teeX; ball.y = terrainYAt(h.teeX) - brad();   // tee now flat (prior cup flattened)
    ball.vx = 0; ball.vy = 0; ball.atRest = true; ball.onGround = true;
    if (typeof state !== 'undefined' && typeof STATE_AIM !== 'undefined') state = STATE_AIM;
    frameHole();
  }
  function frameHole() {
    var h = holes[currentHole];
    if (h && h.cupX != null && typeof camera !== 'undefined') { camera.x = (h.teeX + h.cupX) / 2 - W / 2; camera.y = 0; }
  }
  function completeShip() {
    var parts = (window.RG_SHIP && RG_SHIP.parts) || 3;
    for (var i = 1; i <= parts; i++) { try { localStorage.setItem('rg-ship-part-' + i, '1'); } catch (e) {} }
  }
  // a small on-screen note so a deep-link is self-explaining (auto-hides).
  function note(text) {
    var el = document.getElementById('rg-goto-note');
    if (!el) {
      el = document.createElement('div'); el.id = 'rg-goto-note';
      el.style.cssText = 'position:fixed;top:10px;left:50%;transform:translateX(-50%);z-index:9992;'
        + 'font:12px/1.3 "Departure Mono",monospace;color:#cdd6f5;background:rgba(14,11,18,0.85);'
        + 'border:1px solid rgba(120,200,140,0.45);border-radius:8px;padding:6px 12px;pointer-events:none;'
        + 'box-shadow:0 3px 14px rgba(0,0,0,0.5);';
      document.body.appendChild(el);
    }
    el.textContent = text;
    setTimeout(function () { if (el) el.style.opacity = '0'; el.style.transition = 'opacity 0.8s'; }, 3200);
  }

  function run() {
    try {
      if (goto === 'earth') { R().startRun({ course: 'earth-course', seed: R().rollSeed() }); note('▸ Earth'); }
      else if (goto === 'mars') { R().startRun({ course: 'run-course', seed: R().rollSeed() }); note('▸ Mars'); }
      else if (goto === 'moon') { R().startRun({ course: 'moon', seed: R().rollSeed() }); try { localStorage.setItem('rg-knows-moon', '1'); } catch (e) {} note('▸ The Moon'); }
      else if (goto === 'last') { jumpHole(holeTotal() - 1); note('▸ Final hole'); }
      else if (/^hole\d+$/.test(goto)) { var n = parseInt(goto.slice(4), 10) || 1; jumpHole(n - 1); note('▸ Hole ' + n); }
      else if (goto === 'cup') {
        // ball one short putt from the current cup, on the tee side of it
        var h = holes[currentHole];
        var dir = (h.cupX >= h.teeX) ? -1 : 1;       // approach from the tee side
        var bx = h.cupX + dir * 46;
        ball.x = bx; ball.y = terrainYAt(bx) - brad();
        ball.vx = 0; ball.vy = 0; ball.atRest = true; ball.onGround = true;
        if (typeof state !== 'undefined' && typeof STATE_AIM !== 'undefined') state = STATE_AIM;
        if (typeof camera !== 'undefined') { camera.x = h.cupX - W / 2; camera.y = 0; }
        note('▸ At the cup — one putt to sink');
      }
      else if (goto === 'cond') {
        // drop straight onto a hole that HAS a condition, framed, so the tell is instantly visible.
        // pair with ?cond=places vs ?cond=default to A/B the ground-band vs sky-glyph read.
        // optional &c=KEY (slick/dark/hotrock/sticky/lowgrav/wind); default slick.
        var ck = ((/[?&]c=([a-z]+)/i.exec(location.search) || [])[1]) || 'slick';
        var ci = Math.min(holeTotal() - 1, 3);             // hole 4 (room for a band)
        jumpHole(ci);
        try {
          R().holeConds[ci] = { key: ck };
          if (R()._applyHoleCondition) R()._applyHoleCondition(ci);
          var hh = holes[ci];
          if (typeof camera !== 'undefined') { camera.x = (hh.teeX + hh.cupX) / 2 - W / 2; camera.y = 0; }
        } catch (e) {}
        var pool = ((/[?&]cond=([a-z]+)/i.exec(location.search) || [])[1]) || (R().condVariant && R().condVariant().name) || 'default';
        note('▸ ' + ck + ' on this hole · pool: ' + pool);
      }
      else if (goto === 'ship') { jumpHole(holeTotal() - 1); note('▸ Final hole · sink it → auto-launch to the next world'); }
      else if (goto === 'launch') {
        completeShip();
        if (R().course !== 'earth-course') R().startRun({ course: 'earth-course', seed: R().rollSeed() });
        note('▸ Launching to the Moon…');
        // let the ship state settle a frame, then fire the crane
        setTimeout(function () { if (R().launchToMoon) R().launchToMoon(); }, 60);
      }
      else if (goto === 'finale') {
        // THE PLAYABLE: stand on the FINAL hole, one putt from the cup, ship repaired. Sink it ->
        // the course-complete screen -> "Launch to the Moon" -> the space crossing -> land on the Moon.
        completeShip();
        var li = holeTotal() - 1; currentHole = li;
        healPrior(li);
        var fh = holes[li]; var fdir = (fh.cupX >= fh.teeX) ? -1 : 1;
        ball.x = fh.cupX + fdir * 46; ball.y = terrainYAt(ball.x) - brad();
        ball.vx = 0; ball.vy = 0; ball.atRest = true; ball.onGround = true;
        if (typeof state !== 'undefined' && typeof STATE_AIM !== 'undefined') state = STATE_AIM;
        if (typeof camera !== 'undefined') { camera.x = fh.cupX - W / 2; camera.y = 0; }
        note('▸ Final hole · one putt to finish — sink it to launch to the next world');
      }
      else if (goto === 'courseend') {
        // PROTOTYPE of the Spelunky-style combined beat: the course-complete SCORECARD doubles as the
        // travel-to-the-next-planet screen. Sink the final putt -> clubhouse scorecard (recap 3) ->
        // after a readable beat it carries you onward on the space crane to the Moon. This is a v1
        // SEQUENTIAL flow wired entirely in this dev file (no core change) so we can feel the
        // combination; the fuller version composites the scorecard ONTO the crossing (one screen).
        completeShip();
        try { window.RG_RECAP_VARIANT = 3; } catch (e) {}                 // clubhouse scorecard
        var ce = holeTotal() - 1; currentHole = ce;
        healPrior(ce);
        var ch = holes[ce]; var cdir = (ch.cupX >= ch.teeX) ? -1 : 1;
        ball.x = ch.cupX + cdir * 44; ball.y = terrainYAt(ball.x) - brad();
        ball.vx = 0; ball.vy = 0; ball.atRest = true; ball.onGround = true;
        if (typeof state !== 'undefined' && typeof STATE_AIM !== 'undefined') state = STATE_AIM;
        if (typeof camera !== 'undefined') { camera.x = ch.cupX - W / 2; camera.y = 0; }
        var SC = (typeof STATE_COMPLETE !== 'undefined') ? STATE_COMPLETE : 5;
        var held = 0, fired = false;
        var iv = setInterval(function () {
          if (typeof state === 'undefined') return;
          if (state === SC && !fired) { held++; if (held >= 28) { fired = true; clearInterval(iv); if (R() && R().launchToMoon) R().launchToMoon(); } }
        }, 100);                                                          // hold the scorecard ~2.8s, then travel
        note('▸ Sink the putt → scorecard → it travels you to the Moon');
      }
      else if (goto === 'recap') {
        note('▸ Auto-playing to the recap…');
        if (window.RG && RG.bot && RG.bot.start) RG.bot.start({ runs: 1, speed: 40, steps: 5 });
      }
      else { note('?goto=' + goto + ' — unknown (earth/mars/moon/holeN/last/cup/ship/launch/recap)'); }
    } catch (e) { note('goto error: ' + (e && e.message)); }
  }

  // run once, as soon as the game has booted (initFirebase → startRun). Use setTimeout, NOT
  // requestAnimationFrame: rAF is throttled when the game tab is backgrounded (another tab active),
  // which would delay the jump; setTimeout keeps firing promptly.
  var fired = false;
  (function wait() {
    if (fired) return;
    if (ready()) { fired = true; run(); return; }
    setTimeout(wait, 50);
  })();
})();
