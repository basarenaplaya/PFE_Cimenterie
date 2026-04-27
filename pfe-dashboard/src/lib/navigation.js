import {
  Camera,
  ClipboardList,
  LayoutDashboard,
  Monitor,
  Package,
  User,
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
    name: "Machine View",
    icon: Monitor,
    to: "/machine-view",
    eyebrow: "Machine",
    title: "PLC Native Control",
    roles: BASE_ROLES,
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
    name: "Camera",
    icon: Camera,
    to: "/admin/cameras",
    eyebrow: "Administration",
    title: "Camera Configuration",
    roles: ["ADMIN"],
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
    name: "Audit Log",
    icon: ClipboardList,
    to: "/admin/logs",
    eyebrow: "Administration",
    title: "System Audit Logs",
    roles: ["ADMIN"],
  },
  {
    name: "Profile",
    icon: User,
    to: "/profile",
    eyebrow: "Profile",
    title: "User Profile",
    roles: BASE_ROLES,
  },
]

export function getNavigationByRole(role) {
  const resolvedRole = role || "OPERATOR"
  return dashboardNavigation.filter((item) => item.roles.includes(resolvedRole))
}

export function getRouteMeta(pathname) {
  const adminPaths = dashboardNavigation
    .filter((item) => item.to.startsWith("/admin"))
    .sort((a, b) => b.to.length - a.to.length)

  const match =
    adminPaths.find((item) => pathname.startsWith(item.to)) ||
    dashboardNavigation.find((item) => pathname.startsWith(item.to))

  return match ?? dashboardNavigation[0]
}
