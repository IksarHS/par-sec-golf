// ── Roguelike Run Controller ───────────────────────────────
// Owns a "run": a short, seeded, winnable sequence of holes played on the
// run-world. Sits on top of the untouched engine. The ONLY edit to an existing
// engine file is the inert wind line in gameplay.js; everything else is here.
//
// Boot deferral (zero core edit): main.js init() calls window.initFirebase()
// when it exists and then does NOT auto-boot a default course. We point that stub
// at the start screen and own boot ourselves.
(function () {
  // Minimalist palette override (color = behaviour). Applied from the roguelike
  // layer so the engine's shared.js stays pristine, and BEFORE the pristine
  // snapshot below so modifiers restore to these colours. Distinct hues per
  // material so the player reads a hole at a glance: warm sand (neutral), basalt
  // rock (bouncy), cyan ice (slick), green grass (grippy), brown mud (dead),
  // blue water (absorbs).
  if (typeof MATERIALS !== 'undefined') {
    const PAL = { sand: '#cf8a4a', rock: '#6d6478', ice: '#83cce6', grass: '#62a84e', mud: '#5c4733', water: '#2f6fb0' };
    for (const k in PAL) if (MATERIALS[k]) MATERIALS[k].color = PAL[k];
  }

  // The Fault's tell: an off-palette violet material that behaves lawfully (sand-like),
  // so it reads as "a rule is broken here" without ever being an unfair trap. Added
  // before the PRISTINE snapshot below so modifiers restore it cleanly.
  if (typeof MATERIALS !== 'undefined' && !MATERIALS.anomaly) {
    MATERIALS.anomaly = { restitution: 0.47, rollingFriction: 0.98, surfaceFriction: 0.004, color: '#b24dff', colorLight: '#c98bff' };
  }

  const BUDGET_OVER = 24; // run stroke budget = total par + this cushion. Generous + HIDDEN
  // for now (the simple surface has no visible fail); calibrated stakes reveal later.

  // Pristine snapshots so opt-in modifiers fully restore (the controller resets to
  // these before every run, so modifier apply()/course() only need to MUTATE).
  const PRISTINE = {
    gravity: (typeof GRAVITY !== 'undefined') ? GRAVITY : 0.04,
    materials: (typeof MATERIALS !== 'undefined') ? JSON.parse(JSON.stringify(MATERIALS)) : {},
  };
  let _courseTemplates = {};  // pristine copies of surface courses, by courseId
  let _courseFnsById = {};    // function-valued course fields (JSON clone drops these), by courseId
  let _vaultTemplate = null;  // pristine copy of the vault course
  let _undercroftTmplRef = { t: null }; // pristine copy of the undercroft (the Fault's secret course)

  // ── Camera crane (the Fault DOWN) ────────────────────────
  // Instead of a fade-to-black warp, the camera CRANES along a shaft to a secret course authored
  // +depth world-px from the surface, so the arrival is a pure pan (the engine never assigns
  // camera.y, so the offset is ours to hold). The Fault sinks +CRANE_DEPTH.
  const CRANE_DEPTH = 760;   // world-px the camera travels DOWN to the undercroft (≈1.4 screens)
  // The pan duration used to be a fixed 90-frame count (the engine's TRANSITION_PAN), which made the
  // whole trip play back FASTER on a high-refresh monitor. It is now TIME-based (CRANE_VARIANTS[].dur
  // ms) so it lasts the same wall-clock duration at 60Hz / 120Hz / 144Hz — objective bug 1 fix.

  // ── Crane feel variants (dev-selectable; default 0 = the shipped feel) ──────
  // Each variant fixes the SAME three objective bugs (time-based duration, install
  // deferred off the first motion frame, one unified ball-ride curve); they differ only
  // in curve / duration / arc / depth-layer *feel*. Pick with RG.setCraneVariant(n) (dev) or ?crane=N.
  //
  // The crane plays TWO roles, and the critique panel's core note is that they want different
  // weights: the Fault DOWN is DRILLING THROUGH SOLID EARTH (wants weight, straightness) while
  // planet travel is the tiny ship CROSSING THE FRIENDLY VAST DARK (wants gentleness, a curved
  // line of flight, something to register motion against). So a variant's TRAVEL feel may differ
  // from its DESCENT feel (durTravel / arc / parallax all gate to travel via _craneXFrac>=1).
  //
  //   dur:        descent/secret-crane wall-clock ms (the drill — wants weight).
  //   durTravel:  planet-travel wall-clock ms (optional; defaults to dur). Pace follows payload:
  //               the drill reveals a shaft (let it breathe); the grey void has nothing to reveal.
  //   ease:       the camera/ride easing curve name (see EASE below). Asymmetric eases are legal —
  //               the unified ball-ride uses the same ease, so the ball tracks correctly for free.
  //   xArc:       peak sideways bow (world-px) on travel's diagonal x-drift (0 = dead-straight).
  //               Gated to travel only (the drill stays vertical — you bore through rock).
  //   parallax:   render-only DEPTH starfield on travel (deterministic via _faultHash, never the
  //               terrain PRNG). Far stars drift SLOWER than the camera so the empty pan gains a
  //               sense of vast distance crossed — captivation comes from depth, not a different cubic.
  // NOTE: numbers here are FEEL only — the designer picks the variant; balance is not tuned.
  const CRANE_VARIANTS = [
    { id: 'classic',  dur: 1500, durTravel: 3200, ease: 'inOutQuad', easeTravel: 'inOutSine', xArc: 60, parallax: 0, space: 1 },   // 0: drill default (1500, straight); planet TRAVEL is a long cinematic SPACE crossing (3200ms, _drawCraneSpace)
    { id: 'longglide',dur: 1700, durTravel: 1700, ease: 'inOutSine', xArc: 104, parallax: 0 },// 1: gentle symmetric sine + a legible bowed arc on travel
    { id: 'drift',    dur: 1500, durTravel: 2300, ease: 'inOutSine', xArc: 96,  parallax: 0,  // 2: asymmetric — lingers at departure (a wordless last look),
                      easeTravel: 'driftOut' },                                                //    then coasts to a framed stop. The interplanetary feel.
    { id: 'parallax', dur: 1500, durTravel: 1900, ease: 'inOutSine', xArc: 88,  parallax: 1 },// 3: a far starfield drifts past the curved flight — deep / cinematic
    // 4/5: THE REDESIGN (docs/exp/course-transition-v2). The destination grows by SCALE until it IS
    // the ground — one object, no env fade-OUT, no disc→terrain curtain (the "moon floor pops in" bug).
    { id: 'approach',     dur: 1500, durTravel: 2400, ease: 'inOutQuad', easeTravel: 'inOutSine', xArc: 50, parallax: 0, space: 1, spaceStyle: 'approach' }, // 4: steady
    { id: 'approachfast', dur: 1500, durTravel: 1700, ease: 'inOutQuad', easeTravel: 'inOutSine', xArc: 40, parallax: 0, space: 1, spaceStyle: 'approach' }, // 5: snappy
    // 6/7: SEAMLESS TRAVEL SEQUENCE (the rebuild). Normal sink -> ball lifts straight up off the real
    // ground (ground exits the bottom by camera motion, no fade) -> gated deep-space hold (summary +
    // TRAVEL) -> on tap, the world swaps OFF-SCREEN in the void, then the camera descends/arrives onto
    // the REAL destination terrain (no fake surface, no fade while terrain is on screen). No fake disc.
    { id: 'seamless-descend', dur: 1500, travelSeq: true, arrival: 'descend' }, // 6: launch up, hold, DESCEND onto the moon (surface rises from the bottom)
    { id: 'seamless-over',    dur: 1500, travelSeq: true, arrival: 'over' },    // 7: launch up, hold, keep rising (moon comes down from the top)
  ];
  const EASE = {
    inOutQuad:  function (t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; },
    inOutCubic: function (t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; },
    inOutSine:  function (t) { return -(Math.cos(Math.PI * t) - 1) / 2; },
    inOutQuint: function (t) { return t < 0.5 ? 16 * t * t * t * t * t : 1 - Math.pow(-2 * t + 2, 5) / 2; },  // very soft ends — a gentle touchdown
    // Asymmetric anticipation→settle: a slow, lingering departure (you get a wordless last
    // look at the world you're leaving) that accelerates, then a long ease-OUT so you COAST
    // to a stop framed on the new world (the way f_mid.png feels paused mid-arc). Reaches the
    // halfway point at ~62% of the pan, so the back half is the slow, savoured settle.
    driftOut:   function (t) {
      var inP = t * t * t;                        // slow, deliberate departure (cubic ease-in)
      var outP = 1 - Math.pow(1 - t, 4.2);        // long, coasting ease-out (quartic-ish settle)
      // Cross-blend in→out across the pan: anticipation early, settle late, smooth at the seam.
      var w = t * t * (3 - 2 * t);                // smoothstep weight (C1-continuous, no kink)
      return inP * (1 - w) + outP * w;
    },
  };
  // Touchdown profiles for the seamless travel LANDING. Each is ONE continuous smooth deceleration to a
  // gentle stop — velocity eases to ~0 at the surface, no bounce, no separate settle phase (no stop-start).
  // A cinematic powered set-down (spaceship/helicopter), not a hard arrival. ?seq 1/2/3 A/Bs these.
  const TRAVEL_LAND = [
    { name: 'coast',   dur: 2400, ease: EASE.driftOut },                                                         // 0: slows into the surface, back-loaded coast
    { name: 'feather', dur: 2900, ease: EASE.inOutSine },                                                        // 1: gentle, even, symmetric — a floaty set-down
    { name: 'flare',   dur: 2400, ease: function (t) { var a = t * t * (3 - 2 * t); return 1 - Math.pow(1 - a, 2.4); } }, // 2: cruise then a strong late flare to a near-hover
    // 3/4: the more cinematic set-downs — slower, with engine DOWNWASH that kicks up surface dust as you near
    // the ground (and a brief beat after touchdown while the dust settles). A spaceship / helicopter landing.
    { name: 'hover',   dur: 3100, ease: function (t) { var a = t * t * (3 - 2 * t); return 1 - Math.pow(1 - a, 3.6); }, dust: true }, // 3: descends, then a long near-hover, settles + dust
    { name: 'drift',   dur: 3600, ease: EASE.inOutSine, dust: true },                                            // 4: the slowest — a gentle even VTOL descent + dust
  ];
  // Default variant: ?crane=N (dev) overrides; otherwise the shipped feel (0).
  let _craneVariant = 0;
  if (typeof location !== 'undefined') {
    const m = /[?&]crane=(\d)/.exec(location.search);
    if (m) { const n = parseInt(m[1], 10); if (n >= 0 && n < CRANE_VARIANTS.length) _craneVariant = n; }
  }
  function craneCfg() { return CRANE_VARIANTS[_craneVariant] || CRANE_VARIANTS[0]; }
  // Wall-clock now (ms), with a fixed-step fallback for the headless/hidden bot path.
  function nowMs() { return (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now(); }

  // ── Emergent condition registry ───────────────────────
  // One descriptor per condition — adding a condition is now a one-object change.
  //   roll(ch)?    -> per-hole params (e.g. wind magnitude/sign), from the per-hole hash
  //   apply(cond)? -> mutate physics for the hole (pristine reset happens first)
  //   word / label(cond)? + color -> the one-word fading telegraph
  //   draw(ctx,cond)? -> the persistent overlay / free counter-tool
  //   hostile -> the telegraph contract (a free counter-tool in view) applies
  // Reuse a modifier's lawful physics mutation as a per-hole condition apply(). The
  // modifier descriptors in src/roguelike/modifiers.js already define the exact
  // material/gravity escalations (slick/hotrock/sticky/lowgrav); a condition borrows
  // one verbatim so a single source defines "what this rule does to the ball". The
  // per-hole reset (_applyHoleCondition) snapshots & restores both gravity AND the
  // touched MATERIALS fields, so a one-hole material condition never leaks onward.
  function modApply(key) {
    return function () {
      const list = window.RG_MODIFIERS || [];
      for (let i = 0; i < list.length; i++) if (list[i].key === key && list[i].apply) { list[i].apply(); return; }
    };
  }

  // ── Localized "place" painter (the critique's central craft fix) ───────────
  // Two of the original conditions (slick/hotrock) borrowed a run-long modifier's
  // apply() verbatim, which mutates EVERY material's friction/restitution globally —
  // so a one-hole "ice" condition made the grass LOOK like grass but PLAY like ice.
  // That inverts this art direction's first law (color = behaviour) and forced a
  // compensating sky-glyph bandage. The lawful, LESS-code fix: paint the palette
  // material that already ENCODES the behaviour (cyan ice / basalt rock / brown mud,
  // all already defined + on-palette) onto a readable BAND of the live fairway. The
  // engine reads restitution+friction per-segment from each vertex's own `mat`
  // (desert-golfing.collide + gameplay.getMaterialAt), so painting a band makes the
  // ball behave differently ONLY where the band visibly is — the decision becomes
  // spatial (carry the ice, land short of the lively rock) and the ground is its own
  // free counter-tool. No global mutation, no glyph needed.
  //
  // Determinism: bands are painted at HOLE-ENTRY (_applyHoleCondition), never at
  // startRun, and the original vertex mats are stashed on the cond so leaving the hole
  // restores them. _audit() runs the DEFAULT variant (no bands), so terrainHash is
  // untouched — the gate baseline holds. Geometry-only (anchored to the cup approach),
  // never the terrain PRNG.
  function _paintBand(cond, mat, span) {
    // span: { fromFrac, toFrac } of the hole's tee→cup length to cover. Default: a
    // landable stretch on the cup side (where a carry-vs-run decision actually lives).
    if (typeof vertices === 'undefined' || typeof holes === 'undefined') return;
    const idx = (typeof currentHole !== 'undefined') ? currentHole : 0;
    const h = holes[idx]; if (!h || h.cupX == null) return;
    const lo = Math.min(h.teeX, h.cupX), hi = Math.max(h.teeX, h.cupX), len = hi - lo;
    if (len < 120) return;
    const a = lo + len * (span ? span.fromFrac : 0.5);
    const b = lo + len * (span ? span.toFrac : 0.82);
    const saved = [];
    for (let k = 0; k < vertices.length; k++) {
      const v = vertices[k];
      if (v.x < a || v.x > b) continue;
      if (v.mat === 'water' || v.mat === 'anomaly') continue;   // never overwrite a hazard / the Fault tile
      saved.push({ k: k, mat: v.mat });
      v.mat = mat;
    }
    RG._paintedBand = saved;   // restored by _restorePaintedBand on the next hole change
  }

  // ── Condition descriptors ──────────────────────────────────────────────────
  // The DEFAULT pool below is byte-identical to the shipped table (same keys, weights,
  // order, rolls) so RG._audit / the determinism gate stay green with NO baseline
  // refresh. The critique-refined conditions live in REFINED and are reachable by an
  // opt-in dev variant (RG.setCondVariant / ?cond=) — default stays safe, the designer
  // A/Bs the refinements. condDef() resolves against whichever pool is active.
  const RG_CONDITIONS = [
    {
      key: 'wind', weight: 5, word: 'WIND', color: '#9fd2ff', hostile: true,
      roll: function (ch) { const sign = (ch & 2) ? 1 : -1; return { wind: sign * (0.008 + ((ch >>> 4) % 7) / 1000) }; }, // ±0.008..0.014
      apply: function (cond) { RG.wind = cond.wind; },
      label: function (cond) { return 'WIND' + (cond.wind > 0 ? ' →' : ' ←'); },
      draw: function (ctx, cond) { RG._drawWindArrow(ctx, cond.wind); },
    },
    {
      key: 'dark', weight: 4, word: 'DARK', color: '#e9e2f5', hostile: true,
      draw: function (ctx) { RG._drawDark(ctx); },
    },
    {
      key: 'slick', weight: 4, word: 'BLACK ICE', color: '#bfe6ff', hostile: true,
      apply: modApply('slick'),
      draw: function (ctx) { RG._drawCondTell(ctx, '❄', 'ICE', '#bfe6ff'); },
    },
    {
      key: 'hotrock', weight: 3, word: 'HOT ROCK', color: '#ffb066', hostile: true,
      apply: modApply('hotrock'),
      draw: function (ctx) { RG._drawCondTell(ctx, '◆', 'BOUNCE', '#ffb066'); },
    },
    {
      key: 'sticky', weight: 3, word: 'MUDFLATS', color: '#c7a98a',
      apply: modApply('sticky'),
    },
    {
      key: 'lowgrav', weight: 3, word: 'LOW G', color: '#cdbcff',
      apply: modApply('lowgrav'),
    },
  ];

  // ── REFINED conditions (the critique panel, applied) ───────────────────────
  // Each one is a strong, on-vision read that changes a DECISION (not a number) and
  // ships a free in-view counter-tool. Behind an opt-in variant; default unchanged.
  const RG_CONDITIONS_REFINED = [
    // WIND — refined: magnitude now reads in the ARROW LENGTH (3 discrete tiers), so a
    // long arrow means "this hole actually bends the shot" and a stub means "barely".
    // Turns the old static rightward offset into a per-hole read: how hard do I fight
    // THIS hole. Static-per-hole (no gust/pulse) keeps the deadpan calm. (Critics 1 & 2.)
    {
      key: 'wind', weight: 5, word: 'WIND', color: '#9fd2ff', hostile: true,
      roll: function (ch) {
        const sign = (ch & 2) ? 1 : -1;
        const tier = (ch >>> 4) % 3;                    // 0 gentle · 1 fresh · 2 strong
        const mag = [0.007, 0.011, 0.015][tier];
        return { wind: sign * mag, tier: tier };
      },
      apply: function (cond) { RG.wind = cond.wind; },
      label: function (cond) { return 'WIND' + (cond.wind > 0 ? ' →' : ' ←'); },
      draw: function (ctx, cond) { RG._drawWindArrow(ctx, cond.wind, cond.tier); },
    },
    // SLICK — refined into a PLACE: a visible cyan ICE band across the cup-side fairway.
    // The ball barely brakes ON the band, so the decision is route (land short of the ice
    // and let it carry, or fly the whole thing). The ground is the tell — no sky glyph.
    {
      key: 'slick', weight: 4, word: 'ICE', color: '#83cce6', hostile: true,
      band: { mat: 'ice', span: { fromFrac: 0.46, toFrac: 0.84 } },
    },
    // HOTROCK — refined into a PLACE: a basalt ROCK shelf on the approach. Bounce plays
    // off a visible shelf (land it on the rock and it skips to the pin, or carry past),
    // not a hole-wide dice roll. Cooler rust glyph dropped — the shelf is the tell.
    {
      key: 'hotrock', weight: 3, word: 'ROCK', color: '#9a8fa6', hostile: true,
      band: { mat: 'rock', span: { fromFrac: 0.52, toFrac: 0.78 } },
    },
    // STICKY — refined into a PLACE (kept forgiving, non-hostile): a brown MUD patch
    // hugging the green. Dead ground, no run-out — you must carry to hold a tight pin.
    // Forgiving, so it's safe to meet by surprise (Desert-Golfing learn-by-doing).
    {
      key: 'sticky', weight: 3, word: 'MUD', color: '#8b6b4a',
      band: { mat: 'mud', span: { fromFrac: 0.66, toFrac: 0.96 } },
    },
    // TWO SUNS — perception tax (the missing variant, critic 1). Two faint, disagreeing
    // terrain shadows make the true slope slightly ambiguous; you must read the ground
    // before committing a roll line. Free counter-tool lives ON the ball: its own shadow
    // doubles, telling you exactly where it sits. Recolors nothing, takes nothing away —
    // the gentle, serene inverse of dark. Non-hostile (a beautiful read, not a force).
    {
      key: 'twosun', weight: 3, word: 'TWO SUNS', color: '#ffd9a0',
      draw: function (ctx) { RG._drawTwoSuns(ctx); },
    },
    // (THERMAL / rising-air — critic 3's preferred air-axis variant — is SPECCED but not
    // shipped: its vertical lift needs an inert per-substep core hook in updatePhysics
    // that does not exist yet, the same shape as the existing horizontal RG.wind line.
    // Adding it is a core edit, so per the rules it's deferred to a spec, not faked with
    // a draw-frame force that would desync the bot. See docs/overnight/DECISIONS.md.)
  ];

  // ── Condition variants (dev-selectable; default = the shipped pool, SAFE) ───
  // ?cond=NAME (dev) or RG.setCondVariant('NAME') swaps which pool _rollConditions
  // draws from. 'default' is byte-identical to the shipped table (determinism gate
  // stays green). The others let the designer A/B the critique-refined options.
  const _refDef = function (key) { for (var i = 0; i < RG_CONDITIONS_REFINED.length; i++) if (RG_CONDITIONS_REFINED[i].key === key) return RG_CONDITIONS_REFINED[i]; return null; };
  const COND_VARIANTS = {
    // The current shipped behaviour — unchanged, the safe fallback the designer keeps.
    'default': RG_CONDITIONS,
    // The critique consensus: a coherent force/route grammar a new player learns in a
    // round — wind (tiered force) · slick (carry band) · hotrock (bounce shelf) ·
    // sticky (no-run-out patch). All localized, all in-world tells, no banners.
    'places': ['wind', 'slick', 'hotrock', 'sticky'].map(_refDef),
    // Adds tonal RANGE on top of places: twosun (perception). Five distinct kinds of
    // read — force, carry, bounce, no-run-out, perception. (Thermal/air is the specced
    // sixth, deferred for a core hook — see DECISIONS.md.)
    'range': ['wind', 'slick', 'hotrock', 'sticky', 'twosun'].map(_refDef),
    // The calm, non-hostile set: the perception read + tiered wind + the forgiving mud.
    // Leans hard into "lonely-but-cozy" — nothing here recolors against you.
    'gentle': ['wind', 'twosun', 'sticky'].map(_refDef),
  };
  // SHIPPED DEFAULT = 'places': hazards are READ FROM THE GROUND (a coloured band you route around),
  // not announced by a sky word. Drops dark + low-g from Earth weather (they live in 'default' only,
  // reserved to become whole-world identities). ?cond=NAME still A/Bs any pool. (Baseline refreshed.)
  let _condVariant = 'places';
  if (typeof location !== 'undefined') {
    const m = /[?&]cond=([a-z]+)/.exec(location.search);
    if (m && COND_VARIANTS[m[1]]) _condVariant = m[1];
  }
  function condTable() { return COND_VARIANTS[_condVariant] || RG_CONDITIONS; }
  function condDef(key) { const t = condTable(); for (var i = 0; i < t.length; i++) if (t[i] && t[i].key === key) return t[i]; return null; }

  const RG = {
    active: false,
    seed: 0,
    holeCount: 9,
    mods: [],            // active modifier keys
    modifiers: [],       // resolved modifier descriptors
    wind: 0,             // read by the one physics hook in gameplay.js (inert when 0)
    _physBase: null,     // per-run physics baseline (pristine + active escalations); per-hole condition resets restore THIS, not raw pristine

    // scoring + stakes
    holePars: [],        // par per hole index
    holeScores: [],      // strokes taken per completed hole
    runPar: 0,           // total par for the run
    budget: 0,           // stroke budget (par + cushion); bust it -> run ends
    prevBest: null,      // best total for this seed+mods, before this run
    isNewBest: false,
    _starsDone: null,    // lifetime surface holes completed -> the accreting night sky (Constellations)
    _starT: 0,           // twinkle frame counter
    _starFlare: 0,       // frames left on the just-earned star's flare
    // On-course score readout: 'corner' (default — canvas, top-left, matched to the course-title font)
    // or 'center' (?score=center — the legacy engine-drawn centered counter, for A/B).
    _scoreStyle: (typeof location !== 'undefined' && /[?&]score=center/.test(location.search)) ? 'center' : 'corner',
    get _hideStrokeCounter() { return this._scoreStyle !== 'center'; },   // read by art.js drawStrokeCounter (inert by default)
    // Night-sky liveliness A/B (?twinkle): 0 off (default) · 1 calm glisten (designer pick) · 2 glisten
    // + rare shooting star. ?twinkle=1 / ?twinkle=2 pick a level; bare ?twinkle = 1 (the calm pick).
    _twinkle: (function () { if (typeof location === 'undefined') return 0; var m = /[?&]twinkle(?:=(\d))?/.exec(location.search); return m ? (m[1] ? parseInt(m[1], 10) : 1) : 0; })(),
    _shoot: null,        // active shooting-star state (twinkle style 2)
    _firstKnowFlare: 0,  // frames left on the one-shot first-discovery rune bloom (the iceberg surfacing)
    failed: false,       // true if the run ended by busting the budget
    finalStrokes: 0,
    finalHoles: 0,

    // The Vault (secret)
    inVault: false,
    vaultUnlocked: false,
    vaultCleared: false,

    // The Fault (deeper secret): a hidden course you DROP INTO mid-run by coming to
    // rest on an anomaly tile. descending = the brief drop-through-the-floor animation.
    inFault: false,
    faultCleared: false,
    descending: false,

    // The Fault tile position (used by beginDescent to align the crane column).
    _faultTile: null,     // { hole, x } or null — set by _legibleHazards each run

    // Emergent per-hole conditions (wind / thin air / ice / …): seeded, never chosen,
    // most holes plain. holeConds[i] = null or { key, ...params }.
    holeConds: [],
    _condBanner: null,
    _paintedBand: null,   // refined "place" conditions: vertices repainted this hole, restored on hole change

    // Drops: a small carried resource — replay your last shot (no stroke). Using any
    // forfeits this run's best + Vault eligibility, so it's a "survive vs stay clean" call.
    drops: 0,
    dropsUsed: 0,
    _dropTo: null,

    _pars: {},           // par cache by hole index
    _lastSafe: null,     // last non-hazard rest position (water reshoots from here)

    // Fresh run id from the browser's non-seeded RNG — NEVER the seeded terrain
    // random() (that would shift terrain). Run metadata only.
    rollSeed() { return (Math.floor(Math.random() * 0x7fffffff)) | 0; },

    // Deterministic per-seed hash for placing the hidden Fault anomaly. Kept separate
    // from the terrain PRNG so it never shifts generation; pure given the seed.
    _faultHash(seed) {
      let h = (0x811c9dc5 ^ (seed >>> 0)) >>> 0;
      h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
      h = Math.imul(h ^ (h >>> 13), 0x297a2d39);
      h ^= h >>> 16;
      return h >>> 0;
    },
    _surfaceRunOnly() { return !this.inVault && !this.inFault; }, // no secret spawns inside a secret area

    // ── Emergent per-hole conditions ──────────────────────
    // Most holes are plain golf; a few are "special" (wind, ice, rising air, …) — seeded
    // by a per-hole hash (never the terrain PRNG), never chosen, telegraphed as the hole
    // loads. Holes 1-2 are always plain; a special hole forces the next plain so specials
    // punctuate calm. The DEFAULT pool's conditions are physics/light only; the refined
    // pool's "place" conditions deliberately paint a readable material BAND (color =
    // behaviour) as their in-world tell — that is the whole point of the refinement.
    _condHash(holeIdx) {
      const h = (Math.imul(this.seed >>> 0, 0x9E3779B1) ^ Math.imul(holeIdx + 1, 0x85EBCA77)) >>> 0;
      return this._faultHash(h);
    },
    _rollConditions() {
      this.holeConds = [];
      if (this.inVault || this.inFault) return;
      const CHANCE = 30; // % of eligible holes that get a condition
      // Airless worlds (phys.windScale === 0) never roll wind — vacuum is lawful.
      // (Thermal is convection in an atmosphere — vacuum kills it too.)
      const noWind = this._coursePhys && this._coursePhys.windScale === 0;
      const TABLE = condTable().filter(function (c) { return c && !(noWind && (c.key === 'wind' || c.key === 'thermal')); });
      if (!TABLE.length) return;
      const wsum = TABLE.reduce(function (a, c) { return a + c.weight; }, 0);
      let prevSpecial = false;
      for (let i = 0; i < this.holeCount; i++) {
        if (i < 2 || prevSpecial) { this.holeConds[i] = null; prevSpecial = false; continue; }
        const ch = this._condHash(i);
        if ((ch % 100) >= CHANCE) { this.holeConds[i] = null; continue; }
        let r = (ch >>> 7) % wsum, def = TABLE[0];
        for (let t = 0; t < TABLE.length; t++) { if (r < TABLE[t].weight) { def = TABLE[t]; break; } r -= TABLE[t].weight; }
        this.holeConds[i] = Object.assign({ key: def.key }, def.roll ? def.roll(ch) : null);
        prevSpecial = true;
      }
    },
    // Apply (or clear) the physics for the hole now in play, resetting to pristine first
    // so the previous hole's condition never leaks into the next.
    _applyHoleCondition(idx) {
      // Reset to the per-RUN physics baseline (pristine + any active escalation modifiers), NOT raw
      // pristine — otherwise a run-long modifier (Thin Air wind, Phobos Pull low-grav) gets wiped on
      // every hole transition. _physBase is snapshotted right after the modifier apply() loop.
      const base = this._physBase || { gravity: PRISTINE.gravity, wind: 0 };
      if (typeof GRAVITY !== 'undefined') GRAVITY = base.gravity;
      this.wind = base.wind;
      // Material conditions (slick/hotrock/sticky) mutate MATERIALS; restore the run
      // baseline's material snapshot first so the previous hole's mutation never leaks.
      if (base.mats && typeof MATERIALS !== 'undefined') {
        for (const k in base.mats) if (MATERIALS[k]) Object.assign(MATERIALS[k], base.mats[k]);
      }
      // Restore any painted "place" band from the hole we just left (refined slick /
      // hotrock / sticky paint a material band onto the live fairway vertices; un-paint
      // them so a band never leaks onto a later hole).
      this._restorePaintedBand();
      const c = this.holeConds[idx];
      if (!c) { this._condBanner = null; return; }
      const def = condDef(c.key);
      if (def && def.apply) def.apply(c);
      if (def && def.band) _paintBand(c, def.band.mat, def.band.span);   // refined: paint the place
      // Thin atmospheres scale whatever wind the condition set (vacuum already filtered the roll).
      if (this._coursePhys && this._coursePhys.windScale != null) this.wind *= this._coursePhys.windScale;
      // A hazard you can SEE needs no floating word: a "place" band (slick/hotrock/sticky) or an
      // in-world draw (wind's arrow, two-suns' double shadow, dark's vignette) IS the tell — the
      // ground says it and players learn the colour. Reserve the loud banner ONLY for the genuinely
      // invisible/weird (e.g. low-g, which shows nothing until you putt).
      this._condBanner = (def && !def.band && !def.draw) ? { text: (def.label ? def.label(c) : def.word), color: def.color, frame: 0 } : null;
    },
    // Un-paint the "place" band from the hole we just left, restoring each touched
    // vertex's original material. The band lives on the LIVE world (so its physics +
    // colour are real), but it must never leak past its own hole — holes are continuous,
    // so an un-restored band could overlap the next tee.
    _restorePaintedBand() {
      const p = this._paintedBand;
      if (!p || typeof vertices === 'undefined') { this._paintedBand = null; return; }
      for (let i = 0; i < p.length; i++) { const v = vertices[p[i].k]; if (v) v.mat = p[i].mat; }
      this._paintedBand = null;
    },

    // ── Audit oracle (dev / regression) ───────────────────
    // Pure, no rendering: replays each seed and reports its deterministic layout + a
    // stable terrain hash. The committed docs/audit-baseline.json is the regression
    // oracle — later phases assert this stays byte-identical (placement-only changes,
    // never a terrain shift). Mutates run state (it replays runs); call from a console.
    _audit(seedList) {
      const seeds = seedList || [];
      const fnv = function (s) { let h = 0x811c9dc5 >>> 0; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(16); };
      const holeAt = function (x) {
        if (typeof holes === 'undefined') return -1;
        for (let i = 0; i < holes.length; i++) { const h = holes[i]; const lo = Math.min(h.teeX, h.cupX), hi = Math.max(h.teeX, h.cupX); if (x >= lo - 60 && x <= hi + 60) return i; }
        return -1;
      };
      const out = [];
      for (let s = 0; s < seeds.length; s++) {
        this.startRun({ seed: seeds[s] });
        const conds = (this.holeConds || []).map(function (c) { return c ? c.key : '.'; });
        let anomalyX = -1;
        for (let k = 0; k < vertices.length; k++) { if (vertices[k].mat === 'anomaly') { anomalyX = vertices[k].x; break; } }
        let tv = '';
        for (let k = 0; k < vertices.length; k++) { const v = vertices[k]; tv += Math.round(v.x) + ',' + Math.round(v.y) + ',' + (v.mat || 's') + ';'; }
        let th = '';
        for (let k = 0; k < holes.length; k++) { const h = holes[k]; th += Math.round(h.teeX) + ',' + Math.round(h.teeY) + ',' + Math.round(h.cupX) + ',' + Math.round(h.cupY) + '|'; }
        out.push({
          seed: (seeds[s] >>> 0).toString(36),
          conds: conds,
          faultHole: anomalyX >= 0 ? holeAt(anomalyX) : -1,
          pars: this.holePars.slice(0, this.holeCount),
          runPar: this.runPar,
          budget: this.budget,
          terrainHash: fnv(tv) + '-' + fnv(th),
        });
      }
      return out;
    },

    // ── Par + scoring ─────────────────────────────────────
    // Par from cup distance + elevation (uphill is harder). Cached per hole index.
    parForHole(i) {
      if (this._pars[i] != null) return this._pars[i];
      const h = (typeof holes !== 'undefined') ? holes[i] : null;
      if (!h) return 3;
      const dist = Math.abs(h.cupX - h.teeX);
      const rise = h.teeY - h.cupY; // > 0 means the cup sits above the tee (uphill)
      let par = 3;
      if (dist > 820) par += 1;
      if (dist > 1180) par += 1;
      if (rise > 90) par += 1;
      par = Math.max(2, Math.min(5, par));
      this._pars[i] = par;
      return par;
    },
    _computeRunPar() {
      let p = 0;
      for (let i = 0; i < this.holeCount; i++) { this.holePars[i] = this.parForHole(i); p += this.holePars[i]; }
      this.runPar = p;
    },

    // Hazard legibility (fairness). The engine paints materials onto random vertex
    // ranges decoupled from terrain shape, so water can land on a flat landing you
    // can't read from the tee — an ambush, not a hazard. Keep WATER only as ponds in
    // genuine basins, never near a cup or tee. Geometry-only (no PRNG) so the seed
    // still reproduces the run exactly.
    _legibleHazards() {
      if (typeof vertices === 'undefined' || !vertices.length || typeof holes === 'undefined') return;

      // Tutorial opening (Desert-Golfing ethos). On a vanilla run, hole 1 is pure sand
      // so a new player learns the putt safely; the first lethal water pond is always
      // held until hole 3, once you've met the colour language. (If you opted into an
      // escalation, you signed up to meet its surface on hole 1, so we don't sand it.)
      const h0 = holes[0];
      if (h0 && (RG.modifiers || []).length === 0) {
        // "Plain" = the active world's base surface (sand on Mars, grass on Earth, …).
        const plainMat = (typeof currentCourse !== 'undefined' && currentCourse && currentCourse.defaultMaterial) || 'sand';
        const a0 = Math.min(h0.teeX, h0.cupX) - 40, b0 = Math.max(h0.teeX, h0.cupX) + 40;
        for (let k = 0; k < vertices.length; k++) { const v = vertices[k]; if (v.x >= a0 && v.x <= b0) v.mat = plainMat; }
      }

      // A hole's cup IS the next hole's tee (holes are continuous), so guard both
      // ends equally + generously: never a pond where you sink or where you start.
      // maxPonds = 0: the dead-simple base course is JUST SAND — no water. (The pond
      // placement stays for reuse if water returns later as a rare emergent hazard.)
      const cupGuard = 110, teeGuard = 110, maxPonds = 0;
      let ponds = 0;
      for (let hi = 2; hi < this.holeCount && ponds < maxPonds; hi++) {
        const h = holes[hi]; if (!h) continue;
        const lo = Math.min(h.teeX, h.cupX) + teeGuard;
        const hiX = Math.max(h.teeX, h.cupX) - cupGuard;
        if (hiX - lo < 120) continue; // too short to hold a fair pond
        // deepest point in the guarded playable span (greater y = lower on screen)
        let lowIdx = -1, lowY = -1e9;
        for (let k = 0; k < vertices.length; k++) {
          const v = vertices[k];
          if (v.x >= lo && v.x <= hiX && v.y > lowY) { lowY = v.y; lowIdx = k; }
        }
        if (lowIdx < 0) continue;
        const rim = Math.min(h.teeY, h.cupY); // the higher (smaller-y) of tee / cup
        if (!(lowY > rim + 50)) continue;      // only a genuinely deep dip becomes a pond
        // flood the contiguous floor of the dip (vertices within 22px of the lowest point)
        let a = lowIdx, b = lowIdx;
        while (a - 1 >= 0 && vertices[a - 1].x >= lo && vertices[a - 1].y > lowY - 22) a--;
        while (b + 1 < vertices.length && vertices[b + 1].x <= hiX && vertices[b + 1].y > lowY - 22) b++;
        for (let k = a; k <= b; k++) vertices[k].mat = 'water';
        ponds++;
      }

      // ── The Fault (secret) ──────────────────────────────
      // A rare, deterministic anomaly tile. Come to REST on it and the floor gives way
      // (wrap.onRest -> RG.beginDescent). Placed by geometry + a seed hash only (never
      // the terrain PRNG), so the seed reproduces it. Surface run only — never inside
      // the Vault or the undercroft. Flattened into a small, landable violet shelf.
      this._faultTile = null;
      let faultHole = -1;
      if (!window.RG_MINIMAL && !RG.inVault && !RG.inFault && this.holeCount > 2) {
        const fh = this._faultHash(this.seed);
        if ((fh % 100) < 20) {                                   // ~1 in 5 runs hide a Fault (rare)
          const fhi = 2 + (fh % (this.holeCount - 2));           // never on the tutorial holes
          faultHole = fhi;
          const fHole = holes[fhi];
          if (fHole) {
            const flo = Math.min(fHole.teeX, fHole.cupX) + 130;
            const fhiX = Math.max(fHole.teeX, fHole.cupX) - 130;
            if (fhiX - flo > 70) {
              const fmid = (flo + fhiX) / 2;
              let fbest = -1, fscore = 1e9;
              for (let k = 1; k < vertices.length - 1; k++) {
                const v = vertices[k];
                if (v.x < flo || v.x > fhiX || v.mat === 'water') continue;
                const slope = Math.abs(vertices[k + 1].y - vertices[k - 1].y);
                const sc = Math.abs(v.x - fmid) + slope * 6;
                if (sc < fscore) { fscore = sc; fbest = k; }
              }
              if (fbest >= 1 && fbest < vertices.length - 1) {
                // a consistent 3-vertex flat violet shelf (visible + landable regardless
                // of local vertex spacing), leveled to the centre so the ball can rest
                const fy = vertices[fbest].y;
                for (let k = fbest - 1; k <= fbest + 1; k++) { vertices[k].mat = 'anomaly'; vertices[k].y = fy; }
                this._faultTile = { hole: fhi, x: vertices[fbest].x };
              }
            }
          }
        }
      }

      // standalone secrets (the registry) place themselves last — surface run only
      if (this._surfaceRunOnly() && window.RG_runSecretHook) RG_runSecretHook('place', this.seed);

      // emergent per-hole conditions (wind / thin air / …) decided last
      this._rollConditions();
    },
    // running strokes-vs-par, formatted (E / +N / -N)
    vsParStr(total, par) {
      const d = total - par;
      return d === 0 ? 'E' : (d > 0 ? '+' + d : String(d));
    },

    // ── Best-per-seed (skill target) ──────────────────────
    // Best is per seed AND per active-modifier stack (different stacks aren't comparable).
    bestKey() { return 'rg-best-' + (this.course || 'run-course') + '-' + (this.seed >>> 0) + '-' + this.mods.slice().sort().join(','); },
    loadBest() { const v = (typeof localStorage !== 'undefined') ? localStorage.getItem(this.bestKey()) : null; const n = v != null ? parseInt(v, 10) : null; return Number.isFinite(n) ? n : null; },
    saveBest(total) {
      const b = this.loadBest();
      if (b == null || total < b) { try { localStorage.setItem(this.bestKey(), String(total)); } catch (e) {} return true; }
      return false;
    },

    // ── Constellations (visual progression) ───────────────
    // Completing surface holes quietly accretes stars into the night sky — a wordless,
    // mechanics-free pull to play more (and, by playing, to drift into the secrets above).
    // Lifetime count persists; star positions are deterministic per index, so the sky only ever
    // GROWS — a given star never moves as new ones appear.
    loadProgress() {
      try { this._starsDone = parseInt(localStorage.getItem('rg-holes-done') || '0', 10) || 0; }
      catch (e) { this._starsDone = 0; }
    },
    _recordHoleDone() {
      this._starsDone = (this._starsDone || 0) + 1;
      this._starFlare = 26;                                   // the just-earned star briefly flares
      try { localStorage.setItem('rg-holes-done', String(this._starsDone)); } catch (e) {}
    },
    // Stable pseudo-random position for star i (two independent hashes; never the terrain PRNG).
    _starAt(i) {
      let h = this._faultHash((Math.imul(i + 1, 2654435761)) >>> 0);
      const x = (h % 997) / 997;
      h = this._faultHash((h ^ 0x9e3779b9) >>> 0);
      const y = (h % 991) / 991;
      return { x: x, y: y };
    },

    // Called by the MODE wrap when a hole completes.
    recordHole(i, strokesTaken) { this.holeScores[i] = strokesTaken; },
    // True if completing the run so far has blown the budget.
    isOverBudget() { return this.budget > 0 && (typeof totalStrokes !== 'undefined') && totalStrokes > this.budget; },

    // Spend a drop: replay your last shot from where you took it (no stroke). Only
    // between shots and only if a previous rest is known. Using any drop forfeits this
    // run's best + Vault eligibility (enforced in the wrap's onTransitionEnd).
    useDrop() {
      if (!this.active || this.inVault || this.drops <= 0) return false;
      if (typeof state === 'undefined' || state !== STATE_AIM) return false;
      // Need a real shot to replay: 0 strokes means a fresh tee, where dropping would teleport to
      // the prior hole's spot AND silently forfeit best/Vault (dropsUsed++) for no shot taken.
      if (typeof strokes === 'undefined' || strokes <= 0) return false;
      if (!this._dropTo || typeof terrainYAt !== 'function') return false;
      const x = this._dropTo.x;
      ball.x = x; ball.y = terrainYAt(x) - BALL_RADIUS;
      ball.vx = 0; ball.vy = 0; ball.onGround = true; ball.atRest = true;
      if (typeof strokes !== 'undefined' && strokes > 0) strokes--; // refund the shot just taken
      this.drops--; this.dropsUsed++;
      this._lastSafe = { x: x };
      this._dropTo = null; // can't undo the same shot twice
      this._syncHUD();
      return true;
    },

    // ── Pristine reset (for stacked modifiers) ────────────
    _restoreAll() {
      if (typeof GRAVITY !== 'undefined') GRAVITY = PRISTINE.gravity;
      if (typeof MATERIALS !== 'undefined') {
        for (const k in PRISTINE.materials) {
          if (MATERIALS[k]) Object.assign(MATERIALS[k], PRISTINE.materials[k]);
        }
      }
      RG.wind = 0;
    },

    // Snapshot the post-modifier physics as the per-RUN baseline. Per-hole condition
    // resets restore THIS (planet + run-long modifiers), keeping escalations alive across
    // hole transitions while letting one-hole conditions cleanly revert. Includes a deep
    // copy of the MATERIALS fields a material condition can touch (friction/restitution).
    _snapPhysBase() {
      const mats = {};
      if (typeof MATERIALS !== 'undefined') {
        for (const k in MATERIALS) {
          const m = MATERIALS[k];
          mats[k] = { rollingFriction: m.rollingFriction, surfaceFriction: m.surfaceFriction, restitution: m.restitution };
        }
      }
      this._physBase = { gravity: (typeof GRAVITY !== 'undefined') ? GRAVITY : PRISTINE.gravity, wind: this.wind, mats: mats };
    },

    // Resolve active modifier keys to their descriptors (shared by startRun + the Vault).
    _resolveMods(keys) {
      return (keys || [])
        .map(function (k) { return (window.RG_MODIFIERS || []).find(function (m) { return m.key === k; }); })
        .filter(Boolean);
    },

    _buildCourse(courseId) {
      const live = WORLDS['run-world'].courses[courseId];
      // Dynamic (live-tunable) courses — the lab planet — opt out of the template cache so each startRun
      // re-reads the latest config (changing complexity/material live actually takes effect).
      if (live && live._dynamic) return JSON.parse(JSON.stringify(live));
      if (!_courseTemplates[courseId]) {
        _courseTemplates[courseId] = JSON.parse(JSON.stringify(live));
        _courseFnsById[courseId] = { cupElevation: live.cupElevation }; // JSON drops functions; keep them
      }
      const c = JSON.parse(JSON.stringify(_courseTemplates[courseId]));
      const fns = _courseFnsById[courseId];
      if (fns && fns.cupElevation) c.cupElevation = fns.cupElevation;
      return c;
    },

    // Engine filler terrain (the pre-tee runway, background bands) generates mat-less —
    // drawn with the orange GROUND fallback — or hardcoded 'sand'. On worlds that declare
    // a defaultMaterial, remap every vertex whose material isn't in the course palette so
    // the planet reads as ONE coherent surface (Earth = grass, the Moon = regolith).
    _applyTerrainDefault(course) {
      if (window.ED && window.ED.on) return;                              // the hole editor owns its own materials
      if (!course || !course.defaultMaterial || typeof vertices === 'undefined') return;
      const ok = {};
      (course.materials || []).forEach(function (m) { ok[m] = 1; });
      ok[course.defaultMaterial] = 1;
      for (let i = 0; i < vertices.length; i++) {
        const m = vertices[i].mat;
        if (!m || !ok[m]) vertices[i].mat = course.defaultMaterial;
      }
    },

    // Re-clamp terrain materials to the ACTIVE course palette — for terrain (re)generated
    // DURING play, after the one-time startRun _applyTerrainDefault. generateHoleTerrain pushes
    // boundary/background vertices with NO mat; those render as DEFAULT_MAT ('sand' = orange) and
    // showed up as off-palette ORANGE BLOCKS on Earth's green (and would tan the Moon). Uses the
    // engine's live `currentCourse`, and PRESERVES water/anomaly so it never erases a pond or the
    // Fault tile (the startRun pass runs before hazards exist, so this guard is inert there →
    // determinism untouched). Called from the generateHoleTerrain wrap at the bottom of this file.
    _clampTerrainMats() {
      if (window.ED && window.ED.on) return;                              // the hole editor owns its own materials
      if (typeof vertices === 'undefined' || typeof currentCourse === 'undefined' || !currentCourse) return;
      const def = currentCourse.defaultMaterial;
      if (!def) return;
      const ok = {};
      (currentCourse.materials || []).forEach(function (m) { ok[m] = 1; });
      ok[def] = 1;
      // A refined "place" condition (places/range/gentle pools) paints a band of ice/rock/mud onto
      // the live fairway — materials NOT in the course's base palette. Those are intentional and must
      // survive the clamp, or the band vanishes (the whole point of a place you read from the tee).
      // Exempt them two ways: by the active painted-band's vertex indices, and by the known band mats.
      const inBand = {};
      const pb = this._paintedBand;
      if (pb) for (let j = 0; j < pb.length; j++) inBand[pb[j].k] = 1;
      for (let i = 0; i < vertices.length; i++) {
        if (inBand[i]) continue;
        const m = vertices[i].mat;
        if (m === 'water' || m === 'anomaly' || m === 'ice' || m === 'rock' || m === 'mud') continue;   // hazards / Fault tile / condition-band paints
        if (!m || !ok[m]) vertices[i].mat = def;
      }
    },

    // Cup-fill colour hook (art.js drawCupFill). A sunk putt should HEAL into the ground it sits
    // in, not a hardcoded sand patch — on Earth's grass the old fixed GROUND brown read as a
    // jarring green->brown seam at every cup. Return the material colour of the terrain at this
    // cup's x (the same MATERIALS[mat].color drawTerrainDG fills that run with), so the fill
    // matches the apron — grass on Earth, sand in a bunker, regolith on the Moon. Returns null
    // when unknown, and art.js falls back to GROUND (so the base game is untouched).
    _cupFillColorFor(cupData) {
      try {
        if (typeof vertices === 'undefined' || typeof MATERIALS === 'undefined' || !cupData) return null;
        const cx = (cupData.cupX != null) ? cupData.cupX
          : (cupData.cupLeftX != null && cupData.cupRightX != null) ? (cupData.cupLeftX + cupData.cupRightX) / 2
          : null;
        if (cx == null) return null;
        const i = (typeof findSegment === 'function') ? findSegment(cx) : -1;
        const matName = (i >= 0 && vertices[i]) ? vertices[i].mat : null;
        const mat = matName && MATERIALS[matName];
        return (mat && mat.color) ? mat.color : null;
      } catch (e) { return null; }
    },

    // Earth's last hole gets a proper apron: the engine ends terrain ~90px past the final
    // cup, but the broken ship parks beyond that — extend flat ground with a gentle rising
    // backstop lip so playing up to the ship is golf, not an out-of-bounds trap.
    _extendShipApron(course) {
      if (!course || course.shipApron !== true) return;
      if (typeof vertices === 'undefined' || !vertices.length) return;
      const last = vertices[vertices.length - 1];
      const mat = course.defaultMaterial || last.mat;
      let x = last.x;
      const y = last.y;
      for (let i = 1; i <= 14; i++) {
        x += 30;
        const lip = i > 10 ? (i - 10) * 14 : 0;       // the backstop rises over the final stretch
        vertices.push({ x: x, y: y - lip, mat: mat });
      }
    },

    // Per-course world "skin": the run-world's name/sky follow the active course (Earth,
    // Mars, the Moon are all courses of one registry world). Defaults preserved so courses
    // without worldName/sky look exactly as before.
    _applyWorldSkin(course) {
      const w = WORLDS['run-world'];
      if (!RG._worldDefaults) RG._worldDefaults = { name: w.name, sky: w.sky, defaultMaterial: w.defaultMaterial };
      w.name = (course && course.worldName) || RG._worldDefaults.name;
      w.sky = (course && course.sky) || RG._worldDefaults.sky;
      w.defaultMaterial = (course && course.defaultMaterial) || RG._worldDefaults.defaultMaterial;
    },

    // Start (or restart) a run. seed -> identical holes; mods -> active modifier keys;
    // course -> which surface world to play (defaults to the current one; Earth on boot).
    startRun(opts) {
      opts = opts || {};
      const seed = (opts.seed != null && opts.seed !== '') ? (opts.seed | 0) : RG.rollSeed();
      const modKeys = opts.mods || [];
      const courseId = opts.course || RG.course || 'earth-course';

      RG._restoreAll();
      RG.mods = modKeys;
      RG.modifiers = RG._resolveMods(modKeys);
      RG.course = courseId;

      // Build the effective course (modifiers reshape materials/archetypes), then install.
      const course = RG._buildCourse(courseId);
      for (const m of RG.modifiers) if (m.course) m.course(course);
      if (window.RG_TERRAIN && RG_TERRAIN.apply) RG_TERRAIN.apply(course, courseId);   // opt-in "crafted holes" treatment (peel-off-able; terrain.js; no-op at default 'gentle')
      WORLDS['run-world'].courses[courseId] = course;
      RG._coursePhys = course.phys || null;
      RG._applyWorldSkin(course);

      RG.active = true;
      RG.seed = seed;
      RG.holeCount = course.holeCount || 9;
      RG.wind = 0;
      RG.finalStrokes = 0;
      RG.finalHoles = 0;
      RG.failed = false;
      RG.isNewBest = false;
      RG.inVault = false;
      RG.vaultUnlocked = false;
      RG.vaultCleared = false;
      RG.inFault = false;
      RG.faultCleared = false;
      RG.descending = false;
      RG._descPhase = 'none';
      RG._zoom = 1;
      RG._secretArea = null;
      if (typeof camera !== 'undefined') camera.y = 0; // clear any leftover crane offset
      RG._secretStrokes = null;
      RG._apronCamBase = null;
      if (window.RG_runSecretHook) RG_runSecretHook('reset');
      RG.holePars = [];
      RG.holeScores = [];
      RG._pars = {};
      RG._lastSafe = null;
      RG.drops = 2;
      RG.dropsUsed = 0;
      RG._dropTo = null;
      RG._paintedBand = null;   // vertices are regenerated below; drop stale band indices

      // The planet's own physics first (course phys scales the pristine baseline), then
      // physics-mutating modifiers layer on top of that.
      if (RG._coursePhys && RG._coursePhys.gravityScale != null && typeof GRAVITY !== 'undefined') {
        GRAVITY = PRISTINE.gravity * RG._coursePhys.gravityScale;
      }
      for (const m of RG.modifiers) if (m.apply) m.apply();
      // Snapshot the resulting physics as the run baseline so per-hole condition resets restore
      // THIS (planet + modifiers), keeping run-long escalations alive across hole transitions.
      RG._snapPhysBase();

      // Seed, then boot. startCourse reads dg-seed for its base seed, so the run is
      // reproducible from `seed`. We avoid resetGame() (it would pin the seed to 42).
      localStorage.setItem('dg-seed', String(seed));
      startCourse('run-world', courseId);

      // Generate every hole up front (cheap, deterministic) so par + budget are known.
      if (typeof ensureHolesAhead === 'function') ensureHolesAhead(RG.holeCount);
      RG._applyTerrainDefault(course);   // before hazards, so the anomaly tile survives
      RG._extendShipApron(course);       // ground past the last cup for the ship scene
      RG._legibleHazards();
      RG._computeRunPar();
      RG.budget = RG.runPar + BUDGET_OVER;
      RG.prevBest = RG.loadBest();
      RG._applyHoleCondition(0);

      RG._buildHUD();
      if (typeof revealGame === 'function') revealGame();
      if (typeof ensureGameLoop === 'function') ensureGameLoop();
      RG._syncHUD();
    },

    // ── In-run HUD (DOM) ──────────────────────────────────
    _buildHUD() {
      const hud = document.getElementById('rg-hud');
      if (!hud) return;
      // Dead-simple HUD, top-left (the spot the course title vacates): which hole you're on.
      // The running stroke total is the engine's own centered counter; budget, best, drops
      // and conditions all stay hidden depth.
      hud.innerHTML = '<span id="rg-hud-hole" class="rg-hud-hole"></span>';
      hud.style.display = 'flex';
    },
    _syncHUD() {
      const hud = document.getElementById('rg-hud');
      if (!hud) return;
      if (this._scoreStyle !== 'center') { hud.style.display = 'none'; return; } // canvas corner readout owns the HUD
      if (window.RG && RG.descending) { hud.style.display = 'none'; return; } // hidden during the drop
      const done = (typeof state !== 'undefined' && typeof STATE_COMPLETE !== 'undefined' && state === STATE_COMPLETE);
      if (!RG.active || done) { hud.style.display = 'none'; return; }
      // On hole 1 the engine's course title owns the top-left; defer to it until it fades on
      // the first shot, then the hole tracker takes over the same spot (the two never overlap).
      if (typeof showTitle !== 'undefined' && showTitle && (typeof currentHole !== 'undefined') && currentHole === 0) { hud.style.display = 'none'; return; }
      hud.style.display = 'flex';
      const he = document.getElementById('rg-hud-hole');
      const idx = (typeof currentHole !== 'undefined' ? currentHole : 0);
      const hole = Math.min(idx + 1, RG.holeCount);
      if (he) he.textContent = 'HOLE ' + hole + ' / ' + RG.holeCount;
    },

    // Start the next run from the run-complete screen. One course today → straight into a fresh
    // seed (no interstitial). When more courses are unlocked (progression), this is where a
    // course-select screen branches in — the only place "New Run" stops being immediate.
    beginNewRun() {
      const courses = RG._unlockedCourses();
      if (courses.length > 1 && RG.showCourseSelect) { RG.showCourseSelect(courses); return; }
      RG.startRun({ seed: RG.rollSeed(), mods: RG.mods, course: RG.course });
    },
    // Playable surface courses the player has unlocked. The Front Nine is always available;
    // further courses unlock through progression (persisted later) — the hook New Run reads.
    _unlockedCourses() { return ['run-course']; },

    // Enter the secret Vault: one brutal bonus hole. Reuses the run machinery on a
    // separate course; no budget (it's a bonus). Seed derived from the run seed.
    enterVault() {
      RG._restoreAll();
      RG.modifiers = RG._resolveMods(RG.mods);
      if (!_vaultTemplate) _vaultTemplate = JSON.parse(JSON.stringify(WORLDS['run-world'].courses['vault']));
      var vc = JSON.parse(JSON.stringify(_vaultTemplate));
      for (var i = 0; i < RG.modifiers.length; i++) if (RG.modifiers[i].course) RG.modifiers[i].course(vc);
      WORLDS['run-world'].courses['vault'] = vc;
      RG.inVault = true;
      RG.vaultCleared = false;
      RG.failed = false;
      RG.isNewBest = false;
      RG.holeCount = vc.holeCount || 1;
      RG.budget = 0; // no budget in the vault
      RG.holePars = []; RG.holeScores = []; RG._pars = {}; RG._lastSafe = null;
      RG.drops = 0; RG.dropsUsed = 0; RG._dropTo = null; // no drops in the Vault
      RG.finalStrokes = 0; RG.finalHoles = 0;
      for (var j = 0; j < RG.modifiers.length; j++) if (RG.modifiers[j].apply) RG.modifiers[j].apply();
      RG._snapPhysBase();
      localStorage.setItem('dg-seed', String((RG.seed ^ 0x5eed) | 0));
      RG._applyWorldSkin(vc);   // vault has no skin of its own -> the default (dark) world
      startCourse('run-world', 'vault');
      if (typeof ensureHolesAhead === 'function') ensureHolesAhead(RG.holeCount);
      RG._legibleHazards();
      RG._computeRunPar();
      RG._buildHUD();
      if (typeof revealGame === 'function') revealGame();
      if (typeof ensureGameLoop === 'function') ensureGameLoop();
      RG._syncHUD();
    },

    // ── Secret areas: a continuous vertical pan into a course above/below ──
    // Triggered by wrap.onRest (rest on the violet anomaly -> the Fault, DOWN) or a secret (over-club
    // out the top -> the Loft; the Leviathan -> the Ocean, UP). Reuses the hole-to-hole feel: one clean
    // departure frame renders, THEN the destination is installed + sunk (deferred so the build hitch
    // lands off the first motion frame) and the camera pans on Y over a TIME-based duration with the
    // variant's easing. Both the surface band AND the sunk destination band are drawn during the pan
    // (wrap.drawWorld -> _drawShaftBand); because drawTerrainDG closes every polygon
    // at the same world-y (H+300), their sand fills MEET into one continuous column — you drill through
    // solid earth into the room. No cover flash, no visible course-load.
    beginDescent() {
      // Ride from where the ball ACTUALLY rests (it can stop anywhere on the tile's width);
      // riding the tile's centre instead would snap the ball sideways on the first frame.
      this._beginCrane(CRANE_DEPTH, ((typeof ball !== 'undefined') ? ball.x : (this._faultTile ? this._faultTile.x : 0)),
        function () { RG.descend(); });
    },
    // Dev: switch the per-hole CONDITION pool. 'default' = the shipped table (safe; what
    // the determinism gate audits). 'places' / 'range' / 'gentle' = the critique-refined
    // pools. Re-rolls the current run's conditions so the change is visible immediately.
    setCondVariant(name) {
      if (COND_VARIANTS[name]) _condVariant = name;
      if (this.active) { this._restorePaintedBand(); this._rollConditions(); this._applyHoleCondition((typeof currentHole !== 'undefined') ? currentHole : 0); this._syncHUD && this._syncHUD(); }
      return _condVariant;
    },
    condVariant() { return { name: _condVariant, all: Object.keys(COND_VARIANTS), keys: condTable().map(function (c) { return c && c.key; }) }; },
    // Dev: switch crane feel (0..n). Returns the chosen variant id.
    setCraneVariant(n) { if (n >= 0 && n < CRANE_VARIANTS.length) _craneVariant = n | 0; return craneCfg().id; },
    craneVariant() { return { index: _craneVariant, cfg: craneCfg(), all: CRANE_VARIANTS }; },
    // The active variant's easing curve.
    // Is the active crane an interplanetary TRAVEL pan (vs a vertical DESCENT drill)? Travel sets
    // _craneXFrac to 1 (x eases across the whole pan); descents leave it at 0.5. Travel-only feel
    // (durTravel / easeTravel / xArc / parallax) gates on this so the drill keeps its own weight.
    _craneIsTravel() { return (this._craneXFrac || 0.5) >= 1; },
    // The active ease NAME, honouring a variant's optional travel-only override (e.g. drift's
    // asymmetric driftOut on the crossing, while its descent stays a symmetric sine).
    _craneEaseName() { const c = craneCfg(); return (this._craneIsTravel() && c.easeTravel) ? c.easeTravel : c.ease; },
    _ease(t) { return (EASE[this._craneEaseName()] || EASE.inOutQuad)(t < 0 ? 0 : t > 1 ? 1 : t); },
    // The active duration: travel may run a different pace than the drill (pace follows payload).
    _craneDur() { const c = craneCfg(); return (this._craneIsTravel() && c.durTravel) ? c.durTravel : (c.dur || 1500); },
    // Arm the pan. THREE objective bugs fixed here vs the old crane:
    //  (1) duration is TIME-based (CRANE_VARIANTS[].dur ms), not a fixed 90 frames, so a 144Hz
    //      display no longer fast-forwards the trip;
    //  (2) the destination world is NOT built on this call — building it (startCourse +
    //      ensureHolesAhead + _legibleHazards) is a multi-ms hitch, so we DEFER it one frame
    //      ('arm' phase) to land between a clean static departure render and the first MOTION
    //      frame, where a long frame can't read as a stutter;
    //  (3) the ball ride is one unified eased curve (see _tickCrane), not an ad-hoc head+tail pair.
    // We snapshot the surface (render-only — a divert abandons the surface run, so no restore)
    // and stash the install closure; _tickCrane('arm') runs it, sinks the destination to ±depth,
    // x-aligns it under the column, then animates camera.y from the departure framing.
    _beginCrane(depth, rideX, install) {
      if (this.descending || this.inFault || this.inVault || !this.active) return;
      var surfaceCamX = (typeof camera !== 'undefined') ? camera.x : 0;
      var surfaceCamY = (typeof camera !== 'undefined') ? (camera.y || 0) : 0;
      var surfaceBallX = (rideX != null) ? rideX : ((typeof ball !== 'undefined') ? ball.x : 0);
      // Capture the rest SCREEN-y NOW — install() (deferred to the arm tick) replaces the world
      // and moves the ball to the shifted destination tee, so reading ball.y any later rides from
      // the wrong place. (Screen-relative so cranes work from displaced worlds too — Moon -> Earth.)
      this._craneStartBallY = ((typeof ball !== 'undefined') ? ball.y : H * 0.46) - surfaceCamY;
      this._craneFromY = surfaceCamY;
      this._craneTargetY = surfaceCamY + depth;   // install() reads this to place the destination
      this._craneXFrac = 0.5;                     // fraction of the pan the camera.x drift spans at the tail (cranes); travel overrides to 1
      this._panBand = {                                            // surface render snapshot (upper band during the pan)
        verts: (typeof vertices !== 'undefined') ? vertices.map(function (v) { return { x: v.x, y: v.y, mat: v.mat }; }) : null,
        holes: (typeof holes !== 'undefined') ? JSON.parse(JSON.stringify(holes)) : null,
        objs: (typeof objects !== 'undefined') ? JSON.parse(JSON.stringify(objects)) : null,
        hole: (typeof currentHole !== 'undefined') ? currentHole : 0,
      };
      this._craneInstall = install;               // DEFERRED — run on the arm tick, off the first motion frame
      this._craneDepartCourse = this.course;      // the planet we're LEAVING (install() will set this.course to the destination)
      this._craneCamStartX = surfaceCamX;
      this._craneDepth = depth;
      this._craneRideX = surfaceBallX;
      this._craneSurfBallX = surfaceBallX;
      this._craneProg = 0;
      this._craneT0 = 0;                           // set when the pan actually begins (after install)
      this._descPhase = 'arm';                     // one clean departure frame renders, THEN install
      this.descending = true;                      // physics gate: wrap.collide/isOOB free-fly through the shaft
      // Hold the ball at its surface rest spot for the static arm frame (no jump, no motion yet).
      if (typeof ball !== 'undefined') { ball.atRest = false; ball.onGround = false; ball.vx = 0; ball.vy = 0; ball.x = surfaceBallX; ball.y = surfaceCamY + this._craneStartBallY; }
      if (typeof camera !== 'undefined') { camera.x = surfaceCamX; camera.y = surfaceCamY; }
      if (typeof state !== 'undefined') state = STATE_FLIGHT;
    },
    // Run the deferred destination build (the expensive step) and arm the timed pan. Called once,
    // from _tickCrane, AFTER a clean departure frame has rendered — so the build's frame-time cost
    // sits between a static frame and the first moving frame and never reads as a motion stutter.
    _armCrane() {
      var install = this._craneInstall; this._craneInstall = null;
      if (install) install();                                     // loads + sinks the destination; sets inFault/state/camera.y=depth
      // install() (descend / startRun) clears descending + the phase as a side effect — re-assert
      // both so the pan keeps the physics gate (wrap.collide/isOOB free-fly) and keeps ticking.
      this.descending = true;
      if (typeof showTitle !== 'undefined') showTitle = false;    // no destination title banner pops at arrival
      var destBallX = (typeof ball !== 'undefined') ? ball.x : 0;
      this._shiftWorldX(this._craneSurfBallX - destBallX);        // x-align the destination tee under the column -> pure vertical pan
      this._craneDestBallX = (typeof ball !== 'undefined') ? ball.x : 0;
      this._craneDestBallY = (typeof ball !== 'undefined') ? ball.y : 0;
      // The room's proper framing (tee↔cup centred, like every normal hole). The pan's tail
      // eases camera.x here so you ARRIVE framed on the hole — not staring at a cupless wall.
      var dh = (typeof holes !== 'undefined') && holes[0];
      this._craneCamTargetX = (dh && dh.cupX != null) ? ((dh.teeX + dh.cupX) / 2 - W / 2) : this._craneCamStartX;
      // Restore the departure framing the install clobbered (it set inFault/camera.y=±depth).
      if (typeof camera !== 'undefined') { camera.x = this._craneCamStartX; camera.y = this._craneFromY || 0; }
      if (typeof ball !== 'undefined') { ball.x = this._craneRideX; ball.y = (this._craneFromY || 0) + (this._craneStartBallY != null ? this._craneStartBallY : H * 0.46); ball.vx = 0; ball.vy = 0; ball.atRest = false; ball.onGround = false; }
      this._craneProg = 0;
      this._craneT0 = nowMs();
      this._descPhase = 'pan';
    },
    // Shift the whole live world along X (mirror of _sinkWorld) so the destination tee sits under the
    // surface column — keeps the pan purely vertical (no camera.x jump to hide).
    _shiftWorldX(dx) {
      if (!dx) return;
      if (typeof vertices !== 'undefined') for (let i = 0; i < vertices.length; i++) vertices[i].x += dx;
      if (typeof holes !== 'undefined') for (let i = 0; i < holes.length; i++) {
        const h = holes[i];
        for (const k in h) if (Object.prototype.hasOwnProperty.call(h, k) && k.charAt(k.length - 1) === 'X' && typeof h[k] === 'number') h[k] += dx;
      }
      if (typeof ball !== 'undefined') ball.x += dx;
      // The ship caches its apron spot OUTSIDE vertices/holes; glue it to the shift so a crane
      // that re-aligns the world (e.g. returning to Earth) doesn't strand the wreck.
      const sp = window.RG_secret ? RG_secret('ship') : null;
      if (sp && sp.pos) sp.pos.x += dx;
    },
    // Advance the pan (driven from _drawOverlays each rAF frame; from the bot's aiUpdate when the
    // tab is hidden). Mutates camera + the ridden ball only; the destination band is the live world
    // (drawWorld pass 1), the surface band is pass 2.
    //   dtMs (optional): an explicit step in ms for the headless/hidden bot path, which advances
    //   many fixed steps per real frame (so performance.now() barely moves across them). When
    //   omitted (the rAF path) the pan reads wall-clock time — this is the refresh-rate fix: the
    //   trip lasts CRANE_VARIANTS[].dur ms at any monitor Hz.
    _tickCrane(ctx, dtMs) {
      if (this._travelSeq) { this._tickTravel(ctx); return; }   // seamless travel sequence owns its own phases
      // 'arm': a single static departure frame has now rendered; run the deferred destination
      // build here (off the first motion frame) and begin the timed pan.
      if (this._descPhase === 'arm') { this._armCrane(); return; }
      if (this._descPhase !== 'pan') return;
      const cfg = craneCfg();
      const dur = this._craneDur();
      if (dtMs != null) {                                          // bot / hidden path: advance by the given step
        this._craneProg = (this._craneProg || 0) + (dtMs / dur);
      } else {                                                    // rAF path: wall-clock elapsed
        const now = nowMs();
        if (!this._craneT0) this._craneT0 = now;
        this._craneProg = (now - this._craneT0) / dur;
      }
      const p = Math.min(1, Math.max(0, this._craneProg || 0));
      const depth = this._craneDepth || 0;
      const fromY = this._craneFromY || 0;
      const e = this._ease(p);
      if (typeof camera !== 'undefined') {
        camera.y = fromY + depth * e;                              // departure -> destination framing
        // Drift camera.x from the departure column onto the destination's tee↔cup framing.
        // Secret cranes ease over the tail (xFrac 0.5 — the drill stays vertical the first half);
        // planet travel eases across the WHOLE pan (xFrac 1 — a diagonal reads as flight).
        const xf = this._craneXFrac || 0.5;
        const xt = this._ease(Math.max(0, (p - (1 - xf)) / xf));
        if (this._craneCamTargetX != null) {
          let cx = this._craneCamStartX + (this._craneCamTargetX - this._craneCamStartX) * xt;
          // Optional bowed arc (variant feel): a parabolic sideways bulge that peaks mid-pan and
          // returns to 0 by the end, so the line of flight curves instead of running dead-straight.
          if (cfg.xArc) cx += cfg.xArc * Math.sin(Math.PI * e) * (this._craneXFrac >= 1 ? 1 : 0);
          camera.x = cx;
        }
      }
      if (typeof ball !== 'undefined') {
        // ONE unified ride (bug 3): a single eased blend from the rest SCREEN-y to the destination
        // tee's SCREEN-y over the whole pan. No separate head/tail curves to seam together — and
        // because it is the SAME ease as the camera, the ball tracks the shaft with no kink. The
        // landing screen-y is the destination ball-y relative to its (sunk) framing.
        const sy0 = (this._craneStartBallY != null) ? this._craneStartBallY : H * 0.46;
        const syDest = (this._craneDestBallY != null ? this._craneDestBallY : (fromY + depth)) - (fromY + depth);
        const sy = sy0 + (syDest - sy0) * e;
        ball.x = this._craneRideX; ball.y = camera.y + sy;
        ball.vx = 0; ball.vy = 0; ball.atRest = false; ball.onGround = false;
      }
      // Travel-only DEPTH layer (variant 'parallax'): far stars drift SLOWER than the camera so the
      // empty crossing gains a sense of vast distance — captivation from depth, not a different cubic.
      // ctx is absent on the headless/hidden bot path (dtMs set); skip there (pure cosmetic).
      if (ctx && this._craneIsTravel()) {
        if (cfg.space) this._drawCraneSpace(ctx, p);                 // the cinematic space crossing (default travel)
        else if (cfg.parallax) this._drawCraneParallax(ctx, p, e);   // legacy far-starfield variant
      }
      if (p >= 1) {                                                // arrived
        if (typeof camera !== 'undefined') { camera.y = fromY + depth; if (this._craneCamTargetX != null) camera.x = this._craneCamTargetX; }
        if (typeof ball !== 'undefined') { ball.x = this._craneDestBallX; ball.y = this._craneDestBallY; ball.vx = 0; ball.vy = 0; ball.atRest = true; ball.onGround = true; }
        this._descPhase = 'none';
        this._panBand = null;
        this.descending = false;
        this._craneProg = 0; this._craneT0 = 0;
        if (typeof state !== 'undefined') state = STATE_AIM;
      }
    },
    // Travel-only parallax depth field (variant 'parallax'). A deterministic scatter of far stars
    // (via _faultHash — NEVER the terrain PRNG) that drift across the screen SLOWER than the camera
    // pans, so the empty grey crossing reads as vast distance crossed rather than a flat curtain. The
    // camera moves `depth*e` world-px vertically over the pan; the stars move a small FRACTION of the
    // ON-SCREEN equivalent, parallaxed by per-star depth, so nearer ones slip a touch faster. Two
    // soft fades (in at the start, out at arrival) keep them from popping. Render-only, screen-space,
    // peels off cleanly; e (the eased progress) ties their drift to the SAME curve as the pan so an
    // asymmetric ease would carry them correctly too.
    _drawCraneParallax(ctx, p, e) {
      // Fade in over the first ~12% and out over the last ~18% so stars never hard-cut on/off.
      const fIn = Math.min(1, p / 0.12), fOut = Math.min(1, (1 - p) / 0.18);
      const env = Math.max(0, Math.min(fIn, fOut));
      if (env <= 0) return;
      // The screen-space distance the camera has "travelled" this pan (used to slide the field).
      const camTravel = (this._craneDepth || 0) * e;   // world-px panned so far (signed by direction)
      ctx.save();
      const N = 56;
      for (let i = 0; i < N; i++) {
        const h = this._faultHash((((i + 7) * 2654435761) ^ 0x5be) >>> 0);
        // Per-star fixed screen anchor + a depth in [0.18..0.62]: deeper (smaller) = slower drift.
        const baseX = (h % 1000) / 1000 * W;
        const baseY = ((h >>> 10) % 1000) / 1000 * H;
        const depthF = 0.18 + ((h >>> 20) % 100) / 100 * 0.44;
        // Drift OPPOSITE the camera's vertical pan, scaled by depth (slower than the world's H+depth
        // shift), wrapped into the screen so the field is endless. Up-travel (negative depth) slides
        // stars down past you; down-travel slides them up — the crossing has motion to register.
        let sy = baseY - (camTravel * depthF * 0.12);
        sy = ((sy % H) + H) % H;                         // wrap [0,H)
        // A hair of horizontal slip too, parallaxed off the bow, so the curve reads against them.
        const sx = ((baseX + (this._craneCamStartX - (typeof camera !== 'undefined' ? camera.x : 0)) * depthF * 0.5) % W + W) % W;
        const r = 0.8 + depthF * 1.6;                    // nearer (bigger depthF) = a touch larger
        ctx.globalAlpha = env * (0.10 + depthF * 0.34);  // deeper = fainter
        ctx.fillStyle = '#dfe8ff';
        ctx.fillRect(sx, sy, r, r);
      }
      ctx.restore();
    },
    // Flat planet palette per course (the departed + destination worlds drawn as discs mid-crossing).
    _planetSkin(courseId) {
      if (courseId === 'moon') return { col: '#9aa0ab', cre: '#c6ccd6' };       // grey regolith Moon
      if (courseId === 'run-course') return { col: '#b8543a', cre: '#d98b6e' }; // rust Mars
      return { col: '#5f7aa8', cre: '#bcccea' };                                // blue Earth (default)
    },
    // The SPACE CROSSING (planet travel only). Between the launch (surface scrolling away) and the
    // landing (destination terrain rising in), the empty middle becomes real space: a dark void +
    // a drifting starfield, the DEPARTED planet shrinking + receding, the DESTINATION planet growing
    // as you approach, and the ball/ship riding across. Screen-space overlay drawn from _tickCrane
    // (after the world pass), enveloped to 0 at both ends so the terrain bookends read as gameplay.
    // Peel-off: render-only, never touches physics/PRNG; gated to _craneIsTravel().
    _drawCraneSpace(ctx, p) {
      if (!ctx || !this._craneIsTravel()) return;
      const _cfg = craneCfg();
      if (_cfg && _cfg.spaceStyle === 'approach') { this._drawCraneApproach(ctx, p); return; }
      const env = Math.max(0, Math.min(Math.min(1, (p - 0.03) / 0.12), Math.min(1, (0.95 - p) / 0.15)));
      if (env <= 0.001) return;
      const lerp = function (a, b, u) { return a + (b - a) * u; };
      const eo = function (u) { return 1 - Math.pow(1 - (u < 0 ? 0 : u > 1 ? 1 : u), 3); };
      const up = (this._craneDepth || 0) < 0;                 // launching to a higher world (Earth->Moon)
      const eP = this._ease(p);
      const departSkin = this._planetSkin(this._craneDepartCourse || 'earth-course');
      const destSkin = this._planetSkin(this.course || 'moon');
      ctx.save();
      // 1) the void — darkens toward true space mid-crossing
      ctx.globalAlpha = env * 0.94; ctx.fillStyle = '#070a12'; ctx.fillRect(0, 0, W, H);
      // 2) a deterministic starfield drifting opposite the pan (never the terrain PRNG)
      const camTravel = (this._craneDepth || 0) * eP;
      for (let i = 0; i < 90; i++) {
        const h = this._faultHash((((i + 3) * 2654435761) ^ 0x5be) >>> 0);
        const bx = (h % 1000) / 1000 * W;
        let by = ((h >>> 10) % 1000) / 1000 * H;
        const d = 0.2 + ((h >>> 20) % 100) / 100 * 0.6;
        by = (((by - camTravel * d * 0.10) % H) + H) % H;
        const r = 0.7 + d * 1.6;
        ctx.globalAlpha = env * (0.26 + d * 0.5); ctx.fillStyle = '#dfe8ff';
        ctx.fillRect(bx, by, r, r);
      }
      // 3) the two planets — a flat disc + a lit crescent
      const planet = function (cx, cy, r, skin, a) {
        if (a <= 0.01 || r <= 1) return;
        ctx.globalAlpha = a; ctx.fillStyle = skin.col;
        ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = a * 0.5; ctx.fillStyle = skin.cre;
        ctx.beginPath(); ctx.ellipse(cx - r * 0.30, cy - r * 0.30, r * 0.60, r * 0.46, -0.5, 0, Math.PI * 2); ctx.fill();
      };
      const eT = Math.min(1, Math.max(0, (p - 0.16) / 0.42));   // departed planet glimpsed AFTER the launch terrain has gone
      const mT = Math.min(1, Math.max(0, (p - 0.42) / 0.46));   // destination grows  0.42->0.88
      const eA = env * (1 - eT) * 0.9;
      if (up) {   // depart: a blue glimpse low (Earth far below, off the bottom); destination descends in from the top
        planet(W * 0.46, lerp(H * 1.14, H * 1.7, eT), lerp(195, 40, eo(eT)), departSkin, eA);
        planet(W * 0.5, lerp(-40, H * 0.50, mT), lerp(24, 320, eo(mT)), destSkin, env * Math.min(1, mT * 1.4));
      } else {    // returning down: depart a glimpse high; destination rises in from the bottom
        planet(W * 0.46, lerp(-H * 0.14, -H * 0.7, eT), lerp(195, 40, eo(eT)), departSkin, eA);
        planet(W * 0.5, lerp(H + 40, H * 0.50, mT), lerp(24, 320, eo(mT)), destSkin, env * Math.min(1, mT * 1.4));
      }
      ctx.restore();
      // 4) the traveller — the ball/ship riding across, with a faint thrust trail
      if (typeof ball !== 'undefined' && typeof camera !== 'undefined') {
        const sx = ball.x - camera.x, sy = ball.y - (camera.y || 0);
        ctx.save();
        ctx.globalAlpha = env * 0.55; ctx.strokeStyle = '#bcd0ff'; ctx.lineWidth = 2.2; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(sx, sy + (up ? 18 : -18)); ctx.lineTo(sx, sy + (up ? 64 : -64)); ctx.stroke();
        ctx.globalAlpha = Math.min(1, env + 0.25); ctx.fillStyle = '#eef2f6';
        ctx.beginPath(); ctx.arc(sx, sy, 6, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      }
    },
    // THE REDESIGN crossing (spaceStyle 'approach', ?crane=4/5). Fixes the "moon floor pops in over
    // the moon": the destination is ONE disc that grows by SCALE until it fills the frame and IS the
    // ground — no env fade-OUT, no disc→terrain curtain. The void fades IN only; the disc carries you
    // all the way to the surface, then the live world (same skin) takes over at p>=1 — one hand-off,
    // not a reveal. Ported from the verified clip in docs/exp/course-transition-v2/crane-clips.html.
    _drawCraneApproach(ctx, p) {
      const lerp = function (a, b, u) { return a + (b - a) * u; };
      const cl = function (x) { return x < 0 ? 0 : x > 1 ? 1 : x; };
      // Void OPACITY: fades IN slowly (so the real course you just left visibly recedes first, no cut),
      // holds fully opaque across the crossing (so the real destination terrain/flag never pokes through),
      // then fades OUT at the very tail — revealing the real terrain that's risen into the SAME place the
      // disc occupied. Disc + terrain are the same grey at the same line, so the hand-off is invisible.
      const env = cl((p - 0.05) / 0.18);                          // fade in
      const out = cl((p - 0.88) / 0.12);                          // fade out -> reveal real terrain
      const cover = env * (1 - out);
      if (cover <= 0.001) return;
      const eP = this._ease(p);
      const destSkin = this._planetSkin(this.course || 'moon');
      ctx.save();
      // 1) the void — opaque mid-crossing so nothing from the live world leaks through the crossing
      ctx.globalAlpha = cover; ctx.fillStyle = '#070a12'; ctx.fillRect(0, 0, W, H);
      // 2) deterministic drifting starfield (never the terrain PRNG)
      const camTravel = (this._craneDepth || 0) * eP;
      for (let i = 0; i < 90; i++) {
        const h = this._faultHash((((i + 3) * 2654435761) ^ 0x5be) >>> 0);
        const bx = (h % 1000) / 1000 * W; let by = ((h >>> 10) % 1000) / 1000 * H;
        const d = 0.2 + ((h >>> 20) % 100) / 100 * 0.6;
        by = (((by - camTravel * d * 0.10) % H) + H) % H;
        const r = 0.7 + d * 1.6;
        ctx.globalAlpha = cover * (0.26 + d * 0.5); ctx.fillStyle = '#dfe8ff'; ctx.fillRect(bx, by, r, r);
      }
      const planet = function (cx, cy, r, skin, a) {
        if (a <= 0.01 || r <= 1) return;
        ctx.globalAlpha = a; ctx.fillStyle = skin.col;
        ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
        if (r < W) { ctx.globalAlpha = a * 0.5; ctx.fillStyle = skin.cre; ctx.beginPath(); ctx.ellipse(cx - r * 0.30, cy - r * 0.30, r * 0.60, r * 0.46, -0.5, 0, Math.PI * 2); ctx.fill(); }
      };
      // 3) the destination — ONE disc, EVEN-RATE DOLLY growth (radius + apex on one ease-in that
      //    linearises on-screen coverage, so it never flashes wide), whose apex ENDS exactly at the
      //    ball's real landing screen-y. When the void fades out the real terrain is at that same line.
      const finalCamY = (this._craneFromY || 0) + (this._craneDepth || 0);
      const apexEndY = (this._craneDestBallY != null) ? (this._craneDestBallY - finalCamY + 7) : H * 0.74;
      const gg = cl((p - 0.18) / 0.70);
      const tail = 0.16, bodyTop = 0.80; let E;
      if (gg < 1 - tail) { const u = cl(gg / (1 - tail)); E = bodyTop * Math.pow(u, 2.1); }
      else { const v = cl((gg - (1 - tail)) / tail); const b = Math.max(0, 1 - v); E = lerp(bodyTop, 1, 1 - Math.pow(b, 2.2)); }
      const r = lerp(Math.max(W, H) * 0.006, W * 1.05, E);
      const apex = lerp(H * 0.30, apexEndY, E);
      planet(W * 0.5, apex + r, r, destSkin, cover);
      ctx.restore();
      // 4) the traveller — the real ball's screen position, with a thrust trail that fades as it seats
      if (typeof ball !== 'undefined' && typeof camera !== 'undefined') {
        const sx = ball.x - camera.x, sy = ball.y - (camera.y || 0);
        ctx.save();
        if (p < 0.86) { ctx.globalAlpha = cover * 0.5; ctx.strokeStyle = '#bcd0ff'; ctx.lineWidth = 2.2; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(sx, sy + 16); ctx.lineTo(sx, sy + 56); ctx.stroke(); }
        ctx.globalAlpha = cover; ctx.fillStyle = '#eef2f6';
        ctx.beginPath(); ctx.arc(sx, sy, 6, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      }
    },
    // The surface band: redraw the snapshotted surface terrain with the LIVE camera during a pan, so it
    // scrolls up/off while the destination scrolls in; both close at H+300 -> one continuous sand column.
    _drawShaftBand(ctx) {
      const pb = this._panBand;
      if (!pb || this._descPhase !== 'pan') return;
      // Cross-fade the band away over the pan's tail so the hollow EMERGES around you —
      // with the camera-relative terrain close, the surface fill would otherwise cover the
      // room's cavity all the way down and pop off on the last frame. Progress-based (not a
      // frame count) so the fade tracks the timed pan at any refresh rate: out over the last ~36%.
      const FADE_FROM = 0.64;
      const fade = 1 - this._ease(Math.max(0, ((this._craneProg || 0) - FADE_FROM) / (1 - FADE_FROM)));
      if (fade <= 0) return;
      ctx.save();
      ctx.globalAlpha = fade;
      const sv = (typeof vertices !== 'undefined') ? vertices : null;
      const sh = (typeof holes !== 'undefined') ? holes : null;
      const so = (typeof objects !== 'undefined') ? objects : null;
      const sCur = (typeof currentHole !== 'undefined') ? currentHole : null;
      try {
        if (pb.verts) vertices = pb.verts;
        if (pb.holes) holes = pb.holes;
        if (pb.objs) objects = pb.objs;
        currentHole = pb.hole;
        if (typeof drawTerrainDG === 'function') drawTerrainDG();
        if (typeof drawObjects === 'function') drawObjects();
        const h = holes && holes[pb.hole];
        if (h && typeof drawCupHoleDG === 'function') {
          drawCupHoleDG(h);
          if (typeof drawCupFill === 'function') drawCupFill(h);
          if (typeof drawFlag === 'function' && typeof terrainYAt === 'function') drawFlag(h, terrainYAt);
        }
      } catch (e) { if (window.console) console.warn('shaft band draw threw:', e); }
      finally {
        if (sv) vertices = sv; if (sh) holes = sh; if (so) objects = so; if (sCur != null) currentHole = sCur;
        ctx.restore();
      }
    },
    // Shift the whole live world down by dy (terrain + every cup/tee *Y + the ball) so the
    // undercroft genuinely lives beneath the surface and the camera arrives by panning down.
    _sinkWorld(dy) {
      if (typeof vertices !== 'undefined') for (let i = 0; i < vertices.length; i++) vertices[i].y += dy;
      if (typeof holes !== 'undefined') for (let i = 0; i < holes.length; i++) {
        const h = holes[i];
        for (const k in h) if (Object.prototype.hasOwnProperty.call(h, k) && k.charAt(k.length - 1) === 'Y' && typeof h[k] === 'number') h[k] += dy;
      }
      if (typeof ball !== 'undefined') ball.y += dy;
      // Glue the ship's cached spot to the vertical shift too (mirror of _shiftWorldX).
      const sp = window.RG_secret ? RG_secret('ship') : null;
      if (sp && sp.pos) sp.pos.y += dy;
    },
    // Shared loader for both crane destinations (the Fault's undercroft below, the Sky's loft
    // above): restore pristine, clone+modify the template course, swap it in, reset run state to a
    // 1-hole bonus, fire the knowledge flag + once-per-seed Shard faucet, then sink/raise the whole
    // built world by `depth` so the camera (already at `depth`) frames it with no reversal.
    _craneLandCourse(courseId, tmplRef, depth, knowsFlag, faucetPrefix, dgSalt, label) {
      RG._restoreAll();
      RG.modifiers = RG._resolveMods(RG.mods);
      if (!tmplRef.t) tmplRef.t = JSON.parse(JSON.stringify(WORLDS['run-world'].courses[courseId]));
      var cc = JSON.parse(JSON.stringify(tmplRef.t));
      for (var i = 0; i < RG.modifiers.length; i++) if (RG.modifiers[i].course) RG.modifiers[i].course(cc);
      WORLDS['run-world'].courses[courseId] = cc;
      RG._secretArea = label || null; // which secret area this is (the complete screen reads it)
      RG.descending = false;
      RG.inFault = true;             // reuse the "in a secret bonus area" state (scored like the Fault)
      RG.faultCleared = false;
      RG.inVault = false;
      RG.failed = false;
      RG.isNewBest = false;
      RG.holeCount = cc.holeCount || 1;
      RG.budget = 0;
      RG.holePars = []; RG.holeScores = []; RG._pars = {}; RG._lastSafe = null;
      RG.drops = 0; RG.dropsUsed = 0; RG._dropTo = null;
      RG.finalStrokes = 0; RG.finalHoles = 0;
      for (var j = 0; j < RG.modifiers.length; j++) if (RG.modifiers[j].apply) RG.modifiers[j].apply();
      RG._snapPhysBase();
      if (RG._markKnown) RG._markKnown(knowsFlag);                                // permanent KNOWLEDGE unlock (+ first-find bloom)
      localStorage.setItem('dg-seed', String((RG.seed ^ dgSalt) | 0));
      RG._applyWorldSkin(cc);
      startCourse('run-world', courseId);
      if (typeof ensureHolesAhead === 'function') ensureHolesAhead(RG.holeCount);
      RG._legibleHazards();
      RG._computeRunPar();
      RG._buildHUD();
      if (typeof revealGame === 'function') revealGame();
      if (typeof ensureGameLoop === 'function') ensureGameLoop();
      if (typeof state !== 'undefined') state = STATE_AIM;
      RG._syncHUD();
      // The room really lives at the crane's target offset (±depth from the DEPARTURE world,
      // which itself may be displaced — e.g. a Fault entered from the Moon).
      const targetY = (RG._craneTargetY != null) ? RG._craneTargetY : depth;
      RG._sinkWorld(targetY);
      if (typeof camera !== 'undefined') camera.y = targetY;
    },
    // Divert the run onto the hidden undercroft (DOWN).
    descend() { RG._craneLandCourse('undercroft', _undercroftTmplRef, CRANE_DEPTH, 'rg-knows-fault', 'rg-fault-', 0xfa017, { title: '▾ THE FAULT', tag: 'the fault', sub: 'a course beneath the course' }); },

    // ── The space arc: planet-to-planet travel ─────────────
    // Launch is the crane pointed at the sky. Unlike the Fault (a one-hole bonus room),
    // the destination is a full NORMAL run — startRun, recap, New Run loop, secrets and
    // all — installed displaced so the trip is one continuous pan, no cut.
    _craneToCourse(courseId, depth) {
      this._beginCrane(depth, (typeof ball !== 'undefined') ? ball.x : 0, function () {
        RG.startRun({ course: courseId, seed: RG.rollSeed() });
        const targetY = (RG._craneTargetY != null) ? RG._craneTargetY : depth;
        RG._sinkWorld(targetY);
        if (typeof camera !== 'undefined') camera.y = targetY;
      });
      this._craneXFrac = 1;   // travel flies diagonally — x eases over the whole trip (+ optional bowed arc)
    },
    // The whole ship, rested beside -> up. (ship.js calls this.)
    launchToMoon() {
      if (this.descending || this.course === 'moon') return;
      try { localStorage.setItem('rg-knows-moon', '1'); } catch (e) {}
      this._beginTravel('moon', 'descend');                  // the seamless planetary-travel sequence (no ship-repair gate)
    },
    // The Earth glyph on the Moon's recap -> down, home.
    returnToEarth() {
      if (this.descending || this.course !== 'moon') return;
      this._beginTravel('earth-course', 'descend');
    },
    // Dev/test (?seq): travel to the OTHER planet regardless of ship/guard state, so the real
    // in-engine transition can be A/B'd by sinking any hole. Earth⇄Moon ping-pong. Variants 6/7
    // use the seamless rise→hold→descend sequence; older variants use the monotonic crane.
    _seqTravel() {
      if (this.descending || !this.active) return;
      var cfg = craneCfg();
      var dest = (this.course === 'moon') ? 'earth-course' : 'moon';
      if (cfg.travelSeq) this._beginTravel(dest, cfg.arrival);
      else this._craneToCourse(dest, (this.course === 'moon') ? CRANE_DEPTH : -CRANE_DEPTH);
    },

    // ── SEAMLESS TRAVEL SEQUENCE (variants 6/7) ──────────────────────────────────────────────
    // One felt journey, all real engine: normal sink → ball lifts straight up off the real ground
    // (ground exits the bottom by CAMERA MOTION — no fade) → gated deep-space hold (summary + TRAVEL,
    // stars streaming so it reads as cruising) → on tap, the world swaps OFF-SCREEN in the void (the
    // load hitch is masked by the pause), then the camera DESCENDS/arrives onto the REAL destination
    // terrain (which rises in by motion — no fake surface, no fade while terrain is on screen).
    _beginTravel(courseId, arrival) {
      if (this.descending || this.inFault || this.inVault || !this.active) return;
      var C0 = (typeof camera !== 'undefined') ? (camera.y || 0) : 0;
      this._travelSeq = {
        courseId: courseId, arrival: arrival || 'descend', departCourse: this.course,
        landStyle: (typeof this._landStyle === 'number') ? this._landStyle : 3,   // main-game default: 3 = hover + dust (designer pick); ?seq 1-5 overrides
        C0: C0, CHOLD: C0 - H * 1.5,
        camStartX: (typeof camera !== 'undefined') ? camera.x : 0,
        rideX: (typeof ball !== 'undefined') ? ball.x : 0,
        ballFromY: ((typeof ball !== 'undefined') ? ball.y : (C0 + H * 0.6)) - C0,   // cup rest, screen-y
        cruiseY: H * 0.40,
        settleUntil: nowMs() + 700,           // a normal-sink beat before the lift (a held last look)
        swapped: false, go: false, streamPhase: 0,
        CEND: null, destBallX: null, destBallY: null, landY: null, camTargetX: null,
      };
      this.descending = true;
      this._descPhase = 'rise';
      this._craneProg = 0; this._craneT0 = 0; this._landT0 = 0; this._craneXFrac = 1;
      if (typeof ball !== 'undefined') { ball.atRest = false; ball.onGround = false; ball.vx = 0; ball.vy = 0; ball.x = this._travelSeq.rideX; ball.y = C0 + this._travelSeq.ballFromY; }
      if (typeof camera !== 'undefined') { camera.y = C0; camera.x = this._travelSeq.camStartX; }
      if (typeof state !== 'undefined') state = STATE_FLIGHT;
    },
    _travelTap() { if (this._travelSeq && this._descPhase === 'thold') this._travelSeq.go = true; },
    // The world swap — happens in the void (no terrain on screen), so the camera reframe + load hitch
    // are invisible. Places the destination so camera.y=CEND frames it; descend drives camera→CEND.
    _travelSwap() {
      var T = this._travelSeq; if (!T || T.swapped) return;
      if (typeof showTitle !== 'undefined') showTitle = false;
      RG.startRun({ course: T.courseId, seed: RG.rollSeed() });
      var natCY = (typeof camera !== 'undefined') ? (camera.y || 0) : 0;
      // SEAMLESS LANDING: the descend lands exactly in the natural play frame (camera.y = natCY) with the
      // world left at its natural height — the set-down reveals it purely by the camera lowering from CHOLD,
      // so the hand-off to play needs NO snap (no camera.y or starfield pop). Only 'over' (moon-from-above,
      // unused by the solar tour) still displaces the world. (Old: descend landed at C0+0.3H and sank the
      // world ~162px to match, which forced a camera.y→0 pop — and a starfield pop — on the first
      // hole-to-hole transition.)
      var CEND = (T.arrival === 'over') ? (T.CHOLD - H * 1.45) : natCY;
      var sink = CEND - natCY;                          // descend → 0 (no sink, nothing to un-pop); 'over' → displaces as before
      if (sink) RG._sinkWorld(sink);
      T.sunkBy = sink;
      T.natCY = natCY;
      var bx = (typeof ball !== 'undefined') ? ball.x : 0;
      RG._shiftWorldX(T.rideX - bx);                    // tee under the travelling column
      T.CEND = CEND;
      T.destBallX = (typeof ball !== 'undefined') ? ball.x : T.rideX;
      T.destBallY = (typeof ball !== 'undefined') ? ball.y : CEND;
      T.landY = T.destBallY - CEND;                     // ball screen-y at landing
      var dh = (typeof holes !== 'undefined') && holes[0];
      T.camTargetX = (dh && dh.cupX != null) ? ((dh.teeX + dh.cupX) / 2 - W / 2) : T.camStartX;
      if (typeof camera !== 'undefined') { camera.y = T.CHOLD; camera.x = T.camStartX; }   // park; descend drives it
      RG.descending = true;                             // startRun cleared the gate — re-assert
      if (typeof state !== 'undefined') state = STATE_FLIGHT;
      T.swapped = true;
    },
    _tickTravel(ctx) {
      var T = this._travelSeq; if (!T) return;
      var now = nowMs();
      var LS = T.landStyle || 0;                            // landing flavour (TRAVEL_LAND): 0 coast · 1 feather · 2 flare
      var prof = (T.arrival === 'over') ? { dur: 1600, ease: EASE.inOutSine } : (TRAVEL_LAND[LS] || TRAVEL_LAND[0]);
      var RISE_DUR = 1700, DESC_DUR = prof.dur;
      if (this._descPhase === 'rise') {
        if (now < T.settleUntil) {                      // normal-sink beat: ball rests in the cup, ground fully shown
          if (typeof camera !== 'undefined') { camera.y = T.C0; camera.x = T.camStartX; }
          if (typeof ball !== 'undefined') { ball.x = T.rideX; ball.y = T.C0 + T.ballFromY; }
          this._drawTravelSky(ctx, 'settle', 0);         // keep the departure sky/stars so the sink reads exactly like normal play
          return;
        }
        if (!this._craneT0) this._craneT0 = now;
        var rp = Math.min(1, (now - this._craneT0) / RISE_DUR);
        var re = EASE.inOutSine(rp);
        if (typeof camera !== 'undefined') { camera.y = T.C0 + (T.CHOLD - T.C0) * re; camera.x = T.camStartX; }
        if (typeof ball !== 'undefined') { ball.x = T.rideX; ball.y = camera.y + (T.ballFromY + (T.cruiseY - T.ballFromY) * re); ball.vx = 0; ball.vy = 0; ball.atRest = false; ball.onGround = false; }
        this._drawTravelSky(ctx, 'rise', 0);
        this._drawTravelBall(ctx, Math.min(1, rp * 4));   // retro-thrust ignites in smoothly off the launch (no pop)
        if (rp >= 1) { this._descPhase = 'thold'; this._craneT0 = now; }
      } else if (this._descPhase === 'thold') {
        if (typeof camera !== 'undefined') { camera.y = T.CHOLD; camera.x = T.camStartX; }
        var held = now - this._craneT0; T.streamPhase += 7;
        if (typeof ball !== 'undefined') { ball.x = T.rideX; ball.y = T.CHOLD + T.cruiseY + Math.sin(held * 0.0022) * 4; ball.vx = 0; ball.vy = 0; }
        this._drawTravelSky(ctx, 'hold', held);
        this._drawTravelSummary(ctx, held);
        this._drawTravelBtn(ctx, held);
        this._drawTravelBall(ctx);
        // Autoplay should CONVEY the journey, not skip it: hold on the "TRAVEL TO X" screen ~1.1s, then
        // auto-"click" travel and descend onto the planet naturally. Headless (!ctx — the harness/recorder)
        // still proceeds immediately so it never hangs on the gate. A human tap (T.go) goes immediately.
        var auto = (typeof window.aiEnabled !== 'undefined' && window.aiEnabled);
        if (T.go || !ctx || (auto && held > 1100)) { this._travelSwap(); this._descPhase = 'descend'; this._craneT0 = now; T.streamPhase = 0; }
      } else if (this._descPhase === 'descend') {
        if (!this._craneT0) this._craneT0 = now;
        var dp = Math.min(1, (now - this._craneT0) / DESC_DUR);
        if (dp < 1) {
          var de = prof.ease(dp);                           // ONE continuous, decelerating set-down — velocity → 0 at the surface
          var cx0 = (T.camTargetX != null ? T.camTargetX : T.camStartX);
          if (typeof camera !== 'undefined') { camera.y = T.CHOLD + (T.CEND - T.CHOLD) * de; camera.x = T.camStartX + (cx0 - T.camStartX) * de; }
          if (typeof ball !== 'undefined') {
            ball.x = T.rideX + ((T.destBallX != null ? T.destBallX : T.rideX) - T.rideX) * de;
            ball.y = camera.y + (T.cruiseY + (T.landY - T.cruiseY) * de); ball.vx = 0; ball.vy = 0; ball.atRest = false; ball.onGround = false;
          }
          this._drawTravelSky(ctx, 'descend', dp);
          this._drawTravelBall(ctx, Math.max(0, 1 - dp * 1.2));   // retro-thrust eases off as you settle onto the surface
          if (prof.dust) { var di = Math.max(0, Math.min(1, (dp - 0.6) / 0.34)); this._drawDownwash(ctx, di * di * (3 - 2 * di), T.courseId); }  // downwash builds as you near the ground
        } else {
          // TOUCHDOWN — the craft is at REST (no motion). Dust set-downs hold a brief beat while the kicked-up dust settles.
          if (typeof camera !== 'undefined') { camera.y = T.CEND; if (T.camTargetX != null) camera.x = T.camTargetX; }
          if (typeof ball !== 'undefined') { ball.x = T.destBallX; ball.y = T.destBallY; ball.vx = 0; ball.vy = 0; ball.atRest = true; ball.onGround = true; }
          this._drawTravelSky(ctx, 'descend', 1);
          this._drawTravelBall(ctx, 0);
          var DSET = prof.dust ? 700 : 0;
          if (!this._landT0) this._landT0 = now;
          var sp = DSET > 0 ? Math.min(1, (now - this._landT0) / DSET) : 1;
          if (prof.dust) this._drawDownwash(ctx, (1 - sp), T.courseId);   // dust settles + fades after touchdown
          if (sp >= 1) {
            // NORMALIZE THE FRAME: the arrival sank the world by T.sunkBy and parked the camera at T.CEND
            // so the surface rose into view. Undo BOTH now — net-zero on screen — so play resumes in the
            // NATURAL frame (camera.y = T.natCY). Without this the world stays sunk while the next
            // hole-to-hole transition resets camera.y→0, dropping the whole hole off the bottom (the
            // Luna hole-2 "all sky" bug).
            if (RG._sinkWorld && T.sunkBy) RG._sinkWorld(-T.sunkBy);
            if (typeof camera !== 'undefined') camera.y = (T.natCY || 0);
            this._descPhase = 'none'; this.descending = false; this._craneProg = 0; this._craneT0 = 0; this._landT0 = 0; this._travelSeq = null; this._panBand = null;
            if (typeof state !== 'undefined') state = STATE_AIM;
          }
        }
      }
    },
    // Space backdrop for the sequence. Painted ONLY when no terrain is on screen (rise gates the
    // fade-in until the ground has left; descend paints no fill so the real terrain rising in is never
    // covered). Base stars share _drawMoonSky's hash so the landing hand-off has zero star flicker.
    // Continuous sky for the travel sequence. Crossfades the DEPARTURE course's REAL sky (its actual
    // starfield + planet) into the ARRIVAL course's REAL sky over the journey, and darkens the middle
    // with a deep-space tint — so neither the sky colour nor the stars ever POP. Endpoints equal the
    // live game's _drawConstellations / _drawMoonSky exactly, so take-off and landing are seamless.
    // The tint is gated on `space` (0 at a planet's sky → 1 in the void) so it never covers terrain.
    _drawTravelSky(ctx, phase, prog, behind) {
      // Draw ONLY from the sky layer (wrap.drawSky, behind the world). The legacy calls from _tickTravel (no
      // `behind` arg) are now no-ops — they painted the stars OVER the departing terrain on take-off. The ball
      // + HUD still draw foreground in _tickTravel; only the sky moved behind. (phase derived from _descPhase.)
      if (!behind) return;
      if (!ctx) return;
      var T = this._travelSeq; if (!T) return;
      var cy = (typeof camera !== 'undefined') ? (camera.y || 0) : 0;
      var space, jT;
      if (phase === 'settle') { space = 0; jT = 0; }
      else if (phase === 'rise') {
        space = Math.max(0, Math.min(1, ((T.C0 - H * 0.45) - cy) / (H * 0.95)));   // ramps up only after the ground has left
        jT = space * 0.5;
      } else if (phase === 'hold') { space = 1; jT = 0.5; }
      else {                                                                       // descend
        var span = (T.CEND - T.CHOLD) || 1;
        var de = Math.max(0, Math.min(1, (cy - T.CHOLD) / span));
        space = Math.max(0, Math.min(1, (1 - de) / 0.42));                         // 1 until the arrival terrain nears, then → 0
        jT = 0.5 + (1 - space) * 0.5;
      }
      function smooth(a, b, t) { t = Math.max(0, Math.min(1, (t - a) / (b - a))); return t * t * (3 - 2 * t); }
      var arrA = smooth(0.2, 0.7, jT);     // arrival sky fades in; departure = its complement (sum ≈ 1, no dark gap)
      var depA = 1 - arrA;
      ctx.save();
      if (space > 0.001) { ctx.globalAlpha = space; ctx.fillStyle = '#05060c'; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; }
      this._drawConstellations(ctx, false, 1 - space);   // UNIVERSAL completed-hole progress stars (the game draws these on EVERY surface course) — present at both surfaces, fade in deep space, so they don't pop in at the landing hand-off
      this._drawCourseStars(ctx, T.departCourse, depA);
      this._drawCourseStars(ctx, T.courseId, arrA);     // T.courseId = DESTINATION course (T.arrival is the variant name, not a course id) — so the arrival world's own starfield fades IN during the descent instead of popping in at landing
      // STREAMING MOTION — the ship is cruising. A SEPARATE fast-drifting streak field (distinct hash
      // from the static stars) flowing one way, faded by `space` so it eases in/out with deep space (no
      // pop) and is gone by landing (so it never disturbs the static landing starfield). Edge-fades top
      // & bottom so streaks don't pop at the wrap. Peaks in the gated hold = lively, real space travel.
      if (space > 0.02) {
        var ph = nowMs() * 0.17;                                   // continuous downward drift (wall-clock, render-only)
        for (var m = 0; m < 72; m++) {
          var sh = this._faultHash((((m + 31) * 2654435761) ^ 0x77) >>> 0);
          var sx = (sh % 1000) / 1000 * W;
          var lay = 0.35 + ((sh >>> 20) % 100) / 100 * 0.65;       // parallax depth: nearer = faster + longer
          var sy = ((((sh >>> 10) % 1000) / 1000 * H) + ph * lay) % H;
          var ef = Math.max(0, Math.min(1, sy / 60)) * Math.max(0, Math.min(1, (H - sy) / 80));
          ctx.globalAlpha = space * ef * (0.16 + lay * 0.42);
          ctx.fillStyle = '#cdd6f5';
          ctx.fillRect(sx, sy, 1.1, 2 + lay * 9);
        }
        ctx.globalAlpha = 1;
      }
      // The RECENTLY-PLAYED planet (the world you just left) hangs in the sky during the crossing: it slides
      // IN from offscreen-top as you climb away from it (rise), holds dead-steady through the cruise, then
      // slides back OUT the top as you near the world you land on (descend) — so it FLIES on + off by motion,
      // never fading/popping at a fixed point, and you never see a planet at the world you're landing on.
      // Coloured per the departure planet's own surface (was hardcoded to the Earth glyph + an Earth↔Moon-only
      // easing branch left over from the 2-body game, so every transition wrongly showed the same blue Earth).
      var onSky = smooth(0.20, 0.50, jT) * (1 - smooth(0.55, 0.85, jT));  // 0→1 on the climb, hold, 1→0 on the descent
      var pe = onSky * onSky * (3 - 2 * onSky);
      var prest = H * 0.18, py = -70 + (prest + 70) * pe;
      if (py > -36) this._drawPlanetGlyph(ctx, W * 0.16, py, 17, this._courseGlyphColor(T.departCourse), 1);   // the world you left — appears by MOTION, not a fade
      ctx.restore();
    },
    // A course's REAL sky-stars at a fade multiplier — the same functions the live game uses. The Earth
    // glyph is SKIPPED here (drawn separately, steady) so it can't ride the star crossfade and pop.
    _drawCourseStars(ctx, courseId, aMul) {
      if (aMul <= 0.001) return;
      // Only the MOON has a course-specific sky starfield (dense + Apollo balls). Earth's only stars are
      // the completed-hole progress constellations, which are UNIVERSAL and drawn once in _drawTravelSky
      // (not here) — so they never crossfade out and pop back at the landing hand-off.
      if (courseId === 'moon') this._drawMoonSky(ctx, aMul, true);
    },
    // Draw the traveller. The BALL is the engine's OWN drawBall() under the real camera transform — the
    // SAME asset the game renders, so it never "transforms" into a different ball at launch/landing. The
    // only addition is a retro-thrust exhaust below it (an additive effect that fades in/out smoothly).
    _drawTravelBall(ctx, thrustA) {
      if (!ctx || typeof ball === 'undefined' || typeof MODE === 'undefined' || !MODE.applyCameraTransform || typeof drawBall !== 'function') return;
      var ta = (thrustA == null) ? 1 : thrustA;
      var r0 = (typeof BALL_RADIUS !== 'undefined') ? BALL_RADIUS : 6;
      ctx.save();
      MODE.applyCameraTransform(ctx);
      if (ta > 0.02) for (var j = 1; j <= 6; j++) { ctx.globalAlpha = (0.22 - j * 0.03) * ta; ctx.fillStyle = '#e8b878'; ctx.beginPath(); ctx.arc(ball.x, ball.y + j * r0 * 1.15, Math.max(0.5, r0 * (0.72 - j * 0.09)), 0, Math.PI * 2); ctx.fill(); }
      ctx.globalAlpha = 1;
      drawBall();                                         // identical to gameplay — no asset swap
      ctx.restore();
    },
    // Engine DOWNWASH: surface dust kicked up + blown sideways by the retro-thrust as the craft nears the
    // ground. Originates at the LANDING ground point (not the airborne ball), billows out + rises + fades.
    // Continuous, procedural (no stored particles); intensity is driven by the caller (ramps in on approach,
    // fades out as it settles). Dust colour matches the surface (moon regolith vs earth tan).
    _drawDownwash(ctx, intensity, courseId) {
      if (!ctx || intensity <= 0.01 || typeof ball === 'undefined' || typeof camera === 'undefined') return;
      var T = this._travelSeq; var r0 = (typeof BALL_RADIUS !== 'undefined') ? BALL_RADIUS : 4;
      var ox = ((T && T.destBallX != null) ? T.destBallX : ball.x) - camera.x;
      var oy = ((T && T.destBallY != null) ? T.destBallY : ball.y) - (camera.y || 0) + r0 + 1;
      var col = (courseId === 'moon') ? '#c6ccd6' : '#cbb78a';
      var t = nowMs() * 0.0013;
      ctx.save();
      for (var i = 0; i < 24; i++) {
        var seed = (i * 0.1037) % 1;
        var age = (t * (0.6 + (i % 5) * 0.12) + seed) % 1;       // 0→1 lifecycle, staggered per particle
        var side = (i % 2 ? 1 : -1);
        var px = ox + side * age * (14 + (i % 6) * 9);
        var py = oy - age * (4 + (i % 4) * 3) - Math.sin(age * Math.PI) * 3;
        var sz = 1.2 + age * (3 + (i % 3));
        ctx.globalAlpha = intensity * (1 - age) * 0.34;
        ctx.fillStyle = col;
        ctx.beginPath(); ctx.arc(px, py, sz, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
    },
    // Generic course-summary card (placeholder values; not glued to a scorecard design).
    _drawTravelSummary(ctx, held) {
      if (!ctx) return;
      var a = Math.min(1, held / 240); if (a <= 0.01) return;
      var w = 260, h = 110, x = W / 2 - w / 2, y = H * 0.20;
      var _cs = (typeof WORLDS !== 'undefined' && WORLDS['run-world']) ? WORLDS['run-world'].courses : null;
      var _dep = this._travelSeq && this._travelSeq.departCourse;
      var from = (_cs && _dep && _cs[_dep] && _cs[_dep].name) ? _cs[_dep].name.toUpperCase()
        : ((this._travelSeq && this._travelSeq.courseId === 'moon') ? 'EARTH' : 'THE MOON');
      ctx.save(); ctx.globalAlpha = a;
      ctx.fillStyle = 'rgba(14,12,22,0.55)'; ctx.fillRect(x, y, w, h);
      ctx.textAlign = 'left'; ctx.fillStyle = '#cdd6f5'; ctx.font = '13px "Departure Mono",monospace'; ctx.fillText('COURSE COMPLETE · ' + from, x + 18, y + 26);
      ctx.fillStyle = '#7ad17a'; ctx.font = '30px "Departure Mono",monospace'; ctx.fillText('-4', x + 18, y + 64);
      ctx.fillStyle = '#e6b84a'; ctx.font = '14px "Departure Mono",monospace'; ctx.fillText('+$37', x + 18, y + 94);
      ctx.fillStyle = '#9aa0ab'; ctx.textAlign = 'right'; ctx.fillText('9 / 9 cups', x + w - 18, y + 94);
      ctx.restore();
    },
    _drawTravelBtn(ctx, held) {
      if (!ctx) return;
      var a = Math.min(1, (held - 120) / 240); if (a <= 0.01) return;
      var _cd = (typeof WORLDS !== 'undefined' && WORLDS['run-world']) ? WORLDS['run-world'].courses : null;
      var _dst = this._travelSeq && this._travelSeq.courseId;
      var dest = (_cd && _dst && _cd[_dst] && _cd[_dst].name) ? _cd[_dst].name.toUpperCase()
        : ((this._travelSeq && this._travelSeq.courseId === 'moon') ? 'MOON' : 'EARTH');
      var w = 168, h = 34, x = W / 2 - w / 2, y = H - 96, hot = (Math.floor(held / 460) % 2) === 0;
      ctx.save(); ctx.globalAlpha = a;
      ctx.fillStyle = hot ? '#e8a93a' : 'rgba(120,130,170,0.18)';
      ctx.strokeStyle = 'rgba(180,190,230,0.55)'; ctx.lineWidth = 1; ctx.fillRect(x, y, w, h); ctx.strokeRect(x, y, w, h);
      ctx.fillStyle = hot ? '#2a1f08' : '#cdd6f5'; ctx.font = '14px "Departure Mono",monospace'; ctx.textAlign = 'center';
      ctx.fillText('▸ TRAVEL TO ' + dest, W / 2, y + 22);
      ctx.restore();
    },

    // Moon ambience (render-only): a denser fixed starfield, a small half-lit Earth in
    // the black — home, visibly far — and, short of the first tee, two tiny white dots:
    // The Moon's sky: a deterministic (non-twinkling) starfield + the small blue Earth glyph (home).
    _drawMoonSky(ctx, aMul, skipEarth) {
      var AM = (aMul == null) ? 1 : aMul; if (AM <= 0.001) return;
      ctx.save();
      for (let i = 0; i < 70; i++) {                       // deterministic scatter
        const h = this._faultHash(((i + 1) * 2654435761) >>> 0);
        const x = (h % 1000) / 1000 * W, y = ((h >>> 10) % 1000) / 1000 * H * 0.7;
        let baseA = 0.10 + ((h >>> 20) % 30) / 100;
        if (this._twinkle >= 1) {                          // glisten (else a fixed field)
          const tw = 0.6 + 0.4 * Math.sin(this._starT * (0.02 + (i % 5) * 0.006) + i * 1.7);   // gentle, slow
          baseA *= (0.72 + 0.5 * tw);
          const g = Math.sin(this._starT * 0.006 + i * 2.7); if (g > 0.97) baseA += (g - 0.97) * 0.8;   // rare, soft
        }
        ctx.globalAlpha = baseA * AM;
        ctx.fillStyle = '#dfe8ff';
        ctx.fillRect(x, y, 1.4, 1.4);
      }
      if (!skipEarth) this._drawEarthGlyph(ctx, W * 0.16, H * 0.18, 17, AM);   // home, far off (shared so the travel hand-off can't pop)
      // (Apollo 14 easter-egg golf balls removed per designer — too small to read as golf balls,
      //  more confusing than charming. Restore from git history if we ever revisit it.)
      ctx.restore();
    },
    // The small blue Earth, lit from the upper-left with a NATURAL day/night terminator (a clipped lit
    // disc gives a clean gibbous, not a hard bite). Shared by _drawMoonSky and the travel sequence so
    // the planet is byte-identical at the hand-off — it can never "pop into place".
    _drawEarthGlyph(ctx, ex, ey, r, AM) {
      AM = (AM == null) ? 1 : AM; if (AM <= 0.001) return;
      ctx.save();
      ctx.beginPath(); ctx.arc(ex, ey, r, 0, Math.PI * 2); ctx.clip();
      ctx.globalAlpha = 0.95 * AM; ctx.fillStyle = '#16294a';                 // night side (deep ocean shadow)
      ctx.fillRect(ex - r, ey - r, r * 2, r * 2);
      ctx.globalAlpha = 0.95 * AM; ctx.fillStyle = '#3a6fb0';                 // lit day side — offset disc → soft terminator
      ctx.beginPath(); ctx.arc(ex - r * 0.40, ey - r * 0.30, r * 1.02, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 0.32 * AM; ctx.fillStyle = '#d7ece2';                 // a wisp of cloud/land on the lit side
      ctx.beginPath(); ctx.ellipse(ex - r * 0.34, ey - r * 0.06, r * 0.5, r * 0.2, -0.35, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    },
    // A generic lit planet disc (the colour-agnostic sibling of _drawEarthGlyph): a clipped disc with a
    // darkened night side + an offset lit day side (soft terminator) + a faint lit-side highlight, all from
    // one base colour. Used by the travel sequence so the sky planet matches whichever world it represents.
    _drawPlanetGlyph(ctx, ex, ey, r, color, AM) {
      AM = (AM == null) ? 1 : AM; if (AM <= 0.001) return;
      color = color || '#7faecf';
      ctx.save();
      ctx.beginPath(); ctx.arc(ex, ey, r, 0, Math.PI * 2); ctx.clip();
      ctx.globalAlpha = 0.95 * AM; ctx.fillStyle = this._shadeHex(color, -0.58);      // night side (darkened)
      ctx.fillRect(ex - r, ey - r, r * 2, r * 2);
      ctx.globalAlpha = 0.95 * AM; ctx.fillStyle = this._shadeHex(color, 0.06);       // lit day side — offset disc → soft terminator
      ctx.beginPath(); ctx.arc(ex - r * 0.40, ey - r * 0.30, r * 1.02, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 0.26 * AM; ctx.fillStyle = this._shadeHex(color, 0.5);        // a wisp of highlight on the lit side
      ctx.beginPath(); ctx.ellipse(ex - r * 0.34, ey - r * 0.06, r * 0.5, r * 0.2, -0.35, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    },
    // A course's representative body colour = its surface material colour (mars→red, an ice world→pale blue…).
    _courseGlyphColor(courseId) {
      try {
        var w = (typeof WORLDS !== 'undefined') && WORLDS['run-world'];
        var c = w && w.courses && w.courses[courseId];
        var m = c && c.defaultMaterial;
        var col = (typeof MATERIALS !== 'undefined') && m && MATERIALS[m] && MATERIALS[m].color;
        return col || '#7faecf';
      } catch (e) { return '#7faecf'; }
    },
    // Lighten (amt>0) / darken (amt<0) a #hex by a fraction → 'rgb(...)'.
    _shadeHex(hex, amt) {
      var h = (hex || '#888888').replace('#', ''); if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
      var r = parseInt(h.substr(0, 2), 16), g = parseInt(h.substr(2, 2), 16), b = parseInt(h.substr(4, 2), 16);
      var f = amt < 0 ? (1 + amt) : 1, add = amt > 0 ? amt * 255 : 0;
      r = Math.max(0, Math.min(255, Math.round(r * f + add)));
      g = Math.max(0, Math.min(255, Math.round(g * f + add)));
      b = Math.max(0, Math.min(255, Math.round(b * f + add)));
      return 'rgb(' + r + ',' + g + ',' + b + ')';
    },

    // A rare, faint shooting star (twinkle level 2) — a "moment" without constant motion. Render-only,
    // self-managing; spawns ~every 12-25s using the frame counter (_starT) as a cheap clock.
    _drawShootingStar(ctx) {
      if ((this._twinkle || 0) < 2) return;
      if (!this._shoot) {
        if (this._starT > (this._shootNext || 300)) {
          const sd = this._faultHash((this._starT * 2654435761) >>> 0);
          this._shoot = { t: 0, dur: 26 + (sd % 16), x: (0.12 + (sd % 1000) / 1000 * 0.6) * W,
            y: (0.05 + ((sd >>> 10) % 1000) / 1000 * 0.32) * H, dx: 5 + (sd % 4), dy: 1.4 + ((sd >>> 5) % 3) * 0.5 };
          this._shootNext = this._starT + 720 + (sd % 780);
        }
        if (!this._shoot) return;
      }
      const s = this._shoot, p = s.t / s.dur, a = Math.sin(p * Math.PI) * 0.55;
      const hx = s.x + s.dx * s.t, hy = s.y + s.dy * s.t;
      const grad = ctx.createLinearGradient(hx, hy, hx - s.dx * 8, hy - s.dy * 8);
      grad.addColorStop(0, 'rgba(223,232,255,' + a.toFixed(3) + ')');
      grad.addColorStop(1, 'rgba(223,232,255,0)');
      ctx.save(); ctx.strokeStyle = grad; ctx.lineWidth = 1.4; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(hx - s.dx * 8, hy - s.dy * 8); ctx.stroke(); ctx.restore();
      if (++s.t > s.dur) this._shoot = null;
    },
    // The on-course score readout (default). Canvas, top-left, drawn in the SAME Departure Mono sizes
    // as the engine course title (28/20/16) so the title -> readout hand-off is seamless and the whole
    // HUD reads as one font. Defers to the title on hole 1 until the first strike, then takes over the
    // same spot. Replaces the old dead-centered counter (suppressed via _hideStrokeCounter). The values
    // are the same as before (round total + this-hole strokes), just relocated + font-matched.
    _drawScoreHUD(ctx) {
      if (this._scoreStyle === 'center') return;
      if (!this.active || this.inFault || this.inVault || this.descending) return;
      if (typeof state !== 'undefined' && typeof STATE_COMPLETE !== 'undefined' && state === STATE_COMPLETE) return;
      if (typeof showTitle !== 'undefined' && showTitle && (typeof currentHole !== 'undefined') && currentHole === 0) return;
      const idx = (typeof currentHole !== 'undefined') ? currentHole : 0;
      const count = this.holeCount || 9;
      const holeNo = Math.min(idx + 1, count);
      const par = this.parForHole ? this.parForHole(idx) : null;
      ctx.save();
      ctx.textAlign = 'left';
      ctx.fillStyle = '#ffffff';
      ctx.font = "28px 'Departure Mono', monospace";
      ctx.fillText('HOLE ' + holeNo + ' / ' + count, 20, 34);
      if (par != null) {
        ctx.font = "20px 'Departure Mono', monospace"; ctx.fillStyle = 'rgba(255,255,255,0.55)';
        ctx.fillText('PAR ' + par, 20, 58);
      }
      const tot = (typeof totalStrokes !== 'undefined') ? totalStrokes : 0;
      const cur = (typeof strokes !== 'undefined') ? strokes : 0;
      const sy = (par != null) ? 84 : 60;
      let sx = 20;
      if (tot > 0) {
        ctx.font = "22px 'Departure Mono', monospace"; ctx.fillStyle = '#ffffff';
        ctx.fillText(String(tot), sx, sy); sx += ctx.measureText(String(tot)).width + 12;
      }
      if (cur > 0) {
        ctx.font = "16px 'Departure Mono', monospace"; ctx.fillStyle = 'rgba(255,255,255,0.6)';
        ctx.fillText('+' + cur, sx, sy);
      }
      ctx.restore();
    },
    // The distant SKY — completed-hole constellations, the Moon's dense field, a rare shooting star —
    // drawn BEHIND the world (dispatched from wrap.js drawSky) so terrain OCCLUDES it. Screen-space,
    // upper band, so on the surface (terrain is low there) it looks identical; the move only matters on
    // planets whose terrain reaches high on the screen (e.g. a Descent mesa), where stars were painting
    // OVER the ground because this used to run in _drawOverlays / drawHUD (after the world).
    _drawSkyStars(ctx) {
      if (this._descPhase && this._descPhase !== 'none') return;   // a crane descent owns the screen
      if (this.inFault || this.inVault) return;                    // underground: no sky
      this._drawConstellations(ctx);
      if (this.course === 'moon') this._drawMoonSky(ctx);
      this._drawShootingStar(ctx);                                 // rare shooting star (twinkle level 2)
    },
    // Per-frame canvas overlays for the active hole's condition: a persistent wind
    // arrow + a fading one-word telegraph. Plain holes draw nothing.
    _drawOverlays(ctx) {
      // During a Fault descent the crane owns the screen — draw only it (and keep its phase
      // machine ticking through the post-swap settle, which `descending` no longer covers).
      if (this._descPhase && this._descPhase !== 'none') { this._tickCrane(ctx); return; }
      // NB: ambient sky treatments now draw BEHIND the world from wrap.js drawSky (so bands/body
      // never paint over the flag or an airborne ball). They are NOT drawn here anymore.
      if (window.RG_ONBOARD) RG_ONBOARD.draw(ctx);                          // first-run nudges: sky / wake / reach / glint (peel-off-able; onboard.js; OFF by default)
      // (the distant sky — constellations / moon field / shooting star — now draws BEHIND the world via
      //  _drawSkyStars from wrap.js drawSky, so high terrain occludes it instead of stars over a mesa)
      const idx = (typeof currentHole !== 'undefined') ? currentHole : 0;
      const c = this.holeConds[idx];
      if (c) { const def = condDef(c.key); if (def && def.draw) def.draw(ctx, c); }
      if (this._condBanner) this._drawCondBanner(ctx);
      this._secretFrame(ctx);
      this._drawCollectFlash(ctx);           // gold flag-plant when a hole is collected
      this._drawScoreHUD(ctx);               // on-course score readout (corner; replaces the centered counter)
      if (window.RG_ATLAS && RG_ATLAS.frameScreen) RG_ATLAS.frameScreen(ctx);   // atlas screen-space HUD (e.g. long-drive distance bar)
    },
    // Per-frame standalone-secret dispatch. Runs every draw frame (all states), so it doubles
    // as the secrets' update tick. Detects the shot edge (strokes ↑) to fire onShot, then
    // update, then draw (screen space, painted last). Kept in one place so adding a secret is
    // only ever "push one object to RG_SECRETS" — the controller never grows per secret.
    _secretFrame(ctx) {
      if (!(window.RG && window.RG_runSecretHook)) return;
      if (!RG._surfaceRunOnly()) return;   // standalone secrets live on surface runs only
      const sc = (typeof strokes !== 'undefined') ? strokes : 0;
      if (RG._secretStrokes == null) RG._secretStrokes = sc;
      if (sc > RG._secretStrokes) RG_runSecretHook('onShot');
      RG._secretStrokes = sc;
      RG_runSecretHook('update');
      RG_runSecretHook('draw', ctx);
    },
    // A veil with lit holes punched around the ball + cup (your torch — the free
    // counter-tool). Built on an offscreen layer so the world shows through; render-only,
    // so the sand is untouched. DARK = near-black + tight torch; FOG = pale haze + wide.
    _drawVeil(ctx, fill, ballR, cupR) {
      if (!this._veilC || this._veilC.width !== W || this._veilC.height !== H) {
        this._veilC = document.createElement('canvas');
        this._veilC.width = W; this._veilC.height = H;
        this._veilX = this._veilC.getContext('2d');
      }
      const o = this._veilX;
      o.clearRect(0, 0, W, H);
      o.globalCompositeOperation = 'source-over';
      o.fillStyle = fill;
      o.fillRect(0, 0, W, H);
      o.globalCompositeOperation = 'destination-out';
      const cam = (typeof camera !== 'undefined') ? camera.x : 0;
      const punch = function (sx, sy, r) {
        const g = o.createRadialGradient(sx, sy, 0, sx, sy, r);
        g.addColorStop(0, 'rgba(0,0,0,1)');
        g.addColorStop(0.6, 'rgba(0,0,0,0.92)');
        g.addColorStop(1, 'rgba(0,0,0,0)');
        o.fillStyle = g; o.beginPath(); o.arc(sx, sy, r, 0, Math.PI * 2); o.fill();
      };
      if (typeof ball !== 'undefined') punch(ball.x - cam, ball.y, ballR); // the ball's torch
      const h = holes[(typeof currentHole !== 'undefined') ? currentHole : 0];
      if (h) punch(h.cupX - cam, h.cupY, cupR);                           // the cup stays lit
      o.globalCompositeOperation = 'source-over';
      ctx.drawImage(this._veilC, 0, 0);
    },
    _drawDark(ctx) { this._drawVeil(ctx, 'rgba(6,5,12,0.95)', 120, 84); },
    // The Undercroft is a hollow carved INTO rock, not an island floating in sky: solid earth
    // walls close off both ends of the room and a crusty ceiling band caps the top, so the
    // camera can never expose a floating-slab read. Render-only, deterministic per seed,
    // drawn after the live terrain (the surface band still covers it during the crane pan).
    _drawCavern(ctx) {
      if (!this.inFault || typeof camera === 'undefined' || !(camera.y > 0)) return;
      if (typeof vertices === 'undefined' || !vertices.length) return;
      const sand = (typeof MATERIALS !== 'undefined' && MATERIALS.sand && MATERIALS.sand.color) || '#c8884d';
      const seed = this.seed | 0;
      const self = this;
      const jag = function (n, amp) { return ((self._faultHash(((n * 0x9e37) ^ seed) >>> 0) % 1000) / 1000 - 0.5) * amp; };
      const x0 = camera.x - 60, x1 = camera.x + W + 60;
      const top = camera.y - 40, bot = camera.y + H + 340;
      const firstX = vertices[0].x, lastX = vertices[vertices.length - 1].x;
      ctx.save();
      ctx.fillStyle = sand;
      // Side walls: fill from the screen edge to the room's carved span with a jagged face.
      const wall = function (innerX, outerX, salt) {
        ctx.beginPath();
        ctx.moveTo(outerX, top);
        const steps = 9;
        for (let s = 0; s <= steps; s++) ctx.lineTo(innerX + jag(s * 7 + salt, 34), top + (bot - top) * (s / steps));
        ctx.lineTo(outerX, bot);
        ctx.closePath(); ctx.fill();
      };
      if (firstX > x0) wall(firstX, x0, 131);
      if (lastX < x1) wall(lastX, x1, 577);
      // Ceiling: a crust across the top of the hollow with an uneven underside.
      const cy = camera.y + 46;
      ctx.beginPath();
      ctx.moveTo(x0, top);
      const steps = 14;
      for (let s = 0; s <= steps; s++) ctx.lineTo(x0 + (x1 - x0) * (s / steps), cy + jag(s * 13 + 977, 26));
      ctx.lineTo(x1, top);
      ctx.closePath(); ctx.fill();
      // a darker seam along the crust's underside (strata depth cue)
      ctx.globalAlpha = 0.28; ctx.strokeStyle = '#000'; ctx.lineWidth = 2;
      ctx.beginPath();
      for (let s = 0; s <= steps; s++) {
        const px = x0 + (x1 - x0) * (s / steps), py = cy + jag(s * 13 + 977, 26) + 1;
        if (s === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.stroke();
      ctx.restore();
    },
    // The night-sky accretion: faint stars (one per surface hole ever completed), brighter every
    // ninth (a finished Front Nine). Screen-space, upper band only, so they read as distant sky.
    _drawConstellations(ctx, recap, aFade) {
      const AM = (aFade == null) ? 1 : aFade; if (AM <= 0.001) return;
      const n = Math.min(this._starsDone || 0, 200);
      if (n <= 0) return;
      this._starT++;
      if (this._starFlare > 0) this._starFlare--;
      // In-play the sky stays subtle (no mechanics on the surface); at the run-complete recap —
      // the one guaranteed eyeball moment, where "one more?" is decided — it reads stronger.
      const band = H * (recap ? 0.6 : 0.40);
      const aMul = recap ? 2.0 : 1.0, aCap = recap ? 0.85 : 0.55, rMul = recap ? 1.3 : 1.0;
      ctx.save();
      for (let i = 0; i < n; i++) {
        const p = this._starAt(i);
        const sx = 6 + p.x * (W - 12), sy = 12 + p.y * band;
        const isNine = ((i + 1) % 9) === 0;                  // every ninth hole = a brighter star
        let tw, r = (isNine ? 1.9 : 1.15) * rMul, aMax = aCap;
        if (this._twinkle >= 1) {
          // glisten: deeper twinkle at per-star speeds + an occasional brief glint that pops alpha+size
          tw = 0.6 + 0.4 * Math.sin(this._starT * (0.02 + (i % 5) * 0.006) + i * 1.7);   // gentle, slow breath
          const g = Math.sin(this._starT * 0.006 + i * 2.7);
          if (g > 0.97) { const pop = (g - 0.97) * 6; tw += pop; r += pop * 0.7; aMax = aCap + 0.15; }   // rare, soft glint
        } else {
          tw = 0.72 + 0.28 * Math.sin(this._starT * 0.03 + i * 1.7);   // gentle twinkle, never fully dim
        }
        let a = Math.min(aMax, (isNine ? 0.46 : 0.22) * tw * aMul);
        if (i === n - 1 && this._starFlare > 0) { const f = this._starFlare / 26; a = Math.min(0.95, a + f * 0.7); r += f * 1.8; }
        ctx.globalAlpha = Math.max(0, a) * AM;
        ctx.fillStyle = isNine ? '#cfe0ff' : '#dfe8ff';
        ctx.beginPath(); ctx.arc(sx, sy, r, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
    },
    // A gold flag-plant at the cup the instant a hole is collected (taken at/under par). Screen-space,
    // anchored to the just-finished hole's cup, riding the sink/pan. Turns par into a felt micro-reward.
    _drawCollectFlash(ctx) {
      const cf = this._collectFlash;
      if (!cf || cf.frame <= 0) return;
      const h = (typeof holes !== 'undefined') ? holes[cf.holeIdx] : null;
      if (h && h.cupX != null) {
        const cam = (typeof camera !== 'undefined') ? camera.x : 0;
        const fx = h.cupX - cam, fy = h.cupY, t = cf.frame / 32;          // t: 1 -> 0
        ctx.save();
        ctx.globalAlpha = t; ctx.strokeStyle = '#f0c860'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(fx, fy, 10 + (1 - t) * 56, 0, Math.PI * 2); ctx.stroke();   // expanding ring
        const rise = (1 - t) * 16;                                        // a flag rising + fading
        ctx.globalAlpha = Math.min(1, t * 1.2);
        ctx.beginPath(); ctx.moveTo(fx, fy - 4 - rise); ctx.lineTo(fx, fy - 26 - rise); ctx.stroke();
        ctx.fillStyle = '#f0c860';
        ctx.beginPath(); ctx.moveTo(fx, fy - 26 - rise); ctx.lineTo(fx + 12, fy - 22 - rise); ctx.lineTo(fx, fy - 18 - rise); ctx.closePath(); ctx.fill();
        ctx.restore();
      }
      cf.frame--;
    },

    // ── First-discovery signal (the iceberg surfacing) ────
    // Centralized knowledge-flag setter — route EVERY rg-knows-* write through here. The first
    // secret a player ever finds fires a one-shot violet rune bloom so they learn Discoveries exist
    // (and to press M). Most players' first secret is the Fault, whose flag is set mid-crane, so the
    // bloom is drawn from drawHUD (always-on), not _drawOverlays (which the crane early-returns from).
    _markKnown(flag) {
      flag = String(flag).replace('rg-knows-', '');
      try {
        if (localStorage.getItem('rg-knows-' + flag) === '1') return false;   // already known
        var flags = window.RG_SECRET_FLAGS || [], hadAny = false;
        for (var i = 0; i < flags.length; i++) { if (localStorage.getItem('rg-knows-' + flags[i]) === '1') { hadAny = true; break; } }
        localStorage.setItem('rg-knows-' + flag, '1');
        if (!hadAny && !localStorage.getItem('rg-first-codex-seen')) {         // the FIRST-ever discovery
          localStorage.setItem('rg-first-codex-seen', '1');
          this._firstKnowFlare = 100;
        }
        return true;
      } catch (e) { return false; }
    },
    _drawFirstKnowFlare(ctx) {
      if (!(this._firstKnowFlare > 0)) return;
      const f = this._firstKnowFlare, t = 1 - f / 100;       // 0 -> 1 over its life
      const cx = W / 2, cy = H * 0.38, a = Math.sin(t * Math.PI);   // fade in + out, no text
      ctx.save();
      ctx.textAlign = 'center';
      ctx.globalAlpha = Math.max(0, a) * 0.8;
      ctx.strokeStyle = '#c98bff'; ctx.lineWidth = 2; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.beginPath(); ctx.arc(cx, cy, 14 + t * 26, 0, Math.PI * 2); ctx.stroke();         // expanding violet ring
      ctx.beginPath();                                                                     // a small angular rune
      ctx.moveTo(cx - 9, cy - 9); ctx.lineTo(cx + 5, cy - 3); ctx.lineTo(cx - 4, cy + 4); ctx.lineTo(cx + 9, cy + 9);
      ctx.stroke();
      ctx.globalAlpha = Math.max(0, a) * 0.55;                                             // a lingering ◇ (the Codex tell)
      ctx.fillStyle = '#b24dff'; ctx.font = "15px 'Departure Mono', monospace";
      ctx.fillText('◇', cx, cy + 38);
      ctx.restore();
      this._firstKnowFlare--;
    },
    // The wind tell: a thin pale arrow, top-center. tier (0/1/2, optional) maps to one of
    // three discrete LENGTHS so the per-hole magnitude is READABLE — a long arrow means
    // "this hole actually bends the shot", a stub means "barely" — turning the old static
    // rightward offset into a per-hole decision (how hard do I fight THIS hole). No pulse
    // or gust: static-per-hole keeps the deadpan calm; the variety lives across holes.
    _drawWindArrow(ctx, wind, tier) {
      const cx = W / 2, y = 92, dir = wind > 0 ? 1 : -1;
      const len = (tier != null) ? [34, 54, 78][tier] : 54;
      ctx.save();
      ctx.globalAlpha = 0.8; ctx.strokeStyle = '#9fd2ff'; ctx.fillStyle = '#9fd2ff'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(cx - dir * len / 2, y); ctx.lineTo(cx + dir * len / 2, y); ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx + dir * len / 2, y);
      ctx.lineTo(cx + dir * (len / 2 - 9), y - 5);
      ctx.lineTo(cx + dir * (len / 2 - 9), y + 5);
      ctx.closePath(); ctx.fill();
      ctx.restore();
    },
    // TWO SUNS (perception): two faint, OFFSET soft drop-shadows under the terrain
    // silhouette, cast from two light sources that don't agree, so the true slope reads
    // a touch ambiguous — you must look before committing a roll line. The free in-view
    // counter-tool lives ON the ball: its own shadow doubles, so where it'll sit is never
    // in doubt. Render-only, screen-space, recolors nothing — serene, not hostile.
    _drawTwoSuns(ctx) {
      if (typeof vertices === 'undefined' || !vertices.length || typeof camera === 'undefined') return;
      const cam = camera.x, camy = camera.y || 0;
      // Two warm light directions (offsets, in screen-px) — a long low pair, like two
      // setting suns. The terrain's doubled shadow is drawn as two faint filled skirts
      // hanging just below the surface line.
      const offs = [{ dx: 13, a: 0.17, c: '#e9b06a' }, { dx: -10, a: 0.15, c: '#c98fd8' }];
      ctx.save();
      for (let s = 0; s < offs.length; s++) {
        const o = offs[s];
        ctx.globalAlpha = o.a; ctx.fillStyle = o.c;
        ctx.beginPath();
        let started = false;
        for (let k = 0; k < vertices.length; k++) {
          const v = vertices[k];
          const sx = v.x - cam, sy = v.y - camy;
          if (sx < -40 || sx > W + 40) continue;
          if (!started) { ctx.moveTo(sx + o.dx, sy + 4); started = true; }
          else ctx.lineTo(sx + o.dx, sy + 4);
        }
        if (started) { ctx.lineTo(W + 40, H + 40); ctx.lineTo(-40, H + 40); ctx.closePath(); ctx.fill(); }
      }
      // The ball's own doubled shadow (the free counter-tool): two soft ovals on the
      // ground beneath it, so you always know exactly where it sits / will land.
      if (typeof ball !== 'undefined' && typeof terrainYAt === 'function') {
        const gy = terrainYAt(ball.x) - camy, bx = ball.x - cam;
        for (let s = 0; s < offs.length; s++) {
          ctx.globalAlpha = offs[s].a + 0.06; ctx.fillStyle = offs[s].c;
          ctx.beginPath(); ctx.ellipse(bx + offs[s].dx, gy + 2, 6, 2.2, 0, 0, Math.PI * 2); ctx.fill();
        }
      }
      ctx.restore();
    },
    // Persistent top-of-screen tell for a hostile material condition (slick / hotrock):
    // a small glyph + word held the whole hole, so the broken rule stays readable after
    // the one-shot telegraph fades — the free counter-tool the telegraph contract promises.
    // Screen-space, drawn each frame; mirrors the wind arrow's position/weight.
    _drawCondTell(ctx, glyph, word, color) {
      const cx = W / 2, y = 92;
      ctx.save();
      ctx.globalAlpha = 0.8;
      ctx.fillStyle = color;
      ctx.textAlign = 'center';
      ctx.font = "18px 'Departure Mono', monospace";
      ctx.fillText(glyph, cx, y + 6);
      ctx.globalAlpha = 0.5;
      ctx.font = "9px 'Departure Mono', monospace";
      ctx.fillText(word, cx, y - 12);
      ctx.restore();
    },
    // The one-word telegraph as a hole loads. Critique fix (all three critics, the
    // single highest-leverage tone change): the old 30px center banner was arcade
    // billboard energy in a game whose trailer whispers in 8px monospace. It now reads
    // at quiet HUD weight (11px), sits in the top band near the hole counter, and
    // fades — a mutter, not a shout. The persistent in-world tells (the wind arrow, the
    // painted material band) carry the rule after this fades; the banner just NAMES it once.
    _drawCondBanner(ctx) {
      const b = this._condBanner; b.frame++;
      if (b.frame > 95) { this._condBanner = null; return; }
      const a = b.frame < 12 ? b.frame / 12 : Math.max(0, 1 - (b.frame - 55) / 40);
      if (a <= 0) return;
      ctx.save();
      ctx.globalAlpha = Math.min(1, a) * 0.8;
      ctx.fillStyle = b.color;
      ctx.font = "11px 'Departure Mono', monospace";
      ctx.textAlign = 'center';
      ctx.fillText(b.text, W / 2, 64);
      ctx.restore();
    },
  };

  window.RG = RG;

  // ── Dev console helpers (testing only; no UI, no surface effect) ──
  // RG.dbg.scan()    -> seeds (1..n) that hide a Fault + which hole
  // RG.dbg.go(seed)  -> load a seed, report its secrets + conditions
  // RG.dbg.peek()    -> jump to the Fault hole, ball at its tee
  // Dormant unless the page is loaded with ?dev, so it can't spoil a public playtest.
  if (typeof location !== 'undefined' && /[?&]dev\b/.test(location.search)) RG.dbg = {
    scan: function (n) {
      n = n || 80; const seeds = []; for (let i = 1; i <= n; i++) seeds.push(i);
      return RG._audit(seeds).filter(function (r) { return r.faultHole >= 0; })
        .map(function (r) { return { seed: r.seed, faultHole: r.faultHole >= 0 ? r.faultHole + 1 : null }; });
    },
    go: function (seed) {
      RG.startRun({ seed: seed });
      return {
        seed: (RG.seed >>> 0).toString(36),
        faultHole: RG._faultTile ? RG._faultTile.hole + 1 : null,
        conditions: RG.holeConds.map(function (c, i) { return c ? ((i + 1) + ':' + c.key) : null; }).filter(Boolean),
      };
    },
    peek: function () {
      const hit = RG.dbg.scan(160).find(function (r) { return r.faultHole; });
      if (!hit) return 'none found in 1..160';
      RG.startRun({ seed: parseInt(hit.seed, 36) });
      const tile = RG._faultTile;
      currentHole = tile.hole;
      const h = holes[tile.hole];
      ball.x = h.teeX; ball.y = terrainYAt(h.teeX) - BALL_RADIUS; ball.vx = 0; ball.vy = 0; ball.atRest = true; ball.onGround = true;
      if (typeof state !== 'undefined') state = STATE_AIM;
      if (typeof camera !== 'undefined') camera.x = (tile.x + h.teeX) / 2 - W / 2;
      return { seed: hit.seed, hole: tile.hole + 1, targetX: Math.round(tile.x) };
    },
  };

  // 'z' / 'x' spends a drop (replay your last shot). Ignored while typing in an input.
  window.addEventListener('keydown', function (e) {
    const t = e.target && e.target.tagName;
    if (t === 'INPUT' || t === 'TEXTAREA') return;
    if (e.key === 'z' || e.key === 'Z' || e.key === 'x' || e.key === 'X') {
      if (RG.useDrop()) e.preventDefault();
    }
  });

  // Capture-phase click router: a secret (pull-the-flag, poke-the-sun, …) gets first
  // refusal on the press BEFORE gameplay.js's bubble-phase mousedown starts an aim drag.
  // Consuming (return true) stops propagation so no shot is armed; an un-consumed click
  // falls straight through to aim, untouched. Hooks get (worldX, worldY, screenX, screenY)
  // — world = screen + camera, so secrets can hit-test world objects (flag/cup) or
  // screen objects (sun/HUD text) without re-deriving the transform.
  function rgSecretPointer(clientX, clientY, hook) {
    if (!(window.RG && RG.active) || typeof state === 'undefined' || state !== STATE_AIM) return false;
    if (!RG._surfaceRunOnly() || !window.RG_runSecretHook) return false; // surface runs only
    const p = toGameCoords(clientX, clientY);
    const cy = (typeof camera !== 'undefined' && camera.y) || 0;
    return !!RG_runSecretHook(hook, p.x + camera.x, p.y + cy, p.x, p.y);
  }
  canvas.addEventListener('mousedown', function (e) {
    if (e.button === 0 && rgSecretPointer(e.clientX, e.clientY, 'onClick')) {
      e.stopImmediatePropagation(); e.preventDefault();
    }
  }, true);
  canvas.addEventListener('contextmenu', function (e) {
    if (rgSecretPointer(e.clientX, e.clientY, 'onRightClick')) {
      e.stopImmediatePropagation(); e.preventDefault();
    }
  }, true);
  // Touch parity: a tap gets the SAME first-refusal so secrets — and the ship's part
  // panel (its buy/inspect onClick rides this hook) — are reachable on a phone. Capture
  // phase, before the engine's bubble-phase touchstart starts an aim drag; only consume
  // (preventDefault) when a hook claims the tap, so a normal tap still falls through to aim.
  canvas.addEventListener('touchstart', function (e) {
    const t = e.changedTouches && e.changedTouches[0]; if (!t) return;
    if (rgSecretPointer(t.clientX, t.clientY, 'onClick')) {
      e.stopImmediatePropagation(); e.preventDefault();
    }
  }, true);
  // The deep-space TRAVEL gate: while the seamless planetary-travel sequence holds in space, a tap/click
  // anywhere continues the journey. Capture phase + swallow so it can't also start an aim on the hidden
  // hole underneath. Works in the real game and under ?seq alike (bot/headless auto-advances, never hangs).
  function rgTravelTap(e) {
    if (window.RG && RG._descPhase === 'thold' && RG._travelTap) {
      RG._travelTap();
      e.stopImmediatePropagation(); e.preventDefault();
    }
  }
  canvas.addEventListener('mousedown', rgTravelTap, true);
  canvas.addEventListener('touchstart', rgTravelTap, true);

  // Don't show the scrapped textured art — force the flat-shaded branch. The legacy textured
  // look (tan sand crust + orange clay substrate + a parallax sky band) is OFF-VISION for the
  // flat-vector Par Sec palette: on Earth it paints the green over with orange clay, on the Moon
  // it tans the grey regolith's top edge. The engine core still binds the T key to toggle it
  // (modes/desert-golfing.js) and persists the choice, so a stray press re-enabled it. Pin it OFF
  // and SWALLOW the T key here (capture phase) so it can never come back in this build.
  if (typeof TERRAIN_TEXTURE_ON !== 'undefined') TERRAIN_TEXTURE_ON = false;
  try { localStorage.setItem('dg-terrain-texture', '0'); } catch (e) { /* ignore */ }
  window.addEventListener('keydown', function (e) {
    if (e.key !== 't' && e.key !== 'T') return;
    const tag = e.target && e.target.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;
    e.stopImmediatePropagation();                                  // the core toggle never sees it
    if (typeof TERRAIN_TEXTURE_ON !== 'undefined') TERRAIN_TEXTURE_ON = false;
    try { localStorage.setItem('dg-terrain-texture', '0'); } catch (_) { /* ignore */ }
  }, true);

  // Terrain (re)generated mid-run gets its materials re-clamped to the active course palette, so
  // the no-mat boundary/background verts generateHoleTerrain pushes never render as DEFAULT_MAT
  // ('sand' = orange) on Earth/Moon. Wrap the engine's generator (it's only re-clamping, no PRNG
  // touch) — catches every regen path (the engine's onTransitionEnd + the layer's own calls).
  if (typeof window.generateHoleTerrain === 'function' && !window.generateHoleTerrain._rgClamped) {
    const _ght = window.generateHoleTerrain;
    window.generateHoleTerrain = function () {
      const r = _ght.apply(this, arguments);
      if (window.RG && RG._clampTerrainMats) RG._clampTerrainMats();
      return r;
    };
    window.generateHoleTerrain._rgClamped = true;
  }

  // Boot-deferral stub: NO up-front options. Boot straight into a plain run on a fresh
  // random seed — you just play golf, get the ball in the hole. All depth (the budget,
  // your best, the Vault, the Fault, per-hole conditions) reveals itself over time. The
  // engine's fading course title is the only intro.
  window.initFirebase = function () {
    const ld = document.getElementById('loading'); if (ld) ld.style.display = 'none';
    RG.loadProgress();
    if (RG.loadCollection) RG.loadCollection();
    // The space arc boots on Earth. ?mars boots the original Mars nine directly (the
    // old line stays playable while Mars awaits its place as a destination).
    const mars = (typeof location !== 'undefined') && /[?&]mars\b/.test(location.search);
    RG.startRun({ course: mars ? 'run-course' : 'earth-course' });
  };
})();
