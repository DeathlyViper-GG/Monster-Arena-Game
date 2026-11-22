import * as THREE from "three";

/* ═════════════════════════════════════════════════════════════════
   CAMERA GRAMMAR FOR THE SENTINEL FILMS

   Every beat of every film is shot on its own vantage: a beat names an
   ANCHOR (the thing it looks at inside a world) and a STYLE (how the
   camera moves over it). Each world publishes four or five anchors, and
   the ten styles below turn them into ten unrelated compositions, so no
   two beats of the campaign ever share a view — and none repeats.

   Anchors carry the numbers the styles need:
     focus    – the point the shot is built around
     distance – how far the camera stands off the focus
     height   – how high it sits
     sway     – amplitude of the slow breathing motion
     rise     – how far a lifting style travels
     radius   – how wide an orbit/aerial tracks
     travel   – how far a tracking shot slides
     back     – how far behind the subject a reverse shot stands
     angle    – where an orbit starts
   ═════════════════════════════════════════════════════════════════ */

const easeInOut = (t) => t * t * (3 - 2 * t);
const ramp = (time, seconds) => easeInOut(Math.min(1, Math.max(0, time / seconds)));

/** Drifting close shot: the inhabitants, not the guardian. */
export function shotClose(camera, anchor, time, pointer) {
  const px = pointer?.x ?? 0;
  const py = pointer?.y ?? 0;
  const swing = (anchor.swing ?? 0.55) * Math.sin(time * 0.075) + (anchor.angle ?? 0);
  const lift = Math.sin(time * 0.19) * 1.4;
  camera.position.set(
    anchor.focus[0] + Math.sin(swing) * anchor.distance,
    anchor.height + lift - py * 2.2,
    anchor.focus[2] + Math.cos(swing) * anchor.distance,
  );
  camera.lookAt(anchor.focus[0] + px * 4, anchor.focus[1], anchor.focus[2]);
}

/** Slow aerial pull-back over the whole realm. */
export function shotWide(camera, anchor, time, pointer) {
  const px = pointer?.x ?? 0;
  const t = easeInOut(Math.min(1, time / 17));
  const drift = Math.sin(time * 0.045) * (anchor.sway ?? 6);
  camera.position.set(
    anchor.focus[0] + drift + px * 10,
    anchor.height + t * (anchor.rise ?? 34),
    anchor.focus[2] + anchor.distance + t * (anchor.back ?? 40),
  );
  camera.lookAt(anchor.focus[0] + px * 6, anchor.focus[1], anchor.focus[2]);
}

/** Which of the two legacy shots a phase means. */
export function shotFor(phase, camera, shots, time, pointer) {
  if (phase === 2) shotClose(camera, shots.close, time, pointer);
  else shotWide(camera, shots.wide, time, pointer);
}

/** Keeps a wide shot legible: thinner fog, more visible horizon. */
export function thinFog(scene, density, phase) {
  if (!scene.fog) return;
  scene.fog.density = phase === 3 ? density * 0.45 : density;
}

/* ── the ten styles ─────────────────────────────────────────── */

export function shotBy(camera, anchor, style, time, pointer) {
  const px = pointer?.x ?? 0;
  const py = pointer?.y ?? 0;
  const [fx, fy, fz] = anchor.focus ?? [0, 20, -40];
  const d = anchor.distance ?? 50;
  const h = anchor.height ?? 18;
  const sway = anchor.sway ?? 3;
  const rise = anchor.rise ?? 44;
  const radius = anchor.radius ?? 46;
  const travel = anchor.travel ?? 110;
  const back = anchor.back ?? 90;

  switch (style) {
    /* slowly circling the subject — reads as a ceremony */
    case "orbit": {
      const a = (anchor.angle ?? 0) + time * 0.051 + px * 0.22;
      camera.position.set(fx + Math.sin(a) * d, h + Math.sin(time * 0.21) * sway - py * 3, fz + Math.cos(a) * d);
      camera.lookAt(fx + px * 5, fy, fz);
      break;
    }
    /* a jib coming down out of the sky onto the subject */
    case "crane": {
      const t = ramp(time, 18);
      camera.position.set(fx + Math.sin(time * 0.05) * sway + px * 6, h + (1 - t) * rise, fz + d * (0.3 + t * 0.7));
      camera.lookAt(fx + px * 4, fy + (1 - t) * 14, fz);
      break;
    }
    /* a steady push straight in */
    case "dolly": {
      const t = ramp(time, 20);
      camera.position.set(fx + px * 5, h + Math.sin(time * 0.16) * 2, fz + d * (1.6 - t * 0.8));
      camera.lookAt(fx + px * 3, fy, fz);
      break;
    }
    /* a shoulder-height drift with a real hand in it */
    case "handheld": {
      const jx = Math.sin(time * 0.93) * 0.7 + Math.sin(time * 2.3) * 0.24;
      const jy = Math.cos(time * 1.13) * 0.55 + Math.cos(time * 2.9) * 0.2;
      camera.position.set(fx + jx + px * 3, h + jy - py * 2, fz + d * 0.78);
      camera.lookAt(fx + jx * 0.4, fy + jy * 0.4, fz);
      camera.rotation.z += Math.sin(time * 0.61) * 0.007;
      break;
    }
    /* high above, turning — the realm as a written page */
    case "aerial": {
      const a = time * 0.028 + (anchor.angle ?? 0);
      camera.position.set(
        fx + Math.sin(a) * radius + px * 8,
        h + rise,
        fz + Math.cos(a) * radius + d * 0.45,
      );
      camera.lookAt(fx + px * 5, fy, fz);
      break;
    }
    /* starting on the ground, lifting past the subject */
    case "rise": {
      const t = ramp(time, 18);
      camera.position.set(fx + Math.sin(time * 0.1) * sway + px * 4, h + t * rise, fz + d * (1.05 - t * 0.28));
      camera.lookAt(fx, fy + t * 12, fz);
      break;
    }
    /* a lateral glide past the subject */
    case "track": {
      const t = ramp(time, 16);
      camera.position.set(fx + (t - 0.5) * travel + px * 4, h, fz + d);
      camera.lookAt(fx + (t - 0.5) * travel * 0.16, fy, fz);
      break;
    }
    /* standing behind the subject, looking back over it at the realm */
    case "reverse": {
      camera.position.set(fx + Math.sin(time * 0.08) * sway, h + Math.sin(time * 0.19) * 2, fz - back);
      camera.lookAt(fx * 0.5 + px * 6, fy * 0.62, fz + d);
      break;
    }
    /* ground level, looking up — everything is taller than you */
    case "low": {
      camera.position.set(fx + Math.sin(time * 0.07) * sway + px * 3, 2.4 + Math.sin(time * 0.3) * 0.4, fz + d * 0.72);
      camera.lookAt(fx, fy + 14, fz);
      break;
    }
    /* a distant, patient survey that never settles */
    default: {
      const t = ramp(time, 24);
      camera.position.set(fx - travel * (0.6 - t * 0.6) + px * 6, h + t * 8, fz + d * (1 + t * 0.38));
      camera.lookAt(fx, fy, fz);
      break;
    }
  }
}

export const SHOT_STYLES = [
  "orbit",
  "crane",
  "dolly",
  "handheld",
  "aerial",
  "rise",
  "track",
  "reverse",
  "low",
  "survey",
];

export { THREE };