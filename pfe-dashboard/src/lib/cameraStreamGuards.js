/** Allow `image/jpg` (non-standard) and optional `;charset=…` before `;base64,`. */
const SAFE_DATA_URL_PREFIX = /^data:image\/(jpeg|jpg|png|webp)(;charset=[^;,]+)?;base64,/i
const MAX_THUMBNAIL_DISPLAY_LENGTH = 6_000_000

/**
 * API may deliver a data URL string, or (if a Buffer was JSON-serialized) `{ type: "Buffer", data: number[] }`.
 * @param {unknown} src
 * @returns {string | null}
 */
function coerceSnapshotString(src) {
  if (src == null) return null
  if (typeof src === "string") {
    const t = src.trim().replace(/^\uFEFF/, "")
    return t.length ? t : null
  }
  if (typeof src === "object" && src !== null && src.type === "Buffer" && Array.isArray(src.data)) {
    try {
      const u8 = new Uint8Array(src.data)
      return new TextDecoder("utf-8", { fatal: false }).decode(u8)
    } catch {
      return null
    }
  }
  return null
}

/**
 * @param {unknown} url
 * @returns {boolean}
 */
export function isBrowserStreamableUrl(url) {
  if (typeof url !== "string" || !url.trim()) {
    return false
  }

  let parsed
  try {
    parsed = new URL(url.trim())
  } catch {
    return false
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return false
  }

  if (!parsed.hostname) {
    return false
  }

  if (parsed.username || parsed.password) {
    return false
  }

  return true
}

/**
 * @param {unknown} src
 * @returns {string | null} Safe src for <img> or null
 */
export function getSafeThumbnailDataUrl(src) {
  const s = coerceSnapshotString(src)
  if (typeof s !== "string" || !s.startsWith("data:")) {
    return null
  }

  if (s.length > MAX_THUMBNAIL_DISPLAY_LENGTH) {
    return null
  }

  if (!SAFE_DATA_URL_PREFIX.test(s)) {
    return null
  }

  return s
}

/**
 * Prefer <video> for obvious file-like progressive streams.
 * @param {string} url
 */
export function shouldUseVideoElement(url) {
  try {
    const parsed = new URL(url)
    return /\.(mp4|webm|ogg)(\?.*)?$/i.test(parsed.pathname)
  } catch {
    return false
  }
}
