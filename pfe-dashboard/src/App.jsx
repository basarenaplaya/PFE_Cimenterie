import { lazy, Suspense, useEffect } from "react"
import { ThemeProvider } from "./components/theme-provider"
import { DashboardLayout } from "./components/layout/DashboardLayout"
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom"
import { Toaster } from "sonner"
import { AuthProvider } from "@/contexts/AuthContext"
import { ProtectedRoute } from "@/components/auth/ProtectedRoute"
import { PublicOnlyRoute } from "@/components/auth/PublicOnlyRoute"
import { RoleBasedRoute } from "@/components/auth/RoleBasedRoute"
import { useAuth } from "@/hooks/useAuth"
import { APP_BRAND_NAME } from "@/lib/branding"

const OverviewPage = lazy(() => import("./pages/OverviewPage"))
const ProductionPage = lazy(() => import("./pages/ProductionPage"))
const MaintenancePage = lazy(() => import("./pages/MaintenancePage"))
const LoginPage = lazy(() => import("./pages/LoginPage"))
const UnauthorizedPage = lazy(() => import("./pages/UnauthorizedPage"))
const UserManagementPage = lazy(() => import("./pages/UserManagementPage"))
const CameraConfigPage = lazy(() => import("./pages/CameraConfigPage"))
const AuditLogsPage = lazy(() => import("./pages/AuditLogsPage"))
const AdminDataExplorerPage = lazy(() => import("./pages/AdminDataExplorerPage"))
const MachineViewPage = lazy(() => import("./pages/MachineViewPage"))
const ProfilePage = lazy(() => import("./pages/ProfilePage"))

function RouteFallback() {
  return (
    <div className="grid min-h-[40vh] place-items-center">
      <div className="rounded-xl border border-slate-200 bg-white/80 px-6 py-4 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-900/70 dark:text-slate-300">
        Loading dashboard view...
      </div>
    </div>
  )
}

function LandingRedirect() {
  const { role } = useAuth()

  return <Navigate to={role === "ADMIN" ? "/overview" : "/machine-view"} replace />
}

function App() {
  useEffect(() => {
    document.title = APP_BRAND_NAME
  }, [])

  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem={false}
      storageKey="vite-ui-theme"
    >
      <BrowserRouter>
        <AuthProvider>
          <Toaster closeButton richColors position="top-right" />
          <Suspense fallback={<RouteFallback />}>
            <Routes>
              <Route element={<PublicOnlyRoute />}>
                <Route path="/login" element={<LoginPage />} />
              </Route>

              <Route path="/unauthorized" element={<UnauthorizedPage />} />

              <Route element={<ProtectedRoute />}>
                <Route element={<DashboardLayout />}>
                  <Route path="/" element={<LandingRedirect />} />

                  <Route element={<RoleBasedRoute allowedRoles={["ADMIN"]} fallbackTo="/machine-view" />}>
                    <Route path="/overview" element={<OverviewPage />} />
                    <Route path="/production" element={<ProductionPage />} />
                    <Route path="/maintenance" element={<MaintenancePage />} />
                  </Route>

                  <Route
                    element={
                      <RoleBasedRoute allowedRoles={["ADMIN", "OPERATOR"]} fallbackTo="/unauthorized" />
                    }
                  >
                    <Route path="/machine-view" element={<MachineViewPage />} />
                    <Route path="/profile" element={<ProfilePage />} />
                  </Route>

                  <Route element={<RoleBasedRoute allowedRoles={["ADMIN"]} fallbackTo="/machine-view" />}>
                    <Route path="/admin/users" element={<UserManagementPage />} />
                    <Route path="/admin/cameras" element={<CameraConfigPage />} />
                    <Route path="/admin/explorer" element={<AdminDataExplorerPage />} />
                    <Route path="/admin/logs" element={<AuditLogsPage />} />
                    <Route
                      path="/admin/audit-logs"
                      element={<Navigate to="/admin/logs" replace />}
                    />
                  </Route>

                  <Route path="*" element={<LandingRedirect />} />
                </Route>
              </Route>

              <Route path="*" element={<Navigate to="/login" replace />} />
            </Routes>
          </Suspense>
        </AuthProvider>
      </BrowserRouter>
    </ThemeProvider>
  )
}

export default App
