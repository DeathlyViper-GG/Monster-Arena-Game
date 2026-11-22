// SERVER-AUTHORITATIVE GLYPH SYSTEM — a faithful port of the single-player
// trees (public/js/pve16.js): a glyph deals the same damage and the same
// effects here as it does offline.

export const GLYPH_KEYS = {
  fire: ['hotCoals', 'searingShots', 'ashenFinish', 'detonate', 'napalmTrail', 'volcanicCore', 'cauterise', 'phoenixStep', 'rebirth'],
  lightning: ['arcJump', 'forkedArc', 'stormConductor', 'chargedRounds', 'overload', 'thunderclap', 'staticDash', 'blinkStrike', 'ballLightning'],
  spirit: ['wispOrbit', 'wispSwarm', 'guardianSpirits', 'haunt', 'soulBind', 'dreadBloom', 'revenant', 'possession', 'wraithKing'],
  water: ['chill', 'iceShards', 'permafrost', 'mendingMist', 'tidalRenewal', 'sanctuary', 'rippleShot', 'tidalWave', 'maelstrom'],
  earth: ['thornmail', 'spikedBarrier', 'jaggedEarth', 'bulwark', 'rootedStance', 'unbreakable', 'stonePillar', 'quake', 'golem']
};
const ELEMENTS = Object.keys(GLYPH_KEYS);

// Picking a path grants its starter node (offline does the same in resetGlyphState).
export const GLYPH_STARTERS = {
  fire: 'ignite', lightning: 'static', spirit: 'soulTap', water: 'drench', earth: 'stoneSkin'
};

export function makeGlyphState() {
  const g = {};
  for (const el of ELEMENTS) g[el] = {};
  return g;
}

export function ensureStarter(p) {
  if (!p) return;
  if (!p.glyph) p.glyph = makeGlyphState();
  const el = p.glyphPath;
  if (!el || !p.glyph[el]) return;
  const k = GLYPH_STARTERS[el];
  if (k) p.glyph[el][k] = true;
}

function isPath(p, el) { return p.glyphPath === el || !!(p.completedGlyphs && p.completedGlyphs[el]); }
function hasG(p, el, key) { return !!(p.glyph && p.glyph[el] && p.glyph[el][key]); }

function st(e) {
  if (!e._status) {
    e._status = {
      burnT: 0, burnStacks: 0, staticT: 0, staticPrimed: false,
      drenchT: 0, drenchStacks: 0, hauntT: 0, bleedT: 0, freezeT: 0
    };
  }
  return e._status;
}

export function aoeDamage(lobby, x, y, r, dmg, ownerId, opts = {}) {
  const rr = r * r;
  for (const e of lobby.enemies) {
    if (e.hp <= 0) continue;
    const dx = e.x - x, dy = e.y - y;
    if (dx * dx + dy * dy <= rr) {
      e.hp -= dmg;
      if (ownerId) e._lastHitBy = ownerId;
      if (opts.stun) e._stunT = Math.max(e._stunT ?? 0, opts.stun);
      if (opts.slow) e._slowT = Math.max(e._slowT ?? 0, opts.slow);
      if (opts.burn) { const s = st(e); s.burnStacks = Math.min(3, s.burnStacks + 1); s.burnT = Math.max(s.burnT, 3.6); }
    }
  }
}

// Tidal Wave / maelstrom: a cone of water in front of the caster.
function waveDamage(lobby, p, r, spread, dmg) {
  const half = spread / 2;
  for (const e of lobby.enemies) {
    if (e.hp <= 0) continue;
    const dx = e.x - p.x, dy = e.y - p.y;
    if (dx * dx + dy * dy > r * r) continue;
    let da = Math.atan2(dy, dx) - p.angle;
    da = Math.atan2(Math.sin(da), Math.cos(da));
    if (Math.abs(da) > half) continue;
    e.hp -= dmg;
    e._lastHitBy = p.id;
    e._slowT = Math.max(e._slowT ?? 0, 1.2);
  }
}

export function tickEnemyGlyphStatus(lobby, e, dt) {
  const s = e._status;
  if (!s) return e.hp <= 0;

  if (s.burnT > 0) {
    s.burnT -= dt;
    e.hp -= (2.0 + 1.2 * s.burnStacks) * dt;
    if (s.burnT <= 0) { s.burnT = 0; s.burnStacks = 0; }
  }
  if (s.hauntT > 0) s.hauntT -= dt;
  if (s.drenchT > 0) {
    s.drenchT -= dt;
    if (s.drenchT <= 0) { s.drenchT = 0; s.drenchStacks = 0; }
  }
  if (s.bleedT > 0) {
    s.bleedT -= dt;
    e.hp -= 4.0 * dt;
  }
  if (s.freezeT > 0) s.freezeT -= dt;
  if (s.staticT > 0) {
    s.staticT -= dt;
    if (s.staticT <= 0) { s.staticT = 0; s.staticPrimed = false; }
  }
  if ((e._stunT ?? 0) > 0) e._stunT = Math.max(0, e._stunT - dt);
  if ((e._slowT ?? 0) > 0) e._slowT = Math.max(0, e._slowT - dt);
  return e.hp <= 0;
}

export function glyphMoveMul(e) {
  const s = e._status;
  if (s && s.freezeT > 0) return 0;
  if ((e._stunT ?? 0) > 0) return 0;
  let mul = 1;
  if ((e._slowT ?? 0) > 0) mul *= 0.75;
  if (s) {
    if (s.burnT > 0 && e._coalSlow) mul *= Math.max(0.6, 1 - 0.07 * s.burnStacks);
    if (s.drenchT > 0) mul *= Math.max(0.6, 1 - 0.05 * s.drenchStacks);
  }
  return mul;
}

// Returns the damage multiplier that was applied (damage is dealt here).
export function applyGlyphHit(lobby, p, e, baseDmg, hitKind) {
  if (!p || !e) { if (e) e.hp -= baseDmg; return 1; }
  const s = st(e);
  let mult = 1;
  e._lastHitBy = p.id;

  // 🌊 Water — tidal wave builds every 5 hits
  if (isPath(p, 'water') && hasG(p, 'water', 'tidalWave')) {
    p._tidalWaveHits = (p._tidalWaveHits ?? 0) + 1;
    if (p._tidalWaveHits >= 5) {
      p._tidalWaveHits = 0;
      waveDamage(lobby, p, hasG(p, 'water', 'maelstrom') ? 340 : 300, Math.PI / 1.8, 18);
    }
  }

  // 🔥 Fire — ignite / hot coals / searing / detonate
  if (isPath(p, 'fire') && (hasG(p, 'fire', 'ignite') || hasG(p, 'fire', 'hotCoals'))) {
    s.burnStacks = Math.min(3, s.burnStacks + 1);
    s.burnT = Math.max(s.burnT, 3.6);
    if (hasG(p, 'fire', 'hotCoals')) e._coalSlow = true;
    if (hasG(p, 'fire', 'searingShots') && s.burnStacks > 0) mult *= 1.10;
    if (hasG(p, 'fire', 'detonate') && s.burnStacks >= 3) {
      aoeDamage(lobby, e.x, e.y, 110, 14, p.id, { burn: true });
      s.burnStacks = 0;
      s.burnT = 0;
    }
  }

  // ⚡ Lightning — static priming / discharge / arcs / overload
  if (isPath(p, 'lightning')) {
    if (s.staticT <= 0) {
      s.staticT = 2.6;
      s.staticPrimed = true;
    } else if (s.staticPrimed) {
      s.staticPrimed = false;
      s.staticT = 0;
      e.hp -= 14;
      if (hasG(p, 'lightning', 'thunderclap')) aoeDamage(lobby, e.x, e.y, 90, 10, p.id, { stun: 0.25 });
      if (hasG(p, 'lightning', 'arcJump') || hasG(p, 'lightning', 'forkedArc') || hasG(p, 'lightning', 'stormConductor')) {
        let jumps = hasG(p, 'lightning', 'stormConductor') ? 12 : (hasG(p, 'lightning', 'forkedArc') ? 2 : 1);
        let last = e;
        while (jumps-- > 0) {
          let best = null, bestD2 = 220 * 220;
          for (const o of lobby.enemies) {
            if (o === last || o.hp <= 0) continue;
            const dx = last.x - o.x, dy = last.y - o.y;
            const d2 = dx * dx + dy * dy;
            if (d2 < bestD2) { bestD2 = d2; best = o; }
          }
          if (!best) break;
          best.hp -= hasG(p, 'lightning', 'forkedArc') ? 7 : 10;
          best._lastHitBy = p.id;
          last = best;
        }
      }
      if (hasG(p, 'lightning', 'overload')) e._stunT = Math.max(e._stunT ?? 0, 0.35);
    }
    if (hasG(p, 'lightning', 'chargedRounds')) {
      p._glyphCharge = Math.min(1, (p._glyphCharge ?? 0) + 0.08);
      mult *= (1 + 0.10 * p._glyphCharge);
    }
  }

  // 👻 Spirit — soul tap / haunt / soul bind
  if (isPath(p, 'spirit') && hasG(p, 'spirit', 'soulTap')) {
    if (hasG(p, 'spirit', 'haunt')) s.hauntT = Math.max(s.hauntT, 3.4);
    if (hasG(p, 'spirit', 'soulBind')) {
      const nowMs = Date.now();
      if (!p._linkA || !p._linkT || p._linkT < nowMs) { p._linkA = e.id; p._linkB = null; p._linkT = nowMs + 2400; }
      else if (!p._linkB && p._linkA !== e.id) { p._linkB = e.id; p._linkT = nowMs + 3000; }
    }
  }

  // 💧 Water — drench / ripple / renewal / chill / permafrost / ice shards
  if (isPath(p, 'water') && hasG(p, 'water', 'drench')) {
    s.drenchStacks = Math.min(3, s.drenchStacks + 1);
    s.drenchT = Math.max(s.drenchT, 4.2);

    if (hasG(p, 'water', 'rippleShot')) {
      const dx = e.x - p.x, dy = e.y - p.y;
      const d = Math.hypot(dx, dy) || 1;
      e.x += (dx / d) * 18; e.y += (dy / d) * 18;
    }
    if (hasG(p, 'water', 'tidalRenewal')) {
      p._tidalHits = (p._tidalHits ?? 0) + 1;
      if (p._tidalHits % 10 === 0) p.hp = Math.min(p.hpMax ?? 100, (p.hp ?? 100) + 5);
    }
    if (hasG(p, 'water', 'mendingMist')) p.hp = Math.min(p.hpMax ?? 100, (p.hp ?? 100) + 1);
    if (hasG(p, 'water', 'iceShards') && Math.random() < 0.25) mult *= 1.4;

    // Chill: three drenches freeze the target, permafrost shatters around it.
    if (hasG(p, 'water', 'chill') && s.drenchStacks >= 3 && s.freezeT <= 0) {
      s.freezeT = hasG(p, 'water', 'permafrost') ? 1.15 : 0.8;
      if (hasG(p, 'water', 'permafrost')) aoeDamage(lobby, e.x, e.y, 90, 18, p.id);
      s.drenchStacks = 0;
      s.drenchT = 0;
    }
  }

  // 🪨 Earth — jagged earth bleed
  if (isPath(p, 'earth') && hasG(p, 'earth', 'jaggedEarth')) s.bleedT = Math.max(s.bleedT, 2.8);

  const finalDmg = baseDmg * mult;
  e.hp -= finalDmg;

  if (isPath(p, 'spirit') && hasG(p, 'spirit', 'soulBind') && p._linkA && p._linkB) {
    const otherId = (p._linkA === e.id) ? p._linkB : (p._linkB === e.id ? p._linkA : null);
    if (otherId) {
      const other = lobby.enemies.find(o => o.id === otherId);
      if (other && other !== e && other.hp > 0) {
        other.hp -= finalDmg * 0.35;
        other._lastHitBy = p.id;
      }
    }
  }
  return mult;
}

export function applyGlyphKill(lobby, e, killerId) {
  const pid = killerId ?? e._lastHitBy;
  if (!pid) return;
  const p = lobby.players.find(pl => pl.id === pid);
  if (!p) return;
  const s = e._status || {};
  const burning = (s.burnStacks ?? 0) > 0;

  if (isPath(p, 'fire')) {
    if (hasG(p, 'fire', 'cauterise') && burning) p.hp = Math.min(p.hpMax ?? 100, (p.hp ?? 100) + 6);
    if (hasG(p, 'fire', 'volcanicCore')) {
      p._killCount = (p._killCount ?? 0) + 1;
      if (p._killCount % 8 === 0) aoeDamage(lobby, e.x, e.y, 140, 12, pid, { burn: true });
    }
  }

  if (isPath(p, 'spirit')) {
    if (hasG(p, 'spirit', 'dreadBloom') && (s.hauntT ?? 0) > 0) {
      for (const o of lobby.enemies) {
        if (o === e || o.hp <= 0) continue;
        const dx = o.x - e.x, dy = o.y - e.y;
        if (dx * dx + dy * dy < 180 * 180) o._slowT = Math.max(o._slowT ?? 0, 1.6);
      }
    }
    const isBoss = e.type === 'boss';
    const spawnShade = (hasG(p, 'spirit', 'wraithKing') && isBoss) || (hasG(p, 'spirit', 'revenant') && Math.random() < 0.25);
    if (spawnShade) {
      p._shades = p._shades || [];
      p._shades.push({
        x: e.x, y: e.y,
        life: hasG(p, 'spirit', 'possession') ? 10 : 2.0,
        cd: 0,
        dmg: isBoss ? 14 : 9,
        owner: pid
      });
    }
  }
}

export function thornmailReflect(lobby, p, e, incomingDmg) {
  if (!isPath(p, 'earth') || !hasG(p, 'earth', 'thornmail')) return;
  e.hp -= incomingDmg * 0.2;
  e._lastHitBy = p.id;
  if (hasG(p, 'earth', 'spikedBarrier')) e._slowT = Math.max(e._slowT ?? 0, 1.0);
}

// Defensive earth nodes: stone skin / rooted stance.
export function glyphArmor(p) {
  if (!p) return 1;
  if (!isPath(p, 'earth')) return 1;
  let red = hasG(p, 'earth', 'stoneSkin') ? 0.12 : 0;
  if (hasG(p, 'earth', 'rootedStance')) red += 0.10;
  return Math.max(0.5, 1 - red);
}

// One-time stat bumps when a node is enchanted.
export function onGlyphUnlock(p, path, key) {
  if (!p) return;
  if (path === 'earth' && key === 'bulwark' && !p._bulwarkDone) {
    p._bulwarkDone = true;
    p.hpMax = Math.min(220, (p.hpMax ?? 100) + 25);
    p.hp = Math.min(p.hpMax, (p.hp ?? 100) + 25);
  }
  if (path === 'water' && key === 'sanctuary') p._sanctuaryOwned = true;
}

const nearestEnemy = (lobby, x, y, maxD) => {
  let best = null, bestD2 = maxD * maxD;
  for (const e of lobby.enemies) {
    if (e.hp <= 0) continue;
    const dx = e.x - x, dy = e.y - y;
    const d2 = dx * dx + dy * dy;
    if (d2 < bestD2) { bestD2 = d2; best = e; }
  }
  return best;
};

// Summoned helpers and auras: wisps, golem, quake, ball lightning, shades,
// sanctuary. Runs every simulation step so online play matches offline.
export function tickGlyphAutomata(lobby, dt) {
  for (const p of lobby.players) {
    if (p.hp <= 0) continue;

    // 👻 Wisp orbit shooter
    if (isPath(p, 'spirit') && hasG(p, 'spirit', 'wispOrbit')) {
      const count = hasG(p, 'spirit', 'wispSwarm') ? 3 : 1;
      if (!Array.isArray(p._wisps) || p._wisps.length !== count) {
        p._wisps = Array.from({ length: count }, (_, i) => ({ a: (i * Math.PI * 2) / count, cd: 0.6, wx: p.x, wy: p.y }));
      }
      for (const w of p._wisps) {
        w.a += dt * 1.6;
        w.wx = p.x + Math.cos(w.a) * 44;
        w.wy = p.y + Math.sin(w.a) * 44;
        w.cd -= dt;
        if (w.cd > 0) continue;
        const best = nearestEnemy(lobby, w.wx, w.wy, 520);
        if (!best) continue;
        w.cd = 1.0;
        best.hp -= 10;
        best._lastHitBy = p.id;
      }
    } else p._wisps = null;

    // ⚡ Ball lightning following zap
    if (isPath(p, 'lightning') && hasG(p, 'lightning', 'ballLightning')) {
      p._ballCD = Math.max(0, (p._ballCD ?? 0) - dt);
      if (p._ballCD <= 0) {
        p._ballCD = 0.45;
        const best = nearestEnemy(lobby, p.x, p.y, 420);
        if (best) { best.hp -= 10; best._lastHitBy = p.id; }
      }
    }

    // 🪨 Quake stomp
    if (isPath(p, 'earth') && hasG(p, 'earth', 'quake')) {
      p._quakeCD = (p._quakeCD ?? 0) - dt;
      if (p._quakeCD <= 0) {
        p._quakeCD = 3.2;
        aoeDamage(lobby, p.x, p.y, 120, 10, p.id, { stun: 0.35 });
      }
    }

    // 🪨 Golem: lumbers at the nearest monster, pulls the pack in, slams
    if (isPath(p, 'earth') && hasG(p, 'earth', 'golem')) {
      if (!p._golem) p._golem = { x: p.x + 40, y: p.y + 40, cd: 2.5 };
      const g = p._golem;
      const best = nearestEnemy(lobby, g.x, g.y, 520);
      const tx = best ? best.x : p.x;
      const ty = best ? best.y : p.y;
      const d = Math.hypot(tx - g.x, ty - g.y) || 1;
      if (d > (best ? 70 : 90)) { g.x += ((tx - g.x) / d) * 70 * dt; g.y += ((ty - g.y) / d) * 70 * dt; }
      for (const e of lobby.enemies) {
        if (e.hp <= 0) continue;
        const dx = g.x - e.x, dy = g.y - e.y;
        const dd = Math.hypot(dx, dy);
        if (dd < 170 && dd > 2) { e.x += (dx / dd) * 34 * dt; e.y += (dy / dd) * 34 * dt; }
      }
      g.cd -= dt;
      if (g.cd <= 0) {
        g.cd = 2.5;
        aoeDamage(lobby, g.x, g.y, 90, 16, p.id, { stun: 0.2 });
      }
    } else p._golem = null;

    // 👻 Revenant shades bite on their own for a while
    if (Array.isArray(p._shades) && p._shades.length) {
      for (let i = p._shades.length - 1; i >= 0; i--) {
        const sh = p._shades[i];
        sh.life -= dt;
        sh.cd -= dt;
        if (sh.cd <= 0) {
          sh.cd = 0.7;
          const best = nearestEnemy(lobby, sh.x, sh.y, 260);
          if (best) { best.hp -= sh.dmg; best._lastHitBy = sh.owner; sh.x = best.x; sh.y = best.y; }
        }
        if (sh.life <= 0) p._shades.splice(i, 1);
      }
    }

    // 💧 Sanctuary heals while it stands after a wave
    if ((p._sanctuaryT ?? 0) > 0) {
      p._sanctuaryT -= dt;
      p.hp = Math.min(p.hpMax ?? 100, (p.hp ?? 100) + 2 * dt);
    }
  }
}