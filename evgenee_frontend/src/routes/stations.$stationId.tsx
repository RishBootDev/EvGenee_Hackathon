import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { BookingsAPI, StationsAPI, type Station } from "@/lib/api";
import { socket } from "@/lib/socket";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Loader2, MapPin, Phone, Star, Zap, Navigation } from "lucide-react";
import { toast } from "sonner";
import { formatCurrency, getApiError } from "@/lib/utils";
import { format } from "date-fns";

export const Route = createFileRoute("/stations/$stationId")({
  component: StationDetail,
});

type Slot = { startTime: string; endTime: string; isAvailable: boolean; availablePorts: number };

function StationDetail() {
  const { stationId } = Route.useParams();
  const nav = useNavigate();
  const [station, setStation] = useState<Station | null>(null);
  const [loading, setLoading] = useState(true);
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [connector, setConnector] = useState("");
  const [slots, setSlots] = useState<Slot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [endTime, setEndTime] = useState("");
  const [vehicleNumber, setVehicleNumber] = useState("");
  const [booking, setBooking] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const r = await StationsAPI.details(stationId);
        const s: Station = r.data?.data;
        setStation(s);
        if (s?.typeOfConnectors?.[0]) setConnector(s.typeOfConnectors[0]);
      } catch (e) {
        toast.error(getApiError(e, "Failed to load station"));
      } finally {
        setLoading(false);
      }
    })();
  }, [stationId]);

  useEffect(() => {
    if (!station || !date) return;
    (async () => {
      try {
        const r = await BookingsAPI.availability({ stationId, date, ...(connector ? { connectorType: connector } : {}) });
        setSlots(r.data?.data?.slots ?? []);
        setSelectedSlot(null);
      } catch (e) {
        toast.error(getApiError(e, "Failed to load slots"));
      }
    })();
  }, [station, date, connector, stationId]);

  useEffect(() => {
    if (!stationId) return;

    socket.emit("station:subscribe", stationId);

    const onStationUpdate = (data: any) => {
      if (data.stationId === stationId && data.updates) {
        setStation((prev) => prev ? { ...prev, ...data.updates } : null);
      }
    };

    const onAvailabilityUpdate = (data: any) => {
      if (data.stationId === stationId) {
        const d = new Date(data.date).toISOString().split('T')[0];
        if (d === date) {
          BookingsAPI.availability({ stationId, date, ...(connector ? { connectorType: connector } : {}) })
            .then(r => setSlots(r.data?.data?.slots ?? []))
            .catch(console.error);
        }
      }
    };

    socket.on("station:updated", onStationUpdate);
    socket.on("availability:updated", onAvailabilityUpdate);

    return () => {
      socket.emit("station:unsubscribe", stationId);
      socket.off("station:updated", onStationUpdate);
      socket.off("availability:updated", onAvailabilityUpdate);
    };
  }, [stationId, date, connector]);

  const submitBooking = async () => {
    if (!selectedSlot || !endTime || !connector) {
      toast.error("Pick a start slot, end time, and connector");
      return;
    }
    if (endTime <= selectedSlot.startTime) {
      toast.error("End time must be after start time");
      return;
    }
    setBooking(true);
    try {
      const r = await BookingsAPI.create({
        station: stationId,
        connectorType: connector,
        date,
        startTime: selectedSlot.startTime,
        endTime,
        vehicleNumber,
      });
      const b = r.data?.data;
      toast.success("Booking confirmed!", { description: b?.otp });
      nav({ to: "/bookings" });
    } catch (e) {
      toast.error(getApiError(e, "Booking failed"));
    } finally {
      setBooking(false);
    }
  };

  if (loading) {
    return <div className="h-screen grid place-items-center"><Loader2 className="h-7 w-7 animate-spin text-primary" /></div>;
  }
  if (!station) return <div className="p-6">Station not found</div>;

  const avgRating = station.reviews?.length
    ? station.reviews.reduce((s, r) => s + r.rating, 0) / station.reviews.length
    : 0;
  const currency = station.pricing?.[0]?.currency ?? "INR";
  const minPrice = station.pricing?.length ? Math.min(...station.pricing.map((p) => p.priceperKWh)) : 0;
  const [lng, lat] = station.location.coordinates;

  return (
    <div className="max-w-2xl mx-auto pb-8">
      {/* Hero */}
      <div className="relative h-56 bg-[image:var(--gradient-primary)] overflow-hidden">
        {station.Images?.[0] && (
          <img src={station.Images[0]} alt={station.name} className="absolute inset-0 h-full w-full object-cover opacity-90" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
        <button onClick={() => nav({ to: "/" })} className="absolute top-4 left-4 h-10 w-10 rounded-full bg-card/95 grid place-items-center" style={{ marginTop: "var(--safe-top)" }}>
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="absolute bottom-4 left-4 right-4 text-white">
          <Badge className="bg-success text-success-foreground mb-2">{station.isOpen ? "OPEN" : "CLOSED"}</Badge>
          <h1 className="text-2xl font-bold">{station.name}</h1>
          <p className="text-sm opacity-90 flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {station.address.street}, {station.address.city}</p>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Quick stats row matching ref design */}
        <div className="bg-card border-2 border-destructive/20 rounded-2xl p-4 grid grid-cols-3 gap-2 shadow-[var(--shadow-card)]">
          <div className="text-center border-r border-border">
            <p className="text-destructive font-bold text-sm">{station.typeOfConnectors[0] ?? "—"}</p>
            <p className="text-xs text-muted-foreground">Connection</p>
          </div>
          <div className="text-center border-r border-border">
            <p className="text-destructive font-bold text-sm">{formatCurrency(minPrice, currency)}</p>
            <p className="text-xs text-muted-foreground">Per kWh</p>
          </div>
          <div className="text-center">
            <p className="text-destructive font-bold text-sm">{station.platformFee}%</p>
            <p className="text-xs text-muted-foreground">Platform Fee</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 text-sm">
          <InfoRow icon={<Zap className="h-4 w-4" />} label={`${station.chargingSpeed} kW`} sub="Speed" />
          <InfoRow icon={<MapPin className="h-4 w-4" />} label={`${station.availablePorts}/${station.totalPorts} ports`} sub={station.openingHours} />
          <InfoRow icon={<Phone className="h-4 w-4" />} label={station.contactInfo.phoneNumber} sub="Contact" />
          <InfoRow icon={<Star className="h-4 w-4" />} label={avgRating ? avgRating.toFixed(1) : "—"} sub={`${station.reviews?.length ?? 0} reviews`} />
        </div>

        {/* Booking section */}
        <div className="bg-card rounded-2xl p-4 shadow-[var(--shadow-card)] space-y-4">
          <h2 className="font-bold text-lg">Book a Slot</h2>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Date</Label>
              <Input type="date" value={date} min={format(new Date(), "yyyy-MM-dd")} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Connector</Label>
              <Select value={connector} onValueChange={setConnector}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  {station.typeOfConnectors.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label className="mb-2 block">Start time</Label>
            <div className="grid grid-cols-4 gap-2 max-h-52 overflow-y-auto">
              {slots.map((s) => (
                <button
                  key={s.startTime}
                  disabled={!s.isAvailable}
                  onClick={() => { setSelectedSlot(s); if (!endTime) setEndTime(s.endTime); }}
                  className={`text-xs font-medium py-2 rounded-xl border transition ${
                    selectedSlot?.startTime === s.startTime
                      ? "bg-[image:var(--gradient-primary)] text-primary-foreground border-transparent shadow-[var(--shadow-glow)]"
                      : s.isAvailable
                      ? "bg-card border-border hover:border-primary"
                      : "bg-muted text-muted-foreground border-border opacity-50 cursor-not-allowed"
                  }`}
                >
                  {s.startTime}
                </button>
              ))}
              {slots.length === 0 && <p className="col-span-4 text-sm text-muted-foreground py-4 text-center">No slots</p>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>End time</Label>
              <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Vehicle no.</Label>
              <Input placeholder="DL 1A 1234" value={vehicleNumber} onChange={(e) => setVehicleNumber(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" onClick={() => window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`, "_blank")}>
              <Navigation className="h-4 w-4 mr-1" /> Navigate
            </Button>
            <Button
              onClick={submitBooking}
              disabled={booking || !selectedSlot}
              className="bg-[image:var(--gradient-primary)] text-primary-foreground shadow-[var(--shadow-glow)] font-semibold"
            >
              {booking ? <Loader2 className="h-4 w-4 animate-spin" /> : "BOOK CHARGER"}
            </Button>
          </div>
        </div>

        {/* Reviews */}
        {station.reviews?.length > 0 && (
          <div className="bg-card rounded-2xl p-4 shadow-[var(--shadow-card)] space-y-3">
            <h3 className="font-bold">Reviews</h3>
            {station.reviews.slice(0, 5).map((r, i) => (
              <div key={i} className="border-b border-border last:border-0 pb-2 last:pb-0">
                <div className="flex items-center gap-1 text-warning">
                  {Array.from({ length: 5 }).map((_, k) => (
                    <Star key={k} className={`h-3.5 w-3.5 ${k < r.rating ? "fill-current" : "opacity-30"}`} />
                  ))}
                </div>
                <p className="text-sm mt-1">{r.comment}</p>
              </div>
            ))}
          </div>
        )}

        <Link to="/bookings" className="block text-center text-sm text-primary font-semibold py-2">View my bookings →</Link>
      </div>
    </div>
  );
}

function InfoRow({ icon, label, sub }: { icon: React.ReactNode; label: string; sub: string }) {
  return (
    <div className="bg-card border border-border rounded-xl p-3 flex items-center gap-2.5">
      <div className="h-9 w-9 rounded-full bg-accent grid place-items-center text-primary">{icon}</div>
      <div className="min-w-0">
        <p className="font-semibold text-sm truncate">{label}</p>
        <p className="text-xs text-muted-foreground truncate">{sub}</p>
      </div>
    </div>
  );
}
