import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Self-contained server bundle for the Cloud Run image (Dockerfile).
  output: "standalone",
};

export default nextConfig;
