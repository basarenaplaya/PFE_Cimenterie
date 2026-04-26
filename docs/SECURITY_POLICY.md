# Security Policy & Implementation

## Authentication Architecture

### JWT (JSON Web Token) Lifecycle

#### 1. Issuance (Login)

```javascript
// authService.js: issueAccessToken()
const issueAccessToken = (userId, username, role) => {
  return jwt.sign(
    {
      sub: userId,                    // Subject (user ID) - canonical claim
      username,                       // Username for logging/UI
      role                            // ADMIN or OPERATOR
    },
    env.jwtSecret,                    // HS256 secret (≥32 bytes recommended)
    {
      expiresIn: '8h',                // Token lifetime: 8 hours
      issuer: 'pfe-backend',          // Optional: issuer claim
      audience: 'pfe-dashboard'       // Optional: audience claim
    }
  );
};

// Usage in login flow
async function loginUser(username, password) {
  const user = await pool.execute(
    'SELECT id, username, password_hash, role, is_active FROM users WHERE username = ?',
    [username]
  );

  if (user.length === 0) {
    throw new HttpError(401, 'Invalid username or password.');
  }

  const [{ id, password_hash, role, is_active }] = user;

  // Password verification via bcrypt
  const passwordMatch = await bcrypt.compare(password, password_hash);
  if (!passwordMatch) {
    throw new HttpError(401, 'Invalid username or password.');
  }

  if (!is_active) {
    throw new HttpError(403, 'Account is inactive.');
  }

  const token = issueAccessToken(id, username, role);

  // Audit log
  await logAuditAction({
    userId: id,
    action: `AUTH login username=${username} outcome=success`,
    ipAddress: null  // Extracted from req.ip in middleware
  });

  return { token, user: toPublicUser({ id, username, role }) };
}
```

**Token Claims**:
```json
{
  "sub": "42",                        // User ID (canonical identifier)
  "username": "operator1",            // Username (for logging)
  "role": "OPERATOR",                 // Authorization level
  "iat": 1705330445,                  // Issued at (seconds since epoch)
  "exp": 1705361045,                  // Expires at (iat + 8 hours)
  "iss": "pfe-backend",               // Issuer
  "aud": "pfe-dashboard"              // Audience
}
```

#### 2. Storage (Frontend)

```javascript
// useAuth.js hook
export function useAuth() {
  const [token, setToken] = useState(() => {
    // Load from localStorage on init
    return localStorage.getItem('auth_token');
  });

  const login = async (username, password) => {
    const response = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });

    if (!response.ok) {
      throw new Error('Login failed');
    }

    const { data: { token } } = await response.json();

    // Store token in localStorage (persists across page reloads)
    localStorage.setItem('auth_token', token);
    setToken(token);

    return token;
  };

  const logout = () => {
    localStorage.removeItem('auth_token');
    setToken(null);
  };

  return { token, login, logout };
}
```

**Storage Risk**: localStorage is accessible to any script on the same origin (XSS vulnerability). Mitigated by:
- Content Security Policy (CSP) headers prevent inline script injection
- Sanitization of user input (no `innerHTML` assignments)
- httpOnly cookies not used here (session would require server-side state)

#### 3. Transmission (HTTP Header)

```javascript
// All authenticated requests include Authorization header
const response = await fetch(`${API_BASE}/api/data/production-logs`, {
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
});
```

**Format**: `Authorization: Bearer <token>`
- **Bearer Scheme**: Standard for JWT in HTTP/REST
- **HTTPS Required**: In production, HTTPS (TLS 1.3) must be enforced to prevent token interception
- **Token in URL**: Used only for iframe embedding (`/machine/native#token=...`); acceptable because:
  - URL is not logged to server access logs (fragment is client-side only)
  - iframe is sandboxed and same-origin with parent
  - Limited window of exposure

#### 4. Verification (Backend Middleware)

```javascript
// middleware/auth.js: verifyToken
function verifyToken(req, res, next) {
  // Extract Bearer token from Authorization header
  const authHeader = req.headers.authorization;
  const token = extractBearerToken(authHeader);

  if (!token) {
    return next(new HttpError(401, 'Missing or malformed authorization token.'));
  }

  try {
    // Verify signature and expiration
    const decoded = jwt.verify(token, env.jwtSecret);

    // Validate required claims
    if (!decoded.sub || !decoded.role) {
      return next(new HttpError(401, 'Invalid token payload.'));
    }

    // Attach to request for use in handlers
    req.auth = {
      userId: decoded.sub,
      username: decoded.username,
      role: decoded.role
    };

    return next();
  } catch (error) {
    // Covers: signature mismatch, expiration, malformed token
    return next(new HttpError(401, 'Invalid or expired token.'));
  }
}
```

**Verification Steps**:
1. Extract Bearer token from Authorization header
2. Verify HMAC signature using `jwtSecret`
3. Check expiration timestamp (exp claim)
4. Validate required claims (sub, role)
5. Attach decoded claims to request context

**Failure Modes**:
- Missing header: 401 Unauthorized
- Invalid signature: 401 (indicates tampering or wrong secret)
- Expired token: 401 (client should re-authenticate)
- Malformed: 401

---

## Authorization (RBAC)

### Role Hierarchy

```javascript
// No inheritance; roles are explicit

const ROLES = {
  ADMIN: 'ADMIN',       // Full system access, user management, system config
  OPERATOR: 'OPERATOR'  // Read machine state, issue commands, view logs
};
```

### Route Authorization

```javascript
// Example routes with role enforcement

app.get(
  '/api/data/production-logs',
  verifyToken,
  verifyRoles('ADMIN', 'OPERATOR'),  // Either role allowed
  getProductionLogs
);

app.get(
  '/api/admin/users',
  verifyToken,
  verifyAdmin,  // ADMIN only (shorthand for verifyRoles('ADMIN'))
  listUsers
);

app.post(
  '/api/machine/command',
  verifyToken,
  verifyRoles('ADMIN', 'OPERATOR'),  // Either role can issue commands
  validateBody(machineCommandSchema),
  issueMachineCommand
);
```

**Middleware Stack** (order matters):
1. `verifyToken` – Authenticate user (extract JWT claims)
2. `validateBody(schema)` – Validate request payload
3. `verifyAdmin` or `verifyRoles(...)` – Authorize user for this route
4. Handler – Process request with authenticated context

---

## Password Security

### Hashing (Registration)

```javascript
// authService.js: registerUser()
async function registerUser(username, password, role = 'OPERATOR') {
  // Validate username uniqueness
  const existing = await pool.execute(
    'SELECT id FROM users WHERE username = ?',
    [username]
  );

  if (existing.length > 0) {
    throw new HttpError(400, 'Username already exists.');
  }

  // Hash password with bcrypt (12 salt rounds = 2^12 iterations)
  const passwordHash = await bcrypt.hash(password, 12);

  // Insert user with hashed password
  const result = await pool.execute(
    `INSERT INTO users (username, password_hash, role, is_active)
     VALUES (?, ?, ?, true)`,
    [username, passwordHash, role]
  );

  const userId = result.insertId;

  // Audit log
  await logAuditAction({
    userId,
    action: `AUTH registration username=${username} outcome=success`,
    ipAddress: null
  });

  return { id: userId, username, role };
}
```

**Bcrypt Parameters**:
- **Algorithm**: Bcrypt (Blowfish cipher)
- **Salt Rounds**: 12 (each round ≈ 2× CPU work; 2^12 = 4096 iterations)
- **Hardware Cost**: On modern CPU (~2025), hashing one password takes ~200ms
- **Benefit**: Brute force attack requires 200ms × 10^9 attempts = 6+ years per password
- **Key Derivation**: Each password gets unique salt; identical passwords produce different hashes

**Bcrypt Hash Example**:
```
$2b$12$oFPzPVJXr/z6K6VjQSQ8zOJ.eJJb9wTrj7nfZ7Hy6R9nWQN7rKHnm
└─┬─┘└──┘ └──────────────────────────────────────────────────────┘
   │   │    │
   │   │    └─ Hash (168 bits base64)
   │   └────── Salt (128 bits base64)
   └─────────── Bcrypt version 2b, cost 12
```

### Verification (Login)

```javascript
// Compare plaintext password against stored hash
const passwordMatch = await bcrypt.compare(plaintext, storedHash);
// Returns: true if match, false otherwise
// Constant-time comparison prevents timing attacks
```

**Timing Attack Mitigation**:
- `bcrypt.compare()` uses constant-time comparison
- Runtime is same regardless of password correctness
- Attacker cannot infer partial password match from response time

---

## SQL Injection Prevention

### Parameterized Queries (mysql2/promise)

**✓ Correct** (Safe):
```javascript
const [rows] = await pool.execute(
  'SELECT * FROM users WHERE username = ? AND role = ?',
  [username, role]  // Parameters passed separately
);
```

**✗ Incorrect** (Vulnerable):
```javascript
// DO NOT DO THIS
const [rows] = await pool.query(
  `SELECT * FROM users WHERE username = '${username}' AND role = '${role}'`
  // String interpolation = SQL injection risk
);
```

### SQL Injection Attack Example

**Attack Input**: 
```javascript
username: "admin' OR '1'='1"
password: "anything"
```

**Vulnerable Query**:
```sql
SELECT * FROM users 
WHERE username = 'admin' OR '1'='1' 
  AND password_hash = 'anything'
-- Result: Returns all users (authentication bypassed)
```

**Safe Query** (parameterized):
```sql
SELECT * FROM users 
WHERE username = ? AND password_hash = ?
-- Parameters: ["admin' OR '1'='1", "anything"]
-- Treated as literal strings; '1'='1' not evaluated as SQL
-- Result: No match found (password hash doesn't match literal)
```

### Parameterized Query Rules

1. **Always use `?` placeholders** for dynamic values
2. **Pass values in separate array**: `execute(sql, [value1, value2])`
3. **Never concatenate strings** into SQL: No backticks, no template literals
4. **Type validation** before query (Joi schemas ensure type safety)

**Examples**:
```javascript
// Production log insertion
await pool.execute(
  `INSERT INTO production_logs (production_counter, spout_id, weight_actual, created_at)
   VALUES (?, ?, ?, NOW())`,
  [counter, spoutId, weight]
);

// Alarm log update
await pool.execute(
  `UPDATE alarm_logs SET cleared_at = NOW()
   WHERE id = ? AND alarm_code = ? AND cleared_at IS NULL`,
  [alarmId, alarmCode]
);

// Multi-condition select
await pool.execute(
  `SELECT * FROM audit_logs 
   WHERE user_id = ? AND created_at >= ? AND created_at <= ?
   ORDER BY created_at DESC LIMIT ?`,
  [userId, startDate, endDate, limit]
);
```

---

## Input Validation

### Joi Schema Validation

```javascript
// All request bodies validated before processing

const userRegistrationSchema = Joi.object({
  username: Joi.string()
    .alphanum()
    .min(3)
    .max(50)
    .required(),
  password: Joi.string()
    .min(8)
    .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)  // Requires uppercase, lowercase, digit
    .required(),
  role: Joi.string()
    .valid('ADMIN', 'OPERATOR')
    .default('OPERATOR')
});

const machineCommandSchema = Joi.object({
  command: Joi.string().required(),
  value: Joi.alternatives().try(Joi.number(), Joi.boolean()).optional(),
  note: Joi.string().trim().max(120).allow("", null).optional()
});

// Middleware
app.post(
  '/api/auth/register',
  validateBody(userRegistrationSchema),
  registerUser
);

// validateBody strips unknown fields and coerces types
```

**Validation Features**:
- **Type Coercion**: `"123"` → `123` (string to number)
- **Trimming**: Removes leading/trailing whitespace
- **Pattern Matching**: Regex for password strength
- **Range Checking**: Min/max lengths, numeric bounds
- **Enum Validation**: Only allowed values accepted
- **Unknown Field Stripping**: Extra fields removed (no mass assignment)

### Sanitization Utility

```javascript
// utils/sanitizeFields.js
function sanitizeFields(obj, fieldsToSanitize) {
  const sanitized = { ...obj };

  for (const field of fieldsToSanitize) {
    if (typeof sanitized[field] === 'string') {
      // Remove control characters, trim whitespace
      sanitized[field] = sanitized[field]
        .replace(/[\x00-\x1F\x7F]/g, '')  // Remove control chars
        .trim();
    }
  }

  return sanitized;
}

// Usage
const auditAction = sanitizeFields(req.body, ['action', 'note']);
```

**Protection Against**:
- XSS via text fields (control characters sanitized)
- Unintended whitespace (trimmed)
- NoSQL injection (if database later upgraded to MongoDB)

---

## Cross-Site Request Forgery (CSRF)

### Protection Strategy

**HTTP-Only Cookies + SameSite Flag** (not used here; would require session state):
```
Set-Cookie: sessionId=abc123; HttpOnly; Secure; SameSite=Strict; Max-Age=28800
```

**Current Approach (JWT in Custom Header)**:
```javascript
// CSRF attack requires:
// 1. Attacker website makes request to https://dashboard.pfe/api/machine/command
// 2. Browser automatically includes credentials (if cookie-based auth)
// 3. No way to set custom Authorization header from cross-origin script

// With JWT in Authorization header:
// - Custom header cannot be set cross-origin (XMLHttpRequest/fetch CORS policy)
// - Attacker cannot include Bearer token
// - API request fails with 401 Unauthorized
```

**Why JWT is CSRF-Safe**:
- Stored in localStorage (not automatically sent like cookies)
- Must be explicitly included in Authorization header (frontend code must do this)
- Cross-origin requests cannot set custom headers (CORS policy)
- Attacker's cross-origin script cannot access token from localStorage (same-origin policy)

---

## Content Security Policy (CSP)

### Header Configuration (via helmet)

```javascript
// app.js
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],  // Vite injects inline scripts
      styleSrc: ["'self'", "'unsafe-inline'"],   // Inline Tailwind utility classes
      imgSrc: ["'self'", "data:"],               // Allow data URIs for icons
      fontSrc: ["'self'"],
      connectSrc: ["'self'", "http://localhost:5000"],  // API calls
      frameSrc: ["'self'"],                      // Embedded iframes
      frameAncestors: ["'self'", "http://localhost:5173"],  // Who can embed THIS app
      objectSrc: ["'none'"],                     // No <object>, <embed>, <applet>
      upgradeInsecureRequests: []                 // HTTPS only (in production)
    }
  }
}));
```

### Key Directives

| Directive | Value | Purpose |
|---|---|---|
| `defaultSrc` | `'self'` | Default policy if specific directive not set |
| `scriptSrc` | `'self' 'unsafe-inline'` | Allows inline scripts (Vite requirement) |
| `styleSrc` | `'self' 'unsafe-inline'` | Allows inline styles (Tailwind utility requirement) |
| `connectSrc` | `'self' http://localhost:5000` | Restricts fetch/XHR to same-origin + backend |
| `frameAncestors` | `'self' http://localhost:5173` | Only React dashboard can embed machine native UI |
| `objectSrc` | `'none'` | Disables Flash, Java applets, plugins |

**Effectiveness**:
- **XSS Prevention**: Inline script injection blocked (unless marked as nonce)
- **Clickjacking Prevention**: frameAncestors restricts embedding
- **Data Exfiltration**: connectSrc limits where data can be sent

---

## Rate Limiting

### Per-Endpoint Configuration

```javascript
// middleware/rateLimiter.js

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,    // 15-minute window
  max: 100,                      // 100 requests per window
  keyGenerator: (req) => req.ip, // Rate limit by IP address
  standardHeaders: false,        // Don't send RateLimit-* headers
  skip: (req) => req.app.get('env') === 'development'
});

const adminLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,                      // 300 requests (higher for admin)
  keyGenerator: (req) => req.ip
});

const machineCommandLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 120,                      // 120 requests per 15 min
  keyGenerator: (req) => req.auth?.userId || req.ip  // Rate limit by user, not IP
});

// Apply to routes
app.post('/api/auth/login', authLimiter, loginHandler);
app.post('/api/auth/register', authLimiter, registerHandler);
app.get('/api/admin/users', adminLimiter, verifyToken, verifyAdmin, listUsers);
app.post('/api/machine/command', verifyToken, machineCommandLimiter, issueMachineCommand);
```

### Rate Limit Matrix

| Endpoint | Rate | Purpose |
|---|---|---|
| `/api/auth/login` | 100/15min per IP | Prevent brute force |
| `/api/auth/register` | 100/15min per IP | Prevent account enumeration |
| `/api/admin/*` | 300/15min per IP | Admin actions (user mgmt) |
| `/api/machine/command` | 120/15min per user | Prevent command spam |
| `/api/data/*` | 600/15min per user | Allow legitimate data queries |

**Brute Force Attack Prevention**:
- 100 attempts per 15 min ≈ 1.1 attempts/sec
- With bcrypt (200ms hash), total time to try 100 passwords ≈ 20 seconds
- After 3 failed attempts, delay exponentially: 1s, 2s, 4s (not implemented, but could be added)

---

## Audit Logging

### Audit Log Schema

```sql
CREATE TABLE audit_logs (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT,
  action VARCHAR(255),      -- Structured action string
  ip_address VARCHAR(45),   -- IPv4 or IPv6
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
```

### Action Format

Structured strings for easy parsing:
```
AUTH login username=operator1 outcome=success
AUTH login username=operator1 outcome=failed:InvalidPassword
MACHINE_COMMAND command=START outcome=attempt
MACHINE_COMMAND command=START outcome=success
MACHINE_COMMAND command=SET_TARGET_WEIGHT value=52.5 outcome=success
ADMIN user_created username=newoperator role=OPERATOR
```

### Implementation

```javascript
// auditService.js
async function logAuditAction({ userId, action, ipAddress }) {
  try {
    await pool.execute(
      `INSERT INTO audit_logs (user_id, action, ip_address)
       VALUES (?, ?, ?)`,
      [userId, action, ipAddress]
    );
  } catch (error) {
    // Fail silently: audit log failure should not block main request
    console.error('[AUDIT LOG ERROR]', error.message);
  }
}

// Usage in handler
await logAuditAction({
  userId: req.auth.userId,
  action: 'MACHINE_COMMAND command=EMERGENCY_STOP outcome=success',
  ipAddress: req.ip
});
```

### Audit Queries for Monitoring

```sql
-- Recent failed login attempts
SELECT * FROM audit_logs
WHERE action LIKE 'AUTH login outcome=failed%'
ORDER BY created_at DESC
LIMIT 20;

-- Commands issued by specific operator
SELECT * FROM audit_logs
WHERE user_id = 42 AND action LIKE 'MACHINE_COMMAND%'
ORDER BY created_at DESC
LIMIT 50;

-- Admin actions
SELECT * FROM audit_logs
WHERE action LIKE 'ADMIN%'
ORDER BY created_at DESC;

-- Count commands per user (last 24 hours)
SELECT user_id, COUNT(*) as cmd_count
FROM audit_logs
WHERE action LIKE 'MACHINE_COMMAND%'
  AND created_at >= NOW() - INTERVAL 24 HOUR
GROUP BY user_id
ORDER BY cmd_count DESC;
```

---

## Production Security Checklist

- [ ] **HTTPS/TLS 1.3** enabled on all endpoints (nginx reverse proxy)
- [ ] **JWT Secret** is ≥32 random bytes (not hardcoded, from env var)
- [ ] **Database** uses MySQL 5.7+ with SSL/TLS for connections
- [ ] **Environment Variables** not committed to git (.env in .gitignore)
- [ ] **CORS** whitelist set to specific frontend domain (not `*`)
- [ ] **helmet** middleware enabled with CSP, X-Frame-Options, etc.
- [ ] **Rate limiting** enabled on auth and machine command routes
- [ ] **Bcrypt** configured with 12 rounds (never lower)
- [ ] **Parameterized queries** used exclusively (no string interpolation in SQL)
- [ ] **Joi validation** applied to all request bodies
- [ ] **Audit logging** configured and monitored
- [ ] **CSRF protection** via JWT in Authorization header (not vulnerable to CSRF)
- [ ] **XSS protection** via CSP content-security-policy header
- [ ] **Clickjacking protection** via frame-ancestors CSP directive
- [ ] **SQL injection prevention** via parameterized queries with `?` placeholders
- [ ] **Input sanitization** via sanitizeFields utility
- [ ] **Error messages** don't leak sensitive info (e.g., "Invalid username or password" not "User not found")
- [ ] **Password policy** enforced (min 8 chars, uppercase + lowercase + digit)
- [ ] **Account lockout** after N failed attempts (optional, can be added)
- [ ] **Session monitoring** via audit logs (detect suspicious patterns)

---

## Threat Model & Mitigations

### Threat: SQL Injection

**Attack Vector**: Attacker enters `' OR '1'='1` in username field
**Mitigation**: Parameterized queries with `?` placeholders
**Result**: Injection string treated as literal; query fails safely

### Threat: Brute Force Password Attack

**Attack Vector**: Attacker tries 10,000 common passwords
**Mitigation**: 
- Bcrypt 12 rounds (~200ms per attempt)
- Rate limiting: 100 attempts per 15 min
**Result**: 10,000 attempts require >80 hours of wall-clock time per IP

### Threat: JWT Token Theft

**Attack Vector**: XSS script steals token from localStorage
**Mitigation**:
- CSP prevents inline script injection
- Strict sanitization of user input
- Monitor audit logs for suspicious patterns
**Result**: Attacker cannot inject script; even if token stolen, stolen token is stateless but can be revoked by expiration (8h max)

### Threat: CSRF Attack

**Attack Vector**: Cross-origin form submission
**Mitigation**: JWT in custom Authorization header (cannot be set cross-origin)
**Result**: Cross-origin request fails with 401

### Threat: XSS (Cross-Site Scripting)

**Attack Vector**: Attacker injects `<script>alert('xss')</script>` in production note
**Mitigation**:
- Input sanitization (control char removal)
- No `innerHTML` usage in frontend (use textContent instead)
- CSP blocks inline scripts
**Result**: Script tag is removed; page stays safe

### Threat: Man-in-the-Middle (MITM) Attack

**Attack Vector**: Attacker on same network intercepts JWT token in HTTP header
**Mitigation**: HTTPS/TLS 1.3 encryption (in production)
**Result**: Token encrypted in transit; attacker cannot read it

### Threat: Privilege Escalation

**Attack Vector**: OPERATOR user modifies JWT role claim to ADMIN
**Mitigation**: 
- JWT signature verification (any tampering detected)
- Role re-validated on each protected route
**Result**: Tampered token fails verification; 401 Unauthorized

---

## Incident Response

### If Token Compromise Suspected

1. **Rotate JWT_SECRET** (forces all tokens to expire immediately on next request)
   ```bash
   # Generate new secret
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   # Update .env and restart backend
   ```

2. **Force User Logout** (frontend localStorage can be cleared via admin action)
   ```javascript
   // Not implemented yet, but could add:
   POST /api/admin/users/{userId}/logout-all
   // Invalidates all sessions for user
   ```

3. **Audit Review** (query audit_logs for suspicious patterns)
   ```sql
   SELECT * FROM audit_logs
   WHERE action LIKE 'MACHINE_COMMAND%'
     AND user_id = (SELECT id FROM users WHERE username = 'affected_user')
     AND created_at >= '2025-01-15 10:00:00';
   ```

### If Database Breach

1. **All user passwords are hashed via bcrypt** (plaintext passwords not recoverable)
2. **Force password resets** for all users
3. **Issue new JWT_SECRET** (rotate if JWT tokens were exposed)
4. **Review audit_logs** for unauthorized commands
5. **Notify users** of breach scope (transparency)
