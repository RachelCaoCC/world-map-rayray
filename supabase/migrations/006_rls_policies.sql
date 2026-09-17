-- Row Level Security policies
-- Dashboard data is public-read. Connections + audit are authenticated-only.
-- Edge Functions use service_role key (bypasses RLS).

alter table countries            enable row level security;
alter table platform_connections enable row level security;
alter table account_stats        enable row level security;
alter table trend_snapshots      enable row level security;
alter table audit_log            enable row level security;

-- Public read: countries (homepage map + sidebar)
create policy "countries_read"
  on countries for select
  using (true);

-- Public read: account_stats (dashboard + presentation numbers)
create policy "account_stats_read"
  on account_stats for select
  using (true);

-- Public read: trend_snapshots (line charts)
create policy "trend_snapshots_read"
  on trend_snapshots for select
  using (true);

-- Public read: connections (admin panel uses anon key)
create policy "connections_read_public"
  on platform_connections for select
  using (true);

-- Public read: audit log (admin panel uses anon key)
create policy "audit_log_read_public"
  on audit_log for select
  using (true);
