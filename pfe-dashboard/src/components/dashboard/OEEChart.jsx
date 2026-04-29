import { useMemo } from "react"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useDashboardData } from "@/hooks/useDashboardData"
import { formatDurationSeconds } from "@/lib/formatDuration"
import { cn } from "@/lib/utils"
import { Pie, PieChart, ResponsiveContainer, Tooltip, Cell } from "recharts"

const COLORS = ["#10b981", "#f97316"]

export function OEEChart({ className }) {
  const { oee } = useDashboardData()
  const machineOeeData = oee.points
  const oeePercent = Number(oee.percent || 0)

  const { runningSec, stoppedSec, runningPct, stoppedPct } = useMemo(() => {
    const running = Number(machineOeeData[0]?.value || 0)
    const stopped = Number(machineOeeData[1]?.value || 0)
    const total = running + stopped
    if (total <= 0) {
      return { runningSec: 0, stoppedSec: 0, runningPct: 0, stoppedPct: 0 }
    }
    return {
      runningSec: running,
      stoppedSec: stopped,
      runningPct: (running / total) * 100,
      stoppedPct: (stopped / total) * 100,
    }
  }, [machineOeeData])

  return (
    <Card
      className={cn(
        "min-w-0 border-slate-200/80 bg-white/80 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-900/70",
        className
      )}
    >
      <CardHeader className="space-y-2 pb-2">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <CardTitle className="text-base">Machine Status / OEE</CardTitle>
            <CardDescription className="text-xs leading-relaxed">
              Performance index from running vs stopped time over the modeled shift window (availability-style OEE).
            </CardDescription>
          </div>
          <span className="shrink-0 rounded-full border border-slate-200/90 bg-slate-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-600 dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-300">
            Index
          </span>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-5 px-4 pb-5 pt-0 sm:px-6">
        <div className="relative mx-auto h-[220px] w-full max-w-[280px]">
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
                innerRadius="58%"
                outerRadius="88%"
                paddingAngle={2}
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
            <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
              OEE index
            </p>
            <p className="text-3xl font-semibold tabular-nums text-slate-900 dark:text-slate-50">
              {oeePercent.toFixed(1)}%
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 border-t border-slate-200/80 pt-4 dark:border-slate-800">
          <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/[0.07] px-3 py-2.5 dark:bg-emerald-500/9">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
              Running
            </p>
            <p className="mt-1 font-mono text-sm font-medium text-slate-900 dark:text-slate-50">
              {formatDurationSeconds(runningSec)}
            </p>
            <p className="mt-0.5 text-[11px] text-slate-600 dark:text-slate-400">
              {runningPct.toFixed(1)}% of shift
            </p>
          </div>
          <div className="rounded-xl border border-orange-500/25 bg-orange-500/[0.07] px-3 py-2.5 dark:bg-orange-500/9">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-orange-700 dark:text-orange-400">
              Stopped
            </p>
            <p className="mt-1 font-mono text-sm font-medium text-slate-900 dark:text-slate-50">
              {formatDurationSeconds(stoppedSec)}
            </p>
            <p className="mt-0.5 text-[11px] text-slate-600 dark:text-slate-400">
              {stoppedPct.toFixed(1)}% of shift
            </p>
          </div>
        </div>

        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-600 dark:text-slate-400">
          <li className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-emerald-500" aria-hidden />
            <span>Running</span>
          </li>
          <li className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-orange-500" aria-hidden />
            <span>Stopped / alarms</span>
          </li>
        </ul>
      </CardContent>
    </Card>
  )
}
