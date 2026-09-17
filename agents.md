# Global Social Media Dashboard — Build Spec

Reference product: **iFLYTEK Global Social Media Dashboard**
Purpose of this document: a single spec Claude (or any engineer) can build from, covering all three screens, their components, states, and interactions.

---

## Tech Assumptions

- Frontend framework: React (component breakdown below assumes this, but is framework-agnostic)
- Map: interactive world map (e.g. react-simple-maps, or an SVG world map with per-country hit regions)
- Charts: line charts for follower/view trends (e.g. Recharts)
- Data refresh: polling or websocket for "live" counter updates — no full page reload
- Routing: 3 distinct routes/screens (Home → Country Dashboard → Follower Counter)

---

## Part 1 — Country Selection Homepage

### Layout
Three stacked/adjacent regions:
1. **Left sidebar** — country list
2. **Center/right** — interactive world map
3. **Bottom band** — aggregated global stats

### Top bar
- Product logo + title ("Global Social Media Dashboard")
- Notification bell icon
- Admin user avatar + name + role, with dropdown chevron

### Sidebar — Country List
- Header: "Select a Country or Region" + subtext ("Choose a market to view its social media follower data")
- Search input: "Search countries or regions..."
- Continent filter chips: `All | Asia | Europe | North America | Oceania` (multi-region support, extendable)
- List items, each showing:
  - Country flag icon
  - Country name
  - Follower count (e.g. "128.4K followers")
  - Selected state: highlighted background + checkmark badge
  - Chevron `>` to indicate navigation affordance
- **Sticky/pinned final item:** "Global / All Markets" — with globe icon and subtext "View aggregated global overview". Selecting this highlights all active countries on the map instead of one.

**Interactions:**
- Typing in search filters the list by country name **or** continent/region name
- Clicking a continent chip filters the list to that continent
- Clicking a list item:
  - Highlights/pins that country on the map
  - Opens the hover-style country card (see below) for that country
  - Marks the item as selected (checkmark) in the sidebar

### World Map
- Full world map with pins/markers on active countries/regions (currently active markets shown as pin icons)
- **Hover behavior:** hovering a pinned country shows a floating card with:
  - Country flag + country name
  - Total Followers
  - Active Platforms (count)
  - Last Updated (date)
  - **"Open Dashboard"** button → navigates to that country's dashboard (Part 2)
- Selecting a country from the sidebar should visually highlight/zoom that country region on the map (e.g. Australia highlighted in blue as in reference)
- Selecting "Global / All Markets" highlights all active countries simultaneously (no single-country card; could show an aggregate summary instead)

### Bottom Stats Band
Three stat cards below the map:
1. **Active Countries/Regions** — e.g. "32 of 195 countries"
2. **Total Followers** — e.g. "8.75M across all markets"
3. **Last Sync** — timestamp with timezone, e.g. "19 Jul 2026, 08:30 (UTC+10)"

---

## Part 2 — Country Social Media Dashboard

### Navigation
- Reached via "Open Dashboard" button on the map hover card
- Top tabs: `Overview | Countries` with a search bar and back navigation ("← Back to Countries")
- Header: country flag, country name, region/continent label, country selector dropdown (to switch countries without going back)

### Summary Cards (top row)
1. **Total Followers** — value + % change vs. last 30 days
2. **Total Views** — value + % change vs. last 30 days
3. **Active Platforms** — e.g. "4 / 4" (active vs. possible platforms)
4. **Last Updated** — timestamp + timezone

### Platform Cards
One card per **configured/active platform only** (Facebook, Instagram, YouTube, TikTok) — platforms not configured for a country must not render.

Each card contains:
- Platform logo + name
- "Connected" status badge
- Followers/Subscribers count + % growth
- Total Views count + % growth
- Click/tap target navigates to that platform's full-screen Follower Counter (Part 3), scoped to this platform only

### Trend Graphs
Two line charts:
1. **Follower Trend** — one line per platform (Facebook, Instagram, YouTube, TikTok), color-coded, with legend
2. **Views Trend** — same, for views

Both charts share a period toggle: `7D | 30D | 90D | Custom`
X-axis: dates across the selected period. Chart re-renders on period change.

### Platform Comparison Table
Columns:

| Platform | Account Name | Followers / Subscribers | Total Views | Follower Growth (last 30D) | View Growth (last 30D) | Last Updated | Status |
|---|---|---|---|---|---|---|---|

- One row per active platform for the country
- Growth columns show %, positive growth styled green
- **Status** = `Updated` (green badge) or `Inactive` (per data freshness / connection state)

---

## Part 3 — Full-Screen Follower Counter ("Presentation Mode")

Entered by clicking a platform card in Part 2. Presentation-style, not a dashboard.

### Behavior Requirements
1. Opens full-screen from the country dashboard.
2. Visual style is a **presentation**, not an analytics UI — minimal chrome, large centered content.
3. Displays **one platform at a time**.
4. Sequence per platform: **logo + platform name** appears first → **metric label** (e.g. "Subscribers") appears second → **number**.
5. The number is shown on an **analog/mechanical flip-counter** style display — individual digit slots that roll into place (like the reference odometer/flip-clock visual).
6. After rolling into place, the final number **stays visible for a readable dwell time** before advancing.
7. Auto-advances to the **next available platform** for that country after the dwell time.
8. **Only platforms configured/active for the selected country** appear in the rotation — skip any platform not connected.
9. Data updates **live, in place, without a page reload** (poll or subscribe to updates).
10. If the value changes while displayed (or on refresh), **only the changed digits animate/roll** — unchanged digits stay static.
11. **Error resilience:** a temporary fetch/data error must NOT flash/replace the valid number with `0` or blank — retain last-known-good value until a valid update arrives.
12. Layout is fixed/responsive for **16:9 full-screen displays** (e.g. TV, kiosk, projector).
13. After the last platform in the rotation, it **loops back to the first** automatically — continuous rotation.

### Screen elements
- Platform logo (large, centered)
- Platform name (e.g. "YouTube")
- Metric label (e.g. "Subscribers")
- Flip-digit counter row (6 digits shown in reference, should size to value length)
- Live indicator (e.g. "● Live")
- Auto-refresh indicator (e.g. "Auto refresh every 15 sec")
- iFLYTEK branding, top-left

---

## Part 4 — Admin: Connecting Social Media Accounts

This is a separate admin-only area (not part of the viewer-facing flow above) where the Admin user links each country's Facebook, Instagram, YouTube, and TikTok accounts so their stats can appear in Parts 1–3.

### Where it lives
- New top-level nav item, e.g. **"Manage Connections"** or gear icon next to the Admin avatar in the top bar
- Accessible only to Admin/Owner roles

### Screen: Connections Overview
A table/list, one row per **Country × Platform** combination:

| Country | Platform | Account | Status | Last Synced | Actions |
|---|---|---|---|---|---|
| Australia | Facebook | iFLYTEK Australia | 🟢 Connected | 2m ago | Reconnect / Disconnect |
| Australia | TikTok | — | ⚪ Not Connected | — | Connect |
| United States | Instagram | — | 🔴 Token Expired | 3d ago | Reconnect |

- Filter by country and/or platform
- Status states: `Not Connected`, `Connected`, `Token Expired`, `Error` (e.g. rate-limited, revoked permission)
- "Connect" opens the OAuth flow for that platform; "Reconnect" re-runs OAuth to refresh a stale token; "Disconnect" revokes and removes the link (with confirmation dialog, since it removes the platform card from that country's dashboard)

### Add a new connection — flow
1. Admin clicks **"+ Connect Account"**
2. **Step 1 — Select Country/Region**: choose an existing country or add a new one (name, flag, region, coordinates for the map pin)
3. **Step 2 — Select Platform**: Facebook, Instagram, YouTube, or TikTok
4. **Step 3 — Authenticate**: standard OAuth 2.0 redirect to the platform, requesting the minimum scopes needed:
   - **Facebook** — Facebook Login for Business; scopes: `pages_read_engagement`, `pages_show_list`, `read_insights`
   - **Instagram** — via Instagram Graph API (requires a linked Facebook Page); scopes: `instagram_basic`, `instagram_manage_insights`
   - **YouTube** — Google OAuth; scope: `youtube.readonly` (channel stats via YouTube Data/Analytics API)
   - **TikTok** — TikTok for Business Login; scopes for follower/video analytics (Display API or Business API depending on account type)
5. **Step 4 — Select Account/Page/Channel**: if the OAuth'd user manages multiple Pages/Channels, show a picker so Admin selects the exact one to bind to that country
6. **Step 5 — Confirm & Save**: store the linkage; an initial sync runs immediately and populates Parts 1–3

### Token & sync handling
- Store access/refresh tokens server-side only, encrypted at rest — never exposed to the frontend
- Background job refreshes tokens before expiry where the platform supports refresh tokens (Google/TikTok); Facebook/Instagram long-lived tokens need periodic re-auth (~60 days) — surface this as "Token Expired" before it lapses, not after
- Scheduled sync job pulls followers/views per platform on an interval (e.g. every 15 min for dashboard cards, faster/cached differently for the live Part 3 counter) and writes into the `PlatformStats` records
- If a sync fails, keep the last-known-good values and flag `status: "Error"` — this is also what backs requirement #12 in Part 3 (never show 0 on a transient error)

### Permissions & audit
- Only Admin/Owner roles can connect/disconnect accounts
- Log each connect/disconnect/reconnect action with actor, timestamp, country, platform (audit trail)
- Consider a "Viewer" role that can see dashboards but not the Connections screen

### Data model addition

```ts
interface PlatformConnection {
  countryId: string;
  platform: PlatformKey;
  externalAccountId: string;   // Page ID / Channel ID / TikTok business account ID
  accountName: string;
  status: "connected" | "not_connected" | "token_expired" | "error";
  accessToken: string;   // stored server-side, encrypted, never sent to client
  refreshToken?: string;
  tokenExpiresAt?: string;
  lastSyncedAt: string;
  connectedBy: string;   // admin user id
  connectedAt: string;
}
```

---

## Appendix A — Platform APIs for Audience Data

Detail behind the Step 3 "Authenticate" scopes in Part 4. Covers what each official API can and cannot return, since the four platforms are not equivalent in how much audience detail they expose.

### Facebook — Graph API (Facebook Login for Business)
- Auth: OAuth 2.0 via Facebook Login for Business
- Scopes: `pages_read_engagement`, `pages_show_list`, `read_insights`
- Key endpoint: `GET /{page-id}/insights` → followers, reach, engagement
- Requires Meta App Review before these scopes work in production (budget lead time)
- Rate limits are per-app, tiered by usage

### Instagram — Graph API
- Auth: OAuth via Meta, **but the IG account must be a Business or Creator account linked to a Facebook Page** — this is a hard platform requirement, not optional. The legacy Instagram Basic Display API is deprecated and unusable for analytics.
- Scopes: `instagram_basic`, `instagram_manage_insights`
- Key endpoint: `GET /{ig-user-id}/insights` → `follower_count`, `audience_city`, `audience_gender_age`, and other demographic fields — but only for the **authenticated account itself**. There is no endpoint to pull another account's demographics without that account separately authenticating your app.
- No endpoint returns individual follower/following lists for any account — only aggregate counts and demographics
- Rate limit: ~200 calls per user per hour (Business Use Case limit)
- App Review lead time: typically 2–4 weeks for standard permissions

### YouTube — YouTube Data API / YouTube Analytics API
- Auth: standard Google OAuth 2.0
- Scope: `youtube.readonly` (Data API for channel stats; Analytics API for deeper breakdowns)
- Key data: subscriber count, view count, and — via the Analytics API — audience demographics (age/gender/geography) and traffic sources
- Most straightforward of the four: no linked-account prerequisite, refresh tokens are long-lived and reliable
- Standard Google API quota system applies (daily unit quota, requestable increase)

### TikTok — TikTok for Business / Display API
- Auth: TikTok Login Kit / TikTok for Business OAuth
- Scopes: follower/video read scopes (exact set depends on Display API vs. Business API tier)
- Key data available: follower count, video-level metrics (views, likes, comments, shares) — but **only for accounts that individually authenticate your app**; there's no lookup for arbitrary public accounts
- **Known limitation:** audience demographics (age, gender, geographic breakdown) are **not available through official TikTok API endpoints**, even for consented/authenticated accounts, for commercial use. The Research API exposes some of this, but it's restricted to approved academic/nonprofit researchers — not usable for a commercial dashboard.
- Practical implication: TikTok cards in Parts 2–3 can reliably show followers and views, but any "audience breakdown" feature planned for later phases won't be achievable for TikTok via official APIs without a third-party data provider (and associated ToS/compliance review).

### Summary table

| Capability | Facebook | Instagram | YouTube | TikTok |
|---|---|---|---|---|
| Follower/subscriber count | ✅ | ✅ | ✅ | ✅ |
| Total views | ✅ | ✅ | ✅ | ✅ (video-level) |
| Audience demographics (age/gender/geo) | ✅ | ✅ (own account only) | ✅ | ❌ (not available commercially) |
| Requires linked secondary account | — | Facebook Page required | — | — |
| Typical app review lead time | Weeks | 2–4 weeks | Minimal | Varies by tier |

### Multi-account connection note
Each account (per country, per platform) is authenticated and stored independently — connecting the Australia Facebook Page and the US Facebook Page are two separate OAuth runs, producing two separate token pairs in the `PlatformConnection` table. There's no bulk/multi-account OAuth grant on any of these platforms; the Admin (or that market's local team) authenticates one account at a time.

---

## Data Model Sketch

```ts
interface Country {
  id: string;
  name: string;
  region: "Asia" | "Europe" | "North America" | "Oceania" | ...;
  flagUrl: string;
  totalFollowers: number;
  activePlatforms: PlatformKey[];
  lastUpdated: string; // ISO timestamp
  lat: number;
  lng: number;
}

type PlatformKey = "facebook" | "instagram" | "youtube" | "tiktok";

interface PlatformStats {
  platform: PlatformKey;
  accountName: string;
  followers: number;
  totalViews: number;
  followerGrowthPct30d: number;
  viewGrowthPct30d: number;
  lastUpdated: string;
  status: "Updated" | "Inactive";
  connected: boolean;
}

interface TrendPoint {
  date: string;
  facebook?: number;
  instagram?: number;
  youtube?: number;
  tiktok?: number;
}
```

---

## Open Questions / Assumptions to Confirm

- Refresh interval for live counters — reference shows "every 15 sec"; confirm if configurable per deployment.
- Dwell time per platform in the presentation rotation (not specified in reference — suggest 5–8s configurable).
- Whether "Global / All Markets" on Part 1 has its own aggregate dashboard (Part 2 equivalent) or is homepage-only.
- Auth/permissions: is this Admin-only, or are there viewer roles with restricted country access?
