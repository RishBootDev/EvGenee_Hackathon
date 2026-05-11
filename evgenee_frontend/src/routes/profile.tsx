import { createFileRoute, Navigate, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { AuthAPI } from "@/lib/api";
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
import {
  Loader2,
  LogOut,
  Mail,
  Shield,
  User,
  Zap,
  Car,
  Plug,
  CheckCircle2,
  Plus,
  X,
  Settings2,
  Pencil,
  Hash,
} from "lucide-react";
import { toast } from "sonner";
import { getApiError } from "@/lib/utils";

export const Route = createFileRoute("/profile")({
  component: ProfilePage,
});

type SavedVehicle = {
  nickname: string;
  type: string;
  connectorType: string;
  batteryCapacity?: number;
  vehicleNumber?: string;
};

function ProfilePage() {
  const { user, loading, isAuthed, logout, refresh } = useAuth();
  const nav = useNavigate();

  const [form, setForm] = useState({
    name: "",
  });
  
  const [savedVehicles, setSavedVehicles] = useState<SavedVehicle[]>([]);
  const [newVehicle, setNewVehicle] = useState<SavedVehicle>({
    nickname: "",
    type: "EV",
    connectorType: "CCS2",
    batteryCapacity: undefined,
    vehicleNumber: ""
  });
  const [showAddForm, setShowAddForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [processingVehicle, setProcessingVehicle] = useState(false);

  useEffect(() => {
    if (user) {
      setForm({
        name: user.name ?? "",
      });
      setSavedVehicles((user as any).savedVehicles ?? []);
    }
  }, [user]);

  if (loading)
    return (
      <div className="h-screen grid place-items-center bg-[#000814]">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  if (!isAuthed || !user) return <Navigate to="/auth/login" />;

  const addVehicle = async () => {
    if (!newVehicle.nickname) {
      toast.error("Nickname is required");
      return;
    }
    
    setProcessingVehicle(true);
    const updatedFleet = [...savedVehicles, newVehicle];
    
    try {
      await AuthAPI.updateProfile({
        savedVehicles: updatedFleet as any,
      });
      setSavedVehicles(updatedFleet);
      await refresh();
      setNewVehicle({
        nickname: "",
        type: "EV",
        connectorType: "CCS2",
        batteryCapacity: undefined,
        vehicleNumber: ""
      });
      setShowAddForm(false);
      toast.success("Vehicle registered successfully");
    } catch (e) {
      toast.error(getApiError(e, "Failed to register vehicle"));
    } finally {
      setProcessingVehicle(false);
    }
  };

  const removeVehicle = async (index: number) => {
    setProcessingVehicle(true);
    const updatedFleet = savedVehicles.filter((_, i) => i !== index);
    
    try {
      await AuthAPI.updateProfile({
        savedVehicles: updatedFleet as any,
      });
      setSavedVehicles(updatedFleet);
      await refresh();
      toast.success("Vehicle removed");
    } catch (e) {
      toast.error(getApiError(e, "Failed to remove vehicle"));
    } finally {
      setProcessingVehicle(false);
    }
  };

  const save = async () => {
    setSaving(true);
    try {
      await AuthAPI.updateProfile({
        name: form.name,
        savedVehicles: savedVehicles as any,
      });
      await refresh();
      toast.success("Profile saved");
    } catch (e) {
      toast.error(getApiError(e, "Failed to save"));
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    nav({ to: "/auth/login" });
  };

  const initials = user.name
    ?.split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <div
      className="min-h-screen bg-[#000814] text-white overflow-x-hidden"
      style={{ paddingBottom: "5.5rem", fontFamily: "'DM Sans', sans-serif" }}
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

      {/* Background glows */}
      <div
        className="fixed top-0 left-0 w-[600px] h-[400px] pointer-events-none z-10"
        style={{
          background: "radial-gradient(ellipse at 0% 0%, rgba(16,185,129,0.1) 0%, transparent 70%)",
        }}
      />
      <div
        className="fixed bottom-0 right-0 w-[500px] h-[400px] pointer-events-none z-10"
        style={{
          background: "radial-gradient(ellipse at 100% 100%, rgba(59,130,246,0.08) 0%, transparent 70%)",
        }}
      />

      <div
        className="relative z-10 max-w-lg mx-auto px-4"
        style={{ paddingTop: "calc(var(--safe-top, 0px) + 1.5rem)" }}
      >
        {/* ── Hero Header - RESTORED ORIGINAL ─────────────────────────── */}
        <div className="relative rounded-3xl overflow-hidden mb-5">
          <div
            style={{
              background: "linear-gradient(135deg, #064e3b 0%, #065f46 40%, #047857 70%, #10b981 100%)",
            }}
            className="absolute inset-0"
          />
          <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/5 rounded-full" />
          <div className="absolute -bottom-12 left-1/4 w-48 h-48 bg-white/[0.03] rounded-full" />
          <div className="absolute top-4 right-16 w-6 h-6 bg-white/10 rounded-full" />
          <div className="absolute bottom-8 right-8 w-3 h-3 bg-green-300/30 rounded-full" />
          <div
            className="absolute inset-0 opacity-[0.04]"
            style={{
              backgroundImage: "repeating-linear-gradient(0deg, white 0px, white 1px, transparent 1px, transparent 40px), repeating-linear-gradient(90deg, white 0px, white 1px, transparent 1px, transparent 40px)",
            }}
          />

          <div className="relative z-10 p-6 pb-5">
            <div className="flex items-center gap-4 mb-5">
              <div className="relative">
                <div className="h-[72px] w-[72px] rounded-2xl bg-white/20 border-2 border-white/30 flex items-center justify-center text-2xl font-black text-white shadow-xl">
                  {initials}
                </div>
                <div className="absolute -bottom-1 -right-1 h-5 w-5 bg-green-400 rounded-full border-2 border-[#065f46] flex items-center justify-center">
                  <div className="h-1.5 w-1.5 bg-white rounded-full" />
                </div>
              </div>

              <div className="flex-1 min-w-0">
                <h1 className="text-xl font-extrabold text-white leading-tight truncate" style={{ fontFamily: "'Poppins', sans-serif" }}>
                  {user.name}
                </h1>
                <p className="text-white/65 text-xs flex items-center gap-1.5 mt-0.5 truncate">
                  <Mail className="h-3 w-3 shrink-0" />
                  {user.email}
                </p>
                <div className="flex items-center gap-2 mt-2">
                  <span className="inline-flex items-center gap-1 bg-white/15 backdrop-blur-sm rounded-full px-2.5 py-0.5 border border-white/20">
                    <Shield className="h-3 w-3 text-green-200" />
                    <span className="text-[11px] font-semibold text-white/90 capitalize">
                      {user.role}
                    </span>
                  </span>
                  <span className="inline-flex items-center gap-1 bg-green-400/20 rounded-full px-2.5 py-0.5 border border-green-300/20">
                    <CheckCircle2 className="h-3 w-3 text-green-300" />
                    <span className="text-[11px] font-semibold text-green-200">Verified</span>
                  </span>
                </div>
              </div>
            </div>

            {/* Stats strip - Restored original style with Fleet info */}
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: "Fleet Size", value: savedVehicles.length.toString(), icon: Car },
                {
                  label: "Connectors",
                  value: Array.from(new Set(savedVehicles.map(v => v.connectorType))).join(', ') || "—",
                  icon: Plug,
                },
                { label: "Status", value: "Active", icon: Zap },
              ].map(({ label, value, icon: Icon }) => (
                <div key={label} className="bg-white/10 backdrop-blur-sm rounded-xl p-2.5 border border-white/10 text-center">
                  <Icon className="h-3.5 w-3.5 text-green-200 mx-auto mb-1" />
                  <p className="text-white font-bold text-[10px] leading-tight mb-0.5 truncate px-1">{value}</p>
                  <p className="text-white/50 text-[9px] uppercase tracking-tighter">{label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Fleet Management ────────────────────────────────────────── */}
        <div className="rounded-2xl p-5 mb-3 border border-white/10 bg-white/[0.04] backdrop-blur-md">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="h-7 w-7 rounded-lg bg-blue-500/15 border border-blue-500/20 flex items-center justify-center">
                <Car className="h-3.5 w-3.5 text-blue-400" />
              </div>
              <span className="text-sm font-bold text-white">My Fleet</span>
            </div>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setShowAddForm(!showAddForm)}
              className="h-8 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/10"
            >
              {showAddForm ? <X className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
              {showAddForm ? "Cancel" : "Add Car"}
            </Button>
          </div>

          {showAddForm && (
            <div className="bg-white/5 border border-white/10 rounded-2xl p-4 mb-4 space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-[10px] text-white/40 uppercase">Nickname</Label>
                  <Input
                    placeholder="e.g. My Nexon"
                    value={newVehicle.nickname}
                    onChange={(e) => setNewVehicle({ ...newVehicle, nickname: e.target.value })}
                    className="bg-black/20 border-white/10 h-10 text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] text-white/40 uppercase">Reg. Number</Label>
                  <Input
                    placeholder="MH 01..."
                    value={newVehicle.vehicleNumber}
                    onChange={(e) => setNewVehicle({ ...newVehicle, vehicleNumber: e.target.value.toUpperCase() })}
                    className="bg-black/20 border-white/10 h-10 text-sm font-mono"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-[10px] text-white/40 uppercase">Type</Label>
                  <Select value={newVehicle.type} onValueChange={(v) => setNewVehicle({ ...newVehicle, type: v })}>
                    <SelectTrigger className="bg-black/20 border-white/10 h-10 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-[#000814] text-white border-white/10">
                      {["EV", "Hybrid", "Petrol", "Diesel"].map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] text-white/40 uppercase">Connector</Label>
                  <Select value={newVehicle.connectorType} onValueChange={(v) => setNewVehicle({ ...newVehicle, connectorType: v })}>
                    <SelectTrigger className="bg-black/20 border-white/10 h-10 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-[#000814] text-white border-white/10">
                      {["CCS2", "CHAdeMO", "Type2"].map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button 
                onClick={addVehicle} 
                disabled={processingVehicle}
                className="w-full h-10 bg-blue-600 hover:bg-blue-700 font-bold rounded-xl"
              >
                {processingVehicle ? <Loader2 className="h-4 w-4 animate-spin" /> : "Register Car"}
              </Button>
            </div>
          )}

          <div className="space-y-2">
            {savedVehicles.map((v, i) => (
              <div key={i} className="flex items-center gap-3 bg-blue-500/10 border border-blue-500/10 rounded-xl p-3 group">
                <Car className="h-4 w-4 text-blue-400" />
                <div className="flex-1">
                  <p className="text-xs font-bold text-white leading-none">{v.nickname}</p>
                  <p className="text-[9px] text-blue-300/60 mt-1 uppercase tracking-tight">{v.type} · {v.connectorType} · {v.vehicleNumber || 'N/A'}</p>
                </div>
                <button 
                  disabled={processingVehicle}
                  onClick={() => removeVehicle(i)} 
                  className="text-white/20 hover:text-red-400 transition-colors disabled:opacity-30"
                >
                  {processingVehicle ? <Loader2 className="h-3 w-3 animate-spin" /> : <X className="h-3.5 w-3.5" />}
                </button>
              </div>
            ))}
            {savedVehicles.length === 0 && !showAddForm && <p className="text-center py-4 text-xs text-white/20">Fleet is currently empty</p>}
          </div>
        </div>

        {/* ── Account Section ───────────────────────────────────────── */}
        <div className="rounded-2xl p-5 mb-3 border border-white/10 bg-white/[0.04] backdrop-blur-md">
          <div className="flex items-center gap-2 mb-4">
            <div className="h-7 w-7 rounded-lg bg-green-500/15 border border-green-500/20 flex items-center justify-center">
              <User className="h-3.5 w-3.5 text-green-400" />
            </div>
            <span className="text-sm font-bold text-white">Profile Settings</span>
          </div>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-[11px] font-semibold text-white/40 uppercase tracking-widest">Full Name</Label>
              <div className="relative">
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="bg-white/[0.05] border-white/10 text-white rounded-xl h-11 pr-10"
                />
                <Pencil className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/20" />
              </div>
            </div>
          </div>
        </div>

        {/* ── Actions ─────────────────────────────────────────────── */}
        <div className="space-y-3">
          <button
            onClick={save}
            disabled={saving}
            className="w-full h-12 rounded-2xl font-bold text-sm text-white mb-1 transition-all active:scale-[0.98] disabled:opacity-70"
            style={{
              background: "linear-gradient(90deg, #059669 0%, #10b981 100%)",
              boxShadow: "0 0 20px rgba(16,185,129,0.2)",
            }}
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : "Save Changes"}
          </button>

          <button
            onClick={handleLogout}
            className="w-full h-12 rounded-2xl font-semibold text-sm text-red-400 border border-red-500/10 hover:bg-red-500/10 transition-colors"
          >
            <LogOut className="h-4 w-4 inline mr-2" /> Sign out
          </button>
        </div>
      </div>
    </div>
  );
}
