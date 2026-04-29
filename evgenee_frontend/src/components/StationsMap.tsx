import { lazy, Suspense } from "react";
import type { Station } from "@/lib/api";
import { Loader2 } from "lucide-react";

const InnerMap = lazy(() => import("./StationsMapInner"));

export type NavigateFn = (opts: { to: string; params?: Record<string, string> }) => void;

export function StationsMap(props: {
  center: [number, number];
  stations: Station[];
  onSelect: (s: Station) => void;
  onDeselect: () => void;
  selectedId?: string | null;
  onCenterChange?: (center: [number, number]) => void;
  userLocation?: [number, number] | null;
  navigate: NavigateFn;
}) {
  if (typeof window === "undefined") return <div className="h-full w-full bg-muted" />;
  return (
    <Suspense fallback={<div className="h-full w-full grid place-items-center bg-muted"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>}>
      <InnerMap {...props} />
    </Suspense>
  );
}
