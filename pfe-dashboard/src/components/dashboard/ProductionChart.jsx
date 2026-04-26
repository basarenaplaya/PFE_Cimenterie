import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useDashboardData } from "@/hooks/useDashboardData"
import { cn } from "@/lib/utils"
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
  const { chart, isLoading } = useDashboardData()
  const rows = Array.isArray(chart.points) ? chart.points : []
  const isInitialLoading = isLoading && rows.length === 0

  return (
    <Card
      className={cn(
        "border-slate-200/80 bg-white/80 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-900/70",
        className
      )}
    >
      <CardHeader>
        <CardTitle className="text-base">Hourly Production (Bags/Hour)</CardTitle>
      </CardHeader>
      <CardContent className="h-[320px]">
        {isInitialLoading ? (
          <div className="grid h-full place-items-center">
            <p className="text-sm text-slate-500 dark:text-slate-400">Loading hourly production feed...</p>
          </div>
        ) : null}

        {!isInitialLoading && rows.length === 0 ? (
          <div className="grid h-full place-items-center">
            <p className="text-sm text-slate-500 dark:text-slate-400">No production points yet for this UTC day.</p>
          </div>
        ) : null}

        {!isInitialLoading && rows.length > 0 ? (
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={rows} margin={{ left: 10, right: 10, top: 8, bottom: 0 }}>
            <defs>
              <linearGradient id="hourlyFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.8} />
                <stop offset="95%" stopColor="#06b6d4" stopOpacity={0.08} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.24)" />
            <XAxis dataKey="hour" tick={{ fill: "#94a3b8", fontSize: 12 }} tickLine={false} axisLine={false} />
            <YAxis tick={{ fill: "#94a3b8", fontSize: 12 }} tickLine={false} axisLine={false} />
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
              fill="url(#hourlyFill)"
              activeDot={{ r: 4 }}
            />
          </AreaChart>
        </ResponsiveContainer>
        ) : null}
      </CardContent>
    </Card>
  )
}
