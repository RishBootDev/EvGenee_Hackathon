import { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents } from "react-leaflet";
import type { Station } from "@/lib/api";
import { Zap, Star, Navigation } from "lucide-react";
import { renderToStaticMarkup } from "react-dom/server";
import type { NavigateFn } from "./StationsMap";

delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl;

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

function MapEvents({
  onCenterChange,
  onDeselect,
}: {
  onCenterChange: (c: [number, number]) => void;
  onDeselect: () => void;
}) {
  useMapEvents({
    moveend: (e) => {
      const c = e.target.getCenter();
      onCenterChange([c.lat, c.lng]);
    },
    click: () => onDeselect(),
  });
  return null;
}

function StationPopupCard({ station, navigate }: { station: Station; navigate: NavigateFn }) {
  const [lng, lat] = station.location.coordinates;
  const avail = station.isOpen && station.availablePorts > 0;
  const minPrice = station.pricing?.length
    ? Math.min(...station.pricing.map((p) => p.priceperKWh)) : 0;
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
        {station.distanceKm !== undefined && (
          <div style={{ flex: 1, padding: "8px 4px", textAlign: "center" }}>
            <p style={{ fontWeight: 800, color: "#1e293b", fontSize: 14, margin: 0 }}>
              {station.distanceKm < 1 ? `${(station.distanceKm * 1000).toFixed(0)}m` : `${station.distanceKm.toFixed(1)}km`}
            </p>
            <p style={{ color: "#94a3b8", fontSize: 10, margin: 0 }}>away</p>
          </div>
        )}
      </div>
      <div style={{ padding: 10, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <button
          disabled={!station.isOpen}
          onClick={() => navigate({ to: "/stations/$stationId", params: { stationId: station._id } })}
          style={{ height: 36, background: station.isOpen ? grad : "#e2e8f0", color: station.isOpen ? "#fff" : "#94a3b8", border: "none", borderRadius: 10, fontWeight: 800, fontSize: 12, cursor: station.isOpen ? "pointer" : "not-allowed" }}
        >Book Now</button>
        <button
          onClick={() => window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`, "_blank")}
          style={{ height: 36, border: "1.5px solid #e2e8f0", borderRadius: 10, background: "#fff", fontSize: 12, fontWeight: 600, color: "#475569", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}
        >
          <Navigation size={12} /> Directions
        </button>
      </div>
    </div>
  );
}

function StationMarker({ station, isSelected, onSelect, navigate }: {
  station: Station; isSelected: boolean;
  onSelect: (s: Station) => void; navigate: NavigateFn;
}) {
  const [lng, lat] = station.location.coordinates;
  const avail = station.isOpen && station.availablePorts > 0;
  const markerRef = useRef<L.Marker | null>(null);
  // Track hover separately for desktop only
  const [hovering, setHovering] = useState(false);
  const isTouch = useRef(false);

  // CRITICAL FIX: icon active state — on touch, ONLY isSelected controls size
  // On mouse, hover also enlarges temporarily
  const active = isTouch.current ? isSelected : (hovering || isSelected);
  const icon = useMemo(() => makeStationIcon(avail, active), [avail, active]);

  useEffect(() => {
    const marker = markerRef.current;
    if (!marker) return;
    if (isSelected) {
      const t = setTimeout(() => marker.openPopup(), 350);
      return () => clearTimeout(t);
    } else {
      marker.closePopup();
      setHovering(false); // Always reset hover when deselected
    }
  }, [isSelected]);

  return (
    <Marker
      ref={(m) => { markerRef.current = m; }}
      position={[lat, lng]}
      icon={icon}
      eventHandlers={{
        // Desktop hover — open popup immediately
        mouseover: (e) => {
          // Check if this is a real mouse event (not synthesized from touch)
          if ((e.originalEvent as PointerEvent).pointerType === "touch") return;
          setHovering(true);
          markerRef.current?.openPopup();
        },
        mouseout: (e) => {
          if ((e.originalEvent as PointerEvent).pointerType === "touch") return;
          setHovering(false);
        },
        // Both desktop click and mobile tap
        click: (e) => {
          L.DomEvent.stopPropagation(e);
          // Detect touch — reset hover so pin won't get stuck enlarged
          isTouch.current = (e.originalEvent as PointerEvent).pointerType === "touch";
          setHovering(false);
          onSelect(station);
        },
      }}
    >
      <Popup
        className="ev-station-popup"
        closeButton={false}
        autoPan={false}
        keepInView={false}
        minWidth={258}
        maxWidth={258}
        offset={[0, -10]}
      >
        <StationPopupCard station={station} navigate={navigate} />
      </Popup>
    </Marker>
  );
}

export default function StationsMapInner({
  center, stations, onSelect, onDeselect, selectedId, onCenterChange, userLocation, navigate,
}: {
  center: [number, number]; stations: Station[];
  onSelect: (s: Station) => void; onDeselect: () => void;
  selectedId?: string | null; onCenterChange?: (c: [number, number]) => void;
  userLocation?: [number, number] | null; navigate: NavigateFn;
}) {
  const mapRef = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!selectedId || !mapRef.current) return;
    const s = stations.find((x) => x._id === selectedId);
    if (s) {
      const [lng, lat] = s.location.coordinates;
      mapRef.current.flyTo([lat, lng], 15, { duration: 0.6 });
    }
  }, [selectedId, stations]);

  return (
    <MapContainer
      center={center} zoom={13}
      className="h-full w-full"
      ref={(m) => { mapRef.current = m; }}
      zoomControl={false}
    >
      <TileLayer attribution="&copy; OpenStreetMap" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      <FlyTo center={center} />
      {onCenterChange && <MapEvents onCenterChange={onCenterChange} onDeselect={onDeselect} />}
      {userLocation && <Marker position={userLocation} icon={userIcon} />}
      {stations.map((s) => (
        <StationMarker key={s._id} station={s} isSelected={selectedId === s._id}
          onSelect={onSelect} navigate={navigate} />
      ))}
    </MapContainer>
  );
}
