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
  /** "razorpay" (native SDK) or "mock" (open-source test stack hosted checkout). */
  paymentProvider: (process.env.EXPO_PUBLIC_PAYMENT_PROVIDER ?? "razorpay") as "razorpay" | "mock",
  mockGatewayUrl: (process.env.EXPO_PUBLIC_MOCK_GATEWAY_URL ?? "http://127.0.0.1:4010").replace(/\/$/, ""),
  /** "ola" (default when a key is set), "osm" (OpenStreetMap services) or "device" (OS geocoder only). */
  mapsProvider: (process.env.EXPO_PUBLIC_MAPS_PROVIDER ?? (process.env.EXPO_PUBLIC_OLA_MAPS_API_KEY ? "ola" : "device")) as "ola" | "osm" | "device",
  nominatimUrl: (process.env.EXPO_PUBLIC_NOMINATIM_URL ?? "https://nominatim.openstreetmap.org").replace(/\/$/, ""),
  photonUrl: (process.env.EXPO_PUBLIC_PHOTON_URL ?? "https://photon.komoot.io").replace(/\/$/, ""),
  isLocalSupabase: (process.env.EXPO_PUBLIC_SUPABASE_URL ?? "").includes("127.0.0.1") || !process.env.EXPO_PUBLIC_SUPABASE_URL,
} as const;
