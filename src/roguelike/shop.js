// ── The Shop ───────────────────────────────────────────────
// The storefront behind the recap: a "◈ Shop" button on the run-complete screen (wrap.js)
// opens this full-screen view. It SHOWCASES what money buys — never putting power:
//
//   THE SHIP    the three runic parts ($25/$35/$45) — the same slots as the wreck's own
//               panel (ship.js owns the purchase; this is a second door to it).
//
// (The buyable "caddy" auto-golfer was removed — autoplay is a dev playtest tool, not a
//  default-game product. The dev bot still lives in playtest-bot.js: the 'A' key / the cheat
//  panel toggle / RG.bot. With no caddy setting RG_BOT_STEPS, the bot falls back to its
//  full-depth search — see playtest-bot.js.)
//
// Wallet and spending go through RG_ECON. Peel this file off and the recap loses its
// Shop button (wrap.js guards every call) — nothing else changes.
(function () {
  let open = false;
  let btns = [];     // rebuilt every draw: { x, y, w, h, action }
  let t = 0;         // frames since opened (fade-in)

  // One card: plate + glyph + a row of three slot circles. Filled = owned; the next
  // buyable slot shows its price (gold when affordable, dim when not); later slots are
  // faint outlines. `linear` = slots must be bought in order (the caddy); ship slots
  // are independent. Returns the next free y.
  function drawCard(ctx, cx, y, money, card) {
    const w = 360, h = 96, x0 = cx - w / 2;
    ctx.save();
    ctx.globalAlpha = 0.92;
    ctx.fillStyle = 'rgba(14,11,18,0.92)';
    ctx.strokeStyle = 'rgba(240,200,96,0.45)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.roundRect(x0, y, w, h, 12); ctx.fill(); ctx.stroke();

    ctx.strokeStyle = '#f0c860'; ctx.fillStyle = '#f0c860'; ctx.lineWidth = 2; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    card.glyph(ctx, x0 + 52, y + h / 2 + 26, 0.78);
    ctx.globalAlpha = 0.45;
    ctx.font = "10px 'Departure Mono', monospace";
    ctx.textAlign = 'center';
    ctx.fillText(card.label, x0 + 52, y + h - 10);

    const n = card.count;
    for (let i = 0; i < n; i++) {
      const sx = x0 + 150 + i * 76, sy = y + h / 2;
      const got = card.owned(i);
      const buyable = card.buyable(i);
      const afford = money >= card.price(i);
      ctx.globalAlpha = got ? 0.95 : (buyable ? (afford ? 0.8 : 0.35) : 0.16);
      ctx.beginPath(); ctx.arc(sx, sy, 17, 0, Math.PI * 2);
      if (got) ctx.fill();
      else {
        ctx.stroke();
        ctx.font = "11px 'Departure Mono', monospace";
        ctx.fillText('$' + card.price(i), sx, sy + 4);
      }
      if (!got && buyable) btns.push({ x: sx - 22, y: sy - 22, w: 44, h: 44, action: card.action, slot: i });
    }
    ctx.restore();
    return y + h;
  }

  window.RG_SHOP = {
    isOpen() { return open; },
    open() { open = true; t = 0; },
    close() { open = false; },

    // Drawn by wrap.drawRunComplete while open (so it lives over the frozen course).
    draw(ctx) {
      btns = [];
      t++;
      const fade = Math.min(1, t / 18);
      const cx = W / 2;
      ctx.save();
      ctx.globalAlpha = 0.88 * fade;
      ctx.fillStyle = '#0c0912';
      ctx.fillRect(0, 0, W, H);
      ctx.globalAlpha = fade;

      const money = window.RG_ECON ? RG_ECON.money() : 0;
      ctx.textAlign = 'center';
      ctx.font = "22px 'Departure Mono', monospace";
      ctx.fillStyle = 'rgba(240,200,96,0.95)';
      ctx.fillText('◈ SHOP', cx, H * 0.13);
      ctx.font = "14px 'Departure Mono', monospace";
      ctx.fillStyle = 'rgba(242,236,255,0.6)';
      ctx.fillText('$' + money, cx, H * 0.13 + 26);

      let y = H * 0.22;
      if (window.RG_SHIP) {
        y = drawCard(ctx, cx, y, money, {
          label: 'the ship', glyph: (c, x, gy, s) => RG_SHIP.drawGlyph(c, x, gy, s),
          count: RG_SHIP.parts, action: 'ship',
          owned: (i) => RG_SHIP.hasPart(i + 1),
          buyable: (i) => !RG_SHIP.hasPart(i + 1),
          price: (i) => RG_SHIP.prices[i],
        });
        y += 22;
      }

      // back to the recap
      const bw = 200, bh = 34, bx = cx - bw / 2, by = Math.min(H - 56, y + 30);
      ctx.beginPath(); ctx.roundRect(bx, by, bw, bh, 8);
      ctx.fillStyle = 'rgba(255,255,255,' + (0.12 * fade) + ')'; ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,' + (0.3 * fade) + ')'; ctx.lineWidth = 1; ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,' + (0.85 * fade) + ')';
      ctx.font = "14px 'Departure Mono', monospace";
      ctx.fillText('← Back', cx, by + 23);
      btns.push({ x: bx, y: by, w: bw, h: bh, action: 'back' });

      ctx.restore();
      ctx.textAlign = 'left';
    },

    // Clicks are routed here by wrap.js while open.
    onClick(mx, my) {
      for (let i = 0; i < btns.length; i++) {
        const b = btns[i];
        if (mx < b.x || mx > b.x + b.w || my < b.y || my > b.y + b.h) continue;
        if (b.action === 'back') { this.close(); return true; }
        if (b.action === 'ship' && window.RG_SHIP) { RG_SHIP.buy(b.slot + 1); return true; }
        return true;
      }
      return false;
    },
  };

  // (The in-play "⛳ caddy" button and its purchasable levels were removed — autoplay is a dev
  //  playtest tool, not a default-game affordance. The dev bot is reached via the 'A' key, the
  //  dev cheat panel toggle, or RG.bot — see playtest-bot.js.)
})();
