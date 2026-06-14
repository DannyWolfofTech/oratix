import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";
import { writeFileSync, mkdirSync } from "fs";
import { randomBytes } from "crypto";

function versionPlugin() {
  // Generate once so the injected client value and version.json always match.
  const buildId = randomBytes(8).toString("hex");
  return {
    name: "version-plugin",
    writeBundle(options: { dir?: string }) {
      const outDir = options.dir || "dist";
      try {
        mkdirSync(outDir, { recursive: true });
        writeFileSync(`${outDir}/version.json`, JSON.stringify({ buildId }));
      } catch { /* ignore */ }
    },
    config() {
      return { define: { "import.meta.env.VITE_BUILD_ID": JSON.stringify(buildId) } };
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
    headers: {
      "Permissions-Policy": "camera=(self), microphone=(self), display-capture=(self)",
    },
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    versionPlugin(),
    VitePWA({
      // Prompt the user to update instead of silently reloading — a force
      // reload mid-recording would destroy an in-progress take.
      registerType: "prompt",
      injectRegister: null,
      // Use the hand-written manifest already shipped in public/.
      manifest: false,
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,webmanifest}"],
        // version.json must always hit the network so update detection works.
        navigateFallbackDenylist: [/^\/version\.json/],
        cleanupOutdatedCaches: true,
      },
    }),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
