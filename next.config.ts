import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ['@playwright/mcp', '@modelcontextprotocol/sdk', '@playwright/test', 'playwright', 'playwright-core'],
};

export default nextConfig;
