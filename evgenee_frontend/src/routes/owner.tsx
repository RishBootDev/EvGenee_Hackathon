import { createFileRoute, Link, Navigate, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth";
import { BookingsAPI, StationsAPI, type Booking, type Station } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Loader2, MapPin, Plus, Power, Zap, TrendingUp, Calendar, IndianRupee } from "lucide-react";
import { toast } from "sonner";
import { formatCurrency, getApiError } from "@/lib/utils";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, PieChart, Pie, Cell, Legend } from "recharts";
import { format } from "date-fns";

export const Route = createFileRoute("/owner")({
  component: OwnerPage,
});

function OwnerPage() {
  const { isOwner, loading: authLoading, isAuthed } = useAuth();
  const nav = useNavigate();
  const [stations, setStations] = useState<Station[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const r = await StationsAPI.myStations();
      const list: Station[] = r.data?.data ?? [];
      setStations(list);

      const all: Booking[] = [];
      for (const s of list) {
        try {
          const br = await BookingsAPI.station(s._id, { limit: 50 });
          all.push(...(br.data?.data ?? []));
        } catch { /* ignore per station */ }
      }
      setBookings(all);
    } catch (e) {
      toast.error(getApiError(e, "Failed to load owner data"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOwner) load();
  }, [isOwner]);

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
  if (!isOwner) return (
    <div className="max-w-md mx-auto p-6 text-center pt-20">
      <h2 className="text-xl font-bold">Owner access only</h2>
      <p className="text-muted-foreground mt-2">Sign up as a Station Owner to access this panel.</p>
      <Link to="/" className="text-primary font-semibold mt-4 inline-block">← Back to map</Link>
    </div>
  );

  const toggle = async (s: Station) => {
    setBusyId(s._id);
    try {
      await StationsAPI.toggle(s._id);
      load();
    } catch (e) {
      toast.error(getApiError(e, "Toggle failed"));
    } finally { setBusyId(null); }
  };

  const PIE_COLORS = ["oklch(0.68 0.19 148)", "oklch(0.78 0.17 75)", "oklch(0.62 0.18 200)", "oklch(0.62 0.22 27)", "oklch(0.7 0.18 60)"];

  return (
    <div className="max-w-3xl mx-auto p-4 space-y-4" style={{ paddingTop: "calc(var(--safe-top) + 1.5rem)" }}>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Owner Dashboard</h1>
          <p className="text-sm text-muted-foreground">Manage stations & bookings</p>
        </div>
        <Button onClick={() => nav({ to: "/owner/new" })} className="bg-[image:var(--gradient-primary)] text-primary-foreground shadow-[var(--shadow-glow)]">
          <Plus className="h-4 w-4 mr-1" />Add Station
        </Button>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi icon={<MapPin />} label="Stations" value={stations.length.toString()} />
        <Kpi icon={<Calendar />} label="Active Bookings" value={stats.active.toString()} />
        <Kpi icon={<Zap />} label="Total kWh" value={stats.totalKWh.toFixed(0)} />
        <Kpi icon={<IndianRupee />} label="Revenue" value={formatCurrency(stats.revenue)} />
      </div>

      {/* Charts */}
      <div className="grid md:grid-cols-2 gap-3">
        <div className="bg-card rounded-2xl p-4 shadow-[var(--shadow-card)]">
          <h3 className="font-bold mb-2 text-sm flex items-center gap-1.5"><TrendingUp className="h-4 w-4 text-primary" />Bookings (last 7 days)</h3>
          <div className="h-44">
            <ResponsiveContainer>
              <BarChart data={stats.trend}>
                <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="count" fill="oklch(0.68 0.19 148)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="bg-card rounded-2xl p-4 shadow-[var(--shadow-card)]">
          <h3 className="font-bold mb-2 text-sm">Booking status</h3>
          <div className="h-44">
            {stats.statusData.length === 0 ? (
              <div className="grid place-items-center h-full text-xs text-muted-foreground">No data</div>
            ) : (
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={stats.statusData} dataKey="value" nameKey="name" outerRadius={60} label>
                    {stats.statusData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* Stations list */}
      <div className="space-y-3">
        <h2 className="font-bold">Your Stations</h2>
        {loading ? (
          <div className="py-12 grid place-items-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : stations.length === 0 ? (
          <div className="bg-card rounded-2xl p-8 text-center shadow-[var(--shadow-card)]">
            <Zap className="h-12 w-12 mx-auto text-muted-foreground/30 mb-2" />
            <p className="font-semibold">No stations yet</p>
            <p className="text-sm text-muted-foreground">Add your first charging station to get started.</p>
          </div>
        ) : (
          stations.map((s) => (
            <div key={s._id} className="bg-card rounded-2xl p-4 shadow-[var(--shadow-card)] flex items-center gap-3">
              <div className="h-12 w-12 rounded-xl bg-[image:var(--gradient-primary)] grid place-items-center shrink-0">
                <Zap className="h-6 w-6 text-white" fill="white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold truncate">{s.name}</p>
                <p className="text-xs text-muted-foreground truncate">{s.address.city} · {s.availablePorts}/{s.totalPorts} ports · {s.openingHours}</p>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={s.isOpen} disabled={busyId === s._id} onCheckedChange={() => toggle(s)} />
                <Power className={`h-4 w-4 ${s.isOpen ? "text-success" : "text-muted-foreground"}`} />
              </div>
            </div>
          ))
        )}
      </div>

      {/* Recent station bookings */}
      {bookings.length > 0 && (
        <div className="bg-card rounded-2xl p-4 shadow-[var(--shadow-card)]">
          <h2 className="font-bold mb-2">Recent Bookings</h2>
          <div className="space-y-2 max-h-72 overflow-y-auto">
            {bookings.slice(0, 10).map((b) => {
              const u = typeof b.user === "object" ? b.user.name : "User";
              return (
                <div key={b._id} className="flex items-center justify-between text-sm border-b border-border last:border-0 pb-2 last:pb-0">
                  <div>
                    <p className="font-medium">{u}</p>
                    <p className="text-xs text-muted-foreground">{format(new Date(b.date), "MMM d")} · {b.startTime}-{b.endTime} · {b.connectorType}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold">{formatCurrency(b.grandTotal)}</p>
                    <p className="text-[10px] uppercase text-muted-foreground">{b.status}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function Kpi({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="bg-card rounded-2xl p-3 shadow-[var(--shadow-card)]">
      <div className="h-9 w-9 rounded-lg bg-accent grid place-items-center text-primary mb-2">{icon}</div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-bold text-lg truncate">{value}</p>
    </div>
  );
}
