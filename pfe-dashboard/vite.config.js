import { fileURLToPath, URL } from "url"
import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"

// When the dashboard is opened via LAN IP (0.0.0.0:5173), the browser must not call
// localhost:5000 on the client device. Dev uses same-origin /api + proxy to the backend.
const API_PROXY_TARGET = process.env.VITE_API_PROXY_TARGET || "http://127.0.0.1:5000"

const devProxy = {
  "/api": { target: API_PROXY_TARGET, changeOrigin: true },
  "/socket.io": { target: API_PROXY_TARGET, changeOrigin: true, ws: true },
  "/machine": { target: API_PROXY_TARGET, changeOrigin: true },
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  server: {
    host: "0.0.0.0",
    port: 5173,
    strictPort: true,
    proxy: devProxy,
  },
  preview: {
    proxy: devProxy,
  },
})
