/* =====================================================================
   melee_status.js — what a melee strike actually does to what it hits.

   melee_catalog.js gives every weapon an element and a status table; this
   file makes them real. It wraps MeleeFX.swing — the one call the game
   makes the instant a swing begins — and applies the weapon's status to
   everything standing in its arc:

     burn     sets the target alight (the engine's own burn tick burns it)
     poison   a green venom that keeps eating health
     frost    freezes it in place
     shock    locks it up and arcs to whatever stands beside it
     bleed    opens a wound that keeps dripping
     earth    knocks it back and stuns it
     void     drags it in and haunts it
     spirit   takes health back for the wielder

   It also drops the weapon's elemental burst on every target, so a fire
   blade leaves fire on what it cuts.
   ===================================================================== */
(function (G) {
  'use strict';

  const FX = G.MeleeFX;
  if (!FX || typeof FX.swing !== 'function') return;

  const now = () => performance.now() / 1000;

  const online = () => !!(G.Net && G.Net.state && G.Net.state.lobbyId);
  const catalog = () => G.MeleeCatalog || null;

  function targets() {
    const out = [];
    const ents = G._ents;
    if (ents && Array.isArray(ents.enemies)) out.push(...ents.enemies);
    try {
      if (G.BOTS_ENABLED && typeof SP_BOTS !== 'undefined' && SP_BOTS) out.push(...SP_BOTS);
    } catch (_) {}
    return out;
  }

  function blocked(x, y, r) {
    const w = G.__arenaWorld;
    return !!(w && w.isBlocked && w.isBlocked(x, y, r));
  }

  // Everything inside the weapon's own cone.
  function inArc(p, t, reach, half) {
    const dx = t.x - p.x, dy = t.y - p.y;
    if (Math.hypot(dx, dy) > reach + (t.r || 16)) return false;
    const diff = Math.abs(((Math.atan2(dy, dx) - (p.angle || 0) + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
    return diff <= half;
  }

  function chain(from, n, dmg) {
    let hits = 0;
    for (const o of targets()) {
      if (hits >= n) break;
      if (!o || o === from || o.hp <= 0) continue;
      if (Math.hypot(o.x - from.x, o.y - from.y) > 160) continue;
      if (!(o.absorbing && o.type === 'boss')) o.hp -= dmg;
      if (typeof G.botGlyphBurstFx === 'function') G.botGlyphBurstFx(o.x, o.y, 'lightning', 60, .35);
      if (typeof G.DN === 'function') G.DN(o.x, o.y, dmg, 'enemy');
      hits++;
    }
  }

  function apply(t, st, p) {
    const s = st.status;
    if (s.burn) { t.burnStacks = Math.min(3, (t.burnStacks || 0) + s.burn[0]); t.burnT = Math.max(t.burnT || 0, s.burn[1]); }
    if (s.poison) { t.poisonDps = Math.max(t.poisonDps || 0, s.poison[0]); t.poisonT = Math.max(t.poisonT || 0, s.poison[1]); }
    if (s.freeze) t.freezeT = Math.max(t.freezeT || 0, s.freeze);
    if (s.stun) t.stunT = Math.max(t.stunT || 0, s.stun);
    if (s.bleed) t.bleedT = Math.max(t.bleedT || 0, s.bleed);
    if (s.haunt) t.hauntT = Math.max(t.hauntT || 0, s.haunt);
    if (s.knock) {
      const a = Math.atan2(t.y - p.y, t.x - p.x);
      const nx = t.x + Math.cos(a) * s.knock, ny = t.y + Math.sin(a) * s.knock;
      if (!blocked(nx, ny, t.r || 16)) { t.x = nx; t.y = ny; }
    }
    if (s.pull) {
      const a = Math.atan2(p.y - t.y, p.x - t.x);
      const d = Math.hypot(t.x - p.x, t.y - p.y);
      if (d > 46) { t.x += Math.cos(a) * (d - 46); t.y += Math.sin(a) * (d - 46); }
    }
    const dmg = p.weapon && G.__arenaWeapons ? (G.__arenaWeapons[p.weapon] || {}).dmg || 0 : 0;
    if (s.heal) p.hp = Math.min(p.hpMax || p.hp, p.hp + s.heal);
    if (s.lifesteal) p.hp = Math.min(p.hpMax || p.hp, p.hp + dmg * s.lifesteal);
    if (s.chain) chain(t, s.chain, dmg * .45);
  }

  // In a live match the room owns every fighter's health, so the client only
  // says what its own swing reached and the room applies it. The fighters are
  // read from the same interpolated snapshot the screen draws, so the hit lands
  // on the body the player actually swung at.
  function netTargets() {
    const ns = G.Net && G.Net.state;
    const snap = ns && ns.snapshot;
    if (!snap) return [];
    const mode = (ns.meta && ns.meta.mode) || 'pve';
    if (mode === 'pve') return Array.isArray(snap.enemies) ? snap.enemies : [];
    const list = Array.isArray(snap.players) ? snap.players : [];
    const me = list.find((p) => p && p.id === ns.peerId);
    const myTeam = me ? me.team : null;
    const foes = list.filter((p) => p && p.id !== ns.peerId && (p.hp ?? 1) > 0 &&
      !((myTeam === 0 || myTeam === 1) && p.team === myTeam));
    // Bots are bodies in the room too. Leaving them out meant the swing never
    // told the room it had reached one, so melee passed straight through them.
    for (const b of (Array.isArray(snap.bots) ? snap.bots : [])) {
      if (!b || (b.hp ?? 1) <= 0) continue;
      if ((myTeam === 0 || myTeam === 1) && b.team === myTeam) continue;
      foes.push(b);
    }
    return foes;
  }

  // One swing: element on everything it reached, status on everything it bit.
  function strike(o) {
    const C = catalog(), p = G.__arenaPlayer;
    if (!C || !p || !o) return;
    const st = C.stats(o.id);
    const reach = st.reach || 120, half = ((st.arc || 90) * Math.PI) / 180 / 2;
    const live = online();
    const mode = live ? ((G.Net.state.meta && G.Net.state.meta.mode) || 'pve') : '';
    // In a live match the fighters are drawn a beat behind where the room has
    // them, so a swing at a moving body is judged a little more generously:
    // without it a blade that plainly connected reported nothing at all.
    const netReach = live ? reach + 34 : reach;
    const netHalf = live ? half + 0.34 : half;
    // A swing is worth a third of a gunshot, scaled by the weapon's own weight.
    const dmg = Math.max(4, Math.round(34 * (st.dmg || 1)));
    for (const t of (live ? netTargets() : targets())) {
      if (!t || (t.hp ?? 1) <= 0) continue;
      if (!inArc(p, t, netReach, netHalf)) continue;
      if (typeof FX.hit === 'function') FX.hit(t.x, t.y, o.id);
      if (live) {
        // An enemy is named by where it stands, a rival by their id.
        try {
          if (mode === 'pve') G.Net.sendHit('enemy', t.x, t.y, dmg, 'melee');
          else G.Net.sendHit(t.id, t.x, t.y, dmg, 'melee');
        } catch (e) {}
        continue;
      }
      if (st.status) apply(t, st, p);
    }
  }

  const swing = FX.swing;
  FX.swing = function (o) {
    const r = swing.apply(this, arguments);
    try { strike(o); } catch (e) { if (!strike._err) { strike._err = 1; console.warn('[melee status]', e); } }
    return r;
  };

  /* --------------------------------------------------- venom over time
     Poison has no engine tick of its own: it is this file's own damage
     over time, so the green keeps eating whatever it landed on. */
  let last = 0;
  function tick() {
    requestAnimationFrame(tick);
    const t = now();
    const dt = last ? Math.min(.05, t - last) : .016;
    last = t;
    const running = typeof G.__pveMatchRunning === 'function' ? G.__pveMatchRunning() : true;
    if (!running) return;
    for (const o of targets()) {
      if (!o || (o.poisonT || 0) <= 0) continue;
      o.poisonT = Math.max(0, o.poisonT - dt);
      if (o.hp > 0 && !(o.absorbing && o.type === 'boss')) o.hp -= (o.poisonDps || 3) * dt;
      if (o.poisonT <= 0) o.poisonDps = 0;
    }
  }
  requestAnimationFrame(tick);

  G.MeleeStatus = { strike, apply };
})(window);
