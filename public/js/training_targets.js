// ============================================================
// Monster Arena — PRACTICE TARGETS IN THE RING
// ------------------------------------------------------------
// The training ground used to be an empty arena with nothing to aim at.
// Now the map itself carries a range: four heavy boards standing still in a
// square around the spawn, and three silhouettes pacing a line behind them.
//
// They are ordinary monsters to the engine — so bullets, blades, glyphs and
// every status effect land on them exactly as they would in a wave — but
// they are pinned here: they never move off their mark, never attack, and
// they come back a couple of seconds after they are put down.
// ============================================================
(function () {
  'use strict';

  // dx / dz are measured from the spot the fighter arrives on, so the range
  // sits in the middle of whatever map the training ground opened.
  const SLOTS = [
    { id: 'board-1', type: 'tank',   still: true,  dx: -360, dz: -250 },
    { id: 'board-2', type: 'tank',   still: true,  dx:  360, dz: -250 },
    { id: 'board-3', type: 'tank',   still: true,  dx: -360, dz:  300 },
    { id: 'board-4', type: 'tank',   still: true,  dx:  360, dz:  300 },
    { id: 'shade-1', type: 'chaser', still: false, dx:    0, dz: -660, range: 230, speed: 0.52, phase: 0.0 },
    { id: 'shade-2', type: 'bomber', still: false, dx:    0, dz:  700, range: 230, speed: 0.38, phase: 2.1 },
    { id: 'shade-3', type: 'chaser', still: false, dx: -680, dz:    0, range: 200, speed: 0.61, phase: 4.2 }
  ];

  const RESPAWN_MS = 2200;
  const live = new Map();   // slot id -> the monster standing on that mark
  let origin = null;        // where the fighter arrived
  let raf = 0;
  let hint = null;

  function worldRef() { return window.__arenaWorld || null; }
  function entsRef() { return window._ents || null; }
  function running() {
    return typeof window.__pveMatchRunning === 'function' ? !!window.__pveMatchRunning() : false;
  }

  function place(slot) {
    const w = worldRef();
    let x = origin.x + slot.dx;
    let y = origin.y + slot.dz;
    if (w) {
      // Never stand a target inside a wall: walk it back toward the spawn.
      for (let i = 0; i < 8 && w.isBlocked(x, y, 24); i++) {
        x = origin.x + (x - origin.x) * 0.85;
        y = origin.y + (y - origin.y) * 0.85;
      }
    }
    slot.cx = x;
    slot.cy = y;
    return { x: x, y: y };
  }

  function spawnSlot(slot, ents) {
    if (!origin) return;
    const at = place(slot);
    const was = window.DEBUG_NO_ENEMIES;
    window.DEBUG_NO_ENEMIES = false;
    try { window.__pveSpawnEnemy(slot.type, at.x, at.y); } catch (_) {}
    window.DEBUG_NO_ENEMIES = was;
    const e = ents.enemies[ents.enemies.length - 1];
    if (!e) return;
    e.x = at.x;
    e.y = at.y;
    e.origin = { x: at.x, y: at.y };
    e.r = slot.still ? 22 : 16;
    e.hp = e.maxhp = slot.still ? 460 : 220;
    // Pinned: no walking, no attacks, no detection radius.
    e.speed = 0;
    e.cd = 99;
    e.detectR = 0;
    e.alerted = false;
    e._practice = slot.id;
    live.set(slot.id, e);
    slot.respawnAt = 0;
  }

  function showHint() {
    if (hint) return;
    hint = document.createElement('div');
    hint.style.cssText =
      'position:fixed;left:50%;top:74px;transform:translateX(-50%);z-index:24;' +
      'padding:7px 16px;border-radius:999px;font:800 11px/1 system-ui,sans-serif;' +
      'letter-spacing:.18em;text-transform:uppercase;color:#eafcff;' +
      'background:rgba(6,12,22,.78);border:1px solid rgba(34,230,255,.5);' +
      'box-shadow:0 0 22px rgba(34,230,255,.28);pointer-events:none;transition:opacity .6s ease';
    hint.textContent = 'Range live — the boards hold still, the shades pace';
    document.body.appendChild(hint);
    setTimeout(function () {
      if (hint) { hint.style.opacity = '0'; setTimeout(function () { if (hint) { hint.remove(); hint = null; } }, 700); }
    }, 7000);
  }

  function clear() {
    live.clear();
    origin = null;
    if (hint) { hint.remove(); hint = null; }
  }

  function frame() {
    raf = requestAnimationFrame(frame);
    // Crysto opens the same arena flags for its own reasons: no range there.
    if (!window.TRAINING_GROUND || window.UNIVERSE_ACTIVE) {
      if (live.size || origin) clear();
      return;
    }
    const ents = entsRef();
    if (!ents || !Array.isArray(ents.enemies) || !running()) return;
    const me = typeof window.__pvePlayer === 'function' ? window.__pvePlayer() : null;
    if (!origin) {
      if (!me) return;
      origin = { x: me.x, y: me.y };
      showHint();
    }
    const t = performance.now() / 1000;
    const w = worldRef();

    for (let i = 0; i < SLOTS.length; i++) {
      const slot = SLOTS[i];
      let e = live.get(slot.id);
      const gone = !e || ents.enemies.indexOf(e) < 0 || e.hp <= 0;
      if (gone) {
        if (e) {
          live.delete(slot.id);
          if (!slot.respawnAt) slot.respawnAt = performance.now() + RESPAWN_MS;
        }
        if (slot.respawnAt && performance.now() >= slot.respawnAt) spawnSlot(slot, ents);
        continue;
      }
      // Hold the mark: a board never budges, a shade walks its line.
      e.speed = 0;
      e.cd = 99;
      e.detectR = 0;
      e.alerted = false;
      if (slot.range) {
        const a = t * slot.speed + slot.phase;
        const x = slot.cx + Math.sin(a) * slot.range;
        const y = slot.cy;
        if (!w || !w.isBlocked(x, y, e.r)) { e.x = x; e.y = y; }
      } else {
        e.x = slot.cx;
        e.y = slot.cy;
      }
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
  function start() { if (!raf) raf = requestAnimationFrame(frame); }

  window.TrainingTargets = { clear: clear, count: function () { return live.size; } };
})();
