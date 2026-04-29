import { useCallback, useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { AnimatePresence, motion } from "framer-motion"
import { Loader2, StopCircle, Volume2, VolumeX } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  isBrowserStreamableUrl,
  shouldUseVideoElement,
} from "@/lib/cameraStreamGuards"
import { patchCameraSnapshot } from "@/services/adminApi"
import { cn } from "@/lib/utils"

const SNAPSHOT_MAX_EDGE = 1280

/**
 * @param {HTMLImageElement | HTMLVideoElement} el
 * @returns {string | null}
 */
function captureFrameToJpegDataUrl(el) {
  const w = el instanceof HTMLVideoElement ? el.videoWidth : el.naturalWidth
  const h = el instanceof HTMLVideoElement ? el.videoHeight : el.naturalHeight
  if (!w || !h) {
    return null
  }

  let tw = w
  let th = h
  const longEdge = Math.max(w, h)
  if (longEdge > SNAPSHOT_MAX_EDGE) {
    const scale = SNAPSHOT_MAX_EDGE / longEdge
    tw = Math.max(1, Math.round(w * scale))
    th = Math.max(1, Math.round(h * scale))
  }

  const canvas = document.createElement("canvas")
  canvas.width = tw
  canvas.height = th
  const ctx = canvas.getContext("2d")
  if (!ctx) {
    return null
  }

  ctx.drawImage(el, 0, 0, tw, th)
  return canvas.toDataURL("image/jpeg", 0.82)
}

export function CameraFocusOverlay({
  camera,
  open,
  onClose,
  onSnapshotSaved,
  onError,
}) {
  const mediaRef = useRef(null)
  const [streamReady, setStreamReady] = useState(false)
  const [saving, setSaving] = useState(false)
  const [videoMuted, setVideoMuted] = useState(true)

  const useVideo = camera?.ip_url && shouldUseVideoElement(camera.ip_url)
  const streamable = camera?.ip_url && isBrowserStreamableUrl(camera.ip_url)

  useEffect(() => {
    if (!open) {
      setStreamReady(false)
      setVideoMuted(true)
    }
  }, [open])

  useEffect(() => {
    setVideoMuted(true)
  }, [camera?.id])

  const handleStop = useCallback(async () => {
    const el = mediaRef.current
    let dataUrl = null

    if (el && streamReady) {
      try {
        dataUrl = captureFrameToJpegDataUrl(el)
      } catch {
        dataUrl = null
      }
    }

    if (dataUrl && camera?.id) {
      setSaving(true)
      try {
        const updated = await patchCameraSnapshot(camera.id, { last_snapshot: dataUrl })
        onSnapshotSaved?.(updated)
      } catch (err) {
        onError?.(err?.message || "Failed to save snapshot.")
      } finally {
        setSaving(false)
      }
    }

    onClose()
  }, [camera?.id, onClose, onError, onSnapshotSaved, streamReady])

  useEffect(() => {
    if (!open) {
      return undefined
    }

    function onKeyDown(e) {
      if (e.key === "Escape") {
        e.preventDefault()
        handleStop()
      }
    }

    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [open, handleStop])

  if (typeof document === "undefined") {
    return null
  }

  const layoutId = camera ? `cam-shell-${camera.id}` : "cam-shell-none"

  return createPortal(
    <AnimatePresence>
      {open && camera ? (
        <motion.div
          key="camera-focus-root"
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-8"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.button
            type="button"
            aria-label="Close overlay"
            className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => handleStop()}
          />

          <motion.div
            layoutId={layoutId}
            className={cn(
              "relative z-[101] flex w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-950"
            )}
            transition={{ type: "spring", stiffness: 320, damping: 34 }}
          >
            <div className="flex items-center justify-between gap-3 border-b border-slate-200/80 px-4 py-3 dark:border-slate-800">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-50">
                  {camera.cam_name}
                </p>
                <p className="truncate text-xs text-slate-500 dark:text-slate-400">{camera.ip_url}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {streamable && useVideo ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="size-9 shrink-0 p-0"
                    aria-pressed={!videoMuted}
                    aria-label={
                      videoMuted ? "Son coupé — activer le son" : "Son activé — couper le son"
                    }
                    title={
                      videoMuted
                        ? "Activer le son (flux vidéo uniquement, ex. MP4/WebM)"
                        : "Couper le son"
                    }
                    onClick={() => setVideoMuted((m) => !m)}
                  >
                    {videoMuted ? (
                      <VolumeX className="size-4" />
                    ) : (
                      <Volume2 className="size-4" />
                    )}
                  </Button>
                ) : null}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="shrink-0 gap-1.5"
                  disabled={saving}
                  onClick={() => handleStop()}
                >
                  {saving ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <StopCircle className="size-4 text-rose-600" />
                  )}
                  Stop
                </Button>
              </div>
            </div>

            <div className="relative aspect-video w-full bg-black">
              {!streamable ? (
                <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center text-sm text-slate-300">
                  <p>RTSP and non-HTTP(S) streams cannot play inside the dashboard.</p>
                  <p className="text-xs text-slate-500">Use an MJPEG or HTTPS URL for in-app viewing.</p>
                </div>
              ) : useVideo ? (
                <video
                  ref={mediaRef}
                  className="h-full w-full object-contain"
                  playsInline
                  muted={videoMuted}
                  controls
                  crossOrigin="anonymous"
                  src={open ? camera.ip_url : undefined}
                  onLoadedData={() => setStreamReady(true)}
                  onError={() => {
                    setStreamReady(false)
                    onError?.("Video stream failed to load.")
                  }}
                />
              ) : (
                <img
                  ref={mediaRef}
                  alt=""
                  className="h-full w-full object-contain"
                  crossOrigin="anonymous"
                  src={open ? camera.ip_url : undefined}
                  onLoad={() => setStreamReady(true)}
                  onError={() => {
                    setStreamReady(false)
                    onError?.("Image stream failed to load.")
                  }}
                />
              )}

              {streamable && !streamReady && (
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/50">
                  <Loader2 className="size-10 animate-spin text-white" />
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body
  )
}
