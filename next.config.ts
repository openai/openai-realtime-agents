import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: {
    // Avoid failing the Vercel build on lint errors; we still lint locally
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Keep type errors as build blockers (safer defaults)
    ignoreBuildErrors: false,
  },
};

export default nextConfig;
