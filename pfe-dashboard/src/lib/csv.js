import { format, isValid, parseISO } from "date-fns"

/**
 * Format API / ISO datetimes for CSV (Excel-friendly, no trailing `Z` noise).
 * @param {unknown} value
 * @returns {string}
 */
export function formatCsvDateTime(value) {
  if (value === null || value === undefined || value === "") return ""
  if (value instanceof Date) {
    return isValid(value) ? format(value, "yyyy-MM-dd HH:mm:ss") : ""
  }
  if (typeof value === "string") {
    const trimmed = value.trim()
    if (!trimmed) return ""
    const d = /^\d{4}-\d{2}-\d{2}T/.test(trimmed) ? parseISO(trimmed) : new Date(trimmed)
    if (isValid(d)) return format(d, "yyyy-MM-dd HH:mm:ss")
  }
  return String(value)
}

/**
 * Escape a CSV field (RFC 4180 style).
 * @param {unknown} value
 */
function escapeCell(value) {
  if (value === null || value === undefined) {
    return ""
  }
  const s = String(value)
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

/**
 * @param {string[]} headers
 * @param {Record<string, unknown>[]} rows
 * @param {(row: Record<string, unknown>) => unknown[]} rowMapper
 */
export function buildCsv(headers, rows, rowMapper) {
  const lines = [headers.map(escapeCell).join(",")]
  for (const row of rows) {
    lines.push(rowMapper(row).map(escapeCell).join(","))
  }
  return lines.join("\r\n")
}

/**
 * @param {string} filename
 * @param {string} csvBody
 */
export function downloadCsv(filename, csvBody) {
  const blob = new Blob(["\uFEFF", csvBody], { type: "text/csv;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename.endsWith(".csv") ? filename : `${filename}.csv`
  a.rel = "noopener"
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

export const CSV_EXPORT_MAX_ROWS = 2000

/**
 * @template T
 * @param {(args: { page: number, limit: number }) => Promise<{ items: T[], meta?: { totalItems?: number } }>} fetchPage
 * @param {{ maxRows?: number, limit?: number }} options
 * @returns {Promise<{ rows: T[], truncated: boolean }>}
 */
export async function fetchAllRowsForExport(fetchPage, options = {}) {
  const maxRows = options.maxRows ?? CSV_EXPORT_MAX_ROWS
  const limit = Math.min(options.limit ?? 200, 200)
  const rows = []
  let page = 1
  let truncated = false

  while (rows.length < maxRows) {
    const { items, meta } = await fetchPage({ page, limit })
    const batch = Array.isArray(items) ? items : []
    if (batch.length === 0) {
      break
    }
    for (const item of batch) {
      rows.push(item)
      if (rows.length >= maxRows) {
        truncated = true
        break
      }
    }
    if (truncated) {
      break
    }
    const total = Number(meta?.totalItems ?? 0)
    if (total > 0 && page * limit >= total) {
      break
    }
    if (batch.length < limit) {
      break
    }
    page += 1
    if (page > 500) {
      truncated = true
      break
    }
  }

  return { rows, truncated }
}
