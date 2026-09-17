-- Platform connections
-- One row per OAuth'd account (e.g. one Facebook Page for Australia).
-- Multiple rows can share (country_id, platform) for multi-account support.

create table if not exists platform_connections (
  id                  uuid primary key default gen_random_uuid(),
  country_id          text not null references countries(id) on delete cascade,
  platform            text not null check (platform in ('facebook','instagram','youtube','tiktok')),
  external_account_id text not null,
  account_name        text not null,
  status              text not null default 'connected'
                        check (status in ('connected','token_expired','error','not_connected')),
  access_token        text not null,
  refresh_token       text,
  token_expires_at    timestamptz,
  last_synced_at      timestamptz,
  connected_by        uuid references auth.users(id),
  connected_at        timestamptz default now(),
  created_at          timestamptz default now()
);

create index if not exists idx_pc_country_platform
  on platform_connections(country_id, platform);

create index if not exists idx_pc_status
  on platform_connections(status);
