import { create } from "zustand";
import type {
  Country, PlatformKey, ContinentFilter, PlatformConnection,
  ConnectionStatus, AuditLogEntry, AccountStats, CountryPlatformStats,
  AvailableAccount, TrendPoint,
} from "../types";
import { supabase } from "../lib/supabase";
import { getManualSnapshots, getManualSupportedPlatforms } from "../data/manualSnapshots";

const ALL_PLATFORMS: PlatformKey[] = ["facebook", "instagram", "youtube", "tiktok"];
const FUNC_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;

function getCountryMetrics(
  countryId: string,
  connections: PlatformConnection[],
  stats: Map<string, AccountStats>,
) {
  const connected = connections.filter(
    (connection) => connection.countryId === countryId && connection.status === "connected",
  );
  const connectedPlatforms = new Set(connected.map((connection) => connection.platform));
  const manualFallbacks = getManualSnapshots(countryId).filter(
    (snapshot) => !connectedPlatforms.has(snapshot.platform as PlatformKey),
  );
  const activePlatforms = [...new Set([
    ...connected.map((connection) => connection.platform),
    ...getManualSupportedPlatforms(countryId).filter((platform) => !connectedPlatforms.has(platform)),
  ])] as PlatformKey[];
  const apiFollowers = connected.reduce(
    (sum, connection) => sum + (stats.get(connection.id)?.followers ?? 0),
    0,
  );
  const manualFollowers = manualFallbacks.reduce((sum, snapshot) => sum + snapshot.followers, 0);
  const lastUpdated = connected.reduce(
    (latest, connection) => connection.lastSyncedAt > latest ? connection.lastSyncedAt : latest,
    "",
  ) || manualFallbacks.reduce(
    (latest, snapshot) => snapshot.capturedAt > latest ? snapshot.capturedAt : latest,
    "",
  );

  return {
    activePlatforms,
    totalFollowers: apiFollowers + manualFollowers,
    lastUpdated: lastUpdated || new Date().toISOString(),
  };
}

interface DashboardState {
  // Country data
  countries: Country[];
  selectedCountryId: string | null;
  hoveredCountryId: string | null;

  // Multi-account connections
  platformConnections: PlatformConnection[];
  // Per-account analytics (keyed by connection.id)
  accountStats: Map<string, AccountStats>;

  // Trend data
  trendData: TrendPoint[];

  // Audit trail
  auditLog: AuditLogEntry[];

  // Filters
  searchQuery: string;
  continentFilter: ContinentFilter;

  // Presentation
  currentPlatformIndex: number;
  isPresentationMode: boolean;
  isAutoPlaying: boolean;

  // Loading states
  isLoaded: boolean;

  // ─── Data fetching ───
  fetchCountries: () => Promise<void>;
  fetchConnections: () => Promise<void>;
  fetchAccountStats: () => Promise<void>;
  fetchTrendData: (countryId: string) => Promise<void>;
  fetchAuditLog: () => Promise<void>;
  fetchAll: () => Promise<void>;

  // ─── Actions — country / navigation ───
  setSelectedCountry: (id: string | null) => void;
  setHoveredCountry: (id: string | null) => void;
  setSearchQuery: (q: string) => void;
  setContinentFilter: (f: ContinentFilter) => void;
  setCurrentPlatformIndex: (i: number) => void;
  nextPlatform: (activePlatforms: PlatformKey[]) => void;
  setIsPresentationMode: (v: boolean) => void;
  setIsAutoPlaying: (v: boolean) => void;

  // ─── Actions — multi-account connection ───
  getAvailableAccounts: (countryId: string, platform: PlatformKey) => AvailableAccount[];
  connectAccount: (countryId: string, platform: PlatformKey, account: AvailableAccount, accessToken: string, refreshToken?: string, expiresIn?: number) => Promise<string>;
  disconnectAccount: (connectionId: string) => Promise<void>;
  reconnectAccount: (connectionId: string) => Promise<void>;
  triggerAccountSync: (connectionId: string) => Promise<void>;

  // ─── Getters ───
  getConnectionsForCountryPlatform: (countryId: string, platform: PlatformKey) => PlatformConnection[];
  getConnectionsForCountry: (countryId: string) => PlatformConnection[];
  getConnectionById: (id: string) => PlatformConnection | undefined;
  getAccountStats: (connectionId: string) => AccountStats | undefined;
  getAggregatedStats: (countryId: string, platform: PlatformKey) => CountryPlatformStats;
  getAggregatedStatsForCountry: (countryId: string) => CountryPlatformStats[];
  getAuditLog: (filters?: { countryId?: string; platform?: PlatformKey }) => AuditLogEntry[];

  // ─── Derived ───
  filteredCountries: () => Country[];
  getCountryById: (id: string) => Country | undefined;
  totalFollowersAll: () => number;
}

export const useDashboardStore = create<DashboardState>((set, get) => ({
  countries: [],
  selectedCountryId: null,
  hoveredCountryId: null,
  platformConnections: [],
  accountStats: new Map(),
  trendData: [],
  auditLog: [],
  searchQuery: "",
  continentFilter: "All",
  currentPlatformIndex: 0,
  isPresentationMode: false,
  isAutoPlaying: true,
  isLoaded: false,

  // ─── Data fetching ───

  fetchCountries: async () => {
    // Try cache first (countries rarely change)
    const cacheKey = "countries_cache";
    const cacheTTL = 24 * 60 * 60 * 1000; // 24 hours
    try {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        const { data, ts } = JSON.parse(cached);
        if (Date.now() - ts < cacheTTL) {
          // Enrich cached data with current connections
          const conns = get().platformConnections;
          const stats = get().accountStats;
          const countries: Country[] = data.map((row: Record<string, unknown>) => {
            const countryId = row.id as string;
            const metrics = getCountryMetrics(countryId, conns, stats);
            return {
              id: countryId,
              name: row.name as string,
              region: row.region as Country["region"],
              flagCode: row.flag_code as string,
              ...metrics,
              lat: row.lat as number,
              lng: row.lng as number,
            };
          });
          set({ countries });
          return;
        }
      }
    } catch { /* ignore cache errors */ }

    // Fetch from DB
    const { data, error } = await supabase
      .from("countries")
      .select("*")
      .order("name");
    if (error) { console.error("fetchCountries:", error); return; }

    // Cache raw data
    try {
      localStorage.setItem(cacheKey, JSON.stringify({ data, ts: Date.now() }));
    } catch { /* ignore quota errors */ }

    // Enrich with computed fields from connections
    const conns = get().platformConnections;
    const stats = get().accountStats;
    const countries: Country[] = (data ?? []).map((row: Record<string, unknown>) => {
      const countryId = row.id as string;
      const metrics = getCountryMetrics(countryId, conns, stats);
      return {
        id: countryId,
        name: row.name as string,
        region: row.region as Country["region"],
        flagCode: row.flag_code as string,
        ...metrics,
        lat: row.lat as number,
        lng: row.lng as number,
      };
    });
    set({ countries });
  },

  fetchConnections: async () => {
    const { data: { session } } = await supabase.auth.getSession();
    // Guests see only non-secret connection metadata, admins use the protected endpoint.
    let rows: Record<string, unknown>[] = [];
    if (session?.user.app_metadata?.role === "admin") {
      const res = await fetch(`${FUNC_URL}/get-accounts`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!res.ok) { console.error("fetchConnections:", res.status); return; }
      const result = await res.json();
      if (!result.ok) { console.error("fetchConnections:", result.error); return; }
      rows = result.connections ?? [];
    } else {
      const { data, error } = await supabase.from("public_platform_connections").select("*");
      if (error) { console.error("fetchPublicConnections:", error); return; }
      rows = data ?? [];
    }

    const connections: PlatformConnection[] = rows.map((row: Record<string, unknown>) => ({
      id: row.id as string,
      countryId: row.country_id as string,
      platform: row.platform as PlatformKey,
      externalAccountId: row.external_account_id as string,
      accountName: row.account_name as string,
      username: row.username as string | undefined,
      profileUrl: row.profile_url as string | undefined,
      status: row.status as ConnectionStatus,
      accessToken: "", // never sent to client
      refreshToken: undefined,
      tokenExpiresAt: row.token_expires_at as string | undefined,
      lastSyncedAt: row.last_synced_at as string ?? "",
      connectedBy: row.connected_by as string ?? "",
      connectedAt: row.connected_at as string ?? "",
    }));
    set({ platformConnections: connections });
  },

  fetchAccountStats: async () => {
    const { data, error } = await supabase
      .from("account_stats")
      .select("*")
      .order("synced_at", { ascending: false });
    if (error) { console.error("fetchAccountStats:", error); return; }
    const map = new Map<string, AccountStats>();
    // Keep only latest per connection
    for (const row of data ?? []) {
      const r = row as Record<string, unknown>;
      const connId = r.connection_id as string;
      if (map.has(connId)) continue; // first row is latest (ordered desc)
      map.set(connId, {
        connectionId: connId,
        followers: Number(r.followers ?? 0),
        totalViews: Number(r.total_views ?? 0),
        followerGrowthPct30d: Number(r.follower_growth_pct_30d ?? 0),
        viewGrowthPct30d: Number(r.view_growth_pct_30d ?? 0),
        lastUpdated: r.synced_at as string ?? "",
      });
    }
    set({ accountStats: map });
  },

  fetchTrendData: async (countryId: string) => {
    const { data, error } = await supabase
      .from("trend_snapshots")
      .select("*")
      .eq("country_id", countryId)
      .order("snapshot_date", { ascending: true });
    if (error) { console.error("fetchTrendData:", error); return; }
    const points: TrendPoint[] = (data ?? []).map((row: Record<string, unknown>) => ({
      date: row.snapshot_date as string,
      facebook: row.platform === "facebook" ? { followers: Number(row.followers), views: Number(row.total_views) } : undefined,
      instagram: row.platform === "instagram" ? { followers: Number(row.followers), views: Number(row.total_views) } : undefined,
      youtube: row.platform === "youtube" ? { followers: Number(row.followers), views: Number(row.total_views) } : undefined,
      tiktok: row.platform === "tiktok" ? { followers: Number(row.followers), views: Number(row.total_views) } : undefined,
    }));
    // Merge same-date rows into one TrendPoint
    const merged = new Map<string, TrendPoint>();
    for (const p of points) {
      const existing = merged.get(p.date) ?? { date: p.date };
      if (p.facebook !== undefined) existing.facebook = p.facebook;
      if (p.instagram !== undefined) existing.instagram = p.instagram;
      if (p.youtube !== undefined) existing.youtube = p.youtube;
      if (p.tiktok !== undefined) existing.tiktok = p.tiktok;
      merged.set(p.date, existing);
    }
    set({ trendData: Array.from(merged.values()) });
  },

  fetchAuditLog: async () => {
    const { data, error } = await supabase
      .from("audit_log")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) { console.error("fetchAuditLog:", error); return; }
    const log: AuditLogEntry[] = (data ?? []).map((row: Record<string, unknown>) => ({
      id: row.id as string,
      action: row.action as AuditLogEntry["action"],
      actor: row.actor as string,
      timestamp: row.created_at as string,
      countryId: row.country_id as string,
      platform: row.platform as PlatformKey,
      details: row.details as string ?? "",
    }));
    set({ auditLog: log });
  },

  fetchAll: async () => {
    await Promise.all([
      get().fetchConnections(),
      get().fetchAccountStats(),
    ]);
    await get().fetchCountries();
    set({ isLoaded: true });
  },

  // ─── Country / navigation ───

  setSelectedCountry: (id) => set({ selectedCountryId: id, hoveredCountryId: id }),
  setHoveredCountry: (id) => set({ hoveredCountryId: id }),
  setSearchQuery: (q) => set({ searchQuery: q }),
  setContinentFilter: (f) => set({ continentFilter: f }),
  setCurrentPlatformIndex: (i) => set({ currentPlatformIndex: i }),
  setIsPresentationMode: (v) => set({ isPresentationMode: v }),
  setIsAutoPlaying: (v) => set({ isAutoPlaying: v }),

  nextPlatform: (activePlatforms) => {
    const next = (get().currentPlatformIndex + 1) % activePlatforms.length;
    set({ currentPlatformIndex: next });
  },

  // ─── Multi-account connection ───

  getAvailableAccounts: (_countryId, _platform) => {
    // In real app, this would be returned from oauth-callback
    // Frontend holds temp state from the OAuth flow
    return [];
  },

  connectAccount: async (countryId, platform, account, accessToken, refreshToken, expiresIn) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session || session.user.app_metadata?.role !== "admin") throw new Error("Admin sign-in required");
    const res = await fetch(`${FUNC_URL}/connect-account`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        countryId,
        platform,
        externalAccountId: account.id,
        accountName: account.name,
        username: account.username,
        profileUrl: account.profileUrl,
        accessToken,
        refreshToken,
        expiresIn,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Connect failed");

    // Refresh local state
    await get().fetchAll();
    return data.connectionId;
  },

  disconnectAccount: async (connectionId) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error("Your session has expired. Please sign in again.");

    const res = await fetch(`${FUNC_URL}/disconnect-account`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ connectionId }),
    });
    const data = await res.json();
    if (!res.ok || !data.ok) throw new Error(data.error ?? "Disconnect failed");
    await get().fetchAll();
  },

  reconnectAccount: async (connectionId) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session || session.user.app_metadata?.role !== "admin") throw new Error("Admin sign-in required");
    const res = await fetch(`${FUNC_URL}/reconnect-account`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ connectionId }),
    });
    const data = await res.json();
    if (data.oauthUrl) {
      window.open(data.oauthUrl, "_blank", "width=600,height=700");
    }
    await get().fetchAll();
  },

  triggerAccountSync: async (connectionId) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session || session.user.app_metadata?.role !== "admin") throw new Error("Admin sign-in required");
    const res = await fetch(`${FUNC_URL}/sync-account`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ connectionId }),
    });
    if (!res.ok) console.error("Sync failed");
    await get().fetchAll();
  },

  // ─── Getters ───

  getConnectionsForCountryPlatform: (countryId, platform) => {
    return get().platformConnections.filter(
      c => c.countryId === countryId && c.platform === platform
    );
  },

  getConnectionsForCountry: (countryId) => {
    return get().platformConnections.filter(c => c.countryId === countryId);
  },

  getConnectionById: (id) => {
    return get().platformConnections.find(c => c.id === id);
  },

  getAccountStats: (connectionId) => {
    return get().accountStats.get(connectionId);
  },

  getAggregatedStats: (countryId, platform) => {
    const connections = get().platformConnections.filter(
      c => c.countryId === countryId && c.platform === platform && c.status === "connected"
    );

    if (connections.length === 0) {
      const manual = getManualSnapshots(countryId, platform);
      if (manual.length > 0) {
        return {
          countryId,
          platform,
          accountCount: manual.length,
          followers: manual.reduce((sum, snapshot) => sum + snapshot.followers, 0),
          totalViews: 0,
          followerGrowthPct30d: 0,
          viewGrowthPct30d: 0,
          lastUpdated: manual.reduce(
            (latest, snapshot) => snapshot.capturedAt > latest ? snapshot.capturedAt : latest,
            "",
          ),
          status: "Updated",
        };
      }

      return {
        countryId,
        platform,
        accountCount: 0,
        followers: 0,
        totalViews: 0,
        followerGrowthPct30d: 0,
        viewGrowthPct30d: 0,
        lastUpdated: "",
        status: "Inactive",
      };
    }

    const allStats = connections
      .map(c => get().accountStats.get(c.id))
      .filter((s): s is AccountStats => s !== undefined);

    if (allStats.length === 0) {
      return {
        countryId,
        platform,
        accountCount: connections.length,
        followers: 0,
        totalViews: 0,
        followerGrowthPct30d: 0,
        viewGrowthPct30d: 0,
        lastUpdated: connections[0]?.lastSyncedAt ?? "",
        status: "Updated",
      };
    }

    const totalFollowers = allStats.reduce((sum, s) => sum + s.followers, 0);
    const totalViews = allStats.reduce((sum, s) => sum + s.totalViews, 0);
    const followerGrowth = totalFollowers > 0
      ? allStats.reduce((sum, s) => sum + s.followerGrowthPct30d * s.followers, 0) / totalFollowers
      : 0;
    const viewGrowth = totalViews > 0
      ? allStats.reduce((sum, s) => sum + s.viewGrowthPct30d * s.totalViews, 0) / totalViews
      : 0;
    const mostRecent = allStats.reduce((latest, s) =>
      s.lastUpdated > latest ? s.lastUpdated : latest, allStats[0].lastUpdated);

    return {
      countryId,
      platform,
      accountCount: connections.length,
      followers: totalFollowers,
      totalViews,
      followerGrowthPct30d: Math.round(followerGrowth * 10) / 10,
      viewGrowthPct30d: Math.round(viewGrowth * 10) / 10,
      lastUpdated: mostRecent,
      status: "Updated",
    };
  },

  getAggregatedStatsForCountry: (countryId) => {
    return ALL_PLATFORMS
      .map(p => get().getAggregatedStats(countryId, p))
      .filter(s => s.accountCount > 0);
  },

  getAuditLog: (filters) => {
    let log = get().auditLog;
    if (filters?.countryId) log = log.filter(e => e.countryId === filters.countryId);
    if (filters?.platform) log = log.filter(e => e.platform === filters.platform);
    return log;
  },

  // ─── Derived ───

  filteredCountries: () => {
    const { countries, searchQuery, continentFilter } = get();
    let filtered = countries.filter(c => c.activePlatforms.length > 0);
    if (continentFilter !== "All") {
      filtered = filtered.filter(c => c.region === continentFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(c =>
        c.name.toLowerCase().includes(q) || c.region.toLowerCase().includes(q)
      );
    }
    return filtered;
  },

  getCountryById: (id) => get().countries.find(c => c.id === id),

  totalFollowersAll: () => get().countries.reduce((sum, c) => sum + c.totalFollowers, 0),
}));
