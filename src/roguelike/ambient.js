// ── ambient.js — minimalist ambient sky visuals (peel-off-able) ─────────────
// Additive, calm, flat-aesthetic background treatments that sit BEHIND the play (screen
// space, upper sky band — same convention as run.js _drawConstellations / _drawMoonSky).
// Purely cosmetic: never reads or writes physics, never touches the terrain PRNG random()
// (any seeded scatter comes from RG._faultHash, like the constellations), so the gate's
// determinism check is untouched. Silent in bot sim (the draw hook doesn't run there).
//
// Four DISTINCT treatments to choose between (variants-for-judgment), each independently
// toggleable behind a flag — see docs/exp/feel-visuals/README.md. They deliberately span the
// whole frame, not just the high sky: a far body, midground depth, the horizon, and the air.
//   'body'   — one faint distant body (a flat-shaded disc, ringed on some seeds) hung high in
//              the sky, deterministic per course — the trailer's dimmed ringed planet.
//   'strata' — one or two flat, darker-than-sky distant ridgelines between the sky and the
//              playfield, drifting at slow positive parallax as you pan. The trailer's layered
//              flat landforms: gives the GROUND depth (where the other three live in the sky),
//              and shapes each world (jagged airless rims vs. soft air-world hills).
//   'glow'   — a few stepped, flat-color bands hugging the terrain skyline (no gradient — the
//              house style is flat fill): warm at an air horizon, cold/tighter on vacuum. Reads
//              as a far horizon without ever softening the crisp terrain silhouette.
//   'drift'  — low atmosphere: soft, larger, dimmer motes hugging the LOWER sky band that drift
//              even at rest (living air, distinct from the high pinpoint constellations). Air
//              worlds only — vacuum has none (no air to carry dust). Behavior = fact.
//
// Draws from ONE line in wrap.js drawSky (screen space, BEHIND the world — after the base sky
// fill, before drawWorld), so bands/body/strata sit behind the flag + airborne ball, never over
// them. Peel-off: delete this file + its <script> tag + that one RG_AMBIENT.draw line -> the sky
// is exactly as it was. No default-on visual change for players: ships OFF; a build opts a variant
// in via the flag/toggle. ?dev cycles with Shift+V.
(function () {
  const VARIANTS = ['body', 'strata', 'glow', 'drift'];

  // Ships OFF (none enabled) so a public build looks identical until a variant is chosen.
  // A persisted choice (localStorage 'rg-ambient') wins so a build can pin a variant; the
  // ?dev cycler also writes here so the pick survives a refresh during playtesting.
  const on = { body: false, strata: false, glow: false, drift: false };
  let _read = false;

  function readPersisted() {
    if (_read) return;
    _read = true;
    try {
      const v = localStorage.getItem('rg-ambient');     // '', a variant, or e.g. 'body+strata+glow'
      if (v) { for (const k in on) on[k] = false; v.split('+').forEach(function (k) { if (k in on) on[k] = true; }); }
    } catch (e) { /* no storage -> stays off */ }
  }
  function persist() {
    try {
      const list = VARIANTS.filter(function (k) { return on[k]; });
      localStorage.setItem('rg-ambient', list.join('+'));
    } catch (e) { /* ignore */ }
  }

  // ── shared, render-only helpers ───────────────────────────────────────────
  function rg() { return window.RG; }
  function hash(n) {                              // deterministic, never the terrain PRNG
    const R = rg();
    if (R && R._faultHash) return R._faultHash(n >>> 0);
    // standalone fallback (module peeled onto a bare page): a small inline FNV-ish mix
    let h = (0x811c9dc5 ^ (n >>> 0)) >>> 0;
    h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
    h = Math.imul(h ^ (h >>> 13), 0x297a2d39);
    h ^= h >>> 16; return h >>> 0;
  }
  // A stable per-course salt so the distant body / dust seed shift between worlds without
  // ever touching terrain generation. Course id chars folded into the run seed.
  function courseSalt() {
    const R = rg();
    let s = (R && (R.seed | 0)) || 0;
    const c = (R && R.course) || 'earth-course';
    for (let i = 0; i < c.length; i++) s = (Math.imul(s ^ c.charCodeAt(i), 0x85EBCA77)) >>> 0;
    return s >>> 0;
  }
  function skyColor() {
    const R = rg();
    if (R && R._worldDefaults && R._worldDefaults.sky) return R._worldDefaults.sky;
    return '#232c40';
  }
  // The Moon (and any windScale 0 world) is airless: no atmospheric dust, no horizon haze.
  function isVacuum() {
    const R = rg();
    return !!(R && R._coursePhys && R._coursePhys.windScale === 0);
  }
  function camX() { return (typeof camera !== 'undefined' && camera.x) || 0; }

  let _t = 0;   // shared frame counter (drift shimmer; harmless elsewhere)

  // ── 'body' — a faint distant body per world ───────────────────────────────
  // One flat-shaded disc hung high in the sky — the trailer's dimmed ringed planet. Two flat
  // tones split by a clean terminator (lit face / shadow face): NO sky-color limb pass, which
  // was reading as a muddy vertical seam — this is pure flat vector, the f_mid look. Position/
  // size/hue/ring are deterministic per course salt, so a world always shows the same body, kept
  // clear of the top-left HUD readout and biased small+high so it reads FAR. Tiny parallax (it's
  // distant). Skipped on the Moon (_drawMoonSky hangs the real Earth) and deconflicted from the
  // onboard 'sky' tease on Earth (it also hangs an east body — two unrelated discs would fight).
  function drawBody(ctx) {
    const R = rg();
    if (R && R.course === 'moon') return;          // the Moon's Earth owns that sky
    // Deconflict: if the onboard launch-tease body is live on Earth, defer to it (calm depends
    // on ONE focal body). onboard.sky only draws on earth-course, so guard there.
    if (R && R.course === 'earth-course' && window.RG_ONBOARD && RG_ONBOARD.isOn && RG_ONBOARD.isOn('sky')) return;
    const salt = courseSalt();
    const h = hash(salt ^ 0x51ed270b);
    // keep it clear of the top-left readout, and bias high+right so it reads as distant scenery:
    // x in 0.52..0.90, y in 0.09..0.24 of the screen.
    const fx = 0.52 + ((h % 1000) / 1000) * 0.38;
    const fy = 0.09 + (((h >>> 10) % 1000) / 1000) * 0.15;
    const r = 13 + ((h >>> 20) % 13);              // 13..25 px — smaller than before, so farther
    const par = camX() * 0.012;                    // very slight parallax (distant)
    const bx = fx * W - par, by = fy * H;
    // a calm, flat palette of dimmed bodies (steel / dusty rose / pale gold / muted teal); the
    // 2nd tone is a DARKER shadow face (not a highlight), for a clean two-tone terminator.
    const PAL = [
      ['#7a7592', '#4f4b63'], ['#8a6b78', '#5c4651'],
      ['#84795f', '#564e3c'], ['#5f7a80', '#3e5256'],
    ];
    const pal = PAL[(h >>> 5) % PAL.length];
    const hasRing = ((h >>> 7) & 3) === 0;         // ~1 in 4 worlds gets a ring
    const terAng = -0.5;                            // terminator tilt (matches the lit ellipses elsewhere)
    ctx.save();
    if (hasRing) {                                 // a thin flat ring, drawn behind the disc (far arc)
      ctx.strokeStyle = pal[0]; ctx.lineWidth = 2.2; ctx.globalAlpha = 0.42;
      ctx.beginPath(); ctx.ellipse(bx, by, r * 2.0, r * 0.52, -0.42, 0, Math.PI * 2); ctx.stroke();
    }
    // lit face (base disc)
    ctx.globalAlpha = 0.52; ctx.fillStyle = pal[0];
    ctx.beginPath(); ctx.arc(bx, by, r, 0, Math.PI * 2); ctx.fill();
    // shadow face: a single ellipse offset along the terminator, clipped to the disc — two flat
    // tones meeting on one clean line (no gradient, no sky-color seam).
    ctx.save();
    ctx.beginPath(); ctx.arc(bx, by, r, 0, Math.PI * 2); ctx.clip();
    ctx.globalAlpha = 0.52; ctx.fillStyle = pal[1];
    ctx.beginPath(); ctx.ellipse(bx + r * 0.42, by - r * 0.10, r * 1.02, r * 1.06, terAng, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    if (hasRing) {                                  // ring's near arc, over the disc
      ctx.strokeStyle = pal[0]; ctx.lineWidth = 2.2; ctx.globalAlpha = 0.5;
      ctx.beginPath(); ctx.ellipse(bx, by, r * 2.0, r * 0.52, -0.42, 0.16, Math.PI - 0.16); ctx.stroke();
    }
    ctx.restore();
  }

  // ── 'strata' — flat distant-terrain ridge parallax ────────────────────────
  // One or two flat, darker-than-sky ridgelines sitting between the sky and the playfield,
  // scrolling at slow POSITIVE parallax (slower than the play terrain) as the camera pans — the
  // trailer / Desert-Golfing vocabulary of layered flat landforms. Gives the GROUND depth that
  // the sky treatments can't, and shapes each world: airless worlds get sharper, jaggier rims;
  // air worlds get soft rolling hills. Deterministic ridge profile from courseSalt (never the
  // terrain PRNG). Strictly BEHIND and ABOVE the play band, low contrast vs. the sky, so it never
  // competes with the terrain silhouette you actually putt on.
  // A smooth-ish 1-D value noise from hashed control points, sampled in a wrapped strip so the
  // ridge tiles seamlessly as it scrolls. Pure render math; no PRNG.
  function ridgeY(u, seed, jag) {
    // u: 0..1 phase along the wrapped strip. K control points, hashed heights, smootherstep lerp.
    const K = 12;
    const fu = ((u % 1) + 1) % 1;
    const x = fu * K;
    const i0 = Math.floor(x) % K, i1 = (i0 + 1) % K;
    let t = x - Math.floor(x);
    const a = ((hash((seed ^ (i0 * 0x9e3779b9)) >>> 0) % 1000) / 1000);
    const b = ((hash((seed ^ (i1 * 0x9e3779b9)) >>> 0) % 1000) / 1000);
    // jag: airless = sharper (linear-ish), air = smoother (smootherstep)
    const ts = jag ? t : (t * t * t * (t * (t * 6 - 15) + 10));
    return a + (b - a) * ts;
  }
  // Screen-y of the real play terrain at a given screen-x (engine subtracts camera.y). The strata
  // band fills DOWN only to this silhouette per-column, so a ridge emerges from BEHIND the terrain
  // everywhere — occluded by a foreground hill, meeting the edge cleanly in a valley — and never
  // paints over the green you putt on. (Ambient now draws behind the world from wrap.js drawSky;
  // this terrain-clip stays so the ridge still reads as a far landform tucked behind the green.)
  function terrainScreenY(screenX) {
    try {
      if (typeof terrainYAt === 'function') {
        const cy = (typeof camera !== 'undefined' && camera.y) || 0;
        return terrainYAt(camX() + screenX) - cy;
      }
    } catch (e) { /* fall through */ }
    return H * 0.66;
  }
  function drawStrata(ctx) {
    const vac = isVacuum();
    const cx = camX();
    const span = W;
    // A reference horizon (highest crest seen across the width) to hang the ridge baselines on, so
    // the ridge tops always sit a small, fixed distance above the play and read as a far rise.
    let refY = H;
    for (let sx = 0; sx <= W; sx += 96) refY = Math.min(refY, terrainScreenY(sx));
    refY = Math.max(H * 0.30, Math.min(H * 0.82, refY));
    // Low ridgelines hugging the horizon (NOT a tall black wall): crests sit just above the play,
    // bodies are SHORT (capped), and the tint is only a little darker than the sky so they read as
    // distance, never competing with the crisp terrain silhouette. Far layer is lighter+higher;
    // near layer a touch darker. Vacuum = one crisp rim; air = a soft near+far pair.
    const layers = vac ? [{ par: 0.16, amp: H * 0.040, off: H * 0.010, body: H * 0.050, tint: 0.17, salt: 0x1b2 }]
      : [{ par: 0.10, amp: H * 0.030, off: H * 0.050, body: H * 0.055, tint: 0.085, salt: 0x2c5 },
         { par: 0.20, amp: H * 0.045, off: H * 0.010, body: H * 0.050, tint: 0.14, salt: 0x71d }];
    const sky = skyColor();
    const step = 8;                                    // px sampling; cheap, still smooth at this scale
    ctx.save();
    for (let L = 0; L < layers.length; L++) {
      const ly = layers[L];
      const seed = (courseSalt() ^ ly.salt) >>> 0;
      const crest = refY - ly.off;                     // where this layer's ridge sits (above the play)
      // gently darker-than-sky flat tint: mix the sky toward the void by `tint` (subtle = distance).
      ctx.fillStyle = darken(sky, ly.tint);
      ctx.globalAlpha = 1;
      const phase = (cx * ly.par) / span;              // positive parallax: moves WITH the pan, slower
      // Build the ridge top, then RETURN along a SHORT body that hugs the real terrain silhouette
      // where it's near (so no floating edge) but never extends more than `body` below the crest —
      // a thin distant landform, not a slab. Below the body, the sky shows until the green.
      ctx.beginPath();
      const tops = [];
      for (let sx = -step; sx <= W + step; sx += step) {
        const u = sx / span + phase;
        tops.push([sx, crest - ridgeY(u, seed, vac) * ly.amp]);
      }
      ctx.moveTo(tops[0][0], tops[0][1]);
      for (let i = 1; i < tops.length; i++) ctx.lineTo(tops[i][0], tops[i][1]);
      for (let i = tops.length - 1; i >= 0; i--) {
        const sx = tops[i][0], topY = tops[i][1];
        const ter = terrainScreenY(sx);
        // bottom = min(short body cap, real terrain) so it tucks behind the green and never slabs.
        ctx.lineTo(sx, Math.max(topY, Math.min(topY + ly.body, ter)));
      }
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  // ── color helpers (flat, no gradients) ────────────────────────────────────
  function parseHex(hex) {
    const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex || '');
    if (!m) return [58, 72, 96];
    return [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)];
  }
  function clamp8(c) { return Math.max(0, Math.min(255, Math.round(c))); }
  // mix a hex toward a target [r,g,b] by amt, return rgb()
  function mix(hex, target, amt) {
    const c = parseHex(hex);
    return 'rgb(' + clamp8(c[0] + (target[0] - c[0]) * amt) + ',' +
                    clamp8(c[1] + (target[1] - c[1]) * amt) + ',' +
                    clamp8(c[2] + (target[2] - c[2]) * amt) + ')';
  }
  function darken(hex, amt) { return mix(hex, [9, 11, 18], amt); }   // toward the void

  // ── 'glow' — stepped flat horizon bands ───────────────────────────────────
  // A few DISCRETE flat-color bands hugging the terrain skyline — NOT a smooth gradient (the
  // house style is flat fill; a gradient haze reads as photographic fog and softens the crisp
  // terrain silhouette that IS the look). Air worlds glow a low WARM amber (the trailer's amber,
  // the cozy read); vacuum worlds get one cold, tighter band (thin atmosphere). A hard floor of
  // full sky-dark is kept just above the terrain so the silhouette edge stays crisp — the bands
  // sit ABOVE that floor and rise into the sky. Anchored to the terrain under the ball so it
  // tracks the real horizon, smoothed so it glides rather than pops between holes.
  let _hyAvg = null;
  function horizonY() {
    // screen-y of the terrain just under the ball; falls back to lower-third if unknown
    try {
      if (typeof terrainYAt === 'function' && typeof ball !== 'undefined') {
        const wy = terrainYAt(ball.x);
        const cy = (typeof camera !== 'undefined' && camera.y) || 0;
        const raw = wy - cy;                         // world->screen (engine subtracts camera.y)
        _hyAvg = (_hyAvg == null) ? raw : _hyAvg + (raw - _hyAvg) * 0.08;   // smooth so it glides
        return _hyAvg;
      }
    } catch (e) { /* fall through */ }
    return H * 0.7;
  }
  function drawGlow(ctx) {
    const vac = isVacuum();
    const hy = Math.max(H * 0.35, Math.min(H, horizonY()));
    const floor = 12;                                // px of full sky-dark kept above the terrain edge
    const sky = skyColor();
    // warm amber for air; cold steely tint for vacuum (behavior = fact)
    const tint = vac ? mix(sky, [150, 170, 205], 0.5) : mix(sky, [210, 150, 90], 0.55);
    // bands: nearest (lowest) brightest, fading up in discrete steps. 2 bands on vacuum, 3 on air.
    const bands = vac
      ? [{ h: H * 0.05, a: 0.12 }, { h: H * 0.05, a: 0.05 }]
      : [{ h: H * 0.055, a: 0.16 }, { h: H * 0.06, a: 0.09 }, { h: H * 0.07, a: 0.04 }];
    ctx.save();
    ctx.fillStyle = tint;
    let edge = hy - floor;                            // start above the protected silhouette floor
    for (let i = 0; i < bands.length; i++) {
      const b = bands[i];
      const top = edge - b.h;
      ctx.globalAlpha = b.a;
      ctx.fillRect(0, Math.max(0, top), W, Math.min(b.h, edge));
      edge = top;
    }
    ctx.restore();
  }

  // ── 'drift' — low atmosphere (living air) ──────────────────────────────────
  // NOT more stars. A few soft, LARGER, dimmer motes that hug the LOWER sky band (just above the
  // horizon, where haze would settle) — a distinct plane from the high pinpoint constellations.
  // They drift gently even when the camera is parked (the sky is alive on a putting screen), with
  // a touch of negative parallax so panning reads as depth. Air worlds ONLY: vacuum has no air to
  // carry dust, so nothing here (behavior = fact — the absence itself teaches "this world is
  // airless"). Velocity is capped low forever; the whole value is restraint.
  function drawDrift(ctx) {
    _t++;
    if (isVacuum()) return;                          // airless: no atmosphere to render
    const N = 18;
    const salt = courseSalt();
    const cx = camX();
    // lower sky band: from ~45% down to ~72% of the screen (above the play, below the stars)
    const bandTop = H * 0.45, bandH = H * 0.27;
    const span = W + 60;
    ctx.save();
    ctx.fillStyle = '#b9c2d8';                        // cool-dim, NOT the bright #dfe8ff star color
    for (let i = 0; i < N; i++) {
      const h1 = hash(((i + 1) * 2654435761 ^ salt) >>> 0);
      const h2 = hash((h1 ^ 0x9e3779b9) >>> 0);
      const baseX = (h1 % 1000) / 1000;
      const y = bandTop + ((h2 % 1000) / 1000) * bandH;
      const depth = 0.30 + ((h2 >>> 10) % 100) / 100 * 0.70;     // 0.30..1
      // drift continues at rest (independent of camera) — nearest motes visibly alive (~0.12px/f)
      const drift = _t * 0.12 * depth;
      let sx = ((baseX * span - cx * (1 - depth) * 0.05 - drift) % span + span) % span - 30;
      const tw = 0.78 + 0.22 * Math.sin(_t * 0.018 + i * 2.1);   // slow, soft shimmer
      ctx.globalAlpha = (0.05 + ((h1 >>> 20) % 7) / 100) * tw;   // dim: ~0.05..0.12 * shimmer
      const r = 1.6 + depth * 1.8;                                // larger + softer than a star
      ctx.beginPath(); ctx.arc(sx, y, r, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  // ── the single draw hook (called from wrap.js drawSky, BEHIND the world) ───
  // Back-to-front: strata (deepest landforms) -> glow (horizon band) -> body (far sky disc) ->
  // drift (nearest air motes). Drawn before drawWorld, so the whole frame's flag/ball/terrain sit
  // in FRONT; the constellations (run.js _drawOverlays, after the world) sit in front too.
  function draw(ctx) {
    readPersisted();
    const R = rg();
    if (!R || !R.active) return;                     // only during a live run
    if (R.inFault || R.inVault) return;              // underground/secret rooms have no open sky
    if (R._simulating) return;                       // never in the headless bot
    if (R._descPhase && R._descPhase !== 'none') return; // the crane owns the screen
    if (on.strata) drawStrata(ctx);
    if (on.glow) drawGlow(ctx);
    if (on.body) drawBody(ctx);
    if (on.drift) drawDrift(ctx);
  }

  window.RG_AMBIENT = {
    variants: VARIANTS,
    draw: draw,
    _hash: hash,   // shared deterministic mix (RG._faultHash-backed) so onboard.js need not copy it

    isOn(v) { readPersisted(); return v ? !!on[v] : VARIANTS.some(function (k) { return on[k]; }); },
    enable(v, b) {                                   // enable/disable one variant
      readPersisted();
      if (v in on) { on[v] = (b !== false); persist(); }
      return this.isOn(v);
    },
    only(v) {                                        // exclusive-select one variant (or '' = none)
      readPersisted();
      for (const k in on) on[k] = (k === v);
      persist();
      return v;
    },
    none() { readPersisted(); for (const k in on) on[k] = false; persist(); return ''; },
    // headless / screenshot helper: force a variant on for the current build (no persist arg)
    _force(v) { for (const k in on) on[k] = (k === v); _read = true; return v; },
  };

  // ?dev cycler: Shift+V steps none -> body -> strata -> glow -> drift -> none, with a small toast.
  // Exclusive-select keeps the picker legible (one variant at a time) while flags still
  // allow stacking via RG_AMBIENT.enable for anyone who wants to combine them.
  if (typeof location !== 'undefined' && /[?&]dev\b/.test(location.search)) {
    let idx = -1;                                    // -1 = none
    window.addEventListener('keydown', function (e) {
      if ((e.key === 'V' || e.key === 'v') && e.shiftKey) {
        idx = (idx + 2) % (VARIANTS.length + 1) - 1; // -1,0,1,2,-1...
        const name = idx < 0 ? '' : VARIANTS[idx];
        if (name) RG_AMBIENT.only(name); else RG_AMBIENT.none();
        let el = document.getElementById('rg-ambient-toast');
        if (!el) { el = document.createElement('div'); el.id = 'rg-ambient-toast'; el.style.cssText = 'position:fixed;left:12px;bottom:58px;z-index:9989;font:11px monospace;color:#cdd6f5;background:rgba(14,11,18,0.7);border:1px solid rgba(205,214,245,0.2);border-radius:7px;padding:5px 9px;'; document.body.appendChild(el); }
        el.textContent = '✦ ambient: ' + (name || 'off'); el.style.display = 'block';
      }
    });
  }
})();
