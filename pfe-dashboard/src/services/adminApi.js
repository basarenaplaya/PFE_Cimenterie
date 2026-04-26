import { api } from "@/lib/api"

function resolvePayload(payload) {
  if (!payload || typeof payload !== "object") {
    return { data: {}, meta: undefined }
  }

  return {
    data: payload.data && typeof payload.data === "object" ? payload.data : {},
    meta: payload.meta,
  }
}

function buildQuery(params) {
  const searchParams = new URLSearchParams()

  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return
    searchParams.set(key, String(value))
  })

  const queryString = searchParams.toString()
  return queryString.length > 0 ? `?${queryString}` : ""
}

export async function listAdminUsers({ page = 1, limit = 20, search = "" } = {}) {
  const payload = await api.get(`/api/admin/users${buildQuery({ page, limit, search })}`)
  const { data, meta } = resolvePayload(payload)

  return {
    items: Array.isArray(data.items) ? data.items : [],
    meta,
  }
}

export async function createAdminUser(input) {
  const payload = await api.post("/api/admin/users", input)
  const { data } = resolvePayload(payload)
  return data.user || null
}

export async function updateAdminUser(userId, input) {
  const payload = await api.put(`/api/admin/users/${userId}`, input)
  const { data } = resolvePayload(payload)
  return data.user || null
}

export async function setAdminUserStatus(userId, isActive) {
  const payload = await api.put(`/api/admin/users/${userId}/status`, {
    is_active: Boolean(isActive),
  })
  const { data } = resolvePayload(payload)
  return data.user || null
}

export async function deleteAdminUser(userId) {
  const payload = await api.delete(`/api/admin/users/${userId}`)
  const { data } = resolvePayload(payload)
  return Boolean(data.deleted)
}

export async function listCameras({ page = 1, limit = 20, search = "", include_snapshots = false } = {}) {
  const payload = await api.get(
    `/api/admin/cameras${buildQuery({
      page,
      limit,
      search,
      ...(include_snapshots ? { include_snapshots: true } : {}),
    })}`
  )
  const { data, meta } = resolvePayload(payload)

  return {
    items: Array.isArray(data.items) ? data.items : [],
    meta,
  }
}

export async function createCamera(input) {
  const payload = await api.post("/api/admin/cameras", input)
  const { data } = resolvePayload(payload)
  return data.camera || null
}

export async function updateCamera(cameraId, input) {
  const payload = await api.put(`/api/admin/cameras/${cameraId}`, input)
  const { data } = resolvePayload(payload)
  return data.camera || null
}

export async function patchCameraSnapshot(cameraId, input) {
  const payload = await api.patch(`/api/admin/cameras/${cameraId}/snapshot`, input)
  const { data } = resolvePayload(payload)
  return data.camera || null
}

export async function deleteCamera(cameraId) {
  const payload = await api.delete(`/api/admin/cameras/${cameraId}`)
  const { data } = resolvePayload(payload)
  return Boolean(data.deleted)
}

export async function listAuditLogs({ page = 1, limit = 20, action = "", userId } = {}) {
  const payload = await api.get(
    `/api/admin/audit-logs${buildQuery({ page, limit, action, user_id: userId })}`
  )
  const { data, meta } = resolvePayload(payload)

  return {
    items: Array.isArray(data.items) ? data.items : [],
    meta,
  }
}
