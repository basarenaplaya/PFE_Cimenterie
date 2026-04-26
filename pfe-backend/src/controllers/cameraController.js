const Joi = require("joi");
const { asyncHandler } = require("../utils/asyncHandler");
const {
  createCamera,
  deleteCamera,
  findCameraById,
  listCameras,
  updateCamera,
  updateCameraSnapshot,
} = require("../services/cameraService");
const { HttpError } = require("../utils/httpError");
const { sendSuccess } = require("../utils/httpResponse");

function validateCameraUrl(value, helpers) {
  let parsed;

  try {
    parsed = new URL(value);
  } catch (error) {
    return helpers.message('"ip_url" must be a valid absolute URL.');
  }

  if (!["rtsp:", "http:", "https:"].includes(parsed.protocol)) {
    return helpers.message('"ip_url" must use rtsp://, http://, or https://');
  }

  if (!parsed.hostname) {
    return helpers.message('"ip_url" must include a valid host.');
  }

  if (parsed.username || parsed.password) {
    return helpers.message('"ip_url" must not include embedded credentials.');
  }

  return value;
}

const cameraSchema = Joi.object({
  cam_name: Joi.string().trim().min(2).max(50).required(),
  ip_url: Joi.string().trim().max(255).required().custom(validateCameraUrl),
});

const cameraIdParamsSchema = Joi.object({
  id: Joi.number().integer().positive().required(),
});

const DATA_URL_SNAPSHOT_PATTERN =
  /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/;

const cameraListQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  search: Joi.string().trim().max(100).allow("", null).optional(),
});

const cameraSnapshotBodySchema = Joi.object({
  last_snapshot: Joi.string()
    .max(5_000_000)
    .pattern(DATA_URL_SNAPSHOT_PATTERN)
    .required()
    .messages({
      "string.pattern.base":
        '"last_snapshot" must be a data URL for image/jpeg, image/png, or image/webp.',
    }),
});

const createCameraHandler = asyncHandler(async (req, res) => {
  const camera = await createCamera({
    ...req.validatedBody,
    actor: {
      userId: req.auth.userId,
      ipAddress: req.ip,
    },
  });

  return sendSuccess(res, {
    status: 201,
    data: { camera },
  });
});

const listCamerasHandler = asyncHandler(async (req, res) => {
  const { error, value } = cameraListQuerySchema.validate(req.query, {
    stripUnknown: true,
    convert: true,
  });

  if (error) {
    throw new HttpError(400, "Invalid camera query params.", error.details.map((d) => d.message));
  }

  const rawSnapshots = req.query.include_snapshots;
  const include_snapshots =
    rawSnapshots === true ||
    rawSnapshots === 1 ||
    rawSnapshots === "1" ||
    String(rawSnapshots || "")
      .trim()
      .toLowerCase() === "true";

  const payload = await listCameras({ ...value, include_snapshots });

  return sendSuccess(res, {
    data: {
      items: payload.items,
    },
    meta: payload.meta,
  });
});

const getCameraByIdHandler = asyncHandler(async (req, res) => {
  const camera = await findCameraById(req.validatedParams.id);

  if (!camera) {
    throw new HttpError(404, "Camera not found.");
  }

  return sendSuccess(res, {
    data: { camera },
  });
});

const updateCameraHandler = asyncHandler(async (req, res) => {
  const camera = await updateCamera({
    cameraId: req.validatedParams.id,
    ...req.validatedBody,
    actor: {
      userId: req.auth.userId,
      ipAddress: req.ip,
    },
  });

  return sendSuccess(res, {
    data: { camera },
  });
});

const deleteCameraHandler = asyncHandler(async (req, res) => {
  const removed = await deleteCamera({
    cameraId: req.validatedParams.id,
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

const patchCameraSnapshotHandler = asyncHandler(async (req, res) => {
  const camera = await updateCameraSnapshot({
    cameraId: req.validatedParams.id,
    last_snapshot: req.validatedBody.last_snapshot,
    actor: {
      userId: req.auth.userId,
      ipAddress: req.ip,
    },
  });

  return sendSuccess(res, {
    data: { camera },
  });
});

module.exports = {
  cameraSchema,
  cameraIdParamsSchema,
  cameraSnapshotBodySchema,
  createCameraHandler,
  listCamerasHandler,
  getCameraByIdHandler,
  updateCameraHandler,
  patchCameraSnapshotHandler,
  deleteCameraHandler,
};
