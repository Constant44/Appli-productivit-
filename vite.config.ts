import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { viteSingleFile } from "vite-plugin-singlefile";

// `vite build --mode artifact` produit un seul fichier HTML autonome
// (version iPad / téléphone publiée sur claude.ai, voir scripts/make-artifact.mjs).
export default defineConfig(({ mode }) => ({
  plugins: mode === "artifact" ? [react(), viteSingleFile()] : [react()],
  build: mode === "artifact" ? { outDir: "dist-artifact" } : undefined,
  server: {
    port: 5173,
    proxy: { "/api": "http://localhost:8787" },
  },
}));
