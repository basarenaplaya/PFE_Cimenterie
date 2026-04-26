# Documentation Index

This folder contains comprehensive architectural and implementation documentation for the PFE Dashboard & PLC Gateway system. All documents are designed for **knowledge transfer** to new developers and strict adherence to engineering standards.

## Files

### [.cursorrules](/.cursorrules)
**Audience**: All developers (enforced by IDE)
**Purpose**: Coding standards, conventions, and non-negotiable rules

**Sections**:
- Foundational principles (explicit data contracts, idempotent state)
- Backend standards (Node.js/Express, async patterns, validation, database, JWT, audit)
- Frontend standards (React/Vite, Tailwind, state management, Socket.io)
- Production deployment checklist

**Quick Reference**: Code review checklist at end

---

### [docs/CORE_ARCHITECTURE.md](docs/CORE_ARCHITECTURE.md)
**Audience**: Architects, senior engineers, onboarding developers
**Purpose**: System design, component relationships, data models

**Sections**:
- 3-tier architecture diagram (OT/Middleware/IT)
- PLC memory model (DB4 tags, offsets, data types)
- Dual-contract telemetry (legacy UI keys + canonical backend keys)
- 500ms polling cycle with detailed flow
- Command dispatch pipeline (REST → PLC)
- Native machine UI (iframe, telemetry-only state machine)
- React Context providers and hooks
- Database schema (users, production_logs, alarm_logs, machine_status, audit_logs)
- Security model (JWT, RBAC, rate limiting, CSP)
- Error handling & logging utilities
- Key architectural decisions with rationale

**Quick Reference**: System overview diagram, command table, alarm definitions

---

### [docs/DATA_FLOW_AND_STATE.md](docs/DATA_FLOW_AND_STATE.md)
**Audience**: Backend engineers, debugging specialists, integrators
**Purpose**: Detailed state transitions, data flows, synchronization logic

**Sections**:
- End-to-end real-time telemetry cycle (500ms polling)
- Production counter handshake (idempotent bag detection)
- Alarm state machine (transition detection, duration calculation)
- Command dispatch state machine (validation → audit → PLC write)
- React state updates (DashboardDataProvider, Socket.io listeners)
- Native iframe state synchronization (no inference logic)
- Error recovery & resilience scenarios (connection loss, PLC errors, command failures)

**Quick Reference**: Detailed flow diagrams, code examples for each subsystem, scenario-based error handling

---

### [docs/SECURITY_POLICY.md](docs/SECURITY_POLICY.md)
**Audience**: Security engineers, operations, developers maintaining auth/permissions
**Purpose**: Authentication, authorization, threats, and mitigations

**Sections**:
- JWT lifecycle (issuance, storage, transmission, verification)
- Password security (bcrypt 12 rounds, constant-time comparison)
- SQL injection prevention (parameterized queries)
- Input validation (Joi schemas, sanitization)
- CSRF protection (JWT in custom header)
- Content Security Policy (CSP directives)
- Rate limiting matrix
- Audit logging (schema, action format, monitoring queries)
- Threat model with mitigations (SQL injection, brute force, XSS, MITM, privilege escalation)
- Incident response procedures

**Quick Reference**: Production security checklist, rate limit matrix, threat table, recovery procedures

---

## Quick Navigation

### "How do I...?"

| Question | Document | Section |
|---|---|---|
| Add a new backend route? | .cursorrules | Backend Standards |
| Understand telemetry flow? | DATA_FLOW_AND_STATE | End-to-End Telemetry Cycle |
| Debug a failed command? | CORE_ARCHITECTURE | Command Dispatch Pipeline |
| Add a new PLC tag? | CORE_ARCHITECTURE | PLC Memory Model |
| Implement a new React component? | .cursorrules | Frontend Standards |
| Fix an alarm logic bug? | DATA_FLOW_AND_STATE | Alarm State Machine |
| Understand Socket.io event flow? | CORE_ARCHITECTURE | Real-Time Flow |
| Verify authentication is working? | SECURITY_POLICY | JWT Verification |
| Review production checklist? | .cursorrules | Code Review Checklist |
| Monitor for security issues? | SECURITY_POLICY | Audit Logging & Monitoring Queries |
| Add rate limiting to new endpoint? | SECURITY_POLICY | Rate Limiting |
| Prevent SQL injection? | SECURITY_POLICY | SQL Injection Prevention |

### System Components by Document

**PLC Integration**:
- Read/write flow: CORE_ARCHITECTURE (PLC Memory Model, Command Dispatch)
- Debugging: DATA_FLOW_AND_STATE (telemetry cycle)
- Security: SECURITY_POLICY (rate limiting)

**Telemetry & Real-Time**:
- Architecture: CORE_ARCHITECTURE (500ms polling, dual-contract)
- Detailed flow: DATA_FLOW_AND_STATE (end-to-end cycle)
- State management: CORE_ARCHITECTURE (React Context)

**Authentication & Authorization**:
- Implementation: SECURITY_POLICY (JWT, password hashing)
- Route configuration: .cursorrules (middleware chain)
- Database: CORE_ARCHITECTURE (users table)

**Database**:
- Schema: CORE_ARCHITECTURE (full definitions)
- Queries: DATA_FLOW_AND_STATE (production handshake, alarm transitions)
- Safety: SECURITY_POLICY (parameterized queries)

**Frontend**:
- Component patterns: .cursorrules (React/Tailwind standards)
- State updates: DATA_FLOW_AND_STATE (DashboardDataProvider)
- Iframe embedding: CORE_ARCHITECTURE (native UI iframe)

**Error Handling**:
- Patterns: .cursorrules (async/await, try/catch)
- Recovery scenarios: DATA_FLOW_AND_STATE (connection loss, PLC errors)
- Middleware: CORE_ARCHITECTURE (HttpError utility)

---

## Key Concepts (Glossary)

**Dual-Contract Telemetry**: Backend emits single payload with both legacy UI keys and canonical backend keys. Allows frontend/backend to evolve independently without breaking integration.

**Counter Handshake**: Detection of bag completion via Production_Counter increment in telemetry (idempotent, no inference). Inserts production_log row on each +1.

**Alarm State Machine**: Compares Alarms object frame-to-frame; detects false→true (start) and true→false (clear) transitions; logs duration.

**Telemetry-Only Native UI**: Iframe receives telemetry via Socket.io, animates based on state, no command handlers. Parent React dashboard handles all operator actions.

**Rate Limiting**: Per-endpoint request throttling (100/15min auth, 120/15min commands) prevents brute force and DoS.

**Bcrypt**: Password hashing algorithm with salt (12 rounds = 2^12 iterations ≈ 200ms per hash).

**JWT (HMAC-HS256)**: Stateless token with sub (user ID), username, role claims. Signature prevents tampering.

**RBAC**: Role-Based Access Control. Roles: ADMIN (full access), OPERATOR (read + commands).

**CSP (Content Security Policy)**: HTTP header restricts resource loading. frame-ancestors directive prevents clickjacking.

---

## Onboarding Checklist

For new developers joining the project:

1. **Read Overview** (20 min)
   - [ ] CORE_ARCHITECTURE: System Overview + 3-tier diagram
   - [ ] .cursorrules: Foundational Principles

2. **Understand Telemetry** (30 min)
   - [ ] CORE_ARCHITECTURE: PLC Memory Model
   - [ ] DATA_FLOW_AND_STATE: End-to-End Telemetry Cycle
   - [ ] CORE_ARCHITECTURE: 500ms Polling Flow

3. **Learn Backend Architecture** (45 min)
   - [ ] .cursorrules: Backend Standards
   - [ ] CORE_ARCHITECTURE: Command Dispatch Pipeline
   - [ ] DATA_FLOW_AND_STATE: Command Dispatch State Machine

4. **Study Security** (30 min)
   - [ ] SECURITY_POLICY: JWT Lifecycle
   - [ ] SECURITY_POLICY: SQL Injection Prevention
   - [ ] SECURITY_POLICY: Rate Limiting Matrix

5. **Explore Frontend** (30 min)
   - [ ] .cursorrules: Frontend Standards
   - [ ] CORE_ARCHITECTURE: React State Management
   - [ ] CORE_ARCHITECTURE: Native Iframe Embedding

6. **Hands-On Tasks** (2-3 hours)
   - [ ] Run local development (backend + frontend + PLC simulator)
   - [ ] Add a simple machine command (e.g., log command in audit, verify in database)
   - [ ] Trace Socket.io telemetry event from backend through frontend
   - [ ] Review Git history (commits) to understand evolution of design

7. **Deep Dives** (As Needed)
   - [ ] Database schema: CORE_ARCHITECTURE
   - [ ] Error handling: DATA_FLOW_AND_STATE: Error Recovery
   - [ ] Alarm logic: DATA_FLOW_AND_STATE: Alarm State Machine
   - [ ] Incident response: SECURITY_POLICY: Incident Response

---

## Version & Updates

**Created**: January 2025
**Applies To**: 
- Backend: pfe-backend (Node.js/Express + Socket.io + nodes7)
- Frontend: pfe-dashboard (React/Vite + Shadcn UI)
- Database: MySQL 5.7+
- PLC: Siemens S7-1200 (or simulator mode)

**Last Updated**: January 15, 2025

**Maintenance**:
- Update .cursorrules when adding new coding patterns or conventions
- Update CORE_ARCHITECTURE when changing system design or adding major components
- Update DATA_FLOW_AND_STATE when refactoring state machine logic
- Update SECURITY_POLICY when adding auth/security features or discovering new threats

---

## Contact & Questions

For questions or clarifications on these documents:
1. Search relevant document section (use browser Ctrl+F)
2. Check .cursorrules code review checklist
3. Review Git history for rationale behind design decisions
4. Pair with senior team member for architectural discussions

**Never**:
- Bypass security policies (parameterized queries, validation, audit logging)
- Add inference heuristics (state must be explicit, not guessed)
- Ignore .cursorrules conventions (code review will enforce)
