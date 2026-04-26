const SAFE_DATA_URL_PREFIX = /^data:image\/(jpeg|png|webp);base64,/i
const MAX_THUMBNAIL_DISPLAY_LENGTH = 6_000_000

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
  if (typeof src !== "string" || !src.startsWith("data:")) {
    return null
  }

  if (src.length > MAX_THUMBNAIL_DISPLAY_LENGTH) {
    return null
  }

  if (!SAFE_DATA_URL_PREFIX.test(src)) {
    return null
  }

  return src
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
