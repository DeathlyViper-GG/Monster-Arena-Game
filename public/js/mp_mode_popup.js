// mp_mode_popup.js — the setup questions a multiplayer mode asks before the
// host commits: bots in the match or players only, and (Capture the Flag)
// whether friends share a side or face each other.
(() => {
  const state = { mode: 'pve', bots: true, rule: 'opposite' };
  let pending = null;
  const $ = (id) => document.getElementById(id);

  function paint() {
    const bots = $('modeOptsBots');
    if (bots) bots.querySelectorAll('[data-bots]').forEach((b) => {
      b.classList.toggle('is-active', (b.dataset.bots === '1') === state.bots);
    });
    const teams = $('modeOptsTeams');
    if (teams) teams.querySelectorAll('[data-rule]').forEach((b) => {
      b.classList.toggle('is-active', b.dataset.rule === state.rule);
    });
  }

  function hideAll() {
    document.querySelectorAll('.overlay').forEach((o) => { o.style.display = 'none'; });
  }

  function back() {
    pending = null;
    hideAll();
    const home = $('overlayHome');
    if (home) home.style.display = 'grid';
  }

  function confirm() {
    const cb = pending;
    pending = null;
    // The choice sticks for the session: the next match usually wants the same.
    window.MP_BOTS = state.bots;
    window.MP_TEAM_RULE = state.rule;
    if (state.mode === 'ctf') {
      // "Same team" seats you on blue, so a friend picking the same lands beside
      // you; "opposite teams" leaves it to the balancer, which splits you up.
      window.MP_TEAM = state.rule === 'same' ? 0 : null;
      const row = $('mpTeamRow');
      const btn = row && row.querySelector(`[data-team="${window.MP_TEAM == null ? 'auto' : window.MP_TEAM}"]`);
      if (btn) btn.click();
    }
    hideAll();
    const home = $('overlayHome');
    if (home) home.style.display = 'grid';
    if (cb) cb({ bots: state.bots, teamRule: state.rule });
  }

  function open(mode, onDone) {
    state.mode = ['pve', 'pvp', 'teams', 'ctf'].includes(mode) ? mode : 'pve';
    pending = onDone || null;
    // Start from whatever the host chose last time.
    if (typeof window.MP_BOTS === 'boolean') state.bots = window.MP_BOTS;
    if (window.MP_TEAM_RULE) state.rule = window.MP_TEAM_RULE;
    const title = $('modeOptsTitle');
    if (title) title.textContent = ({ pve: 'PvE setup', pvp: 'PvP setup', teams: 'Teams setup', ctf: 'Capture the Flag setup' })[state.mode];
    const teams = $('modeOptsTeams');
    if (teams) teams.style.display = state.mode === 'ctf' ? 'flex' : 'none';
    hideAll();
    const ov = $('overlayModeOpts');
    if (ov) ov.style.display = 'grid';
    paint();
  }

  const botsRow = $('modeOptsBots');
  if (botsRow) botsRow.addEventListener('click', (e) => {
    const b = e.target.closest('[data-bots]');
    if (!b) return;
    state.bots = b.dataset.bots === '1';
    paint();
  });

  const teamsRow = $('modeOptsTeams');
  if (teamsRow) teamsRow.addEventListener('click', (e) => {
    const b = e.target.closest('[data-rule]');
    if (!b) return;
    state.rule = b.dataset.rule === 'same' ? 'same' : 'opposite';
    paint();
  });

  $('modeOptsConfirm')?.addEventListener('click', confirm);
  $('modeOptsBack')?.addEventListener('click', back);

  window.MPModeOpts = { open };
})();
