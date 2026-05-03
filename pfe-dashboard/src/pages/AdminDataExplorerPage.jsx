import { useCallback, useEffect, useMemo, useState } from "react"
import { Download, Filter, Package, RefreshCw, Search, Shield, TriangleAlert } from "lucide-react"

import { DateRangePicker } from "@/components/admin/DateRangePicker"
import { dateRangeToIsoParams, getDefaultExplorerDateRange } from "@/lib/explorerDateRange"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useToast } from "@/hooks/useToast"
import { buildCsv, downloadCsv, fetchAllRowsForExport, formatCsvDateTime } from "@/lib/csv"
import { listAlarmHistory, listAuditLogs, listProductionHistory } from "@/services/adminApi"

function formatDateTime(value) {
  if (!value) return "--"
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return "--"
  return parsed.toLocaleString()
}

function totalPages(meta) {
  const total = Number(meta?.totalItems ?? 0)
  const limit = Number(meta?.limit ?? 1) || 1
  return Math.max(1, Math.ceil(total / limit))
}

export default function AdminDataExplorerPage() {
  const { success, error: toastError } = useToast()

  const [tab, setTab] = useState("production")

  const [draftRange, setDraftRange] = useState(() => getDefaultExplorerDateRange())
  const [appliedRange, setAppliedRange] = useState(() => getDefaultExplorerDateRange())

  const [draftSpout, setDraftSpout] = useState("all")
  const [appliedSpout, setAppliedSpout] = useState("all")

  const [draftAlarmStatus, setDraftAlarmStatus] = useState("all")
  const [appliedAlarmStatus, setAppliedAlarmStatus] = useState("all")

  const [draftAuditAction, setDraftAuditAction] = useState("")
  const [appliedAuditAction, setAppliedAuditAction] = useState("")

  const [draftAuditUserId, setDraftAuditUserId] = useState("")
  const [appliedAuditUserId, setAppliedAuditUserId] = useState("")

  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(50)

  const [items, setItems] = useState([])
  const [meta, setMeta] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState("")
  const [isExporting, setIsExporting] = useState(false)

  const dateParams = useMemo(() => dateRangeToIsoParams(appliedRange), [appliedRange])

  const applyFilters = useCallback(() => {
    if (!draftRange?.from || !draftRange?.to) {
      toastError("Select a complete date range (from and to).")
      return
    }
    if (draftRange.from.getTime() > draftRange.to.getTime()) {
      toastError("Invalid range: start date must be before end date.")
      return
    }
    setAppliedRange({ ...draftRange })
    setAppliedSpout(draftSpout)
    setAppliedAlarmStatus(draftAlarmStatus)
    setAppliedAuditAction(draftAuditAction.trim())
    setAppliedAuditUserId(draftAuditUserId.trim())
    setPage(1)
  }, [draftRange, draftSpout, draftAlarmStatus, draftAuditAction, draftAuditUserId, toastError])

  const resetFilters = useCallback(() => {
    const r = getDefaultExplorerDateRange()
    setDraftRange(r)
    setAppliedRange(r)
    setDraftSpout("all")
    setAppliedSpout("all")
    setDraftAlarmStatus("all")
    setAppliedAlarmStatus("all")
    setDraftAuditAction("")
    setAppliedAuditAction("")
    setDraftAuditUserId("")
    setAppliedAuditUserId("")
    setPage(1)
    setLimit(50)
  }, [])

  const load = useCallback(async () => {
    if (!dateParams.startDate || !dateParams.endDate) {
      setLoadError("Choose a date range and click Apply filters.")
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    setLoadError("")

    try {
      if (tab === "production") {
        const spoutId =
          appliedSpout && appliedSpout !== "all" ? Number.parseInt(appliedSpout, 10) : undefined
        const { items: nextItems, meta: nextMeta } = await listProductionHistory({
          page,
          limit,
          startDate: dateParams.startDate,
          endDate: dateParams.endDate,
          spout_id: Number.isFinite(spoutId) ? spoutId : undefined,
        })
        setItems(nextItems)
        setMeta(nextMeta)
      } else if (tab === "alarms") {
        const status =
          appliedAlarmStatus === "all"
            ? undefined
            : appliedAlarmStatus === "Active"
              ? "Active"
              : appliedAlarmStatus === "Cleared"
                ? "Cleared"
                : undefined
        const { items: nextItems, meta: nextMeta } = await listAlarmHistory({
          page,
          limit,
          startDate: dateParams.startDate,
          endDate: dateParams.endDate,
          status,
        })
        setItems(nextItems)
        setMeta(nextMeta)
      } else {
        const uid =
          appliedAuditUserId !== "" && Number.isFinite(Number(appliedAuditUserId))
            ? Number(appliedAuditUserId)
            : undefined
        const { items: nextItems, meta: nextMeta } = await listAuditLogs({
          page,
          limit,
          action: appliedAuditAction || undefined,
          userId: uid,
          startDate: dateParams.startDate,
          endDate: dateParams.endDate,
        })
        setItems(nextItems)
        setMeta(nextMeta)
      }
    } catch (err) {
      setLoadError(err?.message || "Request failed.")
      setItems([])
      setMeta(null)
    } finally {
      setIsLoading(false)
    }
  }, [
    tab,
    page,
    limit,
    dateParams.startDate,
    dateParams.endDate,
    appliedSpout,
    appliedAlarmStatus,
    appliedAuditAction,
    appliedAuditUserId,
  ])

  useEffect(() => {
    void load()
  }, [load])

  const handleTabChange = (value) => {
    setTab(value)
    setPage(1)
  }

  const handleExportPage = () => {
    try {
      if (tab === "production") {
        const headers = ["id", "spout_id", "weight_actual", "weight_target", "giveaway", "created_at"]
        const csv = buildCsv(headers, items, (row) => [
          row.id,
          row.spout_id,
          row.weight_actual,
          row.weight_target,
          row.giveaway,
          formatCsvDateTime(row.created_at),
        ])
        downloadCsv(`production-page-${page}.csv`, csv)
      } else if (tab === "alarms") {
        const headers = ["id", "alarm_code", "description", "start_time", "end_time", "duration_sec", "status"]
        const csv = buildCsv(headers, items, (row) => [
          row.id,
          row.alarm_code,
          row.description,
          formatCsvDateTime(row.start_time),
          formatCsvDateTime(row.end_time),
          row.duration_sec,
          row.status,
        ])
        downloadCsv(`alarms-page-${page}.csv`, csv)
      } else {
        const headers = ["id", "user_id", "username", "action", "ip_address", "timestamp"]
        const csv = buildCsv(headers, items, (row) => [
          row.id,
          row.user_id,
          row.username,
          row.action,
          row.ip_address,
          formatCsvDateTime(row.timestamp),
        ])
        downloadCsv(`audit-page-${page}.csv`, csv)
      }
      success("CSV downloaded.")
    } catch (err) {
      toastError(err)
    }
  }

  const handleExportAll = async () => {
    if (!dateParams.startDate || !dateParams.endDate) {
      toastError("Apply a valid date range before exporting.")
      return
    }
    setIsExporting(true)
    try {
      if (tab === "production") {
        const spoutId =
          appliedSpout && appliedSpout !== "all" ? Number.parseInt(appliedSpout, 10) : undefined
        const { rows, truncated } = await fetchAllRowsForExport(({ page: p, limit: lim }) =>
          listProductionHistory({
            page: p,
            limit: lim,
            startDate: dateParams.startDate,
            endDate: dateParams.endDate,
            spout_id: Number.isFinite(spoutId) ? spoutId : undefined,
          })
        )
        const headers = ["id", "spout_id", "weight_actual", "weight_target", "giveaway", "created_at"]
        const csv = buildCsv(headers, rows, (row) => [
          row.id,
          row.spout_id,
          row.weight_actual,
          row.weight_target,
          row.giveaway,
          formatCsvDateTime(row.created_at),
        ])
        downloadCsv("production-export.csv", csv)
        if (truncated) {
          toastError("Export capped at 2000 rows. Narrow the date range for a full dump.")
        } else {
          success(`Exported ${rows.length} rows.`)
        }
      } else if (tab === "alarms") {
        const status =
          appliedAlarmStatus === "all"
            ? undefined
            : appliedAlarmStatus === "Active"
              ? "Active"
              : "Cleared"
        const { rows, truncated } = await fetchAllRowsForExport(({ page: p, limit: lim }) =>
          listAlarmHistory({
            page: p,
            limit: lim,
            startDate: dateParams.startDate,
            endDate: dateParams.endDate,
            status,
          })
        )
        const headers = ["id", "alarm_code", "description", "start_time", "end_time", "duration_sec", "status"]
        const csv = buildCsv(headers, rows, (row) => [
          row.id,
          row.alarm_code,
          row.description,
          formatCsvDateTime(row.start_time),
          formatCsvDateTime(row.end_time),
          row.duration_sec,
          row.status,
        ])
        downloadCsv("alarms-export.csv", csv)
        if (truncated) {
          toastError("Export capped at 2000 rows. Narrow the date range for a full dump.")
        } else {
          success(`Exported ${rows.length} rows.`)
        }
      } else {
        const uid =
          appliedAuditUserId !== "" && Number.isFinite(Number(appliedAuditUserId))
            ? Number(appliedAuditUserId)
            : undefined
        const { rows, truncated } = await fetchAllRowsForExport(({ page: p, limit: lim }) =>
          listAuditLogs({
            page: p,
            limit: lim,
            action: appliedAuditAction || undefined,
            userId: uid,
            startDate: dateParams.startDate,
            endDate: dateParams.endDate,
          })
        )
        const headers = ["id", "user_id", "username", "action", "ip_address", "timestamp"]
        const csv = buildCsv(headers, rows, (row) => [
          row.id,
          row.user_id,
          row.username,
          row.action,
          row.ip_address,
          formatCsvDateTime(row.timestamp),
        ])
        downloadCsv("audit-export.csv", csv)
        if (truncated) {
          toastError("Export capped at 2000 rows. Narrow filters or date range.")
        } else {
          success(`Exported ${rows.length} rows.`)
        }
      }
    } catch (err) {
      toastError(err)
    } finally {
      setIsExporting(false)
    }
  }

  const tp = totalPages(meta)

  return (
    <div className="space-y-6">
      <section className="dashboard-enter" style={{ animationDelay: "40ms" }}>
        <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-50">Data Explorer</h2>
            <p className="max-w-xl text-sm text-slate-600 dark:text-slate-300">
              Production, alarms, and audit logs — filter by date, export CSV (bulk export caps at 2000 rows).
            </p>
          </div>
          <Badge variant="outline" className="shrink-0 border-cyan-500/40 text-cyan-700 dark:text-cyan-300">
            Admin only
          </Badge>
        </div>
      </section>

      <Card
        className="dashboard-enter border-slate-200/80 bg-white/80 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-900/70"
        style={{ animationDelay: "90ms" }}
      >
        <CardHeader className="border-b border-slate-200/70 pb-4 dark:border-slate-800/80">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200/90 bg-slate-50 dark:border-slate-700 dark:bg-slate-900/80">
              <Search className="h-5 w-5 text-primary" aria-hidden />
            </div>
            <div>
              <CardTitle className="text-lg">Explorer</CardTitle>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 pt-5">
          <Tabs value={tab} onValueChange={handleTabChange} className="w-full">
            <TabsList className="mb-4 grid h-auto w-full grid-cols-3 gap-1 p-1 sm:w-full sm:max-w-xl">
              <TabsTrigger value="production" className="gap-1.5">
                <Package className="h-3.5 w-3.5" />
                Production
              </TabsTrigger>
              <TabsTrigger value="alarms" className="gap-1.5">
                <TriangleAlert className="h-3.5 w-3.5" />
                Alarms
              </TabsTrigger>
              <TabsTrigger value="audit" className="gap-1.5">
                <Shield className="h-3.5 w-3.5" />
                Audit
              </TabsTrigger>
            </TabsList>

            <div className="flex flex-col gap-4 lg:flex-row lg:flex-wrap lg:items-end">
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-slate-600 dark:text-slate-400">Date range</p>
                <DateRangePicker value={draftRange} onChange={setDraftRange} />
              </div>

              {tab === "production" ? (
                <div className="space-y-1.5 lg:w-44">
                  <p className="text-xs font-medium text-slate-600 dark:text-slate-400">Spout</p>
                  <Select value={draftSpout} onValueChange={setDraftSpout}>
                    <SelectTrigger>
                      <SelectValue placeholder="Spout" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All spouts</SelectItem>
                      {Array.from({ length: 8 }, (_, i) => i + 1).map((n) => (
                        <SelectItem key={n} value={String(n)}>
                          Bec {n}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : null}

              {tab === "alarms" ? (
                <div className="space-y-1.5 lg:w-44">
                  <p className="text-xs font-medium text-slate-600 dark:text-slate-400">Status</p>
                  <Select value={draftAlarmStatus} onValueChange={setDraftAlarmStatus}>
                    <SelectTrigger>
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="Active">Active</SelectItem>
                      <SelectItem value="Cleared">Cleared</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              ) : null}

              {tab === "audit" ? (
                <>
                  <div className="min-w-0 flex-1 space-y-1.5 lg:max-w-xs">
                    <p className="text-xs font-medium text-slate-600 dark:text-slate-400">Action contains</p>
                    <div className="relative">
                      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <Input
                        value={draftAuditAction}
                        onChange={(e) => setDraftAuditAction(e.target.value)}
                        className="pl-9"
                        placeholder="e.g. ADMIN_"
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5 lg:w-36">
                    <p className="text-xs font-medium text-slate-600 dark:text-slate-400">User ID</p>
                    <div className="relative">
                      <Filter className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <Input
                        value={draftAuditUserId}
                        onChange={(e) => setDraftAuditUserId(e.target.value.replace(/[^0-9]/g, ""))}
                        className="pl-9"
                        placeholder="Optional"
                      />
                    </div>
                  </div>
                </>
              ) : null}

              <div className="space-y-1.5 lg:w-32">
                <p className="text-xs font-medium text-slate-600 dark:text-slate-400">Page size</p>
                <Select
                  value={String(limit)}
                  onValueChange={(v) => {
                    setLimit(Number(v))
                    setPage(1)
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="20">20</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                    <SelectItem value="100">100</SelectItem>
                    <SelectItem value="200">200</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-wrap gap-2 lg:ml-auto">
                <Button type="button" variant="default" className="gap-1.5" onClick={applyFilters}>
                  <Filter className="h-4 w-4" />
                  Apply filters
                </Button>
                <Button type="button" variant="outline" onClick={resetFilters}>
                  Reset
                </Button>
                <Button type="button" variant="outline" className="gap-1.5" onClick={() => void load()}>
                  <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
                  Refresh
                </Button>
              </div>
            </div>

          </Tabs>

          {loadError ? (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {loadError}
            </div>
          ) : null}

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200/80 pt-4 dark:border-slate-800/80">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {meta ? (
                <>
                  <span className="font-medium text-slate-700 dark:text-slate-200">
                    {Number(meta.totalItems || 0).toLocaleString()}
                  </span>{" "}
                  matching rows · Page {page} / {tp}
                </>
              ) : (
                "—"
              )}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={handleExportPage}>
                <Download className="h-3.5 w-3.5" />
                Export page CSV
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="gap-1.5"
                disabled={isExporting}
                onClick={() => void handleExportAll()}
              >
                <Download className="h-3.5 w-3.5" />
                {isExporting ? "Exporting…" : "Export all (cap 2000)"}
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={page <= 1 || isLoading}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Previous
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={page >= tp || isLoading}
                onClick={() => setPage((p) => Math.min(tp, p + 1))}
              >
                Next
              </Button>
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200/80 dark:border-slate-800/80">
            {isLoading ? (
              <div className="grid min-h-[32vh] place-items-center text-sm text-slate-500 dark:text-slate-400">
                Loading…
              </div>
            ) : items.length === 0 ? (
              <div className="grid min-h-[32vh] place-items-center px-4 text-center text-sm text-slate-500 dark:text-slate-400">
                No rows for this query. Widen the date range or adjust filters.
              </div>
            ) : tab === "production" ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Spout</TableHead>
                    <TableHead>Actual kg</TableHead>
                    <TableHead>Target kg</TableHead>
                    <TableHead>Giveaway</TableHead>
                    <TableHead className="text-right">Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="font-mono text-xs">#{row.id}</TableCell>
                      <TableCell>{row.spout_id}</TableCell>
                      <TableCell>{row.weight_actual}</TableCell>
                      <TableCell>{row.weight_target}</TableCell>
                      <TableCell>{row.giveaway}</TableCell>
                      <TableCell className="text-right text-xs text-slate-500 dark:text-slate-400">
                        {formatDateTime(row.created_at)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : tab === "alarms" ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Code</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Start</TableHead>
                    <TableHead>End</TableHead>
                    <TableHead className="text-right">Duration s</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="font-mono text-xs">{row.alarm_code}</TableCell>
                      <TableCell className="max-w-[14rem] truncate" title={row.description}>
                        {row.description}
                      </TableCell>
                      <TableCell>
                        <Badge variant={row.status === "Active" ? "destructive" : "outline"}>{row.status}</Badge>
                      </TableCell>
                      <TableCell className="text-xs text-slate-500 dark:text-slate-400">
                        {formatDateTime(row.start_time)}
                      </TableCell>
                      <TableCell className="text-xs text-slate-500 dark:text-slate-400">
                        {formatDateTime(row.end_time)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{row.duration_sec}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Time</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>IP</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="whitespace-nowrap text-xs text-slate-500 dark:text-slate-400">
                        {formatDateTime(row.timestamp)}
                      </TableCell>
                      <TableCell>
                        <div className="text-sm font-medium text-slate-800 dark:text-slate-100">
                          {row.username || "—"}
                        </div>
                        <div className="text-xs text-slate-500">#{row.user_id ?? "—"}</div>
                      </TableCell>
                      <TableCell className="max-w-[20rem] truncate text-sm" title={row.action}>
                        {row.action}
                      </TableCell>
                      <TableCell className="font-mono text-xs">{row.ip_address || "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
