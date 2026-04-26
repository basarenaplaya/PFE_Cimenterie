/** True for hosts that only refer to the current machine (wrong target from other LAN clients). */
export function isLoopbackHostname(host) {
  if (!host || typeof host !== "string") return false
  const h = host.toLowerCase()
  return h === "localhost" || h === "127.0.0.1" || h === "[::1]" || h === "::1"
}

function pageHostnameIsLoopback() {
  if (typeof window === "undefined") return true
  return isLoopbackHostname(window.location.hostname)
}

/**
 * Resolves the API origin for `fetch`.
 * - Dev or LAN: prefer same-origin (`""`) so Vite proxies `/api` to the backend.
 * - If `VITE_API_BASE_URL` points at localhost but the app is opened via LAN IP, localhost would
 *   target the wrong machine; we fall back to same-origin in that case.
 */
export function getResolvedApiBaseUrl() {
  const explicitRaw = import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL
  const explicit =
    typeof explicitRaw === "string" && explicitRaw.trim() !== ""
      ? explicitRaw.trim().replace(/\/$/, "")
      : ""

  if (explicit) {
    try {
      const { hostname } = new URL(explicit)
      if (typeof window !== "undefined" && !pageHostnameIsLoopback() && isLoopbackHostname(hostname)) {
        return ""
      }
    } catch {
      // malformed URL — use as-is
    }
    return explicit
  }

  if (import.meta.env.DEV) {
    return ""
  }

  if (typeof window !== "undefined" && !pageHostnameIsLoopback()) {
    return ""
  }

  return "http://localhost:5000"
}

let authToken = null
let unauthorizedHandler = null

export class ApiError extends Error {
  constructor(message, options = {}) {
    const text =
      typeof message === "string" && message.trim().length > 0 ? message : "Request failed"
    super(text, options.cause !== undefined ? { cause: options.cause } : undefined)
    this.name = "ApiError"
    this.status = options.status ?? 500
    this.payload = options.payload ?? null
  }
}

export function setApiAuthToken(token) {
  authToken = token || null
}

export function setApiUnauthorizedHandler(handler) {
  unauthorizedHandler = typeof handler === "function" ? handler : null
}

function buildUrl(path) {
  if (/^https?:\/\//i.test(path)) return path
  const normalizedPath = path.startsWith("/") ? path : `/${path}`
  return `${getResolvedApiBaseUrl()}${normalizedPath}`
}

async function parseResponseBody(response) {
  const rawText = await response.text()
  if (!rawText) return null

  try {
    return JSON.parse(rawText)
  } catch {
    return rawText
  }
}

function resolvePayloadErrorMessage(payload) {
  if (!payload) return ""

  if (typeof payload === "string") {
    return payload.trim()
  }

  if (typeof payload !== "object") {
    return ""
  }

  if (typeof payload.message === "string" && payload.message.trim().length > 0) {
    return payload.message.trim()
  }

  if (typeof payload.error === "string" && payload.error.trim().length > 0) {
    return payload.error.trim()
  }

  if (payload.error && typeof payload.error === "object") {
    if (typeof payload.error.message === "string" && payload.error.message.trim().length > 0) {
      return payload.error.message.trim()
    }

    if (Array.isArray(payload.error.details) && payload.error.details.length > 0) {
      return payload.error.details
        .map((detail) => String(detail).trim())
        .filter((detail) => detail.length > 0)
        .join(" ")
    }
  }

  return ""
}

export async function apiRequest(path, options = {}) {
  const {
    method = "GET",
    headers,
    body,
    signal,
    token,
  } = options

  const resolvedToken = token ?? authToken
  const finalHeaders = {
    Accept: "application/json",
    ...(headers || {}),
  }

  if (resolvedToken) {
    finalHeaders.Authorization = `Bearer ${resolvedToken}`
  }

  const isFormData = body instanceof FormData
  if (body !== undefined && !isFormData && !finalHeaders["Content-Type"]) {
    finalHeaders["Content-Type"] = "application/json"
  }

  let response
  try {
    response = await fetch(buildUrl(path), {
      method,
      headers: finalHeaders,
      body: body === undefined ? undefined : isFormData ? body : JSON.stringify(body),
      signal,
    })
  } catch (cause) {
    const hint =
      import.meta.env.DEV && !import.meta.env.VITE_API_BASE_URL && !import.meta.env.VITE_API_URL
        ? " Start the backend on port 5000 (or set VITE_API_PROXY_TARGET if it uses another port)."
        : " Check that the API is reachable from this device (same-origin proxy, or set VITE_API_BASE_URL to this host’s API URL)."
    throw new ApiError(`Unable to reach the server.${hint}`, {
      status: 0,
      payload: null,
      cause,
    })
  }

  const payload = await parseResponseBody(response)

  if (!response.ok) {
    const message =
      resolvePayloadErrorMessage(payload) || response.statusText || "Request failed"

    if (response.status === 401 && resolvedToken && unauthorizedHandler) {
      unauthorizedHandler()
    }

    throw new ApiError(message, {
      status: response.status,
      payload,
    })
  }

  return payload
}

export const api = {
  get(path, options = {}) {
    return apiRequest(path, { ...options, method: "GET" })
  },
  post(path, body, options = {}) {
    return apiRequest(path, { ...options, method: "POST", body })
  },
  put(path, body, options = {}) {
    return apiRequest(path, { ...options, method: "PUT", body })
  },
  patch(path, body, options = {}) {
    return apiRequest(path, { ...options, method: "PATCH", body })
  },
  delete(path, options = {}) {
    return apiRequest(path, { ...options, method: "DELETE" })
  },
}
