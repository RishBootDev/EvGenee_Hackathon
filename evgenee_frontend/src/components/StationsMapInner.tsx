import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap, useMapEvents } from "react-leaflet";
import type { Station } from "@/lib/api";
import { Zap, Star, Navigation } from "lucide-react";
import { renderToStaticMarkup } from "react-dom/server";
import type { NavigateFn } from "./StationsMap";
import DirectionsPanel, { type TransportMode, type RouteOption, stepIcon, stepLabel, fmtDist } from "./DirectionsPanel";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";

delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl;

// ── Icons ─────────────────────────────────────────────────────────────────────
function makeStationIcon(avail: boolean, active: boolean) {
  const size = active ? 44 : 36;
  const zap = renderToStaticMarkup(<Zap size={active ? 20 : 17} fill="white" />);
  return L.divIcon({
    className: "",
    html: `<div class="ev-pin${avail ? "" : " unavail"}${active ? " hovered" : ""}">${zap}</div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size],
  });
}

const userIcon = L.divIcon({
  className: "",
  html: `<div class="ev-user-dot"></div>`,
  iconSize: [22, 22],
  iconAnchor: [11, 11],
});

const destIcon = L.divIcon({
  className: "",
  html: `<div style="width:16px;height:16px;border-radius:50%;background:#3b82f6;border:3px solid #fff;box-shadow:0 0 0 3px #3b82f644;"></div>`,
  iconSize: [16, 16],
  iconAnchor: [8, 8],
});

// ── OSRM Route Fetcher ────────────────────────────────────────────────────────
async function fetchRoutes(
  from: [number, number],
  to: [number, number],
  mode: TransportMode
): Promise<RouteOption[]> {
  const url =
    `https://router.project-osrm.org/route/v1/${mode}/` +
    `${from[1]},${from[0]};${to[1]},${to[0]}` +
    `?overview=full&geometries=geojson&alternatives=2&steps=true`;
  const res = await fetch(url);
  const data = await res.json();
  if (!data.routes?.length) return [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return data.routes.map((r: any) => ({
    distanceKm: r.distance / 1000,
    durationMin: Math.round(r.duration / 60),
    coords: r.geometry.coordinates.map(([lng, lat]: [number, number]) => [lat, lng] as [number, number]),
    steps: r.legs?.[0]?.steps ?? [],
  }));
}

// ── FlyTo ─────────────────────────────────────────────────────────────────────
function FlyTo({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    const cur = map.getCenter();
    if (cur.distanceTo(L.latLng(center[0], center[1])) > 20) {
      map.flyTo(center, 13, { duration: 0.8 });
    }
  }, [center, map]);
  return null;
}

// ── MapEvents ─────────────────────────────────────────────────────────────────
function MapEvents({ onCenterChange, onDeselect }: { onCenterChange: (c: [number, number]) => void; onDeselect: () => void }) {
  useMapEvents({
    moveend: (e) => { const c = e.target.getCenter(); onCenterChange([c.lat, c.lng]); },
    click: () => onDeselect(),
  });
  return null;
}

// ── FitBounds helper (inside map) ─────────────────────────────────────────────
function FitRoute({ coords }: { coords: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (coords.length < 2) return;
    map.fitBounds(L.latLngBounds(coords), { padding: [80, 80], maxZoom: 16 });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coords]);
  return null;
}

// ── Popup Card ────────────────────────────────────────────────────────────────
function StationPopupCard({
  station, navigate, userLocation, onDirections, isMyStation
}: {
  station: Station; navigate: NavigateFn;
  userLocation?: [number, number] | null;
  onDirections: (s: Station) => void;
  isMyStation?: boolean;
}) {
  const [roadDist, setRoadDist] = useState<number | null>(null);

  useEffect(() => {
    if (!userLocation) return;
    const [sLng, sLat] = station.location.coordinates;
    fetchRoutes(userLocation, [sLat, sLng], "driving")
      .then(routes => {
        if (routes.length > 0) {
          setRoadDist(routes[0].distanceKm);
        }
      })
      .catch(() => {});
  }, [userLocation, station.location.coordinates]);

  const displayDist = roadDist !== null ? roadDist : station.distanceKm;
  const avail = station.isOpen && station.availablePorts > 0;
  const minPrice = station.pricing?.length ? Math.min(...station.pricing.map((p) => p.priceperKWh)) : 0;
  const sym = station.pricing?.[0]?.currency === "INR" ? "₹" : "$";
  const avgRating = station.reviews?.length
    ? (station.reviews.reduce((a, r) => a + r.rating, 0) / station.reviews.length).toFixed(1)
    : null;
  const grad = "linear-gradient(135deg,#22c55e,#16a34a)";

  return (
    <div style={{ width: 258, fontFamily: "system-ui,sans-serif", borderRadius: 18, overflow: "hidden", background: "#fff" }}>
      <div style={{ background: grad, padding: "12px 14px", display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ width: 40, height: 40, borderRadius: 10, background: "rgba(255,255,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, overflow: "hidden" }}>
          {station.Images?.[0]
            ? <img src={station.Images[0]} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            : <Zap size={18} color="white" fill="white" />}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontWeight: 800, color: "#fff", fontSize: 13, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{station.name}</p>
          <p style={{ color: "rgba(255,255,255,0.75)", fontSize: 11, margin: 0 }}>{station.address?.city}</p>
        </div>
        <span style={{ background: avail ? "rgba(255,255,255,0.25)" : "rgba(0,0,0,0.2)", color: "#fff", borderRadius: 20, padding: "2px 8px", fontSize: 10, fontWeight: 700, flexShrink: 0 }}>
          {avail ? `${station.availablePorts} free` : station.isOpen ? "Full" : "Closed"}
        </span>
      </div>
      <div style={{ display: "flex", borderBottom: "1px solid #f1f5f9" }}>
        <div style={{ flex: 1, padding: "8px 4px", textAlign: "center", borderRight: "1px solid #f1f5f9" }}>
          <p style={{ fontWeight: 800, color: "#16a34a", fontSize: 14, margin: 0 }}>{sym}{minPrice}</p>
          <p style={{ color: "#94a3b8", fontSize: 10, margin: 0 }}>per kWh</p>
        </div>
        {avgRating && (
          <div style={{ flex: 1, padding: "8px 4px", textAlign: "center", borderRight: "1px solid #f1f5f9", display: "flex", flexDirection: "column", alignItems: "center" }}>
            <p style={{ fontWeight: 800, color: "#f59e0b", fontSize: 14, margin: 0, display: "flex", alignItems: "center", gap: 2 }}>
              <Star size={11} fill="#f59e0b" color="#f59e0b" />{avgRating}
            </p>
            <p style={{ color: "#94a3b8", fontSize: 10, margin: 0 }}>rating</p>
          </div>
        )}
        {displayDist !== undefined && (
          <div style={{ flex: 1, padding: "8px 4px", textAlign: "center" }}>
            <p style={{ fontWeight: 800, color: "#1e293b", fontSize: 14, margin: 0 }}>
              {displayDist < 1 ? `${(displayDist * 1000).toFixed(0)}m` : `${displayDist.toFixed(1)}km`}
            </p>
            <p style={{ color: "#94a3b8", fontSize: 10, margin: 0 }}>{roadDist !== null ? "by road" : "away"}</p>
          </div>
        )}
      </div>
      <div style={{ padding: 10, display: "grid", gridTemplateColumns: isMyStation ? "1fr" : "1fr 1fr", gap: 8 }}>
        {isMyStation ? (
          <button
            onClick={() => navigate({ to: "/owner/stations/$stationId", params: { stationId: station._id } })}
            style={{ height: 36, background: "#1e293b", color: "#fff", border: "none", borderRadius: 10, fontWeight: 800, fontSize: 12, cursor: "pointer" }}
          >
            View Bookings Dashboard
          </button>
        ) : (
          <>
            <button
              disabled={!station.isOpen}
              onClick={() => navigate({ to: "/stations/$stationId", params: { stationId: station._id } })}
              style={{ height: 36, background: station.isOpen ? grad : "#e2e8f0", color: station.isOpen ? "#fff" : "#94a3b8", border: "none", borderRadius: 10, fontWeight: 800, fontSize: 12, cursor: station.isOpen ? "pointer" : "not-allowed" }}
            >Book Now</button>
            <button
              onClick={() => {
                if (userLocation) {
                  onDirections(station);
                } else {
                  toast.error("Waiting for GPS location to calculate directions");
                }
              }}
              style={{ height: 36, border: "1.5px solid #e2e8f0", borderRadius: 10, background: "#fff", fontSize: 12, fontWeight: 600, color: "#475569", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}
            >
              <Navigation size={12} /> Directions
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ── Station Marker ────────────────────────────────────────────────────────────
function StationMarker({ station, isSelected, onSelect, navigate, userLocation, onDirections, isMyStation }: {
  station: Station; isSelected: boolean; onSelect: (s: Station) => void; navigate: NavigateFn;
  userLocation?: [number, number] | null; onDirections: (s: Station) => void; isMyStation?: boolean;
}) {
  const [lng, lat] = station.location.coordinates;
  const avail = station.isOpen && station.availablePorts > 0;
  const markerRef = useRef<L.Marker | null>(null);
  const [hovering, setHovering] = useState(false);
  const isTouch = useRef(false);
  const active = isTouch.current ? isSelected : (hovering || isSelected);
  const icon = useMemo(() => makeStationIcon(avail, active), [avail, active]);

  useEffect(() => {
    const marker = markerRef.current;
    if (!marker) return;
    if (isSelected) { const t = setTimeout(() => marker.openPopup(), 350); return () => clearTimeout(t); }
    else { marker.closePopup(); setHovering(false); }
  }, [isSelected]);

  return (
    <Marker ref={(m) => { markerRef.current = m; }} position={[lat, lng]} icon={icon}
      eventHandlers={{
        mouseover: (e) => { if ((e.originalEvent as PointerEvent).pointerType === "touch") return; setHovering(true); markerRef.current?.openPopup(); },
        mouseout: (e) => { if ((e.originalEvent as PointerEvent).pointerType === "touch") return; setHovering(false); },
        click: (e) => { L.DomEvent.stopPropagation(e); isTouch.current = (e.originalEvent as PointerEvent).pointerType === "touch"; setHovering(false); onSelect(station); },
      }}
    >
      <Popup className="ev-station-popup" closeButton={false} autoPan={false} keepInView={false} minWidth={258} maxWidth={258} offset={[0, -10]}>
        <StationPopupCard station={station} navigate={navigate} userLocation={userLocation} onDirections={onDirections} isMyStation={isMyStation} />
      </Popup>
    </Marker>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function StationsMapInner({
  center, stations, onSelect, onDeselect, selectedId, onCenterChange, userLocation, navigate,
}: {
  center: [number, number]; stations: Station[];
  onSelect: (s: Station) => void; onDeselect: () => void;
  selectedId?: string | null; onCenterChange?: (c: [number, number]) => void;
  userLocation?: [number, number] | null; navigate: NavigateFn;
}) {
  const { user } = useAuth();
  const mapRef = useRef<L.Map | null>(null);

  // ── Routing state ──
  const [targetStation, setTargetStation] = useState<Station | null>(null);
  const [mode, setMode] = useState<TransportMode>("driving");
  const [routes, setRoutes] = useState<RouteOption[]>([]);
  const [selectedRouteIdx, setSelectedRouteIdx] = useState(0);
  const [routeLoading, setRouteLoading] = useState(false);
  const [panelVisible, setPanelVisible] = useState(true);
  const [currentStepIdx, setCurrentStepIdx] = useState(0);

  const handleDirections = useCallback((station: Station) => {
    setTargetStation(station);
    setRoutes([]);
    setSelectedRouteIdx(0);
    setRouteLoading(true);
    setPanelVisible(true);
    setCurrentStepIdx(0);
  }, []);

  const clearRoute = useCallback(() => {
    setTargetStation(null);
    setRoutes([]);
    setRouteLoading(false);
    setPanelVisible(true);
    setCurrentStepIdx(0);
  }, []);

  const userLocRef = useRef<[number, number] | null>(userLocation ?? null);
  useEffect(() => { userLocRef.current = userLocation ?? null; }, [userLocation]);

  const handleStart = useCallback(() => {
    setPanelVisible(false); // Collapse panel, keep route on map
    setCurrentStepIdx(0);
    const loc = userLocRef.current;
    if (loc && mapRef.current) {
      // Zoom in to user location to start navigation view
      mapRef.current.flyTo(loc, 17, { duration: 1.2 });
    }
  }, []); // no userLocation dep — uses ref

  // Active Navigation tracking: smoothly pan to follow user and update step
  // MOBILE FIX: Only pan if user moved > 10 m since last pan to avoid
  // continuous animation on mobile GPS jitter.
  const lastPanLocRef = useRef<[number, number] | null>(null);
  useEffect(() => {
    if (!panelVisible && targetStation && userLocation && mapRef.current) {
      const prev = lastPanLocRef.current;
      const moved = !prev ||
        Math.abs(userLocation[0] - prev[0]) > 0.00009 || // ~10 m latitude
        Math.abs(userLocation[1] - prev[1]) > 0.00013;   // ~10 m longitude
      if (moved) {
        lastPanLocRef.current = userLocation;
        mapRef.current.panTo(userLocation, { animate: true, duration: 1 });
      }

      const selectedRoute = routes[selectedRouteIdx];
      if (selectedRoute && selectedRoute.steps.length > 0) {
        // Find the next maneuver location
        const nextStep = selectedRoute.steps[Math.min(currentStepIdx + 1, selectedRoute.steps.length - 1)];
        if (nextStep && nextStep.maneuver.location) {
          const [lng, lat] = nextStep.maneuver.location;
          const distToManeuver = L.latLng(userLocation[0], userLocation[1]).distanceTo(L.latLng(lat, lng));
          // If within 30 meters of the maneuver, advance to next step
          if (distToManeuver < 30 && currentStepIdx < selectedRoute.steps.length - 1) {
            setCurrentStepIdx(i => i + 1);
          }
        }
      }
    }
  }, [userLocation, panelVisible, targetStation, routes, selectedRouteIdx, currentStepIdx]);

  // Check for pending directions triggered from other pages (e.g. Booking Details)
  useEffect(() => {
    const pendingId = sessionStorage.getItem("pendingDirections");
    if (pendingId && stations.length > 0 && userLocation) {
      const s = stations.find(x => x._id === pendingId);
      if (s) {
        sessionStorage.removeItem("pendingDirections");
        handleDirections(s);
      }
    }
  }, [stations, userLocation, handleDirections]);

  // Fetch route whenever target or mode changes.
  // MOBILE FIX: userLocation is intentionally NOT in the dependency array.
  // We use userLocRef to read the latest location at fetch time without
  // making every GPS update retrigger a new OSRM network request.
  useEffect(() => {
    if (!targetStation) return;
    const loc = userLocRef.current;
    if (!loc) return;
    let cancelled = false;
    setRouteLoading(true);
    setRoutes([]);
    setSelectedRouteIdx(0);
    const [sLng, sLat] = targetStation.location.coordinates;
    fetchRoutes(loc, [sLat, sLng], mode)
      .then((r) => { if (!cancelled) { setRoutes(r); setRouteLoading(false); } })
      .catch(() => { if (!cancelled) setRouteLoading(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetStation, mode]); // userLocation deliberately excluded — see comment above

  // Fly to selected station on select
  useEffect(() => {
    if (!selectedId || !mapRef.current) return;
    const s = stations.find((x) => x._id === selectedId);
    if (s) { const [lng, lat] = s.location.coordinates; mapRef.current.flyTo([lat, lng], 15, { duration: 0.6 }); }
  }, [selectedId, stations]);

  const selectedRoute = routes[selectedRouteIdx];

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <MapContainer center={center} zoom={13} className="h-full w-full"
        ref={(m) => { mapRef.current = m; }} zoomControl={false}
      >
        {/* OpenStreetMap light tiles */}
        <TileLayer
          attribution='&copy; OpenStreetMap'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FlyTo center={center} />
        {onCenterChange && <MapEvents onCenterChange={onCenterChange} onDeselect={onDeselect} />}

        {/* User location dot */}
        {userLocation && <Marker position={userLocation} icon={userIcon} />}

        {/* Alternative route polylines (draw first, below main route) */}
        {routes.map((r, i) => i !== selectedRouteIdx && (
          <Polyline key={`alt-${i}`} positions={r.coords} color="#475569" weight={4} opacity={0.5} dashArray="8 5" />
        ))}

        {/* Selected route — triple-layer for visual depth */}
        {selectedRoute && (
          <>
            <Polyline positions={selectedRoute.coords} color="#000" weight={10} opacity={0.2} />
            <Polyline positions={selectedRoute.coords} color="#3b82f6" weight={6} opacity={0.9} />
            <Polyline positions={selectedRoute.coords} color="#60a5fa" weight={3} opacity={0.6} dashArray="14 7" />
            {panelVisible && <FitRoute coords={selectedRoute.coords} />}
          </>
        )}

        {/* Destination pin when in routing mode */}
        {targetStation && (() => {
          const [lng, lat] = targetStation.location.coordinates;
          return <Marker position={[lat, lng]} icon={destIcon} />;
        })()}

        {stations.map((s) => {
          const isMyStation = !!(s && user && (typeof s.ownerofStation === "string" ? s.ownerofStation === user.id : s.ownerofStation?._id === user.id));
          return (
            <StationMarker key={s._id} station={s} isSelected={selectedId === s._id}
              onSelect={onSelect} navigate={navigate} userLocation={userLocation} onDirections={handleDirections} isMyStation={isMyStation} />
          );
        })}
      </MapContainer>

      {/* Directions panel — rendered via portal at document.body */}
      {targetStation && userLocation && panelVisible && (
        <DirectionsPanel
          station={targetStation}
          userLocation={userLocation}
          mode={mode}
          onModeChange={(m) => setMode(m)}
          routes={routes}
          selectedIdx={selectedRouteIdx}
          onSelectRoute={setSelectedRouteIdx}
          loading={routeLoading}
          onClose={clearRoute}
          onStart={handleStart}
        />
      )}

      {/* Collapsed route strip — shown when panel is hidden but route is active */}
      {targetStation && selectedRoute && userLocation && !panelVisible && (() => {
        const nextStep = selectedRoute.steps[Math.min(currentStepIdx + 1, selectedRoute.steps.length - 1)] || selectedRoute.steps[0];
        const distToNext = nextStep?.maneuver?.location
          ? L.latLng(userLocation[0], userLocation[1]).distanceTo(L.latLng(nextStep.maneuver.location[1], nextStep.maneuver.location[0])) / 1000
          : nextStep?.distance / 1000 || 0;

        return (
          <>
            {/* Top Turn-by-Turn Banner */}
            <div style={{
              position: "fixed", top: "calc(env(safe-area-inset-top, 0px) + 72px)", left: "50%", transform: "translateX(-50%)",
              zIndex: 99999, background: "#0a0f1a", border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 16, padding: "16px 20px", display: "flex", alignItems: "center",
              gap: 16, boxShadow: "0 10px 40px rgba(0,0,0,0.6)", fontFamily: "system-ui,sans-serif",
              width: "min(90vw, 400px)",
            }}>
              <div style={{ width: 48, height: 48, borderRadius: 12, background: "#3b82f6", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 24, fontWeight: 900, flexShrink: 0 }}>
                {stepIcon(nextStep.maneuver.type, nextStep.maneuver.modifier)}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 22, fontWeight: 900, color: "#fff", lineHeight: 1 }}>{fmtDist(distToNext)}</div>
                <div style={{ fontSize: 16, fontWeight: 500, color: "rgba(255,255,255,0.8)", marginTop: 6, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {stepLabel(nextStep.maneuver.type, nextStep.maneuver.modifier, nextStep.name)}
                </div>
              </div>
            </div>

            {/* Bottom Status Strip */}
            <div style={{
              position: "fixed", 
              bottom: "calc(env(safe-area-inset-bottom, 0px) + 88px)", 
              left: "50%", 
              transform: "translateX(-50%)",
              zIndex: 99999, 
              background: "#0a0f1a", 
              border: "1px solid rgba(59,130,246,0.35)",
              borderRadius: 50, 
              padding: "10px 20px", 
              display: "flex", 
              alignItems: "center",
              gap: 14, 
              boxShadow: "0 8px 32px rgba(0,0,0,0.5)", 
              fontFamily: "system-ui,sans-serif",
              whiteSpace: "nowrap",
              width: "max-content",
              maxWidth: "calc(100vw - 24px)",
            }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#3b82f6", flexShrink: 0 }} />
              <span style={{ fontSize: 13, fontWeight: 800, color: "#fff" }}>
                {selectedRoute.durationMin < 60 ? `${selectedRoute.durationMin} min` : `${Math.floor(selectedRoute.durationMin/60)}h ${selectedRoute.durationMin%60}m`}
              </span>
              <span style={{ fontSize: 12, color: "rgba(255,255,255,0.45)" }}>
                {selectedRoute.distanceKm < 1 ? `${(selectedRoute.distanceKm*1000).toFixed(0)} m` : `${selectedRoute.distanceKm.toFixed(1)} km`}
              </span>
              <button
                onClick={() => setPanelVisible(true)}
                style={{ background: "rgba(59,130,246,0.15)", border: "1px solid rgba(59,130,246,0.3)", borderRadius: 20, padding: "3px 10px", cursor: "pointer", color: "#3b82f6", fontSize: 11, fontWeight: 700 }}
              >Details</button>
              <button
                onClick={clearRoute}
                style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 20, padding: "3px 10px", cursor: "pointer", color: "rgba(255,255,255,0.5)", fontSize: 11, fontWeight: 600 }}
              >✕ End</button>
            </div>
          </>
        );
      })()}
    </div>
  );
}
