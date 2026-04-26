import { useEffect, useRef } from "react"
import { Navigate, Outlet, useLocation } from "react-router-dom"
import { toast } from "sonner"
import { useAuth } from "@/hooks/useAuth"

export function RoleBasedRoute({ allowedRoles = [], fallbackTo = "/overview" }) {
  const { role, isLoading } = useAuth()
  const location = useLocation()
  const notifiedRef = useRef(false)

  const isForbidden = !allowedRoles.includes(role)

  useEffect(() => {
    if (isLoading) return

    if (isForbidden && !notifiedRef.current) {
      toast.error("Permission Denied", {
        description: "You do not have access to that section.",
      })
      notifiedRef.current = true
      return
    }

    if (!isForbidden) {
      notifiedRef.current = false
    }
  }, [isForbidden, isLoading])

  if (isLoading) {
    return (
      <div className="grid min-h-[24vh] place-items-center">
        <p className="rounded-lg border border-slate-200 bg-white/80 px-4 py-2 text-sm text-slate-600 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-900/70 dark:text-slate-300">
          Checking permissions...
        </p>
      </div>
    )
  }

  if (isForbidden) {
    return (
      <Navigate
        to={fallbackTo}
        replace
        state={{ permissionDeniedFrom: location.pathname }}
      />
    )
  }

  return <Outlet />
}
