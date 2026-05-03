const { EventEmitter } = require("events");
const { env } = require("../config/environment");
const {
  TELEMETRY_ALARM_KEYS,
  describeAlarmForLog,
  cloneTelemetryAlarmsShape,
} = require("../constants/alarmTelemetry");
const {
  createLog,
  initializeRealtimeCounterState,
  setCounterBaseline,
} = require("./productionService");
const { startAlarm, clearAlarm } = require("./alarmService");
const { upsertMachineStatus } = require("./machineStatusService");
const { plcService } = require("./plcService");
const { emitRealtimeStatus, emitTelemetryUpdate } = require("./socketService");
const { logAuditAction } = require("./auditService");

const telemetryEvents = new EventEmitter();
const ALARM_CODES = TELEMETRY_ALARM_KEYS;

let engineRunning = false;
let lastObservedCounter = null;
let previousAlarms = null;
let telemetryListener;
let statusListener;
let errorListener;
let lastTelemetry = null;

function cloneAlarms(alarms) {
  return cloneTelemetryAlarmsShape(alarms);
}

async function processProductionHandshake(telemetry) {
  const currentCounter = Number(telemetry.Production_Counter || 0);

  if (lastObservedCounter === null) {
    lastObservedCounter = currentCounter;
    await setCounterBaseline(currentCounter);
    return;
  }

  if (currentCounter < lastObservedCounter) {
    lastObservedCounter = currentCounter;
    await setCounterBaseline(currentCounter);
    return;
  }

  if (currentCounter <= lastObservedCounter) {
    return;
  }

  const result = await createLog({
    productionCounter: currentCounter,
    spoutId: telemetry.Last_Spout_ID,
    weightActual: telemetry.Last_Bag_Weight,
    weightTarget: telemetry.Last_Bag_Target,
    createdAt: new Date(),
  });

  if (result.inserted) {
    lastObservedCounter = currentCounter;
    return;
  }

  lastObservedCounter = Math.max(lastObservedCounter, currentCounter);
}

async function processAlarmTransitions(telemetry) {
  if (!previousAlarms) {
    previousAlarms = cloneAlarms(telemetry.Alarms);
    return;
  }

  for (const alarmCode of ALARM_CODES) {
    const previousState = previousAlarms[alarmCode];
    const currentState = Boolean(telemetry.Alarms[alarmCode]);

    if (!previousState && currentState) {
      await startAlarm({
        alarmCode,
        description: describeAlarmForLog(alarmCode),
        startTime: new Date(),
      });
    }

    if (previousState && !currentState) {
      await clearAlarm({
        alarmCode,
        endTime: new Date(),
      });
    }
  }

  previousAlarms = cloneAlarms(telemetry.Alarms);
}

async function processMachineStatus(telemetry, connected) {
  await upsertMachineStatus({
    machineMode: telemetry.Machine_Mode,
    isRunning: Boolean(connected),
  });
}

async function handleTelemetry(telemetry) {
  try {
    lastTelemetry = telemetry;

    await processProductionHandshake(telemetry);
    await processAlarmTransitions(telemetry);
    await processMachineStatus(telemetry, plcService.isConnected);

    emitTelemetryUpdate(telemetry);
    telemetryEvents.emit("telemetry_update", telemetry);
  } catch (error) {
    console.error(`[realtimeEngine] Telemetry handling failed: ${error.message}`);
  }
}

async function handleStatus(status) {
  try {
    emitRealtimeStatus({
      running: Boolean(status.connected),
      connected: Boolean(status.connected),
      simulator: Boolean(env.plcSimulator),
      pollIntervalMs: Number(env.plcPollIntervalMs || 500),
      lastTelemetryAt: lastTelemetry ? new Date().toISOString() : null,
    });

    if (!status.connected) {
      await upsertMachineStatus({
        machineMode: lastTelemetry ? lastTelemetry.Machine_Mode : 0,
        isRunning: false,
      });
    }
  } catch (error) {
    console.error(`[realtimeEngine] Status handling failed: ${error.message}`);
  }
}

async function startRealtimeEngine() {
  if (engineRunning) {
    return;
  }

  await initializeRealtimeCounterState();

  telemetryListener = (telemetry) => {
    void handleTelemetry(telemetry);
  };

  statusListener = (status) => {
    void handleStatus(status);
  };

  errorListener = (error) => {
    const message = String(error?.message || error || "PLC runtime error");
    console.error(`[realtimeEngine] PLC service error: ${message}`);

    emitRealtimeStatus({
      running: engineRunning,
      connected: false,
      simulator: Boolean(env.plcSimulator),
      pollIntervalMs: Number(env.plcPollIntervalMs || 500),
      lastTelemetryAt: lastTelemetry ? new Date().toISOString() : null,
      error: message,
    });
  };

  plcService.on("telemetry", telemetryListener);
  plcService.on("status", statusListener);
  plcService.on("error", errorListener);

  await plcService.connect();

  engineRunning = true;
  emitRealtimeStatus({
    running: true,
    connected: plcService.isConnected,
    simulator: Boolean(env.plcSimulator),
    pollIntervalMs: Number(env.plcPollIntervalMs || 500),
  });

  try {
    await logAuditAction({
      userId: null,
      action: `REALTIME_ENGINE_START simulator=${Boolean(env.plcSimulator)}`,
      ipAddress: null,
    });
  } catch (error) {
    console.warn(`[realtimeEngine] Could not write start audit event: ${error.message}`);
  }
}

async function stopRealtimeEngine() {
  if (!engineRunning) {
    return;
  }

  if (telemetryListener) {
    plcService.off("telemetry", telemetryListener);
    telemetryListener = undefined;
  }

  if (statusListener) {
    plcService.off("status", statusListener);
    statusListener = undefined;
  }

  if (errorListener) {
    plcService.off("error", errorListener);
    errorListener = undefined;
  }

  await plcService.disconnect();

  engineRunning = false;
  lastObservedCounter = null;
  previousAlarms = null;
  lastTelemetry = null;

  emitRealtimeStatus({ running: false });

  try {
    await logAuditAction({
      userId: null,
      action: "REALTIME_ENGINE_STOP",
      ipAddress: null,
    });
  } catch (error) {
    console.warn(`[realtimeEngine] Could not write stop audit event: ${error.message}`);
  }
}

function onTelemetryUpdate(listener) {
  telemetryEvents.on("telemetry_update", listener);

  return () => {
    telemetryEvents.off("telemetry_update", listener);
  };
}

function getRealtimeEngineStatus() {
  return {
    running: engineRunning,
    pollIntervalMs: Number(env.plcPollIntervalMs || 500),
    simulator: Boolean(env.plcSimulator),
    plcConnected: plcService.isConnected,
  };
}

module.exports = {
  startRealtimeEngine,
  stopRealtimeEngine,
  onTelemetryUpdate,
  getRealtimeEngineStatus,
};
