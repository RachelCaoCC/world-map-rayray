// get-live-stats
// POST { countryId: string }
// Returns real-time follower/view counts directly from platform APIs.

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { getServiceClient } from "../_shared/supabase-client.ts";
import { fetchPlatformStats } from "../_shared/platform-apis.ts";
import { decryptToken } from "../_shared/crypto.ts";
import { handleCors, corsHeaders } from "../_shared/cors.ts";

serve(async (req: Request) => {
  const cors = handleCors(req);
  if (cors) return cors;

  const headers = corsHeaders(req);
  try {
    const { countryId } = await req.json();
    if (!countryId) {
      return new Response(JSON.stringify({ error: "countryId required" }), { status: 400, headers });
    }

    const supabase = getServiceClient();

    const { data: connections, error } = await supabase
      .from("platform_connections")
      .select("*")
      .eq("country_id", countryId)
      .eq("status", "connected");

    if (error || !connections || connections.length === 0) {
      return new Response(JSON.stringify({ ok: true, platforms: [] }), { headers });
    }

    const results = await Promise.all(
      connections.map(async (conn: Record<string, unknown>) => {
        try {
          const accessToken = decryptToken(conn.access_token as string);
          const stats = await fetchPlatformStats(
            conn.platform as string,
            accessToken,
            conn.external_account_id as string,
          );
          if (!stats || stats.error) return null;
          return {
            platform: conn.platform,
            accountName: conn.account_name,
            followers: stats.followers,
            totalViews: stats.totalViews,
          };
        } catch {
          return null;
        }
      })
    );

    const platforms = results.filter(Boolean);

    return new Response(JSON.stringify({ ok: true, platforms }), { headers });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers });
  }
});
