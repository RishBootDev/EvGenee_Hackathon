import { Link } from "@tanstack/react-router";
import {
  MapPin,
  BatteryCharging,
  ChevronRight,
  ShieldCheck,
  Clock,
  Mail,
  Phone,
  Twitter,
  Instagram,
  Linkedin,
  Github,
  Zap,
} from "lucide-react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faChargingStation } from "@fortawesome/free-solid-svg-icons";

// ── Landing Page ────────────────────────────────────────────────
export function LandingPage() {
  return (
    <div
      className="min-h-screen bg-[#000814] text-white overflow-x-hidden"
      style={{ fontFamily: "'DM Sans', sans-serif" }}
    >
      {/* Grain texture */}
      <div
        className="fixed inset-0 z-0 pointer-events-none opacity-[0.03]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
          backgroundRepeat: "repeat",
          backgroundSize: "128px 128px",
        }}
      />

      {/* Glows */}
      <div
        className="fixed top-0 left-0 w-[700px] h-[500px] pointer-events-none z-0"
        style={{
          background:
            "radial-gradient(ellipse at 0% 0%, rgba(59,130,246,0.12) 0%, transparent 70%)",
        }}
      />
      <div
        className="fixed bottom-0 right-0 w-[500px] h-[500px] pointer-events-none z-0"
        style={{
          background:
            "radial-gradient(ellipse at 100% 100%, rgba(16,185,129,0.08) 0%, transparent 70%)",
        }}
      />

      {/* ── Navbar ─────────────────────────────────────────────── */}
      <nav className="relative z-50 flex items-center justify-between px-6 py-5 max-w-7xl mx-auto border-b border-white/5">
        <div className="flex items-center gap-2.5">
          <div className="bg-green-500/15 p-2 rounded-xl border border-green-500/25">
            <FontAwesomeIcon icon={faChargingStation} className="h-5 w-5 text-green-400" />
          </div>
          <span
            className="text-xl font-bold tracking-tight text-white"
            style={{ fontFamily: "'Syne', sans-serif" }}
          >
            EvGenee
          </span>
        </div>
        <div className="flex items-center gap-3">
          
          <Link to="/auth/login">
            <button className="hidden sm:block text-white/50 hover:text-white text-sm font-medium transition-colors px-4 py-2">
              Log in
            </button>
          </Link>
          <Link to="/auth/register">
            <button className="bg-green-500 hover:bg-green-400 text-black text-sm font-bold px-6 py-2.5 rounded-full transition-colors">
              Get Started
            </button>
          </Link>
        </div>
      </nav>

      {/* ── Hero ───────────────────────────────────────────────── */}
      <main className="relative z-10">
        <section className="px-6 pt-16 pb-12 max-w-7xl mx-auto">
          <p
            className="text-green-400/60 text-xs font-medium tracking-[0.2em] uppercase mb-10"
            style={{ fontFamily: "'DM Mono', monospace" }}
          >
            EV charging network · India
          </p>

          <div className="grid lg:grid-cols-[1fr_300px] gap-8 items-end mb-14">
            <h5
              className="text-[clamp(3.5rem,10vw,7.5rem)] font-black leading-[0.88] tracking-tight text-white"
              style={{ fontFamily: "'Poppins', sans-serif" }}
            >
              Charge Smarter. Drive Better.
              <br />
              <span
                style={{
                  background: "linear-gradient(90deg, #60a5fa 0%, #22d3ee 50%, #34d399 100%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                }}
              >
                Powering the future of electric mobility.
              </span>
              <br />
            </h5>

            <div className="pb-2">
              <p className="text-blue-100/55 text-base leading-relaxed mb-7">
                Book a fast charger in under 60 seconds. Real-time slots, transparent pricing, zero
                surprises.
              </p>
              <Link to="/auth/register">
                <button className="flex items-center gap-2 bg-green-500 hover:bg-green-400 text-black text-sm font-bold px-7 py-3.5 rounded-full transition-colors group w-full sm:w-auto justify-center">
                  Find Chargers Near Me
                  <ChevronRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
                </button>
              </Link>
            </div>
          </div>

          <div className="relative rounded-2xl overflow-hidden border border-white/8">
            <img
              src="/evStation.jpeg"
              alt="EvGenee charging station"
              className="w-full h-[380px] sm:h-[460px] object-cover"
              style={{ filter: "brightness(0.7) saturate(0.85)" }}
            />
            <div className="absolute bottom-0 left-0 right-0 px-6 py-5 flex items-end justify-between bg-gradient-to-t from-black/80 via-black/30 to-transparent">
              <div>
                <p
                  className="text-green-400/70 text-xs font-medium tracking-widest uppercase mb-1"
                  style={{ fontFamily: "'DM Mono', monospace" }}
                >
                  Live availability
                </p>
              </div>
              <div
                className="flex items-center gap-2 text-white/40 text-xs"
                style={{ fontFamily: "'DM Mono', monospace" }}
              >
                <span className="h-2 w-2 rounded-full bg-green-400 animate-pulse inline-block" />
                Updated live
              </div>
            </div>
          </div>
        </section>

        {/* ── Stats bar ──────────────────────────────────────────── */}
        <section className="border-y border-white/5 py-10 px-6 max-w-7xl mx-auto">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
            {[
              { value: "50+", label: "Cities covered" },
              { value: "2,400+", label: "Active chargers" },
              { value: "98%", label: "Uptime SLA" },
              { value: "<60s", label: "Avg. booking time" },
            ].map(({ value, label }) => (
              <div key={label}>
                <p
                  className="text-4xl font-extrabold mb-1"
                  style={{
                    fontFamily: "'Syne', sans-serif",
                    background: "linear-gradient(90deg, #60a5fa, #34d399)",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                    backgroundClip: "text",
                  }}
                >
                  {value}
                </p>
                <p
                  className="text-white/35 text-xs tracking-wide uppercase"
                  style={{ fontFamily: "'DM Mono', monospace" }}
                >
                  {label}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Features ───────────────────────────────────────────── */}
        <section className="py-24 px-6 max-w-7xl mx-auto">
          <p
            className="text-green-400/60 text-xs font-medium tracking-[0.2em] uppercase mb-3"
            style={{ fontFamily: "'DM Mono', monospace" }}
          >
            Why it works
          </p>

          <div className="divide-y divide-white/5">
            {[
              {
                num: "01",
                icon: <MapPin className="h-5 w-5 text-blue-400" />,
                title: "Real-time availability",
                desc: "See which slots are free right now — not 10 minutes ago. We sync directly with station hardware, not self-reported data.",
              },
              {
                num: "02",
                icon: <Clock className="h-5 w-5 text-cyan-400" />,
                title: "Book ahead, not on arrival",
                desc: "Reserve your slot while you're still at home. Arrive, plug in, done. No queue, no gamble.",
              },
              {
                num: "03",
                icon: <ShieldCheck className="h-5 w-5 text-green-400" />,
                title: "One price, no surprises",
                desc: "What you see is what you pay. Per-kWh billing — no idle fees buried in the fine print.",
              },
            ].map(({ num, icon, title, desc }) => (
              <div
                key={num}
                className="py-10 grid lg:grid-cols-[72px_1fr_1fr] gap-6 items-center group hover:bg-white/[0.02] -mx-6 px-6 transition-colors rounded-xl"
              >
                <p
                  className="text-white/20 text-sm group-hover:text-green-400/40 transition-colors"
                  style={{ fontFamily: "'DM Mono', monospace" }}
                >
                  {num}
                </p>
                <div className="flex items-center gap-4">
                  <div className="bg-white/5 rounded-xl p-2.5 border border-white/8">{icon}</div>
                  <h3
                    className="text-xl font-bold text-white"
                    style={{ fontFamily: "'Syne', sans-serif" }}
                  >
                    {title}
                  </h3>
                </div>
                <p className="text-blue-100/45 text-sm leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── How it works ───────────────────────────────────────── */}
        <section className="py-24 px-6 max-w-7xl mx-auto">
          <p
            className="text-green-400/60 text-xs font-medium tracking-[0.2em] uppercase mb-3"
            style={{ fontFamily: "'DM Mono', monospace" }}
          >
            How it works
          </p>
          <h2
            className="text-4xl font-extrabold text-white mb-14"
            style={{ fontFamily: "'Syne', sans-serif" }}
          >
            Three steps to a full battery.
          </h2>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-px bg-white/5 rounded-2xl overflow-hidden border border-white/8">
            {[
              {
                num: "01",
                icon: <MapPin className="h-5 w-5 text-blue-400" />,
                title: "Find a station",
                desc: "Open the app, see every charger near you in real time — availability and price upfront.",
              },
              {
                num: "02",
                icon: <Zap className="h-5 w-5 text-cyan-400" />,
                title: "Book your slot",
                desc: "Reserve in under 60 seconds. Arrive and plug straight in — no waiting, no queue.",
              },
              {
                num: "03",
                icon: <BatteryCharging className="h-5 w-5 text-green-400" />,
                title: "Charge and go",
                desc: "Pay automatically through the app when done. Per-kWh billing, receipt in your inbox.",
              },
            ].map(({ num, icon, title, desc }) => (
              <div
                key={num}
                className="bg-white/[0.03] p-8 hover:bg-white/[0.06] transition-colors"
              >
                <p
                  className="text-6xl font-black mb-6 leading-none"
                  style={{
                    fontFamily: "'Syne', sans-serif",
                    background: "linear-gradient(90deg, #60a5fa 0%, #22d3ee 50%, #34d399 100%)",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                    backgroundClip: "text",
                  }}
                >
                  {num}
                </p>
                <div className="bg-white/5 rounded-xl p-3 border border-white/8 w-fit mb-5">
                  {icon}
                </div>
                <h3
                  className="text-lg font-bold text-white mb-3"
                  style={{ fontFamily: "'Syne', sans-serif" }}
                >
                  {title}
                </h3>
                <p className="text-blue-100/45 text-sm leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>

          <div className="mt-10">
            <Link to="/auth/register">
              <button className="bg-green-500 hover:bg-green-400 text-black text-sm font-bold px-8 py-3.5 rounded-full transition-colors">
                Get started
              </button>
            </Link>
          </div>
        </section>

        {/* ── Map section ────────────────────────────────────────── */}
        <section className="px-6 pb-24 max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <p
                className="text-green-400/60 text-xs tracking-[0.2em] uppercase mb-4"
                style={{ fontFamily: "'DM Mono', monospace" }}
              >
                Coverage
              </p>
              <h2
                className="text-4xl sm:text-5xl font-extrabold text-white mb-5 leading-tight"
                style={{ fontFamily: "'Syne', sans-serif" }}
              >
                Growing where
                <br />
                you drive.
              </h2>
              <p className="text-blue-100/45 text-base leading-relaxed mb-8 max-w-md">
                From metro highways to Tier-2 towns, we're expanding faster than India's EV fleet.
                New stations come online every week.
              </p>
            </div>
            <div className="relative rounded-2xl overflow-hidden border border-white/8">
              <img
                src="/india-map.png"
                alt="EvGenee India Network"
                className="w-full object-cover"
                style={{ filter: "brightness(0.75) saturate(0.8)" }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#000814] via-transparent to-transparent" />
            </div>
          </div>
        </section>

        {/* ── CTA ────────────────────────────────────────────────── */}
        <section className="px-6 pb-32 max-w-7xl mx-auto">
          <div className="relative rounded-2xl overflow-hidden border border-white/8">
            <img
              src="/city-map-banner.png"
              alt=""
              aria-hidden
              className="absolute inset-0 w-full h-full object-cover opacity-[0.08]"
            />
            <div
              className="absolute inset-0"
              style={{
                background:
                  "linear-gradient(135deg, rgba(59,130,246,0.1) 0%, rgba(16,185,129,0.07) 100%)",
              }}
            />
            <div className="relative z-10 p-10 sm:p-16 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-10">
              <div>
                <p
                  className="text-green-400/60 text-xs tracking-[0.2em] uppercase mb-4"
                  style={{ fontFamily: "'DM Mono', monospace" }}
                >
                  Start for free
                </p>
                <h2
                  className="text-4xl sm:text-5xl font-extrabold text-white leading-tight"
                  style={{ fontFamily: "'Syne', sans-serif" }}
                >
                  Your next trip, fully charged.
                  <br />
                  <span
                    style={{
                      background: "linear-gradient(90deg, #60a5fa 0%, #22d3ee 50%, #34d399 100%)",
                      WebkitBackgroundClip: "text",
                      WebkitTextFillColor: "transparent",
                      backgroundClip: "text",
                    }}
                  ></span>
                </h2>
              </div>
              <Link to="/auth/register" className="shrink-0">
                <button className="flex items-center gap-3 bg-green-500 hover:bg-green-400 text-black font-bold px-8 py-4 rounded-full transition-colors text-base">
                  Create free account
                </button>
              </Link>
            </div>
          </div>
        </section>
      </main>

      {/* ── Footer ─────────────────────────────────────────────── */}
      <footer className="relative z-10 border-t border-white/5 pt-16 pb-10 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-10 mb-16">
            <div className="col-span-2 lg:col-span-1 space-y-5">
              <div className="flex items-center gap-2.5">
                <div className="bg-green-500/15 p-2 rounded-xl border border-green-500/25">
                  <FontAwesomeIcon icon={faChargingStation} className="h-5 w-5 text-green-400" />
                </div>
                <span
                  className="text-lg font-bold text-white"
                  style={{ fontFamily: "'Syne', sans-serif" }}
                >
                  EvGenee
                </span>
              </div>
              <p className="text-blue-100/35 text-sm leading-relaxed">
                India's fastest-growing EV charging network. Built for drivers who don't have time
                to wait.
              </p>
              <div className="flex gap-3">
                {[
                  { icon: <Twitter className="h-4 w-4" />, href: "#" },
                  { icon: <Linkedin className="h-4 w-4" />, href: "#" },
                  { icon: <Instagram className="h-4 w-4" />, href: "#" },
                  {
                    icon: <Github className="h-4 w-4" />,
                    href: "https://github.com/RishBootDev/EvGenee_Hackathon",
                  },
                ].map(({ icon, href }, i) => (
                  <a
                    key={i}
                    href={href}
                    className="h-9 w-9 rounded-lg border border-white/10 flex items-center justify-center text-white/30 hover:text-green-400 hover:border-green-500/30 transition-colors"
                  >
                    {icon}
                  </a>
                ))}
              </div>
            </div>

            {[
              {
                heading: "Product",
                links: ["Find stations", "Pricing", "For business", "Mobile app"],
              },
              {
                heading: "Company",
                links: ["Blog", "Partners", "Careers", "Press"],
              },
            ].map(({ heading, links }) => (
              <div key={heading}>
                <p
                  className="text-white/25 text-xs tracking-widest uppercase mb-5"
                  style={{ fontFamily: "'DM Mono', monospace" }}
                >
                  {heading}
                </p>
                <ul className="space-y-3">
                  {links.map((l) => (
                    <li key={l}>
                      <a
                        href="#"
                        className="text-blue-100/40 text-sm hover:text-white transition-colors"
                      >
                        {l}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}

            <div>
              <p
                className="text-white/25 text-xs tracking-widest uppercase mb-5"
                style={{ fontFamily: "'DM Mono', monospace" }}
              >
                Contact
              </p>
              <ul className="space-y-3">
                {[
                  { icon: <Mail className="h-3.5 w-3.5" />, text: "support@evgenee.in" },
                  { icon: <Phone className="h-3.5 w-3.5" />, text: "+91 79095 47056" },
                  { icon: <MapPin className="h-3.5 w-3.5" />, text: "Bhopal, India" },
                ].map(({ icon, text }) => (
                  <li
                    key={text}
                    className="flex items-center gap-2.5 text-blue-100/40 text-sm hover:text-white transition-colors cursor-pointer"
                  >
                    <span className="text-green-400/60">{icon}</span>
                    {text}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="pt-8 border-t border-white/5 flex flex-col sm:flex-row justify-between items-center gap-4">
            <p className="text-white/20 text-xs" style={{ fontFamily: "'DM Mono', monospace" }}>
              © {new Date().getFullYear()} EvGenee Network Pvt. Ltd.
            </p>
            <div className="flex gap-6 text-white/20 text-xs">
              {["Privacy", "Terms", "Cookies"].map((l) => (
                <a key={l} href="#" className="hover:text-white/50 transition-colors">
                  {l}
                </a>
              ))}
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
