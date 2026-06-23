# Stickman Levels — a designed campaign for Par Sec's SSG mode

A 10-level hand-designed campaign built on the **nailed SSG camera** in
`prototypes/ssg-camera.html` (zoom-to-fit at address, follow+zoom in flight,
drag-to-peek, exact predicted-trajectory aim line). Levels live in
`prototypes/ssg-levels.js` (a data array) and load into a campaign shell
(level array + level-select + next-on-sink). Everything renders in OUR art:
white dimpled ball, deep-space sky + stars, flat-faceted Mars-rust walls,
glowing-green sticky, Departure Mono.

## Why these mechanics (from real SSG)

Super Stickman Golf (SSG / SSG2 / SSG3, Noodlecake) holes are 2D arcade golf
built around a small, legible material/obstacle vocabulary, layered one new idea
at a time and combined late. The recurring patterns, confirmed from course wikis
and reviews:

- **Bounce / rebound walls** — bank a flat shot off a wall to reach a region you
  can't loft to directly. The core skill the whole game is built on.
- **Sticky surfaces** (SSG2 *Sticky Land* / *Sticky Forest*, the pink goo) — ball
  stops dead wherever it touches: top, wall, or underside. Climb, hang, re-aim.
- **Sand** (*Sandy Land*) — dead/deadening: the ball plugs and stops, so you must
  carry it or accept a buried lie. We model sand as a high-friction kill surface.
- **Ice / slippery** (*Minty Land*, ice-ball) — near-frictionless: the ball skates,
  hard to stop, banks lively. Demands soft touch and reading the run-out.
- **Water** — a hazard band: in = stroke penalty, reshoot from the last rest.
- **Tight tunnels / threading** — narrow gaps that demand a precise line and power.
- **Multi-route holes** — a safe long way and a risky shortcut (bank/tunnel/stick).
- **Difficulty ramp** — first holes teach one mechanic in a wide-open bay; later
  holes stack two or three; the last hole of a set is the signature hard one.
  (SSG reviews: "first few holes simple to learn the physics… then water, sand,
  sticky walls, OOB… later portals, magnets, the trickiest hole is the last.")

We adapt — not copy pixel-for-pixel — into our flat-faceted art + our
`{segments, bodies, mat}` level format. We ship the four core surfaces that carry
SSG's identity without exotic systems: **rock (bank)**, **sticky**, **ice
(slippery)**, **sand (dead)**, plus **water** (hazard) and **OOB**. Portals /
magnets / moving platforms are noted as a future tier (see bottom) but out of
scope for this designed-on-the-camera campaign.

## New surface materials added to the engine

`ssg-camera.html` shipped `rock` + `sticky`. This campaign adds:

| mat      | rest | tan  | roll | behavior                                   |
|----------|------|------|------|--------------------------------------------|
| rock     | 0.50 | 0.74 | 360  | bank wall / standable floor (existing)     |
| sticky   | 0.00 | 0.00 | 0    | stops dead on any face (existing)          |
| **ice**  | 0.62 | 0.995| 6    | slippery: lively bank, almost no roll decel|
| **sand** | 0.05 | 0.18 | 2600 | dead: kills bounce + run-out fast (plugs)  |
| **water**| —    | —    | —    | hazard: contact ⇒ +1, reshoot from last rest|

`bound` (dim boundary rust) stays as the frame-wall tone.

## The campaign (difficulty ramp)

Slots: **T**=teacher (1 mechanic, wide open) · **D**=developing (combine 2) ·
**C**=challenge (3+ / precision) · **S**=signature (hard, the set-enders).

Coordinates are world px, +y DOWN, origin top-left. Sketches are schematic
(T=tee, C=cup, ▓=rock, ▒=sand, ░=ice, █=sticky, ≈=water). Each level is solvable
in the listed intended shots; verified by driving `__shoot` through the solve.

---

### 1 · "First Light"  — slot T — *adapted from SSG Golf Land hole 1*
Teaches: **the basic shot + bank**. One wide bay, a low wall between tee and cup;
either loft straight over or bank off the back wall.
```
 ┌─────────────────────────┐
 │                         │
 │   T▓                 C  │
 │  ▓▓▓     ▓▓        ▓▓▓▓  │   low divider mid-bay
 └─────────────────────────┘
```
Intended solve (1–2 shots): medium loft up-right, clear the divider, land on the
cup shelf. Bank off the right wall is the alt line. **Inspired by:** SSG opening
holes (one obstacle, lots of room).

### 2 · "Caroms"  — slot T — *adapted from SSG2 rebound holes*
Teaches: **the bank wall as a tool**. The cup sits in a pocket you CAN'T loft to
directly (a roof over it); you must bank off the right wall to drop in from the side.
```
 ┌──────────────────────────┐
 │                    ▓▓▓▓  │  roof over the cup pocket
 │  T▓            C   ▓     │  cup tucked under, open to the RIGHT wall
 │  ▓▓        ▓▓▓▓▓▓▓▓▓     ▓│  ← bank off this right wall
 └──────────────────────────┘
```
Intended solve (2): bank a flattish shot off the far right wall so it caroms
back-left into the pocket. **Inspired by:** SSG2 holes that gate the cup behind a
roof so a direct lob is impossible.

### 3 · "Flypaper"  — slot T — *adapted from SSG2 Sticky Land*
Teaches: **sticky**. A sticky ceiling/ledge you stick to, then putt off into the cup.
```
 ┌──────────────────────────┐
 │        ████████          │  sticky ledge (land on TOP, stop dead)
 │                          │
 │  T▓                  C   │
 │ ▓▓▓             ▓▓▓▓▓▓▓▓  │
 └──────────────────────────┘
```
Intended solve (2): loft up onto the sticky ledge (stops dead), then a controlled
putt down-right into the cup. **Inspired by:** Sticky Land's intro to the goo.

### 4 · "The Skating Rink"  — slot D — *adapted from SSG2 Minty Land*
Teaches: **ice (slippery)**. A long ice floor leads to the cup; too much pace and
you skate past into OOB / a wall — soft touch + read the run-out.
```
 ┌────────────────────────────┐
 │  T▓                        │
 │ ▓▓▓░░░░░░░░░░░░░░░░░░  C    │  long ice floor → cup at the far end
 │ ▓▓▓░░░░░░░░░░░░░░░░░░▓▓▓▓▓  │  back wall stops an overcooked shot
 └────────────────────────────┘
```
Intended solve (1–2): a gentle low shot that lands early on the ice and glides to
the cup; or bank the back wall and let it settle back. **Inspired by:** Minty
Land's slick floors / the ice-ball's lively run.

### 5 · "Plugged"  — slot D — *adapted from SSG2 Sandy Land*
Teaches: **sand (dead)**. A sand pit guards the cup: land short in the sand and
you plug (dead, +distance lost); you must CARRY the sand and land on the small
green shelf, or bank in off the wall.
```
 ┌────────────────────────────┐
 │   T▓                       │
 │  ▓▓▓                  C    │  cup on a small shelf past the sand
 │ ▓▓▓▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▓▓▓▓▓▓  │  ▒ = sand pit (lands here = plugged)
 └────────────────────────────┘
```
Intended solve (1–2): a higher carry that clears the sand and lands on the shelf;
banking the back wall is the recovery if short. **Inspired by:** Sandy Land's
carry-the-bunker holes.

### 6 · "Two Ways Up"  — slot D — *multi-route, adapted from SSG2 split holes*
Teaches: **route choice**. Cup is high; a SAFE staircase (two sticky steps, 3
shots) or a RISKY single bank-and-stick (1–2 shots) off the right wall onto a
high sticky pad next to the cup.
```
 ┌────────────────────────────┐
 │                  ████  C   │  high sticky pad by the cup (risky line target)
 │            ███             │  safe step 2 (sticky)
 │      ███                   │  safe step 1 (sticky)
 │  T▓                      ▓ │  ← risky: bank off right wall up to the high pad
 │ ▓▓▓                  ▓▓▓▓▓ │
 └────────────────────────────┘
```
Intended solve: SAFE = hop step1→step2→pad→cup. RISKY = one big bank off the right
wall onto the high pad, then tap in. Both verified solvable. **Inspired by:** SSG
holes with an obvious safe climb and a hero shortcut.

### 7 · "Threadneedle"  — slot C — *adapted from SSG2 tight-gap holes*
Teaches: **tunnel threading + precision**. A narrow rock gap is the only way to
the cup chamber; over/under-power clips the lip.
```
 ┌────────────────────────────┐
 │  T▓     ▓▓▓▓▓▓▓             │
 │ ▓▓▓     ▓     ▓▓▓▓▓▓▓▓      │
 │         ▓ gap ▓      C      │  thread the gap → cup chamber
 │ ▓▓▓▓▓▓▓▓▓     ▓▓▓▓▓▓▓▓▓▓▓▓  │
 └────────────────────────────┘
```
Intended solve (2): a precise medium shot threads the vertical gap into the
chamber and settles by the cup. **Inspired by:** SSG2's "thread the needle" gaps.

### 8 · "Cold Shoulder"  — slot C — *ice + bank combo, adapted from Minty Land late holes*
Teaches: **ice bank**. The cup sits behind a wall on an ICE shelf; you must bank
off an ice wall (lively) at the right angle so the ball skates onto the shelf and
stops near the cup — read the lively rebound AND the slick run-out.
```
 ┌────────────────────────────┐
 │            ░ ← ice bank wall│
 │  T▓        ░               │
 │ ▓▓▓        ░    ░░░░░  C    │  ice shelf with the cup at the far end
 │ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░░▓▓▓▓▓▓  │
 └────────────────────────────┘
```
Intended solve (2): bank off the ice wall so the ball caroms onto the ice shelf,
then glides to a stop by the cup (back wall backstops an overcook). **Inspired
by:** Minty Land holes that combine an ice bank with an ice green.

### 9 · "Sand & Stick"  — slot C — *triple-mechanic, adapted from SSG2 mixed-surface holes*
Teaches: **combine sand + sticky + bank**. A sand floor you must NOT land on, a
sticky wall to hang from to re-aim, then a bank into a tucked cup.
```
 ┌──────────────────────────────┐
 │  T▓        █ ← sticky wall    │
 │ ▓▓▓        █          ▓▓▓▓    │  roof over the cup
 │            █       C          │  cup tucked under-right
 │ ▓▓▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▓▓▓▓▓▓   │  sand floor (dead — don't land here)
 └──────────────────────────────┘
```
Intended solve (3): 1) loft up-right and STICK to the sticky wall (over the sand).
2) putt off the wall, bank off the right wall. 3) carom into the tucked cup.
**Inspired by:** SSG2 holes that force a stick to avoid a dead floor, then a bank
finish.

### 10 · "The Gauntlet"  — slot S — *signature, adapted from SSG2 Impossible Land finale*
Teaches: **everything**. A multi-screen hero hole: bank off a wall over water,
stick to a high pad, skate an ice ledge past a sand trap, thread a gap, sink in a
tucked pocket. The set-ender.
```
 ┌──────────────────────────────────────┐
 │                       ████            │  (3) high sticky pad
 │   T▓     ░░░░░░░        █   ▓▓▓▓       │  (4) ice ledge → (5) thread gap
 │  ▓▓▓    ░░░░░░░░        █  ▓     C     │  (6) tucked cup pocket
 │  ▓▓▓                    █ ▓▓▓▓▓▓▓▓▓    │
 │  ▓▓▓ ≈≈≈≈≈≈≈≈ ▒▒▒▒▒ ▓▓▓▓              │  (1) bank over water, (2) avoid sand
 └──────────────────────────────────────┘
```
Intended solve (4–5): 1) bank off the left/back wall to carry the water. 2) land
on rock (not the sand). 3) loft + STICK to the high pad. 4) skate the ice ledge
and thread the gap. 5) settle into the tucked pocket. Every stage uses a mechanic
the prior nine taught. **Inspired by:** SSG2 *Impossible Land*'s everything-at-once
finale (the trickiest hole is the last).

---

## Ramp summary

| # | Name              | Slot | Mechanic taught            | Shots |
|---|-------------------|------|----------------------------|-------|
| 1 | First Light       | T    | basic shot + bank          | 1–2   |
| 2 | Caroms            | T    | bank wall as a tool        | 2     |
| 3 | Flypaper          | T    | sticky                     | 2     |
| 4 | The Skating Rink  | D    | ice (slippery)             | 1–2   |
| 5 | Plugged           | D    | sand (dead) / carry        | 1–2   |
| 6 | Two Ways Up       | D    | multi-route (safe vs hero) | 1–3   |
| 7 | Threadneedle      | C    | tunnel threading           | 2     |
| 8 | Cold Shoulder     | C    | ice bank + ice green       | 2     |
| 9 | Sand & Stick      | C    | sand + sticky + bank       | 3     |
| 10| The Gauntlet      | S    | everything (signature)     | 4–5   |

## Future tier (out of scope here)
Portals (teleport pairs), magnets (pull/repel zones), moving/rotating platforms,
lasers, gates, and SSG3-style spin. Each is a new collider/force hook on the same
level format; noted for a later pass once the surface campaign proves out.
