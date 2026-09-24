// reconnect-account
// POST { connectionId: string }
// Attempts token refresh or returns a new OAuth URL for re-auth.

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { getServiceClient } from "../_shared/supabase-client.ts";
import { refreshFacebookToken, refreshYouTubeToken, refreshInstagramToken } from "../_shared/platform-apis.ts";
import { decryptToken, encryptToken } from "../_shared/crypto.ts";
import { handleCors, corsHeaders } from "../_shared/cors.ts";

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

    const now = new Date().toISOString();

    if (conn.refresh_token) {
      const refreshToken = decryptToken(conn.refresh_token);
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
      }

      if (refreshed) {
        await supabase.from("platform_connections").update({
          access_token: encryptToken(refreshed.accessToken),
          refresh_token: refreshed.refreshToken ? encryptToken(refreshed.refreshToken) : conn.refresh_token,
          token_expires_at: refreshed.expiresAt ?? null,
          status: "connected",
          last_synced_at: now,
        }).eq("id", connectionId);

        await supabase.from("audit_log").insert({
          action: "reconnect", actor: "System",
          country_id: conn.country_id, platform: conn.platform,
          details: `Token refreshed for "${conn.account_name}"`,
        });

        return new Response(JSON.stringify({ ok: true, method: "refresh" }), { headers });
      }
    }

    // Refresh failed — return OAuth URL for re-auth
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const state = JSON.stringify({ platform: conn.platform, countryId: conn.country_id });
    const redirectUri = `${SUPABASE_URL}/functions/v1/oauth-callback`;

    const oauthUrls: Record<string, string> = {
      facebook: `https://www.facebook.com/v19.0/dialog/oauth?client_id=${Deno.env.get("FACEBOOK_APP_ID")}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=pages_read_engagement,pages_show_list,read_insights&state=${encodeURIComponent(state)}`,
      instagram: `https://www.facebook.com/v19.0/dialog/oauth?client_id=${Deno.env.get("FACEBOOK_APP_ID")}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=instagram_basic,instagram_manage_insights&state=${encodeURIComponent(state)}`,
      youtube: `https://accounts.google.com/o/oauth2/v2/auth?client_id=${Deno.env.get("YOUTUBE_CLIENT_ID")}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=https://www.googleapis.com/auth/youtube.readonly&response_type=code&access_type=offline&prompt=consent&state=${encodeURIComponent(state)}`,
      tiktok: `https://www.tiktok.com/v2/auth/authorize/?client_key=${Deno.env.get("TIKTOK_APP_ID")}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${encodeURIComponent("user.info.basic,user.info.stats,user.info.profile,video.list")}&state=${encodeURIComponent(state)}&disable_auto_auth=1`,
    };

    return new Response(JSON.stringify({
      ok: false, method: "reauth_required",
      oauthUrl: oauthUrls[conn.platform] ?? null,
    }), { headers });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers });
  }
});
