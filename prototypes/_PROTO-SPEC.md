# Prototype Art + Env Spec (read this before building a faceted-golf prototype)

Our game = "Par Sec", a Desert-Golfing-on-Mars flat-faceted golf game set across the solar system.
A new prototype MUST look like it belongs in OUR game — not a different game. Match these exactly.

## Dev server + tooling
- Dev server (WSL): `http://172.19.97.28:8236` serves the repo root. A file at
  `prototypes/foo.html` is reachable at `http://172.19.97.28:8236/prototypes/foo.html`.
- GIFs/screenshots → `/mnt/c/dev/editor-shots/` (August reads them there; `/tmp` can't be shown inline).
- Browse tool: `B=~/.claude/skills/gstack/browse/dist/browse`. Read `~/.claude/skills/gstack/SKILL.md`
  (or `browse --help`) for commands (open/screenshot/eval/etc). For CONCURRENT agents you MUST use an
  isolated daemon: prefix every browse call with `BROWSE_STATE_FILE=/tmp/<unique-name>/state.json`.
- To make a clean GIF: drive the canvas headlessly (each prototype exposes `window.__step()`,
  `window.__reset()`, `window.__frame()`, `window.__setAuto(false)`), screenshot frames, assemble with
  ffmpeg or ImageMagick (`convert -delay 4 -loop 0 frames/*.png out.gif`). Keep GIFs < ~6 MB.

## Canvas
- `<canvas id="c" width="960" height="540">`, 2D context. `html,body{margin:0;background:#0c0e14;overflow:hidden}`.
- `<link rel="icon" href="data:,">` to kill the favicon 404.
- Init state (reset()) BEFORE starting the rAF loop, or you get a blank first frame.

## Font — Departure Mono (REQUIRED for all text)
```html
<link rel="preload" href="../assets/fonts/DepartureMono-Regular.woff2" as="font" type="font/woff2" crossorigin>
<style>@font-face{font-family:'Departure Mono';
  src:url('../assets/fonts/DepartureMono-Regular.woff2') format('woff2'),
      url('../assets/fonts/DepartureMono-Regular.woff') format('woff');
  font-weight:normal;font-style:normal;font-display:swap;}</style>
```
Use `"Npx 'Departure Mono', monospace"` for every `ctx.font`.

## Deep-space sky
- Vertical gradient, dark. Two known-good pairs:
  - `#08090f → #0f1622 → #172534`  (golf-orbit)
  - `#1a2230 → #26303c`            (stickman)
- Stars: ~70 small 1–2px dots, mostly `rgba(255,255,255,0.45)`, some `rgba(190,210,255,0.85)`. Parallax
  slower than camera (×0.4 x, ×0.2 y). Twinkle optional, subtle.

## The white dimpled ball (signature — copy exactly)
```js
var BALL_R = 9; // scale to taste per proto
ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x, y, BALL_R, 0, 6.2832); ctx.fill();
ctx.save(); ctx.translate(x, y); ctx.rotate(ball.rotation);   // rotation accumulates with roll spin
ctx.fillStyle = 'rgba(0,0,0,0.32)';
for (var i=0;i<3;i++){ var a=(i/3)*Math.PI*2;
  ctx.beginPath(); ctx.arc(Math.cos(a)*BALL_R*0.5, Math.sin(a)*BALL_R*0.5, BALL_R*0.18, 0, 6.2832); ctx.fill(); }
ctx.restore();
```
3 small dark dimples at 0/120/240°, at radius·0.5, size ≈ radius·0.18, rotating with spin.

## Flat-faceted terrain / blocks (one base tone + darker side + lighter top lip)
- Block: base fill, a darker right/side face band (depth), a brighter top lip line (≈4px).
- Terrain line: solid fill below a polyline, a slightly darker second fill offset down a few px, a
  lighter stroke on the surface line. NO gradients/lighting/bloom on terrain — flat color only.

## Flag + cup (match src/art.js drawFlag)
- Cup: a dark notch `#11161e` carved into the surface (vertical walls + a faint inner highlight).
- Pole: `#7888a0`, lineWidth 2, height ≈ 55, starting at the cup's right edge +2.
- Pennant: gold `#e8c840` pentagon (rect body width ≈22 + a triangular point ≈10), hole number in
  `#4a3520`, `"10px 'Departure Mono'"`, centered on the body.

## Aim UI (drag BACK from ball), from src/art.js drawAimUI — if your proto uses drag-aim
1. faded circle `rgba(255,255,255,0.4)` r=8 at drag-start.
2. white launch line `rgba(255,255,255,0.85)` lw2 from start in the LAUNCH dir (opposite of drag) + arrowhead.
3. dark-brown dots `rgba(80,70,55,0.5)` r=2.5 every 10px in the DRAG dir (toward cursor).

## Planet palettes (pick one per prototype; all flat)
- Earth-green: fill `#3f8f3a`, shade `#2f7330`, lip `#5cb653`, hill `#4ea23f`/`#2f7d34`.
- Mars-rust:  fill `#c45c4a`, shade `#8f3d30`, lip `#e07e5f`.
- Slate/rock: fill `#46505e`, side `#3a424e`, lip `#5d6a7a`.
- Greens used for "sticky"/special: `#2ff07a` / `#2fae6a` with a soft glow.

## Conventions
- Keep it PEEL-OFF + standalone (a single self-contained .html in `prototypes/`) OR a gated `?course=`
  atlas mode — never touch the base game.
- Expose the headless API (`__step/__reset/__frame/__setAuto/__shoot/__state`) for screenshotting.
- No dev clutter in the "hero" view: a small title + one hint line max; everything else toggled off by default.
</content>
</invoke>
