import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { BookingsAPI, type Booking, type Station } from "@/lib/api";
import { socket } from "@/lib/socket";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Calendar, Clock, Loader2, MapPin, Zap, X, KeyRound, CheckCircle2, Eye, Info } from "lucide-react";
import { toast } from "sonner";
import { formatCurrency, getApiError } from "@/lib/utils";
import { format } from "date-fns";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/bookings")({
  component: BookingsPage,
});

const statusColor: Record<string, string> = {
  confirmed: "bg-primary text-primary-foreground",
  "in-progress": "bg-warning text-warning-foreground",
  completed: "bg-muted text-muted-foreground",
  cancelled: "bg-destructive text-destructive-foreground",
  pending: "bg-muted text-muted-foreground",
  "no-show": "bg-destructive text-destructive-foreground",
};

function BookingsPage() {
  const { isAuthed, loading: authLoading } = useAuth();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("all");
  const [otpFor, setOtpFor] = useState<Booking | null>(null);
  const [otp, setOtp] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  // Detail modal states
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

  if (authLoading) return <div className="h-screen grid place-items-center"><Loader2 className="h-7 w-7 animate-spin text-primary" /></div>;
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
    try {
      await BookingsAPI.complete(b._id);
      toast.success("Session completed!");
      load();
    } catch (e) {
      toast.error(getApiError(e, "Complete failed"));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-4 pt-6" style={{ paddingTop: "calc(var(--safe-top) + 1.5rem)" }}>
      <h1 className="text-2xl font-bold mb-4">My Bookings</h1>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="w-full grid grid-cols-3">
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="active">Active</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        <TabsContent value={tab} className="mt-4 space-y-3">
          {loading ? (
            <div className="py-12 grid place-items-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Calendar className="h-12 w-12 mx-auto opacity-30 mb-2" />
              <p>No bookings yet</p>
            </div>
          ) : (
            filtered.map((b) => {
              const station = typeof b.station === "object" ? (b.station as Station) : null;
              const isBusy = busyId === b._id;
              return (
                <div key={b._id} className="bg-card rounded-2xl p-4 shadow-[var(--shadow-card)] space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="h-11 w-11 rounded-xl bg-[image:var(--gradient-primary)] grid place-items-center shrink-0">
                        <Zap className="h-5 w-5 text-white" fill="white" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-bold truncate">{station?.name ?? "Station"}</p>
                        <p className="text-xs text-muted-foreground flex items-center gap-1 truncate">
                          <MapPin className="h-3 w-3 shrink-0" />
                          {station?.address?.city ?? ""}
                        </p>
                      </div>
                    </div>
                    <Badge className={statusColor[b.status]}>{b.status}</Badge>
                  </div>

                  <div className="flex items-center justify-between text-sm bg-accent/50 rounded-lg px-3 py-2">
                    <span className="flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5" />{format(new Date(b.date), "MMM d, yyyy")}</span>
                    <span className="flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" />{b.startTime} – {b.endTime}</span>
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground">{b.connectorType} · {b.estimatedKWh} kWh</p>
                      <p className="font-bold text-lg">{formatCurrency(b.grandTotal)}</p>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="ghost" onClick={() => showDetails(b._id)} disabled={loadingDetail}>
                        <Eye className="h-3.5 w-3.5 mr-1" />Details
                      </Button>
                      {b.status === "confirmed" && (
                        <>
                          <Button size="sm" variant="outline" onClick={() => cancel(b)} disabled={isBusy}>
                            <X className="h-3.5 w-3.5 mr-1" />Cancel
                          </Button>
                          <Button size="sm" onClick={() => setOtpFor(b)} className="bg-[image:var(--gradient-primary)] text-primary-foreground">
                            <KeyRound className="h-3.5 w-3.5 mr-1" />Check-in
                          </Button>
                        </>
                      )}
                      {b.status === "in-progress" && (
                        <Button size="sm" onClick={() => complete(b)} disabled={isBusy} className="bg-[image:var(--gradient-primary)] text-primary-foreground">
                          <CheckCircle2 className="h-3.5 w-3.5 mr-1" />Complete
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

      {/* Booking Detail Modal */}
      <Dialog open={!!selectedBooking} onOpenChange={(o) => !o && setSelectedBooking(null)}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle>Booking Details</DialogTitle>
          </DialogHeader>
          {selectedBooking && (
            <div className="space-y-4 py-2">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-xl bg-[image:var(--gradient-primary)] grid place-items-center shrink-0">
                  <Zap className="h-6 w-6 text-white" fill="white" />
                </div>
                <div>
                  <p className="font-bold">{(selectedBooking.station as Station)?.name}</p>
                  <p className="text-sm text-muted-foreground">{(selectedBooking.station as Station)?.address?.city}, {(selectedBooking.station as Station)?.address?.street}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 bg-accent/30 p-3 rounded-xl border border-border">
                <div className="space-y-0.5">
                  <p className="text-[10px] uppercase font-bold text-muted-foreground">Status</p>
                  <Badge className={statusColor[selectedBooking.status]}>{selectedBooking.status}</Badge>
                </div>
                <div className="space-y-0.5 text-right">
                  <p className="text-[10px] uppercase font-bold text-muted-foreground">Connector</p>
                  <p className="font-bold text-sm">{selectedBooking.connectorType}</p>
                </div>
                <div className="space-y-0.5">
                  <p className="text-[10px] uppercase font-bold text-muted-foreground">Date</p>
                  <p className="font-bold text-sm">{format(new Date(selectedBooking.date), "MMM d, yyyy")}</p>
                </div>
                <div className="space-y-0.5 text-right">
                  <p className="text-[10px] uppercase font-bold text-muted-foreground">Time</p>
                  <p className="font-bold text-sm">{selectedBooking.startTime} – {selectedBooking.endTime}</p>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-bold text-muted-foreground uppercase px-1">Cost Breakdown</p>
                <div className="bg-card border border-border rounded-xl p-3 space-y-1.5">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Charging ({selectedBooking.estimatedKWh} kWh)</span>
                    <span>{formatCurrency(selectedBooking.totalCost)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Platform Fee</span>
                    <span>{formatCurrency(selectedBooking.platformFee)}</span>
                  </div>
                  <div className="pt-1.5 border-t border-border flex justify-between font-bold">
                    <span>Grand Total</span>
                    <span className="text-primary">{formatCurrency(selectedBooking.grandTotal)}</span>
                  </div>
                </div>
              </div>

              {selectedBooking.status === "confirmed" && (
                <div className="bg-primary/10 border border-primary/20 rounded-xl p-3 flex items-start gap-3">
                  <Info className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-bold text-primary uppercase">Check-in Info</p>
                    <p className="text-sm text-primary/80">Use the 6-digit OTP sent to your email to start the session at the station.</p>
                  </div>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button className="w-full bg-[image:var(--gradient-primary)] text-primary-foreground rounded-xl" onClick={() => setSelectedBooking(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!otpFor} onOpenChange={(o) => !o && setOtpFor(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Enter check-in OTP</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">Enter the 6-digit OTP sent when you booked to start the charging session.</p>
          <Input value={otp} onChange={(e) => setOtp(e.target.value)} maxLength={6} placeholder="000000" className="text-center text-2xl tracking-[0.5em] font-mono h-14" />
          <DialogFooter>
            <Button variant="outline" onClick={() => setOtpFor(null)}>Cancel</Button>
            <Button onClick={checkIn} disabled={otp.length !== 6 || busyId === otpFor?._id} className="bg-[image:var(--gradient-primary)] text-primary-foreground">
              {busyId === otpFor?._id ? <Loader2 className="h-4 w-4 animate-spin" /> : "Verify & Start"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
