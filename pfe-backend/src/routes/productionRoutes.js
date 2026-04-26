const express = require("express");
const { getProductionHistory, productionQuerySchema } = require("../controllers/productionController");
const { verifyAdmin, verifyToken } = require("../middleware/auth");
const { validateQuery } = require("../middleware/validate");

const productionRouter = express.Router();

productionRouter.use(verifyToken, verifyAdmin);
productionRouter.get("/", validateQuery(productionQuerySchema), getProductionHistory);

module.exports = {
  productionRouter,
};
