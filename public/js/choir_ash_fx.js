// ============================================================
// Monster Arena — THE CHOIR OF ASH: visual effects
// ------------------------------------------------------------------
// Every frame of the Choir's body and of its eight verses is drawn
// here, so the fight reads as a boss fight and not as a ring of
// coloured circles:
//   * Cinder Canticle .... a widening throat of embers down a corridor
//   * Ashen Notes ........ burning notes on the floor, each on its beat
//   * Funeral Chorus ..... three rings of ash rolling out from the mass
//   * Sootbound Voices ... drifting spirits tethered to the soot
//   * Pyre Procession .... burning lanes crossing the arena
//   * Hollow Refrain ..... the first note, then its echo from behind
//   * Ashfall Cathedral .. a floor of falling cinders, drifting shelters
//   * Finale of Embers ... the stream, the rapid notes, then it reels
//
// Two renderers: draw3D (WebGL, the real client) and draw2D (fallback).
// ============================================================
(function () {
  'use strict';

  // ---- palette ------------------------------------------------------------
  const HEX = {
    ember: '#ff8a4c', hot: '#ffe0b0', ash: '#3a3038', bone: '#efe6d8',
    soot: '#161016', kindle: '#c9552a'
  };
  // Deep ember and soot, deliberately redder than the Sealwright's ivory law
  // so the two wardens can never be confused at a glance.
  // Scarlet fire over soot. Green and blue stay low on purpose: these go into
  // the additive pass, and warm-white values are exactly what made the Choir
  // glow like the Sealwright's gold law.
  const F = {
    ember: [2.15, 0.22, 0.06], hot: [2.45, 0.80, 0.26], ash: [0.10, 0.07, 0.08],
    bone: [1.12, 0.96, 0.90], kindle: [1.65, 0.10, 0.04], white: [2.2, 1.05, 0.55]
  };
  const TAU = Math.PI * 2;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;

  // ---- the Choir's art ----------------------------------------------------
  // The warden is drawn from its sprite, upright like the other bosses' art;
  // the procedural body below is only the fallback for the moment before the
  // image has loaded. Replace the file at this path to swap the art.
  const SPRITE_SRC = 'assets/boss/choir_of_ashes.png?v=2';
  const img = new Image();
  let imgReady = false;
  if (SPRITE_SRC) {
    img.crossOrigin = 'anonymous';
    img.onload = () => { imgReady = true; };
    img.src = SPRITE_SRC;
  }
  const spriteAR = () => {
    const w = img.naturalWidth || img.width, h = img.naturalHeight || img.height;
    return (w && h) ? w / h : 1;
  };

  const rad = (e) => e.r || 42;
  const stOf = (e) => e._ca || { stage: 1 };
  const stageOf = (e) => (e._ca && e._ca.stage) || 1;
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

  function ring2(ctx, x, y, r, spin, col, lw) {
    ctx.strokeStyle = col;
    ctx.lineWidth = lw || 2;
    ctx.setLineDash([Math.max(4, r * 0.2), Math.max(3, r * 0.14)]);
    ctx.lineDashOffset = spin * r * 0.5;
    ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.stroke();
    ctx.setLineDash([]);
    ctx.lineDashOffset = 0;
  }

  // the body used only until the sprite has loaded
  function body2(ctx, e, t) {
    const rr = rad(e), st = stageOf(e);
    ctx.save();
    // soot column
    ctx.fillStyle = 'rgba(24,18,24,.96)';
    ctx.beginPath();
    for (let i = 0; i <= 16; i++) {
      const a = (i / 16) * TAU;
      const wob = 1 + 0.13 * Math.sin(a * 3 + t * 1.6) + 0.07 * Math.sin(a * 5 - t * 2.1);
      const r2 = rr * 0.92 * wob;
      const px = Math.cos(a) * r2, py = Math.sin(a) * r2 * 1.2;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath(); ctx.fill();
    // ragged hem
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * TAU + t * 0.2;
      const h = rr * (0.8 + 0.4 * Math.sin(i * 2.3 + t));
      ctx.fillStyle = 'rgba(20,15,22,.9)';
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * rr * 0.7, Math.sin(a) * rr * 0.7);
      ctx.lineTo(Math.cos(a) * rr * 1.5, Math.sin(a) * rr * 1.9 + h * 0.2);
      ctx.lineTo(Math.cos(a + 0.28) * rr * 0.7, Math.sin(a + 0.28) * rr * 0.7);
      ctx.closePath(); ctx.fill();
    }
    // masks: pale plates with ember eyes
    const masks = 3 + st;
    for (let i = 0; i < masks; i++) {
      const a = t * 0.5 + (i / masks) * TAU;
      const d = rr * (0.45 + 0.2 * Math.sin(i * 1.9));
      const mx = Math.cos(a) * d, my = Math.sin(a) * d * 0.9 - rr * 0.15;
      const s = rr * (0.3 + 0.05 * Math.sin(i * 3.1 + t * 2));
      ctx.fillStyle = 'rgba(239,230,216,.94)';
      ctx.beginPath(); ctx.ellipse(mx, my, s * 0.72, s, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(255,86,40,.95)';
      ctx.beginPath(); ctx.arc(mx - s * 0.2, my - s * 0.12, s * 0.1, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.arc(mx + s * 0.2, my - s * 0.12, s * 0.1, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(30,20,24,.9)';
      ctx.beginPath(); ctx.ellipse(mx, my + s * 0.34, s * 0.16, s * 0.24, 0, 0, TAU); ctx.fill();
    }
    // rising cinders
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * TAU + t * 0.6;
      const d = rr * (0.4 + 0.7 * ((i * 0.37) % 1));
      const yy = rr * 1.1 - ((t * 60 + i * 33) % (rr * 2));
      ctx.fillStyle = 'rgba(255,190,120,' + (0.25 + 0.35 * ((i * 0.21) % 1)) + ')';
      ctx.beginPath(); ctx.arc(Math.cos(a) * d, -yy, 2.2, 0, TAU); ctx.fill();
    }
    ctx.restore();
  }

  // ---- 2D attack telegraphs ----------------------------------------------
  function beam2(ctx, e, ang, len, w, sx, sy, on, prog, t) {
    const ax = sx(e.x), ay = sy(e.y);
    // ragged fire, never a clean beam
    if (window.SentinelFX && window.SentinelFX.throat2) {
      window.SentinelFX.throat2(ctx, ax, ay, ax + Math.cos(ang) * len, ay + Math.sin(ang) * len,
        w, on ? 1 : 0.3 + 0.6 * prog, prog, on, t);
      if (on) glowCircle(ctx, ax + Math.cos(ang) * len, ay + Math.sin(ang) * len, w * 1.3, 'rgba(255,220,160,.85)', 'rgba(255,90,20,0)');
      return;
    }
    ctx.save();
    ctx.translate(ax, ay);
    ctx.rotate(ang);
    const g = ctx.createLinearGradient(0, 0, len, 0);
    const a0 = on ? 0.9 : 0.12 + 0.26 * prog;
    g.addColorStop(0, 'rgba(255,86,40,' + a0 + ')');
    g.addColorStop(0.65, 'rgba(255,86,40,' + (a0 * 0.6) + ')');
    g.addColorStop(1, 'rgba(255,86,40,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, -w * 0.5, len, w);
    ctx.strokeStyle = 'rgba(255,140,86,' + (on ? 0.95 : 0.35 + 0.45 * prog) + ')';
    ctx.lineWidth = 2;
    ctx.setLineDash([20, 13]);
    ctx.lineDashOffset = -t * 150;
    ctx.beginPath();
    ctx.moveTo(0, -w * 0.5); ctx.lineTo(len, -w * 0.5);
    ctx.moveTo(0, w * 0.5); ctx.lineTo(len, w * 0.5);
    ctx.stroke();
    ctx.setLineDash([]);
    if (on) {
      ctx.globalCompositeOperation = 'screen';
      const cg = ctx.createLinearGradient(0, 0, len, 0);
      cg.addColorStop(0, 'rgba(255,248,220,.85)');
      cg.addColorStop(1, 'rgba(255,150,70,0)');
      ctx.fillStyle = cg;
      ctx.fillRect(0, -w * 0.2, len, w * 0.4);
      for (let i = 0; i < 10; i++) {
        const u = ((t * 2.4 + i * 0.1) % 1);
        const dx = u * len;
        const dy = Math.sin(i * 2.7 + t * 9) * w * 0.3;
        ctx.fillStyle = 'rgba(255,230,190,.85)';
        ctx.beginPath(); ctx.arc(dx, dy, 2.6, 0, TAU); ctx.fill();
      }
    }
    ctx.restore();
  }

  function mark2(ctx, x, y, r, prog, fired, t) {
    if (window.SentinelFX) {
      window.SentinelFX.burn2(ctx, x, y, r, fired ? 1 : 0.3 + 0.6 * prog, t, fired);
      if (fired) glowCircle(ctx, x, y, r * 1.3, 'rgba(255,88,48,.4)', 'rgba(0,0,0,0)');
      return;
    }
    ctx.fillStyle = fired ? 'rgba(255,150,80,.34)' : 'rgba(255,86,40,' + (0.07 + 0.2 * prog) + ')';
    ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
    ctx.strokeStyle = fired ? 'rgba(255,240,210,.95)' : 'rgba(255,208,138,' + (0.4 + 0.5 * prog) + ')';
    ctx.lineWidth = fired ? 4 : 2;
    ctx.beginPath(); ctx.arc(x, y, fired ? r : r * (0.55 + 0.45 * prog), 0, TAU); ctx.stroke();
    if (!fired) ring2(ctx, x, y, r * 0.72, t * 1.6, 'rgba(255,140,86,.8)', 2);
    else glowCircle(ctx, x, y, r * 1.3, 'rgba(255,88,48,.4)', 'rgba(0,0,0,0)');
  }

  function telegraph2(ctx, e, cur, t, env) {
    if (cur.phase !== 'tele' && cur.phase !== 'active') return;
    const cam = env.cam || { x: 0, y: 0, sx: 0, sy: 0 };
    const sx = (x) => x - cam.x - (cam.sx || 0);
    const sy = (y) => y - cam.y - (cam.sy || 0);
    const on = cur.phase === 'active';
    const prog = cur.phase === 'tele' ? clamp(cur.t / cur.phases.tele, 0, 1) : 1;
    const RR = rad(e);

    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    // casting flare at the Choir
    glowCircle(ctx, sx(e.x), sy(e.y), RR * (1.6 + prog * 0.6) * (on ? 1.2 : 0.8),
      'rgba(255,96,52,' + (0.22 * prog + 0.08) + ')', 'rgba(0,0,0,0)');
    ctx.restore();

    if (cur.key === 'cinderCanticle' || cur.key === 'finaleOfEmbers') {
      beam2(ctx, e, cur.ang, cur.len, cur.w, sx, sy, on, prog, t);
      if (cur.key === 'finaleOfEmbers' && cur.marks) {
        const fade = on && cur.t > 1.15 ? 0 : 1;
        if (fade) for (const z of cur.marks) mark2(ctx, sx(z.x), sy(z.y), z.r, prog, z.fired, t);
        else for (const z of cur.marks) if (z.fired) mark2(ctx, sx(z.x), sy(z.y), z.r, 1, true, t);
      }
    } else if (cur.key === 'hollowRefrain' && cur.beams) {
      for (const bm of cur.beams) {
        const live = on && cur.t >= bm.from && cur.t <= bm.to;
        beam2(ctx, e, bm.ang, cur.len, cur.w, sx, sy, live, prog, t);
      }
      if (on && cur.t > 1.15) {
        // the echo arrives: a bright ring at the Choir marks the second voice
        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        glowCircle(ctx, sx(e.x), sy(e.y), RR * 2.4 * clamp((cur.t - 1.15) / 0.5, 0, 1),
          'rgba(255,120,80,.35)', 'rgba(0,0,0,0)');
        ctx.restore();
      }
    } else if ((cur.key === 'ashenNotes' || cur.key === 'finaleOfEmbers') && cur.zones) {
      for (const z of cur.zones) mark2(ctx, sx(z.x), sy(z.y), z.r, prog, z.fired, t);
    } else if (cur.key === 'funeralChorus' && cur.rings) {
      // Three arms of fire rolling outward, never a closed pulse of light: the
      // chorus arrives in voices, so each wave is broken into arcs that turn as
      // they travel instead of a ring that snaps shut like the Sealwright's.
      for (const r of cur.rings) {
        const age = on ? cur.t - r.born : -1;
        const radius = age >= 0 ? age * r.sp : RR * (1.0 + prog * 0.6);
        if (age > 2.6) continue;
        const a = age >= 0 ? clamp(1 - age / 2.6, 0, 1) : 0.5 + 0.45 * prog;
        const spin = t * 0.7 + (age > 0 ? age * 2.2 : 0);
        for (let arm = 0; arm < 3; arm++) {
          const base = spin + (arm / 3) * TAU;
          ctx.strokeStyle = age >= 0 ? 'rgba(255,88,38,' + a + ')' : 'rgba(255,86,40,' + a + ')';
          ctx.lineWidth = age >= 0 ? 5 + 9 * a : 2;
          ctx.beginPath(); ctx.arc(sx(e.x), sy(e.y), radius, base, base + 1.2); ctx.stroke();
          if (age >= 0) {
            for (let i = 0; i < 5; i++) {
              const ang = base + (i / 4) * 1.2;
              glowCircle(ctx, sx(e.x) + Math.cos(ang) * radius, sy(e.y) + Math.sin(ang) * radius,
                9 + 9 * a, 'rgba(255,108,44,' + (0.45 * a) + ')', 'rgba(0,0,0,0)');
            }
          }
        }
      }
    } else if (cur.key === 'sootboundVoices' && cur.nodes) {
      for (const nd of cur.nodes) {
        if (nd.dead) continue;
        const x = sx(nd.x), y = sy(nd.y), rr = nd.r;
        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        glowCircle(ctx, x, y, rr * 1.9, 'rgba(255,150,90,.30)', 'rgba(0,0,0,0)');
        ctx.restore();
        // a hooded wisp of soot
        ctx.fillStyle = 'rgba(26,20,26,.95)';
        ctx.beginPath();
        ctx.moveTo(x, y - rr * 1.5);
        ctx.quadraticCurveTo(x + rr, y - rr * 0.2, x + rr * 0.6, y + rr * 0.9);
        ctx.quadraticCurveTo(x, y + rr * 0.3, x - rr * 0.6, y + rr * 0.9);
        ctx.quadraticCurveTo(x - rr, y - rr * 0.2, x, y - rr * 1.5);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = 'rgba(239,230,216,.9)';
        ctx.beginPath(); ctx.ellipse(x, y - rr * 0.45, rr * 0.4, rr * 0.55, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = 'rgba(255,86,40,.95)';
        ctx.beginPath(); ctx.arc(x - rr * 0.14, y - rr * 0.5, rr * 0.08, 0, TAU); ctx.fill();
        ctx.beginPath(); ctx.arc(x + rr * 0.14, y - rr * 0.5, rr * 0.08, 0, TAU); ctx.fill();
        // health pip
        const hpA = clamp(nd.hp / 60, 0, 1);
        ctx.strokeStyle = 'rgba(255,190,130,' + (0.5 + 0.4 * hpA) + ')';
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(x, y, rr * 1.7, -Math.PI / 2, -Math.PI / 2 + hpA * TAU); ctx.stroke();
      }
    } else if (cur.key === 'pyreProcession' && cur.lanes) {
      const W = cur.w;
      for (const ln of cur.lanes) {
        if (!on || cur.t < ln.born) continue;
        const p = -200 + (cur.t - ln.born) * ln.sp;
        ctx.save();
        if (ln.axis === 'h') {
          const gy = sy(p);
          const lg = ctx.createLinearGradient(0, gy - W * 0.5, 0, gy + W * 0.5);
          lg.addColorStop(0, 'rgba(255,140,70,0)');
          lg.addColorStop(0.5, 'rgba(255,88,48,.5)');
          lg.addColorStop(1, 'rgba(255,140,70,0)');
          ctx.fillStyle = lg;
          ctx.fillRect(0, gy - W * 0.5, ctx.canvas.width, W);
          ctx.strokeStyle = 'rgba(255,236,200,.9)';
          ctx.lineWidth = 3;
          ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(ctx.canvas.width, gy); ctx.stroke();
        } else {
          const gx = sx(p);
          const lg = ctx.createLinearGradient(gx - W * 0.5, 0, gx + W * 0.5, 0);
          lg.addColorStop(0, 'rgba(255,140,70,0)');
          lg.addColorStop(0.5, 'rgba(255,88,48,.5)');
          lg.addColorStop(1, 'rgba(255,140,70,0)');
          ctx.fillStyle = lg;
          ctx.fillRect(gx - W * 0.5, 0, W, ctx.canvas.height);
          ctx.strokeStyle = 'rgba(255,236,200,.9)';
          ctx.lineWidth = 3;
          ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, ctx.canvas.height); ctx.stroke();
        }
        ctx.restore();
      }
      if (!on) {
        ctx.strokeStyle = 'rgba(255,86,40,' + (0.3 + 0.4 * prog) + ')';
        ctx.lineWidth = 2;
        ctx.setLineDash([16, 12]);
        ctx.lineDashOffset = -t * 120;
        ctx.strokeRect(sx(e.x) - RR * 2.4, sy(e.y) - RR * 2.4, RR * 4.8, RR * 4.8);
        ctx.setLineDash([]);
      }
    } else if (cur.key === 'ashfallCathedral' && cur.cells) {
      const R = 640;
      for (const s of cur.safe) {
        const x = sx(s.x), y = sy(s.y);
        ctx.fillStyle = 'rgba(255,220,170,.12)';
        ctx.beginPath(); ctx.arc(x, y, s.r, 0, TAU); ctx.fill();
        ctx.strokeStyle = 'rgba(255,240,210,.9)';
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(x, y, s.r, 0, TAU); ctx.stroke();
        ring2(ctx, x, y, s.r * 0.8, t * 1.1, 'rgba(255,208,138,.75)', 2);
      }
      for (const c of cur.cells) {
        const x = sx(c.x), y = sy(c.y);
        if (Math.abs(x - sx(e.x)) > R * 1.4 || Math.abs(y - sy(e.y)) > R * 1.4) continue;
        ctx.fillStyle = 'rgba(24,16,20,' + (0.18 + 0.4 * prog) + ')';
        ctx.beginPath(); ctx.arc(x, y, c.r, 0, TAU); ctx.fill();
        // falling cinder
        const drop = (t * 380 + ((c.x * 7 + c.y * 3) % 320)) % 320;
        ctx.fillStyle = 'rgba(255,180,110,' + (0.35 + 0.5 * prog) + ')';
        ctx.beginPath(); ctx.arc(x, y - drop, 3, 0, TAU); ctx.fill();
      }
    }
  }

  // ---- 2D phase burst ----------------------------------------------------
  function phase2(ctx, e, pa, t, env) {
    const cam = env.cam || { x: 0, y: 0, sx: 0, sy: 0 };
    const cx = e.x - cam.x - (cam.sx || 0), cy = e.y - cam.y - (cam.sy || 0);
    const p = clamp(pa.t / pa.dur, 0, 1);
    const fade = 1 - p;
    const RR = rad(e);
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    for (let i = 0; i < 26; i++) {
      const a = (i / 26) * TAU + t;
      const d = RR + p * 520 * (0.6 + ((i * 41) % 100) / 140);
      ctx.fillStyle = 'rgba(255,' + (150 + (i % 3) * 25) + ',100,' + (0.7 * fade) + ')';
      ctx.beginPath(); ctx.arc(cx + Math.cos(a) * d, cy + Math.sin(a) * d, 3.4, 0, TAU); ctx.fill();
    }
    glowCircle(ctx, cx, cy, RR * (2.4 + p * 1.8), 'rgba(255,240,210,' + (0.8 * fade) + ')', 'rgba(255,120,40,0)');
    ctx.restore();
  }

  function bodyTop2(ctx, e, t) { body2(ctx, e, t); }

  // the fallback renderer's own per-stage body effects
  function stageAura2D(ctx, cx, cy, rr, t, stage) {
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    if (stage <= 1) {
      for (let i = 0; i < 9; i++) {
        const p = (t * 0.3 + i * 0.11) % 1;
        const a = i * 2.3 + t * 0.2;
        ctx.fillStyle = 'rgba(150,132,120,' + (0.55 * (1 - p)) + ')';
        ctx.beginPath();
        ctx.arc(cx + Math.cos(a) * rr * 0.85, cy - rr * 0.8 + p * rr * 1.9, 1.8 + (1 - p) * 1.4, 0, TAU);
        ctx.fill();
      }
    } else if (stage === 2) {
      for (let i = 0; i < 10; i++) {
        const p = (t * 1.1 + i * 0.1) % 1;
        ctx.fillStyle = 'rgba(255,150,60,' + (0.8 * (1 - p)) + ')';
        ctx.beginPath();
        ctx.arc(cx + Math.sin(i * 1.7 + t * 3) * rr * 0.16, cy + rr * 0.2 - p * rr * 2.4, 2.6 * (1 - p * 0.5), 0, TAU);
        ctx.fill();
      }
    } else if (stage === 3) {
      for (let i = 0; i < 7; i++) {
        const a = t * 0.8 + (i / 7) * TAU;
        const d = rr * (0.7 + 0.35 * Math.sin(i * 2.1 + t));
        const px = cx + Math.cos(a) * d, py = cy + Math.sin(a) * d * 0.85;
        ctx.save();
        ctx.translate(px, py);
        ctx.rotate(a * 2.4 + t);
        ctx.fillStyle = 'rgba(255,214,150,0.85)';
        ctx.fillRect(-6, -3, 12, 6);
        ctx.restore();
      }
      for (let i = 0; i < 5; i++) {
        const p = (t * 0.9 + i * 0.2) % 1;
        const a = i * 2.6;
        ctx.fillStyle = 'rgba(255,160,70,' + (0.7 * (1 - p)) + ')';
        ctx.beginPath();
        ctx.arc(cx + Math.cos(a) * rr * (0.5 + p), cy + Math.sin(a) * rr * (0.5 + p * 0.8), 2.4 * (1 - p), 0, TAU);
        ctx.fill();
      }
    } else {
      for (let i = 0; i < 14; i++) {
        const p = (t * 0.9 + i * 0.07) % 1;
        const a = i * 1.7;
        ctx.fillStyle = i % 6 === 0 ? 'rgba(255,170,80,' + (0.6 * (1 - p)) + ')' : 'rgba(140,122,110,' + (0.5 * (1 - p)) + ')';
        ctx.beginPath();
        ctx.arc(cx + Math.cos(a) * rr * 1.9 * (0.3 + p * 0.7), cy - rr * 0.5 + p * rr * 2.2, 2 + (1 - p) * 1.6, 0, TAU);
        ctx.fill();
      }
      for (let i = 0; i < 2; i++) {
        const k = (t * 0.55 + i / 2) % 1;
        ctx.strokeStyle = 'rgba(255,88,48,' + (0.5 * (1 - k)) + ')';
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(cx, cy, rr * (3.0 - k * 2.2), 0, TAU); ctx.stroke();
      }
    }
    ctx.restore();
  }

  function draw2D(e, ctx, cx, cy, t, env) {
    if (!ctx) return;
    const RR = rad(e);
    const st = stOf(e);

    // ground shadow
    ctx.save();
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = 'rgba(0,0,0,.46)';
    ctx.beginPath(); ctx.ellipse(cx, cy + RR * 0.82, RR, RR * 0.42, 0, 0, TAU); ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.translate(cx, cy);
    // no halo behind the art — the sprite's own detail has to read
    // soot ring on the floor
    ctx.save();
    ctx.scale(1, 0.45);
    ring2(ctx, 0, RR * 1.75, RR * 1.55, t * 0.4, 'rgba(190,140,110,.6)', 3);
    ctx.restore();
    if (imgReady) {
      const sh = RR * 2.8;
      const sw = sh * spriteAR();
      ctx.drawImage(img, -sw / 2, -sh / 2, sw, sh);
    } else {
      bodyTop2(ctx, e, t);
    }
    if (st.hitFlash > 0) {
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      ctx.globalAlpha = clamp(st.hitFlash, 0, 1) * 0.8;
      glowCircle(ctx, 0, 0, RR * 1.1, 'rgba(255,255,255,1)', 'rgba(255,180,120,0)');
      ctx.restore();
    }
    ctx.restore();

    stageAura2D(ctx, cx, cy, RR, t, stageOf(e));

    if (st.cur) telegraph2(ctx, e, st.cur, t, env);
    if (st.phaseAnim) phase2(ctx, e, st.phaseAnim, t, env);

    // health ring + stage pips
    const hpR = clamp((e.hp || 0) / Math.max(1, e.maxhp || e.hp || 1), 0, 1);
    ctx.save();
    ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(0,0,0,.7)';
    ctx.lineWidth = 6;
    ctx.beginPath(); ctx.arc(cx, cy, RR + 12, 0, TAU); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,160,100,.95)';
    ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(cx, cy, RR + 12, -Math.PI / 2, -Math.PI / 2 + hpR * TAU); ctx.stroke();
    const stage = stageOf(e);
    for (let i = 0; i < 4; i++) {
      const a = -Math.PI / 2 + (i / 4) * TAU;
      ctx.fillStyle = i < stage ? 'rgba(255,226,190,1)' : 'rgba(255,255,255,.22)';
      ctx.beginPath(); ctx.arc(cx + Math.cos(a) * (RR + 24), cy + Math.sin(a) * (RR + 24), 4, 0, TAU); ctx.fill();
    }
    ctx.restore();
  }

  // =========================================================================
  //  3D  RENDERER
  // =========================================================================
  const U = (R) => R.unit;
  const M4 = (R, ...a) => R.mm(...a);
  const MAT = (R, c, o) => R.mat(c, o || {});

  function band(R, x1, z1, x2, z2, w, col, a, step) {
    const dx = x2 - x1, dz = z2 - z1;
    const len = Math.hypot(dx, dz);
    if (len < 1) return;
    const n = clamp(Math.round(len / (step || 46)), 2, 40);
    const rot = Math.atan2(dz, dx);
    for (let i = 0; i < n; i++) {
      const u = i / (n - 1);
      R.decal(x1 + dx * u, z1 + dz * u, w, col[0], col[1], col[2], a, 9, 0, rot, true, 1.9);
    }
  }

  function ring(R, x, z, radius, col, a, kind, param, spin, y) {
    R.decal(x, z, radius * 2, col[0], col[1], col[2], a, kind === undefined ? 9 : kind, param || 0, spin || 0, true, y === undefined ? 2 : y);
  }

  // the body used only until the sprite has loaded
  function body3(R, e, tt, hb) {
    const rr = rad(e), stage = stageOf(e);
    const x = e.x, z = e.y;
    const UU = U(R);
    const pl = (window.__caPlayer || { x: x + 100, y: z });
    const ang = Math.atan2(pl.y - z, pl.x - x);

    // soot robes
    R.draw(UU.rock3, M4(R, x, hb, z, ang + Math.PI * 0.5, rr * 1.05, rr * 1.55, rr * 0.95),
      MAT(R, F.ash, { rough: 0.85, metal: 0.1, emissive: [0.05, 0.03, 0.03], emisK: 1.2, rim: 1.2, rimCol: F.ember }));
    // rising hem embers
    const hemN = dq(R, 10);
    for (let i = 0; i < hemN; i++) {
      const a = (i / hemN) * TAU + tt * 0.3;
      const d = rr * (1.05 + 0.2 * Math.sin(i * 1.7 + tt));
      R.draw(UU.cone, M4(R, x + Math.cos(a) * d, hb - rr * 1.1, z + Math.sin(a) * d, a, rr * 0.16, rr * 0.9, rr * 0.16, Math.PI),
        MAT(R, [1, 1, 1], { emissive: F.kindle, emisK: 1.6, alpha: 0.7, shadow: false }));
    }
    // masks orbiting the mass
    const masks = dq(R, 3 + stage);
    for (let i = 0; i < masks; i++) {
      const a = tt * 0.55 + (i / masks) * TAU;
      const d = rr * (0.62 + 0.18 * Math.sin(i * 1.9 + tt * 0.7));
      R.draw(UU.sphereLo, M4(R, x + Math.cos(a) * d, hb + rr * (0.1 + 0.3 * Math.sin(i * 2.3)), z + Math.sin(a) * d,
        a, rr * 0.22, rr * 0.3, rr * 0.22),
        MAT(R, F.bone, { rough: 0.5, emissive: [0.16, 0.13, 0.10], emisK: 1.2, shadow: false }));
      R.glow(x + Math.cos(a) * d, hb + rr * (0.1 + 0.3 * Math.sin(i * 2.3)), z + Math.sin(a) * d, rr * 0.42, 2.0, 0.7, 0.28, 0.6, 0);
    }
    R.glow(x, hb, z, rr * 2.6, 1.9, 0.8, 0.35, 0.55 + 0.15 * Math.sin(tt * 3), 0);
  }

  function aura3(R, e, tt, hb) {
    const rr = rad(e), stage = stageOf(e);
    const x = e.x, z = e.y;
    const pl = (window.__caPlayer || { x: x + 100, y: z });
    const ang = Math.atan2(pl.y - z, pl.x - x);
    const UU = U(R);

    // broken halo of charred bell fragments
    const fragN = dq(R, 12);
    for (let i = 0; i < fragN; i++) {
      const a = (i / fragN) * TAU + tt * 0.22;
      const d = rr * (0.95 + 0.1 * Math.sin(i * 2.1 + tt));
      const s = rr * (0.10 + 0.05 * Math.sin(i * 3.1 + tt * 3));
      R.draw(UU.octa, M4(R, x + Math.cos(a) * d, hb + rr * 0.72 + Math.sin(i + tt) * rr * 0.14, z + Math.sin(a) * d, a * 1.4, s, s * 1.6, s),
        MAT(R, [0.9, 0.8, 0.72], { emissive: F.ember, emisK: 1.6, rough: 0.6, shadow: false }));
    }
    ring(R, x, z, rr * (1.9 + stage * 0.2), F.ember, 0.30 + 0.10 * Math.sin(tt * 2), 9, 0, tt * 0.4);
    ring(R, x, z, rr * (1.3 + stage * 0.15), F.kindle, 0.22, 6, 0, -tt * 0.7);

    // the singing wound: a bright core in the chest, aimed where it will sing
    R.draw(UU.sphereLo, M4(R, x + Math.cos(ang) * rr * 0.35, hb + rr * 0.15, z + Math.sin(ang) * rr * 0.35, 0, rr * 0.26, rr * 0.3, rr * 0.26),
      MAT(R, [1, 1, 1], { emissive: F.hot, emisK: 2.6, shadow: false }));
    R.glow(x + Math.cos(ang) * rr * 0.35, hb + rr * 0.15, z + Math.sin(ang) * rr * 0.35, rr * 1.6, 2.2, 1.0, 0.45, 0.85 * (imgReady ? 0.3 : 1), 0);

    if (!imgReady) R.glow(x, hb, z, rr * 2.4, 1.6, 0.7, 0.32, 0.45 + 0.15 * Math.sin(tt * 2.6), 0);
    R.light(x, z, hb + 30, 260 + stage * 46, 1.5, 0.6, 0.28, 0.6 + 0.2 * Math.sin(tt * 2.6));

    stageAura3(R, e, tt, hb, stage);
  }

  // ---- what the Choir gives off, one look per stage ---------------------
  // The Sealwright spends gold law-motes and the stag sheds frost, so the
  // Choir is not allowed either: it burns, and every stage changes the way
  // its own smoke moves rather than just how much of it there is.
  function stageAura3(R, e, tt, hb, stage) {
    const rr = rad(e), x = e.x, z = e.y;
    const q = (R.q && R.q.parts) || 1;
    const UU = U(R), mm = R.mm, mat = R.mat;
    const SOOT = [0.42, 0.34, 0.3], PAGE = [1.5, 1.12, 0.78];

    if (stage <= 1) {
      // I — kindling: dry ash sifts off the robes and smoulders out below it
      for (let i = 0; i < 3; i++) {
        if (Math.random() < 0.45 * q) {
          const a = Math.random() * TAU, d = rr * (0.5 + Math.random() * 0.9);
          R.emit({
            x: x + Math.cos(a) * d, y: hb + rr * (0.2 + Math.random() * 0.9), z: z + Math.sin(a) * d,
            vx: (Math.random() - 0.5) * 10, vy: -10 - Math.random() * 14, vz: (Math.random() - 0.5) * 10,
            life: 1.6 + Math.random() * 0.9, age: 0, s0: 5, s1: 2,
            col: Math.random() < 0.22 ? F.ember : SOOT, a: 0.6, kind: 0, drag: 0.55, grav: 10
          });
        }
      }
      return;
    }

    if (stage === 2) {
      // II — a taut cinder column off the singing wound, straight up
      for (let i = 0; i < 4; i++) {
        if (Math.random() < 0.6 * q) {
          const a = Math.random() * TAU, d = rr * 0.14 * Math.random();
          R.emit({
            x: x + Math.cos(a) * d, y: hb + rr * (0.1 + Math.random() * 0.3), z: z + Math.sin(a) * d,
            vx: (Math.random() - 0.5) * 5, vy: 120 + Math.random() * 90, vz: (Math.random() - 0.5) * 5,
            life: 0.9 + Math.random() * 0.4, age: 0, s0: 6, s1: 1,
            col: Math.random() < 0.5 ? F.ember : F.hot, a: 0.9, kind: 0, drag: 0.25
          });
        }
      }
      R.draw(UU.cyl, mm(x, hb + rr * 1.1, z, 0, rr * 0.3, rr * 1.9, rr * 0.3),
        mat([1, 1, 1], { emissive: F.kindle, emisK: 1.5, alpha: 0.10 + 0.05 * Math.sin(tt * 6), shadow: false }));
      return;
    }

    if (stage === 3) {
      // III — the chorus tears pages loose and they burn on the way out
      for (let i = 0; i < dq(R, 3); i++) {
        if (Math.random() < 0.7 * q) {
          const a = Math.random() * TAU, d = rr * (0.3 + Math.random() * 0.7);
          R.emit({
            x: x + Math.cos(a) * d, y: hb + rr * (0.1 + Math.random() * 0.8), z: z + Math.sin(a) * d,
            vx: Math.cos(a) * (40 + Math.random() * 60), vy: 40 + Math.random() * 60, vz: Math.sin(a) * (40 + Math.random() * 60),
            life: 1.0 + Math.random() * 0.6, age: 0, s0: 9, s1: 4,
            col: PAGE, a: 0.85, kind: 0, drag: 0.35, grav: 30,
            mesh: 'box', sy: 0.12, vry: (Math.random() - 0.5) * 9, vrx: (Math.random() - 0.5) * 6, em: 1.3
          });
        }
      }
      for (let i = 0; i < 2; i++) {
        if (Math.random() < 0.5 * q) {
          const a = Math.random() * TAU, d = rr * (0.4 + Math.random() * 0.8);
          R.emit({
            x: x + Math.cos(a) * d, y: hb + rr * 0.2, z: z + Math.sin(a) * d,
            vx: Math.cos(a) * 30, vy: 70 + Math.random() * 50, vz: Math.sin(a) * 30,
            life: 0.8, age: 0, s0: 8, s1: 1, col: F.ember, a: 0.9, kind: 0, drag: 0.4
          });
        }
      }
      return;
    }

    // IV — ashfall: soot rains in from the whole vault and the embers are
    // dragged back into the wound before they flare
    for (let i = 0; i < 6; i++) {
      if (Math.random() < 0.7 * q) {
        const a = Math.random() * TAU, d = Math.random() * rr * 2.4;
        R.emit({
          x: x + Math.cos(a) * d, y: hb + 240 + Math.random() * 120, z: z + Math.sin(a) * d,
          vx: (Math.random() - 0.5) * 20, vy: -150 - Math.random() * 90, vz: (Math.random() - 0.5) * 20,
          life: 1.3, age: 0, s0: 5, s1: 4,
          col: Math.random() < 0.18 ? F.ember : SOOT, a: 0.55, kind: 0, drag: 0.05, fade: 'in'
        });
      }
    }
    for (let i = 0; i < 4; i++) {
      if (Math.random() < 0.6 * q) {
        const a = Math.random() * TAU, d = rr * (1.6 + Math.random() * 1.2);
        R.emit({
          x: x + Math.cos(a) * d, y: hb + Math.random() * rr, z: z + Math.sin(a) * d,
          vx: -Math.cos(a) * (60 + Math.random() * 70), vy: 10 + Math.random() * 30, vz: -Math.sin(a) * (60 + Math.random() * 70),
          life: 0.8 + Math.random() * 0.4, age: 0, s0: 7, s1: 2, col: F.hot, a: 0.9, kind: 0, drag: 0.15
        });
      }
    }
    for (let i = 0; i < 2; i++) {
      const k = (tt * 0.55 + i / 2) % 1;
      ring(R, x, z, rr * (3.0 - k * 2.2), F.hot, (1 - k) * 0.3, 9, 0, tt * 0.4, 2.4);
    }
  }

  // ---- 3D attack telegraphs ----------------------------------------------
  function telegraph3(R, e, cur, tt, hb, env) {
    if (cur.phase !== 'tele' && cur.phase !== 'active') return;
    const UU = U(R);
    const on = cur.phase === 'active';
    const prog = cur.phase === 'tele' ? clamp(cur.t / cur.phases.tele, 0, 1) : 1;
    const rr = rad(e), x = e.x, z = e.y;

    R.glow(x, hb, z, rr * (2.0 + prog * 0.9), 1.7, 0.8, 0.38, (0.35 + 0.45 * prog) * (on ? 1.25 : 1), 0);
    if (!on) ring(R, x, z, rr * (2.1 + prog * 1.4), F.ember, 0.32 + 0.4 * prog, 9, 0, tt * 1.2);

    const shake = (v) => { if (env && env.cam) env.cam.shake = Math.max(env.cam.shake || 0, v); };

    const beam3 = (ang, len, w, live) => {
      const ca = Math.cos(ang), sa = Math.sin(ang);
      const bx = x + ca * len, bz = z + sa * len;
      // The Choir's lane is a ragged throat of fire — soot, splayed flame
      // tongues, widening as it runs. It is never the Sealwright's ruled rail.
      if (window.SentinelFX && SentinelFX.throat) {
        SentinelFX.throat(R, x, z, bx, bz, w, live ? 1 : 0.28 + 0.55 * prog, prog, live, tt);
      } else {
        band(R, x, z, bx, bz, w * 1.5, F.ember, live ? 0.6 : 0.16 + 0.24 * prog);
        band(R, x, z, bx, bz, w * 0.55, F.hot, live ? 0.92 : 0.22 + 0.3 * prog);
      }

      if (!live) {
        // the charge runs down the lane while the verse is still gathering
        for (let i = 0; i < 5; i++) {
          const v = ((cur.t * 1.6 + i * 0.2) % 1);
          R.decal(x + ca * len * v, z + sa * len * v, w * (2.0 - i * 0.26),
            F.hot[0], F.hot[1], F.hot[2], (0.45 + 0.35 * prog) * (1 - v * 0.55), 9, 0, ang, true, 1.8);
        }
        shake(0.7 * prog);
        return;
      }

      const pulse = 0.9 + 0.1 * Math.sin(tt * 26);
      // the mouth of the verse and the fireball where it lands
      R.glow(x + ca * 34, hb * 0.7, z + sa * 34, w * 2.8, 2.4, 1.2, 0.5, 0.9, 0);
      R.draw(UU.sphereLo, M4(R, bx, 40, bz, 0, w * 0.8, w * 0.85, w * 0.8),
        MAT(R, [1, 1, 1], { emissive: F.hot, emisK: 2.6, alpha: 0.5 * pulse, shadow: false }));
      R.glow(bx, 40, bz, w * 3.4, 2.4, 1.2, 0.5, 0.8, 0);
      R.light(x + ca * len * 0.3, z + sa * len * 0.3, 60, 320, 1.7, 0.8, 0.35, 0.85);
      R.light(bx, bz, 60, 250, 1.9, 0.9, 0.4, 0.8);
      shake(2.6);

      // the lane stays scorched behind the fire: the arena remembers the verse
      for (let i = 0; i < 5; i++) {
        const u = (i + 0.5) / 5;
        R.decal(x + ca * len * u, z + sa * len * u, w * (1.15 + i * 0.16), 0.05, 0.03, 0.03, 0.26, 0, 0, 0, true, 1.6);
      }

      // cinders torn off the lane
      for (let i = 0; i < dq(R, 3); i++) {
        const u = Math.random();
        R.emit({
          x: x + ca * len * u, y: 20 + Math.random() * 70, z: z + sa * len * u,
          vx: (Math.random() - 0.5) * 90, vy: 60 + Math.random() * 120, vz: (Math.random() - 0.5) * 90,
          life: 0.5 + Math.random() * 0.5, age: 0, s0: 9, s1: 1,
          col: Math.random() < 0.5 ? F.ember : F.hot, a: 0.9, kind: 0, drag: 0.5
        });
      }
    };

    // A marked patch of ground: a seal that turns, closes in on its beat and
    // then erupts, rather than a plain coloured circle.
    // A marked patch of ground: the Choir's own shape — a charred patch
    // ringed by tongues of flame (sentinel_fx_kit.js) — never a plain ring.
    const mark3 = (mk, live, a) => {
      if (window.SentinelFX) {
        window.SentinelFX.burn(R, mk.x, mk.y, mk.r, live ? 1 : Math.min(0.9, 0.3 + 0.6 * a), tt, live);
      } else {
        const col = live ? F.hot : F.ember;
        ring(R, mk.x, mk.y, mk.r, col, live ? 0.9 : 0.2 + 0.45 * a, 9, 0, tt * 1.4);
        ring(R, mk.x, mk.y, mk.r * 0.62, F.kindle, live ? 0.6 : 0.25 + 0.4 * a, 6, 0, -tt * 1.8);
      }
      if (!live) return;
      R.draw(UU.cone, M4(R, mk.x, 44, mk.y, 0, mk.r * 0.5, 92, mk.r * 0.5),
        MAT(R, [1, 1, 1], { emissive: F.kindle, emisK: 2.4, alpha: 0.72, shadow: false }));
      R.draw(UU.sphereLo, M4(R, mk.x, 48, mk.y, 0, mk.r * 0.52, mk.r * 0.7, mk.r * 0.52),
        MAT(R, [1, 1, 1], { emissive: F.hot, emisK: 2.6, alpha: 0.55, shadow: false }));
      R.glow(mk.x, 34, mk.y, mk.r * 2.6, 2.2, 1.0, 0.45, 0.8, 0);
      R.light(mk.x, mk.y, 50, 240, 1.9, 0.85, 0.4, 0.85);
      for (let i = 0; i < dq(R, 2); i++) {
        const a2 = Math.random() * TAU;
        R.emit({
          x: mk.x + Math.cos(a2) * mk.r * 0.5, y: 20, z: mk.y + Math.sin(a2) * mk.r * 0.5,
          vx: Math.cos(a2) * 90, vy: 90 + Math.random() * 110, vz: Math.sin(a2) * 90,
          life: 0.5 + Math.random() * 0.45, age: 0, s0: 10, s1: 1,
          col: Math.random() < 0.5 ? F.ember : F.hot, a: 0.9, kind: 0, drag: 0.45
        });
      }
    };

    if (cur.key === 'cinderCanticle' || cur.key === 'finaleOfEmbers') {
      beam3(cur.ang, cur.len, cur.w, on && (cur.key !== 'finaleOfEmbers' || cur.t <= 1.15));
      if (cur.marks) for (const mk of cur.marks) mark3(mk, mk.fired, prog);
    } else if (cur.key === 'hollowRefrain' && cur.beams) {
      for (const bm of cur.beams) {
        beam3(bm.ang, cur.len, cur.w, on && cur.t >= bm.from && cur.t <= bm.to);
      }
    } else if (cur.key === 'ashenNotes' && cur.zones) {
      for (const zn of cur.zones) mark3(zn, zn.fired, prog);
    } else if (cur.key === 'funeralChorus' && cur.rings) {
      for (const r of cur.rings) {
        const age = on ? cur.t - r.born : -1;
        const radius = age >= 0 ? age * r.sp : rr * (1.0 + prog * 0.6);
        if (age > 2.6) continue;
        const a = age >= 0 ? clamp(1 - age / 2.6, 0, 1) : 0.35 + 0.4 * prog;
        // Three arms of fire wheeling outward — the same three voices as the
        // telegraph, never the closed ring of light the Sealwright's law
        // stamps into the floor.
        const spin = tt * 0.7 + (age > 0 ? age * 2.2 : 0);
        for (let arm = 0; arm < 3; arm++) {
          const base = spin + (arm / 3) * TAU;
          const segs = dq(R, 9);
          for (let i = 0; i < segs; i++) {
            const ang = base + (i / (segs - 1)) * 1.2;
            const h = (age >= 0 ? 30 * a + 8 : 16 + 14 * prog) * (0.72 + 0.42 * Math.sin(i * 2.1 + tt * 5 + arm));
            R.draw(UU.cone, M4(R, x + Math.cos(ang) * radius, h * 0.45, z + Math.sin(ang) * radius, ang, 11, h, 11),
              MAT(R, [1, 1, 1], { emissive: age >= 0 ? F.ember : F.kindle, emisK: age >= 0 ? 2.2 : 1.6, alpha: (age >= 0 ? 0.85 : 0.5) * Math.max(a, 0.28), shadow: false }));
            if (age >= 0 && i % 3 === 0) {
              R.draw(UU.cone, M4(R, x + Math.cos(ang) * radius * 0.97, h * 0.8, z + Math.sin(ang) * radius * 0.97, ang, 5, h * 0.7, 5),
                MAT(R, [1, 1, 1], { emissive: F.hot, emisK: 2.4, alpha: 0.7 * a, shadow: false }));
            }
          }
        }
        if (age >= 0) {
          // the ground it has passed over is scorched, not lit up
          R.decal(x, z, radius * 2.05, 0.06, 0.04, 0.04, 0.3 * a, 0, 0, 0, true, 1.4);
          R.light(x + Math.cos(spin) * radius * 0.7, z + Math.sin(spin) * radius * 0.7, 24, 230, 1.6, 0.35, 0.15, 0.5 * a);
          // and fire keeps rising off the burnt ring in three sheets, so the
          // chorus leaves a burning wake instead of a clean circle
          for (let arm = 0; arm < 3; arm++) {
            const ang2 = spin + (arm / 3) * TAU + 0.55;
            const h = 74 * a * (0.7 + 0.3 * Math.sin(tt * 7 + arm));
            R.draw(UU.cone, M4(R, x + Math.cos(ang2) * radius, h * 0.45, z + Math.sin(ang2) * radius, ang2, 13, h, 13),
              MAT(R, [1, 1, 1], { emissive: F.kindle, emisK: 1.8, alpha: 0.42 * a, shadow: false }));
          }
        }
      }
    } else if (cur.key === 'sootboundVoices' && cur.nodes) {
      const pl2 = (env && env.player) || window.__caPlayer || { x: e.x + 100, y: e.y };
      for (const nd of cur.nodes) {
        if (nd.dead) continue;
        const wob = Math.sin(tt * 3 + nd.x * 0.05) * 4;
        // a hood of soot...
        R.draw(UU.sphereLo, M4(R, nd.x, 30 + wob, nd.y, 0, nd.r * 0.95, nd.r * 1.5, nd.r * 0.95),
          MAT(R, F.ash, { rough: 0.9, emissive: [0.14, 0.06, 0.04], emisK: 1.4, shadow: false }));
        // ...whose hem frays into drifting soot
        for (let i = 0; i < dq(R, 5); i++) {
          const ha = (i / 5) * TAU + tt * 0.8;
          R.draw(UU.cone, M4(R, nd.x + Math.cos(ha) * nd.r * 0.78, 12 - wob, nd.y + Math.sin(ha) * nd.r * 0.78,
            ha, nd.r * 0.2, nd.r * 1.15, nd.r * 0.2, Math.PI),
            MAT(R, [1, 1, 1], { emissive: [0.14, 0.09, 0.09], emisK: 1.1, alpha: 0.55, shadow: false }));
        }
        // the mask it lost, looking straight at you
        R.draw(UU.sphereLo, M4(R, nd.x, 42 + wob, nd.y, 0, nd.r * 0.38, nd.r * 0.5, nd.r * 0.38),
          MAT(R, F.bone, { emissive: [0.3, 0.24, 0.18], emisK: 1.5, shadow: false }));
        const ea = Math.atan2(pl2.y - nd.y, pl2.x - nd.x);
        const ex = Math.cos(ea) * nd.r * 0.18, ez = Math.sin(ea) * nd.r * 0.18;
        const px2 = -Math.sin(ea) * nd.r * 0.17, pz2 = Math.cos(ea) * nd.r * 0.17;
        for (const s of [-1, 1]) {
          R.draw(UU.sphereLo, M4(R, nd.x + ex + px2 * s, 44 + wob, nd.y + ez + pz2 * s, 0, 3.4, 3.4, 3.4),
            MAT(R, [1, 1, 1], { emissive: F.hot, emisK: 2.6, shadow: false }));
          R.glow(nd.x + ex + px2 * s, 44 + wob, nd.y + ez + pz2 * s, 18, 2.2, 1.0, 0.4, 0.75, 0);
        }
        // a soot tether back to the mass it was torn from
        band(R, e.x, e.y, nd.x, nd.y, nd.r * 1.3, [0.16, 0.10, 0.10], 0.55, 62);
        if (Math.random() < 0.5 * ((R.q && R.q.parts) || 1)) {
          R.emit({
            x: nd.x, y: 18 + Math.random() * 44, z: nd.y,
            vx: (Math.random() - 0.5) * 46, vy: 60 + Math.random() * 80, vz: (Math.random() - 0.5) * 46,
            life: 0.8, age: 0, s0: 6, s1: 1,
            col: Math.random() < 0.4 ? F.ember : F.ash, a: 0.7, kind: 0, drag: 0.4
          });
        }
        // how much voice is left in it
        const hpF = clamp(nd.hp / 60, 0, 1);
        ring(R, nd.x, nd.y, nd.r * 1.8, F.ember, 0.22 + 0.45 * hpF, 9, 0, tt);
        R.glow(nd.x, 34, nd.y, nd.r * 2.4, 1.9, 0.8, 0.34, 0.6, 0);
      }
    } else if (cur.key === 'pyreProcession' && cur.lanes) {
      const W = cur.w;
      for (const ln of cur.lanes) {
        if (!on || cur.t < ln.born) continue;
        const p = -200 + (cur.t - ln.born) * ln.sp;
        const span = 2400;
        if (ln.axis === 'h') {
          band(R, p - W, 0, p - W, span, W, F.ember, 0.4);
          band(R, p, 0, p, span, W * 0.7, F.hot, 0.55);
          for (let i = 0; i < 10; i++) {
            const zz = (i / 10) * span;
            R.draw(UU.cone, M4(R, p + Math.sin(i + tt * 6) * W * 0.25, 22, zz, 0, 10, 40, 10),
              MAT(R, [1, 1, 1], { emissive: F.kindle, emisK: 1.9, alpha: 0.5, shadow: false }));
          }
          R.glow(p, 30, z % span, 340, 2.0, 0.9, 0.4, 0.5, 0);
          // the wall of fire throws its own embers ahead of it
          for (let i = 0; i < dq(R, 7); i++) {
            R.emit({
              x: Math.random() * span, y: 14, z: p,
              vx: (Math.random() - 0.5) * 40, vy: 70 + Math.random() * 90, vz: (Math.random() - 0.5) * 40,
              life: 0.55 + Math.random() * 0.45, age: 0, s0: 8, s1: 1,
              col: Math.random() < 0.5 ? F.ember : F.hot, a: 0.85, kind: 0, drag: 0.5
            });
          }
        } else {
          band(R, 0, p - W, span, p - W, W, F.ember, 0.4);
          band(R, 0, p, span, p, W * 0.7, F.hot, 0.55);
          for (let i = 0; i < 10; i++) {
            const xx = (i / 10) * span;
            R.draw(UU.cone, M4(R, xx, 22, p + Math.sin(i + tt * 6) * W * 0.25, 0, 10, 40, 10),
              MAT(R, [1, 1, 1], { emissive: F.kindle, emisK: 1.9, alpha: 0.5, shadow: false }));
          }
          for (let i = 0; i < dq(R, 7); i++) {
            R.emit({
              x: p, y: 14, z: Math.random() * span,
              vx: (Math.random() - 0.5) * 40, vy: 70 + Math.random() * 90, vz: (Math.random() - 0.5) * 40,
              life: 0.55 + Math.random() * 0.45, age: 0, s0: 8, s1: 1,
              col: Math.random() < 0.5 ? F.ember : F.hot, a: 0.85, kind: 0, drag: 0.5
            });
          }
        }
      }
    } else if (cur.key === 'ashfallCathedral' && cur.cells) {
      for (const s of cur.safe) {
        ring(R, s.x, s.y, s.r, F.hot, 0.85, 9, 0, tt * 0.8);
        ring(R, s.x, s.y, s.r * 0.78, F.ember, 0.5, 6, 0, -tt);
        R.draw(UU.disc, M4(R, s.x, 4, s.y, 0, s.r * 1.5, 1, s.r * 1.5),
          MAT(R, [1, 1, 1], { emissive: [0.35, 0.22, 0.12], emisK: 1.0, alpha: 0.30, shadow: false }));
        // a shelter of cool light so the safe ground is unmistakable
        R.draw(UU.sphere, M4(R, s.x, 26, s.y, 0, s.r * 0.95, s.r * 0.85, s.r * 0.95),
          MAT(R, [1, 1, 1], { emissive: [0.22, 0.30, 0.22], emisK: 0.9, alpha: 0.10 + 0.04 * Math.sin(tt * 3), shadow: false }));
        R.light(s.x, s.y, 22, s.r * 2.4, 1.2, 1.1, 0.7, 0.5);
      }
      const budget = Math.round(clamp(cur.cells.length, 0, 140) * (R.q.parts || 1));
      for (let i = 0; i < budget; i++) {
        const c = cur.cells[(i * 7 + (R.frame || 0)) % cur.cells.length];
        if (!c) continue;
        const beat = 0.5 + 0.5 * Math.sin(tt * 4 + i);
        R.decal(c.x, c.y, c.r * 2, F.kindle[0], F.kindle[1], F.kindle[2], 0.10 + 0.16 * prog + 0.06 * beat, 9, 0, 0, true, 1.8);
        if (i % 3 === 0) {
          const drop = ((tt * 380 + i * 47) % 340);
          R.draw(UU.sphereLo, M4(R, c.x, 300 - drop, c.y, 0, 4, 4, 4),
            MAT(R, [1, 1, 1], { emissive: F.ember, emisK: 2.2, shadow: false }));
        }
        // every few cells the vault itself opens and embers pour down a shaft
        if (i % 9 === 0) {
          const drop = ((tt * 380 + i * 47) % 340);
          R.draw(UU.cyl, M4(R, c.x, 330 - drop * 0.5, c.y, 0, c.r * 0.42, 300, c.r * 0.42),
            MAT(R, [1, 1, 1], { emissive: F.kindle, emisK: 1.2, alpha: 0.07 + 0.05 * Math.sin(tt * 5 + i), shadow: false }));
          R.draw(UU.cone, M4(R, c.x, 300 - drop, c.y, 0, c.r * 0.5, 26, c.r * 0.5, Math.PI),
            MAT(R, [1, 1, 1], { emissive: F.hot, emisK: 2.0, alpha: 0.35 + 0.2 * prog, shadow: false }));
        }
      }
    }
  }

  function phase3(R, e, pa, tt, hb) {
    const rr = rad(e), x = e.x, z = e.y;
    const p = clamp(pa.t / pa.dur, 0, 1);
    const fade = 1 - p;
    ring(R, x, z, rr * (1.6 + p * 4.2), F.hot, 0.8 * fade, 9, 0, 0, 2.4);
    R.glow(x, hb, z, rr * (2.6 + p * 3.0), 2.2, 1.2, 0.6, 0.85 * fade, 0);
    R.light(x, z, hb + 40, 340, 2.0, 0.9, 0.4, fade);
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * TAU + tt;
      const d = rr * (1.0 + p * 3.4);
      R.emit({
        x: x + Math.cos(a) * rr, y: hb + Math.random() * rr, z: z + Math.sin(a) * rr,
        vx: Math.cos(a) * d * 2.2, vy: 90 + Math.random() * 140, vz: Math.sin(a) * d * 2.2,
        life: 0.7 + Math.random() * 0.5, age: 0, s0: 12, s1: 1,
        col: Math.random() < 0.5 ? F.ember : F.hot, a: 0.95, kind: 0, drag: 0.35
      });
    }
  }

  function draw3D(R, e, tt, env) {
    if (!R || !R.ok || !env) return;
    const rr = rad(e);
    const st = stOf(e);
    const hb = rr * 1.2 + Math.sin(tt * 2.2) * 3.5;
    if (env.player) window.__caPlayer = env.player;

    R.decal(e.x, e.y, rr * 3.1, 0, 0, 0, 0.44, 9, 0, 0, false, 1.3);

    if (imgReady) {
      const sp = R.spriteMesh(img, { depth: 0.5, power: 0.45 });
      if (sp) {
        const pl = env.player || (R.F && R.F.me) || { x: e.x + 100, y: e.y };
        const ang = Math.atan2(pl.y - e.y, pl.x - e.x);
        const size = (rr + 20) * 2.2;
        // a whisper of rim only: an ember halo this close eats the masks
        const m = MAT(R, [1, 1, 1], { tex: sp.tex, emis: sp.emis, emisK: 0.35, rough: 0.6, metal: 0, emissive: [0.05, 0.025, 0.015], rim: 0.12, rimCol: F.ember });
        if (R.isTps) {
          // The inflated sprite is a flat plaque lying on the ground, so the
          // third-person camera looks down on its back. A warden's art is tall,
          // so it is turned a full quarter turn off the ground — bolt upright
          // and square to the camera — rather than the slight backward lean a
          // wide sprite can carry.
          const c = Math.cos(R.cam.tyaw), sn = Math.sin(R.cam.tyaw), ux = -sn, uz = c;
          const tilt = Math.PI * 0.5;
          const _t1 = new Float32Array(16), o = new Float32Array(16);
          R.GL3D.M.trs(_t1, 0, 0, 0, ang, size * 1.1, size * 0.55, size * 1.1);
          const co = Math.cos(tilt), si = Math.sin(tilt), tT = 1 - co; o.fill(0); o[15] = 1;
          o[0] = co + tT * ux * ux; o[1] = si * uz; o[2] = tT * ux * uz;
          o[4] = -si * uz; o[5] = co; o[6] = si * ux;
          o[8] = tT * ux * uz; o[9] = -si * ux; o[10] = co + tT * uz * uz;
          const out = R.mm(0, 0, 0, 0, 1, 1, 1); R.GL3D.M.mul(out, o, _t1);
          out[12] = e.x; out[13] = hb + size * 0.44 + R.groundY(e.x, e.y); out[14] = e.y;
          R.draw(sp.mesh, out, m);
        } else {
          R.draw(sp.mesh, M4(R, e.x, hb + size * 0.1, e.y, ang, size, size * 1.35, size), m);
        }
      }
      aura3(R, e, tt, hb);
    } else {
      body3(R, e, tt, hb);
      stageAura3(R, e, tt, hb, st.stage || 1);
    }

    if (st.exposed > 0) {
      // the opening after the Finale: a bright, fractured core
      R.glow(e.x, hb + rr * 0.1, e.y, rr * (2.4 + Math.sin(tt * 9) * 0.5), 2.4, 1.4, 0.7, 0.9, 0);
    }
    if (st.hitFlash > 0) {
      R.glow(e.x, hb, e.y, rr * 3, 2.2, 2.0, 1.6, clamp(st.hitFlash, 0, 1) * 0.85, 0);
    }
    if (st.cur) telegraph3(R, e, st.cur, tt, hb, env);
    if (st.phaseAnim) phase3(R, e, st.phaseAnim, tt, hb);
  }

  window.ChoirAshFX = { draw2D, draw3D, SPRITE_SRC };
})();
