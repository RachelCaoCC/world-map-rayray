import type { AccountStats, Country, PlatformConnection } from "../types";
import { MANUAL_ACCOUNT_SNAPSHOTS } from "../data/manualSnapshots";

function csvCell(value: string | number) {
  const text = String(value ?? "");
  return `"${text.replaceAll('"', '""')}"`;
}

export function downloadGlobalReport(
  countries: Country[],
  connections: PlatformConnection[],
  stats: Map<string, AccountStats>,
) {
  const countryById = new Map(countries.map((country) => [country.id, country]));
  const connected = connections.filter((connection) => connection.status === "connected");
  const connectedKeys = new Set(connected.map((connection) => `${connection.countryId}:${connection.platform}`));

  const rows: Array<Array<string | number>> = [];

  for (const connection of connected) {
    const country = countryById.get(connection.countryId);
    const accountStat = stats.get(connection.id);
    rows.push([
      country?.name ?? connection.countryId.toUpperCase(),
      country?.region ?? "",
      connection.platform,
      connection.accountName,
      accountStat?.followers ?? 0,
      accountStat?.totalViews ?? 0,
      "API connected",
      connection.lastSyncedAt || accountStat?.lastUpdated || "",
    ]);
  }

  for (const snapshot of MANUAL_ACCOUNT_SNAPSHOTS) {
    if (connectedKeys.has(`${snapshot.countryId}:${snapshot.platform}`)) continue;
    rows.push([
      snapshot.countryName,
      snapshot.region,
      snapshot.platform,
      snapshot.accountName,
      snapshot.followers,
      "",
      "Manual snapshot",
      snapshot.capturedAt,
    ]);
  }

  rows.sort((a, b) =>
    String(a[0]).localeCompare(String(b[0])) || String(a[2]).localeCompare(String(b[2])),
  );

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

  const csv = [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\n");
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
