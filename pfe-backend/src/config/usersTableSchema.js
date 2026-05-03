const { executeQuery } = require("./database");

/** @type {boolean | null} */
let usersLastLoginAtResolved = null;
let warnedMissingLastLoginAt = false;

/**
 * Whether `users.last_login_at` exists (cached for process lifetime).
 * Lets the API run before migration 003 is applied; run the migration for full behavior.
 */
async function usersHasLastLoginAtColumn() {
  if (usersLastLoginAtResolved !== null) {
    return usersLastLoginAtResolved;
  }

  try {
    const rows = await executeQuery(
      `SELECT COUNT(*) AS cnt FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'users'
         AND COLUMN_NAME = 'last_login_at'`,
      []
    );
    usersLastLoginAtResolved = Number(rows[0]?.cnt || 0) > 0;
  } catch {
    usersLastLoginAtResolved = false;
  }

  if (!usersLastLoginAtResolved && !warnedMissingLastLoginAt) {
    warnedMissingLastLoginAt = true;
    console.warn(
      "[db] Column users.last_login_at is missing. Run pfe-backend/db/migrations/003_users_last_login_at.sql on your MySQL DB, then restart this API so last-login timestamps are recorded."
    );
  }

  return usersLastLoginAtResolved;
}

/**
 * Call after detecting the column at runtime (e.g. migration applied without restart).
 */
function resetUsersLastLoginAtCache() {
  usersLastLoginAtResolved = null;
  warnedMissingLastLoginAt = false;
}

module.exports = {
  usersHasLastLoginAtColumn,
  resetUsersLastLoginAtCache,
};
