import { createFileRoute, Link, Navigate, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth";
import { BookingsAPI, StationsAPI, type Booking, type Station } from "@/lib/api";
import { socket } from "@/lib/socket";
import { Button } from "@/components/ui/button";
import { Loader2, MapPin, Zap, TrendingUp, Calendar, IndianRupee, ArrowLeft, KeyRound, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { cn, formatCurrency, getApiError } from "@/lib/utils";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, PieChart, Pie, Cell, Legend } from "recharts";
import { format } from "date-fns";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/owner/stations/$stationId")({
  component: StationOwnerDashboard,
});

function StationOwnerDashboard() {
  const { stationId } = Route.useParams();
  const { isOwner, loading: authLoading, isAuthed } = useAuth();
  const nav = useNavigate();
  
  const [station, setStation] = useState<Station | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [otpFor, setOtpFor] = useState<Booking | null>(null);
  const [otp, setOtp] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const sr = await StationsAPI.details(stationId);
      setStation(sr.data?.data);

      const br = await BookingsAPI.station(stationId, { limit: 100 });
      setBookings(br.data?.data ?? []);
    } catch (e) {
      toast.error(getApiError(e, "Failed to load station data"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOwner) {
      load();
      socket.emit("station:subscribe", stationId);
      
      const reload = () => load();
      socket.on("booking:created", reload);
      socket.on("booking:cancelled", reload);
      socket.on("booking:checkedIn", reload);
      socket.on("booking:completed", reload);

      return () => {
        socket.emit("station:unsubscribe", stationId);
        socket.off("booking:created", reload);
        socket.off("booking:cancelled", reload);
        socket.off("booking:checkedIn", reload);
        socket.off("booking:completed", reload);
      };
    }
  }, [isOwner, stationId]);

  const handleComplete = async (bookingId: string) => {
    setBusyId(bookingId);
    try {
      await BookingsAPI.complete(bookingId);
      toast.success("Session completed!");
      load();
    } catch (e) {
      toast.error(getApiError(e, "Completion failed"));
    } finally {
      setBusyId(null);
    }
  };

  const handleCheckIn = async () => {
    if (!otpFor) return;
    setBusyId(otpFor._id);
    try {
      await BookingsAPI.checkIn(otpFor._id, { otp });
      toast.success("Checked in! Session started.");
      setOtpFor(null);
      setOtp("");
      load();
    } catch (e) {
      toast.error(getApiError(e, "Invalid OTP"));
    } finally {
      setBusyId(null);
    }
  };

  const stats = useMemo(() => {
    const revenue = bookings.filter((b) => b.status === "completed").reduce((s, b) => s + b.grandTotal, 0);
    const active = bookings.filter((b) => ["confirmed", "in-progress"].includes(b.status)).length;
    const totalKWh = bookings.filter((b) => b.status === "completed").reduce((s, b) => s + b.estimatedKWh, 0);

    const byDay: Record<string, number> = {};
    bookings.forEach((b) => {
      const k = format(new Date(b.date), "MMM d");
      byDay[k] = (byDay[k] || 0) + 1;
    });
    const trend = Object.entries(byDay).slice(-7).map(([day, count]) => ({ day, count }));

    const byStatus: Record<string, number> = {};
    bookings.forEach((b) => { byStatus[b.status] = (byStatus[b.status] || 0) + 1; });
    const statusData = Object.entries(byStatus).map(([name, value]) => ({ name, value }));

    return { revenue, active, totalKWh, trend, statusData };
  }, [bookings]);

  if (authLoading) return <div className="h-screen grid place-items-center"><Loader2 className="h-7 w-7 animate-spin text-primary" /></div>;
  if (!isAuthed) return <Navigate to="/auth/login" />;
  if (!isOwner) return <Navigate to="/" />;

  const PIE_COLORS = ["oklch(0.68 0.19 148)", "oklch(0.78 0.17 75)", "oklch(0.62 0.18 200)", "oklch(0.62 0.22 27)", "oklch(0.7 0.18 60)"];

  return (
    <div className="max-w-3xl mx-auto p-4 space-y-6" style={{ paddingTop: "calc(var(--safe-top) + 1.5rem)" }}>
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => nav({ to: "/owner" })} className="shrink-0">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-black text-white">{station?.name || "Station Dashboard"}</h1>
          <p className="text-sm text-white/70 font-medium flex items-center gap-1">
            <MapPin className="h-3 w-3" /> {station?.address.city}, {station?.address.street}
          </p>
        </div>
      </div>

      {loading ? (
        <div className="py-20 grid place-items-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : (
        <>
          {/* Bookings Table */}
          <div className="bg-card rounded-2xl p-4 shadow-xl border border-white/5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-white">Station Bookings</h2>
              <span className="text-[10px] bg-white/5 px-2 py-1 rounded-full text-white/40 uppercase tracking-widest font-bold">Latest 100</span>
            </div>
            <div className="space-y-3">
              {bookings.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <p>No bookings found for this station.</p>
                </div>
              ) : (
                bookings.map((b) => {
                  const u = typeof b.user === "object" ? b.user.name : "User";
                  return (
                    <div key={b._id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.04] transition-colors">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-white">{u}</p>
                          <span className={cn(
                            "text-[9px] px-2 py-0.5 rounded-full font-black uppercase tracking-tighter",
                            b.status === "confirmed" ? "bg-emerald-500/20 text-emerald-400" :
                            b.status === "in-progress" ? "bg-blue-500/20 text-blue-400" :
                            "bg-white/10 text-white/40"
                          )}>
                            {b.status}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground flex items-center gap-2">
                          <Calendar className="h-3 w-3" /> {format(new Date(b.date), "MMM d, yyyy")} · {b.startTime}-{b.endTime}
                        </p>
                        <p className="text-[10px] text-white/30 uppercase font-bold tracking-wider">{b.connectorType} · {b.estimatedKWh} kWh</p>
                      </div>
                      <div className="flex items-center justify-between sm:flex-col sm:items-end gap-2">
                        <p className="font-bold text-primary">{formatCurrency(b.grandTotal)}</p>
                        <div className="flex gap-2">
                          {b.status === "confirmed" && (
                            <Button 
                              size="sm" 
                              className="h-8 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-bold"
                              onClick={() => setOtpFor(b)}
                            >
                              <KeyRound className="h-3 w-3 mr-1.5" /> CHECK-IN
                            </Button>
                          )}
                          {b.status === "in-progress" && (
                            <Button 
                              size="sm" 
                              className="h-8 px-4 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-bold"
                              onClick={() => handleComplete(b._id)}
                              disabled={busyId === b._id}
                            >
                              {busyId === b._id ? <Loader2 className="h-3 w-3 animate-spin" /> : <><CheckCircle2 className="h-3 w-3 mr-1.5" /> COMPLETE</>}
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </>
      )}

      {/* OTP Dialog for Check-in */}
      <Dialog open={!!otpFor} onOpenChange={(o) => !o && setOtpFor(null)}>
        <DialogContent className="bg-[#0a1628] border border-white/10 text-white rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-white">Verify Check-in OTP</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-white/40">Enter the 6-digit OTP provided by the user at the station.</p>
          <Input
            value={otp}
            onChange={(e) => setOtp(e.target.value)}
            maxLength={6}
            placeholder="000000"
            className="text-center text-2xl tracking-[0.5em] font-mono h-14 bg-white/5 border-white/10 text-white placeholder:text-white/20"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setOtpFor(null)} className="border-white/10 text-white/60 hover:bg-white/5">Cancel</Button>
            <Button
              onClick={handleCheckIn}
              disabled={otp.length !== 6 || busyId === otpFor?._id}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold"
            >
              {busyId === otpFor?._id ? <Loader2 className="h-4 w-4 animate-spin" /> : "Verify & Start"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Kpi({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="bg-card rounded-2xl p-4 shadow-xl border border-white/5">
      <div className="h-10 w-10 rounded-xl bg-primary/10 grid place-items-center text-primary mb-3">{icon}</div>
      <p className="text-xs text-white/40 font-medium mb-1">{label}</p>
      <p className="font-black text-xl text-white truncate">{value}</p>
    </div>
  );
}
