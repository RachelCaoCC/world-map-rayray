-- 011_add_username_to_connections.sql
-- Store platform username/handle for profile URLs

ALTER TABLE platform_connections
  ADD COLUMN IF NOT EXISTS username TEXT;

COMMENT ON COLUMN platform_connections.username IS 'Platform handle/username (e.g. @iflytek on TikTok)';
