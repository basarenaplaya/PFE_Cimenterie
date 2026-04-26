import { useCallback, useEffect, useMemo, useState } from "react"
import { ClipboardList, Filter, RefreshCw, Search } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useToast } from "@/hooks/useToast"
import { listAuditLogs } from "@/services/adminApi"

function formatDateTime(value) {
  if (!value) return "--"
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return "--"
  return parsed.toLocaleString()
}

function shortAction(action) {
  if (!action) return "UNKNOWN"
  return action.length > 56 ? `${action.slice(0, 56)}...` : action
}

export default function AuditLogsPage() {
  const { error } = useToast()

  const [logs, setLogs] = useState([])
  const [meta, setMeta] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [loadError, setLoadError] = useState("")

  const [page, setPage] = useState(1)
  const [searchInput, setSearchInput] = useState("")
  const [search, setSearch] = useState("")
  const [userIdInput, setUserIdInput] = useState("")
  const [userIdFilter, setUserIdFilter] = useState("")

  const limit = 20
  const totalItems = Number(meta?.totalItems || 0)

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setPage(1)
      setSearch(searchInput.trim())
    }, 260)

    return () => window.clearTimeout(timer)
  }, [searchInput])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setPage(1)
      setUserIdFilter(userIdInput.trim())
    }, 260)

    return () => window.clearTimeout(timer)
  }, [userIdInput])

  const fetchLogs = useCallback(
    async ({ pageOverride, loadingMode = "full" } = {}) => {
      const targetPage = pageOverride || page

      if (loadingMode === "full") {
        setIsLoading(true)
      } else {
        setIsRefreshing(true)
      }

      try {
        const normalizedUserId = userIdFilter !== "" ? Number(userIdFilter) : undefined
        const payload = await listAuditLogs({
          page: targetPage,
          limit,
          action: search,
          userId:
            Number.isFinite(normalizedUserId) && normalizedUserId > 0
              ? normalizedUserId
              : undefined,
        })

        const nextItems = Array.isArray(payload.items) ? payload.items : []
        const nextMeta = payload.meta || null

        if (nextMeta && nextMeta.totalPages > 0 && targetPage > nextMeta.totalPages) {
          setPage(nextMeta.totalPages)
          return
        }

        setLogs(nextItems)
        setMeta(nextMeta)
        setLoadError("")
      } catch (requestError) {
        const message = requestError?.message || "Failed to load audit logs."
        setLoadError(message)
        error(message)
      } finally {
        setIsLoading(false)
        setIsRefreshing(false)
      }
    },
    [error, limit, page, search, userIdFilter]
  )

  useEffect(() => {
    fetchLogs({ loadingMode: "full" })
  }, [fetchLogs])

  const activeFilters = useMemo(() => {
    const values = []
    if (search) values.push(`action:${search}`)
    if (userIdFilter) values.push(`user:${userIdFilter}`)
    return values
  }, [search, userIdFilter])

  return (
    <div className="space-y-6">
      <section className="dashboard-enter" style={{ animationDelay: "40ms" }}>
        <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-50">Audit Logs</h2>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Inspect administrative actions and security-sensitive events across the platform.
        </p>
      </section>

      <Card
        className="dashboard-enter border-slate-200/80 bg-white/80 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-900/70"
        style={{ animationDelay: "120ms" }}
      >
        <CardHeader className="gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <CardTitle className="text-base">Security Timeline</CardTitle>
            <CardDescription>
              {totalItems} events {activeFilters.length > 0 ? "for active filters" : "captured"}.
            </CardDescription>
          </div>

          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
            <div className="relative w-full sm:w-72">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                className="pl-10"
                placeholder="Filter by action"
              />
            </div>

            <div className="relative w-full sm:w-36">
              <Filter className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={userIdInput}
                onChange={(event) => setUserIdInput(event.target.value.replace(/[^0-9]/g, ""))}
                className="pl-10"
                placeholder="User ID"
              />
            </div>

            <Button variant="outline" onClick={() => fetchLogs({ loadingMode: "soft" })}>
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {activeFilters.length > 0 ? (
            <div className="flex flex-wrap items-center gap-1.5">
              {activeFilters.map((filter) => (
                <Badge key={filter} variant="outline" className="font-normal">
                  {filter}
                </Badge>
              ))}
            </div>
          ) : null}

          {isLoading ? (
            <div className="grid min-h-[20vh] place-items-center text-sm text-slate-600 dark:text-slate-300">
              Loading audit logs...
            </div>
          ) : logs.length === 0 ? (
            <div className="grid min-h-[20vh] place-items-center text-center">
              <div>
                <p className="text-sm font-medium text-slate-700 dark:text-slate-200">No audit events found.</p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Try adjusting filters or perform an admin action to populate logs.
                </p>
              </div>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Timestamp</TableHead>
                  <TableHead>Actor</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>IP Address</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="text-xs text-slate-500 dark:text-slate-400">
                      {formatDateTime(row.timestamp)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-cyan-500/12 text-cyan-600 dark:text-cyan-300">
                          <ClipboardList className="h-4 w-4" />
                        </span>
                        <div className="min-w-0">
                          <p className="truncate font-medium text-slate-800 dark:text-slate-100">
                            {row.username || "System"}
                          </p>
                          <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                            User ID: {row.user_id || "n/a"}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <p className="max-w-[24rem] truncate text-sm text-slate-700 dark:text-slate-200" title={row.action}>
                        {shortAction(row.action)}
                      </p>
                    </TableCell>
                    <TableCell className="text-xs text-slate-500 dark:text-slate-400">
                      {row.ip_address || "--"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>

        {loadError ? (
          <div className="border-t border-amber-200/80 bg-amber-50/80 px-6 py-3 text-xs font-medium text-amber-700 dark:border-amber-800/70 dark:bg-amber-900/20 dark:text-amber-300">
            Data load warning: {loadError}
          </div>
        ) : null}

        <div className="flex items-center justify-between border-t border-slate-200/80 px-6 py-4 text-sm dark:border-slate-800">
          <p className="text-slate-500 dark:text-slate-400">
            Page {meta?.page || 1} of {Math.max(meta?.totalPages || 0, 1)}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              disabled={!meta?.hasPrevPage || isLoading}
              onClick={() => setPage((prev) => Math.max(prev - 1, 1))}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              disabled={!meta?.hasNextPage || isLoading}
              onClick={() => setPage((prev) => prev + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      </Card>
    </div>
  )
}
