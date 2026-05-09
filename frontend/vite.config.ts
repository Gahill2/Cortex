import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  resolve: {
    // Prefer TS/TSX sources when duplicate JS artifacts exist in src/.
    extensions: [".ts", ".tsx", ".mts", ".js", ".jsx", ".mjs", ".json"]
  },
  server: {
    port: 5173
  }
});
