const Joi = require("joi");
const { asyncHandler } = require("../utils/asyncHandler");
const {
  getAuthenticatedUser,
  loginUser,
  registerUser,
  updateAuthenticatedUserPassword,
  updateAuthenticatedUserProfile,
} = require("../services/authService");
const { emitAdminDashboardNotification } = require("../services/socketService");
const { sendSuccess } = require("../utils/httpResponse");

const passwordPolicy = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,128}$/;

const registerSchema = Joi.object({
  username: Joi.string()
    .trim()
    .pattern(/^[a-zA-Z0-9_.-]+$/)
    .min(3)
    .max(50)
    .required(),
  password: Joi.string().pattern(passwordPolicy).required().messages({
    "string.pattern.base":
      "Password must be 8-128 chars and include uppercase, lowercase, number, and special character.",
  }),
  full_name: Joi.string().trim().min(3).max(100).required(),
  role: Joi.string().valid("ADMIN", "OPERATOR").optional(),
});

const loginSchema = Joi.object({
  username: Joi.string().trim().min(3).max(50).required(),
  password: Joi.string().min(8).max(128).required(),
});

const updateProfileSchema = Joi.object({
  full_name: Joi.string().trim().min(3).max(100).required(),
  avatar_url: Joi.string().trim().max(255).allow("", null).optional(),
});

const changePasswordSchema = Joi.object({
  current_password: Joi.string().min(8).max(128).required(),
  new_password: Joi.string().pattern(passwordPolicy).required().messages({
    "string.pattern.base":
      "Password must be 8-128 chars and include uppercase, lowercase, number, and special character.",
  }),
});

const register = asyncHandler(async (req, res) => {
  const payload = await registerUser({
    ...req.validatedBody,
    ipAddress: req.ip,
  });

  return sendSuccess(res, {
    status: 201,
    data: payload,
  });
});

const login = asyncHandler(async (req, res) => {
  const payload = await loginUser({
    ...req.validatedBody,
    ipAddress: req.ip,
  });

  try {
    emitAdminDashboardNotification({
      type: "login",
      userId: payload.user.id,
      username: payload.user.username,
      full_name: payload.user.full_name || null,
      at: new Date().toISOString(),
    });
  } catch {
    /* non-fatal */
  }

  return sendSuccess(res, {
    data: payload,
  });
});

const me = asyncHandler(async (req, res) => {
  const user = await getAuthenticatedUser(req.auth.userId);

  return sendSuccess(res, {
    data: { user },
  });
});

const updateMe = asyncHandler(async (req, res) => {
  const user = await updateAuthenticatedUserProfile({
    userId: req.auth.userId,
    full_name: req.validatedBody.full_name,
    avatar_url: req.validatedBody.avatar_url,
    ipAddress: req.ip,
  });

  return sendSuccess(res, {
    data: { user },
    message: "Profile updated successfully.",
  });
});

const changePassword = asyncHandler(async (req, res) => {
  await updateAuthenticatedUserPassword({
    userId: req.auth.userId,
    current_password: req.validatedBody.current_password,
    new_password: req.validatedBody.new_password,
    ipAddress: req.ip,
  });

  return sendSuccess(res, {
    message: "Password updated successfully.",
  });
});

const adminProbe = asyncHandler(async (req, res) => {
  return sendSuccess(res, {
    data: {
      auth: req.auth,
    },
    message: "Admin access granted.",
  });
});

module.exports = {
  registerSchema,
  loginSchema,
  updateProfileSchema,
  changePasswordSchema,
  register,
  login,
  me,
  updateMe,
  changePassword,
  adminProbe,
};
