import { Link } from "@tanstack/react-router";
import { Zap, MapPin, BatteryCharging, ChevronRight, ShieldCheck, Clock } from "lucide-react";
import { Button } from "./ui/button";

export function LandingPage() {
  return (
    <div className="min-h-screen bg-[#000814] text-white overflow-x-hidden selection:bg-primary/30">
      {/* Dynamic Background Glows */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-900/20 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-primary/10 blur-[120px] rounded-full" />
      </div>

      {/* Navbar */}
      <nav className="relative z-50 flex items-center justify-between px-6 py-6 max-w-7xl mx-auto">
        <div className="flex items-center gap-2">
          <div className="bg-primary/20 p-2 rounded-xl backdrop-blur-md border border-primary/30 shadow-[var(--shadow-glow)]">
            <Zap className="h-6 w-6 text-primary" fill="currentColor" />
          </div>
          <span className="text-2xl font-bold tracking-tight text-white">EvGenee</span>
        </div>
        <div className="flex items-center gap-4">
          <Link to="/auth/login">
            <Button variant="ghost" className="font-semibold text-white/80 hover:text-white hover:bg-white/10 hidden sm:flex">Log In</Button>
          </Link>
          <Link to="/auth/register">
            <Button className="bg-primary text-primary-foreground font-bold shadow-[var(--shadow-glow)] hover:scale-105 transition-transform rounded-full px-8 h-11">
              Get Started
            </Button>
          </Link>
        </div>
      </nav>

      {/* Hero Section */}
      <main className="relative z-10">
        <section className="pt-12 pb-20 sm:pt-20 sm:pb-32 px-6 max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            {/* Left Column: Text Content */}
            <div className="flex flex-col items-center lg:items-start text-center lg:text-left">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-sm font-semibold mb-8 animate-float backdrop-blur-md">
                <Zap className="h-4 w-4" />
                <span>The Future of EV Charging</span>
              </div>
              
              <h1 className="text-6xl sm:text-8xl font-black tracking-tight mb-8 text-balance leading-[1.1] text-white">
                Charge Your EV, <br className="hidden sm:block" />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400">
                  Anywhere, Anytime.
                </span>
              </h1>
              
              <p className="text-blue-100/70 text-lg sm:text-xl max-w-2xl mb-12 text-balance leading-relaxed">
                Find, book, and pay for EV charging stations near you. Join the largest network of fast chargers and drive with zero range anxiety.
              </p>

              <div className="flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto">
                <Link to="/auth/register" className="w-full sm:w-auto">
                  <Button className="w-full sm:w-auto h-16 px-10 text-lg bg-primary hover:bg-primary/90 text-primary-foreground rounded-full shadow-[var(--shadow-glow)] font-bold tracking-wide group transition-all">
                    Find Chargers Near Me
                    <ChevronRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                  </Button>
                </Link>
              </div>
            </div>

            {/* Right Column: Featured Image Showcase */}
            <div className="relative mt-12 lg:mt-0">
              <div className="relative z-10 rounded-[3rem] overflow-hidden border border-white/10 shadow-2xl shadow-blue-500/20 group bg-blue-950/20 backdrop-blur-sm">
                <div className="absolute inset-0 bg-gradient-to-tr from-blue-600/20 to-transparent mix-blend-overlay z-10" />
                <img 
                  src="/hero-bg.png" 
                  alt="EvGenee Featured Station" 
                  className="w-full h-auto aspect-[4/3] object-cover transition-transform duration-700 group-hover:scale-105"
                />
              </div>
              
              <div className="absolute -top-12 -right-12 w-48 h-48 bg-blue-600/20 blur-[100px] rounded-full -z-10 animate-pulse" />
              <div className="absolute -bottom-16 -left-16 w-64 h-64 bg-emerald-500/10 blur-[120px] rounded-full -z-10" />
              
              <div className="absolute -bottom-8 -right-8 z-20 bg-blue-900/40 backdrop-blur-2xl border border-white/10 p-5 rounded-[2rem] shadow-2xl max-w-[220px] animate-float">
                <div className="flex items-center gap-3 mb-3">
                  <div className="h-10 w-10 rounded-xl bg-primary/20 flex items-center justify-center">
                    <BatteryCharging className="h-5 w-5 text-primary" />
                  </div>
                  <span className="text-xs font-bold uppercase tracking-widest text-blue-200/60">Status</span>
                </div>
                <p className="text-base font-bold text-white">Ultra-Fast Charging Available</p>
              </div>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className="py-24 px-6 max-w-7xl mx-auto relative">
          <div className="grid lg:grid-cols-2 gap-20 items-center">
            <div className="space-y-10">
              <div className="max-w-md">
                <h2 className="text-4xl font-bold mb-6 text-white">Why Choose EvGenee?</h2>
                <p className="text-blue-100/60 text-lg">Experience a seamless charging ecosystem built for the modern electric vehicle owner.</p>
              </div>
              
              <div className="space-y-4">
                <FeatureCard 
                  icon={<MapPin className="h-5 w-5 text-primary" />}
                  title="Real-time Availability"
                  description="See exactly which chargers are free right now. No more driving to a station just to wait in line."
                />
                <FeatureCard 
                  icon={<Clock className="h-5 w-5 text-primary" />}
                  title="Smart Pre-booking"
                  description="Reserve your charging slot in advance. Arrive, plug in, and charge immediately without the hassle."
                />
                <FeatureCard 
                  icon={<ShieldCheck className="h-5 w-5 text-primary" />}
                  title="Secure Payments"
                  description="Pay seamlessly through the app. Transparent pricing with no hidden fees or surprises."
                />
              </div>
            </div>

            <div className="relative group">
              <div className="absolute inset-0 bg-blue-500/20 blur-[150px] rounded-full -z-10 animate-pulse" />
              <div className="relative z-10 rounded-[3.5rem] overflow-hidden border border-white/10 bg-blue-950/40 backdrop-blur-3xl shadow-2xl">
                <img 
                  src="/india-map.png" 
                  alt="EvGenee India Network" 
                  className="w-full h-auto object-cover opacity-80 transition-transform duration-1000 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#000814] via-transparent to-transparent pointer-events-none" />
              </div>
            </div>
          </div>
        </section>

        {/* City Map Banner */}
        <section className="px-6 mb-24 max-w-7xl mx-auto">
          <div className="relative rounded-[3rem] overflow-hidden border border-white/10 shadow-2xl group">
            <div className="absolute inset-0 bg-gradient-to-t from-[#000814] via-transparent to-transparent z-10" />
            <img 
              src="/city-map-banner.png" 
              alt="City EV Network" 
              className="w-full h-64 sm:h-80 object-cover transition-transform duration-1000 group-hover:scale-105"
            />
            <div className="absolute bottom-10 left-10 z-20">
              <h3 className="text-3xl font-bold text-white mb-2">Expanding Network</h3>
              <p className="text-blue-100/70 text-lg">Available in over 50+ cities across the country.</p>
            </div>
          </div>
        </section>

        {/* Call to Action Banner */}
        <section className="px-6 pb-32 max-w-5xl mx-auto">
          <div className="bg-gradient-to-br from-blue-900/40 to-blue-950/40 border border-white/10 rounded-[3rem] p-10 sm:p-20 text-center relative overflow-hidden shadow-2xl backdrop-blur-xl">
            <div className="absolute -top-32 -right-32 w-80 h-80 bg-blue-500/20 blur-[120px] rounded-full" />
            <div className="absolute -bottom-32 -left-32 w-80 h-80 bg-primary/10 blur-[120px] rounded-full" />
            
            <BatteryCharging className="h-20 w-20 text-primary mx-auto mb-8 relative z-10 animate-pulse" />
            <h2 className="text-4xl sm:text-6xl font-black mb-6 relative z-10 text-white">Ready to Hit the Road?</h2>
            <p className="text-blue-100/60 text-xl mb-12 max-w-2xl mx-auto relative z-10">
              Create an account in seconds and unlock the full potential of your electric vehicle journey.
            </p>
            <Link to="/auth/register" className="relative z-10">
              <Button className="h-16 px-12 bg-white text-blue-950 hover:bg-blue-50 rounded-full font-black text-lg transition-all shadow-2xl">
                Create Free Account
              </Button>
            </Link>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/5 py-12 text-center text-blue-100/40 px-6">
        <p className="text-sm font-medium tracking-widest uppercase">© {new Date().getFullYear()} EvGenee Network • Powering the Future</p>
      </footer>
    </div>
  );
}


function FeatureCard({ icon, title, description }: { icon: React.ReactNode, title: string, description: string }) {
  return (
    <div className="bg-card/50 border border-border/50 backdrop-blur-sm p-4 rounded-2xl hover:bg-card hover:border-primary/30 transition-colors shadow-sm hover:shadow-[var(--shadow-glow)] group">
      <div className="bg-primary/10 w-10 h-10 rounded-xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
        {icon}
      </div>
      <h3 className="text-lg font-bold mb-1">{title}</h3>
      <p className="text-muted-foreground text-sm leading-normal">
        {description}
      </p>
    </div>
  );
}
