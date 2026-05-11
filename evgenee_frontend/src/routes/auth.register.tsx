import { createFileRoute, Link, useNavigate, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { useAuth } from "@/lib/auth";
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
import { Loader2, Eye, EyeOff } from "lucide-react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faChargingStation } from "@fortawesome/free-solid-svg-icons";
import { toast } from "sonner";
import { getApiError } from "@/lib/utils";
import { tokenStore } from "@/lib/api";

export const Route = createFileRoute("/auth/register")({
  beforeLoad: () => {
    if (typeof window !== "undefined" && tokenStore.get()) {
      throw redirect({ to: "/" });
    }
  },
  component: RegisterPage,
});

function getPasswordChecks(password: string) {
  return {
    length: password.length >= 6,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    number: /\d/.test(password),
    special: /[@$!%*?&#]/.test(password),
  };
}

function RegisterPage() {
  const { register } = useAuth();
  const nav = useNavigate();
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    role: "user",
    vehicleType: "EV",
    connectorType: "Type2",
    batteryCapacity: "",
  });
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showPopup, setShowPopup] = useState(false);

  const checks = getPasswordChecks(form.password);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await register({
        name: form.name,
        email: form.email,
        password: form.password,
        role: form.role,
        vehicle:
          form.role === "user"
            ? {
                type: form.vehicleType as any,
                connectorType: form.connectorType as any,
                batteryCapacity: form.batteryCapacity ? Number(form.batteryCapacity) : undefined,
              }
            : undefined,
      });
      toast.success("Account created!");
      nav({ to: "/" });
    } catch (err) {
      toast.error(getApiError(err, "Registration failed"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen bg-[#000814] flex flex-col items-center justify-center p-6 overflow-hidden relative"
      style={{ fontFamily: "'DM Sans', sans-serif" }}
    >
      {/* Premium Background Image */}
      <div className="fixed inset-0 z-0">
        <img
          src="/hero-bg.png"
          alt="EV Charging"
          className="w-full h-full object-cover opacity-30"
        />
        <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-[2px]" />
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
        className="fixed top-0 right-0 w-[600px] h-[500px] pointer-events-none z-10"
        style={{
          background: "radial-gradient(ellipse at 100% 0%, rgba(16,185,129,0.1) 0%, transparent 70%)",
        }}
      />
      <div
        className="fixed bottom-0 left-0 w-[500px] h-[500px] pointer-events-none z-10"
        style={{
          background: "radial-gradient(ellipse at 0% 100%, rgba(59,130,246,0.1) 0%, transparent 70%)",
        }}
      />

      <div className="w-full max-w-sm relative z-10">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="inline-flex h-16 w-16 rounded-2xl bg-gradient-to-br from-green-600 to-green-400 items-center justify-center mb-5 shadow-lg shadow-green-500/20">
            <FontAwesomeIcon icon={faChargingStation} className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight mb-2" style={{ fontFamily: "'Poppins', sans-serif" }}>
            Get Started
          </h1>
          <p className="text-white/40 text-sm">Join the EvGenee charging network.</p>
        </div>

        {/* Form Card */}
        <form
          onSubmit={submit}
          className="bg-white/[0.03] backdrop-blur-xl border border-white/8 rounded-[2rem] p-8 space-y-5 shadow-2xl"
        >
          <div className="space-y-3.5">
            <div className="space-y-1.5">
              <Label className="text-[10px] font-bold text-white/30 uppercase tracking-[0.15em] ml-1">Full Name</Label>
              <Input
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="John Doe"
                className="bg-white/5 border-white/10 text-white placeholder:text-white/20 h-11 rounded-xl focus:ring-green-500/20"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-[10px] font-bold text-white/30 uppercase tracking-[0.15em] ml-1">Email Address</Label>
              <Input
                type="email"
                required
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="you@email.com"
                className="bg-white/5 border-white/10 text-white placeholder:text-white/20 h-11 rounded-xl focus:ring-green-500/20"
              />
            </div>

            <div className="space-y-1.5 relative">
              <Label className="text-[10px] font-bold text-white/30 uppercase tracking-[0.15em] ml-1">Password</Label>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  required
                  minLength={6}
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  onFocus={() => setShowPopup(true)}
                  onBlur={() => setTimeout(() => setShowPopup(false), 200)}
                  placeholder="Min. 6 characters"
                  className="bg-white/5 border-white/10 text-white placeholder:text-white/20 h-11 rounded-xl focus:ring-green-500/20 pr-12"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-white/20 hover:text-white/50 transition-colors"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>

              {/* Password Requirements Popup */}
              {showPopup && form.password.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-[#000814] border border-white/10 rounded-2xl p-4 shadow-2xl z-50 animate-in fade-in slide-in-from-top-2">
                  <p className="text-[9px] font-bold text-white/20 uppercase tracking-widest mb-3">Requirements</p>
                  <div className="grid grid-cols-1 gap-2">
                    {Object.entries(checks).map(([key, passed]) => (
                      <div key={key} className="flex items-center gap-2">
                        <div className={`w-1.5 h-1.5 rounded-full ${passed ? 'bg-green-500' : 'bg-white/10'}`} />
                        <span className={`text-[10px] ${passed ? 'text-white/80' : 'text-white/20'}`}>
                          {key === 'length' && '6+ characters'}
                          {key === 'uppercase' && 'Uppercase'}
                          {key === 'lowercase' && 'Lowercase'}
                          {key === 'number' && 'Number'}
                          {key === 'special' && 'Special symbol'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <Label className="text-[10px] font-bold text-white/30 uppercase tracking-[0.15em] ml-1">Role</Label>
              <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
                <SelectTrigger className="bg-white/5 border-white/10 text-white h-11 rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#000814] border-white/10 text-white">
                  <SelectItem value="user">EV Driver</SelectItem>
                  <SelectItem value="StationOwner">Station Owner</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button
            type="submit"
            disabled={loading}
            className="w-full h-12 bg-green-500 hover:bg-green-400 text-black font-bold rounded-full text-base transition-all shadow-lg shadow-green-500/20 active:scale-[0.98]"
          >
            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Create Account"}
          </Button>

          <p className="text-center text-sm text-white/30">
            Have an account?{" "}
            <Link to="/auth/login" className="text-white font-bold hover:text-green-400 transition-colors">
              Sign in
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
