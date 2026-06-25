// ── fx.js — landing debris (peel-off-able) ─────────────────────────────────
// A small burst of KICKED-UP GROUND on every ball-terrain contact (land / bounce /
// skid), modelled on the close-up feel of "Golf on Mars": a handful of crisp little
// SQUARES in the TERRAIN'S OWN COLOUR, thrown in the ball's travel direction along
// real ballistic arcs, that then LAND on the terrain and settle + fade. Never soft
// round puffs, never floaty, never symmetric around the ball.
//
// THE DEBRIS MODEL (the whole feel lives in these numbers):
//   • colour  — the contacted material's own .color (regolith you stand on), with a
//               small per-chunk light/dark jitter (±~14%). It IS the ground, not a tint.
//   • shape   — axis-aligned filled rect (a chunk), VARIED size ~1..4.5px, biased small
//               (size = lo + (hi-lo)*r^1.7), so most are flecks + a few are clods.
//   • throw   — fan in the IMPACT direction (sign of horizontal velocity) + an upward
//               kick; speed/count/spread/size ALL scale with impact speed. A gentle roll
//               kicks almost nothing; a hard slam throws more, bigger, farther.
//   • flight  — gravity each frame -> a real arc. When a chunk falls back to the terrain
//               surface (terrainYAt at its own x) it LANDS: vy zeroed, vx killed to a
//               crawl, and it settles flat on the ground, then fades over a short dwell.
//               A chunk never fades mid-air and never sinks through the ground.
//
// Draws from a per-frame hook in wrap.js drawWorld (WORLD space, under the HUD) so it
// composites with the camera/zoom and sits ON the terrain. Detects the contact edge
// itself. Peel-off: delete this file + its <script> + the one RG_FX.draw line in
// wrap.js -> nothing changes. Math.random only (cosmetic jitter) — never the terrain
// PRNG. Silent in bot sim (draw doesn't run there). Frame-synced with audio.js (land
// timbre) + juice.js (impact ring).
(function () {
  let enabled = true;
  // each chunk: {x,y,vx,vy,size,col,landed,life,fade,grav}
  //   landed:false -> ballistic (arc under gravity until it meets the ground)
  //   landed:true  -> resting on the surface, counting down `fade` to vanish
  const parts = [];
  const CAP = 300;
  const fired = { land: 0, spawned: 0 };   // headless verification
  let wasAir = false, lastSpeed = 0, lastVX = 0;

  const GROUND_GRAV = 0.34;     // px/frame^2 — gives a crisp, snappy fall (not floaty)
  const FADE_FRAMES = 14;       // how long a chunk lingers on the ground before it's gone
  const MIN_IMPACT  = 1.4;      // below this a contact barely stirs (gentle roll kicks ~nothing)

  // ── TUNABLE PARAMS (live-editable via RG_FX.params — fxlab.html drives these) ──
  // Defaults reproduce the SHIPPED feel exactly (all multipliers = 1, up = 0.30, bright = 0).
  // Bump these to make the puff bigger/punchier — esp. on upslopes where it gets lost in the hill.
  const params = {
    count:     1,           // × number of chunks per burst
    size:      1,           // × chunk size (the "scale")
    speed:     1,           // × launch speed (the "intensity" / how far it's thrown)
    spread:    1,           // × fan width
    up:        0.30,        // launch angle base (× PI). HIGHER = thrown more UP (clears an upslope)
    grav:      1,           // × fall speed (LOWER = more hang-time, more visible)
    fade:      1,           // × ground dwell before it fades (lifetime)
    minImpact: MIN_IMPACT,  // contact-speed floor (below this, nothing kicks)
    bright:    0,           // +brightness 0..1 so chunks POP against the terrain they came from
    // per-material debris × — hard ground (rock/ice) can kick LESS than loose ground (sand/dust).
    // Multiplies the chunk count for the contacted material. Default 1 = no per-material difference.
    mat: { sand: 1, grass: 1, ice: 1, rock: 1, mud: 1, water: 1, dust: 1, regolith: 1 },
  };

  // ── colour: the material's OWN colour, so debris is literally the ground it came from ──
  function matColor(mat) {
    const M = (typeof MATERIALS !== 'undefined') && MATERIALS[mat];
    return (M && M.color) || (M && M.colorLight) || '#b0463e';
  }
  // per-chunk light/dark jitter around the base colour: a scatter of real regolith is
  // never one flat swatch. amt is the max fractional lighten/darken (e.g. 0.14).
  function jitterCol(hex, amt, bright) {
    const h = (hex || '').replace('#', '');
    if (h.length < 6) return hex;
    const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
    const k = (Math.random() * 2 - 1) * (amt || 0.14) + (bright || 0);   // -amt..+amt, lifted by `bright`
    const cl = (v) => Math.max(0, Math.min(255, Math.round(v + v * k)));
    const hx = (v) => cl(v).toString(16).padStart(2, '0');
    return '#' + hx(r) + hx(g) + hx(b);
  }

  // terrain surface y at a world x (the floor a chunk lands on). Falls back gracefully.
  function groundAt(x) {
    return (typeof terrainYAt === 'function') ? terrainYAt(x) : null;
  }

  // ── spawn one burst of kicked-up ground ──────────────────────────────────────────
  // x,y = impact point on the surface; impact = contact speed; mat = contacted material.
  function spawn(x, y, impact, mat) {
    fired.land++;
    if (!enabled) return;
    if (impact < params.minImpact) return;           // a gentle roll kicks almost nothing

    const v = Math.min(1, (impact - params.minImpact) / 13);   // 0..1 strength above the floor
    const dirX = (lastVX >= 0 ? 1 : -1);             // throw in the TRAVEL direction
    const base = matColor(mat);

    // count + spread + speed + size all scale with impact (quality-over-quantity: a light
    // landing tosses 2-4 small chunks a short way; a hard slam throws more/bigger/farther).
    // Each dimension is then × its live param multiplier (see `params` above).
    const matMul = (params.mat && params.mat[mat] != null) ? params.mat[mat] : 1;
    const n = Math.round((2 + 9 * v) * params.count * matMul);
    for (let i = 0; i < n && parts.length < CAP; i++) {
      // launch angle: mostly forward (travel dir) with an upward kick. Spread widens with v.
      // base ~55° up from horizontal, fanned ±(20°..55°), tightened toward forward.
      const spread = (0.35 + 0.6 * v) * params.spread;
      const ang = (Math.PI * params.up) + (Math.random() - 0.5) * spread;   // 0=horizontal, +=up
      const spd = (1.4 + 4.0 * v) * (0.55 + 0.55 * Math.random()) * params.speed;   // px/frame
      // forward chunks fly farther than the few that spit backward off the dir.
      const forward = Math.random() < 0.82 ? 1 : -1;
      const r = Math.random();
      const size = (1 + (3.5 * v + 1.0) * Math.pow(r, 1.7)) * params.size;  // ~1..4.5 (×size), biased small
      const fadeMax = Math.max(1, Math.round(FADE_FRAMES * params.fade));
      parts.push({
        x: x + (Math.random() - 0.5) * 3,
        y: y - 1 - Math.random() * 2,
        vx: Math.cos(ang) * spd * dirX * forward,
        vy: -Math.sin(ang) * spd,                    // screen-y up = negative
        size: size,
        col: jitterCol(base, 0.14, params.bright),
        grav: GROUND_GRAV * params.grav * (0.85 + 0.4 * (size / (4.5 * params.size))), // bigger chunks fall a touch faster
        landed: false,
        life: 0,
        fade: fadeMax,
        fadeMax: fadeMax,
      });
      fired.spawned++;
    }
  }

  function draw(ctx) {
    // ── detect the contact edge (own state; draw runs once per rendered frame) ──
    try {
      if (window.RG && RG.active !== undefined && !RG._simulating && typeof ball !== 'undefined' && typeof state !== 'undefined') {
        const sp = Math.hypot(ball.vx || 0, ball.vy || 0);
        const air = (state === STATE_FLIGHT) && !ball.onGround;
        if (wasAir && ball.onGround && lastSpeed > MIN_IMPACT) {
          const mat = (typeof getMaterialAt === 'function') ? getMaterialAt(ball.x) : 'grass';
          const gy = (typeof terrainYAt === 'function') ? terrainYAt(ball.x) : (ball.y + ((typeof BALL_RADIUS !== 'undefined') ? BALL_RADIUS : 5));
          spawn(ball.x, gy, lastSpeed, mat);
        }
        wasAir = air; lastSpeed = sp; lastVX = ball.vx || lastVX;
      }
    } catch (e) { /* never break the frame */ }

    if (!parts.length) return;
    ctx.save();

    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];

      if (!p.landed) {
        // ballistic step
        p.vy += p.grav;
        p.vx *= 0.985;
        p.x += p.vx;
        p.y += p.vy;
        // did it fall back to the ground? (only test once it's moving downward, so the
        // upward half of the arc clears the launch point cleanly)
        const gy = groundAt(p.x);
        if (p.vy > 0 && gy != null && p.y >= gy - p.size * 0.5) {
          p.y = gy - p.size * 0.5;     // sit flat on the surface
          p.landed = true;
          p.vx *= 0.18;                // a little skid on touchdown, then it grips
          p.vy = 0;
        } else if (gy == null && p.life > 70) {
          // safety: no terrain reading (shouldn't happen) -> don't float forever
          parts.splice(i, 1); continue;
        }
        p.life++;
      } else {
        // settled on the ground: a tiny residual skid that grinds to a halt, then fade.
        p.x += p.vx;
        p.vx *= 0.7;
        p.fade--;
        if (p.fade <= 0) { parts.splice(i, 1); continue; }
      }

      // alpha: solid while flying + freshly landed, then a clean fade-out as it settles.
      const a = p.landed ? (p.fade / (p.fadeMax || FADE_FRAMES)) : 1;
      ctx.globalAlpha = a;
      ctx.fillStyle = p.col;
      const s = p.size;
      // axis-aligned crisp square — snap to whole px so small chunks stay sharp, not blurry.
      const px = Math.round(p.x - s / 2), py = Math.round(p.y - s / 2);
      ctx.fillRect(px, py, Math.max(1, Math.round(s)), Math.max(1, Math.round(s)));
    }
    ctx.restore();
  }

  window.RG_FX = {
    enable(b) { enabled = b !== false; },
    params: params,         // live-tunable knobs (fxlab.html drives these)
    draw: draw,
    _fired: fired,
    _count() { return parts.length; },
    _landed() { let k = 0; for (const p of parts) if (p.landed) k++; return k; },
    _burst(mat, impact) {   // test/screenshot helper: kick up ground at the ball now
      const x = (typeof ball !== 'undefined') ? ball.x : 0;
      const y = (typeof terrainYAt === 'function' && typeof ball !== 'undefined') ? terrainYAt(ball.x) : 0;
      // honour an explicit travel direction if the test set ball.vx; else throw right.
      if (typeof ball !== 'undefined' && ball.vx) lastVX = ball.vx;
      spawn(x, y, impact || 10, mat || ((typeof getMaterialAt === 'function' && typeof ball !== 'undefined') ? getMaterialAt(ball.x) : 'sand'));
      return parts.length;
    },
  };
})();
