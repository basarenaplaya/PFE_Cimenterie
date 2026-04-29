import { KPIGrid } from "@/components/dashboard/KPIGrid"
import { ProductionChart } from "@/components/dashboard/ProductionChart"
import { OEEChart } from "@/components/dashboard/OEEChart"
import { RecentProductionLog } from "@/components/dashboard/RecentProductionLog"
import { RecentAlarms } from "@/components/dashboard/RecentAlarms"

export function DashboardHome() {
  return (
    <div className="space-y-6">
      <section
        className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4 dashboard-enter"
        style={{ animationDelay: "40ms" }}
      >
        <KPIGrid />
      </section>

      <section
        className="grid grid-cols-1 gap-6 xl:grid-cols-5 xl:items-stretch dashboard-enter"
        style={{ animationDelay: "130ms" }}
      >
        <ProductionChart className="xl:col-span-3" />
        <OEEChart className="xl:col-span-2" />
      </section>

      <section
        className="grid grid-cols-1 gap-6 xl:grid-cols-2 dashboard-enter"
        style={{ animationDelay: "220ms" }}
      >
        <RecentProductionLog />
        <RecentAlarms />
      </section>
    </div>
  )
}
