import { useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useDashboardStore } from "../store/useStore";
import { Layout } from "../components/layout/Layout";
import { SummaryCards } from "../components/dashboard/SummaryCards";
import { PlatformCards } from "../components/dashboard/PlatformCards";
import { TrendGraphs } from "../components/dashboard/TrendGraphs";
import { ComparisonTable } from "../components/dashboard/ComparisonTable";
import { usePolling } from "../hooks/usePolling";

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
          <SummaryCards stats={platformStats} />

          {/* Platform cards */}
          <PlatformCards stats={platformStats} countryId={country.id} />

          {/* Trend graphs */}
          <TrendGraphs trendData={trendData} activePlatforms={country.activePlatforms} />

          {/* Comparison table */}
          <ComparisonTable stats={platformStats} />
        </div>
      </div>
    </Layout>
  );
}
