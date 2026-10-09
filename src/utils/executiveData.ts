import type { GlobalReportRow } from "./globalReport";
import type { SheetRows } from "./readSpreadsheet";

export interface ExecutiveAccount extends GlobalReportRow {
  group: string;
  handle?: string;
  profileUrl?: string;
}
export interface MonthlyPoint {
  key: string;
  date: string;
  followers: number;
}
export interface MarketInput {
  id: string;
  population: number | null;
  spend: number | null;
  currency: string;
}
export interface WebsiteInput {
  id: string;
  name: string;
  url: string;
  status: "active" | "planned" | "offline" | "unknown";
  dailyPv: number | null;
  note: string;
}
export interface ExecutiveData {
  accounts: ExecutiveAccount[];
  history: MonthlyPoint[];
  markets: MarketInput[];
  websites: WebsiteInput[];
  period: string;
}
export const DEFAULT_WEBSITES: WebsiteInput[] = [
  { id: "global", name: "Global", url: "https://www.iflytek.com/en/", status: "unknown", dailyPv: null, note: "" },
  { id: "jp", name: "Japan", url: "https://iflytek.co.jp/", status: "unknown", dailyPv: null, note: "" },
  { id: "mena", name: "Middle East", url: "https://iflytek.ae/", status: "unknown", dailyPv: null, note: "" },
  { id: "ainote", name: "AINOTE", url: "https://theainote.com/", status: "unknown", dailyPv: null, note: "" },
  { id: "au", name: "Australia", url: "https://iflytekau.com/", status: "unknown", dailyPv: null, note: "" },
  { id: "kr", name: "South Korea", url: "https://www.iflytekkorea.co.kr/", status: "unknown", dailyPv: null, note: "" },
];
export const EMPTY_EXECUTIVE: ExecutiveData = {
  accounts: [], history: [], markets: [], websites: DEFAULT_WEBSITES, period: "",
};

const safeNum = (v: unknown): number | null => {
  const n = Number(String(v ?? "").replace(/[,\s￥$]/g, ""));
  return String(v ?? "").trim() !== "" && Number.isFinite(n) && n >= 0 ? n : null;
};
const col = (row: Record<string, string>, aliases: string[]) => {
  const byKey = new Map(Object.entries(row).map(([k, v]) => [k.toLowerCase().replace(/[\s_\-\/()]/g, ""), v]));
  return aliases.map(a => byKey.get(a.toLowerCase().replace(/[\s_\-\/()]/g, ""))).find(v => v !== undefined) ?? "";
};
const aliases = {
  country: ["countryId", "country", "market", "region", "国家", "区域", "市场", "国家地区"],
  group: ["group", "series", "business unit", "account group", "系列", "分组"],
  platform: ["platform", "social platform", "平台"],
  account: ["account", "accountName", "username", "账号", "账号名称"],
  followers: ["followers", "followers/subscribers", "follower count", "粉丝", "粉丝数", "订阅数"],
  date: ["date", "month", "capturedAt", "lastUpdated", "月份", "日期", "更新日期"],
};
const COUNTRY_ALIASES: Record<string, string> = {
  "united states": "us", "usa": "us", "美国": "us",
  "japan": "jp", "日本": "jp", "south korea": "kr", "korea": "kr", "韩国": "kr",
  "middle east": "mena", "gcc": "mena", "中东": "mena", "澳大利亚": "au", "australia": "au",
  "thailand": "th", "泰国": "th", "malaysia": "my", "马来西亚": "my",
  "singapore": "sg", "新加坡": "sg", "taiwan": "tw", "台湾": "tw",
  "global": "global", "集团": "global", "集团全球": "global",
  "china": "cn", "中国": "cn",
};
const PLATFORM_ALIASES: Record<string, string> = {
  ig: "instagram", insta: "instagram", fb: "facebook",
  yt: "youtube", tk: "tiktok", twitter: "x", linkedin: "linkedin", li: "linkedin",
};
export const marketId = (value: string) => COUNTRY_ALIASES[value.trim().toLowerCase()] ?? value.trim().toLowerCase();
export const accountKey = (account: Pick<ExecutiveAccount, "countryId" | "platform" | "accountName">) =>
  [account.countryId.toLowerCase(), account.platform.toLowerCase(), account.accountName.trim().toLowerCase()].join("|");
export const numeric = safeNum;

export function mergeAccounts(live: GlobalReportRow[], data: ExecutiveData): ExecutiveAccount[] {
  // Treat a country/platform as a collection of independent accounts.
  // An API connection supersedes a snapshot only when the account identity matches.
  const apiKeys = new Set(live.filter(r => r.source === "API Connected").map(accountKey));
  const importedKeys = new Set(data.accounts.map(accountKey));
  const result = live.filter(r => r.source === "API Connected" || !importedKeys.has(accountKey(r)))
    .map(r => ({ ...r, group: r.countryName })) as ExecutiveAccount[];
  for (const account of data.accounts) {
    if (apiKeys.has(accountKey(account))) continue;
    result.push(account);
  }
  return result;
}

export function importWorkbook(sheets: SheetRows[], previous: ExecutiveData): { data: ExecutiveData; count: number } {
  const next: ExecutiveData = {
    accounts: [...previous.accounts], history: [...previous.history],
    markets: [...previous.markets], websites: [...previous.websites], period: previous.period,
  };
  let imported = 0;
  const now = new Date().toISOString().slice(0, 10);
  for (const sheet of sheets) {
    const type = sheet.name.toLowerCase();
    for (const record of sheet.rows) {
      const country = col(record, aliases.country);
      const platformRaw = col(record, aliases.platform).trim().toLowerCase();
      const platform = PLATFORM_ALIASES[platformRaw] ?? platformRaw;
      const accountName = col(record, aliases.account);
      const followers = safeNum(col(record, aliases.followers));
      const id = marketId(country);

      if ((type.includes("website") || type.includes("官网")) ||
          (!!col(record, ["website", "url", "官网链接"]) && !platform)) {
        const url = col(record, ["url", "website", "website url", "官网链接"]);
        if (!/^https?:\/\//i.test(url)) continue;
        const name = col(record, ["name", "website name", "官网", "网站"]) || country || url;
        const siteId = id || name.toLowerCase();
        const statusRaw = col(record, ["status", "状态"]).toLowerCase();
        const status = ["active", "online", "正常运营", "已上线"].includes(statusRaw) ? "active" :
          ["planned", "planning", "筹备中"].includes(statusRaw) ? "planned" :
          ["offline", "未上线", "closed"].includes(statusRaw) ? "offline" : "unknown";
        const value: WebsiteInput = { id: siteId, name, url, status,
          dailyPv: safeNum(col(record, ["daily pv", "pv", "pageviews", "日均pv"])),
          note: col(record, ["note", "remarks", "备注"]) };
        next.websites = [...next.websites.filter(s => s.id !== siteId), value];
        imported++; continue;
      }
      if (type.includes("market") || type.includes("roi") || type.includes("市场") ||
        (!!col(record, ["population", "人口"]) && !platform)) {
        if (!id) continue;
        const value: MarketInput = {
          id, population: safeNum(col(record, ["population", "population total", "人口"])),
          spend: safeNum(col(record, ["spend", "budget", "investment", "投入", "市场投入"])),
          currency: col(record, ["currency", "币种"]) || "USD",
        };
        next.markets = [...next.markets.filter(m => m.id !== id), value];
        imported++; continue;
      }
      if (!id || !platform || !accountName || followers === null) continue;
      const capturedAt = col(record, aliases.date) || now;
      const account: ExecutiveAccount = {
        countryId: id,
        countryName: col(record, ["countryName", "market name", "国家名称"]) || country.trim() || id.toUpperCase(),
        region: col(record, ["continent", "geography", "洲", "大洲"]) || "",
        group: col(record, aliases.group) || country.trim() || id.toUpperCase(),
        platform: platform as ExecutiveAccount["platform"],
        accountName,
        followers,
        secondaryMetric: safeNum(col(record, ["views", "totalViews", "播放量"])),
        source: "Manual Snapshot",
        lastUpdated: capturedAt,
        handle: col(record, ["handle", "账号handle"]),
        profileUrl: col(record, ["profileUrl", "profile link", "主页链接"]),
      };
      const key = accountKey(account);
      next.accounts = [...next.accounts.filter(a => accountKey(a) !== key), account];
      const point = { key, date: capturedAt, followers };
      next.history = [...next.history.filter(p => !(p.key === key && p.date === capturedAt)), point];
      next.period = capturedAt;
      imported++;
    }
  }
  if (!imported) throw Error("No usable records. Check column headers (Country, Platform, Account, Followers).");
  return { data: next, count: imported };
}

export function downloadCSV(filename: string, grid: Array<Array<string | number | null>>) {
  const csv = grid.map(row => row.map(cell => '"' + String(cell ?? "").replaceAll('"', '""') + '"').join(",")).join("\r\n");
  const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url; link.download = filename; link.click();
  URL.revokeObjectURL(url);
}
