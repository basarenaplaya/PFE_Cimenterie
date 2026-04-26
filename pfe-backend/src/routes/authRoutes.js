const express = require("express");
const {
  adminProbe,
  changePassword,
  changePasswordSchema,
  login,
  loginSchema,
  me,
  register,
  registerSchema,
  updateMe,
  updateProfileSchema,
} = require("../controllers/authController");
const { verifyAdmin, verifyToken } = require("../middleware/auth");
const { validateBody } = require("../middleware/validate");

const authRouter = express.Router();

authRouter.post("/register", validateBody(registerSchema), register);
authRouter.post("/login", validateBody(loginSchema), login);
authRouter.get("/me", verifyToken, me);
authRouter.put("/me", verifyToken, validateBody(updateProfileSchema), updateMe);
authRouter.put("/password", verifyToken, validateBody(changePasswordSchema), changePassword);
authRouter.get("/admin-probe", verifyToken, verifyAdmin, adminProbe);

module.exports = { authRouter };
