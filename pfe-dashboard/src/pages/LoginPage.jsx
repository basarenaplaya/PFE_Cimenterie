import { useEffect, useMemo, useState } from "react"
import { motion, useReducedMotion } from "framer-motion"
import { Activity, LockKeyhole, ShieldCheck, UserRound } from "lucide-react"
import { useLocation, useNavigate } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { useAuth } from "@/hooks/useAuth"

function validateCredentials({ username, password }) {
  const errors = {}

  const normalizedUsername = username.trim()
  if (!normalizedUsername) {
    errors.username = "Username is required."
  } else if (normalizedUsername.length < 3) {
    errors.username = "Username must contain at least 3 characters."
  }

  if (!password) {
    errors.password = "Password is required."
  } else if (password.length < 8) {
    errors.password = "Password must contain at least 8 characters."
  }

  return {
    errors,
    normalizedUsername,
  }
}

export default function LoginPage() {
  const reduceMotion = useReducedMotion()
  const navigate = useNavigate()
  const location = useLocation()
  const { login, isAuthenticated, isLoading } = useAuth()

  const [form, setForm] = useState({ username: "", password: "" })
  const [fieldErrors, setFieldErrors] = useState({})
  const [submitError, setSubmitError] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  const redirectPath = useMemo(
    () => location.state?.from?.pathname || "/overview",
    [location.state]
  )

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      navigate(redirectPath, { replace: true })
    }
  }, [isAuthenticated, isLoading, navigate, redirectPath])

  const cardMotion = reduceMotion
    ? {}
    : {
        initial: { opacity: 0, y: 18, scale: 0.98 },
        animate: { opacity: 1, y: 0, scale: 1 },
        transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] },
      }

  const badgeMotion = reduceMotion
    ? {}
    : {
        initial: { opacity: 0, y: -8 },
        animate: { opacity: 1, y: 0 },
        transition: { duration: 0.45, delay: 0.08, ease: "easeOut" },
      }

  const MotionDiv = motion.div

  async function handleSubmit(event) {
    event.preventDefault()
    setSubmitError("")

    const { errors, normalizedUsername } = validateCredentials(form)
    setFieldErrors(errors)

    if (Object.keys(errors).length > 0) {
      return
    }

    setIsSubmitting(true)
    try {
      await login({
        username: normalizedUsername,
        password: form.password,
      })

      navigate(redirectPath, { replace: true })
    } catch (error) {
      setSubmitError(error?.message || "Unable to sign in right now.")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-100 px-4 py-10 dark:bg-slate-950 sm:px-6 lg:px-8">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-[-12%] top-[-25%] h-[34rem] w-[34rem] rounded-full bg-cyan-300/25 blur-3xl dark:bg-cyan-500/18" />
        <div className="absolute bottom-[-28%] right-[-16%] h-[38rem] w-[38rem] rounded-full bg-indigo-300/20 blur-3xl dark:bg-blue-500/20" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.52)_0%,rgba(255,255,255,0)_45%),radial-gradient(circle_at_78%_0%,rgba(125,211,252,0.22)_0%,rgba(255,255,255,0)_33%)] dark:bg-[radial-gradient(circle_at_18%_22%,rgba(14,165,233,0.2)_0%,rgba(2,6,23,0)_48%),radial-gradient(circle_at_82%_8%,rgba(59,130,246,0.22)_0%,rgba(2,6,23,0)_35%)]" />
      </div>

      <div className="relative mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-md flex-col items-center justify-center">
        <MotionDiv
          {...badgeMotion}
          className="mb-5 inline-flex items-center gap-2 rounded-full border border-slate-200/80 bg-white/80 px-3 py-1.5 text-xs font-medium tracking-wide text-slate-600 shadow-sm backdrop-blur dark:border-slate-700/70 dark:bg-slate-900/75 dark:text-slate-300"
        >
          <ShieldCheck className="h-3.5 w-3.5 text-cyan-600 dark:text-cyan-300" />
          Secure Access Gateway
        </MotionDiv>

        <MotionDiv {...cardMotion} className="w-full">
          <Card className="border-slate-200/80 bg-white/85 shadow-xl backdrop-blur-xl dark:border-slate-800 dark:bg-slate-900/80">
            <CardHeader className="space-y-3 pb-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-600 text-white shadow-sm shadow-cyan-500/30">
                  <Activity className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle className="text-xl text-slate-900 dark:text-slate-50">Packer SCADA</CardTitle>
                  <CardDescription className="text-slate-600 dark:text-slate-300">
                    Authenticate to access live industrial operations.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>

            <CardContent>
              <form className="space-y-4" onSubmit={handleSubmit} noValidate>
                <div className="space-y-1.5">
                  <label htmlFor="username" className="text-sm font-medium text-slate-700 dark:text-slate-200">
                    Username
                  </label>
                  <div className="relative">
                    <UserRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <Input
                      id="username"
                      autoComplete="username"
                      placeholder="operator.shift-a"
                      value={form.username}
                      onChange={(event) => setForm((prev) => ({ ...prev, username: event.target.value }))}
                      className="pl-10"
                      aria-invalid={Boolean(fieldErrors.username)}
                    />
                  </div>
                  {fieldErrors.username ? (
                    <p className="text-xs font-medium text-rose-600 dark:text-rose-400">{fieldErrors.username}</p>
                  ) : null}
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="password" className="text-sm font-medium text-slate-700 dark:text-slate-200">
                    Password
                  </label>
                  <div className="relative">
                    <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <Input
                      id="password"
                      type="password"
                      autoComplete="current-password"
                      placeholder="Enter your password"
                      value={form.password}
                      onChange={(event) => setForm((prev) => ({ ...prev, password: event.target.value }))}
                      className="pl-10"
                      aria-invalid={Boolean(fieldErrors.password)}
                    />
                  </div>
                  {fieldErrors.password ? (
                    <p className="text-xs font-medium text-rose-600 dark:text-rose-400">{fieldErrors.password}</p>
                  ) : null}
                </div>

                {submitError ? (
                  <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-900/40 dark:bg-rose-900/20 dark:text-rose-300">
                    {submitError}
                  </div>
                ) : null}

                <Button type="submit" className="h-10 w-full" disabled={isSubmitting || isLoading}>
                  {isSubmitting ? "Authenticating..." : "Sign in securely"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </MotionDiv>
      </div>
    </div>
  )
}
