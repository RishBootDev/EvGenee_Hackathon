import { useEffect, useState } from "react";
import { Button } from "./ui/button";
import { Download, X, Zap } from "lucide-react";

export function InstallPrompt() {
  const [show, setShow] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  useEffect(() => {
    const handler = (e: any) => {
      // Prevent the mini-infobar from appearing on mobile
      e.preventDefault();
      // Stash the event so it can be triggered later.
      setDeferredPrompt(e);
      // Update UI notify the user they can install the PWA
      setShow(true);
    };

    window.addEventListener("beforeinstallprompt", handler);

    // If app is already installed, don't show
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setShow(false);
    }

    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setDeferredPrompt(null);
      setShow(false);
    }
  };

  if (!show) return null;

  return (
    <div className="fixed bottom-24 left-4 right-4 md:left-auto md:right-4 md:w-80 z-[2000] animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="bg-card/95 backdrop-blur-xl border border-border rounded-2xl p-4 shadow-[var(--shadow-elevated)] relative overflow-hidden">
        {/* Background glow */}
        <div className="absolute -top-10 -right-10 w-32 h-32 bg-primary/10 blur-3xl rounded-full" />
        
        <button 
          onClick={() => setShow(false)}
          className="absolute top-2 right-2 p-1 text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="flex items-start gap-4">
          <div className="h-12 w-12 rounded-xl bg-[image:var(--gradient-primary)] grid place-items-center shrink-0 shadow-[var(--shadow-glow)]">
            <Zap className="h-6 w-6 text-white" fill="white" />
          </div>
          <div className="flex-1 pr-4">
            <h3 className="font-bold text-sm leading-tight">Install EvGenee</h3>
            <p className="text-xs text-muted-foreground mt-1">
              Add to your home screen for the best experience and offline access.
            </p>
            <Button 
              size="sm" 
              onClick={handleInstall}
              className="mt-3 w-full bg-[image:var(--gradient-primary)] text-primary-foreground font-bold text-xs rounded-lg shadow-sm"
            >
              <Download className="h-3 w-3 mr-1.5" />
              Install App
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
