import { useState } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import type { TrendPoint, PlatformKey } from "../../types";
import { PLATFORM_COLORS, PLATFORM_INFO } from "../../data/mockData";

interface TrendGraphsProps {
  trendData: TrendPoint[];
  activePlatforms: PlatformKey[];
}

const PERIODS = [
  { label: "7D", days: 7 },
  { label: "30D", days: 30 },
  { label: "90D", days: 90 },
] as const;

export function TrendGraphs({ trendData, activePlatforms }: TrendGraphsProps) {
  const [periodDays, setPeriodDays] = useState<90 | 30 | 7>(7);

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
    <div className="grid grid-cols-2 gap-4 mb-6">
      {charts.map((chart) => (
        <div key={chart.key} className="bg-white rounded-xl p-4 shadow-sm border border-slate-100">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-slate-800">{chart.title}</h3>
            <div className="flex gap-1">
              {PERIODS.map((p) => (
                <button
                  key={p.label}
                  onClick={() => setPeriodDays(p.days)}
                  className={`px-2 py-1 text-xs rounded font-medium transition-all ${
                    periodDays === p.days
                      ? "bg-accent text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {p.label}
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
                tickFormatter={(v: string) => v.slice(5)}
                interval="preserveStartEnd"
              />
              <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} tickFormatter={formatYAxis} width={50} />
              <Tooltip
                contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e2e8f0" }}
                formatter={(value) => [formatYAxis(Number(value))]}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              {chart.platforms.map((p) => (
                <Line
                  key={p}
                  type="monotone"
                  dataKey={chart.key === "followers" ? `${p}.followers` : `${p}.views`}
                  stroke={PLATFORM_COLORS[p]}
                  strokeWidth={2}
                  dot={false}
                  name={PLATFORM_INFO[p].name}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      ))}
    </div>
  );
}
