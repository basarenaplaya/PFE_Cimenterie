import { useMemo, useState } from "react"
import { format } from "date-fns"
import { Calendar as CalendarIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { getDefaultExplorerDateRange } from "@/lib/explorerDateRange"
import { cn } from "@/lib/utils"

function startOfLocalDay(d) {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

function endOfLocalDay(d) {
  const x = new Date(d)
  x.setHours(23, 59, 59, 999)
  return x
}

/**
 * @param {{ from?: Date, to?: Date }} value
 * @param {(next: { from?: Date, to?: Date } | undefined) => void} onChange
 */
export function DateRangePicker({ value, onChange, className, disabled = false }) {
  const [open, setOpen] = useState(false)

  const label = useMemo(() => {
    if (!value?.from) {
      return "Select date range"
    }
    if (!value?.to) {
      return format(value.from, "MMM d, yyyy")
    }
    return `${format(value.from, "MMM d, yyyy")} – ${format(value.to, "MMM d, yyyy")}`
  }, [value])

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          className={cn("min-w-[220px] justify-start gap-2 font-normal", className)}
        >
          <CalendarIcon className="h-4 w-4 shrink-0 opacity-70" aria-hidden />
          <span className="truncate">{label}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-auto max-w-[calc(100vw-1.5rem)] overflow-hidden p-0 duration-300 ease-out data-[state=closed]:duration-200 data-[state=open]:zoom-in-[0.98] data-[state=closed]:zoom-out-[0.98]"
        align="start"
      >
        <div className="flex max-w-[100vw] flex-col gap-3 p-3 sm:max-w-none">
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => {
                const to = endOfLocalDay(new Date())
                const from = startOfLocalDay(new Date())
                onChange({ from, to })
              }}
            >
              Today
            </Button>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => onChange(getDefaultExplorerDateRange())}
            >
              Last 7 days
            </Button>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => {
                const to = endOfLocalDay(new Date())
                const from = startOfLocalDay(new Date())
                from.setDate(from.getDate() - 29)
                onChange({ from, to })
              }}
            >
              Last 30 days
            </Button>
          </div>
          <Calendar
            mode="range"
            numberOfMonths={1}
            selected={value}
            onSelect={(next) => {
              onChange(next)
            }}
            defaultMonth={value?.from}
          />
          <div className="flex justify-end gap-2 border-t border-border pt-2">
            <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>
              Done
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
