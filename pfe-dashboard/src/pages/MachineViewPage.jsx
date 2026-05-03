import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { ExternalLink, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/hooks/useAuth"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

/**
 * Legacy SCADA lives in `public/machine-scada/index.html`.
 * Use the explicit `index.html` path: `/machine-scada/` is caught by Vite’s SPA fallback and
 * would load the React app inside the iframe (wrong).
 */
const MACHINE_SCADA_INDEX = "/machine-scada/index.html"
const NATIVE_AUTH_MESSAGE = "pfe-native-auth"

function buildScadaExternalHref(token) {
  const base = `${typeof window !== "undefined" ? window.location.origin : ""}${MACHINE_SCADA_INDEX}`
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

  const iframeSrc = useMemo(() => MACHINE_SCADA_INDEX, [])
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
        <p className="text-sm text-slate-600 dark:text-slate-300">On-site PLC Realtime view.</p>
      </section>

      <section className="dashboard-enter" style={{ animationDelay: "120ms" }}>
        <Card className="w-full border-slate-200/80 bg-white/80 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-900/70">
          <CardHeader className="gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-base">Live PLC Surface</CardTitle>
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
            <div className="relative h-[min(92vh,calc(100vh-9rem))] min-h-[52vh] w-full overflow-hidden rounded-2xl border border-slate-200 bg-slate-950/90 dark:border-slate-700">
              <iframe
                ref={iframeRef}
                key={refreshKey}
                src={iframeSrc}
                title="Machine Native Interface"
                className="block h-full min-h-0 w-full border-0 bg-transparent"
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
