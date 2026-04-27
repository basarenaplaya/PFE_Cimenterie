import { useCallback, useEffect, useMemo, useState } from "react"
import {
  Camera,
  ExternalLink,
  MoreHorizontal,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
} from "lucide-react"
import { CameraWatchGrid } from "@/components/cameras/CameraWatchGrid"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useToast } from "@/hooks/useToast"
import {
  createCamera,
  deleteCamera,
  listCameras,
  updateCamera,
} from "@/services/adminApi"

const initialForm = {
  cam_name: "",
  ip_url: "",
}

function sanitizeUrl(input) {
  return input.trim()
}

export default function CameraConfigPage() {
  const { success, error } = useToast()

  const [cameras, setCameras] = useState([])
  const [meta, setMeta] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isMutating, setIsMutating] = useState(false)
  const [loadError, setLoadError] = useState("")

  const [page, setPage] = useState(1)
  const [searchInput, setSearchInput] = useState("")
  const [search, setSearch] = useState("")

  const [createOpen, setCreateOpen] = useState(false)
  const [createForm, setCreateForm] = useState(initialForm)

  const [editTarget, setEditTarget] = useState(null)
  const [editForm, setEditForm] = useState(initialForm)

  const [deleteTarget, setDeleteTarget] = useState(null)

  const limit = 10
  const totalItems = Number(meta?.totalItems || 0)
  const totalPages = Number(meta?.totalPages || 0)

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setPage(1)
      setSearch(searchInput.trim())
    }, 260)

    return () => window.clearTimeout(timer)
  }, [searchInput])

  const fetchCameraRows = useCallback(
    async ({ pageOverride, loadingMode = "full" } = {}) => {
      const targetPage = pageOverride || page

      if (loadingMode === "full") {
        setIsLoading(true)
      } else {
        setIsRefreshing(true)
      }

      try {
        const payload = await listCameras({
          page: targetPage,
          limit,
          search,
        })

        const nextItems = Array.isArray(payload.items) ? payload.items : []
        const nextMeta = payload.meta || null

        if (nextMeta && nextMeta.totalPages > 0 && targetPage > nextMeta.totalPages) {
          setPage(nextMeta.totalPages)
          return
        }

        setCameras(nextItems)
        setMeta(nextMeta)
        setLoadError("")
      } catch (requestError) {
        const message = requestError?.message || "Failed to load cameras."
        setLoadError(message)
        error(message)
      } finally {
        setIsLoading(false)
        setIsRefreshing(false)
      }
    },
    [error, limit, page, search]
  )

  useEffect(() => {
    fetchCameraRows({ loadingMode: "full" })
  }, [fetchCameraRows])

  const deleteTargetLabel = useMemo(() => {
    if (!deleteTarget) return ""
    return deleteTarget.cam_name || `Camera #${deleteTarget.id}`
  }, [deleteTarget])

  function openCreateDialog() {
    setCreateForm(initialForm)
    setCreateOpen(true)
  }

  function openEditDialog(target) {
    setEditTarget(target)
    setEditForm({
      cam_name: target.cam_name || "",
      ip_url: target.ip_url || "",
    })
  }

  function validateCameraForm(form) {
    const camName = form.cam_name.trim()
    const cameraUrl = sanitizeUrl(form.ip_url)

    if (camName.length < 2) {
      error("Camera name must be at least 2 characters.")
      return null
    }

    try {
      const parsed = new URL(cameraUrl)
      if (!["rtsp:", "http:", "https:"].includes(parsed.protocol)) {
        throw new Error("Invalid protocol")
      }
      if (!parsed.hostname) {
        throw new Error("Missing hostname")
      }
      if (parsed.username || parsed.password) {
        throw new Error("Embedded credentials are not allowed")
      }
    } catch {
      error("Camera URL must be a valid rtsp://, http://, or https:// address.")
      return null
    }

    return {
      cam_name: camName,
      ip_url: cameraUrl,
    }
  }

  async function handleCreate(event) {
    event.preventDefault()
    const payload = validateCameraForm(createForm)
    if (!payload) return

    setIsMutating(true)

    try {
      await createCamera(payload)
      success("Camera created successfully.")
      setCreateOpen(false)
      setPage(1)
      await fetchCameraRows({ pageOverride: 1, loadingMode: "soft" })
    } catch (requestError) {
      error(requestError?.message || "Failed to create camera.")
    } finally {
      setIsMutating(false)
    }
  }

  async function handleUpdate(event) {
    event.preventDefault()
    if (!editTarget) return

    const payload = validateCameraForm(editForm)
    if (!payload) return

    setIsMutating(true)

    try {
      await updateCamera(editTarget.id, payload)
      success("Camera updated successfully.")
      setEditTarget(null)
      await fetchCameraRows({ loadingMode: "soft" })
    } catch (requestError) {
      error(requestError?.message || "Failed to update camera.")
    } finally {
      setIsMutating(false)
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setIsMutating(true)

    try {
      await deleteCamera(deleteTarget.id)
      success("Camera deleted successfully.")
      setDeleteTarget(null)

      const nextPage = cameras.length <= 1 && page > 1 ? page - 1 : page
      setPage(nextPage)
      await fetchCameraRows({ pageOverride: nextPage, loadingMode: "soft" })
    } catch (requestError) {
      error(requestError?.message || "Failed to delete camera.")
    } finally {
      setIsMutating(false)
    }
  }

  return (
    <div className="space-y-6">
      <section className="dashboard-enter" style={{ animationDelay: "40ms" }}>
        <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-50">Camera Configuration</h2>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Manage RTSP and HTTP streams for plant visibility and operator confidence.
        </p>
      </section>

      <Tabs defaultValue="watch" className="dashboard-enter space-y-4" style={{ animationDelay: "120ms" }}>
        <TabsList className="w-full justify-start sm:w-auto">
          <TabsTrigger value="watch">Watch</TabsTrigger>
          <TabsTrigger value="configure">Configure</TabsTrigger>
        </TabsList>

        <TabsContent value="watch" className="mt-0 outline-none">
          <CameraWatchGrid />
        </TabsContent>

        <TabsContent value="configure" className="mt-0 outline-none">
          <Card className="border-slate-200/80 bg-white/80 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-900/70">
            <CardHeader className="gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <CardTitle className="text-base">Feeds</CardTitle>
                <CardDescription>
                  {totalItems} configured cameras {search ? `matching "${search}"` : "available"}.
                </CardDescription>
              </div>

              <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
                <div className="relative w-full sm:w-72">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    value={searchInput}
                    onChange={(event) => setSearchInput(event.target.value)}
                    placeholder="Search by camera name or URL"
                    className="pl-10"
                  />
                </div>

                <Button
                  variant="outline"
                  onClick={() => fetchCameraRows({ loadingMode: "soft" })}
                  disabled={isRefreshing || isMutating}
                >
                  <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
                  Refresh
                </Button>

                <Button onClick={openCreateDialog} disabled={isMutating}>
                  <Plus className="h-4 w-4" />
                  Add Camera
                </Button>
              </div>
            </CardHeader>

            <CardContent className="space-y-4">
              {isLoading ? (
                <div className="grid min-h-[20vh] place-items-center text-sm text-slate-600 dark:text-slate-300">
                  Loading cameras...
                </div>
              ) : cameras.length === 0 ? (
                <div className="grid min-h-[20vh] place-items-center text-center">
                  <div>
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-200">No camera feeds found.</p>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      Add your first stream endpoint to begin monitoring.
                    </p>
                  </div>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Camera</TableHead>
                      <TableHead>Stream URL</TableHead>
                      <TableHead>Added By</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {cameras.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-cyan-500/12 text-cyan-600 dark:text-cyan-300">
                              <Camera className="h-4 w-4" />
                            </span>
                            <span className="font-medium text-slate-800 dark:text-slate-100">{row.cam_name}</span>
                          </div>
                        </TableCell>
                        <TableCell className="max-w-88">
                          <div className="flex items-center gap-2">
                            <a
                              href={row.ip_url}
                              target="_blank"
                              rel="noreferrer"
                              className="truncate text-xs text-cyan-700 underline-offset-2 hover:underline dark:text-cyan-300"
                            >
                              {row.ip_url}
                            </a>
                            <ExternalLink className="h-3.5 w-3.5 text-slate-400" />
                          </div>
                        </TableCell>
                        <TableCell className="text-xs text-slate-500 dark:text-slate-400">
                          {row.added_by_username || "System"}
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button size="icon-sm" variant="outline" disabled={isMutating}>
                                <MoreHorizontal className="h-4 w-4" />
                                <span className="sr-only">Open camera actions</span>
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-44">
                              <DropdownMenuItem onClick={() => openEditDialog(row)}>
                                <Pencil className="h-4 w-4" />
                                Edit camera
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                variant="destructive"
                                onClick={() => setDeleteTarget(row)}
                              >
                                <Trash2 className="h-4 w-4" />
                                Delete camera
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
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
                Page {meta?.page || 1} of {Math.max(totalPages, 1)}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  disabled={!meta?.hasPrevPage || isLoading || isMutating}
                  onClick={() => setPage((prev) => Math.max(prev - 1, 1))}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  disabled={!meta?.hasNextPage || isLoading || isMutating}
                  onClick={() => setPage((prev) => prev + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Camera</DialogTitle>
            <DialogDescription>
              Register a new stream source for industrial monitoring.
            </DialogDescription>
          </DialogHeader>

          <form className="space-y-3" onSubmit={handleCreate}>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-200">Camera Name</label>
              <Input
                value={createForm.cam_name}
                onChange={(event) =>
                  setCreateForm((prev) => ({ ...prev, cam_name: event.target.value }))
                }
                placeholder="Packing Lane Camera"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-200">Stream URL</label>
              <Input
                value={createForm.ip_url}
                onChange={(event) =>
                  setCreateForm((prev) => ({ ...prev, ip_url: event.target.value }))
                }
                placeholder="rtsp://10.0.0.60/stream"
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setCreateOpen(false)}
                disabled={isMutating}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isMutating}>
                {isMutating ? "Saving..." : "Create Camera"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(editTarget)} onOpenChange={(open) => !open && setEditTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Camera</DialogTitle>
            <DialogDescription>
              Update camera display name or stream URL.
            </DialogDescription>
          </DialogHeader>

          <form className="space-y-3" onSubmit={handleUpdate}>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-200">Camera Name</label>
              <Input
                value={editForm.cam_name}
                onChange={(event) =>
                  setEditForm((prev) => ({ ...prev, cam_name: event.target.value }))
                }
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-200">Stream URL</label>
              <Input
                value={editForm.ip_url}
                onChange={(event) =>
                  setEditForm((prev) => ({ ...prev, ip_url: event.target.value }))
                }
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditTarget(null)}
                disabled={isMutating}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isMutating}>
                {isMutating ? "Saving..." : "Save Changes"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Camera</DialogTitle>
            <DialogDescription>
              This removes the stream entry from the configuration table.
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-900/40 dark:bg-rose-900/20 dark:text-rose-300">
            You are deleting {deleteTargetLabel}.
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeleteTarget(null)}
              disabled={isMutating}
            >
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={isMutating}>
              {isMutating ? "Deleting..." : "Delete Camera"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
