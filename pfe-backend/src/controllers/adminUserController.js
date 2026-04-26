const Joi = require("joi");
const { asyncHandler } = require("../utils/asyncHandler");
const {
  createUser,
  deleteUser,
  findUserById,
  listUsers,
  updateUser,
  updateUserStatus,
} = require("../services/userAdminService");
const { HttpError } = require("../utils/httpError");
const { sendSuccess } = require("../utils/httpResponse");

const passwordPolicy = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,128}$/;

const createUserSchema = Joi.object({
  username: Joi.string().trim().pattern(/^[a-zA-Z0-9_.-]+$/).min(3).max(50).required(),
  password: Joi.string().pattern(passwordPolicy).required(),
  full_name: Joi.string().trim().min(3).max(100).required(),
  role: Joi.string().valid("ADMIN", "OPERATOR").default("OPERATOR"),
  avatar_url: Joi.string().trim().max(255).allow("", null).optional(),
});

const updateStatusSchema = Joi.object({
  is_active: Joi.boolean().required(),
});

const updateUserSchema = Joi.object({
  full_name: Joi.string().trim().min(3).max(100),
  role: Joi.string().valid("ADMIN", "OPERATOR"),
  avatar_url: Joi.string().trim().max(255).allow("", null),
  is_active: Joi.boolean(),
})
  .min(1)
  .required();

const listUsersQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  search: Joi.string().trim().max(100).allow("", null).optional(),
});

const userIdParamsSchema = Joi.object({
  id: Joi.number().integer().positive().required(),
});

const createManagedUser = asyncHandler(async (req, res) => {
  const user = await createUser({
    ...req.validatedBody,
    actor: {
      userId: req.auth.userId,
      ipAddress: req.ip,
    },
  });

  return sendSuccess(res, {
    status: 201,
    data: { user },
  });
});

const getUsers = asyncHandler(async (req, res) => {
  const { error, value } = listUsersQuerySchema.validate(req.query, {
    stripUnknown: true,
    convert: true,
  });

  if (error) {
    throw new HttpError(400, "Invalid users query params.", error.details.map((d) => d.message));
  }

  const payload = await listUsers(value);

  return sendSuccess(res, {
    data: {
      items: payload.items,
    },
    meta: payload.meta,
  });
});

const getUserById = asyncHandler(async (req, res) => {
  const user = await findUserById(req.validatedParams.id);

  if (!user) {
    throw new HttpError(404, "User not found.");
  }

  return sendSuccess(res, {
    data: { user },
  });
});

const setUserStatus = asyncHandler(async (req, res) => {
  const user = await updateUserStatus({
    targetUserId: req.validatedParams.id,
    isActive: req.validatedBody.is_active,
    actor: {
      userId: req.auth.userId,
      ipAddress: req.ip,
    },
  });

  return sendSuccess(res, {
    data: { user },
  });
});

const updateUserHandler = asyncHandler(async (req, res) => {
  const user = await updateUser({
    targetUserId: req.validatedParams.id,
    payload: req.validatedBody,
    actor: {
      userId: req.auth.userId,
      ipAddress: req.ip,
    },
  });

  return sendSuccess(res, {
    data: { user },
  });
});

const removeUser = asyncHandler(async (req, res) => {
  const removed = await deleteUser({
    targetUserId: req.validatedParams.id,
    actor: {
      userId: req.auth.userId,
      ipAddress: req.ip,
    },
  });

  return sendSuccess(res, {
    data: {
      deleted: removed,
    },
  });
});

module.exports = {
  createUserSchema,
  updateStatusSchema,
  updateUserSchema,
  userIdParamsSchema,
  createManagedUser,
  getUsers,
  getUserById,
  updateUserHandler,
  setUserStatus,
  removeUser,
};
