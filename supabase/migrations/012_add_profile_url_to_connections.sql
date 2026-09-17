-- 012_add_profile_url_to_connections.sql
-- Store profile URL for direct links to social accounts

ALTER TABLE platform_connections
  ADD COLUMN IF NOT EXISTS profile_url TEXT;

COMMENT ON COLUMN platform_connections.profile_url IS 'Direct profile URL from platform (e.g. TikTok profile_deep_link)';
