import { Activity, AlertTriangle, Package, Weight } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useCountUp } from "@/hooks/useCountUp"
import { useDashboardData } from "@/hooks/useDashboardData"

function formatSignedKg(value) {
  const sign = value > 0 ? "+" : ""
  return `${sign}${value.toFixed(2)} kg`
}

function AnimatedMetric({ target, decimals = 0, formatter }) {
  const value = useCountUp(target, { duration: 850 })
  const fixedValue = Number(value.toFixed(decimals))

  return formatter(fixedValue)
}

export function KPIGrid() {
  const { kpis, production, liveMetrics, isLoading, error, lastUpdated } = useDashboardData()
  const totalBags = Number(kpis.total_bags_produced || 0)
  const totalTonnage = Number(kpis.total_tonnage || 0) / 1000
  const kpiAvgGiveaway = Number(kpis.average_giveaway || 0)
  const fallbackAvgGiveaway =
    production.length > 0
      ? production.reduce((sum, row) => sum + Number(row.giveaway || 0), 0) / production.length
      : 0
  const telemetryGiveaway =
    liveMetrics?.hasTelemetry && Number(liveMetrics.targetWeight || 0) > 0
      ? Number(liveMetrics.lastBagWeight || 0) - Number(liveMetrics.targetWeight || 0)
      : 0
  const useKpiValue = Math.abs(kpiAvgGiveaway) >= 0.0001
  const useProductionFallback = !useKpiValue && production.length > 0
  const useTelemetryFallback = !useKpiValue && !useProductionFallback && Number(liveMetrics?.targetWeight || 0) > 0
  const avgGiveaway = useKpiValue
    ? kpiAvgGiveaway
    : useProductionFallback
      ? fallbackAvgGiveaway
      : telemetryGiveaway
  const activeAlarms = Number(kpis.active_alarms_count || 0)
  const isSyncing = isLoading && !lastUpdated

  const cards = [
    {
      title: "Total Bags Produced",
      target: totalBags,
      decimals: 0,
      formatter: (value) => Math.round(value).toLocaleString(),
      icon: Package,
      trendLabel: isSyncing ? "Syncing live historian..." : "Live from current UTC day",
      trendTone: "ok",
      iconTone: "text-cyan-500",
    },
    {
      title: "Total Tonnage",
      target: totalTonnage,
      decimals: 2,
      formatter: (value) => `${value.toFixed(2)} t`,
      icon: Weight,
      trendLabel: isSyncing ? "Waiting for KPI feed" : "Calculated from production logs",
      trendTone: "ok",
      iconTone: "text-indigo-500",
    },
    {
      title: "Avg Giveaway kg",
      target: avgGiveaway,
      decimals: 2,
      formatter: (value) => formatSignedKg(value),
      icon: Activity,
      trendLabel: isSyncing
        ? "Waiting for KPI feed"
        : useTelemetryFallback
          ? "Using live bag telemetry"
        : avgGiveaway <= 0.1
          ? "Within tolerance"
          : "Needs correction",
      trendTone: avgGiveaway <= 0.1 ? "ok" : "warn",
      iconTone: avgGiveaway <= 0.1 ? "text-emerald-500" : "text-rose-500",
    },
    {
      title: "Active Alarms",
      target: activeAlarms,
      decimals: 0,
      formatter: (value) => Math.round(value).toString(),
      icon: AlertTriangle,
      trendLabel: isSyncing
        ? "Waiting for alarm stream"
        : activeAlarms === 0
          ? "No active events"
          : "Action required",
      trendTone: activeAlarms === 0 ? "ok" : "warn",
      iconTone: activeAlarms === 0 ? "text-emerald-500" : "text-amber-500",
    },
  ]

  return cards.map((item, index) => {
    const Icon = item.icon

    return (
      <Card
        key={item.title}
        className="border-slate-200/80 bg-white/80 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-900/70 dashboard-enter"
        style={{ animationDelay: `${index * 70}ms` }}
      >
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm text-slate-600 dark:text-slate-300">
              {item.title}
            </CardTitle>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-2 dark:border-slate-700 dark:bg-slate-800/80">
              <Icon className={`h-4 w-4 ${item.iconTone}`} />
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-3xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">
            <AnimatedMetric
              target={item.target}
              decimals={item.decimals}
              formatter={item.formatter}
            />
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={item.trendTone === "ok" ? "secondary" : "destructive"}>
              {item.trendLabel}
            </Badge>
            {error ? <Badge variant="outline">Live sync delayed</Badge> : null}
          </div>
        </CardContent>
      </Card>
    )
  })
}
