/**
 * Human-readable duration from a whole number of seconds (e.g. alarm downtime, chart segments).
 * @param {number} totalSeconds
 * @returns {string}
 */
export function formatDurationSeconds(totalSeconds) {
  let s = Math.max(0, Math.floor(Number(totalSeconds) || 0))
  if (s === 0) {
    return "0s"
  }

  const parts = []
  const days = Math.floor(s / 86400)
  if (days) {
    parts.push(`${days}d`)
    s %= 86400
  }
  const hours = Math.floor(s / 3600)
  if (hours) {
    parts.push(`${hours}h`)
    s %= 3600
  }
  const minutes = Math.floor(s / 60)
  if (minutes) {
    parts.push(`${minutes}m`)
    s %= 60
  }
  if (s > 0 || parts.length === 0) {
    parts.push(`${s}s`)
  }

  return parts.join(" ")
}
