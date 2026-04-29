import { useCallback, useEffect, useState } from "react"

import { OEEChart } from "@/components/dashboard/OEEChart"
import { RecentAlarms } from "@/components/dashboard/RecentAlarms"
import { SpoutHealthDriftSection } from "@/components/dashboard/SpoutHealthDriftSection"
import { getAnalyticsSpoutGiveawayToday } from "@/services/adminApi"

const REFRESH_INTERVAL_MS = 15000

export function MaintenanceCenter() {
  const [chart, setChart] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const load = useCallback(async () => {
    try {
      const next = await getAnalyticsSpoutGiveawayToday()
      setChart(next)
      setError("")
    } catch (err) {
      setError(err?.message || "Unable to load spout analytics.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
    const timerId = window.setInterval(() => void load(), REFRESH_INTERVAL_MS)
    return () => window.clearInterval(timerId)
  }, [load])

  const points = chart?.points ?? []

  return (
    <div className="space-y-6">
      <section className="dashboard-enter" style={{ animationDelay: "40ms" }}>
        <div className="mb-3">
          <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-50">Maintenance Center</h2>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Monitor downtime contributors and alarm history for proactive service.
          </p>
        </div>
      </section>

      <section className="dashboard-enter space-y-3" style={{ animationDelay: "90ms" }}>
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
          Predictive maintenance
        </p>
        <SpoutHealthDriftSection points={points} isLoading={loading} error={error} />
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-5 dashboard-enter" style={{ animationDelay: "120ms" }}>
        <OEEChart className="xl:col-span-2" />
        <div className="xl:col-span-3">
          <RecentAlarms />
        </div>
      </section>
    </div>
  )
}
