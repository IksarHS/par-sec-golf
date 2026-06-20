// ── travel.js — the between-holes TRAVEL/PROGRESS beat (peel-off-able) ─────────
// A brief, calm, Spelunky-style "moving to the next" beat drawn OVER the existing
// hole-to-hole camera pan: it conveys forward motion and carries the just-finished
// hole's result, then gets out of the way before the next tee. One screen-space draw
// line in wrap.js drawHUD (RG_TRAVEL.draw) feeds it; everything else is read from
// live state, so it is a pure observer:
//   * It NEVER drives the state machine. The engine's STATE_TRANSITION pan (driven by
//     transitionTimer / TRANSITION_PAN in gameplay.js) advances on its own; this only
//     paints over it. So it CANNOT stall the bot or block a hole transition — peel the
//     file and the pan is exactly as it was.
//   * It reads the just-finished hole from RG.holeScores / RG.holePars (currentHole was
//     already incremented in onTransitionStart, so the finished hole is currentHole-1).
//
// THREE DISTINCT variants for taste judgment (default OFF — variant 0 draws nothing, so
// the shipped build is unchanged). Pick with RG_TRAVEL_VARIANT (0..3), the ?travel=N
// query param, or the ?dev Shift+T cycler:
//   0  off          — nothing (default; the build as it ships today)
//   1  progress rail — a quiet pip rail tucked under the top-left HOLE n/9 readout; the
//                      just-finished pip fills (tinted by result) and a single token slides
//                      to the next tee's pip. A board-game token advancing one space.
//   2  ship crossing — a tiny scruffy ship (once repaired; a plain ball before) coasts
//                      left→right high in the empty sky with a faint contrail and a single
//                      tinted result dot in tow. The "crossing the friendly dark" motif.
//   3  drift         — the purest, text-free floor: a faint mote layer nudges past (the sky
//                      visibly slides by — the SENSATION of travel) and the just-finished
//                      result rides as ONE tinted dot that drifts in from the trailing edge
//                      and docks. Color carries the fact, text carries nothing.
//
// CRITIQUE PASS (2026-06-13): the old "result card" (a rounded bordered slide-in toast) was
// CUT — all three critics flagged it as the off-tone outlier (panel chrome breaks the flat-
// color law, most text, a "system reporting your score" register against deadpan/near-zero
// text). The crossing was kept as the hero (refined: higher in the sky, a tinted dot instead
// of the ambiguous "E" text chip, a plain ball pre-ship-repair so it never spoils the
// discovery, a gentle coast/bob). The rail was refined off dead-center (it collided with the
// amber "Launch to the Moon" prompt) into a quiet top-left progress hint, no floating text.
// The new "drift" variant fills the critics' requested fourth: a no-HUD, no-text diegetic
// floor that honors "never a load screen, panning between holes."
//
// Near-zero text, skippable (the pan is short and a click that starts the next aim ends it
// naturally — nothing ever traps input). Calm by design: low alphas, no shout, one hero
// motion per beat (the pan is ~1.5s, so a single tracked motion lands better than many).
//
// Determinism untouched: the only seeded thing (drift's mote scatter) hashes via RG._faultHash
// — NEVER the terrain PRNG random() — so terrain is byte-for-byte unchanged. Everything else
// reads live score state and the engine's own transition clock. Silent in the headless bot.
// Peel-off: delete this file + its <script> tag + the one RG_TRAVEL.draw line in wrap.js.
(function () {
  let _variant = 0;
  if (typeof location !== 'undefined') {
    const m = /[?&]travel=(\d)/.exec(location.search);
    if (m) { const n = parseInt(m[1], 10); if (n >= 0 && n <= 3) _variant = n; }
  }
  function variant() {
    if (window.RG_TRAVEL_VARIANT != null) {
      const n = window.RG_TRAVEL_VARIANT | 0;
      if (n >= 0 && n <= 3) return n;
    }
    return _variant;
  }

  // Tier tint for a finished hole, matching the recap idiom (gold ace / green under / pale par / dim over).
  const ACE = '#f0c860', UNDER = '#7ad17a', PAR = '#cdd6f5', OVER = '#8a93a8';
  function tintFor(strokes, par) {
    if (strokes == null || par == null) return PAR;
    if (strokes <= 1) return ACE;          // a one (the ace) glows gold
    if (strokes < par) return UNDER;
    if (strokes === par) return PAR;
    return OVER;
  }

  // Only paint on a genuine rendered transition frame of a real surface run — never in the
  // headless/simulated bot, never in the secret rooms, never during the Fault crane.
  function live() {
    if (!(window.RG && RG.active && !RG._simulating)) return false;
    if (typeof state === 'undefined' || state !== STATE_TRANSITION) return false;
    if (!(RG._surfaceRunOnly && RG._surfaceRunOnly())) return false;
    if (RG._descPhase && RG._descPhase !== 'none') return false;
    return true;
  }

  // Eased 0..1 progress through the engine's pan (mirrors gameplay.js's own ease so the
  // beat tracks the camera move exactly, on any refresh rate — the engine clamps the count).
  function panT() {
    const pan = (typeof TRANSITION_PAN !== 'undefined') ? TRANSITION_PAN : 90;
    const tt = (typeof transitionTimer !== 'undefined') ? transitionTimer : 0;
    return Math.max(0, Math.min(1, tt / pan));
  }
  function easeInOut(t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }

  // The just-finished hole (currentHole already advanced in onTransitionStart).
  function finishedInfo() {
    const cur = (typeof currentHole !== 'undefined') ? currentHole : 0;
    const idx = cur - 1;                                   // the hole we just sank
    if (idx < 0) return null;
    const strokes = (RG.holeScores && RG.holeScores[idx] != null) ? RG.holeScores[idx] : null;
    const par = (RG.holePars && RG.holePars[idx] != null) ? RG.holePars[idx] : null;
    return { idx: idx, next: cur, strokes: strokes, par: par, count: RG.holeCount || 9 };
  }

  function font(px) { return px + "px 'Departure Mono', monospace"; }

  // ── Variant 1: the hole-progress rail ────────────────────────────────────────
  // A quiet pip rail tucked under the top-left HOLE n/9 readout (NOT dead-bottom-center,
  // where it used to stack on the amber "Launch to the Moon" prompt). One pip per hole. The
  // just-finished pip fills (tinted by result), and a single small token slides from it to the
  // next tee's pip across the pan — a board game token advancing one space. No floating text:
  // the tinted fill IS the result (color=behavior). Only shown once a hole is done, so early
  // holes stay pure world.
  function drawRail(ctx, info, t) {
    if (info.next < 1) return;                              // nothing finished yet — stay out of the world
    const e = easeInOut(t);
    const n = info.count;
    const x0 = 24;                                          // hug the left, under the HOLE readout
    const y = 46;
    const step = 16;                                        // tight, board-game spacing
    const railW = (n - 1) * step;
    // a soft dark backing strip so the pale pips survive over both green sward and navy sky
    const fade = Math.min(1, t / 0.16) * Math.min(1, (1 - t) / 0.14 + 0.35);

    ctx.save();
    ctx.textAlign = 'center';
    ctx.globalAlpha = fade * 0.30;
    ctx.fillStyle = 'rgba(14,11,18,0.9)';
    if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(x0 - 10, y - 8, railW + 20, 16, 8); ctx.fill(); }

    // the base rail line
    ctx.globalAlpha = fade * 0.20; ctx.strokeStyle = '#cdd6f5'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x0 + railW, y); ctx.stroke();

    for (let i = 0; i < n; i++) {
      const px = x0 + i * step;
      const done = i < info.next;                          // holes already finished this run
      const justFin = (i === info.idx);
      const fillK = justFin ? e : (done ? 1 : 0);          // the just-finished pip fills across the pan
      // pip ring
      ctx.globalAlpha = fade * (done ? 0.55 : 0.26);
      ctx.strokeStyle = '#cdd6f5'; ctx.lineWidth = 1.1;
      ctx.beginPath(); ctx.arc(px, y, 3.6, 0, Math.PI * 2); ctx.stroke();
      // pip fill
      if (fillK > 0.01) {
        ctx.globalAlpha = fade * 0.85 * fillK;
        ctx.fillStyle = justFin ? tintFor(info.strokes, info.par) : '#6f7891';
        ctx.beginPath(); ctx.arc(px, y, 2.5, 0, Math.PI * 2); ctx.fill();
      }
    }
    // a single travelling token glides cleanly from the finished pip toward the next tee
    // (no hop arc, no ring-scale easing — calmer, fewer magic numbers). Tinted by the result
    // it carries, so the moving dot is the fact in motion.
    const fromX = x0 + info.idx * step;
    const toX = x0 + Math.min(info.next, n - 1) * step;
    const mx = fromX + (toX - fromX) * e;
    ctx.globalAlpha = fade * 0.95; ctx.fillStyle = tintFor(info.strokes, info.par);
    ctx.beginPath(); ctx.arc(mx, y - 9, 2.4, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  // ── Variant 2: the tiny ship crossing ────────────────────────────────────────
  // A small craft coasts across the EMPTY upper sky band with a faint contrail and a single
  // tinted result dot in tow — the "crossing the friendly dark" motif the vision names. The
  // craft is the repaired ship glyph ONLY once the ship is complete (RG_SHIP.complete()); before
  // that it is a plain ball, so the travel beat never spoils the discovery the whole game is
  // built around. A gentle vertical bob makes it read as coasting, not on rails. Result is
  // carried by the trailing dot's COLOUR (no ambiguous "E" text chip floating in the sky).
  function drawCrossing(ctx, info, t) {
    const e = easeInOut(t);
    const y = H * 0.20 + Math.sin(t * Math.PI * 2) * 4;     // high in the emptiest sky; a hair of coast/bob
    const x = -40 + (W + 80) * e;                           // sweep fully off both edges
    const fade = Math.min(1, t / 0.16) * Math.min(1, (1 - t) / 0.16);
    if (fade <= 0.01) return;
    const tint = tintFor(info.strokes, info.par);
    const repaired = !!(window.RG_SHIP && RG_SHIP.complete && RG_SHIP.complete());
    ctx.save();
    // contrail behind it — a whisper of fading dots, the LAST one tinted by the result so the
    // fact rides quietly in the trail rather than as text.
    for (let i = 1; i <= 6; i++) {
      const tx = x - i * 11;
      const last = (i === 6 && info.strokes != null);
      ctx.globalAlpha = fade * (last ? 0.7 : 0.16) * (last ? 1 : (1 - i / 7));
      ctx.fillStyle = last ? tint : '#cdd6f5';
      const r = last ? 3.0 : (2.2 - i * 0.18);
      ctx.beginPath(); ctx.arc(tx, y + Math.sin(i * 0.7) * 1.2, r, 0, Math.PI * 2); ctx.fill();
    }
    // the craft: the repaired ship glyph once it exists, else a clean little ball (no spoiler)
    ctx.translate(x, y);
    let drewGlyph = false;
    if (repaired && window.RG_SHIP && RG_SHIP.drawGlyph) {
      ctx.save();
      ctx.globalAlpha = fade * 0.92;
      ctx.strokeStyle = '#f2ecff'; ctx.fillStyle = '#f2ecff';
      ctx.lineWidth = 2; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      try { RG_SHIP.drawGlyph(ctx, 0, 4, 0.4); drewGlyph = true; } catch (err) { drewGlyph = false; }
      ctx.restore();
    }
    if (!drewGlyph) {
      ctx.globalAlpha = fade * 0.92; ctx.fillStyle = '#f2ecff';
      ctx.beginPath(); ctx.arc(0, 0, 4, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  // ── Variant 3: the drift (text-free diegetic floor) ──────────────────────────
  // The purest expression of the design law: the sky visibly slides by (a faint extra mote
  // layer nudged horizontally a touch faster than the camera — the SENSATION of travel, zero
  // glyphs, zero overlay) and the just-finished result rides as ONE tinted dot that drifts in
  // from the trailing (left) edge and docks toward centre as the pan settles. Color carries the
  // fact; text carries nothing. Lives in the sky and at the screen edge, so it can NEVER collide
  // with the bottom-centre launch prompt or the ball's landing.
  //
  // Determinism: the mote scatter hashes via RG._faultHash (NOT random()), so terrain is
  // untouched. Falls back to a small inline mix only if the harness isn't present.
  function hash(n) {
    if (window.RG && RG._faultHash) return RG._faultHash(n >>> 0);
    let h = (0x811c9dc5 ^ (n >>> 0)) >>> 0;
    h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
    h = Math.imul(h ^ (h >>> 13), 0x297a2d39);
    h ^= h >>> 16; return h >>> 0;
  }
  function drawDrift(ctx, info, t) {
    const e = easeInOut(t);
    const fade = Math.min(1, t / 0.12) * Math.min(1, (1 - t) / 0.18 + 0.2);
    const band = H * 0.55;
    // the streaming motes: a sparse scatter that slides LEFT (world sliding by under us) over
    // the pan, then eases to rest. Pure cosmetic, seeded by hash so it never touches terrain.
    const slide = e * 220;                                  // px the field travels across the beat
    ctx.save();
    for (let i = 0; i < 22; i++) {
      const h1 = hash((i + 1) * 2654435761);
      const h2 = hash((h1 ^ 0x9e3779b9) >>> 0);
      const baseX = (h1 % 1000) / 1000;                     // 0..1 across a wrapped strip
      const yy = 8 + ((h2 % 1000) / 1000) * band;
      const depth = 0.35 + ((h2 >>> 10) % 100) / 100 * 0.65; // nearer motes slide farther
      const span = W + 60;
      let sx = ((baseX * span - slide * depth) % span + span) % span - 30;
      ctx.globalAlpha = fade * (0.05 + ((h1 >>> 20) % 10) / 100) * depth;
      ctx.fillStyle = '#cdd8f0';
      const r = 0.8 + depth * 1.0;
      ctx.fillRect(sx, yy, r, r);
    }
    // the single result dot: drifts in from the trailing edge and docks toward centre-sky.
    // Its COLOUR is the only information — gold/green/pale/dim, the recap idiom.
    if (info.strokes != null) {
      const dotX = -20 + (W * 0.5 + 20) * e;                // enters from the left edge, settles mid-left
      const dotY = H * 0.30;
      const tint = tintFor(info.strokes, info.par);
      // a soft halo so the lone dot reads as "the one that matters" without any label
      ctx.globalAlpha = fade * 0.18; ctx.fillStyle = tint;
      ctx.beginPath(); ctx.arc(dotX, dotY, 9, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = fade * 0.95; ctx.fillStyle = tint;
      ctx.beginPath(); ctx.arc(dotX, dotY, 3.4, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  function draw(ctx) {
    const v = variant();
    if (v === 0 || !live()) return;
    const info = finishedInfo();
    if (!info) return;
    const t = panT();
    if (v === 1) drawRail(ctx, info, t);
    else if (v === 2) drawCrossing(ctx, info, t);
    else if (v === 3) drawDrift(ctx, info, t);
  }

  window.RG_TRAVEL = {
    get variant() { return variant(); },
    setVariant(n) {
      n = n | 0;
      if (n >= 0 && n <= 3) { _variant = n; window.RG_TRAVEL_VARIANT = n; }
      return variant();
    },
    cycleVariant() { return this.setVariant((variant() + 1) % 4); },
    draw: draw,
    _names: ['off', 'progress rail', 'ship crossing', 'drift'],
  };

  // ?dev cycler: Shift+T steps off -> rail -> crossing -> drift -> off, with a small toast.
  if (typeof location !== 'undefined' && /[?&]dev\b/.test(location.search)) {
    window.addEventListener('keydown', function (e) {
      if ((e.key === 'T' || e.key === 't') && e.shiftKey) {
        const v = RG_TRAVEL.cycleVariant();
        let el = document.getElementById('rg-travel-toast');
        if (!el) {
          el = document.createElement('div'); el.id = 'rg-travel-toast';
          el.style.cssText = 'position:fixed;left:12px;bottom:110px;z-index:9989;font:11px monospace;color:#cdd6f5;background:rgba(14,11,18,0.7);border:1px solid rgba(205,214,245,0.2);border-radius:7px;padding:5px 9px;';
          document.body.appendChild(el);
        }
        el.textContent = '✦ travel beat: ' + RG_TRAVEL._names[v] + ' (' + v + ')';
        el.style.display = 'block';
      }
    });
  }
})();
