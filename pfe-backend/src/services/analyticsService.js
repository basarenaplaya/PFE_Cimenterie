const { executeQuery } = require("../config/database");

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

async function getTodayKpis() {
  const { start, end } = getTodayUtcWindow();

  const productionRows = await executeQuery(
    `SELECT
       COUNT(*) AS total_bags_produced,
       COALESCE(SUM(weight_actual), 0) AS total_tonnage,
       COALESCE(AVG(giveaway), 0) AS average_giveaway
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

  return {
    window_start_utc: start.toISOString(),
    window_end_utc: end.toISOString(),
    total_bags_produced: Number(production.total_bags_produced || 0),
    total_tonnage: Number(production.total_tonnage || 0),
    average_giveaway: Number(production.average_giveaway || 0),
    active_alarms_count: Number(alarms.active_alarms_count || 0),
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

module.exports = {
  getTodayKpis,
  getTodayProductionChart,
};
