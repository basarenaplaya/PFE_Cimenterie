const { EventEmitter } = require("events");
const { env } = require("../config/environment");
const { HttpError } = require("../utils/httpError");
const { TELEMETRY_ALARM_KEYS } = require("../constants/alarmTelemetry");

const PLC_MEMORY_MAP = Object.freeze({
  Poids_Reel_Web: "DB4,REAL2",
  Etat_Mode_Local_Web: "DB4,X6.0",
  Etat_Mode_Central_Web: "DB4,X6.1",
  Etat_Moteur_Ensacheuse_Web: "DB4,X6.2",
  Etat_Moteur_Bande_Web: "DB4,X6.3",
  Etat_Defaut_Web: "DB4,X6.5",
  Arret_Urgence: "DB4,X6.6",
  Defaut_Ecoulement_Ciment: "DB4,X6.7",
  Defaut_Capteur: "DB4,X7.0",
  Defaut_Moteur: "DB4,X7.1",
  Defaut_Dejoncteur: "DB4,X7.2",
  Consigne_Poids: "DB4,REAL8",
  Angle_Ensacheuse: "DB4,REAL12",
  Active_Spout_ID: "DB4,INT22",
  Bags_Produced_Counter: "DB4,DINT26",
  Last_Spout_ID: "DB4,INT30",
});

const PLC_COMMAND_MAP = Object.freeze({
  CMD_Mode_Local: "DB4,X0.0",
  CMD_Mode_Central: "DB4,X0.1",
  CMD_Marche_Web: "DB4,X0.2",
  CMD_Arret_Web: "DB4,X0.3",
  CMD_Presence_Sac_Web: "DB4,X0.4",
  CMD_Arret_Urgence_Web: "DB4,X0.5",
  CMD_Reset_Alarmes: "DB4,X0.6",
  CMD_Heartbeat_Web: "DB4,X35.0",
  Consigne_Poids: "DB4,REAL8",
});

const PLC_READ_ALIASES = Object.freeze(Object.keys(PLC_MEMORY_MAP));

/** PLC watchdog: DB4, offset 35.0, Bool — server liveness pulse (real PLC only). */
const HEARTBEAT_COMMAND_ALIAS = "CMD_Heartbeat_Web";
const HEARTBEAT_INTERVAL_MS = 2000;

function randomInRange(min, max) {
  return Math.random() * (max - min) + min;
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function asBool(value) {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    return normalized === "true" || normalized === "1";
  }
  return false;
}

function asFiniteNumber(value, fallback = 0) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function asInteger(value, fallback = 0) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeTelemetry(values) {
  const weight = asFiniteNumber(values.Poids_Reel_Web, 0);
  const targetWeight = asFiniteNumber(values.Consigne_Poids, 50);
  const modeLocal = asBool(values.Etat_Mode_Local_Web);
  const modeCentral = asBool(values.Etat_Mode_Central_Web);
  const motorEnsacheuse = asBool(values.Etat_Moteur_Ensacheuse_Web);
  const motorBande = asBool(values.Etat_Moteur_Bande_Web);
  const defaut = asBool(values.Etat_Defaut_Web);
  const au = asBool(values.Arret_Urgence);
  const defautEcoulement = asBool(values.Defaut_Ecoulement_Ciment);
  const defautCapteur = asBool(values.Defaut_Capteur);
  const defautMoteur = asBool(values.Defaut_Moteur);
  const defautDejoncteur = asBool(values.Defaut_Dejoncteur);
  const activeSpout = asInteger(values.Active_Spout_ID, 0);
  const counter = asInteger(values.Bags_Produced_Counter, 0);
  const lastSpoutId = asInteger(values.Last_Spout_ID, 0);
  const angle = asFiniteNumber(values.Angle_Ensacheuse, 0);
  const machineMode = modeCentral ? 2 : modeLocal ? 1 : 0;

  return {
    // Legacy UI contract (source of truth for animations/state).
    weight,
    target_weight: targetWeight,
    motor_ensacheuse: motorEnsacheuse,
    motor_bande: motorBande,
    mode_local: modeLocal,
    mode_central: modeCentral,
    defaut,
    arret_urgence: au,
    defaut_ecoulement: defautEcoulement,
    defaut_capteur: defautCapteur,
    defaut_moteur: defautMoteur,
    defaut_dejoncteur: defautDejoncteur,
    active_spout: activeSpout,
    angle,
    Bags_Produced_Counter: counter,
    _ts: Date.now(),

    // Canonical fields retained for backend services compatibility.
    Production_Counter: counter,
    Last_Bag_Weight: weight,
    Last_Bag_Target: targetWeight,
    Last_Spout_ID: lastSpoutId > 0 ? lastSpoutId : activeSpout,
    Live_Weight: weight,
    Machine_Mode: machineMode,
    Alarms: {
      AU: au,
      Err_1: defautEcoulement,
      Err_2: defautCapteur,
      Err_3: defautMoteur,
      Err_4: defautDejoncteur,
    },
  };
}

function isDbCompatibleTelemetry(telemetry) {
  if (!telemetry || typeof telemetry !== "object") return false;

  const scalarFields = [
    "Production_Counter",
    "Last_Bag_Weight",
    "Last_Bag_Target",
    "Last_Spout_ID",
    "Live_Weight",
    "Machine_Mode",
  ];

  for (const field of scalarFields) {
    if (!Number.isFinite(Number(telemetry[field]))) {
      return false;
    }
  }

  if (!telemetry.Alarms || typeof telemetry.Alarms !== "object") {
    return false;
  }

  for (const alarmKey of TELEMETRY_ALARM_KEYS) {
    if (typeof telemetry.Alarms[alarmKey] !== "boolean") {
      return false;
    }
  }

  return true;
}

class PlcService extends EventEmitter {
  constructor(options = {}) {
    super();

    this.simulator =
      options.simulator !== undefined ? Boolean(options.simulator) : Boolean(env.plcSimulator);
    this.pollIntervalMs =
      options.pollIntervalMs !== undefined
        ? Number(options.pollIntervalMs)
        : Number(env.plcPollIntervalMs || 500);
    this.reconnectBackoffMs =
      options.reconnectBackoffMs !== undefined
        ? Number(options.reconnectBackoffMs)
        : Number(env.plcReconnectBackoffMs || 5000);

    this.plcIp = options.plcIp || env.plcIp || "127.0.0.1";
    this.plcPort = Number(options.plcPort || env.plcPort || 102);
    this.plcRack = Number(options.plcRack || env.plcRack || 0);
    this.plcSlot = Number(options.plcSlot || env.plcSlot || 1);

    this.simTargetMin = Number(options.simTargetMin || env.plcSimTargetMin || 49.5);
    this.simTargetMax = Number(options.simTargetMax || env.plcSimTargetMax || 50.5);

    this._client = null;
    this._reconnectTimer = null;
    this._pollTimer = null;
    this._connectPromise = null;
    this._connected = false;
    this._initialized = false;
    this._stopping = false;
    this._writeQueue = Promise.resolve();
    this._readInFlight = false;
    this.lastTelemetry = null;
    this._heartbeatTimer = null;

    this._simState = {
      Poids_Reel_Web: 0,
      Consigne_Poids: Number(randomInRange(this.simTargetMin, this.simTargetMax).toFixed(2)),
      Etat_Mode_Local_Web: false,
      Etat_Mode_Central_Web: true,
      Etat_Moteur_Ensacheuse_Web: false,
      Etat_Moteur_Bande_Web: false,
      Etat_Defaut_Web: false,
      Arret_Urgence: false,
      Defaut_Ecoulement_Ciment: false,
      Defaut_Capteur: false,
      Defaut_Moteur: false,
      Defaut_Dejoncteur: false,
      Angle_Ensacheuse: 0,
      Active_Spout_ID: 1,
      Bags_Produced_Counter: 0,
      Last_Spout_ID: 1,
    };
  }

  get isConnected() {
    return this._connected;
  }

  get contract() {
    return PLC_MEMORY_MAP;
  }

  async initialize() {
    this._initialized = true;
    return this.connect();
  }

  async connect() {
    if (this._connectPromise) {
      return this._connectPromise;
    }

    this._stopping = false;
    this._initialized = true;

    if (this.simulator) {
      this._setConnected(true);
      this._startPolling();
      await this._emitCurrentTelemetry();
      return;
    }

    this._connectPromise = this._connectReal()
      .catch((error) => {
        console.error(`[plcService] Initial PLC connection failed: ${error.message}`);
        this._scheduleReconnect();
      })
      .finally(() => {
        this._connectPromise = null;
      });

    return this._connectPromise;
  }

  async readSnapshot() {
    if (!this._initialized) {
      await this.initialize();
    }

    if (this.simulator) {
      this._stepSimulator();
      return normalizeTelemetry(this._simState);
    }

    return this._readRealSnapshot();
  }

  async shutdown() {
    await this.disconnect();
    this._initialized = false;
    this.lastTelemetry = null;
  }

  async disconnect() {
    this._stopping = true;
    this._stopHeartbeat();

    if (this._pollTimer) {
      clearInterval(this._pollTimer);
      this._pollTimer = null;
    }

    if (this._reconnectTimer) {
      clearTimeout(this._reconnectTimer);
      this._reconnectTimer = null;
    }

    if (this._client) {
      await new Promise((resolve) => {
        try {
          this._client.dropConnection(() => resolve());
        } catch (error) {
          resolve();
        }
      });
      this._client = null;
    }

    this._setConnected(false);
    this._readInFlight = false;
  }

  async writeTag(alias, value) {
    this._assertCommandExists(alias);

    return this._enqueueWrite(async () => {
      if (this.simulator) {
        this._applySimulatorCommand(alias, value);
        return;
      }

      if (!this._connected) {
        throw new Error("PLC is not connected");
      }

      await this._writeOnce(alias, value);
    });
  }

  async _connectReal() {
    this._stopHeartbeat();

    const nodes7 = require("nodes7");

    this._client = new nodes7();
    this._client.setTranslationCB((tag) => PLC_MEMORY_MAP[tag] || PLC_COMMAND_MAP[tag]);

    await new Promise((resolve, reject) => {
      this._client.initiateConnection(
        {
          host: this.plcIp,
          port: this.plcPort,
          rack: this.plcRack,
          slot: this.plcSlot,
        },
        (error) => {
          if (error) {
            reject(error);
            return;
          }

          resolve();
        }
      );
    });

    this._client.addItems(PLC_READ_ALIASES);
    this._setConnected(true);
    this._startPolling();
    await this._emitCurrentTelemetry();

    console.log(`[plcService] Connected to PLC ${this.plcIp}:${this.plcPort}`);
    if (!this._stopping) {
      this._startHeartbeat();
    }
  }

  async _readRealSnapshot() {
    if (!this._connected || !this._client) {
      throw new HttpError(503, "PLC connection unavailable.");
    }

    try {
      const values = await new Promise((resolve, reject) => {
        this._client.readAllItems((error, result) => {
          if (error) {
            reject(error);
            return;
          }

          resolve(result || {});
        });
      });

      return normalizeTelemetry(values);
    } catch (error) {
      this._setConnected(false);
      console.error(`[plcService] PLC read failed: ${error.message}`);
      this._scheduleReconnect();
      throw new HttpError(503, "PLC read failed.");
    }
  }

  _scheduleReconnect() {
    if (this._reconnectTimer || this.simulator || this._stopping) {
      return;
    }

    this._reconnectTimer = setTimeout(async () => {
      this._reconnectTimer = null;

      try {
        await this._connectReal();
      } catch (error) {
        console.error(`[plcService] PLC reconnect failed: ${error.message}`);
        this._scheduleReconnect();
      }
    }, this.reconnectBackoffMs);
  }

  _startPolling() {
    if (this._pollTimer) {
      clearInterval(this._pollTimer);
    }

    const intervalMs = Number(this.pollIntervalMs || env.plcPollIntervalMs || 500);
    this._pollTimer = setInterval(() => {
      void this._emitCurrentTelemetry();
    }, intervalMs);
  }

  async _emitCurrentTelemetry() {
    if (this._readInFlight) {
      return;
    }

    this._readInFlight = true;

    try {
      const telemetry = await this.readSnapshot();
      this.lastTelemetry = telemetry;
      this.emit("telemetry", telemetry);
    } catch (error) {
      this.emit("error", error);
    } finally {
      this._readInFlight = false;
    }
  }

  _stopHeartbeat() {
    if (this._heartbeatTimer != null) {
      clearInterval(this._heartbeatTimer);
      this._heartbeatTimer = null;
    }
  }

  _startHeartbeat() {
    this._stopHeartbeat();
    if (this.simulator || this._stopping) {
      return;
    }

    this._heartbeatTimer = setInterval(() => {
      void this._pulsePlcHeartbeat();
    }, HEARTBEAT_INTERVAL_MS);
  }

  async _pulsePlcHeartbeat() {
    if (this.simulator || this._stopping || !this._connected || !this._client) {
      return;
    }

    try {
      await this.writeTag(HEARTBEAT_COMMAND_ALIAS, true);
    } catch {
      // writeTag / _writeOnce already mark disconnected and schedule reconnect
    }
  }

  _assertCommandExists(alias) {
    if (!PLC_COMMAND_MAP[alias]) {
      throw new Error(`Unknown PLC command alias: ${alias}`);
    }
  }

  _enqueueWrite(task) {
    const run = async () => task();

    this._writeQueue = this._writeQueue.then(run, run);
    return this._writeQueue;
  }

  _writeOnce(alias, value) {
    return new Promise((resolve, reject) => {
      this._client.writeItems(alias, value, (error) => {
        if (error) {
          this._setConnected(false);
          this._scheduleReconnect();
          reject(new Error(`Write failed for ${alias}: ${error.message || error}`));
          return;
        }

        resolve();
      });
    });
  }

  _applySimulatorCommand(alias, value) {
    if (alias === "CMD_Mode_Local") {
      this._simState.Etat_Mode_Local_Web = true;
      this._simState.Etat_Mode_Central_Web = false;
      return;
    }

    if (alias === "CMD_Mode_Central") {
      this._simState.Etat_Mode_Local_Web = false;
      this._simState.Etat_Mode_Central_Web = true;
      return;
    }

    if (alias === "CMD_Arret_Web") {
      this._simState.Poids_Reel_Web = 0;
      this._simState.Etat_Moteur_Ensacheuse_Web = false;
      this._simState.Etat_Moteur_Bande_Web = false;
      return;
    }

    if (alias === "CMD_Marche_Web") {
      this._simState.Etat_Mode_Central_Web = true;
      this._simState.Etat_Mode_Local_Web = false;
      this._simState.Etat_Moteur_Ensacheuse_Web = true;
      this._simState.Etat_Moteur_Bande_Web = true;
      return;
    }

    if (alias === "CMD_Presence_Sac_Web") {
      return;
    }

    if (alias === "CMD_Arret_Urgence_Web") {
      this._simState.Arret_Urgence = Boolean(value);
      this._simState.Defaut_Ecoulement_Ciment = Boolean(value);
      this._simState.Defaut_Capteur = Boolean(value);
      this._simState.Defaut_Moteur = Boolean(value);
      this._simState.Defaut_Dejoncteur = Boolean(value);
      this._simState.Etat_Defaut_Web = Boolean(value);
      return;
    }

    if (alias === "CMD_Reset_Alarmes") {
      this._simState.Arret_Urgence = false;
      this._simState.Defaut_Ecoulement_Ciment = false;
      this._simState.Defaut_Capteur = false;
      this._simState.Defaut_Moteur = false;
      this._simState.Defaut_Dejoncteur = false;
      this._simState.Etat_Defaut_Web = false;
      return;
    }

    if (alias === "CMD_Heartbeat_Web") {
      return;
    }

    if (alias === "Consigne_Poids") {
      const nextTarget = Number.parseFloat(value);
      if (Number.isFinite(nextTarget) && nextTarget > 0) {
        this._simState.Consigne_Poids = Number(nextTarget.toFixed(2));
      }
      return;
    }
  }

  _setConnected(nextStatus) {
    if (this._connected === nextStatus) {
      return;
    }

    this._connected = nextStatus;
    if (!nextStatus && !this.simulator) {
      this._stopHeartbeat();
    }
    this.emit("status", { connected: nextStatus, ts: Date.now() });
  }

  _stepSimulator() {
    const increment = 2.5;
    if (!this._simState.Etat_Moteur_Ensacheuse_Web) {
      return;
    }

    this._simState.Poids_Reel_Web = Number((this._simState.Poids_Reel_Web + increment).toFixed(2));
    this._simState.Angle_Ensacheuse = Number((this._simState.Angle_Ensacheuse + 7.5).toFixed(2));

    if (this._simState.Poids_Reel_Web >= this._simState.Consigne_Poids) {
      this._simState.Poids_Reel_Web = this._simState.Consigne_Poids;
      this._simState.Bags_Produced_Counter += 1;

      const jitter = randomInRange(-0.25, 0.25);
      this._simState.Poids_Reel_Web = Number(
        Math.max(0, this._simState.Consigne_Poids + jitter).toFixed(2)
      );

      this._simState.Last_Spout_ID = this._simState.Active_Spout_ID;

      this._simState.Poids_Reel_Web = 0;
      this._simState.Consigne_Poids = Number(
        randomInRange(this.simTargetMin, this.simTargetMax).toFixed(2)
      );
      this._simState.Active_Spout_ID = randomInt(1, 8);
    }

    if (Math.random() < 0.02) {
      const alarmKeys = [
        "Arret_Urgence",
        "Defaut_Ecoulement_Ciment",
        "Defaut_Capteur",
        "Defaut_Moteur",
        "Defaut_Dejoncteur",
      ];
      const key = alarmKeys[randomInt(0, alarmKeys.length - 1)];
      this._simState[key] = !this._simState[key];
      this._simState.Etat_Defaut_Web =
        this._simState.Arret_Urgence ||
        this._simState.Defaut_Ecoulement_Ciment ||
        this._simState.Defaut_Capteur ||
        this._simState.Defaut_Moteur ||
        this._simState.Defaut_Dejoncteur;
    }

    if (Math.random() < 0.005) {
      const nextMode = [0, 1, 2][randomInt(0, 2)];
      this._simState.Etat_Mode_Local_Web = nextMode === 1;
      this._simState.Etat_Mode_Central_Web = nextMode === 2;
    }
  }
}

const plcService = new PlcService();

module.exports = {
  PLC_MEMORY_MAP,
  PLC_COMMAND_MAP,
  PlcService,
  plcService,
  isDbCompatibleTelemetry,
  normalizeTelemetry,
};
