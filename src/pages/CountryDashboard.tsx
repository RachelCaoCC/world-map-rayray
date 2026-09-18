import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useDashboardStore } from "../store/useStore";
import { Layout } from "../components/layout/Layout";
import { SummaryCards } from "../components/dashboard/SummaryCards";
import { PlatformCards } from "../components/dashboard/PlatformCards";
import { TrendGraphs } from "../components/dashboard/TrendGraphs";
import { ComparisonTable } from "../components/dashboard/ComparisonTable";
import { usePolling } from "../hooks/usePolling";
import type { CountryPlatformStats, PlatformKey, TrendPoint } from "../types";

type PeriodDays = 7 | 30 | 90;
const DAY_MS = 24 * 60 * 60 * 1000;

function calculatePeriodGrowth(
  trendData: TrendPoint[],
  platform: PlatformKey,
  metric: "followers" | "views",
  periodDays: PeriodDays,
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
  const targetTimestamp = latest.timestamp - periodDays * DAY_MS;
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
  const [periodDays, setPeriodDays] = useState<PeriodDays>(7);
  const getCountryById = useDashboardStore((s) => s.getCountryById);
  const getAggregatedStatsForCountry = useDashboardStore((s) => s.getAggregatedStatsForCountry);
  const fetchTrendData = useDashboardStore((s) => s.fetchTrendData);
  const trendData = useDashboardStore((s) => s.trendData);

  usePolling(15000);

  useEffect(() => {
    if (id) fetchTrendData(id);
  }, [id, fetchTrendData]);

  const country = getCountryById(id ?? "");
  if (!country) {
    return (
      <Layout showBack backTo="/map">
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <p className="text-slate-500 text-lg mb-2">Country not found</p>
            <button onClick={() => navigate("/map")} className="text-accent hover:underline text-sm">
              ← Back to Home
            </button>
          </div>
        </div>
      </Layout>
    );
  }

  const platformStats = getAggregatedStatsForCountry(country.id);
  const periodStats: CountryPlatformStats[] = platformStats.map((stat) => ({
    ...stat,
    // Legacy property names are retained for compatibility. Their values
    // now reflect the period selected for the entire dashboard.
    followerGrowthPct30d: calculatePeriodGrowth(
      trendData,
      stat.platform as PlatformKey,
      "followers",
      periodDays,
    ),
    viewGrowthPct30d: calculatePeriodGrowth(
      trendData,
      stat.platform as PlatformKey,
      "views",
      periodDays,
    ),
  }));

  return (
    <Layout showBack backTo="/map">
      <div className="h-full overflow-y-auto">
        <div className="mx-auto max-w-7xl px-3 py-4 sm:px-6 sm:py-6">
          <div className="mb-5 flex flex-col items-stretch gap-3 sm:mb-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <span className={`fi fi-${country.id} text-2xl rounded shadow-sm`} />
              <div>
                <h1 className="text-xl font-bold text-slate-800 sm:text-2xl">{country.name}</h1>
                <p className="text-sm text-slate-500">{country.region}</p>
              </div>
            </div>

            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
              <button
                type="button"
                onClick={() => navigate(`/country/${country.id}/report?period=${periodDays}`)}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-accent-dark"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 19V9m5 10V5m5 14v-7m5 7V3" />
                </svg>
                Country Report
              </button>
              <select
                value={country.id}
                onChange={(e) => navigate(`/country/${e.target.value}`)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-accent/30 sm:w-auto"
              >
                <option value={country.id}>{country.name}</option>
              </select>
            </div>
          </div>

          <SummaryCards stats={periodStats} periodDays={periodDays} />

          <PlatformCards stats={periodStats} countryId={country.id} periodDays={periodDays} />

          <TrendGraphs
            trendData={trendData}
            activePlatforms={country.activePlatforms}
            periodDays={periodDays}
            onPeriodChange={setPeriodDays}
          />

          <ComparisonTable stats={periodStats} periodDays={periodDays} />
        </div>
      </div>
    </Layout>
  );
}
