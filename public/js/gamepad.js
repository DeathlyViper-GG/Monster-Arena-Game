/* =====================================================================
   gamepad.js — controller support.

   Reads the first connected gamepad each frame and drives the SAME inputs
   the keyboard and the touch sticks already use, so nothing else in the
   engine has to know a pad exists:

     • left stick   → movement   (input.pad.x / .y)
     • right stick  → aim        (input.pad.aimX / .aimY, .on)
     • RT           → fire       (input.pad.fire)
     • A / B / X / Y / LB / RB / Start / D-pad  → the same actions as the
       keys they stand in for, dispatched as real key events.

   Any standard-mapped pad works (Xbox, PlayStation, Switch Pro, generic).
   ===================================================================== */
(function (G) {
  'use strict';

  const DEAD = .26;                 // stick dead zone
  const B = { A: 0, BB: 1, X: 2, Y: 3, LB: 4, RB: 5, LT: 6, RT: 7, BACK: 8, START: 9, DUP: 12, DDOWN: 13 };

  let raf = 0, idx = -1, prev = [], toastEl = null, toastT = 0;
  const held = new Set();

  const inp = () => G.__arenaInput || null;

  function key(k, down) {
    window.dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup', { key: k, bubbles: true }));
  }
  // One action per press: the engine's handlers fire on keydown, so a held
  // button must not repeat.
  function press(k, on) {
    if (on) {
      if (held.has(k)) return;
      held.add(k); key(k, true);
    } else if (held.has(k)) {
      held.delete(k); key(k, false);
    }
  }
  function tap(k) { key(k, true); setTimeout(() => key(k, false), 0); }

  function note(text) {
    if (!toastEl) {
      toastEl = document.createElement('div');
      toastEl.id = 'padToast';
      toastEl.style.cssText = 'position:fixed;left:50%;bottom:64px;transform:translateX(-50%) translateY(10px);' +
        'z-index:60;padding:9px 16px;border-radius:12px;font:800 12px/1.4 system-ui,sans-serif;letter-spacing:.06em;' +
        'color:#eaf4ff;background:rgba(10,8,20,.92);border:1px solid rgba(160,110,255,.6);' +
        'box-shadow:0 8px 26px rgba(0,0,0,.55),0 0 18px rgba(160,90,255,.35);pointer-events:none;' +
        'opacity:0;transition:opacity .25s ease,transform .25s ease;text-align:center';
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = text;
    toastEl.style.opacity = '1';
    toastEl.style.transform = 'translateX(-50%) translateY(0)';
    clearTimeout(toastT);
    toastT = setTimeout(() => {
      toastEl.style.opacity = '0';
      toastEl.style.transform = 'translateX(-50%) translateY(10px)';
    }, 2600);
  }

  const dz = (v) => {
    const a = Math.abs(v || 0);
    return a < DEAD ? 0 : Math.sign(v) * ((a - DEAD) / (1 - DEAD));
  };
  const btn = (pad, i) => !!(pad.buttons[i] && pad.buttons[i].pressed);
  const down = (pad, i) => { const on = btn(pad, i), was = !!prev[i]; prev[i] = on; return on && !was; };

  function rumble(pad, strength) {
    try {
      const act = pad.vibrationActuator;
      if (act && act.playEffect) {
        act.playEffect('dual-rumble', { duration: 90, strongMagnitude: strength, weakMagnitude: strength * .5 });
      }
    } catch (_) {}
  }

  function frame() {
    raf = requestAnimationFrame(frame);
    const pads = navigator.getGamepads ? navigator.getGamepads() : null;
    if (!pads) return;
    let pad = idx >= 0 ? pads[idx] : null;
    if (!pad || !pad.connected) {
      pad = null;
      for (let i = 0; i < pads.length; i++) if (pads[i] && pads[i].connected) { pad = pads[i]; break; }
      if (!pad) return;
      idx = pad.index; prev = [];
    }

    const i = inp();
    if (i && i.pad) {
      i.pad.x = dz(pad.axes[0]);
      i.pad.y = dz(pad.axes[1]);
      const ax = dz(pad.axes[2] || 0), ay = dz(pad.axes[3] || 0);
      i.pad.aimX = ax; i.pad.aimY = ay;
      i.pad.on = Math.abs(ax) > 0.001 || Math.abs(ay) > 0.001;
      i.pad.fire = btn(pad, B.RT);
    }

    // fire — a light kick so the trigger feels connected
    if (down(pad, B.RT)) rumble(pad, .22);

    // movement / stance actions
    press(' ', down(pad, B.A));            // A — jump
    press('Shift', btn(pad, B.BB));        // B — slide (held = one dash, re-press to dash again)
    if (down(pad, B.X)) tap('r');          // X — reload
    if (down(pad, B.Y)) tap('f');          // Y — melee swing
    if (down(pad, B.LB)) tap('q');         // LB — draw / holster melee
    if (down(pad, B.RB)) tap('e');         // RB — switch weapon
    if (down(pad, B.DUP)) tap('v');        // D-pad up — cycle camera view
    if (down(pad, B.START)) tap('Escape'); // Start — pause
    if (down(pad, B.BACK)) tap('h');       // Back — handbook
  }

  function start() {
    if (raf) return;
    raf = requestAnimationFrame(frame);
  }

  window.addEventListener('gamepadconnected', (e) => {
    idx = e.gamepad.index;
    prev = [];
    note('🎮 Controller connected — ' + (e.gamepad.id || '').replace(/\s*\(.*$/, ''));
    start();
  });
  window.addEventListener('gamepaddisconnected', (e) => {
    if (e.gamepad.index === idx) { idx = -1; prev = []; }
    const i = inp();
    if (i && i.pad) { i.pad.x = i.pad.y = i.pad.aimX = i.pad.aimY = 0; i.pad.on = false; i.pad.fire = false; }
    held.forEach((k) => key(k, false));
    held.clear();
    note('Controller disconnected');
  });

  // A pad already plugged in when the page loaded never fires the connect
  // event, so poll once and take over if one is there.
  start();
  G.GamePad = { note };
})(window);
