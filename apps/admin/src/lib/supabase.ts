"use client";

import type { Database } from "@ration/shared";
import { createBrowserClient } from "@supabase/ssr";

import { env } from "./env";

export const supabase = createBrowserClient<Database>(env.supabaseUrl, env.supabaseAnonKey);
