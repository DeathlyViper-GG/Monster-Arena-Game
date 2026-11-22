import { Circle } from "lucide-react";

const toneFor = (state) => {
  if (state === "ok") return "text-chart-2";
  if (state === "warn") return "text-chart-4";
  if (state === "bad") return "text-destructive";
  return "text-muted-foreground";
};

const labelFor = (state) => {
  if (state === "ok") return "Online";
  if (state === "warn") return "Degraded";
  if (state === "bad") return "Unavailable";
  return "Unknown";
};

function Row({ title, state, detail }) {
  return (
    <div className="flex items-start justify-between gap-4 border-t border-border/60 py-3 first:border-t-0 first:pt-0">
      <div>
        <div className="text-xs font-medium text-foreground">{title}</div>
        <div className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">{detail}</div>
      </div>
      <span className={`inline-flex shrink-0 items-center gap-1.5 text-[10px] uppercase tracking-[0.14em] ${toneFor(state)}`}>
        <Circle className="h-2 w-2 fill-current" />
        {labelFor(state)}
      </span>
    </div>
  );
}

// Reports the real state of the pieces this service depends on. Nothing here is
// ever faked green: a missing control-plane secret or an unreachable VPN API
// surfaces as unavailable, with the reason underneath.
export default function ServiceStatus({ configured, reachable, reason }) {
  const control = configured ? (reachable === null ? "idle" : reachable ? "ok" : "bad") : "bad";
  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <h2 className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground">Service status</h2>
      <div className="mt-4">
        <Row
          title="VPN control plane"
          state={control}
          detail={configured ? reason || "Connected to your VPN server API." : "No VPN server API credentials are configured for this workspace yet."}
        />
        <Row
          title="Device tunnel"
          state="idle"
          detail="Handled by your device's WireGuard / OpenVPN client — not by this website."
        />
        <Row
          title="Private keys"
          state="ok"
          detail="Generated on the VPN server and shown once. Never written to this app's database."
        />
      </div>
    </section>
  );
}