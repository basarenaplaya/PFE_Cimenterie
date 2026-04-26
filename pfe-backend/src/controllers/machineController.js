const Joi = require("joi");
const { asyncHandler } = require("../utils/asyncHandler");
const { HttpError } = require("../utils/httpError");
const { sendSuccess } = require("../utils/httpResponse");
const { logAuditAction } = require("../services/auditService");
const { plcService } = require("../services/plcService");

const COMMAND_ALIASES = Object.freeze({
  cmd_mode_local: "MODE_LOCAL",
  cmd_mode_central: "MODE_CENTRAL",
  cmd_marche: "START",
  cmd_arret: "STOP",
  cmd_presence_sac: "PRESENCE_BAG",
  cmd_arret_urgence: "EMERGENCY_STOP",
  cmd_reset_alarmes: "RESET_ALARMS",
  cmd_set_target_weight: "SET_TARGET_WEIGHT",
  cmd_set_active_spout: "SET_ACTIVE_SPOUT",
});

const MACHINE_COMMANDS = Object.freeze({
  MODE_LOCAL: {
    description: "Switch the machine to local mode.",
    actions: [
      { alias: "CMD_Mode_Local", value: true },
      { alias: "CMD_Mode_Central", value: false },
    ],
  },
  MODE_CENTRAL: {
    description: "Switch the machine to central mode.",
    actions: [
      { alias: "CMD_Mode_Local", value: false },
      { alias: "CMD_Mode_Central", value: true },
    ],
  },
  START: {
    description: "Start the packing cycle.",
    actions: [{ alias: "CMD_Marche_Web", value: true }],
  },
  STOP: {
    description: "Stop the packing cycle.",
    actions: [{ alias: "CMD_Arret_Web", value: true }],
  },
  PRESENCE_BAG: {
    description: "Confirm bag presence.",
    actions: [{ alias: "CMD_Presence_Sac_Web", value: true }],
  },
  EMERGENCY_STOP: {
    description: "Trigger the emergency stop line.",
    actions: [{ alias: "CMD_Arret_Urgence_Web", value: true }],
  },
  RESET_ALARMS: {
    description: "Reset active alarms.",
    actions: [{ alias: "CMD_Reset_Alarmes", value: true }],
  },
  SET_TARGET_WEIGHT: {
    description: "Update the target bag weight.",
    requiresValue: true,
    actions: (value) => [{ alias: "Consigne_Poids", value }],
  },
  SET_ACTIVE_SPOUT: {
    description: "Select the active spout.",
    requiresValue: true,
    actions: (value) => [{ alias: "Active_Spout_ID", value }],
  },
});

const machineCommandSchema = Joi.object({
  command: Joi.string().required(),
  value: Joi.alternatives().try(Joi.number(), Joi.boolean()).optional(),
  note: Joi.string().trim().max(120).allow("", null).optional(),
}).custom((payload, helpers) => {
  const canonicalCommand = COMMAND_ALIASES[payload.command] || payload.command;
  const definition = MACHINE_COMMANDS[canonicalCommand];

  if (!definition) {
    return helpers.message('"command" is not supported.');
  }

  payload.command = canonicalCommand;

  if (definition.requiresValue && payload.value === undefined) {
    return helpers.message(`"${payload.command}" requires a value.`);
  }

  if (payload.command === "SET_TARGET_WEIGHT") {
    const numericValue = Number(payload.value);
    if (!Number.isFinite(numericValue) || numericValue <= 0 || numericValue > 1000) {
      return helpers.message('"value" must be a number between 0 and 1000 for target weight commands.');
    }
  }

  if (payload.command === "SET_ACTIVE_SPOUT") {
    const numericValue = Number.parseInt(payload.value, 10);
    if (!Number.isFinite(numericValue) || numericValue < 1 || numericValue > 8) {
      return helpers.message('"value" must be a spout number between 1 and 8.');
    }
  }

  return payload;
});

function resolveCommandActions(command, value) {
  const definition = MACHINE_COMMANDS[command];

  if (!definition) {
    throw new HttpError(400, "Unsupported machine command.");
  }

  if (typeof definition.actions === "function") {
    return definition.actions(value);
  }

  return definition.actions;
}

function buildAuditAction(command, value, outcome) {
  const parts = ["MACHINE_COMMAND", `command=${command}`, `outcome=${outcome}`];

  if (value !== undefined && value !== null && value !== "") {
    parts.push(`value=${value}`);
  }

  return parts.join(" ");
}

async function dispatchCommand(actions) {
  for (const action of actions) {
    await plcService.writeTag(action.alias, action.value);
  }
}

const issueMachineCommand = asyncHandler(async (req, res) => {
  const { command, value, note } = req.validatedBody;
  const actions = resolveCommandActions(command, value);

  await logAuditAction({
    userId: req.auth.userId,
    action: buildAuditAction(command, value, "attempt"),
    ipAddress: req.ip,
  });

  try {
    await dispatchCommand(actions);
  } catch (error) {
    await logAuditAction({
      userId: req.auth.userId,
      action: buildAuditAction(command, value, `failed:${String(error.message || error).slice(0, 40)}`),
      ipAddress: req.ip,
    });

    throw error;
  }

  const responsePayload = {
    command,
    description: MACHINE_COMMANDS[command].description,
    value: value ?? null,
    applied: actions,
    note: note || null,
    connected: plcService.isConnected,
  };

  await logAuditAction({
    userId: req.auth.userId,
    action: buildAuditAction(command, value, "success"),
    ipAddress: req.ip,
  });

  return sendSuccess(res, {
    data: {
      command: responsePayload,
    },
  });
});

module.exports = {
  MACHINE_COMMANDS,
  machineCommandSchema,
  issueMachineCommand,
};
