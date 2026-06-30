// ── atlas-onlyup.js — ONLY-UP ascent: golf UP a spire across multiple screens ────────────────────
// The designer's marquee. Each cup sits ~0.6 screens ABOVE its tee, so the course climbs; the camera
// follows the ball + the (high) cup, panning UP as you ascend and between holes. Fall well below where
// you started the hole and you TUMBLE OUT (out-of-bounds, a reshoot — exactly like going off the left/
// right edge). Enabled by a single inert clampY hook (shared.js) that widens the vertical terrain band
// ONLY for this planet (RG._clampYBand) — the base Earth->Moon loop is byte-for-byte unchanged. The
// atlas resets the band on every planet switch. Peel this file + its <script> tag off → the planet is
// gone (and the clampY hook stays inert).
(function () {
  if (typeof window === 'undefined' || !window.RG_ATLAS) return;
  var A = window.RG_ATLAS;

  A.register({
    id: 'ascent-spire', name: 'Spire', blurb: 'golf UP the spire — sink to climb higher; fall and you tumble out',
    mats: [['stone', 'rock', { restitution: 0.40, rollingFriction: 0.95, surfaceFriction: 0.007, color: '#574f5e', colorLight: '#6f6678' }]],
    course: { worldName: 'Spire · the long climb', sky: '#090711', defaultMaterial: 'stone', materials: ['stone', 'stone', 'ice'],
      // only archetypes that place the cup AT the (high) target — dramatic ones ignore cupTargetY and
      // would descend, breaking the climb.
      archetypes: ['uphill', 'gentle_slope', 'rolling_hills', 'flat_run'],
      cupElevation: function (teeY) { return teeY - (H * 0.5) - random() * (H * 0.12); },   // each cup well above its tee
      difficultyRange: [0.3, 0.6], holeDistMin: 300, holeDistMax: 470, holeCount: 5,
      phys: { gravityScale: 0.72, windScale: 0 } },
    hooks: {
      // widen the world band BEFORE generation so holes can stack ~3 screens up; keep the FLOOR at the
      // normal bottom so the first tee still starts low.
      beforeStart: function () { if (window.RG) RG._clampYBand = [-H * 3.2, H * 0.92]; },
      camera: function () {
        if (typeof camera === 'undefined' || typeof ball === 'undefined' || typeof holes === 'undefined') return false;
        var h = holes[(typeof currentHole !== 'undefined') ? currentHole : 0]; if (!h) return false;
        // frame the current climb — ball + the high cup both in view, biased toward the ball as it rises
        var fx = ball.x * 0.5 + h.cupX * 0.5;
        var fy = ball.y * 0.58 + h.cupY * 0.42;
        camera.x += ((fx - W / 2) - camera.x) * 0.12;
        camera.y += ((fy - H / 2) - camera.y) * 0.12;
        return true;   // own the camera (skip the base apron-follow)
      },
      isOOB: function () {
        if (typeof ball === 'undefined' || typeof holes === 'undefined') return null;
        var h = holes[(typeof currentHole !== 'undefined') ? currentHole : 0]; if (!h) return null;
        // tumbled out = the ball has SETTLED (low speed) well below where this hole's climb started. The
        // speed gate avoids a false tumble on a fast pass through a legit low dip; the wider margin avoids
        // punishing a normal low landing. Pure function of current ball state, so the bot sim agrees.
        var slow = (ball.vx * ball.vx + ball.vy * ball.vy) < 1.2;
        if (ball.onGround && slow && ball.y > h.teeY + H * 0.62) return true;
        return null;
      },
    },
  });
})();
