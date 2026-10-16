const strip = (v: string | undefined, fallback: string) => (v ?? fallback).replace(/\/$/, "");
export const env = {
  supabaseUrl: strip(process.env.NEXT_PUBLIC_SUPABASE_URL, "http://127.0.0.1:54321"),
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "local-dev-anon-key",
} as const;
