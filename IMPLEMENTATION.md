# Backend Implementation Guide — Supabase

## Architecture Overview

```
┌──────────────────────────────────────────────────────┐
│  Frontend (React + Zustand)                          │
│  - Calls Supabase JS client for reads               │
│  - Invokes Edge Functions for writes/OAuth           │
└──────────────┬───────────────────────┬───────────────┘
               │ reads (realtime)      │ writes (invoke)
               ▼                       ▼
┌──────────────────────┐  ┌─────────────────────────────┐
│  Supabase Postgres   │  │  Supabase Edge Functions    │
│  - countries         │  │  - oauth-callback           │
│  - platform_connections│ │  - sync-account             │
│  - account_stats     │  │  - poll-all-accounts        │
│  - trend_snapshots   │  │  - reconnect-account        │
│  - audit_log         │  │  - (shared) platform APIs   │
└──────────────────────┘  └─────────────────────────────┘
         ▲                            │
         │     Supabase Cron (pg_cron)│
         └────────────────────────────┘
              scheduled poll
```

**Two data flows:**
1. **Read path** — frontend queries Postgres via `supabase-js` client. No Edge Functions needed.
2. **Write path** — Edge Functions handle OAuth token exchange, platform API calls, and data writes.
3. **Polling** — `pg_cron` triggers `poll-all-accounts` Edge Function on schedule (every 15 min).

---

## Phase 1: Database Schema (migrations)

### 1.1 — Countries Table
```sql
-- supabase/migrations/001_create_countries.sql
create table if not exists countries (
  id text primary key,
  name text not null,
  region text not null,  -- 'Asia'|'Europe'|'North America'|etc.
  flag_code text not null,
  lat numeric,
  lng numeric,
  created_at timestamptz default now()
);
```

### 1.2 — Platform Connections
```sql
-- supabase/migrations/002_create_platform_connections.sql
create table if not exists platform_connections (
  id uuid primary key default gen_random_uuid(),
  country_id text not null references countries(id) on delete cascade,
  platform text not null check (platform in ('facebook','instagram','youtube','tiktok')),
  external_account_id text not null,
  account_name text not null,
  status text not null default 'connected' check (status in ('connected','token_expired','error','not_connected')),
  access_token text not null,         -- encrypted at rest via pgcrypto
  refresh_token text,
  token_expires_at timestamptz,
  last_synced_at timestamptz,
  connected_by uuid references auth.users(id),
  connected_at timestamptz default now(),
  created_at timestamptz default now()
);

create index idx_pc_country_platform on platform_connections(country_id, platform);
create index idx_pc_status on platform_connections(status);
```

### 1.3 — Account Stats (per-connection snapshot)
```sql
-- supabase/migrations/003_create_account_stats.sql
create table if not exists account_stats (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid not null references platform_connections(id) on delete cascade,
  followers bigint default 0,
  total_views bigint default 0,
  follower_growth_pct_30d numeric default 0,
  view_growth_pct_30d numeric default 0,
  synced_at timestamptz default now(),
  created_at timestamptz default now()
);

create index idx_as_connection on account_stats(connection_id);
create index idx_as_synced on account_stats(synced_at desc);
```

### 1.4 — Trend Snapshots (daily rollup for charts)
```sql
-- supabase/migrations/004_create_trend_snapshots.sql
create table if not exists trend_snapshots (
  id uuid primary key default gen_random_uuid(),
  country_id text not null references countries(id) on delete cascade,
  platform text not null,
  snapshot_date date not null,
  followers bigint default 0,
  total_views bigint default 0,
  created_at timestamptz default now(),
  unique(country_id, platform, snapshot_date)
);

create index idx_ts_country_date on trend_snapshots(country_id, snapshot_date desc);
```

### 1.5 — Audit Log
```sql
-- supabase/migrations/005_create_audit_log.sql
create table if not exists audit_log (
  id uuid primary key default gen_random_uuid(),
  action text not null check (action in ('connect','disconnect','reconnect','sync','account_update')),
  actor text not null,
  country_id text not null,
  platform text not null,
  details text,
  created_at timestamptz default now()
);

create index idx_al_created on audit_log(created_at desc);
```

### 1.6 — RLS Policies
```sql
-- supabase/migrations/006_rls_policies.sql
alter table countries enable row level security;
alter table platform_connections enable row level security;
alter table account_stats enable row level security;
alter table trend_snapshots enable row level security;
alter table audit_log enable row level security;

-- Public read for countries + stats (dashboard data)
create policy "countries_read" on countries for select using (true);
create policy "account_stats_read" on account_stats for select using (true);
create policy "trend_snapshots_read" on trend_snapshots for select using (true);

-- Authenticated read for connections (admin only)
create policy "connections_read" on platform_connections
  for select using (auth.role() = 'authenticated');

-- Authenticated read for audit log
create policy "audit_log_read" on audit_log
  for select using (auth.role() = 'authenticated');

-- Service role (Edge Functions) full access — no policy needed, uses service_role key
```

---

## Phase 2: Shared Utilities (Edge Functions)

### 2.1 — `_shared/platform-apis.ts`
Each platform API client as a function:
- `fetchFacebookStats(accessToken, pageId)` → `{ followers, totalViews }`
- `fetchInstagramStats(accessToken, igUserId)` → `{ followers, totalViews }`
- `fetchYouTubeStats(accessToken, channelId)` → `{ subscribers, totalViews }`
- `fetchTikTokStats(accessToken, businessId)` → `{ followers, totalViews }`
- `refreshAccessToken(platform, refreshToken)` → `{ accessToken, expiresAt }`

### 2.2 — `_shared/supabase-client.ts`
Create Supabase client with `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` env vars for server-side operations.

### 2.3 — `_shared/crypto.ts`
Token encryption/decryption helpers using Web Crypto API or `pgcrypto` for storing tokens at rest.

---

## Phase 3: Edge Functions

### 3.1 — `oauth-callback`
**Trigger:** Frontend redirects here after OAuth flow completes.
**Flow:**
1. Receive `code` + `state` (encoded countryId, platform) from query params
2. Exchange code for tokens via platform OAuth token URL
3. Fetch account list from platform API (pages/channels)
4. Return available accounts to frontend for Step 4 picker
5. On final selection: insert into `platform_connections`, run initial sync

### 3.2 — `sync-account`
**Trigger:** On-demand (admin click "Sync") or from `poll-all-accounts`.
**Input:** `connectionId: string`
**Flow:**
1. Fetch connection from `platform_connections`
2. Check token expiry — if expired, attempt refresh or set status `token_expired`
3. Call platform API with stored access token
4. Write new row to `account_stats`
5. Update `last_synced_at` on connection
6. Write to `audit_log`

### 3.3 — `poll-all-accounts`
**Trigger:** `pg_cron` every 15 minutes, or manual invocation.
**Flow:**
1. Fetch all `platform_connections` where `status = 'connected'`
2. For each: invoke `sync-account` (batch with rate limiting)
3. Write daily trend snapshot (aggregate `account_stats` into `trend_snapshots` for today's date)
4. Log summary to `audit_log`

### 3.4 — `reconnect-account`
**Trigger:** Admin clicks "Reconnect" on expired token.
**Input:** `connectionId: string`
**Flow:**
1. Fetch connection, generate new OAuth URL with stored scopes
2. Return redirect URL to frontend
3. Frontend opens OAuth popup → redirects back to `oauth-callback`
4. `oauth-callback` updates existing connection's tokens

---

## Phase 4: Supabase Cron Setup

```sql
-- Enable pg_cron extension
create extension if not exists pg_cron;

-- Schedule poll-all-accounts every 15 minutes
select cron.schedule(
  'poll-all-accounts',
  '*/15 * * * *',
  $$
  select net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/poll-all-accounts',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key'),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);
```

---

## Phase 5: Frontend Integration

### 5.1 — `src/lib/supabase.ts` (new file)
Initialize `createClient` from `@supabase/supabase-js` with anon key.

### 5.2 — Replace mock data reads in `src/store/useStore.ts`
| Current mock call | Replace with |
|---|---|
| `mockCountries` static array | `supabase.from('countries').select('*')` |
| `seedInitialConnections()` | `supabase.from('platform_connections').select('*')` |
| `accountStats` Map | `supabase.from('account_stats').select('*').order('synced_at', {ascending:false}).limit(1).eq('connection_id', connId)` |
| `getAggregatedStats()` | SQL view `v_country_platform_stats` (see 5.3) |
| `mockTrendData()` | `supabase.from('trend_snapshots').select('*').eq('country_id', id)` |
| `simulateLiveUpdate()` | Supabase Realtime subscription on `account_stats` table |

### 5.3 — Database View for Aggregated Stats
```sql
-- supabase/migrations/007_create_views.sql
create or replace view v_country_platform_stats as
select
  pc.country_id,
  pc.platform,
  count(*) as account_count,
  sum(as2.followers) as followers,
  sum(as2.total_views) as total_views,
  -- weighted average growth
  case when sum(as2.followers) > 0
    then round(sum(as2.follower_growth_pct_30d * as2.followers) / sum(as2.followers), 1)
    else 0
  end as follower_growth_pct_30d,
  case when sum(as2.total_views) > 0
    then round(sum(as2.view_growth_pct_30d * as2.total_views) / sum(as2.total_views), 1)
    else 0
  end as view_growth_pct_30d,
  max(as2.synced_at) as last_updated,
  case when count(*) > 0 then 'Updated' else 'Inactive' end as status
from platform_connections pc
left join lateral (
  select * from account_stats
  where connection_id = pc.id
  order by synced_at desc
  limit 1
) as2 on true
where pc.status = 'connected'
group by pc.country_id, pc.platform;
```

### 5.4 — Replace mock writes in `PlatformManager.tsx`
| Current mock action | Replace with |
|---|---|
| `connectAccount()` | `invoke('oauth-callback', { body })` → insert via Edge Function |
| `disconnectAccount()` | `supabase.from('platform_connections').delete().eq('id', connId)` |
| `triggerAccountSync()` | `invoke('sync-account', { body: { connectionId } })` |
| `reconnectAccount()` | `invoke('reconnect-account', { body: { connectionId } })` |

### 5.5 — Realtime Subscription for Live Updates
```typescript
// src/hooks/useRealtimePolling.ts
const channel = supabase
  .channel('account_stats_changes')
  .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'account_stats' }, (payload) => {
    // Update zustand store with new stats
  })
  .subscribe();
```

### 5.6 — New dependencies
```bash
npm install @supabase/supabase-js
```

---

## Implementation Steps (Ordered)

### Step 1: Database
- [ ] Write migration `001_create_countries.sql`
- [ ] Write migration `002_create_platform_connections.sql`
- [ ] Write migration `003_create_account_stats.sql`
- [ ] Write migration `004_create_trend_snapshots.sql`
- [ ] Write migration `005_create_audit_log.sql`
- [ ] Write migration `006_rls_policies.sql`
- [ ] Write migration `007_create_views.sql`
- [ ] Run `supabase db push` or `supabase migration up`

### Step 2: Shared Utilities
- [ ] Write `supabase/functions/_shared/supabase-client.ts`
- [ ] Write `supabase/functions/_shared/platform-apis.ts` (Facebook + Instagram + YouTube + TikTok fetchers)
- [ ] Write `supabase/functions/_shared/crypto.ts` (token encrypt/decrypt)

### Step 3: Edge Functions
- [ ] Write `supabase/functions/sync-account/index.ts`
- [ ] Write `supabase/functions/poll-all-accounts/index.ts`
- [ ] Write `supabase/functions/oauth-callback/index.ts`
- [ ] Write `supabase/functions/reconnect-account/index.ts`

### Step 4: Cron
- [ ] Set up `pg_cron` schedule for `poll-all-accounts`
- [ ] Configure Supabase env vars (`SUPABASE_URL`, `SERVICE_ROLE_KEY`)

### Step 5: Frontend Integration
- [ ] `npm install @supabase/supabase-js`
- [ ] Create `src/lib/supabase.ts`
- [ ] Update `src/store/useStore.ts` — replace mock reads with Supabase queries
- [ ] Update `src/store/useStore.ts` — replace mock writes with Edge Function invocations
- [ ] Create `src/hooks/useRealtimePolling.ts` — Supabase Realtime subscription
- [ ] Update `src/hooks/usePolling.ts` — use realtime instead of interval mock
- [ ] Update `src/data/mockData.ts` — remove mock functions, keep `PLATFORM_INFO` + `PLATFORM_COLORS`
- [ ] Update `PlatformManager.tsx` — wire wizard steps to Edge Functions
- [ ] Update `CountryDashboard.tsx` — wire trend data to Supabase query
- [ ] Update `PresentationMode.tsx` — wire live counter to Realtime subscription

### Step 6: Environment & Config
- [ ] Create `.env.local` with `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
- [ ] Create `supabase/.env` with `SUPABASE_SERVICE_ROLE_KEY` for Edge Functions
- [ ] Update `vite.config.ts` if needed for env var handling
- [ ] Test all flows end-to-end
