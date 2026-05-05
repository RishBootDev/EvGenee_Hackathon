import { useEffect, useState } from "react";
import { Link, useLocation } from "@tanstack/react-router";
import { Map, Calendar, User, LayoutDashboard, Mic } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

/** Event name used to toggle the VoiceAssistant panel from BottomNav */
export const AI_OPEN_EVENT = "evgenee:ai:open";

export function BottomNav() {
  const loc = useLocation();
  const { isOwner, isAuthed } = useAuth();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  if (loc.pathname.startsWith("/auth")) return null;
  if (!isAuthed) return null;

  /** Emit a custom event so VoiceAssistant can open itself */
  const openAI = () => {
    window.dispatchEvent(new CustomEvent(AI_OPEN_EVENT));
  };

  const navItems = [
    { to: "/", label: "Map", icon: Map },
    ...(!isOwner ? [{ to: "/bookings", label: "Bookings", icon: Calendar }] : []),
    ...(isOwner ? [{ to: "/owner", label: "Owner", icon: LayoutDashboard }] : []),
    { to: "/profile", label: "Profile", icon: User },
  ];

  // Total columns = nav links + (non-owner AI button)
  const totalCols = isOwner ? navItems.length : navItems.length + 1;

  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-[1000] bg-[#000814]/95 backdrop-blur-xl border-t border-white/8"
      style={{ paddingBottom: "var(--safe-bottom)" }}
    >
      <div
        className={cn("max-w-2xl mx-auto grid px-2")}
        style={{ gridTemplateColumns: `repeat(${totalCols}, 1fr)` }}
      >
        {navItems.map(({ to, label, icon: Icon }) => {
          const active = loc.pathname === to || (to !== "/" && loc.pathname.startsWith(to));
          return (
            <Link
              key={to}
              to={to}
              className={cn(
                "flex flex-col items-center justify-center gap-1 py-2.5 text-xs font-medium transition-colors",
                active ? "text-primary" : "text-white/35"
              )}
            >
              <div
                className={cn(
                  "h-9 w-9 rounded-full flex items-center justify-center transition-all",
                  active && "bg-primary/15 ring-1 ring-primary/30"
                )}
              >
                <Icon className="h-5 w-5" />
              </div>
              <span>{label}</span>
            </Link>
          );
        })}

        {/* AI Assistant button — non-owners only */}
        {!isOwner && (
          <button
            onClick={openAI}
            aria-label="AI Assistant"
            className="flex flex-col items-center justify-center gap-1 py-2.5 text-xs font-medium transition-colors text-emerald-400"
          >
            <div className="h-9 w-9 rounded-full flex items-center justify-center transition-all bg-emerald-500/15 ring-1 ring-emerald-500/30">
              <Mic className="h-5 w-5" />
            </div>
            <span>AI</span>
          </button>
        )}
      </div>
    </nav>
  );
}
