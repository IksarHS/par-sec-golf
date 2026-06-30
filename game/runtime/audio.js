// ── audio.js — synthesized WebAudio juice (peel-off-able) ──────────────────
// The game was silent. This adds short, soft, SYNTHESIZED sounds (no asset files —
// fits the no-build stack) on three events: shot HIT, ball LAND (timbre per surface),
// and ball-in-CUP. Fully self-contained: it runs its OWN rAF observer reading the
// game globals (strokes / ball / state / getMaterialAt) and plays sounds on the edges.
// Delete this file + its <script> tag in devbuild.html and NOTHING else changes.
//
// Discipline: no engine-core edits; gesture-gated (browser autoplay policy); silent
// during bot shot-simulation (RG._simulating); uses Math.random for micro-variation
// only — NEVER the terrain PRNG random(), so determinism is untouched. Calm/minimal by
// design (matches the deadpan tone): a small contact in a large quiet dark.
//
// Three FULL palettes for the designer to pick from — each is a complete voice (HIT,
// LAND character, and CUP all respond), not just a hit reskin:
//   soft   (default) — warm, muffled-but-near; the tonal middle. A small "tok".
//   crisp            — clean, defined attack; the "awake/clear" option (not louder).
//   hollow           — sine-led, airless, lonely; the vast-dark / vacuum pole.
// Surface still teaches itself: land() timbre = material (water plop, rock knock, ice
// shimmer, bunker dead-dull, regolith airless thud, grass/sand muffled), filtered
// through the active palette's voice — so Earth vs Moon is audible without text.
//   RG_AUDIO.setPalette(0|1|2) · RG_AUDIO.cyclePalette() · RG_AUDIO._test() (hear it)
//   ?dev: Shift+P cycles palettes with a toast.  RG_AUDIO._fired = headless trigger counts.
(function () {
  const PALETTES = ['soft', 'crisp', 'hollow'];
  let ctx = null, master = null, enabled = true, paletteIdx = 0;
  const fired = { hit: 0, land: 0, cup: 0 };   // increment on DETECTION (for headless verify)

  // Per-palette VOICE: a small set of multipliers/offsets that every event funnels
  // through, so a palette is a coherent whole rather than three unrelated recipes.
  //   loud   — master scale for the palette (hollow sits quietest, on purpose)
  //   landCut/landBody — surface cutoff scale + how much low body the muffled family gets
  //   tail   — decay scale on land/cup tails (hollow's land is dry; its cup rings long)
  const VOICE = {
    soft:   { loud: 1.00, landCut: 1.00, landBody: 1.00, tail: 1.00 },
    crisp:  { loud: 1.00, landCut: 1.18, landBody: 0.55, tail: 0.78 },   // tighter, drier, more defined
    hollow: { loud: 0.72, landCut: 0.62, landBody: 0.85, tail: 1.20 },   // darker, airless near-field; long quiet rings
  };
  const voice = () => VOICE[PALETTES[paletteIdx]];

  function ensureCtx() {
    if (ctx) return ctx;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.45;
      master.connect(ctx.destination);
    } catch (e) { ctx = null; }
    return ctx;
  }
  function resume() { ensureCtx(); if (ctx && ctx.state === 'suspended') ctx.resume(); }
  ['pointerdown', 'mousedown', 'keydown', 'touchstart'].forEach((ev) => window.addEventListener(ev, resume, { passive: true }));

  const live = () => enabled && ctx && ctx.state === 'running';
  function env(g, t0, peak, atk, dec) {
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0003, peak), t0 + atk);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + atk + dec);
  }
  function tone(freq, type, peak, atk, dec, t0) {
    if (!live()) return;
    t0 = t0 || ctx.currentTime;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t0);
    o.connect(g); g.connect(master); env(g, t0, peak * voice().loud, atk, dec);
    o.start(t0); o.stop(t0 + atk + dec + 0.03);
  }
  function noise(dur, cutoff, peak) {
    if (!live()) return;
    const t0 = ctx.currentTime, n = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, n, ctx.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;          // cosmetic noise; not the terrain PRNG
    const src = ctx.createBufferSource(); src.buffer = buf;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = cutoff;
    const g = ctx.createGain(); src.connect(f); f.connect(g); g.connect(master);
    env(g, t0, peak * voice().loud, 0.002, dur);
    src.start(t0); src.stop(t0 + dur + 0.03);
  }
  // A pitch-dropping blip — the percussive "tok" of a clean contact (start high, fall fast).
  function blip(f0, f1, type, peak, atk, dec, t0) {
    if (!live()) return;
    t0 = t0 || ctx.currentTime;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t0);
    o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t0 + atk + dec);
    o.connect(g); g.connect(master); env(g, t0, peak * voice().loud, atk, dec);
    o.start(t0); o.stop(t0 + atk + dec + 0.03);
  }

  // ── event sounds ──
  function hit(power) {
    fired.hit++;
    if (ctx && ctx.state === 'suspended') ctx.resume();   // make sure the very first shot wakes the context
    const p = Math.min(1, (power || 0) / 22), pal = PALETTES[paletteIdx];
    // The signature contact: a fast downward pitch blip (+ optional click). Louder than the
    // ambient land/cup so a shot always registers. Brightness scales with power so a hard
    // strike reads sharper — a free, fair readability cue (reads as harder, changes no physics).
    if (pal === 'crisp') {
      // clean, defined attack — bright fundamental, but the click is DEFINED not loud/hissy
      blip(560 + 260 * p, 185, 'triangle', 0.32, 0.001, 0.07);
      noise(0.008, 3800 + 600 * p, 0.15);
    } else if (pal === 'hollow') {
      // airless "pok" — sine-led contact you feel more than hear; only a whisper of click
      blip(360 + 150 * p, 150, 'sine', 0.30, 0.001, 0.085);
      noise(0.009, 1500 + 500 * p, 0.05);
    } else {
      // soft (default): muffled-but-near "thock". Tops out lower so a big drive isn't a tick;
      // noise cutoff rises with power (3000->4200) so harder = subtly crisper, not louder.
      blip(380 + 180 * p, 165, 'triangle', 0.30, 0.001, 0.095);
      noise(0.012, 3000 + 1200 * p, 0.12);
    }
  }
  // Per-surface land: timbre = material, then funneled through the palette voice.
  // This is the one place audio can teach the world without text (Earth grass/bunker vs
  // Moon regolith vs water hazard), so the material families are deliberately distinct.
  function land(mat, impact) {
    fired.land++;
    const vc = voice();
    const v = Math.min(1, impact / 14);
    // base muffled cutoff per material family (color = behavior), scaled by the palette voice
    let baseCut, dur, bodyFreq = 0, bodyPeak = 0, bodyType = 'triangle', bodyDec = 0.05;
    if (mat === 'water') {            // plop — round, low, wet
      baseCut = 520; dur = 0.09; bodyFreq = 300; bodyPeak = 0.10; bodyType = 'sine'; bodyDec = 0.18;
    } else if (mat === 'rock') {      // knock — sharp, bright transient + low thock
      baseCut = 2600; dur = 0.05; bodyFreq = 120; bodyPeak = 0.075; bodyType = 'triangle'; bodyDec = 0.05;
    } else if (mat === 'ice') {       // bright + a tiny high shimmer ping so "hard/slick" is audible
      baseCut = 4200; dur = 0.05; bodyFreq = 2200; bodyPeak = 0.04; bodyType = 'sine'; bodyDec = 0.07;
    } else if (mat === 'bunker') {    // DEAD & dull — telegraphs the roll-eating penalty before settle
      baseCut = 820; dur = 0.07; bodyFreq = 95; bodyPeak = 0.05; bodyType = 'triangle'; bodyDec = 0.035;
    } else if (mat === 'regolith') {  // airless thud — very dark, near-zero tail (vacuum has no air to ring)
      baseCut = 700; dur = 0.05; bodyFreq = 90; bodyPeak = 0.055; bodyType = 'sine'; bodyDec = 0.02;
    } else {                          // grass / sand / mud / default — muffled "tup" with a faint low body
      baseCut = mat === 'grass' ? 1050 : 1200; dur = 0.08; bodyFreq = 100; bodyPeak = 0.045; bodyType = 'triangle'; bodyDec = 0.05;
    }
    noise(dur * (mat === 'regolith' ? 1 : vc.tail), baseCut * vc.landCut, 0.05 + 0.16 * v);
    if (bodyPeak > 0) {
      // the felt low body: scaled by impact, palette body level, and (for the muffled family) tail
      const isBright = (mat === 'ice' || mat === 'water');
      tone(bodyFreq, bodyType, bodyPeak * (0.5 + v) * vc.landBody, 0.002, bodyDec * (isBright ? 1 : vc.tail));
    }
  }
  function cup() {
    fired.cup++;
    if (!live()) return;
    const t0 = ctx.currentTime, pal = PALETTES[paletteIdx], vc = voice();
    // The one reward in a whole hole — the emotional beat. Lead it: cup sits ABOVE the hit
    // in lead note, with a resolving downward gesture (calm, not a victory jingle).
    if (pal === 'crisp') {
      // cleaner, tighter resolution — clear "in" without a long ring
      tone(700, 'sine', 0.22, 0.002, 0.11, t0);
      tone(470, 'sine', 0.19, 0.002, 0.16, t0 + 0.07);
    } else if (pal === 'hollow') {
      // the loneliest "you made it in" — a SINGLE low sine that fades long in the dark
      tone(440, 'sine', 0.24, 0.003, 0.42 * vc.tail, t0);
      tone(294, 'sine', 0.10, 0.004, 0.5 * vc.tail, t0 + 0.02);   // faint sub partial for warmth, no flourish
    } else {
      // soft (default): warm falling third, lead-emotion (louder + longer than the hit)
      tone(680, 'sine', 0.23, 0.002, 0.13, t0);
      tone(454, 'sine', 0.21, 0.002, 0.26, t0 + 0.085);   // gentle two-note plunk, resolves down
    }
  }

  // ── per-frame detection ──
  // Called once per rendered frame from wrap.drawWorld (NOT its own rAF) so the shot/land/cup
  // sounds fire on the SAME frame as the fx puff + juice pop (which also detect from the draw
  // pass) — that's the timing-sync fix. Guarded so it never sounds during bot shot-simulation.
  let lastStrokes = -1, wasAir = false, lastState = -1, lastSpeed = 0, lastVy = 0, lastLandT = -1;
  function detect() {
    try {
      if (!window.RG || RG.active === undefined || RG._simulating) return;
      if (typeof ball === 'undefined' || typeof state === 'undefined') return;
      const sp = Math.hypot(ball.vx || 0, ball.vy || 0);
      if (typeof strokes !== 'undefined') {
        if (lastStrokes < 0) lastStrokes = strokes;
        else if (strokes > lastStrokes) { hit(sp); lastStrokes = strokes; }
        else if (strokes < lastStrokes) lastStrokes = strokes;   // per-hole reset, no sound
      }
      const air = (state === STATE_FLIGHT) && !ball.onGround;
      const vy = ball.vy || 0;
      const now = ctx ? ctx.currentTime : 0;
      // Fire an impact on EITHER event, with a short cooldown so one contact never double-knocks:
      //  (1) settle — airborne last frame, on the ground now (the calm "tup" as it comes to rest).
      //  (2) bounce — downward motion flips to upward; only a real collision does that (the apex is
      //      the opposite flip). This catches impacts whose ground contact is too brief to read
      //      onGround on a sampled frame — exactly why bouncy surfaces (rock/ice) went silent.
      const settled = wasAir && ball.onGround && lastSpeed > 1.2;
      const bounced  = (state === STATE_FLIGHT) && lastVy > 1.6 && vy < -0.5;
      if ((settled || bounced) && (lastLandT < 0 || now - lastLandT > 0.045)) {
        const m = (typeof getMaterialAt === 'function') ? getMaterialAt(ball.x) : 'grass';
        land(m, bounced ? lastVy : lastSpeed);
        lastLandT = now;
      }
      wasAir = air; lastSpeed = sp; lastVy = vy;
      if (state === STATE_PAUSE && lastState !== STATE_PAUSE) cup();
      lastState = state;
    } catch (e) { /* never let audio break the frame */ }
  }

  window.RG_AUDIO = {
    palettes: PALETTES,
    get palette() { return PALETTES[paletteIdx]; },
    setPalette(i) { paletteIdx = ((i % PALETTES.length) + PALETTES.length) % PALETTES.length; return PALETTES[paletteIdx]; },
    cyclePalette() { return this.setPalette(paletteIdx + 1); },
    enable(b) { enabled = b !== false; },
    tick: detect,   // wrap.drawWorld calls this once per frame (frame-synced with fx/juice)
    _fired: fired,
    _ctxState() { return ctx ? ctx.state : 'none'; },
    // hear hit -> a few materials -> cup, so the per-surface land + palette voice are A/B-able
    _test() {
      resume();
      setTimeout(() => hit(15), 40);
      setTimeout(() => land('grass', 8), 240);
      setTimeout(() => land('bunker', 8), 460);
      setTimeout(() => land('regolith', 8), 680);
      setTimeout(() => land('ice', 8), 900);
      setTimeout(() => cup(), 1180);
      return 'test: hit / grass / bunker / regolith / ice / cup';
    },
  };

  if (/[?&]dev\b/.test(location.search)) {
    window.addEventListener('keydown', function (e) {
      if ((e.key === 'P' || e.key === 'p') && e.shiftKey) {
        const name = RG_AUDIO.cyclePalette();
        let el = document.getElementById('rg-audio-toast');
        if (!el) { el = document.createElement('div'); el.id = 'rg-audio-toast'; el.style.cssText = 'position:fixed;left:12px;bottom:10px;z-index:9989;font:11px monospace;color:#cdd6f5;background:rgba(14,11,18,0.7);border:1px solid rgba(205,214,245,0.2);border-radius:7px;padding:5px 9px;'; document.body.appendChild(el); }
        el.textContent = '♪ palette: ' + name; el.style.display = 'block';
      }
    });
  }
})();
