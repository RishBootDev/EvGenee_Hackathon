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
                type: form.vehicleType as "EV" | "Hybrid" | "Petrol" | "Diesel",
                connectorType: form.connectorType as "CCS2" | "CHAdeMO" | "Type2",
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
    <div className="min-h-screen bg-[#000814] flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex h-14 w-14 rounded-2xl bg-gradient-to-br from-green-600 to-green-400 items-center justify-center mb-4">
            <FontAwesomeIcon icon={faChargingStation} className="h-7 w-7 text-white" />
          </div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight mb-1">Create account</h1>
          <p className="text-white/40 text-sm">Start charging smarter</p>
        </div>

        {/* Form */}
        <form
          onSubmit={submit}
          className="bg-white/[0.04] border border-white/8 rounded-3xl p-6 space-y-4"
        >
          {/* Name */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-white/40 uppercase tracking-wide">
              Full Name
            </Label>
            <Input
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="John Doe"
              className="bg-white/5 border-white/10 text-white placeholder:text-white/20 rounded-xl focus:border-primary/50"
            />
          </div>

          {/* Email */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-white/40 uppercase tracking-wide">
              Email
            </Label>
            <Input
              type="email"
              required
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="you@email.com"
              className="bg-white/5 border-white/10 text-white placeholder:text-white/20 rounded-xl focus:border-primary/50"
            />
          </div>

          {/* Password */}
          <div className="space-y-1.5 relative">
            <Label className="text-xs font-semibold text-white/40 uppercase tracking-wide">
              Password
            </Label>
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
                className="bg-white/5 border-white/10 text-white placeholder:text-white/20 rounded-xl focus:border-primary/50 pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>

            {/* Password Popup */}
            {showPopup && form.password.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-[#0a1628] border border-white/10 rounded-2xl p-4 shadow-2xl z-50">
                <p className="text-[10px] font-bold text-white/30 uppercase tracking-wider mb-3">
                  Password Requirements
                </p>
                <div className="flex flex-col gap-2">
                  {[
                    { key: "length", label: "At least 6 characters" },
                    { key: "uppercase", label: "1 uppercase letter (A-Z)" },
                    { key: "lowercase", label: "1 lowercase letter (a-z)" },
                    { key: "number", label: "1 number (0-9)" },
                    { key: "special", label: "1 special character (@$!%*?&#)" },
                  ].map(({ key, label }) => {
                    const passed = checks[key as keyof typeof checks];
                    return (
                      <div key={key} className="flex items-center gap-2.5">
                        <span
                          className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 ${passed ? "bg-green-500/15 text-green-400" : "bg-red-500/15 text-red-400"}`}
                        >
                          {passed ? "✓" : "✗"}
                        </span>
                        <span className={`text-xs ${passed ? "text-white/70" : "text-white/30"}`}>
                          {label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Role */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-white/40 uppercase tracking-wide">
              I am a
            </Label>
            <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
              <SelectTrigger className="bg-white/5 border-white/10 text-white rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#0a1628] border-white/10 text-white">
                <SelectItem value="user" className="text-white focus:bg-white/10">
                  EV Driver
                </SelectItem>
                <SelectItem value="StationOwner" className="text-white focus:bg-white/10">
                  Station Owner
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Vehicle fields */}
          {form.role === "user" && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-white/40 uppercase tracking-wide">
                  Vehicle
                </Label>
                <Select
                  value={form.vehicleType}
                  onValueChange={(v) => setForm({ ...form, vehicleType: v })}
                >
                  <SelectTrigger className="bg-white/5 border-white/10 text-white rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#0a1628] border-white/10 text-white">
                    {["EV", "Hybrid", "Petrol", "Diesel"].map((v) => (
                      <SelectItem key={v} value={v} className="text-white focus:bg-white/10">
                        {v}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-white/40 uppercase tracking-wide">
                  Connector
                </Label>
                <Select
                  value={form.connectorType}
                  onValueChange={(v) => setForm({ ...form, connectorType: v })}
                >
                  <SelectTrigger className="bg-white/5 border-white/10 text-white rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#0a1628] border-white/10 text-white">
                    {["CCS2", "CHAdeMO", "Type2"].map((v) => (
                      <SelectItem key={v} value={v} className="text-white focus:bg-white/10">
                        {v}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {/* Submit */}
          <Button
            type="submit"
            disabled={loading}
            className="w-full h-12 bg-gradient-to-r from-green-600 to-green-400 text-white font-bold rounded-xl text-base hover:opacity-90 transition-opacity"
          >
            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Create account"}
          </Button>

          <p className="text-center text-sm text-white/40">
            Already have an account?{" "}
            <Link to="/auth/login" className="text-primary font-semibold hover:underline">
              Sign in
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
