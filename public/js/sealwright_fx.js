// ============================================================
// Monster Arena — THE SEALWRIGHT: visual effects
// ------------------------------------------------------------------
// Every frame of the warden's body and of its eight attacks is drawn
// here, so the fight reads as a boss fight and not as a ring of
// coloured circles:
//   * Seal-Line Sweep .... a burning parchment ribbon sweeping the floor
//                          with a wall of light at its leading edge
//   * Binding Sigils ..... floating sigil cards chained to the warden
//   * Waxen Adds ......... dripping wax constructs marching on the boss
//   * Counterfeit Ward ... a full parchment dome with ONE bright jade gap
//   * Edict Slam ......... a colossal quill driven into the arena
//   * Ink-Spike ......... ink pools that erupt into obsidian spires
//   * Final Inscription .. the whole floor written over with seal-law
//   * Safe Passage ....... ink cells raked by needles, jade lanes to stand in
//
// Two renderers: draw3D (WebGL, the real client) and draw2D (fallback).
// ============================================================
(function () {
  'use strict';

  // ---- palette ------------------------------------------------------------
  const HEX = {
    gold: '#ffcf6a', goldHot: '#fff3c4', parch: '#f2e6c6', wax: '#9a7442',
    ink: '#161021', inkDeep: '#0a0710', blood: '#d8422f', jade: '#8dffc0'
  };
  // float rgb, pre-boosted for additive blending
  // Ivory law, not fire: the warden's light is the white of a pressed page with
  // gold only as its trim, so it can never be read as the Choir's embers.
  const F = {
    gold: [1.95, 1.78, 1.20], goldHot: [2.55, 2.50, 2.35], parch: [1.20, 1.08, 0.86],
    wax: [0.62, 0.42, 0.19], blood: [1.75, 0.30, 0.20], bloodHot: [2.4, 0.65, 0.35],
    ink: [0.055, 0.045, 0.085], jade: [0.50, 1.70, 0.95], white: [2.2, 2.1, 1.85]
  };
  const TAU = Math.PI * 2;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;

  // ---- the warden's art ---------------------------------------------------
  // The Sealwright is drawn from its sprite; the procedural body stays as the
  // fallback for the moment before the image has loaded.
  const SPRITE_SRC = 'assets/boss/sealwright.png?v=5';
  const img = new Image();
  let imgReady = false;
  if (SPRITE_SRC) {
    img.crossOrigin = 'anonymous';
    img.onload = () => { imgReady = true; };
    img.src = SPRITE_SRC;
  }
  // The art is wider than it is tall (the reaching arm), so both renderers
  // scale by the file's own ratio instead of stretching it into a square.
  const spriteAR = () => {
    const w = img.naturalWidth || img.width, h = img.naturalHeight || img.height;
    return (w && h) ? w / h : 1;
  };

  const rad = (e) => e.r || 40;
  const stOf = (e) => e._sw || { stage: 1 };
  const stageOf = (e) => (e._sw && e._sw.stage) || 1;
  // decoration budget: low quality draws fewer trinkets, same silhouette
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

  function runeRing2(ctx, x, y, r, spin, a, col, lw) {
    ctx.strokeStyle = col;
    ctx.lineWidth = lw || 2;
    ctx.setLineDash([Math.max(3, r * 0.18), Math.max(3, r * 0.12)]);
    ctx.lineDashOffset = spin * r * 0.5;
    ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.stroke();
    ctx.setLineDash([]);
    ctx.lineDashOffset = 0;
    // script ticks
    for (let i = 0; i < 12; i++) {
      const ang = spin + (i / 12) * TAU;
      const c = Math.cos(ang), s = Math.sin(ang);
      ctx.beginPath();
      ctx.moveTo(x + c * r * 0.86, y + s * r * 0.86);
      ctx.lineTo(x + c * r * 1.12, y + s * r * 1.12);
      ctx.stroke();
    }
  }

  // a floating sigil card: dark plate, gold rim, glyph
  function card2(ctx, x, y, s, rot, a, spent) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.globalAlpha = clamp(a, 0, 1);
    ctx.fillStyle = 'rgba(16,11,24,.92)';
    ctx.fillRect(-s * 0.5, -s * 0.72, s, s * 1.44);
    ctx.strokeStyle = spent ? 'rgba(230,80,60,.95)' : 'rgba(255,214,120,.95)';
    ctx.lineWidth = Math.max(1.5, s * 0.09);
    ctx.strokeRect(-s * 0.5, -s * 0.72, s, s * 1.44);
    // glyph
    ctx.strokeStyle = spent ? 'rgba(255,120,90,.9)' : 'rgba(255,240,190,.95)';
    ctx.lineWidth = Math.max(1.2, s * 0.07);
    ctx.beginPath();
    ctx.moveTo(0, -s * 0.42); ctx.lineTo(s * 0.26, 0); ctx.lineTo(0, s * 0.42); ctx.lineTo(-s * 0.26, 0);
    ctx.closePath(); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-s * 0.16, 0); ctx.lineTo(s * 0.16, 0);
    ctx.stroke();
    ctx.restore();
  }

  // a wax seal: crimson blob with a press mark
  function waxSeal2(ctx, x, y, r, rot) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.fillStyle = 'rgba(196,52,36,.95)';
    ctx.beginPath();
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * TAU;
      const rr = r * (0.82 + 0.18 * Math.sin(i * 2.3));
      const px = Math.cos(a) * rr, py = Math.sin(a) * rr;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(255,150,120,.55)';
    ctx.lineWidth = Math.max(1, r * 0.16);
    ctx.beginPath(); ctx.arc(0, 0, r * 0.45, 0, TAU); ctx.stroke();
    ctx.restore();
  }

  function body2(ctx, e, t) {
    const RR = rad(e);
    const pl = window.__swPlayer || e;
    const ang = Math.atan2(pl.y - e.y, pl.x - e.x) || 0;
    const st = stageOf(e);

    ctx.save();
    ctx.translate(0, 0);

    // --- parchment cloak strips behind the body (drifting) ---
    for (let i = 0; i < 7; i++) {
      const spread = (i - 3) * RR * 0.24;
      const sway = Math.sin(t * 1.6 + i * 0.8) * RR * 0.1;
      const h = RR * (1.5 + 0.25 * Math.sin(i * 1.7));
      ctx.save();
      ctx.translate(spread + sway, RR * 0.15);
      ctx.rotate(Math.sin(t * 1.1 + i) * 0.12 + (i - 3) * 0.05);
      ctx.fillStyle = 'rgba(226,214,186,' + (0.14 + 0.05 * Math.sin(i)) + ')';
      ctx.beginPath();
      ctx.moveTo(-RR * 0.1, -RR * 0.4);
      ctx.lineTo(RR * 0.1, -RR * 0.4);
      ctx.lineTo(RR * 0.07, h * 0.8);
      ctx.lineTo(-RR * 0.05, h);
      ctx.closePath(); ctx.fill();
      // script lines on the parchment
      ctx.strokeStyle = 'rgba(60,45,35,.45)';
      ctx.lineWidth = 1;
      for (let k = 1; k < 4; k++) {
        ctx.beginPath();
        ctx.moveTo(-RR * 0.05, -RR * 0.2 + k * h * 0.2);
        ctx.lineTo(RR * 0.06, -RR * 0.18 + k * h * 0.2);
        ctx.stroke();
      }
      ctx.restore();
    }
    ctx.restore();

    // --- body core (obsidian mass with molten veins) ---
    ctx.save();
    ctx.translate(0, 0);
    ctx.rotate(ang);

    ctx.fillStyle = HEX.ink;
    ctx.beginPath();
    ctx.moveTo(-RR * 0.95, RR * 0.95);
    ctx.quadraticCurveTo(-RR * 1.18, -RR * 0.3, -RR * 0.2, -RR * 0.92);
    ctx.quadraticCurveTo(RR * 0.55, -RR * 1.02, RR * 0.92, RR * 0.2);
    ctx.quadraticCurveTo(RR * 1.02, RR * 1.0, -RR * 0.95, RR * 0.95);
    ctx.closePath();
    ctx.fill();

    // molten gold cracks
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    const pulse = 0.55 + 0.45 * Math.sin(t * 3.4);
    for (let i = 0; i < 5; i++) {
      const seed = i * 2.7;
      ctx.strokeStyle = 'rgba(255,190,90,' + (0.35 + 0.4 * pulse) + ')';
      ctx.lineWidth = Math.max(1.4, RR * 0.045);
      ctx.beginPath();
      ctx.moveTo(-RR * 0.7, -RR * 0.5 + i * RR * 0.28);
      ctx.lineTo(-RR * 0.3 + Math.sin(seed) * RR * 0.2, -RR * 0.35 + i * RR * 0.28);
      ctx.lineTo(-RR * 0.1 + Math.cos(seed) * RR * 0.25, -RR * 0.1 + i * RR * 0.28);
      ctx.lineTo(RR * 0.4, i * RR * 0.24 - RR * 0.05);
      ctx.stroke();
    }
    ctx.restore();

    // --- wax writing arm reaching out ---
    ctx.save();
    ctx.translate(RR * 0.55, RR * 0.05);
    ctx.fillStyle = HEX.wax;
    ctx.beginPath();
    ctx.ellipse(0, 0, RR * 0.42, RR * 0.3, -0.35, 0, TAU);
    ctx.fill();
    // claw fingers
    ctx.strokeStyle = 'rgba(24,16,30,.95)';
    ctx.lineWidth = Math.max(2, RR * 0.09);
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath();
      ctx.moveTo(RR * 0.3, i * RR * 0.14);
      ctx.quadraticCurveTo(RR * 0.6, i * RR * 0.26, RR * 0.78, i * RR * 0.34);
      ctx.stroke();
    }
    // seal-stamp studs on the forearm
    for (let i = 0; i < 3; i++) waxSeal2(ctx, RR * 0.06 * i - RR * 0.1, -RR * 0.12, RR * 0.07, i);
    ctx.restore();

    // --- parchment mask with a cracked eye ---
    ctx.fillStyle = HEX.parch;
    ctx.beginPath();
    ctx.ellipse(0, -RR * 0.36, RR * 0.42, RR * 0.52, 0, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = 'rgba(120,100,70,.55)';
    ctx.lineWidth = Math.max(1, RR * 0.04);
    ctx.beginPath();
    ctx.moveTo(-RR * 0.2, -RR * 0.74);
    ctx.lineTo(-RR * 0.05, -RR * 0.42);
    ctx.lineTo(-RR * 0.22, -RR * 0.16);
    ctx.stroke();
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    glowCircle(ctx, RR * 0.1, -RR * 0.4, RR * 0.28, 'rgba(255,190,90,.95)', 'rgba(255,120,40,0)');
    ctx.fillStyle = 'rgba(255,240,200,.95)';
    ctx.beginPath(); ctx.ellipse(RR * 0.1, -RR * 0.4, RR * 0.1, RR * 0.055, 0, 0, TAU); ctx.fill();
    ctx.restore();

    // --- the quill, dripping ---
    ctx.strokeStyle = 'rgba(238,226,200,.9)';
    ctx.lineWidth = Math.max(2, RR * 0.1);
    ctx.beginPath();
    ctx.moveTo(RR * 0.7, -RR * 0.4);
    ctx.lineTo(RR * 1.55, -RR * 1.05);
    ctx.stroke();
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    glowCircle(ctx, RR * 1.55, -RR * 1.05, RR * 0.42, 'rgba(255,235,170,1)', 'rgba(255,160,50,0)');
    glowCircle(ctx, RR * 1.62, -RR * 0.82 - ((t * 60) % (RR * 0.5)), RR * 0.14, 'rgba(220,60,45,.9)', 'rgba(160,20,20,0)');
    ctx.restore();
    ctx.restore(); // body rotation

    // --- spiked gold halo behind the head ---
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    const haloY = -RR * 0.55;
    ctx.strokeStyle = 'rgba(255,214,120,.75)';
    ctx.lineWidth = Math.max(2, RR * 0.06);
    ctx.beginPath(); ctx.arc(0, haloY, RR * 0.95, 0, TAU); ctx.stroke();
    for (let i = 0; i < 26; i++) {
      const a = (i / 26) * TAU + t * 0.22;
      const len = RR * (0.22 + 0.16 * (0.5 + 0.5 * Math.sin(i * 2.1 + t * 2)));
      ctx.globalAlpha = 0.55 + 0.45 * Math.sin(i + t * 2);
      ctx.strokeStyle = 'rgba(255,226,150,.9)';
      ctx.lineWidth = Math.max(1, RR * 0.035);
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * RR * 0.95, haloY + Math.sin(a) * RR * 0.95);
      ctx.lineTo(Math.cos(a) * (RR * 0.95 + len), haloY + Math.sin(a) * (RR * 0.95 + len));
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.restore();

    // --- four sigil cards orbiting the warden ---
    for (let i = 0; i < 4; i++) {
      const a = t * 0.9 + (i / 4) * TAU;
      const d = RR * (1.35 + 0.1 * Math.sin(t * 1.7 + i));
      card2(ctx, Math.cos(a) * d, Math.sin(a) * d * 0.7 + haloY * 0.4, RR * 0.3, a * 1.6, 0.9, false);
    }

    // --- stage flare: more light the deeper the fight ---
    // (only over the procedural body — a halo over the art would eat its detail)
    if (!imgReady) {
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      glowCircle(ctx, 0, 0, RR * (1.5 + st * 0.16), 'rgba(255,206,110,' + (0.10 + 0.04 * st) + ')', 'rgba(0,0,0,0)');
      ctx.restore();
    }
  }

  // ---- 2D attack telegraphs ----------------------------------------------
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

    // casting flare at the warden
    glowCircle(ctx, sx(e.x), sy(e.y), RR * (1.6 + prog * 0.6) * (on ? 1.2 : 0.8),
      'rgba(255,220,140,' + (0.22 * prog + 0.08) + ')', 'rgba(0,0,0,0)');

    if (cur.key === 'sealLine' || (cur.key === 'finalInscription' && cur.zones && on)) {
      const zones = cur.zones || [];
      const sweep = cur.sweep || 0;
      const z0 = zones[0], z1 = zones[zones.length - 1];
      // the parchment ribbon itself
      if (z0 && z1) {
        const ax = sx(z0.x), ay = sy(z0.y), bx = sx(z1.x), by = sy(z1.y);
        const front = on ? clamp((sweep - 0.05) / 0.9, 0, 1) : 0;
        const fx = lerp(ax, bx, front), fy = lerp(ay, by, front);
        const bandW = (z0.r || 60) * 1.7;
        // ruled corridor of law: hard rails, no soft band
        if (window.SentinelFX && SentinelFX.edict2) {
          SentinelFX.edict2(ctx, ax, ay, on ? fx : bx, on ? fy : by, bandW, on ? 1 : 0.3 + 0.5 * prog, prog, on);
        } else {
          ctx.strokeStyle = 'rgba(240,226,196,.9)';
          ctx.lineWidth = bandW * 0.6;
          ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(on ? fx : bx, on ? fy : by); ctx.stroke();
        }
        if (on) glowCircle(ctx, fx, fy, bandW * 0.6, 'rgba(255,255,248,.85)', 'rgba(255,240,220,0)');
      }
      // lane seals
      for (const zn of zones) {
        const reached = on && zn.u <= sweep + 0.1;
        const rr = zn.r;
        ctx.fillStyle = reached ? 'rgba(255,190,80,.30)' : 'rgba(255,207,106,.10)';
        ctx.beginPath(); ctx.arc(sx(zn.x), sy(zn.y), rr, 0, TAU); ctx.fill();
        ctx.strokeStyle = reached ? 'rgba(255,250,215,.95)' : 'rgba(255,207,106,.55)';
        ctx.lineWidth = reached ? 4 : 2;
        ctx.beginPath(); ctx.arc(sx(zn.x), sy(zn.y), rr, 0, TAU); ctx.stroke();
        if (!reached) runeRing2(ctx, sx(zn.x), sy(zn.y), rr * 0.78, t * 1.4, 0.8, 'rgba(255,226,150,.75)', 2);
      }
    } else if (cur.key === 'bindingSigils' || (cur.key === 'finalInscription' && cur.sigils)) {
      const sigils = cur.sigils || cur.zones || [];
      for (let i = 0; i < sigils.length; i++) {
        const z = sigils[i];
        const spent = !!z.fired;
        const x = sx(z.x), y = sy(z.y);
        // chain of crimson law from the warden to the mark
        ctx.save();
        ctx.strokeStyle = spent ? 'rgba(255,110,80,.35)' : 'rgba(226,70,50,.8)';
        ctx.lineWidth = spent ? 2 : 3;
        ctx.setLineDash([11, 7]);
        ctx.lineDashOffset = -t * 90;
        ctx.beginPath();
        ctx.moveTo(sx(e.x), sy(e.y));
        ctx.lineTo(x, y);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
        // the mark
        const rr = z.r * (spent ? 1 : 0.5 + 0.5 * prog);
        ctx.strokeStyle = spent ? 'rgba(240,90,60,.85)' : 'rgba(255,214,120,' + (0.5 + 0.5 * prog) + ')';
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(x, y, rr, 0, TAU); ctx.stroke();
        if (!spent) runeRing2(ctx, x, y, rr * 0.7, t * 2.2, 0.9, 'rgba(255,230,160,.9)', 2);
        // the hovering card
        card2(ctx, x, y - rr * 1.25 - Math.sin(t * 2 + i) * 6, rr * 0.55, Math.sin(t * 1.3 + i) * 0.5, spent ? 0.5 : 1, spent);
        if (spent) glowCircle(ctx, x, y, rr * 1.3, 'rgba(255,140,80,.35)', 'rgba(0,0,0,0)');
      }
    } else if (cur.key === 'waxenAdds' && cur.nodes && cur.nodes.length) {
      for (const nd of cur.nodes) {
        if (nd.dead) continue;
        const x = sx(nd.x), y = sy(nd.y), rr = nd.r;
        // molten puddle
        glowCircle(ctx, x, y + rr * 0.35, rr * 1.5, 'rgba(255,150,50,.35)', 'rgba(0,0,0,0)');
        ctx.fillStyle = 'rgba(154,116,66,.95)';
        ctx.beginPath();
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * TAU + Math.sin(t * 2 + i) * 0.2;
          const r2 = rr * (0.85 + 0.2 * Math.sin(i * 3.1 + t * 3));
          if (i === 0) ctx.moveTo(x + Math.cos(a) * r2, y + Math.sin(a) * r2);
          else ctx.lineTo(x + Math.cos(a) * r2, y + Math.sin(a) * r2);
        }
        ctx.closePath(); ctx.fill();
        ctx.strokeStyle = 'rgba(255,216,140,.9)';
        ctx.lineWidth = 2;
        ctx.stroke();
        // molten veins
        ctx.strokeStyle = 'rgba(255,170,70,.9)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x - rr * 0.4, y + rr * 0.2);
        ctx.lineTo(x - rr * 0.05, y - rr * 0.15);
        ctx.lineTo(x + rr * 0.35, y + rr * 0.35);
        ctx.stroke();
        waxSeal2(ctx, x + rr * 0.1, y - rr * 0.45, rr * 0.3, t);
      }
    } else if (cur.key === 'counterfeitWard') {
      const wardR = cur.R || 185, gap = cur.gap || 0;
      const bx = sx(e.x), by = sy(e.y);
      // dome
      const g = ctx.createRadialGradient(bx, by, wardR * 0.35, bx, by, wardR * 1.06);
      g.addColorStop(0, 'rgba(255,190,80,0)');
      g.addColorStop(0.82, 'rgba(255,200,110,' + (0.10 + 0.16 * prog) + ')');
      g.addColorStop(1, 'rgba(255,225,150,' + (0.30 + 0.35 * prog) + ')');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(bx, by, wardR * 1.06, 0, TAU); ctx.fill();
      ctx.strokeStyle = 'rgba(255,222,150,.95)';
      ctx.lineWidth = 5;
      ctx.beginPath(); ctx.arc(bx, by, wardR, 0, TAU); ctx.stroke();
      runeRing2(ctx, bx, by, wardR * 0.92, -t * 1.1, 0.85, 'rgba(255,236,180,.7)', 2);
      // the one way through
      const laneA = 0.20;
      ctx.save();
      ctx.translate(bx, by);
      ctx.rotate(gap);
      const jg = ctx.createLinearGradient(wardR * 0.5, 0, wardR + 190, 0);
      jg.addColorStop(0, 'rgba(120,255,190,.15)');
      jg.addColorStop(0.55, 'rgba(140,255,200,.35)');
      jg.addColorStop(1, 'rgba(140,255,200,0)');
      ctx.fillStyle = jg;
      ctx.beginPath();
      ctx.moveTo(wardR * 0.5, -laneA * wardR * 0.5);
      ctx.lineTo(wardR + 190, -laneA * wardR);
      ctx.lineTo(wardR + 190, laneA * wardR);
      ctx.lineTo(wardR * 0.5, laneA * wardR * 0.5);
      ctx.closePath(); ctx.fill();
      // marching chevrons
      ctx.strokeStyle = 'rgba(180,255,215,.95)';
      ctx.lineWidth = 4;
      for (let i = 0; i < 4; i++) {
        const u = ((t * 0.7 + i * 0.25) % 1);
        const cx2 = wardR * 0.7 + u * 200;
        const w = laneA * wardR * (0.5 + u * 0.6);
        ctx.beginPath();
        ctx.moveTo(cx2, -w); ctx.lineTo(cx2 + 22, 0); ctx.lineTo(cx2, w);
        ctx.stroke();
      }
      ctx.restore();
    } else if (cur.key === 'edictSlam' && cur.rings) {
      const bx = sx(e.x), by = sy(e.y);
      // falling quill above the warden
      if (!on) {
        const drop = lerp(-260, 0, prog);
        ctx.save();
        ctx.strokeStyle = 'rgba(238,226,200,.95)';
        ctx.lineWidth = 9;
        ctx.beginPath(); ctx.moveTo(bx, by + drop - 120); ctx.lineTo(bx, by + drop - 30); ctx.stroke();
        ctx.fillStyle = 'rgba(255,236,185,.95)';
        ctx.beginPath();
        ctx.moveTo(bx, by + drop);
        ctx.lineTo(bx - 12, by + drop + 30);
        ctx.lineTo(bx + 12, by + drop + 30);
        ctx.closePath(); ctx.fill();
        ctx.restore();
      }
      for (const r of cur.rings) {
        const age = on ? cur.t - r.born : -1;
        const radius = age >= 0 ? age * r.sp : 34 + prog * 20;
        if (age > 2.6) continue;
        const a = age >= 0 ? clamp(1 - age / 2.6, 0, 1) : 0.7 * prog + 0.2;
        ctx.strokeStyle = age >= 0 ? 'rgba(255,236,175,' + a + ')' : 'rgba(255,207,106,' + a + ')';
        ctx.lineWidth = age >= 0 ? 4 + 10 * a : 2;
        ctx.beginPath(); ctx.arc(bx, by, radius, 0, TAU); ctx.stroke();
        if (age >= 0) {
          ctx.strokeStyle = 'rgba(255,180,80,' + a * 0.7 + ')';
          ctx.lineWidth = 2;
          for (let i = 0; i < 18; i++) {
            const ang = (i / 18) * TAU;
            ctx.beginPath();
            ctx.moveTo(bx + Math.cos(ang) * radius * 0.94, by + Math.sin(ang) * radius * 0.94);
            ctx.lineTo(bx + Math.cos(ang) * radius * 1.1, by + Math.sin(ang) * radius * 1.1);
            ctx.stroke();
          }
        }
      }
      // floor cracks
      if (on) {
        ctx.strokeStyle = 'rgba(255,170,70,.55)';
        ctx.lineWidth = 2;
        for (let i = 0; i < 12; i++) {
          const ang = (i / 12) * TAU + 0.2;
          const len = 60 + cur.t * 190;
          ctx.beginPath();
          ctx.moveTo(bx + Math.cos(ang) * 30, by + Math.sin(ang) * 30);
          ctx.lineTo(bx + Math.cos(ang) * len, by + Math.sin(ang) * len);
          ctx.stroke();
        }
      }
    } else if (cur.key === 'inkSpikes' && cur.nodes) {
      for (const nd of cur.nodes) {
        const x = sx(nd.x), y = sy(nd.y), rr = nd.r;
        const live = nd.erupt > 0;
        // ink pool (drawn dark, then rimmed)
        ctx.save();
        ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = 'rgba(9,6,16,.85)';
        ctx.beginPath(); ctx.ellipse(x, y, rr * (live ? 1.12 : 0.9), rr * 0.66 * (live ? 1.12 : 0.9), 0, 0, TAU); ctx.fill();
        ctx.restore();
        ctx.strokeStyle = live ? 'rgba(255,225,150,.95)' : 'rgba(255,190,90,.5)';
        ctx.lineWidth = live ? 3 : 2;
        ctx.beginPath(); ctx.ellipse(x, y, rr * (live ? 1.12 : 0.9), rr * 0.66 * (live ? 1.12 : 0.9), 0, 0, TAU); ctx.stroke();
        ctx.globalCompositeOperation = 'screen';
        if (live) {
          // obsidian spires with gold veins
          for (let i = 0; i < 4; i++) {
            const off = (i - 1.5) * rr * 0.4;
            const h = rr * (1.6 + 0.5 * Math.sin(i * 1.7)) * clamp(nd.erupt / 0.35, 0, 1);
            ctx.fillStyle = 'rgba(20,14,30,.98)';
            ctx.beginPath();
            ctx.moveTo(x + off - rr * 0.22, y + rr * 0.1);
            ctx.lineTo(x + off, y - h);
            ctx.lineTo(x + off + rr * 0.22, y + rr * 0.1);
            ctx.closePath(); ctx.fill();
            ctx.strokeStyle = 'rgba(255,190,80,.9)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(x + off, y - h * 0.9);
            ctx.lineTo(x + off - rr * 0.06, y - h * 0.45);
            ctx.stroke();
          }
          glowCircle(ctx, x, y - rr * 0.6, rr * 1.2, 'rgba(255,210,120,.35)', 'rgba(0,0,0,0)');
        } else {
          // needles falling in
          ctx.strokeStyle = 'rgba(255,240,200,' + (0.4 + 0.5 * prog) + ')';
          ctx.lineWidth = 2;
          for (let i = 0; i < 3; i++) {
            const px = x + Math.sin(i * 2.1 + t * 3) * rr * 0.7;
            const py = y - ((t * 520 + i * 90) % 320);
            ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px, py + 26); ctx.stroke();
          }
        }
      }
    } else if (cur.key === 'safePassage' && cur.cells) {
      for (const c of cur.cells) {
        const x = sx(c.x), y = sy(c.y);
        // ink cell
        ctx.save();
        ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = 'rgba(8,5,14,' + (0.35 + 0.45 * prog) + ')';
        ctx.beginPath(); ctx.arc(x, y, c.r, 0, TAU); ctx.fill();
        ctx.restore();
        ctx.strokeStyle = 'rgba(216,66,47,' + (0.4 + 0.5 * prog) + ')';
        ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(x, y, c.r, 0, TAU); ctx.stroke();
        // rake of needles
        ctx.strokeStyle = 'rgba(255,120,90,' + (0.35 + 0.4 * prog) + ')';
        ctx.lineWidth = 2;
        for (let i = 0; i < 4; i++) {
          const px = x + Math.sin(i * 1.7 + t * 2) * c.r * 0.7;
          const py = y - ((t * 460 + i * 70) % 260);
          ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px, py + 20); ctx.stroke();
        }
      }
      for (const s of cur.safe || []) {
        const x = sx(s.x), y = sy(s.y);
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        glowCircle(ctx, x, y, s.r * 1.15, 'rgba(120,255,190,' + (0.30 + 0.25 * prog) + ')', 'rgba(0,0,0,0)');
        ctx.restore();
        ctx.strokeStyle = 'rgba(160,255,210,.95)';
        ctx.lineWidth = 3;
        ctx.setLineDash([12, 9]);
        ctx.lineDashOffset = -t * 55;
        ctx.beginPath(); ctx.arc(x, y, s.r, 0, TAU); ctx.stroke();
        ctx.setLineDash([]);
        runeRing2(ctx, x, y, s.r * 0.68, t * 1.5, 0.9, 'rgba(180,255,215,.8)', 2);
      }
    }
    ctx.restore();
  }

  function phase2(ctx, e, pa, t, env) {
    const cam = env.cam || { x: 0, y: 0, sx: 0, sy: 0 };
    const cx = e.x - cam.x - (cam.sx || 0), cy = e.y - cam.y - (cam.sy || 0);
    const RR = rad(e);
    const p = clamp(pa.t / pa.dur, 0, 1), fade = 1 - p;
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    for (let i = 0; i < 3; i++) {
      const r = RR + p * 620 * (1 - i * 0.14);
      ctx.strokeStyle = 'rgba(255,226,150,' + (0.9 * fade) + ')';
      ctx.lineWidth = 2 + 12 * fade;
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.stroke();
    }
    // parchment shreds blown outward
    for (let i = 0; i < 22; i++) {
      const a = (i / 22) * TAU + t;
      const d = RR + p * 560 * (0.6 + ((i * 37) % 100) / 140);
      ctx.save();
      ctx.translate(cx + Math.cos(a) * d, cy + Math.sin(a) * d);
      ctx.rotate(a * 3 + p * 6);
      ctx.globalAlpha = 0.75 * fade;
      ctx.fillStyle = 'rgba(242,230,198,.9)';
      ctx.fillRect(-9, -4, 18, 8);
      ctx.restore();
    }
    glowCircle(ctx, cx, cy, RR * (2.4 + p * 1.6), 'rgba(255,250,225,' + (0.85 * fade) + ')', 'rgba(255,160,50,0)');
    ctx.restore();
  }

  function draw2D(e, ctx, cx, cy, t, env) {
    if (!ctx) return;
    if (env && env.player) window.__swPlayer = env.player;
    const RR = rad(e);
    const st = stOf(e);
    // ground shadow
    ctx.save();
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = 'rgba(0,0,0,.45)';
    ctx.beginPath(); ctx.ellipse(cx, cy + RR * 0.8, RR, RR * 0.42, 0, 0, TAU); ctx.fill();
    ctx.restore();

    // body drawn in local space
    ctx.save();
    ctx.translate(cx, cy);
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    glowCircle(ctx, 0, 0, RR * (1.7 + stageOf(e) * 0.18), 'rgba(255,200,110,' + (0.16 + 0.04 * stageOf(e)) + ')', 'rgba(0,0,0,0)');
    ctx.restore();
    // rotating seal ring on the floor beneath
    ctx.save();
    ctx.scale(1, 0.45);
    runeRing2(ctx, 0, RR * 1.7, RR * 1.6, t * 0.5, 0.6, 'rgba(255,214,120,.65)', 3);
    ctx.restore();
    if (imgReady) {
      const sh = RR * 2.6;
      const sw = sh * spriteAR();
      ctx.drawImage(img, -sw / 2, -sh / 2, sw, sh);
    } else {
      body2(ctx, e, t);
    }
    if (st.hitFlash > 0) {
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      ctx.globalAlpha = clamp(st.hitFlash, 0, 1) * 0.8;
      glowCircle(ctx, 0, 0, RR * 1.1, 'rgba(255,255,255,1)', 'rgba(255,200,120,0)');
      ctx.restore();
    }
    ctx.restore();

    if (st.cur) telegraph2(ctx, e, st.cur, t, env);
    if (st.phaseAnim) phase2(ctx, e, st.phaseAnim, t, env);

    // health ring + stage pips
    const hpR = clamp((e.hp || 0) / Math.max(1, e.maxhp || e.hp || 1), 0, 1);
    ctx.save();
    ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(0,0,0,.7)';
    ctx.lineWidth = 6;
    ctx.beginPath(); ctx.arc(cx, cy, RR + 12, 0, TAU); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,214,120,.95)';
    ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(cx, cy, RR + 12, -Math.PI / 2, -Math.PI / 2 + hpR * TAU); ctx.stroke();
    const stage = stageOf(e);
    for (let i = 0; i < 4; i++) {
      const a = -Math.PI / 2 + (i / 4) * TAU;
      ctx.fillStyle = i < stage ? 'rgba(255,236,175,1)' : 'rgba(255,255,255,.22)';
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

  // a glowing band along the ground, made of stamp quads
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

  // The Sealwright never marks the floor with a circle: it presses a seal
  // into it. Shape lives in sentinel_fx_kit.js so the four wardens of this
  // campaign can never be mistaken for one another.
  function stampMark(R, x, z, r, a, tt, seed) {
    if (window.SentinelFX) { window.SentinelFX.stamp(R, x, z, r, a, tt, seed); return; }
    ring(R, x, z, r, F.gold, a, 9, 0, tt * 1.2);
    ring(R, x, z, r * 0.7, F.goldHot, a * 0.6, 6, 0, -tt * 1.6);
  }

  function boltTo(R, ax, ay, az, bx, by, bz, col, w, a, seed) {
    const pts = [];
    const seg = 9;
    for (let i = 0; i <= seg; i++) {
      const u = i / seg;
      pts.push(
        lerp(ax, bx, u) + Math.sin(u * 9 + seed + R.time * 6) * 12 * Math.sin(u * Math.PI),
        lerp(ay, by, u) + Math.sin(u * 7 + seed * 2 + R.time * 5) * 8 * Math.sin(u * Math.PI),
        lerp(az, bz, u) + Math.cos(u * 8 + seed + R.time * 6) * 12 * Math.sin(u * Math.PI)
      );
    }
    R.rib.line(pts, w, w * 0.7, col[0], col[1], col[2], a);
    R.rib.line(pts, w * 0.34, w * 0.22, 1.4, 1.1, 0.9, a * 0.8);
  }

  function card3(R, x, y, z, s, ry, rx, col, a) {
    R.draw(U(R).box, M4(R, x, y, z, ry, s, s * 1.45, Math.max(2, s * 0.09), rx || 0),
      MAT(R, [0.09, 0.07, 0.13], { rough: 0.5, metal: 0.35, emissive: [0.30, 0.22, 0.12], emisK: 1.2, alpha: a, shadow: false, rim: 0.7, rimCol: col }));
    R.draw(U(R).box, M4(R, x, y, z, ry, s * 1.08, s * 0.34, Math.max(2.4, s * 0.12), rx || 0),
      MAT(R, [1, 1, 1], { emissive: col, emisK: 2.4, alpha: a * 0.95, shadow: false }));
    R.glow(x, y, z, s * 2.2, col[0] * 0.5, col[1] * 0.5, col[2] * 0.5, 0.35 * a, 0);
  }

  function spike3(R, x, y, z, ry, h, w, col) {
    R.draw(U(R).cone, M4(R, x, y + h * 0.5, z, ry, w, h, w),
      MAT(R, [1, 1, 1], { emissive: col, emisK: 2.2, alpha: 0.85, shadow: false }));
  }

  function body3(R, e, tt, hb) {
    const rr = rad(e), stage = stageOf(e), G = F.gold;
    const x = e.x, z = e.y;
    const pl = (window.__swPlayer || { x: x + 100, y: z });
    const ang = Math.atan2(pl.y - z, pl.x - x);
    const UU = U(R);

    // --- parchment cloak strips hanging around the mass ---
    const cloakN = dq(R, 7);
    for (let i = 0; i < cloakN; i++) {
      const a = (i / cloakN) * TAU + tt * 0.15;
      const d = rr * (0.95 + 0.12 * Math.sin(i * 1.7));
      const sway = Math.sin(tt * 1.7 + i) * 0.22;
      const h = rr * (1.5 + 0.3 * Math.sin(i * 2.1));
      R.draw(UU.plane, M4(R, x + Math.cos(a) * d, hb - rr * 0.55 + Math.sin(tt * 1.3 + i) * 3, z + Math.sin(a) * d,
        a + sway, rr * 0.34, h, 1, 0.1 + sway * 0.25),
        MAT(R, F.parch, { rough: 0.85, metal: 0, emissive: [0.10, 0.08, 0.05], emisK: 1.0, alpha: 0.72, shadow: false }));
      // a wax seal pinning each strip
      if (i % 2 === 0) {
        R.draw(UU.sphereLo, M4(R, x + Math.cos(a) * d * 0.96, hb - rr * 1.05, z + Math.sin(a) * d * 0.96, 0, rr * 0.09, rr * 0.09, rr * 0.09),
          MAT(R, F.blood, { rough: 0.5, metal: 0.1, emissive: [0.35, 0.05, 0.03], emisK: 1.4, shadow: false }));
      }
    }

    // --- obsidian body with molten veins ---
    R.draw(UU.rock3, M4(R, x, hb, z, ang + Math.PI * 0.5, rr * 1.02, rr * 1.5, rr * 0.92),
      MAT(R, [0.05, 0.04, 0.075], { rough: 0.55, metal: 0.3, emissive: [0.05, 0.035, 0.02], emisK: 1.2, rim: 1.5, rimCol: G }));
    // gold cracks: thin bright rods laid across the torso
    const crackN = dq(R, 6);
    for (let i = 0; i < crackN; i++) {
      const a = (i / crackN) * TAU + 0.4;
      const yy = hb - rr * 0.55 + (i / crackN) * rr * 1.1;
      R.draw(UU.tube, M4(R, x + Math.cos(a) * rr * 0.7, yy, z + Math.sin(a) * rr * 0.72,
        a, 0.9, rr * (0.55 + 0.35 * Math.sin(i * 2.3)), 1.2),
        MAT(R, [1, 1, 1], { emissive: F.goldHot, emisK: 2.2, alpha: 0.85, shadow: false }));
    }

    // --- writing arm reaching for the player ---
    const armDir = ang;
    const ax = x + Math.cos(armDir) * rr * 1.15, az = z + Math.sin(armDir) * rr * 1.15;
    R.draw(UU.rock2, M4(R, ax, hb - rr * 0.15, az, armDir, rr * 0.42, rr * 0.34, rr * 0.5),
      MAT(R, [0.06, 0.05, 0.09], { rough: 0.5, metal: 0.35, emissive: [0.35, 0.16, 0.03], emisK: 1.3, rim: 1.2, rimCol: G }));
    for (let i = -1; i <= 1; i++) {
      const fa = armDir + i * 0.42;
      R.draw(UU.cone, M4(R, ax + Math.cos(fa) * rr * 0.62, hb - rr * 0.1, az + Math.sin(fa) * rr * 0.62,
        fa, rr * 0.1, rr * 0.7, rr * 0.1, Math.PI * 0.5),
        MAT(R, [0.05, 0.04, 0.08], { rough: 0.4, metal: 0.5, emisK: 0.6, emissive: [0.3, 0.18, 0.05] }));
    }

    // --- parchment mask + burning eye ---
    R.draw(UU.octa, M4(R, x + Math.cos(ang) * rr * 0.36, hb + rr * 0.72, z + Math.sin(ang) * rr * 0.36, ang, rr * 0.4, rr * 0.56, rr * 0.4),
      MAT(R, F.parch, { rough: 0.42, metal: 0.05, emissive: [0.42, 0.34, 0.2], emisK: 1.6, rim: 0.9, rimCol: G }));
    R.glow(x + Math.cos(ang) * rr * 0.52, hb + rr * 0.72, z + Math.sin(ang) * rr * 0.52, rr * 0.9, 1.9, 1.2, 0.45, 0.9, 0);

    aura3(R, e, tt, hb);
  }

  // ---- the warden's aura ---------------------------------------------------
  // Everything floating around the body: the spiked halo, the quill, orbiting
  // sigil cards, stylus needles, the law written on the floor and its gold
  // motes. Shared by both looks, so the sprite keeps every effect the
  // procedural body carried.
  function aura3(R, e, tt, hb) {
    const rr = rad(e), stage = stageOf(e), G = F.gold;
    const x = e.x, z = e.y;
    const pl = (window.__swPlayer || { x: x + 100, y: z });
    const ang = Math.atan2(pl.y - z, pl.x - x);
    const UU = U(R);

    // --- the spiked gold halo ---
    R.draw(UU.torus, M4(R, x, hb + rr * 0.72, z, tt * 0.3, rr * 0.92, rr * 0.92, rr * 0.92, 0.35),
      MAT(R, [1, 1, 1], { emissive: F.goldHot, emisK: 2.0, alpha: 0.9, shadow: false }));
    const spikeN = dq(R, 14);
    for (let i = 0; i < spikeN; i++) {
      const a = (i / spikeN) * TAU + tt * 0.25;
      const len = rr * (0.22 + 0.18 * (0.5 + 0.5 * Math.sin(i * 2.1 + tt * 3)));
      spike3(R, x + Math.cos(a) * rr * 0.95, hb + rr * 0.72, z + Math.sin(a) * rr * 0.95, a, len, rr * 0.035, F.gold);
    }

    // --- quill, dripping crimson ---
    const qx = x + Math.cos(ang + 0.9) * rr * 1.1, qz = z + Math.sin(ang + 0.9) * rr * 1.1;
    R.draw(UU.cyl, M4(R, qx, hb + rr * 0.95, qz, ang + 0.9, rr * 0.06, rr * 2.1, rr * 0.06, 0.5),
      MAT(R, [0.9, 0.85, 0.75], { rough: 0.6, emissive: [0.35, 0.3, 0.2], emisK: 1.2 }));
    R.draw(UU.cone, M4(R, qx, hb + rr * 1.9, qz, ang + 0.9, rr * 0.34, rr * 0.9, rr * 0.34, 0.5),
      MAT(R, [0.14, 0.1, 0.18], { rough: 0.7, metal: 0.1, emissive: [0.25, 0.08, 0.06], emisK: 1.3, alpha: 0.95 }));
    R.glow(qx, hb + rr * 0.35, qz, rr * 0.5, 1.6, 0.35, 0.25, 0.55, 0);

    // --- orbiting sigil cards + stylus needles ---
    const cardN = dq(R, 3);
    for (let i = 0; i < cardN; i++) {
      const a = tt * 0.9 + (i / cardN) * TAU;
      const d = rr * (1.5 + 0.12 * Math.sin(tt * 1.7 + i));
      card3(R, x + Math.cos(a) * d, hb + rr * 0.35 + Math.sin(tt * 2 + i) * rr * 0.25, z + Math.sin(a) * d,
        rr * 0.42, a * 1.6, Math.sin(tt + i) * 0.4, F.gold, 0.95);
    }
    const pinN = dq(R, 4);
    for (let i = 0; i < pinN; i++) {
      const a = -tt * 0.5 + (i / pinN) * TAU;
      const d = rr * 1.25;
      R.draw(UU.cyl, M4(R, x + Math.cos(a) * d, hb + rr * 0.1, z + Math.sin(a) * d, a, rr * 0.035, rr * 1.1, rr * 0.035, Math.PI * 0.5),
        MAT(R, [1, 1, 1], { emissive: F.gold, emisK: 2.0, shadow: false, alpha: 0.95 }));
    }

    // --- floor law under the warden ---
    ring(R, x, z, rr * (1.9 + stage * 0.2), G, 0.30 + 0.10 * Math.sin(tt * 2), 9, 0, tt * 0.4);
    ring(R, x, z, rr * (1.3 + stage * 0.15), G, 0.24, 6, 0, -tt * 0.7);
    if (!imgReady) R.glow(x, hb, z, rr * 2.3, 1.5, 1.1, 0.42, 0.55 + 0.15 * Math.sin(tt * 3), 0);
    R.light(x, z, hb + 24, 240 + stage * 50, 1.2, 0.85, 0.42, 0.65 + 0.2 * Math.sin(tt * 3));

    // --- drifting gold motes ---
    for (let i = 0; i < 1 + stage; i++) {
      if (Math.random() < 0.5 * (R.q.parts || 1)) {
        const a = Math.random() * TAU, d = rr * (0.7 + Math.random() * 1.1);
        R.emit({
          x: x + Math.cos(a) * d, y: hb + Math.random() * rr, z: z + Math.sin(a) * d,
          vx: (Math.random() - 0.5) * 10, vy: 26 + Math.random() * 30, vz: (Math.random() - 0.5) * 10,
          life: 1.1 + Math.random() * 0.8, age: 0, s0: 7, s1: 1,
          col: Math.random() < 0.5 ? F.gold : F.parch, a: 0.8, kind: 0, drag: 0.7
        });
      }
    }
  }

  // ---- 3D attack telegraphs ----------------------------------------------
  function telegraph3(R, e, cur, tt, hb) {
    if (cur.phase !== 'tele' && cur.phase !== 'active') return;
    const UU = U(R);
    const on = cur.phase === 'active';
    const prog = cur.phase === 'tele' ? clamp(cur.t / cur.phases.tele, 0, 1) : 1;
    const rr = rad(e), x = e.x, z = e.y;

    // casting flare on the warden: always readable
    R.glow(x, hb, z, rr * (2.0 + prog * 0.9), 1.6, 1.15, 0.45, (0.35 + 0.45 * prog) * (on ? 1.25 : 1), 0);
    if (!on) ring(R, x, z, rr * (2.1 + prog * 1.4), F.gold, 0.35 + 0.4 * prog, 9, 0, tt * 1.2);

    if (cur.key === 'sealLine' || (cur.key === 'finalInscription' && cur.zones && on)) {
      const zones = cur.zones || [];
      const sweep = cur.sweep || 0;
      const z0 = zones[0], z1 = zones[zones.length - 1];
      if (z0 && z1) {
        const ax = z0.x, az = z0.y, bx = z1.x, bz = z1.y;
        const front = on ? clamp((sweep - 0.02) * 1.02, 0, 1) : 0;
        const fx = lerp(ax, bx, front), fz = lerp(az, bz, front);
        const w = (z0.r || 60) * 1.7;
        // the corridor of law: two ruled rails and a stamped slab at the front,
        // never a soft beam of light (that shape belongs to the Choir).
        if (window.SentinelFX) {
          SentinelFX.edict(R, ax, az, on ? fx : bx, on ? fz : bz, w, on ? 1 : 0.3 + 0.5 * prog, prog, on, tt);
        } else {
          band(R, ax, az, on ? fx : bx, on ? fz : bz, w * 0.8, F.parch, 0.32 + 0.3 * prog, 40);
          band(R, ax, az, on ? fx : bx, on ? fz : bz, w * 0.34, F.gold, 0.5 + 0.4 * prog, 34);
        }
        // the leading slab is lit from inside
        if (on) {
          const rot = Math.atan2(bz - az, bx - ax);
          R.light(fx, fz, 60, 320, 1.6, 1.5, 1.25, 0.9);
          // shredded parchment and sparks thrown off the edge
          for (let i = 0; i < 2; i++) {
            if (Math.random() < 0.85) {
              const side = (Math.random() - 0.5) * w;
              R.emit({
                x: fx + Math.cos(rot + Math.PI / 2) * side, y: 14 + Math.random() * 60, z: fz + Math.sin(rot + Math.PI / 2) * side,
                vx: (Math.random() - 0.5) * 130, vy: 60 + Math.random() * 90, vz: (Math.random() - 0.5) * 130,
                life: 0.6 + Math.random() * 0.5, age: 0, s0: 12, s1: 2,
                col: Math.random() < 0.5 ? F.parch : F.gold, a: 0.95, kind: 0, drag: 0.4
              });
            }
          }
        }
        // the swept floor keeps glowing
        if (on) band(R, ax, az, fx, fz, w * 0.5, F.gold, 0.16, 54);
      }
      // lane seals
      for (const zn of zones) {
        const reached = on && zn.u <= sweep + 0.1;
        stampMark(R, zn.x, zn.y, zn.r * 0.92, reached ? 1 : 0.25 + 0.45 * prog, tt, (zn.u || 0) * 6);
        if (reached) {
          R.draw(UU.cyl, M4(R, zn.x, 40, zn.y, 0, zn.r * 1.02, 80, zn.r * 1.02),
            MAT(R, F.goldHot, { emissive: F.goldHot, emisK: 2.6, alpha: 0.35, shadow: false }));
          R.glow(zn.x, 26, zn.y, zn.r * 2.6, 2.0, 1.5, 0.7, 0.8, 0);
        }
      }
    } else if (cur.key === 'bindingSigils' || (cur.key === 'finalInscription' && cur.sigils)) {
      const sigils = cur.sigils || cur.zones || [];
      for (let i = 0; i < sigils.length; i++) {
        const zn = sigils[i];
        const spent = !!zn.fired;
        const col = spent ? F.blood : F.gold;
        const r = zn.r * (spent ? 1 : 0.55 + 0.45 * prog);
        // the mark on the floor
        stampMark(R, zn.x, zn.y, r * 0.92, spent ? 0.85 : 0.32 + 0.5 * prog, tt, i);
        // crimson law chaining the mark to the warden
        boltTo(R, x, hb, z, zn.x, 20, zn.y, spent ? F.blood : [1.4, 0.42, 0.3], spent ? 6 : 4.5, spent ? 0.55 : 0.75, i * 3.7);
        // the floating sigil card above it
        card3(R, zn.x, 96 + Math.sin(tt * 2 + i) * 10, zn.y, zn.r * 0.9, Math.sin(tt * 1.3 + i) * 0.7, Math.sin(tt * 0.9 + i) * 0.3, col, spent ? 0.55 : 1);
        if (!spent) {
          R.draw(UU.cyl, M4(R, zn.x, 46, zn.y, 0, zn.r * 0.7, 92, zn.r * 0.7),
            MAT(R, F.gold, { emissive: F.gold, emisK: 1.8, alpha: 0.20 + 0.2 * prog, shadow: false }));
          R.glow(zn.x, 40, zn.y, zn.r * 2.4, 1.8, 1.3, 0.5, 0.55, 0);
        } else {
          for (let k = 0; k < 2; k++) {
            if (Math.random() < 0.7) {
              R.emit({
                x: zn.x + (Math.random() - 0.5) * zn.r, y: 10 + Math.random() * 40, z: zn.y + (Math.random() - 0.5) * zn.r,
                vx: (Math.random() - 0.5) * 120, vy: 70 + Math.random() * 110, vz: (Math.random() - 0.5) * 120,
                life: 0.7, age: 0, s0: 12, s1: 2, col: F.bloodHot, a: 0.9, kind: 0, drag: 0.4
              });
            }
          }
        }
      }
    } else if (cur.key === 'waxenAdds' && cur.nodes) {
      for (let i = 0; i < cur.nodes.length; i++) {
        const nd = cur.nodes[i];
        if (nd.dead) continue;
        // wax construct: obsidian shell, molten core, red seal on its brow
        R.draw(UU.rock3, M4(R, nd.x, 20, nd.y, tt * 0.8 + i, nd.r * 0.78, 34, nd.r * 0.78),
          MAT(R, [0.11, 0.08, 0.06], { rough: 0.62, metal: 0.18, emissive: [0.45, 0.22, 0.05], emisK: 1.6, rim: 1.2, rimCol: F.gold }));
        R.draw(UU.sphereLo, M4(R, nd.x, 26, nd.y, 0, nd.r * 0.34, nd.r * 0.34, nd.r * 0.34),
          MAT(R, [1, 1, 1], { emissive: F.goldHot, emisK: 2.6, alpha: 0.9, shadow: false }));
        R.draw(UU.sphereLo, M4(R, nd.x, 40, nd.y, 0, nd.r * 0.16, nd.r * 0.1, nd.r * 0.16),
          MAT(R, F.blood, { emissive: [0.6, 0.1, 0.06], emisK: 2.0, shadow: false }));
        R.glow(nd.x, 24, nd.y, nd.r * 2.6, 1.9, 1.0, 0.35, 0.7, 0);
        ring(R, nd.x, nd.y, nd.r * 1.5, F.wax, 0.4, 9, 0, tt);
        R.light(nd.x, nd.y, 24, 130, 1.4, 0.8, 0.3, 0.5);
        // molten drips
        if (Math.random() < 0.5) {
          R.emit({
            x: nd.x + (Math.random() - 0.5) * nd.r, y: 22 + Math.random() * 16, z: nd.y + (Math.random() - 0.5) * nd.r,
            vx: (Math.random() - 0.5) * 20, vy: 10 + Math.random() * 20, vz: (Math.random() - 0.5) * 20,
            life: 0.6, age: 0, s0: 8, s1: 2, col: F.gold, a: 0.8, kind: 0, drag: 0.6, grav: 120
          });
        }
      }
    } else if (cur.key === 'counterfeitWard') {
      const WR = cur.R || 185, gap = cur.gap || 0;
      // a full parchment dome
      R.draw(UU.sphere, M4(R, x, 4, z, 0, WR, WR * 0.92, WR),
        MAT(R, F.gold, { alpha: 0.07 + 0.06 * prog, emissive: [0.9, 0.7, 0.35], emisK: 1.6, rim: 1.8, rimCol: F.gold, shadow: false, rough: 0.2, metal: 0.2 }));
      // three turning parchment bands
      for (let i = 0; i < 3; i++) {
        R.draw(UU.torus, M4(R, x, 10 + i * 26, z, tt * (0.4 + i * 0.2) * (i % 2 ? -1 : 1), WR * (0.98 - i * 0.02), 5, WR * (0.98 - i * 0.02), 1.05),
          MAT(R, [1, 1, 1], { emissive: i % 2 ? F.parch : F.gold, emisK: 2.0, alpha: 0.55, shadow: false }));
      }
      ring(R, x, z, WR, F.goldHot, 0.8, 9, 0, tt * 0.6);
      ring(R, x, z, WR * 0.93, F.gold, 0.6, 6, 0, -tt * 1.1);
      // the single jade gap: two posts and a lit corridor out
      for (const s of [-1, 1]) {
        const a = gap + s * 0.26;
        R.draw(UU.cyl, M4(R, x + Math.cos(a) * WR, 60, z + Math.sin(a) * WR, 0, 7, 118, 7),
          MAT(R, [1, 1, 1], { emissive: F.jade, emisK: 2.8, shadow: false }));
        R.glow(x + Math.cos(a) * WR, 60, z + Math.sin(a) * WR, 90, 0.5, 1.7, 0.95, 0.9, 0);
      }
      band(R, x + Math.cos(gap) * WR * 0.7, z + Math.sin(gap) * WR * 0.7,
        x + Math.cos(gap) * (WR + 260), z + Math.sin(gap) * (WR + 260),
        WR * 0.22, F.jade, 0.35 + 0.25 * prog, 48);
      // chevrons marching out of the gap
      for (let i = 0; i < 4; i++) {
        const u = ((tt * 0.55 + i * 0.25) % 1);
        const d = WR * 0.75 + u * 250;
        R.draw(UU.box, M4(R, x + Math.cos(gap) * d, 6, z + Math.sin(gap) * d, gap, 40, 4, 12),
          MAT(R, [1, 1, 1], { emissive: F.jade, emisK: 2.4, shadow: false, alpha: 0.9 * (1 - u * 0.5) }));
      }
      // ward sparks
      if (Math.random() < 0.6) {
        const a = Math.random() * TAU;
        R.emit({
          x: x + Math.cos(a) * WR, y: 12 + Math.random() * 40, z: z + Math.sin(a) * WR,
          vx: Math.cos(a) * 50, vy: 50, vz: Math.sin(a) * 50,
          life: 0.7, age: 0, s0: 9, s1: 1, col: F.gold, a: 0.9, kind: 0, drag: 0.4
        });
      }
    } else if (cur.key === 'edictSlam' && cur.rings) {
      // the colossal quill, driven down
      if (!on) {
        const drop = lerp(-620, 0, prog);
        R.draw(UU.cyl, M4(R, x, hb + 120 + drop, z, 0, 12, 320, 12),
          MAT(R, [0.9, 0.85, 0.75], { rough: 0.55, emissive: [0.5, 0.42, 0.28], emisK: 1.8 }));
        R.draw(UU.cone, M4(R, x, hb + 330 + drop, z, 0, 74, 200, 74, Math.PI),
          MAT(R, [0.13, 0.09, 0.16], { rough: 0.7, emissive: [0.4, 0.12, 0.08], emisK: 1.6 }));
        R.draw(UU.cone, M4(R, x, hb + 20 + drop, z, 0, 20, 46, 20, Math.PI),
          MAT(R, [1, 1, 1], { emissive: F.goldHot, emisK: 3.0, shadow: false }));
        R.glow(x, hb + 20 + drop, z, 260, 2.0, 1.5, 0.7, 0.7, 0);
        R.light(x, z, hb + 60 + drop, 380, 1.5, 1.1, 0.5, 0.8);
        // the judgement lands inside a stamped square, not a ring
        if (window.SentinelFX) SentinelFX.frame(R, x, z, 40 + prog * 120, 0.45 + 0.5 * prog, tt, 8);
        else ring(R, x, z, 40 + prog * 120, F.gold, 0.4 + 0.5 * prog, 9, 0, tt * 1.5);
      }
      for (const r of cur.rings) {
        const age = on ? cur.t - r.born : -1;
        const radius = age >= 0 ? age * r.sp : 46;
        if (age > 2.8) continue;
        const a = age >= 0 ? clamp(1 - age / 2.8, 0, 1) : 0.35 + 0.4 * prog;
        const thick = age >= 0 ? 6 + 12 * a : 3;
        // the shockwave is a square of law expanding outward
        if (window.SentinelFX) {
          SentinelFX.frame(R, x, z, radius, a, tt * 0.4, thick);
          SentinelFX.frame(R, x, z, radius * 0.88, a * 0.6, -tt * 0.3, thick * 0.6);
        } else {
          R.draw(UU.torus, M4(R, x, 8 + (age >= 0 ? 10 * a : 0), z, tt * 0.6, radius, thick, radius, 0.1),
            MAT(R, [1, 1, 1], { emissive: F.goldHot, emisK: 2.8, alpha: a, shadow: false }));
        }
      }
      // floor cracking out from the impact
      if (on) {
        for (let i = 0; i < 12; i++) {
          const a = (i / 12) * TAU + 0.2;
          const len = 90 + cur.t * 300;
          band(R, x + Math.cos(a) * 30, z + Math.sin(a) * 30, x + Math.cos(a) * len, z + Math.sin(a) * len,
            16, F.gold, clamp(0.7 - cur.t * 0.25, 0, 0.7), 60);
        }
        if (Math.random() < 0.9) {
          for (let k = 0; k < 2; k++) {
            const a = Math.random() * TAU, d = 40 + Math.random() * 120;
            R.emit({
              x: x + Math.cos(a) * d, y: 10, z: z + Math.sin(a) * d,
              vx: Math.cos(a) * (90 + Math.random() * 160), vy: 120 + Math.random() * 180, vz: Math.sin(a) * (90 + Math.random() * 160),
              life: 1.1, age: 0, s0: 16, s1: 3, col: k ? F.parch : F.gold, a: 0.95, kind: 0, drag: 0.35, grav: 120
            });
          }
        }
      }
    } else if (cur.key === 'inkSpikes' && cur.nodes) {
      for (let i = 0; i < cur.nodes.length; i++) {
        const nd = cur.nodes[i];
        const live = nd.erupt > 0;
        // ink pool: a dark disc that swallows the light
        R.decal(nd.x, nd.y, nd.r * 2.3, 0.03, 0.02, 0.05, 0.92, 9, 0, tt * 0.4, false, 1.4);
        ring(R, nd.x, nd.y, nd.r * 1.12, live ? F.goldHot : F.gold, live ? 0.85 : 0.35 + 0.4 * prog, 9, 0, tt * 1.4);
        if (live) {
          const grow = clamp(nd.erupt / 0.3, 0, 1);
          for (let k = 0; k < 4; k++) {
            const off = (k - 1.5) * nd.r * 0.34;
            const h = nd.r * (2.2 + 0.7 * Math.sin(k * 1.7 + i)) * grow;
            spike3(R, nd.x + off, 2, nd.y + (k % 2 ? nd.r * 0.16 : -nd.r * 0.16), tt * 0.4 + k, h, nd.r * 0.2, [0.16, 0.11, 0.2]);
            R.glow(nd.x + off, h * 0.5, nd.y, nd.r * 1.1, 1.6, 0.9, 0.3, 0.45 * grow, 0);
          }
          R.light(nd.x, nd.y, 40, 190, 1.2, 0.8, 0.35, 0.6);
          for (let k = 0; k < 2; k++) {
            if (Math.random() < 0.75) {
              const a = Math.random() * TAU;
              R.emit({
                x: nd.x + Math.cos(a) * nd.r * 0.5, y: 12 + Math.random() * 30, z: nd.y + Math.sin(a) * nd.r * 0.5,
                vx: Math.cos(a) * 90, vy: 110 + Math.random() * 140, vz: Math.sin(a) * 90,
                life: 0.8, age: 0, s0: 12, s1: 2, col: k ? F.gold : F.ink, a: 0.9, kind: 0, drag: 0.45, grav: 140
              });
            }
          }
        } else {
          // gold needles falling into the pool
          for (let k = 0; k < 3; k++) {
            if (Math.random() < 0.5) {
              const a = Math.random() * TAU, d = Math.random() * nd.r * 0.9;
              R.emit({
                x: nd.x + Math.cos(a) * d, y: 300 + Math.random() * 120, z: nd.y + Math.sin(a) * d,
                vx: 0, vy: -520, vz: 0,
                life: 1.0, age: 0, s0: 10, s1: 6, col: F.goldHot, a: 0.95, kind: 0, drag: 0, orient: 2, rot: 0
              });
            }
          }
        }
      }
    } else if (cur.key === 'safePassage' && cur.cells) {
      for (const c of cur.cells) {
        // ink cell
        R.decal(c.x, c.y, c.r * 2.2, 0.03, 0.02, 0.05, 0.35 + 0.5 * prog, 9, 0, tt * 0.3, false, 1.4);
        R.decal(c.x, c.y, c.r * 2.05, F.blood[0], F.blood[1], F.blood[2], 0.16 + 0.22 * prog, 6, 0.06, tt * 0.8, true, 1.7);
        // raking needles
        for (let k = 0; k < 2; k++) {
          if (Math.random() < 0.55 * (R.q.parts || 1)) {
            const a = Math.random() * TAU, d = Math.random() * c.r * 0.85;
            R.emit({
              x: c.x + Math.cos(a) * d, y: 280 + Math.random() * 140, z: c.y + Math.sin(a) * d,
              vx: 0, vy: -560, vz: 0,
              life: 0.9, age: 0, s0: 9, s1: 5, col: k ? F.goldHot : F.bloodHot, a: 0.9, kind: 0, drag: 0, orient: 2, rot: 0
            });
          }
        }
      }
      for (let i = 0; i < (cur.safe || []).length; i++) {
        const s = cur.safe[i];
        ring(R, s.x, s.y, s.r, F.jade, 0.8, 9, 0, tt * 1.1);
        ring(R, s.x, s.y, s.r * 0.72, F.jade, 0.6, 6, 0, -tt * 1.5);
        R.decal(s.x, s.y, s.r * 1.7, F.jade[0], F.jade[1], F.jade[2], 0.20 + 0.18 * prog, 12, 0.1, tt * 0.9, true, 1.9);
        R.draw(UU.cyl, M4(R, s.x, 34, s.y, 0, s.r * 0.9, 68, s.r * 0.9),
          MAT(R, F.jade, { emissive: F.jade, emisK: 1.6, alpha: 0.16 + 0.14 * prog, shadow: false }));
        R.glow(s.x, 26, s.y, s.r * 2.4, 0.5, 1.7, 0.95, 0.55, 0);
        R.light(s.x, s.y, 30, 150, 0.45, 1.4, 0.8, 0.5);
      }
    }
  }

  function phase3(R, e, pa, tt, hb) {
    const UU = U(R);
    const p = clamp(pa.t / pa.dur, 0, 1), fade = 1 - p;
    const x = e.x, z = e.y, rr = rad(e);
    // three squares of law blasting outward — the Sealwright owns no circles
    for (let i = 0; i < 3; i++) {
      const radius = rr + p * 620 * (1 - i * 0.13);
      if (window.SentinelFX) SentinelFX.frame(R, x, z, radius, 0.9 * fade, tt * (i % 2 ? -1 : 1), 4 + 14 * fade);
      else R.draw(UU.torus, M4(R, x, 10, z, tt * (1.1 + i * 0.4), radius, 4 + 14 * fade, radius, 0.12),
        MAT(R, [1, 1, 1], { emissive: i % 2 ? F.goldHot : F.gold, emisK: 3.0, alpha: 0.9 * fade, shadow: false }));
    }
    // parchment shreds flung out
    for (let i = 0; i < 6; i++) {
      if (Math.random() < 0.9) {
        const a = Math.random() * TAU, sp = 120 + Math.random() * 260;
        R.emit({
          x: x, y: hb, z: z,
          vx: Math.cos(a) * sp, vy: 70 + Math.random() * 160, vz: Math.sin(a) * sp,
          life: 1.3, age: 0, s0: 22, s1: 5, col: Math.random() < 0.6 ? F.parch : F.gold,
          a: 0.95, kind: 0, drag: 0.3, grav: 60, mesh: 'box', sy: 0.18, vry: (Math.random() - 0.5) * 9, vrx: (Math.random() - 0.5) * 6
        });
      }
    }
    R.glow(x, hb, z, rr * (2.6 + p * 2.2), 2.2, 1.8, 0.9, 0.95 * fade, 0);
    R.light(x, z, hb + 30, 420 + p * 300, 1.8, 1.3, 0.55, 0.95 * fade);
    ring(R, x, z, rr * (2.2 + p * 400), F.goldHot, 0.8 * fade, 9, 0, tt * 1.4);
    R.cameraKick = Math.max(R.cameraKick || 0, 0.45 * fade);
  }

  function draw3D(R, e, tt, env) {
    if (!R || !R.ok || !env) return;
    const rr = rad(e);
    const st = stOf(e);
    const hb = rr * 1.22 + Math.sin(tt * 2.2) * 3.5;
    window.__swPlayer = env.player;

    R.decal(e.x, e.y, rr * 3.1, 0, 0, 0, 0.42, 9, 0, 0, false, 1.3);

    if (imgReady) {
      const sp = R.spriteMesh(img, { depth: 0.5, power: 0.45 });
      if (sp) {
        const ang = Math.atan2(env.player.y - e.y, env.player.x - e.x);
        const size = (rr + 20) * 2.2;
        const m = MAT(R, [1, 1, 1], { tex: sp.tex, emis: sp.emis, emisK: 0.35, rough: 0.6, metal: 0, emissive: [0.14, 0.10, 0.04], rim: 0.6, rimCol: F.gold });
        if (R.isTps) {
          // The inflated sprite is a flat plaque lying on the ground, so the
          // third-person camera looks down on its back. Stand it up toward the
          // camera exactly like every other warden (hearth_warden/void/…).
          const c = Math.cos(R.cam.tyaw), sn = Math.sin(R.cam.tyaw), ux = -sn, uz = c;
          const tilt = 1.2;
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
          R.draw(sp.mesh, M4(R, e.x, hb + size * 0.12, e.y, ang, size, size, size), m);
        }
      }
      // the sprite carries the warden itself; every aura layer still wraps it
      aura3(R, e, tt, hb);
    } else {
      body3(R, e, tt, hb);
    }

    if (st.hitFlash > 0) {
      R.glow(e.x, hb, e.y, rr * 3, 2.2, 2.0, 1.6, clamp(st.hitFlash, 0, 1) * 0.85, 0);
    }
    if (st.cur) telegraph3(R, e, st.cur, tt, hb);
    if (st.phaseAnim) phase3(R, e, st.phaseAnim, tt, hb);
  }

  window.SealWrightFX = { draw2D, draw3D };
})();
