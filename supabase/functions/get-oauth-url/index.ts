// get-oauth-url
// POST { platform, countryId }
// Returns the OAuth authorization URL with client_id from server-side secrets.

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { handleCors, corsHeaders } from "../_shared/cors.ts";
import { getServiceClient } from "../_shared/supabase-client.ts";

const OAUTH_URLS: Record<string, string> = {
  facebook: "https://www.facebook.com/dialog/oauth",
  instagram: "https://www.facebook.com/dialog/oauth",
  youtube: "https://accounts.google.com/o/oauth2/v2/auth",
  tiktok: "https://www.tiktok.com/v2/auth/authorize/",
};

const SCOPES: Record<string, string[]> = {
  facebook: ["pages_show_list", "pages_read_engagement", "read_insights", "business_management"],
  instagram: ["instagram_basic", "instagram_manage_insights", "pages_show_list", "pages_read_engagement", "read_insights"],
  youtube: ["https://www.googleapis.com/auth/youtube.readonly"],
  tiktok: ["user.info.basic", "user.info.stats", "user.info.profile", "video.list"],
};

serve(async (req: Request) => {
  const cors = handleCors(req);
  if (cors) return cors;

  const headers = corsHeaders(req);
  try {
    const supabase = getServiceClient();
    const authorization = req.headers.get("Authorization");
    if (!authorization?.startsWith("Bearer ")) return new Response(JSON.stringify({ error: "Admin sign-in required" }), { status: 401, headers });
    const { data: { user }, error: authError } = await supabase.auth.getUser(authorization.slice(7));
    if (authError || user?.app_metadata?.role !== "admin") return new Response(JSON.stringify({ error: "Admin access required" }), { status: 403, headers });
    const { platform, countryId } = await req.json();
    if (!platform || !countryId) {
      return new Response(JSON.stringify({ error: "platform and countryId required" }), { status: 400, headers });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const redirectUri = `${SUPABASE_URL}/functions/v1/oauth-callback`;
    const scopes = SCOPES[platform] ?? [];
    const state = JSON.stringify({ platform, countryId });

    let authUrl = "";

    if (platform === "facebook" || platform === "instagram") {
      const clientId = Deno.env.get("FACEBOOK_APP_ID") ?? "";
      const params = new URLSearchParams({
        client_id: clientId, redirect_uri: redirectUri,
        scope: scopes.join(","), state, response_type: "code",
      });
      authUrl = `${OAUTH_URLS[platform]}?${params.toString()}`;
    }

    if (platform === "youtube") {
      const clientId = Deno.env.get("YOUTUBE_CLIENT_ID") ?? "";
      const params = new URLSearchParams({
        client_id: clientId, redirect_uri: redirectUri,
        scope: scopes.join(" "), state, response_type: "code",
        access_type: "offline", prompt: "consent",
      });
      authUrl = `${OAUTH_URLS[platform]}?${params.toString()}`;
    }

    if (platform === "tiktok") {
      // TikTok uses Client Key for OAuth initialization instead of App ID
      const clientKey = Deno.env.get("TIKTOK_APP_ID") ?? ""; 
      
      const params = new URLSearchParams({
        client_key: clientKey,       // FIX: Changed from app_id
        redirect_uri: redirectUri,
        response_type: "code",       // FIX: Added mandatory OAuth parameter
        scope: scopes.join(","),     // E.g., "user.info.basic,user.info.stats"
        state: state,
        disable_auto_auth: "1", // Always show authorization so a different market account can sign in
      });
      
      authUrl = `${OAUTH_URLS[platform]}?${params.toString()}`;
    }


    if (!authUrl) {
      return new Response(JSON.stringify({ error: `Unknown platform: ${platform}` }), { status: 400, headers });
    }

    return new Response(JSON.stringify({ ok: true, authUrl }), { headers });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers });
  }
});
