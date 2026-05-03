import { useCallback, useEffect, useState } from "react"
import { LayoutGroup } from "framer-motion"
import { RefreshCw } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useToast } from "@/hooks/useToast"
import { listCameras } from "@/services/adminApi"

import { CameraFocusOverlay } from "./CameraFocusOverlay"
import { CameraStreamCard } from "./CameraStreamCard"

const WATCH_LIMIT = 100

export function CameraWatchGrid() {
  const { error } = useToast()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [openCamera, setOpenCamera] = useState(null)

  const load = useCallback(async (mode = "full") => {
    if (mode === "full") {
      setLoading(true)
    } else {
      setRefreshing(true)
    }

    try {
      const { items: next } = await listCameras({
        page: 1,
        limit: WATCH_LIMIT,
        search: "",
        include_snapshots: true,
      })
      setItems(Array.isArray(next) ? next : [])
    } catch (e) {
      error(e?.message || "Failed to load cameras for watch view.")
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [error])

  useEffect(() => {
    load("full")
  }, [load])

  const handleSnapshotSaved = useCallback((updated) => {
    if (!updated?.id) {
      return
    }
    setItems((prev) =>
      prev.map((row) => (row.id === updated.id ? { ...row, last_snapshot: updated.last_snapshot } : row))
    )
  }, [])

  return (
    <LayoutGroup id="camera-watch-layout-group">
      <Card className="border-slate-200/80 bg-white/80 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-900/70">
        <CardHeader className="flex flex-row flex-wrap items-end justify-between gap-3 space-y-0">
          <div>
            <CardTitle className="text-base">Live watch</CardTitle>
            <CardDescription>Play loads the stream. Stop can save a snapshot if the camera allows it (CORS).</CardDescription>
          </div>
          <Button type="button" variant="outline" size="sm" disabled={loading || refreshing} onClick={() => load("soft")}>
            <RefreshCw className={`size-4 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="grid min-h-[24vh] place-items-center text-sm text-slate-600 dark:text-slate-300">
              Loading cameras…
            </div>
          ) : items.length === 0 ? (
            <div className="grid min-h-[24vh] place-items-center text-center text-sm text-slate-600 dark:text-slate-300">
              No cameras configured. Add feeds in the Configure tab.
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {items.map((camera) => (
                <CameraStreamCard
                  key={camera.id}
                  camera={camera}
                  isFocusOpen={openCamera?.id === camera.id}
                  onPlay={(c) => setOpenCamera(c)}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <CameraFocusOverlay
        camera={openCamera}
        open={Boolean(openCamera)}
        onClose={() => setOpenCamera(null)}
        onSnapshotSaved={handleSnapshotSaved}
        onError={(msg) => error(msg)}
      />
    </LayoutGroup>
  )
}
