/**
 * Public runtime configuration. Only EXPO_PUBLIC_* variables are inlined into the bundle;
 * anything secret lives in Supabase Edge Function secrets.
 */
const read = (key: string, fallback?: string): string => {
  const value = process.env[key] ?? fallback;
  if (!value) {
    throw new Error(`Missing environment variable ${key}. Copy .env.example to apps/mobile/.env.`);
  }
  return value;
};

export const env = {
  supabaseUrl: read("EXPO_PUBLIC_SUPABASE_URL", "http://127.0.0.1:54321"),
  supabaseAnonKey: read("EXPO_PUBLIC_SUPABASE_ANON_KEY", "local-dev-anon-key"),
  razorpayKeyId: process.env.EXPO_PUBLIC_RAZORPAY_KEY_ID ?? "",
  olaMapsApiKey: process.env.EXPO_PUBLIC_OLA_MAPS_API_KEY ?? "",
  isLocalSupabase: (process.env.EXPO_PUBLIC_SUPABASE_URL ?? "").includes("127.0.0.1") || !process.env.EXPO_PUBLIC_SUPABASE_URL,
} as const;
