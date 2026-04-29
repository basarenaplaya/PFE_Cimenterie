const express = require("express");
const { getKpis, getProductionChart, getSpoutGiveawayToday, patchPricing } = require("../controllers/analyticsController");
const { verifyAdmin, verifyToken } = require("../middleware/auth");

const analyticsRouter = express.Router();

analyticsRouter.use(verifyToken, verifyAdmin);
analyticsRouter.get("/kpis", getKpis);
analyticsRouter.get("/production-chart", getProductionChart);
analyticsRouter.get("/spout-giveaway-today", getSpoutGiveawayToday);
analyticsRouter.patch("/pricing", patchPricing);

module.exports = {
  analyticsRouter,
};
