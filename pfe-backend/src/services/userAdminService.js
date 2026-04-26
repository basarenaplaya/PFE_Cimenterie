const bcrypt = require("bcrypt");
const { executeQuery } = require("../config/database");
const { env } = require("../config/environment");
const { HttpError } = require("../utils/httpError");
const { buildPaginationMeta } = require("../utils/pagination");
const { sanitizeFields } = require("../utils/sanitize");
const { logAuditAction } = require("./auditService");

function mapUser(user) {
  return {
    id: user.id,
    username: user.username,
    full_name: user.full_name,
    role: user.role,
    avatar_url: user.avatar_url,
    is_active: Boolean(user.is_active),
    created_at: user.created_at,
  };
}

async function findUserById(userId) {
  const rows = await executeQuery(
    "SELECT id, username, full_name, role, avatar_url, is_active, created_at FROM users WHERE id = ? LIMIT 1",
    [userId]
  );
  return rows[0] ? mapUser(rows[0]) : null;
}

async function createUser({ username, password, full_name, role, avatar_url, actor }) {
  const sanitized = sanitizeFields(
    { username, full_name, avatar_url: avatar_url || null },
    ["username", "full_name", "avatar_url"]
  );
  const normalizedUsername = sanitized.username.toLowerCase();

  const existing = await executeQuery("SELECT id FROM users WHERE username = ? LIMIT 1", [
    normalizedUsername,
  ]);
  if (existing.length > 0) {
    throw new HttpError(409, "Username already exists.");
  }

  const passwordHash = await bcrypt.hash(password, env.bcryptSaltRounds);

  const result = await executeQuery(
    "INSERT INTO users (username, password_hash, full_name, role, avatar_url) VALUES (?, ?, ?, ?, ?)",
    [
      normalizedUsername,
      passwordHash,
      sanitized.full_name,
      role,
      sanitized.avatar_url || "default_avatar.png",
    ]
  );

  const user = await findUserById(result.insertId);

  await logAuditAction({
    userId: actor.userId,
    action: `ADMIN_USER_CREATE target_user_id=${user.id} username=${user.username} role=${user.role}`,
    ipAddress: actor.ipAddress,
  });

  return user;
}

async function listUsers({ page = 1, limit = 20, search }) {
  const offset = (page - 1) * limit;
  const conditions = [];
  const params = [];

  if (search) {
    conditions.push("(username LIKE ? OR full_name LIKE ?)");
    const pattern = `%${search}%`;
    params.push(pattern, pattern);
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  const rows = await executeQuery(
    `SELECT id, username, full_name, role, avatar_url, is_active, created_at
     FROM users
     ${whereClause}
     ORDER BY created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );

  const count = await executeQuery(
    `SELECT COUNT(*) AS total FROM users ${whereClause}`,
    params
  );

  const totalItems = Number(count[0].total || 0);

  return {
    items: rows.map(mapUser),
    meta: buildPaginationMeta({
      page,
      limit,
      totalItems,
      itemCount: rows.length,
    }),
  };
}

async function updateUserStatus({ targetUserId, isActive, actor }) {
  if (Number(targetUserId) === Number(actor.userId)) {
    throw new HttpError(400, "Admin cannot change their own active status.");
  }

  const target = await findUserById(targetUserId);
  if (!target) {
    throw new HttpError(404, "User not found.");
  }

  await executeQuery("UPDATE users SET is_active = ? WHERE id = ?", [isActive, targetUserId]);

  await logAuditAction({
    userId: actor.userId,
    action: `ADMIN_USER_STATUS_UPDATE target_user_id=${targetUserId} is_active=${isActive}`,
    ipAddress: actor.ipAddress,
  });

  return findUserById(targetUserId);
}

async function updateUser({ targetUserId, payload, actor }) {
  const target = await findUserById(targetUserId);
  if (!target) {
    throw new HttpError(404, "User not found.");
  }

  if (Number(targetUserId) === Number(actor.userId)) {
    if (Object.prototype.hasOwnProperty.call(payload, "role")) {
      throw new HttpError(400, "Admin cannot change their own role.");
    }
    if (Object.prototype.hasOwnProperty.call(payload, "is_active")) {
      throw new HttpError(400, "Admin cannot change their own active status.");
    }
  }

  const updateFields = [];
  const updateValues = [];

  if (Object.prototype.hasOwnProperty.call(payload, "full_name")) {
    const sanitized = sanitizeFields({ full_name: payload.full_name }, ["full_name"]);
    updateFields.push("full_name = ?");
    updateValues.push(sanitized.full_name);
  }

  if (Object.prototype.hasOwnProperty.call(payload, "avatar_url")) {
    const sanitized = sanitizeFields({ avatar_url: payload.avatar_url }, ["avatar_url"]);
    updateFields.push("avatar_url = ?");
    updateValues.push(sanitized.avatar_url || "default_avatar.png");
  }

  if (Object.prototype.hasOwnProperty.call(payload, "role")) {
    updateFields.push("role = ?");
    updateValues.push(payload.role);
  }

  if (Object.prototype.hasOwnProperty.call(payload, "is_active")) {
    updateFields.push("is_active = ?");
    updateValues.push(payload.is_active);
  }

  if (updateFields.length === 0) {
    throw new HttpError(400, "No valid fields provided for update.");
  }

  await executeQuery(
    `UPDATE users SET ${updateFields.join(", ")} WHERE id = ?`,
    [...updateValues, targetUserId]
  );

  await logAuditAction({
    userId: actor.userId,
    action: `ADMIN_USER_UPDATE target_user_id=${targetUserId} fields=${updateFields
      .map((field) => field.split("=")[0].trim())
      .join(",")}`,
    ipAddress: actor.ipAddress,
  });

  return findUserById(targetUserId);
}

async function deleteUser({ targetUserId, actor }) {
  if (Number(targetUserId) === Number(actor.userId)) {
    throw new HttpError(400, "Admin cannot delete their own account.");
  }

  const target = await findUserById(targetUserId);
  if (!target) {
    throw new HttpError(404, "User not found.");
  }

  try {
    // Preserve historical records while allowing user deletion under FK constraints.
    await executeQuery("UPDATE cameras SET added_by = NULL WHERE added_by = ?", [targetUserId]);
    await executeQuery("UPDATE audit_logs SET user_id = NULL WHERE user_id = ?", [targetUserId]);
    await executeQuery("DELETE FROM users WHERE id = ?", [targetUserId]);
  } catch (error) {
    if (error && error.code === "ER_ROW_IS_REFERENCED_2") {
      throw new HttpError(
        409,
        "Cannot delete user because related records still reference this account."
      );
    }
    throw error;
  }

  await logAuditAction({
    userId: actor.userId,
    action: `ADMIN_USER_DELETE target_user_id=${targetUserId} username=${target.username}`,
    ipAddress: actor.ipAddress,
  });

  return target;
}

module.exports = {
  createUser,
  listUsers,
  findUserById,
  updateUser,
  updateUserStatus,
  deleteUser,
};
