import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import type { TrendPoint, PlatformKey } from "../../types";
import { PLATFORM_COLORS, PLATFORM_INFO } from "../../data/mockData";

interface TrendGraphsProps {
  trendData: TrendPoint[];
  activePlatforms: PlatformKey[];
  periodDays: 7 | 30 | 90;
  onPeriodChange: (days: 7 | 30 | 90) => void;
}

const PERIODS = [
  { label: "7D", days: 7 },
  { label: "30D", days: 30 },
  { label: "90D", days: 90 },
] as const;

export function TrendGraphs({
  trendData,
  activePlatforms,
  periodDays,
  onPeriodChange,
}: TrendGraphsProps) {
  const filteredData = trendData.slice(-periodDays);

  const formatYAxis = (value: number) =>
    value >= 1_000_000 ? `${(value / 1_000_000).toFixed(1)}M` :
    value >= 1_000 ? `${(value / 1_000).toFixed(0)}K` :
    value.toString();

  const charts = [
    { title: "Follower Trend", key: "followers" as const, platforms: activePlatforms },
    {
      title: "Views Trend (YouTube / TikTok)",
      key: "views" as const,
      platforms: activePlatforms.filter((platform) => platform === "youtube" || platform === "tiktok"),
    },
  ];

  return (
    <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
      {charts.map((chart) => (
        <div key={chart.key} className="min-w-0 rounded-xl border border-slate-100 bg-white p-3 shadow-sm sm:p-4">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-slate-800">{chart.title}</h3>
            <div className="flex gap-1">
              {PERIODS.map((period) => (
                <button
                  key={period.label}
                  onClick={() => onPeriodChange(period.days)}
                  aria-pressed={periodDays === period.days}
                  className={`px-2 py-1 text-xs rounded font-medium transition-all ${
                    periodDays === period.days
                      ? "bg-accent text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {period.label}
                </button>
              ))}
            </div>
          </div>

          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={filteredData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 10, fill: "#94a3b8" }}
                tickFormatter={(value: string) => value.slice(5)}
                interval="preserveStartEnd"
              />
              <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} tickFormatter={formatYAxis} width={50} />
              <Tooltip
                contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e2e8f0" }}
                formatter={(value) => [formatYAxis(Number(value))]}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              {chart.platforms.map((platform) => (
                <Line
                  key={platform}
                  type="monotone"
                  dataKey={chart.key === "followers" ? `${platform}.followers` : `${platform}.views`}
                  stroke={PLATFORM_COLORS[platform]}
                  strokeWidth={2}
                  dot={false}
                  name={PLATFORM_INFO[platform].name}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      ))}
    </div>
  );
}
