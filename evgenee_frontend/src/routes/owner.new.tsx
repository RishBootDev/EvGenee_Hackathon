import { createFileRoute, Navigate, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { StationsAPI } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Loader2, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { getApiError } from "@/lib/utils";

export const Route = createFileRoute("/owner/new")({
  component: NewStation,
});

function NewStation() {
  const { isOwner, isAuthed, loading } = useAuth();
  const nav = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    name: "",
    operator: "",
    street: "", city: "", state: "", country: "India", postalCode: "",
    lat: "", lng: "",
    totalPorts: "4", availablePorts: "4", chargingSpeed: "50",
    openingHours: "06:00 - 22:00",
    phone: "", email: "",
    amenities: "Restroom, Cafe, WiFi",
    image: "",
  });
  const [connectors, setConnectors] = useState<{ type: string; price: string }[]>([
    { type: "CCS2", price: "18" },
    { type: "Type2", price: "12" },
  ]);

  if (loading) return <div className="h-screen grid place-items-center"><Loader2 className="h-7 w-7 animate-spin text-primary" /></div>;
  if (!isAuthed) return <Navigate to="/auth/login" />;
  if (!isOwner) return <Navigate to="/" />;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const types = connectors.map((c) => c.type);
      await StationsAPI.add({
        name: form.name,
        operator: form.operator,
        location: { type: "Point", coordinates: [parseFloat(form.lng), parseFloat(form.lat)] },
        address: {
          street: form.street, city: form.city, state: form.state,
          country: form.country, postalCode: form.postalCode,
        },
        amenities: form.amenities.split(",").map((s) => s.trim()).filter(Boolean),
        totalPorts: Number(form.totalPorts),
        availablePorts: Number(form.availablePorts),
        chargingSpeed: Number(form.chargingSpeed),
        typeOfConnectors: types,
        pricing: connectors.map((c) => ({ connectorType: c.type, priceperKWh: Number(c.price), currency: "INR" })),
        openingHours: form.openingHours,
        contactInfo: { phoneNumber: form.phone, email: form.email },
        Images: form.image ? [form.image] : [],
      });
      toast.success("Station added!");
      nav({ to: "/owner" });
    } catch (e) {
      toast.error(getApiError(e, "Failed to add station"));
    } finally { setSubmitting(false); }
  };

  const useMyLocation = () => {
    navigator.geolocation?.getCurrentPosition(
      (p) => setForm((f) => ({ ...f, lat: p.coords.latitude.toString(), lng: p.coords.longitude.toString() })),
      () => toast.error("Couldn't get location")
    );
  };

  return (
    <div className="max-w-2xl mx-auto p-4 pb-8" style={{ paddingTop: "calc(var(--safe-top) + 1.5rem)" }}>
      <button onClick={() => nav({ to: "/owner" })} className="mb-4 flex items-center gap-1 text-sm font-semibold text-muted-foreground">
        <ArrowLeft className="h-4 w-4" />Back
      </button>
      <h1 className="text-2xl font-bold mb-4">Add Station</h1>

      <form onSubmit={submit} className="space-y-4">
        <Section title="Basic">
          <Field label="Name"><Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
          <Field label="Operator"><Input required value={form.operator} onChange={(e) => setForm({ ...form, operator: e.target.value })} /></Field>
          <Field label="Image URL"><Input value={form.image} onChange={(e) => setForm({ ...form, image: e.target.value })} placeholder="https://..." /></Field>
        </Section>

        <Section title="Location">
          <Field label="Street"><Input required value={form.street} onChange={(e) => setForm({ ...form, street: e.target.value })} /></Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="City"><Input required value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></Field>
            <Field label="State"><Input required value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} /></Field>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Country"><Input required value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} /></Field>
            <Field label="Postal Code"><Input required value={form.postalCode} onChange={(e) => setForm({ ...form, postalCode: e.target.value })} /></Field>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Latitude"><Input required value={form.lat} onChange={(e) => setForm({ ...form, lat: e.target.value })} /></Field>
            <Field label="Longitude"><Input required value={form.lng} onChange={(e) => setForm({ ...form, lng: e.target.value })} /></Field>
          </div>
          <Button type="button" variant="outline" onClick={useMyLocation} className="w-full">Use my current location</Button>
        </Section>

        <Section title="Capacity & Hours">
          <div className="grid grid-cols-3 gap-2">
            <Field label="Total ports"><Input type="number" required value={form.totalPorts} onChange={(e) => setForm({ ...form, totalPorts: e.target.value })} /></Field>
            <Field label="Available"><Input type="number" required value={form.availablePorts} onChange={(e) => setForm({ ...form, availablePorts: e.target.value })} /></Field>
            <Field label="Speed (kW)"><Input type="number" required value={form.chargingSpeed} onChange={(e) => setForm({ ...form, chargingSpeed: e.target.value })} /></Field>
          </div>
          <Field label="Opening hours (e.g. 06:00 - 22:00)"><Input required value={form.openingHours} onChange={(e) => setForm({ ...form, openingHours: e.target.value })} /></Field>
        </Section>

        <Section title="Connectors & Pricing">
          {connectors.map((c, i) => (
            <div key={i} className="flex gap-2">
              <select
                className="flex-1 border border-input rounded-md px-3 h-10 bg-background"
                value={c.type}
                onChange={(e) => setConnectors(connectors.map((x, idx) => idx === i ? { ...x, type: e.target.value } : x))}
              >
                {["CCS2", "CHAdeMO", "Type2", "Type1", "Tesla"].map((t) => <option key={t}>{t}</option>)}
              </select>
              <Input className="flex-1" type="number" placeholder="Price/kWh" value={c.price}
                onChange={(e) => setConnectors(connectors.map((x, idx) => idx === i ? { ...x, price: e.target.value } : x))} />
              <Button type="button" variant="ghost" size="icon" onClick={() => setConnectors(connectors.filter((_, idx) => idx !== i))}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
          <Button type="button" variant="outline" size="sm" onClick={() => setConnectors([...connectors, { type: "Type2", price: "10" }])}>
            <Plus className="h-3.5 w-3.5 mr-1" />Add connector
          </Button>
        </Section>

        <Section title="Contact & Amenities">
          <div className="grid grid-cols-2 gap-2">
            <Field label="Phone"><Input required value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
            <Field label="Email"><Input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
          </div>
          <Field label="Amenities (comma separated)"><Input value={form.amenities} onChange={(e) => setForm({ ...form, amenities: e.target.value })} /></Field>
        </Section>

        <Button type="submit" disabled={submitting} className="w-full h-12 bg-[image:var(--gradient-primary)] text-primary-foreground shadow-[var(--shadow-glow)] font-semibold">
          {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : "Create Station"}
        </Button>
      </form>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-card rounded-2xl p-4 shadow-[var(--shadow-card)] space-y-3">
      <h3 className="font-bold text-sm">{title}</h3>
      {children}
    </div>
  );
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
