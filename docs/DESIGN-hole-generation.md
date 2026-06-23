# Design Direction — Hole Generation (DISCUSSION DRAFT, 2026-06-22)

Status: **proposal for August to react to.** Nothing built from this yet. Pairs with the visual
dream board (`editor-shots/dreamboard-*.png`) — "what we want" — and this doc — "how we generate it."

## The problem we're solving
The current generator **stamps one discrete archetype per hole** onto a single-value heightfield, then
runs the autoplay bot to reject anything unsolvable. Result: holes read as "fine but samey," and caves
feel bolted-on. The diagnosis (confirmed by both the reference teardown and the paradigm survey):

1. **One hole = one labeled shape.** The player's brain pattern-matches "ah, a mesa / a canyon." Variety
   = *which template from a finite deck*, not novel terrain.
2. **No macro-narrative within a hole.** Most archetypes are one feature padded with flat — no authored
   tee→landing→hazard→green pacing. (`complex_composite` chains features but *randomly*, so it reads
   "busy," not "designed.")
3. **Complexity is quantitative, not qualitative.** Cranking difficulty raises amplitude/feature-count,
   not *interestingness* (risk/reward, multiple lines, a tempting carry).
4. **The heightfield can't do the genre's best moments** (true caves/overhangs/tunnels/tucked pins) —
   they're faked as sparse convex slabs that fight completability.
5. **Validation is a pass/fail gate, not a quality filter.** `_validateHole` only asks "can the bot sink
   it in ≤20?" A trivial 1-putt and a brilliant 3-shot carry score identically. **The generator never
   optimizes for "great" — only "not broken." This is the biggest unused lever.**

## What the genre's best actually do (reference: Desert Golfing & Golf on Mars, both by Justin Smith)
- **Not archetypes.** "Every hole is procedurally generated — I never place a vertex. I tweak the
  high-level parameters to the algorithm for stretches." → **one continuous noise heightline, windowed
  into holes**, with parameters ramped over hole-ranges.
- **The idiosyncrasy rule:** `if Random(10000)==0 { do fun stuff }`. The holes people *remember* (DG's
  hole 48, the floating-block hole 1930, the first rock) are **rare injections against a calm baseline.**
  Eventfulness only lands because most holes are quiet.
- **One continuous world**, not discrete courses — a *journey*, not a level-select. (Core emotional engine.)
- **Feel > geometry.** Memorable holes feel good because friction/restitution/damping are dialed in
  (Box2D). → budget tuning on physics (our Physics Lab), not on authoring more shapes.
- **Progression = a slowly drifting palette**, not stars/XP.
- **Failure modes to avoid:** impossible/luck holes (we have `verify.cjs` — good), trap objects with no
  counterplay, and "sameness without the palette journey."

## Recommended direction — a hybrid **composed-signal** generator with **quality-diversity selection**
Don't replace the engine. Replace *the thing that decides a hole's shape*, and *wrap the validator into a
selector.* Keep the heightfield, the set-piece slab collision, and the autoplay bot.

A hole becomes a **composed signal**, not a deck draw:

1. **Narrative spine (low-freq "story").** Pick a hole *concept* (descent / carry-then-climb /
   plateau-hop / gather-bowl / tucked-pin), parameterized by difficulty → 3–5 control points
   `tee → landing → hazard → green` as a monotone spline. Guarantees pacing & playability *by construction*.
2. **Meso operators (composable features, additive + smin/smax blended).** Stack à-la-carte kernels onto
   the spine: plateau (opposed smoothsteps), cliff step (smoothstep), bump/bunker (±gaussian), dune patch
   (windowed fBm). **Operator count/scale = the real complexity knob** — adds *structure* (a tempting
   shortcut plateau, a bunker guarding the pin), not just amplitude.
3. **Noise skin + terrace + thermal pass (the faceted look, ~free).** Small global fBm so nothing is
   glassy; `round(e·N)/N` terracing for our angular mesa/cliff facets; a thermal angle-of-repose pass that
   **guarantees every slope is ball-traversable** (kills the low-g "rolls off forever" stuck class).
4. **Caves as a REAL layer (where wanted).** Local SDF/metaball field → coarse marching-squares →
   convex-decomposed polygons, emitted through the *existing* set-piece collision. A capsule subtracted
   from a slab = a true tunnel. Generalizes the 6 hand-authored caves into a parametric cave generator,
   same collision, infinitely more variety, still convex-validated. Coarse contour = stays flat-faceted.
5. **Quality-Diversity selection (the keystone — turns "fine" into "great").** We already own the
   simulator, so this is cheap: **generate K candidates (6–12), score each, keep the best.**
   - Hard gate (have it): bot sinks in ≤20.
   - Interestingness objective (new, ~a day): shot-count in a target band (2–4), "requires a carry,"
     "≥2 viable lines / a real decision," elevation variety, anti-frustration penalties.
   - Optional **MAP-Elites:** bin candidates by feature (elevation-change × hazard-count), keep the best
     *per bin*, so a planet's 9 holes are *different kinds of great*, not 9 of the same winner. Directly
     kills "samey."

### Why this beats the deck
- Authored mapping × noisy input = *designed shapes with organic variety* (Minecraft-1.18's spline-over-
  noise insight). No two holes identical; all have a story.
- Complexity becomes *qualitative*.
- The generator finally **optimizes for greatness + diversity** (the unused lever).
- Completability preserved & strengthened (spine + thermal + existing bot gate); add a Golf-on-Mars
  stroke-count **skip** as a belt-and-suspenders net.
- Caves stop being a constrained special case.
- **Archetypes survive — demoted to the "signature / surprise" library** (the What-the-Golf move): the
  composed generator drops a hand-authored standout in occasionally, via the idiosyncrasy rule. Keep the
  curated gems; stop making every regular hole a deck draw.

## Incremental, low-risk migration (nothing flips at once)
1. **Cheapest immediate win, isolated:** add the interestingness objective to `_genValidatedHole` as
   **generate-K-keep-best** — this lifts the *current* archetype generator's quality TODAY, measurable in
   `node tools/verify.cjs all 3`. Do this first regardless of the rest.
2. Build `gen:'composed'` behind a flag; prototype in the existing `tools/noise-proto.cjs` (August already
   started a noise+terrace proto) + the `?showcase` viewer.
3. Roll `composed` onto 1–2 new planets; compare vs archetype planets in showcase; expand.
4. Generalize caves into the SDF→marching-squares→slab path once the 2D pipeline is proven.

## Open decisions for August (let's agree before building)
- **D1 — Continuous world vs discrete holes?** The genre's core is one unbroken traversed silhouette; we
  do discrete holes-per-planet. Adopt continuous (per planet, or across a system)? Big identity call.
- **D2 — Lead with the QD lever?** Add generate-K-keep-best + interestingness to the *existing* generator
  now (fast, big quality lift) before/while building `composed`? (Recommend: yes.)
- **D3 — Archetypes → signature library only?** Demote the 183-deck to occasional hand-authored standouts
  + injected by the idiosyncrasy rule, not the main path? (Recommend: yes.)
- **D4 — Build the real SDF cave layer?** Commit to it vs keep faking caves sparingly.
- **D5 — Adopt the idiosyncrasy + palette-journey identity?** Rare `1-in-N` landmark holes against a calm
  baseline + a slowly drifting palette as progression.

## Key files for the work
`src/level-design.js` (generator + `_validateHole`/`_genValidatedHole` ~5579) · `src/planet-gen.js`
(course catalog) · `src/set-pieces.js` (convex slab collision) · `tools/noise-proto.cjs` (August's
noise+terrace proto to extend) · `tools/verify.cjs` (headless harness to score against) · `src/showcase.js`.
</content>
