import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { useAuth } from "@/lib/auth";
import { StationsAPI, type Station } from "@/lib/api";
import { StationsMap } from "@/components/StationsMap";
import { Badge } from "@/components/ui/badge";
import { Search, Zap, Loader2, LocateFixed, Plug, X, ChevronRight, MapPin } from "lucide-react";
import { getApiError } from "@/lib/utils";
import { toast } from "sonner";
import { LandingPage } from "@/components/LandingPage";
import { Drawer } from "vaul";
import { useNavigate } from "@tanstack/react-router";

export const Route = createFileRoute("/")({ component: HomePage });

const DEFAULT_CENTER: [number, number] = [28.6139, 77.209];
// Bottom nav is ~64px; drawer sits above it
const NAV_H = 64;

function HomePage() {
  const { isAuthed, loading } = useAuth();
  const navigate = useNavigate();

  const [center, setCenter] = useState<[number, number]>(() => {
    if (typeof window !== "undefined") {
      const s = sessionStorage.getItem("mapCenter");
      if (s) { try { return JSON.parse(s) as [number, number]; } catch {} }
    }
    return DEFAULT_CENTER;
  });

  const handleMapMove = useCallback((c: [number, number]) => {
    setCenter(c);
    sessionStorage.setItem("mapCenter", JSON.stringify(c));
  }, []);

  const [stations, setStations] = useState<Station[]>(() => {
    if (typeof window !== "undefined") {
      const s = sessionStorage.getItem("stationsCache");
      if (s) { try { return JSON.parse(s) as Station[]; } catch {} }
    }
    return [];
  });
  const [loadingStations, setLoadingStations] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [locating, setLocating] = useState(false);
  const [snap, setSnap] = useState<string | number | null>("35vh");
  const dropdownRef = useRef<HTMLDivElement>(null);

  const locate = useCallback(() => {
    if (!navigator.geolocation) { toast.error("Geolocation not supported"); return; }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const c: [number, number] = [pos.coords.latitude, pos.coords.longitude];
        setUserLocation(c);
        setCenter(c);
        sessionStorage.setItem("mapCenter", JSON.stringify(c));
        setLocating(false);
        toast.success("Location found");
      },
      (err) => {
        toast.error(err.code === err.PERMISSION_DENIED ? "Location permission denied" : "Could not get location");
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 }
    );
  }, []);

  useEffect(() => {
    if (isAuthed && !sessionStorage.getItem("mapCenter")) locate();
  }, [isAuthed, locate]);

  useEffect(() => {
    if (!isAuthed) return;
    let cancel = false;
    (async () => {
      // Show loading only if we have no cached data
      if (!sessionStorage.getItem("stationsCache")) {
        setLoadingStations(true);
      }
      try {
        const r = await StationsAPI.nearby({ lat: center[0], lng: center[1], maxDistance: 50000 });
        if (!cancel) {
          const newStations = r.data?.data ?? [];
          setStations(newStations);
          sessionStorage.setItem("stationsCache", JSON.stringify(newStations));
        }
      } catch (e) {
        if (!cancel && !sessionStorage.getItem("stationsCache")) {
          toast.error(getApiError(e, "Failed to load stations"));
        }
      } finally {
        if (!cancel) setLoadingStations(false);
      }
    })();
    return () => { cancel = true; };
  }, [center, isAuthed]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return stations;
    return stations.filter(s =>
      s.name.toLowerCase().includes(q) ||
      s.address?.city?.toLowerCase().includes(q) ||
      s.address?.street?.toLowerCase().includes(q)
    );
  }, [stations, search]);

  // Close dropdown on outside interaction
  useEffect(() => {
    const close = (e: Event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, []);

  const handleSelect = useCallback((s: Station) => {
    setSelectedId(s._id);
    setShowDropdown(false);
  }, []);

  const handleDeselect = useCallback(() => setSelectedId(null), []);

  if (loading) return (
    <div className="fixed inset-0 grid place-items-center bg-background">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
  if (!isAuthed) return <LandingPage />;

  // Button row bottom position — above drawer (35vh) and above nav
  const fabBottom = `calc(${NAV_H}px + 37vh)`;

  return (
    <>
      {/* ── FULL-SCREEN MAP (z:0) ── */}
      <div className="fixed inset-0 z-0">
        <StationsMap
          center={center}
          stations={filtered}
          onSelect={handleSelect}
          onDeselect={handleDeselect}
          selectedId={selectedId}
          onCenterChange={handleMapMove}
          userLocation={userLocation}
          navigate={navigate}
        />
      </div>

      {/* ── FLOATING SEARCH BAR (fixed, z:9999 — above everything including Leaflet) ──
          Using `fixed` instead of `absolute` ensures it's in the root stacking context,
          completely independent of Leaflet's DOM and event capture. ── */}
      <div
        ref={dropdownRef}
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          zIndex: 9999,
          padding: "calc(env(safe-area-inset-top, 0px) + 12px) 12px 0",
          pointerEvents: "auto",
        }}
      >
        <div style={{ maxWidth: 540, margin: "0 auto", paddingRight: 90 }}>
          {/* Search pill */}
          <div style={{
            display: "flex", alignItems: "center", gap: 8,
            background: "rgba(0,8,20,0.90)",
            backdropFilter: "blur(16px)",
            WebkitBackdropFilter: "blur(16px)",
            borderRadius: 16, border: "1px solid rgba(0,0,0,0.08)",
            boxShadow: "0 4px 24px rgba(0,0,0,0.14)",
            padding: "0 12px 0 16px", height: 48,
          }}>
            <Search size={16} color="rgba(255,255,255,0.4)" style={{ flexShrink: 0 }} />
            {/* Plain <input> — no component wrappers that might interfere on mobile */}
            <input
              type="search"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              placeholder="Search charging stations…"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setShowDropdown(true); }}
              onFocus={() => { setShowDropdown(!!search); setSnap("70px"); }}
              onBlur={() => setTimeout(() => setSnap("35vh"), 250)}
              style={{
                flex: 1, border: "none", outline: "none",
                background: "transparent", fontSize: 15,
                color: "#ffffff", minWidth: 0,
                // Critical for mobile Chrome — prevents browser from ignoring this input
                WebkitAppearance: "none",
                touchAction: "manipulation",
              }}
            />
            {search ? (
              <button
                onPointerDown={(e) => { e.preventDefault(); setSearch(""); setShowDropdown(false); }}
                style={{ border: "none", background: "none", padding: 6, cursor: "pointer", color: "#94a3b8", display: "flex", borderRadius: 8 }}
              >
                <X size={16} />
              </button>
            ) : loadingStations ? (
              <Loader2 size={16} className="animate-spin text-primary" style={{ flexShrink: 0 }} />
            ) : null}
          </div>

          {/* Dropdown */}
          {showDropdown && search.trim() && (
            <div style={{
              marginTop: 6, background: "rgba(255,255,255,0.98)",
              borderRadius: 16, border: "1px solid rgba(0,0,0,0.07)",
              boxShadow: "0 8px 32px rgba(0,0,0,0.14)",
              overflow: "hidden", maxHeight: 280, overflowY: "auto",
            }}>
              {filtered.length === 0 ? (
                <div style={{ padding: "24px 16px", textAlign: "center", color: "#94a3b8" }}>
                  <Plug size={28} style={{ margin: "0 auto 8px", opacity: 0.4 }} />
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 500 }}>No stations found</p>
                </div>
              ) : filtered.slice(0, 8).map((s) => {
                const avail = s.isOpen && s.availablePorts > 0;
                return (
                  <button
                    key={s._id}
                    onPointerDown={() => { handleSelect(s); setSearch(s.name); setShowDropdown(false); }}
                    style={{
                      width: "100%", display: "flex", alignItems: "center", gap: 12,
                      padding: "10px 14px", background: "none", border: "none",
                      borderBottom: "1px solid rgba(0,0,0,0.05)", cursor: "pointer",
                      textAlign: "left", transition: "background 0.12s",
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = "#f8fafc")}
                    onMouseLeave={e => (e.currentTarget.style.background = "none")}
                  >
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: avail ? "#f0fdf4" : "#f1f5f9", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <Zap size={16} color={avail ? "#16a34a" : "#94a3b8"} fill={avail ? "#16a34a" : "#94a3b8"} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ margin: 0, fontWeight: 600, fontSize: 13, color: "#1e293b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.name}</p>
                      <p style={{ margin: "2px 0 0", fontSize: 11, color: "#94a3b8", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {s.address?.street}, {s.address?.city}
                      </p>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2, flexShrink: 0 }}>
                      {s.distanceKm !== undefined && (
                        <span style={{ fontSize: 11, fontWeight: 700, color: "#16a34a", background: "#f0fdf4", padding: "1px 6px", borderRadius: 6 }}>
                          {s.distanceKm < 1 ? `${(s.distanceKm * 1000).toFixed(0)}m` : `${s.distanceKm.toFixed(1)}km`}
                        </span>
                      )}
                      <span style={{ fontSize: 10, fontWeight: 600, color: avail ? "#16a34a" : "#94a3b8" }}>
                        {avail ? `${s.availablePorts} free` : s.isOpen ? "Full" : "Closed"}
                      </span>
                    </div>
                    <ChevronRight size={14} color="#cbd5e1" />
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── FAB: LOCATE + COUNT (fixed, above drawer) ── */}
      <button
        onClick={locate}
        aria-label="My location"
        style={{
          position: "fixed", right: 16, bottom: fabBottom, zIndex: 600,
          width: 48, height: 48, borderRadius: "50%",
          background: "#fff", border: "none",
          boxShadow: "0 4px 20px rgba(0,0,0,0.18)",
          display: "flex", alignItems: "center", justifyContent: "center",
          cursor: "pointer", transition: "transform 0.15s",
        }}
        onMouseDown={e => (e.currentTarget.style.transform = "scale(0.93)")}
        onMouseUp={e => (e.currentTarget.style.transform = "scale(1)")}
      >
        {locating ? <Loader2 size={20} className="animate-spin text-primary" /> : <LocateFixed size={20} color="#16a34a" />}
      </button>

      <div style={{
        position: "fixed", right: 16, top: "calc(env(safe-area-inset-top, 0px) + 12px)", zIndex: 9999,
        background: "rgba(0,8,20,0.90)",
        border: "1px solid rgba(34,197,94,0.3)",
        borderRadius: 24,
        boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        padding: "0 14px", display: "flex", alignItems: "center", gap: 6,
        fontSize: 13, fontWeight: 700, color: "#22c55e",
        height: 48,
        }}>
        <Zap size={14} color="#22c55e" fill="#22c55e" />
        {loadingStations ? "Searching…" : `${filtered.length} nearby`}
      </div>

      {/* ── MOBILE BOTTOM DRAWER (z:999, sits above map, below top-fixed elements) ── */}
      <div className="md:hidden">
        <Drawer.Root
          open={true} dismissible={false} modal={false}
          snapPoints={["70px", "35vh", "75vh"]}
          activeSnapPoint={snap}
          setActiveSnapPoint={setSnap}
        >
          <Drawer.Portal>
            <Drawer.Content
              className="outline-none"
              style={{
                position: "fixed", left: 0, right: 0,
                bottom: NAV_H, zIndex: 999,
                maxHeight: "82vh",
                background: "#fff",
                borderRadius: "24px 24px 0 0",
                boxShadow: "0 -4px 32px rgba(0,0,0,0.1)",
                borderTop: "1px solid rgba(0,0,0,0.06)",
                display: "flex", flexDirection: "column",
              }}
            >
              {/* Handle */}
              <div style={{ width: 36, height: 4, borderRadius: 2, background: "#e2e8f0", margin: "10px auto 4px", flexShrink: 0 }} />

              {/* Title */}
              <div style={{ padding: "4px 16px 10px", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
                <div>
                  <p style={{ margin: 0, fontWeight: 700, fontSize: 14, color: "#1e293b" }}>Nearby Stations</p>
                  <p style={{ margin: "2px 0 0", fontSize: 11, color: "#94a3b8" }}>Swipe up to browse all</p>
                </div>
                <span style={{ background: "#f0fdf4", color: "#16a34a", borderRadius: 20, padding: "2px 10px", fontSize: 11, fontWeight: 700 }}>
                  {filtered.length} found
                </span>
              </div>

              {/* List */}
              <div style={{ flex: 1, overflowY: "auto", padding: "0 12px 16px", display: "flex", flexDirection: "column", gap: 8 }}>
                {loadingStations ? (
                  <div style={{ padding: "32px 0", display: "flex", flexDirection: "column", alignItems: "center", gap: 10, color: "#94a3b8" }}>
                    <Loader2 size={28} className="animate-spin text-primary" />
                    <p style={{ margin: 0, fontSize: 13 }}>Finding stations…</p>
                  </div>
                ) : filtered.length === 0 ? (
                  <div style={{ padding: "32px 0", textAlign: "center", color: "#94a3b8" }}>
                    <Plug size={28} style={{ margin: "0 auto 8px", opacity: 0.4 }} />
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 500 }}>No stations found</p>
                  </div>
                ) : filtered.map((s) => (
                  <MobileCard key={s._id} station={s} isSelected={selectedId === s._id}
                    onSelect={() => { handleSelect(s); setSnap("70px"); }} />
                ))}
              </div>
            </Drawer.Content>
          </Drawer.Portal>
        </Drawer.Root>
      </div>
    </>
  );
}

function MobileCard({ station, isSelected, onSelect }: { station: Station; isSelected: boolean; onSelect: () => void }) {
  const avail = station.isOpen && station.availablePorts > 0;
  const minPrice = station.pricing?.length ? Math.min(...station.pricing.map(p => p.priceperKWh)) : 0;
  const sym = station.pricing?.[0]?.currency === "INR" ? "₹" : "$";
  const avgRating = station.reviews?.length
    ? (station.reviews.reduce((a, r) => a + r.rating, 0) / station.reviews.length).toFixed(1)
    : null;

  return (
    <button
      onClick={onSelect}
      style={{
        width: "100%", textAlign: "left", padding: 12,
        background: isSelected ? "#f0fdf4" : "#fff",
        border: `1.5px solid ${isSelected ? "#86efac" : "rgba(0,0,0,0.07)"}`,
        borderRadius: 16, display: "flex", alignItems: "center", gap: 12,
        cursor: "pointer", transition: "all 0.15s",
        boxShadow: isSelected ? "0 0 0 3px rgba(34,197,94,0.1)" : "0 1px 4px rgba(0,0,0,0.05)",
      }}
    >
      <div style={{ width: 52, height: 52, borderRadius: 14, background: avail ? "#f0fdf4" : "#f8fafc", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, position: "relative", overflow: "hidden" }}>
        {station.Images?.[0]
          ? <img src={station.Images[0]} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          : <Zap size={22} color={avail ? "#16a34a" : "#94a3b8"} fill={avail ? "#16a34a" : "#94a3b8"} />}
        <span style={{ position: "absolute", top: 3, right: 3, width: 10, height: 10, borderRadius: "50%", background: avail ? "#22c55e" : station.isOpen ? "#fbbf24" : "#94a3b8", border: "2px solid #fff" }} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, fontWeight: 700, fontSize: 13, color: "#1e293b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{station.name}</p>
        <p style={{ margin: "3px 0 0", fontSize: 11, color: "#94a3b8", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: 3 }}>
          <MapPin size={10} style={{ flexShrink: 0 }} /> {station.address?.street}, {station.address?.city}
        </p>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 5, flexWrap: "wrap" }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: "#16a34a" }}>{sym}{minPrice}/kWh</span>
          {avgRating && <span style={{ fontSize: 11, fontWeight: 700, color: "#f59e0b" }}>★ {avgRating}</span>}
          <span style={{ fontSize: 11, fontWeight: 700, color: avail ? "#16a34a" : "#94a3b8" }}>
            {avail ? `${station.availablePorts} free` : station.isOpen ? "Full" : "Closed"}
          </span>
          {station.distanceKm !== undefined && (
            <span style={{ fontSize: 11, fontWeight: 700, color: "#16a34a", background: "#f0fdf4", padding: "1px 6px", borderRadius: 6 }}>
              {station.distanceKm < 1 ? `${(station.distanceKm * 1000).toFixed(0)}m` : `${station.distanceKm.toFixed(1)}km`}
            </span>
          )}
        </div>
      </div>
      <ChevronRight size={16} color={isSelected ? "#16a34a" : "#cbd5e1"} style={{ flexShrink: 0 }} />
    </button>
  );
}
