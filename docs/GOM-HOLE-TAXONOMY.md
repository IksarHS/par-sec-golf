# Golf on Mars — Hole Design Taxonomy

**The definitive "what GoM does that we don't, and how to do it" document.**

Purpose: stop collapsing Golf on Mars' (GoM) whole design vocabulary down to the single
word "overhang." GoM and its predecessor Desert Golfing (DG) procedurally produce a much
richer *range* of hole shapes than our generator currently covers. This document catalogs
that range from a wide visual + textual sampling, dissects the geometry of each archetype,
states the generation capability each one requires, explains why each is hard for our
current pipeline, and synthesizes the minimal capability set + a concrete generation
strategy that covers the whole range cleanly with reachable cups.

Author note: all imagery below is real GoM/DG gameplay, downloaded and visually analyzed.
Sample image paths are under `/tmp/gom-samples/` (see Appendix A). Sources in Appendix C.

---

## 0. Ground truth corrections (important — read first)

Before the taxonomy, three facts from research that **correct assumptions in our brief**:

1. **GoM does NOT guarantee every hole is sinkable.** Reviewers and the dev confirm GoM
   *does* serve up genuinely impossible holes — most dramatically a "sheer cliff your most
   powerful shot cannot beat." GoM's actual answer to unreachability is **a brute-force
   escape hatch: after 25 strokes on a hole, a "skip" button appears** and you jump to the
   next section. So GoM did *not* solve guaranteed-reachable cups by clever construction —
   **it tolerates failure and provides a skip.** This matters: we have been trying to solve
   a problem GoM never fully solved. (Desert Golfing *was* later patched to remove impossible
   holes and cap at hole 10,001, suggesting reachability there is enforced by
   *post-generation validation/curation*, not by a reachability-invariant generator.)

2. **GoM is orchestrated by "biome/stretch," not per-hole hand authoring.** Justin Smith:
   *"Every hole is definitely procedurally generated. I never manually place a vertex... There
   is a certain amount of orchestration though, where I tweak the high-level parameters to the
   algorithm for stretches."* So the generator is one parameterized system whose *parameters
   drift* over long runs (flatness, jaggedness, obstacle density, palette). The dramatic
   overhang/cave holes are **the same generator at a high-"chaos" parameter setting**, not a
   different subsystem.

3. **GoM is a continuous world, not discrete holes.** The cup of hole N is the tee of hole
   N+1; the camera never resets, it pans/follows the ball (you can overshoot into the *next*
   hole's terrain and have to come back). This is a hard constraint on shapes: **every hole's
   terrain must butt seamlessly against its neighbors on both sides**, and the tee point is
   inherited. Our per-hole offscreen polygon caches are fighting this; GoM is one continuous
   terrain strip.

---

## 1. The two-layer mental model of GoM terrain

Looking across the whole sampling, GoM terrain decomposes cleanly into **two layers**:

- **Layer A — the silhouette (the solid/sky boundary).** This is the big shape: where solid
  terrain meets sky. *Most* holes' silhouette is a **heightfield** (one ground height per x):
  rolling hills, ramps, V-notches, plateaus. A *minority* of holes' silhouette is
  **non-heightfield**: overhangs, caves, hooks, undercuts, disconnected masses, where a
  vertical line crosses sky→solid→sky→solid. The cup is a small notch cut into this boundary.

- **Layer B — accents/obstacles painted on top.** Free-standing **grey rock spikes/pillars**,
  green **cacti** (sticky), blue **water lakes** (slow), **sand** patches (slow), drifting
  **clouds** (speed-sapping), **metal hunks / windmills** (bounce or stick), and the occasional
  **falling stone**. These are not silhouette geometry — they're sprites/small polygons with
  their own material, sitting in front of or on the silhouette.

**Key realization:** the "overhang vocabulary" we've been fixated on lives entirely in *when
Layer A stops being a heightfield*. But a huge fraction of GoM's *variety and difficulty*
comes from **Layer B accents and cup placement**, which are independent of whether the
silhouette is a heightfield. We have been trying to buy all of GoM's richness through one
expensive non-heightfield silhouette mechanism, when most of it is cheap Layer-B + cup-placement
work that even a pure heightfield supports.

This split drives the synthesis in §4.

---

## 2. The archetype catalog

Each archetype below: **(a)** description + example image, **(b)** precise geometry,
**(c)** generation capability required, **(d)** why it's hard for *our* current pipeline,
**(e)** how to generate it cleanly.

Archetypes are grouped into **Heightfield-expressible** (Layer A is still a function of x)
and **Non-heightfield** (Layer A folds back over itself). Then Layer-B accent archetypes.
Then cross-cutting "situation" archetypes (about cup placement / shot demanded).

### GROUP I — Heightfield silhouettes (the common case, ~70–80% of holes)

#### I-1. Gentle roller (the baseline)
- **(a)** Example: `steam_06.jpg` (hole 193), `steam_01.jpg` (hole, tee shot), `itch_01.png`.
  Smooth low rolling hills, tee on one flat, cup in a shallow notch on another flat a medium
  carry away. The "70% case."
- **(b)** Heightfield `surface(x)` = sum of a few low-frequency sine/noise octaves, gentle
  slopes (< ~30°), amplitude small relative to screen. Cup = a narrow rectangular/trapezoidal
  notch (~1.5 ball-widths) cut downward into the surface, with a flat lip on at least one side.
- **(c)** 1D heightfield + a notch-cutter. Trivial.
- **(d)** **Not hard** — our rejected "faceted Earth" heightfield did this perfectly and
  cleanly. This is the proof that a heightfield is the right *base* representation.
- **(e)** `surface(x)`, place cup on any locally-flat-ish x, cut notch. Done.

#### I-2. Faceted ramps & big flats (the GoM "look")
- **(a)** Example: `steam_03.jpg`/`itch_02.png` (hole 575), `steam_07.jpg` plateaus (351's tops).
  Long dead-straight diagonal ramps, large flat plateaus, sharp corners. The signature angular
  GoM silhouette: few long edges, big flats, steep diagonals.
- **(b)** Heightfield made of **long straight segments** (piecewise-linear), not curves:
  e.g. flat → steep up-ramp (45–60°) → flat plateau → steep down-ramp. Corners are sharp
  vertices, not fillets.
- **(c)** Piecewise-linear heightfield with **few, long facets** and **steep allowed slopes**.
- **(d)** **Not hard in principle**, but our field→marching-squares→Douglas-Peucker pipeline
  *fought* this: simplifying a marching-squares contour down to a few long facets is exactly
  where the **self-intersection lacerations** came from. We were generating curves and then
  trying to *recover* straightness by simplification. A heightfield emits straight facets
  directly with zero simplification.
- **(e)** Generate the heightfield as an explicit short list of `(x, y)` corner vertices with
  long straight runs between them; never go through a field/contour at all.

#### I-3. Sharp V-notch valley / funnel
- **(a)** Example: the dip in `steam_06.jpg` (right side), valley floors throughout.
  A steep-walled V or U valley; ball funnels to the bottom; cup often at/near the low point.
- **(b)** Heightfield with two opposing steep slopes meeting at a low vertex (V) or a short
  flat (U). Acts as a catch basin — forgiving because everything rolls to the cup.
- **(c)** Heightfield + ability to place steep opposing slopes; cup at the local minimum.
- **(d)** **Not hard.** Cup-at-local-min is the *easiest* reachability case (gravity helps).
- **(e)** Place two steep segments meeting low; cup at the bottom vertex.

#### I-4. Plateau-top cup / "shelf" cup (carry + stick the landing)
- **(a)** Example: `steam_03.jpg` (hole 575, cup 181 on the high plateau), `yt_thumb.jpg`
  (hole 40, cup far right on a lower flat behind a big hump).
- **(b)** Cup sits in a notch on top of a **raised flat plateau**, reached by carrying over a
  ramp/hump. The challenge is **landing on and stopping on the elevated flat** without rolling
  off — a precision-distance shot, not a power shot.
- **(c)** Heightfield + cup on an *elevated* flat + enough flat width that a landed ball can
  settle. Reachability requires the carry distance/height be within shot envelope.
- **(d)** **Moderately hard for reachability** but heightfield-expressible. Cup-on-a-high-flat
  is where our autoplay bot stalls most often: too high / too far / lands and rolls back off.
  Not a *representation* problem — a *cup-placement/validation* problem.
- **(e)** Heightfield fine; the fix is **placement validation** (§4.3): only keep the cup if a
  simulated solver can land+settle there.

#### I-5. Long dramatic carry / cliff edge
- **(a)** Textual: "sheer cliff your most powerful shot cannot beat" (the impossible-hole case).
  Also `yt_thumb.jpg` is a milder version: big hump then a long low run to a distant cup.
- **(b)** A tall vertical or near-vertical wall, or a very long gap, between tee and cup.
  At the extreme it exceeds the shot envelope → impossible.
- **(c)** Heightfield with steep walls + long spans. *The danger archetype for reachability.*
- **(d)** **This is the failure mode**, not a feature we want to reproduce faithfully. GoM
  literally ships these and falls back to the skip button. For us, this is what placement
  validation must *reject* (or we add our own skip).
- **(e)** Generate freely, then **validate**; if no solver path exists within N strokes,
  regenerate the cup (or the wall height) — don't ship it.

### GROUP II — Non-heightfield silhouettes (the dramatic minority, ~10–20%)

These are the holes that *cannot* be a heightfield. This is the real "design freedom" the
brief is chasing. Note they are **rare** — GoM uses them as spice, not the staple.

#### II-1. True overhang / cantilevered shelf
- **(a)** Example: `steam_07.jpg` (hole 351). A central red plateau **cantilevers** with sky
  beneath it; below that a grey-floored shelf; below that more sky; then solid. A vertical line
  through the middle crosses solid→sky→solid→sky→solid. Multi-level stacked plates.
  Also `steam_02.jpg` (hole 148): the cup-bearing plateau on the right **undercuts** the water
  basin — the red mass overhangs the blue lake.
- **(b)** The solid/sky boundary is **multivalued in x**: an upper surface AND a lower
  (ceiling) surface over the same x-range. Geometrically it's a stack of horizontal-ish
  **plates** (slabs) offset vertically, joined at their ends, with sky gaps between.
- **(c)** A representation that allows **multiple solid spans per column** — i.e. NOT a
  heightfield. Cleanest: terrain as a **set of solid polygons (slabs)** unioned, or a
  per-column **list of solid intervals** `[y0,y1],[y2,y3]` (a "span buffer").
- **(d)** **This is exactly what broke us.** Our field→marching-squares→contour→simplify
  pipeline *can* represent it but (1) simplification self-intersects (lacerations), (2)
  mass-vs-cave fill classification is fragile when a concave mass's centroid lands in a sky
  pocket, (3) neighboring higher plates render over a cup notch. All three bugs in the brief
  are *symptoms of trying to get overhangs from a field*.
- **(e)** Build overhangs by **stacking explicit convex-ish slab polygons** (each slab is a
  simple quad/hexagon), or by **CSG: start from a heightfield solid and subtract sky pockets**
  (rectangles/wedges) to carve the undercut. Both produce clean straight edges, no contour
  extraction, no self-intersection. Render = fill each slab; collision = circle-vs-polygon per
  slab. See §4.2.

#### II-2. Enclosed cave / pocket (cup inside)
- **(a)** Example: `itch_03.png`/`steam_04.jpg` (hole 134). A big sky pocket scooped into the
  red mass; a hooking lip of terrain curls partway over it; a downward red spike intrudes from
  the upper right; the cup (42) sits at the **bottom of the enclosed pocket**, reached by
  dropping in from the mouth. Also `tapsmart.png` (hole 156): a mushroom-shaped overhang lip
  creating a small pocket of sky tucked under it.
- **(b)** A **concave sky region partly enclosed by solid on top/sides** — a "C" or hook of
  terrain. The cup is interior; the only entry is a mouth/gap in the enclosing solid. Often
  combined with an inward-pointing **spike** that narrows the entry.
- **(c)** Same multi-span representation as II-1, plus the cup-placement logic must understand
  the cup is reached by **entering through the mouth and dropping**, not by an arc onto a flat.
- **(d)** Hard for us on **two** axes: representation (as II-1) AND reachability (the cup is in
  a pocket; a naive arc shot hits the enclosing ceiling). Our solver/placement has no notion of
  "thread the mouth then drop."
- **(e)** Generate the **mouth/corridor first** (the reachable sky channel from tee region into
  the pocket), then grow solid around it leaving that channel open (§4.3 "carve the corridor").
  Cup at the pocket floor. This guarantees an entry path by construction.

#### II-3. Hook / curl (single curling lip)
- **(a)** Example: `tapsmart.png` (hole 156, the mushroom blob), the curling left lip in
  `steam_04.jpg`.
- **(b)** A finger/blob of terrain that **curls back over itself** — a milder, single-lobe
  overhang. One upper surface that folds to create a small undercut.
- **(c)** Multi-span / slab representation (lighter than full II-1).
- **(d)** Same root cause as II-1 (heightfield can't fold). Lower difficulty because it's a
  single lobe — but our pipeline doesn't get easier with simpler overhangs; the contour math
  is the same.
- **(e)** A single subtracted wedge under a heightfield lip, or one extra slab. Cheap with CSG.

#### II-4. Disconnected / floating mass & sky-island
- **(a)** Example: `steam_07.jpg` (hole 351) has a grey block on the right separated from the
  main red mass by sky; `steam_05.jpg` (hole 208) has multiple solid masses with sky between.
  Pure floating *islands* are rare but the **disconnected-mass** pattern (two solid bodies with
  sky between, ball must cross) is common.
- **(b)** Two or more **separate solid components** in one hole. (A true floating island = a
  solid component with sky entirely around it; more commonly it's two ground masses with a sky
  gap, i.e. a chasm.)
- **(c)** Terrain = a **set/list of polygons** (not one polygon, not one heightfield). Render
  and collide each independently.
- **(d)** Our pipeline assumed **one closed loop per hole** and did even-odd fill + a single
  mass-vs-cave classification. Multiple components break the classification and the single-loop
  assumption outright.
- **(e)** Native to a **polygon-set representation**: just emit N polygons. (Reinforces that
  "set of simple polygons," not "one loop," is the right model.)

#### II-5. Threadable narrow channel / slot / "hole in the wall"
- **(a)** Textual (dev/reviews): *"hole-in-the-wall sections where you go over, under, and
  between walls,"* *"holes require you to go a long way right to come back in a cave below the
  surface."* Visually, the narrow cup slot guarded by the grey spike in `steam_05.jpg` (208).
- **(b)** A **narrow sky channel** through solid (a slot or tunnel) that the ball must thread,
  possibly underground; or a vertical gap between two walls. Width ~2–4 ball diameters.
- **(c)** Multi-span representation (a tunnel is sky bounded above and below by solid) + a
  generator that keeps the channel wide enough to thread.
- **(d)** Representation hard (as II-1) **plus** reachability is a *threading* problem, not an
  arc — our solver can't aim through slots.
- **(e)** **Corridor-first** generation again (§4.3): lay down the playable sky channel as a
  swept capsule from tee toward cup, then fill solid everywhere else. The channel is open by
  construction, so it's always threadable.

#### II-6. Deep well / pit (cup at the bottom)
- **(a)** Textual: reviewers cite *"massive pits"* that can swallow the ball; the cup notch in a
  deep slot (208) is a mild version.
- **(b)** A deep narrow vertical shaft with the cup at the bottom; walls steep enough that a
  ball that enters can't easily roll out. Mouth must be hittable.
- **(c)** Heightfield *can* do an open-topped pit (it's still one-y-per-x if walls are
  vertical-ish), but a **bottle-shaped** pit (narrow neck, wide belly) needs multi-span.
- **(d)** Reachability double-edged: easy to fall *in* (gravity), but if the generator makes a
  pit the ball can enter and **never escape and never reach the cup**, it's a soft-lock. This is
  a classic stall case for our bot.
- **(e)** If we want pits, generate them with the **cup at the very bottom** so entering = near
  winning; validate that a ball dropped in settles at the cup. Avoid pits where cup is on a
  ledge inside the pit.

### GROUP III — Layer-B accents & material situations (independent of silhouette shape)

These ride on *any* silhouette (heightfield or not) and supply much of GoM's variety/difficulty
cheaply. **We currently have almost none of these, and they're the highest-variety-per-effort
wins.**

#### III-1. Grey rock spikes / pillars (low-friction, sometimes overhanging the cup)
- **(a)** Example: `steam_07.jpg` (left pillar + right grey notch block), `steam_05.jpg`
  (free-standing grey zig-zag spike directly above the cup slot, hole 208).
- **(b)** Small **grey angular polygons** sitting on/near the surface. Material = **low
  friction / high restitution** ("angled stones that offer a lot less friction"). Often placed
  to **guard a cup** so you must bank/ricochet off them or thread past — turning an easy cup
  into a bank shot.
- **(c)** A second material polygon layer with its own physics; placement near cups.
- **(d)** Not hard to add (small polygons + a material flag); we just haven't. The *interesting*
  part is **deliberately placing one over/beside a cup** to create the "protected cup / bank
  shot" situation (see V-2).
- **(e)** Emit a few grey polygons with bouncy material; optionally place one adjacent to the
  cup to demand a ricochet.

#### III-2. Sticky cacti
- **(a)** Example: green cactus blobs in `steam_03.jpg`/`itch_02.png` (575), `steam_07.jpg`.
- **(b)** Small green cactus sprites; **the ball sticks exactly where it lands on them**
  (extreme friction / capture). Punishes a ball that lands on one.
- **(c)** Sprite + "capture/stick" material.
- **(d)** Trivial to add; pure Layer-B.
- **(e)** Place a few on surfaces as hazards.

#### III-3. Water lakes (slow, playable)
- **(a)** Example: `steam_02.jpg` (hole 148) — blue lake pooled in the basin; you can still
  shoot out of it but it saps momentum.
- **(b)** A blue fill occupying a concave basin up to a water-level y; ball entering is heavily
  **slowed/damped** but can still be struck.
- **(c)** A water polygon (basin bounded by terrain + a flat top) + a damping zone.
- **(d)** Trivial Layer-B; adds a lot of texture. Note the *basin* is heightfield-friendly.
- **(e)** Detect a concave basin in the silhouette, fill to a level y with water material.

#### III-4. Sand patches (slow)
- **(a)** Textual: "sand pits that slow any momentum"; DG is *entirely* sand.
- **(b)** A surface region with high rolling friction / low restitution; ball plugs and stops.
- **(c)** Per-surface-segment material tag.
- **(d)** Trivial; per-segment friction.
- **(e)** Tag some surface runs as sand.

#### III-5. Drifting clouds (speed-sapping, moving)
- **(a)** Example: cloud in `tapsmart.png` (156); "low-flying speed-sapping clouds."
- **(b)** A soft sprite in the air that **slows the ball** if it passes through; drifts slowly.
- **(c)** A moving damping zone in the air.
- **(d)** Trivial; optional. Adds aerial hazard variety.
- **(e)** A drifting translucent zone with drag.

#### III-6. Metal hunks / windmills / falling stones (dynamic obstacles)
- **(a)** Textual: "windmills (normal = bounce, cactus-windmill = sticky)," "hunks of metal,"
  "angled stones precariously placed so they fall over if knocked."
- **(b)** **Dynamic/animated** rigid bodies: spinning blades (bounce/stick), top-heavy stones
  that topple when hit (and can block the cup), metal that bounces hard.
- **(c)** A (light) rigid-body / hinge system — the only archetype needing *dynamics*.
- **(d)** Hardest of the accents (needs moving physics bodies + their own collision). Highest
  effort, and the source of some of GoM's own bugs (stones blocking the hole). **Lowest
  priority** for us — skip for v1.
- **(e)** Defer. If wanted later, a few kinematic spinners + a couple of topple-able boxes.

### GROUP IV — Flow / progression archetypes (structural, cross-hole)

#### IV-1. Continuous chaining (cup N = tee N+1)
- **(a)** Universal in GoM/DG. The cup you sink becomes your next tee; camera pans right; you
  can overshoot into the next hole and walk it back.
- **(b)** One continuous terrain strip; holes are just **cup notches placed along it**; the
  "tee" is wherever the last ball came to rest in the cup.
- **(c)** A terrain strip that extends seamlessly, with cup notches at intervals. No per-hole
  resets.
- **(d)** Our **per-hole offscreen polygon caches** fight this — seams between holes, only the
  current hole renders. GoM is one array drawn continuously.
- **(e)** Generate terrain as **one long continuous strip** (heightfield base + accents),
  place cup notches along it; the tee is inherited. No per-hole cache.

#### IV-2. Parameter drift / biomes (difficulty + palette progression)
- **(a)** Dev-confirmed: high-level params tweaked "for stretches"; flat stretches; post-2000
  harder; palette drifts subtly with difficulty.
- **(b)** The generator's parameters (amplitude, max slope, overhang probability, accent
  density, palette) **interpolate slowly over distance**, creating biomes and a difficulty ramp.
- **(c)** A small parameter vector that is a smooth function of hole index / x-distance.
- **(d)** We don't have a progression model at all; every hole is i.i.d. random.
- **(e)** Make all generator knobs functions of `holeIndex` (lerp between biome presets).

### GROUP V — "Situation" archetypes (about the cup placement / shot demanded)

These describe the *puzzle*, orthogonal to silhouette. The same hill can host several.

- **V-1. Cup-in-a-catch-basin (gift):** cup at a local min; everything rolls in. Easiest.
  (See I-3.)
- **V-2. Protected cup / bank shot:** cup guarded by a wall, lip, spike, or overhang so a direct
  arc can't reach it; you must **ricochet** off a rock/wall or roll it in from the side.
  (See `steam_05.jpg` spike-over-slot, `steam_07.jpg` cup between plates.) High skill expression.
- **V-3. Precision plateau landing:** cup on a small elevated flat; must land soft and stop.
  (See I-4, `steam_03.jpg`.) Distance control.
- **V-4. Thread-then-drop:** cup inside a pocket/cave reached only by threading a mouth then
  dropping. (See II-2 `steam_04.jpg`.)
- **V-5. Overshoot-and-return:** cup positioned so the natural shot overshoots; you ride the
  scroll and come back, sometimes down an unseen slope. (Dev-described.) Enabled by the
  continuous camera.

**Insight:** V-1…V-5 are mostly a function of **where you put the cup and what you put next to
it**, not of exotic silhouette geometry. A heightfield + a few accent polygons can express
V-1, V-2, V-3, V-5 outright; only V-4 needs a non-heightfield pocket. So **cup-placement +
accents are the biggest lever on perceived variety.**

---

## 3. What's genuinely HARD for our current approach (ranked)

1. **Overhangs/caves via field→marching-squares→simplify (the lacerations, fill
   misclassification, cup-clipping).** Root cause: extracting a polygon from a scalar field and
   then simplifying it introduces self-intersections, and even-odd fill + centroid-based
   mass/cave classification is fragile. *All three brief bugs are symptoms of this one choice.*
   → Fix: **don't use a field at all.** Emit geometry directly (heightfield base + explicit
   slab/CSG carves), so edges are straight and loops never self-intersect. (Archetypes
   II-1…II-6.)

2. **Guaranteed-reachable cups.** Our biggest unsolved problem; GoM *didn't* solve it (it skips
   after 25). The stall cases are I-4/I-5 (too high/far/cliff), II-2/II-5 (thread-then-drop,
   slots), II-6 (inescapable pits). → Fix: **simulate-and-validate** every cup, and for the
   exotic non-heightfield holes, **carve the corridor first** so a path exists by construction.
   (See §4.3.)

3. **Continuous chaining without seams.** Per-hole caches vs GoM's one continuous strip. → Fix:
   one continuous terrain; cup notches along it; inherited tees. (IV-1.)

4. **Multiple disconnected solid masses per hole.** Breaks the single-loop / single-fill /
   single-classification assumption. → Fix: terrain as a **set of simple polygons**, each
   filled/collided independently. (II-4.)

5. **(Lower) Layer-B accents & materials and progression.** Not hard, just unbuilt — and
   they're the cheapest variety. (Group III, IV-2.)

6. **(Skip for now) Dynamic obstacles (windmills/topplers).** Needs rigid-body dynamics; defer.
   (III-6.)

---

## 4. Synthesis — minimal capability set + recommended generation strategy

### 4.1 The minimal capability set to cover GoM's whole range

1. A **continuous piecewise-linear heightfield** base (long straight facets, steep slopes
   allowed). → Covers Group I entirely (the 70–80% case) and is the chaining backbone.
2. A way to make a **finite set of simple solid polygons** *in addition to* the heightfield, so
   the silhouette can fold. → Covers Group II (overhangs, caves, hooks, islands, slots, pits).
3. A small library of **accent objects with materials** (rock=bouncy, cactus=sticky,
   water/sand=slow, cloud=drag). → Covers Group III variety cheaply.
4. **Cup notch placement + a validating solver** (drop-the-bot, accept only sinkable). → Covers
   reachability for Group I/V and final-checks Group II.
5. A **parameter vector that drifts with hole index** (amplitude, slope, overhang probability,
   accent density, palette). → Covers progression/biomes (IV-2).

That's it. Notably, items 1, 3, 4, 5 are *easy*; only item 2 is the "design freedom" part — and
the recommendation below makes item 2 clean by **avoiding the field/contour pipeline**.

### 4.2 Recommended terrain representation: "heightfield base + slab carves," collide per-polygon

**Represent a hole as: one continuous heightfield strip, OPTIONALLY modified into non-heightfield
shapes by a small number of explicit polygon operations, yielding a final `terrain = [list of
simple non-self-intersecting polygons]` + `[list of accent objects]`.**

Two equivalent clean ways to get overhangs/caves WITHOUT a scalar field:

- **(A) Additive slabs:** keep the heightfield solid, and for an overhang hole, add 1–3 extra
  **slab polygons** (simple convex quads/hexes) floating above/beside it, joined at their ends.
  Stacked slabs = multi-level overhang (the 351 look). Each slab is authored as a short explicit
  vertex list → guaranteed simple, straight-edged.

- **(B) Subtractive carves (CSG):** start from the heightfield solid polygon and **subtract** a
  small number of **convex sky shapes** (rectangles, wedges, triangles) to carve undercuts,
  caves, slots, tunnels. Polygon-clipping a simple solid minus a convex hole is robust and
  yields straight edges. A cave = subtract a pocket but leave a mouth; a tunnel = subtract a
  capsule; an undercut = subtract a wedge under a lip.

Either way:
- **Render** = fill each polygon in terrain color (flat). The cup notch is itself a small
  subtracted rectangle in the sky color (or simply absence of solid). No even-odd whole-mass
  fill, no contour extraction, no Douglas-Peucker, **so no lacerations and no mass-vs-cave
  classification** — each polygon is convex-ish and trivially fillable.
- **Collide** = circle-vs-polygon (closest-point-on-edges) against each polygon, with **swept**
  circle (continuous collision) at shot speeds to avoid tunneling. Multiple polygons = just loop.
  This is the standard, minimal, special-case-free collision the brief asks for.

This directly kills brief-bugs: lacerations (no simplification of extracted contours),
mass-vs-cave misclassification (no classification — explicit solids), cup-clipping (cup notch is
a subtract on the *near* slab; nothing higher is in front of it because slabs are explicit and
z-ordered).

**Why not metaballs/SDF?** They give smooth blobby shapes — the *opposite* of GoM's crisp
angular facets — and reintroduce a field→contour step. Avoid. **Why not pure heightfield?** Can't
fold (no Group II). The hybrid above is the minimal thing that does both, with heightfield doing
the 80% and explicit slabs/carves doing the spicy 20%.

### 4.3 Recommended reachability strategy: corridor-first for exotics, validate-everything

GoM didn't truly solve this (skip button). We can do better cheaply:

- **For Group I/V holes (heightfield + accents):** generate freely, place the cup, then
  **validate by simulation** — run the autoplay solver (or a few aim samples) and accept the
  cup only if it sinks within N strokes; otherwise nudge the cup (lower it, move it onto a
  flatter/closer spot) and re-test, or regenerate. This is cheap, bulletproof, and matches the
  brief's "simulate-and-regenerate" hypothesis. It eliminates I-4/I-5 stalls.

- **For Group II exotics (caves, slots, tunnels, pockets):** **carve the corridor first.**
  1. Decide tee region and cup position.
  2. Compute a **guaranteed playable path** from tee to cup — e.g. a ballistic arc (or a short
     sequence of arcs) plus a drop — and **sweep the ball radius along it** to get a
     "keep-open" capsule/corridor of sky.
  3. **Fill solid everywhere else** (heightfield + slabs), then **subtract the corridor** so the
     path is open by construction. Now the cave's mouth, the slot, the tunnel are reachable
     *because the reachable path defined them*.
  4. Run the validating solver as a final safety check.
  This is the brief's "generate the reachable path first, then grow terrain around it"
  hypothesis — and it's what makes thread-then-drop (V-4) and slots (II-5) safe.

- **Escape hatch:** keep GoM's skip-after-N-strokes as a backstop for the rare validated-but-
  -player-can't case. It's not a failure to copy this — GoM shipped it.

### 4.4 Tie-back to "low tech, minimal code"

- The **80% path is a heightfield** — exactly the clean representation we already proved works.
  We keep that and stop fighting it.
- The **20% exotic path** is **explicit slabs / convex CSG carves** — a handful of polygon
  emits/subtracts, each trivially simple. No scalar field, no marching squares, no
  Douglas-Peucker, no contour chaining, no mass/cave classification. *The entire fragile
  pipeline from the brief is deleted.*
- **Collision** is one routine: swept circle vs each simple polygon. No special cases.
- **Reachability** is one routine: simulate the solver; for exotics, carve the path first.
- **Variety** mostly comes from **cheap Layer-B accents + cup placement + parameter drift**, not
  from expensive geometry — which is why GoM feels rich without complex terrain code.

**Headline:** GoM is *mostly a continuous faceted heightfield* dressed with *cheap material
accents and clever cup placement*, with *rare* explicit non-heightfield set-pieces for drama —
and it tolerates unreachable holes via a skip button. Reproduce that split: heightfield base +
explicit slab/CSG carves for the few overhang/cave holes + accent layer + simulate-to-validate
cups (corridor-first for the exotics). Drop the field/marching-squares pipeline entirely; it is
the source of every laceration/seam/classification bug.

---

## Appendix A — Downloaded sample images (`/tmp/gom-samples/`)

| File | Hole # | What it shows | Archetypes |
|------|--------|---------------|------------|
| `itch_01.png` | (tee shot) | Simple rolling heightfield, ball + aim arrow, cup in a shallow notch on a flat to the right. Two faint moons in sky. | I-1 |
| `steam_01.jpg` | (tee shot) | Same gentle roller, official press shot. | I-1 |
| `steam_06.jpg` (`193`) | 193 | Gentle heightfield, cup 72 on a small bump, painterly clouds in sky (biome accent). | I-1, I-3, III-5 |
| `itch_02.png` / `steam_03.jpg` (`575`) | 575 | Faceted ramp up to a high plateau, cup 181 in a top notch; TWO green sticky cacti on the lower flat near the ball. Long straight facets. | I-2, I-4, III-2 |
| `yt_thumb.jpg` (`40`) | 40 | Big hump/plateau to carry over; cup 11 far right in a low notch; tee in a small lipped pocket on the left. | I-2, I-4, V-3 |
| `tapsmart.png` (`156`) | 156 | Mushroom-shaped curling overhang lip on the left creating a small sky pocket beneath it; drifting cloud on the right; cup 61 on a flat with a small pillar lip. | II-3, II-2, III-5 |
| `steam_02.jpg` (`148`) | 148 | Blue WATER lake pooled in a basin; cup 48 up-right on a notched plateau whose mass UNDERCUTS/overhangs the water. Ball in the water. | II-1, III-3, V-3 |
| `steam_05.jpg` (`208`) | 208 | Free-standing grey zig-zag ROCK SPIKE hanging directly over a narrow cup slot (cup 91) in a valley floor; disconnected solid masses + sky pockets right. Protected/bank-shot cup. | II-1, II-4, III-1, V-2 |
| `itch_03.png` / `steam_04.jpg` (`134`) | 134 | Carved CAVE: big sky pocket scooped into red mass; hooking lip curls over it; a downward red SPIKE intrudes from upper-right narrowing the mouth; cup 42 at the pocket FLOOR. | II-2, II-3, V-4 |
| `steam_07.jpg` (`351`) | 351 | The showcase: interlocking angular red PLATES with sky carved between/under them at multiple vertical levels (true cantilevered overhangs); grey rock pillar (left) + grey notched block (right, disconnected); green cactus on top; cup 128 on the broad top plateau. | II-1, II-4, I-2, III-1, III-2, V-2 |
| `itch_cover.png` | — | itch.io banner (not gameplay). | — |
| `yt_thumb_hq.jpg` | 40 | Low-res dup of hole 40 thumbnail. | I-2 |

Coverage check: Group I (I-1…I-5) ✓ images for I-1/I-2/I-3/I-4, textual for I-5. Group II:
images for II-1 (148/208/351), II-2 (134/156), II-3 (156/134), II-4 (208/351); textual for II-5
(walls/tunnels) and II-6 (massive pits). Group III: images for III-1 (208/351), III-2 (575/351),
III-3 (148), III-5 (156/193); textual for III-4 (sand), III-6 (windmills/metal/topplers).

## Appendix B — Confirmed obstacle/material list (from reviews + dev)

- Grey angled rock/stone: low friction, high bounce; can be top-heavy and **topple** when hit,
  occasionally blocking the cup (a real GoM bug).
- Green cactus: ball **sticks** exactly where it lands.
- Water lakes: **slow** the ball but you can still shoot out.
- Sand pits: **slow/plug** the ball (DG is all sand).
- Clouds: low-flying, **speed-sapping**, drifting.
- Windmills: normal = **bounce** off blades; cactus-windmill = **sticky** blades.
- Metal hunks: hard **bounce**.
- Skip button: appears after **25 strokes** on a hole (GoM's reachability backstop).
- Impossible holes: confirmed to exist (e.g. "sheer cliff your strongest shot can't beat").

## Appendix C — Sources

- Gamasutra/Game Developer — "7 questions for Desert Golfing creator Justin Smith"
  (dev quotes: "never manually place a vertex," "tweak high-level parameters for stretches,"
  palette/difficulty): https://www.gamedeveloper.com/design/7-questions-for-i-desert-golfing-i-creator-justin-smith
- Steam — Golf On Mars store page (screenshots ss_… 1920x1080):
  https://store.steampowered.com/app/1340570/Golf_On_Mars/
- itch.io — Golf On Mars (screenshots): https://captaingames.itch.io/golf-on-mars
- Finger Guns review (angled stones/low friction, sticky cacti, sand pits, water, cave-below-
  surface, topple bug): https://fingerguns.net/reviews/2020/06/29/golf-on-mars-review-a-new-spin-on-a-classic/
- TapSmart review (hunks of metal, speed-sapping clouds, lakes, sand traps, "massive pits"):
  https://www.tapsmart.com/reviews/golf-mars-side-golf-game-thats-world/
- TouchArcade announcement + forum (26B holes, unique-per-player, spin control, skip-after-25,
  over/under/between walls, overshoot-scroll): https://toucharcade.com/2020/06/19/golf-on-mars/
- ResetEra OT (walls/tunnels, overshoot, impossible sheer-cliff holes):
  https://www.resetera.com/threads/golf-on-mars-ot-desert-golfing-2.231391/
- Wikipedia — Desert Golfing (continuous course, sand physics, impossible-holes patched out,
  cap at 10,001): https://en.wikipedia.org/wiki/Desert_Golfing
- YouTube — "Golf on Mars (45 Minute Gameplay, First 100 Holes)" (longplay, thumbnail = hole 40):
  https://www.youtube.com/watch?v=uX4gVsJL9dQ
</content>
</invoke>
