import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { Layout } from "../components/layout/Layout";
import { usePolling } from "../hooks/usePolling";
import { useAuth } from "../hooks/useAuth";
import { supabase } from "../lib/supabase";
import { useDashboardStore } from "../store/useStore";
import { buildGlobalReportRows } from "../utils/globalReport";
import { readSpreadsheet } from "../utils/readSpreadsheet";
import {
  accountKey, DEFAULT_WEBSITES, downloadCSV, EMPTY_EXECUTIVE, importWorkbook,
  mergeAccounts, numeric,
} from "../utils/executiveData";
import type {
  ExecutiveAccount, ExecutiveData, MarketInput, WebsiteInput,
} from "../utils/executiveData";

type Language = "en" | "zh";
type Grade = "flagship" | "leader" | "growth" | "needs";
const integer = (n: number) => n.toLocaleString("en-US");
const compact = (n: number) => new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(n);
const safeLink = (url: string) => /^https:\/\//i.test(url) ? url : "#";
const palette = ["#2763e7", "#16a34a", "#f59e0b", "#ef4444"];
const card = "rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5";
const field = "min-w-0 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-800 focus:border-blue-500 focus:outline-none";
const button = "rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50";
const platformName = (name: string) => ({
  instagram: "Instagram", facebook: "Facebook", youtube: "YouTube",
  tiktok: "TikTok", x: "X / Twitter", linkedin: "LinkedIn",
} as Record<string, string>)[name.toLowerCase()] ?? name;
const gradeColor: Record<Grade, string> = {
  flagship: "bg-blue-50 text-blue-700 border-blue-200",
  leader: "bg-green-50 text-green-700 border-green-200",
  growth: "bg-amber-50 text-amber-700 border-amber-200",
  needs: "bg-red-50 text-red-700 border-red-200",
};
const websiteColor: Record<WebsiteInput["status"], string> = {
  active: "text-green-700 bg-green-50", planned: "text-amber-700 bg-amber-50",
  offline: "text-red-700 bg-red-50", unknown: "text-slate-500 bg-slate-100",
};
const gradeLabel: Record<Grade, [string, string]> = {
  flagship: ["Flagship", "旗舰"], leader: ["Leading", "领先"],
  growth: ["Growing", "成长"], needs: ["Needs attention", "待改进"],
};
const parseMonth = (s: string) => {
  const date = new Date(s);
  return Number.isFinite(date.getTime()) ? date.toISOString().slice(0, 10) : s;
};

function section(number: string, en: string, zh: string, detail: string) {
  return (
    <div className="mb-4">
      <div className="flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-600 text-sm font-bold text-white">{number}</span>
        <h2 className="text-lg font-bold text-slate-900">{detail === "zh" ? zh : en}</h2>
        <span className="text-xs text-slate-400">{detail === "zh" ? en : zh}</span>
      </div>
    </div>
  );
}

export function ExecutiveDashboard() {
  usePolling(30000);
  const { isAdmin } = useAuth();
  const [language, setLanguage] = useState<Language>("en");
  const zh = language === "zh";
  const t = (en: string, cn: string) => zh ? cn : en;
  const countries = useDashboardStore(s => s.countries);
  const connections = useDashboardStore(s => s.platformConnections);
  const stats = useDashboardStore(s => s.accountStats);
  const [inputs, setInputs] = useState<ExecutiveData>(EMPTY_EXECUTIVE);
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("");
  const [savedAt, setSavedAt] = useState("");
  const [selected, setSelected] = useState<ExecutiveAccount | null>(null);
  const [trend, setTrend] = useState<Array<{ date: string; followers: number }>>([]);
  const [trendLoading, setTrendLoading] = useState(false);
  const [filter, setFilter] = useState("");
  const [showInputs, setShowInputs] = useState(false);
  const [showWebEdit, setShowWebEdit] = useState(false);

  useEffect(() => {
    let active = true;
    async function load() {
      const { data, error } = await supabase.from("executive_dashboard_data")
        .select("payload,updated_at").eq("id", "global").maybeSingle();
      if (!active) return;
      if (error) setStatus("Database setup required: apply migration 014 to enable shared Excel uploads and market edits.");
      else if (data?.payload && typeof data.payload === "object") {
        const value = data.payload as Partial<ExecutiveData>;
        setInputs({
          accounts: Array.isArray(value.accounts) ? value.accounts : [],
          history: Array.isArray(value.history) ? value.history : [],
          markets: Array.isArray(value.markets) ? value.markets : [],
          websites: Array.isArray(value.websites) ? value.websites : DEFAULT_WEBSITES,
          period: typeof value.period === "string" ? value.period : "",
        });
        setSavedAt(data.updated_at ?? "");
      }
      setReady(true);
    }
    void load();
    return () => { active = false; };
  }, []);

  const liveRows = useMemo(() => buildGlobalReportRows(countries, connections, stats),
    [countries, connections, stats]);
  const accounts = useMemo(() => mergeAccounts(liveRows, inputs), [liveRows, inputs]);
  const totals = useMemo(() => {
    const groups = new Map<string, { id: string; name: string; followers: number; accounts: ExecutiveAccount[] }>();
    const markets = new Map<string, { id: string; name: string; followers: number; accounts: ExecutiveAccount[] }>();
    const platforms = new Map<string, { name: string; followers: number; count: number }>();
    for (const account of accounts) {
      const groupId = account.group.trim() || account.countryName;
      const group = groups.get(groupId) ?? { id: groupId, name: groupId, followers: 0, accounts: [] };
      group.followers += account.followers; group.accounts.push(account); groups.set(groupId, group);
      const region = markets.get(account.countryId) ?? { id: account.countryId, name: account.countryName, followers: 0, accounts: [] };
      region.followers += account.followers; region.accounts.push(account); markets.set(account.countryId, region);
      const key = account.platform;
      const platform = platforms.get(key) ?? { name: platformName(key), followers: 0, count: 0 };
      platform.followers += account.followers; platform.count++;
      platforms.set(key, platform);
    }
    const regions = [...groups.values()].sort((a, b) => b.followers - a.followers);
    const geographic = [...markets.values()].sort((a, b) => b.followers - a.followers);
    const platformList = [...platforms.values()].sort((a, b) => b.followers - a.followers);
    return {
      regions, geographic, platformList,
      followers: accounts.reduce((sum, a) => sum + a.followers, 0),
      apiAccounts: accounts.filter(a => a.source === "API Connected").length,
      manualAccounts: accounts.filter(a => a.source !== "API Connected").length,
    };
  }, [accounts]);

  const gradeFor = (n: number, count: number, name: string): Grade => {
    if (/global|全球|集团/i.test(name) && count >= 3) return "flagship";
    if (n >= 20000 && count >= 2) return "leader";
    if (n >= 5000) return "growth";
    return "needs";
  };

  const recommendations = useMemo(() => {
    const share = totals.followers ? (totals.regions.slice(0, 3).reduce((s, r) => s + r.followers, 0) / totals.followers * 100) : 0;
    const low = accounts.filter(a => a.followers <= 10);
    const manual = totals.followers ? accounts.filter(a => a.source !== "API Connected").reduce((s, a) => s + a.followers, 0) / totals.followers * 100 : 0;
    const strongest = totals.regions[0];
    const weakest = totals.regions.filter(r => r.followers > 0).slice(-1)[0];
    return [
      { tag: t("Coverage", "覆盖"), kind: "growth" as Grade,
        title: t("Scale is not evenly distributed", "粉丝规模分布不均"),
        body: zh
          ? "前三大区域 / 系列占已记录粉丝的 " + share.toFixed(1) + "%；建议同时评估长尾市场的内容和账号覆盖。"
          : "The top three groups account for " + share.toFixed(1) + "% of recorded followers. Review content and account coverage in smaller markets." },
      { tag: t("Benchmark", "亮点"), kind: "leader" as Grade,
        title: t("Leading operating benchmark", "领先市场运营标杆"),
        body: strongest ? (zh ? strongest.name + " 以 " + integer(strongest.followers) + " 粉丝领先，可作为其他市场的运营参考。"
          : strongest.name + " leads with " + integer(strongest.followers) + " followers and is a useful operating benchmark.")
          : t("Connect or import account data to identify leaders.", "连接账号或导入数据后可识别领先市场。") },
      { tag: t("Risk", "风险"), kind: "needs" as Grade,
        title: t("Low-volume accounts require review", "低量级账号需要复盘"),
        body: zh
          ? "目前 " + low.length + " 个账号不超过 10 粉丝；" + (weakest?.name ?? "部分市场") + " 也需要复核市场覆盖和发布节奏。"
          : low.length + " accounts have 10 or fewer followers. Review ownership, cadence and coverage in " + (weakest?.name ?? "smaller markets") + "." },
      { tag: t("Data quality", "数据质量"), kind: "needs" as Grade,
        title: t("Improve the data pipeline", "加强账号数据同步"),
        body: zh
          ? "手动数据占记录粉丝的 " + manual.toFixed(1) + "%。优先为大账号接入 API，并按月上传其余台账。"
          : "Manual snapshots account for " + manual.toFixed(1) + "% of recorded followers. Prioritise API connections and monthly ledger updates." },
    ];
  }, [accounts, totals, zh]);

  const allMarketInputs = useMemo(() => {
    const map = new Map(inputs.markets.map(x => [x.id, x]));
    return totals.geographic.map(r => ({
      ...r, input: map.get(r.id) ?? { id: r.id, population: null, spend: null, currency: "USD" } as MarketInput,
    }));
  }, [inputs.markets, totals.geographic]);

  const saveData = async (updated: ExecutiveData) => {
    if (!isAdmin) return;
    setSaving(true);
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      setStatus(t("Sign in as Admin to save.", "请以管理员身份登录后保存。"));
      setSaving(false); return;
    }
    const { error } = await supabase.from("executive_dashboard_data").upsert({
      id: "global", payload: updated, updated_by: user.id,
      updated_at: new Date().toISOString(),
    }, { onConflict: "id" });
    setStatus(error ? t("Save failed: ", "保存失败：") + error.message :
      t("Saved for all dashboard visitors.", "已保存，所有访问看板的用户均可看到更新。"));
    if (!error) setSavedAt(new Date().toISOString());
    setSaving(false);
  };

  const importFile = async (file?: File) => {
    if (!file || !isAdmin) return;
    try {
      const result = importWorkbook(await readSpreadsheet(file), inputs);
      setInputs(result.data);
      setStatus(t("Imported ", "已导入 ") + result.count + t(" records. Saving…", " 条记录，正在保存…"));
      await saveData(result.data);
    } catch (e) {
      setStatus(t("Import failed: ", "导入失败：") + (e instanceof Error ? e.message : String(e)));
    }
  };

  const changeMarket = (id: string, key: "population" | "spend" | "currency", value: string) => {
    setInputs(current => {
      const other = current.markets.filter(m => m.id !== id);
      const old = current.markets.find(m => m.id === id) ?? { id, population: null, spend: null, currency: "USD" };
      return { ...current, markets: [...other, { ...old, [key]: key === "currency" ? value : numeric(value) }] };
    });
  };
  const changeWebsite = (id: string, key: keyof WebsiteInput, value: string) => {
    setInputs(current => ({
      ...current,
      websites: current.websites.map(site => site.id === id ? {
        ...site, [key]: key === "dailyPv" ? numeric(value) : value,
      } : site),
    }));
  };

  useEffect(() => {
    if (!selected) { setTrend([]); return; }
    let active = true;
    const key = accountKey(selected);
    const imported = inputs.history
      .filter(p => p.key === key)
      .map(p => ({ date: parseMonth(p.date), followers: p.followers }));
    const fetchTrend = async () => {
      setTrendLoading(true);
      if (selected.source === "API Connected" && selected.platform !== "x") {
        const { data } = await supabase.from("trend_snapshots")
          .select("snapshot_date,followers").eq("country_id", selected.countryId)
          .eq("platform", selected.platform).order("snapshot_date", { ascending: true }).limit(180);
        if (active) {
          const byDate = new Map<string, number>();
          for (const row of data ?? []) byDate.set(row.snapshot_date,
            (byDate.get(row.snapshot_date) ?? 0) + Number(row.followers ?? 0));
          setTrend([...byDate].map(([date, followers]) => ({ date, followers })));
        }
      } else if (active) setTrend(imported.sort((a, b) => a.date.localeCompare(b.date)));
      if (active) setTrendLoading(false);
    };
    void fetchTrend();
    return () => { active = false; };
  }, [selected, inputs.history]);

  const saveButton = isAdmin && (
    <button type="button" disabled={saving} className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-50"
      onClick={() => void saveData(inputs)}>{saving ? t("Saving…", "保存中…") : t("Save changes", "保存更改")}</button>
  );

  const downloadAccounts = () => downloadCSV("executive-accounts.csv", [
    ["Country", "Group", "Platform", "Account", "Followers", "Date", "Source"],
    ...accounts.map(a => [a.countryName, a.group, a.platform, a.accountName, a.followers, a.lastUpdated, a.source]),
  ]);

  return (
    <Layout showBack backTo="/map" pageScroll>
      <div className="executive-print w-full bg-[#f2f5fb] print:h-auto print:overflow-visible">
        <div className="bg-gradient-to-r from-[#112a59] via-[#193e92] to-[#2459d9] px-4 py-9 text-white sm:px-8">
          <div className="mx-auto flex max-w-7xl flex-wrap items-start justify-between gap-4">
            <div>
              <p className="mb-1 text-xs font-bold tracking-widest text-blue-200">iFLYTEK · GLOBAL SOCIAL INTELLIGENCE</p>
              <h1 className="text-2xl font-bold sm:text-3xl">{t("Executive Dashboard", "海外市场社媒运营汇报看板")}</h1>
              <p className="mt-2 max-w-2xl text-sm text-blue-100">
                {t("Global account performance, market investment and website portfolio in one management view.",
                   "社媒账号、市场投入与官网资产一体化的管理层汇报系统")}
              </p>
              <p className="mt-3 text-xs text-blue-200">
                {t("Snapshot date:", "数据快照：")} {inputs.period || t("latest saved source data", "当前数据源最新记录")}
                {" · "}{t("Shared update:", "共享数据更新：")} {savedAt ? new Date(savedAt).toLocaleString() : t("not uploaded", "尚未上传")}
              </p>
            </div>
            <div className="flex flex-wrap gap-2 print:hidden">
              <Link className="rounded-lg border border-white/30 px-3 py-2 text-xs font-bold hover:bg-white/10" to="/map">← {t("World Map", "全球地图")}</Link>
              <Link className="rounded-lg border border-white/30 px-3 py-2 text-xs font-bold hover:bg-white/10" to="/report">{t("Global Report", "全球报告")}</Link>
              <div className="flex overflow-hidden rounded-lg border border-white/30">
                <button type="button" onClick={() => setLanguage("en")} className={language === "en" ? "bg-white px-3 py-2 text-xs font-bold text-blue-900" : "px-3 py-2 text-xs font-bold"}>EN</button>
                <button type="button" onClick={() => setLanguage("zh")} className={language === "zh" ? "bg-white px-3 py-2 text-xs font-bold text-blue-900" : "px-3 py-2 text-xs font-bold"}>中文</button>
              </div>
              <button type="button" onClick={() => window.print()} className="rounded-lg bg-white px-3 py-2 text-xs font-bold text-blue-900">{t("Print / PDF", "打印 / PDF")}</button>
            </div>
          </div>
        </div>

        <main className="mx-auto max-w-7xl space-y-9 px-3 py-6 pb-14 sm:px-6">
          <div className={card + " print:hidden"}>
            <div className="flex flex-wrap items-center gap-3">
              {isAdmin && (
                <label className="cursor-pointer rounded-lg bg-blue-600 px-3 py-2 text-xs font-bold text-white hover:bg-blue-700">
                  {t("Upload monthly ledger (XLSX / CSV)", "上传月度台账（XLSX / CSV）")}
                  <input type="file" accept=".xlsx,.csv" className="hidden" onChange={e => {
                    void importFile(e.target.files?.[0]);
                    e.currentTarget.value = "";
                  }} />
                </label>
              )}
              <button className={button} type="button" onClick={() => downloadCSV("executive-ledger-template.csv", [
                ["Country", "Group", "Platform", "Account", "Followers", "Date", "Views", "Handle", "ProfileUrl"],
                ["Australia", "Australia", "instagram", "EXAMPLE ONLY - replace me", 0, "2026-10-01", "", "", ""],
              ])}>{t("Download import template", "下载导入模板")}</button>
              <button className={button} type="button" onClick={downloadAccounts}>{t("Export accounts", "导出账号")}</button>
              {isAdmin && <button type="button" className={button} onClick={() => {
                if (!window.confirm(t("Clear imported data and restore defaults?", "确定清除已导入的记录并恢复默认数据吗？"))) return;
                const reset: ExecutiveData = { ...EMPTY_EXECUTIVE };
                setInputs(reset);
                void saveData(reset);
              }}>{t("Restore defaults", "恢复默认数据")}</button>}
              {saveButton}
              {!isAdmin && <span className="text-xs text-slate-500">{t("Read-only: Admin login required to upload and edit.", "只读模式：管理员登录后才可上传和修改。")}</span>}
            </div>
            <p className="mt-3 text-xs text-slate-500">{t(
              "Connected API accounts take precedence over imported snapshots. Excel sheets may be named Accounts, Markets and Websites. Unknown expenses and PV remain blank.",
              "已连接 API 的数据优先于导入快照。Excel 可包含 Accounts、Markets、Websites 工作表；未知费用和 PV 不自动填写。")}</p>
            {status && <p role="status" className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">{status}</p>}
            {!ready && <p className="mt-2 text-xs text-slate-500">{t("Loading shared data…", "正在加载共享数据…")}</p>}
          </div>

          <section>
            <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-5">
              {[
                [t("Total followers", "社媒粉丝总量"), compact(totals.followers), t("Sum of recorded accounts", "所有已记录账号合计")],
                [t("Social accounts", "社媒账号数"), integer(accounts.length), integer(totals.platformList.length) + t(" platforms", " 个平台")],
                [t("Markets / groups", "覆盖区域 / 系列"), integer(totals.regions.length), integer(totals.geographic.length) + t(" geographic markets", " 个地理市场")],
                [t("Websites", "官网数量"), integer(inputs.websites.length), t("Manually verified status", "状态须人工核实")],
                [t("Leading group", "粉丝领先区域"), totals.regions[0]?.name ?? "—", totals.regions[0] ? compact(totals.regions[0].followers) + t(" followers", " 粉丝") : "—"],
              ].map(([title, value, sub]) => (
                <div className={card} key={title}>
                  <p className="text-xs font-semibold text-slate-500">{title}</p>
                  <p className="mt-3 break-words text-2xl font-bold text-[#183b77]">{value}</p>
                  <p className="mt-2 text-xs text-slate-400">{sub}</p>
                </div>
              ))}
            </div>
          </section>

          <section>
            {section("1", "Executive Summary", "核心结论", language)}
            <p className="mb-4 text-xs text-slate-500">{t("Generated from the currently available data; does not infer revenue or engagement.", "根据当前可用数据自动计算，不虚构营收或互动数据。")}</p>
            <div className="grid gap-3 md:grid-cols-2">
              {recommendations.map(item => (
                <article key={item.title} className={card + " border-l-4 " + (
                  item.kind === "leader" ? "border-l-green-500" :
                  item.kind === "growth" ? "border-l-amber-500" : "border-l-red-500")}>
                  <span className={"rounded-md border px-2 py-0.5 text-xs font-bold " + gradeColor[item.kind]}>{item.tag}</span>
                  <h3 className="mt-3 font-semibold text-slate-800">{item.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">{item.body}</p>
                </article>
              ))}
            </div>
          </section>

          <section>
            {section("2", "Region & Series Health", "区域与系列健康度", language)}
            <p className="mb-4 text-xs text-slate-500">{t(
              "Transparent, directional grading: flagship = global group with 3+ accounts; leading = 20k+ followers and 2+ accounts; growing = 5k+; otherwise needs attention. Not an engagement score.",
              "透明的参考分级：旗舰=全球组且至少3个账号；领先=粉丝至少2万且至少2个账号；成长=粉丝至少5000；其余待改进。不是互动率评分。")}</p>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {totals.regions.map(r => {
                const grade = gradeFor(r.followers, r.accounts.length, r.name);
                const max = totals.regions[0]?.followers || 1;
                const idx = ["flagship", "leader", "growth", "needs"].indexOf(grade);
                return (
                  <article className={card} key={r.id}>
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-semibold text-slate-800">{r.name}</h3>
                      <span className={"shrink-0 rounded-md border px-2 py-1 text-[11px] font-semibold " + gradeColor[grade]}>{gradeLabel[grade][zh ? 1 : 0]}</span>
                    </div>
                    <p className="mt-3 text-2xl font-bold text-slate-900">{integer(r.followers)}
                      <span className="ml-1 text-xs font-normal text-slate-500">{t("followers", "粉丝")}</span></p>
                    <p className="mb-3 mt-1 text-xs text-slate-500">{r.accounts.length} {t("accounts", "个账号")} · {new Set(r.accounts.map(a => a.platform)).size} {t("platforms", "个平台")}</p>
                    <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                      <div className="h-2 rounded-full" style={{ width: String(r.followers / max * 100) + "%", background: palette[idx] }} />
                    </div>
                    <p className="mt-3 line-clamp-2 text-xs text-slate-500">{r.accounts.map(a => platformName(a.platform)).filter((a, i, arr) => arr.indexOf(a) === i).join(" · ")}</p>
                  </article>
                );
              })}
            </div>
            {!totals.regions.length && <p className={card}>{t("No accounts available.", "当前没有账号数据。")}</p>}
          </section>

          <section>
            <div className="flex flex-wrap items-center justify-between gap-3">
              {section("3", "Market Investment & ROI", "市场投入产出", language)}
              {isAdmin && <button className={button + " print:hidden"} type="button" onClick={() => setShowInputs(!showInputs)}>{showInputs ? t("Hide input fields", "隐藏输入框") : t("Edit population & spend", "编辑人口与投入")}</button>}
            </div>
            <p className="mb-3 text-xs text-slate-500">{t(
              "Penetration = followers / population × 1,000,000. Cost per existing follower = marketing spend / current followers (not acquisition CPF). Different currencies are not summed.",
              "每百万人粉丝数＝粉丝数÷人口×100万；存量单粉成本＝营销投入÷当前粉丝（不等于新增获客成本）。不同币种不会相加。")}</p>
            <div className={card + " overflow-x-auto"}>
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="border-b bg-slate-50 text-xs text-slate-500"><tr>
                  {[t("Market", "市场"), t("Population", "人口"), t("Followers", "粉丝"), t("Per million", "每百万人粉丝"), t("Spend", "投入"), t("Cost / existing follower", "存量单粉成本")].map(h => <th className="p-3" key={h}>{h}</th>)}
                </tr></thead>
                <tbody>{allMarketInputs.map(r => {
                  const penetr = r.input.population && r.input.population > 0 ? r.followers / r.input.population * 1e6 : null;
                  const cost = r.input.spend !== null && r.followers > 0 ? r.input.spend / r.followers : null;
                  return <tr key={r.id} className="border-b border-slate-100">
                    <td className="p-3 font-semibold text-slate-700">{r.name}</td>
                    <td className="p-3">{isAdmin && showInputs ? <input aria-label={r.name + " population"} className={field + " w-30"} type="number" min="0" value={r.input.population ?? ""} onChange={e => changeMarket(r.id, "population", e.target.value)} /> : r.input.population === null ? "—" : integer(r.input.population)}</td>
                    <td className="p-3 font-medium">{integer(r.followers)}</td>
                    <td className="p-3">{penetr === null ? "—" : integer(Math.round(penetr))}</td>
                    <td className="p-3">{isAdmin && showInputs ? <div className="flex gap-1">
                      <input aria-label={r.name + " spend"} className={field + " w-26"} type="number" min="0" value={r.input.spend ?? ""} onChange={e => changeMarket(r.id, "spend", e.target.value)} />
                      <input aria-label={r.name + " currency"} className={field + " w-14"} value={r.input.currency} onChange={e => changeMarket(r.id, "currency", e.target.value.toUpperCase())} />
                    </div> : r.input.spend === null ? t("Pending", "待填") : r.input.currency + " " + integer(r.input.spend)}</td>
                    <td className="p-3">{cost === null ? "—" : r.input.currency + " " + cost.toFixed(2)}</td>
                  </tr>;
                })}</tbody>
              </table>
              {isAdmin && showInputs && <div className="mt-3 print:hidden">{saveButton}</div>}
            </div>
          </section>

          <section>
            {section("4", "Portfolio Overview", "宏观数据总览", language)}
            <div className="grid gap-4 lg:grid-cols-2">
              <div className={card}>
                <h3 className="mb-4 font-bold text-slate-800">{t("Followers by region / series", "区域与系列粉丝分布")}</h3>
                <div className="h-80 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={totals.regions.slice(0, 12)} layout="vertical" margin={{ left: 15, right: 18 }}>
                      <CartesianGrid stroke="#edf1f7" strokeDasharray="3 3" />
                      <XAxis type="number" tickFormatter={compact} tick={{ fontSize: 10 }} />
                      <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 10 }} />
                      <Tooltip formatter={(value) => integer(Number(value ?? 0))} />
                      <Bar dataKey="followers" name={t("Followers", "粉丝数")} radius={[0, 4, 4, 0]}>
                        {totals.regions.slice(0, 12).map((r, i) => <Cell key={r.id} fill={palette[Math.min(i, 3)]} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div className={card}>
                <h3 className="mb-4 font-bold text-slate-800">{t("Followers and accounts by platform", "各平台粉丝与账号覆盖")}</h3>
                <div className="h-80 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={totals.platformList}>
                      <CartesianGrid stroke="#edf1f7" strokeDasharray="3 3" />
                      <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                      <YAxis yAxisId="a" tickFormatter={compact} tick={{ fontSize: 10 }} />
                      <YAxis yAxisId="b" orientation="right" allowDecimals={false} tick={{ fontSize: 10 }} />
                      <Tooltip formatter={(value) => integer(Number(value ?? 0))} />
                      <Legend />
                      <Bar yAxisId="a" dataKey="followers" fill="#2763e7" name={t("Followers", "粉丝")} />
                      <Bar yAxisId="b" dataKey="count" fill="#93c5fd" name={t("Accounts", "账号")} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </section>

          <section>
            <div className="flex flex-wrap items-center justify-between gap-3">
              {section("5", "Social Accounts", "社媒账号总览", language)}
              <label className={field + " print:hidden"}>
                <span className="sr-only">{t("Filter accounts", "搜索账号")}</span>
                <input className="bg-transparent outline-none" value={filter} onChange={e => setFilter(e.target.value)} placeholder={t("Search market / account…", "搜索区域 / 账号…")} />
              </label>
            </div>
            <p className="mb-4 text-xs text-slate-500">{t(
              "Click an account to inspect recorded history. Imported monthly snapshots show per-account trends; API history may be country-and-platform aggregate.",
              "点击账号查看历史趋势。月度导入可提供单账号趋势；API 历史记录可能是国家与平台的合计数据。")}</p>
            <div className="space-y-5">
              {totals.regions.map(r => {
                const found = r.accounts.filter(a => (r.name + " " + a.accountName + " " + a.platform).toLowerCase().includes(filter.toLowerCase()));
                if (!found.length) return null;
                const grade = gradeFor(r.followers, r.accounts.length, r.name);
                return <div key={r.id}>
                  <div className="mb-3 flex flex-wrap items-center gap-2 border-b border-slate-200 pb-2">
                    <h3 className="font-bold text-[#183b77]">{r.name}</h3>
                    <span className={"rounded px-2 py-0.5 text-[11px] font-semibold " + gradeColor[grade]}>{gradeLabel[grade][zh ? 1 : 0]}</span>
                    <span className="text-xs text-slate-500">{r.accounts.length} {t("accounts", "账号")} · {integer(r.followers)} {t("followers", "粉丝")}</span>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    {found.map(a => <button key={accountKey(a)} type="button" onClick={() => setSelected(a)}
                      className="rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:border-blue-400 hover:shadow-md">
                      <div className="flex items-start justify-between gap-2">
                        <span className="rounded-md bg-blue-100 px-2 py-1 text-[11px] font-bold text-blue-700">{platformName(a.platform)}</span>
                        <span className="text-[10px] text-slate-400">{a.source === "API Connected" ? "API" : t("Snapshot", "快照")}</span>
                      </div>
                      <h4 className="mt-3 truncate text-sm font-semibold text-slate-800">{a.accountName}</h4>
                      <div className="mt-2 text-xl font-bold text-[#183b77]">{integer(a.followers)}</div>
                      <p className="mt-2 text-[11px] text-blue-600">{t("View recorded trend →", "查看历史趋势 →")}</p>
                    </button>)}
                  </div>
                </div>;
              })}
            </div>
          </section>

          <section>
            <div className="flex flex-wrap items-center justify-between gap-3">
              {section("6", "Website Portfolio", "官网资产", language)}
              {isAdmin && <button type="button" className={button + " print:hidden"} onClick={() => setShowWebEdit(!showWebEdit)}>{showWebEdit ? t("Done editing", "收起编辑") : t("Edit websites", "编辑官网")}</button>}
            </div>
            <p className="mb-4 text-xs text-slate-500">{t(
              "Website status and daily PV are manually maintained. A listed URL does not mean uptime has been automatically checked.",
              "官网状态及日均 PV 为人工维护；显示网址不代表已经自动监测可用性。")}</p>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {inputs.websites.map(site => <div className={card} key={site.id}>
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-semibold text-slate-800">{site.name}</h3>
                  <span className={"rounded-md px-2 py-1 text-[11px] font-semibold " + websiteColor[site.status]}>
                    {({ active: t("Active", "正常运营"), planned: t("Planned", "筹备中"), offline: t("Offline", "未上线"), unknown: t("Not verified", "未核实") })[site.status]}
                  </span>
                </div>
                <a href={safeLink(site.url)} target="_blank" rel="noreferrer" className="mt-3 block break-all text-sm text-blue-600 hover:underline">{site.url}</a>
                <p className="mt-3 text-xl font-bold text-[#183b77]">{site.dailyPv === null ? "—" : integer(site.dailyPv)}
                  <span className="ml-1 text-xs font-normal text-slate-500">{t("daily PV", "日均 PV")}</span></p>
                {site.note && <p className="mt-2 text-xs text-slate-500">{site.note}</p>}
                {isAdmin && showWebEdit && <div className="mt-3 grid gap-2 border-t pt-3 print:hidden">
                  <label className="text-xs text-slate-500">{t("Status", "状态")}
                    <select className={field + " ml-2"} value={site.status} onChange={e => changeWebsite(site.id, "status", e.target.value)}>
                      <option value="unknown">{t("Not verified", "未核实")}</option>
                      <option value="active">{t("Active", "正常运营")}</option>
                      <option value="planned">{t("Planned", "筹备中")}</option>
                      <option value="offline">{t("Offline", "未上线")}</option>
                    </select></label>
                  <input className={field} aria-label={site.name + " URL"} value={site.url} onChange={e => changeWebsite(site.id, "url", e.target.value)} placeholder="https://" />
                  <input className={field} type="number" min="0" aria-label={site.name + " PV"} value={site.dailyPv ?? ""} onChange={e => changeWebsite(site.id, "dailyPv", e.target.value)} placeholder={t("Daily PV", "日均 PV")} />
                  <input className={field} aria-label={site.name + " notes"} value={site.note} onChange={e => changeWebsite(site.id, "note", e.target.value)} placeholder={t("Notes", "备注")} />
                </div>}
              </div>)}
            </div>
            {isAdmin && showWebEdit && <div className="mt-3 flex flex-wrap gap-2 print:hidden">
              <button type="button" className={button} onClick={() => {
                const id = "new-" + Date.now();
                setInputs(current => ({ ...current, websites: [...current.websites, {
                  id, name: t("New website", "新官网"), url: "https://", status: "unknown", dailyPv: null, note: "",
                }] }));
              }}>{t("Add website", "添加官网")}</button>
              {saveButton}
            </div>}
          </section>

          <section className={card}>
            {section("7", "Data Governance & Updates", "数据维护与更新", language)}
            <div className="grid gap-3 text-sm text-slate-600 md:grid-cols-3">
              <p><strong className="block text-2xl text-slate-900">{totals.apiAccounts}</strong>{t("API-connected accounts", "API 已连接账号")}</p>
              <p><strong className="block text-2xl text-slate-900">{totals.manualAccounts}</strong>{t("Manual / imported snapshots", "手动 / 导入快照")}</p>
              <p><strong className="block text-2xl text-slate-900">{inputs.history.length}</strong>{t("Stored monthly history points", "已存储的月度历史记录点")}</p>
            </div>
            <p className="mt-4 text-xs leading-relaxed text-slate-500">{t(
              "API data is periodically refreshed by the existing system; Executive imports persist in Supabase after the migration is applied. CSV and XLSX processing happens in your browser. Missing market inputs remain blank.",
              "API 数据沿用现有系统定期同步；执行数据库迁移后，运营台账会保存在 Supabase。CSV / XLSX 在浏览器中解析；缺失的市场数据保持为空。")}</p>
          </section>
        </main>
      </div>

      {selected && <div role="dialog" aria-modal="true" aria-label={t("Account history", "账号趋势")} className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/70 p-4 print:hidden" onClick={() => setSelected(null)}>
        <div className="w-full max-w-2xl rounded-2xl bg-white p-5 shadow-2xl" onClick={e => e.stopPropagation()}>
          <div className="flex items-start justify-between gap-3">
            <div><h2 className="text-lg font-bold text-slate-900">{selected.accountName}</h2>
              <p className="text-xs text-slate-500">{platformName(selected.platform)} · {selected.countryName} · {selected.source}</p></div>
            <button className={button} onClick={() => setSelected(null)} type="button">{t("Close", "关闭")}</button>
          </div>
          <div className="mt-5 h-64">
            {trendLoading ? <p className="text-sm text-slate-500">{t("Loading…", "加载中…")}</p> :
              trend.length < 2 ? <div className="flex h-full items-center justify-center rounded-xl bg-slate-50 text-center text-sm text-slate-500">
                {t("Not enough historical snapshots yet. Import at least two monthly records.", "历史记录不足。至少导入两个月份的账号记录后才能显示趋势。")}
              </div> :
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trend}>
                  <CartesianGrid stroke="#edf1f7" strokeDasharray="3 3" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis tickFormatter={compact} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(value) => integer(Number(value ?? 0))} />
                  <Line type="monotone" dataKey="followers" name={t("Followers", "粉丝")} stroke="#2763e7" strokeWidth={3} dot />
                </LineChart>
              </ResponsiveContainer>}
          </div>
          <p className="mt-3 text-xs text-slate-500">{selected.source === "API Connected"
            ? t("API history represents the country-platform series, not necessarily this individual account.", "API 历史趋势为国家-平台聚合值，不一定属于单独账号。")
            : t("Trend uses uploaded historical snapshots for this exact account.", "趋势采用该账号的月度导入快照。")}</p>
        </div>
      </div>}
    </Layout>
  );
}
