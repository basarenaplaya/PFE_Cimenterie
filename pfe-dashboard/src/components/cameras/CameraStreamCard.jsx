import { CameraOff, Play } from "lucide-react"
import { motion } from "framer-motion"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { getSafeThumbnailDataUrl, isBrowserStreamableUrl } from "@/lib/cameraStreamGuards"
import { cn } from "@/lib/utils"

export function CameraStreamCard({ camera, isFocusOpen, onPlay }) {
  const thumb = getSafeThumbnailDataUrl(camera?.last_snapshot)
  const canPlayInBrowser = isBrowserStreamableUrl(camera?.ip_url)

  const layoutId = `cam-shell-${camera.id}`

  return (
    <Card
      className={cn(
        "overflow-hidden border-slate-200/80 bg-white/80 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-900/70",
        isFocusOpen && "ring-2 ring-cyan-500/40"
      )}
    >
      <CardContent className="p-0">
        <div className="relative aspect-video w-full bg-slate-950/90">
          {isFocusOpen ? (
            <div className="flex h-full w-full items-center justify-center bg-slate-900 text-xs text-slate-400">
              Live in focus view…
            </div>
          ) : (
            <motion.div
              layoutId={layoutId}
              className="relative h-full w-full overflow-hidden rounded-t-xl"
              transition={{ type: "spring", stiffness: 320, damping: 34 }}
            >
              {thumb ? (
                <img src={thumb} alt="" className="h-full w-full object-cover opacity-90" />
              ) : (
                <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-gradient-to-b from-slate-900 to-slate-950 text-slate-500">
                  <CameraOff className="size-10 opacity-70" />
                  <span className="text-xs font-medium tracking-wide text-slate-400">
                    No recent snapshot
                  </span>
                </div>
              )}

              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent" />

              <div className="absolute inset-0 flex items-center justify-center">
                <Button
                  type="button"
                  size="lg"
                  className="h-14 gap-2 rounded-full px-8 shadow-lg"
                  disabled={!canPlayInBrowser}
                  onClick={() => onPlay(camera)}
                  title={
                    canPlayInBrowser
                      ? "Play live stream"
                      : "Only http(s) streams can play here (not RTSP)."
                  }
                >
                  <Play className="size-5 fill-current" />
                  Play
                </Button>
              </div>
            </motion.div>
          )}
        </div>

        <div className="space-y-1 border-t border-slate-200/70 px-3 py-2.5 dark:border-slate-800">
          <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-50">{camera.cam_name}</p>
          <p className="truncate text-[11px] text-slate-500 dark:text-slate-400">{camera.ip_url}</p>
        </div>
      </CardContent>
    </Card>
  )
}
