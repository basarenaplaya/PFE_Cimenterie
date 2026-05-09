#!/usr/bin/env bash
# Cron-friendly MariaDB logical backup: runs mysqldump inside the running DB container
# and stores a gzipped SQL file on the host.
#
# Usage (from repo root, after `docker compose -f docker-compose.prod.yml up -d`):
#   ./scripts/backup.sh
#
# Optional environment (defaults shown):
#   COMPOSE_FILE   docker-compose.prod.yml
#   PROJECT_ROOT   parent of scripts/ (auto-detected)
#   BACKUP_DIR     ./backups/mariadb (under PROJECT_ROOT)
#
# Requires a `.env` (or Compose --env-file) with the same MYSQL_* variables as compose,
# OR rely on Compose project env if you export them in the cron job.
#
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${PROJECT_ROOT}"

COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"
BACKUP_DIR="${BACKUP_DIR:-${PROJECT_ROOT}/backups/mariadb}"

if [[ -f "${PROJECT_ROOT}/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "${PROJECT_ROOT}/.env"
  set +a
fi

mkdir -p "${BACKUP_DIR}"
TS="$(date +%Y%m%d_%H%M%S)"
OUT="${BACKUP_DIR}/mariadb_${TS}.sql.gz"

# Credentials are expanded only inside the DB container environment (not echoed here).
docker compose -f "${COMPOSE_FILE}" exec -T db \
  sh -c 'mysqldump -h 127.0.0.1 -u"$MYSQL_USER" -p"$MYSQL_PASSWORD" "$MYSQL_DATABASE" --single-transaction --quick' \
  | gzip -c > "${OUT}"

echo "Backup written: ${OUT}"
