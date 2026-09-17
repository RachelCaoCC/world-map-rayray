import { useDashboardStore } from "../../store/useStore";

export function StatsBand() {
  const countries = useDashboardStore((s) => s.countries);
  const totalFollowersAll = useDashboardStore((s) => s.totalFollowersAll);

  const totalFollowers = totalFollowersAll();
  const activeCount = countries.length;
  const lastSync = countries.reduce((latest, c) =>
    c.lastUpdated > latest ? c.lastUpdated : latest, countries[0]?.lastUpdated ?? ""
  );

  const formatFollowers = (n: number) =>
    n >= 1_000_000 ? `${(n / 1_000_000).toFixed(2)}M` : n >= 1_000 ? `${(n / 1_000).toFixed(0)}K` : n.toString();

  const formatTimestamp = (iso: string) => {
    try {
      const d = new Date(iso);
      return d.toLocaleDateString("en-US", {
        day: "numeric", month: "short", year: "numeric",
      }) + ", " + d.toLocaleTimeString("en-US", {
        hour: "2-digit", minute: "2-digit", hour12: false,
      }) + " (UTC+10)";
    } catch {
      return iso;
    }
  };

  const MapIcon = () => (
    <svg viewBox="0 0 24 24" className="w-5 h-5 text-accent" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 3 3 5v16l6-2 6 2 6-2V3l-6 2-6-2Z" />
      <path d="M9 3v16M15 5v16" />
    </svg>
  );
  const UsersIcon = () => (
    <svg viewBox="0 0 24 24" className="w-5 h-5 text-accent" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
  const SyncIcon = () => (
    <svg viewBox="0 0 24 24" className="w-5 h-5 text-accent" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12a9 9 0 0 1-9 9 9 9 0 0 1-6.7-3M3 12a9 9 0 0 1 9-9 9 9 0 0 1 6.7 3" />
      <path d="M21 3v6h-6M3 21v-6h6" />
    </svg>
  );

  const stats = [
    { label: "Active Countries/Regions", value: `${activeCount} countries`, icon: <MapIcon /> },
    { label: "Total Followers", value: `${formatFollowers(totalFollowers)} across all markets`, icon: <UsersIcon /> },
    { label: "Last Sync", value: formatTimestamp(lastSync), icon: <SyncIcon /> },
  ];

  return (
    <div className="grid grid-cols-3 gap-4 p-4">
      {stats.map((stat) => (
        <div key={stat.label} className="bg-white rounded-xl p-4 shadow-sm border border-slate-100">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-lg flex items-center">{stat.icon}</span>
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">{stat.label}</span>
          </div>
          <p className="text-sm font-semibold text-slate-800">{stat.value}</p>
        </div>
      ))}
    </div>
  );
}
