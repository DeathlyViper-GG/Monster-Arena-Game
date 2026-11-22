/* A synthesised "speaking voice" for the films: no recordings, just a formant-filtered
   syllable per word, with its own pitch and cadence for every character, so the line
   is heard as it is spoken and the actor's mouth, hands and the world cues stay on it. */

const VOICES = [
  { f0: 205, range: 0.22, formant: 1100, dur: 0.1, gain: 0.05, wave: "sawtooth" },    // Ilyra — warm, level
  { f0: 262, range: 0.3, formant: 1500, dur: 0.085, gain: 0.045, wave: "triangle" },   // Sable — bright, quick
  { f0: 138, range: 0.18, formant: 820, dur: 0.12, gain: 0.055, wave: "sawtooth" },    // Orrin — slow, dry
  { f0: 168, range: 0.26, formant: 950, dur: 0.105, gain: 0.05, wave: "sawtooth" },    // Maren — weathered
  { f0: 232, range: 0.16, formant: 1250, dur: 0.14, gain: 0.04, wave: "sine" },        // Vesh — hushed
  { f0: 62, range: 0.08, formant: 380, dur: 0.26, gain: 0.11, wave: "square" },        // The Sentinel — a grind under the words
];

export function createVoice() {
  let ctx = null, master = null, verb = null, muted = false;
  const ensure = () => {
    if (ctx) return ctx;
    try {
      const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null;
      ctx = new AC(); master = ctx.createGain(); master.gain.value = muted ? 0 : 1; master.connect(ctx.destination);
      const len = ctx.sampleRate * 1.6, buf = ctx.createBuffer(2, len, ctx.sampleRate);
      for (let c = 0; c < 2; c++) { const d = buf.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2); }
      verb = ctx.createConvolver(); verb.buffer = buf; const wet = ctx.createGain(); wet.gain.value = 0.22; verb.connect(wet); wet.connect(master);
    } catch (_) { ctx = null; }
    return ctx;
  };
  return {
    resume() { const c = ensure(); if (c && c.state === "suspended") c.resume().catch(() => {}); },
    setMuted(m) { muted = m; if (master) master.gain.value = m ? 0 : 1; },
    get muted() { return muted; },
    /* one syllable. `emphasis` 0..1 lifts pitch and length at the end of clauses and on question marks */
    say(voice = 0, emphasis = 0, contour = 0) {
      const c = ensure(); if (!c || muted) return;
      const v = VOICES[voice] || VOICES[0], t = c.currentTime + 0.005;
      const f = v.f0 * (1 + (Math.random() - 0.5) * v.range + contour * 0.18 + emphasis * 0.12);
      const o = c.createOscillator(); o.type = v.wave; o.frequency.setValueAtTime(f, t); o.frequency.exponentialRampToValueAtTime(f * (0.92 + Math.random() * 0.14), t + v.dur * (1 + emphasis));
      const bp = c.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = v.formant * (0.8 + Math.random() * 0.5); bp.Q.value = voice === 5 ? 2.4 : 3.2;
      const lp = c.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = voice === 5 ? 520 : 2600;
      const g = c.createGain(); const d = v.dur * (1 + emphasis * 0.9);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v.gain * (0.8 + Math.random() * 0.4), t + 0.018); g.gain.exponentialRampToValueAtTime(0.0008, t + d);
      o.connect(bp); bp.connect(lp); lp.connect(g); g.connect(master); g.connect(verb); o.start(t); o.stop(t + d + 0.02);
      if (voice === 5) { const sub = c.createOscillator(); sub.type = "sine"; sub.frequency.value = f * 0.5; const sg = c.createGain(); sg.gain.setValueAtTime(0, t); sg.gain.linearRampToValueAtTime(0.09, t + 0.03); sg.gain.exponentialRampToValueAtTime(0.0008, t + d * 1.3); sub.connect(sg); sg.connect(master); sub.start(t); sub.stop(t + d * 1.3 + 0.02); }
    },
    /* a soft world sound for cues */
    thump(depth = 1) {
      const c = ensure(); if (!c || muted) return; const t = c.currentTime;
      const o = c.createOscillator(); o.type = "sine"; o.frequency.setValueAtTime(90 * depth, t); o.frequency.exponentialRampToValueAtTime(34, t + 0.5);
      const g = c.createGain(); g.gain.setValueAtTime(0.16, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.7); o.connect(g); g.connect(master); o.start(t); o.stop(t + 0.75);
    },
    dispose() { try { ctx && ctx.close(); } catch (_) {} ctx = null; },
  };
}
