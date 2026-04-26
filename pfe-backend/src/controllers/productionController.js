const Joi = require("joi");
const { asyncHandler } = require("../utils/asyncHandler");
const { sendSuccess } = require("../utils/httpResponse");
const { listProductionLogs } = require("../services/productionService");

const productionQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(200).default(20),
  startDate: Joi.date().iso(),
  endDate: Joi.date().iso(),
  spout_id: Joi.number().integer().positive(),
}).custom((value, helpers) => {
  if (value.startDate && value.endDate && value.startDate > value.endDate) {
    return helpers.message('"startDate" must be less than or equal to "endDate".');
  }

  return value;
});

const getProductionHistory = asyncHandler(async (req, res) => {
  const payload = await listProductionLogs({
    page: req.validatedQuery.page,
    limit: req.validatedQuery.limit,
    startDate: req.validatedQuery.startDate,
    endDate: req.validatedQuery.endDate,
    spoutId: req.validatedQuery.spout_id,
  });

  return sendSuccess(res, {
    data: {
      items: payload.items,
    },
    meta: payload.meta,
  });
});

module.exports = {
  productionQuerySchema,
  getProductionHistory,
};
