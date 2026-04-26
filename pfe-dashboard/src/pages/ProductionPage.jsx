import { KPIGrid } from "@/components/dashboard/KPIGrid"
import { ProductionChart } from "@/components/dashboard/ProductionChart"
import { RecentProductionLog } from "@/components/dashboard/RecentProductionLog"

export default function ProductionPage() {
  return (
    <div className="space-y-6">
      <section className="dashboard-enter" style={{ animationDelay: "40ms" }}>
        <div className="mb-3">
          <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-50">Production Analytics</h2>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Real-time packing throughput and bag quality indicators.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
          <KPIGrid />
        </div>
      </section>

      <section className="dashboard-enter" style={{ animationDelay: "120ms" }}>
        <ProductionChart />
      </section>

      <section className="dashboard-enter" style={{ animationDelay: "200ms" }}>
        <RecentProductionLog />
      </section>
    </div>
  )
}
