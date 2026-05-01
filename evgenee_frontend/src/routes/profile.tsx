import { createFileRoute, Navigate, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { AuthAPI } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Loader2, LogOut, Mail, Shield } from "lucide-react";
import { toast } from "sonner";
import { getApiError } from "@/lib/utils";

export const Route = createFileRoute("/profile")({
  component: ProfilePage,
});

function ProfilePage() {
  const { user, loading, isAuthed, logout, refresh } = useAuth();
  const nav = useNavigate();
  const [form, setForm] = useState({ name: "", vehicleType: "EV", connectorType: "Type2", batteryCapacity: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user) {
      setForm({
        name: user.name ?? "",
        vehicleType: user.vehicle?.type ?? "EV",
        connectorType: user.vehicle?.connectorType ?? "Type2",
        batteryCapacity: user.vehicle?.batteryCapacity?.toString() ?? "",
      });
    }
  }, [user]);

  if (loading) return (
    <div className="h-screen grid place-items-center bg-[#000814]">
      <Loader2 className="h-7 w-7 animate-spin text-primary" />
    </div>
  );
  if (!isAuthed || !user) return <Navigate to="/auth/login" />;

  const save = async () => {
    setSaving(true);
    try {
      await AuthAPI.updateProfile({
        name: form.name,
        vehicle: {
          type: form.vehicleType as "EV" | "Hybrid" | "Petrol" | "Diesel",
          connectorType: form.connectorType as "CCS2" | "CHAdeMO" | "Type2",
          batteryCapacity: form.batteryCapacity ? Number(form.batteryCapacity) : undefined,
        },
      });
      await refresh();
      toast.success("Profile updated");
    } catch (e) {
      toast.error(getApiError(e, "Update failed"));
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    nav({ to: "/auth/login" });
  };

  return (
    <div
      className="min-h-screen bg-[#000814] text-white"
      style={{ paddingBottom: "5rem" }}
    >
      <div className="max-w-2xl mx-auto px-4" style={{ paddingTop: "calc(var(--safe-top) + 2rem)" }}>

        {/* Profile Header */}
        <div className="relative bg-gradient-to-br from-green-600 to-green-400 rounded-3xl p-6 mb-4 overflow-hidden">
          <div className="absolute -top-6 -right-6 w-28 h-28 bg-white/10 rounded-full" />
          <div className="absolute -bottom-8 left-1/3 w-32 h-32 bg-white/5 rounded-full" />
          <div className="relative z-10 flex items-center gap-4">
            <Avatar className="h-16 w-16 border-4 border-white/30 shrink-0">
              <AvatarFallback className="bg-white/20 text-white text-2xl font-bold">
                {user.name?.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div>
              <h1 className="text-xl font-extrabold text-white mb-1">{user.name}</h1>
              <p className="text-xs text-white/80 flex items-center gap-1 mb-2">
                <Mail className="h-3 w-3" />{user.email}
              </p>
              <div className="inline-flex items-center gap-1 bg-white/15 rounded-full px-3 py-1">
                <Shield className="h-3 w-3 text-white/80" />
                <span className="text-xs text-white/90 font-600">User</span>
              </div>
            </div>
          </div>
        </div>

        {/* Account Section */}
        <div className="bg-white/[0.04] border border-white/8 rounded-2xl p-5 mb-3">
          <h2 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
            <span className="bg-primary/15 border border-primary/20 rounded-lg px-3 py-1 text-xs text-primary font-semibold">
              Account
            </span>
          </h2>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-white/40 uppercase tracking-wide">Full Name</Label>
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="bg-white/5 border-white/10 text-white placeholder:text-white/20 rounded-xl focus:border-primary/50 focus:ring-primary/20"
            />
          </div>
        </div>

        {/* Vehicle Section */}
        {user.role === "user" && (
          <div className="bg-white/[0.04] border border-white/8 rounded-2xl p-5 mb-3">
            <h2 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
              <span className="bg-blue-500/15 border border-blue-500/20 rounded-lg px-3 py-1 text-xs text-blue-400 font-semibold">
                Vehicle
              </span>
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-white/40 uppercase tracking-wide">Type</Label>
                <Select value={form.vehicleType} onValueChange={(v) => setForm({ ...form, vehicleType: v })}>
                  <SelectTrigger className="bg-white/5 border-white/10 text-white rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#0a1628] border-white/10 text-white">
                    {["EV", "Hybrid", "Petrol", "Diesel"].map((v) => (
                      <SelectItem key={v} value={v} className="text-white hover:bg-white/10 focus:bg-white/10">{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-white/40 uppercase tracking-wide">Connector</Label>
                <Select value={form.connectorType} onValueChange={(v) => setForm({ ...form, connectorType: v })}>
                  <SelectTrigger className="bg-white/5 border-white/10 text-white rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#0a1628] border-white/10 text-white">
                    {["CCS2", "CHAdeMO", "Type2"].map((v) => (
                      <SelectItem key={v} value={v} className="text-white hover:bg-white/10 focus:bg-white/10">{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-white/40 uppercase tracking-wide">Battery Capacity (kWh)</Label>
              <Input
                type="number"
                value={form.batteryCapacity}
                onChange={(e) => setForm({ ...form, batteryCapacity: e.target.value })}
                className="bg-white/5 border-white/10 text-white placeholder:text-white/20 rounded-xl focus:border-primary/50"
                placeholder="e.g. 75"
              />
            </div>
          </div>
        )}

        {/* Save Button */}
        <Button
          onClick={save}
          disabled={saving}
          className="w-full bg-gradient-to-r from-green-600 to-green-400 text-white font-bold rounded-xl h-12 mb-3 hover:opacity-90 transition-opacity"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Changes"}
        </Button>

        {/* Sign Out */}
        <Button
          variant="outline"
          onClick={handleLogout}
          className="w-full border-red-500/20 bg-red-500/8 text-red-400 hover:bg-red-500/15 rounded-xl h-12 font-semibold"
        >
          <LogOut className="h-4 w-4 mr-2" />Sign out
        </Button>

      </div>
    </div>
  );
}
