import { createFileRoute, Link, useNavigate, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Zap, Loader2 } from "lucide-react";
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
    <div className="min-h-screen bg-[image:var(--gradient-hero)] flex flex-col">
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <div className="inline-flex h-16 w-16 rounded-2xl bg-[image:var(--gradient-primary)] items-center justify-center shadow-[var(--shadow-glow)] mb-4 animate-float">
              <Zap className="h-8 w-8 text-white" fill="white" />
            </div>
            <h1 className="text-3xl font-bold tracking-tight">EvGenee</h1>
            <p className="text-muted-foreground mt-1">Sign in to find chargers near you</p>
          </div>

          <form onSubmit={submit} className="bg-card rounded-3xl p-6 shadow-[var(--shadow-card)] space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            <Button type="submit" disabled={loading} className="w-full h-12 bg-[image:var(--gradient-primary)] text-primary-foreground shadow-[var(--shadow-glow)] text-base font-semibold">
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Sign In"}
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              No account?{" "}
              <Link to="/auth/register" className="text-primary font-semibold">Register</Link>
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
