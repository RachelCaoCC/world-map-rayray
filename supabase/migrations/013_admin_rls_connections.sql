-- 013_admin_rls_connections.sql
-- Only admins can read platform_connections and audit_log

-- Drop existing permissive policies
DROP POLICY IF EXISTS "connections_read_auth" ON platform_connections;
DROP POLICY IF EXISTS "audit_log_read_auth" ON audit_log;

-- Admin check function (SECURITY DEFINER can read auth.users)
CREATE OR REPLACE FUNCTION public.is_admin()
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

-- Only admins can read connections
CREATE POLICY "connections_read_admin"
  ON platform_connections FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- Only admins can read audit log
CREATE POLICY "audit_log_read_admin"
  ON audit_log FOR SELECT
  TO authenticated
  USING (public.is_admin());
