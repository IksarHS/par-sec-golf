// ── Standalone Secrets Registry ────────────────────────────
// Each secret is ONE self-contained descriptor. The run controller (run.js) and the MODE
// wrap (wrap.js) call these hooks at the right moments, so adding a secret = adding one
// object to RG_SECRETS — never crammed into the controller. All hooks are optional.
//
// Discipline (same as the rest of the layer): deterministic (seed hashes via RG._faultHash,
// never the terrain PRNG), surface-run only for placement, reversible (peel this file and
// the secrets vanish; the engine is untouched).
//
// Descriptor shape — every field optional except `key`:
//   key, name
//   place(seed)              seeded setup during _legibleHazards (surface run only). Mutate
//                            vertices / stash state on `this`. Decides if/where it appears.
//   reset()                  called at the start of every run (clear per-run state).
//   onRest()                 ball came to rest. Return true to CONSUME (skip default rest).
//   onShot()                 a shot was just launched.
//   onClick(wx, wy, sx, sy)  a primary click (world coords + screen coords). true = consume.
//   onRightClick(wx,wy,sx,sy)a right click. true = consume.
//   update()                 per-frame logic (only while a run is active).
//   draw(ctx)                per-frame overlay, screen space (called from _drawOverlays).
//
// Inside the hooks the usual globals are in scope: RG, ball, holes, vertices, currentHole,
// camera, W, H, terrainYAt, getMaterialAt, MATERIALS, GRAVITY, state, STATE_*.
window.RG_SECRETS = [];

// The canonical roster of secret KNOWLEDGE flags (the rg-knows-* keys), in discovery order.
// Single source of truth for the discoveries ledger (wrap.js) and the Codex pages (manual.js),
// so adding a secret means editing ONE list — not three that silently drift. Membership here is
// what the iceberg counts; order is the Codex page order.
window.RG_SECRET_FLAGS = [
  'fault', 'patient', 'sun', 'leviathan',
];

// Run one hook across every registered secret. Returns true if any secret CONSUMED it.
// Guarded so a throw in one secret can never break the game loop or another secret.
window.RG_runSecretHook = function (hook, a, b, c, d) {
  const list = window.RG_SECRETS || [];
  let consumed = false;
  for (let i = 0; i < list.length; i++) {
    const s = list[i];
    if (!s || typeof s[hook] !== 'function') continue;
    try { if (s[hook](a, b, c, d) === true) consumed = true; }
    catch (e) { if (window.console) console.warn('secret "' + (s.key || '?') + '" hook ' + hook + ' threw:', e); }
  }
  return consumed;
};

// Lookup by key (handy for the audit + cross-secret references).
window.RG_secret = function (key) {
  const list = window.RG_SECRETS || [];
  for (let i = 0; i < list.length; i++) if (list[i] && list[i].key === key) return list[i];
  return null;
};

// ── Shared secret utilities ────────────────────────────────
// Thin helpers so descriptors stay DRY and never reach into localStorage / the PRNG directly.
window.RG_secretUtil = {
  // An independent seeded value — reuses the Fault's hash (NEVER the terrain PRNG, so placement
  // can't shift terrain). Same seed+salt -> same result, so every secret is deterministic per run.
  hash: function (seed, salt) { return RG._faultHash(((seed >>> 0) ^ (salt >>> 0)) >>> 0); },
  // Permanent knowledge unlocks (mirrors rg-knows-fault).
  know: function (flag) { if (window.RG && RG._markKnown) RG._markKnown(flag); else { try { localStorage.setItem('rg-knows-' + flag, '1'); } catch (e) {} } },
  knows: function (flag) { try { return !!localStorage.getItem('rg-knows-' + flag); } catch (e) { return false; } },
  // Run fn at most once per (key, seed) — the once-per-seed faucet idiom. Returns true if it fired.
  // Fail-CLOSED: if localStorage throws (disabled / quota / sandboxed iframe), do NOT mint —
  // otherwise the faucet pays out on every trigger, violating once-per-seed. Mirrors the
  // fail-closed area-entry faucets.
  oncePerSeed: function (key, seed, fn) {
    try {
      const k = 'rg-' + key + '-' + (seed >>> 0);
      if (localStorage.getItem(k)) return false;
      localStorage.setItem(k, '1');
      if (fn) fn();
      return true;
    } catch (e) { return false; }
  },
  // world -> screen (the camera transform), so screen-space draws line up with world objects.
  sx: function (wx) { return wx - ((typeof camera !== 'undefined' && camera.x) || 0); },
  sy: function (wy) { return wy - ((typeof camera !== 'undefined' && camera.y) || 0); },
};

// ── Descriptors ────────────────────────────────────────────
// Gated: the minimal (default) build keeps the host above — the ship rides its
// lifecycle — but none of the secret content below. ?full sets RG_MINIMAL false.
if (!window.RG_MINIMAL) {

// 1) THE PATIENT REST — stillness is a verb.
// The one thing a golfer never does — nothing — is an input. Idle at a seeded hole's tee
// without shooting and a violet rim blooms beneath the ball; hold it and the ground answers.
// No affordance, no prompt: the reveal is the reward (Tunic's wait-and-see).
RG_SECRETS.push({
  key: 'patient',
  name: 'The Patient Rest',
  place(seed) {
    this.tile = null;
    // Once discovered, the gateway RETIRES: the bloom exists to be found once, not to ring
    // the resting ball on every later run (it grants nothing — the Codex keeps the record).
    if (RG_secretUtil.knows('patient')) return;
    const h = RG_secretUtil.hash(seed, 0x9a71e);
    // On a brand-new save (no secret ever found) GUARANTEE this gateway so the iceberg can crack —
    // a player who only ever sinks the ball would otherwise trip nothing. Afterwards, normal ~1-in-4.
    const firstEver = (window.RG && RG._discoveriesFound) ? RG._discoveriesFound() === 0 : false;
    if ((firstEver || (h % 100) < 28) && RG.holeCount > 2 && typeof holes !== 'undefined') {
      const hole = 2 + (h % (RG.holeCount - 2));                                // never the tutorial holes
      const H0 = holes[hole];
      if (H0) this.tile = { hole: hole, x: H0.teeX, r: 70 };                    // you pause at the tee anyway
    }
  },
  reset() { this.tile = null; this._t0 = null; this.bloom = 0; this.done = false; },
  _now() { return (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now(); },
  update() {
    if (!this.tile) return;
    const ARM_MS = 5000;                                                        // WALL-CLOCK, not frames -> identical per seed at any refresh rate
    const still = (typeof currentHole !== 'undefined') && currentHole === this.tile.hole
      && (typeof state !== 'undefined') && state === STATE_AIM
      && Math.abs(ball.x - this.tile.x) < this.tile.r;
    if (still) {
      if (this._t0 == null) this._t0 = this._now();
      const held = this._now() - this._t0;
      this.bloom = Math.min(1, held / ARM_MS);
      if (held >= ARM_MS && !this.done) {
        this.done = true;
        RG_secretUtil.know('patient');
      }
    } else {
      this._t0 = null; this.done = false;
      this.bloom *= 0.85; if (this.bloom < 0.02) this.bloom = 0;                // fade, don't snap
    }
  },
  draw(ctx) {
    if (!this.tile) return;
    // A faint PRE-idle shimmer at the gateway tee, so a player notices "the ball wants to wait here"
    // BEFORE the 5s bloom (which, with no tell, they'd never trigger). Shows while resting near the
    // tile, fades out as the real bloom takes over.
    const onHole = (typeof currentHole !== 'undefined') && currentHole === this.tile.hole;
    if (onHole && (typeof ball !== 'undefined') && (this.bloom || 0) < 0.3) {
      const d = Math.abs(ball.x - this.tile.x);
      if (d < this.tile.r) {
        const near = 1 - d / this.tile.r;
        const tx = RG_secretUtil.sx(this.tile.x), ty = RG_secretUtil.sy((typeof terrainYAt === 'function') ? terrainYAt(this.tile.x) : ball.y);
        const pulse = 0.55 + 0.45 * Math.abs(Math.sin((this._shimT = (this._shimT || 0) + 1) * 0.08));
        ctx.save();
        ctx.globalAlpha = (0.07 + near * 0.16) * pulse; ctx.strokeStyle = '#b24dff'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.ellipse(tx, ty - 2, 16, 5, 0, 0, Math.PI * 2); ctx.stroke();
        ctx.restore();
      }
    }
    if (this.bloom <= 0) return;
    const sx = RG_secretUtil.sx(ball.x), sy = RG_secretUtil.sy(ball.y), a = this.bloom;
    ctx.save();
    ctx.globalAlpha = 0.5 * a; ctx.strokeStyle = '#b24dff'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(sx, sy, 10 + 16 * a, 0, Math.PI * 2); ctx.stroke();
    if (this.done) { ctx.globalAlpha = 0.85; ctx.beginPath(); ctx.arc(sx, sy, 28, 0, Math.PI * 2); ctx.stroke(); }
    ctx.restore();
  },
});

// 2) POKE THE SUN — the background is a switch.
// A faint sun disc hangs in the corner of the sky. Nobody clicks the background — until you do,
// and the lights go out: a dark veil drops with a torch lit around your ball (the engine's own
// _drawDark). Click again for dawn. Reversible, per-hole, and it makes dark-gated things findable.
RG_SECRETS.push({
  key: 'sun',
  name: 'Poke the Sun',
  reset() { this.dark = false; this._lastHole = -1; this._t = 0; },
  _disc() { return { x: W - 60, y: 58, r: 20 }; },                 // screen-space, upper-right
  update() {
    const idx = (typeof currentHole !== 'undefined') ? currentHole : 0;
    if (idx !== this._lastHole) { this._lastHole = idx; this.dark = false; }
    this._t = (this._t || 0) + 1;
  },
  onClick(wx, wy, sx, sy) {
    const s = this._disc();
    const dx = sx - s.x, dy = sy - s.y;
    if (dx * dx + dy * dy < (s.r + 10) * (s.r + 10)) {
      this.dark = !this.dark; RG_secretUtil.know('sun');
      return true;
    }
    return false;
  },
  draw(ctx) {
    const idx = (typeof currentHole !== 'undefined') ? currentHole : 0;
    const condDark = RG.holeConds && RG.holeConds[idx] && RG.holeConds[idx].key === 'dark';
    if (this.dark && !condDark && RG._drawDark) RG._drawDark(ctx);
    const s = this._disc();
    ctx.save();
    if (this.dark) {
      ctx.globalAlpha = 0.5; ctx.fillStyle = '#cdd6f5';
      ctx.beginPath(); ctx.arc(s.x, s.y, s.r * 0.7, 0, Math.PI * 2); ctx.fill();
    } else {
      // A slow "breathing" pulse — alpha drifts between 0.11 and 0.26 on a long sine, just
      // enough to catch peripheral vision over time without looking like a UI affordance.
      const breath = 0.5 + 0.5 * Math.sin((this._t || 0) * 0.007);
      ctx.globalAlpha = 0.11 + breath * 0.15;
      ctx.fillStyle = '#f0c060';
      ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2); ctx.fill();
      // A hairline corona ring that swells slightly when the breath peaks — the visual tell that
      // this is not merely a decoration (something about it responds to time).
      ctx.globalAlpha = breath * 0.12;
      ctx.strokeStyle = '#f0c060'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(s.x, s.y, s.r + 4 + breath * 3, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.restore();
  },
});

// 3) THE LEVIATHAN — the frame breaks.  (Spelunky chain → Frog Fractions reveal)
// Chain THREE hole-in-ones in a row (a demanding carry across the run, Spelunky-style) and the
// world suddenly pulls back — the whole course shrinks to a speck and a colossal eye opens over
// the sky, watching. The reveal is the reward: you were never just playing mini-golf.
RG_SECRETS.push({
  key: 'leviathan',
  name: 'The Leviathan',
  reset() { this._streak = 0; this._lastHole = -1; this._phase = 'none'; this._f = 0; this._eye = 0; this._done = false; if (window.RG) { RG._zoom = 1; RG._zoomPivot = null; } },
  update() {
    if (this._phase === 'none' && !this._done) {
      // Spelunky: count consecutive aces of FINISHED holes as the run advances.
      const idx = (typeof currentHole !== 'undefined') ? currentHole : 0;
      if (this._lastHole < 0) this._lastHole = idx;
      if (idx > this._lastHole) {
        for (let h = this._lastHole; h < idx; h++) {
          const sc = RG.holeScores ? RG.holeScores[h] : undefined;
          if (sc === 1) this._streak++; else if (sc != null) this._streak = 0;
        }
        this._lastHole = idx;
      }
      // The trigger: the THIRD straight ace, the moment it drops. The ball sits in the cup
      // (STATE_PAUSE) and nothing else is moving — the reveal owns a still frame instead of
      // fighting the hole-to-hole camera pan (which is what made it read so muddled before).
      if (this._streak >= 2 && typeof state !== 'undefined' && state === STATE_PAUSE
          && typeof strokes !== 'undefined' && strokes === 1) {
        this._phase = 'out'; this._f = 0; this._done = true;
        if (window.RG) RG._zoomPivot = { x: RG_secretUtil.sx(ball.x), y: RG_secretUtil.sy(ball.y) };  // recede around the sunk putt
        RG_secretUtil.know('leviathan');
      }
    }
    if (this._phase !== 'none') {                                 // Frog Fractions: the world pulls back, the eye opens
      // Hold the cup-pause while the eye is open: the base machine advances pause->transition
      // by transitionTimer, so pinning it to 0 stalls the run until the reveal lets go.
      if (typeof state !== 'undefined' && state === STATE_PAUSE && typeof transitionTimer !== 'undefined') transitionTimer = 0;
      this._f++;
      const OUT = 70, HOLD = 95, CLOSE = 30;
      if (this._phase === 'out') {
        const e = RG._ease(Math.min(1, this._f / OUT));
        if (window.RG) RG._zoom = 1 - 0.55 * e; this._eye = e;
        if (this._f >= OUT) { this._phase = 'hold'; this._f = 0; }
      } else if (this._phase === 'hold') {
        if (window.RG) RG._zoom = 0.45; this._eye = 1;
        if (this._f >= HOLD) { this._phase = 'close'; this._f = 0; }
      } else {                                                    // 'close': the eye shuts, the world returns, the run resumes
        const e = RG._ease(Math.min(1, this._f / CLOSE));
        if (window.RG) RG._zoom = 0.45 + 0.55 * e; this._eye = 1 - e;
        if (this._f >= CLOSE) {
          this._phase = 'none'; this._eye = 0; if (window.RG) { RG._zoom = 1; RG._zoomPivot = null; }
        }
      }
    }
  },
  draw(ctx) {
    if (!this._eye || this._eye <= 0) return;
    const a = this._eye, cx = W / 2, cy = H * 0.42, ew = W * 0.6, eh = H * 0.34;   // a colossal eye over the sky
    ctx.save();
    ctx.strokeStyle = '#b88cff'; ctx.lineWidth = 3; ctx.globalAlpha = a * 0.5;
    ctx.beginPath();
    ctx.moveTo(cx - ew, cy);
    ctx.quadraticCurveTo(cx, cy - eh, cx + ew, cy);
    ctx.quadraticCurveTo(cx, cy + eh, cx - ew, cy);
    ctx.stroke();
    const drift = Math.sin((this._f || 0) * 0.03) * ew * 0.12;
    ctx.globalAlpha = a * 0.55; ctx.fillStyle = '#b24dff';
    ctx.beginPath(); ctx.arc(cx + drift, cy, eh * 0.5, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = a * 0.9; ctx.fillStyle = '#0e0b12';
    ctx.beginPath(); ctx.arc(cx + drift, cy, eh * 0.22, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  },
});

} // end !RG_MINIMAL (secret descriptors)
