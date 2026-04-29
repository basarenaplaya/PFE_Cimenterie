import { createConnection } from "node:net"
import { fileURLToPath, URL } from "url"
import { defineConfig, loadEnv } from "vite"
import react from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"

// When the dashboard is opened via LAN IP (0.0.0.0:5173), the browser must not call
// localhost on the *client* device. Dev uses same-origin /api + proxy to the backend on this PC.

const PROBE_HOST = "127.0.0.1"
const PROBE_MS = 280

function probePortOpen(port) {
  return new Promise((resolve) => {
    const socket = createConnection({ host: PROBE_HOST, port, timeout: PROBE_MS }, () => {
      socket.end()
      resolve(true)
    })
    socket.on("error", () => resolve(false))
    socket.setTimeout(PROBE_MS, () => {
      socket.destroy()
      resolve(false)
    })
  })
}

/**
 * Resolves where Vite should proxy /api and /socket.io (fixed at dev server startup).
 * Prefer VITE_API_PROXY_TARGET from `.env.development` / `.env.development.local` (see loadEnv).
 * Otherwise probe common backend ports (5000 first for this project), then default safely.
 */
async function resolveApiProxyTarget(env) {
  const explicit = env.VITE_API_PROXY_TARGET?.trim().replace(/\/$/, "")
  if (explicit) {
    return explicit
  }
  if (await probePortOpen(5000)) {
    return `http://${PROBE_HOST}:5000`
  }
  if (await probePortOpen(3000)) {
    return `http://${PROBE_HOST}:3000`
  }
  // eslint-disable-next-line no-console -- dev-only startup hint
  console.warn(
    "[vite] No API on 127.0.0.1:5000 or :3000 at startup — defaulting proxy to :5000. " +
      "Start pfe-backend first, then restart `npm run dev`, or set VITE_API_PROXY_TARGET in .env.development."
  )
  return `http://${PROBE_HOST}:5000`
}

// https://vite.dev/config/
export default defineConfig(async ({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "")
  const apiProxyTarget = await resolveApiProxyTarget(env)
  // eslint-disable-next-line no-console -- dev-only startup hint
  console.info(`[vite] Dev proxy -> ${apiProxyTarget}`)

  const devProxy = {
    "/api": {
      target: apiProxyTarget,
      changeOrigin: true,
    },
    "/socket.io": {
      target: apiProxyTarget,
      changeOrigin: true,
      ws: true,
    },
  }

  /** Localtunnel / similar tunnels — Host header must be allowed or Vite blocks the request */
  const tunnelHosts = ["pfe-cimenterie.loca.lt", ".loca.lt","salary-national-underpaid.ngrok-free.dev"]

  return {
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
      allowedHosts: tunnelHosts,
    },
    preview: {
      proxy: devProxy,
      allowedHosts: tunnelHosts,
    },
  }
})
