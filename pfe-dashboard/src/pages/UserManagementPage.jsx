import { useCallback, useEffect, useMemo, useState } from "react"
import {
  MoreHorizontal,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Trash2,
  UserRoundCog,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useAuth } from "@/hooks/useAuth"
import { useToast } from "@/hooks/useToast"
import {
  createAdminUser,
  deleteAdminUser,
  listAdminUsers,
  setAdminUserStatus,
  updateAdminUser,
} from "@/services/adminApi"

const passwordPolicy = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,128}$/

const initialCreateForm = {
  username: "",
  full_name: "",
  password: "",
  role: "OPERATOR",
  avatar_url: "",
}

const initialEditForm = {
  full_name: "",
  role: "OPERATOR",
  avatar_url: "",
}

function formatDateTime(value) {
  if (!value) return "--"
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return "--"
  return parsed.toLocaleString()
}

export default function UserManagementPage() {
  const { user: sessionUser } = useAuth()
  const { success, error } = useToast()

  const [users, setUsers] = useState([])
  const [meta, setMeta] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isMutating, setIsMutating] = useState(false)
  const [loadError, setLoadError] = useState("")

  const [page, setPage] = useState(1)
  const [searchInput, setSearchInput] = useState("")
  const [search, setSearch] = useState("")

  const [createOpen, setCreateOpen] = useState(false)
  const [createForm, setCreateForm] = useState(initialCreateForm)

  const [editTarget, setEditTarget] = useState(null)
  const [editForm, setEditForm] = useState(initialEditForm)

  const [deleteTarget, setDeleteTarget] = useState(null)

  const limit = 10
  const totalItems = Number(meta?.totalItems || 0)
  const totalPages = Number(meta?.totalPages || 0)
  const hasPrevPage = Boolean(meta?.hasPrevPage)
  const hasNextPage = Boolean(meta?.hasNextPage)

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setPage(1)
      setSearch(searchInput.trim())
    }, 260)

    return () => window.clearTimeout(timer)
  }, [searchInput])

  const fetchUsers = useCallback(
    async ({ pageOverride, loadingMode = "full" } = {}) => {
      const targetPage = pageOverride || page

      if (loadingMode === "full") {
        setIsLoading(true)
      } else {
        setIsRefreshing(true)
      }

      try {
        const payload = await listAdminUsers({
          page: targetPage,
          limit,
          search,
        })

        const nextItems = Array.isArray(payload.items) ? payload.items : []
        const nextMeta = payload.meta || null

        if (nextMeta && nextMeta.totalPages > 0 && targetPage > nextMeta.totalPages) {
          setPage(nextMeta.totalPages)
          return
        }

        setUsers(nextItems)
        setMeta(nextMeta)
        setLoadError("")
      } catch (requestError) {
        const message = requestError?.message || "Failed to load users."
        setLoadError(message)
        error(message)
      } finally {
        setIsLoading(false)
        setIsRefreshing(false)
      }
    },
    [error, limit, page, search]
  )

  useEffect(() => {
    fetchUsers({ loadingMode: "full" })
  }, [fetchUsers])

  useEffect(() => {
    const id = window.setInterval(() => {
      void fetchUsers({ loadingMode: "soft" })
    }, 12000)
    return () => window.clearInterval(id)
  }, [fetchUsers])

  const selectedUserLabel = useMemo(() => {
    if (!deleteTarget) return ""
    return deleteTarget.full_name || deleteTarget.username || `User #${deleteTarget.id}`
  }, [deleteTarget])

  function openEditDialog(target) {
    setEditTarget(target)
    setEditForm({
      full_name: target.full_name || "",
      role: target.role || "OPERATOR",
      avatar_url:
        target.avatar_url && target.avatar_url !== "default_avatar.png" ? target.avatar_url : "",
    })
  }

  function resetCreateForm() {
    setCreateForm(initialCreateForm)
  }

  async function handleCreateUser(event) {
    event.preventDefault()

    const username = createForm.username.trim().toLowerCase()
    const fullName = createForm.full_name.trim()
    const avatarUrl = createForm.avatar_url.trim()

    if (username.length < 3) {
      error("Username must be at least 3 characters.")
      return
    }

    if (fullName.length < 3) {
      error("Full name must be at least 3 characters.")
      return
    }

    if (!passwordPolicy.test(createForm.password)) {
      error("Password policy is not satisfied.")
      return
    }

    setIsMutating(true)

    try {
      await createAdminUser({
        username,
        full_name: fullName,
        password: createForm.password,
        role: createForm.role,
        avatar_url: avatarUrl,
      })

      success("User created successfully.")
      setCreateOpen(false)
      resetCreateForm()
      setPage(1)
      await fetchUsers({ pageOverride: 1, loadingMode: "soft" })
    } catch (requestError) {
      error(requestError?.message || "Failed to create user.")
    } finally {
      setIsMutating(false)
    }
  }

  async function handleUpdateUser(event) {
    event.preventDefault()
    if (!editTarget) return

    const fullName = editForm.full_name.trim()
    if (fullName.length < 3) {
      error("Full name must be at least 3 characters.")
      return
    }

    setIsMutating(true)

    try {
      await updateAdminUser(editTarget.id, {
        full_name: fullName,
        role: editForm.role,
        avatar_url: editForm.avatar_url.trim(),
      })

      success("User updated successfully.")
      setEditTarget(null)
      await fetchUsers({ loadingMode: "soft" })
    } catch (requestError) {
      error(requestError?.message || "Failed to update user.")
    } finally {
      setIsMutating(false)
    }
  }

  async function handleToggleStatus(targetUser) {
    const nextStatus = !targetUser.is_active
    setIsMutating(true)

    try {
      await setAdminUserStatus(targetUser.id, nextStatus)
      success(`User ${nextStatus ? "activated" : "deactivated"}.`)
      await fetchUsers({ loadingMode: "soft" })
    } catch (requestError) {
      error(requestError?.message || "Failed to update account status.")
    } finally {
      setIsMutating(false)
    }
  }

  async function handleDeleteUser() {
    if (!deleteTarget) return
    setIsMutating(true)

    try {
      await deleteAdminUser(deleteTarget.id)
      success("User deleted successfully.")
      setDeleteTarget(null)

      const isLastItemOnPage = users.length <= 1 && page > 1
      const nextPage = isLastItemOnPage ? page - 1 : page
      setPage(nextPage)
      await fetchUsers({ pageOverride: nextPage, loadingMode: "soft" })
    } catch (requestError) {
      error(requestError?.message || "Failed to delete user.")
    } finally {
      setIsMutating(false)
    }
  }

  function renderBody() {
    if (isLoading) {
      return (
        <div className="grid min-h-[20vh] place-items-center text-sm text-slate-600 dark:text-slate-300">
          Loading users...
        </div>
      )
    }

    if (users.length === 0) {
      return (
        <div className="grid min-h-[20vh] place-items-center text-center">
          <div>
            <p className="text-sm font-medium text-slate-700 dark:text-slate-200">No users found.</p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Try changing the search term or create a new user account.
            </p>
          </div>
        </div>
      )
    }

    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>User</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Last in</TableHead>
            <TableHead>Created</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.map((row) => {
            const isSelf = Number(sessionUser?.id) === Number(row.id)

            return (
              <TableRow key={row.id}>
                <TableCell className="max-w-[16rem]">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-slate-800 dark:text-slate-100">{row.full_name}</p>
                    <p className="truncate text-xs text-slate-500 dark:text-slate-400">{row.username}</p>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge
                    variant={row.role === "ADMIN" ? "default" : "secondary"}
                    className="gap-1.5"
                  >
                    <ShieldCheck className="h-3 w-3" />
                    {row.role}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge
                    variant={row.is_active ? "secondary" : "destructive"}
                    className={row.is_active ? "text-emerald-700 dark:text-emerald-300" : ""}
                  >
                    {row.is_active ? "Active" : "Inactive"}
                  </Badge>
                </TableCell>
                <TableCell className="text-xs">
                  {row.dashboard_online ? (
                    <Badge variant="outline" className="border-emerald-500/50 text-emerald-800 dark:text-emerald-200">
                      Online
                    </Badge>
                  ) : (
                    <span className="text-slate-500 dark:text-slate-400">
                      {row.last_login_at ? formatDateTime(row.last_login_at) : "—"}
                    </span>
                  )}
                </TableCell>
                <TableCell className="text-xs text-slate-500 dark:text-slate-400">
                  {formatDateTime(row.created_at)}
                </TableCell>
                <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button size="icon-sm" variant="outline" disabled={isMutating}>
                        <MoreHorizontal className="h-4 w-4" />
                        <span className="sr-only">Open actions</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-44">
                      <DropdownMenuItem onClick={() => openEditDialog(row)}>
                        <UserRoundCog className="h-4 w-4" />
                        Edit user
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => handleToggleStatus(row)}
                        disabled={isSelf}
                      >
                        {row.is_active ? "Deactivate account" : "Activate account"}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        variant="destructive"
                        onClick={() => setDeleteTarget(row)}
                        disabled={isSelf}
                      >
                        <Trash2 className="h-4 w-4" />
                        Delete user
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    )
  }

  return (
    <div className="space-y-6">
      <section className="dashboard-enter" style={{ animationDelay: "40ms" }}>
        <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-50">User Management</h2>
        <p className="text-sm text-slate-600 dark:text-slate-300">Users and roles.</p>
      </section>

      <Card
        className="dashboard-enter border-slate-200/80 bg-white/80 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-900/70"
        style={{ animationDelay: "120ms" }}
      >
        <CardHeader className="gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <CardTitle className="text-base">Accounts</CardTitle>
            <CardDescription>
              {totalItems} user{totalItems === 1 ? "" : "s"}
              {search ? ` · "${search}"` : ""}.
            </CardDescription>
          </div>

          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
            <div className="relative w-full sm:w-64">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="Search by name or username"
                className="pl-10"
              />
            </div>

            <Button
              variant="outline"
              onClick={() => fetchUsers({ loadingMode: "soft" })}
              disabled={isRefreshing || isMutating}
            >
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
              Refresh
            </Button>

            <Button
              onClick={() => {
                resetCreateForm()
                setCreateOpen(true)
              }}
              disabled={isMutating}
            >
              <Plus className="h-4 w-4" />
              Add User
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">{renderBody()}</CardContent>

        {loadError ? (
          <div className="border-t border-amber-200/80 bg-amber-50/80 px-6 py-3 text-xs font-medium text-amber-700 dark:border-amber-800/70 dark:bg-amber-900/20 dark:text-amber-300">
            Data load warning: {loadError}
          </div>
        ) : null}

        <div className="flex items-center justify-between border-t border-slate-200/80 px-6 py-4 text-sm dark:border-slate-800">
          <p className="text-slate-500 dark:text-slate-400">
            Page {meta?.page || 1} of {Math.max(totalPages, 1)}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              disabled={!hasPrevPage || isLoading || isMutating}
              onClick={() => setPage((prev) => Math.max(prev - 1, 1))}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              disabled={!hasNextPage || isLoading || isMutating}
              onClick={() => setPage((prev) => prev + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      </Card>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create User</DialogTitle>
            <DialogDescription>New user, role, password.</DialogDescription>
          </DialogHeader>

          <form className="space-y-3" onSubmit={handleCreateUser}>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-200">Username</label>
              <Input
                value={createForm.username}
                onChange={(event) =>
                  setCreateForm((prev) => ({ ...prev, username: event.target.value }))
                }
                placeholder="operator.shift-a"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-200">Full Name</label>
              <Input
                value={createForm.full_name}
                onChange={(event) =>
                  setCreateForm((prev) => ({ ...prev, full_name: event.target.value }))
                }
                placeholder="Operator Name"
              />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-200">Role</label>
                <Select
                  value={createForm.role}
                  onValueChange={(value) => setCreateForm((prev) => ({ ...prev, role: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="OPERATOR">OPERATOR</SelectItem>
                    <SelectItem value="ADMIN">ADMIN</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-200">Password</label>
                <Input
                  type="password"
                  value={createForm.password}
                  onChange={(event) =>
                    setCreateForm((prev) => ({ ...prev, password: event.target.value }))
                  }
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-200">Avatar URL</label>
              <Input
                value={createForm.avatar_url}
                onChange={(event) =>
                  setCreateForm((prev) => ({ ...prev, avatar_url: event.target.value }))
                }
                placeholder="https://example.com/avatar.png"
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setCreateOpen(false)}
                disabled={isMutating}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isMutating}>
                {isMutating ? "Creating..." : "Create User"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(editTarget)} onOpenChange={(open) => !open && setEditTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription>Name, role, avatar.</DialogDescription>
          </DialogHeader>

          <form className="space-y-3" onSubmit={handleUpdateUser}>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-200">Full Name</label>
              <Input
                value={editForm.full_name}
                onChange={(event) => setEditForm((prev) => ({ ...prev, full_name: event.target.value }))}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-200">Role</label>
              <Select
                value={editForm.role}
                onValueChange={(value) => setEditForm((prev) => ({ ...prev, role: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="OPERATOR">OPERATOR</SelectItem>
                  <SelectItem value="ADMIN">ADMIN</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-200">Avatar URL</label>
              <Input
                value={editForm.avatar_url}
                onChange={(event) => setEditForm((prev) => ({ ...prev, avatar_url: event.target.value }))}
                placeholder="https://example.com/avatar.png"
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditTarget(null)}
                disabled={isMutating}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isMutating}>
                {isMutating ? "Saving..." : "Save Changes"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete User</DialogTitle>
            <DialogDescription>Permanent — they won&apos;t be able to sign in again.</DialogDescription>
          </DialogHeader>

          <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-900/40 dark:bg-rose-900/20 dark:text-rose-300">
            You are deleting {selectedUserLabel}.
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeleteTarget(null)}
              disabled={isMutating}
            >
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteUser} disabled={isMutating}>
              {isMutating ? "Deleting..." : "Delete User"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
