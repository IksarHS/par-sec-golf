// ── The Collection (overt progression) + the hidden Discoveries ────────────
// The surface stays dead-simple, but completing holes WELL quietly fills a collection: get a
// hole at or under par and that hole-of-the-nine is "collected" (persisted, cumulative across
// runs/seeds). Fill all nine → a celebration. Separately, the moment you find your FIRST secret,
// a Discoveries section appears on this page that was never visible before — the iceberg surfacing.
//
// Opened from the run-complete "Progression" button or the 'C' key. Self-contained DOM overlay
// (like the Codex). Peel this file off + the tracking calls no-op; nothing else changes.
(function () {
  if (!window.RG) return;

  // ── Tracking ──
  RG.loadCollection = function () {
    try { this._collected = localStorage.getItem('rg-collected') || ''; } catch (e) { this._collected = ''; }
    if (this._collected.length < 9) this._collected = (this._collected + '000000000').slice(0, 9);
    try { this._eagles = localStorage.getItem('rg-eagles') || ''; } catch (e) { this._eagles = ''; }
    if (this._eagles.length < 9) this._eagles = (this._eagles + '000000000').slice(0, 9);
  };
  RG.collectionCount = function () {
    if (this._collected == null) this.loadCollection();
    var n = 0; for (var i = 0; i < 9; i++) if (this._collected.charAt(i) === '1') n++; return n;
  };
  RG.collectionComplete = function () { return this.collectionCount() >= 9; };
  RG.eaglesCount = function () {
    if (this._eagles == null) this.loadCollection();
    var n = 0; for (var i = 0; i < 9; i++) if (this._eagles.charAt(i) === '1') n++; return n;
  };
  // Called per completed SURFACE hole (from the wrap). par-or-better collects that hole-of-the-nine.
  RG._recordCollect = function (holeIdx, strokesTaken) {
    if (holeIdx < 0 || holeIdx > 8) return;
    if (this._collected == null) this.loadCollection();
    if (this._collected.charAt(holeIdx) === '1') return;                 // already have it
    var par = (this.holePars && this.holePars[holeIdx]) || this.parForHole(holeIdx);
    if (!(strokesTaken > 0 && strokesTaken <= par)) return;              // must be at/under par
    this._collected = this._collected.substring(0, holeIdx) + '1' + this._collected.substring(holeIdx + 1);
    try { localStorage.setItem('rg-collected', this._collected); } catch (e) {}
    this._collectFlash = { holeIdx: holeIdx, frame: 32 };                // a gold flag-plant at the cup, right now
    // strictly under par also claims the deeper "under par" tier — renewable mastery past the basic nine
    if (strokesTaken < par && this._eagles && this._eagles.charAt(holeIdx) !== '1') {
      this._eagles = this._eagles.substring(0, holeIdx) + '1' + this._eagles.substring(holeIdx + 1);
      try { localStorage.setItem('rg-eagles', this._eagles); } catch (e) {}
      if (this.eaglesCount() >= 9) { try { if (!localStorage.getItem('rg-eagles-done')) localStorage.setItem('rg-eagles-done', '1'); } catch (e) {} }
    }
    if (this.collectionComplete()) {
      try { if (!localStorage.getItem('rg-frontnine-done')) { localStorage.setItem('rg-frontnine-done', '1'); this._frontNineJustDone = true; } } catch (e) {}
    }
  };
  RG._discoveriesFound = function () {
    var flags = window.RG_SECRET_FLAGS || [];
    var n = 0; for (var i = 0; i < flags.length; i++) { try { if (localStorage.getItem('rg-knows-' + flags[i]) === '1') n++; } catch (e) {} }
    return n;
  };

  // ── The page ──
  var openEl = null;
  function close() { if (openEl) { openEl.remove(); openEl = null; } }
  RG.openCollection = function () {
    if (openEl) { close(); return; }
    RG.loadCollection();
    var collected = RG._collected, count = RG.collectionCount(), complete = count >= 9;
    var found = RG._discoveriesFound();
    var flags = window.RG_SECRET_FLAGS || [];

    var el = document.createElement('div'); openEl = el; el.id = 'rg-collection';
    el.style.cssText = 'position:fixed;inset:0;z-index:9995;background:rgba(8,6,12,0.97);display:flex;'
      + 'flex-direction:column;align-items:center;justify-content:center;font-family:"Departure Mono",monospace;'
      + 'color:#f2ecff;padding:24px;overflow:auto;';

    var title = document.createElement('div');
    title.style.cssText = 'font-size:24px;letter-spacing:4px;color:#f0c860;margin-bottom:4px;';
    title.textContent = 'FLAGS';
    el.appendChild(title);

    var sub = document.createElement('div');
    sub.style.cssText = 'font-size:13px;color:rgba(242,236,255,0.5);margin-bottom:22px;letter-spacing:1px;';
    sub.textContent = complete ? 'every hole claimed, at or under par' : (count + ' / 9 claimed');
    el.appendChild(sub);

    // the nine holes — a flag lit gold once you've taken that hole at/under par
    var grid = document.createElement('div');
    grid.style.cssText = 'display:grid;grid-template-columns:repeat(9,40px);gap:10px;margin-bottom:8px;';
    for (var i = 0; i < 9; i++) {
      var got = collected.charAt(i) === '1';
      var cell = document.createElement('div');
      cell.style.cssText = 'width:40px;height:52px;border-radius:7px;display:flex;flex-direction:column;'
        + 'align-items:center;justify-content:center;border:1px solid '
        + (got ? 'rgba(240,200,96,0.55)' : 'rgba(255,255,255,0.10)') + ';background:'
        + (got ? 'rgba(240,200,96,0.12)' : 'rgba(255,255,255,0.02)') + ';';
      var flag = document.createElement('div');
      flag.style.cssText = 'font-size:18px;line-height:1;color:' + (got ? '#f0c860' : 'rgba(242,236,255,0.18)') + ';';
      flag.textContent = got ? '⚑' : '⚐';   // filled vs open flag
      cell.appendChild(flag);
      var num = document.createElement('div');
      num.style.cssText = 'font-size:10px;margin-top:4px;color:' + (got ? 'rgba(240,200,96,0.8)' : 'rgba(242,236,255,0.25)') + ';';
      num.textContent = String(i + 1);
      cell.appendChild(num);
      grid.appendChild(cell);
    }
    el.appendChild(grid);

    if (complete) {
      var done = document.createElement('div');
      done.style.cssText = 'margin-top:14px;font-size:15px;letter-spacing:2px;color:#f0c860;text-shadow:0 0 12px rgba(240,200,96,0.5);';
      done.textContent = '★  ALL NINE FLAGS ARE YOURS  ★';
      el.appendChild(done);
    } else {
      var hint = document.createElement('div');
      hint.style.cssText = 'margin-top:12px;font-size:11px;color:rgba(242,236,255,0.35);';
      hint.textContent = 'take each hole at or under par to collect it';
      el.appendChild(hint);
    }

    // The deeper "under par" tier — a renewable mastery track past the basic nine (dim, green),
    // surfaced only once you're engaged so it never clutters the first look.
    var ec = RG.eaglesCount();
    if (count >= 3 || ec > 0) {
      var eRow = document.createElement('div');
      eRow.style.cssText = 'margin-top:18px;font-size:11px;letter-spacing:1px;color:rgba(122,209,122,0.7);';
      eRow.textContent = (ec >= 9) ? '✦  every hole, under par  ✦' : ('under par   ' + ec + ' / 9');
      el.appendChild(eRow);
    }

    // Discoveries — hidden until the first secret is found, then it quietly appears here.
    if (found > 0) {
      var divider = document.createElement('div');
      divider.style.cssText = 'width:70%;max-width:360px;height:1px;background:rgba(178,77,255,0.2);margin:28px 0 22px;';
      el.appendChild(divider);

      var dTitle = document.createElement('div');
      dTitle.style.cssText = 'font-size:14px;letter-spacing:3px;color:#c98bff;margin-bottom:12px;';
      dTitle.textContent = 'DISCOVERIES';
      el.appendChild(dTitle);

      var SLOTS = flags.length + 2;                 // a couple beyond what exists -> "there's more"
      var row = '';
      for (var d = 0; d < SLOTS; d++) row += (d < found ? '◆ ' : '◇ ');
      var marks = document.createElement('div');
      marks.style.cssText = 'font-size:16px;color:rgba(178,77,255,0.7);letter-spacing:1px;margin-bottom:10px;';
      marks.textContent = row.trim();
      el.appendChild(marks);

      var dSub = document.createElement('div');
      dSub.style.cssText = 'font-size:11px;color:rgba(201,139,255,0.55);';
      dSub.textContent = found + ' found  ·  the sand keeps more  ·  press M to read the codex';
      el.appendChild(dSub);
    }

    var foot = document.createElement('div');
    foot.style.cssText = 'margin-top:30px;font-size:11px;color:rgba(242,236,255,0.3);';
    foot.textContent = 'press C or tap to close';
    el.appendChild(foot);

    el.addEventListener('click', close);
    document.body.appendChild(el);
  };

  window.addEventListener('keydown', function (e) {
    if (/INPUT|TEXTAREA/.test((e.target && e.target.tagName) || '')) return;
    if (e.key === 'c' || e.key === 'C') { RG.openCollection(); e.preventDefault(); }
    else if (e.key === 'Escape') close();
  });
})();
