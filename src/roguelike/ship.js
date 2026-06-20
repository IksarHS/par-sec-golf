// ── The Broken Ship ────────────────────────────────────────
// The frame of the larger game, discovered diegetically: a derelict lander sits just past
// the ninth cup on EARTH. It carries three runic part slots; each part is earned by golf —
// complete the nine / finish at-or-under par (clean, no drops) / hole-in-one — pure ACCESS
// progression, never power. When the ship is whole, coming to rest beside it launches the
// ascent (RG.launchToMoon, run.js). Loads after secrets.js; peel this file off and Earth
// is just a golf course again.
//
// Rides the RG_SECRETS lifecycle (place/update/draw/onClick/onRest) for in-play behaviour,
// but is deliberately NOT in RG_SECRET_FLAGS — the ship is the arc, not a Codex page.
(function () {
  if (!window.RG_SECRETS) return;

  const PARTS = 3;
  function flagKey(n) { return 'rg-ship-part-' + n; }
  function hasPart(n) { try { return localStorage.getItem(flagKey(n)) === '1'; } catch (e) { return false; } }
  function setPart(n) { try { localStorage.setItem(flagKey(n), '1'); } catch (e) {} }
  function partsCount() { let c = 0; for (let i = 1; i <= PARTS; i++) if (hasPart(i)) c++; return c; }

  // Repair is BOUGHT: each slot is a part with a price, paid from golf earnings
  // (economy.js). Money buys access — the ship never improves your putting.
  const PRICES = [25, 35, 45];

  // Public surface (wrap.js calls drawFlare; run.js reads complete()).
  window.RG_SHIP = {
    parts: PARTS,
    prices: PRICES,
    hasPart: hasPart,
    partsCount: partsCount,
    complete() { return partsCount() >= PARTS; },
    onEarth() { return !!(window.RG && RG.active && RG.course === 'earth-course' && !RG.inVault && !RG.inFault); },
    _flare: null,

    // Buy slot n (1-based) if unowned and affordable. Returns true on purchase.
    buy(n) {
      if (hasPart(n) || !window.RG_ECON) return false;
      if (!RG_ECON.spend(PRICES[n - 1])) return false;
      setPart(n);
      this._flare = { frames: 130, total: 130 };
      return true;
    },

    // The lander silhouette, shared with the shop view (shop.js draws the same glyph).
    drawGlyph(ctx, x, gy, s) { drawLanderGlyph(ctx, x, gy, s); },

    // A quiet gold acknowledgement on the recap: a small ship glyph + slot pips, no words.
    drawFlare(ctx) {
      const f = this._flare;
      if (!f || f.frames <= 0) return;
      f.frames--;
      const t = f.frames / f.total;                  // 1 -> 0
      const a = Math.sin(Math.min(1, (1 - t) * 4) * Math.PI / 2) * Math.min(1, t * 4); // fade in/out
      const cx = W / 2, y = H * 0.86;
      ctx.save();
      ctx.globalAlpha = Math.max(0, a) * 0.9;
      ctx.strokeStyle = '#f0c860'; ctx.fillStyle = '#f0c860'; ctx.lineWidth = 2; ctx.lineCap = 'round';
      drawLanderGlyph(ctx, cx - 34, y, 0.55);
      for (let i = 0; i < PARTS; i++) {              // slot pips: filled = earned
        const px = cx + i * 18;
        ctx.beginPath(); ctx.arc(px, y, 4.5, 0, Math.PI * 2);
        if (hasPart(i + 1)) ctx.fill(); else ctx.stroke();
      }
      ctx.restore();
    },
  };

  // The lander silhouette, drawn at (x, groundY) with scale s. Pure strokes — geometric
  // minimal, slightly listing (it's broken).
  function drawLanderGlyph(ctx, x, gy, s) {
    ctx.save();
    ctx.translate(x, gy);
    ctx.rotate(-0.06);                               // a tired lean
    ctx.scale(s, s);
    ctx.beginPath();                                 // legs
    ctx.moveTo(-16, 0); ctx.lineTo(-7, -14);
    ctx.moveTo(16, 0); ctx.lineTo(7, -14);
    ctx.moveTo(-20, 0); ctx.lineTo(-12, 0);
    ctx.moveTo(12, 0); ctx.lineTo(20, 0);
    ctx.stroke();
    ctx.beginPath();                                 // body
    ctx.moveTo(-12, -14); ctx.lineTo(12, -14); ctx.lineTo(9, -34); ctx.lineTo(-9, -34); ctx.closePath();
    ctx.stroke();
    ctx.beginPath();                                 // dome
    ctx.arc(0, -34, 9, Math.PI, 0);
    ctx.stroke();
    ctx.beginPath();                                 // antenna, bent
    ctx.moveTo(0, -43); ctx.lineTo(4, -52); ctx.lineTo(10, -54);
    ctx.stroke();
    ctx.restore();
  }

  RG_SECRETS.push({
    key: 'ship',
    name: 'The Ship',
    reset() { this.pos = null; this.panel = false; this._t = 0; },
    place(seed) {
      // STRIPPED FOR NOW: the buy-parts shop + ship-repair gate were underbaked, so the lander no
      // longer places past the 9th cup (no wreck, no shop, no repair). Travel is now automatic on the
      // final sink (wrap.js onTransitionEnd → RG._beginTravel). Restore the body below to bring the
      // ship/shop back. The rest of this file stays inert with pos=null.
      this.pos = null;
    },
    _near() {
      return this.pos && typeof ball !== 'undefined' && Math.abs(ball.x - this.pos.x) < 70;
    },
    onRest() {
      if (!this.pos) return false;
      if (this._near()) {
        if (RG_SHIP.complete() && window.RG && RG.launchToMoon) { RG.launchToMoon(); return true; }
        this.panel = true;                           // resting beside the wreck = inspecting it
      }
      return false;
    },
    _panelLayout() {
      const cx = W / 2, cy = H * 0.30;
      const slots = [];
      for (let i = 0; i < PARTS; i++) slots.push({ x: cx - 70 + i * 70, y: cy + 8 });
      return { cx: cx, cy: cy, w: 300, h: 110, slots: slots };
    },
    onClick(wx, wy, sx, sy) {
      if (!this.pos) return false;
      if (this.panel) {
        // A click on an empty slot buys it; anywhere else closes the panel.
        const L = this._panelLayout();
        for (let i = 0; i < PARTS; i++) {
          const s = L.slots[i], dx = sx - s.x, dy = sy - s.y;
          if (dx * dx + dy * dy < 24 * 24) {
            if (!hasPart(i + 1)) RG_SHIP.buy(i + 1);
            return true;
          }
        }
        this.panel = false;
        return true;
      }
      const px = RG_secretUtil.sx(this.pos.x), py = RG_secretUtil.sy(this.pos.y);
      if (sx > px - 34 && sx < px + 34 && sy > py - 70 && sy < py + 6) { this.panel = true; return true; }
      return false;
    },
    update() { this._t++; },
    draw(ctx) {
      if (!this.pos) return;
      const sx = RG_secretUtil.sx(this.pos.x), sy = RG_secretUtil.sy(this.pos.y);
      if (sx < -120 || sx > W + 120) return;
      const whole = RG_SHIP.complete();
      ctx.save();
      ctx.strokeStyle = '#aab4c8'; ctx.lineWidth = 2; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.globalAlpha = 0.9;
      drawLanderGlyph(ctx, sx, sy, 1);
      // status light: a slow red blink while broken; a calm green breath when whole
      const ph = 0.5 + 0.5 * Math.sin(this._t * (whole ? 0.04 : 0.09));
      ctx.globalAlpha = whole ? 0.35 + 0.45 * ph : (ph > 0.72 ? 0.85 : 0.12);
      ctx.fillStyle = whole ? '#7ad17a' : '#e86060';
      ctx.beginPath(); ctx.arc(sx + 6, sy - 40, 2.6, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      if (this.panel) this._drawPanel(ctx);
    },
    // The part slots: three circles on a dark plate. Owned slot = solid gold; empty slot =
    // an outline with its PRICE — gold when you can afford it, dim when you can't. The
    // wallet sits in the plate's corner. Click a priced slot to buy it.
    _drawPanel(ctx) {
      const L = this._panelLayout();
      const money = window.RG_ECON ? RG_ECON.money() : 0;
      ctx.save();
      ctx.globalAlpha = 0.92; ctx.fillStyle = 'rgba(14,11,18,0.92)';
      ctx.strokeStyle = 'rgba(240,200,96,0.45)'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.roundRect(L.cx - L.w / 2, L.cy - L.h / 2, L.w, L.h, 12); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = '#f0c860'; ctx.fillStyle = '#f0c860'; ctx.lineWidth = 2;
      drawLanderGlyph(ctx, L.cx - L.w / 2 + 30, L.cy - L.h / 2 + 38, 0.45);
      ctx.textAlign = 'center';
      for (let i = 0; i < PARTS; i++) {
        const s = L.slots[i];
        const got = hasPart(i + 1);
        const afford = money >= PRICES[i];
        ctx.globalAlpha = got ? 0.95 : (afford ? 0.8 : 0.35);
        ctx.beginPath(); ctx.arc(s.x, s.y, 17, 0, Math.PI * 2);
        if (got) { ctx.fill(); }
        else {
          ctx.stroke();
          ctx.font = "11px 'Departure Mono', monospace";
          ctx.fillText('$' + PRICES[i], s.x, s.y + 4);
        }
      }
      ctx.globalAlpha = 0.7;
      ctx.font = "12px 'Departure Mono', monospace";
      ctx.textAlign = 'right';
      ctx.fillText('$' + money, L.cx + L.w / 2 - 12, L.cy + L.h / 2 - 10);
      ctx.restore();
    },
  });

  // NOTE: there is intentionally NO default-visible "Launch to the Moon" button. Launching is
  // diegetic (repair the ship, golf out, and come to rest beside the whole wreck → RG.launchToMoon
  // fires from the secret's onRest above). For TESTING, launch is reachable via the dev cheat panel
  // (lab.js, behind ?dev) and the ?goto=launch deep-link (testjump.js) — both call RG.launchToMoon
  // directly. The old always-on gold DOM button + its recap twin were removed (designer call: the
  // moon launch was a debug affordance, not a default-game UI control).
})();
