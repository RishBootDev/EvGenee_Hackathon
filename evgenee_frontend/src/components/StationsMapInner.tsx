import { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents } from "react-leaflet";
import type { Station } from "@/lib/api";
import { Zap, Star, Navigation } from "lucide-react";
import { renderToStaticMarkup } from "react-dom/server";
import { useNavigate } from "@tanstack/react-router";

delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl;

const stationIcon = (avail: boolean, active: boolean) =>
  L.divIcon({
    className: "",
    html: `<div class="ev-pin${avail ? "" : " unavail"}${active ? " hovered" : ""}">${renderToStaticMarkup(
      <Zap size={active ? 20 : 17} fill="white" />
    )}</div>`,
    iconSize: active ? [44, 44] : [36, 36],
    iconAnchor: active ? [22, 44] : [18, 36],
  });

// Red pulsing dot for user's location
const userIcon = L.divIcon({
  className: "",
  html: `<div style="
    width:20px;height:20px;border-radius:50%;
    background:oklch(0.62 0.22 20);
    border:3px solid white;
    box-shadow:0 0 0 5px oklch(0.62 0.22 20 / 0.25),0 2px 8px rgba(0,0,0,0.3);
    animation:pulse-ring 2s infinite;
  "></div>`,
  iconSize: [20, 20],
  iconAnchor: [10, 10],
});

function FlyTo({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    const current = map.getCenter();
    const target = L.latLng(center[0], center[1]);
    if (current.distanceTo(target) > 10) map.flyTo(center, 13, { duration: 0.8 });
  }, [center, map]);
  return null;
}

function MapEvents({ onCenterChange }: { onCenterChange: (center: [number, number]) => void }) {
  useMapEvents({
    moveend: (e) => {
      const c = e.target.getCenter();
      onCenterChange([c.lat, c.lng]);
    },
  });
  return null;
}

function StationPopupCard({ station }: { station: Station }) {
  const navigate = useNavigate();
  const [lng, lat] = station.location.coordinates;
  const avail = station.isOpen && station.availablePorts > 0;
  const minPrice = station.pricing?.length
    ? Math.min(...station.pricing.map((p) => p.priceperKWh))
    : 0;
  const sym = station.pricing?.[0]?.currency === "INR" ? "₹" : "$";
  const avgRating = station.reviews?.length
    ? (station.reviews.reduce((s, r) => s + r.rating, 0) / station.reviews.length).toFixed(1)
    : null;

  const gradBg = "linear-gradient(135deg,oklch(0.68 0.19 148),oklch(0.78 0.17 152))";

  return (
    <div style={{ width: 260, fontFamily: "inherit", borderRadius: 20, overflow: "hidden" }}>
      {/* Header */}
      <div style={{ background: gradBg, padding: "12px 14px", display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ width: 40, height: 40, borderRadius: 12, background: "rgba(255,255,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, overflow: "hidden" }}>
          {station.Images?.[0]
            ? <img src={station.Images[0]} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            : <Zap size={18} color="white" fill="white" />}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontWeight: 800, color: "white", fontSize: 13, margin: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{station.name}</p>
          <p style={{ color: "rgba(255,255,255,0.75)", fontSize: 11, margin: 0 }}>{station.address?.city}</p>
        </div>
        <span style={{ background: avail ? "#10b981" : "rgba(255,255,255,0.25)", color: "white", borderRadius: 20, padding: "2px 8px", fontSize: 10, fontWeight: 700, flexShrink: 0 }}>
          {avail ? `${station.availablePorts} free` : station.isOpen ? "Full" : "Closed"}
        </span>
      </div>

      {/* Stats */}
      <div style={{ display: "flex", borderBottom: "1px solid #f1f5f9", background: "white" }}>
        <div style={{ flex: 1, padding: "8px 4px", textAlign: "center", borderRight: "1px solid #f1f5f9" }}>
          <p style={{ fontWeight: 800, color: "oklch(0.68 0.19 148)", fontSize: 14, margin: 0 }}>{sym}{minPrice}</p>
          <p style={{ color: "#94a3b8", fontSize: 10, margin: 0 }}>per kWh</p>
        </div>
        {avgRating && (
          <div style={{ flex: 1, padding: "8px 4px", textAlign: "center", borderRight: "1px solid #f1f5f9", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
            <p style={{ fontWeight: 800, color: "#f59e0b", fontSize: 14, margin: 0, display: "flex", alignItems: "center", gap: 2 }}>
              <Star size={11} fill="#f59e0b" color="#f59e0b" /> {avgRating}
            </p>
            <p style={{ color: "#94a3b8", fontSize: 10, margin: 0 }}>rating</p>
          </div>
        )}
        {station.distanceKm !== undefined && (
          <div style={{ flex: 1, padding: "8px 4px", textAlign: "center", background: "white" }}>
            <p style={{ fontWeight: 800, color: "#1e293b", fontSize: 14, margin: 0 }}>
              {station.distanceKm < 1 ? `${(station.distanceKm * 1000).toFixed(0)}m` : `${station.distanceKm.toFixed(1)}km`}
            </p>
            <p style={{ color: "#94a3b8", fontSize: 10, margin: 0 }}>away</p>
          </div>
        )}
      </div>

      {/* Actions */}
      <div style={{ padding: 10, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, background: "white" }}>
        <button
          disabled={!station.isOpen}
          onClick={() => navigate({ to: "/stations/$stationId", params: { stationId: station._id } })}
          style={{ height: 36, background: station.isOpen ? gradBg : "#e2e8f0", color: station.isOpen ? "white" : "#94a3b8", border: "none", borderRadius: 10, fontWeight: 800, fontSize: 12, cursor: station.isOpen ? "pointer" : "not-allowed" }}
        >
          Book Now
        </button>
        <button
          onClick={() => window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`, "_blank")}
          style={{ height: 36, border: "1.5px solid #e2e8f0", borderRadius: 10, background: "white", fontSize: 12, fontWeight: 600, color: "#475569", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}
        >
          <Navigation size={12} /> Directions
        </button>
      </div>
    </div>
  );
}

function StationMarker({
  station,
  isSelected,
  onSelect,
}: {
  station: Station;
  isSelected: boolean;
  onSelect: (s: Station) => void;
}) {
  const [lng, lat] = station.location.coordinates;
  const avail = station.isOpen && station.availablePorts > 0;
  const markerRef = useRef<L.Marker | null>(null);
  const [localHover, setLocalHover] = useState(false);
  const active = localHover || isSelected;
  const icon = useMemo(() => stationIcon(avail, active), [avail, active]);

  useEffect(() => {
    if (isSelected && markerRef.current) {
      markerRef.current.openPopup();
    }
  }, [isSelected]);

  return (
    <Marker
      ref={(m) => { markerRef.current = m; }}
      position={[lat, lng]}
      icon={icon}
      eventHandlers={{
        mouseover: () => { setLocalHover(true); markerRef.current?.openPopup(); },
        mouseout: () => setLocalHover(false),
        click: () => onSelect(station),
      }}
    >
      <Popup className="ev-station-popup" closeButton={false} autoPan keepInView minWidth={260} maxWidth={260}>
        <StationPopupCard station={station} />
      </Popup>
    </Marker>
  );
}

export default function StationsMapInner({
  center,
  stations,
  onSelect,
  selectedId,
  onCenterChange,
  userLocation,
}: {
  center: [number, number];
  stations: Station[];
  onSelect: (s: Station) => void;
  selectedId?: string | null;
  onCenterChange?: (center: [number, number]) => void;
  userLocation?: [number, number] | null;
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
      center={center}
      zoom={13}
      className="h-full w-full"
      ref={(m) => { mapRef.current = m; }}
      zoomControl={false}
    >
      <TileLayer attribution="&copy; OpenStreetMap" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      <FlyTo center={center} />
      {onCenterChange && <MapEvents onCenterChange={onCenterChange} />}
      {userLocation && <Marker position={userLocation} icon={userIcon} />}
      {stations.map((s) => (
        <StationMarker key={s._id} station={s} isSelected={selectedId === s._id} onSelect={onSelect} />
      ))}
    </MapContainer>
  );
}
