import { createFileRoute, Navigate, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { AuthAPI } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Loader2, LogOut, Mail, Shield, User as UserIcon } from "lucide-react";
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

  if (loading) return <div className="h-screen grid place-items-center"><Loader2 className="h-7 w-7 animate-spin text-primary" /></div>;
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
    <div className="max-w-2xl mx-auto p-4" style={{ paddingTop: "calc(var(--safe-top) + 1.5rem)" }}>
      <div className="bg-[image:var(--gradient-primary)] rounded-3xl p-6 text-white shadow-[var(--shadow-glow)]">
        <div className="flex items-center gap-4">
          <Avatar className="h-16 w-16 border-4 border-white/30">
            <AvatarFallback className="bg-white/20 text-white text-2xl font-bold">{user.name?.charAt(0).toUpperCase()}</AvatarFallback>
          </Avatar>
          <div>
            <h1 className="text-xl font-bold">{user.name}</h1>
            <p className="text-sm opacity-90 flex items-center gap-1"><Mail className="h-3.5 w-3.5" />{user.email}</p>
            <p className="text-xs opacity-80 flex items-center gap-1 mt-1"><Shield className="h-3 w-3" />{user.role}</p>
          </div>
        </div>
      </div>

      <div className="bg-card rounded-2xl p-5 mt-4 shadow-[var(--shadow-card)] space-y-4">
        <h2 className="font-bold flex items-center gap-2"><UserIcon className="h-4 w-4" />Account</h2>
        <div className="space-y-1.5">
          <Label>Full name</Label>
          <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </div>

        {user.role === "user" && (
          <>
            <h3 className="font-bold pt-2">Vehicle</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Type</Label>
                <Select value={form.vehicleType} onValueChange={(v) => setForm({ ...form, vehicleType: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["EV", "Hybrid", "Petrol", "Diesel"].map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Connector</Label>
                <Select value={form.connectorType} onValueChange={(v) => setForm({ ...form, connectorType: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["CCS2", "CHAdeMO", "Type2"].map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Battery capacity (kWh)</Label>
              <Input type="number" value={form.batteryCapacity} onChange={(e) => setForm({ ...form, batteryCapacity: e.target.value })} />
            </div>
          </>
        )}

        <Button onClick={save} disabled={saving} className="w-full bg-[image:var(--gradient-primary)] text-primary-foreground shadow-[var(--shadow-glow)]">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save changes"}
        </Button>
      </div>

      <Button variant="outline" onClick={handleLogout} className="w-full mt-4 text-destructive border-destructive/30 hover:bg-destructive/10">
        <LogOut className="h-4 w-4 mr-2" />Sign out
      </Button>
    </div>
  );
}
