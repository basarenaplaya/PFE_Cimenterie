const dotenv = require("dotenv");

dotenv.config();

const requiredKeys = [
  "DB_HOST",
  "DB_USER",
  "DB_NAME",
  "JWT_SECRET",
];

const missingKeys = requiredKeys.filter((key) => process.env[key] === undefined);

if (missingKeys.length > 0) {
  throw new Error(`Missing required environment variables: ${missingKeys.join(", ")}`);
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

const env = {
  nodeEnv: process.env.NODE_ENV || "development",
  port: toInt(process.env.PORT, 5000),
  dbHost: process.env.DB_HOST,
  dbPort: toInt(process.env.DB_PORT, 3306),
  dbUser: process.env.DB_USER,
  dbPassword: process.env.DB_PASSWORD || "",
  dbName: process.env.DB_NAME,
  dbConnectionLimit: toInt(process.env.DB_CONNECTION_LIMIT, 10),
  jwtSecret,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "8h",
  bcryptSaltRounds,
  allowAdminBootstrap: toBool(process.env.ALLOW_ADMIN_BOOTSTRAP, false),
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
};

module.exports = { env };
