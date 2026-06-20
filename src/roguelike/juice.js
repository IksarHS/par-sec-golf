// ── juice.js — ball motion juice (peel-off-able) ───────────────────────────
// ADDITIVE overlays on top of the real ball, drawn in world space from one line added to
// wrap.js drawWorld (same convention as fx.js RG_FX.draw — composites under the HUD, with the
// camera/zoom transform already applied). Three possible beats, all white-on-white (the ball's
// own colour — introduces NO new signal, honoring "color = behavior"):
//   (a) a fading motion TRAIL behind the ball during fast flight, speed-scaled (longer/brighter
//       the faster it flies; nothing at putt speed). Continuous ribbon or spaced breadcrumbs.
//   (b) an impact POP on a hard launch or hard landing: a brief expanding ring (+ optionally a
//       short squash-ghost) — an OVERLAY, never touching the core ball render.
//   (c) a quiet REST ripple — a slow single ring that blooms once when the ball comes to rest
//       (the held-breath moment before the next aim). The calmest, lonely-but-cozy beat.
//
// The variants are STYLES along a quiet<->impact / trail<->pop axis, NOT one effect at two
// volumes — pick a different *character*, not just a louder gain:
//   off    — nothing (purist / no juice).
//   settle — rest ripple ONLY. No trail, no launch/landing pop. The quietest reading.
//   comet  — trail-forward: a long, faint, SPACED (dotted) breadcrumb trail; NO pop at all.
//   subtle — balanced (DEFAULT): continuous fading ribbon + a soft impact pop (ring + faint ghost).
//   lively — the loud ceiling: a present ribbon + a clean expanding ring, NO squash-ghost.
// Pick with RG_JUICE_VARIANT, the ?juice=N query param (0..4), or the ?dev Shift+J cycler.
// Never cartoony — every entry stays deadpan-calm.
//
// Determinism untouched: the trail/pop/ripple are PURE functions of the live physics — there is
// no Math.random anywhere in this module and NEVER the terrain PRNG random(). Silent in the
// headless bot (the draw hook doesn't run there) and inert in secret rooms / during the crane.
// Peel-off: delete this file + its <script> tag + the one RG_JUICE.draw line in wrap.js -> the
// ball looks exactly as it did.
(function () {
  // Five styles. 'subtle' ships by default (public-build calm, balanced trail+pop).
  // trail: max samples, alpha ceiling, width scale, sampleEvery (1 = continuous, >1 = spaced dots).
  // pop:   ring radius/alpha, ghost alpha (0 = no squash-ghost), popMin (px/frame edge threshold).
  // rest:  restAlpha (0 = no rest ripple), restR (ripple radius).
  const VARIANTS = {
    off:    { trailMax: 0,  trailAlpha: 0,    trailWidth: 0,    sampleEvery: 1, ringR: 0,  ringAlpha: 0,    ghostAlpha: 0,    popMin: 99, restAlpha: 0,    restR: 0 },
    settle: { trailMax: 0,  trailAlpha: 0,    trailWidth: 0,    sampleEvery: 1, ringR: 0,  ringAlpha: 0,    ghostAlpha: 0,    popMin: 99, restAlpha: 0.20, restR: 22 },
    comet:  { trailMax: 14, trailAlpha: 0.18, trailWidth: 0.9,  sampleEvery: 3, ringR: 0,  ringAlpha: 0,    ghostAlpha: 0,    popMin: 99, restAlpha: 0,    restR: 0 },
    subtle: { trailMax: 10, trailAlpha: 0.24, trailWidth: 1.0,  sampleEvery: 1, ringR: 16, ringAlpha: 0.30, ghostAlpha: 0.16, popMin: 9,  restAlpha: 0,    restR: 0 },
    lively: { trailMax: 16, trailAlpha: 0.38, trailWidth: 1.35, sampleEvery: 1, ringR: 20, ringAlpha: 0.34, ghostAlpha: 0,    popMin: 8,  restAlpha: 0,    restR: 0 },
  };
  let variantName = 'subtle';

  function readVariant() {
    if (window.RG_JUICE_VARIANT && VARIANTS[window.RG_JUICE_VARIANT]) return window.RG_JUICE_VARIANT;
    if (typeof location !== 'undefined') {
      const m = /[?&]juice=(\d)/.exec(location.search);
      if (m) { const order = ['off', 'settle', 'comet', 'subtle', 'lively']; return order[+m[1]] || 'subtle'; }
    }
    return variantName;
  }
  function V() { return VARIANTS[readVariant()] || VARIANTS.subtle; }

  let enabled = true;
  const SPEED_ON = 3.2;   // px/frame — below this the trail does nothing (a putt leaves none)
  const SPEED_FULL = 14;  // px/frame — trail at full length/alpha at/above this
  const trail = [];        // ring buffer of {x,y} recent ball centres (newest last)
  const pops = [];         // {x,y,life,max,r0,r1,rot,f} expanding-ring (+ optional squash-ghost)
  const ripples = [];      // {x,y,life,max,r1} slow rest ripple (settle)
  const POP_CAP = 6;
  const fired = { pop: 0, ripple: 0 }; // headless verification counters

  // edge-detection state (own; draw runs once per rendered frame)
  let wasFlight = false, wasAir = false, lastSpeed = 0, sampleTick = 0;

  function ballR() { return (typeof BALL_RADIUS !== 'undefined') ? BALL_RADIUS : 4; }
  function ballCol() { return (typeof BALL_COLOR !== 'undefined') ? BALL_COLOR : '#ffffff'; }

  function spawnPop(x, y, impact, vx, vy) {
    fired.pop++;
    if (!enabled) return;
    const v = V();
    if (v.ringAlpha <= 0 && v.ghostAlpha <= 0) return;   // pop-suppressed styles (off/settle/comet)
    const f = Math.min(1, impact / 18);                 // 0..1 strength
    // squash axis: flatten perpendicular to the velocity (a ball hitting the ground squashes
    // along the ground). rot is the velocity angle; the ghost is a wide-short ellipse rotated to it.
    const sp = Math.hypot(vx || 0, vy || 0);
    const rot = sp > 0.001 ? Math.atan2(vy || 0, vx || 0) : 0;
    pops.push({
      x: x, y: y, life: 0, max: 9 + Math.round(4 * f),
      r0: ballR() * 1.1, r1: v.ringR * (0.55 + 0.45 * f),
      f: f, rot: rot,
    });
    while (pops.length > POP_CAP) pops.shift();
  }

  function spawnRipple(x, y) {
    fired.ripple++;
    if (!enabled) return;
    const v = V();
    if (v.restAlpha <= 0) return;                        // ripple-suppressed styles
    ripples.push({ x: x, y: y, life: 0, max: 34, r1: v.restR });   // ~0.57s slow bloom
    while (ripples.length > 3) ripples.shift();
  }

  // A guard: only run the live-detection/draw on a genuine rendered frame of a real run.
  function live() {
    return !!(window.RG && RG.active !== undefined && RG.active && !RG._simulating
      && typeof ball !== 'undefined' && typeof state !== 'undefined');
  }
  function suppressed() {
    // No overlay in the underground/secret rooms or while the descent crane owns the screen.
    return !!(window.RG && (RG.inFault || RG.inVault || (RG._descPhase && RG._descPhase !== 'none')));
  }

  function draw(ctx) {
    if (!live() || suppressed()) {
      // keep edge state from going stale across a suppressed stretch, but don't accumulate
      if (trail.length) trail.length = 0;
      wasFlight = false; wasAir = false;
      // still age out any in-flight transients so they don't freeze on-screen
      tickPops(ctx);
      tickRipples(ctx);
      return;
    }
    const v = V();
    const sp = Math.hypot(ball.vx || 0, ball.vy || 0);
    const inFlight = (state === STATE_FLIGHT);
    const inAir = inFlight && !ball.onGround;

    // ── edges ──
    // launch: AIM/REST -> FLIGHT with real speed (the strike off the lie). Anchor the ghost/ring
    // to the SURFACE the ball is leaving (a squash reads truest at a surface, not mid-air).
    if (inFlight && !wasFlight && sp >= v.popMin) {
      spawnPop(ball.x, groundUnderBall(), sp, ball.vx, ball.vy);
    }
    // hard landing: was airborne, now grounded, with carried speed
    if (wasAir && inFlight && ball.onGround && lastSpeed >= v.popMin) {
      spawnPop(ball.x, groundUnderBall(), lastSpeed, ball.vx, -Math.abs(ball.vy || 1));
    }
    // quiet rest: FLIGHT -> not-FLIGHT (the ball has come to rest, ready to aim again). The
    // settle ripple's held-breath beat; fires once on the settling edge regardless of impact.
    if (wasFlight && !inFlight) {
      spawnRipple(ball.x, groundUnderBall());
    }

    // ── trail sampling ── only while actually moving through the air at speed
    if (inAir && sp >= SPEED_ON) {
      sampleTick++;
      if (v.sampleEvery <= 1 || (sampleTick % v.sampleEvery) === 0) {
        trail.push({ x: ball.x, y: ball.y });
        while (trail.length > v.trailMax) trail.shift();
      }
    } else if (trail.length) {
      trail.shift();                      // bleed the tail out when slow/grounded (no hard pop-off)
      sampleTick = 0;
    }

    drawTrail(ctx, sp, v);
    tickPops(ctx);
    tickRipples(ctx);

    wasFlight = inFlight; wasAir = inAir; lastSpeed = sp;
  }

  function groundUnderBall() {
    // the surface directly under the ball — where a squash/ripple reads honestly
    try {
      if (typeof terrainYAt === 'function') return terrainYAt(ball.x) - ballR() * 0.4;
    } catch (e) {}
    return ball.y;
  }

  // ── (a) the fading, speed-scaled trail ──
  // A tapering ribbon of the recent ball centres: oldest = faint+thin, newest = brightest.
  // Overall alpha and effective length scale with current speed so a soft chip barely smears
  // while a hard drive leaves a clean streak. A sqrt falloff keeps the BODY of the ribbon alive
  // (a coherent line) rather than only the head — see critique. Drawn behind the ball (overlay).
  function drawTrail(ctx, sp, v) {
    if (v.trailMax <= 0 || trail.length < 2) return;
    const speedK = Math.max(0, Math.min(1, (sp - SPEED_ON) / (SPEED_FULL - SPEED_ON)));
    if (speedK <= 0.001) return;
    const r = ballR();
    const col = ballCol();
    ctx.save();
    ctx.fillStyle = col;
    const n = trail.length;
    for (let i = 0; i < n; i++) {
      const t = (i + 1) / n;                 // 0..1, newest highest
      const p = trail[i];
      const a = v.trailAlpha * speedK * Math.sqrt(t);   // sqrt fade keeps the ribbon body legible
      if (a < 0.012) continue;
      ctx.globalAlpha = a;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r * v.trailWidth * (0.35 + 0.55 * t), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // ── (b) the impact pop: expanding ring (+ optional squash-ghost) ──
  function tickPops(ctx) {
    if (!pops.length) return;
    const v = V();
    const r = ballR();
    const col = ballCol();
    ctx.save();
    for (let i = pops.length - 1; i >= 0; i--) {
      const pp = pops[i];
      pp.life++;
      if (pp.life >= pp.max) { pops.splice(i, 1); continue; }
      const t = pp.life / pp.max;            // 0..1 over the pop's short life
      const ease = 1 - (1 - t) * (1 - t);    // ease-out for the expansion

      // expanding ring (a crisp echo that blooms out and fades). Slightly thicker than a hairline
      // so it reads as a deliberate tick, not a render glitch.
      if (v.ringAlpha > 0) {
        const rad = pp.r0 + (pp.r1 - pp.r0) * ease;
        ctx.globalAlpha = v.ringAlpha * (1 - t) * (0.5 + 0.5 * pp.f);
        ctx.strokeStyle = col;
        ctx.lineWidth = 1.8 * (1 - t * 0.5);
        ctx.beginPath();
        ctx.arc(pp.x, pp.y, rad, 0, Math.PI * 2);
        ctx.stroke();
      }

      // squash-ghost: a flattened white echo of the ball, widest at impact, relaxing to round as
      // it fades, rotated to the velocity axis. Drawn as a SEPARATE overlay shape — the real ball
      // sprite is never altered. Kept low-alpha (subtle only); lively drops it entirely so its
      // clean ring is the whole impact (a genuinely different read, not just louder).
      if (v.ghostAlpha > 0 && t < 0.6) {
        const gt = t / 0.6;                  // 0..1 across the ghost's shorter life
        const squash = (1 - gt);             // 1 = fully squashed at impact, 0 = round
        const wide = r * (1 + 0.7 * squash * (0.6 + 0.6 * pp.f));
        const tall = r * (1 - 0.55 * squash);
        ctx.globalAlpha = v.ghostAlpha * (1 - gt);
        ctx.fillStyle = col;
        ctx.save();
        ctx.translate(pp.x, pp.y);
        ctx.rotate(pp.rot);
        ctx.beginPath();
        ctx.ellipse(0, 0, wide, tall, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }
    ctx.restore();
  }

  // ── (c) the quiet rest ripple (settle) ──
  // A single slow concentric ring that blooms once from the ball's resting point — "the world
  // acknowledges you stopped here." No squash, no speed gate; pure cosmetic, fair at v=0.
  function tickRipples(ctx) {
    if (!ripples.length) return;
    const v = V();
    const col = ballCol();
    ctx.save();
    for (let i = ripples.length - 1; i >= 0; i--) {
      const rp = ripples[i];
      rp.life++;
      if (rp.life >= rp.max) { ripples.splice(i, 1); continue; }
      const t = rp.life / rp.max;            // 0..1 slow life
      const ease = 1 - (1 - t) * (1 - t);    // ease-out bloom
      const rad = ballR() * 1.1 + (rp.r1 - ballR() * 1.1) * ease;
      ctx.globalAlpha = (v.restAlpha || 0.2) * (1 - t) * (1 - t);  // fade out quadratically (gentle)
      ctx.strokeStyle = col;
      ctx.lineWidth = 1.4 * (1 - t * 0.5);
      ctx.beginPath();
      ctx.arc(rp.x, rp.y, rad, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  window.RG_JUICE = {
    variants: Object.keys(VARIANTS),
    get variant() { return readVariant(); },
    setVariant(name) {
      if (VARIANTS[name]) { variantName = name; window.RG_JUICE_VARIANT = name; }
      return readVariant();
    },
    cycleVariant() {
      const keys = Object.keys(VARIANTS);
      const cur = keys.indexOf(readVariant());
      return this.setVariant(keys[(cur + 1) % keys.length]);
    },
    enable(b) { enabled = b !== false; },
    draw: draw,
    _fired: fired,
    _trailCount() { return trail.length; },
    _popCount() { return pops.length; },
    _rippleCount() { return ripples.length; },
    // test/screenshot helper: pop at the ball now (impact, optional vx/vy for squash axis)
    _pop(impact, vx, vy) {
      const x = (typeof ball !== 'undefined') ? ball.x : 0;
      const y = (typeof ball !== 'undefined') ? groundUnderBall() : 0;
      spawnPop(x, y, impact || 12, (vx == null ? (typeof ball !== 'undefined' ? ball.vx : 0) : vx), (vy == null ? -8 : vy));
      return pops.length;
    },
    // test/screenshot helper: rest ripple at the ball now (settle)
    _ripple() {
      const x = (typeof ball !== 'undefined') ? ball.x : 0;
      const y = (typeof ball !== 'undefined') ? groundUnderBall() : 0;
      spawnRipple(x, y);
      return ripples.length;
    },
  };

  // ?dev cycler: Shift+J steps off -> settle -> comet -> subtle -> lively -> off, with a toast.
  if (typeof location !== 'undefined' && /[?&]dev\b/.test(location.search)) {
    window.addEventListener('keydown', function (e) {
      if ((e.key === 'J' || e.key === 'j') && e.shiftKey) {
        const name = RG_JUICE.cycleVariant();
        let el = document.getElementById('rg-juice-toast');
        if (!el) { el = document.createElement('div'); el.id = 'rg-juice-toast'; el.style.cssText = 'position:fixed;left:12px;bottom:82px;z-index:9989;font:11px monospace;color:#cdd6f5;background:rgba(14,11,18,0.7);border:1px solid rgba(205,214,245,0.2);border-radius:7px;padding:5px 9px;'; document.body.appendChild(el); }
        el.textContent = '✦ ball juice: ' + name; el.style.display = 'block';
      }
    });
  }
})();
