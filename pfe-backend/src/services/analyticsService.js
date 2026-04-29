const { executeQuery } = require("../config/database");
const { getPricePerTon } = require("./dashboardSettingsService");

function getTodayUtcWindow() {
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);

  return { start, end };
}

function toHourLabel(hourIndex) {
  return `${String(hourIndex).padStart(2, "0")}:00`;
}

function roundMoney2(n) {
  if (!Number.isFinite(n)) {
    return 0;
  }
  return Math.round(n * 100) / 100;
}

const SPOUT_COUNT = 8;

function roundAvgGiveawayKg(n) {
  if (!Number.isFinite(n)) {
    return 0;
  }
  return Math.round(n * 1000) / 1000;
}

async function getTodayKpis() {
  const { start, end } = getTodayUtcWindow();

  // Net kg over/under (actual − target) summed for the day. For overfill-only waste cost,
  // use SUM(GREATEST(giveaway, 0)) instead of SUM(giveaway).
  const productionRows = await executeQuery(
    `SELECT
       COUNT(*) AS total_bags_produced,
       COALESCE(SUM(weight_actual), 0) AS total_tonnage,
       COALESCE(AVG(giveaway), 0) AS average_giveaway,
       COALESCE(SUM(giveaway), 0) AS total_giveaway_kg
     FROM production_logs
     WHERE created_at >= ? AND created_at < ?`,
    [start, end]
  );

  const activeAlarmsRows = await executeQuery(
    `SELECT COUNT(*) AS active_alarms_count
     FROM alarm_logs
     WHERE end_time IS NULL`
  );

  const production = productionRows[0] || {};
  const alarms = activeAlarmsRows[0] || {};

  const totalTonnageKg = Number(production.total_tonnage || 0);
  const totalGiveawayKg = Number(production.total_giveaway_kg || 0);
  const pricePerTonTnd = await getPricePerTon();
  const metricTonnes = totalTonnageKg / 1000;
  const grossValueTnd = roundMoney2(metricTonnes * pricePerTonTnd);
  const giveawayCostTnd = roundMoney2(totalGiveawayKg * (pricePerTonTnd / 1000));

  return {
    window_start_utc: start.toISOString(),
    window_end_utc: end.toISOString(),
    total_bags_produced: Number(production.total_bags_produced || 0),
    total_tonnage: totalTonnageKg,
    average_giveaway: Number(production.average_giveaway || 0),
    active_alarms_count: Number(alarms.active_alarms_count || 0),
    price_per_ton_tnd: roundMoney2(pricePerTonTnd),
    gross_value_tnd: grossValueTnd,
    giveaway_cost_tnd: giveawayCostTnd,
  };
}

async function getTodayProductionChart() {
  const { start, end } = getTodayUtcWindow();

  const rows = await executeQuery(
    `SELECT
       HOUR(created_at) AS hour_index,
       COUNT(*) AS bags_produced,
       COALESCE(SUM(weight_actual), 0) AS total_tonnage,
       COALESCE(AVG(giveaway), 0) AS average_giveaway
     FROM production_logs
     WHERE created_at >= ? AND created_at < ?
     GROUP BY HOUR(created_at)
     ORDER BY hour_index ASC`,
    [start, end]
  );

  const byHour = new Map();
  for (const row of rows) {
    byHour.set(Number(row.hour_index), {
      hour: toHourLabel(Number(row.hour_index)),
      bags_produced: Number(row.bags_produced || 0),
      total_tonnage: Number(row.total_tonnage || 0),
      average_giveaway: Number(row.average_giveaway || 0),
    });
  }

  const points = [];
  for (let hour = 0; hour < 24; hour += 1) {
    points.push(
      byHour.get(hour) || {
        hour: toHourLabel(hour),
        bags_produced: 0,
        total_tonnage: 0,
        average_giveaway: 0,
      }
    );
  }

  return {
    window_start_utc: start.toISOString(),
    window_end_utc: end.toISOString(),
    points,
  };
}

async function getTodaySpoutGiveawayChart() {
  const { start, end } = getTodayUtcWindow();

  const rows = await executeQuery(
    `SELECT
       spout_id,
       AVG(giveaway) AS avg_giveaway,
       COUNT(*) AS bags_filled
     FROM production_logs
     WHERE created_at >= ? AND created_at < ?
     GROUP BY spout_id
     ORDER BY spout_id ASC`,
    [start, end]
  );

  const bySpout = new Map();
  for (const row of rows) {
    const id = Number(row.spout_id);
    if (!Number.isFinite(id)) {
      continue;
    }
    bySpout.set(id, {
      spout_id: id,
      label: `Bec ${id}`,
      avg_giveaway: roundAvgGiveawayKg(Number(row.avg_giveaway || 0)),
      bags_filled: Number(row.bags_filled || 0),
    });
  }

  const points = [];
  for (let spoutId = 1; spoutId <= SPOUT_COUNT; spoutId += 1) {
    points.push(
      bySpout.get(spoutId) || {
        spout_id: spoutId,
        label: `Bec ${spoutId}`,
        avg_giveaway: 0,
        bags_filled: 0,
      }
    );
  }

  return {
    window_start_utc: start.toISOString(),
    window_end_utc: end.toISOString(),
    points,
  };
}

module.exports = {
  getTodayKpis,
  getTodayProductionChart,
  getTodaySpoutGiveawayChart,
};
