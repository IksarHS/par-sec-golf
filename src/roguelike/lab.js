// ── Secrets Lab (dev tool) ─────────────────────────────────
// A DEV-ONLY panel that drops you onto the hole where a secret lives, ball at the tee, and shows
// a big on-screen instruction so you can TRIGGER it yourself — no auto-play. Dormant unless ?dev
// (never shows for players / in the public build). Loads after wrap.js.
(function () {
  if (typeof location === 'undefined' || !/[?&]dev\b/.test(location.search)) return;

  function findSeed(test, max) {
    max = max || 160;
    for (var s = 1; s <= max; s++) { RG.startRun({ seed: s }); try { if (test()) return s; } catch (e) {} }
    return null;
  }
  function tee(idx) { // put the ball at hole idx's tee, at rest, ready to aim
    currentHole = idx; var h = holes[idx];
    // A hole's tee IS the previous hole's cup; in real play the transition fills that divot
    // (cupFillProgress=1, flag hidden — see main.js snapshot restore). Jumping straight here
    // without filling leaves the ball sitting in an open divot that never occurs in the game.
    for (var j = 0; j < idx; j++) if (holes[j]) { holes[j].cupFillProgress = 1; holes[j].flagVisible = false; }
    ball.x = h.teeX; ball.y = terrainYAt(h.teeX) - BALL_RADIUS; ball.vx = 0; ball.vy = 0; ball.atRest = true; ball.onGround = true;
    if (typeof state !== 'undefined') state = STATE_AIM;
    return h;
  }
  // Frame the CURRENT hole naturally — centre the tee→cup span so the ball AND the cup are both
  // on screen, like a real hole. (Args ignored: kept so the scenario calls below stay readable.)
  function frame() { var h = holes[currentHole]; if (h && h.cupX != null && typeof camera !== 'undefined') { camera.x = (h.teeX + h.cupX) / 2 - W / 2; camera.y = 0; } }

  // ── Big on-screen instruction banner ──
  function hint(text) {
    var el = document.getElementById('rg-hint');
    if (!el) {
      el = document.createElement('div'); el.id = 'rg-hint';
      el.style.cssText = 'position:fixed;top:54px;left:50%;transform:translateX(-50%);z-index:9991;max-width:74vw;'
        + 'text-align:center;font:15px/1.4 "Departure Mono",monospace;color:#fff;background:rgba(14,11,18,0.82);'
        + 'border:1px solid rgba(178,77,255,0.5);border-radius:10px;padding:10px 16px;pointer-events:none;'
        + 'box-shadow:0 4px 22px rgba(0,0,0,0.5);';
      document.body.appendChild(el);
    }
    el.innerHTML = text;
    el.style.display = text ? 'block' : 'none';
  }

  // Each scenario sets up the hole + ball at the tee and returns the on-screen instruction.
  var SCENARIOS = [
    { name: '▾ The Fault → Undercroft', cls: 'crane', run: function () {
      var s = findSeed(function () { return !!RG._faultTile; });
      if (s == null) return 'no Fault seed in 1..160';
      var h = tee(RG._faultTile.hole); frame(h.teeX, RG._faultTile.x);
      return '🟣 <b>The Fault.</b> Putt onto the <span style="color:#c98bff">violet tile</span> and let the ball stop — the floor opens.';
    } },
    { name: '◐ Patient Rest', cls: 'gest', run: function () {
      try { localStorage.removeItem('rg-knows-patient'); } catch (e) {}   // gateway retires once known — un-know so it can place
      var p = RG_secret('patient');
      var s = findSeed(function () { return !!(p.tile); });
      if (s == null) return 'no Patient seed';
      var h = tee(p.tile.hole); frame(h.teeX, h.teeX + 200);
      return '◐ <b>Patient Rest.</b> Don\'t shoot — just <b>wait ~5s</b>. A <span style="color:#c98bff">violet halo</span> blooms around the ball.';
    } },
    { name: '☀ Poke the Sun', cls: 'gest', run: function () {
      RG.startRun({ seed: 5 }); var h = tee(1); frame(h.teeX, h.cupX);
      return '☀ <b>The Sun.</b> Click the faint sun in the <b>top-right</b> corner — lights out. Click it again for dawn.';
    } },
    { name: '◆ The Leviathan (ace this hole)', cls: 'crane', run: function () {
      RG.startRun({ seed: 5 });
      var lev = RG_secret('leviathan'); lev._streak = 2; lev._lastHole = 1; lev._done = false; RG.holeScores = [1, 1];
      var h = tee(1); frame(h.teeX, h.cupX);
      return '◆ <b>The Watcher.</b> You\'ve aced 2 in a row — sink <b>this hole in ONE shot</b> to open the eye.';
    } },
  ];

  // Shared button factory: a left-aligned accent button that runs fn, showing its returned
  // string in the hint banner (or an error if it throws). accent is an "r,g,b" string.
  function mkButton(label, accent, fn) {
    var b = document.createElement('button');
    b.textContent = label;
    b.style.cssText = 'display:block;width:100%;text-align:left;margin:3px 0;padding:5px 8px;cursor:pointer;'
      + 'font:inherit;color:#f2ecff;background:rgba(' + accent + ',0.10);border:1px solid rgba(' + accent + ',0.35);border-radius:7px;';
    b.onmouseenter = function () { b.style.background = 'rgba(' + accent + ',0.22)'; };
    b.onmouseleave = function () { b.style.background = 'rgba(' + accent + ',0.10)'; };
    b.onclick = function (e) { e.stopPropagation(); var msg; try { msg = fn(); } catch (err) { msg = 'error: ' + (err && err.message); } if (msg != null) hint(msg); };
    return b;
  }

  // ── DEV CHEATS ─────────────────────────────────────────────
  // Buttons that wire to existing run controls — pure shortcuts, no new game logic. These
  // are the only place the panel writes save keys (money, ship parts), and only on a click,
  // never automatically. cls 'warp' = course/world jumps, 'hole' = within-run hole jumps,
  // 'econ' = wallet/ship writes, 'bot' = autoplay.
  var GREEN = '120,200,140', GOLD = '232,160,48', BLUE = '110,150,230', PURPLE = '178,77,255';

  function curHole() { return (typeof currentHole !== 'undefined') ? currentHole : 0; }
  function holeTotal() { return (window.RG && RG.holeCount) || ((typeof holes !== 'undefined' && holes.length) || 9); }

  // ── HOLE-TYPE TOUR ── lock the current course to ONE archetype across all 9 holes, so you can step
  // through every hole-type (incl. the new ones) in whatever planet's palette is loaded. Uses the
  // window.setArchetypeOverride hook exposed by level-design.js.
  var tourIdx = -1;
  function tourArch(delta) {
    var NM = window.ARCHETYPE_NAMES || [];
    if (!NM.length || !window.setArchetypeOverride) return 'hole-type tour unavailable — hard-refresh (Ctrl+Shift+R) to load it';
    tourIdx = (tourIdx + delta + NM.length) % NM.length;
    window.setArchetypeOverride(NM[tourIdx]);
    RG.startRun({ course: (RG.course || 'earth-course'), seed: RG.rollSeed() });
    return 'hole-type <b>' + NM[tourIdx] + '</b> (' + (tourIdx + 1) + '/' + NM.length + ') — all 9 holes forced. Use ⏭ Skip to see variants.';
  }

  var CHEATS = [
    { label: '⤼ Reset run (fresh seed)', cls: 'warp', run: function () {
      RG.startRun({ seed: RG.rollSeed(), course: (RG.course || 'earth-course') });
      return '⤼ <b>Fresh run</b> on <b>' + RG.course + '</b>.';
    } },
    { label: '⏭ Skip to next hole', cls: 'hole', run: function () {
      if (typeof holes === 'undefined') return 'no run active';
      var next = Math.min(curHole() + 1, holeTotal() - 1);
      var h = tee(next); frame(h.teeX, h.cupX);
      return '⏭ Now at <b>hole ' + (next + 1) + ' / ' + holeTotal() + '</b>.';
    } },
    { label: '⊞ Jump to hole N…', cls: 'hole', run: function () {
      if (typeof holes === 'undefined') return 'no run active';
      var n = window.prompt('Jump to hole (1–' + holeTotal() + '):', String(curHole() + 1));
      if (n == null) return null;                       // cancelled — no state change
      var idx = Math.max(1, Math.min(holeTotal(), parseInt(n, 10) || 1)) - 1;
      var h = tee(idx); frame(h.teeX, h.cupX);
      return '⊞ Jumped to <b>hole ' + (idx + 1) + ' / ' + holeTotal() + '</b>.';
    } },
    { label: '⌂ Course: Earth (Front Nine)', cls: 'warp', run: function () {
      RG.startRun({ course: 'earth-course', seed: RG.rollSeed() });
      return '⌂ On <b>Earth</b>.';
    } },
    { label: '♂ Course: Mars (the run)', cls: 'warp', run: function () {
      RG.startRun({ course: 'run-course', seed: RG.rollSeed() });
      return '♂ On <b>Mars</b>.';
    } },
    { label: '☾ Course: the Moon', cls: 'warp', run: function () {
      RG.startRun({ course: 'moon', seed: RG.rollSeed() });
      try { localStorage.setItem('rg-knows-moon', '1'); } catch (e) {}
      return '☾ On <b>the Moon</b>.';
    } },
    { label: 'Next hole-type ▶', cls: 'hole', run: function () { return tourArch(1); } },
    { label: '◀ Prev hole-type', cls: 'hole', run: function () { return tourArch(-1); } },
    { label: '✕ Clear hole-type lock', cls: 'hole', run: function () { tourIdx = -1; if (window.setArchetypeOverride) window.setArchetypeOverride(null); RG.startRun({ course: (RG.course || 'earth-course'), seed: RG.rollSeed() }); return 'hole-type lock OFF — back to the normal pool.'; } },
    { label: '⛰ Terrain-pop test hole', cls: 'hole', run: function () { if (!window.setArchetypeOverride) return 'hard-refresh to load it'; window.setArchetypeOverride('strata_test'); tourIdx = -1; RG.startRun({ course: (RG.course || 'earth-course'), seed: RG.rollSeed() }); return 'WORST-CASE strata hole on all 9. Sink + advance (or ⏭ Skip) → terrain must hold its colours, no recolour.'; } },
    { label: '⟳ Stress: auto-cycle transitions', cls: 'hole', run: function () {
      if (window.__stressIv) { clearInterval(window.__stressIv); window.__stressIv = null; return 'stress cycle STOPPED.'; }
      if (window.setArchetypeOverride) window.setArchetypeOverride('strata_test');
      RG.startRun({ course: (RG.course || 'earth-course'), seed: RG.rollSeed() });
      // Force a regen+reframe (the recolour-relevant part of a transition) every 0.7s on VARIED strata holes,
      // looping the course — so you watch dozens of transitions in seconds. Watch the ─ events ─ log: REGEN
      // lines are expected; a "*** REAL POP" (a fixed world point recolouring) is the bug. No bot needed.
      window.__stressIv = setInterval(function () {
        try {
          if (!(window.RG && RG.active) || typeof currentHole === 'undefined' || typeof holes === 'undefined') return;
          var n = currentHole + 1;
          if (n >= (RG.holeCount || 9)) { RG.startRun({ course: RG.course, seed: RG.rollSeed() }); return; }   // loop: fresh varied run
          currentHole = n;
          if (typeof ensureHolesAhead === 'function') ensureHolesAhead(currentHole + 2);   // regen ahead (the pop source)
          var h = holes[currentHole];
          if (h && typeof terrainYAt === 'function') { ball.x = h.teeX; ball.y = terrainYAt(h.teeX) - 8; ball.vx = 0; ball.vy = 0; ball.atRest = true; ball.onGround = true; }
          if (typeof setHoleCamera === 'function' && h) setHoleCamera(h);
          if (typeof state !== 'undefined' && typeof STATE_AIM !== 'undefined') state = STATE_AIM;
        } catch (e) {}
      }, 700);
      return 'stress cycle STARTED — varied strata hole + forced regen/reframe every 0.7s, looping. Watch ─ events ─ for "*** REAL POP". Click again to stop.';
    } },
    { label: '☁ Floating-object showcase', cls: 'hole', run: function () {
      if (typeof _floatShape !== 'function' || typeof holes === 'undefined' || !holes[curHole()]) return 'hard-refresh to load it';
      var h = holes[curHole()];
      var kinds = ['island', 'platform', 'crystal', 'mesa', 'blob'];   // 2 smooth + 3 angular floating-object shapes
      var pieces = [], x0 = h.teeX + 60, cy = (typeof H !== 'undefined' ? H : 540) * 0.38;
      for (var i = 0; i < kinds.length; i++) { var pts = _floatShape(x0 + i * 155, cy, 100, 44, kinds[i]); pieces.push({ pts: pts, edges: (typeof _spEdges === 'function' ? _spEdges(pts) : []) }); }
      h._overhangs = pieces;                                            // the existing per-hole floating-mass slot
      if (typeof camera !== 'undefined') { camera.x = h.teeX - 30; camera.y = 0; }
      return '☁ island · platform · crystal · mesa · blob (left→right) — the floating-object shapes.';
    } },
    { label: '$ Give $50', cls: 'econ', run: function () {
      if (!window.RG_ECON) return 'no economy';
      RG_ECON.add(50);
      return '$ Added <b>$50</b> · wallet now <b>$' + RG_ECON.money() + '</b>.';
    } },
    { label: '✦ Complete the ship', cls: 'econ', run: function () {
      var parts = (window.RG_SHIP && RG_SHIP.parts) || 3;
      for (var i = 1; i <= parts; i++) { try { localStorage.setItem('rg-ship-part-' + i, '1'); } catch (e) {} }
      var done = !window.RG_SHIP || RG_SHIP.complete();
      return '✦ Ship <b>' + (done ? 'whole' : 'parts set') + '</b> — rest beside the wreck (or the Launch button) to fly.';
    } },
    { label: '◇ Strip ship parts', cls: 'econ', run: function () {
      var parts = (window.RG_SHIP && RG_SHIP.parts) || 3;
      for (var i = 1; i <= parts; i++) { try { localStorage.removeItem('rg-ship-part-' + i); } catch (e) {} }
      return '◇ Ship parts <b>cleared</b>.';
    } },
    { label: '▲ Launch to the Moon', cls: 'warp', run: function () {
      // Launching is no longer a default-game button (designer call: it was a debug affordance).
      // This cheat is the test path: repair the ship, make sure we're on Earth, then fire the
      // crane to the Moon via the existing RG.launchToMoon — same control ?goto=launch uses.
      if (!(window.RG && RG.launchToMoon)) return 'no launch control';
      var parts = (window.RG_SHIP && RG_SHIP.parts) || 3;
      for (var i = 1; i <= parts; i++) { try { localStorage.setItem('rg-ship-part-' + i, '1'); } catch (e) {} }
      if (RG.course !== 'earth-course') RG.startRun({ course: 'earth-course', seed: RG.rollSeed() });
      setTimeout(function () { if (RG.launchToMoon) RG.launchToMoon(); }, 60);   // let the ship/run state settle a frame, then fire the crane
      return '▲ <b>Launching to the Moon…</b>';
    } },
    { label: '▸ Toggle autoplay (bot)', cls: 'bot', run: function () {
      if (!(window.RG && RG.bot)) return 'no bot';
      if (window.aiEnabled) { RG.bot.stop(); return '■ Bot <b>stopped</b>.'; }
      RG.bot.start({ runs: Infinity, speed: 8 });
      return '▸ Bot <b>playing</b> @ 8x — press again (or A) to stop.';
    } },
  ];

  function panel(id, titleHTML, accent) {
    var p = document.createElement('div'); p.id = id;
    p.style.cssText = 'position:fixed;left:10px;z-index:9990;width:250px;font:11px/1.35 "Departure Mono",monospace;'
      + 'background:rgba(14,11,18,0.93);border:1px solid rgba(' + accent + ',0.4);border-radius:10px;color:#f2ecff;'
      + 'padding:8px;box-shadow:0 6px 26px rgba(0,0,0,0.5);user-select:none;';
    var head = document.createElement('div');
    head.style.cssText = 'display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;cursor:pointer;';
    head.innerHTML = titleHTML + '<span class="rg-panel-tog" style="opacity:0.6;">[–]</span>';
    p.appendChild(head);
    var body = document.createElement('div');
    p.appendChild(body);
    var collapsed = false;
    head.onclick = function () { collapsed = !collapsed; body.style.display = collapsed ? 'none' : 'block'; head.querySelector('.rg-panel-tog').textContent = collapsed ? '[+]' : '[–]'; };
    return { root: p, body: body };
  }

  function build() {
    if (document.getElementById('rg-lab')) return;

    // ── Cheats panel (top-left) ──
    var cheats = panel('rg-cheats', '<b style="color:#78c88c;letter-spacing:1px;">🎛 DEV&nbsp;CHEATS</b>', GREEN);
    cheats.root.style.top = '10px';
    CHEATS.forEach(function (c) {
      var accent = c.cls === 'warp' ? BLUE : c.cls === 'hole' ? PURPLE : c.cls === 'bot' ? GOLD : GREEN;
      cheats.body.appendChild(mkButton(c.label, accent, c.run));
    });
    var cfoot = document.createElement('div');
    cfoot.style.cssText = 'margin-top:6px;color:rgba(242,236,255,0.3);font-size:10px;';
    cfoot.textContent = '` toggles dev panels · click then verify state';
    cheats.body.appendChild(cfoot);
    document.body.appendChild(cheats.root);

    // ── Secrets Lab (bottom-left) ──
    var lab = panel('rg-lab', '<b style="color:#c98bff;letter-spacing:1px;">🔬 SECRETS&nbsp;LAB</b>', '178,77,255');
    lab.root.style.bottom = '10px';
    lab.body.id = 'rg-lab-body';
    SCENARIOS.forEach(function (sc) {
      var accent = sc.cls === 'crane' ? GOLD : PURPLE;
      lab.body.appendChild(mkButton(sc.name, accent, sc.run));
    });
    var foot = document.createElement('div');
    foot.style.cssText = 'margin-top:6px;color:rgba(242,236,255,0.3);font-size:10px;';
    foot.textContent = '` toggles panel · then play the hole to trigger it';
    lab.body.appendChild(foot);
    document.body.appendChild(lab.root);

    window.addEventListener('keydown', function (e) {
      if (/INPUT|TEXTAREA/.test((e.target && e.target.tagName) || '')) return;
      if (e.key === '`') {
        var show = lab.root.style.display === 'none';   // both panels share one toggle
        var disp = show ? 'block' : 'none';
        lab.root.style.display = disp; cheats.root.style.display = disp;
        var hb = document.getElementById('rg-hint'); if (hb) hb.style.display = show ? hb.style.display : 'none';
      }
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', build); else build();
})();
