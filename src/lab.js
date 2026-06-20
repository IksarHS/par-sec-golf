// ── lab.js — LIVE complexity lab: a tunable test planet you adjust in real time ───────────────────────
// Open ?course=lab  (optionally ?course=lab&c=0.6&mat=rock&seed=123). Then, live:
//   [ ]   complexity − / +        ; '   material prev / next
//   , .   prev / next hole        \     reroll terrain (new seed)
//   A     bot autoplay (built in)
// Changing complexity at a fixed seed shows EXACTLY what the one knob does to the terrain. Uses the same
// buildConfig() as the 24 fixed planets (window.PLANET_GEN), so the lab IS the real generator.

(function () {
  if (typeof WORLDS === 'undefined' || !WORLDS['run-world'] || !WORLDS['run-world'].courses) return;
  const COURSES = WORLDS['run-world'].courses;
  const GEN = (typeof window !== 'undefined') && window.PLANET_GEN;
  if (!GEN) return;

  const MATS = ['grass', 'sand', 'rock', 'ice', 'mud', 'amber', 'slate', 'jade', 'crimson', 'frost', 'rust', 'teal', 'rose', 'gold', 'bone', 'plum', 'ash', 'ember', 'moss'];
  const SKY_FOR = { grass: '#232c40', sand: '#34302a', rock: '#1a2230', ice: '#2a3a48', mud: '#2d3328', amber: '#2a1d18', slate: '#9fb0a8', jade: '#1d2a24', crimson: '#1a1620', frost: '#223040', rust: '#241a18', teal: '#16222e', rose: '#2b2530', gold: '#26201a', bone: '#1c2733', plum: '#241a22', ash: '#0f1219', ember: '#1a1410', moss: '#1e2a18' };

  const Q = location.search;
  const qNum = (k, d) => { const m = new RegExp('[?&]' + k + '=([0-9.]+)').exec(Q); return m ? parseFloat(m[1]) : d; };
  const qStr = (k, d) => { const m = new RegExp('[?&]' + k + '=([a-z0-9_]+)', 'i').exec(Q); return m ? m[1] : d; };

  let labC = Math.max(0, Math.min(1, qNum('c', 0.45)));
  let labMatIdx = MATS.indexOf((qStr('mat', 'rock') || '').toLowerCase()); if (labMatIdx < 0) labMatIdx = 2;
  const urlSeed = qNum('seed', null);

  function build() {
    const mat = MATS[labMatIdx];
    const cfg = GEN.buildConfig(labC, mat, SKY_FOR[mat] || '#1a2230', 'LAB c=' + labC.toFixed(2));
    cfg._dynamic = true;   // opt out of the roguelike's course-template cache (run.js) so live edits apply
    COURSES['lab'] = cfg;
  }
  build();   // register BEFORE the run.html dev shortcut starts ?course=lab

  // ── HUD overlay (DOM, non-invasive) ──
  let hud;
  function updateHud() {
    if (!hud) { hud = document.createElement('div'); hud.style.cssText = 'position:fixed;top:14px;right:16px;z-index:200;font:12px "Departure Mono",monospace;color:#e8f0ff;background:rgba(10,14,22,.74);padding:9px 12px;border:1px solid rgba(255,255,255,.15);border-radius:5px;line-height:1.5;white-space:pre;text-align:left;pointer-events:none;'; document.body.appendChild(hud); }
    const mat = MATS[labMatIdx];
    const hc = (currentCourse && currentCourse.holeCount) || 9;
    const a = (typeof holes !== 'undefined' && holes[currentHole]) ? (holes[currentHole].archetype || '?') : '?';
    const mass = (typeof holes !== 'undefined' && holes[currentHole] && holes[currentHole]._overhangs) ? '  +overhang' : '';
    hud.textContent =
      'LAB PLANET\n' +
      'complexity  ' + labC.toFixed(2) + '   [ ]\n' +
      'material    ' + mat + "   ; '\n" +
      'seed        ' + curSeed() + '   \\\n' +
      'hole ' + (currentHole + 1) + '/' + hc + '  ' + a + mass + '   , .\n' +
      '            A = bot autoplay';
  }
  function curSeed() { try { return (typeof getSeed === 'function') ? getSeed() : '?'; } catch (e) { return '?'; } }

  function restart(newSeed) {
    build();
    let seed = newSeed;
    if (seed == null) { try { seed = (typeof getSeed === 'function') ? getSeed() : null; } catch (e) {} }
    if (seed == null) seed = (window.RG && RG.rollSeed) ? RG.rollSeed() : 12345;
    if (window.RG && RG.startRun) RG.startRun({ course: 'lab', seed: seed });
    setTimeout(updateHud, 80);
  }

  function gotoHole(delta) {
    if (typeof holes === 'undefined' || typeof currentHole === 'undefined') return;
    const hc = (currentCourse && currentCourse.holeCount) || 9;
    let h = Math.max(0, Math.min(hc - 1, currentHole + delta));
    if (typeof ensureHolesAhead === 'function') ensureHolesAhead(h);
    currentHole = h;
    const hole = holes[h];
    if (hole) {
      ball.x = hole.teeX; ball.y = terrainYAt(hole.teeX) - BALL_RADIUS; ball.vx = 0; ball.vy = 0; ball.atRest = true; ball.onGround = false;
      if (typeof strokes !== 'undefined') strokes = 0;
      if (typeof setHoleCamera === 'function') setHoleCamera(hole);
      state = STATE_AIM;
    }
    updateHud();
  }

  document.addEventListener('keydown', function (e) {
    if (typeof currentCourse === 'undefined' || currentCourse !== COURSES['lab']) return;   // only on the lab planet
    let handled = true;
    switch (e.key) {
      case ']': labC = Math.min(1, +(labC + 0.05).toFixed(2)); restart(); break;
      case '[': labC = Math.max(0, +(labC - 0.05).toFixed(2)); restart(); break;
      case "'": labMatIdx = (labMatIdx + 1) % MATS.length; restart(); break;
      case ';': labMatIdx = (labMatIdx + MATS.length - 1) % MATS.length; restart(); break;
      case '\\': restart((window.RG && RG.rollSeed) ? RG.rollSeed() : null); break;
      case '.': gotoHole(1); break;
      case ',': gotoHole(-1); break;
      default: handled = false;
    }
    if (handled) { e.preventDefault(); e.stopPropagation(); }
  }, true);

  // keep the HUD live while on the lab planet; apply a URL seed once RG is ready
  let started = false;
  setInterval(function () {
    if (typeof currentCourse !== 'undefined' && currentCourse === COURSES['lab']) {
      if (!started && urlSeed != null && window.RG && RG.startRun) { started = true; restart(urlSeed); return; }
      started = true; updateHud();
    }
  }, 400);
})();
