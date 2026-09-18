import { useEffect } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Layout } from "../components/layout/Layout";
import { PLATFORM_COLORS, PLATFORM_INFO } from "../data/mockData";
import { useDashboardStore } from "../store/useStore";
import type { PlatformKey, TrendPoint } from "../types";

type PeriodDays = 7 | 30 | 90;
const DAY_MS = 24 * 60 * 60 * 1000;

function growthFor(
  trendData: TrendPoint[],
  platform: PlatformKey,
  metric: "followers" | "views",
  periodDays: PeriodDays,
) {
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
  const target = latest.timestamp - periodDays * DAY_MS;
  const baseline = points.reduce((closest, point) =>
    Math.abs(point.timestamp - target) < Math.abs(closest.timestamp - target) ? point : closest
  );
  if (baseline.timestamp === latest.timestamp || baseline.value <= 0) return 0;
  return Math.round(((latest.value - baseline.value) / baseline.value) * 1000) / 10;
}

const formatNumber = (value: number) => value.toLocaleString("en-US");
const formatGrowth = (value: number) => `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`;

export function CountryReport() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const requestedPeriod = Number(searchParams.get("period"));
  const periodDays: PeriodDays = requestedPeriod === 30 || requestedPeriod === 90 ? requestedPeriod : 7;

  const getCountryById = useDashboardStore((state) => state.getCountryById);
  const getAggregatedStatsForCountry = useDashboardStore((state) => state.getAggregatedStatsForCountry);
  const fetchTrendData = useDashboardStore((state) => state.fetchTrendData);
  const trendData = useDashboardStore((state) => state.trendData);

  useEffect(() => {
    if (id) fetchTrendData(id);
  }, [fetchTrendData, id]);

  const country = getCountryById(id ?? "");
  if (!country) {
    return (
      <Layout showBack backTo="/map">
        <div className="flex h-full items-center justify-center text-slate-500">Country not found</div>
      </Layout>
    );
  }

  const stats = getAggregatedStatsForCountry(country.id).map((stat) => ({
    ...stat,
    followerGrowth: growthFor(trendData, stat.platform as PlatformKey, "followers", periodDays),
    metricGrowth: growthFor(trendData, stat.platform as PlatformKey, "views", periodDays),
  }));
  const totalFollowers = stats.reduce((sum, stat) => sum + stat.followers, 0);
  const totalViews = stats
    .filter((stat) => stat.platform === "youtube" || stat.platform === "tiktok")
    .reduce((sum, stat) => sum + stat.totalViews, 0);
  const leadingPlatform = [...stats].sort((a, b) => b.followers - a.followers)[0];
  const strongestGrowth = [...stats].sort((a, b) => b.followerGrowth - a.followerGrowth)[0];
  const weakestGrowth = [...stats].sort((a, b) => a.followerGrowth - b.followerGrowth)[0];
  const leaderShare = totalFollowers > 0 && leadingPlatform
    ? (leadingPlatform.followers / totalFollowers) * 100
    : 0;
  const chartData = stats.map((stat) => ({
    platform: PLATFORM_INFO[stat.platform as PlatformKey].name,
    key: stat.platform,
    followers: stat.followers,
    secondary: stat.totalViews,
  }));

  return (
    <Layout showBack backTo={`/country/${country.id}`}>
      <div className="h-full overflow-y-auto bg-slate-50 print:h-auto print:overflow-visible">
        <main className="mx-auto max-w-7xl px-3 py-4 sm:px-6 sm:py-6">
          <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-[0.18em] text-blue-600">
                {periodDays}-day country analysis
              </p>
              <div className="flex items-center gap-3">
                <span className={`fi fi-${country.id} text-3xl rounded shadow-sm`} />
                <div>
                  <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">{country.name} Social Media Report</h1>
                  <p className="text-sm text-slate-500">{country.region} · vs. previous {periodDays} days</p>
                </div>
              </div>
            </div>
            <div className="flex gap-2 print:hidden">
              <button
                type="button"
                onClick={() => navigate(`/country/${country.id}`)}
                className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700"
              >
                Dashboard
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white"
              >
                Print / Save PDF
              </button>
            </div>
          </header>

          <section className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[
              ["Total Followers", formatNumber(totalFollowers)],
              ["Total Views", formatNumber(totalViews)],
              ["Active Platforms", String(stats.filter((stat) => stat.accountCount > 0).length)],
              ["Report Window", `${periodDays} days`],
            ].map(([label, value]) => (
              <article key={label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
                <p className="mt-2 text-2xl font-bold text-slate-900">{value}</p>
              </article>
            ))}
          </section>

          <section className="mb-6">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-600">Executive summary</p>
            <h2 className="mt-1 text-xl font-bold text-slate-900">Country Performance Analysis</h2>
            <div className="mt-4 grid gap-4 lg:grid-cols-3">
              <article className="rounded-xl border border-l-4 border-slate-200 border-l-blue-500 bg-white p-5 shadow-sm">
                <h3 className="font-semibold text-slate-900">Platform concentration</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  <strong>{leadingPlatform ? PLATFORM_INFO[leadingPlatform.platform as PlatformKey].name : "—"}</strong> is the largest channel with{" "}
                  <strong>{formatNumber(leadingPlatform?.followers ?? 0)}</strong> followers, representing{" "}
                  <strong>{leaderShare.toFixed(1)}%</strong> of this market's audience.
                </p>
              </article>
              <article className="rounded-xl border border-l-4 border-slate-200 border-l-emerald-500 bg-white p-5 shadow-sm">
                <h3 className="font-semibold text-slate-900">Growth leader</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  <strong>{strongestGrowth ? PLATFORM_INFO[strongestGrowth.platform as PlatformKey].name : "—"}</strong> leads follower growth at{" "}
                  <strong>{formatGrowth(strongestGrowth?.followerGrowth ?? 0)}</strong> versus the previous {periodDays} days.
                </p>
              </article>
              <article className="rounded-xl border border-l-4 border-slate-200 border-l-amber-500 bg-white p-5 shadow-sm">
                <h3 className="font-semibold text-slate-900">Priority action</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Review <strong>{weakestGrowth ? PLATFORM_INFO[weakestGrowth.platform as PlatformKey].name : "—"}</strong>, currently at{" "}
                  <strong>{formatGrowth(weakestGrowth?.followerGrowth ?? 0)}</strong>. Test content cadence, creative and cross-platform promotion.
                </p>
              </article>
            </div>
          </section>

          <section className="mb-6 grid gap-4 lg:grid-cols-2">
            <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="mb-4 font-semibold text-slate-900">Followers by Platform</h2>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="platform" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(value) => formatNumber(Number(value))} />
                    <Bar dataKey="followers" radius={[5, 5, 0, 0]}>
                      {chartData.map((item) => (
                        <Cell key={item.key} fill={PLATFORM_COLORS[item.key as PlatformKey]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </article>

            <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="mb-4 font-semibold text-slate-900">Audience Share</h2>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={chartData} dataKey="followers" nameKey="platform" innerRadius={58} outerRadius={96} paddingAngle={3}>
                      {chartData.map((item) => (
                        <Cell key={item.key} fill={PLATFORM_COLORS[item.key as PlatformKey]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => formatNumber(Number(value))} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </article>
          </section>

          <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 px-5 py-4">
              <h2 className="font-semibold text-slate-900">Platform Detail</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-5 py-3 text-left">Platform</th>
                    <th className="px-5 py-3 text-right">Followers</th>
                    <th className="px-5 py-3 text-right">Secondary Metric</th>
                    <th className="px-5 py-3 text-right">Follower Growth ({periodDays}D)</th>
                    <th className="px-5 py-3 text-right">Metric Growth ({periodDays}D)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {stats.map((stat) => (
                    <tr key={stat.platform}>
                      <td className="px-5 py-3 font-medium text-slate-800">
                        {PLATFORM_INFO[stat.platform as PlatformKey].name}
                      </td>
                      <td className="px-5 py-3 text-right">{formatNumber(stat.followers)}</td>
                      <td className="px-5 py-3 text-right">{formatNumber(stat.totalViews)}</td>
                      <td className="px-5 py-3 text-right font-semibold">{formatGrowth(stat.followerGrowth)}</td>
                      <td className="px-5 py-3 text-right font-semibold">{formatGrowth(stat.metricGrowth)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </main>
      </div>
    </Layout>
  );
}
