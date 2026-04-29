import { useCallback, useEffect, useState } from "react"
import { Coins, TrendingDown, TrendingUp } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { useDashboardData } from "@/hooks/useDashboardData"
import { useToast } from "@/hooks/useToast"
import { patchAnalyticsPricing } from "@/services/adminApi"

const MIN_PRICE = 0.01
const MAX_PRICE = 1_000_000

const tndFmt = new Intl.NumberFormat("fr-FR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

function formatProducedTnd(value) {
  return `${tndFmt.format(Number(value) || 0)} TND`
}

function formatGiveawayImpact(costTnd) {
  const v = Number(costTnd) || 0
  const abs = tndFmt.format(Math.abs(v))
  if (v > 0) return `−${abs} TND`
  if (v < 0) return `+${abs} TND`
  return `${abs} TND`
}

export function ProductionPricingDialogTrigger() {
  const { kpis, refresh } = useDashboardData()
  const { success, error } = useToast()
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState("")
  const [saving, setSaving] = useState(false)
  const [fieldError, setFieldError] = useState("")

  const priceLabel = Number(kpis.price_per_ton_tnd ?? 250)

  useEffect(() => {
    if (!open) return
    setDraft(String(priceLabel))
    setFieldError("")
  }, [open, priceLabel])

  const validateAndParse = useCallback(() => {
    const n = Number.parseFloat(String(draft).replace(",", "."))
    if (!Number.isFinite(n)) {
      setFieldError("Entrez un nombre valide.")
      return null
    }
    if (n < MIN_PRICE || n > MAX_PRICE) {
      setFieldError(`Le prix doit être entre ${MIN_PRICE} et ${MAX_PRICE.toLocaleString("fr-FR")} TND / t.`)
      return null
    }
    setFieldError("")
    return n
  }, [draft])

  const handleSave = async () => {
    const n = validateAndParse()
    if (n === null) return
    setSaving(true)
    try {
      await patchAnalyticsPricing({ price_per_ton_tnd: n })
      await refresh()
      success("Tarif enregistré.")
      setOpen(false)
    } catch (err) {
      error(err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button type="button" variant="outline" size="sm" className="shrink-0" onClick={() => setOpen(true)}>
        Prix / tonne
      </Button>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Tarif (TND / tonne)</DialogTitle>
          <DialogDescription>
            Prix utilisé pour la valeur produite et le coût de surdosage sur la journée UTC en cours.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-2 py-1">
          <label htmlFor="price-per-ton-tnd" className="text-sm font-medium text-slate-900 dark:text-slate-50">
            Prix par tonne métrique
          </label>
          <Input
            id="price-per-ton-tnd"
            type="number"
            inputMode="decimal"
            step="0.01"
            min={MIN_PRICE}
            max={MAX_PRICE}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault()
                void handleSave()
              }
            }}
            aria-invalid={Boolean(fieldError)}
          />
          {fieldError ? <p className="text-sm text-destructive">{fieldError}</p> : null}
        </div>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
            Annuler
          </Button>
          <Button type="button" onClick={() => void handleSave()} disabled={saving}>
            {saving ? "Enregistrement…" : "Enregistrer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function FinancialImpactSection() {
  const { kpis } = useDashboardData()
  const gross = Number(kpis.gross_value_tnd || 0)
  const giveawayCost = Number(kpis.giveaway_cost_tnd || 0)

  return (
    <section className="space-y-3 border-t border-slate-200/80 pt-6 dark:border-slate-800/80">
      <div className="flex flex-col gap-0.5">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
          Financial impact
        </p>
        <h3 className="text-base font-semibold text-slate-900 dark:text-slate-50">Impact financier</h3>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card className="border-slate-200/80 bg-white/80 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-900/70 ring-emerald-500/25 dark:ring-emerald-500/35">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-700 dark:text-slate-200">Valeur produite</CardTitle>
            <Coins className="h-4 w-4 text-emerald-600 dark:text-emerald-400" aria-hidden />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold tabular-nums text-emerald-700 dark:text-emerald-300">
              {formatProducedTnd(gross)}
            </p>
          </CardContent>
        </Card>
        <Card className="border-slate-200/80 bg-white/80 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-900/70 ring-rose-500/25 dark:ring-rose-500/35">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-700 dark:text-slate-200">Perte surdosage</CardTitle>
            {giveawayCost >= 0 ? (
              <TrendingDown className="h-4 w-4 text-rose-600 dark:text-rose-400" aria-hidden />
            ) : (
              <TrendingUp className="h-4 w-4 text-emerald-600 dark:text-emerald-400" aria-hidden />
            )}
          </CardHeader>
          <CardContent>
            <p
              className={`text-2xl font-semibold tabular-nums ${
                giveawayCost > 0
                  ? "text-rose-700 dark:text-rose-300"
                  : giveawayCost < 0
                    ? "text-emerald-700 dark:text-emerald-300"
                    : "text-slate-800 dark:text-slate-100"
              }`}
            >
              {formatGiveawayImpact(giveawayCost)}
            </p>
          </CardContent>
        </Card>
      </div>
    </section>
  )
}
