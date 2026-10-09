-- Admin-maintained manual social metrics, shared by the world map and reports.
-- Legacy code snapshots remain as fallbacks until an admin saves a replacement.
CREATE TABLE IF NOT EXISTS public.manual_social_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  country_id text NOT NULL REFERENCES public.countries(id) ON DELETE CASCADE,
  platform text NOT NULL CHECK (platform IN ('facebook','instagram','youtube','tiktok','x')),
  account_name text NOT NULL CHECK (length(trim(account_name)) BETWEEN 1 AND 200),
  followers bigint NOT NULL DEFAULT 0 CHECK (followers >= 0),
  total_views bigint NOT NULL DEFAULT 0 CHECK (total_views >= 0),
  captured_at date NOT NULL DEFAULT CURRENT_DATE,
  is_hidden boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid NOT NULL REFERENCES auth.users(id),
  UNIQUE (country_id, platform, account_name)
);

CREATE TABLE IF NOT EXISTS public.manual_social_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_id uuid NOT NULL REFERENCES public.manual_social_snapshots(id) ON DELETE CASCADE,
  country_id text NOT NULL,
  platform text NOT NULL,
  account_name text NOT NULL,
  followers bigint NOT NULL CHECK (followers >= 0),
  total_views bigint NOT NULL CHECK (total_views >= 0),
  captured_at date NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  recorded_by uuid REFERENCES auth.users(id),
  UNIQUE (snapshot_id, captured_at)
);

CREATE INDEX IF NOT EXISTS idx_manual_social_country
  ON public.manual_social_snapshots (country_id, platform);
CREATE INDEX IF NOT EXISTS idx_manual_social_history_country_date
  ON public.manual_social_history (country_id, captured_at DESC);

-- Record one historical observation per account/date, preserving earlier dates.
CREATE OR REPLACE FUNCTION public.record_manual_social_snapshot()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  IF TG_OP = 'INSERT' OR
     NEW.followers IS DISTINCT FROM OLD.followers OR
     NEW.total_views IS DISTINCT FROM OLD.total_views OR
     NEW.captured_at IS DISTINCT FROM OLD.captured_at OR
     NEW.is_hidden IS DISTINCT FROM OLD.is_hidden THEN
    IF NOT NEW.is_hidden THEN
      INSERT INTO public.manual_social_history
        (snapshot_id, country_id, platform, account_name, followers, total_views, captured_at, recorded_by)
      VALUES
        (NEW.id, NEW.country_id, NEW.platform, NEW.account_name, NEW.followers,
         NEW.total_views, NEW.captured_at, NEW.updated_by)
      ON CONFLICT (snapshot_id, captured_at) DO UPDATE
        SET followers = EXCLUDED.followers,
            total_views = EXCLUDED.total_views,
            account_name = EXCLUDED.account_name,
            recorded_at = now(),
            recorded_by = EXCLUDED.recorded_by;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- BEFORE trigger needed to stamp updated_at; history is captured in AFTER trigger.
CREATE OR REPLACE FUNCTION public.stamp_manual_social_snapshot()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS manual_social_stamp ON public.manual_social_snapshots;
CREATE TRIGGER manual_social_stamp BEFORE INSERT OR UPDATE
  ON public.manual_social_snapshots FOR EACH ROW
  EXECUTE FUNCTION public.stamp_manual_social_snapshot();

-- History needs an AFTER trigger so snapshot row is visible to its FK.
CREATE OR REPLACE FUNCTION public.append_manual_social_history()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
BEGIN
  IF NOT NEW.is_hidden AND (
    TG_OP = 'INSERT' OR
    NEW.followers IS DISTINCT FROM OLD.followers OR
    NEW.total_views IS DISTINCT FROM OLD.total_views OR
    NEW.captured_at IS DISTINCT FROM OLD.captured_at OR
    NEW.is_hidden IS DISTINCT FROM OLD.is_hidden
  ) THEN
    INSERT INTO public.manual_social_history
      (snapshot_id, country_id, platform, account_name, followers, total_views, captured_at, recorded_by)
    VALUES
      (NEW.id, NEW.country_id, NEW.platform, NEW.account_name, NEW.followers,
       NEW.total_views, NEW.captured_at, NEW.updated_by)
    ON CONFLICT (snapshot_id, captured_at) DO UPDATE
      SET followers=EXCLUDED.followers,
          total_views=EXCLUDED.total_views,
          account_name=EXCLUDED.account_name,
          recorded_at=now(),
          recorded_by=EXCLUDED.recorded_by;
  END IF;
  RETURN NULL;
END;
$$;
DROP TRIGGER IF EXISTS manual_social_history_trigger ON public.manual_social_snapshots;
CREATE TRIGGER manual_social_history_trigger AFTER INSERT OR UPDATE
  ON public.manual_social_snapshots FOR EACH ROW
  EXECUTE FUNCTION public.append_manual_social_history();

ALTER TABLE public.manual_social_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.manual_social_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read manual social snapshots"
  ON public.manual_social_snapshots FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Admins can add manual snapshots"
  ON public.manual_social_snapshots FOR INSERT TO authenticated
  WITH CHECK ((auth.jwt()->'app_metadata'->>'role') = 'admin'
    AND updated_by = auth.uid());
CREATE POLICY "Admins can edit manual snapshots"
  ON public.manual_social_snapshots FOR UPDATE TO authenticated
  USING ((auth.jwt()->'app_metadata'->>'role') = 'admin')
  WITH CHECK ((auth.jwt()->'app_metadata'->>'role') = 'admin'
    AND updated_by = auth.uid());
CREATE POLICY "Public can read manual social history"
  ON public.manual_social_history FOR SELECT TO anon, authenticated USING (true);

GRANT SELECT ON public.manual_social_snapshots, public.manual_social_history TO anon, authenticated;
GRANT INSERT, UPDATE ON public.manual_social_snapshots TO authenticated;
COMMENT ON TABLE public.manual_social_snapshots IS
  'Admin-managed follower snapshots; overrides legacy fallback when account matches. API data takes precedence.';
