import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  X,
  Car,
  Bike,
  User,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Loader2,
  Clock,
  Route,
} from "lucide-react";
import type { Station } from "@/lib/api";

export type TransportMode = "driving" | "walking" | "cycling";

export interface OsrmStep {
  distance: number;
  duration: number;
  name: string;
  maneuver: { type: string; modifier?: string; location: [number, number] };
}

export interface RouteOption {
  distanceKm: number;
  durationMin: number;
  steps: OsrmStep[];
  coords: [number, number][];
}

export interface DirectionsPanelProps {
  station: Station;
  userLocation: [number, number];
  mode: TransportMode;
  onModeChange: (m: TransportMode) => void;
  routes: RouteOption[];
  selectedIdx: number;
  onSelectRoute: (i: number) => void;
  loading: boolean;
  onClose: () => void;
  onStart: () => void;
}

// ── helpers ───────────────────────────────────────────────────────────────────
export function fmtDist(km: number) {
  return km < 1 ? `${(km * 1000).toFixed(0)} m` : `${km.toFixed(1)} km`;
}
export function fmtTime(min: number) {
  if (min < 60) return `${min} min`;
  return `${Math.floor(min / 60)} hr ${min % 60} min`;
}

export function stepIcon(type: string, mod?: string): string {
  if (type === "depart") return "▶";
  if (type === "arrive") return "⬤";
  if (type === "roundabout" || type === "rotary") return "↻";
  if (mod === "uturn") return "↩";
  if (mod === "sharp left" || mod === "left") return "←";
  if (mod === "sharp right" || mod === "right") return "→";
  if (mod === "slight left") return "↖";
  if (mod === "slight right") return "↗";
  return "↑";
}

export function stepLabel(type: string, mod?: string, name?: string): string {
  const road = name && name !== "" ? ` onto ${name}` : "";
  if (type === "depart") return "Start" + (name ? ` on ${name}` : "");
  if (type === "arrive") return "Arrive at destination";
  if (type === "roundabout" || type === "rotary") return `Take roundabout${road}`;
  if (mod === "uturn") return "Make a U-turn";
  if (mod === "sharp left") return `Sharp left${road}`;
  if (mod === "left") return `Turn left${road}`;
  if (mod === "slight left") return `Keep left${road}`;
  if (mod === "sharp right") return `Sharp right${road}`;
  if (mod === "right") return `Turn right${road}`;
  if (mod === "slight right") return `Keep right${road}`;
  if (name) return `Continue on ${name}`;
  return "Continue";
}

const MODES: { key: TransportMode; label: string; Icon: React.ElementType }[] = [
  { key: "driving", label: "Drive", Icon: Car },
  { key: "walking", label: "Walk", Icon: User },
  { key: "cycling", label: "Cycle", Icon: Bike },
];

const ROUTE_LABELS = ["Fastest", "Alternative", "Scenic"];

// ── component ─────────────────────────────────────────────────────────────────
export default function DirectionsPanel({
  station,
  mode,
  onModeChange,
  routes,
  selectedIdx,
  onSelectRoute,
  loading,
  onClose,
  onStart,
}: DirectionsPanelProps) {
  const [stepsOpen, setStepsOpen] = useState(false);
  const sel = routes[selectedIdx];
  const [lng, lat] = station.location.coordinates;

  // reset steps view when mode changes
  useEffect(() => setStepsOpen(false), [mode]);

  const panelStyle: React.CSSProperties = {
    position: "fixed",
    top: 12,
    left: 12,
    width: "min(370px, calc(100vw - 24px))",
    maxHeight: "calc(100vh - 24px)",
    overflowY: "auto",
    zIndex: 99999,
    background: "#0a0f1a",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 20,
    boxShadow: "0 20px 60px rgba(0,0,0,0.7)",
    fontFamily: "system-ui,sans-serif",
    scrollbarWidth: "none",
  };

  const panel = (
    <div style={panelStyle}>
      {/* ── Header ── */}
      <div
        style={{
          padding: "14px 16px 10px",
          display: "flex",
          alignItems: "center",
          gap: 10,
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          position: "sticky",
          top: 0,
          background: "#0a0f1a",
          zIndex: 1,
        }}
      >
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: 8,
            background: "rgba(59,130,246,0.12)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Route size={15} color="#3b82f6" />
        </div>
        <p style={{ margin: 0, fontWeight: 800, fontSize: 15, color: "#fff", flex: 1 }}>
          Directions
        </p>
        <button
          onClick={onClose}
          style={{
            width: 30,
            height: 30,
            borderRadius: 8,
            border: "1px solid rgba(255,255,255,0.1)",
            background: "rgba(255,255,255,0.05)",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "rgba(255,255,255,0.5)",
          }}
        >
          <X size={14} />
        </button>
      </div>

      {/* ── From / To ── */}
      <div style={{ padding: "12px 16px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 3,
              flexShrink: 0,
            }}
          >
            <div
              style={{
                width: 10,
                height: 10,
                borderRadius: "50%",
                background: "#8b5cf6",
                border: "2px solid #7c3aed",
              }}
            />
            <div
              style={{
                width: 1.5,
                height: 22,
                background: "rgba(255,255,255,0.15)",
                borderRadius: 2,
              }}
            />
            <div
              style={{
                width: 10,
                height: 10,
                borderRadius: "50%",
                background: "#3b82f6",
                border: "2px solid #2563eb",
              }}
            />
          </div>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
            <div
              style={{
                background: "rgba(255,255,255,0.05)",
                borderRadius: 10,
                padding: "7px 12px",
              }}
            >
              <p
                style={{
                  margin: 0,
                  fontSize: 12,
                  color: "rgba(255,255,255,0.45)",
                  fontWeight: 500,
                }}
              >
                From
              </p>
              <p style={{ margin: 0, fontSize: 13, color: "#fff", fontWeight: 600 }}>
                Your Location
              </p>
            </div>
            <div
              style={{
                background: "rgba(59,130,246,0.08)",
                border: "1px solid rgba(59,130,246,0.2)",
                borderRadius: 10,
                padding: "7px 12px",
              }}
            >
              <p
                style={{ margin: 0, fontSize: 12, color: "rgba(59,130,246,0.6)", fontWeight: 500 }}
              >
                To
              </p>
              <p
                style={{
                  margin: 0,
                  fontSize: 13,
                  color: "#3b82f6",
                  fontWeight: 700,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {station.name}
              </p>
              <p style={{ margin: "1px 0 0", fontSize: 11, color: "rgba(255,255,255,0.35)" }}>
                {station.address?.city}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Transport mode tabs ── */}
      <div
        style={{
          padding: "10px 16px",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          display: "flex",
          gap: 8,
        }}
      >
        {MODES.map(({ key, label, Icon }) => {
          const active = mode === key;
          return (
            <button
              key={key}
              onClick={() => onModeChange(key)}
              style={{
                flex: 1,
                height: 38,
                borderRadius: 10,
                border: `1.5px solid ${active ? "#3b82f6" : "rgba(255,255,255,0.08)"}`,
                background: active ? "rgba(59,130,246,0.12)" : "rgba(255,255,255,0.03)",
                color: active ? "#3b82f6" : "rgba(255,255,255,0.4)",
                cursor: "pointer",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 2,
                transition: "all 0.15s",
              }}
            >
              <Icon size={14} />
              <span style={{ fontSize: 10, fontWeight: 700 }}>{label}</span>
            </button>
          );
        })}
      </div>

      {/* ── Loading ── */}
      {loading && (
        <div
          style={{
            padding: "28px 16px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 10,
          }}
        >
          <Loader2 size={24} color="#3b82f6" style={{ animation: "spin 1s linear infinite" }} />
          <p style={{ margin: 0, fontSize: 13, color: "rgba(255,255,255,0.45)" }}>
            Calculating routes…
          </p>
        </div>
      )}

      {/* ── Route cards ── */}
      {!loading && routes.length > 0 && (
        <div style={{ padding: "10px 16px", display: "flex", flexDirection: "column", gap: 8 }}>
          {routes.map((r, i) => {
            const active = i === selectedIdx;
            return (
              <button
                key={i}
                onClick={() => onSelectRoute(i)}
                style={{
                  width: "100%",
                  textAlign: "left",
                  padding: "11px 14px",
                  borderRadius: 12,
                  cursor: "pointer",
                  border: `1.5px solid ${active ? "#3b82f6" : "rgba(255,255,255,0.07)"}`,
                  background: active ? "rgba(59,130,246,0.08)" : "rgba(255,255,255,0.02)",
                  transition: "all 0.15s",
                }}
              >
                <div
                  style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}
                >
                  <div>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        color: active ? "#3b82f6" : "rgba(255,255,255,0.3)",
                        textTransform: "uppercase",
                        letterSpacing: 0.5,
                      }}
                    >
                      {ROUTE_LABELS[i] ?? `Route ${i + 1}`}
                    </span>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 4 }}>
                      <span
                        style={{
                          fontSize: 20,
                          fontWeight: 900,
                          color: active ? "#fff" : "rgba(255,255,255,0.4)",
                        }}
                      >
                        {fmtTime(r.durationMin)}
                      </span>
                      <span
                        style={{
                          fontSize: 13,
                          color: active ? "rgba(255,255,255,0.5)" : "rgba(255,255,255,0.25)",
                        }}
                      >
                        {fmtDist(r.distanceKm)}
                      </span>
                    </div>
                  </div>
                  {active && (
                    <button
                      onClick={onStart}
                      style={{
                        background: "#3b82f6",
                        borderRadius: 8,
                        padding: "4px 12px",
                        border: "none",
                        cursor: "pointer",
                      }}
                    >
                      <span style={{ fontSize: 11, fontWeight: 800, color: "#fff" }}>GO ▶</span>
                    </button>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* ── No route found ── */}
      {!loading && routes.length === 0 && (
        <div style={{ padding: "24px 16px", textAlign: "center" }}>
          <p style={{ margin: 0, fontSize: 13, color: "rgba(255,255,255,0.35)" }}>
            No route found for this mode.
          </p>
        </div>
      )}

      {/* ── Step by step ── */}
      {!loading && sel && sel.steps.length > 0 && (
        <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
          <button
            onClick={() => setStepsOpen((v) => !v)}
            style={{
              width: "100%",
              padding: "12px 16px",
              background: "none",
              border: "none",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <span
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: "rgba(255,255,255,0.5)",
                textTransform: "uppercase",
                letterSpacing: 0.5,
              }}
            >
              Step-by-step · {sel.steps.length} steps
            </span>
            {stepsOpen ? (
              <ChevronUp size={14} color="rgba(255,255,255,0.4)" />
            ) : (
              <ChevronDown size={14} color="rgba(255,255,255,0.4)" />
            )}
          </button>
          {stepsOpen && (
            <div
              style={{ padding: "0 16px 12px", display: "flex", flexDirection: "column", gap: 2 }}
            >
              {sel.steps.map((step, i) => {
                const icon = stepIcon(step.maneuver.type, step.maneuver.modifier);
                const label = stepLabel(step.maneuver.type, step.maneuver.modifier, step.name);
                const isLast = i === sel.steps.length - 1;
                return (
                  <div
                    key={i}
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 12,
                      padding: "8px 0",
                      borderBottom: isLast ? "none" : "1px solid rgba(255,255,255,0.04)",
                    }}
                  >
                    <div
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: 8,
                        background: "rgba(255,255,255,0.06)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                        fontSize: 12,
                        color: "#3b82f6",
                        fontWeight: 700,
                      }}
                    >
                      {icon}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p
                        style={{
                          margin: 0,
                          fontSize: 13,
                          color: "#fff",
                          fontWeight: 500,
                          lineHeight: 1.3,
                        }}
                      >
                        {label}
                      </p>
                      {step.distance > 0 && (
                        <p
                          style={{
                            margin: "2px 0 0",
                            fontSize: 11,
                            color: "rgba(255,255,255,0.3)",
                          }}
                        >
                          {fmtDist(step.distance / 1000)}
                          {step.duration > 0 && ` · ${fmtTime(Math.round(step.duration / 60))}`}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Footer: OSRM Attribution ── */}
      <div style={{ padding: "10px 16px 14px", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Clock size={13} color="rgba(255,255,255,0.3)" />
          <p style={{ margin: 0, fontSize: 11, color: "rgba(255,255,255,0.3)" }}>
            Route via OpenStreetMap · OSRM
          </p>
        </div>
      </div>
    </div>
  );

  if (typeof document === "undefined") return null;
  return createPortal(panel, document.body);
}
