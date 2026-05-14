import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/lib/auth";
import { RoadsideAPI, type SosRequest, type IssueType, type MechanicInfo, StationsAPI, type Station } from "@/lib/api";
import { toast } from "sonner";
import { getApiError } from "@/lib/utils";
import {
  AlertTriangle,
  MapPin,
  Phone,
  Clock,
  Star,
  ChevronRight,
  X,
  CheckCircle2,
  Loader2,
  Navigation,
  Wrench,
  Truck,
  History,
  RefreshCw,
} from "lucide-react";

export const Route = createFileRoute("/sos")({
  component: SosPage,
});

// ── Status config ─────────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  pending:           { label: "Pending",          color: "text-amber-400",   bg: "bg-amber-500/15 border-amber-500/20" },
  mechanic_assigned: { label: "Mechanic Assigned", color: "text-emerald-400", bg: "bg-emerald-500/15 border-emerald-500/20" },
  tow_dispatched:    { label: "Tow Dispatched",    color: "text-blue-400",    bg: "bg-blue-500/15 border-blue-500/20" },
  en_route:          { label: "En Route",          color: "text-cyan-400",    bg: "bg-cyan-500/15 border-cyan-500/20" },
  resolved:          { label: "Resolved",          color: "text-white/40",    bg: "bg-white/8 border-white/10" },
  cancelled:         { label: "Cancelled",         color: "text-red-400",     bg: "bg-red-500/15 border-red-500/20" },
};

// ── Spinner ───────────────────────────────────────────────────────────────────
function Spinner() {
  return <div className="h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin" />;
}

// ── Background decorations ────────────────────────────────────────────────────
function Bg() {
  return (
    <>
      <div className="fixed inset-0 z-0">
        <img src="/hero-bg.png" alt="" className="w-full h-full object-cover opacity-10" />
        <div className="absolute inset-0 bg-[#000814]/80 backdrop-blur-sm" />
      </div>
      <div className="fixed top-0 left-0 w-[500px] h-[500px] pointer-events-none z-0"
        style={{ background: "radial-gradient(ellipse at 0% 0%, rgba(239,68,68,0.12) 0%, transparent 70%)" }} />
      <div className="fixed bottom-0 right-0 w-[400px] h-[400px] pointer-events-none z-0"
        style={{ background: "radial-gradient(ellipse at 100% 100%, rgba(16,185,129,0.07) 0%, transparent 70%)" }} />
    </>
  );
}

// ── Mechanic Card ─────────────────────────────────────────────────────────────
function MechanicCard({ mechanic, isTow }: { mechanic: MechanicInfo; isTow: boolean }) {
  return (
    <div className="bg-white/[0.04] border border-white/8 rounded-3xl p-5 space-y-4">
      <div className="flex items-center gap-3">
        <div className={`h-12 w-12 rounded-2xl flex items-center justify-center ${isTow ? "bg-blue-500/20" : "bg-emerald-500/20"}`}>
          {isTow ? <Truck className="h-6 w-6 text-blue-400" /> : <Wrench className="h-6 w-6 text-emerald-400" />}
        </div>
        <div>
          <p className="font-bold text-white text-base">{mechanic.name}</p>
          <p className="text-xs text-white/40">{mechanic.garage}</p>
        </div>
        <div className="ml-auto flex items-center gap-1">
          <Star className="h-3.5 w-3.5 text-amber-400 fill-amber-400" />
          <span className="text-sm font-bold text-white">{mechanic.rating}</span>
        </div>
      </div>
      <p className="text-xs text-white/40 italic">{mechanic.speciality}</p>
      <div className="grid grid-cols-3 gap-3">
        {[
          { icon: <Clock className="h-4 w-4 text-amber-400" />, label: "ETA", val: mechanic.estimatedArrival },
          { icon: <MapPin className="h-4 w-4 text-blue-400" />, label: "Distance", val: mechanic.distance },
          { icon: <Phone className="h-4 w-4 text-emerald-400" />, label: "Phone", val: mechanic.phone },
        ].map((item) => (
          <div key={item.label} className="bg-white/5 rounded-2xl p-3 border border-white/5 text-center">
            <div className="flex justify-center mb-1">{item.icon}</div>
            <p className="text-[9px] text-white/30 uppercase tracking-widest font-bold">{item.label}</p>
            <p className="text-xs font-bold text-white/80 mt-0.5 truncate">{item.val}</p>
          </div>
        ))}
      </div>
      <a
        href={`tel:${mechanic.phone}`}
        className="flex items-center justify-center gap-2 w-full h-11 bg-emerald-500/20 border border-emerald-500/30 rounded-2xl text-emerald-400 font-bold text-sm hover:bg-emerald-500/30 transition-colors"
      >
        <Phone className="h-4 w-4" /> Call Mechanic
      </a>
    </div>
  );
}

// ── History Card ──────────────────────────────────────────────────────────────
function HistoryCard({ req, onCancel }: { req: SosRequest; onCancel: (id: string) => void }) {
  const s = STATUS_CONFIG[req.status] ?? STATUS_CONFIG.pending;
  const canCancel = req.status !== "resolved" && req.status !== "cancelled";
  return (
    <div className="bg-white/[0.03] border border-white/5 rounded-3xl p-5 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-bold text-white text-sm">{req.issueLabel}</p>
          <p className="text-xs text-white/30 mt-0.5">{req.address}</p>
        </div>
        <span className={`text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full border ${s.bg} ${s.color}`}>
          {s.label}
        </span>
      </div>
      {req.mechanic && (
        <div className="bg-white/5 rounded-2xl p-3 border border-white/5 flex items-center gap-3">
          <Wrench className="h-4 w-4 text-emerald-400/60 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-white/70 truncate">{req.mechanic.name}</p>
            <p className="text-[10px] text-white/30">{req.mechanic.phone}</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-white/30">ETA</p>
            <p className="text-xs font-bold text-amber-400">{req.mechanic.estimatedArrival}</p>
          </div>
        </div>
      )}
      <div className="flex items-center justify-between text-[10px] text-white/20">
        <span>{new Date(req.createdAt).toLocaleString()}</span>
        {canCancel && (
          <button
            onClick={() => onCancel(req.requestId)}
            className="text-red-400/60 hover:text-red-400 transition-colors font-bold uppercase tracking-widest"
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
function SosPage() {
  const { isAuthed, loading: authLoading, user } = useAuth();

  // Form state
  const [issueTypes, setIssueTypes] = useState<IssueType[]>([]);
  const [selectedIssue, setSelectedIssue] = useState<string>("");
  const [description, setDescription] = useState("");
  const [requestTow, setRequestTow] = useState(false);

  // Location state
  const [locating, setLocating] = useState(false);
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [address, setAddress] = useState("");

  // Preview mechanic
  const [previewMechanic, setPreviewMechanic] = useState<MechanicInfo | null>(null);
  const [nearbyStations, setNearbyStations] = useState<Station[]>([]);
  const [previewLoading, setPreviewLoading] = useState(false);

  // Submission state
  const [submitting, setSubmitting] = useState(false);
  const [activeSos, setActiveSos] = useState<SosRequest | null>(null);

  // History
  const [tab, setTab] = useState<"new" | "history">("new");
  const [history, setHistory] = useState<SosRequest[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Load issue types on mount
  useEffect(() => {
    RoadsideAPI.getIssueTypes().then((r) => setIssueTypes(r.data.data)).catch(() => {});
  }, []);

  // When issue = unknown, auto check tow
  useEffect(() => {
    if (selectedIssue === "unknown") setRequestTow(true);
    else setRequestTow(false);
  }, [selectedIssue]);

  // Fetch preview mechanic whenever location is set
  const fetchPreview = useCallback(async (latitude: number, longitude: number) => {
    setPreviewLoading(true);
    try {
      const [mechRes, stRes] = await Promise.allSettled([
        RoadsideAPI.getNearestMechanic({ lat: latitude, lng: longitude }),
        StationsAPI.nearby({ lat: latitude, lng: longitude, maxDistance: 50000 })
      ]);
      if (mechRes.status === "fulfilled") setPreviewMechanic(mechRes.value.data.data);
      if (stRes.status === "fulfilled") setNearbyStations(stRes.value.data.data.slice(0, 3));
    } catch {
      // silent
    } finally {
      setPreviewLoading(false);
    }
  }, []);

  const getLocation = () => {
    if (!navigator.geolocation) {
      toast.error("Geolocation is not supported by your browser");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        setLat(latitude);
        setLng(longitude);
        setAddress(`${latitude.toFixed(5)}, ${longitude.toFixed(5)}`);
        setLocating(false);
        fetchPreview(latitude, longitude);
      },
      (err) => {
        toast.error("Could not get location: " + err.message);
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const submitSos = async () => {
    if (!lat || !lng) { toast.error("Please share your location first"); return; }
    if (!selectedIssue) { toast.error("Please select the issue type"); return; }

    setSubmitting(true);
    try {
      const r = await RoadsideAPI.createSos({
        latitude: lat,
        longitude: lng,
        address: address || undefined,
        issueType: selectedIssue,
        description: description || undefined,
        requestTow,
      });
      setActiveSos(r.data.data);
      toast.success(r.data.message);
    } catch (e) {
      toast.error(getApiError(e, "Failed to dispatch help"));
    } finally {
      setSubmitting(false);
    }
  };

  const loadHistory = async () => {
    setHistoryLoading(true);
    try {
      const r = await RoadsideAPI.myRequests();
      setHistory(r.data.data);
    } catch {
      toast.error("Failed to load history");
    } finally {
      setHistoryLoading(false);
    }
  };

  const cancelRequest = async (requestId: string) => {
    try {
      await RoadsideAPI.cancel(requestId);
      toast.success("SOS request cancelled");
      loadHistory();
      if (activeSos?.requestId === requestId) setActiveSos(null);
    } catch (e) {
      toast.error(getApiError(e, "Cancel failed"));
    }
  };

  const resetForm = () => {
    setActiveSos(null);
    setSelectedIssue("");
    setDescription("");
    setRequestTow(false);
    setLat(null);
    setLng(null);
    setAddress("");
    setPreviewMechanic(null);
  };

  if (authLoading) {
    return (
      <div className="h-screen grid place-items-center bg-[#000814]">
        <div className="h-8 w-8 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  if (!isAuthed) return <Navigate to="/auth/login" />;

  return (
    <div className="min-h-screen bg-[#000814] text-white overflow-x-hidden" style={{ paddingBottom: "6rem", fontFamily: "'DM Sans', sans-serif" }}>
      <Bg />

      <div className="relative z-10 max-w-lg mx-auto px-5 pt-10">
        {/* Header */}
        <header className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="h-10 w-10 rounded-2xl bg-red-500/20 border border-red-500/20 flex items-center justify-center">
              <AlertTriangle className="h-5 w-5 text-red-400" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-white tracking-tight" style={{ fontFamily: "'Poppins', sans-serif" }}>
                Roadside SOS
              </h1>
              <p className="text-white/30 text-xs">Emergency mechanic dispatch</p>
            </div>
          </div>
        </header>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 bg-white/5 border border-white/8 rounded-2xl p-1.5">
          {(["new", "history"] as const).map((t) => (
            <button
              key={t}
              onClick={() => { setTab(t); if (t === "history") loadHistory(); }}
              className={`flex-1 py-2.5 rounded-xl text-xs font-bold uppercase tracking-widest transition-all ${
                tab === t ? "bg-red-500 text-white" : "text-white/30 hover:text-white/60"
              }`}
            >
              {t === "new" ? "New SOS" : "History"}
            </button>
          ))}
        </div>

        {/* ── NEW SOS TAB ─────────────────────────────── */}
        {tab === "new" && (
          <>
            {/* Active SOS result */}
            {activeSos ? (
              <div className="space-y-5">
                <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-3xl p-5">
                  <div className="flex items-center gap-3 mb-4">
                    <CheckCircle2 className="h-6 w-6 text-emerald-400" />
                    <div>
                      <p className="font-black text-emerald-400 text-base">Help Dispatched!</p>
                      <p className="text-xs text-white/40">{activeSos.issueLabel}</p>
                    </div>
                  </div>
                  <p className="text-xs text-white/40 mb-1">📍 {activeSos.address}</p>
                  <p className="text-[10px] text-white/20">ID: {activeSos.requestId}</p>
                </div>

                {activeSos.mechanic && (
                  <MechanicCard mechanic={activeSos.mechanic} isTow={activeSos.towRequested} />
                )}

                <div className="flex gap-3">
                  <button
                    onClick={resetForm}
                    className="flex-1 h-12 rounded-2xl bg-white/5 border border-white/10 text-white/60 font-bold text-sm hover:bg-white/10 transition-colors"
                  >
                    New SOS
                  </button>
                  <button
                    onClick={() => cancelRequest(activeSos.requestId)}
                    className="flex-1 h-12 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 font-bold text-sm hover:bg-red-500/20 transition-colors"
                  >
                    Cancel Request
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-5">
                {/* Location */}
                <div className="bg-white/[0.03] border border-white/8 rounded-3xl p-5">
                  <p className="text-xs font-bold text-white/40 uppercase tracking-widest mb-3">1. Your Location</p>
                  {lat && lng ? (
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-xl bg-emerald-500/20 flex items-center justify-center shrink-0">
                        <MapPin className="h-5 w-5 text-emerald-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-emerald-400">Location Acquired</p>
                        <p className="text-xs text-white/30 truncate">{lat.toFixed(5)}, {lng.toFixed(5)}</p>
                      </div>
                      <button onClick={getLocation} className="h-8 w-8 rounded-lg bg-white/5 flex items-center justify-center hover:bg-white/10 transition-colors">
                        <RefreshCw className="h-3.5 w-3.5 text-white/40" />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={getLocation}
                      disabled={locating}
                      className="w-full h-12 flex items-center justify-center gap-2 rounded-2xl bg-blue-500/15 border border-blue-500/20 text-blue-400 font-bold text-sm hover:bg-blue-500/25 transition-colors disabled:opacity-50"
                    >
                      {locating ? <Spinner /> : <Navigation className="h-4 w-4" />}
                      {locating ? "Getting Location…" : "Share My Location"}
                    </button>
                  )}
                </div>

                {/* Issue type */}
                <div className="bg-white/[0.03] border border-white/8 rounded-3xl p-5">
                  <p className="text-xs font-bold text-white/40 uppercase tracking-widest mb-3">2. What's the Problem?</p>
                  <div className="space-y-2">
                    {issueTypes.length === 0 ? (
                      <div className="py-4 flex justify-center"><Spinner /></div>
                    ) : (
                      issueTypes.map((issue) => {
                        const isSelected = selectedIssue === issue.value;
                        const isTow = issue.value === "unknown";
                        return (
                          <button
                            key={issue.value}
                            onClick={() => setSelectedIssue(issue.value)}
                            className={`w-full flex items-center justify-between px-4 py-3 rounded-2xl border transition-all text-left ${
                              isSelected
                                ? isTow
                                  ? "bg-blue-500/20 border-blue-500/40 text-blue-300"
                                  : "bg-red-500/20 border-red-500/40 text-red-300"
                                : "bg-white/[0.02] border-white/5 text-white/60 hover:bg-white/5 hover:border-white/10"
                            }`}
                          >
                            <span className="text-sm font-semibold">{issue.label}</span>
                            {isSelected && <CheckCircle2 className="h-4 w-4 shrink-0" />}
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* Description */}
                <div className="bg-white/[0.03] border border-white/8 rounded-3xl p-5">
                  <p className="text-xs font-bold text-white/40 uppercase tracking-widest mb-3">3. Additional Details (Optional)</p>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Describe what happened…"
                    rows={3}
                    className="w-full bg-white/5 border border-white/8 rounded-2xl px-4 py-3 text-sm text-white placeholder:text-white/20 resize-none focus:outline-none focus:border-red-500/40 transition-colors"
                  />
                </div>

                {/* Preview mechanic */}
                {previewLoading && (
                  <div className="flex items-center gap-3 py-3 px-4 bg-white/[0.02] border border-white/5 rounded-3xl">
                    <Spinner />
                    <p className="text-sm text-white/40">Finding nearest mechanic…</p>
                  </div>
                )}
                {previewMechanic && !previewLoading && (
                  <div>
                    <p className="text-xs font-bold text-white/30 uppercase tracking-widest mb-3 px-1">Nearest Mechanic Preview</p>
                    <MechanicCard mechanic={previewMechanic} isTow={selectedIssue === "unknown"} />
                  </div>
                )}

                {nearbyStations.length > 0 && !previewLoading && (
                  <div className="space-y-3">
                    <p className="text-xs font-bold text-white/30 uppercase tracking-widest px-1">Or Contact a Nearby Station</p>
                    <div className="flex overflow-x-auto pb-2 gap-3 snap-x hide-scrollbar">
                      {nearbyStations.map((st) => (
                        <div key={st._id} className="min-w-[280px] bg-white/[0.02] border border-white/8 rounded-3xl p-4 snap-center shrink-0">
                          <p className="font-bold text-sm truncate mb-1">{st.name}</p>
                          <p className="text-[10px] text-white/40 mb-3">{st.distanceKm} km away</p>
                          {st.mechanic && st.mechanic.name ? (
                            <div className="space-y-3">
                              <div className="flex items-center gap-2">
                                <div className="h-8 w-8 rounded-lg bg-white/5 flex items-center justify-center shrink-0">
                                  <Wrench className="h-4 w-4 text-emerald-400" />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <p className="text-xs font-bold text-white/80 truncate">{st.name}</p>
                                  <p className="text-[10px] text-white/40 truncate">{st.mechanic.speciality}</p>
                                </div>
                              </div>
                              <a href={`tel:${st.mechanic.phone}`} className="flex items-center justify-center gap-2 w-full h-10 bg-white/5 border border-white/10 rounded-xl text-white/80 font-bold text-xs hover:bg-white/10 transition-colors">
                                <Phone className="h-3.5 w-3.5" /> Call {st.mechanic.phone}
                              </a>
                            </div>
                          ) : (
                            <p className="text-[10px] text-white/30 italic">No mechanic available</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* SOS Button */}
                <button
                  onClick={submitSos}
                  disabled={submitting || !lat || !selectedIssue}
                  className="w-full h-16 rounded-3xl font-black text-lg tracking-tight flex items-center justify-center gap-3 transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{
                    background: submitting || !lat || !selectedIssue
                      ? "rgba(255,255,255,0.05)"
                      : "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)",
                    boxShadow: submitting || !lat || !selectedIssue
                      ? "none"
                      : "0 0 40px rgba(239,68,68,0.4), 0 10px 30px rgba(239,68,68,0.3)",
                  }}
                >
                  {submitting ? (
                    <><Spinner /> Dispatching Help…</>
                  ) : (
                    <><AlertTriangle className="h-6 w-6" /> SOS — Send Help Now</>
                  )}
                </button>

                <p className="text-center text-[10px] text-white/20 px-4">
                  Tapping SOS will immediately dispatch a mechanic and send a confirmation email to {user?.email}
                </p>
              </div>
            )}
          </>
        )}

        {/* ── HISTORY TAB ─────────────────────────────── */}
        {tab === "history" && (
          <div className="space-y-4">
            {historyLoading ? (
              <div className="py-20 flex justify-center">
                <div className="h-8 w-8 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : history.length === 0 ? (
              <div className="text-center py-20 border-2 border-dashed border-white/5 rounded-[2rem]">
                <History className="h-10 w-10 text-white/5 mx-auto mb-3" />
                <p className="text-white/20 text-sm font-bold uppercase tracking-widest">No SOS requests yet</p>
              </div>
            ) : (
              history.map((req) => (
                <HistoryCard key={req.requestId} req={req} onCancel={cancelRequest} />
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
