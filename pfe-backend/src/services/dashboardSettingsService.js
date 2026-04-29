const { executeQuery } = require("../config/database");
const { env } = require("../config/environment");
const { HttpError } = require("../utils/httpError");

const MIN_PRICE = 0.01;
const MAX_PRICE = 1_000_000;

let tableEnsured = false;

async function ensureDashboardSettingsTable() {
  if (tableEnsured) {
    return;
  }

  await executeQuery(
    `CREATE TABLE IF NOT EXISTS dashboard_settings (
      id TINYINT UNSIGNED NOT NULL PRIMARY KEY,
      price_per_ton_tnd DECIMAL(16,4) NOT NULL
    )`,
    []
  );

  await executeQuery(
    `INSERT IGNORE INTO dashboard_settings (id, price_per_ton_tnd) VALUES (1, ?)`,
    [env.pricePerTonTndDefault]
  );

  tableEnsured = true;
}

/**
 * Active price per metric tonne (TND), persisted; falls back to env default until row exists.
 * @returns {Promise<number>}
 */
async function getPricePerTon() {
  await ensureDashboardSettingsTable();
  const rows = await executeQuery(
    `SELECT price_per_ton_tnd FROM dashboard_settings WHERE id = 1 LIMIT 1`,
    []
  );

  if (!rows[0]) {
    return env.pricePerTonTndDefault;
  }

  const v = Number(rows[0].price_per_ton_tnd);
  return Number.isFinite(v) ? v : env.pricePerTonTndDefault;
}

/**
 * @param {unknown} value
 * @returns {Promise<number>} persisted value
 */
async function setPricePerTon(value) {
  const n = typeof value === "number" ? value : Number.parseFloat(String(value));

  if (!Number.isFinite(n) || n < MIN_PRICE || n > MAX_PRICE) {
    throw new HttpError(400, `price_per_ton_tnd must be a number between ${MIN_PRICE} and ${MAX_PRICE}.`);
  }

  await ensureDashboardSettingsTable();

  await executeQuery(
    `INSERT INTO dashboard_settings (id, price_per_ton_tnd) VALUES (1, ?)
     ON DUPLICATE KEY UPDATE price_per_ton_tnd = VALUES(price_per_ton_tnd)`,
    [n]
  );

  return getPricePerTon();
}

module.exports = {
  getPricePerTon,
  setPricePerTon,
};
