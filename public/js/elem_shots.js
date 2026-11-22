// ============================================================
// Monster Arena — ELEMENTAL SHOT SHAPES (2D fallback renderer)
// The 3D renderer builds each elemental cast out of real geometry (see
// render3d_fx.js). When WebGL is unavailable the same casts are drawn here as
// solid shapes rather than plain dots: a molten boulder with a flame wake, a
// forked bolt, a frozen spike, a tumbling rock and a wisp with a curling tail.
// Bullets already carry `elem`, so this only ever decorates them.
// Exposes window.ElemShots.
// ============================================================
(function () {
  'use strict';

  function draw2D(ctx, b, rad, bx, by) {
    const ang = Math.atan2(b.vy || 0, b.vx || 1);
    const now = performance.now();
    const col = b.glyphColor || '#ffadad';

    ctx.save();
    ctx.translate(bx, by);
    ctx.rotate(ang);
    ctx.shadowBlur = rad * 3;
    ctx.shadowColor = col;
    ctx.fillStyle = col;

    if (b.elem === 'lightning') {
      // A forked bolt dragged behind the charge, with a white-hot core.
      ctx.strokeStyle = col;
      ctx.lineWidth = Math.max(2, rad);
      ctx.beginPath();
      ctx.moveTo(-rad * 7, 0);
      for (let i = 1; i <= 5; i++) {
        const u = i / 5;
        ctx.lineTo(-rad * 7 * (1 - u), Math.sin(now / 40 + i * 2.1) * rad * 1.6);
      }
      ctx.stroke();
      ctx.shadowBlur = rad * 4;
      ctx.fillStyle = '#eaf6ff';
      ctx.beginPath(); ctx.arc(0, 0, rad * 0.9, 0, Math.PI * 2); ctx.fill();

    } else if (b.elem === 'water') {
      // A wobbling globe of water with a bright core and droplets trailing it —
      // round and slow, never a spike.
      const wob = 1 + 0.08 * Math.sin(now / 90 + bx);
      ctx.globalAlpha = 0.85;
      ctx.beginPath(); ctx.arc(0, 0, rad * 1.9 * wob, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = 'rgba(225,248,255,.9)';
      ctx.beginPath(); ctx.arc(0, 0, rad * 0.85, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 0.55;
      ctx.fillStyle = col;
      for (let i = 1; i <= 2; i++) {
        ctx.beginPath();
        ctx.arc(-rad * 3 * i, Math.sin(now / 70 + i) * rad * 1.1, rad * (1.5 - i * 0.3), 0, Math.PI * 2);
        ctx.fill();
      }

    } else if (b.elem === 'earth') {
      // A tumbling chunk of rock, lit from one side.
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2, rr = rad * (0.85 + ((i * 7) % 5) * 0.08);
        const px = Math.cos(a) * rr, py = Math.sin(a) * rr;
        if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = 'rgba(0,0,0,.35)';
      ctx.beginPath(); ctx.arc(rad * 0.3, -rad * 0.2, rad * 0.35, 0, Math.PI * 2); ctx.fill();

    } else if (b.elem === 'spirit') {
      // A hollow violet wisp trailing a curling spectral tail.
      ctx.shadowBlur = rad * 5;
      ctx.beginPath(); ctx.arc(0, 0, rad * 1.2, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = col;
      ctx.lineWidth = rad * 0.9;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      for (let i = 1; i <= 4; i++) {
        const u = i / 4;
        ctx.lineTo(-rad * 5 * u, Math.sin(u * 6 + now / 120) * rad * 1.6 * u);
      }
      ctx.stroke();

    } else {
      // fire: a molten boulder trailing burning lumps behind it.
      ctx.beginPath();
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2, rr = rad * (0.9 + ((i * 5) % 4) * 0.1);
        const px = Math.cos(a) * rr, py = Math.sin(a) * rr;
        if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = 'rgba(255,240,180,.85)';
      ctx.beginPath(); ctx.arc(0, 0, rad * 0.45, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 0.5;
      ctx.fillStyle = '#ff8b2a';
      for (let i = 1; i <= 3; i++) {
        ctx.beginPath();
        ctx.arc(-rad * 1.6 * i, Math.sin(i * 1.7 + now / 90) * rad * 0.8, rad * (1.1 - i * 0.2), 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.restore();
    return b.elem;
  }

  window.ElemShots = { draw2D: draw2D };
})();
