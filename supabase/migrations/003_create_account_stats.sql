-- Per-account analytics snapshot
-- One row per sync per connection. Only the latest row per connection matters.

create table if not exists account_stats (
  id                      uuid primary key default gen_random_uuid(),
  connection_id           uuid not null references platform_connections(id) on delete cascade,
  followers               bigint default 0,
  total_views             bigint default 0,
  follower_growth_pct_30d numeric default 0,
  view_growth_pct_30d     numeric default 0,
  synced_at               timestamptz default now(),
  created_at              timestamptz default now()
);

create index if not exists idx_as_connection
  on account_stats(connection_id);

create index if not exists idx_as_synced
  on account_stats(synced_at desc);
