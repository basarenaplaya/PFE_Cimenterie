const mysql = require("mysql2/promise");
const { env } = require("./environment");

const pool = mysql.createPool({
  host: env.dbHost,
  port: env.dbPort,
  user: env.dbUser,
  password: env.dbPassword,
  database: env.dbName,
  waitForConnections: true,
  connectionLimit: env.dbConnectionLimit,
  queueLimit: 0,
  timezone: "Z",
});

async function executeQuery(sql, params = []) {
  if (!Array.isArray(params)) {
    throw new TypeError("Query parameters must be provided as an array.");
  }

  const [rows] = await pool.execute(sql, params);
  return rows;
}

async function pingDatabase() {
  const connection = await pool.getConnection();
  try {
    await connection.ping();
  } finally {
    connection.release();
  }
}

async function closeDatabase() {
  await pool.end();
}

module.exports = {
  pool,
  executeQuery,
  pingDatabase,
  closeDatabase,
};
