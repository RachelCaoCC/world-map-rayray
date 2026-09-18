// disconnect-account
// POST { connectionId: string }
// Permanently removes one OAuth connection and its cascaded account statistics.

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { getServiceClient } from "../_shared/supabase-client.ts";
import { handleCors, corsHeaders } from "../_shared/cors.ts";

serve(async (req: Request) => {
  const cors = handleCors(req);
  if (cors) return cors;

  const headers = { ...corsHeaders(req), "Content-Type": "application/json" };

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), { status: 401, headers });
    }

    const supabase = getServiceClient();
    const token = authHeader.slice(7);
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Invalid session. Please sign in again." }), { status: 401, headers });
    }

    const isAdmin = user.app_metadata?.role === "admin" || user.user_metadata?.role === "admin";
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Admin access required" }), { status: 403, headers });
    }

    const { connectionId } = await req.json();
    if (!connectionId) {
      return new Response(JSON.stringify({ error: "connectionId required" }), { status: 400, headers });
    }

    const { data: connection, error: lookupError } = await supabase
      .from("platform_connections")
      .select("id, country_id, platform, account_name")
      .eq("id", connectionId)
      .maybeSingle();

    if (lookupError) {
      return new Response(JSON.stringify({ error: lookupError.message }), { status: 500, headers });
    }
    if (!connection) {
      return new Response(JSON.stringify({ error: "Connection not found" }), { status: 404, headers });
    }

    const { error: deleteError } = await supabase
      .from("platform_connections")
      .delete()
      .eq("id", connectionId);

    if (deleteError) {
      return new Response(JSON.stringify({ error: deleteError.message }), { status: 500, headers });
    }

    await supabase.from("audit_log").insert({
      action: "disconnect",
      actor: user.email ?? "Admin",
      country_id: connection.country_id,
      platform: connection.platform,
      details: `Disconnected "${connection.account_name}"`,
    });

    return new Response(JSON.stringify({ ok: true, connectionId }), { headers });
  } catch (err) {
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }), {
      status: 500,
      headers,
    });
  }
});
