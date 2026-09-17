-- Daily trend snapshots
-- One row per (country, platform, date). Used for line charts.
-- Upserted daily by poll-all-accounts.

create table if not exists trend_snapshots (
  id            uuid primary key default gen_random_uuid(),
  country_id    text not null references countries(id) on delete cascade,
  platform      text not null,
  snapshot_date date not null,
  followers     bigint default 0,
  total_views   bigint default 0,
  created_at    timestamptz default now(),
  unique(country_id, platform, snapshot_date)
);

create index if not exists idx_ts_country_date
  on trend_snapshots(country_id, snapshot_date desc);
