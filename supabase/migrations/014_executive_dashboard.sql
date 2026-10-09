-- Executive Dashboard shared operating ledger.
-- Public analytics are readable, only app_metadata.role=admin can modify.
CREATE TABLE IF NOT EXISTS public.executive_dashboard_data (
  id text PRIMARY KEY DEFAULT 'global',
  payload jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(payload) = 'object'),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id)
);

ALTER TABLE public.executive_dashboard_data ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Executive dashboard can be read" ON public.executive_dashboard_data
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Only admins can insert executive dashboard" ON public.executive_dashboard_data
  FOR INSERT TO authenticated
  WITH CHECK (
    (auth.jwt()->'app_metadata'->>'role') = 'admin'
    AND id = 'global'
    AND updated_by = auth.uid()
  );

CREATE POLICY "Only admins can update executive dashboard" ON public.executive_dashboard_data
  FOR UPDATE TO authenticated
  USING ((auth.jwt()->'app_metadata'->>'role') = 'admin')
  WITH CHECK (
    (auth.jwt()->'app_metadata'->>'role') = 'admin'
    AND id = 'global'
    AND updated_by = auth.uid()
  );

GRANT SELECT ON public.executive_dashboard_data TO anon, authenticated;
GRANT INSERT, UPDATE ON public.executive_dashboard_data TO authenticated;

COMMENT ON TABLE public.executive_dashboard_data IS
  'Single shared latest import and market / website inputs for the Executive Dashboard. Never contains OAuth credentials.';
