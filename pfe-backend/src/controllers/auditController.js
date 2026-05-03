const Joi = require("joi");
const { asyncHandler } = require("../utils/asyncHandler");
const { HttpError } = require("../utils/httpError");
const { sendSuccess } = require("../utils/httpResponse");
const { listAuditLogs } = require("../services/auditService");

const auditQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(200).default(20),
  action: Joi.string().trim().max(255).allow("", null).optional(),
  user_id: Joi.number().integer().positive().optional(),
  startDate: Joi.date().iso(),
  endDate: Joi.date().iso(),
}).custom((value, helpers) => {
  if (value.startDate && value.endDate && value.startDate > value.endDate) {
    return helpers.message('"startDate" must be less than or equal to "endDate".');
  }

  return value;
});

const getAuditLogs = asyncHandler(async (req, res) => {
  const { error, value } = auditQuerySchema.validate(req.query, {
    stripUnknown: true,
    convert: true,
  });

  if (error) {
    throw new HttpError(400, "Invalid audit query params.", error.details.map((d) => d.message));
  }

  const payload = await listAuditLogs({
    page: value.page,
    limit: value.limit,
    action: value.action,
    userId: value.user_id,
    startDate: value.startDate,
    endDate: value.endDate,
  });

  return sendSuccess(res, {
    data: {
      items: payload.items,
    },
    meta: payload.meta,
  });
});

module.exports = {
  getAuditLogs,
};
