import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  resolve: {
    // Prefer TS/TSX sources when duplicate JS artifacts exist in src/.
    extensions: [".ts", ".tsx", ".mts", ".js", ".jsx", ".mjs", ".json"]
  },
  server: {
    port: 5173,
    // Allow http://<Tailscale-IP>:5173 from other devices on your tailnet
    host: true,
    proxy: {
      // Browser dev uses same-origin `/api` (see `api/client.ts`); Electron still hits localhost:4000 directly.
      "/api": { target: "http://127.0.0.1:4000", changeOrigin: true }
    }
  }
});
