# Data Flow and State Management

## End-to-End Data Flow

### 1. Real-Time Telemetry Cycle (500ms)

**Flow Diagram**:
```
[realtimeEngineService.pollPlc()]
  ↓
  └─ Interval: setInterval(pollPlc, PLC_POLL_INTERVAL_MS) [500ms default]
  ↓
[plcService._readRealSnapshot()]
  ├─ Acquire nodes7 connection
  ├─ DB4 memory read: DBRead(1, 0, 400)  [fetch entire DB4, 400 bytes]
  ├─ Parse binary response
  ├─ Extract 16 tagged values via PLC_MEMORY_MAP offsets
  └─ Return array of normalized values
  ↓
[plcService.normalizeTelemetry(values)]
  ├─ Read PLC_MEMORY_MAP:
  │  ├─ values[0] (REAL from DB4,REAL2) → Poids_Reel_Web → 'weight'
  │  ├─ values[1] (REAL from DB4,REAL6) → Consigne_Poids → 'target_weight'
  │  ├─ values[9] (BOOL from DB4,X0.4) → CMD_Mode_Local → 'mode_local'
  │  ├─ values[10] (BOOL from DB4,X0.5) → CMD_Mode_Central → 'mode_central'
  │  ├─ values[11] (BOOL from DB4,X1.0) → Mode_Local_Status → mode_local feedback
  │  ├─ values[12] (BOOL from DB4,X1.1) → Mode_Central_Status → mode_central feedback
  │  ├─ values[13] (INT from DB4,INT22) → Active_Spout_ID → 'active_spout'
  │  ├─ values[14] (INT from DB4,INT26) → Bags_Produced_Counter
  │  ├─ values[15] (BOOL array DB4,X2.0–X2.4) → Alarmes (js1–js5)
  │  └─ Derived: angle = (active_spout - 1) * 45°
  ├─ Build dual-contract output:
  │  ├─ Legacy UI keys: weight, target_weight, mode_local, mode_central, active_spout, angle, Bags_Produced_Counter, ...
  │  └─ Canonical keys: Production_Counter, Live_Weight, Last_Bag_Target, Machine_Mode, Alarms: { js1, js2, ... }
  └─ Return merged payload with _ts (current Unix timestamp)
  ↓
[realtimeEngineService.processProductionHandshake(telemetry)]
  ├─ const currentCounter = telemetry.Production_Counter || 0
  ├─ if (currentCounter > lastObservedCounter):
  │  ├─ Insert production_log row:
  │  │  {
  │  │    production_counter: currentCounter,
  │  │    spout_id: telemetry.Last_Spout_ID,
  │  │    weight_actual: telemetry.Live_Weight,
  │  │    weight_target: telemetry.Last_Bag_Target,
  │  │    created_at: NOW()
  │  │  }
  │  └─ UPDATE lastObservedCounter = currentCounter
  └─ [else: no change, continue]
  ↓
[realtimeEngineService.processAlarmTransitions(telemetry)]
  ├─ Compare telemetry.Alarms vs previousAlarms snapshot
  ├─ For each alarm code (js1–js5):
  │  ├─ if (previous[code] === false && current[code] === true):
  │  │  ├─ INSERT alarm_logs: { alarm_code, started_at: NOW(), cleared_at: NULL }
  │  │  └─ Store alarm_id for later update
  │  └─ if (previous[code] === true && current[code] === false):
  │     ├─ UPDATE alarm_logs: { cleared_at: NOW() }  [where alarm_id = ... and cleared_at IS NULL]
  │     └─ Calculate duration: TIMESTAMPDIFF(MILLISECOND, started_at, cleared_at)
  └─ previousAlarms = cloneDeep(telemetry.Alarms)
  ↓
[realtimeEngineService.processMachineStatus(telemetry)]
  ├─ Derive Machine_Mode from mode_local/mode_central:
  │  ├─ if (telemetry.mode_local === true): "LOCAL"
  │  ├─ if (telemetry.mode_central === true): "CENTRAL"
  │  └─ else: "UNKNOWN"
  ├─ Derive Is_Running from motor state:
  │  └─ if (telemetry.motor_bande || telemetry.motor_ensacheuse): true else false
  └─ UPSERT machine_status (single row): { machine_mode, is_running, updated_at: NOW() }
  ↓
[socketService.emitTelemetryUpdate(payload)]
  ├─ io.emit('telemetry_update', payload)  [dual-contract payload to ALL connected clients]
  └─ io.emit('telemetry', payload)         [redundant event for legacy listeners]
  ↓
[Frontend receives 'telemetry_update' event via Socket.io]
  ├─ React Dashboard (DashboardDataProvider):
  │  ├─ setState(telemetry, machineStatus, alarms, isConnected)
  │  └─ Trigger re-render of all subscribed components
  └─ Native iframe (app.js):
     ├─ Call applyTelemetry(payload)
     ├─ Update state: weight, angle, activeSpout, motorBande, motorEnsacheuse
     ├─ Call processProducedCounter()  [counter-delta detection]
     ├─ Call applyMotionFromState()   [CSS transforms]
     └─ updateUI()                    [DOM updates]
```

**Polling Semantics**:
- **Interval**: 500ms (configurable)
- **Blocking**: If read takes >500ms, next poll is delayed (no overlap)
- **Error Handling**: On PLC read error, emit `plc-status` with `isConnected=false`; retry next cycle
- **No Accumulation**: Only latest telemetry is held; old events are discarded

---

## Production Counter Handshake

**Purpose**: Detect bag completion without relying on command confirmation or animation timing.

### State Variables
```javascript
// realtimeEngineService.js (module scope)
let lastObservedCounter = 0;  // Last counter value successfully logged
let productionLogCache = [];  // Recent logs for deduplication check
```

### Handshake Logic

```javascript
async function processProductionHandshake(telemetry) {
  const currentCounter = Number(telemetry.Production_Counter || 0);

  // Guard: counter must be numeric
  if (!Number.isFinite(currentCounter)) {
    return;
  }

  // Counter unchanged: no new bag
  if (currentCounter === lastObservedCounter) {
    return;
  }

  // Counter decreased: machine restarted, reset baseline
  if (currentCounter < lastObservedCounter) {
    lastObservedCounter = currentCounter;
    return;
  }

  // Counter increased by 1+: one or more bags completed
  const bagCount = currentCounter - lastObservedCounter;

  for (let i = 0; i < bagCount; i++) {
    const productionCounter = lastObservedCounter + i + 1;

    // Deduplicate: check if log already exists for this counter
    const existingLog = await pool.execute(
      `SELECT id FROM production_logs WHERE production_counter = ?`,
      [productionCounter]
    );

    if (existingLog.length > 0) {
      // Already logged, skip
      continue;
    }

    // Insert new log
    await pool.execute(
      `INSERT INTO production_logs 
       (production_counter, spout_id, weight_actual, weight_target, created_at)
       VALUES (?, ?, ?, ?, NOW())`,
      [
        productionCounter,
        telemetry.Last_Spout_ID || null,
        telemetry.Live_Weight || 0,
        telemetry.Last_Bag_Target || 0
      ]
    );

    // Update baseline
    lastObservedCounter = productionCounter;
  }
}
```

### Idempotency Guarantee
- **Duplicate Detection**: Query production_logs by counter before inserting
- **Result**: If same telemetry cycle is processed twice (e.g., dev restart), no duplicate logs are created
- **Implication**: Safe to replay telemetry or restart backend without data loss/corruption

### Race Condition Handling
- **Scenario**: Polling cycle reads counter=10, but backend crashes before insert
- **Recovery**: On restart, next poll reads same counter=10, re-detects increment, re-inserts (caught by deduplicate check, no double-insert)

---

## Alarm State Machine

### Alarm Flags (js1–js5)
Each alarm flag in DB4 (BOOL) represents a latched alarm state:

| Code | Meaning | Clear Condition |
|---|---|---|
| js1 | Scale sensor fault | PLC logic detects sensor recovery + manual reset |
| js2 | Motor overload | Overload relay reset; thermal recovery |
| js3 | Cement flow fault | Flow sensor detects flow restoration |
| js4 | Disjunctor trip (breaker) | Manual switch reset |
| js5 | Reserved | N/A |

### State Transition Detection

```javascript
async function processAlarmTransitions(telemetry) {
  const currentAlarms = telemetry.Alarms; // { js1, js2, js3, js4, js5 }

  for (const alarmCode of ['js1', 'js2', 'js3', 'js4', 'js5']) {
    const previousState = previousAlarms[alarmCode];
    const currentState = currentAlarms[alarmCode];

    // No transition
    if (previousState === currentState) {
      continue;
    }

    // Transition: false → true (alarm started)
    if (previousState === false && currentState === true) {
      const insertedRecord = await pool.execute(
        `INSERT INTO alarm_logs (alarm_code, started_at)
         VALUES (?, NOW())`,
        [alarmCode]
      );

      const alarmId = insertedRecord.insertId;
      activeAlarmIds[alarmCode] = alarmId;

      console.log(`[ALARM] ${alarmCode} STARTED`);
    }

    // Transition: true → false (alarm cleared)
    if (previousState === true && currentState === false) {
      const alarmId = activeAlarmIds[alarmCode];

      if (alarmId) {
        const result = await pool.execute(
          `UPDATE alarm_logs
           SET cleared_at = NOW()
           WHERE id = ? AND cleared_at IS NULL`,
          [alarmId]
        );

        console.log(`[ALARM] ${alarmCode} CLEARED (duration: ${result.affectedRows > 0 ? 'calculated' : 'N/A'})`);
      }

      delete activeAlarmIds[alarmCode];
    }
  }

  // Update snapshot for next cycle
  previousAlarms = cloneDeep(currentAlarms);
}

function cloneDeep(obj) {
  return JSON.parse(JSON.stringify(obj));
}
```

### Log Schema
```javascript
{
  id: 1,
  alarm_code: 'js2',                    // String identifier
  started_at: '2025-01-15T10:30:45Z',   // UTC timestamp
  cleared_at: '2025-01-15T10:35:22Z',   // NULL if still active
  duration_ms: 277000,                  // GENERATED COLUMN: TIMESTAMPDIFF(MILLISECOND, ...)
  created_at: '2025-01-15T10:30:45Z'    // Insert time
}
```

### Multi-Alarm Scenarios
- **Simultaneous Alarms**: Each alarm has independent log entry; duration calculated independently
- **Alarm Reoccurrence**: If alarm clears at T1 then starts again at T2, creates NEW log entry
- **Log Query**: `SELECT * FROM alarm_logs WHERE alarm_code IN ('js1', 'js2') AND cleared_at IS NULL` returns active alarms

---

## Command Dispatch State

### Command Validation Schema (Joi)

```javascript
const machineCommandSchema = Joi.object({
  command: Joi.string()
    .required()
    .description("Canonical or alias command name"),

  value: Joi.alternatives()
    .try(Joi.number(), Joi.boolean())
    .optional()
    .description("Command parameter (weight, spout, etc.)"),

  note: Joi.string()
    .trim()
    .max(120)
    .allow("", null)
    .optional()
    .description("Audit trail note")
})
.custom((payload, helpers) => {
  // Resolve alias
  const canonical = COMMAND_ALIASES[payload.command] || payload.command;
  const definition = MACHINE_COMMANDS[canonical];

  if (!definition) {
    return helpers.error("Unsupported command");
  }

  // Validate requiresValue
  if (definition.requiresValue && payload.value === undefined) {
    return helpers.error(`${canonical} requires a value`);
  }

  // Type-specific validation
  if (canonical === 'SET_TARGET_WEIGHT') {
    const num = Number(payload.value);
    if (!Number.isFinite(num) || num < 0.1 || num > 1000) {
      return helpers.error('weight must be 0.1–1000 kg');
    }
  }

  if (canonical === 'SET_ACTIVE_SPOUT') {
    const num = Number.parseInt(payload.value, 10);
    if (!Number.isFinite(num) || num < 1 || num > 8) {
      return helpers.error('spout must be 1–8');
    }
  }

  payload.command = canonical;
  return payload;
});
```

### Command Dispatch Sequence

```
POST /api/machine/command
{
  "command": "cmd_set_target_weight",
  "value": 52.5,
  "note": "Operator request: increase to 52.5 kg"
}
  ↓
[middleware: validateBody(machineCommandSchema)]
  └─ Resolve: cmd_set_target_weight → SET_TARGET_WEIGHT
  └─ Validate: value 52.5 is in range [0.1, 1000]
  └─ Output: req.validatedBody = { command: 'SET_TARGET_WEIGHT', value: 52.5, note: '...' }
  ↓
[middleware: verifyToken]
  └─ Extract JWT from Authorization header
  └─ Verify signature; extract userId, role
  └─ Output: req.auth = { userId: 42, username: 'operator1', role: 'OPERATOR' }
  ↓
[machineController.issueMachineCommand()]
  ├─ const { command, value, note } = req.validatedBody
  ├─ const actions = resolveCommandActions(command, value)
  │  └─ MACHINE_COMMANDS.SET_TARGET_WEIGHT.actions(52.5)
  │  └─ Returns: [{ alias: 'Consigne_Poids', value: 52.5 }]
  │
  ├─ logAuditAction({
  │    userId: 42,
  │    action: 'MACHINE_COMMAND command=SET_TARGET_WEIGHT outcome=attempt value=52.5',
  │    ipAddress: '192.168.1.100'
  │  })
  │
  ├─ try {
  │    await dispatchCommand(actions)
  │    ├─ For action { alias: 'Consigne_Poids', value: 52.5 }:
  │    │  ├─ Resolve alias to offset: PLC_MEMORY_MAP['Consigne_Poids'] = 'DB4,REAL6'
  │    │  └─ nodes7.DBWrite(1, 6, Buffer.from(52.5))  [write REAL value at offset 6]
  │    └─ Next polling cycle reads new value from DB4
  │  } catch (error) {
  │    ├─ logAuditAction({
  │    │    userId: 42,
  │    │    action: 'MACHINE_COMMAND command=SET_TARGET_WEIGHT outcome=failed: Connection timeout',
  │    │    ipAddress: '192.168.1.100'
  │    │  })
  │    └─ throw error  [to error handler middleware]
  │  }
  │
  ├─ logAuditAction({
  │    userId: 42,
  │    action: 'MACHINE_COMMAND command=SET_TARGET_WEIGHT outcome=success value=52.5',
  │    ipAddress: '192.168.1.100'
  │  })
  │
  └─ sendSuccess(res, {
       data: {
         command: {
           command: 'SET_TARGET_WEIGHT',
           description: 'Update the target bag weight.',
           value: 52.5,
           applied: [{ alias: 'Consigne_Poids', value: 52.5 }],
           note: 'Operator request: increase to 52.5 kg',
           connected: true
         }
       }
     })
```

### Audit Trail
All three log attempts (attempt, success, failure) are recorded in `audit_logs`:
```sql
SELECT * FROM audit_logs WHERE user_id = 42 ORDER BY created_at DESC LIMIT 10;

| id | user_id | action                                                        | ip_address    | created_at              |
|----|---------|---------------------------------------------------------------|---------------|-------------------------|
| 1  | 42      | MACHINE_COMMAND command=SET_TARGET_WEIGHT outcome=attempt value=52.5 | 192.168.1.100 | 2025-01-15 10:15:32.000 |
| 2  | 42      | MACHINE_COMMAND command=SET_TARGET_WEIGHT outcome=success value=52.5 | 192.168.1.100 | 2025-01-15 10:15:32.100 |
```

---

## React State Updates (DashboardDataProvider)

### Provider Initialization

```javascript
export function DashboardDataProvider({ children }) {
  // State shape
  const [telemetry, setTelemetry] = useState({
    weight: 0,
    target_weight: 0,
    mode_local: false,
    mode_central: false,
    active_spout: 1,
    angle: 0,
    motor_bande: false,
    motor_ensacheuse: false,
    Bags_Produced_Counter: 0,
    defaut: false,
    arret_urgence: false,
    defaut_capteur: false,
    defaut_moteur: false,
    defaut_ecoulement: false,
    defaut_dejoncteur: false,
    _ts: 0
  });

  const [machineStatus, setMachineStatus] = useState({
    mode: 'UNKNOWN',
    isRunning: false,
    lastUpdate: null
  });

  const [alarms, setAlarms] = useState({
    js1: { name: 'Scale Sensor', active: false, lastCleared: null },
    js2: { name: 'Motor Overload', active: false, lastCleared: null },
    js3: { name: 'Cement Flow', active: false, lastCleared: null },
    js4: { name: 'Disjunctor', active: false, lastCleared: null },
    js5: { name: 'Reserved', active: false, lastCleared: null }
  });

  const [isConnected, setIsConnected] = useState(false);

  // Socket.io connection (useEffect)
  useEffect(() => {
    const socket = io(resolveBackendBaseUrl(), {
      auth: { token: getAuthToken() }
    });

    socket.on('connect', () => setIsConnected(true));
    socket.on('disconnect', () => setIsConnected(false));

    socket.on('telemetry_update', (payload) => {
      // Normalize backend payload to frontend state shape
      setTelemetry(payload);  // Expect legacy keys in payload
      updateMachineStatusFromTelemetry(payload);
    });

    socket.on('realtime_status', (payload) => {
      // Update alarms from payload
      if (payload.Alarms) {
        updateAlarmsFromPayload(payload.Alarms);
      }
    });

    socket.on('plc-status', (payload) => {
      setIsConnected(payload.isConnected);
    });

    return () => socket.disconnect();
  }, []);

  function updateMachineStatusFromTelemetry(payload) {
    const mode = payload.mode_local ? 'LOCAL' : 
                 payload.mode_central ? 'CENTRAL' : 'UNKNOWN';
    const isRunning = payload.motor_bande || payload.motor_ensacheuse;

    setMachineStatus({
      mode,
      isRunning,
      lastUpdate: new Date(payload._ts)
    });
  }

  function updateAlarmsFromPayload(alarmsPayload) {
    const newAlarms = { ...alarms };
    for (const code of ['js1', 'js2', 'js3', 'js4', 'js5']) {
      if (alarmsPayload[code] !== undefined) {
        newAlarms[code] = {
          ...newAlarms[code],
          active: alarmsPayload[code],
          lastCleared: alarmsPayload[code] ? null : new Date()
        };
      }
    }
    setAlarms(newAlarms);
  }

  const value = { telemetry, machineStatus, alarms, isConnected };

  return (
    <DashboardDataContext.Provider value={value}>
      {children}
    </DashboardDataContext.Provider>
  );
}

export function useDashboardData() {
  const context = useContext(DashboardDataContext);
  if (!context) {
    throw new Error('useDashboardData must be within DashboardDataProvider');
  }
  return context;
}
```

### Component Consumption

```javascript
// React component
function WeightDisplay() {
  const { telemetry, machineStatus } = useDashboardData();

  return (
    <div>
      <p className="text-3xl font-bold">{telemetry.weight.toFixed(2)} kg</p>
      <p className="text-sm text-slate-600">Target: {telemetry.target_weight}</p>
      <p className="text-xs text-slate-500">Mode: {machineStatus.mode}</p>
    </div>
  );
}
```

**Subscription Behavior**:
- Component re-renders when any telemetry field changes
- React.memo or useMemo can optimize if specific field is stable
- No manual unsubscribe needed (Context handles cleanup)

---

## Native Iframe State Synchronization

### Local State Model (app.js)

```javascript
const state = {
  // Telemetry snapshot
  liveWeight: 0,
  targetWeight: 0,
  angleDeg: 0,
  activeSpout: 1,
  motorBande: false,
  motorEnsacheuse: false,

  // Counter tracking
  previousProducedCounter: 0,
  currentProducedCounter: 0,

  // Animation state
  isAnimatingDrop: false,
  isAnimatingBeltMove: false,

  // UI state
  lastUIUpdateTs: 0
};
```

### State Update Path

```javascript
socket.on('telemetry_update', (plcData) => {
  applyTelemetry(plcData);
});

function applyTelemetry(plcData) {
  // Extract values (guard against undefined/null)
  const newWeight = asNumber(plcData[DATA_KEYS.weight], 0);
  const newAngle = normalizeAngle(asNumber(plcData[DATA_KEYS.angle], 0));
  const newCounter = Math.floor(asNumber(plcData[DATA_KEYS.bagsProducedCounter], 0));

  // Detect changes (shallow comparison)
  if (newWeight !== state.liveWeight) {
    state.liveWeight = newWeight;
    updateWeightDisplay();
  }

  if (newAngle !== state.angleDeg) {
    state.angleDeg = newAngle;
    applyMotionFromState();
  }

  if (newCounter !== state.currentProducedCounter) {
    state.currentProducedCounter = newCounter;
    processProducedCounter(newCounter);
  }

  // Boolean updates (always apply)
  state.motorBande = asBoolean(plcData[DATA_KEYS.motorBande]);
  state.motorEnsacheuse = asBoolean(plcData[DATA_KEYS.motorEnsacheuse]);
  state.activeSpout = asNumber(plcData[DATA_KEYS.activeSpout], 1);

  applyMotionFromState();
  updateUI();
}
```

### No Inference Logic
- **Rule**: If `Bags_Produced_Counter` unchanged, do nothing
- **Rule**: If counter delta ≠ ±1, accept as baseline (don't infer missed events)
- **Result**: Animation is 1:1 with counter increments; no spurious drops

---

## Error Recovery & Resilience

### Connection Loss Scenario

```
[Socket.io connection drops]
  ├─ Frontend: isConnected = false
  ├─ UI: Shows "Disconnected" badge
  └─ State: Last telemetry frozen (weight, mode, counter)

[Automatic reconnection attempt (Socket.io default: exponential backoff)]
  ├─ If network returns within 1min: Re-connect, resume telemetry
  └─ If network fails >5min: Manual refresh required

[Backend receives connection close]
  ├─ Polling loop continues (no client-side behavior change)
  └─ Next client reconnect receives latest telemetry
```

### PLC Read Error Scenario

```
[nodes7.DBRead() times out or fails]
  ├─ plcService.isConnected = false
  ├─ socketService.emitRealtimeStatus({ isConnected: false })
  ├─ Frontend UI shows "PLC Offline"
  └─ Retry next polling cycle (500ms later)

[PLC recovers]
  ├─ DBRead succeeds
  ├─ plcService.isConnected = true
  ├─ socketService.emitRealtimeStatus({ isConnected: true })
  └─ Telemetry resumes
```

### Command Dispatch Failure Scenario

```
POST /api/machine/command { command: 'START', ... }
  ├─ Validation passes
  ├─ Audit log: attempt
  ├─ plcService.writeTag() fails (PLC offline, connection timeout)
  ├─ Error caught by asyncHandler
  ├─ Audit log: failed: Connection timeout
  ├─ HttpError(500, "Failed to dispatch command") sent to frontend
  └─ Frontend shows toast: "Command failed: Failed to dispatch command"

[Next polling cycle]
  ├─ PLC still offline; state unchanged
  └─ User can retry command
```
