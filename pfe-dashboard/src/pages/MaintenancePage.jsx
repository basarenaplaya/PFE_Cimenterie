import { OEEChart } from "@/components/dashboard/OEEChart"
import { RecentAlarms } from "@/components/dashboard/RecentAlarms"

export default function MaintenancePage() {
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

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-5 dashboard-enter" style={{ animationDelay: "120ms" }}>
        <OEEChart className="xl:col-span-2" />
        <div className="xl:col-span-3">
          <RecentAlarms />
        </div>
      </section>
    </div>
  )
}
