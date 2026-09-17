// CORS helpers for Edge Functions

const BASE_ORIGINS = [
  "http://localhost:5173",
  "http://localhost:3000",
  "https://movsuqrmhmdetgakglwu.supabase.co",
];

function getAllowedOrigins(): string[] {
  const extra = Deno.env.get("ALLOWED_ORIGINS") ?? "";
  const extraList = extra.split(",").map(s => s.trim()).filter(Boolean);
  return [...BASE_ORIGINS, ...extraList];
}

export function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("origin") ?? "";
  const allowed = getAllowedOrigins();
  const matched = allowed.find(o => origin === o) ?? allowed[0];
  return {
    "Access-Control-Allow-Origin": matched,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  };
}

export function handleCors(req: Request): Response | null {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders(req) });
  }
  return null;
}
