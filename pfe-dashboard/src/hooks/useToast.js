import { useCallback, useMemo } from "react"
import { toast } from "sonner"

function normalizeMessage(input, fallback) {
  if (typeof input === "string" && input.trim().length > 0) {
    return input.trim()
  }

  if (input instanceof Error && typeof input.message === "string" && input.message.trim().length > 0) {
    return input.message.trim()
  }

  if (input && typeof input === "object") {
    if (typeof input.message === "string" && input.message.trim().length > 0) {
      return input.message.trim()
    }

    if (typeof input.error === "string" && input.error.trim().length > 0) {
      return input.error.trim()
    }

    if (input.error && typeof input.error === "object" && typeof input.error.message === "string") {
      const nested = input.error.message.trim()
      if (nested.length > 0) return nested
    }
  }

  return fallback
}

export function useToast() {
  const success = useCallback(
    (message, options) => toast.success(normalizeMessage(message, "Action completed."), options),
    []
  )

  const error = useCallback(
    (message, options) => toast.error(normalizeMessage(message, "Something went wrong."), options),
    []
  )

  const info = useCallback(
    (message, options) => toast(normalizeMessage(message, "Notification."), options),
    []
  )

  return useMemo(
    () => ({
      toast,
      success,
      error,
      info,
    }),
    [success, error, info]
  )
}
