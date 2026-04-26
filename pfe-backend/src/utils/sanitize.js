const xss = require("xss");

function sanitizeText(value) {
  if (typeof value !== "string") return value;
  return xss(value.trim());
}

function sanitizeFields(payload, fields) {
  const sanitized = { ...payload };
  for (const field of fields) {
    if (Object.prototype.hasOwnProperty.call(sanitized, field)) {
      sanitized[field] = sanitizeText(sanitized[field]);
    }
  }
  return sanitized;
}

module.exports = {
  sanitizeText,
  sanitizeFields,
};
