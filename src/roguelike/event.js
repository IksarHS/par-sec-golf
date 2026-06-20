// ── event.js — the rare in-course Event Node (peel-off-able) ────────────────
// Once in a while the walk between two holes lands on a small EVENT instead of an
// ordinary next tee. The ball is already resting on the REAL next tee; the event is a
// small object that the world placed BY the tee — never a card floating over the HUD.
// You roll past it, tap it, or your first shot brushes it; it resolves and the golf
// just continues. The whole feature lives in the world's own sky/ground, wordless.
//
// FOUR DISTINCT, ALL-DIEGETIC VARIANTS, picked by RG_EVENT_VARIANT (or ?event=N):
//   0  OFF (default)            no events ever arm — the build is byte-identical
//   1  Wayside Cache  (ACCESS)  a tiny half-buried crate resting on the ground by the
//                               tee. Tap it for a small shop CREDIT. Glyph-only, no card.
//   2  Roadside Sign  (FACT)    a weathered marker post a prior golfer left. Etched on it
//                               is ONE quiet fact about the run you're walking into — the
//                               long hole's number, or a hairline crack = something's wrong
//                               on hole N (the Fault hint). Buys KNOWLEDGE, grants nothing.
//   3  Sky Vignette   (MOOD)    a purely cosmetic beat in the world's own sky (a far rocket
//                               contrail / a meteor / a drifting balloon). World-aware:
//                               the balloon is Earth-only; the contrail wants an atmosphere.
//   4  Wayside Shrine (PLACE)   a sealed cairn with a keyhole. Tap it to UNSEAL a travel
//                               waypoint for this world — access to a PLACE, never a thing.
//                               (Lightweight: it flags a known waypoint; no new course here.)
//
// DESIGN LAW (CLAUDE.md): money & finds buy ACCESS and FACTS, not putting power. The four
// registers span cosmetic -> access -> knowledge -> place WITHOUT ever touching a shot:
//   cache = a shop CREDIT (buys access sooner), sign = a FACT (you could have read it),
//   vignette = nothing at all, shrine = a PLACE (a waypoint). No boon alters a shot's physics,
//   and the only old power-line flirt (a free Drop) has been REMOVED from the offer pool.
//
// DETERMINISM: whether/where an event arms is a pure function of (seed, holeIdx) via
// RG._faultHash — NEVER random() (that would shift terrain). Which flavour a node is is
// likewise seed-hashed. Cosmetic jitter (the vignette's motes) may use Math.random. The
// event NEVER touches vertices/holes/conds, so docs/audit-baseline.json is untouched. The
// shrine's waypoint is its own localStorage key (rg-waypoint-*), NOT a secret rg-knows-*
// flag, so it never inflates the Codex iceberg or the determinism baseline.
//
// BOT-SAFE: the event leaves `state` at STATE_AIM on the real tee. The autoplay bot just
// fires its first shot of the hole; that first shot auto-resolves any pending event (the
// cache/shrine take their grant, the sign reveals, the vignette plays out). A run always
// completes; nothing waits on a click.
//
// Peel-off: delete this file + its <script> in run.html + the two RG_EVENT lines in
// wrap.js (drawHUD + onTransitionEnd) -> the game is exactly as it was.
(function () {
  // Which variant is live. 0 = off (the safe default so nothing changes unless asked).
  function variant() {
    let v = window.RG_EVENT_VARIANT;
    if (v == null && typeof location !== 'undefined') {
      const m = /[?&]event=(\d)/.exec(location.search);
      if (m) v = parseInt(m[1], 10);
    }
    v = v | 0;
    return (v >= 1 && v <= 4) ? v : 0;
  }

  // ~1 in EVENT_ODDS eligible transitions arms an event (rare — a punctuation, not a tax).
  const EVENT_ODDS = 6;

  // Internal state for the active event (null when none).
  let ev = null;
  let _wired = false;

  // A self-contained seeded hash for this module (NEVER the terrain PRNG). Falls back to a
  // local FNV if RG._faultHash isn't around yet (it always is by the time this runs).
  function hash(n) {
    if (window.RG && RG._faultHash) return RG._faultHash(n >>> 0);
    let h = (0x811c9dc5 ^ (n >>> 0)) >>> 0;
    h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
    h ^= h >>> 16; return h >>> 0;
  }

  // ── World awareness (for the vignette's lawful sky + the shrine's waypoint key) ──
  function course() { return (window.RG && RG.course) || 'earth-course'; }
  function isEarth() { return course() === 'earth-course'; }
  // A world has a sky/atmosphere a contrail could hang in (Earth). The Moon is vacuum — no
  // contrail, no balloon there; only a far meteor/streak reads as lawful in airless dark.
  function hasAtmosphere() { return course() === 'earth-course' || course() === 'run-course'; }

  // ── Grants (access / knowledge / place only — never shot power) ────────────
  function grantCredit(amount) {
    if (window.RG_ECON && RG_ECON.add) RG_ECON.add(amount);   // a small shop credit — buys ACCESS sooner, not a better putt
  }
  // A scouted FACT about THIS run, read at arm-time (the run layout is known here). Pure
  // knowledge — it changes nothing about the ball, only what you KNOW walking in. It is
  // strictly a fact you COULD have learned yourself (the longest hole) or a hint at a
  // knowable secret (the Fault) — never predictive of RNG you couldn't otherwise know.
  function scoutFact() {
    if (!window.RG) return null;
    if (RG._faultTile && RG._faultTile.hole != null) {
      return { kind: 'fault', hole: RG._faultTile.hole };       // a hairline crack: something is wrong on hole N
    }
    let hardest = -1, hp = -1;
    const from = (typeof currentHole !== 'undefined' ? currentHole : 0);
    if (RG.holePars) for (let i = from; i < RG.holeCount; i++) {
      if ((RG.holePars[i] || 0) > hp) { hp = RG.holePars[i]; hardest = i; }
    }
    return hardest >= 0 ? { kind: 'long', hole: hardest } : null;
  }
  // The shrine unseals a travel WAYPOINT for this world — access to a PLACE. Its own
  // localStorage namespace (not rg-knows-*), so it never touches the secret iceberg/baseline.
  function unsealWaypoint() {
    try {
      const k = 'rg-waypoint-' + course();
      if (!localStorage.getItem(k)) localStorage.setItem(k, '1');
    } catch (e) {}
  }

  // ── Arming: decide (seed-stably) whether the just-entered tee is an event node ──
  // Called from wrap.onTransitionEnd AFTER the engine lands on the next tee. holeIdx is the
  // hole now in play. Never the first tee (no transition to it), never the final-hole
  // COMPLETE, never inside a secret area.
  function maybeArm(holeIdx, ignoreOdds) {
    const v = variant();
    ev = null;
    if (!v) return false;
    if (!(window.RG && RG.active) || RG.inVault || RG.inFault) return false;
    if (typeof state !== 'undefined' && state === STATE_COMPLETE) return false;
    if (holeIdx == null || holeIdx <= 0) return false;            // tutorial-1 has no incoming transition
    if (holeIdx >= RG.holeCount) return false;                    // not on the run-complete frame
    const seed = (RG.seed >>> 0);
    const h = hash((seed ^ Math.imul(holeIdx + 1, 0x9E3779B1)) >>> 0);
    if (!ignoreOdds && (h % EVENT_ODDS) !== 0) return false;      // rare

    ev = build(v, holeIdx, h);
    wire();
    return true;
  }

  // Assemble the event object for a variant. Pure function of (v, holeIdx, h) so maybeArm and
  // the dev _force path share ONE construction (no drifting duplicate).
  function build(v, holeIdx, h) {
    const e = { variant: v, holeIdx: holeIdx, t: 0, resolved: false, fade: 0 };
    // Where the object sits in the WORLD: just short of this hole's tee, resting on the ground,
    // so the camera (apron-follow) shows it beside the ball you arrive on. teeX is the tee.
    let tx = null;
    if (typeof holes !== 'undefined' && holes[holeIdx]) tx = holes[holeIdx].teeX;
    if (tx == null && typeof ball !== 'undefined') tx = ball.x;
    e.wx = (tx != null ? tx : 0) - 64;                            // a little BEFORE the tee, on the path in
    if (v === 1) {
      e.kind = 'cache';                                           // a half-buried crate -> a small CREDIT
    } else if (v === 2) {
      e.kind = 'sign';                                            // a weathered marker -> one FACT
      e.fact = scoutFact();                                       // read now (the run layout is known)
    } else if (v === 3) {
      e.kind = 'vignette';                                        // a beat in the sky -> nothing
      e.variantKind = pickVignette(h);
    } else {
      e.kind = 'shrine';                                          // a sealed cairn -> a waypoint (a PLACE)
    }
    return e;
  }

  // World-aware vignette pick: balloon is an Earth-only sight; a contrail wants air; a
  // meteor/streak reads anywhere (even airless dark). Keeps every beat fair-in-hindsight.
  function pickVignette(h) {
    const pool = ['meteor'];                                      // always lawful
    if (hasAtmosphere()) pool.push('contrail');
    if (isEarth()) pool.push('balloon');
    return pool[(h >>> 5) % pool.length];
  }

  // Resolve the event: apply its grant (if any) and dismiss.
  function resolve() {
    if (!ev || ev.resolved) return;
    ev.resolved = true;
    ev.fade = 26;                                  // brief acknowledgement
    if (ev.kind === 'cache') grantCredit(8);
    else if (ev.kind === 'shrine') unsealWaypoint();
    // sign reveals its fact on resolve (the etched glyph stays; a one-line read appears briefly)
    // vignette grants nothing and governs its own life
  }

  // The hold before an unresolved event auto-dismisses. Generous so a human reads it; the
  // bot's first shot pre-empts it.
  const HOLD = 240;

  // ── Per-frame draw + tick (called from wrap._drawHUD) ──────────────────────
  function draw(ctx) {
    if (!ev) return;
    ev.t++;
    // The bot/engine fire shots through STATE_AIM; the first shot of the hole auto-resolves an
    // open event so nothing stalls. (strokes>0 means a shot was taken on this tee.)
    if (!ev.resolved && typeof strokes !== 'undefined' && strokes > 0) resolve();
    if (!ev.resolved && ev.t >= HOLD) resolve();     // AFK fallback

    if (ev.kind === 'vignette') { drawVignette(ctx); }
    else { drawObject(ctx); }

    if (ev.resolved) {
      if (ev.kind === 'vignette') {
        if (ev._vignetteDone) ev = null;             // its own arc governs clearing
      } else {
        ev.fade -= 1;
        // hold the resolved object a touch longer for the sign's fact-read, then clear
        if (ev.fade <= -((ev.kind === 'sign') ? 70 : 0)) ev = null;
      }
    }
  }

  // ── The three GROUND objects (cache / sign / shrine): drawn IN the world, on the terrain,
  // via the camera transform — no panel, no screen-space card. Glyph-only, near-zero text. ──
  function worldToScreen(wx) {
    const cx = (typeof camera !== 'undefined' && camera.x) || 0;
    return wx - cx;
  }
  function groundY(wx) {
    const cy = (typeof camera !== 'undefined' && camera.y) || 0;
    const wy = (typeof terrainYAt === 'function') ? terrainYAt(wx) : (H * 0.7);
    return wy - cy;
  }

  function drawObject(ctx) {
    const sx = worldToScreen(ev.wx);
    if (sx < -60 || sx > W + 60) { /* off-screen: still tick/resolve, just don't draw */ return; }
    const gy = groundY(ev.wx);
    const intro = Math.min(1, ev.t / 14);
    const out = ev.resolved ? Math.max(0, (ev.fade) / 26) : 1;
    // the sign lingers (fact-read) after fade hits 0, on a gentle hold
    const sustain = (ev.kind === 'sign' && ev.resolved) ? 1 : out;
    const a = Math.min(intro, ev.resolved ? Math.max(out, sustain) : 1);
    if (a <= 0) return;
    ctx.save();
    ctx.globalAlpha = a;
    if (ev.kind === 'cache') drawCache(ctx, sx, gy, a);
    else if (ev.kind === 'sign') drawSign(ctx, sx, gy, a);
    else drawShrine(ctx, sx, gy, a);
    ctx.restore();
    // hit area: the object's footprint on the ground (world-derived, re-registered each frame)
    if (!ev.resolved) registerHit(sx - 22, gy - 40, 44, 46, resolve);
  }

  // A small half-buried crate; a coin glyph above it once tapped/taken. Amber = a free, safe gift.
  function drawCache(ctx, x, y, a) {
    const taken = ev.resolved;
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    // crate body, partly sunk into the ground line at y
    ctx.fillStyle = 'rgba(240,200,96,' + (a * (taken ? 0.22 : 0.34)) + ')';
    ctx.strokeStyle = 'rgba(240,200,96,' + (a * 0.9) + ')'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.rect(x - 13, y - 18, 26, 16); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x - 13, y - 10); ctx.lineTo(x + 13, y - 10); ctx.stroke();   // a slat
    ctx.beginPath(); ctx.moveTo(x, y - 18); ctx.lineTo(x, y - 2); ctx.stroke();              // a slat
    // a coin rising out of it (the credit) — clearer once taken
    const lift = taken ? 16 : 9 + Math.sin(ev.t * 0.06) * 1.5;
    ctx.strokeStyle = '#f0c860'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(x, y - 18 - lift, 6, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x, y - 18 - lift - 3); ctx.lineTo(x, y - 18 - lift + 3); ctx.stroke();
  }

  // A weathered marker post a prior golfer left, with ONE etched glyph: a flag+number for the
  // long hole, or a hairline crack for the Fault. The fact reads as a single faint line once
  // the camera reaches it (the etch is the label; the line confirms it, briefly).
  function drawSign(ctx, x, y, a) {
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const col = 'rgba(223,232,255,' + (a * 0.82) + ')';          // weathered cream-white (scorecard paper)
    ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = 2;
    // post
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - 34); ctx.stroke();
    // a small tilted plaque
    ctx.save();
    ctx.translate(x, y - 36); ctx.rotate(-0.06);
    ctx.beginPath(); ctx.rect(-15, -13, 30, 22); ctx.stroke();
    const f = ev.fact;
    if (f && f.kind === 'fault') {
      // a hairline crack glyph (echoes the Fault's broken-ground motif, without its purple)
      ctx.beginPath();
      ctx.moveTo(-7, -7); ctx.lineTo(-2, -1); ctx.lineTo(-5, 3); ctx.lineTo(1, 8);
      ctx.stroke();
    } else if (f && f.kind === 'long') {
      // a tiny flag + the hole number
      ctx.lineWidth = 1.8;
      ctx.beginPath(); ctx.moveTo(-7, 7); ctx.lineTo(-7, -8); ctx.lineTo(2, -5); ctx.lineTo(-7, -2); ctx.stroke();
      ctx.font = "11px 'Departure Mono', monospace"; ctx.textAlign = 'left';
      ctx.fillText(String(f.hole + 1), 3, 4);
    } else {
      // nothing notable ahead — a blank weathered plaque (a fact in itself: the way is plain)
      ctx.beginPath(); ctx.moveTo(-7, 0); ctx.lineTo(7, 0); ctx.stroke();
    }
    ctx.restore();
    // the one-line read, faint, below the post, only after the camera/first-rest settles on it
    if (ev.resolved && f) {
      const line = (f.kind === 'fault') ? ('something is wrong on hole ' + (f.hole + 1))
                 : (f.kind === 'long') ? ('hole ' + (f.hole + 1) + ' is the long one')
                 : '';
      if (line) {
        ctx.globalAlpha = a * 0.7;
        ctx.fillStyle = 'rgba(223,232,255,0.7)';
        ctx.font = "11px 'Departure Mono', monospace"; ctx.textAlign = 'center';
        ctx.fillText(line, x, y + 16);
      }
    }
  }

  // A sealed cairn (stacked stones) with a keyhole; tapping unseals a waypoint. Once unsealed,
  // the keyhole brightens and a small ring pulses out (a wordless "a place opened" beat).
  function drawShrine(ctx, x, y, a) {
    const opened = ev.resolved;
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const teal = opened ? '#7fd6c2' : 'rgba(127,214,194,' + (a * 0.85) + ')';   // teal = a place/door (off the amber/purple lanes)
    ctx.strokeStyle = teal; ctx.lineWidth = 2;
    // a stacked-stone cairn: three rounded blocks
    ctx.beginPath(); ctx.rect(x - 13, y - 12, 26, 10); ctx.stroke();
    ctx.beginPath(); ctx.rect(x - 9, y - 22, 18, 10); ctx.stroke();
    ctx.beginPath(); ctx.rect(x - 5, y - 30, 10, 8); ctx.stroke();
    // a keyhole on the middle stone
    ctx.fillStyle = teal;
    ctx.beginPath(); ctx.arc(x, y - 16, opened ? 2.6 : 2.0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.rect(x - 1, y - 16, 2, 5); ctx.fill();
    if (opened) {
      // a single expanding ring — a place opened
      const k = Math.min(1, (26 - ev.fade) / 26);
      ctx.globalAlpha = a * (1 - k) * 0.7;
      ctx.beginPath(); ctx.arc(x, y - 16, 6 + 22 * k, 0, Math.PI * 2); ctx.stroke();
    }
  }

  // ── The sky vignette (variant 3): pure cosmetics, no mechanics ──
  function drawVignette(ctx) {
    const life = 160;                              // frames the beat plays
    const k = ev.variantKind;
    const t = ev.t / life;                         // 0 -> 1
    if (ev.t >= life) { ev._vignetteDone = true; ev.resolved = true; }
    const a = Math.sin(Math.min(1, t) * Math.PI);  // fade in + out
    if (a <= 0) return;
    ctx.save();
    ctx.globalAlpha = a;
    if (k === 'contrail') {
      // a far rocket climbing the right sky, a thin contrail behind it. The head gives a brief
      // bright POP near apex so a player registers "that moved" rather than dismissing a star.
      const x = W * 0.82, y0 = H * 0.60, y1 = H * 0.08;
      const yy = y0 + (y1 - y0) * Math.min(1, t * 1.2);
      ctx.strokeStyle = 'rgba(223,232,255,' + (a * 0.5) + ')'; ctx.lineWidth = 2; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(x, y0); ctx.lineTo(x, yy); ctx.stroke();
      const apex = Math.max(0, 1 - Math.abs(t - 0.62) / 0.18);   // brightest pop around mid-climb
      ctx.fillStyle = 'rgba(255,236,200,' + a + ')';
      ctx.beginPath(); ctx.arc(x, yy, 3.0 + apex * 1.6, 0, Math.PI * 2); ctx.fill();
      if (apex > 0) { ctx.globalAlpha = a * apex * 0.5; ctx.beginPath(); ctx.arc(x, yy, 7, 0, Math.PI * 2); ctx.fill(); }
    } else if (k === 'meteor') {
      // a streak crossing the upper sky once
      const x0 = W * 0.15, y0 = H * 0.10, x1 = W * 0.70, y1 = H * 0.30;
      const p = Math.min(1, t * 1.4);
      const hx = x0 + (x1 - x0) * p, hy = y0 + (y1 - y0) * p;
      const tx = x0 + (x1 - x0) * Math.max(0, p - 0.18), ty = y0 + (y1 - y0) * Math.max(0, p - 0.18);
      ctx.strokeStyle = 'rgba(255,247,224,' + (a * 0.8) + ')'; ctx.lineWidth = 2.2; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(hx, hy); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,' + a + ')';
      ctx.beginPath(); ctx.arc(hx, hy, 2.4, 0, Math.PI * 2); ctx.fill();
    } else {
      // a small balloon drifting up the left sky (a wistful Earth-only sight). Desaturated toward
      // a dusty rust/tan so it reads as "a thing in the world," not a UI accent.
      const x = W * 0.20 + Math.sin(ev.t * 0.03) * 8;
      const y = H * 0.62 - (H * 0.52) * Math.min(1, t);
      ctx.fillStyle = 'rgba(196,124,96,' + (a * 0.82) + ')';     // dusty rust (trailer rust family)
      ctx.beginPath(); ctx.ellipse(x, y, 8, 10, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(223,232,255,' + (a * 0.4) + ')'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x, y + 10); ctx.lineTo(x, y + 19); ctx.stroke();
    }
    ctx.restore();
  }

  // ── Click routing (capture-phase, like the secret pointer) ─────────────────
  // Only consumes a press that lands on an event object while one is showing — so it resolves
  // the event instead of starting an aim drag. Everything else falls straight through to play.
  let _hits = [];
  function registerHit(x, y, w, h, fn) { _hits.push({ x: x, y: y, w: w, h: h, fn: fn }); }
  function wire() {
    if (_wired || typeof canvas === 'undefined') return;
    _wired = true;
    canvas.addEventListener('mousedown', function (e) {
      if (e.button !== 0 || !ev || ev.resolved) return;
      if (typeof state !== 'undefined' && state !== STATE_AIM) return;
      const rect = canvas.getBoundingClientRect();
      const mx = (e.clientX - rect.left) * (W / rect.width);
      const my = (e.clientY - rect.top) * (H / rect.height);
      for (let i = 0; i < _hits.length; i++) {
        const ht = _hits[i];
        if (mx >= ht.x && mx <= ht.x + ht.w && my >= ht.y && my <= ht.y + ht.h) {
          ht.fn();
          e.stopImmediatePropagation(); e.preventDefault();
          return;
        }
      }
    }, true);
  }

  window.RG_EVENT = {
    variant: variant,
    maybeArm: maybeArm,
    draw: function (ctx) { _hits = []; draw(ctx); },
    active: function () { return !!ev; },
    _state: function () { return ev; },          // dev/test introspection
    // dev/test: force an event of the active variant on the current tee (bypasses the odds gate
    // by reusing maybeArm with ignoreOdds — ONE construction path, no drift).
    _force: function (v) {
      const vv = (v != null) ? (v | 0) : (variant() || 1);
      const saveV = window.RG_EVENT_VARIANT; window.RG_EVENT_VARIANT = vv;
      const idx = (typeof currentHole !== 'undefined' && currentHole > 0) ? currentHole : 1;
      maybeArm(idx, true);
      window.RG_EVENT_VARIANT = saveV;
      return ev ? (ev.kind + (ev.fact ? ' [' + ev.fact.kind + ' h' + (ev.fact.hole + 1) + ']'
                 : ev.variantKind ? ' [' + ev.variantKind + ']' : '')) : 'none';
    },
    _resolve: function () { resolve(); },
  };
})();
