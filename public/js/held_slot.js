/* =====================================================================
   held_slot.js — what is in your hands.

   The arena already draws the gun as a first-person viewmodel at the
   bottom of the screen. The equipped utility rides beside it, in the off
   hand, drawn by the very same pass (UtilityModels.drawView). One slot is
   "up" at a time:

     weapon  — the gun is raised, the utility is held low and to the left
     utility — the utility comes up, the gun dips out of frame

   Scroll the wheel (or two-finger scroll on a trackpad, or tap SWAP on a
   touch screen) to change slots. The trigger that is up does the work:
   click / tap FIRE to throw the utility, exactly like the gun fires.
   ===================================================================== */
(function (G) {
  'use strict';

  let slot = 0;            // 0 = weapon, 1 = utility
  let blend = 0;           // 0..1, smoothed — how far the utility has come up
  let lastB = 0, lastWheel = 0, lastHud = 0;

  const utilId = () => (G.Utilities && G.Utilities.equipped ? G.Utilities.equipped() : null);
  const running = () => !!(G.__pveMatchRunning && G.__pveMatchRunning());
  // the slots have no business sitting over a cinematic
  const cutscene = () => !!(G._CUTSCENE_ACTIVE || G._HOST_CINEMATIC || G.STAGE_CUTSCENE_ACTIVE || G._GAUNTLET_INTRO);
  const visible = () => running() && !cutscene();

  /* ------------------------------------------------------------- state */
  function setSlot(n) {
    slot = n ? 1 : 0;
    paintHud(true);
  }

  function toggle() { setSlot(slot ? 0 : 1); }

  // Smoothed slot blend, advanced once per frame by the renderer.
  function blendNow() {
    const t = performance.now() / 1000;
    const dt = lastB ? Math.min(.06, t - lastB) : 0;
    lastB = t;
    const target = (slot && utilId()) ? 1 : 0;
    blend += (target - blend) * (1 - Math.exp(-dt * 13));
    if (Math.abs(target - blend) < .002) blend = target;
    return blend;
  }

  // The click / tap was spent on the utility: the gun stays down. It winds the
  // throw up rather than throwing it — hold to aim, let go to throw.
  function fireUtil() {
    if (!slot || !utilId() || !running()) return false;
    if (G.UtilityGame && G.UtilityGame.aimStart) G.UtilityGame.aimStart();
    return true;
  }

  /* -------------------------------------------------------- viewmodel */
  // Called from the viewmodel pass (render3d_fx) with the inverse view
  // matrix, so the parts land in camera space beside the gun.
  function drawVM(R, vInv, c) {
    const id = utilId();
    if (!id || !G.UtilityModels || !G.UtilityModels.has(id)) return;
    const b = blendNow();
    // With the gun in hand nothing else is held — the utility only appears
    // once the wheel (or SWAP) has actually put it in the hands.
    if (b < .02) return;
    const tt = (c && c.tt) || performance.now() / 1000;
    const throwT = (G.UtilityGame && G.UtilityGame.throwT) || 0;
    const swing = throwT > 0 ? Math.sin((1 - throwT / 0.42) * Math.PI) : 0;
    const breathe = Math.sin(tt * 1.6) * .4 + Math.sin(tt * .7) * .55;
    const k = 1 - b;
    G.UtilityModels.drawView(R, id, vInv, {
      // rises from below the frame into both hands, centred like a weapon
      x: -1.0 - k * 5.2 + Math.sin(tt * 1.1) * .2,
      y: -5.2 - k * 6.4 + breathe * .4 - swing * 1.4,
      z: -13.4 - k * 2.2 - swing * 4.6,
      yaw: -1.34 + Math.sin(tt * .9) * .03,
      pitch: -.16 - swing * .5,
      roll: .10 + Math.sin(tt * 1.3) * .02,
      scale: .34 - k * .06,
      boost: 1 + b * .4
    });
  }

  /* -------------------------------------------------------------- HUD */
  function injectCSS() {
    if (document.getElementById('slotBarCss')) return;
    const s = document.createElement('style');
    s.id = 'slotBarCss';
    s.textContent = `
#slotBar{position:fixed;left:18px;bottom:16px;z-index:7;display:flex;gap:9px;
  pointer-events:auto;font-family:system-ui,-apple-system,'Segoe UI',sans-serif;transition:opacity .2s ease}
#slotBar .slotCard{display:flex;align-items:center;gap:9px;padding:7px 14px 7px 9px;border-radius:12px;
  cursor:pointer;
  background:linear-gradient(180deg,rgba(16,12,28,.84),rgba(8,6,16,.88));
  border:1px solid rgba(120,90,200,.34);color:#b9b2e0;opacity:.58;
  box-shadow:0 6px 18px rgba(0,0,0,.45);
  transition:border-color .18s ease,box-shadow .18s ease,transform .18s ease,opacity .18s ease}
#slotBar .slotKey{display:grid;place-items:center;width:19px;height:19px;border-radius:6px;flex:0 0 auto;
  font-size:11px;font-weight:900;color:#cfe1ff;
  background:rgba(255,255,255,.07);border:1px solid rgba(180,220,255,.2)}
#slotBar .slotTxt{display:flex;flex-direction:column;gap:2px;min-width:0}
#slotBar .slotTxt b{font-size:12px;font-weight:800;color:#e8e0ff;letter-spacing:.02em;
  white-space:nowrap;max-width:150px;overflow:hidden;text-overflow:ellipsis}
#slotBar .slotTxt i{font-style:normal;font-size:8.5px;letter-spacing:.14em;text-transform:uppercase;opacity:.72}
#slotBar .slotCard.isOn{opacity:1;transform:translateY(-3px);border-color:rgba(160,110,255,.9);
  box-shadow:0 8px 24px rgba(0,0,0,.5),0 0 22px rgba(160,90,255,.42),inset 0 0 14px rgba(120,180,255,.16)}
#slotBar #slotU.isOn{border-color:rgba(0,240,255,.85);
  box-shadow:0 8px 24px rgba(0,0,0,.5),0 0 22px rgba(0,240,255,.38),inset 0 0 14px rgba(0,240,255,.16)}
#slotBar .slotCard.isOn .slotKey{background:linear-gradient(180deg,#c066ff,#5ad2ff);color:#0a0a14;border-color:transparent}
#slotHint{position:fixed;left:18px;bottom:2px;z-index:7;pointer-events:none;text-align:left;
  font:600 9.5px/1 system-ui,sans-serif;letter-spacing:.14em;text-transform:uppercase;color:rgba(180,200,235,.42)}
@media (max-width:900px){
  #slotBar{left:8px;bottom:74px;transform:scale(.86);transform-origin:bottom left}
  #slotHint{display:none}
  .mobile-actions{max-width:96vw;flex-wrap:wrap;justify-content:center;gap:6px}
  .mobile-actions .mob-btn{padding:9px 10px;font-size:11.5px}
}`;
    document.head.appendChild(s);
  }

  function buildHud() {
    if (document.getElementById('slotBar')) return;
    injectCSS();
    const bar = document.createElement('div');
    bar.id = 'slotBar';
    bar.innerHTML =
      '<div class="slotCard" id="slotW"><span class="slotKey">1</span>' +
        '<span class="slotTxt"><b id="slotWName">Weapon</b><i>weapon</i></span></div>' +
      '<div class="slotCard" id="slotU"><span class="slotKey">2</span>' +
        '<span class="slotTxt"><b id="slotUName">Utility</b><i id="slotUNote">empty</i></span></div>';
    document.body.appendChild(bar);
    // Tapping a slot is the touch-friendly way to switch, and a mouse can use
    // it too — the wheel is only there for keyboards.
    const wCard = document.getElementById('slotW');
    const uCard = document.getElementById('slotU');
    if (wCard) wCard.addEventListener('click', (e) => { e.preventDefault(); setSlot(0); });
    if (uCard) uCard.addEventListener('click', (e) => { e.preventDefault(); setSlot(1); });
    const hint = document.createElement('div');
    hint.id = 'slotHint';
    hint.textContent = 'scroll to switch · hold fire to aim · release to throw';
    document.body.appendChild(hint);
  }

  function paintHud(force) {
    const bar = document.getElementById('slotBar');
    if (!bar) return;
    const now = performance.now();
    if (!force && now - lastHud < 220) return;
    lastHud = now;

    const live = visible();
    bar.style.display = live ? 'flex' : 'none';
    const hint = document.getElementById('slotHint');
    if (hint) hint.style.display = live ? 'block' : 'none';
    if (!live) return;

    // the weapon name is already tracked by the game's own HUD chip
    const wSrc = document.getElementById('weaponName');
    const wEl = document.getElementById('slotWName');
    if (wSrc && wEl) {
      const t = (wSrc.textContent || 'Weapon').trim() || 'Weapon';
      if (wEl.textContent !== t) wEl.textContent = t;
    }

    const id = utilId();
    const def = id && G.Utilities && G.Utilities.BY_ID ? G.Utilities.BY_ID[id] : null;
    const uEl = document.getElementById('slotUName');
    const nEl = document.getElementById('slotUNote');
    const name = def ? def.name : 'No utility';
    if (uEl && uEl.textContent !== name) uEl.textContent = name;
    const left = G.UtilityGame ? Math.ceil(G.UtilityGame.reload || 0) : 0;
    const note = def ? (left > 0 ? left + 's reload' : 'ready') : 'pick one in Customize';
    if (nEl && nEl.textContent !== note) nEl.textContent = note;

    const wCard = document.getElementById('slotW');
    const uCard = document.getElementById('slotU');
    const utilOn = slot === 1 && !!def;
    if (wCard) wCard.classList.toggle('isOn', !utilOn);
    if (uCard) uCard.classList.toggle('isOn', utilOn);
  }

  /* ------------------------------------------------------------ input */
  // Wheel / trackpad scroll: down brings the utility up, up puts it away.
  G.addEventListener('wheel', (e) => {
    if (!running()) return;
    if (e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
    // only in first person — third person keeps the wheel for camera zoom
    const R = G.Render3D;
    if (!R || !R.isTps || !R.cam || !R.cam.fp) return;
    // a menu sitting on top of the match owns its own scrolling
    const ov = document.querySelectorAll('.overlay');
    for (let i = 0; i < ov.length; i++) {
      if (ov[i].id === 'overlayBoot') continue;
      if (getComputedStyle(ov[i]).display !== 'none') return;
    }
    e.preventDefault();
    const t = performance.now();
    if (t - lastWheel < 150) return;
    lastWheel = t;
    setSlot(e.deltaY > 0 ? 1 : 0);
  }, { passive: false });

  function init() {
    buildHud();
    // the touch swap button lives with the other mobile actions
    const swap = document.getElementById('btnSlot');
    if (swap) {
      const hit = (e) => { e.preventDefault(); toggle(); };
      swap.addEventListener('touchstart', hit, { passive: false });
      swap.addEventListener('click', hit);
    }
    setInterval(() => paintHud(false), 250);
    paintHud(true);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  G.HeldSlot = {
    toggle, setSlot, fireUtil, drawVM,
    blend: blendNow,
    isUtil: () => slot === 1,
    slot: () => slot
  };
})(window);
