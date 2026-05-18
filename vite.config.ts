import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://tauri.app/v1/guides/getting-started/setup/vite
export default defineConfig(async () => ({
  plugins: [react()],
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: "127.0.0.1",
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },
  envPrefix: ["VITE_", "TAURI_"],
}));
