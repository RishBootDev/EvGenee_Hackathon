import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState, useCallback } from "react";
import { useAuth } from "@/lib/auth";
import { StationsAPI, type Station } from "@/lib/api";
import { StationsMap } from "@/components/StationsMap";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Search, Zap, MapPin, Loader2, Navigation, Filter, LocateFixed } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { formatCurrency, getApiError } from "@/lib/utils";
import { toast } from "sonner";
import { LandingPage } from "@/components/LandingPage";
export const Route = createFileRoute("/")({
  component: HomePage,
});

const DEFAULT_CENTER: [number, number] = [28.6139, 77.209]; // New Delhi fallback

function HomePage() {
  const { isAuthed, loading } = useAuth();
  const [center, setCenter] = useState<[number, number]>(DEFAULT_CENTER);
  const [stations, setStations] = useState<Station[]>([]);
  const [loadingStations, setLoadingStations] = useState(false);
  const [selected, setSelected] = useState<Station | null>(null);
  const [search, setSearch] = useState("");
  const [connector, setConnector] = useState<string>("");
  const [locating, setLocating] = useState(false);

  const locate = useCallback(() => {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCenter([pos.coords.latitude, pos.coords.longitude]);
        setLocating(false);
      },
      () => {
        toast.error("Couldn't get your location. Showing default area.");
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, []);

  useEffect(() => {
    if (isAuthed) locate();
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

  if (loading) {
    return (
      <div className="h-screen grid place-items-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  if (!isAuthed) return <LandingPage />;

  return (
    <div className="fixed inset-0 top-0 bottom-16 sm:bottom-20">
      <div className="absolute inset-0">
        <StationsMap
          center={center}
          stations={filtered}
          onSelect={(s) => setSelected(s)}
          selectedId={selected?._id}
        />
      </div>

      {/* Top search bar - pill style matching reference */}
      <div
        className="absolute top-0 inset-x-0 z-[500] px-4 pt-3 pointer-events-none"
        style={{ paddingTop: "calc(var(--safe-top) + 0.75rem)" }}
      >
        <div className="max-w-md mx-auto pointer-events-auto">
          <div className="bg-white rounded-full shadow-[var(--shadow-elevated)] flex items-center gap-2 pl-4 pr-2 py-1.5">
            <Search className="h-4 w-4 text-muted-foreground shrink-0" />
            <Input
              placeholder="Search location"
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
        className="absolute right-4 bottom-32 z-[500] h-12 w-12 rounded-full bg-white shadow-[var(--shadow-elevated)] grid place-items-center hover:scale-105 transition"
      >
        {locating ? <Loader2 className="h-5 w-5 animate-spin text-primary" /> : <LocateFixed className="h-5 w-5 text-primary" />}
      </button>

      {/* Stations count chip */}
      <div className="absolute left-4 bottom-32 z-[500] bg-white shadow-[var(--shadow-card)] rounded-full px-4 py-2 text-sm font-semibold flex items-center gap-2">
        <Zap className="h-4 w-4 text-primary" fill="currentColor" />
        {loadingStations ? "Searching…" : `${filtered.length} nearby`}
      </div>

      {/* Station detail sheet - matches reference */}
      <Sheet open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent side="bottom" className="rounded-t-3xl p-0 max-h-[85vh] z-[1100] border-0">
          {selected && <StationDetailSheet station={selected} onClose={() => setSelected(null)} />}
        </SheetContent>
      </Sheet>
    </div>
  );
}

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

  // Default arrive/depart times (now and +1h)
  const now = new Date();
  const later = new Date(now.getTime() + 60 * 60 * 1000);
  const fmt = (d: Date) => d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });

  return (
    <div className="overflow-y-auto max-h-[85vh]">
      <div className="mx-auto mt-3 h-1.5 w-12 rounded-full bg-muted" />
      <div className="p-5 space-y-5">
        {/* Header row: thumbnail + name + address */}
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
            <p className="text-xs text-primary font-semibold mt-1.5 flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              {station.distanceKm ? `${(station.distanceKm * 1000).toFixed(0)} m` : "Nearby"} · {Math.max(1, Math.round((station.distanceKm ?? 0.5) * 2))} min
            </p>
          </div>
        </div>

        {/* 3-column pill stats matching reference (red border, pink tint) */}
        <div className="border-2 border-destructive/60 rounded-2xl p-3 grid grid-cols-3 gap-1 divide-x divide-destructive/30">
          <PillStat top={connectorLabel} label="Connection" />
          <PillStat top={`${currencySymbol}${minPrice}`} label="Per kWh" />
          <PillStat top={`${currencySymbol}${parkingFee}`} label="Parking Fee" />
        </div>

        {/* Arrive / Depart selectors */}
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

        {/* Action buttons */}
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
