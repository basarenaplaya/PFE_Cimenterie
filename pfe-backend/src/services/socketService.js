const { Server } = require("socket.io");
const { env } = require("../config/environment");
const { assertMachineRealtimeRole, getAuthFromJwtString } = require("../middleware/auth");

let io;

function extractSocketToken(handshake) {
  const auth = handshake && handshake.auth;
  if (auth && typeof auth.token === "string" && auth.token.trim()) {
    return auth.token.trim();
  }
  const header = handshake && handshake.headers && handshake.headers.authorization;
  if (typeof header === "string") {
    const parts = header.split(" ");
    if (parts.length === 2 && parts[0] === "Bearer" && parts[1]) {
      return parts[1].trim();
    }
  }
  return null;
}

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

  io.use((socket, next) => {
    try {
      const token = extractSocketToken(socket.handshake);
      const auth = getAuthFromJwtString(token);
      assertMachineRealtimeRole(auth);
      socket.data.auth = auth;
      return next();
    } catch (error) {
      const message =
        error && typeof error.message === "string" ? error.message : "Authentication failed";
      return next(new Error(message));
    }
  });

  io.on("connection", (socket) => {
    if (env.nodeEnv !== "production") {
      const who = socket.data.auth && socket.data.auth.username ? socket.data.auth.username : "?";
      console.log(`[socketService] Client connected: ${socket.id} (${who})`);
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
