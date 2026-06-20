// ── Roguelike Modifiers ────────────────────────────────────
// Opt-in, stackable, LAWFUL escalation. Each modifier adds a new readable rule
// that changes the DECISION on a shot — never just inflates a number. The
// controller (src/roguelike/run.js) resets every run-influenced global to pristine
// before each run, so apply()/course() only MUTATE — no manual restore needed.
//
// Descriptor: { key, name, icon, blurb, course?(course), apply?(), draw?(ctx) }
//   course(course): reshape the run-course (materials / archetypes) before generation.
//   apply():        mutate live physics globals (GRAVITY / MATERIALS / RG.wind).
//   draw(ctx):      per-frame screen-space overlay during play (e.g. a wind arrow).

const RG_MODIFIERS = [
  {
    key: 'wind',
    name: 'Thin Air',
    icon: '→',
    blurb: 'A steady crosswind. Aim off the pin and ride it.',
    apply() { RG.wind = 0.010; }, // constant rightward push, read by the gameplay hook
    draw(ctx) {
      const cx = W / 2, y = 58, len = 48;
      ctx.save();
      ctx.globalAlpha = 0.85;
      ctx.strokeStyle = '#9fd2ff';
      ctx.fillStyle = '#9fd2ff';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(cx - len / 2, y); ctx.lineTo(cx + len / 2, y); ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx + len / 2, y);
      ctx.lineTo(cx + len / 2 - 9, y - 5);
      ctx.lineTo(cx + len / 2 - 9, y + 5);
      ctx.closePath(); ctx.fill();
      ctx.globalAlpha = 0.55;
      ctx.font = "10px 'Departure Mono', monospace";
      ctx.textAlign = 'center';
      ctx.fillText('WIND', cx, y - 11);
      ctx.restore();
    },
  },
  {
    key: 'lowgrav',
    name: 'Phobos Pull',
    icon: '↓',
    blurb: 'Lighter gravity. The ball floats — recalibrate every shot.',
    apply() { if (typeof GRAVITY !== 'undefined') GRAVITY = GRAVITY * 0.55; },
  },
  {
    key: 'slick',
    name: 'Black Ice',
    icon: '❄',
    blurb: 'Slick ground. The ball carries — brake on terrain, not at the cup.',
    course(course) { course.materials = ['ice', 'ice', 'ice', 'sand'].concat(course.materials || []); },
    apply() {
      if (typeof MATERIALS === 'undefined') return;
      for (const k in MATERIALS) {
        const m = MATERIALS[k];
        m.rollingFriction = Math.min(0.999, m.rollingFriction + (1 - m.rollingFriction) * 0.5);
        m.surfaceFriction = m.surfaceFriction * 0.4;
      }
    },
  },
  {
    key: 'hotrock',
    name: 'Hot Rock',
    icon: '◆',
    blurb: 'Live bounce. Plan your landing, not just your power.',
    course(course) { course.materials = ['rock', 'rock', 'sand'].concat(course.materials || []); },
    apply() {
      if (typeof MATERIALS === 'undefined') return;
      for (const k in MATERIALS) {
        const m = MATERIALS[k];
        m.restitution = Math.min(0.92, m.restitution * 1.35);
      }
    },
  },
  {
    key: 'perched',
    name: 'Perched Pins',
    icon: '▲',
    blurb: 'Cups on ledges. Approach angle beats raw distance.',
    course(course) {
      course.archetypes = ['shelf', 'mesa', 'cliff_drop', 'stepped_descent', 'dramatic_ridge', 'cliff_valley_climb', 'shelf_drop_shelf'];
    },
  },
  {
    key: 'sticky',
    name: 'Mudflats',
    icon: '▦',
    blurb: 'Dead ground. The ball checks up fast — fly it to the pin, no run-out.',
    apply() {
      if (typeof MATERIALS === 'undefined') return;
      for (const k in MATERIALS) {
        const m = MATERIALS[k];
        // grabbier roll + a much stronger constant stop: the ball won't run out, so
        // you must carry to the target instead of bump-and-running it up.
        m.rollingFriction = Math.max(0.80, m.rollingFriction - 0.06);
        m.surfaceFriction = m.surfaceFriction * 2.4;
      }
    },
  },
];

window.RG_MODIFIERS = RG_MODIFIERS;
