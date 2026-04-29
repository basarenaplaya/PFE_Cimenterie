import { AlertTriangle, CircleCheck } from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { getFlaggedSpouts, SPOUT_DRIFT_THRESHOLD_KG } from "@/lib/spoutDrift"

function formatSignedKgDrift(value) {
  const n = Number(value) || 0
  const sign = n > 0 ? "+" : ""
  return `${sign}${n.toFixed(2)} kg`
}

export function SpoutCalibrationInsight({ points }) {
  const list = Array.isArray(points) ? points : []
  const flagged = getFlaggedSpouts(list)

  if (flagged.length === 0) {
    return (
      <Alert variant="success" className="flex gap-3 py-3">
        <CircleCheck className="mt-0.5 shrink-0" aria-hidden />
        <div className="min-w-0">
          <AlertTitle className="text-emerald-950 dark:text-emerald-50">Within tolerance</AlertTitle>
          <AlertDescription className="text-emerald-900/90 dark:text-emerald-100/90">
            All spouts operating within tolerance for today (UTC).
          </AlertDescription>
        </div>
      </Alert>
    )
  }

  return (
    <Alert variant="destructive" className="flex gap-3 py-3">
      <AlertTriangle className="mt-0.5 shrink-0" aria-hidden />
      <div className="min-w-0 flex-1 space-y-2">
        <div>
          <AlertTitle>Calibration drift detected</AlertTitle>
          <AlertDescription className="mt-1 text-destructive/90 dark:text-destructive/85">
            {flagged.length} spout{flagged.length === 1 ? "" : "s"} exceed{" "}
            {SPOUT_DRIFT_THRESHOLD_KG.toFixed(2)} kg average giveaway (UTC day). Prioritize inspection by severity
            below.
          </AlertDescription>
        </div>
        <ul className="space-y-2 border-t border-destructive/25 pt-3 dark:border-destructive/35">
          {flagged.map((row) => {
            const id = Number(row.spout_id ?? 0)
            const bags = Number(row.bags_filled ?? 0)
            return (
              <li
                key={id}
                className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 text-sm text-destructive/95 dark:text-destructive/90"
              >
                <span className="font-medium tabular-nums">
                  Bec #{id}{" "}
                  <span className="font-normal text-destructive/80 dark:text-destructive/75">
                    · {formatSignedKgDrift(row.avg_giveaway)} avg
                  </span>
                </span>
                <span className="text-xs tabular-nums text-destructive/75 dark:text-destructive/70">
                  {bags} bags
                </span>
              </li>
            )
          })}
        </ul>
        <p className="border-t border-destructive/20 pt-2 text-xs leading-relaxed text-destructive/85 dark:text-destructive/80">
          Inspect filling valve and spout liner for cement buildup or wear; recalibrate weigh cell if drift persists.
        </p>
      </div>
    </Alert>
  )
}
