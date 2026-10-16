import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The storefront is per-user and per-location dynamic; render on request and let
  // React Query cache on the client. Static marketing/legal pages stay static.
  cacheComponents: false,
  images: {
    remotePatterns: [{ protocol: "https", hostname: "**" }, { protocol: "http", hostname: "127.0.0.1" }, { protocol: "http", hostname: "localhost" }],
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
