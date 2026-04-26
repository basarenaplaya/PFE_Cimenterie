import { api } from "@/lib/api"

function resolveData(payload) {
  if (!payload || typeof payload !== "object") return {}
  return payload.data && typeof payload.data === "object" ? payload.data : {}
}

export async function getMyProfile() {
  const payload = await api.get("/api/auth/me")
  const data = resolveData(payload)
  return data.user || null
}

export async function updateMyProfile({ full_name, avatar_url }) {
  const payload = await api.put("/api/auth/me", {
    full_name,
    avatar_url,
  })
  const data = resolveData(payload)
  return data.user || null
}

export async function changeMyPassword({ current_password, new_password }) {
  await api.put("/api/auth/password", {
    current_password,
    new_password,
  })
}
