import { Link } from "react-router-dom"
import { ShieldAlert } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function UnauthorizedPage() {
  return (
    <div className="grid min-h-screen place-items-center bg-slate-100 px-4 py-10 dark:bg-slate-950">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white/80 p-8 text-center shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-900/70">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300">
          <ShieldAlert className="h-6 w-6" />
        </div>
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-50">Access Restricted</h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">You don&apos;t have access to this page.</p>
        <Button asChild className="mt-6 w-full">
          <Link to="/overview">Return to Overview</Link>
        </Button>
      </div>
    </div>
  )
}
