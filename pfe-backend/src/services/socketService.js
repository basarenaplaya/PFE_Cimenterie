const { Server } = require("socket.io");
const { env } = require("../config/environment");

let io;

function initializeSocketServer(httpServer) {
  if (io) {
    return io;
  }

  io = new Server(httpServer, {
    cors: {
      origin: env.corsOrigin === "*" ? true : env.corsOrigin,
      credentials: true,
    },
  });

  io.on("connection", (socket) => {
    if (env.nodeEnv !== "production") {
      console.log(`[socketService] Client connected: ${socket.id}`);
    }

    socket.on("disconnect", () => {
      if (env.nodeEnv !== "production") {
        console.log(`[socketService] Client disconnected: ${socket.id}`);
      }
    });
  });

  return io;
}

function emitTelemetryUpdate(payload) {
  if (!io) {
    return;
  }

  io.emit("telemetry_update", payload);
  io.emit("telemetry", payload);
}

function emitRealtimeStatus(payload) {
  if (!io) {
    return;
  }

  io.emit("realtime_status", payload);
  io.emit("plc-status", payload);
}

function getSocketServer() {
  return io;
}

async function closeSocketServer() {
  if (!io) {
    return;
  }

  await new Promise((resolve) => {
    io.close(() => resolve());
  });

  io = undefined;
}

module.exports = {
  initializeSocketServer,
  emitTelemetryUpdate,
  emitRealtimeStatus,
  getSocketServer,
  closeSocketServer,
};
