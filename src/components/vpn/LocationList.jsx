import { Check, Circle } from "lucide-react";

const toneFor = (status) => {
  if (status === "online") return "text-chart-2";
  if (status === "degraded") return "text-chart-4";
  return "text-destructive";
};

function Location({ location, selected, onSelect }) {
  const usable = location.status !== "offline";
  return (
    <button
      type="button"
      onClick={() => usable && onSelect(location.id)}
      disabled={!usable}
      className={`w-full rounded-lg border p-4 text-left transition ${
        selected
          ? "border-chart-1/60 bg-chart-1/[0.07]"
          : "border-border bg-background/40 hover:border-border/80 hover:bg-accent/40"
      } ${usable ? "" : "cursor-not-allowed opacity-50"}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-sm font-medium text-foreground">{location.name}</div>
          <div className="mt-0.5 truncate text-[11px] text-muted-foreground">{location.region}</div>
        </div>
        {selected ? (
          <Check className="mt-0.5 h-4 w-4 shrink-0 text-chart-1" />
        ) : (
          <Circle className={`mt-1 h-2 w-2 shrink-0 fill-current ${toneFor(location.status)}`} />
        )}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
        <span>{location.protocol}</span>
        <span className="opacity-40">|</span>
        <span className="truncate normal-case tracking-normal">{location.endpointHost}:{location.endpointPort}</span>
      </div>
    </button>
  );
}

export default function LocationList({ locations, selectedId, onSelect, loading }) {
  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-baseline justify-between">
        <h2 className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground">Server locations</h2>
        <span className="text-[10px] text-muted-foreground">{locations.length}</span>
      </div>

      {loading ? (
        <p className="mt-6 text-xs text-muted-foreground">Checking servers…</p>
      ) : locations.length === 0 ? (
        <p className="mt-6 text-xs leading-relaxed text-muted-foreground">
          No servers have been registered. An operator adds locations once the VPN
          infrastructure is deployed.
        </p>
      ) : (
        <div className="mt-4 space-y-2">
          {locations.map((location) => (
            <Location
              key={location.id}
              location={location}
              selected={location.id === selectedId}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </section>
  );
}