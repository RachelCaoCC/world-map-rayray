import { useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useDashboardStore } from "../store/useStore";
import { Layout } from "../components/layout/Layout";
import { SummaryCards } from "../components/dashboard/SummaryCards";
import { PlatformCards } from "../components/dashboard/PlatformCards";
import { TrendGraphs } from "../components/dashboard/TrendGraphs";
import { ComparisonTable } from "../components/dashboard/ComparisonTable";
import { usePolling } from "../hooks/usePolling";
import type { CountryPlatformStats, PlatformKey, TrendPoint } from "../types";

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

function calculateSevenDayGrowth(
  trendData: TrendPoint[],
  platform: PlatformKey,
  metric: "followers" | "views",
): number {
  const points = trendData
    .filter((point) => point[platform] !== undefined)
    .map((point) => ({
      timestamp: new Date(point.date).getTime(),
      value: point[platform]?.[metric] ?? 0,
    }))
    .filter((point) => Number.isFinite(point.timestamp))
    .sort((a, b) => a.timestamp - b.timestamp);

  if (points.length < 2) return 0;

  const latest = points[points.length - 1];
  const targetTimestamp = latest.timestamp - SEVEN_DAYS_MS;
  const baseline = points.reduce((closest, point) =>
    Math.abs(point.timestamp - targetTimestamp) < Math.abs(closest.timestamp - targetTimestamp)
      ? point
      : closest
  );

  if (baseline.timestamp === latest.timestamp || baseline.value <= 0) return 0;
  return Math.round(((latest.value - baseline.value) / baseline.value) * 1000) / 10;
}

export function CountryDashboard() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const getCountryById = useDashboardStore((s) => s.getCountryById);
  const getAggregatedStatsForCountry = useDashboardStore((s) => s.getAggregatedStatsForCountry);
  const fetchTrendData = useDashboardStore((s) => s.fetchTrendData);
  const trendData = useDashboardStore((s) => s.trendData);

  usePolling(15000);

  // Fetch trend data when country changes
  useEffect(() => {
    if (id) fetchTrendData(id);
  }, [id, fetchTrendData]);

  const country = getCountryById(id ?? "");
  if (!country) {
    return (
      <Layout showBack backTo="/">
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <p className="text-slate-500 text-lg mb-2">Country not found</p>
            <button onClick={() => navigate("/")} className="text-accent hover:underline text-sm">
              ← Back to Home
            </button>
          </div>
        </div>
      </Layout>
    );
  }

  const platformStats = getAggregatedStatsForCountry(country.id);

  const sevenDayStats = useMemo<CountryPlatformStats[]>(
    () => platformStats.map((stat) => ({
      ...stat,
      // These legacy property names are retained for compatibility, but the
      // values shown on this page are calculated from the last seven days.
      followerGrowthPct30d: calculateSevenDayGrowth(
        trendData,
        stat.platform as PlatformKey,
        "followers",
      ),
      viewGrowthPct30d: calculateSevenDayGrowth(
        trendData,
        stat.platform as PlatformKey,
        "views",
      ),
    })),
    [platformStats, trendData],
  );

  return (
    <Layout showBack backTo="/">
      <div className="h-full overflow-y-auto">
        <div className="max-w-7xl mx-auto px-6 py-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <span className={`fi fi-${country.id} text-2xl rounded shadow-sm`} />
              <div>
                <h1 className="text-2xl font-bold text-slate-800">{country.name}</h1>
                <p className="text-sm text-slate-500">{country.region}</p>
              </div>
            </div>

            {/* Country selector */}
            <select
              value={country.id}
              onChange={(e) => navigate(`/country/${e.target.value}`)}
              className="bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-accent/30"
            >
              <option value={country.id}>{country.name}</option>
            </select>
          </div>

          {/* Summary cards */}
          <SummaryCards stats={sevenDayStats} />

          {/* Platform cards */}
          <PlatformCards stats={sevenDayStats} countryId={country.id} />

          {/* Trend graphs */}
          <TrendGraphs trendData={trendData} activePlatforms={country.activePlatforms} />

          {/* Comparison table */}
          <ComparisonTable stats={sevenDayStats} />
        </div>
      </div>
    </Layout>
  );
}
