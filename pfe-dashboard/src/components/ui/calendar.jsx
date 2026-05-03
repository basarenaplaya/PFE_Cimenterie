import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react"
import { DayPicker, getDefaultClassNames } from "react-day-picker"

import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"

import "react-day-picker/style.css"
import "./calendar-rdp-overrides.css"

function Calendar({ className, classNames, showOutsideDays = true, captionLayout = "label", ...props }) {
  const defaultClassNames = getDefaultClassNames()

  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      captionLayout={captionLayout}
      className={cn(
        "calendar-rdp-skin bg-background group/calendar p-3 [--cell-size:2.375rem]",
        /* Geometry; colors + hover live in index.css @layer components (beat bundled RDP sheet). */
        "[--rdp-day_button-border-radius:0.5rem]",
        "[--rdp-day-height:var(--cell-size)] [--rdp-day-width:var(--cell-size)]",
        "[--rdp-day_button-height:calc(var(--cell-size)-2px)] [--rdp-day_button-width:calc(var(--cell-size)-2px)]",
        "[[data-slot=card-content]_&]:bg-transparent [[data-slot=popover-content]_&]:bg-transparent",
        "rtl:**:[.rdp-button_next>svg]:rotate-180",
        "rtl:**:[.rdp-button_previous>svg]:rotate-180",
        className
      )}
      classNames={{
        root: cn("w-fit", defaultClassNames.root),
        months: cn("relative flex flex-col gap-4 md:flex-row", defaultClassNames.months),
        month: cn("flex w-full flex-col gap-4", defaultClassNames.month),
        nav: cn(
          "absolute inset-x-0 top-0 flex w-full items-center justify-between gap-1",
          defaultClassNames.nav
        ),
        button_previous: cn(
          buttonVariants({ variant: "ghost" }),
          "size-[length:var(--cell-size)] select-none p-0 text-muted-foreground transition-opacity duration-200 aria-disabled:opacity-40",
          defaultClassNames.button_previous
        ),
        button_next: cn(
          buttonVariants({ variant: "ghost" }),
          "size-[length:var(--cell-size)] select-none p-0 text-muted-foreground transition-opacity duration-200 aria-disabled:opacity-40",
          defaultClassNames.button_next
        ),
        month_caption: cn(
          "flex h-[length:var(--cell-size)] w-full items-center justify-center px-[length:var(--cell-size)]",
          defaultClassNames.month_caption
        ),
        dropdowns: cn(
          "flex h-[length:var(--cell-size)] w-full items-center justify-center gap-1.5 text-sm font-medium",
          defaultClassNames.dropdowns
        ),
        dropdown_root: cn(
          "has-focus:border-ring border-input shadow-xs has-focus:ring-ring/50 has-focus:ring-[3px] relative rounded-md border",
          defaultClassNames.dropdown_root
        ),
        dropdown: cn("bg-popover absolute inset-0 opacity-0", defaultClassNames.dropdown),
        caption_label: cn(
          "select-none font-medium",
          captionLayout === "label"
            ? "text-sm"
            : "[&>svg]:text-muted-foreground flex h-8 items-center gap-1 rounded-md pl-2 pr-1 text-sm [&>svg]:size-3.5",
          defaultClassNames.caption_label
        ),
        month_grid: cn("w-full border-collapse", defaultClassNames.month_grid),
        weekdays: cn("flex", defaultClassNames.weekdays),
        weekday: cn(
          "text-muted-foreground flex h-9 flex-1 select-none items-center justify-center rounded-md text-[0.8rem] font-normal",
          defaultClassNames.weekday
        ),
        weeks: cn("w-full", defaultClassNames.weeks),
        week: cn("mt-2 flex w-full", defaultClassNames.week),
        week_number_header: cn(
          "w-[length:var(--cell-size)] select-none",
          defaultClassNames.week_number_header
        ),
        week_number: cn("text-muted-foreground select-none text-[0.8rem]", defaultClassNames.week_number),
        day: cn(
          "relative isolate h-[length:var(--cell-size)] w-[length:var(--cell-size)] p-0 text-center",
          defaultClassNames.day
        ),
        day_button: cn(
          defaultClassNames.day_button,
          "z-10 outline-none",
          "disabled:pointer-events-none disabled:opacity-35",
          "focus-visible:z-20 focus-visible:ring-2 focus-visible:ring-ring/70 focus-visible:ring-offset-1 focus-visible:ring-offset-background"
        ),
        /* Let bundled range gradients + variables paint the strip; do not add bg-accent here */
        range_start: cn(defaultClassNames.range_start),
        range_middle: cn(defaultClassNames.range_middle),
        range_end: cn(defaultClassNames.range_end),
        selected: cn(defaultClassNames.selected),
        today: cn(
          "[&>button]:font-semibold [&>button]:text-primary",
          "[&:not(.rdp-selected)>button]:bg-muted/40 [&:not(.rdp-selected)>button]:text-foreground",
          defaultClassNames.today
        ),
        outside: cn(
          "text-muted-foreground opacity-60 aria-selected:text-muted-foreground aria-selected:opacity-90",
          defaultClassNames.outside
        ),
        disabled: cn("text-muted-foreground opacity-50", defaultClassNames.disabled),
        hidden: cn("invisible", defaultClassNames.hidden),
        ...classNames,
      }}
      components={{
        Chevron: ({ className: chevronClass, orientation, ...chevronProps }) => {
          if (orientation === "left") {
            return <ChevronLeft className={cn("size-4", chevronClass)} {...chevronProps} />
          }
          if (orientation === "right") {
            return <ChevronRight className={cn("size-4", chevronClass)} {...chevronProps} />
          }
          return <ChevronDown className={cn("size-4", chevronClass)} {...chevronProps} />
        },
      }}
      {...props}
    />
  )
}

export { Calendar }
