// ============================================================
// Monster Arena — GLOBAL CHAT.
// One channel for everyone who has the game open: it does not
// depend on being in a lobby, so players on the main menu, in a
// match or playing solo all read and write the same feed.
// Messages are stored in the app's own database and relayed by the
// page that hosts the game frame, so the channel needs no backend function.
//
// Every block marked .gc-feed / .gc-input is driven from here,
// so the same channel shows on the main menu, in the
// multiplayer hub and inside a match.
// ============================================================
(function () {
  'use strict';

  // The feed lives in the app's own database and is read for the game by the
  // page hosting the frame, so the channel needs no backend function at all.

  const feeds = Array.from(document.querySelectorAll('.gc-feed'));
  const inputs = Array.from(document.querySelectorAll('.gc-input'));
  const sends = Array.from(document.querySelectorAll('.gc-send'));

  let messages = [];

  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function myName() {
    try { return (localStorage.getItem('arenaNick') || 'Player').slice(0, 18); } catch (_) { return 'Player'; }
  }

  const toShell = (payload) => {
    if (window.parent === window) return false;
    window.parent.postMessage(payload, '*');
    return true;
  };

  function load() {
    toShell({ type: 'chat:load' });
  }

  window.addEventListener('message', (e) => {
    const d = e.data || {};
    if (d.type === 'chat:history' && Array.isArray(d.chat)) {
      messages = d.chat.slice(-60);
      render();
      return;
    }
    if (d.type === 'chat:msg' && d.line) {
      const line = d.line;
      const dup = messages.some((m) => m.t === line.t && m.name === line.name && m.text === line.text);
      if (dup) return;
      messages.push(line);
      if (messages.length > 60) messages = messages.slice(-60);
      render();
    }
  });

  function line(m) {
    const el = document.createElement('div');
    el.className = 'chat-line';
    const badge = (window.RankXP && m.rank) ? RankXP.badgeHTML(m.rank, 16) : '';
    el.innerHTML = badge + '<b>' + esc(m.name || 'Player') + '</b> ' + esc(m.text || '');
    return el;
  }

  function myRank() {
    try { return window.RankXP ? RankXP.level() : 0; } catch (_) { return 0; }
  }

  function render() {
    for (const feed of feeds) {
      const isHud = feed.classList.contains('gc-feed--hud');
      feed.innerHTML = '';
      for (const m of (isHud ? messages.slice(-7) : messages.slice(-60))) feed.appendChild(line(m));
      if (!isHud) feed.scrollTop = feed.scrollHeight;
    }
  }

  function send(text) {
    const body = String(text || '').trim();
    if (!body) return;
    toShell({ type: 'chat:send', text: body, name: myName(), rank: myRank() });
  }

  // The multiplayer hub's own Send button.
  for (const btn of sends) {
    btn.addEventListener('click', () => {
      const input = btn.parentElement && btn.parentElement.querySelector('.gc-input');
      if (input) { send(input.value); input.value = ''; }
    });
  }

  for (const input of inputs) {
    input.addEventListener('keydown', (e) => {
      // Typing must never reach the game's hotkeys.
      e.stopPropagation();
      if (e.key === 'Enter') { e.preventDefault(); send(input.value); input.value = ''; }
      if (e.key === 'Escape') {
        e.preventDefault();
        input.blur();
        const hud = document.getElementById('chatHud');
        if (hud) hud.style.display = 'none';
      }
    });
    input.addEventListener('keyup', (e) => e.stopPropagation());
    input.addEventListener('keypress', (e) => e.stopPropagation());
  }

  // ---- username tab -----------------------------------------------------
  // The name a player types here is the one the chat posts, the one a lobby
  // carries into a match, and the one floating above their fighter's head.
  const nameInput = document.getElementById('gcNameInput');
  const nameSave = document.getElementById('gcNameSave');
  const nameHint = document.getElementById('gcNameHint');
  const mpNick = document.getElementById('multiNick');

  function storedName() {
    try { return localStorage.getItem('arenaNick') || ''; } catch (_) { return ''; }
  }

  function saveName(raw) {
    const name = String(raw || '').trim().slice(0, 18) || 'Player';
    try { localStorage.setItem('arenaNick', name); } catch (_) {}
    if (nameInput) nameInput.value = name;
    if (mpNick) mpNick.value = name;
    if (window.Net && Net.setNickname) { try { Net.setNickname(name); } catch (_) {} }
    if (nameHint) nameHint.innerHTML = 'You are <b>' + esc(name) + '</b> — in chat and above your fighter.';
    try { window.dispatchEvent(new CustomEvent('arena:nick', { detail: { name: name } })); } catch (_) {}
  }

  const name0 = storedName();
  if (name0) {
    if (nameInput) nameInput.value = name0;
    if (mpNick && !mpNick.value) mpNick.value = name0;
    if (nameHint) nameHint.innerHTML = 'You are <b>' + esc(name0) + '</b> — in chat and above your fighter.';
  }

  // Tab switching inside the floating panel.
  const tabs = Array.from(document.querySelectorAll('.gc-tab'));
  const panes = Array.from(document.querySelectorAll('.gc-pane'));
  for (const tab of tabs) {
    tab.addEventListener('click', () => {
      const want = tab.dataset.gcTab;
      for (const t of tabs) t.classList.toggle('is-active', t === tab);
      for (const p of panes) p.hidden = p.dataset.gcPane !== want;
      if (want === 'name' && nameInput) nameInput.focus();
    });
  }

  // ---- minimise / restore -----------------------------------------------
  // The floating panel folds down to a small round icon (and back again), so
  // it stops covering the menu without losing the conversation.
  const homePanel = document.querySelector('.gc-home');
  const minBtn = document.getElementById('gcMinBtn');
  if (homePanel && minBtn) {
    const setMin = (on) => {
      homePanel.classList.toggle('is-min', on);
      minBtn.textContent = on ? '💬' : '–';
      minBtn.title = on ? 'Open chat' : 'Minimise chat';
      minBtn.setAttribute('aria-label', on ? 'Open chat' : 'Minimise chat');
    };
    minBtn.addEventListener('click', () => setMin(!homePanel.classList.contains('is-min')));
  }

  if (nameSave) nameSave.addEventListener('click', () => { saveName(nameInput ? nameInput.value : ''); });
  if (nameInput) {
    nameInput.addEventListener('keydown', (e) => {
      // Typing must never reach the game's hotkeys.
      e.stopPropagation();
      if (e.key === 'Enter') { e.preventDefault(); saveName(nameInput.value); nameInput.blur(); }
    });
    nameInput.addEventListener('keyup', (e) => e.stopPropagation());
    nameInput.addEventListener('keypress', (e) => e.stopPropagation());
  }

  load();

  window.GlobalChat = { send, load, saveName: saveName };
})();
