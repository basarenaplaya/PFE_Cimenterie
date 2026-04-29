import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useDashboardData } from "@/hooks/useDashboardData"
import { cn } from "@/lib/utils"
import { useId, useMemo } from "react"
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

export function ProductionChart({ className }) {
  const gradientId = `hourlyFill-${useId().replace(/:/g, "")}`
  const { chart, isLoading } = useDashboardData()
  const rows = Array.isArray(chart.points) ? chart.points : []
  const isInitialLoading = isLoading && rows.length === 0

  /** Even Y ticks + ceiling so horizontal grid lines are evenly spaced */
  const { yMax, yTicks } = useMemo(() => {
    const maxVal = rows.reduce((m, r) => Math.max(m, Number(r.bags_produced) || 0), 0)
    if (maxVal <= 0) {
      return { yMax: 10, yTicks: [0, 2, 4, 6, 8, 10] }
    }
    const padded = maxVal * 1.08
    const pow = 10 ** Math.floor(Math.log10(Math.max(padded, 1)))
    const n = padded / pow
    const unit =
      n <= 1 ? pow : n <= 2 ? 2 * pow : n <= 5 ? 5 * pow : 10 * pow
    const ceil = Math.ceil(padded / unit) * unit
    const top = Math.max(ceil, 10)
    const segments = 5
    const step = Math.max(1, Math.ceil(top / segments))
    const alignedTop = step * segments
    const ticks = Array.from({ length: segments + 1 }, (_, i) => i * step)
    return { yMax: alignedTop, yTicks: ticks }
  }, [rows])

  return (
    <Card
      className={cn(
        "flex h-full min-h-0 min-w-0 flex-col border-slate-200/80 bg-white/80 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-900/70",
        className
      )}
    >
      <CardHeader className="shrink-0 px-4 pb-2 pt-4 sm:px-6">
        <CardTitle className="text-base">Hourly Production (Bags/Hour)</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col justify-center px-3 pb-5 pt-0 sm:px-6">
        {isInitialLoading ? (
          <div className="flex min-h-[240px] w-full shrink-0 items-center justify-center">
            <p className="text-sm text-slate-500 dark:text-slate-400">Loading hourly production feed...</p>
          </div>
        ) : null}

        {!isInitialLoading && rows.length === 0 ? (
          <div className="flex min-h-[240px] w-full shrink-0 items-center justify-center">
            <p className="text-sm text-slate-500 dark:text-slate-400">No production points yet for this UTC day.</p>
          </div>
        ) : null}

        {!isInitialLoading && rows.length > 0 ? (
          <div className="relative h-[320px] w-full min-w-0 shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={rows}
                margin={{ left: 2, right: 8, top: 8, bottom: 4 }}
              >
                <defs>
                  <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="#06b6d4" stopOpacity={0.08} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  stroke="rgba(148,163,184,0.2)"
                  strokeDasharray="4 4"
                  horizontal
                  vertical
                />
                <XAxis
                  dataKey="hour"
                  tick={{ fill: "#94a3b8", fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  interval={3}
                  minTickGap={8}
                  padding={{ left: 4, right: 4 }}
                  tickMargin={8}
                />
                <YAxis
                  width={48}
                  domain={[0, yMax]}
                  ticks={yTicks}
                  allowDecimals={false}
                  tick={{ fill: "#94a3b8", fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#020617",
                    border: "1px solid rgba(148,163,184,0.25)",
                    borderRadius: "12px",
                    color: "#f8fafc",
                  }}
                  labelStyle={{ color: "#e2e8f0" }}
                />
                <Area
                  type="monotone"
                  dataKey="bags_produced"
                  stroke="#06b6d4"
                  strokeWidth={2.5}
                  fill={`url(#${gradientId})`}
                  activeDot={{ r: 4 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}
