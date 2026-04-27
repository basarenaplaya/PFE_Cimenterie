import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { ExternalLink, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/hooks/useAuth"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

/** Legacy SCADA is static under `public/machine-scada/` (same origin as the dashboard, port 5173). */
const MACHINE_SCADA_PATH = "/machine-scada/"
const NATIVE_AUTH_MESSAGE = "pfe-native-auth"

function buildScadaExternalHref(token) {
  const base = `${typeof window !== "undefined" ? window.location.origin : ""}${MACHINE_SCADA_PATH}`
  if (typeof token !== "string" || !token.trim()) {
    return base
  }
  return `${base}#token=${encodeURIComponent(token.trim())}`
}

function postMessageTargetOrigin() {
  return typeof window !== "undefined" ? window.location.origin : "*"
}

export default function MachineViewPage() {
  const { token } = useAuth()
  const iframeRef = useRef(null)
  const [refreshKey, setRefreshKey] = useState(0)

  const iframeSrc = useMemo(() => MACHINE_SCADA_PATH, [])
  const externalHref = useMemo(() => buildScadaExternalHref(token ?? ""), [token])

  const sendAuthToIframe = useCallback(() => {
    const el = iframeRef.current
    if (!el?.contentWindow || typeof token !== "string" || !token.trim()) {
      return
    }
    const parentOrigins =
      typeof window !== "undefined" && window.location?.origin ? [window.location.origin] : []
    el.contentWindow.postMessage(
      {
        type: NATIVE_AUTH_MESSAGE,
        token: token.trim(),
        parentOrigins,
      },
      postMessageTargetOrigin()
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
          Live PLC surface is served with the dashboard (same host/port); the API and PLC logic stay
          on the backend.
        </p>
      </section>

      <section className="dashboard-enter" style={{ animationDelay: "120ms" }}>
        <Card className="w-full border-slate-200/80 bg-white/80 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-900/70">
          <CardHeader className="gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-base">Live PLC Surface</CardTitle>
              <CardDescription>
                Embedded SCADA uses a postMessage handshake (no token in the iframe URL). External
                tab keeps an optional legacy hash for standalone access.
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
