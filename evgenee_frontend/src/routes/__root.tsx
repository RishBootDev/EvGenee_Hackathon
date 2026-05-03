import { Outlet, Link, createRootRoute } from "@tanstack/react-router";
import appCss from "../styles.css?url";
import { AuthProvider } from "@/lib/auth";
import { BottomNav } from "@/components/BottomNav";
import { Toaster } from "@/components/ui/sonner";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRoute({
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

import { InstallPrompt } from "@/components/InstallPrompt";
import { VoiceAssistant } from "@/components/VoiceAssistant";

function RootComponent() {
  return (
    <AuthProvider>
      <div className="min-h-screen pb-20 bg-[#000814]" style={{ paddingTop: "var(--safe-top)" }}>
        <Outlet />
      </div>
      <BottomNav />
      <InstallPrompt />
      <VoiceAssistant />
      <Toaster position="top-center" />
    </AuthProvider>
  );
}
