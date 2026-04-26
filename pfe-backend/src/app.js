const cors = require("cors");
const express = require("express");
const rateLimit = require("express-rate-limit");
const helmet = require("helmet");
const path = require("path");
const { env } = require("./config/environment");
const { errorHandler, notFoundHandler } = require("./middleware/errorHandler");
const { alarmRouter } = require("./routes/alarmRoutes");
const { adminRouter } = require("./routes/adminRoutes");
const { analyticsRouter } = require("./routes/analyticsRoutes");
const { authRouter } = require("./routes/authRoutes");
const { machineRouter } = require("./routes/machineRoutes");
const { productionRouter } = require("./routes/productionRoutes");
const { sendSuccess } = require("./utils/httpResponse");

const app = express();
const nativeMachineUiDir = path.join(__dirname, "native-machine-ui");

const nativeUiFrameAncestors = env.corsOrigin && env.corsOrigin !== "*"
  ? ["'self'", env.corsOrigin]
  : ["'self'", "http://localhost:5173", "http://127.0.0.1:5173"];

app.disable("x-powered-by");
app.set("trust proxy", 1);

app.use(
  helmet({
    crossOriginResourcePolicy: false,
    xFrameOptions: false,
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        "frame-ancestors": nativeUiFrameAncestors,
      },
    },
  })
);

app.use(
  cors({
    origin: env.corsOrigin === "*" ? true : env.corsOrigin,
    credentials: true,
  })
);

const jsonBodyDefault = express.json({ limit: "64kb" });
const jsonBodyCameraSnapshot = express.json({ limit: "12mb" });

app.use((req, res, next) => {
  const path = req.originalUrl.split("?")[0] || "";
  if (req.method === "PATCH" && /\/api\/admin\/cameras\/[^/]+\/snapshot\/?$/.test(path)) {
    return jsonBodyCameraSnapshot(req, res, next);
  }
  return jsonBodyDefault(req, res, next);
});

app.use(express.urlencoded({ extended: false, limit: "64kb" }));

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: "RATE_LIMITED",
      message: "Too many requests. Try again in a few minutes.",
    },
  },
});

const adminLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  skip: () => env.nodeEnv !== "production",
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: "RATE_LIMITED",
      message: "Too many admin requests. Try again in a few minutes.",
    },
  },
});

const dataReadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 600,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: "RATE_LIMITED",
      message: "Too many analytics requests. Try again in a few minutes.",
    },
  },
});

const machineCommandLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: "RATE_LIMITED",
      message: "Too many machine commands. Try again in a few minutes.",
    },
  },
});

app.get("/api/health", (req, res) => {
  return sendSuccess(res, {
    data: {
      service: "pfe-backend",
      status: "ok",
      timestamp: new Date().toISOString(),
    },
  });
});

app.use("/api/auth", authLimiter, authRouter);
app.use("/api/admin", adminLimiter, adminRouter);
app.use("/api/production", dataReadLimiter, productionRouter);
app.use("/api/alarms", dataReadLimiter, alarmRouter);
app.use("/api/analytics", dataReadLimiter, analyticsRouter);
app.use("/api/machine", machineCommandLimiter, machineRouter);

app.use("/machine/native", express.static(nativeMachineUiDir));
app.get("/machine/native", (_req, res) => {
  res.sendFile(path.join(nativeMachineUiDir, "index.html"));
});

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = { app };
