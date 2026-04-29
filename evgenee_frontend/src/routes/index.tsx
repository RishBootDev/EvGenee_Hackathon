import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { useAuth } from "@/lib/auth";
import { StationsAPI, type Station } from "@/lib/api";
import { StationsMap } from "@/components/StationsMap";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import {
  Search, Zap, MapPin, Loader2, Navigation, Filter, LocateFixed,
  Star, Phone, ChevronRight, Plug, X
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import { formatCurrency, getApiError } from "@/lib/utils";
import { toast } from "sonner";
import { LandingPage } from "@/components/LandingPage";
import { Drawer } from "vaul";

export const Route = createFileRoute("/")(({
  component: HomePage,
}));

const DEFAULT_CENTER: [number, number] = [28.6139, 77.209];

function HomePage() {
  const { isAuthed, loading } = useAuth();
  const [center, setCenter] = useState<[number, number]>(() => {
    if (typeof window !== "undefined") {
      const saved = sessionStorage.getItem("mapCenter");
      if (saved) {
        try {
          return JSON.parse(saved) as [number, number];
        } catch (e) {
          // ignore parse error
        }
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
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [connector, setConnector] = useState<string>("");
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [locating, setLocating] = useState(false);
  const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  const locate = useCallback(() => {
    if (!navigator.geolocation) {
      toast.error("Geolocation is not supported by your browser.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords: [number, number] = [pos.coords.latitude, pos.coords.longitude];
        setUserLocation(coords);
        setCenter(coords); 
        if (typeof window !== "undefined") {
          sessionStorage.setItem("mapCenter", JSON.stringify(coords));
        }
        setLocating(false);
      },
      (error) => {
        let msg = "Couldn't get your location. Showing default area.";
        if (error.code === error.PERMISSION_DENIED) {
           msg = "Location permission denied. Please enable it in your browser settings.";
        } else if (error.code === error.POSITION_UNAVAILABLE) {
           msg = "Location information is unavailable.";
        } else if (error.code === error.TIMEOUT) {
           msg = "The request to get user location timed out.";
        }
        toast.error(msg);
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, []);

  useEffect(() => {
    if (isAuthed && typeof window !== "undefined" && !sessionStorage.getItem("mapCenter")) {
      locate();
    }
  }, [isAuthed, locate]);

  useEffect(() => {
    if (!isAuthed) return;
    let cancel = false;
    (async () => {
      setLoadingStations(true);
      try {
        const r = await StationsAPI.nearby({
          lat: center[0],
          lng: center[1],
          maxDistance: 50000,
          ...(connector ? { connectorType: connector } : {}),
        });
        if (!cancel) setStations(r.data?.data ?? []);
      } catch (e) {
        if (!cancel) toast.error(getApiError(e, "Failed to load nearby stations"));
      } finally {
        if (!cancel) setLoadingStations(false);
      }
    })();
    return () => { cancel = true; };
  }, [center, connector, isAuthed]);

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

  // When map pin is hovered → scroll corresponding card into view
  useEffect(() => {
    if (!hoveredId) return;
    const el = cardRefs.current.get(hoveredId);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [hoveredId]);

  const handleMapHover = useCallback((id: string | null) => {
    setHoveredId(id);
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
    <div className="fixed inset-0 top-0 bottom-0 flex overflow-hidden">
      {/* ── MAP SECTION ── */}
      <div className="flex-1 relative min-w-0 h-full">
        <div className="absolute inset-0 pb-16 sm:pb-20">
          <StationsMap
            center={center}
            stations={filtered}
            onSelect={(s) => setSelected(s)}
            selectedId={selected?._id}
            hoveredId={hoveredId}
            onHover={handleMapHover}
            onCenterChange={handleMapMove}
            userLocation={userLocation}
          />
        </div>

        {/* Locate button */}
        <button
          onClick={locate}
          className="absolute right-4 bottom-[40vh] z-[500] h-12 w-12 rounded-full bg-white shadow-[var(--shadow-elevated)] grid place-items-center hover:scale-105 transition"
        >
          {locating ? <Loader2 className="h-5 w-5 animate-spin text-primary" /> : <LocateFixed className="h-5 w-5 text-primary" />}
        </button>

        {/* Stations count chip */}
        <div className="absolute left-4 bottom-[40vh] z-[500] bg-white shadow-[var(--shadow-card)] rounded-full px-4 py-2 text-sm font-semibold flex items-center gap-2">
          <Zap className="h-4 w-4 text-primary" fill="currentColor" />
          {loadingStations ? "Searching…" : `${filtered.length} nearby`}
        </div>
      </div>

      {/* ── DESKTOP SIDEBAR ── */}
      <div className="hidden md:flex w-80 lg:w-96 flex-col bg-card border-l border-border shadow-[-4px_0_24px_rgba(0,0,0,0.08)] z-[600]">
        <div className="px-4 pt-4 pb-3 border-b border-border flex-shrink-0" style={{ paddingTop: "calc(var(--safe-top) + 1rem)" }}>
          <div className="bg-white rounded-full border border-border shadow-sm flex items-center gap-2 pl-4 pr-2 py-1.5 mb-4">
            <Search className="h-4 w-4 text-muted-foreground shrink-0" />
            <Input
              placeholder="Search stations..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="border-0 shadow-none focus-visible:ring-0 px-0 h-9 text-sm bg-transparent"
            />
          </div>
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-base">Nearby Stations</h2>
            <Zap className="h-4 w-4 text-primary" fill="currentColor" />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto py-2 px-2 space-y-2">
          {loadingStations ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Loading stations…</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 px-4">
              <Plug className="h-10 w-10 mx-auto opacity-20 mb-2" />
              <p className="font-semibold text-sm">No stations found</p>
            </div>
          ) : (
            filtered.map((s) => (
              <StationPanelCard
                key={s._id}
                station={s}
                isHovered={hoveredId === s._id}
                isSelected={selected?._id === s._id}
                onMouseEnter={() => setHoveredId(s._id)}
                onMouseLeave={() => setHoveredId(null)}
                onClick={() => setSelected(s)}
                cardRef={(el) => {
                  if (el) cardRefs.current.set(s._id, el);
                  else cardRefs.current.delete(s._id);
                }}
              />
            ))
          )}
        </div>
      </div>

      {/* ── MOBILE DRAWER (VAUL) ── */}
      <div className="md:hidden">
        <Drawer.Root 
          open={true} 
          dismissible={false} 
          modal={false} 
          snapPoints={["70px", "35vh", "85vh"]} 
          defaultSnapPoint="35vh"
        >
          <Drawer.Portal>
            <Drawer.Content className="bg-card flex flex-col rounded-t-[32px] h-full fixed bottom-0 left-0 right-0 z-[1000] border-t border-border shadow-[0_-8px_30px_rgba(0,0,0,0.08)] outline-none">
              <div className="mx-auto mt-3 h-1.5 w-12 rounded-full bg-muted flex-shrink-0" />
              
              {/* Search Header - Sticky */}
              <div className="px-4 pt-2 pb-4 space-y-3 flex-shrink-0 bg-card rounded-t-[32px]">
                <div className="bg-muted/50 rounded-2xl flex items-center gap-2 pl-4 pr-2 py-1.5 border border-border/50">
                  <Search className="h-4 w-4 text-muted-foreground shrink-0" />
                  <Input
                    placeholder="Search location or station"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="border-0 shadow-none focus-visible:ring-0 px-0 h-10 text-base bg-transparent"
                  />
                  {search && (
                    <button onClick={() => setSearch("")} className="p-2 text-muted-foreground">
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
                <div className="flex items-center justify-between px-1">
                   <h3 className="font-bold text-sm">Nearby Stations</h3>
                   <Badge variant="secondary" className="text-[10px] bg-primary/10 text-primary border-0">{filtered.length} found</Badge>
                </div>
              </div>

              {/* Scrollable List */}
              <div className="flex-1 overflow-y-auto px-4 pb-24 space-y-3">
                 {filtered.map((s) => (
                   <StationPanelCard
                     key={s._id}
                     station={s}
                     isHovered={hoveredId === s._id}
                     isSelected={selected?._id === s._id}
                     onMouseEnter={() => setHoveredId(s._id)}
                     onMouseLeave={() => setHoveredId(null)}
                     onClick={() => setSelected(s)}
                     cardRef={(el) => {
                       if (el) cardRefs.current.set(s._id, el);
                       else cardRefs.current.delete(s._id);
                     }}
                   />
                 ))}
                 {filtered.length === 0 && !loadingStations && (
                   <div className="text-center py-10 opacity-50">
                      <Plug className="h-8 w-8 mx-auto mb-2" />
                      <p className="text-sm">No stations match your search</p>
                   </div>
                 )}
              </div>
            </Drawer.Content>
          </Drawer.Portal>
        </Drawer.Root>
      </div>

      {/* Station detail sheet (click) */}
      <Sheet open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent side="bottom" className="rounded-t-3xl p-0 max-h-[90vh] z-[1200] border-0 outline-none">
          {selected && <StationDetailSheet station={selected} onClose={() => setSelected(null)} />}
        </SheetContent>
      </Sheet>
    </div>
  );
}

/* ─── Right-panel station card ─── */
function StationPanelCard({
  station,
  isHovered,
  isSelected,
  onMouseEnter,
  onMouseLeave,
  onClick,
  cardRef,
}: {
  station: Station;
  isHovered: boolean;
  isSelected: boolean;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  onClick: () => void;
  cardRef: (el: HTMLDivElement | null) => void;
}) {
  const avail = station.isOpen && station.availablePorts > 0;
  const minPrice = station.pricing?.length
    ? Math.min(...station.pricing.map((p) => p.priceperKWh))
    : 0;
  const currency = station.pricing?.[0]?.currency ?? "INR";
  const avgRating = station.reviews?.length
    ? (station.reviews.reduce((s, r) => s + r.rating, 0) / station.reviews.length).toFixed(1)
    : null;

  const isActive = isHovered || isSelected;

  return (
    <div
      ref={cardRef}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onClick={onClick}
      className={`group relative rounded-2xl p-3 cursor-pointer transition-all duration-200 border ${
        isSelected
          ? "border-primary bg-primary/5 shadow-[var(--shadow-glow)]"
          : isHovered
          ? "border-primary/50 bg-accent/60 shadow-[var(--shadow-card)]"
          : "border-border/50 bg-card hover:bg-accent/40 hover:border-primary/30 shadow-sm"
      }`}
    >
      <div className="flex items-start gap-3">
        {/* Icon / image */}
        <div className="relative shrink-0">
          <div className={`h-16 w-16 rounded-2xl overflow-hidden grid place-items-center transition-all duration-200 ${
            isActive
              ? "bg-[image:var(--gradient-primary)] shadow-[var(--shadow-glow)]"
              : "bg-muted"
          }`}>
            {station.Images?.[0] ? (
              <img src={station.Images[0]} alt={station.name} className="h-full w-full object-cover" />
            ) : (
              <Zap className={`h-7 w-7 ${isActive ? "text-white" : "text-primary"}`} fill={isActive ? "white" : "currentColor"} />
            )}
          </div>
          {/* Status dot */}
          <span className={`absolute -top-1 -right-1 h-5 w-5 rounded-full border-2 border-card ${
            avail ? "bg-emerald-500" : station.isOpen ? "bg-amber-400" : "bg-muted-foreground"
          }`} />
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0 pt-0.5">
          <div className="flex items-start justify-between gap-1">
            <p className="font-bold text-base leading-tight truncate">{station.name}</p>
            <ChevronRight className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 ${isActive ? "translate-x-0.5 text-primary" : ""}`} />
          </div>
          <p className="text-xs text-muted-foreground truncate mt-1 flex items-center gap-1">
            <MapPin className="h-3 w-3 shrink-0" />
            {station.address?.street}, {station.address?.city}
          </p>

          {/* Distance + Rating row */}
          <div className="flex items-center gap-3 mt-2 flex-wrap">
            {station.distanceKm !== undefined && (
              <span className="text-[11px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-lg">
                {station.distanceKm < 1
                  ? `${(station.distanceKm * 1000).toFixed(0)} m`
                  : `${station.distanceKm.toFixed(1)} km`}
              </span>
            )}
            {avgRating && (
              <span className="text-[11px] font-bold text-amber-600 flex items-center gap-1">
                <Star className="h-3 w-3 fill-current" />{avgRating}
              </span>
            )}
            <span className={`text-[11px] font-bold px-2 py-0.5 rounded-lg ${
              avail
                ? "text-emerald-700 bg-emerald-50"
                : station.isOpen
                ? "text-amber-700 bg-amber-50"
                : "text-muted-foreground bg-muted"
            }`}>
              {avail ? `${station.availablePorts} free` : station.isOpen ? "Full" : "Closed"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Bottom sheet detail (unchanged UX, shown on click) ─── */
function StationDetailSheet({ station, onClose }: { station: Station; onClose: () => void }) {
  const avail = station.isOpen && station.availablePorts > 0;
  const minPrice = station.pricing?.length
    ? Math.min(...station.pricing.map((p) => p.priceperKWh))
    : 0;
  const currency = station.pricing?.[0]?.currency ?? "INR";
  const currencySymbol = currency === "INR" ? "₹" : currency === "EUR" ? "€" : "$";
  const [lng, lat] = station.location.coordinates;
  const connectorLabel = station.typeOfConnectors[0] ?? "Type 2";
  const parkingFee = ((station.platformFee || 0) * minPrice / 100).toFixed(1);
  const avgRating = station.reviews?.length
    ? (station.reviews.reduce((s, r) => s + r.rating, 0) / station.reviews.length).toFixed(1)
    : null;

  const now = new Date();
  const later = new Date(now.getTime() + 60 * 60 * 1000);
  const fmt = (d: Date) => d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });

  return (
    <div className="overflow-y-auto max-h-[90vh]">
      <div className="mx-auto mt-3 h-1.5 w-12 rounded-full bg-muted" />
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-start gap-4">
          <div className="relative shrink-0">
            <div className="h-24 w-24 rounded-[24px] overflow-hidden bg-[image:var(--gradient-primary)] grid place-items-center shadow-[var(--shadow-glow)]">
              {station.Images?.[0] ? (
                <img src={station.Images[0]} alt={station.name} className="h-full w-full object-cover" />
              ) : (
                <Zap className="h-10 w-10 text-white" fill="white" />
              )}
            </div>
          </div>
          <div className="flex-1 min-w-0 pt-1">
            <div className="flex items-center gap-2 mb-1">
               <Badge className={avail ? "bg-emerald-500" : "bg-muted text-muted-foreground"}>
                 {avail ? "Available" : "Busy"}
               </Badge>
               {avgRating && (
                <div className="flex items-center gap-1 text-amber-500 font-bold text-sm">
                  <Star className="h-4 w-4 fill-current" />{avgRating}
                </div>
              )}
            </div>
            <h2 className="text-2xl font-black tracking-tight truncate leading-tight">{station.name}</h2>
            <p className="text-sm text-muted-foreground truncate flex items-center gap-1 mt-0.5">
              <MapPin className="h-3.5 w-3.5 shrink-0" />
              {station.address.street}, {station.address.city}
            </p>
          </div>
        </div>

        {/* Stats */}
        <div className="bg-muted/30 border-2 border-border/50 rounded-3xl p-4 grid grid-cols-3 gap-2">
          <PillStat top={connectorLabel} label="Connection" />
          <PillStat top={`${currencySymbol}${minPrice}`} label="Per kWh" />
          <PillStat top={`${currencySymbol}${parkingFee}`} label="Platform" />
        </div>

        {/* Arrive / Depart */}
        <div className="grid grid-cols-2 gap-4">
          <TimeBox label="Start Time" value={`${fmt(now)}`} />
          <TimeBox label="End Time" value={`${fmt(later)}`} />
        </div>

        {/* Actions */}
        <div className="space-y-3 pt-2">
          <Link to="/stations/$stationId" params={{ stationId: station._id }} onClick={onClose}>
            <Button
              className="w-full h-14 bg-[image:var(--gradient-primary)] hover:opacity-90 text-primary-foreground font-black text-lg rounded-2xl shadow-[var(--shadow-glow)]"
              disabled={!station.isOpen}
            >
              BOOK NOW
            </Button>
          </Link>
          <div className="grid grid-cols-2 gap-3">
             <Button
                variant="outline"
                className="h-12 rounded-xl font-bold"
                onClick={() => window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`, "_blank")}
              >
                <Navigation className="h-4 w-4 mr-2" /> Directions
              </Button>
              <Button variant="outline" className="h-12 rounded-xl font-bold" onClick={onClose}>
                Close
              </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function PillStat({ top, label }: { top: string; label: string }) {
  return (
    <div className="text-center px-1">
      <p className="text-base font-black text-primary truncate leading-tight">{top}</p>
      <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider mt-0.5">{label}</p>
    </div>
  );
}

function TimeBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-card border border-border rounded-2xl p-4 flex flex-col items-center">
      <p className="text-[11px] font-black text-muted-foreground uppercase tracking-widest">{label}</p>
      <p className="text-lg font-black text-foreground mt-1">{value}</p>
    </div>
  );
}
