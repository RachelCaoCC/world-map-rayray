import { useNavigate } from "react-router-dom";
import type { CountryPlatformStats, PlatformKey } from "../../types";
import { PLATFORM_INFO, getProfileUrl } from "../../data/mockData";
import { useDashboardStore } from "../../store/useStore";

interface PlatformCardsProps {
  stats: CountryPlatformStats[];
  countryId: string;
}

export function PlatformCards({ stats, countryId }: PlatformCardsProps) {
  const navigate = useNavigate();
  const getConnectionsForCountryPlatform = useDashboardStore((s) => s.getConnectionsForCountryPlatform);

  const formatNum = (n: number) =>
    n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1_000 ? `${(n / 1_000).toFixed(0)}K` : n.toString();

  const formatChange = (value: number) => `${value >= 0 ? "+" : ""}${value}%`;
  const changeColor = (value: number) => value >= 0 ? "text-positive" : "text-red-500";

  return (
    <div className="grid grid-cols-4 gap-4 mb-6">
      {stats.map((stat) => {
        const info = PLATFORM_INFO[stat.platform as PlatformKey];
        const connections = getConnectionsForCountryPlatform(countryId, stat.platform as PlatformKey);
        const primaryConn = connections[0];
        const profileUrl = primaryConn
          ? getProfileUrl(stat.platform as PlatformKey, primaryConn.externalAccountId, primaryConn.accountName, primaryConn.username, primaryConn.profileUrl)
          : null;

        return (
          <div
            key={stat.platform}
            className="relative bg-white rounded-xl p-4 shadow-sm border border-slate-100 text-left hover:shadow-md hover:border-slate-200 transition-all group cursor-pointer"
            onClick={() => navigate(`/country/${countryId}/present?platform=${stat.platform}`)}
          >
            {/* External link button */}
            {profileUrl && (
              <a
                href={profileUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="absolute top-3 right-3 w-6 h-6 flex items-center justify-center rounded-md text-slate-400 hover:text-accent hover:bg-slate-100 transition-colors opacity-0 group-hover:opacity-100"
                title="Open profile"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
            )}

            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-lg overflow-hidden flex items-center justify-center">
                <img src={info.logo} alt={info.name} className="w-full h-full object-contain" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-800">{info.name}</p>
                {primaryConn ? (
                  <span className="text-xs text-slate-500 truncate max-w-[120px] block">
                    {primaryConn.accountName}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-xs text-positive">
                    <span className="w-1.5 h-1.5 rounded-full bg-positive" />
                    Connected
                  </span>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <div>
                <p className="text-xs text-slate-500">Followers / Subscribers</p>
                <div className="flex items-baseline gap-1">
                  <p className="text-lg font-bold text-slate-800">{formatNum(stat.followers)}</p>
                  <span className={`text-xs font-medium ${changeColor(stat.followerGrowthPct30d)}`}>{formatChange(stat.followerGrowthPct30d)}</span>
                </div>
              </div>
              <div>
                <p className="text-xs text-slate-500">Total Views</p>
                <div className="flex items-baseline gap-1">
                  <p className="text-lg font-bold text-slate-800">{formatNum(stat.totalViews)}</p>
                  <span className={`text-xs font-medium ${changeColor(stat.viewGrowthPct30d)}`}>{formatChange(stat.viewGrowthPct30d)}</span>
                </div>
              </div>
              <p className="text-[11px] text-slate-400">vs. previous 7 days</p>
            </div>

            <div className="mt-3 text-xs text-accent font-medium opacity-0 group-hover:opacity-100 transition-opacity">
              View Presentation →
            </div>
          </div>
        );
      })}
    </div>
  );
}
