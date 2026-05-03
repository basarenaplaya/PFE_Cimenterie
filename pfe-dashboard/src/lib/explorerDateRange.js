function startOfLocalDay(d) {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

function endOfLocalDay(d) {
  const x = new Date(d)
  x.setHours(23, 59, 59, 999)
  return x
}

export function getDefaultExplorerDateRange() {
  const to = endOfLocalDay(new Date())
  const from = startOfLocalDay(new Date())
  from.setDate(from.getDate() - 6)
  return { from, to }
}

export function dateRangeToIsoParams(range) {
  if (!range?.from || !range?.to) {
    return { startDate: "", endDate: "" }
  }
  return {
    startDate: startOfLocalDay(range.from).toISOString(),
    endDate: endOfLocalDay(range.to).toISOString(),
  }
}
