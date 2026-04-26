const { executeQuery } = require("../config/database");

const MODE_LABELS = {
  0: "MANUAL",
  1: "LOCAL",
  2: "CENTRAL",
};

function mapMachineMode(modeValue) {
  return MODE_LABELS[Number(modeValue)] || MODE_LABELS[0];
}

async function upsertMachineStatus({ machineMode, isRunning }) {
  const currentMode = mapMachineMode(machineMode);
  const running = Boolean(isRunning);

  await executeQuery(
    `INSERT INTO machine_status (id, current_mode, is_running)
     VALUES (1, ?, ?)
     ON DUPLICATE KEY UPDATE
       current_mode = VALUES(current_mode),
       is_running = VALUES(is_running),
       last_update = CURRENT_TIMESTAMP`,
    [currentMode, running]
  );

  return {
    id: 1,
    current_mode: currentMode,
    is_running: running,
  };
}

module.exports = {
  mapMachineMode,
  upsertMachineStatus,
};
