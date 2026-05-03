import { useEffect, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useDashboardData } from "@/hooks/useDashboardData"
import { formatDurationSeconds } from "@/lib/formatDuration"

function formatTime(value) {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return "--"

  return parsed.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  })
}

export function RecentAlarms() {
  const { alarms, isLoading, error } = useDashboardData()
  const rows = alarms.slice(0, 8)
  const isInitialLoading = isLoading && rows.length === 0
  const [, setTick] = useState(0)

  const hasActiveAlarm = alarms.some((row) => row.end_time === null)

  useEffect(() => {
    if (!hasActiveAlarm) {
      return undefined
    }
    const id = window.setInterval(() => setTick((n) => n + 1), 1000)
    return () => window.clearInterval(id)
  }, [hasActiveAlarm])

  return (
    <Card className="border-slate-200/80 bg-white/80 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-900/70">
      <CardHeader>
        <CardTitle className="text-base">Active / Recent Alarms</CardTitle>
      </CardHeader>
      <CardContent>
        {isInitialLoading ? (
          <div className="pb-3 text-sm text-slate-500 dark:text-slate-400">Loading alarm events...</div>
        ) : null}

        {!isInitialLoading && rows.length === 0 ? (
          <div className="pb-3 text-sm text-slate-500 dark:text-slate-400">No alarm records available.</div>
        ) : null}

        {error ? (
          <div className="pb-3 text-xs font-medium text-amber-600 dark:text-amber-300">Showing cached data.</div>
        ) : null}

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Duration</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Start Time</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => {
              const isActive = row.end_time === null
              const startedAt = Date.parse(row.start_time)
              const activeSeconds =
                isActive && Number.isFinite(startedAt)
                  ? Math.max(0, Math.floor((Date.now() - startedAt) / 1000))
                  : 0
              const durationLabel = isActive
                ? formatDurationSeconds(activeSeconds)
                : formatDurationSeconds(row.duration_sec)

              return (
                <TableRow key={row.id}>
                  <TableCell className="font-medium">{row.alarm_code}</TableCell>
                  <TableCell className="max-w-[220px] truncate">{row.description}</TableCell>
                  <TableCell>
                    {isActive ? (
                      <span className="text-amber-600 dark:text-amber-400">{durationLabel} (active)</span>
                    ) : (
                      durationLabel
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={isActive ? "destructive" : "outline"}>
                      {isActive ? "Active" : "Cleared"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right text-slate-500 dark:text-slate-400">
                    {formatTime(row.start_time)}
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
