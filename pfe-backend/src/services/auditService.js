const { executeQuery } = require("../config/database");
const { buildPaginationMeta } = require("../utils/pagination");

async function logAuditAction({ userId, action, ipAddress }) {
  await executeQuery(
    "INSERT INTO audit_logs (user_id, action, ip_address) VALUES (?, ?, ?)",
    [userId || null, action, ipAddress || null]
  );
}

async function listAuditLogs({ page = 1, limit = 20, action, userId }) {
  const offset = (page - 1) * limit;
  const conditions = [];
  const params = [];

  if (action) {
    conditions.push("al.action LIKE ?");
    params.push(`%${action}%`);
  }

  if (userId) {
    conditions.push("al.user_id = ?");
    params.push(userId);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const rows = await executeQuery(
    `SELECT al.id, al.user_id, u.username, al.action, al.ip_address, al.timestamp
     FROM audit_logs al
     LEFT JOIN users u ON u.id = al.user_id
     ${whereClause}
     ORDER BY al.timestamp DESC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );

  const countResult = await executeQuery(
    `SELECT COUNT(*) AS total
     FROM audit_logs al
     ${whereClause}`,
    params
  );

  const totalItems = Number(countResult[0].total || 0);

  return {
    items: rows,
    meta: buildPaginationMeta({
      page,
      limit,
      totalItems,
      itemCount: rows.length,
    }),
  };
}

module.exports = {
  logAuditAction,
  listAuditLogs,
};
