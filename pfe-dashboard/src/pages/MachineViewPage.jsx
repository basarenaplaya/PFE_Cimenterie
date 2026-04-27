import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { ExternalLink, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/hooks/useAuth"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { getResolvedApiBaseUrl } from "@/lib/api"

const MACHINE_NATIVE_PATH = "/machine/native"
const NATIVE_AUTH_MESSAGE = "pfe-native-auth"

/** Clean URL for iframe (auth via postMessage). */
function buildNativeIframeSrc() {
  const base = getResolvedApiBaseUrl()
  if (base === "") {
    return MACHINE_NATIVE_PATH
  }
  return `${base}${MACHINE_NATIVE_PATH}`
}

/** External tab: legacy hash so Socket/API work without an opener postMessage. */
function buildNativeExternalHref(token) {
  const path = buildNativeIframeSrc()
  if (typeof token !== "string" || !token.trim()) {
    return path
  }
  return `${path}#token=${encodeURIComponent(token.trim())}`
}

function resolvePostMessageTargetOrigin() {
  const base = getResolvedApiBaseUrl()
  if (base === "") {
    return window.location.origin
  }
  try {
    return new URL(base).origin
  } catch {
    return window.location.origin
  }
}

export default function MachineViewPage() {
  const { token } = useAuth()
  const iframeRef = useRef(null)
  const [refreshKey, setRefreshKey] = useState(0)

  const iframeSrc = useMemo(() => buildNativeIframeSrc(), [])
  const externalHref = useMemo(() => buildNativeExternalHref(token ?? ""), [token])

  const sendAuthToIframe = useCallback(() => {
    const el = iframeRef.current
    if (!el?.contentWindow || typeof token !== "string" || !token.trim()) {
      return
    }
    el.contentWindow.postMessage(
      { type: NATIVE_AUTH_MESSAGE, token: token.trim() },
      resolvePostMessageTargetOrigin()
    )
  }, [token])

  const handleIframeLoad = useCallback(() => {
    sendAuthToIframe()
  }, [sendAuthToIframe])

  useEffect(() => {
    sendAuthToIframe()
  }, [sendAuthToIframe, refreshKey])

  return (
    <div className="w-full space-y-6">
      <section className="dashboard-enter" style={{ animationDelay: "40ms" }}>
        <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-50">Machine View</h2>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Edge-to-edge native SCADA surface hosted by the secured backend.
        </p>
      </section>

      <section className="dashboard-enter" style={{ animationDelay: "120ms" }}>
        <Card className="w-full border-slate-200/80 bg-white/80 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-900/70">
          <CardHeader className="gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-base">Live PLC Surface</CardTitle>
              <CardDescription>
                Embedded panel uses a secure handshake (no token in the URL). External opens a
                legacy bookmark link with token for a standalone tab.
              </CardDescription>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                onClick={() => setRefreshKey((value) => value + 1)}
              >
                <RefreshCw className="h-4 w-4" />
                Reload Frame
              </Button>

              <Button
                variant="outline"
                asChild
              >
                <a href={externalHref} target="_blank" rel="noreferrer">
                  <ExternalLink className="h-4 w-4" />
                  Open External
                </a>
              </Button>
            </div>
          </CardHeader>

          <CardContent className="px-4 pb-4 pt-0 sm:px-5 sm:pb-5">
            <div className="relative min-h-[86vh] h-[calc(100vh-6.5rem)] overflow-hidden rounded-2xl border border-slate-200 bg-white/90 dark:border-slate-700 dark:bg-slate-950/60">
              <iframe
                ref={iframeRef}
                key={refreshKey}
                src={iframeSrc}
                title="Machine Native Interface"
                className="block h-full w-full border-0 bg-white"
                loading="lazy"
                onLoad={handleIframeLoad}
              />
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  )
}
