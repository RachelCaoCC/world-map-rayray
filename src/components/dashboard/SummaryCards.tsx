import type { CountryPlatformStats } from "../../types";

interface SummaryCardsProps {
  stats: CountryPlatformStats[];
}

export function SummaryCards({ stats }: SummaryCardsProps) {
  const totalFollowers = stats.reduce((sum, s) => sum + s.followers, 0);
  const viewStats = stats.filter((s) => s.platform === "youtube" || s.platform === "tiktok");
  const totalViews = viewStats.reduce((sum, s) => sum + s.totalViews, 0);
  const activeCount = stats.filter(s => s.accountCount > 0).length;
  const lastUpdated = stats[0]?.lastUpdated ?? "";

  const formatNum = (n: number) =>
    n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1_000 ? `${(n / 1_000).toFixed(0)}K` : n.toString();

  const formatTimestamp = (iso: string) => {
    try {
      const d = new Date(iso);
      return d.toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" })
        + " " + d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
    } catch { return iso; }
  };

  const weightedGrowth = (
    valueKey: "followers" | "totalViews",
    growthKey: "followerGrowthPct30d" | "viewGrowthPct30d",
  ) => {
    const total = stats.reduce((sum, stat) => sum + stat[valueKey], 0);
    if (total <= 0) return 0;
    return stats.reduce(
      (sum, stat) => sum + stat[growthKey] * stat[valueKey],
      0,
    ) / total;
  };

  const followerGrowth7d = weightedGrowth("followers", "followerGrowthPct30d");
  const viewGrowth7d = (() => {
    const total = viewStats.reduce((sum, stat) => sum + stat.totalViews, 0);
    if (total <= 0) return 0;
    return viewStats.reduce(
      (sum, stat) => sum + stat.viewGrowthPct30d * stat.totalViews,
      0,
    ) / total;
  })();
  const formatChange = (value: number) => `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`;
  const changeColor = (value: number) => value >= 0 ? "text-positive" : "text-red-500";

  const cards = [
    {
      label: "Total Followers",
      value: formatNum(totalFollowers),
      change: formatChange(followerGrowth7d),
      changeColor: changeColor(followerGrowth7d),
    },
    {
      label: "Total Views",
      value: formatNum(totalViews),
      change: formatChange(viewGrowth7d),
      changeColor: changeColor(viewGrowth7d),
    },
    {
      label: "Active Platforms",
      value: `${activeCount} / 4`,
      change: "",
      changeColor: "",
    },
    {
      label: "Last Updated",
      value: formatTimestamp(lastUpdated),
      change: "",
      changeColor: "",
    },
  ];

  return (
    <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
      {cards.map((card) => (
        <div key={card.label} className="min-w-0 rounded-xl border border-slate-100 bg-white p-3 shadow-sm sm:p-4">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">{card.label}</p>
          <div className="flex items-baseline gap-2">
            <p className="break-words text-lg font-bold text-slate-800 sm:text-xl">{card.value}</p>
            {card.change && (
              <span className={`text-xs font-medium ${card.changeColor}`}>{card.change}</span>
            )}
          </div>
          {card.label === "Total Followers" && (
            <p className="text-xs text-slate-400 mt-0.5">vs. previous 7 days</p>
          )}
          {card.label === "Total Views" && (
            <p className="text-xs text-slate-400 mt-0.5">vs. previous 7 days</p>
          )}
        </div>
      ))}
    </div>
  );
}
