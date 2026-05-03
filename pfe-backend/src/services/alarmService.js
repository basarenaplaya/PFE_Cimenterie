const { executeQuery } = require("../config/database");
const { HttpError } = require("../utils/httpError");
const { buildPaginationMeta } = require("../utils/pagination");
const { emitAdminDashboardNotification } = require("./socketService");
const { TELEMETRY_ALARM_KEYS, describeAlarmForLog } = require("../constants/alarmTelemetry");

function mapAlarmLog(row) {
  return {
    id: row.id,
    alarm_code: row.alarm_code,
    description: row.description,
    start_time: row.start_time,
    end_time: row.end_time,
    duration_sec: Number(row.duration_sec || 0),
    status: row.end_time ? "Cleared" : "Active",
  };
}

async function startAlarm({ alarmCode, description, startTime = new Date() }) {
  const code = String(alarmCode || "").trim();
  if (!code || !TELEMETRY_ALARM_KEYS.includes(code)) {
    throw new HttpError(400, "Invalid alarm code.");
  }

  const activeRows = await executeQuery(
    `SELECT id
     FROM alarm_logs
     WHERE alarm_code = ? AND end_time IS NULL
     ORDER BY start_time DESC
     LIMIT 1`,
    [code]
  );

  if (activeRows.length > 0) {
    return {
      started: false,
      reason: "already_active",
      id: activeRows[0].id,
    };
  }

  const desc = String(description || describeAlarmForLog(code));

  const result = await executeQuery(
    `INSERT INTO alarm_logs (alarm_code, description, start_time, duration_sec)
     VALUES (?, ?, ?, 0)`,
    [code, desc, startTime]
  );

  try {
    const at = startTime instanceof Date ? startTime : new Date(startTime);
    emitAdminDashboardNotification({
      type: "alarm",
      alarm_log_id: result.insertId,
      alarm_code: code,
      description: desc,
      at: at.toISOString(),
    });
  } catch {
    /* non-fatal */
  }

  return {
    started: true,
    id: result.insertId,
    alarm_code: code,
  };
}

async function clearAlarm({ alarmCode, endTime = new Date() }) {
  const code = String(alarmCode || "").trim();
  if (!code || !TELEMETRY_ALARM_KEYS.includes(code)) {
    throw new HttpError(400, "Invalid alarm code.");
  }

  const activeRows = await executeQuery(
    `SELECT id
     FROM alarm_logs
     WHERE alarm_code = ? AND end_time IS NULL
     ORDER BY start_time DESC
     LIMIT 1`,
    [code]
  );

  if (activeRows.length === 0) {
    return {
      cleared: false,
      reason: "already_cleared",
    };
  }

  await executeQuery(
    `UPDATE alarm_logs
     SET end_time = ?,
         duration_sec = TIMESTAMPDIFF(SECOND, start_time, ?)
     WHERE id = ?`,
    [endTime, endTime, activeRows[0].id]
  );

  return {
    cleared: true,
    id: activeRows[0].id,
    alarm_code: code,
  };
}

async function listAlarmLogs({ page = 1, limit = 20, startDate, endDate, status }) {
  const offset = (page - 1) * limit;
  const conditions = [];
  const params = [];

  if (startDate) {
    conditions.push("start_time >= ?");
    params.push(startDate);
  }

  if (endDate) {
    conditions.push("start_time <= ?");
    params.push(endDate);
  }

  if (status) {
    const normalizedStatus = status.toLowerCase();
    if (normalizedStatus === "active") {
      conditions.push("end_time IS NULL");
    }

    if (normalizedStatus === "cleared") {
      conditions.push("end_time IS NOT NULL");
    }
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const rows = await executeQuery(
    `SELECT id, alarm_code, description, start_time, end_time, duration_sec
     FROM alarm_logs
     ${whereClause}
     ORDER BY start_time DESC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );

  const countRows = await executeQuery(
    `SELECT COUNT(*) AS total
     FROM alarm_logs
     ${whereClause}`,
    params
  );

  const totalItems = Number(countRows[0].total || 0);

  return {
    items: rows.map(mapAlarmLog),
    meta: buildPaginationMeta({
      page,
      limit,
      totalItems,
      itemCount: rows.length,
    }),
  };
}

module.exports = {
  listAlarmLogs,
  startAlarm,
  clearAlarm,
};
