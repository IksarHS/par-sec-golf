// ── build/build.cjs — PRODUCTION BUILD for GitHub Pages ────────────────────────────────────────────
// Par Sec is vanilla JS that relies on GLOBAL SCOPE shared across ~64 separate <script> tags (NOT ES
// modules). The eng risk here is bundling: ES-module bundlers rename/scope top-level `let`/`const`, which
// would BREAK the implicit global sharing. So we DELIBERATELY do NOT do module bundling. Instead:
//
//   1. CONCATENATE the runtime scripts in EXACT devbuild.html load order into one file (script concat — the
//      same trick build/verify.cjs uses to make the engine's top-level let/const shared).
//   2. MINIFY that concat with esbuild in `--bundle=false` IIFE-free mode (keepNames, no module wrapping),
//      so behaviour is byte-for-byte identical, just smaller.
//   3. Emit player-build/index.html that loads the single bundle + preserves devbuild.html's inline boot scripts.
//   4. Copy only the RUNTIME assets (fonts + the flat-vector tour uses no sprites → drop the 2.6 MB PNGs).
//   5. Drop dev-only, URL-gated tooling files from the bundle (editor, perf-hud, cam-debug, …) — BUT keep
//      playtest-bot.js: RG.bot is used at runtime by level-design.js `_validateHole` to guarantee every
//      generated hole is sinkable. Dropping it would silently skip solvability validation. NON-NEGOTIABLE.
//
// Run: node build/build.cjs   →   writes ./player-build/
// All paths in player-build are RELATIVE so the site works under a GitHub Pages subpath (/<repo>/...).

'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const DIST = path.join(ROOT, 'player-build');
const ESBUILD = process.env.ESBUILD_BIN || '/tmp/shipbuild-tools/node_modules/.bin/esbuild';

// ── The runtime script load order (mirrors devbuild.html EXACTLY, minus dev-only tooling) ───────────────
// Dev-only files EXCLUDED from the production bundle (all are URL-gated / inert in normal play, and are
// only reachable via ?dev/?edit/?perf/?dbg/?seq/?goto/?showcase deep-links). EXCLUSION = simply NOT being
// in the SCRIPTS allow-list below (there is no separate drop list); these are documented here for clarity:
//   src/debug-menu.js  ← unified DEBUG MENU home base (backtick-toggled) — DEV-ONLY, never ships.
//   src/lab.js, src/showcase.js, src/cam-debug.js, src/editor.js, src/editor-trace.js,
//   src/roguelike/lab.js, src/roguelike/feel.js, src/roguelike/perf-hud.js, src/roguelike/seqtest.js,
//   src/roguelike/testjump.js
// KEPT (used at runtime): src/roguelike/playtest-bot.js  ← RG.bot drives _validateHole solvability check.
const SCRIPTS = [
  // Engine core
  'game/shared.js',
  'game/worlds/run.js',
  'game/planet-gen.js',
  // NOTE: src/lab.js is dev-only (Hole-Type Lab) — EXCLUDED.
  'game/level-design.js',
  'game/moon-terrain.js',
  'game/set-pieces.js',
  // DREAM hole-gen (composed signal generator + caves + floating landmarks) — Tau Ceti system.
  'game/holegen/spine.js',
  'game/holegen/operators.js',
  'game/holegen/skin.js',
  'game/holegen/caves.js',
  'game/holegen/setpieces-dream.js',
  'game/holegen/score.js',
  'game/holegen/dreamgen.js',
  'game/water.js',
  'game/modes/desert-golfing.js',
  'game/art.js',
  'game/gameplay.js',
  // Roguelike layer + META (save / profile / login / starmap / scorecard)
  'game/runtime/save.js',
  'game/runtime/profile.js',
  'game/runtime/modifiers.js',
  'game/runtime/run.js',
  'game/runtime/economy.js',
  'game/runtime/wrap.js',
  'game/runtime/audio.js',
  'game/runtime/fx.js',
  'game/runtime/juice.js',
  'game/runtime/ambient.js',
  // fx-lab.js / gfx-lab.js (the ?fx/?gfx post-process shader labs) are DEV-ONLY — excluded from the
  // player build. They still load in devbuild.html (the dev build). Restore here if you ever ship them.
  'game/runtime/travel.js',
  'game/runtime/starmap-ingame.js',
  'game/runtime/event.js',
  'game/runtime/terrain.js',
  // RUNTIME-REQUIRED: the autoplay bot — RG.bot is consumed by level-design _validateHole (solvability).
  'game/runtime/playtest-bot.js',
  // Atlas / experimental playable bodies (golf-orbit, puzzle, watersim, particlefluid, climb, blocks, …).
  // Each registers courses ONLY under ?course=/?atlas/?galaxy, so the default Earth->… tour is untouched,
  // but they ARE real playable content linked from index.html → keep them in the ship build.
  'atlas/galaxy.js',
  'atlas/homesystem.js',
  'atlas/fields.js',
  'atlas/fields2.js',
  'atlas/creatures.js',
  'atlas/relics.js',
  'atlas/portals.js',
  'atlas/onlyup.js',
  'atlas/climb.js',
  'atlas/blocks.js',
  'atlas/golf-orbit.js',
  'atlas/objects.js',
  'atlas/watersim.js',
  'atlas/particlefluid.js',
  'atlas/setpieces.js',
  'atlas/puzzle-mode.js',
  // src/showcase.js is dev-only (Generator Showcase) — EXCLUDED.
  // PORTRAIT MOBILE MODE (gated, inert unless ?portrait) — MUST be bundled so ?portrait works in the player-build build.
  'game/runtime/portrait.js',
  'game/main.js',
];

// Inline scripts from devbuild.html that must be preserved (in order, relative to the bundle).
// 1. RG_MINIMAL toggle — runs BEFORE save.js. We bake it into the head so it precedes the bundle.
// 2. The ?course= autostart block — runs AFTER main.js. Baked after the bundle <script>.

function log(...a) { console.log('[build]', ...a); }

// ── 1. Clean + create player-build ──
fs.rmSync(DIST, { recursive: true, force: true });
fs.mkdirSync(DIST, { recursive: true });
fs.mkdirSync(path.join(DIST, 'assets', 'fonts'), { recursive: true });
fs.mkdirSync(path.join(DIST, 'game'), { recursive: true });

// ── 2. Concatenate runtime scripts in exact order ──
let combined = '';
let rawBytes = 0;
for (const f of SCRIPTS) {
  const p = path.join(ROOT, f);
  if (!fs.existsSync(p)) throw new Error('missing script: ' + f);
  let code = fs.readFileSync(p, 'utf8');
  // (Removed 2026-06-30: the shared.js sprite-preload neutralizer — the SPRITE_CATALOG/preload block was
  //  deleted from source along with the unused sprite PNGs, so there's nothing to patch.)
  rawBytes += Buffer.byteLength(code);
  // Separator comment + a newline guard (some files may not end in a newline / may end in a line comment).
  combined += `\n/* ===== ${f} ===== */\n` + code + '\n';
}
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
// (Sprite PNGs were deleted from the repo entirely 2026-06-30 — the flat-vector game places no sprites.)
log('copied fonts');

// starmap.html overlay (opened by starmap-ingame.js) loads starmap.js + starmap-data.js + planet-gen.js.
// Copy the star-map page and its scripts so the in-game ✦ MAP works in player-build.
fs.copyFileSync(path.join(ROOT, 'starmap.html'), path.join(DIST, 'starmap.html'));
for (const f of ['starmap.js', 'starmap-data.js', 'planet-gen.js']) {
  fs.copyFileSync(path.join(ROOT, 'game', f), path.join(DIST, 'game', f));
}
fs.mkdirSync(path.join(DIST, 'game', 'runtime'), { recursive: true });
fs.copyFileSync(path.join(ROOT, 'game', 'runtime', 'profile.js'), path.join(DIST, 'game', 'runtime', 'profile.js'));
log('copied starmap.html + its scripts');

// ── 5. Emit player-build/index.html (the game entry; relative paths for GitHub Pages subpath) ──
const runHtml = fs.readFileSync(path.join(ROOT, 'devbuild.html'), 'utf8');
// Pull the <head> contents (font preload, favicon, styles) and the <body> chrome (loading splash, canvas,
// hud) verbatim from devbuild.html, then swap the 64 <script> tags for the single bundle + preserved inline boot.

// Extract head inner (everything between <head> and </head>)
const headInner = runHtml.match(/<head>([\s\S]*?)<\/head>/)[1];
// Extract the body chrome up to (but not including) the first engine <script src> tag.
let bodyChrome = runHtml.slice(runHtml.indexOf('<body>') + '<body>'.length, runHtml.indexOf('<!-- Engine core'));
// Strip the DEV BUILD FLAG: the PLAYER build must NOT set window.RG_DEV, so dev-only handlers (autoplay,
// etc.) stay inert. It's set only in devbuild.html (the dev build). Without this strip the flag leaks into player-build.
bodyChrome = bodyChrome.replace(/<!--\s*DEV BUILD FLAG[\s\S]*?<script>\s*window\.RG_DEV[\s\S]*?<\/script>\s*/, '');

// The ?course= autostart block (verbatim) from devbuild.html — find the last <script> IIFE block.
const autostart = runHtml.slice(runHtml.indexOf('<!-- Dev shortcut: jump straight to a BASE course'), runHtml.indexOf('</body>'));

const indexHtml = `<!DOCTYPE html>
<html>
<head>${headInner}</head>
<body>${bodyChrome}
<!-- ── PRODUCTION BUILD ──────────────────────────────────────────────────────────────────────────
     Single minified bundle = devbuild.html's runtime scripts concatenated in exact load order (globals
     preserved; NOT ES-module bundled). Dev-only tooling (editor/lab/perf-hud/cam-debug/showcase/…) is
     excluded; playtest-bot.js IS kept (RG.bot drives the runtime hole-solvability validator). The flat
     tour's 2.6 MB sprite PNGs are dropped (unused). All paths RELATIVE → works under a /<repo>/ subpath.

     CLOUD SAVES (optional): set window.RG_SYNC_URL below to your deployed /api/save endpoint to enable
     cross-device save sync. Unset = localStorage-only (fully playable). See player-build/README.md. -->
<script>
  // window.RG_SYNC_URL = 'https://<your-app>.vercel.app/api/save';  // ← set to enable cloud saves
</script>
<script src="parsec.min.js"></script>
${autostart}
</body>
</html>
`;
fs.writeFileSync(path.join(DIST, 'index.html'), indexHtml);
log('wrote player-build/index.html');

// ── 6. (intentionally empty) The PUBLIC build is the POLISHED GAME ONLY — experiments/prototypes are
//      NOT published. Per owner policy: the online version is a clean, ready-to-show, stripped-down build;
//      prototypes (golf-orbit/soft-body/stickman/aesthetics/golfball, the play.html hub) stay private
//      (repo + local dev server only) until explicitly opted in. To re-publish experiments later, restore
//      a prototype-copy + hub step here.
log('public build: game only (experiments excluded)');

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
log('DONE. player-build total:', (distSize / 1024).toFixed(0), 'KB');
