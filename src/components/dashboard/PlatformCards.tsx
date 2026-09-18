import { useNavigate } from "react-router-dom";
import type { CountryPlatformStats, PlatformKey } from "../../types";
import { PLATFORM_INFO, getProfileUrl } from "../../data/mockData";
import { useDashboardStore } from "../../store/useStore";
import { getManualSnapshots } from "../../data/manualSnapshots";

interface PlatformCardsProps {
  stats: CountryPlatformStats[];
  countryId: string;
  periodDays: 7 | 30 | 90;
}

export function PlatformCards({ stats, countryId, periodDays }: PlatformCardsProps) {
  const navigate = useNavigate();
  const getConnectionsForCountryPlatform = useDashboardStore((state) => state.getConnectionsForCountryPlatform);

  const formatNum = (value: number) =>
    value >= 1_000_000 ? `${(value / 1_000_000).toFixed(1)}M` :
    value >= 1_000 ? `${(value / 1_000).toFixed(0)}K` :
    value.toString();

  const formatChange = (value: number) => `${value >= 0 ? "+" : ""}${value}%`;
  const changeColor = (value: number) => value >= 0 ? "text-positive" : "text-red-500";

  return (
    <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 lg:gap-4">
      {stats.map((stat) => {
        const info = PLATFORM_INFO[stat.platform as PlatformKey];
        const connections = getConnectionsForCountryPlatform(countryId, stat.platform as PlatformKey);
        const primaryConnection = connections[0];
        const manualSnapshots = primaryConnection ? [] : getManualSnapshots(countryId, stat.platform as PlatformKey);
        const isManual = manualSnapshots.length > 0;
        const manualAccountLabel = manualSnapshots.map((snapshot) => snapshot.accountName).join(", ");
        const secondaryLabel = stat.platform === "facebook"
          ? "Video Views"
          : stat.platform === "instagram"
            ? "Total Views"
            : stat.platform === "tiktok"
              ? "Total Likes"
              : "Total Views";
        const secondaryValue = formatNum(stat.totalViews);
        const profileUrl = primaryConnection
          ? getProfileUrl(
              stat.platform as PlatformKey,
              primaryConnection.externalAccountId,
              primaryConnection.accountName,
              primaryConnection.username,
              primaryConnection.profileUrl,
            )
          : null;

        return (
          <div
            key={stat.platform}
            className="relative bg-white rounded-xl p-4 shadow-sm border border-slate-100 text-left hover:shadow-md hover:border-slate-200 transition-all group cursor-pointer"
            onClick={() => navigate(`/country/${countryId}/present?platform=${stat.platform}`)}
          >
            {profileUrl && (
              <a
                href={profileUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(event) => event.stopPropagation()}
                className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-md text-slate-400 opacity-100 transition-colors hover:bg-slate-100 hover:text-accent sm:h-6 sm:w-6 sm:opacity-0 sm:group-hover:opacity-100"
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
                {primaryConnection ? (
                  <span className="text-xs text-slate-500 truncate max-w-[140px] block">
                    {primaryConnection.accountName}
                  </span>
                ) : isManual ? (
                  <span className="text-xs text-slate-500 truncate max-w-[140px] block" title={manualAccountLabel}>
                    {manualAccountLabel}
                  </span>
                ) : (
                  <span className="text-xs text-slate-400">No data</span>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <div>
                <p className="text-xs text-slate-500">Followers / Subscribers</p>
                <div className="flex items-baseline gap-1">
                  <p className="text-lg font-bold text-slate-800">{formatNum(stat.followers)}</p>
                  {!isManual && (
                    <span className={`text-xs font-medium ${changeColor(stat.followerGrowthPct30d)}`}>
                      {formatChange(stat.followerGrowthPct30d)}
                    </span>
                  )}
                </div>
              </div>
              {isManual ? (
                <div className="flex items-center justify-between pt-1">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2 py-1 text-[11px] font-medium text-amber-700">
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                    Manual snapshot
                  </span>
                  <span className="text-[11px] text-slate-400">{stat.lastUpdated}</span>
                </div>
              ) : (
                <>
                  <div>
                    <p className="text-xs text-slate-500">{secondaryLabel}</p>
                    <div className="flex items-baseline gap-1">
                      <p className="text-lg font-bold text-slate-800">{secondaryValue}</p>
                      <span className={`text-xs font-medium ${changeColor(stat.viewGrowthPct30d)}`}>
                        {formatChange(stat.viewGrowthPct30d)}
                      </span>
                    </div>
                  </div>
                  <p className="text-[11px] text-slate-400">vs. previous {periodDays} days</p>
                </>
              )}
            </div>

            <div className="mt-3 text-xs font-medium text-accent opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100">
              View Presentation →
            </div>
          </div>
        );
      })}
    </div>
  );
}
