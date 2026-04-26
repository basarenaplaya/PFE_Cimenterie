-- Run against the PFE MySQL database (admin migration).
-- Adds cached frame for camera watch UI (Base64 data URL, validated on PATCH).

ALTER TABLE cameras
  ADD COLUMN last_snapshot LONGTEXT NULL
  AFTER ip_url;
