/* =====================================================================
   ball_skins.js — the original orb skins, drawn in 2D.

   This is the art the Customise screen used before the human models
   arrived: one flat, glowing ball per design, its effect wrapping the
   shell. The arena keeps drawing the same designs in 3D (avatar_model.js),
   so what the menu shows is what walks into the match.
   ===================================================================== */
(function (G) {
  'use strict';

  const TAU = Math.PI * 2;

  /* ------------------------------------------------------------- wings */
  function featherWing(l, d, c) {
    c.strokeStyle = d; c.lineWidth = 2; c.fillStyle = l;
    c.beginPath(); c.ellipse(-20, -2, 28, 14, -0.1, 0, TAU); c.fill(); c.stroke();
    c.beginPath(); c.ellipse(-34, -6, 22, 10, -0.15, 0, TAU); c.fill(); c.stroke();
  }
  function bladeWing(g, c) {
    c.strokeStyle = g; c.lineWidth = 3;
    c.beginPath(); c.moveTo(-10, 0); c.lineTo(-42, -12); c.lineTo(-46, -4); c.lineTo(-14, 6); c.closePath(); c.stroke();
  }
  function shadowWing(g, c) {
    c.fillStyle = 'rgba(160,110,255,0.28)';
    c.beginPath(); c.ellipse(-26, -4, 26, 16, -0.2, 0, TAU); c.fill();
  }
  function flameWing(col, c) {
    const g = c.createLinearGradient(-40, 0, -10, 0);
    g.addColorStop(0, '#0000'); g.addColorStop(1, col);
    c.fillStyle = g;
    c.beginPath(); c.moveTo(-10, 0); c.quadraticCurveTo(-38, -10, -44, -2); c.quadraticCurveTo(-30, 12, -10, 4); c.fill();
  }
  function insectWing(col, c) {
    c.strokeStyle = col; c.globalAlpha = 0.6;
    c.beginPath(); c.ellipse(-24, -2, 24, 12, -0.1, 0, TAU); c.stroke();
    c.globalAlpha = 1;
  }

  function drawWing(type, t, c) {
    c.save();
    const flap = Math.sin(t * 6) * 0.25;
    if (type === 'angel') { c.rotate(-0.6 + flap); featherWing('#eef', '#ccd', c); c.rotate(1.2 - 2 * flap); featherWing('#eef', '#ccd', c); }
    else if (type === 'cyber') { c.rotate(-0.5 + flap * 0.6); bladeWing('#9cf', c); c.rotate(1.0 - flap * 1.2); bladeWing('#9cf', c); }
    else if (type === 'void') { c.rotate(-0.55 + flap * 0.4); shadowWing('#a6f', c); c.rotate(1.1 - flap * 0.8); shadowWing('#a6f', c); }
    else if (type === 'fire') { c.rotate(-0.55 + flap * 0.5); flameWing('#ff9a3c', c); c.rotate(1.1 - flap * 1.0); flameWing('#ff9a3c', c); }
    else if (type === 'insect') { c.rotate(-0.35 + flap * 1.2); insectWing('#aef', c); c.rotate(0.7 - flap * 2.4); insectWing('#aef', c); }
    c.restore();
  }

  /* -------------------------------------------------------- the shell */
  // draw(ctx, designId, bodyColor, time, radius) — centred on 0,0.
  function draw(c, designId, bodyColor, t, r) {
    c.fillStyle = bodyColor;
    c.beginPath(); c.arc(0, 0, r, 0, TAU); c.fill();
    switch (designId) {
      case 0:
        c.strokeStyle = bodyColor + 'aa'; c.lineWidth = 2;
        c.beginPath(); c.arc(0, 0, r + 3 + Math.sin(t * 4), 0, TAU); c.stroke();
        break;
      case 1:
        c.strokeStyle = '#ff6478aa'; c.lineWidth = 3;
        for (let i = 0; i < 10; i++) {
          const a = i * (TAU / 10) + t * 1.2;
          c.beginPath(); c.moveTo(Math.cos(a) * (r + 2), Math.sin(a) * (r + 2));
          c.lineTo(Math.cos(a) * (r + 10), Math.sin(a) * (r + 10)); c.stroke();
        }
        break;
      case 2:
        c.fillStyle = '#1b1120aa';
        for (let i = 0; i < 8; i++) {
          const a = i * (TAU / 8) + t * 1.5;
          c.beginPath(); c.moveTo(0, 0);
          c.lineTo(Math.cos(a) * (r + 2), Math.sin(a) * (r + 2));
          c.lineTo(Math.cos(a + 0.2) * (r + 6), Math.sin(a + 0.2) * (r + 6)); c.fill();
        }
        break;
      case 3:
        c.strokeStyle = '#5b7faaaa'; c.lineWidth = 2;
        for (let i = 0; i < 6; i++) {
          const a = i * (TAU / 6) + t * 0.6;
          c.beginPath();
          for (let j = 0; j < 6; j++) {
            const aa = a + j * (TAU / 6), rr = r + 6;
            const x = Math.cos(aa) * rr, y = Math.sin(aa) * rr;
            if (j === 0) c.moveTo(x, y); else c.lineTo(x, y);
          }
          c.closePath(); c.stroke();
        }
        break;
      case 4:
        c.strokeStyle = '#9cf'; c.lineWidth = 3;
        c.beginPath(); c.arc(0, 0, r + 10, t, t + Math.PI * 1.4); c.stroke();
        break;
      case 5:
        c.fillStyle = 'rgba(192,102,255,0.28)';
        for (let i = 0; i < 12; i++) {
          const a = i * (TAU / 12) + Math.sin(t * 2) * 0.2;
          c.beginPath();
          c.ellipse(Math.cos(a) * (r + 2), Math.sin(a) * (r + 2), 6 + Math.sin(t * 4 + i) * 2, 12, a, 0, TAU);
          c.fill();
        }
        break;
      case 6:
        c.fillStyle = '#aef';
        for (let i = 0; i < 6; i++) {
          const a = i * (TAU / 6) + t * 1.0;
          c.save(); c.rotate(a);
          c.beginPath(); c.moveTo(r + 4, 0); c.lineTo(r + 14, -5); c.lineTo(r + 18, 0); c.lineTo(r + 14, 5);
          c.closePath(); c.fill(); c.restore();
        }
        break;
      case 7:
        c.strokeStyle = '#7dffa3'; c.lineWidth = 3;
        for (let i = 0; i < 3; i++) {
          const a = t * 2 + i * 2.09;
          c.beginPath(); c.moveTo(Math.cos(a) * r, Math.sin(a) * r);
          c.lineTo(Math.cos(a) * (r + 16), Math.sin(a) * (r + 16)); c.stroke();
        }
        break;
      case 8:
        c.fillStyle = '#ff9a3caa';
        for (const s of [-1, 1]) {
          c.beginPath(); c.ellipse(s * (r + 4), -6, 6, 10, 0.3 * s, 0, TAU); c.fill();
        }
        break;
      case 9:
        c.fillStyle = '#e8eefb';
        for (let i = 0; i < 3; i++) {
          const a = t * 3 + i * (TAU / 3);
          c.save(); c.rotate(a); c.fillRect(r * 0.2, -3, 18, 6); c.restore();
        }
        break;
      case 10: drawWing('angel', t, c); break;
      case 11: drawWing('cyber', t, c); break;
      case 12: drawWing('void', t, c); break;
      case 13: drawWing('fire', t, c); break;
      case 14: drawWing('insect', t, c); break;
    }
  }

  G.BallSkins = { draw };
})(window);
