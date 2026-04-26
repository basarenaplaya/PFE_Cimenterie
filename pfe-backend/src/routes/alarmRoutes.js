const express = require("express");
const { alarmQuerySchema, getAlarmHistory } = require("../controllers/alarmController");
const { verifyAdmin, verifyToken } = require("../middleware/auth");
const { validateQuery } = require("../middleware/validate");

const alarmRouter = express.Router();

alarmRouter.use(verifyToken, verifyAdmin);
alarmRouter.get("/", validateQuery(alarmQuerySchema), getAlarmHistory);

module.exports = {
  alarmRouter,
};
