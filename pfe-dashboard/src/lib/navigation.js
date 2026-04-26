import {
  Camera,
  ClipboardList,
  LayoutDashboard,
  Monitor,
  Package,
  User,
  Settings,
  Users,
  Wrench,
} from "lucide-react"

const BASE_ROLES = ["ADMIN", "OPERATOR"]

export const dashboardNavigation = [
  {
    name: "Overview",
    icon: LayoutDashboard,
    to: "/overview",
    eyebrow: "Overview",
    title: "Main Dashboard",
    roles: ["ADMIN"],
  },
  {
    name: "Production",
    icon: Package,
    to: "/production",
    eyebrow: "Production",
    title: "Production Analytics",
    roles: ["ADMIN"],
  },
  {
    name: "Maintenance",
    icon: Wrench,
    to: "/maintenance",
    eyebrow: "Maintenance",
    title: "Maintenance Center",
    roles: ["ADMIN"],
  },
  {
    name: "Settings",
    icon: Settings,
    to: "/settings",
    eyebrow: "Settings",
    title: "Dashboard Settings",
    roles: ["ADMIN"],
  },
  {
    name: "Machine View",
    icon: Monitor,
    to: "/machine-view",
    eyebrow: "Machine",
    title: "PLC Native Control",
    roles: BASE_ROLES,
  },
  {
    name: "Profile",
    icon: User,
    to: "/profile",
    eyebrow: "Profile",
    title: "User Profile",
    roles: BASE_ROLES,
  },
  {
    name: "User Management",
    icon: Users,
    to: "/admin/users",
    eyebrow: "Administration",
    title: "User Management",
    roles: ["ADMIN"],
  },
  {
    name: "Camera Config",
    icon: Camera,
    to: "/admin/cameras",
    eyebrow: "Administration",
    title: "Camera Configuration",
    roles: ["ADMIN"],
  },
  {
    name: "Audit Logs",
    icon: ClipboardList,
    to: "/admin/logs",
    eyebrow: "Administration",
    title: "System Audit Logs",
    roles: ["ADMIN"],
  },
]

export function getNavigationByRole(role) {
  const resolvedRole = role || "OPERATOR"
  return dashboardNavigation.filter((item) => item.roles.includes(resolvedRole))
}

export function getRouteMeta(pathname) {
  return (
    dashboardNavigation.find((item) => pathname.startsWith(item.to)) ??
    dashboardNavigation[0]
  )
}
