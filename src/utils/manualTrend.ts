import type { PlatformKey, TrendPoint } from "../types";
import { getManualSnapshots, manualSnapshotKey } from "../data/manualSnapshots";
import type { ManualAccountSnapshot } from "../data/manualSnapshots";

export interface ManualHistoryRow {
  country_id: string;
  platform: string;
  account_name: string;
  followers: number;
  total_views: number;
  captured_at: string;
}

/**
 * Reconstruct daily snapshots using last-known-value carry-forward per account.
 * Never chart hand-entered data on a platform that has an active API connection.
 */
export function buildManualPlatformHistory(
  countryId: string,
  active: ManualAccountSnapshot[],
  historyRows: ManualHistoryRow[],
  automatedPlatforms: Set<string>,
): TrendPoint[] {
  const activeKeys = new Set(active.map(manualSnapshotKey));
  const eventsByKeyDate = new Map<string, {
    key: string; date: string; platform: PlatformKey;
    followers: number; views: number;
  }>();

  // Historical figures shipped with the project are a genuine snapshot baseline,
  // but only for accounts that have not been hidden.
  for (const snapshot of getManualSnapshots(countryId)) {
    if (snapshot.platform === "x" || automatedPlatforms.has(snapshot.platform)) continue;
    const key = manualSnapshotKey(snapshot);
    if (!activeKeys.has(key)) continue;
    const date = snapshot.capturedAt.slice(0, 10);
    eventsByKeyDate.set(key + "@" + date, {
      key, date, platform: snapshot.platform,
      followers: snapshot.followers,
      views: snapshot.totalViews ?? 0,
    });
  }
  // Saved history supersedes the matching baseline on the same day.
  for (const row of historyRows) {
    const platform = row.platform as PlatformKey;
    if (row.country_id !== countryId || platform === ("x" as PlatformKey) || automatedPlatforms.has(platform)) continue;
    const key = manualSnapshotKey({ countryId, platform, accountName: row.account_name });
    if (!activeKeys.has(key)) continue;
    const date = row.captured_at.slice(0, 10);
    eventsByKeyDate.set(key + "@" + date, {
      key, date, platform,
      followers: Number(row.followers ?? 0),
      views: Number(row.total_views ?? 0),
    });
  }

  const events = [...eventsByKeyDate.values()].sort((a, b) =>
    a.date.localeCompare(b.date) || a.key.localeCompare(b.key));
  const current = new Map<string, typeof events[number]>();
  const result: TrendPoint[] = [];
  let index = 0;
  while (index < events.length) {
    const date = events[index].date;
    while (index < events.length && events[index].date === date) {
      current.set(events[index].key, events[index]);
      index++;
    }
    const sum = new Map<PlatformKey, { followers: number; views: number }>();
    for (const value of current.values()) {
      const existing = sum.get(value.platform) ?? { followers: 0, views: 0 };
      existing.followers += value.followers;
      existing.views += value.views;
      sum.set(value.platform, existing);
    }
    const point: TrendPoint = { date };
    for (const [platform, values] of sum) {
      if (platform === "facebook") point.facebook = values;
      if (platform === "instagram") point.instagram = values;
      if (platform === "youtube") point.youtube = values;
      if (platform === "tiktok") point.tiktok = values;
    }
    result.push(point);
  }
  return result;
}
