-- 010_fix_connections_rls.sql
-- Relax connections/audit RLS to authenticated (admin check done at UI layer)

DROP POLICY IF EXISTS "connections_read_admin" ON platform_connections;
DROP POLICY IF EXISTS "audit_log_read_admin" ON audit_log;

CREATE POLICY "connections_read_auth"
  ON platform_connections FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "audit_log_read_auth"
  ON audit_log FOR SELECT
  TO authenticated
  USING (true);
