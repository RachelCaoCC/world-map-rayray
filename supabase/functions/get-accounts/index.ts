// get-accounts
// GET — returns platform connections for the authenticated admin user.

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { getServiceClient } from "../_shared/supabase-client.ts";
import { handleCors, corsHeaders } from "../_shared/cors.ts";

serve(async (req: Request) => {
  const cors = handleCors(req);
  if (cors) return cors;

  const headers = corsHeaders(req);

  // Verify authentication via JWT
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Missing authorization" }), { status: 401, headers });
  }

  const token = authHeader.slice(7);

  try {
    const supabase = getServiceClient();

    // Verify JWT and get user
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), { status: 401, headers });
    }

    // Check admin role
    const isAdmin = user.app_metadata?.role === "admin";
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Admin access required" }), { status: 403, headers });
    }

    // Fetch connections
    const { data: connections, error } = await supabase
      .from("platform_connections")
      .select("id,country_id,platform,external_account_id,account_name,username,profile_url,status,token_expires_at,last_synced_at,connected_by,connected_at")
      .order("connected_at", { ascending: false });

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 500, headers });
    }

    return new Response(JSON.stringify({ ok: true, connections: connections ?? [] }), { headers });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers });
  }
});
