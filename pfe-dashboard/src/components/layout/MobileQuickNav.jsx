import { useMemo } from "react"
import { NavLink } from "react-router-dom"
import { getNavigationByRole } from "@/lib/navigation"
import { cn } from "@/lib/utils"
import { useAuth } from "@/hooks/useAuth"

export function MobileQuickNav() {
  const { role } = useAuth()
  const items = useMemo(() => getNavigationByRole(role), [role])

  return (
    <nav className="quick-nav-safe fixed inset-x-2 z-30 mx-auto w-auto max-w-md md:hidden">
      <div className="rounded-2xl border border-slate-200/80 bg-white/85 p-1.5 shadow-xl backdrop-blur-xl dark:border-slate-800 dark:bg-slate-900/85">
        <ul className="grid auto-cols-[minmax(5.1rem,1fr)] grid-flow-col justify-items-center gap-1 overflow-x-auto pb-0.5">
          {items.map((item) => {
            const Icon = item.icon
            return (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  className={({ isActive }) =>
                    cn(
                      "flex w-full flex-col items-center rounded-xl px-2 py-2 text-center text-[11px] font-medium transition-all duration-200",
                      isActive
                        ? "bg-cyan-50 text-cyan-700 dark:bg-cyan-900/25 dark:text-cyan-300"
                        : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800/60"
                    )
                  }
                >
                  {({ isActive }) => (
                    <>
                      <Icon
                        className={cn(
                          "mb-1 h-4 w-4",
                          isActive
                            ? "text-cyan-600 dark:text-cyan-300"
                            : "text-slate-500 dark:text-slate-400"
                        )}
                      />
                      <span>{item.name}</span>
                    </>
                  )}
                </NavLink>
              </li>
            )
          })}
        </ul>
      </div>
    </nav>
  )
}
