# Session State / Handoff — Special Planets + Water rebuild (2026-06-22)

A fresh-context handoff. Everything below is committed unless noted. The base 3-system game is byte-identical / untouched — all new work is **peel-off + gated** (a `?flag` or `RG.course===id`); delete a file + its `<script>` tag and it's gone.

**→ Picking up work? The workday task queue is `docs/WORKLOAD-PLAN.md`** (physics lab, true complexity control, caves/overhangs, 100+ hole types, more colorful systems, backgrounds/stars, wind FX, a basic star map). Start there.

## Project facts
- **This repo (editable):** `/mnt/c/dev/indie/active/faceted-golf` — the 3-system, 37-body golf tour ("Par Sec").
- **READ-ONLY main project:** `/mnt/c/dev/indie/active/desert-golf-roguelike` — the original Earth→Moon-loop game. Do NOT edit. (Also don't touch the old editor `desert-golfing`.)
- **Dev server:** `http://172.19.97.28:8236` (WSL). Launcher with buttons for everything: `index.html`.
- **GIFs/screenshots go to** `/mnt/c/dev/editor-shots/` (= `C:\dev\editor-shots\`) — August reads them there; the terminal can't show `/tmp` inline.
- **Browse tool:** `B=~/.claude/skills/gstack/browse/dist/browse`. For concurrent agents use an isolated instance: `BROWSE_STATE_FILE=/tmp/<name>/state.json` (shared daemon = agents fight over the page).
- **Vision:** 10 systems, each potentially hiding a SECRET PLANET whose gameplay mimics an existing golf game (different striking + camera per planet). See memory `project_faceted_golf_special_planets`.

## What's live (URLs — or the index.html launcher)

### In-engine modes (gated, peel-off, base game byte-identical)
- **Golf Orbit** — `run.html?course=golf-orbit` — DONE/good. Mega-drive: power-bar launch, ball sails over a CURVED planet (gated `RG._worldCurve`), ~7s watchable arc with a glowing trail + ball halo, lands + bounds forward. Disguised as a normal hole at address (curvature/atmosphere/coins hidden until launch). File: `src/roguelike/atlas-golf-orbit.js`. Curvature trick: a shared per-x world-Y bow applied to terrain+ball+flag (so the ball stays glued to the curved ground); water/terrain drawn behind terrain via the `drawSkyBehind` hook.
- **Stickman Puzzle** — `run.html?course=puzzle` (+`&level=1` for L2) — works, NEEDS TUNING. 2D puzzle: bank off rust walls, ball sticks dead to green sticky, multi-shot to cup. Level format in `atlas-puzzle-mode.js` `PUZZLE_LEVELS`: `{w,h,tee,cup, segments:[{ax,ay,bx,by,mat}], bodies:[{points,mat}]}`, `mat` = `normal`|`sticky`. **Rough:** camera frames too tight (needs zoom-out + drag-to-peek), no trajectory-preview aim line (uses base direction arrow), dev-HUD/selector clutter.
- **Generator Showcase** — `run.html?showcase` — clean. Browse what the generator builds: COMPLEXITY slider 0.00–1.00, TERRAIN-TYPE picker, HOLE-TYPE picker (all 76 archetypes), New Seed, + a LIQUID toggle (None/Water/Lava — floods the hole via the real water system; lava = a molten waterColor). No secrets/physics clutter. File: `src/showcase.js`.
- **Water Sim (height-field)** — `run.html?watersim` — pour-anywhere water + ball splash/sink on a real hole. Now renders FLUSH (water drawn BEHIND terrain → terrain occludes the rock → water hugs every edge). **Good for static pools. Fundamental limit:** it's a per-column LEVEL model, NOT a fluid — it can't flow/spill/cascade; a big pour rises as a flat lake floating over hills, and on flat ground it stacks as a block. File: `src/roguelike/atlas-watersim.js`.
- **Particle Fluid (PBF)** — `run.html?course=particlefluid` — **BROKEN as committed.** 2D Position-Based Fluids on a real hole (narrow notch + an overhang pocket). It's meant to flow/spill/fill-under-overhangs (what the height-field can't). **Bug:** collapses into a ~1-particle clinging FILM on the terrain surface (even over peak tops) instead of pooling. A fix was in progress at handoff (see In-flight). File: `src/roguelike/atlas-particlefluid.js`.
- **Earth→Moon loop** — `run.html?loop2` — restricts the tour to earth→luna→earth… for a head-to-head vs `desert-golf-roguelike`. Default 37-body tour unchanged. (`src/planet-gen.js`, the `?loop2` itinerary override.)
- The Ascent (a Kinda Hard Golf homage) already existed: `run.html?course=climb`.

### Standalone prototypes (feel proofs — repo root / `prototypes/`)
- `prototypes/golforbit.html` (Golf Orbit), `prototypes/planetoid.html` (a general round-planet concept — the kept orbit prototype), `prototypes/stickman.html`, `prototypes/kindahard.html`.
- `water-test.html` (splash/ripple height-field), `water-fill.html` (pit fill + overflow), `water-sandbox.html` (multi-basin pour + shootable ball). Height-field playgrounds.

## Particle Fluid is BROKEN — re-fix needed (root cause FOUND)
The PBF fluid (`src/roguelike/atlas-particlefluid.js`, committed broken at f59ccea) collapses into a ~1-particle clinging FILM on the terrain surface (climbs up slopes, sits on peaks) instead of pooling. A debug agent (`ab0f797c7b083cecb`, full math in its output `/tmp/claude-1000/-home-august/b485d3fa-7129-4ec6-9c8c-a80a72b4fd90/tasks/ab0f797c7b083cecb.output`) was stopped for the context clear but **pinned the two root causes**:
1. **`spikyGrad` has the wrong sign/direction** — it returns `-∇W`, so the gradient vector points from i→j when it should point j→i (`+(p_i − p_j)`). This flips the density-correction direction.
2. **Rest density is auto-calibrated at runtime from the already-filmed packing** (got REST ≈ 0.216), so the solver accepts a thin film as "at rest." Replace with a DETERMINISTIC rest density = poly6 density of a particle in a regular/hex lattice at the intended spacing.

**To re-fix:** correct the spiky-gradient direction + use a deterministic rest density, then re-verify RIGOROUSLY — pour 300+ particles, settle 200+ frames, and confirm a multi-particle-DEEP pool with a flat top and nothing clinging to slopes/peaks (report the max stack depth in particle-diameters). The working tree was restored to the committed (broken) version for a clean slate.

## Parked — next decisions (August was about to pick a project for the workday)
I'd offered three; he hadn't chosen:
1. **Make the special-planet modes shippable** — clean the dev-HUD/selector clutter + fix the tight cameras + aim on Golf Orbit/Stickman/etc. (He flagged the in-engine modes as "kind of broken" — mostly the clutter + cameras; ask what *else* felt broken before guessing.)
2. **Build the Stickman 2D level editor** — drag-place walls/platforms, paint sticky, drop tee+cup, export the JSON format above, play-test — so he can author puzzle levels himself.
3. **Wire special planets into the tour as secret planets** — the 10-systems payoff.
- **Water later:** finish the particle fluid + decide height-field-flush vs particle per context.
- **2-project comparison:** August is running a SEPARATE agent comparing `desert-golf-roguelike` vs `faceted-golf?loop2` (Earth→Moon, same content) to decide what to keep; the deep-dive prompt (terrain gen + travel) was given to him.

## Learnings / engine notes
- **Visual-reference-first** for game-feel clones (memory `feedback_visual_reference_first`): get a reference image + research the real game BEFORE building. Golf Orbit only clicked after studying a screenshot + researching TapNation's Golf Orbit.
- **Canvas prototype gotcha** (memory `feedback_canvas_proto_init_order`): call `reset()`/init BEFORE starting the rAF loop (else blank page); add `<link rel="icon" href="data:,">` to kill the favicon 404.
- **Water tech:** height-field = cheap, great ripples + static flush pools (behind-terrain clip), but no fluid dynamics (can't flow/spill). Particle/PBF = real flow/spill/under-overhang, but finicky (stability). We did NOT use the linked SPH repo (AlexandreSajus/Unity-Fluid-Simulation — 1000 particles/3D, too heavy); built a lighter 2D PBF. August wants to experiment with the heavy-duty particle path.
- **Engine hooks (no core edits needed):** `RG._zoom`/`RG._zoomPivot` (camera zoom), `RG._meterFire` (power-bar aim interception), `RG._holeDistCap`/`RG._clampYBand` (long/tall holes), `RG._worldCurve` (orbit curvature), `RG_ATLAS.register({id,course,hooks})` with `camera/collide/frame/frameScreen/drawSkyBehind/isOOB/onRest/beforeStart`. `?course=<id>` boots a registered atlas course via `galaxy.js` (no galaxy edit) — that's the clean pattern (see `atlas-golf-orbit.js`). Some modes used a bare `?flag` + a 2-line `galaxy.js` boot instead (`?watersim`) — prefer `?course=`.
