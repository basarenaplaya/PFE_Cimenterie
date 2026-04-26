import { AlertTriangle, Cpu, Radio } from "lucide-react"
import { useDashboardData } from "@/hooks/useDashboardData"

export function MobileStatusStrip() {
  const { machineStatus, kpis, realtime } = useDashboardData()
  const activeAlarms = Number(kpis.active_alarms_count || 0)

  return (
    <section className="status-strip-safe fixed inset-x-2 z-30 mx-auto w-auto max-w-md md:hidden">
      <div className="grid grid-cols-3 gap-1 rounded-2xl border border-slate-200/80 bg-white/85 p-1.5 shadow-lg backdrop-blur-xl dark:border-slate-800 dark:bg-slate-900/85">
        <div className="flex items-center justify-center gap-1.5 rounded-xl bg-slate-100/90 px-2 py-2 text-[11px] font-medium text-slate-700 dark:bg-slate-800/80 dark:text-slate-200">
          <Radio
            className={
              realtime.connected
                ? "h-3.5 w-3.5 text-emerald-500"
                : "h-3.5 w-3.5 text-amber-500"
            }
          />
          <span>{realtime.connected ? "PLC OK" : "NO PLC"}</span>
        </div>

        <div className="flex items-center justify-center gap-1.5 rounded-xl bg-slate-100/90 px-2 py-2 text-[11px] font-medium text-slate-700 dark:bg-slate-800/80 dark:text-slate-200">
          <AlertTriangle
            className={
              activeAlarms > 0 ? "h-3.5 w-3.5 text-amber-500" : "h-3.5 w-3.5 text-emerald-500"
            }
          />
          <span>{activeAlarms} alarms</span>
        </div>

        <div className="flex items-center justify-center gap-1.5 rounded-xl bg-slate-100/90 px-2 py-2 text-[11px] font-medium text-slate-700 dark:bg-slate-800/80 dark:text-slate-200">
          <Cpu className="h-3.5 w-3.5 text-cyan-500" />
          <span>{machineStatus.current_mode}</span>
        </div>
      </div>
    </section>
  )
}
