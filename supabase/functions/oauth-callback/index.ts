// oauth-callback
// GET handler: receives OAuth redirect from platform, exchanges code for tokens,
// fetches available accounts, returns HTML that posts data back to the opener window.

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { getServiceClient } from "../_shared/supabase-client.ts";
import { encryptToken } from "../_shared/crypto.ts";
import { handleCors, corsHeaders } from "../_shared/cors.ts";

const PLATFORM_CONFIG: Record<string, {
  tokenUrl: string;
  getClientId: () => string;
  getClientSecret: () => string;
}> = {
  facebook: {
    tokenUrl: "https://graph.facebook.com/v24.0/oauth/access_token",
    getClientId: () => Deno.env.get("FACEBOOK_APP_ID") ?? "",
    getClientSecret: () => Deno.env.get("FACEBOOK_APP_SECRET") ?? "",
  },
  instagram: {
    tokenUrl: "https://graph.facebook.com/v24.0/oauth/access_token",
    getClientId: () => Deno.env.get("FACEBOOK_APP_ID") ?? "",
    getClientSecret: () => Deno.env.get("FACEBOOK_APP_SECRET") ?? "",
  },
  youtube: {
    tokenUrl: "https://oauth2.googleapis.com/token",
    getClientId: () => Deno.env.get("YOUTUBE_CLIENT_ID") ?? "",
    getClientSecret: () => Deno.env.get("YOUTUBE_CLIENT_SECRET") ?? "",
  },
  tiktok: {
    tokenUrl: "https://open.tiktokapis.com/v2/oauth/token/",
    getClientId: () => Deno.env.get("TIKTOK_APP_ID") ?? "",
    getClientSecret: () => Deno.env.get("TIKTOK_APP_SECRET") ?? "",
  },
};

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
}

async function exchangeCode(
  platform: string,
  code: string,
  redirectUri: string,
): Promise<TokenResponse | null> {
  const config = PLATFORM_CONFIG[platform];
  if (!config) return null;

  const clientId = config.getClientId();
  const clientSecret = config.getClientSecret();

  if (platform === "tiktok") {
    const params = new URLSearchParams({
      client_key: clientId,
      client_secret: clientSecret,
      code,
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
    });
    console.log("TikTok token exchange request started");
    const res = await fetch(config.tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });
    const data = await res.json();
    console.log("TikTok token exchange response:", JSON.stringify(data));
    if (!res.ok || !data.access_token) {
      console.error("TikTok token exchange failed:", data);
      return null;
    }
    return {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_in: data.expires_in,
    };
  }

  const params = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    code,
    redirect_uri: redirectUri,
  });

  if (platform === "youtube") {
    params.append("grant_type", "authorization_code");
  }

  const res = await fetch(config.tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });

  if (!res.ok) return null;
  const data = await res.json();
  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_in: data.expires_in,
  };
}

async function fetchAvailableAccounts(
  platform: string,
  accessToken: string,
): Promise<{ id: string; name: string; type: string }[]> {
  try {
if (platform === "facebook" || platform === "instagram") {
  const res = await fetch(
    `https://graph.facebook.com/v24.0/me/accounts?access_token=${accessToken}`,
  );
  if (!res.ok) return [];
  const data = await res.json();
  const pages = data.data ?? [];

  if (platform === "facebook") {
    return pages.map((p: Record<string, string>) => ({
      id: p.id,
      name: p.name,
      type: "Facebook Page",
    }));
  }

  // platform === "instagram": look up each page's linked IG business account
  const igAccounts = await Promise.all(
    pages.map(async (p: Record<string, string>) => {
      const igRes = await fetch(
        `https://graph.facebook.com/v24.0/${p.id}?fields=instagram_business_account{id,username,name}&access_token=${p.access_token ?? accessToken}`,
      );
      if (!igRes.ok) return null;
      const igData = await igRes.json();
      const igAccount = igData.instagram_business_account;
      if (!igAccount) return null;

      return {
        id: igAccount.id,
        name: igAccount.name ?? igAccount.username ?? p.name,
        username: igAccount.username,
        type: "Instagram Business Account",
        linkedPageId: p.id,
      };
    }),
  );

  return igAccounts.filter(Boolean);
}

    if (platform === "youtube") {
      const res = await fetch(
        "https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&mine=true",
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );
      if (!res.ok) return [];
      const data = await res.json();
      return (data.items ?? []).map((ch: Record<string, Record<string, string>>) => ({
        id: ch.id,
        name: ch.snippet?.title ?? "Unknown Channel",
        type: "YouTube Channel",
      }));
    }

    if (platform === "tiktok") {
      const apiUrl = "https://open.tiktokapis.com/v2/user/info/?fields=display_name,username,open_id,profile_deep_link";
      const res = await fetch(apiUrl, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const text = await res.text();
      let data: Record<string, unknown>;
      try { data = JSON.parse(text); } catch { return []; }
      const err = data.error as Record<string, string> | undefined;
      if (!res.ok || err?.code !== "ok") return [];
      const userData = (data.data as Record<string, Record<string, string>>)?.user;
      if (!userData) return [];
      return [{
        id: userData.open_id,
        name: userData.username
          ? `${userData.display_name ?? "TikTok"} (@${userData.username})`
          : userData.display_name ?? "Unknown Account",
        profileUrl: userData.profile_deep_link,
        type: "TikTok Account",
      }];
    }
  } catch {
    return [];
  }
  return [];
}

function encodePayload(payload: string): string {
  return btoa(unescape(encodeURIComponent(payload)));
}

function returnToOpener(data: Record<string, unknown>, error?: string) {
  const payload = JSON.stringify({ ...data, error: error ?? null });
  const APP_URL = Deno.env.get("APP_URL") ?? "http://localhost:5173";
  const redirectUrl = `${APP_URL}/admin/platforms#oauth=${encodeURIComponent(encodePayload(payload))}`;
  return new Response(null, {
    status: 302,
    headers: { Location: redirectUrl },
  });
}

function returnError(message: string) {
  const APP_URL = Deno.env.get("APP_URL") ?? "http://localhost:5173";
  const payload = JSON.stringify({ error: message });
  const redirectUrl = `${APP_URL}/admin/platforms#oauth=${encodeURIComponent(encodePayload(payload))}`;
  return new Response(null, {
    status: 302,
    headers: { Location: redirectUrl },
  });
}

serve(async (req: Request) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const stateStr = url.searchParams.get("state");
    const errorParam = url.searchParams.get("error");

    // Platform returned an error (user denied access, etc.)
    if (errorParam) {
      return returnError(`Platform returned error: ${errorParam}`);
    }

    if (!code || !stateStr) {
      return returnError("Missing code or state parameter");
    }

    // Parse state — contains platform + countryId
    let state: { platform: string; countryId: string };
    try {
      state = JSON.parse(stateStr);
    } catch {
      return returnError("Invalid state parameter");
    }

    const { platform, countryId } = state;
    if (!platform || !countryId) {
      return returnError("Missing platform or countryId in state");
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const redirectUri = `${SUPABASE_URL}/functions/v1/oauth-callback`;

    // Exchange code for tokens
    let tokens = await exchangeCode(platform, code, redirectUri);
    if (!tokens?.access_token) {
      return returnError("Token exchange failed — check platform credentials");
    }

    // Meta's authorization-code exchange returns a short-lived user token and
    // no conventional refresh_token. Exchange it immediately for a long-lived
    // token, then keep that token as the credential used for future extensions.
    if (platform === "facebook" || platform === "instagram") {
      const appId = Deno.env.get("FACEBOOK_APP_ID") ?? "";
      const appSecret = Deno.env.get("FACEBOOK_APP_SECRET") ?? "";
      const longLivedUrl = new URL("https://graph.facebook.com/v24.0/oauth/access_token");
      longLivedUrl.search = new URLSearchParams({
        grant_type: "fb_exchange_token",
        client_id: appId,
        client_secret: appSecret,
        fb_exchange_token: tokens.access_token,
      }).toString();
      const longLivedRes = await fetch(longLivedUrl);
      const longLivedData = await longLivedRes.json();
      if (!longLivedRes.ok || !longLivedData.access_token) {
        return returnError(`Could not create long-lived Meta token: ${longLivedData.error?.message ?? "unknown error"}`);
      }
      tokens = {
        access_token: longLivedData.access_token,
        refresh_token: longLivedData.access_token,
        expires_in: longLivedData.expires_in,
      };
    }

    // Fetch available accounts
    const accounts = await fetchAvailableAccounts(platform, tokens.access_token);

    // Return data to the opener window
    return returnToOpener({
      ok: true,
      platform,
      countryId,
      accounts,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token ?? null,
      expiresIn: tokens.expires_in ?? null,
    });
  } catch (err) {
    return returnError(String(err));
  }
});