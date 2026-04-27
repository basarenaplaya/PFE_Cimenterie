const jwt = require("jsonwebtoken");
const { env } = require("../config/environment");
const { HttpError } = require("../utils/httpError");

const MACHINE_REALTIME_ROLES = ["ADMIN", "OPERATOR"];

function extractBearerToken(authHeader) {
  if (!authHeader || typeof authHeader !== "string") {
    return null;
  }

  const [scheme, token] = authHeader.split(" ");
  if (scheme !== "Bearer" || !token) {
    return null;
  }

  return token;
}

/**
 * Verifies a raw JWT string (Bearer body or Socket.IO `auth.token`).
 * @returns {{ userId: string, username?: string, role: string }}
 */
function getAuthFromJwtString(token) {
  if (!token || typeof token !== "string" || !token.trim()) {
    throw new HttpError(401, "Missing or malformed authorization token.");
  }

  try {
    const decoded = jwt.verify(token.trim(), env.jwtSecret);

    if (!decoded.sub || !decoded.role) {
      throw new HttpError(401, "Invalid token payload.");
    }

    return {
      userId: decoded.sub,
      username: decoded.username,
      role: decoded.role,
    };
  } catch (error) {
    if (error instanceof HttpError) {
      throw error;
    }
    throw new HttpError(401, "Invalid or expired token.");
  }
}

function assertMachineRealtimeRole(auth) {
  if (!auth || !MACHINE_REALTIME_ROLES.includes(auth.role)) {
    throw new HttpError(403, "You do not have access to realtime telemetry.");
  }
}

function verifyToken(req, res, next) {
  const token = extractBearerToken(req.headers.authorization);

  if (!token) {
    return next(new HttpError(401, "Missing or malformed authorization token."));
  }

  try {
    req.auth = getAuthFromJwtString(token);
    return next();
  } catch (error) {
    return next(error);
  }
}

function verifyAdmin(req, res, next) {
  if (!req.auth || req.auth.role !== "ADMIN") {
    return next(new HttpError(403, "Admin privileges are required for this resource."));
  }

  return next();
}

function verifyRoles(...allowedRoles) {
  return (req, res, next) => {
    if (!req.auth || !allowedRoles.includes(req.auth.role)) {
      return next(new HttpError(403, "You do not have access to this resource."));
    }

    return next();
  };
}

module.exports = {
  verifyToken,
  verifyAdmin,
  verifyRoles,
  extractBearerToken,
  getAuthFromJwtString,
  assertMachineRealtimeRole,
  MACHINE_REALTIME_ROLES,
};
