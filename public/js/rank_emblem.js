// ============================================================
// Monster Arena — RANK EMBLEMS (3D medallions).
// Ten ranks, ten stages each. Every emblem is drawn as real layered
// geometry: an aura ring plate, a dark under-plate that gives the disc
// thickness, the metal face, a floating ornament plate and a raised core,
// all inside a preserve-3d scene that sways. From Champion upward the
// medallion also carries orbit rings that precess around it, and a
// specular sweep crosses the face.
//
// The design climbs with rarity: a plain bronze-green disc at Hatchling,
// and by Hollowbane a crowned, four-times-rimmed relic with a void heart
// and its own halo. Within a rank the stages are counted off by a corona of
// one blade per stage behind the disc. Past the tenth stage the secret levels
// stand a second, void-dark sigil beside the earned medallion.
//
// Exposes window.RankEmblem. Load this BEFORE ranks.js.
// ============================================================
(function () {
  'use strict';

  const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
  const PER_RANK = 10;

  // Every rank owns its silhouette, its metal and how much regalia it wears.
  // n/inner/rot describe the polygon; rims, orbit, wings, crown, arc and gem
  // are the ornaments that make the higher ranks read as rarer at a glance.
  const RANKS = [
    { name: 'Hatchling',   tier: 0, n: 3,  inner: 0.00, rot: -90,   metal: ['#d6f7cf', '#5f9a63', '#1c3320'], glow: '#9dffb0', rims: 1, orbit: 0, wings: 0, crown: 0,  arc: 0, gem: 'dot' },
    { name: 'Scavenger',   tier: 1, n: 5,  inner: 0.52, rot: -90,   metal: ['#ffe9b0', '#c08a34', '#3a2609'], glow: '#ffd27a', rims: 1, orbit: 0, wings: 0, crown: 0,  arc: 0, gem: 'dot' },
    { name: 'Hunter',      tier: 2, n: 4,  inner: 0.40, rot: -90,   metal: ['#c2fff7', '#2f9a92', '#0a2e2c'], glow: '#9ffff0', rims: 2, orbit: 0, wings: 0, crown: 0,  arc: 0, gem: 'gem' },
    { name: 'Slayer',      tier: 3, n: 6,  inner: 0.50, rot: -90,   metal: ['#ffc7b8', '#b83c30', '#3d0a0a'], glow: '#ff6a5a', rims: 2, orbit: 0, wings: 1, crown: 0,  arc: 0, gem: 'gem' },
    { name: 'Warden',      tier: 4, n: 6,  inner: 0.00, rot: -90,   metal: ['#d5e6ff', '#3f66b0', '#0d1d3a'], glow: '#8fd0ff', rims: 2, orbit: 1, wings: 1, crown: 0,  arc: 1, gem: 'gem' },
    { name: 'Champion',    tier: 5, n: 8,  inner: 0.72, rot: -90,   metal: ['#fff5c8', '#d1a022', '#3a2605'], glow: '#ffe9a8', rims: 3, orbit: 1, wings: 1, crown: 4,  arc: 1, gem: 'gem' },
    { name: 'Mythic',      tier: 6, n: 8,  inner: 0.00, rot: -67.5, metal: ['#f0d4ff', '#8b47cf', '#200d36'], glow: '#e0b6ff', rims: 3, orbit: 2, wings: 1, crown: 6,  arc: 1, gem: 'star' },
    { name: 'Realmwalker', tier: 7, n: 12, inner: 0.78, rot: -90,   metal: ['#cdf7ff', '#2b76b8', '#07182c'], glow: '#a8f0ff', rims: 3, orbit: 2, wings: 1, crown: 8,  arc: 1, gem: 'star' },
    { name: 'Runebound',   tier: 8, n: 16, inner: 0.88, rot: -90,   metal: ['#ccffe6', '#1f8f72', '#03241b'], glow: '#8dffc4', rims: 4, orbit: 3, wings: 1, crown: 10, arc: 1, gem: 'star' },
    { name: 'Hollowbane',  tier: 9, n: 20, inner: 0.90, rot: -90,   metal: ['#fff2f6', '#a82e66', '#26030f'], glow: '#ff9ad2', rims: 4, orbit: 3, wings: 1, crown: 12, arc: 1, gem: 'void' }
  ];
  const MAX_LEVEL = RANKS.length * PER_RANK;

  let uid = 0;

  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // ---- geometry --------------------------------------------------------
  function starPts(cx, cy, r, n, rot, inner) {
    const steps = inner > 0 ? n * 2 : n;
    const out = [];
    for (let i = 0; i < steps; i++) {
      const a = (Math.PI * 2 * i) / steps + rot;
      const rr = inner > 0 && i % 2 === 1 ? r * inner : r;
      out.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]);
    }
    return out;
  }
  const ptsStr = (p) => p.map((q) => q[0].toFixed(1) + ',' + q[1].toFixed(1)).join(' ');

  function seg(cx, cy, r1, r2, a, color, w, op) {
    return '<line x1="' + (cx + Math.cos(a) * r1).toFixed(1) + '" y1="' + (cy + Math.sin(a) * r1).toFixed(1) +
      '" x2="' + (cx + Math.cos(a) * r2).toFixed(1) + '" y2="' + (cy + Math.sin(a) * r2).toFixed(1) +
      '" stroke="' + color + '" stroke-width="' + w + '" stroke-linecap="round" opacity="' + (op == null ? 1 : op) + '"/>';
  }
  function ticks(cx, cy, r1, r2, count, off, color, w, op) {
    let s = '';
    for (let i = 0; i < count; i++) s += seg(cx, cy, r1, r2, (Math.PI * 2 * i) / count + off, color, w, op);
    return s;
  }
  function dots(cx, cy, r, count, off, rad, color, op) {
    let s = '';
    for (let i = 0; i < count; i++) {
      const a = (Math.PI * 2 * i) / count + off;
      s += '<circle cx="' + (cx + Math.cos(a) * r).toFixed(1) + '" cy="' + (cy + Math.sin(a) * r).toFixed(1) +
        '" r="' + rad + '" fill="' + color + '" opacity="' + op + '"/>';
    }
    return s;
  }
  const svg = (inner) => '<svg viewBox="0 0 120 120" preserveAspectRatio="xMidYMid meet" aria-hidden="true">' + inner + '</svg>';
  const pt = (cx, cy, r, a) => (cx + Math.cos(a) * r).toFixed(1) + ',' + (cy + Math.sin(a) * r).toFixed(1);

  // Within a rank the ten stages climb: the metal brightens, the disc swells
  // and the shape turns a little, so stage IV never passes for stage III.
  function shade(hex, t) {
    const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || ''));
    if (!m) return hex;
    const n = parseInt(m[1], 16);
    const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(function (c) {
      const v = t >= 0 ? c + (255 - c) * t : c * (1 + t);
      return Math.max(0, Math.min(255, Math.round(v)));
    });
    return '#' + ch.map(function (c) { return ('0' + c.toString(16)).slice(-2); }).join('');
  }

  // The stage gauge: ten diamonds along the lower rim, the first `stage` of
  // them lit. It is the plainest "how far into this rank am I" read there is.
  function stageGauge(stage, hi, glow) {
    const from = Math.PI * 0.345;
    const to = Math.PI * 0.655;
    let s = '';
    for (let i = 0; i < PER_RANK; i++) {
      const a = from + ((to - from) * i) / (PER_RANK - 1);
      const cx = 60 + Math.cos(a) * 44;
      const cy = 60 + Math.sin(a) * 44;
      const lit = i < stage;
      const r = lit ? 2.9 : 2.0;
      s += '<polygon points="' + ptsStr([[cx, cy - r], [cx + r, cy], [cx, cy + r], [cx - r, cy]]) +
        '" fill="' + (lit ? glow : 'none') + '" stroke="' + hi + '" stroke-width="' + (lit ? 0.7 : 1) +
        '" opacity="' + (lit ? 1 : 0.3) + '"/>';
    }
    return s;
  }

  // The subrank corona: one big ray per stage, so counting the blades says
  // exactly how deep into the rank a player is. It sits behind the disc, so
  // only the tips show — stage II reads as two blades, stage X as ten.
  function corona(stage, hi) {
    const n = Math.max(1, stage);
    const tip = 45 + stage * 1.3;
    const base = 30;
    const half = Math.max(0.10, 0.30 - n * 0.014);
    let s = '';
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + (Math.PI * 2 * i) / n;
      s += '<polygon points="' + pt(60, 60, base, a - half) + ' ' + pt(60, 60, tip, a) + ' ' +
        pt(60, 60, base, a + half) + '" fill="' + hi +
        '" opacity="' + (0.34 + stage * 0.032).toFixed(2) + '"/>';
    }
    return s;
  }

  // Secret levels carry a second sigil beside the earned medallion: a
  // void-dark star seal of its own, so the rank and its secret stand side by
  // side in chat and on the main screen instead of one hiding behind the other.
  function secretSigil(secret, size, animate) {
    const n = Math.max(7, 6 + Math.min(6, secret));
    const rot = -Math.PI / 2 + secret * 0.14;
    const outer = starPts(60, 60, 41, n, rot, 0.46);
    const mid = starPts(60, 60, 27, n, rot + Math.PI / n, 0.6);
    let body = '<polygon points="' + ptsStr(outer) + '" fill="#150a26" stroke="#c9a8ff" stroke-width="2" stroke-linejoin="round"/>';
    body += '<polygon points="' + ptsStr(mid) + '" fill="none" stroke="#e8d8ff" stroke-width="1.2" opacity=".55"/>';
    body += ticks(60, 60, 33, 39.5, n, rot + Math.PI / n, '#d9bcff', 1.4, 0.6);
    body += dots(60, 60, 30, n, rot, 2.1, '#f4ecff', 0.85);
    body += '<circle cx="60" cy="60" r="46" fill="none" stroke="#b98cff" stroke-width="1" stroke-dasharray="2 8" opacity=".55"/>';
    body += '<circle cx="60" cy="60" r="8.5" fill="#0a0616" stroke="#e0c8ff" stroke-width="2.2"/>';
    body += '<circle cx="60" cy="60" r="3" fill="#fff"/>';
    const s = Math.max(12, Math.round(size || 26));
    return '<span class="rk rk-sigil' + (animate === false ? '' : ' rk-anim') +
      '" style="--w:' + s + 'px;--glow:#c9a8ff" title="Secret level ' + secret + '">' +
      '<span class="rk-spin rk-sigil-spin">' + svg(body) + '</span></span>';
  }

  // ---- ornament layers -------------------------------------------------
  // Stage N of a rank is the same emblem with the first N-1 ornaments on
  // top, so every stage visibly contains the one below it.
  function stageLayer(i, cfg, rot, hi, glow) {
    switch (i) {
      case 1: return '<circle cx="60" cy="60" r="24" fill="none" stroke="' + hi + '" stroke-width="2" opacity=".75" stroke-dasharray="5 4"/>';
      case 2: return ticks(60, 60, 33, 43.5, 4, -Math.PI / 2, hi, 3.2, 0.9);
      case 3: return ticks(60, 60, 33, 43.5, 4, -Math.PI / 4, hi, 2.6, 0.8) +
        '<circle cx="60" cy="60" r="46" fill="none" stroke="' + glow + '" stroke-width="1.4" opacity=".5"/>';
      case 4: return '<polygon points="' + ptsStr(starPts(60, 60, 20, cfg.n, rot, 0.45)) + '" fill="none" stroke="' + glow + '" stroke-width="1.9" opacity=".9"/>';
      case 5: return '<path d="M40 27 L60 17 L80 27" fill="none" stroke="' + hi + '" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" opacity=".9"/>';
      case 6: return '<path d="M26 38 A38 38 0 0 1 94 38" fill="none" stroke="' + glow + '" stroke-width="2.4" stroke-linecap="round" opacity=".9"/>';
      case 7: return '<polygon points="60,88 67,96 60,104 53,96" fill="' + glow + '" opacity=".95"/>';
      case 8: return dots(60, 60, 47, 4, Math.PI / 4, 2.8, glow, 0.95) + dots(60, 60, 47, 4, 0, 1.5, hi, 0.7);
      case 9: return ticks(60, 60, 37, 47, 12, -Math.PI / 2, glow, 1.3, 0.8) +
        '<circle cx="60" cy="60" r="44.5" fill="none" stroke="' + hi + '" stroke-width="1" opacity=".5"/>';
      default: return '';
    }
  }
  function wings(hi, glow) {
    return '<path d="M22 60 L2 45 L8 60 L2 75 Z" fill="' + hi + '" opacity=".92"/>' +
      '<path d="M98 60 L118 45 L112 60 L118 75 Z" fill="' + hi + '" opacity=".92"/>' +
      '<path d="M18 51 L5 44" stroke="' + glow + '" stroke-width="1.5" opacity=".85"/>' +
      '<path d="M102 51 L115 44" stroke="' + glow + '" stroke-width="1.5" opacity=".85"/>';
  }
  function haloArc(hi, glow) {
    return '<path d="M34 31 A32 32 0 0 1 86 31" fill="none" stroke="' + hi + '" stroke-width="1.4" opacity=".55"/>' +
      '<path d="M30 35 A36 36 0 0 1 90 35" fill="none" stroke="' + glow + '" stroke-width="3" opacity=".16"/>';
  }
  function crown(cfg, hi, glow) {
    const count = cfg.crown || 0;
    if (count < 2) return '';
    const span = Math.PI * 1.12;
    const start = -Math.PI / 2 - span / 2;
    let s = '';
    for (let i = 0; i < count; i++) {
      const a = start + (span * i) / (count - 1);
      const long = i % 2 === 0;
      const r2 = 34 + (long ? 13 : 8);
      s += seg(60, 60, 33, r2, a, hi, long ? 2.2 : 1.4, 0.95);
      if (long) {
        s += '<circle cx="' + (60 + Math.cos(a) * r2).toFixed(1) + '" cy="' + (60 + Math.sin(a) * r2).toFixed(1) +
          '" r="1.7" fill="' + glow + '"/>';
      }
    }
    return s;
  }
  function secretHalo(secret, glow, hi) {
    let s = '';
    s += ticks(60, 60, 40, 52, Math.min(18, 6 + secret * 2), Math.PI / 2, hi, 1.2, 0.55);
    s += dots(60, 60, 50, Math.min(12, 4 + secret), secret * 0.4, 1.6, glow, 0.85);
    return s;
  }

  // ---- core ------------------------------------------------------------
  function core(cfg, hi, glow, rot) {
    switch (cfg.gem) {
      case 'gem':
        return '<polygon points="60,47 73,60 60,73 47,60" fill="' + glow + '" opacity=".9"/>' +
          '<polygon points="60,47 73,60 60,60" fill="#fff" opacity=".55"/>' +
          '<polygon points="60,47 47,60 60,60" fill="' + hi + '" opacity=".45"/>';
      case 'star':
        return '<path d="M60 43 L63.4 56.6 L77 60 L63.4 63.4 L60 77 L56.6 63.4 L43 60 L56.6 56.6 Z" fill="#fff" opacity=".95"/>' +
          '<circle cx="60" cy="60" r="4.2" fill="' + glow + '"/>';
      case 'void':
        return '<circle cx="60" cy="60" r="10" fill="#05030c" stroke="' + glow + '" stroke-width="2.2"/>' +
          '<circle cx="60" cy="60" r="3.2" fill="#fff" opacity=".92"/>' +
          dots(60, 60, 15.5, 6, 0, 1.3, glow, 0.9);
      default:
        return '<polygon points="' + ptsStr(starPts(60, 60, 9, cfg.n, rot, 0.5)) + '" fill="' + glow + '" opacity=".6"/>' +
          '<circle cx="60" cy="60" r="2.6" fill="#fff" opacity=".7"/>';
    }
  }

  // ---- assembly --------------------------------------------------------
  function render(info, size, animate) {
    injectCSS();
    const lv = info || {};
    const cfg = RANKS[Math.max(0, Math.min(RANKS.length - 1, lv.rankIndex || 0))];
    const stage = Math.max(1, Math.min(PER_RANK, lv.stage || 1));
    const secret = Math.max(0, lv.secret || 0);
    const s = Math.max(12, Math.round(size || 40));
    const tier = cfg.tier;
    // Stage 1 → 10 is a climb, not a repeat: the disc grows, turns a few
    // degrees and its metal brightens at every step.
    const k = (stage - 1) / (PER_RANK - 1);
    const rot = ((cfg.rot || -90) + (stage - 1) * 6) * Math.PI / 180;
    const hi = shade(cfg.metal[0], 0.78 * k);
    const mid = shade(cfg.metal[1], 0.32 * k);
    const lo = shade(cfg.metal[2], -0.58 * k);
    const glow = cfg.glow;
    const id = 'rk' + (++uid);
    const rich = animate !== false && s >= 30;
    const detail = s >= 24;

    const R = 29.5 + stage * 0.85;
    const main = starPts(60, 60, R, cfg.n, rot, cfg.inner);
    const facet = starPts(60, 60, R * 0.706, cfg.n, rot, cfg.inner);
    const inner = starPts(60, 60, R * 0.44, cfg.n, rot, cfg.inner);

    // aura: the rings floating behind the medallion
    let aura = corona(stage, hi);
    for (let k = 0; k < cfg.rims; k++) {
      aura += '<circle cx="60" cy="60" r="' + (39 + k * 4.4).toFixed(1) + '" fill="none" stroke="' + (k % 2 ? hi : glow) +
        '" stroke-width="' + (1.35 - k * 0.22).toFixed(2) + '" opacity="' + (0.55 - k * 0.09).toFixed(2) +
        '" stroke-dasharray="' + (k % 2 ? '3 7' : '13 7') + '"/>';
    }
    aura += ticks(60, 60, 43.5, 47.5, 12, 0, hi, 0.9, 0.26);
    if (secret > 0) aura += secretHalo(secret, glow, hi);

    // edge: the dark under-surface that gives the disc thickness in 3D
    const edge = svg('<polygon points="' + ptsStr(main) + '" fill="' + lo + '" stroke="' + lo + '" stroke-width="3" stroke-linejoin="round"/>');

    // face: the metal
    let face = '<defs>' +
      '<linearGradient id="' + id + 'm" x1=".15" y1="0" x2=".78" y2="1">' +
        '<stop offset="0" stop-color="' + hi + '"/><stop offset=".46" stop-color="' + mid + '"/><stop offset="1" stop-color="' + lo + '"/>' +
      '</linearGradient>' +
      '<radialGradient id="' + id + 'f" cx=".4" cy=".28" r=".8">' +
        '<stop offset="0" stop-color="' + hi + '" stop-opacity=".9"/><stop offset="1" stop-color="' + mid + '" stop-opacity="0"/>' +
      '</radialGradient>' +
      '</defs>';
    face += '<polygon points="' + ptsStr(main) + '" fill="url(#' + id + 'm)" stroke="' + hi + '" stroke-width="1.9" stroke-linejoin="round"/>';
    face += '<polygon points="' + ptsStr(facet) + '" fill="url(#' + id + 'f)" opacity=".7"/>';
    face += '<polygon points="' + ptsStr(facet) + '" fill="none" stroke="' + hi + '" stroke-width=".9" opacity=".45"/>';
    if (tier >= 4) face += '<polygon points="' + ptsStr(inner) + '" fill="' + lo + '" opacity=".32"/>';

    // ornaments: only the layers this stage has earned, plus the rank's regalia
    let orn = '';
    for (let i = 1; i < stage; i++) orn += stageLayer(i, cfg, rot, hi, glow);
    orn += stageGauge(stage, hi, glow);
    if (cfg.wings) orn += wings(hi, glow);
    if (cfg.arc) orn += haloArc(hi, glow);
    if (cfg.crown) orn += crown(cfg, hi, glow);

    let orbits = '';
    if (rich) for (let k = 0; k < cfg.orbit; k++) orbits += '<span class="rk-orbit rk-o' + ((k % 3) + 1) + '"></span>';

    const emblem = '<span class="rk rk-t' + tier + (animate === false ? '' : ' rk-anim') + (secret ? ' rk-secret' : '') +
      '" style="--w:' + s + 'px;--glow:' + glow + '">' +
      (detail ? '<span class="rk-halo"></span>' : '') +
      '<span class="rk-spin">' +
        '<span class="rk-p" style="--z:-0.105">' + svg(aura) + '</span>' +
        '<span class="rk-p" style="--z:-0.055">' + edge + '</span>' +
        '<span class="rk-p" style="--z:0">' + svg(face) + '</span>' +
        (orn ? '<span class="rk-p rk-p-orn" style="--z:0.085">' + svg(orn) + '</span>' : '') +
        '<span class="rk-p" style="--z:0.16">' + svg('<g transform="translate(60 60) scale(' + (1 + k * 0.5).toFixed(3) + ') translate(-60 -60)">' + core(cfg, hi, glow, rot) + '</g>') + '</span>' +
        orbits +
      '</span>' +
      (detail ? '<span class="rk-sheen"></span>' : '') +
      '</span>';

    return secret ? emblem + secretSigil(secret, Math.round(s * 0.66), animate) : emblem;
  }

  // ---- secrets ---------------------------------------------------------
  // What lies beyond the current rank is never drawn: the profile shows this
  // sealed medallion instead, so the ladder stays a mystery until it's earned.
  function veiled(size) {
    injectCSS();
    const s = Math.max(40, Math.round(size || 64));
    return '<span class="rk rk-veiled rk-anim" style="--w:' + s + 'px;--glow:#8f7ad8">' +
      '<span class="rk-halo"></span>' +
      '<span class="rk-spin"><span class="rk-p" style="--z:0"><svg viewBox="0 0 120 120" aria-hidden="true">' +
        '<circle cx="60" cy="60" r="35" fill="rgba(10,8,20,.92)" stroke="#6f5ca8" stroke-width="1.6" stroke-dasharray="4 7"/>' +
        '<circle cx="60" cy="60" r="41" fill="none" stroke="#8f7ad8" stroke-width=".9" opacity=".45" stroke-dasharray="2 8"/>' +
        '<rect x="48" y="57" width="24" height="19" rx="4" fill="#241a3c" stroke="#8a76c8" stroke-width="2"/>' +
        '<path d="M53 57 V51 a7 7 0 0 1 14 0 V57" fill="none" stroke="#8a76c8" stroke-width="2.4" stroke-linecap="round"/>' +
        '<circle cx="60" cy="66" r="2.6" fill="#b7a6ee"/>' +
        '<path d="M60 68 v4" stroke="#b7a6ee" stroke-width="2" stroke-linecap="round"/>' +
      '</svg></span></span><span class="rk-sheen"></span></span>';
  }

  // ---- level → rank ----------------------------------------------------
  function parts(level) {
    const l = Math.max(1, Math.floor(Number(level) || 1));
    if (l <= MAX_LEVEL) {
      const ri = Math.floor((l - 1) / PER_RANK);
      const stage = ((l - 1) % PER_RANK) + 1;
      return { level: l, rankIndex: ri, stage: stage, secret: 0, title: RANKS[ri].name + ' ' + ROMAN[stage - 1] };
    }
    const secret = l - MAX_LEVEL;
    return {
      level: l, rankIndex: RANKS.length - 1, stage: PER_RANK, secret: secret,
      title: RANKS[RANKS.length - 1].name + ' X ✦' + secret
    };
  }

  // Small, still badge for chat feeds (animation would fight the scroll).
  function badge(levelIn, size) {
    const lv = Math.max(1, Math.floor(Number(levelIn) || 1));
    const p = parts(lv);
    return '<span class="rank-badge" title="' + esc(p.title) + '">' + render(p, size || 16, false) + '</span>';
  }

  // ---- styles ----------------------------------------------------------
  const CSS = `
  .rk{position:relative;display:inline-block;width:var(--w);height:var(--w);flex:0 0 auto;vertical-align:middle;
    perspective:calc(var(--w) * 5);perspective-origin:50% 44%;isolation:isolate;}
  .rk::after{content:"";position:absolute;left:15%;right:15%;bottom:-8%;height:14%;border-radius:50%;z-index:-1;
    background:radial-gradient(ellipse at center,rgba(0,0,0,.5),transparent 70%);filter:blur(calc(var(--w) * .035));}
  .rk-halo{position:absolute;inset:-24%;border-radius:50%;pointer-events:none;opacity:.3;
    background:radial-gradient(circle at 50% 50%,var(--glow) 0%,transparent 62%);filter:blur(calc(var(--w) * .055));}
  .rk-spin{position:absolute;inset:0;transform-style:preserve-3d;transform:rotateX(14deg) rotateY(-16deg);will-change:transform;}
  .rk-anim>.rk-spin{animation:rkSway 9s ease-in-out infinite;}
  @keyframes rkSway{0%,100%{transform:rotateX(14deg) rotateY(-19deg)}50%{transform:rotateX(9deg) rotateY(19deg)}}
  .rk-p{position:absolute;inset:0;transform-style:preserve-3d;transform:translateZ(calc(var(--w) * var(--z,0)));}
  .rk-p>svg{width:100%;height:100%;display:block;overflow:visible;}
  .rk-anim>.rk-p.rk-p-orn{animation:rkLift 7s ease-in-out infinite;}
  @keyframes rkLift{0%,100%{transform:translateZ(calc(var(--w) * var(--z,0)))}50%{transform:translateZ(calc(var(--w) * var(--z,0) * 1.9))}}
  .rk-sigil{margin-left:calc(var(--w) * -.06);filter:drop-shadow(0 0 calc(var(--w) * .13) #b98cff);}
  .rk-anim>.rk-spin.rk-sigil-spin{animation:rkSigilSway 11s ease-in-out infinite;}
  @keyframes rkSigilSway{0%,100%{transform:rotateX(10deg) rotateY(24deg)}50%{transform:rotateX(16deg) rotateY(-24deg)}}
  .rk-anim .rk-halo{animation:rkPulse 5.5s ease-in-out infinite;}
  @keyframes rkPulse{0%,100%{opacity:.22;transform:scale(.94)}50%{opacity:.48;transform:scale(1.06)}}
  .rk-sheen{position:absolute;inset:0;border-radius:50%;overflow:hidden;pointer-events:none;mix-blend-mode:screen;}
  .rk-sheen::after{content:"";position:absolute;top:-45%;left:-150%;width:52%;height:190%;transform:rotate(22deg);
    background:linear-gradient(90deg,rgba(255,255,255,0),rgba(255,255,255,.72),rgba(255,255,255,0));}
  .rk-anim .rk-sheen::after{animation:rkSheen 6.5s cubic-bezier(.4,0,.2,1) infinite;}
  @keyframes rkSheen{0%{left:-150%}52%,100%{left:135%}}
  .rk-orbit{position:absolute;inset:-13%;border-radius:50%;border:1px dashed var(--glow);opacity:.45;transform-style:preserve-3d;}
  .rk-orbit::after{content:"";position:absolute;top:calc(var(--w) * -.045);left:50%;width:calc(var(--w) * .09);height:calc(var(--w) * .09);
    margin-left:calc(var(--w) * -.045);border-radius:50%;background:var(--glow);box-shadow:0 0 calc(var(--w) * .09) var(--glow);}
  .rk-o1{animation:rkOrbA 12s linear infinite;}
  .rk-o2{animation:rkOrbB 8.5s linear infinite reverse;}
  .rk-o3{animation:rkOrbC 16s linear infinite;}
  @keyframes rkOrbA{from{transform:rotateX(74deg) rotateZ(0turn)}to{transform:rotateX(74deg) rotateZ(1turn)}}
  @keyframes rkOrbB{from{transform:rotateX(62deg) rotateY(22deg) rotateZ(0turn)}to{transform:rotateX(62deg) rotateY(22deg) rotateZ(1turn)}}
  @keyframes rkOrbC{from{transform:rotateX(84deg) rotateY(-16deg) rotateZ(0turn)}to{transform:rotateX(84deg) rotateY(-16deg) rotateZ(1turn)}}
  .rk-t5{filter:drop-shadow(0 0 calc(var(--w) * .055) var(--glow));}
  .rk-t7{filter:drop-shadow(0 0 calc(var(--w) * .085) var(--glow));}
  .rk-t9{filter:drop-shadow(0 0 calc(var(--w) * .12) var(--glow));}
  .rk-secret{filter:drop-shadow(0 0 calc(var(--w) * .16) #c9a8ff);}
  .rk-veiled{opacity:.95;}`;

  let styled = false;
  function injectCSS() {
    if (styled) return;
    styled = true;
    const st = document.createElement('style');
    st.id = 'rankEmblemCSS';
    st.textContent = CSS;
    document.head.appendChild(st);
  }

  window.RankEmblem = { RANKS, ROMAN, PER_RANK, MAX_LEVEL, parts, render, badge, veiled };
})();
