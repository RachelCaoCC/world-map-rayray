// poll-all-accounts
// POST {} — batch syncs all connected accounts + writes daily trend snapshot.
// Auto-refreshes tokens on auth errors.

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { getServiceClient } from "../_shared/supabase-client.ts";
import { fetchPlatformStats, refreshFacebookToken, refreshYouTubeToken, refreshInstagramToken, refreshTikTokToken } from "../_shared/platform-apis.ts";
import { decryptToken, encryptToken } from "../_shared/crypto.ts";
import { handleCors, corsHeaders } from "../_shared/cors.ts";

const MAX_CONCURRENT = 5;
const DELAY_MS = 200;
function delay(ms: number) { return new Promise(r => setTimeout(r, ms)); }

function shouldRefreshSoon(conn: Record<string, unknown>): boolean {
  if (!conn.token_expires_at) return false;
  const expiresAt = new Date(conn.token_expires_at as string).getTime();
  const refreshWindowMs = conn.platform === "tiktok"
    ? 60 * 60 * 1000
    : 7 * 86400000;
  return Number.isFinite(expiresAt) && expiresAt <= Date.now() + refreshWindowMs;
}

function isAuthError(errorMsg: string): boolean {
  const lower = errorMsg.toLowerCase();
  return lower.includes("invalid authentication") ||
    lower.includes("token") && (lower.includes("expired") || lower.includes("invalid")) ||
    lower.includes("unauthorized") ||
    lower.includes("access_token");
}

async function tryRefreshToken(conn: Record<string, unknown>, supabase: ReturnType<typeof getServiceClient>): Promise<boolean> {
  if (!conn.refresh_token) return false;

  const refreshToken = decryptToken(conn.refresh_token as string);
  let refreshed = null;

  switch (conn.platform) {
    case "facebook":
    case "instagram": {
      const appId = Deno.env.get("FACEBOOK_APP_ID") ?? "";
      const appSecret = Deno.env.get("FACEBOOK_APP_SECRET") ?? "";
      refreshed = conn.platform === "instagram"
        ? await refreshInstagramToken(refreshToken, appId, appSecret)
        : await refreshFacebookToken(refreshToken, appId, appSecret);
      break;
    }
    case "youtube": {
      const clientId = Deno.env.get("YOUTUBE_CLIENT_ID") ?? "";
      const clientSecret = Deno.env.get("YOUTUBE_CLIENT_SECRET") ?? "";
      refreshed = await refreshYouTubeToken(refreshToken, clientId, clientSecret);
      break;
    }
    case "tiktok": {
      const clientKey = Deno.env.get("TIKTOK_APP_ID") ?? "";
      const clientSecret = Deno.env.get("TIKTOK_APP_SECRET") ?? "";
      refreshed = await refreshTikTokToken(refreshToken, clientKey, clientSecret);
      break;
    }
    default:
      return false;
  }

  if (!refreshed) return false;

  await supabase.from("platform_connections").update({
    access_token: encryptToken(refreshed.accessToken),
    refresh_token: refreshed.refreshToken ? encryptToken(refreshed.refreshToken) : conn.refresh_token,
    token_expires_at: refreshed.expiresAt ?? null,
    status: "connected",
  }).eq("id", conn.id);

  await supabase.from("audit_log").insert({
    action: "reconnect", actor: "System",
    country_id: conn.country_id as string, platform: conn.platform as string,
    details: `Auto-refreshed token for "${conn.account_name}"`,
  });

  return true;
}

serve(async (req: Request) => {
  const cors = handleCors(req);
  if (cors) return cors;

  const headers = corsHeaders(req);
  try {
    const supabase = getServiceClient();

    const { data: connections, error } = await supabase
      .from("platform_connections")
      .select("*")
      .eq("status", "connected");

    if (error || !connections || connections.length === 0) {
      return new Response(JSON.stringify({ ok: true, synced: 0 }), { headers });
    }

    let synced = 0;
    let failed = 0;

    for (let i = 0; i < connections.length; i += MAX_CONCURRENT) {
      const batch = connections.slice(i, i + MAX_CONCURRENT);
      await Promise.all(batch.map(async (conn: Record<string, unknown>) => {
        try {
          let accessToken = decryptToken(conn.access_token as string);

          // Proactively extend Meta/YouTube tokens seven days before expiry.
          if (shouldRefreshSoon(conn)) {
            const refreshed = await tryRefreshToken(conn, supabase);
            if (refreshed) {
              const { data: freshConn } = await supabase
                .from("platform_connections")
                .select("access_token, refresh_token, token_expires_at")
                .eq("id", conn.id)
                .single();
              if (freshConn) {
                Object.assign(conn, freshConn);
                accessToken = decryptToken(freshConn.access_token);
              }
            }
          }

          let stats = await fetchPlatformStats(
            conn.platform as string, accessToken, conn.external_account_id as string,
          );

          // Auto-refresh on auth errors
          if (stats?.error && isAuthError(stats.error)) {
            const refreshed = await tryRefreshToken(conn, supabase);
            if (refreshed) {
              const { data: freshConn } = await supabase
                .from("platform_connections")
                .select("access_token")
                .eq("id", conn.id)
                .single();
              if (freshConn) {
                accessToken = decryptToken(freshConn.access_token);
                stats = await fetchPlatformStats(conn.platform as string, accessToken, conn.external_account_id as string);
              }
            }
          }

          if (!stats || stats.error) {
            const errorMsg = stats?.error ?? "API returned null";
            await supabase.from("audit_log").insert({
              action: "poll",
              actor: "System",
              country_id: conn.country_id as string,
              platform: conn.platform as string,
              details: `Poll failed for "${conn.account_name}": ${errorMsg}`,
            });
            await supabase.from("platform_connections")
              .update({ status: "error" })
              .eq("id", conn.id);
            failed++;
            return;
          }

          const now = new Date().toISOString();
          const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();
          const { data: oldStats } = await supabase
            .from("account_stats")
            .select("followers, total_views")
            .eq("connection_id", conn.id)
            .gte("synced_at", thirtyDaysAgo)
            .order("synced_at", { ascending: true })
            .limit(1)
            .single();

          const followerGrowth = oldStats && oldStats.followers > 0
            ? ((stats.followers - oldStats.followers) / oldStats.followers) * 100 : 0;
          const viewGrowth = oldStats && oldStats.total_views > 0
            ? ((stats.totalViews - oldStats.total_views) / oldStats.total_views) * 100 : 0;

          const { data: existing } = await supabase
            .from("account_stats")
            .select("id")
            .eq("connection_id", conn.id)
            .order("synced_at", { ascending: false })
            .limit(1)
            .single();

          if (existing) {
            await supabase.from("account_stats").update({
              followers: stats.followers,
              total_views: stats.totalViews,
              follower_growth_pct_30d: Math.round(followerGrowth * 10) / 10,
              view_growth_pct_30d: Math.round(viewGrowth * 10) / 10,
              synced_at: now,
            }).eq("id", existing.id);
          } else {
            await supabase.from("account_stats").insert({
              connection_id: conn.id,
              followers: stats.followers,
              total_views: stats.totalViews,
              follower_growth_pct_30d: Math.round(followerGrowth * 10) / 10,
              view_growth_pct_30d: Math.round(viewGrowth * 10) / 10,
              synced_at: now,
            });
          }

          await supabase.from("platform_connections")
            .update({ last_synced_at: now })
            .eq("id", conn.id);

          await supabase.from("audit_log").insert({
            action: "poll",
            actor: "System",
            country_id: conn.country_id as string,
            platform: conn.platform as string,
            details: `Poll synced "${conn.account_name}" — ${stats.followers.toLocaleString()} followers`,
          });

          synced++;
        } catch { failed++; }
      }));
      if (i + MAX_CONCURRENT < connections.length) await delay(DELAY_MS);
    }

    // Daily trend snapshot — use local date, not UTC
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    console.log("snapshot: today=", today, "connections=", connections.length);
    const { data: latestStats, error: statsErr } = await supabase
      .from("account_stats")
      .select("connection_id, followers, total_views, synced_at");
    console.log("snapshot: latestStats=", latestStats?.length, "error=", statsErr);

    if (latestStats) {
      const latestMap = new Map<string, Record<string, unknown>>();
      for (const row of latestStats) {
        const existing = latestMap.get(row.connection_id as string);
        if (!existing || (row.synced_at as string) > (existing.synced_at as string)) {
          latestMap.set(row.connection_id as string, row);
        }
      }
      const connMap = new Map<string, { country_id: string; platform: string }>();
      for (const conn of connections) {
        connMap.set(conn.id as string, { country_id: conn.country_id as string, platform: conn.platform as string });
      }
      const aggMap = new Map<string, { followers: number; total_views: number }>();
      for (const [connId, stat] of latestMap) {
        const meta = connMap.get(connId);
        if (!meta) { console.log("snapshot: no connMeta for", connId); continue; }
        const key = `${meta.country_id}:${meta.platform}`;
        const existing = aggMap.get(key) ?? { followers: 0, total_views: 0 };
        aggMap.set(key, {
          followers: existing.followers + Number(stat.followers),
          total_views: existing.total_views + Number(stat.total_views),
        });
      }
      console.log("snapshot: aggMap size=", aggMap.size);
      for (const [key, agg] of aggMap) {
        const [countryId, platform] = key.split(":");
        console.log("snapshot: upserting", key, agg);
        const { error: upsertErr } = await supabase.from("trend_snapshots").upsert({
          country_id: countryId, platform, snapshot_date: today,
          followers: agg.followers, total_views: agg.total_views,
        }, { onConflict: "country_id,platform,snapshot_date" });
        if (upsertErr) console.log("snapshot: upsert error", upsertErr);
      }
    }

    return new Response(JSON.stringify({ ok: true, synced, failed }), { headers });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers });
  }
});
