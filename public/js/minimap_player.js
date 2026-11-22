// ============================================================
// Monster Arena — the "you are here" marker on the minimap.
// A green ball with an arrow through it showing the direction you're facing.
// pve16.js owns the shared #mini canvas and its world→map transform and calls
// this at the end of drawMinimap(), so every mode (singleplayer, offline,
// Levels, Teams, CTF, online) gets the same marker.
// ============================================================
(function () {
  'use strict';

  /**
   * @param {CanvasRenderingContext2D} ctx  minimap context (CSS-pixel space)
   * @param {(x:number)=>number} tx         world x → map x
   * @param {(y:number)=>number} ty         world y → map y
   * @param {{x:number,y:number,angle?:number}} p  the local player
   */
  function MiniPlayerArrow(ctx, tx, ty, p) {
    if (!ctx || !p || typeof tx !== 'function' || typeof ty !== 'function') return;
    const x = tx(p.x), y = ty(p.y);
    if (!isFinite(x) || !isFinite(y)) return;
    const aim = (typeof p.angle === 'number' && isFinite(p.angle)) ? p.angle : 0;
    const GREEN = '#7dffa3';

    // the arrow: points along the aim direction, drawn under the ball
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(aim);
    ctx.fillStyle = GREEN;
    ctx.shadowColor = 'rgba(125,255,163,.9)';
    ctx.shadowBlur = 7;
    ctx.beginPath();
    ctx.moveTo(13, 0);
    ctx.lineTo(3.4, -5.4);
    ctx.lineTo(3.4, 5.4);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // the ball
    ctx.save();
    ctx.fillStyle = GREEN;
    ctx.strokeStyle = 'rgba(8,18,12,.95)';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.arc(x, y, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  window.MiniPlayerArrow = MiniPlayerArrow;
})();
