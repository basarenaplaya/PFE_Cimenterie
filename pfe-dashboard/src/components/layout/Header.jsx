import { useEffect, useMemo, useState } from "react"
import { useTheme } from "next-themes"
import { Bell, LogOut, Menu, Moon, ShieldCheck, Sun, UserCircle2, UserRound } from "lucide-react"
import { useLocation, useNavigate } from "react-router-dom"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { getRouteMeta } from "@/lib/navigation"
import { useAuth } from "@/hooks/useAuth"
import { useDashboardData } from "@/hooks/useDashboardData"

export function Header({
  isRunning,
  currentMode,
  onMenuClick,
}) {
  const { resolvedTheme, setTheme } = useTheme()
  const [now, setNow] = useState(() => new Date())
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const { user, role, logout } = useAuth()
  const isAdmin = role === "ADMIN"
  const {
    adminNotifications = [],
    adminUnreadCount = 0,
    markAdminNotificationRead,
    markAllAdminNotificationsRead,
  } = useDashboardData()
  const routeMeta = useMemo(() => getRouteMeta(pathname), [pathname])

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(new Date())
    }, 1000)

    return () => window.clearInterval(timer)
  }, [])

  const dateLabel = useMemo(
    () =>
      now.toLocaleDateString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      }),
    [now]
  )

  const timeLabel = useMemo(
    () =>
      now.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      }),
    [now]
  )

  function handleLogout() {
    logout()
    navigate("/login", { replace: true })
  }

  function handleOpenProfile() {
    navigate("/profile")
  }

  return (
    <header className="header-safe sticky top-0 z-30 flex min-h-16 w-full items-center justify-between border-b border-slate-200/80 bg-white/80 px-3 py-2 backdrop-blur-md sm:px-6 sm:py-0 dark:border-slate-800/80 dark:bg-slate-950/80">
      <div className="flex min-w-0 items-center gap-2 sm:gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={onMenuClick}
          className="rounded-full md:hidden"
        >
          <Menu className="h-5 w-5" />
          <span className="sr-only">Open navigation</span>
        </Button>
        <div className="min-w-0">
          <p className="truncate text-[10px] uppercase tracking-[0.15em] text-slate-500 dark:text-slate-400 sm:text-xs sm:tracking-[0.2em]">
            {routeMeta.eyebrow}
          </p>
          <h1 className="truncate text-sm font-semibold text-slate-900 sm:text-lg dark:text-slate-50">
            {routeMeta.title}
          </h1>
        </div>
        <div className="hidden h-8 w-px bg-slate-200 dark:bg-slate-700 md:block" />
        <div className="hidden md:block">
          <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
            {dateLabel}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">{timeLabel}</p>
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-6">
        <div className="hidden items-center gap-1.5 rounded-full border border-slate-200 bg-slate-100 px-2 py-1 dark:border-slate-800 dark:bg-slate-900 sm:gap-3 sm:px-3 sm:py-1.5 md:flex">
          <div className="relative flex h-3 w-3">
            {currentMode === "OFFLINE" ? (
              <span className="relative inline-flex h-3 w-3 rounded-full bg-amber-500 shadow-[0_0_12px] shadow-amber-500/50" />
            ) : isRunning ? (
              <>
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-3 w-3 rounded-full bg-emerald-500 shadow-[0_0_16px] shadow-emerald-500/70" />
              </>
            ) : (
              <span className="relative inline-flex h-3 w-3 rounded-full bg-slate-400 dark:bg-slate-500" />
            )}
          </div>
          <span className="text-[11px] font-semibold tracking-wide text-slate-700 sm:text-sm dark:text-slate-300">
            <span className="sm:hidden">
              {currentMode === "OFFLINE" ? "PLC" : isRunning ? "LIVE" : "IDLE"}
            </span>
            <span className="hidden sm:inline">
              {currentMode === "OFFLINE"
                ? "PLC OFFLINE"
                : isRunning
                  ? "MOTORS RUNNING"
                  : "MOTORS STOPPED"}
            </span>
          </span>
          <span className="rounded text-[10px] bg-slate-200 px-1 py-0.5 text-slate-600 sm:ml-2 sm:px-1.5 sm:text-xs dark:bg-slate-800 dark:text-slate-400">
            {currentMode}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {isAdmin ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="relative inline-flex rounded-full">
                  {adminUnreadCount > 0 ? (
                    <span className="absolute right-1 top-1 flex h-2 w-2 rounded-full bg-red-500 ring-2 ring-white dark:ring-slate-950" />
                  ) : null}
                  <Bell className="h-5 w-5" />
                  <span className="sr-only">Notifications</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-80 max-h-[min(22rem,70vh)] overflow-y-auto p-0">
                <div className="flex items-center justify-between border-b border-slate-200 px-3 py-2 dark:border-slate-800">
                  <span className="text-sm font-semibold text-slate-900 dark:text-slate-50">Notifications</span>
                  {adminUnreadCount > 0 ? (
                    <button
                      type="button"
                      className="text-xs font-medium text-primary hover:underline"
                      onClick={() => markAllAdminNotificationsRead()}
                    >
                      Mark all read
                    </button>
                  ) : null}
                </div>
                {adminNotifications.length === 0 ? (
                  <div className="px-3 py-8 text-center text-sm text-slate-500 dark:text-slate-400">No alerts yet.</div>
                ) : (
                  <ul className="py-1">
                    {adminNotifications.map((n) => (
                      <li key={n.id} className="border-b border-slate-100 last:border-0 dark:border-slate-800/80">
                        <button
                          type="button"
                          className={`flex w-full flex-col gap-0.5 px-3 py-2.5 text-left text-sm transition-colors hover:bg-slate-100 dark:hover:bg-slate-800/80 ${
                            n.read ? "opacity-70" : ""
                          }`}
                          onClick={() => {
                            if (!n.read) markAdminNotificationRead(n.id)
                          }}
                        >
                          <span className="font-medium text-slate-900 dark:text-slate-100">{n.title}</span>
                          {n.subtitle ? (
                            <span className="line-clamp-2 text-xs text-slate-600 dark:text-slate-400">{n.subtitle}</span>
                          ) : null}
                          <span className="text-[10px] text-slate-500 dark:text-slate-500">
                            {new Date(n.at).toLocaleString()}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}

          <Button
            variant="outline"
            size="icon"
            onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
            className="rounded-full"
          >
            {resolvedTheme === "dark" ? (
              <Sun className="h-5 w-5" />
            ) : (
              <Moon className="h-5 w-5" />
            )}
            <span className="sr-only">Toggle theme</span>
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                className="h-9 gap-2 rounded-full border-slate-200 bg-white/90 pl-2 pr-3 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-cyan-500/15 text-cyan-600 dark:text-cyan-300">
                  <UserCircle2 className="h-4 w-4" />
                </span>
                <span className="hidden max-w-32 truncate sm:inline">{user?.full_name || user?.username || "Session"}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-60">
              <DropdownMenuLabel className="space-y-1">
                <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">
                  {user?.full_name || user?.username || "Authenticated User"}
                </p>
                <p className="truncate text-xs text-slate-500 dark:text-slate-400">{user?.username || "Secure Session"}</p>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="gap-2">
                <ShieldCheck className="h-4 w-4 text-cyan-600 dark:text-cyan-300" />
                Role: {role || "Unknown"}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleOpenProfile} className="gap-2">
                <UserRound className="h-4 w-4 text-cyan-600 dark:text-cyan-300" />
                Open profile
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout} variant="destructive" className="gap-2">
                <LogOut className="h-4 w-4" />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  )
}