import { useEffect, useMemo, useState } from "react"
import { LockKeyhole, Save, ShieldCheck, UserRound } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useAuth } from "@/hooks/useAuth"
import { useToast } from "@/hooks/useToast"
import { changeMyPassword, updateMyProfile } from "@/services/profileApi"

const passwordPolicy = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,128}$/

export default function ProfilePage() {
  const { user, updateUserInSession, refreshUser } = useAuth()
  const { success, error } = useToast()

  const [profileForm, setProfileForm] = useState({
    full_name: user?.full_name || "",
    avatar_url: user?.avatar_url && user.avatar_url !== "default_avatar.png" ? user.avatar_url : "",
  })
  const [passwordForm, setPasswordForm] = useState({
    current_password: "",
    new_password: "",
    confirm_password: "",
  })
  const [savingProfile, setSavingProfile] = useState(false)
  const [savingPassword, setSavingPassword] = useState(false)

  useEffect(() => {
    setProfileForm({
      full_name: user?.full_name || "",
      avatar_url: user?.avatar_url && user.avatar_url !== "default_avatar.png" ? user.avatar_url : "",
    })
  }, [user?.full_name, user?.avatar_url])

  const accountCreatedLabel = useMemo(() => {
    if (!user?.created_at) return "--"
    const parsed = new Date(user.created_at)
    if (Number.isNaN(parsed.getTime())) return "--"
    return parsed.toLocaleString()
  }, [user?.created_at])

  async function handleProfileSave(event) {
    event.preventDefault()

    const fullName = profileForm.full_name.trim()
    const avatar = profileForm.avatar_url.trim()

    if (fullName.length < 3) {
      error("Full name must be at least 3 characters.")
      return
    }

    setSavingProfile(true)

    try {
      const updatedUser = await updateMyProfile({
        full_name: fullName,
        avatar_url: avatar,
      })

      if (updatedUser) {
        updateUserInSession(updatedUser)
      } else {
        await refreshUser()
      }

      success("Profile updated successfully.")
    } catch (requestError) {
      error(requestError?.message || "Unable to update profile.")
    } finally {
      setSavingProfile(false)
    }
  }

  async function handlePasswordSave(event) {
    event.preventDefault()

    if (passwordForm.new_password !== passwordForm.confirm_password) {
      error("New password and confirmation do not match.")
      return
    }

    if (!passwordPolicy.test(passwordForm.new_password)) {
      error("Password must include uppercase, lowercase, number, and special character.")
      return
    }

    setSavingPassword(true)

    try {
      await changeMyPassword({
        current_password: passwordForm.current_password,
        new_password: passwordForm.new_password,
      })

      setPasswordForm({
        current_password: "",
        new_password: "",
        confirm_password: "",
      })

      success("Password changed successfully.")
    } catch (requestError) {
      error(requestError?.message || "Unable to change password.")
    } finally {
      setSavingPassword(false)
    }
  }

  return (
    <div className="space-y-6">
      <section className="dashboard-enter" style={{ animationDelay: "40ms" }}>
        <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-50">Profile</h2>
        <p className="text-sm text-slate-600 dark:text-slate-300">Name, avatar, password.</p>
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="xl:col-span-1 dashboard-enter" style={{ animationDelay: "120ms" }}>
          <Card className="h-full border-slate-200/80 bg-white/80 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-900/70">
            <CardHeader>
              <CardTitle className="text-base">Account Snapshot</CardTitle>
              <CardDescription>Realtime session identity details.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-600 dark:text-cyan-300">
                  <UserRound className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="truncate font-medium text-slate-900 dark:text-slate-100">{user?.full_name || "--"}</p>
                  <p className="truncate text-slate-500 dark:text-slate-400">{user?.username || "--"}</p>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-xs uppercase tracking-[0.15em] text-slate-500 dark:text-slate-400">Role</p>
                <p className="font-medium text-slate-800 dark:text-slate-200">{user?.role || "--"}</p>
              </div>

              <div className="space-y-2">
                <p className="text-xs uppercase tracking-[0.15em] text-slate-500 dark:text-slate-400">Account Created</p>
                <p className="font-medium text-slate-800 dark:text-slate-200">{accountCreatedLabel}</p>
              </div>

              <div className="space-y-2">
                <p className="text-xs uppercase tracking-[0.15em] text-slate-500 dark:text-slate-400">Status</p>
                <p className="font-medium text-slate-800 dark:text-slate-200">{user?.is_active ? "Active" : "Inactive"}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6 xl:col-span-2">
          <div className="dashboard-enter" style={{ animationDelay: "180ms" }}>
            <Card className="border-slate-200/80 bg-white/80 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-900/70">
              <CardHeader>
                <CardTitle className="text-base">Profile Details</CardTitle>
                <CardDescription>Name and avatar URL.</CardDescription>
              </CardHeader>
              <CardContent>
                <form className="space-y-4" onSubmit={handleProfileSave}>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-200">Full Name</label>
                    <Input
                      value={profileForm.full_name}
                      onChange={(event) =>
                        setProfileForm((prev) => ({ ...prev, full_name: event.target.value }))
                      }
                      placeholder="Your display name"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-200">Avatar URL</label>
                    <Input
                      value={profileForm.avatar_url}
                      onChange={(event) =>
                        setProfileForm((prev) => ({ ...prev, avatar_url: event.target.value }))
                      }
                      placeholder="https://example.com/avatar.png"
                    />
                  </div>

                  <div className="flex justify-end">
                    <Button type="submit" disabled={savingProfile}>
                      <Save className="h-4 w-4" />
                      {savingProfile ? "Saving..." : "Save Profile"}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </div>

          <div className="dashboard-enter" style={{ animationDelay: "230ms" }}>
            <Card className="border-slate-200/80 bg-white/80 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-900/70">
              <CardHeader>
                <CardTitle className="text-base">Credential Security</CardTitle>
                <CardDescription>8+ chars, upper, lower, number, symbol.</CardDescription>
              </CardHeader>
              <CardContent>
                <form className="space-y-4" onSubmit={handlePasswordSave}>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-200">Current Password</label>
                    <Input
                      type="password"
                      value={passwordForm.current_password}
                      onChange={(event) =>
                        setPasswordForm((prev) => ({ ...prev, current_password: event.target.value }))
                      }
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-200">New Password</label>
                    <Input
                      type="password"
                      value={passwordForm.new_password}
                      onChange={(event) =>
                        setPasswordForm((prev) => ({ ...prev, new_password: event.target.value }))
                      }
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-200">Confirm New Password</label>
                    <Input
                      type="password"
                      value={passwordForm.confirm_password}
                      onChange={(event) =>
                        setPasswordForm((prev) => ({ ...prev, confirm_password: event.target.value }))
                      }
                    />
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-300">
                    <div className="mb-1 flex items-center gap-1.5 font-medium text-slate-700 dark:text-slate-200">
                      <ShieldCheck className="h-3.5 w-3.5" />
                      Password policy
                    </div>
                    Must be 8-128 chars and include uppercase, lowercase, number, and special character.
                  </div>

                  <div className="flex justify-end">
                    <Button type="submit" disabled={savingPassword}>
                      <LockKeyhole className="h-4 w-4" />
                      {savingPassword ? "Updating..." : "Change Password"}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>
    </div>
  )
}
