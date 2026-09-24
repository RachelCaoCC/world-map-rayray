import { useState, useMemo, useEffect } from "react";
import { useDashboardStore } from "../store/useStore";
import { usePolling } from "../hooks/usePolling";
import { Layout } from "../components/layout/Layout";
import { PLATFORM_INFO } from "../data/mockData";
import { OAUTH_CONFIGS, tokenExpiryWarning } from "../data/oauthConfig";
import { ConfirmDialog } from "../components/admin/ConfirmDialog";
import type { PlatformKey, ConnectionStatus, AuditLogEntry, AvailableAccount } from "../types";

const ALL_PLATFORMS: PlatformKey[] = ["facebook", "instagram", "youtube", "tiktok"];
const ALL_STATUSES: (ConnectionStatus | "all")[] = ["all", "connected", "token_expired", "error"];

const STATUS_STYLES: Record<ConnectionStatus, { bg: string; text: string; dot: string; label: string }> = {
  connected:   { bg: "bg-emerald-50", text: "text-emerald-700", dot: "bg-emerald-500", label: "Connected" },
  token_expired: { bg: "bg-amber-50", text: "text-amber-700", dot: "bg-amber-500", label: "Token Expired" },
  error:       { bg: "bg-red-50",    text: "text-red-700",    dot: "bg-red-500",    label: "Error" },
};

const FUNC_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;

type WizardStep = "country" | "platform" | "oauth" | "account" | "confirm";

export function PlatformManager() {
  usePolling(15000);
  const countries = useDashboardStore((s) => s.countries);
  const fetchCountries = useDashboardStore((s) => s.fetchCountries);
  const platformConnections = useDashboardStore((s) => s.platformConnections);
  const getAggregatedStats = useDashboardStore((s) => s.getAggregatedStats);
  const connectAccount = useDashboardStore((s) => s.connectAccount);
  const disconnectAccount = useDashboardStore((s) => s.disconnectAccount);
  const reconnectAccount = useDashboardStore((s) => s.reconnectAccount);
  const triggerAccountSync = useDashboardStore((s) => s.triggerAccountSync);
  const fetchAuditLog = useDashboardStore((s) => s.fetchAuditLog);
  const auditLog = useDashboardStore((s) => s.auditLog);

  // Filters
  const [filterCountry, setFilterCountry] = useState<string>("all");
  const [filterPlatform, setFilterPlatform] = useState<PlatformKey | "all">("all");
  const [filterStatus, setFilterStatus] = useState<ConnectionStatus | "all">("all");
  const [expandedCountry, setExpandedCountry] = useState<string | null>(null);

  // Wizard state
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState<WizardStep>("country");
  const [wizardCountry, setWizardCountry] = useState("");
  const [wizardPlatform, setWizardPlatform] = useState<PlatformKey | "">("");
  const [wizardAccounts, setWizardAccounts] = useState<AvailableAccount[]>([]);
  const [wizardSelectedAccount, setWizardSelectedAccount] = useState<AvailableAccount | null>(null);
  const [wizardConnecting, setWizardConnecting] = useState(false);
  const [wizardTokens, setWizardTokens] = useState<{ accessToken: string; refreshToken?: string; expiresIn?: number } | null>(null);
  const [wizardError, setWizardError] = useState<string | null>(null);

  // Disconnect confirm
  const [disconnectTarget, setDisconnectTarget] = useState<{ connectionId: string; accountName: string } | null>(null);
  const [disconnectError, setDisconnectError] = useState<string | null>(null);

  // Loading states for sync/disconnect per connection
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [disconnectingId, setDisconnectingId] = useState<string | null>(null);

  // Audit log panel
  const [showAuditLog, setShowAuditLog] = useState(false);

  // Ensure the full database-backed country list is available even when this route is opened directly.
  useEffect(() => {
    if (countries.length === 0) void fetchCountries();
  }, [countries.length, fetchCountries]);

  // Fetch audit log on mount
  useEffect(() => { void fetchAuditLog(); }, [fetchAuditLog]);

  // Listen for OAuth popup callback via postMessage
  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      // Accept messages from any origin (popup is cross-origin)
      const data = event.data;
      if (!data || typeof data !== "object") return;

      if (data.error) {
        setWizardError(data.error);
        setWizardStep("platform"); // Go back to platform selection
        return;
      }

      if (data.ok && data.accessToken && data.accounts) {
        setWizardTokens({
          accessToken: data.accessToken,
          refreshToken: data.refreshToken ?? undefined,
          expiresIn: data.expiresIn ? Number(data.expiresIn) : undefined,
        });
        setWizardAccounts(
          data.accounts.map((a: { id: string; name: string; username?: string; profileUrl?: string; type: string }) => ({
            id: a.id,
            name: a.name,
            username: a.username,
            profileUrl: a.profileUrl,
            type: a.type,
            metadata: undefined,
          }))
        );
        setWizardStep("account");
      }
    }

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  // Listen for OAuth callback via URL hash redirect
  useEffect(() => {
    function handleHash() {
      const hash = window.location.hash;
      if (!hash.startsWith("#oauth=")) return;
      const encoded = hash.slice(7);
      window.location.hash = "";

      // Restore wizard state from sessionStorage
      const saved = sessionStorage.getItem("oauth_wizard");
      if (saved) {
        sessionStorage.removeItem("oauth_wizard");
        const { country, platform } = JSON.parse(saved);
        setWizardOpen(true);
        setWizardCountry(country);
        setWizardPlatform(platform);
      }

      try {
        const data = JSON.parse(decodeURIComponent(escape(atob(decodeURIComponent(encoded)))));
        if (data.error) {
          setWizardError(data.error);
          setWizardStep("platform");
          return;
        }
        if (data.ok && data.accessToken && data.accounts) {
          setWizardTokens({
            accessToken: data.accessToken,
            refreshToken: data.refreshToken ?? undefined,
          });
          setWizardAccounts(
            data.accounts.map((a: { id: string; name: string; username?: string; profileUrl?: string; type: string }) => ({
              id: a.id, name: a.name, username: a.username, profileUrl: a.profileUrl, type: a.type, metadata: undefined,
            }))
          );
          setWizardStep("account");
        }
      } catch { /* ignore parse errors */ }
    }

    handleHash();
    window.addEventListener("hashchange", handleHash);
    return () => window.removeEventListener("hashchange", handleHash);
  }, []);

  // Build table rows: one per connection
  const rows = useMemo(() => {
    let conns = platformConnections;

    if (filterCountry !== "all") conns = conns.filter(c => c.countryId === filterCountry);
    if (filterPlatform !== "all") conns = conns.filter(c => c.platform === filterPlatform);
    if (filterStatus !== "all") conns = conns.filter(c => c.status === filterStatus);

    return conns.map(conn => ({
      conn,
      country: countries.find(c => c.id === conn.countryId),
      aggregated: getAggregatedStats(conn.countryId, conn.platform),
      stats: useDashboardStore.getState().getAccountStats(conn.id),
    }));
  }, [platformConnections, countries, filterCountry, filterPlatform, filterStatus, getAggregatedStats]);

  const formatTimestamp = (iso: string) => {
    if (!iso) return "—";
    try {
      const diffMs = Date.now() - new Date(iso).getTime();
      const diffMin = Math.floor(diffMs / 60000);
      if (diffMin < 1) return "Just now";
      if (diffMin < 60) return `${diffMin}m ago`;
      const diffHr = Math.floor(diffMin / 60);
      if (diffHr < 24) return `${diffHr}h ago`;
      return `${Math.floor(diffHr / 24)}d ago`;
    } catch { return iso; }
  };

  const formatFullTimestamp = (iso: string) => {
    if (!iso) return "—";
    try {
      return new Date(iso).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" })
        + " " + new Date(iso).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
    } catch { return iso; }
  };

  // ─── Wizard ───

  const openWizard = () => {
    setWizardOpen(true);
    setWizardStep("country");
    setWizardCountry("");
    setWizardPlatform("");
    setWizardAccounts([]);
    setWizardSelectedAccount(null);
    setWizardConnecting(false);
    setWizardTokens(null);
    setWizardError(null);
  };

  const goOAuth = async (platform?: PlatformKey) => {
    setWizardStep("oauth");
    setWizardError(null);

    const plat = platform ?? wizardPlatform;
    const country = wizardCountry;

    try {
      const res = await fetch(`${FUNC_URL}/get-oauth-url`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          platform: plat,
          countryId: country,
        }),
      });

      const data = await res.json();
      if (!data.ok || !data.authUrl) {
        setWizardError(data.error ?? "Failed to generate OAuth URL");
        setWizardStep("platform");
        return;
      }

      // Save wizard state so we can restore after redirect
      sessionStorage.setItem("oauth_wizard", JSON.stringify({
        country: country,
        platform: plat,
      }));

      // Redirect main window to OAuth
      window.location.href = data.authUrl;
    } catch (err) {
      setWizardError(String(err));
      setWizardStep("platform");
    }
  };

  const goConfirm = (account: AvailableAccount) => {
    setWizardSelectedAccount(account);
    setWizardStep("confirm");
  };

  const runConnect = async () => {
    if (!wizardCountry || !wizardPlatform || !wizardSelectedAccount || !wizardTokens) return;
    setWizardConnecting(true);
    try {
      await connectAccount(
        wizardCountry,
        wizardPlatform as PlatformKey,
        wizardSelectedAccount,
        wizardTokens.accessToken,
        wizardTokens.refreshToken,
        wizardTokens.expiresIn,
      );
      setWizardOpen(false);
    } catch (err) {
      console.error("Connect failed:", err);
      setWizardError(String(err));
    } finally {
      setWizardConnecting(false);
    }
  };

  return (
    <Layout showBack backTo="/">
      <div className="h-full overflow-y-auto">
        <div className="max-w-7xl mx-auto px-6 py-6">

          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-slate-800">Manage Connections</h1>
              <p className="text-sm text-slate-500 mt-1">
                Connect multiple social media accounts per country — each OAuth'd account syncs independently
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => { setShowAuditLog(!showAuditLog); if (!showAuditLog) fetchAuditLog(); }}
                className="px-3 py-2 text-sm font-medium text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
              >
                {showAuditLog ? "Hide" : "Show"} Audit Log
              </button>
              <button
                onClick={openWizard}
                className="px-4 py-2 text-sm font-medium text-white bg-accent rounded-lg hover:bg-accent-dark transition-colors flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Connect Account
              </button>
            </div>
          </div>

          {/* Audit log panel */}
          {showAuditLog && (
            <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-4 mb-6 max-h-64 overflow-y-auto">
              <h3 className="text-sm font-semibold text-slate-800 mb-3">Audit Log</h3>
              {auditLog.length === 0 ? (
                <p className="text-xs text-slate-400">No actions recorded yet.</p>
              ) : (
                <div className="space-y-1.5">
                  {auditLog.slice(0, 30).map((entry: AuditLogEntry) => (
                    <div key={entry.id} className="flex items-center gap-3 text-xs">
                      <span className="text-slate-400 font-mono w-32 flex-shrink-0">{formatFullTimestamp(entry.timestamp)}</span>
                      <span className={`px-1.5 py-0.5 rounded font-medium ${
                        entry.action === "connect" ? "bg-emerald-100 text-emerald-700" :
                        entry.action === "disconnect" ? "bg-red-100 text-red-700" :
                        entry.action === "reconnect" ? "bg-amber-100 text-amber-700" :
                        entry.action === "sync" ? "bg-blue-100 text-blue-700" :
                        "bg-slate-100 text-slate-600"
                      }`}>{entry.action}</span>
                      <span className="text-slate-600">{entry.actor}</span>
                      <span className="text-slate-800 font-medium truncate">{entry.details}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Filters */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-4 mb-4">
            <div className="flex items-center gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Country</label>
                <select value={filterCountry} onChange={(e) => setFilterCountry(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-accent/30">
                  <option value="all">All Countries</option>
                  {countries.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Platform</label>
                <select value={filterPlatform} onChange={(e) => setFilterPlatform(e.target.value as PlatformKey | "all")}
                  className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-accent/30">
                  <option value="all">All Platforms</option>
                  {ALL_PLATFORMS.map(p => <option key={p} value={p}>{PLATFORM_INFO[p].name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Status</label>
                <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value as ConnectionStatus | "all")}
                  className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-accent/30">
                  {ALL_STATUSES.map(s => <option key={s} value={s}>{s === "all" ? "All Statuses" : STATUS_STYLES[s].label}</option>)}
                </select>
              </div>
              <div className="ml-auto text-xs text-slate-400">{rows.length} connected account{rows.length !== 1 ? "s" : ""}</div>
            </div>
          </div>

          {/* Connections grouped by country */}
          <div className="space-y-3">
            {(() => {
              const grouped = new Map<string, typeof rows>();
              for (const row of rows) {
                const key = row.conn.countryId;
                if (!grouped.has(key)) grouped.set(key, []);
                grouped.get(key)!.push(row);
              }

              return Array.from(grouped.entries()).map(([countryId, countryRows]) => {
                const country = countryRows[0].country;
                if (!country) return null;
                const isExpanded = expandedCountry === countryId || expandedCountry === null;

                return (
                  <div key={countryId} className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
                    <button
                      onClick={() => setExpandedCountry(expandedCountry === countryId ? null : countryId)}
                      className="w-full px-4 py-3 flex items-center justify-between bg-slate-50 hover:bg-slate-100 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <span className={`fi fi-${country.id} text-base rounded shadow-sm`} />
                        <div className="text-left">
                          <p className="text-sm font-semibold text-slate-800">{country.name}</p>
                          <p className="text-xs text-slate-500">{country.region}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right text-xs text-slate-500">
                          {countryRows.length} account{countryRows.length !== 1 ? "s" : ""} connected
                        </div>
                        <svg className={`w-4 h-4 text-slate-400 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                          fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                    </button>

                    {isExpanded && (
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-xs text-slate-500 uppercase tracking-wide border-t border-slate-100">
                            <th className="text-left px-4 py-2">Platform</th>
                            <th className="text-left px-4 py-2">Account Name</th>
                            <th className="text-left px-4 py-2">External ID</th>
                            <th className="text-center px-4 py-2">Status</th>
                            <th className="text-right px-4 py-2">Followers</th>
                            <th className="text-right px-4 py-2">Views</th>
                            <th className="text-right px-4 py-2">Last Synced</th>
                            <th className="text-left px-4 py-2">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {countryRows.map(({ conn, stats }) => {
                            const info = PLATFORM_INFO[conn.platform];
                            const statusStyle = STATUS_STYLES[conn.status];
                            const expiryWarning = tokenExpiryWarning(conn.tokenExpiresAt ?? "");
                            const formatNum = (n: number) =>
                              n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1_000 ? `${(n / 1_000).toFixed(0)}K` : n.toString();

                            return (
                              <tr key={conn.id} className="border-t border-slate-50 hover:bg-slate-50/50 transition-colors">
                                <td className="px-4 py-3">
                                  <div className="flex items-center gap-2">
                                    <div className="w-6 h-6 rounded overflow-hidden flex items-center justify-center bg-transparent">
                                      <img src={info.logo} alt={info.name} className="w-full h-full object-contain" />
                                    </div>
                                    <span className="font-medium text-slate-700">{info.name}</span>
                                  </div>
                                </td>
                                <td className="px-4 py-3">
                                  <p className="text-slate-800 font-medium">{conn.accountName}</p>
                                </td>
                                <td className="px-4 py-3">
                                  <span className="text-xs text-slate-400 font-mono">{conn.externalAccountId}</span>
                                </td>
                                <td className="px-4 py-3 text-center">
                                  <div className="flex flex-col items-center gap-1">
                                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full font-medium ${statusStyle.bg} ${statusStyle.text}`}>
                                      <span className={`w-1.5 h-1.5 rounded-full ${statusStyle.dot}`} />
                                      {statusStyle.label}
                                    </span>
                                    {expiryWarning && <span className="text-[10px] text-amber-600 font-medium">{expiryWarning}</span>}
                                  </div>
                                </td>
                                <td className="px-4 py-3 text-right font-medium text-slate-800">{formatNum(stats?.followers ?? 0)}</td>
                                <td className="px-4 py-3 text-right font-medium text-slate-800">{formatNum(stats?.totalViews ?? 0)}</td>
                                <td className="px-4 py-3 text-right text-xs text-slate-500">{formatTimestamp(conn.lastSyncedAt)}</td>
                                <td className="px-4 py-3">
                                  <div className="flex items-center gap-2">
                                    {conn.status === "connected" && (
                                      <>
                                        <button
                                          onClick={async () => { setSyncingId(conn.id); try { await triggerAccountSync(conn.id); } finally { setSyncingId(null); } }}
                                          disabled={syncingId === conn.id}
                                          className="px-2.5 py-1 text-xs font-medium bg-emerald-50 text-emerald-700 rounded-lg hover:bg-emerald-100 transition-colors disabled:opacity-50"
                                        >
                                          {syncingId === conn.id ? "Syncing..." : "Sync"}
                                        </button>
                                        <button onClick={() => { setDisconnectError(null); setDisconnectTarget({ connectionId: conn.id, accountName: conn.accountName }); }}
                                          className="px-2.5 py-1 text-xs font-medium bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors">Disconnect</button>
                                      </>
                                    )}
                                    {conn.status === "token_expired" && (
                                      <button onClick={() => reconnectAccount(conn.id)}
                                        className="px-2.5 py-1 text-xs font-medium bg-amber-50 text-amber-700 rounded-lg hover:bg-amber-100 transition-colors">Reconnect</button>
                                    )}
                                    {conn.status === "error" && (
                                      <>
                                        <button
                                          onClick={async () => { setSyncingId(conn.id); try { await triggerAccountSync(conn.id); } finally { setSyncingId(null); } }}
                                          disabled={syncingId === conn.id}
                                          className="px-2.5 py-1 text-xs font-medium bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors disabled:opacity-50"
                                        >
                                          {syncingId === conn.id ? "Retrying..." : "Retry"}
                                        </button>
                                        <button onClick={() => { setDisconnectError(null); setDisconnectTarget({ connectionId: conn.id, accountName: conn.accountName }); }}
                                          className="px-2.5 py-1 text-xs font-medium text-slate-500 rounded-lg hover:bg-slate-100 transition-colors">Disconnect</button>
                                      </>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    )}
                  </div>
                );
              });
            })()}

            {rows.length === 0 && (
              <div className="bg-white rounded-xl shadow-sm border border-slate-100 py-12 text-center text-sm text-slate-400">
                No connections match the current filters.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ─── Connect Account Wizard ─── */}
      {wizardOpen && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => !wizardConnecting && setWizardOpen(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden">

            <div className="px-6 py-4 border-b border-slate-100">
              <h3 className="text-lg font-semibold text-slate-800">Connect Account</h3>
              <p className="text-xs text-slate-500 mt-1">
                Step {["country", "platform", "oauth", "account", "confirm"].indexOf(wizardStep) + 1} of 5
              </p>
            </div>

            <div className="flex px-6 pt-4 gap-1">
              {(["country", "platform", "oauth", "account", "confirm"] as WizardStep[]).map((step, i) => (
                <div key={step} className="flex-1 relative">
                  <div className={`h-1 rounded-full ${i <= ["country", "platform", "oauth", "account", "confirm"].indexOf(wizardStep) ? "bg-accent" : "bg-slate-200"}`} />
                  <span className="text-[9px] text-slate-400 mt-1 block">{["Country", "Platform", "Auth", "Account", "Confirm"][i]}</span>
                </div>
              ))}
            </div>

            <div className="p-6 max-h-[60vh] overflow-y-auto">
              {/* Step 1: Country */}
              {wizardStep === "country" && (
                <div>
                  <h4 className="text-sm font-medium text-slate-800 mb-3">Select Country/Region</h4>
                  {wizardError && (
                    <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2 mb-3">{wizardError}</p>
                  )}
                  <div className="grid grid-cols-2 gap-2 max-h-60 overflow-y-auto">
                    {countries.map(c => (
                      <button key={c.id} onClick={() => { setWizardCountry(c.id); setWizardStep("platform"); setWizardError(null); }}
                        className="flex items-center gap-2 p-3 rounded-lg border border-slate-200 hover:border-accent hover:bg-accent/5 text-left transition-all">
                        <span className={`fi fi-${c.flagCode || c.id} text-base rounded shadow-sm`} />
                        <div>
                          <p className="text-sm font-medium text-slate-800">{c.name}</p>
                          <p className="text-xs text-slate-400">{c.region}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Step 2: Platform */}
              {wizardStep === "platform" && (
                <div>
                  <h4 className="text-sm font-medium text-slate-800 mb-3">Select Platform</h4>
                  {wizardError && (
                    <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2 mb-3">{wizardError}</p>
                  )}
                  <div className="space-y-2">
                    {ALL_PLATFORMS.map(p => {
                      const config = OAUTH_CONFIGS[p];
                      const info = PLATFORM_INFO[p];
                      return (
                        <button key={p} onClick={() => { setWizardPlatform(p); goOAuth(p); }}
                          className="w-full flex items-center gap-3 p-4 rounded-lg border border-slate-200 hover:border-accent hover:bg-accent/5 text-left transition-all">
                          <div className="w-10 h-10 rounded-xl overflow-hidden flex items-center justify-center bg-transparent flex-shrink-0">
                            <img src={info.logo} alt={info.name} className="w-full h-full object-contain" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-slate-800">{info.name}</p>
                            <p className="text-xs text-slate-500 mt-0.5">{config.description}</p>
                            <div className="flex flex-wrap gap-1 mt-1.5">
                              {config.scopes.map(s => (
                                <span key={s} className="px-1.5 py-0.5 text-[10px] bg-slate-100 text-slate-500 rounded font-mono">{s}</span>
                              ))}
                            </div>
                            {config.requiresLinkedAccount && (
                              <p className="text-[10px] text-amber-600 mt-1">⚠ {config.linkedAccountNote}</p>
                            )}
                          </div>
                          <svg className="w-5 h-5 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Step 3: OAuth — waiting for popup */}
              {wizardStep === "oauth" && (
                <div className="flex flex-col items-center py-8">
                  <svg className="w-12 h-12 text-accent animate-spin mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  <p className="text-sm font-medium text-slate-800">
                    Authenticate with {wizardPlatform ? PLATFORM_INFO[wizardPlatform as PlatformKey].name : ""}...
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    Complete the authentication in the popup window
                  </p>
                  <button onClick={() => { setWizardStep("platform"); }}
                    className="mt-4 px-4 py-2 text-xs font-medium text-slate-500 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors">
                    Cancel
                  </button>
                </div>
              )}

              {/* Step 4: Account picker */}
              {wizardStep === "account" && (
                <div>
                  <h4 className="text-sm font-medium text-slate-800 mb-1">Select Account / Page / Channel</h4>
                  <p className="text-xs text-slate-500 mb-3">
                    Choose which {wizardPlatform ? PLATFORM_INFO[wizardPlatform as PlatformKey].name : ""} account to bind to{" "}
                    {countries.find(c => c.id === wizardCountry)?.name}
                  </p>
                  {wizardAccounts.length === 0 ? (
                    <div className="text-center py-6">
                      <p className="text-sm text-slate-500 mb-3">No accounts found. Make sure you have a {wizardPlatform ? PLATFORM_INFO[wizardPlatform as PlatformKey].name : ""} account with pages/channels.</p>
                      <button onClick={() => setWizardStep("platform")}
                        className="px-4 py-2 text-sm font-medium text-accent bg-accent/10 rounded-lg hover:bg-accent/20 transition-colors">
                        Try Again
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {wizardAccounts.map(account => (
                        <button key={account.id} onClick={() => goConfirm(account)}
                          className="w-full flex items-center gap-3 p-4 rounded-lg border border-slate-200 hover:border-accent hover:bg-accent/5 text-left transition-all">
                          <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center text-slate-500 font-bold text-sm flex-shrink-0">
                            {account.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-slate-800">{account.name}</p>
                            <p className="text-xs text-slate-500">{account.type}</p>
                            {account.metadata && <p className="text-xs text-slate-400 mt-0.5">{account.metadata}</p>}
                          </div>
                          <svg className="w-5 h-5 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Step 5: Confirm */}
              {wizardStep === "confirm" && wizardSelectedAccount && (
                <div>
                  <h4 className="text-sm font-medium text-slate-800 mb-3">Confirm Connection</h4>
                  <div className="bg-slate-50 rounded-xl p-4 mb-4">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center text-slate-500 font-bold text-sm">
                        {wizardSelectedAccount.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-semibold text-slate-800">{wizardSelectedAccount.name}</p>
                        <p className="text-xs text-slate-500">{wizardSelectedAccount.type}</p>
                      </div>
                    </div>
                    <div className="text-xs text-slate-600 space-y-1">
                      <p className="flex items-center gap-1.5">
                        Country:{" "}
                        {wizardCountry && (
                          <span className={`fi fi-${countries.find(c => c.id === wizardCountry)?.flagCode || wizardCountry} rounded shadow-sm`} />
                        )}{" "}
                        {countries.find(c => c.id === wizardCountry)?.name}
                      </p>
                      <p>Platform: {wizardPlatform ? PLATFORM_INFO[wizardPlatform as PlatformKey].name : ""}</p>
                      <p>Account: {wizardSelectedAccount.name} ({wizardSelectedAccount.id})</p>
                    </div>
                  </div>
                  <button onClick={runConnect} disabled={wizardConnecting}
                    className={`w-full py-3 rounded-lg font-medium text-sm transition-colors ${
                      wizardConnecting ? "bg-slate-100 text-slate-400 cursor-not-allowed" : "bg-accent text-white hover:bg-accent-dark"
                    }`}>
                    {wizardConnecting ? (
                      <span className="flex items-center justify-center gap-2">
                        <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        Connecting...
                      </span>
                    ) : `Connect ${wizardSelectedAccount.name}`}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─── Disconnect Confirmation ─── */}
      {disconnectTarget && (
        <ConfirmDialog
          title={`Disconnect "${disconnectTarget.accountName}"?`}
          message={disconnectError
            ? `Could not disconnect: ${disconnectError}`
            : `This will remove this account from the dashboard. Stats from this account will no longer be included in the country's aggregated metrics. You can reconnect at any time.`}
          confirmLabel={disconnectingId === disconnectTarget.connectionId ? "Disconnecting..." : "Disconnect"}
          danger
          disabled={disconnectingId === disconnectTarget.connectionId}
          onConfirm={async () => {
            setDisconnectingId(disconnectTarget.connectionId);
            try {
              await disconnectAccount(disconnectTarget.connectionId);
              setDisconnectTarget(null);
              setDisconnectError(null);
            } catch (error) {
              setDisconnectError(error instanceof Error ? error.message : "Disconnect failed");
            } finally {
              setDisconnectingId(null);
            }
          }}
          onCancel={() => { setDisconnectTarget(null); setDisconnectError(null); }}
        />
      )}
    </Layout>
  );
}
