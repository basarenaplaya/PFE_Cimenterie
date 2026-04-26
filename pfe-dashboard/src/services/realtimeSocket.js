import { io } from "socket.io-client"
import { getResolvedApiBaseUrl, isLoopbackHostname } from "@/lib/api"

function resolveSocketUrl() {
  const socketEnv = import.meta.env.VITE_SOCKET_URL
  if (typeof socketEnv === "string" && socketEnv.trim() !== "") {
    const t = socketEnv.trim().replace(/\/$/, "")
    try {
      if (
        typeof window !== "undefined" &&
        !isLoopbackHostname(window.location.hostname) &&
        isLoopbackHostname(new URL(t).hostname)
      ) {
        return ""
      }
    } catch {
      // keep t
    }
    return t
  }
  return getResolvedApiBaseUrl()
}

let socketClient = null
let socketToken = null

function buildSocketOptions(token) {
  return {
    autoConnect: false,
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 7000,
    timeout: 8000,
    transports: ["websocket", "polling"],
    auth: token ? { token } : undefined,
  }
}

export function getRealtimeSocketClient(token) {
  if (!socketClient) {
    const base = resolveSocketUrl()
    const url = base === "" ? undefined : base
    socketClient = io(url, buildSocketOptions(token))
    socketToken = token || null
    return socketClient
  }

  const nextToken = token || null
  if (nextToken !== socketToken) {
    socketToken = nextToken
    socketClient.auth = nextToken ? { token: nextToken } : {}
  }

  return socketClient
}

export function connectRealtimeSocket(token) {
  const client = getRealtimeSocketClient(token)

  if (!client.connected) {
    client.connect()
  }

  return client
}

export function disconnectRealtimeSocket() {
  if (!socketClient) return

  if (socketClient.connected) {
    socketClient.disconnect()
  }
}

export function getRealtimeSocketUrl() {
  return resolveSocketUrl()
}
