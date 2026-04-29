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
  Star, Phone, ChevronRight, Plug,
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import { formatCurrency, getApiError } from "@/lib/utils";
import { toast } from "sonner";
import { LandingPage } from "@/components/LandingPage";

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
        const newCenter: [number, number] = [pos.coords.latitude, pos.coords.longitude];
        setCenter(newCenter);
        setUserLocation(newCenter);
        if (typeof window !== "undefined") {
          sessionStorage.setItem("mapCenter", JSON.stringify(newCenter));
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
    <div className="fixed inset-0 top-0 bottom-16 sm:bottom-20 flex">
      {/* ── MAP SECTION ── */}
      <div className="flex-1 relative min-w-0">
        <div className="absolute inset-0">
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

        {/* Top search bar */}
        <div
          className="absolute top-0 inset-x-0 z-[500] px-4 pt-3 pointer-events-none"
          style={{ paddingTop: "calc(var(--safe-top) + 0.75rem)" }}
        >
          <div className="max-w-md mx-auto pointer-events-auto">
            <div className="bg-white rounded-full shadow-[var(--shadow-elevated)] flex items-center gap-2 pl-4 pr-2 py-1.5">
              <Search className="h-4 w-4 text-muted-foreground shrink-0" />
              <Input
                placeholder="Search location or station"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="border-0 shadow-none focus-visible:ring-0 px-0 h-9 text-sm bg-transparent"
              />
              <button
                onClick={() => setConnector(connector ? "" : "Type2")}
                title="Filter"
                className={`shrink-0 h-9 w-9 rounded-full grid place-items-center transition ${
                  connector ? "bg-primary text-white" : "text-muted-foreground hover:bg-muted"
                }`}
              >
                <Filter className="h-4 w-4" />
              </button>
            </div>
            {connector && (
              <div className="mt-2 flex gap-2 flex-wrap justify-center">
                {["CCS2", "CHAdeMO", "Type2", "Type1", "Tesla"].map((c) => (
                  <button
                    key={c}
                    onClick={() => setConnector(c === connector ? "" : c)}
                    className={`text-xs px-3 py-1.5 rounded-full font-medium transition shadow-sm ${
                      connector === c
                        ? "bg-primary text-primary-foreground"
                        : "bg-white text-foreground border border-border"
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Locate button */}
        <button
          onClick={locate}
          className="absolute right-4 bottom-24 z-[500] h-12 w-12 rounded-full bg-white shadow-[var(--shadow-elevated)] grid place-items-center hover:scale-105 transition"
        >
          {locating ? <Loader2 className="h-5 w-5 animate-spin text-primary" /> : <LocateFixed className="h-5 w-5 text-primary" />}
        </button>

        {/* Stations count chip */}
        <div className="absolute left-4 bottom-24 z-[500] bg-white shadow-[var(--shadow-card)] rounded-full px-4 py-2 text-sm font-semibold flex items-center gap-2">
          <Zap className="h-4 w-4 text-primary" fill="currentColor" />
          {loadingStations ? "Searching…" : `${filtered.length} nearby`}
        </div>
      </div>

      {/* ── MOBILE DRAWER TRIGGER ── Shown only on small screens */}
      <div className="md:hidden fixed bottom-20 left-1/2 -translate-x-1/2 z-[500] w-full px-4 max-w-sm pointer-events-none">
        <Button
          onClick={() => setSelected(null)} // This could trigger a separate list sheet
          className="w-full h-12 bg-card/95 backdrop-blur-md text-foreground border border-border rounded-full shadow-[var(--shadow-elevated)] pointer-events-auto flex items-center justify-center gap-2 font-bold"
        >
          <Filter className="h-4 w-4" />
          View Station List
        </Button>
      </div>

      {/* ── RIGHT PANEL / MOBILE LIST ── Google Maps-style station sidebar/drawer */}
      <div className="hidden md:flex w-80 lg:w-96 flex-col bg-card/95 backdrop-blur-sm border-l border-border shadow-[-4px_0_24px_rgba(0,0,0,0.08)] z-[600]">
        {/* Panel header */}
        <div className="px-4 pt-4 pb-3 border-b border-border flex-shrink-0" style={{ paddingTop: "calc(var(--safe-top) + 1rem)" }}>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-bold text-base text-foreground">Nearby Stations</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                {loadingStations ? (
                  <span className="flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" /> Finding stations…</span>
                ) : (
                  `${filtered.length} charging station${filtered.length !== 1 ? "s" : ""} found`
                )}
              </p>
            </div>
            <div className="h-9 w-9 rounded-xl bg-[image:var(--gradient-primary)] grid place-items-center shadow-[var(--shadow-glow)]">
              <Zap className="h-4 w-4 text-white" fill="white" />
            </div>
          </div>
        </div>

        {/* Station cards list */}
        <div className="flex-1 overflow-y-auto py-2 px-2 space-y-2">
          {loadingStations ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm">Loading stations…</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground py-12">
              <div className="h-16 w-16 rounded-2xl bg-muted grid place-items-center">
                <Plug className="h-7 w-7 opacity-40" />
              </div>
              <p className="font-semibold text-sm">No stations found</p>
              <p className="text-xs text-center max-w-[200px]">Try zooming out or removing filters to see more stations.</p>
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

      {/* Station detail sheet (click) */}
      <Sheet open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent side="bottom" className="rounded-t-3xl p-0 max-h-[85vh] z-[1100] border-0 outline-none">
          {selected && <StationDetailSheet station={selected} onClose={() => setSelected(null)} />}
        </SheetContent>
      </Sheet>

      {/* Mobile Station List Sheet (can be triggered by the button) */}
      <Sheet open={!selected && stations.length > 0} modal={false}>
        <SheetContent
          side="bottom"
          className="md:hidden rounded-t-3xl p-0 h-[35vh] sm:h-[40vh] z-[400] border-t border-border shadow-[0_-8px_30px_rgba(0,0,0,0.08)] outline-none overflow-hidden flex flex-col pointer-events-auto"
        >
          <div className="mx-auto mt-3 h-1.5 w-12 rounded-full bg-muted flex-shrink-0" />
          <div className="px-4 py-3 flex items-center justify-between border-b border-border/50">
             <h3 className="font-bold text-sm">Nearby Stations</h3>
             <Badge variant="secondary" className="text-[10px]">{filtered.length} found</Badge>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-2">
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
          </div>
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
      className={`group relative rounded-2xl p-3 cursor-pointer transition-all duration-200 border-2 ${
        isSelected
          ? "border-primary bg-primary/5 shadow-[var(--shadow-glow)]"
          : isHovered
          ? "border-primary/50 bg-accent/60 shadow-[var(--shadow-card)]"
          : "border-transparent bg-card hover:bg-accent/40 hover:border-primary/30 shadow-[var(--shadow-card)]"
      }`}
    >
      <div className="flex items-start gap-3">
        {/* Icon / image */}
        <div className="relative shrink-0">
          <div className={`h-14 w-14 rounded-xl overflow-hidden grid place-items-center transition-all duration-200 ${
            isActive
              ? "bg-[image:var(--gradient-primary)] shadow-[var(--shadow-glow)]"
              : "bg-[image:var(--gradient-primary)] opacity-85"
          }`}>
            {station.Images?.[0] ? (
              <img src={station.Images[0]} alt={station.name} className="h-full w-full object-cover" />
            ) : (
              <Zap className="h-6 w-6 text-white" fill="white" />
            )}
          </div>
          {/* Status dot */}
          <span className={`absolute -top-1 -right-1 h-4 w-4 rounded-full border-2 border-card text-[8px] font-bold flex items-center justify-center ${
            avail ? "bg-emerald-500" : station.isOpen ? "bg-amber-400" : "bg-muted-foreground"
          }`} />
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-1">
            <p className="font-bold text-sm leading-tight truncate">{station.name}</p>
            <ChevronRight className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 ${isActive ? "translate-x-0.5 text-primary" : ""}`} />
          </div>
          <p className="text-xs text-muted-foreground truncate mt-0.5 flex items-center gap-0.5">
            <MapPin className="h-2.5 w-2.5 shrink-0" />
            {station.address?.street}, {station.address?.city}
          </p>

          {/* Distance + Rating row */}
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            {station.distanceKm !== undefined && (
              <span className="text-[10px] font-semibold text-primary bg-primary/10 px-1.5 py-0.5 rounded-full">
                {station.distanceKm < 1
                  ? `${(station.distanceKm * 1000).toFixed(0)} m`
                  : `${station.distanceKm.toFixed(1)} km`}
              </span>
            )}
            {avgRating && (
              <span className="text-[10px] font-semibold text-amber-600 flex items-center gap-0.5">
                <Star className="h-2.5 w-2.5 fill-current" />{avgRating}
              </span>
            )}
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
              avail
                ? "text-emerald-700 bg-emerald-50"
                : station.isOpen
                ? "text-amber-700 bg-amber-50"
                : "text-muted-foreground bg-muted"
            }`}>
              {avail ? `${station.availablePorts} free` : station.isOpen ? "Full" : "Closed"}
            </span>
          </div>

          {/* Bottom row: connectors + price */}
          <div className="flex items-center justify-between mt-2">
            <div className="flex gap-1 flex-wrap">
              {station.typeOfConnectors.slice(0, 2).map((c) => (
                <span key={c} className="text-[9px] font-bold bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full">
                  {c}
                </span>
              ))}
              {station.typeOfConnectors.length > 2 && (
                <span className="text-[9px] font-bold bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full">
                  +{station.typeOfConnectors.length - 2}
                </span>
              )}
            </div>
            <span className="text-xs font-bold text-primary">
              {formatCurrency(minPrice, currency)}<span className="font-normal text-muted-foreground text-[9px]">/kWh</span>
            </span>
          </div>
        </div>
      </div>

      {/* Book button - shown on hover/select */}
      <div className={`overflow-hidden transition-all duration-200 ${isActive ? "max-h-12 mt-2.5 opacity-100" : "max-h-0 opacity-0"}`}>
        <Link
          to="/stations/$stationId"
          params={{ stationId: station._id }}
          onClick={(e) => e.stopPropagation()}
        >
          <Button
            size="sm"
            disabled={!avail}
            className="w-full h-8 bg-[image:var(--gradient-primary)] text-primary-foreground font-semibold text-xs rounded-xl shadow-[var(--shadow-glow)] hover:opacity-90"
          >
            <Zap className="h-3.5 w-3.5 mr-1" fill="white" />
            {avail ? "Book Charger" : "Unavailable"}
          </Button>
        </Link>
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
    <div className="overflow-y-auto max-h-[85vh]">
      <div className="mx-auto mt-3 h-1.5 w-12 rounded-full bg-muted" />
      <div className="p-5 space-y-5">
        {/* Header */}
        <div className="flex items-start gap-3">
          <div className="relative shrink-0">
            <div className="h-20 w-20 rounded-2xl overflow-hidden bg-[image:var(--gradient-primary)] grid place-items-center shadow-[var(--shadow-glow)]">
              {station.Images?.[0] ? (
                <img src={station.Images[0]} alt={station.name} className="h-full w-full object-cover" />
              ) : (
                <Zap className="h-9 w-9 text-white" fill="white" />
              )}
            </div>
            <div
              className={`absolute -bottom-1.5 left-1/2 -translate-x-1/2 text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap ${
                avail ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
              }`}
            >
              {avail ? "Available" : station.isOpen ? "Full" : "Closed"}
            </div>
          </div>
          <div className="flex-1 min-w-0 pt-1">
            <h2 className="text-xl font-bold truncate">{station.name}</h2>
            <p className="text-sm text-muted-foreground truncate">
              {station.address.street}, {station.address.city}
            </p>
            <div className="flex items-center gap-3 mt-1.5">
              <p className="text-xs text-primary font-semibold flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {station.distanceKm ? `${(station.distanceKm * 1000).toFixed(0)} m` : "Nearby"}
              </p>
              {avgRating && (
                <p className="text-xs text-amber-600 font-semibold flex items-center gap-1">
                  <Star className="h-3 w-3 fill-current" />{avgRating} ({station.reviews.length})
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="border-2 border-destructive/60 rounded-2xl p-3 grid grid-cols-3 gap-1 divide-x divide-destructive/30">
          <PillStat top={connectorLabel} label="Connection" />
          <PillStat top={`${currencySymbol}${minPrice}`} label="Per kWh" />
          <PillStat top={`${currencySymbol}${parkingFee}`} label="Platform Fee" />
        </div>

        {/* Arrive / Depart */}
        <div className="grid grid-cols-2 gap-3">
          <TimeBox label="Arrive" value={`Today ${fmt(now)}`} />
          <TimeBox label="Depart" value={`Today ${fmt(later)}`} />
        </div>

        {station.amenities?.length > 0 && (
          <div className="flex gap-2 flex-wrap">
            {station.amenities.slice(0, 4).map((a) => (
              <span key={a} className="text-[11px] bg-accent text-accent-foreground px-2.5 py-1 rounded-full font-medium">
                {a}
              </span>
            ))}
          </div>
        )}

        {/* Actions */}
        <div className="space-y-2">
          <Link to="/stations/$stationId" params={{ stationId: station._id }} onClick={onClose}>
            <Button
              className="w-full h-13 py-4 bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-base tracking-wider rounded-full shadow-[var(--shadow-glow)]"
              disabled={!avail}
            >
              BOOK CHARGER
            </Button>
          </Link>
          <Button
            variant="ghost"
            className="w-full text-muted-foreground"
            onClick={() => window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`, "_blank")}
          >
            <Navigation className="h-4 w-4 mr-1" /> Get Directions
          </Button>
        </div>
      </div>
    </div>
  );
}

function PillStat({ top, label }: { top: string; label: string }) {
  return (
    <div className="text-center px-1">
      <p className="text-sm font-bold text-destructive truncate">{top}</p>
      <p className="text-[10px] text-muted-foreground font-medium mt-0.5">{label}</p>
    </div>
  );
}

function TimeBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-border rounded-xl px-3 py-2.5">
      <p className="text-[11px] font-bold text-foreground">{label}</p>
      <p className="text-xs text-muted-foreground mt-0.5">{value}</p>
    </div>
  );
}
