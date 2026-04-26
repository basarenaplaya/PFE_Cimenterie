import { useMemo, useState } from "react"
import { ExternalLink, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/hooks/useAuth"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { getResolvedApiBaseUrl } from "@/lib/api"

const MACHINE_NATIVE_PATH = "/machine/native"

function buildNativeMachineUrl(token) {
  const base = getResolvedApiBaseUrl()
  const hash =
    typeof token === "string" && token.trim()
      ? `#token=${encodeURIComponent(token)}`
      : ""
  if (base === "") {
    return `${MACHINE_NATIVE_PATH}${hash}`
  }
  return `${base}${MACHINE_NATIVE_PATH}${hash}`
}

export default function MachineViewPage() {
  const { token } = useAuth()

  const [refreshKey, setRefreshKey] = useState(0)

  const nativeMachineUrl = useMemo(() => buildNativeMachineUrl(token), [token])

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
                Embedded machine panel with one-click external launch.
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
                <a href={nativeMachineUrl} target="_blank" rel="noreferrer">
                  <ExternalLink className="h-4 w-4" />
                  Open External
                </a>
              </Button>
            </div>
          </CardHeader>

          <CardContent className="px-4 pb-4 pt-0 sm:px-5 sm:pb-5">
            <div className="relative min-h-[86vh] h-[calc(100vh-6.5rem)] overflow-hidden rounded-2xl border border-slate-200 bg-white/90 dark:border-slate-700 dark:bg-slate-950/60">
              <iframe
                key={refreshKey}
                src={nativeMachineUrl}
                title="Machine Native Interface"
                className="block h-full w-full border-0 bg-white"
                loading="lazy"
              />
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  )
}
