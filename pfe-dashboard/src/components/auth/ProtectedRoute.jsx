import { Navigate, Outlet, useLocation } from "react-router-dom"
import { ShieldCheck } from "lucide-react"
import { useAuth } from "@/hooks/useAuth"

function AuthLoadingScreen() {
  return (
    <div className="grid min-h-screen place-items-center bg-slate-100 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-slate-200 bg-white/80 px-8 py-7 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-900/70">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-600 dark:bg-cyan-400/15 dark:text-cyan-300">
          <ShieldCheck className="h-5 w-5" />
        </div>
        <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Restoring secure session...</p>
      </div>
    </div>
  )
}

export function ProtectedRoute() {
  const { isAuthenticated, isLoading } = useAuth()
  const location = useLocation()

  if (isLoading) {
    return <AuthLoadingScreen />
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  return <Outlet />
}
