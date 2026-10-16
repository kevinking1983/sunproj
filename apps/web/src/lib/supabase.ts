"use client";

import type { Database } from "@ration/shared";
import { createBrowserClient } from "@supabase/ssr";

import { env } from "./env";

/** Browser client with cookie-backed sessions (shared with any server components later). */
export const supabase = createBrowserClient<Database>(env.supabaseUrl, env.supabaseAnonKey);
