// ── The Save (one door to the whole persistent state) ──────
// Every scrap of progress the game keeps lives in localStorage under the `rg-` prefix —
// wallet, per-slot best tiers, ship parts, the caddy, knowledge flags, the constellation
// count, the collection, the once-per-seed faucets. They're written from a dozen files
// (economy.js, ship.js, shop.js, run.js, progression.js, secrets.js, wrap.js). This module
// is the single place that knows the SAVE as one object: export it, import it, wipe it back
// to a virgin first-boot, snapshot/restore it in memory.
//
// It owns no game logic — it only moves the `rg-` keyspace around. Enumeration is by PREFIX
// (every key the game persists begins `rg-`), so dynamic-suffix keys (rg-tier-<course>-<i>,
// rg-best-<seed>, rg-ship-part-<n>, rg-knows-<flag>, rg-fault-<seed> faucets) and any future
// key are covered without a hand-maintained list that would silently drift. UI/dev `rg-*`
// strings (rg-lab, rg-hint, rg-launch-btn, rg-feel-*) are DOM element IDs, never localStorage,
// so the prefix wipe is exactly the persistent game state and nothing else.
//
// Note: `dg-seed` (and dg-terrain-texture) are ENGINE keys, owned by main.js/the core, not the
// roguelike layer — they're the current terrain seed, not progress. A reset leaves them be;
// main.js reseeds the run on the next boot. Peel this file off and persistence is unchanged —
// the game still saves through localStorage directly; you just lose the one-door API.
(function () {
  var PREFIX = 'rg-';
  var VERSION = 1;          // bump when the meaning of a key changes (migration hook lives here)

  // Every `rg-` key currently in localStorage. Sorted for stable, diffable exports.
  function allKeys() {
    var out = [];
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (k && k.indexOf(PREFIX) === 0) out.push(k);
      }
    } catch (e) {}
    out.sort();
    return out;
  }

  // The live save as a plain { key: value } map (values are the stored strings).
  function readAll() {
    var keys = allKeys(), map = {};
    for (var i = 0; i < keys.length; i++) {
      try { map[keys[i]] = localStorage.getItem(keys[i]); } catch (e) {}
    }
    return map;
  }

  // Remove every `rg-` key. Collect first, then delete — never mutate localStorage while
  // iterating it by index (deletes shift the indices and skip keys).
  function wipe() {
    var keys = allKeys();
    for (var i = 0; i < keys.length; i++) {
      try { localStorage.removeItem(keys[i]); } catch (e) {}
    }
    return keys.length;
  }

  // Write a { key: value } map into localStorage. Non-`rg-` keys in the map are ignored
  // (defence-in-depth: an import can only ever touch the roguelike keyspace).
  function writeMap(map) {
    if (!map) return 0;
    var n = 0;
    for (var k in map) {
      if (!Object.prototype.hasOwnProperty.call(map, k)) continue;
      if (k.indexOf(PREFIX) !== 0) continue;
      var v = map[k];
      if (v == null) continue;
      try { localStorage.setItem(k, String(v)); n++; } catch (e) {}
    }
    return n;
  }

  window.RG_SAVE = {
    VERSION: VERSION,
    PREFIX: PREFIX,

    // List of the `rg-` keys currently saved (handy for the dev panel / audits).
    keys: allKeys,

    // The save as a live map (a fresh object each call; mutating it does nothing).
    asObject: readAll,

    // Serialize the whole save to a versioned JSON envelope:
    //   { app:'space-golf', v:<VERSION>, ts:<ms>, keys:{ 'rg-money':'42', ... } }
    // The envelope (not raw keys) carries the version so the keyspace stays pure game state.
    export: function () {
      return JSON.stringify({
        app: 'space-golf',
        v: VERSION,
        ts: Date.now(),
        keys: readAll(),
      });
    },

    // Replace the entire save with the contents of a JSON envelope (as produced by export()).
    // Wipes first so the result is EXACTLY the imported save — no stale keys survive (a true
    // restore, not a merge). Returns { ok, version, count } or { ok:false, error }.
    import: function (json) {
      var data;
      try { data = (typeof json === 'string') ? JSON.parse(json) : json; }
      catch (e) { return { ok: false, error: 'bad JSON: ' + (e && e.message) }; }
      if (!data || typeof data !== 'object' || !data.keys || typeof data.keys !== 'object') {
        return { ok: false, error: 'envelope missing .keys map' };
      }
      wipe();
      var n = writeMap(data.keys);
      return { ok: true, version: data.v != null ? data.v : null, count: n };
    },

    // Wipe all `rg-` keys → a virgin first-boot (no money, no parts, no knowledge, nothing
    // collected). The designer uses this to re-experience the cold open — e.g. the very first
    // caddy purchase, the first Codex bloom. Returns the number of keys removed.
    reset: function () { return wipe(); },

    // In-memory round-trip pair (NOT persisted): grab the current save as an opaque object,
    // mutate freely, then put it back exactly. Used for tests and for "try this, then undo".
    snapshot: function () { return { v: VERSION, ts: Date.now(), keys: readAll() }; },
    restore: function (snap) {
      if (!snap || !snap.keys) return { ok: false, error: 'not a snapshot' };
      wipe();
      var n = writeMap(snap.keys);
      return { ok: true, count: n };
    },
  };

  // ── ?reset — manual progress wipe for testing (any build) ──
  // Add ?reset to the URL to wipe ALL saved progress to a virgin first-boot on THIS load, then it
  // strips the param so the next refresh persists normally. Runs synchronously here — save.js loads
  // before profile.js/run.js read progress — so the game simply boots cold. Not gated to ?dev.
  if (typeof location !== 'undefined' && /[?&]reset\b/.test(location.search)) {
    try {
      var _wiped = wipe();
      try { console.log('[RG_SAVE] ?reset: wiped ' + _wiped + ' rg- keys → virgin first-boot.'); } catch (e) {}
      var _clean = location.search.replace(/[?&]reset(=[^&]*)?/g, '');
      if (_clean === '?') _clean = '';
      history.replaceState(null, '', location.pathname + _clean + location.hash);
    } catch (e) {}
  }

  // ── Dev-only reset control ─────────────────────────────────
  // A small button so the designer can wipe to virgin first-boot without the console. Lives in
  // the Secrets Lab panel when it exists (so it sits with the other dev tools); otherwise a tiny
  // standalone chip. ?dev only — never shows for players. After wiping, reload so the boot path
  // runs cold (main.js reseeds, the run controller starts fresh).
  if (typeof location === 'undefined' || !/[?&]dev\b/.test(location.search)) return;

  function doReset() {
    var n = RG_SAVE.reset();
    try { console.log('[RG_SAVE] reset: wiped ' + n + ' rg- keys → virgin first-boot. Reloading…'); } catch (e) {}
    try { location.reload(); } catch (e) {}
  }

  function styleResetBtn(b) {
    b.textContent = '⟲ Reset save (first-boot)';
    b.style.cssText = 'display:block;width:100%;text-align:left;margin:3px 0;padding:5px 8px;cursor:pointer;'
      + 'font:11px/1.35 "Departure Mono",monospace;color:#ffd1d1;background:rgba(232,96,96,0.10);'
      + 'border:1px solid rgba(232,96,96,0.4);border-radius:7px;';
    b.onmouseenter = function () { b.style.background = 'rgba(232,96,96,0.22)'; };
    b.onmouseleave = function () { b.style.background = 'rgba(232,96,96,0.10)'; };
    b.onclick = function (e) { e.stopPropagation(); doReset(); };
  }

  function standaloneChip() {
    if (document.getElementById('rg-save-reset')) return;
    var b = document.createElement('button');
    b.id = 'rg-save-reset';
    styleResetBtn(b);
    b.style.position = 'fixed';
    b.style.left = '10px';
    b.style.bottom = '10px';
    b.style.zIndex = '9990';
    b.style.width = 'auto';
    document.body.appendChild(b);
  }

  function init() { standaloneChip(); }   // the Secrets Lab is gone — drop the reset chip standalone (bottom-left)

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
