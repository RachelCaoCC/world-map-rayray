import type { PlatformKey, Region } from "../types";

export type ManualPlatformKey = PlatformKey | "x";

export interface ManualAccountSnapshot {
  countryId: string;
  countryName: string;
  region: Region;
  platform: ManualPlatformKey;
  accountName: string;
  followers: number;
  hasTrend: boolean;
  capturedAt: string;
}

/**
 * User-provided follower snapshots. They are fallback data only:
 * a connected API account for the same country + platform always wins.
 */
export const MANUAL_ACCOUNT_SNAPSHOTS: ManualAccountSnapshot[] = [
  { countryId: "th", countryName: "Thailand", region: "Asia", platform: "instagram", accountName: "iflytek.thailand", followers: 3910, hasTrend: true, capturedAt: "2026-09-17" },
  { countryId: "th", countryName: "Thailand", region: "Asia", platform: "facebook", accountName: "IFlytek Thailand", followers: 3034, hasTrend: true, capturedAt: "2026-09-17" },
  { countryId: "th", countryName: "Thailand", region: "Asia", platform: "tiktok", accountName: "iFLYTEK Thailand Store", followers: 1786, hasTrend: false, capturedAt: "2026-09-17" },

  { countryId: "my", countryName: "Malaysia", region: "Asia", platform: "instagram", accountName: "iflytek.malaysia", followers: 1366, hasTrend: false, capturedAt: "2026-09-17" },
  { countryId: "my", countryName: "Malaysia", region: "Asia", platform: "facebook", accountName: "iFLYTEK Malaysia", followers: 3874, hasTrend: false, capturedAt: "2026-09-17" },

  { countryId: "kr", countryName: "South Korea", region: "Asia", platform: "instagram", accountName: "iflytek.korea", followers: 3121, hasTrend: true, capturedAt: "2026-09-17" },
  { countryId: "kr", countryName: "South Korea", region: "Asia", platform: "youtube", accountName: "iflytek 아이플라이텍", followers: 392, hasTrend: true, capturedAt: "2026-09-17" },
  { countryId: "kr", countryName: "South Korea", region: "Asia", platform: "facebook", accountName: "아이플라이텍 코리아", followers: 3, hasTrend: true, capturedAt: "2026-09-17" },
  { countryId: "kr", countryName: "South Korea", region: "Asia", platform: "tiktok", accountName: "아이플라이텍코리아-iflytekkorea", followers: 0, hasTrend: true, capturedAt: "2026-09-17" },

  { countryId: "us", countryName: "United States", region: "North America", platform: "instagram", accountName: "iflytekusa", followers: 972, hasTrend: true, capturedAt: "2026-09-17" },
  { countryId: "us", countryName: "United States", region: "North America", platform: "youtube", accountName: "iFLYTEKUSA", followers: 254, hasTrend: true, capturedAt: "2026-09-17" },
  { countryId: "us", countryName: "United States", region: "North America", platform: "facebook", accountName: "iFLYTEK USA", followers: 1703, hasTrend: true, capturedAt: "2026-09-17" },
  { countryId: "us", countryName: "United States", region: "North America", platform: "x", accountName: "iFLYTEK USA", followers: 167, hasTrend: true, capturedAt: "2026-09-17" },

  { countryId: "tw", countryName: "Taiwan", region: "Asia", platform: "facebook", accountName: "iFLYTEK Taiwan", followers: 1950, hasTrend: false, capturedAt: "2026-09-17" },
  { countryId: "tw", countryName: "Taiwan", region: "Asia", platform: "instagram", accountName: "iflytek_taiwan", followers: 574, hasTrend: false, capturedAt: "2026-09-17" },

  { countryId: "sg", countryName: "Singapore", region: "Asia", platform: "instagram", accountName: "iflytek.singapore", followers: 363, hasTrend: false, capturedAt: "2026-09-17" },
  { countryId: "sg", countryName: "Singapore", region: "Asia", platform: "facebook", accountName: "IFlytek Singapore", followers: 125, hasTrend: false, capturedAt: "2026-09-17" },
];

export function getManualSnapshots(countryId: string, platform?: ManualPlatformKey) {
  return MANUAL_ACCOUNT_SNAPSHOTS.filter(
    (snapshot) => snapshot.countryId === countryId && (!platform || snapshot.platform === platform),
  );
}

export function getManualSupportedPlatforms(countryId: string): PlatformKey[] {
  const supported = new Set<PlatformKey>();
  for (const snapshot of getManualSnapshots(countryId)) {
    if (snapshot.platform !== "x") supported.add(snapshot.platform);
  }
  return [...supported];
}
