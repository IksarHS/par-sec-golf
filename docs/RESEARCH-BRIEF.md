# Research Brief: arbitrary-shaped 2D golf terrain with reachable cups (the "Golf on Mars" technique)

## The goal (what we want, non-negotiable)
A 2D side-view golf game (Desert Golfing / Golf on Mars lineage) where holes are **procedurally generated**
and we are **NOT restricted to a heightfield** (one ground-height per x). We want the freedom to design
**any-shaped terrain** in a flat-color minimalist art style — including **overhangs, caves, hooks, floating
shelves, and sharp angular facets** — and to **procedurally place a tee and a cup (flag) that are always
reachable/sinkable**. It must be **bug-free and visually clean**, and play exactly like the original
(drag-to-aim, ball physics, ball drops in cup, cup fills, ball rises, camera pans to next hole).

Golf on Mars (Justin Smith, the Desert Golfing sequel) did this years ago with **low tech and minimal
code**. We want to understand and reproduce the actual technique, not fight our own implementation.

## The art style + visual references (what the terrain should look like)
Flat 2-color world: solid terrain (one flat color, e.g. green/grass or red/regolith) on a flat sky
(another flat color). **A hole is a notch — a LACK of terrain — opening to the flat sky, never a colored
fill.** The terrain silhouette is **angular/faceted** (few long straight edges, big flats, steep diagonals,
sharp V-notches), NOT smooth/curvy.

Reference shots we are trying to hit (from real Golf on Mars):
- **"351" hole**: a big interlocking mass of angular RED plates with sky carved *between and under* them at
  multiple vertical levels — a vertical line through the middle crosses solid→sky→solid→sky→solid. True
  **overhangs** (the central plateau cantilevers with sky beneath it, then a shelf, then more sky), floating
  shelves, grey rock-spike accents, and the cup (flag "128") sits on a broad flat plateau on top.
- **"134" hole**: a carved **cave** — a big organic sky pocket scooped into the red mass with a hook of
  terrain curving over it, cup down inside the pocket.
- **gom_2 / gom_5**: mostly angular faceted *heightfield-like* holes — big flats + steep diagonals + sharp
  V-notches, cup on a flat. (These are the COMMON case; overhang/cave holes like 351/134 are the rarer
  dramatic exception.)

The dev has publicly stated there are **no hand-placed vertices** — only high-level parameters tweaked per
"biome"/stretch. So it is a parameterized procedural generator.

## The engine we're working in (constraints)
A vanilla-JS canvas game (a clone of the original). Ball physics: gravity + per-substep integration,
circle ball, restitution/friction by material. The render pipeline: a flat full-screen sky fill, then the
terrain, then the cup notch (currently drawn as a trapezoid in the sky color), then the flag, then the
ball. The cup is defined by `cupX, cupY (rim), cupBottomY, cupLeftX/RightX`; sinking = ball rests with
`|x-cupX| < CUP_WIDTH/2 && y > cupY`. On sink: a fill animation rises in the notch and the ball rises out,
then the camera pans so the **cup of hole N is the tee of hole N+1** (holes flow continuously).

The ORIGINAL game's terrain is a strict **heightfield** (`vertices[]` = one y per x, monotonic in x). That
is WHY the original is clean: a cup is a notch cut into the single line; a tee is a point on it; collision
is one segment-walk; rendering is one fill; no seams; reachability is easy. **We are NOT willing to keep
this restriction** — we want overhangs/caves — but we want the same cleanliness.

## What we tried, and the bugs each approach hit
1. **Heightfield + faceted archetypes** ("faceted Earth"): few long flat facets + steep diagonals. CLEAN
   and worked perfectly (native engine) — but a heightfield CANNOT make overhangs/caves. Rejected for lack
   of design freedom.
2. **2D scalar field → marching squares → contour loops → Douglas-Peucker simplify** (our main attempt):
   terrain = `{ (x,y) : F(x,y) > 0 }`, where `F = (y - surface(x))/soft + warp*noise2D(x,y) + bias`. We
   extract the boundary with marching squares, chain segments into closed loops, simplify to a few long
   facets, then even-odd fill for render and ball-vs-edge (or field-gradient) for collision.
   Bugs we kept fighting (whack-a-mole), each a symptom of the field/polygon representation fighting an
   engine built for heightfields:
   - **Lacerations**: Douglas-Peucker simplification made a closed loop **self-intersect**, and even-odd
     fill rendered the overlap as a thin sky sliver gash in the terrain. (Patched by backing off the
     tolerance until no self-intersection — but it's a patch on a fragile pipeline.)
   - **Terrain clipping the hole**: cups landed in dips/saddles where neighboring higher terrain rendered
     over the top of the cup opening. (Patched by carving a "clear sky above" green shelf.)
   - **Cup color mismatch**: the notch was a flat color but our background sky was a gradient, so the hole
     didn't read as a lack-of-terrain. (Fixed by matching the original: flat sky, terrain-only cache.)
   - **Reachability not guaranteed**: procedurally placed cups are often **unreachable** — too far, too
     high above the tee, behind an insurmountable wall, or in a pit the ball can't escape. Across random
     seeds the autoplay bot completes only ~2/5 to 3/5 full 9-hole courses; the rest stall on a hole it
     can't sink. We have NO robust way to guarantee a generated cup is sinkable.
   - **Render seams / per-hole caches**: we render each hole to its own offscreen polygon cache; only the
     current hole renders (the original heightfield is one continuous array always drawn).
   - **Mass-vs-cave classification** for fill was fragile (a concave mass's centroid can fall in a sky
     pocket and mislabel the whole mass as a cave).

## The core open questions for research
1. **How does Golf on Mars actually REPRESENT and GENERATE its terrain?** Is it a single vector polygon? A
   set of polygons? A signed-distance field / metaballs? Marching squares on a field? Constructive solid
   geometry (union of shapes)? Bezier/contour? What is the *minimal* representation that gives full shape
   freedom (overhangs/caves) AND is trivially clean to render and collide? (Dev interviews, GDC/postmortem
   talks, Justin Smith / Captain Games statements, technical teardowns, reverse-engineering, the Desert
   Golfing tech, anything concrete.)
2. **Robust collision against arbitrary 2D terrain.** What's the clean, minimal-code way to collide a
   circle against an arbitrary closed polygon (or set of polygons) with overhangs/caves, with no tunneling
   at golf-shot speeds and no special cases? (Swept circle vs polygon? SDF + gradient? Per-pixel collision
   mask? Verlet? How do similar games — Worms, artillery, destructible-terrain platformers — do it with
   minimal code?)
3. **Procedurally placing a REACHABLE cup (and tee).** This is our biggest unsolved problem. How do we
   generate a flag/hole position that is guaranteed sinkable from the tee given the terrain and physics?
   Options to evaluate: (a) generate terrain FIRST then validate by simulating the solver and regenerate
   on fail; (b) generate the REACHABLE PATH first (tee → cup) then grow terrain around it; (c) constrain
   the generator so reachability is invariant by construction; (d) how artillery/golf/Angry-Birds-style
   games guarantee solvable levels. What did Golf on Mars do (it never seems to produce an unsinkable
   hole)?
4. **Clean angular rendering** of an arbitrary polygon in the flat-color style with crisp straight edges
   and no seams/slivers — the minimal robust technique.

## First-principles hypotheses to test (our own, may be wrong)
- The lacerations/seams came specifically from **marching-squares + polyline simplification** introducing
  self-intersections. Maybe the answer is to **never go through a field+marching-squares pipeline** —
  instead generate the terrain as **one clean simple polygon directly** (procedurally emit a non-self-
  intersecting vertex loop that can still fold to make overhangs/caves). A simple polygon renders with one
  fill and collides with closest-point-on-edges, no artifacts.
- Reachability may be best solved by **simulate-and-regenerate** (drop the solver on each generated hole,
  reject unsinkable ones) — cheap and bulletproof — OR by **designing the playable corridor first** and
  hanging weird terrain off it so it's reachable by construction.
- "Low tech, minimal code" strongly suggests we are **over-engineering**. The right representation probably
  makes render + collision + cup-placement all fall out almost for free, the way the heightfield does.

## Deliverable wanted from research
A concrete recommended architecture: (terrain representation) + (generation method for progressively
weirder but always-clean shapes) + (collision method) + (guaranteed-reachable tee/cup placement) +
(rendering), with enough specificity to implement, ideally grounded in how Golf on Mars / Desert Golfing
and peers actually did it. Prioritize **bug-free + visually clean + not level-design-restricted**.
