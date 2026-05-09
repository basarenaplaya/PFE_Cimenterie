const path = require("path");
const dotenv = require("dotenv");

// Single repo-root `.env` for Docker + local; optional `pfe-backend/.env` fills any missing keys.
const rootEnvPath = path.resolve(__dirname, "..", "..", "..", ".env");
const backendEnvPath = path.resolve(__dirname, "..", "..", ".env");
dotenv.config({ path: rootEnvPath });
dotenv.config({ path: backendEnvPath });

const dbUser = process.env.DB_USER || process.env.MYSQL_USER;
const dbName = process.env.DB_NAME || process.env.MYSQL_DATABASE;
const dbPassword =
  process.env.DB_PASSWORD !== undefined ? process.env.DB_PASSWORD : process.env.MYSQL_PASSWORD || "";

const missingPieces = [];
if (!process.env.DB_HOST) missingPieces.push("DB_HOST");
if (!dbUser) missingPieces.push("DB_USER or MYSQL_USER");
if (!dbName) missingPieces.push("DB_NAME or MYSQL_DATABASE");
if (process.env.JWT_SECRET === undefined || String(process.env.JWT_SECRET).trim() === "") {
  missingPieces.push("JWT_SECRET");
}

if (missingPieces.length > 0) {
  throw new Error(`Missing required environment variables: ${missingPieces.join(", ")}`);
}

const toInt = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
};

const toFloat = (value, fallback) => {
  const parsed = Number.parseFloat(value);
  return Number.isNaN(parsed) ? fallback : parsed;
};

const toBool = (value, fallback = false) => {
  if (typeof value !== "string") return fallback;
  if (value.toLowerCase() === "true") return true;
  if (value.toLowerCase() === "false") return false;
  return fallback;
};

const jwtSecret = process.env.JWT_SECRET.trim();

if (jwtSecret.length < 32) {
  throw new Error("JWT_SECRET must be at least 32 characters long.");
}

const bcryptSaltRounds = toInt(process.env.BCRYPT_SALT_ROUNDS, 12);
if (bcryptSaltRounds < 10 || bcryptSaltRounds > 15) {
  throw new Error("BCRYPT_SALT_ROUNDS must be between 10 and 15.");
}

const plcPollIntervalMs = toInt(process.env.PLC_POLL_INTERVAL_MS, 500);
if (plcPollIntervalMs < 100) {
  throw new Error("PLC_POLL_INTERVAL_MS must be >= 100.");
}

const plcReconnectBackoffMs = toInt(process.env.PLC_RECONNECT_BACKOFF_MS, 5000);
if (plcReconnectBackoffMs < 1000) {
  throw new Error("PLC_RECONNECT_BACKOFF_MS must be >= 1000.");
}

const plcSimTargetMin = toFloat(process.env.PLC_SIM_TARGET_MIN, 49.5);
const plcSimTargetMax = toFloat(process.env.PLC_SIM_TARGET_MAX, 50.5);
if (plcSimTargetMin <= 0 || plcSimTargetMax <= 0 || plcSimTargetMin > plcSimTargetMax) {
  throw new Error("PLC_SIM target bounds are invalid.");
}

const bindHostRaw = process.env.BIND_HOST;
const bindHost =
  typeof bindHostRaw === "string" && bindHostRaw.trim() !== ""
    ? bindHostRaw.trim()
    : "0.0.0.0";

const env = {
  nodeEnv: process.env.NODE_ENV || "development",
  port: toInt(process.env.PORT, 3000),
  /** Listen address for HTTP + Socket.IO (0.0.0.0 = all IPv4 interfaces, reachable on LAN). */
  bindHost,
  dbHost: process.env.DB_HOST,
  dbPort: toInt(process.env.DB_PORT, 3306),
  dbUser,
  dbPassword,
  dbName,
  dbConnectionLimit: toInt(process.env.DB_CONNECTION_LIMIT, 10),
  jwtSecret,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "8h",
  bcryptSaltRounds,
  corsOrigin: process.env.CORS_ORIGIN || "*",
  plcSimulator: toBool(process.env.PLC_SIMULATOR, false),
  plcIp: process.env.PLC_IP || "127.0.0.1",
  plcPort: toInt(process.env.PLC_PORT, 102),
  plcRack: toInt(process.env.PLC_RACK, 0),
  plcSlot: toInt(process.env.PLC_SLOT, 1),
  plcPollIntervalMs,
  plcReconnectBackoffMs,
  plcSimTargetMin,
  plcSimTargetMax,
  /** Default TND per metric tonne of product (overridable in DB + UI). */
  pricePerTonTndDefault: toFloat(process.env.PRICE_PER_TON_TND, 250),
};

module.exports = { env };
