import { useContext } from "react"
import { DashboardDataContext } from "@/contexts/dashboard-data-context"

export function useDashboardData() {
  const context = useContext(DashboardDataContext)

  if (!context) {
    throw new Error("useDashboardData must be used inside DashboardDataProvider")
  }

  return context
}
