# Handoff — Three-System Procedural Golf + Completability Root-Fix

**Session date:** 2026-06-21 · **Repo:** `faceted-golf` (standalone copy of the Par Sec engine)
**Audience:** review agents picking up this work.

> **HARD CONSTRAINT (unchanged):** the real game `/mnt/c/dev/indie/active/desert-golfing-roguelike`
> ("Space Golf" / "Par Sec") is **READ-ONLY / reference only**. ALL work here happens in `faceted-golf`,
> a standalone copy where engine edits are allowed. Nothing here is wired into the main project yet.

---

## TL;DR — what this session produced

1. **A playable 3-star-system golf tour: 37 bodies, one continuous run.**
   - **Sol** (17): Earth → Luna → Mars → Phobos → Jupiter → Io → Europa → Ganymede → Saturn → Titan →
     Enceladus → Uranus → Miranda → Neptune → Triton → Pluto → Charon.
   - **TRAPPIST-1** (11): red dwarf star + 7 tidally-locked planets (b–h) + 3 invented moons (geryn, fenra, elai).
   - **Barnard's Star** (9): ancient red dwarf + b/d/e + Solace, Tidewell, Veil, Hollow, Ember.
   - Ends on the **Barnard's Star** surface (grand finale). Each system's star is its last course.
2. **Completability fully root-caused and fixed** — **2960/2960** hole-runs complete (every hole, 80 random
   seeds per body, all 37 bodies). No concede/skip hacks; holes are genuinely sinkable.
3. **~28 new hole archetypes** (12 generic variance + 8 TRAPPIST-themed + 8 Barnard-themed).
4. **Itinerary chaining** wired end-to-end (0 missing course links); `?course=` URL bug fixed.

**All committed.** Working tree clean. See the commit list at the bottom.

---

## Completability — the core engineering (the part worth reviewing closely)

The original problem: the headless validator passed holes the real bot **could not actually sink**, so random
seeds produced permanently-stuck holes mid-run. Root causes, found and fixed in order:

1. **Validator framed the wrong camera.** `_validateHole` in `src/level-design.js` followed the ball
   (`camera.x = ball.x - W*0.25`) instead of the real per-hole camera. `isBallOffScreen()` is camera-relative,
   so the validator was **blind to the OOB walls the real bot hits**. → Fixed: the validator now calls
   `setHoleCamera(h)`, exactly like real play.
2. **It accepted "rest near the cup" instead of a real sink.** The lenient pass (`minD < CUP_WIDTH * 2.2`, later
   1.3, 0.9) let a ball that comes to rest *near* the cup on a slope/shelf — then rolls off — count as success.
   `simulateShot.distToCup` is a **rest** distance, so this passed low-gravity roll-offs. → Fixed: the validator
   now **requires `r.scored`** (an actual sink) within 20 shots; the lenient is a tiny 0.28-cup-width tap-in only.
3. **Several archetypes placed cups where the ball can't settle** (mostly bites on low-gravity worlds). Fixed the
   geometry so each cup sits on a landable surface:
   - `ruins` — cup moved into an **open plaza** (was wedged beside a tall column).
   - `rolling_hills` — hills confined to the front ~62%, then a **wide flat green with the cup mid-green**.
   - `spire_drown` — crown is now a **shallow gathering bowl** (works at 0.42 g / elai).
   - `shelf_drop_shelf` — added a **flat tee runway + capped first shelf** so the ball is never trapped at the tee.
4. **More re-roll attempts.** `_genValidatedHole` `LAST` 13 → **24**, so rare bad seeds reliably find a sinkable
   variant instead of exhausting.

**Verification:** `tools/verify.cjs` loads the real engine headless and plays every hole with the real bot
(`aiUpdate()+update()`, full stuck-escalation). Final sweep: **2960/2960** across all 37 bodies × 80 seeds.
The harness was enhanced to report each stuck hole's **archetype + overhang flag** (see the fail line format
`seedN@hH[archetype+ovh](why)`).

```
node tools/verify.cjs earth,luna,mars,...,barnard_star 80      # all bodies, 80 seeds
node tools/verify.cjs titan geom 103947                        # dump a seed's geometry to reproduce a hole
```

---

## How content is defined (for extending — e.g. a 4th system)

- **Courses:** `src/planet-gen.js` — three array tables (`SOLAR`, `TRAPPIST`, `BARNARD`), each row
  `[id, name, material, sky, gravity, archetypes[], [dMin,dMax], waterBias|null, surfCol, deepCol, special, atIdx]`,
  built into `COURSES[id]` by a shared loop. Overhangs/specialHoles/water set after the loop. Difficulty is a
  **0–1 scale** clamped per course (NOTE: design agents sometimes emit 0–10 — normalize before integrating).
- **Materials (palettes):** the `CUSTOM` map in `planet-gen.js` — `name: ['rock'|'sand'|'ice'|'grass', '#hex']`
  (base sets physics, hex sets colour).
- **Archetypes:** `src/level-design.js` — add a method to the `archetypes` object
  `name(sx, sy, dist, cupY, diff){ return [{x,y},...,{x,y,cup:true},...] }` (heightfield vertices, one marked
  `cup:true`), **and** an `ARCHETYPE_TABLE.push(['name', 0.0, 5.0, 1])`. **Sinkability rule:** cups must sit on a
  broad landable surface (basin/flat/gentle pocket), never an isolated narrow ledge over a void.
- **Itinerary + chaining:** `window.SOLAR_ITINERARY` (in `planet-gen.js`) is the ordered 37-id list. The travel
  trigger is generic in `src/roguelike/wrap.js` (~line 99): on `STATE_COMPLETE` it `_beginTravel(itin[idx+1])`.
  Extending the itinerary auto-chains, as long as every id has a `COURSES[id]`.
- **`?course=` URL:** `run.html` regex fixed to `[a-z0-9_-]+` (was missing the underscore, so `barnard_star`
  etc. silently fell back to earth-course).

---

## Known issues / NOT verified (be honest about these)

1. **Headless full-run video with travel cutscenes does not work.** The travel animation (rise→hold→descend) is
   `draw()`/wall-clock driven, and the engine **skips `draw()` when the tab is "hidden"** — with a hidden-mode
   driver for the *old* crane but **not** the seamless travel sequence the itinerary uses. In session 1 the
   headless tab was effectively visible (travels recorded fine); this session it's treated as hidden, so travels
   freeze at "rise." The delivered video is therefore a **per-world montage** (each world played to completion,
   no transitions). The continuous travel-linked run **works in a real browser** (the playtest link).
   - **Real fix if wanted:** add a hidden-mode driver for `_travelSeq` in `src/roguelike/run.js` (mirror how
     `_tickCrane` is hand-driven when `document.hidden`).
2. **Aesthetics are only lightly verified.** ~8 of 37 courses were visually spot-checked; one muddy palette fixed
   (TRAPPIST-1e → teal-green). The other ~30 are completability-verified but **not** art-reviewed. Holes are
   *varied* (confirmed) but not all confirmed *good-looking*.
3. **Agent-generated content has uneven thematic fidelity.** Some archetypes don't render like their narrative
   (e.g. Tidewell's "weed-mats" came out as tall pillars, not low floating mats). Completable, but off-theme.
4. **Breadth over depth.** 37 procedurally-themed bodies; none hand-tuned for *feel*. The original project was a
   game-feel study — this session went wide.
5. **`verticalCam`** (opt-in per-hole vertical camera) exists in `setHoleCamera` but is **off** — a pan can't help
   holes taller than the screen; a per-hole zoom-out would be the real approach (not built).

---

## How to play / test

- **Playtest (real browser):** server runs `python3 -m http.server 8236 --bind 0.0.0.0` in WSL.
  `http://localhost:8236/run.html?course=earth` (or `http://172.19.97.28:8236/...`). Click-drag to shoot; **A** =
  autoplay bot. `?course=earth` plays the full 37-body tour via the travel transitions. Swap `?course=` for any
  body (now that the underscore bug is fixed).
- **Headless QA:** `tools/verify.cjs` (above).

## Recommended next steps (my opinion)

1. If the video matters: add the `_travelSeq` hidden-mode driver so headless recording captures travels.
2. Do a real **aesthetic/feel pass** on the 37 worlds (watch each, fix off-theme archetypes, tune palettes)
   rather than adding a 4th system.
3. Only after that's solid: consider wiring selected worlds into the main project (per the standing constraint,
   "we'll wire this in if it's good at a later time").

## Key commits (this session)

`8a2c2a0` validator requires actual sink + spire_drown bowl + shelf_drop_shelf runway + 24 re-rolls ·
`dc85104` ?course underscore fix · `2da20de` Barnard's Star system · `0304c08` TRAPPIST-1 system + 20 archetypes ·
`3e1d7ea` Phase-A variance (wider pools, overhangs, Earth simple) · earlier: water modifier, cup-anywhere,
set-pieces, the Earth→Pluto solar tour.
