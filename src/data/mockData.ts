import type { Country, TrendPoint, PlatformKey, AvailableAccount, AccountStats, PlatformConnection } from "../types";
import facebookIcon from "../assets/icons8-facebook-100.svg";
import instagramIcon from "../assets/icons8-instagram-100.svg";
import youtubeIcon from "../assets/icons8-youtube-100.svg";
import tiktokIcon from "../assets/icons8-tiktok-100.svg";

// Platform display info
export const PLATFORM_INFO: Record<PlatformKey, { name: string; color: string; logo: string }> = {
  facebook: { name: "Facebook", color: "#1877F2", logo: facebookIcon },
  instagram: { name: "Instagram", color: "#E4405F", logo: instagramIcon },
  youtube: { name: "YouTube", color: "#FF0000", logo: youtubeIcon },
  tiktok: { name: "TikTok", color: "#000000", logo: tiktokIcon },
};

export const PLATFORM_COLORS: Record<PlatformKey, string> = {
  facebook: "#1877F2",
  instagram: "#E4405F",
  youtube: "#FF0000",
  tiktok: "#25F4EE",
};

// Build a profile URL for a connected account
export function getProfileUrl(platform: PlatformKey, externalAccountId: string, accountName: string, username?: string, profileUrl?: string): string | null {
  // Prefer stored profile URL from platform API
  if (profileUrl) return profileUrl;

  const handle = username?.replace(/^@/, "") ?? accountName.toLowerCase().replace(/[^a-z0-9._]/g, "");
  switch (platform) {
    case "facebook":
      return `https://facebook.com/${externalAccountId}`;
    case "instagram":
      return `https://www.instagram.com/${handle}`;
    case "youtube":
      return `https://youtube.com/channel/${externalAccountId}`;
    case "tiktok":
      return null;
    default:
      return null;
  }
}

export const mockCountries: Country[] = [
  {
    id: "us", name: "United States", region: "North America",
    flagCode: "us", totalFollowers: 2_450_000, activePlatforms: ["facebook", "instagram", "youtube", "tiktok"],
    lastUpdated: "2026-07-20T08:30:00+10:00", lat: 39.8, lng: -98.5,
  },
  {
    id: "cn", name: "China", region: "Asia",
    flagCode: "cn", totalFollowers: 1_870_000, activePlatforms: ["facebook", "instagram", "youtube"],
    lastUpdated: "2026-07-20T07:15:00+08:00", lat: 35.8, lng: 104.2,
  },
  {
    id: "jp", name: "Japan", region: "Asia",
    flagCode: "jp", totalFollowers: 980_000, activePlatforms: ["instagram", "youtube", "tiktok"],
    lastUpdated: "2026-07-20T06:00:00+09:00", lat: 36.2, lng: 138.2,
  },
  {
    id: "kr", name: "South Korea", region: "Asia",
    flagCode: "kr", totalFollowers: 650_000, activePlatforms: ["instagram", "youtube", "tiktok"],
    lastUpdated: "2026-07-20T06:45:00+09:00", lat: 35.9, lng: 127.7,
  },
  {
    id: "gb", name: "United Kingdom", region: "Europe",
    flagCode: "gb", totalFollowers: 1_120_000, activePlatforms: ["facebook", "instagram", "youtube", "tiktok"],
    lastUpdated: "2026-07-20T01:00:00+01:00", lat: 55.3, lng: -3.4,
  },
  {
    id: "de", name: "Germany", region: "Europe",
    flagCode: "de", totalFollowers: 780_000, activePlatforms: ["facebook", "instagram", "youtube"],
    lastUpdated: "2026-07-20T02:15:00+02:00", lat: 51.1, lng: 10.4,
  },
  {
    id: "fr", name: "France", region: "Europe",
    flagCode: "fr", totalFollowers: 620_000, activePlatforms: ["instagram", "youtube", "tiktok"],
    lastUpdated: "2026-07-20T02:30:00+02:00", lat: 46.2, lng: 2.2,
  },
  {
    id: "au", name: "Australia", region: "Oceania",
    flagCode: "au", totalFollowers: 540_000, activePlatforms: ["facebook", "instagram", "youtube"],
    lastUpdated: "2026-07-20T08:30:00+10:00", lat: -25.2, lng: 133.7,
  },
  {
    id: "br", name: "Brazil", region: "South America",
    flagCode: "br", totalFollowers: 890_000, activePlatforms: ["facebook", "instagram", "youtube", "tiktok"],
    lastUpdated: "2026-07-20T05:00:00-03:00", lat: -14.2, lng: -51.9,
  },
  {
    id: "in", name: "India", region: "Asia",
    flagCode: "in", totalFollowers: 1_340_000, activePlatforms: ["facebook", "instagram", "youtube", "tiktok"],
    lastUpdated: "2026-07-20T05:30:00+05:30", lat: 20.5, lng: 78.9,
  },
  {
    id: "sg", name: "Singapore", region: "Asia",
    flagCode: "sg", totalFollowers: 210_000, activePlatforms: ["instagram", "youtube", "tiktok"],
    lastUpdated: "2026-07-20T07:00:00+08:00", lat: 1.3, lng: 103.8,
  },
  {
    id: "mx", name: "Mexico", region: "North America",
    flagCode: "mx", totalFollowers: 430_000, activePlatforms: ["facebook", "instagram", "tiktok"],
    lastUpdated: "2026-07-20T04:00:00-06:00", lat: 23.6, lng: -102.5,
  },
  {
    id: "id", name: "Indonesia", region: "Asia",
    flagCode: "id", totalFollowers: 720_000, activePlatforms: ["facebook", "instagram", "youtube", "tiktok"],
    lastUpdated: "2026-07-20T07:30:00+07:00", lat: -0.8, lng: 113.9,
  },
  {
    id: "th", name: "Thailand", region: "Asia",
    flagCode: "th", totalFollowers: 380_000, activePlatforms: ["facebook", "instagram", "tiktok"],
    lastUpdated: "2026-07-20T07:00:00+07:00", lat: 15.8, lng: 101.0,
  },
  {
    id: "ca", name: "Canada", region: "North America",
    flagCode: "ca", totalFollowers: 410_000, activePlatforms: ["facebook", "instagram", "youtube"],
    lastUpdated: "2026-07-20T04:30:00-04:00", lat: 56.1, lng: -106.3,
  },
];

// ─── Mock available accounts (Step 4 of wizard — what the OAuth'd user can pick) ───

export function mockAvailableAccounts(platform: PlatformKey, countryId: string): AvailableAccount[] {
  const country = mockCountries.find(c => c.id === countryId);
  const name = country?.name ?? countryId;

  const accounts: Record<PlatformKey, AvailableAccount[]> = {
    facebook: [
      { id: `fb_page_${countryId}_1`, name: `Facebook ${name}`, type: "Facebook Page", metadata: "245K followers" },
      { id: `fb_page_${countryId}_2`, name: `Products ${name} Products`, type: "Facebook Page", metadata: "89K followers" },
      { id: `fb_page_${countryId}_3`, name: `Careers ${name}`, type: "Facebook Page", metadata: "12K followers" },
    ],
    instagram: [
      { id: `ig_${countryId}_1`, name: `Instagram.${countryId}`, type: "Instagram Business", metadata: "198K followers" },
      { id: `ig_${countryId}_2`, name: `Instagram Business.${countryId}`, type: "Instagram Business", metadata: "67K followers" },
    ],
    youtube: [
      { id: `yt_${countryId}_1`, name: `Youtube ${name} Official`, type: "YouTube Channel", metadata: "156K subscribers" },
      { id: `yt_${countryId}_2`, name: `Youtube ${name} Shorts`, type: "YouTube Channel", metadata: "43K subscribers" },
    ],
    tiktok: [
      { id: `tt_${countryId}_1`, name: `Tiktok@business.${countryId}`, type: "TikTok Business Account", metadata: "312K followers" },
      { id: `tt_${countryId}_2`, name: `Tiktok@products.${countryId}`, type: "TikTok Business Account", metadata: "78K followers" },
    ],
  };

  return accounts[platform];
}

// ─── Mock per-account stats generation ───

export function mockAccountStats(connection: PlatformConnection): AccountStats {
  // Simulate different follower counts based on connection id hash
  const hash = connection.id.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  const baseFollowers = 50000 + (hash % 400000);
  const baseViews = baseFollowers * (8 + (hash % 20));
  const growthBase = 1 + (hash % 8);

  return {
    connectionId: connection.id,
    followers: baseFollowers + Math.round(Math.random() * 5000),
    totalViews: baseViews + Math.round(Math.random() * 20000),
    followerGrowthPct30d: Math.round((growthBase + Math.random() * 4) * 10) / 10,
    viewGrowthPct30d: Math.round((growthBase * 0.8 + Math.random() * 6) * 10) / 10,
    lastUpdated: connection.lastSyncedAt || new Date().toISOString(),
  };
}

// ─── Mock initial connections (seed data) ───

let connCounter = 0;
function makeConnId() {
  return `conn_${Date.now().toString(36)}_${(++connCounter).toString(36)}`;
}

export function seedInitialConnections(): { connections: PlatformConnection[]; stats: Map<string, AccountStats> } {
  const connections: PlatformConnection[] = [];
  const stats = new Map<string, AccountStats>();

  for (const country of mockCountries) {
    for (const platform of country.activePlatforms) {
      const accounts = mockAvailableAccounts(platform, country.id);
      // Connect the first account for each active platform
      const account = accounts[0];
      const connId = makeConnId();
      const conn: PlatformConnection = {
        id: connId,
        countryId: country.id,
        platform,
        externalAccountId: account.id,
        accountName: account.name,
        status: "connected",
        accessToken: `mock_${platform}_at_init`,
        refreshToken: `mock_${platform}_rt_init`,
        tokenExpiresAt: undefined,
        lastSyncedAt: country.lastUpdated,
        connectedBy: "admin_001",
        connectedAt: "2026-06-01T00:00:00Z",
      };
      connections.push(conn);
      stats.set(connId, mockAccountStats(conn));
    }
  }

  return { connections, stats };
}

// ─── Trend data (unchanged) ───

export function mockTrendData(countryId: string, days: number = 90): TrendPoint[] {
  const country = mockCountries.find(c => c.id === countryId);
  if (!country) return [];

  const points: TrendPoint[] = [];
  const now = new Date();

  const bases: Partial<Record<PlatformKey, number>> = {};
  if (country.activePlatforms.includes("facebook")) bases.facebook = country.totalFollowers * 0.32;
  if (country.activePlatforms.includes("instagram")) bases.instagram = country.totalFollowers * 0.25;
  if (country.activePlatforms.includes("youtube")) bases.youtube = country.totalFollowers * 0.20;
  if (country.activePlatforms.includes("tiktok")) bases.tiktok = country.totalFollowers * 0.13;

  for (let i = days; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().slice(0, 10);

    const point: TrendPoint = { date: dateStr };
    for (const [platform, base] of Object.entries(bases) as [PlatformKey, number][]) {
      const dayFactor = (days - i) / days;
      const growthRate = platform === "tiktok" ? 0.0015 : platform === "youtube" ? 0.0008 : 0.0004;
      const followers = Math.round(base * (1 + dayFactor * growthRate * days) + (Math.random() - 0.5) * base * 0.002);
      const views = Math.round(followers * (2 + Math.random() * 3));
      point[platform] = { followers, views };
    }
    points.push(point);
  }
  return points;
}

// Simulate live increment for polling — Australia is the demo "live" market
// so the presentation counter and global stats visibly update.
export function simulateLiveUpdate(countries: Country[]): Country[] {
  return countries.map(c => {
    if (c.id !== "au") return c;
    return {
      ...c,
      totalFollowers: c.totalFollowers + Math.round(Math.random() * 50 + 10),
      lastUpdated: new Date().toISOString(),
    };
  });
}
