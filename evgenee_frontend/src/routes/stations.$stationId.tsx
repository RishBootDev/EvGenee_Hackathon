import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { BookingsAPI, StationsAPI, PaymentAPI, type Station } from "@/lib/api";
import { socket } from "@/lib/socket";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  Loader2,
  MapPin,
  Phone,
  Star,
  Zap,
  Navigation,
  Send,
  LayoutDashboard,
} from "lucide-react";
import { toast } from "sonner";
import { cn, formatCurrency, getApiError } from "@/lib/utils";
import { format } from "date-fns";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/stations/$stationId")({
  component: StationDetail,
});

type Slot = { startTime: string; endTime: string; isAvailable: boolean; availablePorts: number };

function StationDetail() {
  const { stationId } = Route.useParams();
  const { user } = useAuth();
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

  // Review states
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState("");
  const [reviewing, setReviewing] = useState(false);

  const submitReview = async () => {
    if (!reviewComment.trim()) return;
    setReviewing(true);
    try {
      await StationsAPI.review(stationId, {
        rating: reviewRating,
        comment: reviewComment,
      });
      toast.success("Review added!");
      setReviewComment("");
      setReviewRating(5);
      // Refresh station data
      const r = await StationsAPI.details(stationId);
      setStation(r.data?.data);
    } catch (e) {
      toast.error(getApiError(e, "Failed to add review"));
    } finally {
      setReviewing(false);
    }
  };

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
        const r = await BookingsAPI.availability({
          stationId,
          date,
          ...(connector ? { connectorType: connector } : {}),
        });
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
        setStation((prev) => (prev ? { ...prev, ...data.updates } : null));
      }
    };

    const onAvailabilityUpdate = (data: any) => {
      if (data.stationId === stationId) {
        const d = new Date(data.date).toISOString().split("T")[0];
        if (d === date) {
          BookingsAPI.availability({
            stationId,
            date,
            ...(connector ? { connectorType: connector } : {}),
          })
            .then((r) => setSlots(r.data?.data?.slots ?? []))
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
    // Calculate total cost to initialize payment
    const pricing =
      station?.pricing?.find((p) => p.connectorType === connector) || station?.pricing?.[0];
    const pricePerKWh = pricing?.priceperKWh || 0;
    const currency = pricing?.currency || "INR";

    // Duration in hours
    const startH = parseInt(selectedSlot.startTime.split(":")[0]);
    const startM = parseInt(selectedSlot.startTime.split(":")[1]);
    const endH = parseInt(endTime.split(":")[0]);
    const endM = parseInt(endTime.split(":")[1]);
    const durationHours = endH + endM / 60 - (startH + startM / 60);

    const estimatedKWh = station
      ? parseFloat((station.chargingSpeed * durationHours).toFixed(2))
      : 0;
    const totalCost = parseFloat((estimatedKWh * pricePerKWh).toFixed(2));
    const platformFee = station
      ? parseFloat(((totalCost * station.platformFee) / 100).toFixed(2))
      : 0;
    const grandTotal = parseFloat((totalCost + platformFee).toFixed(2));
    const advancePayment = parseFloat((grandTotal * 0.2).toFixed(2));

    setBooking(true);

    try {
      await BookingsAPI.validate({
        station: stationId,
        connectorType: connector,
        date,
        startTime: selectedSlot.startTime,
        endTime,
        vehicleNumber,
      });
    } catch (e) {
      toast.error(getApiError(e, "Slot no longer available or overlapping booking exists."));
      setBooking(false);
      return;
    }

    const executeBooking = async () => {
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
        setBooking(false);
      }
    };

    if (advancePayment > 0) {
      if (!(window as any).Razorpay) {
        toast.error(
          "Payment gateway could not be loaded. Please check your internet connection or disable ad-blockers.",
        );
        setBooking(false);
        return;
      }

      try {
        const orderRes = await PaymentAPI.createOrder({ amount: advancePayment, currency });
        const order = orderRes.data;

        const options = {
          key: import.meta.env.VITE_RAZORPAY_KEY_ID || "",
          amount: order.amount,
          currency: order.currency,
          name: "EvGenee Charging",
          description: "Booking at " + station?.name,
          order_id: order.id,
          handler: async function (response: any) {
            try {
              await PaymentAPI.updatePayment({
                orderId: order.id,
                paymentId: response.razorpay_payment_id,
                status: "paid",
              });
              await executeBooking();
            } catch (err) {
              toast.error("Failed to verify payment");
              setBooking(false);
            }
          },
          prefill: {
            name: user?.name || "EvGenee User",
            email: user?.email || "user@example.com",
            contact: "",
          },
          theme: {
            color: "#22c55e",
          },
          modal: {
            ondismiss: function () {
              toast.error("Payment cancelled");
              setBooking(false);
            },
          },
        };

        const rzp = new (window as any).Razorpay(options);
        rzp.on("payment.failed", function (response: any) {
          toast.error("Payment Failed: " + response.error.description);
          setBooking(false);
        });
        rzp.open();
      } catch (e) {
        toast.error(getApiError(e, "Failed to initiate payment. Please try again."));
        setBooking(false);
      }
    } else {
      await executeBooking();
    }
  };

  if (loading) {
    return (
      <div className="h-screen grid place-items-center">
        <Loader2 className="h-7 w-7 animate-spin text-primary" />
      </div>
    );
  }
  if (!station) return <div className="p-6">Station not found</div>;

  const avgRating = station.reviews?.length
    ? station.reviews.reduce((s, r) => s + r.rating, 0) / station.reviews.length
    : 0;
  const currency = station.pricing?.[0]?.currency ?? "INR";
  const minPrice = station.pricing?.length
    ? Math.min(...station.pricing.map((p) => p.priceperKWh))
    : 0;
  const [lng, lat] = station.location.coordinates;

  const isMyStation =
    station &&
    user &&
    (typeof station.ownerofStation === "string"
      ? station.ownerofStation === user.id
      : station.ownerofStation._id === user.id);

  return (
    <div className="max-w-2xl mx-auto pb-8">
      {/* Hero */}
      <div className="relative h-56 bg-[image:var(--gradient-primary)] overflow-hidden">
        {station.Images?.[0] && (
          <img
            src={station.Images[0]}
            alt={station.name}
            className="absolute inset-0 h-full w-full object-cover opacity-90"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
        <button
          onClick={() => nav({ to: "/" })}
          className="absolute top-4 left-4 h-10 w-10 rounded-full bg-card/95 grid place-items-center"
          style={{ marginTop: "var(--safe-top)" }}
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="absolute bottom-4 left-4 right-4 text-white">
          <Badge className="bg-success text-success-foreground mb-2">
            {station.isOpen ? "OPEN" : "CLOSED"}
          </Badge>
          <h1 className="text-2xl font-bold">{station.name}</h1>
          <p className="text-sm opacity-90 flex items-center gap-1">
            <MapPin className="h-3.5 w-3.5" /> {station.address.street}, {station.address.city}
          </p>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Quick stats row matching ref design */}
        <div className="bg-card border-2 border-destructive/20 rounded-2xl p-4 grid grid-cols-3 gap-2 shadow-[var(--shadow-card)]">
          <div className="text-center border-r border-border">
            <p className="text-destructive font-bold text-sm">
              {station.typeOfConnectors[0] ?? "—"}
            </p>
            <p className="text-xs text-muted-foreground">Connection</p>
          </div>
          <div className="text-center border-r border-border">
            <p className="text-destructive font-bold text-sm">
              {formatCurrency(minPrice, currency)}
            </p>
            <p className="text-xs text-muted-foreground">Per kWh</p>
          </div>
          <div className="text-center">
            <p className="text-destructive font-bold text-sm">{station.platformFee}%</p>
            <p className="text-xs text-muted-foreground">Platform Fee</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 text-sm">
          <InfoRow
            icon={<Zap className="h-4 w-4" />}
            label={`${station.chargingSpeed} kW`}
            sub="Speed"
          />
          <InfoRow
            icon={<MapPin className="h-4 w-4" />}
            label={`${station.availablePorts}/${station.totalPorts} ports`}
            sub={station.openingHours}
          />
          <InfoRow
            icon={<Phone className="h-4 w-4" />}
            label={station.contactInfo.phoneNumber}
            sub="Contact"
          />
          <InfoRow
            icon={<Star className="h-4 w-4" />}
            label={avgRating ? avgRating.toFixed(1) : "—"}
            sub={`${station.reviews?.length ?? 0} reviews`}
          />
        </div>

        {/* Booking section */}
        {isMyStation ? (
          <div className="bg-card rounded-2xl p-6 text-center shadow-[var(--shadow-card)] space-y-3">
            <LayoutDashboard className="h-10 w-10 mx-auto text-primary" />
            <h2 className="font-bold text-lg">Your Station</h2>
            <p className="text-sm text-muted-foreground pb-2">
              As the owner, you can manage bookings and settings from your dashboard.
            </p>
            <Button
              onClick={() => nav({ to: "/owner/stations/$stationId", params: { stationId } })}
              className="w-full bg-[image:var(--gradient-primary)] text-primary-foreground font-bold tracking-tight"
            >
              VIEW BOOKINGS DASHBOARD
            </Button>
          </div>
        ) : (
          <div className="bg-card rounded-2xl p-4 shadow-[var(--shadow-card)] space-y-4">
            <h2 className="font-bold text-lg">Book a Slot</h2>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Date</Label>
                <Input
                  type="date"
                  value={date}
                  min={format(new Date(), "yyyy-MM-dd")}
                  onChange={(e) => setDate(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Connector</Label>
                <Select value={connector} onValueChange={setConnector}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    {station.typeOfConnectors.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
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
                    onClick={() => {
                      setSelectedSlot(s);
                      if (!endTime) setEndTime(s.endTime);
                    }}
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
                {slots.length === 0 && (
                  <p className="col-span-4 text-sm text-muted-foreground py-4 text-center">
                    No slots
                  </p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>End time</Label>
                <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Vehicle no.</Label>
                <Input
                  placeholder="DL 1A 1234"
                  value={vehicleNumber}
                  onChange={(e) => setVehicleNumber(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  sessionStorage.setItem("pendingDirections", stationId);
                  nav({ to: "/" });
                }}
              >
                <Navigation className="h-4 w-4 mr-1" /> Navigate
              </Button>
              <Button
                onClick={submitBooking}
                disabled={booking || !selectedSlot}
                className="bg-[image:var(--gradient-primary)] text-primary-foreground shadow-[var(--shadow-glow)] font-semibold"
              >
                {booking ? <Loader2 className="h-4 w-4 animate-spin" /> : "PAY 20% ADVANCE"}
              </Button>
            </div>
          </div>
        )}

        {/* Reviews */}
        <div className="bg-card rounded-2xl p-4 shadow-[var(--shadow-card)] space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold">Reviews</h3>
            {avgRating > 0 && (
              <div className="flex items-center gap-1 text-warning text-sm font-bold">
                <Star className="h-4 w-4 fill-current" />
                {avgRating.toFixed(1)}
              </div>
            )}
          </div>

          <div className="space-y-3">
            {station.reviews?.slice(0, 5).map((r, i) => (
              <div key={i} className="border-b border-border last:border-0 pb-2 last:pb-0">
                <div className="flex items-center gap-1 text-warning mb-1">
                  {Array.from({ length: 5 }).map((_, k) => (
                    <Star
                      key={k}
                      className={`h-3 w-3 ${k < r.rating ? "fill-current" : "opacity-30"}`}
                    />
                  ))}
                </div>
                <p className="text-sm">{r.comment}</p>
              </div>
            ))}
            {(!station.reviews || station.reviews.length === 0) && (
              <p className="text-sm text-muted-foreground text-center py-2">
                No reviews yet. Be the first!
              </p>
            )}
          </div>

          {/* Add Review Form */}
          <div className="pt-4 border-t border-border">
            <p className="text-sm font-bold mb-3">Leave a Review</p>
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setReviewRating(star)}
                    className="transition-transform active:scale-90"
                  >
                    <Star
                      className={`h-6 w-6 ${
                        star <= reviewRating
                          ? "text-warning fill-current"
                          : "text-muted-foreground opacity-30"
                      }`}
                    />
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <Input
                  placeholder="Share your experience..."
                  value={reviewComment}
                  onChange={(e) => setReviewComment(e.target.value)}
                  className="bg-accent/50 border-0 focus-visible:ring-1"
                />
                <Button
                  size="icon"
                  onClick={submitReview}
                  disabled={reviewing || !reviewComment.trim()}
                  className="shrink-0 bg-[image:var(--gradient-primary)]"
                >
                  {reviewing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>

        <Link to="/bookings" className="block text-center text-sm text-primary font-semibold py-2">
          View my bookings →
        </Link>
      </div>
    </div>
  );
}

function InfoRow({ icon, label, sub }: { icon: React.ReactNode; label: string; sub: string }) {
  return (
    <div className="bg-card border border-border rounded-xl p-3 flex items-center gap-2.5">
      <div className="h-9 w-9 rounded-full bg-accent grid place-items-center text-primary">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="font-semibold text-sm truncate">{label}</p>
        <p className="text-xs text-muted-foreground truncate">{sub}</p>
      </div>
    </div>
  );
}
