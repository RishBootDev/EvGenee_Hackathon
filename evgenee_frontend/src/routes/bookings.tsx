import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { BookingsAPI, PaymentAPI, type Booking, type Station } from "@/lib/api";
import { socket } from "@/lib/socket";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Calendar,
  Clock,
  Loader2,
  MapPin,
  Zap,
  X,
  KeyRound,
  CheckCircle2,
  Eye,
  Info,
} from "lucide-react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faChargingStation } from "@fortawesome/free-solid-svg-icons";
import { toast } from "sonner";
import { formatCurrency, getApiError } from "@/lib/utils";
import { format } from "date-fns";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/bookings")({
  component: BookingsPage,
});

const statusColor: Record<string, string> = {
  confirmed: "bg-emerald-500/15 text-emerald-400 border border-emerald-500/20",
  "in-progress": "bg-blue-500/15 text-blue-400 border border-blue-500/20",
  completed: "bg-white/8 text-white/40 border border-white/10",
  cancelled: "bg-red-500/15 text-red-400 border border-red-500/20",
  pending: "bg-white/8 text-white/40 border border-white/10",
  "no-show": "bg-red-500/15 text-red-400 border border-red-500/20",
};

const iconColor: Record<string, string> = {
  confirmed: "from-green-600 to-green-400",
  "in-progress": "from-blue-600 to-blue-400",
  completed: "from-slate-600 to-slate-400",
  cancelled: "from-red-600 to-red-400",
  pending: "from-slate-600 to-slate-400",
  "no-show": "from-red-600 to-red-400",
};

function PendingCountdown({ createdAt }: { createdAt: string }) {
  const [timeLeft, setTimeLeft] = useState<number>(0);

  useEffect(() => {
    const calculateTimeLeft = () => {
      const created = new Date(createdAt).getTime();
      const expiresAt = created + 10 * 60 * 1000;
      const now = new Date().getTime();
      return Math.max(0, Math.floor((expiresAt - now) / 1000));
    };

    setTimeLeft(calculateTimeLeft());
    const interval = setInterval(() => {
      setTimeLeft(calculateTimeLeft());
    }, 1000);

    return () => clearInterval(interval);
  }, [createdAt]);

  const m = Math.floor(timeLeft / 60)
    .toString()
    .padStart(2, "0");
  const s = (timeLeft % 60).toString().padStart(2, "0");

  if (timeLeft === 0)
    return <span className="text-destructive font-bold text-[10px]">Expired</span>;
  return (
    <span className="text-destructive font-bold text-[10px] animate-pulse">
      ⏱ {m}:{s} left
    </span>
  );
}

function BookingsPage() {
  const { isAuthed, loading: authLoading } = useAuth();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("all");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const showDetails = async (id: string) => {
    setLoadingDetail(true);
    try {
      const r = await BookingsAPI.details(id);
      setSelectedBooking(r.data?.data);
    } catch (e) {
      toast.error(getApiError(e, "Failed to load details"));
    } finally {
      setLoadingDetail(false);
    }
  };

  const load = async () => {
    setLoading(true);
    try {
      const r = await BookingsAPI.my({ limit: 50 });
      setBookings(r.data?.data ?? []);
    } catch (e) {
      toast.error(getApiError(e, "Failed to load bookings"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthed) {
      load();
      const reload = () => load();
      socket.on("booking:created", reload);
      socket.on("booking:cancelled", reload);
      socket.on("booking:checkedIn", reload);
      socket.on("booking:completed", reload);
      socket.on("bookings:autoCompleted", reload);
      return () => {
        socket.off("booking:created", reload);
        socket.off("booking:cancelled", reload);
        socket.off("booking:checkedIn", reload);
        socket.off("booking:completed", reload);
        socket.off("bookings:autoCompleted", reload);
      };
    }
  }, [isAuthed]);

  if (authLoading)
    return (
      <div className="h-screen grid place-items-center bg-[#000814]">
        <Loader2 className="h-7 w-7 animate-spin text-primary" />
      </div>
    );
  if (!isAuthed) return <Navigate to="/auth/login" />;

  const filtered = bookings.filter((b) => {
    if (tab === "all") return true;
    if (tab === "active") return ["confirmed", "in-progress", "pending"].includes(b.status);
    if (tab === "history") return ["completed", "cancelled", "no-show"].includes(b.status);
    return true;
  });

  const cancel = async (b: Booking) => {
    setBusyId(b._id);
    try {
      const r = await BookingsAPI.cancel(b._id, { reason: "User cancelled" });
      toast.success(`Cancelled — ${r.data?.data?.cancellationPolicy ?? ""}`);
      load();
    } catch (e) {
      toast.error(getApiError(e, "Cancel failed"));
    } finally {
      setBusyId(null);
    }
  };

  const complete = async (b: Booking) => {
    setBusyId(b._id);

    const executeComplete = async () => {
      try {
        await BookingsAPI.complete(b._id);
        toast.success("Session completed! Remaining 80% paid.");
        setBusyId(null);
        load();
      } catch (e) {
        toast.error(getApiError(e, "Complete failed"));
        setBusyId(null);
      }
    };

    const remainingPayment = parseFloat((b.grandTotal * 0.8).toFixed(2));

    if (remainingPayment > 0) {
      try {
        const station = typeof b.station === "object" ? (b.station as Station) : null;
        const pricing =
          station?.pricing?.find((p) => p.connectorType === b.connectorType) ||
          station?.pricing?.[0];
        const currency = pricing?.currency || "INR";

        const orderRes = await PaymentAPI.createOrder({ amount: remainingPayment, currency });
        const order = orderRes.data;

        const options = {
          key: import.meta.env.VITE_RAZORPAY_KEY_ID || "",
          amount: order.amount,
          currency: order.currency,
          name: "EvGenee Charging",
          description: `Remaining payment for ${station?.name || "Booking"}`,
          order_id: order.id,
          handler: async function (response: any) {
            try {
              await PaymentAPI.updatePayment({
                orderId: order.id,
                paymentId: response.razorpay_payment_id,
                status: "paid",
              });
              await executeComplete();
            } catch (err) {
              toast.error("Failed to verify payment");
              setBusyId(null);
            }
          },
          prefill: {
            name: typeof b.user === "object" ? b.user.name : "EvGenee User",
            email: typeof b.user === "object" ? b.user.email : "user@example.com",
            contact: "9999999999",
          },
          theme: { color: "#22c55e" },
          modal: {
            ondismiss: function () {
              toast.error("Payment cancelled. Please pay to complete.");
              setBusyId(null);
            },
          },
        };

        const rzp = new (window as any).Razorpay(options);
        rzp.on("payment.failed", function (response: any) {
          toast.error(`Payment Failed: ${response.error.description}`);
          setBusyId(null);
        });
        rzp.open();
      } catch (e) {
        toast.error(getApiError(e, "Failed to initiate payment"));
        setBusyId(null);
      }
    } else {
      await executeComplete();
    }
  };

  const payAdvance = async (b: Booking) => {
    setBusyId(b._id);

    const executeConfirmAdvance = async () => {
      try {
        await BookingsAPI.confirmAdvance(b._id);
        toast.success("Advance paid! Booking confirmed.");
        setBusyId(null);
        load();
      } catch (e) {
        toast.error(getApiError(e, "Confirm failed"));
        setBusyId(null);
      }
    };

    const advancePayment = parseFloat((b.grandTotal * 0.2).toFixed(2));

    if (advancePayment > 0) {
      try {
        const station = typeof b.station === "object" ? (b.station as Station) : null;
        const pricing =
          station?.pricing?.find((p) => p.connectorType === b.connectorType) ||
          station?.pricing?.[0];
        const currency = pricing?.currency || "INR";

        const orderRes = await PaymentAPI.createOrder({ amount: advancePayment, currency });
        const order = orderRes.data;

        const options = {
          key: import.meta.env.VITE_RAZORPAY_KEY_ID || "",
          amount: order.amount,
          currency: order.currency,
          name: "EvGenee Charging",
          description: `Advance payment for ${station?.name || "Booking"}`,
          order_id: order.id,
          handler: async function (response: any) {
            try {
              await PaymentAPI.updatePayment({
                orderId: order.id,
                paymentId: response.razorpay_payment_id,
                status: "paid",
              });
              await executeConfirmAdvance();
            } catch (err) {
              toast.error("Failed to verify payment");
              setBusyId(null);
            }
          },
          prefill: {
            name: typeof b.user === "object" ? b.user.name : "EvGenee User",
            email: typeof b.user === "object" ? b.user.email : "user@example.com",
            contact: "9999999999",
          },
          theme: { color: "#22c55e" },
          modal: {
            ondismiss: function () {
              toast.error("Payment cancelled. Please pay to confirm.");
              setBusyId(null);
            },
          },
        };

        const rzp = new (window as any).Razorpay(options);
        rzp.on("payment.failed", function (response: any) {
          toast.error(`Payment Failed: ${response.error.description}`);
          setBusyId(null);
        });
        rzp.open();
      } catch (e) {
        toast.error(getApiError(e, "Failed to initiate payment"));
        setBusyId(null);
      }
    } else {
      await executeConfirmAdvance();
    }
  };

  return (
    <div className="min-h-screen bg-[#000814] text-white" style={{ paddingBottom: "5rem" }}>
      <div
        className="max-w-2xl mx-auto px-4 pt-8"
        style={{ paddingTop: "calc(var(--safe-top) + 2rem)" }}
      >
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-extrabold text-white tracking-tight mb-1">My Bookings</h1>
          <p className="text-sm text-white/40">Track and manage your charging sessions</p>
        </div>

        {/* Tabs */}
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="w-full grid grid-cols-3 bg-white/5 border border-white/8 rounded-xl p-1 mb-5">
            <TabsTrigger
              value="all"
              className="rounded-lg text-sm font-semibold data-[state=active]:bg-primary data-[state=active]:text-white text-white/40"
            >
              All
            </TabsTrigger>
            <TabsTrigger
              value="active"
              className="rounded-lg text-sm font-semibold data-[state=active]:bg-primary data-[state=active]:text-white text-white/40"
            >
              Active
            </TabsTrigger>
            <TabsTrigger
              value="history"
              className="rounded-lg text-sm font-semibold data-[state=active]:bg-primary data-[state=active]:text-white text-white/40"
            >
              History
            </TabsTrigger>
          </TabsList>

          <TabsContent value={tab} className="space-y-3">
            {loading ? (
              <div className="py-16 grid place-items-center">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-16">
                <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/8 grid place-items-center mx-auto mb-4">
                  <Calendar className="h-8 w-8 text-white/20" />
                </div>
                <p className="text-white/40 font-medium">No bookings yet</p>
                <p className="text-white/20 text-sm mt-1">
                  Your charging sessions will appear here
                </p>
              </div>
            ) : (
              filtered.map((b) => {
                const station = typeof b.station === "object" ? (b.station as Station) : null;
                const isBusy = busyId === b._id;
                const gradClass = iconColor[b.status] ?? "from-green-600 to-green-400";
                return (
                  <div
                    key={b._id}
                    className="bg-white/[0.04] border border-white/8 rounded-2xl p-4 space-y-3 hover:bg-white/[0.06] transition-colors"
                  >
                    {/* Station info + status */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div
                          className={`h-12 w-12 rounded-xl bg-gradient-to-br ${gradClass} grid place-items-center shrink-0`}
                        >
                          <FontAwesomeIcon
                            icon={faChargingStation}
                            className="h-5 w-5 text-white"
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-bold text-white truncate">
                            {station?.name ?? "Station"}
                          </p>
                          <p className="text-xs text-white/40 flex items-center gap-1 truncate mt-0.5">
                            <MapPin className="h-3 w-3 shrink-0" />
                            {station?.address?.city ?? ""}
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <span
                          className={`text-[11px] font-bold px-3 py-1 rounded-full uppercase tracking-wide shrink-0 ${statusColor[b.status]}`}
                        >
                          {b.status}
                        </span>
                        {b.status === "pending" && b.createdAt && (
                          <PendingCountdown createdAt={b.createdAt} />
                        )}
                      </div>
                    </div>

                    {/* Date/time row */}
                    <div className="flex items-center justify-between text-xs bg-white/[0.04] border border-white/6 rounded-xl px-3 py-2.5 text-white/50">
                      <span className="flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5" />
                        {format(new Date(b.date), "MMM d, yyyy")}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5" />
                        {b.startTime} – {b.endTime}
                      </span>
                    </div>

                    {/* Price + actions */}
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs text-white/30 mb-1">
                          {b.connectorType} · {b.estimatedKWh} kWh
                        </p>
                        <p className="text-xl font-extrabold text-white">
                          {formatCurrency(b.grandTotal)}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => showDetails(b._id)}
                          disabled={loadingDetail}
                          className="bg-white/5 border border-white/10 text-white/70 hover:bg-white/10 rounded-xl text-xs"
                        >
                          <Eye className="h-3.5 w-3.5 mr-1" />
                          Details
                        </Button>
                        {b.status === "confirmed" && (
                          <>
                            <Button
                              size="sm"
                              onClick={() => cancel(b)}
                              disabled={isBusy}
                              className="bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 rounded-xl text-xs"
                            >
                              <X className="h-3.5 w-3.5 mr-1" />
                              Cancel
                            </Button>
                          </>
                        )}
                        {b.status === "in-progress" && (
                          <Button
                            size="sm"
                            onClick={() => complete(b)}
                            disabled={isBusy}
                            className="bg-gradient-to-r from-green-600 to-green-400 text-white rounded-xl text-xs font-bold"
                          >
                            <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                            Pay Balance & Complete
                          </Button>
                        )}
                        {b.status === "pending" && (
                          <Button
                            size="sm"
                            onClick={() => payAdvance(b)}
                            disabled={isBusy}
                            className="bg-gradient-to-r from-red-600 to-red-400 text-white rounded-xl text-xs font-bold"
                          >
                            <Zap className="h-3.5 w-3.5 mr-1" />
                            Pay 20% Advance
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Booking Detail Modal */}
      <Dialog open={!!selectedBooking} onOpenChange={(o) => !o && setSelectedBooking(null)}>
        <DialogContent className="max-w-md rounded-2xl bg-[#0a1628] border border-white/10 text-white">
          <DialogHeader>
            <DialogTitle className="text-white">Booking Details</DialogTitle>
          </DialogHeader>
          {selectedBooking && (
            <div className="space-y-4 py-2">
              <div className="flex items-center gap-3">
                <div
                  className={`h-12 w-12 rounded-xl bg-gradient-to-br ${iconColor[selectedBooking.status] ?? "from-green-600 to-green-400"} grid place-items-center shrink-0`}
                >
                  <FontAwesomeIcon icon={faChargingStation} className="h-6 w-6 text-white" />
                </div>
                <div>
                  <p className="font-bold text-white">
                    {(selectedBooking.station as Station)?.name}
                  </p>
                  <p className="text-sm text-white/40">
                    {(selectedBooking.station as Station)?.address?.city},{" "}
                    {(selectedBooking.station as Station)?.address?.street}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 bg-white/5 p-3 rounded-xl border border-white/8">
                <div className="space-y-0.5">
                  <p className="text-[10px] uppercase font-bold text-white/30">Status</p>
                  <span
                    className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${statusColor[selectedBooking.status]}`}
                  >
                    {selectedBooking.status}
                  </span>
                </div>
                <div className="space-y-0.5 text-right">
                  <p className="text-[10px] uppercase font-bold text-white/30">Connector</p>
                  <p className="font-bold text-sm text-white">{selectedBooking.connectorType}</p>
                </div>
                <div className="space-y-0.5">
                  <p className="text-[10px] uppercase font-bold text-white/30">Date</p>
                  <p className="font-bold text-sm text-white">
                    {format(new Date(selectedBooking.date), "MMM d, yyyy")}
                  </p>
                </div>
                <div className="space-y-0.5 text-right">
                  <p className="text-[10px] uppercase font-bold text-white/30">Time</p>
                  <p className="font-bold text-sm text-white">
                    {selectedBooking.startTime} – {selectedBooking.endTime}
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-bold text-white/30 uppercase px-1">Cost Breakdown</p>
                <div className="bg-white/5 border border-white/8 rounded-xl p-3 space-y-1.5">
                  <div className="flex justify-between text-sm">
                    <span className="text-white/40">
                      Charging ({selectedBooking.estimatedKWh} kWh)
                    </span>
                    <span className="text-white">{formatCurrency(selectedBooking.totalCost)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-white/40">Platform Fee</span>
                    <span className="text-white">
                      {formatCurrency(selectedBooking.platformFee)}
                    </span>
                  </div>
                  <div className="pt-1.5 border-t border-white/10 flex justify-between font-bold">
                    <span className="text-white">Grand Total</span>
                    <span className="text-primary">
                      {formatCurrency(selectedBooking.grandTotal)}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs pt-1">
                    <span className="text-white/40">Advance Paid (20%)</span>
                    <span className="text-success">
                      {formatCurrency(selectedBooking.grandTotal * 0.2)}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-white/40">Balance Due (80%)</span>
                    <span className="text-destructive">
                      {formatCurrency(selectedBooking.grandTotal * 0.8)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              className="w-full bg-gradient-to-r from-green-600 to-green-400 text-white rounded-xl font-bold"
              onClick={() => setSelectedBooking(null)}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
