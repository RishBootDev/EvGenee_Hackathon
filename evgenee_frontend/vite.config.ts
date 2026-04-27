import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  vite: {
    plugins: [
      VitePWA({
        registerType: "autoUpdate",
        devOptions: { enabled: false },
        includeAssets: ["favicon.ico"],
        workbox: {
          navigateFallbackDenylist: [/^\/~oauth/, /^\/api/],
          globPatterns: ["**/*.{js,css,html,svg,png,ico}"],
        },
        manifest: {
          name: "VoltGo — EV Charging",
          short_name: "VoltGo",
          description: "Find and book EV charging stations near you",
          theme_color: "#22c55e",
          background_color: "#ffffff",
          display: "standalone",
          orientation: "portrait",
          start_url: "/",
          icons: [
            { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
            { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
            { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any maskable" },
          ],
        },
      }),
    ],
  },
});
