import {
  Camera,
  ClipboardList,
  LayoutDashboard,
  Monitor,
  Package,
  Search,
  User,
  Users,
  Wrench,
} from "lucide-react"

const BASE_ROLES = ["ADMIN", "OPERATOR"]

/** Path prefixes for routes gated to ADMIN only in App.jsx */
const ADMIN_ONLY_ROUTE_PREFIXES = ["/admin", "/overview", "/production", "/maintenance"]

export function getDefaultDashboardPath(role) {
  if (role === "ADMIN") return "/overview"
  if (role === "OPERATOR") return "/machine-view"
  return "/"
}

export function isAdminOnlyPath(pathname) {
  if (!pathname || pathname === "/") return false
  return ADMIN_ONLY_ROUTE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  )
}

/** Safe path after auth: operators are not sent to admin-only routes (see App.jsx). */
export function resolvePostAuthDestination({ savedPathname, role }) {
  const fallback = getDefaultDashboardPath(role)
  if (!savedPathname || savedPathname === "/login") return fallback
  if (role === "ADMIN") return savedPathname
  if (role === "OPERATOR" && isAdminOnlyPath(savedPathname)) return fallback
  if (role !== "ADMIN" && role !== "OPERATOR" && isAdminOnlyPath(savedPathname)) return fallback
  return savedPathname
}

export const dashboardNavigation = [
  {
    name: "Overview",
    icon: LayoutDashboard,
    to: "/overview",
    eyebrow: "Overview",
    title: "Overview",
    roles: ["ADMIN"],
  },
  {
    name: "Machine View",
    icon: Monitor,
    to: "/machine-view",
    eyebrow: "Machine",
    title: "Machine",
    roles: BASE_ROLES,
  },
  {
    name: "Production",
    icon: Package,
    to: "/production",
    eyebrow: "Production",
    title: "Production",
    roles: ["ADMIN"],
  },
  {
    name: "Maintenance",
    icon: Wrench,
    to: "/maintenance",
    eyebrow: "Maintenance",
    title: "Maintenance",
    roles: ["ADMIN"],
  },
  {
    name: "Camera",
    icon: Camera,
    to: "/admin/cameras",
    eyebrow: "Administration",
    title: "Cameras",
    roles: ["ADMIN"],
  },
  {
    name: "User Management",
    icon: Users,
    to: "/admin/users",
    eyebrow: "Administration",
    title: "Users",
    roles: ["ADMIN"],
  },
  {
    name: "Data Explorer",
    icon: Search,
    to: "/admin/explorer",
    eyebrow: "Administration",
    title: "Data explorer",
    roles: ["ADMIN"],
  },
  {
    name: "Audit Log",
    icon: ClipboardList,
    to: "/admin/logs",
    eyebrow: "Administration",
    title: "Audit log",
    roles: ["ADMIN"],
  },
  {
    name: "Profile",
    icon: User,
    to: "/profile",
    eyebrow: "Profile",
    title: "Profile",
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
