const { asyncHandler } = require("../utils/asyncHandler");
const { sendSuccess } = require("../utils/httpResponse");
const { getTodayKpis, getTodayProductionChart } = require("../services/analyticsService");

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

module.exports = {
  getKpis,
  getProductionChart,
};
