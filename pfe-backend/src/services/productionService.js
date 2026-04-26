const { executeQuery, pool } = require("../config/database");
const { HttpError } = require("../utils/httpError");
const { buildPaginationMeta } = require("../utils/pagination");

const REALTIME_STATE_CREATE_SQL = `
  CREATE TABLE IF NOT EXISTS realtime_engine_state (
    id TINYINT PRIMARY KEY,
    last_production_counter INT NOT NULL DEFAULT 0,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  )
`;

const REALTIME_STATE_SEED_SQL =
  "INSERT INTO realtime_engine_state (id, last_production_counter) VALUES (1, 0) ON DUPLICATE KEY UPDATE id = id";

const LEGACY_STATUS_COLUMN_SQL = `
  SELECT COUNT(*) AS total
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'production_logs'
    AND COLUMN_NAME = 'status'
`;

let legacyStatusColumnChecked = false;
let legacyStatusColumnPresent = false;

function mapProductionLog(row) {
  return {
    id: row.id,
    spout_id: row.spout_id,
    weight_actual: Number(row.weight_actual),
    weight_target: Number(row.weight_target),
    giveaway: Number(row.giveaway),
    created_at: row.created_at,
  };
}

async function ensureProductionLogSchema() {
  if (legacyStatusColumnChecked) {
    return;
  }

  const rows = await executeQuery(LEGACY_STATUS_COLUMN_SQL);
  legacyStatusColumnPresent = Number(rows[0]?.total || 0) > 0;

  if (legacyStatusColumnPresent) {
    try {
      await executeQuery("ALTER TABLE production_logs DROP COLUMN status");
      legacyStatusColumnPresent = false;
    } catch (error) {
      if (error && error.code !== "ER_CANT_DROP_FIELD_OR_KEY") {
        throw error;
      }
    }
  }

  legacyStatusColumnChecked = true;
}

async function initializeRealtimeCounterState() {
  await ensureProductionLogSchema();
  await executeQuery(REALTIME_STATE_CREATE_SQL);
  await executeQuery(REALTIME_STATE_SEED_SQL);
}

async function setCounterBaseline(counterValue) {
  const normalizedCounter = Number.parseInt(counterValue, 10);
  if (!Number.isFinite(normalizedCounter) || normalizedCounter < 0) {
    throw new HttpError(400, "Invalid counter baseline value.");
  }

  await initializeRealtimeCounterState();

  await executeQuery(
    "UPDATE realtime_engine_state SET last_production_counter = ?, updated_at = CURRENT_TIMESTAMP WHERE id = 1",
    [normalizedCounter]
  );

  return { last_production_counter: normalizedCounter };
}

async function createLog({
  productionCounter,
  spoutId,
  weightActual,
  weightTarget,
  createdAt = new Date(),
}) {
  const normalizedCounter = Number.parseInt(productionCounter, 10);
  const normalizedSpoutId = Number.parseInt(spoutId, 10);
  const normalizedWeightActual = Number(Number(weightActual).toFixed(2));
  const normalizedWeightTarget = Number(Number(weightTarget).toFixed(2));

  if (!Number.isFinite(normalizedCounter) || normalizedCounter < 0) {
    throw new HttpError(400, "Invalid production counter value.");
  }

  if (!Number.isFinite(normalizedSpoutId) || normalizedSpoutId <= 0) {
    throw new HttpError(400, "Invalid spout ID value.");
  }

  if (!Number.isFinite(normalizedWeightActual) || normalizedWeightActual < 0) {
    throw new HttpError(400, "Invalid actual bag weight value.");
  }

  if (!Number.isFinite(normalizedWeightTarget) || normalizedWeightTarget < 0) {
    throw new HttpError(400, "Invalid target bag weight value.");
  }

  const giveaway = Number((normalizedWeightActual - normalizedWeightTarget).toFixed(2));
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();
    await connection.execute(REALTIME_STATE_CREATE_SQL);
    await connection.execute(REALTIME_STATE_SEED_SQL);

    const [stateRows] = await connection.execute(
      "SELECT last_production_counter FROM realtime_engine_state WHERE id = 1 FOR UPDATE"
    );

    const lastCounter = Number(stateRows[0]?.last_production_counter || 0);

    if (normalizedCounter <= lastCounter) {
      await connection.rollback();

      return {
        inserted: false,
        reason: "duplicate_or_stale_counter",
        lastCounter,
      };
    }

    const insertColumns = ["spout_id", "weight_actual", "weight_target", "giveaway", "created_at"];
    const insertValues = [
      normalizedSpoutId,
      normalizedWeightActual,
      normalizedWeightTarget,
      giveaway,
      createdAt,
    ];

    if (legacyStatusColumnPresent) {
      insertColumns.splice(4, 0, "status");
      insertValues.splice(4, 0, "OK");
    }

    const [insertResult] = await connection.execute(
      `INSERT INTO production_logs (${insertColumns.join(", ")}) VALUES (${insertColumns
        .map(() => "?")
        .join(", ")})`,
      insertValues
    );

    await connection.execute(
      "UPDATE realtime_engine_state SET last_production_counter = ?, updated_at = CURRENT_TIMESTAMP WHERE id = 1",
      [normalizedCounter]
    );

    await connection.commit();

    return {
      inserted: true,
      id: insertResult.insertId,
      counter: normalizedCounter,
      log: {
        id: insertResult.insertId,
        spout_id: normalizedSpoutId,
        weight_actual: normalizedWeightActual,
        weight_target: normalizedWeightTarget,
        giveaway,
        created_at: createdAt,
      },
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function listProductionLogs({ page = 1, limit = 20, startDate, endDate, spoutId }) {
  const offset = (page - 1) * limit;
  const conditions = [];
  const params = [];

  if (startDate) {
    conditions.push("created_at >= ?");
    params.push(startDate);
  }

  if (endDate) {
    conditions.push("created_at <= ?");
    params.push(endDate);
  }

  if (spoutId) {
    conditions.push("spout_id = ?");
    params.push(spoutId);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const rows = await executeQuery(
    `SELECT id, spout_id, weight_actual, weight_target, giveaway, created_at
     FROM production_logs
     ${whereClause}
     ORDER BY created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );

  const countRows = await executeQuery(
    `SELECT COUNT(*) AS total
     FROM production_logs
     ${whereClause}`,
    params
  );

  const totalItems = Number(countRows[0].total || 0);

  return {
    items: rows.map(mapProductionLog),
    meta: buildPaginationMeta({
      page,
      limit,
      totalItems,
      itemCount: rows.length,
    }),
  };
}

module.exports = {
  listProductionLogs,
  initializeRealtimeCounterState,
  setCounterBaseline,
  createLog,
};
