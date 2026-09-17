export type PlatformKey = "facebook" | "instagram" | "youtube" | "tiktok";

export type Region = "Asia" | "Europe" | "North America" | "South America" | "Oceania" | "Africa";

export interface Country {
  id: string;
  name: string;
  region: Region;
  flagCode: string;
  totalFollowers: number;
  activePlatforms: PlatformKey[];
  lastUpdated: string;
  lat: number;
  lng: number;
}

export interface TrendPoint {
  date: string;
  facebook?: { followers: number; views: number };
  instagram?: { followers: number; views: number };
  youtube?: { followers: number; views: number };
  tiktok?: { followers: number; views: number };
}

export type ContinentFilter = "All" | Region;

// ─── Part 4: Multi-account connection model ───

export type ConnectionStatus = "connected" | "token_expired" | "error";

// One OAuth'd account — e.g. one Facebook Page, one YouTube Channel
// Multiple PlatformConnections can share (countryId, platform)
export interface PlatformConnection {
  id: string;                // unique connection id
  countryId: string;
  platform: PlatformKey;
  externalAccountId: string; // Page ID / Channel ID / TikTok business account ID
  accountName: string;       // display name from the platform (e.g. "iFLYTEK Australia")
  username?: string;         // handle/username (e.g. "@iflytek" on TikTok)
  profileUrl?: string;       // direct profile URL from platform
  status: ConnectionStatus;
  accessToken: string;       // server-side only in real app
  refreshToken?: string;
  tokenExpiresAt?: string;
  lastSyncedAt: string;
  connectedBy: string;       // admin user id
  connectedAt: string;
}

// Per-account analytics — fetched from platform API for ONE connected account
export interface AccountStats {
  connectionId: string;      // links to PlatformConnection.id
  followers: number;
  totalViews: number;
  followerGrowthPct30d: number;
  viewGrowthPct30d: number;
  lastUpdated: string;
}

// Aggregated stats for a country × platform — computed from all connected accounts
export interface CountryPlatformStats {
  countryId: string;
  platform: PlatformKey;
  accountCount: number;
  followers: number;           // sum across accounts
  totalViews: number;          // sum across accounts
  followerGrowthPct30d: number; // weighted average
  viewGrowthPct30d: number;    // weighted average
  lastUpdated: string;         // most recent among accounts
  status: "Updated" | "Inactive";
}

// Accounts that the OAuth'd user can choose from (Step 4 of wizard)
export interface AvailableAccount {
  id: string;
  name: string;
  username?: string;
  profileUrl?: string;
  type: string;       // "Facebook Page" / "YouTube Channel" / "TikTok Account" etc.
  avatar?: string;
  metadata?: string;  // subscriber count, etc.
}

export interface AuditLogEntry {
  id: string;
  action: "connect" | "disconnect" | "reconnect" | "sync" | "account_update";
  actor: string;
  timestamp: string;
  countryId: string;
  platform: PlatformKey;
  details: string;
}
