import * as React from "react"
import { cva } from "class-variance-authority"

import { cn } from "@/lib/utils"

const alertVariants = cva(
  "relative w-full rounded-xl border px-4 py-3 text-sm [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:translate-y-px",
  {
    variants: {
      variant: {
        default: "border-border bg-card text-card-foreground shadow-xs",
        destructive:
          "border-destructive/45 bg-destructive/10 text-destructive [&_svg]:text-destructive dark:bg-destructive/15 dark:border-destructive/50",
        success:
          "border-emerald-500/35 bg-emerald-500/[0.08] text-emerald-950 dark:border-emerald-500/40 dark:bg-emerald-500/12 dark:text-emerald-50 [&_svg]:text-emerald-600 dark:[&_svg]:text-emerald-400",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Alert({ className, variant, ...props }) {
  return (
    <div data-slot="alert" role="alert" className={cn(alertVariants({ variant }), className)} {...props} />
  )
}

function AlertTitle({ className, ...props }) {
  return <h5 className={cn("mb-1.5 font-semibold leading-none tracking-tight", className)} {...props} />
}

function AlertDescription({ className, ...props }) {
  return <div className={cn("text-sm leading-relaxed text-muted-foreground [&_p]:leading-relaxed", className)} {...props} />
}

export { Alert, AlertTitle, AlertDescription }
