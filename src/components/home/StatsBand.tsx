import { useDashboardStore } from "../../store/useStore";

const formatNumber = (n: number) =>
  n >= 1_000_000
    ? `${(n / 1_000_000).toFixed(2)}M`
    : n >= 1_000
      ? n.toLocaleString("en-US")
      : n.toString();

const formatTimestamp = (iso: string) => {
  if (!iso) return "Waiting for sync";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;

  return (
    date.toLocaleDateString("en-US", {
      day: "numeric",
      month: "short",
      year: "numeric",
    }) +
    ", " +
    date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    })
  );
};

function EyeIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function UsersIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
    </svg>
  );
}

function GlobeIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2}>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18" />
    </svg>
  );
}

function SyncIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M21 12a9 9 0 0 1-15.7 6M3 12a9 9 0 0 1 15.7-6" />
      <path d="M21 3v6h-6M3 21v-6h6" />
    </svg>
  );
}

export function StatsBand() {
  const countries = useDashboardStore((state) => state.countries);
  const accountStats = useDashboardStore((state) => state.accountStats);
  const platformConnections = useDashboardStore((state) => state.platformConnections);
  const totalFollowersAll = useDashboardStore((state) => state.totalFollowersAll);

  const totalFollowers = totalFollowersAll();
  const viewConnectionIds = new Set(
    platformConnections
      .filter((connection) => connection.platform === "youtube" || connection.platform === "tiktok")
      .map((connection) => connection.id),
  );
  const totalViews = Array.from(accountStats.entries()).reduce(
    (sum, [connectionId, stats]) =>
      sum + (viewConnectionIds.has(connectionId) ? stats.totalViews : 0),
    0,
  );
  const marketsTracked = countries.filter(
    (country) => country.activePlatforms.length > 0,
  ).length;
  const lastSync = countries.reduce(
    (latest, country) =>
      country.lastUpdated > latest ? country.lastUpdated : latest,
    countries[0]?.lastUpdated ?? "",
  );

  const rows = [
    {
      label: "Total Views",
      value: formatNumber(totalViews),
      icon: <EyeIcon />,
      iconClass: "bg-blue-50 text-blue-500",
    },
    {
      label: "Total Followers",
      value: formatNumber(totalFollowers),
      icon: <UsersIcon />,
      iconClass: "bg-violet-50 text-violet-500",
    },
    {
      label: "Markets Tracked",
      value: marketsTracked.toString(),
      icon: <GlobeIcon />,
      iconClass: "bg-slate-100 text-slate-500",
    },
    {
      label: "Last Sync",
      value: formatTimestamp(lastSync),
      icon: <SyncIcon />,
      iconClass: "bg-emerald-50 text-emerald-500",
    },
  ];

  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white/95 shadow-lg backdrop-blur-sm">
      <header className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
        <h2 className="text-sm font-semibold text-slate-800">Real-time Overview</h2>
        <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-600">
          <span className="h-2 w-2 rounded-full bg-emerald-400" />
          Live
        </span>
      </header>

      <div className="divide-y divide-slate-100">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center gap-3 px-4 py-3">
            <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${row.iconClass}`}>
              {row.icon}
            </span>
            <div className="min-w-0">
              <p className="text-xs text-slate-500">{row.label}</p>
              <p className="truncate text-base font-bold text-slate-800">{row.value}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
