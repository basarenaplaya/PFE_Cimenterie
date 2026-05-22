const { executeQuery } = require("../config/database");
const { HttpError } = require("../utils/httpError");
const { buildPaginationMeta } = require("../utils/pagination");
const { sanitizeFields } = require("../utils/sanitize");
const { logAuditAction } = require("./auditService");

/**
 * Normalize LONGBLOB / driver shapes into a UTF-8 data URL string for JSON.
 * mysql2 often returns Buffer; some stacks return typed arrays or Node's serialized Buffer shape.
 */
function snapshotFromRow(value) {
  if (value == null || value === "") return null;
  if (typeof value === "string") {
    const trimmed = value.trim().replace(/^\uFEFF/, "");
    return trimmed.length ? trimmed : null;
  }
  if (Buffer.isBuffer(value)) {
    return value.toString("utf8");
  }
  if (ArrayBuffer.isView(value)) {
    return Buffer.from(value.buffer, value.byteOffset, value.byteLength).toString("utf8");
  }
  if (value instanceof ArrayBuffer) {
    return Buffer.from(value).toString("utf8");
  }
  if (typeof value === "object" && value.type === "Buffer" && Array.isArray(value.data)) {
    return Buffer.from(value.data).toString("utf8");
  }
  return null;
}

function mapCamera(row, { includeSnapshot = true } = {}) {
  return {
    id: row.id,
    cam_name: row.cam_name,
    ip_url: row.ip_url,
    last_snapshot: includeSnapshot ? snapshotFromRow(row.last_snapshot) ?? null : null,
    added_by: row.added_by,
    added_by_username: row.added_by_username || null,
  };
}

async function findCameraById(cameraId) {
  const rows = await executeQuery(
    `SELECT c.id, c.cam_name, c.ip_url, c.last_snapshot, c.added_by, u.username AS added_by_username
     FROM cameras c
     LEFT JOIN users u ON u.id = c.added_by
     WHERE c.id = ? LIMIT 1`,
    [cameraId]
  );

  return rows[0] ? mapCamera(rows[0], { includeSnapshot: true }) : null;
}

async function createCamera({ cam_name, ip_url, actor }) {
  const sanitized = sanitizeFields({ cam_name, ip_url }, ["cam_name", "ip_url"]);

  const result = await executeQuery(
    "INSERT INTO cameras (cam_name, ip_url, added_by) VALUES (?, ?, ?)",
    [sanitized.cam_name, sanitized.ip_url, actor.userId]
  );

  const camera = await findCameraById(result.insertId);

  await logAuditAction({
    userId: actor.userId,
    action: `ADMIN_CAMERA_CREATE camera_id=${camera.id} cam_name=${camera.cam_name}`,
    ipAddress: actor.ipAddress,
  });

  return camera;
}

async function listCameras({ page = 1, limit = 20, search, include_snapshots = false }) {
  const offset = (page - 1) * limit;
  const conditions = [];
  const params = [];

  if (search) {
    conditions.push("(c.cam_name LIKE ? OR c.ip_url LIKE ?)");
    const pattern = `%${search}%`;
    params.push(pattern, pattern);
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const snapshotSelect = include_snapshots ? "c.last_snapshot" : "NULL AS last_snapshot";

  const rows = await executeQuery(
    `SELECT c.id, c.cam_name, c.ip_url, ${snapshotSelect}, c.added_by, u.username AS added_by_username
     FROM cameras c
     LEFT JOIN users u ON u.id = c.added_by
     ${whereClause}
     ORDER BY c.id DESC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );

  const count = await executeQuery(
    `SELECT COUNT(*) AS total FROM cameras c ${whereClause}`,
    params
  );

  const totalItems = Number(count[0].total || 0);

  return {
    items: rows.map((row) => mapCamera(row, { includeSnapshot: Boolean(include_snapshots) })),
    meta: buildPaginationMeta({
      page,
      limit,
      totalItems,
      itemCount: rows.length,
    }),
  };
}

async function updateCamera({ cameraId, cam_name, ip_url, actor }) {
  const target = await findCameraById(cameraId);
  if (!target) {
    throw new HttpError(404, "Camera not found.");
  }

  const sanitized = sanitizeFields({ cam_name, ip_url }, ["cam_name", "ip_url"]);

  await executeQuery("UPDATE cameras SET cam_name = ?, ip_url = ? WHERE id = ?", [
    sanitized.cam_name,
    sanitized.ip_url,
    cameraId,
  ]);

  await logAuditAction({
    userId: actor.userId,
    action: `ADMIN_CAMERA_UPDATE camera_id=${cameraId} cam_name=${sanitized.cam_name}`,
    ipAddress: actor.ipAddress,
  });

  return findCameraById(cameraId);
}

async function updateCameraSnapshot({ cameraId, last_snapshot, actor }) {
  const target = await findCameraById(cameraId);
  if (!target) {
    throw new HttpError(404, "Camera not found.");
  }

  await executeQuery("UPDATE cameras SET last_snapshot = ? WHERE id = ?", [last_snapshot, cameraId]);

  await logAuditAction({
    userId: actor.userId,
    action: `ADMIN_CAMERA_SNAPSHOT camera_id=${cameraId}`,
    ipAddress: actor.ipAddress,
  });

  return findCameraById(cameraId);
}

async function deleteCamera({ cameraId, actor }) {
  const target = await findCameraById(cameraId);
  if (!target) {
    throw new HttpError(404, "Camera not found.");
  }

  await executeQuery("DELETE FROM cameras WHERE id = ?", [cameraId]);

  await logAuditAction({
    userId: actor.userId,
    action: `ADMIN_CAMERA_DELETE camera_id=${cameraId} cam_name=${target.cam_name}`,
    ipAddress: actor.ipAddress,
  });

  return target;
}

module.exports = {
  createCamera,
  listCameras,
  findCameraById,
  updateCamera,
  updateCameraSnapshot,
  deleteCamera,
};
