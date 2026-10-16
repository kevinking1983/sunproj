import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: false,
  images: { remotePatterns: [{ protocol: "https", hostname: "**" }, { protocol: "http", hostname: "127.0.0.1" }, { protocol: "http", hostname: "localhost" }] },
  turbopack: { rules: { "*.css": { loaders: ["@tailwindcss/turbopack"], as: "*.css" } } },
};

export default nextConfig;
