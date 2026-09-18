// Platform API fetchers
// Each returns a normalized { followers, totalViews } shape.
// All functions handle errors gracefully — return null on failure.

export interface PlatformStats {
  followers: number;
  totalViews: number;
  accountName?: string;
  error?: string;
}

const GRAPH_API = "https://graph.facebook.com/v24.0";

type GraphPage<T> = {
  data?: T[];
  paging?: { next?: string };
  error?: { message?: string };
};

async function fetchGraphJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  const text = await res.text();
  let data: T & { error?: { message?: string } };
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`Meta API returned invalid JSON: ${text.substring(0, 200)}`);
  }
  if (!res.ok || data.error) {
    throw new Error(data.error?.message ?? `Meta API HTTP ${res.status}`);
  }
  return data;
}

async function fetchAllGraphPages<T>(initialUrl: string): Promise<T[]> {
  const items: T[] = [];
  let next: string | undefined = initialUrl;
  // The cap prevents a malformed paging response from looping forever while
  // still allowing up to 10,000 media objects at a page size of 100.
  for (let page = 0; next && page < 100; page++) {
    const result: GraphPage<T> = await fetchGraphJson<GraphPage<T>>(next);
    items.push(...(result.data ?? []));
    next = result.paging?.next;
  }
  return items;
}

// ─── Facebook Graph API ───
// GET https://graph.facebook.com/v24.0/{page-id}?fields=followers_count,accessToken={token}

export async function fetchFacebookStats(
  accessToken: string,
  pageId: string,
): Promise<PlatformStats | null> {
  try {
    const token = encodeURIComponent(accessToken);
    const data = await fetchGraphJson<Record<string, unknown>>(
      `${GRAPH_API}/${pageId}?fields=followers_count,fan_count,talking_about_count,name&access_token=${token}`,
    );

    return {
      followers: Number(data.followers_count ?? data.fan_count ?? 0),
      // Keep the shared database column for compatibility. The UI labels
      // this Facebook-specific value as People Talking.
      totalViews: Number(data.talking_about_count ?? 0),
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
    const token = encodeURIComponent(accessToken);
    const data = await fetchGraphJson<Record<string, unknown>>(
      `${GRAPH_API}/${igUserId}?fields=followers_count,media_count,name,username&access_token=${token}`,
    );
    const media = await fetchAllGraphPages<{ id: string; media_type?: string }>(
      `${GRAPH_API}/${igUserId}/media?fields=id,media_type&limit=100&access_token=${token}`,
    );

    let totalViews = 0;
    let successfulInsights = 0;
    // Small batches avoid flooding Meta while keeping large accounts within
    // the Edge Function execution window.
    for (let offset = 0; offset < media.length; offset += 10) {
      const batch = media.slice(offset, offset + 10);
      const values = await Promise.all(batch.map(async (item) => {
        // Meta's newer `views` metric and legacy Reels `plays` can contain
        // different historical totals. Query both independently and use the
        // larger available value for this media item so old viral Reels are
        // not lost, while still avoiding double-counting the same content.
        const candidates = await Promise.all(["views", "plays"].map(async (metric) => {
          try {
            const insight = await fetchGraphJson<GraphPage<{ name?: string; values?: Array<{ value?: number }> }>>(
              `${GRAPH_API}/${item.id}/insights?metric=${metric}&access_token=${token}`,
            );
            successfulInsights++;
            const metricData = insight.data?.[0] as {
              values?: Array<{ value?: number }>;
              total_value?: { value?: number };
              value?: number;
            } | undefined;
            return Number(
              metricData?.values?.[0]?.value ??
              metricData?.total_value?.value ??
              metricData?.value ??
              0,
            );
          } catch {
            // Metric availability differs by media type and publication age.
            return null;
          }
        }));
        const available = candidates.filter((value): value is number => value !== null);
        return available.length > 0 ? Math.max(...available) : 0;
      }));
      totalViews += values.reduce((sum, value) => sum + value, 0);
    }

    if (media.length > 0 && successfulInsights === 0) {
      throw new Error("No media view insights were accessible. Reconnect the Instagram account with instagram_manage_insights.");
    }

    return {
      followers: Number(data.followers_count ?? 0),
      totalViews,
      accountName: String(data.username ?? data.name ?? ""),
    };
  } catch (err) {
    return { followers: 0, totalViews: 0, error: `Instagram views fetch failed: ${String(err)}` };
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
// GET user stats, then paginate video.list and sum each public video's views.
// Requires user.info.stats and video.list.

export async function fetchTikTokStats(
  accessToken: string,
  openId: string,
): Promise<PlatformStats | null> {
  try {
    // openId is retained in the shared fetcher signature for compatibility;
    // TikTok resolves the current user from the bearer token.
    void openId;

    const userRes = await fetch(
      "https://open.tiktokapis.com/v2/user/info/?fields=follower_count",
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
    let totalViews = 0;
    let cursor: number | undefined;
    let hasMore = true;

    for (let page = 0; hasMore && page < 100; page++) {
      const videoRes = await fetch(
        "https://open.tiktokapis.com/v2/video/list/?fields=id,view_count",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          // TikTok Display API permits at most 20 videos per page. Continue
          // following the returned cursor so lifetime views still include all
          // public videos rather than only the first page.
          body: JSON.stringify({ max_count: 20, ...(cursor !== undefined ? { cursor } : {}) }),
        },
      );
      const videoData = await videoRes.json() as {
        data?: { videos?: Array<{ view_count?: number }>; cursor?: number; has_more?: boolean };
        error?: { code?: string; message?: string };
      };
      if (!videoRes.ok || videoData.error?.code !== "ok") {
        throw new Error(videoData.error?.message ?? videoData.error?.code ?? `TikTok video.list HTTP ${videoRes.status}`);
      }
      totalViews += (videoData.data?.videos ?? []).reduce(
        (sum, video) => sum + Number(video.view_count ?? 0),
        0,
      );
      hasMore = Boolean(videoData.data?.has_more);
      cursor = videoData.data?.cursor;
    }

    return {
      followers: Number(user.follower_count ?? 0),
      totalViews,
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
