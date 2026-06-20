// ── fx.js — landing particle juice (peel-off-able) ─────────────────────────
// A tiny flat-style debris gesture when the ball lands, colored AND SHAPED by the
// surface it hits. The point isn't intensity — it's that each surface TEACHES ITSELF:
//   • puff   — soft round upward flecks    → loose/dry: grass, sand, mud
//   • crumbs — flat square chunks, heavy   → solid: rock, regolith, bunker
//   • splash — low wide sideways scatter   → wet/slick: water, ice  (+ a flat impact dash)
//   • chips  — sharp shards along velocity → brittle: rock, ice  (directional)
//   • auto   — router (default): picks the gesture from the material, so a new world's
//              surface looks different the first time you land on it. No text. (DESIGN LAW.)
// Impact-scaled: a soft tap barely stirs; a hard landing kicks up a little more. Calm by
// design — modest counts, short life, peak alpha ~0.7 so even a hard landing stays a
// murmur against the friendly dark. Contrast-safe: a fleck is always a half-step off its
// OWN surface (darken light ground, lighten dark ground) so it reads even on same-hue turf.
//
// Draws from a per-frame hook in wrap.js drawWorld (world space, under the HUD), so it
// composites correctly with the camera/zoom. Detects the landing edge itself. Peel-off:
// delete this file + its <script> + the one RG_FX.draw line in wrap.js -> nothing changes.
// Math.random only (cosmetic jitter) — never the terrain PRNG. Silent in bot sim (draw
// doesn't run there). Frame-synced with audio.js (land timbre) + juice.js (impact ring).
(function () {
  // 'auto' first => it's the default (styleIdx 0). The four below are the selectable gestures.
  const STYLES = ['auto', 'puff', 'crumbs', 'splash', 'chips'];
  let styleIdx = 0, enabled = true;
  const parts = [];          // {x,y,vx,vy,life,max,size,col,shape}  shape: 'round'|'square'|'shard'
  const dashes = [];         // {x,y,w,life,max,col}  flat impact dash (splash only)
  const CAP = 90;
  const fired = { land: 0, spawned: 0 };   // headless verification
  let wasAir = false, lastSpeed = 0, lastVX = 0;

  // ── color: pull straight from the material so FX can never go off-palette ──────────
  function matColor(mat) {
    const M = (typeof MATERIALS !== 'undefined') && MATERIALS[mat];
    return (M && M.colorLight) || (M && M.color) || '#c9a36a';
  }
  // luminance of a #rrggbb (0..1), used to decide which way to shade for contrast.
  function lum(hex) {
    const h = (hex || '').replace('#', '');
    if (h.length < 6) return 0.5;
    const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
    return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  }
  // nudge a color a half-step AWAY from its surface so a fleck always reads: a light
  // ground gets darker flecks, a dark ground gets brighter ones. amt ~0.28 = half a step.
  function contrastCol(hex, amt) {
    const h = (hex || '').replace('#', '');
    if (h.length < 6) return hex;
    let r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
    const dir = lum(hex) > 0.5 ? -1 : 1;       // dark ground -> brighten, light ground -> darken
    const k = (amt || 0.28) * 255 * dir;
    const cl = (v) => Math.max(0, Math.min(255, Math.round(v + k)));
    const hx = (v) => cl(v).toString(16).padStart(2, '0');
    return '#' + hx(r) + hx(g) + hx(b);
  }

  // ── material -> gesture router (the 'auto' brain; also the self-teaching surface map) ─
  function gestureFor(mat) {
    switch (mat) {
      case 'rock':     return 'chips';    // brittle hard knock -> sharp shards
      case 'regolith': return 'crumbs';   // airless dead dust -> heavy chunks settle
      case 'bunker':   return 'crumbs';   // packed sand wall -> chunks (was a fountain; wrong)
      case 'ice':      return 'splash';   // slick -> low wide sideways scatter
      case 'water':    return 'splash';   // wet -> sideways, never up like dirt
      case 'mud':      return 'splash';   // soft+wet -> low scatter (no dry puff)
      case 'sand':     return 'puff';
      case 'grass':    return 'puff';
      default:         return 'puff';     // unknown material -> the calm soft default
    }
  }

  function spawn(x, y, impact, mat) {
    fired.land++;
    if (!enabled) return;
    const v = Math.min(1, impact / 14);
    let style = STYLES[styleIdx];
    if (style === 'auto') style = gestureFor(mat);
    const base = matColor(mat);
    const col = contrastCol(base, 0.28);      // always a half-step off the surface -> readable
    const dirX = (lastVX >= 0 ? 1 : -1);      // travel direction, for the directional gestures

    if (style === 'splash') {
      // low WIDE sideways scatter biased toward travel; near-zero upward kick (wet/slick).
      // plus one brief flat horizontal dash at the impact point: the surface plane struck.
      dashes.push({ x: x, y: y, w: 8 + 16 * v, life: 0, max: 5, col: contrastCol(base, 0.20) });
      const n = Math.round(4 + 9 * v);
      for (let i = 0; i < n && parts.length < CAP; i++) {
        const sideBias = (Math.random() < 0.5 ? -1 : 1);
        const ang = sideBias * (0.15 + Math.random() * 0.7);   // shallow, near the ground plane
        const spd = 1.7 * (0.5 + v) * (0.55 + Math.random());
        parts.push({
          x: x + (Math.random() - 0.5) * 4, y: y - 1,
          vx: Math.cos(ang) * spd * sideBias * (sideBias === dirX ? 1.25 : 0.8),  // forward-biased
          vy: -Math.abs(Math.sin(ang)) * spd * 0.45 - 0.1,     // barely up
          life: 0, max: 16 + Math.random() * 8,
          size: 1.2 + Math.random() * 1.0, col, shape: 'round',
        });
        fired.spawned++;
      }
      return;
    }

    if (style === 'chips') {
      // sharp shards flung ALONG the incoming velocity — brittle crack, directional.
      const n = Math.round(3 + 7 * v);
      for (let i = 0; i < n && parts.length < CAP; i++) {
        const ang = -Math.PI / 2 + dirX * (0.2 + Math.random() * 0.9);  // up-and-forward fan
        const spd = 2.6 * (0.5 + v) * (0.55 + Math.random());
        parts.push({
          x: x + (Math.random() - 0.5) * 4, y: y - 1,
          vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd,
          life: 0, max: 14 + Math.random() * 6,                // sharp, short life
          size: 1.8 + Math.random() * 1.6, col, shape: 'shard',
          rot: Math.random() * Math.PI,
        });
        fired.spawned++;
      }
      return;
    }

    if (style === 'crumbs') {
      // flat square chunks: fewer, heavier, longer-dwelling — clods of a solid surface.
      const n = Math.round(3 + 8 * v);
      for (let i = 0; i < n && parts.length < CAP; i++) {
        const ang = -Math.PI / 2 + (Math.random() - 0.5) * 1.4;
        const spd = 1.2 * (0.5 + v) * (0.5 + Math.random());
        parts.push({
          x: x + (Math.random() - 0.5) * 5, y: y - 1,
          vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd - 0.15,
          life: 0, max: 34 + Math.random() * 12,
          size: 2.2 + Math.random() * 2.0, col, shape: 'square', grav: 0.30,
        });
        fired.spawned++;
      }
      return;
    }

    // 'puff' (default soft): round upward flecks for loose/dry ground. Calm: tight fan,
    // narrow x-jitter, capped size — reads as one gentle event, not a scatter.
    const n = Math.round(4 + 12 * v);
    for (let i = 0; i < n && parts.length < CAP; i++) {
      const ang = -Math.PI / 2 + (Math.random() - 0.5) * 1.6;
      const spd = 2.0 * (0.5 + v) * (0.5 + Math.random());
      parts.push({
        x: x + (Math.random() - 0.5) * 4, y: y - 1,
        vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd - 0.2,
        life: 0, max: 22 + Math.random() * 12,
        size: 1.4 + Math.random() * 1.0, col, shape: 'round',   // cap ~2.4 -> stays a puff
      });
      fired.spawned++;
    }
  }

  function draw(ctx) {
    // ── detect landing edge (own state; draw runs once per rendered frame) ──
    try {
      if (window.RG && RG.active !== undefined && !RG._simulating && typeof ball !== 'undefined' && typeof state !== 'undefined') {
        const sp = Math.hypot(ball.vx || 0, ball.vy || 0);
        const air = (state === STATE_FLIGHT) && !ball.onGround;
        if (wasAir && ball.onGround && lastSpeed > 1.2) {
          const mat = (typeof getMaterialAt === 'function') ? getMaterialAt(ball.x) : 'grass';
          const gy = (typeof terrainYAt === 'function') ? terrainYAt(ball.x) : (ball.y + ((typeof BALL_RADIUS !== 'undefined') ? BALL_RADIUS : 5));
          spawn(ball.x, gy, lastSpeed, mat);
        }
        wasAir = air; lastSpeed = sp; lastVX = ball.vx || lastVX;
      }
    } catch (e) { /* never break the frame */ }

    if (!parts.length && !dashes.length) return;
    ctx.save();

    // flat impact dashes (splash) — a 1px-tall flat line, no glow, gone in ~5 frames.
    for (let i = dashes.length - 1; i >= 0; i--) {
      const d = dashes[i];
      d.life++;
      if (d.life >= d.max) { dashes.splice(i, 1); continue; }
      const a = 1 - d.life / d.max;
      ctx.globalAlpha = a * 0.6;
      ctx.fillStyle = d.col;
      const w = d.w * (0.4 + 0.6 * (d.life / d.max));   // briefly widens as it strikes
      ctx.fillRect(d.x - w / 2, d.y - 1, w, 1.4);
    }

    // particles — shape-keyed render (round arc / flat square / sharp shard).
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      p.life++;
      if (p.life >= p.max) { parts.splice(i, 1); continue; }
      p.vy += (p.grav || 0.22);          // gravity (screen-y down); crumbs fall heavier
      p.vx *= 0.96; p.x += p.vx; p.y += p.vy;
      const a = 1 - p.life / p.max;
      ctx.globalAlpha = a * 0.7;         // peak alpha 0.7 -> a murmur, not a pop
      ctx.fillStyle = p.col;
      const s = p.size * (p.life > p.max * 0.7 ? a / 0.3 : 1);   // clean shrink-to-nothing in last 30%
      if (p.shape === 'square') {
        ctx.fillRect(p.x - s / 2, p.y - s / 2, s, s);            // flat chunk: crisp vector, no arc
      } else if (p.shape === 'shard') {
        ctx.save();
        ctx.translate(p.x, p.y); ctx.rotate((p.rot || 0) + p.life * 0.12);
        ctx.beginPath(); ctx.moveTo(0, -s); ctx.lineTo(s * 0.7, s * 0.6); ctx.lineTo(-s * 0.7, s * 0.6); ctx.closePath(); ctx.fill();
        ctx.restore();
      } else {
        ctx.beginPath(); ctx.arc(p.x, p.y, s, 0, Math.PI * 2); ctx.fill();   // soft round
      }
    }
    ctx.restore();
  }

  window.RG_FX = {
    styles: STYLES,
    get style() { return STYLES[styleIdx]; },
    setStyle(i) {
      if (typeof i === 'string') { const j = STYLES.indexOf(i); if (j >= 0) styleIdx = j; }
      else styleIdx = ((i % STYLES.length) + STYLES.length) % STYLES.length;
      return STYLES[styleIdx];
    },
    cycleStyle() { return this.setStyle(styleIdx + 1); },
    gestureFor: gestureFor,        // expose the router for tests/inspection
    enable(b) { enabled = b !== false; },
    draw: draw,
    _fired: fired,
    _count() { return parts.length; },
    _burst(mat, impact) {   // test/screenshot helper: puff at the ball now
      const x = (typeof ball !== 'undefined') ? ball.x : 0;
      const y = (typeof terrainYAt === 'function' && typeof ball !== 'undefined') ? terrainYAt(ball.x) : 0;
      spawn(x, y, impact || 10, mat || ((typeof getMaterialAt === 'function' && typeof ball !== 'undefined') ? getMaterialAt(ball.x) : 'sand'));
      return parts.length;
    },
  };

  if (/[?&]dev\b/.test(location.search)) {
    window.addEventListener('keydown', function (e) {
      if ((e.key === 'F' || e.key === 'f') && e.shiftKey) {
        const name = RG_FX.cycleStyle();
        let el = document.getElementById('rg-fx-toast');
        if (!el) { el = document.createElement('div'); el.id = 'rg-fx-toast'; el.style.cssText = 'position:fixed;left:12px;bottom:34px;z-index:9989;font:11px monospace;color:#cdd6f5;background:rgba(14,11,18,0.7);border:1px solid rgba(205,214,245,0.2);border-radius:7px;padding:5px 9px;'; document.body.appendChild(el); }
        el.textContent = '✦ landing fx: ' + name; el.style.display = 'block';
      }
    });
  }
})();
