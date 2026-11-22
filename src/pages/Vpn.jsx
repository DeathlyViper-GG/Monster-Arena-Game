import { useCallback, useEffect, useState } from "react";
import { Loader2, Plus, AlertTriangle } from "lucide-react";
import { base44 } from "@/api/base44Client";
import VpnHeader from "@/components/vpn/VpnHeader";
import ServiceStatus from "@/components/vpn/ServiceStatus";
import LocationList from "@/components/vpn/LocationList";
import ProfilePanel from "@/components/vpn/ProfilePanel";
import ImportGuide from "@/components/vpn/ImportGuide";

function downloadConfig(filename, content) {
  const url = URL.createObjectURL(new Blob([content], { type: "text/plain" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

const errorText = (e) => e?.response?.data?.error || e?.message || "Something went wrong.";

export default function Vpn() {
  const [status, setStatus] = useState({ configured: false, reachable: null, reason: "" });
  const [locations, setLocations] = useState([]);
  const [profiles, setProfiles] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [label, setLabel] = useState("");
  const [creating, setCreating] = useState(false);
  const [revokingId, setRevokingId] = useState(null);
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const [statusRes, locationPage, profilePage] = await Promise.all([
      base44.functions.invoke("vpn_api", { action: "status" }),
      base44.entities.VpnLocation.filter({}, { sort: "name", limit: 50 }),
      base44.entities.VpnProfile.filter({}, { sort: "-created_date", limit: 50 }),
    ]);
    setStatus(statusRes.data || {});
    const list = locationPage?.items || [];
    setLocations(list);
    setProfiles(profilePage?.items || []);
    setSelectedId((current) => current || list.find((l) => l.status !== "offline")?.id || list[0]?.id || null);
  }, []);

  useEffect(() => {
    refresh()
      .catch((e) => setNotice(errorText(e)))
      .finally(() => setLoading(false));
  }, [refresh]);

  const create = async () => {
    if (!selectedId) return;
    setCreating(true);
    setNotice("");
    try {
      const res = await base44.functions.invoke("vpn_api", {
        action: "provision",
        locationId: selectedId,
        label: label.trim() || "This device",
      });
      const data = res.data || {};
      if (!data.config) throw new Error("No configuration was returned.");
      downloadConfig(data.filename || "profile.conf", data.config);
      setLabel("");
      await refresh();
    } catch (e) {
      setNotice(errorText(e));
    } finally {
      setCreating(false);
    }
  };

  const revoke = async (profile) => {
    setRevokingId(profile.id);
    setNotice("");
    try {
      await base44.functions.invoke("vpn_api", { action: "revoke", profileId: profile.id });
      await refresh();
    } catch (e) {
      setNotice(errorText(e));
    } finally {
      setRevokingId(null);
    }
  };

  const locationName = (id) => locations.find((l) => l.id === id)?.name || "Server removed";
  const serverDown = !status.configured || status.reachable === false;

  return (
    <div className="dark min-h-screen bg-background font-mono text-foreground">
      <div className="mx-auto max-w-5xl px-5 py-10 sm:px-8 sm:py-14">
        <VpnHeader />

        {notice && (
          <div className="mt-6 flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-xs leading-relaxed text-destructive">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>{notice}</span>
          </div>
        )}

        <div className="mt-8 grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div className="space-y-5">
            <ServiceStatus configured={status.configured} reachable={status.reachable} reason={status.reason} />

            <LocationList
              locations={locations}
              selectedId={selectedId}
              onSelect={setSelectedId}
              loading={loading}
            />

            <div className="rounded-xl border border-border bg-card p-5">
              <label htmlFor="profile-label" className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
                Device name
              </label>
              <input
                id="profile-label"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                maxLength={60}
                placeholder="This laptop"
                className="mt-3 w-full rounded-lg border border-border bg-background px-3 py-2.5 text-xs text-foreground outline-none transition placeholder:text-muted-foreground/60 focus:border-chart-1/60"
              />
              <button
                type="button"
                onClick={create}
                disabled={creating || !selectedId || serverDown}
                className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-chart-1/40 bg-chart-1/10 px-4 py-3 text-[11px] uppercase tracking-[0.18em] text-chart-1 transition hover:bg-chart-1/15 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {creating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                Create profile
              </button>
              {serverDown && (
                <p className="mt-2 text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                  Unavailable until the VPN control plane is connected
                </p>
              )}
            </div>
          </div>

          <div className="space-y-5">
            <ProfilePanel
              profiles={profiles}
              locationName={locationName}
              onRevoke={revoke}
              revokingId={revokingId}
            />
            <ImportGuide />
          </div>
        </div>
      </div>
    </div>
  );
}