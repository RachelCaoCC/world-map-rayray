-- Audit log
-- Records every connect/disconnect/reconnect/sync action.

create table if not exists audit_log (
  id          uuid primary key default gen_random_uuid(),
  action      text not null check (action in ('connect','disconnect','reconnect','sync','account_update')),
  actor       text not null,
  country_id  text not null,
  platform    text not null,
  details     text,
  created_at  timestamptz default now()
);

create index if not exists idx_al_created
  on audit_log(created_at desc);
