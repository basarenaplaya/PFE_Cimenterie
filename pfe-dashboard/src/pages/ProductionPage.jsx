import { FinancialImpactSection, ProductionPricingDialogTrigger } from "@/components/dashboard/FinancialImpactSection"
import { KPIGrid } from "@/components/dashboard/KPIGrid"
import { ProductionChart } from "@/components/dashboard/ProductionChart"
import { RecentProductionLog } from "@/components/dashboard/RecentProductionLog"

export default function ProductionPage() {
  return (
    <div className="space-y-6">
      <section className="dashboard-enter" style={{ animationDelay: "40ms" }}>
        <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-50">Production Analytics</h2>
            <p className="text-sm text-slate-600 dark:text-slate-300">Bags, rates, and money impact.</p>
          </div>
          <ProductionPricingDialogTrigger />
        </div>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
          <KPIGrid />
        </div>
        <div className="mt-8">
          <FinancialImpactSection />
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
