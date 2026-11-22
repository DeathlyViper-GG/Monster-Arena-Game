// Live-room copy of obstacle-aware steering (see game_server/steer.ts).

const OFFSETS = [0.55, 1.05, 1.6, 2.2, 2.8];

function blockedAt(lobby, x, y, r) {
  const world = lobby.world;
  if (!world) return false;
  for (const list of [world.walls, world.solids]) {
    for (const w of (list || [])) {
      if (x + r > w.x && x - r < w.x + w.w && y + r > w.y && y - r < w.y + w.h) return true;
    }
  }
  return false;
}

function clearAhead(lobby, unit, ang, r, look) {
  const x = unit.x + Math.cos(ang) * look;
  const y = unit.y + Math.sin(ang) * look;
  return !blockedAt(lobby, x, y, r);
}

// The nearest doorway. A house is only enterable through its door frames, so a
// bot that bumps into a facade heads for the door instead of grinding along the
// wall — that is what lets it follow a player inside and across the bridges
// that join the buildings.
function nearestDoor(lobby, unit, range) {
  const houses = (lobby.world && lobby.world.buildings) || [];
  let best = null, bestD2 = range * range;
  for (const b of houses) {
    for (const d of (b.doors || [])) {
      const cx = d.x + d.w / 2, cy = d.y + d.h / 2;
      const d2 = (cx - unit.x) * (cx - unit.x) + (cy - unit.y) * (cy - unit.y);
      if (d2 < bestD2) { bestD2 = d2; best = { x: cx, y: cy }; }
    }
  }
  return best;
}

// Steps `unit` toward `ang` at `speed`, bending around anything in the way.
export function steerMove(lobby, unit, ang, speed, dt, move, look = 34) {
  const want = speed * dt;
  if (!(want > 0)) return ang;

  const r = Math.max(6, (unit.r || 16) * 0.6);
  const side = unit._steerSide || 1;
  const px = unit.x, py = unit.y;

  // Straight line first — only deviate when something is actually in the way.
  let chosen = ang;
  if (!clearAhead(lobby, unit, ang, r, look)) {
    chosen = null;
    // Blocked by a building? Aim for its door — the short probe keeps the test
    // honest even when the doorway is still a few paces away.
    const door = nearestDoor(lobby, unit, 300);
    if (door) {
      const da = Math.atan2(door.y - unit.y, door.x - unit.x);
      if (clearAhead(lobby, unit, da, r, 26)) chosen = da;
    }
    if (chosen == null) for (const off of OFFSETS) {
      if (clearAhead(lobby, unit, ang + off * side, r, look)) { chosen = ang + off * side; break; }
      if (clearAhead(lobby, unit, ang - off * side, r, look)) { chosen = ang - off * side; unit._steerSide = -side; break; }
    }
    if (chosen == null) chosen = ang + 1.6 * side; // boxed in: veer hard and let it slide
  }

  move(lobby, unit, Math.cos(chosen) * want, Math.sin(chosen) * want);

  // Did the step actually land? If the wall ate it, commit to a sideways escape
  // so the bot stops grinding into the same corner.
  const gained = Math.hypot(unit.x - px, unit.y - py);
  if (gained < want * 0.35) {
    unit._stuckFor = (unit._stuckFor || 0) + dt;
    if (unit._stuckFor > 0.25) {
      unit._steerSide = -(unit._steerSide || 1);
      const escape = chosen + (Math.PI / 2) * unit._steerSide;
      for (const off of [0, 0.6, -0.6, 1.2, -1.2, 2.0, -2.0]) {
        if (clearAhead(lobby, unit, escape + off, r, look + 22)) {
          move(lobby, unit, Math.cos(escape + off) * want, Math.sin(escape + off) * want);
          break;
        }
      }
      if (unit._stuckFor > 2.5) unit._stuckFor = 0; // fresh attempt after a long grind
    }
  } else {
    unit._stuckFor = Math.max(0, (unit._stuckFor || 0) - dt * 2);
  }

  return chosen;
}