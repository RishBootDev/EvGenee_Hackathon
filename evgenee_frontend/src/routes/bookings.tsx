import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { BookingsAPI, PaymentAPI, type Booking, type Station } from "@/lib/api";
import { socket } from "@/lib/socket";
import { Button } from "@/components/ui/button";
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
  CheckCircle2,
  Eye,
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
  pending: "bg-amber-500/15 text-amber-400 border border-amber-500/20",
  "no-show": "bg-red-500/15 text-red-400 border border-red-500/20",
};

const iconColor: Record<string, string> = {
  confirmed: "from-emerald-600 to-emerald-400",
  "in-progress": "from-blue-600 to-blue-400",
  completed: "from-slate-600 to-slate-400",
  cancelled: "from-red-600 to-red-400",
  pending: "from-amber-600 to-amber-400",
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

  const m = Math.floor(timeLeft / 60).toString().padStart(2, "0");
  const s = (timeLeft % 60).toString().padStart(2, "0");

  if (timeLeft === 0) return <span className="text-red-400 font-bold text-[10px]">Expired</span>;
  return (
    <span className="text-amber-400 font-bold text-[10px] animate-pulse flex items-center gap-1">
      <Clock className="h-2.5 w-2.5" /> {m}:{s} left
    </span>
  );
}

function BookingsPage() {
  const { isAuthed, loading: authLoading, user } = useAuth();
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
        <div className="h-8 w-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
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
      toast.success(`Cancelled`);
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
        toast.success("Session completed!");
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
        const pricing = station?.pricing?.find((p) => p.connectorType === b.connectorType) || station?.pricing?.[0];
        const currency = pricing?.currency || "INR";
        const orderRes = await PaymentAPI.createOrder({ amount: remainingPayment, currency });
        const order = orderRes.data;
        const options = {
          key: import.meta.env.VITE_RAZORPAY_KEY_ID || "",
          amount: order.amount,
          currency: order.currency,
          name: "EvGenee",
          description: `Payment for ${station?.name || "Booking"}`,
          order_id: order.id,
          handler: async function (response: any) {
            try {
              await PaymentAPI.updatePayment({ orderId: order.id, paymentId: response.razorpay_payment_id, status: "paid" });
              await executeComplete();
            } catch (err) {
              toast.error("Payment verification failed");
              setBusyId(null);
            }
          },
          prefill: { name: user?.name, email: user?.email },
          theme: { color: "#10b981" },
        };
        const rzp = new (window as any).Razorpay(options);
        rzp.open();
      } catch (e) {
        toast.error("Payment initiation failed");
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
        toast.success("Advance paid!");
        setBusyId(null);
        load();
      } catch (e) {
        toast.error(getApiError(e, "Confirmation failed"));
        setBusyId(null);
      }
    };
    const advancePayment = parseFloat((b.grandTotal * 0.2).toFixed(2));
    if (advancePayment > 0) {
      try {
        const station = typeof b.station === "object" ? (b.station as Station) : null;
        const orderRes = await PaymentAPI.createOrder({ amount: advancePayment, currency: "INR" });
        const order = orderRes.data;
        const options = {
          key: import.meta.env.VITE_RAZORPAY_KEY_ID || "",
          amount: order.amount,
          currency: order.currency,
          name: "EvGenee",
          description: `Advance for ${station?.name || "Booking"}`,
          order_id: order.id,
          handler: async function (response: any) {
            try {
              await PaymentAPI.updatePayment({ orderId: order.id, paymentId: response.razorpay_payment_id, status: "paid" });
              await executeConfirmAdvance();
            } catch (err) {
              toast.error("Verification failed");
              setBusyId(null);
            }
          },
          prefill: { name: user?.name, email: user?.email },
          theme: { color: "#10b981" },
        };
        const rzp = new (window as any).Razorpay(options);
        rzp.open();
      } catch (e) {
        toast.error("Payment failed");
        setBusyId(null);
      }
    } else {
      await executeConfirmAdvance();
    }
  };

  return (
    <div
      className="min-h-screen bg-[#000814] text-white overflow-x-hidden"
      style={{ paddingBottom: "6rem", fontFamily: "'DM Sans', sans-serif" }}
    >
      {/* Premium Background Image */}
      <div className="fixed inset-0 z-0">
        <img
          src="/hero-bg.png"
          alt="EV Charging"
          className="w-full h-full object-cover opacity-20"
        />
        <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-[1px]" />
      </div>

      {/* Project Texture */}
      <div
        className="fixed inset-0 z-10 pointer-events-none opacity-[0.05]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
          backgroundRepeat: "repeat",
          backgroundSize: "128px 128px",
        }}
      />

      {/* Project Glows */}
      <div
        className="fixed top-0 left-0 w-[600px] h-[500px] pointer-events-none z-10"
        style={{
          background: "radial-gradient(ellipse at 0% 0%, rgba(59,130,246,0.1) 0%, transparent 70%)",
        }}
      />
      <div
        className="fixed bottom-0 right-0 w-[500px] h-[500px] pointer-events-none z-10"
        style={{
          background: "radial-gradient(ellipse at 100% 100%, rgba(16,185,129,0.08) 0%, transparent 70%)",
        }}
      />

      <div className="relative z-10 max-w-2xl mx-auto px-6 pt-12">
        <header className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight text-white mb-2" style={{ fontFamily: "'Poppins', sans-serif" }}>
            My Bookings
          </h1>
          <p className="text-white/40 text-sm">Manage your charging fleet and sessions</p>
        </header>

        <Tabs value={tab} onValueChange={setTab} className="mb-8">
          <TabsList className="bg-white/5 border border-white/8 rounded-2xl p-1.5 w-full flex">
            {["all", "active", "history"].map((t) => (
              <TabsTrigger
                key={t}
                value={t}
                className="flex-1 rounded-xl text-xs font-bold uppercase tracking-widest data-[state=active]:bg-emerald-500 data-[state=active]:text-black text-white/40 transition-all py-3"
              >
                {t}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value={tab} className="space-y-4 mt-6">
            {loading ? (
              <div className="py-20 flex justify-center">
                <div className="h-8 w-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-20 border-2 border-dashed border-white/5 rounded-[2rem]">
                <Calendar className="h-10 w-10 text-white/5 mx-auto mb-3" />
                <p className="text-white/20 text-sm font-bold uppercase tracking-widest">No sessions found</p>
              </div>
            ) : (
              filtered.map((b) => {
                const station = typeof b.station === "object" ? (b.station as Station) : null;
                const isBusy = busyId === b._id;
                const grad = iconColor[b.status] ?? "from-emerald-600 to-emerald-400";
                return (
                  <div key={b._id} className="bg-white/[0.03] border border-white/5 rounded-3xl p-5 hover:bg-white/[0.05] transition-all group">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-center gap-4">
                        <div className={`h-14 w-14 rounded-2xl bg-gradient-to-br ${grad} flex items-center justify-center shadow-lg`}>
                          <FontAwesomeIcon icon={faChargingStation} className="h-6 w-6 text-white" />
                        </div>
                        <div>
                          <h3 className="font-bold text-white text-base leading-none mb-1.5">{station?.name ?? "Charging Station"}</h3>
                          <p className="text-xs text-white/30 flex items-center gap-1.5">
                            <MapPin className="h-3 w-3" /> {station?.address?.city ?? "Location"}
                          </p>
                        </div>
                      </div>
                      <div className="text-right flex flex-col items-end gap-1.5">
                        <span className={`text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full ${statusColor[b.status]}`}>
                          {b.status}
                        </span>
                        {b.status === "pending" && b.createdAt && <PendingCountdown createdAt={b.createdAt} />}
                      </div>
                    </div>

                    <div className="mt-6 grid grid-cols-2 gap-3">
                      <div className="bg-white/5 rounded-2xl p-3 border border-white/5 flex items-center gap-3">
                        <Calendar className="h-4 w-4 text-emerald-400/60" />
                        <div>
                          <p className="text-[8px] text-white/30 font-bold uppercase tracking-tighter">Date</p>
                          <p className="text-xs font-bold text-white/80">{format(new Date(b.date), "MMM d, yyyy")}</p>
                        </div>
                      </div>
                      <div className="bg-white/5 rounded-2xl p-3 border border-white/5 flex items-center gap-3">
                        <Clock className="h-4 w-4 text-blue-400/60" />
                        <div>
                          <p className="text-[8px] text-white/30 font-bold uppercase tracking-tighter">Time Slot</p>
                          <p className="text-xs font-bold text-white/80">{b.startTime} – {b.endTime}</p>
                        </div>
                      </div>
                    </div>

                    <div className="mt-6 flex items-center justify-between border-t border-white/5 pt-5">
                      <div>
                        <p className="text-[10px] text-white/20 font-bold uppercase tracking-widest mb-1">{b.connectorType} · {b.estimatedKWh} kWh</p>
                        <p className="text-xl font-black text-white">{formatCurrency(b.grandTotal)}</p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => showDetails(b._id)}
                          className="h-10 px-4 rounded-xl bg-white/5 border border-white/10 text-xs font-bold hover:bg-white/10 transition-colors"
                        >
                          Details
                        </button>
                        {b.status === "confirmed" && (
                          <button
                            onClick={() => cancel(b)}
                            disabled={isBusy}
                            className="h-10 px-4 rounded-xl bg-red-500/10 border border-red-500/10 text-red-400 text-xs font-bold hover:bg-red-500/20"
                          >
                            Cancel
                          </button>
                        )}
                        {b.status === "in-progress" && (
                          <button
                            onClick={() => complete(b)}
                            disabled={isBusy}
                            className="h-10 px-5 rounded-xl bg-emerald-500 text-black text-xs font-black shadow-lg shadow-emerald-500/20 active:scale-95 transition-all"
                          >
                            Pay & Complete
                          </button>
                        )}
                        {b.status === "pending" && (
                          <button
                            onClick={() => payAdvance(b)}
                            disabled={isBusy}
                            className="h-10 px-5 rounded-xl bg-amber-500 text-black text-xs font-black shadow-lg shadow-amber-500/20 active:scale-95 transition-all"
                          >
                            Pay Advance
                          </button>
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

      <Dialog open={!!selectedBooking} onOpenChange={(o) => !o && setSelectedBooking(null)}>
        <DialogContent className="max-w-md rounded-[2rem] bg-[#000814] border border-white/10 text-white p-8">
          <DialogHeader className="mb-6">
            <DialogTitle className="text-2xl font-bold tracking-tight text-white" style={{ fontFamily: "'Poppins', sans-serif" }}>
              Booking Summary
            </DialogTitle>
          </DialogHeader>
          {selectedBooking && (
            <div className="space-y-6">
              <div className="flex items-center gap-4">
                <div className={`h-14 w-14 rounded-2xl bg-gradient-to-br ${iconColor[selectedBooking.status] ?? "from-emerald-600 to-emerald-400"} flex items-center justify-center`}>
                  <FontAwesomeIcon icon={faChargingStation} className="h-7 w-7 text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-lg text-white">{(selectedBooking.station as Station)?.name}</h3>
                  <p className="text-sm text-white/40">{(selectedBooking.station as Station)?.address?.city}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 bg-white/5 p-5 rounded-2xl border border-white/5">
                {[
                  { l: "Status", v: selectedBooking.status, s: statusColor[selectedBooking.status] },
                  { l: "Connector", v: selectedBooking.connectorType },
                  { l: "Date", v: format(new Date(selectedBooking.date), "MMM d, yyyy") },
                  { l: "Time", v: `${selectedBooking.startTime} - ${selectedBooking.endTime}` },
                ].map((item, i) => (
                  <div key={i} className="space-y-1">
                    <p className="text-[10px] font-bold text-white/20 uppercase tracking-widest">{item.l}</p>
                    {item.s ? (
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${item.s}`}>{item.v}</span>
                    ) : (
                      <p className="font-bold text-sm text-white/80">{item.v}</p>
                    )}
                  </div>
                ))}
              </div>

              <div className="space-y-3">
                <p className="text-[10px] font-bold text-white/20 uppercase tracking-widest ml-1">Payment Detail</p>
                <div className="bg-white/5 border border-white/5 rounded-2xl p-5 space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-white/40">Base Charging</span>
                    <span className="text-white font-medium">{formatCurrency(selectedBooking.totalCost)}</span>
                  </div>
                  <div className="flex justify-between text-sm font-bold border-t border-white/10 pt-3">
                    <span className="text-white">Grand Total</span>
                    <span className="text-emerald-400">{formatCurrency(selectedBooking.grandTotal)}</span>
                  </div>
                </div>
              </div>
            </div>
          )}
          <DialogFooter className="mt-8">
            <button
              className="w-full h-12 bg-white/5 border border-white/10 text-white rounded-full font-bold hover:bg-white/10 transition-colors"
              onClick={() => setSelectedBooking(null)}
            >
              Close
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
