// Platform API fetchers
// Each returns a normalized { followers, totalViews } shape.
// All functions handle errors gracefully — return null on failure.

export interface PlatformStats {
  followers: number;
  totalViews: number;
  accountName?: string;
  error?: string;
}

// ─── Facebook Graph API ───
// GET https://graph.facebook.com/v24.0/{page-id}?fields=followers_count,accessToken={token}

export async function fetchFacebookStats(
  accessToken: string,
  pageId: string,
): Promise<PlatformStats | null> {
  try {
    const url =
      `https://graph.facebook.com/v24.0/${pageId}?fields=followers_count,fan_count,talking_about_count,name&access_token=${accessToken}`;
    const res = await fetch(url);
    const text = await res.text();
    let data: Record<string, unknown>;
    try { data = JSON.parse(text); } catch {
      return { followers: 0, totalViews: 0, error: `Facebook API: ${text.substring(0, 200)}` };
    }
    if (!res.ok || data.error) {
      const errObj = data.error as Record<string, string> | undefined;
      const msg = errObj?.message ?? `HTTP ${res.status}`;
      return { followers: 0, totalViews: 0, error: `Facebook API: ${msg}` };
    }

    // Page Activity is available directly from the Page object and does not
    // require crawling every post. Keep it in totalViews for the existing
    // analytics schema; the UI labels Facebook's field accurately.
    const pageActivity = Number(data.talking_about_count ?? 0);

    return {
      followers: Number(data.followers_count ?? data.fan_count ?? 0),
      totalViews: pageActivity,
      accountName: String(data.name ?? ""),
    };
  } catch (err) {
    return { followers: 0, totalViews: 0, error: `Facebook fetch failed: ${String(err)}` };
  }
}

// ─── Instagram Graph API ───
// GET https://graph.facebook.com/v24.0/{ig-user-id}?fields=followers_count,media_count&access_token={token}
// Requires instagram_basic and instagram_manage_insights scopes

export async function fetchInstagramStats(
  accessToken: string,
  igUserId: string,
): Promise<PlatformStats | null> {
  try {
    const url =
      `https://graph.facebook.com/v24.0/${igUserId}?fields=followers_count,media_count,name,username&access_token=${accessToken}`;
    const res = await fetch(url);
    const text = await res.text();
    let data: Record<string, unknown>;
    try { data = JSON.parse(text); } catch {
      return { followers: 0, totalViews: 0, error: `Instagram API: ${text.substring(0, 200)}` };
    }
    if (!res.ok || data.error) {
      const errObj = data.error as Record<string, string> | undefined;
      const msg = errObj?.message ?? `HTTP ${res.status}`;
      return { followers: 0, totalViews: 0, error: `Instagram API: ${msg}` };
    }

    // Store media_count in totalViews for schema compatibility.
    // The frontend labels this value as Media Published, never as views.
    return {
      followers: Number(data.followers_count ?? 0),
      totalViews: Number(data.media_count ?? 0),
      accountName: String(data.username ?? data.name ?? ""),
    };
  } catch (err) {
    return { followers: 0, totalViews: 0, error: `Instagram fetch failed: ${String(err)}` };
  }
}

// ─── YouTube Data API v3 ───
// GET https://www.googleapis.com/youtube/v3/channels?part=statistics&id={channelId}&key={key}
// OR use access_token for OAuth-authenticated requests

export async function fetchYouTubeStats(
  accessToken: string,
  channelId: string,
): Promise<PlatformStats | null> {
  try {
    const url =
      `https://www.googleapis.com/youtube/v3/channels?part=statistics&id=${channelId}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const text = await res.text();
    let data: Record<string, unknown>;
    try { data = JSON.parse(text); } catch {
      return { followers: 0, totalViews: 0, error: `YouTube API: ${text.substring(0, 200)}` };
    }
    if (!res.ok || data.error) {
      const errObj = data.error as Record<string, { message?: string }> | undefined;
      const msg = errObj?.message ?? `HTTP ${res.status}`;
      return { followers: 0, totalViews: 0, error: `YouTube API: ${msg}` };
    }
    const items = data.items as Record<string, Record<string, string>>[] | undefined;
    const stats = items?.[0]?.statistics;
    if (!stats) {
      return { followers: 0, totalViews: 0, error: "YouTube API: channel not found or no statistics" };
    }
    return {
      followers: parseInt(stats.subscriberCount ?? "0", 10),
      totalViews: parseInt(stats.viewCount ?? "0", 10),
    };
  } catch (err) {
    return { followers: 0, totalViews: 0, error: `YouTube fetch failed: ${String(err)}` };
  }
}

// ─── TikTok Display API ───
// GET https://open.tiktokapis.com/v2/user/info/?fields=follower_count,likes_count
//
// Both metrics use the user.info.stats scope. Total Likes is the lifetime
// number of likes received across all public videos and does not require
// the separate video.list permission.

export async function fetchTikTokStats(
  accessToken: string,
  openId: string,
): Promise<PlatformStats | null> {
  try {
    // openId is retained in the shared fetcher signature for compatibility;
    // TikTok resolves the current user from the bearer token.
    void openId;

    const userRes = await fetch(
      "https://open.tiktokapis.com/v2/user/info/?fields=follower_count,likes_count",
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    );
    const userText = await userRes.text();
    let userData: Record<string, unknown>;
    try { userData = JSON.parse(userText); } catch {
      return { followers: 0, totalViews: 0, error: `TikTok API: ${userText.substring(0, 200)}` };
    }

    const userErr = userData.error as Record<string, string> | undefined;
    if (!userRes.ok || userErr?.code !== "ok") {
      const msg = userErr?.message ?? userErr?.code ?? `HTTP ${userRes.status}`;
      return { followers: 0, totalViews: 0, error: `TikTok API: ${msg}` };
    }

    const user = (userData.data as Record<string, Record<string, number>>)?.user ?? {};
    return {
      followers: Number(user.follower_count ?? 0),
      // Keep the existing database column for compatibility. The UI labels
      // this TikTok-specific value as Total Likes, never Total Views.
      totalViews: Number(user.likes_count ?? 0),
    };
  } catch (err) {
    return { followers: 0, totalViews: 0, error: `TikTok fetch failed: ${String(err)}` };
  }
}

// ─── Dispatcher ───

export async function fetchPlatformStats(
  platform: string,
  accessToken: string,
  externalAccountId: string,
): Promise<PlatformStats | null> {
  switch (platform) {
    case "facebook":
      return fetchFacebookStats(accessToken, externalAccountId);
    case "instagram":
      return fetchInstagramStats(accessToken, externalAccountId);
    case "youtube":
      return fetchYouTubeStats(accessToken, externalAccountId);
    case "tiktok":
      return fetchTikTokStats(accessToken, externalAccountId);
    default:
      return null;
  }
}

// ─── Token Refresh ───

interface TokenRefreshResult {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: string;
}

export async function refreshFacebookToken(
  refreshToken: string,
  appId: string,
  appSecret: string,
): Promise<TokenRefreshResult | null> {
  try {
    const url =
      `https://graph.facebook.com/v24.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${appId}&client_secret=${appSecret}&fb_exchange_token=${refreshToken}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    return {
      accessToken: data.access_token,
      // Meta does not issue a separate refresh token. The newly extended
      // access token becomes the credential for the next extension.
      refreshToken: data.access_token,
      expiresAt: new Date(Date.now() + Number(data.expires_in ?? 5184000) * 1000).toISOString(),
    };
  } catch {
    return null;
  }
}

export async function refreshYouTubeToken(
  refreshToken: string,
  clientId: string,
  clientSecret: string,
): Promise<TokenRefreshResult | null> {
  try {
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return {
      accessToken: data.access_token,
      expiresAt: data.expires_in
        ? new Date(Date.now() + data.expires_in * 1000).toISOString()
        : undefined,
    };
  } catch {
    return null;
  }
}

export async function refreshTikTokToken(
  refreshToken: string,
  clientKey: string,
  clientSecret: string,
): Promise<TokenRefreshResult | null> {
  try {
    const res = await fetch("https://open.tiktokapis.com/v2/oauth/token/", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_key: clientKey,
        client_secret: clientSecret,
        grant_type: "refresh_token",
        refresh_token: refreshToken,
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.access_token) return null;
    return {
      accessToken: data.access_token,
      // TikTok may rotate the refresh token; always persist the latest value.
      refreshToken: data.refresh_token ?? refreshToken,
      expiresAt: new Date(Date.now() + Number(data.expires_in ?? 86400) * 1000).toISOString(),
    };
  } catch {
    return null;
  }
}

// Instagram uses the same Meta OAuth — same refresh as Facebook
export const refreshInstagramToken = refreshFacebookToken;
