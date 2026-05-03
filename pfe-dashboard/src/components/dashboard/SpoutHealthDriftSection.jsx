import { Activity } from "lucide-react"

import { SpoutCalibrationInsight } from "@/components/dashboard/SpoutCalibrationInsight"
import { SpoutGiveawayBarChart } from "@/components/dashboard/SpoutGiveawayBarChart"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { getFlaggedSpouts } from "@/lib/spoutDrift"
import { cn } from "@/lib/utils"

export function SpoutHealthDriftSection({ points, isLoading, error }) {
  const list = Array.isArray(points) ? points : []
  const flagged = getFlaggedSpouts(list)
  const showNominalBadge = !isLoading && !error && flagged.length === 0 && list.length > 0

  return (
    <Card
      className={cn(
        "overflow-hidden border-slate-200/80 bg-white/80 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-900/70"
      )}
    >
      <CardHeader className="space-y-3 border-b border-slate-200/70 pb-4 dark:border-slate-800/80">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 flex-1 gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200/90 bg-slate-50 dark:border-slate-700 dark:bg-slate-900/80">
              <Activity className="h-5 w-5 text-primary" aria-hidden />
            </div>
            <div className="min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
              <CardTitle className="text-lg">Spout drift · today (UTC)</CardTitle>
                {flagged.length > 0 ? (
                  <Badge variant="destructive" className="font-semibold tracking-wide">
                    {flagged.length} flagged
                  </Badge>
                ) : null}
                {showNominalBadge ? (
                  <Badge
                    variant="outline"
                    className="border-emerald-500/45 bg-emerald-500/[0.07] font-semibold text-emerald-800 dark:border-emerald-500/40 dark:bg-emerald-500/12 dark:text-emerald-100"
                  >
                    All nominal
                  </Badge>
                ) : null}
              </div>
              <CardDescription className="max-w-2xl text-xs sm:text-[13px]">
                Mean giveaway by spout for the UTC day. Watch bars that climb — usually weigh-cell drift.
              </CardDescription>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-5 px-4 pb-6 pt-5 sm:px-6">
        <SpoutCalibrationInsight points={list} />

        <div>
          <div className="mb-3 flex items-center justify-between gap-2">
            <h4 className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
              Distribution
            </h4>
            <span className="text-[11px] tabular-nums text-slate-500 dark:text-slate-400">kg vs bec</span>
          </div>
          <div className="rounded-xl border border-slate-200/90 bg-linear-to-b from-slate-50/80 to-transparent p-3 dark:border-slate-800 dark:from-slate-950/50 sm:p-4">
            <SpoutGiveawayBarChart embedded points={list} isLoading={isLoading} error={error} />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
