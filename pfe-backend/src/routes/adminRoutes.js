const express = require("express");
const {
  createManagedUser,
  createUserSchema,
  getUserById,
  getUsers,
  removeUser,
  setUserStatus,
  updateStatusSchema,
  updateUserHandler,
  updateUserSchema,
  userIdParamsSchema,
} = require("../controllers/adminUserController");
const {
  cameraIdParamsSchema,
  cameraSchema,
  cameraSnapshotBodySchema,
  createCameraHandler,
  deleteCameraHandler,
  getCameraByIdHandler,
  listCamerasHandler,
  patchCameraSnapshotHandler,
  updateCameraHandler,
} = require("../controllers/cameraController");
const { getAuditLogs } = require("../controllers/auditController");
const { verifyAdmin, verifyToken } = require("../middleware/auth");
const { validateBody, validateParams } = require("../middleware/validate");

const adminRouter = express.Router();

adminRouter.use(verifyToken, verifyAdmin);

adminRouter.post("/users", validateBody(createUserSchema), createManagedUser);
adminRouter.get("/users", getUsers);
adminRouter.get("/users/:id", validateParams(userIdParamsSchema), getUserById);
adminRouter.put(
  "/users/:id",
  validateParams(userIdParamsSchema),
  validateBody(updateUserSchema),
  updateUserHandler
);
adminRouter.put(
  "/users/:id/status",
  validateParams(userIdParamsSchema),
  validateBody(updateStatusSchema),
  setUserStatus
);
adminRouter.delete("/users/:id", validateParams(userIdParamsSchema), removeUser);

adminRouter.post("/cameras", validateBody(cameraSchema), createCameraHandler);
adminRouter.get("/cameras", listCamerasHandler);
adminRouter.get("/cameras/:id", validateParams(cameraIdParamsSchema), getCameraByIdHandler);
adminRouter.put(
  "/cameras/:id",
  validateParams(cameraIdParamsSchema),
  validateBody(cameraSchema),
  updateCameraHandler
);
adminRouter.patch(
  "/cameras/:id/snapshot",
  validateParams(cameraIdParamsSchema),
  validateBody(cameraSnapshotBodySchema),
  patchCameraSnapshotHandler
);
adminRouter.delete("/cameras/:id", validateParams(cameraIdParamsSchema), deleteCameraHandler);

adminRouter.get("/audit-logs", getAuditLogs);

module.exports = {
  adminRouter,
};
