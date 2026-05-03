# Core Architecture: PFE Dashboard & PLC Gateway

## System Overview

**PFE** is a **3-tier OT/IT integration system** for a cement packaging plant:

```
┌─────────────────────────────────────────────────────────────────┐
│ Operational Technology (OT) Layer                               │
│ ─────────────────────────────────────────────────────────────  │
│ Siemens S7-1200 PLC (192.168.0.169)                           │
│   • DB4 Memory (400 bytes): 16 tagged values (weights, modes) │
│   • 1 weigh scale (analog)                                      │
│   • 8 cement spouts (virtual)                                   │
│   • 3-phase motor (belt, ensacheuse valve)                      │
│   • 5 alarm bits → telemetry `Alarms`: AU, Err_1…Err_4                     │
└─────────────────────────────────────────────────────────────────┘
                            ↕ (nodes7 S7 protocol)
┌─────────────────────────────────────────────────────────────────┐
│ Middleware Layer (Node.js/Express + Socket.io)                 │
│ ─────────────────────────────────────────────────────────────  │
│ Port 5000: REST API                                             │
│   • /api/auth/* (register, login, token refresh)               │
│   • /api/data/* (production logs, alarms, machine status)      │
│   • /api/machine/command (start, stop, mode switch, etc.)      │
│   • /api/admin/* (user management, system config)              │
│                                                                  │
│ Port 5000 (via HTTP upgrade): Socket.io Realtime              │
│   • telemetry_update: 500ms polling cycle, PLC→UI broadcast   │
│   • plc-status: Connection state (connected, disconnected)     │
│   • realtime_status: Alarm transitions, production events      │
│                                                                  │
│ MySQL Database:                                                 │
│   • users (authentication & RBAC)                              │
│   • production_logs (counter handshake audit trail)            │
│   • alarm_logs (state transitions, durations)                  │
│   • audit_logs (auth attempts, admin actions)                  │
│   • machine_status (current mode, running state)               │
│   • realtime_engine_state (alarm snapshots)                    │
└─────────────────────────────────────────────────────────────────┘
                    ↕ (REST + Socket.io)
┌─────────────────────────────────────────────────────────────────┐
│ Information Technology (IT) Layer                               │
│ ─────────────────────────────────────────────────────────────  │
│ React/Vite SPA (Port 5173)                                     │
│   • /dashboard (authenticated operator view)                   │
│   • /login (public auth entry point)                           │
│   • /machine (iframe container for native UI)                  │
│                                                                  │
│ Native SCADA Surface (iframe at /machine/native)              │
│   • HTML5 + Canvas/SVG animation                               │
│   • 8-spout rotary hub (CSS rotation)                           │
│   • Belt conveyor animation                                     │
│   • Weight display, mode indicators, alarm lights              │
│   • Telemetry-driven only (no command handlers)                │
└─────────────────────────────────────────────────────────────────┘
```

---

## PLC Memory Model

**DB4 (Process Data Block) – 400 Bytes**

Mapped via `plcService.PLC_MEMORY_MAP`:

| Field Name | Type | Offset | Range | Purpose |
|---|---|---|---|---|
| `Poids_Reel_Web` | REAL | DB4,REAL2 | 0.0–999.9 kg | Live scale weight |
| `Consigne_Poids` | REAL | DB4,REAL6 | 1.0–1000.0 kg | Target bag weight (set point) |
| `Poids_Tare` | REAL | DB4,REAL10 | 0.0–100.0 kg | Tare offset |
| `CMD_Marche_Web` | BOOL | DB4,X0.0 | 0/1 | Start signal (pulse, not hold) |
| `CMD_Arret_Web` | BOOL | DB4,X0.1 | 0/1 | Stop signal (pulse) |
| `CMD_Presence_Sac_Web` | BOOL | DB4,X0.2 | 0/1 | Bag confirmed (pulse) |
| `CMD_Arret_Urgence_Web` | BOOL | DB4,X0.3 | 0/1 | Emergency stop (latched) |
| `CMD_Mode_Local` | BOOL | DB4,X0.4 | 0/1 | Local mode (mutual exclusive) |
| `CMD_Mode_Central` | BOOL | DB4,X0.5 | 0/1 | Central/web mode (mutual exclusive) |
| `CMD_Reset_Alarmes` | BOOL | DB4,X0.6 | 0/1 | Clear alarm flags (pulse) |
| `Mode_Local_Status` | BOOL | DB4,X1.0 | 0/1 | Feedback: currently in local mode |
| `Mode_Central_Status` | BOOL | DB4,X1.1 | 0/1 | Feedback: currently in central mode |
| `Active_Spout_ID` | INT | DB4,INT22 | 1–8 | Currently selected spout (set by PLC) |
| `Last_Spout_ID` | INT | DB4,INT24 | 1–8 | Last completed spout (for audit) |
| `Bags_Produced_Counter` | INT | DB4,INT26 | 0–65535 | Total bags filled this session |
| `Alarmes` (→ `AU`, `Err_1`…`Err_4`) | BOOL | DB4,X6.6–X7.2 (see `PLC_MEMORY_MAP`) | 0/1 each | Alarm flags (latched until reset) |

---

## Dual-Contract Telemetry Model

Backend `plcService.normalizeTelemetry()` returns a **single payload** with two contracts:

### Legacy UI Contract (for React Dashboard)
```javascript
{
  weight: 42.5,                    // Poids_Reel_Web (kg)
  target_weight: 50.0,             // Consigne_Poids (kg)
  mode_local: false,               // CMD_Mode_Local status
  mode_central: true,              // CMD_Mode_Central status
  motor_ensacheuse: true,          // Valve open (from PLC state)
  motor_bande: true,               // Belt running
  active_spout: 3,                 // Active_Spout_ID (1–8)
  angle: 67.5,                     // Derived: (active_spout - 1) * 45°
  defaut: false,                   // Any alarm active?
  arret_urgence: false,            // Emergency stop?
  defaut_capteur: false,           // Defaut_Capteur (PLC)
  defaut_moteur: false,            // Defaut_Moteur (PLC)
  defaut_ecoulement: false,        // Defaut_Ecoulement_Ciment (PLC)
  defaut_dejoncteur: false,        // Defaut_Dejoncteur (PLC)
  Bags_Produced_Counter: 127,      // Session bag count (INT from DB4)
  _ts: 1699564800000               // Unix timestamp (ms)
}
```

### Canonical Backend Contract (for services & logging)
```javascript
{
  Production_Counter: 127,         // Bags_Produced_Counter (source of truth)
  Live_Weight: 42.5,               // Poids_Reel_Web
  Last_Bag_Target: 50.0,           // Consigne_Poids
  Last_Spout_ID: 2,                // Last_Spout_ID (from DB4)
  Active_Spout_ID: 3,              // Active_Spout_ID (current)
  Machine_Mode: "CENTRAL",         // Derived: "LOCAL" | "CENTRAL" | "UNKNOWN"
  Is_Running: true,                // Derived: motor_bande || motor_ensacheuse
  Alarms: {
    AU: false,                     // Arrêt urgence (Arret_Urgence)
    Err_1: false,                  // Défaut écoulement ciment
    Err_2: false,                  // Défaut capteur bande
    Err_3: false,                  // Défaut moteur
    Err_4: false                   // Défaut disjoncteur
  }
}
```

**Key Principle**: Frontend consumes *legacy* keys; backend services/logging use *canonical* keys. Single-source payload eliminates redundancy while maintaining both contracts.

---

## PLC Polling & Real-Time Flow

### 500ms Polling Cycle

```
[realtimeEngineService.pollPlc()]
  ↓
[plcService._readRealSnapshot()]  ← queries DB4 via nodes7
  ↓
[plcService.normalizeTelemetry()]  ← applies PLC_MEMORY_MAP
  ↓
[realtimeEngineService.processProductionHandshake()]
  ├─ Check: is Production_Counter > lastObservedCounter?
  ├─ YES: Insert production_log row (counter, spout_id, weight, timestamp)
  └─ Update lastObservedCounter
  ↓
[realtimeEngineService.processAlarmTransitions()]
  ├─ Compare current Alarms vs previous Alarms
  ├─ For each AU / Err_1…Err_4 transition:
  │  ├─ false→true: startAlarm() inserts to alarm_logs, starts duration timer
  │  └─ true→false: clearAlarm() updates alarm_logs with duration (current_ts - start_ts)
  └─ Update previousAlarms snapshot
  ↓
[realtimeEngineService.processMachineStatus()]
  └─ Upsert machine_status row (mode, is_running, updated_at)
  ↓
[socketService.emitTelemetryUpdate(payload)]
  └─ Broadcast full telemetry to all connected Socket.io clients
  ↓
[UI receives on "telemetry_update" event]
  ├─ React Dashboard: Updates Context state, re-renders
  └─ Native iframe: Calls applyTelemetry(), drives animations
```

**Polling Interval**: 500ms (configurable via `PLC_POLL_INTERVAL_MS` env var)
**Broadcast**: All connected clients receive same payload simultaneously
**No Queueing**: Latest telemetry overwrites queued events

---

## Command Dispatch Pipeline

### Frontend (React) → Backend (REST) → PLC (S7)

```
[User clicks button in Machine View]
  ↓
[React sends POST /api/machine/command]
{
  "command": "cmd_mode_central",    ← alias from COMMAND_ALIASES
  "value": null,                     ← or numeric value for target weight
  "note": "Mode switch for testing"  ← optional audit trail
}
  ↓
[machineController.issueMachineCommand()]
  ├─ Validate payload via machineCommandSchema
  ├─ Resolve alias: "cmd_mode_central" → "MODE_CENTRAL"
  ├─ Log audit attempt
  ├─ Resolve command actions from MACHINE_COMMANDS
  │  └─ MODE_CENTRAL: [
  │       { alias: "CMD_Mode_Local", value: false },
  │       { alias: "CMD_Mode_Central", value: true }
  │     ]
  ├─ Dispatch actions sequentially via dispatchCommand()
  │  └─ For each action: plcService.writeTag(alias, value)
  ├─ Log audit success
  └─ Return response with applied actions
  ↓
[plcService.writeTag(alias, value)]
  ├─ Resolve alias to PLC_MEMORY_MAP offset (e.g., "CMD_Mode_Local" → DB4,X0.4)
  ├─ Write via nodes7: s7client.DBWrite(dbNum, offset, ...)
  ├─ Next polling cycle reads updated DB4 value
  └─ PLC logic validates and acts on command
  ↓
[Updated DB4 value appears in next telemetry payload]
  ├─ Socket.io broadcasts to frontend
  └─ UI state reflects new mode
```

### Supported Commands

Defined in `MACHINE_COMMANDS` object:

| Command | Alias | Actions | Value | Purpose |
|---|---|---|---|---|
| `MODE_LOCAL` | `cmd_mode_local` | Set CMD_Mode_Local=true, CMD_Mode_Central=false | None | Switch to manual/local mode |
| `MODE_CENTRAL` | `cmd_mode_central` | Set CMD_Mode_Local=false, CMD_Mode_Central=true | None | Switch to automatic/central (web) mode |
| `START` | `cmd_marche` | Set CMD_Marche_Web=true | None | Start packing cycle |
| `STOP` | `cmd_arret` | Set CMD_Arret_Web=true | None | Stop packing cycle |
| `PRESENCE_BAG` | `cmd_presence_sac` | Set CMD_Presence_Sac_Web=true | None | Confirm bag loaded |
| `EMERGENCY_STOP` | `cmd_arret_urgence` | Set CMD_Arret_Urgence_Web=true | None | Trigger emergency stop (latched) |
| `RESET_ALARMS` | `cmd_reset_alarmes` | Set CMD_Reset_Alarmes=true | None | Clear all alarms |
| `SET_TARGET_WEIGHT` | `cmd_set_target_weight` | Set Consigne_Poids=value | 0.1–1000.0 kg | Update target weight |
| `SET_ACTIVE_SPOUT` | `cmd_set_active_spout` | Set Active_Spout_ID=value | 1–8 | Select spout |

---

## Native Machine UI (Iframe)

### Telemetry-Only State Machine

The embedded HTML5 surface at `/machine/native` is **passive**: it receives telemetry via Socket.io and animates. No command handlers.

```javascript
// app.js initialization
const socket = io(extractApiBase(), {
  auth: { token: extractTokenFromHash() }
});

socket.on('telemetry_update', (plcData) => {
  applyTelemetry(plcData);
});

// State model (in-memory, not persisted)
const state = {
  liveWeight: 0,
  targetWeight: 0,
  angleDeg: 0,                    // Rotary hub angle (0–360°, 45° per spout)
  activeSpout: 1,
  motorBande: false,              // Belt moving?
  motorEnsacheuse: false,         // Valve open?
  previousProducedCounter: 0,
  currentProducedCounter: 0,
  isAnimatingDrop: false
};

// Applied per telemetry event
function applyTelemetry(plcData) {
  state.liveWeight = asNumber(plcData[DATA_KEYS.weight]);
  state.targetWeight = asNumber(plcData[DATA_KEYS.targetWeight]);
  state.angleDeg = normalizeAngle(asNumber(plcData[DATA_KEYS.angle]));
  state.motorBande = asBoolean(plcData[DATA_KEYS.motorBande]);
  state.motorEnsacheuse = asBoolean(plcData[DATA_KEYS.motorEnsacheuse]);

  syncActiveSpoutFromPlc(asNumber(plcData[DATA_KEYS.activeSpout]));
  processProducedCounter(asNumber(plcData[DATA_KEYS.bagsProducedCounter]));
  updateWeightDisplay();
  applyMotionFromState();
}

// Counter-delta detection (strict +1 only)
function processProducedCounter(nextCounter) {
  if (!Number.isFinite(nextCounter)) return;

  const delta = nextCounter - state.previousProducedCounter;

  if (delta === 1) {
    // Exactly +1: bag completed, schedule drop animation
    performDrop();
  } else if (delta > 1) {
    // Missed increments (polling latency): skip to current
    state.previousProducedCounter = nextCounter;
  } else if (delta < 0) {
    // Counter reset (machine restarted): accept new baseline
    state.previousProducedCounter = nextCounter;
  }
  // delta === 0: no change, continue
}

// Drop sequence (cement fill → valve close → bag on belt → counter increment)
async function performDrop() {
  if (state.isAnimatingDrop) return; // Prevent overlap

  state.isAnimatingDrop = true;

  try {
    // 1. Valve opens, fill time
    state.motorEnsacheuse = true;
    updateUI();
    await delay(3000);

    // 2. Valve closes, cement settles
    state.motorEnsacheuse = false;
    updateUI();
    await delay(500);

    // 3. Bag on belt, animation starts
    const activeBagEl = document.querySelector(`.bag-spout-${state.activeSpout}`);
    activeBagEl.classList.add('sac-on-belt');

    // Wait for belt animation to complete
    await delay(4000);

    // 4. Reset spout to ready state
    activeBagEl.classList.remove('sac-on-belt');
    syncActiveSpoutFromPlc(state.activeSpout); // Trigger next spout selection

    state.previousProducedCounter = state.currentProducedCounter;
  } finally {
    state.isAnimatingDrop = false;
  }
}

// Hub rotation (0° = spout 1, 45° = spout 2, ..., 315° = spout 8)
function applyMotionFromState() {
  const hubEl = document.getElementById('rotating-hub');
  hubEl.style.transform = `rotate(${state.angleDeg}deg)`;

  if (state.motorBande) {
    document.querySelector('.belt-system').classList.add('belt-move');
  } else {
    document.querySelector('.belt-system').classList.remove('belt-move');
  }
}
```

### CSS Animation Keyframes

```css
/* Rotary hub */
#rotating-hub {
  transition: transform 300ms ease-in-out;
  transform-origin: center;
}

/* Belt conveyor */
@keyframes beltMove {
  0% { background-position: 0 0; }
  100% { background-position: 100px 0; }
}

.belt-move {
  animation: beltMove 2s linear infinite;
}

/* Valve on (glow) */
.valve-on {
  box-shadow: 0 0 20px rgba(255, 200, 0, 0.8);
  background-color: rgba(255, 200, 0, 0.3);
}

/* Bag drop trajectory */
@keyframes bagDrop {
  0% { transform: translateY(0); opacity: 1; }
  100% { transform: translateY(500px); opacity: 0.5; }
}

.sac-on-belt {
  animation: bagDrop 4s ease-in forwards;
}
```

---

## React Dashboard Context & Hooks

### DashboardDataProvider

Central state management via React Context:

```javascript
// Usage: Wrap app with <DashboardDataProvider>
const { machineStatus, telemetry, alarms, isConnected } = useDashboardData();
```

**State Shape**:
```javascript
{
  telemetry: {
    // Legacy keys (from backend telemetry)
    weight, target_weight, mode_local, mode_central, active_spout, angle,
    motor_bande, motor_ensacheuse, Bags_Produced_Counter,
    defaut, arret_urgence, ...
  },
  machineStatus: {
    mode: "CENTRAL" | "LOCAL" | "UNKNOWN",
    isRunning: boolean,
    lastUpdate: timestamp
  },
  alarms: {
    AU: { name: "Arrêt urgence (AU)", active: boolean, lastCleared: timestamp },
    Err_1: { name: "Défaut écoulement ciment", active: boolean, ... },
    Err_2, Err_3, Err_4: { ... }
  },
  isConnected: boolean,
  error: null | { code: string, message: string }
}
```

**Socket.io Listeners** (in useEffect cleanup chain):
- `telemetry_update`: Update telemetry & machine status
- `realtime_status`: Update alarms
- `plc-status`: Update isConnected flag

### useAuth Hook

Manages authentication state:

```javascript
const { user, token, login, logout, isLoading } = useAuth();
```

- **localStorage**: Persists token across page reloads
- **JWT Extraction**: Decodes token to extract username, role
- **Auto-Logout**: If token expires or login fails

---

## Database Schema

### users Table
```sql
CREATE TABLE users (
  id INT PRIMARY KEY AUTO_INCREMENT,
  username VARCHAR(50) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('ADMIN', 'OPERATOR') DEFAULT 'OPERATOR',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

### production_logs Table
```sql
CREATE TABLE production_logs (
  id INT PRIMARY KEY AUTO_INCREMENT,
  production_counter INT NOT NULL,
  spout_id INT (1–8),
  weight_actual FLOAT,
  weight_target FLOAT,
  duration_ms INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (spout_id) REFERENCES spout_catalog(id)
);
```
**Index**: `CREATE INDEX idx_counter ON production_logs(production_counter);`

### alarm_logs Table
```sql
CREATE TABLE alarm_logs (
  id INT PRIMARY KEY AUTO_INCREMENT,
  alarm_code VARCHAR(16) (AU, Err_1…Err_4),
  started_at TIMESTAMP NOT NULL,
  cleared_at TIMESTAMP,
  duration_ms INT GENERATED ALWAYS AS (
    IF(cleared_at IS NULL, NULL, TIMESTAMPDIFF(MILLISECOND, started_at, cleared_at))
  ) STORED,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### machine_status Table
```sql
CREATE TABLE machine_status (
  id INT PRIMARY KEY AUTO_INCREMENT,
  machine_mode VARCHAR(20) ('LOCAL', 'CENTRAL', 'UNKNOWN'),
  is_running BOOLEAN,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```
**Single Row**: Upserted on each telemetry cycle.

### audit_logs Table
```sql
CREATE TABLE audit_logs (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT,
  action VARCHAR(255),
  ip_address VARCHAR(45),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
```

---

## Security Model

### Authentication (JWT)
- **Issuance**: On successful login via `/api/auth/login`
- **Claims**: `{ sub: userId, username, role, iat, exp }`
- **Expiration**: 8 hours
- **Algorithm**: HS256 (HMAC-SHA256)
- **Secret**: `JWT_SECRET` environment variable (≥32 bytes)

### Password Hashing
- **Algorithm**: bcrypt with 12 salt rounds
- **Storage**: `password_hash` VARCHAR(255) in users table
- **Verification**: `bcrypt.compare(plaintext, hash)` in login handler

### Authorization (RBAC)
- **ADMIN**: Full access to `/api/admin/*` (user management, system config)
- **OPERATOR**: Read machine state, issue commands, view production logs
- **Enforcement**: `verifyRoles('ADMIN', 'OPERATOR')` middleware per route

### Rate Limiting
- **Auth**: 100 req/15min per IP (prevent brute force)
- **Admin**: 300 req/15min per IP
- **Machine Commands**: 120 req/15min per IP (prevent spam)
- **Store**: Express-rateLimit with memory or Redis backend

### Input Validation
- **Joi Schemas**: All request bodies/queries/params validated before processing
- **SQL Injection**: mysql2/promise parameterized queries with `?` placeholders (no string interpolation)
- **XSS**: `sanitizeFields()` utility strips whitespace; no HTML rendering from user input

### CSP Headers (via helmet)
```javascript
frame-ancestors: "'self' http://localhost:5173"  // Allow iframe only from React dashboard
```

---

## Error Handling & Logging

### HttpError Utility
```javascript
throw new HttpError(400, "Validation failed.", ["field is required", "value out of range"]);
// Response:
{
  error: {
    code: "VALIDATION_ERROR",
    message: "Validation failed.",
    details: ["field is required", "value out of range"]
  }
}
```

### asyncHandler Wrapper
```javascript
const issueMachineCommand = asyncHandler(async (req, res) => {
  // Errors caught automatically, passed to next(error)
});
```

### Audit Logging
All auth attempts and admin commands logged to `audit_logs` table with:
- User ID
- Action description (e.g., "MACHINE_COMMAND command=START outcome=success")
- IP address
- Timestamp

**Non-Blocking**: Audit log failures don't block request completion (caught silently).

---

## Deployment Targets

### Local Development
- **Backend**: `npm run dev` (port 5000, hot reload via nodemon)
- **Frontend**: `npm run dev` (port 5173, Vite dev server)
- **PLC**: Simulator mode (`PLC_MODE=simulator`)
- **Database**: Local MySQL 5.7+

### Production
- **Backend**: Node.js container (port 5000, no hot reload)
- **Frontend**: Static build served via nginx or CDN
- **PLC**: Real S7-1200 at 192.168.0.169
- **Database**: Managed MySQL (RDS, etc.) with SSL/TLS
- **Reverse Proxy**: nginx routes `/api/*` → backend, `/*` → frontend
- **Secrets**: GitHub Actions Secrets, environment variable injection

---

## Key Architectural Decisions

### 1. Dual-Contract Telemetry
- **Why**: Allows graceful migration from legacy UI keys to canonical backend keys
- **How**: Single payload includes both contracts; frontend uses legacy, backend services use canonical
- **Benefit**: No breaking changes; can update frontend/backend independently

### 2. Counter-Delta Production Handshake
- **Why**: Prevents missed production events due to polling latency
- **How**: Backend monitors Production_Counter increment; on +1, inserts production_log row
- **Benefit**: Idempotent; doesn't rely on command dispatch or animation completion

### 3. Telemetry-Only Native UI
- **Why**: Simplifies state management; UI is pure visualization layer
- **How**: No command handlers in iframe; all operator commands go via parent React dashboard
- **Benefit**: Single source of truth (backend); easier to debug; doesn't need independent auth

### 4. Iframe Embedding with JWT
- **Why**: Isolates native SCADA UI from React application
- **How**: JWT passed via URL hash; Socket.io authenticates before broadcasting telemetry
- **Benefit**: Can be replaced/upgraded independently; browser frame-ancestors CSP ensures iframe can't break out

### 5. MySQL/Promise (No ORM)
- **Why**: Minimal abstraction; explicit SQL; easier to audit for SQL injection
- **How**: All queries parameterized with `?` placeholders
- **Benefit**: Predictable performance; no N+1 queries; full control over transaction semantics
