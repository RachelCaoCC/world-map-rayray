import type { CountryPlatformStats, PlatformKey } from "../../types";
import { PLATFORM_INFO, getProfileUrl } from "../../data/mockData";
import { useDashboardStore } from "../../store/useStore";

interface ComparisonTableProps {
  stats: CountryPlatformStats[];
}

export function ComparisonTable({ stats }: ComparisonTableProps) {
  const getConnectionsForCountryPlatform = useDashboardStore((s) => s.getConnectionsForCountryPlatform);

  const formatNum = (n: number) =>
    n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1_000 ? `${(n / 1_000).toFixed(0)}K` : n.toString();

  const formatChange = (value: number) => `${value >= 0 ? "+" : ""}${value}%`;
  const changeColor = (value: number) => value >= 0 ? "text-positive" : "text-red-500";

  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleDateString("en-US", {
        day: "numeric", month: "short", year: "numeric",
      });
    } catch { return iso; }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100">
        <h3 className="text-sm font-semibold text-slate-800">Platform Comparison</h3>
      </div>
      <div className="overflow-x-auto overscroll-x-contain">
        <table className="w-full min-w-[880px] text-sm">
          <thead>
            <tr className="bg-slate-50 text-xs text-slate-500 uppercase tracking-wide">
              <th className="text-left px-4 py-2.5">Platform</th>
              <th className="text-left px-4 py-2.5">Account Name</th>
              <th className="text-right px-4 py-2.5">Followers</th>
              <th className="text-right px-4 py-2.5">Views / Published Content</th>
              <th className="text-right px-4 py-2.5">Follower Growth (7D)</th>
              <th className="text-right px-4 py-2.5">Metric Growth (7D)</th>
              <th className="text-right px-4 py-2.5">Last Updated</th>
              <th className="text-center px-4 py-2.5">Status</th>
            </tr>
          </thead>
          <tbody>
            {stats.map((stat) => {
              const info = PLATFORM_INFO[stat.platform as PlatformKey];
              const connections = getConnectionsForCountryPlatform(stat.countryId, stat.platform as PlatformKey);

              return (
                <tr key={stat.platform} className="border-t border-slate-50 hover:bg-slate-50/50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded overflow-hidden flex items-center justify-center">
                        <img src={info.logo} alt={info.name} className="w-full h-full object-contain" />
                      </div>
                      <span className="font-medium text-slate-800">{info.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {connections.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {connections.map((c) => {
                          const url = getProfileUrl(stat.platform as PlatformKey, c.externalAccountId, c.accountName, c.username, c.profileUrl);
                          return url ? (
                            <a
                              key={c.id}
                              href={url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-accent hover:underline"
                            >
                              {c.accountName}
                            </a>
                          ) : (
                            <span key={c.id}>{c.accountName}</span>
                          );
                        })}
                      </div>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-slate-800">{formatNum(stat.followers)}</td>
                  <td className="px-4 py-3 text-right font-medium text-slate-800">{formatNum(stat.totalViews)}</td>
                  <td className="px-4 py-3 text-right">
                    <span className={`${changeColor(stat.followerGrowthPct30d)} font-medium`}>{formatChange(stat.followerGrowthPct30d)}</span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className={`${changeColor(stat.viewGrowthPct30d)} font-medium`}>{formatChange(stat.viewGrowthPct30d)}</span>
                  </td>
                  <td className="px-4 py-3 text-right text-xs text-slate-500">{formatDate(stat.lastUpdated)}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full font-medium ${
                      stat.status === "Updated"
                        ? "bg-positive/10 text-positive"
                        : "bg-slate-100 text-slate-500"
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${
                        stat.status === "Updated" ? "bg-positive" : "bg-slate-400"
                      }`} />
                      {stat.status}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
