// ── atlas-setpieces.js — one SIGNATURE-MOMENT planet (a trailer setpiece) ──────────────────────────
// Built on the proven atlas hooks (force/camera/frame/isOOB) + the inert RG._clampYBand / RG._holeDistCap
// / RG._zoom hooks. One "watch this" moment, standalone and gated behind ?galaxy/?atlas:
//   set-relay    "Relay"     — a continent-long hole: send it, it lands, send it again — momentum relay.
// Determinism: all gameplay forces are pure functions of ball/hole state in force() (bot-simulatable);
// camera/trail/zoom/sound are render-only. Peel the file + its <script> tag off → Relay is gone.
// (Cleanup pass: Descent normalized → parked /planet-ideas; Gambit parked /planet-ideas (pinball idea);
//  Slingshot/Drop/Comet CUT — gravity-well lives on in Sirens, the long-drive in the parked Long Drive.)
(function () {
  if (typeof window === 'undefined' || !window.RG_ATLAS) return;
  var A = window.RG_ATLAS;
  var _clk = 0;

  function hole() { return (typeof holes !== 'undefined') ? holes[(typeof currentHole !== 'undefined') ? currentHole : 0] : null; }
  function spd() { return (typeof ball !== 'undefined') ? Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy) : 0; }
  function camx() { return (typeof camera !== 'undefined') ? camera.x : 0; }
  function camy() { return (typeof camera !== 'undefined') ? (camera.y || 0) : 0; }
  function air() { return typeof ball !== 'undefined' && !ball.atRest && !ball.onGround; }

  // ── own audio (isolated; gesture-gated; silent in the bot sim) ──
  var _ac = null;
  function ac() { if (!_ac) { try { _ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { _ac = null; } } if (_ac && _ac.state === 'suspended') { try { _ac.resume(); } catch (e) {} } return (_ac && _ac.state === 'running') ? _ac : null; }
  function blip(type, f0, f1, peak, dur) { var c = ac(); if (!c) return; var t = c.currentTime, o = c.createOscillator(), g = c.createGain(); o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); o.connect(g); g.connect(c.destination); o.start(t); o.stop(t + dur + 0.03); }
  function crack() { blip('square', 2000, 360, 0.2, 0.10); blip('sawtooth', 880, 110, 0.24, 0.5); blip('sine', 84, 36, 0.3, 0.5); }
  function thud() { blip('sine', 150, 46, 0.26, 0.22); }

  // reusable trail buffer + draw (a bright tapering streak; colour set per planet)
  function pushTrail(p) { if (air()) { p._trail = p._trail || []; p._trail.push({ x: ball.x, y: ball.y, s: spd() }); if (p._trail.length > 28) p._trail.shift(); } else if (!ball || ball.atRest) { p._trail = []; } }
  function drawTrail(ctx, p, hot, cool, ref) {
    var tr = p._trail; if (!tr) return;
    for (var i = 1; i < tr.length; i++) { var a = i / tr.length; ctx.globalAlpha = a * 0.5 * Math.min(1, tr[i].s / 10); ctx.strokeStyle = tr[i].s > ref ? hot : cool; ctx.lineWidth = a * (1.2 + Math.min(6, tr[i].s * 0.16)); ctx.beginPath(); ctx.moveTo(tr[i - 1].x, tr[i - 1].y); ctx.lineTo(tr[i].x, tr[i].y); ctx.stroke(); }
    ctx.globalAlpha = 1;
  }
  // reusable chase camera: leads the ball, zooms out with speed. axis 'x' (drives) or 'y' (vertical).
  function chase(p, zoomOut, leadAmt) {
    if (typeof camera === 'undefined' || typeof ball === 'undefined') return false;
    var h = hole(); if (!h) return false;
    var dir = (h.cupX >= h.teeX) ? 1 : -1, s = spd(), sf = Math.max(0, Math.min(1, s / 30));
    var tz = 1 - zoomOut * (sf * sf), z = (RG._zoom || 1);
    RG._zoom = z + (tz - z) * 0.08; RG._zoomPivot = { x: W / 2, y: H * 0.6 };
    camera.x += ((ball.x - W / 2 + dir * (W * 0.05 + sf * W * leadAmt)) - camera.x) * 0.13;
    camera.y += ((ball.y - H * 0.5) - camera.y) * 0.11;
    return true;
  }
  // launch-edge detector (render-only) → flash + sound
  function launchFX(p, sound) { var moving = ball && !ball.atRest; if (p._wasRest && moving) { p._flash = 18; p._fx = ball.x; p._fy = ball.y; p._trail = []; if (sound) sound(); } if (p._wasAir && ball.onGround && spd() > 2) { p._dust = 12; p._dx = ball.x; p._dy = ball.y; thud(); } p._wasRest = ball ? ball.atRest : true; p._wasAir = air(); }
  function drawFlash(ctx, p) {
    if (p._flash > 0) { var f = p._flash / 18; ctx.strokeStyle = 'rgba(255,236,170,' + (f * 0.8).toFixed(3) + ')'; ctx.lineWidth = 2 + f * 2; ctx.beginPath(); ctx.arc(p._fx, p._fy, (1 - f) * 80 + 8, 0, Math.PI * 2); ctx.stroke(); ctx.fillStyle = 'rgba(255,250,225,' + (f * 0.9).toFixed(3) + ')'; ctx.beginPath(); ctx.arc(p._fx, p._fy, f * 9 + 2, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1; p._flash--; }
    if (p._dust > 0) { var d = p._dust / 12; ctx.fillStyle = '#d8e6c8'; for (var q = 0; q < 10; q++) { var aa = q * 0.62, rr = (1 - d) * (8 + (q % 4) * 6); ctx.globalAlpha = d * 0.5; ctx.beginPath(); ctx.arc(p._dx + Math.cos(aa) * rr * 1.6, p._dy - Math.abs(Math.sin(aa)) * rr * 0.7, 1.5 + (1 - d) * 3, 0, Math.PI * 2); ctx.fill(); } ctx.globalAlpha = 1; p._dust--; }
  }

  // ═══ 1 · RELAY — a continent-long hole: send it, it lands, send it again — momentum relay ═══
  A.register({
    id: 'set-relay', name: 'Relay', blurb: 'a hole longer than the world — send it, run it down, send it again; relay the momentum to the pin',
    mats: [['steppe', 'grass', { restitution: 0.45, rollingFriction: 0.965, surfaceFriction: 0.013, color: '#6a7a42', colorLight: '#8aa05c' }]],
    course: { worldName: 'Relay · the long country', sky: '#1c2438', defaultMaterial: 'steppe', materials: ['steppe', 'steppe', 'bunker'],
      archetypes: ['flat_run', 'downhill', 'rolling_hills'],
      difficultyRange: [0.1, 0.35], holeDistMin: 9000, holeDistMax: 12000, holeCount: 2, phys: { gravityScale: 0.85, windScale: 0 } },
    hooks: {
      beforeStart: function () { if (window.RG) { RG._holeDistCap = 12500; RG._zoom = 1; } },
      onStart: function (p) { p._trail = []; p._flash = 0; p._dust = 0; p._wasRest = true; p._wasAir = false; p._launched = false; },
      force: function (p) { if (typeof ball === 'undefined' || ball.atRest) return; var h = hole(); if (!h) return; var fromTee = Math.abs(ball.x - h.teeX), s = spd(); if (!ball.onGround && fromTee < 160 && s > 3 && !p._launched) { var m = Math.min(8, 120 / Math.max(1, s)); ball.vx *= m; ball.vy *= m; p._launched = true; } if (fromTee > 280) p._launched = false; if (!ball.onGround) { ball.vx *= 0.9945; ball.vy *= 0.9945; } },
      camera: function (p) { return chase(p, 0.55, 0.3); },
      isOOB: function () { var h = hole(); if (!h) return null; if (ball.x > Math.max(h.teeX, h.cupX) + 1400) return true; if ((ball.onGround || ball.atRest) && ball.x < h.teeX - 280) return true; return false; },
      frame: function (ctx, p) { pushTrail(p); launchFX(p, crack); drawTrail(ctx, p, '#fff0c0', '#cfe0a0', 16); drawFlash(ctx, p); },
    },
  });
})();
