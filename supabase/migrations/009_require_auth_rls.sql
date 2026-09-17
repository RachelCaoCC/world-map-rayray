-- 009_require_auth_rls.sql
-- Update RLS: require authentication for all tables

-- Helper function to check if current user is admin
CREATE OR REPLACE FUNCTION public.is_admin_user()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = auth.uid()
    AND (
      raw_app_meta_data->>'role' = 'admin'
      OR raw_user_meta_data->>'role' = 'admin'
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Drop existing public read policies
DROP POLICY IF EXISTS "countries_read" ON countries;
DROP POLICY IF EXISTS "account_stats_read" ON account_stats;
DROP POLICY IF EXISTS "trend_snapshots_read" ON trend_snapshots;
DROP POLICY IF EXISTS "connections_read_public" ON platform_connections;
DROP POLICY IF EXISTS "audit_log_read_public" ON audit_log;

-- Countries: authenticated users can read
CREATE POLICY "countries_read_auth"
  ON countries FOR SELECT
  TO authenticated
  USING (true);

-- Account stats: authenticated users can read
CREATE POLICY "account_stats_read_auth"
  ON account_stats FOR SELECT
  TO authenticated
  USING (true);

-- Trend snapshots: authenticated users can read
CREATE POLICY "trend_snapshots_read_auth"
  ON trend_snapshots FOR SELECT
  TO authenticated
  USING (true);

-- Platform connections: authenticated users can read
CREATE POLICY "connections_read_auth"
  ON platform_connections FOR SELECT
  TO authenticated
  USING (true);

-- Audit log: authenticated users can read
CREATE POLICY "audit_log_read_auth"
  ON audit_log FOR SELECT
  TO authenticated
  USING (true);
