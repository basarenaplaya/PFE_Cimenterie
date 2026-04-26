const http = require("http");
const { app } = require("./app");
const { closeDatabase, pingDatabase } = require("./config/database");
const { env } = require("./config/environment");
const { startRealtimeEngine, stopRealtimeEngine } = require("./services/realtimeEngineService");
const { closeSocketServer, initializeSocketServer } = require("./services/socketService");

let server;

async function startServer() {
  try {
    await pingDatabase();

    server = http.createServer(app);
    initializeSocketServer(server);
    server.listen(env.port, () => {
      console.log(`PFE backend running on port ${env.port} in ${env.nodeEnv} mode`);

      // Keep API availability independent from PLC connectivity.
      startRealtimeEngine().catch((error) => {
        console.error("Realtime engine failed to start:", error.message);
      });
    });
  } catch (error) {
    console.error("Server startup failed:", error.message);
    process.exit(1);
  }
}

async function gracefulShutdown(signal) {
  console.log(`${signal} received. Shutting down gracefully...`);

  await stopRealtimeEngine();
  await closeSocketServer();

  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }

  await closeDatabase();
  process.exit(0);
}

process.on("SIGINT", () => {
  gracefulShutdown("SIGINT").catch((error) => {
    console.error("Graceful shutdown failed:", error.message);
    process.exit(1);
  });
});

process.on("SIGTERM", () => {
  gracefulShutdown("SIGTERM").catch((error) => {
    console.error("Graceful shutdown failed:", error.message);
    process.exit(1);
  });
});

startServer();
