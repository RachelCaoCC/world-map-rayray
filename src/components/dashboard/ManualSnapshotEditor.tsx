import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../hooks/useAuth";
import { useDashboardStore } from "../../store/useStore";
import type { PlatformKey } from "../../types";
import type { ManualAccountSnapshot, ManualPlatformKey } from "../../data/manualSnapshots";
import { manualSnapshotKey } from "../../data/manualSnapshots";

const PLATFORMS: { key: PlatformKey; label: string }[] = [
  { key: "facebook", label: "Facebook" },
  { key: "instagram", label: "Instagram" },
  { key: "youtube", label: "YouTube" },
  { key: "tiktok", label: "TikTok" },
];
const today = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
const inputStyle = "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100";
const formatCount = (n: number) => n.toLocaleString("en-US");

interface Props {
  countryId: string;
  initialPlatform?: PlatformKey;
  onClose: () => void;
}

interface ManualForm {
  platform: ManualPlatformKey;
  accountName: string;
  followers: string;
  totalViews: string;
  capturedAt: string;
}
type HistoryRow = {
  id: string;
  captured_at: string;
  followers: number;
  total_views: number;
  recorded_at: string;
};

function formFrom(snapshot: ManualAccountSnapshot): ManualForm {
  return {
    platform: snapshot.platform,
    accountName: snapshot.accountName,
    followers: String(snapshot.followers),
    totalViews: String(snapshot.totalViews ?? 0),
    capturedAt: snapshot.capturedAt.slice(0, 10),
  };
}

export function ManualSnapshotEditor({ countryId, initialPlatform, onClose }: Props) {
  const { user, isAdmin } = useAuth();
  const country = useDashboardStore(s => s.countries.find(c => c.id === countryId));
  const connections = useDashboardStore(s => s.platformConnections);
  const overrides = useDashboardStore(s => s.manualSnapshotOverrides);
  const getManualSnapshotsForCountry = useDashboardStore(s => s.getManualSnapshotsForCountry);
  const fetchAll = useDashboardStore(s => s.fetchAll);
  const fetchTrendData = useDashboardStore(s => s.fetchTrendData);

  // Automated data cannot be overwritten by an admin-entered snapshot.
  const apiPlatforms = useMemo(() => new Set(connections
    .filter(c => c.countryId === countryId && c.status === "connected")
    .map(c => c.platform)), [connections, countryId]);

  const manualEntries = getManualSnapshotsForCountry(countryId);
  const entryMap = new Map(manualEntries.map(s => [manualSnapshotKey(s), s]));
  for (const snapshot of overrides) {
    if (snapshot.countryId === countryId && snapshot.isHidden) {
      entryMap.set(manualSnapshotKey(snapshot), snapshot);
    }
  }
  const entries = [...entryMap.values()].sort((a, b) =>
    a.platform.localeCompare(b.platform) || a.accountName.localeCompare(b.accountName));
  const firstEditablePlatform = PLATFORMS.find(p => !apiPlatforms.has(p.key))?.key ?? "facebook";

  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [form, setForm] = useState<ManualForm>({
    platform: initialPlatform ?? firstEditablePlatform,
    accountName: "",
    followers: "",
    totalViews: "0",
    capturedAt: today(),
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const selected = selectedKey ? entries.find(s => manualSnapshotKey(s) === selectedKey) : undefined;
  const selectedOverride = selected ? overrides.find(s => manualSnapshotKey(s) === manualSnapshotKey(selected)) : undefined;
  const isAutomated = apiPlatforms.has(form.platform as PlatformKey);

  const select = (snapshot: ManualAccountSnapshot) => {
    setSelectedKey(manualSnapshotKey(snapshot));
    setIsNew(false);
    setForm(formFrom(snapshot));
    setMessage("");
  };

  const chooseNew = () => {
    setSelectedKey(null);
    setIsNew(true);
    setForm({ platform: firstEditablePlatform, accountName: "", followers: "",
      totalViews: "0", capturedAt: today() });
    setHistory([]);
    setMessage("");
  };

  useEffect(() => {
    if (selectedKey || isNew || !entries.length) return;
    const matching = entries.find(s => s.platform === initialPlatform && !apiPlatforms.has(s.platform as PlatformKey));
    const first = matching ?? entries.find(s => !apiPlatforms.has(s.platform as PlatformKey));
    if (first) {
      setSelectedKey(manualSnapshotKey(first));
      setForm(formFrom(first));
    } else {
      setIsNew(true);
      setForm({ platform: firstEditablePlatform, accountName: "",
        followers: "", totalViews: "0", capturedAt: today() });
    }
  }, [selectedKey, isNew, entries.length, initialPlatform, firstEditablePlatform, apiPlatforms]);

  useEffect(() => {
    if (!selected || !selectedOverride?.id) {
      setHistory([]);
      return;
    }
    let active = true;
    async function load() {
      setLoadingHistory(true);
      const { data, error } = await supabase.from("manual_social_history")
        .select("id,captured_at,followers,total_views,recorded_at")
        .eq("snapshot_id", selectedOverride!.id)
        .order("captured_at", { ascending: false }).limit(12);
      if (active) {
        setHistory(error ? [] : (data ?? []) as HistoryRow[]);
        setLoadingHistory(false);
      }
    }
    void load();
    return () => { active = false; };
  }, [selectedKey, selectedOverride?.id, selectedOverride?.capturedAt]);

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setMessage("");
    if (!isAdmin || !user) { setMessage("Admin access is required."); return; }
    if (isAutomated) { setMessage("This platform uses connected API data and cannot be manually changed."); return; }
    const accountName = form.accountName.trim();
    const followers = Number(form.followers);
    const totalViews = form.totalViews.trim() === "" ? 0 : Number(form.totalViews);
    if (!accountName || accountName.length > 200) {
      setMessage("Enter an account name (1–200 characters)."); return;
    }
    if (isNew && entries.some(s => manualSnapshotKey(s) === [countryId, form.platform, accountName.toLowerCase()].join("|"))) {
      setMessage("This account already exists. Select its row to edit instead."); return;
    }
    if (!Number.isSafeInteger(followers) || followers < 0 ||
        !Number.isSafeInteger(totalViews) || totalViews < 0) {
      setMessage("Followers and views must be whole numbers of 0 or more."); return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(form.capturedAt) ||
        Number.isNaN(Date.parse(form.capturedAt)) || form.capturedAt > today()) {
      setMessage("Choose a valid snapshot date (today or earlier)."); return;
    }

    setSaving(true);
    const record = {
      country_id: countryId,
      platform: form.platform,
      account_name: selected && !isNew ? selected.accountName : accountName,
      followers,
      total_views: totalViews,
      captured_at: form.capturedAt,
      is_hidden: false,
      updated_by: user.id,
    };
    const { error } = selectedOverride?.id && !isNew
      ? await supabase.from("manual_social_snapshots").update(record).eq("id", selectedOverride.id)
      : await supabase.from("manual_social_snapshots").upsert(record, {
          onConflict: "country_id,platform,account_name",
        });
    if (error) {
      setMessage("Save failed: " + error.message);
      setSaving(false);
      return;
    }
    await fetchAll();
    await fetchTrendData(countryId);
    setSaving(false);
    setMessage("Saved successfully. Country totals, world map and reports will use the new snapshot.");
    setSelectedKey([countryId, form.platform, record.account_name.toLowerCase()].join("|"));
    setIsNew(false);
  };

  const hideSnapshot = async () => {
    if (!isAdmin || !user || !selected || isAutomated) return;
    if (!window.confirm("Hide this manual account from dashboard totals? Its saved history will be retained.")) return;
    setSaving(true);
    setMessage("");
    const record = {
      country_id: countryId,
      platform: selected.platform,
      account_name: selected.accountName,
      followers: selected.followers,
      total_views: selected.totalViews ?? 0,
      captured_at: selected.capturedAt.slice(0, 10),
      is_hidden: true,
      updated_by: user.id,
    };
    const { error } = selectedOverride?.id
      ? await supabase.from("manual_social_snapshots")
          .update({ is_hidden: true, updated_by: user.id }).eq("id", selectedOverride.id)
      : await supabase.from("manual_social_snapshots").upsert(record, {
          onConflict: "country_id,platform,account_name",
        });
    if (error) setMessage("Could not hide account: " + error.message);
    else {
      await fetchAll();
      await fetchTrendData(countryId);
      setMessage("Account hidden. Select it again and save to restore.");
    }
    setSaving(false);
  };

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="manual-editor-title"
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 p-3 sm:p-6"
      onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
      <div className="flex max-h-[90dvh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <header className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
          <div>
            <h2 id="manual-editor-title" className="text-lg font-bold text-slate-900">
              Manual Data Editor / 手动数据录入
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              {country?.name ?? countryId.toUpperCase()} · Edit manual snapshots only · API-linked platforms are read-only
            </p>
          </div>
          <button type="button" onClick={onClose}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-600 hover:bg-slate-50">
            ✕ Close
          </button>
        </header>

        <div className="grid min-h-0 flex-1 overflow-y-auto md:grid-cols-[minmax(220px,0.85fr)_minmax(0,1.4fr)]">
          <aside className="border-b border-slate-200 bg-slate-50 p-4 md:border-b-0 md:border-r">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h3 className="text-sm font-bold text-slate-800">Accounts / 账号</h3>
              {isAdmin && <button type="button" onClick={chooseNew} className="rounded-lg bg-blue-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-blue-700">+ Add</button>}
            </div>
            <div className="space-y-2">
              {entries.map(s => {
                const key = manualSnapshotKey(s);
                const hidden = overrides.find(x => manualSnapshotKey(x) === key)?.isHidden;
                const api = apiPlatforms.has(s.platform as PlatformKey);
                return <button key={key} type="button" onClick={() => select(s)}
                  className={["w-full rounded-xl border px-3 py-2 text-left transition",
                    selectedKey === key && !isNew ? "border-blue-400 bg-white shadow-sm" : "border-slate-200 bg-white/60 hover:border-slate-300"].join(" ")}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-blue-700">{s.platform}</span>
                    <span className={api ? "text-[10px] text-green-600" : hidden ? "text-[10px] text-amber-700" : "text-[10px] text-slate-500"}>
                      {api ? "API active" : hidden ? "Hidden" : "Manual"}
                    </span>
                  </div>
                  <p className="mt-1 truncate text-sm font-semibold text-slate-800">{s.accountName}</p>
                  <p className="mt-1 text-xs text-slate-500">{formatCount(s.followers)} followers · {s.capturedAt.slice(0, 10)}</p>
                </button>;
              })}
              {!entries.length && <p className="rounded-lg border border-dashed p-4 text-xs text-slate-500">No manual accounts yet.</p>}
            </div>
          </aside>

          <section className="min-w-0 p-5">
            <h3 className="text-base font-semibold text-slate-900">{isNew ? "Add manual account / 新增账号" : "Update snapshot / 更新数据"}</h3>
            <p className="mt-1 text-xs text-slate-500">
              Changes are saved to Supabase and become visible in all dashboards.
            </p>
            <form onSubmit={event => void onSubmit(event)} className="mt-5 space-y-4">
              <div>
                <label htmlFor="manual-platform" className="mb-1 block text-xs font-semibold text-slate-600">Platform / 平台</label>
                <select id="manual-platform" className={inputStyle} value={form.platform} disabled={!isNew || !isAdmin}
                  onChange={event => setForm(s => ({ ...s, platform: event.target.value as PlatformKey }))}>
                  {PLATFORMS.map(p => <option key={p.key} value={p.key} disabled={apiPlatforms.has(p.key)}>{p.label}{apiPlatforms.has(p.key) ? " (API connected)" : ""}</option>)}
                  {!isNew && form.platform === "x" && <option value="x">X / Twitter (legacy)</option>}
                </select>
              </div>
              <div>
                <label htmlFor="manual-account" className="mb-1 block text-xs font-semibold text-slate-600">Account name / 账号名称</label>
                <input id="manual-account" className={inputStyle} maxLength={200}
                  value={form.accountName} disabled={!isNew || !isAdmin} required
                  onChange={event => setForm(s => ({ ...s, accountName: event.target.value }))}
                  placeholder="e.g. iFLYTEK USA" />
                {!isNew && <p className="mt-1 text-[11px] text-slate-400">To change the account identity, create a new entry and hide the old one.</p>}
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="manual-followers" className="mb-1 block text-xs font-semibold text-slate-600">Followers / 粉丝数</label>
                  <input id="manual-followers" type="number" min={0} step={1} required inputMode="numeric"
                    className={inputStyle} value={form.followers} disabled={!isAdmin || isAutomated}
                    onChange={event => setForm(s => ({ ...s, followers: event.target.value }))} />
                </div>
                <div>
                  <label htmlFor="manual-views" className="mb-1 block text-xs font-semibold text-slate-600">Views (optional) / 观看量</label>
                  <input id="manual-views" type="number" min={0} step={1} inputMode="numeric"
                    className={inputStyle} value={form.totalViews} disabled={!isAdmin || isAutomated}
                    onChange={event => setForm(s => ({ ...s, totalViews: event.target.value }))} />
                </div>
              </div>
              <div>
                <label htmlFor="manual-date" className="mb-1 block text-xs font-semibold text-slate-600">Snapshot date / 记录日期</label>
                <input id="manual-date" type="date" max={today()} className={inputStyle}
                  value={form.capturedAt} disabled={!isAdmin || isAutomated} required
                  onChange={event => setForm(s => ({ ...s, capturedAt: event.target.value }))} />
              </div>

              {isAutomated && <div className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-xs text-green-800">
                This platform already uses automatic API data. Manual overrides are disabled to avoid conflicting numbers.
              </div>}
              {message && <p role="status" className="rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-900">{message}</p>}
              {isAdmin && <div className="flex flex-wrap gap-2">
                <button type="submit" disabled={saving || isAutomated}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50">
                  {saving ? "Saving…" : "Save snapshot / 保存"}
                </button>
                {!isNew && selected && !selectedOverride?.isHidden && !isAutomated &&
                  <button type="button" disabled={saving} onClick={() => void hideSnapshot()}
                    className="rounded-lg border border-red-200 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50">
                    Hide account / 隐藏账号
                  </button>}
              </div>}
            </form>

            {!isNew && <div className="mt-6 border-t border-slate-200 pt-4">
              <h4 className="text-sm font-semibold text-slate-800">Saved History / 历史记录</h4>
              {loadingHistory && <p className="mt-2 text-xs text-slate-500">Loading…</p>}
              {!loadingHistory && !history.length && <p className="mt-2 text-xs text-slate-500">
                No saved revisions yet. The first manual save starts the history.
              </p>}
              {!!history.length && <div className="mt-2 max-h-44 overflow-y-auto rounded-lg border border-slate-200">
                {history.map(row => <div key={row.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-3 py-2 text-xs text-slate-600">
                  <span>{row.captured_at}</span>
                  <strong className="text-slate-900">{formatCount(row.followers)} followers</strong>
                  <span>{formatCount(row.total_views)} views</span>
                </div>)}
              </div>}
            </div>}
          </section>
        </div>
      </div>
    </div>
  );
}
