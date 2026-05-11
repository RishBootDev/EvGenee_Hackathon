import { createFileRoute, Link, useNavigate, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Eye, EyeOff } from "lucide-react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faChargingStation } from "@fortawesome/free-solid-svg-icons";
import { toast } from "sonner";
import { getApiError } from "@/lib/utils";
import { tokenStore } from "@/lib/api";

export const Route = createFileRoute("/auth/login")({
  beforeLoad: () => {
    if (typeof window !== "undefined" && tokenStore.get()) {
      throw redirect({ to: "/" });
    }
  },
  component: LoginPage,
});

function LoginPage() {
  const { login } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(email, password);
      toast.success("Welcome back!");
      nav({ to: "/" });
    } catch (err) {
      toast.error(getApiError(err, "Login failed"));
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
          className="w-full h-full object-cover opacity-40"
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
        className="fixed top-0 left-0 w-[600px] h-[500px] pointer-events-none z-10"
        style={{
          background: "radial-gradient(ellipse at 0% 0%, rgba(59,130,246,0.15) 0%, transparent 70%)",
        }}
      />
      <div
        className="fixed bottom-0 right-0 w-[500px] h-[500px] pointer-events-none z-10"
        style={{
          background: "radial-gradient(ellipse at 100% 100%, rgba(16,185,129,0.1) 0%, transparent 70%)",
        }}
      />

      <div className="w-full max-w-sm relative z-10">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="inline-flex h-16 w-16 rounded-2xl bg-gradient-to-br from-green-600 to-green-400 items-center justify-center mb-5 shadow-lg shadow-green-500/20">
            <FontAwesomeIcon icon={faChargingStation} className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight mb-2" style={{ fontFamily: "'Poppins', sans-serif" }}>
            EvGenee
          </h1>
          <p className="text-white/40 text-sm">Welcome back. Sign in to your account.</p>
        </div>

        {/* Form Card */}
        <form
          onSubmit={submit}
          className="bg-white/[0.03] backdrop-blur-xl border border-white/8 rounded-[2rem] p-8 space-y-6 shadow-2xl"
        >
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-[10px] font-bold text-white/30 uppercase tracking-[0.15em] ml-1">Email Address</Label>
              <Input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@email.com"
                className="bg-white/5 border-white/10 text-white placeholder:text-white/20 h-12 rounded-xl focus:ring-green-500/20"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between ml-1">
                <Label className="text-[10px] font-bold text-white/30 uppercase tracking-[0.15em]">Password</Label>
                <Link
                  to="/auth/forgot-password"
                  className="text-[10px] font-bold text-green-400 hover:text-green-300 uppercase tracking-widest transition-colors"
                >
                  Forgot?
                </Link>
              </div>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="bg-white/5 border-white/10 text-white placeholder:text-white/20 h-12 rounded-xl focus:ring-green-500/20 pr-12"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-white/20 hover:text-white/50 transition-colors"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
          </div>

          <Button
            type="submit"
            disabled={loading}
            className="w-full h-12 bg-green-500 hover:bg-green-400 text-black font-bold rounded-full text-base transition-all shadow-lg shadow-green-500/20 active:scale-[0.98]"
          >
            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Sign In"}
          </Button>

          <p className="text-center text-sm text-white/30">
            Don't have an account?{" "}
            <Link to="/auth/register" className="text-white font-bold hover:text-green-400 transition-colors">
              Create one
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
