import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  BarChart,
  Bar,
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
import { useDashboardStore } from "../store/useStore";
import { buildGlobalReportRows, downloadGlobalReport } from "../utils/globalReport";

const PLATFORM_LABELS: Record<string, string> = {
  facebook: "Facebook",
  instagram: "Instagram",
  youtube: "YouTube",
  tiktok: "TikTok",
  x: "X",
};

const PLATFORM_COLORS: Record<string, string> = {
  facebook: "#1877f2",
  instagram: "#e1306c",
  youtube: "#ff0000",
  tiktok: "#111827",
  x: "#64748b",
};

const SOURCE_COLORS = ["#3b82f6", "#f59e0b"];

const number = (value: number) => value.toLocaleString("en-US");

export function GlobalReport() {
  const navigate = useNavigate();
  const countries = useDashboardStore((state) => state.countries);
  const connections = useDashboardStore((state) => state.platformConnections);
  const accountStats = useDashboardStore((state) => state.accountStats);

  const rows = useMemo(
    () => buildGlobalReportRows(countries, connections, accountStats),
    [countries, connections, accountStats],
  );

  const countryData = useMemo(() => {
    const totals = new Map<string, number>();
    for (const row of rows) totals.set(row.countryName, (totals.get(row.countryName) ?? 0) + row.followers);
    return [...totals.entries()]
      .map(([name, followers]) => ({ name, followers }))
      .sort((a, b) => b.followers - a.followers);
  }, [rows]);

  const platformData = useMemo(() => {
    const totals = new Map<string, number>();
    for (const row of rows) totals.set(row.platform, (totals.get(row.platform) ?? 0) + row.followers);
    return [...totals.entries()]
      .map(([platform, followers]) => ({
        platform,
        name: PLATFORM_LABELS[platform] ?? platform,
        followers,
      }))
      .sort((a, b) => b.followers - a.followers);
  }, [rows]);

  const sourceData = useMemo(() => {
    const api = rows.filter((row) => row.source === "API Connected");
    const manual = rows.filter((row) => row.source === "Manual Snapshot");
    return [
      { name: "API Connected", value: api.reduce((sum, row) => sum + row.followers, 0), accounts: api.length },
      { name: "Manual Snapshot", value: manual.reduce((sum, row) => sum + row.followers, 0), accounts: manual.length },
    ];
  }, [rows]);

  const totalFollowers = rows.reduce((sum, row) => sum + row.followers, 0);
  const markets = new Set(rows.map((row) => row.countryId)).size;
  const apiAccounts = rows.filter((row) => row.source === "API Connected").length;
  const manualAccounts = rows.length - apiAccounts;
  const largestMarket = countryData[0];
  const largestPlatform = platformData[0];
  const manualFollowers = sourceData[1]?.value ?? 0;
  const manualShare = totalFollowers > 0 ? (manualFollowers / totalFollowers) * 100 : 0;

  return (
    <Layout showBack backTo="/map">
      <div className="h-full overflow-y-auto bg-slate-50 print:overflow-visible">
        <main className="mx-auto max-w-7xl px-6 py-6">
          <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-[0.18em] text-blue-600">Global analysis</p>
              <h1 className="text-3xl font-bold text-slate-900">Global Social Media Report</h1>
              <p className="mt-2 max-w-2xl text-sm text-slate-500">
                Connected API data is always prioritised. Manual snapshots fill only unconnected country-platform gaps.
              </p>
            </div>
            <div className="flex gap-2 print:hidden">
              <button
                type="button"
                onClick={() => downloadGlobalReport(countries, connections, accountStats)}
                className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-100"
              >
                Download CSV
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700"
              >
                Print / Save PDF
              </button>
            </div>
          </header>

          <section className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["Total Followers", number(totalFollowers), "Across all recorded accounts"],
              ["Markets Covered", number(markets), "Countries and regions with data"],
              ["API Accounts", number(apiAccounts), "Live or saved Supabase connections"],
              ["Manual Accounts", number(manualAccounts), "Fallback snapshots only"],
            ].map(([label, value, description]) => (
              <article key={label} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
                <p className="mt-2 text-3xl font-bold text-slate-900">{value}</p>
                <p className="mt-1 text-xs text-slate-400">{description}</p>
              </article>
            ))}
          </section>

          <section className="mb-6 rounded-xl border border-blue-100 bg-blue-50/70 p-5">
            <h2 className="text-sm font-semibold text-blue-900">Executive analysis</h2>
            <div className="mt-3 grid gap-3 text-sm text-slate-700 md:grid-cols-3">
              <p>
                <span className="font-semibold">{largestMarket?.name ?? "—"}</span> is the largest recorded market with{" "}
                <span className="font-semibold">{number(largestMarket?.followers ?? 0)}</span> followers.
              </p>
              <p>
                <span className="font-semibold">{largestPlatform?.name ?? "—"}</span> is the strongest platform with{" "}
                <span className="font-semibold">{number(largestPlatform?.followers ?? 0)}</span> followers.
              </p>
              <p>
                Manual snapshots represent <span className="font-semibold">{manualShare.toFixed(1)}%</span> of recorded followers.
                Connect those accounts to replace snapshots with live data.
              </p>
            </div>
          </section>

          <section className="mb-6 grid gap-4 lg:grid-cols-2">
            <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="mb-4 text-base font-semibold text-slate-800">Followers by Market</h2>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={countryData.slice(0, 12)} layout="vertical" margin={{ left: 20, right: 24 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                    <XAxis type="number" tick={{ fontSize: 11 }} />
                    <YAxis type="category" dataKey="name" width={92} tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(value) => number(Number(value))} />
                    <Bar dataKey="followers" fill="#3b82f6" radius={[0, 5, 5, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </article>

            <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="mb-4 text-base font-semibold text-slate-800">Followers by Platform</h2>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={platformData} dataKey="followers" nameKey="name" innerRadius={62} outerRadius={104} paddingAngle={3}>
                      {platformData.map((item) => (
                        <Cell key={item.platform} fill={PLATFORM_COLORS[item.platform] ?? "#94a3b8"} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => number(Number(value))} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex flex-wrap justify-center gap-4 text-xs text-slate-600">
                {platformData.map((item) => (
                  <span key={item.platform} className="inline-flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: PLATFORM_COLORS[item.platform] }} />
                    {item.name}: {number(item.followers)}
                  </span>
                ))}
              </div>
            </article>

            <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-2">
              <h2 className="mb-4 text-base font-semibold text-slate-800">API Coverage vs Manual Fallback</h2>
              <div className="grid items-center gap-6 md:grid-cols-[280px_1fr]">
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={sourceData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={88} paddingAngle={4}>
                        {sourceData.map((item, index) => <Cell key={item.name} fill={SOURCE_COLORS[index]} />)}
                      </Pie>
                      <Tooltip formatter={(value) => number(Number(value))} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="space-y-3">
                  {sourceData.map((item, index) => (
                    <div key={item.name} className="flex items-center justify-between rounded-lg bg-slate-50 px-4 py-3">
                      <span className="flex items-center gap-2 text-sm font-medium text-slate-700">
                        <span className="h-3 w-3 rounded-full" style={{ backgroundColor: SOURCE_COLORS[index] }} />
                        {item.name}
                      </span>
                      <span className="text-right">
                        <strong className="block text-sm text-slate-900">{number(item.value)} followers</strong>
                        <span className="text-xs text-slate-400">{item.accounts} accounts</span>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </article>
          </section>

          <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <div>
                <h2 className="text-base font-semibold text-slate-800">Account Detail</h2>
                <p className="text-xs text-slate-400">{rows.length} accounts across {markets} markets</p>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[850px] text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-5 py-3">Market</th>
                    <th className="px-5 py-3">Platform</th>
                    <th className="px-5 py-3">Account</th>
                    <th className="px-5 py-3 text-right">Followers</th>
                    <th className="px-5 py-3">Source</th>
                    <th className="px-5 py-3">Updated</th>
                    <th className="px-5 py-3 print:hidden">Dashboard</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map((row) => (
                    <tr key={`${row.countryId}-${row.platform}-${row.accountName}`} className="hover:bg-slate-50">
                      <td className="px-5 py-3">
                        <p className="font-medium text-slate-800">{row.countryName}</p>
                        <p className="text-xs text-slate-400">{row.region}</p>
                      </td>
                      <td className="px-5 py-3">{PLATFORM_LABELS[row.platform] ?? row.platform}</td>
                      <td className="px-5 py-3 text-slate-600">{row.accountName}</td>
                      <td className="px-5 py-3 text-right font-semibold text-slate-800">{number(row.followers)}</td>
                      <td className="px-5 py-3">
                        <span className={`rounded-full px-2 py-1 text-xs font-medium ${
                          row.source === "API Connected"
                            ? "bg-blue-50 text-blue-700"
                            : "bg-amber-50 text-amber-700"
                        }`}>
                          {row.source}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-xs text-slate-500">{row.lastUpdated || "—"}</td>
                      <td className="px-5 py-3 print:hidden">
                        <button
                          type="button"
                          onClick={() => navigate(`/country/${row.countryId}`)}
                          className="text-xs font-medium text-blue-600 hover:underline"
                        >
                          Open
                        </button>
                      </td>
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
