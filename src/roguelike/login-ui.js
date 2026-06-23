// ── Username login UI (light, optional) ──────────────────────────────────────
// A small DOM overlay shown once on a cold boot: type a username → START (begins a named
// save) or CONTINUE (resumes from your last itinerary position). A "Play as guest" link
// skips it entirely. Login is OPTIONAL and NEVER a gate — if the player skips, or this file
// is peeled off, the base game boots exactly as before (Earth, fresh run).
//
// On-art: deep-space card, Departure Mono, the same palette as the rest of the meta UI.
// Depends on RG_PROFILE / RG_SCORES (profile.js). Peel this file + its <script> tag → gone.
(function () {
  'use strict';
  if (typeof document === 'undefined') return;

  // Boot a specific body (used by CONTINUE / resume). Falls back to a normal startRun.
  function bootCourse(courseId) {
    function go(n) {
      if (window.RG && RG.startRun && typeof holes !== 'undefined' && window.WORLDS
          && WORLDS['run-world'] && WORLDS['run-world'].courses[courseId]) {
        if (RG.course !== courseId) { try { RG.startRun({ course: courseId, seed: RG.rollSeed ? RG.rollSeed() : 12345 }); } catch (e) {} }
      } else if (n < 240) { setTimeout(function () { go(n + 1); }, 50); }
    }
    go(0);
  }

  function buildOverlay() {
    var ov = document.createElement('div');
    ov.id = 'rg-login';
    ov.style.cssText = 'position:fixed;inset:0;z-index:9998;display:flex;align-items:center;'
      + 'justify-content:center;background:radial-gradient(ellipse at 50% 38%,#10141f 0%,#070811 70%,#05060c 100%);'
      + "font-family:'Departure Mono',monospace;color:#f2ecff;";

    var card = document.createElement('div');
    card.style.cssText = 'width:340px;max-width:88vw;padding:28px 26px;background:rgba(12,14,24,0.72);'
      + 'border:1px solid rgba(150,165,210,0.28);box-shadow:0 0 40px rgba(20,30,60,0.6);text-align:left;';
    ov.appendChild(card);

    var title = document.createElement('div');
    title.textContent = 'PAR SEC';
    title.style.cssText = 'font-size:22px;letter-spacing:5px;color:#f2ecff;margin-bottom:4px;';
    card.appendChild(title);

    var sub = document.createElement('div');
    sub.textContent = 'name your save · resume anywhere';
    sub.style.cssText = 'font-size:11px;color:rgba(160,175,205,0.65);margin-bottom:20px;';
    card.appendChild(sub);

    var input = document.createElement('input');
    input.type = 'text';
    input.placeholder = 'username';
    input.maxLength = 32;
    input.autocapitalize = 'none'; input.autocomplete = 'off'; input.spellcheck = false;
    input.value = (window.RG_PROFILE && RG_PROFILE.user && RG_PROFILE.user()) || '';
    input.style.cssText = 'width:100%;box-sizing:border-box;padding:11px 12px;background:rgba(8,10,18,0.9);'
      + "border:1px solid rgba(150,165,210,0.3);color:#f2ecff;font-family:'Departure Mono',monospace;"
      + 'font-size:14px;letter-spacing:2px;outline:none;margin-bottom:6px;';
    card.appendChild(input);

    var note = document.createElement('div');
    note.style.cssText = 'font-size:10px;color:rgba(150,165,200,0.55);min-height:13px;margin-bottom:16px;';
    card.appendChild(note);

    var btn = document.createElement('button');
    btn.style.cssText = 'width:100%;padding:12px;background:#e8a93a;border:none;color:#2a1f08;'
      + "font-family:'Departure Mono',monospace;font-size:14px;letter-spacing:3px;cursor:pointer;margin-bottom:10px;";
    card.appendChild(btn);

    var guest = document.createElement('div');
    guest.textContent = 'play as guest →';
    guest.style.cssText = 'font-size:11px;color:rgba(160,175,205,0.6);cursor:pointer;text-align:center;';
    card.appendChild(guest);

    // Label START vs CONTINUE based on whether this username already has progress locally.
    function refreshBtn() {
      var has = window.RG_SCORES && RG_SCORES.itinPos && RG_SCORES.itinPos();
      var named = (window.RG_PROFILE && RG_PROFILE.user && RG_PROFILE.user());
      btn.textContent = (has && named) ? 'CONTINUE' : 'START';
      if (window.RG_SYNC && RG_SYNC.enabled && RG_SYNC.enabled()) {
        note.textContent = 'cloud sync on — log in to play on another device';
      } else {
        note.textContent = 'saved on this device';
      }
    }
    refreshBtn();
    input.addEventListener('input', refreshBtn);

    var done = false;
    function dismiss() { if (done) return; done = true; ov.style.transition = 'opacity .25s'; ov.style.opacity = '0'; setTimeout(function () { if (ov.parentNode) ov.parentNode.removeChild(ov); }, 260); }

    function start() {
      var name = input.value.trim();
      if (!name) { input.focus(); return; }
      btn.disabled = true; note.textContent = 'starting…';
      var p = (window.RG_PROFILE && RG_PROFILE.login) ? RG_PROFILE.login(name) : Promise.resolve({ ok: true });
      p.then(function (res) {
        // After a (possibly cloud-pulled) login, resume from the saved itinerary position if any.
        var resume = window.RG_SCORES && RG_SCORES.itinPos && RG_SCORES.itinPos();
        if (resume) {
          // Resume = boot the NEXT unplayed body after the last one played (or replay the last if it's the finale).
          var itin = window.SOLAR_ITINERARY || [];
          var idx = itin.indexOf(resume);
          var next = (idx >= 0 && idx < itin.length - 1) ? itin[idx + 1] : resume;
          bootCourse(next);
        }
        // else: leave the default Earth boot in place (initFirebase already started it).
        dismiss();
      });
    }

    btn.addEventListener('click', start);
    input.addEventListener('keydown', function (e) { if (e.key === 'Enter') start(); });
    guest.addEventListener('click', dismiss);

    document.body.appendChild(ov);
    setTimeout(function () { input.focus(); }, 60);
    return ov;
  }

  // Show the login overlay on a cold boot, UNLESS:
  //   · ?nologin / a deep-link ?course= (the dev/test path wants a specific body, no gate)
  //   · the player already has an active username (returning player — boot straight in,
  //     the overlay would just be friction). They can still re-open it (see RG_LOGIN.open).
  function shouldAutoShow() {
    if (/[?&](nologin|showcase|edit|galaxy|atlas|watersim|dev)\b/.test(location.search)) return false;
    if (/[?&](course|gomoon|mars)\b/.test(location.search)) return false;   // explicit body request
    if (window.RG_PROFILE && RG_PROFILE.loggedIn && RG_PROFILE.loggedIn()) return false;
    return true;
  }

  window.RG_LOGIN = {
    open: buildOverlay,
    maybeShow: function () { if (shouldAutoShow()) buildOverlay(); },
  };

  // Auto-show shortly after boot (after initFirebase has hidden the loading splash + started Earth).
  // The overlay sits ON TOP of the already-running game, so dismissing/guest reveals live play with
  // no extra load. Defers via rAF + a small timeout so the canvas is painted behind it first.
  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    setTimeout(function () { window.RG_LOGIN.maybeShow(); }, 400);
  } else {
    window.addEventListener('load', function () { setTimeout(function () { window.RG_LOGIN.maybeShow(); }, 400); });
  }
})();
