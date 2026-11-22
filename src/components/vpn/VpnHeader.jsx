import { Link } from "react-router-dom";
import { ArrowLeft, ShieldCheck } from "lucide-react";

// Page masthead. States plainly what this area does and, more importantly,
// what it does not do: it manages profiles, it never tunnels the device.
export default function VpnHeader() {
  return (
    <header className="border-b border-border/70 pb-6">
      <Link
        to="/"
        className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.28em] text-muted-foreground transition hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to the arena
      </Link>
      <div className="mt-5 flex items-start gap-4">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg border border-chart-1/40 bg-chart-1/10 text-chart-1">
          <ShieldCheck className="h-5 w-5" />
        </span>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Network Access</h1>
          <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Issue a device profile for one of our VPN servers, then import it into a
            WireGuard or OpenVPN client. The tunnel itself runs on your device — this
            page only provisions and revokes access.
          </p>
        </div>
      </div>
    </header>
  );
}