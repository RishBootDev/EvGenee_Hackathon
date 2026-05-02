import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { BookingsAPI, PaymentAPI, type Booking, type Station } from "@/lib/api";
import { socket } from "@/lib/socket";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Calendar, Clock, Loader2, MapPin, Zap, X, KeyRound,
  CheckCircle2, Eye, Info, 
} from "lucide-react";
import { toast } from "sonner";
import { formatCurrency, getApiError } from "@/lib/utils";
import { format, isToday, isYesterday } from "date-fns";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/bookings")({
  component: BookingsPage,
});

/* ─── Status helpers ─────────────────────────────────────── */
const statusBadge: Record<string, string> = {
  confirmed:   "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20",
  "in-progress":"bg-blue-500/10   text-blue-400   border border-blue-500/20",
  completed:   "bg-white/5       text-white/30   border border-white/10",
  cancelled:   "bg-red-500/10    text-red-400    border border-red-500/20",
  pending:     "bg-amber-500/10  text-amber-400  border border-amber-500/20",
  "no-show":   "bg-red-500/10    text-red-400    border border-red-500/20",
};

/** Top accent stripe colour per status */
const accentBar: Record<string, string> = {
  confirmed:   "from-emerald-500 to-green-400",
  "in-progress":"from-blue-500   to-cyan-400",
  completed:   "from-slate-600   to-slate-400",
  cancelled:   "from-red-500     to-rose-400",
  pending:     "from-amber-500   to-yellow-400",
  "no-show":   "from-red-500     to-rose-400",
};

const iconGrad: Record<string, string> = {
  confirmed:   "from-green-600  to-green-400",
  "in-progress":"from-blue-600  to-blue-400",
  completed:   "from-slate-600  to-slate-400",
  cancelled:   "from-red-600    to-red-400",
  pending:     "from-amber-600  to-amber-400",
  "no-show":   "from-red-600    to-red-400",
};

/* ─── Date section label ─────────────────────────────────── */
function dateLabel(dateStr: string) {
  const d = new Date(dateStr);
  if (isToday(d))     return `Today · ${format(d, "MMM d")}`;
  if (isYesterday(d)) return `Yesterday · ${format(d, "MMM d")}`;
  return format(d, "MMMM d, yyyy");
}

/* ─── Group bookings by date ─────────────────────────────── */
function groupByDate(bookings: Booking[]) {
  const map = new Map<string, Booking[]>();
  for (const b of bookings) {
    const key = format(new Date(b.date), "yyyy-MM-dd");
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(b);
  }
  return map;
}

/* ════════════════════════════════════════════════════════════
   PAGE
═════════════════════════════════════════════════════════════*/
function BookingsPage() {
  const { isAuthed, loading: authLoading } = useAuth();
  const [bookings, setBookings]         = useState<Booking[]>([]);
  const [loading, setLoading]           = useState(true);
  const [tab, setTab]                   = useState("all");
  const [otpFor, setOtpFor]             = useState<Booking | null>(null);
  const [otp, setOtp]                   = useState("");
  const [busyId, setBusyId]             = useState<string | null>(null);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [loadingDetail, setLoadingDetail]     = useState(false);

  /* ── data ── */
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
    if (!isAuthed) return;
    load();
    const reload = () => load();
    const events = ["booking:created","booking:cancelled","booking:checkedIn","booking:completed","bookings:autoCompleted"];
    events.forEach(ev => socket.on(ev, reload));
    return () => events.forEach(ev => socket.off(ev, reload));
  }, [isAuthed]);

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

  /* ── actions ── */
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

  const checkIn = async () => {
    if (!otpFor) return;
    setBusyId(otpFor._id);
    try {
      await BookingsAPI.checkIn(otpFor._id, { otp });
      toast.success("Checked in! Charging started.");
      setOtpFor(null);
      setOtp("");
      load();
    } catch (e) {
      toast.error(getApiError(e, "Invalid OTP"));
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
        const pricing = station?.pricing?.find(p => p.connectorType === b.connectorType) || station?.pricing?.[0];
        const currency = pricing?.currency || "INR";
        const orderRes = await PaymentAPI.createOrder({ amount: remainingPayment, currency });
        const order = orderRes.data;
        const options = {
          key: import.meta.env.VITE_RAZORPAY_KEY_ID || "",
          amount: order.amount, currency: order.currency,
          name: "EvGenee Charging",
          description: `Remaining payment for ${station?.name || "Booking"}`,
          order_id: order.id,
          handler: async (response: any) => {
            try {
              await PaymentAPI.updatePayment({ orderId: order.id, paymentId: response.razorpay_payment_id, status: "paid" });
              await executeComplete();
            } catch { toast.error("Failed to verify payment"); setBusyId(null); }
          },
          prefill: {
            name:    typeof b.user === "object" ? b.user.name  : "EvGenee User",
            email:   typeof b.user === "object" ? b.user.email : "user@example.com",
            contact: "9999999999",
          },
          theme: { color: "#22c55e" },
          modal: { ondismiss: () => { toast.error("Payment cancelled. Please pay to complete."); setBusyId(null); } },
        };
        const rzp = new (window as any).Razorpay(options);
        rzp.on("payment.failed", (res: any) => { toast.error(`Payment Failed: ${res.error.description}`); setBusyId(null); });
        rzp.open();
      } catch (e) {
        toast.error(getApiError(e, "Failed to initiate payment"));
        setBusyId(null);
      }
    } else {
      await executeComplete();
    }
  };

  /* ── guards ── */
  if (authLoading) return (
    <div className="h-screen grid place-items-center bg-[#000814]">
      <Loader2 className="h-7 w-7 animate-spin text-primary" />
    </div>
  );
  if (!isAuthed) return <Navigate to="/auth/login" />;

  /* ── filter + group ── */
  const filtered = bookings.filter(b => {
    if (tab === "active")  return ["confirmed","in-progress","pending"].includes(b.status);
    if (tab === "history") return ["completed","cancelled","no-show"].includes(b.status);
    return true;
  });
  const groups = groupByDate(filtered);

  /* ════════════════════════════════════════════════════════
     RENDER
  ════════════════════════════════════════════════════════*/
  return (
    <div
      className="min-h-screen bg-[#000814] text-white"
      style={{ paddingBottom: "5rem" }}
    >
      <div
        className="max-w-2xl mx-auto px-4"
        style={{ paddingTop: "calc(var(--safe-top) + 2rem)" }}
      >
        {/* ── Header ── */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-2xl font-extrabold text-white tracking-tight leading-tight">
              My Bookings
            </h1>
            <p className="text-sm text-white/30 mt-0.5">
              Track and manage your charging sessions
            </p>
          </div>
          
        </div>

        {/* ── Tabs ── */}
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="w-full grid grid-cols-3 bg-white/[0.04] border border-white/8 rounded-2xl p-1 mb-5 h-auto">
            {["all","active","history"].map(t => (
              <TabsTrigger
                key={t}
                value={t}
                className="rounded-xl py-2 text-sm font-semibold capitalize
                           text-white/30
                           data-[state=active]:bg-emerald-500/15
                           data-[state=active]:text-emerald-400
                           data-[state=active]:border
                           data-[state=active]:border-emerald-500/25
                           transition-all"
              >
                {t}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value={tab} className="space-y-1 mt-0">

            {/* loading */}
            {loading ? (
              <div className="py-16 grid place-items-center">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : filtered.length === 0 ? (
              /* empty */
              <div className="text-center py-20">
                <div className="w-16 h-16 rounded-2xl bg-white/[0.04] border border-white/8 grid place-items-center mx-auto mb-4">
                  <Calendar className="h-7 w-7 text-white/15" />
                </div>
                <p className="text-white/30 font-semibold">No bookings yet</p>
                <p className="text-white/15 text-sm mt-1">Your charging sessions will appear here</p>
              </div>
            ) : (
              /* grouped list */
              Array.from(groups.entries()).map(([dateKey, dayBookings]) => (
                <div key={dateKey} className="space-y-3 mb-5">
                  {/* section label */}
                  <p className="text-[11px] font-bold text-white/20 uppercase tracking-widest px-1 pt-2">
                    {dateLabel(dayBookings[0].date)}
                  </p>

                  {dayBookings.map(b => {
                    const station = typeof b.station === "object" ? (b.station as Station) : null;
                    const isBusy  = busyId === b._id;
                    const grad    = iconGrad[b.status]  ?? "from-green-600 to-green-400";
                    const accent  = accentBar[b.status] ?? "from-green-500 to-green-400";

                    return (
                      <div
                        key={b._id}
                        className="rounded-2xl border border-white/8 overflow-hidden
                                   hover:border-white/[0.14] transition-colors"
                        style={{ background: "rgba(255,255,255,0.03)" }}
                      >
                        {/* colour accent top bar */}
                        <div className={`h-[3px] w-full bg-gradient-to-r ${accent}`} />

                        <div className="p-4 space-y-3">
                          {/* row 1: icon + name + badge */}
                          <div className="flex items-start gap-3">
                            <div className={`h-11 w-11 rounded-xl bg-gradient-to-br ${grad} grid place-items-center shrink-0`}>
                              <Zap className="h-5 w-5 text-white" fill="white" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-bold text-white text-[15px] truncate leading-tight">
                                {station?.name ?? "Station"}
                              </p>
                              <p className="text-xs text-white/30 flex items-center gap-1 mt-0.5 truncate">
                                <MapPin className="h-3 w-3 shrink-0" />
                                {station?.address?.city ?? ""}
                              </p>
                            </div>
                            <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider shrink-0 ${statusBadge[b.status]}`}>
                              {b.status.replace("-", " ")}
                            </span>
                          </div>

                          {/* row 2: date / time pill */}
                          <div className="flex items-center gap-2 text-[11.5px] text-white/35
                                          bg-white/[0.04] border border-white/6 rounded-xl px-3 py-2">
                            <Calendar className="h-3.5 w-3.5 shrink-0" />
                            <span>{format(new Date(b.date), "MMM d, yyyy")}</span>
                            <span className="opacity-30 mx-0.5">·</span>
                            <Clock className="h-3.5 w-3.5 shrink-0" />
                            <span>{b.startTime} – {b.endTime}</span>
                          </div>

                          {/* row 3: connector/kwh pill */}
                          <div className="flex items-center gap-2 text-[11.5px] text-white/25
                                          bg-white/[0.03] border border-white/5 rounded-xl px-3 py-1.5">
                            <Zap className="h-3 w-3 shrink-0 text-emerald-500/60" />
                            <span className="text-emerald-500/60 font-medium">{b.connectorType}</span>
                            <span className="opacity-20 mx-0.5">·</span>
                            <span>{b.estimatedKWh} kWh estimated</span>
                          </div>

                          {/* row 4: price + actions */}
                          <div className="flex items-end justify-between pt-0.5">
                            <div>
                              <p className="text-[10px] text-white/20 mb-0.5 uppercase tracking-wider">Total</p>
                              <p className="text-[22px] font-extrabold text-white tracking-tight leading-none">
                                {formatCurrency(b.grandTotal)}
                              </p>
                            </div>

                            <div className="flex items-center gap-2 flex-wrap justify-end">
                              {/* Details */}
                              <Button
                                size="sm"
                                onClick={() => showDetails(b._id)}
                                disabled={loadingDetail}
                                className="h-8 px-3 rounded-xl text-xs
                                           bg-white/[0.05] border border-white/10
                                           text-white/50 hover:bg-white/[0.09]
                                           hover:text-white/70 transition-all"
                              >
                                <Eye className="h-3.5 w-3.5 mr-1" />
                                Details
                              </Button>

                              {/* Confirmed actions */}
                              {b.status === "confirmed" && (
                                <>
                                  <Button
                                    size="sm"
                                    onClick={() => cancel(b)}
                                    disabled={isBusy}
                                    className="h-8 px-3 rounded-xl text-xs
                                               bg-red-500/8 border border-red-500/20
                                               text-red-400 hover:bg-red-500/15 transition-all"
                                  >
                                    {isBusy
                                      ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                      : <><X className="h-3.5 w-3.5 mr-1" />Cancel</>
                                    }
                                  </Button>
                                  <Button
                                    size="sm"
                                    onClick={() => setOtpFor(b)}
                                    className="h-8 px-3 rounded-xl text-xs font-bold
                                               bg-gradient-to-r from-green-600 to-green-400
                                               text-white hover:opacity-90 transition-all"
                                  >
                                    <KeyRound className="h-3.5 w-3.5 mr-1" />
                                    Check-in
                                  </Button>
                                </>
                              )}

                              {/* In-progress action */}
                              {b.status === "in-progress" && (
                                <Button
                                  size="sm"
                                  onClick={() => complete(b)}
                                  disabled={isBusy}
                                  className="h-8 px-3 rounded-xl text-xs font-bold
                                             bg-gradient-to-r from-green-600 to-green-400
                                             text-white hover:opacity-90 transition-all"
                                >
                                  {isBusy
                                    ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    : <><CheckCircle2 className="h-3.5 w-3.5 mr-1" />Pay &amp; Complete</>
                                  }
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* ══ Booking Detail Modal ══════════════════════════════════ */}
      <Dialog open={!!selectedBooking} onOpenChange={o => !o && setSelectedBooking(null)}>
        <DialogContent className="max-w-md rounded-2xl bg-[#070f1f] border border-white/10 text-white">
          <DialogHeader>
            <DialogTitle className="text-white text-base font-bold">Booking Details</DialogTitle>
          </DialogHeader>

          {selectedBooking && (() => {
            const st = selectedBooking.station as Station;
            const grad = iconGrad[selectedBooking.status] ?? "from-green-600 to-green-400";
            const accent = accentBar[selectedBooking.status] ?? "from-green-500 to-green-400";
            return (
              <div className="space-y-4 py-1">
                {/* station header */}
                <div className="flex items-center gap-3">
                  <div className={`h-11 w-11 rounded-xl bg-gradient-to-br ${grad} grid place-items-center shrink-0`}>
                    <Zap className="h-5 w-5 text-white" fill="white" />
                  </div>
                  <div>
                    <p className="font-bold text-white leading-tight">{st?.name}</p>
                    <p className="text-xs text-white/35 mt-0.5">{st?.address?.street}, {st?.address?.city}</p>
                  </div>
                  <span className={`ml-auto text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider ${statusBadge[selectedBooking.status]}`}>
                    {selectedBooking.status.replace("-", " ")}
                  </span>
                </div>

                {/* meta grid */}
                <div className="grid grid-cols-2 gap-2 text-sm">
                  {[
                    { label: "Connector", value: selectedBooking.connectorType },
                    { label: "Energy",    value: `${selectedBooking.estimatedKWh} kWh` },
                    { label: "Date",      value: format(new Date(selectedBooking.date), "MMM d, yyyy") },
                    { label: "Time",      value: `${selectedBooking.startTime} – ${selectedBooking.endTime}` },
                  ].map(({ label, value }) => (
                    <div key={label} className="bg-white/[0.04] border border-white/6 rounded-xl p-3">
                      <p className="text-[10px] uppercase font-bold text-white/25 tracking-wider mb-1">{label}</p>
                      <p className="font-bold text-white text-sm">{value}</p>
                    </div>
                  ))}
                </div>

                {/* cost breakdown */}
                <div>
                  <p className="text-[10px] font-bold text-white/25 uppercase tracking-wider px-1 mb-2">Cost Breakdown</p>
                  <div className="bg-white/[0.04] border border-white/8 rounded-2xl p-3 space-y-2 text-sm">
                    <Row label={`Charging (${selectedBooking.estimatedKWh} kWh)`} value={formatCurrency(selectedBooking.totalCost)} />
                    <Row label="Platform Fee" value={formatCurrency(selectedBooking.platformFee)} />
                    <div className="border-t border-white/8 pt-2 flex justify-between font-bold">
                      <span className="text-white">Grand Total</span>
                      <span className="text-emerald-400">{formatCurrency(selectedBooking.grandTotal)}</span>
                    </div>
                    <Row label="Advance Paid (20%)" value={formatCurrency(selectedBooking.grandTotal * 0.2)} valueClass="text-emerald-400" />
                    <Row label="Balance Due (80%)"  value={formatCurrency(selectedBooking.grandTotal * 0.8)} valueClass="text-red-400" />
                  </div>
                </div>

                {/* check-in hint */}
                {selectedBooking.status === "confirmed" && (
                  <div className={`bg-gradient-to-r ${accent} p-[1px] rounded-xl`}>
                    <div className="bg-[#070f1f] rounded-xl p-3 flex items-start gap-3">
                      <Info className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-xs font-bold text-emerald-400 uppercase tracking-wider">Check-in Info</p>
                        <p className="text-xs text-white/50 mt-0.5">Use the 6-digit OTP sent to your email to start the session.</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })()}

          <DialogFooter>
            <Button
              className="w-full bg-gradient-to-r from-green-600 to-green-400 text-white rounded-xl font-bold h-10"
              onClick={() => setSelectedBooking(null)}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ══ OTP Dialog ═══════════════════════════════════════════ */}
      <Dialog open={!!otpFor} onOpenChange={o => !o && setOtpFor(null)}>
        <DialogContent className="bg-[#070f1f] border border-white/10 text-white rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-white text-base font-bold">Enter Check-in OTP</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-white/35">
            Enter the 6-digit OTP sent when you booked to start the charging session.
          </p>
          <Input
            value={otp}
            onChange={e => setOtp(e.target.value)}
            maxLength={6}
            placeholder="000000"
            className="text-center text-3xl tracking-[0.5em] font-mono h-14
                       bg-white/[0.04] border-white/10 text-white
                       placeholder:text-white/15 rounded-xl"
          />
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setOtpFor(null)}
              className="flex-1 border-white/10 text-white/50 hover:bg-white/5 rounded-xl"
            >
              Cancel
            </Button>
            <Button
              onClick={checkIn}
              disabled={otp.length !== 6 || busyId === otpFor?._id}
              className="flex-1 bg-gradient-to-r from-green-600 to-green-400 text-white font-bold rounded-xl"
            >
              {busyId === otpFor?._id
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : "Verify & Start"
              }
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ── tiny helper for modal rows ─── */
function Row({ label, value, valueClass = "text-white" }: { label: string; value: string; valueClass?: string }) {
  return (
    <div className="flex justify-between text-xs">
      <span className="text-white/35">{label}</span>
      <span className={`font-medium ${valueClass}`}>{value}</span>
    </div>
  );
}
