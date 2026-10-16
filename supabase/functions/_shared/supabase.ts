import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";

import { HttpError } from "./http.ts";

const url = () => Deno.env.get("SUPABASE_URL") ?? "";
const anonKey = () => Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const serviceKey = () => Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

/** Client acting as the server: bypasses RLS. Only used after the caller is authenticated. */
export const adminClient = (): SupabaseClient => createClient(url(), serviceKey(), { auth: { persistSession: false } });

/** Resolves the calling user from the Authorization header, or throws 401. */
export const requireUser = async (req: Request): Promise<{ id: string; phone: string | null }> => {
  const auth = req.headers.get("Authorization") ?? "";
  const token = auth.replace(/^Bearer\s+/i, "");
  if (!token) throw new HttpError(401, "UNAUTHENTICATED");
  const client = createClient(url(), anonKey(), { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false } });
  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) throw new HttpError(401, "UNAUTHENTICATED");
  return { id: data.user.id, phone: data.user.phone ?? null };
};
