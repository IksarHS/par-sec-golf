# Fresh-agent prompt — three creative prototypes (Stickman camera / Golf Orbit polish / soft-body planet)

Paste the block below into a fresh agent context. (Also lives here for durability.)

---

You're picking up creative-prototype work on a vanilla-JS HTML5 canvas golf game. FIRST read `docs/SESSION-STATE.md` and `docs/WORKLOAD-PLAN.md` in `/mnt/c/dev/indie/active/faceted-golf` for full context — the game, the special-planets vision, the existing prototypes + in-engine modes, the art style, the dev server, the conventions. The art to MATCH (it must look like it belongs in OUR game, not a different game): white golf ball with 3 small dimples, flat-color terrain, deep-space sky, Departure Mono font, our planet palettes. Dev server: http://172.19.97.28:8236 . Put GIFs/screenshots in `/mnt/c/dev/editor-shots/`. For concurrent agents use isolated browse instances (`BROWSE_STATE_FILE=/tmp/<name>/state.json`). KEY LESSON: for any game-feel clone, GATHER VISUAL REFERENCE (web research + existing work) and STUDY it BEFORE building — don't build from a one-line description.

Do all THREE tasks below, deep and thorough — use research + builder/critic iteration loops (spawn sub-agents/workflows as needed), and iterate with critic agents on aesthetics + feel until each is genuinely great. Keep everything peel-off + gated (a standalone prototype OR a gated `?course=` atlas mode); the base game stays byte-identical. Report back per task with the URL + GIFs + what you delivered.

## 1. Super Stickman Golf — NAIL THE CAMERA, deliver a great prototype
We already have a working in-engine Stickman puzzle mode (`?course=puzzle`, `src/roguelike/atlas-puzzle-mode.js`: 2D levels, bank-off-walls, stick-to-green-sticky, multi-shot to cup) — but its CAMERA is the weak point (frames too tight, no peek). Do VAST research on Super Stickman Golf, ESPECIALLY how the CAMERA works: how it frames a big multi-screen (~4–8-screen square) hand-designed puzzle, follows the ball, zooms to fit the action, and lets the player pan/peek to plan a shot. Gather reference: web research (Super Stickman Golf screenshots/gameplay/camera), the user's OWN clone at `/mnt/c/dev/sandbox/stickman-golf-proto` (study its camera + level format), and the existing `?course=puzzle`. Then deliver a GREAT prototype to work from — the camera genuinely nailed (smooth follow + zoom-to-fit + drag-to-peek, readable), the big 2D puzzle legible, walls + sticky, in our art, no dev clutter. Iterate with a critic until the camera + feel are excellent.

## 2. Golf Orbit — CRITIQUE + IMPROVE the bones so it looks amazing
We have Golf Orbit (`prototypes/golforbit.html` standalone, and in-engine `?course=golf-orbit`, `src/roguelike/atlas-golf-orbit.js`: power-bar mega-drive, gated curved planet, glowing arc trail, ~7s flight). Go through it critically — critique the BONES (the curved-planet look, the camera framing, the trail, the power bar, the flight feel, the art) and IMPROVE it so the bones look AMAZING. Re-research the real Golf Orbit (TapNation) for reference. Builder/critic loop; raise the visual + feel bar substantially. Deliver the improved version + before/after GIFs.

## 3. Soft-body planet — NEW prototype
Build a NEW prototype: a SOFT-BODY planet where the ball AND the terrain are soft-body (jelly-like). The hook: when you sink the ball in the hole, the terrain goes JELLY — wobbles/deforms — and TRANSFORMS into a NEW hole, with the ball placed at a new position (a morphing terrain transition between holes). The user did a lot of soft-body work in `/mnt/c/dev/sandbox/weird-golf-study` — there are TWO versions there: one a NEW-engine version and one a NON-new-engine version. STUDY BOTH thoroughly, learn from them, and deliver the BEST version of a soft-body planet that fits our world + looks like our game (our white dimpled ball, our palette, our flat-art style, deep-space sky). Iterate until the soft-body ball + jelly terrain + the sink → morph → new-hole transition feel great.

---
