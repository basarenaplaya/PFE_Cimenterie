const express = require("express");
const { getKpis, getProductionChart } = require("../controllers/analyticsController");
const { verifyAdmin, verifyToken } = require("../middleware/auth");

const analyticsRouter = express.Router();

analyticsRouter.use(verifyToken, verifyAdmin);
analyticsRouter.get("/kpis", getKpis);
analyticsRouter.get("/production-chart", getProductionChart);

module.exports = {
  analyticsRouter,
};
