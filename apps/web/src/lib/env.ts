/** Public runtime configuration. NEXT_PUBLIC_* values are inlined at build time. */
const strip = (v: string | undefined, fallback: string) => (v ?? fallback).replace(/\/$/, "");

export const env = {
  supabaseUrl: strip(process.env.NEXT_PUBLIC_SUPABASE_URL, "http://127.0.0.1:54321"),
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "local-dev-anon-key",
  paymentProvider: (process.env.NEXT_PUBLIC_PAYMENT_PROVIDER ?? "razorpay") as "razorpay" | "mock",
  mockGatewayUrl: strip(process.env.NEXT_PUBLIC_MOCK_GATEWAY_URL, "http://127.0.0.1:4010"),
  mapsProvider: (process.env.NEXT_PUBLIC_MAPS_PROVIDER ?? (process.env.NEXT_PUBLIC_OLA_MAPS_API_KEY ? "ola" : "osm")) as "ola" | "osm",
  olaMapsApiKey: process.env.NEXT_PUBLIC_OLA_MAPS_API_KEY ?? "",
  nominatimUrl: strip(process.env.NEXT_PUBLIC_NOMINATIM_URL, "https://nominatim.openstreetmap.org"),
  photonUrl: strip(process.env.NEXT_PUBLIC_PHOTON_URL, "https://photon.komoot.io"),
  siteUrl: strip(process.env.NEXT_PUBLIC_SITE_URL, "http://localhost:3000"),
} as const;
