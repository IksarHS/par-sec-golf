// ── galaxy-run.js — the GALAXY RUN roguelike layer (peel-off-able, gated to ?rogue) ──
//
// Adds a roguelike CORE LOOP on top of the existing PORTRAIT mode (?portrait): a 3-strike,
// par-buffer run across an endless string of 5-hole planets. It is PURE BOOKKEEPING derived
// from the engine's own per-hole strokes/par — it does NOT change how golf is played, the
// camera, the travel, or any base draw. It only:
//   * polls the engine each frame (in its own rAF) to detect a hole completing / a course
//     completing, then applies the strike / par-buffer economy,
//   * paints a small DOM HUD below the notch (pointer-events:none — never blocks a shot),
//   * on game-over paints a tap-to-retry overlay and wires the tap to start a fresh run.
//
// GATED: nothing installs unless the URL has ?rogue (used as ?portrait&rogue). The base game
// (no ?rogue) and portrait-without-rogue are byte-untouched. Peel this file + its <script> tag
// in run.html → gone.
//
// Integration hooks used (all READ, none mutated):
//   * RG.holeScores[i]  — strokes taken on completed hole i (set by RG.recordHole in wrap.js
//                         onTransitionStart, the moment currentHole advances).
//   * RG.holePars[i]    — par for hole i (set when the course is built in startRun).
//   * currentHole       — global; increments per completed hole (desert-golfing.js onTransitionStart).
//   * RG.course         — the active planet id; changes when travel lands on the next body.
//   * RG.holeCount      — holes per course (5 in portrait).
//   * RG.startRun({course, seed}) + RG.rollSeed() — to start a fresh run on retry.
//   * window.SOLAR_ITINERARY[0] — the first portrait planet to (re)start from.
//
// Economy (locked design):
//   3 strikes. overall = cumulative (strokes-par) since the last strike, starting at 0.
//   After each hole: overall += (holeStrokes - holePar). If overall > 0 → lose a strike AND
//   reset overall to 0. strikes==0 → GAME OVER. Money at course-complete: +5 + 2*max(0, under-par).
//   Score = planetsCleared + holesCleared.
//
(function () {
  'use strict';
  // ── GATE ──────────────────────────────────────────────────────────────────────────────────
  if (typeof location === 'undefined' || !/[?&]rogue\b/.test(location.search)) return;
  if (typeof document === 'undefined') return;

  // ── STATE (structured so a shop + a `bag` of balls slot in next slice; bag unused for now) ──
  var RUN = {
    strikes: 3,
    overall: 0,            // banked par buffer since last strike; <=0 = cushion, >0 spends a strike
    money: 0,
    planetsCleared: 0,
    holesCleared: 0,
    gameOver: false,
    courseStartStrokes: 0, // totalStrokes at the start of the current course (for course under-par)
    lastHole: 0,           // last currentHole we processed (to detect a hole advancing)
    lastCourse: null,      // last RG.course we saw (to detect travel to a new planet)
    bag: ['normal'],       // kept for compatibility; the real owned set is `owned`
    // ── Slice 2: bag + special balls + shop ──
    owned: {},             // {sticky:true, ...} specials bought this run
    charges: {},           // {sticky:n, ...} charges left this course (refilled to full at each shop)
    activeBall: 'normal',  // the player's selected ball for the NEXT shot
    shotBall: 'normal',    // ball LOCKED for the CURRENT in-flight shot (set on launch)
    lifeBuys: 0,           // +1 life buy-backs this run (price ramps each purchase)
    _shotActive: false,    // a shot is in flight (lifecycle latch)
    _shopOpen: false,      // shop overlay showing (gates travel)
    _pendingTravel: null,  // {dest, mode} stashed while the shop is up
    _booted: false,        // becomes true once we've latched onto a live run
  };
  window.__rogue = RUN;    // headless verification handle

  // ── safe reads — never throw on a missing/early global ──
  function g(fn, fb) { try { var v = fn(); return (v == null) ? fb : v; } catch (e) { return fb; } }
  function curHole()   { return g(function () { return currentHole; }, 0); }
  function curCourse() { return g(function () { return RG.course; }, null); }
  function holeCount() { return g(function () { return RG.holeCount; }, 5) || 5; }

  // ── THE RULE — apply one finished hole's (strokes - par) to the run. Pure: mutates RUN only.
  // Returns true if this hole spent a strike. Logs a verifiable trace line.
  function applyHole(strokes, par) {
    if (RUN.gameOver) return false;
    var delta = strokes - par;
    RUN.overall += delta;
    var spentStrike = false;
    if (RUN.overall > 0) {
      RUN.strikes -= 1;
      RUN.overall = 0;       // reset the buffer when a strike is spent
      spentStrike = true;
      if (RUN.strikes <= 0) {
        RUN.strikes = 0;
        RUN.gameOver = true;
      }
    }
    RUN.holesCleared += 1;
    try {
      console.log('[rogue] hole done: ' + (delta >= 0 ? '+' : '') + delta +
        ' (' + strokes + ' vs par ' + par + ') -> overall ' + RUN.overall +
        ', strikes ' + RUN.strikes + (spentStrike ? ' [STRIKE]' : '') +
        (RUN.gameOver ? ' [GAME OVER]' : ''));
    } catch (e) {}
    return spentStrike;
  }
  RUN._applyHole = applyHole;   // exposed for the headless unit-check

  // ── money at course-complete: +5 base + 2 per stroke under par across the 5 holes ──
  function awardCourseMoney(courseStrokes, coursePar) {
    var under = Math.max(0, coursePar - courseStrokes);
    var pay = 5 + 2 * under;
    RUN.money += pay;
    return pay;
  }

  // Sum par over the holes of the current course (RG.holePars is per-course, rebuilt each startRun).
  function coursePar() {
    var pars = g(function () { return RG.holePars; }, null);
    if (!pars || !pars.length) return 0;
    var n = holeCount(), s = 0;
    for (var i = 0; i < n && i < pars.length; i++) s += (pars[i] || 0);
    return s;
  }

  // ── reset to a fresh run + restart the engine from the first portrait planet ──
  function startFreshRun() {
    RUN.strikes = 3; RUN.overall = 0; RUN.money = 0;
    RUN.planetsCleared = 0; RUN.holesCleared = 0; RUN.gameOver = false;
    RUN.courseStartStrokes = 0; RUN.lastHole = 0; RUN.lastCourse = null;
    RUN.bag = ['normal'];
    RUN.owned = {}; RUN.charges = {}; RUN.activeBall = 'normal'; RUN.shotBall = 'normal';
    RUN.lifeBuys = 0; RUN._shotActive = false; RUN._shopOpen = false; RUN._pendingTravel = null;
    RUN._stopEverUsed = false;
    if (RUN._closeShop) RUN._closeShop();
    var first = g(function () { return window.SOLAR_ITINERARY && window.SOLAR_ITINERARY[0]; }, 'earth') || 'earth';
    try {
      if (window.RG && RG.startRun) {
        RG.startRun({ course: first, seed: (RG.rollSeed ? RG.rollSeed() : 12345) });
        RUN.lastCourse = curCourse();
        RUN.lastHole = curHole();
      }
    } catch (e) {}
    console.log('[rogue] fresh run started on ' + first);
  }
  RUN.startFreshRun = startFreshRun;

  // ═══════════════════════════════════════════════════════════════════════════════════════════════════
  // SLICE 2 — bag + special balls + shop
  // ═══════════════════════════════════════════════════════════════════════════════════════════════════
  var CHARGES_PER_COURSE = 3;
  // Ball catalog. price = base $ at system 0; scales +25% per system cleared (a system = the itinerary length).
  var BALLS = {
    sticky: { name: 'STICKY', short: 'STICK', desc: 'lands dead, no roll', price: 10 },
    wall:   { name: 'BOUNCE', short: 'BNCE',  desc: 'extra bounce, hop hazards', price: 12 },
    stop:   { name: 'STOP',   short: 'STOP',  desc: 'tap mid-air, drop straight', price: 15 },
  };
  var BALL_ORDER = ['sticky', 'wall', 'stop'];
  function itinLen() { var it = g(function () { return window.SOLAR_ITINERARY; }, null); return (it && it.length) ? it.length : 3; }
  function systemsCleared() { return Math.floor(RUN.planetsCleared / itinLen()); }
  function ballPrice(k) { var b = BALLS[k]; return b ? Math.round(b.price * Math.pow(1.25, systemsCleared())) : 0; }
  function lifePrice() { return 40 + 20 * RUN.lifeBuys; }

  // ── per-shot ball mechanics — called from updatePhysics via RG._ballStep (ball is moving) ──
  function ballStep() {
    if (typeof ball === 'undefined' || !ball) return;
    if (!RUN._shotActive) {                 // LAUNCH: lock the ball for this shot + spend a charge
      RUN._shotActive = true;
      var a = RUN.activeBall;
      if (a !== 'normal' && (RUN.charges[a] || 0) > 0) { RUN.shotBall = a; RUN.charges[a] -= 1; }
      else RUN.shotBall = 'normal';
      RUN._landed = false; RUN._stopUsed = false; RUN._stopReq = false; RUN._bounces = 0;
      RUN._wasGround = !!ball.onGround; RUN._prevVy = ball.vy;
    }
    var sb = RUN.shotBall;
    if (sb === 'normal') { RUN._wasGround = !!ball.onGround; return; }
    var speed = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
    if (sb === 'sticky') {
      if (ball.onGround && !RUN._landed) { RUN._landed = true; ball.vx = 0; ball.vy = 0; }
    } else if (sb === 'wall') {
      // Lively ricochet: the engine reflects the ball off terrain by flipping vy (falling → rising). When
      // that happens, restore a HIGH restitution so it bounces far instead of dying — decays (0.85 < 1) and
      // is capped (count + magnitude) so it always settles soon after. This is what makes it "travel far".
      if (RUN._prevVy > 1 && ball.vy < 0 && RUN._bounces < 3) {
        RUN._bounces++;
        ball.vy = -Math.min(Math.abs(RUN._prevVy) * 0.6, 6);   // livelier than a normal bounce, but low + decaying so it never reaches the top wall and always settles
      }
    } else if (sb === 'stop') {
      if (RUN._stopReq && !RUN._stopUsed && !ball.onGround) { RUN._stopReq = false; RUN._stopUsed = true; RUN._stopEverUsed = true; ball.vx = 0; ball.vy = Math.max(ball.vy, 2.2); }
    }
    RUN._wasGround = !!ball.onGround;
    RUN._prevVy = ball.vy;   // track vertical velocity to detect the engine's terrain bounces (wall ball)
  }

  // ── shot lifecycle (runs every frame from tick, even at rest) — end-of-shot auto-revert ──
  function ballLifecycle() {
    if (typeof ball === 'undefined' || !ball) return;
    if (RUN._shotActive && ball.atRest) {
      RUN._shotActive = false;
      var a = RUN.activeBall;
      if (a !== 'normal' && (RUN.charges[a] || 0) <= 0) RUN.activeBall = 'normal';   // out of charges → back to normal
    }
  }
  function selectBall(k) {
    if (RUN.gameOver || RUN._shopOpen) return;
    if (k === 'normal') { RUN.activeBall = 'normal'; return; }
    if (!RUN.owned[k] || (RUN.charges[k] || 0) <= 0) return;
    RUN.activeBall = k;
  }
  RUN._selectBall = selectBall;

  // ── BAG chip row (bottom, pointer-events on chips only, visible only when aiming) ──
  var bag = null, _bagSig = '';
  function makeBag() {
    bag = document.createElement('div');
    bag.id = 'rg-bag';
    bag.style.cssText = 'position:fixed;left:0;right:0;z-index:62;display:none;gap:8px;' +
      "justify-content:center;align-items:flex-end;pointer-events:none;font-family:'Departure Mono',monospace;";
    bag.addEventListener('click', function (e) {
      var t = e.target; while (t && t !== bag && !(t.getAttribute && t.getAttribute('data-ball'))) t = t.parentNode;
      if (t && t.getAttribute && t.getAttribute('data-ball')) selectBall(t.getAttribute('data-ball'));
    });
    (document.body || document.documentElement).appendChild(bag);
  }
  function drawBag() {
    if (!bag) makeBag();
    var show = !RUN.gameOver && !RUN._shopOpen && Object.keys(RUN.owned).length > 0 &&
      g(function () { return state === STATE_AIM; }, false) && g(function () { return ball && ball.atRest; }, false);
    if (!show) { if (bag.style.display !== 'none') { bag.style.display = 'none'; _bagSig = ''; } return; }
    var bi = (g(function () { return window.RG_PORTRAIT && RG_PORTRAIT.safeBottomCss; }, 0) || 0);
    bag.style.bottom = (Math.round(bi) + 14) + 'px';
    var chips = [{ k: 'normal', label: 'NORMAL', ch: null }];
    for (var i = 0; i < BALL_ORDER.length; i++) { var k = BALL_ORDER[i]; if (RUN.owned[k]) chips.push({ k: k, label: BALLS[k].short, ch: (RUN.charges[k] || 0) }); }
    var sig = chips.map(function (c) { return c.k + ':' + c.ch + (RUN.activeBall === c.k ? '*' : ''); }).join('|');
    if (sig === _bagSig) { bag.style.display = 'flex'; return; }   // no change → don't rebuild (keeps taps clean)
    _bagSig = sig;
    var html = '';
    for (var c = 0; c < chips.length; c++) {
      var ch = chips[c], active = (RUN.activeBall === ch.k), dead = (ch.ch === 0);
      var bg = active ? 'rgba(255,216,107,0.22)' : 'rgba(0,0,0,0.5)';
      var bd = active ? '#ffd86b' : 'rgba(255,255,255,0.35)';
      var col = dead ? 'rgba(255,255,255,0.32)' : (active ? '#ffd86b' : '#fff');
      html += '<div data-ball="' + ch.k + '" style="pointer-events:auto;cursor:pointer;min-width:46px;text-align:center;' +
        'padding:5px 8px;border-radius:7px;background:' + bg + ';border:1px solid ' + bd + ';color:' + col + ';font-size:11px;line-height:1.25;">' +
        ch.label + (ch.ch != null ? ('<br><span style="font-size:10px;opacity:0.8;">' + (dead ? '—' : ('x' + ch.ch)) + '</span>') : '') + '</div>';
    }
    bag.innerHTML = html; bag.style.display = 'flex';
  }
  // STOP trigger: a tap on the play area while the stop ball is airborne (bag is hidden in flight, so any
  // mid-air tap is a play-area tap). Capture phase, no preventDefault → aim input (rest-only) is unaffected.
  window.addEventListener('pointerdown', function () {
    if (RUN.gameOver || RUN._shopOpen || RUN.shotBall !== 'stop' || !RUN._shotActive) return;
    if (g(function () { return ball && ball.onGround; }, true)) return;
    RUN._stopReq = true;
  }, true);

  // ── STOP teaching hint: a one-time "tap to drop" cue the first time the stop ball is airborne, so the
  // mid-air tap is discoverable. Teaches once per run, then never shows again (learn-by-doing). ──
  var stopHint = null;
  function drawStopHint() {
    var show = !RUN.gameOver && !RUN._shopOpen && RUN.shotBall === 'stop' && RUN._shotActive &&
      !RUN._stopUsed && !RUN._stopEverUsed && g(function () { return ball && !ball.onGround; }, false);
    if (!stopHint) {
      stopHint = document.createElement('div');
      stopHint.id = 'rg-stophint'; stopHint.textContent = 'TAP TO DROP';
      stopHint.style.cssText = 'position:fixed;left:0;right:0;bottom:92px;z-index:61;text-align:center;display:none;' +
        "pointer-events:none;font-family:'Departure Mono',monospace;color:#ffd86b;font-size:14px;letter-spacing:2px;text-shadow:0 1px 5px rgba(0,0,0,0.8);";
      (document.body || document.documentElement).appendChild(stopHint);
    }
    var d = show ? 'block' : 'none';
    if (stopHint.style.display !== d) stopHint.style.display = d;
  }

  // ── SHOP (full-screen overlay on planet-clear, BEFORE travel; gates the travel until Continue) ──
  function courseStrokesTotal() { var n = holeCount(), s = 0, sc = g(function () { return RG.holeScores; }, []); for (var i = 0; i < n; i++) s += (sc && sc[i] != null ? sc[i] : 0); return s; }
  function refillCharges() { for (var k in RUN.owned) if (RUN.owned[k]) RUN.charges[k] = CHARGES_PER_COURSE; }
  function rollOffers() {
    var offers = [], unowned = BALL_ORDER.filter(function (k) { return !RUN.owned[k]; });
    for (var i = 0; i < unowned.length && offers.length < 3; i++) offers.push({ type: 'ball', key: unowned[i] });
    if (offers.length < 3 && RUN.strikes < 3) offers.push({ type: 'life' });   // one life buy-back if below max
    RUN._offers = offers;
  }
  // Award money + bump planet count + refill charges + build the shop. Returns true if the shop opened.
  function finalizeCourseClear() {
    var cPar = coursePar(), cStrokes = courseStrokesTotal();
    if (cPar > 0) {
      var pay = awardCourseMoney(cStrokes, cPar);
      RUN.planetsCleared += 1;
      console.log('[rogue] PLANET CLEAR (shop): ' + cStrokes + ' vs par ' + cPar + ' -> +$' + pay + ' ($' + RUN.money + '), planets ' + RUN.planetsCleared);
    }
    RUN._lastCoursePar = 0; RUN._lastCourseStrokes = 0;   // the economy poll must NOT re-award on travel
    if (RUN.planetsCleared === 1 && RUN.money < BALLS.sticky.price) RUN.money = BALLS.sticky.price;   // first-shop floor
    refillCharges();
    rollOffers();
    if (!RUN._offers.length) return false;   // nothing to buy (own all balls, max lives) → skip the shop
    RUN._shopOpen = true; _shopSig = '';
    return true;
  }
  var shop = null, _shopSig = '';
  function makeShop() {
    shop = document.createElement('div');
    shop.id = 'rg-shop';
    // Solid (not translucent) so the canvas RUN-COMPLETE recap + the top HUD never bleed through behind it.
    shop.style.cssText = 'position:fixed;inset:0;z-index:8000;display:none;flex-direction:column;align-items:center;' +
      "justify-content:center;gap:13px;background:#0b0814;font-family:'Departure Mono',monospace;color:#f2ecff;text-align:center;padding:24px;";
    shop.addEventListener('click', function (e) {
      var t = e.target; while (t && t !== shop && !(t.getAttribute && (t.getAttribute('data-offer') != null || t.getAttribute('data-go')))) t = t.parentNode;
      if (!t || !t.getAttribute) return;
      if (t.getAttribute('data-go')) { continueTravel(); return; }
      var oi = t.getAttribute('data-offer'); if (oi != null) buyOffer(parseInt(oi, 10));
    });
    (document.body || document.documentElement).appendChild(shop);
  }
  function renderShop() {
    if (!shop) makeShop();
    if (!RUN._shopOpen) { if (shop.style.display !== 'none') shop.style.display = 'none'; return; }
    var offers = RUN._offers || [];
    var sig = '$' + RUN.money + '|L' + RUN.strikes + '|' + offers.map(function (o) { return o.type + (o.key || ''); }).join(',');
    shop.style.display = 'flex';
    if (sig === _shopSig) return;   // no change → don't rebuild (keeps taps clean)
    _shopSig = sig;
    var html = '<div style="font-size:24px;letter-spacing:3px;">SHOP</div>' +
      '<div style="font-size:14px;color:#ffd86b;">$' + RUN.money + '   ·   LIVES ' + RUN.strikes + '</div>';
    for (var i = 0; i < offers.length; i++) {
      var o = offers[i], label, sub, price;
      if (o.type === 'ball') { var b = BALLS[o.key]; label = b.name + ' BALL'; sub = b.desc; price = ballPrice(o.key); }
      else { label = '+1 LIFE'; sub = 'restore a strike'; price = lifePrice(); }
      var afford = RUN.money >= price;
      var col = afford ? '#fff' : 'rgba(255,255,255,0.34)', bd = afford ? 'rgba(255,216,107,0.85)' : 'rgba(255,255,255,0.16)';
      html += '<div data-offer="' + i + '" style="' + (afford ? 'pointer-events:auto;cursor:pointer;' : 'pointer-events:none;') +
        'width:min(82vw,310px);padding:10px 14px;border-radius:9px;border:1px solid ' + bd + ';color:' + col + ';' +
        'display:flex;justify-content:space-between;align-items:center;gap:10px;"><span style="text-align:left;">' + label +
        '<br><span style="font-size:11px;opacity:0.7;">' + sub + '</span></span><span style="font-size:15px;color:' + (afford ? '#ffd86b' : col) + ';">$' + price + '</span></div>';
    }
    html += '<div data-go="1" style="pointer-events:auto;cursor:pointer;margin-top:8px;padding:10px 28px;border-radius:9px;background:#ffd86b;color:#1a1330;font-size:15px;">CONTINUE ▸</div>';
    shop.innerHTML = html;
  }
  function buyOffer(idx) {
    var offers = RUN._offers || [], o = offers[idx]; if (!o) return;
    if (o.type === 'ball') { var p = ballPrice(o.key); if (RUN.money < p) return; RUN.money -= p; RUN.owned[o.key] = true; RUN.charges[o.key] = CHARGES_PER_COURSE; offers.splice(idx, 1); }
    else { var lp = lifePrice(); if (RUN.money < lp || RUN.strikes >= 3) return; RUN.money -= lp; RUN.strikes = Math.min(3, RUN.strikes + 1); RUN.lifeBuys += 1; offers.splice(idx, 1); }
    _shopSig = ''; renderShop();
  }
  function closeShop() { RUN._shopOpen = false; _shopSig = ''; if (shop) shop.style.display = 'none'; }
  RUN._closeShop = closeShop;
  function continueTravel() {
    if (!RUN._shopOpen) return;
    closeShop();
    var pt = RUN._pendingTravel; RUN._pendingTravel = null;
    if (pt && RUN._origBeginTravel) { try { RUN._origBeginTravel(pt.dest, pt.mode); } catch (e) {} }
    // The shop WAS the travel-decision gate, so auto-advance the travel's deep-space hold (_descPhase
    // 'thold' waits for RG._travelTap) — Continue flows straight into the travel cinematic, no second tap.
    var tries = 0;
    var iv = setInterval(function () {
      tries++;
      try { if (window.RG && RG._travelTap) RG._travelTap(); } catch (e) {}
      if (tries > 160 || !(window.RG && RG._travelSeq)) clearInterval(iv);
    }, 50);
  }
  // Wrap RG._beginTravel so a course-complete travel opens the shop first; Continue resumes the real travel.
  function wrapTravel() {
    if (RUN._origBeginTravel || !(window.RG && RG._beginTravel)) return;
    RUN._origBeginTravel = RG._beginTravel.bind(RG);
    RG._beginTravel = function (dest, mode) {
      if (RG.active && !RUN.gameOver && !RUN._shopOpen && RG._surfaceRunOnly && RG._surfaceRunOnly()) {
        RUN._pendingTravel = { dest: dest, mode: mode };
        finalizeCourseClear();
        if (RUN._shopOpen) return;        // hold travel; Continue fires RUN._origBeginTravel
        RUN._pendingTravel = null;        // no shop (no offers) → travel now
      }
      return RUN._origBeginTravel(dest, mode);
    };
  }

  // ── PER-FRAME POLL ──────────────────────────────────────────────────────────────────────────
  // Detect (a) a hole completing — currentHole advanced — and (b) a course completing — RG.course
  // changed (travel landed on the next body). We process exactly the holes that advanced, reading
  // their real strokes/par from RG.holeScores / RG.holePars.
  function poll() {
    if (!(window.RG && RG.active)) return;          // not in a live run yet
    var course = curCourse();
    var hole = curHole();

    // First sighting of a live run → latch baselines, don't replay history.
    if (!RUN._booted) {
      RUN._booted = true;
      RUN.lastCourse = course;
      RUN.lastHole = hole;
      RUN.courseStartStrokes = g(function () { return totalStrokes; }, 0);
      return;
    }
    if (RUN.gameOver) return;                        // progression frozen on game over

    // ── COURSE CHANGED (travel landed on a new planet) ──
    // The hole index resets (new course is built fresh, currentHole back near 0). Award money for
    // the course we just left, bump the planet count, then re-baseline for the new course.
    if (course !== RUN.lastCourse && course != null) {
      // The course we just finished cleared all its holes (we only travel on course-complete).
      var cPar = RUN._lastCoursePar || 0;
      var cStrokes = RUN._lastCourseStrokes || 0;
      if (cPar > 0) {
        var pay = awardCourseMoney(cStrokes, cPar);
        RUN.planetsCleared += 1;
        console.log('[rogue] PLANET CLEAR: course strokes ' + cStrokes + ' vs par ' + cPar +
          ' -> +$' + pay + ' (money $' + RUN.money + '), planets ' + RUN.planetsCleared);
      }
      RUN.lastCourse = course;
      RUN.lastHole = hole;
      RUN.overall = 0;            // ALWAYS START EVEN PAR on every course — cushion does NOT carry between planets
      RUN.courseStartStrokes = g(function () { return totalStrokes; }, 0);
      RUN._lastCoursePar = 0; RUN._lastCourseStrokes = 0;
      return;
    }

    // ── HOLE(S) ADVANCED within the current course ──
    if (hole > RUN.lastHole) {
      var pars = g(function () { return RG.holePars; }, []);
      var scores = g(function () { return RG.holeScores; }, []);
      for (var i = RUN.lastHole; i < hole && !RUN.gameOver; i++) {
        var par = (pars && pars[i] != null) ? pars[i] : 3;
        var strokes = (scores && scores[i] != null) ? scores[i] : par;   // fallback = even par
        applyHole(strokes, par);
      }
      RUN.lastHole = hole;

      // If this completed the course (cleared all holes), remember its totals so the NEXT poll —
      // when travel has swapped RG.course — can award money against this course's par. We capture
      // here because RG.holePars/holeScores get cleared when the next course is built.
      if (hole >= holeCount()) {
        var cp = coursePar();
        var cs = 0, n = holeCount();
        var sc = g(function () { return RG.holeScores; }, []);
        for (var j = 0; j < n; j++) cs += (sc && sc[j] != null ? sc[j] : 0);
        RUN._lastCoursePar = cp;
        RUN._lastCourseStrokes = cs;
      }
    }
  }

  // ── HUD (DOM overlay; below the notch; pointer-events:none so it never blocks a shot) ──
  var hud = null, over = null;
  function topInsetPx() {
    // Convert the portrait game-unit inset to CSS px so the DOM HUD sits below the notch like the
    // canvas HUD. cssToGame is game-units-per-css-px, so divide. Falls back to a safe 44px.
    var inset = g(function () { return window.RG_PORTRAIT && RG_PORTRAIT.hudTopInset && RG_PORTRAIT.hudTopInset(); }, null);
    var c2g = g(function () { return window.RG_PORTRAIT && RG_PORTRAIT.cssToGame; }, 1) || 1;
    if (inset != null) return Math.round(inset / c2g);
    return 44;
  }

  function makeHud() {
    hud = document.createElement('div');
    hud.id = 'rg-galaxy-hud';
    // Match the PC game's HUD: plain left-aligned monospace, white headline + dim sublines, NO panel/colour.
    // pointer-events:none so it never eats a shot. (The engine's corner readout is suppressed in tick().)
    hud.style.cssText = 'position:fixed;left:20px;z-index:60;pointer-events:none;' +
      "font-family:'Departure Mono',monospace;color:#ffffff;" +
      'text-shadow:0 1px 3px rgba(0,0,0,0.6);line-height:1.3;white-space:pre;';
    (document.body || document.documentElement).appendChild(hud);
  }

  function drawHud() {
    if (!hud) makeHud();
    hud.style.top = topInsetPx() + 'px';
    if (RUN.gameOver) { hud.style.display = 'none'; return; }
    hud.style.display = 'block';

    var sc = g(function () { return window.RG_PORTRAIT && RG_PORTRAIT.hudScale; }, 0.62) || 0.62;
    var px = function (n) { return Math.round(n * sc) + 'px'; };
    var dim = 'rgba(255,255,255,0.55)';

    var holeNo = Math.min(curHole() + 1, holeCount());
    var par = g(function () { return RG.holePars[curHole()]; }, null);
    var curStrokes = g(function () { return strokes; }, 0);   // strokes on the current hole so far

    // course score = overall (cumulative strokes vs par THIS course; starts even, resets even each course).
    var ov = RUN.overall;
    var courseTxt = ov < 0 ? (Math.abs(ov) + ' UNDER') : (ov === 0 ? 'EVEN' : ('+' + ov + ' OVER'));

    hud.innerHTML =
      '<div style="font-size:' + px(28) + ';">HOLE ' + holeNo + ' / ' + holeCount() + '</div>' +
      '<div style="font-size:' + px(19) + ';color:' + dim + ';">PAR ' + (par != null ? par : '?') +
        (curStrokes > 0 ? ('   ' + curStrokes + ' STROKE' + (curStrokes > 1 ? 'S' : '')) : '') + '</div>' +
      '<div style="font-size:' + px(19) + ';margin-top:' + px(10) + ';">LIVES ' + RUN.strikes + '</div>' +
      '<div style="font-size:' + px(19) + ';color:' + dim + ';">' + courseTxt + ' THIS COURSE</div>' +
      '<div style="font-size:' + px(16) + ';color:' + dim + ';">$' + RUN.money + '   PLANET ' + (RUN.planetsCleared + 1) + '</div>';
  }

  // ── GAME-OVER overlay (full-screen, pointer-events:auto, tap/click to retry) ──
  function makeOver() {
    over = document.createElement('div');
    over.id = 'rg-galaxy-over';
    over.style.cssText = 'position:fixed;inset:0;z-index:9000;display:none;' +
      'flex-direction:column;align-items:center;justify-content:center;gap:14px;' +
      'background:rgba(8,6,14,0.86);cursor:pointer;' +
      "font-family:'Departure Mono',monospace;color:#f2ecff;text-align:center;padding:24px;";
    over.addEventListener('click', onRetry);
    over.addEventListener('touchstart', function (e) { e.preventDefault(); onRetry(); }, { passive: false });
    (document.body || document.documentElement).appendChild(over);
  }
  var _retrying = false;
  function onRetry() {
    if (!RUN.gameOver || _retrying) return;
    _retrying = true;
    if (over) over.style.display = 'none';
    startFreshRun();
    RUN._booted = false;               // re-latch baselines onto the fresh run on the next poll
    setTimeout(function () { _retrying = false; }, 400);
  }

  function drawOver() {
    if (!over) makeOver();
    if (!RUN.gameOver) { if (over.style.display !== 'none') over.style.display = 'none'; return; }
    over.style.display = 'flex';
    var score = RUN.planetsCleared + RUN.holesCleared;
    over.innerHTML =
      '<div style="font-size:30px;letter-spacing:3px;">GAME OVER</div>' +
      '<div style="font-size:15px;color:rgba(242,236,255,0.78);line-height:1.7;">' +
        'Planet ' + (RUN.planetsCleared + 1) + ' · ' + RUN.holesCleared + ' holes' +
        ' · $' + RUN.money + '<br>score ' + score + '</div>' +
      '<div style="font-size:13px;color:#ffd86b;margin-top:6px;">tap to retry</div>';
  }

  // ── DRIVE: own cheap rAF (independent of the game loop) so the HUD + poll run every frame ──
  function tick() {
    // In rogue mode our HUD OWNS the top — suppress the engine's corner HOLE/PAR/strokes readout so the
    // two don't stack/overlap. Done once, the moment RG is ready (gated to ?rogue, so always correct here).
    if (!RUN._hudSuppressed) {
      try { if (window.RG && typeof RG._drawScoreHUD === 'function') { RG._drawScoreHUD = function () {}; RUN._hudSuppressed = true; } } catch (e) {}
    }
    // Suppress the engine's hole-1 "PlanetName / N Holes" title card — it draws top-left, exactly where the
    // rogue HUD lives, so the two overlap on every course's first hole. The planet name still shows on the
    // travel-arrival card; the rogue HUD covers the rest. (Inert outside rogue — this whole file is ?rogue.)
    try { if (typeof showTitle !== 'undefined' && showTitle) showTitle = false; } catch (e) {}
    // Slice 2 wiring: install the ball-physics hook + the travel→shop gate once RG is live.
    if (!RUN._slice2Wired && window.RG) {
      try { RG._ballStep = ballStep; wrapTravel(); if (RUN._origBeginTravel) RUN._slice2Wired = true; } catch (e) {}
    }
    try { poll(); ballLifecycle(); drawHud(); drawBag(); drawStopHint(); renderShop(); drawOver(); } catch (e) { /* never break the page */ }
    requestAnimationFrame(tick);
  }
  // Wait until the body exists, then go.
  function boot() {
    if (!document.body) { return setTimeout(boot, 30); }
    requestAnimationFrame(tick);
    console.log('[rogue] galaxy-run armed (?rogue) — 3 strikes, par-buffer economy');
  }
  boot();
})();
