-- Adds last successful login timestamp for admin user table + audit UX.
-- Run against the PFE MySQL database.

ALTER TABLE users
  ADD COLUMN last_login_at DATETIME(3) NULL
  AFTER created_at;
