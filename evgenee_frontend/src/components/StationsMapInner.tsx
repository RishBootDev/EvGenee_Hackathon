import { useEffect, useMemo, useRef } from "react";
import L from "leaflet";
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from "react-leaflet";
import type { Station } from "@/lib/api";
import { Zap } from "lucide-react";
import { renderToStaticMarkup } from "react-dom/server";

delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl;

const stationIcon = (avail: boolean, hovered: boolean) =>
  L.divIcon({
    className: "",
    html: `<div class="ev-pin${avail ? "" : " unavail"}${hovered ? " hovered" : ""}">${renderToStaticMarkup(
      <Zap size={hovered ? 20 : 17} fill="white" />
    )}</div>`,
    iconSize: hovered ? [44, 44] : [36, 36],
    iconAnchor: hovered ? [22, 44] : [18, 36],
  });

const userIcon = L.divIcon({
  className: "",
  html: `<div class="ev-pin user animate-pulse-ring"></div>`,
  iconSize: [22, 22],
  iconAnchor: [11, 11],
});

function FlyTo({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    const current = map.getCenter();
    const target = L.latLng(center[0], center[1]);
    // Only fly if the distance is greater than 10 meters to avoid feedback loop
    if (current.distanceTo(target) > 10) {
      map.flyTo(center, 13, { duration: 0.8 });
    }
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

function StationMarker({
  station,
  isHovered,
  isSelected,
  onSelect,
  onHover,
}: {
  station: Station;
  isHovered: boolean;
  isSelected: boolean;
  onSelect: (s: Station) => void;
  onHover: (id: string | null) => void;
}) {
  const [lng, lat] = station.location.coordinates;
  const avail = station.isOpen && station.availablePorts > 0;
  const active = isHovered || isSelected;
  const icon = useMemo(() => stationIcon(avail, active), [avail, active]);

  return (
    <Marker
      key={station._id}
      position={[lat, lng]}
      icon={icon}
      eventHandlers={{
        click: () => onSelect(station),
        mouseover: () => onHover(station._id),
        mouseout: () => onHover(null),
      }}
    />
  );
}

export default function StationsMapInner({
  center,
  stations,
  onSelect,
  selectedId,
  hoveredId,
  onHover,
  onCenterChange,
  userLocation,
}: {
  center: [number, number];
  stations: Station[];
  onSelect: (s: Station) => void;
  selectedId?: string | null;
  hoveredId?: string | null;
  onHover?: (id: string | null) => void;
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
      <TileLayer
        attribution="&copy; OpenStreetMap"
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <FlyTo center={center} />
      {onCenterChange && <MapEvents onCenterChange={onCenterChange} />}
      {userLocation && <Marker position={userLocation} icon={userIcon} />}
      {stations.map((s) => (
        <StationMarker
          key={s._id}
          station={s}
          isHovered={hoveredId === s._id}
          isSelected={selectedId === s._id}
          onSelect={onSelect}
          onHover={onHover ?? (() => {})}
        />
      ))}
    </MapContainer>
  );
}
