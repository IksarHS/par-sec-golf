// ── Profile / per-planet scores / username login + cloud sync (META layer) ──────
// Additive + peel-off-able. Sits ON TOP of RG_SAVE (save.js), which already wraps the
// entire `rg-` localStorage keyspace as one blob. This module adds three things the
// progression layer needs:
//
//   1. RG_SCORES  — the real PER-PLANET scorecard store (best + last total/par per body),
//                   plus the current itinerary position. All under `rg-` keys so RG_SAVE
//                   carries them in its export blob for free.
//   2. RG_PROFILE — a light username "login" (NO email, NO password — see note below) that
//                   names a save and, when a backend is configured, syncs the save blob.
//   3. RG_SYNC    — a thin sync client: localStorage is ALWAYS the source of truth; if a
//                   backend URL is set it POSTs the blob on save and can GET it on login,
//                   falling back silently to localStorage when the backend is unreachable.
//
// SECURITY NOTE (intentional, documented limitation): the username is treated as a NON-SECRET
// save key — anyone who knows a username can load/overwrite that save. There is NO auth here by
// design (the brief asks for a light "username starts a save" flow, no email/password). Do NOT
// store anything sensitive in the save. A real product would add an auth token; the sync client
// is structured so a token could be added to the fetch headers without touching the rest.
//
// Peel this file (+ its <script> tag) off → the base game is unchanged (it never reads these).
(function () {
  'use strict';
  var LS = (typeof localStorage !== 'undefined') ? localStorage : null;
  function get(k, d) { try { var v = LS && LS.getItem(k); return v == null ? d : v; } catch (e) { return d; } }
  function set(k, v) { try { if (LS) LS.setItem(k, String(v)); } catch (e) {} }

  // ── 1. Per-planet scores ────────────────────────────────────────────────────
  // One JSON blob, key `rg-pscores`. Shape:
  //   { "<courseId>": { par, total, best, plays, lastTs }, ... }
  // total/par = the most recent completed run on that body; best = the lowest total ever.
  // Stored as JSON (a single key) so it's compact and RG_SAVE picks it up automatically.
  var PSCORES_KEY = 'rg-pscores';
  var ITINPOS_KEY = 'rg-itin-pos';   // last-played itinerary id (resume point)

  function loadScores() {
    var raw = get(PSCORES_KEY, '');
    if (!raw) return {};
    try { var o = JSON.parse(raw); return (o && typeof o === 'object') ? o : {}; } catch (e) { return {}; }
  }
  function saveScores(map) { set(PSCORES_KEY, JSON.stringify(map || {})); }

  var RG_SCORES = {
    PSCORES_KEY: PSCORES_KEY,
    ITINPOS_KEY: ITINPOS_KEY,

    all: function () { return loadScores(); },
    get: function (courseId) { return loadScores()[courseId] || null; },

    // Record a completed run on a body. Updates last total/par and the all-time best.
    // Returns { rec, isNewBest } so the scorecard can flag a record.
    record: function (courseId, total, par) {
      if (!courseId) return null;
      var map = loadScores();
      var prev = map[courseId] || null;
      var prevBest = prev && prev.best != null ? prev.best : null;
      var best = (prevBest == null) ? total : Math.min(prevBest, total);
      var isNewBest = (prevBest == null) || (total < prevBest);
      map[courseId] = {
        par: par,
        total: total,
        best: best,
        plays: (prev && prev.plays ? prev.plays : 0) + 1,
        lastTs: Date.now(),
      };
      saveScores(map);
      return { rec: map[courseId], isNewBest: isNewBest };
    },

    // True if this body has a recorded (completed) score.
    played: function (courseId) { return !!loadScores()[courseId]; },

    // Resume point — the last itinerary id the player was on (or null).
    itinPos: function () { return get(ITINPOS_KEY, '') || null; },
    setItinPos: function (courseId) { if (courseId) set(ITINPOS_KEY, courseId); },

    // For tests / the dev panel.
    clear: function () { try { LS && LS.removeItem(PSCORES_KEY); LS && LS.removeItem(ITINPOS_KEY); } catch (e) {} },
  };

  // ── 3. Sync client (defined before profile so login can use it) ──────────────
  // Backend URL is configured by one of (first wins):
  //   · ?sync=<url>           (dev override)
  //   · window.RG_SYNC_URL    (set in run.html / a config script)
  //   · localStorage rg-sync-url (persisted by the login UI if the user pastes one)
  // The endpoint contract (matches api/save.js):
  //   GET  <url>?user=<name>            -> { ok:true, blob:<saveEnvelopeString>|null }
  //   POST <url>  {user, blob}          -> { ok:true }
  // localStorage is ALWAYS the source of truth; the cloud is a convenience mirror.
  var SYNC_URL_KEY = 'rg-sync-url';
  function syncUrl() {
    try {
      var m = /[?&]sync=([^&]+)/.exec(location.search);
      if (m) return decodeURIComponent(m[1]);
    } catch (e) {}
    if (window.RG_SYNC_URL) return window.RG_SYNC_URL;
    return get(SYNC_URL_KEY, '') || null;
  }

  var RG_SYNC = {
    SYNC_URL_KEY: SYNC_URL_KEY,
    url: syncUrl,
    enabled: function () { return !!syncUrl() && typeof fetch === 'function'; },
    setUrl: function (u) { if (u) set(SYNC_URL_KEY, u); },

    // Push the current save blob to the cloud (best-effort; never throws, never blocks gameplay).
    // Returns a Promise<bool ok>. Silently resolves false if no backend / unreachable.
    push: function (user) {
      var url = syncUrl();
      if (!url || !user || typeof fetch !== 'function' || !window.RG_SAVE) return Promise.resolve(false);
      var blob = window.RG_SAVE.export();
      return fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user: user, blob: blob }),
      }).then(function (r) { return r.ok; }).catch(function () { return false; });
    },

    // Pull a save blob for a username from the cloud. Returns Promise<string|null> (the
    // save envelope) — null when none exists or the backend is unreachable.
    pull: function (user) {
      var url = syncUrl();
      if (!url || !user || typeof fetch !== 'function') return Promise.resolve(null);
      var u = url + (url.indexOf('?') >= 0 ? '&' : '?') + 'user=' + encodeURIComponent(user);
      return fetch(u, { method: 'GET' })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (j) { return (j && j.ok && j.blob) ? j.blob : null; })
        .catch(function () { return null; });
    },
  };

  // ── 2. Profile / username login ──────────────────────────────────────────────
  // The active username is itself a persisted `rg-` key, so it rides along in the save blob
  // (and identifies whose blob this is on the backend). Logging in with a NEW name on a fresh
  // device, with a backend configured, pulls that name's blob and imports it.
  var USER_KEY = 'rg-user';

  var RG_PROFILE = {
    USER_KEY: USER_KEY,
    user: function () { return get(USER_KEY, '') || null; },
    loggedIn: function () { return !!(get(USER_KEY, '') || '').trim(); },

    // Normalize a username to a safe save key (non-secret; lowercased, trimmed, slug-ish).
    normalize: function (name) {
      return String(name || '').trim().toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 32);
    },

    // Start (or continue) a save under `name`.
    //  · If a backend is configured AND the local save is empty (or `force` pull requested),
    //    try to pull that user's cloud blob and import it.
    //  · Always sets the active username locally.
    // Returns Promise<{ ok, user, pulled }>. Never rejects — offline is a normal, silent path.
    login: function (name, opts) {
      opts = opts || {};
      var u = this.normalize(name);
      if (!u) return Promise.resolve({ ok: false, error: 'empty username' });
      var self = this;
      function finish(pulled) {
        set(USER_KEY, u);
        // Mirror the (possibly freshly-imported) save up so the cloud has the latest.
        try { RG_SYNC.push(u); } catch (e) {}
        return { ok: true, user: u, pulled: !!pulled };
      }
      if (!RG_SYNC.enabled()) return Promise.resolve(finish(false));
      // Pull the cloud blob for this user. If found, import it (replaces local — the cloud is
      // the cross-device truth for an existing account). If none, this is a new account.
      return RG_SYNC.pull(u).then(function (blob) {
        if (blob && window.RG_SAVE) {
          var res = window.RG_SAVE.import(blob);
          // import() wiped the local save and wrote the cloud one; re-stamp the username
          // (import may carry a different rg-user, but the user just chose THIS one).
          if (res && res.ok) { set(USER_KEY, u); return finish(true); }
        }
        return finish(false);
      }).catch(function () { return finish(false); });
    },

    // Log out: forget the active username locally. Does NOT wipe the save (so the local
    // progress is still there to be continued); just clears the name + the cloud link.
    logout: function () { try { LS && LS.removeItem(USER_KEY); } catch (e) {} },

    // Push the current save up under the active user (best-effort). Called after meaningful
    // progress (e.g. completing a body). Debounced lightly so rapid saves don't spam.
    _pushT: 0,
    syncUp: function () {
      var u = this.user(); if (!u) return;
      var now = Date.now();
      if (now - this._pushT < 1500) return;   // light debounce
      this._pushT = now;
      try { RG_SYNC.push(u); } catch (e) {}
    },
  };

  window.RG_SCORES = RG_SCORES;
  window.RG_SYNC = RG_SYNC;
  window.RG_PROFILE = RG_PROFILE;
})();
