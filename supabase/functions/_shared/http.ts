export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, idempotency-key",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export const json = (body: unknown, status = 200, extra: Record<string, string> = {}): Response =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json", ...extra } });

export class HttpError extends Error {
  constructor(public status: number, public code: string, message?: string) {
    super(message ?? code);
  }
}

/** Maps a Postgres P0001 raise from our RPCs ("OUT_OF_STOCK:Toor Dal") to a client error. */
export const errorResponse = (e: unknown): Response => {
  if (e instanceof HttpError) return json({ error: e.code, message: e.message }, e.status);
  const message = e instanceof Error ? e.message : String(e);
  const idx = message.indexOf(":");
  const code = idx === -1 ? message : message.slice(0, idx);
  const detail = idx === -1 ? "" : message.slice(idx + 1).trim();
  const known = /^[A-Z_]+$/.test(code);
  console.error("edge function error:", message);
  return json({ error: known ? code : "INTERNAL", message: known ? detail || code : "Something went wrong" }, known ? 400 : 500);
};

export const handleOptions = (req: Request): Response | null => (req.method === "OPTIONS" ? new Response("ok", { headers: corsHeaders }) : null);
