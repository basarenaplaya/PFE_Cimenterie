import { useCallback, useEffect, useMemo, useState } from "react"
import { api, setApiAuthToken, setApiUnauthorizedHandler } from "@/lib/api"
import { AuthContext } from "@/contexts/auth-context"

const TOKEN_STORAGE_KEY = "pfe.auth.token"

function normalizeRoleValue(role) {
  if (typeof role !== "string") return role || null
  const normalized = role.trim().toUpperCase()
  if (normalized === "ADMIN" || normalized === "OPERATOR") {
    return normalized
  }

  return normalized || null
}

function normalizeUserRole(user) {
  if (!user || typeof user !== "object") return user

  return {
    ...user,
    role: normalizeRoleValue(user.role),
  }
}

function extractUserFromResponse(payload) {
  if (!payload || typeof payload !== "object") return null
  if (payload.user) return normalizeUserRole(payload.user)
  if (payload.data && payload.data.user) return normalizeUserRole(payload.data.user)
  if (payload.data && payload.data.id && payload.data.username) return normalizeUserRole(payload.data)
  if (payload.id && payload.username) return normalizeUserRole(payload)
  return null
}

function extractLoginPayload(payload) {
  if (!payload || typeof payload !== "object") return { token: null, user: null }

  const data = payload.data && typeof payload.data === "object" ? payload.data : payload
  return {
    token: data.token || null,
    user: normalizeUserRole(data.user || null),
  }
}

export function AuthProvider({ children }) {
  const [token, setToken] = useState(null)
  const [user, setUser] = useState(null)
  const [isLoading, setIsLoading] = useState(true)

  const clearSession = useCallback(() => {
    setToken(null)
    setUser(null)
    sessionStorage.removeItem(TOKEN_STORAGE_KEY)
    setApiAuthToken(null)
  }, [])

  const hydrateUser = useCallback(
    async (sessionToken) => {
      try {
        const response = await api.get("/api/auth/me", { token: sessionToken })
        const resolvedUser = extractUserFromResponse(response)

        if (!resolvedUser) {
          clearSession()
          return null
        }

        setUser(resolvedUser)
        return resolvedUser
      } catch {
        clearSession()
        return null
      }
    },
    [clearSession]
  )

  useEffect(() => {
    let isMounted = true

    async function bootstrapAuth() {
      const storedToken = sessionStorage.getItem(TOKEN_STORAGE_KEY)

      if (!storedToken) {
        if (isMounted) setIsLoading(false)
        return
      }

      setToken(storedToken)
      setApiAuthToken(storedToken)

      await hydrateUser(storedToken)

      if (isMounted) setIsLoading(false)
    }

    bootstrapAuth()

    return () => {
      isMounted = false
    }
  }, [hydrateUser])

  useEffect(() => {
    setApiAuthToken(token)
  }, [token])

  useEffect(() => {
    setApiUnauthorizedHandler(() => {
      clearSession()
      setIsLoading(false)
    })

    return () => {
      setApiUnauthorizedHandler(null)
    }
  }, [clearSession])

  const login = useCallback(
    async ({ username, password }) => {
      const response = await api.post("/api/auth/login", {
        username,
        password,
      })

      const { token: loginToken, user: loginUser } = extractLoginPayload(response)

      if (!loginToken) {
        throw new Error("Authentication token missing from server response.")
      }

      setToken(loginToken)
      setApiAuthToken(loginToken)
      sessionStorage.setItem(TOKEN_STORAGE_KEY, loginToken)

      if (loginUser) {
        setUser(loginUser)
        return loginUser
      }

      const hydrated = await hydrateUser(loginToken)
      if (!hydrated) {
        throw new Error("Unable to restore user session after login.")
      }

      return hydrated
    },
    [hydrateUser]
  )

  const logout = useCallback(() => {
    clearSession()
    setIsLoading(false)
  }, [clearSession])

  const refreshUser = useCallback(async () => {
    if (!token) return null
    return hydrateUser(token)
  }, [token, hydrateUser])

  const updateUserInSession = useCallback((nextUser) => {
    if (!nextUser || typeof nextUser !== "object") return null
    const normalizedUser = normalizeUserRole(nextUser)
    setUser(normalizedUser)
    return normalizedUser
  }, [])

  const value = useMemo(
    () => ({
      user,
      token,
      role: user?.role || null,
      isAuthenticated: Boolean(token && user),
      isLoading,
      login,
      logout,
      refreshUser,
      updateUserInSession,
    }),
    [user, token, isLoading, login, logout, refreshUser, updateUserInSession]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
