import { useCallback, useEffect, useMemo, useState } from "react"
import { api } from "@/lib/api"
import { DashboardDataContext } from "@/contexts/dashboard-data-context"
import { useAuth } from "@/hooks/useAuth"
import { connectRealtimeSocket, disconnectRealtimeSocket } from "@/services/realtimeSocket"

const REFRESH_INTERVAL_MS = 15000
const MACHINE_RUNNING_STALE_THRESHOLD_MS = 5 * 60 * 1000
const DEFAULT_SHIFT_DURATION_SECONDS = 8 * 60 * 60

const EMPTY_KPIS = {
  window_start_utc: null,
  window_end_utc: null,
  total_bags_produced: 0,
  total_tonnage: 0,
  average_giveaway: 0,
  active_alarms_count: 0,
}

const EMPTY_CHART = {
  window_start_utc: null,
  window_end_utc: null,
  points: [],
}

const INITIAL_STATE = {
  kpis: EMPTY_KPIS,
  chart: EMPTY_CHART,
  production: [],
  alarms: [],
  telemetry: null,
  realtime: {
    connected: false,
    engineRunning: null,
    simulator: null,
    pollIntervalMs: null,
    socketError: "",
    lastTelemetryAt: null,
    lastStatusAt: null,
  },
  isLoading: true,
  isRefreshing: false,
  error: "",
  lastUpdated: null,
}

function normalizeMachineMode(modeValue) {
  const normalized = Number(modeValue)

  if (normalized === 1) return "LOCAL"
  if (normalized === 2) return "CENTRAL"
  if (normalized === 0) return "IDLE"
  return "UNKNOWN"
}

function getErrorMessage(error) {
  if (!error) return ""
  if (typeof error?.message === "string" && error.message.trim().length > 0) {
    return error.message
  }

  return "Failed to synchronize live dashboard data."
}

function resolveApiData(payload) {
  if (!payload || typeof payload !== "object") return null
  if (payload.data && typeof payload.data === "object") return payload.data
  return payload
}

function normalizeKpis(payload) {
  const data = resolveApiData(payload)
  const source = data?.kpis && typeof data.kpis === "object" ? data.kpis : null
  if (!source) return EMPTY_KPIS

  return {
    window_start_utc: source.window_start_utc || null,
    window_end_utc: source.window_end_utc || null,
    total_bags_produced: Number(source.total_bags_produced || 0),
    total_tonnage: Number(source.total_tonnage || 0),
    average_giveaway: Number(source.average_giveaway || 0),
    active_alarms_count: Number(source.active_alarms_count || 0),
  }
}

function normalizeChart(payload) {
  const data = resolveApiData(payload)
  const source = data?.chart && typeof data.chart === "object" ? data.chart : null

  if (!source) {
    return EMPTY_CHART
  }

  const points = Array.isArray(source.points)
    ? source.points.map((point) => ({
        hour: point.hour,
        bags_produced: Number(point.bags_produced || 0),
        total_tonnage: Number(point.total_tonnage || 0),
        average_giveaway: Number(point.average_giveaway || 0),
      }))
    : []

  return {
    window_start_utc: source.window_start_utc || null,
    window_end_utc: source.window_end_utc || null,
    points,
  }
}

function normalizeList(payload) {
  const data = resolveApiData(payload)
  return Array.isArray(data?.items) ? data.items : []
}

function normalizeTelemetry(payload) {
  if (!payload || typeof payload !== "object") return null

  const alarms = payload.Alarms && typeof payload.Alarms === "object" ? payload.Alarms : {}

  const telemetry = {
    Production_Counter: Number(payload.Production_Counter || 0),
    Last_Bag_Weight: Number(payload.Last_Bag_Weight || 0),
    Last_Bag_Target: Number(payload.Last_Bag_Target || 0),
    Last_Spout_ID: Number(payload.Last_Spout_ID || 0),
    Live_Weight: Number(payload.Live_Weight || 0),
    Machine_Mode: Number(payload.Machine_Mode || 0),
    motor_ensacheuse: Boolean(payload.motor_ensacheuse),
    motor_bande: Boolean(payload.motor_bande),
    mode_local: Boolean(payload.mode_local),
    mode_central: Boolean(payload.mode_central),
    Alarms: {
      js1: Boolean(alarms.js1),
      js2: Boolean(alarms.js2),
      js3: Boolean(alarms.js3),
      js4: Boolean(alarms.js4),
      js5: Boolean(alarms.js5),
    },
  }

  const scalarValues = [
    telemetry.Production_Counter,
    telemetry.Last_Bag_Weight,
    telemetry.Last_Bag_Target,
    telemetry.Last_Spout_ID,
    telemetry.Live_Weight,
    telemetry.Machine_Mode,
  ]

  if (scalarValues.some((value) => !Number.isFinite(value))) {
    return null
  }

  return telemetry
}

function deriveMachineStatus(productionRows) {
  const latestTimestamp = productionRows.length > 0 ? Date.parse(productionRows[0].created_at) : Number.NaN
  const hasRecentProduction =
    Number.isFinite(latestTimestamp) && Date.now() - latestTimestamp <= MACHINE_RUNNING_STALE_THRESHOLD_MS

  return {
    is_running: hasRecentProduction,
    current_mode: hasRecentProduction ? "CENTRAL" : "IDLE",
  }
}

function deriveMachineStatusFromTelemetry(telemetry) {
  if (!telemetry) return null

  const mode = normalizeMachineMode(telemetry.Machine_Mode)
  const motorsRunning =
    Boolean(telemetry.motor_ensacheuse) === true || Boolean(telemetry.motor_bande) === true

  return {
    is_running: motorsRunning,
    current_mode: mode,
  }
}

function deriveLiveMetrics(telemetry, kpis, productionRows) {
  const latestProduction = productionRows[0]

  if (telemetry) {
    return {
      hasTelemetry: true,
      productionCounter: Number(telemetry.Production_Counter || 0),
      liveWeight: Number(telemetry.Live_Weight || 0),
      lastBagWeight: Number(telemetry.Last_Bag_Weight || 0),
      targetWeight: Number(telemetry.Last_Bag_Target || 0),
      lastSpoutId: Number(telemetry.Last_Spout_ID || 0),
    }
  }

  return {
    hasTelemetry: false,
    productionCounter: Number(kpis.total_bags_produced || 0),
    liveWeight: Number(latestProduction?.weight_actual || 0),
    lastBagWeight: Number(latestProduction?.weight_actual || 0),
    targetWeight: Number(latestProduction?.weight_target || 0),
    lastSpoutId: Number(latestProduction?.spout_id || 0),
  }
}

function deriveOeeBreakdown(alarms) {
  const now = Date.now()
  const stoppedSecondsRaw = alarms.reduce((sum, alarm) => {
    if (alarm.end_time === null || alarm.end_time === undefined) {
      const startedAt = Date.parse(alarm.start_time)
      if (!Number.isFinite(startedAt)) return sum
      const elapsed = Math.max(Math.floor((now - startedAt) / 1000), 0)
      return sum + elapsed
    }

    return sum + Number(alarm.duration_sec || 0)
  }, 0)

  const stoppedSeconds = Math.min(stoppedSecondsRaw, DEFAULT_SHIFT_DURATION_SECONDS)
  const runningSeconds = Math.max(DEFAULT_SHIFT_DURATION_SECONDS - stoppedSeconds, 0)
  const oeePercent = DEFAULT_SHIFT_DURATION_SECONDS
    ? (runningSeconds / DEFAULT_SHIFT_DURATION_SECONDS) * 100
    : 0

  return {
    points: [
      { name: "Running", value: runningSeconds },
      { name: "Stopped", value: stoppedSeconds },
    ],
    percent: oeePercent,
  }
}

export function DashboardDataProvider({ children }) {
  const { isAuthenticated, token, role } = useAuth()
  const [state, setState] = useState(INITIAL_STATE)
  const isAdmin = role === "ADMIN"

  const refresh = useCallback(async () => {
    if (!isAuthenticated) return

    if (!isAdmin) {
      setState((prev) => ({
        ...prev,
        isLoading: false,
        isRefreshing: false,
        error: "",
      }))
      return
    }

    setState((prev) => ({
      ...prev,
      isLoading: prev.lastUpdated === null,
      isRefreshing: prev.lastUpdated !== null,
      error: "",
    }))

    const [kpisResult, chartResult, productionResult, alarmsResult] = await Promise.allSettled([
      api.get("/api/analytics/kpis"),
      api.get("/api/analytics/production-chart"),
      api.get("/api/production?page=1&limit=24"),
      api.get("/api/alarms?page=1&limit=50"),
    ])

    setState((prev) => {
      const nextKpis = kpisResult.status === "fulfilled" ? normalizeKpis(kpisResult.value) : prev.kpis
      const nextChart = chartResult.status === "fulfilled" ? normalizeChart(chartResult.value) : prev.chart
      const nextProduction =
        productionResult.status === "fulfilled" ? normalizeList(productionResult.value) : prev.production
      const nextAlarms = alarmsResult.status === "fulfilled" ? normalizeList(alarmsResult.value) : prev.alarms

      const firstError = [kpisResult, chartResult, productionResult, alarmsResult].find(
        (result) => result.status === "rejected"
      )

      return {
        ...prev,
        kpis: nextKpis,
        chart: nextChart,
        production: nextProduction,
        alarms: nextAlarms,
        isLoading: false,
        isRefreshing: false,
        error: firstError?.status === "rejected" ? getErrorMessage(firstError.reason) : "",
        lastUpdated: new Date().toISOString(),
      }
    })
  }, [isAuthenticated, isAdmin])

  useEffect(() => {
    if (!isAuthenticated) return

    const socket = connectRealtimeSocket(token)

    const handleConnect = () => {
      setState((prev) => ({
        ...prev,
        realtime: {
          ...prev.realtime,
          connected: true,
          socketError: "",
        },
      }))
    }

    const handleDisconnect = (reason) => {
      setState((prev) => ({
        ...prev,
        realtime: {
          ...prev.realtime,
          connected: false,
          socketError:
            reason === "io client disconnect" ? "" : `Realtime stream disconnected (${reason || "unknown"}).`,
        },
      }))
    }

    const handleConnectError = (error) => {
      setState((prev) => ({
        ...prev,
        realtime: {
          ...prev.realtime,
          connected: false,
          socketError: getErrorMessage(error),
        },
      }))
    }

    const handleRealtimeStatus = (payload) => {
      const status = payload && typeof payload === "object" ? payload : {}
      const pollIntervalMs = Number(status.pollIntervalMs)

      setState((prev) => ({
        ...prev,
        realtime: {
          ...prev.realtime,
          engineRunning:
            typeof status.running === "boolean" ? status.running : prev.realtime.engineRunning,
          simulator:
            typeof status.simulator === "boolean" ? status.simulator : prev.realtime.simulator,
          pollIntervalMs: Number.isFinite(pollIntervalMs)
            ? pollIntervalMs
            : prev.realtime.pollIntervalMs,
          lastStatusAt: new Date().toISOString(),
        },
      }))
    }

    const handleTelemetryUpdate = (payload) => {
      const telemetry = normalizeTelemetry(payload)
      if (!telemetry) return

      const activeAlarmsCount = Object.values(telemetry.Alarms).filter(Boolean).length

      setState((prev) => ({
        ...prev,
        telemetry,
        kpis: {
          ...prev.kpis,
          active_alarms_count: activeAlarmsCount,
        },
        realtime: {
          ...prev.realtime,
          connected: true,
          socketError: "",
          lastTelemetryAt: new Date().toISOString(),
        },
      }))
    }

    socket.on("connect", handleConnect)
    socket.on("disconnect", handleDisconnect)
    socket.on("connect_error", handleConnectError)
    socket.on("realtime_status", handleRealtimeStatus)
    socket.on("telemetry_update", handleTelemetryUpdate)

    if (socket.connected) {
      handleConnect()
    }

    return () => {
      socket.off("connect", handleConnect)
      socket.off("disconnect", handleDisconnect)
      socket.off("connect_error", handleConnectError)
      socket.off("realtime_status", handleRealtimeStatus)
      socket.off("telemetry_update", handleTelemetryUpdate)
      disconnectRealtimeSocket()
    }
  }, [isAuthenticated, token])

  useEffect(() => {
    if (!isAuthenticated || !isAdmin) {
      if (isAuthenticated && !isAdmin) {
        setState((prev) => ({
          ...prev,
          isLoading: false,
          isRefreshing: false,
          error: "",
        }))
      }

      return
    }

    let active = true
    const run = async () => {
      if (!active) return
      await refresh()
    }

    run()
    const timerId = window.setInterval(run, REFRESH_INTERVAL_MS)

    return () => {
      active = false
      window.clearInterval(timerId)
    }
  }, [isAuthenticated, isAdmin, refresh])

  const telemetryMachineStatus = useMemo(
    () => deriveMachineStatusFromTelemetry(state.telemetry),
    [state.telemetry]
  )
  const machineStatus = useMemo(() => {
    if (!state.realtime.connected) {
      return { is_running: false, current_mode: "OFFLINE" }
    }
    return telemetryMachineStatus || deriveMachineStatus(state.production)
  }, [state.realtime.connected, telemetryMachineStatus, state.production])
  const oee = useMemo(() => deriveOeeBreakdown(state.alarms), [state.alarms])
  const liveMetrics = useMemo(
    () => deriveLiveMetrics(state.telemetry, state.kpis, state.production),
    [state.telemetry, state.kpis, state.production]
  )
  const realtime = useMemo(
    () => ({
      ...state.realtime,
      healthy: state.realtime.connected && state.realtime.engineRunning !== false,
    }),
    [state.realtime]
  )

  const value = useMemo(
    () => ({
      ...state,
      refresh,
      machineStatus,
      oee,
      liveMetrics,
      realtime,
    }),
    [state, refresh, machineStatus, oee, liveMetrics, realtime]
  )

  return <DashboardDataContext.Provider value={value}>{children}</DashboardDataContext.Provider>
}
