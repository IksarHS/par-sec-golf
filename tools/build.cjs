// ── tools/build.cjs — PRODUCTION BUILD for GitHub Pages ────────────────────────────────────────────
// Par Sec is vanilla JS that relies on GLOBAL SCOPE shared across ~64 separate <script> tags (NOT ES
// modules). The eng risk here is bundling: ES-module bundlers rename/scope top-level `let`/`const`, which
// would BREAK the implicit global sharing. So we DELIBERATELY do NOT do module bundling. Instead:
//
//   1. CONCATENATE the runtime scripts in EXACT run.html load order into one file (script concat — the
//      same trick tools/verify.cjs uses to make the engine's top-level let/const shared).
//   2. MINIFY that concat with esbuild in `--bundle=false` IIFE-free mode (keepNames, no module wrapping),
//      so behaviour is byte-for-byte identical, just smaller.
//   3. Emit dist/index.html that loads the single bundle + preserves run.html's inline boot scripts.
//   4. Copy only the RUNTIME assets (fonts + the flat-vector tour uses no sprites → drop the 2.6 MB PNGs).
//   5. Drop dev-only, URL-gated tooling files from the bundle (editor, perf-hud, cam-debug, …) — BUT keep
//      playtest-bot.js: RG.bot is used at runtime by level-design.js `_validateHole` to guarantee every
//      generated hole is sinkable. Dropping it would silently skip solvability validation. NON-NEGOTIABLE.
//
// Run: node tools/build.cjs   →   writes ./dist/
// All paths in dist are RELATIVE so the site works under a GitHub Pages subpath (/<repo>/...).

'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const ESBUILD = process.env.ESBUILD_BIN || '/tmp/shipbuild-tools/node_modules/.bin/esbuild';

// ── The runtime script load order (mirrors run.html EXACTLY, minus dev-only tooling) ───────────────
// Dev-only files EXCLUDED from the production bundle (all are URL-gated / inert in normal play, and are
// only reachable via ?dev/?edit/?perf/?dbg/?seq/?goto/?showcase deep-links):
//   src/lab.js, src/showcase.js, src/cam-debug.js, src/editor.js, src/editor-trace.js,
//   src/roguelike/lab.js, src/roguelike/feel.js, src/roguelike/perf-hud.js, src/roguelike/seqtest.js,
//   src/roguelike/testjump.js
// KEPT (used at runtime): src/roguelike/playtest-bot.js  ← RG.bot drives _validateHole solvability check.
const SCRIPTS = [
  // Engine core
  'src/shared.js',
  'src/worlds/run.js',
  'src/planet-gen.js',
  // NOTE: src/lab.js is dev-only (Hole-Type Lab) — EXCLUDED.
  'src/level-design.js',
  'src/moon-terrain.js',
  'src/set-pieces.js',
  // DREAM hole-gen (composed signal generator + caves + floating landmarks) — Tau Ceti system.
  'src/holegen/spine.js',
  'src/holegen/operators.js',
  'src/holegen/skin.js',
  'src/holegen/caves.js',
  'src/holegen/setpieces-dream.js',
  'src/holegen/score.js',
  'src/holegen/dreamgen.js',
  'src/water.js',
  'src/weird-terrain.js',
  'src/modes/desert-golfing.js',
  'src/art.js',
  'src/gameplay.js',
  // Roguelike layer + META (save / profile / login / starmap / scorecard)
  'src/roguelike/save.js',
  'src/roguelike/profile.js',
  'src/roguelike/login-ui.js',
  'src/roguelike/modifiers.js',
  'src/roguelike/run.js',
  'src/roguelike/secrets.js',
  'src/roguelike/economy.js',
  'src/roguelike/ship.js',
  'src/roguelike/shop.js',
  'src/roguelike/wrap.js',
  'src/roguelike/audio.js',
  'src/roguelike/fx.js',
  'src/roguelike/juice.js',
  'src/roguelike/ambient.js',
  'src/roguelike/onboard.js',
  'src/roguelike/travel.js',
  'src/roguelike/starmap-ingame.js',
  'src/roguelike/event.js',
  'src/roguelike/terrain.js',
  // (manual.js + progression.js are ?full-only via document.write — NOT in the default minimal build.)
  // RUNTIME-REQUIRED: the autoplay bot — RG.bot is consumed by level-design _validateHole (solvability).
  'src/roguelike/playtest-bot.js',
  // Atlas / experimental playable bodies (golf-orbit, puzzle, watersim, particlefluid, climb, blocks, …).
  // Each registers courses ONLY under ?course=/?atlas/?galaxy, so the default Earth->… tour is untouched,
  // but they ARE real playable content linked from index.html → keep them in the ship build.
  'src/roguelike/galaxy.js',
  'src/roguelike/atlas-homesystem.js',
  'src/roguelike/atlas-fields.js',
  'src/roguelike/atlas-fields2.js',
  'src/roguelike/atlas-creatures.js',
  'src/roguelike/atlas-relics.js',
  'src/roguelike/atlas-portals.js',
  'src/roguelike/atlas-onlyup.js',
  'src/roguelike/atlas-climb.js',
  'src/roguelike/atlas-blocks.js',
  'src/roguelike/atlas-golf-orbit.js',
  'src/roguelike/atlas-objects.js',
  'src/roguelike/atlas-watersim.js',
  'src/roguelike/atlas-particlefluid.js',
  'src/roguelike/atlas-setpieces.js',
  'src/roguelike/atlas-puzzle-mode.js',
  // src/showcase.js is dev-only (Generator Showcase) — EXCLUDED.
  // PORTRAIT MOBILE MODE (gated, inert unless ?portrait) — MUST be bundled so ?portrait works in the dist build.
  'src/roguelike/portrait.js',
  'src/main.js',
];

// Inline scripts from run.html that must be preserved (in order, relative to the bundle).
// 1. RG_MINIMAL toggle — runs BEFORE save.js. We bake it into the head so it precedes the bundle.
// 2. The ?course= autostart block — runs AFTER main.js. Baked after the bundle <script>.

function log(...a) { console.log('[build]', ...a); }

// ── 1. Clean + create dist ──
fs.rmSync(DIST, { recursive: true, force: true });
fs.mkdirSync(DIST, { recursive: true });
fs.mkdirSync(path.join(DIST, 'assets', 'fonts'), { recursive: true });
fs.mkdirSync(path.join(DIST, 'src'), { recursive: true });

// ── 2. Concatenate runtime scripts in exact order ──
let combined = '';
let rawBytes = 0;
let patchedPreload = false;
for (const f of SCRIPTS) {
  const p = path.join(ROOT, f);
  if (!fs.existsSync(p)) throw new Error('missing script: ' + f);
  let code = fs.readFileSync(p, 'utf8');

  // ── PATCH: neutralize shared.js's eager sprite preload ──────────────────────────────────────────
  // shared.js preloads all 9 sprite PNGs at boot via `new Image()`. We DROP those PNGs (the flat-vector
  // tour places no sprite objects), so those requests would 404 → console errors → ship-gate failure.
  // SPRITES stays an empty {} (its real runtime state anyway). Surgical, exact-match replacement of the
  // preload loop only; if the source ever changes shape, the build FAILS LOUDLY (assert below) rather
  // than silently shipping the 404s. This is the one source-behaviour change in the build, and it is a
  // pure no-op for the shipped tour (no sprite is ever placed → SPRITES is never read with a hit).
  if (f === 'src/shared.js') {
    const preloadRe = /const SPRITES = \{\};\s*\n\/\/ Preload all sprite images\s*\nfor \(const \[key, info\] of Object\.entries\(SPRITE_CATALOG\)\) \{\s*\n\s*const img = new Image\(\);\s*\n\s*img\.src = info\.src;\s*\n\s*img\.onload = \(\) => \{ SPRITES\[key\] = img; \};\s*\n\}/;
    if (!preloadRe.test(code)) {
      throw new Error('PATCH FAILED: shared.js sprite-preload block not found — re-check the regex against src/shared.js before shipping (would otherwise 404 on the dropped PNGs).');
    }
    code = code.replace(preloadRe,
      'const SPRITES = {};\n/* [BUILD] sprite preload removed — PNGs dropped from the production build; the flat-vector tour places no sprite objects, so SPRITES stays {} (its real runtime state). */');
    patchedPreload = true;
  }

  rawBytes += Buffer.byteLength(code);
  // Separator comment + a newline guard (some files may not end in a newline / may end in a line comment).
  combined += `\n/* ===== ${f} ===== */\n` + code + '\n';
}
if (!patchedPreload) throw new Error('PATCH FAILED: src/shared.js was not in the bundle — the sprite-preload patch never ran.');
const concatPath = path.join(DIST, 'parsec.concat.js');
fs.writeFileSync(concatPath, combined);
log('concatenated', SCRIPTS.length, 'scripts →', (rawBytes / 1024).toFixed(0), 'KB raw');

// ── 3. Minify with esbuild (NO module bundling — pure minify of the concat, globals preserved) ──
const outPath = path.join(DIST, 'parsec.min.js');
// CRITICAL: NO --format flag. esbuild's default for a single non-bundled file leaves top-level
// `let`/`const`/`function` at the TRUE global script scope (just like the original 64 <script> tags) —
// so the implicit cross-file global sharing (holes, WORLDS, state, startCourse, …) and the inline boot
// scripts that read those bare globals keep working. `--format=iife` would WRAP everything in
// `(()=>{…})()`, trapping those declarations in a function scope and breaking the whole game. Verified.
// Robust minify: prefer the esbuild JS API (local node_modules — `npm i -D esbuild`), fall back to a
// binary at a couple of stable paths, and if esbuild is missing entirely SHIP THE UNMINIFIED CONCAT so
// the build NEVER crashes on a toolchain gap (GitHub Pages gzips it either way). No --format (globals preserved).
let minified = false;
try {
  const esbuild = require('esbuild');
  fs.writeFileSync(outPath, esbuild.transformSync(combined, {
    minify: true, legalComments: 'none', keepNames: true, target: 'es2018',
  }).code);
  minified = true;
} catch (e) {
  for (const bin of [process.env.ESBUILD_BIN, path.join(ROOT, 'node_modules', '.bin', 'esbuild'), ESBUILD].filter(Boolean)) {
    try { execFileSync(bin, [concatPath, '--minify', '--legal-comments=none', '--keep-names', '--target=es2018', '--outfile=' + outPath], { stdio: 'ignore' }); minified = true; break; } catch (_) { /* try next */ }
  }
  if (!minified) { fs.copyFileSync(concatPath, outPath); log('WARNING: esbuild not found — shipping UNMINIFIED concat (run `npm i -D esbuild` to minify)'); }
}
fs.rmSync(concatPath); // drop the unminified concat from the shippable dir
const minBytes = fs.statSync(outPath).size;
log(minified ? 'minified →' : 'concat (unminified) →', (minBytes / 1024).toFixed(0), 'KB');

// ── 4. Copy runtime assets ──
// Fonts (Departure Mono) — required.
for (const fn of ['DepartureMono-Regular.woff2', 'DepartureMono-Regular.woff', 'DepartureMono-LICENSE']) {
  fs.copyFileSync(path.join(ROOT, 'assets', 'fonts', fn), path.join(DIST, 'assets', 'fonts', fn));
}
// Sprite PNGs (lunar_lander + plants, 2.6 MB) — DROPPED. The flat-vector tour places no sprite objects
// (verified: no `sprite:` keys in level-design; `drawLander` is a vector, not the PNG).
log('copied fonts; dropped 2.6 MB of unused sprite PNGs');

// starmap.html overlay (opened by starmap-ingame.js) loads starmap.js + starmap-data.js + planet-gen.js.
// Copy the star-map page and its scripts so the in-game ✦ MAP works in dist.
fs.copyFileSync(path.join(ROOT, 'starmap.html'), path.join(DIST, 'starmap.html'));
for (const f of ['starmap.js', 'starmap-data.js', 'planet-gen.js']) {
  fs.copyFileSync(path.join(ROOT, 'src', f), path.join(DIST, 'src', f));
}
fs.mkdirSync(path.join(DIST, 'src', 'roguelike'), { recursive: true });
fs.copyFileSync(path.join(ROOT, 'src', 'roguelike', 'profile.js'), path.join(DIST, 'src', 'roguelike', 'profile.js'));
log('copied starmap.html + its scripts');

// ── 5. Emit dist/index.html (the game entry; relative paths for GitHub Pages subpath) ──
const runHtml = fs.readFileSync(path.join(ROOT, 'run.html'), 'utf8');
// Pull the <head> contents (font preload, favicon, styles) and the <body> chrome (loading splash, canvas,
// hud) verbatim from run.html, then swap the 64 <script> tags for the single bundle + preserved inline boot.

// Extract head inner (everything between <head> and </head>)
const headInner = runHtml.match(/<head>([\s\S]*?)<\/head>/)[1];
// Extract the body chrome up to (but not including) the first engine <script src> tag.
const bodyChrome = runHtml.slice(runHtml.indexOf('<body>') + '<body>'.length, runHtml.indexOf('<!-- Engine core'));

// The ?course= autostart block (verbatim) from run.html — find the last <script> IIFE block.
const autostart = runHtml.slice(runHtml.indexOf('<!-- Dev shortcut: jump straight to a BASE course'), runHtml.indexOf('</body>'));

const indexHtml = `<!DOCTYPE html>
<html>
<head>${headInner}</head>
<body>${bodyChrome}
<!-- ── PRODUCTION BUILD ──────────────────────────────────────────────────────────────────────────
     Single minified bundle = run.html's runtime scripts concatenated in exact load order (globals
     preserved; NOT ES-module bundled). Dev-only tooling (editor/lab/perf-hud/cam-debug/showcase/…) is
     excluded; playtest-bot.js IS kept (RG.bot drives the runtime hole-solvability validator). The flat
     tour's 2.6 MB sprite PNGs are dropped (unused). All paths RELATIVE → works under a /<repo>/ subpath.

     CLOUD SAVES (optional): set window.RG_SYNC_URL below to your deployed /api/save endpoint to enable
     cross-device save sync. Unset = localStorage-only (fully playable). See dist/README.md. -->
<script>
  // window.RG_SYNC_URL = 'https://<your-app>.vercel.app/api/save';  // ← set to enable cloud saves
  // RG_MINIMAL: default minimal build (secrets/Codex content gated behind ?full / ?secrets), same as run.html.
  window.RG_MINIMAL = !/[?&](full|secrets)(=|&|$)/.test(location.search);
</script>
<script src="parsec.min.js"></script>
<script>
  if (!window.RG_MINIMAL) {
    document.write('<scr' + 'ipt src="src/roguelike/manual.js"><\\/scr' + 'ipt>');
    document.write('<scr' + 'ipt src="src/roguelike/progression.js"><\\/scr' + 'ipt>');
  }
</script>
${autostart}
</body>
</html>
`;
fs.writeFileSync(path.join(DIST, 'index.html'), indexHtml);
log('wrote dist/index.html');

// Under ?full, manual.js + progression.js are document.write'd — copy them so that path works too.
fs.mkdirSync(path.join(DIST, 'src', 'roguelike'), { recursive: true });
for (const f of ['manual.js', 'progression.js']) {
  fs.copyFileSync(path.join(ROOT, 'src', 'roguelike', f), path.join(DIST, 'src', 'roguelike', f));
}

// ── 6. Copy the SELF-CONTAINED standalone prototypes + a hub page, so they're playable on the live
//      site (and on a phone), not just the local dev server. Each is pure-canvas + ../assets/fonts only
//      (resolves to dist/assets/fonts). Engine-dependent tools (physlab/striking/starmap) are NOT here. ──
fs.mkdirSync(path.join(DIST, 'prototypes'), { recursive: true });
const PROTOS = ['golforbit.html', 'golforbit-planet.html', 'softbody-planet.html', 'ssg-camera.html', 'ssg-levels.js', 'aesthetics.html', 'golfball-llm.html'];
let nProto = 0;
for (const f of PROTOS) {
  const src = path.join(ROOT, 'prototypes', f);
  if (fs.existsSync(src)) { fs.copyFileSync(src, path.join(DIST, 'prototypes', f)); nProto++; }
}
log('copied', nProto, 'standalone prototypes');
const hub = `<!DOCTYPE html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Par Sec — lab</title>
<link rel="preload" href="assets/fonts/DepartureMono-Regular.woff2" as="font" type="font/woff2" crossorigin>
<style>@font-face{font-family:'Departure Mono';src:url('assets/fonts/DepartureMono-Regular.woff2') format('woff2');font-display:swap}
*{margin:0;box-sizing:border-box}body{font-family:'Departure Mono',monospace;background:#0b0d14;color:#e8ecf5;padding:28px 20px;max-width:640px;margin:0 auto;line-height:1.5}
h1{font-size:22px;letter-spacing:4px;margin-bottom:4px}.sub{color:#8a93a8;font-size:12px;margin-bottom:24px}
h2{font-size:12px;color:#7fa8d8;letter-spacing:2px;margin:22px 0 8px}
a{display:block;color:#e8ecf5;text-decoration:none;padding:13px 14px;margin:7px 0;background:#141826;border:1px solid #232a3c;border-radius:9px}
a:active{background:#1c2236}.d{color:#8a93a8;font-size:11px}</style></head>
<body><h1>PAR SEC</h1><div class="sub">flat-faceted procedural space golf &middot; tap to play</div>
<h2>THE GAME</h2>
<a href="./">&#9654; Play &mdash; desktop / landscape<div class="d">the full tour, all systems</div></a>
<a href="./?portrait">&#9654; Play in PORTRAIT &mdash; mobile beta<div class="d">phone-first: snackable holes, 3-planet on-ramp</div></a>
<h2>PROTOTYPES</h2>
<a href="./prototypes/golforbit-planet.html">Golf Orbit &mdash; whole planet + auto-golf</a>
<a href="./prototypes/golforbit.html">Golf Orbit &mdash; mega-drive</a>
<a href="./prototypes/softbody-planet.html">Soft-body planet &mdash; jelly ball + morph</a>
<a href="./prototypes/ssg-camera.html">Super Stickman &mdash; 10-level campaign<div class="d">[ and ] switch levels</div></a>
<a href="./prototypes/aesthetics.html">Aesthetics explorer &mdash; 12 looks<div class="d">keys 1-9 / 0 / - / =</div></a>
<a href="./prototypes/golfball-llm.html">Talking golf ball &mdash; local LLM<div class="d">full voice needs WebGPU + mic</div></a>
</body></html>`;
fs.writeFileSync(path.join(DIST, 'play.html'), hub);
log('wrote dist/play.html (hub)');

// ── 7. PWA: copy the web-app manifest + icons so the site is installable (Add to Home Screen → fullscreen
//      portrait app that launches at ?portrait, no login). iOS uses the apple-* meta + apple-touch-icon. ──
fs.copyFileSync(path.join(ROOT, 'manifest.webmanifest'), path.join(DIST, 'manifest.webmanifest'));
fs.mkdirSync(path.join(DIST, 'assets', 'icons'), { recursive: true });
for (const f of fs.readdirSync(path.join(ROOT, 'assets', 'icons'))) {
  fs.copyFileSync(path.join(ROOT, 'assets', 'icons', f), path.join(DIST, 'assets', 'icons', f));
}
log('copied PWA manifest + icons');

// ── report ──
const distSize = (() => {
  let total = 0;
  (function walk(d) { for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else total += fs.statSync(p).size;
  } })(DIST);
  return total;
})();
log('DONE. dist total:', (distSize / 1024).toFixed(0), 'KB');
