import type { CountryPlatformStats } from "../../types";

interface SummaryCardsProps {
  stats: CountryPlatformStats[];
}

export function SummaryCards({ stats }: SummaryCardsProps) {
  const totalFollowers = stats.reduce((sum, s) => sum + s.followers, 0);
  const totalViews = stats.reduce((sum, s) => sum + s.totalViews, 0);
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

  const cards = [
    {
      label: "Total Followers",
      value: formatNum(totalFollowers),
      change: `+${(stats.reduce((s, p) => s + p.followerGrowthPct30d, 0) / stats.length).toFixed(1)}%`,
      changeColor: "text-positive",
    },
    {
      label: "Total Views",
      value: formatNum(totalViews),
      change: `+${(stats.reduce((s, p) => s + p.viewGrowthPct30d, 0) / stats.length).toFixed(1)}%`,
      changeColor: "text-positive",
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
    <div className="grid grid-cols-4 gap-4 mb-6">
      {cards.map((card) => (
        <div key={card.label} className="bg-white rounded-xl p-4 shadow-sm border border-slate-100">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">{card.label}</p>
          <div className="flex items-baseline gap-2">
            <p className="text-xl font-bold text-slate-800">{card.value}</p>
            {card.change && (
              <span className={`text-xs font-medium ${card.changeColor}`}>{card.change}</span>
            )}
          </div>
          {card.label === "Total Followers" && (
            <p className="text-xs text-slate-400 mt-0.5">vs. last 30 days</p>
          )}
          {card.label === "Total Views" && (
            <p className="text-xs text-slate-400 mt-0.5">vs. last 30 days</p>
          )}
        </div>
      ))}
    </div>
  );
}
