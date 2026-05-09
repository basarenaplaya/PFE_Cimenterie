-- First-boot admin so you can log in and call /api/auth/register for more users.
-- Password (change immediately): ChangeMe!2026
-- Bcrypt 12 rounds, compatible with pfe-backend bcrypt dependency.

INSERT INTO users (username, password_hash, full_name, role, avatar_url, is_active)
SELECT
  'admin',
  '$2b$12$Prd6UsSzqSEwrw2gwkGfzOsFj9cVzkfFfMTKN.SgdFkK6VDG3uupa',
  'Bootstrap Admin',
  'ADMIN',
  'default_avatar.png',
  1
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM users WHERE username = 'admin' LIMIT 1);
