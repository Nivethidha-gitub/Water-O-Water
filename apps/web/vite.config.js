import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const apiTarget = process.env.VITE_API_PROXY || "http://127.0.0.1:3001";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // The browser only ever talks to this origin; /v1 is forwarded to the API.
    proxy: {
      "/v1": { target: apiTarget, changeOrigin: true },
    },
  },
  preview: {
    port: 4173,
    proxy: {
      "/v1": { target: apiTarget, changeOrigin: true },
    },
  },
});
