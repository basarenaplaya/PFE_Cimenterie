import { Navigate, Outlet } from "react-router-dom"
import { useAuth } from "@/hooks/useAuth"
import { getDefaultDashboardPath } from "@/lib/navigation"

export function PublicOnlyRoute() {
  const { isAuthenticated, isLoading, role } = useAuth()

  if (isLoading) {
    return (
      <div className="grid min-h-screen place-items-center bg-slate-100 dark:bg-slate-950">
        <p className="rounded-lg border border-slate-200 bg-white/75 px-4 py-2 text-sm text-slate-600 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-900/70 dark:text-slate-300">
          Restoring session...
        </p>
      </div>
    )
  }

  if (isAuthenticated) {
    return <Navigate to={getDefaultDashboardPath(role)} replace />
  }

  return <Outlet />
}
