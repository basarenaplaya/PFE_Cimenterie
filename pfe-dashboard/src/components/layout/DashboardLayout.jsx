import { useState } from "react"
import { Outlet, useLocation } from "react-router-dom"
import { Sidebar } from "./Sidebar"
import { Header } from "./Header"
import { MobileStatusStrip } from "./MobileStatusStrip"
import { MobileQuickNav } from "./MobileQuickNav"
import { DashboardDataProvider } from "@/contexts/DashboardDataProvider"
import { useDashboardData } from "@/hooks/useDashboardData"
import { cn } from "@/lib/utils"

function DashboardLayoutContent({ children }) {
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const { pathname } = useLocation()
  const { machineStatus } = useDashboardData()

  return (
    <div className="min-h-screen overflow-x-clip bg-gray-50 text-slate-900 transition-colors duration-300 dark:bg-slate-950 dark:text-slate-50 flex">
      <Sidebar
        collapsed={collapsed}
        setCollapsed={setCollapsed}
        mobileOpen={mobileOpen}
        setMobileOpen={setMobileOpen}
      />
      {mobileOpen ? (
        <button
          type="button"
          aria-label="Close navigation"
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 z-50 bg-slate-950/55 md:hidden"
        />
      ) : null}
      
      <div 
         className={cn(
           "flex min-h-screen w-full flex-col transition-[padding-left] duration-300 will-change-[padding-left]",
             collapsed ? "md:pl-20" : "md:pl-64"
         )}
      >
        <Header 
          isRunning={machineStatus.is_running} 
          currentMode={machineStatus.current_mode} 
          onMenuClick={() => setMobileOpen((prev) => !prev)}
        />
        
        <main className="mobile-main-safe flex-1 overflow-y-auto px-3 pb-6 pt-3 sm:p-6">
          <div key={pathname} className="route-enter mx-auto max-w-7xl space-y-6">
            {children ?? <Outlet />}
          </div>
        </main>
      </div>
      <MobileStatusStrip />
      <MobileQuickNav />
    </div>
  )
}

export function DashboardLayout({ children }) {
  return (
    <DashboardDataProvider>
      <DashboardLayoutContent>{children}</DashboardLayoutContent>
    </DashboardDataProvider>
  )
}