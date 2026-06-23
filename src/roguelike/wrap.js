// ── Roguelike MODE Wrap ────────────────────────────────────
// Non-destructively extends the active MODE (set by modes/desert-golfing.js) to
// score the run (par, budget, best-per-seed) and turn course-completion into a
// win/fail screen. Base behaviour is always called through — peel this file off
// and the original mode is untouched. Loads AFTER modes/desert-golfing.js + gameplay.js.
(function () {
  if (typeof MODE === 'undefined' || !MODE) return;
  const base = MODE;
  const baseStart = base.onTransitionStart ? base.onTransitionStart.bind(base) : null;
  const baseEnd = base.onTransitionEnd ? base.onTransitionEnd.bind(base) : null;
  const baseHUD = base.drawHUD ? base.drawHUD.bind(base) : null;
  const baseRest = base.onRest ? base.onRest.bind(base) : null;
  const baseCollide = base.collide ? base.collide.bind(base) : null;
  const baseOOB = base.isOOB ? base.isOOB.bind(base) : null;
  const baseGoal = base.isGoalReached ? base.isGoalReached.bind(base) : null;
  const baseWorld = base.drawWorld ? base.drawWorld.bind(base) : null;
  const baseSky = base.drawSky ? base.drawSky.bind(base) : null;

  MODE = Object.assign({}, base, {
    onTransitionStart() {
      // Base advances currentHole (++) and decides course-complete by holeCount.
      // At this point totalStrokes already includes the just-finished hole and
      // `strokes` still holds that hole's count (it is reset right after this).
      const justFinished = (typeof currentHole !== 'undefined') ? currentHole : 0;
      if (baseStart) baseStart();
      if (window.RG && RG.active) {
        RG.recordHole(justFinished, (typeof strokes !== 'undefined') ? strokes : 0);
        // A completed SURFACE hole adds a star to the night sky (visual progression).
        if (RG._surfaceRunOnly && RG._surfaceRunOnly() && RG._recordHoleDone) RG._recordHoleDone();
        // …and at/under par COLLECTS that hole-of-the-nine (overt progression — the Front Nine).
        if (RG._surfaceRunOnly && RG._surfaceRunOnly() && RG._recordCollect) RG._recordCollect(justFinished, (typeof strokes !== 'undefined') ? strokes : 0);
        // Budget bust ends the run as a failure — INCLUDING on the final hole, where
        // base onTransitionStart already set courseComplete (otherwise an over-budget
        // last hole would slip through as a win + could even bank a NEW BEST).
        if (RG.isOverBudget()) {
          RG.failed = true;
          if (!courseComplete) {
            courseComplete = true;
            transitionCamEnd = transitionCamStart; // stay put; no pan to a next hole
          }
        }
        // apply the entering hole's emergent condition (wind / thin air); resets to
        // pristine first so nothing leaks between holes
        if (typeof currentHole !== 'undefined') RG._applyHoleCondition(currentHole);
      }
      // Follow-cam planets frame each new hole deliberately: retarget the hole-to-hole pan to the
      // planet's hole-start anchor so AIM opens exactly there (no aim-time snap). The base pan owns X
      // (transitionCamEnd); onTransitionUpdate eases camera.y alongside it (base pans X only). Inert
      // when no planet hook or the course is ending. RG._tCamY0/Y1 carry the Y animation endpoints.
      if (window.RG) RG._tCamY1 = null;
      if (!courseComplete && window.RG && window.RG_ATLAS && RG_ATLAS.holeCam) {
        var _hc = RG_ATLAS.holeCam();
        if (_hc) { transitionCamEnd = _hc.x; RG._tCamY0 = (typeof camera !== 'undefined' && camera.y) || 0; RG._tCamY1 = _hc.y; }
      }
    },
    onTransitionUpdate(ease, t) {
      // Ease camera.y to the follow-planet's hole-start anchor over the same eased pan the base uses
      // for X — so the hole-to-hole move lands on the anchor in both axes and AIM begins framed.
      if (window.RG && RG._tCamY1 != null && typeof camera !== 'undefined' && !courseComplete) {
        camera.y = RG._tCamY0 + (RG._tCamY1 - RG._tCamY0) * ease;
      }
    },
    onTransitionEnd() {
      if (baseEnd) baseEnd(); // may set state = STATE_COMPLETE when the course is done
      if (typeof state !== 'undefined' && state === STATE_COMPLETE && window.RG && RG.active) {
        RG.finalStrokes = totalStrokes;
        RG.finalHoles = currentHole;
        if (RG.inVault) {
          RG.vaultCleared = true;
        } else if (RG.inFault) {
          RG.faultCleared = true;
        } else if (!RG.failed) {
          // A run that used any drop is not best- or Vault-eligible (drops are a safety
          // net, not a way to game the leaderboard or earn the secret).
          if (RG.dropsUsed === 0) {
            RG.isNewBest = RG.saveBest(totalStrokes);
            if (RG.finalStrokes <= RG.runPar) RG.vaultUnlocked = true;
          }
        }
        // Settle the run's earnings (economy.js): tier payouts per hole slot, $1 repeats.
        if (window.RG_ECON) RG_ECON.settleRun();
        // ── META: record this body's per-planet score (RG_SCORES) for the scorecard + star map.
        // Surface runs only (not Vault/Fault). Persists total-vs-par + all-time best to localStorage,
        // sets the resume point, and mirrors the save to the cloud if a backend is configured.
        // Captured on RG._lastPScore so the travel scorecard can render real numbers + a NEW BEST flag.
        if (window.RG_SCORES && !RG.inVault && !RG.inFault && RG._surfaceRunOnly && RG._surfaceRunOnly()) {
          var _pr = RG_SCORES.record(RG.course, RG.finalStrokes, RG.runPar);
          if (_pr) {
            RG._lastPScore = { course: RG.course, total: RG.finalStrokes, par: RG.runPar, best: _pr.rec.best, isNewBest: _pr.isNewBest };
            RG_SCORES.setItinPos(RG.course);
          }
          if (window.RG_PROFILE && RG_PROFILE.syncUp) RG_PROFILE.syncUp();
        }
      }
      if (window.RG) { RG._lastSafe = null; RG._dropTo = null; } // fresh hole -> water reshoots from this tee; no stale prior-hole shot to drop-replay
      // The rare in-course EVENT NODE: arriving at a new tee MAY land on a small event
      // (seed-stable, ~rare). Off by default (variant 0) so nothing changes unless enabled.
      // The ball already rests on the real tee; the event is a small DIEGETIC object the world
      // placed beside it (a crate/sign/cairn, or a beat in the sky — wrap.drawHUD -> RG_EVENT.draw)
      // that resolves on a tap / the first shot and gets out of the way.
      if (window.RG_EVENT && window.RG && RG.active && (typeof state === 'undefined' || state !== STATE_COMPLETE)
          && RG._surfaceRunOnly()) {
        RG_EVENT.maybeArm((typeof currentHole !== 'undefined') ? currentHole : 0);
      }
      // AUTO-TRAVEL: finishing a surface course launches the seamless planetary-travel sequence to the
      // next world (Earth→Moon, Moon→Earth) — this replaces the old "repair the ship at the wreck +
      // recap" gate. A failed (over-budget) run still falls to the recap; Fault/Vault keep their own
      // recap (guarded by _surfaceRunOnly). Earnings are already banked by settleRun above.
      // Only the two REAL surface worlds ping-pong; any other course (the ?galaxy sampler planets,
      // future one-off worlds) finishes to its own recap instead of being yanked to the Moon.
      if (typeof state !== 'undefined' && state === STATE_COMPLETE && window.RG && RG.active && !RG.failed
          && RG._surfaceRunOnly && RG._surfaceRunOnly() && RG._beginTravel) {
        var _itin = window.SOLAR_ITINERARY, _ci = _itin ? _itin.indexOf(RG.course) : -1;
        if (_ci >= 0 && _ci < _itin.length - 1) {
          RG._beginTravel(_itin[_ci + 1], 'descend');         // SOLAR TOUR: warp to the next body in order
        } else if (RG.course === 'earth-course' || RG.course === 'moon') {
          RG._beginTravel(RG.course === 'moon' ? 'earth-course' : 'moon', 'descend');   // original earth↔moon ping-pong
        }
        // else: last itinerary body (Charon) → no travel, finishes to recap
      }
    },
    onRest() {
      // The playtest bot simulates candidate shots by running the real physics forward; during
      // that, the ball "rests" many times. Skip ALL rest side effects (Fault descent, water
      // reshoot, drops, secret hooks) so a simulated rest never mutates the live run.
      if (window.RG && RG._simulating) return;
      if (baseRest) baseRest();
      if (!(window.RG && RG.active) || typeof getMaterialAt !== 'function') return;
      // An EXPERIMENTAL planet (?galaxy/?atlas; atlas.js) can claim the rest — a ball-eating
      // creature, a portal, an only-up tumble check. Inert unless an atlas planet with an onRest
      // hook is active. Runs before the built-in handling so it can fully consume the rest.
      if (window.RG_ATLAS && RG_ATLAS.onRest && RG_ATLAS.onRest()) return;
      // A standalone secret can claim the rest (e.g. land in its own pocket) before the
      // built-in anomaly/water handling runs. Return true from its onRest to consume.
      if (RG._surfaceRunOnly() && window.RG_runSecretHook && RG_runSecretHook('onRest')) return;
      const mat = getMaterialAt(ball.x);
      // The Fault: come to rest on an anomaly tile and the floor gives way.
      if (mat === 'anomaly' && (typeof isBallInCup !== 'function' || !isBallInCup())) {
        if (RG.beginDescent) RG.beginDescent();
        return;
      }
      if (mat === 'water' && !isBallInCup()) {
        // Hazard: the ball is lost. Reshoot from the last safe rest (or this tee).
        // The stroke that found the water already counts.
        const h = holes[currentHole];
        const safeX = (RG._lastSafe != null) ? RG._lastSafe.x : h.teeX;
        // Re-ground on restore (terrain is static within a hole) so the ball never
        // ends up floating or embedded from a stale saved Y.
        ball.x = safeX; ball.y = terrainYAt(safeX) - BALL_RADIUS; ball.vx = 0; ball.vy = 0;
        ball.onGround = true; ball.atRest = true;
      } else if (mat !== 'water') {
        // remember where this shot was taken FROM (the previous safe rest) so a drop
        // can replay it; then record the new rest.
        RG._dropTo = (RG._lastSafe != null) ? RG._lastSafe : { x: holes[currentHole].teeX };
        RG._lastSafe = { x: ball.x };
      }
    },
    collide() {
      // While dropping through the Fault, disable terrain collision so the ball
      // free-falls; otherwise normal collision.
      if (window.RG && RG.descending) { if (typeof ball !== 'undefined') ball.onGround = false; return false; }
      // Experimental mid-flight FORCE FIELDS (atlas.js): gravity wells, repulsors, wind tunnels apply
      // a velocity delta here — collide() runs every physics substep, INCLUDING inside the bot's
      // simulateShot, so the force is lawful and bot-predictable (not a render-only fudge). Inert
      // unless the live atlas planet defines force(). Never during a real descent (handled above).
      if (window.RG_ATLAS && RG_ATLAS.force) RG_ATLAS.force();
      // Experimental SOLID-PLATFORM collision (atlas.js): a planet can collide the ball against free-
      // floating blocks (overhangs / floating terrain / gaps a heightfield can't express). It resolves
      // the ball and returns true when it's resting on a platform TOP. We run it ALONGSIDE the base
      // heightfield collide (kept as a flat floor), then OR the on-ground result so the platform top
      // counts as ground (friction + rest). Inert unless the live planet defines a collide() hook.
      var onPlat = (window.RG_ATLAS && RG_ATLAS.collide) ? RG_ATLAS.collide() : false;
      var base = baseCollide ? baseCollide() : false;
      if (onPlat && typeof ball !== 'undefined') ball.onGround = true;
      return base || onPlat;
    },
    isOOB() {
      if (window.RG && RG.descending) return false; // a Fault drop is not an out-of-bounds
      // Experimental planets may redefine out-of-bounds (e.g. only-up: a tumble off the BOTTOM of
      // the frame is OOB the same way the left/right edges are). Return true/false to decide, or
      // null/undefined to defer to the base rule. Inert unless an atlas planet defines it.
      if (window.RG_ATLAS && RG_ATLAS.isOOB) { const o = RG_ATLAS.isOOB(); if (o === true || o === false) return o; }
      // The ship apron past Earth's ninth cup is real ground (the engine reads it as
      // off-screen-right of the fixed hole frame). Play may reach the wreck.
      if (window.RG_secret) {
        const sp = RG_secret('ship');
        if (sp && sp.pos && typeof ball !== 'undefined'
            && ball.x > sp.pos.x - 320 && ball.x < sp.pos.x + 380) return false;
      }
      return baseOOB ? baseOOB() : false;
    },
    isGoalReached() {
      // An atlas planet can define its OWN goal — e.g. finish by RESTING ON a goal block (not by
      // sinking into a heightfield cup, which a flat block top can't do). If the live planet defines
      // a goal, it OWNS goal detection entirely (the base sunken-cup check is skipped). Inert otherwise.
      if (window.RG_ATLAS && RG_ATLAS.isGoalReached) {
        const g = RG_ATLAS.isGoalReached();
        if (g !== undefined) return g;   // truthy hole-data = reached; false = not yet (base skipped)
      }
      return baseGoal ? baseGoal() : false;
    },
    // The engine's camera is fixed per hole; the wreck sits beyond hole 9's frame. Follow
    // the ball onto the apron — and glide home if it comes back. No-op everywhere else.
    updateCamera() {
      // An experimental planet can fully OWN the camera (atlas.js): a chase-cam that follows the
      // ball across many screens (long-drive), or an only-up pan that climbs to the next hole.
      // Return true to take over; the base apron-follow is then skipped. Inert by default.
      if (window.RG_ATLAS && RG_ATLAS.camera && RG_ATLAS.camera()) return;
      if (!(window.RG && RG.active) || RG.descending || typeof camera === 'undefined') return;
      const sp = window.RG_secret ? RG_secret('ship') : null;
      const lastIdx = RG.holeCount - 1;
      if (!sp || !sp.pos || typeof ball === 'undefined' || currentHole !== lastIdx || !holes[lastIdx]) return;
      const pastCup = ball.x > holes[lastIdx].cupX + 50;
      if (pastCup) {
        if (RG._apronCamBase == null) RG._apronCamBase = camera.x;
        camera.x += ((sp.pos.x - W * 0.62) - camera.x) * 0.09;
      } else if (RG._apronCamBase != null) {
        camera.x += (RG._apronCamBase - camera.x) * 0.09;
        if (Math.abs(RG._apronCamBase - camera.x) < 2) { camera.x = RG._apronCamBase; RG._apronCamBase = null; }
      }
    },
    // Vertical camera support (pan-down secrets) + an optional zoom around screen-centre (the
    // Leviathan reveal). camera.y defaults to 0 and RG._zoom defaults to 1 -> identical to base.
    applyCameraTransform(ctx) {
      const z = (window.RG && RG._zoom) || 1;
      if (z !== 1) {
        // Zoom about a chosen screen point (RG._zoomPivot — e.g. the cup the Leviathan ace
        // dropped into) so the world recedes around the moment, not an arbitrary centre.
        const p = (window.RG && RG._zoomPivot) || { x: W / 2, y: H / 2 };
        ctx.translate(p.x, p.y); ctx.scale(z, z); ctx.translate(-p.x, -p.y);
      }
      ctx.translate(-camera.x, -((typeof camera !== 'undefined' && camera.y) || 0));
    },
    // Underground there is no open sky: the hollow's own dark replaces the starry surface sky
    // the moment the floor opens (the crane band covers the swap, so it reads as descent).
    drawSky() {
      if (window.RG && RG.active && RG.inFault) {
        ctx.fillStyle = '#0f0b12';
        ctx.fillRect(0, 0, W, H);
        return;
      }
      if (baseSky) baseSky();
      // Experimental-planet SKY treatment (atlas.js): a behind-the-world screen-space layer (e.g. the
      // golf-orbit deep-space starfield + atmosphere limb glow) drawn over the base sky fill and BEHIND
      // the terrain, so the planet occludes its own stars. Inert unless the live planet defines it.
      if (window.RG_ATLAS && RG_ATLAS.drawSkyBehind) RG_ATLAS.drawSkyBehind(ctx);
      // Ambient sky treatments draw BEHIND the world (after the base sky fill, before drawWorld)
      // so horizon bands / the far body / strata never paint over the flag or an airborne ball.
      // Inert by default (ships OFF); guards inside RG_AMBIENT.draw skip fault/vault/crane/bot.
      // (peel-off-able; ambient.js — delete the file + its <script> tag + this line.)
      if (window.RG_AMBIENT) RG_AMBIENT.draw(ctx);
      // The onboard 'sky' far body is the same class of behind-the-world treatment (its other
      // nudges — wake/reach/glint — stay foreground in run.js _drawOverlays). (onboard.js)
      if (window.RG_ONBOARD && RG_ONBOARD.drawBehind) RG_ONBOARD.drawBehind(ctx);
      // The distant sky (completed-hole stars / Moon field / shooting star) draws BEHIND the world so
      // terrain occludes it — was in drawHUD/_drawOverlays, which painted stars over high terrain
      // (a Descent mesa). Screen-space; identical on the surface where terrain is low. (run.js)
      if (window.RG && RG.active && RG._drawSkyStars) RG._drawSkyStars(ctx);
      // PLANET-TRAVEL sky (the space crossing) draws BEHIND the world too — same fix as the stars above. It used
      // to paint from _drawOverlays (after the world), so on take-off the stars covered the departing terrain.
      if (window.RG && RG._travelSeq && RG._drawTravelSky) {
        var _tp = (RG._descPhase === 'thold') ? 'hold' : (RG._descPhase === 'descend' ? 'descend' : 'rise');
        RG._drawTravelSky(ctx, _tp, 0, true);
      }
    },
    // During a secret pan, draw the surface band over the live (sunk) destination so their sand fills
    // meet into one continuous column — the "drilling through earth" reveal, no cover flash.
    drawWorld() {
      // Follow-cam continuity (AIM). The engine only drives MODE.updateCamera() in FLIGHT/OOB, so a
      // follow planet's camera() hook never ran WHILE AIMING — after the hole-to-hole pan the view
      // froze wherever the base pan left it, then SNAPPED onto the ball the instant you shot. Drive
      // the planet's camera hook during AIM too, from the draw pass (the only thing that ticks every
      // frame in AIM), so the view eases onto the ball BEFORE the shot — one shared fix for every
      // follow planet, not per-planet. The target is fixed while the ball rests, so the ease settles
      // and stops (no perpetual drift). Inert for the base game (no atlas camera hook), and skipped
      // during descents / bot sims. STATIC holes opt out by having camera() return false.
      if (typeof state !== 'undefined' && state === STATE_AIM
          && !(window.RG && (RG.descending || RG._simulating))
          && window.RG_ATLAS && RG_ATLAS.camera) RG_ATLAS.camera();
      // Keep mid-run terrain ON-PALETTE: clamp any vertex the engine (re)generated with no mat
      // to the active course default BEFORE the terrain draws, so the no-mat boundary verts never
      // render as DEFAULT_MAT ('sand' = orange) on Earth / tan-crust the Moon. Cheap (~100 verts),
      // catches every regen/restore path, and only runs in the live draw loop (never the headless
      // audit), so the determinism baseline is untouched. (run.js RG._clampTerrainMats)
      if (window.RG && RG._clampTerrainMats) RG._clampTerrainMats();
      if (baseWorld) baseWorld();
      if (window.RG_ONBOARD) RG_ONBOARD.tick();                // first-run nudges: watch for the 'reach' arrival edge + keep the reached-last latch (peel-off-able; onboard.js; runs at all states incl. STATE_COMPLETE; no camera moves, no state writes — purely a cosmetic latch, never drives state)
      if (window.RG_AUDIO && RG_AUDIO.tick) RG_AUDIO.tick();   // shot/land/cup sound detection — in the draw pass so it's FRAME-SYNCED with the fx puff + juice pop (peel-off-able; audio.js)
      if (window.RG_FX) RG_FX.draw(ctx);                       // landing-particle juice (peel-off-able; fx.js)
      if (window.RG_JUICE) RG_JUICE.draw(ctx);                 // ball motion trail + impact pop (peel-off-able; juice.js)
      if (window.RG && RG._drawCavern) RG._drawCavern(ctx);   // walls + ceiling around a sunken hollow
      if (window.RG && RG._descPhase === 'pan' && RG._panBand && RG._drawShaftBand) RG._drawShaftBand(ctx);
      // Experimental-planet per-frame hook (atlas.js): mid-flight forces (gravity wells), moving
      // hazards/creatures, and their world-space draw. Runs after the base world + juice, inside the
      // same camera transform, so a planet draws in WORLD coordinates. Inert unless an atlas planet
      // defines frame(). Never runs during a bot simulation (RG._simulating) so sims stay clean.
      if (window.RG_ATLAS && RG_ATLAS.frame && !(window.RG && RG._simulating)) RG_ATLAS.frame(ctx);
    },
    drawHUD() {
      if (window.RG && RG.active && RG._syncHUD) RG._syncHUD();
      if (typeof state !== 'undefined' && state === STATE_COMPLETE && window.RG && RG.active) {
        drawRunComplete();
      } else {
        if (baseHUD) baseHUD();
        if (window.RG && RG.active && RG._drawOverlays) RG._drawOverlays(ctx);
        // The between-holes TRAVEL beat (screen-space, over the camera pan). Self-gates to
        // STATE_TRANSITION on a surface run and is inert at variant 0 (default) — peel-off-able
        // (travel.js). Never drives state, so it cannot stall the hole-to-hole transition.
        if (window.RG_TRAVEL && window.RG && RG.active) RG_TRAVEL.draw(ctx);
        // The in-course event node (a diegetic object by the live tee, or a sky beat). Inert when
        // no event is armed (variant 0 / not on an event tee), so peel-off-able and default-safe.
        if (window.RG_EVENT && window.RG && RG.active && RG._surfaceRunOnly() && RG_EVENT.active()) RG_EVENT.draw(ctx);
      }
      if (window.RG && RG._drawFirstKnowFlare) RG._drawFirstKnowFlare(ctx);   // always-on: the one-shot first-discovery bloom
      if (window.RG_SHIP && RG_SHIP.drawFlare) RG_SHIP.drawFlare(ctx);        // always-on: ship-part earned acknowledgement
      if (window.RG_SEQ && RG_SEQ.draw) RG_SEQ.draw(ctx);                     // dev (?seq): scorecard+transition A/B overlay, over the crane (seqtest.js)
      // (The Fault descent crane is driven from RG._drawOverlays so its post-swap settle
      //  keeps ticking after `descending` clears — no separate descent draw needed here.)
    },
  });

  // Set true on the run the 9th flag is claimed; latched until the next run (the recap can be
  // re-entered). Drives the once-ever "all nine flags" celebration; reset in the New Run handler.
  let _flagsCelebrate = false;

  // The once-ever 9/9 payoff drawn over the recap: a restrained gold headline + a rise of gold motes.
  function drawFlagsCelebration(cx, top, fade) {
    ctx.save();
    ctx.textAlign = 'center';
    const glow = 0.6 + 0.4 * Math.abs(Math.sin(completeTimer * 0.06));
    ctx.font = "17px 'Departure Mono', monospace";
    ctx.shadowColor = 'rgba(240,200,96,0.7)'; ctx.shadowBlur = 14 * glow;
    ctx.fillStyle = 'rgba(240,200,96,' + fade + ')';
    ctx.fillText('★  ALL NINE FLAGS ARE YOURS  ★', cx, top - 28);
    ctx.shadowBlur = 0;
    for (let i = 0; i < 14; i++) {                       // a gentle rise of gold motes (seeded x, looped)
      const h = (Math.imul(i + 1, 2654435761) >>> 0);
      const mx = 30 + (h % 1000) / 1000 * (W - 60);
      const p = ((completeTimer * 0.7 + (h % 90)) % 90) / 90;
      const my = H * 0.52 - p * H * 0.44;
      ctx.globalAlpha = Math.max(0, Math.sin(p * Math.PI) * 0.5 * fade);
      ctx.fillStyle = '#f0c860';
      ctx.beginPath(); ctx.arc(mx, my, 1.6, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  // ── Recap layout variant (taste, behind a flag) ───────────────────────────
  // The surface run-complete screen has FOUR DISTINCT calm layouts, all sharing the same
  // all-aces scorecard data. Pick with RG_RECAP_VARIANT (1..4) or the ?recap=N query param;
  // defaults to 1. The secret-area and failed-run recaps keep their own treatment.
  //   1  calm ledger   — big vs-par, one quiet take line, centred scorecard grid beneath (default)
  //   2  constellation — same calm header, aces as twinkling stars UP in the real night sky
  //   3  clubhouse     — the run on a single cream PAPER scorecard floating in the dark
  //   4  journey       — same header, the collection as a left-to-right path of worlds (the trip)
  // (The old "scorecard-forward" was cut: it inverted the per-run feel hierarchy — collection-as-
  //  hero belongs on the standalone collection page, not the every-run beat. See DECISIONS.md.)
  function recapVariant() {
    let v = window.RG_RECAP_VARIANT;
    if (v == null && typeof location !== 'undefined') {
      const m = /[?&]recap=(\d)/.exec(location.search);
      if (m) v = parseInt(m[1], 10);
    }
    v = v | 0;
    return (v >= 1 && v <= 4) ? v : 1;
  }

  function drawRunComplete() {
    if (typeof _completeBtn !== 'undefined') _completeBtn = null;
    if (typeof _replayBtn !== 'undefined') _replayBtn = null;

    // The shop owns the screen when open (entered from the recap's Shop button; its
    // back button returns here — completeTimer keeps running so the recap re-fades in).
    if (window.RG_SHOP && RG_SHOP.isOpen()) { RG._btns = []; RG_SHOP.draw(ctx); return; }

    completeTimer++;
    const fade = Math.min(1, completeTimer / 30);
    const cx = W / 2, top = H * 0.22;
    const variant = recapVariant();

    // The recap scrim. It must hold the dark FULLY through the whole text+collection column so
    // the live terrain/flag/bunker-notch never bleed through the one guaranteed eyeball moment
    // (both critics flagged the old gradient fading out too high). Solid-ish to ~0.72H, then a
    // soft tail so the green hill recedes into the friendly dark rather than ending in a hard line.
    (function () {
      const g = ctx.createLinearGradient(0, 0, 0, H * 0.92);
      g.addColorStop(0, 'rgba(12,9,18,' + (0.9 * fade) + ')');
      g.addColorStop(0.72, 'rgba(12,9,18,' + (0.86 * fade) + ')');
      g.addColorStop(1, 'rgba(12,9,18,0)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H * 0.92);
    })();
    if (window.RG && RG._drawConstellations) RG._drawConstellations(ctx, true);
    if (window.RG && RG._frontNineJustDone) { _flagsCelebrate = true; RG._frontNineJustDone = false; }

    const failed = RG.failed;
    const inFault = RG.inFault, inVault = RG.inVault, inSecret = inVault || inFault;
    const vaultDone = inVault && RG.vaultCleared;
    const area = (window.RG && RG._secretArea) || { title: '▾ THE FAULT', tag: 'the fault', sub: 'a course beneath the course' };

    ctx.textAlign = 'center';

    // ── Secret-area completion (unchanged: these recaps are trophies, no scorecard) ──
    if (inSecret) {
      ctx.font = "22px 'Departure Mono', monospace";
      if (inFault) { ctx.fillStyle = 'rgba(178,77,255,' + fade + ')'; ctx.fillText(area.title, cx, top); }
      else { ctx.fillStyle = 'rgba(240,184,96,' + fade + ')'; ctx.fillText('★ VAULT CLEARED ★', cx, top); }
      if (_flagsCelebrate) drawFlagsCelebration(cx, top, fade);
      ctx.font = "12px 'Departure Mono', monospace";
      ctx.fillStyle = 'rgba(242,236,255,' + (fade * 0.4) + ')';
      ctx.fillText('seed ' + (RG.seed >>> 0).toString(36) + '   ·   ' + (inFault ? area.tag : 'the vault'), cx, top + 24);
      ctx.font = "22px 'Departure Mono', monospace";
      ctx.fillStyle = 'rgba(255,255,255,' + fade + ')';
      ctx.fillText('cleared in ' + RG.finalStrokes + (RG.finalStrokes === 1 ? ' stroke' : ' strokes'), cx, top + 58);
      if (inFault) {
        ctx.font = "12px 'Departure Mono', monospace";
        ctx.fillStyle = 'rgba(201,139,255,' + (fade * 0.75) + ')';
        ctx.fillText(area.sub, cx, top + 80);
        ctx.fillStyle = 'rgba(242,236,255,' + (fade * 0.35) + ')';
        ctx.fillText('your run ends here', cx, top + 98);
      }
      drawCompleteButtons(top + (inFault ? 120 : 96), fade, false);
      ctx.textAlign = 'left';
      return;
    }

    // ── Surface recap (the redesigned screen) ──
    let y;
    if (failed) {
      ctx.font = "22px 'Departure Mono', monospace";
      ctx.fillStyle = 'rgba(232,96,96,' + fade + ')'; ctx.fillText('RUN FAILED', cx, top);
      if (_flagsCelebrate) drawFlagsCelebration(cx, top, fade);
      ctx.font = "13px 'Departure Mono', monospace";
      ctx.fillStyle = 'rgba(242,236,255,' + (fade * 0.6) + ')';
      ctx.fillText('reached hole ' + Math.min((RG.finalHoles || 0) + 1, RG.holeCount) + ' / ' + RG.holeCount, cx, top + 40);
      y = top + 64;
      if (window.RG_ECON && RG_ECON.drawTakeLine) y = RG_ECON.drawTakeLine(ctx, cx, y, fade);
      // the collection persists through a bust (you keep what you earned) — the calm grid, always
      if (window.RG_ECON && RG_ECON.drawScorecard) y = RG_ECON.drawScorecard(ctx, cx, y + 10, fade, 'grid');
    } else if (variant === 2) {
      y = drawSuccessConstellation(cx, top, fade);
    } else if (variant === 3) {
      y = drawSuccessClubhouse(cx, top, fade);
    } else if (variant === 4) {
      y = drawSuccessJourney(cx, top, fade);
    } else {
      y = drawSuccessLedger(cx, top, fade, 'grid');
    }

    drawCompleteButtons(y + 8, fade, RG.vaultUnlocked && !failed && !window.RG_MINIMAL);
    ctx.textAlign = 'left';
  }

  // Shared header for the surface success recaps: title + big vs-par + (a best HOOK, not a scold).
  // The redundant passive "best N" verdict is gone — it read as a scold after a run that didn't
  // beat it (both critics). We keep "★ new best" (a genuine beat) and surface the prev-best only
  // as a LURE when the run came close (within 2): "best N — beat it". Otherwise the header stays
  // a clean 2-line column (title + vs-par); the wallet/access fact lives in the take line below.
  function drawSuccessHeader(cx, top, fade) {
    ctx.textAlign = 'center';
    ctx.font = "20px 'Departure Mono', monospace";
    ctx.fillStyle = 'rgba(255,255,255,' + (fade * 0.85) + ')';
    ctx.fillText('RUN COMPLETE', cx, top);
    if (_flagsCelebrate) drawFlagsCelebration(cx, top, fade);
    const d = RG.finalStrokes - RG.runPar;
    ctx.font = "40px 'Departure Mono', monospace";
    ctx.fillStyle = d <= 0 ? 'rgba(122,209,122,' + fade + ')' : 'rgba(255,255,255,' + fade + ')';
    ctx.fillText(RG.vsParStr(RG.finalStrokes, RG.runPar), cx, top + 50);
    let y = top + 76;
    ctx.font = "12px 'Departure Mono', monospace";
    if (RG.isNewBest) { ctx.fillStyle = 'rgba(232,160,48,' + fade + ')'; ctx.fillText('★ new best', cx, y); y += 18; }
    else if (RG.prevBest != null && RG.finalStrokes - RG.prevBest <= 2) {   // close: a lure, never a verdict
      ctx.fillStyle = 'rgba(232,160,48,' + (fade * 0.7) + ')'; ctx.fillText('best ' + RG.prevBest + ' — beat it', cx, y); y += 18;
    }
    return y;
  }

  // Variant 1 (default): big vs-par on top, one quiet take line (no wallet — keep the column
  // short, the critique wanted fewer competing rows), centred scorecard grid beneath.
  function drawSuccessLedger(cx, top, fade, scStyle) {
    let y = drawSuccessHeader(cx, top, fade);
    if (window.RG_ECON && RG_ECON.drawTakeLine) y = RG_ECON.drawTakeLine(ctx, cx, y + 6, fade, false);
    if (window.RG_ECON && RG_ECON.drawScorecard) y = RG_ECON.drawScorecard(ctx, cx, y + 8, fade, scStyle || 'grid');
    return y;
  }

  // Variant 2 (constellation): the aces live UP in the real night sky (drawn first, behind the
  // header), and the calm ledger header + take sit in their usual column below. The sky IS the
  // collection here, so no grid beneath — the near-zero-text payoff. The three-state read is kept
  // in the sky (gold star / cool point / faint speck) so headroom still shows.
  function drawSuccessConstellation(cx, top, fade) {
    if (window.RG_ECON && RG_ECON.drawConstellationSky) RG_ECON.drawConstellationSky(ctx, fade);
    let y = drawSuccessHeader(cx, top, fade);
    if (window.RG_ECON && RG_ECON.drawTakeLine) y = RG_ECON.drawTakeLine(ctx, cx, y + 6, fade, false);
    return y;
  }

  // Variant 3 (clubhouse): the run as a single cream PAPER scorecard floating in the dark —
  // the coziest, most diegetic reading (a scorecard is what golf produces). economy.js draws
  // the whole framed artifact (title, vs-par, the nine hole-boxes, the take penciled in the
  // margin, the all-aces collection beneath). The header is INSIDE the card, so no separate
  // ledger header here. Pushed down a touch so the card sits centred in the dark.
  function drawSuccessClubhouse(cx, top, fade) {
    if (_flagsCelebrate) drawFlagsCelebration(cx, top - 6, fade);
    if (window.RG_ECON && RG_ECON.drawCardClubhouse) return RG_ECON.drawCardClubhouse(ctx, cx, top + 6, fade);
    return drawSuccessLedger(cx, top, fade, 'grid');   // graceful fallback if econ peeled off
  }

  // Variant 4 (journey): the calm ledger header + take on top, then the collection rendered as a
  // left-to-right PATH of worlds (EARTH · MARS · MOON receding into the dark) — a wordless map of
  // the trip and a pull toward the next island. The path is placed at a FIXED band in the dark
  // (well above the green horizon) so the world-discs float in the friendly dark, never colliding
  // with the live terrain/flag below. Only the collection rendering swaps; wallet line dropped.
  function drawSuccessJourney(cx, top, fade) {
    let y = drawSuccessHeader(cx, top, fade);
    if (window.RG_ECON && RG_ECON.drawTakeLine) y = RG_ECON.drawTakeLine(ctx, cx, y + 6, fade, false);
    // place the path centre in the dark band — max of the column's flow and a fixed floor so it
    // always clears the header yet stays above the terrain.
    const pathY = Math.max(y + 30, H * 0.46);
    if (window.RG_ECON && RG_ECON.drawJourney) RG_ECON.drawJourney(ctx, cx, pathY, fade);
    return pathY + 40;
  }

  // The completion buttons: a single primary New Run. If the Vault is unlocked, a barely-there
  // door glyph sits below it — the curious click the door; everyone else just sees New Run.
  function drawCompleteButtons(y, fade, showVault) {
    if (completeTimer <= 50) { RG._btns = []; return y; }
    const cx = W / 2, bw = 200, bh = 34, bx = cx - bw / 2;
    RG._btns = [];
    drawBtn(bx, y, bw, bh, fade, '▶ New Run', true);
    RG._btns.push({ x: bx, y: y, w: bw, h: bh, action: 'newrun' });
    y += bh + 16;
    // NOTE: the recap deliberately has NO "Launch to the Moon" button. Launching is diegetic
    // (golf out to the repaired wreck and rest beside it → RG.launchToMoon) and reachable for
    // testing via the dev cheat panel + ?goto=launch. The old gold recap launch button was
    // removed (designer call: not a default-game control).

    // The shop: a quiet secondary button under New Run (surface recaps only — the
    // Vault/Fault recaps are trophies, not a storefront).
    if (window.RG_SHOP && !RG.inVault && !RG.inFault) {
      drawBtn(bx, y, bw, bh, fade, '◈ Shop', false);
      RG._btns.push({ x: bx, y: y, w: bw, h: bh, action: 'shop' });
      y += bh + 16;
    }
    if (showVault) {
      const gw = 20, gh = 26, gx = cx - gw / 2, gy = y;
      var vseen = 0; try { vseen = parseInt(localStorage.getItem('rg-vault-seen') || '0', 10) || 0; } catch (e) {}
      if (completeTimer === 51) { try { localStorage.setItem('rg-vault-seen', String(vseen + 1)); } catch (e) {} }  // count once per show
      const newbie = vseen < 3;        // a touch brighter the first few times the door appears, then it recedes
      ctx.save();
      // barely-there, with a slow pulse so a lingering eye can find it — never advertised.
      ctx.globalAlpha = fade * ((newbie ? 0.30 : 0.17) + 0.13 * Math.abs(Math.sin(completeTimer * 0.045)));
      ctx.strokeStyle = '#f0c060'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.roundRect(gx, gy, gw, gh, 3); ctx.stroke();      // a small door
      ctx.fillStyle = '#f0c060';
      ctx.beginPath(); ctx.arc(gx + gw * 0.72, gy + gh * 0.55, 1.5, 0, Math.PI * 2); ctx.fill();   // its knob
      ctx.restore();
      RG._btns.push({ x: gx - 14, y: gy - 8, w: gw + 28, h: gh + 16, action: 'vault' });            // forgiving hitbox
      y += gh + 16;
    }
    // On the Moon, home hangs below the buttons: a small blue Earth. Click it to fly back.
    if (window.RG && RG.course === 'moon') {
      const er = 9, ex = cx, ey = y + er + 2;
      ctx.save();
      ctx.globalAlpha = fade * (0.5 + 0.2 * Math.abs(Math.sin(completeTimer * 0.04)));
      ctx.fillStyle = '#2f5fae';
      ctx.beginPath(); ctx.arc(ex, ey, er, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = fade * 0.35; ctx.fillStyle = '#7fb2e0';
      ctx.beginPath(); ctx.ellipse(ex - 2, ey - 2, er * 0.55, er * 0.38, -0.5, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      RG._btns.push({ x: ex - er - 12, y: ey - er - 10, w: (er + 12) * 2, h: (er + 10) * 2, action: 'earth' });
      y += er * 2 + 14;
    }
    return y;
  }

  function drawBtn(x, y, w, h, fade, label, solid) {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 8);
    if (solid) {
      ctx.fillStyle = 'rgba(232,160,48,' + fade + ')';
      ctx.fill();
      ctx.fillStyle = 'rgba(26,21,16,' + fade + ')';
      ctx.font = "bold 14px 'Departure Mono', monospace";
    } else {
      ctx.fillStyle = 'rgba(22,19,30,' + (fade * 0.86) + ')';      // opaque dark base so high terrain never bleeds through the button
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,' + (fade * 0.07) + ')';   // subtle lift over the dark base
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,' + (fade * 0.3) + ')';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,' + (fade * 0.85) + ')';
      ctx.font = "14px 'Departure Mono', monospace";
    }
    ctx.fillText(label, x + w / 2, y + 23);
  }

  // Our own press handler for the run-complete buttons. Registered AFTER the
  // gameplay.js mousedown listener, whose STATE_COMPLETE branch early-returns (its
  // buttons are null), so flipping state here can't accidentally start an aim drag.
  // Shared by mouse AND touch (mx,my already in game coords) so the recap buttons —
  // New Run / Launch / Shop / Vault / Earth and the open Shop's own cards — are
  // reachable on a phone, where the engine's touchstart preventDefault swallows the
  // synthetic mouse event the layer used to rely on.
  function recapPress(mx, my) {
    if (!(window.RG && RG.active) || state !== STATE_COMPLETE) return;
    if (window.RG_SHOP && RG_SHOP.isOpen()) { RG_SHOP.onClick(mx, my); return; }
    const btns = RG._btns || [];
    for (let i = 0; i < btns.length; i++) {
      const b = btns[i];
      if (mx >= b.x && mx <= b.x + b.w && my >= b.y && my <= b.y + b.h) {
        if (b.action === 'vault') RG.enterVault();
        else if (b.action === 'newrun') { _flagsCelebrate = false; RG.beginNewRun(); }
        else if (b.action === 'earth' && RG.returnToEarth) RG.returnToEarth();
        else if (b.action === 'shop' && window.RG_SHOP) RG_SHOP.open();
        else if (b.action === 'progression' && RG.openCollection) RG.openCollection();
        return;
      }
    }
  }
  // Map a client point (CSS px) into the canvas's game-coordinate space, the same
  // mapping gameplay.js uses for both its mouse and touch paths.
  function toRecapCoords(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    return { x: (clientX - rect.left) * (W / rect.width), y: (clientY - rect.top) * (H / rect.height) };
  }
  canvas.addEventListener('mousedown', function (e) {
    const p = toRecapCoords(e.clientX, e.clientY);
    recapPress(p.x, p.y);
  });
  // Touch: route the tap through the SAME hit-test. Only consume (preventDefault) on a
  // run-complete screen so in-play touch aiming is never disturbed — and use changedTouches
  // (touches[] is empty by touchend; touchstart works too but changedTouches is robust on both).
  canvas.addEventListener('touchstart', function (e) {
    if (!(window.RG && RG.active) || state !== STATE_COMPLETE) return;
    const t = e.changedTouches && e.changedTouches[0]; if (!t) return;
    e.preventDefault();   // suppress the gameplay touchstart's aim-start while the recap is up
    const p = toRecapCoords(t.clientX, t.clientY);
    recapPress(p.x, p.y);
  }, { passive: false });
})();
