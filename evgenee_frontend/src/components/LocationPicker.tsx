import { useEffect, useMemo, useRef } from "react";
import L from "leaflet";
import { MapContainer, TileLayer, Marker, useMapEvents } from "react-leaflet";
import { renderToStaticMarkup } from "react-dom/server";
import { MapPin } from "lucide-react";

interface LocationPickerProps {
  lat: number;
  lng: number;
  onChange: (lat: number, lng: number) => void;
}

const DEFAULT_CENTER: [number, number] = [28.6139, 77.209]; // New Delhi

function makeMarkerIcon() {
  const svg = renderToStaticMarkup(<MapPin size={32} fill="#ef4444" color="white" strokeWidth={1.5} />);
  return L.divIcon({
    className: "bg-transparent border-0",
    html: `<div style="transform: translate(-50%, -100%); width: 32px; height: 32px;">${svg}</div>`,
    iconSize: [0, 0],
    iconAnchor: [0, 0],
  });
}

function LocationMarker({ lat, lng, onChange }: LocationPickerProps) {
  const markerRef = useRef<L.Marker>(null);
  const icon = useMemo(() => makeMarkerIcon(), []);

  // Update on map click
  useMapEvents({
    click(e) {
      onChange(e.latlng.lat, e.latlng.lng);
    },
  });

  const eventHandlers = useMemo(
    () => ({
      dragend() {
        const marker = markerRef.current;
        if (marker != null) {
          const { lat, lng } = marker.getLatLng();
          onChange(lat, lng);
        }
      },
    }),
    [onChange]
  );

  return (
    <Marker
      draggable={true}
      eventHandlers={eventHandlers}
      position={[lat, lng]}
      ref={markerRef}
      icon={icon}
    />
  );
}

export function LocationPicker({ lat, lng, onChange }: LocationPickerProps) {
  // If lat/lng are 0 or NaN, use default center but don't call onChange (so it stays empty in form until clicked)
  const center: [number, number] = lat && lng ? [lat, lng] : DEFAULT_CENTER;

  return (
    <div className="h-64 w-full rounded-xl overflow-hidden border border-border relative z-0">
      <MapContainer
        center={center}
        zoom={13}
        scrollWheelZoom={true}
        style={{ height: "100%", width: "100%", zIndex: 1 }}
      >
        <TileLayer
          attribution='&copy; <a href="https://osm.org/copyright">OSM</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {lat && lng ? <LocationMarker lat={lat} lng={lng} onChange={onChange} /> : (
          <ClickToSetInitial onChange={onChange} />
        )}
      </MapContainer>
      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-black/70 text-white text-[10px] px-3 py-1 rounded-full z-[1000] pointer-events-none backdrop-blur-md">
        Click or drag pin to set location
      </div>
    </div>
  );
}

function ClickToSetInitial({ onChange }: { onChange: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onChange(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}
