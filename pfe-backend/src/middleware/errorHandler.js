const { env } = require("../config/environment");

function notFoundHandler(req, res, next) {
  res.status(404).json({
    success: false,
    error: {
      code: "NOT_FOUND",
      message: `Route not found: ${req.method} ${req.originalUrl}`,
    },
  });
}

function errorHandler(err, req, res, next) {
  const statusCode = err.statusCode || 500;
  const code = statusCode >= 500 ? "INTERNAL_ERROR" : "REQUEST_ERROR";

  const payload = {
    success: false,
    error: {
      code,
      message: err.message || "An unexpected server error occurred.",
    },
  };

  if (err.details) {
    payload.error.details = err.details;
  }

  if (env.nodeEnv !== "production") {
    payload.error.stack = err.stack;
  }

  res.status(statusCode).json(payload);
}

module.exports = {
  notFoundHandler,
  errorHandler,
};
