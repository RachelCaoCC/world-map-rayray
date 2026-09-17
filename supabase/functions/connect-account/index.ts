// connect-account
// POST { countryId, platform, externalAccountId, accountName, accessToken, refreshToken }
// Saves a new platform_connection row after the frontend completes the OAuth + account selection.

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { getServiceClient } from "../_shared/supabase-client.ts";
import { encryptToken } from "../_shared/crypto.ts";
import { fetchPlatformStats } from "../_shared/platform-apis.ts";
import { handleCors, corsHeaders } from "../_shared/cors.ts";

serve(async (req: Request) => {
  const cors = handleCors(req);
  if (cors) return cors;

  const headers = corsHeaders(req);
  try {
    const {
      countryId,
      platform,
      externalAccountId,
      accountName,
      username,
      profileUrl,
      accessToken,
      refreshToken,
    } = await req.json();

    if (!countryId || !platform || !externalAccountId || !accessToken) {
      return new Response(
        JSON.stringify({ error: "countryId, platform, externalAccountId, accessToken required" }),
        { status: 400, headers },
      );
    }

    const supabase = getServiceClient();
    const now = new Date().toISOString();

    const { data: existing } = await supabase
      .from("platform_connections")
      .select("id")
      .eq("country_id", countryId)
      .eq("platform", platform)
      .eq("external_account_id", externalAccountId)
      .single();

    if (existing) {
      return new Response(
        JSON.stringify({ error: "Account already connected", connectionId: existing.id }),
        { status: 409, headers },
      );
    }

    const { data: conn, error: insertErr } = await supabase
      .from("platform_connections")
      .insert({
        country_id: countryId,
        platform,
        external_account_id: externalAccountId,
        account_name: accountName ?? externalAccountId,
        username: username ?? null,
        profile_url: profileUrl ?? null,
        status: "connected",
        access_token: encryptToken(accessToken),
        refresh_token: refreshToken ? encryptToken(refreshToken) : null,
        token_expires_at: null,
        last_synced_at: now,
        connected_by: null,
        connected_at: now,
      })
      .select()
      .single();

    if (insertErr || !conn) {
      return new Response(JSON.stringify({ error: insertErr?.message ?? "Insert failed" }), {
        status: 500, headers,
      });
    }

    const stats = await fetchPlatformStats(platform, accessToken, externalAccountId);

    if (stats) {
      await supabase.from("account_stats").insert({
        connection_id: conn.id,
        followers: stats.followers,
        total_views: stats.totalViews,
        follower_growth_pct_30d: 0,
        view_growth_pct_30d: 0,
        synced_at: now,
      });
    }

    await supabase.from("audit_log").insert({
      action: "connect",
      actor: "Admin",
      country_id: countryId,
      platform,
      details: `Connected "${accountName}" via ${platform} OAuth`,
    });

    return new Response(JSON.stringify({
      ok: true,
      connectionId: conn.id,
      followers: stats?.followers ?? 0,
      totalViews: stats?.totalViews ?? 0,
    }), { headers });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers });
  }
});
