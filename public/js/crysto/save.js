/* Crysto — the vigil remembers.
   The vale saves itself at the beats that matter: waking a shrine, breaking a
   guardian, the Keep's knight, the Sunstone. Walk back in and you carry on from
   the last of those, never from the cryo pod. */
(function () {
  const C = (window.Crysto = window.Crysto || {});
  const KEY = 'crysto_vigil_v1';

  C.save = {
    auto() {
      const q = C.quest && C.quest.state;
      if (!q) return;
      const data = {
        step: q.step,
        lit: q.lit || {},
        guardians: q.guardians || {},
        bossDead: !!q.bossDead,
        bossSpawned: !!q.bossSpawned,
        done: !!q.done,
        elixirs: q.elixirs || {},
        healthUpgraded: !!q.healthUpgraded,
        maxHp: C.player ? C.player().maxHp : 100,
        arms: C.weapons ? C.weapons.snapshot() : null,
        at: Date.now()
      };
      try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (_) {}
      if (C.hud && C.hud.savePing) C.hud.savePing();
    },

    read() {
      try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (_) { return null; }
    },

    clear() {
      try { localStorage.removeItem(KEY); } catch (_) {}
    }
  };
})();
