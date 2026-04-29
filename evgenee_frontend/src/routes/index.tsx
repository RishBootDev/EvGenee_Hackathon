import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { useAuth } from "@/lib/auth";
import { StationsAPI, type Station } from "@/lib/api";
import { StationsMap } from "@/components/StationsMap";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Search, Zap, Loader2, LocateFixed, Plug, X, ChevronRight, MapPin,
} from "lucide-react";
import { getApiError } from "@/lib/utils";
import { toast } from "sonner";
import { LandingPage } from "@/components/LandingPage";
import { Drawer } from "vaul";

export const Route = createFileRoute("/")({
  component: HomePage,
});

const DEFAULT_CENTER: [number, number] = [28.6139, 77.209];

function HomePage() {
  const { isAuthed, loading } = useAuth();
  const [center, setCenter] = useState<[number, number]>(() => {
    if (typeof window !== "undefined") {
      const saved = sessionStorage.getItem("mapCenter");
      if (saved) {
        try { return JSON.parse(saved) as [number, number]; } catch {}
      }
    }
    return DEFAULT_CENTER;
  });

  const handleMapMove = useCallback((newCenter: [number, number]) => {
    setCenter(newCenter);
    if (typeof window !== "undefined") {
      sessionStorage.setItem("mapCenter", JSON.stringify(newCenter));
    }
  }, []);

  const [stations, setStations] = useState<Station[]>([]);
  const [loadingStations, setLoadingStations] = useState(false);
  const [selected, setSelected] = useState<Station | null>(null);
  const [search, setSearch] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [locating, setLocating] = useState(false);
  const [activeSnapPoint, setActiveSnapPoint] = useState<string | number | null>("35vh");
  const searchRef = useRef<HTMLDivElement>(null);

  const locate = useCallback(() => {
    if (!navigator.geolocation) { toast.error("Geolocation not supported."); return; }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords: [number, number] = [pos.coords.latitude, pos.coords.longitude];
        setUserLocation(coords);
        setCenter(coords);
        if (typeof window !== "undefined") sessionStorage.setItem("mapCenter", JSON.stringify(coords));
        setLocating(false);
      },
      (err) => {
        let msg = "Couldn't get your location.";
        if (err.code === err.PERMISSION_DENIED) msg = "Location permission denied.";
        toast.error(msg);
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, []);

  useEffect(() => {
    if (isAuthed && typeof window !== "undefined" && !sessionStorage.getItem("mapCenter")) locate();
  }, [isAuthed, locate]);

  useEffect(() => {
    if (!isAuthed) return;
    let cancel = false;
    (async () => {
      setLoadingStations(true);
      try {
        const r = await StationsAPI.nearby({ lat: center[0], lng: center[1], maxDistance: 50000 });
        if (!cancel) setStations(r.data?.data ?? []);
      } catch (e) {
        if (!cancel) toast.error(getApiError(e, "Failed to load nearby stations"));
      } finally {
        if (!cancel) setLoadingStations(false);
      }
    })();
    return () => { cancel = true; };
  }, [center, isAuthed]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return stations;
    return stations.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.address?.city?.toLowerCase().includes(q) ||
        s.address?.street?.toLowerCase().includes(q)
    );
  }, [stations, search]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  if (loading) {
    return (
      <div className="h-screen grid place-items-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  if (!isAuthed) return <LandingPage />;

  return (
    <div className="fixed inset-0 flex overflow-hidden">
      {/* ── FULL-SCREEN MAP ── */}
      <div className="flex-1 relative min-w-0 h-full">
        <div className="absolute inset-0">
          <StationsMap
            center={center}
            stations={filtered}
            onSelect={(s) => { setSelected(s); setShowDropdown(false); }}
            selectedId={selected?._id}
            onCenterChange={handleMapMove}
            userLocation={userLocation}
          />
        </div>

        {/* ── FLOATING SEARCH BAR ── */}
        <div
          ref={searchRef}
          className="absolute top-0 left-0 right-0 z-[600] px-3 sm:px-4"
          style={{ paddingTop: "calc(var(--safe-top) + 0.75rem)" }}
        >
          {/* Input pill */}
          <div className="max-w-lg mx-auto">
            <div className="bg-white/95 backdrop-blur-lg rounded-2xl border border-white/60 shadow-[0_8px_32px_rgba(0,0,0,0.18)] flex items-center gap-2 pl-4 pr-2 py-2.5 transition-all duration-200">
              <Search className="h-4 w-4 text-muted-foreground shrink-0" />
              <Input
                placeholder="Search charging stations…"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setShowDropdown(true); }}
                onFocus={() => { setShowDropdown(true); setActiveSnapPoint("70px"); }}
                onBlur={() => setActiveSnapPoint("35vh")}
                className="border-0 shadow-none focus-visible:ring-0 px-0 h-9 text-sm bg-transparent"
              />
              {search && (
                <button
                  onClick={() => { setSearch(""); setShowDropdown(false); }}
                  className="p-1.5 rounded-xl text-muted-foreground hover:bg-muted transition"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
              {loadingStations && <Loader2 className="h-4 w-4 animate-spin text-primary shrink-0" />}
            </div>

            {/* ── SEARCH DROPDOWN ── */}
            {showDropdown && search.trim() && (
              <div className="mt-2 bg-white/98 backdrop-blur-xl rounded-2xl border border-white/60 shadow-[0_16px_48px_rgba(0,0,0,0.18)] overflow-hidden max-h-80 overflow-y-auto">
                {filtered.length === 0 ? (
                  <div className="flex flex-col items-center py-8 gap-2 text-muted-foreground">
                    <Plug className="h-8 w-8 opacity-30" />
                    <p className="text-sm font-medium">No stations found</p>
                  </div>
                ) : (
                  filtered.slice(0, 8).map((s) => {
                    const avail = s.isOpen && s.availablePorts > 0;
                    return (
                      <button
                        key={s._id}
                        className="w-full px-4 py-3 flex items-center gap-3 hover:bg-primary/5 active:bg-primary/10 transition text-left border-b border-border/40 last:border-0"
                        onMouseDown={() => {
                          setSelected(s);
                          setSearch(s.name);
                          setShowDropdown(false);
                        }}
                      >
                        <div className={`h-9 w-9 rounded-xl grid place-items-center shrink-0 ${avail ? "bg-emerald-50" : "bg-muted"}`}>
                          <Zap className={`h-4 w-4 ${avail ? "text-emerald-600" : "text-muted-foreground"}`} fill="currentColor" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm truncate">{s.name}</p>
                          <p className="text-xs text-muted-foreground truncate flex items-center gap-1 mt-0.5">
                            <MapPin className="h-3 w-3 shrink-0" />
                            {s.address?.street}, {s.address?.city}
                          </p>
                        </div>
                        <div className="flex flex-col items-end gap-1 shrink-0">
                          {s.distanceKm !== undefined && (
                            <span className="text-[11px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-lg">
                              {s.distanceKm < 1 ? `${(s.distanceKm * 1000).toFixed(0)}m` : `${s.distanceKm.toFixed(1)}km`}
                            </span>
                          )}
                          <span className={`text-[10px] font-semibold ${avail ? "text-emerald-600" : "text-muted-foreground"}`}>
                            {avail ? `${s.availablePorts} free` : s.isOpen ? "Full" : "Closed"}
                          </span>
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                      </button>
                    );
                  })
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── LOCATE BUTTON ── */}
        <button
          onClick={locate}
          className="absolute right-4 bottom-[38vh] md:bottom-8 z-[500] h-12 w-12 rounded-full bg-white shadow-[0_4px_20px_rgba(0,0,0,0.15)] grid place-items-center hover:scale-105 active:scale-95 transition-all duration-200"
        >
          {locating
            ? <Loader2 className="h-5 w-5 animate-spin text-primary" />
            : <LocateFixed className="h-5 w-5 text-primary" />}
        </button>

        {/* ── STATIONS COUNT CHIP ── */}
        <div className="absolute left-4 bottom-[38vh] md:bottom-8 z-[500] bg-white/95 backdrop-blur-sm shadow-[0_4px_20px_rgba(0,0,0,0.12)] rounded-full px-4 py-2.5 text-sm font-bold flex items-center gap-2">
          <Zap className="h-4 w-4 text-primary" fill="currentColor" />
          {loadingStations ? "Searching…" : `${filtered.length} nearby`}
        </div>
      </div>

      {/* ── MOBILE BOTTOM DRAWER ── */}
      <div className="md:hidden">
        <Drawer.Root
          open={true}
          dismissible={false}
          modal={false}
          snapPoints={["70px", "35vh", "80vh"]}
          activeSnapPoint={activeSnapPoint}
          setActiveSnapPoint={setActiveSnapPoint}
        >
          <Drawer.Portal>
            <Drawer.Content className="bg-card flex flex-col rounded-t-[28px] h-full fixed bottom-0 left-0 right-0 z-[500] border-t border-border/60 shadow-[0_-8px_40px_rgba(0,0,0,0.1)] outline-none">

              {/* Drag handle */}
              <div className="mx-auto mt-3 h-1 w-10 rounded-full bg-muted flex-shrink-0" />

              {/* Title row */}
              <div className="px-4 pt-2 pb-3 flex-shrink-0 flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-sm text-foreground">Nearby Stations</h3>
                  <p className="text-[11px] text-muted-foreground mt-0.5">Pull up to browse</p>
                </div>
                <Badge variant="secondary" className="text-[10px] bg-primary/10 text-primary border-0 font-bold">
                  {filtered.length} found
                </Badge>
              </div>

              {/* Station list */}
              <div className="flex-1 overflow-y-auto px-3 pb-24 space-y-2">
                {loadingStations ? (
                  <div className="flex flex-col items-center py-10 gap-3">
                    <Loader2 className="h-7 w-7 animate-spin text-primary" />
                    <p className="text-sm text-muted-foreground">Finding stations…</p>
                  </div>
                ) : filtered.length === 0 ? (
                  <div className="text-center py-10 opacity-50">
                    <Plug className="h-8 w-8 mx-auto mb-2" />
                    <p className="text-sm font-medium">No stations found</p>
                  </div>
                ) : (
                  filtered.map((s) => <MobileStationCard key={s._id} station={s} onSelect={(st) => { setSelected(st); setActiveSnapPoint("70px"); }} />)
                )}
              </div>
            </Drawer.Content>
          </Drawer.Portal>
        </Drawer.Root>
      </div>
    </div>
  );
}

/* ─── Mobile Station Card (in bottom drawer) ─── */
function MobileStationCard({ station, onSelect }: { station: Station; onSelect: (s: Station) => void }) {
  const avail = station.isOpen && station.availablePorts > 0;
  const minPrice = station.pricing?.length
    ? Math.min(...station.pricing.map((p) => p.priceperKWh))
    : 0;
  const currency = station.pricing?.[0]?.currency ?? "INR";
  const sym = currency === "INR" ? "₹" : "$";
  const avgRating = station.reviews?.length
    ? (station.reviews.reduce((s, r) => s + r.rating, 0) / station.reviews.length).toFixed(1)
    : null;

  return (
    <button
      onClick={() => onSelect(station)}
      className="w-full text-left bg-card border border-border/50 rounded-2xl p-3 flex items-center gap-3 hover:border-primary/40 hover:bg-accent/30 active:scale-[0.98] transition-all duration-150 shadow-sm"
    >
      {/* Icon */}
      <div className={`h-14 w-14 rounded-2xl grid place-items-center shrink-0 relative ${avail ? "bg-primary/10" : "bg-muted"}`}>
        {station.Images?.[0] ? (
          <img src={station.Images[0]} alt={station.name} className="h-full w-full object-cover rounded-2xl" />
        ) : (
          <Zap className={`h-6 w-6 ${avail ? "text-primary" : "text-muted-foreground"}`} fill="currentColor" />
        )}
        <span className={`absolute -top-1 -right-1 h-4 w-4 rounded-full border-2 border-card ${avail ? "bg-emerald-500" : station.isOpen ? "bg-amber-400" : "bg-slate-400"}`} />
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="font-bold text-sm truncate">{station.name}</p>
        <p className="text-xs text-muted-foreground truncate mt-0.5 flex items-center gap-1">
          <MapPin className="h-3 w-3 shrink-0" />
          {station.address?.street}, {station.address?.city}
        </p>
        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
          <span className="text-[11px] font-bold text-primary">{sym}{minPrice}/kWh</span>
          {avgRating && (
            <span className="text-[11px] text-amber-600 font-bold">★ {avgRating}</span>
          )}
          <span className={`text-[11px] font-bold ${avail ? "text-emerald-600" : "text-muted-foreground"}`}>
            {avail ? `${station.availablePorts} free` : station.isOpen ? "Full" : "Closed"}
          </span>
          {station.distanceKm !== undefined && (
            <span className="text-[11px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded-md">
              {station.distanceKm < 1 ? `${(station.distanceKm * 1000).toFixed(0)}m` : `${station.distanceKm.toFixed(1)}km`}
            </span>
          )}
        </div>
      </div>

      <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
    </button>
  );
}
