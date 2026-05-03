import { useEffect, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
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
  const [descriptionView, setDescriptionView] = useState(null)

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
              <TableHead className="w-[1%] whitespace-nowrap text-right">Details</TableHead>
              <TableHead>Duration</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Start time</TableHead>
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
                  <TableCell className="max-w-[220px] truncate" title={row.description}>
                    {row.description}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 shrink-0 text-xs"
                      aria-label="View full alarm description"
                      onClick={() =>
                        setDescriptionView({
                          code: row.alarm_code,
                          text: row.description || "—",
                        })
                      }
                    >
                      View
                    </Button>
                  </TableCell>
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

        <Dialog
          open={descriptionView !== null}
          onOpenChange={(open) => {
            if (!open) setDescriptionView(null)
          }}
        >
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Alarm {descriptionView?.code ?? ""}</DialogTitle>
            </DialogHeader>
            <p className="max-h-[min(60vh,24rem)] overflow-y-auto text-sm leading-relaxed text-slate-700 dark:text-slate-200">
              {descriptionView?.text}
            </p>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDescriptionView(null)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  )
}
