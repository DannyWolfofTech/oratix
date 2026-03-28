import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
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
  plugins: [react(), mode === "development" && componentTagger(), versionPlugin()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
