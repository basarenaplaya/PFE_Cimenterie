import { useMemo } from "react"
import { AlertTriangle, Cpu } from "lucide-react"
import { useDashboardData } from "@/hooks/useDashboardData"

function modeFromMachineMode(modeValue) {
  const normalized = Number(modeValue)
  if (normalized === 1) return "LOCAL"
  if (normalized === 2) return "CENTRAL"
  if (normalized === 0) return "IDLE"
  return "UNKNOWN"
}

function resolveLocalCentralLabel(telemetry, machineStatus, connected) {
  if (!connected) return "—"

  if (telemetry) {
    const loc = Boolean(telemetry.mode_local)
    const cen = Boolean(telemetry.mode_central)
    if (loc && !cen) return "LOCAL"
    if (cen && !loc) return "CENTRAL"
    if (loc && cen) {
      const m = modeFromMachineMode(telemetry.Machine_Mode)
      if (m === "LOCAL" || m === "CENTRAL") return m
    }
    const fromMode = modeFromMachineMode(telemetry.Machine_Mode)
    if (fromMode === "LOCAL" || fromMode === "CENTRAL") return fromMode
  }

  const m = machineStatus.current_mode
  if (m === "LOCAL" || m === "CENTRAL") return m
  return "—"
}

export function MobileStatusStrip() {
  const { machineStatus, kpis, realtime, telemetry } = useDashboardData()
  const activeAlarms = Number(kpis.active_alarms_count || 0)
  const connected = Boolean(realtime.connected)

  const motion = useMemo(() => {
    if (!connected) {
      return {
        label: "OFFLINE",
        hint: "PLC offline",
        ping: false,
        dotClass: "bg-amber-500 shadow-[0_0_12px] shadow-amber-500/50",
      }
    }
    if (machineStatus.is_running) {
      return {
        label: "RUNNING",
        hint: "Live motors",
        ping: true,
        dotClass: "bg-emerald-500 shadow-[0_0_16px] shadow-emerald-500/70",
      }
    }
    return {
      label: "STOPPED",
      hint: "Idle",
      ping: false,
      dotClass: "bg-slate-400 dark:bg-slate-500",
    }
  }, [connected, machineStatus.is_running])

  const modeLabel = useMemo(
    () => resolveLocalCentralLabel(telemetry, machineStatus, connected),
    [telemetry, machineStatus, connected]
  )

  return (
    <section className="status-strip-safe fixed inset-x-2 z-40 mx-auto w-auto max-w-md md:hidden">
      <div className="grid grid-cols-3 gap-1 rounded-2xl border border-slate-200/80 bg-white/85 p-1.5 shadow-lg backdrop-blur-xl dark:border-slate-800 dark:bg-slate-900/85">
        <div className="flex min-w-0 flex-col items-center justify-center gap-0.5 rounded-xl bg-slate-100/90 px-1.5 py-2 text-[10px] font-medium leading-tight text-slate-700 dark:bg-slate-800/80 dark:text-slate-200 sm:text-[11px]">
          <div className="flex items-center gap-1">
            <div className="relative flex h-3 w-3 shrink-0">
              {motion.ping ? (
                <>
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className={`relative inline-flex h-3 w-3 rounded-full ${motion.dotClass}`} />
                </>
              ) : (
                <span className={`relative inline-flex h-3 w-3 rounded-full ${motion.dotClass}`} />
              )}
            </div>
            <span className="truncate font-semibold tracking-wide">{motion.label}</span>
          </div>
          <span className="line-clamp-2 text-center text-[9px] font-normal text-slate-500 dark:text-slate-400">
            {motion.hint}
          </span>
        </div>

        <div className="flex min-w-0 flex-col items-center justify-center gap-0.5 rounded-xl bg-slate-100/90 px-1.5 py-2 text-[10px] font-medium leading-tight text-slate-700 dark:bg-slate-800/80 dark:text-slate-200 sm:text-[11px]">
          <Cpu className="h-3.5 w-3.5 shrink-0 text-cyan-500" />
          <span className="truncate text-center font-semibold">
            {!connected ? "—" : modeLabel}
          </span>
          <span className="line-clamp-2 text-center text-[9px] font-normal text-slate-500 dark:text-slate-400">
            {!connected ? "N/A" : "LOCAL / CENTRAL"}
          </span>
        </div>

        <div className="flex items-center justify-center gap-1.5 rounded-xl bg-slate-100/90 px-1.5 py-2 text-[10px] font-medium text-slate-700 dark:bg-slate-800/80 dark:text-slate-200 sm:text-[11px]">
          <AlertTriangle
            className={
              activeAlarms > 0 ? "h-3.5 w-3.5 shrink-0 text-amber-500" : "h-3.5 w-3.5 shrink-0 text-emerald-500"
            }
          />
          <span className="truncate">
            {activeAlarms} {activeAlarms === 1 ? "alarm" : "alarms"}
          </span>
        </div>
      </div>
    </section>
  )
}
