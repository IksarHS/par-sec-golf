// ── onboard.js — first-run "there is more out there" nudges (variants for judgment) ──
// Wordless, calm nudges that point a brand-new player past ordinary golf toward the broken
// ship and the larger game — WITHOUT a tutorial, a prompt, or a single word. These are options
// to FEEL and choose between (the breadcrumb is still undecided — decide-by-playtest), NOT a
// committed mechanic. Default OFF for players; opt one in via a flag or the ?dev cycler.
//
// Converged on four DISTINCT planes after the critique panel — each says "east / out there"
// from a different axis, so the designer can pick (or stack) without two cues fighting:
//
//   'sky'   — FAR / persistent. One faint flat-shaded disc hung high to the EAST (the travel
//             direction), visible from hole 1, breathing very slowly. Reads as a far DESTINATION,
//             not decoration. The deepest, calmest "there is a place out there." (Refined: tamer
//             halo, a fainter crescent, shares ambient.js's hash so two discs never fight.)
//   'wake'  — GROUND / trace. On the final Earth hole's apron, a faint set of old ball-divots and
//             a single hairline dashed arc trail EAST off the cup toward the ship — as if someone
//             golfed this way before and kept going. Pure environmental storytelling: no UI, no
//             glow, no motion. Reuses the dashed shot-trajectory idiom the game already owns, and
//             points east via the GROUND (where sky points from above).
//   'reach' — EVENT / earned. The first time you come to rest NEAR the wreck on the final hole,
//             the ship's status light does ONE slow, deliberate brighten-and-settle — the world
//             acknowledging you got here, drawn on the ship itself in world space. Once-ever per
//             save (localStorage). Silent until you've actually golfed out to the edge, so it
//             rewards reaching rather than nagging from hole 1.
//   'glint' — DIRECTIONAL / edge. A soft directional chevron hugging the screen margin at the
//             ship's screen-y, pointing toward the wreck when it is off-frame — "something is out
//             there." (Refined to a single still tick: the on-dome pulse + expanding ring were
//             cut — they duplicated the ship's own status light and read as a UI ping. Gated to
//             appear only after you've reached the last hole, and suppressed while you're aiming
//             so it never competes with the shot line.)
//
// Determinism: anything seeded is RG._faultHash only (never the terrain PRNG random()), so the
// gate's determinism check is untouched — these are cosmetic. Silent in the headless bot.
//
// Hooks: RG_ONBOARD.draw (run.js _drawOverlays — the FOREGROUND cues wake/reach/glint, screen
// space) + RG_ONBOARD.drawBehind (wrap.js drawSky — the 'sky' far body, drawn BEHIND the world so
// it never paints over the flag/ball, like ambient.js) + RG_ONBOARD.tick (wrap.js drawWorld — a
// per-frame cosmetic latch pass that also runs at STATE_COMPLETE). Peel this file off (its
// <script> tag + those three lines) and Earth is exactly as it was.
(function () {
  const VARIANTS = ['sky', 'wake', 'reach', 'glint'];

  // Ships OFF so a public build is identical until a variant is chosen. A persisted choice
  // (localStorage 'rg-onboard') wins so a build can pin one; the ?dev cycler writes here too.
  const on = { sky: false, wake: false, reach: false, glint: false };
  let _read = false;

  function readPersisted() {
    if (_read) return;
    _read = true;
    try {
      const v = localStorage.getItem('rg-onboard');     // '', a variant, or e.g. 'sky+wake'
      if (v) { for (const k in on) on[k] = false; v.split('+').forEach(function (k) { if (k in on) on[k] = true; }); }
    } catch (e) { /* no storage -> stays off */ }
  }
  function persist() {
    try {
      const list = VARIANTS.filter(function (k) { return on[k]; });
      localStorage.setItem('rg-onboard', list.join('+'));
    } catch (e) { /* ignore */ }
  }

  // ── shared, render-only helpers ───────────────────────────────────────────
  function rg() { return window.RG; }
  function onEarth() {
    const R = rg();
    return !!(R && R.active && R.course === 'earth-course' && !R.inVault && !R.inFault);
  }
  function camX() { return (typeof camera !== 'undefined' && camera.x) || 0; }
  // Deterministic, never the terrain PRNG. Prefer ambient.js's hash so the two modules share one
  // mix (no byte-identical copy); fall back to RG._faultHash, then a standalone FNV-ish mix.
  function hash(n) {
    if (window.RG_AMBIENT && RG_AMBIENT._hash) return RG_AMBIENT._hash(n >>> 0);
    const R = rg();
    if (R && R._faultHash) return R._faultHash(n >>> 0);
    let h = (0x811c9dc5 ^ (n >>> 0)) >>> 0;
    h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
    h = Math.imul(h ^ (h >>> 13), 0x297a2d39);
    h ^= h >>> 16; return h >>> 0;
  }

  // The ship's world-x. Prefer the live descriptor (set once you golf out to the apron on the
  // last hole); otherwise derive it from the last hole's cup the same way ship.js does
  // (cupX + 170), so the eastward nudges have a target from hole 1 onward.
  function shipWorldX() {
    const R = rg();
    const sp = window.RG_secret ? window.RG_secret('ship') : null;
    if (sp && sp.pos) return sp.pos.x;
    if (typeof holes !== 'undefined' && R) {
      const h = holes[(R.holeCount || holes.length) - 1];
      if (h && h.cupX != null) return h.cupX + 170;
    }
    return null;
  }
  function shipScreen() {
    const R = rg();
    const sp = window.RG_secret ? window.RG_secret('ship') : null;
    if (sp && sp.pos && window.RG_secretUtil) {
      return { x: window.RG_secretUtil.sx(sp.pos.x), y: window.RG_secretUtil.sy(sp.pos.y), live: true, wx: sp.pos.x, wy: sp.pos.y };
    }
    const wx = shipWorldX();
    if (wx == null) return null;
    return { x: wx - camX(), y: H * 0.62, live: false, wx: wx, wy: null };
  }
  // True while the player is dragging a shot: suppress edge cues so nothing competes with the
  // shot line. The engine's drag state is the script-global `aiming` (shared.js:129, a top-level
  // `let` reachable by bare reference from this script). Fail open (treat unknown as "not aiming").
  function isAiming() {
    try { if (typeof aiming !== 'undefined' && aiming === true) return true; } catch (e) {}
    return false;
  }
  // Have we reached the final hole at least once (this run is currently on it, or a past run got
  // there)? Used to gate the edge chevron so it is a "go further" nudge, not hole-1 clutter.
  function reachedLastHole() {
    const R = rg();
    if (!R) return false;
    const last = (typeof holes !== 'undefined') ? (holes.length - 1) : ((R.holeCount || 9) - 1);
    if (typeof currentHole !== 'undefined' && currentHole >= last) return true;
    try { return localStorage.getItem('rg-onboard-reached-last') === '1'; } catch (e) { return false; }
  }
  function markReachedLast() { try { localStorage.setItem('rg-onboard-reached-last', '1'); } catch (e) {} }

  let _t = 0;

  // ── 'sky' — a far body to the east, from hole 1 ───────────────────────────
  // One faint flat-shaded disc hung high and biased EAST (the travel/launch direction), so it
  // reads as a destination rather than scenery. Seeded per run (hash) for a small vertical wobble
  // in placement, but always east-of-centre, never west or low. Very slow breath. Tiny parallax
  // (it is far). Earth only (the Moon's own sky owns its bodies). ambient.js's decorative 'body'
  // defers to this on Earth, so only one focal disc ever hangs.
  function drawSky(ctx) {
    if (!onEarth()) return;
    const R = rg();
    const seed = (R && (R.seed | 0)) || 0;
    const h = hash((seed ^ 0x53ed91a7) >>> 0);
    const fx = 0.74 + ((h % 1000) / 1000) * 0.16;            // east band: x in 0.74..0.90 of screen
    const fy = 0.10 + (((h >>> 10) % 1000) / 1000) * 0.16;   // high band: y in 0.10..0.26 (a touch more range)
    const r = 9 + ((h >>> 20) % 6);                          // a small 9..14 px disc (a far world)
    const par = camX() * 0.010;                              // barely moves (distant)
    const bx = fx * W - par, by = fy * H;
    const breath = 0.5 + 0.5 * Math.sin(_t * 0.012);         // very slow — do not speed up
    ctx.save();
    ctx.globalAlpha = 0.16 + 0.10 * breath;                  // tamer halo: caps ~0.26, was ~0.36
    ctx.fillStyle = '#9fb0d8';
    ctx.beginPath(); ctx.arc(bx, by, r * 1.5, 0, Math.PI * 2); ctx.fill();   // halo 1.5x (was 1.9x)
    ctx.globalAlpha = 0.46 + 0.10 * breath;                  // the disc
    ctx.fillStyle = '#c3cdec';
    ctx.beginPath(); ctx.arc(bx, by, r, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 0.22;                                  // a fainter flat lit crescent (the Moon's-Earth idiom)
    ctx.fillStyle = '#e3e9fb';
    ctx.beginPath(); ctx.ellipse(bx - r * 0.3, by - r * 0.28, r * 0.6, r * 0.45, -0.5, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  // ── 'wake' — a found trace on the final apron, pointing east ───────────────
  // The ground's own "someone came this way." On the FINAL Earth hole only, between the cup and
  // the ship, lay one hairline dashed arc (the dashed shot-trajectory vocabulary the game already
  // owns) plus one or two faint divots, trailing east off the cup toward the wreck. No UI, no
  // glow, no motion — a still, lonely-but-cozy trace you READ. Seeded only for the tiny divot
  // jitter (hash), so it is identical every run. Drawn in world space (projected via camX) so it
  // pans naturally with the terrain and never floats as a screen overlay.
  const WAKE_REACH = 150;            // how far east of the cup the trace trails (a short ghost shot)
  function drawWake(ctx) {
    if (!onEarth()) return;
    if (typeof terrainYAt !== 'function') return;
    const R = rg();
    const last = (typeof holes !== 'undefined') ? (holes.length - 1) : ((R.holeCount || 9) - 1);
    // Only on the final hole — the trace belongs at the threshold, not on every green.
    if (typeof currentHole === 'undefined' || currentHole < last) return;
    const h = (typeof holes !== 'undefined') && holes[last];
    if (!h || h.cupX == null) return;
    const shipX = shipWorldX();
    const cupX = h.cupX;
    if (shipX != null && shipX <= cupX) return;              // the wreck must lie east for the trace to mean "that way"
    // A SHORT ghost shot trailing east off the cup along the apron — NOT a path all the way to the
    // wreck (which can sit far away and low in a valley). It says "someone overflew this cup and
    // kept going east," then the eye carries that line out toward the ship on its own. Capped to a
    // modest reach and clamped to a gentle eastward slope so it hugs the playable apron, never
    // diving into whatever pit the wreck rests in.
    const x0 = cupX + 22, x1 = cupX + 22 + WAKE_REACH;
    const span = x1 - x0;
    const sx0 = x0 - camX(), sx1 = x1 - camX();
    if (sx1 < -40 || sx0 > W + 40) return;                   // wholly off-screen: skip
    const seed = (R && (R.seed | 0)) || 0;
    const baseY = terrainYAt(cupX);                          // anchor the trace to the cup's ground
    const camY = (typeof camera !== 'undefined' && camera.y) || 0;
    // The ground line the trace rides: the cup's ground, easing gently DOWN toward the east edge
    // (a soft apron fall-away) so it never tracks the wreck's deep valley. clamp keeps it on-apron.
    function lineY(u) { return baseY + 16 * u; }
    ctx.save();
    // The hairline dashed arc: a shallow lob skimming the apron, the dashed shot-trajectory idiom.
    ctx.globalAlpha = 0.16;
    ctx.strokeStyle = '#9aa6c0';
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 6]);
    ctx.beginPath();
    const STEPS = 28;
    for (let i = 0; i <= STEPS; i++) {
      const u = i / STEPS;
      const wx = x0 + span * u;
      const lob = Math.sin(u * Math.PI) * 16;                // a low, shallow arc clearing the ground
      const sx = wx - camX();
      const sy = (lineY(u) - lob) - camY;
      if (i === 0) ctx.moveTo(sx, sy); else ctx.lineTo(sx, sy);
    }
    ctx.stroke();
    ctx.setLineDash([]);
    // One or two faint divots on the ground where the ghost ball bit in along the apron.
    // Seeded jitter only — identical every run, never touches terrain.
    const divots = 2;
    ctx.globalAlpha = 0.13;
    ctx.fillStyle = '#7d8295';
    for (let i = 0; i < divots; i++) {
      const hh = hash((seed ^ (0x1d07 + i * 0x9e37)) >>> 0);
      const u = 0.30 + (i / Math.max(1, divots - 1)) * 0.40 + ((hh % 100) / 100 - 0.5) * 0.05;
      const wx = x0 + span * u;
      const sx = wx - camX();
      const sy = lineY(u) - camY;
      ctx.beginPath();
      ctx.ellipse(sx, sy, 3.0, 1.2, 0, 0, Math.PI * 2);     // a flat, shallow scrape
      ctx.fill();
    }
    ctx.restore();
  }

  // ── 'reach' — the ship acknowledges you, once, on arrival ──────────────────
  // EVENT / earned. The first time the ball comes to rest NEAR the wreck on the final hole, the
  // ship's status light does ONE slow brighten-and-settle: brighter than its idle blink, then
  // back. Drawn on the ship in world space (projected via shipScreen), so it pans naturally and is
  // never a screen-space modal trick. Fires once-ever per save (localStorage latch). Silent until
  // you are genuinely near the wreck — it rewards reaching the edge, never nags from hole 1.
  const REACH_FRAMES = 96;           // ~1.6s brighten-and-settle (one slow breath)
  const REACH_NEAR = 200;            // px from the ship that counts as "arrived"
  let _reach = null;                 // { f } while the gleam is playing

  function reachDone() { try { return localStorage.getItem('rg-onboard-reach-done') === '1'; } catch (e) { return false; } }
  function markReachDone() { try { localStorage.setItem('rg-onboard-reach-done', '1'); } catch (e) {} }

  // Detect arrival each frame (called from the latch pass `tick`). Arms the gleam exactly once.
  function reachWatch() {
    const R = rg();
    if (!on.reach || !onEarth() || !R || R._simulating) return;
    if (reachDone()) return;
    const shipX = shipWorldX();
    if (shipX == null || typeof ball === 'undefined') return;
    // "Resting near the wreck": ball nearly still and within REACH_NEAR of the ship's x.
    const still = (typeof ball.vx !== 'number') || (Math.abs(ball.vx) < 0.6 && Math.abs(ball.vy || 0) < 0.6);
    if (still && Math.abs(ball.x - shipX) < REACH_NEAR) {
      _reach = { f: 0 };
      markReachDone();
    }
  }
  function drawReach(ctx) {
    if (!_reach) return;
    if (!onEarth()) { _reach = null; return; }
    const s = shipScreen();
    if (!s) { _reach = null; return; }
    _reach.f++;
    const t = Math.min(1, _reach.f / REACH_FRAMES);
    // one smooth hump: brighten in, settle out (sine, peaking mid-cycle)
    const amp = Math.sin(t * Math.PI);
    // the status light sits at ship dome-corner: ship.js draws it at (sx+6, sy-40)
    const lx = s.x + 6, ly = s.y - 40;
    if (lx < -40 || lx > W + 40) { if (_reach.f >= REACH_FRAMES) _reach = null; return; }
    ctx.save();
    // a soft halo swelling around the light, then settling — diegetic "the wreck noticed you"
    ctx.globalAlpha = 0.10 + 0.32 * amp;
    ctx.fillStyle = RG_SHIP && RG_SHIP.complete && RG_SHIP.complete() ? '#7ad17a' : '#e8b86a';
    ctx.beginPath(); ctx.arc(lx, ly, 3 + 9 * amp, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 0.40 + 0.50 * amp;                     // the light itself, briefly bright
    ctx.beginPath(); ctx.arc(lx, ly, 2.4, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    if (_reach.f >= REACH_FRAMES) _reach = null;             // back to the ship's own idle blink
  }

  // ── 'glint' — a directional edge chevron toward the unreached ship ─────────
  // DIRECTIONAL / edge. When the ship is off the right edge (you have not golfed out to it yet), a
  // soft chevron hugs the screen margin at the ship's screen-y, pointing east — "something is out
  // there." Refined per critique: the on-dome pulse + expanding ring were CUT (they duplicated the
  // ship's own status light and read as a UI ping). This is now a single still tick with a faint
  // slow drift, gated to appear only AFTER you have reached the last hole at least once (a "go
  // further" cue, not hole-1 clutter), and suppressed while you are aiming.
  function drawGlint(ctx) {
    if (!onEarth()) return;
    if (isAiming()) return;                                  // never compete with the shot line
    if (!reachedLastHole()) return;                          // gated: only once the edge is in reach
    const s = shipScreen();
    if (!s) return;
    // Only when the ship's dome is genuinely off the right edge — if it is in frame, the ship's
    // own status light carries the read; we add nothing.
    const domeY = s.y - 40;
    if (s.x < W - 24) return;
    const pulse = 0.5 + 0.5 * Math.sin(_t * 0.018);          // a faint, almost-still gleam (sky-slow)
    const wob = Math.sin(_t * 0.05) * 3;                     // a small east-ward drift, then reset
    const ex = W - 14 + wob;
    const my = Math.max(40, Math.min(H - 44, domeY));
    ctx.save();
    ctx.translate(ex, my);
    ctx.globalAlpha = 0.10 + 0.16 * pulse;
    ctx.strokeStyle = '#dfe8ff'; ctx.lineWidth = 1.6; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath();                                         // a small ">" chevron pointing east
    ctx.moveTo(-6, -5); ctx.lineTo(0, 0); ctx.lineTo(-6, 5);
    ctx.stroke();
    ctx.restore();
  }

  // ── the per-frame latch pass (from wrap.js drawWorld — runs at ALL states) ──
  // Watches for the 'reach' arrival edge (and keeps the reached-last latch fresh). No camera
  // moves, no state writes — purely a cosmetic latch + arrival detector. Silent in the bot.
  function tick() {
    readPersisted();
    const R = rg();
    if (!R || !R.active || R._simulating) return;
    if (onEarth() && reachedLastHole()) markReachedLast();   // persist that the edge was reached
    if (on.reach) reachWatch();
  }

  // ── the BEHIND-the-world hook (from wrap.js drawSky — screen space, before drawWorld) ──
  // Only the 'sky' far body lives here so it sits behind the flag + an airborne ball (same plane
  // as ambient's body/strata). _t is advanced in draw() below (the front pass), which also runs
  // every frame; this reads it, so the slow breath stays animated (a 1-frame lag is imperceptible).
  function drawBehind(ctx) {
    readPersisted();
    const R = rg();
    if (!R || !R.active) return;
    if (R.inFault || R.inVault) return;                  // underground/secret rooms: no open sky
    if (R._simulating) return;                           // never in the headless bot
    if (R._descPhase && R._descPhase !== 'none') return; // the crane owns the screen
    if (on.sky) drawSky(ctx);                            // far body, deepest — behind the world
  }

  // ── the in-play FOREGROUND hook (from run.js _drawOverlays — screen space) ──
  function draw(ctx) {
    readPersisted();
    const R = rg();
    if (!R || !R.active) return;
    if (R.inFault || R.inVault) return;                  // underground/secret rooms: no open sky / ship
    if (R._simulating) return;                           // never in the headless bot
    if (R._descPhase && R._descPhase !== 'none') return; // the crane owns the screen
    _t++;
    if (on.wake) drawWake(ctx);     // ground trace on the final apron
    if (on.reach) drawReach(ctx);   // the ship's one-time arrival gleam
    if (on.glint) drawGlint(ctx);   // directional edge chevron when the ship is off-frame
  }

  window.RG_ONBOARD = {
    variants: VARIANTS,
    draw: draw,
    drawBehind: drawBehind,
    tick: tick,
    isOn(v) { readPersisted(); return v ? !!on[v] : VARIANTS.some(function (k) { return on[k]; }); },
    enable(v, b) { readPersisted(); if (v in on) { on[v] = (b !== false); persist(); } return this.isOn(v); },
    only(v) { readPersisted(); for (const k in on) on[k] = (k === v); persist(); return v; },
    none() { readPersisted(); for (const k in on) on[k] = false; persist(); return ''; },
    // headless / screenshot helper: force one on for this session (no persist).
    _force(v) { for (const k in on) on[k] = (k === v); _read = true; return v; },
    // test helpers: clear the once-ever latches so an event variant can be re-observed.
    _resetReach() { try { localStorage.removeItem('rg-onboard-reach-done'); } catch (e) {} _reach = null; },
    _resetReached() { try { localStorage.removeItem('rg-onboard-reached-last'); } catch (e) {} },
    // test helper: fire the reach gleam now (no near-check), for screenshots.
    _fireReach() { _reach = { f: 0 }; return true; },
  };

  // ?dev cycler: Shift+O steps none -> sky -> wake -> reach -> glint -> none, with a small toast.
  if (typeof location !== 'undefined' && /[?&]dev\b/.test(location.search)) {
    let idx = -1;                                    // -1 = none
    window.addEventListener('keydown', function (e) {
      if ((e.key === 'O' || e.key === 'o') && e.shiftKey) {
        idx = (idx + 2) % (VARIANTS.length + 1) - 1; // -1,0,1,2,3,-1...
        const name = idx < 0 ? '' : VARIANTS[idx];
        if (name) RG_ONBOARD.only(name); else RG_ONBOARD.none();
        let el = document.getElementById('rg-onboard-toast');
        if (!el) { el = document.createElement('div'); el.id = 'rg-onboard-toast'; el.style.cssText = 'position:fixed;left:12px;bottom:84px;z-index:9989;font:11px monospace;color:#cdd6f5;background:rgba(14,11,18,0.7);border:1px solid rgba(205,214,245,0.2);border-radius:7px;padding:5px 9px;'; document.body.appendChild(el); }
        el.textContent = '✦ onboard: ' + (name || 'off'); el.style.display = 'block';
      }
    });
  }
})();
