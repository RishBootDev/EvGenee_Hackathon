import { lazy, Suspense } from "react";
import type { Station } from "@/lib/api";
import { Loader2 } from "lucide-react";

const InnerMap = lazy(() => import("./StationsMapInner"));

export function StationsMap(props: {
  center: [number, number];
  stations: Station[];
  onSelect: (s: Station) => void;
  selectedId?: string | null;
}) {
  if (typeof window === "undefined") {
    return <div className="h-full w-full bg-muted" />;
  }
  return (
    <Suspense fallback={<div className="h-full w-full grid place-items-center bg-muted"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>}>
      <InnerMap {...props} />
    </Suspense>
  );
}
