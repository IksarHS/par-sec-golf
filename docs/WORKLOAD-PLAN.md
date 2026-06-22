# Workload Plan — core gameplay, hole gen, content, polish, star map (2026-06-22)

From August's brain-dump. Goal: keep advancing the CORE (shot feel + hole generation) + add content + one basic meta screen, mostly autonomously, with a few "labs"/UI experiments that need August's eye. Read `docs/SESSION-STATE.md` first for current state.

## Game vision (captured — grounding, not for building yet)
Start on **Earth → play the solar system**. Performance unlocks new planets, then new **solar systems**. Travel out, discover new planets/golf. CORE = desert-golfing-on-Mars procedural-hole golf; along the way, **special planets/systems** with new mechanics (Golf Orbit, Super Stickman, Only-Up / Kinda-Hard, an incremental-golf planet, …). Far out the galaxy → a **final extragalactic planet** with **infinite golf** using the full generator = beating the game → **new game+**.
**Tabled for later** (known, not now): full game flow (start/pause/travel screens), metagame (progress tracking, unlock system, base narrative, per-planet scores + improvement + rewards). The ONE meta piece wanted now is a basic star map (P9). Right now: keep building the CORE + content; be COLORFUL, not rocky/dreary.

## Priorities (ordered for the workday)

### P1 — Physics Lab (tuning tool) — NEEDS AUGUST'S EYE
Dial how shots FEEL + how the ball ROLLS. Build a gated `?physlab`: a clean test hole + a couple preset terrains (flat / slope / mixed materials), live sliders for the real feel knobs — launch power curve, gravity, air drag, restitution, rolling friction, surface friction, spin↔roll coupling, stop threshold — applied live to the real engine ball, plus a "repeat last shot" A/B button and a readout of the current values (so he can copy them back). Source: `src/gameplay.js` physics + `src/shared.js` MATERIALS. Deliverable: `?physlab` + GIF.

### P2 — Ball-striking UI iterations — NEEDS AUGUST'S EYE
Make striking feel interactive/alive. Produce 3–4 DISTINCT variants (gated/toggleable): e.g. (a) timing+power meter (charge→release), (b) drag-back with a live trajectory-preview arc + power ring, (c) two-stage power-then-accuracy, (d) "pull + tension" with squash/recoil juice. Side-by-side GIFs so August picks a direction. Deliverable: variants + GIFs.

### P3 — Hole gen: TRUE complexity control — CORE
The complexity 0.00→1.00 line currently mostly stretches the horizontal theme; it should control REAL terrain complexity. Investigate `src/level-design.js` (generateHoleTerrain, getDifficulty) + `planet-gen.js`. Rework so complexity adds genuine intricacy — vertical drama, features (humps/plateaus/steps/hazards), archetype variety, cave/overhang frequency — a real "simple → intricate" axis. Verify in `?showcase` that the slider visibly ramps true complexity. Keep completability (verify harness). Deliverable: reworked complexity + showcase proof.

### P4 — Caves + overhangs — CORE (big missing design space)
Real cave structures + overhangs (cup-under-a-lip, tunnels, cantilevers). The heightfield can't do this alone — use atlas-blocks (circle-vs-AABB) / set-pieces (swept circle-vs-polygon) as the collision basis. Build a small set of PLAYABLE (bot-validated) cave/overhang archetypes that look great: cup-under-lip, a cave you putt into, an overhang you go under/around. Gate onto the dramatic planets. Deliverable: archetypes + GIFs + completability.

### P5 — 100+ new hole types — CORE (variety/content)
≥100 NEW, visually DISTINCT archetypes — think outside the box so holes look different from each other across a playthrough. Run as a generate→render→curate WORKFLOW: idea-agents invent archetype concepts (silhouettes/gimmicks), implement them, render each in the showcase, a critic curates the genuinely-distinct, good, PLAYABLE ones (validate each). Categorize by silhouette/theme so courses pick varied sets. Deliverable: big archetype batch + a montage; the generator pool grows a lot.

### P6 — More content: 2+ more galaxies/systems — CONTENT
≥2 more real-galaxy systems with dreamed-up planets/moons, COLORFUL + varied (jade/teal/violet/amber/coral/ice — not brown rock). Pick real galaxies/systems (Andromeda, a Magellanic cloud, a real exoplanet system, …), invent plausible bodies each, add to the itinerary/`planet-gen.js` with their own archetype subset + materials + sky + water/lava bias. Verify completability + palette variety (montage). Deliverable: 2+ new colorful systems; tour extends.

### P7 — Backgrounds + stars — POLISH
Fix the hole-transition FLICKER (likely star regen / parallax reset on hole change) + make the background less static: parallax star layers, subtle drift/twinkle, per-system color/density variety, maybe nebulae/distant galaxies on deep-space worlds. Alive but not distracting. Deliverable: flicker fixed + richer background (before/after GIF).

### P8 — Wind: particles + indicator — POLISH
Wind already exists mechanically. Add wind PARTICLES (streaks/dust/leaves drifting in the wind dir, density/speed scaled to strength) + a `[WIND ↗ x MPH]` HUD indicator (direction arrow + speed). Deliverable: wind FX + indicator (GIF).

### P9 — Star map (basic) — META (the one meta piece wanted now)
Reference: the Fortune Mill shop map — a spiderweb of NODE BOXES; start with ONE unlocked (Earth, center), and as you progress NEW nodes appear to unlock, branching out; eventually a node opens a NEW SYSTEM (a layer up) with its own starter, spiderwebbing outward. Build a gated `?starmap` screen: the node-graph layout, start-with-Earth + unlock-reveals-neighbors, connecting lines, "you are here," and click an unlocked planet → travel (boot that course). Keep it BASIC + clean — node boxes like the Fortune Mill shop (planet icon + a level/score), branching lines, lock/unlock states. Don't build the unlock economy yet — just the map layout + reveal/travel, wired to the existing courses/itinerary. Deliverable: `?starmap` + GIF; basic, expandable.

## Execution notes
- P3–P8 I can run largely autonomously (build → test in-engine → screenshot/GIF → review + commit). P1, P2, P9 produce TOOLS/UI for August to react to when back.
- Everything stays peel-off + gated; the base game + 3-system tour stay byte-identical unless a task explicitly extends them (P3 complexity, P6 content) — and those KEEP COMPLETABILITY (run `node tools/verify.cjs ...` per docs).
- Commit each deliverable + drop a GIF in `/mnt/c/dev/editor-shots/` + log progress, so the whole batch is reviewable when August is back.
- Suggested order: P1 + P3 + P4 in parallel early (core), then P5 (the big hole-gen workflow) + P6 (content) running long, P7/P8 (polish) + P9 (star map) alongside, P2 (UI variants) when there's a moment. Adjust as findings land.
