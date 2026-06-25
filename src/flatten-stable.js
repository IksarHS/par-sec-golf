// ── Stable-vertex cup heal (ON by default; ?novstable to disable) ───────────────────────────────────
// Peel-off-able, LOCAL-ONLY (not in tools/build.cjs SCRIPTS, so the public bundle is unchanged until this
// is promoted into core flattenCup). Applied by default in the local build; ?novstable restores the old
// delete-6 + respawn-2 heal for A/B comparison.
//
// WHY: the shipped flattenCup() (level-design.js) heals a sunk cup by DELETING the ~6 notch vertices
// (`vertices = vertices.filter(...)`) and SPLICING IN 2 fresh flat ones. That mutates the array LENGTH
// (net -4 per hole) and REINDEXES every vertex after the cup. Two costs:
//   1. Debug legibility: the on-canvas vertex numbers renumber mid-run (the cup's #61 deletes and is
//      reborn with a new id), so "the same piece of ground" doesn't keep a stable number all run.
//   2. Any consumer that referenced a vertex BY INDEX now reads a neighbour (the documented band-leak /
//      strata-pop hazard, run.js:183).
//
// WHAT: heal the cup by RAISING the existing cup-zone vertices onto the flat rim line, in place. Same
// objects, same array length, same indices, same identities — the vertex array is now FROZEN for the
// whole run. Visually identical to the shipped heal (the cup-fill animation is drawn separately by
// art.js and is untouched); the ground just ends flat using the points that were already there.
(function () {
  if (typeof location === 'undefined') return;
  var p = new URLSearchParams(location.search);
  if (p.has('novstable') || p.has('nostable')) return;           // ON by default; ?novstable restores delete+respawn heal
  if (typeof window.flattenCup !== 'function') return;            // needs the core function present

  var _orig = window.flattenCup;
  window.flattenCup = function (hole) {
    try {
      if (!hole || hole.cupX == null || typeof vertices === 'undefined' || !vertices.length) {
        return _orig.apply(this, arguments);
      }
      var halfW = (typeof CUP_WIDTH !== 'undefined' ? CUP_WIDTH : 24) / 2;
      var flatMargin = 20;
      var zoneL = hole.cupX - halfW - flatMargin;
      var zoneR = hole.cupX + halfW + flatMargin;
      if (zoneR <= zoneL) return _orig.apply(this, arguments);
      // The shipped heal draws a straight line from (zoneL, cupLeftY) to (zoneR, cupRightY). Reproduce
      // that exact surface, but by moving the vertices that already exist in the zone onto the line —
      // never adding or removing any. Fall back to the rim heights if the hole's cached Ys are missing.
      var yL = (hole.cupLeftY != null) ? hole.cupLeftY : (hole.cupY != null ? hole.cupY : null);
      var yR = (hole.cupRightY != null) ? hole.cupRightY : (hole.cupY != null ? hole.cupY : yL);
      if (yL == null) return _orig.apply(this, arguments);
      var span = zoneR - zoneL, moved = 0;
      for (var i = 0; i < vertices.length; i++) {
        var v = vertices[i];
        if (v.x < zoneL || v.x > zoneR) continue;
        v.y = yL + (yR - yL) * ((v.x - zoneL) / span);            // onto the flat rim line
        moved++;
      }
      if (!moved) return _orig.apply(this, arguments);            // nothing in-zone? defer to the original
      hole._flatStable = true;
    } catch (e) {
      try { return _orig.apply(this, arguments); } catch (_) {}
    }
  };
  window.__flattenStable = true;
  try { console.log('[vstable] cup heal is now IN-PLACE — vertex count + identity stable for the whole run'); } catch (e) {}
})();
