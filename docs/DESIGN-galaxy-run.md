# DESIGN — "Galaxy Run" (mobile golf roguelike)

The mobile/portrait direction for Par Sec: a run-based golf roguelike. Source of truth for the design
decisions; the code lives in `src/roguelike/galaxy-run.js` (gated on `?rogue`, used as `?portrait&rogue`).
Status legend: **[BUILT]** = in Slice 1 and live · **[PLANNED]** = decided, not built yet.

## One-liner
Desert-Golfing-in-space as a roguelike: survive a galaxy of short courses on a 3-life par economy, buy
special balls between planets, get as far as you can. Permadeath; score = how deep you got.

## Core loop
`Shot → Hole → Course (5 holes) → Shop → next Planet → … → System → Galaxy → death.`
Endless and escalating. Linear for MVP (no branching map yet).

## The strike / par-buffer economy  **[BUILT]**
The heart of the game. Rules:
- You start a run with **3 lives** ("strikes left").
- A running **course score** (`overall` = cumulative strokes − par) **starts EVEN (0) on every course** and
  resets to even at each new planet. Under-par holes bank a negative **cushion**.
- **After each hole:** `overall += (holeStrokes − holePar)`. If `overall > 0` (your course total is over
  par) → **lose a life** and reset `overall` to 0. If lives reach 0 → **GAME OVER**.
- So a single bad hole is survivable *if* you've banked under-par cushion earlier in that course; the cushion
  does NOT carry between planets.
- **Game over** shows the score (planets cleared + holes cleared + money) → tap to start a fresh run.

Worked example that defines the rule (per-hole vs-par deltas, 3 lives, reset-to-even on a strike):
`−2, −1, +2, +7(→life,reset), −3, +3, +2(→life,reset), +1(→life → GAME OVER)` ⇒ lives go `3,3,3,2,2,2,1,0`.

## Galaxy structure  **[BUILT core / PLANNED specials]**
- **Course = one planet = 5 holes.** Clear all 5 → travel to the next planet (reuses the real planet-travel).
- **Endless & escalating:** the portrait itinerary loops; difficulty ramps as you go.
- **First hole of every course is the gentlest** **[BUILT]** — hole 0's difficulty is capped low (the log
  ramp barely moved over 5 holes, so first holes weren't notably easy). Portrait-gated; landscape untouched.
- **Special planets** **[PLANNED]** — map "spice": elite (one brutal hole, big payout), treasure (free ball),
  shop planet (bonus shop), event (gamble a strike for cash), boss (signature mega-hole).
- **Branching node-map** **[PLANNED, post-MVP]** — choose your next planet (safe vs high-risk). MVP is linear;
  structure the data so branching drops in later.

## The bag + special balls  **[PLANNED — Slice 2]**
The build/relic system; the main replayability engine. Locked decisions:
- **Bag, pick-per-shot:** you carry your normal ball + a few specials and choose which to play each shot
  (like clubs). Bag caps at ~3 specials.
- **The bag STARTS EMPTY** (normal ball only). You earn your first special in the **first shop**.
- **Charges, not infinity:** specials run on per-course charges (e.g. ~3), refilled at the shop. Normal ball
  is unlimited.
- **Synergy is the point** — balls should combo (stop-ball then whackaball over a pit; sticky on a wall-ball
  bank). Holes must occasionally threaten your build so the challenge keeps scaling (use the hole-gen).
- MVP ball set (chosen partly by build effort):
  | Ball | Effect | Effort |
  |---|---|---|
  | Normal | unlimited baseline | — |
  | **Sticky** | lands dead, no roll-off | easy (≈ existing `mud`) |
  | **Wall** | bounces off walls/edges | easy (edge-bounce exists) |
  | **Stop** | tap mid-flight → halts, drops straight | medium (mid-air input) |
  | Whackaball | re-strike in mid-air until it lands | harder — defer to v1.1 (mid-flight re-aim UI) |
  `bag:['normal']` placeholder already exists in galaxy-run.js.

## Money + shop  **[money BUILT / shop PLANNED — Slice 2]**
- **Money** **[BUILT]** earned at course-complete on performance: `+5 base + 2 × strokesUnderPar` for the
  course. Accumulates and displays. (Skill pays twice: under-par banks lives AND money.)
- **Shop between courses** **[PLANNED]** — offers ~3 balls to buy, refill charges, maybe a reroll, maybe a
  (deliberately expensive) buy-back-a-strike. Prices creep up each system.

## Meta-progression  **[DECIDED]**
- **Pure arcade for MVP** — in-run money only, resets on death. No persistent unlocks yet.
- Persistent meta-unlocks between runs = possible later, once the core loop proves fun.

## HUD  **[BUILT]**
PC-game style: plain left-aligned Departure Mono, white headline + dim sublines, **no panel/colour**. Shows:
`HOLE x / 5` · `PAR n` · `LIVES n` · `N UNDER THIS COURSE` · `$money  PLANET n`. The engine's own corner
HOLE/PAR/strokes counter is suppressed in rogue mode so they don't overlap.

## Build status & where it lives
- **Slice 1 (core loop) — BUILT + live** behind `?rogue`: strikes + par economy, 5-hole courses, planet
  travel, money, HUD, game-over→retry, easy first hole. Public: `…/par-sec-golf/?portrait&rogue`; the PWA
  manifest `start_url` installs straight into rogue. Default game (no `?rogue`) is byte-unaffected.
- **Slice 2 — BUILT + live** behind `?rogue`: the bag (pick-per-shot chip row), 3 special balls
  (sticky / bounce / stop) on per-course charges, and the on-clear shop (buy balls + life buy-back,
  Continue auto-flows into travel). See "SLICE 2 — BUILD NOTES (as shipped)" below for the rulings made.
- Code: `src/roguelike/galaxy-run.js` (gated, additive, peel-off). Bundled via `tools/build.cjs`. Hooks it
  uses: `RG.holePars`/`RG.holeScores` (par + per-hole strokes), `currentHole`/`RG.course` (hole/course
  change), `RG.startRun` (restart), wraps `RG._drawScoreHUD` (suppress engine HUD). State at `window.__rogue`.

## SLICE 2 — LOCKED DESIGN (build this next: shop + special balls + bag)
Concrete enough to build directly. Numbers are starting values, tune by feel.

### The bag (pick-per-shot)
- Holds the unlimited **normal ball** + up to **3 specials**.
- **Selection UI:** a row of ball chips along the bottom (above the safe-area, out of the aim-drag zone).
  Tap a chip to set the ACTIVE ball for the next shot; active chip highlighted; each special chip shows its
  remaining **charges**. Default selected = normal.
- The active special applies to the next shot; it stays selected until its charges hit 0, then auto-reverts
  to normal.

### Charges
- Each special has **3 charges per course**, **refilled to full at every shop**. Normal = unlimited.
- A shot with a special spends 1 charge; at 0 the chip is greyed/unselectable until refilled.

### Special balls (MVP: sticky, wall, stop — defer whackaball)
- **Sticky:** on first ground contact, zero the velocity (no roll-out). ≈ the existing `mud` dead-stop.
- **Wall:** reflects off steep terrain faces / screen edges instead of stopping (reuse the portrait
  edge-bounce; extend to near-vertical terrain). Good on canyon/bank holes.
- **Stop:** while airborne, a tap sets vx=0 + gentle downward vy so it drops straight. One trigger per shot.
- **Whackaball (v1.1, NOT now):** re-aim + re-strike mid-air until it touches a surface — needs a mid-flight
  aiming UI. Defer.

### The shop (on planet-clear, BEFORE travel)
- Shows **3 offers** drawn from: balls you don't own (weighted by depth), a **charge-refill** for an owned
  ball, and — sometimes — a **+1 life** buy-back. **Buy** by tapping an affordable offer; **Reroll** rerolls
  all three; **Continue** travels to the next planet (gate the travel until Continue).
- **Prices (starting):** sticky $10 · wall $12 · stop $15 · charge-refill $3 · reroll $4 (+$2 each reroll this
  shop) · +1 life $40 (+$20 each purchase this run). Scale ball prices ~+25% per system cleared.

### Difficulty ramp
- Lean on the existing planet escalation for lap 1 (itinerary goes gentle→hard). Each time the itinerary
  **wraps** (new galaxy lap), bump a global difficulty multiplier so deeper laps are harder. Easy-first-hole
  cap stays.

### Locked rulings (don't re-litigate)
- **Lives are restored ONLY by the shop buy-back.** The cushion only ever DELAYS losses, never refunds.
- **Linear galaxy only** in Slice 2. Special planets + branching map = **Slice 3+**.
- **Pure arcade** — no cross-run meta yet.

### Build notes
- Ball physics: gated, additive hooks on the shot launch / ball update (`src/gameplay.js _launchPower`, the
  ball update in `src/modes/desert-golfing.js`). Apply the active ball's modifier; normal ball byte-unchanged.
- Shop + bag UI: DOM overlays (galaxy-run.js already owns the DOM HUD). Shop = a full-screen
  `pointer-events:auto` layer on course-complete, before the travel transition. Bag = a bottom DOM chip row,
  pointer-events on the chips only.
- All of it lives in / extends `src/roguelike/galaxy-run.js` (+ minimal gated hooks for ball physics). Gated
  on `?rogue`; default game byte-unchanged; dev tooling stays out of the public build.

## SLICE 2 — BUILD NOTES (as shipped)
Decisions made during the build where the spec was ambiguous (kept the locked design intact otherwise):
- **Charges auto-refill free at every shop** (dropped the paid $3 refill — it conflicted with "refilled to
  full at every shop"). Charges deplete on launch (1 per special shot); no refund on OOB; auto-revert to
  normal at 0 charges.
- **No reroll** (with only 3 balls the offer pool is tiny — reroll added UI for no value). Shop offers the
  unowned balls + one +1-life buy-back (only when below 3 lives; buy-back caps at 3, no stockpiling).
- **First-shop floor:** course-1 payout is floored so the cheapest ball is always affordable — you always
  leave the first shop with a ball.
- **Continue auto-flows into travel:** the shop IS the travel-decision gate, so Continue auto-advances the
  deep-space hold (no redundant second tap).
- **"Wall" → "Bounce":** in the narrow portrait frame the ball can't out-travel the screen, and the engine
  already bounces it; the ball amplifies the natural terrain bounce (decaying, capped → always settles), so
  it's named/described honestly as BOUNCE ("extra bounce, hop hazards"). Bounce is the weakest of the three
  (situational on hazard holes) — a candidate to re-tune or swap once there's more hole variety.
- **Stop discoverability:** a one-time "TAP TO DROP" hint shows the first time the stop ball is airborne,
  then never again (learn-by-doing).
- UI: bag chip-row bottom-centre (pointer-events on chips only, hidden in flight/shop/game-over); shop is a
  solid full-screen DOM layer (no canvas bleed-through); the engine's hole-1 title card is suppressed in
  rogue (it overlapped the rogue HUD). All gated `?rogue`; one inert hook added to core `gameplay.js`
  `updatePhysics` (mirrors the existing wind line); default + landscape builds byte-unchanged.

## Later (Slice 3+)
- Special planets (elite / treasure / shop / event / boss).
- Branching node-map (choose your next planet).
- Cross-run meta-progression / unlocks.
- Whackaball + exotic balls (heavy, balloon, magnet, ghost, split).
</content>
