# PFE Dashboard — Cement Bagging Supervision System

Industrial IoT supervision stack for a **MEC HAVER 8-spout rotary bagging line** (Ciments de Bizerte PFE). A Siemens S7-1200 PLC exposes process data through **DB4**; a **Node.js** middleware bridges the plant network with **MariaDB**, **REST**, and **Socket.io**; operators and administrators use a **React** web dashboard with role-based access.

| Layer | Stack |
|-------|--------|
| **OT** | Siemens S7-1200, SIWAREX WP231, TIA Portal (external to this repo) |
| **Middleware** | Node.js 20, Express, `nodes7` (S7 ISO-on-TCP), Socket.io, JWT + bcrypt |
| **IT** | React 19, Vite, Tailwind, embedded SCADA twin on Machine View |
| **Data** | MariaDB 10.6+ / MySQL 8 compatible schema |

---

## Features

- **Real-time telemetry** — 500 ms PLC polling, single `telemetry_update` WebSocket broadcast
- **Production logging** — counter-delta handshake on `Bags_Produced_Counter` (no missed bags on reconnect)
- **Alarms** — edge detection, MariaDB persistence, supervised reset via `POST /api/machine/command`
- **OEE & analytics** — KPIs, hourly charts, spout giveaway drift (admin)
- **Machine commands** — mode, start/stop, E-stop, setpoint, alarm reset (operator + admin on Machine View)
- **RBAC** — `ADMIN` vs `OPERATOR`; cameras and analytics admin-only
- **PLC simulator** — run the full stack without hardware (`PLC_SIMULATOR=true`)
- **Docker-ready** — backend and dashboard Dockerfiles; production compose file at repo root

---

## Repository structure

```
PFE_Dahsboard/
├── .env.example              # Single env template (copy to `.env` at repo root)
├── docker-compose.prod.yml   # Production stack (db + backend + dashboard)
├── pfe-backend/              # Node.js API, PLC bridge, realtime engine
│   ├── src/
│   ├── db/init/              # 01_schema.sql, 02_seed_bootstrap_admin.sql
│   ├── Dockerfile
│   └── package.json
├── pfe-dashboard/            # React SPA (Bizerte Cement SCADA)
│   ├── public/machine-scada/ # Embedded 8-spout twin (iframe)
│   ├── nginx/default.conf    # Prod reverse proxy to backend
│   └── package.json
└── scripts/
    └── backup.sh             # MariaDB dump via Docker (cron-friendly)
```

---

## Prerequisites

| Tool | Version |
|------|---------|
| **Node.js** | 20 LTS (matches Docker images) |
| **npm** | 9+ |
| **MariaDB** or **MySQL** | 10.6+ / 8.0+ (local install or Docker `db` service) |
| **Docker + Compose** | Optional; recommended for production-like runs |
| **PLC network** | Only if `PLC_SIMULATOR=false` — S7 reachable on `PLC_IP:102` |

---

## Quick start (recommended: Docker)

### 1. Configure environment

From the repository root:

```bash
cp .env.example .env
```

Edit `.env`: set strong `MYSQL_*` / `JWT_SECRET` (≥ 32 characters), `PLC_IP` if using a real PLC, and `CORS_ORIGIN` if needed.

### 2. Start the stack

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

- **Dashboard (UI):** http://localhost  
- **API health:** http://localhost/api/health (proxied through nginx in production layout)

SQL in `pfe-backend/db/init/` runs **only on the first start** when the MariaDB volume is empty.

### 3. First login

| Field | Default (change after first login) |
|-------|-------------------------------------|
| Username | `admin` |
| Password | `ChangeMe!2026` |

Create additional users via **User Management** (admin) or `POST /api/auth/register` (admin token required).

### 4. Stop / reset database

```bash
# Stop containers
docker compose -f docker-compose.prod.yml down

# Stop and DELETE all DB data (re-runs init SQL on next up)
docker compose -f docker-compose.prod.yml down -v
```

---

## Local development (without full Docker UI)

Use this when editing backend or frontend with hot reload.

### 1. Environment

```bash
cp .env.example .env
```

For local Node (not inside Docker), keep:

```env
DB_HOST=localhost
DB_PORT=3306
PORT=5000
PLC_SIMULATOR=true
CORS_ORIGIN=http://localhost:5173
```

Ensure MariaDB is running and the database exists. Apply schema once:

```bash
mysql -u root -p < pfe-backend/db/init/01_schema.sql
mysql -u root -p pfe_cement_db < pfe-backend/db/init/02_seed_bootstrap_admin.sql
```

(Adjust user/database names to match your `.env` / `MYSQL_*` values.)

### 2. Backend

```bash
cd pfe-backend
npm install
npm run dev
```

API: http://127.0.0.1:5000 — health check: http://127.0.0.1:5000/api/health

### 3. Frontend

**Start the backend first**, then:

```bash
cd pfe-dashboard
npm install
npm run dev
```

Dashboard: http://localhost:5173 (also http://\<your-LAN-IP\>:5173 for phones on the same Wi‑Fi).

Vite proxies `/api` and `/socket.io` to the backend. If the API port differs, create `pfe-dashboard/.env.development`:

```env
VITE_API_PROXY_TARGET=http://127.0.0.1:5000
```

If login returns **502 Bad Gateway**, restart `npm run dev` after the backend is listening.

### 4. PLC simulator vs real PLC

| Mode | `.env` | Behaviour |
|------|--------|-----------|
| **Simulator** | `PLC_SIMULATOR=true` | Synthetic DB4-like data; no S7 cable required |
| **Live PLC** | `PLC_SIMULATOR=false`, `PLC_IP=192.168.x.x` | `nodes7` polls DB4 every `PLC_POLL_INTERVAL_MS` (default 500 ms) |

The API stays up if the PLC is offline; telemetry degrades until reconnect (see NFR-02 in the project report).

---

## Environment variables

One file at the **repo root** (`.env`) feeds Docker Compose and the backend. See [`.env.example`](.env.example) for the full list.

| Variable | Purpose |
|----------|---------|
| `MYSQL_*` | MariaDB container + credentials |
| `DB_HOST` | `localhost` for local Node; `db` is set in Compose for the backend service |
| `PORT` | Backend HTTP port (default `5000` in example) |
| `JWT_SECRET` | Signing key (**required**, min 32 chars) |
| `JWT_EXPIRES_IN` | Token lifetime (default `8h`) |
| `BCRYPT_SALT_ROUNDS` | Password hashing cost (default `12`) |
| `CORS_ORIGIN` | Allowed browser origin(s) for dev |
| `PLC_SIMULATOR` | `true` / `false` |
| `PLC_IP`, `PLC_PORT`, `PLC_RACK`, `PLC_SLOT` | S7 connection |
| `PLC_POLL_INTERVAL_MS` | Poll period (min 100 ms) |
| `PLC_RECONNECT_BACKOFF_MS` | Reconnect delay after link loss |
| `PRICE_PER_TON_TND` | Default giveaway pricing (TND/tonne) |

Optional `pfe-backend/.env` can override keys missing from the root file.

---

## User roles & dashboard routes

| Role | Default landing | Access |
|------|----------------|--------|
| **OPERATOR** | `/machine-view` | Live twin, machine commands, profile |
| **ADMIN** | `/overview` | All operator features + overview, production, maintenance, data explorer, cameras, users, audit |

Machine View embeds the SCADA page from `pfe-dashboard/public/machine-scada/`.

---

## API overview

Base path: `/api` — all routes except login require `Authorization: Bearer <JWT>`.

| Area | Prefix | Notes |
|------|--------|--------|
| Health | `GET /api/health` | Public |
| Auth | `/api/auth` | `login`, `me`, `register` (admin), password change |
| Machine | `POST /api/machine/command` | Operator + admin; commands e.g. `cmd_reset_alarmes`, `cmd_marche`, `cmd_arret` |
| Production | `GET /api/production` | Admin; history with filters |
| Alarms | `GET /api/alarms` | Admin; history with filters |
| Analytics | `/api/analytics` | Admin; KPIs, charts, pricing |
| Admin | `/api/admin` | Users, cameras, audit logs |

Real-time: **Socket.io** on the same host as the API — event `telemetry_update` after each poll cycle.

---

## Scripts & tests

```bash
# Backend syntax / load check
cd pfe-backend && npm run check

# Realtime engine smoke test (simulator)
cd pfe-backend && npm run test:realtime

# HTTP examples (REST Client / VS Code)
# pfe-backend/tests/phase3-analytics.http
```

**Database backup** (Docker stack running):

```bash
./scripts/backup.sh
# → backups/mariadb/mariadb_YYYYMMDD_HHMMSS.sql.gz
```

---

## Production build (manual, without Compose)

```bash
# Backend image
docker build -t pfe-backend ./pfe-backend

# Dashboard image (nginx serves SPA + proxies /api to backend:3000)
docker build -t pfe-dashboard ./pfe-dashboard
```

In Compose, the dashboard container expects the backend service hostname **`backend`** on port **3000** (see `pfe-dashboard/nginx/default.conf`).

---

## Troubleshooting

| Symptom | What to check |
|---------|----------------|
| Backend exits on start | `JWT_SECRET` length, `DB_HOST` / `MYSQL_*`, MariaDB reachable |
| Login 502 in dev | Start backend before Vite; set `VITE_API_PROXY_TARGET`; restart `npm run dev` |
| No live data | `PLC_SIMULATOR` vs `PLC_IP`; firewall on port 102; backend logs for S7 errors |
| Empty DB after deploy | Init SQL only runs on empty volume — use `down -v` only if you intend to wipe data |
| CORS errors | `CORS_ORIGIN` must match the browser URL (e.g. `http://localhost:5173`) |

---

## Security notes

- Change the bootstrap **`admin`** password immediately in production.
- Never commit `.env` — only [`.env.example`](.env.example).
- Use a unique `JWT_SECRET` per environment.
- Restrict plant VLAN access; the stack is designed for a trusted LAN (see project report for Purdue Level 2 guidance).

---

## Authors & context

Final-year project (**PFE**) — **Supervision and Data Acquisition System for a Rotary Bagging Machine**, Ciments de Bizerte.

**Developers:** Jawher Hajri, Mohamed Amin Trabelsi  
**Academic supervisor:** Mr. Benguisem Bachir (FSB)  
**Industrial supervisor:** Mr. Mouha Faker (Ciments de Bizerte)

---

## License

Backend package: **ISC** (see `pfe-backend/package.json`). Dashboard: private application code for the PFE; adjust before public redistribution if required by your institution.
