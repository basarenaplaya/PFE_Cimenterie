import { useMemo } from "react"
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { SPOUT_DRIFT_THRESHOLD_KG } from "@/lib/spoutDrift"
import { cn } from "@/lib/utils"

function SpoutTooltip({ active, payload }) {
  if (!active || !payload?.length) {
    return null
  }

  const row = payload[0]?.payload
  if (!row) {
    return null
  }

  const avg = Number(row.avg_giveaway ?? 0)
  const bags = Number(row.bags_filled ?? 0)

  return (
    <div
      className="rounded-xl border px-3 py-2.5 text-xs shadow-lg"
      style={{
        backgroundColor: "#020617",
        borderColor: "rgba(148,163,184,0.25)",
        color: "#f8fafc",
      }}
    >
      <p className="font-semibold text-[13px] text-slate-100">{row.label}</p>
      <p className="mt-1.5 tabular-nums text-slate-200">
        Avg giveaway:{" "}
        <span className="font-medium text-white">{avg.toFixed(3)} kg</span>
      </p>
      <p className="mt-0.5 tabular-nums text-slate-300">
        Bags filled: <span className="font-medium text-white">{bags}</span>
      </p>
    </div>
  )
}

function computeYDomain(rows) {
  if (rows.length === 0) {
    return { y0: 0, y1: 0.5 }
  }

  let minV = Infinity
  let maxV = -Infinity
  for (const r of rows) {
    const v = Number(r.avg_giveaway ?? 0)
    minV = Math.min(minV, v)
    maxV = Math.max(maxV, v)
  }
  if (!Number.isFinite(minV)) {
    minV = 0
  }
  if (!Number.isFinite(maxV)) {
    maxV = 0
  }

  // Anchor floor at 0 when no negative averages — avoids bars floating above an arbitrary negative axis minimum.
  if (minV >= 0) {
    const pad = Math.max(maxV * 0.1, 0.06)
    const y1 = Math.max(maxV + pad, SPOUT_DRIFT_THRESHOLD_KG * 2.8, 0.35)
    return { y0: 0, y1 }
  }

  const span = maxV - minV || 1
  const pad = Math.max(span * 0.06, 0.05)
  return {
    y0: minV - pad,
    y1: maxV + pad,
  }
}

export function SpoutGiveawayBarChart({ points, isLoading, error, className, embedded = false }) {
  const rows = Array.isArray(points) ? points : []
  const isInitialLoading = isLoading && rows.length === 0

  const { y0, y1 } = useMemo(() => computeYDomain(rows), [rows])

  const chartBody = (
    <>
      {error ? (
        <div className="flex min-h-[240px] w-full shrink-0 items-center justify-center">
          <p className="text-center text-sm text-destructive">{error}</p>
        </div>
      ) : null}

      {!error && isInitialLoading ? (
        <div className="flex min-h-[280px] w-full shrink-0 items-center justify-center">
          <p className="text-sm text-slate-500 dark:text-slate-400">Loading spout analytics…</p>
        </div>
      ) : null}

      {!error && !isInitialLoading && rows.length === 0 ? (
        <div className="flex min-h-[240px] w-full shrink-0 items-center justify-center">
          <p className="text-sm text-slate-500 dark:text-slate-400">No spout data for this UTC day.</p>
        </div>
      ) : null}

      {!error && !isInitialLoading && rows.length > 0 ? (
        <div className={cn("relative h-[300px] w-full min-w-0 shrink-0")}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={rows}
              margin={{ left: 4, right: 8, top: 12, bottom: 4 }}
              barCategoryGap="18%"
            >
              <CartesianGrid stroke="rgba(148,163,184,0.2)" strokeDasharray="4 4" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fill: "#94a3b8", fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                tickMargin={8}
              />
              <YAxis
                width={52}
                domain={[y0, y1]}
                tick={{ fill: "#94a3b8", fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => Number(v).toFixed(2)}
                tickMargin={8}
              />
              {y0 < 0 && y1 > 0 ? (
                <ReferenceLine
                  y={0}
                  stroke="rgba(148, 163, 184, 0.55)"
                  strokeWidth={1.5}
                  strokeDasharray="4 3"
                />
              ) : null}
              <Tooltip cursor={{ fill: "rgba(148,163,184,0.08)" }} content={<SpoutTooltip />} />
              <Bar
                dataKey="avg_giveaway"
                radius={[8, 8, 0, 0]}
                maxBarSize={48}
                animationDuration={520}
                animationEasing="ease-out"
              >
                {rows.map((entry) => {
                  const v = Number(entry.avg_giveaway ?? 0)
                  const isHot = v > SPOUT_DRIFT_THRESHOLD_KG
                  return (
                    <Cell
                      key={entry.spout_id}
                      fill={isHot ? "var(--destructive)" : "var(--primary)"}
                    />
                  )
                })}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : null}
    </>
  )

  if (embedded) {
    return <div className={cn("min-w-0", className)}>{chartBody}</div>
  }

  return (
    <Card
      className={cn(
        "flex h-full min-h-0 min-w-0 flex-col border-slate-200/80 bg-white/80 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-900/70",
        className
      )}
    >
      <CardHeader className="shrink-0 space-y-1 px-4 pb-2 pt-4 sm:px-6">
        <CardTitle className="text-base">Avg giveaway by spout (today UTC)</CardTitle>
        <CardDescription className="text-xs leading-relaxed">
          Bars above {SPOUT_DRIFT_THRESHOLD_KG.toFixed(2)} kg indicate calibration drift worth inspecting. Y-axis starts
          at 0 kg when all averages are non-negative.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col justify-center px-3 pb-5 pt-0 sm:px-6">{chartBody}</CardContent>
    </Card>
  )
}
