/** In-memory dashboard socket counts per user (single Node process). */

const counts = new Map()

function registerUserSocket(userId) {
  const id = Number(userId)
  if (!Number.isFinite(id) || id <= 0) return
  counts.set(id, (counts.get(id) || 0) + 1)
}

function unregisterUserSocket(userId) {
  const id = Number(userId)
  if (!Number.isFinite(id) || id <= 0) return
  const next = (counts.get(id) || 0) - 1
  if (next <= 0) {
    counts.delete(id)
  } else {
    counts.set(id, next)
  }
}

function isUserOnline(userId) {
  const id = Number(userId)
  if (!Number.isFinite(id) || id <= 0) return false
  return (counts.get(id) || 0) > 0
}

/** @returns {Set<number>} */
function getOnlineUserIdSet() {
  const set = new Set()
  for (const [id, n] of counts.entries()) {
    if (n > 0) set.add(id)
  }
  return set
}

module.exports = {
  registerUserSocket,
  unregisterUserSocket,
  isUserOnline,
  getOnlineUserIdSet,
}
