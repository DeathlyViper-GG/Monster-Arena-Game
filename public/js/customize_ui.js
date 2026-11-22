/* =====================================================================
   customize_ui.js — the Customise screen.

   Two rows of choice: a model (the orb's design, unlocked by best wave)
   and a colour (the shell's tint). Every card is a live, floating orb
   drawn with the original ball-skin art, and the big stage shows the
   chosen skin at size — exactly what the arena draws.

   The choice itself is owned by pve16 (window.ArenaCustomize), so saving,
   the session copy and the lobby sync are untouched.
   ===================================================================== */
(function (G) {
  'use strict';

  const el = (id) => document.getElementById(id);
  const TAU = Math.PI * 2;

  let raf = 0;
  let cards = [];
  let stage = { cv: null, ctx: null, design: 0, color: '#98d7ff' };

  function glow(c, cx, cy, r, color) {
    const g = c.createRadialGradient(cx, cy, 2, cx, cy, r);
    g.addColorStop(0, color + '55');
    g.addColorStop(1, '#0000');
    c.save();
    c.globalCompositeOperation = 'lighter';
    c.fillStyle = g;
    c.fillRect(cx - r, cy - r, r * 2, r * 2);
    c.restore();
  }

  function shadowBlob(c, cx, cy, rx) {
    c.save();
    c.globalAlpha = 0.4;
    c.fillStyle = '#000';
    c.beginPath(); c.ellipse(cx, cy, rx, rx * 0.26, 0, 0, TAU); c.fill();
    c.restore();
  }

  /* ------------------------------------------------------------ cards */
  function paintCard(card, t) {
    const c = card.ctx, W = card.canvas.width, H = card.canvas.height;
    c.clearRect(0, 0, W, H);
    const float = Math.sin(t * 1.6 + card.phase) * 5;
    const cx = W / 2, cy = H * 0.5;
    const r = W * 0.22;

    if (!card.unlocked) {
      c.save(); c.globalAlpha = 0.28;
      c.save(); c.translate(cx, cy); G.BallSkins.draw(c, card.id, '#5a6b8c', t, r); c.restore();
      c.restore();
      c.fillStyle = 'rgba(232,224,255,.92)';
      c.font = 'bold ' + Math.round(W * 0.26) + 'px system-ui,sans-serif';
      c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText('\uD83D\uDD12', cx, cy);
      return;
    }

    glow(c, cx, H * 0.8, W * 0.55, card.color);
    shadowBlob(c, cx, H * 0.82, W * 0.26);
    c.save();
    c.translate(cx, cy + float);
    G.BallSkins.draw(c, card.id, card.color, t, r);
    c.restore();
  }

  /* ------------------------------------------------------------ stage */
  function paintStage(t) {
    const cv = stage.cv;
    if (!cv || !cv.isConnected) return;
    const w = cv.clientWidth, h = cv.clientHeight;
    if (!w || !h) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const pw = Math.round(w * dpr), ph = Math.round(h * dpr);
    if (cv.width !== pw || cv.height !== ph) {
      cv.width = pw; cv.height = ph;
      stage.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    const c = stage.ctx;
    c.clearRect(0, 0, w, h);

    const cx = w / 2, cy = h * 0.47 + Math.sin(t * 1.6) * 4;
    const r = Math.min(w, h) * 0.20;
    glow(c, cx, h * 0.82, Math.min(w, h) * 0.55, stage.color);
    shadowBlob(c, cx, h * 0.84, Math.min(w, h) * 0.22);
    c.save();
    c.translate(cx, cy);
    G.BallSkins.draw(c, stage.design, stage.color, t, r);
    c.restore();
  }

  function tick(now) {
    const t = now / 1000;
    let alive = 0;
    if (stage.cv && stage.cv.isConnected && stage.cv.clientWidth) { paintStage(t); alive++; }
    for (let i = 0; i < cards.length; i++) {
      const card = cards[i];
      // A closed Customise panel has no layout, so nothing to paint — the loop
      // parks itself instead of burning frames behind a hidden overlay.
      if (!card.canvas.isConnected || !card.canvas.clientWidth) continue;
      alive++;
      paintCard(card, t);
    }
    raf = alive ? requestAnimationFrame(tick) : 0;
  }

  function startLoop() {
    if (!raf) raf = requestAnimationFrame(tick);
  }

  /* ------------------------------------------------------------ build */
  function build() {
    const S = G.ArenaCustomize && G.ArenaCustomize();
    if (!S || !G.BallSkins) return;
    const style = G.AvatarStyle;
    const models = style ? style.MODELS : [];
    const outfits = style ? style.CLOTHES : [];
    const outfitIdx = S.outfit | 0;
    const color = (outfits[outfitIdx] && outfits[outfitIdx].c) || '#98d7ff';

    /* ---- model cards ---- */
    const grid = el('skinGrid');
    if (grid) {
      grid.innerHTML = '';
      cards = [];
      (S.designs || []).forEach((d, di) => {
        const model = models[d.id] || { name: d.name, theme: '', blurb: '' };
        const unlocked = (S.best || 0) >= d.unlock;

        const card = document.createElement('div');
        card.className = 'skinCard' + (unlocked ? '' : ' locked') + (unlocked && S.design === d.id ? ' selected' : '');

        const icon = document.createElement('div');
        icon.className = 'skinIcon skinStage';
        const cv = document.createElement('canvas');
        cv.width = 120; cv.height = 120;
        icon.appendChild(cv);
        card.appendChild(icon);
        cards.push({ canvas: cv, ctx: cv.getContext('2d'), id: d.id, color, unlocked, phase: di * 0.7 });

        const name = document.createElement('div');
        name.className = 'skinName';
        name.textContent = unlocked ? model.name : ('\uD83D\uDD12 Unlock @ Wave ' + d.unlock);
        card.appendChild(name);

        const theme = document.createElement('div');
        theme.className = 'skinTheme';
        theme.textContent = unlocked ? (model.theme || '') : '';
        card.appendChild(theme);

        if (unlocked) card.onclick = () => S.setDesign(d.id);
        grid.appendChild(card);
      });
    }

    /* ---- outfit rail ---- */
    const row = el('clothesRow');
    if (row) {
      row.innerHTML = '';
      outfits.forEach((f, i) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'fitBtn' + (i === outfitIdx ? ' is-active' : '');
        b.innerHTML = '<span class="fitChip" style="background:' + f.c + ';box-shadow:0 0 9px ' + f.a + '99"></span>' +
          '<span class="fitName">' + f.name + '</span>';
        b.onclick = () => S.setOutfit(i);
        row.appendChild(b);
      });
    }

    /* ---- the live stage ---- */
    const model = style ? style.modelFor(S.design) : { name: '', theme: '', blurb: '' };
    const tag = el('avPreviewTag');
    if (tag) tag.textContent = model.name || '';
    const hint = el('avHint');
    if (hint) hint.style.display = 'none';       // the flat orb does not turn
    const meta = el('avPreviewMeta');
    if (meta) meta.textContent = model.blurb ? ((model.theme ? model.theme.toUpperCase() + ' \u00b7 ' : '') + model.blurb) : '';

    const cv = el('avPreview');
    if (cv) {
      stage = { cv, ctx: cv.getContext('2d'), design: S.design | 0, color };
    }

    startLoop();
  }

  G.CustomizeUI = { build };
})(window);
