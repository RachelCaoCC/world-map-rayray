import { useMemo, useState } from "react";
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
import { EditableNarrative } from "../components/report/EditableNarrative";
import { AskReportAI } from "../components/report/AskReportAI";
import { usePolling } from "../hooks/usePolling";
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
  usePolling(15000);
  const navigate = useNavigate();
  const [language, setLanguage] = useState<"en" | "zh">("en");
  const zh = language === "zh";
  const tr = (en: string, cn: string) => zh ? cn : en;
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
  const topThreeFollowers = countryData.slice(0, 3).reduce((sum, market) => sum + market.followers, 0);
  const topThreeShare = totalFollowers > 0 ? (topThreeFollowers / totalFollowers) * 100 : 0;
  const usaMarket = countryData.find((market) => market.name.toLowerCase().includes("united states"));
  const usaVsLeader = usaMarket && largestMarket?.followers
    ? (usaMarket.followers / largestMarket.followers) * 100
    : null;
  const zombieAccounts = rows
    .filter((row) => row.followers <= 10)
    .sort((a, b) => a.followers - b.followers);
  const zombieNames = zombieAccounts
    .slice(0, 4)
    .map((row) => `${row.countryName} ${PLATFORM_LABELS[row.platform] ?? row.platform} (${number(row.followers)})`)
    .join(", ");
  const manualPriorities = rows
    .filter((row) => row.source === "Manual Snapshot")
    .sort((a, b) => b.followers - a.followers)
    .slice(0, 3);
  const manualPriorityNames = manualPriorities
    .map((row) => `${row.countryName} ${PLATFORM_LABELS[row.platform] ?? row.platform}`)
    .join(", ");
  const coverageNarrative = zh
    ? `${rows.length} 个账号覆盖 ${platformData.length} 个平台和 ${markets} 个市场。前三大市场占全部已记录粉丝的 ${topThreeShare.toFixed(1)}%，${topThreeShare >= 70 ? "集中度较高，建议加强长尾市场建设。" : "整体分布相对均衡，但较小市场仍有进一步深化空间。"}`
    : `${rows.length} accounts cover ${platformData.length} platforms and ${markets} markets. The top three markets hold ${topThreeShare.toFixed(1)}% of all recorded followers, indicating${topThreeShare >= 70 ? " high concentration and a need to strengthen the long tail." : " a relatively balanced footprint with room to deepen smaller markets."}`;
  const usaNarrative = zh
    ? usaMarket
      ? `美国目前记录 ${number(usaMarket.followers)} 名粉丝，相当于领先市场 ${largestMarket?.name ?? "—"} 的 ${usaVsLeader?.toFixed(1)}%。${usaVsLeader !== null && usaVsLeader < 50 ? "对于一个全球重点市场而言，这仍是明显的覆盖缺口。" : "其相对位置较健康，但仍应结合市场潜力持续监测。"}`
      : "目前没有记录美国账号数据。在评估该重点市场前，请先添加 API 连接或手动快照。"
    : usaMarket
      ? `The United States records ${number(usaMarket.followers)} followers, equal to ${usaVsLeader?.toFixed(1)}% of the leading market, ${largestMarket?.name ?? "—"}.${usaVsLeader !== null && usaVsLeader < 50 ? " For a priority global market, this is a material coverage gap." : " Its relative position is healthy but should be monitored against market potential."}`
      : "No United States account data is currently recorded. Add a connection or manual snapshot before evaluating this priority market.";
  const leaderNarrative = zh
    ? `领先市场贡献 ${number(largestMarket?.followers ?? 0)} 名粉丝。整个账号组合中，${largestPlatform?.name ?? "—"} 贡献 ${number(largestPlatform?.followers ?? 0)} 名粉丝。这两项可作为较低表现市场在内容、投入和账号运营方面的主要基准。`
    : `The leading market contributes ${number(largestMarket?.followers ?? 0)} followers. Across the full portfolio, ${largestPlatform?.name ?? "—"} contributes ${number(largestPlatform?.followers ?? 0)}. These are the clearest benchmarks for content, investment and account operations in lower-performing markets.`;
  const riskNarrative = zh
    ? `${zombieAccounts.length > 0 ? `目前有 ${zombieAccounts.length} 个近乎停滞的账号，粉丝数不超过 10：${zombieNames}。` : "目前没有账号低于 10 粉丝的风险阈值。"} 手动快照占总粉丝的 ${manualShare.toFixed(1)}%，应尽可能替换为 API 连接。`
    : `${zombieAccounts.length > 0 ? `There are ${zombieAccounts.length} near-dormant accounts at 10 followers or fewer: ${zombieNames}.` : "No accounts currently fall below the 10-follower risk threshold."} Manual snapshots represent ${manualShare.toFixed(1)}% of followers and should be replaced with API connections where possible.`;
  const actionsNarrative = zh ? [
    `1. 优先连接粉丝规模最大的手动账号${manualPriorityNames ? `：${manualPriorityNames}` : ""}。`,
    "2. 复盘所有低于 10 粉丝账号的负责人、内容发布频率和账号定位。",
    `3. 以 ${largestMarket?.name ?? "领先市场"} 和 ${largestPlatform?.name ?? "领先平台"} 作为运营基准。`,
  ].join("\n") : [
    `1. Connect the largest manual accounts first${manualPriorityNames ? `: ${manualPriorityNames}` : ""}.`,
    "2. Review ownership, content cadence and purpose for all accounts below 10 followers.",
    `3. Use ${largestMarket?.name ?? "the leading market"} and ${largestPlatform?.name ?? "the leading platform"} as operating benchmarks.`,
  ].join("\n");

  return (
    <Layout showBack backTo="/map">
      <div className="global-report-print h-full overflow-y-auto bg-slate-50 print:h-auto print:overflow-visible">
        <main className="global-report-content mx-auto max-w-7xl px-3 py-4 sm:px-6 sm:py-6">
          <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-[0.18em] text-blue-600">{tr("Global analysis", "全球分析")}</p>
              <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">{tr("Global Social Media Report", "全球社交媒体报告")}</h1>
              <p className="mt-2 max-w-2xl text-sm text-slate-500">
                {tr("Connected API data is always prioritised. Manual snapshots fill only unconnected country-platform gaps.", "优先使用已连接的 API 数据；手动快照仅用于补充尚未连接的国家/地区与平台数据缺口。")}
              </p>
            </div>
            <div className="grid w-full grid-cols-2 gap-2 print:hidden sm:flex sm:w-auto">
              <div className="col-span-2 inline-flex overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm sm:col-span-1">
                <button type="button" onClick={() => setLanguage("en")} className={`flex-1 px-3 py-2 text-xs font-semibold transition sm:flex-none ${!zh ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-50"}`}>EN</button>
                <button type="button" onClick={() => setLanguage("zh")} className={`flex-1 px-3 py-2 text-xs font-semibold transition sm:flex-none ${zh ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-50"}`}>中文</button>
              </div>
              <button
                type="button"
                onClick={() => downloadGlobalReport(countries, connections, accountStats)}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-100 sm:px-4 sm:text-sm"
              >
                {tr("Download CSV", "下载 CSV")}
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-medium text-white shadow-sm hover:bg-blue-700 sm:px-4 sm:text-sm"
              >
                {tr("Print / Save PDF", "打印 / 保存 PDF")}
              </button>
            </div>
          </header>

          <AskReportAI language={language} context={{ scope: "global", rows: rows.map((row) => ({ countryId: row.countryId, countryName: row.countryName, platform: row.platform, accountName: row.accountName, followers: row.followers, source: row.source, lastUpdated: row.lastUpdated })), summary: { totalFollowers, markets, apiAccounts, manualAccounts, topThreeShare, manualShare } }} />

          <section className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              [tr("Total Followers", "总粉丝数"), number(totalFollowers), tr("Across all recorded accounts", "所有已记录账号合计")],
              [tr("Markets Covered", "覆盖市场"), number(markets), tr("Countries and regions with data", "已有数据的国家和地区")],
              [tr("API Accounts", "API 账号"), number(apiAccounts), tr("Live or saved Supabase connections", "实时或已保存的 Supabase 连接")],
              [tr("Manual Accounts", "手动账号"), number(manualAccounts), tr("Fallback snapshots only", "仅作为备用快照")],
            ].map(([label, value, description]) => (
              <article key={label} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
                <p className="mt-2 text-3xl font-bold text-slate-900">{value}</p>
                <p className="mt-1 text-xs text-slate-400">{description}</p>
              </article>
            ))}
          </section>

          <section className="mb-6">
            <div className="mb-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-600">{tr("Core conclusions", "核心结论")}</p>
              <h2 className="mt-1 text-xl font-bold text-slate-900">{tr("Executive Summary", "执行摘要")}</h2>
              <p className="mt-1 text-sm text-slate-500">
                {tr("Conclusions recalculate automatically whenever API data or manual snapshots change.", "当 API 数据或手动快照发生变化时，结论会自动重新计算。")}
              </p>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <article className="rounded-xl border border-slate-200 border-l-4 border-l-blue-500 bg-white p-5 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">{tr("Coverage", "覆盖情况")}</p>
                <h3 className="mt-1 font-semibold text-slate-900">{tr("Breadth established, depth remains uneven", "覆盖广度已建立，但市场深度仍不均衡")}</h3>
                <EditableNarrative language={language} storageKey={`global:${language}:coverage`} defaultValue={coverageNarrative} />
              </article>

              <article className="rounded-xl border border-slate-200 border-l-4 border-l-rose-500 bg-white p-5 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-rose-600">{tr("Priority-market risk", "重点市场风险")}</p>
                <h3 className="mt-1 font-semibold text-slate-900">{tr("United States requires focused investment", "美国市场需要重点投入")}</h3>
                <EditableNarrative language={language} storageKey={`global:${language}:usa-risk`} defaultValue={usaNarrative} />
              </article>

              <article className="rounded-xl border border-slate-200 border-l-4 border-l-emerald-500 bg-white p-5 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-emerald-600">{tr("Leaders", "领先表现")}</p>
                <h3 className="mt-1 font-semibold text-slate-900">{zh ? `${largestMarket?.name ?? "—"} 领先；${largestPlatform?.name ?? "—"} 是表现最强的平台` : `${largestMarket?.name ?? "—"} leads; ${largestPlatform?.name ?? "—"} is the strongest platform`}</h3>
                <EditableNarrative language={language} storageKey={`global:${language}:leaders`} defaultValue={leaderNarrative} />
              </article>

              <article className="rounded-xl border border-slate-200 border-l-4 border-l-amber-500 bg-white p-5 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-amber-600">{tr("Data and account risk", "数据与账号风险")}</p>
                <h3 className="mt-1 font-semibold text-slate-900">{tr("Low-scale accounts and manual-data dependency", "低规模账号与手动数据依赖")}</h3>
                <EditableNarrative language={language} storageKey={`global:${language}:data-risk`} defaultValue={riskNarrative} />
              </article>
            </div>

            <div className="mt-4 rounded-xl border border-violet-100 bg-violet-50/70 p-5">
              <h3 className="text-sm font-semibold text-violet-900">{tr("Recommended next actions", "建议下一步行动")}</h3>
              <EditableNarrative
                language={language}
                storageKey={`global:${language}:recommended-actions`}
                defaultValue={actionsNarrative}
                className="text-slate-700"
              />
            </div>
          </section>

          <section className="mb-6 grid gap-4 lg:grid-cols-2">
            <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="mb-4 text-base font-semibold text-slate-800">{tr("Followers by Market", "各市场粉丝数")}</h2>
              <div className="h-72 sm:h-80">
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
              <h2 className="mb-4 text-base font-semibold text-slate-800">{tr("Followers by Platform", "各平台粉丝数")}</h2>
              <div className="h-72 sm:h-80">
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
              <h2 className="mb-4 text-base font-semibold text-slate-800">{tr("API Coverage vs Manual Fallback", "API 覆盖与手动数据补充")}</h2>
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
                        {tr(item.name, item.name === "API Connected" ? "API 已连接" : "手动快照")}
                      </span>
                      <span className="text-right">
                        <strong className="block text-sm text-slate-900">{number(item.value)} {tr("followers", "粉丝")}</strong>
                        <span className="text-xs text-slate-400">{item.accounts} {tr("accounts", "个账号")}</span>
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
                <h2 className="text-base font-semibold text-slate-800">{tr("Account Detail", "账号明细")}</h2>
                <p className="text-xs text-slate-400">{zh ? `${rows.length} 个账号，覆盖 ${markets} 个市场` : `${rows.length} accounts across ${markets} markets`}</p>
              </div>
            </div>
            <div className="overflow-x-auto overscroll-x-contain">
              <table className="report-table w-full min-w-[850px] text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-5 py-3">{tr("Market", "市场")}</th>
                    <th className="px-5 py-3">{tr("Platform", "平台")}</th>
                    <th className="px-5 py-3">{tr("Account", "账号")}</th>
                    <th className="px-5 py-3 text-right">{tr("Followers", "粉丝数")}</th>
                    <th className="px-5 py-3">{tr("Source", "数据来源")}</th>
                    <th className="px-5 py-3">{tr("Updated", "更新时间")}</th>
                    <th className="px-5 py-3 print:hidden">{tr("Dashboard", "仪表盘")}</th>
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
                          {tr(row.source, row.source === "API Connected" ? "API 已连接" : "手动快照")}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-xs text-slate-500">{row.lastUpdated || "—"}</td>
                      <td className="px-5 py-3 print:hidden">
                        <button
                          type="button"
                          onClick={() => navigate(`/country/${row.countryId}`)}
                          className="text-xs font-medium text-blue-600 hover:underline"
                        >
                          {tr("Open", "打开")}
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
