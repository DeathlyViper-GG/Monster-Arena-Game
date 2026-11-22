import { Download, Loader2, ShieldOff } from "lucide-react";

const STATUS_STYLE = {
  active: "border-chart-2/40 text-chart-2",
  pending: "border-chart-4/40 text-chart-4",
  revoked: "border-border text-muted-foreground",
};

function Profile({ profile, locationName, onRevoke, busy }) {
  const revoked = profile.status === "revoked";
  return (
    <div className="flex items-start justify-between gap-3 border-t border-border/60 py-3 first:border-t-0 first:pt-0">
      <div className="min-w-0">
        <div className="truncate text-xs font-medium text-foreground">{profile.label}</div>
        <div className="mt-0.5 truncate text-[11px] text-muted-foreground">{locationName}</div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <span className={`rounded-full border px-2 py-0.5 text-[9px] uppercase tracking-[0.14em] ${STATUS_STYLE[profile.status] || STATUS_STYLE.pending}`}>
          {profile.status}
        </span>
        {!revoked && (
          <button
            type="button"
            onClick={() => onRevoke(profile)}
            disabled={busy}
            className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[10px] uppercase tracking-[0.1em] text-muted-foreground transition hover:border-destructive/50 hover:text-destructive disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <ShieldOff className="h-3 w-3" />}
            Revoke
          </button>
        )}
      </div>
    </div>
  );
}

export default function ProfilePanel({ profiles, locationName, onRevoke, revokingId }) {
  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-baseline justify-between">
        <h2 className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground">Your profiles</h2>
        <span className="text-[10px] text-muted-foreground">{profiles.length}</span>
      </div>

      {profiles.length === 0 ? (
        <p className="mt-6 flex items-start gap-2 text-xs leading-relaxed text-muted-foreground">
          <Download className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          No profiles yet. Choose a location and create one — the configuration file
          downloads once, and we keep only its public key.
        </p>
      ) : (
        <div className="mt-4">
          {profiles.map((profile) => (
            <Profile
              key={profile.id}
              profile={profile}
              locationName={locationName(profile.locationId)}
              onRevoke={onRevoke}
              busy={revokingId === profile.id}
            />
          ))}
        </div>
      )}
    </section>
  );
}