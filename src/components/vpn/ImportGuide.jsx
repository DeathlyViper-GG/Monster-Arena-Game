import { Terminal } from "lucide-react";

// Explains that the tunnel runs in the Tailscale client on the device, and that
// the download is a one-command enrolment rather than a config file.
export default function ImportGuide() {
  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <h2 className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground">After you download</h2>
      <ol className="mt-4 space-y-3 text-xs leading-relaxed text-muted-foreground">
        <li><span className="text-foreground">1.</span> Install Tailscale on the device from tailscale.com/download.</li>
        <li><span className="text-foreground">2.</span> Run the single command in the file — that enrols the device.</li>
        <li><span className="text-foreground">3.</span> The live tunnel status lives in the Tailscale client, not on this page.</li>
        <li><span className="text-foreground">4.</span> Revoke the profile here if the file is lost or no longer needed.</li>
      </ol>
      <p className="mt-4 flex items-start gap-2 border-t border-border/60 pt-4 text-[11px] leading-relaxed text-muted-foreground">
        <Terminal className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        Each download carries a single-use key that expires after 24 hours. It is shown
        once; only its identifier is kept here.
      </p>
    </section>
  );
}