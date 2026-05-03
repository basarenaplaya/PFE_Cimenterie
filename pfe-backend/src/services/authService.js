const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { executeQuery } = require("../config/database");
const { env } = require("../config/environment");
const { usersHasLastLoginAtColumn } = require("../config/usersTableSchema");
const { HttpError } = require("../utils/httpError");
const { sanitizeFields } = require("../utils/sanitize");

const PUBLIC_USER_BASE_FIELDS =
  "id, username, full_name, role, avatar_url, is_active, created_at";

function issueAccessToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      username: user.username,
      role: user.role,
    },
    env.jwtSecret,
    { expiresIn: env.jwtExpiresIn }
  );
}

function toPublicUser(user) {
  return {
    id: user.id,
    username: user.username,
    full_name: user.full_name,
    role: user.role,
    avatar_url: user.avatar_url,
    is_active: Boolean(user.is_active),
    created_at: user.created_at,
    last_login_at: user.last_login_at ?? null,
  };
}

async function writeAuditLog(userId, action, ipAddress) {
  try {
    await executeQuery(
      "INSERT INTO audit_logs (user_id, action, ip_address) VALUES (?, ?, ?)",
      [userId || null, action, ipAddress || null]
    );
  } catch (error) {
    if (env.nodeEnv !== "production") {
      console.warn("audit_logs write failed:", error.message);
    }
  }
}

async function findUserWithPasswordByUsername(username) {
  const users = await executeQuery(
    "SELECT id, username, password_hash, full_name, role, avatar_url, is_active, created_at FROM users WHERE username = ? LIMIT 1",
    [username]
  );

  return users[0] || null;
}

async function findPublicUserById(userId) {
  const hasLastLogin = await usersHasLastLoginAtColumn();
  const fields = hasLastLogin ? `${PUBLIC_USER_BASE_FIELDS}, last_login_at` : PUBLIC_USER_BASE_FIELDS;
  const users = await executeQuery(`SELECT ${fields} FROM users WHERE id = ? LIMIT 1`, [userId]);

  return users[0] ? toPublicUser(users[0]) : null;
}

async function findUserWithPasswordById(userId) {
  const users = await executeQuery(
    "SELECT id, username, password_hash, full_name, role, avatar_url, is_active, created_at FROM users WHERE id = ? LIMIT 1",
    [userId]
  );

  return users[0] || null;
}

async function registerUser({ username, password, full_name, role, ipAddress }) {
  const sanitized = sanitizeFields({ username, full_name }, ["username", "full_name"]);
  const normalizedUsername = sanitized.username.toLowerCase();
  const requestedRole = role || "OPERATOR";

  if (requestedRole === "ADMIN" && !env.allowAdminBootstrap) {
    throw new HttpError(
      403,
      "Admin bootstrap registration is disabled. Set ALLOW_ADMIN_BOOTSTRAP=true to enable it temporarily."
    );
  }

  const existingUser = await findUserWithPasswordByUsername(normalizedUsername);
  if (existingUser) {
    await writeAuditLog(existingUser.id, "AUTH_REGISTER_FAIL_DUPLICATE_USERNAME", ipAddress);
    throw new HttpError(409, "Username already exists.");
  }

  const passwordHash = await bcrypt.hash(password, env.bcryptSaltRounds);

  const insertResult = await executeQuery(
    "INSERT INTO users (username, password_hash, full_name, role) VALUES (?, ?, ?, ?)",
    [normalizedUsername, passwordHash, sanitized.full_name, requestedRole]
  );

  const user = await findPublicUserById(insertResult.insertId);
  await writeAuditLog(user.id, "AUTH_REGISTER_SUCCESS", ipAddress);

  return {
    user,
    token: issueAccessToken(user),
  };
}

async function loginUser({ username, password, ipAddress }) {
  const sanitized = sanitizeFields({ username }, ["username"]);
  const normalizedUsername = sanitized.username.toLowerCase();

  const user = await findUserWithPasswordByUsername(normalizedUsername);
  if (!user) {
    await writeAuditLog(null, `AUTH_LOGIN_FAIL_UNKNOWN_USER:${normalizedUsername}`, ipAddress);
    throw new HttpError(401, "Invalid username or password.");
  }

  if (!user.is_active) {
    await writeAuditLog(user.id, "AUTH_LOGIN_FAIL_INACTIVE", ipAddress);
    throw new HttpError(403, "User account is inactive.");
  }

  const isPasswordValid = await bcrypt.compare(password, user.password_hash);
  if (!isPasswordValid) {
    await writeAuditLog(user.id, "AUTH_LOGIN_FAIL_BAD_PASSWORD", ipAddress);
    throw new HttpError(401, "Invalid username or password.");
  }

  await writeAuditLog(user.id, "AUTH_LOGIN_SUCCESS", ipAddress);

  if (await usersHasLastLoginAtColumn()) {
    await executeQuery("UPDATE users SET last_login_at = UTC_TIMESTAMP(3) WHERE id = ?", [user.id]);
  }

  const publicUser = await findPublicUserById(user.id);

  return {
    user: publicUser,
    token: issueAccessToken(publicUser),
  };
}

async function getAuthenticatedUser(userId) {
  const user = await findPublicUserById(userId);
  if (!user) {
    throw new HttpError(404, "User not found.");
  }

  return user;
}

async function updateAuthenticatedUserProfile({ userId, full_name, avatar_url, ipAddress }) {
  const target = await findPublicUserById(userId);
  if (!target) {
    throw new HttpError(404, "User not found.");
  }

  const sanitized = sanitizeFields(
    {
      full_name,
      avatar_url,
    },
    ["full_name", "avatar_url"]
  );

  await executeQuery("UPDATE users SET full_name = ?, avatar_url = ? WHERE id = ?", [
    sanitized.full_name,
    sanitized.avatar_url || "default_avatar.png",
    userId,
  ]);

  await writeAuditLog(userId, "AUTH_PROFILE_UPDATE", ipAddress);
  return findPublicUserById(userId);
}

async function updateAuthenticatedUserPassword({
  userId,
  current_password,
  new_password,
  ipAddress,
}) {
  const target = await findUserWithPasswordById(userId);

  if (!target) {
    throw new HttpError(404, "User not found.");
  }

  const isCurrentPasswordValid = await bcrypt.compare(current_password, target.password_hash);
  if (!isCurrentPasswordValid) {
    await writeAuditLog(userId, "AUTH_PASSWORD_CHANGE_FAIL_BAD_CURRENT", ipAddress);
    throw new HttpError(401, "Current password is incorrect.");
  }

  const isSameAsCurrent = await bcrypt.compare(new_password, target.password_hash);
  if (isSameAsCurrent) {
    throw new HttpError(400, "New password must be different from the current password.");
  }

  const passwordHash = await bcrypt.hash(new_password, env.bcryptSaltRounds);

  await executeQuery("UPDATE users SET password_hash = ? WHERE id = ?", [passwordHash, userId]);
  await writeAuditLog(userId, "AUTH_PASSWORD_CHANGE_SUCCESS", ipAddress);

  return true;
}

module.exports = {
  registerUser,
  loginUser,
  getAuthenticatedUser,
  updateAuthenticatedUserProfile,
  updateAuthenticatedUserPassword,
};
