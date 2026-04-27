import { createConnection } from "node:net"
import { fileURLToPath, URL } from "url"
import { defineConfig } from "vite"
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
 * Resolves where Vite should proxy /api and /socket.io.
 * If VITE_API_PROXY_TARGET is unset, probe 3000 then 5000 so older PORT=5000 backends still work.
 */
async function resolveApiProxyTarget() {
  const explicit = process.env.VITE_API_PROXY_TARGET?.trim().replace(/\/$/, "")
  if (explicit) {
    return explicit
  }
  if (await probePortOpen(3000)) {
    return `http://${PROBE_HOST}:3000`
  }
  if (await probePortOpen(5000)) {
    // eslint-disable-next-line no-console -- dev-only startup hint
    console.warn(
      "[vite] API found on port 5000; using that for proxy. Prefer PORT=3000 on the backend or set VITE_API_PROXY_TARGET."
    )
    return `http://${PROBE_HOST}:5000`
  }
  // eslint-disable-next-line no-console -- dev-only startup hint
  console.warn(
    "[vite] No API listening on 127.0.0.1:3000 or :5000 — proxy may return 502 until pfe-backend is started."
  )
  return `http://${PROBE_HOST}:3000`
}

// https://vite.dev/config/
export default defineConfig(async () => {
  const apiProxyTarget = await resolveApiProxyTarget()
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
    },
    preview: {
      proxy: devProxy,
    },
  }
})
