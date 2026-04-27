import { createFileRoute, Link, useNavigate, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Zap, Loader2 } from "lucide-react";
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
    <div className="min-h-screen bg-[image:var(--gradient-hero)] flex flex-col">
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="text-center mb-6">
            <div className="inline-flex h-14 w-14 rounded-2xl bg-[image:var(--gradient-primary)] items-center justify-center shadow-[var(--shadow-glow)] mb-3">
              <Zap className="h-7 w-7 text-white" fill="white" />
            </div>
            <h1 className="text-2xl font-bold">Create account</h1>
            <p className="text-muted-foreground text-sm mt-1">Start charging smarter</p>
          </div>

          <form onSubmit={submit} className="bg-card rounded-3xl p-5 shadow-[var(--shadow-card)] space-y-3">
            <div className="space-y-1.5">
              <Label>Full name</Label>
              <Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Password</Label>
              <Input type="password" required minLength={6} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>I am a</Label>
              <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">EV Driver</SelectItem>
                  <SelectItem value="StationOwner">Station Owner</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {form.role === "user" && (
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5">
                  <Label>Vehicle</Label>
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
            )}

            <Button type="submit" disabled={loading} className="w-full h-12 bg-[image:var(--gradient-primary)] text-primary-foreground shadow-[var(--shadow-glow)] text-base font-semibold">
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Create account"}
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              Already have an account?{" "}
              <Link to="/auth/login" className="text-primary font-semibold">Sign in</Link>
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
