import { useEffect, useMemo, useRef } from "react";
import L from "leaflet";
import { MapContainer, TileLayer, Marker, useMap } from "react-leaflet";
import type { Station } from "@/lib/api";
import { Zap } from "lucide-react";
import { renderToStaticMarkup } from "react-dom/server";

delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl;

const stationIcon = (avail: boolean) =>
  L.divIcon({
    className: "",
    html: `<div class="ev-pin ${avail ? "" : "unavail"}">${renderToStaticMarkup(
      <Zap size={18} fill="white" />
    )}</div>`,
    iconSize: [36, 36],
    iconAnchor: [18, 36],
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
    map.flyTo(center, 13, { duration: 0.8 });
  }, [center, map]);
  return null;
}

export default function StationsMapInner({
  center,
  stations,
  onSelect,
  selectedId,
}: {
  center: [number, number];
  stations: Station[];
  onSelect: (s: Station) => void;
  selectedId?: string | null;
}) {
  const mapRef = useRef<L.Map | null>(null);

  const markers = useMemo(
    () =>
      stations.map((s) => {
        const [lng, lat] = s.location.coordinates;
        const avail = s.isOpen && s.availablePorts > 0;
        return (
          <Marker
            key={s._id}
            position={[lat, lng]}
            icon={stationIcon(avail)}
            eventHandlers={{ click: () => onSelect(s) }}
          />
        );
      }),
    [stations, onSelect]
  );

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
      ref={(m) => {
        mapRef.current = m;
      }}
      zoomControl={false}
    >
      <TileLayer
        attribution="&copy; OpenStreetMap"
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <FlyTo center={center} />
      <Marker position={center} icon={userIcon} />
      {markers}
    </MapContainer>
  );
}
