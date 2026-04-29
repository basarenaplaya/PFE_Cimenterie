import { ChevronLeft, ChevronRight, X } from "lucide-react"
import { useMemo } from "react"
import { NavLink } from "react-router-dom"
import { cn } from "@/lib/utils"
import { APP_BRAND_NAME, APP_LOGO_SRC } from "@/lib/branding"
import { getNavigationByRole } from "@/lib/navigation"
import { useAuth } from "@/hooks/useAuth"

export function Sidebar({
  collapsed,
  setCollapsed,
  mobileOpen,
  setMobileOpen,
}) {
  const { role } = useAuth()
  const visibleNavigation = useMemo(() => getNavigationByRole(role), [role])

  return (
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-[60] flex w-72 flex-col border-r border-slate-200 bg-white transition-[width,transform] duration-300 will-change-[width,transform] dark:border-slate-800 dark:bg-slate-950 md:w-64",
        collapsed && "md:w-20",
        mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
      )}
    >
      <div className="flex h-16 items-center justify-between px-4 border-b dark:border-slate-800">
        <div className="flex min-w-0 flex-1 items-center gap-3 overflow-hidden">
          <img
            src={APP_LOGO_SRC}
            alt=""
            width={32}
            height={32}
            className="h-8 w-8 shrink-0 rounded-md object-contain"
          />
          <span
            className={cn(
              "truncate text-lg font-bold text-slate-900 dark:text-slate-100",
              collapsed && "hidden md:hidden"
            )}
          >
            {APP_BRAND_NAME}
          </span>
        </div>
        <button
          onClick={() => setMobileOpen(false)}
          className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800/50 md:hidden"
        >
          <X className="h-5 w-5" />
        </button>
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="hidden rounded-md p-1.5 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800/50 md:inline-flex"
        >
          {collapsed ? <ChevronRight className="h-5 w-5" /> : <ChevronLeft className="h-5 w-5" />}
        </button>
      </div>

      <nav className="flex-1 space-y-2 p-4">
        {visibleNavigation.map((item) => {
          const Icon = item.icon
          return (
            <NavLink
              key={item.name}
              to={item.to}
              onClick={() => setMobileOpen(false)}
              className={({ isActive }) =>
                cn(
                  "group flex items-center rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400"
                    : "text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800/50"
                )
              }
            >
              {({ isActive }) => (
                <>
                  <Icon
                    className={cn(
                      "h-5 w-5 flex-shrink-0",
                      isActive
                        ? "text-blue-600 dark:text-blue-400"
                        : "text-slate-400 dark:text-slate-500 group-hover:text-slate-700 dark:group-hover:text-slate-300"
                    )}
                  />
                  <span
                    className={cn(
                      "ml-3 whitespace-nowrap transition-opacity duration-300",
                      collapsed ? "hidden opacity-0" : "block opacity-100"
                    )}
                  >
                    {item.name}
                  </span>
                </>
              )}
            </NavLink>
          )
        })}
      </nav>
    </aside>
  )
}