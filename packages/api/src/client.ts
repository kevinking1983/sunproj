import type { Database } from "@ration/shared";
import type { SupabaseClient } from "@supabase/supabase-js";

/** Every API module takes the caller's client so RLS applies with their session. */
export type Client = SupabaseClient<Database>;
