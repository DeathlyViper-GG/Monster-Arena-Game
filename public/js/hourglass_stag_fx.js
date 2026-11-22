// ============================================================
// Monster Arena — THE HOURGLASS STAG: visual effects
// ------------------------------------------------------------------
// Every frame of the stag and of its eight hours is drawn here, so
// the fight reads as a warden and not as a ring of coloured circles:
//   * Rimefall .......... frost sigils that break open into ice spires
//   * Glasshorn Charge .. a marked lane, then a horned run down it
//   * Frozen Reprise .... three pale echoes running old lanes
//   * Crevasse Wave ..... a fracture racing out, spires along its seam
//   * Stolen Second ..... two sigils: where you stand, where you were going
//   * Shardstorm ........ a closing ring of glass with one moving gap
//   * Everfrost ......... impacts that leave sheets of frost behind
//   * The Same Beginning  the old lanes, then the one aimed at you now
//
// Two renderers: draw3D (WebGL, the real client) and draw2D (fallback).
// ============================================================
(function () {
  'use strict';

  const TAU = Math.PI * 2;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const wrap = (a) => ((a % TAU) + TAU) % TAU;

  // ---- the stag's art ----------------------------------------------------
  // Drop the finished sprite at this path and it takes over the moment it
  // loads. Until then the veil art stands in, so the warden always reads as
  // a creature rather than as geometry.
  const SPRITE_SRC = 'assets/boss/hourglass_stag.png?v=2';
  const SPRITE_FALLBACK = 'assets/boss/hollow_veil.png?v=1';
  const img = new Image();
  let imgReady = false;
  img.crossOrigin = 'anonymous';
  img.onload = () => { imgReady = true; };
  img.onerror = () => {
    if (img.dataset && img.dataset.fell) return;
    try { img.dataset.fell = '1'; } catch (_) {}
    img.src = SPRITE_FALLBACK;
  };
  img.src = SPRITE_SRC;

  const rad = (e) => e.r || 44;
  const stageOf = (e) => (e._hs && e._hs.stage) || 1;
  const curOf = (e) => (e._hs && e._hs.cur) || null;
  const dq = (R, n) => ((R && R.q && R.q.parts < 0.7) ? Math.max(2, Math.round(n * 0.6)) : n);

  // =========================================================================
  //  2D  RENDERER
  // =========================================================================
  function glowCircle(ctx, x, y, r, inner, outer) {
    const g = ctx.createRadialGradient(x, y, 1, x, y, Math.max(2, r));
    g.addColorStop(0, inner);
    g.addColorStop(1, outer);
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x, y, Math.max(2, r), 0, TAU); ctx.fill();
  }

  function sigil2(ctx, x, y, r, spin, col, alpha) {
    if (r < 2) return;
    if (window.SentinelFX) { window.SentinelFX.frost2(ctx, x, y, r * 0.5, alpha, spin, spin); return; }
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = clamp(alpha, 0, 1);
    for (let k = 0; k < 3; k++) {
      const rr = r * (1 - k * 0.28);
      ctx.strokeStyle = k === 0 ? col : 'rgba(220,245,255,0.85)';
      ctx.lineWidth = k === 0 ? 2.4 : 1.6;
      ctx.setLineDash([Math.max(5, rr * 0.22), Math.max(4, rr * 0.16)]);
      ctx.lineDashOffset = spin * (k % 2 ? -1 : 1) * rr * 0.6;
      ctx.beginPath(); ctx.arc(x, y, rr, 0, TAU); ctx.stroke();
    }
    ctx.setLineDash([]);
    ctx.restore();
  }

  // the body used only until the sprite arrives
  function body2(ctx, e, t) {
    const rr = rad(e);
    const sway = Math.sin(t * 0.9) * 0.05;
    ctx.save();
    ctx.translate(0, Math.sin(t * 1.3) * 1.6);
    ctx.rotate(sway);
    const s = rr / 44;
    ctx.lineCap = 'round';
    // legs
    ctx.strokeStyle = '#dfeaf1';
    ctx.lineWidth = 4 * s;
    for (let i = 0; i < 4; i++) {
      const bx = (-0.45 + i * 0.3) * rr;
      ctx.beginPath();
      ctx.moveTo(bx, rr * 0.15);
      ctx.lineTo(bx + (i % 2 ? 0.06 : -0.06) * rr, rr * 0.86);
      ctx.stroke();
    }
    // barrel
    const bg = ctx.createLinearGradient(-rr, -rr * 0.4, rr, rr * 0.5);
    bg.addColorStop(0, '#eef4f8');
    bg.addColorStop(0.55, '#c9dbe6');
    bg.addColorStop(1, '#8ba4b4');
    ctx.fillStyle = bg;
    ctx.beginPath(); ctx.ellipse(0, -rr * 0.1, rr * 0.62, rr * 0.4, 0, 0, TAU); ctx.fill();
    // neck + head
    ctx.strokeStyle = '#dfeaf1';
    ctx.lineWidth = 9 * s;
    ctx.beginPath(); ctx.moveTo(rr * 0.4, -rr * 0.22); ctx.lineTo(rr * 0.74, -rr * 0.72); ctx.stroke();
    ctx.save();
    ctx.translate(rr * 0.82, -rr * 0.82);
    ctx.rotate(-0.26);
    ctx.fillStyle = '#eef4f8';
    ctx.beginPath(); ctx.ellipse(0, 0, rr * 0.26, rr * 0.15, 0, 0, TAU); ctx.fill();
    // the burning eye
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    glowCircle(ctx, rr * 0.12, -rr * 0.04, rr * 0.16, 'rgba(190,240,255,0.95)', 'rgba(120,200,255,0)');
    ctx.restore();
    ctx.restore();
    // antlers: hourglasses on beams
    for (const side of [-1, 1]) {
      ctx.strokeStyle = '#cfe2ec';
      ctx.lineWidth = 3 * s;
      ctx.beginPath();
      ctx.moveTo(rr * 0.72, -rr * 0.92);
      ctx.quadraticCurveTo(rr * (0.6 + side * 0.28), -rr * 1.3, rr * (0.5 + side * 0.5), -rr * 1.5);
      ctx.stroke();
      for (let i = 0; i < 3; i++) {
        const hx = rr * (0.5 + side * (0.34 + i * 0.16));
        const hy = -rr * (1.28 + i * 0.24);
        const hs = rr * (0.13 + i * 0.02);
        ctx.save();
        ctx.translate(hx, hy);
        ctx.rotate(side * 0.3);
        ctx.fillStyle = 'rgba(200,240,255,0.5)';
        ctx.strokeStyle = '#bfe9ff';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(-hs, -hs * 1.6); ctx.lineTo(hs, -hs * 1.6);
        ctx.lineTo(hs * 0.2, 0); ctx.lineTo(hs, hs * 1.6);
        ctx.lineTo(-hs, hs * 1.6); ctx.lineTo(-hs * 0.2, 0);
        ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        glowCircle(ctx, 0, hs * 0.6, hs * 1.5, 'rgba(255,236,190,0.9)', 'rgba(255,220,150,0)');
        ctx.restore();
        ctx.restore();
      }
    }
    ctx.restore();
  }

  // the fallback renderer's own per-stage body effects
  function stageAura2D(ctx, cx, cy, rr, t, stage) {
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    if (stage <= 1) {
      for (let i = 0; i < 7; i++) {
        const p = (t * 0.35 + i * 0.14) % 1;
        const a = i * 1.9 + t * 0.15;
        ctx.fillStyle = 'rgba(200,235,255,' + (0.5 * (1 - p)) + ')';
        ctx.beginPath();
        ctx.arc(cx + Math.cos(a) * rr * 0.75, cy - rr * 0.9 + p * rr * 1.7, 1.6 + (1 - p), 0, TAU);
        ctx.fill();
      }
    } else if (stage === 2) {
      for (let i = 0; i < 9; i++) {
        const p = (t * 0.7 + i * 0.11) % 1;
        const a = i * 2.4 + t * 0.6;
        ctx.fillStyle = 'rgba(255,235,190,' + (0.7 * (1 - p)) + ')';
        ctx.beginPath();
        ctx.arc(cx + Math.cos(a) * rr * 0.5 * (1 - p * 0.6), cy - rr * 0.7 - p * rr * 1.2, 2.4 * (1 - p) + 0.7, 0, TAU);
        ctx.fill();
      }
    } else if (stage === 3) {
      for (let i = 0; i < 8; i++) {
        const a = t * 0.9 + (i / 8) * TAU;
        const sx = cx + Math.cos(a) * rr * 1.15, sy = cy + Math.sin(a) * rr * 0.8;
        ctx.strokeStyle = 'rgba(210,240,255,0.85)';
        ctx.lineWidth = 1.6;
        ctx.beginPath(); ctx.moveTo(sx - 4, sy - 7); ctx.lineTo(sx + 4, sy + 7); ctx.stroke();
      }
      for (let i = 0; i < 6; i++) {
        const p = (t * 1.1 + i * 0.17) % 1;
        ctx.fillStyle = 'rgba(255,236,195,' + (0.6 * (1 - p)) + ')';
        ctx.beginPath();
        ctx.arc(cx + Math.sin(i + t) * rr * 0.4, cy - rr * 0.6 - p * rr * 1.4, 2.2, 0, TAU);
        ctx.fill();
      }
    } else {
      for (let i = 0; i < 3; i++) {
        const k = (t * 0.5 + i / 3) % 1;
        ctx.strokeStyle = 'rgba(225,245,255,' + (0.5 * (1 - k)) + ')';
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(cx, cy, rr * (2.6 - k * 1.9), 0, TAU); ctx.stroke();
      }
      for (let i = 0; i < 10; i++) {
        const p = (t * 0.9 + i * 0.1) % 1;
        const a = i * 2.1;
        ctx.fillStyle = 'rgba(255,240,200,' + (0.6 * (1 - p)) + ')';
        ctx.beginPath();
        ctx.arc(cx + Math.cos(a) * rr * (0.4 + p * 1.1), cy + Math.sin(a) * rr * (0.4 + p * 0.9), 2.6 * (1 - p), 0, TAU);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  function draw2D(e, ctx, cx, cy, t, env) {
    if (!ctx) return;
    const rr = rad(e);
    const stage = stageOf(e);
    const hs = e._hs || {};
    const cam = env && env.cam;

    // ground shadow
    ctx.fillStyle = 'rgba(0,0,0,.42)';
    ctx.beginPath(); ctx.ellipse(cx, cy + rr * 0.78, rr * 1.02, rr * 0.42, 0, 0, TAU); ctx.fill();

    // the cold it carries
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    const auraR = rr * (1.7 + stage * 0.16);
    glowCircle(ctx, cx, cy, auraR, 'rgba(190,233,255,' + (0.16 + stage * 0.03) + ')', 'rgba(120,190,240,0)');
    ctx.restore();

    // body
    ctx.save(); ctx.translate(cx, cy);
    if (imgReady && img.width) {
      const w = rr * 3.0, h = w * (img.height / Math.max(1, img.width));
      ctx.drawImage(img, -w / 2, -h / 2, w, h);
    } else {
      body2(ctx, e, t);
    }
    if (hs.hitFlash > 0) {
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      ctx.globalAlpha = hs.hitFlash;
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(0, 0, rr, 0, TAU); ctx.fill();
      ctx.restore();
    }
    ctx.restore();

    stageAura2D(ctx, cx, cy, rr, t, stage);

    // attack telegraphs
    const cur = curOf(e);
    if (cur && cam) telegraph2D(ctx, cur, t, cam, rr);

    if (hs.phaseAnim) {
      const pa = hs.phaseAnim;
      const p = clamp(pa.t / pa.dur, 0, 1), fade = 1 - p;
      ctx.save(); ctx.globalCompositeOperation = 'screen';
      const ringR = rr + p * 540;
      ctx.strokeStyle = 'rgba(220,245,255,' + (0.9 * fade) + ')';
      ctx.lineWidth = 11 * fade + 2;
      ctx.beginPath(); ctx.arc(cx, cy, ringR, 0, TAU); ctx.stroke();
      ctx.strokeStyle = 'rgba(190,233,255,' + (0.7 * fade) + ')';
      ctx.lineWidth = 5 * fade + 1;
      ctx.beginPath(); ctx.arc(cx, cy, ringR * 0.76, 0, TAU); ctx.stroke();
      glowCircle(ctx, cx, cy, rr * 2.4, 'rgba(235,250,255,' + (0.6 * fade) + ')', 'rgba(150,220,255,0)');
      ctx.restore();
    }

    // hp ring
    const hpR = Math.max(0, (e.hp || 0) / Math.max(1, e.maxhp || e.hp || 1));
    ctx.strokeStyle = '#000a'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(cx, cy, rr + 8, 0, TAU); ctx.stroke();
    ctx.strokeStyle = '#bfe9ff'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(cx, cy, rr + 8, -Math.PI / 2, -Math.PI / 2 + hpR * TAU); ctx.stroke();
  }

  function telegraph2D(ctx, cur, t, cam, rr) {
    if (cur.phase !== 'tele' && cur.phase !== 'active') return;
    const sx = (x) => x - cam.x - cam.sx;
    const sy = (y) => y - cam.y - cam.sy;
    const active = cur.phase === 'active';
    const tp = cur.phase === 'tele' ? clamp(cur.t / cur.phases.tele, 0, 1) : 1;
    ctx.save();
    ctx.globalCompositeOperation = 'screen';

    if (cur.key === 'rimefall' && cur.zones) {
      for (const z of cur.zones) {
        const local = cur.t - z.fire;
        const up = active && local >= 0 && local < z.dur;
        const zx = sx(z.x), zy = sy(z.y);
        if (up) {
          const rise = clamp(local * 6, 0, 1);
          glowCircle(ctx, zx, zy, z.r * 1.1, 'rgba(230,250,255,' + (0.5 * (1 - local / z.dur)) + ')', 'rgba(150,220,255,0)');
          // spires
          for (let i = 0; i < 5; i++) {
            const a = i * 1.26 + z.seed;
            const hgt = z.r * (0.9 + 0.7 * rise) * (0.7 + 0.3 * Math.sin(t * 5 + i));
            ctx.strokeStyle = 'rgba(220,246,255,' + 0.9 * (1 - local / z.dur) + ')';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(zx + Math.cos(a) * z.r * 0.55, zy + Math.sin(a) * z.r * 0.3);
            ctx.lineTo(zx + Math.cos(a) * z.r * 0.18, zy - hgt * 0.55);
            ctx.stroke();
          }
        } else if (!active || local < 0) {
          sigil2(ctx, zx, zy, z.r * (0.4 + 0.6 * tp), t * 1.6 + z.seed, 'rgba(191,233,255,0.95)', 0.55 + 0.35 * tp);
        }
      }
    } else if (cur.key === 'glasshornCharge') {
      const L = cur.len, w = cur.w;
      const dx = Math.cos(cur.ang), dy = Math.sin(cur.ang);
      const x0 = sx(cur.x0), y0 = sy(cur.y0);
      const nx = -dy, ny = dx;
      ctx.globalAlpha = active ? 0.85 : 0.4 + 0.4 * tp;
      ctx.fillStyle = active ? 'rgba(190,233,255,0.28)' : 'rgba(160,220,255,0.16)';
      ctx.beginPath();
      ctx.moveTo(x0 + nx * w / 2, y0 + ny * w / 2);
      ctx.lineTo(x0 + dx * L + nx * w / 2, y0 + dy * L + ny * w / 2);
      ctx.lineTo(x0 + dx * L - nx * w / 2, y0 + dy * L - ny * w / 2);
      ctx.lineTo(x0 - nx * w / 2, y0 - ny * w / 2);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = 'rgba(235,250,255,0.9)';
      ctx.lineWidth = 2;
      ctx.setLineDash([16, 10]); ctx.lineDashOffset = -t * 120;
      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x0 + dx * L, y0 + dy * L); ctx.stroke();
      ctx.setLineDash([]);
      if (cur.trail) {
        for (const s of cur.trail) {
          const a = clamp(s.life / 2.2, 0, 1);
          ctx.fillStyle = 'rgba(210,242,255,' + (0.35 * a) + ')';
          ctx.beginPath(); ctx.arc(sx(s.x), sy(s.y), s.r * 0.9, 0, TAU); ctx.fill();
          ctx.strokeStyle = 'rgba(255,255,255,' + (0.5 * a) + ')';
          ctx.lineWidth = 1.4;
          ctx.beginPath();
          ctx.moveTo(sx(s.x - s.r * 0.6), sy(s.y - s.r * 0.3));
          ctx.lineTo(sx(s.x + s.r * 0.4), sy(s.y + s.r * 0.5));
          ctx.stroke();
        }
      }
    } else if (cur.key === 'frozenReprise' && cur.lanes) {
      for (let i = 0; i < cur.lanes.length; i++) {
        const L = cur.lanes[i];
        const local = cur.t - L.start;
        const running = active && local >= 0 && local <= L.dur;
        const dx = Math.cos(L.ang), dy = Math.sin(L.ang);
        const x0 = sx(L.x0), y0 = sy(L.y0);
        const nx = -dy, ny = dx;
        const al = running ? 0.6 : (active ? 0.14 : (0.22 + 0.3 * tp));
        ctx.fillStyle = 'rgba(200,240,255,' + al + ')';
        ctx.beginPath();
        ctx.moveTo(x0 + nx * L.w / 2, y0 + ny * L.w / 2);
        ctx.lineTo(x0 + dx * L.len + nx * L.w / 2, y0 + dy * L.len + ny * L.w / 2);
        ctx.lineTo(x0 + dx * L.len - nx * L.w / 2, y0 + dy * L.len - ny * L.w / 2);
        ctx.lineTo(x0 - nx * L.w / 2, y0 - ny * L.w / 2);
        ctx.closePath(); ctx.fill();
        if (running) {
          const head = Math.min(L.len, 420 + local * 2600);
          const hx = sx(L.x0 + dx * head), hy = sy(L.y0 + dy * head);
          glowCircle(ctx, hx, hy, 46, 'rgba(255,255,255,0.6)', 'rgba(200,240,255,0)');
        }
      }
    } else if (cur.key === 'crevasseWave' && cur.cols) {
      // the seam itself
      ctx.strokeStyle = 'rgba(220,246,255,' + (active ? 0.7 : 0.35 + 0.3 * tp) + ')';
      ctx.lineWidth = 3;
      ctx.beginPath();
      for (let i = 0; i < cur.cols.length; i++) {
        const z = cur.cols[i];
        const px = sx(z.x), py = sy(z.y);
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.stroke();
      for (const z of cur.cols) {
        const local = cur.t - z.fire;
        const up = active && local >= 0 && local < 0.5;
        const zx = sx(z.x), zy = sy(z.y);
        if (up) {
          const rise = clamp(local * 7, 0, 1);
          ctx.fillStyle = 'rgba(225,248,255,' + (0.65 * (1 - local / 0.5)) + ')';
          ctx.beginPath();
          ctx.moveTo(zx, zy - z.r * (1.4 + rise));
          ctx.lineTo(zx + z.r * 0.42, zy + z.r * 0.2);
          ctx.lineTo(zx - z.r * 0.42, zy + z.r * 0.2);
          ctx.closePath(); ctx.fill();
        } else if (!active || local < 0) {
          sigil2(ctx, zx, zy, z.r * (0.5 + 0.4 * tp), t * 1.4 + z.seed, 'rgba(191,233,255,0.9)', 0.35 + 0.4 * tp);
        }
      }
    } else if (cur.key === 'stolenSecond' && cur.marks) {
      for (const m of cur.marks) {
        const local = cur.t - m.delay;
        const armed = active && local >= 0;
        const mx = sx(m.x), my = sy(m.y);
        const col = m.kind ? 'rgba(255,232,180,0.95)' : 'rgba(191,233,255,0.95)';
        sigil2(ctx, mx, my, m.r * (armed ? 1 : 0.55 + 0.45 * tp), t * 2 + m.kind * 2, col, 0.5 + 0.4 * tp);
        if (armed && local < m.dur) {
          glowCircle(ctx, mx, my, m.r * 1.1, 'rgba(255,255,255,0.55)', 'rgba(190,235,255,0)');
          ctx.strokeStyle = col; ctx.lineWidth = 3;
          ctx.beginPath(); ctx.arc(mx, my, m.r * (0.4 + local * 1.6), 0, TAU); ctx.stroke();
        }
        // the thread between the two moments
        if (m.kind && cur.marks[0]) {
          ctx.strokeStyle = 'rgba(191,233,255,0.32)';
          ctx.lineWidth = 1.6;
          ctx.setLineDash([8, 8]); ctx.lineDashOffset = -t * 40;
          ctx.beginPath(); ctx.moveTo(sx(cur.marks[0].x), sy(cur.marks[0].y)); ctx.lineTo(mx, my); ctx.stroke();
          ctx.setLineDash([]);
        }
      }
    } else if (cur.key === 'shardstorm' && cur.shards) {
      const p = active ? clamp(cur.t / cur.phases.active, 0, 1) : 0;
      const r = cur.r0 + (cur.r1 - cur.r0) * p;
      const cxp = sx(cur.cx), cyp = sy(cur.cy);
      ctx.strokeStyle = 'rgba(191,233,255,' + (active ? 0.75 : 0.4 * tp) + ')';
      ctx.lineWidth = cur.thick * 2;
      ctx.beginPath();
      ctx.arc(cxp, cyp, r, cur.gapAng + cur.gap / 2, cur.gapAng - cur.gap / 2 + TAU);
      ctx.stroke();
      for (const s of cur.shards) {
        const a = active ? s.a + cur.t * 1.1 : s.a + t * 0.5;
        const px = cxp + Math.cos(a) * r, py = cyp + Math.sin(a) * r;
        ctx.save(); ctx.translate(px, py); ctx.rotate(a);
        ctx.fillStyle = 'rgba(235,250,255,0.85)';
        ctx.beginPath();
        ctx.moveTo(12, 0); ctx.lineTo(0, 5); ctx.lineTo(-12, 0); ctx.lineTo(0, -5);
        ctx.closePath(); ctx.fill();
        ctx.restore();
      }
    } else if (cur.key === 'everfrost' && cur.zones) {
      for (const z of cur.zones) {
        const local = cur.t - z.fire;
        const zx = sx(z.x), zy = sy(z.y);
        if (active && local >= 0) {
          const erupting = local < z.dur;
          const fade = erupting ? 1 - local / z.dur : clamp(1 - (local - z.dur) / z.linger, 0, 1);
          // the sheet that does not melt
          ctx.fillStyle = 'rgba(200,240,255,' + (0.30 * fade) + ')';
          ctx.beginPath(); ctx.arc(zx, zy, z.r, 0, TAU); ctx.fill();
          ctx.strokeStyle = 'rgba(235,250,255,' + (0.7 * fade) + ')';
          ctx.lineWidth = 2;
          ctx.beginPath(); ctx.arc(zx, zy, z.r * (erupting ? 0.6 + 0.4 * (local / z.dur) : 1), 0, TAU); ctx.stroke();
          if (erupting) glowCircle(ctx, zx, zy, z.r * 1.2, 'rgba(255,255,255,0.5)', 'rgba(180,230,255,0)');
        } else if (!active || local < 0) {
          sigil2(ctx, zx, zy, z.r * (0.45 + 0.55 * tp), t * 1.2 + z.seed, 'rgba(191,233,255,0.9)', 0.4 + 0.35 * tp);
        }
      }
    } else if (cur.key === 'sameBeginning' && cur.lanes) {
      for (const L of cur.lanes) {
        const local = cur.t - L.start;
        const running = active && local >= 0 && local <= L.dur;
        const dx = Math.cos(L.ang), dy = Math.sin(L.ang);
        const x0 = sx(L.x0), y0 = sy(L.y0);
        const nx = -dy, ny = dx;
        ctx.fillStyle = 'rgba(205,242,255,' + (running ? 0.55 : (active ? 0.12 : 0.2 + 0.3 * tp)) + ')';
        ctx.beginPath();
        ctx.moveTo(x0 + nx * L.w / 2, y0 + ny * L.w / 2);
        ctx.lineTo(x0 + dx * L.len + nx * L.w / 2, y0 + dy * L.len + ny * L.w / 2);
        ctx.lineTo(x0 + dx * L.len - nx * L.w / 2, y0 + dy * L.len - ny * L.w / 2);
        ctx.lineTo(x0 - nx * L.w / 2, y0 - ny * L.w / 2);
        ctx.closePath(); ctx.fill();
      }
      const F = cur.final;
      if (F && F.locked) {
        const local = cur.t - F.start;
        const dx = Math.cos(F.ang), dy = Math.sin(F.ang);
        const x0 = sx(F.x0), y0 = sy(F.y0);
        const nx = -dy, ny = dx;
        const on = local >= 0 && local <= F.dur;
        ctx.fillStyle = on ? 'rgba(255,240,200,0.45)' : 'rgba(255,235,190,0.2)';
        ctx.beginPath();
        ctx.moveTo(x0 + nx * F.w / 2, y0 + ny * F.w / 2);
        ctx.lineTo(x0 + dx * F.len + nx * F.w / 2, y0 + dy * F.len + ny * F.w / 2);
        ctx.lineTo(x0 + dx * F.len - nx * F.w / 2, y0 + dy * F.len - ny * F.w / 2);
        ctx.lineTo(x0 - nx * F.w / 2, y0 - ny * F.w / 2);
        ctx.closePath(); ctx.fill();
        ctx.strokeStyle = 'rgba(255,246,220,0.9)';
        ctx.lineWidth = 3;
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  // =========================================================================
  //  3D  RENDERER
  // =========================================================================
  function iceSpire3D(R, x, z, baseR, h, seed, glowAmt) {
    const U = R.unit, mm = R.mm, mat = R.mat;
    const col = [0.72, 0.9, 1.05];
    R.draw(U.rock3, mm(x, h * 0.5, z, seed * 2.1, baseR, h, baseR, seed * 0.3), mat(col, { rough: 0.12, metal: 0.35, emissive: [0.35, 0.6, 0.85], emisK: 1.7, rim: 1.7, rimCol: [0.65, 0.88, 1.15] }));
    for (let i = 0; i < 3; i++) {
      const a = seed + (i / 3) * TAU;
      const th = h * (0.5 + 0.2 * ((seed + i) % 3));
      R.draw(U.cone, mm(x + Math.cos(a) * baseR * 0.72, th * 0.5, z + Math.sin(a) * baseR * 0.72, a + Math.PI / 2, baseR * 0.3, th, baseR * 0.3, 0, Math.PI / 2 - 0.4), mat(col, { rough: 0.1, metal: 0.45, emissive: [0.4, 0.66, 0.95], emisK: 1.5, rim: 1.5, rimCol: [0.8, 0.95, 1.2] }));
    }
    R.glow(x, h, z, baseR * 1.9, 0.62, 0.88, 1.25, glowAmt == null ? 0.55 : glowAmt, 0);
  }

  function lane3D(R, ax, az, ang, len, w, seed, hot) {
    const U = R.unit, mm = R.mm, mat = R.mat;
    const dx = Math.cos(ang), dz = Math.sin(ang);
    const steps = dq(R, 9);
    const col = hot ? [1.35, 1.15, 0.75] : [0.75, 0.95, 1.25];
    for (let i = 0; i < steps; i++) {
      const f = (i + 0.5) / steps;
      const px = ax + dx * len * f, pz = az + dz * len * f;
      R.decal(px, pz, w * 0.9, col[0] * 0.5, col[1] * 0.5, col[2] * 0.5, 0.5, 7, ang, 0, true, 4.5);
    }
    // crystal kerbs down both edges
    const nx = -dz, nz = dx;
    for (let i = 0; i <= 6; i++) {
      const f = i / 6;
      for (const side of [-1, 1]) {
        const px = ax + dx * len * f + nx * side * w * 0.55;
        const pz = az + dz * len * f + nz * side * w * 0.55;
        R.draw(U.cone, mm(px, 11, pz, seed + i, 4.6, 22, 4.6, 0), mat(col, { rough: 0.12, metal: 0.4, emissive: [col[0] * 0.55, col[1] * 0.55, col[2] * 0.55], emisK: 1.7, rim: 1.5, rimCol: col }));
      }
    }
  }

  // The stag's mark is a fern of frost that grows outward, not a ring:
  // shape lives in sentinel_fx_kit.js so the four wardens stay distinct.
  function sigil3D(R, x, z, r, col, amt, tt, spin) {
    if (r < 2) return;
    if (window.SentinelFX) { window.SentinelFX.frost(R, x, z, r * 0.5, Math.min(1, amt), tt, spin || 0.5); return; }
    R.decal(x, z, r, col[0], col[1], col[2], 0.45 * amt, 9, tt * (spin || 0.5), 0, true, 1.5);
    R.decal(x, z, r * 0.68, col[0] * 1.1, col[1] * 1.1, col[2] * 1.1, 0.6 * amt, 6, -tt * (spin || 0.5) * 1.5, 0, true, 1.7);
    R.decal(x, z, r * 0.34, 1.15, 1.25, 1.35, 0.85 * amt, 12, tt * (spin || 0.5) * 2.2, 0, true, 1.9);
  }

  // ---- what the stag gives off, one look per stage ----------------------
  // Not the same spray recoloured: each stage of the fight makes the body
  // shed something different, so the arena itself says which hour it is.
  function stageAura3(R, e, tt, bob, stage) {
    const rr = rad(e), x = e.x, z = e.y;
    const q = (R.q && R.q.parts) || 1;
    const UU = R.unit, mm = R.mm, mat = R.mat;
    const FROST = [0.62, 0.9, 1.2], SAND = [1.3, 1.12, 0.72], PALE = [1.15, 1.3, 1.45];

    if (stage <= 1) {
      // I — rime breath: frost sifts down off the coat and pools at the hooves
      for (let i = 0; i < 3; i++) {
        if (Math.random() < 0.5 * q) {
          const a = Math.random() * TAU, d = rr * (0.45 + Math.random() * 0.85);
          R.emit({
            x: x + Math.cos(a) * d, y: bob + rr * (0.5 + Math.random() * 1.2), z: z + Math.sin(a) * d,
            vx: (Math.random() - 0.5) * 9, vy: -14 - Math.random() * 16, vz: (Math.random() - 0.5) * 9,
            life: 1.3 + Math.random() * 0.9, age: 0, s0: 4, s1: 1.4,
            col: FROST, a: 0.5, kind: 0, drag: 0.5, grav: 6
          });
        }
      }
      R.decal(x, z, rr * 1.45, FROST[0] * 0.5, FROST[1] * 0.5, FROST[2] * 0.5,
        0.12 + 0.05 * Math.sin(tt * 1.6), 9, tt * 0.15, 0, true, 1.3);
      return;
    }

    if (stage === 2) {
      // II — the sand runs the wrong way: up out of the antlers in a spiral
      for (let i = 0; i < 4; i++) {
        if (Math.random() < 0.55 * q) {
          const a = Math.random() * TAU, d = rr * (0.12 + Math.random() * 0.6);
          R.emit({
            x: x + Math.cos(a) * d, y: bob + rr * (0.85 + Math.random() * 0.6), z: z + Math.sin(a) * d,
            vx: -Math.sin(a) * 16, vy: 58 + Math.random() * 44, vz: Math.cos(a) * 16,
            life: 1.1 + Math.random() * 0.7, age: 0, s0: 5, s1: 1,
            col: Math.random() < 0.3 ? FROST : SAND, a: 0.8, kind: 0, drag: 0.4
          });
        }
      }
      // frost crystals turning on the antlers
      const n = dq(R, 5);
      for (let i = 0; i < n; i++) {
        const a = tt * 0.7 + (i / n) * TAU;
        const d = rr * (0.75 + 0.2 * Math.sin(i * 2.1 + tt));
        const s = rr * (0.07 + 0.03 * Math.sin(i * 1.7 + tt * 2));
        R.draw(UU.octa, mm(x + Math.cos(a) * d, bob + rr * (1.35 + 0.18 * Math.sin(i + tt)), z + Math.sin(a) * d,
          a * 1.3, s, s * 1.9, s),
          mat(PALE, { rough: 0.08, metal: 0.35, emissive: [0.55, 0.8, 1.1], emisK: 1.8, shadow: false }));
      }
      return;
    }

    if (stage === 3) {
      // III — the hour: shards of its own glass orbit the body in a tilted ring
      const n = dq(R, 8);
      for (let i = 0; i < n; i++) {
        const a = tt * 0.55 + (i / n) * TAU;
        const ry = bob + rr * 0.55 + Math.sin(a + tt * 0.6) * rr * 0.55;
        R.draw(UU.octa, mm(x + Math.cos(a) * rr * 1.15, ry, z + Math.sin(a) * rr * 1.15,
          a, rr * 0.075, rr * 0.24, rr * 0.075),
          mat([0.92, 1.1, 1.35], { rough: 0.05, metal: 0.4, emissive: [0.6, 0.85, 1.15], emisK: 1.9, alpha: 0.92, shadow: false }));
        if (i % 3 === 0) R.glow(x + Math.cos(a) * rr * 1.15, ry, z + Math.sin(a) * rr * 1.15, rr * 0.5, 0.7, 0.9, 1.2, 0.35, 0);
      }
      // and the sand has thickened into a hard-up rain
      for (let i = 0; i < 3; i++) {
        if (Math.random() < 0.6 * q) {
          const a = Math.random() * TAU, d = rr * (0.1 + Math.random() * 0.5);
          R.emit({
            x: x + Math.cos(a) * d, y: bob + rr * (0.6 + Math.random() * 0.5), z: z + Math.sin(a) * d,
            vx: -Math.sin(a) * 26, vy: 96 + Math.random() * 70, vz: Math.cos(a) * 26,
            life: 0.9, age: 0, s0: 5, s1: 1, col: SAND, a: 0.9, kind: 0, drag: 0.3
          });
        }
      }
      return;
    }

    // IV — the same second: rings of pale time close inward, sand bursts out
    for (let i = 0; i < 3; i++) {
      const k = (tt * 0.5 + i / 3) % 1;
      R.decal(x, z, rr * (2.6 - k * 1.9), PALE[0] * 0.8, PALE[1] * 0.85, PALE[2],
        (1 - k) * 0.35, 9, tt * 0.3 + i, 0, true, 2.2 + k * 0.4);
    }
    for (let i = 0; i < 5; i++) {
      if (Math.random() < 0.65 * q) {
        const a = Math.random() * TAU, d = rr * (0.3 + Math.random() * 0.7);
        const out = 40 + Math.random() * 80;
        R.emit({
          x: x + Math.cos(a) * d, y: bob + rr * (0.4 + Math.random() * 0.9), z: z + Math.sin(a) * d,
          vx: Math.cos(a) * out, vy: 60 + Math.random() * 90, vz: Math.sin(a) * out,
          life: 0.9 + Math.random() * 0.5, age: 0, s0: 6, s1: 1,
          col: Math.random() < 0.35 ? FROST : SAND, a: 0.9, kind: 0, drag: 0.35
        });
      }
    }
    R.glow(x, bob + rr * 0.9, z, rr * 2.4, 1.0, 1.2, 1.5, 0.35 + 0.15 * Math.sin(tt * 4), 0);
  }

  function draw3D(R, e, tt, env) {
    if (!R || !R.ok) return;
    const U = R.unit, mm = R.mm, mat = R.mat;
    const rr = rad(e);
    const stage = stageOf(e);
    const x = e.x, z = e.y;
    const hs = e._hs || {};
    const bob = rr * 1.2 + Math.sin(tt * 2.2) * 3.5;
    const ICY = [0.6, 0.86, 1.15];

    R.quads.alpha.push(x, 1.2, z, rr * 2.5, 0, 0, 0, 0.35, 0, 11, 0, 1);

    // ---- body ----
    if (imgReady) {
      const sp = R.spriteMesh(img, { depth: 0.5, power: 0.45 });
      if (sp) {
        const size = (rr + 20) * 2.2;
        const tps = R.isTps;
        // The inflated sprite is a flat plaque lying on the ground, so the
        // third-person camera looks down on its back. The Choir of Ash got a
        // full quarter turn to stand its art bolt upright and square to the
        // camera; the stag's art is stood the same way, for the same reason.
        const tilt = Math.PI * 0.5;
        const ang = env ? Math.atan2(env.player.y - e.y, env.player.x - e.x) : 0;
        if (tps) {
          const c = Math.cos(R.cam.tyaw), sn = Math.sin(R.cam.tyaw), ux = -sn, uz = c;
          const _t1 = new Float32Array(16), o = new Float32Array(16);
          R.GL3D.M.trs(_t1, 0, 0, 0, ang, size * 1.1, size * 0.55, size * 1.1);
          const co = Math.cos(tilt), si = Math.sin(tilt), tT = 1 - co; o.fill(0); o[15] = 1;
          o[0] = co + tT * ux * ux; o[1] = si * uz; o[2] = tT * ux * uz;
          o[4] = -si * uz; o[5] = co; o[6] = si * ux;
          o[8] = tT * ux * uz; o[9] = -si * ux; o[10] = co + tT * uz * uz;
          const out = mm(0, 0, 0, 0, 1, 1, 1); R.GL3D.M.mul(out, o, _t1);
          out[12] = x; out[13] = bob + size * 0.44 + R.groundY(x, z); out[14] = z;
          R.draw(sp.mesh, out, mat([1, 1, 1], { tex: sp.tex, emis: sp.emis, emisK: 0.32, rough: 0.55, metal: 0, emissive: [0, 0, 0], rim: 0.12, rimCol: ICY }));
        } else {
          R.draw(sp.mesh, mm(x, bob, z, ang, size, size * 1.35, size), mat([1, 1, 1], { tex: sp.tex, emis: sp.emis, emisK: 0.32, rough: 0.55, metal: 0, emissive: [0, 0, 0], rim: 0.12, rimCol: ICY }));
        }
      }
    } else {
      // procedural stand-in: bone barrel, neck and hourglass antlers
      R.draw(U.sphere, mm(x, bob, z, 0, rr * 0.95, rr * 0.7, rr * 1.25, 0.2), mat([0.86, 0.92, 0.96], { rough: 0.45, metal: 0.15, rim: 1.3, rimCol: ICY }));
      R.draw(U.cone, mm(x + Math.cos(tt * 0.2) * rr * 0.9, bob + rr * 0.5, z + Math.sin(tt * 0.2) * rr * 0.9, tt * 0.2, rr * 0.34, rr * 1.15, rr * 0.34, 0.5), mat([0.9, 0.95, 0.98], { rough: 0.4, metal: 0.2, rim: 1.4, rimCol: ICY }));
      for (const side of [-1, 1]) {
        R.draw(U.octa, mm(x + side * rr * 0.8, bob + rr * 1.5, z, tt * 0.4, rr * 0.22, rr * 0.5, rr * 0.22, 0), mat([1.2, 1.35, 1.5], { rough: 0.08, metal: 0.3, emissive: [0.6, 0.85, 1.2], emisK: 2.0, rim: 1.8, rimCol: ICY }));
      }
    }

    // ---- hourglass light: sand running upward out of the antlers ----
    R.glow(x, bob + rr * 0.9, z, rr * (1.5 + stage * 0.08), 0.55, 0.82, 1.05, (0.42 + 0.16 * Math.sin(tt * 2.6)), 0);
    R.light(x, z, bob + rr * 0.6, 210 + stage * 45, 0.5, 0.78, 1.1, 0.62 + 0.18 * Math.sin(tt * 2.2));
    stageAura3(R, e, tt, bob, stage);

    // the frost it stands in
    sigil3D(R, x, z, rr * (1.9 + stage * 0.22), ICY, 0.45 + 0.12 * Math.sin(tt * 2), tt, 0.45);

    const cur = curOf(e);
    if (cur) telegraph3D(R, cur, tt, rr);

    // ---- stage transition ----
    if (hs.phaseAnim) {
      const pa = hs.phaseAnim;
      const p = clamp(pa.t / pa.dur, 0, 1), fade = 1 - p;
      const ringR = rr + p * 540;
      R.draw(U.torus, mm(x, 5, z, tt * 1.6, ringR, 2 + 9 * fade, ringR, 0.18), mat([0.7, 0.95, 1.35], { emissive: [0.7, 0.95, 1.4], emisK: 2.3, alpha: 0.9 * fade, shadow: false }));
      R.draw(U.torus, mm(x, 7, z, -tt * 1.3, ringR * 0.78, 2 + 6 * fade, ringR * 0.78, 0.14), mat([0.5, 0.8, 1.15], { emissive: [0.4, 0.75, 1.2], emisK: 2.0, alpha: 0.8 * fade, shadow: false }));
      R.glow(x, bob, z, rr * (1.5 + p * 1.3), 0.6, 0.9, 1.25, 0.9 * fade, 0);
      R.light(x, z, bob + 20, 320 + p * 260, 0.55, 0.85, 1.25, 0.9 * fade);
      for (let i = 0; i < dq(R, 7); i++) {
        if (Math.random() < 0.8) {
          const a = Math.random() * TAU, d = rr * (0.4 + Math.random() * 1.7);
          R.emit({ x: x + Math.cos(a) * d, y: 2 + Math.random() * 10, z: z + Math.sin(a) * d, vx: Math.cos(a) * (24 + 46 * fade), vy: 70 + Math.random() * 90, vz: Math.sin(a) * (24 + 46 * fade), life: 1.0, age: 0, s0: 9, s1: 2, col: ICY, a: 0.9 * fade, kind: 0, drag: 0.6 });
        }
      }
      R.cameraKick = Math.max(R.cameraKick || 0, 0.45 * fade);
    }
  }

  function telegraph3D(R, cur, tt, rr) {
    if (cur.phase !== 'tele' && cur.phase !== 'active') return;
    const U = R.unit, mm = R.mm, mat = R.mat;
    const active = cur.phase === 'active';
    const tp = cur.phase === 'tele' ? clamp(cur.t / cur.phases.tele, 0, 1) : 1;
    const ICY = [0.7, 0.95, 1.3];

    if (cur.key === 'rimefall' && cur.zones) {
      for (const z of cur.zones) {
        const local = cur.t - z.fire;
        const up = active && local >= 0 && local < z.dur;
        if (up) {
          const rise = clamp(local * 7, 0, 1);
          const h = z.r * (0.6 + 1.5 * rise);
          iceSpire3D(R, z.x, z.y, z.r * 0.5, h, z.seed, 0.7 * (1 - local / z.dur));
          R.light(z.x, z.y, h * 0.6, 210, 0.55, 0.85, 1.2, 0.7 * (1 - local / z.dur));
          R.cameraKick = Math.max(R.cameraKick || 0, 0.07 * rise);
        } else if (!active || local < 0) {
          sigil3D(R, z.x, z.y, z.r * (0.4 + 0.6 * tp), ICY, 0.5 + 0.4 * tp, tt, 0.6);
          R.glow(z.x, 3, z.y, z.r * 1.0, 0.5, 0.8, 1.15, 0.35 * tp, 0);
        }
      }
    } else if (cur.key === 'glasshornCharge') {
      lane3D(R, cur.x0, cur.y0, cur.ang, cur.len, cur.w, 1.3, active);
      if (cur.trail) {
        for (const s of cur.trail) {
          const a = clamp(s.life / 2.2, 0, 1);
          R.decal(s.x, s.y, s.r, 0.55, 0.8, 1.0, 0.28 * a, 9, s.life, 0, true, 1.3);
          R.draw(U.cone, mm(s.x, 6, s.y, s.life * 3, 5, 12, 5, 0), mat([0.85, 0.95, 1.05], { rough: 0.1, metal: 0.4, emissive: [0.4, 0.66, 0.95], emisK: 1.5, alpha: 0.9 * a }));
        }
      }
      R.glow(cur.x0 + Math.cos(cur.ang) * 90, 20, cur.y0 + Math.sin(cur.ang) * 90, 90, 0.6, 0.85, 1.15, 0.5, 0);
    } else if (cur.key === 'frozenReprise' && cur.lanes) {
      for (const L of cur.lanes) {
        const local = cur.t - L.start;
        const running = active && local >= 0 && local <= L.dur;
        lane3D(R, L.x0, L.y0, L.ang, L.len, L.w, L.seed, false);
        if (running) {
          const head = Math.min(L.len, 380 + local * 2600);
          const hx = L.x0 + Math.cos(L.ang) * head, hz = L.y0 + Math.sin(L.ang) * head;
          R.draw(U.sphere, mm(hx, 34, hz, tt * 2, 20, 30, 20), mat([0.9, 0.98, 1.1], { emissive: [0.6, 0.9, 1.2], emisK: 1.9, alpha: 0.75, shadow: false, rough: 0.3 }));
          R.glow(hx, 30, hz, 74, 0.7, 0.92, 1.25, 0.6, 0);
          R.light(hx, hz, 30, 190, 0.6, 0.85, 1.2, 0.6);
        }
      }
    } else if (cur.key === 'crevasseWave' && cur.cols) {
      const dx = Math.cos(cur.dir), dz = Math.sin(cur.dir);
      R.decal(cur.cx + dx * (cur.cols.length * cur.spacing) * 0.5, cur.cy + dz * (cur.cols.length * cur.spacing) * 0.5, cur.cols.length * cur.spacing * 0.5, 0.5, 0.75, 1.1, 0.16, 12, cur.dir, 0, true, 9.0);
      for (const col of cur.cols) {
        const local = cur.t - col.fire;
        const up = active && local >= 0 && local < 0.5;
        if (up) {
          const rise = clamp(local * 8, 0, 1);
          iceSpire3D(R, col.x, col.y, cur.colR * 0.45, cur.colR * (1.2 + 1.1 * rise), col.seed, 0.6);
          R.cameraKick = Math.max(R.cameraKick || 0, 0.06 * rise);
        } else if (!active || local < 0) {
          sigil3D(R, col.x, col.y, cur.colR * (0.5 + 0.45 * tp), ICY, 0.35 + 0.4 * tp, tt, 0.7);
        }
      }
    } else if (cur.key === 'stolenSecond' && cur.marks) {
      for (const m of cur.marks) {
        const local = cur.t - m.delay;
        const armed = active && local >= 0;
        const col = m.kind ? [1.3, 1.12, 0.72] : ICY;
        sigil3D(R, m.x, m.y, m.r * (armed ? 1 : 0.55 + 0.45 * tp), col, 0.55 + 0.4 * tp, tt, 0.75 + m.kind * 0.3);
        if (armed && local < m.dur) {
          const h = 150 * clamp(local * 4, 0, 1);
          iceSpire3D(R, m.x, m.y, m.r * 0.55, h, m.kind * 2.1 + 0.4, 0.9);
          R.glow(m.x, h, m.y, m.r * 1.9, 0.75, 0.92, 1.25, 0.9, 0);
          R.light(m.x, m.y, h, 300, 0.65, 0.88, 1.2, 0.85);
          R.cameraKick = Math.max(R.cameraKick || 0, 0.14 * clamp(local * 3, 0, 1));
        }
      }
      if (cur.marks.length > 1) {
        const a = cur.marks[0], b = cur.marks[1];
        const midx = (a.x + b.x) / 2, midz = (a.y + b.y) / 2;
        R.decal(midx, midz, Math.hypot(b.x - a.x, b.y - a.y) * 0.5, 0.55, 0.8, 1.05, 0.28, 12, Math.atan2(b.y - a.y, b.x - a.x), 0, true, 3.4);
      }
    } else if (cur.key === 'shardstorm' && cur.shards) {
      const p = active ? clamp(cur.t / cur.phases.active, 0, 1) : 0;
      const r = cur.r0 + (cur.r1 - cur.r0) * p;
      const segs = dq(R, 26);
      for (let i = 0; i < segs; i++) {
        const a = wrap(cur.gapAng + cur.gap / 2 + (i / segs) * (TAU - cur.gap));
        const px = cur.cx + Math.cos(a) * r, pz = cur.cy + Math.sin(a) * r;
        R.draw(U.cone, mm(px, 16, pz, a, 6, 30, 6, 0), mat([0.9, 1.0, 1.1], { rough: 0.08, metal: 0.45, emissive: [0.55, 0.8, 1.15], emisK: 1.9, rim: 1.7, rimCol: ICY }));
      }
      for (const s of cur.shards) {
        const a = s.a + (active ? cur.t * 1.1 : tt * 0.4);
        const px = cur.cx + Math.cos(a) * r, pz = cur.cy + Math.sin(a) * r;
        R.draw(U.octa, mm(px, 24 + Math.sin(tt * 3 + s.seed) * 6, pz, a, 7, 16, 7, 0), mat([1.1, 1.25, 1.4], { rough: 0.05, metal: 0.4, emissive: [0.7, 0.92, 1.25], emisK: 2.1, rim: 1.9, rimCol: ICY, shadow: false }));
      }
      R.glow(cur.cx, 12, cur.cy, r * 1.1, 0.55, 0.82, 1.15, active ? 0.5 : 0.25 * tp, 0);
      R.light(cur.cx, cur.cy, 20, 320, 0.5, 0.8, 1.15, active ? 0.6 : 0.3);
    } else if (cur.key === 'everfrost' && cur.zones) {
      for (const z of cur.zones) {
        const local = cur.t - z.fire;
        if (active && local >= 0) {
          const erupting = local < z.dur;
          const fade = erupting ? 1 - local / z.dur : clamp(1 - (local - z.dur) / z.linger, 0, 1);
          // the sheet of frost that stays
          R.decal(z.x, z.y, z.r * 1.15, 0.62, 0.88, 1.15, 0.42 * fade, 9, tt * 0.2 + z.seed, 0, true, 1.8);
          R.draw(U.disc, mm(z.x, 1.4, z.y, 0, z.r, 1, z.r, 0), mat([0.85, 0.95, 1.05], { alpha: 0.3 * fade, rough: 0.1, metal: 0.4, emissive: [0.35, 0.6, 0.9], emisK: 1.2, shadow: false }));
          if (erupting) {
            const rise = clamp(local * 5, 0, 1);
            iceSpire3D(R, z.x, z.y, z.r * 0.55, z.r * (1.0 + 1.2 * rise), z.seed, 0.8 * fade);
            R.light(z.x, z.y, z.r, 240, 0.55, 0.85, 1.2, 0.7 * fade);
            R.cameraKick = Math.max(R.cameraKick || 0, 0.08 * rise);
          }
        } else if (!active || local < 0) {
          sigil3D(R, z.x, z.y, z.r * (0.45 + 0.55 * tp), ICY, 0.4 + 0.35 * tp, tt, 0.5);
        }
      }
    } else if (cur.key === 'sameBeginning') {
      if (cur.lanes) {
        for (const L of cur.lanes) {
          const local = cur.t - L.start;
          const running = active && local >= 0 && local <= L.dur;
          lane3D(R, L.x0, L.y0, L.ang, L.len, L.w, L.seed, false);
          if (running) {
            const head = Math.min(L.len, 380 + local * 2700);
            const hx = L.x0 + Math.cos(L.ang) * head, hz = L.y0 + Math.sin(L.ang) * head;
            R.glow(hx, 30, hz, 80, 0.7, 0.92, 1.25, 0.6, 0);
          }
        }
      }
      const F = cur.final;
      if (F && F.locked) {
        const local = cur.t - F.start;
        const on = local >= 0 && local <= F.dur;
        lane3D(R, F.x0, F.y0, F.ang, F.len, F.w, 4.7, true);
        if (on) {
          const head = Math.min(F.len, local * 3200);
          const hx = F.x0 + Math.cos(F.ang) * head, hz = F.y0 + Math.sin(F.ang) * head;
          iceSpire3D(R, hx, hz, F.w * 0.5, F.w * 1.6, local * 6, 0.9);
          R.glow(hx, 40, hz, 120, 1.3, 1.15, 0.8, 0.8, 0);
          R.light(hx, hz, 40, 300, 1.2, 1.0, 0.75, 0.8);
          R.cameraKick = Math.max(R.cameraKick || 0, 0.18);
        }
      }
    }
  }

  // ---------------------------------------------------------------------
  window.HourglassStagFX = { draw2D, draw3D, get artReady() { return imgReady; } };
})();
