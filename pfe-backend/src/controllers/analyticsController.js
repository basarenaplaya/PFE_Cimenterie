const { asyncHandler } = require("../utils/asyncHandler");
const { HttpError } = require("../utils/httpError");
const { sendSuccess } = require("../utils/httpResponse");
const { logAuditAction } = require("../services/auditService");
const { setPricePerTon } = require("../services/dashboardSettingsService");
const { getTodayKpis, getTodayProductionChart, getTodaySpoutGiveawayChart } = require("../services/analyticsService");

const getKpis = asyncHandler(async (req, res) => {
  const kpis = await getTodayKpis();

  return sendSuccess(res, {
    data: {
      kpis,
    },
  });
});

const getProductionChart = asyncHandler(async (req, res) => {
  const chart = await getTodayProductionChart();

  return sendSuccess(res, {
    data: {
      chart,
    },
  });
});

const getSpoutGiveawayToday = asyncHandler(async (req, res) => {
  const chart = await getTodaySpoutGiveawayChart();

  return sendSuccess(res, {
    data: {
      chart,
    },
  });
});

const patchPricing = asyncHandler(async (req, res) => {
  const body = req.body;
  if (!body || typeof body !== "object" || body.price_per_ton_tnd === undefined) {
    throw new HttpError(400, "Request body must include price_per_ton_tnd.");
  }

  const price_per_ton_tnd = await setPricePerTon(body.price_per_ton_tnd);

  await logAuditAction({
    userId: req.auth?.userId ?? null,
    action: `ADMIN_ANALYTICS_PRICING_SET price_per_ton_tnd=${price_per_ton_tnd}`,
    ipAddress: req.ip || req.socket?.remoteAddress || null,
  });

  return sendSuccess(res, {
    data: {
      price_per_ton_tnd,
    },
  });
});

module.exports = {
  getKpis,
  getProductionChart,
  getSpoutGiveawayToday,
  patchPricing,
};
