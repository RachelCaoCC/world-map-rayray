// sync-account
// POST { connectionId: string }
// Fetches latest stats from the platform API for one connection.
// Auto-refreshes token on auth errors.

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { getServiceClient } from "../_shared/supabase-client.ts";
import { fetchPlatformStats, refreshFacebookToken, refreshYouTubeToken, refreshInstagramToken, refreshTikTokToken } from "../_shared/platform-apis.ts";
import { decryptToken, encryptToken } from "../_shared/crypto.ts";
import { handleCors, corsHeaders } from "../_shared/cors.ts";

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
    const { connectionId } = await req.json();
    if (!connectionId) {
      return new Response(JSON.stringify({ error: "connectionId required" }), { status: 400, headers });
    }

    const supabase = getServiceClient();
    const authorization = req.headers.get("Authorization");
    if (!authorization?.startsWith("Bearer ")) return new Response(JSON.stringify({ error: "Admin sign-in required" }), { status: 401, headers });
    const { data: { user }, error: authError } = await supabase.auth.getUser(authorization.slice(7));
    if (authError || user?.app_metadata?.role !== "admin") return new Response(JSON.stringify({ error: "Admin access required" }), { status: 403, headers });

    const { data: conn, error: connErr } = await supabase
      .from("platform_connections")
      .select("*")
      .eq("id", connectionId)
      .single();

    if (connErr || !conn) {
      return new Response(JSON.stringify({ error: "Connection not found" }), { status: 404, headers });
    }

    // Refresh seven days before expiry so scheduled polling does not wait for
    // the token to fail. Existing connections without expiry metadata are left unchanged.
    if (shouldRefreshSoon(conn)) {
      const refreshed = await tryRefreshToken(conn, supabase);
      if (!refreshed) {
        await supabase
          .from("platform_connections")
          .update({ status: "token_expired" })
          .eq("id", connectionId);

        await supabase.from("audit_log").insert({
          action: "sync",
          actor: "System",
          country_id: conn.country_id,
          platform: conn.platform,
          details: `Sync skipped — token refresh failed for "${conn.account_name}"`,
        });

        return new Response(JSON.stringify({ ok: false, reason: "token_expired" }), { headers });
      }
      // Re-read connection with new token
      const { data: refreshedConn } = await supabase
        .from("platform_connections")
        .select("*")
        .eq("id", connectionId)
        .single();
      if (refreshedConn) Object.assign(conn, refreshedConn);
    }

    const accessToken = decryptToken(conn.access_token);
    const stats = await fetchPlatformStats(conn.platform, accessToken, conn.external_account_id);

    if (!stats || stats.error) {
      const errorMsg = stats?.error ?? "API returned null";

      // Auto-refresh on auth errors
      if (isAuthError(errorMsg)) {
        const refreshed = await tryRefreshToken(conn, supabase);
        if (refreshed) {
          // Retry with new token
          const newToken = decryptToken(
            (await supabase.from("platform_connections").select("access_token").eq("id", connectionId).single()).data?.access_token ?? ""
          );
          const retryStats = await fetchPlatformStats(conn.platform, newToken, conn.external_account_id);
          if (retryStats && !retryStats.error) {
            // Success after refresh — fall through to stats save below
            return saveStats(supabase, conn, retryStats, headers);
          }
        }
      }

      await supabase
        .from("platform_connections")
        .update({ status: "error" })
        .eq("id", connectionId);

      await supabase.from("audit_log").insert({
        action: "sync",
        actor: "System",
        country_id: conn.country_id,
        platform: conn.platform,
        details: `Sync failed for "${conn.account_name}": ${errorMsg}`,
      });

      return new Response(JSON.stringify({ ok: false, reason: "api_error", error: errorMsg }), { headers });
    }

    return saveStats(supabase, conn, stats, headers);
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers });
  }
});

async function saveStats(
  supabase: ReturnType<typeof getServiceClient>,
  conn: Record<string, unknown>,
  stats: { followers: number; totalViews: number },
  headers: Record<string, string>,
) {
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
    ? ((stats.followers - oldStats.followers) / oldStats.followers) * 100
    : 0;

  const { data: existing } = await supabase
    .from("account_stats")
    .select("id, total_views")
    .eq("connection_id", conn.id)
    .order("synced_at", { ascending: false })
    .limit(1)
    .single();

  // For Instagram: media insights return lifetime totals directly
  const finalViews = stats.totalViews;

  const viewGrowth = oldStats && oldStats.total_views > 0
    ? ((finalViews - oldStats.total_views) / oldStats.total_views) * 100
    : 0;

    if (existing) {
      await supabase.from("account_stats").update({
        followers: stats.followers,
        total_views: finalViews,
        follower_growth_pct_30d: Math.round(followerGrowth * 10) / 10,
        view_growth_pct_30d: Math.round(viewGrowth * 10) / 10,
        synced_at: now,
      }).eq("id", existing.id);
    } else {
      await supabase.from("account_stats").insert({
        connection_id: conn.id,
        followers: stats.followers,
        total_views: finalViews,
        follower_growth_pct_30d: Math.round(followerGrowth * 10) / 10,
        view_growth_pct_30d: Math.round(viewGrowth * 10) / 10,
        synced_at: now,
      });
    }

  await supabase
    .from("platform_connections")
    .update({ last_synced_at: now, status: "connected" })
    .eq("id", conn.id);

  await supabase.from("audit_log").insert({
    action: "sync",
    actor: "System",
    country_id: conn.country_id as string,
    platform: conn.platform as string,
    details: `Synced "${conn.account_name}" — ${stats.followers.toLocaleString()} followers`,
  });

  return new Response(JSON.stringify({
    ok: true,
    followers: stats.followers,
    totalViews: stats.totalViews,
  }), { headers });
}
