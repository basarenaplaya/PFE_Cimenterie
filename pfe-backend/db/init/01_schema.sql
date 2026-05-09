-- Baseline schema for PFE backend (MariaDB / MySQL 8 compatible).
-- Docker: mounted as /docker-entrypoint-initdb.d — runs once on empty data volume only.

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

CREATE TABLE IF NOT EXISTS users (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  username VARCHAR(64) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  role VARCHAR(16) NOT NULL DEFAULT 'OPERATOR',
  avatar_url VARCHAR(512) NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  last_login_at DATETIME(3) NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uk_users_username (username),
  KEY idx_users_role (role)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS audit_logs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id INT UNSIGNED NULL,
  action VARCHAR(512) NOT NULL,
  ip_address VARCHAR(45) NULL,
  `timestamp` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_audit_timestamp (`timestamp`),
  KEY idx_audit_user (user_id),
  CONSTRAINT fk_audit_logs_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS cameras (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  cam_name VARCHAR(255) NOT NULL,
  ip_url VARCHAR(1024) NOT NULL,
  added_by INT UNSIGNED NULL,
  last_snapshot LONGBLOB NULL,
  PRIMARY KEY (id),
  KEY idx_cameras_added_by (added_by),
  CONSTRAINT fk_cameras_user FOREIGN KEY (added_by) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS production_logs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  spout_id INT NOT NULL,
  weight_actual DECIMAL(14, 4) NOT NULL,
  weight_target DECIMAL(14, 4) NOT NULL,
  giveaway DECIMAL(14, 4) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_production_logs_created (created_at),
  KEY idx_production_logs_spout (spout_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS alarm_logs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  alarm_code VARCHAR(64) NOT NULL,
  description VARCHAR(512) NOT NULL,
  start_time DATETIME(3) NOT NULL,
  end_time DATETIME(3) NULL,
  duration_sec INT UNSIGNED NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  KEY idx_alarm_logs_code_time (alarm_code, start_time),
  KEY idx_alarm_logs_active (alarm_code, end_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS machine_status (
  id TINYINT UNSIGNED NOT NULL,
  current_mode VARCHAR(32) NOT NULL,
  is_running TINYINT(1) NOT NULL DEFAULT 0,
  last_update DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Also created at runtime by the API; included so a fresh DB is complete.
CREATE TABLE IF NOT EXISTS realtime_engine_state (
  id TINYINT NOT NULL,
  last_production_counter INT NOT NULL DEFAULT 0,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS dashboard_settings (
  id TINYINT UNSIGNED NOT NULL,
  price_per_ton_tnd DECIMAL(16, 4) NOT NULL,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;
