// ============================================================
// Monster Arena — server-side navigation for bots.
// A coarse occupancy grid (built once per generated map) feeds an A* search,
// so bots route around buildings and through doorways instead of grinding along
// walls — and can tell whether they actually have a clear shot.
// ============================================================
const CS = 32;           // grid cell size, world units
const RAD = 14;          // clearance each cell keeps from geometry (bot radius)
const GRIDS = new WeakMap();

function circleHitsRect(x, y, r, o) {
  const cx = Math.max(o.x, Math.min(x, o.x + o.w));
  const cy = Math.max(o.y, Math.min(y, o.y + o.h));
  const dx = x - cx, dy = y - cy;
  return dx * dx + dy * dy < r * r;
}

export function navGrid(lobby) {
  const world = lobby && lobby.world;
  if (!world || !Array.isArray(world.walls)) return null;
  let g = GRIDS.get(world);
  if (g && g.walls === world.walls && g.w === world.w && g.h === world.h) return g;

  const nx = Math.max(1, Math.ceil(world.w / CS));
  const ny = Math.max(1, Math.ceil(world.h / CS));
  const blocked = new Uint8Array(nx * ny);
  // Rasterise each wall into the cells it (plus clearance) covers — far cheaper
  // than testing every cell against every wall.
  for (const wall of world.walls) {
    const x0 = Math.max(0, Math.floor((wall.x - RAD) / CS));
    const x1 = Math.min(nx - 1, Math.floor((wall.x + wall.w + RAD) / CS));
    const y0 = Math.max(0, Math.floor((wall.y - RAD) / CS));
    const y1 = Math.min(ny - 1, Math.floor((wall.y + wall.h + RAD) / CS));
    for (let gy = y0; gy <= y1; gy++) {
      for (let gx = x0; gx <= x1; gx++) {
        const i = gy * nx + gx;
        if (blocked[i]) continue;
        if (circleHitsRect(gx * CS + CS / 2, gy * CS + CS / 2, RAD, wall)) blocked[i] = 1;
      }
    }
  }
  g = { walls: world.walls, w: world.w, h: world.h, nx, ny, blocked };
  GRIDS.set(world, g);
  return g;
}

const cellAt = (g, x, y) => {
  const cx = Math.max(0, Math.min(g.nx - 1, Math.floor(x / CS)));
  const cy = Math.max(0, Math.min(g.ny - 1, Math.floor(y / CS)));
  return cy * g.nx + cx;
};
const centreOf = (g, i) => ({ x: ((i % g.nx) + 0.5) * CS, y: (((i / g.nx) | 0) + 0.5) * CS });

function nearestFreeCell(g, i) {
  if (!g.blocked[i]) return i;
  const start = { x: i % g.nx, y: (i / g.nx) | 0 };
  for (let ring = 1; ring <= 5; ring++) {
    for (let dy = -ring; dy <= ring; dy++) {
      for (let dx = -ring; dx <= ring; dx++) {
        if (Math.abs(dx) !== ring && Math.abs(dy) !== ring) continue;
        const x = start.x + dx, y = start.y + dy;
        if (x < 0 || y < 0 || x >= g.nx || y >= g.ny) continue;
        const n = y * g.nx + x;
        if (!g.blocked[n]) return n;
      }
    }
  }
  return -1;
}

function heapPush(h, node) {
  h.push(node);
  let i = h.length - 1;
  while (i > 0) {
    const p = (i - 1) >> 1;
    if (h[p].f <= h[i].f) break;
    const t = h[p]; h[p] = h[i]; h[i] = t;
    i = p;
  }
}
function heapPop(h) {
  const top = h[0], last = h.pop();
  if (h.length) {
    h[0] = last;
    let i = 0;
    for (;;) {
      const l = i * 2 + 1, r = l + 1;
      let m = i;
      if (l < h.length && h[l].f < h[m].f) m = l;
      if (r < h.length && h[r].f < h[m].f) m = r;
      if (m === i) break;
      const t = h[m]; h[m] = h[i]; h[i] = t;
      i = m;
    }
  }
  return top;
}

// Waypoints from `unit` to (tx,ty), or null when there is no route at all.
export function findPath(lobby, sx, sy, tx, ty, cap = 2200) {
  const g = navGrid(lobby);
  if (!g) return null;
  let s = nearestFreeCell(g, cellAt(g, sx, sy));
  let goal = nearestFreeCell(g, cellAt(g, tx, ty));
  if (s < 0 || goal < 0) return null;
  if (s === goal) return [{ x: tx, y: ty }];

  const nx = g.nx;
  const gxT = goal % nx, gyT = (goal / nx) | 0;
  const heur = (i) => {
    const dx = Math.abs((i % nx) - gxT), dy = Math.abs(((i / nx) | 0) - gyT);
    return (dx + dy) + (Math.SQRT2 - 2) * Math.min(dx, dy);
  };

  const open = [];
  const gScore = new Map([[s, 0]]);
  const from = new Map();
  const closed = new Set();
  heapPush(open, { i: s, f: heur(s) });
  let expanded = 0;

  while (open.length && expanded < cap) {
    const cur = heapPop(open).i;
    if (cur === goal) {
      const cells = [cur];
      let walk = cur;
      while (from.has(walk)) { walk = from.get(walk); cells.push(walk); }
      cells.reverse();
      const pts = cells.slice(1, -1).map((i) => centreOf(g, i));
      pts.push({ x: tx, y: ty });
      // Skip waypoints we can already see past, so a bot cuts corners smoothly
      // instead of stepping cell by cell.
      const out = [];
      let at = { x: sx, y: sy };
      while (pts.length) {
        let k = 0;
        for (let j = pts.length - 1; j > 0; j--) {
          if (clearShot(lobby, at.x, at.y, pts[j].x, pts[j].y)) { k = j; break; }
        }
        out.push(pts[k]);
        at = pts[k];
        pts.length = k;
      }
      return out.length ? out : [{ x: tx, y: ty }];
    }
    if (closed.has(cur)) continue;
    closed.add(cur);
    expanded++;

    const cx = cur % nx, cy = (cur / nx) | 0;
    const base = gScore.get(cur) ?? 0;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const x = cx + dx, y = cy + dy;
        if (x < 0 || y < 0 || x >= nx || y >= g.ny) continue;
        const ni = y * nx + x;
        if (g.blocked[ni] || closed.has(ni)) continue;
        // No cutting a diagonal between two blocked orthogonals: that is how a
        // path slips through the corner of a building.
        if (dx && dy && (g.blocked[cy * nx + x] || g.blocked[y * nx + cx])) continue;
        const step = (dx && dy) ? Math.SQRT2 : 1;
        const ng = base + step;
        if (ng >= (gScore.get(ni) ?? Infinity)) continue;
        gScore.set(ni, ng);
        from.set(ni, cur);
        heapPush(open, { i: ni, f: ng + heur(ni) });
      }
    }
  }
  return null;
}

// True when nothing solid stands between two points (a clear line of fire).
export function clearShot(lobby, x0, y0, x1, y1) {
  const g = navGrid(lobby);
  if (!g) return true;
  const len = Math.hypot(x1 - x0, y1 - y0);
  const steps = Math.max(1, Math.ceil(len / (CS * 0.5)));
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    if (g.blocked[cellAt(g, x0 + (x1 - x0) * t, y0 + (y1 - y0) * t)]) return false;
  }
  return true;
}

// A nearby spot whose line to the threat is broken by geometry — behind a rock,
// around a building corner, or inside a house. Null when nothing is close.
export function coverSpot(lobby, unit, tx, ty) {
  const g = navGrid(lobby);
  if (!g) return null;
  const base = Math.atan2(unit.y - ty, unit.x - tx);
  for (const dist of [80, 120, 170, 230]) {
    for (const off of [0, 0.5, -0.5, 1.0, -1.0, 1.5, -1.5, 2.0, -2.0, 2.6, -2.6]) {
      const a = base + off;
      const x = unit.x + Math.cos(a) * dist;
      const y = unit.y + Math.sin(a) * dist;
      if (g.blocked[cellAt(g, x, y)]) continue;
      if (clearShot(lobby, x, y, tx, ty)) continue;      // still exposed
      if (!clearShot(lobby, unit.x, unit.y, x, y)) continue; // can't walk there
      return { x, y };
    }
  }
  return null;
}

// Walks `unit` toward (gx,gy) along a real path, with stuck recovery. Returns
// the heading it travelled so the caller can keep the body facing where it goes.
export function steerToGoal(lobby, unit, gx, gy, speed, dt, move) {
  const want = speed * dt;
  if (!(want > 0)) return unit.ang ?? 0;

  const goalMoved = Math.hypot(gx - (unit._pgx ?? 1e9), gy - (unit._pgy ?? 1e9));
  unit._pathT = (unit._pathT || 0) - dt;
  const endOfPath = !unit._path || (unit._wpI ?? 0) >= unit._path.length;
  if (endOfPath || unit._pathT <= 0 || goalMoved > 150) {
    unit._path = findPath(lobby, unit.x, unit.y, gx, gy, unit._navCap || 2200);
    unit._pathT = 0.6 + Math.random() * 0.3;
    unit._wpI = 0;
    unit._pgx = gx; unit._pgy = gy;
  }

  let ang;
  if (unit._path && unit._path.length) {
    while (unit._wpI < unit._path.length - 1 &&
           Math.hypot(unit._path[unit._wpI].x - unit.x, unit._path[unit._wpI].y - unit.y) < 26) unit._wpI++;
    const wp = unit._path[Math.min(unit._wpI, unit._path.length - 1)];
    ang = Math.atan2(wp.y - unit.y, wp.x - unit.x);
  } else {
    ang = Math.atan2(gy - unit.y, gx - unit.x);
  }

  const px = unit.x, py = unit.y;
  move(lobby, unit, Math.cos(ang) * want, Math.sin(ang) * want);

  const gained = Math.hypot(unit.x - px, unit.y - py);
  if (gained < want * 0.4) {
    unit._stuckT = (unit._stuckT || 0) + dt;
    if (unit._stuckT > 0.3) {
      // The step was eaten: shed the path, flip the preferred side and slide
      // sideways so the bot never grinds into the same corner.
      unit._stuckT = 0;
      unit._path = null; unit._pathT = 0; unit._wpI = 0;
      unit._sideSign = -(unit._sideSign || 1);
      const esc = ang + (Math.PI / 2) * unit._sideSign;
      move(lobby, unit, Math.cos(esc) * want, Math.sin(esc) * want);
      unit._stuckN = (unit._stuckN || 0) + 1;
    }
  } else {
    unit._stuckT = Math.max(0, (unit._stuckT || 0) - dt * 2);
    if (unit._stuckN) unit._stuckN = Math.max(0, unit._stuckN - dt);
  }
  return ang;
}