import type { AccountStats, Country, PlatformConnection } from "../types";
import { MANUAL_ACCOUNT_SNAPSHOTS, type ManualPlatformKey } from "../data/manualSnapshots";

export type ReportDataSource = "API Connected" | "Manual Snapshot";

export interface GlobalReportRow {
  countryId: string;
  countryName: string;
  region: string;
  platform: ManualPlatformKey;
  accountName: string;
  followers: number;
  secondaryMetric: number | null;
  source: ReportDataSource;
  lastUpdated: string;
}

function csvCell(value: string | number | null) {
  const text = String(value ?? "");
  return `"${text.replaceAll('"', '""')}"`;
}

export function buildGlobalReportRows(
  countries: Country[],
  connections: PlatformConnection[],
  stats: Map<string, AccountStats>,
): GlobalReportRow[] {
  const countryById = new Map(countries.map((country) => [country.id, country]));
  const connected = connections.filter((connection) => connection.status === "connected");
  const connectedKeys = new Set(connected.map((connection) => `${connection.countryId}:${connection.platform}`));

  const rows: GlobalReportRow[] = connected.map((connection) => {
    const country = countryById.get(connection.countryId);
    const accountStat = stats.get(connection.id);
    return {
      countryId: connection.countryId,
      countryName: country?.name ?? connection.countryId.toUpperCase(),
      region: country?.region ?? "",
      platform: connection.platform,
      accountName: connection.accountName,
      followers: accountStat?.followers ?? 0,
      secondaryMetric: accountStat?.totalViews ?? 0,
      source: "API Connected",
      lastUpdated: connection.lastSyncedAt || accountStat?.lastUpdated || "",
    };
  });

  for (const snapshot of MANUAL_ACCOUNT_SNAPSHOTS) {
    if (connectedKeys.has(`${snapshot.countryId}:${snapshot.platform}`)) continue;
    rows.push({
      countryId: snapshot.countryId,
      countryName: snapshot.countryName,
      region: snapshot.region,
      platform: snapshot.platform,
      accountName: snapshot.accountName,
      followers: snapshot.followers,
      secondaryMetric: null,
      source: "Manual Snapshot",
      lastUpdated: snapshot.capturedAt,
    });
  }

  return rows.sort((a, b) =>
    a.countryName.localeCompare(b.countryName) || a.platform.localeCompare(b.platform),
  );
}

export function downloadGlobalReport(
  countries: Country[],
  connections: PlatformConnection[],
  stats: Map<string, AccountStats>,
) {
  const rows = buildGlobalReportRows(countries, connections, stats);
  const header = [
    "Country / Region",
    "Continent",
    "Platform",
    "Account",
    "Followers / Subscribers",
    "Views / Secondary Metric",
    "Data Source",
    "Last Updated",
  ];

  const csvRows = rows.map((row) => [
    row.countryName,
    row.region,
    row.platform,
    row.accountName,
    row.followers,
    row.secondaryMetric,
    row.source,
    row.lastUpdated,
  ]);
  const csv = [header, ...csvRows].map((row) => row.map(csvCell).join(",")).join("\n");
  const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `global-social-media-report-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
