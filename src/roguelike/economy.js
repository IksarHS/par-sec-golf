// ── The Economy ────────────────────────────────────────────
// Money is earned by golf and spent on ACCESS (ship parts, travel — never putting power).
// Every surface course has nine hole SLOTS (terrain is seeded fresh each run; identity
// lives in the slot: earth hole 3, moon hole 7). Each slot remembers your BEST TIER:
//
//   tier 1  completed        $5     (cumulative totals —
//   tier 2  at par           $10     improving a slot's best
//   tier 3  under par        $15     tier later pays the
//   tier 4  hole-in-one      $25     difference)
//
// A completed hole that doesn't improve its slot pays $1. So new worlds and new bests pay
// real money; grinding pays pocket change — playing WELL is how you upgrade faster.
// Settled once per run on the recap (wrap.js calls settleRun); the tally drawn there.
// Peel this file off and the game is scoreless golf again.
(function () {
  function num(key) { try { const v = parseInt(localStorage.getItem(key), 10); return Number.isFinite(v) ? v : 0; } catch (e) { return 0; } }
  function put(key, v) { try { localStorage.setItem(key, String(v)); } catch (e) {} }
  function slotKey(course, i) { return 'rg-tier-' + course + '-' + i; }

  window.RG_ECON = {
    // (Removed 2026-06-29: money()/add()/spend() — PC adventure has no money. The per-slot TIER store
    //  below stays: it's the "collection" the scorecard/constellation/journey art reads.)
    tier(course, i) { return num(slotKey(course, i)); },

    _lastTally: null,   // { rows: [{hole, pay, tier, improved}], total, wallet } for the recap

    // Grade one completed hole against its slot, recording the BEST TIER per slot. This tier store
    // (rg-tier-*) is what the scorecard / constellation / journey "collection" art reads. Money was
    // removed (PC = adventure, not roguelike) — this now only persists the tier; no payout.
    _settleHole(course, i, strokes, par) {
      let t = 1;
      if (strokes === 1) t = 4;
      else if (strokes < par) t = 3;
      else if (strokes === par) t = 2;
      const best = this.tier(course, i);
      const improved = t > best;
      if (improved) put(slotKey(course, i), t);
      return { tier: t, improved: improved };
    },

    // Called once per completed run (wrap.onTransitionEnd). Surface courses only. Records each
    // hole's best tier (feeds the collection art); no money is earned (PC adventure).
    settleRun() {
      this._lastTally = null;
      if (!(window.RG && RG.active) || RG.inVault || RG.inFault) return;
      const course = RG.course;
      const rows = [];
      for (let i = 0; i < RG.holeCount; i++) {
        const s = RG.holeScores ? RG.holeScores[i] : null;
        if (s == null) { rows.push(null); continue; }
        const par = (RG.holePars && RG.holePars[i]) || 3;
        rows.push(this._settleHole(course, i, s, par));
      }
      this._lastTally = { rows: rows };
    },

    // (Removed 2026-06-29: drawTally — the recap MONEY block, +$ take, earning ladder. PC adventure
    //  has no money. The tier store it read still drives the scorecard/constellation/journey below.)
    TIER_COLORS: ['#8a93a8', '#8a93a8', '#caa64e', '#f0c860', '#ffd87a'],   // by tier 0..4 (scorecard pip colours)

    // ── The Scorecard: a quiet collection of every hole you've ever aced ───────
    // Per-slot best tier already persists (the rg-tier keys); tier 4 == ace. This renders
    // those facts as a calm grid — one row per surface world, one cell per hole slot. A
    // filled gold dot is an ace you hold; a hollow dot is a hole you've played but not yet
    // aced; an empty slot you've never finished. No prose: the grid IS the sentence.
    // Worlds appear only once you've SET FOOT there (any slot tiered) — the card grows with
    // the journey rather than spoiling worlds ahead. Pure read of localStorage; peel-off-able.
    SURFACE_COURSES: [
      { id: 'earth-course', label: 'EARTH', holes: 9 },
      { id: 'run-course', label: 'MARS', holes: 9 },
      { id: 'moon', label: 'MOON', holes: 9 },
    ],
    // Which worlds the player has touched (any slot graded). Keeps the card from naming
    // places not yet reached. Always includes the world just played so its row is present.
    _scorecardRows() {
      const cur = (window.RG && RG.course) || null;
      const out = [];
      for (const c of this.SURFACE_COURSES) {
        let touched = (c.id === cur);
        const tiers = [];
        for (let i = 0; i < c.holes; i++) { const t = this.tier(c.id, i); tiers.push(t); if (t > 0) touched = true; }
        if (touched) out.push({ label: c.label, tiers: tiers, isCurrent: c.id === cur });
      }
      return out;
    },
    // Total aces held across all surface worlds (for the quiet "n / N aces" line).
    _aceCounts() {
      let have = 0, total = 0;
      for (const c of this.SURFACE_COURSES) {
        for (let i = 0; i < c.holes; i++) { total += 1; if (this.tier(c.id, i) >= 4) have += 1; }
      }
      return { have: have, total: total };
    },
    // Draw the scorecard grid CENTRED on cx, starting at y. `style`:
    //   'grid'  — labelled rows of dots (default)
    //   'stars' — aces as small twinkling stars on a dark band (constellation idiom)
    // The dot block is centred under cx; the world labels hang LEFT into the margin (so the
    // collection sits symmetric under the take, never lopsided against the live flag). All three
    // cell states stay legible — ace (filled gold) / played (cool ring) / unplayed (faint pip) —
    // so the card always SHOWS its own headroom. Returns the next y below the card.
    ACE_COLOR: '#ffd87a',
    drawScorecard(ctx, cx, y, fade, style) {
      const rows = this._scorecardRows();
      if (!rows.length) return y;
      style = style || 'grid';
      ctx.save();
      const maxHoles = rows.reduce((m, r) => Math.max(m, r.tiers.length), 0);
      const cell = 15, dot = 4.2;
      const gridW = (maxHoles - 1) * cell;                 // span between first and last dot centres
      const x0 = cx - gridW / 2;                           // first dot centre — block centred on cx

      // a faint title for the collection (small, never shouting)
      const counts = this._aceCounts();
      ctx.textAlign = 'center';
      ctx.font = "10px 'Departure Mono', monospace";
      ctx.globalAlpha = 1; ctx.fillStyle = 'rgba(242,236,255,' + (fade * 0.4) + ')';
      ctx.fillText(counts.have + ' / ' + counts.total + ' aces', cx, y);
      y += 16;

      for (let r = 0; r < rows.length; r++) {
        const row = rows[r];
        const ry = y + r * (style === 'stars' ? 17 : 18);
        // row label hangs LEFT of the centred dot block, dim; world just played a touch brighter
        ctx.textAlign = 'right';
        ctx.font = "10px 'Departure Mono', monospace";
        ctx.globalAlpha = 1;
        ctx.fillStyle = 'rgba(242,236,255,' + (fade * (row.isCurrent ? 0.62 : 0.34)) + ')';
        ctx.fillText(row.label, x0 - cell * 0.9, ry + 3.5);
        // the dots
        for (let i = 0; i < row.tiers.length; i++) {
          const t = row.tiers[i];
          const dx = x0 + i * cell;
          ctx.beginPath();
          if (style === 'stars') {
            if (t >= 4) {                                   // an ace: a small star-point + halo
              const tw = 0.78 + 0.22 * Math.sin((completeTimer || 0) * 0.04 + (r * 9 + i) * 1.3);
              ctx.globalAlpha = fade * 0.92 * tw;
              ctx.fillStyle = this.ACE_COLOR;
              ctx.arc(dx, ry, 2.4, 0, Math.PI * 2); ctx.fill();
              ctx.globalAlpha = fade * 0.32 * tw;           // a soft halo
              ctx.beginPath(); ctx.arc(dx, ry, 4.6, 0, Math.PI * 2); ctx.fill();
            } else if (t > 0) {                             // played, not aced: a faint COOL ring (headroom shows)
              ctx.globalAlpha = fade * 0.3; ctx.strokeStyle = '#6f86c8'; ctx.lineWidth = 1;
              ctx.arc(dx, ry, 2.1, 0, Math.PI * 2); ctx.stroke();
            } else {                                        // never finished: a very faint pip
              ctx.globalAlpha = fade * 0.1;
              ctx.fillStyle = '#cdd6f5';
              ctx.arc(dx, ry, 1.2, 0, Math.PI * 2); ctx.fill();
            }
          } else {                                          // 'grid'
            if (t >= 4) {                                   // ace: filled gold dot
              ctx.globalAlpha = fade * 0.95; ctx.fillStyle = this.ACE_COLOR;
              ctx.arc(dx, ry, dot, 0, Math.PI * 2); ctx.fill();
            } else if (t > 0) {                             // played, not aced: hollow ring
              ctx.globalAlpha = fade * 0.5; ctx.strokeStyle = '#8a93a8'; ctx.lineWidth = 1.2;
              ctx.arc(dx, ry, dot - 0.6, 0, Math.PI * 2); ctx.stroke();
            } else {                                        // never finished: a bare pip
              ctx.globalAlpha = fade * 0.16; ctx.fillStyle = '#cdd6f5';
              ctx.arc(dx, ry, 1.4, 0, Math.PI * 2); ctx.fill();
            }
          }
        }
      }
      ctx.globalAlpha = 1;
      ctx.textAlign = 'center';
      ctx.restore();
      return y + rows.length * (style === 'stars' ? 17 : 18) + 6;
    },

    // ── The Clubhouse Card: the run as a single quiet PAPER scorecard in the dark ──────
    // A self-contained framed artifact (echoes the trailer's cs_parsec_scorecard frame): a
    // faint cream card floating in the night, nine hole-boxes for THIS run with the strokes,
    // the take penciled in the margin, and the all-aces collection as small gold marks down
    // the side. The ONE place a warmer paper tone is licensed. It draws the whole recap body
    // (title, score, take, collection) so the wrap layout just centres it. Returns next y.
    // Stays a glanceable artifact — boxes + gold dots, never a spreadsheet (near-zero-text law).
    PAPER: 'rgba(232,224,205,',          // cream — only here
    INK: 'rgba(40,34,28,',               // deadpan pencil ink on the card
    drawCardClubhouse(ctx, cx, top, fade) {
      const t = this._lastTally;
      const scores = (window.RG && RG.holeScores) || [];
      const pars = (window.RG && RG.holePars) || [];
      const n = (window.RG && RG.holeCount) || 9;
      ctx.save();
      ctx.textAlign = 'center';
      // card geometry: nine boxes in a row, sized to a calm width
      const box = 30, pad = 22, cardW = Math.min(n * box + pad * 2, 420), bw = (cardW - pad * 2) / n;
      const cardX = cx - cardW / 2, cardH = 210, cardY = top - 10;
      // the paper — a soft cream rectangle with a faint border; floats (subtle shadow)
      ctx.globalAlpha = fade;
      ctx.fillStyle = 'rgba(0,0,0,0.28)';
      ctx.beginPath(); ctx.roundRect(cardX + 4, cardY + 6, cardW, cardH, 6); ctx.fill();   // drop shadow
      ctx.fillStyle = this.PAPER + fade + ')';
      ctx.beginPath(); ctx.roundRect(cardX, cardY, cardW, cardH, 6); ctx.fill();
      ctx.strokeStyle = this.INK + (fade * 0.28) + ')'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.roundRect(cardX, cardY, cardW, cardH, 6); ctx.stroke();

      // header row: a small deadpan title + the run's vs-par, in ink
      const d = (window.RG ? RG.finalStrokes - RG.runPar : 0);
      ctx.fillStyle = this.INK + (fade * 0.7) + ')';
      ctx.font = "11px 'Departure Mono', monospace";
      ctx.textAlign = 'left';
      ctx.fillText('SCORECARD', cardX + pad, cardY + 22);
      ctx.textAlign = 'right';
      ctx.fillStyle = (d <= 0 ? 'rgba(60,120,60,' : this.INK) + fade + ')';
      ctx.font = "15px 'Departure Mono', monospace";
      ctx.fillText((window.RG ? RG.vsParStr(RG.finalStrokes, RG.runPar) : ''), cardX + cardW - pad, cardY + 24);

      // the nine hole boxes — strokes penciled in; an ace box gets a gold corner mark
      const rowY = cardY + 40, rowH = 40;
      ctx.textAlign = 'center';
      for (let i = 0; i < n; i++) {
        const bx = cardX + pad + i * bw;
        ctx.strokeStyle = this.INK + (fade * 0.22) + ')'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.roundRect(bx, rowY, bw - 3, rowH, 2); ctx.stroke();
        const s = scores[i];
        const par = pars[i] || 3;
        if (s != null) {
          if (s === 1) {                                   // a hole-in-one this run — a gold corner tick
            ctx.fillStyle = this.ACE_COLOR; ctx.globalAlpha = fade;
            ctx.beginPath(); ctx.moveTo(bx + bw - 3, rowY); ctx.lineTo(bx + bw - 9, rowY); ctx.lineTo(bx + bw - 3, rowY + 6); ctx.closePath(); ctx.fill();
            ctx.globalAlpha = fade;
          }
          ctx.fillStyle = (s < par ? 'rgba(60,120,60,' : this.INK) + fade + ')';
          ctx.font = "15px 'Departure Mono', monospace";
          ctx.fillText(String(s), bx + (bw - 3) / 2, rowY + 26);
        } else {                                           // unplayed (a busted run) — a faint dash
          ctx.fillStyle = this.INK + (fade * 0.25) + ')';
          ctx.font = "12px 'Departure Mono', monospace";
          ctx.fillText('·', bx + (bw - 3) / 2, rowY + 26);
        }
      }

      // a faint hairline rule under the boxes — the margin line (evokes paper without text)
      const ruleY = rowY + rowH + 16;
      ctx.strokeStyle = this.INK + (fade * 0.18) + ')'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(cardX + pad, ruleY); ctx.lineTo(cardX + cardW - pad, ruleY); ctx.stroke();
      // the all-aces collection count in the right margin (the long arc, in ink)
      const counts = this._aceCounts();
      ctx.textAlign = 'right';
      ctx.fillStyle = this.INK + (fade * 0.5) + ')';
      ctx.fillText(counts.have + ' / ' + counts.total + ' aces', cardX + cardW - pad, ruleY + 20);

      // the collection itself, as a compact grid of small gold ace-marks INSIDE the card's
      // lower band — self-contained, so nothing spills onto the live terrain. One short row per
      // surface world touched; an ace is a gold dot, a played hole a faint ink ring, unplayed a
      // ghost speck (the three-state read on paper). Centred under the boxes.
      const cRows = this._scorecardRows();
      const cCell = 12, cDot = 3;
      const cMaxH = cRows.reduce((m, r) => Math.max(m, r.tiers.length), 0);
      const cGridW = (cMaxH - 1) * cCell;
      const cx0 = cx - cGridW / 2 + 14;                    // small right-nudge to clear the hanging label
      let collY = ruleY + 40;
      for (let r = 0; r < cRows.length; r++) {
        const row = cRows[r];
        const ry = collY + r * 13;
        ctx.textAlign = 'right'; ctx.font = "8px 'Departure Mono', monospace";
        ctx.fillStyle = this.INK + (fade * (row.isCurrent ? 0.6 : 0.38)) + ')';
        ctx.fillText(row.label, cx0 - cCell * 0.8, ry + 3);
        for (let i = 0; i < row.tiers.length; i++) {
          const dx = cx0 + i * cCell, tt = row.tiers[i];
          ctx.beginPath();
          if (tt >= 4) { ctx.globalAlpha = fade; ctx.fillStyle = this.ACE_COLOR; ctx.arc(dx, ry, cDot, 0, Math.PI * 2); ctx.fill(); }
          else if (tt > 0) { ctx.globalAlpha = fade * 0.45; ctx.strokeStyle = this.INK + '1)'; ctx.lineWidth = 1; ctx.arc(dx, ry, cDot - 0.6, 0, Math.PI * 2); ctx.stroke(); }
          else { ctx.globalAlpha = fade * 0.2; ctx.fillStyle = this.INK + '1)'; ctx.arc(dx, ry, 1, 0, Math.PI * 2); ctx.fill(); }
          ctx.globalAlpha = 1;
        }
      }

      ctx.globalAlpha = 1;
      ctx.textAlign = 'center';
      ctx.restore();
      return cardY + cardH;
    },

    // ── The Constellation: aces as real stars woven into the upper NIGHT SKY ──────────
    // Not a grid pinned to the column (the old miss) — these scatter across the actual dark
    // sky band ABOVE the recap header, irregularly, so they read as a constellation, not a
    // lattice. Row -> a loose vertical band (EARTH highest, deeper worlds lower), hole -> a
    // loose horizontal sweep; both jittered by a pure index hash (NOT the terrain PRNG) so the
    // scatter is deterministic + stable. Keeps the three-state read so headroom still shows:
    // ace = a gold twinkling star + halo; played-not-aced = a faint COOL point; unplayed = a
    // near-invisible speck. No axis labels — the sky doesn't need them (the near-zero-text payoff).
    // Drawn behind/above the header; returns nothing (the header lays out independently below).
    drawConstellationSky(ctx, fade) {
      const rows = this._scorecardRows();
      if (!rows.length) return;
      ctx.save();
      const nW = rows.length;
      // the star band lives in the dark ABOVE the title (title sits at ~H*0.22) so the
      // constellation never competes with the header text below it.
      const bandTop = H * 0.03, bandH = H * 0.155;
      const left = W * 0.16, span = W * 0.68;
      for (let w = 0; w < nW; w++) {
        const row = rows[w];
        const near = row.isCurrent ? 1 : 0.82;
        for (let i = 0; i < row.tiers.length; i++) {
          // pure index hash -> stable jitter (cosmetic; never the terrain PRNG)
          let h = ((w + 1) * 0x9e3779b1 ^ (i + 1) * 0x85ebca77) >>> 0;
          h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d) >>> 0;
          const jx = ((h & 0xff) / 255 - 0.5) * (span / row.tiers.length) * 1.3;
          const jy = (((h >>> 8) & 0xff) / 255 - 0.5) * (bandH / nW) * 0.9;
          const px = left + (i + 0.5) * (span / row.tiers.length) + jx;
          const py = bandTop + (w + 0.5) * (bandH / nW) + jy;
          const t = row.tiers[i];
          ctx.beginPath();
          if (t >= 4) {                                    // ace: a steady gold star + soft halo
            const tw = 0.78 + 0.22 * Math.sin((completeTimer || 0) * 0.035 + (w * 9 + i) * 1.3);
            ctx.globalAlpha = fade * 0.95 * tw * near;
            ctx.fillStyle = this.ACE_COLOR;
            ctx.arc(px, py, 2.6, 0, Math.PI * 2); ctx.fill();
            ctx.globalAlpha = fade * 0.3 * tw * near;
            ctx.beginPath(); ctx.arc(px, py, 5.2, 0, Math.PI * 2); ctx.fill();
          } else if (t > 0) {                              // played, not aced: a faint cool point (headroom)
            ctx.globalAlpha = fade * 0.26 * near; ctx.fillStyle = '#7e95d6';
            ctx.arc(px, py, 1.5, 0, Math.PI * 2); ctx.fill();
          } else {                                         // unreached: a near-invisible speck
            ctx.globalAlpha = fade * 0.08; ctx.fillStyle = '#cdd6f5';
            ctx.arc(px, py, 1, 0, Math.PI * 2); ctx.fill();
          }
        }
      }
      // No count text here — the constellation IS the sentence (near-zero-text payoff). The
      // header's vs-par + take sit cleanly below the star band; the stars never compete with them.
      ctx.restore();
    },

    // ── The Journey track: the collection as a single left-to-right path of worlds ────
    // Mirrors the game's own traverse — EARTH · MARS · MOON receding into the dark like the
    // next island you'll golf to. Each world is a small cluster of its 9 ace-dots over a
    // dim world-disc; the world just played glows nearest/brightest, unreached ones trail
    // dimmer toward the horizon. A wordless map of the trip that doubles as a "one more"
    // pull. Scales as SURFACE_COURSES grows — new worlds simply appear further down the path.
    // Returns next y. (The ledger header is drawn above this by the wrap layout.)
    drawJourney(ctx, cx, y, fade) {
      const rows = this._scorecardRows();
      if (!rows.length) return y;
      ctx.save();
      // lay the worlds along a path centred on cx; nearest (current) brightest. No count line —
      // the labelled worlds ARE the sentence (near-zero-text). `y` is the path's vertical centre.
      const nW = rows.length;
      const slotW = Math.min(170, (Math.min(W - 120, 520)) / Math.max(nW, 1));
      const totalW = slotW * (nW - 1);
      const x0 = cx - totalW / 2;
      const pathY = y;
      // the connecting path — a faint dotted line receding (the route between islands)
      ctx.globalAlpha = fade * 0.22; ctx.strokeStyle = '#6f86c8'; ctx.lineWidth = 1;
      ctx.setLineDash([2, 5]);
      ctx.beginPath(); ctx.moveTo(x0, pathY); ctx.lineTo(x0 + totalW, pathY); ctx.stroke();
      ctx.setLineDash([]);

      for (let w = 0; w < nW; w++) {
        const row = rows[w];
        const wx = x0 + w * slotW;
        const near = row.isCurrent ? 1 : 0.62;              // the world just played reads nearest
        // a dim world-disc
        ctx.globalAlpha = fade * 0.5 * near;
        ctx.fillStyle = row.isCurrent ? '#3a4a6e' : '#2a3350';
        ctx.beginPath(); ctx.arc(wx, pathY, row.isCurrent ? 13 : 10, 0, Math.PI * 2); ctx.fill();
        // its 9 ace-dots scattered in a small cluster ABOVE the disc (deterministic, index-hashed)
        const aces = [];
        for (let i = 0; i < row.tiers.length; i++) if (row.tiers[i] >= 4) aces.push(i);
        for (let i = 0; i < row.tiers.length; i++) {
          // deterministic scatter from a pure index hash (NOT the terrain PRNG) — cosmetic + stable
          let h = ((w + 1) * 0x9e3779b1 ^ (i + 1) * 0x85ebca77) >>> 0;
          h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d) >>> 0;
          const ox = ((h & 0xff) / 255 - 0.5) * (slotW * 0.62);
          const oy = (((h >>> 8) & 0xff) / 255) * 26 + 6;
          const px = wx + ox, py = pathY - oy;
          const t = row.tiers[i];
          ctx.beginPath();
          if (t >= 4) {                                     // ace: a steady gold star
            const tw = 0.8 + 0.2 * Math.sin((completeTimer || 0) * 0.04 + (w * 9 + i) * 1.4);
            ctx.globalAlpha = fade * 0.92 * tw * near;
            ctx.fillStyle = this.ACE_COLOR;
            ctx.arc(px, py, 2.2, 0, Math.PI * 2); ctx.fill();
            ctx.globalAlpha = fade * 0.28 * tw * near;
            ctx.beginPath(); ctx.arc(px, py, 4.2, 0, Math.PI * 2); ctx.fill();
          } else if (t > 0) {                               // played, not aced: a cool faint ring (headroom)
            ctx.globalAlpha = fade * 0.28 * near; ctx.strokeStyle = '#6f86c8'; ctx.lineWidth = 1;
            ctx.arc(px, py, 1.9, 0, Math.PI * 2); ctx.stroke();
          } else {                                          // unreached on this world: a near-invisible pip
            ctx.globalAlpha = fade * 0.1 * near; ctx.fillStyle = '#cdd6f5';
            ctx.arc(px, py, 1.1, 0, Math.PI * 2); ctx.fill();
          }
        }
        // the world label below the disc, dim; current world brighter
        ctx.globalAlpha = 1;
        ctx.fillStyle = 'rgba(242,236,255,' + (fade * (row.isCurrent ? 0.6 : 0.3)) + ')';
        ctx.font = "10px 'Departure Mono', monospace";
        ctx.fillText(row.label, wx, pathY + 26);
      }
      ctx.globalAlpha = 1;
      ctx.textAlign = 'center';
      ctx.restore();
      return pathY + 40;
    },

    // (Removed 2026-06-29: drawTakeLine — the +$ money take. PC adventure has no money. wrap.js
    //  guards its call with `if (RG_ECON.drawTakeLine)`, so its absence just drops the money line.)
  };
})();
