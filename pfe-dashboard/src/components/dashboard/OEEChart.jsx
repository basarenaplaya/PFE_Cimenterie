import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useDashboardData } from "@/hooks/useDashboardData"
import { formatDurationSeconds } from "@/lib/formatDuration"
import { cn } from "@/lib/utils"
import { Pie, PieChart, ResponsiveContainer, Tooltip, Cell } from "recharts"

const COLORS = ["#10b981", "#f97316"]

export function OEEChart({ className }) {
  const { oee } = useDashboardData()
  const machineOeeData = oee.points
  const oeePercent = Number(oee.percent || 0)

  return (
    <Card
      className={cn(
        "border-slate-200/80 bg-white/80 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-900/70",
        className
      )}
    >
      <CardHeader>
        <CardTitle className="text-base">Machine Status / OEE</CardTitle>
      </CardHeader>
      <CardContent className="relative h-[320px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Tooltip
              formatter={(value) => [formatDurationSeconds(value), "Duration"]}
              contentStyle={{
                backgroundColor: "#020617",
                border: "1px solid rgba(148,163,184,0.25)",
                borderRadius: "12px",
                color: "#f8fafc",
              }}
            />
            <Pie
              data={machineOeeData}
              dataKey="value"
              nameKey="name"
              innerRadius={84}
              outerRadius={120}
              paddingAngle={3}
              strokeWidth={0}
              isAnimationActive={false}
            >
              {machineOeeData.map((entry, index) => (
                <Cell key={entry.name} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 grid place-content-center text-center">
          <p className="text-xs uppercase tracking-[0.15em] text-slate-500 dark:text-slate-400">OEE</p>
          <p className="text-3xl font-semibold text-slate-900 dark:text-slate-50">{oeePercent.toFixed(1)}%</p>
        </div>
      </CardContent>
    </Card>
  )
}
