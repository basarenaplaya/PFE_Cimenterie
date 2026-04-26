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

function formatTime(value) {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return "--"

  return parsed.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  })
}

export function RecentProductionLog() {
  const { production, isLoading, error } = useDashboardData()
  const rows = production.slice(0, 8)
  const isInitialLoading = isLoading && rows.length === 0

  return (
    <Card className="border-slate-200/80 bg-white/80 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-900/70">
      <CardHeader>
        <CardTitle className="text-base">Recent Production Log</CardTitle>
      </CardHeader>
      <CardContent>
        {isInitialLoading ? (
          <div className="pb-3 text-sm text-slate-500 dark:text-slate-400">Loading production records...</div>
        ) : null}

        {!isInitialLoading && rows.length === 0 ? (
          <div className="pb-3 text-sm text-slate-500 dark:text-slate-400">No production logs available yet.</div>
        ) : null}

        {error ? (
          <div className="pb-3 text-xs font-medium text-amber-600 dark:text-amber-300">Live sync delayed: showing latest cached records.</div>
        ) : null}

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ID</TableHead>
              <TableHead>Spout</TableHead>
              <TableHead>Actual</TableHead>
              <TableHead>Giveaway</TableHead>
              <TableHead className="text-right">Time</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="font-medium">#{row.id}</TableCell>
                <TableCell>{row.spout_id}</TableCell>
                <TableCell>{Number(row.weight_actual || 0).toFixed(2)} kg</TableCell>
                <TableCell className={Number(row.giveaway || 0) > 0 ? "text-amber-500" : "text-emerald-500"}>
                  {row.giveaway > 0 ? "+" : ""}
                  {Number(row.giveaway || 0).toFixed(2)}
                </TableCell>
                <TableCell className="text-right text-slate-500 dark:text-slate-400">
                  {formatTime(row.created_at)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
