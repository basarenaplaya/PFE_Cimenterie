const express = require("express");
const { issueMachineCommand, machineCommandSchema } = require("../controllers/machineController");
const { verifyRoles, verifyToken } = require("../middleware/auth");
const { validateBody } = require("../middleware/validate");

const machineRouter = express.Router();

machineRouter.use(verifyToken);
machineRouter.use(verifyRoles("ADMIN", "OPERATOR"));
machineRouter.post("/command", validateBody(machineCommandSchema), issueMachineCommand);

module.exports = {
  machineRouter,
};
