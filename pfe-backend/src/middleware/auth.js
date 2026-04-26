const jwt = require("jsonwebtoken");
const { env } = require("../config/environment");
const { HttpError } = require("../utils/httpError");

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

function verifyToken(req, res, next) {
  const token = extractBearerToken(req.headers.authorization);

  if (!token) {
    return next(new HttpError(401, "Missing or malformed authorization token."));
  }

  try {
    const decoded = jwt.verify(token, env.jwtSecret);

    if (!decoded.sub || !decoded.role) {
      return next(new HttpError(401, "Invalid token payload."));
    }

    req.auth = {
      userId: decoded.sub,
      username: decoded.username,
      role: decoded.role,
    };

    return next();
  } catch (error) {
    return next(new HttpError(401, "Invalid or expired token."));
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
};
