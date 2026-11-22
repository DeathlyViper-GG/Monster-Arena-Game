import { useRef, useState } from "react";

/* A thumb stick for phones: drag anywhere inside the base to walk. */

export default function VillageJoystick({ onMove }) {
  const baseRef = useRef(null);
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const active = useRef(false);

  const handle = (event) => {
    if (!active.current || !baseRef.current) return;
    const rect = baseRef.current.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const radius = rect.width / 2;
    let dx = (event.clientX - cx) / radius;
    let dy = (event.clientY - cy) / radius;
    const len = Math.hypot(dx, dy);
    if (len > 1) {
      dx /= len;
      dy /= len;
    }
    setKnob({ x: dx, y: dy });
    onMove?.(dx, dy);
  };

  const release = () => {
    active.current = false;
    setKnob({ x: 0, y: 0 });
    onMove?.(0, 0);
  };

  return (
    <div
      ref={baseRef}
      data-ui
      onPointerDown={(event) => {
        event.stopPropagation();
        active.current = true;
        event.currentTarget.setPointerCapture?.(event.pointerId);
        handle(event);
      }}
      onPointerMove={handle}
      onPointerUp={release}
      onPointerCancel={release}
      className="absolute bottom-28 left-4 z-20 h-28 w-28 touch-none rounded-full border border-white/20 bg-black/35 backdrop-blur md:hidden"
    >
      <div
        className="absolute left-1/2 top-1/2 h-12 w-12 rounded-full border border-white/40 bg-white/25"
        style={{ transform: `translate(calc(-50% + ${knob.x * 32}px), calc(-50% + ${knob.y * 32}px))` }}
      />
    </div>
  );
}